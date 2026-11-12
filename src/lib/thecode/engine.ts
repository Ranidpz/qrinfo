/**
 * הקוד (The Code) — the game engine. Pure, deterministic, client + server safe.
 *
 * Every function takes state in and returns NEW state out; inputs are never mutated.
 * Randomness is injected (`ctx.rng`) — the server passes a crypto-backed rng, tests
 * pass a seeded one (`createSeededRng`). No Node APIs, no Firebase, no clock reads:
 * the caller passes `now` (ms since epoch).
 *
 * Spec: docs/THE_CODE_PLAN.md §3–5. Contract: src/types/thecode.ts.
 *
 * Shape of a turn (what the API route does in ONE transaction on the player doc):
 *   const { player: next, outcome } = scanGnome(player, gnomeId, ctx);   // or answerRiddle / requestHint / ...
 *   save(next); return outcome;
 * Each action runs `repairRun` first, so a gnome/riddle disabled mid-run never
 * blocks a family.
 */

import type {
  TheCodeAnswerOutcome,
  TheCodeConfig,
  TheCodeGnome,
  TheCodeIssue,
  TheCodePhrase,
  TheCodePlayer,
  TheCodeRiddle,
  TheCodeRules,
  TheCodeRun,
  TheCodeScanOutcome,
  TheCodeSlot,
  TheCodeSpot,
} from '@/types/thecode';
import {
  invalidPhraseChars,
  isAmbiguousLetter,
  letterOfAnswer,
  matchLetter,
  normalizeLetter,
  phraseLetters,
  soundAlikes,
} from './letters';

// =================================================================
// Rules + constants
// =================================================================

export const DEFAULT_THECODE_RULES: TheCodeRules = {
  pointsPerLetter: 10,
  suitcaseBonus: 50,
  hotStreakAt: 3,
  hotMultiplier: 2,
  hintCost: 5,
  freeWrongScans: 1,
  wrongScanPenalty: 5,
  freeWrongAnswers: 2,
  wrongAnswerPenalty: 3,
  answerCooldownSeconds: 10,
  arrangeHelpCost: 10,
};

/** A phrase needs at least this many letters to be a suitcase. */
export const MIN_PHRASE_LETTERS = 2;
/** Warn the operator when a new family can open fewer fresh suitcases than this. */
export const FEW_FRESH_SUITCASES = 2;
/** Venue time zone used for `activeHours` unless the caller passes another. */
export const DEFAULT_THECODE_TIME_ZONE = 'Asia/Jerusalem';

/** Merge operator rules over the defaults; junk / negative values fall back. */
export function resolveRules(rules?: Partial<TheCodeRules> | null): TheCodeRules {
  const out: TheCodeRules = { ...DEFAULT_THECODE_RULES };
  if (!rules) return out;
  for (const key of Object.keys(out) as (keyof TheCodeRules)[]) {
    const v = rules[key];
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[key] = v;
  }
  return out;
}

// =================================================================
// Context + randomness
// =================================================================

export interface TheCodeContext {
  config: TheCodeConfig;
  riddles: TheCodeRiddle[];
  /** ms since epoch, supplied by the caller (server clock). */
  now: number;
  /** Uniform [0, 1). Never Math.random inside the engine. */
  rng: () => number;
  /** IANA zone for `activeHours`; defaults to Asia/Jerusalem. */
  timeZone?: string;
}

/** Small deterministic PRNG (mulberry32) for tests, demos and validation. */
export function createSeededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// =================================================================
// Lookups
// =================================================================

interface Index {
  gnomes: Map<string, TheCodeGnome>;
  spots: Map<string, TheCodeSpot>;
  riddles: Map<string, TheCodeRiddle>;
  riddlesByGnome: Map<string, TheCodeRiddle[]>;
}

function buildIndex(config: TheCodeConfig, riddles: TheCodeRiddle[]): Index {
  const gnomes = new Map((config.gnomes || []).map((g) => [g.id, g] as const));
  const spots = new Map((config.spots || []).map((s) => [s.id, s] as const));
  const riddleMap = new Map<string, TheCodeRiddle>();
  const riddlesByGnome = new Map<string, TheCodeRiddle[]>();
  for (const r of riddles || []) {
    riddleMap.set(r.id, r);
    const list = riddlesByGnome.get(r.gnomeId) || [];
    list.push(r);
    riddlesByGnome.set(r.gnomeId, list);
  }
  return { gnomes, spots, riddles: riddleMap, riddlesByGnome };
}

/**
 * The collector letter a riddle yields. The answer word is the truth (the stored
 * `letter` is derived from it); the stored field is a fallback for an empty word.
 */
export function riddleLetter(riddle: TheCodeRiddle): string {
  return letterOfAnswer(riddle.answerWord || '') || normalizeLetter(riddle.letter || '');
}

function isRiddleUsable(r: TheCodeRiddle | undefined): r is TheCodeRiddle {
  return !!r && r.status === 'published' && riddleLetter(r) !== '';
}

function isGnomeUsable(idx: Index, gnomeId: string): boolean {
  const g = idx.gnomes.get(gnomeId);
  if (!g || !g.isActive) return false;
  const spot = idx.spots.get(g.spotId);
  return !!spot && spot.isActive;
}

function spotOf(idx: Index, gnomeId: string): string | undefined {
  return idx.gnomes.get(gnomeId)?.spotId;
}

/** A source = a usable gnome + one of its usable riddles for a letter. */
function sourcesFor(idx: Index, letter: string, solved: Set<string>): Map<string, TheCodeRiddle[]> {
  const out = new Map<string, TheCodeRiddle[]>();
  for (const [gnomeId, list] of idx.riddlesByGnome) {
    if (!isGnomeUsable(idx, gnomeId)) continue;
    const ok = list.filter((r) => isRiddleUsable(r) && !solved.has(r.id) && riddleLetter(r) === letter);
    if (ok.length) out.set(gnomeId, ok);
  }
  return out;
}

// =================================================================
// Open / paused
// =================================================================

function parseHm(s: string | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((s || '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59) return null;
  return h * 60 + min;
}

/** Minutes since local midnight in `timeZone`. */
function minutesOfDay(now: number, timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(now));
    const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
    const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
    return (h % 24) * 60 + m;
  } catch {
    const d = new Date(now);
    return d.getUTCHours() * 60 + d.getUTCMinutes();
  }
}

/**
 * Within `activeHours` (venue local time)? Absent / malformed / from === to = always.
 * Overnight windows ("20:00"–"02:00") wrap past midnight. `to` is exclusive.
 */
