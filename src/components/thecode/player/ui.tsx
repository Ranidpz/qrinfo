'use client';

// הקוד — shared presentational pieces. ALL at module scope: an inline component gets a
// new identity every render, React remounts it and its entrance animation replays.

import GnomeConfetti from './GnomeConfetti';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import GnomeFigure from '@/components/thecode/GnomeFigure';
import type { SfxName } from './sfx';
import type { CollectorView, PlayerGnomeView } from './types';

// ------------------------------------------------ sound

export const SfxContext = createContext<(name: SfxName) => void>(() => {});
export const useSfx = () => useContext(SfxContext);

// ------------------------------------------------ fit to the phone

/**
 * How much room the phone really leaves (iPhone Safari with its toolbars ≈ 664px of 844):
 * 0 on a short screen (≤ 580px) … 1 on a tall one (≥ 860px). Big illustrations (suitcase, gnome,
 * letter tile) size themselves with `fitSize(min, max)` so on a short screen THEY shrink and the
 * news + the main action stay on screen (Rani 13.11.2026: "צריך שהכל יתאים למסך של הטלפון").
 */
export function useFit(): (min: number, max: number) => number {
  const [h, setH] = useState(() => (typeof window === 'undefined' ? 844 : window.visualViewport?.height ?? window.innerHeight));
  useEffect(() => {
    const read = () => setH(window.visualViewport?.height ?? window.innerHeight);
    read();
    window.addEventListener('resize', read);
    window.visualViewport?.addEventListener('resize', read);
    return () => { window.removeEventListener('resize', read); window.visualViewport?.removeEventListener('resize', read); };
  }, []);
  const t = Math.min(1, Math.max(0, (h - 580) / 280));
  return (min, max) => Math.round(min + (max - min) * t);
}

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

/**
 * The streak dots, or — once hot — the flame chip. `fit`: 'full' (🔥 חמים ×2), 'compact'
 * (🔥 ×2), 'icon' (🔥) for a narrow header. With `onDismiss` the hot chip is a button: a tap
 * hides it (Rani: it covered the group button and he could not get into the profile).
 */
