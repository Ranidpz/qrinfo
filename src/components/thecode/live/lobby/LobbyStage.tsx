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
import GnomeConfetti from '@/components/thecode/player/GnomeConfetti';
import { CountUp, TeamStats } from '@/components/thecode/player/ui';
import SelfieParade, { paradeRoster } from './SelfieParade';

export interface LobbyTeam {
  id: string;
  name: string;
  /** An emoji or a photo URL (the group selfie). */
  avatar: string;
  points: number;
  hot?: boolean;
  /** Different gnomes found / suitcases opened — beside the points (Rani: "לא רק ניקוד"). */
  gnomesFound?: number;
  suitcases?: number;
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
      <Avatar value={m.avatar} size={64} cssSize="6vh" />
      <span className="tc-display text-[4.6vh] leading-none">{look.text}</span>
    </div>
  );
}

/** "הקוד — מלכת שבא" / "קוד הגמדים - מלכת שבא" → "מלכת שבא" (our own name is already the title). */
function cleanGameName(title?: string): string {
  const t = (title || '').trim();
  const stripped = t.replace(/^(קוד הגמדים|הקוד)\s*[—–-]\s*/, '').trim();
  return stripped === 'קוד הגמדים' || stripped === 'הקוד' ? '' : stripped;
}

/** The venue's logo (transparent PNG), facing the title. A broken image just disappears. */
function LobbyLogo({ url, backed }: { url: string; backed: boolean }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (failed === url) return null;
  return (
    <div data-tcl-avoid className={`flex shrink-0 items-center rounded-[2.4vh] ${backed ? 'px-[1.4vw] py-[1.2vh]' : ''}`}
      style={backed ? { background: 'rgba(6,9,30,.5)', backdropFilter: 'blur(6px)' } : undefined}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" decoding="async" onError={() => setFailed(url)}
        className="block h-[9vh] w-auto max-w-[14vw] object-contain"
        style={{ filter: 'drop-shadow(0 0 1px rgba(255,255,255,.6)) drop-shadow(0 4px 14px rgba(0,0,0,.55))' }} />
    </div>
  );
}

/**
 * The opening QR, held by the real gnome (Rani 13.11.2026): the code sits ON the white board in
 * his hands — never over his fingers, never cropped. The art is `garden-gnome-selected.png`
 * cropped hat → belt (nothing in it changed). The board's clean square (no fingers), measured
 * on the pixels: x 489–771, y 525–807 of 1254 → in the crop (x 290, y 10, 680×880) it is
 * left 29.26%, top 58.52%, 41.47% of the width. The QR sits 1% inside it and carries its own
 * 2-module white margin, the rest of the board is extra quiet zone. Height 63vh ⇒ QR ≈ 19vh,
 * scannable from a few metres; the GNOME is what scales, the code never shrinks below that.
 */
const GNOME_ART = { src: '/thecode/lobby/gnome-holding-board.webp', aspect: 600 / 776 };
const BOARD = { left: 29.26, top: 58.52, width: 41.47 };
const QR_INSET = 1;  // % of the art width, kept off the board's edge

function GnomeQr({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  const left = BOARD.left + QR_INSET;
  const width = BOARD.width - QR_INSET * 2;
  const top = BOARD.top + QR_INSET * GNOME_ART.aspect;  // same inset in height units
  return (
    <div data-tcl-avoid className="tcl-fadein pointer-events-none fixed bottom-0 left-[2vw] z-20" style={{ height: '63vh', aspectRatio: `${GNOME_ART.aspect}` }}>
      {!failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={GNOME_ART.src} alt="" aria-hidden decoding="async" onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-contain" style={{ filter: 'drop-shadow(0 2vh 4vh rgba(0,0,0,.55))' }} />
      ) : (
        <div className="absolute rounded-[1.6vh] bg-white" style={{ left: `${BOARD.left}%`, top: `${BOARD.top}%`, width: `${BOARD.width}%`, aspectRatio: '1' }} />
      )}
      <div className="absolute" style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, aspectRatio: '1' }}>
        {url && <QRCodeSVG value={url} size={300} level="M" marginSize={2} bgColor="#FFFFFF" style={{ width: '100%', height: '100%', display: 'block' }} />}
      </div>
      <p className="tc-display absolute whitespace-nowrap rounded-full px-[1.4vw] py-[1vh] text-[3.4vh] leading-none"
        style={{ left: '96%', top: '62%', color: '#2A1600', background: 'var(--tc-brass)', boxShadow: '0 1vh 3vh rgba(0,0,0,.45)' }}>
        סרקו כאן והתחילו
      </p>
    </div>
  );
}

