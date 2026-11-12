/**
 * הקוד (The Code) — the ONLY module that talks to Firestore for this feature.
 * Admin SDK only; every path below is locked in firestore.rules (`if false`).
 *
 *   codes/{codeId}/thecode/adventure   { version, config, riddles, updatedAt }  — one doc = one read per action
 *   codes/{codeId}/thecode/stats       blind FieldValue.increment counters (never read in play)
 *   codes/{codeId}/thecodePlayers/{id} TheCodePlayer + tokenHashes, week, originalName, rate, expireAt
 *   thecodeGnomeCodes/{code}           { codeId, gnomeId } for the QR slug AND the manual code
 *
 * Spec: docs/THE_CODE_PLAN.md §8. Wire contract: src/types/thecode-api.ts.
 * Route behaviour for the UIs: docs/THE_CODE_SERVER_NOTES.md.
 */

import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import {
  FieldPath,
  FieldValue,
  Timestamp,
  type DocumentData,
  type DocumentReference,
  type DocumentSnapshot,
} from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import type { TheCodeAdminPlayer, TheCodeConfig, TheCodeGnomeStats, TheCodePlayer, TheCodeRiddle, TheCodeRiddleStats } from '@/types/thecode';
import type {
  TheCodeAdminLoadResponse,
  TheCodeAdminSaveResponse,
  TheCodeAuth,
  TheCodeGnomeLookupResponse,
  TheCodeLeaderboardResponse,
  TheCodeLeaderRow,
  TheCodePlayAction,
  TheCodePlayError,
  TheCodePlayEvent,
  TheCodeSnapshot,
} from '@/types/thecode-api';
import {
  answerRiddle,
  arrangeHelp,
  canPublish,
  createPlayer,
  openSuitcase,
  repairRun,
  requestHint,
  resolveRules,
  scanGnome,
  startNewRun,
  validateAdventure,
  type TheCodeContext,
} from './engine';
import { defaultTheCodeConfig, normalizeAdventure, removedGnomes, toPublicConfig } from './server/admin';
import { BASE62, MANUAL_CODE_LENGTH, QR_SLUG_LENGTH, RECOVERY_CODE_LENGTH, UNAMBIGUOUS, cleanRecoveryCode, cleanScanCode, drawCode } from './server/codes';
import { normalizeEmoji, normalizeFamilyName } from './server/names';
import { takeRate, type TheCodeRateWindow } from './server/rate';
import { buildSnapshot, gnomeView, type TheCodeAdventureData } from './server/snapshot';
import { resolveHowToPlay } from './howToPlay';
import { addWeekDelta, DEFAULT_WEEK_TIME_ZONE, weekKey, type TheCodeWeeks } from './server/week';

/** Venue zone for active hours + weekly boards (one venue = one zone for now). */
export const THECODE_TIME_ZONE = DEFAULT_WEEK_TIME_ZONE;
const MAX_TOKENS = 5;
const ADMIN_PLAYERS_LIMIT = 500;
const LEADER_ROWS = 20;
/** Register / recover per IP (a hotel is ONE public IP → generous). */
const IP_LIMITS = {
  register: { max: 40, windowMs: 10 * 60_000 },
  recover: { max: 30, windowMs: 10 * 60_000 },
};

export class TheCodeStoreError extends Error {
  constructor(public code: TheCodePlayError | 'conflict' | 'invalid', public status: number, public retryAfterSeconds?: number) {
    super(code);
  }
}

// =================================================================
// Refs + small helpers
// =================================================================

const db = () => getAdminDb();
const codeRef = (codeId: string) => db().collection('codes').doc(codeId);
const adventureRef = (codeId: string) => codeRef(codeId).collection('thecode').doc('adventure');
const statsRef = (codeId: string) => codeRef(codeId).collection('thecode').doc('stats');
const playersCol = (codeId: string) => codeRef(codeId).collection('thecodePlayers');
const gnomeCodeRef = (code: string) => db().collection('thecodeGnomeCodes').doc(code);

