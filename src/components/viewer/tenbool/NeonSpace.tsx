'use client';

import { useMemo, type CSSProperties } from 'react';

// "חלל ניאון" background for 10 בול, kept minimal so the timer stays the hero: a deep-space
// gradient, faint stars on a very slow zoom-in, and a thin orbit that hugs the digits. The orbit
// is invisible at rest - a glint runs one lap of it now and then - and reacts to the game: a red
// glint every second in the countdown, a gold flash of the whole orbit on a hit, the miss colour
// on a miss. Pure CSS + SVG, no assets, so it keeps working offline. Backdrop sizes are container
// units (cq*) and the orbit is sized off the digits' own box, so the settings preview reuses both.

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

// The glint is three dashes on the same ellipse sharing one leading edge: a bright head and two
// fading tails. Lengths are in pathLength units (the whole orbit = 100).
const GLINT = [
  { len: 18, cls: 'neon-tail-far' },
  { len: 7, cls: 'neon-tail-near' },
  { len: 1.2, cls: 'neon-head' },
] as const;

// One lap = the dash offset going from len to len-100. Each layer needs its own numbers, so the
// keyframes are generated (var() inside stroke-dashoffset keyframes isn't reliable everywhere).
const lapKeyframes = GLINT.map(
  ({ len }, i) => `
@keyframes neon-lap-${i} { 0% { stroke-dashoffset:${len} } 22% { stroke-dashoffset:${len - 100} } 100% { stroke-dashoffset:${len - 100} } }
@keyframes neon-lap-fast-${i} { 0% { stroke-dashoffset:${len} } 100% { stroke-dashoffset:${len - 100} } }
.neon-glint .${GLINT[i].cls} { animation: neon-lap-${i} 12s ease-in-out 2s infinite both }
.neon-ring-warn .neon-glint .${GLINT[i].cls} { animation: neon-lap-fast-${i} 1s linear infinite }`
).join('');

export const NEON_STYLE = `
.neon-space { position:absolute; inset:0; overflow:hidden; pointer-events:none; container-type:size;
  background: radial-gradient(ellipse at 50% 45%, #1b1352 0%, #0d0b2c 45%, #04040c 100%) }
.neon-tint { position:absolute; inset:0 }
.neon-starfield { position:absolute; inset:0; transform-origin:50% 45%; animation: neon-zoom 60s ease-in-out infinite alternate }
@keyframes neon-zoom { 0% { transform:scale(1) } 100% { transform:scale(1.18) } }
.neon-stars { position:absolute; left:0; top:0; width:1px; height:1px; border-radius:9999px }
.neon-stars-b { width:2px; height:2px }

/* Orbit: a huge circle centred on the digits, like the event-booth screen - it runs off the top and
   bottom of the screen and frames the number from the sides. Rendered inside the digits' box (which
   carries their font size, so em = digit size): never narrower than 10.00 needs, ~72% of a wide
   screen, nearly the full width of a phone. The glint only crosses the logo / title / hint for a
   moment. The settings preview sets --orbit to its own size. */
.neon-ring { position:absolute; left:50%; top:50%; width:var(--orbit, max(2.8em, 72vw)); aspect-ratio:1;
  transform:translate(-50%,-50%); pointer-events:none; z-index:0 }
@media (orientation: portrait) { .neon-ring { width:var(--orbit, max(2.8em, 94vw)) } }
.neon-ring svg { position:absolute; inset:0; width:100%; height:100%; overflow:visible;
  filter: drop-shadow(0 0 max(3px,.6vmin) var(--ring-a)) }
.neon-ring ellipse { fill:none; stroke-linecap:round; stroke-width:max(1.5px,.4vmin) }
.neon-ring-full { stroke:var(--ring-a); opacity:0 }
.neon-tail-far { stroke:var(--ring-b); opacity:.25 }
.neon-tail-near { stroke:var(--ring-a); opacity:.6 }
.neon-ring .neon-head { stroke:#fff; stroke-width:max(2px,.55vmin) }
/* The glint is only seen while it runs its lap (the first ~22% of the cycle) */
.neon-glint { opacity:0; animation: neon-glint-show 12s ease-in-out 2s infinite both }
@keyframes neon-glint-show { 0% { opacity:0 } 4% { opacity:1 } 18% { opacity:1 } 22% { opacity:0 } 100% { opacity:0 } }
/* Countdown: a red glint laps every second, in time with the beeps */
.neon-ring-warn .neon-glint { animation:none; opacity:1 }
${lapKeyframes}
/* Result: the whole orbit flashes once (gold on a hit, the miss colour on a miss), then fades */
.neon-ring-win .neon-glint, .neon-ring-lose .neon-glint { display:none }
.neon-ring-win .neon-ring-full { animation: neon-flash 2.4s ease-out both }
.neon-ring-lose .neon-ring-full { animation: neon-flash 1.3s ease-out both }
.neon-ring-win svg { animation: neon-flare .6s cubic-bezier(.2,1.6,.4,1) both }
@keyframes neon-flash { 0% { opacity:0 } 12% { opacity:1 } 55% { opacity:.85 } 100% { opacity:0 } }
@keyframes neon-flare { 0% { transform:scale(.94) } 50% { transform:scale(1.05) } 100% { transform:scale(1) } }

@media (prefers-reduced-motion: reduce) {
  .neon-starfield, .neon-ring svg, .neon-ring ellipse, .neon-glint { animation: none !important }
}
`;

const RING_COLORS: Record<Exclude<NeonRingState, 'idle' | 'lose'>, [string, string]> = {
  warn: ['#ff2b2b', '#ff7a00'],
  win: ['#ffd43b', '#f59e0b'],
};

/** The space backdrop (fills its positioned parent). */
export function NeonBackdrop({ from, to }: { from: string; to: string }) {
  const stars = useMemo(() => [starLayer(11, 90, 0.5), starLayer(29, 24, 0.6)], []);
  return (
    <div className="neon-space" aria-hidden="true">
      {/* A still, barely-there wash of the two neon colours - no moving clouds */}
      <div
        className="neon-tint"
        style={{ background: `radial-gradient(60cqmax 40cqmax at 30% 35%, ${to}26, transparent), radial-gradient(55cqmax 40cqmax at 72% 70%, ${from}1a, transparent)` }}
      />
      {/* Stars on a very slow zoom-in, like drifting forward through space */}
      <div className="neon-starfield">
        <div className="neon-stars" style={{ boxShadow: stars[0] }} />
        <div className="neon-stars neon-stars-b" style={{ boxShadow: stars[1] }} />
      </div>
    </div>
  );
}

/** The orbit - render inside the relatively positioned box that holds the digits. */
export function NeonRing({ from, to, state, loseColor }: { from: string; to: string; state: NeonRingState; loseColor: string }) {
  const [a, b] = state === 'idle' ? [from, to] : state === 'lose' ? [loseColor, loseColor] : RING_COLORS[state];
  const ellipse = { cx: '50%', cy: '50%', rx: '50%', ry: '50%', pathLength: 100 } as const;
  return (
    <div
      className={`neon-ring neon-ring-${state}`}
      style={{ ['--ring-a' as string]: a, ['--ring-b' as string]: b } as CSSProperties}
      aria-hidden="true"
    >
      {/* keyed so the flash replays every round */}
      <svg key={state}>
        <ellipse className="neon-ring-full" {...ellipse} />
        <g className="neon-glint">
          {GLINT.map(({ len, cls }) => (
            <ellipse key={cls} className={cls} {...ellipse} strokeDasharray={`${len} ${100 - len}`} strokeDashoffset={len} />
          ))}
        </g>
      </svg>
    </div>
  );
}
