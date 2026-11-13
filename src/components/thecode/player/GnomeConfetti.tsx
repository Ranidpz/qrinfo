'use client';

// קוד הגמדים — the ONE celebration confetti, used by the phone (correct letter / suitcase) and
// the big screen (a group opened a suitcase). Learned from the raffle's confetti Rani loved
// (src/components/raffle/RaffleConfetti.tsx): pure CSS, pieces generated ONCE with a seeded PRNG,
// keyed per burst so it replays, reduced-motion → hidden.
//
// Rani 13.11.2026 (round 2): the motion is right; the pieces must look FESTIVE — metallic foil
// (gold, silver, rose gold and saturated foils, a colour sweep across every piece), a glint that
// runs over a piece as it tumbles (it brightens and darkens like foil catching light), a few tiny
// sparkles that twinkle, curled foil ribbons; gnome hats stay a minority, shiny too.
//
// Performance (TV + phone): only transform and opacity animate. The foil is a static gradient
// painted once; the glint is a white overlay whose OPACITY is keyed to the same flip period, so
// it flashes exactly when the piece turns edge-on → face-on. No shadows, no filters per piece.
// Layers per piece: outer = travel (burst → fall + drift + spin), inner = 3D flutter, overlay = glint.
// Distances use container query units (cqw/cqh), so one burst fills a phone column or a TV.

import { useMemo } from 'react';

type Kind = 'foil' | 'ribbon' | 'dot' | 'spark' | 'hat';

/** Foil finishes: dark edge → highlight → body → highlight → dark edge (one sweep per piece). */
const FOILS: Record<string, [string, string, string, string, string]> = {
  gold: ['#7A5410', '#FFE9A3', '#D4A52A', '#FFF6D6', '#9A6C12'],
  silver: ['#6F7782', '#F5F8FC', '#B7BFC9', '#FFFFFF', '#7F8893'],
  rose: ['#8E3F4A', '#FFD3CB', '#D9878A', '#FFEAE5', '#A2525A'],
  magenta: ['#7A0A52', '#FF86D8', '#E0218A', '#FFC9EE', '#900F60'],
  cyan: ['#07546E', '#8AF3FF', '#13B6D6', '#DAFBFF', '#0A6683'],
  emerald: ['#095E35', '#86FFC4', '#17B067', '#D9FFEC', '#0C6E40'],
  royal: ['#182A92', '#97AEFF', '#3B5BFF', '#DEE5FF', '#1E33A8'],
  red: ['#7E0C1B', '#FF9090', '#E5262F', '#FFD6D6', '#951220'],
};
const FOIL_NAMES = Object.keys(FOILS);
// Gold and silver show up more often — that is what makes it read "festive", not "paper".
const FOIL_WEIGHTS = ['gold', 'gold', 'gold', 'silver', 'silver', 'rose', 'magenta', 'cyan', 'emerald', 'royal', 'red'];
const HAT_FOILS = ['red', 'royal', 'emerald', 'gold', 'magenta'];

const foilCss = (name: string, angle: number) => {
  const [a, b, c, d, e] = FOILS[name];
  return `linear-gradient(${angle}deg, ${a} 0%, ${b} 26%, ${c} 50%, ${d} 74%, ${e} 100%)`;
};