export function isValidCodeId(v: unknown): v is string {
  return typeof v === 'string' && /^[A-Za-z0-9]{6,40}$/.test(v);
}

function isValidPlayerId(v: unknown): v is string {
  return typeof v === 'string' && /^[A-Za-z0-9]{10,40}$/.test(v);
}

const bytes = (n: number) => randomBytes(n);
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/** Crypto-backed uniform [0,1) for the engine (pooled so a run build is cheap). */
function cryptoRng(): () => number {
  let pool = randomBytes(1024);
  let at = 0;
  return () => {
    if (at + 4 > pool.length) {
      pool = randomBytes(1024);
      at = 0;
    }
    const v = pool.readUInt32BE(at);
    at += 4;
    return v / 4294967296;
  };
}

const newRunId = () => `run_${drawCode(bytes, BASE62, 12)}`;

function tokenMatches(hashes: string[] | undefined, token: unknown): boolean {
  if (typeof token !== 'string' || token.length < 20 || token.length > 200) return false;
  const h = Buffer.from(sha256(token), 'hex');
  let ok = false;
  for (const stored of hashes || []) {
    const b = Buffer.from(String(stored), 'hex');
    if (b.length === h.length && timingSafeEqual(b, h)) ok = true;
  }
  return ok;
}

/** Firestore rejects `undefined`; the engine leaves none on purpose, this is the belt. */
function plain<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

interface AdventureDoc extends TheCodeAdventureData {
  version: number;
}

function readAdventure(snap: DocumentSnapshot): AdventureDoc | null {
  if (!snap.exists) return null;
  const d = snap.data() || {};
  if (!d.config) return null;
  return { version: Number(d.version) || 0, config: d.config as TheCodeConfig, riddles: (d.riddles || []) as TheCodeRiddle[] };
}

interface PlayerServerFields {
  tokenHashes: string[];
  week: TheCodeWeeks;
  originalName?: string;
  rate?: TheCodeRateWindow;
}

const SERVER_KEYS = ['tokenHashes', 'week', 'originalName', 'rate', 'expireAt'] as const;

function splitPlayer(d: DocumentData): { core: TheCodePlayer; server: PlayerServerFields } {
  const core: Record<string, unknown> = { ...d };
  for (const k of SERVER_KEYS) delete core[k];
  const server: PlayerServerFields = {
    tokenHashes: Array.isArray(d.tokenHashes) ? d.tokenHashes : [],
    week: (d.week && typeof d.week === 'object' ? d.week : {}) as TheCodeWeeks,
  };
  if (typeof d.originalName === 'string') server.originalName = d.originalName;
  if (d.rate) server.rate = d.rate as TheCodeRateWindow;
  return { core: core as unknown as TheCodePlayer, server };
}

function playerDoc(core: TheCodePlayer, server: PlayerServerFields, retentionDays: number): DocumentData {
  const doc: DocumentData = { ...plain(core), tokenHashes: server.tokenHashes, week: server.week };
  if (server.originalName) doc.originalName = server.originalName;
  if (server.rate) doc.rate = server.rate;
  const days = Math.max(1, Number(retentionDays) || 90);
  doc.expireAt = Timestamp.fromMillis(core.lastSeenAt + days * 86_400_000);
  return doc;
}

function ctxFor(adv: TheCodeAdventureData, now: number): TheCodeContext {
  return { config: adv.config, riddles: adv.riddles, now, rng: cryptoRng(), timeZone: THECODE_TIME_ZONE };
}

/** Firestore-based sliding window per key (rateLimits is Admin-only). true = allowed + recorded. */
async function takeIpSlot(id: string, limit: { max: number; windowMs: number }): Promise<boolean> {
  const ref = db().collection('rateLimits').doc(id);
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();
    const recent = ((snap.data()?.hits as number[] | undefined) || []).filter((t) => now - t < limit.windowMs);
    if (recent.length >= limit.max) return false;
    recent.push(now);
    tx.set(ref, { hits: recent, expiresAt: new Date(now + limit.windowMs) });
    return true;
  });
}

