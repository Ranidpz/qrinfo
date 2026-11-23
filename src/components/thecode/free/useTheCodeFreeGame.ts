'use client';

// קוד הגמדים — the live FREE game client: POST /api/thecode/play ↔ FreeGameView / FreeGameCallbacks.
// Same rules as the guided hook (live/useTheCodeGame.ts): the snapshot is the truth, an event only
// picks the one-off screen; one user action in flight; countdowns use the server clock offset;
// every mount / tab focus asks for `state`. One group per phone here (no profile switcher).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SelfieShot } from '@/components/thecode/player/types';
import type { TheCodeAuth, TheCodeGnomeView, TheCodePlayAction, TheCodePlayResponse, TheCodeSnapshot } from '@/types/thecode-api';
import type { TheCodeBranding, TheCodeSelfieSettings } from '@/types/thecode';
import { fetchPlayTransport, reportLobbyScan, sendPhoto, type TheCodePlayTransport } from '@/components/thecode/live/api';
import { EMPTY_IDENTITY, activeAuth, dropProfile, loadIdentity, saveIdentity, upsertProfile, type StoredIdentity } from '@/components/thecode/live/identity';
import type { FreeCorrectView, FreeGameCallbacks, FreeGameView, FreeScreenView } from './types';
import { useInstall } from './install';
import { openCurrentUrlInBrowser } from '@/lib/inAppBrowser';

export interface UseTheCodeFreeGameOptions {
  codeId: string;
  /** /g/{code}: the gnome this phone just scanned (scanned at once when the group is known). */
  pendingScanCode?: string;
  pendingGnome?: TheCodeGnomeView | null;
  onPendingScanConsumed?(): void;
  /** /v/{shortId}?join=CODE (staff QR): bring the group back. */
  pendingRecoveryCode?: string;
  onPendingRecoveryConsumed?(): void;
  branding?: TheCodeBranding | null;
  selfie?: TheCodeSelfieSettings | null;
  screenHint?: string;
  /** /v/{shortId}?src=lobby: this phone just scanned the big screen's code → straight to registration. */
  fromScreen?: boolean;
  transport?: TheCodePlayTransport;
}

type View = 'board' | 'scanner' | 'gnome' | 'riddle' | 'intro' | 'joined';
type Flash =
  | { kind: 'correct'; correct: FreeCorrectView }
  | { kind: 'failed'; gnomeId: string; wakesAt: number; allAsleep: boolean }
  | { kind: 'asleep'; gnomeId: string; wakesAt: number; last?: 'full' | 'half' | 'failed' }
  | { kind: 'noRiddles'; gnomeId: string };

const MUTE_KEY = 'thecode_muted';
const UNKNOWN = 'זה לא גמד של המשחק הזה. סרקו את הקוד שעל הגמד עצמו.';
const GNOME_OFF = 'הגמד הזה לא משחק כרגע. חפשו גמד אחר.';
const NEED_SCREEN = 'זה קוד של גמד. כדי להירשם, סרקו את הקוד שעל המסך הגדול.';
const REFRESH_GAP_MS = 1500;

