/**
 * The Shrike — Helion Drift's player ship. An original design built in code:
 * a salvage-rig fighter in worn industrial yellow. One pair of low, cranked
 * delta wings with under-wing cannon pods, twin integrated engines, an
 * outward-canted V-tail, radiator fins and a belly salvage clamp.
 * Forward is -Z. Length ≈ 8.6 units (1 unit ≈ 2 m → a 17 m light fighter).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { shrikeMaps, hazardTexture, gunmetalTexture } from './textures';

export const SHRIKE_MUZZLES = [new THREE.Vector3(-2.1, -0.55, -2.75), new THREE.Vector3(2.1, -0.55, -2.75)];
export const SHRIKE_NOZZLES = [new THREE.Vector3(-0.78, -0.05, 4.3), new THREE.Vector3(0.78, -0.05, 4.3)];

type Section = { z: number; w: number; h: number; y: number; c?: number };

/** Loft chamfered-octagon cross-sections into a hull. */
function loft(sections: Section[]): THREE.BufferGeometry {
  const ring = (s: Section) => {
    const c = s.c ?? 0.28;
    const hw = s.w / 2, hh = s.h / 2;
    return [
      [hw, hh - c * s.h], [hw - c * s.w, hh], [-hw + c * s.w, hh], [-hw, hh - c * s.h],
      [-hw, -hh + c * s.h * 0.7], [-hw + c * s.w * 0.6, -hh], [hw - c * s.w * 0.6, -hh], [hw, -hh + c * s.h * 0.7],
    ].map(([x, y]) => new THREE.Vector3(x, y + s.y, s.z));
  };
  const rings = sections.map(ring);
  const pos: number[] = [];
  const push = (...vs: THREE.Vector3[]) => vs.forEach((v) => pos.push(v.x, v.y, v.z));
  for (let i = 0; i < rings.length - 1; i++) {
    const a = rings[i], b = rings[i + 1];
    for (let k = 0; k < 8; k++) {
      const k2 = (k + 1) % 8;
      push(a[k], a[k2], b[k2]);
      push(a[k], b[k2], b[k]);
    }
  }
  // caps
  const capFan = (r: THREE.Vector3[], flip: boolean) => {
    const cx = r.reduce((s, v) => s.add(v), new THREE.Vector3()).multiplyScalar(1 / r.length);
    for (let k = 0; k < 8; k++) {
      const k2 = (k + 1) % 8;
      if (flip) push(cx, r[k2], r[k]); else push(cx, r[k], r[k2]);
    }
  };
  capFan(rings[0], false);
  capFan(rings[rings.length - 1], true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

/** Box-projected UVs (per triangle, dominant normal axis). */
function boxUV(geo: THREE.BufferGeometry, scale: number, offset = new THREE.Vector2()) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const p = g.getAttribute('position');
  const uv = new Float32Array(p.count * 2);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
    n.subVectors(c, b).cross(new THREE.Vector3().subVectors(a, b)).normalize();
    const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
    for (let j = 0; j < 3; j++) {
      const v = [a, b, c][j];
      let u: number, w: number;
      if (ax >= ay && ax >= az) { u = v.z; w = v.y; } else if (ay >= az) { u = v.x; w = v.z; } else { u = v.x; w = v.y; }
      uv[(i + j) * 2] = u * scale + offset.x;
      uv[(i + j) * 2 + 1] = w * scale + offset.y;
    }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.deleteAttribute('normal');
  g.computeVertexNormals();
  return g;
}

function prep(g: THREE.BufferGeometry, uvScale = 0.105, off?: THREE.Vector2) {
  return boxUV(g, uvScale, off);
}

function wing(sign: 1 | -1): THREE.BufferGeometry {
  const pts: [number, number][] = [[0.55, -0.45], [2.4, 0.55], [4.35, 1.55], [4.35, 2.45], [2.3, 2.85], [0.55, 3.05]];
  const ordered = sign > 0 ? pts : [...pts].reverse();
  const shape = new THREE.Shape(ordered.map(([x, z]) => new THREE.Vector2(x * sign, z)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.05, bevelSegments: 1 });
  g.rotateX(Math.PI / 2); // shape y → world z, thickness → -y
  g.translate(0, 0.08, 0);
  g.rotateZ(-sign * 0.13); // slight anhedral
  g.translate(0, -0.22, 0);
  return g;
}

function vTail(sign: 1 | -1): THREE.BufferGeometry {
  const shape = new THREE.Shape([
    new THREE.Vector2(1.5, 0), new THREE.Vector2(3.65, 0), new THREE.Vector2(3.85, 1.45), new THREE.Vector2(3.05, 1.5),
  ]);
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.09, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.03, bevelSegments: 1 });
  g.rotateY(-Math.PI / 2); // shape x → world z, depth → world -x
  g.translate(0.045, 0, 0);
  g.rotateZ(-sign * 0.48);
  g.translate(sign * 0.42, 0.42, 0);
  return g;
}

