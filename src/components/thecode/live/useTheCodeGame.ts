'use client';

// הקוד — the live game client: POST /api/thecode/play ↔ PlayerState / PlayerCallbacks.
//
// Rules this hook keeps (docs/THE_CODE_PLAN.md §5, §8):
// - The snapshot is the truth; an event only picks the one-off animation. Nothing is
//   ever awarded locally.
// - A camera scan opens a NEW tab every time, so nothing important lives in memory:
//   every mount, tab focus and visibilitychange asks the server for `state`.
// - One user action in flight at a time (double taps / double scans are ignored); a
//   failed request keeps the family's choice and retries the SAME action (the server dedupes).
// - Countdowns use the server clock offset, never the phone clock alone.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isInAppBrowser, openCurrentUrlInBrowser } from '@/lib/inAppBrowser';
import { phraseLetters, phraseWordLengths } from '@/lib/thecode/letters';
import type { TheCodeBranding } from '@/types/thecode';
import type {
  TheCodeAuth,
  TheCodeGnomeView,
  TheCodePlayAction,
  TheCodePlayEvent,
  TheCodePlayResponse,
  TheCodeSnapshot,
} from '@/types/thecode-api';
import type { PlayerCallbacks, PlayerState } from '../player/types';
import { fetchLeaderboard, fetchPlayTransport, type TheCodePlayTransport } from './api';
import {
  EMPTY_IDENTITY,
  activeAuth,
  dropProfile,
  loadIdentity,
  saveIdentity,
  upsertProfile,
  type StoredIdentity,
} from './identity';
import { INITIAL_UI, buildPlayerState, reconcilePlaced, type BoardData, type LocalUi } from './mapSnapshot';

export interface UseTheCodeGameOptions {
  codeId: string;
  /** A gnome code to scan as soon as the family is known (/g/{code}). */
  pendingScanCode?: string;
  /** The scanned gnome (from the lookup) — greets a new family on the register screen. */
  pendingGnome?: TheCodeGnomeView | null;
  /** Called once the pending scan reached the server (→ replaceState to /v/{shortId}). */
  onPendingScanConsumed?(): void;
  transport?: TheCodePlayTransport;
  /** Venue branding known before the first snapshot (the /g lookup). */
  branding?: TheCodeBranding | null;
  /** Leaderboard source (injectable for tests). */
  leaderboard?: typeof fetchLeaderboard;
}

type Busy = 'answer' | 'scan' | 'other' | null;
const MUTE_KEY = 'thecode_muted';
const REFRESH_GAP_MS = 1500;

const SCAN_TEXT = {
  unknown: 'זה לא גמד של המשחק הזה. חפשו גמד עם כובע מחודד.',
};

function readMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeMuted(v: boolean) {
  try {
    window.localStorage.setItem(MUTE_KEY, v ? '1' : '0');
  } catch {
    /* private mode: mute lasts for this tab */
  }
}