interface Piece {
  kind: Kind;
  foil: string;
  angle: number;           // foil sweep direction
  w: number;               // in units (1 = 1% of the container's short side, ≥ 7px)
  h: number;
  x1: string; y1: string;  // burst peak
  x2: string; y2: string;  // where it has fallen to
  r1: string; r2: string;  // spin
  flip: string;            // flutter period (the glint shares it)
  axis: string;            // flutter axis
  delay: string;
  dur: string;
  twinkle: string;         // sparkles: twinkle period
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function makePieces(count: number, seed: number): Piece[] {
  const rand = rng(seed);
  const out: Piece[] = [];
  for (let i = 0; i < count; i++) {
    const roll = rand();
    // ≈ 44% foil squares/rects, 22% curled ribbons, 10% dots, 16% sparkles, 8% gnome hats
    const kind: Kind = roll < 0.44 ? 'foil' : roll < 0.66 ? 'ribbon' : roll < 0.76 ? 'dot' : roll < 0.92 ? 'spark' : 'hat';
    const angle = -Math.PI / 2 + (rand() - 0.5) * Math.PI * 1.5;   // mostly up and out
    const power = 22 + rand() * 30;                                   // cq units
    const x1 = Math.cos(angle) * power * 1.2;
    const y1 = Math.sin(angle) * power - 4;
    const drift = (rand() - 0.5) * 34;
    const size = kind === 'hat' ? 3.4 + rand() * 1.4
      : kind === 'ribbon' ? 1.5 + rand() * 0.8
      : kind === 'spark' ? 1.8 + rand() * 1.4
      : kind === 'dot' ? 1.1 + rand() * 0.7 : 1.6 + rand() * 1.3;
    out.push({
      kind,
      foil: kind === 'hat' ? HAT_FOILS[Math.floor(rand() * HAT_FOILS.length)] : FOIL_WEIGHTS[Math.floor(rand() * FOIL_WEIGHTS.length)],
      angle: Math.round(rand() * 180),
      w: kind === 'ribbon' ? size * 1.3 : kind === 'foil' ? size : size,
      h: kind === 'ribbon' ? size * 4.2 : kind === 'foil' ? size * (rand() < 0.5 ? 1 : 1.6) : size,
      x1: `${x1.toFixed(1)}cqw`,
      y1: `${y1.toFixed(1)}cqh`,
      x2: `${(x1 * 1.15 + drift).toFixed(1)}cqw`,
      y2: `${(70 + rand() * 40).toFixed(1)}cqh`,
      r1: `${Math.round((rand() - 0.5) * 360)}deg`,
      r2: `${Math.round((rand() - 0.5) * 1400)}deg`,
      flip: `${(0.5 + rand() * 0.9).toFixed(2)}s`,
      axis: rand() < 0.5 ? '1, 0.25, 0' : '0.2, 1, 0.1',
      delay: `${(rand() * 0.22).toFixed(2)}s`,
      dur: `${(3 + rand() * 1.6).toFixed(2)}s`,
      twinkle: `${(0.5 + rand() * 0.6).toFixed(2)}s`,
    });
  }
  return out;
}

export const GNOME_CONFETTI_STYLE = `
.tc-gc { position: absolute; inset: 0; pointer-events: none; overflow: hidden; container-type: size; z-index: 30; }
.tc-gc-piece { position: absolute; left: var(--ox, 50%); top: var(--oy, 45%); will-change: transform, opacity;
  animation: tc-gc-fly var(--dur) cubic-bezier(.16,.74,.3,1) var(--delay) both; }
.tc-gc-flip { position: relative; display: block; width: 100%; height: 100%; overflow: hidden;
  animation: tc-gc-flip var(--flip) linear var(--delay) infinite; }
/* the glint: a white sheen that flashes twice per turn (face-on to the light), opacity only */
.tc-gc-glint { position: absolute; inset: 0; background: linear-gradient(115deg, rgba(255,255,255,0) 20%, rgba(255,255,255,.95) 50%, rgba(255,255,255,0) 80%);
  opacity: 0; animation: tc-gc-glint var(--flip) linear var(--delay) infinite; }
/* the dark half of a turn: the foil dims as it faces away */
.tc-gc-shade { position: absolute; inset: 0; background: rgba(10,8,30,.55); opacity: 0; animation: tc-gc-shade var(--flip) linear var(--delay) infinite; }
.tc-gc-spark { display: block; width: 100%; height: 100%; animation: tc-gc-twinkle var(--twinkle) ease-in-out var(--delay) infinite; }
.tc-gc-ribbon { display: block; width: 100%; height: 100%; animation: tc-gc-flip var(--flip) linear var(--delay) infinite; }
@keyframes tc-gc-fly {
  0% { transform: translate3d(0,0,0) rotate(0deg) scale(.4); opacity: 0 }
  4% { opacity: 1 }
  28% { transform: translate3d(var(--x1), var(--y1), 0) rotate(var(--r1)) scale(1); opacity: 1 }
  78% { opacity: 1 }
  100% { transform: translate3d(var(--x2), var(--y2), 0) rotate(var(--r2)) scale(.92); opacity: 0 }
}
@keyframes tc-gc-flip { from { transform: rotate3d(var(--axis), 0deg) } to { transform: rotate3d(var(--axis), 360deg) } }
@keyframes tc-gc-glint { 0%, 100% { opacity: .15 } 8% { opacity: .95 } 20% { opacity: 0 } 50% { opacity: .1 } 58% { opacity: .7 } 70% { opacity: 0 } }
@keyframes tc-gc-shade { 0%, 100% { opacity: 0 } 25% { opacity: .9 } 40% { opacity: 0 } 75% { opacity: .7 } 90% { opacity: 0 } }
@keyframes tc-gc-twinkle { 0%, 100% { transform: scale(.2) rotate(0deg); opacity: .2 } 45% { transform: scale(1.25) rotate(45deg); opacity: 1 } 60% { transform: scale(.9) rotate(60deg); opacity: .9 } }
@media (prefers-reduced-motion: reduce) { .tc-gc { display: none } }
`;

/** Shared gradients for the SVG pieces (ribbons, hats, sparkles) — defined once per burst. */
function FoilDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
      <defs>
        {FOIL_NAMES.map((n) => {
          const [a, b, c, d, e] = FOILS[n];
          return (
            <linearGradient key={n} id={`tc-gc-${n}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={a} /><stop offset=".26" stopColor={b} /><stop offset=".5" stopColor={c} />
              <stop offset=".74" stopColor={d} /><stop offset="1" stopColor={e} />
            </linearGradient>
          );
        })}
      </defs>
    </svg>
  );
}

/** A curled foil ribbon (serpentine strip). */
function Ribbon({ foil }: { foil: string }) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 12 40" preserveAspectRatio="none" aria-hidden>
      <path d="M6 1 C 11 6, 11 10, 6 14 S 1 22, 6 26 S 11 34, 6 39" fill="none" stroke={`url(#tc-gc-${foil})`} strokeWidth="3.4" strokeLinecap="round" />
      <path d="M6 1 C 11 6, 11 10, 6 14" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

/** A four-point twinkle. */
function Spark({ foil }: { foil: string }) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 20 20" aria-hidden>
      <path d="M10 0 C 11 7, 13 9, 20 10 C 13 11, 11 13, 10 20 C 9 13, 7 11, 0 10 C 7 9, 9 7, 10 0 Z" fill={foil === 'silver' ? '#FFFFFF' : `url(#tc-gc-${foil})`} />
      <circle cx="10" cy="10" r="1.8" fill="#FFFFFF" />
    </svg>
  );
}

function Hat({ foil }: { foil: string }) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 40 44" aria-hidden>
      <path d="M20 2 C26 14 31 26 34 36 L6 36 C9 26 14 14 20 2 Z" fill={`url(#tc-gc-${foil})`} stroke="#11131A" strokeWidth="2" strokeLinejoin="round" />
      <path d="M15 15 C18 12 19 9 20 5" stroke="rgba(255,255,255,.8)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <rect x="2" y="34" width="36" height="8" rx="4" fill="url(#tc-gc-silver)" stroke="#11131A" strokeWidth="2" />
    </svg>
  );
}

interface Props {
  /** Change it to fire again. */
  burstKey: string | number;
  count?: number;
  /** Where the burst starts inside the container (CSS lengths). */
  origin?: { x: string; y: string };
  /** 'fixed' = whole viewport (the big screen); 'absolute' = the nearest positioned parent (phone column). */
  position?: 'absolute' | 'fixed';
}

export default function GnomeConfetti({ burstKey, count = 120, origin, position = 'absolute' }: Props) {
  const pieces = useMemo(() => makePieces(count, 7391), [count]);
  return (
    <div key={burstKey} aria-hidden className="tc-gc" style={{ position, ['--ox' as string]: origin?.x, ['--oy' as string]: origin?.y }}>
      <style>{GNOME_CONFETTI_STYLE}</style>
      <FoilDefs />
      {pieces.map((p, i) => (
        <span key={i} className="tc-gc-piece"
          style={{
            // 1 unit = 1% of the container's short side, never below 7px (a phone column stays lively)
            width: `calc(${p.w.toFixed(2)} * max(1cqmin, 7px))`, height: `calc(${p.h.toFixed(2)} * max(1cqmin, 7px))`,
            ['--x1' as string]: p.x1, ['--y1' as string]: p.y1, ['--x2' as string]: p.x2, ['--y2' as string]: p.y2,
            ['--r1' as string]: p.r1, ['--r2' as string]: p.r2, ['--delay' as string]: p.delay, ['--dur' as string]: p.dur,
            ['--flip' as string]: p.flip, ['--axis' as string]: p.axis, ['--twinkle' as string]: p.twinkle,
          }}>
          {p.kind === 'spark' ? (
            <span className="tc-gc-spark"><Spark foil={p.foil} /></span>
          ) : p.kind === 'ribbon' ? (
            <span className="tc-gc-ribbon"><Ribbon foil={p.foil} /></span>
          ) : p.kind === 'hat' ? (
            <span className="tc-gc-flip" style={{ overflow: "visible" }}><Hat foil={p.foil} /></span>
          ) : (
            <span className="tc-gc-flip" style={{ background: foilCss(p.foil, p.angle), borderRadius: p.kind === 'dot' ? '50%' : 1.5 }}>
              <span className="tc-gc-shade" />
              <span className="tc-gc-glint" />
            </span>
          )}
        </span>
      ))}
    </div>
  );
}
