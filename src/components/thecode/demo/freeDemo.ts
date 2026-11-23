// קוד הגמדים — "free game" DEMO (stage 1 of free-mode-plan.md): no server, no Firestore.
// Pure and local: every function takes the state (+ the demo clock) and returns a new state.
// The screens (src/components/thecode/free/*) render it; /play/the-code/free wires it up.
//
// Rules of the free game (agreed 23.11.2026, some still open with Kondra — change them HERE):
// any awake gnome may be scanned (no routing, no colour target, no timer, no wrong-scan penalty);
// a riddle answered by its first letter; solved → points + the letter + the gnome sleeps for
// THIS group until the refresh, then wakes with its NEXT riddle (same order for every group);
// two attempts, the second worth half; two wrong → asleep, no points, never negative;
// a location hint costs points; all gnomes asleep → "finished for today, prize at reception".
//
// The demo keeps its own types here on purpose — the real contracts (src/types/thecode*.ts)
// belong to the planning session. Delete this file when the free engine is wired.

import type { TheCodeColor } from '@/types/thecode';
import { RIDDLE_BANK } from '@/lib/thecode/riddleBank';
import { alphabetFor, letterOfAnswer, matchLetter } from '@/lib/thecode/letters';

// ------------------------------------------------ the rules (easy to change)

/** How many gnomes stand around the venue. */
export const FREE_GNOME_COUNT = 16;
/** Points for a riddle solved on the first attempt. */
export const POINTS_PER_RIDDLE = 100;
/** Attempts per riddle before the gnome falls asleep with no points. */
export const ATTEMPTS_PER_RIDDLE = 2;
/** The second attempt is worth this share of the points. */
export const SECOND_ATTEMPT_FACTOR = 0.5;
/** Points paid for a gnome's location hint (never taken below zero). */
export const HINT_COST = 20;
/** Correct answers in a row that make the group "hot" (as today). */
export const HOT_STREAK_AT = 3;
/** While hot, points are multiplied by this (as today). */
export const HOT_MULTIPLIER = 2;
/** A letter that sounds the same (ט/ת, כ/ק…) counts as right, with a spelling tip (as today). */
export const ACCEPT_SOUND_ALIKE = true;
/**
 * When a sleeping gnome wakes. OPEN with Kondra: N minutes after it fell asleep, or once a day
 * at a fixed hour. Switch `kind` to 'dailyAt' to try the other one.
 */
export const REFRESH: { kind: 'minutes'; minutes: number } | { kind: 'dailyAt'; hour: number } = { kind: 'minutes', minutes: 60 };
/** Riddles each gnome has in the demo; after the last it starts over (OPEN: wrap or stay asleep). */
export const RIDDLES_PER_GNOME = 3;

export const FREE_VENUE_NAME = 'אחוזת הגמדים';
/** Where the gnomes' big screen stands — the hint an unregistered group gets (the venue writes it). */
export const SCREEN_HINT = 'בלובי, על הקיר שמול דלפק הקבלה. חפשו את המסך עם הגמדים שרוקדים.';

// ------------------------------------------------ demo data

export interface FreeRiddle {
  text: string;
  answerWord: string;
  letter: string;
}

export interface FreeGnome {
  id: string;
  number: number;
  /** What the printed QR / the hand-typed code carries in the demo. */
  code: string;
  bodyColor: TheCodeColor;
  hatColor: TheCodeColor;
  /** The location hint a group can buy. */
  hint: string;
  riddles: FreeRiddle[];
}

/** 16 different colour pairs from the filaments the indoor gnomes are printed in. */
const COLORS: [TheCodeColor, TheCodeColor][] = [
  ['blue', 'yellow'], ['green', 'red'], ['purple', 'white'], ['brown', 'green'],
  ['white', 'red'], ['black', 'yellow'], ['red', 'white'], ['yellow', 'black'],
  ['green', 'blue'], ['white', 'blue'], ['brown', 'purple'], ['purple', 'brown'],
  ['blue', 'red'], ['yellow', 'green'], ['black', 'brown'], ['red', 'yellow'],
];