export function isWithinActiveHours(
  activeHours: TheCodeConfig['activeHours'],
  now: number,
  timeZone: string = DEFAULT_THECODE_TIME_ZONE
): boolean {
  if (!activeHours) return true;
  const from = parseHm(activeHours.from);
  const to = parseHm(activeHours.to);
  if (from === null || to === null || from === to) return true;
  const m = minutesOfDay(now, timeZone);
  return from < to ? m >= from && m < to : m >= from || m < to;
}

/** The adventure accepts actions right now (published + inside active hours). */
export function isAdventureOpen(config: TheCodeConfig, now: number, timeZone?: string): boolean {
  return config.status === 'published' && isWithinActiveHours(config.activeHours, now, timeZone);
}

// =================================================================
// Bipartite matching (slot → distinct gnome)
// =================================================================

/**
 * Kuhn's augmenting-path matching. `cands[i]` = gnome ids slot i may take, in
 * preference order; `order` = slot processing order. Returns gnome per slot or null.
 */
function maxMatching(cands: string[][], blocked: Set<string>, order?: number[]): (string | null)[] {
  const owner = new Map<string, number>();
  const tryAssign = (s: number, seen: Set<string>): boolean => {
    for (const g of cands[s]) {
      if (blocked.has(g) || seen.has(g)) continue;
      seen.add(g);
      const o = owner.get(g);
      if (o === undefined || tryAssign(o, seen)) {
        owner.set(g, s);
        return true;
      }
    }
    return false;
  };
  for (const s of order || cands.map((_, i) => i)) tryAssign(s, new Set());
  const out: (string | null)[] = cands.map(() => null);
  for (const [g, s] of owner) out[s] = g;
  return out;
}

function isFeasible(cands: string[][], blocked: Set<string>): boolean {
  return maxMatching(cands, blocked).every((g) => g !== null);
}

interface Allocation {
  gnomeIds: string[];
  riddleIds: string[];
  /** Slot bound to the forced (first scanned) gnome, or -1. */
  forcedSlot: number;
}

/**
 * Allocate a distinct gnome + unsolved riddle to every letter, or null when the
 * phrase cannot be completed. Greedy by preference (never-found gnome → spot not
 * used yet → random), each step checked with a full matching so the greedy choice
 * can never paint the run into a corner.
 */
function allocate(
  letters: string[],
  idx: Index,
  player: Pick<TheCodePlayer, 'solvedRiddleIds' | 'foundGnomeIds'>,
  rng: () => number,
  forcedGnomeId?: string
): Allocation | null {
  if (!letters.length) return null;
  const solved = new Set(player.solvedRiddleIds || []);
  const found = new Set(player.foundGnomeIds || []);

  const sourceByLetter = new Map<string, Map<string, TheCodeRiddle[]>>();
  for (const l of letters) if (!sourceByLetter.has(l)) sourceByLetter.set(l, sourcesFor(idx, l, solved));

  // Random tie-break keys, drawn in a stable order for determinism.
  const gnomeKey = new Map<string, number>();
  for (const g of idx.gnomes.keys()) gnomeKey.set(g, rng());
  const riddleKey = new Map<string, number>();
  for (const r of idx.riddles.keys()) riddleKey.set(r, rng());

  const cands = letters.map((l) => [...sourceByLetter.get(l)!.keys()]);
  if (!isFeasible(cands, new Set())) return null;

  let forcedSlot = -1;
  if (forcedGnomeId) {
    for (let i = 0; i < letters.length; i++) {
      if (!cands[i].includes(forcedGnomeId)) continue;
      const rest = cands.filter((_, j) => j !== i);
      if (isFeasible(rest, new Set([forcedGnomeId]))) {
        forcedSlot = i;
        break;
      }
    }
  }

  const others = shuffle(letters.map((_, i) => i).filter((i) => i !== forcedSlot), rng);
  const order = forcedSlot >= 0 ? [forcedSlot, ...others] : others;
  const gnomeIds: string[] = letters.map(() => '');
  const used = new Set<string>();
  const spotCount = new Map<string, number>();

  for (let k = 0; k < order.length; k++) {
    const s = order[k];
    const remaining = order.slice(k + 1).map((i) => cands[i]);
    let chosen: string | null = null;
    if (s === forcedSlot && forcedGnomeId) {
      chosen = forcedGnomeId;
    } else {
      const ranked = cands[s]
        .filter((g) => !used.has(g))
        .sort((a, b) => {
          const fa = found.has(a) ? 1 : 0;
          const fb = found.has(b) ? 1 : 0;
          if (fa !== fb) return fa - fb;
          const sa = spotCount.get(spotOf(idx, a) || '') || 0;
          const sb = spotCount.get(spotOf(idx, b) || '') || 0;
          if (sa !== sb) return sa - sb;
          return (gnomeKey.get(a) || 0) - (gnomeKey.get(b) || 0);
        });
      for (const g of ranked) {
        used.add(g);
        if (isFeasible(remaining, used)) {
          chosen = g;
          break;
        }
        used.delete(g);
      }
    }
    if (!chosen) return null; // unreachable: feasibility was proven above
    used.add(chosen);
    gnomeIds[s] = chosen;
    const sp = spotOf(idx, chosen) || '';
    spotCount.set(sp, (spotCount.get(sp) || 0) + 1);
  }

  const riddleIds = letters.map((l, i) => {
    const list = sourceByLetter.get(l)!.get(gnomeIds[i])!;
    return list.slice().sort((a, b) => (riddleKey.get(a.id) || 0) - (riddleKey.get(b.id) || 0))[0].id;
  });
  return { gnomeIds, riddleIds, forcedSlot };
}

// =================================================================
// Phrases
// =================================================================

export function isPhraseValid(phrase: TheCodePhrase, language: TheCodeConfig['language']): boolean {
  return invalidPhraseChars(phrase.text, language).length === 0 &&
    phraseLetters(phrase.text).length >= MIN_PHRASE_LETTERS;
}

/** Phrases a player could still be given (active, valid, not opened by them). */
function candidatePhrases(config: TheCodeConfig, player: Pick<TheCodePlayer, 'openedPhraseIds'>): TheCodePhrase[] {
  const opened = new Set(player.openedPhraseIds || []);
  return (config.phrases || []).filter(
    (p) => p.isActive && !opened.has(p.id) && isPhraseValid(p, config.language)
  );
}

// =================================================================
// Player helpers
// =================================================================

function cloneRun(run: TheCodeRun): TheCodeRun {
  return {
    ...run,
    slots: run.slots.map((s) => ({ ...s })),
    wrongGnomeIdsOnTarget: [...(run.wrongGnomeIdsOnTarget || [])],
  };
}

