// "10 בול" phone-mode store — FIRESTORE, Admin SDK only (server-side).
// Players live under codes/{codeId}/tenboolPlayers/{playerId}. The subcollection is locked in
// firestore.rules (read/write: false): phones and OTP state never reach a browser except through
// the owner-authenticated admin route. The big screen reads a public projection via /api/tenbool/board.
//
// Lists without composite indexes: a player is on the winners / closest list exactly when the
// numeric `winRank` / `nearRank` field exists (see rankFields), so each list is a single-field
// orderBy that Firestore indexes automatically.

import crypto from 'crypto';
import { AggregateField, FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import {
  MIN_ROUND_GAP_MS,
  NEAR_LIST_SIZE,
  diffFromTarget,
  judgeTiming,
  randomNickname,
  rankFields,
  type TimingVerdict,
} from './competition';

export interface PlayerDoc {
  tokenHash: string;
  nickname: string;
  nicknameSet: boolean; // false = still the generated name
  attempts: number;
  round: { id: string; startedAt: number } | null;
  lastRoundAt: number;
  bestAbsDiff: number | null;
  bestDiff: number | null;
  bestAt: number | null;
  won: boolean;
  wonAttempts: number | null;
  wonAt: number | null;
  wonMs: number | null;
  claimed: boolean;
  claimedAt: number | null;
  photoUrl: string | null;
  phone: string | null;
  verified: boolean;
  otpHash: string | null;
  otpExpiresAt: number | null;
  otpAttempts: number;
  otpLastSentAt: number | null;
  hidden: boolean;
  suspicious: number; // results rejected by the timing check
  winRank?: number;
  nearRank?: number;
  createdAt: number;
  updatedAt: number;
}

export class TenBoolError extends Error {
  constructor(public code: string, public status = 400) {
    super(code);
  }
}

const playersCol = (codeId: string) => getAdminDb().collection('codes').doc(codeId).collection('tenboolPlayers');

export const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');
export const newSecret = () => crypto.randomBytes(16).toString('hex');

export function isValidPlayerId(id: unknown): id is string {
  return typeof id === 'string' && /^[a-f0-9]{32}$/.test(id);
}

function tokenMatches(doc: PlayerDoc, token: unknown) {
  if (typeof token !== 'string' || token.length !== 32) return false;
  const a = Buffer.from(doc.tokenHash, 'hex');
  const b = Buffer.from(hashToken(token), 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Rank fields as a Firestore patch (FieldValue.delete() takes a player off a list)
function rankPatch(p: Pick<PlayerDoc, 'won' | 'claimed' | 'hidden' | 'wonAttempts' | 'wonAt' | 'bestAbsDiff' | 'bestAt'>) {
  const r = rankFields(p);
  return {
    winRank: r.winRank ?? FieldValue.delete(),
    nearRank: r.nearRank ?? FieldValue.delete(),
  };
}

// Loads a player and proves the caller owns it
export async function getAuthedPlayer(codeId: string, playerId: unknown, token: unknown) {
  if (!isValidPlayerId(playerId)) throw new TenBoolError('NO_PLAYER', 401);
  const ref = playersCol(codeId).doc(playerId);
  const snap = await ref.get();
  if (!snap.exists || !tokenMatches(snap.data() as PlayerDoc, token)) throw new TenBoolError('NO_PLAYER', 401);
  return { ref, player: snap.data() as PlayerDoc };
}

export function publicStatus(player: PlayerDoc) {
  return {
    attempts: player.attempts,
    nickname: player.nickname,
    nicknameSet: player.nicknameSet,
    won: player.won,
    wonAttempts: player.wonAttempts,
    claimed: player.claimed,
    verified: player.verified,
    hidden: player.hidden,
    hasPhoto: !!player.photoUrl,
    bestDiff: player.bestDiff,
  };
}

// A new round: counts the attempt the moment it starts, so walking away from a bad round still costs it.
// No identity yet = first round on this phone -> the player is created here (never on a mere page view).
export async function startRound(codeId: string, playerId: unknown, token: unknown) {
  const now = Date.now();
  const roundId = newSecret().slice(0, 16);

  if (playerId == null) {
    const id = newSecret();
    const secret = newSecret();
    const doc: PlayerDoc = {
      tokenHash: hashToken(secret),
      nickname: randomNickname(),
      nicknameSet: false,
      attempts: 1,
      round: { id: roundId, startedAt: now },
      lastRoundAt: now,
      bestAbsDiff: null,
      bestDiff: null,
      bestAt: null,
      won: false,
      wonAttempts: null,
      wonAt: null,
      wonMs: null,
      claimed: false,
      claimedAt: null,
      photoUrl: null,
      phone: null,
      verified: false,
      otpHash: null,
      otpExpiresAt: null,
      otpAttempts: 0,
      otpLastSentAt: null,
      hidden: false,
      suspicious: 0,
      createdAt: now,
      updatedAt: now,
    };
    await playersCol(codeId).doc(id).set(doc);
    return { playerId: id, token: secret, roundId, attempt: 1, nickname: doc.nickname };
  }

  if (!isValidPlayerId(playerId)) throw new TenBoolError('NO_PLAYER', 401);
  const ref = playersCol(codeId).doc(playerId);
  return getAdminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new TenBoolError('NO_PLAYER', 401);
    const p = snap.data() as PlayerDoc;
    if (!tokenMatches(p, token)) throw new TenBoolError('NO_PLAYER', 401);
    // After the hit the board entry is fixed; extra rounds are just for fun and stay on the phone
    if (p.won) return { won: true as const, attempt: p.attempts };
    if (now - (p.lastRoundAt || 0) < MIN_ROUND_GAP_MS) throw new TenBoolError('TOO_FAST', 429);
    const attempt = (p.attempts || 0) + 1;
    tx.update(ref, { attempts: attempt, round: { id: roundId, startedAt: now }, lastRoundAt: now, updatedAt: now });
    return { roundId, attempt };
  });
}

export interface RoundResult {
  verdict: TimingVerdict;
  diff: number | null;
  won: boolean;
  justWon: boolean;
  attempts: number;
  near: boolean; // this player is on the closest list now
  improved: boolean; // this stop is the player's new best
}

export async function finishRound(codeId: string, playerId: unknown, token: unknown, roundId: unknown, ms: unknown): Promise<RoundResult> {
  if (!isValidPlayerId(playerId)) throw new TenBoolError('NO_PLAYER', 401);
  const ref = playersCol(codeId).doc(playerId);
  return getAdminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new TenBoolError('NO_PLAYER', 401);
    const p = snap.data() as PlayerDoc;
    if (!tokenMatches(p, token)) throw new TenBoolError('NO_PLAYER', 401);
    // One result per round: a replayed or out-of-date round id is refused
    if (!p.round || typeof roundId !== 'string' || p.round.id !== roundId) throw new TenBoolError('NO_ROUND', 409);

    const now = Date.now();
    const verdict = judgeTiming(ms, now - p.round.startedAt);
    const patch: Record<string, unknown> = { round: null, updatedAt: now };
    let diff: number | null = null;
    let justWon = false;
    let improved = false;
    const next = { ...p };

    if (verdict === 'ok') {
      diff = diffFromTarget(ms as number);
      const abs = Math.abs(diff);
      if (diff === 0 && !p.won) {
        justWon = true;
        Object.assign(next, { won: true, wonAttempts: p.attempts, wonAt: now, wonMs: ms as number });
        Object.assign(patch, { won: true, wonAttempts: p.attempts, wonAt: now, wonMs: ms });
      }
      if (p.bestAbsDiff == null || abs < p.bestAbsDiff) {
        improved = true;
        Object.assign(next, { bestAbsDiff: abs, bestDiff: diff, bestAt: now });
        Object.assign(patch, { bestAbsDiff: abs, bestDiff: diff, bestAt: now });
      }
    } else {
      patch.suspicious = (p.suspicious || 0) + 1;
    }

    const ranks = rankFields(next);
    Object.assign(patch, rankPatch(next));
    tx.update(ref, patch);
    return { verdict, diff, won: next.won, justWon, attempts: p.attempts, near: ranks.nearRank != null, improved };
  });
}

