/**
 * Procedural canvas textures — no image downloads for the ship, the FX or
 * the rocks. Everything here is generated once on first use and cached.
 */
import * as THREE from 'three';
import { mulberry32 } from './world';

const cache = new Map<string, THREE.Texture>();

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return { c, g: c.getContext('2d')! };
}

function tex(key: string, make: () => HTMLCanvasElement, srgb = true, repeat = false) {
  let t = cache.get(key);
  if (t) return t;
  t = new THREE.CanvasTexture(make());
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  cache.set(key, t);
  return t;
}

/** soft radial glow, white → transparent */
export function glowTexture() {
  return tex('glow', () => {
    const { c, g } = canvas(128, 128);
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.18, 'rgba(255,255,255,0.75)');
    grd.addColorStop(0.45, 'rgba(255,255,255,0.18)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    return c;
  });
}

/** hard-cored star flare with 4 spikes, for the sun & engine cores */
export function flareTexture() {
  return tex('flare', () => {
    const { c, g } = canvas(256, 256);
    const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.08, 'rgba(255,250,235,0.9)');
    grd.addColorStop(0.25, 'rgba(255,220,160,0.25)');
    grd.addColorStop(1, 'rgba(255,200,120,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
    g.globalCompositeOperation = 'lighter';
    for (const [w, h] of [[256, 3], [3, 256]]) {
      const lg = g.createLinearGradient(128 - w / 2, 128 - h / 2, 128 + w / 2, 128 + h / 2);
      lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, 'rgba(255,255,255,0.55)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = lg; g.fillRect(128 - w / 2, 128 - h / 2, w, h);
    }
    return c;
  });
}

