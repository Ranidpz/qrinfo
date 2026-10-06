'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// "10 בול": start the timer, then stop it at exactly 10.00.
// Enter (keyboard / a USB button mapped to Enter) on a big screen, a tap anywhere on a phone.
// Everything the game needs is loaded on mount, so it keeps working if the network drops.

const TARGET_MS = 10000;
const WARN_FROM_S = 7; // red digits + a beep every second from here
const AUTO_STOP_MS = 20000; // nobody pressed - count it as a miss
const RESET_LOCK_MS = 1200; // a double press right after the result must not reset it

const SOUNDS = {
  start: '/sounds/tenbool/start.mp3',
  beep: '/sounds/tenbool/beep.mp3',
  success: '/sounds/tenbool/success.mp3',
  fail: '/sounds/tenbool/fail.mp3',
} as const;
type SoundName = keyof typeof SOUNDS;

type Phase = 'idle' | 'running' | 'ended';

// Truncated to hundredths like a stopwatch, so what is shown is exactly what is judged.
const hundredths = (ms: number) => Math.floor(ms / 10);
function format(ms: number) {
  const h = hundredths(ms);
  return `${String(Math.floor(h / 100)).padStart(2, '0')}.${String(h % 100).padStart(2, '0')}`;
}

const TENBOOL_STYLE = `
@keyframes tenbool-win { 0%,100% { background:#000 } 25%,75% { background:#00a83a } 50% { background:#0050ff } }
@keyframes tenbool-lose { 0%,100% { background:#000 } 50% { background:#d00000 } }
.tenbool-win { animation: tenbool-win 1s linear 2 }
.tenbool-lose { animation: tenbool-lose 1s linear 2 }
@media (prefers-reduced-motion: reduce) { .tenbool-win, .tenbool-lose { animation-duration: 2s; animation-iteration-count: 1 } }
`;

export default function TenBoolViewer({ title }: { title?: string }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<{ ms: number; diff: number } | null>(null);

  const timerRef = useRef<HTMLDivElement>(null);
  const phaseRef = useRef<Phase>('idle');
  const startAtRef = useRef(0);
  const endedAtRef = useRef(0);
  const lastBeepRef = useRef(0);
  const rafRef = useRef(0);

  // Web Audio: decoded once into memory - no network after load, and no <audio> start latency.
  const audioRef = useRef<{ ctx: AudioContext; buffers: Partial<Record<SoundName, AudioBuffer>> } | null>(null);

  useEffect(() => {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const audio = { ctx, buffers: {} as Partial<Record<SoundName, AudioBuffer>> };
    audioRef.current = audio;
    (Object.keys(SOUNDS) as SoundName[]).forEach(async (name) => {
      try {
        const res = await fetch(SOUNDS[name]);
        audio.buffers[name] = await ctx.decodeAudioData(await res.arrayBuffer());
      } catch {
        // A missing sound must never break the game
      }
    });
    return () => {
      ctx.close().catch(() => {});
    };
  }, []);

  const play = useCallback((name: SoundName, rate = 1) => {
    const audio = audioRef.current;
    const buffer = audio?.buffers[name];
    if (!audio || !buffer) return;
    const src = audio.ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    src.connect(audio.ctx.destination);
    src.start();
  }, []);

  const setTimerText = (ms: number, warn: boolean) => {
    const el = timerRef.current;
    if (!el) return;
    el.textContent = format(ms);
    el.style.color = warn ? '#ff2b2b' : '#fff';
  };

  const finish = useCallback(
    (pressAt: number) => {
      cancelAnimationFrame(rafRef.current);
      phaseRef.current = 'ended';
      endedAtRef.current = performance.now();
      const ms = Math.max(0, pressAt - startAtRef.current);
      const diff = hundredths(ms) - hundredths(TARGET_MS);
      setTimerText(ms, false);
      play(diff === 0 ? 'success' : 'fail');
      setResult({ ms, diff });
      setPhase('ended');
    },
    [play]
  );

  const tick = useCallback(
    (now: number) => {
      const ms = now - startAtRef.current;
      if (ms >= AUTO_STOP_MS) {
        finish(startAtRef.current + AUTO_STOP_MS);
        return;
      }
      const sec = Math.floor(ms / 1000);
      setTimerText(ms, sec >= WARN_FROM_S);
      // One beep per whole second: 7, 8, 9 and a higher one at 10
      if (sec >= WARN_FROM_S && sec <= TARGET_MS / 1000 && sec > lastBeepRef.current) {
        lastBeepRef.current = sec;
        play('beep', sec * 1000 === TARGET_MS ? 1.6 : 1);
      }
      rafRef.current = requestAnimationFrame(tick);
    },
    [finish, play]
  );

  // pressAt = the event's own timestamp, not the last painted frame
  const press = useCallback(
    (pressAt: number) => {
      audioRef.current?.ctx.resume().catch(() => {}); // browsers unlock audio only inside a user gesture
      const current = phaseRef.current;
      if (current === 'idle') {
        phaseRef.current = 'running';
        lastBeepRef.current = 0;
        setResult(null);
        setPhase('running');
        play('start');
        startAtRef.current = performance.now();
        rafRef.current = requestAnimationFrame(tick);
      } else if (current === 'running') {
        finish(pressAt);
      } else if (performance.now() - endedAtRef.current > RESET_LOCK_MS) {
        phaseRef.current = 'idle';
        setResult(null);
        setPhase('idle');
        setTimerText(0, false);
      }
    },
    [finish, play, tick]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.repeat) return; // holding the key down does not count
      e.preventDefault();
      press(e.timeStamp);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      cancelAnimationFrame(rafRef.current);
    };
  }, [press]);

  const win = result?.diff === 0;
  const hint =
    phase === 'idle'
      ? 'לחצו Enter או געו במסך כדי להתחיל'
      : phase === 'running'
        ? ''
        : win
          ? 'בול!'
          : `${result!.diff < 0 ? 'מוקדם' : 'מאוחר'} ב-${(Math.abs(result!.diff) / 100).toFixed(2)}`;

  return (
    <div
      dir="rtl"
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        press(e.timeStamp);
      }}
      className={`h-screen w-full flex flex-col items-center justify-center gap-[2vh] bg-black text-white select-none overflow-hidden cursor-pointer ${
        phase === 'ended' ? (win ? 'tenbool-win' : 'tenbool-lose') : ''
      }`}
      style={{ fontFamily: 'var(--font-assistant), system-ui, sans-serif', touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
    >
      <style>{TENBOOL_STYLE}</style>
      {title && phase === 'idle' && <div className="text-[5vmin] font-bold opacity-80">{title}</div>}
      <div
        ref={timerRef}
        dir="ltr"
        className="font-bold leading-none tabular-nums text-[min(22vw,40vh)]"
      >
        00.00
      </div>
      <div className="text-[4vmin] font-bold opacity-70 min-h-[1.2em] text-center px-4">{hint}</div>
    </div>
  );
}
