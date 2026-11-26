/**
 * All sound is synthesized live with Web Audio — no samples, no licensing,
 * works offline (same approach as lib/space-drone.ts). Starts only after a
 * user gesture.
 */
export class AudioEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private lastFire = 0;
  private lastHit = 0;
  volume = 0.7;

  start() {
    if (this.ctx) { void this.ctx.resume(); return; }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = this.volume * 0.6;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4;
    master.connect(comp).connect(ctx.destination);
    this.master = master;
    // noise buffer
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    // engine: two detuned saws through a lowpass
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass'; this.engineFilter.frequency.value = 300; this.engineFilter.Q.value = 2;
    this.engineGain = ctx.createGain(); this.engineGain.gain.value = 0;
    this.engineOsc = ctx.createOscillator(); this.engineOsc.type = 'sawtooth'; this.engineOsc.frequency.value = 42;
    this.engineOsc2 = ctx.createOscillator(); this.engineOsc2.type = 'sawtooth'; this.engineOsc2.frequency.value = 42.7;
    this.engineOsc.connect(this.engineFilter); this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain).connect(master);
    this.engineOsc.start(); this.engineOsc2.start();
    // cruise wind: filtered noise
    const wind = ctx.createBufferSource(); wind.buffer = buf; wind.loop = true;
    this.windFilter = ctx.createBiquadFilter(); this.windFilter.type = 'bandpass'; this.windFilter.frequency.value = 400; this.windFilter.Q.value = 0.7;
    this.windGain = ctx.createGain(); this.windGain.gain.value = 0;
    wind.connect(this.windFilter).connect(this.windGain).connect(master);
    wind.start();
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(v * 0.6, this.ctx.currentTime, 0.05);
  }

  suspend() { void this.ctx?.suspend(); }
  resume() { void this.ctx?.resume(); }

  /** per frame: speed fraction 0..1+, boost, cruise */
  engine(throttle: number, boosting: boolean, cruise: number, docked: boolean) {
    const ctx = this.ctx;
    if (!ctx || !this.engineGain || !this.engineOsc || !this.engineOsc2 || !this.engineFilter || !this.windGain || !this.windFilter) return;
    const t = ctx.currentTime;
    const a = docked ? 0 : 0.05 + Math.abs(throttle) * 0.09 + (boosting ? 0.06 : 0);
    this.engineGain.gain.setTargetAtTime(a, t, 0.12);
    const f = 38 + Math.abs(throttle) * 30 + (boosting ? 22 : 0);
    this.engineOsc.frequency.setTargetAtTime(f, t, 0.2);
    this.engineOsc2.frequency.setTargetAtTime(f * 1.012, t, 0.2);
    this.engineFilter.frequency.setTargetAtTime(220 + Math.abs(throttle) * 500 + (boosting ? 700 : 0), t, 0.15);
    this.windGain.gain.setTargetAtTime(docked ? 0 : cruise * 0.22, t, 0.3);
    this.windFilter.frequency.setTargetAtTime(300 + cruise * 1400, t, 0.4);
  }

  private env(g: GainNode, t: number, a: number, peak: number, decay: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + decay);
  }

  laser(team: 'player' | 'enemy', distance = 0) {
    const ctx = this.ctx; if (!ctx || !this.master) return;
    const now = ctx.currentTime;
    if (team === 'player' && now - this.lastFire < 0.05) return;
    if (team === 'player') this.lastFire = now;
    const vol = team === 'player' ? 0.16 : 0.1 * Math.max(0.15, 1 - distance / 1600);
    if (vol < 0.02) return;
    const o = ctx.createOscillator(); o.type = team === 'player' ? 'square' : 'sawtooth';
    const g = ctx.createGain();
    const f0 = team === 'player' ? 980 : 620;
    o.frequency.setValueAtTime(f0, now);
    o.frequency.exponentialRampToValueAtTime(f0 * 0.28, now + 0.12);
    const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 2600;
    o.connect(flt).connect(g).connect(this.master);
    this.env(g, now, 0.004, vol, 0.12);
    o.start(now); o.stop(now + 0.15);
  }

  torpedo() {
    const ctx = this.ctx; if (!ctx || !this.master || !this.noiseBuf) return;
    const now = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(300, now); f.frequency.exponentialRampToValueAtTime(1800, now + 0.6);
    const g = ctx.createGain();
    s.connect(f).connect(g).connect(this.master);
    this.env(g, now, 0.02, 0.35, 0.7);
    s.start(now); s.stop(now + 0.8);
  }

  explosion(size: number, distance: number) {
    const ctx = this.ctx; if (!ctx || !this.master || !this.noiseBuf) return;
    const now = ctx.currentTime;
    const vol = Math.min(0.9, 0.18 + size / 60) * Math.max(0.05, 1 - distance / 4000);
    if (vol < 0.02) return;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf; s.playbackRate.value = 0.6 + Math.random() * 0.3;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(1800, now); f.frequency.exponentialRampToValueAtTime(90, now + 1.2 + size / 80);
    const g = ctx.createGain();
    s.connect(f).connect(g).connect(this.master);
    this.env(g, now, 0.01, vol, 1.0 + size / 60);
    s.start(now); s.stop(now + 2.5 + size / 60);
    // sub thump
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(90, now); o.frequency.exponentialRampToValueAtTime(30, now + 0.5);
    const g2 = ctx.createGain();
    o.connect(g2).connect(this.master);
    this.env(g2, now, 0.005, vol * 0.8, 0.5);
    o.start(now); o.stop(now + 0.6);
  }

  hit(shield: boolean) {
    const ctx = this.ctx; if (!ctx || !this.master) return;
    const now = ctx.currentTime;
    if (now - this.lastHit < 0.06) return;
    this.lastHit = now;
    const o = ctx.createOscillator(); o.type = shield ? 'sine' : 'square';
    o.frequency.setValueAtTime(shield ? 1400 : 180, now);
    o.frequency.exponentialRampToValueAtTime(shield ? 500 : 60, now + 0.18);
    const g = ctx.createGain();
    o.connect(g).connect(this.master);
    this.env(g, now, 0.003, shield ? 0.14 : 0.3, 0.2);
    o.start(now); o.stop(now + 0.25);
  }

  blip(kind: 'pickup' | 'ui' | 'good' | 'warn' | 'dock' | 'scan') {
    const ctx = this.ctx; if (!ctx || !this.master) return;
    const now = ctx.currentTime;
    const seq: Record<typeof kind, number[]> = {
      pickup: [880, 1320], ui: [660], good: [523, 659, 784], warn: [440, 330], dock: [392, 523, 659, 784], scan: [740, 988, 1175],
    };
    seq[kind].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = kind === 'warn' ? 'triangle' : 'sine';
      const g = ctx.createGain();
      o.frequency.value = f;
      o.connect(g).connect(this.master!);
      const t = now + i * 0.07;
      this.env(g, t, 0.005, kind === 'ui' ? 0.06 : 0.11, 0.16);
      o.start(t); o.stop(t + 0.2);
    });
  }

  dispose() {
    try { void this.ctx?.close(); } catch { /* ignore */ }
    this.ctx = null;
  }
}
