'use client';

// הקוד — shared presentational pieces. ALL at module scope: an inline component gets a
// new identity every render, React remounts it and its entrance animation replays.

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import GnomeFigure from '@/components/thecode/GnomeFigure';
import type { SfxName } from './sfx';
import type { CollectorView, PlayerGnomeView } from './types';

// ------------------------------------------------ sound

export const SfxContext = createContext<(name: SfxName) => void>(() => {});
export const useSfx = () => useContext(SfxContext);

// ------------------------------------------------ numbers

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Counts from the previous value to the new one (ease-out). */
export function CountUp({ value, duration = 800, className }: { value: number; duration?: number; className?: string }) {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);
  useEffect(() => {
    const from = fromRef.current;
    fromRef.current = value;
    if (from === value || prefersReducedMotion()) {
      setShown(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / duration);
      const e = 1 - Math.pow(1 - k, 3);
      setShown(Math.round(from + (value - from) * e));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <span className={`tc-num ${className || ''}`}>{shown.toLocaleString('en-US')}</span>;
}

interface Delta { id: number; amount: number }

/** The score in the header: counts up, and throws a green +N / red −N off itself. */
export function ScoreCounter({ points }: { points: number }) {
  const prev = useRef(points);
  const seq = useRef(0);
  const [deltas, setDeltas] = useState<Delta[]>([]);
  useEffect(() => {
    const diff = points - prev.current;
    prev.current = points;
    if (!diff) return;
    const id = ++seq.current;
    setDeltas((d) => [...d, { id, amount: diff }]);
    const t = setTimeout(() => setDeltas((d) => d.filter((x) => x.id !== id)), 1500);
    return () => clearTimeout(t);
  }, [points]);
  return (
    <div className="relative flex items-center gap-1.5" aria-label={`${points} נקודות`}>
      <StarCoin />
      <CountUp value={points} className="text-2xl leading-none" />
      {deltas.map((d) => (
        <span
          key={d.id}
          aria-hidden
          className={`tc-num pointer-events-none absolute -bottom-2 left-1/2 -translate-x-1/2 text-3xl font-black ${d.amount > 0 ? 'tc-float-plus' : 'tc-float-minus'}`}
        >
          {d.amount > 0 ? `+${d.amount}` : `−${Math.abs(d.amount)}`}
        </span>
      ))}
    </div>
  );
}

export function StarCoin({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <circle cx="16" cy="16" r="14" fill="#F4B740" stroke="#7A4710" strokeWidth="2" />
      <circle cx="16" cy="16" r="10" fill="none" stroke="#FFD978" strokeWidth="1.5" opacity=".8" />
      <path d="M16 8.5l2.2 4.6 5 .6-3.7 3.4 1 5-4.5-2.5-4.5 2.5 1-5-3.7-3.4 5-.6z" fill="#7A4710" />
    </svg>
  );
}

// ------------------------------------------------ hot streak

export function HotBadge({ hot, streak, target, compact }: { hot: boolean; streak: number; target: number; compact?: boolean }) {
  if (hot) {
    return (
      <div className="tc-a-pop relative flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1.5 font-black text-[#2A0E00]"
        style={{ background: 'linear-gradient(180deg,#FFC24B,#FF8A2B)' }} role="status" aria-label="שחקנים חמים, כל אות שווה פי 2">
        <span className="tc-ring" aria-hidden />
        <span className="tc-a-flicker" aria-hidden>🔥</span>
        {!compact && <span className="tc-display text-sm" aria-hidden>שחקן חם</span>}
        <span className="tc-num text-sm" aria-hidden>×2</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1" aria-label={`${streak} תשובות נכונות ברצף`}>
      {Array.from({ length: target }, (_, i) => (
        <span
          key={i}
          className="h-2.5 w-2.5 rounded-full transition-colors"
          style={{ background: i < streak ? 'var(--tc-flame)' : 'rgba(255,244,218,.18)' }}
        />
      ))}
    </div>
  );
}

// ------------------------------------------------ letters

export function Tile({ letter, size = 52, className, style }: { letter: string; size?: number; className?: string; style?: React.CSSProperties }) {
  return (
    <span className={`tc-tile tc-display ${className || ''}`} style={{ width: size, height: size * 1.12, fontSize: size * 0.62, ...style }}>
      {letter}
    </span>
  );
}

export function Socket({ size = 52, children, className }: { size?: number; children?: ReactNode; className?: string }) {
  return (
    <span className={`tc-socket tc-display ${className || ''}`} style={{ width: size, height: size * 1.12, fontSize: size * 0.5 }}>
      {children}
    </span>
  );
}

/** The letter bag: collected letters in the order found + empty sockets. The newest pops in. */
export function Collector({ collector, size = 40 }: { collector: CollectorView; size?: number }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2" aria-label={`נאספו ${collector.letters.length} מתוך ${collector.total} אותיות`}>
      {Array.from({ length: collector.total }, (_, i) => {
        const l = collector.letters[i];
        return l ? (
          <Tile key={`l${i}`} letter={l.letter} size={size} className="tc-a-drop" style={l.gifted ? { filter: 'saturate(.3)' } : undefined} />
        ) : (
          <Socket key={`s${i}`} size={size}>?</Socket>
        );
      })}
    </div>
  );
}

// ------------------------------------------------ gnome on a stage

export function GnomeStage({ gnome, size = 140, sleeping, className }: { gnome: PlayerGnomeView; size?: number; sleeping?: boolean; className?: string }) {
  return (
    <div className={`relative flex flex-col items-center ${className || ''}`}>
      <div aria-hidden className="absolute bottom-0 h-8 rounded-[50%]"
        style={{ width: size * 1.3, background: 'radial-gradient(closest-side, rgba(255,217,120,.35), rgba(255,217,120,0))' }} />
      <div className={sleeping ? '' : 'tc-a-bob'}>
        <GnomeFigure bodyColor={gnome.bodyColor} hatColor={gnome.hatColor} number={gnome.number} size={size} sleeping={sleeping} />
      </div>
      {sleeping && (
        <>
          <span className="tc-zzz text-2xl" style={{ top: '10%', left: '62%' }} aria-hidden>z</span>
          <span className="tc-zzz text-xl" style={{ top: '16%', left: '58%', animationDelay: '.8s' }} aria-hidden>z</span>
          <span className="tc-zzz text-lg" style={{ top: '20%', left: '55%', animationDelay: '1.6s' }} aria-hidden>z</span>
        </>
      )}
    </div>
  );
}

// ------------------------------------------------ confetti

const CONFETTI_COLORS = ['#F4B740', '#FFD978', '#36E39A', '#FF5468', '#5AA9FF', '#FFF4DA', '#FF8A2B'];
const CONFETTI = Array.from({ length: 70 }, (_, i) => {
  const r = (n: number) => {
    const x = Math.sin((i + 1) * 9301 + n * 49297) * 10000;
    return x - Math.floor(x);
  };
  return {
    left: `${r(1) * 100}%`,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    dx: `${(r(2) - 0.5) * 160}px`,
    rot: `${(r(3) - 0.5) * 1440}deg`,
    dur: `${2.2 + r(4) * 1.8}s`,
    delay: `${r(5) * 0.6}s`,
    round: r(6) > 0.6,
  };
});

/** Pure-CSS burst. Change `burstKey` to fire again. */
export function Confetti({ burstKey }: { burstKey: string | number }) {
  return (
    <div key={burstKey} aria-hidden className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {CONFETTI.map((c, i) => (
        <span
          key={i}
          className="tc-confetti-piece"
          style={{
            left: c.left,
            background: c.color,
            borderRadius: c.round ? 999 : 2,
            ['--dx' as string]: c.dx,
            ['--rot' as string]: c.rot,
            ['--dur' as string]: c.dur,
            ['--delay' as string]: c.delay,
          }}
        />
      ))}
    </div>
  );
}

// ------------------------------------------------ layout

/** One task per screen: a column that centres when short and scrolls when tall. */
export function ScreenBody({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="absolute inset-0 overflow-y-auto overscroll-contain">
      <div className={`flex min-h-full flex-col px-5 pb-8 pt-4 ${className || ''}`}>{children}</div>
    </div>
  );
}

/** Small label for a hint / note card. */
export function HintCard({ children, tone = 'plain', className }: { children: ReactNode; tone?: 'plain' | 'brass'; className?: string }) {
  return (
    <div
      className={`rounded-2xl px-4 py-3 text-lg leading-snug ${className || ''}`}
      style={tone === 'brass'
        ? { background: 'rgba(244,183,64,.12)', boxShadow: 'inset 0 0 0 1.5px rgba(244,183,64,.4)' }
        : { background: 'var(--tc-panel)', boxShadow: 'inset 0 0 0 1.5px var(--tc-line)' }}
    >
      {children}
    </div>
  );
}
