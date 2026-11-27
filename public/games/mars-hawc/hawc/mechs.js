// Procedural HAWC family (original designs): articulated rig (hips > thigh > knee > ankle, waist > torso > shoulders),
// plated hull, framed cockpit glass, stencilled unit numbers, procedural walk. Metres, feet at y = 0, facing +Z.
import { THREE } from './lib.js?v=19';

const GC = new Map();
// Chamfered hard-surface block: every edge cut at 45°, so plates catch a highlight like machined armour.
export function cbox(w, h, d, c) {
  c = c ?? Math.min(w, h, d) * 0.14; const key = [w, h, d, c].map((v) => v.toFixed(3)).join(); if (GC.has(key)) return GC.get(key);
  const x = w / 2 - c, y = h / 2 - c, s = new THREE.Shape(); s.moveTo(-x, -y); s.lineTo(x, -y); s.lineTo(x, y); s.lineTo(-x, y); s.lineTo(-x, -y);
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, d - 2 * c), bevelEnabled: true, bevelThickness: c, bevelSize: c, bevelSegments: 1 });
  g.translate(0, 0, -(d - 2 * c) / 2); g.computeVertexNormals(); GC.set(key, g); return g;
}
const slab = (pts, t, bev = 0) => { const s = new THREE.Shape(); pts.forEach(([z, y], i) => (i ? s.lineTo(z, y) : s.moveTo(z, y))); const d = Math.max(0.01, t - bev * 2), e = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev * 0.6, bevelSegments: 1 }); e.translate(0, 0, -d / 2); e.rotateY(-Math.PI / 2); e.computeVertexNormals(); return e; };
export const MECHS = {
  bastion: { name: 'Bastion', faction: 'darken', paint: 0x6f6b5c, trim: 0x4a473d, accent: 0xb8a36a, num: '52', serial: '402 489', L1: 2.0, L2: 2.1, hipW: 1.25, torso: [3.4, 2.7, 2.8], right: 'rotary', left: 'box', stacks: true },
  warden: { name: 'Warden', faction: 'union', paint: 0xd9d6cf, trim: 0x1f2124, accent: 0xd8742a, num: '39', serial: 'UN 07-39', L1: 1.9, L2: 2.0, hipW: 1.15, torso: [3.1, 2.5, 2.6], right: 'cannon', left: 'cannon', stacks: false },
};
export function decal(text, { w = 256, h = 128, fg = '#ecebe6', bg = null, size = 86 } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
  g.fillStyle = fg; g.font = `700 ${size}px Barlow Condensed, Arial Narrow, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.7, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
}
export function chev(fg = '#d8a032') { const c = document.createElement('canvas'); c.width = 128; c.height = 32; const g = c.getContext('2d'); g.fillStyle = '#1d1f20'; g.fillRect(0, 0, 128, 32); g.fillStyle = fg; for (let x = -32; x < 160; x += 24) { g.beginPath(); g.moveTo(x, 32); g.lineTo(x + 12, 32); g.lineTo(x + 28, 0); g.lineTo(x + 16, 0); g.fill(); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }); }

export function buildMech(kind = 'bastion') {
  const P = MECHS[kind], S = (o) => new THREE.MeshStandardMaterial(o);
  const m = { paint: S({ color: P.paint, roughness: 0.72, metalness: 0.18 }), trim: S({ color: P.trim, roughness: 0.6, metalness: 0.4 }), acc: S({ color: P.accent, roughness: 0.6 }),
    dark: S({ color: 0x1c1d1f, roughness: 0.55, metalness: 0.6 }), steel: S({ color: 0x9aa1a8, roughness: 0.3, metalness: 1 }), glass: new THREE.MeshPhysicalMaterial({ color: 0x0f1a22, roughness: 0.05, metalness: 0.3, clearcoat: 1 }),
    lamp: new THREE.MeshBasicMaterial({ color: 0xfff1d6, toneMapped: false }), red: new THREE.MeshBasicMaterial({ color: 0xff3a2a, toneMapped: false }), haz: chev() };
  const add = (p, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = o.receiveShadow = true; p.add(o); return o; };
  const B = (p, w, h, d, mat, x, y, z, rx, ry, rz) => add(p, (w > 0.3 && h > 0.3 && d > 0.3) ? cbox(w, h, d) : new THREE.BoxGeometry(w, h, d), mat, x, y, z, rx, ry, rz);
  const C = (p, r, h, mat, x, y, z, rx = 0, ry = 0, rz = 0, seg = 18) => add(p, new THREE.CylinderGeometry(r, r, h, seg), mat, x, y, z, rx, ry, rz);
  const plate = (p, txt, w, h, x, y, z, ry = 0, opt) => { const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), decal(txt, opt)); o.position.set(x, y, z); o.rotation.y = ry; p.add(o); return o; };
  const root = new THREE.Group(), A = {}, hipH = P.L1 + P.L2 + 0.55;
  const hips = new THREE.Group(); hips.position.y = hipH; root.add(hips);
  B(hips, P.hipW * 2 - 0.2, 0.9, 1.7, m.trim, 0, 0, 0); for (const s of [-1, 1]) B(hips, 0.7, 0.9, 0.35, m.paint, s * 0.75, -0.25, 0.95, 0.15, 0, s * -0.1); B(hips, 1.4, 0.8, 0.3, m.paint, 0, -0.1, 0.92); plate(hips, P.serial, 1.1, 0.3, 0, -0.1, 1.08, 0, { w: 256, h: 64, size: 44, bg: '#151617' });
  const legs = [-1, 1].map((s) => {
    const hip = new THREE.Group(); hip.position.set(s * P.hipW, 0, 0); hips.add(hip);
    C(hip, 0.46, 0.7, m.dark, s * 0.15, 0, 0, 0, 0, Math.PI / 2); C(hip, 0.5, 0.12, m.steel, s * 0.5, 0, 0, 0, 0, Math.PI / 2);
    const thigh = new THREE.Group(); hip.add(thigh);
    B(thigh, 0.72, P.L1 * 0.85, 0.95, m.dark, s * 0.1, -P.L1 * 0.5, 0.0); for (const dz of [-0.3, 0.3]) C(thigh, 0.1, P.L1 * 0.8, m.steel, s * -0.32, -P.L1 * 0.5, dz, 0, 0, 0, 10); B(thigh, 0.3, P.L1 * 0.8, 1.2, m.paint, s * 0.52, -P.L1 * 0.45, 0.02); B(thigh, 0.8, P.L1 * 0.55, 0.12, m.paint, s * 0.1, -P.L1 * 0.45, 0.68, -0.08); B(thigh, 0.98, 0.14, 1.18, m.haz, s * 0.1, -P.L1 * 0.15, 0.05);
    B(thigh, 0.22, P.L1 * 0.7, 1.0, m.trim, s * 0.62, -P.L1 * 0.45, 0.05, 0, 0, s * 0.06); B(thigh, 0.7, 0.5, 0.18, m.trim, s * 0.1, -P.L1 * 0.82, 0.66, 0.2);
    const knee = new THREE.Group(); knee.position.y = -P.L1; thigh.add(knee);
    C(knee, 0.42, 0.9, m.dark, s * 0.1, 0, 0, 0, 0, Math.PI / 2); B(knee, 0.95, 0.85, 0.45, m.paint, s * 0.1, 0.1, 0.62, -0.35); B(knee, 0.6, 0.12, 0.47, m.acc, s * 0.1, 0.42, 0.68, -0.35);
    B(knee, 1.05, P.L2 * 0.78, 1.25, m.paint, s * 0.1, -P.L2 * 0.5, 0.0); B(knee, 1.2, P.L2 * 1.1, 0.3, m.paint, s * 0.1, -P.L2 * 0.36, 0.82, 0.1); for (const q of [-1, 1]) B(knee, 0.2, P.L2 * 0.8, 0.8, m.paint, s * 0.1 + q * 0.62, -P.L2 * 0.45, 0.42); B(knee, 1.22, 0.14, 0.32, m.haz, s * 0.1, -P.L2 * 0.82, 0.76, 0.1); B(knee, 0.3, P.L2 * 0.5, 1.0, m.trim, s * 0.66, -P.L2 * 0.5, 0, 0, 0, s * 0.05); for (const y of [0.3, 0.42, 0.54]) B(knee, 0.6, 0.03, 0.05, m.dark, s * 0.1, -P.L2 * y, 0.9, 0.06);
    for (const dx of [-0.25, 0.25]) { C(knee, 0.09, P.L2 * 0.7, m.steel, s * 0.1 + dx, -P.L2 * 0.42, -0.72); C(knee, 0.13, P.L2 * 0.35, m.dark, s * 0.1 + dx, -P.L2 * 0.25, -0.72); }
    const ankle = new THREE.Group(); ankle.position.y = -P.L2; knee.add(ankle);
    C(ankle, 0.3, 0.8, m.dark, s * 0.1, 0, 0, 0, 0, Math.PI / 2);
    B(ankle, 1.4, 0.42, 2.0, m.trim, s * 0.1, -0.36, 0.2); B(ankle, 1.2, 0.35, 0.7, m.paint, s * 0.1, -0.28, 1.15, 0.25); B(ankle, 0.5, 0.3, 0.6, m.paint, s * 0.1, -0.4, -0.85);
    return { hip, thigh, knee, ankle, s };
  });
  A.hip = new THREE.Vector3(P.hipW + 0.5, hipH, 0); A.knee = new THREE.Vector3(P.hipW, hipH - P.L1, -0.72); A.foot = new THREE.Vector3(P.hipW + 0.1, 0.25, 1.2);
  const waist = new THREE.Group(); waist.position.y = 0.55; hips.add(waist);
  C(waist, 0.9, 0.35, m.steel, 0, 0, 0, 0, 0, 0, 28);
  const torso = new THREE.Group(); torso.position.y = 0.2; waist.add(torso);
  const [TW, TH, TD] = P.torso, ty = TH / 2;
  const zf = TD / 2; add(torso, slab([[-zf, 0.1], [zf * 0.55, 0], [zf * 1.05, TH * 0.3], [zf, TH * 0.72], [zf * 0.45, TH * 1.02], [-zf * 0.8, TH * 1.02], [-zf * 1.05, TH * 0.75]], TW * 0.72, 0.42), m.paint);
  for (const s of [-1, 1]) { B(torso, TW * 0.3, TH * 0.6, TD * 0.82, m.paint, s * TW * 0.4, TH * 0.64, -0.25); B(torso, TW * 0.22, TH * 0.34, TD * 0.6, m.trim, s * TW * 0.36, TH * 0.2, -0.2); for (let i = 0; i < 4; i++) C(torso, 0.05, 0.06, m.steel, s * (TW * 0.36 - 0.42), TH * (0.36 + i * 0.12), zf * 1.02 + 0.2, Math.PI / 2, 0, 0, 8); }
  B(torso, 0.7, 0.3, 0.9, m.trim, 0, TH * 1.02 + 0.35, 0.3); add(torso, new THREE.SphereGeometry(0.24, 14, 10), m.dark, 0.5, TH * 1.02 + 0.5, 0.75); C(torso, 0.1, 0.3, m.lamp, 0.5, TH * 1.02 + 0.5, 0.95, Math.PI / 2, 0, 0, 10);
  for (const s of [-1, 1]) { B(torso, 0.35, TH * 0.9, TD * 0.8, m.trim, s * (TW / 2 + 0.1), ty, -0.1); B(torso, TW * 0.4, 0.5, 0.45, m.trim, s * TW * 0.3, 0.3, TD / 2 - 0.05, 0.3, s * 0.2); }
  B(torso, TW * 0.7, 0.4, TD * 0.9, m.trim, 0, TH + 0.15, -0.1);
  const cx = 0, cy = TH * 0.52, cz = zf * 1.03 + 0.26;
  B(torso, 1.15, 1.3, 0.14, m.trim, cx, cy, cz); for (const [x, y, w, h] of [[0, 0.3, 0.9, 0.52], [0, -0.3, 0.9, 0.5]]) B(torso, w, h, 0.05, m.glass, cx + x, cy + y, cz + 0.07);
  for (const s of [-1, 1]) { B(torso, 0.2, 0.2, 0.1, m.lamp, s * 0.5, cy - 0.85, cz - 0.3); add(torso, new THREE.SphereGeometry(0.06, 8, 6), m.red, s * 0.68, cy + 0.2, cz - 0.02); }
  B(torso, TW + 0.04, 0.16, 0.6, m.haz, 0, 0.35, TD / 2 - 0.25);
  A.cockpit = new THREE.Vector3(0, hipH + 0.75 + cy, cz);
  if (P.stacks) { for (const s of [-1, 1]) { B(torso, 0.6, 1.6, 0.6, m.dark, s * (TW / 2 - 0.45), TH + 0.6, -TD / 2 + 0.2); for (let i = 0; i < 5; i++) B(torso, 0.62, 0.05, 0.62, m.trim, s * (TW / 2 - 0.45), TH + 0.1 + i * 0.28, -TD / 2 + 0.2); } A.stacks = new THREE.Vector3(TW / 2 - 0.45, hipH + 0.75 + TH + 1.1, -TD / 2 + 0.2); }
  B(torso, TW * 0.6, TH * 0.6, 0.5, m.trim, 0, ty, -TD / 2 - 0.2); B(torso, TW * 0.5, 0.18, 0.52, m.acc, 0, ty + 0.5, -TD / 2 - 0.2); A.cells = new THREE.Vector3(0, hipH + 0.75 + ty, -TD / 2 - 0.45);
  for (const s of [-1, 1]) add(torso, new THREE.CylinderGeometry(0.012, 0.02, 2.6, 4), m.dark, s * 0.6, TH + 1.5, -0.6);
  const arms = {};
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * (TW / 2 + 0.55), TH * 0.68, 0); torso.add(sh); C(sh, 0.5, 0.6, m.dark, -s * 0.2, 0, 0, 0, 0, Math.PI / 2);
    B(sh, 1.2, 1.1, 1.5, m.paint, s * 0.2, 0.2, 0); B(sh, 1.22, 0.14, 1.52, m.acc, s * 0.2, 0.62, 0); B(sh, 1.35, 0.5, 1.7, m.paint, s * 0.3, 0.85, 0, 0, 0, s * -0.28); B(sh, 0.4, 0.9, 1.3, m.trim, s * 0.85, -0.1, 0, 0, 0, s * 0.12);
    add(sh, slab([[-1.2, -1.0], [1.05, -1.0], [1.4, 0.1], [0.7, 1.35], [-1.0, 1.35], [-1.4, 0.4]], 0.24, 0.07), m.paint, s * 1.12, 0, 0.1, 0, 0, s * 0.08); add(sh, slab([[-0.9, -1.05], [0.8, -1.05], [0.95, -0.8], [-1.0, -0.8]], 0.27, 0), m.haz, s * 1.12, 0, 0.1, 0, 0, s * 0.08);
    plate(sh, s < 0 ? P.num : 'V', 1.15, 0.6, s * 1.27, 0.55, 0.05, s * Math.PI / 2);
    const arm = new THREE.Group(); arm.position.set(s * 0.25, -0.45, 0.1); sh.add(arm);
    const type = s < 0 ? P.right : P.left;
    if (type === 'rotary') { C(arm, 0.55, 1.1, m.trim, 0, -0.2, 0.5, Math.PI / 2, 0, 0, 20); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; C(arm, 0.08, 1.8, m.dark, Math.cos(a) * 0.26, -0.2 + Math.sin(a) * 0.26, 1.7, Math.PI / 2, 0, 0, 8); } C(arm, 0.4, 0.12, m.steel, 0, -0.2, 2.55, Math.PI / 2);
      const belt = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.08, 0.1), m.steel, 18), mx = new THREE.Matrix4(); for (let i = 0; i < 18; i++) { const t = i / 17, a = t * Math.PI * 0.9; mx.makeRotationX(a).setPosition(0, -0.7 - Math.sin(a) * 0.9, -0.2 - Math.cos(a) * 0.6 + 0.6); belt.setMatrixAt(i, mx); } arm.add(belt); }
    else if (type === 'box') { B(arm, 1.0, 1.0, 2.2, m.trim, 0, -0.2, 0.8); for (let i = 0; i < 9; i++) C(arm, 0.11, 0.1, m.dark, -0.3 + (i % 3) * 0.3, -0.5 + Math.floor(i / 3) * 0.3, 1.92, Math.PI / 2, 0, 0, 10); B(arm, 1.02, 0.12, 0.6, m.haz, 0, 0.33, 0.2); }
    else { B(arm, 0.7, 0.8, 1.6, m.trim, 0, -0.2, 0.5); C(arm, 0.14, 2.4, m.dark, 0.12, -0.15, 2.2, Math.PI / 2); C(arm, 0.14, 2.4, m.dark, -0.12, -0.15, 2.2, Math.PI / 2); C(arm, 0.22, 0.3, m.steel, 0, -0.15, 3.3, Math.PI / 2); }
    arms[s] = arm;
  }
  A.right = new THREE.Vector3(-(TW / 2 + 0.75), hipH + 0.75 + TH * 0.68 - 0.65, 2.3); A.left = new THREE.Vector3(TW / 2 + 0.75, hipH + 0.75 + TH * 0.68 - 0.65, 1.8);
  A.waist = new THREE.Vector3(0.9, hipH + 0.55, 0); A.gyro = new THREE.Vector3(0, hipH + 0.75 + ty - 0.9, -1.0);
  root.userData = { anchors: A, preset: P, hipH,
    update(t, spd = 0) {
      const k = Math.min(1, spd / 3), f = t * (1.3 + spd * 0.35);
      for (const L of legs) { const ph = f + (L.s > 0 ? 0 : Math.PI), th = -0.32 - Math.sin(ph) * 0.42 * k, kn = 0.58 + Math.max(0, Math.sin(ph + 1.25)) * 0.85 * k; L.thigh.rotation.x = th; L.knee.rotation.x = kn; L.ankle.rotation.x = -(th + kn); }
      hips.position.y = hipH - 0.16 - Math.abs(Math.cos(f)) * 0.14 * k + Math.sin(t * 1.6) * 0.015; waist.rotation.z = Math.sin(f) * 0.03 * k; torso.rotation.y = Math.sin(t * 0.4) * 0.05 * (1 - k);
      for (const s of [-1, 1]) arms[s].rotation.x = Math.sin(t * 0.9 + s) * 0.02;
    } };
  root.userData.update(0, 0);
  return root;
}