// The celebration is the shared GnomeConfetti (phone + big screen look the same).

const BURST_STYLE = `
@keyframes tcl-drift { 0% { transform: translate(0,0) scale(1) } 50% { transform: translate(-6%,4%) scale(1.15) } 100% { transform: translate(0,0) scale(1) } }
.tcl-blob { position: absolute; border-radius: 50%; filter: blur(8vmin); animation: tcl-drift 18s ease-in-out infinite; }
@keyframes tcl-step { 0% { opacity: 0; transform: translateY(6vh) scale(.92) } 12% { opacity: 1; transform: none } 88% { opacity: 1; transform: none } 100% { opacity: 0; transform: translateY(-4vh) } }
.tcl-step { animation: tcl-step var(--step-ms) cubic-bezier(.2,.8,.2,1) both; }
@keyframes tcl-go { 0% { opacity: 0; transform: scale(.3) rotate(-6deg) } 25% { opacity: 1; transform: scale(1.12) rotate(2deg) } 40% { transform: scale(1) rotate(0) } 100% { opacity: 1; transform: scale(1.04) } }
.tcl-go { animation: tcl-go 2.6s cubic-bezier(.2,.9,.3,1.2) both; }
@keyframes tcl-zoom { from { transform: scale(1) } to { transform: scale(1.08) } }
.tcl-zoom { transform-origin: 30% 45%; animation: tcl-zoom 30s ease-in-out infinite alternate; will-change: transform; }
@keyframes tcl-zoom-b { from { transform: scale(1.08) } to { transform: scale(1) } }
.tcl-zoom-b { transform-origin: 42% 40%; animation: tcl-zoom-b 34s ease-in-out infinite alternate; will-change: transform; }
@keyframes tcl-fadein { from { opacity: 0 } to { opacity: 1 } }
.tcl-fadein { animation: tcl-fadein .6s ease both; }
@media (prefers-reduced-motion: reduce) { .tcl-blob, .tcl-step, .tcl-go, .tcl-zoom, .tcl-zoom-b { animation: none !important; } }
`;

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

/**
 * Default backdrop when the organiser has no video (Rani 13.11.2026): Merlush in a few poses of
 * the SAME approved design, cross-fading slowly so the screen breathes until a real video is in.
 * All frames are 1672x941 with the right side empty, so the board stays readable. Only opacity
 * and transform animate. prefers-reduced-motion -> the first pose, still.
 */
const MERLUSH_POSES = [
  '/thecode/lobby/merlush-v2.webp',
  '/thecode/lobby/merlush-pose-2.webp',
  '/thecode/lobby/merlush-pose-3.webp',
];
const POSE_HOLD_MS = 9000;
const POSE_FADE_MS = 1800;

function MerlushPoses({ onError }: { onError(): void }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setI((p) => (p + 1) % MERLUSH_POSES.length), POSE_HOLD_MS + POSE_FADE_MS);
    return () => clearInterval(t);
  }, []);
  return (
    <>
      {MERLUSH_POSES.map((src, n) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={src} src={src} alt="" decoding="async" onError={n === 0 ? onError : undefined}
          className={`${n % 2 ? 'tcl-zoom-b' : 'tcl-zoom'} absolute inset-0 h-full w-full object-cover object-left`}
          style={{ opacity: n === i ? 1 : 0, transition: `opacity ${POSE_FADE_MS}ms ease-in-out` }} />
      ))}
    </>
  );
}

