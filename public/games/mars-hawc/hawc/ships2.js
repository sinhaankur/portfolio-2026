// Union Halberd: methalox gunship, original design after the user's spearhead-hull reference sheet.
// Long wedge prow, stepped dorsal spine, two shoulder engines, swept wings with leading-edge nacelles, two spiked main engines, tail boom.
// Faces +Z, 45 m long, 31 m span, keel at y=0.
import { THREE } from './lib.js?v=22';

let C = null;
function mats() {
  if (C) return C; const S = (o) => new THREE.MeshStandardMaterial(o);
  return (C = {
    plate: S({ color: 0xbfbcb4, roughness: 0.6, metalness: 0 }), plate2: S({ color: 0x9a9892, roughness: 0.65, metalness: 0 }),
    frame: S({ color: 0x3a3d42, roughness: 0.45, metalness: 1 }), recess: S({ color: 0x1b1d20, roughness: 0.7, metalness: 0.4 }),
    metal: S({ color: 0x8e9299, roughness: 0.35, metalness: 1 }), acc: S({ color: 0xc46a26, roughness: 0.6, metalness: 0 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x0d1620, roughness: 0.06, metalness: 0.2, clearcoat: 1 }),
    glow: new THREE.MeshBasicMaterial({ color: 0x9fc8ff, toneMapped: false }), red: new THREE.MeshBasicMaterial({ color: 0xff3a2a, toneMapped: false }), green: new THREE.MeshBasicMaterial({ color: 0x3aff6a, toneMapped: false }),
  });
}
const add = (p, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = true; p.add(o); return o; };
// slab(): [x,z] outline extruded upward by t with a chamfer, base at y=0.
const slab = (pts, t, bev = 0.12) => { const s = new THREE.Shape(); pts.forEach(([x, z], i) => (i ? s.lineTo(x, z) : s.moveTo(x, z))); const e = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.01, t - bev * 2), bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 1 }); e.rotateX(Math.PI / 2); e.translate(0, t - bev, 0); return e; };
const full = (half) => [...half, ...half.slice().reverse().map(([x, z]) => [-x, z])];
const side = (pts, s) => pts.map(([x, z]) => [x * s, z]);
const cbox = (w, h, d, c = 0.15) => slab([[-w / 2 + c, -d / 2], [w / 2 - c, -d / 2], [w / 2, -d / 2 + c], [w / 2, d / 2 - c], [w / 2 - c, d / 2], [-w / 2 + c, d / 2], [-w / 2, d / 2 - c], [-w / 2, -d / 2 + c]], h, Math.min(0.1, h * 0.3));
const tube = (r1, r2, len, seg = 20, open = false) => { const c = new THREE.CylinderGeometry(r1, r2, len, seg, 1, open); c.rotateX(Math.PI / 2); return c; }; // r1 at +Z end

// Engine pod along local +Z: shell, intake lip, ribbed mid, nozzle with spike. Returns a group.
function pod(m, r, len, spike = true) {
  const g = new THREE.Group();
  add(g, tube(r * 0.92, r, len * 0.62), m.plate, 0, 0, len * 0.1);
  add(g, tube(r * 0.7, r * 0.92, len * 0.16), m.plate2, 0, 0, len * 0.49);
  add(g, new THREE.TorusGeometry(r * 0.72, r * 0.09, 8, 24), m.metal, 0, 0, len * 0.57); add(g, new THREE.CircleGeometry(r * 0.66, 24), m.recess, 0, 0, len * 0.56);
  for (let i = 0; i < 4; i++) add(g, new THREE.TorusGeometry(r * 0.96, r * 0.07, 6, 24), m.frame, 0, 0, -len * (0.24 + i * 0.045));
  add(g, tube(r * 0.95, r * 0.7, len * 0.22, 20, true), m.metal, 0, 0, -len * 0.5).material.side = THREE.DoubleSide;
  add(g, new THREE.CircleGeometry(r * 0.7, 20), m.glow, 0, 0, -len * 0.52, 0, Math.PI, 0);
  if (spike) add(g, tube(r * 0.34, 0.02, len * 0.42, 12), m.frame, 0, 0, -len * 0.74);
  add(g, cbox(r * 0.7, r * 0.3, len * 0.4), m.plate2, 0, r * 0.82, len * 0.1);
  return g;
}