function clonePlayer(p: TheCodePlayer): TheCodePlayer {
  return {
    ...p,
    openedPhraseIds: [...(p.openedPhraseIds || [])],
    solvedRiddleIds: [...(p.solvedRiddleIds || [])],
    foundGnomeIds: [...(p.foundGnomeIds || [])],
    run: p.run ? cloneRun(p.run) : null,
  };
}

function addUnique(list: string[], id: string): void {
  if (id && !list.includes(id)) list.push(id);
}

/** A fresh player document. Ids/codes are generated by the caller (crypto). */
export function createPlayer(input: {
  id: string; familyName: string; emoji: string; recoveryCode: string; now: number; phone?: string;
}): TheCodePlayer {
  const p: TheCodePlayer = {
    id: input.id,
    familyName: input.familyName,
    emoji: input.emoji,
    recoveryCode: input.recoveryCode,
    points: 0,
    streak: 0,
    suitcasesOpened: 0,
    openedPhraseIds: [],
    solvedRiddleIds: [],
    foundGnomeIds: [],
    run: null,
    createdAt: input.now,
    lastSeenAt: input.now,
  };
  if (input.phone) p.phone = input.phone;
  return p;
}

/** Letters the family holds right now (solved + gifted), by phrase position. */
export function collectedLetters(run: TheCodeRun | null): { index: number; letter: string; gifted: boolean }[] {
  if (!run) return [];
  return run.slots
    .filter((s) => s.status === 'solved' || s.status === 'gifted')
    .map((s) => ({ index: s.index, letter: s.letter, gifted: s.status === 'gifted' }));
}

// =================================================================
// Targeting
// =================================================================

function setTarget(run: TheCodeRun, slotIndex: number | null): void {
  run.targetSlotIndex = slotIndex;
  run.wrongGnomeIdsOnTarget = [];
  if (slotIndex === null) return;
  const slot = run.slots[slotIndex];
  slot.status = 'active';
  // The zone hint (hints[0]) comes free with every target — "1 = the free zone hint".
  slot.locationHintsUsed = Math.max(1, slot.locationHintsUsed || 0);
}

/**
 * Choose the next target among pending slots, preferring a spot other than
 * `prevSpotId`, random among equals. Moves the run to `arranging` when nothing
 * is left. Mutates the (already cloned) run.
 */
function retarget(run: TheCodeRun, idx: Index, rng: () => number, prevSpotId?: string): void {
  const pending = run.slots.filter((s) => s.status === 'pending' || s.status === 'active');
  // Any stale 'active' (an old target) goes back to pending before choosing.
  for (const s of pending) s.status = 'pending';
  if (!pending.length) {
    run.targetSlotIndex = null;
    run.wrongGnomeIdsOnTarget = [];
    if (run.state === 'collecting') run.state = 'arranging';
    return;
  }
  const away = pending.filter((s) => spotOf(idx, s.gnomeId) !== prevSpotId);
  const pool = away.length ? away : pending;
  const pick = pool[Math.floor(rng() * pool.length)] || pool[0];
  setTarget(run, pick.index);
}

/**
 * Public: give the run a target if it has none (e.g. after a manual edit) or move
 * to a new one. Prefers a different spot than the current/previous target.
 */
export function pickNextTarget(player: TheCodePlayer, ctx: TheCodeContext): TheCodePlayer {
  if (!player.run || player.run.state !== 'collecting') return player;
  const next = clonePlayer(player);
  const run = next.run!;
  const idx = buildIndex(ctx.config, ctx.riddles);
  const prev = run.targetSlotIndex !== null ? spotOf(idx, run.slots[run.targetSlotIndex].gnomeId) : undefined;
  retarget(run, idx, ctx.rng, prev);
  return next;
}

// =================================================================
// Build a run
// =================================================================

export type TheCodeBuildResult =
  | { kind: 'run'; run: TheCodeRun; /** The first scanned gnome is slot one (already active). */ startsAtScannedGnome: boolean }
  | { kind: 'allDone' };

/**
 * Plan a new suitcase for a player. Never returns a run that cannot be finished:
 * when no phrase is playable with fresh (unsolved) riddles the answer is `allDone`.
 */
export function buildRun(
  player: Pick<TheCodePlayer, 'openedPhraseIds' | 'solvedRiddleIds' | 'foundGnomeIds'>,
  ctx: TheCodeContext,
  opts: { firstGnomeId?: string; runId?: string } = {}
): TheCodeBuildResult {
  const idx = buildIndex(ctx.config, ctx.riddles);
  const phrases = shuffle(candidatePhrases(ctx.config, player), ctx.rng);
  const forced = opts.firstGnomeId && isGnomeUsable(idx, opts.firstGnomeId) ? opts.firstGnomeId : undefined;

  type Choice = { phrase: TheCodePhrase; letters: string[]; alloc: Allocation };
  let chosen: Choice | null = null;
  let fallback: Choice | null = null;
  for (const phrase of phrases) {
    const letters = phraseLetters(phrase.text);
    const alloc = allocate(letters, idx, player, ctx.rng, forced);
    if (!alloc) continue;
    if (!forced || alloc.forcedSlot >= 0) {
      chosen = { phrase, letters, alloc };
      break;
    }
    if (!fallback) fallback = { phrase, letters, alloc };
  }
  chosen = chosen || fallback;
  if (!chosen) return { kind: 'allDone' };

  const { phrase, letters, alloc } = chosen;
  const slots: TheCodeSlot[] = letters.map((letter, i) => ({
    index: i,
    letter,
    gnomeId: alloc.gnomeIds[i],
    riddleId: alloc.riddleIds[i],
    status: 'pending',
    riddleHintsUsed: 0,
    locationHintsUsed: 0,
    wrongAnswers: 0,
    pointsEarned: 0,
  }));
  const run: TheCodeRun = {
    id: opts.runId || `run_${ctx.now.toString(36)}_${Math.floor(ctx.rng() * 1e9).toString(36)}`,
    phraseId: phrase.id,
    slots,
    targetSlotIndex: null,
    wrongGnomeIdsOnTarget: [],
    state: 'collecting',
    startedAt: ctx.now,
  };
  if (alloc.forcedSlot >= 0) setTarget(run, alloc.forcedSlot);
  else retarget(run, idx, ctx.rng);
  return { kind: 'run', run, startsAtScannedGnome: alloc.forcedSlot >= 0 };
}

// =================================================================
// Repair
// =================================================================

export interface TheCodeRepair {
  slotIndex: number;
  action: 'swapped' | 'gifted';
  fromGnomeId: string;
  toGnomeId?: string;
  fromRiddleId: string;
  toRiddleId?: string;
}

export interface TheCodeRepairResult {
  player: TheCodePlayer;
  repairs: TheCodeRepair[];
  /** The current target changed (swapped source, gifted, or newly chosen). */
  retargeted: boolean;
}

