'use client';

// קוד הגמדים — the big screen's selfie parade (Rani 13.11.2026): groups that chose to share a
// selfie get promoted — their round photo walks slowly on a track, like gnomes in a queue: each
// at its own pace, catching up with the one ahead, bumping, both stopping a moment, walking on.
// Never overlapping, never passing.
//
// Second round (Rani, the real TV): (1) the queue is the RANKING — first place leads, then
// second…; a rank change swaps the photos softly (cross-fade), never a jump; (2) the parade must
// hide NOTHING — it walks BEHIND the title, the board and the QR card. Third round (24.11.2026):
// the track is the whole frame of the screen, just inside its edges (see measureTrack).
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

/** The walkers in queue order: the board's ranking, groups with a selfie only, the first 10.
 *  `everyone` (free mode): emoji groups walk too — joining the game = joining the parade. */
export function paradeRoster(teams: ParadeTeam[], max = PARADE_MAX, everyone = false): ParadeWalker[] {
  return [...teams]
    .sort((a, b) => b.points - a.points)
    // rank 0 = not on the table yet (free mode lists only groups that scored) → no number badge
    .map((t, i) => ({ id: t.id, name: t.name, avatar: t.avatar, rank: everyone && t.points <= 0 ? 0 : i + 1 }))
    .filter((t) => isPhotoAvatar(t.avatar) || (everyone && !!t.avatar))
    .slice(0, max);
}

// ------------------------------------------------ the track: the screen's own frame

interface Track {
  /** Walker centres run on a rounded rectangle just inside the screen's edges. */
  xL: number; xR: number; yT: number; yB: number; r: number;
  /** Circle diameter + the name tag under it (px). */
  d: number; nameH: number;
  perimeter: number;
}

/**
 * Third round (Rani 24.11.2026): the parade walks the WHOLE frame of the screen, inside its
 * edges — along the top, down the side, along the bottom, up the other side — not a short loop
 * in one band. It walks BEHIND the title, the board and the QR card (the layer comes first), so
 * it never covers them; a walker passing behind one shows again on the other side.
 */
function measureTrack(): Track | null {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const pad = 0.012 * h;
  const nameH = 0.026 * h;
  const d = Math.min(0.075 * h, 0.06 * w);
  if (d < 28) return null;                        // a tiny window: no parade
  const halfW = (d * 1.5) / 2;                    // the name tag is up to 1.5 × the circle wide
  const xL = pad + halfW;
  const xR = w - pad - halfW;
  const yT = pad + d / 2 + 0.008 * h;             // room for the rank badge above the circle
  const yB = h - pad - nameH - d / 2;
  const r = Math.min(d * 1.4, (xR - xL) / 2, (yB - yT) / 2);
  if (xR - xL < 4 * d || yB - yT < 2 * d) return null;
  const perimeter = 2 * (xR - xL - 2 * r) + 2 * (yB - yT - 2 * r) + 2 * Math.PI * r;
  return { xL, xR, yT, yB, r, d, nameH, perimeter };
}

/** A point on the frame, counter-clockwise: left along the top, down the left side, right along the bottom, up the right side. */
function trackPoint(s: number, t: Track): { x: number; y: number } {
  const { xL, xR, yT, yB, r } = t;
  const across = xR - xL - 2 * r;
  const down = yB - yT - 2 * r;
  const arc = (Math.PI / 2) * r;
  let d = ((s % t.perimeter) + t.perimeter) % t.perimeter;
  const corner = (cx: number, cy: number, a0: number, len: number) => {
    const a = a0 + len / r;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  };
  if (d < across) return { x: xR - r - d, y: yT };                     // top, right → left
  d -= across;
  if (d < arc) return corner(xL + r, yT + r, -Math.PI / 2, -d);          // top-left corner
  d -= arc;
  if (d < down) return { x: xL, y: yT + r + d };                       // left side, down
  d -= down;
  if (d < arc) return corner(xL + r, yB - r, Math.PI, -d);               // bottom-left corner
  d -= arc;
  if (d < across) return { x: xL + r + d, y: yB };                     // bottom, left → right
  d -= across;
  if (d < arc) return corner(xR - r, yB - r, Math.PI / 2, -d);           // bottom-right corner
  d -= arc;
  if (d < down) return { x: xR, y: yB - r - d };                       // right side, up
  d -= down;
  return corner(xR - r, yT + r, 0, -d);                                // top-right corner
}

