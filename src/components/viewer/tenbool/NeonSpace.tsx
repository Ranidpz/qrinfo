'use client';

import { useMemo, type CSSProperties } from 'react';

// "חלל ניאון" background for 10 בול, kept minimal so the timer stays the hero: a deep-space
// gradient (owner's colours), faint stars that drift a little and fade in and out (optional), and a
// huge round orbit around the digits. The orbit is invisible at rest - a glint runs one lap of it
// now and then - and reacts to the game: a red glint every second in the countdown, a gold flash of
// the whole orbit on a hit, nothing on a miss. Pure CSS + SVG, no assets, so it keeps
// working offline. Backdrop sizes are container units (cq*), so the settings preview reuses it.

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

/** Hex colour between a and b (t = 0..1) - the gradient's middle stop, in CSS and on the share card */
export function mixHex(a: string, b: string, t: number) {
  const p = (h: string) => {
    const x = h.replace('#', '');
    const f = x.length === 3 ? x.split('').map((c) => c + c).join('') : x.padEnd(6, '0').slice(0, 6);
    return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16) || 0);
  };
  const [ca, cb] = [p(a), p(b)];
  return `#${ca.map((v, i) => Math.round(v + (cb[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

/** The space gradient: centre colour, a darker middle, the edge colour */
export function spaceGradient(centre: string, edge: string) {
  return `radial-gradient(ellipse at 50% 45%, ${centre} 0%, ${mixHex(centre, edge, 0.55)} 45%, ${edge} 100%)`;
}

// Stars: a few sparse layers, each fading in, drifting a touch, and fading out on its own clock, so
// single stars come and go instead of a fixed, noticeable sky. Seeds keep the sky identical everywhere.
const STAR_LAYERS = [
  { seed: 11, count: 26, alpha: 0.5, size: 1, dx: -1.6, dy: -1, dur: 15, delay: 0 },
  { seed: 29, count: 26, alpha: 0.5, size: 1, dx: 1.4, dy: -1.2, dur: 17, delay: -6 },
  { seed: 47, count: 22, alpha: 0.45, size: 1, dx: -1, dy: 1.3, dur: 19, delay: -11 },
  { seed: 83, count: 10, alpha: 0.55, size: 2, dx: 1.2, dy: 0.8, dur: 21, delay: -3 },
];
const starKeyframes = STAR_LAYERS.map(
  ({ dx, dy, dur, delay }, i) => `
@keyframes neon-star-${i} { 0% { opacity:0; transform:translate(0,0) } 30% { opacity:1 } 70% { opacity:1 } 100% { opacity:0; transform:translate(${dx}cqw,${dy}cqh) } }
.neon-stars-${i} { animation: neon-star-${i} ${dur}s ease-in-out ${delay}s infinite }`
).join('');

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
.neon-space { position:absolute; inset:0; overflow:hidden; pointer-events:none; container-type:size }
.neon-tint { position:absolute; inset:0 }
.neon-stars { position:absolute; left:0; top:0; border-radius:9999px; opacity:0 }
${starKeyframes}

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
/* Result: a hit flashes the whole orbit gold once, then it fades; a miss shows no orbit at all */
.neon-ring-win .neon-glint, .neon-ring-lose .neon-glint { display:none }
.neon-ring-win .neon-ring-full { animation: neon-flash 2.4s ease-out both }
.neon-ring-win svg { animation: neon-flare .6s cubic-bezier(.2,1.6,.4,1) both }
@keyframes neon-flash { 0% { opacity:0 } 12% { opacity:1 } 55% { opacity:.85 } 100% { opacity:0 } }
@keyframes neon-flare { 0% { transform:scale(.94) } 50% { transform:scale(1.05) } 100% { transform:scale(1) } }

@media (prefers-reduced-motion: reduce) {
  .neon-ring svg, .neon-ring ellipse, .neon-glint, .neon-stars { animation: none !important }
  .neon-stars { opacity:.6 }
}
`;

const RING_COLORS: Record<Exclude<NeonRingState, 'idle' | 'lose'>, [string, string]> = {
  warn: ['#ff2b2b', '#ff7a00'],
  win: ['#ffd43b', '#f59e0b'],
};

/** The space backdrop (fills its positioned parent). */
export function NeonBackdrop({ from, to, centre, edge, stars }: { from: string; to: string; centre: string; edge: string; stars: boolean }) {
  const layers = useMemo(() => STAR_LAYERS.map((l) => starLayer(l.seed, l.count, l.alpha)), []);
  return (
    <div className="neon-space" style={{ background: spaceGradient(centre, edge) }} aria-hidden="true">
      {/* A still, barely-there wash of the two neon colours - no moving clouds */}
      <div
        className="neon-tint"
        style={{ background: `radial-gradient(60cqmax 40cqmax at 30% 35%, ${to}26, transparent), radial-gradient(55cqmax 40cqmax at 72% 70%, ${from}1a, transparent)` }}
      />
      {stars &&
        STAR_LAYERS.map((l, i) => (
          <div key={l.seed} className={`neon-stars neon-stars-${i}`} style={{ width: l.size, height: l.size, boxShadow: layers[i] }} />
        ))}
    </div>
  );
}

/** The orbit - render inside the relatively positioned box that holds the digits. */
export function NeonRing({ from, to, state }: { from: string; to: string; state: NeonRingState }) {
  const [a, b] = state === 'idle' || state === 'lose' ? [from, to] : RING_COLORS[state];
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