export function halberd(accent = 0x5980a6) {
  const m = mats(), g = new THREE.Group(), acc = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.6, metalness: 0 });
  // keel frame (dark), hull shell, upper deck: three layers stepping inward
  const hull = [[0.5, 22.5], [1.3, 20], [4.2, 7], [4.7, 3], [3.6, -1], [3.7, -13], [2.6, -19.5], [0.9, -21.5]];
  add(g, slab(full(hull.map(([x, z]) => [x * 0.86, z * 0.97])), 0.8), m.frame, 0, 0, 0);
  add(g, slab(full(hull), 1.7, 0.25), m.plate, 0, 0.7, 0);
  add(g, slab(full([[0.4, 20.5], [0.9, 18.5], [2.9, 7.5], [3.1, 3], [2.4, -1], [2.4, -12.5], [1.5, -18]]), 1.0, 0.2), m.plate2, 0, 2.3, 0);
  // dorsal spine: stepped modules, widest amidships
  for (const [w, h, d, z, mt] of [[1.5, 0.7, 4.2, 15.2, m.plate], [2.2, 0.9, 3.4, 10.2, m.plate], [2.6, 1.3, 5.2, 5.2, m.plate2], [2.0, 1.0, 6.0, -1.2, m.plate], [2.4, 1.2, 4.0, -7.2, m.plate2], [1.7, 0.8, 4.4, -12.4, m.plate]]) {
    add(g, cbox(w, h, d, 0.3), mt, 0, 3.25, z); add(g, cbox(w * 0.5, 0.14, d * 0.55, 0.1), m.recess, 0, 3.25 + h, z);
  }
  // bridge canopy, hatch, sensor mast
  const can = add(g, new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), m.glass, 0, 3.2, 18.0); can.scale.set(0.7, 0.55, 1.9);
  add(g, cbox(1.7, 0.16, 4.2, 0.4), m.frame, 0, 3.2, 18.0);
  add(g, tube(0.5, 0.5, 0.12, 16), m.acc, 0, 4.6, 5.2, Math.PI / 2); add(g, tube(0.04, 0.04, 3.2, 6), m.metal, 0.7, 5.6, -7.2, Math.PI / 2);
  add(g, tube(0.28, 0.5, 0.5, 12), m.metal, 0, 4.75, -7.2, Math.PI / 2);
  // prow: sensor lance and chin guns
  add(g, tube(0.03, 0.14, 3.0, 8), m.metal, 0, 1.5, 23.6);
  for (const s of [-1, 1]) { add(g, tube(0.11, 0.13, 5.2, 10), m.metal, s * 1.5, 0.5, 17.6); add(g, cbox(0.6, 0.55, 2.4), m.frame, s * 1.5, 0.2, 14.4); }
  for (const s of [-1, 1]) {
    // shoulder engines on pylons
    const sp = pod(m, 1.25, 7, false); sp.position.set(s * 5.5, 1.9, 6.6); g.add(sp);
    add(g, cbox(1.8, 0.7, 3.0), m.frame, s * 4.2, 1.4, 6.8);
    // wing: swept, trailing edge notched into a W
    const W = [[3.2, 3.5], [6.2, 1.6], [15.2, -12.5], [15.6, -19.6], [12.6, -15.6], [9.2, -13.4], [6.4, -15.4], [3.3, -12.5]];
    add(g, slab(side(W, s), 0.7, 0.2), m.plate, 0, 0.9, 0);
    add(g, slab(side([[4.4, 1.2], [6.2, 0.2], [13.6, -11.6], [12.2, -13.4], [9.0, -11.8], [6.2, -13.2], [4.4, -11.2]], s), 0.3, 0.1), m.plate2, 0, 1.55, 0);
    add(g, slab(side([[6.4, 1.2], [15.3, -12.7], [15.45, -14.6], [6.0, 0.2]], s), 0.34, 0.08), acc, 0, 1.3, 0); // leading-edge stripe
    for (const [x, z, w, d] of [[7.2, -5.2, 1.6, 2.6], [10.6, -10.4, 1.8, 2.2], [5.6, -9.2, 1.2, 2.0]]) add(g, cbox(w, 0.12, d, 0.2), m.recess, s * x, 1.85, z);
    // leading-edge nacelle with cannon
    const ry = Math.atan2(-9 * s, 14), n = pod(m, 0.85, 6.4, false); n.position.set(s * 10.9, 1.25, -5.6); n.rotation.y = ry; g.add(n);
    add(g, tube(0.09, 0.11, 4.6, 8), m.metal, s * 8.6, 1.25, 0.2, 0, ry, 0);
    add(g, cbox(2.2, 1.0, 3.2, 0.3), m.plate2, s * 13.2, 1.0, -11.4).rotation.y = ry;
    // main engines
    const e = pod(m, 1.55, 8.4); e.position.set(s * 4.6, 1.6, -16.2); g.add(e);
    add(g, cbox(2.0, 1.1, 5.0, 0.3), m.plate, s * 4.3, 2.2, -12.6);
    const e2 = pod(m, 0.7, 4.2); e2.position.set(s * 7.4, 0.9, -15.6); g.add(e2);
    // radiator, low canted fin, nav lights, wingtip probe
    add(g, cbox(0.14, 1.5, 4.6, 0.04), m.metal, s * 2.9, 3.2, -6.4).rotation.z = -s * 0.5;
    const f = add(g, slab([[-0.14, 2.2], [0.14, 2.2], [0.14, -2.6], [-0.14, -2.6]], 2.6, 0.08), m.plate, s * 2.6, 3.0, -16.0); f.rotation.z = -s * 0.42;
    add(g, new THREE.SphereGeometry(0.14, 8, 6), s > 0 ? m.red : m.green, s * 15.5, 1.3, -16.4);
    add(g, tube(0.03, 0.07, 2.4, 6), m.metal, s * 15.45, 1.25, -20.4);
  }
  // tail boom with antennae
  add(g, tube(0.9, 0.25, 3.4, 12), m.plate2, 0, 1.5, -22.4); add(g, tube(0.06, 0.02, 2.2, 6), m.metal, 0, 1.5, -25.1);
  for (const s of [-1, 1]) add(g, tube(0.04, 0.02, 1.8, 6), m.metal, s * 0.5, 1.3, -24.6, 0, s * 0.2, 0);
  add(g, cbox(1.3, 0.5, 2.6, 0.2), m.acc, 0, 3.3, -16.6);
  return g;
}
