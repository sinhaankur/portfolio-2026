// Colony infrastructure, laid out the way a methalox economy on Mars works:
// a fission reactor and solar blankets feed a propellant plant (CO2 + ice -> CH4 + O2),
// which fills cryo tanks, a Starship-class tanker, and the fuel cells every HAWC and rover runs on.
import { THREE } from './lib.js?v=22';

const S = (o) => new THREE.MeshStandardMaterial(o);
let M = null;
function mats() {
  if (M) return M;
  M = {
    steel: S({ color: 0xb9bcc0, metalness: 0.85, roughness: 0.32 }), stain: S({ color: 0xd4d6d8, metalness: 1, roughness: 0.22 }),
    dark: S({ color: 0x2c2e31, metalness: 0.6, roughness: 0.5 }), white: S({ color: 0xe4e2dc, roughness: 0.55, metalness: 0.1 }),
    tile: S({ color: 0x141517, roughness: 0.7, metalness: 0.2 }), solar: S({ color: 0x101a2e, metalness: 0.4, roughness: 0.22, emissive: 0x0a1530, emissiveIntensity: 0.2 }),
    frame: S({ color: 0x8d9095, metalness: 0.8, roughness: 0.4 }), berm: S({ color: 0x8a5a40, roughness: 1 }), concrete: S({ color: 0x9a8678, roughness: 0.95 }),
    hazard: S({ color: 0xe0b53a, roughness: 0.6 }), frost: S({ color: 0xf2f5f8, roughness: 0.8, metalness: 0 }), gold: S({ color: 0xc89a3a, metalness: 1, roughness: 0.25 }),
    radiator: S({ color: 0xdadcd8, metalness: 0.3, roughness: 0.4, side: THREE.DoubleSide }), red: new THREE.MeshBasicMaterial({ color: 0xff3a2a, toneMapped: false }),
    cell: new THREE.MeshBasicMaterial({ color: 0x7dffa0, toneMapped: false }), lamp: new THREE.MeshBasicMaterial({ color: 0xfff2d8, toneMapped: false }),
  };
  return M;
}
const box = (g, w, h, d, mat, x, y, z, ry = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = m.receiveShadow = true; g.add(m); return m; };
const cyl = (g, r1, r2, h, seg, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
const sph = (g, r, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
function pipe(g, pts, r, mat) {
  const c = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', 0.05);
  const m = new THREE.Mesh(new THREE.TubeGeometry(c, pts.length * 8, r, 8, false), mat); m.castShadow = true; g.add(m); return m;
}
const blinkers = [];
function blink(g, x, y, z, ph = 0) { const b = sph(g, 0.18, mats().red, x, y, z); b.castShadow = false; blinkers.push({ b, ph }); return b; }
export function animateInfra(t) { for (const k of blinkers) k.b.visible = ((t + k.ph) % 1.6) < 0.25; }
export function resetInfra() { blinkers.length = 0; }

// Kilopower-class fission reactor: core buried in a regolith berm, Stirling heads, umbrella radiator. ~10 kWe each.
export function reactor() {
  const m = mats(), g = new THREE.Group();
  const berm = new THREE.Mesh(new THREE.TorusGeometry(5.2, 1.6, 10, 36), m.berm); berm.rotation.x = Math.PI / 2; berm.scale.z = 0.7; berm.position.y = 0.3; berm.receiveShadow = true; g.add(berm);
  cyl(g, 1.1, 1.3, 1.6, 20, m.dark, 0, 0.8, 0); cyl(g, 0.55, 0.55, 3.4, 16, m.steel, 0, 2.6, 0);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4; const s = cyl(g, 0.28, 0.28, 0.9, 12, m.gold, Math.cos(a) * 0.75, 3.6, Math.sin(a) * 0.75); s.rotation.z = 0.3 * Math.cos(a); s.rotation.x = 0.3 * Math.sin(a); }
  const cone = new THREE.Mesh(new THREE.ConeGeometry(3.4, 4.2, 12, 1, true), m.radiator); cone.position.y = 6.6; cone.rotation.x = Math.PI; cone.castShadow = true; g.add(cone);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const r = box(g, 0.06, 4.3, 0.12, m.frame, Math.cos(a) * 1.75, 6.6, Math.sin(a) * 1.75, -a); r.rotation.z = Math.cos(a) * 0.68; r.rotation.x = -Math.sin(a) * 0.68; }
  cyl(g, 0.12, 0.12, 2.2, 8, m.frame, 0, 9.4, 0); blink(g, 0, 10.6, 0, Math.random());
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; cyl(g, 0.05, 0.05, 1.3, 5, m.hazard, Math.cos(a) * 8.5, 0.65, Math.sin(a) * 8.5); }
  const sign = box(g, 1.1, 0.8, 0.06, m.hazard, 0, 1.3, 8.6); const tre = new THREE.Mesh(new THREE.CircleGeometry(0.22, 3), m.dark); tre.position.set(0, 1.3, 8.64); g.add(tre);
  g.userData = { r: 7.5, kind: 'reactor' };
  return g;
}

