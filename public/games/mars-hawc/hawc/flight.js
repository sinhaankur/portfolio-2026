// Orbital flight: Ares Ring, 400 km over Mars. Newtonian flight with an assist toggle, ENG/WPN/SHD power split,
// cannon + missiles, and the core loop in space: knock a ship's engines out, match speed, EVA across and take it.
import { THREE, clamp, damp } from './lib.js?v=19';
import { loadTex } from './assets.js?v=19';
import { loadPilot, makePilot } from './units.js?v=19';

const V3 = THREE.Vector3, FWD = new V3(0, 0, 1), UPV = new V3(0, 1, 0);
const _a = new V3(), _b = new V3(), _c = new V3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const MARS_R = 3389.5, ALT = 400; // km; the planet is drawn as a backdrop at 1 unit = 1 km and follows the camera
const SHIPS = {
  kestrel: { name: 'Kestrel', cls: 'Union strike fighter', hull: 260, shield: 160, accel: 70, vmax: 170, boost: 1.7, turn: 1.55, roll: 2.6, guns: 2, gunDmg: 5, rof: 0.12, missiles: 6, faction: 'union' },
  raptor: { name: 'Raptor', cls: 'Darken interceptor', hull: 170, shield: 90, accel: 80, vmax: 185, boost: 1.6, turn: 1.7, roll: 3.0, guns: 2, gunDmg: 7, rof: 0.12, missiles: 2, faction: 'darken' },
  courier: { name: 'Courier', cls: 'Darken cargo tug', hull: 600, shield: 200, accel: 26, vmax: 120, boost: 1.3, turn: 0.55, roll: 0.8, guns: 0, gunDmg: 0, rof: 1, missiles: 0, faction: 'darken' },
};
const PIPS = 6;

function M() {
  if (M.c) return M.c; const S = (o) => new THREE.MeshStandardMaterial(o), B = (c) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
  return (M.c = { white: S({ color: 0xd9d6cf, roughness: 0.5, metalness: 0.25 }), grey: S({ color: 0x8b9096, roughness: 0.4, metalness: 0.7 }), dark: S({ color: 0x222428, roughness: 0.5, metalness: 0.6 }),
    rad: S({ color: 0xe9e9e6, roughness: 0.7, metalness: 0.1 }), gold: S({ color: 0xc89a3a, roughness: 0.3, metalness: 1 }), glass: new THREE.MeshPhysicalMaterial({ color: 0x0d1620, roughness: 0.05, metalness: 0.2, clearcoat: 1 }),
    dred: S({ color: 0x4a1d18, roughness: 0.55, metalness: 0.45 }), dblk: S({ color: 0x17181a, roughness: 0.45, metalness: 0.7 }), sol: S({ color: 0x14244a, metalness: 0.5, roughness: 0.25, emissive: 0x0b1838, emissiveIntensity: 0.3 }),
    steel: S({ color: 0xc9ccd0, roughness: 0.35, metalness: 0.45 }), win: B(0xffe2b0), red: B(0xff3a2a), green: B(0x3aff6a), blueG: B(0x9fc8ff), orG: B(0xff7a3a) });
}
const add = (p, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); p.add(o); return o; };
const plume = (c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });

// Planform helpers: wing() extrudes an [x,z] outline into a slab; fin() extrudes a [z,y] outline into an upright blade.
const wing = (pts, t) => { const s = new THREE.Shape(); pts.forEach(([x, z], i) => (i ? s.lineTo(x, z) : s.moveTo(x, z))); const e = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: true, bevelThickness: t * 0.3, bevelSize: 0.06, bevelSegments: 1 }); e.rotateX(Math.PI / 2); return e; };
const fin = (pts, t) => { const s = new THREE.Shape(); pts.forEach(([z, y], i) => (i ? s.lineTo(z, y) : s.moveTo(z, y))); const e = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false }); e.translate(0, 0, -t / 2); e.rotateY(-Math.PI / 2); return e; };
const mir = (pts, s) => (s > 0 ? pts : pts.map(([x, z]) => [-x, z]).reverse());
const frus = (rt, rb, h) => new THREE.CylinderGeometry(rt * 0.7071, rb * 0.7071, h, 4, 1, false, Math.PI / 4);