function slotIsHealthy(slot: TheCodeSlot, idx: Index): boolean {
  if (!isGnomeUsable(idx, slot.gnomeId)) return false;
  const r = idx.riddles.get(slot.riddleId);
  return isRiddleUsable(r) && r.gnomeId === slot.gnomeId && riddleLetter(r) === slot.letter;
}

/**
 * Fix a run whose gnome / spot / riddle became unusable, or whose riddle letter
 * changed. Broken slots get another unused source of the SAME letter (same gnome
 * first, then never-found gnomes); hidden pending slots may be re-shuffled to free
 * a gnome. A slot with no possible source is GIFTED (letter given, no points).
 * Solved/gifted slots are never touched. Returns the same player object when
 * nothing needed fixing.
 */
export function repairRun(player: TheCodePlayer, ctx: TheCodeContext): TheCodeRepairResult {
  const run0 = player.run;
  if (!run0 || run0.state !== 'collecting') return { player, repairs: [], retargeted: false };
  const idx = buildIndex(ctx.config, ctx.riddles);

  const open = run0.slots.filter((s) => s.status === 'pending' || s.status === 'active');
  const broken = open.filter((s) => !slotIsHealthy(s, idx));
  const targetOk = open.length > 0 && run0.targetSlotIndex !== null &&
    run0.slots[run0.targetSlotIndex]?.status === 'active';
  // Healthy run with a live target → untouched (same object back).
  if (!broken.length && targetOk) return { player, repairs: [], retargeted: false };

  const next = clonePlayer(player);
  const run = next.run!;
  const repairs: TheCodeRepair[] = [];
  const solved = new Set(next.solvedRiddleIds);
  const found = new Set(next.foundGnomeIds);
  const oldTarget = run.targetSlotIndex;
  const oldTargetGnome = oldTarget !== null ? run.slots[oldTarget].gnomeId : undefined;

  if (broken.length) {
    // Gnomes held by finished slots stay taken (a family must never be sent back).
    const blocked = new Set(
      run.slots.filter((s) => s.status === 'solved' || s.status === 'gifted').map((s) => s.gnomeId)
    );
    const brokenIdx = new Set(broken.map((s) => s.index));
    const healthy = run.slots.filter(
      (s) => (s.status === 'pending' || s.status === 'active') && !brokenIdx.has(s.index)
    );
    // The current target (if healthy) keeps its gnome — the family may be standing there.
    const keepTarget = oldTarget !== null && !brokenIdx.has(oldTarget) && run.slots[oldTarget].status === 'active';
    if (keepTarget) blocked.add(run.slots[oldTarget!].gnomeId);
    const flex = healthy.filter((s) => !(keepTarget && s.index === oldTarget)).concat(
      broken.slice().sort((a, b) => a.index - b.index)
    );

    const key = new Map<string, number>();
    for (const g of idx.gnomes.keys()) key.set(g, ctx.rng());
    const sources = new Map<string, Map<string, TheCodeRiddle[]>>();
    const srcFor = (l: string) => {
      if (!sources.has(l)) sources.set(l, sourcesFor(idx, l, solved));
      return sources.get(l)!;
    };
    const cands = flex.map((s) => {
      const src = srcFor(s.letter);
      const usableNow = slotIsHealthy(s, idx);
      return [...src.keys()].sort((a, b) => {
        // Healthy slots prefer their current gnome; broken ones the same gnome
        // (another riddle on it), then never-found, then random.
        const ca = a === s.gnomeId ? 0 : 1;
        const cb = b === s.gnomeId ? 0 : 1;
        if (ca !== cb) return ca - cb;
        if (!usableNow) {
          const fa = found.has(a) ? 1 : 0;
          const fb = found.has(b) ? 1 : 0;
          if (fa !== fb) return fa - fb;
        }
        return (key.get(a) || 0) - (key.get(b) || 0);
      });
    });
    // Healthy slots first: Kuhn never un-matches a matched slot, so they all keep a source.
    const match = maxMatching(cands, blocked);

    flex.forEach((s, i) => {
      const slot = run.slots[s.index];
      const g = match[i];
      const wasHealthy = slotIsHealthy(s, idx);
      if (g === null) {
        repairs.push({ slotIndex: slot.index, action: 'gifted', fromGnomeId: slot.gnomeId, fromRiddleId: slot.riddleId });
        slot.status = 'gifted';
        slot.pointsEarned = 0;
        return;
      }
      if (wasHealthy && g === slot.gnomeId) return; // untouched
      const list = srcFor(slot.letter).get(g)!;
      const keepRiddle = list.find((r) => r.id === slot.riddleId);
      const riddle = keepRiddle || list[0];
      if (g === slot.gnomeId && riddle.id === slot.riddleId) return;
      repairs.push({
        slotIndex: slot.index, action: 'swapped',
        fromGnomeId: slot.gnomeId, toGnomeId: g, fromRiddleId: slot.riddleId, toRiddleId: riddle.id,
      });
      slot.gnomeId = g;
      slot.riddleId = riddle.id;
      slot.riddleHintsUsed = 0;
      slot.wrongAnswers = 0;
      delete slot.lastWrongAnswerAt;
    });
  }

  // Re-target when the target was gifted, moved, or missing.
  let retargeted = false;
  const t = run.targetSlotIndex;
  const tSlot = t !== null ? run.slots[t] : undefined;
  if (!tSlot || tSlot.status !== 'active') {
    retarget(run, idx, ctx.rng, oldTargetGnome ? spotOf(idx, oldTargetGnome) : undefined);
    retargeted = true;
  } else if (tSlot.gnomeId !== oldTargetGnome) {
    setTarget(run, tSlot.index); // same letter, new gnome: fresh hunt
    tSlot.locationHintsUsed = 1;
    retargeted = true;
  }
  return { player: next, repairs, retargeted };
}

// =================================================================
// Scan
// =================================================================

/** Engine scan outcomes: the contract's kinds + two the contract lacks (see report). */
export type TheCodeEngineScanOutcome =
  | TheCodeScanOutcome
  /** A new run started at a gnome that has nothing for it — show the first target. */
  | { kind: 'runStarted'; targetSlotIndex: number }
  /** Every letter is collected — go arrange (scan of a gnome not in this run). */
  | { kind: 'arranging' };

export interface TheCodeScanResult {
  player: TheCodePlayer;
  outcome: TheCodeEngineScanOutcome;
  repairs: TheCodeRepair[];
}

function touch(p: TheCodePlayer, now: number): TheCodePlayer {
  return p.lastSeenAt === now ? p : { ...p, lastSeenAt: now };
}

