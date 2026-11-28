// The real hardware that put each agency's flag on the ground, rebuilt at its landing site at true scale.
import { THREE } from './lib.js?v=22';

const S = (o) => new THREE.MeshStandardMaterial(o);
let M = null;
const mats = () => M || (M = {
  white: S({ color: 0xdedbd2, roughness: 0.6 }), dusty: S({ color: 0xc8a888, roughness: 0.85 }), grey: S({ color: 0x8f9296, metalness: 0.6, roughness: 0.45 }),
  dark: S({ color: 0x2a2b2e, metalness: 0.5, roughness: 0.55 }), gold: S({ color: 0xd4a33c, metalness: 1, roughness: 0.3 }), solar: S({ color: 0x14213d, metalness: 0.4, roughness: 0.25 }),
  blue: S({ color: 0x1d3f8a, metalness: 0.3, roughness: 0.3 }), wheel: S({ color: 0x9a9a98, metalness: 0.7, roughness: 0.45 }), foil: S({ color: 0xe8d8a0, metalness: 0.9, roughness: 0.35 }),
  bag: S({ color: 0xe9e4da, roughness: 0.95 }), black: S({ color: 0x0f0f10, roughness: 0.5 }), red: S({ color: 0x9b2b22, roughness: 0.6 }),
});
const B = (g, w, h, d, m, x, y, z, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
const C = (g, r1, r2, h, s, m, x, y, z, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, s), m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
const Sp = (g, r, m, x, y, z, sy = 1) => { const o = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), m); o.position.set(x, y, z); o.scale.y = sy; o.castShadow = true; g.add(o); return o; };
const disc = (g, r, sides, m, x, y, z, tilt = 0, ry = 0) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.04, sides), m); o.position.set(x, y, z); o.rotation.set(tilt, ry, 0); o.castShadow = true; g.add(o); return o; };

// six-wheel rocker-bogie chassis; returns deck height
function bogie(g, L, W, wr, m) {
  const y = wr; for (const s of [-1, 1]) for (const z of [-L / 2, 0, L / 2]) C(g, wr, wr, wr * 0.8, 16, m.wheel, s * W / 2, y, z, 0, 0, Math.PI / 2);
  for (const s of [-1, 1]) { B(g, 0.05, 0.05, L * 0.55, m.grey, s * W / 2.3, y + wr * 0.9, L / 4, -0.35); B(g, 0.05, 0.05, L * 0.6, m.grey, s * W / 2.3, y + wr * 0.9, -L / 5, 0.25); }
  return y + wr * 1.5;
}
function mast(g, h, m, x, z) { C(g, 0.06, 0.07, h, 8, m.white, x, h / 2, z); B(g, 0.35, 0.16, 0.18, m.white, x, h, z + 0.05); B(g, 0.1, 0.07, 0.03, m.black, x, h, z + 0.15); }
function rtg(g, m, y, z, tilt) { const r = C(g, 0.2, 0.2, 0.7, 12, m.dark, 0, y, z, tilt); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const f = B(r, 0.02, 0.62, 0.22, m.dark, Math.cos(a) * 0.26, 0, Math.sin(a) * 0.26); f.rotation.y = -a; } }