// ------------------------------------------------ the walk

interface Walker { s: number; v: number; waitUntil: number; bumpAt: number; retuneAt: number; walking: boolean }
/** Longest a walker stays held under the mouse (safety against a missed mouseleave). */
const HOVER_MAX_MS = 20000;

const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
/** The leader strolls; the ones behind walk a little faster, so the queue keeps catching up and bumping. */
const paceOf = (slot: number, base: number) => base * (slot === 0 ? rand(0.65, 0.95) : rand(0.85, 1.35));

export default function SelfieParade({ walkers, hidden }: { walkers: ParadeWalker[]; hidden?: boolean }) {
  const [track, setTrack] = useState<Track | null>(null);
  const trackRef = useRef<Track | null>(null);
  const slots = useRef<Walker[]>([]);
  const els = useRef<(HTMLDivElement | null)[]>([]);
  // Mouse over a walker (Rani 14.11.2026): it stops where it is and grows a little, so a face
  // can be looked at. Kept in refs — the rAF loop reads them, React never re-renders per frame.
  const hover = useRef<number | null>(null);
  const hoverAt = useRef(0);
  const hoverK = useRef<number[]>([]);
  const n = walkers.length;

  // Measure the frame now, on resize, and every few seconds.
  useEffect(() => {
    if (hidden || !n) return;
    const update = () => {
      const t = measureTrack();
      const prev = trackRef.current;
      trackRef.current = t;
      if (!t !== !prev || (t && prev && (Math.abs(t.d - prev.d) > 1 || Math.abs(t.xR - prev.xR) > 2 || Math.abs(t.yB - prev.yB) > 2))) setTrack(t);
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
    const base = 0.03 * window.innerHeight; // a long frame: a little quicker than the old short loop
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
        // ease toward the hover size instead of snapping (the loop writes transform every frame)
        const want = hover.current === i ? 1.18 : 1;
        const hk = (hoverK.current[i] ?? 1) + (want - (hoverK.current[i] ?? 1)) * 0.18;
        hoverK.current[i] = hk;
        el.style.zIndex = hk > 1.01 ? '5' : '';
        el.style.transform = `translate3d(${(x - t.d / 2).toFixed(1)}px, ${(y - t.d / 2).toFixed(1)}px, 0) scale(${(k * hk).toFixed(3)})`;
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
        // held by the mouse — but never for ever: a missed mouseleave (the pane loses focus, the
        // page reflows under the cursor) would jam the whole queue behind it.
        if (hover.current === i && now - hoverAt.current < HOVER_MAX_MS) { me.walking = false; continue; }
        if (hover.current === i) hover.current = null;
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
    <div aria-hidden className="tcl-parade pointer-events-none fixed inset-0 overflow-hidden"
      onMouseLeave={() => { hover.current = null; }}>
      <style>{PARADE_STYLE}</style>
      {walkers.map((t, i) => (
        // the SLOT is the place in the queue; when the ranking changes its photo cross-fades
        <div key={`slot-${i}`} ref={(el) => { els.current[i] = el; }} className="tcl-walker pointer-events-auto absolute left-0 top-0" data-walk="true"
          onMouseEnter={() => { hover.current = i; hoverAt.current = performance.now(); }}
          onMouseMove={() => { if (hover.current === i) hoverAt.current = performance.now(); }}
          onMouseLeave={() => { if (hover.current === i) hover.current = null; }}
          style={{ width: size, height: size, transform: 'translate3d(-400px,-400px,0)', ['--d' as string]: size }}>
          <div className="tcl-walker-body h-full w-full">
            <div key={t.id} className="tcl-walker-face h-full w-full">
              <WalkerPhoto url={t.avatar} />
              {t.rank > 0 && <span className="tcl-walker-rank">{t.rank}</span>}
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
  // An emoji group (free mode): the emoji in a round brass-ringed badge, same size as a photo.
  if (!isPhotoAvatar(url)) {
    return (
      <span className="flex h-full w-full items-center justify-center rounded-full"
        style={{ background: 'radial-gradient(circle, #3E2C74, #141a48)', boxShadow: '0 0 0 0.3vh var(--tc-brass), 0 0.5vh 1.2vh rgba(0,0,0,.4)', fontSize: 'calc(var(--d) * .55)', lineHeight: 1 }}>
        {url}
      </span>
    );
  }
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
