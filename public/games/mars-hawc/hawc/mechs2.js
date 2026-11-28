// Gun-walker HAWC family (original designs, layout taken from the user's reference turntable): reverse-knee legs with drum joints and three-toed feet,
// boxy armoured cab with a raked windscreen, weapon arms on shoulder pylons, roof kit. Metres, feet at y = 0, facing +Z.
import { THREE } from './lib.js?v=22';
import { cbox, decal, chev } from './mechs.js?v=22';

const UNION = { paint: 0xb2afa6, trim: 0x2a2c2f, accent: 0xd8742a };
export const WALKERS = {
  jackal: { name: 'Jackal', ...UNION, num: '17', serial: 'UN 11-17', k: 1, right: 'rotary', left: 'pod', roof: ['launcher', 'turret', 'mast'] },
  lancer: { name: 'Lancer', ...UNION, num: '24', serial: 'UN 09-24', k: 0.9, right: 'cannon', left: 'cannon', roof: ['radome', 'mast'] },
  ballista: { name: 'Ballista', ...UNION, num: '31', serial: 'UN 14-31', k: 1.06, right: 'pod', left: 'pod', roof: ['battery', 'mast'] },
};
const PI = Math.PI, L1 = 1.7, L2 = 1.9, L3 = 1.3, FOOT = 0.5, A1 = -0.7, A2 = 0.75, A3 = -0.35;

