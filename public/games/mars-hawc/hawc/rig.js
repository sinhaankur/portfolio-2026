// Rig helpers for the Striker: bake the current skinned pose, per-bone boxes, section edge lines, and the manipulator claw.
import { THREE } from './lib.js?v=22';

export const SEC_COLOR = { cockpit: 0x9a463c, torso: 0x3d5f82, arms: 0x2c6e68, legs: 0x8a6526 };
const secOf = (n) => (/Arm|Shoulder/.test(n) ? 'arms' : /Leg|Foot|Toe/.test(n) ? 'legs' : 'torso');
const V = new THREE.Vector3(), M = new THREE.Matrix4();

function eachSkinVert(model, space, fn) {
  model.updateMatrixWorld(true); space.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(space.matrixWorld).invert();
  model.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    const g = o.geometry, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, n = g.attributes.position.count, bones = o.skeleton.bones;
    o.skeleton.update(); M.multiplyMatrices(inv, o.matrixWorld);
    for (let i = 0; i < n; i++) {
      THREE.Mesh.prototype.getVertexPosition.call(o, i, V); o.applyBoneTransform(i, V); V.applyMatrix4(M);
      let k = 0, best = -1; for (let j = 0; j < 4; j++) { const w = sw.getComponent(i, j); if (w > best) { best = w; k = si.getComponent(i, j); } }
      fn(o, i, V, bones[k]?.name || '');
    }
  });
}

// Bone boxes (in `space`) for every bone, plus model box.
export function boneBoxes(model, space, only) {
  const boxes = {}, all = new THREE.Box3();
  eachSkinVert(model, space, (o, i, p, name) => { all.expandByPoint(p); if (only && !only.test(name)) return; (boxes[name] || (boxes[name] = new THREE.Box3())).expandByPoint(p); });
  return { boxes, all };
}

// Section-coloured feature edges of the posed hull, in `space`.
export function sectionEdges(model, space, angle = 28) {
  const per = { cockpit: [], torso: [], arms: [], legs: [] }, boxes = {}, all = new THREE.Box3();
  const meshes = new Map();
  eachSkinVert(model, space, (o, i, p, name) => {
    let m = meshes.get(o); if (!m) { m = { pos: new Float32Array(o.geometry.attributes.position.count * 3), sec: new Uint8Array(o.geometry.attributes.position.count), names: [] }; meshes.set(o, m); }
    m.pos[i * 3] = p.x; m.pos[i * 3 + 1] = p.y; m.pos[i * 3 + 2] = p.z; m.names[i] = name;
    all.expandByPoint(p); (boxes[name] || (boxes[name] = new THREE.Box3())).expandByPoint(p);
  });
  const tb = Object.entries(boxes).find(([n]) => /^UpperTorso/.test(n))?.[1];
  const S = ['cockpit', 'torso', 'arms', 'legs'];
  const groups = new THREE.Group(), cent = {};
  for (const s of S) cent[s] = { v: new THREE.Vector3(), n: 0 };
  for (const [o, m] of meshes) {
    const n = m.names.length;
    for (let i = 0; i < n; i++) {
      let s = secOf(m.names[i]);
      if (s === 'torso' && tb && /^UpperTorso/.test(m.names[i])) { const y = m.pos[i * 3 + 1], z = m.pos[i * 3 + 2], dy = tb.max.y - tb.min.y, dz = tb.max.z - tb.min.z; if (y > tb.min.y + dy * 0.45 && z > tb.min.z + dz * 0.62 && Math.abs(m.pos[i * 3]) < (tb.max.x - tb.min.x) * 0.2) s = 'cockpit'; }
      m.sec[i] = S.indexOf(s); const c = cent[s]; c.v.x += m.pos[i * 3]; c.v.y += m.pos[i * 3 + 1]; c.v.z += m.pos[i * 3 + 2]; c.n++;
    }
    const idx = o.geometry.index ? o.geometry.index.array : null, tri = idx ? idx.length : n;
    const lists = S.map(() => []);
    for (let t = 0; t < tri; t += 3) { const a = idx ? idx[t] : t; lists[m.sec[a]].push(a, idx ? idx[t + 1] : t + 1, idx ? idx[t + 2] : t + 2); }
    lists.forEach((l, k) => { if (l.length) per[S[k]].push({ pos: m.pos, idx: l }); });
  }
  for (const s of S) {
    for (const { pos, idx } of per[s]) {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx);
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(g, angle), new THREE.LineBasicMaterial({ color: SEC_COLOR[s], transparent: true, opacity: 0.62, depthWrite: false }));
      e.renderOrder = 2; groups.add(e); g.dispose();
    }
    const c = cent[s]; if (c.n) c.v.divideScalar(c.n);
  }
  return { lines: groups, boxes, all, cent: Object.fromEntries(S.map((s) => [s, cent[s].v])) };
}

