// הקוד — server snapshot + the tab's own UI state → the PlayerState the screens render.
// Pure (no React, no I/O) so it can be tested on its own.
//
// The snapshot is the truth. The local UI only holds what the server does not care about:
// which one-off result screen is showing (a "flash"), the letter picked but not yet sent,
// the tiles placed on the arrange board, the open scanner, a failed request to retry.

import { alphabetFor } from '@/lib/thecode/letters';
import type { TheCodeBranding, TheCodeSelfieSettings } from '@/types/thecode';
import { resolveSelfie } from '@/lib/thecode/selfie';
import type { TheCodeGnomeView, TheCodeLeaderRow, TheCodeSnapshot } from '@/types/thecode-api';
import type { StoredIdentity } from './identity';
import type {
  ArrangeView,
  CorrectView,
  LeaderRowView,
  NetworkProblem,
  PlayerGnomeView,
  PlayerProfileView,
  PlayerScreen,
  PlayerState,
  SuitcaseView,
} from '../player/types';

export type Flash =
  | { kind: 'correct'; correct: CorrectView }
  | { kind: 'wrongGnome'; gnome: PlayerGnomeView; penalty: number; freeLeft: number }
  | { kind: 'alreadySolved'; gnome: PlayerGnomeView }
  | { kind: 'gnomeAsleep'; gnome: PlayerGnomeView }
  /** The arrangement was right: the board shows the phrase, the family taps "open". */
  | { kind: 'solved'; letters: string[]; wordLengths: number[] }
  | { kind: 'suitcase'; suitcase: SuitcaseView };

export interface LocalUi {
  flash: Flash | null;
  view: 'home' | 'scanner' | 'summary';
  /** Register screen forced on top (adding a sibling / recover / a dropped profile). */
  registering: { mode: 'new' | 'recover'; adding: boolean; recoverError?: string; nameError?: string } | null;
  pendingLetter: string | null;
  riddleWrongTick: number;
  arrangeWrongTick: number;
  /** For each arrange cell: the pool index placed there. */
  placed: (number | null)[];
  scannerError: string | null;
  failure: { problem: NetworkProblem; retryAt: number | null } | null;
  inAppGate: boolean;
  boardScope: 'week' | 'all';
}

export const INITIAL_UI: LocalUi = {
  flash: null,
  view: 'home',
  registering: null,
  pendingLetter: null,
  riddleWrongTick: 0,
  arrangeWrongTick: 0,
  placed: [],
  scannerError: null,
  failure: null,
  inAppGate: false,
  boardScope: 'week',
};

export interface BoardData {
  rows: TheCodeLeaderRow[];
  me?: { rank: number; points: number };
  /** 0-based ranks from the previous fetch of the same scope — the rows slide from there. */
  prevRanks: Record<string, number> | null;
}

export interface MapInput {
  snapshot: TheCodeSnapshot | null;
  ui: LocalUi;
  identity: StoredIdentity;
  storageAvailable: boolean;
  /** serverNow − Date.now() at the last response. */
  clockOffset: number;
  busy: 'answer' | 'scan' | 'other' | null;
  board: BoardData | null;
  /** The gnome a camera scan (/g/{code}) brought the family here with. */
  pendingGnome: TheCodeGnomeView | null;
  loaded: boolean;
  notFound: boolean;
  muted: boolean;
  /** Branding known before the snapshot (from the /g lookup) — the snapshot's wins once it arrives. */
  branding?: TheCodeBranding | null;
  /** "איך משחקים" lines known before the snapshot (from the /g lookup). */
  howToPlay?: string[];
  howToPlayTheme?: 'night' | 'light' | 'brand';
  /** Selfie settings known before the snapshot (the /g lookup). */
  selfie?: TheCodeSelfieSettings | null;
  /** A selfie taken on THIS phone, shown at once while it uploads (playerId → preview URL;
   *  `null` = the group just removed its photo). The server's photoUrl wins once it matches. */
  localPhotos?: Record<string, string | null>;
  photoBusy?: boolean;
}

/**
 * Selfie settings for the phone. The contract carries them on `adventure.selfie` (asked of the
 * plan owner 13.11.2026); until the server sends them we read the field defensively and fall
 * back to resolveSelfie's defaults (on, 14 days). A server refusal ('off') hides the camera.
 */
export function selfieOf(adventure: unknown, fallback?: TheCodeSelfieSettings | null): TheCodeSelfieSettings {
  const raw = (adventure && typeof adventure === 'object' ? (adventure as { selfie?: Partial<TheCodeSelfieSettings> }).selfie : undefined) ?? fallback ?? undefined;
  return resolveSelfie({ selfie: raw as TheCodeSelfieSettings | undefined });
}

const gnomeView = (g: TheCodeGnomeView): PlayerGnomeView => ({
  id: g.id, number: g.number, bodyColor: g.bodyColor, hatColor: g.hatColor,
});

/** Placeholder for an album slot the family has not found (drawn as a silhouette). */
const silhouette = (i: number): PlayerGnomeView => ({ id: `unfound-${i}`, number: 0, bodyColor: 'blue', hatColor: 'blue' });

