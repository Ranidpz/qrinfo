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
  RAFFLE_SPIN_SOUND,
  RAFFLE_BUZZER_SOUND,
} from '@/lib/raffle/types';

type Phase = 'idle' | 'spinning' | 'stopping' | 'won';

interface RaffleDisplayProps {
  participants: RaffleParticipant[];
  config: RaffleConfig;
  // Performs the draw (decrement quantity, record winner) and returns the
  // chosen winner, or null if no eligible participants remain. May be async
  // (e.g. a server-side atomic draw) — the reel keeps spinning until it resolves.
  onRequestDraw: () => RaffleWinner | null | Promise<RaffleWinner | null>;
  // Owner-only views may show phones; the public link forces names.
  canShowPhones?: boolean;
  // While the participant list is still being fetched — show a spinner instead
  // of the (premature) "no participants" message.
  loading?: boolean;
}

// --- Wheel tuning -----------------------------------------------------------
const SLOTS = 7; // rendered rows (odd → one is dead-center)
const HALF = (SLOTS - 1) / 2;
const MAX_SPEED = 19; // items per second at full spin
const RAMP_TIME = 0.55; // s to reach full speed
const CRUISE_TIME = 2.0; // s of full-speed spin before it auto-slows
// Two-phase deceleration so the FINISH is suspenseful and readable:
//   brake → quickly shed speed, then a slow "tail" that ticks the last few
//   names by at a readable pace and gently stops.
const TAIL_NAMES = 6; // how many names crawl by readably at the very end
const TAIL_HANDOFF_SPEED = 3.2; // names/sec entering the slow tail

const mod = (n: number, m: number) => ((n % m) + m) % m;

