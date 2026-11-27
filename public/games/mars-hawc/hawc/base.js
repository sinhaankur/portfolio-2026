// Structures: Union relay tower and outpost, Darken Meson tower.
import { THREE } from './lib.js?v=18';
import { AGENCIES } from './levels.js?v=18';
import { reactor, solarField, propPlant, chargeDock, tankerShip, iceMine, animateInfra, resetInfra } from './infra.js?v=18';

const M = {};
export function mats() {
  if (M.steel) return M;
  const S = (o) => new THREE.MeshStandardMaterial(o);
  M.steel = S({ color: 0x8c9198, metalness: 0.75, roughness: 0.42 });
  M.dark = S({ color: 0x2c2f33, metalness: 0.55, roughness: 0.55 });
  M.concrete = S({ color: 0x9b8775, roughness: 0.95 });
  M.panel = S({ color: 0xc9c4bb, metalness: 0.2, roughness: 0.6 });
  M.accent = S({ color: 0x5980a6, metalness: 0.3, roughness: 0.5 });
  M.hazard = S({ color: 0xc8962a, roughness: 0.7 });
  M.padLine = S({ color: 0xd9d3c6, roughness: 0.85 });
  M.solar = S({ color: 0x18264a, metalness: 0.7, roughness: 0.22 });
  M.glass = S({ color: 0x9cc8f0, emissive: 0x6aa6e0, emissiveIntensity: 0.6, metalness: 0.2, roughness: 0.2 });
  M.window = S({ color: 0x242426, emissive: 0xffc88a, emissiveIntensity: 0.2, roughness: 0.3 });
  M.lamp = S({ color: 0x3a3a3a, emissive: 0xfff0d2, emissiveIntensity: 0.15 });
  M.grow = S({ color: 0x7d9a86, emissive: 0x9dffb0, emissiveIntensity: 0.05, transparent: true, opacity: 0.5, roughness: 0.12, metalness: 0.1, depthWrite: false });
  M.beacon = new THREE.MeshBasicMaterial({ color: 0xcfe6ff, toneMapped: false });
  M.red = new THREE.MeshBasicMaterial({ color: 0xff2a14, toneMapped: false });
  M.fabric = S({ color: 0xe9e5dd, roughness: 0.92, side: THREE.DoubleSide });
  M.floor = S({ color: 0xa7a299, roughness: 0.8 });
  M.soil = S({ color: 0x3a2417, roughness: 1 });
  M.leaf = S({ color: 0xffffff, roughness: 0.75, flatShading: true });
  M.growLight = S({ color: 0x444444, emissive: 0xffe0f2, emissiveIntensity: 1.6 });
  M.ore = S({ color: 0x7a4128, roughness: 0.95, flatShading: true });
  M.darkRed = S({ color: 0x3a2a26, metalness: 0.6, roughness: 0.5 });
  M.darken = S({ color: 0x1c1919, metalness: 0.75, roughness: 0.36 });
  M.core = S({ color: 0x401008, emissive: 0xff4a1a, emissiveIntensity: 2.2, roughness: 0.4 });
  // [material, emissive by day, emissive at night]
  M.glows = [[M.glass, 0.25, 1.4], [M.window, 0.12, 2.4], [M.lamp, 0.1, 4], [M.grow, 0.05, 1.6]];
  return M;
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);
function beam(g, a, b, t, mat) {
  const d = new THREE.Vector3().subVectors(b, a), len = d.length();
  const m = new THREE.Mesh(new THREE.BoxGeometry(t, t, len), mat);
  m.position.copy(a).addScaledVector(d, 0.5); m.lookAt(b); m.castShadow = true; g.add(m); return m;
}
const box = (g, w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
const cyl = (g, r1, r2, h, seg, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); return m; };