const HINTS = [
  'ליד הפסנתר בלובי', 'ליד בריכת הדגים בגינה', 'בכניסה לחדר האוכל', 'על מדף בפינת הספרייה',
  'בין שתי המעליות', 'במרפסת, ליד המעקה', 'על דלפק הקבלה, ליד הפעמון', 'בין ערוגות התבלינים',
  'ליד החור האחרון במיני גולף', 'ליד מכונת הקפה', 'מתחת לעץ הגדול בחצר', 'ליד הנדנדות בגן השעשועים',
  'בפינת המשחקים, ליד הלגו', 'ליד שולחן הפינג פונג', 'ליד המזרקה בכניסה', 'ליד הכורסאות שמול האח',
];

/**
 * Real riddles from the operators' ready-made bank (easy ones), 3 per gnome. The bank is sorted
 * by letter, so deal it round-robin across letters: one round of 16 gnomes asks 16 different letters.
 */
const EASY = (() => {
  const byLetter = new Map<string, typeof RIDDLE_BANK>();
  for (const r of RIDDLE_BANK) {
    if (r.difficulty !== 1) continue;
    const l = letterOfAnswer(r.answerWord);
    byLetter.set(l, [...(byLetter.get(l) ?? []), r]);
  }
  const piles = [...byLetter.values()];
  const out: typeof RIDDLE_BANK = [];
  for (let k = 0; out.length < RIDDLE_BANK.length && piles.some((p) => p.length > k); k++) {
    for (const p of piles) if (p[k]) out.push(p[k]);
  }
  return out;
})();

export const FREE_GNOMES: FreeGnome[] = COLORS.map(([bodyColor, hatColor], i) => ({
  id: `fg${i + 1}`,
  number: i + 1,
  code: String(101 + i),
  bodyColor,
  hatColor,
  hint: HINTS[i],
  riddles: Array.from({ length: RIDDLES_PER_GNOME }, (_, k) => {
    const r = EASY[(i + k * FREE_GNOME_COUNT) % EASY.length];
    return { text: r.text, answerWord: r.answerWord, letter: letterOfAnswer(r.answerWord) };
  }),
}));

export const FREE_ALPHABET = alphabetFor('he');

const gnomeById = (id: string) => FREE_GNOMES.find((g) => g.id === id);

// ------------------------------------------------ state

export interface FreeGnomeProgress {
  /** Which of the gnome's riddles it asks now. */
  riddleIndex: number;
  /** Demo-clock ms; while in the future the gnome sleeps for this group. */
  asleepUntil: number | null;
  /** Wrong letters on the current riddle. */
  wrongs: number;
  /** How the last riddle ended — shown on the sleeping card. */
  last?: 'full' | 'half' | 'failed';
  /** The letter collected from the last riddle (shown on the sleeping card). */
  lastLetter?: string;
  hintBought: boolean;
}

export interface FreeCollected {
  letter: string;
  gnomeId: string;
}

export interface FreeCorrect {
  gnomeId: string;
  letter: string;
  /** The answer itself — shown only after the group got it right. */
  answerWord: string;
  points: number;
  half: boolean;
  hot: boolean;
  becameHot: boolean;
  spellingTip?: string;
  /** This answer put the last awake gnome to sleep. */
  allAsleep: boolean;
}

export type FreeScreen =
  | { kind: 'startAtScreen'; gnomeId: string | null }
  | { kind: 'register' }
  /** Right after registering (and from "?" in the header): Cliostro's explanation + the rules. */
  | { kind: 'intro' }
  | { kind: 'board' }
  | { kind: 'scanner'; error: string | null }
  | { kind: 'gnome'; gnomeId: string }
  | { kind: 'riddle'; gnomeId: string }
  | { kind: 'correct' }
  | { kind: 'failed'; gnomeId: string; allAsleep: boolean }
  | { kind: 'asleep'; gnomeId: string }
  | { kind: 'finished' };

export interface FreeDemoState {
  screen: FreeScreen;
  /** Demo time travel: added to the real clock. */
  offsetMs: number;
  group: { name: string; emoji: string } | null;
  points: number;
  streak: number;
  letters: FreeCollected[];
  gnomes: Record<string, FreeGnomeProgress>;
  pendingLetter: string | null;
  /** Bumps on every wrong letter (the riddle shakes). */
  wrongTick: number;
  correct: FreeCorrect | null;
  muted: boolean;
}

