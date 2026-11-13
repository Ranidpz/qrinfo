'use client';

// קוד הגמדים — the big screen's selfie parade (Rani 13.11.2026): groups that chose to share a
// selfie get promoted — their round photo walks slowly on a track, like gnomes in a queue: each
// at its own pace, catching up with the one ahead, bumping, both stopping a moment, walking on.
// Never overlapping, never passing.
//
// Second round (Rani, the real TV): (1) the queue is the RANKING — first place leads, then
// second…; a rank change swaps the photos softly (cross-fade), never a jump; (2) the parade must
// hide NOTHING. So the track is measured from the screen itself: it runs only through the free
// band between the venue logo and the title, above the board and the QR card ([data-tcl-avoid]
// elements). No room → no parade.
//
// Performance (hours on a TV): one rAF loop writes `transform` only (no layout, no React state
// per frame), light shadows, no filters. prefers-reduced-motion → they stand still.
// Privacy: only photos the board already shows (TheCodeLeaderRow.photoUrl exists only while
// selfies are on), so selfies off ⇒ no parade.

import { useEffect, useRef, useState } from 'react';
import { isPhotoAvatar } from '@/components/thecode/player/Avatar';

export interface ParadeTeam { id: string; name: string; avatar: string; points: number }
export interface ParadeWalker { id: string; name: string; avatar: string; rank: number }

/** At most this many walk at once: the top of the board among groups with a selfie. */
export const PARADE_MAX = 10;

/** The walkers in queue order: the board's ranking, groups with a selfie only, the first 10. */
export function paradeRoster(teams: ParadeTeam[], max = PARADE_MAX): ParadeWalker[] {
  return [...teams]
    .sort((a, b) => b.points - a.points)
    .map((t, i) => ({ id: t.id, name: t.name, avatar: t.avatar, rank: i + 1 }))
    .filter((t) => isPhotoAvatar(t.avatar))
    .slice(0, max);
}

// ------------------------------------------------ the track (measured, never over anything)

interface Track {
  /** Walker centres: two lanes joined by half-circles (a stadium). */
  x0: number; x1: number; yTop: number; yBot: number; r: number;
  /** Circle diameter + the name tag under it (px). */
  d: number; nameH: number;
  perimeter: number;
}

const rectsOf = () => [...document.querySelectorAll<HTMLElement>('[data-tcl-avoid]')]
  .map((el) => el.getBoundingClientRect())
  .filter((r) => r.width > 0 && r.height > 0);

/**
 * The free band at the top of the screen: between the logo (left) and the title (right),
 * above the first element that starts lower down (the board, the QR card).
 */
function measureTrack(): Track | null {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const rects = rectsOf();
  const top = rects.filter((r) => r.top < h * 0.12);
  const below = rects.filter((r) => r.top >= h * 0.12);
  const pad = 0.012 * h;
  const bandTop = pad;
  const bandBottom = (below.length ? Math.min(...below.map((r) => r.top)) : h * 0.3) - pad;
  const left = Math.max(0.02 * w, ...top.filter((r) => r.left + r.width / 2 < w / 2).map((r) => r.right)) + pad;
  const right = Math.min(0.98 * w, ...top.filter((r) => r.left + r.width / 2 >= w / 2).map((r) => r.left)) - pad;
  const nameH = 0.026 * h;
  const avail = bandBottom - bandTop;
  const d = Math.min(0.08 * h, (avail - 0.01 * h) / 2 - nameH);
  if (d < 0.045 * h) return null;                 // too tight to read from across the room
  const halfW = Math.max(d / 2, (d * 1.5) / 2);   // the name tag is up to 1.5 × the circle wide
  const x0 = left + halfW;
  const x1 = right - halfW;
  const yTop = bandTop + d / 2;
  const yBot = bandBottom - nameH - d / 2;
  const r = (yBot - yTop) / 2;
  if (r <= 0 || x1 - x0 < 4 * r + 2 * d) return null;
  const straight = x1 - x0 - 2 * r;
  return { x0, x1, yTop, yBot, r, d, nameH, perimeter: 2 * straight + 2 * Math.PI * r };
}

