// ============ הקוד (The Code) — wire contract between the UIs and the server ============
// TYPES ONLY. The server (src/app/api/thecode/**) implements these shapes; the player
// and the operator UIs code against them. Nobody changes this file but the plan owner
// — report a needed change instead. Architecture: docs/THE_CODE_PLAN.md §8.
//
// Golden rule: the phone never holds an answer. Everything a family sees comes from a
// `TheCodeSnapshot` built on the server; riddles' answers, phrase texts (until the
// suitcase is open) and other gnomes' riddles never leave the server.

import type {
  TheCodeAdminPlayer,
  TheCodeAnswerOutcome,
  TheCodeBranding,
  TheCodeColor,
  TheCodeConfig,
  TheCodeGnomeStats,
  TheCodeIssue,
  TheCodeLanguage,
  TheCodeRiddle,
  TheCodeRiddleStats,
  TheCodeScanOutcome,
} from './thecode';

// =================================================================
// Player — POST /api/thecode/play   (public; rate-limited per player)
// =================================================================

/** Device identity. Stored by the client in localStorage, per adventure. */
export interface TheCodeAuth {
  playerId: string;
  token: string;
}

export type TheCodePlayAction =
  /** Resume / refresh / tab focus. Works without auth (returns `player: null`). */
  | { type: 'state' }
  | { type: 'register'; familyName: string; emoji: string }
  | { type: 'recover'; recoveryCode: string }
  /** `code` = the QR payload slug (/g/{code}) OR the short manual code printed under it. */
  | { type: 'scan'; code: string }
  /** `slotIndex` = the slot the riddle was shown for (makes retries idempotent). */
  | { type: 'answer'; slotIndex: number; letter: string }
  | { type: 'hint'; hintKind: 'location' | 'riddle' }
  /** Paid help while arranging: the server fixes one more letter in its place. */
  | { type: 'arrangeHelp' }
  /** The family's full arrangement, one letter per phrase position. */
  | { type: 'open'; arrangement: string[] }
  /** Start the next suitcase from the summary screen (no gnome scanned). */
  | { type: 'newSuitcase' };

export interface TheCodePlayRequest {
  /** The adventure = the code document id. */
  codeId: string;
  auth?: TheCodeAuth;
  action: TheCodePlayAction;
}

export interface TheCodeGnomeView {
  id: string;
  number: number;
  bodyColor: TheCodeColor;
  hatColor: TheCodeColor;
}

export interface TheCodeRiddleView {
  text: string;
  imageUrl?: string;
  /** Riddle hints revealed so far. */
  hints: string[];
  /** Cost of the next riddle hint (0 = free), or null when there are no more. */
  nextHintCost: number | null;
  wrongAnswers: number;
  freeWrongAnswers: number;
  /** Server epoch ms; compare with `serverNow`, never with the phone's clock. */
  cooldownUntil: number | null;
}

export interface TheCodeTargetView {
  slotIndex: number;
  gnome: TheCodeGnomeView;
  /** Location hints revealed so far (the first, zone hint, is always there). */
  locationHints: string[];
  nextLocationHintCost: number | null;
  /** Free wrong scans still left for this target. */
  freeWrongScansLeft: number;
  /** null until the family scanned THIS gnome. */
  riddle: TheCodeRiddleView | null;
}

export interface TheCodeArrangeView {
  /** The collected letters in a stable shuffled order (same on every refresh). */
  pool: string[];
  wordLengths: number[];
  /** Per phrase position: the letter fixed by paid help, or null. */
  fixed: (string | null)[];
  helpCost: number;
}

export interface TheCodeRunView {
  state: 'collecting' | 'arranging' | 'opened';
  totalLetters: number;
  /** Letters won so far, in the order they were won (never phrase order). */
  collected: { letter: string; gifted: boolean }[];
  target: TheCodeTargetView | null;      // state === 'collecting'
  arrange: TheCodeArrangeView | null;    // state === 'arranging'
  /** state === 'opened': the phrase is finally revealed. */
  suitcase: { phraseText: string; bonus: number; suitcaseNumber: number } | null;
}

export interface TheCodePlayerView {
  id: string;
  familyName: string;
  emoji: string;
  /** The group selfie, when it has one — shown instead of `emoji`. */
  photoUrl?: string;
  recoveryCode: string;
  points: number;
  streak: number;
  /** "שחקן חם": the next correct answer is multiplied. */
  hot: boolean;
  suitcasesOpened: number;
}