export function buildRelay() {
  const m = mats(), g = new THREE.Group(), H = 38;
  cyl(g, 17, 18, 1.2, 48, m.concrete, 0, 0.3, 0);
  const ring = new THREE.Mesh(new THREE.RingGeometry(15.4, 16.3, 64), m.hazard); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.92; g.add(ring);
  box(g, 12, 4.6, 7, m.panel, -6, 3.2, 6); box(g, 12.4, 0.5, 7.4, m.dark, -6, 5.7, 6);
  box(g, 12.1, 0.8, 0.2, m.accent, -6, 4.2, 9.55); box(g, 3, 2.2, 0.2, m.glass, -2, 3.4, 9.6); box(g, 1.4, 2.6, 0.15, m.dark, -9.6, 2.2, 9.58);
  for (const x of [-10.4, -7.6]) box(g, 1.6, 0.9, 2.2, m.steel, x, 6.4, 5.2);
  for (const x of [-9, -3]) { const t = cyl(g, 1.4, 1.4, 5.5, 20, m.steel, x, 1.9, -3); t.rotation.z = Math.PI / 2; }
  const spread = (y) => 3.4 + (1.0 - 3.4) * (y - 0.9) / (H - 0.9);
  const legs = [];
  for (const [sx, sz] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) legs.push([V(6 + sx * 3.4, 0.9, sz * 3.4), V(6 + sx * 1.0, H, sz * 1.0)]);
  for (const [a, b] of legs) beam(g, a, b, 0.45, m.steel);
  const at = (L, y) => new THREE.Vector3().lerpVectors(L[0], L[1], (y - 0.9) / (H - 0.9));
  for (let k = 0; k < 9; k++) {
    const y0 = 0.9 + k * 4.1, y1 = y0 + 4.1;
    for (let s = 0; s < 4; s++) { const A = legs[s], B = legs[(s + 1) % 4]; beam(g, at(A, y0), at(B, y1), 0.16, m.steel); beam(g, at(B, y0), at(A, y1), 0.16, m.steel); beam(g, at(A, y1), at(B, y1), 0.2, m.steel); }
  }
  beam(g, legs[0][0].clone().add(V(0.5, 0, 0)), legs[0][1].clone().add(V(0.35, 0, 0)), 0.32, m.dark);
  // service platforms with rails
  for (const y of [13.2, 27.2]) {
    const s = spread(y) + 0.9;
    box(g, s * 2, 0.22, s * 2, m.dark, 6, y, 0);
    for (const [dx, dz, w, d] of [[0, s, s * 2, 0.08], [0, -s, s * 2, 0.08], [s, 0, 0.08, s * 2], [-s, 0, 0.08, s * 2]]) box(g, w, 0.08, d, m.hazard, 6 + dx, y + 1.05, dz);
    for (const [dx, dz] of [[s, s], [-s, s], [-s, -s], [s, -s]]) box(g, 0.08, 1.05, 0.08, m.steel, 6 + dx, y + 0.55, dz);
  }
  box(g, 3.2, 0.35, 3.2, m.dark, 6, H, 0);
  for (let i = 0; i < 3; i++) { const a = i * 2.094 + 0.3; const p = box(g, 0.95, 3.6, 0.32, m.panel, 6 + Math.cos(a) * 1.9, H + 2.0, Math.sin(a) * 1.9); p.rotation.y = -a + Math.PI / 2; }
  const dish = new THREE.Mesh(new THREE.SphereGeometry(3.4, 28, 10, 0, Math.PI * 2, 0, 0.85), m.panel.clone());
  dish.material.side = THREE.DoubleSide; dish.position.set(6, H - 4, 2.4); dish.rotation.x = Math.PI / 2 + 0.35; dish.castShadow = true; g.add(dish);
  for (const [sx, a] of [[1, 0.5], [-1, -2.4]]) { const d = cyl(g, 1.25, 1.25, 0.55, 22, m.panel, 6 + sx * 2.5, 21, sx * 0.9); d.rotation.z = Math.PI / 2; d.rotation.y = a; }
  cyl(g, 0.12, 0.12, 10, 6, m.steel, 6, H + 5, 0);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 8), m.beacon); bulb.position.set(6, H + 10.2, 0); g.add(bulb);
  const light = new THREE.PointLight(0xcfe6ff, 0, 60, 2); light.position.copy(bulb.position); g.add(light);
  const av = [];
  for (const [y, k] of [[13.2, 1], [27.2, -1], [H, 1]]) for (const sx of [-1, 1]) {
    const s = spread(y) + 0.9, b = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), m.red); b.position.set(6 + sx * s, y + 1.35, k * s); g.add(b); av.push(b);
  }
  const pts = [];
  for (let i = 0; i < 3; i++) { const a = i * 2.094 + 0.5, ax = 6 + Math.cos(a) * 27, az = Math.sin(a) * 27; pts.push(6, H - 3, 0, ax, 0.9, az); box(g, 1.5, 1.1, 1.5, m.concrete, ax, 0.35, az); }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  g.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x5e5a56 })));
  g.userData = { r: 11, h: H, cx: 2, bulb, light, av, top: V(6, H * 0.5, 0) };
  return g;
}

export function buildMeson() {
  const m = mats(), g = new THREE.Group();
  cyl(g, 7, 8, 2.2, 6, m.darkRed, 0, 1.1, 0);
  cyl(g, 4.6, 5.2, 1.6, 6, m.darken, 0, 3.0, 0);
  for (let i = 0; i < 3; i++) {
    const a = i * 2.094, fin = new THREE.Group(); fin.rotation.y = -a; g.add(fin);
    const b = box(fin, 1.1, 15, 3.2, m.darken, 4.2, 8.5, 0); b.rotation.z = 0.16;
    box(fin, 0.14, 13, 0.14, m.core, 3.62, 9.1, 0).rotation.z = 0.16;
  }
  const segs = [[3.6, 3.0, 6.6, 6.5], [3.0, 2.4, 6.4, 13.3], [2.4, 1.5, 5.6, 19.6]];
  for (const [r1, r2, h, y] of segs) { cyl(g, r2, r1, h, 6, m.darken, 0, y, 0); cyl(g, r2 * 0.96, r2 * 0.96, 0.45, 6, m.core, 0, y + h / 2 + 0.25, 0); }
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + Math.PI / 6; const s = box(g, 0.16, 18, 0.16, m.core, Math.cos(a) * 2.75, 12.6, Math.sin(a) * 2.75); s.rotation.y = -a; s.rotation.z = 0.06; }
  const rings = [];
  for (const [y, r, tilt] of [[7.2, 5.0, 0.12], [13.6, 4.1, -0.16], [19.8, 3.2, 0.2]]) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.3, 8, 36), m.core); t.rotation.x = Math.PI / 2 + tilt; t.position.y = y; g.add(t); rings.push(t);
  }
  const top = new THREE.Group(); top.position.y = 25; g.add(top);
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(2.1), m.core); gem.scale.y = 1.6; top.add(gem);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.55), m.darken); s.scale.set(0.6, 2.4, 0.6); s.position.set(Math.cos(a) * 3.8, Math.sin(i * 1.7) * 0.8, Math.sin(a) * 3.8); top.add(s); }
  for (let i = 0; i < 3; i++) {
    const a = i * 2.094 + 1.05, x = Math.cos(a) * 10.5, z = Math.sin(a) * 10.5;
    box(g, 2.2, 1.6, 2.2, m.darkRed, x, 0.8, z);
    const c = cyl(g, 0.22, 0.22, 4.6, 6, m.dark, Math.cos(a) * 7.9, 0.3, Math.sin(a) * 7.9); c.rotation.z = Math.PI / 2; c.rotation.y = -a;
  }
  const fl = buildFlag('darken', 10); fl.position.set(Math.cos(2.1) * 12.5, 0, Math.sin(2.1) * 12.5); g.add(fl);
  const light = new THREE.PointLight(0xff5a20, 900, 70, 2); light.position.y = 24; g.add(light);
  g.userData = { r: 7.5, h: 26, rings, top, light };
  return g;
}

