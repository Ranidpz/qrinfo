'use client';

// קוד הגמדים — Cliostro "calls" the group (Rani 23.11.2026: the clip is full screen, like a
// video call with the magician). Two steps:
//   1. ringing — the magician's picture, pulsing rings, "ענו" / "אחר כך";
//   2. live    — the clip fills the screen, a call bar on top (name, red dot, timer, "i"), hang-up below.
//      While he talks, what he says pops up as TEXT MESSAGES from the bottom, each new bubble pushing
//      the earlier ones up — like a phone (Rani). "i" hides / shows the messages.
// The "ענו" tap is a user gesture, so the clip may play WITH sound on iPhone (autoplay with sound
// is refused otherwise). No clip yet → a drawn placeholder that ends by itself after a few seconds.
// Overlay inside the phone column (absolute inset-0), above everything, safe-area aware.

import { useEffect, useRef, useState } from 'react';
import { useSfx } from '@/components/thecode/player/ui';

export interface MagicianCallProps {
  /** The clip (R2 / any URL). Absent = placeholder. */
  url?: string | null;
  /** What the clip is about — shown on the placeholder. */
  topic: string;
  /** What the magician says, in writing — popped up as text messages during the call (Rani). */
  lines?: string[];
  /** Second of the clip at which each line pops up. Absent = FIRST_MS, then every STEP_MS. */
  lineTimes?: number[];
  /** The call ended: hung up, the clip finished, or "אחר כך". */
  onEnd(): void;
}

const NAME = 'הקוסם קליוסטרו';
/** Default rhythm of the messages: the first after a few seconds, then one every few seconds. */
const FIRST_MS = 3000;
const STEP_MS = 3200;
/** Without a clip the placeholder hangs up this long after the last message. */
const PLACEHOLDER_TAIL_MS = 4500;

const STYLE = `
@keyframes tcm-ring { 0% { transform: scale(1); opacity: .55 } 100% { transform: scale(1.9); opacity: 0 } }
.tcm-ring { position: absolute; inset: 0; border-radius: 50%; border: 3px solid rgba(244,183,64,.7); animation: tcm-ring 1.8s ease-out infinite; }
@keyframes tcm-shake { 0%,100% { transform: rotate(0) } 10%,30% { transform: rotate(-12deg) } 20%,40% { transform: rotate(12deg) } 50% { transform: rotate(0) } }
.tcm-answer { animation: tcm-shake 1.2s ease-in-out infinite; }
@keyframes tcm-dot { 50% { opacity: .25 } }
.tcm-dot { animation: tcm-dot 1s step-end infinite; }
/* a new message grows from nothing (so the ones above slide up smoothly), then pops in */
@keyframes tcm-grow { from { grid-template-rows: 0fr } to { grid-template-rows: 1fr } }
@keyframes tcm-pop { 0% { transform: translateY(70%) scale(.85); opacity: 0 } 70% { transform: translateY(-4%) scale(1.02); opacity: 1 } 100% { transform: none; opacity: 1 } }
.tcm-msg { display: grid; animation: tcm-grow .35s ease-out both; }
.tcm-msg > div { min-height: 0; }
.tcm-bubble { animation: tcm-pop .45s cubic-bezier(.2,.9,.3,1.2) .05s both; transform-origin: 100% 100%; }
.tcm-feed { mask-image: linear-gradient(to bottom, transparent 0, #000 18%); }
@media (prefers-reduced-motion: reduce) { .tcm-ring, .tcm-answer, .tcm-dot, .tcm-msg, .tcm-bubble { animation: none !important; } }
`;

function Magician({ size }: { size: number }) {
  return (
    <span className="relative flex items-center justify-center rounded-full"
      style={{ width: size, height: size, background: 'radial-gradient(circle at 50% 35%, #5B3FA6, #1A1240)', boxShadow: '0 0 0 4px var(--tc-brass), 0 20px 60px rgba(0,0,0,.5)' }}>
      <span aria-hidden style={{ fontSize: size * 0.55, lineHeight: 1 }}>🧙‍♂️</span>
    </span>
  );
}

