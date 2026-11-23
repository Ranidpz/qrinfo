// ============ קוד הגמדים — "free game" engine (stage 2 of free-mode-plan.md) ============
//
// PURE: no I/O, no Math.random, no Date.now — the caller passes `ctx` (same TheCodeContext
// as the guided engine). `engine.ts` is NOT edited; this module only imports its helpers.
//
// The free game, as approved by Rani on the stage-1 demo (/play/the-code/free, 23.11.2026):
// - Any awake gnome may be scanned (no target, no colour hunt, no wrong-scan penalty, no timer).
// - The gnome asks its CURRENT riddle; the answer is the first letter of the answer word.
// - Attempts: `attemptsPerRiddle` (2). Right on the 2nd = `secondAttemptFactor` (½) of the points.
//   All attempts wrong → the gnome sleeps with no points. Points never go negative.
// - Solved OR failed → the gnome falls asleep FOR THIS GROUP until its wake time
//   (`refreshMinutes` after — the operator picks days / hours / minutes), then asks its NEXT riddle.
//   Every group sees the same riddles in the same order (the admin's riddle order per gnome).
//   After the last riddle it starts over (`wrapRiddles`, default) — or stays done.
// - A location hint for a gnome costs `hintCost` (each further hint of the spot again);
//   it is only sold when the group can pay. Hints do not break the streak in this mode.
// - Hot streak exactly as the guided engine: ×hotMultiplier once the streak BEFORE the answer
//   reached hotStreakAt. Any wrong letter resets the streak.
// - No letters are collected (Rani 23.11.2026: "להסיר את האוסף") — only points and gnomes.
//   The first letter is just how a group answers. Every gnome asleep = "done for now".
//
// Storage: the free state rides on the player document as `free` (TheCodePlayer.free).
// `run` stays null in this mode. points / streak / solvedRiddleIds / foundGnomeIds are the
// SAME fields the guided game uses, so the board, lobby, staff screen and prize keep working.
// Contract: TheCodeConfig.mode / .free, TheCodePlayer.free and the outcome types live in
// src/types/thecode.ts; the wire shapes in src/types/thecode-api.ts.

import type {
  TheCodeConfig,
  TheCodeFreeAnswerOutcome,
  TheCodeFreeGnomeState,
  TheCodeFreeHintOutcome,
  TheCodeFreeScanOutcome,
  TheCodeFreeSettings,
  TheCodeFreeState,
  TheCodeIssue,
  TheCodePlayer,
  TheCodeRiddle,
} from '@/types/thecode';

export type { TheCodeFreeAnswerOutcome, TheCodeFreeGnomeState, TheCodeFreeHintOutcome, TheCodeFreeScanOutcome, TheCodeFreeState };
import { isAdventureOpen, resolveRules, riddleLetter, type TheCodeContext } from './engine';
import { matchLetter } from './letters';

// =================================================================
// Rules
// =================================================================

export interface TheCodeFreeRules {
  /** Minutes a gnome sleeps after it was solved / failed (1 minute … MAX_REFRESH_MINUTES).
   *  The settings screen shows it as days + hours + minutes (Rani: "כל X שעות ו־Y דקות"). */
  refreshMinutes: number;
  /** Letters a group may try per riddle (1–5). */
  attemptsPerRiddle: number;
  /** Share of the points for a right answer after a wrong one (0–1). */
  secondAttemptFactor: number;
  /** After a gnome's last riddle: start over (true) or stay done (false). */
  wrapRiddles: boolean;
}

export const DEFAULT_FREE_RULES: TheCodeFreeRules = {
  refreshMinutes: 60,
  attemptsPerRiddle: 2,
  secondAttemptFactor: 0.5,
  wrapRiddles: true,
};

/** The longest sleep an operator may set: 14 days. */
export const MAX_REFRESH_MINUTES = 14 * 24 * 60;

/** Below this many published riddles on a gnome the operator gets a warning. */
export const FEW_RIDDLES_PER_GNOME = 3;

/** Merge operator values over the defaults; junk falls back, numbers are clamped. */
export function resolveFreeRules(rules?: Partial<TheCodeFreeRules> | TheCodeFreeSettings | null): TheCodeFreeRules {
  const out: TheCodeFreeRules = { ...DEFAULT_FREE_RULES };
  if (!rules) return out;
  const num = (v: unknown, min: number, max: number) =>
    typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : undefined;
  const refresh = num(rules.refreshMinutes, 1, MAX_REFRESH_MINUTES);
  if (refresh !== undefined) out.refreshMinutes = Math.round(refresh);
  const att = num(rules.attemptsPerRiddle, 1, 5);
  if (att !== undefined) out.attemptsPerRiddle = Math.floor(att);
  out.secondAttemptFactor = num(rules.secondAttemptFactor, 0, 1) ?? out.secondAttemptFactor;
  if (typeof rules.wrapRiddles === 'boolean') out.wrapRiddles = rules.wrapRiddles;
  return out;
}