async function guardIp(kind: keyof typeof IP_LIMITS, ip: string, codeId: string): Promise<void> {
  const id = `thecode_${kind}_${sha256(`${codeId}|${ip}`).slice(0, 40)}`;
  if (!(await takeIpSlot(id, IP_LIMITS[kind]))) throw new TheCodeStoreError('rateLimited', 429, 60);
}

// =================================================================
// Player API
// =================================================================

export interface TheCodePlayResult {
  snapshot: TheCodeSnapshot;
  event?: TheCodePlayEvent;
  auth?: TheCodeAuth;
}

async function loadAdventureOrThrow(codeId: string): Promise<AdventureDoc> {
  const adv = readAdventure(await adventureRef(codeId).get());
  if (!adv) throw new TheCodeStoreError('notFound', 404);
  return adv;
}

async function uniqueRecoveryCode(codeId: string): Promise<string> {
  for (let i = 0; i < 6; i++) {
    const code = drawCode(bytes, UNAMBIGUOUS, RECOVERY_CODE_LENGTH);
    const hit = await playersCol(codeId).where('recoveryCode', '==', code).limit(1).get();
    if (hit.empty) return code;
  }
  throw new TheCodeStoreError('server', 500);
}

async function register(codeId: string, action: Extract<TheCodePlayAction, { type: 'register' }>, ip: string): Promise<TheCodePlayResult> {
  const name = normalizeFamilyName(action.familyName);
  if (!name.ok) throw new TheCodeStoreError('invalidName', 400);
  const emoji = normalizeEmoji(action.emoji);
  if (!emoji) throw new TheCodeStoreError('badRequest', 400);
  const adv = await loadAdventureOrThrow(codeId);
  await guardIp('register', ip, codeId);

  const now = Date.now();
  const token = randomBytes(32).toString('base64url');
  const id = drawCode(bytes, BASE62, 20);
  const recoveryCode = await uniqueRecoveryCode(codeId);
  const player = createPlayer({ id, familyName: name.name, emoji, recoveryCode, now });
  const server: PlayerServerFields = { tokenHashes: [sha256(token)], week: {} };
  await playersCol(codeId).doc(id).create(playerDoc(player, server, adv.config.retentionDays));
  return {
    snapshot: buildSnapshot(adv, player, now, THECODE_TIME_ZONE),
    event: { type: 'registered' },
    auth: { playerId: id, token },
  };
}

async function recover(codeId: string, action: Extract<TheCodePlayAction, { type: 'recover' }>, ip: string): Promise<TheCodePlayResult> {
  await guardIp('recover', ip, codeId);
  const code = cleanRecoveryCode(action.recoveryCode);
  if (!code) throw new TheCodeStoreError('recoveryNotFound', 404);
  const hit = await playersCol(codeId).where('recoveryCode', '==', code).limit(1).get();
  if (hit.empty) throw new TheCodeStoreError('recoveryNotFound', 404);
  const ref = hit.docs[0].ref;
  const token = randomBytes(32).toString('base64url');

  const out = await db().runTransaction(async (tx) => {
    const [advSnap, pSnap] = await tx.getAll(adventureRef(codeId), ref);
    const adv = readAdventure(advSnap);
    if (!adv) throw new TheCodeStoreError('notFound', 404);
    if (!pSnap.exists) throw new TheCodeStoreError('recoveryNotFound', 404);
    const { core, server } = splitPlayer(pSnap.data()!);
    const now = Date.now();
    const player = { ...core, lastSeenAt: now };
    server.tokenHashes = [...server.tokenHashes, sha256(token)].slice(-MAX_TOKENS);
    tx.set(ref, playerDoc(player, server, adv.config.retentionDays));
    return { adv, player, now };
  });
  return {
    snapshot: buildSnapshot(out.adv, out.player, out.now, THECODE_TIME_ZONE),
    event: { type: 'recovered' },
    auth: { playerId: out.player.id, token },
  };
}

