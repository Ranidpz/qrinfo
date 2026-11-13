'use client';

// קוד הגמדים — the big screen's selfie parade (Rani 13.11.2026): groups that chose to share a
// selfie get promoted — their round photo walks slowly around the screen's frame, like gnomes in
// a queue: each walks at its own pace, catches up with the one ahead, bumps into it, both stop
// for a moment, then walk on. Never overlapping, never passing through each other.
//
// Performance (runs for hours on a TV): one rAF loop writes `transform` only (no layout, no
// React state per frame), light shadows, no filters. prefers-reduced-motion → they stand still.
// Privacy: only photos the board already shows (TheCodeLeaderRow.photoUrl exists only while
// selfies are on), so selfies off ⇒ no parade.

import { useEffect, useMemo, useRef, useState } from 'react';
import { isPhotoAvatar } from '@/components/thecode/player/Avatar';

export interface ParadeTeam { id: string; name: string; avatar: string; points: number }

/** At most this many walk at once; with more groups they take turns. */
export const PARADE_MAX = 10;
const ROTATE_MS = 20_000;
const DIAMETER_VH = 8;

// ------------------------------------------------ who walks

/**
 * The walkers: groups with a selfie, the most recently scoring first. With more than
 * PARADE_MAX, every ROTATE_MS the longest-walking one hands its place to the next in line,
 * so everyone gets a turn; a group that just scored jumps the line.
 */
export function useParadeRoster(teams: ParadeTeam[], lastGain: Record<string, number>, max = PARADE_MAX): ParadeTeam[] {
  const candidates = useMemo(() => teams
    .filter((t) => isPhotoAvatar(t.avatar))
    .sort((a, b) => (lastGain[b.id] ?? 0) - (lastGain[a.id] ?? 0) || b.points - a.points), [teams, lastGain]);
  const [roster, setRoster] = useState<string[]>([]);
  const since = useRef<Record<string, number>>({});
  const next = useRef(0);

  // Keep the roster valid, fill free places, and let a fresh scorer in at once.
  useEffect(() => {
    setRoster((cur) => {
      const ids = new Set(candidates.map((c) => c.id));
      let r = cur.filter((id) => ids.has(id));
      for (const c of candidates) {
        if (r.length >= max) break;
        if (!r.includes(c.id)) r = [...r, c.id];
      }
      const fresh = candidates.find((c) => !r.includes(c.id) && (lastGain[c.id] ?? 0) > Date.now() - 30_000);
      if (fresh && r.length >= max) {
        const oldest = [...r].sort((a, b) => (since.current[a] ?? 0) - (since.current[b] ?? 0))[0];
        r = r.map((id) => (id === oldest ? fresh.id : id));
      }
      const now = Date.now();
      for (const id of r) if (!since.current[id]) since.current[id] = now;
      for (const id of Object.keys(since.current)) if (!r.includes(id)) delete since.current[id];
      return r.length === cur.length && r.every((id, i) => id === cur[i]) ? cur : r;
    });
  }, [candidates, lastGain, max]);

  // Taking turns.
  useEffect(() => {
    if (candidates.length <= max) return;
    const t = setInterval(() => {
      setRoster((cur) => {
        const waiting = candidates.filter((c) => !cur.includes(c.id));
        if (!waiting.length) return cur;
        const incoming = waiting[next.current++ % waiting.length];
        const oldest = [...cur].sort((a, b) => (since.current[a] ?? 0) - (since.current[b] ?? 0))[0];
        delete since.current[oldest];
        since.current[incoming.id] = Date.now();
        return cur.map((id) => (id === oldest ? incoming.id : id));
      });
    }, ROTATE_MS);
    return () => clearInterval(t);
  }, [candidates, max]);

  const byId = useMemo(() => Object.fromEntries(candidates.map((c) => [c.id, c])), [candidates]);
  return roster.map((id) => byId[id]).filter(Boolean);
}