// Union Kestrel: methalox strike fighter. Slab fuselage, faceted canopy, shoulder engines, swept delta wings, twin canted tails, chin cannons. Faces +Z, 17 m long, 16 m span.
export function kestrel(accent = 0x5980a6) {
  const m = M(), g = new THREE.Group(), acc = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.5, metalness: 0.2 });
  const org = m.org || (m.org = new THREE.MeshStandardMaterial({ color: 0xc46a26, roughness: 0.58, metalness: 0.15 })), orgD = m.orgD || (m.orgD = new THREE.MeshStandardMaterial({ color: 0x9c4f1c, roughness: 0.62, metalness: 0.15 }));
  add(g, new THREE.BoxGeometry(2.2, 1.7, 7.4), org, 0, 0, -0.7);
  add(g, frus(0.3, 1, 5.2), org, 0, -0.12, 5.6, Math.PI / 2).scale.set(2.2, 1, 1.46);
  add(g, new THREE.BoxGeometry(2.0, 0.5, 9.5), m.grey, 0, -0.95, 0.2); add(g, new THREE.BoxGeometry(1.3, 0.55, 5.6), orgD, 0, 1.05, -1.9);
  for (const z of [-3.4, -2.6, -1.8]) add(g, new THREE.BoxGeometry(0.9, 0.04, 0.5), m.rad, 0, 1.34, z);
  for (const z of [2.6, 0.6, -1.6, -3.6]) add(g, new THREE.BoxGeometry(2.24, 1.74, 0.05), m.dark, 0, 0, z);
  const can = new THREE.Group(); can.position.set(0, 0.82, 2.2); g.add(can); add(can, frus(0.35, 1, 3.4), m.glass, 0, 0, 1.7, Math.PI / 2).scale.set(1.5, 1, 1.15);
  add(g, new THREE.BoxGeometry(1.56, 0.7, 0.12), m.dark, 0, 1.05, 2.2); add(g, new THREE.BoxGeometry(0.1, 0.1, 3.3), m.dark, 0, 1.3, 3.8, 0.16);
  for (const [x, h] of [[0.3, 2.4], [-0.25, 1.6]]) add(g, new THREE.CylinderGeometry(0.02, 0.03, h, 5), m.dark, x, 1.3 + h / 2, 0.9, -0.2);
  const noz = [], plumes = [], muz = [];
  for (const s of [-1, 1]) {
    add(g, new THREE.CylinderGeometry(0.72, 0.8, 5.6, 20), org, s * 1.62, 0.72, -2.6, Math.PI / 2);
    add(g, new THREE.CylinderGeometry(0.76, 0.76, 0.4, 20), m.grey, s * 1.62, 0.72, 0.3, Math.PI / 2); add(g, new THREE.CylinderGeometry(0.6, 0.6, 0.44, 20), m.dark, s * 1.62, 0.72, 0.32, Math.PI / 2);
    add(g, new THREE.CylinderGeometry(0.82, 0.82, 0.3, 20), m.rad, s * 1.62, 0.72, -3.6, Math.PI / 2);
    add(g, new THREE.CylinderGeometry(0.58, 0.8, 1.1, 20, 1, true), m.dark, s * 1.62, 0.72, -5.9, Math.PI / 2).material.side = THREE.DoubleSide;
    noz.push(add(g, new THREE.CircleGeometry(0.6, 20), m.blueG, s * 1.62, 0.72, -5.5, 0, Math.PI));
    plumes.push(add(g, new THREE.ConeGeometry(0.62, 7, 18, 1, true), plume(0x8fbfff), s * 1.62, 0.72, -9.9, -Math.PI / 2));
    add(g, new THREE.BoxGeometry(0.9, 1.1, 3.4), orgD, s * 1.5, -0.3, 0.6); add(g, new THREE.BoxGeometry(0.7, 0.8, 0.1), m.dark, s * 1.5, -0.3, 2.32);
    const w = add(g, wing(mir([[1.0, 1.6], [8.0, -3.6], [8.0, -5.0], [1.0, -4.6]], s), 0.2), org, 0, -0.2, 0); w.rotation.z = -s * 0.05;
    const tip = add(g, wing(mir([[6.6, -2.56], [8.02, -3.6], [8.02, -5.02], [6.6, -4.94]], s), 0.22), m.rad, 0, -0.19, 0); tip.rotation.z = -s * 0.05;
    add(g, wing(mir([[2.0, -4.4], [6.2, -4.75], [6.2, -5.5], [2.0, -5.3]], s), 0.12), m.grey, 0, -0.34, 0).rotation.z = -s * 0.05;
    add(g, wing(mir([[1.0, 4.6], [2.6, 2.6], [2.6, 2.0], [1.0, 2.4]], s), 0.12), org, 0, 0.1, 0);
    const tf = add(g, fin([[-2.4, 0], [-5.4, 0], [-6.8, 3.8], [-5.6, 3.8]], 0.14), org, s * 1.5, 1.3, 0, 0, 0, -s * 0.34);
    add(g, fin([[-5.24, 2.9], [-6.47, 2.9], [-6.82, 3.82], [-5.58, 3.82]], 0.16), m.rad, s * 1.5, 1.3, 0, 0, 0, -s * 0.34);
    add(g, fin([[-4.2, 1.2], [-5.6, 1.2], [-5.85, 1.75], [-4.5, 1.75]], 0.17), acc, s * 1.5, 1.3, 0, 0, 0, -s * 0.34);
    add(g, fin([[-2.6, 0], [-4.6, 0], [-5.2, -1.3], [-4.4, -1.3]], 0.1), orgD, s * 1.3, -0.9, 0, 0, 0, s * 0.5);
    add(g, new THREE.CylinderGeometry(0.09, 0.09, 4.4, 10), m.dark, s * 0.38, -1.05, 6.6, Math.PI / 2); add(g, new THREE.CylinderGeometry(0.13, 0.13, 0.5, 10), m.dark, s * 0.38, -1.05, 8.7, Math.PI / 2); muz.push(new V3(s * 0.38, -1.05, 9.0));
    add(g, new THREE.CylinderGeometry(0.16, 0.16, 2.6, 10), m.rad, s * 5.0, -0.55, -2.6, Math.PI / 2); add(g, new THREE.ConeGeometry(0.16, 0.6, 10), m.dark, s * 5.0, -0.55, -1.0, Math.PI / 2);
    add(g, new THREE.SphereGeometry(0.12, 8, 6), s > 0 ? m.red : m.green, s * 8.05, -0.55, -4.3);
    add(g, new THREE.CircleGeometry(0.32, 20), m.rad, s * 4.4, -0.165 - 4.4 * 0.05, -2.4, -Math.PI / 2);
  }
  add(g, new THREE.BoxGeometry(0.9, 0.5, 1.6), m.dark, 0, -1.2, 5.0);
  g.userData = { noz, plumes, muz, cockpit: new V3(0, 1.15, 3.6), canopy: can };
  return g;
}
// Darken Raptor: gunmetal dagger. Long wedge nose, slit canopy, cranked forward-swept wings, canted tails, one big engine.
export function raptor() {
  const m = M(), g = new THREE.Group(), gun = m.gun || (m.gun = new THREE.MeshStandardMaterial({ color: 0x34363a, roughness: 0.48, metalness: 0.7 }));
  add(g, new THREE.BoxGeometry(1.9, 1.2, 6.4), gun, 0, 0, -1.0);
  add(g, frus(0.12, 1, 7.2), gun, 0, 0, 5.8, Math.PI / 2).scale.set(1.9, 1, 1.2);
  add(g, frus(0.6, 1, 2.0), m.dblk, 0, 0, -5.2, -Math.PI / 2).scale.set(1.9, 1, 1.2);
  add(g, new THREE.BoxGeometry(1.0, 0.5, 4.6), m.dblk, 0, 0.72, -1.4); add(g, frus(0.3, 1, 2.6), m.orG, 0, 0.5, 3.3, Math.PI / 2).scale.set(0.8, 1, 0.5);
  add(g, new THREE.BoxGeometry(1.94, 0.1, 5.6), m.dred, 0, 0.3, -0.8);
  for (const z of [1.2, -0.8, -2.8]) add(g, new THREE.BoxGeometry(1.93, 1.23, 0.05), m.dark, 0, 0, z);
  const noz = [], plumes = [], muz = [];
  for (const s of [-1, 1]) {
    add(g, new THREE.BoxGeometry(0.8, 0.9, 3.6), m.dblk, s * 1.25, -0.1, -0.2); add(g, new THREE.BoxGeometry(0.6, 0.66, 0.1), m.dark, s * 1.25, -0.1, 1.62);
    add(g, wing(mir([[0.9, -0.6], [3.2, -1.6], [7.0, 1.5], [7.0, 0.5], [3.4, -3.2], [0.9, -4.2]], s), 0.18), gun, 0, 0, 0).rotation.z = s * 0.06;
    add(g, wing(mir([[5.9, 0.6], [7.02, 1.52], [7.02, 0.5], [6.1, -0.44]], s), 0.2), m.dred, 0, 0.01, 0).rotation.z = s * 0.06;
    add(g, fin([[-2.4, 0], [-4.6, 0], [-5.9, 2.5], [-5.0, 2.5]], 0.12), gun, s * 0.8, 0.6, 0, 0, 0, -s * 0.5);
    add(g, fin([[-4.67, 1.7], [-5.5, 1.7], [-5.92, 2.52], [-4.98, 2.52]], 0.14), m.dred, s * 0.8, 0.6, 0, 0, 0, -s * 0.5);
    add(g, new THREE.CylinderGeometry(0.1, 0.1, 3.4, 8), m.dark, s * 3.3, -0.25, 0.2, Math.PI / 2); muz.push(new V3(s * 3.3, -0.25, 2.0));
    add(g, new THREE.CylinderGeometry(0.14, 0.14, 2.2, 8), m.dark, s * 5.2, -0.3, -0.3, Math.PI / 2);
    add(g, new THREE.SphereGeometry(0.1, 8, 6), s > 0 ? m.red : m.green, s * 7.05, 0.5, 1.0);
  }
  add(g, new THREE.CylinderGeometry(0.95, 1.2, 1.6, 20, 1, true), m.dark, 0, 0, -6.4, Math.PI / 2).material.side = THREE.DoubleSide;
  noz.push(add(g, new THREE.CircleGeometry(0.9, 20), m.orG, 0, 0, -5.8, 0, Math.PI));
  plumes.push(add(g, new THREE.ConeGeometry(0.95, 8, 18, 1, true), plume(0xff8a4a), 0, 0, -11.0, -Math.PI / 2));
  g.userData = { noz, plumes, muz, cockpit: new V3(0, 0.7, 3.0) };
  return g;
}
// Darken courier: methalox tug with four tank spheres and a cargo cradle, ~26 m.
export function courier() {
  const m = M(), g = new THREE.Group();
  add(g, new THREE.CylinderGeometry(1.4, 1.4, 22, 16), m.dblk, 0, 0, 0, Math.PI / 2);
  add(g, new THREE.BoxGeometry(3.6, 2.6, 4.2), m.dred, 0, 0.4, 11.5); add(g, new THREE.BoxGeometry(2.6, 0.5, 0.1), m.orG, 0, 1.2, 13.65);
  for (const [x, y] of [[2.6, 0], [-2.6, 0], [0, 2.6], [0, -2.6]]) add(g, new THREE.SphereGeometry(1.7, 18, 12), m.grey, x, y, -3);
  for (let i = 0; i < 3; i++) add(g, new THREE.BoxGeometry(4.6, 3.0, 3.6), i % 2 ? m.dred : m.dark, 0, 0, 3.4 + i * 3.0 - 3);
  const noz = [], plumes = [];
  for (const [x, y] of [[1.6, 1.6], [-1.6, 1.6], [1.6, -1.6], [-1.6, -1.6]]) { add(g, new THREE.CylinderGeometry(0.7, 1.0, 1.6, 16, 1, true), m.dark, x, y, -11.6, Math.PI / 2).material.side = THREE.DoubleSide; noz.push(add(g, new THREE.CircleGeometry(0.72, 16), m.orG, x, y, -10.9, 0, Math.PI)); plumes.push(add(g, new THREE.ConeGeometry(0.75, 6, 14, 1, true), plume(0xff8a4a), x, y, -15.4, -Math.PI / 2)); }
  for (const s of [-1, 1]) add(g, new THREE.SphereGeometry(0.16, 8, 6), s > 0 ? m.red : m.green, s * 2.0, 1.8, 11);
  g.userData = { noz, plumes, muz: [], cockpit: new V3(0, 1.4, 12) };
  return g;
}
// Ares Ring at true scale: 280 m truss spine, solar wings, radiators, 70 m spin ring (2.2 rpm for Mars gravity), docked tanker.
export function aresRing() {
  const m = M(), g = new THREE.Group(), LEN = 280, T = 3;
  for (const [y, z] of [[T, T], [-T, T], [T, -T], [-T, -T]]) add(g, new THREE.BoxGeometry(LEN, 0.5, 0.5), m.grey, 0, y, z);
  const xb = new THREE.InstancedMesh(new THREE.BoxGeometry(0.35, T * 2, 0.35), m.grey, 29 * 4), mx = new THREE.Matrix4(); let k = 0;
  for (let i = 0; i <= 28; i++) { const x = -LEN / 2 + i * 10; for (const [y, z, r] of [[0, T, 0], [0, -T, 0], [T, 0, 1], [-T, 0, 1]]) { mx.makeRotationX(r ? Math.PI / 2 : 0).setPosition(x, y, z); xb.setMatrixAt(k++, mx); } } g.add(xb);
  for (const sx of [-1, 1]) { for (const sz of [-1, 1]) { add(g, new THREE.BoxGeometry(32, 0.25, 92), m.sol, sx * (LEN / 2 - 14), 0, sz * 50); add(g, new THREE.BoxGeometry(33, 0.3, 1), m.gold, sx * (LEN / 2 - 14), 0, sz * 4.5); }
    add(g, new THREE.BoxGeometry(1.2, 58, 26), m.rad, sx * 80, 34, 0); add(g, new THREE.BoxGeometry(1.2, 58, 26), m.rad, sx * 80, -34, 0);
    add(g, new THREE.SphereGeometry(1.2, 10, 8), sx > 0 ? m.green : m.red, sx * LEN / 2, 4, 0); }
  const ring = new THREE.Group(); g.add(ring); const RR = 70, NM = 16;
  for (let i = 0; i < NM; i++) { const a = i / NM * Math.PI * 2, mod = add(ring, new THREE.CylinderGeometry(8.6, 8.6, 2 * Math.PI * RR / NM * 0.84, 18), m.white, 0, Math.cos(a) * RR, Math.sin(a) * RR, a);
    add(ring, new THREE.BoxGeometry(4, 2.4, 1.2), m.win, 8.7, Math.cos(a) * RR, Math.sin(a) * RR, a);
    add(ring, new THREE.TorusGeometry(8.8, 1.1, 8, 20), m.dark, 0, Math.cos(a + Math.PI / NM) * RR, Math.sin(a + Math.PI / NM) * RR, a + Math.PI / NM, Math.PI / 2, 0); }
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.2; add(ring, new THREE.CylinderGeometry(1.6, 1.6, RR, 10), m.grey, 0, Math.cos(a) * RR / 2, Math.sin(a) * RR / 2, a); }
  add(g, new THREE.CylinderGeometry(12.5, 12.5, 34, 28), m.dark, 0, 0, 0, 0, 0, Math.PI / 2); add(g, new THREE.CylinderGeometry(14.5, 14.5, 6, 28), m.gold, 12, 0, 0, 0, 0, Math.PI / 2);
  const bay = add(g, new THREE.BoxGeometry(2, 9, 16), m.win, 17.2, 0, 0); bay.material = new THREE.MeshBasicMaterial({ color: 0xffd9a8, toneMapped: false });
  const tank = new THREE.Group(); tank.position.set(-70, -16, 0); g.add(tank);
  add(tank, new THREE.CylinderGeometry(4.5, 4.5, 40, 28), m.steel, 0, 0, 0, 0, 0, Math.PI / 2); add(tank, new THREE.ConeGeometry(4.5, 10, 28), m.steel, -25, 0, 0, 0, 0, Math.PI / 2);
  for (let i = 0; i < 6; i++) add(tank, new THREE.TorusGeometry(4.55, 0.12, 6, 32), m.grey, -18 + i * 7, 0, 0, 0, Math.PI / 2, 0);
  g.userData = { ring, dock: new V3(26, 0, 0) };
  return g;
}