/**
 * A family scanned a gnome. Order: paused → repair → asleep → (new run) → target /
 * already solved / wrong gnome. Re-scanning the target is idempotent.
 */
export function scanGnome(player: TheCodePlayer, gnomeId: string, ctx: TheCodeContext): TheCodeScanResult {
  if (!isAdventureOpen(ctx.config, ctx.now, ctx.timeZone)) {
    return { player, outcome: { kind: 'paused' }, repairs: [] };
  }
  const rules = resolveRules(ctx.config.rules);
  const idx = buildIndex(ctx.config, ctx.riddles);
  const repaired = repairRun(player, ctx);
  let p = touch(repaired.player, ctx.now);
  const repairs = repaired.repairs;

  // Unknown or inactive gnome / spot. (Unknown codes are normally caught by the route.)
  if (!isGnomeUsable(idx, gnomeId)) return { player: p, outcome: { kind: 'gnomeAsleep' }, repairs };

  let run = p.run;
  if (!run || run.state === 'opened') {
    const built = buildRun(p, ctx, { firstGnomeId: gnomeId });
    if (built.kind === 'allDone') return { player: p, outcome: { kind: 'allDone' }, repairs };
    p = { ...clonePlayer(p), run: built.run };
    const outcome: TheCodeEngineScanOutcome = built.startsAtScannedGnome
      ? { kind: 'riddle', slotIndex: built.run.targetSlotIndex! }
      : { kind: 'runStarted', targetSlotIndex: built.run.targetSlotIndex! };
    return { player: p, outcome, repairs };
  }

  // Solved earlier in THIS run → no penalty.
  if (run.slots.some((s) => s.status === 'solved' && s.gnomeId === gnomeId)) {
    return { player: p, outcome: { kind: 'alreadySolved' }, repairs };
  }
  if (run.state === 'arranging' || run.targetSlotIndex === null) {
    return { player: p, outcome: { kind: 'arranging' }, repairs };
  }

  const target = run.slots[run.targetSlotIndex];
  if (target.gnomeId === gnomeId) {
    return { player: p, outcome: { kind: 'riddle', slotIndex: target.index }, repairs };
  }

  // Wrong gnome. The same wrong gnome never counts twice for one target.
  const free = Math.max(0, Math.floor(rules.freeWrongScans));
  if (run.wrongGnomeIdsOnTarget.includes(gnomeId)) {
    const freeLeft = Math.max(0, free - run.wrongGnomeIdsOnTarget.length);
    return { player: p, outcome: { kind: 'wrongGnome', penalty: 0, freeLeft }, repairs };
  }
  p = clonePlayer(p);
  run = p.run!;
  run.wrongGnomeIdsOnTarget.push(gnomeId);
  const count = run.wrongGnomeIdsOnTarget.length;
  let penalty = 0;
  if (count > free) {
    penalty = Math.min(p.points, rules.wrongScanPenalty);
    p.points = p.points - penalty;
  }
  return { player: p, outcome: { kind: 'wrongGnome', penalty, freeLeft: Math.max(0, free - count) }, repairs };
}

// =================================================================
// Answer
// =================================================================

export type TheCodeEngineAnswerOutcome =
  | TheCodeAnswerOutcome
  | { kind: 'paused' }
  /** No riddle is open for this slot (no run, arranging, or not the target). */
  | { kind: 'noRiddle' };

export interface TheCodeAnswerResult {
  player: TheCodePlayer;
  outcome: TheCodeEngineAnswerOutcome;
  repairs: TheCodeRepair[];
  /** True when this was a repeat of an already-solved slot (double tap / retry): nothing awarded. */
  replayed: boolean;
}

function spellingTipFor(expected: string, language: TheCodeConfig['language']): string {
  return language === 'en'
    ? `Almost perfect! It is spelled with ${expected}.`
    : `כמעט מושלם! כותבים את זה עם ${expected}׳.`;
}

/**
 * The family tapped a letter for the current target's riddle. Pass `slotIndex`
 * (the slot the riddle was shown for) so a double tap / retried request after the
 * target moved on is recognised and never awarded twice.
 */
export function answerRiddle(
  player: TheCodePlayer,
  input: { letter: string; slotIndex?: number },
  ctx: TheCodeContext
): TheCodeAnswerResult {
  if (!isAdventureOpen(ctx.config, ctx.now, ctx.timeZone)) {
    return { player, outcome: { kind: 'paused' }, repairs: [], replayed: false };
  }
  const rules = resolveRules(ctx.config.rules);
  const idx = buildIndex(ctx.config, ctx.riddles);
  const repaired = repairRun(player, ctx);
  let p = touch(repaired.player, ctx.now);
  const repairs = repaired.repairs;
  const run0 = p.run;
  if (!run0 || run0.state === 'opened') return { player: p, outcome: { kind: 'noRiddle' }, repairs, replayed: false };

  const slotIndex = input.slotIndex ?? run0.targetSlotIndex;
  const slot0 = slotIndex !== null && slotIndex !== undefined ? run0.slots[slotIndex] : undefined;
  if (!slot0) return { player: p, outcome: { kind: 'noRiddle' }, repairs, replayed: false };

  if (slot0.status === 'solved') {
    // Double tap / retry → report the original award, change nothing.
    return {
      player: p,
      outcome: { kind: 'correct', letter: slot0.letter, points: slot0.pointsEarned, hot: false, becameHot: false, runState: run0.state },
      repairs,
      replayed: true,
    };
  }
  if (run0.state !== 'collecting' || slot0.index !== run0.targetSlotIndex || slot0.status !== 'active') {
    return { player: p, outcome: { kind: 'noRiddle' }, repairs, replayed: false };
  }

  const cooldownMs = rules.answerCooldownSeconds * 1000;
  if (slot0.wrongAnswers > rules.freeWrongAnswers && slot0.lastWrongAnswerAt !== undefined &&
      ctx.now < slot0.lastWrongAnswerAt + cooldownMs) {
    return { player: p, outcome: { kind: 'cooldown', cooldownUntil: slot0.lastWrongAnswerAt + cooldownMs }, repairs, replayed: false };
  }

  const riddle = idx.riddles.get(slot0.riddleId);
  const match = matchLetter(input.letter, slot0.letter, !!riddle?.acceptSoundAlike);
  p = clonePlayer(p);
  const run = p.run!;
  const slot = run.slots[slot0.index];

  if (match === 'wrong') {
    p.streak = 0;
    slot.wrongAnswers += 1;
    slot.lastWrongAnswerAt = ctx.now;
    let penalty = 0;
    let cooldownUntil: number | undefined;
    if (slot.wrongAnswers > rules.freeWrongAnswers) {
      penalty = Math.min(p.points, rules.wrongAnswerPenalty);
      p.points -= penalty;
      if (cooldownMs > 0) cooldownUntil = ctx.now + cooldownMs;
    }
    const hintAvailable = (riddle?.hints?.filter(Boolean).length || 0) > slot.riddleHintsUsed;
    const outcome: TheCodeAnswerOutcome = cooldownUntil !== undefined
      ? { kind: 'wrong', penalty, cooldownUntil, hintAvailable }
      : { kind: 'wrong', penalty, hintAvailable };
    return { player: p, outcome, repairs, replayed: false };
  }

  // Correct (exact or sound-alike). Hot = the streak BEFORE this answer reached hotStreakAt.
  const hot = p.streak >= rules.hotStreakAt;
  const points = Math.round(rules.pointsPerLetter * (hot ? rules.hotMultiplier : 1));
  p.streak += 1;
  p.points += points;
  slot.status = 'solved';
  slot.pointsEarned += points;
  addUnique(p.solvedRiddleIds, slot.riddleId);
  addUnique(p.foundGnomeIds, slot.gnomeId);
  retarget(run, idx, ctx.rng, spotOf(idx, slot.gnomeId));

  const becameHot = !hot && p.streak >= rules.hotStreakAt;
  const outcome: TheCodeAnswerOutcome = { kind: 'correct', letter: slot.letter, points, hot, becameHot, runState: run.state };
  if (match === 'soundAlike') outcome.spellingTip = spellingTipFor(slot.letter, ctx.config.language);
  return { player: p, outcome, repairs, replayed: false };
}

