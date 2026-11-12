'use client';

// קוד הגמדים — the big screen, DEMO (fake data that changes by itself; no server, no controls).
// What Rani asked for (the big screen is the players' first incentive):
//   א. a big QR with a gnome — "סרקו כאן והתחילו" → /v/{shortId} (the opening shot: start
//      without having to find a gnome first);
//   ב. live moments, one banner at a time: a team joined / opened a suitcase (+ confetti) / is hot;
//   ג. a team that climbs is highlighted and slides up;
//   ד. a team's selfie shows as its symbol.
// Large type for across-the-room reading. Motion = transform/opacity; reduced-motion respected
// by THECODE_STYLE (.tc-root) — the board still updates, it just doesn't animate.

import { useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import GnomeFigure from '@/components/thecode/GnomeFigure';
import { Avatar } from '@/components/thecode/player/Avatar';
import { THECODE_STYLE } from '@/components/thecode/player/styles';
import { Confetti, CountUp } from '@/components/thecode/player/ui';

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
];

interface Team { id: string; name: string; avatar: string; points: number; hot: boolean }

const START: Team[] = [
  { id: 't1', name: 'הנמרים מקומה 3', avatar: SELFIES[0], points: 1240, hot: false },
  { id: 't2', name: 'צוות הינשופים', avatar: '🦉', points: 980, hot: true },
  { id: 't3', name: 'הדולפינים', avatar: '🐬', points: 860, hot: false },
  { id: 't4', name: 'הבלשים', avatar: SELFIES[1], points: 720, hot: false },
  { id: 't5', name: 'כוכבי הבריכה', avatar: '🚀', points: 540, hot: false },
  { id: 't6', name: 'הצבים המהירים', avatar: '🐢', points: 410, hot: false },
  { id: 't7', name: 'צוות ירח', avatar: '🦄', points: 260, hot: false },
];

const JOINERS: Omit<Team, 'points' | 'hot'>[] = [
  { id: 'j1', name: 'שועלי הלילה', avatar: SELFIES[2] },
  { id: 'j2', name: 'הדבורים', avatar: '🐝' },
  { id: 'j3', name: 'הנינג׳ות', avatar: SELFIES[3] },
  { id: 'j4', name: 'האריות הקטנים', avatar: '🦁' },
  { id: 'j5', name: 'צוות ברק', avatar: '⚡' },
];

type Moment =
  | { kind: 'join'; team: Team }
  | { kind: 'suitcase'; team: Team }
  | { kind: 'hot'; team: Team };

const ROWS = 8;
const TICK_MS = 3800;
const BANNER_MS = 3600;

const sortTeams = (t: Team[]) => [...t].sort((a, b) => b.points - a.points);
const rankMap = (t: Team[]) => Object.fromEntries(sortTeams(t).map((x, i) => [x.id, i]));

// ------------------------------------------------ pieces (module scope: stable identity, no replayed entrances)

function MomentBanner({ m }: { m: Moment }) {
  const look = m.kind === 'suitcase'
    ? { bg: 'linear-gradient(90deg,#1F8F5F,#36E39A)', fg: '#03261A', icon: '🧳', text: `${m.team.name} פתחו מזוודה!` }
    : m.kind === 'hot'
      ? { bg: 'linear-gradient(90deg,#FF8A2B,#FFC24B)', fg: '#2A0E00', icon: '🔥', text: `${m.team.name} שחקנים חמים!` }
      : { bg: 'linear-gradient(90deg,#F4B740,#FFD978)', fg: '#2A1600', icon: '👋', text: `קבוצת ${m.team.name} הצטרפה!` };
  return (
    <div className="tc-a-stamp flex items-center gap-[1.6vw] rounded-full px-[2.6vw] py-[1.4vh]"
      style={{ background: look.bg, color: look.fg, boxShadow: '0 1.5vh 5vh rgba(0,0,0,.45)' }}>
      <span className="text-[5vh]" aria-hidden>{look.icon}</span>
      <Avatar value={m.team.avatar} size={64} />
      <span className="tc-display text-[4.6vh] leading-none">{look.text}</span>
    </div>
  );
}

