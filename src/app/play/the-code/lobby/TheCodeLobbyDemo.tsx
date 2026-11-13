'use client';

// קוד הגמדים — the big screen DEMO (dev only; production redirects to the guide). Fake groups
// that change by themselves drive the SAME stage the live lobby uses
// (src/components/thecode/live/lobby/LobbyStage.tsx). The corner panel fakes a scan of the QR.
// Real videos can be tried with ?idle=…&explain=…&after=… (any URL or a file in /public).

import { useEffect, useRef, useState } from 'react';
import LobbyStage, { useLobbyStage, type LobbyMoment, type LobbyPhase, type LobbyTeam } from '@/components/thecode/live/lobby/LobbyStage';

// ------------------------------------------------ fake data

const svgUri = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/** A drawn stand-in for a team selfie (no real photos in the demo). */
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


// Most demo groups shared a selfie, so the selfie parade has walkers (with 8+ they take turns).
const START: Team[] = [
  { id: 't1', name: 'הנמרים מקומה 3', avatar: SELFIES[0], points: 1240, hot: false, gnomesFound: 8, suitcases: 1 },
  { id: 't2', name: 'צוות הינשופים', avatar: '🦉', points: 980, hot: true, gnomesFound: 7, suitcases: 1 },
  { id: 't3', name: 'הדולפינים', avatar: SELFIES[4], points: 860, hot: false, gnomesFound: 6, suitcases: 0 },
  { id: 't4', name: 'הבלשים', avatar: SELFIES[1], points: 720, hot: false, gnomesFound: 5, suitcases: 0 },
  { id: 't5', name: 'כוכבי הבריכה', avatar: SELFIES[5], points: 540, hot: false, gnomesFound: 4, suitcases: 0 },
  { id: 't6', name: 'הצבים המהירים', avatar: '🐢', points: 410, hot: false, gnomesFound: 3, suitcases: 0 },
  { id: 't7', name: 'צוות ירח', avatar: SELFIES[6], points: 260, hot: false, gnomesFound: 2, suitcases: 0 },
];

const JOINERS: Omit<Team, 'points' | 'hot'>[] = [
  { id: 'j1', name: 'שועלי הלילה', avatar: SELFIES[2] },
  { id: 'j2', name: 'הדבורים', avatar: '🐝' },
  { id: 'j3', name: 'הנינג׳ות', avatar: SELFIES[3] },
  { id: 'j4', name: 'האריות הקטנים', avatar: SELFIES[7] },
  { id: 'j5', name: 'צוות ברק', avatar: '⚡' },
];

type Team = LobbyTeam & { hot: boolean };