// Fresnel x-ray shell that keeps skinning.
export function ghostMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0x416180, transparent: true, depthWrite: false, side: THREE.FrontSide });
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n float fr = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.4);\n gl_FragColor = vec4(mix(vec3(0.84,0.89,0.94), vec3(0.17,0.27,0.36), fr), mix(0.05, 0.42, fr));');
  };
  m.customProgramCacheKey = () => 'hawc-ghost';
  return m;
}

// Three-finger manipulator under the left forearm. Returns { group, grip, set(open01), update(dt) }.
export function makeClaw(scale = 1) {
  const st = new THREE.MeshStandardMaterial({ color: 0x8e959c, metalness: 0.9, roughness: 0.34 });
  const dk = new THREE.MeshStandardMaterial({ color: 0x2b2d31, metalness: 0.6, roughness: 0.5 });
  const hy = new THREE.MeshStandardMaterial({ color: 0x1d1f20, metalness: 0.2, roughness: 0.7 });
  const g = new THREE.Group(); g.scale.setScalar(scale);
  const add = (p, geo, mat, x, y, z) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; p.add(o); return o; };
  add(g, new THREE.BoxGeometry(0.46, 0.22, 0.5), dk, 0, 0, 0);
  const wrist = add(g, new THREE.CylinderGeometry(0.17, 0.17, 0.2, 18), st, 0, -0.2, 0.05);
  add(g, new THREE.CylinderGeometry(0.2, 0.2, 0.06, 18), dk, 0, -0.32, 0.05);
  const palm = new THREE.Group(); palm.position.set(0, -0.36, 0.05); g.add(palm);
  const fingers = [];
  const finger = (ang, rad) => {
    const base = new THREE.Group(); base.rotation.y = ang; palm.add(base);
    const k1 = new THREE.Group(); k1.position.set(0, 0, rad); base.add(k1);
    add(k1, new THREE.CylinderGeometry(0.05, 0.05, 0.12, 10), st, 0, 0, 0).rotation.z = Math.PI / 2;
    add(k1, new THREE.BoxGeometry(0.09, 0.34, 0.08), dk, 0, -0.17, 0);
    add(k1, new THREE.CylinderGeometry(0.018, 0.018, 0.3, 6), hy, 0.055, -0.15, -0.03);
    const k2 = new THREE.Group(); k2.position.set(0, -0.34, 0); k1.add(k2);
    add(k2, new THREE.CylinderGeometry(0.042, 0.042, 0.1, 10), st, 0, 0, 0).rotation.z = Math.PI / 2;
    const tip = add(k2, new THREE.BoxGeometry(0.08, 0.24, 0.07), st, 0, -0.12, -0.02); tip.rotation.x = 0.0;
    add(k2, new THREE.BoxGeometry(0.085, 0.06, 0.03), hy, 0, -0.22, -0.045);
    fingers.push({ k1, k2 });
  };
  finger(0, 0.13); finger(Math.PI * 0.72, 0.13); finger(-Math.PI * 0.72, 0.13);
  const grip = new THREE.Object3D(); grip.position.set(0, -0.72, 0.05); g.add(grip);
  let open = 0.35, target = 0.35;
  const pose = () => { for (const f of fingers) { f.k1.rotation.x = 0.15 + open * 0.75; f.k2.rotation.x = -0.25 - (1 - open) * 0.55; } };
  pose();
  return { group: g, grip, set(v) { target = v; }, get open() { return open; }, update(dt) { open += (target - open) * Math.min(1, dt * 8); pose(); } };
}

// Mount the claw under the left forearm of a rigged Striker. `space` is the frame the model stands in (holder or actor root).
export function attachClaw(model, space, tplCache) {
  let bone = null; model.traverse((o) => { if (o.isBone && /^LowerArm_L/.test(o.name)) bone = o; });
  if (!bone) return null;
  let at = tplCache?.clawAt;
  if (!at) {
    const { boxes, all } = boneBoxes(model, space, /^LowerArm_L/);
    const b = boxes[bone.name]; if (!b) return null;
    const p = new THREE.Vector3((b.min.x + b.max.x) / 2, b.min.y + (b.max.y - b.min.y) * 0.12, b.max.z - (b.max.z - b.min.z) * 0.28);
    const w = p.clone().applyMatrix4(space.matrixWorld); const local = bone.worldToLocal(w.clone());
    const q = new THREE.Quaternion(); bone.getWorldQuaternion(q); const qs = new THREE.Quaternion(); space.getWorldQuaternion(qs); q.invert().multiply(qs);
    const ws = new THREE.Vector3(); bone.getWorldScale(ws); space.getWorldScale(V);
    at = { local, q, inv: V.x / ws.x, size: (all.max.y - all.min.y) / 7 };
    if (tplCache) tplCache.clawAt = at;
  }
  const claw = makeClaw(at.size);
  const mount = new THREE.Group(); mount.position.copy(at.local); mount.quaternion.copy(at.q); mount.scale.setScalar(at.inv); mount.add(claw.group); bone.add(mount);
  claw.mount = mount; return claw;
}