function PhoneIcon({ down }: { down?: boolean }) {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden style={down ? { transform: 'rotate(135deg)' } : undefined}>
      <path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.6a1 1 0 0 1-.25 1z" />
    </svg>
  );
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export default function MagicianCall({ url, topic, lines = [], lineTimes, onEnd }: MagicianCallProps) {
  const sfx = useSfx();
  const [live, setLive] = useState(false);
  /** Ms into the call: the clip's own clock when there is a clip, a timer for the placeholder. */
  const [elapsed, setElapsed] = useState(0);
  const [showText, setShowText] = useState(true);
  const times = lines.map((_, i) => (lineTimes?.[i] !== undefined ? lineTimes[i] * 1000 : FIRST_MS + i * STEP_MS));
  const shown = lines.filter((_, i) => elapsed >= times[i]).length;
  const secs = Math.floor(elapsed / 1000);
  const video = useRef<HTMLVideoElement>(null);

  // A soft ring while it rings.
  useEffect(() => {
    if (live) return;
    sfx('tick');
    const t = setInterval(() => sfx('tick'), 1400);
    return () => clearInterval(t);
  }, [live, sfx]);

  // The placeholder's clock (a clip drives `elapsed` itself, via onTimeUpdate); it hangs up after the last message.
  const lastAt = times.length ? times[times.length - 1] : 0;
  useEffect(() => {
    if (!live || url) return;
    const start = Date.now();
    const t = setInterval(() => setElapsed(Date.now() - start), 200);
    const end = setTimeout(onEnd, lastAt + PLACEHOLDER_TAIL_MS);
    return () => { clearInterval(t); clearTimeout(end); };
  }, [live, url, lastAt, onEnd]);

  // A soft "message" blip for every new bubble.
  const lastShown = useRef(0);
  useEffect(() => {
    if (shown > lastShown.current && showText) sfx('key');
    lastShown.current = shown;
  }, [shown, showText, sfx]);

  const answer = () => {
    sfx('tap');
    setLive(true);
    // Inside the tap: the browser allows sound now.
    requestAnimationFrame(() => { void video.current?.play().catch(() => {}); });
  };

  return (
    <div dir="rtl" role="dialog" aria-modal="true" aria-label={`שיחת וידאו מ${NAME}`} className="absolute inset-0 z-50 overflow-hidden"
      style={{ background: 'radial-gradient(120% 80% at 50% 20%, #2B1D5C, #070A22 70%)' }}>
      <style>{STYLE}</style>

      {!live ? (
        <div className="flex h-full flex-col items-center justify-between px-6 pt-[12svh]"
          style={{ paddingBottom: 'max(28px, calc(env(safe-area-inset-bottom) + 20px))' }}>
          <div className="flex flex-col items-center gap-5 text-center">
            <div className="relative">
              <span className="tcm-ring" />
              <span className="tcm-ring" style={{ animationDelay: '.6s' }} />
              <span className="tcm-ring" style={{ animationDelay: '1.2s' }} />
              <Magician size={150} />
            </div>
            <div>
              <p className="tc-display text-[2.1rem] leading-tight" style={{ color: 'var(--tc-cream)' }}>{NAME}</p>
              <p className="mt-1 text-lg" style={{ color: 'var(--tc-soft)' }}>שיחת וידאו נכנסת…</p>
            </div>
          </div>
          <div className="flex w-full items-end justify-around">
            <button type="button" onClick={() => { sfx('tap'); onEnd(); }} className="flex flex-col items-center gap-2">
              <span className="flex h-[70px] w-[70px] items-center justify-center rounded-full text-white" style={{ background: '#E5484D' }}>
                <PhoneIcon down />
              </span>
              <span className="text-base font-bold" style={{ color: 'var(--tc-soft)' }}>אחר כך</span>
            </button>
            <button type="button" onClick={answer} className="flex flex-col items-center gap-2" autoFocus>
              <span className="tcm-answer flex h-[70px] w-[70px] items-center justify-center rounded-full text-white" style={{ background: '#30A46C' }}>
                <PhoneIcon />
              </span>
              <span className="text-base font-bold" style={{ color: 'var(--tc-cream)' }}>ענו</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {url ? (
            <video ref={video} src={url} playsInline autoPlay onEnded={onEnd}
              onTimeUpdate={(e) => setElapsed(e.currentTarget.currentTime * 1000)}
              className="absolute inset-0 h-full w-full bg-black object-cover" />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center gap-4 px-8 pt-[16svh] text-center">
              <span className="absolute start-5 top-16 rounded-full bg-black/40 px-2.5 py-1 text-xs font-bold" style={{ color: 'var(--tc-soft)' }}>משבצת וידאו</span>
              <div className="tc-a-bob"><Magician size={150} /></div>
              <p className="tc-display text-2xl leading-tight" style={{ color: 'var(--tc-brass-hi)' }}>כאן ירוץ הסרטון של קליוסטרו</p>
              <p className="text-base leading-snug" style={{ color: 'var(--tc-soft)' }}>{topic}</p>
            </div>
          )}
          {/* the call bar */}
          <div className="absolute inset-x-0 top-0 flex items-center justify-between px-5 pb-6 pt-4"
            style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,.6), rgba(0,0,0,0))', paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
            <div className="flex items-center gap-2">
              <span className="tcm-dot h-2.5 w-2.5 rounded-full" style={{ background: '#FF4D5E' }} aria-hidden />
              <span className="text-lg font-bold text-white" style={{ textShadow: '0 1px 6px rgba(0,0,0,.6)' }}>{NAME}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="tc-num text-base text-white/85" aria-label="משך השיחה">{fmt(secs)}</span>
              {!!lines.length && (
                <button type="button" onClick={() => { sfx('tap'); setShowText((o) => !o); }} aria-pressed={showText}
                  aria-label={showText ? 'הסתרת ההודעות' : 'הצגת מה שהקוסם אומר, בכתב'}
                  className="flex h-11 w-11 items-center justify-center rounded-full font-serif text-xl font-bold italic"
                  style={showText ? { background: 'var(--tc-brass)', color: '#2A1600' } : { background: 'rgba(255,255,255,.2)', color: '#fff', boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,.5)' }}>
                  i
                </button>
              )}
            </div>
          </div>
          {/* what he says, as text messages from the bottom; each new one pushes the earlier ones up */}
          {showText && shown > 0 && (
            <div aria-live="polite" className="tcm-feed absolute inset-x-4 bottom-[118px] flex max-h-[52%] flex-col justify-end gap-2 overflow-hidden pt-6">
              {lines.slice(0, shown).map((l, i) => (
                <div key={i} className="tcm-msg">
                  <div>
                    <div className="flex items-end gap-2">
                      {i === shown - 1 ? <span aria-hidden className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-base"
                        style={{ background: 'radial-gradient(circle at 50% 35%, #5B3FA6, #1A1240)', boxShadow: '0 0 0 1.5px var(--tc-brass)' }}>🧙‍♂️</span>
                        : <span aria-hidden className="w-7 shrink-0" />}
                      <p className="tcm-bubble max-w-[82%] rounded-[20px] rounded-br-md px-4 py-2.5 text-[1.05rem] leading-snug"
                        style={{ background: 'rgba(255,255,255,.94)', color: '#14162B', boxShadow: '0 4px 14px rgba(0,0,0,.3)' }}>
                        {l}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* hang up */}
          <div className="absolute inset-x-0 bottom-0 flex justify-center pt-10"
            style={{ paddingBottom: 'max(28px, calc(env(safe-area-inset-bottom) + 20px))', background: 'linear-gradient(to top, rgba(0,0,0,.55), rgba(0,0,0,0))' }}>
            <button type="button" onClick={() => { sfx('tap'); onEnd(); }} aria-label="סיום השיחה"
              className="flex h-[66px] w-[66px] items-center justify-center rounded-full text-white" style={{ background: '#E5484D', boxShadow: '0 8px 24px rgba(0,0,0,.45)' }}>
              <PhoneIcon down />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