/** A drawn, transparent sample venue logo (no external URLs in the demo). */
const DEMO_VENUE_LOGO = svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 120">
<g fill="#F4D58D" stroke="#F4D58D">
<path d="M40 70 L52 34 L70 58 L88 26 L106 58 L124 34 L136 70 Z" stroke-width="2" stroke-linejoin="round"/>
<rect x="40" y="74" width="96" height="10" rx="3"/>
<circle cx="52" cy="32" r="5"/><circle cx="88" cy="22" r="6"/><circle cx="124" cy="32" r="5"/>
</g>
<text x="152" y="66" font-family="Georgia, serif" font-size="34" font-weight="700" fill="#FFF4DA" letter-spacing="2">QUEEN</text>
<text x="152" y="100" font-family="Georgia, serif" font-size="26" fill="#F4D58D" letter-spacing="5">OF SHEBA</text>
</svg>`);

/** Event rhythm of the demo, one beat per tick (≈ a suitcase every 20 s). */
const SCRIPT = ['letter', 'suitcase', 'letter', 'join', 'hot', 'letter', 'letter', 'suitcase', 'join', 'letter', 'hot', 'letter'] as const;
const TICK_MS = 3800;

const sortTeams = (t: Team[]) => [...t].sort((a, b) => b.points - a.points);

function readSlots(): Record<LobbyPhase, string | null> {
  const q = new URLSearchParams(window.location.search);
  const ok = (v: string | null) => (v && /^(https?:\/\/|\/)/.test(v) ? v : null);
  return { idle: ok(q.get('idle')), explain: ok(q.get('explain')), after: ok(q.get('after')) };
}

/** Demo only (the real screen has no controls): a corner panel that fakes a scan of the opening QR. */
function DemoScanPanel({ phase, onScan }: { phase: LobbyPhase; onScan(): void }) {
  const label = phase === 'idle' ? 'המתנה' : phase === 'explain' ? 'הסבר' : 'אחרי ההסבר';
  return (
    <div dir="rtl" className="fixed bottom-[2vh] right-[1.5vw] z-[60] flex items-center gap-3 rounded-2xl bg-white/90 px-4 py-3 text-slate-900 shadow-2xl">
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">הדגמה בלבד</span>
      <span className="text-sm">מצב: <b>{label}</b></span>
      <button type="button" onClick={onScan} className="min-h-[40px] rounded-xl bg-slate-900 px-3 text-sm font-semibold text-white active:scale-95">
        מדמים סריקה
      </button>
    </div>
  );
}

export default function TheCodeLobbyDemo() {
  const stage = useLobbyStage();
  const { setBoard, pushMoments } = stage;
  const [url, setUrl] = useState('');
  // ?logo=0 → the screen without a venue logo
  const [logo, setLogo] = useState<string | null>(null);
  const [slots, setSlots] = useState<Record<LobbyPhase, string | null>>({ idle: null, explain: null, after: null });
  const teamsRef = useRef<Team[]>(START);
  const joinIdx = useRef(0);
  const tick = useRef(0);

  useEffect(() => {
    // The live screen links its own /v/{shortId}?src=lobby; the demo points at a sample code.
    setUrl(`${window.location.origin}/v/demo-gnomes?src=lobby`);
    setSlots(readSlots());
    setLogo(new URLSearchParams(window.location.search).get('logo') === '0' ? null : DEMO_VENUE_LOGO);
    setBoard(sortTeams(START));
  }, [setBoard]);

  // Fake events, one per tick.
  useEffect(() => {
    const t = setInterval(() => {
      let next = teamsRef.current.map((x) => ({ ...x }));
      // A fixed rhythm so a screen recording always catches every moment (groups stay random).
      const beat = SCRIPT[tick.current++ % SCRIPT.length];
      const pick = () => next[Math.floor(Math.random() * next.length)];
      const moments: LobbyMoment[] = [];
      const m = (kind: LobbyMoment['kind'], team: Team) => moments.push({ kind, name: team.name, avatar: team.avatar });

      if (beat === 'join' && joinIdx.current < JOINERS.length) {
        const team: Team = { ...JOINERS[joinIdx.current++], points: 100, hot: false, gnomesFound: 1, suitcases: 0 };
        next.push(team);
        m('join', team);
      } else if (beat === 'suitcase') {
        // A lower group opens a suitcase: the big climb.
        const sorted = sortTeams(next);
        const targetId = sorted[Math.min(sorted.length - 1, 2 + Math.floor(Math.random() * 4))].id;
        const team = next.find((x) => x.id === targetId)!;
        team.points += 500 + (team.hot ? 200 : 100);
        team.gnomesFound = (team.gnomesFound ?? 0) + 1;
        team.suitcases = (team.suitcases ?? 0) + 1;
        m('suitcase', team);
      } else if (beat === 'hot') {
        const cold = next.filter((x) => !x.hot);
        const team = cold.length ? cold[Math.floor(Math.random() * cold.length)] : pick();
        team.points += 200;
        team.gnomesFound = (team.gnomesFound ?? 0) + 1;
        if (!team.hot) { team.hot = true; m('hot', team); }
      } else {
        const team = pick();
        team.points += team.hot ? 200 : 100;
        team.gnomesFound = (team.gnomesFound ?? 0) + 1;
        if (Math.random() < 0.25) next = next.map((x) => (x.id === team.id ? x : { ...x, hot: x.hot && Math.random() > 0.3 }));
      }
      teamsRef.current = next;
      setBoard(sortTeams(next));
      pushMoments(moments);
    }, TICK_MS);
    return () => clearInterval(t);
  }, [setBoard, pushMoments]);

  return (
    <LobbyStage stage={stage} gameName="מלכת שבא אילת" logoUrl={logo} subtitle="הטבלה של השבוע" qrUrl={url} videos={slots} placeholderLabels
      aside={<><span className="tc-num" style={{ color: 'var(--tc-brass-hi)' }}>{stage.teams.length}</span> קבוצות משחקות עכשיו</>}>
      <DemoScanPanel phase={stage.phase} onScan={() => stage.scan()} />
    </LobbyStage>
  );
}
