'use client';

import { useMemo, type CSSProperties } from 'react';

// "חלל ניאון" background for 10 בול: deep space, faint stars on a slow zoom-in, drifting nebulae,
// and a glint that travels round an invisible orbit around the timer now and then. The orbit reacts
// to the game: a red glint every second in the countdown, a gold flash of the whole ring on a hit,
// the miss colour on a miss. Pure CSS, transform/opacity animations only, so it stays smooth
// on phones and keeps working offline. All sizes are container units (cq*), so the same component
// works full-screen in the game and inside the small settings preview.

export type NeonRingState = 'idle' | 'warn' | 'win' | 'lose';

// Small deterministic PRNG - the sky looks the same on every load and every screen
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function starLayer(seed: number, count: number, alpha: number) {
  const r = rng(seed);
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push(`${(r() * 100).toFixed(2)}cqw ${(r() * 100).toFixed(2)}cqh 0 0 rgba(255,255,255,${(alpha * (0.5 + r() * 0.5)).toFixed(2)})`);
  }
  return out.join(',');
}


export const NEON_STYLE = `
.neon-space { position:absolute; inset:0; overflow:hidden; pointer-events:none; container-type:size;
  background: radial-gradient(ellipse at 50% 42%, #1b1352 0%, #0d0b2c 42%, #04040c 100%) }
.neon-nebula { position:absolute; width:80cqmax; height:80cqmax; border-radius:9999px; opacity:.55;
  animation: neon-drift 22s ease-in-out infinite alternate }
@keyframes neon-drift { 0% { transform:translate(-50%,-50%) translate(-4cqw,2cqh) scale(1) } 100% { transform:translate(-50%,-50%) translate(5cqw,-3cqh) scale(1.12) } }
.neon-starfield { position:absolute; inset:0; transform-origin:50% 45%; animation: neon-zoom 48s ease-in-out infinite alternate }
@keyframes neon-zoom { 0% { transform:scale(1) } 100% { transform:scale(1.22) } }
.neon-stars { position:absolute; left:0; top:0; width:1px; height:1px; border-radius:9999px }
.neon-stars-a { animation: neon-twinkle 4s ease-in-out infinite alternate }
.neon-stars-b { width:2px; height:2px; animation: neon-twinkle 5.5s ease-in-out 1.4s infinite alternate }
@keyframes neon-twinkle { 0% { opacity:.45 } 100% { opacity:.85 } }

/* Orbit: sized by --ring (set by the parent), centred on the timer. No permanent ring - a glint
   (comet with a fading tail) runs one lap now and then; the full ring only flashes on a result. */
.neon-ring { position:absolute; left:50%; top:50%; width:var(--ring); height:var(--ring); transform:translate(-50%,-50%); pointer-events:none; z-index:0 }
.neon-ring-inner { position:absolute; inset:0 }
.neon-ring-glow { position:absolute; inset:0; border-radius:9999px; opacity:0; border:max(1.5px, calc(var(--ring) * .006)) solid var(--ring-a);
  box-shadow: 0 0 calc(var(--ring) * .03) var(--ring-a), 0 0 calc(var(--ring) * .09) var(--ring-b), inset 0 0 calc(var(--ring) * .05) var(--ring-a) }
.neon-ring-sweep { position:absolute; inset:0; border-radius:9999px; opacity:0;
  background: conic-gradient(from 0deg, transparent 0deg, transparent 250deg, var(--ring-b) 310deg, var(--ring-a) 350deg, #ffffff 360deg);
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - max(4px, calc(var(--ring) * .016))), #000 calc(100% - max(3px, calc(var(--ring) * .012))));
          mask: radial-gradient(farthest-side, transparent calc(100% - max(4px, calc(var(--ring) * .016))), #000 calc(100% - max(3px, calc(var(--ring) * .012))));
  filter: drop-shadow(0 0 calc(var(--ring) * .012) var(--ring-a));
  animation: neon-orbit 9s cubic-bezier(.45,.05,.55,.95) 1.5s infinite }
/* One lap in the first ~30% of the cycle, then the orbit rests unseen */
@keyframes neon-orbit { 0% { transform:rotate(-90deg); opacity:0 } 4% { opacity:1 } 26% { opacity:1 } 32% { transform:rotate(330deg); opacity:0 } 100% { transform:rotate(330deg); opacity:0 } }
/* Countdown: a red glint laps every second, in time with the beeps */
.neon-ring-warn .neon-ring-sweep { animation: neon-orbit-fast 1s linear infinite }
@keyframes neon-orbit-fast { 0% { transform:rotate(-90deg); opacity:1 } 100% { transform:rotate(270deg); opacity:1 } }
/* Result: the whole ring flashes once (gold on a hit, the miss colour on a miss), then fades */
.neon-ring-win .neon-ring-glow { animation: neon-flash 2.4s ease-out both }
.neon-ring-lose .neon-ring-glow { animation: neon-flash 1.3s ease-out both }
.neon-ring-win .neon-ring-inner { animation: neon-flare .6s cubic-bezier(.2,1.6,.4,1) both }
.neon-ring-win .neon-ring-sweep, .neon-ring-lose .neon-ring-sweep { animation: none; opacity:0 }
@keyframes neon-flash { 0% { opacity:0 } 12% { opacity:1 } 55% { opacity:.9 } 100% { opacity:0 } }
@keyframes neon-flare { 0% { transform:scale(.92) } 50% { transform:scale(1.08) } 100% { transform:scale(1) } }

@media (prefers-reduced-motion: reduce) {
  .neon-nebula, .neon-starfield, .neon-stars, .neon-ring-sweep, .neon-ring-inner, .neon-ring-glow { animation: none !important }
}
`;