// Flags: cloth animated by world.update from the wind
export const flags = new Set();
function flagTex(kind) {
  const A = AGENCIES[kind] || AGENCIES[kind === 'union' ? 'nasa' : 'darken'], c = document.createElement('canvas'); c.width = 256; c.height = 154; const g = c.getContext('2d');
  const [c0, c1, c2] = A.flag;
  if (kind === 'darken') { g.fillStyle = c0; g.fillRect(0, 0, 256, 154); g.fillStyle = c1; g.beginPath(); g.moveTo(0, 0); g.lineTo(120, 77); g.lineTo(0, 154); g.closePath(); g.fill(); g.strokeStyle = c2; g.lineWidth = 7; g.beginPath(); g.moveTo(150, 40); g.lineTo(190, 114); g.lineTo(230, 40); g.stroke(); }
  else { g.fillStyle = c0; g.fillRect(0, 0, 256, 52); g.fillStyle = c1; g.fillRect(0, 51, 256, 52); g.fillStyle = c2; g.fillRect(0, 102, 256, 52);
    g.fillStyle = 'rgba(10,12,16,0.82)'; g.fillRect(0, 52, 256, 50); g.fillStyle = '#f2efe8'; g.font = '600 38px Barlow Condensed, Arial Narrow, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(A.name.toUpperCase(), 128, 78); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function buildFlag(kind, h = 9) {
  const m = mats(), g = new THREE.Group();
  cyl(g, 0.08, 0.11, h, 8, m.steel, 0, h / 2, 0); const f = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), m.steel); f.position.y = h + 0.1; g.add(f);
  cyl(g, 0.5, 0.6, 0.3, 10, m.concrete, 0, 0.15, 0);
  const geo = new THREE.PlaneGeometry(3.6, 2.2, 16, 8); geo.translate(1.8, 0, 0);
  const cloth = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: flagTex(kind), side: THREE.DoubleSide, roughness: 0.9 }));
  cloth.position.y = h - 1.25; cloth.castShadow = true; g.add(cloth);
  const rest = Float32Array.from(geo.attributes.position.array);
  const F = { group: g, cloth, rest, ph: Math.random() * 6 }; flags.add(F); return g;
}
export function animateFlags(t, wind) {
  const sp = Math.hypot(wind.x, wind.z), yaw = Math.atan2(-wind.z, wind.x), k = Math.min(1, sp / 7);
  for (const F of flags) {
    if (!F.group.parent) continue;
    F.cloth.rotation.y = yaw - (F.group.rotation.y || 0);
    const p = F.cloth.geometry.attributes.position, a = p.array, r = F.rest;
    for (let i = 0; i < p.count; i++) {
      const x = r[i * 3], y = r[i * 3 + 1], u = x / 3.6;
      a[i * 3] = x * (0.55 + 0.45 * k); a[i * 3 + 1] = y - u * (1 - k) * 1.1;
      a[i * 3 + 2] = Math.sin(x * 1.7 - t * (3 + sp * 0.9) + F.ph) * 0.32 * u * (0.4 + k) + Math.sin(y * 2.1 + t * 2.3) * 0.06 * u;
    }
    p.needsUpdate = true; F.cloth.geometry.computeVertexNormals();
  }
}

