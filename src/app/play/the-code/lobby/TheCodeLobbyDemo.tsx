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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import GnomeFigure from '@/components/thecode/GnomeFigure';
import { Avatar } from '@/components/thecode/player/Avatar';
import { THECODE_STYLE } from '@/components/thecode/player/styles';
import { CountUp, StarCoin } from '@/components/thecode/player/ui';

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
/** Event rhythm of the demo, one beat per tick (≈ a suitcase every 20 s). */
const SCRIPT = ['letter', 'suitcase', 'letter', 'join', 'hot', 'letter', 'letter', 'suitcase', 'join', 'letter', 'hot', 'letter'] as const;
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
      style={{ background: 'linear-gradient(180deg, rgba(244,183,64,.16), rgba(244,183,64,.05)), rgba(10,14,40,.8)', boxShadow: 'inset 0 0 0 3px rgba(244,183,64,.45)' }}>
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

// ------------------------------------------------ gnome-world burst ("פוף")
// A suitcase opening EXPLODES from the middle of the screen: gnome hats in every hat
// colour, mushrooms, stars and coins fly up and out, spin, then fall with gravity.
// A flash + shock ring sells the pop. Transform/opacity only; hidden under reduced motion.

const HAT_COLORS = ['#E5484D', '#3B82F6', '#30A46C', '#F5C518', '#8E4EC6', '#F76B15', '#F4F4F5'];

function GnomeHat({ color }: { color: string }) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 40 44" aria-hidden>
      <path d="M20 2 C26 14 31 26 34 36 L6 36 C9 26 14 14 20 2 Z" fill={color} stroke="#11131A" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M14 14 C17 12 19 9 20 4" stroke="rgba(255,255,255,.45)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <rect x="2" y="34" width="36" height="8" rx="4" fill="#FFF4DA" stroke="#11131A" strokeWidth="2.2" />
    </svg>
  );
}