export interface TheCodeSnapshot {
  adventure: {
    title: string;
    language: TheCodeLanguage;
    /** false = paused, draft or outside active hours → "המשחק בהפסקה". */
    open: boolean;
    hotMultiplier: number;
    /** Venue look of the opening (register / log in) screen. */
    branding?: TheCodeBranding;
    /** "איך משחקים" — always filled (the operator's lines or the default from the rules). */
    howToPlay: string[];
  };
  player: TheCodePlayerView | null;
  run: TheCodeRunView | null;
  /** Gnome album: only gnomes this family found are described; the rest stay silhouettes. */
  album: { found: TheCodeGnomeView[]; total: number };
  /** A fresh suitcase exists for this family (false → "פתחתם את כל המזוודות"). */
  canStartNew: boolean;
}

/** What just happened — drives the one-off animation. The snapshot is the truth. */
export type TheCodePlayEvent =
  | { type: 'registered' }
  | { type: 'recovered' }
  /** `gnome` = the gnome that was scanned (absent for unknownGnome). */
  | { type: 'scan'; outcome: TheCodeScanOutcome; gnome?: TheCodeGnomeView }
  | { type: 'answer'; outcome: TheCodeAnswerOutcome }
  | { type: 'hint'; hintKind: 'location' | 'riddle'; given: boolean; cost: number }
  | { type: 'arrangeHelp'; given: boolean; cost: number; position?: number; letter?: string }
  | { type: 'open'; opened: boolean; bonus: number }
  | { type: 'newSuitcase'; started: boolean };

export type TheCodePlayError =
  | 'notFound'          // no such adventure
  | 'unauthorized'      // unknown player / bad token → client drops the profile, shows register
  | 'needRegister'      // the action needs a player
  | 'invalidName'       // empty / too long / blocked word
  | 'recoveryNotFound'
  | 'rateLimited'
  | 'badRequest'
  | 'server';

export type TheCodePlayResponse =
  | {
      ok: true;
      /** Server clock (ms) at response time — the base for every countdown. */
      serverNow: number;
      /** Present after register / recover only: the client stores it. */
      auth?: TheCodeAuth;
      snapshot: TheCodeSnapshot;
      event?: TheCodePlayEvent;
    }
  | { ok: false; error: TheCodePlayError; retryAfterSeconds?: number };

// =================================================================
// Gnome lookup — GET /api/thecode/gnome?code=…   (public)
// Used by /g/{code} to find the adventure before anything else.
// =================================================================

export type TheCodeGnomeLookupResponse =
  | { ok: true; codeId: string; shortId: string; title: string; language: TheCodeLanguage;
      /** The scanned gnome itself — it is standing in front of the family anyway. */
      gnome: TheCodeGnomeView;
      /** Venue look of the opening screen, so /g/{code} is branded from the first paint. */
      branding?: TheCodeBranding;
      /** "איך משחקים", resolved like the snapshot's. */
      howToPlay: string[] }
  | { ok: false; error: 'notFound' };

// =================================================================
// Leaderboard — GET /api/thecode/leaderboard?codeId=…&scope=week|all&playerId=…
// (public; cached a few seconds; hidden families and zero-point families are left out)
// =================================================================

export interface TheCodeLeaderRow {
  id: string;
  familyName: string;
  emoji: string;
  /** The group selfie, when it has one and selfies are on. */
  photoUrl?: string;
  points: number;
  suitcases: number;
}

// -----------------------------------------------------------------
// Wave 3 — the big screen, live (Rani 13.11.2026)
// -----------------------------------------------------------------

/**
 * One "live moment" banner on the big screen. Rank changes are NOT events: the lobby
 * works them out itself by comparing two boards.
 */
export interface TheCodeLobbyEvent {
  id: string;
  kind: 'joined' | 'suitcase' | 'hot';
  familyName: string;
  emoji: string;
  photoUrl?: string;
  at: number;                       // ms epoch, server clock
}

/**
 * PUBLIC doc `codes/{codeId}/thecodeLobby/live` — the only thecode doc a browser reads
 * directly (rules: read true, write false; Admin SDK writes). The lobby listens with
 * onSnapshot, so a scan reaches the screen in about a second. No answers, phrases,
 * phones or recovery codes here — ever.
 */
