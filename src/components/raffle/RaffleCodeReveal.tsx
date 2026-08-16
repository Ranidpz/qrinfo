'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type {
  RaffleConfig,
  RaffleDisplayMode,
  RaffleParticipant,
  RaffleWinner,
} from '@/lib/raffle/types';
import {
  participantLabel,
  resolveWinSoundUrl,
  RAFFLE_BUZZER_SOUND,
  CODE_LOCK_MS_DEFAULT,
  CODE_LOCK_MS_MIN,
  CODE_LOCK_MS_MAX,
} from '@/lib/raffle/types';
import { CodeRevealAudio } from '@/lib/raffle/codeAudio';

// "Code reveal" raffle animation — an alternative to the spinning wheel, built
// for codes rather than names: every character scrambles, then locks one by one
// from left to right until the winning code stands complete.
//
// Same contract as RaffleDisplay (identical props, same onRequestDraw callback)
// so the two are interchangeable.
//
// Event-safety notes (this runs on a big screen in front of an audience):
//   * The draw fires on the FIRST frame of the click and runs in parallel with
//     the scramble — the animation never waits on the network to look alive.
//   * Locking only begins once the winner is in hand. A slow server just means
//     a longer scramble, never a frozen screen.
//   * A failed draw returns cleanly to idle. It is never retried automatically:
//     a lost response after a committed transaction would burn a second winner.
//   * Nothing re-renders per frame — 9 text nodes are written directly.
//   * The character pools are snapshotted when the run starts, so a mid-run
//     participant refetch can't disturb what's on screen.

type Phase = 'idle' | 'scrambling' | 'locking' | 'won';

const SCRAMBLE_MS = 55; // how often the unlocked characters re-roll
const TICK_MS = 75; // ticking cadence while characters are running
const MIN_SCRAMBLE_MS = 1600; // guaranteed scramble before the first lock
const RUSH_MS = 120; // per-character pace when the operator cuts it short
const MAX_CELLS = 24;
const POOL_SAMPLE = 800; // labels sampled to build the per-position pools
const FALLBACK_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
const IDLE_CHAR = '-'; // the placeholder shown per position before the run

// Pace schedule: brisk at the start, deliberately slow on the last two
// characters. A flat pace reads as a progress bar; this reads as suspense.
function paceFor(index: number, total: number, base: number): number {
  const left = total - 1 - index;
  if (left <= 0) return base * 1.9;
  if (left === 1) return base * 1.45;
  const span = Math.max(1, total - 3);
  return base * (0.7 + 0.35 * Math.min(1, index / span));
}

// Distinct characters seen at each position across the loaded codes, so the
// scramble only ever shows characters that genuinely exist there.
function buildPools(labels: string[], width: number): string[][] {
  const sets: Set<string>[] = Array.from({ length: width }, () => new Set<string>());
  const all = new Set<string>();
  for (const label of labels) {
    for (let i = 0; i < width && i < label.length; i++) {
      const ch = label[i];
      if (ch === ' ') continue;
      sets[i].add(ch);
      all.add(ch);
    }
  }
  const global = all.size >= 4 ? Array.from(all) : FALLBACK_CHARS.split('');
  return sets.map((s) => (s.size >= 2 ? Array.from(s) : global));
}

