import { THREE, clamp, damp } from './lib.js?v=19';
import { instantiate } from './assets.js?v=19';
import { unitTemplate, loadPilot, makePilot } from './units.js?v=19';
import { UNITS } from './levels.js?v=19';
import { sectionEdges, ghostMaterial, attachClaw, SEC_COLOR } from './rig.js?v=19';
import { ANATOMY, kit } from './anatomy.js?v=19';

function gridTex() {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  g.clearRect(0, 0, 512, 512);
  g.strokeStyle = 'rgba(29,31,32,0.09)'; g.lineWidth = 1;
  for (let i = 0; i <= 512; i += 51.2) { g.beginPath(); g.moveTo(i + 0.5, 0); g.lineTo(i + 0.5, 512); g.moveTo(0, i + 0.5); g.lineTo(512, i + 0.5); g.stroke(); }
  g.strokeStyle = 'rgba(29,31,32,0.2)'; g.beginPath(); g.moveTo(0.5, 0); g.lineTo(0.5, 512); g.moveTo(0, 0.5); g.lineTo(512, 0.5); g.stroke();
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(16, 16); t.anisotropy = 8; return t;
}

export class HangarView {
  constructor(engine) {
    this.e = engine; this.scene = new THREE.Scene(); this.scene.background = new THREE.Color('#f2f2f3');
    this.scene.fog = new THREE.Fog('#f2f2f3', 26, 70);
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 300);
    this.spin = 0.6; this.tSpin = 0.6; this.auto = true; this.unit = null; this.loaded = false; this.token = 0; this.offset = 0.14;
  }
  load() {
    if (this.loaded) return; this.loaded = true;
    const s = this.scene;
    const hemi = new THREE.HemisphereLight(0xffffff, 0xcfcfd2, 1.6); s.add(hemi);
    import('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/environments/RoomEnvironment.js/+esm').then(({ RoomEnvironment }) => {
      const pm = new THREE.PMREMGenerator(this.e.renderer); this.env = pm.fromScene(new RoomEnvironment(this.e.renderer), 0.04).texture; pm.dispose();
      s.environment = this.env; hemi.intensity = 0.7; }).catch(() => {});
    const key = new THREE.DirectionalLight(0xffffff, 2.6); key.position.set(6, 12, 8); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -10, right: 10, top: 14, bottom: -4, near: 1, far: 40 }); key.shadow.bias = -0.0005; key.shadow.normalBias = 0.4;
    s.add(key); this.key = key;
    const rim = new THREE.DirectionalLight(0xb5d9fd, 1.6); rim.position.set(-6, 6, -9); s.add(rim);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshBasicMaterial({ map: gridTex(), transparent: true, depthWrite: false }));
    floor.rotation.x = -Math.PI / 2; s.add(floor);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.16 })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.005; shadow.receiveShadow = true; s.add(shadow);
    const acc = new THREE.MeshBasicMaterial({ color: 0x5980a6 }), ink = new THREE.MeshBasicMaterial({ color: 0x1d1f20, transparent: true, opacity: 0.55 });
    const ring = new THREE.Mesh(new THREE.RingGeometry(5.0, 5.04, 128), acc); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.01; s.add(ring);
    this.ticks = new THREE.Group(); s.add(this.ticks);
    for (let i = 0; i < 72; i++) { const a = i / 72 * Math.PI * 2, L = i % 6 ? 0.18 : 0.45; const m = new THREE.Mesh(new THREE.PlaneGeometry(0.025, L), i % 6 ? ink : acc); m.rotation.x = -Math.PI / 2; m.rotation.z = -a; m.position.set(Math.sin(a) * (5.1 + L / 2), 0.012, Math.cos(a) * (5.1 + L / 2)); this.ticks.add(m); }
    for (const [x, z] of [[-6.5, -6.5], [6.5, -6.5], [-6.5, 6.5], [6.5, 6.5]]) for (const r of [0, Math.PI / 2]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.9), ink); m.rotation.x = -Math.PI / 2; m.rotation.z = r; m.position.set(x, 0.012, z); s.add(m); }
    this.holder = new THREE.Group(); s.add(this.holder);
  }
  async show(type, livery) {
    const tk = ++this.token;
    const tpl = await unitTemplate(type);
    if (tk !== this.token) return;
    if (this.unit) this.holder.remove(this.unit.obj);
    this.clearTear();
    const obj = instantiate(tpl, type === 'striker' ? livery : UNITS[type].livery);
    obj.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(obj);
    this.holder.add(obj);
    const u = { obj, type, size: tpl.size, bb };
    if (tpl.skinned) { u.mixer = new THREE.AnimationMixer(obj); u.actions = {}; for (const c of tpl.animations) u.actions[c.name] = u.mixer.clipAction(c); }
    this.unit = u; this.playing = null; this.claw = null;
    this.play('a4IdlePose');
    if (u.mixer && type === 'striker') { u.mixer.update(0.6); this.holder.updateMatrixWorld(true); this.claw = attachClaw(obj, this.holder, tpl); this.claw?.group.traverse((o) => { o.userData.claw = true; }); }
    this.setFrame(tpl.size);
    this.e.emit('hangar', { clips: !!tpl.skinned });
  }
  setFrame(S) {
    const big = Math.max(S.x, S.z) > 12, h = Math.max(S.y, Math.max(S.x, S.z) * (big ? 0.8 : 0.55)); this.frame = { h, target: S.y * 0.5, dist: h * (big ? 3.1 : 2.6) + Math.min(6, h * 0.8), zoom: big ? 0.1 : 0.3 };
    const R = Math.max(10, h * 1.3), sc = this.key.shadow.camera; Object.assign(sc, { left: -R, right: R, top: R * 1.4, bottom: -R * 0.4, far: R * 6 }); sc.updateProjectionMatrix(); this.key.position.set(6, 12, 8).multiplyScalar(R / 10);
    this.scene.fog.near = this.frame.dist * 1.1; this.scene.fog.far = this.frame.dist * 3.4;
  }
  async showAsset(id) {
    const A = ANATOMY[id]; if (!A?.build) return; const tk = ++this.token; const obj = await A.build(); if (tk !== this.token) return;
    if (this.unit) this.holder.remove(this.unit.obj); this.clearTear();
    obj.traverse((o) => { if (o.isLight) o.intensity = 0; if (o.isMesh) o.castShadow = true; });
    obj.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(obj), c = bb.getCenter(new THREE.Vector3());
    obj.position.x -= c.x; obj.position.z -= c.z; bb.translate(new THREE.Vector3(-c.x, 0, -c.z));
    this.holder.add(obj); this.unit = { obj, type: id, size: bb.getSize(new THREE.Vector3()), bb, asset: true }; this.playing = null; this.claw = null;
    this.setFrame(this.unit.size); this.e.emit('hangar', { clips: false });
  }
  // Anatomy for anything that isn't the rigged Striker hull: x-ray shell with edge lines, solid systems, internals for imported hulls, numbered callouts.
  async tearGeneric(on) {
    const u = this.unit, A = ANATOMY[u.type]; this.clearTear();
    u.obj.traverse((o) => { if (!o.isMesh) return; if (o.userData.mat0) { o.material = o.userData.mat0; o.castShadow = true; delete o.userData.mat0; } for (const c of [...o.children]) if (c.userData.edge) { o.remove(c); c.geometry.dispose(); } });
    if (!on || !A) return; this.tear = true;
    this.auto = false; this.autoT = 0; this.tSpin = Math.round(this.tSpin / (Math.PI * 2)) * Math.PI * 2 + 0.25;
    const bb = u.bb, S = bb.getSize(new THREE.Vector3()), off = u.obj.position.clone();
    const B = { S, bb, L: (x, y, z) => new THREE.Vector3(x, y, z).add(off), f: (fx, fy, fz) => new THREE.Vector3(bb.min.x + S.x * fx, bb.min.y + S.y * fy, bb.min.z + S.z * fz) };
    if (A.ghost !== false) {
      const sol = A.solid ? A.solid(B) : null, fn = typeof sol === 'function' ? sol : null, boxes = Array.isArray(sol) ? sol : [];
      const ghost = this.ghost || (this.ghost = ghostMaterial()), ink = this.ink || (this.ink = new THREE.LineBasicMaterial({ color: 0x3d5f82, transparent: true, opacity: 0.5, depthWrite: false }));
      const c = new THREE.Vector3(); this.holder.updateMatrixWorld(true); const inv = this.holder.matrixWorld.clone().invert();
      u.obj.traverse((o) => { if (!o.isMesh || o.userData.claw) return; if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); o.geometry.boundingBox.getCenter(c).applyMatrix4(o.matrixWorld).applyMatrix4(inv);
        if ((fn && fn(o, c.clone().sub(off))) || boxes.some(([p, h]) => Math.abs(c.x - p.x) <= h[0] && Math.abs(c.y - p.y) <= h[1] && Math.abs(c.z - p.z) <= h[2])) return;
        o.userData.mat0 = o.material; o.material = ghost; o.castShadow = false;
        if (!o.isInstancedMesh && !o.isSkinnedMesh) { const e = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 28), ink); e.userData.edge = true; e.raycast = () => {}; e.renderOrder = 2; o.add(e); } });
    }
    const g = new THREE.Group(); this.inner = g; this.holder.add(g); if (A.inner) A.inner(B, kit(g));
    this.callouts = A.parts(B).map(([t, sub, p]) => [p, t, sub]); this.chipAt = [];
    this.tearHull = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => new THREE.Vector3(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z));
    const layer = this.e.dom.layer, NS = 'http://www.w3.org/2000/svg'; this.tearSvg = document.createElementNS(NS, 'svg'); this.tearSvg.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible'); layer.appendChild(this.tearSvg);
    this.tearLines = this.callouts.map(() => { const p = document.createElementNS(NS, 'polyline'); p.setAttribute('fill', 'none'); p.setAttribute('stroke', 'rgba(29,31,32,.7)'); p.setAttribute('stroke-width', '1'); this.tearSvg.appendChild(p); return p; });
    for (const [, t, sub] of this.callouts) { const el = document.createElement('div'); el.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;font-family:var(--font-body);color:#1d1f20'; el.innerHTML = '<span style="display:flex;flex-direction:column;gap:1px;background:rgba(242,242,243,.9);padding:3px 8px 4px"><b style="font-family:var(--font-heading);font-weight:600;font-size:13px;letter-spacing:.1em;text-transform:uppercase;white-space:nowrap">' + t + '</b><span style="font-size:12px;color:#424244;white-space:nowrap;line-height:1.3">' + sub + '</span></span>'; layer.appendChild(el); this.labels.push(el); }
  }
  setLivery(type, livery) { this.show(type, livery); }
  clearTear() { this.tear = false; for (const el of [...(this.labels || []), ...(this.chips || [])]) el.remove(); this.labels = []; this.chips = []; this.tearSvg?.remove(); this.tearSvg = null; this.tearDots = null; if (this.inner) { this.holder.remove(this.inner); this.inner.traverse((o) => o.geometry?.dispose?.()); this.inner = null; } }
  // Teardown: hull becomes an x-ray shell with section-coloured plate lines; drive, power and weapon systems sit inside at their real joints.
  async setTeardown(on) {
    const u = this.unit; if (!u) return; if (!/^(striker|talon)$/.test(u.type)) return this.tearGeneric(on);
    this.clearTear();
    if (on && u.mixer) { if (this.playing !== 'a4IdlePose') this.play('a4IdlePose'); u.mixer.update(0.6); this.backT = 0; }
    u.obj.traverse((o) => { if (!o.isMesh || o.userData.claw) return; if (on) { o.userData.mat0 = o.userData.mat0 || o.material; o.material = this.ghost || (this.ghost = ghostMaterial()); o.castShadow = false; } else if (o.userData.mat0) { o.material = o.userData.mat0; o.castShadow = true; } });
    this.tear = on; if (!on) return;
    this.auto = false; this.autoT = 0; this.tSpin = Math.round(this.tSpin / (Math.PI * 2)) * Math.PI * 2 + 0.25;
    const E = sectionEdges(u.obj, this.holder), g = new THREE.Group(); this.inner = g; this.holder.add(g); g.add(E.lines);
    const keys = Object.keys(E.boxes), B = (re) => E.boxes[keys.find((n) => re.test(n))] || null;
    const O = {}; u.obj.traverse((o) => { if (o.isBone) O[o.name] = this.holder.worldToLocal(o.getWorldPosition(new THREE.Vector3())); });
    const P = (re) => { const k = Object.keys(O).find((n) => re.test(n)); return k ? O[k].clone() : null; };
    const all = E.all, H = all.max.y - all.min.y, W = all.max.x - all.min.x, D = all.max.z - all.min.z, k = H / 7;
    const ctr = (b) => b.getCenter(new THREE.Vector3()), sz = (b) => b.getSize(new THREE.Vector3());
    const std = (c, m, r, o = {}) => new THREE.MeshStandardMaterial({ color: c, metalness: m, roughness: r, ...o });
    const mG = std(0x2b2d31, 0.6, 0.45), mGd = std(0x34373c, 0.6, 0.5, { side: THREE.DoubleSide }), mS = std(0x9aa1a8, 1, 0.3), mCu = std(0xb87333, 1, 0.38), mCe = std(0xdcd5c4, 0, 0.82), mHV = std(0xd8742a, 0.1, 0.55), mCl = std(0x313a35, 0.5, 0.42), mCool = std(0x5d7f98, 0.4, 0.4), mWh = std(0xe4e1da, 0.1, 0.6);
    const lit = (c) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
    const add = (p, geo, mat, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); p.add(o); return o; };
    const Y = new THREE.Vector3(0, 1, 0), M4 = new THREE.Matrix4();
    const along = (o, a, b) => { const d = b.clone().sub(a); o.position.copy(a).addScaledVector(d, 0.5); o.quaternion.setFromUnitVectors(Y, d.normalize()); return o; };
    const rod = (a, b, r, mat) => along(add(g, new THREE.CylinderGeometry(r, r, a.distanceTo(b), 14), mat), a, b);
    const cable = (pts, r, mat) => add(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 28, r, 7), mat);
    const motor = (p, r, len) => { const m = new THREE.Group(); m.position.copy(p); m.rotation.z = Math.PI / 2; g.add(m);
      add(m, new THREE.CylinderGeometry(r, r, len, 36, 1, true, 0.9, Math.PI * 2 - 1.8), mGd);
      add(m, new THREE.CylinderGeometry(r * 0.84, r * 0.84, len * 0.7, 36), mCu);
      for (let i = 0; i < 5; i++) { const t = add(m, new THREE.TorusGeometry(r * 0.85, r * 0.035, 5, 36), mG, 0, -len * 0.3 + i * len * 0.15, 0); t.rotation.x = Math.PI / 2; }
      add(m, new THREE.CylinderGeometry(r * 0.42, r * 0.42, len * 1.12, 24), mS);
      for (const s of [-1, 1]) { const f = add(m, new THREE.TorusGeometry(r, r * 0.09, 8, 40), mS, 0, s * len / 2, 0); f.rotation.x = Math.PI / 2;
        const bo = new THREE.InstancedMesh(new THREE.CylinderGeometry(r * 0.05, r * 0.05, r * 0.14, 6), mG, 12); for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; M4.makeTranslation(Math.cos(a) * r * 0.74, s * (len / 2 + r * 0.05), Math.sin(a) * r * 0.74); bo.setMatrixAt(i, M4); } m.add(bo); }
      const band = add(m, new THREE.TorusGeometry(r * 1.03, r * 0.028, 6, 48), lit(0xffb066), 0, len * 0.16, 0); band.rotation.x = Math.PI / 2;
      return m; };
    const tb = B(/^UpperTorso/), lb = B(/^LowerTorso/), tc = ctr(tb), ts = sz(tb);
    // Power: cell bay, SOFC, radiator
    const cb = new THREE.Vector3(tc.x, tb.min.y + ts.y * 0.5, tb.min.z + ts.z * 0.3), cl = Math.min(0.95 * k, ts.x * 0.34), cr = 0.13 * k;
    for (let i = 0; i < 4; i++) { const y = cb.y + (i % 2 ? 0.17 : -0.17) * k, z = cb.z + (i < 2 ? 0.16 : -0.16) * k; const c = add(g, new THREE.CylinderGeometry(cr, cr, cl, 22), mCl, cb.x, y, z); c.rotation.z = Math.PI / 2;
      for (const s of [-1, 1]) { const e = add(g, new THREE.CylinderGeometry(cr * 1.04, cr * 1.04, 0.05 * k, 22), mS, cb.x + s * cl / 2, y, z); e.rotation.z = Math.PI / 2; }
      const band = add(g, new THREE.CylinderGeometry(cr * 1.02, cr * 1.02, 0.06 * k, 22), lit(0x7dffa0), cb.x - cl * 0.28, y, z); band.rotation.z = Math.PI / 2; }
    for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(g, new THREE.BoxGeometry(0.04 * k, 0.04 * k, 0.72 * k), mG, cb.x + x * cl * 0.52, cb.y + y * 0.34 * k, cb.z);
    add(g, new THREE.BoxGeometry(cl * 1.08, 0.03 * k, 0.08 * k), mCu, cb.x, cb.y + 0.37 * k, cb.z + 0.3 * k);
    const so = new THREE.Vector3(tc.x + ts.x * 0.24, tb.min.y + ts.y * 0.3, tb.min.z + ts.z * 0.36);
    for (let i = 0; i < 18; i++) add(g, new THREE.BoxGeometry(0.5 * k, 0.022 * k, 0.5 * k), i % 2 ? mS : mCe, so.x, so.y + i * 0.032 * k, so.z);
    for (const s of [-1, 1]) add(g, new THREE.CylinderGeometry(0.035 * k, 0.035 * k, 0.62 * k, 10), mS, so.x + s * 0.28 * k, so.y + 0.28 * k, so.z + 0.2 * k);
    add(g, new THREE.BoxGeometry(0.54 * k, 0.06 * k, 0.54 * k), mG, so.x, so.y + 0.6 * k, so.z);
    const rz = tb.min.z + ts.z * 0.05; for (let i = 0; i < 9; i++) add(g, new THREE.BoxGeometry(0.018 * k, ts.y * 0.42, 0.3 * k), mS, tc.x - ts.x * 0.2 + i * ts.x * 0.05, tb.min.y + ts.y * 0.48, rz);
    cable([so.clone().add(new THREE.Vector3(0, 0.6 * k, 0)), new THREE.Vector3(so.x, tb.min.y + ts.y * 0.78, rz + 0.25 * k), new THREE.Vector3(tc.x, tb.min.y + ts.y * 0.72, rz + 0.08 * k)], 0.045 * k, mCool);
    cable([so.clone(), new THREE.Vector3(so.x - 0.1 * k, tb.min.y + ts.y * 0.2, rz + 0.3 * k), new THREE.Vector3(tc.x, tb.min.y + ts.y * 0.26, rz + 0.08 * k)], 0.045 * k, mCool);
    // Waist slew ring and gyro
    const waist = P(/^UpperTorso/), ls = lb ? sz(lb) : ts, lc = lb ? ctr(lb) : tc, rr = Math.min(ls.x, ls.z) * 0.36;
    const ring = add(g, new THREE.TorusGeometry(rr, rr * 0.09, 10, 64), mS, waist.x, waist.y, waist.z); ring.rotation.x = Math.PI / 2;
    const teeth = new THREE.InstancedMesh(new THREE.BoxGeometry(rr * 0.07, rr * 0.12, rr * 0.06), mG, 48); for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2; M4.makeRotationY(-a).setPosition(waist.x + Math.cos(a) * rr * 0.86, waist.y, waist.z + Math.sin(a) * rr * 0.86); teeth.setMatrixAt(i, M4); } g.add(teeth);
    const slew = motor(new THREE.Vector3(waist.x + rr * 0.6, waist.y + rr * 0.25, waist.z - rr * 0.55), rr * 0.18, rr * 0.3); slew.rotation.set(0, 0, 0);
    const gy = new THREE.Vector3(lc.x, lc.y - ls.y * 0.05, lc.z), gr = Math.min(ls.x, ls.y, ls.z) * 0.24;
    add(g, new THREE.SphereGeometry(gr, 28, 20), mS, gy.x, gy.y, gy.z);
    for (const [rx, ry] of [[Math.PI / 2, 0], [0, Math.PI / 2]]) { const t = add(g, new THREE.TorusGeometry(gr * 1.22, gr * 0.06, 8, 48), mG, gy.x, gy.y, gy.z); t.rotation.set(rx, ry, 0); }
    const gb = add(g, new THREE.TorusGeometry(gr * 1.01, gr * 0.03, 6, 48), lit(0xb5d9fd), gy.x, gy.y, gy.z); gb.rotation.x = Math.PI / 2;
    // Legs: hip, knee, ankle motors; hydraulic knee rams; HV feed from the cell bay
    const hv = (to) => cable([new THREE.Vector3(cb.x, cb.y - 0.3 * k, cb.z + 0.2 * k), new THREE.Vector3((cb.x + to.x) / 2, (cb.y + to.y) / 2, cb.z + 0.45 * k), to], 0.03 * k, mHV);
    let ramMid = null, hipP = null, ankP = null;
    for (const s of ['L', 'R']) {
      const hip = P(new RegExp('^UpperLeg_' + s)), knee = P(new RegExp('^LowerLeg_' + s + '_')), ank = P(new RegExp('^Foot_' + s)), ub = B(new RegExp('^UpperLeg_' + s)), sb = B(new RegExp('^LowerLeg_' + s + '_'));
      if (!hip || !knee || !ank || !ub || !sb) continue;
      const us = sz(ub), r = Math.min(Math.max(Math.min(us.x, us.z) * 0.27, 0.18 * k), 0.5 * k), len = Math.min(Math.max(us.x * 0.55, 0.3 * k), 1.0 * k);
      motor(hip, r, len); motor(knee, r * 0.82, len * 0.9); motor(ank, r * 0.6, len * 0.7);
      const A = hip.clone().lerp(knee, 0.24); A.z = ub.max.z - us.z * 0.16; const Bp = knee.clone().lerp(ank, 0.26); Bp.z = sb.max.z - sz(sb).z * 0.2;
      const mid = A.clone().lerp(Bp, 0.58); rod(A, mid, r * 0.3, mG); rod(mid.clone().lerp(A, 0.06), Bp, r * 0.15, mS);
      for (const q of [A, Bp]) add(g, new THREE.SphereGeometry(r * 0.24, 14, 10), mS, q.x, q.y, q.z);
      cable([mid.clone().lerp(A, 0.85), A.clone().add(new THREE.Vector3(0, r * 0.4, -r * 0.6)), hip.clone().add(new THREE.Vector3(0, -r * 0.4, r * 0.5))], 0.02 * k, std(0x1d1f20, 0.2, 0.7));
      hv(hip.clone().add(new THREE.Vector3(0, r * 0.9, 0)));
      if (s === 'L') { ramMid = mid; hipP = hip; ankP = ank; }
    }
    // Arms: shoulder and elbow motors
    let armP = null;
    for (const s of ['L', 'R']) {
      const sh = P(new RegExp('^UpperArm_' + s)), el = P(new RegExp('^LowerArm_' + s)), ab = B(new RegExp('^UpperArm_' + s)) || B(new RegExp('^LowerArm_' + s));
      if (!sh || !el || !ab) continue; const as = sz(ab), r = Math.min(Math.max(Math.min(as.y, as.z) * 0.26, 0.16 * k), 0.42 * k);
      motor(sh, r, r * 1.6); motor(el, r * 0.8, r * 1.3); hv(sh.clone().add(new THREE.Vector3(0, -r * 0.8, 0)));
      if (s === 'R') armP = sh;
    }
    // Weapons: missile pods, autocannon breech, barrel and belt
    const pz = (all.min.z + all.max.z) / 2 - D * 0.05, pods = [];
    for (const s of [-1, 1]) { const pc = new THREE.Vector3(s * W * 0.3, all.min.y + H * 0.82, pz); pods.push(pc);
      for (let i = 0; i < 6; i++) { const x = pc.x + ((i % 3) - 1) * 0.2 * k, y = pc.y + (i < 3 ? 0.1 : -0.1) * k; const t = add(g, new THREE.CylinderGeometry(0.085 * k, 0.085 * k, 0.9 * k, 14, 1, true), mGd, x, y, pc.z); t.rotation.x = Math.PI / 2;
        const ms = add(g, new THREE.CylinderGeometry(0.06 * k, 0.06 * k, 0.7 * k, 12), mWh, x, y, pc.z - 0.05 * k); ms.rotation.x = Math.PI / 2;
        const nose = add(g, new THREE.ConeGeometry(0.06 * k, 0.16 * k, 12), mG, x, y, pc.z + 0.38 * k); nose.rotation.x = Math.PI / 2; }
      add(g, new THREE.BoxGeometry(0.66 * k, 0.04 * k, 0.9 * k), mG, pc.x, pc.y - 0.22 * k, pc.z); }
    const fb = B(/^LowerArm_R/); let gunP = null;
    if (fb) { const fc = ctr(fb), fs = sz(fb); gunP = new THREE.Vector3(fc.x, fc.y, fb.max.z - fs.z * 0.2);
      add(g, new THREE.BoxGeometry(fs.x * 0.38, fs.y * 0.34, fs.z * 0.3), mG, fc.x, fc.y, fc.z);
      const bl = add(g, new THREE.CylinderGeometry(0.07 * k, 0.07 * k, fs.z * 0.62, 16), mS, fc.x, fc.y, fc.z + fs.z * 0.38); bl.rotation.x = Math.PI / 2;
      const mb = add(g, new THREE.CylinderGeometry(0.1 * k, 0.1 * k, 0.22 * k, 12), mG, fc.x, fc.y, fb.max.z + 0.02 * k); mb.rotation.x = Math.PI / 2;
      const belt = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1 * k, 0.05 * k, 0.04 * k), mCu, 16); for (let i = 0; i < 16; i++) { const t = i / 15, a = t * Math.PI; M4.makeRotationX(a).setPosition(fc.x + fs.x * 0.22, fc.y - fs.y * 0.1 + Math.sin(a) * fs.y * 0.22, fc.z - fs.z * 0.32 + t * fs.z * 0.3); belt.setMatrixAt(i, M4); } g.add(belt);
      add(g, new THREE.BoxGeometry(fs.x * 0.3, fs.y * 0.3, fs.z * 0.22), mCl, fc.x + fs.x * 0.22, fc.y - fs.y * 0.2, fc.z - fs.z * 0.38); }
    // Cockpit: seat, consoles, seated pilot
    const ck = new THREE.Vector3(tc.x, tb.min.y + ts.y * 0.62, tb.max.z - ts.z * 0.27);
    add(g, new THREE.BoxGeometry(0.6, 0.1, 0.56), mG, ck.x, ck.y - 0.34, ck.z); const back = add(g, new THREE.BoxGeometry(0.6, 0.95, 0.1), mG, ck.x, ck.y + 0.12, ck.z - 0.3); back.rotation.x = -0.16;
    for (const s of [-1, 1]) { rod(new THREE.Vector3(ck.x + s * 0.24, ck.y - 0.5, ck.z - 0.36), new THREE.Vector3(ck.x + s * 0.24, ck.y + 0.75, ck.z - 0.42), 0.025, mS);
      add(g, new THREE.BoxGeometry(0.3, 0.2, 0.03), lit(s < 0 ? 0x8fe3a8 : 0x94bce3), ck.x + s * 0.3, ck.y + 0.16, ck.z + 0.58).rotation.x = -0.35;
      add(g, new THREE.CylinderGeometry(0.03, 0.03, 0.32, 8), mG, ck.x + s * 0.3, ck.y - 0.12, ck.z + 0.3); }
    add(g, new THREE.BoxGeometry(0.16, 0.06, 0.48), lit(0xe0b53a), ck.x, ck.y - 0.42, ck.z - 0.04);
    try { await loadPilot(); if (!this.tear || this.inner !== g) return; const p = makePilot(undefined, undefined, { armed: false }), b = p.bones; p.root.rotation.y = Math.PI;
      for (const [n, rx, rz] of [['LeftUpLeg', -1.5, 0.06], ['RightUpLeg', -1.5, -0.06], ['LeftLeg', 1.55, 0], ['RightLeg', 1.55, 0], ['LeftArm', 0.55, 1.2], ['RightArm', 0.55, -1.2], ['LeftForeArm', 0, 0.9], ['RightForeArm', 0, -0.9], ['Spine', 0.08, 0], ['Head', -0.12, 0]]) if (b[n]) { b[n].rotation.x += rx; b[n].rotation.z += rz; }
      g.add(p.root); p.root.updateMatrixWorld(true);
      if (b.Hips) { const hp = g.worldToLocal(b.Hips.getWorldPosition(new THREE.Vector3())); p.root.position.add(new THREE.Vector3(ck.x, ck.y - 0.22, ck.z - 0.08).sub(hp)); }
      p.root.traverse((o) => { if (!o.isMesh) return; o.castShadow = o.receiveShadow = false; const m = o.material; if (m && m.emissive && !/visor/i.test(m.name || '')) m.emissive.copy(m.color).multiplyScalar(0.25); });
      this.tearPilot = p; } catch (e) { console.warn('teardown pilot', e); }
    const clawP = this.claw ? this.holder.worldToLocal(this.claw.group.getWorldPosition(new THREE.Vector3())) : null;
    this.tearHull = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => new THREE.Vector3(i & 1 ? all.max.x : all.min.x, i & 2 ? all.max.y : all.min.y, i & 4 ? all.max.z : all.min.z));
    this.callouts = [
      [pods[0], 'Missile pods', '2 × 6 tubes, salvos of 4 to 8'],
      [ck.clone().add(new THREE.Vector3(0, 0.5, 0.3)), 'Cockpit', 'Rail ejection seat. E blows the canopy'],
      [cb, 'Cell bay', '4 methalox cells, 10 s per swap'],
      [so.clone().add(new THREE.Vector3(0, 0.3 * k, 0)), 'SOFC stack', 'Methane + oxygen at 750 °C, 400 kW'],
      [waist.clone().add(new THREE.Vector3(rr, 0, 0)), 'Waist slew ring', 'Torso turns 110° each way'],
      [gy, 'Control-moment gyro', 'Holds the hull upright under recoil'],
      hipP && [hipP, 'Joint motors', 'Axial-flux, at every joint. Orange = HV feed'],
      ramMid && [ramMid, 'Knee rams', 'Hydraulic. First to fail when a leg is hit'],
      gunP && [gunP, 'P2MEC autocannon', 'Belt-fed from the forearm magazine'],
      clawP && [clawP, 'Manipulator', '3 fingers, 2 t grip. G grabs and drops'],
    ].filter(Boolean);
    const lb2 = B(/^LowerArm_L/), sh2 = B(/^LowerLeg_L_/);
    this.chipAt = [[ck.clone().add(new THREE.Vector3(0, 0.95, 0.4)), 'cockpit', 'Cockpit · 80 mm'], [new THREE.Vector3(tc.x - ts.x * 0.26, tb.min.y + ts.y * 0.3, tb.max.z), 'torso', 'Torso · 60 mm'], lb2 && [ctr(lb2).setY(lb2.max.y), 'arms', 'Arms · 35 mm'], sh2 && [ctr(sh2).setZ(sh2.max.z), 'legs', 'Legs · 45 mm']].filter(Boolean);
    const layer = this.e.dom.layer, NS = 'http://www.w3.org/2000/svg'; this.tearSvg = document.createElementNS(NS, 'svg'); this.tearSvg.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible'); layer.appendChild(this.tearSvg);
    this.tearLines = this.callouts.map(() => { const p = document.createElementNS(NS, 'polyline'); p.setAttribute('fill', 'none'); p.setAttribute('stroke', 'rgba(29,31,32,.7)'); p.setAttribute('stroke-width', '1'); this.tearSvg.appendChild(p); return p; });
    for (const [, t, sub] of this.callouts) { const el = document.createElement('div'); el.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;font-family:var(--font-body);color:#1d1f20'; el.innerHTML = '<span style="display:flex;flex-direction:column;gap:1px;background:rgba(242,242,243,.9);padding:3px 8px 4px"><b style="font-family:var(--font-heading);font-weight:600;font-size:13px;letter-spacing:.1em;text-transform:uppercase;white-space:nowrap">' + t + '</b><span style="font-size:12px;color:#424244;white-space:nowrap;line-height:1.3">' + sub + '</span></span>'; layer.appendChild(el); this.labels.push(el); }
    for (const [, s, t] of this.chipAt) { const el = document.createElement('div'); const c = '#' + SEC_COLOR[s].toString(16).padStart(6, '0'); el.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;display:flex;align-items:center;gap:6px;padding:3px 8px;background:' + c + ';color:#f2f2f3;font-family:var(--font-heading);font-weight:600;font-size:12px;letter-spacing:.1em;text-transform:uppercase;white-space:nowrap'; el.textContent = t; layer.appendChild(el); this.chips.push(el); }
  }
  play(name) {
    const u = this.unit; if (!u?.actions) return; const a = u.actions[name]; if (!a) return;
    const loop = /Idle|Walk|Run|JumpJetFlying|Turning/.test(name);
    a.reset(); a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); a.clampWhenFinished = !loop; a.enabled = true;
    if (u.cur && u.cur !== a) a.crossFadeFrom(u.cur, 0.3, false);
    a.play(); u.cur = a; this.playing = name; this.backT = loop ? 0 : a.getClip().duration + (/Death/.test(name) ? 1.6 : 0.4);
  }
  drag(dx) { this.tSpin += dx * 0.008; this.auto = false; this.autoT = 4; }
  zoom() {}
  resize(w, h) { this.camera.aspect = w / h; this.w = w; this.h = h; this.offNow = null; this.camera.setViewOffset(w, h, w < 760 ? 0 : -w * this.offset, w < 760 ? -h * 0.12 : 0, w, h); this.camera.updateProjectionMatrix(); }
  update(dt) {
    if (!this.unit) return;
    this.tt = (this.tt || 0) + dt; this.unit.obj.userData.update?.(this.tt);
    if (this.autoT > 0) { this.autoT -= dt; if (this.autoT <= 0) this.auto = true; }
    if (this.auto) this.tSpin += dt * 0.25;
    this.spin = damp(this.spin, this.tSpin, 5, dt);
    this.holder.rotation.y = this.spin; this.ticks.rotation.y = this.spin;
    const u = this.unit;
    if (this.claw) this.claw.update(dt);
    if (u.mixer && !this.tear) { u.mixer.update(dt); if (this.backT > 0) { this.backT -= dt; if (this.backT <= 0) this.play('a4IdlePose'); } }
    const f = this.frame, c = this.camera;
    this.tk = damp(this.tk || 0, this.tear ? 1 : 0, 2.4, dt); const k = 1 - (f.zoom ?? 0.3) * this.tk, off = this.offset - 0.075 * this.tk; if (this.w && Math.abs(off - (this.offNow ?? -1)) > 0.0005) { this.offNow = off; c.setViewOffset(this.w, this.h, this.w < 760 ? 0 : -this.w * off, this.w < 760 ? -this.h * 0.12 : 0, this.w, this.h); c.updateProjectionMatrix(); } const ty = f.target * 0.92 + f.h * 0.2 * this.tk;
    c.position.set(f.dist * 0.82 * k, f.target + f.h * (0.42 - 0.08 * this.tk), f.dist * 0.95 * k); c.lookAt(0, ty, 0);
    if (this.tear && this.callouts && this.labels?.length) {
      this.holder.updateMatrixWorld(true); c.updateMatrixWorld(); const v = new THREE.Vector3();
      const proj = (p) => { v.copy(p).applyMatrix4(this.holder.matrixWorld).project(c); return [(v.x * 0.5 + 0.5) * this.w, (-v.y * 0.5 + 0.5) * this.h]; };
      let rx = 0; for (const p of this.tearHull) rx = Math.max(rx, proj(p)[0]);
      const pts = this.callouts.map(([p], i) => { const [x, y] = proj(p); return { i, x, y }; }).sort((a, b) => a.y - b.y);
      const hs = pts.map((q) => (this.labels[q.i].offsetHeight || 36) + 3), top = 60, bot = this.h - 14, ys = [];
      for (let j = 0; j < pts.length; j++) ys[j] = Math.max(pts[j].y - 10, j ? ys[j - 1] + hs[j - 1] : top);
      let over = ys[ys.length - 1] + hs[hs.length - 1] - bot;
      for (let j = ys.length - 1; j >= 0 && over > 0; j--) { ys[j] -= over; over = j ? ys[j - 1] + hs[j - 1] - ys[j] : 0; }
      if (ys[0] < top) { ys[0] = top; for (let j = 1; j < ys.length; j++) ys[j] = Math.max(ys[j], ys[j - 1] + hs[j - 1]); }
      const lw = Math.max(...this.labels.map((el) => el.offsetWidth || 230)), lx = Math.max(Math.min(rx + 26, this.w - lw - 12), this.w * 0.5);
      const spX = Math.min(rx + 12, lx - 24);
      for (const [j, q] of pts.entries()) { const el = this.labels[q.i], ly = ys[j] | 0; el.style.transform = `translate(${lx | 0}px,${ly}px)`;
        this.tearLines[q.i].setAttribute('points', `${q.x | 0},${q.y | 0} ${spX | 0},${q.y | 0} ${(lx - 14) | 0},${ly + 10} ${(lx - 2) | 0},${ly + 10}`); }
      if (!this.tearDots) this.tearDots = [];
      for (const q of pts) { let d = this.tearDots[q.i]; if (!d || !d.isConnected) { d = this.tearDots[q.i] = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); d.setAttribute('r', '3.5'); d.setAttribute('fill', '#f2f2f3'); d.setAttribute('stroke', '#1d1f20'); d.setAttribute('stroke-width', '1.5'); this.tearSvg.appendChild(d); } d.setAttribute('cx', q.x | 0); d.setAttribute('cy', q.y | 0); }
      for (const [j, [p]] of this.chipAt.entries()) { const [x, y] = proj(p), el = this.chips[j]; el.style.transform = `translate(${(x - (el.offsetWidth || 90) / 2) | 0}px,${(y - 10) | 0}px)`; }
    }
  }
}