// =================================================================
// Hints
// =================================================================

export type TheCodeHintKind = 'location' | 'riddle';

export type TheCodeHintOutcome =
  | { kind: 'hint'; hintKind: TheCodeHintKind; text: string; hintNumber: number; cost: number; remaining: number }
  | { kind: 'noMoreHints' }
  | { kind: 'noTarget' }
  | { kind: 'paused' };

export interface TheCodeHintResult {
  player: TheCodePlayer;
  outcome: TheCodeHintOutcome;
  repairs: TheCodeRepair[];
}

/** The location hints already visible for the current target (the zone hint is free). */
export function visibleLocationHints(player: TheCodePlayer, config: TheCodeConfig): string[] {
  const run = player.run;
  if (!run || run.targetSlotIndex === null) return [];
  const slot = run.slots[run.targetSlotIndex];
  const gnome = config.gnomes.find((g) => g.id === slot.gnomeId);
  const spot = config.spots.find((s) => s.id === gnome?.spotId);
  return (spot?.hints || []).filter(Boolean).slice(0, slot.locationHintsUsed);
}

/**
 * Next location hint (where is the gnome) or riddle hint (how to solve it) for the
 * current target. The first of each kind is free (the zone hint is given with the
 * target), every further one costs `hintCost`. Asking breaks the hot streak.
 */
export function requestHint(player: TheCodePlayer, hintKind: TheCodeHintKind, ctx: TheCodeContext): TheCodeHintResult {
  if (!isAdventureOpen(ctx.config, ctx.now, ctx.timeZone)) {
    return { player, outcome: { kind: 'paused' }, repairs: [] };
  }
  const rules = resolveRules(ctx.config.rules);
  const idx = buildIndex(ctx.config, ctx.riddles);
  const repaired = repairRun(player, ctx);
  let p = touch(repaired.player, ctx.now);
  const repairs = repaired.repairs;
  const run0 = p.run;
  if (!run0 || run0.state !== 'collecting' || run0.targetSlotIndex === null) {
    return { player: p, outcome: { kind: 'noTarget' }, repairs };
  }
  const slot0 = run0.slots[run0.targetSlotIndex];
  let hints: string[];
  let used: number;
  if (hintKind === 'location') {
    const spot = idx.spots.get(idx.gnomes.get(slot0.gnomeId)?.spotId || '');
    hints = (spot?.hints || []).filter(Boolean);
    used = slot0.locationHintsUsed;
  } else {
    hints = (idx.riddles.get(slot0.riddleId)?.hints || []).filter(Boolean);
    used = slot0.riddleHintsUsed;
  }
  if (used >= hints.length) return { player: p, outcome: { kind: 'noMoreHints' }, repairs };

  // The first hint of each kind is free. For location that is the zone hint, which is
  // already given with the target (locationHintsUsed starts at 1), so requests cost.
  const free = used === 0;
  const cost = free ? 0 : Math.min(p.points, rules.hintCost);
  p = clonePlayer(p);
  const slot = p.run!.slots[slot0.index];
  if (hintKind === 'location') slot.locationHintsUsed = used + 1;
  else slot.riddleHintsUsed = used + 1;
  p.points -= cost;
  p.streak = 0;
  return {
    player: p,
    outcome: { kind: 'hint', hintKind, text: hints[used], hintNumber: used + 1, cost, remaining: hints.length - used - 1 },
    repairs,
  };
}

// =================================================================
// Arrange + open
// =================================================================

export interface TheCodeArrangeOutcome {
  correct: boolean;
  /** Per position: does the family's letter match the phrase? */
  positions: boolean[];
  expectedLength: number;
}

/** Compare the family's letter order with the phrase (final forms / niqqud ignored). */
export function checkArrangement(phraseText: string, arrangement: string[]): TheCodeArrangeOutcome {
  const expected = phraseLetters(phraseText);
  const given = arrangement.map((ch) => normalizeLetter(ch));
  const positions = expected.map((l, i) => given[i] === l);
  return {
    correct: given.length === expected.length && positions.every(Boolean),
    positions,
    expectedLength: expected.length,
  };
}

export type TheCodeArrangeResult =
  | { kind: 'checked'; result: TheCodeArrangeOutcome }
  | { kind: 'notReady' }
  | { kind: 'paused' };

/** Check an arrangement without changing state (UI can call it on every move). */
export function arrangeLetters(player: TheCodePlayer, arrangement: string[], ctx: TheCodeContext): TheCodeArrangeResult {
  if (!isAdventureOpen(ctx.config, ctx.now, ctx.timeZone)) return { kind: 'paused' };
  const run = player.run;
  if (!run || run.state !== 'arranging') return { kind: 'notReady' };
  const phrase = ctx.config.phrases.find((ph) => ph.id === run.phraseId);
  if (!phrase) return { kind: 'notReady' };
  return { kind: 'checked', result: checkArrangement(phrase.text, arrangement) };
}

export type TheCodeOpenOutcome =
  | { kind: 'opened'; bonus: number; suitcasesOpened: number; replayed: boolean }
  | { kind: 'wrongOrder'; result: TheCodeArrangeOutcome }
  | { kind: 'notReady' }
  | { kind: 'paused' };