// =================================================================
// State
// =================================================================

/** A player document of a free-mode adventure (TheCodePlayer carries `free`). */
export type TheCodeFreePlayer = TheCodePlayer;

/** The free rules + the shared rules, read from the context's config (where the server keeps them). */
export interface TheCodeFreeContext extends TheCodeContext {
  /** Free-mode rules. Absent = the adventure's own `config.free`, then DEFAULT_FREE_RULES. */
  freeRules?: Partial<TheCodeFreeRules> | null;
}

const rulesOf = (ctx: TheCodeFreeContext) => resolveFreeRules(ctx.freeRules ?? ctx.config.free);

const emptyGnome = (): TheCodeFreeGnomeState => ({ done: 0, wrongs: 0, hintsUsed: 0 });

function cloneFree(f: TheCodeFreeState | undefined): TheCodeFreeState {
  const gnomes: Record<string, TheCodeFreeGnomeState> = {};
  for (const [id, g] of Object.entries(f?.gnomes || {})) gnomes[id] = { ...g, last: g.last ? { ...g.last } : undefined };
  return { gnomes, solved: f?.solved ?? 0 };
}

function clonePlayer(p: TheCodeFreePlayer): TheCodeFreePlayer {
  return {
    ...p,
    solvedRiddleIds: [...(p.solvedRiddleIds || [])],
    foundGnomeIds: [...(p.foundGnomeIds || [])],
    free: cloneFree(p.free),
  };
}

const gnomeStateOf = (p: TheCodeFreePlayer, gnomeId: string): TheCodeFreeGnomeState =>
  p.free?.gnomes?.[gnomeId] ?? emptyGnome();

function addUnique(list: string[], id: string): void {
  if (id && !list.includes(id)) list.push(id);
}

// =================================================================
// Lookups
// =================================================================

function gnomeOf(config: TheCodeConfig, gnomeId: string) {
  return (config.gnomes || []).find((g) => g.id === gnomeId);
}

/** The gnome is switched on and stands at a switched-on spot. */
function isGnomeOn(config: TheCodeConfig, gnomeId: string): boolean {
  const g = gnomeOf(config, gnomeId);
  if (!g || !g.isActive) return false;
  const spot = (config.spots || []).find((s) => s.id === g.spotId);
  return !!spot && spot.isActive;
}

/** The gnome's playable riddles, in the admin's order — the same order for every group. */
export function freeRiddlesOf(gnomeId: string, riddles: TheCodeRiddle[]): TheCodeRiddle[] {
  return (riddles || []).filter((r) => r.gnomeId === gnomeId && r.status === 'published' && riddleLetter(r) !== '');
}

/** The riddle a gnome asks this group next, or null when it has none left. */
function nextRiddle(g: TheCodeFreeGnomeState, list: TheCodeRiddle[], rules: TheCodeFreeRules): TheCodeRiddle | null {
  if (!list.length) return null;
  if (g.done >= list.length && !rules.wrapRiddles) return null;
  return list[g.done % list.length];
}

// =================================================================
// Clock
// =================================================================

/** When a gnome that falls asleep at `now` wakes again. */
export function freeWakeTime(now: number, rules: TheCodeFreeRules): number {
  return now + rules.refreshMinutes * 60_000;
}

/** {days, hours, minutes} for the settings screen, and back. */
export function splitRefresh(minutes: number): { days: number; hours: number; minutes: number } {
  const m = Math.max(0, Math.round(minutes));
  return { days: Math.floor(m / 1440), hours: Math.floor((m % 1440) / 60), minutes: m % 60 };
}
export function joinRefresh(parts: { days?: number; hours?: number; minutes?: number }): number {
  const total = (parts.days || 0) * 1440 + (parts.hours || 0) * 60 + (parts.minutes || 0);
  return Math.min(MAX_REFRESH_MINUTES, Math.max(1, Math.round(total)));
}

const sleeping = (g: TheCodeFreeGnomeState, now: number) => g.asleepUntil !== undefined && g.asleepUntil > now;

// =================================================================
// Board (what the phone shows — never an answer)
// =================================================================

export type TheCodeFreeGnomeStatus = 'awake' | 'asleep' | 'noRiddles';