export function createFreeDemoState(): FreeDemoState {
  const gnomes: Record<string, FreeGnomeProgress> = {};
  for (const g of FREE_GNOMES) gnomes[g.id] = { riddleIndex: 0, asleepUntil: null, wrongs: 0, hintBought: false };
  // The demo opens the way a real group starts: they scanned a gnome before registering.
  return {
    screen: { kind: 'startAtScreen', gnomeId: FREE_GNOMES[4].id },
    offsetMs: 0,
    group: null,
    points: 0,
    streak: 0,
    letters: [],
    gnomes,
    pendingLetter: null,
    wrongTick: 0,
    correct: null,
    muted: false,
  };
}

// ------------------------------------------------ clock

export const demoNow = (s: FreeDemoState, realNow: number) => realNow + s.offsetMs;

/** When a gnome that falls asleep at `t` wakes again. */
export function wakeTimeFrom(t: number): number {
  if (REFRESH.kind === 'minutes') return t + REFRESH.minutes * 60_000;
  const d = new Date(t);
  d.setHours(REFRESH.hour, 0, 0, 0);
  if (d.getTime() <= t) d.setDate(d.getDate() + 1);
  return d.getTime();
}

export const isAsleep = (p: FreeGnomeProgress, now: number) => p.asleepUntil !== null && p.asleepUntil > now;

/** "בעוד 42 דקות" / "בעוד שעה ו־5 דק׳" / "מחר ב־08:00". */
export function wakeLabel(until: number, now: number): string {
  const min = Math.max(1, Math.ceil((until - now) / 60_000));
  if (min < 60) return min === 1 ? 'בעוד דקה' : `בעוד ${min} דקות`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h >= 12) {
    const d = new Date(until);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return new Date(now).getDate() === d.getDate() ? `היום ב־${hh}:${mm}` : `מחר ב־${hh}:${mm}`;
  }
  const hours = h === 1 ? 'שעה' : h === 2 ? 'שעתיים' : `${h} שעות`;
  return m ? `בעוד ${hours} ו־${m} דק׳` : `בעוד ${hours}`;
}

export const allAsleep = (s: FreeDemoState, now: number) => FREE_GNOMES.every((g) => isAsleep(s.gnomes[g.id], now));

export const currentRiddle = (s: FreeDemoState, gnomeId: string): FreeRiddle | null => {
  const g = gnomeById(gnomeId);
  return g ? g.riddles[s.gnomes[gnomeId].riddleIndex % g.riddles.length] : null;
};

export const isHot = (s: FreeDemoState) => s.streak >= HOT_STREAK_AT;

// ------------------------------------------------ actions

/** A scan (camera, typed code or the demo bar). Unregistered → "start at the screen". */
export function freeScan(s: FreeDemoState, gnomeId: string, realNow: number): FreeDemoState {
  if (!gnomeById(gnomeId)) return s;
  if (!s.group) return { ...s, screen: { kind: 'startAtScreen', gnomeId } };
  const now = demoNow(s, realNow);
  if (isAsleep(s.gnomes[gnomeId], now)) return { ...s, screen: { kind: 'asleep', gnomeId } };
  return { ...s, pendingLetter: null, screen: { kind: 'riddle', gnomeId } };
}

/** A code typed by hand on the scanner screen. */
export function freeScanCode(s: FreeDemoState, code: string, realNow: number): FreeDemoState {
  const g = FREE_GNOMES.find((x) => x.code === code.trim());
  if (!g) return { ...s, screen: { kind: 'scanner', error: 'זה לא גמד של המשחק. בדקו את הקוד שמתחת לגמד.' } };
  return freeScan(s, g.id, realNow);
}

export function freeRegister(s: FreeDemoState, name: string, emoji: string): FreeDemoState {
  return { ...s, group: { name: name.trim() || 'הקבוצה שלנו', emoji }, screen: { kind: 'intro' } };
}

export function freePickLetter(s: FreeDemoState, letter: string): FreeDemoState {
  return { ...s, pendingLetter: letter };
}