export async function setNickname(ref: FirebaseFirestore.DocumentReference, nickname: string) {
  await ref.update({ nickname, nicknameSet: true, updatedAt: Date.now() });
}

// The end of the win flow: name (+ optional photo) -> onto the winners list
export async function claimWin(
  ref: FirebaseFirestore.DocumentReference,
  player: PlayerDoc,
  fields: { nickname: string; photoUrl: string | null }
) {
  const now = Date.now();
  const next = { ...player, claimed: true, claimedAt: player.claimedAt ?? now, nickname: fields.nickname, photoUrl: fields.photoUrl ?? player.photoUrl };
  await ref.update({
    claimed: true,
    claimedAt: next.claimedAt,
    nickname: fields.nickname,
    nicknameSet: true,
    photoUrl: next.photoUrl,
    updatedAt: now,
    ...rankPatch(next),
  });
  return next;
}

// One spot on the board per phone number (prizes): has another player already claimed with it?
export async function phoneAlreadyOnBoard(codeId: string, phone: string, exceptPlayerId: string) {
  const snap = await playersCol(codeId).where('phone', '==', phone).limit(10).get();
  return snap.docs.some((d) => d.id !== exceptPlayerId && (d.data() as PlayerDoc).won && (d.data() as PlayerDoc).claimed);
}