/**
 * Keep the family's tiles where they put them, but honour the server's fixed cells
 * (paid help): a fixed cell holds a pool tile with that letter, taken from wherever it was.
 */
export function reconcilePlaced(pool: string[], fixed: (string | null)[], placed: (number | null)[]): (number | null)[] {
  const n = fixed.length;
  const out: (number | null)[] = Array.from({ length: n }, (_, i) => {
    const p = placed[i];
    return typeof p === 'number' && p >= 0 && p < pool.length ? p : null;
  });
  // Drop duplicates (a stale array after a new run).
  const seen = new Set<number>();
  for (let i = 0; i < n; i++) {
    const p = out[i];
    if (p === null) continue;
    if (seen.has(p)) out[i] = null;
    else seen.add(p);
  }
  // Fixed cells first: keep a matching tile, otherwise pull one in.
  const fixedUse = new Set<number>();
  for (let i = 0; i < n; i++) {
    const want = fixed[i];
    if (!want) continue;
    const cur = out[i];
    if (cur !== null && pool[cur] === want && !fixedUse.has(cur)) {
      fixedUse.add(cur);
      continue;
    }
    const candidates = pool.map((l, k) => k).filter((k) => pool[k] === want && !fixedUse.has(k));
    // Prefer a tile still in the tray, then one sitting in a non-fixed cell.
    const free = candidates.find((k) => !out.includes(k)) ?? candidates.find((k) => {
      const at = out.indexOf(k);
      return at >= 0 && !fixed[at];
    });
    if (free === undefined) continue;
    const at = out.indexOf(free);
    if (at >= 0) out[at] = null;
    out[i] = free;
    fixedUse.add(free);
  }
  return out;
}

function profileFromSnapshot(s: TheCodeSnapshot): PlayerProfileView | null {
  const p = s.player;
  if (!p) return null;
  return {
    id: p.id,
    familyName: p.familyName,
    emoji: p.emoji,
    recoveryCode: p.recoveryCode,
    points: p.points,
    streak: p.streak,
    hot: p.hot,
    suitcasesOpened: p.suitcasesOpened,
    photoUrl: p.photoUrl,
  };
}

function leaderRows(board: BoardData | null, myId: string | undefined): LeaderRowView[] {
  if (!board) return [];
  return board.rows.map((r, i) => ({
    id: r.id,
    familyName: r.familyName,
    emoji: r.emoji,
    points: r.points,
    photoUrl: r.photoUrl,
    prevRank: board.prevRanks ? (board.prevRanks[r.id] ?? board.rows.length) : i,
    isMe: r.id === myId,
  }));
}

function homeScreen(s: TheCodeSnapshot): PlayerScreen {
  const run = s.run;
  if (!run) return s.canStartNew ? { kind: 'summary' } : { kind: 'allDone' };
  if (run.state === 'arranging') return { kind: 'arrange' };
  if (run.state === 'opened') return s.canStartNew ? { kind: 'summary' } : { kind: 'allDone' };
  if (run.target?.riddle) return { kind: 'riddle' };
  if (run.target) return { kind: 'target' };
  return { kind: 'summary' };
}