function QrCard({ url }: { url: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-[3vh] rounded-[4vh] px-[2.5vw] py-[4vh] text-center"
      style={{ background: 'linear-gradient(180deg, rgba(244,183,64,.16), rgba(244,183,64,.05))', boxShadow: 'inset 0 0 0 3px rgba(244,183,64,.45)' }}>
      <p className="tc-display text-[6.4vh] leading-none" style={{ color: 'var(--tc-brass-hi)' }}>סרקו כאן והתחילו</p>
      <div className="relative">
        <div className="rounded-[3vh] bg-white p-[2vh]" style={{ boxShadow: '0 2vh 6vh rgba(0,0,0,.45)' }}>
          {url ? <QRCodeSVG value={url} size={300} level="M" style={{ width: '32vh', height: '32vh', display: 'block' }} /> : <div style={{ width: '32vh', height: '32vh' }} />}
        </div>
        <span className="tc-a-bob absolute -bottom-[3vh] -left-[7vh]" aria-hidden>
          <GnomeFigure bodyColor="green" hatColor="red" size={150} />
        </span>
      </div>
      <p className="text-[3.4vh] leading-snug" style={{ color: 'var(--tc-cream)' }}>
        הגמד הראשון מחכה לכם כאן.<br />אחריו — חפשו את השאר במקום!
      </p>
    </div>
  );
}

// ------------------------------------------------ screen