function glowTex(inner = 'rgba(255,248,230,1)', mid = 'rgba(255,200,140,0.35)') {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, inner); gr.addColorStop(0.18, mid); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

const css = (el, s) => { el.style.cssText = s; return el; };
const div = (p, s, html = '') => { const d = css(document.createElement('div'), s); d.innerHTML = html; p.appendChild(d); return d; };
const PANEL = 'position:absolute;padding:10px 14px;background:rgba(3,4,5,.55);backdrop-filter:blur(6px);border:1px solid rgba(242,242,243,.14);color:#f2f2f3;font-family:var(--font-body)';
const KICK = 'font-family:var(--font-heading);font-weight:600;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#b5d9fd';

export class FlightMission {
  constructor(E, L, opts = {}) {
    this.e = E; this.L = L; this.opts = { sens: 1, invertY: false, ...opts };
    this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(62, 1, 0.3, 30000);
    this.state = 'loading'; this.time = 0; this.view = 'tp'; this.world = { exposure: 1.05, night: 0 };
    this.ships = []; this.bolts = []; this.fx = []; this.pending = []; this.msgs = [];
    this.stats = { kills: 0, shots: 0, hits: 0, stolen: 0, disabled: 0 }; this.score = 0; this.phase = 0;
  }
  later(t, f) { this.pending.push({ t: this.time + t, f }); }
  async load() {
    const s = this.scene, E = this.e;
    E.emit('progress', { p: 0.2, label: 'Raising the Ares Ring' });
    const [map, nrm, mw] = await Promise.all([loadTex('tex/mars_globe.jpg'), loadTex('tex/globe_normal.png', { srgb: false }), loadTex('tex/milkyway.jpg')]);
    await loadPilot();
    this.sunDir = new V3(0.62, 0.42, -0.66).normalize();
    const sun = new THREE.DirectionalLight(0xfff4e6, 3.2); sun.position.copy(this.sunDir).multiplyScalar(500); s.add(sun, sun.target); this.sun = sun;
    s.add(new THREE.HemisphereLight(0x1a2230, 0x7a3e22, 0.55)); // Mars-shine from below
    // Backdrop: sky sphere, stars, sun, Mars with atmosphere rim. Drawn first, no depth, follows the camera.
    const bg = this.bg = new THREE.Group(); s.add(bg);
    const sky = new THREE.Mesh(new THREE.SphereGeometry(20000, 48, 24), new THREE.MeshBasicMaterial({ map: mw, side: THREE.BackSide, depthWrite: false, depthTest: false, color: 0x8a8a8a })); sky.renderOrder = -5; mw.colorSpace = THREE.SRGBColorSpace; bg.add(sky);
    const N = 2600, sp = new Float32Array(N * 3), sc = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { _a.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize().multiplyScalar(18000); sp.set([_a.x, _a.y, _a.z], i * 3); const b = 0.5 + Math.random() * 0.5, w = Math.random(); sc.set([b, b * (0.9 + w * 0.1), b * (0.8 + w * 0.25)], i * 3); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.setAttribute('color', new THREE.BufferAttribute(sc, 3));
    const stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, depthWrite: false, depthTest: false, toneMapped: false })); stars.renderOrder = -4; bg.add(stars);
    const sunS = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, toneMapped: false })); sunS.scale.setScalar(2600); sunS.position.copy(this.sunDir).multiplyScalar(15000); sunS.renderOrder = -3; bg.add(sunS);
    const mars = this.mars = new THREE.Mesh(new THREE.SphereGeometry(MARS_R, 160, 80), new THREE.MeshStandardMaterial({ map, normalMap: nrm, normalScale: new THREE.Vector2(1.4, 1.4), roughness: 0.95, metalness: 0, depthWrite: false, depthTest: false }));
    mars.position.set(0, -(MARS_R + ALT), 0); mars.rotation.set(0.35, 2.2, 0.1); mars.renderOrder = -2; bg.add(mars);
    const atm = new THREE.Mesh(new THREE.SphereGeometry(MARS_R * 1.018, 96, 48), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,
      uniforms: { sun: { value: this.sunDir } }, vertexShader: 'varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: 'uniform vec3 sun; varying vec3 vN; varying vec3 vW; void main(){ vec3 V = normalize(cameraPosition - vW); float rim = pow(1. - abs(dot(V, vN)), 5.); float lit = smoothstep(-0.25, 0.4, dot(-vN, sun)); gl_FragColor = vec4(vec3(0.95,0.62,0.38) * rim * lit * 1.4, rim * lit); }' }));
    atm.position.copy(mars.position); atm.renderOrder = -1; bg.add(atm);
    E.emit('progress', { p: 0.6, label: 'Fuelling the Kestrel' });
    const st = this.station = aresRing(); s.add(st); this.dock = st.userData.dock;
    // speed dust: short streaks that show motion in empty space
    this.dustN = 260; this.dustP = Array.from({ length: this.dustN }, () => new V3((Math.random() - 0.5) * 300, (Math.random() - 0.5) * 300, (Math.random() - 0.5) * 300));
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.dustN * 6), 3));
    this.dust = new THREE.LineSegments(dg, new THREE.LineBasicMaterial({ color: 0x9fb3c8, transparent: true, opacity: 0.35, depthWrite: false })); this.dust.frustumCulled = false; s.add(this.dust);
    this.flashTex = glowTex('rgba(255,250,240,1)', 'rgba(255,170,90,0.5)');
    // player
    const P = this.player = this.spawn('kestrel', new V3(6, 0, 0), new THREE.Quaternion().setFromAxisAngle(UPV, Math.PI / 2), 'union'); P.isPlayer = true; P.vel.set(0, 0, 0);
    P.throttle = 0.35; P.assist = true; P.power = { eng: 2, wpn: 2, shd: 2 }; P.stick = { x: 0, y: 0 }; P.lockT = 0; P.heat = 0;
    this.target = null; this.camQ = P.q.clone(); this.camPos = new V3(); this.shake = 0; this.letter = 1;
    this.buildHud();
    E.emit('progress', { p: 1, label: 'Clear to launch' });
    this.state = 'intro'; this.introT = 0;
    this.intro();
  }
  spawn(kind, pos, q, faction) {
    const D = SHIPS[kind], obj = kind === 'kestrel' ? kestrel(faction === 'union' ? 0x5980a6 : 0x8a3a24) : kind === 'raptor' ? raptor() : courier();
    obj.traverse((o) => { if (o.isMesh) o.castShadow = false; }); this.scene.add(obj);
    const trail = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(40 * 3), 3)), new THREE.LineBasicMaterial({ color: faction === 'union' ? 0x9fc8ff : 0xff9a5a, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
    trail.frustumCulled = false; this.scene.add(trail);
    const sh = { kind, D, obj, trail, tr: [], trT: 0, pos: pos.clone(), vel: new V3(), q: q.clone(), w: new V3(), hull: D.hull, shield: D.shield, faction, alive: true, disabled: false, abandoned: false, throttle: 0.7, gunT: 0, mslT: 12 + Math.random() * 8, ai: { mode: 'attack', t: 0 }, missiles: D.missiles, lastHitBy: null, mount: 0 };
    this.ships.push(sh); return sh;
  }
  fwd(sh, out = _a) { return out.copy(FWD).applyQuaternion(sh.q); }
  // ----- story -----
  intro() {
    this.say('Ring Control', 'Kestrel One, Ring Control. Darken flight inbound from the night side. You are clear to launch.', 'command');
    this.later(5.5, () => this.say('Ring Control', 'Engines out beats dead. Disable what you can. A stolen hull is worth more than a wreck.', 'command'));
  }
  startCombat() {
    this.state = 'play'; this.phase = 1;
    const P = this.player, f = this.fwd(P, new V3());
    for (let i = 0; i < 3; i++) { const p = P.pos.clone().addScaledVector(f, 2600 + i * 120).add(new V3((i - 1) * 220, 60 + i * 40, (Math.random() - 0.5) * 200)); const q = new THREE.Quaternion().setFromUnitVectors(FWD, f.clone().negate()); const r = this.spawn('raptor', p, q, 'darken'); r.vel.copy(f).multiplyScalar(-120); }
    this.objective('Stop the Darken flight', () => `${this.hostiles('raptor').filter((s) => !s.alive || s.disabled).length} / 3 destroyed or disabled`);
  }
  hostiles(kind) { return this.ships.filter((s) => s.faction === 'darken' && s.kind === kind && !s.extra); }
  objective(title, sub) { this.obj = { title, sub }; this.e.sfx.radio(); }
  phaseCheck() {
    const P = this.player;
    if (this.phase === 1 && this.hostiles('raptor').every((s) => !s.alive || s.disabled)) {
      this.phase = 2; const f = this.fwd(P, new V3());
      const c = this.courier = this.spawn('courier', P.pos.clone().addScaledVector(f, 1500).add(new V3(300, 120, 0)), new THREE.Quaternion().setFromAxisAngle(UPV, Math.atan2(f.x, f.z)), 'darken'); c.vel.copy(f).multiplyScalar(60); c.ai.mode = 'flee';
      this.say('Ring Control', 'Courier breaking for Phobos. Kill its engines. Do not destroy it.', 'command');
      this.objective('Disable the courier', () => this.courier.disabled ? 'Engines out' : `Hull ${Math.round(this.courier.hull / this.courier.D.hull * 100)}%. Engines fail under 35%`);
    }
    if (this.phase === 2 && this.courier?.disabled) { this.phase = 3; this.say('Ring Control', 'Engines are out. Match its speed, then go across.', 'command'); this.objective('Board the courier', () => 'Get within 80 m, match speed, hold E'); }
    if (this.phase === 3 && P === this.courier) {
      this.phase = 4; this.say('Ring Control', 'Courier is ours. Two more Raptors coming. Bring it home.', 'command'); this.objective('Bring the courier to the Ring', () => `${Math.round(P.pos.distanceTo(this.dock))} m to the dock`);
      for (let i = 0; i < 2; i++) { const p = P.pos.clone().add(new V3((i ? 1 : -1) * 900, 300, -1400)); const r = this.spawn('raptor', p, new THREE.Quaternion(), 'darken'); r.extra = true; }
    }
    if (this.phase === 4 && P.pos.distanceTo(this.dock) < 260) this.finish(true, 'Courier docked', 'You took a Darken cargo tug intact and brought it into the Ares Ring.');
    if (this.phase >= 2 && this.courier && !this.courier.alive) this.finish(false, 'Courier destroyed', 'The cargo went up with the tug. Ring Control needed it intact.');
  }
  finish(won, title, reason) {
    if (this.state === 'end') return; this.state = 'end'; this.endT = won ? 6 : 3.2; this.outro = won;
    if (won) this.score += 1500;
    const acc = this.stats.shots ? Math.round(this.stats.hits / this.stats.shots * 100) : 0, mm = Math.floor(this.time / 60), ss = Math.floor(this.time % 60);
    this.result = { won, title, reason, id: this.L.id, stats: { points: this.score, time: `${mm}:${String(ss).padStart(2, '0')}`, kills: this.stats.kills, accuracy: acc + '%', stolen: this.stats.stolen } };
    this.say('Ring Control', won ? 'Courier is in the cradle. Good flying, Kestrel.' : 'Kestrel, abort. Come home.', 'command');
  }
  say(who, text, voice) { this.sub = { who, text, t: Math.max(4, text.length * 0.07) }; this.e.sfx.radio(); this.e.say?.(text, { who: voice }); }
  // ----- frame -----
  update(dtRaw) {
    const inp = this.e.input; let dt = dtRaw;
    if (this.slowT > 0) { this.slowT -= dtRaw; dt *= 0.35; }
    if (this.state === 'end') { dt *= this.outro ? 0.6 : 0.4; this.endT -= dtRaw; if (this.endT <= 0 && !this.reported) { this.reported = true; this.e.emit('result', this.result); } }
    this.time += dt;
    for (let i = this.pending.length - 1; i >= 0; i--) if (this.time >= this.pending[i].t) this.pending.splice(i, 1)[0].f();
    const fade = this.e.dom.fade; if (fade) fade.style.opacity = String(clamp(1 - this.time / 1.6, 0, 1));
    const P = this.player;
    if (this.state === 'intro') { this.introT += dtRaw; this.flyIntro(dt); if (this.introT > 9.5 || inp.pressed.has('Space') || inp.pressed.has('Enter')) { this.introT = 99; this.startCombat(); } }
    else if (this.state === 'eva') this.updateEva(dt);
    else if (this.state === 'play' || this.state === 'end') { if (this.state === 'play') this.controls(dt, inp); this.phaseCheck(); }
    for (const sh of this.ships) { if (!sh.isPlayer || this.state !== 'play') this.ai(sh, dt); this.integrate(sh, dt); }
    this.updateBolts(dt); this.updateFx(dt);
    this.station.userData.ring.rotation.x += dt * 0.231;
    this.mars.rotation.x += dt * 0.000887;
    this.updateCamera(dtRaw, dt);
    this.updateHud(dtRaw);
    inp.pressed.clear();
    const e = this.e.sfx; e.hum?.(this.state === 'eva' ? 0.01 : 0.025 + P.throttle * 0.03);
  }
  flyIntro(dt) {
    const P = this.player, t = this.introT;
    // launch: slide out of the hub bay along +X, then light the engines
    P.throttle = t < 2.2 ? 0.08 : t < 4 ? 0.6 : 0.9;
    const f = this.fwd(P); P.vel.lerp(_b.copy(f).multiplyScalar(t < 2.2 ? 14 : t < 4 ? 70 : 140), 1 - Math.exp(-1.6 * dt));
  }
  controls(dt, inp) {
    const P = this.player, D = P.D, sens = (this.opts.sens ?? 1) * 0.0032, inv = this.opts.invertY ? -1 : 1;
    if (P.disabled) { P.throttle = 0; return; }
    P.stick.x = clamp(P.stick.x + inp.dx * sens, -1, 1); P.stick.y = clamp(P.stick.y - inp.dy * sens * inv, -1, 1);
    const cen = Math.exp(-1.4 * dt); P.stick.x *= cen; P.stick.y *= cen;
    const k = inp.keys; P.rollIn = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
    if (k.has('KeyW')) P.throttle = Math.min(1, P.throttle + dt * 0.6); if (k.has('KeyS')) P.throttle = Math.max(0, P.throttle - dt * 0.6);
    P.boosting = k.has('ShiftLeft') || k.has('ShiftRight');
    if (inp.pressed.has('KeyF')) { P.assist = !P.assist; this.toast(P.assist ? 'Flight assist on' : 'Flight assist off. Pure inertia'); }
    if (inp.pressed.has('Digit1')) this.shiftPower('eng'); if (inp.pressed.has('Digit2')) this.shiftPower('wpn'); if (inp.pressed.has('Digit3')) this.shiftPower('shd');
    if (inp.pressed.has('Tab') || inp.pressed.has('KeyT')) this.cycleTarget();
    if (inp.pressed.has('KeyV')) { this.view = { tp: 'fp', fp: 'cine', cine: 'tp' }[this.view]; this.cine = null; this.e.emit('view', this.view === 'cine' ? 'cine' : this.view); }
    if (inp.pressed.has('KeyX') && this.target) { P.matchT = true; this.toast('Matching target speed'); }
    if (P.matchT && (!this.target || k.has('KeyW') || k.has('KeyS'))) P.matchT = false;
    // weapons
    const wp = 0.5 + P.power.wpn / 4; P.gunT -= dt * wp; P.heat = Math.max(0, P.heat - dt * (0.25 + P.power.wpn * 0.06));
    if (inp.lmb && P.gunT <= 0 && P.heat < 1) { P.gunT = D.rof; P.heat += 0.03; this.fireGuns(P); }
    const T = this.target, f = this.fwd(P);
    if (T && T.alive && P.missiles > 0) { _b.subVectors(T.pos, P.pos); const d = _b.length(), ang = f.angleTo(_b); if (ang < 0.2 && d < 2200) { const was = P.lockT >= 1; P.lockT += dt; if (!was && P.lockT >= 1) this.e.sfx.lock(); } else P.lockT = Math.max(0, P.lockT - dt * 2); } else P.lockT = 0;
    if (inp.pressed.has('rmb') && P.lockT >= 1 && P.missiles > 0) { P.missiles--; this.fireMissile(P, T); }
    // boarding
    const B = this.boardable(); P.prompt = B ? (B.ok ? `Hold E to EVA across to the ${B.s.D.name}` : B.why) : null;
    if (B?.ok && k.has('KeyE')) { P.boardT = (P.boardT || 0) + dt; if (P.boardT > 1.0) this.startEva(B.s); } else P.boardT = 0;
  }
  shiftPower(to) { const p = this.player.power; if (p[to] >= 4) return; const from = Object.keys(p).filter((x) => x !== to && p[x] > 0).sort((a, b) => p[b] - p[a])[0]; if (!from) return; p[from]--; p[to]++; this.e.sfx.ui(); }
  cycleTarget() {
    const P = this.player, list = this.ships.filter((s) => s !== P && s.alive && (s.faction === 'darken' || s.abandoned)).sort((a, b) => a.pos.distanceTo(P.pos) - b.pos.distanceTo(P.pos));
    if (!list.length) { this.target = null; return; } const i = list.indexOf(this.target); this.target = list[(i + 1) % list.length]; this.e.sfx.ui(); this.player.lockT = 0;
  }
  boardable() {
    const P = this.player; let best = null;
    for (const s of this.ships) { if (s === P || !s.alive || !(s.disabled || s.abandoned)) continue; const d = s.pos.distanceTo(P.pos); if (d < 260 && (!best || d < best.d)) best = { s, d }; }
    if (!best) return null; const rv = _c.subVectors(best.s.vel, P.vel).length();
    if (best.d > 80) return { s: best.s, ok: false, why: `${best.s.D.name} disabled. Close to 80 m (${Math.round(best.d)} m)` };
    if (rv > 14) return { s: best.s, ok: false, why: `Match speed: ${Math.round(rv)} m/s apart. Press X` };
    return { s: best.s, ok: true };
  }
  // ----- flight model -----
  integrate(sh, dt) {
    const D = sh.D, f = this.fwd(sh, new V3());
    if (sh.alive && !sh.disabled && !sh.abandoned) {
      const eng = sh.isPlayer ? 0.6 + sh.power.eng * 0.15 : 1, boost = sh.boosting ? D.boost : 1;
      const vmax = D.vmax * eng * boost, acc = D.accel * eng * boost;
      if (sh.isPlayer && sh.matchT && this.target) { const tv = this.target.vel; sh.vel.lerp(tv, 1 - Math.exp(-1.5 * dt)); sh.throttle = clamp(tv.length() / vmax, 0, 1); }
      else if (!sh.isPlayer || sh.assist !== false) { const want = _b.copy(f).multiplyScalar(sh.throttle * vmax); sh.vel.lerp(want, 1 - Math.exp(-(acc / Math.max(40, vmax)) * dt * 1.6)); }
      else sh.vel.addScaledVector(f, sh.throttle * acc * dt);
      if (sh.vel.length() > 420) sh.vel.setLength(420);
      // rotation: body rates from stick (player) or ai.turn
      let px, yw, rl; if (sh.isPlayer && this.state === 'play') { px = -sh.stick.y; yw = -sh.stick.x; rl = (sh.rollIn || 0) + sh.stick.x * 0.35; } else { px = sh.ai.px || 0; yw = sh.ai.yw || 0; rl = sh.ai.rl || 0; }
      const tr = D.turn * (sh.boosting ? 0.75 : 1);
      sh.w.x = damp(sh.w.x, px * tr, 7, dt); sh.w.y = damp(sh.w.y, yw * tr, 7, dt); sh.w.z = damp(sh.w.z, rl * D.roll, 7, dt);
    } else { sh.w.multiplyScalar(Math.exp(-0.15 * dt)); if (sh.disabled && !sh.spun) { sh.spun = true; sh.w.set((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.8); } }
    _q.setFromEuler(new THREE.Euler(sh.w.x * dt, sh.w.y * dt, sh.w.z * dt, 'XYZ')); sh.q.multiply(_q).normalize();
    sh.pos.addScaledVector(sh.vel, dt);
    sh.obj.position.copy(sh.pos); sh.obj.quaternion.copy(sh.q);
    // shields regen
    const sr = sh.isPlayer ? 4 + sh.power.shd * 5 : 6; if (sh.alive) sh.shield = Math.min(D.shield * (sh.isPlayer ? 0.6 + sh.power.shd * 0.15 : 1), sh.shield + sr * dt * (sh.hitT > 0 ? 0 : 1)); sh.hitT = Math.max(0, (sh.hitT || 0) - dt);
    // engine glow
    const on = sh.alive && !sh.disabled && !sh.abandoned, th = on ? sh.throttle * (sh.boosting ? 1.4 : 1) : 0;
    for (const n of sh.obj.userData.noz) n.material.color.setScalar(1).multiplyScalar(0.25 + th);
    for (const p of sh.obj.userData.plumes) { p.visible = th > 0.05; p.scale.set(1, 0.2 + th * (0.55 + Math.random() * 0.1), 1); p.material.opacity = 0.05 + th * 0.16; }
    if (sh.disabled && sh.alive && Math.random() < dt * 6) this.spark(sh.pos.clone().add(_b.set((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 6)), 0.6);
    // trail
    sh.trT -= dt; if (sh.trT <= 0) { sh.trT = 0.05; _b.set(0, 0, -6).applyQuaternion(sh.q).add(sh.pos); sh.tr.unshift(_b.clone()); if (sh.tr.length > 40) sh.tr.pop(); const a = sh.trail.geometry.attributes.position; for (let i = 0; i < 40; i++) { const p = sh.tr[Math.min(i, sh.tr.length - 1)] || sh.pos; a.setXYZ(i, p.x, p.y, p.z); } a.needsUpdate = true; sh.trail.material.opacity = on ? 0.12 + th * 0.3 : 0; }
  }
  ai(sh, dt) {
    if (!sh.alive || sh.disabled || sh.abandoned) { sh.throttle = 0; return; }
    const P = this.player, D = sh.D, f = this.fwd(sh, new V3()); let want;
    const foe = sh.faction === 'darken' ? (P.alive ? P : null) : this.ships.find((s) => s.faction === 'darken' && s.alive && !s.disabled);
    if (sh.isPlayer && this.state === 'intro') { sh.ai.px = sh.ai.yw = sh.ai.rl = 0; return; }
    if (sh.ai.mode === 'flee') { want = _b.set(0.3, 0.15, 1).normalize(); sh.throttle = 0.85; }
    else if (!foe) { want = f.clone(); sh.throttle = 0.5; }
    else {
      const to = _b.subVectors(foe.pos, sh.pos), d = to.length(); sh.ai.t -= dt;
      if (sh.ai.mode === 'attack' && d < 160) { sh.ai.mode = 'break'; sh.ai.t = 2.5 + Math.random() * 2; sh.ai.dir = new V3((Math.random() - 0.5), (Math.random() - 0.5) * 0.6, (Math.random() - 0.5)).normalize(); }
      if (sh.ai.mode === 'break' && sh.ai.t <= 0) sh.ai.mode = 'attack';
      if (sh.ai.mode === 'break') { want = sh.ai.dir.clone().addScaledVector(f, 0.4).normalize(); sh.throttle = 1; sh.boosting = true; }
      else { const lead = _c.copy(foe.pos).addScaledVector(_c.copy(foe.vel).sub(sh.vel), d / 1100); want = lead.copy(foe.pos).addScaledVector(foe.vel, d / 900).sub(sh.pos).normalize(); sh.throttle = d > 700 ? 1 : 0.7; sh.boosting = d > 1400; }
      if (D.guns && sh.ai.mode === 'attack') { sh.gunT -= dt; if (f.angleTo(want) < 0.09 && d < 950 && sh.gunT <= 0) { sh.gunT = D.rof * (1.2 + Math.random()); this.fireGuns(sh); } }
      if (sh.missiles > 0 && d < 1800 && f.angleTo(to) < 0.25) { sh.mslT -= dt; if (sh.mslT <= 0) { sh.mslT = 9 + Math.random() * 6; sh.missiles--; this.fireMissile(sh, foe); } }
    }
    // steer: convert wanted direction into body rates
    const inv = _q2.copy(sh.q).invert(), loc = _c.copy(want).applyQuaternion(inv);
    sh.ai.px = clamp(-loc.y * 3, -1, 1); sh.ai.yw = clamp(loc.x * 3, -1, 1); if (loc.z < 0) sh.ai.yw = loc.x >= 0 ? 1 : -1;
    sh.ai.rl = clamp(-sh.ai.yw * 0.6, -1, 1) * 0.8;
  }
  // ----- weapons -----
  fireGuns(sh) {
    const f = this.fwd(sh, new V3()), uni = sh.faction === 'union';
    for (const m of sh.obj.userData.muz.length ? sh.obj.userData.muz : [new V3(0, 0, 8)]) {
      const p = m.clone().applyQuaternion(sh.q).add(sh.pos), b = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 7, 5), new THREE.MeshBasicMaterial({ color: uni ? 0xbfe0ff : 0xff7a4a, toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      b.quaternion.setFromUnitVectors(UPV, f); b.position.copy(p); this.scene.add(b);
      this.bolts.push({ mesh: b, pos: p, vel: f.clone().multiplyScalar(1100).add(sh.vel), t: 1.6, owner: sh, dmg: sh.D.gunDmg * (sh.isPlayer ? 0.6 + sh.power.wpn * 0.15 : this.diff()) });
    }
    if (sh.isPlayer) { this.stats.shots++; this.e.sfx.cannon(); this.shake = Math.max(this.shake, 0.06); } else this.e.sfx.bolt(sh.pos.distanceTo(this.camPos) * 0.2);
  }
  diff() { return { Recruit: 0.55, Veteran: 1, Elite: 1.4 }[this.opts.difficulty] ?? 1; }
  fireMissile(sh, tgt) {
    const f = this.fwd(sh, new V3()), p = sh.pos.clone().addScaledVector(f, 4).add(_b.set(0, -1.2, 0).applyQuaternion(sh.q));
    const g = new THREE.Group(); add(g, new THREE.CylinderGeometry(0.16, 0.16, 2.2, 8), M().white, 0, 0, 0, Math.PI / 2); const fl = add(g, new THREE.ConeGeometry(0.3, 3.5, 10, 1, true), plume(0xffd29a), 0, 0, -2.8, -Math.PI / 2); g.position.copy(p); this.scene.add(g);
    this.bolts.push({ mesh: g, pos: p, vel: f.clone().multiplyScalar(160).add(sh.vel), t: 9, owner: sh, dmg: sh.isPlayer ? 120 : 40 * this.diff(), missile: true, tgt, flame: fl });
    this.e.sfx.missile(sh.isPlayer ? 0 : sh.pos.distanceTo(this.camPos) * 0.2);
    if (tgt?.isPlayer) { this.toast('Missile lock on you. Break!'); this.e.sfx.alarm(); }
  }
  updateBolts(dt) {
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i]; b.t -= dt;
      if (b.missile) { if (b.tgt?.alive) { const want = _b.subVectors(b.tgt.pos, b.pos).normalize(), v = b.vel.length(); b.vel.lerp(want.multiplyScalar(Math.min(520, v + 260 * dt)), 1 - Math.exp(-2.2 * dt)); } b.mesh.quaternion.setFromUnitVectors(FWD, _c.copy(b.vel).normalize()); b.flame.scale.y = 0.7 + Math.random() * 0.5; }
      const step = _c.copy(b.vel).multiplyScalar(dt), from = b.pos.clone(); b.pos.add(step); b.mesh.position.copy(b.pos);
      let hit = null;
      for (const s of this.ships) { if (!s.alive || s === b.owner || (s.faction === b.owner.faction && !s.abandoned)) continue; const r = s.kind === 'courier' ? 12 : 7.5; if (segDist(from, b.pos, s.pos) < r) { hit = s; break; } }
      if (!hit && b.pos.distanceTo(this.station.position) < 160 && Math.abs(b.pos.x) < 140 && Math.abs(b.pos.y) < 20 && Math.abs(b.pos.z) < 20) b.t = 0;
      if (hit) { this.damage(hit, b.dmg, b.owner, b.missile); b.t = 0; this.spark(b.pos.clone(), b.missile ? 2.5 : 0.8); }
      if (b.t <= 0) { this.scene.remove(b.mesh); b.mesh.traverse((o) => { o.geometry?.dispose(); }); this.bolts.splice(i, 1); }
    }
  }
  damage(s, dmg, by, missile) {
    s.hitT = 1.2; s.lastHitBy = by;
    const sd = Math.min(s.shield, dmg); s.shield -= sd; dmg -= sd; s.hull -= dmg;
    if (by?.isPlayer) { this.stats.hits++; this.hitMark = 0.15; this.e.sfx.hit(); }
    if (s.isPlayer) { this.shake = Math.max(this.shake, missile ? 0.9 : 0.25); this.dmgFlash = 0.4; this.e.sfx.hurt(); }
    if (s === this.courier) s.hull = Math.max(s.hull, s.D.hull * 0.08);
    const cap = s.D.hull * 0.35;
    if (!s.disabled && s.hull < cap && s.hull > 0 && !missile && s.faction === 'darken') { s.disabled = true; s.throttle = 0; this.stats.disabled++; if (by?.isPlayer) { this.score += 250; this.toast(`${s.D.name} engines out. Board it or finish it`); this.e.sfx.lock(); } }
    if (s.hull <= 0 && s.alive) this.kill(s, by);
  }
  kill(s, by) {
    s.alive = false; this.explode(s.pos.clone(), s.kind === 'courier' ? 3 : 1.4, s.vel); this.scene.remove(s.obj); s.trail.visible = false;
    if (by?.isPlayer && s.faction === 'darken') { this.stats.kills++; this.score += 150; this.slowT = 0.7; this.toast(`${s.D.name} destroyed`); }
    if (s === this.target) this.target = null;
    if (s.isPlayer) { this.finish(false, 'Shot down', 'Your Kestrel broke up. The Ring lost the courier.'); this.dmgFlash = 1; }
  }
  // ----- EVA hijack -----
  startEva(t) {
    const P = this.player; this.state = 'eva'; this.eva = { from: P, to: t, t: 0 };
    this.evaFig = makePilot(undefined, undefined, { armed: false }); this.scene.add(this.evaFig.root); this.evaFig.root.scale.setScalar(1);
    this.say('Kestrel One', `Going across to the ${t.D.name}.`, 'pilot'); this.e.sfx.servo(); this.letterK = 1;
  }
  updateEva(dt) {
    const E = this.eva, A = E.from, B = E.to; E.t += dt; const k = clamp(E.t / 3.4, 0, 1), s = k * k * (3 - 2 * k);
    A.throttle = 0; B.vel.lerp(A.vel, 1 - Math.exp(-2 * dt));
    const a = _a.copy(A.obj.userData.cockpit).applyQuaternion(A.q).add(A.pos), b = _b.copy(B.obj.userData.cockpit).applyQuaternion(B.q).add(B.pos), mid = a.clone().lerp(b, 0.5).add(_c.set(0, 6, 0));
    const p = a.clone().lerp(mid, s).lerp(mid.clone().lerp(b, s), s), fig = this.evaFig;
    fig.root.position.copy(p); fig.root.lookAt(b); fig.animate(this.time, 0, true, k > 0.1 && k < 0.9, { pitch: 0 });
    if (A.obj.userData.canopy) A.obj.userData.canopy.rotation.x = -Math.min(1, E.t * 1.5) * 0.9;
    if (E.t > 2.6 && !E.ejected) { E.ejected = true; this.ejectEnemy(B); }
    if (E.t > 3.6) {
      this.scene.remove(fig.root); this.evaFig = null; if (A.obj.userData.canopy) A.obj.userData.canopy.rotation.x = 0;
      A.isPlayer = false; A.abandoned = true; A.throttle = 0;
      B.isPlayer = true; B.faction = 'union'; B.disabled = false; B.abandoned = false; B.spun = false; B.w.set(0, 0, 0); B.hull = Math.max(B.hull, B.D.hull * 0.4); B.shield = 0;
      Object.assign(B, { throttle: 0, assist: true, power: { ...A.power }, stick: { x: 0, y: 0 }, lockT: 0, heat: 0, missiles: B.missiles ?? 0 });
      B.trail.material.color.set(0x9fc8ff); this.player = B; this.target = null; this.stats.stolen++; this.score += 600; this.state = 'play';
      this.toast(`${B.D.name} is yours. Engines restart`); this.e.sfx.clunk?.();
    }
  }
  ejectEnemy(s) { const fig = makePilot(0x6b6a66, 0x8a3a24, { armed: false }); fig.root.position.copy(s.pos).add(_a.set(0, 3, 0)); this.scene.add(fig.root); this.fx.push({ kind: 'drifter', obj: fig.root, vel: new V3((Math.random() - 0.5) * 6, 5, (Math.random() - 0.5) * 6).add(s.vel), spin: new V3(1.2, 0.6, 0.8), t: 12, fig }); this.toast('Darken pilot forced out'); }
  // ----- effects -----
  spark(p, size = 1) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.flashTex, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, color: 0xffd8a8 })); sp.position.copy(p); sp.scale.setScalar(4 * size); this.scene.add(sp); this.fx.push({ kind: 'flash', obj: sp, t: 0.25, t0: 0.25, s0: 4 * size }); }
  explode(p, size, vel) {
    const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.flashTex, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); fl.position.copy(p); this.scene.add(fl); this.fx.push({ kind: 'flash', obj: fl, t: 0.6, t0: 0.6, s0: 60 * size, grow: true, vel: vel.clone() });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffc89a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })); ring.position.copy(p); ring.lookAt(this.camPos); this.scene.add(ring); this.fx.push({ kind: 'ring', obj: ring, t: 1.1, t0: 1.1, s0: 70 * size, vel: vel.clone() });
    const m = M();
    for (let i = 0; i < 18 * size; i++) { const d = new THREE.Mesh(new THREE.BoxGeometry(0.4 + Math.random() * 1.4, 0.2 + Math.random() * 0.6, 0.4 + Math.random() * 1.2), Math.random() < 0.5 ? m.dark : m.dred); d.position.copy(p); this.scene.add(d); this.fx.push({ kind: 'debris', obj: d, vel: new V3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(20 + Math.random() * 60).add(vel), spin: new V3(Math.random() * 4, Math.random() * 4, Math.random() * 4), t: 6 }); }
    for (let i = 0; i < 10 * size; i++) { const v = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.flashTex, color: 0x9aa0a8, transparent: true, opacity: 0.35, depthWrite: false })); v.position.copy(p); this.scene.add(v); this.fx.push({ kind: 'vapour', obj: v, vel: new V3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(30).add(vel), t: 2.2, t0: 2.2, s0: 10 + Math.random() * 14 }); }
    const d = p.distanceTo(this.camPos); this.e.sfx.boom(size, d * 0.15); this.shake = Math.max(this.shake, clamp(1.2 - d / 900, 0, 1));
  }
  updateFx(dt) {
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i]; f.t -= dt; const o = f.obj, k = f.t0 ? 1 - f.t / f.t0 : 0;
      if (f.vel) o.position.addScaledVector(f.vel, dt);
      if (f.kind === 'flash') { o.scale.setScalar(f.s0 * (f.grow ? 0.4 + k : 1 - k * 0.5)); o.material.opacity = 1 - k; }
      else if (f.kind === 'ring') { o.scale.setScalar(1 + f.s0 * k); o.material.opacity = (1 - k) * 0.7; }
      else if (f.kind === 'vapour') { o.scale.setScalar(f.s0 * (0.5 + k)); o.material.opacity = 0.35 * (1 - k); }
      else if (f.kind === 'debris' || f.kind === 'drifter') { o.rotation.x += f.spin.x * dt; o.rotation.y += f.spin.y * dt; o.rotation.z += f.spin.z * dt; if (f.fig) f.fig.animate(this.time, 0, true, false, {}); }
      if (f.t <= 0) { this.scene.remove(o); this.fx.splice(i, 1); }
    }
  }
  // ----- camera -----
  updateCamera(dtRaw, dt) {
    const P = this.player, cam = this.camera, c = this.camPos;
    let fov = 62 + clamp(P.vel.length() / 40, 0, 6) + (P.boosting ? 8 : 0);
    if (this.state === 'intro') {
      const t = this.introT;
      if (t < 3.4) { const k = t / 3.4; c.set(260 - k * 40, 120 - k * 20, 330 - k * 50); cam.position.copy(c); cam.lookAt(_b.set(20, -40, 0)); fov = 42; }
      else if (t < 6.4) { _a.set(-3.5, -3.2, -24).applyQuaternion(P.q).add(P.pos); c.copy(_a); cam.position.copy(c); cam.up.set(0, 1, 0); cam.lookAt(_b.copy(P.pos).addScaledVector(this.fwd(P, _c), 30)); fov = 50; }
      else { const k = (t - 6.4) / 3; _a.set(34 - k * 10, 7, 14 - k * 30).applyQuaternion(P.q).add(P.pos); c.copy(_a); cam.position.copy(c); cam.lookAt(P.pos); fov = 40; }
      this.camQ.copy(P.q);
    } else if (this.state === 'eva') {
      const E = this.eva, mid = _a.copy(E.from.pos).lerp(E.to.pos, 0.5), side = _b.subVectors(E.to.pos, E.from.pos).cross(UPV).normalize();
      const fp = this.evaFig ? this.evaFig.root.position : mid; c.lerp(_c.copy(fp).addScaledVector(side, 30).add(_b.set(0, 8, 0)), 1 - Math.exp(-3 * dtRaw)); cam.position.copy(c); cam.lookAt(fp); fov = 46;
    } else if (this.state === 'end' && this.outro) {
      _a.copy(this.station.position).add(_b.set(120, 40, 160)); c.lerp(_a, 1 - Math.exp(-0.8 * dtRaw)); cam.position.copy(c); cam.lookAt(P.pos); fov = 44;
    } else {
      this.camQ.slerp(P.q, 1 - Math.exp(-(this.view === 'fp' ? 30 : 5.5) * dtRaw));
      const big = P.kind === 'courier' ? 2.4 : 1;
      if (this.view === 'fp') c.copy(P.obj.userData.cockpit).applyQuaternion(P.q).add(P.pos);
      else if (this.view === 'cine') { if (!this.cine || this.cine.t <= 0 || c.distanceTo(P.pos) > 420) { const f = this.fwd(P, _a); this.cine = { t: 5, p: P.pos.clone().addScaledVector(f, 220 + P.vel.length() * 1.2).add(_b.set((Math.random() - 0.5) * 120, 20 + Math.random() * 40, (Math.random() - 0.5) * 120)) }; } this.cine.t -= dtRaw; c.copy(this.cine.p); fov = 42; }
      else c.copy(_a.set(0, 5.2 * big, -25 * big).applyQuaternion(this.camQ)).add(P.pos);
      cam.position.copy(c);
      if (this.view === 'cine') cam.lookAt(P.pos); else { cam.quaternion.copy(this.camQ).multiply(_q.setFromAxisAngle(UPV, Math.PI)); if (this.view === 'tp') cam.rotateX(-0.11); }
    }
    if (this.shake > 0) { const s = this.shake * 0.6; cam.position.add(_a.set((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s)); this.shake = Math.max(0, this.shake - dtRaw * 1.8); }
    if (Math.abs(cam.fov - fov) > 0.05) { cam.fov = damp(cam.fov, fov, 4, dtRaw); cam.updateProjectionMatrix(); }
    for (const sh of this.ships) sh.obj.visible = sh.alive && !(sh.isPlayer && this.view === 'fp' && this.state === 'play');
    this.bg.position.copy(cam.position);
    // dust streaks
    const a = this.dust.geometry.attributes.position, v = _b.copy(P.vel).multiplyScalar(0.045);
    for (let i = 0; i < this.dustN; i++) { const p = this.dustP[i]; if (p.distanceTo(cam.position) > 160) { p.copy(cam.position).add(_c.set((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2).normalize().multiplyScalar(40 + Math.random() * 110)); if (P.vel.lengthSq() > 4) p.addScaledVector(_c.copy(P.vel).normalize(), 90); }
      a.setXYZ(i * 2, p.x, p.y, p.z); a.setXYZ(i * 2 + 1, p.x - v.x, p.y - v.y, p.z - v.z); }
    a.needsUpdate = true; this.dust.material.opacity = clamp(P.vel.length() / 260, 0.05, 0.45);
  }
  resize(w, h) { this.w = w; this.h = h; this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  // ----- HUD -----
  buildHud() {
    const L = this.e.dom.layer, R = this.hud = {}; R.root = div(L, 'position:absolute;inset:0;pointer-events:none;color:#f2f2f3;font-family:var(--font-body)');
    R.lbT = div(R.root, 'position:absolute;left:0;right:0;top:0;height:0;background:#030405;transition:height .6s'); R.lbB = div(R.root, 'position:absolute;left:0;right:0;bottom:0;height:0;background:#030405;transition:height .6s');
    R.title = div(R.root, 'position:absolute;left:56px;bottom:16vh;display:flex;flex-direction:column;gap:6px;opacity:0;transition:opacity .8s', `<span style="${KICK}">Low Mars orbit · 400 km · Ares Ring</span><span style="font-family:var(--font-heading);font-weight:600;font-size:56px;line-height:.95">${this.L.title}</span><span style="font-size:14px;color:rgba(242,242,243,.8)">Space or Enter skips</span>`);
    R.ret = div(R.root, 'position:absolute;left:50%;top:50%;width:0;height:0', '<svg width="64" height="64" viewBox="-32 -32 64 64" style="position:absolute;left:-32px;top:-32px;overflow:visible"><circle r="15" fill="none" stroke="rgba(242,242,243,.75)" stroke-width="1.2"/><path d="M-26 0h7M19 0h7M0 -26v7M0 19v7" stroke="#f2f2f3" stroke-width="1.6"/><circle r="1.6" fill="#f2f2f3"/></svg>');
    R.stick = div(R.root, 'position:absolute;left:0;top:0;width:10px;height:10px;margin:-5px 0 0 -5px;border:1.5px solid #b5d9fd;border-radius:50%');
    R.hitm = div(R.root, 'position:absolute;left:50%;top:50%;width:0;height:0;opacity:0', '<svg width="40" height="40" viewBox="0 0 40 40" style="position:absolute;left:-20px;top:-20px"><path d="M8 8l7 7M32 8l-7 7M8 32l7-7M32 32l-7-7" stroke="#f2f2f3" stroke-width="2"/></svg>');
    R.box = div(R.root, 'position:absolute;left:0;top:0;display:none'); R.boxSvg = div(R.box, 'position:absolute;left:0;top:0'); R.boxTxt = div(R.box, 'position:absolute;left:0;top:0;white-space:nowrap;font-family:var(--font-heading);font-weight:600;font-size:12px;letter-spacing:.1em;text-transform:uppercase');
    R.lead = div(R.root, 'position:absolute;left:0;top:0;width:12px;height:12px;margin:-6px 0 0 -6px;border:1.5px solid #ff8a5a;transform:rotate(45deg);display:none');
    R.arrow = div(R.root, 'position:absolute;left:0;top:0;width:0;height:0;display:none', '<svg width="28" height="28" viewBox="-14 -14 28 28" style="position:absolute;left:-14px;top:-14px"><path d="M-8 -8L10 0L-8 8Z" fill="#ff8a5a"/></svg>');
    R.marks = [];
    R.obj = div(R.root, PANEL + ';left:24px;top:24px;width:300px;display:flex;flex-direction:column;gap:4px');
    R.tgt = div(R.root, PANEL + ';right:24px;top:24px;width:250px;display:none;flex-direction:column;gap:6px');
    R.left = div(R.root, PANEL + ';left:24px;bottom:24px;width:230px;display:flex;flex-direction:column;gap:8px');
    R.mid = div(R.root, PANEL + ';left:50%;bottom:24px;transform:translateX(-50%);display:flex;gap:16px;align-items:flex-end');
    R.right = div(R.root, PANEL + ';right:24px;bottom:24px;width:230px;display:flex;flex-direction:column;gap:8px');
    R.prompt = div(R.root, PANEL + ';left:50%;bottom:132px;transform:translateX(-50%);display:none;font-size:15px;white-space:nowrap');
    R.sub = div(R.root, 'position:absolute;left:50%;bottom:184px;transform:translateX(-50%);max-width:640px;text-align:center;font-size:16px;line-height:1.4;padding:6px 12px;background:rgba(3,4,5,.6);display:none');
    R.toast = div(R.root, 'position:absolute;left:50%;top:30%;transform:translateX(-50%);font-family:var(--font-heading);font-weight:600;font-size:18px;letter-spacing:.08em;text-transform:uppercase;opacity:0;transition:opacity .25s;text-shadow:0 1px 8px rgba(0,0,0,.6)');
    R.dmg = div(R.root, 'position:absolute;inset:0;box-shadow:inset 0 0 160px 30px rgba(255,80,40,.7);opacity:0');
    this.hudT = 0;
  }
  toast(t) { const T = this.hud?.toast; if (!T) return; T.textContent = t; T.style.opacity = '1'; clearTimeout(this.toastTm); this.toastTm = setTimeout(() => { T.style.opacity = '0'; }, 2200); }
  proj(p) { _a.copy(p).project(this.camera); return { x: (_a.x * 0.5 + 0.5) * this.w, y: (-_a.y * 0.5 + 0.5) * this.h, z: _a.z, on: _a.z < 1 && Math.abs(_a.x) < 1 && Math.abs(_a.y) < 1 }; }
  updateHud(dt) {
    const R = this.hud, P = this.player, cin = this.state === 'intro' || this.state === 'eva' || (this.state === 'end' && this.outro), play = this.state === 'play';
    R.lbT.style.height = R.lbB.style.height = cin ? '10vh' : '0';
    R.title.style.opacity = this.state === 'intro' && this.introT > 1 && this.introT < 7.5 ? '1' : '0';
    for (const el of [R.ret, R.stick, R.obj, R.left, R.mid, R.right]) el.style.visibility = play ? 'visible' : 'hidden';
    R.stick.style.transform = `translate(${(this.w / 2 + P.stick.x * 90) | 0}px,${(this.h / 2 - P.stick.y * 90) | 0}px)`;
    this.hitMark = Math.max(0, (this.hitMark || 0) - dt); R.hitm.style.opacity = String(this.hitMark > 0 ? 1 : 0);
    this.dmgFlash = Math.max(0, (this.dmgFlash || 0) - dt * 1.5); R.dmg.style.opacity = String(Math.min(0.8, this.dmgFlash + (P.hull / P.D.hull < 0.25 ? 0.25 + Math.sin(this.time * 6) * 0.1 : 0)));
    // target box, lead pip, off-screen arrow
    const T = this.target && this.target.alive ? this.target : null;
    if (T && play) {
      const q = this.proj(T.pos), d = T.pos.distanceTo(P.pos), col = T.abandoned ? '#b5d9fd' : T.disabled ? '#ffd29a' : '#ff8a5a';
      if (q.on) { const s = clamp(2600 / Math.max(1, d), 26, 120) * (T.kind === 'courier' ? 1.6 : 1), lk = P.lockT >= 1;
        R.box.style.display = 'block'; R.box.style.transform = `translate(${(q.x - s / 2) | 0}px,${(q.y - s / 2) | 0}px)`; R.arrow.style.display = 'none';
        R.boxSvg.innerHTML = `<svg width="${s}" height="${s}" style="overflow:visible"><path d="M0 9V0H9M${s - 9} 0H${s}V9M${s} ${s - 9}V${s}H${s - 9}M9 ${s}H0V${s - 9}" fill="none" stroke="${col}" stroke-width="${lk ? 2.5 : 1.5}"/>${lk ? `<rect x="-5" y="-5" width="${s + 10}" height="${s + 10}" fill="none" stroke="${col}" stroke-dasharray="4 4"/>` : ''}</svg>`;
        R.boxTxt.style.transform = `translate(0px,${s + 6}px)`; R.boxTxt.style.color = col; R.boxTxt.textContent = `${T.D.name} · ${Math.round(d)} m${T.disabled ? ' · engines out' : T.abandoned ? ' · empty' : ''}${lk ? ' · locked' : ''}`;
        const lead = _b.copy(T.pos).addScaledVector(_c.subVectors(T.vel, P.vel), d / 1100), lq = this.proj(lead); R.lead.style.display = lq.on && !T.disabled ? 'block' : 'none'; R.lead.style.left = lq.x + 'px'; R.lead.style.top = lq.y + 'px';
      } else { R.box.style.display = 'none'; R.lead.style.display = 'none'; R.arrow.style.display = 'block'; let x = q.x - this.w / 2, y = q.y - this.h / 2; if (q.z > 1) { x = -x; y = -y; } const a = Math.atan2(y, x), r = Math.min(this.w, this.h) * 0.36; R.arrow.style.transform = `translate(${(this.w / 2 + Math.cos(a) * r) | 0}px,${(this.h / 2 + Math.sin(a) * r) | 0}px) rotate(${a}rad)`; }
    } else { R.box.style.display = 'none'; R.lead.style.display = 'none'; R.arrow.style.display = 'none'; }
    // hostile markers
    const hs = play ? this.ships.filter((s) => s.alive && s !== T && s !== P && (s.faction === 'darken' || s.abandoned)) : [];
    while (R.marks.length < hs.length) R.marks.push(div(R.root, 'position:absolute;left:0;top:0;white-space:nowrap;font-family:var(--font-heading);font-weight:600;font-size:11px;letter-spacing:.1em'));
    R.marks.forEach((m, i) => { const s = hs[i]; if (!s) { m.style.display = 'none'; return; } const q = this.proj(s.pos); if (!q.on) { m.style.display = 'none'; return; } m.style.display = 'block'; m.style.color = s.abandoned ? '#b5d9fd' : s.disabled ? '#ffd29a' : '#ff8a5a'; m.style.transform = `translate(${(q.x - 5) | 0}px,${(q.y - 5) | 0}px)`; m.innerHTML = `<span style="display:inline-block;width:8px;height:8px;border:1.5px solid currentColor;transform:rotate(45deg)"></span> ${Math.round(s.pos.distanceTo(P.pos))}`; });
    // subtitles
    if (this.sub) { this.sub.t -= dt; R.sub.style.display = this.sub.t > 0 ? 'block' : 'none'; R.sub.innerHTML = `<span style="${KICK};margin-right:8px">${this.sub.who}</span>${this.sub.text}`; }
    R.prompt.style.display = play && P.prompt ? 'block' : 'none'; if (P.prompt) R.prompt.innerHTML = P.prompt + (P.boardT > 0 ? ` <span style="display:inline-block;width:60px;height:4px;background:rgba(242,242,243,.2);vertical-align:middle;margin-left:6px"><span style="display:block;height:4px;width:${Math.round(P.boardT * 100)}%;background:#b5d9fd"></span></span>` : '');
    this.hudT -= dt; if (this.hudT > 0) return; this.hudT = 1 / 10;
    const bar = (v, c) => `<div style="height:5px;background:rgba(242,242,243,.16)"><div style="height:5px;width:${Math.round(clamp(v, 0, 1) * 100)}%;background:${c}"></div></div>`;
    const row = (k, v) => `<div style="display:flex;justify-content:space-between;font-size:13px"><span style="${KICK};color:rgba(242,242,243,.78)">${k}</span><span style="font-variant-numeric:tabular-nums">${v}</span></div>`;
    if (this.obj) R.obj.innerHTML = `<span style="${KICK}">Objective</span><span style="font-family:var(--font-heading);font-weight:600;font-size:22px;line-height:1.05">${this.obj.title}</span><span style="font-size:13px;color:rgba(242,242,243,.82)">${this.obj.sub()}</span>`;
    const spd = P.vel.length();
    R.left.innerHTML = `<span style="${KICK}">${P.D.name} · ${P.D.cls}</span><div style="display:flex;align-items:baseline;gap:6px"><span style="font-family:var(--font-heading);font-weight:600;font-size:40px;line-height:1;font-variant-numeric:tabular-nums">${Math.round(spd)}</span><span style="font-size:13px">m/s</span></div>${row('Throttle', Math.round(P.throttle * 100) + '%')}${bar(P.throttle, '#b5d9fd')}${row('Assist · F', P.assist ? 'On' : 'Off, inertia')}${row('View · V', { tp: 'Chase', fp: 'Cockpit', cine: 'Fly-by' }[this.view])}`;
    const pip = (k, n, key) => `<div style="display:flex;flex-direction:column;align-items:center;gap:4px"><div style="display:flex;flex-direction:column-reverse;gap:2px">${[0, 1, 2, 3].map((i) => `<div style="width:26px;height:6px;background:${i < n ? '#b5d9fd' : 'rgba(242,242,243,.16)'}"></div>`).join('')}</div><span style="${KICK};color:#f2f2f3">${k}</span><span style="font-size:11px;color:rgba(242,242,243,.7)">${key}</span></div>`;
    R.mid.innerHTML = `<div style="display:flex;flex-direction:column;gap:2px;margin-right:4px"><span style="${KICK}">Cell power</span><span style="font-size:12px;color:rgba(242,242,243,.75);max-width:110px;line-height:1.3">Split between engines, guns and shield</span></div>${pip('Eng', P.power.eng, '1')}${pip('Wpn', P.power.wpn, '2')}${pip('Shd', P.power.shd, '3')}`;
    R.right.innerHTML = `${row('Shield', Math.round(P.shield))}${bar(P.shield / P.D.shield, '#b5d9fd')}${row('Hull', Math.round(P.hull / P.D.hull * 100) + '%')}${bar(P.hull / P.D.hull, P.hull / P.D.hull < 0.3 ? '#ff8a5a' : '#8fe3a8')}${row('Cannon heat', Math.round(P.heat * 100) + '%')}${bar(P.heat, P.heat > 0.8 ? '#ff8a5a' : '#ffd29a')}${row('Missiles · RMB', P.missiles ?? 0)}`;
    if (T && play) { R.tgt.style.display = 'flex'; R.tgt.innerHTML = `<span style="${KICK};color:#ff8a5a">Target · Tab</span><span style="font-family:var(--font-heading);font-weight:600;font-size:22px">${T.D.name}</span><span style="font-size:12px;color:rgba(242,242,243,.8)">${T.D.cls}${T.disabled ? ' · engines out' : ''}</span>${row('Shield', Math.round(T.shield))}${bar(T.shield / T.D.shield, '#b5d9fd')}${row('Hull', Math.round(T.hull / T.D.hull * 100) + '%')}${bar(T.hull / T.D.hull, '#ff8a5a')}`; } else R.tgt.style.display = 'none';
  }
  dispose() {
    this.hud?.root.remove(); clearTimeout(this.toastTm);
    this.scene.traverse((o) => { o.geometry?.dispose?.(); });
  }
}
function segDist(a, b, p) { const ab = _b.subVectors(b, a), t = clamp(_c.subVectors(p, a).dot(ab) / Math.max(1e-6, ab.lengthSq()), 0, 1); return _c.copy(a).addScaledVector(ab, t).distanceTo(p); }
