// Ritam 3D — procedural background music (Web Audio, no files).
// One cheerful loop per world: Town (bouncy major), Forest (gentle minor), Caves (echoey),
// Sky Fortress (fast and bright). Bass + plucky arpeggio melody + soft kick and hat.
// update(mode, world, muted) sets volume: full while playing, softer in menus, ducked on pause.

export function createMusic() {
  let ctx = null, master = null, noise = null, timer = null, step = 0, nextT = 0, world = 0, target = 0.5, muted = false, prev = 0;
  const SONGS = [
    { bpm: 116, root: 60, prog: [0, 7, 9, 5], minor: false, scale: [0, 2, 4, 7, 9] },
    { bpm: 100, root: 57, prog: [0, 5, 3, 7], minor: true, scale: [0, 3, 5, 7, 10] },
    { bpm: 92, root: 55, prog: [0, 8, 3, 7], minor: true, scale: [0, 2, 3, 7, 8] },
    { bpm: 132, root: 62, prog: [0, 5, 9, 7], minor: false, scale: [0, 2, 4, 7, 9] }
  ];
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const tone = (type, freq, t, dur, vol, slide) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.03);
  };
  const hat = (t, vol) => {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise; f.type = 'highpass'; f.frequency.value = 7000;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + 0.06);
  };
  const tick = () => {
    if (!ctx) return;
    const level = muted ? 0 : target;
    master.gain.setTargetAtTime(level * 0.09, ctx.currentTime, 0.25);
    if (level === 0) { nextT = ctx.currentTime + 0.05; return; }
    const S = SONGS[world] || SONGS[0], dt = 60 / S.bpm / 4;
    while (nextT < ctx.currentTime + 0.15) {
      const bar = Math.floor(step / 16) % 4, st = step % 16, ch = S.root + S.prog[bar], t = nextT;
      if (st === 0 || st === 8) tone('sine', 120, t, 0.18, 0.5, 45);
      if (st === 4 || st === 12) hat(t, 0.06);
      if (st % 2 === 0 && st !== 4 && st !== 12) hat(t, 0.025);
      if (st === 0 || st === 6 || st === 8 || st === 14) tone('triangle', hz(ch - 24 + (st === 6 ? 7 : 0)), t, dt * 1.8, 0.32);
      if (st % 2 === 0 && rnd() < (st % 4 === 0 ? 0.9 : 0.55)) {
        const deg = S.scale[(prev = Math.max(0, Math.min(S.scale.length * 2 - 1, prev + Math.floor(rnd() * 5) - 2))) % S.scale.length];
        tone('square', hz(ch + 12 + deg + (prev >= S.scale.length ? 12 : 0)), t, dt * 1.4, 0.07);
      }
      if (st === 0) for (const k of [0, S.minor ? 3 : 4, 7]) tone('sine', hz(ch + k), t, dt * 14, 0.035);
      step++; nextT += dt;
      if (step % 64 === 0) seed = 7 + world * 131;
    }
  };
  return {
    unlock() {
      if (ctx) { ctx.resume && ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC(); master = ctx.createGain(); master.gain.value = 0;
      const comp = ctx.createDynamicsCompressor(); master.connect(comp); comp.connect(ctx.destination);
      noise = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
      const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      nextT = ctx.currentTime + 0.1;
      timer = setInterval(tick, 30);
    },
    update(mode, w, m) {
      muted = !!m;
      if (w != null && w !== world) { world = Math.max(0, Math.min(3, w)); seed = 7 + world * 131; }
      target = mode === 'playing' || mode === 'dying' ? 1 : mode === 'paused' ? 0.3 : mode === 'edit' ? 0 : 0.5;
    },
    stop() { if (timer) clearInterval(timer); timer = null; if (ctx) ctx.close(); ctx = null; }
  };
}

export default createMusic;