export default function TheCodeLobbyDemo() {
  const [teams, setTeams] = useState<Team[]>(START);
  const [queue, setQueue] = useState<Moment[]>([]);
  const [banner, setBanner] = useState<{ m: Moment; key: number } | null>(null);
  const [climb, setClimb] = useState<Record<string, { by: number; key: number }>>({});
  const [delta, setDelta] = useState<Record<string, { amount: number; key: number }>>({});
  const [url, setUrl] = useState('');
  const seq = useRef(1);
  const teamsRef = useRef(teams);
  const joinIdx = useRef(0);

  useEffect(() => {
    // The live screen links its own /v/{shortId}; the demo points at a sample code.
    setUrl(`${window.location.origin}/v/demo-gnomes`);
  }, []);

  // Fake events, one per tick.
  useEffect(() => {
    const t = setInterval(() => {
      const before = teamsRef.current;
      let next = before.map((x) => ({ ...x }));
      const r = Math.random();
      const pick = () => next[Math.floor(Math.random() * next.length)];
      const moments: Moment[] = [];
      const deltas: Record<string, number> = {};
      const add = (team: Team, n: number) => { team.points += n; deltas[team.id] = n; };

      if (r < 0.16 && joinIdx.current < JOINERS.length) {
        const j = JOINERS[joinIdx.current++];
        const team: Team = { ...j, points: 100, hot: false };
        next.push(team);
        deltas[team.id] = 100;
        moments.push({ kind: 'join', team });
      } else if (r < 0.32) {
        // A lower team opens a suitcase: the big climb.
        const sorted = sortTeams(next);
        const targetId = sorted[Math.min(sorted.length - 1, 2 + Math.floor(Math.random() * 4))].id;
        const team = next.find((x) => x.id === targetId)!;
        add(team, 500 + (team.hot ? 200 : 100));
        moments.push({ kind: 'suitcase', team });
      } else if (r < 0.46) {
        const cold = next.filter((x) => !x.hot);
        const team = cold.length ? cold[Math.floor(Math.random() * cold.length)] : pick();
        if (!team.hot) {
          team.hot = true;
          add(team, 200);
          moments.push({ kind: 'hot', team });
        } else {
          add(team, 200);
        }
      } else {
        const team = pick();
        add(team, team.hot ? 200 : 100);
        if (Math.random() < 0.25) next = next.map((x) => (x.id === team.id ? x : { ...x, hot: x.hot && Math.random() > 0.3 }));
      }

      const was = rankMap(before);
      const now = rankMap(next);
      const k = seq.current++;
      const climbs: Record<string, { by: number; key: number }> = {};
      for (const id of Object.keys(now)) {
        if (was[id] !== undefined && now[id] < was[id] && now[id] < ROWS) climbs[id] = { by: was[id] - now[id], key: k };
      }
      teamsRef.current = next;
      setTeams(next);
      if (Object.keys(climbs).length) setClimb((c) => ({ ...c, ...climbs }));
      setDelta((d) => ({ ...d, ...Object.fromEntries(Object.entries(deltas).map(([id, amount]) => [id, { amount, key: k }])) }));
      if (moments.length) setQueue((q) => [...q, ...moments]);
    }, TICK_MS);
    return () => clearInterval(t);
  }, []);

  // One banner at a time.
  useEffect(() => {
    if (banner || !queue.length) return;
    const [m, ...rest] = queue;
    setQueue(rest);
    setBanner({ m, key: seq.current++ });
  }, [banner, queue]);
  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), BANNER_MS);
    return () => clearTimeout(t);
  }, [banner]);

  // Highlights fade after a few seconds.
  useEffect(() => {
    if (!Object.keys(climb).length) return;
    const t = setTimeout(() => setClimb({}), 3200);
    return () => clearTimeout(t);
  }, [climb]);

  const ranks = useMemo(() => rankMap(teams), [teams]);
  const ROW_VH = 8.6;

  return (
    <div className="fixed inset-0">
      <div dir="rtl" lang="he" className="tc-root flex flex-col px-[3.5vw] py-[4vh]">
        <style>{THECODE_STYLE}</style>
        <div className="tc-stars" aria-hidden />
        {banner?.m.kind === 'suitcase' && <Confetti burstKey={banner.key} />}

        <header className="relative flex items-end justify-between">
          <div>
            <h1 className="tc-display text-[9vh] leading-none" style={{ color: 'var(--tc-brass)', textShadow: '0 4px 0 #6E400C, 0 18px 40px rgba(244,183,64,.35)' }}>קוד הגמדים</h1>
            <p className="mt-[1vh] text-[3.2vh]" style={{ color: 'var(--tc-soft)' }}>הטבלה של השבוע</p>
          </div>
          <p className="tc-display text-[3.4vh]" style={{ color: 'var(--tc-soft)' }}>
            <span className="tc-num" style={{ color: 'var(--tc-brass-hi)' }}>{teams.length}</span> קבוצות משחקות עכשיו
          </p>
        </header>

        {/* live moment, one at a time */}
        <div aria-live="polite" className="pointer-events-none absolute inset-x-0 top-[3vh] z-20 flex justify-center">
          {banner && <MomentBanner key={banner.key} m={banner.m} />}
        </div>

        <div className="relative mt-[3vh] flex min-h-0 flex-1 gap-[3vw]">
          {/* board */}
          <ol className="relative flex-[1.55] overflow-hidden" style={{ height: `${ROWS * ROW_VH}vh` }} aria-label="טבלת הקבוצות">
            {teams.map((t) => {
              const rank = ranks[t.id];
              const shown = rank < ROWS;
              const up = climb[t.id];
              const d = delta[t.id];
              return (
                <li key={t.id} className="tc-row-move absolute inset-x-0 flex items-center gap-[1.4vw] rounded-[2vh] px-[1.6vw]"
                  style={{
                    top: 0,
                    height: `${ROW_VH - 1.2}vh`,
                    transform: `translateY(${rank * ROW_VH}vh) scale(${up ? 1.03 : 1})`,
                    opacity: shown ? 1 : 0,
                    zIndex: up ? 3 : 1,
                    background: up
                      ? 'linear-gradient(90deg, rgba(54,227,154,.32), rgba(54,227,154,.08))'
                      : rank < 3 ? 'linear-gradient(90deg, rgba(244,183,64,.25), rgba(244,183,64,.06))' : 'var(--tc-panel)',
                    boxShadow: up ? 'inset 0 0 0 3px var(--tc-mint), 0 0 4vh rgba(54,227,154,.35)'
                      : rank < 3 ? 'inset 0 0 0 2px rgba(244,183,64,.5)' : 'inset 0 0 0 1px var(--tc-line)',
                  }}>
                  <span className="tc-num w-[4.5vw] text-center text-[4.2vh]" style={{ color: rank < 3 ? 'var(--tc-brass)' : 'var(--tc-soft)' }}>
                    {['🥇', '🥈', '🥉'][rank] ?? rank + 1}
                  </span>
                  <Avatar value={t.avatar} size={60} />
                  <span className="flex-1 truncate text-[4.2vh] font-bold">{t.name}</span>
                  {t.hot && <span className="tc-a-flicker text-[4vh]" aria-label="שחקנים חמים">🔥</span>}
                  {up && <span key={up.key} className="tc-a-pop tc-display text-[3.4vh]" style={{ color: 'var(--tc-mint)' }}>▲ {up.by}</span>}
                  <span className="relative w-[10vw] text-end">
                    <CountUp value={t.points} duration={900} className="text-[4.6vh]" />
                    {d && <span key={d.key} className="tc-float-plus tc-num absolute -top-[2vh] end-0 text-[3.4vh]">+{d.amount}</span>}
                  </span>
                </li>
              );
            })}
          </ol>

          {/* the opening shot */}
          <aside className="flex-1">
            <QrCard url={url} />
          </aside>
        </div>
      </div>
    </div>
  );
}
