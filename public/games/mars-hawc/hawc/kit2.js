// Reference-led asset set, original designs at real scale (metres, feet at y = 0, facing +Z):
// Starship-class lander, pad launch tower, base control tower, and NASA's Perseverance rover (real, public hardware).
import { THREE } from './lib.js?v=18';

const S = (o) => new THREE.MeshStandardMaterial(o);
let K = null;
function hexTex() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.fillStyle = '#17181a'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#2b2d31'; g.lineWidth = 2; const r = 14, h = r * Math.sqrt(3);
  for (let y = -1; y < 12; y++) for (let x = -1; x < 12; x++) { const cx = x * r * 1.5, cy = y * h + (x % 2 ? h / 2 : 0); g.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; g[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r); } g.closePath(); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function mk() {
  if (K) return K; const hx = hexTex(); hx.repeat.set(6, 10);
  return (K = { steel: S({ color: 0xc9ccd0, metalness: 0.45, roughness: 0.35 }), tile: S({ color: 0xffffff, map: hx, metalness: 0.1, roughness: 0.85 }), dark: S({ color: 0x232528, metalness: 0.6, roughness: 0.5 }),
    grey: S({ color: 0x9a9fa5, metalness: 0.4, roughness: 0.45 }), white: S({ color: 0xdedbd4, metalness: 0.2, roughness: 0.55 }), conc: S({ color: 0x8a7a6c, roughness: 0.95 }), red: S({ color: 0x9a463c, roughness: 0.6 }),
    haz: S({ color: 0xd8a032, roughness: 0.6 }), glass: new THREE.MeshPhysicalMaterial({ color: 0x0e1820, roughness: 0.06, metalness: 0.3, clearcoat: 1 }), lit: new THREE.MeshBasicMaterial({ color: 0xffe2b0, toneMapped: false }),
    gold: S({ color: 0xc89a3a, metalness: 1, roughness: 0.3 }), blue: S({ color: 0x3d5f82, roughness: 0.5 }), sol: S({ color: 0x14244a, metalness: 0.5, roughness: 0.25 }) });
}
const add = (p, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = o.receiveShadow = true; p.add(o); return o; };
const beam = (p, a, b, t, mat) => { const d = b.clone().sub(a), o = add(p, new THREE.BoxGeometry(t, t, d.length()), mat); o.position.copy(a).addScaledVector(d, 0.5); o.lookAt(b); return o; };
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Starship-class lander: 9 m stainless hull, ring bands, hex heat shield on the windward (-Z) side, 2 fore + 2 aft flaps, 6 legs, 3 sea-level + 3 vacuum engines.
export function lander() {
  const m = mk(), g = new THREE.Group(), R = 4.5, B0 = 3.2, B1 = 41;
  add(g, new THREE.CylinderGeometry(R, R, B1 - B0, 56, 1, true, -Math.PI / 2, Math.PI), m.steel, 0, (B0 + B1) / 2, 0).material.side = THREE.DoubleSide;
  add(g, new THREE.CylinderGeometry(R * 1.004, R * 1.004, B1 - B0, 56, 1, true, Math.PI / 2, Math.PI), m.tile, 0, (B0 + B1) / 2, 0);
  const prof = [[R, 0], [R * 0.98, 2], [R * 0.9, 4], [R * 0.72, 6.2], [R * 0.45, 8], [0.6, 9.2], [0.01, 9.4]].map(([r, y]) => new THREE.Vector2(r, y));
  add(g, new THREE.LatheGeometry(prof, 48, -Math.PI / 2, Math.PI), m.steel, 0, B1, 0); add(g, new THREE.LatheGeometry(prof.map((v) => v.clone().multiplyScalar(1.004)), 48, Math.PI / 2, Math.PI), m.tile, 0, B1, 0);
  for (let y = B0 + 1.8; y < B1; y += 1.8) add(g, new THREE.TorusGeometry(R + 0.02, 0.03, 4, 64), m.grey, 0, y, 0, Math.PI / 2);
  add(g, new THREE.CylinderGeometry(R, R * 0.92, 1.2, 56), m.grey, 0, B0 - 0.6, 0);
  for (const s of [-1, 1]) {
    const af = add(g, new THREE.BoxGeometry(0.35, 12, 4.4), m.tile, s * (R + 0.2), B0 + 7, -1.4, 0, 0, s * 0.05); add(g, new THREE.BoxGeometry(0.4, 1.4, 1.2), m.grey, s * (R + 0.05), B0 + 12.5, -1.6);
    add(g, new THREE.BoxGeometry(0.3, 5.5, 2.6), m.tile, s * (R * 0.82 + 0.2), B1 + 2.8, -1.2, 0, 0, s * 0.22); add(g, new THREE.BoxGeometry(0.4, 1, 1), m.grey, s * (R * 0.8), B1 + 5, -1.3);
  }
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + Math.PI / 6, cx = Math.cos(a), cz = Math.sin(a);
    beam(g, V(cx * R * 0.95, B0 + 3.2, cz * R * 0.95), V(cx * 7.2, 0.4, cz * 7.2), 0.5, m.grey); beam(g, V(cx * R * 0.9, B0 - 0.6, cz * R * 0.9), V(cx * 7.0, 0.5, cz * 7.0), 0.3, m.dark);
    add(g, new THREE.CylinderGeometry(0.9, 1.1, 0.4, 16), m.dark, cx * 7.25, 0.2, cz * 7.25); }
  const bell = (r, len, x, z) => { add(g, new THREE.CylinderGeometry(r * 0.35, r, len, 24, 1, true), m.dark, x, B0 - 1.2 - len / 2, z).material.side = THREE.DoubleSide; add(g, new THREE.CylinderGeometry(r * 0.38, r * 0.38, 0.6, 16), m.grey, x, B0 - 1.0, z); };
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; bell(0.65, 1.6, Math.cos(a) * 1.0, Math.sin(a) * 1.0); bell(1.15, 2.0, Math.cos(a + Math.PI / 3) * 3.0, Math.sin(a + Math.PI / 3) * 3.0); }
  add(g, new THREE.BoxGeometry(3.2, 2.6, 0.12), m.dark, 0, B1 - 4, R - 0.02); for (let i = 0; i < 5; i++) add(g, new THREE.BoxGeometry(0.5, 0.4, 0.1), m.lit, -1.6 + i * 0.8, B1 + 1.5, R * 0.94);
  add(g, new THREE.BoxGeometry(1.2, 2.2, 0.1), m.dark, 2.4, 6.5, R * 0.86, 0, 0.55, 0);
  return g;
}
// Pad service tower: 64 m lattice, crew access arm at 40 m, propellant arm at 22 m, jib crane on top, elevator.
export function launchTower() {
  const m = mk(), g = new THREE.Group(), H = 64, W = 9, X = -14;
  add(g, new THREE.BoxGeometry(16, 1.2, 16), m.conc, X, 0.6, 0);
  const cs = [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([a, b]) => [X + a * W / 2, b * W / 2]);
  for (const [x, z] of cs) add(g, new THREE.BoxGeometry(0.6, H, 0.6), m.grey, x, H / 2 + 1.2, z);
  const xb = []; for (let y = 1.2; y < H; y += 4) for (let s = 0; s < 4; s++) { const [x0, z0] = cs[s], [x1, z1] = cs[(s + 1) % 4]; xb.push([V(x0, y, z0), V(x1, y + 4, z1)], [V(x1, y, z1), V(x0, y + 4, z0)], [V(x0, y + 4, z0), V(x1, y + 4, z1)]); }
  for (const [a, b] of xb) beam(g, a, b, 0.22, m.grey);
  for (const y of [22, 40, 52]) add(g, new THREE.BoxGeometry(W + 1.4, 0.3, W + 1.4), m.dark, X, y, 0);
  const car = add(g, new THREE.BoxGeometry(2.4, 3, 2.4), m.haz, X - 1.6, 30, -1.6);
  const crew = new THREE.Group(); crew.position.set(X + W / 2, 40, 0); g.add(crew); add(crew, new THREE.BoxGeometry(9, 2.8, 2.6), m.white, 4.5, 1.4, 0); add(crew, new THREE.BoxGeometry(9, 0.25, 0.1), m.haz, 4.5, 2.9, 1.32); add(crew, new THREE.BoxGeometry(1.6, 3, 3.2), m.dark, 9.2, 1.5, 0);
  const prop = new THREE.Group(); prop.position.set(X + W / 2, 22, 2); g.add(prop); beam(prop, V(0, 0, 0), V(8.6, 0, 0), 0.9, m.grey); for (const z of [-0.5, 0.5]) add(prop, new THREE.CylinderGeometry(0.22, 0.22, 8.4, 10), m.white, 4.3, -0.7, z, 0, 0, Math.PI / 2); add(prop, new THREE.BoxGeometry(1.4, 2, 1.8), m.red, 8.8, -0.6, 0);
  add(g, new THREE.BoxGeometry(2.6, 2.6, 2.6), m.dark, X, H + 2.5, 0); const jib = add(g, new THREE.BoxGeometry(26, 1.0, 1.0), m.haz, X + 8, H + 4.2, 0); add(g, new THREE.BoxGeometry(6, 1.6, 1.6), m.conc, X - 7, H + 4.2, 0);
  add(g, new THREE.CylinderGeometry(0.05, 0.05, 14, 4), m.dark, X + 19, H - 3, 0); add(g, new THREE.BoxGeometry(1.2, 0.6, 1.2), m.haz, X + 19, H - 10.2, 0);
  for (const y of [H + 5.2]) add(g, new THREE.SphereGeometry(0.4, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3a2a, toneMapped: false }), X, y, 0);
  for (const z of [-1.4, 1.4]) add(g, new THREE.CylinderGeometry(0.35, 0.35, 22, 10), m.white, X + 2, 0.9, z + 12, Math.PI / 2);
  add(g, new THREE.CylinderGeometry(10, 10.4, 0.8, 40), m.conc, 6, 0.4, 0); add(g, new THREE.TorusGeometry(7.4, 0.25, 6, 48), m.haz, 6, 0.85, 0, Math.PI / 2);
  return g;
}
// Base control tower: pressurised ops cab on a 22 m pylon, elevator shaft, cable trays, air plant, power module, radar and comms mast.
export function controlTower() {
  const m = mk(), g = new THREE.Group();
  add(g, new THREE.BoxGeometry(9, 1.2, 9), m.conc, 0, 0.6, 0);
  for (const [x, z] of [[2.2, 2.2], [-2.2, 2.2], [-2.2, -2.2], [2.2, -2.2]]) add(g, new THREE.BoxGeometry(0.9, 22, 0.9), m.grey, x, 12.2, z);
  add(g, new THREE.CylinderGeometry(1.3, 1.3, 22, 20, 1, true), m.glass, 0, 12.2, 0); add(g, new THREE.BoxGeometry(1.6, 2.4, 1.6), m.haz, 0, 9, 0);
  for (const [x, c] of [[1.6, m.red], [1.9, m.blue]]) add(g, new THREE.BoxGeometry(0.25, 22, 0.25), c, x, 12.2, 0.6);
  add(g, new THREE.BoxGeometry(4.4, 3.4, 3.6), m.white, 3.6, 7, 0); for (let i = 0; i < 4; i++) add(g, new THREE.BoxGeometry(0.1, 2.6, 0.4), m.dark, 5.82, 7, -1.2 + i * 0.8);
  const pw = add(g, new THREE.CylinderGeometry(1.5, 1.5, 4.2, 24), m.white, -3.6, 14, 0, 0, 0, Math.PI / 2); add(g, new THREE.CylinderGeometry(1.2, 1.2, 4.4, 24), m.gold, -3.6, 14, 0, 0, 0, Math.PI / 2);
  add(g, new THREE.BoxGeometry(11, 0.5, 9), m.dark, 0, 23.4, 0);
  const cab = add(g, new THREE.BoxGeometry(10, 3.6, 8), m.white, 0, 25.6, 0); add(g, new THREE.BoxGeometry(10.4, 0.4, 8.4), m.red, 0, 27.6, 0);
  for (const [w, x, z, ry] of [[9.6, 0, 4.15, 0], [9.6, 0, -4.15, Math.PI], [7.6, 5.15, 0, Math.PI / 2], [7.6, -5.15, 0, -Math.PI / 2]]) { const p = add(g, new THREE.BoxGeometry(w, 1.6, 0.12), m.glass, x, 26, z, 0, ry, 0); p.rotateX(-0.28); }
  add(g, new THREE.BoxGeometry(8, 1.6, 6), m.white, 0, 28.6, 0);
  const rad = new THREE.Group(); rad.position.set(2.4, 30, 0); g.add(rad); add(rad, new THREE.CylinderGeometry(0.3, 0.3, 1.4, 10), m.grey, 0, 0.3, 0); add(rad, new THREE.BoxGeometry(3.2, 1.6, 0.25), m.grey, 0, 1.4, 0, -0.25);
  add(g, new THREE.CylinderGeometry(0.12, 0.16, 9, 8), m.grey, -2.6, 33.4, 1.5); add(g, new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3a2a, toneMapped: false }), -2.6, 38, 1.5);
  const dish = add(g, new THREE.SphereGeometry(1.2, 18, 8, 0, Math.PI * 2, 0, 0.9), m.white, -2.4, 30.4, -1.8, 0.9); dish.material = m.white.clone(); dish.material.side = THREE.DoubleSide;
  for (const [y, c] of [[24.2, 0xff3a2a], [24.9, 0xffc23a], [25.6, 0x3aff6a]]) add(g, new THREE.BoxGeometry(0.4, 0.4, 0.3), new THREE.MeshBasicMaterial({ color: c, toneMapped: false }), 5.3, y, 3.6);
  for (let i = 0; i < 6; i++) add(g, new THREE.BoxGeometry(1.0, 0.6, 0.1), m.lit, -3.8 + i * 1.5, 28.6, 3.02);
  g.userData.update = (t) => { rad.rotation.y = t * 1.2; };
  return g;
}
// NASA Perseverance at true scale: 3 m long, 2.7 m wide, 2.2 m to the mast top, 52.5 cm wheels on a rocker-bogie, MMRTG at the back, 2.1 m arm.
export function percy() {
  const m = mk(), g = new THREE.Group(), wr = 0.2625;
  add(g, new THREE.BoxGeometry(1.9, 0.62, 2.1), m.white, 0, 0.95, 0); add(g, new THREE.BoxGeometry(1.95, 0.06, 2.15), m.gold, 0, 1.28, 0);
  add(g, new THREE.BoxGeometry(1.2, 0.2, 0.6), m.dark, 0, 0.6, 0.2);
  for (const s of [-1, 1]) {
    const rk = new THREE.Group(); rk.position.set(s * 1.05, 0.95, 0); g.add(rk);
    beam(rk, V(0, 0, 0), V(0, -0.55, 1.05), 0.08, m.grey); beam(rk, V(0, 0, 0), V(0, -0.35, -0.5), 0.08, m.grey); beam(rk, V(0, -0.35, -0.5), V(0, -0.65, -0.2), 0.07, m.grey); beam(rk, V(0, -0.35, -0.5), V(0, -0.65, -1.05), 0.07, m.grey);
    for (const z of [1.05, -0.2, -1.05]) { const w = add(g, new THREE.CylinderGeometry(wr, wr, 0.4, 24), m.grey, s * 1.18, wr, z, 0, 0, Math.PI / 2); for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; add(w, new THREE.BoxGeometry(0.42, 0.02, 0.05), m.dark, 0, Math.cos(a) * wr, Math.sin(a) * wr, a); } }
  }
  add(g, new THREE.BoxGeometry(1.8, 0.05, 0.05), m.grey, 0, 1.36, -0.3);
  const mast = add(g, new THREE.BoxGeometry(0.12, 0.9, 0.12), m.white, 0.62, 1.75, 0.85); add(g, new THREE.BoxGeometry(0.42, 0.24, 0.3), m.white, 0.62, 2.2, 0.9); add(g, new THREE.CylinderGeometry(0.06, 0.06, 0.08, 12), m.glass, 0.62, 2.22, 1.06, Math.PI / 2);
  for (const x of [0.5, 0.74]) add(g, new THREE.CylinderGeometry(0.04, 0.04, 0.06, 10), m.glass, x, 2.16, 1.06, Math.PI / 2);
  const rtg = add(g, new THREE.CylinderGeometry(0.32, 0.32, 0.66, 16), m.dark, 0, 1.25, -1.35, 0.55); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const fn = add(g, new THREE.BoxGeometry(0.02, 0.62, 0.22), m.dark, Math.cos(a) * 0.38, 1.25 + Math.sin(a) * 0.38 * 0.84, -1.35 + Math.sin(a) * 0.2); fn.rotation.set(0.55, 0, a); }
  const hga = add(g, new THREE.CylinderGeometry(0.3, 0.3, 0.04, 6), m.dark, -0.55, 1.5, -0.55, 0.3, 0, 0.2); add(g, new THREE.CylinderGeometry(0.03, 0.03, 0.2, 6), m.grey, -0.55, 1.38, -0.55);
  add(g, new THREE.CylinderGeometry(0.035, 0.035, 0.3, 8), m.white, -0.7, 1.45, 0.4);
  const arm = new THREE.Group(); arm.position.set(-0.45, 1.0, 1.1); g.add(arm); beam(arm, V(0, 0, 0), V(0.3, 0.1, 0.55), 0.09, m.white); beam(arm, V(0.3, 0.1, 0.55), V(0.95, 0.05, 0.25), 0.08, m.white);
  add(arm, new THREE.BoxGeometry(0.34, 0.3, 0.34), m.grey, 0.95, -0.12, 0.3); add(arm, new THREE.CylinderGeometry(0.03, 0.03, 0.25, 8), m.dark, 0.95, -0.38, 0.3);
  return g;
}

