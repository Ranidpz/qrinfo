'use client';

// קוד הגמדים — Cliostro "calls" the group (Rani 23.11.2026: the clip is full screen, like a
// video call with the magician). Two steps:
//   1. ringing — the magician's picture, pulsing rings, "ענו" / "אחר כך";
//   2. live    — the clip fills the screen, a call bar on top (name, red dot, timer), hang-up below.
// Any text the magician shows (the rules as bullet points…) is edited INTO the clip itself (Rani,
// 23.11.2026: "אני יכול לערוך את הוידאו שהנקודות בפנים") — this component only plays it.
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
  /** The call ended: hung up, the clip finished, or "אחר כך". */
  onEnd(): void;
}

const NAME = 'הקוסם קליוסטרו';
/** Without a clip the placeholder call hangs up by itself after this long. */
const PLACEHOLDER_MS = 6000;

const STYLE = `
@keyframes tcm-ring { 0% { transform: scale(1); opacity: .55 } 100% { transform: scale(1.9); opacity: 0 } }
.tcm-ring { position: absolute; inset: 0; border-radius: 50%; border: 3px solid rgba(244,183,64,.7); animation: tcm-ring 1.8s ease-out infinite; }
@keyframes tcm-shake { 0%,100% { transform: rotate(0) } 10%,30% { transform: rotate(-12deg) } 20%,40% { transform: rotate(12deg) } 50% { transform: rotate(0) } }
.tcm-answer { animation: tcm-shake 1.2s ease-in-out infinite; }
@keyframes tcm-dot { 50% { opacity: .25 } }
.tcm-dot { animation: tcm-dot 1s step-end infinite; }
@media (prefers-reduced-motion: reduce) { .tcm-ring, .tcm-answer, .tcm-dot { animation: none !important; } }
`;

/** The magician's face in a round frame — cropped from the big screen's wizard art (merlush-v2). */
function Magician({ size }: { size: number }) {
  return (
    <span aria-hidden className="relative block rounded-full"
      style={{
        width: size, height: size,
        backgroundColor: '#0A0E2A',
        backgroundImage: 'url(/thecode/lobby/merlush-v2.webp)',
        backgroundSize: '492% auto',
        backgroundPosition: '26.3% 20%',
        boxShadow: '0 0 0 4px var(--tc-brass), 0 20px 60px rgba(0,0,0,.5)',
      }} />
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

export default function MagicianCall({ url, topic, onEnd }: MagicianCallProps) {
  const sfx = useSfx();
  const [live, setLive] = useState(false);
  /** Ms into the call: the clip's own clock when there is a clip, a timer for the placeholder. */
  const [elapsed, setElapsed] = useState(0);
  const secs = Math.floor(elapsed / 1000);
  const video = useRef<HTMLVideoElement>(null);
  // Latest onEnd without restarting the hang-up timer on every parent render (the live clock ticks each second).
  const endRef = useRef(onEnd);
  useEffect(() => { endRef.current = onEnd; });

  // The phone RINGS while it rings (Rani 24.11.2026: the soft tick went unheard), and buzzes where
  // the phone can (Android). iPhone: Web Audio obeys the silent switch unless the page asks for a
  // "playback" audio session (Safari 17+) — asked only while ringing, then put back.
  useEffect(() => {
    if (live) return;
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    const prevSession = nav.audioSession?.type;
    try { if (nav.audioSession) nav.audioSession.type = 'playback'; } catch { /* not supported */ }
    const ring = () => {
      sfx('ring');
      try { navigator.vibrate?.([450, 170, 450]); } catch { /* not supported */ }
    };
    ring();
    const t = setInterval(ring, 2400);
    return () => {
      clearInterval(t);
      try { navigator.vibrate?.(0); } catch { /* not supported */ }
      try { if (nav.audioSession && prevSession) nav.audioSession.type = prevSession; } catch { /* not supported */ }
    };
  }, [live, sfx]);

  // The placeholder's clock (a clip drives `elapsed` itself, via onTimeUpdate); it hangs up by itself.
  useEffect(() => {
    if (!live || url) return;
    const start = Date.now();
    const t = setInterval(() => setElapsed(Date.now() - start), 250);
    const end = setTimeout(() => endRef.current(), PLACEHOLDER_MS);
    return () => { clearInterval(t); clearTimeout(end); };
  }, [live, url]);

  const answer = () => {
    // No sound on "ענו" (Rani 24.11.2026): the ring stops and the call simply opens.
    setLive(true);
    // Inside the tap: the browser allows sound now.
    requestAnimationFrame(() => { void video.current?.play().catch(() => {}); });
  };

  return (
    <div dir="rtl" role="dialog" aria-modal="true" aria-label={`שיחת וידאו מ${NAME}`} className="absolute inset-0 z-50 overflow-hidden"
      style={{ background: live ? '#000' : 'radial-gradient(120% 80% at 50% 20%, #2B1D5C, #070A22 70%)' }}>
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
            // No clip yet: a black screen in the call frame (Rani 23.11.2026), until the real clip arrives.
            <div className="absolute inset-0 bg-black" aria-label={topic} />
          )}
          {/* the call bar */}
          <div className="absolute inset-x-0 top-0 flex items-center justify-between px-5 pb-6 pt-4"
            style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,.6), rgba(0,0,0,0))', paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
            <div className="flex items-center gap-2">
              <span className="tcm-dot h-2.5 w-2.5 rounded-full" style={{ background: '#FF4D5E' }} aria-hidden />
              <span className="text-lg font-bold text-white" style={{ textShadow: '0 1px 6px rgba(0,0,0,.6)' }}>{NAME}</span>
            </div>
            <span className="tc-num text-base text-white/85" aria-label="משך השיחה">{fmt(secs)}</span>
          </div>
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