// ------------------------------------------------ the walk (pure, tested in the page)

interface Walker {
  s: number;        // px along the loop
  v: number;        // px / s while walking
  waitUntil: number;
  bumpAt: number;
  retuneAt: number;
  walking: boolean;
}

/** The closed loop around the screen, counter-clockwise: up the right, along the top, down the left, back along the bottom. */
function loopPoint(s: number, w: number, h: number, m: number): { x: number; y: number } {
  const a = h - 2 * m; // right edge (up)
  const b = w - 2 * m; // top edge (to the left)
  const p = 2 * (a + b);
  let d = ((s % p) + p) % p;
  if (d < a) return { x: w - m, y: h - m - d };
  d -= a;
  if (d < b) return { x: w - m - d, y: m };
  d -= b;
  if (d < a) return { x: m, y: m + d };
  d -= a;
  return { x: m + d, y: h - m };
}

const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

// ------------------------------------------------ the parade

export default function SelfieParade({ teams, hidden }: { teams: ParadeTeam[]; hidden?: boolean }) {
  const els = useRef<Record<string, HTMLDivElement | null>>({});
  const walkers = useRef<Record<string, Walker>>({});
  const ids = teams.map((t) => t.id).join('|');

  useEffect(() => {
    if (hidden || !teams.length) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let last = performance.now();

    const geom = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const r = (DIAMETER_VH / 100) * h / 2;
      const m = r + 0.016 * h;
      const perimeter = 2 * ((h - 2 * m) + (w - 2 * m));
      return { w, h, r, m, perimeter, gap: 2 * r + 0.012 * h, speed: 0.022 * h };
    };

    // New walkers step in where there is the most room; ones that left are forgotten.
    const g0 = geom();
    const live = teams.map((t) => t.id);
    for (const id of Object.keys(walkers.current)) if (!live.includes(id)) delete walkers.current[id];
    for (const id of live) {
      if (walkers.current[id]) continue;
      const taken = Object.values(walkers.current).map((x) => ((x.s % g0.perimeter) + g0.perimeter) % g0.perimeter).sort((a, b) => a - b);
      let s = Math.random() * g0.perimeter;
      if (taken.length) {
        let best = 0;
        let at = 0;
        taken.forEach((p, i) => {
          const nextP = i + 1 < taken.length ? taken[i + 1] : taken[0] + g0.perimeter;
          if (nextP - p > best) { best = nextP - p; at = p + (nextP - p) / 2; }
        });
        s = at;
      } else if (reduce) s = 0;
      walkers.current[id] = { s, v: g0.speed * rand(0.7, 1.3), waitUntil: 0, bumpAt: -1e9, retuneAt: performance.now() + rand(6000, 14000), walking: true };
    }

    const paint = (now: number) => {
      const g = geom();
      for (const id of live) {
        const wk = walkers.current[id];
        const el = els.current[id];
        if (!wk || !el) continue;
        const { x, y } = loopPoint(wk.s, g.w, g.h, g.m);
        const since = now - wk.bumpAt;
        const k = since < 420 ? 1 + 0.09 * Math.sin((since / 420) * Math.PI) : 1;
        el.style.transform = `translate3d(${(x - g.r).toFixed(1)}px, ${(y - g.r).toFixed(1)}px, 0) scale(${k.toFixed(3)})`;
        const walking = wk.walking;
        if (el.dataset.walk !== String(walking)) el.dataset.walk = String(walking);
      }
    };

    if (reduce) {
      // Standing still, spread evenly around the frame.
      live.forEach((id, i) => { walkers.current[id].s = (i / live.length) * g0.perimeter; walkers.current[id].walking = false; });
      paint(performance.now());
      const onResize = () => paint(performance.now());
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }

    const step = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000); // a hidden tab resumes calmly, no jump
      last = now;
      const g = geom();
      // positions live on the circle [0, perimeter): sorting gives the queue's order, and the
      // last one's "ahead" is the first one, one lap further
      for (const id of live) { const w = walkers.current[id]; if (w) w.s = ((w.s % g.perimeter) + g.perimeter) % g.perimeter; }
      const order = live.filter((id) => walkers.current[id]).sort((a, b) => walkers.current[a].s - walkers.current[b].s);
      const n = order.length;
      for (let i = 0; i < n; i++) {
        const me = walkers.current[order[i]];
        // now and then a gnome changes its pace, or just stops to look around
        if (now > me.retuneAt) { me.v = g.speed * rand(0.7, 1.3); me.retuneAt = now + rand(6000, 14000); }
        if (now >= me.waitUntil && Math.random() < dt * 0.035) me.waitUntil = now + rand(900, 2200);
        if (now < me.waitUntil) { me.walking = false; continue; }
        let target = me.s + me.v * dt;
        if (n > 1) {
          const ahead = walkers.current[order[(i + 1) % n]];
          const aheadS = i + 1 < n ? ahead.s : ahead.s + g.perimeter;
          const limit = aheadS - g.gap;
          if (target >= limit) {
            target = Math.max(me.s, limit);
            // caught up: a little bump, both stop, then the front one walks off first
            if (now - me.bumpAt > 1500) {
              me.bumpAt = now;
              ahead.bumpAt = now;
              me.waitUntil = now + rand(700, 1300);
              if (now >= ahead.waitUntil) ahead.waitUntil = now + rand(350, 700);
            }
          }
        }
        me.walking = target > me.s + 0.01; // stuck behind someone = standing, not stepping
        me.s = target;
      }
      paint(now);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the walk restarts only when WHO walks changes
  }, [ids, hidden]);

  if (hidden || !teams.length) return null;
  return (
    <div aria-hidden className="tcl-parade pointer-events-none fixed inset-0 overflow-hidden">
      <style>{PARADE_STYLE}</style>
      {teams.map((t) => (
        <div key={t.id} ref={(el) => { els.current[t.id] = el; }} className="tcl-walker absolute left-0 top-0" data-walk="true"
          style={{ width: `${DIAMETER_VH}vh`, height: `${DIAMETER_VH}vh`, transform: 'translate3d(-200px,-200px,0)' }}>
          <div className="tcl-walker-body h-full w-full">
            <WalkerPhoto url={t.avatar} />
            <span className="tcl-walker-name">{t.name}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function WalkerPhoto({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="block h-full w-full rounded-full" style={{ background: 'rgba(244,183,64,.25)', boxShadow: '0 0 0 0.35vh var(--tc-brass)' }} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" decoding="async" onError={() => setFailed(true)} draggable={false}
      className="block h-full w-full rounded-full object-cover"
      style={{ boxShadow: '0 0 0 0.35vh var(--tc-brass), 0 0.6vh 1.4vh rgba(0,0,0,.4)' }} />
  );
}

const PARADE_STYLE = `
.tcl-walker { will-change: transform; animation: tcl-walker-in .8s ease-out both; }
@keyframes tcl-walker-in { from { opacity: 0 } to { opacity: 1 } }
.tcl-walker[data-walk="true"] .tcl-walker-body { animation: tcl-step .55s ease-in-out infinite alternate; }
@keyframes tcl-step { from { transform: translateY(0) rotate(-3deg) } to { transform: translateY(-0.7vh) rotate(3deg) } }
.tcl-walker-body { position: relative; }
.tcl-walker-name { position: absolute; left: 50%; top: 100%; transform: translateX(-50%); margin-top: .5vh; max-width: 13vw;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 1.8vh; font-weight: 800; line-height: 1;
  color: var(--tc-cream); padding: .35vh .7vw; border-radius: 999px; background: rgba(6,9,30,.62); }
@media (prefers-reduced-motion: reduce) { .tcl-walker, .tcl-walker-body { animation: none !important; } }
`;
