'use client';

// הקוד admin — the live editor state. Same reducer as the demo (instant UI), plus:
//  - load from GET /api/thecode/admin (version 0 = never saved, server defaults);
//  - a debounced PUT (800 ms) with optimistic locking (`baseVersion`), one request at a time —
//    edits made while a save is in flight go out right after it;
//  - the server's normalized result is merged back by id without losing in-flight edits (merge.ts);
//  - failures retry with backoff and on `online`; edits are never dropped;
//  - 409 → stop and ask to reload; 'invalid' publish → status reverts, issues shown;
//  - flush on tab hide, keepalive save on pagehide, "leave site?" prompt while unsaved.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TheCodeIssue } from '@/types/thecode';
import type { AdminActions, AdminState, ImageUploader, VideoUploader } from '@/components/thecode/admin/model';
import { createAdminActions } from '@/components/thecode/admin/reducer';
import type { AdminNotice } from '@/components/thecode/admin/AdminShell';
import { contentOf, mergeSaved, revertStatus, same, type Content } from './merge';
import { createHttpTransport, type LoadError, type TheCodeAdminTransport } from './transport';

export const SAVE_DEBOUNCE_MS = 800;
const MAX_BACKOFF_MS = 30_000;

export type SaveState =
  | 'saved'      // server has everything
  | 'pending'    // edits waiting for the debounce
  | 'saving'     // request in flight
  | 'retrying'   // last attempt failed, another one is scheduled
  | 'offline'    // waiting for the network to come back
  | 'failed'     // needs the operator (bad request / signed out) — "נסו שוב"
  | 'conflict';  // another tab saved first — reload

export type LivePhase =
  | { kind: 'loading' }
  | { kind: 'error'; error: LoadError }
  | { kind: 'ready' };

export interface UseTheCodeAdmin {
  phase: LivePhase;
  state: AdminState | null;
  actions: AdminActions;
  saveState: SaveState;
  /** Last successful save (ms). */
  savedAt: number | null;
  /** True when the server had never saved this adventure (defaults, version 0). */
  isNew: boolean;
  notice: AdminNotice | null;
  /** Save now (also the "נסו שוב" button). */
  retry: () => void;
  /** Throw away local edits and load the server's adventure again. */
  reload: () => void;
  /** Re-fetch stats + families (never touches unsaved edits). */
  refresh: () => void;
  refreshing: boolean;
  refreshedAt: number | null;
  uploadImage: ImageUploader;
  uploadVideo: VideoUploader;
}

