import { THREE } from './lib.js?v=19';

function softTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); return t;
}

class Particles {
  constructor(scene, N, additive, tex) {
    this.N = N; this.n = 0;
    this.pos = new Float32Array(N * 3); this.size = new Float32Array(N); this.col = new Float32Array(N * 4);
    this.vel = new Float32Array(N * 3); this.life = new Float32Array(N); this.max = new Float32Array(N);
    this.s0 = new Float32Array(N); this.s1 = new Float32Array(N); this.a0 = new Float32Array(N); this.drag = new Float32Array(N); this.grav = new Float32Array(N);
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos); g.setAttribute('aSize', this.aSize); g.setAttribute('aColor', this.aCol);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    this.uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTex: { value: tex }, uScale: { value: 600 } }]);
    const m = new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false, fog: !additive,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: `attribute float aSize; attribute vec4 aColor; varying vec4 vColor; uniform float uScale;
        #include <fog_pars_vertex>
        void main(){ vColor = aColor; vec4 mvPosition = modelViewMatrix * vec4(position,1.0); gl_PointSize = aSize * uScale / max(-mvPosition.z, 0.5); gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
        }`,
      fragmentShader: `uniform sampler2D uTex; varying vec4 vColor;
        #include <fog_pars_fragment>
        void main(){ float a = texture2D(uTex, gl_PointCoord).a * vColor.a; if (a < 0.004) discard; gl_FragColor = vec4(vColor.rgb, a);
        #include <fog_fragment>
        #include <colorspace_fragment>
        }`,
    });
    this.points = new THREE.Points(g, m); this.points.frustumCulled = false; this.points.renderOrder = additive ? 3 : 2;
    this.base = new Float32Array(N * 3);
    scene.add(this.points);
  }
  emit(x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a, drag = 0.5, grav = 0) {
    if (this.n >= this.N) return;
    const i = this.n++;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = 0; this.max[i] = life; this.s0[i] = s0; this.s1[i] = s1; this.a0[i] = a; this.drag[i] = drag; this.grav[i] = grav;
    this.base[i * 3] = r; this.base[i * 3 + 1] = g; this.base[i * 3 + 2] = b;
  }
  update(dt) {
    let i = 0;
    while (i < this.n) {
      this.life[i] += dt;
      if (this.life[i] >= this.max[i]) { this.kill(i); continue; }
      const t = this.life[i] / this.max[i], k = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= k; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * k - this.grav[i] * dt; this.vel[i * 3 + 2] *= k;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * Math.sqrt(t);
      const fade = t < 0.12 ? t / 0.12 : 1 - (t - 0.12) / 0.88;
      this.col[i * 4] = this.base[i * 3]; this.col[i * 4 + 1] = this.base[i * 3 + 1]; this.col[i * 4 + 2] = this.base[i * 3 + 2]; this.col[i * 4 + 3] = this.a0[i] * fade;
      i++;
    }
    this.points.geometry.setDrawRange(0, this.n);
    this.aPos.needsUpdate = this.aSize.needsUpdate = this.aCol.needsUpdate = true;
  }
  kill(i) {
    const j = --this.n; if (i === j) return;
    for (const arr of [this.pos, this.vel, this.base]) { arr[i * 3] = arr[j * 3]; arr[i * 3 + 1] = arr[j * 3 + 1]; arr[i * 3 + 2] = arr[j * 3 + 2]; }
    for (let c = 0; c < 4; c++) this.col[i * 4 + c] = this.col[j * 4 + c];
    for (const arr of [this.size, this.life, this.max, this.s0, this.s1, this.a0, this.drag, this.grav]) arr[i] = arr[j];
  }
  clear() { this.n = 0; }
}

