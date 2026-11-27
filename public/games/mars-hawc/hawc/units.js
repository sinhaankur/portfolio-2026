import { THREE, clamp } from './lib.js?v=18';
import { getTemplate, instantiate } from './assets.js?v=18';
import { buildRifle } from './kit2.js?v=18';
import { UNITS } from './levels.js?v=18';

export function unitTemplate(type) {
  const d = UNITS[type];
  return getTemplate(d.model, { height: d.height, length: d.length, yaw: d.yaw || 0, idle: d.rig ? 'a4IdlePose' : null });
}

export class Actor {
  constructor(type, tpl, { faction = 'darken', livery } = {}) {
    const d = this.def = UNITS[type]; this.type = type; this.tpl = tpl;
    this.root = new THREE.Group();
    this.livery = livery ?? d.livery;
    this.model = instantiate(tpl, this.livery);
    this.root.add(this.model);
    this.hp = this.maxHp = d.hp; this.alive = true; this.piloted = true; this.faction = faction;
    this.yaw = 0; this.vel = new THREE.Vector3(); this.vy = 0; this.airborne = false;
    this.radius = d.radius; this.height = d.height || tpl.size.y;
    this.t = Math.random() * 10; this.lockAnim = 0; this.phase = 0; this.fireCd = 1 + Math.random() * 2; this.burst = 0; this.burstT = 0; this.mslCd = 6;
    this.strafeDir = Math.random() < 0.5 ? -1 : 1; this.strafeT = 3; this.aggro = 0; this.gashrT = 0;
    if (d.rig) {
      this.mixer = new THREE.AnimationMixer(this.model);
      this.actions = {}; for (const c of tpl.animations) this.actions[c.name] = this.mixer.clipAction(c);
      this.bones = {}; this.model.traverse((o) => { if (o.isBone) this.bones[o.name] = o; });
      this.play('a4IdlePose', { fade: 0 });
    }
  }
  get pos() { return this.root.position; }
  play(name, { fade = 0.25, once = false, ts = 1 } = {}) {
    if (!this.actions) return;
    const a = this.actions[name]; if (!a) return;
    if (this.curName === name && !once) { a.timeScale = ts; return; }
    a.reset(); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); a.clampWhenFinished = once; a.timeScale = ts; a.setEffectiveWeight(1);
    if (this.cur && fade > 0) a.crossFadeFrom(this.cur, fade, false); else if (this.cur) this.cur.stop();
    a.play(); this.cur = a; this.curName = name;
  }
  oneShot(name, ts = 1, fade = 0.2) {
    const a = this.actions?.[name]; if (!a) return 0;
    this.play(name, { once: true, ts, fade }); this.lockAnim = a.getClip().duration / ts; return this.lockAnim;
  }
  animate(spdF, spdS, turning) {
    if (!this.actions || this.lockAnim > 0 || !this.alive) return;
    const k = this.height / 7;
    if (!this.piloted) { this.play('a1ShutdownPose', { fade: 0.7 }); return; }
    if (this.airborne) { this.play('a8JumpJetFlying', { fade: 0.3 }); return; }
    const s = Math.hypot(spdF, spdS);
    if (spdF < -0.4) this.play('a6WalkCycleBack', { ts: clamp(-spdF / (1.71 * k) * 0.8, 0.6, 1.8) });
    else if (s > 8.5) this.play('a7RunCycle', { ts: clamp(s / (6.9 * k), 0.8, 1.9) });
    else if (s > 0.5) this.play('a5WalkCycle', { ts: clamp(s / (5.0 * k), 0.55, 1.7) });
    else if (turning) this.play('a9TurningSteps', { ts: 1.1 });
    else this.play('a4IdlePose', { fade: 0.4 });
  }
  // Returns true on the frame a foot lands.
  stepped() {
    if (!this.cur || !/Walk|Run|Turning/.test(this.curName)) return false;
    const ph = (this.cur.time / this.cur.getClip().duration) % 1;
    const prev = this.phase; this.phase = ph;
    return (prev < 0.25 && ph >= 0.25) || (prev < 0.75 && ph >= 0.75);
  }
  bonePos(name, out) { const b = this.bones?.[name]; if (!b) return null; return b.getWorldPosition(out); }
  center(out) { return out.set(this.pos.x, this.pos.y + this.height * 0.58, this.pos.z); }
  forward(out) { return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
  update(dt) {
    this.root.rotation.y = this.yaw;
    if (this.lockAnim > 0) this.lockAnim -= dt;
    if (this.mixer) this.mixer.update(dt);
  }
}

