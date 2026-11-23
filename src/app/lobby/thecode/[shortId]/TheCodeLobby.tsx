'use client';

// קוד הגמדים — the venue's big screen (TV, also inside the TVzone Android player). No controls.
// - Board: GET /api/thecode/leaderboard?scope=screen (top 10), polled; the period is the
//   operator's (this week by default, last week's board while this week is still empty, or
//   all time). Climbs and +points are worked out by comparing two boards (LobbyStage).
// - Live: the PUBLIC doc codes/{codeId}/thecodeLobby/live (onSnapshot, client SDK): videos,
//   live-moment events, and `lobbyScans` — a bump while idle/after starts the "how to play"
//   scene; bumps while it runs only count. Rules deny the read → the screen still shows the
//   board (polled) and the drawn scenes, it just never gets live moments.
// - The QR on screen → /v/{shortId}?src=lobby (that page reports the scan).

import { useCallback, useEffect, useRef, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { theCodeFont } from '@/components/thecode/live/font';
import { fetchLeaderboard } from '@/components/thecode/live/api';
import LobbyStage, { LOBBY_ROWS, useLobbyStage, type LobbyMoment } from '@/components/thecode/live/lobby/LobbyStage';
import JoinCelebration, { type JoinEvent } from '@/components/thecode/free/JoinCelebration';
import type { TheCodeBoardPeriod, TheCodeLobbyEvent, TheCodeLobbyLive } from '@/types/thecode-api';

const POLL_MS = 15000;
/** Groups the board keeps (the table shows LOBBY_ROWS of them; the parade may walk any). */
const PARADE_POOL = 40;
/** An event older than this when the screen first sees it is not replayed as a banner. */
const STALE_EVENT_MS = 60_000;

/** The board's own title — the screen must never claim a period it is not showing. */
const BOARD_TITLE: Record<TheCodeBoardPeriod, string> = {
  week: 'הטבלה של השבוע',
  lastWeek: 'הטבלה של שבוע שעבר',
  all: 'הטבלה של כל הזמנים',
};

const momentOf = (e: TheCodeLobbyEvent): LobbyMoment => ({
  kind: e.kind === 'joined' ? 'join' : e.kind,
  name: e.familyName,
  avatar: e.photoUrl || e.emoji,
});

export default function TheCodeLobby({ codeId, shortId, title, logoUrl }: { codeId: string | null; shortId: string; title: string; logoUrl: string | null }) {
  const stage = useLobbyStage(LOBBY_ROWS);
  const { setBoard, pushMoments, scan } = stage;
  const [videos, setVideos] = useState<TheCodeLobbyLive['videos']>({});
  // Absent in the live doc (an adventure saved before this) = selfies on, as everywhere else.
  const [selfies, setSelfies] = useState(true);
  const [qrUrl, setQrUrl] = useState('');
  const [board, setBoardPeriod] = useState<TheCodeBoardPeriod>('week');
  const seenEvents = useRef<Set<string> | null>(null);
  // Free mode: every new group gets the full-screen celebration (one at a time), not a banner.
  const freeRef = useRef(false);
  const [joins, setJoins] = useState<JoinEvent[]>([]);
  const joinSeq = useRef(0);
  const routeEvents = useCallback((events: TheCodeLobbyEvent[]) => {
    if (!freeRef.current) { pushMoments(events.map(momentOf)); return; }
    const joined = events.filter((e) => e.kind === 'joined');
    pushMoments(events.filter((e) => e.kind !== 'joined').map(momentOf));
    if (joined.length) {
      setJoins((q) => [...q, ...joined.map((e) => ({ key: ++joinSeq.current, name: e.familyName, avatar: e.photoUrl || e.emoji }))].slice(-6));
    }
  }, [pushMoments]);
  const onJoinDone = useCallback(() => setJoins((q) => q.slice(1)), []);
  const lastScans = useRef<number | null>(null);

  useEffect(() => {
    setQrUrl(`${window.location.origin}/v/${encodeURIComponent(shortId)}?src=lobby`);
  }, [shortId]);

  // Board — polled; a failed poll keeps the last good board.
  useEffect(() => {
    if (!codeId) return;
    let alive = true;
    const load = () => {
      void fetchLeaderboard(codeId, 'screen').then((b) => {
        if (!alive || !b) return;
        setBoardPeriod(b.board || b.scope);
        // More rows than the table shows: the parade walks the top 10 groups WITH a selfie,
        // which can include groups below the table's top 10.
        setBoard(b.rows.slice(0, PARADE_POOL).map((r) => ({
          id: r.id, name: r.familyName, avatar: r.photoUrl || r.emoji, points: r.points,
          gnomesFound: r.gnomesFound, suitcases: r.suitcases,
        })));
      });
    };
    load();
    const t = setInterval(load, POLL_MS);
    return () => { alive = false; clearInterval(t); };
  }, [codeId, setBoard]);

  // Live doc — scans, moments, videos in about a second.
  useEffect(() => {
    if (!codeId) return;
    const unsub = onSnapshot(doc(db, 'codes', codeId, 'thecodeLobby', 'live'), (snap) => {
      const live = (snap.data() || null) as TheCodeLobbyLive | null;
      setVideos(live?.videos || {});
      setSelfies(live?.selfies !== false);
      freeRef.current = live?.mode === 'free';
      const events = Array.isArray(live?.events) ? live!.events : [];
      const scans = typeof live?.lobbyScans === 'number' ? live.lobbyScans : 0;

      if (seenEvents.current === null) {
        // First look: only very fresh events play (a screen switched on mid-game stays calm).
        seenEvents.current = new Set(events.map((e) => e.id));
        const now = Date.now();
        routeEvents(events.filter((e) => now - e.at < STALE_EVENT_MS).slice(-3));
        lastScans.current = scans;
        return;
      }
      const fresh = events.filter((e) => !seenEvents.current!.has(e.id));
      fresh.forEach((e) => seenEvents.current!.add(e.id));
      routeEvents(fresh);
      // A changed counter = scans of the on-screen QR (the director decides start vs count).
      const prev = lastScans.current ?? scans;
      lastScans.current = scans;
      // Free mode: the drawn explainer is the guided game's (suitcases, phrase) — skip it; the phone's
      // magician call explains. An uploaded explain clip still plays.
      if (scans > prev && (live?.mode !== 'free' || live?.videos?.explain)) scan(scans - prev);
    }, (err) => {
      // Rules not deployed yet / offline: the board still works without live moments.
      console.warn('[lobby/thecode] live doc unavailable', err?.code || err);
    });
    return () => unsub();
  }, [codeId, routeEvents, scan]);

  if (!codeId) {
    return (
      <div className={`${theCodeFont.variable} fixed inset-0 flex items-center justify-center bg-[#0B1030] text-[#FFF4DA]`}>
        <p dir="rtl" className="text-[5vh] font-bold">המשחק הזה לא נמצא</p>
      </div>
    );
  }

  return (
    <div className={theCodeFont.variable}>
      <LobbyStage stage={stage} gameName={title} logoUrl={logoUrl} subtitle={BOARD_TITLE[board]} qrUrl={qrUrl}
        videos={{ idle: videos?.idle, explain: videos?.explain, after: videos?.after }}
        inviteParade={selfies}>
        {joins[0] && <JoinCelebration key={joins[0].key} event={joins[0]} onDone={onJoinDone} />}
      </LobbyStage>
    </div>
  );
}