export function buildWalker(kind = 'jackal') {
  const P = WALKERS[kind], S = (o) => new THREE.MeshStandardMaterial(o);
  const m = { paint: S({ color: P.paint, roughness: 0.66, metalness: 0.05 }), trim: S({ color: P.trim, roughness: 0.55, metalness: 0.45 }), acc: S({ color: P.accent, roughness: 0.6 }),
    dark: S({ color: 0x1b1c1e, roughness: 0.5, metalness: 0.65 }), steel: S({ color: 0x9aa1a8, roughness: 0.32, metalness: 1 }), rubber: S({ color: 0x131414, roughness: 0.9 }), war: S({ color: 0x8f2a22, roughness: 0.5 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x0f1a22, roughness: 0.05, metalness: 0.3, clearcoat: 1 }), lamp: new THREE.MeshBasicMaterial({ color: 0xfff1d6, toneMapped: false }), red: new THREE.MeshBasicMaterial({ color: 0xff3a2a, toneMapped: false }), haz: chev() };
  const add = (p, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = o.receiveShadow = true; p.add(o); return o; };
  const B = (p, w, h, d, mat, x, y, z, rx, ry, rz) => add(p, Math.min(w, h, d) > 0.09 ? cbox(w, h, d) : new THREE.BoxGeometry(w, h, d), mat, x, y, z, rx, ry, rz);
  const C = (p, r, h, mat, x, y, z, rx = 0, ry = 0, rz = 0, seg = 20) => add(p, new THREE.CylinderGeometry(r, r, h, seg), mat, x, y, z, rx, ry, rz);
  const CZ = (p, r, h, mat, x, y, z, seg) => C(p, r, h, mat, x, y, z, PI / 2, 0, 0, seg);
  // Drum joint: axis along X, steel end caps with a bolt ring so the joint shows its axis
  const J = (p, r, w, x = 0, y = 0, z = 0) => { C(p, r, w, m.dark, x, y, z, 0, 0, PI / 2, 28); for (const s of [-1, 1]) { C(p, r * 0.7, 0.08, m.steel, x + s * (w / 2 + 0.02), y, z, 0, 0, PI / 2, 24); add(p, new THREE.TorusGeometry(r * 0.88, 0.04, 6, 28), m.steel, x + s * w / 2, y, z, 0, PI / 2, 0); } };
  const tube = (p, pts, r, mat = m.rubber) => add(p, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((q) => new THREE.Vector3(...q))), 20, r, 7), mat);
  const plate = (p, txt, w, h, x, y, z, ry = 0, opt) => { const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), decal(txt, opt)); o.position.set(x, y, z); o.rotation.y = ry; p.add(o); return o; };

  const root = new THREE.Group(), inner = new THREE.Group(); inner.scale.setScalar(P.k); root.add(inner);
  const hipW = 1.42, hipH = L1 * Math.cos(A1) + L2 * Math.cos(A2) + L3 * Math.cos(A3) + FOOT, A = {};
  const hips = new THREE.Group(); hips.position.y = hipH; inner.add(hips);
  B(hips, 2.0, 1.0, 1.6, m.trim, 0, 0, 0); B(hips, 1.3, 0.75, 0.3, m.paint, 0, -0.05, 0.82, 0.12); B(hips, 1.3, 0.14, 0.32, m.haz, 0, 0.28, 0.84, 0.12); B(hips, 1.2, 0.7, 0.28, m.paint, 0, 0, -0.82, -0.1);
  plate(hips, P.serial, 0.95, 0.24, 0, -0.12, 0.985, 0, { w: 256, h: 64, size: 44, bg: '#151617' }).rotation.x = 0.12;
  const legs = [-1, 1].map((s) => {
    const x0 = s * 0.12, hip = new THREE.Group(); hip.position.set(s * hipW, 0, 0); hips.add(hip); J(hip, 0.72, 0.8, x0); B(hip, 0.5, 0.5, 0.9, m.paint, s * 0.52, 0.5, 0, 0, 0, s * -0.5);
    const thigh = new THREE.Group(); hip.add(thigh);
    B(thigh, 0.72, L1 * 0.8, 0.8, m.dark, x0, -L1 * 0.5, 0); B(thigh, 1.2, L1 * 0.7, 0.36, m.paint, x0, -L1 * 0.48, 0.56, -0.06); B(thigh, 0.32, L1 * 0.74, 1.15, m.paint, x0 + s * 0.56, -L1 * 0.5, 0.05); B(thigh, 1.22, 0.13, 0.38, m.acc, x0, -L1 * 0.2, 0.59, -0.06);
    C(thigh, 0.09, L1 * 0.7, m.steel, x0, -L1 * 0.52, -0.42, 0.1, 0, 0, 10); C(thigh, 0.14, L1 * 0.34, m.dark, x0, -L1 * 0.3, -0.45, 0.1, 0, 0, 12);
    const knee = new THREE.Group(); knee.position.y = -L1; thigh.add(knee); J(knee, 0.66, 1.0, x0); B(knee, 1.0, 0.8, 0.34, m.paint, x0, 0.05, 0.66, -0.5);
    B(knee, 0.84, L2 * 0.8, 0.9, m.dark, x0, -L2 * 0.5, 0); B(knee, 1.3, L2 * 0.74, 0.36, m.paint, x0, -L2 * 0.47, -0.62, 0.05); for (const q of [-1, 1]) B(knee, 0.28, L2 * 0.68, 1.05, m.paint, x0 + q * 0.62, -L2 * 0.48, -0.14);
    B(knee, 1.32, 0.14, 0.38, m.haz, x0, -L2 * 0.76, -0.64, 0.05); for (const dx of [-0.2, 0.2]) { C(knee, 0.08, L2 * 0.7, m.steel, x0 + dx, -L2 * 0.5, 0.56, -0.08, 0, 0, 10); C(knee, 0.12, L2 * 0.32, m.dark, x0 + dx, -L2 * 0.28, 0.59, -0.08, 0, 0, 12); }
    tube(knee, [[x0 + s * 0.3, 0.2, -0.3], [x0 + s * 0.62, -L2 * 0.3, -0.75], [x0 + s * 0.4, -L2 * 0.9, -0.4]], 0.045);
    const hock = new THREE.Group(); hock.position.y = -L2; knee.add(hock); J(hock, 0.58, 0.96, x0);
    B(hock, 0.66, L3 * 0.8, 0.72, m.dark, x0, -L3 * 0.5, 0); B(hock, 1.12, L3 * 0.78, 0.34, m.paint, x0, -L3 * 0.5, 0.5, -0.05); for (const q of [-1, 1]) B(hock, 0.24, L3 * 0.6, 0.8, m.paint, x0 + q * 0.5, -L3 * 0.5, 0.1); B(hock, 0.6, 0.1, 0.36, m.acc, x0, -L3 * 0.22, 0.53, -0.05); C(hock, 0.07, L3 * 0.7, m.steel, x0, -L3 * 0.5, -0.36, 0, 0, 0, 10);
    const ankle = new THREE.Group(); ankle.position.y = -L3; hock.add(ankle); J(ankle, 0.48, 0.9, x0);
    B(ankle, 1.7, 0.42, 1.6, m.trim, x0, -FOOT + 0.21, 0.05); B(ankle, 1.3, 0.34, 1.1, m.paint, x0, -0.1, 0.2, 0.2);
    for (const q of [-1, 0, 1]) { const toe = new THREE.Group(); toe.position.set(x0 + q * 0.58, -FOOT + 0.21, 0.75); toe.rotation.y = q * 0.2; ankle.add(toe); B(toe, 0.52, 0.42, 1.2, m.trim, 0, 0, 0.6); B(toe, 0.54, 0.26, 0.9, m.paint, 0, 0.22, 0.5, 0.14); B(toe, 0.46, 0.32, 0.5, m.dark, 0, -0.04, 1.32, 0.3); C(toe, 0.14, 0.44, m.steel, 0, 0.06, 0.02, 0, 0, PI / 2, 12); }
    B(ankle, 0.7, 0.38, 0.95, m.trim, x0, -FOOT + 0.2, -1.1, -0.12); B(ankle, 0.72, 0.2, 0.6, m.paint, x0, -FOOT + 0.42, -1.0, -0.12);
    return { thigh, knee, hock, ankle, s };
  });
  const waist = new THREE.Group(); waist.position.y = 0.5; hips.add(waist); C(waist, 0.95, 0.3, m.steel, 0, 0, 0, 0, 0, 0, 32); C(waist, 1.05, 0.1, m.dark, 0, -0.12, 0, 0, 0, 0, 32);
  const torso = new THREE.Group(); torso.position.y = 0.2; waist.add(torso);
  const TW = 2.7, TH = 2.3;
  { const s = new THREE.Shape(); [[-1.5, 0.2], [1.0, 0], [1.55, 0.5], [1.6, 1.25], [1.1, 2.25], [-1.2, 2.3], [-1.6, 1.6]].forEach(([z, y], i) => (i ? s.lineTo(z, y) : s.moveTo(z, y)));
    const e = new THREE.ExtrudeGeometry(s, { depth: TW - 0.4, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.12, bevelSegments: 2 }); e.translate(0, 0, -(TW - 0.4) / 2); e.rotateY(-PI / 2); e.computeVertexNormals(); add(torso, e, m.paint); }
  const ws = new THREE.Group(); ws.position.set(0, 1.76, 1.4); ws.rotation.x = -0.46; torso.add(ws);
  B(ws, 2.34, 1.02, 0.12, m.trim, 0, 0, 0); for (const s of [-1, 1]) add(ws, new THREE.BoxGeometry(1.0, 0.78, 0.06), m.glass, s * 0.56, 0, 0.06); B(ws, 2.4, 0.16, 0.36, m.paint, 0, 0.58, 0.1, 0.5); for (const s of [-1, 1]) C(ws, 0.02, 0.7, m.dark, s * 0.56, 0, 0.11, 0, 0, s * 0.5, 6);
  B(torso, 2.3, 0.62, 0.14, m.paint, 0, 0.88, 1.63); B(torso, 2.32, 0.13, 0.16, m.haz, 0, 0.56, 1.63); plate(torso, P.num, 0.6, 0.36, 0.72, 0.95, 1.71);
  for (const s of [-1, 1]) { B(torso, 0.34, 0.24, 0.16, m.dark, s * 0.82, 0.3, 1.36, 0.5); add(torso, new THREE.BoxGeometry(0.24, 0.14, 0.04), m.lamp, s * 0.82, 0.32, 1.44, 0.5); add(torso, new THREE.SphereGeometry(0.05, 8, 6), m.red, s * 1.2, 1.3, 1.6); }
  add(torso, new THREE.TorusGeometry(0.16, 0.045, 8, 18), m.steel, 0, 0.2, 1.42, 0.3);
  for (const s of [-1, 1]) { const sx = s * (TW / 2 + 0.03); add(torso, new THREE.BoxGeometry(0.05, 0.56, 0.86), m.glass, sx - s * 0.02, 1.78, 0.52); B(torso, 0.12, 0.72, 1.0, m.trim, sx - s * 0.05, 1.78, 0.52); B(torso, 0.16, 1.15, 2.1, m.paint, sx + s * 0.04, 0.86, -0.25);
    for (const [y, z] of [[0.4, 0.65], [1.32, 0.65], [0.4, -1.15], [1.32, -1.15]]) C(torso, 0.05, 0.06, m.steel, sx + s * 0.13, y, z, 0, 0, PI / 2, 8); for (const y of [0.55, 0.75, 0.95]) B(torso, 0.04, 0.05, 0.8, m.dark, sx + s * 0.13, y, -0.7);
    for (let i = 0; i < 3; i++) C(torso, 0.025, 0.36, m.steel, sx + s * 0.16, 1.0 + i * 0.36, 1.12, 0, 0, 0, 6); }
  B(torso, 2.3, 0.14, 2.3, m.trim, 0, 2.36, -0.1); B(torso, 0.85, 0.1, 0.85, m.paint, 0.55, 2.46, -0.45); C(torso, 0.03, 0.4, m.steel, 0.55, 2.55, -0.2, 0, 0, PI / 2, 6);
  B(torso, 2.0, 1.5, 0.7, m.trim, 0, 1.15, -1.8); for (let i = 0; i < 7; i++) B(torso, 1.5, 0.05, 0.12, m.dark, 0, 0.62 + i * 0.16, -2.18); B(torso, 1.6, 0.16, 0.72, m.acc, 0, 1.82, -1.8);
  for (const s of [-1, 1]) { C(torso, 0.16, 0.9, m.dark, s * 0.72, 2.3, -1.85, 0, 0, 0, 14); C(torso, 0.18, 0.08, m.steel, s * 0.72, 2.72, -1.85, 0, 0, 0, 14); tube(torso, [[s * 0.7, 0.55, -2.0], [s * 1.05, -0.1, -1.7], [s * 0.9, -0.55, -0.9]], 0.07); tube(torso, [[s * 0.4, 0.5, -2.1], [s * 0.5, -0.2, -1.6], [s * 0.45, -0.6, -0.8]], 0.05); }
  const ty = hipH + 0.7, R = (x, y, z) => new THREE.Vector3(x, ty + y, z).multiplyScalar(P.k);
  for (const kit of P.roof) {
    if (kit === 'launcher' || kit === 'battery') { const n = kit === 'battery' ? 3 : 2, w = n * 0.5 + 0.3, x = kit === 'battery' ? 0 : -0.45; C(torso, 0.26, 0.5, m.dark, x, 2.65, -0.35, 0, 0, 0, 16); const g = new THREE.Group(); g.position.set(x, 3.25, -0.2); g.rotation.x = -0.12; torso.add(g);
      B(g, w, 0.95, 1.5, m.paint, 0, 0, 0); B(g, w + 0.02, 0.12, 1.52, m.acc, 0, 0.3, 0); for (let i = 0; i < n; i++) for (const y of [-0.21, 0.21]) { const tx = (i - (n - 1) / 2) * 0.5; CZ(g, 0.19, 0.1, m.dark, tx, y, 0.75, 16); CZ(g, 0.13, 0.12, m.war, tx, y, 0.75, 14); }
      for (const s of [-1, 1]) C(g, 0.1, 0.3, m.steel, s * (w / 2 + 0.02), -0.2, -0.3, 0, 0, PI / 2, 12); A.roof = R(x, 3.3, 0.6); }
    if (kit === 'turret') { C(torso, 0.34, 0.3, m.trim, 0.72, 2.58, 0.45, 0, 0, 0, 18); B(torso, 0.5, 0.36, 0.7, m.paint, 0.72, 2.86, 0.5); CZ(torso, 0.06, 1.3, m.dark, 0.72, 2.88, 1.4, 10); CZ(torso, 0.09, 0.22, m.steel, 0.72, 2.88, 2.0, 10); }
    if (kit === 'radome') { C(torso, 0.2, 0.5, m.dark, 0, 2.65, -0.3, 0, 0, 0, 14); add(torso, new THREE.SphereGeometry(0.62, 24, 14, 0, PI * 2, 0, PI * 0.62), m.paint, 0, 3.05, -0.3); C(torso, 0.64, 0.08, m.acc, 0, 2.94, -0.3, 0, 0, 0, 28); A.roof = R(0, 3.3, -0.3); }
    if (kit === 'mast') { add(torso, new THREE.CylinderGeometry(0.012, 0.035, 2.2, 6), m.dark, -1.05, 3.5, -0.95); C(torso, 0.07, 0.2, m.steel, -1.05, 2.5, -0.95, 0, 0, 0, 10); }
  }
  const arms = {};
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * (TW / 2 + 0.62), 1.55, -0.1); torso.add(sh); J(sh, 0.56, 0.72, -s * 0.1); B(sh, 0.6, 0.5, 0.9, m.trim, -s * 0.55, 0, 0);
    B(sh, 1.25, 0.4, 1.7, m.paint, s * 0.18, 0.72, 0, 0, 0, s * -0.22); B(sh, 1.27, 0.12, 0.5, m.acc, s * 0.18, 0.74, 0.45, 0, 0, s * -0.22); B(sh, 0.3, 1.55, 1.7, m.paint, s * 0.62, -0.12, 0, 0, 0, s * 0.08); plate(sh, s < 0 ? P.num : 'UN', 0.9, 0.5, s * 0.745, 0.08, 0, s * PI / 2).rotation.z = s * 0.1;
    B(sh, 0.62, 1.0, 0.72, m.dark, s * 0.1, -0.7, 0);
    const arm = new THREE.Group(); arm.position.set(s * 0.1, -1.25, 0); sh.add(arm); J(arm, 0.42, 0.86);
    const type = s < 0 ? P.right : P.left;
    if (type === 'rotary') { CZ(arm, 0.52, 1.1, m.trim, 0, -0.1, 0.6, 24); B(arm, 0.9, 0.3, 0.9, m.paint, 0, 0.42, 0.55); for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; CZ(arm, 0.075, 1.7, m.dark, Math.cos(a) * 0.25, -0.1 + Math.sin(a) * 0.25, 2.0, 8); } CZ(arm, 0.37, 0.1, m.steel, 0, -0.1, 2.8, 20); CZ(arm, 0.37, 0.08, m.steel, 0, -0.1, 1.9, 20); CZ(arm, 0.12, 1.75, m.steel, 0, -0.1, 2.0, 10);
      C(arm, 0.46, 0.72, m.trim, 0, -0.92, 0.25, 0, 0, PI / 2, 22); C(arm, 0.48, 0.1, m.acc, 0, -0.92, 0.25, 0, 0, PI / 2, 22); tube(arm, [[s * 0.3, -0.9, 0.5], [s * 0.62, -0.5, 0.9], [s * 0.4, -0.1, 1.0]], 0.09, m.steel); }
    else if (type === 'pod') { B(arm, 1.15, 1.55, 1.6, m.paint, 0, -0.25, 0.7); B(arm, 1.17, 0.14, 1.62, m.haz, 0, 0.36, 0.7); for (const x of [-0.27, 0.27]) for (const y of [-0.46, 0, 0.46]) { CZ(arm, 0.2, 0.1, m.dark, x, -0.3 + y, 1.5, 16); CZ(arm, 0.14, 0.12, m.war, x, -0.3 + y, 1.5, 14); } B(arm, 0.9, 1.2, 0.2, m.trim, 0, -0.25, -0.18); }
    else { B(arm, 0.78, 0.86, 1.5, m.paint, 0, -0.15, 0.5); B(arm, 0.8, 0.12, 0.6, m.acc, 0, 0.2, 0.3); CZ(arm, 0.25, 1.0, m.trim, 0, -0.15, 1.6, 16); CZ(arm, 0.15, 2.6, m.dark, 0, -0.15, 2.9, 14); B(arm, 0.44, 0.3, 0.55, m.steel, 0, -0.15, 4.2); for (const y of [-0.5, 0.2]) CZ(arm, 0.07, 1.0, m.steel, s * 0.3, y * 0.4 - 0.15, 1.5, 8); }
    arms[s] = arm;
  }
  const ay = 1.55 - 1.25;
  Object.assign(A, { hip: R(hipW + 0.5, -0.7, 0), knee: new THREE.Vector3(hipW, hipH - L1 * Math.cos(A1), -L1 * Math.sin(A1)).multiplyScalar(P.k), foot: new THREE.Vector3(hipW + 0.1, 0.3, 1.2).multiplyScalar(P.k),
    cockpit: R(0, 1.76, 1.5), cells: R(0, 1.15, -2.1), stacks: R(0.72, 2.75, -1.85), right: R(-(TW / 2 + 0.72), ay - 0.1, 2.2), left: R(TW / 2 + 0.72, ay - 0.2, 1.5), waist: R(0.95, -0.2, 0), gyro: R(0, 0.6, -0.6) });
  root.userData = { anchors: A, preset: P, hipH: hipH * P.k,
    update(t, spd = 0) {
      const k = Math.min(1, spd / 3), f = t * (1.4 + spd * 0.35); let low = 0;
      for (const L of legs) { const ph = f + (L.s > 0 ? 0 : PI), a1 = A1 - Math.sin(ph) * 0.38 * k, a2 = A2 + Math.max(0, Math.sin(ph + 1.2)) * 0.5 * k, a3 = A3 - Math.max(0, Math.sin(ph + 1.2)) * 0.3 * k;
        L.thigh.rotation.x = a1; L.knee.rotation.x = a2 - a1; L.hock.rotation.x = a3 - a2; L.ankle.rotation.x = -a3; low = Math.max(low, L1 * Math.cos(a1) + L2 * Math.cos(a2) + L3 * Math.cos(a3)); }
      hips.position.y = low + FOOT + Math.sin(t * 1.5) * 0.02; waist.rotation.z = Math.sin(f) * 0.025 * k; torso.rotation.y = Math.sin(t * 0.4) * 0.05 * (1 - k); torso.rotation.x = Math.sin(f * 2) * 0.012 * k;
      for (const s of [-1, 1]) arms[s].rotation.x = Math.sin(t * 0.9 + s) * 0.025;
    } };
  root.userData.update(0, 0);
  return root;
}
