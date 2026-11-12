// הקוד — the player UI's view model. Screens render THIS (state in) and report
// intents through PlayerCallbacks (callbacks out). They know nothing about where the
// state comes from: today the local demo (src/components/thecode/demo/playerDemo.ts),
// later the real API + engine. Keep it plain data — no functions, no classes.

import type { TheCodeColor } from '@/types/thecode';

export interface PlayerGnomeView {
  id: string;
  number: number;
  bodyColor: TheCodeColor;
  hatColor: TheCodeColor;
}

export interface PlayerProfileView {
  id: string;
  familyName: string;
  emoji: string;
  recoveryCode: string;
  points: number;
  streak: number;
  /** "שחקן חם": streak reached hotStreakAt → points are multiplied. */
  hot: boolean;
  suitcasesOpened: number;
}

export interface CollectorLetterView {
  letter: string;
  /** Gifted letters (a gnome went missing) are shown, but earned no points. */
  gifted?: boolean;
}

/**
 * The family's letter bag. Letters are listed in the order they were COLLECTED,
 * never in phrase order — showing positions would give the secret phrase away.
 */
export interface CollectorView {
  letters: CollectorLetterView[];
  total: number;
}

export interface TargetView {
  gnome: PlayerGnomeView;
  /** Location hints revealed so far (the first, zone hint, is always free). */
  hintsShown: string[];
  /** Cost of the next location hint, or null when there are no more. */
  nextHintCost: number | null;
  /** How many slots are already done — "letter 3 of 6". */
  slotNumber: number;
}

export interface RiddleView {
  gnome: PlayerGnomeView;
  text: string;
  imageUrl?: string;
  hintsShown: string[];
  nextHintCost: number | null;
  /** Bumps on every wrong letter — the screen shakes when it changes. */
  wrongTick: number;
  wrongCount: number;
  freeWrongAnswers: number;
  /** Epoch ms; while in the future the pad is locked. */
  cooldownUntil: number | null;
  /** Letter the family picked last; kept on screen across a failed submit. */
  pendingLetter: string | null;
  submitting: boolean;
}

export interface CorrectView {
  letter: string;
  points: number;
  hot: boolean;
  /** True on the answer that made the family hot (the ×2 moment). */
  becameHot: boolean;
  spellingTip?: string;
  /** True when this was the last missing letter → next is arranging. */
  lastLetter: boolean;
}

export interface ArrangeView {
  /** Collected letters in the order they sit in the tray (shuffled). */
  pool: string[];
  /** For each answer cell: the pool index placed there, or null. */
  placed: (number | null)[];
  /** Cells the "place one for me" help fixed — they cannot be removed. */
  locked: boolean[];
  wordLengths: number[];
  helpCost: number;
  /** Bumps on every wrong full arrangement — the board shakes. */
  wrongTick: number;
  /** The arrangement is right — the phrase is revealed and the suitcase can open. */
  solved: boolean;
}

export interface SuitcaseView {
  phraseText: string;
  bonus: number;
  suitcaseNumber: number;
}

export interface AlbumEntryView {
  gnome: PlayerGnomeView;
  found: boolean;
}

export interface LeaderRowView {
  id: string;
  familyName: string;
  emoji: string;
  points: number;
  /** 0-based rank before the latest change — the board animates from here. */
  prevRank: number;
  isMe: boolean;
}

export interface SummaryView {
  album: AlbumEntryView[];
  leaderboard: LeaderRowView[];
  /** False when every suitcase is open — the "new suitcase" button turns into the end state. */
  canStartNew: boolean;
}

export type PlayerScreen =
  | { kind: 'register'; mode: 'new' | 'recover'; recoverError?: string; firstGnome?: PlayerGnomeView }
  | { kind: 'target' }
  | { kind: 'riddle' }
  | { kind: 'correct' }
  | { kind: 'wrongGnome'; gnome: PlayerGnomeView; penalty: number; freeLeft: number }
  | { kind: 'alreadySolved'; gnome: PlayerGnomeView }
  | { kind: 'gnomeAsleep'; gnome: PlayerGnomeView }
  | { kind: 'arrange' }
  | { kind: 'suitcase' }
  | { kind: 'summary' }
  | { kind: 'allDone' }
  | { kind: 'paused' }
  | { kind: 'inAppBrowser' }
  | { kind: 'networkError' };

export interface PlayerState {
  screen: PlayerScreen;
  venueName: string;
  profile: PlayerProfileView | null;
  profiles: PlayerProfileView[];
  collector: CollectorView | null;
  target: TargetView | null;
  riddle: RiddleView | null;
  correct: CorrectView | null;
  arrange: ArrangeView | null;
  suitcase: SuitcaseView | null;
  summary: SummaryView | null;
  /** Hebrew or English letter pad. */
  alphabet: string[];
  muted: boolean;
}

export interface PlayerCallbacks {
  onRegister(familyName: string, emoji: string): void;
  onRecover(code: string): void;
  onRegisterMode(mode: 'new' | 'recover'): void;
  onLocationHint(): void;
  onRiddleHint(): void;
  onPickLetter(letter: string): void;
  onSubmitLetter(): void;
  /** Leave a result / warning screen (correct, wrong gnome, solved, asleep). */
  onContinue(): void;
  onArrangePlace(poolIndex: number): void;
  onArrangeRemove(cellIndex: number): void;
  onArrangeHelp(): void;
  onOpenSuitcase(): void;
  onShowSummary(): void;
  onNewSuitcase(): void;
  onSwitchProfile(profileId: string): void;
  onAddProfile(): void;
  onToggleMute(): void;
  onRetry(): void;
  onOpenInBrowser(): void;
  onDismissInAppBrowser(): void;
}