type PieceKind = 'hat' | 'mushroom' | 'star' | 'coin';
const BURST = Array.from({ length: 64 }, (_, i) => {
  const r = (n: number) => {
    const x = Math.sin((i + 1) * 12.9898 + n * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  const angle = r(1) * Math.PI * 2;
  const dist = 22 + r(2) * 34;                       // vmin
  const kind: PieceKind = i % 8 < 4 ? 'hat' : i % 8 === 4 ? 'mushroom' : i % 8 === 5 || i % 8 === 6 ? 'star' : 'coin';
  return {
    kind,
    color: HAT_COLORS[i % HAT_COLORS.length],
    dx: `${Math.cos(angle) * dist}vmin`,
    dy: `${Math.sin(angle) * dist * 0.8 - 14}vmin`,  // biased upward: a fountain, not a drop
    fall: `${28 + r(3) * 30}vmin`,
    rot: `${(r(4) - 0.5) * 900}deg`,
    size: `${(kind === 'hat' ? 5.2 : 4.2) + r(5) * 2.6}vmin`,
    delay: `${r(6) * 0.12}s`,
    dur: `${1.9 + r(7) * 0.9}s`,
  };
});

const BURST_STYLE = `
@keyframes tcl-pop { 0% { transform: translate(-50%,-50%) translate(0,0) scale(.2) rotate(0); opacity: 0 }
  8% { opacity: 1 }
  38% { transform: translate(-50%,-50%) translate(var(--dx), var(--dy)) scale(1.15) rotate(calc(var(--rot) * .5)); opacity: 1 }
  100% { transform: translate(-50%,-50%) translate(calc(var(--dx) * 1.25), calc(var(--dy) + var(--fall))) scale(.9) rotate(var(--rot)); opacity: 0 } }
@keyframes tcl-flash { 0% { opacity: 0; transform: translate(-50%,-50%) scale(.3) } 15% { opacity: .95 } 100% { opacity: 0; transform: translate(-50%,-50%) scale(2.4) } }
@keyframes tcl-ring { 0% { opacity: .9; transform: translate(-50%,-50%) scale(.2) } 100% { opacity: 0; transform: translate(-50%,-50%) scale(3.2) } }
.tcl-piece { position: absolute; left: 50%; top: 50%; animation: tcl-pop var(--dur) cubic-bezier(.15,.75,.3,1) var(--delay) both; will-change: transform, opacity; }
.tcl-flash { position: absolute; left: 50%; top: 50%; width: 40vmin; height: 40vmin; border-radius: 50%;
  background: radial-gradient(closest-side, rgba(255,240,190,.95), rgba(255,190,80,.5) 45%, rgba(255,190,80,0)); animation: tcl-flash .9s ease-out both; }
.tcl-ring { position: absolute; left: 50%; top: 50%; width: 30vmin; height: 30vmin; border-radius: 50%; border: 1.2vmin solid rgba(255,217,120,.85); animation: tcl-ring 1s ease-out .05s both; }
@keyframes tcl-drift { 0% { transform: translate(0,0) scale(1) } 50% { transform: translate(-6%,4%) scale(1.15) } 100% { transform: translate(0,0) scale(1) } }
.tcl-blob { position: absolute; border-radius: 50%; filter: blur(8vmin); animation: tcl-drift 18s ease-in-out infinite; }
@keyframes tcl-step { 0% { opacity: 0; transform: translateY(6vh) scale(.92) } 12% { opacity: 1; transform: none } 88% { opacity: 1; transform: none } 100% { opacity: 0; transform: translateY(-4vh) } }
.tcl-step { animation: tcl-step var(--step-ms) cubic-bezier(.2,.8,.2,1) both; }
@keyframes tcl-go { 0% { opacity: 0; transform: scale(.3) rotate(-6deg) } 25% { opacity: 1; transform: scale(1.12) rotate(2deg) } 40% { transform: scale(1) rotate(0) } 100% { opacity: 1; transform: scale(1.04) } }
.tcl-go { animation: tcl-go 2.6s cubic-bezier(.2,.9,.3,1.2) both; }
@keyframes tcl-fadein { from { opacity: 0 } to { opacity: 1 } }
.tcl-fadein { animation: tcl-fadein .6s ease both; }
@media (prefers-reduced-motion: reduce) { .tcl-burst { display: none; } .tcl-blob, .tcl-step, .tcl-go { animation: none !important; } }
`;

function GnomeBurst({ burstKey }: { burstKey: number }) {
  return (
    <div key={burstKey} aria-hidden className="tcl-burst pointer-events-none absolute inset-0 z-30 overflow-hidden">
      <span className="tcl-flash" />
      <span className="tcl-ring" />
      {BURST.map((p, i) => (
        <span key={i} className="tcl-piece flex items-center justify-center"
          style={{ width: p.size, height: p.size, fontSize: p.size, lineHeight: 1,
            ['--dx' as string]: p.dx, ['--dy' as string]: p.dy, ['--fall' as string]: p.fall,
            ['--rot' as string]: p.rot, ['--delay' as string]: p.delay, ['--dur' as string]: p.dur }}>
          {p.kind === 'hat' ? <GnomeHat color={p.color} />
            : p.kind === 'mushroom' ? <span style={{ fontSize: '0.85em' }}>🍄</span>
              : p.kind === 'star' ? <span style={{ fontSize: '0.8em' }}>⭐</span>
                : <StarCoin size={40} />}
        </span>
      ))}
    </div>
  );
}

// ------------------------------------------------ video layer (Rani: an intro loop, a "how to play"
// scene when someone scans the opening QR, then a second loop). The three videos are SLOTS
// the organisers will upload later; until then a drawn placeholder stands in. Videos are
// always muted (browsers only autoplay muted video) — a soundtrack is an open question.
// Demo: real files can be tried with ?idle=…&explain=…&after=… (any URL / a file in /public).

type Phase = 'idle' | 'explain' | 'after';
const STEP_MS = 2600;
const GO_MS = 2800;

const EXPLAIN_STEPS = [
  { icon: '📱', title: 'סרקו את הקוד שעל המסך', text: 'ותנו שם לקבוצה שלכם' },
  { icon: 'gnome', title: 'חפשו את הגמד', text: 'לפי הצבעים של הגוף והמצנפת' },
  { icon: '🔤', title: 'פתרו את החידה', text: 'והקישו על האות הראשונה של התשובה' },
  { icon: '🧳', title: 'סדרו את האותיות', text: 'פצחו את המשפט הסודי ופתחו מזוודה' },
] as const;

function readSlots(): Record<Phase, string | null> {
  if (typeof window === 'undefined') return { idle: null, explain: null, after: null };
  const q = new URLSearchParams(window.location.search);
  const ok = (v: string | null) => (v && /^(https?:\/\/|\/)/.test(v) ? v : null);
  return { idle: ok(q.get('idle')), explain: ok(q.get('explain')), after: ok(q.get('after')) };
}

/** A looping background: the organiser's video, or a drawn placeholder. Muted, inline, never blocks. */
function BackgroundLoop({ url, kind }: { url: string | null; kind: 'idle' | 'after' }) {
  const [failed, setFailed] = useState(false);
  const blobs = kind === 'idle'
    ? ['#4B2E9E', '#1E5BC6', '#7A2A8C']
    : ['#0F7A5A', '#1E6FA8', '#2F9E6E'];
  return (
    <div key={kind} aria-hidden className="tcl-fadein pointer-events-none absolute inset-0 overflow-hidden">
      {url && !failed ? (
        <video src={url} autoPlay muted loop playsInline preload="auto" onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <>
          <span className="tcl-blob" style={{ width: '70vmin', height: '70vmin', top: '-10%', right: '-8%', background: blobs[0] }} />
          <span className="tcl-blob" style={{ width: '60vmin', height: '60vmin', bottom: '-15%', left: '10%', background: blobs[1], animationDelay: '-6s' }} />
          <span className="tcl-blob" style={{ width: '45vmin', height: '45vmin', top: '30%', left: '40%', background: blobs[2], animationDelay: '-11s' }} />
          <span className="absolute bottom-[2vh] left-[2vw] rounded-full px-[1.2vw] py-[0.6vh] text-[1.8vh]"
            style={{ background: 'rgba(0,0,0,.35)', color: 'var(--tc-soft)' }}>
            {kind === 'idle' ? 'משבצת וידאו: פתיח בלולאה' : 'משבצת וידאו: לולאה אחרי ההסבר'}
          </span>
        </>
      )}
      {/* keeps the board and the moments readable on ANY video */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(6,9,30,.62), rgba(6,9,30,.5) 40%, rgba(6,9,30,.7))' }} />
    </div>
  );
}

/** The "how to play" scene everyone in the room watches, ending with a big "צאו לדרך!". */
function ExplainScene({ url, extraScans, onDone, burstKey }: { url: string | null; extraScans: number; onDone(): void; burstKey: number }) {
  const [step, setStep] = useState(0);              // 0..n-1 = steps, n = "צאו לדרך!"
  const [videoDone, setVideoDone] = useState(false);
  const [failed, setFailed] = useState(false);
  const useVideo = !!url && !failed;
  const n = EXPLAIN_STEPS.length;
  const go = useVideo ? videoDone : step >= n;

  useEffect(() => {
    if (useVideo || step >= n) return;
    const t = setTimeout(() => setStep((s) => s + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [step, n, useVideo]);
  useEffect(() => {
    if (!go) return;
    const t = setTimeout(onDone, GO_MS);
    return () => clearTimeout(t);
  }, [go, onDone]);

  const s = EXPLAIN_STEPS[Math.min(step, n - 1)];
  return (
    <div className="tcl-fadein absolute inset-0 z-40 flex flex-col items-center justify-center overflow-hidden" style={{ background: '#070A22' }}>
      {useVideo && !videoDone && (
        <video src={url!} autoPlay muted playsInline onEnded={() => setVideoDone(true)} onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover" />
      )}
      {!useVideo && <BackgroundLoop url={null} kind="idle" />}
      {go ? (
        <>
          <GnomeBurst burstKey={burstKey} />
          <p className="tcl-go tc-display relative z-10 text-[22vh] leading-none"
            style={{ color: 'var(--tc-brass)', textShadow: '0 1.2vh 0 #6E400C, 0 4vh 12vh rgba(244,183,64,.55)' }}>
            צאו לדרך!
          </p>
        </>
      ) : !useVideo && (
        <div key={`step-${step}`} className="tcl-step relative z-10 flex flex-col items-center gap-[3vh] text-center" style={{ ['--step-ms' as string]: `${STEP_MS}ms` }}>
          <span className="tc-num flex h-[11vh] w-[11vh] items-center justify-center rounded-full text-[6vh]"
            style={{ background: 'var(--tc-brass)', color: '#2A1600', boxShadow: '0 1.5vh 5vh rgba(244,183,64,.4)' }}>{step + 1}</span>
          <div className="text-[20vh] leading-none" aria-hidden>
            {s.icon === 'gnome' ? <GnomeFigure bodyColor="blue" hatColor="red" size={260} /> : s.icon}
          </div>
          <p className="tc-display text-[10vh] leading-tight">{s.title}</p>
          <p className="text-[4.6vh]" style={{ color: 'var(--tc-soft)' }}>{s.text}</p>
        </div>
      )}
      {!go && !useVideo && (
        <div className="absolute bottom-[5vh] flex gap-[1.2vw]" aria-hidden>
          {EXPLAIN_STEPS.map((_, i) => (
            <span key={i} className="h-[1.6vh] w-[1.6vh] rounded-full transition-all"
              style={{ background: i <= step ? 'var(--tc-brass)' : 'rgba(255,244,218,.2)', transform: i === step ? 'scale(1.4)' : 'none' }} />
          ))}
        </div>
      )}
      {extraScans > 0 && (
        <p className="tc-a-pop absolute right-[3vw] top-[4vh] z-10 rounded-full px-[1.8vw] py-[1vh] text-[3vh] font-bold" key={`extra-${extraScans}`}
          style={{ background: 'rgba(54,227,154,.18)', color: 'var(--tc-mint)', boxShadow: 'inset 0 0 0 2px rgba(54,227,154,.5)' }}>
          עוד <span className="tc-num">{extraScans}</span> {extraScans === 1 ? 'קבוצה הצטרפה' : 'קבוצות הצטרפו'} בזמן ההסבר
        </p>
      )}
      {useVideo && !go && <span className="absolute bottom-[2vh] left-[2vw] text-[1.8vh]" style={{ color: 'var(--tc-soft)' }}>משבצת וידאו: סצינת ההסבר</span>}
    </div>
  );
}

/** Demo only (the real screen has no controls): a corner panel that fakes a scan of the opening QR. */
function DemoScanPanel({ phase, onScan }: { phase: Phase; onScan(): void }) {
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

// ------------------------------------------------ screen

export default function TheCodeLobbyDemo() {
  const [teams, setTeams] = useState<Team[]>(START);
  const [queue, setQueue] = useState<Moment[]>([]);
  const [banner, setBanner] = useState<{ m: Moment; key: number } | null>(null);
  const [climb, setClimb] = useState<Record<string, { by: number; key: number }>>({});
  const [delta, setDelta] = useState<Record<string, { amount: number; key: number }>>({});
  const [url, setUrl] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [sceneKey, setSceneKey] = useState(0);
  const [extraScans, setExtraScans] = useState(0);
  const [slots, setSlots] = useState<Record<Phase, string | null>>({ idle: null, explain: null, after: null });
  const phaseRef = useRef<Phase>('idle');
  const seq = useRef(1);
  const teamsRef = useRef(teams);
  const joinIdx = useRef(0);
  const tick = useRef(0);

  useEffect(() => {
    // The live screen links its own /v/{shortId}; the demo points at a sample code.
    setUrl(`${window.location.origin}/v/demo-gnomes`);
    setSlots(readSlots());
  }, []);

  // A scan of the opening QR. The FIRST one starts the scene; scans while it runs (up to and
  // including "צאו לדרך!") change nothing but a counter — it never restarts. Once it is over
  // the screen sits on the second loop and the very next scan starts it again (no cool-down).
  const onScan = () => {
    if (phaseRef.current === 'explain') { setExtraScans((n) => n + 1); return; }
    phaseRef.current = 'explain';
    setExtraScans(0);
    setSceneKey((k) => k + 1);
    setPhase('explain');
  };
  const onSceneDone = useCallback(() => {
    phaseRef.current = 'after';
    setPhase('after');
  }, []);

  // Fake events, one per tick.
  useEffect(() => {
    const t = setInterval(() => {
      const before = teamsRef.current;
      let next = before.map((x) => ({ ...x }));
      // A fixed rhythm so a screen recording always catches every moment (teams stay random).
      const beat = SCRIPT[tick.current++ % SCRIPT.length];
      const pick = () => next[Math.floor(Math.random() * next.length)];
      const moments: Moment[] = [];
      const deltas: Record<string, number> = {};
      const add = (team: Team, n: number) => { team.points += n; deltas[team.id] = n; };

      if (beat === 'join' && joinIdx.current < JOINERS.length) {
        const j = JOINERS[joinIdx.current++];
        const team: Team = { ...j, points: 100, hot: false };
        next.push(team);
        deltas[team.id] = 100;
        moments.push({ kind: 'join', team });
      } else if (beat === 'suitcase') {
        // A lower team opens a suitcase: the big climb.
        const sorted = sortTeams(next);
        const targetId = sorted[Math.min(sorted.length - 1, 2 + Math.floor(Math.random() * 4))].id;
        const team = next.find((x) => x.id === targetId)!;
        add(team, 500 + (team.hot ? 200 : 100));
        moments.push({ kind: 'suitcase', team });
      } else if (beat === 'hot') {
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
    if (banner || !queue.length || phase === 'explain') return;
    const [m, ...rest] = queue;
    setQueue(rest);
    setBanner({ m, key: seq.current++ });
  }, [banner, queue, phase]);
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
        <style>{BURST_STYLE}</style>
        <BackgroundLoop url={phase === 'after' ? slots.after : slots.idle} kind={phase === 'after' ? 'after' : 'idle'} />
        {banner?.m.kind === 'suitcase' && <GnomeBurst burstKey={banner.key} />}

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
        <div aria-live="polite" className="pointer-events-none absolute inset-x-0 top-[5.5vh] z-20 flex justify-center">
          {banner && <MomentBanner key={banner.key} m={banner.m} />}
        </div>

        <div className="relative mt-[3vh] flex min-h-0 flex-1 gap-[3vw]">
          {/* board */}
          <ol className="relative flex-[1.55] pt-[1.2vh]" style={{ height: `${ROWS * ROW_VH + 2.4}vh` }} aria-label="טבלת הקבוצות">
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
                    transform: `translateY(${rank * ROW_VH + 1.2}vh) scale(${up ? 1.03 : 1})`,
                    visibility: shown ? 'visible' : 'hidden',
                    opacity: shown ? 1 : 0,
                    zIndex: up ? 3 : 1,
                    background: up
                      ? 'linear-gradient(90deg, rgba(54,227,154,.32), rgba(54,227,154,.08)), rgba(10,14,40,.82)'
                      : rank < 3 ? 'linear-gradient(90deg, rgba(244,183,64,.25), rgba(244,183,64,.06)), rgba(10,14,40,.82)' : 'rgba(10,14,40,.78)',
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
        {phase === 'explain' && <ExplainScene key={sceneKey} url={slots.explain} extraScans={extraScans} onDone={onSceneDone} burstKey={sceneKey} />}
      </div>
      <DemoScanPanel phase={phase} onScan={onScan} />
    </div>
  );
}