export interface TheCodeOpenResult {
  player: TheCodePlayer;
  outcome: TheCodeOpenOutcome;
}

/**
 * Open the suitcase with the family's arrangement. Awards `suitcaseBonus` once,
 * records the phrase as opened and the run's gnomes/riddles as found/solved
 * (gifted slots are neither). A repeat call is a no-op replay.
 */
export function openSuitcase(player: TheCodePlayer, arrangement: string[], ctx: TheCodeContext): TheCodeOpenResult {
  if (!isAdventureOpen(ctx.config, ctx.now, ctx.timeZone)) return { player, outcome: { kind: 'paused' } };
  const rules = resolveRules(ctx.config.rules);
  const run0 = player.run;
  if (run0 && run0.state === 'opened') {
    return { player, outcome: { kind: 'opened', bonus: 0, suitcasesOpened: player.suitcasesOpened, replayed: true } };
  }
  if (!run0 || run0.state !== 'arranging') return { player, outcome: { kind: 'notReady' } };
  const phrase = ctx.config.phrases.find((ph) => ph.id === run0.phraseId);
  if (!phrase) return { player, outcome: { kind: 'notReady' } };
  const result = checkArrangement(phrase.text, arrangement);
  if (!result.correct) return { player: touch(player, ctx.now), outcome: { kind: 'wrongOrder', result } };

  const p = clonePlayer(touch(player, ctx.now));
  const run = p.run!;
  run.state = 'opened';
  run.openedAt = ctx.now;
  run.targetSlotIndex = null;
  run.wrongGnomeIdsOnTarget = [];
  p.points += rules.suitcaseBonus;
  p.suitcasesOpened += 1;
  addUnique(p.openedPhraseIds, run.phraseId);
  for (const s of run.slots) {
    if (s.status !== 'solved') continue;
    addUnique(p.solvedRiddleIds, s.riddleId);
    addUnique(p.foundGnomeIds, s.gnomeId);
  }
  return { player: p, outcome: { kind: 'opened', bonus: rules.suitcaseBonus, suitcasesOpened: p.suitcasesOpened, replayed: false } };
}

// =================================================================
// Validation (operator)
// =================================================================

export interface TheCodeLetterCoverage {
  letter: string;
  /** Times the letter appears in the phrase (each is its own slot). */
  need: number;
  /** Distinct usable gnomes with a published riddle for this letter. */
  have: number;
}

export interface TheCodePhraseReport {
  phraseId: string;
  text: string;
  isActive: boolean;
  letters: string[];
  invalidChars: string[];
  tooShort: boolean;
  coverage: TheCodeLetterCoverage[];
  /**
   * Letters that cannot all get a distinct gnome. `have` here = how many slots of
   * that letter a full matching could fill (≤ distinct sources when gnomes are shared).
   */
  missing: TheCodeLetterCoverage[];
  /** A brand-new family could complete this phrase right now. */
  playable: boolean;
}

export interface TheCodeAdventureReport {
  phrases: TheCodePhraseReport[];
  /** Fresh suitcases ONE new family can open in a row before running out. */
  freshSuitcases: number;
  issues: TheCodeIssue[];
}

const COLOR_NAMES_HE: Record<string, string> = {
  red: 'אדום', blue: 'כחול', green: 'ירוק', yellow: 'צהוב', black: 'שחור', white: 'לבן', purple: 'סגול', orange: 'כתום',
};

function phraseReport(phrase: TheCodePhrase, config: TheCodeConfig, idx: Index): TheCodePhraseReport {
  const letters = phraseLetters(phrase.text);
  const invalidChars = invalidPhraseChars(phrase.text, config.language);
  const tooShort = letters.length < MIN_PHRASE_LETTERS;
  const noneSolved = new Set<string>();
  const counts = new Map<string, number>();
  for (const l of letters) counts.set(l, (counts.get(l) || 0) + 1);
  const srcs = new Map<string, Map<string, TheCodeRiddle[]>>();
  for (const l of counts.keys()) srcs.set(l, sourcesFor(idx, l, noneSolved));
  const coverage = [...counts].map(([letter, need]) => ({ letter, need, have: srcs.get(letter)!.size }));
  const match = maxMatching(letters.map((l) => [...srcs.get(l)!.keys()]), new Set());
  const filled = new Map<string, number>();
  letters.forEach((l, i) => { if (match[i]) filled.set(l, (filled.get(l) || 0) + 1); });
  const missing = [...counts]
    .filter(([l, need]) => (filled.get(l) || 0) < need)
    .map(([letter, need]) => ({ letter, need, have: filled.get(letter) || 0 }));
  return {
    phraseId: phrase.id, text: phrase.text, isActive: phrase.isActive, letters, invalidChars, tooShort,
    coverage, missing, playable: !invalidChars.length && !tooShort && letters.length > 0 && missing.length === 0,
  };
}

/** How many fresh suitcases one new family opens in a row (greedy simulation). */
export function countFreshSuitcases(config: TheCodeConfig, riddles: TheCodeRiddle[], seed = 1): number {
  const player = { openedPhraseIds: [] as string[], solvedRiddleIds: [] as string[], foundGnomeIds: [] as string[] };
  const ctx: TheCodeContext = { config: { ...config, status: 'published' }, riddles, now: 0, rng: createSeededRng(seed) };
  const limit = (config.phrases || []).length;
  let n = 0;
  while (n < limit) {
    const built = buildRun(player, ctx, { runId: `sim${n}` });
    if (built.kind === 'allDone') break;
    n++;
    player.openedPhraseIds.push(built.run.phraseId);
    for (const s of built.run.slots) {
      player.solvedRiddleIds.push(s.riddleId);
      player.foundGnomeIds.push(s.gnomeId);
    }
  }
  return n;
}

