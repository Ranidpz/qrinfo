// הקוד — synthesized game sounds (Web Audio, no files), same idea as
// src/lib/raffle/codeAudio.ts: zero network, zero latency, never throws.
// Every sound is short (< 1s). Muting is the caller's job (`muted` → don't call).

export type SfxName =
  | 'tap' | 'key' | 'scan' | 'correct' | 'wrong' | 'penalty' | 'hot' | 'place'
  | 'unplace' | 'unlock' | 'fanfare' | 'tick' | 'warn';

type Note = { f: number; t: number; d: number; type?: OscillatorType; g?: number; slideTo?: number };

const SOUNDS: Record<SfxName, Note[]> = {
  tap: [{ f: 520, t: 0, d: 0.05, type: 'triangle', g: 0.12 }],
  key: [{ f: 880, t: 0, d: 0.04, type: 'square', g: 0.05 }],
  scan: [{ f: 660, t: 0, d: 0.07, type: 'sine' }, { f: 990, t: 0.07, d: 0.09, type: 'sine' }],
  correct: [
    { f: 523, t: 0, d: 0.1, type: 'triangle' },
    { f: 659, t: 0.08, d: 0.1, type: 'triangle' },
    { f: 784, t: 0.16, d: 0.12, type: 'triangle' },
    { f: 1047, t: 0.24, d: 0.28, type: 'triangle', g: 0.22 },
  ],
  wrong: [{ f: 220, t: 0, d: 0.16, type: 'sawtooth', g: 0.08, slideTo: 150 }],
  penalty: [
    { f: 392, t: 0, d: 0.14, type: 'square', g: 0.07 },
    { f: 311, t: 0.13, d: 0.14, type: 'square', g: 0.07 },
    { f: 233, t: 0.26, d: 0.3, type: 'square', g: 0.07, slideTo: 180 },
  ],
  hot: [{ f: 300, t: 0, d: 0.45, type: 'sawtooth', g: 0.07, slideTo: 1400 }, { f: 1568, t: 0.4, d: 0.25, type: 'triangle' }],
  place: [{ f: 740, t: 0, d: 0.06, type: 'triangle', g: 0.14 }, { f: 1110, t: 0.04, d: 0.06, type: 'sine', g: 0.08 }],
  unplace: [{ f: 600, t: 0, d: 0.07, type: 'triangle', g: 0.1, slideTo: 400 }],
  unlock: [
    { f: 1200, t: 0, d: 0.03, type: 'square', g: 0.06 },
    { f: 900, t: 0.12, d: 0.03, type: 'square', g: 0.06 },
    { f: 1500, t: 0.24, d: 0.05, type: 'square', g: 0.07 },
  ],
  fanfare: [
    { f: 392, t: 0, d: 0.14, type: 'triangle' },
    { f: 523, t: 0.12, d: 0.14, type: 'triangle' },
    { f: 659, t: 0.24, d: 0.14, type: 'triangle' },
    { f: 784, t: 0.36, d: 0.5, type: 'triangle', g: 0.22 },
    { f: 1047, t: 0.36, d: 0.5, type: 'sine', g: 0.12 },
  ],
  tick: [{ f: 1400, t: 0, d: 0.02, type: 'square', g: 0.03 }],
  warn: [{ f: 494, t: 0, d: 0.1, type: 'triangle' }, { f: 415, t: 0.12, d: 0.16, type: 'triangle' }],
};

class GameSfx {
  private ctx: AudioContext | null = null;
  private dead = false;

  private ensure(): AudioContext | null {
    if (this.ctx || this.dead || typeof window === 'undefined') return this.ctx;
    try {
      const Ctor = window.AudioContext
        || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) {
        this.dead = true;
        return null;
      }
      this.ctx = new Ctor();
    } catch {
      this.dead = true;
    }
    return this.ctx;
  }

  /** Call from a tap so iOS lets the context run. */
  unlock() {
    const ctx = this.ensure();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  play(name: SfxName) {
    const ctx = this.ensure();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    try {
      const now = ctx.currentTime + 0.01;
      for (const n of SOUNDS[name]) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = n.type || 'sine';
        osc.frequency.setValueAtTime(n.f, now + n.t);
        if (n.slideTo) osc.frequency.exponentialRampToValueAtTime(n.slideTo, now + n.t + n.d);
        const peak = n.g ?? 0.16;
        g.gain.setValueAtTime(0.0001, now + n.t);
        g.gain.exponentialRampToValueAtTime(peak, now + n.t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, now + n.t + n.d);
        osc.connect(g).connect(ctx.destination);
        osc.start(now + n.t);
        osc.stop(now + n.t + n.d + 0.03);
      }
    } catch {
      /* sound never breaks the game */
    }
  }
}

let shared: GameSfx | null = null;
export function gameSfx(): GameSfx {
  if (!shared) shared = new GameSfx();
  return shared;
}
