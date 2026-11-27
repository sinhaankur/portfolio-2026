import { THREE, clamp, damp, D2R, wrapAngle } from './lib.js?v=18';
import { loadTex } from './assets.js?v=18';
import { MISSIONS } from './levels.js?v=18';
import { buildCosmos } from './cosmos.js?v=18';

export const latLon = (lat, lon, r = 1, out = new THREE.Vector3()) => {
  const phi = (lon + 180) / 360 * Math.PI * 2, la = lat * D2R;
  return out.set(-Math.cos(phi) * Math.cos(la) * r, Math.sin(la) * r, Math.sin(phi) * Math.cos(la) * r);
};

const _cd = new THREE.Vector3(), _sd = new THREE.Vector3();
export class GlobeView {
  constructor(engine) {
    this.e = engine; this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0x030405);
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 1000);
    this.yaw = 2.3; this.pitch = 0.12; this.dist = 5.4; this.tYaw = this.yaw; this.tPitch = this.pitch; this.tDist = this.dist;
    this.mode = 'menu'; this.offset = 0.2; this.tOffset = 0.2; this.selected = null; this.completed = new Set(); this.idle = 0;
    this.els = []; this.loaded = null; this.sites = MISSIONS;
  }
  load() { return this.loaded || (this.loaded = this._load()); }
  async _load() {
    const [map, nrm] = await Promise.all([loadTex('tex/mars_globe.jpg'), loadTex('tex/globe_normal.png', { srgb: false })]);
    const g = this.group = new THREE.Group(); g.rotation.z = 25.19 * D2R * 0.6; this.scene.add(g);
    const planet = new THREE.Mesh(new THREE.SphereGeometry(1, 192, 96), new THREE.MeshStandardMaterial({ map, normalMap: nrm, normalScale: new THREE.Vector2(2.2, 2.2), roughness: 0.95, metalness: 0 }));
    g.add(planet);
    this.terrCanvas = document.createElement('canvas'); this.terrCanvas.width = 2048; this.terrCanvas.height = 1024;
    this.terrTex = new THREE.CanvasTexture(this.terrCanvas); this.terrTex.colorSpace = THREE.SRGBColorSpace; this.terrTex.anisotropy = 8;
    const terr = new THREE.Mesh(new THREE.SphereGeometry(1.0015, 128, 64), new THREE.MeshStandardMaterial({ map: this.terrTex, transparent: true, depthWrite: false, roughness: 1 }));
    g.add(terr); this.drawTerritory();
    const atm = new THREE.Mesh(new THREE.SphereGeometry(1.06, 96, 48), new THREE.ShaderMaterial({
      side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      uniforms: { sun: { value: new THREE.Vector3(-0.8, 0.25, 0.55).normalize() } },
      vertexShader: 'varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(mat3(modelMatrix) * normal); vW = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW,1.0); }',
      fragmentShader: `uniform vec3 sun; varying vec3 vN; varying vec3 vW;
        void main(){ vec3 v = normalize(cameraPosition - vW); float rim = pow(1.0 - abs(dot(-vN, v)), 3.0); float lit = smoothstep(-0.3, 0.6, dot(-vN, sun));
          float a = smoothstep(0.0, 0.5, rim) * (1.0 - smoothstep(0.55, 1.0, rim)) ;
          gl_FragColor = vec4(vec3(0.95, 0.62, 0.42) * a * lit * 0.9, 1.0); }`,
    }));
    this.scene.add(atm);
    const haze = new THREE.Mesh(new THREE.SphereGeometry(1.004, 96, 48), new THREE.ShaderMaterial({
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      uniforms: { sun: { value: new THREE.Vector3(-0.8, 0.25, 0.55).normalize() } },
      vertexShader: 'varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(mat3(modelMatrix) * normal); vW = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW,1.0); }',
      fragmentShader: `uniform vec3 sun; varying vec3 vN; varying vec3 vW;
        void main(){ vec3 v = normalize(cameraPosition - vW); float f = pow(1.0 - max(dot(vN, v), 0.0), 2.2); float lit = smoothstep(-0.15, 0.5, dot(vN, sun));
          gl_FragColor = vec4(vec3(0.9, 0.55, 0.36) * f * lit * 0.55, 1.0); }`,
    }));
    this.scene.add(haze);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.09));
    const sun = this.sun = new THREE.DirectionalLight(0xfff3e6, 3.4); this.scene.add(sun); this.sunUs = [atm.material.uniforms.sun, haze.material.uniforms.sun];
    g.updateMatrixWorld(true);
    const toLocal = new THREE.Matrix3().setFromMatrix4(g.matrixWorld).multiply(new THREE.Matrix3().set(...(() => { const x = latLon(0, 0), y = latLon(0, 90), z = latLon(90, 0); return [x.x, y.x, z.x, x.y, y.y, z.y, x.z, y.z, z.z]; })()));
    this.cosmos = await buildCosmos(this.scene, this.e.renderer, toLocal, this.e.dom.layer);
    { const s = this.cosmos.sunWorld; this.menuYaw = Math.atan2(s.x, s.z) + 0.85; this.yaw = this.tYaw = this.menuYaw; }
    await this.buildOrbit(g);
    this.buildMarkers();
  }
  async buildOrbit(g) {
    const [tP, tD] = await Promise.all([loadTex('tex/phobos.jpg'), loadTex('tex/deimos.jpg')]);
    const moon = (tex, r, sx, sy, sz) => { const geo = new THREE.IcosahedronGeometry(1, 5); const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = 1 + 0.06 * Math.sin(x * 7 + y * 3) * Math.cos(z * 5 - x * 2); p.setXYZ(i, x * sx * n, y * sy * n, z * sz * n); }
      geo.computeVertexNormals(); const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 1 })); m.scale.setScalar(r); return m; };
    // Orbit trails ride with the body: bright where it has just been, fading over `arc` radians to a faint guide line.
    const trail = (r, col, arc, peak, sym) => { const N = 320, pos = [], cl = [], c = new THREE.Color(col);
      for (let i = 0; i <= N; i++) { const a = i / N * Math.PI * 2, d = sym ? Math.min(a, Math.PI * 2 - a) : a, t = Math.max(0, 1 - d / arc);
        pos.push(Math.cos(a) * r, 0, Math.sin(a) * r); cl.push(c.r, c.g, c.b, 0.045 + peak * Math.pow(t, 2.2)); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(cl, 4));
      const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), grp = new THREE.Group();
      for (const [s, o] of [[1, 1], [1.0035, 0.45], [0.9965, 0.45]]) { const l = new THREE.Line(geo, o === 1 ? mat : Object.assign(mat.clone(), { opacity: o })); l.scale.setScalar(s); l.renderOrder = 2; grp.add(l); }
      return grp; };
    const ob = this.orbit = { bodies: [], t: 0 };
    const addBody = (obj, r, period, inc, phase, label, col = 0xe6d2b8) => { const pivot = new THREE.Group(); pivot.rotation.x = inc; g.add(pivot); obj.position.set(r, 0, 0); const arm = new THREE.Group();
      arm.add(period ? trail(r, col, label ? 2.2 : 1.4, label ? 0.85 : 0.6, false) : trail(r, col, 0.8, 0.32, true)); arm.add(obj); pivot.add(arm); const b = { arm, obj, period, phase, label }; ob.bodies.push(b); return b; };
    addBody(moon(tP, 0.034, 1, 0.8, 0.68), 1.62, 38, 0.02, 0.6, 'Phobos');
    addBody(moon(tD, 0.02, 1, 0.82, 0.74), 2.25, 150, 0.03, 2.4, 'Deimos');
    // Ares Ring: truss spine with solar wings and radiators, a spinning habitat ring on spokes, docked tanker and capsule
    const st = new THREE.Group(), MS = (o) => new THREE.MeshStandardMaterial(o);
    const mW = MS({ color: 0xdedbd4, roughness: 0.45, metalness: 0.35 }), mD = MS({ color: 0x2a2c30, metalness: 0.7, roughness: 0.4 }), mT = MS({ color: 0x9a9da2, metalness: 0.85, roughness: 0.35 });
    const mSol = MS({ color: 0x14244a, metalness: 0.5, roughness: 0.22, emissive: 0x0b1838, emissiveIntensity: 0.25 }), mGold = MS({ color: 0xc89a3a, metalness: 1, roughness: 0.3 }), mSt = MS({ color: 0xd2d4d6, metalness: 0.95, roughness: 0.2 });
    const mL = new THREE.MeshBasicMaterial({ color: 0xffe2b0, toneMapped: false }), mR = new THREE.MeshBasicMaterial({ color: 0xff3a2a, toneMapped: false }), mG = new THREE.MeshBasicMaterial({ color: 0x3aff6a, toneMapped: false });
    const B = (p, w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); p.add(o); return o; };
    const Cy = (p, r, h, m, x, y, z, rx = 0, rz = 0, seg = 12) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m); o.position.set(x, y, z); o.rotation.set(rx, 0, rz); p.add(o); return o; };
    const LEN = 0.26, T = 0.006;
    for (const [y, z] of [[T, T], [-T, T], [T, -T], [-T, -T]]) B(st, LEN, 0.0012, 0.0012, mT, 0, y, z);
    for (let i = 0; i <= 26; i++) { const x = -LEN / 2 + i * LEN / 26; B(st, 0.0008, T * 2, 0.0008, mT, x, 0, T); B(st, 0.0008, T * 2, 0.0008, mT, x, 0, -T); B(st, 0.0008, 0.0008, T * 2, mT, x, T, 0); B(st, 0.0008, 0.0008, T * 2, mT, x, -T, 0); }
    for (const sx of [-1, 1]) {
      const gim = new THREE.Group(); gim.position.x = sx * (LEN / 2 - 0.012); st.add(gim); Cy(gim, 0.004, 0.02, mD, 0, 0, 0, Math.PI / 2);
      for (const sz of [-1, 1]) { const wing = new THREE.Group(); wing.position.z = sz * 0.012; gim.add(wing);
        B(wing, 0.032, 0.0012, 0.1, mSol, 0, 0, sz * 0.05); for (let k = 0; k <= 8; k++) B(wing, 0.033, 0.0016, 0.0008, mGold, 0, 0, sz * k * 0.0125); B(wing, 0.0008, 0.0016, 0.1, mGold, 0, 0, sz * 0.05); }
      B(st, 0.0012, 0.05, 0.022, mW, sx * 0.07, 0.03, 0); B(st, 0.0012, 0.05, 0.022, mW, sx * 0.07, -0.03, 0);
      const nav = new THREE.Mesh(new THREE.SphereGeometry(0.0018, 6, 4), sx > 0 ? mG : mR); nav.position.set(sx * LEN / 2, 0.008, 0); st.add(nav);
    }
    const habR = new THREE.Group(); st.add(habR); habR.rotation.y = Math.PI / 2;
    const RR = 0.058, NM = 16;
    for (let i = 0; i < NM; i++) { const a0 = i / NM * Math.PI * 2; const mod = Cy(habR, 0.0075, 2 * Math.PI * RR / NM * 0.86, mW, Math.cos(a0) * RR, Math.sin(a0) * RR, 0, 0, a0, 14);
      const win = B(habR, 0.004, 0.0024, 0.0012, mL, Math.cos(a0) * (RR - 0.0002), Math.sin(a0) * (RR - 0.0002), 0.0075); win.rotation.z = a0;
      const jt = new THREE.Mesh(new THREE.TorusGeometry(0.0078, 0.0012, 6, 14), mD); jt.position.set(Math.cos(a0 + Math.PI / NM) * RR, Math.sin(a0 + Math.PI / NM) * RR, 0); jt.rotation.y = Math.PI / 2; jt.rotation.x = a0 + Math.PI / NM; habR.add(jt); }
    for (let i = 0; i < 4; i++) { const a0 = i / 4 * Math.PI * 2 + 0.2; const sp = Cy(habR, 0.0018, RR, mT, Math.cos(a0) * RR / 2, Math.sin(a0) * RR / 2, 0, 0, a0 - Math.PI / 2, 6); }
    Cy(habR, 0.011, 0.03, mD, 0, 0, 0, Math.PI / 2, 0, 16); Cy(habR, 0.013, 0.006, mGold, 0, 0, 0.012, Math.PI / 2, 0, 16);
    const hold = new THREE.Group(); hold.position.set(0.035, -0.016, 0); st.add(hold); for (let i = 0; i < 6; i++) B(hold, 0.012, 0.012, 0.012, i % 2 ? mW : mGold, (i % 3) * 0.013, -Math.floor(i / 3) * 0.013, 0);
    const ship = new THREE.Group(); ship.position.set(-0.04, 0, 0.018); ship.rotation.x = Math.PI / 2; st.add(ship);
    Cy(ship, 0.0045, 0.04, mSt, 0, 0.026, 0, 0, 0, 16); const nose = new THREE.Mesh(new THREE.ConeGeometry(0.0045, 0.012, 16), mSt); nose.position.y = 0.052; ship.add(nose); B(ship, 0.012, 0.006, 0.0012, mD, 0, 0.012, 0);
    const cap = Cy(st, 0.0045, 0.008, mW, 0.0, 0, -0.022, Math.PI / 2, 0, 14); const capN = new THREE.Mesh(new THREE.ConeGeometry(0.0045, 0.005, 14), mD); capN.position.set(0, 0, -0.029); capN.rotation.x = -Math.PI / 2; st.add(capN);
    this.ringBlink = [st.children.filter((o) => o.material === mR || o.material === mG)];
    st.rotation.y = Math.PI / 2; this.ringStation = habR; st.scale.setScalar(1.15);
    addBody(st, 1.95, 0, 0, 1.1, 'Ares Ring', 0xb9d3f0);
    // Agency orbiters on inclined orbits
    const sat = (col) => { const s = new THREE.Group(); s.add(new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.016), new THREE.MeshStandardMaterial({ color: col, metalness: 0.6, roughness: 0.4 }))); const p = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.001, 0.012), new THREE.MeshStandardMaterial({ color: 0x1d2c55, metalness: 0.8, roughness: 0.25 })); s.add(p); return s; };
    for (const [r, per, inc, ph, col] of [[1.12, 14, 1.45, 0.2, 0xc89a3a], [1.18, 17, 1.32, 2.1, 0xd9d6cf], [1.25, 21, 1.1, 4.0, 0xc89a3a], [1.3, 24, 0.78, 1.3, 0xe58a2c], [1.38, 29, 0.42, 3.3, 0x00843d], [1.44, 33, 1.62, 5.1, 0xc8332b]]) addBody(sat(col), r, per, inc, ph, null, col);
    const layer = this.e.dom.layer;
    for (const b of ob.bodies) if (b.label) { const el = document.createElement('span'); el.textContent = b.label; el.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;font-family:var(--font-heading);font-weight:600;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:color-mix(in srgb, #f2f2f3 70%, transparent);white-space:nowrap;will-change:transform'; layer.appendChild(el); b.el = el; }
  }
  drawTerritory() {
    const c = this.terrCanvas, g = c.getContext('2d'), W = c.width, H = c.height;
    g.clearRect(0, 0, W, H);
    for (const m of this.sites) {
      const x = (m.lon + 180) / 360 * W, y = (90 - m.lat) / 180 * H, r = (m.color ? 6 : 9) / 180 * H, rx = r / Math.max(0.3, Math.cos(m.lat * D2R));
      const union = m.color ? m.mine : this.completed.has(m.id);
      if (m.color) { g.save(); g.beginPath(); g.ellipse(x, y, rx, r, 0, 0, Math.PI * 2); g.fillStyle = m.color + (m.mine ? '88' : '55'); g.fill(); g.strokeStyle = m.color; g.lineWidth = m.mine ? 3 : 2; g.setLineDash(m.mine ? [] : [8, 6]); g.stroke(); g.restore(); continue; }
      g.save(); g.beginPath(); g.ellipse(x, y, rx, r, 0, 0, Math.PI * 2); g.clip();
      if (union) { g.fillStyle = 'rgba(89,128,166,0.42)'; g.fillRect(x - rx, y - r, rx * 2, r * 2); }
      else { g.strokeStyle = 'rgba(242,242,243,0.32)'; g.lineWidth = 2; for (let k = -2 * r; k < 2 * rx; k += 9) { g.beginPath(); g.moveTo(x - rx + k, y - r); g.lineTo(x - rx + k + 2 * r, y + r); g.stroke(); } }
      g.restore();
      g.strokeStyle = union ? 'rgba(181,217,253,0.95)' : 'rgba(242,242,243,0.8)'; g.lineWidth = 2.5; g.setLineDash(union ? [] : [10, 7]);
      g.beginPath(); g.ellipse(x, y, rx, r, 0, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
    }
    if (this.terrTex) this.terrTex.needsUpdate = true;
  }
  setSites(list) { this.sites = list && list.length ? list : MISSIONS; if (this.group) { this.buildMarkers(); if (this.terrCanvas) this.drawTerritory(); if (this.mode) this.setMode(this.mode); } }
  setCompleted(ids) { this.completed = new Set(ids); if (this.terrCanvas) this.drawTerritory(); this.styleMarkers(); }
  buildMarkers() {
    const layer = this.e.dom.layer;
    for (const k of this.els || []) k.el.remove();
    this.els = this.sites.map((m) => {
      const el = document.createElement('button');
      el.style.cssText = 'position:absolute;left:0;top:0;display:flex;align-items:center;gap:8px;padding:0;border:0;background:none;cursor:pointer;pointer-events:auto;font-family:var(--font-heading);font-weight:600;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--color-bg);text-shadow:0 1px 3px rgba(0,0,0,.8);white-space:nowrap;will-change:transform';
      const d = document.createElement('span'); d.style.cssText = 'width:11px;height:11px;transform:rotate(45deg);border:1.5px solid currentColor;flex:none';
      const t = document.createElement('span'); t.textContent = m.label || `${m.n} ${m.site}`;
      el.append(d, t); el.onclick = (ev) => { ev.stopPropagation(); this.e.emit('site', m.id); };
      el.onpointerdown = (ev) => ev.stopPropagation();
      layer.appendChild(el); return { el, d, m, v: latLon(m.lat, m.lon, 1.0) };
    });
    this.styleMarkers();
  }
  styleMarkers() {
    for (const k of this.els) {
      const sel = k.m.id === this.selected, done = this.completed.has(k.m.id);
      if (k.m.color) { k.d.style.background = sel ? '#f2f2f3' : k.m.mine ? k.m.color : 'transparent'; k.d.style.borderColor = k.m.color; k.el.style.color = sel ? '#f2f2f3' : k.m.urgent ? '#ffb38a' : k.m.op ? '#f2f2f3' : 'color-mix(in srgb, #f2f2f3 62%, transparent)'; k.el.style.fontSize = k.m.op || sel ? '13px' : '11px'; continue; }
      k.d.style.background = sel ? 'var(--color-bg)' : done ? 'var(--color-accent-400)' : 'transparent';
      k.el.style.color = done && !sel ? 'var(--color-accent-300)' : 'var(--color-bg)';
    }
  }
  setMode(mode) { this.mode = mode; this.camK = 3; this.limb = false; this.idle = 0; if (mode === 'menu' && this.menuYaw != null) { this.tYaw = this.yaw + wrapAngle(this.menuYaw - this.yaw); this.tPitch = 0.12; } this.tOffset = mode === 'menu' ? 0.2 : 0; this.tDist = mode === 'menu' ? 5.4 : 4.2; for (const k of this.els) k.el.style.visibility = 'visible'; for (const b of this.orbit?.bodies || []) if (b.el) b.el.style.visibility = mode === 'menu' ? 'visible' : 'hidden'; this.styleMarkers(); }
  focus(id) {
    this.selected = id; this.styleMarkers();
    const m = this.sites.find((x) => x.id === id); if (!m || !this.group) return;
    const v = latLon(m.lat, m.lon).applyEuler(this.group.rotation);
    this.tYaw = this.yaw + wrapAngle(Math.atan2(v.x, v.z) - this.yaw); this.tPitch = clamp(Math.asin(v.y), -0.9, 0.9); this.idle = 0;
  }
  hideMarkers() { this.cosmos?.hide(); for (const k of this.els) k.el.style.visibility = 'hidden'; for (const b of this.orbit?.bodies || []) if (b.el) b.el.style.visibility = 'hidden'; }
  drag(dx, dy) { this.camK = 3; this.limb = false; this.tYaw -= dx * 0.005; this.tPitch = clamp(this.tPitch + dy * 0.004, -1.2, 1.2); this.idle = 0; }
  zoom(d) { this.tDist = clamp(this.tDist * (1 + d * 0.001), 2.2, 7); }
  resize(w, h) { this.camera.aspect = w / h; this.w = w; this.h = h; this.applyOffset(); }
  applyOffset() { if (!this.w) return; if (Math.abs(this.offset) < 1e-3) this.camera.clearViewOffset(); else this.camera.setViewOffset(this.w, this.h, -this.w * this.offset, 0, this.w, this.h); this.camera.updateProjectionMatrix(); }
  update(dt) {
    if (!this.group) return;
    this.idle += dt;
    // Attract mode: left alone on the menu, the camera drifts round to the night side so the real Sun breaks over the limb, then returns.
    if (this.mode === 'menu' && this.cosmos && this.menuYaw != null) { const cyc = this.idle > 14 ? (this.idle - 14) % 32 : -1, limb = cyc >= 0 && cyc < 14;
      if (limb !== !!this.limb) { this.limb = limb; this.camK = 0.55; const sw = this.cosmos.sunWorld;
        if (limb) { this.tYaw = this.yaw + wrapAngle(Math.atan2(-sw.x, -sw.z) + 0.14 - this.yaw); this.tPitch = clamp(Math.asin(-sw.y) + 0.34, -1.1, 1.1); }
        else { this.tYaw = this.yaw + wrapAngle(this.menuYaw - this.yaw); this.tPitch = 0.12; } } }
    if (this.mode === 'menu' || this.idle > 8) this.group.rotateY(dt * 0.05); // Mars turns under a fixed sky and Sun
    const k = this.camK ?? 3; this.yaw = damp(this.yaw, this.tYaw, k, dt); this.pitch = damp(this.pitch, this.tPitch, k, dt); this.dist = damp(this.dist, this.tDist, 3, dt);
    const o = this.offset; this.offset = damp(this.offset, this.tOffset, 4, dt); if (Math.abs(o - this.offset) > 1e-4) this.applyOffset();
    const c = this.camera; c.position.set(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch)).multiplyScalar(this.dist); c.lookAt(0, 0, 0);
    c.updateMatrixWorld();
    { const cd = _cd.copy(c.position).normalize(), a = 1.05; const sd = _sd.set(cd.x * Math.cos(a) + cd.z * Math.sin(a), 0.3, -cd.x * Math.sin(a) + cd.z * Math.cos(a)).normalize();
      if (this.cosmos) sd.copy(this.cosmos.sunWorld); this.sun.position.copy(sd).multiplyScalar(10); for (const u of this.sunUs) u.value.copy(sd); this.cosmos?.update(c, this.w, this.h, true); }
    const v = new THREE.Vector3(), camDir = c.position.clone().normalize();
    if (this.orbit) {
      const ob = this.orbit; ob.t += dt; if (this.ringStation) this.ringStation.rotation.z += dt * 0.35;
      for (const b of ob.bodies) {
        b.arm.rotation.y = b.period ? b.phase + ob.t * Math.PI * 2 / b.period : b.phase - this.yaw * 0 ; b.obj.rotation.y += dt * 0.2;
        if (!b.el) continue;
        b.obj.getWorldPosition(v); const toP = v.clone().sub(c.position), L = toP.length(); toP.divideScalar(L);
        const tca = -c.position.dot(toP), d2 = c.position.lengthSq() - tca * tca, hidden = d2 < 1 && tca > 0 && tca < L;
        if (b.rad == null) { b.obj.updateMatrixWorld(true); b.rad = new THREE.Box3().setFromObject(b.obj).getBoundingSphere(new THREE.Sphere()).radius; }
        const pxR = b.rad / (L * Math.tan(c.fov * D2R / 2)) * this.h / 2;
        v.project(c); const x = (v.x * 0.5 + 0.5) * this.w, y = (-v.y * 0.5 + 0.5) * this.h;
        b.el.style.transform = `translate(${(x + pxR + 10) | 0}px,${(y - 6) | 0}px)`; b.el.style.opacity = hidden || v.z > 1 ? '0' : '1';
      }
    }
    for (const k of this.els) {
      v.copy(k.v).applyEuler(this.group.rotation);
      const facing = v.dot(camDir);
      v.project(c);
      const x = (v.x * 0.5 + 0.5) * this.w, y = (-v.y * 0.5 + 0.5) * this.h;
      k.el.style.transform = `translate(${(x - 6) | 0}px,${(y - 9) | 0}px)`;
      k.el.style.opacity = facing > 0.15 ? '1' : facing > 0 ? String(facing / 0.15) : '0';
      k.el.style.pointerEvents = facing > 0.1 ? 'auto' : 'none';
    }
  }
}