// Union outpost around the relay, or a forward camp at the dropship.
export function hab(len) {
  const m = mats(), g = new THREE.Group(), r = 3.2;
  const b = cyl(g, r, r, len, 28, m.panel, 0, 2.3, 0); b.rotation.z = Math.PI / 2;
  for (let i = 0; i < 4; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(r + 0.05, 0.16, 6, 28), m.steel); t.rotation.y = Math.PI / 2; t.position.set(-len / 2 + 0.6 + i * (len - 1.2) / 3, 2.3, 0); g.add(t); }
  for (const s of [-1, 1]) { const c = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 12, 0, Math.PI), m.panel); c.rotation.y = s * Math.PI / 2; c.position.set(s * len / 2, 2.3, 0); c.scale.x = 0.45; c.castShadow = true; g.add(c); }
  box(g, 2.6, 2.8, 2.6, m.accent, len / 2 + 1.6, 1.6, 0); box(g, 0.1, 2.0, 1.2, m.dark, len / 2 + 2.95, 1.4, 0);
  for (let i = 0; i < 4; i++) box(g, 1.1, 0.5, 0.12, m.window, -len / 2 + 2.4 + i * (len - 4.8) / 3, 3.3, r - 0.25).rotation.x = -0.4;
  box(g, len * 0.7, 0.18, 0.5, m.accent, 0, 2.3, r + 0.02);
  box(g, 1.4, 0.7, 1.0, m.steel, -len * 0.2, 5.6, 0); cyl(g, 0.06, 0.06, 3, 5, m.steel, len * 0.25, 6.6, 0.8);
  return g;
}
export function greenhouse(r) {
  const m = mats(), g = new THREE.Group();
  const geo = new THREE.IcosahedronGeometry(r, 1);
  const glass = new THREE.Mesh(geo, m.grow); glass.position.y = 0.4; g.add(glass);
  const fr = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0x9aa0a6 })); fr.position.y = 0.4; g.add(fr);
  cyl(g, r * 0.98, r, 0.6, 20, m.concrete, 0, 0.2, 0);
  return g;
}
export function solarRow(n, tilt) {
  const m = mats(), g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * 3.6;
    cyl(g, 0.1, 0.12, 1.5, 6, m.steel, x, 0.75, 0);
    const p = box(g, 3.3, 0.08, 2.0, m.solar, x, 1.6, 0); p.rotation.x = tilt;
    box(g, 3.4, 0.12, 0.08, m.steel, x, 1.6 + Math.sin(tilt) * 1.0, Math.cos(tilt) * 1.0).rotation.x = tilt;
  }
  return g;
}
export function tanks() {
  const m = mats(), g = new THREE.Group();
  for (const x of [-2.6, 2.6]) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(2.2, 20, 14), m.panel); s.position.set(x, 3.4, 0); s.castShadow = true; g.add(s);
    for (const [dx, dz] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) cyl(g, 0.12, 0.12, 2.4, 5, m.steel, x + dx * 1.3, 1.2, dz * 1.3);
    box(g, 4.4, 0.25, 0.25, m.hazard, x, 3.4, 2.2);
  }
  const p = cyl(g, 0.18, 0.18, 5.2, 6, m.steel, 0, 1.2, 0); p.rotation.z = Math.PI / 2;
  return g;
}
function container(mat) { const m = mats(), g = new THREE.Group(); box(g, 6, 2.6, 2.4, mat, 0, 1.3, 0); for (const s of [-1, 1]) box(g, 0.12, 2.5, 2.42, m.steel, s * 3.0, 1.3, 0); box(g, 6.02, 0.14, 2.42, m.steel, 0, 2.55, 0); return g; }
function mast(h) { const m = mats(), g = new THREE.Group(); cyl(g, 0.16, 0.22, h, 8, m.steel, 0, h / 2, 0); const hd = box(g, 1.3, 0.55, 0.8, m.lamp, 0, h + 0.1, 0.25); hd.rotation.x = 0.6; box(g, 0.9, 1.2, 0.5, m.dark, 0, 1.0, 0.25); return g; }
export function pad(r) {
  const m = mats(), g = new THREE.Group();
  cyl(g, r, r + 0.4, 0.4, 40, m.concrete, 0, 0.15, 0);
  const ln = new THREE.Mesh(new THREE.RingGeometry(r * 0.76, r * 0.8, 48), m.padLine); ln.rotation.x = -Math.PI / 2; ln.position.y = 0.37; g.add(ln);
  for (const a of [0, Math.PI / 2]) { const b = box(g, r * 0.9, 0.04, 0.5, m.padLine, 0, 0.36, 0); b.rotation.y = a + Math.PI / 4; }
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; cyl(g, 0.22, 0.26, 0.5, 8, m.lamp, Math.cos(a) * (r - 0.6), 0.5, Math.sin(a) * (r - 0.6)); }
  return g;
}

