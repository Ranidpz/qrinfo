'use client';

// קוד הגמדים — the ONE celebration confetti, used by the phone (correct letter / suitcase) and
// the big screen (a group opened a suitcase). Learned from the raffle's confetti Rani loved
// (src/components/raffle/RaffleConfetti.tsx): pure CSS, transform/opacity only, pieces generated
// ONCE with a seeded PRNG, keyed per burst so it replays, reduced-motion → hidden.
// Rani 13.11.2026: no ring / flash; MOSTLY real paper confetti (rectangles, ribbons, small dots)
// with a few gnome hats mixed in; natural motion — bursts up and out, then falls with gravity,
// flutters in 3D, drifts sideways and fades out gradually.
//
// Two nested layers per piece: the outer one travels (burst → fall + drift + spin), the inner
// one flutters (rotateX / rotateY) — that tumbling is what makes paper look like paper.
// Distances use container query units (cqw/cqh), so the same burst fills a phone column or a TV.

import { useMemo } from 'react';

type Kind = 'rect' | 'ribbon' | 'dot' | 'hat';

interface Piece {
  kind: Kind;
  color: string;
  w: number;               // in cqmin (1 = 1% of the container's smaller side)
  h: number;
  x1: string; y1: string;  // burst peak
  x2: string; y2: string;  // where it has fallen to
  r1: string; r2: string;  // spin
  flip: string;            // flutter duration
  axis: string;            // flutter axis
  delay: string;
  dur: string;
}

const PAPER = ['#F4B740', '#FFD978', '#36E39A', '#FF5468', '#5AA9FF', '#FFF4DA', '#FF8A2B', '#C084FC', '#2DD4BF'];
const HATS = ['#E5484D', '#3B82F6', '#30A46C', '#F5C518', '#8E4EC6'];

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
    // ≈ 45% rectangles, 25% ribbons, 20% dots, 10% gnome hats (a minority, as Rani asked)
    const kind: Kind = roll < 0.45 ? 'rect' : roll < 0.7 ? 'ribbon' : roll < 0.9 ? 'dot' : 'hat';
    const angle = -Math.PI / 2 + (rand() - 0.5) * Math.PI * 1.5;   // mostly up and out
    const power = 22 + rand() * 30;                                   // cq units
    const x1 = Math.cos(angle) * power * 1.2;
    const y1 = Math.sin(angle) * power - 4;
    const drift = (rand() - 0.5) * 34;
    const size = kind === 'hat' ? 3.4 + rand() * 1.6 : kind === 'dot' ? 0.9 + rand() * 0.7 : 1 + rand() * 0.9;
    out.push({
      kind,
      color: kind === 'hat' ? HATS[Math.floor(rand() * HATS.length)] : PAPER[Math.floor(rand() * PAPER.length)],
      w: kind === 'ribbon' ? size * 0.55 : size,
      h: kind === 'ribbon' ? size * 3.2 : kind === 'rect' ? size * 1.5 : size,
      x1: `${x1.toFixed(1)}cqw`,
      y1: `${y1.toFixed(1)}cqh`,
      x2: `${(x1 * 1.15 + drift).toFixed(1)}cqw`,
      y2: `${(70 + rand() * 40).toFixed(1)}cqh`,
      r1: `${Math.round((rand() - 0.5) * 360)}deg`,
      r2: `${Math.round((rand() - 0.5) * 1400)}deg`,
      flip: `${(0.45 + rand() * 0.9).toFixed(2)}s`,
      axis: rand() < 0.5 ? '1, 0.25, 0' : '0.2, 1, 0.1',
      delay: `${(rand() * 0.22).toFixed(2)}s`,
      dur: `${(3 + rand() * 1.6).toFixed(2)}s`,
    });
  }
  return out;
}

export const GNOME_CONFETTI_STYLE = `
.tc-gc { position: absolute; inset: 0; pointer-events: none; overflow: hidden; container-type: size; z-index: 30; }
.tc-gc-piece { position: absolute; left: var(--ox, 50%); top: var(--oy, 45%); will-change: transform, opacity;
  animation: tc-gc-fly var(--dur) cubic-bezier(.16,.74,.3,1) var(--delay) both; }
.tc-gc-flip { display: block; width: 100%; height: 100%; animation: tc-gc-flip var(--flip) linear var(--delay) infinite; transform-style: preserve-3d; }
@keyframes tc-gc-fly {
  0% { transform: translate3d(0,0,0) rotate(0deg) scale(.4); opacity: 0 }
  4% { opacity: 1 }
  28% { transform: translate3d(var(--x1), var(--y1), 0) rotate(var(--r1)) scale(1); opacity: 1 }
  78% { opacity: 1 }
  100% { transform: translate3d(var(--x2), var(--y2), 0) rotate(var(--r2)) scale(.92); opacity: 0 }
}
@keyframes tc-gc-flip { from { transform: rotate3d(var(--axis), 0deg) } to { transform: rotate3d(var(--axis), 360deg) } }
@media (prefers-reduced-motion: reduce) { .tc-gc { display: none } }
`;

function Hat({ color }: { color: string }) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 40 44" aria-hidden>
      <path d="M20 2 C26 14 31 26 34 36 L6 36 C9 26 14 14 20 2 Z" fill={color} stroke="#11131A" strokeWidth="2.2" strokeLinejoin="round" />
      <rect x="2" y="34" width="36" height="8" rx="4" fill="#FFF4DA" stroke="#11131A" strokeWidth="2.2" />
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
      {pieces.map((p, i) => (
        <span key={i} className="tc-gc-piece"
          style={{
            // 1 unit = 1% of the container's short side, never below 7px (a phone column stays lively)
            width: `calc(${p.w.toFixed(2)} * max(1cqmin, 7px))`, height: `calc(${p.h.toFixed(2)} * max(1cqmin, 7px))`,
            ['--x1' as string]: p.x1, ['--y1' as string]: p.y1, ['--x2' as string]: p.x2, ['--y2' as string]: p.y2,
            ['--r1' as string]: p.r1, ['--r2' as string]: p.r2, ['--delay' as string]: p.delay, ['--dur' as string]: p.dur,
            ['--flip' as string]: p.flip, ['--axis' as string]: p.axis,
          }}>
          {p.kind === 'hat' ? (
            <span className="tc-gc-flip"><Hat color={p.color} /></span>
          ) : (
            <span className="tc-gc-flip" style={{ background: p.color, borderRadius: p.kind === 'dot' ? '50%' : p.kind === 'ribbon' ? 1 : 2 }} />
          )}
        </span>
      ))}
    </div>
  );
}
