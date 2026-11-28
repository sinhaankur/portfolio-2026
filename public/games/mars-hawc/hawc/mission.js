import { THREE, clamp, lerp, damp, wrapAngle, rng, D2R } from './lib.js?v=22';
import { SKIES, buildWorld, buildRelay, buildMeson, buildShield, buildDropship, buildCrates, WORLD } from './world.js?v=22';
import { Actor, unitTemplate, makePilot, loadPilot } from './units.js?v=22';
import { installGoals, MK } from './goals.js?v=22';
import { installArmor } from './armor.js?v=22';
import { AGENCIES } from './levels.js?v=22';
import { UNITS, WEAPONS } from './levels.js?v=22';
import { FX } from './fx.js?v=22';
import { darkenWreck } from './assets.js?v=22';

const V = () => new THREE.Vector3();
const _a = V(), _b = V(), _c = V(), _d = V(), _e = V(), _f = V(), _g = V(), _p = V();
const UP = new THREE.Vector3(0, 1, 0);
const fmtTime = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const segHitsSphere = (a, b, c, r) => {
  _g.subVectors(b, a); const L2 = _g.lengthSq() || 1e-6;
  const t = clamp(_f.subVectors(c, a).dot(_g) / L2, 0, 1);
  _f.copy(a).addScaledVector(_g, t); return _f.distanceToSquared(c) < r * r ? t : -1;
};

class Markers {
  constructor(layer) { this.layer = layer; this.pool = []; this.n = 0; }
  begin() { this.n = 0; this.rects = []; }
  el() {
    let m = this.pool[this.n];
    if (!m) {
      const root = document.createElement('div');
      root.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;will-change:transform;font-family:var(--font-heading);font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--color-bg);text-shadow:0 1px 2px rgba(0,0,0,.55)';
      const box = document.createElement('div'); box.style.cssText = 'position:absolute;left:0;top:0';
      const cs = [];
      for (const [t, l] of [[1, 1], [1, 0], [0, 1], [0, 0]]) {
        const c = document.createElement('div');
        c.style.cssText = `position:absolute;width:9px;height:9px;${t ? 'top:0' : 'bottom:0'};${l ? 'left:0' : 'right:0'};border-${t ? 'top' : 'bottom'}:1.5px solid currentColor;border-${l ? 'left' : 'right'}:1.5px solid currentColor;filter:drop-shadow(0 1px 1px rgba(0,0,0,.5))`;
        box.appendChild(c); cs.push(c);
      }
      const label = document.createElement('div'); label.style.cssText = 'position:absolute;left:0;bottom:100%;margin-bottom:5px;white-space:nowrap;font-size:11px;display:flex;gap:6px;align-items:center';
      const name = document.createElement('span'); const dist = document.createElement('span'); dist.style.opacity = '0.75';
      const tag = document.createElement('span'); tag.style.cssText = 'padding:1px 5px;background:var(--color-accent);color:var(--color-bg);text-shadow:none;display:none';
      label.append(name, dist, tag);
      const bar = document.createElement('div'); bar.style.cssText = 'position:absolute;left:0;top:100%;margin-top:4px;height:2px;width:100%;background:rgba(242,242,243,.25)';
      const fill = document.createElement('div'); fill.style.cssText = 'height:100%;background:currentColor'; bar.appendChild(fill);
      box.append(label, bar); root.appendChild(box); this.layer.appendChild(root);
      m = this.pool[this.n] = { root, box, cs, name, dist, tag, bar, fill, label, k: '' };
    }
    this.n++; return m;
  }
  add(o) {
    const m = this.el();
    m.root.style.display = 'block';
    m.root.style.transform = `translate(${(o.x - o.w / 2) | 0}px,${(o.y - o.h / 2) | 0}px)`;
    m.box.style.width = (o.w | 0) + 'px'; m.box.style.height = (o.h | 0) + 'px';
    m.root.style.color = o.color || 'var(--color-bg)';
    if (m.k !== o.name) { m.name.textContent = o.name; m.k = o.name; }
    m.dist.textContent = o.dist || '';
    { const lx = o.x - o.w / 2, lw = ((o.name || '').length + (o.dist || '').length + (o.tag || '').length + 2) * 7 + 12, base = o.y - o.h / 2 - 5; let lift = 0;
      for (let i = 0; i < 6 && this.rects.some((r) => lx < r.x + r.w && lx + lw > r.x && Math.abs(base - lift - r.y) < 15); i++) lift += 15;
      this.rects.push({ x: lx, w: lw, y: base - lift }); m.label.style.marginBottom = (5 + lift) + 'px'; }
    m.tag.style.display = o.tag ? 'inline-block' : 'none'; if (o.tag) m.tag.textContent = o.tag;
    const bw = o.locked ? '2.5px' : '1.5px';
    for (const c of m.cs) { c.style.borderTopWidth = c.style.borderBottomWidth = c.style.borderLeftWidth = c.style.borderRightWidth = bw; }
    m.bar.style.display = o.hp == null ? 'none' : 'block'; if (o.hp != null) m.fill.style.width = Math.round(o.hp * 100) + '%';
  }
  end() { for (let i = this.n; i < this.pool.length; i++) this.pool[i].root.style.display = 'none'; }
  clear() { for (const m of this.pool) m.root.remove(); this.pool = []; }
}

