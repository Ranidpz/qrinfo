'use client';

// קוד הגמדים — the big screen's stage, shared by the live lobby (/lobby/thecode/{shortId})
// and its demo (/play/the-code/lobby). Approved by Rani 13.11.2026:
//   א. a big QR with a gnome — "סרקו כאן והתחילו" → /v/{shortId}?src=lobby;
//   ב. live moments, one banner at a time: joined / opened a suitcase (+ the gnome burst) / hot;
//   ג. a group that climbs is highlighted and slides up (worked out by comparing two boards);
//   ד. a group's selfie shows as its symbol;
//   ה. three video slots: idle loop → on a scan the "how to play" scene ONCE (scans while it
//      runs only bump a counter, never restart it; no cool-down after) → "צאו לדרך!" → after loop.
// Data in, pixels out: the live page and the demo both drive it through `useLobbyStage()`.
// Large type for across-the-room reading; motion = transform/opacity, reduced-motion respected.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import GnomeFigure from '@/components/thecode/GnomeFigure';
import { Avatar } from '@/components/thecode/player/Avatar';
import { THECODE_STYLE } from '@/components/thecode/player/styles';
import { CountUp, StarCoin } from '@/components/thecode/player/ui';

export interface LobbyTeam {
  id: string;
  name: string;
  /** An emoji or a photo URL (the group selfie). */
  avatar: string;
  points: number;
  hot?: boolean;
}

export interface LobbyMoment { kind: 'join' | 'suitcase' | 'hot'; name: string; avatar: string }

export const LOBBY_ROWS = 10;
const BANNER_MS = 3600;

const sortTeams = (t: LobbyTeam[]) => [...t].sort((a, b) => b.points - a.points);
const rankMap = (t: LobbyTeam[]) => Object.fromEntries(sortTeams(t).map((x, i) => [x.id, i]));

// ------------------------------------------------ pieces (module scope: stable identity, no replayed entrances)