/** A point on the stadium, counter-clockwise: left along the top, down the left end, right along the bottom, up the right end. */
function trackPoint(s: number, t: Track): { x: number; y: number } {
  const straight = t.x1 - t.x0 - 2 * t.r;
  const arc = Math.PI * t.r;
  const yMid = (t.yTop + t.yBot) / 2;
  let d = ((s % t.perimeter) + t.perimeter) % t.perimeter;
  if (d < straight) return { x: t.x1 - t.r - d, y: t.yTop };
  d -= straight;
  if (d < arc) { const a = d / t.r; return { x: t.x0 + t.r - t.r * Math.sin(a), y: yMid - t.r * Math.cos(a) }; }
  d -= arc;
  if (d < straight) return { x: t.x0 + t.r + d, y: t.yBot };
  d -= straight;
  const a = d / t.r;
  return { x: t.x1 - t.r + t.r * Math.sin(a), y: yMid + t.r * Math.cos(a) };
}

// ------------------------------------------------ the walk

interface Walker { s: number; v: number; waitUntil: number; bumpAt: number; retuneAt: number; walking: boolean }
const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
/** The leader strolls; the ones behind walk a little faster, so the queue keeps catching up and bumping. */
const paceOf = (slot: number, base: number) => base * (slot === 0 ? rand(0.65, 0.95) : rand(0.85, 1.35));