export class Mission {
  constructor(engine, L, opts) {
    this.e = engine; this.L = L; this.opts = opts;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.3, 9000);
    this.units = []; this.structs = []; this.proj = []; this.msgs = []; this.runners = []; this.pending = [];
    this.time = 0; this.state = 'loading'; this.view = opts.view || 'tp';
    this.stats = { kills: 0, shots: 0, hits: 0, stolen: 0 };
    this.diff = { Recruit: 0.6, Veteran: 1, Ace: 1.45 }[opts.difficulty] ?? 1;
    this.shake = 0; this.R = rng(L.seed * 7 + 1);
    this.markers = new Markers(engine.dom.layer);
    this.aim = { point: V(), unit: null, struct: null, dist: 0 };
    this.camPos = V(); this.camInit = false; this.hudT = 0; this.radarT = 0; this.flags = {}; this.stepBob = 0;
  }

  async load() {
    const L = this.L, lay = L.layout;
    this.world = await buildWorld(this.scene, L, this.e.quality, this.opts);
    const H = this.H = this.world.heightAt;
    { // image-based light from a Mars sky gradient, so metal and glass reflect something; three strengths for day, twilight, night
      const sk = SKIES[L.sky] || SKIES.day, pm = new THREE.PMREMGenerator(this.e.renderer);
      const mk = (k) => { const s = new THREE.Scene(), geo = new THREE.SphereGeometry(10, 32, 16);
        const mat = new THREE.ShaderMaterial({ side: THREE.BackSide, uniforms: { top: { value: new THREE.Color(sk.zenith).multiplyScalar(k) }, mid: { value: new THREE.Color(sk.horizon).multiplyScalar(k * 1.1) }, bot: { value: new THREE.Color(sk.hemiGround).multiplyScalar(k * 0.8) } },
          vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
          fragmentShader: 'uniform vec3 top, mid, bot; varying vec3 vP; void main(){ float h = normalize(vP).y; vec3 c = h > 0.0 ? mix(mid, top, pow(h, 0.6)) : mix(mid, bot, pow(-h, 0.4)); gl_FragColor = vec4(c, 1.0); }' });
        s.add(new THREE.Mesh(geo, mat)); const t = pm.fromScene(s, 0.04).texture; geo.dispose(); mat.dispose(); return t; };
      this.envs = [mk(0.85), mk(0.32), mk(0.07)]; pm.dispose();
    }
    this.fx = new FX(this.scene, H);
    const types = new Set(['striker']);
    for (const w of L.waves || []) for (const g of w) types.add(g[0]);
    for (const g of lay.guards || []) types.add(g[0]);
    for (const g of L.reinforce?.group || []) types.add(g[0]);
    for (const t of L.preload || []) types.add(t);
    this.tpls = {};
    await Promise.all([...types].map(async (t) => { this.tpls[t] = await unitTemplate(t); }));
    this.colliders = [...this.world.colliders];
    if (lay.relay) {
      const g = buildRelay(); g.position.set(lay.relay[0], H(lay.relay[0], lay.relay[1]), lay.relay[1]); this.scene.add(g);
      this.relay = { kind: 'relay', obj: g, hp: 3000, maxHp: 3000, r: 12, h: 40, alive: true, faction: 'union', name: 'Relay', pos: g.position };
      this.structs.push(this.relay); this.colliders.push({ x: g.position.x + 1, z: g.position.z + 2, r: 13 });
      const cr = await buildCrates(6, this.R); cr.position.set(g.position.x - 6, g.position.y + 0.6, g.position.z - 12); this.scene.add(cr);
    }
    for (const [x, z] of lay.mesons || []) {
      const g = buildMeson(); g.position.set(x, H(x, z), z); this.scene.add(g);
      this.structs.push({ kind: 'meson', obj: g, hp: 1500, maxHp: 1500, r: 7.5, h: 26, alive: true, faction: 'darken', name: 'Meson tower', pos: g.position });
      this.colliders.push({ x, z, r: 8 });
    }
    if (lay.shield) {
      const [x, z, r] = lay.shield, s = buildShield(r); s.position.set(x, H(x, z) - 4, z); this.scene.add(s);
      this.shield = { x, z, r, mesh: s, c: new THREE.Vector3(x, H(x, z) - 4, z) };
    }
    if (lay.dropship) {
      const d = await buildDropship(); const [x, z] = lay.dropship; d.position.set(x, H(x, z) + 0.2, z); d.rotation.y = 0.6; this.scene.add(d);
      const col = { x, z, r: 10 }; this.colliders.push(col);
      if (lay.relay) {
        const fl = new THREE.Group(), fm = new THREE.MeshBasicMaterial({ color: 0xffb070, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
        const cg = new THREE.ConeGeometry(0.9, 6, 12, 1, true); cg.translate(0, -3, 0); cg.rotateX(Math.PI);
        for (const [fx, fz] of [[4.5, 3.5], [-4.5, 3.5], [4.5, -3.5], [-4.5, -3.5]]) { const c = new THREE.Mesh(cg, fm); c.position.set(fx, 0.8, fz); c.rotation.x = Math.PI; fl.add(c); }
        const pl = new THREE.PointLight(0xffa860, 0, 90, 2); pl.position.y = -1; fl.add(pl); d.add(fl); fl.visible = false;
        this.lander = { obj: d, x, z, y0: d.position.y, t: 30, col, fl, pl, trips: 0 };
      }
    }
    const P = this.player = { mode: 'hawc', yaw: 0, pitch: -0.06, heat: 0, fuel: 100, ammo: 24, acCd: 0, mslCd: 0, arm: 0, lockT: 0, lockTarget: null, locked: false,
      gashr: 5, hp: 100, hurtT: 0, rifleCd: 0, footPos: V(), footVel: V(), footVy: 0, footAir: false, vf: 0, vs: 0, shutT: 0, compromised: false };
    const m = this.spawn('striker', lay.start[0], lay.start[1], { faction: 'player', livery: this.opts.livery });
    const look = lay.mesons ? lay.mesons.reduce((s, q) => [s[0] + q[0] / lay.mesons.length, s[1] + q[1] / lay.mesons.length], [0, 0]) : lay.road ? lay.road[2] : !lay.spawnArc ? [lay.relay?.[0] ?? 0, lay.relay?.[1] ?? 0] : (() => { const az = ((lay.spawnArc[0] + lay.spawnArc[1]) / 2) * D2R; return [Math.sin(az) * 300, -Math.cos(az) * 300]; })();
    m.yaw = Math.atan2(look[0] - m.pos.x, look[1] - m.pos.z); P.yaw = m.yaw; P.mech = m;
    m.oneShot('a3StartupSequence', 0.9, 0);
    await loadPilot(); this.pilotFig = makePilot(0xdad6cd, new THREE.Color(AGENCIES[L.side]?.color || '#5980a6').getHex()); this.pilotFig.root.visible = false; this.scene.add(this.pilotFig.root);
    this.lamp = new THREE.SpotLight(0xe6eeff, 0, 230, 0.42, 0.55, 2); this.scene.add(this.lamp, this.lamp.target);
    this.fill = new THREE.PointLight(0xc9d6ff, 0, 60, 2); this.scene.add(this.fill);
    for (const [t, role, [x, z]] of lay.guards || []) { const u = this.spawn(t, x, z, { role, home: [x, z] }); u.yaw = this.R() * 6.28; }
    this.wave = 0; this.waveActive = false; this.waveT = 7; this.reinfT = L.reinforce?.every || 0; this.reinfN = 0;
    this.e.sfx.wind(L.sky === 'dust' ? 0.32 : 0.12);
    this.state = 'intro'; this.introT = 2.6; if (this.view !== 'fp') this.view = 'tp';
    this.msg(`${L.site.toUpperCase()} · ${L.lat.toFixed(1)}°, ${L.lon.toFixed(1)}°E`, 5);
    if (L.tips) {
      this.later(3, () => this.msg('WASD to walk · Shift to run · Space for jump jets', 8));
      this.later(9, () => this.msg('Left mouse: autocannon · Right mouse: missiles. Keep the reticle on a target to lock.', 9));
      this.later(17, () => this.msg('V switches between chase view and cockpit · E leaves the cockpit', 8));
    }
    if (L.type === 'hijack') {
      this.later(3, () => this.msg('The IFF shield absorbs Union fire. Leave the Striker [E] and close on the Talon on foot.', 10));
    }
    if (L.type === 'destroy') this.later(3, () => this.msg('Three Meson towers. Visibility is down to a few hundred metres.', 8));
    await this.setupGoals();
  }

  later(t, f) { this.pending.push({ t: this.time + t, f }); }
  msg(text, life = 6, voice = false) { this.msgs.push({ text, t: this.time, life }); if (this.msgs.length > 4) this.msgs.shift(); if (voice) { this.e.sfx.radio(); this.e.say(text, { who: 'command' }); } }

  spawn(type, x, z, o = {}) {
    const u = new Actor(type, this.tpls[type], { faction: o.faction || 'darken', livery: o.livery });
    u.pos.set(x, this.H(x, z), z); u.role = o.role || 'rush'; u.home = o.home || [x, z];
    if (u.def.tank || u.def.hover) u.root.rotation.order = 'YXZ';
    this.scene.add(u.root); this.units.push(u); return u;
  }
  spawnGroup(groups, arc) {
    const lay = this.L.layout;
    let k = 0;
    for (const [t, role, n] of groups) for (let i = 0; i < n; i++) {
      const a0 = arc ? arc[0] : 0, a1 = arc ? arc[1] : 360;
      const az = (a0 + (a1 - a0) * this.R()) * D2R, r = 470 + this.R() * 90;
      const c = lay.relay || [0, 0];
      const x = c[0] + Math.sin(az) * r, z = c[1] - Math.cos(az) * r;
      const u = this.spawn(t, x, z, { role, home: [x, z] }); u.yaw = Math.atan2(c[0] - x, c[1] - z); u.aggro = 0; k++;
    }
    return k;
  }

  hostiles() { return this.units.filter((u) => u.alive && u.piloted && u.faction === 'darken'); }

  // ----- main loop ---------------------------------------------------------
  update(dtRaw) {
    if (this.state === 'loading') return;
    let dt = dtRaw;
    if (this.slowT > 0) { this.slowT -= dtRaw; dt *= 0.3; }
    if (this.state === 'end') { dt *= 0.35; this.endT -= dtRaw; if (this.endT <= 0 && !this.reported) { this.reported = true; this.e.emit('result', this.result); } }
    this.time += dt;
    for (let i = this.pending.length - 1; i >= 0; i--) if (this.time >= this.pending[i].t) { const p = this.pending.splice(i, 1)[0]; p.f(); }
    const inp = this.e.input;
    if (this.state === 'intro') { this.introT -= dt; if (this.introT <= 0) this.state = 'play'; }
    if (this.state === 'play') this.updatePlayer(dt, inp);
    else this.idlePlayer(dt);
    for (const u of this.units) if (u !== this.player.mech || this.player.mode !== 'hawc') this.updateUnit(u, dt);
    for (const u of this.units) if (u.alive) this.damageFx(u, dt);
    if (this.player.mode === 'hawc') this.player.mech.update(dt);
    this.updateProjectiles(dt);
    this.updateRunners(dt);
    this.updateStructs(dt);
    if (this.state === 'play') { this.updateObjective(dt); this.updateSupport(dt, inp); this.updatePower(dt); this.updateDock(dt); this.updateHeritage(); }
    this.updateCrates(dt); this.updateWrecks(dt);
    this.updateCamera(dt);
    this.raycastAim();
    this.world.update(dt, this.focus(), this.camera); this.e.renderer.toneMappingExposure = this.world.exposure; this.updateNV(dt, inp);
    if (this.envs) { const dy = this.world.atmos.day, ev = this.envs[dy > 0.55 ? 0 : dy > 0.12 ? 1 : 2]; if (this.scene.environment !== ev) this.scene.environment = ev; }
    if (this.world.buffet > 0.02) this.shake = Math.max(this.shake, this.world.buffet * 0.35);
    this.updateLamp(); this.updateLander(dt); this.updateHab(dt);
    this.fx.update(dt);
    this.drawMarkers();
    this.radarT -= dtRaw; if (this.radarT <= 0) { this.radarT = 1 / 30; this.drawRadar(); this.drawCompass(); }
    this.hudT -= dtRaw; if (this.hudT <= 0) { this.hudT = 1 / 12; this.e.emit('hud', this.hudState()); this.e.sfx.wind(this.world.windLevel); }
    const d = this.e.dom, P = this.player;
    P.hitT = Math.max(0, (P.hitT || 0) - dtRaw); P.dmgT = Math.max(0, (P.dmgT || 0) - dtRaw * 1.4);
    if (d.hit) d.hit.style.opacity = P.hitT > 0 ? '1' : '0';
    if (d.vignette) d.vignette.style.opacity = String(Math.min(1, P.dmgT));
    if (d.fade) d.fade.style.opacity = String(this.state === 'intro' ? clamp(this.introT / 1.6 - 0.4, 0, 1) : 0);
    inp.pressed.clear();
  }
  focus() { return this.player.mode === 'hawc' ? this.player.mech.pos : this.player.footPos; }
  updateLander(dt) {
    const L = this.lander; if (!L) return;
    L.t = (L.t + dt) % 150; const t = L.t; let h = 0, thr = 0;
    if (t >= 55 && t < 60) thr = (t - 55) / 5 * 0.6;
    else if (t >= 60 && t < 78) { const u = t - 60; h = 0.85 * u * u; thr = 1; }
    else if (t >= 78 && t < 120) h = 1e4;
    else if (t >= 120 && t < 142) { const u = (t - 120) / 22; h = 280 * (1 - u) * (1 - u); thr = 0.4 + 0.6 * (1 - u) + (u > 0.75 ? 0.4 : 0); }
    if (t >= 60 && t < 60 + dt + 0.001 && !L.saidUp) { L.saidUp = true; L.trips++; this.msg(`Ore lander lifting off, load ${L.trips} bound for orbit`, 4); }
    if (t < 60) L.saidUp = false;
    if (t >= 141 && !L.saidDown) { L.saidDown = true; this.msg('Ore lander down on the pad', 3); } if (t < 141) L.saidDown = false;
    L.obj.visible = h < 1e3; L.obj.position.y = L.y0 + Math.min(h, 1e3); L.obj.rotation.z = h > 20 && t < 100 ? Math.min(0.25, (h - 20) / 600) : 0;
    L.col.r = h > 3 ? 0 : 10;
    L.fl.visible = thr > 0.01 && L.obj.visible; L.fl.scale.set(1, 0.4 + thr * (0.8 + Math.random() * 0.25), 1); L.pl.intensity = thr * 9000;
    if (thr > 0.2 && h < 25 && Math.random() < 0.7) this.fx.smoke(_c.set(L.x + (Math.random() - 0.5) * 14, L.y0 + 0.5, L.z + (Math.random() - 0.5) * 14), 1, 0.35, 6, 1.5);
    if (thr > 0.5) this.shake = Math.max(this.shake, 0.12 * thr * clamp(1 - _c.set(L.x, L.y0, L.z).distanceTo(this.camera.position) / 160, 0, 1));
  }
  insideHab(p) { for (const hb of this.world.base.habs) if (Math.hypot(p.x - hb.x, p.z - hb.z) < hb.r - 0.3) return hb; return null; }
  updateHab(dt) {
    const P = this.player; const hb = P.mode === 'foot' ? this.insideHab(P.footPos) : null;
    if (hb && !P.inHab) this.msg(P.hp < 100 ? 'Inside the Hab. Pressure up, suit patching.' : 'Inside the Hab. The potatoes are coming along.', 4);
    P.inHab = !!hb; if (hb) P.hp = Math.min(100, P.hp + 14 * dt);
  }
  ringCollide(c, pos, r) {
    const cs = Math.cos(c.yaw), sn = Math.sin(c.yaw), dx = pos.x - c.x, dz = pos.z - c.z;
    let lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
    if (r > 1.2) {
      const d = Math.hypot(lx, lz), mm = c.r + 1 + r; if (d < mm && d > 0.001) { lx *= mm / d; lz *= mm / d; }
      const ex = lx, ez = lz - (c.r + c.len / 2 + 0.3), de = Math.hypot(ex, ez), me = 2.2 + r; if (de < me && de > 0.001) { lx = ex * me / de; lz = ez * me / de + (c.r + c.len / 2 + 0.3); }
    } else {
      const d = Math.hypot(lx, lz), inGap = lz > 0 && Math.abs(lx) < c.door - r;
      if (!inGap && d > 0.001) { if (d < c.r - 0.1) { const lim = c.r - 0.35 - r; if (d > lim) { lx *= lim / d; lz *= lim / d; } } else if (d < c.r + r + 0.1) { const lim = c.r + r + 0.1; lx *= lim / d; lz *= lim / d; } }
      if (lz > c.r - 0.9 && lz < c.r + c.len + 0.2) { const w = 1.4; if (Math.abs(lx) < w) { const lim = w - 0.12 - r; if (Math.abs(lx) > lim) lx = Math.sign(lx) * lim; } else if (Math.abs(lx) < w + 0.12 + r) lx = Math.sign(lx) * (w + 0.12 + r); }
    }
    pos.x = c.x + lx * cs + lz * sn; pos.z = c.z - lx * sn + lz * cs;
  }
  updateLamp() {
    const n = this.world.night, P = this.player, L = this.lamp; if (!L) return;
    L.intensity = n * (P.mode === 'hawc' ? 1500 : 260); L.visible = n > 0.02;
    for (const mt of this.pilotFig?.nightMats || []) mt.emissiveIntensity = 0.15 + 1.6 * n;
    const F = this.fill; F.visible = n > 0.02;
    if (F.visible && this.camDir) {
      if (P.mode === 'hawc') { const h = P.mech.height; F.position.copy(P.mech.pos).setY(P.mech.pos.y + h * 0.85).addScaledVector(this.camDir, -h * 1.1); F.intensity = n * 1.5 * h * h; F.distance = h * 6; }
      else { F.position.copy(P.footPos).setY(P.footPos.y + 1.9).addScaledVector(this.camDir, -1.8); F.intensity = n * 4; F.distance = 14; }
    }
    if (!L.visible || !this.camDir) return;
    if (P.mode === 'hawc') L.position.copy(P.mech.pos).setY(P.mech.pos.y + P.mech.height * 0.78).addScaledVector(this.camDir, P.mech.height * 0.75);
    else L.position.copy(P.footPos).setY(P.footPos.y + 1.5).addScaledVector(this.camDir, 0.6);
    L.target.position.copy(L.position).addScaledVector(this.camDir, 40);
  }

  idlePlayer(dt) { const P = this.player; if (P.mode === 'hawc') { const m = P.mech; m.animate(0, 0, false); } }

  updatePlayer(dt, inp) {
    const P = this.player;
    const sens = 0.0021 * (this.opts.sens || 1);
    const kt = (inp.keys.has('ArrowLeft') ? 1 : 0) - (inp.keys.has('ArrowRight') ? 1 : 0);
    P.yaw = wrapAngle(P.yaw - inp.dx * sens + kt * 1.6 * dt);
    P.pitch = clamp(P.pitch - inp.dy * sens * (this.opts.invertY ? -1 : 1), -0.75, 0.6);
    if (inp.pressed.has('KeyV')) { this.view = this.view === 'tp' ? 'fp' : 'tp'; this.cine = null; this.e.emit('view', this.view); }
    if (P.mode === 'hawc') this.updateHawc(dt, inp); else this.updateFoot(dt, inp);
    const sfx = this.e.sfx; sfx.hum(P.mode === 'hawc' && !P.noPower ? (this.view === 'fp' ? 0.06 : 0.025) * (P.shutT > 0 ? 0.3 : 1) : 0);
    if (P.mode === 'foot') {
      const sp = Math.hypot(P.footVel.x, P.footVel.z), hard = sp > 3.2 || P.hp < 40;
      if (!P.footAir) { P.stepAcc = (P.stepAcc || 0) + sp * dt; if (P.stepAcc > (hard ? 1.5 : 1.1)) { P.stepAcc = 0; sfx.foot(hard); } }
      P.breathT = (P.breathT || 0) - dt; if (P.breathT <= 0) { P.inhale = !P.inhale; P.breathT = (hard ? 0.9 : 1.7) + Math.random() * 0.3; sfx.breath(P.inhale, hard); }
    }
  }

  updateHawc(dt, inp) {
    const P = this.player, m = P.mech, k = inp.keys, H = this.H, sfx = this.e.sfx;
    const shut = P.shutT > 0;
    if (shut) { P.shutT -= dt; if (P.shutT <= 0) { m.oneShot('a3StartupSequence', 1.3); sfx.servo(); this.msg('Reactor back online', 4); } }
    const W = k.has('KeyW') || k.has('ArrowUp'), S = k.has('KeyS') || k.has('ArrowDown'), A = k.has('KeyA'), D = k.has('KeyD');
    const run = (k.has('ShiftLeft') || k.has('ShiftRight')) && W;
    const busy = shut || m.lockAnim > 0;
    const f = busy ? 0 : (W ? 1 : 0) - (S ? 1 : 0), s = busy ? 0 : (D ? 1 : 0) - (A ? 1 : 0);
    const limp = m.hp / m.maxHp < 0.15 ? 0.62 : 1, tf = (f > 0 ? (run ? 12 : 6.5) : f < 0 ? -2.6 : 0) * limp;
    P.vf = damp(P.vf, tf, run ? 1.5 : 2.6, dt); P.vs = damp(P.vs, s * 3.2, 3, dt);
    const dy = wrapAngle(P.yaw - m.yaw), tr = busy ? 0 : Math.abs(P.vf) > 8 ? 4.5 : 7;
    const turn = clamp(dy, -tr * dt, tr * dt); m.yaw += turn;
    const fwd = m.forward(_a), right = _b.set(-fwd.z, 0, fwd.x);
    m.pos.addScaledVector(fwd, P.vf * dt).addScaledVector(right, P.vs * dt);
    this.collide(m.pos, m.radius, m);
    const g = H(m.pos.x, m.pos.z);
    const jets = k.has('Space') && P.fuel > 1 && !busy;
    if (jets) {
      m.vy = Math.min(m.vy + 9.5 * dt, 9); P.fuel -= 30 * dt; P.heat += 7 * dt; m.airborne = true;
      if (Math.random() < 0.8) { for (const b of ['Foot_L_04', 'Foot_R_09']) { const p = m.bonePos(b, _c); if (p) this.fx.jet(p); } }
      P.jetSfx = (P.jetSfx || 0) - dt; if (P.jetSfx <= 0) { P.jetSfx = 0.2; sfx.jet(); }
      if (m.pos.y - g < 4) this.fx.dust(_c.set(m.pos.x, g, m.pos.z), 2, 4, 3.5, 0.25);
    } else if (!m.airborne) P.fuel = Math.min(100, P.fuel + 16 * dt);
    if (m.airborne) {
      m.vy -= 3.71 * dt; m.pos.y += m.vy * dt;
      if (m.pos.y <= g && m.vy <= 0) {
        if (m.vy < -4) { this.shake += Math.min(0.8, -m.vy * 0.06); this.fx.dust(_c.set(m.pos.x, g, m.pos.z), 14, 5, 5, 0.4); sfx.step(null, 1.6); m.oneShot('a8Landing', 1.6, 0.15); }
        m.pos.y = g; m.vy = 0; m.airborne = false;
      }
    } else m.pos.y = g;
    m.animate(P.vf, P.vs, Math.abs(turn) > 0.004 && Math.abs(P.vf) < 0.5);
    if (m.stepped()) { const p = _c.set(m.pos.x, g, m.pos.z).addScaledVector(right, (m.phase > 0.5 ? 1 : -1) * 1.2); this.fx.dust(p, 5, 1.6, 2.6, 0.28); sfx.step(null, run ? 1.1 : 0.8); this.stepBob = run ? 0.35 : 0.22; this.shake += this.view === 'fp' ? 0.07 : 0.03; }
    P.heat = Math.max(0, P.heat - (shut ? 34 : 15) * dt);
    if (P.heat >= 100 && !shut) { P.heat = 100; P.shutT = 3.4; m.oneShot('a2ShutdownOverheat', 1); sfx.alarm(); this.msg('Heat critical. Reactor shut down.', 4); }
    // lock
    const tgt = this.aim.unit && this.aim.unit.faction === 'darken' && this.aim.unit.piloted ? this.aim.unit : (this.aim.struct && this.aim.struct.faction === 'darken' ? this.aim.struct : null);
    if (tgt && this.aim.dist < 400) { if (P.lockTarget === tgt) P.lockT += dt; else { P.lockTarget = tgt; P.lockT = 0; } }
    else { P.lockT -= dt * 1.2; if (P.lockT <= 0) { P.lockT = 0; P.lockTarget = null; } }
    if (P.lockTarget && !P.lockTarget.alive) { P.lockTarget = null; P.lockT = 0; }
    const was = P.locked; P.locked = !!P.lockTarget && P.lockT > MK.lock[this.mk.msl - 1]; if (P.locked && !was) sfx.lock();
    // weapons
    P.acCd -= dt; P.mslCd -= dt;
    if (inp.lmb && !busy && P.rounds <= 0 && inp.pressed.has('lmb')) this.msg('Autocannon dry. Ammo crates refill it.', 2);
    if (inp.lmb && P.acCd <= 0 && !busy && P.rounds > 0) {
      P.acCd = MK.acCd[this.mk.ac - 1]; P.heat += 2.3; P.rounds--;
      const bone = (P.arm ^= 1) ? 'LowerArm_L_014' : 'LowerArm_R_017';
      const mz = (m.bonePos(bone, _c) || _c.copy(m.pos).setY(m.pos.y + 4.4)).addScaledVector(fwd, 2.3);
      const dir = _d.subVectors(this.aim.point, mz).normalize();
      dir.x += (Math.random() - 0.5) * 0.008; dir.y += (Math.random() - 0.5) * 0.008; dir.z += (Math.random() - 0.5) * 0.008; dir.normalize();
      this.fire({ owner: 'player', faction: this.playerFaction(), pos: mz, dir, speed: 340, dmg: MK.acDmg[this.mk.ac - 1], color: 0xffd6a0, w: 0.22, len: 7, life: 1.7 });
      this.fx.muzzle(mz, dir, 1.1); sfx.cannon(); this.stats.shots++; this.shake += 0.025;
      if (this.disguised()) this.compromise();
    }
    const salvo = Math.min(P.ammo, MK.salvo[this.mk.msl - 1]);
    if (inp.rmb && P.mslCd <= 0 && salvo >= 2 && !busy) {
      P.mslCd = 3.4; P.ammo -= salvo; P.heat += 9; const target = P.locked ? P.lockTarget : null; const ap = this.aim.point.clone();
      for (let i = 0; i < salvo; i++) this.later(i * 0.08, () => {
        const sp = m.bonePos(i % 2 ? 'Shoulder_L_012' : 'Shoulder_R_015', _c) || _c.copy(m.pos).setY(m.pos.y + 6);
        sp.y += 1.1; const f2 = m.forward(_e); const dir = _d.copy(f2).multiplyScalar(0.8).add(UP).normalize();
        this.missile({ owner: 'player', faction: this.playerFaction(), pos: sp, dir, target, point: ap, dmg: MK.mslDmg[this.mk.msl - 1], splash: 7 });
        sfx.missile();
      });
      this.stats.shots += salvo;
      if (this.disguised()) this.compromise();
    } else if (inp.rmb && salvo < 2 && inp.pressed.has('rmb')) this.msg('Missile pods empty', 2);
    // exit
    P.prompt = null;
    if ((!busy || P.noPower) && !m.airborne && Math.abs(P.vf) < 1.2) P.prompt = { key: 'E', text: 'Leave the cockpit' };
    if (inp.pressed.has('KeyE') && P.prompt) this.exitHawc();
  }

  playerFaction() { const P = this.player; return P.mode === 'hawc' && P.mech.type === 'talon' ? 'darken' : 'union'; }
  disguised() { const P = this.player; return P.mode === 'hawc' && P.mech.type === 'talon' && !P.compromised; }
  compromise() { if (this.player.compromised) return; this.player.compromised = true; this.msg('IFF compromised. They know it is you.', 5); this.e.sfx.alarm(); }

  exitHawc() {
    const P = this.player, m = P.mech;
    m.piloted = false; m.faction = 'empty'; m.cell = P.cell; P.noPower = false;
    const right = _b.set(-Math.cos(m.yaw), 0, Math.sin(m.yaw));
    P.footPos.copy(m.pos).addScaledVector(right, 4.5); P.footPos.y = this.H(P.footPos.x, P.footPos.z) + 2.5; P.footVy = 1.5; P.footAir = true;
    P.mode = 'foot'; P.lastMech = m; this.pilotFig.root.visible = true; P.lockTarget = null; P.locked = false;
    this.flags.exited = true; this.e.sfx.servo(); this.msg('Out of the cockpit. A pilot on foot is hard for a HAWC to hit, but fragile.', 6);
    if (this.L.type === 'hijack' && !this.flags.gashr) this.later(6, () => { if (!this.flags.gashr) this.msg('Get within 50 m of the Talon, aim at it and press Q to fire GASHR.', 8); });
  }
  board(u) {
    const P = this.player;
    P.mode = 'hawc'; P.mech = u; u.piloted = true; u.faction = 'player'; u.gashrT = 0;
    P.yaw = u.yaw; P.vf = P.vs = 0; P.heat = 0; P.fuel = 100; P.shutT = 0; P.cell = u.cell ?? 0.85; P.noPower = false; P.lowWarn = false;
    if (u.type !== 'striker') { this.stats.stolen++; P.ammo = Math.max(P.ammo, 12); P.compromised = false; this.msg(`${u.def.name} is yours.${this.shield ? ' The shield reads you as Darken now.' : ''}`, 6); }
    else this.msg('Back in the Striker', 3);
    this.pilotFig.root.visible = false; u.oneShot('a3StartupSequence', 1.4); this.e.sfx.servo(); this.flags.boarded = this.flags.boarded || u.type === 'talon';
  }
  ejectPilot(u) {
    u.piloted = false; u.faction = 'empty'; u.vel.set(0, 0, 0);
    const fig = makePilot(0x6b6a66, 0x8a3a24); fig.root.position.copy(u.pos); fig.root.position.y += u.height * 0.8; this.scene.add(fig.root);
    const away = _a.subVectors(u.pos, this.focus()).setY(0).normalize();
    this.runners.push({ fig, vel: away.clone().multiplyScalar(5.5), vy: 3, t: 9 });
    this.fx.smoke(_c.copy(u.pos).setY(u.pos.y + u.height * 0.8), 6, 0.6, 2.5);
    this.e.sfx.servo();
    if (u.def.boardable) this.msg(`Pilot ejected. ${u.def.name} is empty. Walk up and press E.`, 6);
    else { this.msg(`${u.def.name} crew bailed out. Vehicle disabled.`, 5); this.stats.kills++; this.addPoints(250, `${u.def.name} crew bailed`); }
    this.flags.gashr = true;
  }

  updateFoot(dt, inp) {
    const P = this.player, k = inp.keys, H = this.H, sfx = this.e.sfx, fig = this.pilotFig;
    const W = k.has('KeyW') || k.has('ArrowUp'), S = k.has('KeyS') || k.has('ArrowDown'), A = k.has('KeyA'), D = k.has('KeyD');
    const run = k.has('ShiftLeft') || k.has('ShiftRight');
    const fwd = _a.set(Math.sin(P.yaw), 0, Math.cos(P.yaw)), right = _b.set(-fwd.z, 0, fwd.x);
    const want = _c.set(0, 0, 0).addScaledVector(fwd, (W ? 1 : 0) - (S ? 1 : 0)).addScaledVector(right, (D ? 1 : 0) - (A ? 1 : 0));
    if (want.lengthSq() > 0) want.normalize().multiplyScalar(run ? 7.5 : 4.2);
    const kk = P.footAir ? 0.8 : 9;
    P.footVel.x = damp(P.footVel.x, want.x, kk, dt); P.footVel.z = damp(P.footVel.z, want.z, kk, dt);
    P.footPos.x += P.footVel.x * dt; P.footPos.z += P.footVel.z * dt;
    this.collide(P.footPos, 0.5, null);
    const g = H(P.footPos.x, P.footPos.z);
    if (inp.pressed.has('Space') && !P.footAir) { P.footVy = 4.4; P.footAir = true; }
    if (P.footAir) { P.footVy -= 3.71 * dt; P.footPos.y += P.footVy * dt; if (P.footPos.y <= g) { P.footPos.y = g; P.footAir = false; P.footVy = 0; this.fx.dust(P.footPos, 3, 0.4, 0.8, 0.25); } }
    else P.footPos.y = g;
    const spd = Math.hypot(P.footVel.x, P.footVel.z);
    fig.root.position.copy(P.footPos); fig.root.rotation.y = P.yaw; this.updateJetpack(dt, inp); fig.animate(this.time, spd, P.footAir, P.jetting, { pitch: P.pitch, fwd: P.footVel.x * Math.sin(P.yaw) + P.footVel.z * Math.cos(P.yaw), lat: -P.footVel.x * Math.cos(P.yaw) + P.footVel.z * Math.sin(P.yaw) });
    fig.root.visible = this.view === 'tp';
    if (spd > 1 && !P.footAir) { P.stepT = (P.stepT || 0) - dt * spd; if (P.stepT <= 0) { P.stepT = 2.2; this.stepBob = 0.06; } }
    P.hurtT -= dt; if (P.hurtT < -5) P.hp = Math.min(100, P.hp + 3 * dt);
    // rifle
    P.rifleCd -= dt;
    const eye = _e.copy(P.footPos).setY(P.footPos.y + 1.4).addScaledVector(right, 0.2);
    if (inp.lmb && P.rifleCd <= 0) {
      P.rifleCd = MK.rifleCd[this.mk.rifle - 1];
      const dir = _d.subVectors(this.aim.point, eye).normalize();
      this.fire({ owner: 'player', faction: 'union', pos: eye.clone().addScaledVector(fwd, 0.6), dir, speed: 520, dmg: MK.rifle[this.mk.rifle - 1], color: 0xcfe2ff, w: 0.06, len: 3, life: 0.8 });
      sfx.rifle(); this.stats.shots++;
    }
    // GASHR / boarding
    P.prompt = null;
    const t = this.gashrTarget();
    const near = this.units.filter((u) => u.alive && !u.piloted && u.def.boardable && u.pos.distanceTo(P.footPos) < 9.5).sort((a, b) => a.pos.distanceTo(P.footPos) - b.pos.distanceTo(P.footPos))[0];
    if (near) { P.prompt = { key: 'E', text: `Board ${near.def.name}` }; if (inp.pressed.has('KeyE')) { this.board(near); return; } }
    else if (t && t.alive && t.piloted && t.faction === 'darken' && t.gashrT <= 0) {
      const d = t.pos.distanceTo(P.footPos);
      P.prompt = d < 50 ? { key: 'Q', text: `GASHR the ${t.def.name}` } : { key: 'Q', text: `Get within 50 m (${Math.round(d)} m)` };
    }
    if (inp.pressed.has('KeyQ')) {
      if (P.gashr <= 0) this.msg('No GASHR canisters left', 3);
      else if (t && t.alive && t.piloted && t.faction === 'darken' && t.pos.distanceTo(P.footPos) < 50) {
        P.gashr--; const c = t.center(_f.set(0, 0, 0)); const dir = _d.subVectors(c, eye).normalize(); dir.y += 0.08; dir.normalize();
        this.fire({ owner: 'player', faction: 'union', pos: eye.clone(), dir, speed: 60, dmg: 0, color: 0x9fd0ff, w: 0.35, len: 0.9, life: 2.5, gashr: true, target: t, grav: 1.2 });
        sfx.missile();
      } else this.msg('GASHR needs a hostile HAWC within 50 m under the reticle', 3);
    }
  }

  gashrTarget() {
    const a = this.aim.unit, P = this.player;
    if (a && a.alive && a.piloted && a.faction === 'darken') return a;
    let best = null, bestA = 0.24;
    for (const u of this.units) {
      if (!u.alive || !u.piloted || u.faction !== 'darken') continue;
      if (u.pos.distanceTo(P.footPos) > 60) continue;
      u.center(_g).sub(this.camera.position).normalize();
      const ang = Math.acos(clamp(_g.dot(this.camDir), -1, 1));
      if (ang < bestA) { bestA = ang; best = u; }
    }
    return best;
  }

  // ----- AI ----------------------------------------------------------------
  updateUnit(u, dt) {
    u.t += dt;
    if (!u.alive) {
      if (u.deathT > 0) { u.deathT -= dt; if (u.deathT <= 0) this.wreck(u); }
      if (u.smokeT > 0) { u.smokeT -= dt; if (Math.random() < 0.3) this.fx.smoke(_c.copy(u.pos).setY(u.pos.y + u.height * 0.5), 1, 0.08, 3, 3); }
      u.update(dt); return;
    }
    if (u.gashrT > 0) { u.gashrT -= dt; if (Math.random() < 0.5) this.fx.sparks(_c.copy(u.pos).setY(u.pos.y + u.height * 0.75), 2, 5, [0.6, 0.8, 1]); if (u.gashrT <= 0) this.ejectPilot(u); }
    const H = this.H;
    if (!u.piloted) {
      u.animate(0, 0, false);
      if (!u.def.rig && !u.def.tank) u.pos.y = damp(u.pos.y, H(u.pos.x, u.pos.z) + (u.def.hover ? 0.4 : 0), 2, dt);
      u.update(dt); if (u.def.tank || u.def.hover) u.root.rotation.y = u.yaw; return;
    }
    const P = this.player, pp = this.focus();
    const dPlayer = Math.hypot(u.pos.x - pp.x, u.pos.z - pp.z);
    const detect = P.mode === 'hawc' ? 230 : 75;
    u.aggro -= dt;
    let tgt = null; const tpos = _p;
    if (this.state === 'play' && !this.disguised() && (dPlayer < detect || u.aggro > 0)) { tgt = 'player'; if (P.mode === 'hawc') P.mech.center(tpos); else tpos.copy(P.footPos).setY(P.footPos.y + 1.1); }
    else if (this.state === 'play' && !['sentry', 'anchor', 'patrol', 'escort'].includes(u.role)) { const gt = this.guardTarget(u); if (gt) { tgt = 'relay'; tpos.copy(gt.pos).setY(gt.pos.y + Math.min(8, gt.h * 0.5)); } }
    const range = { rush: 55, flank: 85, snipe: 200, anchor: 70, sentry: 65, patrol: 95 }[u.role] || 60;
    const goal = _c;
    let mvx = 0, mvz = 0;
    if (tgt) {
      goal.copy(tpos);
      const tx = goal.x - u.pos.x, tz = goal.z - u.pos.z, d = Math.hypot(tx, tz) || 1;
      u.strafeT -= dt; if (u.strafeT <= 0) { u.strafeT = 3 + this.R() * 4; u.strafeDir *= -1; }
      if (d > range * 1.15) { mvx = tx / d; mvz = tz / d; }
      else if (d < range * 0.6) { mvx = -tx / d * 0.7; mvz = -tz / d * 0.7; }
      else { const sf = u.role === 'flank' ? 0.9 : 0.5; mvx = -tz / d * u.strafeDir * sf; mvz = tx / d * u.strafeDir * sf; }
    } else {
      const patrol = u.role === 'patrol' || u.role === 'sentry';
      const a = u.t * (u.role === 'patrol' ? 0.09 : 0.05) + u.home[0];
      goal.set(u.home[0] + (patrol ? Math.cos(a) * 45 : 0), 0, u.home[1] + (patrol ? Math.sin(a) * 45 : 0));
      const tx = goal.x - u.pos.x, tz = goal.z - u.pos.z, d = Math.hypot(tx, tz) || 1;
      if (d > 6) { const s = Math.min(1, d / 30) * 0.45; mvx = tx / d * s; mvz = tz / d * s; }
    }
    for (const o of this.units) {
      if (o === u || !o.alive) continue;
      const dx = u.pos.x - o.pos.x, dz = u.pos.z - o.pos.z, d2 = dx * dx + dz * dz, rr = (u.radius + o.radius + 6) ** 2;
      if (d2 < rr && d2 > 0.01) { const d = Math.sqrt(d2), f = (1 - d / Math.sqrt(rr)) * 1.2; mvx += dx / d * f; mvz += dz / d * f; }
    }
    const spd = u.def.speed * (tgt ? 1 : 0.6);
    u.vel.x = damp(u.vel.x, mvx * spd, 1.6, dt); u.vel.z = damp(u.vel.z, mvz * spd, 1.6, dt);
    u.pos.x += u.vel.x * dt; u.pos.z += u.vel.z * dt;
    this.collide(u.pos, u.radius, u);
    const dTgt = tgt ? Math.hypot(tpos.x - u.pos.x, tpos.z - u.pos.z) : 1e9;
    const sp2 = Math.hypot(u.vel.x, u.vel.z);
    const faceTgt = tgt && dTgt < u.def.range * 1.15 && (u.def.rig || u.def.gait || u.def.tank);
    const wantYaw = faceTgt ? Math.atan2(tpos.x - u.pos.x, tpos.z - u.pos.z) : sp2 > 0.4 ? Math.atan2(u.vel.x, u.vel.z) : u.yaw;
    const turnRate = u.def.hover ? 2.4 : u.def.rig ? 1.7 : 0.9;
    u.yaw += clamp(wrapAngle(wantYaw - u.yaw), -turnRate * dt, turnRate * dt);
    const g = H(u.pos.x, u.pos.z);
    const fwd = u.forward(_a), lx = _b.set(Math.cos(u.yaw), 0, -Math.sin(u.yaw));
    if (u.def.hover) {
      u.pos.y = damp(u.pos.y, g + u.def.hover + Math.sin(u.t * 1.4) * 0.3, 4, dt);
      const vf = u.vel.dot(fwd), vs = u.vel.dot(lx);
      u.root.rotation.set(clamp(vf * 0.012, -0.2, 0.2), u.yaw, clamp(-vs * 0.02, -0.25, 0.25));
      if (sp2 > 3 && Math.random() < 0.35) this.fx.dust(_c.set(u.pos.x, g, u.pos.z), 1, 3, 3, 0.2);
    } else if (u.def.tank) {
      u.pos.y = g; const n = this.world.normalAt(u.pos.x, u.pos.z, _d);
      u.root.rotation.set(Math.atan2(n.dot(fwd), n.y), u.yaw, -Math.atan2(n.dot(lx), n.y));
      if (sp2 > 1.5 && Math.random() < 0.25) this.fx.dust(_c.copy(u.pos).addScaledVector(fwd, -4), 1, 2, 2.5, 0.22);
    } else if (u.def.gait) {
      const w = Math.min(1, sp2 / 2);
      u.pos.y = g + Math.abs(Math.sin(u.t * 3)) * 0.3 * w; u.model.rotation.z = Math.sin(u.t * 3) * 0.035 * w;
      u.gaitT = (u.gaitT || 0) + dt * 3 * w; if (u.gaitT > Math.PI) { u.gaitT = 0; this.fx.dust(_c.set(u.pos.x, g, u.pos.z), 4, 2, 3, 0.3); this.e.sfx.step(dPlayer, 1.3); if (dPlayer < 60) this.shake += 0.05; }
    } else {
      u.pos.y = g;
      u.animate(u.vel.dot(fwd), u.vel.dot(lx) * -1, false);
      if (u.stepped()) { this.fx.dust(_c.set(u.pos.x, g, u.pos.z), 3, 1.5, 2.4, 0.25); if (dPlayer < 140) this.e.sfx.step(dPlayer, 0.7); }
    }
    if (tgt && dTgt < u.def.range && this.state === 'play') this.enemyFire(u, tpos, dt, tgt, dPlayer);
    u.update(dt);
    if (u.def.tank || u.def.hover) u.root.rotation.y = u.yaw;
  }

  enemyFire(u, tpos, dt, tgt, dPlayer) {
    const W = WEAPONS[u.def.weapon], fwd = u.forward(_a);
    if (tgt === 'player' && this.player.mode === 'foot' && dPlayer < 28 && !u.def.hover) return;
    const toT = _b.subVectors(tpos, u.pos).setY(0).normalize();
    if (fwd.dot(toT) < 0.8 && !u.def.hover) return;
    u.fireCd -= dt;
    const shoot = () => {
      let mz;
      if (u.def.rig) mz = (u.bonePos((u.side ^= 1) ? 'LowerArm_L_014' : 'LowerArm_R_017', _c) || _c.copy(u.pos).setY(u.pos.y + 4)).addScaledVector(fwd, 2.2);
      else mz = _c.copy(u.pos).setY(u.pos.y + u.height * (u.def.tank ? 0.75 : 0.62)).addScaledVector(fwd, u.radius * (u.def.tank ? 1.3 : 0.9));
      const tp = _e.copy(tpos);
      const flight = tp.distanceTo(mz) / W.speed;
      if (tgt === 'player') { const P = this.player; const v = P.mode === 'hawc' ? _f.set(P.vf * Math.sin(P.mech.yaw) + P.vs * -Math.cos(P.mech.yaw), 0, P.vf * Math.cos(P.mech.yaw) + P.vs * Math.sin(P.mech.yaw)) : P.footVel; tp.addScaledVector(v, flight * 0.6); }
      const sp = W.spread * (1 + tp.distanceTo(mz) / 160) * (this.player.mode === 'foot' && tgt === 'player' ? 3.6 : 1) / Math.sqrt(this.diff);
      const dir = _d.subVectors(tp, mz).normalize(); dir.x += (Math.random() - 0.5) * sp * 2; dir.y += (Math.random() - 0.5) * sp * 2; dir.z += (Math.random() - 0.5) * sp * 2; dir.normalize();
      this.fire({ owner: 'enemy', faction: 'darken', pos: mz, dir, speed: W.speed, dmg: W.dmg, color: W.color, w: W.w, len: W.len, life: u.def.range / W.speed * 1.5, splash: W.splash });
      this.fx.muzzle(mz, dir, W.splash ? 2 : 1);
      if (W.splash) this.e.sfx.cannon(dPlayer); else this.e.sfx.bolt(dPlayer);
    };
    if (u.burst > 0) { u.burstT -= dt; if (u.burstT <= 0) { shoot(); u.burst--; u.burstT = W.gap || 0.1; } }
    else if (u.fireCd <= 0) { u.burst = W.n; u.burstT = 0; u.fireCd = W.cd * (0.85 + this.R() * 0.5); }
    if (W.missiles) {
      u.mslCd -= dt;
      if (u.mslCd <= 0) {
        u.mslCd = W.missiles.cd;
        const target = tgt === 'player' ? (this.player.mode === 'hawc' ? this.player.mech : { center: (o) => o.copy(this.player.footPos).setY(this.player.footPos.y + 1), alive: true, foot: true }) : this.relay;
        for (let i = 0; i < W.missiles.n; i++) this.later(i * 0.15, () => {
          const sp = _c.copy(u.pos).setY(u.pos.y + u.height * 0.9).addScaledVector(u.forward(_e), 0.5); const dir = _d.copy(u.forward(_e)).add(UP).normalize();
          this.missile({ owner: 'enemy', faction: 'darken', pos: sp, dir, target, point: tpos.clone(), dmg: W.missiles.dmg, splash: 6, turn: 1.4 });
          this.e.sfx.missile(dPlayer);
        });
      }
    }
  }

  // ----- projectiles ---------------------------------------------------------
  fire(o) {
    const mesh = this.fx.bolt(o.color, o.len, o.w);
    const p = { ...o, pos: o.pos.clone(), vel: o.dir.clone().multiplyScalar(o.speed), mesh, prev: V() };
    mesh.position.copy(p.pos); mesh.lookAt(_g.copy(p.pos).add(p.vel));
    this.proj.push(p); return p;
  }
  missile(o) {
    const p = this.fire({ ...o, speed: 40, color: 0xffe0b0, w: 0.35, len: 1.6, life: 6, missile: true });
    p.turn = o.turn || 3.0; return p;
  }
  updateProjectiles(dt) {
    const P = this.player, H = this.H;
    for (let i = this.proj.length - 1; i >= 0; i--) {
      const p = this.proj[i];
      p.prev.copy(p.pos); p.life -= dt;
      if (p.missile) {
        const tgt = p.target && p.target.alive !== false ? (p.target.center ? p.target.center(_a) : _a.copy(p.target.pos).setY(p.target.pos.y + p.target.h * 0.5)) : p.point;
        const sp = Math.min(150, p.vel.length() + 140 * dt);
        const want = _b.subVectors(tgt, p.pos).normalize();
        const cur = _c.copy(p.vel).normalize();
        const ang = Math.acos(clamp(cur.dot(want), -1, 1)), maxA = p.turn * dt;
        if (ang > 1e-4) cur.lerp(want, Math.min(1, maxA / ang)).normalize();
        p.vel.copy(cur).multiplyScalar(sp);
        p.trailT = (p.trailT || 0) - dt; if (p.trailT <= 0) { p.trailT = 0.018; this.fx.trail(p.pos); }
      }
      if (p.grav) p.vel.y -= 3.71 * p.grav * dt;
      p.pos.addScaledVector(p.vel, dt);
      p.mesh.position.copy(p.pos); p.mesh.lookAt(_g.copy(p.pos).add(p.vel));
      let hit = null, hitKind = null;
      if (this.shield && p.faction !== 'darken') {
        const c = this.shield.c, r = this.shield.r;
        if (p.pos.distanceTo(c) < r && p.prev.distanceTo(c) >= r) { hitKind = 'shield'; }
      }
      if (!hitKind) for (const u of this.units) {
        if (!u.alive) continue;
        if (p.owner === 'player' && (u === P.mech && P.mode === 'hawc')) continue;
        if (p.owner === 'enemy' && u.faction === 'darken') continue;
        const tall = u.def.rig || u.def.gait;
        const r = tall ? Math.max(u.radius * 0.75, u.height * 0.2) : u.radius * 0.8;
        const ks = tall ? [0.3, 0.68] : [0.45];
        for (const kk of ks) { _d.set(u.pos.x, u.pos.y + u.height * kk, u.pos.z); if (segHitsSphere(p.prev, p.pos, _d, r) >= 0) { hit = u; hitKind = 'unit'; break; } }
        if (hit) break;
      }
      if (!hitKind && p.owner === 'enemy' && P.mode === 'foot') { _d.copy(P.footPos).setY(P.footPos.y + 1); if (segHitsSphere(p.prev, p.pos, _d, 0.8) >= 0) hitKind = 'pilot'; }
      if (!hitKind) for (const s of this.structs) {
        if (!s.alive) continue;
        if ((p.owner === 'player' && s.faction !== 'darken') || (p.owner === 'enemy' && s.faction !== 'union')) continue;
        const dx = p.pos.x - s.pos.x, dz = p.pos.z - s.pos.z;
        if (dx * dx + dz * dz < s.r * s.r && p.pos.y < s.pos.y + s.h && p.pos.y > s.pos.y - 1) { hit = s; hitKind = 'struct'; break; }
      }
      if (!hitKind && p.pos.y < H(p.pos.x, p.pos.z)) hitKind = 'ground';
      if (!hitKind && p.life > 0) continue;
      this.impact(p, hitKind, hit);
      this.fx.release(p.mesh); this.proj.splice(i, 1);
    }
  }
  impact(p, kind, target) {
    const at = p.pos, sfx = this.e.sfx, P = this.player;
    if (!kind) { if (p.missile) this.fx.explode(at, 0.4); return; }
    if (kind === 'shield') { this.fx.sparks(at, 10, 10, [1, 0.5, 0.25]); this.shield.mesh.material.uniforms.hit.value = 1; if (p.owner === 'player') { P.shieldMsgT = P.shieldMsgT || 0; if (this.time > P.shieldMsgT) { P.shieldMsgT = this.time + 8; this.msg('Shot absorbed by the IFF shield', 3); } } return; }
    if (p.gashr) {
      if (kind === 'unit' && target === p.target) { target.gashrT = 2.4; this.msg(`GASHR attached to the ${target.def.name}. Pilot ejecting…`, 4); sfx.lock(); }
      else this.msg('GASHR missed', 2);
      this.fx.sparks(at, 6, 6, [0.6, 0.8, 1]); return;
    }
    if (p.splash) { this.fx.explode(at, p.splash / 9); sfx.boom(p.splash / 9, at.distanceTo(this.camera.position)); this.splash(at, p.splash, p.dmg, p.owner); if (kind === 'unit' || kind === 'struct') this.damage(target, p.dmg * 0.4, p.owner, at); return; }
    if (kind === 'ground') { this.fx.dust(at, 2, 0.5, 1.4, 0.35); this.fx.sparks(at, 2, 6); return; }
    if (kind === 'pilot') { this.hurtPilot(p.dmg); this.fx.sparks(at, 4, 6); return; }
    this.fx.sparks(at, p.dmg > 10 ? 7 : 3, 10);
    this.damage(target, p.dmg, p.owner, at);
  }
  splash(at, r, dmg, owner) {
    const P = this.player;
    for (const u of this.units) {
      if (!u.alive) continue; if (owner === 'enemy' && u.faction === 'darken') continue; if (owner === 'player' && u === P.mech && P.mode === 'hawc') continue;
      const d = _a.copy(u.pos).setY(u.pos.y + u.height * 0.4).distanceTo(at); if (d < r + u.radius) this.damage(u, dmg * (1 - d / (r + u.radius)), owner, at);
    }
    if (owner === 'enemy' && P.mode === 'foot') { const d = P.footPos.distanceTo(at); if (d < r) this.hurtPilot(dmg * 0.9 * (1 - d / r)); }
    for (const s of this.structs) { if (!s.alive) continue; if ((owner === 'player') !== (s.faction === 'darken')) continue; const d = Math.hypot(at.x - s.pos.x, at.z - s.pos.z); if (d < r + s.r) this.damage(s, dmg * 0.7, owner, at); }
  }
  damage(t, dmg, owner, at) {
    if (!t || !t.alive || dmg <= 0) return;
    const P = this.player;
    if (t === P.mech && P.mode === 'hawc') {
      dmg *= this.diff; P.dmgT = Math.min(1, P.dmgT + 0.35 + dmg / 60); this.shake += Math.min(0.5, dmg / 60); this.e.sfx.hurt();
    } else if (owner === 'player') {
      this.stats.hits++; P.hitT = 0.1; this.e.sfx.hit(); if (t.aggro !== undefined) t.aggro = 10;
    }
    if (t.faction === 'neutral') return;
    if (t.kind) { if (t === this.relay && owner === 'enemy') { this.relayHitT = this.relayHitT || 0; if (this.time > this.relayHitT) { this.relayHitT = this.time + 12; this.msg('Relay taking fire', 3); } } }
    t.hp -= dmg;
    if (at && !t.kind && dmg > 4) this.fx.spall(at, dmg > 30 ? 2 : 1);
    if (t === P.mech && P.mode === 'hawc' && t.hp > 0) { const k = t.hp / t.maxHp; P.dmgStage = Math.min(P.dmgStage || 0, k > 0.7 ? 0 : k > 0.4 ? 1 : k > 0.15 ? 2 : 3); }
    if (t.hp <= 0) { t.hp = 0; if (t.kind) this.destroyStruct(t); else this.kill(t, owner); }
  }
  hurtPilot(d) {
    const P = this.player; P.hp -= d * 0.7 * this.diff; P.hurtT = 0; P.dmgT = Math.min(1, P.dmgT + 0.6); this.e.sfx.hurt(); this.shake += 0.2;
    if (P.hp <= 0) { P.hp = 0; this.end(false, 'Pilot down', 'You were killed on foot.'); }
  }
  kill(u, owner) {
    u.alive = false; u.piloted = false; this.deathSequence(u);
    if (owner === 'player' && u !== this.player.mech && Math.random() < 0.45) this.later(1.5, () => this.spawnCrate(u.pos.x + 4, u.pos.z + 3, 'loot'));
    if (owner === 'player' && u !== this.player.mech && u.faction !== 'player') this.onKill(u);
    const P = this.player;
    if (u.faction === 'darken' || owner === 'player') this.stats.kills += u.faction === 'darken' ? 1 : 0;
    if (u.def.rig) { u.oneShot('b2DeathFallDown1', 1, 0.15); u.deathT = 1.2; }
    else { u.deathT = 0.01; }
    if (u === P.mech && P.mode === 'hawc') {
      const right = _b.set(-Math.cos(u.yaw), 0, Math.sin(u.yaw));
      P.footPos.copy(u.pos).addScaledVector(right, 6); P.footPos.y = u.pos.y + 6; P.footVy = 5; P.footAir = true; P.footVel.copy(right).multiplyScalar(4);
      P.mode = 'foot'; this.pilotFig.root.visible = true; P.hp = Math.min(P.hp, 70); P.lockTarget = null; P.locked = false;
      this.msg(`${u.def.name} destroyed. Auto-eject. Find another HAWC.`, 7); this.e.sfx.alarm();
    }
    if (P.lockTarget === u) { P.lockTarget = null; P.locked = false; }
  }
  wreck(u) {
    const big = u.def.rig || u.def.gait ? 1.5 : 1.1;
    _c.copy(u.pos).setY(u.pos.y + u.height * 0.5);
    this.fx.explode(_c, big); this.e.sfx.boom(big, _c.distanceTo(this.camera.position)); this.shake += 0.4 * Math.max(0, 1 - _c.distanceTo(this.camera.position) / 200);
    darkenWreck(u.model); u.smokeT = 25;
    if (!u.def.rig) { u.root.rotation.z += (this.R() - 0.5) * 0.3; u.pos.y -= 0.4; }
  }
  destroyStruct(s) {
    s.alive = false; const c = _c.copy(s.pos).setY(s.pos.y + s.h * 0.5);
    this.fx.explode(c, 2.2); this.fx.explode(_d.copy(s.pos).setY(s.pos.y + s.h * 0.85), 1.4); this.e.sfx.boom(2, c.distanceTo(this.camera.position)); this.shake += 0.5;
    darkenWreck(s.obj); s.obj.rotation.z = 0.12; s.obj.position.y -= s.h * 0.25; s.smokeT = 60;
    if (s.obj.userData.light) s.obj.userData.light.intensity = 0;
    if (s.kind === 'meson') { const left = this.structs.filter((x) => x.kind === 'meson' && x.alive).length; this.msg(left ? `Meson tower down. ${left} to go.` : 'Last Meson tower down.', 5); }
  }
  updateStructs(dt) {
    for (const s of this.structs) {
      const u = s.obj.userData;
      if (!s.alive) { if (s.smokeT > 0) { s.smokeT -= dt; if (Math.random() < 0.4) this.fx.smoke(_c.copy(s.pos).setY(s.pos.y + s.h * 0.4), 1, 0.07, 5, 4); } continue; }
      if (u.av) { const b = Math.sin(this.time * 2.4) > 0.2; for (const a of u.av) a.visible = b; }
      if (s.kind === 'relay') { const on = Math.sin(this.time * 3) > 0.6; u.bulb.visible = on; u.light.intensity = on ? 220 : 0; if (s.hp / s.maxHp < 0.5 && Math.random() < 0.2) this.fx.smoke(_c.copy(s.pos).setY(s.pos.y + 6), 1, 0.12, 3, 2); }
      if (s.kind === 'meson') { u.top.rotation.y += dt * 1.2; for (const r of u.rings) r.rotation.z += dt * 0.8; u.light.intensity = 700 + Math.sin(this.time * 5) * 200; }
    }
    if (this.shield) {
      const live = this.structs.some((s) => s.kind === 'meson' && s.alive);
      const m = this.shield.mesh.material.uniforms; m.t.value = this.time; m.hit.value = Math.max(0, m.hit.value - dt * 2.5);
      if (!live && this.shield.mesh.visible) { this.shield.mesh.visible = false; this.shield = null; }
    }
  }
  updateRunners(dt) {
    for (let i = this.runners.length - 1; i >= 0; i--) {
      const r = this.runners[i]; r.t -= dt; const p = r.fig.root.position;
      p.addScaledVector(r.vel, dt); r.vy -= 3.71 * dt; p.y += r.vy * dt; const g = this.H(p.x, p.z); if (p.y < g) { p.y = g; r.vy = 0; }
      r.fig.root.rotation.y = Math.atan2(r.vel.x, r.vel.z); r.fig.animate(this.time, 4.5, p.y > g + 0.1);
      if (r.t <= 0) { this.scene.remove(r.fig.root); this.runners.splice(i, 1); }
    }
  }

  collide(pos, r, self) {
    for (const c of this.colliders) { if (c.ring) { this.ringCollide(c, pos, r); continue; } if (!c.r) continue; const dx = pos.x - c.x, dz = pos.z - c.z, d = Math.hypot(dx, dz), m = c.r + r; if (d < m && d > 0.001) { pos.x = c.x + dx / d * m; pos.z = c.z + dz / d * m; } }
    for (const u of this.units) {
      if (u === self) continue;
      if (!self && u.alive && !u.piloted && u.def.boardable) continue;
      const rr = (self ? u.radius : u.radius * 0.6) + r;
      const dx = pos.x - u.pos.x, dz = pos.z - u.pos.z, d = Math.hypot(dx, dz);
      if (d < rr && d > 0.001) { pos.x = u.pos.x + dx / d * rr; pos.z = u.pos.z + dz / d * rr; }
    }
    if (this.shield && self && self.faction !== 'darken' && !(self === this.player.mech && this.playerFaction() === 'darken')) {
      const dx = pos.x - this.shield.x, dz = pos.z - this.shield.z, d = Math.hypot(dx, dz), m = this.shield.r * 0.92 + r;
      if (d < m && d > 0.001) { pos.x = this.shield.x + dx / d * m; pos.z = this.shield.z + dz / d * m; if (self === this.player.mech) { this.player.shieldMsgT = this.player.shieldMsgT || 0; if (this.time > this.player.shieldMsgT) { this.player.shieldMsgT = this.time + 8; this.msg('The shield will not let a Union HAWC through', 3); } } }
    }
    const L = Math.hypot(pos.x, pos.z); if (L > WORLD.PLAY) { pos.x *= WORLD.PLAY / L; pos.z *= WORLD.PLAY / L; }
  }

  // ----- objectives ------------------------------------------------------------
  updateObjective(dt) {
    const L = this.L, P = this.player;
    if (['lander', 'capture', 'raid', 'escort', 'intercept', 'assault'].includes(this.goal)) return this.updateGoal(dt);
    if (L.type === 'defend') {
      if (!this.relay.alive) return this.end(false, 'Relay lost', 'The Darken patrol destroyed the relay tower.');
      const n = this.hostiles().length;
      if (this.waveActive && n === 0) {
        this.waveActive = false;
        if (this.wave >= L.waves.length) return this.end(true, 'Relay held', `All ${L.waves.length} waves repelled.`);
        this.waveT = 9; this.msg(`Wave ${this.wave} cleared. Next contact in a few seconds.`, 5);
        P.ammo = Math.min(24, P.ammo + 12);
      }
      if (!this.waveActive && this.wave < L.waves.length) {
        this.waveT -= dt;
        if (this.waveT <= 0) {
          this.spawnGroup(L.waves[this.wave], L.layout.spawnArc); this.wave++; this.waveActive = true; this.e.sfx.alarm();
          const az = (L.layout.spawnArc[0] + L.layout.spawnArc[1]) / 2;
          this.msg(`Wave ${this.wave} of ${L.waves.length}. Contacts bearing ${String(Math.round(az)).padStart(3, '0')}.`, 6);
        }
      }
    } else {
      const left = this.structs.filter((s) => s.kind === 'meson' && s.alive).length;
      if (left === 0) return this.end(true, L.type === 'hijack' ? 'Towers down' : 'Dust line broken', `All Meson towers destroyed${this.stats.stolen ? ' from a stolen HAWC' : ''}.`);
      if (L.type === 'hijack') {
        const talons = this.units.filter((u) => u.type === 'talon' && u.alive);
        if (!talons.length && !(P.mode === 'hawc' && P.mech.type === 'talon')) {
          this.respawnT = (this.respawnT ?? 14) - dt;
          if (this.respawnT <= 0) { this.respawnT = 14; const [x, z] = L.layout.guards[0][2]; const u = this.spawn('talon', x + 60, z - 40, { role: 'sentry', home: [x, z] }); u.yaw = 0; this.msg('Another Talon is walking out of the shield.', 5); }
        }
      }
      if (L.reinforce && this.reinfN < L.reinforce.max) {
        this.reinfT -= dt;
        if (this.reinfT <= 0) { this.reinfT = L.reinforce.every; this.reinfN++; this.spawnGroup(L.reinforce.group, [0, 360]); this.msg('Darken reinforcements inbound', 5); this.e.sfx.alarm(); }
      }
    }
  }
  objectiveView() {
    const L = this.L, P = this.player;
    const gv = this.goalView && this.goalView(); if (gv) return gv;
    if (L.type === 'defend') {
      const n = this.hostiles().length;
      return { title: 'Hold the relay', line: this.waveActive ? `Wave ${this.wave} of ${L.waves.length} · ${n} hostile${n === 1 ? '' : 's'}` : this.wave === 0 ? 'First wave inbound' : `Wave ${this.wave + 1} of ${L.waves.length} inbound`,
        steps: L.waves.map((_, i) => ({ text: `Wave ${i + 1}`, state: i < this.wave - (this.waveActive ? 1 : 0) ? 'done' : i === this.wave - (this.waveActive ? 1 : 0) ? 'active' : 'todo' })) };
    }
    const total = this.structs.filter((s) => s.kind === 'meson').length, left = this.structs.filter((s) => s.kind === 'meson' && s.alive).length;
    if (L.type === 'hijack') {
      const f = this.flags, inTalon = P.mode === 'hawc' && P.mech.type === 'talon';
      const st = [['Leave the Striker', f.exited], ['GASHR the Talon', f.gashr], ['Board the Talon', f.boarded], [`Destroy the Meson towers (${total - left}/${total})`, left === 0]];
      let act = false;
      return { title: 'Borrowed iron', line: inTalon ? (P.compromised ? 'IFF compromised' : 'Disguised as Darken') : `${left} tower${left === 1 ? '' : 's'} shielded`,
        steps: st.map(([text, done]) => { const s = done ? 'done' : act ? 'todo' : 'active'; if (!done) act = true; return { text, state: s }; }) };
    }
    return { title: 'Destroy the Meson towers', line: `${total - left} of ${total} destroyed · ${this.hostiles().length} hostiles`, steps: this.structs.filter((s) => s.kind === 'meson').map((s, i) => ({ text: `Tower ${i + 1}`, state: s.alive ? 'active' : 'done' })) };
  }
  end(won, title, reason) {
    if (this.state === 'end') return;
    this.state = 'end'; this.endT = 2.4; if (won) this.addPoints(1000, 'Objective complete');
    this.result = { won, title, reason, id: this.L.id, stats: { points: this.score || 0, time: fmtTime(this.time), kills: this.stats.kills, accuracy: this.stats.shots ? Math.round(this.stats.hits / this.stats.shots * 100) + '%' : '—', stolen: this.stats.stolen } };
    this.msg(won ? 'Mission complete' : 'Mission failed', 5);
  }

  // ----- camera & aim ----------------------------------------------------------
  updateCamera(dt) {
    const P = this.player, cam = this.camera, H = this.H;
    const dir = _d.set(Math.sin(P.yaw) * Math.cos(P.pitch), Math.sin(P.pitch), Math.cos(P.yaw) * Math.cos(P.pitch));
    const right = _b.set(-Math.cos(P.yaw), 0, Math.sin(P.yaw));
    const eye = _e;
    this.stepBob = Math.max(0, this.stepBob - dt * 1.8);
    let fov = 62;
    if (P.mode === 'hawc') {
      const m = P.mech;
      m.model.visible = this.view !== 'fp';
      if (this.view === 'fp') { m.forward(_a); eye.copy(m.pos).setY(m.pos.y + m.height * 0.86 - this.stepBob * 0.5).addScaledVector(_a, 0.9); fov = 70; }
      else {
        const tgt = _c.copy(m.pos).setY(m.pos.y + m.height * 0.9);
        eye.copy(tgt).addScaledVector(dir, -m.height * 1.5).addScaledVector(right, m.height * 0.52); eye.y += 0.5;
        fov = 62 + clamp(P.vf - 6.5, 0, 6) * 0.9;
      }
    } else {
      if (this.view === 'fp') { eye.copy(P.footPos).setY(P.footPos.y + 1.72 - this.stepBob); fov = 72; }
      else { const tgt = _c.copy(P.footPos).setY(P.footPos.y + 1.75); eye.copy(tgt).addScaledVector(dir, -3.7).addScaledVector(right, 1.05); eye.y += 0.22; fov = 62; }
    }
    if (this.state === 'intro' && P.mode === 'hawc') { const k = clamp(this.introT / 2.6, 0, 1) ** 2; eye.addScaledVector(dir, -40 * k); eye.y += 26 * k; }
    const gy = H(eye.x, eye.z) + (P.mode === 'hawc' ? 1.6 : 0.4); if (eye.y < gy) eye.y = gy;
    if (!this.camInit || this.view === 'fp') { this.camPos.copy(eye); this.camInit = true; }
    else this.camPos.lerp(eye, 1 - Math.exp(-14 * dt));
    if (P.mode === 'foot') { const hb = this.insideHab(P.footPos); if (hb) { const cp = this.camPos, dx = cp.x - hb.x, dz = cp.z - hb.z, d = Math.hypot(dx, dz), lim = hb.r - 0.8; if (d > lim) { cp.x = hb.x + dx / d * lim; cp.z = hb.z + dz / d * lim; } cp.y = Math.min(cp.y, H(hb.x, hb.z) + 3.3); } }
    cam.position.copy(this.camPos);
    if (this.shake > 0) { const s = Math.min(this.shake, 1) * 0.35; cam.position.x += (Math.random() - 0.5) * s; cam.position.y += (Math.random() - 0.5) * s; cam.position.z += (Math.random() - 0.5) * s; this.shake = Math.max(0, this.shake - dt * 2.2); }
    if (Math.abs(cam.fov - fov) > 0.05) { cam.fov = damp(cam.fov, fov, 6, dt); cam.updateProjectionMatrix(); this.fx.setScale(this.e.size.h, cam.fov); }
    cam.lookAt(_a.copy(cam.position).add(dir));
    this.camDir = dir.clone();
    this.cineCamera(cam, dt);
  }
  raycastAim() {
    const o = this.aimOrigin || this.camera.position, d = this.camDir, P = this.player;
    let best = 700, unit = null, struct = null;
    for (const u of this.units) {
      if (!u.alive || (u === P.mech && P.mode === 'hawc')) continue;
      const tall = u.def.rig || u.def.gait, r = tall ? Math.max(u.radius * 0.8, u.height * 0.22) : u.radius * 0.9;
      for (const kk of tall ? [0.3, 0.68] : [0.45]) {
        _a.set(u.pos.x, u.pos.y + u.height * kk, u.pos.z).sub(o); const t = _a.dot(d); if (t < 0) continue;
        const d2 = _a.lengthSq() - t * t; if (d2 < r * r) { const th = t - Math.sqrt(r * r - d2); if (th < best) { best = th; unit = u; struct = null; } }
      }
    }
    for (const s of this.structs) {
      if (!s.alive) continue;
      for (const kk of [0.15, 0.45, 0.75]) {
        _a.set(s.pos.x, s.pos.y + s.h * kk, s.pos.z).sub(o); const t = _a.dot(d); if (t < 0) continue;
        const d2 = _a.lengthSq() - t * t, r = s.r * 0.9; if (d2 < r * r) { const th = t - Math.sqrt(r * r - d2); if (th < best) { best = th; struct = s; unit = null; } }
      }
    }
    const H = this.H;
    for (let t = 3; t < best; t += 3) {
      const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
      if (y < H(x, z)) { let lo = t - 3, hi = t; for (let k = 0; k < 6; k++) { const m = (lo + hi) / 2; if (o.y + d.y * m < H(o.x + d.x * m, o.z + d.z * m)) hi = m; else lo = m; } best = hi; unit = null; struct = null; break; }
    }
    this.aim.point.copy(o).addScaledVector(d, best); this.aim.unit = unit; this.aim.struct = struct;
    const from = P.mode === 'hawc' ? P.mech.pos : P.footPos;
    this.aim.dist = this.aim.point.distanceTo(from);
  }

  // ----- HUD -----------------------------------------------------------------
  project(v, out) { _g.copy(v).project(this.camera); if (_g.z > 1) return null; out.x = (_g.x * 0.5 + 0.5) * this.e.size.w; out.y = (-_g.y * 0.5 + 0.5) * this.e.size.h; return out; }
  drawMarkers() {
    const mk = this.markers, P = this.player, cam = this.camera, from = this.focus(); mk.begin();
    if (this.state === 'end') { mk.end(); return; }
    const s1 = {}, s2 = {};
    const fwdC = this.camDir;
    const add = (top, bot, o) => {
      _a.subVectors(top, cam.position); if (_a.dot(fwdC) < 1) return;
      if (!this.project(top, s1) || !this.project(bot, s2)) return;
      const h = Math.max(22, s2.y - s1.y), w = Math.max(22, h * (o.wk || 0.75));
      mk.add({ x: (s1.x + s2.x) / 2, y: (s1.y + s2.y) / 2, w, h, ...o });
    };
    for (const u of this.units) {
      if (!u.alive || (u === P.mech && P.mode === 'hawc')) continue;
      const d = u.pos.distanceTo(from); if (d > 520) continue;
      const top = _c.copy(u.pos).setY(u.pos.y + u.height), bot = _e.copy(u.pos);
      if (u.piloted && u.faction === 'darken') {
        const locked = P.lockTarget === u && P.locked, locking = P.lockTarget === u && !P.locked;
        add(top, bot, { name: u.def.name, dist: Math.round(d) + ' m', hp: u.hp / u.maxHp, locked, tag: u.gashrT > 0 ? 'Ejecting' : locked ? 'Locked' : locking ? 'Locking' : '', wk: u.def.rig || u.def.gait ? 0.7 : 1.5 });
      } else if (!u.piloted && u.def.boardable) {
        add(top, bot, { name: u === P.lastMech && u.type === 'striker' ? 'Your Striker' : `Empty ${u.def.name}`, dist: Math.round(d) + ' m', color: 'var(--color-accent-300)', tag: d < 9.5 ? 'E · Board' : '', wk: 0.7 });
      }
    }
    for (const s of this.structs) {
      if (!s.alive) continue;
      const d = Math.hypot(s.pos.x - from.x, s.pos.z - from.z);
      const mid = _c.copy(s.pos).setY(s.pos.y + s.h * 0.62);
      _a.subVectors(mid, cam.position); if (_a.dot(fwdC) < 1 || !this.project(mid, s1)) continue;
      const locked = P.lockTarget === s && P.locked;
      mk.add({ x: s1.x, y: s1.y, w: 18, h: 18, name: s.name, dist: Math.round(d) + ' m', hp: s.hp / s.maxHp, color: s.faction === 'union' ? 'var(--color-accent-300)' : undefined, locked, tag: locked ? 'Locked' : '' });
    }
    mk.end();
  }
  drawRadar() {
    const c = this.e.dom.radar; if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = c.clientWidth, Hh = c.clientHeight;
    if (c.width !== W * dpr) { c.width = W * dpr; c.height = Hh * dpr; }
    const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, Hh);
    const paper = '#f2f2f3', acc = '#b5d9fd', acc4 = '#94bce3';
    const R = 260, sc = (W / 2) / R, cx = W / 2, cy = Hh / 2, P = this.player, from = this.focus(), yaw = P.yaw;
    g.strokeStyle = 'rgba(242,242,243,0.14)'; g.lineWidth = 1;
    for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(W * i / 4 + 0.5, 0); g.lineTo(W * i / 4 + 0.5, Hh); g.moveTo(0, Hh * i / 4 + 0.5); g.lineTo(W, Hh * i / 4 + 0.5); g.stroke(); }
    const half = (this.camera.fov * this.camera.aspect) / 2 * D2R * 0.5;
    g.fillStyle = 'rgba(181,217,253,0.08)'; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx - Math.tan(half) * cy * 1.4, -cy * 0.4); g.lineTo(cx + Math.tan(half) * cy * 1.4, -cy * 0.4); g.closePath(); g.fill();
    const sw = (this.time * 1.4) % (Math.PI * 2);
    g.strokeStyle = 'rgba(181,217,253,0.22)'; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.sin(sw) * W, cy - Math.cos(sw) * W); g.stroke();
    const toRadar = (x, z) => { const dx = x - from.x, dz = z - from.z; const fx = Math.sin(yaw), fz = Math.cos(yaw); const f = dx * fx + dz * fz, r = dx * -fz + dz * fx; return [cx - r * sc, cy - f * sc]; };
    const clampPt = ([x, y]) => [clamp(x, 4, W - 4), clamp(y, 4, Hh - 4)];
    for (const s of this.structs) {
      if (!s.alive) continue; const [x, y] = clampPt(toRadar(s.pos.x, s.pos.z));
      g.strokeStyle = s.faction === 'union' ? acc : paper; g.lineWidth = 1.5; g.strokeRect(x - 4.5, y - 4.5, 9, 9);
      if (s.faction === 'darken') { g.beginPath(); g.moveTo(x - 4.5, y - 4.5); g.lineTo(x + 4.5, y + 4.5); g.moveTo(x + 4.5, y - 4.5); g.lineTo(x - 4.5, y + 4.5); g.stroke(); }
    }
    if (this.shield) { const [x, y] = toRadar(this.shield.x, this.shield.z); g.strokeStyle = 'rgba(242,242,243,0.35)'; g.setLineDash([3, 3]); g.beginPath(); g.arc(x, y, this.shield.r * sc, 0, 7); g.stroke(); g.setLineDash([]); }
    for (const u of this.units) {
      if (!u.alive || (u === P.mech && P.mode === 'hawc')) continue;
      const p = toRadar(u.pos.x, u.pos.z); const out = p[0] < 0 || p[0] > W || p[1] < 0 || p[1] > Hh; const [x, y] = clampPt(p);
      const r = out ? 3 : 4.5;
      g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r, y); g.lineTo(x, y + r); g.lineTo(x - r, y); g.closePath();
      if (u.piloted && u.faction === 'darken') { g.fillStyle = paper; g.fill(); } else { g.strokeStyle = acc; g.lineWidth = 1.5; g.stroke(); }
    }
    g.fillStyle = acc4; g.beginPath(); g.moveTo(cx, cy - 6); g.lineTo(cx + 4.5, cy + 4.5); g.lineTo(cx, cy + 2); g.lineTo(cx - 4.5, cy + 4.5); g.closePath(); g.fill();
  }
  drawCompass() {
    const c = this.e.dom.compass; if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = c.clientWidth, Hh = c.clientHeight;
    if (c.width !== W * dpr) { c.width = W * dpr; c.height = Hh * dpr; }
    const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, Hh);
    const P = this.player, hd = ((-P.yaw / D2R) % 360 + 540) % 360; // 0 = north (−Z)
    const pxPerDeg = W / 120, cx = W / 2, from = this.focus();
    g.fillStyle = '#f2f2f3'; g.strokeStyle = 'rgba(242,242,243,0.6)'; g.lineWidth = 1; g.font = '600 11px "Barlow Condensed", sans-serif'; g.textAlign = 'center';
    for (let a = Math.floor((hd - 62) / 5) * 5; a <= hd + 62; a += 5) {
      const x = cx + (a - hd) * pxPerDeg, aa = ((a % 360) + 360) % 360;
      const major = aa % 30 === 0; g.globalAlpha = 1 - Math.abs(a - hd) / 66;
      g.beginPath(); g.moveTo(x + 0.5, Hh - (major ? 9 : 5)); g.lineTo(x + 0.5, Hh); g.stroke();
      if (major) g.fillText({ 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[aa] ?? String(aa).padStart(3, '0'), x, 11);
    }
    g.globalAlpha = 1;
    const bearing = (x, z) => { const b = Math.atan2(x - from.x, -(z - from.z)) / D2R; return ((b % 360) + 360) % 360; };
    const mark = (b, fill) => { let dd = ((b - hd + 540) % 360) - 180; if (Math.abs(dd) > 60) return; const x = cx + dd * pxPerDeg; g.beginPath(); g.moveTo(x, 14); g.lineTo(x + 3.5, 17.5); g.lineTo(x, 21); g.lineTo(x - 3.5, 17.5); g.closePath(); if (fill) { g.fillStyle = '#f2f2f3'; g.fill(); } else { g.strokeStyle = '#b5d9fd'; g.stroke(); } };
    for (const u of this.units) if (u.alive && u.piloted && u.faction === 'darken') mark(bearing(u.pos.x, u.pos.z), true);
    for (const s of this.structs) if (s.alive) mark(bearing(s.pos.x, s.pos.z), s.faction === 'darken');
    g.fillStyle = '#94bce3'; g.fillRect(cx - 0.75, 0, 1.5, Hh);
    this.heading = Math.round(hd) % 360;
  }
  hudState() {
    const P = this.player, m = P.mech, inH = P.mode === 'hawc';
    const sp = inH ? Math.hypot(P.vf, P.vs) * 3.6 : Math.hypot(P.footVel.x, P.footVel.z) * 3.6;
    const now = this.time;
    return {
      mode: P.mode, view: this.view, state: this.state, clock: this.world.clock(),
      unit: inH ? m.def.name : 'Pilot', unitCls: inH ? (m.type === 'talon' ? 'Stolen Darken sentry' : m.def.cls) : 'Union pilot, on foot',
      armor: inH ? m.hp / m.maxHp : P.hp / 100, armorTxt: inH ? `${Math.ceil(m.hp)} / ${m.maxHp}` : `${Math.ceil(P.hp)} / 100`,
      heat: P.heat / 100, shut: P.shutT > 0, fuel: P.fuel / 100, speed: Math.round(sp), heading: String(this.heading ?? 0).padStart(3, '0'),
      cell: P.cell ?? 1, cells: P.cells ?? 0, noPower: !!P.noPower, rounds: P.rounds ?? 0, score: this.score || 0, nv: !!this.nv, night: this.world.night, pts: (this.pointsFeed || []).filter((x) => now - x.t < 2.6).map((x) => ({ n: x.n, why: x.why, k: x.t })),
      ammo: P.ammo, mslReady: clamp(1 - P.mslCd / 3.4, 0, 1), lock: P.locked ? 'Locked' : P.lockTarget ? 'Locking' : '', lockName: P.lockTarget ? (P.lockTarget.def?.name || P.lockTarget.name) : '',
      gashr: P.gashr, prompt: P.prompt, objective: this.objectiveView(),
      ...this.barState(), jp: P.jpCap ? P.jp / P.jpCap : 1, mk: { ...this.mk }, support: { strike: this.support.strike - this.used.strike, drop: this.support.drop - this.used.drop }, salvo: MK.salvo[this.mk.msl - 1],
      msgs: this.msgs.filter((x) => now - x.t < x.life).map((x) => x.text),
      time: fmtTime(this.time), disguised: this.disguised(), aimDist: Math.round(this.aim.dist),
    };
  }
  resize(w, h) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.fx?.setScale(h, this.camera.fov); }
  dispose() {
    this.e.renderer.domElement.style.filter = ''; for (const t of this.envs || []) t.dispose(); this.scene.environment = null;
    this.markers.clear();
    this.world?.terrain.geometry.dispose();
    for (const p of this.proj) this.fx.release(p.mesh);
  }
}
installGoals(Mission);
installArmor(Mission);
