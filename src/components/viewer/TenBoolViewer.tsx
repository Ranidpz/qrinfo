'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  TENBOOL_DEFAULTS,
  resolveTenBoolSoundUrl,
  TENBOOL_LIVES,
  tenboolEffects,
  tenboolPlaybackRate,
  tenboolFont,
  tenboolFontStylesheet,
  type TenBoolBoard,
  type TenBoolConfig,
  type TenBoolSoundSlot,
} from '@/types/tenbool';

// "10 בול": start the timer, then stop it at exactly 10.00.
// Enter (keyboard / a USB button mapped to Enter) on a big screen, a tap anywhere on a phone.
// Everything the game needs is loaded on mount, so it keeps working if the network drops.

const TARGET_MS = 10000;
const WARN_FROM_S = 7; // red digits + a beep every second from here
const AUTO_STOP_MS = 20000; // nobody pressed - count it as a miss
const RESET_LOCK_MS = 1200; // a double press right after the result must not reset it
const WIN_FX_MS = 3450; // length of the win strobe / success sound - board changes wait for it
const LOSE_FX_MS = 1200; // length of the miss strobe / fail sound
const SWIPE_MODES: TenBoolBoard[] = ['wins', 'counter', 'lives'];
const SWIPE_MIN_PX = 60;

