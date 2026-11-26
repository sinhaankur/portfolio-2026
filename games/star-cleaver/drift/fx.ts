/**
 * Particle FX — pooled CPU particles drawn as two point clouds
 * (additive sparks/fire, alpha-blended smoke/dust) plus flash/shockwave sprites.
 * Stored in world space (float64) and re-based on the floating origin each frame.
 */
import * as THREE from 'three';
import { glowTexture, smokeTexture, ringTexture } from './textures';

const VERT = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  attribute float aSize;
  attribute vec4 aColor;
  varying vec4 vColor;
  uniform float uScale;
  void main() {
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / max(0.5, -mv.z);
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
  }
`;
const FRAG = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform sampler2D uMap;
  varying vec4 vColor;
  void main() {
    #include <logdepthbuf_fragment>
    vec4 t = texture2D(uMap, gl_PointCoord);
    gl_FragColor = vec4(vColor.rgb * t.rgb, vColor.a * t.a);
    if (gl_FragColor.a < 0.004) discard;
  }
`;

class Pool {
  n = 0;
  readonly max: number;
  px: Float64Array; py: Float64Array; pz: Float64Array;
  vx: Float32Array; vy: Float32Array; vz: Float32Array;
  life: Float32Array; maxLife: Float32Array;
  size0: Float32Array; size1: Float32Array;
  c0: Float32Array; c1: Float32Array; // rgb start/end
  alpha0: Float32Array; drag: Float32Array;
  geo: THREE.BufferGeometry;
  pos: Float32Array; col: Float32Array; siz: Float32Array;
  points: THREE.Points;
  mat: THREE.ShaderMaterial;

  constructor(max: number, map: THREE.Texture, additive: boolean) {
    this.max = max;
    this.px = new Float64Array(max); this.py = new Float64Array(max); this.pz = new Float64Array(max);
    this.vx = new Float32Array(max); this.vy = new Float32Array(max); this.vz = new Float32Array(max);
    this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
    this.size0 = new Float32Array(max); this.size1 = new Float32Array(max);
    this.c0 = new Float32Array(max * 3); this.c1 = new Float32Array(max * 3);
    this.alpha0 = new Float32Array(max); this.drag = new Float32Array(max);
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 4); this.siz = new Float32Array(max);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.siz, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      uniforms: { uMap: { value: map }, uScale: { value: 400 } },
      transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 20 : 19;
  }

  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, s0: number, s1: number, c0: THREE.Color, c1: THREE.Color, a0: number, drag: number) {
    let i = this.n;
    if (i >= this.max) {
      // recycle the oldest-looking slot
      i = Math.floor(Math.random() * this.max);
    } else this.n++;
    this.px[i] = x; this.py[i] = y; this.pz[i] = z;
    this.vx[i] = vx; this.vy[i] = vy; this.vz[i] = vz;
    this.life[i] = life; this.maxLife[i] = life;
    this.size0[i] = s0; this.size1[i] = s1;
    this.c0[i * 3] = c0.r; this.c0[i * 3 + 1] = c0.g; this.c0[i * 3 + 2] = c0.b;
    this.c1[i * 3] = c1.r; this.c1[i * 3 + 1] = c1.g; this.c1[i * 3 + 2] = c1.b;
    this.alpha0[i] = a0; this.drag[i] = drag;
  }

  update(dt: number, ox: number, oy: number, oz: number) {
    let w = 0;
    for (let i = 0; i < this.n; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) continue;
      // compact in place
      if (w !== i) {
        this.px[w] = this.px[i]; this.py[w] = this.py[i]; this.pz[w] = this.pz[i];
        this.vx[w] = this.vx[i]; this.vy[w] = this.vy[i]; this.vz[w] = this.vz[i];
        this.life[w] = this.life[i]; this.maxLife[w] = this.maxLife[i];
        this.size0[w] = this.size0[i]; this.size1[w] = this.size1[i];
        for (let k = 0; k < 3; k++) { this.c0[w * 3 + k] = this.c0[i * 3 + k]; this.c1[w * 3 + k] = this.c1[i * 3 + k]; }
        this.alpha0[w] = this.alpha0[i]; this.drag[w] = this.drag[i];
      }
      const d = Math.exp(-this.drag[w] * dt);
      this.vx[w] *= d; this.vy[w] *= d; this.vz[w] *= d;
      this.px[w] += this.vx[w] * dt; this.py[w] += this.vy[w] * dt; this.pz[w] += this.vz[w] * dt;
      const t = 1 - this.life[w] / this.maxLife[w];
      this.pos[w * 3] = this.px[w] - ox; this.pos[w * 3 + 1] = this.py[w] - oy; this.pos[w * 3 + 2] = this.pz[w] - oz;
      const fade = t < 0.1 ? t / 0.1 : 1 - (t - 0.1) / 0.9;
      for (let k = 0; k < 3; k++) this.col[w * 4 + k] = this.c0[w * 3 + k] * (1 - t) + this.c1[w * 3 + k] * t;
      this.col[w * 4 + 3] = this.alpha0[w] * Math.max(0, fade);
      this.siz[w] = this.size0[w] + (this.size1[w] - this.size0[w]) * t;
      w++;
    }
    this.n = w;
    this.geo.setDrawRange(0, w);
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.aColor as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
  }
}