export interface TheCodeFreeBoardGnome {
  gnomeId: string;
  status: TheCodeFreeGnomeStatus;
  /** With 'asleep'. */
  wakesAt?: number;
  /** How the last riddle here ended. */
  last?: { result: 'full' | 'half' | 'failed' };
  /** Location hints bought so far, and the price of the next one (null = none left). */
  hintsShown: string[];
  nextHintCost: number | null;
}

export interface TheCodeFreeBoard {
  gnomes: TheCodeFreeBoardGnome[];
  /** No gnome is awake for this group right now ("done for today"). */
  allAsleep: boolean;
  /** The earliest wake time of a sleeping gnome, if any. */
  nextWakeAt?: number;
}

function spotHints(config: TheCodeConfig, gnomeId: string): string[] {
  const g = gnomeOf(config, gnomeId);
  const spot = (config.spots || []).find((s) => s.id === g?.spotId);
  return (spot?.hints || []).filter(Boolean);
}

function statusOf(p: TheCodeFreePlayer, gnomeId: string, ctx: TheCodeFreeContext): { status: TheCodeFreeGnomeStatus; wakesAt?: number } {
  const rules = rulesOf(ctx);
  const g = gnomeStateOf(p, gnomeId);
  if (sleeping(g, ctx.now)) return { status: 'asleep', wakesAt: g.asleepUntil };
  if (!nextRiddle(g, freeRiddlesOf(gnomeId, ctx.riddles), rules)) return { status: 'noRiddles' };
  return { status: 'awake' };
}

/** The phone board: every switched-on gnome with its state for this group. */
export function freeBoard(player: TheCodeFreePlayer, ctx: TheCodeFreeContext): TheCodeFreeBoard {
  const shared = resolveRules(ctx.config.rules);
  const gnomes: TheCodeFreeBoardGnome[] = [];
  for (const g of [...(ctx.config.gnomes || [])].sort((a, b) => a.number - b.number)) {
    if (!isGnomeOn(ctx.config, g.id)) continue;
    const st = gnomeStateOf(player, g.id);
    const { status, wakesAt } = statusOf(player, g.id, ctx);
    const hints = spotHints(ctx.config, g.id);
    const used = Math.min(st.hintsUsed, hints.length);
    const row: TheCodeFreeBoardGnome = {
      gnomeId: g.id,
      status,
      hintsShown: hints.slice(0, used),
      nextHintCost: used < hints.length ? shared.hintCost : null,
    };
    if (wakesAt !== undefined) row.wakesAt = wakesAt;
    if (status === 'asleep' && st.last) row.last = { result: st.last.result };
    gnomes.push(row);
  }
  const wakes = gnomes.map((g) => g.wakesAt).filter((t): t is number => t !== undefined);
  const board: TheCodeFreeBoard = {
    gnomes,
    allAsleep: gnomes.length > 0 && !gnomes.some((g) => g.status === 'awake'),
  };
  if (wakes.length) board.nextWakeAt = Math.min(...wakes);
  return board;
}

/** No gnome is awake for this group right now. */
export function freeAllAsleep(player: TheCodeFreePlayer, ctx: TheCodeFreeContext): boolean {
  return freeBoard(player, ctx).allAsleep;
}

// =================================================================
// Scan
// =================================================================

export interface TheCodeFreeScanResult {
  player: TheCodeFreePlayer;
  outcome: TheCodeFreeScanOutcome;
}

/** A group scanned a gnome. Pins the riddle it will answer (idempotent while unanswered). */
export function freeScan(player: TheCodeFreePlayer, gnomeId: string, ctx: TheCodeFreeContext): TheCodeFreeScanResult {
  if (!isAdventureOpen(ctx.config, ctx.now, ctx.timeZone)) return { player, outcome: { kind: 'paused' } };
  if (!gnomeOf(ctx.config, gnomeId)) return { player, outcome: { kind: 'unknownGnome' } };
  if (!isGnomeOn(ctx.config, gnomeId)) return { player, outcome: { kind: 'gnomeOff' } };
  const rules = rulesOf(ctx);
  const st = gnomeStateOf(player, gnomeId);
  if (sleeping(st, ctx.now)) {
    const outcome: TheCodeFreeScanOutcome = { kind: 'asleep', gnomeId, wakesAt: st.asleepUntil! };
    if (st.last) outcome.last = st.last.result;
    return { player: { ...player, lastSeenAt: ctx.now }, outcome };
  }
  const list = freeRiddlesOf(gnomeId, ctx.riddles);
  // Still showing a riddle that is playable → keep it (a re-scan never swaps the question).
  const pinned = st.riddleId ? list.find((r) => r.id === st.riddleId) : undefined;
  const riddle = pinned ?? nextRiddle(st, list, rules);
  if (!riddle) return { player: { ...player, lastSeenAt: ctx.now }, outcome: { kind: 'noRiddles', gnomeId } };

  const p = clonePlayer(player);
  p.lastSeenAt = ctx.now;
  const g = { ...st };
  if (g.riddleId !== riddle.id) {
    g.riddleId = riddle.id;
    g.wrongs = 0;
  }
  g.scannedAt = g.scannedAt ?? ctx.now;
  delete g.asleepUntil;
  p.free!.gnomes[gnomeId] = g;
  return {
    player: p,
    outcome: { kind: 'riddle', gnomeId, riddleId: riddle.id, attemptsLeft: Math.max(1, rules.attemptsPerRiddle - g.wrongs) },
  };
}