// Roll-out solar blankets on low frames, an inverter box per row
export function solarField(rows = 4, len = 26, tilt = 0.25) {
  const m = mats(), g = new THREE.Group();
  for (let r = 0; r < rows; r++) {
    const z = (r - (rows - 1) / 2) * 5.2, row = new THREE.Group(); row.position.z = z; g.add(row);
    const p = box(row, len, 0.06, 3.6, m.solar, 0, 0.9, 0); p.rotation.x = -tilt; p.castShadow = true;
    for (let k = 0; k <= 6; k++) { const x = -len / 2 + k * len / 6; box(row, 0.12, 0.9, 0.12, m.frame, x, 0.45, 0.9); box(row, 0.12, 1.4, 0.12, m.frame, x, 0.7, -0.9); }
    for (let k = 1; k < 8; k++) box(row, 0.03, 0.08, 3.62, m.frame, -len / 2 + k * len / 8, 0.92, 0).rotation.x = -tilt;
    box(row, 1.1, 0.9, 0.8, m.white, len / 2 + 1.2, 0.45, 0);
  }
  pipe(g, [[len / 2 + 1.2, 0.2, -(rows - 1) * 2.6], [len / 2 + 3, 0.15, 0], [len / 2 + 1.2, 0.2, (rows - 1) * 2.6]], 0.09, m.dark);
  g.userData = { r: Math.max(len / 2 + 3, rows * 2.6 + 2), kind: 'solar' };
  return g;
}

// Propellant plant: CO2 intakes, compressor, Sabatier + electrolysis train, cryocooler radiators, LOX and methane spheres
export function propPlant() {
  const m = mats(), g = new THREE.Group();
  box(g, 22, 0.4, 14, m.concrete, 0, 0.2, 0);
  for (let i = 0; i < 3; i++) { const x = -8 + i * 3.2; cyl(g, 1.1, 1.1, 5.5, 16, m.white, x, 3.1, -4.5); for (let k = 0; k < 5; k++) cyl(g, 1.14, 1.14, 0.12, 16, m.dark, x, 1.2 + k * 1.1, -4.5); cyl(g, 1.25, 1.25, 0.3, 16, m.dark, x, 6, -4.5); }
  box(g, 6, 2.8, 3.4, m.white, -5, 1.8, 0.8); box(g, 6.1, 0.4, 3.5, m.dark, -5, 3.3, 0.8);
  for (let i = 0; i < 2; i++) { const r = cyl(g, 0.9, 0.9, 6, 18, m.steel, 2.2, 1.6 + i * 2.1, -3.5); r.rotation.z = Math.PI / 2; }
  box(g, 4, 3.2, 3, m.white, 2.2, 2, 1.2); for (let k = 0; k < 4; k++) box(g, 0.08, 2.4, 3.05, m.dark, 0.6 + k * 1.05, 2, 1.2);
  const tanks = [[7, -3.2, m.white], [7, 2.6, m.white], [10.4, -0.3, m.stain]];
  for (const [x, z, mt] of tanks) {
    sph(g, 2.3, mt, x, 4.4, z);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.785; cyl(g, 0.14, 0.14, 4.2, 6, m.frame, x + Math.cos(a) * 1.8, 2.1, z + Math.sin(a) * 1.8); }
    const fr = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.22, 8, 24), m.frost); fr.rotation.x = Math.PI / 2; fr.position.set(x, 3.1, z); g.add(fr);
  }
  for (let i = 0; i < 3; i++) { const p = box(g, 3.2, 0.05, 2.2, m.radiator, -9 + i * 3.4, 4.6, 4.6); p.rotation.x = -0.5; cyl(g, 0.06, 0.06, 4.4, 5, m.frame, -9 + i * 3.4, 2.3, 4.1); }
  pipe(g, [[-8, 1.0, -3.4], [-5, 0.9, -2.2], [-2, 1.2, -1.6], [2.2, 1.6, -2.4]], 0.16, m.steel);
  pipe(g, [[4.2, 1.4, -3.5], [6, 1.0, -3.4], [7, 2.2, -3.2]], 0.14, m.gold);
  pipe(g, [[4.2, 1.2, 1.2], [6, 1.0, 2.4], [7, 2.2, 2.6]], 0.14, m.gold);
  pipe(g, [[4.2, 1.1, 0], [8, 0.8, 0], [10.4, 2.2, -0.3]], 0.14, m.steel);
  box(g, 1.4, 0.06, 1.4, m.hazard, -10.6, 0.43, 6.3); blink(g, 10.4, 6.9, -0.3, Math.random()); blink(g, -8, 6.4, -4.5, Math.random());
  g.userData = { r: 12, kind: 'plant' };
  return g;
}