const BUILD = {
  msl(white) { const m = mats(), g = new THREE.Group(), body = white ? m.white : m.dusty; const y = bogie(g, 2.6, 2.4, 0.26, m);
    B(g, 1.6, 0.6, 2.0, body, 0, y + 0.3, 0); B(g, 1.7, 0.05, 2.1, m.grey, 0, y + 0.62, 0); rtg(g, m, y + 0.4, -1.2, -0.7);
    mast(g, y + 1.5, m, 0.5, 0.85); disc(g, 0.28, 6, m.grey, -0.4, y + 0.8, -0.2, -0.4); const arm = B(g, 0.08, 0.08, 1.4, m.grey, -0.5, y + 0.2, 1.35, 0.2); B(g, 0.3, 0.3, 0.3, m.dark, -0.5, y - 0.05, 2.0);
    return g; },
  ingenuity() { const m = mats(), g = new THREE.Group(); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.785; B(g, 0.02, 0.36, 0.02, m.grey, Math.cos(a) * 0.17, 0.16, Math.sin(a) * 0.17, Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); }
    B(g, 0.14, 0.14, 0.14, m.foil, 0, 0.34, 0); C(g, 0.012, 0.012, 0.3, 6, m.grey, 0, 0.55, 0);
    for (const [y, r] of [[0.48, 0], [0.56, 0.9]]) B(g, 1.2, 0.01, 0.07, m.dark, 0, y, 0, 0, r, 0); B(g, 0.17, 0.01, 0.1, m.solar, 0, 0.71, 0); return g; },
  mer() { const m = mats(), g = new THREE.Group(); const y = bogie(g, 1.2, 1.3, 0.13, m);
    B(g, 0.9, 0.4, 1.0, m.foil, 0, y + 0.2, 0); for (const [x, z, w, d] of [[0, 0, 1.4, 1.2], [-1.0, 0.1, 0.7, 0.9], [1.0, 0.1, 0.7, 0.9], [0, -0.85, 1.1, 0.55]]) B(g, w, 0.03, d, m.solar, x, y + 0.42, z);
    mast(g, y + 1.1, m, 0, 0.45); disc(g, 0.14, 12, m.grey, -0.35, y + 0.6, -0.3, -0.5); return g; },
  insight(phoenix) { const m = mats(), g = new THREE.Group(), y = 0.95;
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; B(g, 0.06, 1.0, 0.06, m.grey, Math.cos(a) * 0.6, y / 2, Math.sin(a) * 0.6, Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25); C(g, 0.15, 0.15, 0.04, 10, m.grey, Math.cos(a) * 0.72, 0.02, Math.sin(a) * 0.72); }
    C(g, 0.75, 0.75, 0.25, 6, m.foil, 0, y, 0); for (const s of [-1, 1]) { disc(g, 1.08, 10, m.solar, s * 1.75, y + 0.15, 0); disc(g, 1.1, 10, m.white, s * 1.75, y + 0.12, 0); }
    if (phoenix) { mast(g, y + 1.1, m, 0.3, 0.3); C(g, 0.02, 0.02, 1, 5, m.grey, -0.4, y + 0.6, -0.3); }
    else { Sp(g, 0.36, m.white, 0.3, 0.2, 1.9, 0.7); C(g, 0.4, 0.42, 0.06, 20, m.grey, 0.3, 0.03, 1.9); C(g, 0.12, 0.14, 0.4, 10, m.gold, -0.7, 0.2, 1.7); B(g, 0.06, 0.06, 1.8, m.grey, 0, y + 0.3, 0.9, 0.6); }
    return g; },
  viking() { const m = mats(), g = new THREE.Group(), y = 0.75;
    C(g, 0.75, 0.75, 0.45, 6, m.white, 0, y, 0); B(g, 1.2, 0.05, 1.2, m.foil, 0, y + 0.25, 0, 0, 0.5);
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + 0.5; B(g, 0.08, 0.9, 0.08, m.grey, Math.cos(a) * 0.85, y / 2, Math.sin(a) * 0.85, Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3); C(g, 0.2, 0.2, 0.05, 12, m.grey, Math.cos(a) * 1.0, 0.03, Math.sin(a) * 1.0); }
    for (const s of [-1, 1]) { const r = C(g, 0.14, 0.14, 0.55, 10, m.dark, s * 0.35, y + 0.55, -0.35); r.rotation.z = s * 0.2; }
    C(g, 0.03, 0.03, 0.8, 6, m.grey, 0.4, y + 0.6, 0.3); const dish = new THREE.Mesh(new THREE.SphereGeometry(0.4, 18, 6, 0, Math.PI * 2, 0, 0.9), m.white); dish.material.side = THREE.DoubleSide; dish.position.set(0.4, y + 1.05, 0.3); dish.rotation.x = Math.PI / 2 + 0.6; g.add(dish);
    B(g, 0.06, 0.06, 1.5, m.grey, -0.2, y + 0.1, 1.0, 0.35); B(g, 0.15, 0.12, 0.2, m.red, -0.2, y - 0.2, 1.7); mast(g, y + 0.6, m, -0.5, 0.4); return g; },
  pathfinder() { const m = mats(), g = new THREE.Group();
    const tri = (rx, ry) => { const s = new THREE.Shape(); s.moveTo(-0.9, 0); s.lineTo(0.9, 0); s.lineTo(0, 1.5); const o = new THREE.Mesh(new THREE.ShapeGeometry(s), m.solar); o.material.side = THREE.DoubleSide; o.rotation.set(rx, ry, 0); o.position.y = 0.06; o.castShadow = true; g.add(o); return o; };
    tri(-Math.PI / 2, 0); for (let i = 0; i < 3; i++) { const p = tri(-Math.PI / 2, i * 2.094); p.position.set(Math.sin(i * 2.094) * 0.5, 0.05, Math.cos(i * 2.094) * 0.5); }
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; Sp(g, 0.35 + (i % 3) * 0.08, m.bag, Math.cos(a) * 1.9, 0.15, Math.sin(a) * 1.9, 0.4); }
    mast(g, 1.0, m, 0, 0); B(g, 0.2, 0.2, 0.2, m.foil, 0, 0.2, 0);
    const soj = new THREE.Group(); soj.position.set(2.2, 0, 1.4); soj.rotation.y = 0.7; g.add(soj); const y = bogie(soj, 0.45, 0.42, 0.065, m); B(soj, 0.45, 0.02, 0.6, m.solar, 0, y + 0.12, 0); B(soj, 0.35, 0.12, 0.4, m.foil, 0, y + 0.05, 0);
    return g; },
  zhurong() { const m = mats(), g = new THREE.Group();
    const lander = new THREE.Group(); lander.position.set(-3.2, 0, 0); g.add(lander);
    C(lander, 1.1, 1.3, 0.6, 8, m.foil, 0, 1.1, 0); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.785; B(lander, 0.08, 1.1, 0.08, m.grey, Math.cos(a) * 1.2, 0.55, Math.sin(a) * 1.2, Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25); }
    for (const s of [-1, 1]) B(lander, 0.6, 0.04, 2.0, m.grey, 0.9 * s + (s > 0 ? 0.6 : 0), 0.7, s * 0.0, 0, 0, s * 0.45).visible = s > 0;
    const y = bogie(g, 1.6, 1.4, 0.15, m); B(g, 1.0, 0.45, 1.3, m.white, 0, y + 0.2, 0); B(g, 1.02, 0.04, 1.32, m.gold, 0, y + 0.44, 0);
    for (const [x, z, ry, rz] of [[-0.9, 0.2, 0, 0.35], [0.9, 0.2, 0, -0.35], [-0.45, -0.95, 0.4, 0.5], [0.45, -0.95, -0.4, -0.5]]) B(g, 0.85, 0.03, 0.75, m.blue, x, y + 0.55, z, 0, ry, rz);
    mast(g, y + 1.25, m, 0, 0.55); return g; },
  mars3() { const m = mats(), g = new THREE.Group(); Sp(g, 0.6, m.grey, 0, 0.55, 0);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; const p = B(g, 0.7, 0.04, 1.0, m.grey, Math.cos(a) * 0.95, 0.1, Math.sin(a) * 0.95, 0, -a + Math.PI / 2, 0); p.rotation.x = -0.15; }
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.785; C(g, 0.015, 0.015, 0.9, 5, m.grey, Math.cos(a) * 0.45, 1.1, Math.sin(a) * 0.45, Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); }
    B(g, 0.25, 0.12, 0.2, m.dark, 1.7, 0.06, 0.4); return g; },
  beagle() { const m = mats(), g = new THREE.Group(); C(g, 0.5, 0.5, 0.22, 24, m.gold, 0, 0.12, 0);
    for (const [a, open] of [[0, 1], [1.57, 1], [3.14, 0], [4.71, 0]]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.03, 20, 1, false, 0, Math.PI), m.solar); p.castShadow = true; p.position.set(Math.cos(a) * 0.05, 0.25, Math.sin(a) * 0.05); p.rotation.y = -a; p.rotation.z = open ? -1.5 : -0.25; g.add(p); }
    return g; },
  rosalind() { const m = mats(), g = new THREE.Group();
    const plat = new THREE.Group(); plat.position.set(-3.6, 0, 0); g.add(plat); C(plat, 1.4, 1.4, 0.5, 8, m.foil, 0, 0.9, 0); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.785; B(plat, 0.08, 0.9, 0.08, m.grey, Math.cos(a) * 1.3, 0.45, Math.sin(a) * 1.3); }
    B(plat, 0.9, 0.04, 2.4, m.grey, 1.6, 0.5, 0, 0, 0, -0.42);
    const y = bogie(g, 1.6, 1.5, 0.15, m); B(g, 1.0, 0.45, 1.4, m.white, 0, y + 0.2, 0);
    for (const s of [-1, 1]) B(g, 0.95, 0.03, 1.6, m.solar, s * 1.0, y + 0.47, 0, 0, 0, s * -0.05); mast(g, y + 1.4, m, 0, 0.6); C(g, 0.05, 0.05, 1.2, 8, m.grey, -0.3, y + 0.3, -0.8, 0.3); return g; },
};
const SITES = {
  'Jezero Crater': [['msl', true, 'Perseverance', 'NASA, landed Feb 2021'], ['ingenuity', null, 'Ingenuity', 'NASA, 72 flights'], ],
  'Gale Crater': [['msl', false, 'Curiosity', 'NASA, landed Aug 2012']],
  'Elysium Planitia': [['insight', false, 'InSight', 'NASA, landed Nov 2018']],
  'Utopia Planitia': [['zhurong', null, 'Zhurong', 'CNSA, landed May 2021']],
  'Utopia North': [['viking', null, 'Viking 2', 'NASA, landed Sep 1976']],
  'Chryse Planitia': [['viking', null, 'Viking 1', 'NASA, landed Jul 1976']],
  'Ares Vallis': [['pathfinder', null, 'Pathfinder and Sojourner', 'NASA, landed Jul 1997']],
  'Gusev Crater': [['mer', null, 'Spirit', 'NASA, landed Jan 2004']],
  'Meridiani Planum': [['mer', null, 'Opportunity', 'NASA, landed Jan 2004']],
  'Vastitas Borealis': [['insight', true, 'Phoenix', 'NASA, landed May 2008']],
  'Terra Sirenum': [['mars3', null, 'Mars 3', 'USSR, landed Dec 1971']],
  'Isidis Planitia': [['beagle', null, 'Beagle 2', 'ESA / UK, landed Dec 2003']],
  'Oxia Planum': [['rosalind', null, 'Rosalind Franklin', 'ESA, ExoMars rover']],
};
export const heritageFor = (site) => SITES[site] || [];