export default function SelfieParade({ walkers, hidden }: { walkers: ParadeWalker[]; hidden?: boolean }) {
  const [track, setTrack] = useState<Track | null>(null);
  const trackRef = useRef<Track | null>(null);
  const slots = useRef<Walker[]>([]);
  const els = useRef<(HTMLDivElement | null)[]>([]);
  const n = walkers.length;

  // Measure the free band now, on resize, and every few seconds (a logo may load late).
  useEffect(() => {
    if (hidden || !n) return;
    const update = () => {
      const t = measureTrack();
      const prev = trackRef.current;
      trackRef.current = t;
      if (!t !== !prev || (t && prev && (Math.abs(t.d - prev.d) > 1 || Math.abs(t.x1 - prev.x1) > 2 || Math.abs(t.x0 - prev.x0) > 2 || Math.abs(t.yBot - prev.yBot) > 2))) setTrack(t);
    };
    update();
    const id = setInterval(update, 3000);
    window.addEventListener('resize', update);
    return () => { clearInterval(id); window.removeEventListener('resize', update); };
  }, [hidden, n]);

  useEffect(() => {
    if (hidden || !n || !track) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const gap = track.d * 1.18;
    const base = 0.022 * window.innerHeight;
    const now0 = performance.now();
    // Keep the walkers we have; a new last place joins at the back of the queue.
    const cur = slots.current.slice(0, n);
    while (cur.length < n) {
      const back = cur.length ? cur[cur.length - 1].s - gap * 1.6 : track.perimeter * 0.15;
      cur.push({ s: back, v: paceOf(cur.length, base), waitUntil: 0, bumpAt: -1e9, retuneAt: now0 + rand(6000, 14000), walking: true });
    }
    slots.current = cur;

    const paint = (now: number) => {
      const t = trackRef.current;
      if (!t) return;
      for (let i = 0; i < n; i++) {
        const wk = slots.current[i];
        const el = els.current[i];
        if (!wk || !el) continue;
        const { x, y } = trackPoint(wk.s, t);
        const since = now - wk.bumpAt;
        const k = since < 420 ? 1 + 0.09 * Math.sin((since / 420) * Math.PI) : 1;
        el.style.transform = `translate3d(${(x - t.d / 2).toFixed(1)}px, ${(y - t.d / 2).toFixed(1)}px, 0) scale(${k.toFixed(3)})`;
        const walking = String(wk.walking);
        if (el.dataset.walk !== walking) el.dataset.walk = walking;
      }
    };

    if (reduce) {
      slots.current.forEach((wk, i) => { wk.s = track.perimeter * (0.15 - i / n); wk.walking = false; });
      paint(performance.now());
      return;
    }

    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000); // a hidden tab resumes calmly, no jump
      last = now;
      const P = track.perimeter;
      const q = slots.current;
      for (let i = 0; i < n; i++) {
        const me = q[i];
        if (now > me.retuneAt) { me.v = paceOf(i, base); me.retuneAt = now + rand(6000, 14000); }
        if (now >= me.waitUntil && Math.random() < dt * 0.03) me.waitUntil = now + rand(900, 2000); // stops to look around
        if (now < me.waitUntil) { me.walking = false; continue; }
        let target = me.s + me.v * dt;
        // the one ahead in the QUEUE (= one place higher); the leader's "ahead" is the last, a lap on
        const limit = n > 1 ? (i === 0 ? q[n - 1].s + P : q[i - 1].s) - gap : Infinity;
        if (target >= limit) {
          target = Math.max(me.s, limit);
          if (now - me.bumpAt > 1500) {
            const ahead = q[i === 0 ? n - 1 : i - 1];
            me.bumpAt = now;
            ahead.bumpAt = now;
            me.waitUntil = now + rand(700, 1300);
            if (now >= ahead.waitUntil) ahead.waitUntil = now + rand(350, 700);
          }
        }
        me.walking = target > me.s + 0.01;
        me.s = target;
      }
      if (q[n - 1].s > P * 8) for (const wk of q) wk.s -= P * 4; // keep the numbers small over hours
      paint(now);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [hidden, n, track]);

  if (hidden || !n || !track) return null;
  const size = `${track.d.toFixed(1)}px`;
  return (
    <div aria-hidden className="tcl-parade pointer-events-none fixed inset-0 overflow-hidden">
      <style>{PARADE_STYLE}</style>
      {walkers.map((t, i) => (
        // the SLOT is the place in the queue; when the ranking changes its photo cross-fades
        <div key={`slot-${i}`} ref={(el) => { els.current[i] = el; }} className="tcl-walker absolute left-0 top-0" data-walk="true"
          style={{ width: size, height: size, transform: 'translate3d(-400px,-400px,0)', ['--d' as string]: size }}>
          <div className="tcl-walker-body h-full w-full">
            <div key={t.id} className="tcl-walker-face h-full w-full">
              <WalkerPhoto url={t.avatar} />
              <span className="tcl-walker-rank">{t.rank}</span>
              <span className="tcl-walker-name">{t.name}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function WalkerPhoto({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="block h-full w-full rounded-full" style={{ background: 'rgba(244,183,64,.25)', boxShadow: '0 0 0 0.3vh var(--tc-brass)' }} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" decoding="async" onError={() => setFailed(true)} draggable={false}
      className="block h-full w-full rounded-full object-cover"
      style={{ boxShadow: '0 0 0 0.3vh var(--tc-brass), 0 0.5vh 1.2vh rgba(0,0,0,.4)' }} />
  );
}

const PARADE_STYLE = `
.tcl-walker { will-change: transform; }
.tcl-walker-face { position: relative; animation: tcl-walker-in .9s ease-out both; }
@keyframes tcl-walker-in { from { opacity: 0 } to { opacity: 1 } }
.tcl-walker[data-walk="true"] .tcl-walker-body { animation: tcl-step .55s ease-in-out infinite alternate; }
@keyframes tcl-step { from { transform: translateY(0) rotate(-3deg) } to { transform: translateY(-0.6vh) rotate(3deg) } }
.tcl-walker-rank { position: absolute; top: -4%; right: -4%; min-width: calc(var(--d) * .34); height: calc(var(--d) * .34);
  display: flex; align-items: center; justify-content: center; border-radius: 999px; padding: 0 .3vh;
  font-size: calc(var(--d) * .22); font-weight: 900; line-height: 1; color: #2A1600; background: var(--tc-brass);
  box-shadow: 0 0 0 .2vh rgba(6,9,30,.6); font-variant-numeric: tabular-nums; }
.tcl-walker-name { position: absolute; left: 50%; top: 100%; transform: translateX(-50%); margin-top: .35vh;
  max-width: calc(var(--d) * 1.5); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: 1.7vh; font-weight: 800; line-height: 1.1; color: var(--tc-cream); padding: .25vh .6vw; border-radius: 999px;
  background: rgba(6,9,30,.62); }
@media (prefers-reduced-motion: reduce) { .tcl-walker-face, .tcl-walker-body { animation: none !important; } }
`;