export async function saveOtp(ref: FirebaseFirestore.DocumentReference, phone: string, otpHash: string, expiresAt: number) {
  const now = Date.now();
  await ref.update({ phone, otpHash, otpExpiresAt: expiresAt, otpAttempts: 0, otpLastSentAt: now, updatedAt: now });
}

export async function markPhoneVerified(ref: FirebaseFirestore.DocumentReference) {
  await ref.update({ verified: true, otpHash: null, otpExpiresAt: null, updatedAt: Date.now() });
}

export async function bumpOtpAttempts(ref: FirebaseFirestore.DocumentReference, attempts: number) {
  await ref.update({ otpAttempts: attempts, updatedAt: Date.now() });
}

// ---------- big screen ----------

export interface BoardWinner {
  id: string;
  name: string;
  photoUrl: string | null;
  attempts: number;
  wonAt: number;
}
export interface BoardNear {
  id: string;
  name: string;
  diff: number;
}

export async function loadBoard(codeId: string, boardSize: number, withNear: boolean) {
  const col = playersCol(codeId);
  const [winners, near] = await Promise.all([
    col.orderBy('winRank').limit(boardSize).get(),
    withNear ? col.orderBy('nearRank').limit(NEAR_LIST_SIZE).get() : Promise.resolve(null),
  ]);
  return {
    winners: winners.docs.map((d): BoardWinner => {
      const p = d.data() as PlayerDoc;
      return { id: d.id, name: p.nickname, photoUrl: p.photoUrl, attempts: p.wonAttempts ?? p.attempts, wonAt: p.wonAt ?? 0 };
    }),
    near: (near?.docs ?? []).map((d): BoardNear => {
      const p = d.data() as PlayerDoc;
      return { id: d.id, name: p.nickname, diff: p.bestDiff ?? 0 };
    }),
  };
}

// Players + total attempts, for the line under the scan code. Aggregation reads are cheap
// (one read per 1,000 entries); the route caches them for a few seconds on top.
export async function loadStats(codeId: string) {
  const snap = await playersCol(codeId)
    .aggregate({ players: AggregateField.count(), attempts: AggregateField.sum('attempts') })
    .get();
  const d = snap.data();
  return { players: d.players ?? 0, attempts: d.attempts ?? 0 };
}

// Your place on the winners list (1-based), or null when you're not on it
export async function winnerPlace(codeId: string, rank: number) {
  const snap = await playersCol(codeId).where('winRank', '<', rank).count().get();
  return snap.data().count + 1;
}

// ---------- owner ----------

export async function listPlayers(codeId: string) {
  const snap = await playersCol(codeId).get();
  return snap.docs.map((d) => {
    const p = d.data() as PlayerDoc;
    return {
      id: d.id,
      nickname: p.nickname,
      attempts: p.attempts,
      won: p.won,
      wonAttempts: p.wonAttempts,
      wonAt: p.wonAt,
      claimed: p.claimed,
      photoUrl: p.photoUrl,
      phone: p.phone,
      verified: p.verified,
      hidden: p.hidden,
      bestDiff: p.bestDiff,
      suspicious: p.suspicious || 0,
      onBoard: p.winRank != null,
      createdAt: p.createdAt,
    };
  });
}

export async function setHidden(codeId: string, playerId: string, hidden: boolean) {
  const ref = playersCol(codeId).doc(playerId);
  await getAdminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new TenBoolError('NO_PLAYER', 404);
    const p = { ...(snap.data() as PlayerDoc), hidden };
    tx.update(ref, { hidden, updatedAt: Date.now(), ...rankPatch(p) });
  });
}

// Removes the photo from the big screen but keeps the player on the list
export async function clearPhoto(codeId: string, playerId: string) {
  const ref = playersCol(codeId).doc(playerId);
  const snap = await ref.get();
  if (!snap.exists) throw new TenBoolError('NO_PLAYER', 404);
  const url = (snap.data() as PlayerDoc).photoUrl;
  await ref.update({ photoUrl: null, updatedAt: Date.now() });
  return url;
}

// Wipes the whole game (new round of the event). Returns the photo URLs so the caller can delete them.
export async function deleteAllPlayers(codeId: string) {
  const snap = await playersCol(codeId).get();
  const photos = snap.docs.map((d) => (d.data() as PlayerDoc).photoUrl).filter((u): u is string => !!u);
  const db = getAdminDb();
  for (let i = 0; i < snap.docs.length; i += 450) {
    const batch = db.batch();
    snap.docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  return { deleted: snap.docs.length, photos };
}
