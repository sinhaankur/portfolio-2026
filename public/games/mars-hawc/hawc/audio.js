// Procedural sound. Mars' thin CO2 air muffles and quietens sound, so everything runs through a low-pass.
export class Sfx {
  constructor() { this.ctx = null; this.muted = false; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : 0.55;
    this.air = c.createBiquadFilter(); this.air.type = 'lowpass'; this.air.frequency.value = 4200;
    this.air.connect(this.master); this.master.connect(c.destination);
    const len = c.sampleRate * 2, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.nbuf = b;
    const w = c.createBufferSource(); w.buffer = b; w.loop = true;
    const wf = c.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 380; wf.Q.value = 0.6;
    this.windGain = c.createGain(); this.windGain.gain.value = 0;
    w.connect(wf); wf.connect(this.windGain); this.windGain.connect(this.air); w.start();
  }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.55; }
  wind(v) { if (this.windGain) this.windGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.5); }
  att(d) { return d == null ? 1 : 1 / (1 + d / 70); }
  noise(dur, { f = 900, q = 0.8, type = 'lowpass', gain = 0.4, f2, d } = {}) {
    if (!this.ctx || this.muted) return;
    const c = this.ctx, t = c.currentTime, s = c.createBufferSource(); s.buffer = this.nbuf;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur); fl.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(gain * this.att(d), t); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    s.connect(fl); fl.connect(g); g.connect(this.air); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  tone(freq, dur, { type = 'sine', gain = 0.3, to, d } = {}) {
    if (!this.ctx || this.muted) return;
    const c = this.ctx, t = c.currentTime, o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(gain * this.att(d), t); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    o.connect(g); g.connect(this.air); o.start(t); o.stop(t + dur + 0.05);
  }
  cannon(d) { this.noise(0.18, { f: 2400, f2: 300, gain: 0.35, d }); this.tone(90, 0.16, { type: 'triangle', gain: 0.4, to: 40, d }); }
  rifle(d) { this.noise(0.08, { f: 3000, f2: 900, gain: 0.18, d }); }
  missile(d) { this.noise(0.7, { f: 600, f2: 2400, type: 'bandpass', q: 1.2, gain: 0.3, d }); }
  bolt(d) { this.tone(620, 0.16, { type: 'sawtooth', gain: 0.08, to: 180, d }); this.noise(0.1, { f: 1800, gain: 0.12, d }); }
  boom(size = 1, d) { this.noise(1.2 + size * 0.6, { f: 700, f2: 60, gain: 0.7 * Math.min(1.4, size), d }); this.tone(55, 0.9, { type: 'sine', gain: 0.6, to: 28, d }); }
  // A 19-tonne foot: sub thump, regolith crunch, metal clank, then the hydraulic hiss and servo whine of the knee
  step(d, heavy = 1) {
    this.tone(44, 0.34, { type: 'sine', gain: 0.55 * heavy, to: 24, d }); this.noise(0.2, { f: 700, f2: 180, type: 'bandpass', q: 0.7, gain: 0.16 * heavy, d });
    this.tone(180 + Math.random() * 60, 0.07, { type: 'square', gain: 0.025 * heavy, to: 120, d }); this.noise(0.05, { f: 2600, type: 'highpass', gain: 0.05 * heavy, d });
    setTimeout(() => { this.noise(0.26, { f: 3400, type: 'highpass', gain: 0.035 * heavy, d }); this.tone(150, 0.22, { type: 'sawtooth', gain: 0.012 * heavy, to: 260, d }); }, 90);
  }
  foot(run) { this.noise(0.09, { f: 900, f2: 300, type: 'bandpass', q: 0.9, gain: run ? 0.1 : 0.07 }); this.tone(95, 0.06, { gain: 0.05, to: 60 }); }
  breath(inhale, hard) { this.noise(inhale ? 0.9 : 1.2, { f: inhale ? 700 : 520, f2: inhale ? 1100 : 300, type: 'bandpass', q: 1.4, gain: hard ? 0.05 : 0.028 }); }
  radio() { this.tone(2200, 0.025, { type: 'square', gain: 0.03 }); this.noise(0.12, { f: 2800, type: 'bandpass', q: 2, gain: 0.04 }); setTimeout(() => this.tone(1800, 0.025, { type: 'square', gain: 0.025 }), 120); }
  pickup() { [660, 880, 1320].forEach((f, i) => setTimeout(() => this.tone(f, 0.12, { type: 'triangle', gain: 0.07 }), i * 70)); }
  clunk() { this.tone(70, 0.3, { gain: 0.35, to: 40 }); this.noise(0.15, { f: 1600, type: 'bandpass', q: 1.5, gain: 0.12 }); setTimeout(() => this.noise(0.4, { f: 3000, type: 'highpass', gain: 0.05 }), 160); }
  // Cockpit hum: reactor drone + fans under the canopy; level 0 on foot or with no power
  hum(level) {
    if (!this.ctx) return; const c = this.ctx;
    if (!this.humG) { this.humG = c.createGain(); this.humG.gain.value = 0; this.humG.connect(this.air);
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 55; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180; o.connect(lp); lp.connect(this.humG); o.start();
      const o2 = c.createOscillator(); o2.frequency.value = 110.6; const g2 = c.createGain(); g2.gain.value = 0.4; o2.connect(g2); g2.connect(this.humG); o2.start();
      const n = c.createBufferSource(); n.buffer = this.nbuf; n.loop = true; const nf = c.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 1200; nf.Q.value = 0.5; const ng = c.createGain(); ng.gain.value = 0.35; n.connect(nf); nf.connect(ng); ng.connect(this.humG); n.start(); }
    this.humG.gain.setTargetAtTime(level, c.currentTime, 0.4);
  }
  hit() { this.noise(0.12, { f: 3200, type: 'highpass', gain: 0.22 }); this.tone(1400, 0.05, { type: 'square', gain: 0.05 }); }
  hurt() { this.noise(0.3, { f: 500, gain: 0.5 }); this.tone(70, 0.25, { gain: 0.4, to: 40 }); }
  lock() { this.tone(1320, 0.07, { type: 'square', gain: 0.06 }); setTimeout(() => this.tone(1760, 0.09, { type: 'square', gain: 0.06 }), 90); }
  hover() { this.tone(1900, 0.018, { type: 'square', gain: 0.018 }); this.noise(0.03, { f: 4200, type: 'highpass', gain: 0.02 }); }
  press() { this.tone(240, 0.06, { type: 'square', gain: 0.05, to: 140 }); this.noise(0.05, { f: 1800, type: 'bandpass', q: 2, gain: 0.08 }); setTimeout(() => this.tone(1320, 0.03, { type: 'square', gain: 0.03 }), 45); }
  ui() { this.tone(880, 0.05, { type: 'triangle', gain: 0.08 }); }
  alarm() { this.tone(520, 0.18, { type: 'square', gain: 0.07 }); setTimeout(() => this.tone(390, 0.22, { type: 'square', gain: 0.07 }), 200); }
  servo() { this.noise(0.5, { f: 300, f2: 1400, type: 'bandpass', q: 3, gain: 0.15 }); }
  jet() { this.noise(0.25, { f: 900, type: 'bandpass', q: 0.7, gain: 0.12 }); }
}
