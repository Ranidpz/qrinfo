// קוד הגמדים — the free-game phone app's view model. The screens (FreeGamePlayer) render THIS;
// the demo (demo/freeDemo.ts → freeDemoView) and the live game (live/useTheCodeFreeGame.ts → the
// server snapshot) both build it. Plain data only.

import type { TheCodeBranding, TheCodeColor } from '@/types/thecode';
import type { NetworkProblem, PlayerGnomeView, SelfieShot } from '@/components/thecode/player/types';

export interface FreeGnomeView {
  id: string;
  number: number;
  bodyColor: TheCodeColor;
  hatColor: TheCodeColor;
  status: 'awake' | 'asleep' | 'noRiddles';
  /** Epoch ms on the view's clock (`FreeGameView.now`), with 'asleep'. */
  wakesAt?: number;
  last?: 'full' | 'half' | 'failed';
  /** Location hints bought so far; the price of the next (null = none left). */
  hints: string[];
  nextHintCost: number | null;
}

export interface FreeRiddleView {
  gnomeId: string;
  text: string;
  imageUrl?: string;
  wrongs: number;
  attempts: number;
}

export interface FreeCorrectView {
  gnomeId: string;
  letter: string;
  answerWord: string;
  points: number;
  secondTry: boolean;
  hot: boolean;
  becameHot: boolean;
  spellingTip?: string;
  wakesAt: number;
  allAsleep: boolean;
}

export type FreeScreenView =
  | { kind: 'loading' }
  | { kind: 'notFound' }
  | { kind: 'paused' }
  | { kind: 'network'; problem?: NetworkProblem; retryInSeconds?: number }
  /** A group scanned a gnome before registering: go to the big screen first. */
  | { kind: 'startAtScreen'; gnome: PlayerGnomeView | null }
  | { kind: 'register'; mode: 'new' | 'recover'; nameError?: string; recoverError?: string }
  /** Right after registering: "you are on the big screen!" while it celebrates the group. */
  | { kind: 'joined' }
  | { kind: 'intro' }
  | { kind: 'board' }
  | { kind: 'scanner'; error: string | null; camera: boolean; busy: boolean }
  | { kind: 'gnome'; gnomeId: string }
  | { kind: 'riddle' }
  | { kind: 'correct' }
  | { kind: 'failed'; gnomeId: string; wakesAt: number; allAsleep: boolean }
  | { kind: 'asleep'; gnomeId: string; wakesAt: number; last?: 'full' | 'half' | 'failed' }
  | { kind: 'noRiddles'; gnomeId: string }
  | { kind: 'finished' };

export interface FreeGameView {
  screen: FreeScreenView;
  /** The clock every countdown uses (the server clock in the live game, the demo clock in the demo). */
  now: number;
  venueName: string;
  group: { name: string; avatar: string } | null;
  points: number;
  streak: number;
  hot: boolean;
  hotStreakAt: number;
  gnomes: FreeGnomeView[];
  riddle: FreeRiddleView | null;
  pendingLetter: string | null;
  /** Bumps on every wrong letter (the riddle shakes). */
  wrongTick: number;
  submitting: boolean;
  correct: FreeCorrectView | null;
  solved: number;
  secondAttemptFactor: number;
  muted: boolean;
  /** Cliostro is calling (full-screen video call). */
  call: 'intro' | 'wellDone' | null;
  videos: { intro?: string | null; wellDone?: string | null };
  /** Where the big screen stands (start-at-screen hint). */
  screenHint?: string;
  branding?: TheCodeBranding | null;
  selfie?: { enabled: boolean; days: number } | null;
  /** Demo only: the on-screen "continue as if registered" button. */
  demo?: boolean;
}

export interface FreeGameCallbacks {
  onRegister(name: string, emoji: string, photo?: SelfieShot): void;
  onRecover?(code: string): void;
  onRegisterMode?(mode: 'new' | 'recover'): void;
  onOpenGnome(gnomeId: string): void;
  /** Demo: "scans" the gnome at once. Absent (live) → "מצאנו! סרקו" opens the camera. */
  onScanGnome?(gnomeId: string): void;
  onOpenScanner(): void;
  onScanCode(code: string): void;
  onBuyHint(gnomeId: string): void;
  onPickLetter(letter: string): void;
  onSubmitLetter(): void;
  /** Leave a result screen: to the board, or to the finish when every gnome sleeps. */
  onContinue(): void;
  /** Back to the board without an answer (leaving a riddle costs nothing). */
  onBoard(): void;
  onToggleMute(): void;
  onShowIntro(): void;
  onJoinedDone(): void;
  onEndCall(): void;
  onCallMagician(call: 'intro' | 'wellDone'): void;
  onRetry?(): void;
  /** Demo only. */
  onDemoRegistered?(): void;
}

/** "בעוד 42 דקות" / "בעוד שעה ו־5 דק׳" / "מחר ב־08:00". */
export function wakeLabel(until: number, now: number): string {
  const min = Math.max(1, Math.round((until - now) / 60_000));
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
