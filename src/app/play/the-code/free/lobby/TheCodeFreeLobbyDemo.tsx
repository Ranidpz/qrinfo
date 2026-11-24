'use client';

// קוד הגמדים — big screen DEMO for the free game (dev only). Fake groups drive the SAME stage the
// live lobby uses (LobbyStage, unchanged). Free mode has no suitcases: the beats are riddles
// solved, hot groups and NEW GROUPS — each new group gets the full-screen JoinCelebration and then
// walks into the selfie parade. The corner panel (demo only) fakes a scan and a join.
// Cliostro's clips: ?idle=… (the story loop), ?explain=…, ?after=… — like /play/the-code/lobby.

import { useCallback, useEffect, useRef, useState } from 'react';
import LobbyStage, { useLobbyStage, type LobbyMoment, type LobbyPhase, type LobbyTeam } from '@/components/thecode/live/lobby/LobbyStage';
import JoinCelebration, { type JoinEvent } from '@/components/thecode/free/JoinCelebration';

const svgUri = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/** A drawn stand-in for a group selfie (no real photos in the demo). */
function face(bg: string, skin: string, hair: string, shirt: string): string {
  return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<rect width="100" height="100" fill="${bg}"/>
<ellipse cx="50" cy="104" rx="40" ry="26" fill="${shirt}"/>
<circle cx="50" cy="48" r="24" fill="${skin}"/>
<path d="M26 46 q2 -26 24 -26 q24 0 24 26 q-6 -12 -24 -12 q-18 0 -24 12z" fill="${hair}"/>
<circle cx="41" cy="50" r="3" fill="#2B1B10"/><circle cx="59" cy="50" r="3" fill="#2B1B10"/>
<path d="M40 60 q10 9 20 0" stroke="#2B1B10" stroke-width="3" fill="none" stroke-linecap="round"/>
</svg>`);
}

const SELFIES = [
  face('#7EC8FF', '#F2C29B', '#4A2C17', '#FF8A2B'),
  face('#FFD978', '#C98D5E', '#1E1410', '#36E39A'),
  face('#C9A7FF', '#F6D2B8', '#D9A441', '#5AA9FF'),
  face('#FFB3BD', '#8D5A3B', '#120C08', '#F4B740'),
  face('#9BE7C4', '#E8B48C', '#7A3E12', '#FF5468'),
  face('#FFC79A', '#F6D2B8', '#2E2A26', '#7EC8FF'),
  face('#B8C6FF', '#A86F4A', '#120C08', '#FFD978'),
  face('#FFE08A', '#F2C29B', '#B8571F', '#C9A7FF'),
];

type Team = LobbyTeam & { hot: boolean };

const START: Team[] = [
  { id: 't1', name: 'הנמרים מקומה 3', avatar: SELFIES[0], points: 900, hot: false, gnomesFound: 9 },
  { id: 't2', name: 'צוות הינשופים', avatar: '🦉', points: 750, hot: true, gnomesFound: 7 },
  { id: 't3', name: 'הדולפינים', avatar: SELFIES[4], points: 600, hot: false, gnomesFound: 6 },
  { id: 't4', name: 'הבלשים', avatar: SELFIES[1], points: 450, hot: false, gnomesFound: 5 },
  { id: 't5', name: 'הצבים המהירים', avatar: '🐢', points: 300, hot: false, gnomesFound: 3 },
];

const JOINERS: { name: string; avatar: string }[] = [
  { name: 'שועלי הלילה', avatar: SELFIES[2] },
  { name: 'הדבורים', avatar: '🐝' },
  { name: 'הנינג׳ות', avatar: SELFIES[3] },
  { name: 'האריות הקטנים', avatar: SELFIES[7] },
  { name: 'צוות ירח', avatar: SELFIES[6] },
  { name: 'כוכבי הבריכה', avatar: SELFIES[5] },
];

/** One beat per tick; a join every few beats so a recording always catches one. */
const SCRIPT = ['solve', 'join', 'solve', 'half', 'hot', 'solve', 'join', 'solve'] as const;
const TICK_MS = 4200;

const sortTeams = (t: Team[]) => [...t].sort((a, b) => b.points - a.points);

function readSlots(): Record<LobbyPhase, string | null> {
  const q = new URLSearchParams(window.location.search);
  const ok = (v: string | null) => (v && /^(https?:\/\/|\/)/.test(v) ? v : null);
  return { idle: ok(q.get('idle')), explain: ok(q.get('explain')), after: ok(q.get('after')) };
}

function DemoPanel({ phase, onScan, onJoin, busy }: { phase: LobbyPhase; onScan(): void; onJoin(): void; busy: boolean }) {
  const label = phase === 'idle' ? 'המתנה' : phase === 'explain' ? 'הסבר' : 'אחרי ההסבר';
  return (
    <div dir="rtl" className="fixed bottom-[2vh] right-[1.5vw] z-[60] flex items-center gap-3 rounded-2xl bg-white/90 px-4 py-3 text-slate-900 shadow-2xl">
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">הדגמה בלבד</span>
      <span className="text-sm">מצב: <b>{label}</b></span>
      <button type="button" onClick={onJoin} disabled={busy}
        className="min-h-[40px] rounded-xl bg-slate-900 px-3 text-sm font-semibold text-white active:scale-95 disabled:opacity-40">
        מצטרפים חדשים
      </button>
      <button type="button" onClick={onScan} className="min-h-[40px] rounded-xl bg-white px-3 text-sm font-semibold ring-1 ring-slate-300 active:scale-95">
        מדמים סריקה
      </button>
    </div>
  );
}

export default function TheCodeFreeLobbyDemo() {
  const stage = useLobbyStage();
  const { setBoard, pushMoments } = stage;
  const [url, setUrl] = useState('');
  const [slots, setSlots] = useState<Record<LobbyPhase, string | null>>({ idle: null, explain: null, after: null });
  const [join, setJoin] = useState<JoinEvent | null>(null);
  const teamsRef = useRef<Team[]>(START);
  const joinIdx = useRef(0);
  const tick = useRef(0);

  useEffect(() => {
    setUrl(`${window.location.origin}/v/demo-gnomes?src=lobby`);
    setSlots(readSlots());
    setBoard(sortTeams(START));
  }, [setBoard]);

  const current = useRef<JoinEvent | null>(null);
  const startJoin = useCallback(() => {
    if (current.current) return;
    const j = JOINERS[joinIdx.current % JOINERS.length];
    const ev = { key: ++joinIdx.current, name: j.name, avatar: j.avatar };
    current.current = ev;
    setJoin(ev);
  }, []);

  // The celebration is over → the group is on the board (and, with a selfie, in the parade).
  const onJoinDone = useCallback(() => {
    const cur = current.current;
    if (!cur) return;
    current.current = null;
    const team: Team = { id: `j${cur.key}`, name: cur.name, avatar: cur.avatar, points: 0, hot: false, gnomesFound: 0 };
    teamsRef.current = [...teamsRef.current, team];
    setBoard(sortTeams(teamsRef.current));
    setJoin(null);
  }, [setBoard]);

  useEffect(() => {
    const t = setInterval(() => {
      if (current.current) return; // the room watches the new group; the board waits
      const beat = SCRIPT[tick.current++ % SCRIPT.length];
      if (beat === 'join') { startJoin(); return; }
      const next = teamsRef.current.map((x) => ({ ...x }));
      const team = next[Math.floor(Math.random() * next.length)];
      const moments: LobbyMoment[] = [];
      if (beat === 'hot' && !team.hot) {
        team.hot = true;
        moments.push({ kind: 'hot', name: team.name, avatar: team.avatar });
      }
      const base = beat === 'half' ? 50 : 100;
      team.points += team.hot ? base * 2 : base;
      team.gnomesFound = (team.gnomesFound ?? 0) + 1;
      teamsRef.current = next;
      setBoard(sortTeams(next));
      pushMoments(moments);
    }, TICK_MS);
    return () => clearInterval(t);
  }, [setBoard, pushMoments, startJoin]);

  return (
    <LobbyStage stage={stage} gameName="אחוזת הגמדים" subtitle="הטבלה של השבוע" qrUrl={url} videos={slots} placeholderLabels free
      aside={<>במשחק עכשיו: <span className="tc-num" style={{ color: 'var(--tc-brass-hi)' }}>{stage.teams.length}</span></>}>
      {join && <JoinCelebration event={join} onDone={onJoinDone} />}
      <DemoPanel phase={stage.phase} onScan={() => stage.scan()} onJoin={startJoin} busy={!!join} />
    </LobbyStage>
  );
}