// Cell dock: pad + gantry; a HAWC that stands still on it gets a full cell
export function chargeDock() {
  const m = mats(), g = new THREE.Group();
  box(g, 15, 0.35, 15, m.concrete, 0, 0.17, 0);
  for (const [w, d, x, z] of [[15, 0.4, 0, 7.3], [15, 0.4, 0, -7.3], [0.4, 15, 7.3, 0], [0.4, 15, -7.3, 0]]) box(g, w, 0.05, d, m.hazard, x, 0.37, z);
  const ring = new THREE.Mesh(new THREE.RingGeometry(4.6, 5, 48), m.cell); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.38; g.add(ring);
  for (const s of [-1, 1]) { box(g, 0.7, 11, 0.7, m.steel, s * 8.4, 5.5, -5.6); box(g, 0.7, 11, 0.7, m.steel, s * 8.4, 5.5, -3.2); for (let k = 1; k < 5; k++) box(g, 0.25, 0.25, 2.4, m.frame, s * 8.4, k * 2.2, -4.4); }
  box(g, 17.5, 0.9, 1.0, m.dark, 0, 11.2, -4.4);
  const trolley = new THREE.Group(); trolley.position.set(0, 10.4, -4.4); g.add(trolley);
  box(trolley, 1.6, 0.8, 1.4, m.hazard, 0, 0, 0); cyl(trolley, 0.04, 0.04, 3, 4, m.dark, 0, -1.9, 0);
  const held = cyl(trolley, 0.5, 0.5, 1.5, 16, m.steel, 0, -3.9, 0); const hc = cyl(trolley, 0.52, 0.52, 0.6, 16, m.cell, 0, -3.9, 0);
  const rack = new THREE.Group(); rack.position.set(9.6, 0, 3.2); g.add(rack);
  box(rack, 1.6, 4.2, 6, m.dark, 0, 2.1, 0); const slots = [];
  for (let i = 0; i < 6; i++) { const y = 1 + (i % 2) * 1.9, z = -2 + Math.floor(i / 2) * 2; cyl(rack, 0.5, 0.5, 1.4, 14, m.steel, -0.3, y, z); slots.push(cyl(rack, 0.52, 0.52, 0.5, 14, m.cell, -0.3, y, z)); }
  for (const [x, z] of [[-6.8, 6.8], [6.8, 6.8]]) { cyl(g, 0.12, 0.12, 6, 6, m.frame, x, 3, z); box(g, 0.6, 0.35, 0.4, m.lamp, x, 6, z - 0.2); }
  blink(g, 0, 11.9, -4.4, Math.random());
  g.userData = { r: 8, kind: 'dock', trolley, held: [held, hc], slots };
  return g;
}