/** a soft ring, for shockwaves and the dock beacon */
export function ringTexture() {
  return tex('ring', () => {
    const { c, g } = canvas(256, 256);
    const grd = g.createRadialGradient(128, 128, 70, 128, 128, 128);
    grd.addColorStop(0, 'rgba(255,255,255,0)');
    grd.addColorStop(0.75, 'rgba(255,255,255,0.9)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
    return c;
  });
}

/** smoke puff, grey noise in a soft circle */
export function smokeTexture() {
  return tex('smoke', () => {
    const { c, g } = canvas(128, 128);
    const rng = mulberry32(5);
    for (let i = 0; i < 70; i++) {
      const x = 64 + (rng() - 0.5) * 60, y = 64 + (rng() - 0.5) * 60, r = 10 + rng() * 26;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, 'rgba(255,255,255,0.12)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    }
    const mask = g.getImageData(0, 0, 128, 128);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      const d = Math.hypot(x - 64, y - 64) / 64;
      mask.data[(y * 128 + x) * 4 + 3] *= Math.max(0, 1 - d * d);
    }
    g.putImageData(mask, 0, 0);
    return c;
  });
}

// ---------------------------------------------------------------- value noise
function makeNoise(seed: number) {
  const rng = mulberry32(seed);
  const N = 256;
  const p = new Float32Array(N * N);
  for (let i = 0; i < p.length; i++) p[i] = rng();
  const at = (x: number, y: number) => p[((y & 255) * N) + (x & 255)];
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const n2 = (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = smooth(x - xi), yf = smooth(y - yi);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
  return (x: number, y: number, oct = 4) => {
    let v = 0, amp = 0.5, f = 1;
    for (let o = 0; o < oct; o++) { v += n2(x * f, y * f) * amp; amp *= 0.5; f *= 2; }
    return v;
  };
}

/**
 * The Shrike's livery: worn industrial yellow over gunmetal, rust bleeding
 * from panel seams, chipped edges — the look Ankur's salvage-rig textures had,
 * redrawn from scratch. Returns colour, roughness and metalness maps that
 * share one layout.
 */
export function shrikeMaps() {
  const key = 'shrike';
  if (cache.has(key + '-c')) return { map: cache.get(key + '-c')!, rough: cache.get(key + '-r')!, metal: cache.get(key + '-m')! };
  const S = 1024;
  const col = canvas(S, S), rough = canvas(S, S), metal = canvas(S, S);
  const noise = makeNoise(11);
  const rng = mulberry32(42);
  const cImg = col.g.createImageData(S, S);
  const rImg = rough.g.createImageData(S, S);
  const mImg = metal.g.createImageData(S, S);
  // panel grid with offset rows → seam mask
  const panel = (x: number, y: number) => {
    const ph = 128, row = Math.floor(y / ph);
    const pw = 160 + (row % 3) * 40;
    const ox = (row * 61) % pw;
    const px = (x + ox) % pw, py = y % ph;
    const edge = Math.min(px, pw - px, py, ph - py);
    return edge;
  };
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      const n = noise(x / 90, y / 90, 5);
      const fine = noise(x / 9 + 50, y / 9 + 50, 3);
      const edge = panel(x, y);
      const seam = edge < 1.6 ? 1 : 0;
      // rust grows from seams and drips downward (+y)
      const drip = noise(x / 14, y / 120 + 9, 3);
      const rustField = n * 0.75 + drip * 0.4 + (edge < 10 ? 0.16 : 0) - 0.74;
      const rust = THREE.MathUtils.clamp(rustField * 4, 0, 1);
      const chip = fine > 0.71 && n > 0.52 ? 1 : 0; // bare metal flecks
      // base yellow with tonal variation
      let r = 214 + (n - 0.5) * 40, g = 156 + (n - 0.5) * 34, b = 26 + (n - 0.5) * 18;
      // grime toward panel edges
      const grime = THREE.MathUtils.clamp(1 - edge / 18, 0, 1) * 0.35;
      r *= 1 - grime; g *= 1 - grime; b *= 1 - grime;
      // rust tones
      const rr = 118 + fine * 40, rg = 58 + fine * 22, rb = 26 + fine * 10;
      r = r * (1 - rust) + rr * rust; g = g * (1 - rust) + rg * rust; b = b * (1 - rust) + rb * rust;
      if (chip) { r = 120 + fine * 30; g = 118 + fine * 30; b = 112 + fine * 30; }
      if (seam) { r *= 0.35; g *= 0.35; b *= 0.35; }
      cImg.data[i] = r; cImg.data[i + 1] = g; cImg.data[i + 2] = b; cImg.data[i + 3] = 255;
      const ro = chip ? 0.38 : rust > 0.4 ? 0.92 : 0.5 + fine * 0.15 + grime * 0.4;
      rImg.data[i] = rImg.data[i + 1] = rImg.data[i + 2] = ro * 255; rImg.data[i + 3] = 255;
      const me = chip ? 0.9 : rust > 0.4 ? 0.15 : 0.25;
      mImg.data[i] = mImg.data[i + 1] = mImg.data[i + 2] = me * 255; mImg.data[i + 3] = 255;
    }
  }
  col.g.putImageData(cImg, 0, 0);
  rough.g.putImageData(rImg, 0, 0);
  metal.g.putImageData(mImg, 0, 0);
  // stencils: hull number + a few service markings
  col.g.font = 'bold 54px "JetBrains Mono", monospace';
  col.g.fillStyle = 'rgba(30,26,22,0.85)';
  col.g.fillText('HD-07', 560, 300);
  col.g.font = 'bold 22px "JetBrains Mono", monospace';
  col.g.fillText('NO STEP', 120, 690);
  col.g.fillText('VENT ▲', 700, 860);
  col.g.fillText('CV · 2184', 300, 520);
  for (let k = 0; k < 18; k++) {
    // rivet rows
    const x0 = rng() * S, y0 = rng() * S, horiz = rng() > 0.5;
    col.g.fillStyle = 'rgba(40,32,20,0.55)';
    for (let j = 0; j < 14; j++) col.g.fillRect(x0 + (horiz ? j * 9 : 0), y0 + (horiz ? 0 : j * 9), 2.5, 2.5);
  }
  const mk = (cv: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    return t;
  };
  const map = mk(col.c, true), r = mk(rough.c, false), m = mk(metal.c, false);
  cache.set(key + '-c', map); cache.set(key + '-r', r); cache.set(key + '-m', m);
  return { map, rough: r, metal: m };
}

