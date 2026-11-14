// הקוד — admin UI contract (TYPES ONLY).
// Screens take these plain shapes as props. The demo (src/components/thecode/demo/adminDemo.ts)
// fills them from sample data; the live admin (src/components/thecode/adminLive/*) from
// /api/thecode/admin. Both mutate through admin/reducer.ts and build the report with
// adminLive/report.ts (the real engine), so the screens do not know which one they run in.

import type {
  TheCodeAdminPlayer,
  TheCodeBranding,
  TheCodeColor,
  TheCodeGnomeStats,
  TheCodeRiddleStats,
  TheCodeConfig,
  TheCodeGnome,
  TheCodeIssue,
  TheCodePhrase,
  TheCodeRiddle,
  TheCodeRules,
  TheCodeSpot,
} from '@/types/thecode';

/** Contract shape (src/types/thecode.ts) + a local-only `verifiedAt` set by setup mode. */
export type GnomeStats = TheCodeGnomeStats & { verifiedAt?: number };
export type RiddleStats = TheCodeRiddleStats;
/** What the operator sees of a group (incl. its selfie `photoUrl`). Never a phone, never a full name. */
export type AdminPlayer = TheCodeAdminPlayer;

/** Big-screen slots + 'opening' = the venue opening screen's background video (≤ 30 MB). */
export type LobbySlot = 'idle' | 'explain' | 'after' | 'opening';

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
  Pick<TheCodeConfig, 'title' | 'requirePhoneVerification' | 'activeHours' | 'retentionDays' | 'language' | 'branding' | 'howToPlay' | 'selfie' | 'howToPlayTheme' | 'staff'>
>;

/** Everything a screen may change. The demo implements it in memory; wave 2 → API calls. */
export interface AdminActions {
  setStatus(status: TheCodeConfig['status']): void;
  updateConfig(patch: ConfigPatch): void;
  updateRules(patch: Partial<TheCodeRules>): void;
  /** Merges into the CURRENT branding (two uploads finishing together must not overwrite each
   *  other); empty fields are dropped, and a branding with nothing left becomes undefined. */
  updateBranding(patch: Partial<TheCodeBranding>): void;
  /** One big-screen video slot; merges into the CURRENT videos (parallel uploads). */
  updateLobbyVideo(slot: Exclude<LobbySlot, 'opening'>, url: string | undefined): void;

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
  /** Remove a family for good (the screen asks twice first). */
  deletePlayer(id: string): void;
  /** Remove a group's selfie (the server deletes the file). */
  removePlayerPhoto(id: string): void;

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
  /** Uploads one (already validated) image and resolves to its public URL. */
  uploadImage: ImageUploader;
  /** Uploads one big-screen video straight to storage; resolves to its public URL. */
  uploadVideo: VideoUploader;
  /** Where this adventure lives; absent in the demo (no code yet). */
  links?: AdminLinks;
  /** Re-fetch stats + families from the server; absent in the demo. */
  refresh?: AdminRefresh;
}

export interface AdminRefresh {
  run: () => void;
  busy: boolean;
  /** When stats were last fetched (ms). */
  at?: number;
}

export interface UploadOptions {
  /** Logos: keep transparency — sent as PNG, never re-encoded to lossy WebP/JPEG. */
  keepAlpha?: boolean;
}

export type VideoUploader = (slot: LobbySlot, file: File, onProgress: (fraction: number) => void) => Promise<string>;

export type ImageUploader = (file: File, onProgress: (fraction: number) => void, opts?: UploadOptions) => Promise<string>;

export interface AdminLinks {
  /** Game home for families: production origin + /v/{shortId}. */
  game: string;
  /** Big-screen leaderboard for the venue's TV. */
  lobby: string;
  /** The venue staff screen (WhatsApp-code login). Absent in the demo. */
  staff?: string;
  /** Who did what on the staff screen, newest first; null = could not load. */
  staffLog?: () => Promise<import('@/types/thecode-api').TheCodeStaffLogEntry[] | null>;
}
