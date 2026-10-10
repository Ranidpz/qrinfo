// "10 בול" phone mode — the pure rules, shared by the API routes, the phone and the big screen.
// No imports on purpose: scripts/tests/tenbool-competition.test.mjs loads this file directly.

export const TARGET_MS = 10000;
export const MAX_ROUND_MS = 20000; // the game auto-stops here (TenBoolViewer AUTO_STOP_MS)
// "The closest" list only takes stops inside the last second either side of 10.00 (9.01 - 10.99),
// so it stays short and means something.
export const NEAR_MISS_HUNDREDTHS = 100;
export const NEAR_LIST_SIZE = 5;
export const MIN_ROUND_GAP_MS = 800; // two round starts closer than this are a script, not a thumb
// The phone measures the time (only it has hundredth precision); the server only checks the claim is
// physically possible. Network delay at the start can make the server's clock run SHORT of the
// phone's, so the claim may exceed it by this much - no more.
export const CLOCK_SLACK_MS = 2000;
// A result that arrives this long after the round should have ended is stale (left in a pocket)
export const STALE_ROUND_MS = 120000;

// Truncated to hundredths like a stopwatch - the same judgement the game shows on screen
export const hundredths = (ms: number) => Math.floor(ms / 10);
export const diffFromTarget = (ms: number) => hundredths(ms) - hundredths(TARGET_MS);

export function formatTime(ms: number) {
  const h = hundredths(ms);
  return `${String(Math.floor(h / 100)).padStart(2, '0')}.${String(h % 100).padStart(2, '0')}`;
}

// 'ok' = counts; anything else is recorded as a miss and never as a hit
export type TimingVerdict = 'ok' | 'bad-ms' | 'too-fast' | 'stale';

export function judgeTiming(claimedMs: unknown, serverElapsedMs: number): TimingVerdict {
  if (typeof claimedMs !== 'number' || !Number.isFinite(claimedMs) || claimedMs < 0 || claimedMs > MAX_ROUND_MS) {
    return 'bad-ms';
  }
  if (claimedMs > serverElapsedMs + CLOCK_SLACK_MS) return 'too-fast';
  if (serverElapsedMs > claimedMs + STALE_ROUND_MS) return 'stale';
  return 'ok';
}

// Rank keys. Firestore orders a single numeric field with its automatic index, and a doc without
// the field drops out of the query - so a player is ON a list exactly when the key is present.
// Winners: fewer attempts first, then whoever hit first. 1e13 > any epoch-ms, and the attempts cap
// keeps the product under Number.MAX_SAFE_INTEGER.
const RANK_SPLIT = 1e13;
const MAX_RANKED_ATTEMPTS = 900;
export function winRank(attempts: number, wonAtMs: number) {
  return Math.min(Math.max(1, attempts), MAX_RANKED_ATTEMPTS) * RANK_SPLIT + wonAtMs;
}
// Closest: smaller miss first, then whoever got there first
export function nearRank(absDiff: number, atMs: number) {
  return absDiff * RANK_SPLIT + atMs;
}

export interface RankInput {
  won: boolean;
  claimed: boolean; // finished the win flow (phone code if required + name / selfie)
  hidden: boolean;
  wonAttempts?: number | null;
  wonAt?: number | null;
  bestAbsDiff?: number | null;
  bestAt?: number | null;
}

// Which list (if any) a player belongs on, as the two Firestore fields to write.
// null = delete the field.
export function rankFields(p: RankInput): { winRank: number | null; nearRank: number | null } {
  if (p.hidden) return { winRank: null, nearRank: null };
  if (p.won) {
    // A hit that hasn't been claimed yet stays off both lists - it goes up with its name and photo
    return {
      winRank: p.claimed && p.wonAttempts && p.wonAt ? winRank(p.wonAttempts, p.wonAt) : null,
      nearRank: null,
    };
  }
  if (p.bestAbsDiff != null && p.bestAbsDiff > 0 && p.bestAbsDiff < NEAR_MISS_HUNDREDTHS && p.bestAt) {
    return { winRank: null, nearRank: nearRank(p.bestAbsDiff, p.bestAt) };
  }
  return { winRank: null, nearRank: null };
}

// Names on a big public screen: trimmed, single-spaced, no control / bidi-override characters
export const NICKNAME_MAX = 20;
export function cleanNickname(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw
    .replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (name.length < 2) return null;
  return Array.from(name).slice(0, NICKNAME_MAX).join('');
}

// Every new player gets a fun name, so the "closest" list is never a column of blanks
const ANIMALS = ['נמר', 'שועל', 'ינשוף', 'דולפין', 'צ׳יטה', 'נשר', 'פנדה', 'זאב', 'קנגורו', 'תמנון', 'פינגווין', 'סנאי', 'צב', 'ג׳ירפה', 'קיפוד', 'לוטרה'];
const TRAITS = ['זריז', 'מדויק', 'רגוע', 'חד', 'ממוקד', 'שקט', 'אמיץ', 'קר רוח', 'נועז', 'ערני', 'מהיר', 'סבלני'];
export function randomNickname(rand: () => number = Math.random) {
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length) % arr.length];
  return `${pick(ANIMALS)} ${pick(TRAITS)}`;
}

// "early by 0.03" / "late by 0.12" as a signed seconds string for the closest list
export function formatDiff(diff: number) {
  const s = (Math.abs(diff) / 100).toFixed(2);
  return diff < 0 ? `-${s}` : `+${s}`;
}