// "The Hab": pressurised fabric dome with a potato farm inside, walkable through the airlock (local +z).
export function habDome() {
  const m = mats(), g = new THREE.Group(), R = 9.2, gap = 0.3, V2 = (x, y) => new THREE.Vector2(x, y);
  const low = new THREE.Mesh(new THREE.LatheGeometry([V2(9.2, 0), V2(9.15, 1.3), V2(8.6, 2.6)], 48, gap / 2, Math.PI * 2 - gap), m.fabric);
  const up = new THREE.Mesh(new THREE.LatheGeometry([V2(8.6, 2.6), V2(7.2, 3.5), V2(5, 4.15), V2(2.5, 4.45), V2(0.01, 4.5)], 48), m.fabric);
  for (const s of [low, up]) { s.castShadow = s.receiveShadow = true; g.add(s); }
  for (const [y, r] of [[3.0, 7.95], [4.05, 5.6]]) { const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.035, 4, 64), m.steel); t.rotation.x = Math.PI / 2; t.position.y = y; g.add(t); }
  const prof = [[9.2, 0], [9.15, 1.3], [8.6, 2.6], [7.2, 3.5], [5, 4.15], [2.5, 4.45], [0.01, 4.5]], seam = [];
  for (let i = 1; i < 12; i++) { const a = i / 12 * Math.PI * 2; for (let k = 0; k < prof.length - 1; k++) { const [r0, y0] = prof[k], [r1, y1] = prof[k + 1]; if (y1 < 2.6 && Math.abs(Math.sin(a / 2)) < 0.2) continue; seam.push(Math.sin(a) * r0 * 1.003, y0, Math.cos(a) * r0 * 1.003, Math.sin(a) * r1 * 1.003, y1, Math.cos(a) * r1 * 1.003); } }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(seam, 3)); g.add(new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: 0x9b968e })));
  // airlock tunnel
  for (const s of [-1, 1]) box(g, 0.2, 2.6, 4.2, m.panel, s * 1.4, 1.3, 10.3);
  box(g, 3.0, 0.25, 4.2, m.panel, 0, 2.72, 10.3); box(g, 3.0, 0.08, 4.2, m.floor, 0, 0.04, 10.3);
  for (const s of [-1, 1]) box(g, 0.35, 2.9, 0.35, m.dark, s * 1.5, 1.45, 12.45);
  box(g, 3.35, 0.35, 0.35, m.dark, 0, 2.9, 12.45); box(g, 1.3, 2.4, 0.1, m.accent, 2.25, 1.2, 12.5);
  box(g, 0.5, 0.18, 0.18, m.lamp, 0, 3.15, 12.5); box(g, 3.1, 0.2, 0.2, m.hazard, 0, 0.1, 12.45);
  // floor, beds, plants, grow lights
  const fl = new THREE.Mesh(new THREE.CircleGeometry(9.0, 48), m.floor); fl.rotation.x = -Math.PI / 2; fl.position.y = 0.05; fl.receiveShadow = true; g.add(fl);
  const beds = [[-2.4, 9, -1.2], [2.4, 9, -1.2], [-4.9, 8, -0.6], [4.9, 8, -0.6], [-7.1, 5, 0], [7.1, 5, 0]];
  const plants = []; for (const [x, len, zc] of beds) for (let z = zc - len / 2 + 0.35; z < zc + len / 2 - 0.2; z += 0.6) for (const o of [-0.27, 0.27]) plants.push([x + o, z]);
  const pm = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), m.leaf, plants.length); pm.castShadow = true;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
  plants.forEach(([x, z], i) => { const k = 0.75 + Math.random() * 0.45; e.set(Math.random() * 0.4, Math.random() * 6, 0); q.setFromEuler(e); sc.set(0.3 * k, 0.25 * k, 0.3 * k);
    pm.setMatrixAt(i, m4.compose(p.set(x, 0.72 + 0.1 * k, z), q, sc)); pm.setColorAt(i, col.setHSL(0.27 + Math.random() * 0.05, 0.45, 0.24 + Math.random() * 0.1)); });
  g.add(pm);
  for (const [x, len, zc] of beds) { box(g, 1.3, 0.5, len, m.steel, x, 0.25, zc); box(g, 1.15, 0.1, len - 0.1, m.soil, x, 0.55, zc); box(g, 0.9, 0.05, len, m.growLight, x, 2.45, zc).castShadow = false; }
  // life support at the back
  cyl(g, 0.9, 0.9, 2.2, 16, m.panel, -3, 1.1, -7.3); cyl(g, 0.92, 0.92, 0.2, 16, m.accent, -3, 1.6, -7.3);
  box(g, 2, 1.8, 1, m.steel, 0, 0.9, -8.1); box(g, 1.6, 0.25, 0.05, m.lamp, 0, 1.4, -7.58);
  box(g, 2.4, 0.08, 1, m.panel, 3.4, 0.85, -7.1); for (const [dx, dz] of [[-1.1, -0.4], [1.1, -0.4], [-1.1, 0.4], [1.1, 0.4]]) box(g, 0.06, 0.85, 0.06, m.steel, 3.4 + dx, 0.42, -7.1 + dz);
  box(g, 0.95, 0.6, 0.05, m.glass, 3.4, 1.3, -7.5); box(g, 2.1, 0.45, 0.9, m.accent, 6.6, 0.3, -4.3).rotation.y = 0.9;
  const L = new THREE.PointLight(0xfff1e2, 70, 20, 2); L.position.set(0, 3.7, -0.5); g.add(L);
  return g;
}
export function mineRig() {
  const m = mats(), g = new THREE.Group(), H = 15, X = -10, legs = [];
  box(g, 7, 0.5, 7, m.concrete, X, 0.25, 0); cyl(g, 1.0, 1.0, 0.1, 16, m.dark, X, 0.55, 0);
  for (const [sx, sz] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) legs.push([V(X + sx * 2.6, 0.5, sz * 2.6), V(X + sx * 0.7, H, sz * 0.7)]);
  for (const [a, c] of legs) beam(g, a, c, 0.3, m.hazard);
  const at = (L, y) => new THREE.Vector3().lerpVectors(L[0], L[1], (y - 0.5) / (H - 0.5));
  for (let k = 0; k < 4; k++) { const y0 = 0.5 + k * 3.6, y1 = y0 + 3.6; for (let s = 0; s < 4; s++) { const A = legs[s], B = legs[(s + 1) % 4]; beam(g, at(A, y0), at(B, y1), 0.12, m.steel); beam(g, at(A, y1), at(B, y1), 0.14, m.steel); } }
  box(g, 2, 1, 2, m.dark, X, H + 0.5, 0);
  const pipe = cyl(g, 0.22, 0.22, H + 2, 10, m.steel, X, (H + 2) / 2 - 1.5, 0);
  const head = box(g, 1.6, 1.2, 1.6, m.accent, X, 8, 0);
  box(g, 3.2, 2.2, 2.4, m.panel, X + 3.8, 1.1, -2.6); cyl(g, 0.3, 0.3, 2.8, 8, m.dark, X + 4.6, 3.4, -2.6);
  // hopper, conveyor, ore piles
  cyl(g, 2.1, 0.7, 2.2, 8, m.steel, -3.5, 3.8, 0); for (const [dx, dz] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) cyl(g, 0.1, 0.1, 2.8, 5, m.steel, -3.5 + dx * 1.2, 1.4, dz * 1.2);
  const A = V(-2.6, 2.4, 0), B = V(11.5, 7.2, 0), d = new THREE.Vector3().subVectors(B, A), len = d.length(), ang = Math.atan2(d.y, d.x);
  const belt = box(g, len, 0.22, 1.3, m.dark, (A.x + B.x) / 2, (A.y + B.y) / 2, 0); belt.rotation.z = ang;
  for (const s of [-1, 1]) { const r = box(g, len, 0.18, 0.08, m.hazard, (A.x + B.x) / 2, (A.y + B.y) / 2 + 0.2, s * 0.68); r.rotation.z = ang; }
  for (const t of [0.3, 0.62, 0.92]) { const x = A.x + d.x * t, y = A.y + d.y * t; cyl(g, 0.1, 0.12, y, 5, m.steel, x, y / 2, 0.5); cyl(g, 0.1, 0.12, y, 5, m.steel, x, y / 2, -0.5); }
  const pile = (r, h, x, z) => { const c = new THREE.ConeGeometry(r, h, 14, 3); const pp = c.attributes.position; for (let i = 0; i < pp.count; i++) { const y = pp.getY(i); if (y < h / 2 - 0.01) { const k = 0.85 + Math.random() * 0.3; pp.setX(i, pp.getX(i) * k); pp.setZ(i, pp.getZ(i) * k); pp.setY(i, y + (Math.random() - 0.5) * 0.3); } } c.computeVertexNormals(); const o = new THREE.Mesh(c, m.ore); o.position.set(x, h / 2 - 0.2, z); o.castShadow = o.receiveShadow = true; g.add(o); };
  pile(5, 4, 13, 0); pile(3.4, 2.6, 9, 6.2); pile(2.6, 1.9, 15.5, -5);
  const N = 22, chunks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.28), m.ore, N); chunks.castShadow = true; g.add(chunks);
  const shed = new THREE.Group(); box(shed, 6, 4, 5, m.panel, 0, 2, 0); box(shed, 6.2, 0.3, 5.2, m.dark, 0, 4.15, 0); box(shed, 6.05, 0.6, 0.1, m.accent, 0, 3.0, 2.52); box(shed, 2.2, 2.6, 0.1, m.dark, -1.2, 1.3, 2.53); box(shed, 1.0, 0.5, 0.08, m.window, 1.6, 2.2, 2.54);
  shed.position.set(-7, 0, -10); g.add(shed);
  const tmpM = new THREE.Matrix4(), tq = new THREE.Quaternion(), ts = new THREE.Vector3(1, 1, 1), tp = new THREE.Vector3();
  g.userData.update = (t) => {
    pipe.rotation.y = t * 2.4; head.position.y = 7 + Math.sin(t * 0.18) * 3.5; head.rotation.y = t * 2.4;
    for (let i = 0; i < N; i++) { const u = (t * 0.09 + i / N) % 1; tp.lerpVectors(A, B, u); tp.y += 0.3; tq.setFromAxisAngle(ts.set(0.3, 1, 0.2).normalize(), i * 1.7 + t); ts.set(1, 1, 1).multiplyScalar(0.7 + (i % 3) * 0.25); chunks.setMatrixAt(i, tmpM.compose(tp, tq, ts)); }
    chunks.instanceMatrix.needsUpdate = true;
  };
  g.userData.parts = [[X, 0, 4.5], [-3.5, 0, 2.5], [13, 0, 5], [9, 6.2, 3.5], [15.5, -5, 3], [-7, -10, 4], [X + 3.8, -2.6, 2.2]];
  g.userData.load = [-4, 6];
  return g;
}
export function rover() {
  // Pressurised haul rover: crew cab with suitports, six wheels on swing arms, ore bin, fuel-cell rack, roof radiator
  const m = mats(), g = new THREE.Group(), wheels = [];
  box(g, 2.3, 0.35, 6.4, m.dark, 0, 0.95, 0);
  for (const z of [-2.3, 0, 2.3]) for (const s of [-1, 1]) {
    const arm = box(g, 0.5, 0.18, 0.9, m.steel, s * 1.25, 0.82, z - 0.25); arm.rotation.x = 0.25;
    const w = cyl(g, 0.66, 0.66, 0.5, 20, m.dark, s * 1.62, 0.66, z); w.rotation.z = Math.PI / 2; wheels.push(w);
    for (let k = 0; k < 6; k++) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.06, 0.16), m.steel); const an = k / 6 * Math.PI * 2; t.position.set(0, Math.cos(an) * 0.63, Math.sin(an) * 0.63); t.rotation.x = -an; w.add(t); }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.54, 10), m.steel); w.add(hub);
    box(g, 0.6, 0.06, 1.5, m.panel, s * 1.62, 1.42, z);
  }
  // cab: rounded nose, wraparound glass, suitport hatches on the back wall
  const cab = new THREE.Group(); cab.position.set(0, 1.1, 1.7); g.add(cab);
  box(cab, 2.5, 1.7, 2.4, m.panel, 0, 1.0, 0);
  const nose = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 2.5, 20, 1, false, 0, Math.PI), m.panel); nose.rotation.z = Math.PI / 2; nose.rotation.y = Math.PI / 2; nose.scale.set(1, 1, 0.55); nose.position.set(0, 1.0, 1.2); nose.castShadow = true; cab.add(nose);
  const gl = new THREE.Mesh(new THREE.CylinderGeometry(1.27, 1.27, 2.3, 20, 1, true, 0.35, Math.PI - 0.7), m.glass); gl.rotation.z = Math.PI / 2; gl.rotation.y = Math.PI / 2; gl.scale.set(1, 1, 0.56); gl.position.set(0, 1.05, 1.2); cab.add(gl);
  for (const s of [-1, 1]) { box(cab, 0.06, 0.5, 1.1, m.glass, s * 1.27, 1.25, 0.2); box(cab, 0.4, 0.22, 0.08, m.lamp, s * 0.85, 0.35, 1.86); }
  box(cab, 2.56, 0.18, 2.46, m.accent, 0, 0.2, 0);
  for (const s of [-1, 1]) { const sp = cyl(cab, 0.42, 0.42, 0.14, 18, m.steel, s * 0.6, 1.0, -1.25); sp.rotation.x = Math.PI / 2; cyl(cab, 0.32, 0.32, 0.16, 18, m.dark, s * 0.6, 1.0, -1.27).rotation.x = Math.PI / 2; }
  box(cab, 2.6, 0.08, 1.8, m.panel, 0, 1.92, -0.1);
  const rad = box(cab, 2.2, 0.04, 1.4, m.steel, 0, 2.15, -0.1); rad.rotation.x = 0.12;
  cyl(cab, 0.03, 0.03, 1.5, 4, m.steel, -0.9, 2.6, -0.6); const dish = cyl(cab, 0.28, 0.12, 0.08, 14, m.steel, 0.8, 2.3, -0.7); dish.rotation.x = 0.6;
  for (let i = 0; i < 4; i++) box(cab, 0.32, 0.12, 0.12, m.lamp, -0.6 + i * 0.4, 2.0, 1.15);
  // ore bin and cell rack
  box(g, 2.4, 0.2, 3.3, m.steel, 0, 1.25, -1.45);
  for (const [w, h, d, x, z] of [[2.4, 1.1, 0.12, 0, 0.15], [2.4, 1.1, 0.12, 0, -3.05], [0.12, 1.1, 3.3, 1.14, -1.45], [0.12, 1.1, 3.3, -1.14, -1.45]]) box(g, w, h, d, m.accent, x, 1.85, z);
  const ore = box(g, 2.15, 0.55, 3.0, m.ore, 0, 2.2, -1.45);
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { cyl(g, 0.16, 0.16, 0.5, 10, m.steel, s * 1.3, 1.55, -0.6 - k * 0.45).rotation.x = Math.PI / 2; const c = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.16, 10), new THREE.MeshBasicMaterial({ color: 0x7dffa0, toneMapped: false })); c.rotation.x = Math.PI / 2; c.position.set(s * 1.3, 1.55, -0.6 - k * 0.45); g.add(c); }
  for (const s of [-1, 1]) box(g, 0.22, 0.12, 0.06, m.red || m.lamp, s * 1.0, 1.25, -3.22);
  return { g, wheels, ore };
}
const colonyFrame = (lay) => {
  if (!lay.relay) return null;
  const [cx, cz] = lay.relay, az = ((lay.spawnArc[0] + lay.spawnArc[1]) / 2) * Math.PI / 180;
  const bx = -Math.sin(az), bz = Math.cos(az), px = bz, pz = -bx;
  return { P: (f, s) => [cx + bx * f + px * s, cz + bz * f + pz * s], along: Math.atan2(-pz, px), cx, cz };
};
export function colonyPads(lay) {
  const F = colonyFrame(lay); if (!F) return [];
  const [hx, hz] = F.P(80, 10), [mx, mz] = F.P(84, -52);
  return [{ x: hx, z: hz, r: 15 }, { x: mx, z: mz, r: 19 }];
}