export default function RaffleDisplay({
  participants,
  config,
  onRequestDraw,
  canShowPhones = true,
  loading = false,
}: RaffleDisplayProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [winner, setWinner] = useState<RaffleWinner | null>(null);
  // Center font size in px — kept in state so the winner reveal renders at the
  // EXACT same size/position as the reel center (zero jump on landing).
  const [centerFontPx, setCenterFontPx] = useState(120);

  // Live refs so the rAF loop always sees current props without re-subscribing.
  const participantsRef = useRef(participants);
  const configRef = useRef(config);
  const mode: RaffleDisplayMode =
    config.displayMode === 'phones' && canShowPhones ? 'phones' : 'names';
  const modeRef = useRef<RaffleDisplayMode>(mode);
  participantsRef.current = participants;
  configRef.current = config;
  modeRef.current = mode;

  const phaseRef = useRef<Phase>('idle');
  const posRef = useRef(0); // continuous index into the participant list
  const velRef = useRef(0); // items/sec
  const spinStartRef = useRef(0);
  const decelRef = useRef<{
    start: number;
    from: number;
    to: number;
    t1: number; // brake-phase duration (s)
    t2: number; // slow-tail duration (s)
    v0: number; // entry speed (names/s) — matches the spin for continuity
    v1: number; // hand-off speed into the tail (names/s)
    dBrake: number; // names covered during the brake phase
  } | null>(null);
  const landingIndexRef = useRef<number | null>(null);
  const winnerLabelRef = useRef<string | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef(0);
  const drawPendingRef = useRef(false); // guards re-entry while an async draw resolves

  const reelRef = useRef<HTMLDivElement | null>(null);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const itemHRef = useRef(180);
  const fontPxRef = useRef(120);

  const pool = useMemo(() => participants.filter((p) => p.remaining > 0), [participants]);
  const hasPool = pool.length > 0;

  const setPhaseBoth = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  // Resolve the label shown at a given wheel index. A pinned "landing index"
  // forces the winner to appear at the exact stop position — this lets the
  // wheel travel a short, smooth distance regardless of list size.
  const labelAt = useCallback((idx: number): string => {
    const list = participantsRef.current;
    const L = list.length;
    if (L === 0) return '';
    if (
      landingIndexRef.current !== null &&
      winnerLabelRef.current !== null &&
      idx === landingIndexRef.current
    ) {
      return winnerLabelRef.current;
    }
    return participantLabel(list[mod(idx, L)], modeRef.current);
  }, []);

  // ---- audio ----
  const spinAudioRef = useRef<HTMLAudioElement | null>(null);
  const buzzerAudioRef = useRef<HTMLAudioElement | null>(null);
  const winAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof Audio === 'undefined') return;
    const spin = new Audio(RAFFLE_SPIN_SOUND);
    spin.loop = false; // play once per spin — never loop
    spin.preload = 'auto';
    spinAudioRef.current = spin;
    const buzz = new Audio(RAFFLE_BUZZER_SOUND);
    buzz.preload = 'auto';
    buzzerAudioRef.current = buzz;
    winAudioRef.current = new Audio();
    return () => {
      spin.pause();
      buzz.pause();
      winAudioRef.current?.pause();
    };
  }, []);

  const playOnce = useCallback((a: HTMLAudioElement | null, src?: string) => {
    if (!a || !configRef.current.soundsEnabled) return;
    try {
      if (src && a.src !== new URL(src, window.location.href).href) a.src = src;
      a.currentTime = 0;
    } catch {
      /* ignore */
    }
    a.play().catch(() => {});
  }, []);

  // ---- painting the reel directly (no per-frame React re-render) ----
  const measure = useCallback(() => {
    // Center name = winner-reveal size, so the wheel never "grows" on landing.
    // Constrained by BOTH width and height so it looks right on phones,
    // tablets and big screens (portrait/landscape), and never overflows.
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    const fontPx = Math.max(32, Math.min(vw * 0.11, vh * 0.17, 176));
    fontPxRef.current = fontPx;
    itemHRef.current = fontPx * 1.5; // vertical gap between names
    const fs = `${Math.round(fontPx)}px`;
    slotRefs.current.forEach((el) => {
      if (el) el.style.fontSize = fs;
    });
    setCenterFontPx((prev) => (Math.abs(prev - fontPx) > 0.5 ? fontPx : prev));
  }, []);

  const paint = useCallback((pos: number, won = false) => {
    const itemH = itemHRef.current;
    const base = Math.round(pos);
    const { fontColor, winnerColor } = configRef.current;
    for (let s = 0; s < SLOTS; s++) {
      const el = slotRefs.current[s];
      if (!el) continue;
      const idx = base + (s - HALF);
      const d = idx - pos; // signed distance from center, in items
      const ad = Math.min(Math.abs(d), 3.2);
      const scale = 1 - ad * 0.2; // big bright center, neighbors recede
      const opacity = Math.max(0, 1 - ad * 0.46);
      const isCenter = Math.abs(d) < 0.5;
      el.textContent = labelAt(idx);
      el.style.transform = `translate(-50%, -50%) translateY(${(d * itemH).toFixed(2)}px) scale(${scale.toFixed(3)})`;
      el.style.opacity = String(opacity);
      el.style.fontWeight = isCenter ? '800' : '500';
      el.style.color = won && isCenter ? winnerColor : fontColor;
      el.style.textShadow =
        won && isCenter ? `0 0 30px ${winnerColor}66, 0 0 70px ${winnerColor}44` : 'none';
    }
  }, [labelAt]);

  const stopRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const finalize = useCallback(() => {
    stopRaf();
    const d = decelRef.current;
    if (d) posRef.current = d.to;
    paint(posRef.current, true);
    decelRef.current = null;
    setPhaseBoth('won');
    playOnce(winAudioRef.current, resolveWinSoundUrl(configRef.current));
  }, [stopRaf, paint, setPhaseBoth, playOnce]);

  // Lock in the winner and start a smooth, exact deceleration to it.
  // The draw may be async (server-side) — the reel keeps spinning until it
  // resolves, then decelerates onto the winner.
  const beginDecel = useCallback(
    async (v0: number) => {
      if (decelRef.current || drawPendingRef.current) return;
      drawPendingRef.current = true;
      let w: RaffleWinner | null = null;
      try {
        w = await Promise.resolve(onRequestDraw());
      } catch {
        w = null;
      }
      drawPendingRef.current = false;

      // user reset / navigated away while the draw was in flight
      if (phaseRef.current !== 'spinning') return;
      if (!w) {
        // pool emptied — abort cleanly
        stopRaf();
        setPhaseBoth('idle');
        return;
      }
      setWinner(w);
      winnerLabelRef.current = participantLabel(w, modeRef.current);

      const speed = Math.max(v0, 6);
      const from = posRef.current;
      const K = TAIL_NAMES;
      // total names travelled: a fast brake chunk + the readable tail.
      const D = Math.max(Math.round(speed * 1.4), K + 6);
      let to = Math.round(from + D);
      if (to - from < K + 4) to = Math.ceil(from) + K + 6;
      landingIndexRef.current = to;
      const dist = to - from;
      const v1 = TAIL_HANDOFF_SPEED;
      const dBrake = dist - K; // names covered before the slow tail
      // Kinematics (constant decel per phase) → EXACT landing on `to`:
      //   brake: speed → v1 over dBrake names → t1 = 2·dBrake / (speed + v1)
      //   tail:  v1 → 0 over K names          → t2 = 2·K / v1
      const t1 = (2 * dBrake) / (speed + v1);
      const t2 = (2 * K) / v1;
      decelRef.current = { start: performance.now(), from, to, t1, t2, v0: speed, v1, dBrake };
      setPhaseBoth('stopping');
    },
    [onRequestDraw, stopRaf, setPhaseBoth]
  );

  const frame = useCallback(
    (ts: number) => {
      const dt = Math.min((ts - lastTsRef.current) / 1000, 0.05);
      lastTsRef.current = ts;

      if (phaseRef.current === 'spinning') {
        const elapsed = (ts - spinStartRef.current) / 1000;
        const v = elapsed < RAMP_TIME ? MAX_SPEED * (elapsed / RAMP_TIME) : MAX_SPEED;
        velRef.current = v;
        posRef.current += v * dt;
        paint(posRef.current);
        if (elapsed >= RAMP_TIME + CRUISE_TIME) {
          beginDecel(MAX_SPEED); // auto slow-down after a single press
        }
      } else if (phaseRef.current === 'stopping') {
        const d = decelRef.current;
        if (d) {
          const e = (ts - d.start) / 1000;
          if (e < d.t1) {
            // brake phase: constant decel from v0 → v1
            posRef.current = d.from + d.v0 * e + 0.5 * ((d.v1 - d.v0) / d.t1) * e * e;
            paint(posRef.current);
          } else if (e < d.t1 + d.t2) {
            // slow tail: constant decel from v1 → 0, names readable
            const e2 = e - d.t1;
            posRef.current = d.from + d.dBrake + d.v1 * e2 - 0.5 * (d.v1 / d.t2) * e2 * e2;
            paint(posRef.current);
            // Fire the reveal the instant the winner is visually centered —
            // skips the imperceptible final crawl so sound + effect feel instant.
            if (d.to - posRef.current < 0.04) {
              finalize();
              return;
            }
          } else {
            finalize();
            return;
          }
        }
      }
      rafRef.current = requestAnimationFrame(frame);
    },
    [paint, beginDecel, finalize]
  );

  const startSpin = useCallback(() => {
    if (!hasPool) return;
    setWinner(null);
    landingIndexRef.current = null;
    winnerLabelRef.current = null;
    decelRef.current = null;
    velRef.current = 0;
    spinStartRef.current = performance.now();
    lastTsRef.current = performance.now();
    setPhaseBoth('spinning');
    measure();
    playOnce(spinAudioRef.current); // spin sound, once
    stopRaf();
    rafRef.current = requestAnimationFrame(frame);
  }, [hasPool, setPhaseBoth, measure, playOnce, stopRaf, frame]);

  const toggle = useCallback(() => {
    const p = phaseRef.current;
    if (p === 'idle' || p === 'won') {
      startSpin();
    } else if (p === 'spinning') {
      // second press → buzzer, then decelerate to a stop
      playOnce(buzzerAudioRef.current);
      beginDecel(velRef.current);
    }
    // 'stopping' → ignore further presses
  }, [startSpin, playOnce, beginDecel]);

  // keyboard: Enter / Space
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

  // measure on mount + resize
  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

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

  const showReel = phase === 'spinning' || phase === 'stopping';

  return (
    <div
      dir="rtl"
      onClick={toggle}
      className="relative h-screen w-screen overflow-hidden select-none cursor-pointer"
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

      {/* depth vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.55) 100%)',
        }}
      />

      {/* the spinning reel (always mounted so refs/measure are ready).
          Fades IN when spinning; hides INSTANTLY on win so it never bleeds
          through the winner reveal. */}
      <div
        ref={reelRef}
        className="absolute inset-0 z-10"
        style={{
          opacity: showReel ? 1 : 0,
          transition: showReel ? 'opacity 250ms ease-in' : 'none',
          pointerEvents: 'none',
        }}
      >
        {Array.from({ length: SLOTS }).map((_, i) => (
          <div
            key={i}
            ref={(el) => {
              slotRefs.current[i] = el;
            }}
            className="absolute left-1/2 top-1/2 w-full whitespace-nowrap px-6 text-center leading-none will-change-transform"
            style={{ transform: 'translate(-50%, -50%)' }}
          />
        ))}
        {/* center selection sheen */}
        <div
          className="pointer-events-none absolute left-0 right-0 top-1/2 -translate-y-1/2"
          style={{
            height: '1.9em',
            background:
              'linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)',
          }}
        />
      </div>

      {/* idle prompt — editable title inside the same animated shine border as
          the winner (silver/nickel by default). Start with a click or Enter. */}
      {phase === 'idle' && (
        <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
          {loading ? (
            <Loader2
              className="animate-spin"
              size={56}
              style={{ color: config.idleColor || '#C9CED6', opacity: 0.7 }}
            />
          ) : hasPool ? (
            <div
              className="raffle-winner-frame"
              style={{ position: 'relative', ['--raffle-c' as string]: config.idleColor || '#C9CED6' }}
            >
              <div
                className="raffle-winner-name font-bold leading-none whitespace-nowrap"
                style={{
                  color: config.idleColor || '#C9CED6',
                  fontSize: 'clamp(2.5rem, 8vw, 7rem)',
                  ['--raffle-c' as string]: config.idleColor || '#C9CED6',
                }}
              >
                {config.idleTitle || 'הגרלה'}
              </div>
            </div>
          ) : (
            <div className="text-2xl font-medium" style={{ color: config.fontColor, opacity: 0.5 }}>
              אין משתתפים זמינים
            </div>
          )}
        </div>
      )}

      {/* winner reveal — the name sits at the EXACT same center + size as the
          reel left it, so the border-shine + glow appear instantly with no
          jump or scale. The caption is absolutely placed below the name so it
          never pushes the name up. */}
      {phase === 'won' && winner && (
        <div className="pointer-events-none absolute inset-0 z-20">
          <div
            className="raffle-winner-frame"
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 'max-content',
              maxWidth: '94vw',
              ['--raffle-c' as string]: config.winnerColor,
            }}
          >
            <div
              className="raffle-winner-name whitespace-nowrap leading-none text-center"
              style={{
                color: config.winnerColor,
                fontSize: `${Math.round(centerFontPx)}px`,
                fontWeight: 800,
                ['--raffle-c' as string]: config.winnerColor,
              }}
            >
              {participantLabel(winner, mode)}
            </div>
          </div>
          <div
            className="raffle-winner-caption font-bold tracking-wide"
            style={{
              position: 'absolute',
              left: '50%',
              top: `calc(50% + ${Math.round(centerFontPx * 0.92)}px)`,
              transform: 'translateX(-50%)',
              color: config.winnerColor,
              fontSize: 'clamp(1.4rem, 4vw, 2.6rem)',
            }}
          >
            זוכה
          </div>
        </div>
      )}

      {/* No on-screen button — the whole screen is clickable (and Enter/Space
          works) to start/stop, keeping the projection clean. */}
    </div>
  );
}