// Starship-class methalox tanker, 9 m wide and ~50 m tall: stainless, heat shield on the windward side, nose solar wings
export function tankerShip() {
  const m = mats(), g = new THREE.Group(), R = 4.5, H = 40;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, 40, 1, true), m.stain); body.position.y = H / 2 + 3; body.castShadow = true; g.add(body);
  const shield = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.03, R + 0.03, H - 1, 40, 1, true, -Math.PI / 2, Math.PI), m.tile); shield.position.y = H / 2 + 3.2; g.add(shield);
  const pts = []; for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push(new THREE.Vector2(R * Math.sqrt(1 - t * t * 0.96), t * 10)); }
  const nose = new THREE.Mesh(new THREE.LatheGeometry(pts, 40), m.stain); nose.position.y = H + 3; nose.castShadow = true; g.add(nose);
  for (const [y, s] of [[H - 2, 1], [6, 2.2]]) for (const sx of [-1, 1]) { const f = box(g, 0.25, 6 * s * 0.6, 3.4 * s * 0.7, m.tile, sx * (R + 0.9), y, -0.6); f.rotation.z = sx * 0.12; }
  for (const sx of [-1, 1]) { const w = box(g, 8, 0.06, 2.4, m.solar, sx * (R + 4.4), H + 6.5, 1.8); w.rotation.z = sx * -0.1; box(g, 0.5, 0.2, 0.3, m.frame, sx * (R + 0.2), H + 6.5, 1.8); }
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const l = box(g, 0.5, 4.4, 0.8, m.dark, Math.cos(a) * (R - 0.4), 1.6, Math.sin(a) * (R - 0.4), -a); l.rotation.z = Math.cos(a) * 0.22; l.rotation.x = -Math.sin(a) * 0.22; box(g, 1.4, 0.3, 1.4, m.dark, Math.cos(a) * (R + 0.4), 0.15, Math.sin(a) * (R + 0.4)); }
  cyl(g, R, R * 0.92, 3, 40, m.dark, 0, 1.6, 0);
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; cyl(g, 0.55, 0.9, 1.2, 14, m.dark, Math.cos(a) * 1.4, 0.4, Math.sin(a) * 1.4); }
  for (const y of [14, 30]) { const b = new THREE.Mesh(new THREE.TorusGeometry(R + 0.02, 0.06, 6, 40), m.frame); b.rotation.x = Math.PI / 2; b.position.y = y; g.add(b); }
  const win = box(g, 1.4, 0.5, 0.1, m.lamp, 0, H + 4, R - 0.2); win.rotation.x = -0.15;
  blink(g, 0, H + 13.2, 0, Math.random());
  g.userData = { r: 7, kind: 'tanker', h: H + 13 };
  return g;
}

// Ice excavator digging a shallow glacier; spoil heap and a water bladder
export function iceMine() {
  const m = mats(), g = new THREE.Group();
  const pit = new THREE.Mesh(new THREE.CircleGeometry(6, 32), S({ color: 0xcfd6dc, roughness: 0.6 })); pit.rotation.x = -Math.PI / 2; pit.position.y = 0.06; g.add(pit);
  const heap = new THREE.Mesh(new THREE.ConeGeometry(4, 2.6, 12), m.berm); heap.position.set(8, 1.2, 2); heap.castShadow = true; g.add(heap);
  const dig = new THREE.Group(); dig.position.set(-1, 0, 0); g.add(dig);
  box(dig, 3, 1.4, 4.4, m.hazard, 0, 1.3, 0); box(dig, 3.2, 0.9, 4.8, m.dark, 0, 0.45, 0); box(dig, 2.2, 1.2, 1.6, m.white, 0, 2.6, 1.1);
  const arm = box(dig, 0.4, 0.4, 4.4, m.hazard, 0, 2.6, -2.4); arm.rotation.x = 0.5; box(dig, 1.6, 0.9, 0.9, m.dark, 0, 1.4, -4.4);
  const bl = new THREE.Mesh(new THREE.SphereGeometry(2.2, 20, 12), m.white); bl.scale.y = 0.45; bl.position.set(-7.5, 0.9, 3); bl.castShadow = true; g.add(bl);
  pipe(g, [[-1, 0.4, 2.4], [-4, 0.2, 3], [-6, 0.6, 3]], 0.12, m.dark);
  g.userData = { r: 10, kind: 'ice', dig };
  return g;
}
