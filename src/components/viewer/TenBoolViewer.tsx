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

// Hard-cut strobes timed to the sounds: fail = 1.2s, success = 3.45s, beep = 0.18s.
// steps() so colours snap like stage lights instead of fading.
const TENBOOL_STYLE = `
@keyframes tenbool-lose { 0% { background:#ff0000 } 50% { background:#000 } }
@keyframes tenbool-win { 0% { background:#00c853 } 33% { background:#ffd400 } 66% { background:#0050ff } }
@keyframes tenbool-pop { 0% { transform:scale(.6) } 40% { transform:scale(1.25) } 70% { transform:scale(.95) } 100% { transform:scale(1) } }
@keyframes tenbool-bounce { 0%,100% { transform:translateY(0) scale(1) } 50% { transform:translateY(-3vh) scale(1.08) } }
@keyframes tenbool-breathe { 0%,100% { opacity:.45 } 50% { opacity:1 } }
@keyframes tenbool-flash { 0% { opacity:.55 } 100% { opacity:0 } }
.tenbool-lose { animation: tenbool-lose .1s steps(1) 12 }
.tenbool-win { animation: tenbool-win .345s steps(1) 10 }
.tenbool-win .tenbool-timer { animation: tenbool-pop .5s cubic-bezier(.2,1.6,.4,1) both; text-shadow: 0 .8vmin 0 rgba(0,0,0,.45), 0 0 4vmin rgba(255,255,255,.9) }
.tenbool-win .tenbool-hint { text-shadow: 0 .6vmin 0 rgba(0,0,0,.45) }
.tenbool-win .tenbool-hint { animation: tenbool-bounce .345s ease-in-out 10 }
.tenbool-idle-hint { animation: tenbool-breathe 1.6s ease-in-out infinite }
.tenbool-beep { animation: tenbool-flash .18s ease-out }
@media (prefers-reduced-motion: reduce) {
  .tenbool-lose, .tenbool-win, .tenbool-timer, .tenbool-hint, .tenbool-idle-hint, .tenbool-beep { animation: none !important }
  .tenbool-lose { background:#a00000 } .tenbool-win { background:#00a83a }
}
`;

export default function TenBoolViewer({ title }: { title?: string }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<{ ms: number; diff: number } | null>(null);

  const timerRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
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

  // Sounds still playing, so a press can cut them (the start sound is longer than a quick game)
  const playingRef = useRef(new Set<AudioBufferSourceNode>());

  const stopAll = useCallback(() => {
    playingRef.current.forEach((src) => {
      try {
        src.stop();
      } catch {
        // already ended
      }
    });
    playingRef.current.clear();
  }, []);

  const play = useCallback((name: SoundName, rate = 1) => {
    const audio = audioRef.current;
    const buffer = audio?.buffers[name];
    if (!audio || !buffer) return;
    const src = audio.ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    src.connect(audio.ctx.destination);
    playingRef.current.add(src);
    src.onended = () => playingRef.current.delete(src);
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
      stopAll();
      play(diff === 0 ? 'success' : 'fail');
      setResult({ ms, diff });
      setPhase('ended');
    },
    [play, stopAll]
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
        // A red flash on every beep - restart the CSS animation by re-adding the class
        const flash = flashRef.current;
        if (flash) {
          flash.classList.remove('tenbool-beep');
          void flash.offsetWidth;
          flash.classList.add('tenbool-beep');
        }
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
        stopAll();
        play('start');
        startAtRef.current = performance.now();
        rafRef.current = requestAnimationFrame(tick);
      } else if (current === 'running') {
        finish(pressAt);
      } else if (performance.now() - endedAtRef.current > RESET_LOCK_MS) {
        stopAll();
        phaseRef.current = 'idle';
        setResult(null);
        setPhase('idle');
        setTimerText(0, false);
      }
    },
    [finish, play, stopAll, tick]
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
      ? 'תנו בבאזר או געו במסך כדי להתחיל'
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
      className={`h-screen w-full relative flex flex-col items-center justify-center gap-[2vh] bg-black text-white select-none overflow-hidden cursor-pointer ${
        phase === 'ended' ? (win ? 'tenbool-win' : 'tenbool-lose') : ''
      }`}
      style={{ fontFamily: 'var(--font-assistant), system-ui, sans-serif', touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
    >
      <style>{TENBOOL_STYLE}</style>
      <div ref={flashRef} className="pointer-events-none absolute inset-0 bg-red-600 opacity-0" />
      {title && phase === 'idle' && <div className="text-[5vmin] font-bold opacity-80">{title}</div>}
      <div
        ref={timerRef}
        dir="ltr"
        className="tenbool-timer font-black leading-none tabular-nums text-[min(22vw,40vh)]"
      >
        00.00
      </div>
      <div
        className={`tenbool-hint font-black min-h-[1.2em] text-center px-4 ${
          phase === 'idle' ? 'tenbool-idle-hint text-[5vmin]' : phase === 'ended' ? (win ? 'text-[12vmin]' : 'text-[7vmin]') : ''
        }`}
      >
        {hint}
      </div>
      {/* New tab, and kept off the game's tap target, so a stray touch never ends a round */}
      <a
        href="/"
        target="_blank"
        rel="noopener noreferrer"
        dir="ltr"
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute bottom-3 inset-x-0 mx-auto w-fit text-[12px] text-white/35 hover:text-white/70 transition-colors"
      >
        Powered by <span className="font-bold">Playzone</span>
      </a>
    </div>
  );
}
