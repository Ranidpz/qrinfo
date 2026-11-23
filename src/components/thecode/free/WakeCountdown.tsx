'use client';

// קוד הגמדים — "when does this gnome wake up?" as a live countdown (Rani 24.11.2026): days · hours ·
// minutes · seconds while it is far, minutes · seconds · hundredths in its last hour, and the wall-clock
// time under it when it is more than an hour away ("מחר, יום ג׳, ב־18:00").
// It runs on the view's clock (`now` = the server clock in the live game, the demo clock in the demo):
// the offset to this device's clock is taken at every new `now`, then it ticks by itself (rAF while
// hundredths show, 4×/s otherwise) — the parent re-renders once a second at most.

import { useEffect, useRef, useState } from 'react';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const DAY_LETTER = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳'];

const dayName = (d: Date) => (d.getDay() === 6 ? 'שבת' : `יום ${DAY_LETTER[d.getDay()]}`);
const startOfDay = (ms: number) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };

/** "היום ב־18:00" / "מחר, יום ג׳, ב־18:00" / "ביום ה׳, 26.11, ב־09:30" — the device's own time zone. */
export function wakeClockLine(until: number, now: number): string {
  const d = new Date(until);
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const days = Math.round((startOfDay(until) - startOfDay(now)) / DAY);
  if (days <= 0) return `היום ב־${time}`;
  if (days === 1) return `מחר, ${dayName(d)}, ב־${time}`;
  return `ב${dayName(d)}, ${d.getDate()}.${d.getMonth() + 1}, ב־${time}`;
}

type Segment = { value: number; label: string; tick?: boolean };

function segmentsOf(left: number): Segment[] {
  const s = Math.floor(left / 1000);
  if (left >= DAY) {
    return [
      { value: Math.floor(left / DAY), label: 'ימים' },
      { value: Math.floor((left % DAY) / HOUR), label: 'שעות' },
      { value: Math.floor((left % HOUR) / 60_000), label: 'דקות' },
      { value: s % 60, label: 'שניות', tick: true },
    ];
  }
  if (left >= HOUR) {
    return [
      { value: Math.floor(left / HOUR), label: 'שעות' },
      { value: Math.floor((left % HOUR) / 60_000), label: 'דקות' },
      { value: s % 60, label: 'שניות', tick: true },
    ];
  }
  return [
    { value: Math.floor(left / 60_000), label: 'דקות' },
    { value: s % 60, label: 'שניות', tick: true },
    { value: Math.floor((left % 1000) / 10), label: 'מאיות' },
  ];
}

const STYLE = `
@keyframes tc-wake-spin { to { transform: rotate(360deg) } }
@keyframes tc-wake-tick { from { transform: translateY(-35%); opacity: .2 } to { transform: none; opacity: 1 } }
@keyframes tc-wake-blink { 0%, 100% { opacity: 1 } 50% { opacity: .25 } }
.tc-wake-ring { animation: tc-wake-spin 7s linear infinite; }
.tc-wake-tick { display: inline-block; animation: tc-wake-tick .35s cubic-bezier(.2,.8,.2,1) both; }
.tc-wake-colon { animation: tc-wake-blink 1s steps(2, jump-none) infinite; }
@media (prefers-reduced-motion: reduce) { .tc-wake-ring, .tc-wake-tick, .tc-wake-colon { animation: none; } }
`;

export default function WakeCountdown({ until, now, caption }: { until: number; now: number; caption?: string }) {
  // view clock − device clock, refreshed whenever the view hands a new `now`
  const offset = useRef(now - Date.now());
  useEffect(() => { offset.current = now - Date.now(); }, [now]);
  const [t, setT] = useState(now);
  const fine = until - t < HOUR; // hundredths → every frame
  useEffect(() => {
    let raf = 0;
    let iv: ReturnType<typeof setInterval> | null = null;
    const tick = () => setT(Date.now() + offset.current);
    if (fine) {
      const loop = () => { tick(); raf = requestAnimationFrame(loop); };
      raf = requestAnimationFrame(loop);
    } else {
      tick();
      iv = setInterval(tick, 250);
    }
    return () => { cancelAnimationFrame(raf); if (iv) clearInterval(iv); };
  }, [fine]);

  const left = Math.max(0, until - t);
  const segs = segmentsOf(left);
  return (
    <div className="flex w-full flex-col items-center gap-2" role="timer" aria-live="off"
      aria-label={left > 0 ? `הגמד יתעורר ${wakeClockLine(until, until - left)}` : 'הגמד מתעורר'}>
      <style>{STYLE}</style>
      {caption && <p className="text-lg leading-snug" style={{ color: 'var(--tc-soft)' }}><span aria-hidden className="me-1.5">💤</span>{caption}</p>}
      <div className="relative w-full overflow-hidden rounded-[22px] p-[2px]">
        <div aria-hidden className="tc-wake-ring absolute inset-[-60%]"
          style={{ background: 'conic-gradient(from 0deg, var(--tc-brass) 0deg, rgba(244,183,64,0) 90deg, rgba(110,160,255,.0) 200deg, rgba(110,160,255,.7) 300deg, var(--tc-brass) 360deg)' }} />
        <div className="relative flex items-start justify-center gap-1 rounded-[20px] px-2 py-3" dir="ltr"
          style={{ background: 'linear-gradient(180deg, #1E2766, #121845)' }}>
          {left === 0 ? (
            <p dir="rtl" className="tc-display py-2 text-3xl" style={{ color: 'var(--tc-mint)' }}>מתעורר…</p>
          ) : segs.map((sg, i) => (
            <div key={sg.label} className="flex items-start">
              {i > 0 && <span aria-hidden className="tc-wake-colon tc-num px-0.5 text-[clamp(1.6rem,8.5vw,2.4rem)] leading-none" style={{ color: 'var(--tc-brass)' }}>:</span>}
              <div className="flex min-w-[3.1ch] flex-col items-center">
                <span className="tc-num overflow-hidden text-[clamp(1.9rem,10vw,2.8rem)] leading-none" style={{ color: 'var(--tc-brass-hi)', textShadow: '0 0 18px rgba(244,183,64,.35)' }}>
                  {sg.tick
                    ? <span key={sg.value} className="tc-wake-tick">{String(sg.value).padStart(2, '0')}</span>
                    : String(sg.value).padStart(2, '0')}
                </span>
                <span className="mt-1 text-xs font-bold" style={{ color: 'var(--tc-soft)' }}>{sg.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      {left >= HOUR && (
        <p className="text-base font-bold" style={{ color: 'var(--tc-cream)' }}>
          <span aria-hidden className="me-1.5">⏰</span>מתעורר {wakeClockLine(until, until - left)}
        </p>
      )}
    </div>
  );
}
