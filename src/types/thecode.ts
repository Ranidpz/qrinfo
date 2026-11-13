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
  /** The spot is outdoors (sun, rain). Gnomes there are printed from the weather-proof
   *  material, which comes in fewer colours — see THECODE_PALETTE in the engine. */
  outdoor?: boolean;
  isActive: boolean;
}

/**
 * Named colour (hex + names: src/components/thecode/GnomeFigure.tsx). This is every
 * colour a stored gnome may HAVE; what an operator may CHOOSE today is narrower — the
 * filaments the gnomes are really printed from: THECODE_PALETTE in the engine
 * (indoor / outdoor). `orange` is legacy: still rendered, no longer offered.
 */
export type TheCodeColor =
  | 'red' | 'blue' | 'green' | 'yellow' | 'black' | 'white' | 'purple' | 'orange'
  | 'grey' | 'brown';

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
  arrangeHelpCost: number;          // "Place one letter for us" while arranging the phrase
}

/** Presenter moments. Each may have several clips; text/animation is the fallback. */
export type TheCodeTrigger =
  | 'WELCOME' | 'START' | 'NEW_CLUE' | 'CORRECT' | 'WRONG_ANSWER' | 'HINT'
  | 'WRONG_GNOME' | 'HALFWAY' | 'CODE_READY' | 'SUITCASE_OPEN' | 'RETURN_PLAYER'
  | 'ALL_DONE';

/**
 * The venue's own look for the OPENING screen (scan → register / log in). Public by
 * nature: a family sees it before it has a name. Once the family is in, the game wears
 * our own brand. All optional — without it the opening screen keeps the default look.
 */
export interface TheCodeBranding {
  /** Full-bleed photo or graphic of the venue behind the opening screen (R2). */
  backgroundUrl?: string;
  /** The venue's logo; a transparent PNG looks best. */
  logoUrl?: string;
  /** One or two lines under the title. Absent = a default built from the title. */
  welcomeText?: string;
  /** What fills the opening screen behind the title (Rani 13.11.2026). Absent = 'image' when
   *  `backgroundUrl` is set, else the default look. 'video' = `backgroundVideoUrl`, muted loop. */
  backgroundType?: 'image' | 'color' | 'gradient' | 'video';
  /** '#RRGGBB'. 'color' uses `backgroundColor`; 'gradient' runs `gradientFrom` (top) → `gradientTo`. */
  backgroundColor?: string;
  gradientFrom?: string;
  gradientTo?: string;
  /** R2 mp4/webm, ≤ 30 MB, shown muted in a loop (uploaded through lobby-video-url, slot 'opening'). */
  backgroundVideoUrl?: string;
  /** '#RRGGBB' for the title + welcome line, and for the main button (its text colour is picked
   *  for contrast). Absent = the default look. */
  textColor?: string;
  buttonColor?: string;
}

/**
 * Group selfie as the group's symbol (wave 3, Rani 13.11.2026). Camera only, never the
 * gallery; a consent line before the shot. Photos are personal data (often children):
 * they are deleted `retentionDays` after they were taken, and the operator can remove
 * one at any time or switch selfies off. Resolve with `resolveSelfie()` — absent = on, 14 days.
 */
export interface TheCodeSelfieSettings {
  enabled: boolean;
  /** 1–90. Photos older than this are removed by the daily sweep. */
  retentionDays: number;
}

/**
 * The big screen (`/lobby/thecode/{shortId}`). Three full-screen video slots (R2, mp4/webm,
 * ≤ 100 MB, with sound): `idle` loops while waiting; a scan of the on-screen QR plays
 * `explain` ONCE (further scans while it runs never restart it), then "צאו לדרך!", then
 * `after` loops until the next scan. Any slot may be empty → the drawn placeholder scene.
 */
export interface TheCodeLobbySettings {
  videos?: { idle?: string; explain?: string; after?: string };
}

/**
 * The ONLY part of an adventure that is world-readable: a stub on the code's media
 * item (`thecodeConfig`), kept in sync by the server on every admin save. Everything
 * else (spots, gnomes, phrases, rules, riddles) is server-only — see TheCodeConfig.
 */
export interface TheCodePublicConfig {
  title: string;
  status: 'draft' | 'published' | 'paused';
  language: TheCodeLanguage;
  branding?: TheCodeBranding;
}

