// ============ הקוד (The Code) — spatial gnome adventure ============
// Shared contract for the engine, the server and both UIs. TYPES ONLY — no runtime
// values live here (tests transpile single files; values belong in src/lib/thecode/*).
// Full product + engineering spec: docs/THE_CODE_PLAN.md

export type TheCodeLanguage = 'he' | 'en';

// -----------------------------------------------------------------
// Physical world
// -----------------------------------------------------------------

/** A place in the venue ("under the piano"). Several gnomes can stand at one spot. */
export interface TheCodeSpot {
  id: string;
  name: string;                 // Operator-facing name, never shown as-is to players
  photoUrl?: string;            // Operator's photo of the place (R2)
  /** Graded hints leading a family TO this spot: [zone, closer, exact]. 1–3 entries. */
  hints: string[];
  safetyNote?: string;          // Operator-only note ("near stairs — hold hands")
  isActive: boolean;
}

/** Named colour from the fixed palette (hex + names: src/components/thecode/GnomeFigure.tsx). */
export type TheCodeColor =
  | 'red' | 'blue' | 'green' | 'yellow' | 'black' | 'white' | 'purple' | 'orange';

/**
 * A physical gnome: a fixed QR that never changes. A gnome is a PLACE to ask a
 * riddle at, not a riddle and not a letter. Its two colours tell it apart from the
 * decoys standing next to it.
 */
export interface TheCodeGnome {
  id: string;
  number: number;               // Human number embossed on the figure (1..n)
  code: string;                 // QR payload slug → /g/{code}; crypto-random, permanent
  manualCode: string;           // Short code printed under the QR for manual entry
  spotId: string;
  bodyColor: TheCodeColor;
  hatColor: TheCodeColor;
  isActive: boolean;            // Off = missing/broken; engine swaps or gifts its letter
  verifiedOnSite?: boolean;     // Operator scanned it in place during setup
}

// -----------------------------------------------------------------
// Content (riddles hold answers → server-only, locked collection)
// -----------------------------------------------------------------

export type TheCodeRiddleType = 'observe' | 'physicalLetter' | 'find';
export type TheCodeRiddleStatus = 'draft' | 'published' | 'disabled';

export interface TheCodeRiddle {
  id: string;
  gnomeId: string;
  type: TheCodeRiddleType;
  text: string;                 // The riddle shown to the family
  imageUrl?: string;
  /** The full answer word ("כובע"). The collector letter is its first letter. */
  answerWord: string;
  /** Normalized first letter of answerWord (see letterOfAnswer). Stored, not typed. */
  letter: string;
  /** Accept a letter that sounds the same (ק for כ) with a gentle spelling tip. */
  acceptSoundAlike: boolean;
  /** Graded hints for SOLVING the riddle (0–3). */
  hints: string[];
  difficulty: 1 | 2 | 3;
  status: TheCodeRiddleStatus;
}

/** A secret phrase a suitcase is locked with ("נוף גנוסר"). */
export interface TheCodePhrase {
  id: string;
  text: string;
  isActive: boolean;
}

// -----------------------------------------------------------------
// Rules (all tunable by the operator; defaults live in the engine)
// -----------------------------------------------------------------

export interface TheCodeRules {
  pointsPerLetter: number;          // Correct answer
  suitcaseBonus: number;            // Opening a suitcase
  hotStreakAt: number;              // Correct answers in a row to become "hot"
  hotMultiplier: number;            // Points multiplier while hot
  hintCost: number;                 // Each hint after the free one
  freeWrongScans: number;           // 1–3 free wrong gnome scans per target
  wrongScanPenalty: number;         // Points lost per wrong scan after the free ones
  freeWrongAnswers: number;         // Wrong letters before penalty + cooldown kick in
  wrongAnswerPenalty: number;
  answerCooldownSeconds: number;    // Wait between attempts once past freeWrongAnswers
}

/** Presenter moments. Each may have several clips; text/animation is the fallback. */
export type TheCodeTrigger =
  | 'WELCOME' | 'START' | 'NEW_CLUE' | 'CORRECT' | 'WRONG_ANSWER' | 'HINT'
  | 'WRONG_GNOME' | 'HALFWAY' | 'CODE_READY' | 'SUITCASE_OPEN' | 'RETURN_PLAYER'
  | 'ALL_DONE';

/**
 * Public adventure config — stored on the code's media item (`thecodeConfig`).
 * NEVER contains riddles or answers (codes are world-readable).
 */