function readMuted(): boolean {
  try { return window.localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
}
function writeMuted(v: boolean) {
  try { window.localStorage.setItem(MUTE_KEY, v ? '1' : '0'); } catch { /* private mode */ }
}

export function useTheCodeFreeGame(opts: UseTheCodeFreeGameOptions): { view: FreeGameView; callbacks: FreeGameCallbacks } {
  const { codeId } = opts;
  const transport = opts.transport ?? fetchPlayTransport;

  const [identity, setIdentityState] = useState<StoredIdentity>(EMPTY_IDENTITY);
  const [snapshot, setSnapshot] = useState<TheCodeSnapshot | null>(null);
  const [offset, setOffset] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [failure, setFailure] = useState<{ problem: 'offline' | 'server' | 'rateLimited'; retryAt: number | null } | null>(null);
  const [view, setView] = useState<View>('board');
  const [openGnome, setOpenGnome] = useState<string | null>(null);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [register, setRegister] = useState<{ mode: 'new' | 'recover'; nameError?: string; recoverError?: string } | null>(null);
  // Not registered, in a browser: offer to install first (Rani 23.11.2026); "continue without" is remembered for this tab.
  const install = useInstall();
  const installPrompt = install.prompt; // stable (useCallback) — `install` itself is a new object every render
  const [skipInstall, setSkipInstall] = useState(false);
  // Registration opens only after the big screen's code was scanned (Rani 23.11.2026).
  const [screenScanned, setScreenScanned] = useState(!!opts.fromScreen);
  useEffect(() => {
    try { if (window.sessionStorage.getItem(`thecode_skip_install_${codeId}`) === '1') setSkipInstall(true); } catch { /* private mode */ }
  }, [codeId]);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [pendingLetter, setPendingLetter] = useState<string | null>(null);
  const [wrongTick, setWrongTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [muted, setMuted] = useState(false);
  const [call, setCall] = useState<'intro' | 'wellDone' | null>(null);
  const [localPhoto, setLocalPhoto] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const identityRef = useRef(identity);
  const snapshotRef = useRef(snapshot);
  const busyRef = useRef(false);
  const seqRef = useRef(0);
  const appliedSeqRef = useRef(0);
  const failedRef = useRef<TheCodePlayAction | null>(null);
  const lastRefreshRef = useRef(0);
  const pendingScanRef = useRef<string | null>(opts.pendingScanCode || null);
  const pendingRecoveryRef = useRef<string | null>(opts.pendingRecoveryCode || null);
  const pendingPhotoRef = useRef<SelfieShot | null>(null);
  const onScanConsumedRef = useRef(opts.onPendingScanConsumed);
  const onRecoveryConsumedRef = useRef(opts.onPendingRecoveryConsumed);
  useEffect(() => { onScanConsumedRef.current = opts.onPendingScanConsumed; }, [opts.onPendingScanConsumed]);
  useEffect(() => { onRecoveryConsumedRef.current = opts.onPendingRecoveryConsumed; }, [opts.onPendingRecoveryConsumed]);

  const setIdentity = useCallback((next: StoredIdentity) => {
    identityRef.current = next;
    setIdentityState(next);
    saveIdentity(codeId, next);
  }, [codeId]);

  // One clock for every countdown ("מתעורר בעוד…"): the server's.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const serverNow = now + offset;

  const send = useCallback(async (action: TheCodePlayAction, user: boolean, authOverride?: TheCodeAuth | null): Promise<TheCodePlayResponse | null> => {
    if (user) {
      if (busyRef.current) return null; // double tap / double scan
      busyRef.current = true;
      setBusy(true);
    }
    const seq = ++seqRef.current;
    const auth = authOverride === null ? undefined : (authOverride ?? activeAuth(identityRef.current));
    let res: TheCodePlayResponse;
    try {
      res = await transport({ codeId, auth, action });
    } catch {
      if (user || !snapshotRef.current) {
        failedRef.current = action;
        setFailure({ problem: 'offline', retryAt: null });
      }
      return null;
    } finally {
      if (user) {
        busyRef.current = false;
        setBusy(false);
      }
    }
    if (action.type === 'recover' && pendingRecoveryRef.current) {
      pendingRecoveryRef.current = null;
      onRecoveryConsumedRef.current?.();
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
          snapshotRef.current = snapshotRef.current ? { ...snapshotRef.current, player: null, free: null } : null;
          setSnapshot(snapshotRef.current);
          setRegister({ mode: 'new' });
          if (!snapshotRef.current) void send({ type: 'state' }, false, null);
          setLoaded(true);
          break;
        }
        case 'needRegister':
          setRegister({ mode: 'new' });
          break;
        case 'invalidName':
          setRegister({ mode: 'new', nameError: 'הכינוי הזה לא מתאים. בחרו כינוי אחר.' });
          break;
        case 'recoveryNotFound':
          setRegister({ mode: 'recover', recoverError: 'לא מצאנו קבוצה עם הקוד הזה. בדקו אותו ונסו שוב.' });
          break;
        default:
          if (user || !snapshotRef.current) {
            failedRef.current = action;
            setFailure({
              problem: res.error === 'rateLimited' ? 'rateLimited' : 'server',
              retryAt: res.error === 'rateLimited' ? Date.now() + (res.retryAfterSeconds ?? 5) * 1000 : null,
            });
          }
      }
      return res;
    }
    if (seq < appliedSeqRef.current) return res; // a slow `state` never rolls back a newer action
    appliedSeqRef.current = seq;
    failedRef.current = null;
    setFailure(null);
    if (res.auth) {
      const p = res.snapshot.player;
      setIdentity(upsertProfile(identityRef.current, {
        playerId: res.auth.playerId, token: res.auth.token, familyName: p?.familyName ?? '', emoji: p?.emoji ?? '🙂',
        points: p?.points, recoveryCode: p?.recoveryCode,
      }));
    }
    snapshotRef.current = res.snapshot;
    setSnapshot(res.snapshot);
    setOffset(res.serverNow - Date.now());
    setLoaded(true);

    // ---- what the event means for this tab
    const ev = res.event;
    if (ev?.type === 'registered' || ev?.type === 'recovered') {
      setRegister(null);
      setFlash(null);
      // Registered at the screen: the big screen celebrates them now → then Cliostro calls.
      setView(ev.type === 'registered' ? 'joined' : 'board');
    } else if (ev?.type === 'freeScan') {
      const o = ev.outcome;
      setScannerError(null);
      setPendingLetter(null);
      if (o.kind === 'riddle') { setFlash(null); setView('riddle'); }
      else if (o.kind === 'asleep') { setFlash({ kind: 'asleep', gnomeId: o.gnomeId, wakesAt: o.wakesAt, ...(o.last ? { last: o.last } : {}) }); }
      else if (o.kind === 'noRiddles') setFlash({ kind: 'noRiddles', gnomeId: o.gnomeId });
      else if (o.kind === 'unknownGnome') { setView('scanner'); setScannerError(UNKNOWN); }
      else if (o.kind === 'gnomeOff') { setView('scanner'); setScannerError(GNOME_OFF); }
    } else if (ev?.type === 'freeAnswer') {
      const o = ev.outcome;
      setPendingLetter(null);
      const gnomeId = action.type === 'freeAnswer' ? action.gnomeId : '';
      if (o.kind === 'correct') {
        setFlash({ kind: 'correct', correct: {
          gnomeId, letter: o.letter, answerWord: o.answerWord, points: o.points, secondTry: o.secondTry, hot: o.hot,
          becameHot: o.becameHot, ...(o.spellingTip ? { spellingTip: o.spellingTip } : {}), wakesAt: o.wakesAt, allAsleep: o.allAsleep,
        } });
      } else if (o.kind === 'wrong') setWrongTick((t) => t + 1);
      else if (o.kind === 'failed') setFlash({ kind: 'failed', gnomeId, wakesAt: o.wakesAt, allAsleep: o.allAsleep });
      else if (o.kind === 'noRiddle') setView('board');
    }
    if (action.type === 'scan' && pendingScanRef.current === action.code) {
      pendingScanRef.current = null;
      onScanConsumedRef.current?.();
    }
    return res;
  }, [codeId, transport, setIdentity]);

  const refresh = useCallback(() => {
    const t = Date.now();
    if (t - lastRefreshRef.current < REFRESH_GAP_MS || busyRef.current || failedRef.current) return;
    lastRefreshRef.current = t;
    void send({ type: 'state' }, false);
  }, [send]);

  // ---- mount
  useEffect(() => {
    const { identity: id } = loadIdentity(codeId);
    identityRef.current = id;
    setIdentityState(id);
    setMuted(readMuted());
    lastRefreshRef.current = Date.now();
    const join = pendingRecoveryRef.current;
    const code = pendingScanRef.current;
    if (join) void send({ type: 'recover', recoveryCode: join }, true, null);
    else if (code && activeAuth(id)) void send({ type: 'scan', code }, true);
    else void send({ type: 'state' }, false).then((r) => {
      // Resume an open riddle after a reload.
      if (r && r.ok && r.snapshot.free?.riddle) setView('riddle');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeId]);

  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVis);
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', onVis); };
  }, [refresh]);

  // A sleeping gnome's time passed → ask the server (it decides the next riddle).
  const nextWake = snapshot?.free?.nextWakeAt;
  useEffect(() => {
    if (nextWake && serverNow >= nextWake) refresh();
  }, [nextWake, serverNow, refresh]);

  // Reaching the finish (every gnome asleep): Cliostro calls to say well done — once per arrival.
  const free = snapshot?.free ?? null;
  const finishedNow = !!free?.allAsleep && !flash && view === 'board';
  const wasFinished = useRef(false);
  useEffect(() => {
    if (finishedNow && !wasFinished.current) setCall('wellDone');
    wasFinished.current = finishedNow;
  }, [finishedNow]);

  const [photoBusy, setPhotoBusy] = useState(false);
  /** A selfie up (shot) or removed (null). The local preview shows at once; the server copy wins after. */
  const putPhoto = useCallback(async (auth: TheCodeAuth, shot: SelfieShot | null) => {
    if (shot) setLocalPhoto(shot.preview);
    setPhotoBusy(true);
    const r = await sendPhoto(codeId, auth, shot ? shot.blob : null);
    setPhotoBusy(false);
    if (r.ok) { lastRefreshRef.current = 0; await send({ type: 'state' }, false); }
    setLocalPhoto(null);
  }, [codeId, send]);

  // ---- callbacks
  const callbacks = useMemo<FreeGameCallbacks>(() => ({
    onRegister: (name, emoji, photo) => {
      pendingPhotoRef.current = photo ?? null;
      void send({ type: 'register', familyName: name, emoji }, true, null).then((r) => {
        const shot = pendingPhotoRef.current;
        pendingPhotoRef.current = null;
        if (r && r.ok && r.auth && shot) void putPhoto(r.auth, shot);
      });
    },
    onRecover: (code) => { void send({ type: 'recover', recoveryCode: code }, true, null); },
    onRegisterMode: (mode) => setRegister({ mode }),
    onOpenGnome: (id) => { setOpenGnome(id); setView('gnome'); },
    onOpenScanner: () => { setScannerError(null); setFlash(null); setView('scanner'); },
    onScanCode: (code) => {
      if (!snapshotRef.current?.player) { setScannerError(NEED_SCREEN); return; }
      void send({ type: 'scan', code }, true);
    },
    onScanScreen: () => { setScannerError(null); setView('scanner'); },
    onScreenText: (text) => {
      // The big screen's QR = {origin}/v/{shortId}?src=lobby (TheCodeLobby).
      try {
        const u = new URL(text.trim());
        if (!/^\/v\/[^/]+\/?$/.test(u.pathname) || u.searchParams.get('src') !== 'lobby') return false;
      } catch { return false; }
      void reportLobbyScan(codeId); // the screen starts its "how to play" scene, as with a camera scan
      setScreenScanned(true);
      setView('board');
      return true;
    },
    onBuyHint: (gnomeId) => { void send({ type: 'freeHint', gnomeId }, true); },
    onPickLetter: (l) => setPendingLetter(l),
    onSubmitLetter: () => {
      const r = snapshotRef.current?.free?.riddle;
      const letter = pendingLetterRef.current;
      if (!r || !letter) return;
      void send({ type: 'freeAnswer', gnomeId: r.gnomeId, riddleId: r.riddleId, letter }, true);
    },
    onContinue: () => { setFlash(null); setView('board'); },
    onBoard: () => { setFlash(null); setView('board'); },
    onToggleMute: () => setMuted((m) => { writeMuted(!m); return !m; }),
    onShowIntro: () => { setFlash(null); setView('intro'); },
    onJoinedDone: () => {
      setView('intro');
      setCall('intro'); // with no clip yet the call shows a black screen (Rani 23.11.2026)
    },
    onEndCall: () => setCall(null),
    onSetPhoto: (shot) => { const a = activeAuth(identityRef.current); if (a) void putPhoto(a, shot); },
    onRemovePhoto: () => { const a = activeAuth(identityRef.current); if (a) void putPhoto(a, null); },
    onUpdateProfile: async (patch) => {
      // Straight to the transport (not `send`): the sheet shows its own error, the game never turns
      // into a network-error screen for a rename.
      const auth = activeAuth(identityRef.current);
      if (!auth) return 'failed';
      let res: TheCodePlayResponse;
      try {
        res = await transport({ codeId, auth, action: { type: 'updateProfile', ...patch } });
      } catch {
        return 'failed';
      }
      if (!res.ok) return res.error === 'invalidName' ? 'invalidName' : 'failed';
      appliedSeqRef.current = ++seqRef.current;
      snapshotRef.current = res.snapshot;
      setSnapshot(res.snapshot);
      return 'ok';
    },
    onCallMagician: (c) => setCall(c),
    onInstall: () => { void installPrompt(); },
    onSkipInstall: () => {
      setSkipInstall(true);
      try { window.sessionStorage.setItem(`thecode_skip_install_${codeId}`, '1'); } catch { /* private mode */ }
    },
    onOpenInBrowser: () => openCurrentUrlInBrowser(),
    onRetry: () => {
      const a = failedRef.current;
      setFailure(null);
      if (a) void send(a, a.type !== 'state'); else void send({ type: 'state' }, false);
    },
  }), [send, putPhoto, installPrompt, codeId, transport]);
  const pendingLetterRef = useRef(pendingLetter);
  useEffect(() => { pendingLetterRef.current = pendingLetter; }, [pendingLetter]);

  // ---- the view
  const player = snapshot?.player ?? null;
  const adv = snapshot?.adventure;
  let screen: FreeScreenView;
  if (failure) {
    const retryInSeconds = failure.retryAt ? Math.max(1, Math.ceil((failure.retryAt - now) / 1000)) : undefined;
    screen = { kind: 'network', problem: failure.problem, ...(retryInSeconds ? { retryInSeconds } : {}) };
  } else if (notFound) screen = { kind: 'notFound' };
  else if (!loaded || !snapshot) screen = { kind: 'loading' };
  else if (!player) {
    const offerInstall = !install.standalone && !skipInstall && install.platform !== 'desktop';
    screen = offerInstall
      ? { kind: 'install', platform: install.platform, canPrompt: install.canPrompt, installed: install.installed }
      : register ? { kind: 'register', ...register } // a name error / recovery / a dropped profile
      : screenScanned ? { kind: 'register', mode: 'new' }
      : view === 'scanner' ? { kind: 'scanner', error: scannerError, camera: true, busy, target: 'screen' }
      : { kind: 'startAtScreen', gnome: opts.pendingGnome ?? null };
  } else if (!adv?.open) screen = { kind: 'paused' };
  else if (flash) {
    screen = flash.kind === 'correct' ? { kind: 'correct' } : flash;
  } else if (view === 'joined') screen = { kind: 'joined' };
  else if (view === 'intro') screen = { kind: 'intro' };
  else if (view === 'scanner') screen = { kind: 'scanner', error: scannerError, camera: true, busy };
  else if (view === 'gnome' && openGnome) screen = { kind: 'gnome', gnomeId: openGnome };
  else if (view === 'riddle' && free?.riddle) screen = { kind: 'riddle' };
  else if (free?.allAsleep) screen = { kind: 'finished' };
  else screen = { kind: 'board' };

  const v: FreeGameView = {
    screen,
    now: serverNow,
    venueName: adv?.title || '',
    group: player ? { name: player.familyName, avatar: localPhoto || player.photoUrl || player.emoji } : null,
    profile: player ? {
      id: player.id, familyName: player.familyName, emoji: player.emoji, recoveryCode: player.recoveryCode,
      points: player.points, streak: player.streak, hot: !!player.hot, suitcasesOpened: 0,
      ...((localPhoto || player.photoUrl) ? { photoUrl: (localPhoto || player.photoUrl)! } : {}),
    } : null,
    photoBusy,
    points: player?.points ?? 0,
    streak: player?.streak ?? 0,
    hot: !!player?.hot,
    hotStreakAt: 3,
    gnomes: (free?.gnomes || []).map((g) => ({
      id: g.gnome.id, number: g.gnome.number, bodyColor: g.gnome.bodyColor, hatColor: g.gnome.hatColor,
      status: g.status, ...(g.wakesAt !== undefined ? { wakesAt: g.wakesAt } : {}), ...(g.last ? { last: g.last } : {}),
      hints: g.hints, nextHintCost: g.nextHintCost,
    })),
    riddle: free?.riddle ? {
      gnomeId: free.riddle.gnomeId, text: free.riddle.text, ...(free.riddle.imageUrl ? { imageUrl: free.riddle.imageUrl } : {}),
      wrongs: free.riddle.wrongs, attempts: free.riddle.attempts,
    } : null,
    pendingLetter,
    wrongTick,
    submitting: busy,
    correct: flash?.kind === 'correct' ? flash.correct : null,
    solved: free?.solved ?? 0,
    secondAttemptFactor: free?.secondAttemptFactor ?? 0.5,
    muted,
    call,
    videos: { intro: free?.introVideo ?? null, wellDone: free?.wellDoneVideo ?? null },
    screenHint: adv?.screenHint || opts.screenHint,
    branding: adv?.branding ?? opts.branding ?? null,
    selfie: (() => {
      const sf = adv?.selfie ?? opts.selfie;
      return sf ? { enabled: sf.enabled, days: sf.retentionDays } : null;
    })(),
  };
  return { view: v, callbacks };
}