export interface TheCodeLobbyLive {
  /** Bumped by every scan of the on-screen QR. The lobby starts the explainer when it
   *  changes while idle/after, and only counts it while the explainer runs. */
  lobbyScans: number;
  lastLobbyScanAt?: number;
  /** Newest last, at most 20. */
  events: TheCodeLobbyEvent[];
  /** Big-screen video slots, mirrored from TheCodeConfig.lobby on every admin save. */
  videos?: { idle?: string; explain?: string; after?: string };
}

/** POST /api/thecode/lobby-scan — called by /v/{shortId}?src=lobby. Public, rate-limited. */
export interface TheCodeLobbyScanRequest { codeId: string }

/**
 * POST /api/thecode/photo (multipart: codeId, token + playerId as in TheCodeAuth, file ≤ 400 KB
 * webp/jpeg, square, from the camera). Refused when selfies are off. DELETE with the same
 * auth removes the group's own photo. Operators remove a photo through the admin API.
 */
export interface TheCodePhotoResponse { ok: true; photoUrl: string | null }

export interface TheCodeLeaderboardResponse {
  ok: true;
  scope: 'week' | 'all';
  title: string;
  rows: TheCodeLeaderRow[];                       // top 20
  /** The asking family's own place when it is outside the top rows. */
  me?: { rank: number; points: number };
  serverNow: number;
}

// =================================================================
// Operator — /api/thecode/admin   (Bearer token + code ownership)
// =================================================================

/** GET /api/thecode/admin?codeId=… */
export interface TheCodeAdminLoadResponse {
  ok: true;
  /** Bumps on every save; send it back as `baseVersion`. 0 = never saved (defaults). */
  version: number;
  config: TheCodeConfig;
  riddles: TheCodeRiddle[];
  gnomeStats: Record<string, TheCodeGnomeStats>;
  riddleStats: Record<string, TheCodeRiddleStats>;
  players: TheCodeAdminPlayer[];
}

/**
 * PUT /api/thecode/admin — save the whole adventure (config + riddles) in one go.
 * The server normalizes (riddle `letter` re-derived from `answerWord`, gnome codes
 * immutable and globally unique), keeps the public stub on the code doc in sync and
 * REFUSES `status: 'published'` while `validateAdventure` reports an error.
 */
export interface TheCodeAdminSaveRequest {
  codeId: string;
  baseVersion: number;
  config: TheCodeConfig;
  riddles: TheCodeRiddle[];
}

export type TheCodeAdminSaveResponse =
  | { ok: true; version: number; config: TheCodeConfig; riddles: TheCodeRiddle[]; issues: TheCodeIssue[] }
  /** Someone else saved since `baseVersion` → reload. */
  | { ok: false; error: 'conflict'; version: number }
  /** Tried to publish with errors. Nothing was saved. */
  | { ok: false; error: 'invalid'; issues: TheCodeIssue[] }
  | { ok: false; error: 'badRequest' | 'server' };

/** PATCH /api/thecode/admin/players — rename or hide a family on the board. */
export interface TheCodeAdminPlayerPatchRequest {
  codeId: string;
  playerId: string;
  patch: { familyName?: string; hidden?: boolean };
}

/** DELETE /api/thecode/admin/players — body: remove one family for good. */
export interface TheCodeAdminPlayerDeleteRequest {
  codeId: string;
  playerId: string;
}

/**
 * Operator (requireCodeOwner, Bearer token): POST /api/thecode/admin/lobby-video-url
 * → a presigned R2 PUT for one big-screen slot (direct browser → R2, the 4.5 MB Vercel body
 * limit never applies). The admin then saves `TheCodeConfig.lobby.videos[slot] = publicUrl`
 * through the normal adventure save, which mirrors it to `TheCodeLobbyLive.videos`.
 */
export interface TheCodeLobbyVideoUrlRequest {
  codeId: string;
  slot: 'idle' | 'explain' | 'after';
  contentType: 'video/mp4' | 'video/webm';
  size: number;                     // bytes, ≤ 100 MB
}
export interface TheCodeLobbyVideoUrlResponse { ok: true; uploadUrl: string; publicUrl: string }

/** Operator: DELETE /api/thecode/admin/photo { codeId, playerId } → removes that group's selfie. */
export interface TheCodeAdminPhotoRemoveRequest { codeId: string; playerId: string }