interface Flash { sprite: THREE.Sprite; x: number; y: number; z: number; life: number; max: number; s0: number; s1: number; ring: boolean }

const C = (hex: string) => new THREE.Color(hex);
const COL = {
  spark: C('#ffe2a8'), sparkEnd: C('#ff6a1a'),
  fire: C('#ffb04a'), fireEnd: C('#a3220b'),
  smoke: C('#5b5650'), smokeEnd: C('#26231f'),
  dust: C('#8a7a68'), dustEnd: C('#4a4038'),
  alien: C('#ff4fb0'), alienEnd: C('#6a1040'),
  cyan: C('#9fe8ff'), cyanEnd: C('#2a6cff'),
  red: C('#ff6b6b'), redEnd: C('#7a1010'),
  white: C('#ffffff'),
};

export class FX {
  group = new THREE.Group();
  add: Pool;
  smoke: Pool;
  flashes: Flash[] = [];
  private pending: { at: number; x: number; y: number; z: number; size: number; kind: string }[] = [];
  private time = 0;
  scale = 1;

  constructor(quality: 'low' | 'high') {
    this.scale = quality === 'high' ? 1 : 0.55;
    this.add = new Pool(quality === 'high' ? 5000 : 2200, glowTexture(), true);
    this.smoke = new Pool(quality === 'high' ? 1600 : 700, smokeTexture(), false);
    this.group.add(this.smoke.points, this.add.points);
  }

