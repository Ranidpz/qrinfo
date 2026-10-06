'use client';

import { useMemo } from 'react';

// One-shot win confetti for the big screen: bursts out from behind the winner,
// then falls. Pure CSS (transform/opacity only, composited), ~80 pieces
// generated ONCE per mount so a re-render never restarts it. Mount it keyed on
// the winner so every win replays; it ends off-screen on its own.
// Honours prefers-reduced-motion via the stylesheet (.raffle-confetti-piece).

interface Props {
  colors: string[];
  glow?: string; // soft halo colour per piece (the winner colour)
  count?: number;
}

interface Piece {
  x1: string;
  y1: string;
  x2: string;
  r1: string;
  r2: string;
  delay: string;
  dur: string;
  w: number;
  h: number;
  round: boolean;
  color: string;
}

// Small deterministic PRNG so the burst looks the same on every screen size
// class and never depends on Math.random timing.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export default function RaffleConfetti({ colors, glow, count = 84 }: Props) {
  const pieces = useMemo<Piece[]>(() => {
    const rand = rng(7391);
    const out: Piece[] = [];
    const palette = colors.length ? colors : ['#ffffff'];
    for (let i = 0; i < count; i++) {
      // burst vector: mostly upward/outward, in viewport units
      const angle = rand() * Math.PI * 2;
      const power = 14 + rand() * 30; // vh
      const x1 = Math.cos(angle) * power * 1.6; // wider than tall (16:9 screens)
      const y1 = -Math.abs(Math.sin(angle)) * power - 6;
      const drift = (rand() - 0.5) * 30;
      out.push({
        x1: `${x1.toFixed(1)}vw`,
        y1: `${y1.toFixed(1)}vh`,
        x2: `${(x1 + drift).toFixed(1)}vw`,
        r1: `${Math.round(rand() * 360)}deg`,
        r2: `${Math.round(540 + rand() * 720)}deg`,
        delay: `${(rand() * 0.18).toFixed(2)}s`,
        dur: `${(2.8 + rand() * 1.1).toFixed(2)}s`,
        w: 7 + Math.round(rand() * 6),
        h: 10 + Math.round(rand() * 8),
        round: rand() < 0.25,
        color: palette[Math.floor(rand() * palette.length)],
      });
    }
    return out;
  }, [colors, count]);

  return (
    <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="raffle-confetti-piece"
          style={
            {
              width: p.w,
              height: p.round ? p.w : p.h,
              borderRadius: p.round ? '50%' : 2,
              background: p.color,
              boxShadow: glow ? `0 0 6px ${glow}80` : undefined,
              '--x1': p.x1,
              '--y1': p.y1,
              '--x2': p.x2,
              '--r1': p.r1,
              '--r2': p.r2,
              '--delay': p.delay,
              '--dur': p.dur,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