// PRIF44 rifle with an under-slung GASHR tube, bullpup. Gun space: +Z forward, origin at the shoulder line; grips at (0,-0.08,-0.05) and (0,-0.07,0.17).
export function buildRifle(accent = 0x5980a6) {
  const g = new THREE.Group(), w = S({ color: 0xd4d2cc, roughness: 0.5, metalness: 0.1 }), d = S({ color: 0x222428, roughness: 0.5, metalness: 0.55 }), st = S({ color: 0x8d9399, roughness: 0.3, metalness: 1 });
  const cy = new THREE.MeshBasicMaterial({ color: 0x5fe0ff, toneMapped: false }), ac = S({ color: accent, roughness: 0.5 });
  const b = (W, H, D, m, x, y, z, rx = 0) => add(g, new THREE.BoxGeometry(W, H, D), m, x, y, z, rx);
  const c = (r, h, m, x, y, z, rx = Math.PI / 2, seg = 14) => add(g, new THREE.CylinderGeometry(r, r, h, seg), m, x, y, z, rx);
  b(0.075, 0.13, 0.52, w, 0, 0.0, -0.08); b(0.06, 0.05, 0.5, d, 0, -0.07, -0.08); b(0.08, 0.02, 0.4, d, 0, 0.075, -0.02);
  b(0.07, 0.11, 0.12, d, 0, -0.02, 0.24); c(0.016, 0.28, st, 0, 0.025, 0.42); c(0.03, 0.22, d, 0, -0.035, 0.38); c(0.034, 0.03, ac, 0, -0.035, 0.3);
  b(0.085, 0.13, 0.05, d, 0, -0.005, 0.55); for (const y of [0.025, -0.035]) add(g, new THREE.CircleGeometry(y > 0 ? 0.014 : 0.026, 12), new THREE.MeshBasicMaterial({ color: 0x050505 }), 0, y, 0.576);
  const mag = add(g, new THREE.TorusGeometry(0.16, 0.022, 8, 20, 1.1), d, 0, -0.09, -0.26, 0, Math.PI / 2); mag.rotation.set(0, Math.PI / 2, Math.PI * 1.08);
  const led = add(g, new THREE.TorusGeometry(0.16, 0.006, 4, 20, 0.9), cy, 0.024, -0.09, -0.26, 0, Math.PI / 2); led.rotation.set(0, Math.PI / 2, Math.PI * 1.12);
  b(0.035, 0.11, 0.045, d, 0, -0.11, -0.05, 0.3); b(0.032, 0.08, 0.04, d, 0, -0.1, 0.17, 0.15);
  b(0.07, 0.12, 0.06, d, 0, -0.01, -0.36); c(0.022, 0.07, d, 0, 0.105, 0.02); add(g, new THREE.CircleGeometry(0.016, 12), cy, 0, 0.105, 0.056);
  const can = c(0.04, 0.09, st, 0.06, -0.02, 0.06, 0, 16); can.rotation.z = Math.PI / 2; c(0.042, 0.012, cy, 0.06, -0.02, 0.06, 0).rotation.z = Math.PI / 2;
  b(0.077, 0.02, 0.14, ac, 0, 0.045, -0.2);
  b(0.088, 0.06, 0.3, w, 0, 0.07, 0.14); b(0.09, 0.03, 0.16, w, 0, 0.06, 0.36, -0.12); b(0.082, 0.1, 0.1, w, 0, -0.01, -0.39, 0.25); b(0.09, 0.016, 0.24, d, 0, 0.035, 0.14);
  b(0.012, 0.05, 0.03, cy, 0, 0.125, -0.12, -0.4); for (let i = 0; i < 3; i++) b(0.09, 0.012, 0.03, d, 0, 0.085, 0.05 + i * 0.06);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData = { rg: new THREE.Vector3(0, -0.08, -0.05), lg: new THREE.Vector3(0, -0.07, 0.17) };
  return g;
}
