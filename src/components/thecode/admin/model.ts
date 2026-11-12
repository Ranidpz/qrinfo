// הקוד — admin UI contract (TYPES ONLY).
// Screens take these plain shapes as props. Today the demo (src/components/thecode/demo/adminDemo.ts)
// fills them from memory; in wave 2 the same shapes come from the store/API and the real engine
// (`validateAdventure` → TheCodeIssue[]), so the screens do not change.

import type {
  TheCodeColor,
  TheCodeConfig,
  TheCodeGnome,
  TheCodeIssue,
  TheCodePhrase,
  TheCodeRiddle,
  TheCodeRules,
  TheCodeSpot,
} from '@/types/thecode';

export interface GnomeStats {
  scans: number;
  lastScanAt?: number;
  verifiedAt?: number;
}

export interface RiddleStats {
  correct: number;
  wrong: number;
  hints: number;
}

/** What the operator sees of a family. Never a phone, never a full name. */
export interface AdminPlayer {
  id: string;
  familyName: string;
  /** The name the family registered with, kept when the operator renames it. */
  originalName?: string;
  emoji: string;
  hidden: boolean;
  points: number;
  weekPoints: number;
  suitcases: number;
  weekSuitcases: number;
  lastSeenAt: number;
}

export interface AdminState {
  config: TheCodeConfig;
  riddles: TheCodeRiddle[];
  gnomeStats: Record<string, GnomeStats>;
  riddleStats: Record<string, RiddleStats>;
  players: AdminPlayer[];
}

/** One letter of a phrase on the live letter board. */
export interface CoverageLetter {
  letter: string;          // normalized collector letter
  wordIndex: number;
  ok: boolean;             // got a distinct gnome in the matching
  have: number;            // distinct usable gnomes that can yield this letter
}

/** Why a phrase letter cannot be supplied, with what the operator can do about it. */
export interface MissingLetter {
  letter: string;
  need: number;
  have: number;
  /** have >= need, but the same gnomes are already needed for other letters of the phrase. */
  shared: boolean;
  /** Riddles for this letter that exist but are not usable (draft / disabled / gnome off). */
  dormant: { riddleId: string; gnomeId: string; gnomeNumber: number; why: 'draft' | 'disabled' | 'gnomeOff' | 'spotOff' }[];
}

export interface PhraseCoverage {
  letters: CoverageLetter[];
  wordLengths: number[];
  invalidChars: string[];
  tooShort: boolean;
  missing: MissingLetter[];
  playable: boolean;
  hasFinalForms: boolean;
}

export interface AdventureReport {
  issues: TheCodeIssue[];
  errors: number;
  warnings: number;
  /** Fresh suitcases ONE family can open before it runs out of unsolved riddles. */
  freshSuitcases: number;
  phrases: Record<string, PhraseCoverage>;
  /** Per letter used by playable phrases: how often phrases need it vs usable riddles for it. */
  letterStock: { letter: string; demand: number; supply: number }[];
}

export interface NewGnomeSpec {
  bodyColor: TheCodeColor;
  hatColor: TheCodeColor;
}

export type ConfigPatch = Partial<
  Pick<TheCodeConfig, 'title' | 'requirePhoneVerification' | 'activeHours' | 'retentionDays' | 'language'>
>;

/** Everything a screen may change. The demo implements it in memory; wave 2 → API calls. */
export interface AdminActions {
  setStatus(status: TheCodeConfig['status']): void;
  updateConfig(patch: ConfigPatch): void;
  updateRules(patch: Partial<TheCodeRules>): void;

  addSpot(): string;
  updateSpot(id: string, patch: Partial<Omit<TheCodeSpot, 'id'>>): void;
  deleteSpot(id: string): void;

  addGnomes(spotId: string, specs: NewGnomeSpec[]): string[];
  updateGnome(id: string, patch: Partial<Omit<TheCodeGnome, 'id' | 'code' | 'manualCode' | 'number'>>): void;
  deleteGnome(id: string): void;
  /** Setup mode: the operator scanned the gnome where it stands. */
  verifyGnome(id: string): void;

  addRiddle(gnomeId: string, answerWord?: string): string;
  /** Changing answerWord re-derives `letter` — the letter is never typed. */
  updateRiddle(id: string, patch: Partial<Omit<TheCodeRiddle, 'id' | 'gnomeId' | 'letter'>>): void;
  deleteRiddle(id: string): void;

  addPhrase(text: string): string;
  updatePhrase(id: string, patch: Partial<Omit<TheCodePhrase, 'id'>>): void;
  deletePhrase(id: string): void;

  updatePlayer(id: string, patch: Partial<Pick<AdminPlayer, 'familyName' | 'hidden'>>): void;

  reset(): void;
}

/** What every screen receives. */
export interface ScreenProps {
  state: AdminState;
  report: AdventureReport;
  actions: AdminActions;
  navigate: import('./nav').Navigate;
  /** Where the operator was sent (from a "fix" link); screens open/highlight it. */
  target: import('./nav').AdminTarget;
  /** Live coverage for a phrase that is not saved yet (the "add phrase" box). */
  coverageOf: (text: string) => PhraseCoverage;
  now: number;
}