export class FX {
  constructor(scene, heightAt) {
    this.scene = scene; this.heightAt = heightAt;
    const tex = softTex();
    this.add = new Particles(scene, 2500, true, tex);
    this.alpha = new Particles(scene, 3000, false, tex);
    this.lights = [];
    for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(0xffa860, 0, 90, 2); scene.add(l); this.lights.push({ l, t: 0, max: 1, peak: 0 }); }
    this.li = 0;
    this.boltPool = new Map(); this.boltGeo = new THREE.BoxGeometry(1, 1, 1);
    this.scorch = [];
    const sg = new THREE.CircleGeometry(1, 20); sg.rotateX(-Math.PI / 2);
    const sm = new THREE.MeshBasicMaterial({ color: 0x120a06, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    for (let i = 0; i < 30; i++) { const m = new THREE.Mesh(sg, sm); m.visible = false; scene.add(m); this.scorch.push(m); }
    this.si = 0;
    this.debris = [];
    const dg = new THREE.BoxGeometry(1, 1, 1), dm = new THREE.MeshStandardMaterial({ color: 0x2a2624, roughness: 0.8, metalness: 0.4 });
    for (let i = 0; i < 50; i++) { const m = new THREE.Mesh(dg, dm); m.visible = false; m.castShadow = true; scene.add(m); this.debris.push({ m, v: new THREE.Vector3(), w: new THREE.Vector3(), t: 0 }); }
    this.di = 0;
    // shockwave rings and heat shells for explosions; delayed secondary effects
    this.waves = []; this.later = [];
    for (let i = 0; i < 8; i++) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffd2a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
      ring.rotation.x = -Math.PI / 2; ring.visible = false; scene.add(ring);
      const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffe6b8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      shell.visible = false; scene.add(shell);
      this.waves.push({ ring, shell, t: 1, max: 1, r: 1, s: 1 });
    }
    this.wi = 0;
  }
  setScale(h, fov) { const s = h / (2 * Math.tan(fov * Math.PI / 360)); this.add.uniforms.uScale.value = s; this.alpha.uniforms.uScale.value = s; }
  bolt(color, len, width) {
    const key = color;
    let pool = this.boltPool.get(key);
    if (!pool) { pool = { mat: new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false }), free: [] }; this.boltPool.set(key, pool); }
    const m = pool.free.pop() || new THREE.Mesh(this.boltGeo, pool.mat);
    m.scale.set(width, width, len); m.visible = true; m.userData.pool = pool; this.scene.add(m); return m;
  }
  release(m) { m.visible = false; this.scene.remove(m); m.userData.pool.free.push(m); }
  flash(p, peak = 3000, dur = 0.25, color = 0xffa860) {
    const L = this.lights[this.li++ % this.lights.length];
    L.l.position.copy(p); L.l.color.set(color); L.t = 0; L.max = dur; L.peak = peak; L.l.intensity = peak;
  }
  dust(p, n = 6, spread = 2, size = 3, a = 0.32) {
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * 6.283, r = Math.random() * spread;
      this.alpha.emit(p.x + Math.cos(ang) * r, p.y + 0.3, p.z + Math.sin(ang) * r, Math.cos(ang) * 2.2, 0.6 + Math.random() * 1.4, Math.sin(ang) * 2.2,
        1.6 + Math.random() * 1.6, size * 0.6, size * 2.2, 0.62, 0.44, 0.32, a, 0.9, -0.05);
    }
  }
  smoke(p, n = 1, dark = 0.12, size = 4, rise = 2.5) {
    for (let i = 0; i < n; i++) this.alpha.emit(p.x + (Math.random() - 0.5) * 2, p.y, p.z + (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 1.2 + 1.2, rise + Math.random(), (Math.random() - 0.5) * 1.2,
      3 + Math.random() * 3, size, size * 3, dark, dark * 0.9, dark * 0.85, 0.5, 0.25, -0.1);
  }
  fire(p, n = 10, size = 2, spd = 6) {
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).normalize().multiplyScalar(spd * (0.3 + Math.random()));
      this.add.emit(p.x, p.y, p.z, v.x, v.y, v.z, 0.35 + Math.random() * 0.5, size * 0.6, size * 1.8, 1.0, 0.5 + Math.random() * 0.25, 0.18, 0.9, 2.5, -1);
    }
  }
  sparks(p, n = 8, spd = 14, col = [1, 0.75, 0.4]) {
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9, Math.random() - 0.5).normalize().multiplyScalar(spd * (0.4 + Math.random()));
      this.add.emit(p.x, p.y, p.z, v.x, v.y, v.z, 0.25 + Math.random() * 0.4, 0.25, 0.08, col[0], col[1], col[2], 1, 1.2, 3.71);
    }
  }
  muzzle(p, dir, size = 1.4) {
    this.add.emit(p.x, p.y, p.z, dir.x * 4, dir.y * 4, dir.z * 4, 0.07, size * 1.6, size * 2.6, 1, 0.78, 0.45, 1, 0, 0);
    for (let i = 0; i < 3; i++) this.add.emit(p.x, p.y, p.z, dir.x * 30 + (Math.random() - 0.5) * 6, dir.y * 30 + Math.random() * 3, dir.z * 30 + (Math.random() - 0.5) * 6, 0.12, 0.3, 0.1, 1, 0.7, 0.35, 1, 3, 0);
    this.alpha.emit(p.x, p.y, p.z, dir.x * 3, dir.y * 3 + 0.5, dir.z * 3, 0.9, 0.6, 2.2, 0.5, 0.42, 0.36, 0.25, 1, -0.2);
  }
  trail(p) { this.alpha.emit(p.x, p.y, p.z, (Math.random() - 0.5) * 0.6, 0.3, (Math.random() - 0.5) * 0.6, 1.4 + Math.random(), 0.5, 2.4, 0.78, 0.7, 0.62, 0.45, 0.6, -0.15); }
  jet(p) {
    this.add.emit(p.x, p.y, p.z, (Math.random() - 0.5) * 2, -12 - Math.random() * 6, (Math.random() - 0.5) * 2, 0.18, 1.2, 0.4, 0.6, 0.75, 1, 0.9, 1, 0);
  }
  decal(p, r) {
    const m = this.scorch[this.si++ % this.scorch.length];
    m.position.set(p.x, this.heightAt(p.x, p.z) + 0.08, p.z); m.scale.setScalar(r); m.rotation.y = Math.random() * 6; m.visible = true;
  }
  chunks(p, n, size) {
    for (let i = 0; i < n; i++) {
      const d = this.debris[this.di++ % this.debris.length];
      d.m.position.copy(p); d.m.scale.set(size * (0.3 + Math.random()), size * (0.2 + Math.random() * 0.5), size * (0.3 + Math.random()));
      d.v.set((Math.random() - 0.5) * 18, 6 + Math.random() * 14, (Math.random() - 0.5) * 18); d.w.set(Math.random() * 6, Math.random() * 6, Math.random() * 6); d.t = 6; d.m.visible = true;
    }
  }
  explode(p, size = 1) {
    const q = p.clone(), gy = this.heightAt(q.x, q.z), low = q.y - gy < 4 + size * 3;
    // white-hot core, then the orange fireball
    for (let i = 0; i < Math.round(10 * size); i++) { const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).multiplyScalar(5 * size); this.add.emit(q.x, q.y, q.z, v.x, v.y, v.z, 0.16 + Math.random() * 0.1, 1.5 * size, 4.6 * size, 1, 0.96, 0.85, 1, 2, 0); }
    this.fire(q, Math.round(30 * size), 3.4 * size, 10 * size);
    // embers on long low-gravity arcs
    for (let i = 0; i < Math.round(26 * size); i++) { const v = new THREE.Vector3(Math.random() - 0.5, 0.35 + Math.random() * 0.9, Math.random() - 0.5).normalize().multiplyScalar(10 + Math.random() * 18 * size); this.add.emit(q.x, q.y, q.z, v.x, v.y, v.z, 1.1 + Math.random() * 1.4, 0.32, 0.12, 1, 0.62, 0.28, 1, 0.08, 3.71); }
    this.sparks(q, Math.round(16 * size), 24 * size);
    // shockwave ring along the ground and a heat shell
    const W = this.waves[this.wi++ % this.waves.length]; W.t = 0; W.max = 0.55 + 0.25 * size; W.r = 9 + 10 * size; W.s = 2.2 + 2.6 * size;
    W.ring.position.set(q.x, gy + 0.25, q.z); W.ring.visible = low; W.shell.position.copy(q); W.shell.visible = true;
    // dust skirt thrown out radially, and a smoke column that keeps rising
    if (low) for (let i = 0; i < Math.round(22 * size); i++) { const a = Math.random() * 6.283, sp = (8 + Math.random() * 10) * size; this.alpha.emit(q.x + Math.cos(a), gy + 0.4, q.z + Math.sin(a), Math.cos(a) * sp, 0.6 + Math.random(), Math.sin(a) * sp, 1.6 + Math.random() * 1.2, 2 * size, 6 * size, 0.55, 0.38, 0.28, 0.42, 1.4, 0.05); }
    this.smoke(q, Math.round(8 * size), 0.1, 4 * size, 3);
    this.later.push({ t: 0.25, f: () => this.smoke(q, Math.round(10 * size), 0.06, 5 * size, 5) }, { t: 0.7, f: () => this.smoke(q.clone().setY(q.y + 3 * size), Math.round(8 * size), 0.05, 6 * size, 6) });
    if (size > 1.1) this.later.push({ t: 0.18 + Math.random() * 0.2, f: () => { const o = q.clone().add(new THREE.Vector3((Math.random() - 0.5) * 4 * size, Math.random() * 2 * size, (Math.random() - 0.5) * 4 * size)); this.fire(o, Math.round(10 * size), 2 * size, 5 * size); this.flash(o, 3000 * size, 0.2); } });
    this.flash(q, 11000 * size, 0.4 + 0.25 * size);
    if (size > 0.6) { this.decal(q, 3 + size * 3.5); this.chunks(q, Math.round(8 * size), 0.7 * size); }
  }
  // Hit on armour: a bright spall flash, sparks, and a fleck of plate
  spall(p, n = 1) { this.add.emit(p.x, p.y, p.z, 0, 0.5, 0, 0.08, 1.4, 2.2, 1, 0.9, 0.7, 1, 0, 0); this.sparks(p, 6 * n, 16); if (Math.random() < 0.3 * n) this.chunks(p, 1, 0.25); }
  update(dt) {
    this.add.update(dt); this.alpha.update(dt);
    for (let i = this.later.length - 1; i >= 0; i--) { const L = this.later[i]; L.t -= dt; if (L.t <= 0) { this.later.splice(i, 1); L.f(); } }
    for (const W of this.waves) { if (W.t >= W.max) { W.ring.visible = W.shell.visible = false; continue; } W.t += dt; const k = Math.min(1, W.t / W.max), e = 1 - (1 - k) ** 3;
      W.ring.scale.setScalar(0.5 + W.r * e); W.ring.material.opacity = 0.7 * (1 - k) ** 1.5; const ks = Math.min(1, W.t / 0.2); W.shell.scale.setScalar(0.5 + W.s * (1 - (1 - ks) ** 2)); W.shell.material.opacity = 0.55 * (1 - ks) ** 2; }
    for (const L of this.lights) { if (L.t < L.max) { L.t += dt; L.l.intensity = L.peak * Math.max(0, 1 - L.t / L.max) ** 2; } else L.l.intensity = 0; }
    for (const d of this.debris) {
      if (d.t <= 0) continue;
      d.t -= dt; d.v.y -= 3.71 * dt; d.m.position.addScaledVector(d.v, dt);
      d.m.rotation.x += d.w.x * dt; d.m.rotation.y += d.w.y * dt;
      const g = this.heightAt(d.m.position.x, d.m.position.z);
      if (d.m.position.y < g) { d.m.position.y = g; d.v.multiplyScalar(0.35); d.v.y = Math.abs(d.v.y) * 0.3; d.w.multiplyScalar(0.5); }
      if (d.t <= 0) d.m.visible = false;
    }
  }
}