export function useTheCodeGame(opts: UseTheCodeGameOptions): { state: PlayerState; callbacks: PlayerCallbacks } {
  const { codeId } = opts;
  const transport = opts.transport ?? fetchPlayTransport;
  const leaderboard = opts.leaderboard ?? fetchLeaderboard;

  const [identity, setIdentityState] = useState<StoredIdentity>(EMPTY_IDENTITY);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [snapshot, setSnapshot] = useState<TheCodeSnapshot | null>(null);
  const [clockOffset, setClockOffset] = useState(0);
  const [ui, setUi] = useState<LocalUi>(INITIAL_UI);
  const [busy, setBusy] = useState<Busy>(null);
  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [muted, setMuted] = useState(false);
  const [boards, setBoards] = useState<{ week: BoardData | null; all: BoardData | null }>({ week: null, all: null });
  const [, setTick] = useState(0);

  // Refs so callbacks never read a stale closure (the screens hold them for a while).
  const identityRef = useRef(identity);
  const snapshotRef = useRef(snapshot);
  const uiRef = useRef(ui);
  const busyRef = useRef<Busy>(null);
  const seqRef = useRef(0);
  const appliedSeqRef = useRef(0);
  const failedActionRef = useRef<TheCodePlayAction | null>(null);
  const pendingScanRef = useRef<string | null>(opts.pendingScanCode || null);
  const lastRefreshRef = useRef(0);
  const prevRanksRef = useRef<{ week: Record<string, number> | null; all: Record<string, number> | null }>({ week: null, all: null });
  const onConsumedRef = useRef(opts.onPendingScanConsumed);
  useEffect(() => {
    onConsumedRef.current = opts.onPendingScanConsumed;
  }, [opts.onPendingScanConsumed]);
  const [pendingGnome, setPendingGnome] = useState<TheCodeGnomeView | null>(opts.pendingGnome || null);

  const setIdentity = useCallback((next: StoredIdentity) => {
    identityRef.current = next;
    setIdentityState(next);
    if (!saveIdentity(codeId, next)) setStorageAvailable(false);
  }, [codeId]);

  const patchUi = useCallback((fn: (u: LocalUi) => LocalUi) => {
    setUi((prev) => {
      const next = fn(prev);
      uiRef.current = next;
      return next;
    });
  }, []);

  const applySnapshot = useCallback((snap: TheCodeSnapshot, serverNow: number) => {
    snapshotRef.current = snap;
    setSnapshot(snap);
    setClockOffset(serverNow - Date.now());
    setLoaded(true);
    // Keep the switcher's cache of this family fresh.
    const p = snap.player;
    const id = identityRef.current;
    const stored = p && id.profiles.find((x) => x.playerId === p.id);
    if (p && stored && (stored.points !== p.points || stored.familyName !== p.familyName || stored.recoveryCode !== p.recoveryCode || stored.emoji !== p.emoji)) {
      setIdentity({
        ...id,
        profiles: id.profiles.map((x) => (x.playerId === p.id
          ? { ...x, familyName: p.familyName, emoji: p.emoji, points: p.points, recoveryCode: p.recoveryCode }
          : x)),
      });
    }
  }, [setIdentity]);

  /** What the one-off event means for the tab's own UI. */
  const applyEvent = useCallback((event: TheCodePlayEvent | undefined, snap: TheCodeSnapshot) => {
    patchUi((u0) => {
      let u: LocalUi = { ...u0, failure: null };
      const gnome = event && event.type === 'scan' && event.gnome
        ? { id: event.gnome.id, number: event.gnome.number, bodyColor: event.gnome.bodyColor, hatColor: event.gnome.hatColor }
        : null;
      switch (event?.type) {
        case 'registered':
        case 'recovered':
          u = { ...u, registering: null, flash: null, view: 'home', pendingLetter: null, placed: [] };
          break;
        case 'scan': {
          const o = event.outcome;
          u = { ...u, scannerError: null };
          if (o.kind === 'unknownGnome') {
            u = { ...u, view: 'scanner', scannerError: SCAN_TEXT.unknown };
            break;
          }
          u = { ...u, view: 'home' };
          if (o.kind === 'wrongGnome' && gnome) u.flash = { kind: 'wrongGnome', gnome, penalty: o.penalty, freeLeft: o.freeLeft };
          else if (o.kind === 'alreadySolved' && gnome) u.flash = { kind: 'alreadySolved', gnome };
          else if (o.kind === 'gnomeAsleep' && gnome) u.flash = { kind: 'gnomeAsleep', gnome };
          else u.flash = null; // riddle / runStarted / arranging / allDone / paused → the snapshot decides
          if (o.kind === 'riddle' || o.kind === 'runStarted') u.pendingLetter = null;
          break;
        }
        case 'answer': {
          const o = event.outcome;
          if (o.kind === 'correct') {
            u = {
              ...u,
              pendingLetter: null,
              flash: {
                kind: 'correct',
                correct: {
                  letter: o.letter,
                  points: o.points,
                  hot: o.hot,
                  becameHot: o.becameHot,
                  spellingTip: o.spellingTip,
                  lastLetter: o.runState === 'arranging',
                },
              },
            };
          } else if (o.kind === 'wrong') {
            u = { ...u, pendingLetter: null, riddleWrongTick: u.riddleWrongTick + 1 };
          } else if (o.kind === 'noRiddle') {
            u = { ...u, pendingLetter: null, flash: null };
          }
          break;
        }
        case 'open': {
          if (event.opened && snap.run?.suitcase) {
            // The phrase is revealed now: show it on the board first, the family taps "open".
            const text = snap.run.suitcase.phraseText;
            u = { ...u, placed: [], flash: { kind: 'solved', letters: phraseLetters(text), wordLengths: phraseWordLengths(text) } };
          } else {
            u = { ...u, arrangeWrongTick: u.arrangeWrongTick + 1 };
          }
          break;
        }
        case 'newSuitcase':
          u = { ...u, flash: null, view: 'home', placed: [], pendingLetter: null };
          break;
        default:
          break;
      }
      // A new run → a fresh arrange board.
      if (snap.run?.state !== 'arranging' && u.flash?.kind !== 'solved') u.placed = [];
      return u;
    });
  }, [patchUi]);

  const send = useCallback(async (action: TheCodePlayAction, kind: Busy, authOverride?: TheCodeAuth | null): Promise<TheCodePlayResponse | null> => {
    const isUser = action.type !== 'state';
    if (isUser) {
      if (busyRef.current) return null; // double tap / double scan
      busyRef.current = kind;
      setBusy(kind);
    }
    const seq = ++seqRef.current;
    const auth = authOverride === null ? undefined : (authOverride ?? activeAuth(identityRef.current));
    let res: TheCodePlayResponse;
    try {
      res = await transport({ codeId, auth, action });
    } catch {
      if (isUser || !snapshotRef.current) {
        failedActionRef.current = action;
        patchUi((u) => ({ ...u, failure: { problem: 'offline', retryAt: null } }));
      }
      return null;
    } finally {
      if (isUser) {
        busyRef.current = null;
        setBusy(null);
      }
    }

    if (!res.ok) {
      switch (res.error) {
        case 'notFound':
          setNotFound(true);
          setLoaded(true);
          break;
        case 'unauthorized': {
          const id = identityRef.current;
          if (id.activeId) setIdentity(dropProfile(id, id.activeId));
          snapshotRef.current = snapshotRef.current ? { ...snapshotRef.current, player: null, run: null } : null;
          setSnapshot(snapshotRef.current);
          patchUi((u) => ({ ...u, registering: { mode: 'new', adding: false }, flash: null, view: 'home', failure: null }));
          // The adventure's public part (title / open) still loads without a player.
          if (!snapshotRef.current) void send({ type: 'state' }, null, null);
          setLoaded(true);
          break;
        }
        case 'needRegister':
          patchUi((u) => ({ ...u, registering: { mode: 'new', adding: false }, failure: null }));
          if (action.type === 'scan') pendingScanRef.current = action.code;
          break;
        case 'invalidName':
          patchUi((u) => ({ ...u, registering: { mode: 'new', adding: u.registering?.adding ?? false, nameError: 'הכינוי הזה לא מתאים. בחרו כינוי אחר.' } }));
          break;
        case 'recoveryNotFound':
          patchUi((u) => ({ ...u, registering: { mode: 'recover', adding: u.registering?.adding ?? false, recoverError: 'לא מצאנו משפחה עם הקוד הזה. בדקו אותו ונסו שוב.' } }));
          break;
        case 'rateLimited':
        case 'badRequest':
        case 'server':
          if (isUser || !snapshotRef.current) {
            failedActionRef.current = action;
            const retryAt = res.error === 'rateLimited' ? Date.now() + (res.retryAfterSeconds ?? 5) * 1000 : null;
            patchUi((u) => ({ ...u, failure: { problem: res.error === 'rateLimited' ? 'rateLimited' : 'server', retryAt } }));
          }
          break;
      }
      return res;
    }

    // A slow `state` answer must not roll back a newer action's snapshot.
    if (seq < appliedSeqRef.current) return res;
    appliedSeqRef.current = seq;
    failedActionRef.current = null;

    if (res.auth) {
      const p = res.snapshot.player;
      setIdentity(upsertProfile(identityRef.current, {
        playerId: res.auth.playerId,
        token: res.auth.token,
        familyName: p?.familyName ?? '',
        emoji: p?.emoji ?? '🙂',
        points: p?.points,
        recoveryCode: p?.recoveryCode,
      }));
    }
    applySnapshot(res.snapshot, res.serverNow);
    applyEvent(res.event, res.snapshot);
    if (action.type === 'scan' && pendingScanRef.current === action.code) {
      pendingScanRef.current = null;
      setPendingGnome(null);
      onConsumedRef.current?.();
    }
    return res;
  }, [codeId, transport, patchUi, setIdentity, applySnapshot, applyEvent]);

  /** After register / recover: continue with the scanned gnome, or open the first suitcase. */
  const afterJoin = useCallback(async (res: TheCodePlayResponse | null) => {
    if (!res || !res.ok || !res.auth) return;
    const code = pendingScanRef.current;
    if (code) {
      await send({ type: 'scan', code }, 'scan');
    } else if (!res.snapshot.run && res.snapshot.canStartNew) {
      await send({ type: 'newSuitcase' }, 'other');
    }
  }, [send]);

  const refresh = useCallback(() => {
    const now = Date.now();
    if (now - lastRefreshRef.current < REFRESH_GAP_MS) return;
    if (busyRef.current || failedActionRef.current) return;
    lastRefreshRef.current = now;
    void send({ type: 'state' }, null);
  }, [send]);

  // ---- mount: identity, in-app browser, first request
  useEffect(() => {
    const { identity: id, available } = loadIdentity(codeId);
    identityRef.current = id;
    setIdentityState(id);
    setStorageAvailable(available);
    setMuted(readMuted());
    if (isInAppBrowser()) patchUi((u) => ({ ...u, inAppGate: true }));
    const code = pendingScanRef.current;
    lastRefreshRef.current = Date.now();
    if (code && activeAuth(id)) void send({ type: 'scan', code }, 'scan');
    else void send({ type: 'state' }, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeId]);

  // ---- tab focus / back from background → the server may have moved on (another tab, another phone)
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [refresh]);

  // ---- rate-limit countdown re-renders the wait
  useEffect(() => {
    if (!ui.failure?.retryAt) return;
    const t = setInterval(() => setTick((x) => x + 1), 500);
    return () => clearInterval(t);
  }, [ui.failure?.retryAt]);

  // ---- leaderboard: fetched when the family will look at it (arranging = before the
  // suitcase, so the summary can slide the rows from the old rank to the new one).
  const screenKind = useMemo(() => buildPlayerState({
    snapshot, ui, identity, storageAvailable, clockOffset, busy, board: null, pendingGnome, loaded, notFound, muted,
  }).screen.kind, [snapshot, ui, identity, storageAvailable, clockOffset, busy, pendingGnome, loaded, notFound, muted]);
  const playerId = snapshot?.player?.id;
  const pointsKey = snapshot?.player?.points;
  useEffect(() => {
    if (!playerId) return;
    if (!['summary', 'allDone', 'arrange', 'suitcase'].includes(screenKind)) return;
    const scope = ui.boardScope;
    let cancelled = false;
    void leaderboard(codeId, scope, playerId).then((b) => {
      if (cancelled || !b) return;
      const ranks: Record<string, number> = {};
      b.rows.forEach((r, i) => { ranks[r.id] = i; });
      const prev = prevRanksRef.current[scope];
      prevRanksRef.current[scope] = ranks;
      setBoards((x) => ({ ...x, [scope]: { rows: b.rows, me: b.me, prevRanks: prev } }));
    });
    return () => { cancelled = true; };
  }, [codeId, playerId, pointsKey, screenKind, ui.boardScope, leaderboard]);

  // ---- callbacks
  const callbacks = useMemo<PlayerCallbacks>(() => ({
    onRegister: (familyName, emoji) => {
      patchUi((u) => ({ ...u, registering: u.registering ? { ...u.registering, nameError: undefined } : null }));
      void send({ type: 'register', familyName: familyName.trim(), emoji }, 'other', null).then(afterJoin);
    },
    onRecover: (code) => {
      void send({ type: 'recover', recoveryCode: code.trim().toUpperCase() }, 'other', null).then(afterJoin);
    },
    onRegisterMode: (mode) => patchUi((u) => ({
      ...u, registering: { mode, adding: u.registering?.adding ?? false },
    })),
    onLocationHint: () => { void send({ type: 'hint', hintKind: 'location' }, 'other'); },
    onRiddleHint: () => { void send({ type: 'hint', hintKind: 'riddle' }, 'other'); },
    onPickLetter: (letter) => {
      if (busyRef.current) return;
      patchUi((u) => ({ ...u, pendingLetter: letter }));
    },
    onSubmitLetter: () => {
      const t = snapshotRef.current?.run?.target;
      const letter = uiRef.current.pendingLetter;
      if (!t || !letter) return;
      void send({ type: 'answer', slotIndex: t.slotIndex, letter }, 'answer');
    },
    onContinue: () => patchUi((u) => ({ ...u, flash: null, view: 'home' })),
    onArrangePlace: (poolIndex) => {
      if (busyRef.current) return;
      const a = snapshotRef.current?.run?.arrange;
      if (!a) return;
      const cur = reconcilePlaced(a.pool, a.fixed, uiRef.current.placed.length === a.fixed.length ? uiRef.current.placed : a.fixed.map(() => null));
      if (cur.includes(poolIndex)) return;
      const cell = cur.findIndex((x) => x === null);
      if (cell < 0) return;
      const next = [...cur];
      next[cell] = poolIndex;
      patchUi((u) => ({ ...u, placed: next }));
      if (next.every((x) => x !== null)) {
        void send({ type: 'open', arrangement: next.map((i) => a.pool[i as number]) }, 'other');
      }
    },
    onArrangeRemove: (cellIndex) => {
      if (busyRef.current) return;
      const a = snapshotRef.current?.run?.arrange;
      if (!a || a.fixed[cellIndex]) return;
      patchUi((u) => {
        const cur = reconcilePlaced(a.pool, a.fixed, u.placed.length === a.fixed.length ? u.placed : a.fixed.map(() => null));
        cur[cellIndex] = null;
        return { ...u, placed: cur };
      });
    },
    onArrangeHelp: () => { void send({ type: 'arrangeHelp' }, 'other'); },
    onOpenSuitcase: () => {
      const sc = snapshotRef.current?.run?.suitcase;
      patchUi((u) => ({ ...u, flash: sc ? { kind: 'suitcase', suitcase: sc } : null }));
    },
    onShowSummary: () => patchUi((u) => ({ ...u, flash: null, view: 'summary' })),
    onNewSuitcase: () => { void send({ type: 'newSuitcase' }, 'other'); },
    onSwitchProfile: (id) => {
      const cur = identityRef.current;
      patchUi((u) => ({ ...INITIAL_UI, inAppGate: u.inAppGate, boardScope: u.boardScope }));
      if (cur.activeId === id) return; // "cancel" from add-a-family
      if (!cur.profiles.some((p) => p.playerId === id)) return;
      setIdentity({ ...cur, activeId: id });
      snapshotRef.current = null;
      setSnapshot(null);
      setLoaded(false);
      lastRefreshRef.current = Date.now();
      void send({ type: 'state' }, null);
    },
    onAddProfile: () => patchUi((u) => ({ ...u, registering: { mode: 'new', adding: true }, flash: null })),
    onToggleMute: () => setMuted((m) => { writeMuted(!m); return !m; }),
    onRetry: () => {
      const action = failedActionRef.current;
      const f = uiRef.current.failure;
      if (f?.retryAt && f.retryAt > Date.now()) return;
      patchUi((u) => ({ ...u, failure: null }));
      failedActionRef.current = null;
      if (!action) { void send({ type: 'state' }, null); return; }
      const isJoin = action.type === 'register' || action.type === 'recover';
      const kind: Busy = action.type === 'answer' ? 'answer' : action.type === 'scan' ? 'scan' : action.type === 'state' ? null : 'other';
      const p = send(action, kind, isJoin ? null : undefined);
      if (isJoin) void p.then(afterJoin);
    },
    onOpenScanner: () => {
      if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
      patchUi((u) => ({ ...u, view: 'scanner', scannerError: null, flash: null }));
    },
    onCloseScanner: () => patchUi((u) => ({ ...u, view: 'home', scannerError: null })),
    onScanCode: (code) => {
      patchUi((u) => ({ ...u, scannerError: null }));
      void send({ type: 'scan', code }, 'scan');
    },
    onBoardScope: (scope) => patchUi((u) => ({ ...u, boardScope: scope })),
    onOpenInBrowser: () => openCurrentUrlInBrowser(),
    onDismissInAppBrowser: () => patchUi((u) => ({ ...u, inAppGate: false })),
  }), [send, afterJoin, patchUi, setIdentity]);

  const state = useMemo(() => buildPlayerState({
    snapshot,
    ui,
    identity,
    storageAvailable,
    clockOffset,
    busy,
    board: boards[ui.boardScope],
    pendingGnome,
    loaded,
    notFound,
    muted,
    branding: opts.branding,
  }), [snapshot, ui, identity, storageAvailable, clockOffset, busy, boards, pendingGnome, loaded, notFound, muted, opts.branding]);

  return { state, callbacks };
}
