'use client';

// קוד הגמדים — the venue's big screen (TV, also inside the TVzone Android player). No controls.
// - Board: GET /api/thecode/leaderboard (this week, top 10), polled; climbs and +points are
//   worked out by comparing two boards (LobbyStage).
// - Live: the PUBLIC doc codes/{codeId}/thecodeLobby/live (onSnapshot, client SDK): videos,
//   live-moment events, and `lobbyScans` — a bump while idle/after starts the "how to play"
//   scene; bumps while it runs only count. Rules deny the read → the screen still shows the
//   board (polled) and the drawn scenes, it just never gets live moments.
// - The QR on screen → /v/{shortId}?src=lobby (that page reports the scan).

import { useEffect, useRef, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { theCodeFont } from '@/components/thecode/live/font';
import { fetchLeaderboard } from '@/components/thecode/live/api';
import LobbyStage, { LOBBY_ROWS, useLobbyStage, type LobbyMoment } from '@/components/thecode/live/lobby/LobbyStage';
import type { TheCodeLobbyEvent, TheCodeLobbyLive } from '@/types/thecode-api';

const POLL_MS = 15000;
/** Groups the board keeps (the table shows LOBBY_ROWS of them; the parade may walk any). */
const PARADE_POOL = 40;
/** An event older than this when the screen first sees it is not replayed as a banner. */
const STALE_EVENT_MS = 60_000;

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
  const seenEvents = useRef<Set<string> | null>(null);
  const lastScans = useRef<number | null>(null);

  useEffect(() => {
    setQrUrl(`${window.location.origin}/v/${encodeURIComponent(shortId)}?src=lobby`);
  }, [shortId]);

  // Board — polled; a failed poll keeps the last good board.
  useEffect(() => {
    if (!codeId) return;
    let alive = true;
    const load = () => {
      void fetchLeaderboard(codeId, 'week').then((b) => {
        if (!alive || !b) return;
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
      const events = Array.isArray(live?.events) ? live!.events : [];
      const scans = typeof live?.lobbyScans === 'number' ? live.lobbyScans : 0;

      if (seenEvents.current === null) {
        // First look: only very fresh events play (a screen switched on mid-game stays calm).
        seenEvents.current = new Set(events.map((e) => e.id));
        const now = Date.now();
        pushMoments(events.filter((e) => now - e.at < STALE_EVENT_MS).slice(-3).map(momentOf));
        lastScans.current = scans;
        return;
      }
      const fresh = events.filter((e) => !seenEvents.current!.has(e.id));
      fresh.forEach((e) => seenEvents.current!.add(e.id));
      pushMoments(fresh.map(momentOf));
      // A changed counter = scans of the on-screen QR (the director decides start vs count).
      const prev = lastScans.current ?? scans;
      lastScans.current = scans;
      if (scans > prev) scan(scans - prev);
    }, (err) => {
      // Rules not deployed yet / offline: the board still works without live moments.
      console.warn('[lobby/thecode] live doc unavailable', err?.code || err);
    });
    return () => unsub();
  }, [codeId, pushMoments, scan]);

  if (!codeId) {
    return (
      <div className={`${theCodeFont.variable} fixed inset-0 flex items-center justify-center bg-[#0B1030] text-[#FFF4DA]`}>
        <p dir="rtl" className="text-[5vh] font-bold">המשחק הזה לא נמצא</p>
      </div>
    );
  }

  return (
    <div className={theCodeFont.variable}>
      <LobbyStage stage={stage} gameName={title} logoUrl={logoUrl} subtitle="הטבלה של השבוע" qrUrl={qrUrl}
        videos={{ idle: videos?.idle, explain: videos?.explain, after: videos?.after }}
        inviteParade={selfies} />
    </div>
  );
}