/** Full operator report: per-phrase coverage, fresh-suitcase count and issues. */
export function analyzeAdventure(config: TheCodeConfig, riddles: TheCodeRiddle[]): TheCodeAdventureReport {
  const he = config.language !== 'en';
  const idx = buildIndex(config, riddles);
  const issues: TheCodeIssue[] = [];
  const phrases = (config.phrases || []).map((ph) => phraseReport(ph, config, idx));
  const gnomeLabel = (g: TheCodeGnome) => (he ? `גמד ${g.number}` : `Gnome ${g.number}`);

  // ---- Phrases
  const active = phrases.filter((r) => r.isActive);
  if (!active.length) {
    issues.push({
      severity: 'error', code: 'NO_ACTIVE_PHRASE',
      message: he ? 'אין אף ביטוי סודי פעיל — הוסיפו ביטוי והפעילו אותו' : 'No active secret phrase — add one and turn it on',
    });
  }
  for (const r of active) {
    if (r.invalidChars.length) {
      issues.push({
        severity: 'error', code: 'PHRASE_INVALID_CHARS', phraseId: r.phraseId,
        message: he
          ? `בביטוי "${r.text}" יש תווים שאינם אותיות: ${r.invalidChars.join(' ')}`
          : `Phrase "${r.text}" has characters that are not letters: ${r.invalidChars.join(' ')}`,
      });
    }
    if (r.tooShort) {
      issues.push({
        severity: 'error', code: 'PHRASE_TOO_SHORT', phraseId: r.phraseId,
        message: he
          ? `הביטוי "${r.text}" קצר מדי — צריך לפחות ${MIN_PHRASE_LETTERS} אותיות`
          : `Phrase "${r.text}" is too short — at least ${MIN_PHRASE_LETTERS} letters`,
      });
    }
    if (r.invalidChars.length) continue;
    for (const m of r.missing) {
      issues.push({
        severity: 'error', code: 'PHRASE_LETTER_MISSING', phraseId: r.phraseId, letter: m.letter, need: m.need, have: m.have,
        message: he
          ? `חסרה חידה לאות ${m.letter}׳ בביטוי "${r.text}" — צריך ${m.need} גמדים שונים עם חידה לאות הזו, יש ${m.have}`
          : `Missing riddle for letter ${m.letter} in "${r.text}" — need ${m.need} different gnomes, have ${m.have}`,
      });
    }
  }

  // ---- Gnomes
  const publishedByGnome = new Map<string, number>();
  for (const rd of riddles || []) {
    if (isRiddleUsable(rd)) publishedByGnome.set(rd.gnomeId, (publishedByGnome.get(rd.gnomeId) || 0) + 1);
  }
  for (const g of config.gnomes || []) {
    if (!idx.spots.has(g.spotId)) {
      issues.push({
        severity: 'error', code: 'GNOME_SPOT_MISSING', gnomeId: g.id,
        message: he ? `${gnomeLabel(g)} משויך למקום שלא קיים` : `${gnomeLabel(g)} is assigned to a spot that does not exist`,
      });
    }
    if (!g.isActive) continue;
    if (!publishedByGnome.get(g.id)) {
      issues.push({
        severity: 'warning', code: 'GNOME_WITHOUT_RIDDLE', gnomeId: g.id,
        message: he ? `ל${gnomeLabel(g)} אין חידה מפורסמת` : `${gnomeLabel(g)} has no published riddle`,
      });
    }
    if (!g.verifiedOnSite) {
      issues.push({
        severity: 'warning', code: 'GNOME_NOT_VERIFIED', gnomeId: g.id,
        message: he ? `${gnomeLabel(g)} עוד לא נסרק במקום` : `${gnomeLabel(g)} was not scanned on site yet`,
      });
    }
  }

  // ---- Spots: colours side by side + hints
  const rg = (c: string) => (c === 'red' || c === 'green' ? 'RG' : c);
  for (const spot of config.spots || []) {
    const here = (config.gnomes || []).filter((g) => g.spotId === spot.id);
    for (let i = 0; i < here.length; i++) {
      for (let j = i + 1; j < here.length; j++) {
        const a = here[i];
        const b = here[j];
        const pair = he ? `${a.number} ו-${b.number}` : `${a.number} and ${b.number}`;
        if (a.bodyColor === b.bodyColor && a.hatColor === b.hatColor) {
          issues.push({
            severity: 'error', code: 'DUPLICATE_COLORS_AT_SPOT', spotId: spot.id, gnomeId: b.id,
            message: he
              ? `ב"${spot.name}" גמדים ${pair} נראים זהים (${COLOR_NAMES_HE[a.bodyColor]} עם כובע ${COLOR_NAMES_HE[a.hatColor]}) — המשפחה לא תדע מי הנכון`
              : `At "${spot.name}" gnomes ${pair} look identical — families cannot tell them apart`,
          });
        } else if (rg(a.bodyColor) === rg(b.bodyColor) && rg(a.hatColor) === rg(b.hatColor)) {
          issues.push({
            severity: 'warning', code: 'CONFUSABLE_COLORS_AT_SPOT', spotId: spot.id, gnomeId: b.id,
            message: he
              ? `ב"${spot.name}" גמדים ${pair} נבדלים רק באדום/ירוק — קשה לילדים עיוורי צבעים`
              : `At "${spot.name}" gnomes ${pair} differ only by red/green — hard for colour-blind children`,
          });
        }
      }
    }
    if (spot.isActive && !(spot.hints || []).some((h) => h && h.trim())) {
      issues.push({
        severity: 'warning', code: 'SPOT_WITHOUT_HINT', spotId: spot.id,
        message: he ? `לנקודה "${spot.name}" אין רמז מיקום` : `Spot "${spot.name}" has no location hint`,
      });
    }
  }

  // ---- Riddles whose letter a child may mistype (only when sound-alikes are not accepted)
  for (const rd of riddles || []) {
    if (!isRiddleUsable(rd) || rd.acceptSoundAlike) continue;
    const l = riddleLetter(rd);
    if (!isAmbiguousLetter(l)) continue;
    issues.push({
      severity: 'warning', code: 'RIDDLE_AMBIGUOUS_LETTER', riddleId: rd.id, gnomeId: rd.gnomeId, letter: l,
      message: he
        ? `התשובה "${rd.answerWord}" מתחילה ב-${l}׳ שנשמעת כמו ${soundAlikes(l).join('/')} — שקלו לאשר אות דומה`
        : `Answer "${rd.answerWord}" starts with ${l}, which sounds like ${soundAlikes(l).join('/')} — consider accepting sound-alikes`,
    });
  }

  // ---- Fresh content for one family
  const freshSuitcases = countFreshSuitcases(config, riddles);
  if (active.length && freshSuitcases < FEW_FRESH_SUITCASES) {
    issues.push({
      severity: 'warning', code: 'FEW_FRESH_ROUNDS', have: freshSuitcases, need: FEW_FRESH_SUITCASES,
      message: he
        ? `משפחה חדשה תוכל לפתוח רק ${freshSuitcases} מזוודות חדשות — הוסיפו חידות או ביטויים`
        : `A new family can open only ${freshSuitcases} fresh suitcases — add riddles or phrases`,
    });
  }

  return { phrases, freshSuitcases, issues };
}

/** Issues only. Publishing is blocked when any has severity `error`. */
export function validateAdventure(config: TheCodeConfig, riddles: TheCodeRiddle[]): TheCodeIssue[] {
  return analyzeAdventure(config, riddles).issues;
}

export function canPublish(issues: TheCodeIssue[]): boolean {
  return !issues.some((i) => i.severity === 'error');
}