/** Resolve a scanned / typed code to a gnome of THIS adventure, or null. */
async function resolveScan(codeId: string, raw: unknown): Promise<string | null> {
  const code = cleanScanCode(raw);
  if (!code) return null;
  const tries = code.toUpperCase() === code ? [code] : [code, code.toUpperCase()];
  for (const c of tries) {
    const snap = await gnomeCodeRef(c).get();
    if (!snap.exists) continue;
    const d = snap.data()!;
    return d.codeId === codeId && typeof d.gnomeId === 'string' ? d.gnomeId : null;
  }
  return null;
}

type StatsUpdate = { gnomes?: Record<string, unknown>; riddles?: Record<string, unknown> };

/**
 * Every player action. `state` works without auth; `register` / `recover` mint a
 * token; everything else needs `auth`. Throws TheCodeStoreError for known failures.
 */
export async function playAction(
  codeId: string,
  auth: TheCodeAuth | undefined,
  action: TheCodePlayAction,
  ip: string
): Promise<TheCodePlayResult> {
  if (action.type === 'register') return register(codeId, action, ip);
  if (action.type === 'recover') return recover(codeId, action, ip);

  if (!auth) {
    if (action.type !== 'state') throw new TheCodeStoreError('needRegister', 401);
    const adv = await loadAdventureOrThrow(codeId);
    return { snapshot: buildSnapshot(adv, null, Date.now(), THECODE_TIME_ZONE) };
  }
  if (!isValidPlayerId(auth.playerId)) throw new TheCodeStoreError('unauthorized', 401);

  // Outside the transaction: the index doc is immutable for a gnome's lifetime.
  const scannedGnomeId = action.type === 'scan' ? await resolveScan(codeId, action.code) : null;
  const playerRef = playersCol(codeId).doc(auth.playerId);
  const sRef = statsRef(codeId);

  const result = await db().runTransaction(async (tx) => {
    // ---- reads (all of them, before any write)
    const [advSnap, pSnap] = await tx.getAll(adventureRef(codeId), playerRef);
    const adv = readAdventure(advSnap);
    if (!adv) throw new TheCodeStoreError('notFound', 404);
    if (!pSnap.exists) throw new TheCodeStoreError('unauthorized', 401);
    const { core: before, server } = splitPlayer(pSnap.data()!);
    if (!tokenMatches(server.tokenHashes, auth.token)) throw new TheCodeStoreError('unauthorized', 401);

    const now = Date.now();
    const rate = takeRate(server.rate, now);
    if (!rate.ok) throw new TheCodeStoreError('rateLimited', 429, rate.retryAfterSeconds);
    server.rate = rate.rate;

    // ---- engine
    const ctx = ctxFor(adv, now);
    const gnomes = new Map(adv.config.gnomes.map((g) => [g.id, g] as const));
    let next: TheCodePlayer = before;
    let event: TheCodePlayEvent | undefined;
    const stats: StatsUpdate = {};
    const bumpRiddle = (riddleId: string | undefined, field: keyof TheCodeRiddleStats) => {
      if (!riddleId) return;
      stats.riddles = { ...(stats.riddles || {}), [riddleId]: { [field]: FieldValue.increment(1) } };
    };

    switch (action.type) {
      case 'state': {
        next = { ...repairRun(before, ctx).player, lastSeenAt: now };
        break;
      }
      case 'scan': {
        // '' is never a gnome id → the engine answers paused / unknownGnome.
        const r = scanGnome(before, scannedGnomeId || '', ctx, { runId: newRunId() });
        next = r.player;
        const g = scannedGnomeId ? gnomes.get(scannedGnomeId) : undefined;
        event = { type: 'scan', outcome: r.outcome, ...(g && r.outcome.kind !== 'unknownGnome' ? { gnome: gnomeView(g) } : {}) };
        if (g && r.outcome.kind !== 'paused') {
          stats.gnomes = { [g.id]: { scans: FieldValue.increment(1), lastScanAt: now } };
        }
        break;
      }
      case 'answer': {
        const slotIndex = Number.isInteger(action.slotIndex) && action.slotIndex >= 0 && action.slotIndex < 200 ? action.slotIndex : -1;
        if (slotIndex < 0 || typeof action.letter !== 'string' || action.letter.length > 4) {
          throw new TheCodeStoreError('badRequest', 400);
        }
        const r = answerRiddle(before, { letter: action.letter, slotIndex }, ctx);
        next = r.player;
        event = { type: 'answer', outcome: r.outcome };
        const rid = next.run?.slots[slotIndex]?.riddleId;
        if (!r.replayed && r.outcome.kind === 'correct') bumpRiddle(rid, 'correct');
        if (r.outcome.kind === 'wrong') bumpRiddle(rid, 'wrong');
        break;
      }
      case 'hint': {
        if (action.hintKind !== 'location' && action.hintKind !== 'riddle') throw new TheCodeStoreError('badRequest', 400);
        const r = requestHint(before, action.hintKind, ctx);
        next = r.player;
        const given = r.outcome.kind === 'hint';
        event = { type: 'hint', hintKind: action.hintKind, given, cost: given && r.outcome.kind === 'hint' ? r.outcome.cost : 0 };
        if (given && action.hintKind === 'riddle' && next.run && next.run.targetSlotIndex !== null) {
          bumpRiddle(next.run.slots[next.run.targetSlotIndex]?.riddleId, 'hints');
        }
        break;
      }
      case 'arrangeHelp': {
        const r = arrangeHelp(before, ctx);
        next = r.player;
        event = r.outcome.kind === 'helped'
          ? { type: 'arrangeHelp', given: true, cost: r.outcome.cost, position: r.outcome.position, letter: r.outcome.letter }
          : { type: 'arrangeHelp', given: false, cost: 0 };
        break;
      }
      case 'open': {
        const arr = action.arrangement;
        if (!Array.isArray(arr) || arr.length > 200 || arr.some((x) => typeof x !== 'string' || x.length > 4)) {
          throw new TheCodeStoreError('badRequest', 400);
        }
        const r = openSuitcase(before, arr, ctx);
        next = r.player;
        event = r.outcome.kind === 'opened'
          ? { type: 'open', opened: true, bonus: r.outcome.bonus }
          : { type: 'open', opened: false, bonus: 0 };
        break;
      }
      case 'newSuitcase': {
        const r = startNewRun(repairRun(before, ctx).player, ctx, { runId: newRunId() });
        next = r.player;
        event = { type: 'newSuitcase', started: r.outcome.kind === 'started' };
        break;
      }
      default:
        throw new TheCodeStoreError('badRequest', 400);
    }

    // ---- writes
    const pointsDelta = next.points - before.points;
    const suitcasesDelta = next.suitcasesOpened - before.suitcasesOpened;
    server.week = addWeekDelta(server.week, weekKey(now, THECODE_TIME_ZONE), pointsDelta, suitcasesDelta);
    tx.set(playerRef, playerDoc(next, server, adv.config.retentionDays));
    if (stats.gnomes || stats.riddles) tx.set(sRef, stats, { merge: true });
    return { adv, next, event, now };
  });

  return { snapshot: buildSnapshot(result.adv, result.next, result.now, THECODE_TIME_ZONE), event: result.event };
}