/**
 * The full adventure config. SERVER-ONLY: lives in the locked doc
 * `codes/{codeId}/thecode/adventure` together with the riddles, never on the code
 * doc (code docs are world-readable, and the phrases ARE the secret). Players only
 * ever see a `TheCodeSnapshot` (src/types/thecode-api.ts).
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
  /** Venue look of the opening screen; mirrored to the public stub on every save. */
  branding?: TheCodeBranding;
  /** "איך משחקים" — the operator's own short rules, one line each (max 8 × 160).
   *  Absent / empty = the default built from `rules` (src/lib/thecode/howToPlay.ts). */
  howToPlay?: string[];
  /** Look of the "איך משחקים" sheet — a few ready themes, always readable. Absent = 'night'.
   *  'brand' takes `branding.buttonColor` (falls back to 'night' without one). */
  howToPlayTheme?: 'night' | 'light' | 'brand';
  retentionDays: number;            // Player data auto-delete after inactivity
  /** Group selfies. Absent = enabled, 14 days (resolveSelfie). */
  selfie?: TheCodeSelfieSettings;
  /** Big-screen videos. Absent = the drawn placeholder scenes. */
  lobby?: TheCodeLobbySettings;
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
  /** Set when the family scanned this slot's gnome as the target. The riddle is
   *  only shown — and an answer only accepted — once this is set. */
  scannedAt?: number;
  /** When the letter was won/gifted. The collector lists letters in THIS order,
   *  never in phrase order (positions would give the phrase away). */
  solvedAt?: number;
}

/** One suitcase attempt: a saved, always-completable plan. */
export interface TheCodeRun {
  id: string;
  phraseId: string;
  /** Snapshot of the phrase text when the run was built. Arranging and opening use
   *  THIS, so editing or deleting the phrase never strands a family mid-run. */
  phraseText?: string;
  /** Phrase positions revealed by the paid "place one for us" help. */
  helpedPositions?: number[];
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
  /** The group selfie (R2). Replaces `emoji` wherever the group is shown while present.
   *  `key` = the R2 object key (for deletion). Removed by the sweep after
   *  `selfie.retentionDays`, by the operator, or when the group is deleted. */
  photo?: { url: string; key: string; takenAt: number };
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
  | { kind: 'paused' }                                           // Adventure paused/closed
  | { kind: 'runStarted'; targetSlotIndex: number }              // New suitcase; this gnome is not in it → show the first target
  | { kind: 'arranging' }                                        // All letters collected → go arrange
  | { kind: 'unknownGnome' };                                    // Code is not a gnome of this adventure

export type TheCodeAnswerOutcome =
  | { kind: 'correct'; letter: string; points: number; hot: boolean;
      /** This answer made the family hot (the ×N moment). */
      becameHot: boolean; spellingTip?: string;
      /** 'arranging' = that was the last letter. */
      runState: TheCodeRun['state'] }
  | { kind: 'wrong'; penalty: number; cooldownUntil?: number; hintAvailable: boolean }
  | { kind: 'cooldown'; cooldownUntil: number }
  | { kind: 'paused' }
  | { kind: 'noRiddle' };                                        // Nothing to answer (not scanned / not the target)

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
    | 'GNOMES_CLUSTERED'           // (almost) every gnome stands at one spot
    | 'GNOME_COLOR_UNAVAILABLE'    // a colour that is not printed for this kind of spot (indoor / outdoor)
    | 'FEW_FRESH_ROUNDS';          // a family runs out of new content quickly
  message: string;                  // Operator-facing, in the adventure language
  phraseId?: string;
  gnomeId?: string;
  spotId?: string;
  riddleId?: string;
  letter?: string;
  need?: number;
  have?: number;
  /** PHRASE_LETTER_MISSING: riddles that WOULD supply the letter but are draft /
   *  disabled / on a switched-off gnome — the operator's fastest fix. */
  dormantRiddleIds?: string[];
}

// -----------------------------------------------------------------
// Operator-only views (never sent to players)
// -----------------------------------------------------------------

export interface TheCodeGnomeStats {
  scans: number;
  lastScanAt?: number;
}

export interface TheCodeRiddleStats {
  correct: number;
  wrong: number;
  hints: number;
}

/** What the operator sees of a family. Never a phone, never a token. */
export interface TheCodeAdminPlayer {
  id: string;
  familyName: string;
  /** The name the family registered with, kept when the operator renames it. */
  originalName?: string;
  emoji: string;
  /** The group selfie (still within retention), shown instead of `emoji`. */
  photoUrl?: string;
  hidden: boolean;
  points: number;
  weekPoints: number;
  suitcases: number;
  weekSuitcases: number;
  lastSeenAt: number;
}