// =================================================================
// Answer
// =================================================================

export interface TheCodeFreeAnswerResult {
  player: TheCodeFreePlayer;
  outcome: TheCodeFreeAnswerOutcome;
  /** A repeat of an answer already scored (double tap / retried request): nothing changed. */
  replayed: boolean;
}

function spellingTip(letter: string, answerWord: string, language: TheCodeConfig['language']): string {
  return language === 'en' ? `Almost! ${answerWord} is spelled with ${letter}.` : `כמעט! ${answerWord} כותבים ב־${letter}׳`;
}

/**
 * The group tapped a letter for the riddle shown at `gnomeId`. Pass the `riddleId` the phone
 * showed: a retry after the gnome already fell asleep is recognised and never scored twice.
 */
export function freeAnswer(
  player: TheCodeFreePlayer,
  input: { gnomeId: string; letter: string; riddleId?: string },
  ctx: TheCodeFreeContext
): TheCodeFreeAnswerResult {
  if (!isAdventureOpen(ctx.config, ctx.now, ctx.timeZone)) return { player, outcome: { kind: 'paused' }, replayed: false };
  const rules = rulesOf(ctx);
  const shared = resolveRules(ctx.config.rules);
  const st = gnomeStateOf(player, input.gnomeId);

  // Already answered (the gnome fell asleep on that riddle) → report it again, change nothing.
  if (sleeping(st, ctx.now) && st.last && (!input.riddleId || input.riddleId === st.last.riddleId)) {
    const riddle = (ctx.riddles || []).find((r) => r.id === st.last!.riddleId);
    const all = freeAllAsleep(player, ctx);
    const outcome: TheCodeFreeAnswerOutcome = st.last.result === 'failed'
      ? { kind: 'failed', wakesAt: st.asleepUntil!, allAsleep: all }
      : {
          kind: 'correct', letter: st.last.letter || '', answerWord: riddle?.answerWord || '', points: st.last.points,
          secondTry: st.last.result === 'half', hot: false, becameHot: false, wakesAt: st.asleepUntil!, allAsleep: all,
        };
    return { player, outcome, replayed: true };
  }

  // Only a riddle that was scanned at the gnome (no answering from the couch).
  if (sleeping(st, ctx.now) || !st.riddleId || st.scannedAt === undefined || !isGnomeOn(ctx.config, input.gnomeId) ||
      (input.riddleId && input.riddleId !== st.riddleId)) {
    return { player, outcome: { kind: 'noRiddle' }, replayed: false };
  }
  const riddle = freeRiddlesOf(input.gnomeId, ctx.riddles).find((r) => r.id === st.riddleId);
  if (!riddle) return { player, outcome: { kind: 'noRiddle' }, replayed: false };

  const letter = riddleLetter(riddle);
  const match = matchLetter(input.letter, letter, !!riddle.acceptSoundAlike);
  const p = clonePlayer(player);
  p.lastSeenAt = ctx.now;
  const g: TheCodeFreeGnomeState = { ...st };
  const sleepNow = () => {
    g.done = st.done + 1;
    g.asleepUntil = freeWakeTime(ctx.now, rules);
    g.wrongs = 0;
    delete g.riddleId;
    delete g.scannedAt;
  };

  if (match === 'wrong') {
    p.streak = 0;
    g.wrongs = st.wrongs + 1;
    if (g.wrongs < rules.attemptsPerRiddle) {
      p.free!.gnomes[input.gnomeId] = g;
      return { player: p, outcome: { kind: 'wrong', attemptsLeft: rules.attemptsPerRiddle - g.wrongs }, replayed: false };
    }
    sleepNow();
    g.last = { riddleId: riddle.id, result: 'failed', points: 0, at: ctx.now };
    p.free!.gnomes[input.gnomeId] = g;
    return { player: p, outcome: { kind: 'failed', wakesAt: g.asleepUntil!, allAsleep: freeAllAsleep(p, ctx) }, replayed: false };
  }

  const secondTry = st.wrongs > 0;
  const hot = p.streak >= shared.hotStreakAt;
  const base = shared.pointsPerLetter * (secondTry ? rules.secondAttemptFactor : 1);
  const points = Math.round(base * (hot ? shared.hotMultiplier : 1));
  p.streak += 1;
  p.points += points;
  addUnique(p.solvedRiddleIds, riddle.id);
  addUnique(p.foundGnomeIds, input.gnomeId);
  p.free!.solved = (p.free!.solved ?? 0) + 1;
  sleepNow();
  g.last = { riddleId: riddle.id, result: secondTry ? 'half' : 'full', points, letter, at: ctx.now };
  p.free!.gnomes[input.gnomeId] = g;

  const outcome: TheCodeFreeAnswerOutcome = {
    kind: 'correct', letter, answerWord: riddle.answerWord, points, secondTry, hot,
    becameHot: !hot && p.streak >= shared.hotStreakAt, wakesAt: g.asleepUntil!, allAsleep: freeAllAsleep(p, ctx),
  };
  if (match === 'soundAlike') outcome.spellingTip = spellingTip(letter, riddle.answerWord, ctx.config.language);
  return { player: p, outcome, replayed: false };
}