/** black / yellow hazard chevrons */
export function hazardTexture() {
  return tex('hazard', () => {
    const { c, g } = canvas(256, 32);
    g.fillStyle = '#1c1a17'; g.fillRect(0, 0, 256, 32);
    g.fillStyle = '#e2a516';
    for (let x = -32; x < 290; x += 32) {
      g.beginPath(); g.moveTo(x, 32); g.lineTo(x + 16, 32); g.lineTo(x + 32, 0); g.lineTo(x + 16, 0); g.closePath(); g.fill();
    }
    return c;
  }, true, true);
}

/** gunmetal with scuffs, for pods, nozzles, greebles */
export function gunmetalTexture() {
  return tex('gunmetal', () => {
    const { c, g } = canvas(256, 256);
    const noise = makeNoise(77);
    const img = g.createImageData(256, 256);
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      const n = noise(x / 20, y / 20, 4);
      const s = noise(x / 2, y / 60 + 3, 2);
      const v = 46 + n * 36 + (s > 0.72 ? 30 : 0);
      const i = (y * 256 + x) * 4;
      img.data[i] = v; img.data[i + 1] = v * 1.02; img.data[i + 2] = v * 1.08; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c;
  }, true, true);
}

/** alien hull: near-black crimson plates with glowing vein channels (emissive map) */
export function alienMaps() {
  const key = 'alien';
  if (cache.has(key + '-c')) return { map: cache.get(key + '-c')!, emissive: cache.get(key + '-e')! };
  const S = 512;
  const col = canvas(S, S), emi = canvas(S, S);
  const noise = makeNoise(303);
  const cImg = col.g.createImageData(S, S), eImg = emi.g.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4;
    const n = noise(x / 40, y / 40, 5);
    const ridge = 1 - Math.abs(noise(x / 70 + 20, y / 70 + 20, 4) * 2 - 1);
    const vein = ridge > 0.93 ? (ridge - 0.93) / 0.07 : 0;
    const base = 18 + n * 26;
    cImg.data[i] = base * 1.5; cImg.data[i + 1] = base * 0.55; cImg.data[i + 2] = base * 0.8; cImg.data[i + 3] = 255;
    eImg.data[i] = 255 * vein; eImg.data[i + 1] = 40 * vein; eImg.data[i + 2] = 120 * vein; eImg.data[i + 3] = 255;
  }
  col.g.putImageData(cImg, 0, 0); emi.g.putImageData(eImg, 0, 0);
  const mk = (cv: HTMLCanvasElement) => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
  const map = mk(col.c), e = mk(emi.c);
  cache.set(key + '-c', map); cache.set(key + '-e', e);
  return { map, emissive: e };
}

/** rocky albedo for asteroids (tiles; sampled with box UVs) */
export function rockTexture(variant: 0 | 1) {
  return tex(`rock${variant}`, () => {
    const { c, g } = canvas(256, 256);
    const noise = makeNoise(variant ? 919 : 515);
    const img = g.createImageData(256, 256);
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      const n = noise(x / 24, y / 24, 5);
      const f = noise(x / 5, y / 5, 2);
      const crater = noise(x / 40 + 7, y / 40 + 7, 2) > 0.66 ? 0.7 : 1;
      const v = (60 + n * 90 + f * 30) * crater;
      const i = (y * 256 + x) * 4;
      if (variant) { img.data[i] = v * 0.62; img.data[i + 1] = v * 0.6; img.data[i + 2] = v * 0.6; }
      else { img.data[i] = v * 1.0; img.data[i + 1] = v * 0.86; img.data[i + 2] = v * 0.72; }
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c;
  }, true, true);
}