export function buildBase(H, lay, lat) {
  resetInfra();
  const m = mats(), root = new THREE.Group(), colliders = [], lamps = [], habs = [], anims = [];
  let dock = null;
  const placeDock = (spots) => { for (const [x, z, yaw] of spots) { const o = put(chargeDock(), x, z, 9, yaw, 0.05, false); if (o) { dock = { x, z, r: 6, obj: o, stock: 3, t: 0 }; colliders.push({ x: x + Math.cos(yaw) * 8.4, z: z - Math.sin(yaw) * 8.4, r: 1.2 }); return; } } };
  const fk = lay.flag || 'nasa'; m.accent.color.set(AGENCIES[fk]?.color || '#5980a6'); let mine = null;
  let haul = null;
  const keep = [];
  if (lay.start) keep.push([lay.start[0], lay.start[1], 13]);
  const put = (obj, x, z, r, yaw = 0, sink = 0.15, col = true) => {
    for (const [kx, kz, kr] of keep) if (Math.hypot(x - kx, z - kz) < kr + r) return null;
    obj.position.set(x, H(x, z) - sink, z); obj.rotation.y = yaw; root.add(obj); keep.push([x, z, r]); if (col) colliders.push({ x, z, r }); return obj;
  };
  const light = (x, z, tx, tz, k = 2400) => {
    const o = put(mast(10), x, z, 1.2, Math.atan2(tx - x, tz - z), 0.1, false); if (!o) return;
    const L = new THREE.SpotLight(0xfff0d8, 0, 95, 0.75, 0.6, 1.6); L.position.set(x, H(x, z) + 10.4, z);
    L.target.position.set(tx, H(tx, tz), tz); root.add(L, L.target); lamps.push({ light: L, k });
  };
  if (lay.dropship) { const [x, z] = lay.dropship; const p = pad(13); p.position.set(x, H(x, z) - 0.1, z); root.add(p); keep.push([x, z, 15]); }
  const tilt = Math.min(0.75, Math.abs(lat) * Math.PI / 180 + 0.2), face = lat < 0 ? 0 : Math.PI;
  if (lay.relay) {
    const [cx, cz] = lay.relay;
    keep.push([cx, cz, 30]);
    const az = ((lay.spawnArc[0] + lay.spawnArc[1]) / 2) * Math.PI / 180;
    const bx = -Math.sin(az), bz = Math.cos(az), px = bz, pz = -bx;
    const P = (f, s) => [cx + bx * f + px * s, cz + bz * f + pz * s];
    const along = Math.atan2(-pz, px);
    let [x, z] = P(40, -15); put(hab(14), x, z, 8.5, along);
    [x, z] = P(41, 12); put(hab(11), x, z, 7.5, along + 0.25);
    [x, z] = P(55, -1); put(greenhouse(6.5), x, z, 7);
    for (let i = 0; i < 3; i++) { [x, z] = P(22 + i * 5.5, 36); put(solarRow(3, tilt), x, z, 6, face); }
    [x, z] = P(20, -38); put(tanks(), x, z, 5.5, along);
    [x, z] = P(52, -26); put(container(m.accent), x, z, 3.6, along + 0.1);
    [x, z] = P(55, -20.5); put(container(m.panel), x, z, 3.6, along - 0.05);
    [x, z] = P(24, 10); put(buildFlag(fk, 11), x, z, 1.2, 0, 0.1, false);
    // power and propellant: reactor far out behind a berm, solar blankets, the plant, an ice pit, a tanker on its pad
    for (const [f, s] of [[150, 55], [140, -70], [160, 0]]) { [x, z] = P(f, s); if (put(reactor(), x, z, 9, along)) break; }
    for (const [f, s] of [[128, -16], [120, 70], [-30, 70]]) { [x, z] = P(f, s); if (put(solarField(4, 26, tilt * 0.6), x, z, 16, along + Math.PI / 2)) break; }
    for (const [f, s] of [[30, -66], [10, -80], [60, 80]]) { [x, z] = P(f, s); if (put(propPlant(), x, z, 13, along)) break; }
    for (const [f, s] of [[58, -84], [0, -100], [96, 92]]) { [x, z] = P(f, s); if (put(iceMine(), x, z, 11, along + 0.6)) break; }
    for (const [f, s] of [[112, 84], [130, 110], [70, 120]]) { [x, z] = P(f, s); const tp = pad(13); if (put(tankerShip(), x, z, 14, along + 2.2, 0.05)) { tp.position.set(x, H(x, z) - 0.08, z); root.add(tp); break; } }
    { const sp = [[2, -50], [-6, 52], [16, 60], [-20, -40]].map(([f, s]) => { const q = P(f, s); return [q[0], q[1], along]; }); placeDock(sp); }
    const [mx, mz] = P(38, 0);
    for (const [f, s] of [[30, -28], [30, 27], [62, 12]]) { [x, z] = P(f, s); light(x, z, mx, mz); }
    // The Hab with its farm, door facing the relay
    [x, z] = P(80, 10); const hy = Math.atan2(cx - x, cz - z);
    if (put(habDome(), x, z, 12.5, hy, 0.05, false)) {
      colliders.push({ ring: true, x, z, r: 9.2, yaw: hy, door: 1.3, len: 4.2 });
      habs.push({ x, z, r: 9.2, yaw: hy });
    }
    // Ore mine, rover haul road to the lander pad
    [x, z] = P(84, -52); const my = Math.atan2(cx - x, cz - z) + Math.PI / 2;
    const rig = put(mineRig(), x, z, 17, my, 0.1, false);
    if (rig) {
      mine = { x, z, obj: rig };
      const cw = (lx, lz) => [x + lx * Math.cos(my) + lz * Math.sin(my), z - lx * Math.sin(my) + lz * Math.cos(my)];
      for (const [lx, lz, r] of rig.userData.parts) { const [wx, wz] = cw(lx, lz); colliders.push({ x: wx, z: wz, r }); }
      anims.push(rig.userData.update);
      const [lx2, lz2] = cw(...rig.userData.load); light(...cw(-2, -6), lx2, lz2, 2000);
      if (lay.dropship) {
        const [dx, dz] = lay.dropship, w2 = P(62, 60), dd = Math.hypot(w2[0] - dx, w2[1] - dz);
        const path = [[lx2, lz2], P(102, -20), P(102, 30), w2, [dx + (w2[0] - dx) / dd * 15, dz + (w2[1] - dz) / dd * 15]];
        const rv = rover(); root.add(rv.g);
        const col = { x: lx2, z: lz2, r: 3.2 }; colliders.push(col);
        haul = { rv, path, seg: 0, dir: 1, wait: 6, x: lx2, z: lz2, yaw: 0, col, loaded: true, trips: 0 };
      }
    }
  } else if (lay.dropship) {
    const [dx, dz] = lay.dropship, sx = lay.start[0] - dx, sz = lay.start[1] - dz, d = Math.hypot(sx, sz) || 1, ux = -sx / d, uz = -sz / d;
    const along = Math.atan2(uz, -ux);
    put(hab(10), dx + ux * 24 - uz * 8, dz + uz * 24 + ux * 8, 7, along);
    put(container(m.accent), dx + ux * 20 + uz * 12, dz + uz * 20 - ux * 12, 3.6, along + 0.4);
    put(solarRow(3, tilt), dx - uz * 22, dz + ux * 22, 6, face);
    light(dx + ux * 14 + uz * 16, dz + uz * 14 - ux * 16, dx, dz, 2000);
    put(buildFlag(fk), dx + ux * 17 - uz * 1, dz + uz * 17 + ux * 1, 1.2, 0, 0.1, false);
    placeDock([[dx - ux * 4 + uz * 24, dz - uz * 4 - ux * 24, along], [dx + ux * 30 + uz * 20, dz + uz * 30 - ux * 20, along], [dx - uz * 30, dz + ux * 30, along]]);
    put(solarField(2, 18, tilt * 0.6), dx + ux * 34 - uz * 26, dz + uz * 34 + ux * 26, 11, along);
  }
  const update = (dt, t) => {
    for (const f of anims) f(t);
    animateInfra(t);
    if (dock) { const u = dock.obj.userData; dock.t += dt; u.trolley.position.x = Math.sin(dock.t * 0.35) * (dock.busy ? 0.3 : 5.5); for (let i = 0; i < u.slots.length; i++) u.slots[i].visible = i < dock.stock * 2; }
    if (!haul) return;
    const h = haul, rv = h.rv;
    if (h.wait > 0) { h.wait -= dt; }
    else {
      const nxt = h.path[h.seg + h.dir], dx = nxt[0] - h.x, dz = nxt[1] - h.z, d = Math.hypot(dx, dz), sp = 6.5;
      const ty = Math.atan2(dx, dz); let dy = ty - h.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); h.yaw += dy * Math.min(1, dt * 2.5);
      const st = Math.min(d, sp * dt * (0.4 + 0.6 * Math.max(0, Math.cos(dy))));
      h.x += Math.sin(h.yaw) * st; h.z += Math.cos(h.yaw) * st;
      for (const w of rv.wheels) w.rotation.x += st / 0.58;
      if (d < 1.2) { h.seg += h.dir; if (h.seg === h.path.length - 1 || h.seg === 0) { h.dir *= -1; h.wait = 9; h.loaded = h.seg === 0; if (!h.loaded) h.trips++; } }
    }
    rv.ore.visible = h.loaded;
    const y = H(h.x, h.z), yf = H(h.x + Math.sin(h.yaw) * 2.5, h.z + Math.cos(h.yaw) * 2.5), yb = H(h.x - Math.sin(h.yaw) * 2.5, h.z - Math.cos(h.yaw) * 2.5);
    rv.g.position.set(h.x, y, h.z); rv.g.rotation.set(0, h.yaw, 0); rv.g.rotateX(-Math.atan2(yf - yb, 5));
    h.col.x = h.x; h.col.z = h.z;
  };
  return { group: root, colliders, lamps, habs, update, mine, dock, get haul() { return haul; } };
}