// =================================================================
// Gnome lookup (/g/{code})
// =================================================================

export async function lookupGnome(raw: unknown): Promise<TheCodeGnomeLookupResponse> {
  const notFound: TheCodeGnomeLookupResponse = { ok: false, error: 'notFound' };
  const code = cleanScanCode(raw);
  if (!code) return notFound;
  const tries = code.toUpperCase() === code ? [code] : [code, code.toUpperCase()];
  let hit: { codeId: string; gnomeId: string } | null = null;
  for (const c of tries) {
    const snap = await gnomeCodeRef(c).get();
    if (snap.exists) {
      const d = snap.data()!;
      if (typeof d.codeId === 'string' && typeof d.gnomeId === 'string') hit = { codeId: d.codeId, gnomeId: d.gnomeId };
      break;
    }
  }
  if (!hit || !isValidCodeId(hit.codeId)) return notFound;
  const [codeSnap, advSnap] = await db().getAll(codeRef(hit.codeId), adventureRef(hit.codeId));
  const adv = readAdventure(advSnap);
  if (!codeSnap.exists || !adv) return notFound;
  const gnome = adv.config.gnomes.find((g) => g.id === hit!.gnomeId);
  if (!gnome) return notFound;
  return {
    ok: true,
    codeId: hit.codeId,
    shortId: String(codeSnap.data()?.shortId || ''),
    title: adv.config.title,
    language: adv.config.language,
    gnome: gnomeView(gnome),
    ...(adv.config.branding ? { branding: adv.config.branding } : {}),
    howToPlay: resolveHowToPlay(adv.config, resolveRules(adv.config.rules)),
  };
}