export function buildPlayerState(m: MapInput): PlayerState {
  const s = m.snapshot;
  const ui = m.ui;
  const snapActive = s ? profileFromSnapshot(s) : null;
  // A just-taken selfie shows at once; a just-removed one disappears at once.
  const local = snapActive && m.localPhotos && snapActive.id in m.localPhotos ? m.localPhotos[snapActive.id] : undefined;
  const active = snapActive && local !== undefined ? { ...snapActive, photoUrl: local ?? undefined } : snapActive;
  const profiles: PlayerProfileView[] = m.identity.profiles.map((p) => (
    active && p.playerId === active.id ? active : {
      id: p.playerId,
      familyName: p.familyName,
      emoji: p.emoji,
      recoveryCode: p.recoveryCode ?? '',
      points: p.points ?? 0,
      streak: 0,
      hot: false,
      suitcasesOpened: 0,
    }
  ));
  const profile = active && m.identity.activeId === active.id ? active : null;

  const base: PlayerState = {
    screen: { kind: 'loading' },
    venueName: s?.adventure.title || 'המקום',
    profile,
    profiles,
    collector: null,
    target: null,
    riddle: null,
    correct: null,
    arrange: null,
    suitcase: null,
    summary: null,
    scanner: null,
    storageWarning: !m.storageAvailable && !!profile,
    alphabet: alphabetFor(s?.adventure.language === 'en' ? 'en' : 'he'),
    muted: m.muted,
    branding: s?.adventure.branding ?? m.branding ?? null,
    howToPlay: s?.adventure.howToPlay?.length ? s.adventure.howToPlay : m.howToPlay,
    howToPlayTheme: s?.adventure.howToPlayTheme ?? m.howToPlayTheme,
    selfie: (() => {
      const st = selfieOf(s?.adventure, m.selfie);
      return { enabled: st.enabled, days: st.retentionDays };
    })(),
    photoBusy: m.photoBusy,
  };

  if (ui.inAppGate) return { ...base, screen: { kind: 'inAppBrowser' } };
  if (m.notFound) {
    return { ...base, screen: { kind: 'notFound', title: 'המשחק לא נמצא', text: 'נראה שהמשחק הזה כבר לא פעיל. שאלו בקבלה.' } };
  }
  if (ui.failure) {
    const retryIn = ui.failure.retryAt ? Math.max(0, Math.ceil((ui.failure.retryAt - Date.now()) / 1000)) : undefined;
    return { ...base, screen: { kind: 'networkError', problem: ui.failure.problem, retryInSeconds: retryIn } };
  }
  if (!m.loaded || !s) return base;

  // ---- data every screen may use
  const run = s.run;
  if (run) {
    base.collector = { letters: run.collected.map((c) => ({ letter: c.letter, gifted: c.gifted })), total: run.totalLetters };
    const t = run.target;
    if (t) {
      base.target = {
        gnome: gnomeView(t.gnome),
        hintsShown: t.locationHints,
        nextHintCost: t.nextLocationHintCost,
        slotNumber: Math.min(run.collected.length + 1, run.totalLetters),
      };
      // Forward-compatible: the place's player-facing name, once the contract carries it
      // (proposed `TheCodeTargetView.spotName`). Until then nothing is shown.
      const placeName = (t as { spotName?: unknown }).spotName;
      if (typeof placeName === 'string' && placeName.trim()) base.target.placeName = placeName.trim();
      if (t.riddle) {
        const r = t.riddle;
        base.riddle = {
          gnome: gnomeView(t.gnome),
          text: r.text,
          imageUrl: r.imageUrl,
          hintsShown: r.hints,
          nextHintCost: r.nextHintCost,
          wrongTick: ui.riddleWrongTick,
          wrongCount: r.wrongAnswers,
          freeWrongAnswers: r.freeWrongAnswers,
          // Server clock → phone clock, so the countdown is right even when the phone's clock is off.
          cooldownUntil: r.cooldownUntil !== null ? r.cooldownUntil - m.clockOffset : null,
          pendingLetter: ui.pendingLetter,
          submitting: m.busy === 'answer',
        };
      }
    }
    if (run.arrange) {
      const a = run.arrange;
      const placed = reconcilePlaced(a.pool, a.fixed, ui.placed.length === a.fixed.length ? ui.placed : a.fixed.map(() => null));
      const arrange: ArrangeView = {
        pool: a.pool,
        placed,
        locked: a.fixed.map((f) => f !== null),
        wordLengths: a.wordLengths,
        helpCost: a.helpCost,
        wrongTick: ui.arrangeWrongTick,
        solved: false,
      };
      base.arrange = arrange;
    }
    if (run.suitcase) base.suitcase = { ...run.suitcase };
  }
  const found = s.album.found.map((g) => ({ gnome: gnomeView(g), found: true }));
  const missing = Math.max(0, s.album.total - found.length);
  base.summary = {
    album: [...found, ...Array.from({ length: missing }, (_, i) => ({ gnome: silhouette(i), found: false }))],
    leaderboard: leaderRows(m.board, profile?.id),
    boardScope: ui.boardScope,
    meOutside: m.board?.me,
    canStartNew: s.canStartNew,
  };

  // ---- which screen
  const noProfile = !profile;
  if (ui.registering || noProfile) {
    const r = ui.registering;
    return {
      ...base,
      // While registering there is no active family on screen (no header, no switcher).
      profile: r?.adding ? profile : null,
      screen: {
        kind: 'register',
        mode: r?.mode || 'new',
        recoverError: r?.recoverError,
        nameError: r?.nameError,
        firstGnome: m.pendingGnome && !r?.adding ? gnomeView(m.pendingGnome) : undefined,
      },
    };
  }
  if (!s.adventure.open) return { ...base, screen: { kind: 'paused' } };

  const f = ui.flash;
  if (f) {
    switch (f.kind) {
      case 'correct': return { ...base, correct: f.correct, screen: { kind: 'correct' } };
      case 'wrongGnome': return { ...base, screen: { kind: 'wrongGnome', gnome: f.gnome, penalty: f.penalty, freeLeft: f.freeLeft } };
      case 'alreadySolved': return { ...base, screen: { kind: 'alreadySolved', gnome: f.gnome } };
      case 'gnomeAsleep': return { ...base, screen: { kind: 'gnomeAsleep', gnome: f.gnome } };
      case 'solved':
        return {
          ...base,
          arrange: {
            pool: f.letters,
            placed: f.letters.map((_, i) => i),
            locked: f.letters.map(() => false),
            wordLengths: f.wordLengths,
            helpCost: 0,
            wrongTick: ui.arrangeWrongTick,
            solved: true,
          },
          screen: { kind: 'arrange' },
        };
      case 'suitcase': return { ...base, suitcase: f.suitcase, screen: { kind: 'suitcase' } };
    }
  }
  if (ui.view === 'scanner') {
    return { ...base, scanner: { camera: true, error: ui.scannerError, busy: m.busy === 'scan' }, screen: { kind: 'scanner' } };
  }
  if (ui.view === 'summary') return { ...base, screen: { kind: 'summary' } };
  return { ...base, screen: homeScreen(s) };
}