export interface TheCodeConfig {
  status: 'draft' | 'published' | 'paused';
  title: string;                    // Venue-facing title ("הקוד — נוף גנוסר")
  language: TheCodeLanguage;
  spots: TheCodeSpot[];
  gnomes: TheCodeGnome[];
  phrases: TheCodePhrase[];
  rules: TheCodeRules;
  requirePhoneVerification: boolean;      // Operator toggle: parent WhatsApp OTP
  activeHours?: { from: string; to: string };  // "08:00"–"21:00", venue local time
  presenterVideos?: Partial<Record<TheCodeTrigger, string[]>>;
  retentionDays: number;            // Player data auto-delete after inactivity
}

// -----------------------------------------------------------------
// Player state (server-only, locked collection)
// -----------------------------------------------------------------

export type TheCodeSlotStatus = 'pending' | 'active' | 'solved' | 'gifted';

/** One letter of the phrase, bound to the gnome + riddle that yields it. */
export interface TheCodeSlot {
  index: number;                    // Position in the phrase letters (0-based)
  letter: string;                   // Normalized letter this slot needs
  gnomeId: string;
  riddleId: string;
  status: TheCodeSlotStatus;
  riddleHintsUsed: number;
  locationHintsUsed: number;        // 1 = the free zone hint
  wrongAnswers: number;
  lastWrongAnswerAt?: number;
  pointsEarned: number;
}

/** One suitcase attempt: a saved, always-completable plan. */
export interface TheCodeRun {
  id: string;
  phraseId: string;
  slots: TheCodeSlot[];
  /** Slot the family is currently sent to; null once every slot is solved/gifted. */
  targetSlotIndex: number | null;
  /** Distinct wrong gnomes scanned while hunting the current target. */
  wrongGnomeIdsOnTarget: string[];
  state: 'collecting' | 'arranging' | 'opened';
  startedAt: number;
  openedAt?: number;
}

export interface TheCodePlayer {
  id: string;                       // crypto-random
  familyName: string;
  emoji: string;
  recoveryCode: string;             // Short code to restore on another device
  phone?: string;                   // +972… only when requirePhoneVerification
  hidden?: boolean;                 // Operator hid this name from the public board
  points: number;
  streak: number;                   // Current correct-in-a-row
  suitcasesOpened: number;
  openedPhraseIds: string[];
  solvedRiddleIds: string[];
  foundGnomeIds: string[];          // The "gnome album"
  run: TheCodeRun | null;
  createdAt: number;
  lastSeenAt: number;
}

// -----------------------------------------------------------------
// Engine results (what the UI renders)
// -----------------------------------------------------------------

export type TheCodeScanOutcome =
  | { kind: 'riddle'; slotIndex: number }                       // Right gnome → show riddle
  | { kind: 'wrongGnome'; penalty: number; freeLeft: number }   // "נא נא"
  | { kind: 'alreadySolved' }                                    // Solved earlier this run
  | { kind: 'gnomeAsleep' }                                      // Inactive gnome
  | { kind: 'allDone' }                                          // Nothing new to play
  | { kind: 'paused' };                                          // Adventure paused/closed

export type TheCodeAnswerOutcome =
  | { kind: 'correct'; letter: string; points: number; hot: boolean; spellingTip?: string;
      runState: TheCodeRun['state'] }
  | { kind: 'wrong'; penalty: number; cooldownUntil?: number; hintAvailable: boolean }
  | { kind: 'cooldown'; cooldownUntil: number };

/** Why an adventure (or one phrase) cannot be published — shown to the operator. */
export interface TheCodeIssue {
  severity: 'error' | 'warning';
  code:
    | 'PHRASE_LETTER_MISSING'      // not enough gnomes can yield this letter
    | 'PHRASE_INVALID_CHARS'
    | 'PHRASE_TOO_SHORT'
    | 'NO_ACTIVE_PHRASE'
    | 'GNOME_WITHOUT_RIDDLE'
    | 'GNOME_SPOT_MISSING'
    | 'DUPLICATE_COLORS_AT_SPOT'   // two identical-looking gnomes side by side
    | 'CONFUSABLE_COLORS_AT_SPOT'  // red/green pair — colour-blind risk
    | 'SPOT_WITHOUT_HINT'
    | 'RIDDLE_AMBIGUOUS_LETTER'    // answer starts with a sound-alike letter
    | 'GNOME_NOT_VERIFIED'
    | 'FEW_FRESH_ROUNDS';          // a family runs out of new content quickly
  message: string;                  // Operator-facing, in the adventure language
  phraseId?: string;
  gnomeId?: string;
  spotId?: string;
  riddleId?: string;
  letter?: string;
  need?: number;
  have?: number;
}