type SoundName = TenBoolSoundSlot;
const SOUND_SLOTS: SoundName[] = ['start', 'beep', 'ten', 'success', 'fail'];

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
@keyframes tenbool-lose { 0% { background:var(--tb-lose) } 50% { background:#000 } }
@keyframes tenbool-win { 0% { background:#00c853 } 33% { background:#ffd400 } 66% { background:#0050ff } }
@keyframes tenbool-pop { 0% { transform:scale(.6) } 40% { transform:scale(1.25) } 70% { transform:scale(.95) } 100% { transform:scale(1) } }
@keyframes tenbool-bounce { 0%,100% { transform:translateY(0) scale(1) } 50% { transform:translateY(-3vh) scale(1.08) } }
@keyframes tenbool-breathe { 0%,100% { opacity:.45 } 50% { opacity:1 } }
@keyframes tenbool-flash { 0% { opacity:.55 } 100% { opacity:0 } }
@keyframes tenbool-dot-in { 0% { transform:scale(0) } 55% { transform:scale(1.6) } 75% { transform:scale(.85) } 100% { transform:scale(1) } }
.tenbool-lose-bg { animation: tenbool-lose .1s steps(1) 12 }
.tenbool-win-bg { animation: tenbool-win .345s steps(1) 10 }
.tenbool-win .tenbool-timer { animation: tenbool-pop .5s cubic-bezier(.2,1.6,.4,1) both; text-shadow: 0 .8vmin 0 rgba(0,0,0,.45), 0 0 4vmin rgba(255,255,255,.9) }
.tenbool-win .tenbool-hint { text-shadow: 0 .6vmin 0 rgba(0,0,0,.45) }
.tenbool-win .tenbool-hint { animation: tenbool-bounce .345s ease-in-out 10 }
.tenbool-idle-hint { animation: tenbool-breathe 1.6s ease-in-out infinite }
.tenbool-beep { animation: tenbool-flash .18s ease-out }
.tenbool-dot { width:max(10px,2.4vmin); height:max(10px,2.4vmin); border-radius:9999px; background:#22c55e; box-shadow:0 0 0 max(1px,.25vmin) rgba(0,0,0,.25) }
/* The new dot waits out the 3.45s win strobe, then bounces in */
.tenbool-dot-new { animation: tenbool-dot-in .55s cubic-bezier(.2,1.4,.4,1) 3.45s both }
.tenbool-gold { background:#f5b301 }
/* Lives: a ring per life; the dot inside falls out on a miss and the whole row rebuilds for the next player */
.tenbool-slot { position:relative; width:max(10px,2.4vmin); height:max(10px,2.4vmin); border-radius:9999px; box-shadow:inset 0 0 0 max(1.5px,.3vmin) rgba(255,255,255,.35) }
.tenbool-life { position:absolute; inset:0; border-radius:9999px; background:#22c55e }
@keyframes tenbool-fall { 0% { transform:none; opacity:1 } 100% { transform:translateY(5vmin) scale(.4); opacity:0 } }
.tenbool-fall { animation: tenbool-fall .7s cubic-bezier(.5,0,.9,.4) .25s both }
@keyframes tenbool-out { 0%,100% { box-shadow:inset 0 0 0 max(1.5px,.3vmin) rgba(255,255,255,.35) } 50% { box-shadow:inset 0 0 0 max(2px,.45vmin) #ff2b2b } }
.tenbool-out .tenbool-slot { animation: tenbool-out .3s steps(1) 3 }
.tenbool-life-in { animation: tenbool-dot-in .55s cubic-bezier(.2,1.4,.4,1) both }
/* Counter: the number pops on every change; a "+1" floats up off it on a miss */
@keyframes tenbool-count-pop { 0% { transform:scale(1.6) } 100% { transform:scale(1) } }
.tenbool-count { display:inline-block; animation: tenbool-count-pop .25s ease-out }
@keyframes tenbool-plus { 0% { transform:translateY(0); opacity:0 } 15% { opacity:1 } 100% { transform:translateY(-5vmin); opacity:0 } }
.tenbool-plus { position:absolute; left:100%; top:0; margin-left:.35em; font-size:.75em; animation: tenbool-plus .9s ease-out both }
/* Closeness bar: where this stop landed relative to 10.00 */
@keyframes tenbool-land { 0% { transform:translate(-50%,-4vmin); opacity:0 } 60% { transform:translate(-50%,.4vmin); opacity:1 } 100% { transform:translate(-50%,0); opacity:1 } }
.tenbool-land { animation: tenbool-land .45s cubic-bezier(.3,1.3,.5,1) both }
@media (prefers-reduced-motion: reduce) {
  .tenbool-lose-bg, .tenbool-win-bg, .tenbool-timer, .tenbool-hint, .tenbool-idle-hint, .tenbool-beep, .tenbool-dot-new, .tenbool-slot, .tenbool-life-in, .tenbool-count, .tenbool-land { animation: none !important }
  .tenbool-fall { animation: none !important; opacity:0 } .tenbool-plus { display:none }
  .tenbool-lose-bg { background:var(--tb-lose) !important } .tenbool-win-bg { background:#00a83a !important }
}
`;

export default function TenBoolViewer({ title, config }: { title?: string; config?: TenBoolConfig }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<{ ms: number; diff: number } | null>(null);

  // Scoreboard - all in memory, so a refresh starts a fresh board.
  // wins: a dot per exact 10.00 (green, or gold in lives mode).
  const [wins, setWins] = useState(0);
  // counter mode: misses since the last hit; missTick re-keys the floating "+1".
  const [misses, setMisses] = useState(0);
  const [missTick, setMissTick] = useState(0);
  // lives mode: livesGen re-keys the row so a new player's lives bounce back in.
  const [livesLeft, setLivesLeft] = useState(TENBOOL_LIVES.default);
  const [livesGen, setLivesGen] = useState(0);
  const [livesOut, setLivesOut] = useState(false);
  const [endedAt, setEndedAt] = useState(0);
  const missesRef = useRef(0);
  missesRef.current = misses;
  const livesLeftRef = useRef(livesLeft);
  livesLeftRef.current = livesLeft;
  // A player's turn is over (hit, or out of lives): presses are ignored until the board rebuilds itself
  const turnOverRef = useRef(false);
  const timersRef = useRef<number[]>([]);
  const later = useCallback((fn: () => void, ms: number) => {
    timersRef.current.push(window.setTimeout(fn, ms));
  }, []);
  useEffect(() => () => timersRef.current.forEach((t) => clearTimeout(t)), []);

  const timerRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const phaseRef = useRef<Phase>('idle');
  const startAtRef = useRef(0);
  const endedAtRef = useRef(0);
  const lastBeepRef = useRef(0);
  const rafRef = useRef(0);

  // Web Audio: decoded once into memory - no network after load, and no <audio> start latency.
  const audioRef = useRef<{ ctx: AudioContext; buffers: Partial<Record<SoundName, AudioBuffer>> } | null>(null);

  // Owner-chosen sounds (or silence). Joined into one string so the effect only re-runs when a url changes.
  const soundUrls = useMemo(
    () => SOUND_SLOTS.map((slot) => resolveTenBoolSoundUrl(config, slot) ?? ''),
    [config]
  );
  const soundKey = soundUrls.join('|');

  const font = tenboolFont(config);
  const textColor = config?.textColor || TENBOOL_DEFAULTS.textColor;
  const textColorRef = useRef(textColor);
  textColorRef.current = textColor;
  // Staff can flip the board mode on the screen itself (swipe / arrow keys, only between rounds).
  // Local to this screen and never saved - a refresh returns to the editor's choice.
  const [boardOverride, setBoardOverride] = useState<TenBoolBoard | null>(null);
  const baseFx = tenboolEffects(config);
  const fx = { ...baseFx, board: boardOverride ?? baseFx.board };
  const warningRef = useRef(fx.warningCues);
  warningRef.current = fx.warningCues;
  const boardRef = useRef(fx.board);
  boardRef.current = fx.board;
  const livesTotalRef = useRef(fx.lives);
  livesTotalRef.current = fx.lives;
  // Editor changed the mode or the number of lives - start a full set
  useEffect(() => {
    setLivesLeft(fx.lives);
    setLivesGen((g) => g + 1);
  }, [fx.lives, fx.board]);
  const tenRateRef = useRef(1);
  tenRateRef.current = tenboolPlaybackRate(config, 'ten');

  useEffect(() => {
    const urls = soundKey.split('|');
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const audio = { ctx, buffers: {} as Partial<Record<SoundName, AudioBuffer>> };
    audioRef.current = audio;
    SOUND_SLOTS.forEach(async (name, i) => {
      if (!urls[i]) return; // silent slot
      try {
        const res = await fetch(urls[i]);
        audio.buffers[name] = await ctx.decodeAudioData(await res.arrayBuffer());
      } catch {
        // A missing sound must never break the game
      }
    });
    return () => {
      ctx.close().catch(() => {});
    };
  }, [soundKey]);

  // Assistant ships with the app; any other choice is fetched once with the page, so play stays offline-safe
  useEffect(() => {
    if (font.id === 'assistant') return;
    const href = tenboolFontStylesheet(font.family);
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }, [font.id, font.family]);

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
    el.style.color = warn ? '#ff2b2b' : textColorRef.current;
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
      setEndedAt(endedAtRef.current);
      const win = diff === 0;
      if (win) setWins((w) => w + 1);

      const board = boardRef.current;
      if (board === 'counter') {
        if (win) {
          // After the strobe the number spins down to 0, like a slot machine
          later(() => {
            let n = missesRef.current;
            if (n <= 0) return;
            const stepMs = Math.max(30, Math.min(90, 900 / n));
            const id = window.setInterval(() => {
              n -= 1;
              setMisses(Math.max(0, n));
              if (n <= 0) clearInterval(id);
            }, stepMs);
            timersRef.current.push(id);
          }, WIN_FX_MS);
        } else {
          setMisses((m) => m + 1);
          setMissTick((t) => t + 1);
        }
      } else if (board === 'lives') {
        const left = win ? livesLeftRef.current : livesLeftRef.current - 1;
        if (!win) setLivesLeft(left);
        if (win || left <= 0) {
          // Turn over: no touch needed - the board rebuilds itself for the next player
          turnOverRef.current = true;
          const fxMs = win ? WIN_FX_MS : LOSE_FX_MS;
          if (!win) later(() => setLivesOut(true), fxMs);
          later(() => {
            setLivesOut(false);
            setLivesLeft(livesTotalRef.current);
            setLivesGen((g) => g + 1);
            stopAll();
            phaseRef.current = 'idle';
            setResult(null);
            setPhase('idle');
            setTimerText(0, false);
            turnOverRef.current = false;
          }, fxMs + (win ? 400 : 900));
        }
      }
    },
    [later, play, stopAll]
  );

  const tick = useCallback(
    (now: number) => {
      const ms = now - startAtRef.current;
      if (ms >= AUTO_STOP_MS) {
        finish(startAtRef.current + AUTO_STOP_MS);
        return;
      }
      const sec = Math.floor(ms / 1000);
      setTimerText(ms, warningRef.current && sec >= WARN_FROM_S);
      // One beep per whole second: 7, 8, 9 and a higher one at 10 (owner can switch all hints off)
      if (warningRef.current && sec >= WARN_FROM_S && sec <= TARGET_MS / 1000 && sec > lastBeepRef.current) {
        lastBeepRef.current = sec;
        if (sec * 1000 === TARGET_MS) play('ten', tenRateRef.current);
        else play('beep');
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
      if (turnOverRef.current) return; // the board is rebuilding for the next player
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

  const cycleBoard = useCallback((step: 1 | -1) => {
    if (phaseRef.current !== 'idle' || turnOverRef.current) return;
    const i = SWIPE_MODES.indexOf(boardRef.current);
    const next = SWIPE_MODES[(Math.max(0, i) + step + SWIPE_MODES.length) % SWIPE_MODES.length];
    setBoardOverride(next);
    setMisses(0);
  }, []);

  // In idle a touch starts the round on release, so a swipe can change the mode instead.
  // A running round still stops on pointerdown - the stop is the timed moment.
  const touchStartRef = useRef<{ x: number; y: number; id: number } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        cycleBoard(e.key === 'ArrowLeft' ? 1 : -1);
        return;
      }
      if (e.key !== 'Enter' || e.repeat) return; // holding the key down does not count
      e.preventDefault();
      press(e.timeStamp);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      cancelAnimationFrame(rafRef.current);
    };
  }, [press, cycleBoard]);

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
        if (phaseRef.current === 'idle') {
          touchStartRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
          return;
        }
        press(e.timeStamp);
      }}
      onPointerUp={(e) => {
        const start = touchStartRef.current;
        touchStartRef.current = null;
        if (!start || start.id !== e.pointerId || phaseRef.current !== 'idle') return;
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        if (Math.abs(dx) >= SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy) * 1.5) cycleBoard(dx < 0 ? 1 : -1);
        else press(e.timeStamp);
      }}
      onPointerCancel={() => {
        touchStartRef.current = null;
      }}
      className={`fixed inset-0 flex flex-col items-center justify-center gap-[2vh] select-none overflow-hidden cursor-pointer ${
        phase === 'ended'
          ? win
            ? `tenbool-win ${fx.winFlash ? 'tenbool-win-bg' : ''}`
            : fx.loseFlash
              ? 'tenbool-lose-bg'
              : ''
          : ''
      }`}
      style={{
        fontFamily: `'${font.family}', var(--font-assistant), system-ui, sans-serif`,
        color: textColor,
        backgroundColor: config?.backgroundColor || TENBOOL_DEFAULTS.backgroundColor,
        backgroundImage: config?.backgroundImageUrl ? `url("${config.backgroundImageUrl}")` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        ['--tb-lose' as string]: fx.loseColor,
        // The game owns every gesture (taps + mode swipes); nothing scrolls here
        touchAction: 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <style>{TENBOOL_STYLE}</style>
      <div ref={flashRef} className="pointer-events-none absolute inset-0 bg-red-600 opacity-0" />
      {fx.board !== 'off' && wins > 0 && (
        <div
          dir="rtl"
          aria-label={`${wins} הצלחות`}
          className="pointer-events-none absolute top-[max(0.75rem,3vmin)] right-[max(0.75rem,3vmin)] max-w-[45vw] flex flex-wrap gap-[max(6px,1.2vmin)]"
        >
          {Array.from({ length: wins }, (_, i) => (
            <span key={i} className={`tenbool-dot tenbool-dot-new ${fx.board === 'lives' ? 'tenbool-gold' : ''}`} />
          ))}
        </div>
      )}
      {fx.board === 'counter' && (
        <div
          dir="ltr"
          aria-label={`${misses} ניסיונות`}
          className="pointer-events-none absolute top-[max(0.5rem,2.2vmin)] left-[max(0.75rem,3vmin)] font-black leading-none tabular-nums text-[max(18px,3.4vmin)]"
        >
          <span className="relative">
            <span key={`n${misses}`} className="tenbool-count">
              {misses}
            </span>
            {missTick > 0 && (
              <span key={`p${missTick}`} className="tenbool-plus">
                +1
              </span>
            )}
          </span>
        </div>
      )}
      {fx.board === 'lives' && (
        <div
          key={livesGen}
          dir="ltr"
          aria-label={`${livesLeft} חיים`}
          className={`pointer-events-none absolute top-[max(0.75rem,3vmin)] left-[max(0.75rem,3vmin)] flex gap-[max(6px,1.2vmin)] ${livesOut ? 'tenbool-out' : ''}`}
        >
          {Array.from({ length: fx.lives }, (_, i) => (
            <span key={i} className="tenbool-slot">
              {/* Lives are lost from the right end of the row */}
              <span
                className={`tenbool-life tenbool-life-in ${i >= livesLeft ? 'tenbool-fall' : ''}`}
                style={i >= livesLeft ? undefined : { animationDelay: `${i * 120}ms` }}
              />
            </span>
          ))}
        </div>
      )}
      {config?.logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={config.logoUrl}
          alt=""
          draggable={false}
          className="pointer-events-none object-contain max-w-[80vw]"
          style={{ height: `${fx.logoSize}vh` }}
        />
      )}
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
      {fx.closenessBar && (
        // ±1.00s maps to the bar ends; anything further sits at the edge
        <div dir="ltr" className="pointer-events-none relative w-[min(60vw,720px)] h-[4vmin]" aria-hidden="true">
          <span className="absolute left-0 right-0 top-1/2 h-[max(2px,.35vmin)] -translate-y-1/2 rounded-full opacity-30" style={{ background: textColor }} />
          <span className="absolute left-1/2 top-0 bottom-0 w-[max(2px,.4vmin)] -translate-x-1/2 rounded-full opacity-70" style={{ background: textColor }} />
          {phase === 'ended' && result && (
            <span
              key={endedAt}
              className="tenbool-land absolute top-1/2 -mt-[max(6px,1.2vmin)] h-[max(12px,2.4vmin)] w-[max(12px,2.4vmin)] rounded-full"
              style={{
                left: `${50 + Math.max(-1, Math.min(1, result.diff / 100)) * 50}%`,
                background: result.diff === 0 ? '#22c55e' : textColor,
              }}
            />
          )}
        </div>
      )}
      {/* New tab, and kept off the game's tap target, so a stray touch never ends a round */}
      <a
        href="/"
        target="_blank"
        rel="noopener noreferrer"
        dir="ltr"
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] inset-x-0 mx-auto w-fit text-[12px] opacity-40 hover:opacity-80 transition-opacity"
      >
        Powered by <span className="font-bold">Playzone</span>
      </a>
    </div>
  );
}