function cyl(rTop: number, rBot: number, len: number, seg: number, x: number, y: number, zCenter: number) {
  const g = new THREE.CylinderGeometry(rTop, rBot, len, seg, 1);
  g.rotateX(Math.PI / 2); // axis → z (top at -z)
  g.translate(x, y, zCenter);
  return g;
}

function box(w: number, h: number, d: number, x: number, y: number, z: number, ry = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  return g;
}

export interface ShrikeParts {
  group: THREE.Group;
  engineGlow: THREE.Mesh[];
  navLights: THREE.Mesh[];
}

export function buildShrike(): ShrikeParts {
  const maps = shrikeMaps();
  const paint = new THREE.MeshStandardMaterial({
    map: maps.map, roughnessMap: maps.rough, metalnessMap: maps.metal, roughness: 1, metalness: 1, envMapIntensity: 0.9,
  });
  const gun = new THREE.MeshStandardMaterial({ map: gunmetalTexture(), color: '#a7adb8', metalness: 0.85, roughness: 0.42 });
  const glass = new THREE.MeshStandardMaterial({ color: '#0b1820', metalness: 0.95, roughness: 0.06, emissive: '#06202e', emissiveIntensity: 0.6, envMapIntensity: 1.6 });
  const hz = hazardTexture().clone();
  hz.repeat.set(5, 1); hz.needsUpdate = true;
  const hazard = new THREE.MeshStandardMaterial({ map: hz, roughness: 0.6, metalness: 0.2 });

  // ---- hull (paint)
  const fuselage = loft([
    { z: -4.3, w: 0.12, h: 0.1, y: 0.04 },
    { z: -3.65, w: 0.55, h: 0.42, y: 0.05 },
    { z: -2.4, w: 1.0, h: 0.78, y: 0.08 },
    { z: -0.6, w: 1.36, h: 1.0, y: 0.1 },
    { z: 1.2, w: 1.58, h: 1.06, y: 0.08 },
    { z: 3.0, w: 1.38, h: 0.96, y: 0.1 },
    { z: 3.62, w: 1.1, h: 0.8, y: 0.12 },
  ]);
  const nacelles = [-1, 1].map((s) => cyl(0.47, 0.5, 2.7, 16, s * 0.78, -0.05, 2.45));
  const intakes = [-1, 1].map((s) => cyl(0.5, 0.42, 0.35, 16, s * 0.78, -0.05, 1.0));
  const paintGeo = mergeGeometries([
    prep(fuselage), prep(wing(1)), prep(wing(-1)), prep(vTail(1)), prep(vTail(-1)),
    ...nacelles.map((g) => prep(g)), ...intakes.map((g) => prep(g)),
  ]);

  // ---- gunmetal details
  const gunParts: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    gunParts.push(cyl(0.16, 0.2, 3.5, 12, s * 2.1, -0.55, -0.9)); // cannon pod
    gunParts.push(cyl(0.24, 0.24, 0.32, 12, s * 2.1, -0.55, -2.55)); // muzzle brake
    gunParts.push(cyl(0.1, 0.1, 0.5, 8, s * 2.1, -0.55, -2.9)); // barrel tip
    gunParts.push(box(0.12, 0.26, 1.4, s * 2.1, -0.36, 0.4)); // pylon
    // nozzle bell
    const bell = new THREE.LatheGeometry([new THREE.Vector2(0.42, 0), new THREE.Vector2(0.5, 0.18), new THREE.Vector2(0.56, 0.55), new THREE.Vector2(0.5, 0.56), new THREE.Vector2(0.38, 0.12)], 16);
    bell.rotateX(Math.PI / 2);
    bell.translate(s * 0.78, -0.05, 3.78);
    gunParts.push(bell);
    gunParts.push(box(0.12, 0.34, 1.25, s * 0.36, -0.62, 0.3)); // salvage clamp arm
    gunParts.push(box(0.12, 0.16, 0.34, s * 0.36, -0.8, -0.2)); // clamp hook
  }
  for (let i = 0; i < 6; i++) gunParts.push(box(0.035, 0.2, 0.72, -0.3 + i * 0.12, 0.66, 1.0)); // radiator fins
  gunParts.push(box(0.9, 0.06, 0.9, 0, 0.57, 1.0)); // radiator base
  gunParts.push(box(0.16, 0.16, 0.6, 0, 0.6, 2.9)); // tail strobe mount
  gunParts.push(cyl(0.05, 0.05, 1.2, 6, 0.0, 0.42, -3.4)); // nose probe
  const gunGeo = mergeGeometries(gunParts.map((g) => prep(g, 0.6)));

  // ---- canopy
  const canopy = loft([
    { z: -2.55, w: 0.3, h: 0.1, y: 0.42, c: 0.4 },
    { z: -1.95, w: 0.7, h: 0.34, y: 0.53, c: 0.4 },
    { z: -0.95, w: 0.8, h: 0.44, y: 0.6, c: 0.4 },
    { z: 0.0, w: 0.62, h: 0.3, y: 0.57, c: 0.4 },
    { z: 0.38, w: 0.3, h: 0.1, y: 0.5, c: 0.4 },
  ]);
  canopy.computeVertexNormals();

  // ---- hazard strips along the wing leading edges
  const hazParts: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1] as const) {
    const a = new THREE.Vector2(0.55 * s, -0.45), b = new THREE.Vector2(4.35 * s, 1.55);
    const len = a.distanceTo(b);
    const g = new THREE.BoxGeometry(len, 0.2, 0.14);
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    g.rotateY(-ang);
    g.translate((a.x + b.x) / 2, 0, (a.y + b.y) / 2);
    g.rotateZ(-s * 0.13);
    g.translate(0, -0.2, 0.02);
    hazParts.push(g);
  }
  const hazGeo = mergeGeometries(hazParts);

  const group = new THREE.Group();
  group.name = 'Shrike';
  const add = (g: THREE.BufferGeometry, m: THREE.Material) => { const mesh = new THREE.Mesh(g, m); mesh.castShadow = false; group.add(mesh); return mesh; };
  add(paintGeo, paint);
  add(gunGeo, gun);
  add(canopy, glass);
  add(hazGeo, hazard);

  // engine cores (bright discs) — scaled by the renderer with throttle
  const engineGlow: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.4, 20), new THREE.MeshBasicMaterial({ color: '#ffcf8a', toneMapped: false }));
    m.position.set(s * 0.78, -0.05, 4.12);
    group.add(m);
    engineGlow.push(m);
  }
  // nav lights: port red, starboard green, tail strobe white
  const navLights: THREE.Mesh[] = [];
  const navGeo = new THREE.SphereGeometry(0.09, 8, 6);
  for (const [x, y, z, c] of [[-4.32, -0.48, 2.0, '#ff3030'], [4.32, -0.48, 2.0, '#30ff6a'], [0, 0.72, 3.15, '#ffffff']] as const) {
    const m = new THREE.Mesh(navGeo, new THREE.MeshBasicMaterial({ color: c, toneMapped: false }));
    m.position.set(x, y, z);
    group.add(m);
    navLights.push(m);
  }
  return { group, engineGlow, navLights };
}