// =================================================================
// Leaderboard
// =================================================================

function weekField(key: string, field: 'points' | 'suitcases') {
  return new FieldPath('week', key, field);
}

export async function leaderboard(
  codeId: string,
  scope: 'week' | 'all',
  playerId?: string
): Promise<TheCodeLeaderboardResponse | null> {
  const codeSnap = await codeRef(codeId).get();
  if (!codeSnap.exists) return null;
  const media = ((codeSnap.data()?.media || []) as { type?: string; thecodeConfig?: { title?: string } }[]).find((m) => m.type === 'thecode');
  if (!media) return null;
  const key = weekKey(Date.now(), THECODE_TIME_ZONE);
  const pointsOf = (d: DocumentData) => (scope === 'week' ? Number(d.week?.[key]?.points) || 0 : Number(d.points) || 0);
  const suitcasesOf = (d: DocumentData) => (scope === 'week' ? Number(d.week?.[key]?.suitcases) || 0 : Number(d.suitcasesOpened) || 0);

  const order = scope === 'week' ? weekField(key, 'points') : 'points';
  // Hidden / zero-point families are skipped, so read a few more than shown.
  const snap = await playersCol(codeId).orderBy(order, 'desc').limit(LEADER_ROWS * 3).get();
  const rows: TheCodeLeaderRow[] = [];
  for (const doc of snap.docs) {
    const d = doc.data();
    const points = pointsOf(d);
    if (d.hidden || points <= 0) continue;
    rows.push({ id: doc.id, familyName: String(d.familyName || ''), emoji: String(d.emoji || ''), points, suitcases: suitcasesOf(d) });
    if (rows.length >= LEADER_ROWS) break;
  }

  const res: TheCodeLeaderboardResponse = {
    ok: true, scope, title: String(media.thecodeConfig?.title || ''), rows, serverNow: Date.now(),
  };
  if (isValidPlayerId(playerId) && !rows.some((r) => r.id === playerId)) {
    const me = await playersCol(codeId).doc(playerId).get();
    const d = me.data();
    const points = d ? pointsOf(d) : 0;
    if (d && !d.hidden && points > 0) {
      // Rank = families with more points + 1 (hidden families are counted too — cheap and close enough).
      const ahead = await playersCol(codeId).where(order, '>', points).count().get();
      res.me = { rank: ahead.data().count + 1, points };
    }
  }
  return res;
}

// =================================================================
// Operator
// =================================================================

function adminPlayer(id: string, d: DocumentData, key: string): TheCodeAdminPlayer {
  const p: TheCodeAdminPlayer = {
    id,
    familyName: String(d.familyName || ''),
    emoji: String(d.emoji || ''),
    hidden: !!d.hidden,
    points: Number(d.points) || 0,
    weekPoints: Number(d.week?.[key]?.points) || 0,
    suitcases: Number(d.suitcasesOpened) || 0,
    weekSuitcases: Number(d.week?.[key]?.suitcases) || 0,
    lastSeenAt: Number(d.lastSeenAt) || 0,
  };
  if (typeof d.originalName === 'string' && d.originalName !== p.familyName) p.originalName = d.originalName;
  return p;
}