export default function RaffleCodeReveal({
  participants,
  config,
  onRequestDraw,
  canShowPhones = true,
  loading = false,
}: {
  participants: RaffleParticipant[];
  config: RaffleConfig;
  onRequestDraw: () => RaffleWinner | null | Promise<RaffleWinner | null>;
  canShowPhones?: boolean;
  loading?: boolean;
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [fontPx, setFontPx] = useState(120);

  const mode: RaffleDisplayMode =
    config.displayMode === 'phones' && canShowPhones ? 'phones' : 'names';

  const configRef = useRef(config);
  configRef.current = config;

  const pool = useMemo(() => participants.filter((p) => p.remaining > 0), [participants]);
  const hasPool = pool.length > 0;

  // Labels of the eligible rows — the codes themselves. Sampled, because only
  // the character variety matters, not the full list.
  const labels = useMemo(
    () =>
      pool
        .slice(0, POOL_SAMPLE)
        .map((p) => participantLabel(p, mode))
        .filter(Boolean),
    [pool, mode]
  );

  // Most common code length → the width of the idle row and of the scramble
  // before the winner is known.
  const commonWidth = useMemo(() => {
    if (labels.length === 0) return 9;
    const counts = new Map<number, number>();
    for (const l of labels) counts.set(l.length, (counts.get(l.length) || 0) + 1);
    let best = 9;
    let bestCount = -1;
    for (const [len, c] of counts) {
      if (c > bestCount) {
        best = len;
        bestCount = c;
      }
    }
    return Math.max(1, Math.min(MAX_CELLS, best));
  }, [labels]);

  const [width, setWidth] = useState(commonWidth);
  // While idle, follow the loaded data. Never resize mid-run except when the
  // winner's own code turns out to be a different length.
  useEffect(() => {
    if (phase === 'idle') setWidth(commonWidth);
  }, [commonWidth, phase]);

  const poolsRef = useRef<string[][]>([]);
  const cellRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const phaseRef = useRef<Phase>('idle');
  const codeRef = useRef<string>('');
  const winnerRef = useRef<RaffleWinner | null>(null);
  const lockedRef = useRef(0);
  const widthRef = useRef(commonWidth);
  widthRef.current = width;

  const rafRef = useRef<number | null>(null);
  const nextLockAtRef = useRef(0);
  const lastScrambleRef = useRef(0);
  const lastTickRef = useRef(0);
  const hiddenAtRef = useRef(0);
  const rushRef = useRef(false);
  const drawPendingRef = useRef(false);
  const runIdRef = useRef(0); // invalidates an in-flight draw after a reset

  const audioRef = useRef<CodeRevealAudio | null>(null);
  const winAudioRef = useRef<HTMLAudioElement | null>(null);
  const buzzerAudioRef = useRef<HTMLAudioElement | null>(null);

  const setPhaseBoth = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  useEffect(() => {
    if (typeof Audio === 'undefined') return;
    audioRef.current = new CodeRevealAudio();
    const buzz = new Audio(RAFFLE_BUZZER_SOUND);
    buzz.preload = 'auto';
    buzzerAudioRef.current = buzz;
    winAudioRef.current = new Audio();
    return () => {
      audioRef.current?.close();
      buzz.pause();
      winAudioRef.current?.pause();
    };
  }, []);

  const playFile = useCallback((a: HTMLAudioElement | null, src?: string) => {
    if (!a || !configRef.current.soundsEnabled) return;
    try {
      if (src && a.src !== new URL(src, window.location.href).href) a.src = src;
      a.currentTime = 0;
    } catch {
      /* ignore */
    }
    a.play().catch(() => {});
  }, []);

  const tickEnabled = useCallback(
    () => configRef.current.soundsEnabled && configRef.current.codeTickSounds !== false,
    []
  );

  // ---- layout ----
  const measure = useCallback(() => {
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    const n = Math.max(1, widthRef.current);
    // each cell occupies ~0.82em (0.68 glyph box + 0.14 gap)
    const px = Math.max(24, Math.min((vw * 0.92) / (n * 0.82), vh * 0.3, 240));
    setFontPx((prev) => (Math.abs(prev - px) > 0.5 ? px : prev));
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure, width]);

  // ---- painting (direct DOM writes, no React re-render per frame) ----
  const paintIdle = useCallback(() => {
    const { fontColor } = configRef.current;
    cellRefs.current.forEach((el) => {
      if (!el) return;
      el.textContent = IDLE_CHAR;
      el.style.color = fontColor;
      el.style.opacity = '0.28';
      el.style.textShadow = 'none';
      el.style.transform = 'scale(1)';
    });
  }, []);

  const scramble = useCallback(() => {
    const { fontColor } = configRef.current;
    const pools = poolsRef.current;
    for (let i = lockedRef.current; i < widthRef.current; i++) {
      const el = cellRefs.current[i];
      if (!el) continue;
      const p = pools[i] && pools[i].length ? pools[i] : FALLBACK_CHARS.split('');
      el.textContent = p[(Math.random() * p.length) | 0];
      el.style.color = fontColor;
      el.style.opacity = '0.6';
      el.style.textShadow = 'none';
    }
  }, []);

  const stopRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const finish = useCallback(() => {
    stopRaf();
    setPhaseBoth('won');
    playFile(winAudioRef.current, resolveWinSoundUrl(configRef.current));
  }, [stopRaf, setPhaseBoth, playFile]);

  const lockNext = useCallback(() => {
    const code = codeRef.current;
    const n = widthRef.current;
    const i = lockedRef.current;
    if (i >= n) return;
    lockedRef.current = i + 1;

    const el = cellRefs.current[i];
    const { winnerColor } = configRef.current;
    if (el) {
      el.textContent = code[i] ?? IDLE_CHAR;
      el.style.color = winnerColor;
      el.style.opacity = '1';
      el.style.textShadow = `0 0 ${Math.round(fontPx * 0.22)}px ${winnerColor}66`;
      el.style.transform = 'scale(1.16)';
      window.setTimeout(() => {
        if (el) el.style.transform = 'scale(1)';
      }, 140);
    }
    if (tickEnabled()) audioRef.current?.pop(n > 1 ? i / (n - 1) : 1);

    if (lockedRef.current >= n) {
      finish();
      return;
    }
    const base = Math.min(
      CODE_LOCK_MS_MAX,
      Math.max(CODE_LOCK_MS_MIN, configRef.current.codeLockMs ?? CODE_LOCK_MS_DEFAULT)
    );
    nextLockAtRef.current =
      performance.now() + (rushRef.current ? RUSH_MS : paceFor(lockedRef.current, n, base));
  }, [finish, tickEnabled, fontPx]);

  const frame = useCallback(
    (ts: number) => {
      if (ts - lastScrambleRef.current >= SCRAMBLE_MS) {
        scramble();
        lastScrambleRef.current = ts;
      }
      if (lockedRef.current < widthRef.current && ts - lastTickRef.current >= TICK_MS && tickEnabled()) {
        audioRef.current?.tick();
        lastTickRef.current = ts;
      }
      // The winner may still be in flight — the scramble simply continues, and
      // the first lock fires the instant it lands.
      if (ts >= nextLockAtRef.current && winnerRef.current) {
        if (phaseRef.current === 'scrambling') setPhaseBoth('locking');
        lockNext();
        if (phaseRef.current === 'won') return;
      }
      rafRef.current = requestAnimationFrame(frame);
    },
    [scramble, lockNext, setPhaseBoth, tickEnabled]
  );

  const resetToIdle = useCallback(() => {
    stopRaf();
    lockedRef.current = 0;
    winnerRef.current = null;
    codeRef.current = '';
    rushRef.current = false;
    setPhaseBoth('idle');
    paintIdle();
  }, [stopRaf, setPhaseBoth, paintIdle]);

  const start = useCallback(() => {
    if (!hasPool) return;
    const runId = ++runIdRef.current;

    lockedRef.current = 0;
    winnerRef.current = null;
    codeRef.current = '';
    rushRef.current = false;
    poolsRef.current = buildPools(labels, Math.max(widthRef.current, MAX_CELLS));

    const now = performance.now();
    lastScrambleRef.current = 0;
    lastTickRef.current = 0;
    hiddenAtRef.current = 0;
    nextLockAtRef.current = now + MIN_SCRAMBLE_MS;
    setPhaseBoth('scrambling');

    if (configRef.current.soundsEnabled) audioRef.current?.unlock();

    // Fire the draw NOW, in parallel with the animation.
    if (!drawPendingRef.current) {
      drawPendingRef.current = true;
      Promise.resolve()
        .then(() => onRequestDraw())
        .then((w) => {
          if (runId !== runIdRef.current) return; // reset while in flight
          if (!w) {
            resetToIdle();
            return;
          }
          const label = participantLabel(w, mode).trim();
          const code = label || IDLE_CHAR;
          winnerRef.current = w;
          codeRef.current = code;
          const n = Math.max(1, Math.min(MAX_CELLS, code.length));
          if (n !== widthRef.current) {
            widthRef.current = n;
            setWidth(n);
          }
        })
        .catch(() => {
          if (runId === runIdRef.current) resetToIdle();
        })
        .finally(() => {
          drawPendingRef.current = false;
        });
    }

    stopRaf();
    rafRef.current = requestAnimationFrame(frame);
  }, [hasPool, labels, mode, onRequestDraw, setPhaseBoth, stopRaf, frame, resetToIdle]);

  const toggle = useCallback(() => {
    const p = phaseRef.current;
    if (p === 'idle' || p === 'won') {
      start();
      return;
    }
    // Second press = cut it short, same as the wheel's buzzer.
    if (!rushRef.current) {
      rushRef.current = true;
      playFile(buzzerAudioRef.current);
      if (winnerRef.current) nextLockAtRef.current = performance.now();
    }
  }, [start, playFile]);

  // A hidden tab suspends rAF entirely. Shift the schedule by exactly the time
  // the tab was away, so the reveal resumes at its real pace instead of
  // snapping through every remaining character at once.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = performance.now();
        return;
      }
      if (!hiddenAtRef.current) return;
      const away = performance.now() - hiddenAtRef.current;
      hiddenAtRef.current = 0;
      if (phaseRef.current === 'scrambling' || phaseRef.current === 'locking') {
        nextLockAtRef.current += away;
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  // Drop refs to cells that no longer exist after the row shrinks.
  useEffect(() => {
    cellRefs.current.length = width;
  }, [width]);

  // Repaint the idle row whenever it is (re)mounted or resized.
  useEffect(() => {
    if (phase === 'idle') paintIdle();
  }, [phase, width, paintIdle, config.fontColor]);

  useEffect(() => () => stopRaf(), [stopRaf]);

  const background = useMemo(() => {
    if (config.backgroundType === 'image' && config.backgroundImageUrl) {
      return {
        backgroundImage: `url(${config.backgroundImageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      } as const;
    }
    return { backgroundColor: config.backgroundColor } as const;
  }, [config.backgroundType, config.backgroundColor, config.backgroundImageUrl]);

  const showRow = hasPool && !loading;

  return (
    <div
      dir="rtl"
      onClick={toggle}
      className="relative h-screen w-screen cursor-pointer select-none overflow-hidden"
      style={{ ...background, fontFamily: 'var(--font-assistant), sans-serif' }}
    >
      {config.backgroundType === 'video' && config.backgroundVideoUrl && (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src={config.backgroundVideoUrl}
          autoPlay
          loop
          muted
          playsInline
        />
      )}

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.55) 100%)',
        }}
      />

      <div className="relative z-10 flex h-full flex-col items-center justify-center px-4">
        {loading ? (
          <Loader2
            className="animate-spin"
            size={56}
            style={{ color: config.idleColor || '#C9CED6', opacity: 0.7 }}
          />
        ) : !hasPool ? (
          <div className="text-2xl font-medium" style={{ color: config.fontColor, opacity: 0.5 }}>
            אין משתתפים זמינים
          </div>
        ) : null}

        {showRow && (
          <div
            dir="ltr"
            className="flex items-center justify-center"
            style={{
              gap: `${(fontPx * 0.14).toFixed(1)}px`,
              fontFamily:
                "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
              fontSize: `${Math.round(fontPx)}px`,
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            {Array.from({ length: width }).map((_, i) => (
              <span
                key={i}
                ref={(el) => {
                  cellRefs.current[i] = el;
                }}
                className="inline-flex items-center justify-center will-change-transform"
                style={{
                  width: `${(fontPx * 0.68).toFixed(1)}px`,
                  color: config.fontColor,
                  opacity: 0.28,
                  transition: 'transform 140ms ease-out, color 120ms linear',
                }}
              >
                {IDLE_CHAR}
              </span>
            ))}
          </div>
        )}

        {/* Absolutely placed so the code itself never shifts on the reveal. */}
        {phase === 'won' && (
          <div
            className="raffle-winner-caption font-bold tracking-wide"
            style={{
              position: 'absolute',
              left: '50%',
              top: `calc(50% + ${Math.round(fontPx * 0.75)}px)`,
              transform: 'translateX(-50%)',
              color: config.winnerColor,
              fontSize: 'clamp(1.2rem, 3vw, 2.2rem)',
            }}
          >
            זוכה
          </div>
        )}
      </div>
    </div>
  );
}