function MomentBanner({ m }: { m: LobbyMoment }) {
  const look = m.kind === 'suitcase'
    ? { bg: 'linear-gradient(90deg,#1F8F5F,#36E39A)', fg: '#03261A', icon: '🧳', text: `${m.name} פתחו מזוודה!` }
    : m.kind === 'hot'
      ? { bg: 'linear-gradient(90deg,#FF8A2B,#FFC24B)', fg: '#2A0E00', icon: '🔥', text: `${m.name} שחקנים חמים!` }
      : { bg: 'linear-gradient(90deg,#F4B740,#FFD978)', fg: '#2A1600', icon: '👋', text: `קבוצת ${m.name} הצטרפה!` };
  return (
    <div className="tc-a-stamp flex items-center gap-[1.6vw] rounded-full px-[2.6vw] py-[1.4vh]"
      style={{ background: look.bg, color: look.fg, boxShadow: '0 1.5vh 5vh rgba(0,0,0,.45)' }}>
      <span className="text-[5vh]" aria-hidden>{look.icon}</span>
      <Avatar value={m.avatar} size={64} />
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
// scene when someone scans the opening QR, then a second loop). Three SLOTS the organisers
// upload (`TheCodeLobbyLive.videos`); an empty slot = the drawn placeholder. Videos play WITH
// sound when the browser lets them (TVzone's Android TV player may); otherwise they play muted
// and a one-time "הפעלת קול" button appears — one tap unmutes every video from then on.

export type LobbyPhase = 'idle' | 'explain' | 'after';
type Phase = LobbyPhase;

type SoundState = 'unknown' | 'blocked' | 'on';
const SoundContext = createContext<{ state: SoundState; report(s: SoundState): void }>({ state: 'unknown', report: () => {} });

/** One slot's video: tries to play with sound, falls back to muted + reports 'blocked'. */
function LobbyVideo({ url, loop, onEnded, onError }: { url: string; loop: boolean; onEnded?(): void; onError(): void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const sound = useContext(SoundContext);
  const reportRef = useRef(sound.report);
  useEffect(() => { reportRef.current = sound.report; }, [sound.report]);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    let cancelled = false;
    v.muted = false;
    v.play().then(() => { if (!cancelled) reportRef.current('on'); }).catch(() => {
      if (cancelled) return;
      v.muted = true;                               // autoplay with sound refused → play muted
      v.play().catch(() => { /* not even muted (codec / network) → onError handles real errors */ });
      reportRef.current('blocked');
    });
    return () => { cancelled = true; };
  }, [url]);
  return (
    <video ref={ref} data-tc-lobby="" src={url} loop={loop} playsInline preload="auto" onEnded={onEnded} onError={onError}
      className="absolute inset-0 h-full w-full object-cover" />
  );
}
const STEP_MS = 2600;
const GO_MS = 2800;

const EXPLAIN_STEPS = [
  { icon: '📱', title: 'סרקו את הקוד שעל המסך', text: 'ותנו שם לקבוצה שלכם' },
  { icon: 'gnome', title: 'חפשו את הגמד', text: 'לפי הצבעים של הגוף והמצנפת' },
  { icon: '🔤', title: 'פתרו את החידה', text: 'והקישו על האות הראשונה של התשובה' },
  { icon: '🧳', title: 'סדרו את האותיות', text: 'פצחו את המשפט הסודי ופתחו מזוודה' },
] as const;

/** A looping background: the organiser's video, or a drawn placeholder. Never blocks the screen. */
function BackgroundLoop({ url, kind, placeholderLabel }: { url: string | null; kind: 'idle' | 'after'; placeholderLabel?: boolean }) {
  const [failed, setFailed] = useState(false);
  const blobs = kind === 'idle'
    ? ['#4B2E9E', '#1E5BC6', '#7A2A8C']
    : ['#0F7A5A', '#1E6FA8', '#2F9E6E'];
  return (
    <div key={kind} aria-hidden className="tcl-fadein pointer-events-none absolute inset-0 overflow-hidden">
      {url && !failed ? (
        <LobbyVideo url={url} loop onError={() => setFailed(true)} />
      ) : (
        <>
          <span className="tcl-blob" style={{ width: '70vmin', height: '70vmin', top: '-10%', right: '-8%', background: blobs[0] }} />
          <span className="tcl-blob" style={{ width: '60vmin', height: '60vmin', bottom: '-15%', left: '10%', background: blobs[1], animationDelay: '-6s' }} />
          <span className="tcl-blob" style={{ width: '45vmin', height: '45vmin', top: '30%', left: '40%', background: blobs[2], animationDelay: '-11s' }} />
          {placeholderLabel && <span className="absolute bottom-[2vh] left-[2vw] rounded-full px-[1.2vw] py-[0.6vh] text-[1.8vh]"
            style={{ background: 'rgba(0,0,0,.35)', color: 'var(--tc-soft)' }}>
            {kind === 'idle' ? 'משבצת וידאו: פתיח בלולאה' : 'משבצת וידאו: לולאה אחרי ההסבר'}
          </span>}
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
        <LobbyVideo url={url!} loop={false} onEnded={() => setVideoDone(true)} onError={() => setFailed(true)} />
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

    </div>
  );
}


// ------------------------------------------------ the director: board diffs, banners, the scene

export function useLobbyStage(rows: number = LOBBY_ROWS) {
  const [teams, setTeams] = useState<LobbyTeam[]>([]);
  const [queue, setQueue] = useState<LobbyMoment[]>([]);
  const [banner, setBanner] = useState<{ m: LobbyMoment; key: number } | null>(null);
  const [climb, setClimb] = useState<Record<string, { by: number; key: number }>>({});
  const [delta, setDelta] = useState<Record<string, { amount: number; key: number }>>({});
  const [phase, setPhase] = useState<Phase>('idle');
  const [sceneKey, setSceneKey] = useState(0);
  const [extraScans, setExtraScans] = useState(0);
  const phaseRef = useRef<Phase>('idle');
  const teamsRef = useRef<LobbyTeam[] | null>(null);
  const seq = useRef(1);

  /** A new board. The first one just appears; later ones animate climbs and +points. */
  const setBoard = useCallback((next: LobbyTeam[]) => {
    const before = teamsRef.current;
    teamsRef.current = next;
    setTeams(next);
    if (!before) return;
    const was = rankMap(before);
    const now = rankMap(next);
    const k = seq.current++;
    const climbs: Record<string, { by: number; key: number }> = {};
    const deltas: Record<string, { amount: number; key: number }> = {};
    const old = Object.fromEntries(before.map((t) => [t.id, t.points]));
    for (const t of next) {
      if (was[t.id] !== undefined && now[t.id] < was[t.id] && now[t.id] < rows) climbs[t.id] = { by: was[t.id] - now[t.id], key: k };
      const gain = t.points - (old[t.id] ?? 0);
      if (gain > 0) deltas[t.id] = { amount: gain, key: k };
    }
    if (Object.keys(climbs).length) setClimb((c) => ({ ...c, ...climbs }));
    if (Object.keys(deltas).length) setDelta((d) => ({ ...d, ...deltas }));
  }, [rows]);

  const pushMoments = useCallback((ms: LobbyMoment[]) => {
    if (ms.length) setQueue((q) => [...q, ...ms].slice(-12));
  }, []);

  /** Scans of the on-screen QR. The first starts the scene; during it they only count. */
  const scan = useCallback((count = 1) => {
    if (count <= 0) return;
    if (phaseRef.current === 'explain') { setExtraScans((n) => n + count); return; }
    phaseRef.current = 'explain';
    setExtraScans(count - 1);
    setSceneKey((s) => s + 1);
    setPhase('explain');
  }, []);
  const onSceneDone = useCallback(() => {
    phaseRef.current = 'after';
    setPhase('after');
  }, []);

  // One banner at a time; banners wait while the scene runs.
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
  useEffect(() => {
    if (!Object.keys(climb).length) return;
    const t = setTimeout(() => setClimb({}), 3200);
    return () => clearTimeout(t);
  }, [climb]);

  return { teams, banner, climb, delta, phase, sceneKey, extraScans, rows, setBoard, pushMoments, scan, onSceneDone };
}

export type LobbyStageState = ReturnType<typeof useLobbyStage>;

/** One-time "הפעלת קול": shown only when a real video had to start muted. */
function SoundButton({ onUnlock }: { onUnlock(): void }) {
  return (
    <button type="button" onClick={onUnlock}
      className="tc-a-pop fixed bottom-[3vh] left-[2vw] z-[55] flex items-center gap-[0.8vw] rounded-full px-[1.6vw] py-[1.2vh] text-[2.6vh] font-bold"
      style={{ background: 'var(--tc-brass)', color: '#2A1600', boxShadow: '0 1vh 3vh rgba(0,0,0,.45)' }}>
      <span aria-hidden>🔊</span> הפעלת קול
    </button>
  );
}

interface StageProps {
  stage: LobbyStageState;
  title?: string;
  subtitle: string;
  qrUrl: string;
  videos?: { idle?: string | null; explain?: string | null; after?: string | null };
  /** Show "משבצת וידאו" tags on the drawn placeholders (the demo). */
  placeholderLabels?: boolean;
  /** Small line top-left, e.g. "7 קבוצות משחקות עכשיו". */
  aside?: ReactNode;
  children?: ReactNode;
}

export default function LobbyStage({ stage, title, subtitle, qrUrl, videos, placeholderLabels, aside, children }: StageProps) {
  const { teams, banner, climb, delta, phase, sceneKey, extraScans, rows, onSceneDone } = stage;
  const [sound, setSound] = useState<SoundState>('unknown');
  const report = useCallback((s: SoundState) => setSound((cur) => (cur === 'on' ? 'on' : s)), []);
  const soundCtx = useMemo(() => ({ state: sound, report }), [sound, report]);
  const unlock = () => {
    // A tap is a user gesture: from now on the browser lets every video play with sound.
    document.querySelectorAll<HTMLVideoElement>('video[data-tc-lobby]').forEach((v) => { v.muted = false; void v.play().catch(() => {}); });
    setSound('on');
  };
  const ranks = useMemo(() => rankMap(teams), [teams]);
  const ROW_VH = rows >= 10 ? 7 : 8.6;
  const loopUrl = (phase === 'after' ? videos?.after : videos?.idle) || null;

  return (
    <SoundContext.Provider value={soundCtx}>
      <div className="fixed inset-0">
        <div dir="rtl" lang="he" className="tc-root flex flex-col px-[3.5vw] py-[3.5vh]">
          <style>{THECODE_STYLE}</style>
          <style>{BURST_STYLE}</style>
          <BackgroundLoop url={loopUrl} kind={phase === 'after' ? 'after' : 'idle'} placeholderLabel={placeholderLabels} />
          {banner?.m.kind === 'suitcase' && <GnomeBurst burstKey={banner.key} />}

          <header className="relative flex items-end justify-between">
            <div>
              <h1 className="tc-display text-[8.5vh] leading-none" style={{ color: 'var(--tc-brass)', textShadow: '0 4px 0 #6E400C, 0 18px 40px rgba(244,183,64,.35)' }}>
                {title || 'קוד הגמדים'}
              </h1>
              <p className="mt-[1vh] text-[3vh]" style={{ color: 'var(--tc-soft)' }}>{subtitle}</p>
            </div>
            {aside && <p className="tc-display text-[3.2vh]" style={{ color: 'var(--tc-soft)' }}>{aside}</p>}
          </header>

          <div aria-live="polite" className="pointer-events-none absolute inset-x-0 top-[5vh] z-20 flex justify-center">
            {banner && <MomentBanner key={banner.key} m={banner.m} />}
          </div>

          <div className="relative mt-[2.5vh] flex min-h-0 flex-1 gap-[3vw]">
            <ol className="relative flex-[1.55] pt-[1.2vh]" style={{ height: `${rows * ROW_VH + 2.4}vh` }} aria-label="טבלת הקבוצות">
              {!teams.length && (
                <li className="flex h-full flex-col items-center justify-center gap-[2vh] text-center">
                  <span className="tc-display text-[5vh]" style={{ color: 'var(--tc-brass-hi)' }}>הטבלה עוד ריקה</span>
                  <span className="text-[3vh]" style={{ color: 'var(--tc-soft)' }}>הקבוצה הראשונה שתמצא גמד תופיע כאן</span>
                </li>
              )}
              {teams.map((t) => {
                const rank = ranks[t.id];
                const shown = rank < rows;
                const up = climb[t.id];
                const d = delta[t.id];
                return (
                  <li key={t.id} className="tc-row-move absolute inset-x-0 flex items-center gap-[1.4vw] rounded-[2vh] px-[1.6vw]"
                    style={{
                      top: 0,
                      height: `${ROW_VH - 1}vh`,
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
                    <span className="tc-num w-[4.5vw] text-center text-[3.8vh]" style={{ color: rank < 3 ? 'var(--tc-brass)' : 'var(--tc-soft)' }}>
                      {['🥇', '🥈', '🥉'][rank] ?? rank + 1}
                    </span>
                    <Avatar value={t.avatar} size={rows >= 10 ? 54 : 60} />
                    <span className="flex-1 truncate text-[3.8vh] font-bold">{t.name}</span>
                    {t.hot && <span className="tc-a-flicker text-[3.6vh]" aria-label="שחקנים חמים">🔥</span>}
                    {up && <span key={`up-${up.key}`} className="tc-a-pop tc-display text-[3.2vh]" style={{ color: 'var(--tc-mint)' }}>▲ {up.by}</span>}
                    <span className="relative w-[10vw] text-end">
                      <CountUp value={t.points} duration={900} className="text-[4.2vh]" />
                      {d && <span key={`d-${d.key}`} className="tc-float-plus tc-num absolute -top-[2vh] end-0 text-[3.2vh]">+{d.amount}</span>}
                    </span>
                  </li>
                );
              })}
            </ol>
            <aside className="flex-1">
              <QrCard url={qrUrl} />
            </aside>
          </div>
          {phase === 'explain' && <ExplainScene key={`scene-${sceneKey}`} url={videos?.explain || null} extraScans={extraScans} onDone={onSceneDone} burstKey={sceneKey} />}
        </div>
        {sound === 'blocked' && <SoundButton onUnlock={unlock} />}
        {children}
      </div>
    </SoundContext.Provider>
  );
}