function stubTitle(codeData: DocumentData | undefined): string | undefined {
  const media = ((codeData?.media || []) as { type?: string; thecodeConfig?: { title?: string } }[]).find((m) => m.type === 'thecode');
  return media?.thecodeConfig?.title || undefined;
}

export async function loadAdmin(codeId: string): Promise<TheCodeAdminLoadResponse> {
  const [advSnap, statsSnap, codeSnap] = await db().getAll(adventureRef(codeId), statsRef(codeId), codeRef(codeId));
  const players = await playersCol(codeId).orderBy('lastSeenAt', 'desc').limit(ADMIN_PLAYERS_LIMIT).get();
  const adv = readAdventure(advSnap);
  const s = statsSnap.data() || {};
  const gnomeStats: Record<string, TheCodeGnomeStats> = {};
  for (const [id, v] of Object.entries((s.gnomes || {}) as Record<string, DocumentData>)) {
    gnomeStats[id] = { scans: Number(v?.scans) || 0, ...(v?.lastScanAt ? { lastScanAt: Number(v.lastScanAt) } : {}) };
  }
  const riddleStats: Record<string, TheCodeRiddleStats> = {};
  for (const [id, v] of Object.entries((s.riddles || {}) as Record<string, DocumentData>)) {
    riddleStats[id] = { correct: Number(v?.correct) || 0, wrong: Number(v?.wrong) || 0, hints: Number(v?.hints) || 0 };
  }
  const key = weekKey(Date.now(), THECODE_TIME_ZONE);
  return {
    ok: true,
    version: adv?.version ?? 0,
    config: adv?.config ?? defaultTheCodeConfig(stubTitle(codeSnap.data())),
    riddles: adv?.riddles ?? [],
    gnomeStats,
    riddleStats,
    players: players.docs.map((d) => adminPlayer(d.id, d.data(), key)),
  };
}

/** Draw codes for gnomes that have none, retrying any that already exist anywhere. */
async function assignGnomeCodes(
  tx: FirebaseFirestore.Transaction,
  gnomes: TheCodeConfig['gnomes']
): Promise<{ ref: DocumentReference; gnomeId: string; kind: 'qr' | 'manual' }[]> {
  const need = gnomes.filter((g) => !g.code || !g.manualCode);
  const created: { ref: DocumentReference; gnomeId: string; kind: 'qr' | 'manual' }[] = [];
  if (!need.length) return created;
  const taken = new Set(gnomes.flatMap((g) => [g.code, g.manualCode]).filter(Boolean));
  let pending = need.flatMap((g) => [
    ...(!g.code ? [{ g, kind: 'qr' as const }] : []),
    ...(!g.manualCode ? [{ g, kind: 'manual' as const }] : []),
  ]);
  for (let round = 0; round < 6 && pending.length; round++) {
    const drawn = pending.map((p) => {
      let code: string;
      do {
        code = p.kind === 'qr' ? drawCode(bytes, BASE62, QR_SLUG_LENGTH) : drawCode(bytes, UNAMBIGUOUS, MANUAL_CODE_LENGTH);
      } while (taken.has(code));
      taken.add(code);
      return { ...p, code };
    });
    const snaps = await tx.getAll(...drawn.map((d) => gnomeCodeRef(d.code)));
    const retry: typeof pending = [];
    drawn.forEach((d, i) => {
      if (snaps[i].exists) {
        retry.push({ g: d.g, kind: d.kind });
        return;
      }
      if (d.kind === 'qr') d.g.code = d.code;
      else d.g.manualCode = d.code;
      created.push({ ref: gnomeCodeRef(d.code), gnomeId: d.g.id, kind: d.kind });
    });
    pending = retry;
  }
  if (pending.length) throw new TheCodeStoreError('server', 500);
  return created;
}