// Pilot: rigged Mixamo soldier (three.js example asset) in a pressure helmet and life-support pack.
import { loadGLTF } from './assets.js?v=18';
import { cloneSkinned } from './lib.js?v=18';
let pilotTpl = null;
export async function loadPilot() {
  if (pilotTpl) return pilotTpl;
  try {
    const g = await loadGLTF('pilot');
    const s = g.scene; s.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(s), h = bb.max.y - bb.min.y;
    pilotTpl = { scene: s, clips: g.animations, k: 1.82 / (h || 1.8), y0: -bb.min.y };
  } catch (e) { console.warn('pilot model', e); }
  return pilotTpl;
}
const GC = new Map();
function rbox(w, h, d, r) {
  const key = [w, h, d, r].join(); if (GC.has(key)) return GC.get(key);
  r = r ?? Math.min(w, h, d) * 0.28; const bv = Math.min(r * 0.7, d * 0.45), W = w - 2 * bv, Hh = h - 2 * bv, rr = Math.min(r, W / 2, Hh / 2), x = W / 2, y = Hh / 2;
  const s = new THREE.Shape(); s.moveTo(-x + rr, -y); s.lineTo(x - rr, -y); s.quadraticCurveTo(x, -y, x, -y + rr); s.lineTo(x, y - rr); s.quadraticCurveTo(x, y, x - rr, y); s.lineTo(-x + rr, y); s.quadraticCurveTo(-x, y, -x, y - rr); s.lineTo(-x, -y + rr); s.quadraticCurveTo(-x, -y, -x + rr, -y);
  const dd = Math.max(0.002, d - 2 * bv), g = new THREE.ExtrudeGeometry(s, { depth: dd, bevelEnabled: true, bevelThickness: bv, bevelSize: bv, bevelSegments: 3, curveSegments: 5 });
  g.translate(0, 0, -dd / 2); g.computeVertexNormals(); GC.set(key, g); return g;
}
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3(), _v5 = new THREE.Vector3();
function rotW(bone, axis, ang) { if (!bone || !ang) return; bone.parent.getWorldQuaternion(_q1); _v5.copy(axis).applyQuaternion(_q1.invert()); bone.quaternion.premultiply(_q2.setFromAxisAngle(_v5, ang)); }
function aimBone(bone, cur, want) { const p = bone.getWorldPosition(_v1); const f = _v2.subVectors(cur, p).normalize(), t = _v3.subVectors(want, p).normalize(); _q3.setFromUnitVectors(f, t); bone.getWorldQuaternion(_q1); bone.parent.getWorldQuaternion(_q2); bone.quaternion.copy(_q2.invert().multiply(_q3.multiply(_q1))); bone.updateMatrixWorld(true); }
function ik2(a, b, c, target, pole) {
  const pa = a.getWorldPosition(new THREE.Vector3()), pb = b.getWorldPosition(new THREE.Vector3()), pc = c.getWorldPosition(new THREE.Vector3());
  const l1 = pa.distanceTo(pb), l2 = pb.distanceTo(pc), t = target.clone().sub(pa), d = clamp(t.length(), Math.abs(l1 - l2) + 0.01, (l1 + l2) * 0.995); t.normalize();
  const x = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  const pn = pole.clone().sub(pa); pn.addScaledVector(t, -pn.dot(t)).normalize();
  aimBone(a, pb, pa.clone().addScaledVector(t, x).addScaledVector(pn, h));
  aimBone(b, c.getWorldPosition(_v4), pa.clone().addScaledVector(t, d));
}
// Pilot: Mixamo body as the undersuit, hard armour plates on the bones, sealed helmet, life-support pack with jet nozzles, GASHR held two-handed.
// Upper body aims with the camera (spine lean + two-bone arm IK); hips turn into strafes; legs tuck in the air.
export function makePilot(suit = 0xdad6cd, accent = 0x5980a6, opts = {}) {
  if (!pilotTpl) return makePilotBasic(suit, accent);
  const armed = opts.armed !== false;
  const T = pilotTpl, root = new THREE.Group(), body = cloneSkinned(T.scene);
  body.scale.setScalar(T.k); body.position.y = T.y0 * T.k; body.rotation.y = Math.PI; root.add(body);
  const enemy = suit !== 0xdad6cd, under = new THREE.Color(enemy ? 0x40362f : 0x63666a), puff = 0.008 / T.k;
  const bones = {};
  body.traverse((o) => {
    if (o.isBone) bones[o.name.replace(/^mixamorig:?/, '')] = o;
    if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; o.material = o.material.clone(); if (!/visor/i.test(o.material.name)) { o.material.map = null; o.material.metalnessMap = null; o.material.roughnessMap = null; o.material.emissiveMap = null; o.material.needsUpdate = true; o.material.color.copy(under); o.material.roughness = 0.92; o.material.metalness = 0; o.material.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed += normalize(objectNormal) * ' + puff.toFixed(4) + ';'); }; } else o.visible = false; }
  });
  root.updateMatrixWorld(true);
  const ws = new THREE.Vector3(), mount = (bone) => { const g = new THREE.Group(); bone.getWorldScale(ws); g.scale.setScalar(1 / ws.x); bone.add(g); return g; };
  const mPlate = new THREE.MeshPhysicalMaterial({ color: enemy ? 0x3f3430 : 0x6f6d68, roughness: 0.72, metalness: 0 });
  const mDust = new THREE.MeshStandardMaterial({ color: enemy ? 0x3c2f27 : 0x67605a, roughness: 0.85, metalness: 0 });
  const mCloth = new THREE.MeshStandardMaterial({ color: enemy ? 0x33291f : 0x4b4d50, roughness: 0.95, metalness: 0 });
  const bellows = (p, r, ys) => { for (const y of ys) { const b = add(p, new THREE.TorusGeometry(r * 0.86, 0.009, 8, 20), mCloth, 0, y, 0); b.rotation.x = Math.PI / 2; } };
  const shell = (p, r1, r2, h, y, mat, a0, a1) => { const s = add(p, new THREE.CylinderGeometry(r1, r2, h, 20, 1, true, a0, a1), mat, 0, y, 0); s.material = mat; return s; };
  mPlate.side = mDust.side = THREE.DoubleSide;
  const mDark = new THREE.MeshStandardMaterial({ color: 0x232528, roughness: 0.55, metalness: 0.55 });
  const mSteel = new THREE.MeshStandardMaterial({ color: 0x8d9399, roughness: 0.32, metalness: 1 });
  const mAcc = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.55, metalness: 0.1 });
  const mVisor = new THREE.MeshPhysicalMaterial({ color: enemy ? 0x3a1a12 : 0x3b2b12, roughness: 0.06, metalness: 1, clearcoat: 1, clearcoatRoughness: 0.05 });
  const mStrip = new THREE.MeshStandardMaterial({ color: 0xe8eef6, roughness: 0.4, emissive: 0xbfe0ff, emissiveIntensity: 0 }), mLed = new THREE.MeshBasicMaterial({ color: accent, toneMapped: false });
  const add = (p, geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; p.add(m); return m; };
  if (bones.Head) {
    const hd = mount(bones.Head);
    const shell = add(hd, new THREE.SphereGeometry(0.148, 32, 24), mPlate, 0, 0.1, -0.005); shell.scale.set(1, 1.06, 1.14);
    const vis = add(hd, new THREE.SphereGeometry(0.152, 36, 20, Math.PI / 2 - 1.3, 2.6, 0.5, 1.4), mVisor, 0, 0.1, -0.005); vis.scale.set(1, 1.06, 1.14);
    add(hd, rbox(0.15, 0.06, 0.08, 0.025), mDark, 0, 0.005, 0.1);
    for (const sx of [-1, 1]) { const e = add(hd, new THREE.CylinderGeometry(0.036, 0.04, 0.05, 16), mPlate, sx * 0.146, 0.08, -0.02); e.rotation.z = Math.PI / 2; add(hd, new THREE.BoxGeometry(0.02, 0.022, 0.045), new THREE.MeshBasicMaterial({ color: 0xfff2d8, toneMapped: false }), sx * 0.16, 0.12, 0.05); }
    add(hd, rbox(0.05, 0.035, 0.2, 0.012), mAcc, 0, 0.255, -0.01);
    const ant = add(hd, new THREE.CylinderGeometry(0.004, 0.006, 0.16, 6), mDark, -0.12, 0.25, -0.08); ant.rotation.x = -0.25;
    const ring = add(hd, new THREE.TorusGeometry(0.13, 0.032, 12, 36), mPlate, 0, -0.05, 0); ring.rotation.x = Math.PI / 2; add(hd, new THREE.CylinderGeometry(0.105, 0.12, 0.05, 24), mDark, 0, -0.085, 0);
    add(hd, rbox(0.07, 0.06, 0.1, 0.015), mPlate, 0.1, 0.225, -0.07); const cl = add(hd, new THREE.CylinderGeometry(0.018, 0.018, 0.02, 12), mDark, 0.1, 0.225, -0.015); cl.rotation.x = Math.PI / 2;
  }
  let pack = null;
  if (bones.Spine2) {
    const sp = mount(bones.Spine2); pack = sp;
    add(sp, rbox(0.4, 0.15, 0.11, 0.045), mPlate, 0, 0.115, 0.11);
    const sh = add(sp, new THREE.CylinderGeometry(0.2, 0.075, 0.24, 4), mPlate, 0, -0.06, 0.125); sh.rotation.y = Math.PI / 4; sh.scale.set(1, 1, 0.38);
    const pr = add(sp, new THREE.TorusGeometry(0.022, 0.006, 6, 18), mDark, 0, -0.07, 0.18);
    for (const sx of [-1, 1]) { const rb = add(sp, rbox(0.07, 0.2, 0.2, 0.03), mDark, sx * 0.165, -0.08, 0.0); for (const y of [-0.14, -0.09, -0.04]) add(sp, rbox(0.076, 0.012, 0.2, 0.005), mPlate, sx * 0.165, y, 0.0);
      const hs = add(sp, new THREE.TorusGeometry(0.15, 0.015, 8, 22, Math.PI), mDark, sx * 0.2, -0.1, -0.05); hs.rotation.set(0, Math.PI / 2, 0); }
    add(sp, rbox(0.2, 0.03, 0.02, 0.008), mAcc, 0, 0.13, 0.168);
    for (const sx of [-1, 1]) add(sp, rbox(0.035, 0.12, 0.012, 0.006), mStrip, sx * 0.13, 0.04, 0.166);
    add(sp, rbox(0.37, 0.47, 0.15, 0.06), mPlate, 0, 0.03, -0.2); add(sp, rbox(0.3, 0.13, 0.2, 0.04), mPlate, 0, 0.3, -0.16);
    for (const sx of [-1, 1]) { const pt = add(sp, new THREE.CylinderGeometry(0.05, 0.05, 0.03, 20), mPlate, sx * 0.155, 0.3, -0.16); pt.rotation.z = Math.PI / 2; const pi = add(sp, new THREE.CylinderGeometry(0.03, 0.03, 0.034, 16), mDark, sx * 0.157, 0.3, -0.16); pi.rotation.z = Math.PI / 2; }
    for (const y of [-0.08, 0.0, 0.08]) add(sp, rbox(0.27, 0.016, 0.02, 0.006), mDark, 0, y, -0.277);
    add(sp, rbox(0.11, 0.05, 0.014, 0.008), mAcc, 0, 0.17, -0.279);
    for (const sx of [-1, 1]) { add(sp, new THREE.CylinderGeometry(0.048, 0.048, 0.4, 18), mSteel, sx * 0.17, 0.03, -0.22); add(sp, new THREE.CylinderGeometry(0.05, 0.05, 0.03, 18), mDark, sx * 0.17, 0.24, -0.22);
      add(sp, rbox(0.014, 0.2, 0.01, 0.004), mStrip, sx * 0.165, 0.02, -0.276); add(sp, new THREE.BoxGeometry(0.02, 0.02, 0.01), mLed, sx * 0.08, 0.17, -0.279);
      add(sp, new THREE.CylinderGeometry(0.028, 0.045, 0.08, 16, 1, true), mDark, sx * 0.09, -0.24, -0.22); }
    add(sp, rbox(0.3, 0.05, 0.13, 0.02), mDark, 0, -0.205, -0.2);
  }
  for (const n of ['LeftArm', 'RightArm']) if (bones[n]) { const m = mount(bones[n]); const d = add(m, new THREE.SphereGeometry(0.115, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), mPlate, 0, 0.07, 0); d.rotation.x = Math.PI; d.scale.set(1, 1.1, 1); d.material.side = THREE.DoubleSide;
    add(m, new THREE.CylinderGeometry(0.1, 0.092, 0.07, 20), mPlate, 0, 0.125, 0); add(m, new THREE.CylinderGeometry(0.103, 0.103, 0.014, 20), mAcc, 0, 0.095, 0);
    bellows(m, 0.062, [0.2, 0.222]); }
  for (const n of ['LeftForeArm', 'RightForeArm']) if (bones[n]) { const m = mount(bones[n]); bellows(m, 0.058, [0.012]); add(m, new THREE.CylinderGeometry(0.066, 0.054, 0.19, 16), mPlate, 0, 0.13, 0); add(m, rbox(0.06, 0.12, 0.13, 0.015), mPlate, 0, 0.13, 0); add(m, new THREE.CylinderGeometry(0.056, 0.056, 0.025, 14), mStrip, 0, 0.225, 0); if (n[0] === 'L') add(m, new THREE.BoxGeometry(0.05, 0.035, 0.012), mLed, 0, 0.14, 0.052); }
  for (const n of ['LeftHand', 'RightHand']) if (bones[n]) { const m = mount(bones[n]); add(m, new THREE.CylinderGeometry(0.052, 0.056, 0.04, 16), mPlate, 0, 0.0, 0); add(m, rbox(0.09, 0.075, 0.04, 0.012), mDark, 0, 0.065, -0.012); }
  if (bones.Spine) { const m = mount(bones.Spine); for (const y of [0.01, 0.04]) { const b = add(m, new THREE.TorusGeometry(0.118, 0.01, 8, 24), mCloth, 0, y, 0); b.rotation.x = Math.PI / 2; b.scale.set(1, 0.7, 1); } }
  if (bones.Hips) { const h = mount(bones.Hips); add(h, rbox(0.34, 0.07, 0.24, 0.03), mDark, 0, 0.02, 0); for (const sx of [-1, 1]) add(h, rbox(0.07, 0.09, 0.07, 0.02), mDark, sx * 0.15, -0.01, 0.06); }
  for (const n of ['LeftUpLeg', 'RightUpLeg']) if (bones[n]) { const m = mount(bones[n]); shell(m, 0.118, 0.1, 0.27, 0.2, mPlate, Math.PI * 0.62, Math.PI * 1.5); bellows(m, 0.1, [0.045]); add(m, rbox(0.11, 0.13, 0.05, 0.015), mCloth, n[0] === 'L' ? 0.11 : -0.11, 0.22, 0.02); add(m, rbox(0.17, 0.25, 0.09, 0.035), mPlate, 0, 0.2, -0.06); for (const sx of [-1, 1]) add(m, rbox(0.045, 0.2, 0.15, 0.02), mPlate, sx * 0.085, 0.19, 0); add(m, rbox(0.1, 0.05, 0.02, 0.008), mDark, 0, 0.12, -0.108); }
  for (const n of ['LeftLeg', 'RightLeg']) if (bones[n]) { const m = mount(bones[n]); const k = add(m, new THREE.SphereGeometry(0.076, 18, 14), mPlate, 0, 0.0, -0.06); k.scale.set(1, 1.15, 0.72); bellows(m, 0.078, [0.045]); add(m, rbox(0.13, 0.3, 0.085, 0.03), mDust, 0, 0.2, -0.045); add(m, rbox(0.115, 0.2, 0.06, 0.025), mDust, 0, 0.22, 0.055); shell(m, 0.082, 0.07, 0.24, 0.22, mDust, 0, Math.PI * 2); add(m, rbox(0.06, 0.16, 0.012, 0.005), mDark, 0, 0.2, -0.09); add(m, new THREE.CylinderGeometry(0.07, 0.07, 0.025, 14), mStrip, 0, 0.34, 0); }
  for (const n of ['LeftFoot', 'RightFoot']) if (bones[n]) { const m = mount(bones[n]); add(m, rbox(0.135, 0.22, 0.12, 0.04), mDust, 0, 0.09, 0); add(m, rbox(0.13, 0.03, 0.115, 0.01), mDark, 0, 0.02, 0); }
  const fingers = Object.keys(bones).filter((n) => /Hand(Index|Middle|Ring|Pinky|Thumb)\d/.test(n)).map((n) => bones[n]), qc = new THREE.Quaternion(), qt = new THREE.Quaternion();
  const flames = [];
  if (pack) for (const sx of [-1, 1]) { const f = add(pack, new THREE.ConeGeometry(0.04, 0.34, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0x9cc6ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), sx * 0.09, -0.45, -0.22); f.rotation.x = Math.PI; f.castShadow = false; f.visible = false; flames.push(f); }
  let gun = null;
  const RG = new THREE.Vector3(0, -0.07, -0.075), LG = new THREE.Vector3(0, -0.055, 0.165);
  if (armed) { gun = buildRifle(accent); root.add(gun); RG.copy(gun.userData.rg); LG.copy(gun.userData.lg); }
  const mixer = new THREE.AnimationMixer(body), acts = {};
  for (const c of T.clips) acts[c.name] = mixer.clipAction(c);
  let cur = acts.Idle; cur?.play(); let lastT = null, aimP = -0.3, hipY = 0, airK = 0;
  const ZAX = new THREE.Vector3(0, 0, 1), UP = new THREE.Vector3(0, 1, 0), RX = new THREE.Vector3(), gp0 = new THREE.Vector3(), tR = new THREE.Vector3(), tL = new THREE.Vector3(), pR = new THREE.Vector3(), pL = new THREE.Vector3();
  return {
    root, bones, nightMats: [mStrip],
    animate(t, spd, air, jetting, o = {}) {
      const dt = lastT == null ? 0 : Math.min(0.1, Math.max(0, t - lastT)); lastT = t;
      const fwd = o.fwd ?? spd, lat = o.lat ?? 0, back = fwd < -0.4 && spd > 0.4;
      const want = air ? acts.Idle : spd > 3.2 ? acts.Run : spd > 0.4 ? acts.Walk : acts.Idle;
      if (want && want !== cur) { want.reset().play(); if (cur) want.crossFadeFrom(cur, 0.25, false); cur = want; }
      const dir = back ? -1 : 1;
      if (cur === acts.Run) cur.timeScale = clamp(spd / 4.4, 0.6, 1.2) * 0.82 * dir; else if (cur === acts.Walk) cur.timeScale = clamp(spd / 1.5, 0.5, 1.4) * 0.8 * dir; else cur.timeScale = 1;
      mixer.update(dt);
      if (gun) for (const f of fingers) { const th = /Thumb/.test(f.name); f.quaternion.multiply((th ? qt : qc).setFromAxisAngle(ZAX, (th ? 0.4 : 1) * (/Left/.test(f.name) ? -1 : 1))); }
      const k = 1 - Math.exp(-10 * dt);
      aimP += ((o.pitch ?? -0.35) - aimP) * k; airK += ((air ? 1 : 0) - airK) * (1 - Math.exp(-6 * dt));
      let a = 0; if (spd > 0.4 && !air) { a = Math.atan2(lat, fwd); if (back) a -= Math.sign(a || 1) * Math.PI; }
      hipY += (clamp(-a, -0.9, 0.9) - hipY) * (1 - Math.exp(-6 * dt));
      root.updateMatrixWorld(true); RX.set(1, 0, 0).applyQuaternion(root.getWorldQuaternion(_q1));
      rotW(bones.Hips, UP, hipY); rotW(bones.Spine, UP, -hipY * 0.5); rotW(bones.Spine1, UP, -hipY * 0.5);
      rotW(bones.Spine1, RX, -aimP * 0.22); rotW(bones.Spine2, RX, -aimP * 0.18);
      if (airK > 0.01) for (const sd of ['Left', 'Right']) { rotW(bones[sd + 'UpLeg'], RX, -0.75 * airK * (sd === 'Left' ? 1 : 0.7)); rotW(bones[sd + 'Leg'], RX, 1.15 * airK); }
      body.updateMatrixWorld(true);
      if (gun && bones.Spine2 && bones.RightArm && bones.LeftArm) {
        root.worldToLocal(bones.Spine2.getWorldPosition(gp0)); gun.position.set(gp0.x - 0.12, gp0.y - 0.02 + aimP * 0.1, gp0.z + 0.12); gun.rotation.set(-aimP, 0, 0); gun.updateMatrixWorld(true);
        tR.copy(RG).applyMatrix4(gun.matrixWorld); tL.copy(LG).applyMatrix4(gun.matrixWorld);
        root.localToWorld(pR.set(-0.5, gp0.y - 0.55, -0.15)); root.localToWorld(pL.set(0.45, gp0.y - 0.5, 0.05));
        ik2(bones.RightArm, bones.RightForeArm, bones.RightHand, tR, pR); ik2(bones.LeftArm, bones.LeftForeArm, bones.LeftHand, tL, pL);
      }
      for (const f of flames) { f.visible = !!jetting; if (jetting) f.scale.y = 0.75 + Math.random() * 0.5; }
    },
  };
}
function makePilotBasic(suit = 0xdad6cd, accent = 0x5980a6) {
  const g = new THREE.Group();
  const mSuit = new THREE.MeshStandardMaterial({ color: suit, roughness: 0.78 });
  const mDark = new THREE.MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.6, metalness: 0.35 });
  const mVisor = new THREE.MeshStandardMaterial({ color: 0x1b2836, roughness: 0.12, metalness: 0.9 });
  const mAcc = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.5 });
  const add = (geo, mat, x, y, z, p = g) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; p.add(m); return m; };
  add(new THREE.BoxGeometry(0.5, 0.6, 0.3), mSuit, 0, 1.32, 0);
  add(new THREE.BoxGeometry(0.42, 0.16, 0.05), mAcc, 0, 1.44, 0.16);
  add(new THREE.BoxGeometry(0.42, 0.52, 0.22), new THREE.MeshStandardMaterial({ color: 0x6d747b, metalness: 0.4, roughness: 0.55 }), 0, 1.34, -0.26);
  add(new THREE.BoxGeometry(0.42, 0.18, 0.27), mDark, 0, 0.98, 0);
  add(new THREE.SphereGeometry(0.185, 20, 16), mSuit, 0, 1.8, 0.01);
  add(new THREE.BoxGeometry(0.25, 0.1, 0.08), mVisor, 0, 1.8, 0.13);
  const legs = [], arms = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * 0.12, 0.94, 0); g.add(hip);
    add(new THREE.CapsuleGeometry(0.085, 0.34, 4, 8), mSuit, 0, -0.23, 0, hip);
    const knee = new THREE.Group(); knee.position.y = -0.47; hip.add(knee);
    add(new THREE.CapsuleGeometry(0.075, 0.32, 4, 8), mSuit, 0, -0.21, 0, knee);
    add(new THREE.BoxGeometry(0.13, 0.09, 0.26), mDark, 0, -0.44, 0.04, knee);
    legs.push({ hip, knee, s });
    const sh = new THREE.Group(); sh.position.set(s * 0.31, 1.56, 0); g.add(sh);
    add(new THREE.CapsuleGeometry(0.068, 0.24, 4, 8), mSuit, 0, -0.17, 0, sh);
    add(new THREE.CapsuleGeometry(0.062, 0.22, 4, 8), mSuit, 0, -0.43, 0.02, sh);
    arms.push({ sh, s });
  }
  add(new THREE.BoxGeometry(0.08, 0.12, 0.72), mDark, 0.17, 1.2, 0.36);
  return {
    root: g,
    animate(t, spd, air) {
      const amp = air ? 0.25 : clamp(spd / 5, 0, 1.2) * 0.55, w = 6 + spd * 0.9;
      for (const L of legs) { const a = Math.sin(t * w + (L.s > 0 ? 0 : Math.PI)) * amp; L.hip.rotation.x = a; L.knee.rotation.x = Math.max(0, -a) * 1.2 + (air ? 0.5 : 0); }
      for (const A of arms) A.sh.rotation.x = (A.s > 0 ? -0.9 : Math.sin(t * w + (A.s > 0 ? Math.PI : 0)) * amp * 0.6 - 0.15);
    },
  };
}