function plaque(title, sub) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 192; const x = c.getContext('2d');
  x.fillStyle = '#1d2d3d'; x.fillRect(0, 0, 512, 192); x.strokeStyle = '#b5d9fd'; x.lineWidth = 4; x.strokeRect(8, 8, 496, 176);
  x.fillStyle = '#f2f2f3'; x.font = '600 52px "Barlow Condensed", sans-serif'; x.fillText(title.toUpperCase(), 28, 86);
  x.fillStyle = '#b5d9fd'; x.font = '500 30px Barlow, sans-serif'; x.fillText(sub, 28, 140);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const g = new THREE.Group(); const m = mats();
  C(g, 0.04, 0.04, 1.1, 6, m.grey, -0.7, 0.55, 0); C(g, 0.04, 0.04, 1.1, 6, m.grey, 0.7, 0.55, 0);
  const p = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.6), new THREE.MeshStandardMaterial({ map: t, roughness: 0.5, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.15 })); p.position.y = 1.15; p.rotation.x = -0.3; g.add(p);
  return g;
}

// Heritage zone: the probe(s), a rope line on posts, and a plaque. Placed clear of the base and colliders.
export function placeHeritage(scene, L, H, colliders, start) {
  const list = heritageFor(L.site || L.stationName); if (!list.length) return null;
  const sx = start?.[0] ?? 0, sz = start?.[1] ?? 0;
  let at = null;
  for (let i = 0; i < 24 && !at; i++) {
    const a = i * 2.39996, r = 70 + (i % 6) * 18, x = sx + Math.cos(a) * r, z = sz + Math.sin(a) * r;
    if (colliders.every((c) => Math.hypot(c.x - x, c.z - z) > (c.r || 4) + 14)) at = [x, z];
  }
  if (!at) return null;
  const g = new THREE.Group(), [x, z] = at, m = mats(); g.position.set(x, H(x, z), z); scene.add(g);
  list.forEach(([k, arg, title, sub], i) => {
    const o = BUILD[k](arg); const ox = i === 0 ? 0 : 3.2, oz = i === 0 ? 0 : -2.4; o.position.set(ox, H(x + ox, z + oz) - g.position.y, oz); o.rotation.y = 0.6 + i; g.add(o);
  });
  const R = list[0][0] === 'zhurong' || list[0][0] === 'rosalind' ? 7.5 : 5.5, pts = [];
  for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, px = Math.cos(a) * R, pz = Math.sin(a) * R, py = H(x + px, z + pz) - g.position.y; C(g, 0.03, 0.03, 0.8, 5, m.grey, px, py + 0.4, pz); pts.push(new THREE.Vector3(px, py + 0.75, pz)); }
  pts.push(pts[0].clone()); g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xe0b53a })));
  const pl = plaque(list[0][2], list[0][3]); pl.position.set(0, H(x, z + R + 1) - g.position.y, R + 1); g.add(pl);
  colliders.push({ x, z, r: 2.2 });
  return { group: g, x, z, title: list.map((l) => l[2]).join(' and ') };
}