/** A looping background: the organiser's video, or a drawn placeholder. Never blocks the screen. */
function BackgroundLoop({ url, kind, placeholderLabel }: { url: string | null; kind: 'idle' | 'after'; placeholderLabel?: boolean }) {
  const [failed, setFailed] = useState(false);
  const [artFailed, setArtFailed] = useState(false);
  const blobs = kind === 'idle'
    ? ['#4B2E9E', '#1E5BC6', '#7A2A8C']
    : ['#0F7A5A', '#1E6FA8', '#2F9E6E'];
  return (
    <div key={kind} aria-hidden className="tcl-fadein pointer-events-none absolute inset-0 overflow-hidden">
      {url && !failed ? (
        <LobbyVideo url={url} loop onError={() => setFailed(true)} />
      ) : (
        !artFailed ? (
          <MerlushPoses onError={() => setArtFailed(true)} />
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
        )
      )}
      {/* keeps the board and the moments readable on ANY video; lighter when a real video
          plays (the rows, the header and the QR card carry their own dark backing) */}
      <div className="absolute inset-0" style={{ background: (url && !failed) || !artFailed
        // a picture behind (video or Merlush): dark on the board's side (right), light on his
        ? 'linear-gradient(270deg, rgba(6,9,30,.62), rgba(6,9,30,.3) 50%, rgba(6,9,30,.08))'
        : 'linear-gradient(180deg, rgba(6,9,30,.62), rgba(6,9,30,.5) 40%, rgba(6,9,30,.7))' }} />
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
          <GnomeConfetti position="fixed" burstKey={`go-${burstKey}`} count={170} origin={{ x: '50%', y: '55%' }} />
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
  /** The organisers' name for this adventure (TheCodeConfig.title), e.g. "מלכת שבא אילת". */
  gameName?: string;
  /** The venue's (transparent) logo — top left, facing the title. */
  logoUrl?: string | null;
  /** Small heading above the board. */
  subtitle: string;
  qrUrl: string;
  videos?: { idle?: string | null; explain?: string | null; after?: string | null };
  /** Show "משבצת וידאו" tags on the drawn placeholders (the demo). */
  placeholderLabels?: boolean;
  /** Small line top-left, e.g. "7 קבוצות משחקות עכשיו". */
  aside?: ReactNode;
  children?: ReactNode;
}

export default function LobbyStage({ stage, gameName, logoUrl, subtitle, qrUrl, videos, placeholderLabels, aside, children }: StageProps) {
  const { teams, banner, climb, delta, phase, sceneKey, extraScans, rows, onSceneDone } = stage;
  const parade = useMemo(() => paradeRoster(teams), [teams]);
  const [sound, setSound] = useState<SoundState>('unknown');
  const report = useCallback((s: SoundState) => setSound((cur) => (cur === 'on' ? 'on' : s)), []);
  const soundCtx = useMemo(() => ({ state: sound, report }), [sound, report]);
  const unlock = () => {
    // A tap is a user gesture: from now on the browser lets every video play with sound.
    document.querySelectorAll<HTMLVideoElement>('video[data-tc-lobby]').forEach((v) => { v.muted = false; void v.play().catch(() => {}); });
    setSound('on');
  };
  const ranks = useMemo(() => rankMap(teams), [teams]);
  const ROW_VH = rows >= 10 ? 6.6 : 8.6;
  const loopUrl = (phase === 'after' ? videos?.after : videos?.idle) || null;
  // The QR is always held by the gnome bottom-left (over Merlush or over a video); it hides
  // during the scene and comes back right after "צאו לדרך!".
  const name = cleanGameName(gameName);

  return (
    <SoundContext.Provider value={soundCtx}>
      <div className="fixed inset-0">
        <div dir="rtl" lang="he" className="tc-root flex flex-col px-[3.5vw] py-[3.5vh]">
          <style>{THECODE_STYLE}</style>
          <style>{BURST_STYLE}</style>
          <BackgroundLoop url={loopUrl} kind={phase === 'after' ? 'after' : 'idle'} placeholderLabel={placeholderLabels} />
          {/* the selfie parade walks BEHIND the title, the board and the QR card (it comes first) */}
          <SelfieParade walkers={parade} hidden={phase === 'explain'} />
          {banner?.m.kind === 'suitcase' && <GnomeConfetti position="fixed" burstKey={`b-${banner.key}`} count={170} origin={{ x: '50%', y: '55%' }} />}

          <header className="relative flex items-center justify-between gap-[3vw]">
            <div data-tcl-avoid className="rounded-[2.4vh] px-[1.6vw] py-[1.4vh]" style={{ background: 'rgba(6,9,30,.5)', backdropFilter: 'blur(6px)' }}>
              <h1 className="tc-display text-[8vh] leading-none" style={{ color: 'var(--tc-brass)', textShadow: '0 4px 0 #6E400C, 0 18px 40px rgba(244,183,64,.35)' }}>
                קוד הגמדים
              </h1>
              {name && <p className="tc-display mt-[1.2vh] text-[4.2vh] leading-none" style={{ color: 'var(--tc-cream)', textShadow: '0 2px 12px rgba(0,0,0,.6)' }}>{name}</p>}
            </div>
            {logoUrl && <LobbyLogo url={logoUrl} backed />}
          </header>

          <div aria-live="polite" className="pointer-events-none absolute inset-x-0 top-[5vh] z-20 flex justify-center">
            {banner && <MomentBanner key={banner.key} m={banner.m} />}
          </div>

          <div className="relative mt-[2.2vh] flex min-h-0 flex-1 gap-[3vw]">
            <section data-tcl-avoid className="w-[50%]">
            <div className="flex items-baseline justify-between px-[0.6vw]">
              <h2 className="tc-display text-[3vh]" style={{ color: 'var(--tc-soft)', textShadow: '0 1px 8px rgba(0,0,0,.6)' }}>{subtitle}</h2>
              {aside && <p className="tc-display text-[2.8vh]" style={{ color: 'var(--tc-soft)', textShadow: '0 1px 8px rgba(0,0,0,.6)' }}>{aside}</p>}
            </div>
            <ol className="relative pt-[1.2vh]" style={{ height: `${rows * ROW_VH + 2.4}vh` }} aria-label="טבלת הקבוצות">
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
                    {/* sized from the row height (vh), never a fixed px size: on a short window a 54px photo spilled over the rows */}
                    <Avatar value={t.avatar} size={54} cssSize={`${(ROW_VH - 2).toFixed(1)}vh`} />
                    <span className="flex-1 truncate text-[3.8vh] font-bold">{t.name}</span>
                    {t.hot && <span className="tc-a-flicker text-[3.6vh]" aria-label="שחקנים חמים">🔥</span>}
                    {up && <span key={`up-${up.key}`} className="tc-a-pop tc-display text-[3.2vh]" style={{ color: 'var(--tc-mint)' }}>▲ {up.by}</span>}
                    <TeamStats gnomes={t.gnomesFound} suitcases={t.suitcases} className="text-[2.8vh]" />
                    <span className="relative w-[7.5vw] text-end">
                      <CountUp value={t.points} duration={900} className="text-[4.2vh]" />
                      {d && <span key={`d-${d.key}`} className="tc-float-plus tc-num absolute -top-[2vh] end-0 text-[3.2vh]">+{d.amount}</span>}
                    </span>
                  </li>
                );
              })}
            </ol>
            </section>
          </div>
          {phase !== 'explain' && <GnomeQr url={qrUrl} />}
          {phase === 'explain' && <ExplainScene key={`scene-${sceneKey}`} url={videos?.explain || null} extraScans={extraScans} onDone={onSceneDone} burstKey={sceneKey} />}
        </div>
        {sound === 'blocked' && <SoundButton onUnlock={unlock} />}
        {children}
      </div>
    </SoundContext.Provider>
  );
}