// =================================================================
// Location hint
// =================================================================

export interface TheCodeFreeHintResult {
  player: TheCodeFreePlayer;
  outcome: TheCodeFreeHintOutcome;
}

/** Buy the next location hint of a gnome. Sold only to a group that can pay, only for an awake gnome. */
export function freeBuyHint(player: TheCodeFreePlayer, gnomeId: string, ctx: TheCodeFreeContext): TheCodeFreeHintResult {
  if (!isAdventureOpen(ctx.config, ctx.now, ctx.timeZone)) return { player, outcome: { kind: 'paused' } };
  if (!gnomeOf(ctx.config, gnomeId) || !isGnomeOn(ctx.config, gnomeId)) return { player, outcome: { kind: 'unknownGnome' } };
  if (statusOf(player, gnomeId, ctx).status !== 'awake') return { player, outcome: { kind: 'notAwake' } };
  const hints = spotHints(ctx.config, gnomeId);
  const st = gnomeStateOf(player, gnomeId);
  if (st.hintsUsed >= hints.length) return { player, outcome: { kind: 'noMoreHints' } };
  const cost = resolveRules(ctx.config.rules).hintCost;
  if (player.points < cost) return { player, outcome: { kind: 'notEnoughPoints', cost } };
  const p = clonePlayer(player);
  p.lastSeenAt = ctx.now;
  p.points -= cost;
  p.free!.gnomes[gnomeId] = { ...st, hintsUsed: st.hintsUsed + 1 };
  return { player: p, outcome: { kind: 'hint', gnomeId, text: hints[st.hintsUsed], cost, remaining: hints.length - st.hintsUsed - 1 } };
}

// =================================================================
// Round reset + operator checks
// =================================================================

/** "סבב חדש" in free mode: the free state goes with the rest of the round. */
export function resetFreeState(player: TheCodeFreePlayer): TheCodeFreePlayer {
  const p = { ...player };
  delete p.free;
  return p;
}

/** Warnings for the operator before publishing a free adventure (no phrase is needed). */
export function freeAdventureIssues(config: TheCodeConfig, riddles: TheCodeRiddle[]): TheCodeIssue[] {
  const issues: TheCodeIssue[] = [];
  const he = config.language !== 'en';
  for (const g of config.gnomes || []) {
    if (!isGnomeOn(config, g.id)) continue;
    const have = freeRiddlesOf(g.id, riddles).length;
    if (have === 0) {
      issues.push({
        severity: 'error', code: 'GNOME_WITHOUT_RIDDLE', gnomeId: g.id, have: 0,
        message: he ? `לגמד ${g.number} אין חידה פעילה` : `Gnome ${g.number} has no published riddle`,
      });
    } else if (have < FEW_RIDDLES_PER_GNOME) {
      issues.push({
        severity: 'warning', code: 'FEW_FRESH_ROUNDS', gnomeId: g.id, have, need: FEW_RIDDLES_PER_GNOME,
        message: he
          ? `לגמד ${g.number} יש רק ${have === 1 ? 'חידה אחת' : `${have} חידות`}. קבוצה שתחזור אליו תקבל שוב את אותה חידה.`
          : `Gnome ${g.number} has only ${have} riddle(s); returning groups will see them again.`,
      });
    }
  }
  return issues;
}