export function HotBadge({ hot, streak, target, compact, fit, onDismiss }: { hot: boolean; streak: number; target: number; compact?: boolean; fit?: 'full' | 'compact' | 'icon'; onDismiss?(): void }) {
  const level = fit ?? (compact ? 'compact' : 'full');
  if (hot) {
    const inner = (
      <>
        <span className="tc-ring" aria-hidden />
        <span className="tc-a-flicker" aria-hidden>🔥</span>
        {level === 'full' && <span className="tc-display text-sm" aria-hidden>חמים</span>}
        {level !== 'icon' && <span className="tc-num text-sm" aria-hidden>×2</span>}
      </>
    );
    const cls = 'tc-a-pop relative flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1.5 font-black text-[#2A0E00]';
    const style = { background: 'linear-gradient(180deg,#FFC24B,#FF8A2B)' };
    return onDismiss ? (
      <button type="button" className={`${cls} min-h-[36px]`} style={style} onClick={onDismiss}
        aria-label="שחקנים חמים, כל אות שווה פי 2. הקישו כדי להסתיר" title="שחקנים חמים: כל אות שווה פי 2">
        {inner}
      </button>
    ) : (
      <div className={cls} style={style} role="status" aria-label="שחקנים חמים, כל אות שווה פי 2" title="שחקנים חמים: כל אות שווה פי 2">
        {inner}
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

// ------------------------------------------------ team stats (boards)

/** A tiny gnome (pointed hat, face, beard, body), sized in em so it follows the text around it. */
export function GnomeGlyph() {
  return (
    <svg viewBox="0 0 24 30" aria-hidden style={{ width: '1.05em', height: '1.3em', display: 'inline-block', verticalAlign: '-0.28em' }}>
      <path d="M12 0.5 L20.5 13 L3.5 13 Z" fill="#E5484D" stroke="#7A1E22" strokeWidth="1" strokeLinejoin="round" />
      <rect x="2.5" y="12" width="19" height="3" rx="1.5" fill="#B8323A" />
      <path d="M5 26 Q5 20 12 20 Q19 20 19 26 L19 29.5 L5 29.5 Z" fill="#3D7BFF" />
      <circle cx="12" cy="16.6" r="3.4" fill="#F6CFAF" />
      <path d="M6.2 17.2 Q12 30 17.8 17.2 Q15 19.6 12 19.6 Q9 19.6 6.2 17.2 Z" fill="#FFFFFF" stroke="#C9C9D6" strokeWidth=".6" />
      <circle cx="12" cy="17.3" r="1.2" fill="#F08A7E" />
    </svg>
  );
}

/**
 * Gnomes found and suitcases opened, beside a group's points (Rani: "לא רק ניקוד"). Quiet next
 * to the points; the suitcase count only when there is one, so the row never gets crowded.
 */
export function TeamStats({ gnomes, suitcases, className }: { gnomes?: number; suitcases?: number; className?: string }) {
  if (gnomes === undefined && !suitcases) return null;
  return (
    <span className={`flex shrink-0 items-center gap-[0.7em] whitespace-nowrap ${className || ''}`} style={{ color: 'var(--tc-soft)' }}>
      {gnomes !== undefined && (
        <span className="flex items-center gap-[0.25em]" aria-label={`${gnomes} גמדים נמצאו`} title="גמדים שנמצאו">
          <GnomeGlyph /><span className="tc-num">{gnomes}</span>
        </span>
      )}
      {!!suitcases && (
        <span className="flex items-center gap-[0.25em]" aria-label={`${suitcases} מזוודות נפתחו`} title="מזוודות שנפתחו">
          <span aria-hidden>🧳</span><span className="tc-num">{suitcases}</span>
        </span>
      )}
    </span>
  );
}

// ------------------------------------------------ letters

const HE_LETTER_NAMES: Record<string, string> = {
  'א': 'אלף', 'ב': 'בית', 'ג': 'גימל', 'ד': 'דלת', 'ה': 'הא', 'ו': 'וו', 'ז': 'זין', 'ח': 'חית', 'ט': 'טית',
  'י': 'יוד', 'כ': 'כף', 'ך': 'כף סופית', 'ל': 'למד', 'מ': 'מם', 'ם': 'מם סופית', 'נ': 'נון', 'ן': 'נון סופית',
  'ס': 'סמך', 'ע': 'עין', 'פ': 'פא', 'ף': 'פא סופית', 'צ': 'צדי', 'ץ': 'צדי סופית', 'ק': 'קוף', 'ר': 'ריש',
  'ש': 'שין', 'ת': 'תיו',
};

/** The Hebrew name of a letter ("דלת"), so a big tile is never misread (Rani read ד as ז). */
export const letterName = (l: string): string | undefined => HE_LETTER_NAMES[l];

export function Tile({ letter, size = 52, className, style }: { letter: string; size?: number; className?: string; style?: React.CSSProperties }) {
  return (
    <span className={`tc-tile ${className || ''}`} style={{ width: size, height: size * 1.12, fontSize: size * 0.66, ...style }}>
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

/** `fit` = a CSS height cap for the figure (e.g. 'min(170px, 22svh)'), so a short phone screen
 *  shrinks the gnome instead of pushing the text and the action off screen. */
export function GnomeStage({ gnome, size = 140, sleeping, className, fit }: { gnome: PlayerGnomeView; size?: number; sleeping?: boolean; className?: string; fit?: string }) {
  return (
    <div className={`relative flex flex-col items-center ${className || ''}`}>
      <div aria-hidden className="absolute bottom-0 h-8 rounded-[50%]"
        style={{ width: size * 1.3, background: 'radial-gradient(closest-side, rgba(255,217,120,.35), rgba(255,217,120,0))' }} />
      <div className={`${sleeping ? '' : 'tc-a-bob'} ${fit ? '[&>svg]:h-full [&>svg]:w-auto' : ''}`} style={fit ? { height: fit } : undefined}>
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

/** The celebration — the same confetti the big screen fires (GnomeConfetti). Change `burstKey` to fire again. */
export function Confetti({ burstKey }: { burstKey: string | number }) {
  return <GnomeConfetti burstKey={burstKey} count={90} origin={{ x: '50%', y: '42%' }} />;
}

// ------------------------------------------------ layout

/** One task per screen: a column that centres when short and scrolls when tall. */
/** `plainFooter`: no night fade behind the pinned action (the venue's own background shows through). */
export function ScreenBody({ children, className, footer, plainFooter }: { children: ReactNode; className?: string; footer?: ReactNode; plainFooter?: boolean }) {
  if (!footer) {
    return (
      <div className="absolute inset-0 overflow-y-auto overscroll-contain">
        <div className={`flex min-h-full flex-col px-5 pb-8 pt-4 ${className || ''}`}>{children}</div>
      </div>
    );
  }
  // Rani (live, iPhone): the screen's one action is ALWAYS on screen, pinned to the bottom at
  // thumb height, clear of Safari's toolbar / home indicator; the content above scrolls when
  // it must and is never hidden behind it.
  return (
    <div className="absolute inset-0 flex flex-col">
      <MoreBelow className={className}>{children}</MoreBelow>
      <div className={`tc-footer relative shrink-0 px-5 pt-3 ${plainFooter ? 'tc-footer-plain' : ''}`}>{footer}</div>
    </div>
  );
}

/**
 * The scrolling part above a pinned action. When content continues below the edge it says so
 * (Rani, iPhone: "צריך משהו שמוביל לשם"): a soft fade at the bottom + a small arrow that
 * scrolls down; both vanish at the end. No scrollbar.
 */
function MoreBelow({ children, className }: { children: ReactNode; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const check = () => setMore(el.scrollHeight - el.clientHeight - el.scrollTop > 12);
    check();
    el.addEventListener('scroll', check, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(check) : null;
    ro?.observe(el);
    if (inner.current) ro?.observe(inner.current);
    // entrance animations change heights without a resize of the boxes themselves
    const late = setTimeout(check, 900);
    return () => { el.removeEventListener('scroll', check); ro?.disconnect(); clearTimeout(late); };
  }, []);
  return (
    <div className="relative min-h-0 flex-1">
      <div ref={box} className="tc-noscrollbar absolute inset-0 overflow-y-auto overscroll-contain">
        <div ref={inner} className={`flex min-h-full flex-col px-5 pb-4 pt-3 ${className || ''}`}>{children}</div>
      </div>
      <div aria-hidden className={`tc-more-fade pointer-events-none absolute inset-x-0 bottom-0 h-14 transition-opacity duration-300 ${more ? 'opacity-100' : 'opacity-0'}`} />
      {more && (
        <button type="button" aria-label="יש עוד למטה. גללו"
          onClick={() => box.current?.scrollBy({ top: Math.max(120, (box.current.clientHeight || 300) * 0.7), behavior: 'smooth' })}
          className="tc-more-arrow absolute bottom-1.5 left-1/2 z-10 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      )}
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