function fallAsleep(s: FreeDemoState, gnomeId: string, now: number, patch: Partial<FreeGnomeProgress>): Record<string, FreeGnomeProgress> {
  const p = s.gnomes[gnomeId];
  return {
    ...s.gnomes,
    [gnomeId]: { ...p, ...patch, wrongs: 0, asleepUntil: wakeTimeFrom(now), riddleIndex: p.riddleIndex + 1 },
  };
}

export function freeSubmitLetter(s: FreeDemoState, realNow: number): FreeDemoState {
  if (s.screen.kind !== 'riddle' || !s.pendingLetter) return s;
  const gnomeId = s.screen.gnomeId;
  const riddle = currentRiddle(s, gnomeId);
  if (!riddle) return s;
  const now = demoNow(s, realNow);
  const p = s.gnomes[gnomeId];
  const match = matchLetter(s.pendingLetter, riddle.letter, ACCEPT_SOUND_ALIKE);

  if (match === 'wrong') {
    const wrongs = p.wrongs + 1;
    if (wrongs < ATTEMPTS_PER_RIDDLE) {
      return { ...s, streak: 0, pendingLetter: null, wrongTick: s.wrongTick + 1, gnomes: { ...s.gnomes, [gnomeId]: { ...p, wrongs } } };
    }
    const next = { ...s, streak: 0, pendingLetter: null, gnomes: fallAsleep(s, gnomeId, now, { last: 'failed', lastLetter: undefined }) };
    return { ...next, screen: { kind: 'failed', gnomeId, allAsleep: allAsleep(next, now) } };
  }

  const half = p.wrongs > 0;
  const wasHot = isHot(s);
  const streak = s.streak + 1;
  // As the engine: doubled once the streak BEFORE this answer reached HOT_STREAK_AT (the 4th on).
  const hot = streak >= HOT_STREAK_AT;
  const base = Math.round(POINTS_PER_RIDDLE * (half ? SECOND_ATTEMPT_FACTOR : 1));
  const points = wasHot ? base * HOT_MULTIPLIER : base;
  const next: FreeDemoState = {
    ...s,
    streak,
    points: s.points + points,
    pendingLetter: null,
    letters: [...s.letters, { letter: riddle.letter, gnomeId }],
    gnomes: fallAsleep(s, gnomeId, now, { last: half ? 'half' : 'full', lastLetter: riddle.letter }),
  };
  return {
    ...next,
    screen: { kind: 'correct' },
    correct: {
      gnomeId, letter: riddle.letter, answerWord: riddle.answerWord, points, half, hot, becameHot: hot && !wasHot,
      spellingTip: match === 'soundAlike' ? `כמעט! ${riddle.answerWord} כותבים ב־${riddle.letter}׳` : undefined,
      allAsleep: allAsleep(next, now),
    },
  };
}

/** Buy the location hint of one gnome (only when the group can pay — points never go negative). */
export function freeBuyHint(s: FreeDemoState, gnomeId: string): FreeDemoState {
  const p = s.gnomes[gnomeId];
  if (!p || p.hintBought || s.points < HINT_COST) return s;
  return { ...s, points: s.points - HINT_COST, gnomes: { ...s.gnomes, [gnomeId]: { ...p, hintBought: true } } };
}

export const freeOpenGnome = (s: FreeDemoState, gnomeId: string): FreeDemoState => ({ ...s, screen: { kind: 'gnome', gnomeId } });
export const freeOpenScanner = (s: FreeDemoState): FreeDemoState => ({ ...s, screen: { kind: 'scanner', error: null } });

/** Back to the board — or to the finish when every gnome sleeps. */
export function freeToBoard(s: FreeDemoState, realNow: number): FreeDemoState {
  if (!s.group) return s;
  const kind = allAsleep(s, demoNow(s, realNow)) ? 'finished' : 'board';
  return { ...s, pendingLetter: null, screen: { kind } };
}

export const freeShowBoard = (s: FreeDemoState): FreeDemoState => ({ ...s, pendingLetter: null, screen: s.group ? { kind: 'board' } : s.screen });

export const freeShowIntro = (s: FreeDemoState): FreeDemoState => (s.group ? { ...s, screen: { kind: 'intro' } } : s);

export const freeToggleMute = (s: FreeDemoState): FreeDemoState => ({ ...s, muted: !s.muted });