  setViewport(heightPx: number, fovDeg: number) {
    const s = heightPx / (2 * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2));
    this.add.mat.uniforms.uScale.value = s;
    this.smoke.mat.uniforms.uScale.value = s;
  }

  private rnd() { return Math.random() * 2 - 1; }
  private burst(pool: Pool, n: number, x: number, y: number, z: number, speed: number, life: number, s0: number, s1: number, c0: THREE.Color, c1: THREE.Color, a: number, drag: number, spread = 1) {
    n = Math.max(1, Math.round(n * this.scale));
    for (let i = 0; i < n; i++) {
      let dx = this.rnd(), dy = this.rnd(), dz = this.rnd();
      const l = Math.hypot(dx, dy, dz) || 1;
      const sp = speed * (0.35 + Math.random() * 0.65);
      dx /= l; dy /= l; dz /= l;
      pool.spawn(x + dx * spread * Math.random(), y + dy * spread * Math.random(), z + dz * spread * Math.random(), dx * sp, dy * sp, dz * sp,
        life * (0.6 + Math.random() * 0.6), s0 * (0.7 + Math.random() * 0.6), s1 * (0.7 + Math.random() * 0.6), c0, c1, a, drag);
    }
  }

  private flash(x: number, y: number, z: number, size: number, life: number, color: THREE.Color, ring = false) {
    const mat = new THREE.SpriteMaterial({ map: ring ? ringTexture() : glowTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    const s = new THREE.Sprite(mat);
    s.renderOrder = 21;
    this.group.add(s);
    this.flashes.push({ sprite: s, x, y, z, life, max: life, s0: ring ? size * 0.2 : size, s1: ring ? size * 2.2 : size * 0.4, ring });
  }

  explosion(p: THREE.Vector3, size: number, kind: 'ship' | 'turret' | 'base' | 'rock' | 'player') {
    const { x, y, z } = p;
    if (kind === 'rock') {
      this.burst(this.smoke, 18 + size * 0.5, x, y, z, size * 1.2, 2.6, size * 0.5, size * 1.6, COL.dust, COL.dustEnd, 0.55, 0.8, size * 0.5);
      this.burst(this.add, 10, x, y, z, size * 3, 0.5, 2, 0.5, COL.spark, COL.sparkEnd, 1, 1.5);
      this.flash(x, y, z, size * 2.2, 0.25, C('#ffd9a0'));
      return;
    }
    const alien = kind === 'turret' || kind === 'base';
    const big = kind === 'base' ? 1 : 0;
    this.burst(this.add, 40 + size * 2, x, y, z, 60 + size * 9, 0.9, 1.8, 0.4, COL.spark, alien ? COL.alien : COL.sparkEnd, 1, 1.2);
    this.burst(this.add, 16 + size, x, y, z, size * 2.4, 1.1, size * 0.9, size * 2.2, alien ? COL.alien : COL.fire, alien ? COL.alienEnd : COL.fireEnd, 0.9, 1.6, size * 0.4);
    this.burst(this.smoke, 10 + size * 0.6, x, y, z, size * 1.4, 3.2, size * 0.8, size * 3, COL.smoke, COL.smokeEnd, 0.5, 0.7, size * 0.6);
    this.flash(x, y, z, size * 5, 0.35, alien ? C('#ff9ad8') : C('#ffe8c0'));
    this.flash(x, y, z, size * 4, 0.7, alien ? C('#ff4fb0') : C('#ffb878'), true);
    if (big) {
      for (let i = 0; i < 9; i++) {
        this.pending.push({ at: this.time + 0.15 + i * 0.22, x: x + this.rnd() * size * 0.7, y: y + this.rnd() * size * 0.5, z: z + this.rnd() * size * 0.7, size: size * 0.3, kind: 'turret' });
      }
      this.flash(x, y, z, size * 9, 1.4, C('#ffffff'), true);
    }
    if (kind === 'player') {
      this.burst(this.add, 60, x, y, z, 140, 1.4, 2.5, 0.5, COL.cyan, COL.cyanEnd, 1, 0.8);
    }
  }

  hit(p: THREE.Vector3, team: 'player' | 'enemy', shield: boolean) {
    const c0 = shield ? COL.cyan : team === 'player' ? COL.spark : COL.red;
    const c1 = shield ? COL.cyanEnd : team === 'player' ? COL.sparkEnd : COL.redEnd;
    this.burst(this.add, shield ? 10 : 7, p.x, p.y, p.z, 70, 0.35, 1.4, 0.3, c0, c1, 1, 2);
    this.flash(p.x, p.y, p.z, shield ? 9 : 5, 0.12, c0);
  }

  muzzle(p: THREE.Vector3, team: 'player' | 'enemy') {
    this.flash(p.x, p.y, p.z, team === 'player' ? 3.2 : 4, 0.06, team === 'player' ? C('#ffd27a') : C('#ff6a8a'));
  }

  /** engine exhaust embers + trail puffs, called per frame */
  exhaust(p: THREE.Vector3, vel: THREE.Vector3, back: THREE.Vector3, intensity: number, color = COL.fire) {
    if (intensity < 0.05 || Math.random() > intensity * 0.9) return;
    const s = 18 + intensity * 30;
    this.add.spawn(p.x, p.y, p.z, vel.x + back.x * s + this.rnd() * 3, vel.y + back.y * s + this.rnd() * 3, vel.z + back.z * s + this.rnd() * 3,
      0.25 + intensity * 0.25, 0.9 + intensity * 0.8, 0.2, color, COL.fireEnd, 0.8, 0.5);
  }

  update(dt: number, origin: THREE.Vector3) {
    this.time += dt;
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const e = this.pending[i];
      if (this.time >= e.at) { this.pending.splice(i, 1); this.explosion(new THREE.Vector3(e.x, e.y, e.z), e.size, 'turret'); }
    }
    this.add.update(dt, origin.x, origin.y, origin.z);
    this.smoke.update(dt, origin.x, origin.y, origin.z);
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.life -= dt;
      if (f.life <= 0) {
        this.group.remove(f.sprite);
        f.sprite.material.dispose();
        this.flashes.splice(i, 1);
        continue;
      }
      const t = 1 - f.life / f.max;
      const s = f.s0 + (f.s1 - f.s0) * (f.ring ? 1 - (1 - t) * (1 - t) : t);
      f.sprite.scale.setScalar(s);
      f.sprite.position.set(f.x - origin.x, f.y - origin.y, f.z - origin.z);
      f.sprite.material.opacity = f.ring ? (1 - t) * 0.8 : (1 - t);
    }
  }
}