const RING_COLORS: Record<Exclude<NeonRingState, 'idle' | 'lose'>, [string, string]> = {
  warn: ['#ff2b2b', '#ff7a00'],
  win: ['#ffd43b', '#f59e0b'],
};

/** The space backdrop (fills its positioned parent). */
export function NeonBackdrop({ from, to }: { from: string; to: string }) {
  const stars = useMemo(() => [starLayer(11, 130, 0.55), starLayer(29, 45, 0.65)], []);
  return (
    <div className="neon-space" style={{ ['--neon-a' as string]: from, ['--neon-b' as string]: to } as CSSProperties} aria-hidden="true">
      <div className="neon-nebula" style={{ left: '28%', top: '35%', background: `radial-gradient(closest-side, ${to}55, transparent)` }} />
      <div className="neon-nebula" style={{ left: '75%', top: '70%', background: `radial-gradient(closest-side, ${from}40, transparent)`, animationDelay: '-9s' }} />
      {/* Stars on a very slow zoom-in, like drifting forward through space */}
      <div className="neon-starfield">
        <div className="neon-stars neon-stars-a" style={{ boxShadow: stars[0] }} />
        <div className="neon-stars neon-stars-b" style={{ boxShadow: stars[1] }} />
      </div>
    </div>
  );
}

/** The neon ring - render inside a relatively positioned box centred on the timer. */
export function NeonRing({ from, to, state, loseColor }: { from: string; to: string; state: NeonRingState; loseColor: string }) {
  const [a, b] = state === 'idle' ? [from, to] : state === 'lose' ? [loseColor, loseColor] : RING_COLORS[state];
  return (
    <div
      className={`neon-ring neon-ring-${state}`}
      style={{ ['--ring-a' as string]: a, ['--ring-b' as string]: b } as CSSProperties}
      aria-hidden="true"
    >
      {/* keyed so the win flare replays every hit */}
      <div key={state} className="neon-ring-inner">
        <div className="neon-ring-glow" />
        <div className="neon-ring-sweep" />
      </div>
    </div>
  );
}
