// Power shield and locational damage for every HAWC and vehicle.
// The shield is a magnetic deflector fed by the fuel cell. It is invisible until a round lands, flares at the impact point,
// soaks 90% of each hit until it collapses, and recharges once the machine has been out of contact for 3 s, drawing cell power.
// Hits are resolved to a body part (cockpit, torso, arms, legs); damaged parts spark and smoke, and failing legs slow the walk.
import { THREE } from './lib.js?v=19';

export const PARTS = ['cockpit', 'torso', 'lArm', 'rArm', 'lLeg', 'rLeg'];
const WEIGHT = { cockpit: 0.1, torso: 0.34, lArm: 0.14, rArm: 0.14, lLeg: 0.16, rLeg: 0.16 };
export const PART_NAME = { cockpit: 'Cockpit', torso: 'Torso', lArm: 'Left arm', rArm: 'Right arm', lLeg: 'Left leg', rLeg: 'Right leg' };
const COL = { player: 0x9fd0ff, darken: 0xff8a52 };

const VS = `varying vec3 vN; varying vec3 vV; varying vec3 vL;
void main(){ vL = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
const FS = `uniform vec3 col; uniform float hit; uniform float idle; uniform vec3 hp; varying vec3 vN; varying vec3 vV; varying vec3 vL;
float hexEdge(vec2 p){ vec2 q = vec2(p.x * 1.1547, p.y + p.x * 0.57735); vec2 f = abs(fract(q) - 0.5); return smoothstep(0.38, 0.48, max(f.x, f.y)); }
void main(){
  float fr = pow(1.0 - abs(dot(vN, vV)), 2.4);
  vec3 d = normalize(vL); float ang = acos(clamp(dot(d, normalize(hp)), -1.0, 1.0));
  float ring = exp(-pow((ang - (1.0 - hit) * 1.4) * 6.0, 2.0)) * hit, core = exp(-ang * 6.0) * hit * hit;
  float hx = hexEdge(vec2(atan(d.z, d.x) * 2.6, d.y * 4.2) * 2.4);
  float a = fr * (idle * 0.4 + hit * 0.5) * (0.6 + 0.4 * hx) + ring * (0.35 + 0.65 * hx) + core * 1.3;
  gl_FragColor = vec4(col * a * 1.7, clamp(a, 0.0, 1.0));
}`;

const _v = new THREE.Vector3(), _w = new THREE.Vector3();
function ensure(u) {
  if (u.sh !== undefined) return u.sh;
  const d = u.def;
  if (!d || !(d.rig || d.gait || d.tank || d.hover)) { u.sh = null; return null; }
  const max = u.maxHp * (d.shield ?? (u.type === 'striker' ? 0.3 : 0.2));
  const mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { col: { value: new THREE.Color(COL.darken) }, hit: { value: 0 }, idle: { value: 0 }, hp: { value: new THREE.Vector3(0, 0, 1) } } });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 28), mat), R = Math.max(u.radius * 1.3, u.height * 0.4);
  mesh.scale.set(R, u.height * 0.62, R); mesh.position.y = u.height * 0.5; mesh.renderOrder = 3; mesh.visible = false; mesh.frustumCulled = false;
  u.root.add(mesh);
  u.parts = Object.fromEntries(PARTS.map((p) => [p, 1])); u.partAt = {};
  return (u.sh = { max, v: max, t: 99, on: true, mesh, u: mat.uniforms });
}
function region(u, at) {
  const dx = at.x - u.pos.x, dz = at.z - u.pos.z, lx = dx * Math.cos(u.yaw) - dz * Math.sin(u.yaw), ly = (at.y - u.pos.y) / u.height;
  if (ly > 0.82 && !u.def.tank && !u.def.hover) return 'cockpit';
  if (ly < 0.42) return lx < 0 ? 'lLeg' : 'rLeg';
  if (Math.abs(lx) > u.radius * 0.5) return lx < 0 ? 'lArm' : 'rArm';
  return 'torso';
}
const mobility = (u) => (u.parts && Math.min(u.parts.lLeg, u.parts.rLeg) < 0.3 ? 0.65 : 1);

export function installArmor(Mission) {
  const P_ = Mission.prototype, dmg0 = P_.damage, upd0 = P_.update, hawc0 = P_.updateHawc, hud0 = P_.hudState;

  P_.damage = function (t, dmg, owner, at) {
    if (!t || !t.alive || dmg <= 0 || t.kind) return dmg0.call(this, t, dmg, owner, at);
    const sh = ensure(t), P = this.player, isP = t === P.mech && P.mode === 'hawc';
    if (sh && at) {
      sh.t = 0;
      if (sh.on && sh.v > 0) {
        const raw = isP ? dmg * this.diff : dmg, a = Math.min(sh.v, raw * 0.9);
        sh.v -= a; dmg *= (raw - a) / raw;
        sh.u.col.value.setHex(t.faction === 'darken' ? COL.darken : COL.player);
        sh.u.hp.value.copy(sh.mesh.worldToLocal(_v.copy(at))); sh.u.hit.value = 1; sh.mesh.visible = true;
        this.fx.sparks(at, 4, 9, t.faction === 'darken' ? [1, 0.55, 0.3] : [0.6, 0.82, 1]);
        this.fx.flash(at, 700, 0.08, t.faction === 'darken' ? COL.darken : COL.player);
        if (sh.v <= 0.5) {
          sh.v = 0; sh.u.hit.value = 1.4;
          this.fx.sparks(_w.copy(t.pos).setY(t.pos.y + t.height * 0.55), 22, 12, [0.7, 0.85, 1]);
          this.e.sfx.noise?.(0.35, { f: 2400, type: 'bandpass', gain: 0.22 });
          if (isP) this.msg('Shield down. It recharges once you break contact.', 3.5);
        } else this.e.sfx.tone?.(isP ? 520 : 900, 0.07, { type: 'sine', gain: isP ? 0.07 : 0.035, to: isP ? 380 : 700 });
        if (dmg <= 0.01) {
          if (isP) { P.dmgT = Math.min(1, P.dmgT + 0.1); this.shake += 0.03; }
          else if (owner === 'player') { this.stats.hits++; P.hitT = 0.1; this.e.sfx.hit(); if (t.aggro !== undefined) t.aggro = 10; }
          return;
        }
      } else this.fx.flash(at, 900, 0.09, 0xffc890);
      const part = region(t, at), before = t.parts[part], eff = isP ? dmg * this.diff : dmg;
      t.parts[part] = Math.max(0, before - eff / (t.maxHp * WEIGHT[part]));
      t.partAt[part] = t.root.worldToLocal(_v.copy(at)).clone(); t.lastPart = part; t.lastPartT = this.time;
      if (isP) {
        const now = t.parts[part];
        if (before > 0.5 && now <= 0.5) this.msg(`${PART_NAME[part]} damaged`, 2.5);
        if (before > 0.2 && now <= 0.2) this.msg(part === 'lLeg' || part === 'rLeg' ? `${PART_NAME[part]} actuator failing. Speed down.` : `${PART_NAME[part]} failing`, 3.5);
      }
    }
    return dmg0.call(this, t, dmg, owner, at);
  };

  P_.update = function (dtRaw) {
    upd0.call(this, dtRaw);
    if (this.state === 'loading' || !this.units) return;
    const dt = Math.min(0.1, dtRaw), P = this.player;
    for (const u of this.units) {
      const sh = u.sh; if (!sh) continue;
      if (!u.alive) { sh.mesh.visible = false; continue; }
      sh.t += dt; sh.u.hit.value = Math.max(0, sh.u.hit.value - dt * 2.2);
      sh.u.idle.value = sh.on && sh.v > 0 && sh.t < 1.2 ? 1 - sh.t / 1.2 : 0;
      sh.mesh.visible = sh.u.hit.value > 0.01 || sh.u.idle.value > 0.01;
      const mine = u === P.mech && P.mode === 'hawc', powered = mine ? !P.noPower && (P.cell ?? 1) > 0.02 : u.piloted;
      if (sh.on && powered && sh.t > 3 && sh.v < sh.max) {
        const r = Math.min(sh.max - sh.v, sh.max * 0.11 * dt); sh.v += r;
        if (mine) P.cell = Math.max(0, (P.cell ?? 1) - 0.06 * r / sh.max);
      }
      if (!powered && mine) sh.v = Math.max(0, sh.v - sh.max * 0.5 * dt);
      for (const p of PARTS) {
        const k = u.parts[p], at = u.partAt[p]; if (k > 0.5 || !at) continue;
        if (Math.random() < (k < 0.25 ? 0.22 : 0.08)) { const w = u.root.localToWorld(_w.copy(at)); this.fx.sparks(w, 2, 6); if (k < 0.25 && Math.random() < 0.35) this.fx.smoke(w, 1, 0.1, 1.6, 2); }
      }
    }
  };

  P_.updateHawc = function (dt, inp) {
    const P = this.player, m = P.mech, x0 = m.pos.x, z0 = m.pos.z;
    hawc0.call(this, dt, inp);
    if (P.mech !== m || P.mode !== 'hawc') return;
    const sh = ensure(m), k = mobility(m);
    if (k < 1) { m.pos.x = x0 + (m.pos.x - x0) * k; m.pos.z = z0 + (m.pos.z - z0) * k; }
    if (sh && inp.pressed.has('KeyF')) { sh.on = !sh.on; this.msg(sh.on ? 'Shield on. It draws cell power to recharge.' : 'Shield off. Saving cell power.', 2.5); this.e.sfx.tone?.(sh.on ? 660 : 330, 0.08, { type: 'square', gain: 0.04 }); }
  };

  P_.hudState = function () {
    const h = hud0.call(this), P = this.player, m = P.mech;
    if (P.mode !== 'hawc' || !m) return { ...h, hasSh: false };
    const sh = ensure(m);
    return { ...h, hasSh: !!sh, shield: sh ? sh.v / sh.max : 0, shieldOn: sh ? sh.on : false, parts: m.parts ? { ...m.parts } : null, partHit: m.lastPartT != null && this.time - m.lastPartT < 0.5 ? m.lastPart : '' };
  };
}