export async function saveAdventure(codeId: string, body: unknown): Promise<TheCodeAdminSaveResponse> {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const baseVersion = b.baseVersion;
  if (typeof baseVersion !== 'number' || !Number.isInteger(baseVersion) || baseVersion < 0) {
    return { ok: false, error: 'badRequest' };
  }
  return db().runTransaction(async (tx): Promise<TheCodeAdminSaveResponse> => {
    // ---- reads
    const [advSnap, codeSnap] = await tx.getAll(adventureRef(codeId), codeRef(codeId));
    const stored = readAdventure(advSnap);
    const storedVersion = stored?.version ?? 0;
    if (baseVersion !== storedVersion) return { ok: false, error: 'conflict', version: storedVersion };
    const norm = normalizeAdventure(b.config, b.riddles, stored?.config ?? null);
    if (!norm.ok) return { ok: false, error: 'badRequest' };
    const { config, riddles } = norm;
    const issues = validateAdventure(config, riddles);
    if (config.status === 'published' && !canPublish(issues)) return { ok: false, error: 'invalid', issues };
    const created = await assignGnomeCodes(tx, config.gnomes); // reads only

    // ---- writes
    const version = storedVersion + 1;
    tx.set(adventureRef(codeId), { version, config: plain(config), riddles: plain(riddles), updatedAt: FieldValue.serverTimestamp() });
    for (const c of created) tx.create(c.ref, { codeId, gnomeId: c.gnomeId, kind: c.kind, createdAt: FieldValue.serverTimestamp() });
    for (const g of removedGnomes(stored?.config ?? null, config)) {
      if (g.code) tx.delete(gnomeCodeRef(g.code));
      if (g.manualCode) tx.delete(gnomeCodeRef(g.manualCode));
    }
    const media = (codeSnap.data()?.media || []) as Record<string, unknown>[];
    const at = media.findIndex((m) => m?.type === 'thecode');
    if (at >= 0) {
      const nextMedia = media.slice();
      nextMedia[at] = { ...media[at], thecodeConfig: toPublicConfig(config) };
      tx.update(codeRef(codeId), { media: nextMedia });
    }
    return { ok: true, version, config, riddles, issues };
  });
}

export type TheCodeAdminPlayerResult =
  | { ok: true; player: TheCodeAdminPlayer }
  | { ok: false; error: 'notFound' | 'invalidName' | 'badRequest' };

export async function patchPlayer(
  codeId: string,
  playerId: unknown,
  patch: unknown
): Promise<TheCodeAdminPlayerResult> {
  if (!isValidPlayerId(playerId) || !patch || typeof patch !== 'object') return { ok: false, error: 'badRequest' };
  const p = patch as { familyName?: unknown; hidden?: unknown };
  if (p.hidden !== undefined && typeof p.hidden !== 'boolean') return { ok: false, error: 'badRequest' };
  let name: string | undefined;
  if (p.familyName !== undefined) {
    const n = normalizeFamilyName(p.familyName);
    if (!n.ok) return { ok: false, error: 'invalidName' };
    name = n.name;
  }
  const ref = playersCol(codeId).doc(playerId);
  return db().runTransaction(async (tx): Promise<TheCodeAdminPlayerResult> => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { ok: false, error: 'notFound' };
    const d = snap.data()!;
    const update: DocumentData = {};
    if (name !== undefined && name !== d.familyName) {
      update.familyName = name;
      if (typeof d.originalName !== 'string') update.originalName = d.familyName;
    }
    if (typeof p.hidden === 'boolean') update.hidden = p.hidden;
    if (Object.keys(update).length) tx.update(ref, update);
    return { ok: true, player: adminPlayer(snap.id, { ...d, ...update }, weekKey(Date.now(), THECODE_TIME_ZONE)) };
  });
}

export async function deletePlayer(codeId: string, playerId: unknown): Promise<{ ok: true } | { ok: false; error: 'badRequest' }> {
  if (!isValidPlayerId(playerId)) return { ok: false, error: 'badRequest' };
  await playersCol(codeId).doc(playerId).delete();
  return { ok: true };
}