export function useTheCodeAdmin(codeId: string, opts: { transport?: TheCodeAdminTransport } = {}): UseTheCodeAdmin {
  const transport = useMemo(() => opts.transport ?? createHttpTransport(), [opts.transport]);

  const [phase, setPhase] = useState<LivePhase>({ kind: 'loading' });
  const [state, setStateView] = useState<AdminState | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [notice, setNotice] = useState<AdminNotice | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState<number | null>(null);

  // The truth lives in refs so timers / unload handlers never see a stale closure.
  const stateRef = useRef<AdminState | null>(null);
  const baselineRef = useRef<Content | null>(null);
  const versionRef = useRef(0);
  const inFlight = useRef(false);
  const timer = useRef<number | null>(null);
  const failures = useRef(0);
  const halted = useRef<false | 'conflict' | 'failed'>(false);
  const exitSaveSent = useRef(false);
  const mounted = useRef(true);

  const commit = useCallback((next: AdminState) => {
    stateRef.current = next;
    setStateView(next);
  }, []);

  const isDirty = () => !!stateRef.current && !!baselineRef.current && !same(contentOf(stateRef.current), baselineRef.current);

  const clearTimer = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };

  // ---------------------------------------------------------------- save loop
  const flushRef = useRef<() => Promise<void>>(async () => undefined);

  const schedule = useCallback((delay = SAVE_DEBOUNCE_MS) => {
    if (halted.current) return;
    clearTimer();
    if (!inFlight.current) setSaveState(isDirty() ? 'pending' : 'saved');
    timer.current = window.setTimeout(() => void flushRef.current(), delay);
  }, []);

  const flush = useCallback(async () => {
    clearTimer();
    const local = stateRef.current;
    if (!local || halted.current) return;
    if (inFlight.current) return; // the running save re-checks when it lands
    if (!isDirty()) {
      setSaveState('saved');
      return;
    }

    const sent = contentOf(local);
    inFlight.current = true;
    setSaveState('saving');
    const res = await transport.save({ codeId, baseVersion: versionRef.current, config: sent.config, riddles: sent.riddles });
    inFlight.current = false;
    if (!mounted.current) return;

    if (res.ok) {
      failures.current = 0;
      versionRef.current = res.version;
      const { next, baseline } = mergeSaved({ config: res.config, riddles: res.riddles }, sent, contentOf(stateRef.current!));
      baselineRef.current = baseline;
      commit({ ...stateRef.current!, ...next });
      setSavedAt(Date.now());
      setIsNew(false);
      // Clear a stale "save failed" / refused-publish notice once things go through again.
      setNotice((n) => (n && n.tone !== 'warning' ? null : n));
      if (isDirty()) schedule(250); // edits made while this one was in flight
      else setSaveState('saved');
      return;
    }

    switch (res.error) {
      case 'conflict':
        halted.current = 'conflict';
        setSaveState('conflict');
        setNotice({
          tone: 'danger',
          title: 'ההרפתקה השתנתה בחלון אחר',
          text: 'מישהו (או לשונית אחרת שלכם) שמר שינויים אחרי שפתחתם את הדף. כדי לא לדרוס אותם, השמירה כאן נעצרה. טענו מחדש כדי לראות את הגרסה העדכנית. השינויים שעשיתם כאן מאז השמירה האחרונה לא יישמרו.',
          action: { label: 'טענו מחדש', run: () => reloadRef.current() },
        });
        return;
      case 'invalid': {
        const reverted = revertStatus(contentOf(stateRef.current!), baselineRef.current!);
        commit({ ...stateRef.current!, ...reverted });
        setNotice({
          tone: 'danger',
          title: 'עוד אי אפשר לפרסם',
          text: 'השרת מצא דברים שחוסמים פרסום. ההרפתקה נשארה במצב הקודם. תקנו ונסו שוב:',
          issues: res.issues.filter((i: TheCodeIssue) => i.severity === 'error'),
          onDismiss: () => setNotice(null),
        });
        if (isDirty()) schedule(SAVE_DEBOUNCE_MS);
        else setSaveState('saved');
        return;
      }
      case 'badRequest':
        halted.current = 'failed';
        setSaveState('failed');
        return;
      case 'unauthorized':
        halted.current = 'failed';
        setSaveState('failed');
        setNotice({ tone: 'warning', title: 'ההתחברות פגה', text: 'התחברו שוב בלשונית אחרת ואז לחצו "נסו שוב". השינויים שלכם עדיין כאן.' });
        return;
      case 'forbidden':
        halted.current = 'failed';
        setSaveState('failed');
        setNotice({ tone: 'danger', title: 'אין לכם הרשאה לשמור', text: 'רק הבעלים של הקוד יכולים לערוך את ההרפתקה.' });
        return;
      default: {
        // network / server: retry with backoff; never drop the edits.
        failures.current++;
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          setSaveState('offline');
          return; // the 'online' listener resumes
        }
        setSaveState('retrying');
        const delay = Math.min(MAX_BACKOFF_MS, 1500 * 2 ** (failures.current - 1));
        clearTimer();
        timer.current = window.setTimeout(() => void flushRef.current(), delay);
      }
    }
  }, [codeId, commit, schedule, transport]);
  flushRef.current = flush;

  // ---------------------------------------------------------------- load
  const load = useCallback(async (mode: 'initial' | 'reload') => {
    const first = mode === 'initial' || !stateRef.current;
    if (first) setPhase({ kind: 'loading' });
    const res = await transport.load(codeId);
    if (!mounted.current) return;
    if (!res.ok) {
      if (first) setPhase({ kind: 'error', error: res.error });
      else setNotice({ tone: 'danger', title: 'הטעינה נכשלה', text: 'בדקו את החיבור ונסו שוב.', action: { label: 'נסו שוב', run: () => reloadRef.current() } });
      return;
    }
    const d = res.data;
    clearTimer();
    halted.current = false;
    failures.current = 0;
    versionRef.current = d.version;
    const next: AdminState = { config: d.config, riddles: d.riddles, gnomeStats: d.gnomeStats, riddleStats: d.riddleStats, players: d.players };
    baselineRef.current = contentOf(next);
    commit(next);
    setIsNew(d.version === 0);
    setSaveState('saved');
    setNotice(null);
    setRefreshedAt(Date.now());
    setPhase({ kind: 'ready' });
  }, [codeId, commit, transport]);

  const reloadRef = useRef<() => void>(() => undefined);
  reloadRef.current = () => void load('reload');

  useEffect(() => {
    mounted.current = true;
    void load('initial');
    return () => {
      mounted.current = false;
      clearTimer();
    };
  }, [load]);

  // ---------------------------------------------------------------- leaving the page
  useEffect(() => {
    const unsaved = () => isDirty() || inFlight.current;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!unsaved()) return;
      e.preventDefault();
      e.returnValue = '';
    };
    const onHide = () => {
      if (document.visibilityState === 'hidden' && isDirty() && !halted.current) void flushRef.current();
    };
    const onPageHide = () => {
      if (!isDirty() || halted.current || inFlight.current || !transport.saveOnExit) return;
      const c = contentOf(stateRef.current!);
      exitSaveSent.current = transport.saveOnExit({ codeId, baseVersion: versionRef.current, config: c.config, riddles: c.riddles });
    };
    const onPageShow = (e: PageTransitionEvent) => {
      // Back from the bfcache after a keepalive save: our version is stale now → reload.
      if (e.persisted && exitSaveSent.current) {
        exitSaveSent.current = false;
        reloadRef.current();
      }
    };
    const onOnline = () => {
      if (isDirty() && !halted.current) {
        failures.current = 0;
        void flushRef.current();
      }
    };
    const onOffline = () => {
      if (isDirty()) setSaveState((s) => (s === 'saving' ? s : 'offline'));
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [codeId, transport]);

  // ---------------------------------------------------------------- actions
  const actions = useMemo<AdminActions>(() => {
    const set = (fn: (s: AdminState) => AdminState) => {
      const cur = stateRef.current;
      if (!cur) return;
      commit(fn(cur));
      schedule();
    };
    const base = createAdminActions(set, { localCodes: false, reset: () => reloadRef.current() });

    const players = (fn: (s: AdminState) => AdminState) => {
      const cur = stateRef.current;
      if (cur) commit(fn(cur)); // players are not part of the PUT — no save scheduled
    };
    const local = createAdminActions(players, { localCodes: false, reset: () => undefined });

    const playerFailed = (what: string) =>
      setNotice({ tone: 'danger', title: what, text: 'בדקו את החיבור ונסו שוב. שום דבר לא השתנה.', onDismiss: () => setNotice(null) });

    return {
      ...base,
      setStatus: (status) => {
        base.setStatus(status);
        schedule(0); // publish / pause go out at once
      },
      updatePlayer: (id, patch) => {
        const before = stateRef.current?.players;
        local.updatePlayer(id, patch);
        void transport.patchPlayer({ codeId, playerId: id, patch }).then((r) => {
          if (r.ok || !mounted.current || !before) return;
          const cur = stateRef.current;
          if (cur) commit({ ...cur, players: before });
          playerFailed(patch.familyName !== undefined ? 'שינוי השם נכשל' : 'השינוי נכשל');
        });
      },
      deletePlayer: (id) => {
        const before = stateRef.current?.players;
        local.deletePlayer(id);
        void transport.deletePlayer({ codeId, playerId: id }).then((r) => {
          if (r.ok || !mounted.current || !before) return;
          const cur = stateRef.current;
          if (cur) commit({ ...cur, players: before });
          playerFailed('ההסרה נכשלה');
        });
      },
      removePlayerPhoto: (id) => {
        const before = stateRef.current?.players;
        local.removePlayerPhoto(id);
        void transport.removePhoto({ codeId, playerId: id }).then((r) => {
          if (r.ok || !mounted.current || !before) return;
          const cur = stateRef.current;
          if (cur) commit({ ...cur, players: before });
          playerFailed('הסרת התמונה נכשלה');
        });
      },
    };
  }, [codeId, commit, schedule, transport]);

  // ---------------------------------------------------------------- refresh (stats + families)
  const refresh = useCallback(async () => {
    setRefreshing(true);
    const res = await transport.load(codeId);
    if (!mounted.current) return;
    setRefreshing(false);
    if (!res.ok) {
      setNotice({ tone: 'warning', title: 'הרענון נכשל', text: 'הנתונים שעל המסך עדיין תקפים. נסו שוב בעוד רגע.', onDismiss: () => setNotice(null) });
      return;
    }
    const d = res.data;
    const cur = stateRef.current;
    if (!cur) return;
    setRefreshedAt(Date.now());
    if (d.version > versionRef.current && !inFlight.current) {
      if (!isDirty()) {
        // Saved elsewhere and nothing pending here → adopt it quietly.
        versionRef.current = d.version;
        const next: AdminState = { config: d.config, riddles: d.riddles, gnomeStats: d.gnomeStats, riddleStats: d.riddleStats, players: d.players };
        baselineRef.current = contentOf(next);
        commit(next);
        return;
      }
      // Our next save will hit the conflict anyway — say it now.
      halted.current = 'conflict';
      clearTimer();
      setSaveState('conflict');
      setNotice({
        tone: 'danger',
        title: 'ההרפתקה השתנתה בחלון אחר',
        text: 'יש כאן שינויים שלא נשמרו, ומישהו אחר שמר בינתיים. טענו מחדש כדי לראות את הגרסה העדכנית.',
        action: { label: 'טענו מחדש', run: () => reloadRef.current() },
      });
    }
    commit({ ...stateRef.current!, gnomeStats: withLocalVerified(d.gnomeStats, stateRef.current!), riddleStats: d.riddleStats, players: d.players });
  }, [codeId, commit, transport]);

  const retry = useCallback(() => {
    if (halted.current === 'conflict') return;
    halted.current = false;
    failures.current = 0;
    setNotice((n) => (n?.tone === 'warning' ? null : n));
    void flushRef.current();
  }, []);

  const uploadVideo = useCallback<VideoUploader>((slot, file, onProgress) => transport.uploadLobbyVideo(codeId, slot, file, onProgress), [codeId, transport]);
  const uploadImage = useCallback<ImageUploader>((file, onProgress, opts) => transport.uploadImage(codeId, file, onProgress, opts), [codeId, transport]);

  return {
    phase,
    state,
    actions,
    saveState,
    savedAt,
    isNew,
    notice,
    retry,
    reload: () => reloadRef.current(),
    refresh: () => void refresh(),
    refreshing,
    refreshedAt,
    uploadImage,
    uploadVideo,
  };
}

/** Setup-mode verifications made in this tab are local-only; keep them across a stats refresh. */
function withLocalVerified(server: AdminState['gnomeStats'], s: AdminState): AdminState['gnomeStats'] {
  const out: AdminState['gnomeStats'] = { ...server };
  for (const [id, st] of Object.entries(s.gnomeStats)) {
    if (st.verifiedAt) out[id] = { ...(server[id] || { scans: 0 }), verifiedAt: st.verifiedAt };
  }
  return out;
}