// ------------------------------------------------ demo bar only

/** "We registered at the screen" — skips the walk to the big screen. */
export const freeDemoGoRegister = (s: FreeDemoState): FreeDemoState => ({ ...s, screen: { kind: 'register' } });

/** Jump the demo clock forward. Sleeping gnomes whose time passed are awake with their next riddle. */
export function freeDemoJump(s: FreeDemoState, ms: number, realNow: number): FreeDemoState {
  const next = { ...s, offsetMs: s.offsetMs + ms };
  // Standing on the finish or a sleeping gnome's screen: go back to the board if something woke.
  if (next.screen.kind === 'finished' && !allAsleep(next, demoNow(next, realNow))) return { ...next, screen: { kind: 'board' } };
  if (next.screen.kind === 'asleep' && !isAsleep(next.gnomes[next.screen.gnomeId], demoNow(next, realNow))) return { ...next, screen: { kind: 'board' } };
  return next;
}

/** Ms until the next sleeping gnome wakes, or null when all are awake. */
export function msToNextWake(s: FreeDemoState, realNow: number): number | null {
  const now = demoNow(s, realNow);
  const times = FREE_GNOMES.map((g) => s.gnomes[g.id].asleepUntil).filter((t): t is number => t !== null && t > now);
  return times.length ? Math.min(...times) - now : null;
}

/** Puts every awake gnome but one to sleep with a solved riddle — to reach the finish quickly. */
export function freeDemoSolveAllBut(s: FreeDemoState, keep: number, realNow: number): FreeDemoState {
  const now = demoNow(s, realNow);
  let next = s.group ? s : { ...s, group: { name: 'הגמדים העליזים', emoji: '🍄' } };
  let left = FREE_GNOMES.filter((g) => !isAsleep(next.gnomes[g.id], now)).length;
  for (const g of FREE_GNOMES) {
    if (left <= keep) break;
    if (isAsleep(next.gnomes[g.id], now)) continue;
    const r = currentRiddle(next, g.id)!;
    next = {
      ...next,
      points: next.points + POINTS_PER_RIDDLE,
      letters: [...next.letters, { letter: r.letter, gnomeId: g.id }],
      gnomes: fallAsleep(next, g.id, now, { last: 'full', lastLetter: r.letter }),
    };
    left--;
  }
  return { ...next, screen: allAsleep(next, now) ? { kind: 'finished' } : { kind: 'board' } };
}

/** Caption for the demo bar: what to try on this screen. */
export function freeDemoCaption(s: FreeDemoState): string {
  switch (s.screen.kind) {
    case 'startAtScreen': return 'קבוצה שעוד לא נרשמה סרקה גמד. בהדגמה: "נרשמנו במסך" ממשיך להרשמה.';
    case 'register': return 'ההרשמה עצמה (במשחק האמיתי אחרי סריקת הקוד שעל המסך הגדול).';
    case 'intro': return 'משבצת לסרטון ההסבר של קליוסטרו. סרטון אמיתי: ‎?intro=כתובת';
    case 'board': return 'הקישו על גמד ער כדי לסרוק אותו או לקנות רמז למקום שלו.';
    case 'gnome': return 'בהדגמה "מצאנו! סרקו" פותח את החידה מיד. בטלפון אמיתי נפתחת המצלמה.';
    case 'scanner': return 'מצלמה מדומה: סרקו גמד מהכפתורים למטה, או הקלידו קוד 101 עד 116.';
    case 'riddle': return 'נסו תשובה נכונה, או אות לא נכונה פעם אחת (חצי נקודות) ופעמיים (הגמד נרדם).';
    case 'correct': return 'הגמד נרדם לקבוצה הזו. קפיצה בזמן תעיר אותו עם חידה חדשה.';
    case 'failed': return 'שתי טעויות: הגמד נרדם בלי נקודות ובלי הורדה.';
    case 'asleep': return 'סריקה של גמד ישן. קפיצה בזמן תעיר אותו.';
    case 'finished': return 'כל הגמדים ישנים. משבצת לסרטון "כל הכבוד" (‎?welldone=כתובת). קפיצה בזמן מעירה אותם.';
  }
}
