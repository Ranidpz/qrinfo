// Synthesized sound for the "code reveal" raffle animation.
//
// Deliberately NOT file-based: at a live event a missing/slow asset would cost
// the ticking its timing, and overlapping <audio> elements can't retrigger fast
// enough for a click every ~70ms. Web Audio synthesizes each blip on the spot —
// zero network, zero latency, unlimited overlap.
//
// Every public method is failure-tolerant: if the browser blocks or drops the
// AudioContext the animation keeps running silently, it never throws.

export class CodeRevealAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private dead = false; // context creation failed — stop trying

  // Must be called from a user gesture (the click that starts the draw) or the
  // browser will keep the context suspended.
  unlock(): void {
    const ctx = this.ensure();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  private ensure(): AudioContext | null {
    if (this.ctx || this.dead) return this.ctx;
    try {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) {
        this.dead = true;
        return null;
      }
      const ctx = new Ctor();
      const master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);

      // 0.25s of white noise, reused for every transient.
      const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.25), ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

      this.ctx = ctx;
      this.master = master;
      this.noise = buf;
      return ctx;
    } catch {
      this.dead = true;
      return null;
    }
  }

  // Dry mechanical click while the characters are spinning.
  tick(): void {
    const ctx = this.ensure();
    if (!ctx || !this.master || !this.noise || ctx.state !== 'running') return;
    try {
      const t = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.playbackRate.value = 1.6;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2600;
      bp.Q.value = 1.4;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.14, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
      src.connect(bp).connect(g).connect(this.master);
      src.start(t);
      src.stop(t + 0.05);
    } catch {
      /* never let sound break the animation */
    }
  }

  // The "pop" when a character locks. The pitch climbs with `progress` (0→1)
  // so the tension audibly builds toward the last character.
  pop(progress = 0): void {
    const ctx = this.ensure();
    if (!ctx || !this.master || !this.noise || ctx.state !== 'running') return;
    try {
      const t = ctx.currentTime;
      const p = Math.max(0, Math.min(1, progress));
      const f0 = 420 + p * 460;

      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f0, t);
      osc.frequency.exponentialRampToValueAtTime(f0 * 0.34, t + 0.1);
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(0.5, t + 0.006);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.19);
      osc.connect(og).connect(this.master);
      osc.start(t);
      osc.stop(t + 0.22);

      // short noise transient on top → reads as a physical "thock"
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 1400;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.3, t);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
      src.connect(hp).connect(ng).connect(this.master);
      src.start(t);
      src.stop(t + 0.06);
    } catch {
      /* ignore */
    }
  }

  close(): void {
    try {
      this.ctx?.close();
    } catch {
      /* ignore */
    }
    this.ctx = null;
    this.master = null;
    this.noise = null;
  }
}
