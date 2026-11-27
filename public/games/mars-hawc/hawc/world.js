import { THREE, clamp, lerp, sstep, fbm, rng, sunVector } from './lib.js?v=18';
import { placeHeritage } from './probes.js?v=18';
import { buildHorizon } from './horizon.js?v=18';
import { loadTex, loadHeight, loadGLTF, getTemplate, instantiate } from './assets.js?v=18';
import { buildAtmos, softDot } from './atmos.js?v=18';
import { buildBase, flags, animateFlags, mats, colonyPads } from './base.js?v=18';
export { buildRelay, buildMeson } from './base.js?v=18';

export const SKIES = {
  day: { horizon: '#d8a67c', zenith: '#9a6f56', glow: '#ffe3bd', fog: '#c89a74', sun: '#fff0dc', sunI: 2.7, hemiSky: '#ecc6a0', hemiGround: '#6e4c38', hemiI: 0.85, exposure: 0.95 },
  dust: { horizon: '#c08a5e', zenith: '#a3714f', glow: '#ffd6a6', fog: '#b4865f', sun: '#ffe0bf', sunI: 1.7, hemiSky: '#e0b48a', hemiGround: '#6a4632', hemiI: 1.05, exposure: 1.0 },
  sunset: { horizon: '#6e4e40', zenith: '#18161d', glow: '#86ace0', fog: '#4e3b35', sun: '#ffd8b8', sunI: 1.6, hemiSky: '#5d6278', hemiGround: '#3a2620', hemiI: 0.75, exposure: 1.1 },
};

export const WORLD = { S: 2400, PLAY: 640 };

export async function buildWorld(scene, L, quality = 1, opts = {}) {
  flags.clear();
  const S = WORLD.S, N = quality > 0.7 ? 300 : 200, step = S / N, half = S / 2;
  const sky = SKIES[L.sky];
  const R = rng(L.seed);
  const hm = await loadHeight(L.terrain);
  const sampleHM = (u, v) => {
    const x = clamp(u, 0, 1) * (hm.w - 1), y = clamp(v, 0, 1) * (hm.h - 1), xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const x1 = Math.min(xi + 1, hm.w - 1), y1 = Math.min(yi + 1, hm.h - 1), d = hm.data, w = hm.w;
    return lerp(lerp(d[yi * w + xi], d[yi * w + x1], xf), lerp(d[y1 * w + xi], d[y1 * w + x1], xf), yf);
  };
  const craters = [];
  for (let i = 0; i < L.craters; i++) {
    const a = R() * 6.283, r = 80 + R() * 900, rad = 8 + R() ** 2 * 55;
    craters.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, r: rad, d: rad * (0.16 + R() * 0.1) });
  }
  const lay = L.layout;
  const pads = [];
  if (lay.relay) pads.push({ x: lay.relay[0], z: lay.relay[1], r: 52 });
  if (lay.dropship) pads.push({ x: lay.dropship[0], z: lay.dropship[1], r: lay.relay ? 18 : 30 });
  for (const m of lay.mesons || []) pads.push({ x: m[0], z: m[1], r: 14 });
  pads.push({ x: lay.start[0], z: lay.start[1], r: 12 });
  pads.push(...colonyPads(lay));
  const rawH = (x, z) => {
    let h = sampleHM(x / S + 0.5, z / S + 0.5) * L.relief;
    h += (fbm(x / 95, z / 95, 4, L.seed) - 0.5) * L.rough * 2;
    h += (fbm(x / 21, z / 21, 3, L.seed + 9) - 0.5) * 1.3;
    for (const c of craters) {
      const dx = x - c.x, dz = z - c.z, d = Math.sqrt(dx * dx + dz * dz) / c.r;
      if (d < 2.2) h += d < 1 ? -c.d * (1 - d * d) + c.d * 0.25 : c.d * 0.25 * Math.exp(-(((d - 1) / 0.32) ** 2));
    }
    const r = Math.hypot(x, z);
    if (r > WORLD.PLAY + 40) h += ((r - WORLD.PLAY - 40) / 380) ** 2 * 70 * (0.6 + fbm(x / 200, z / 200, 2, 3));
    return h;
  };
  for (const p of pads) p.h = rawH(p.x, p.z);
  const H0 = pads.length ? pads[0].h : rawH(0, 0);
  const genH = (x, z) => {
    let h = rawH(x, z);
    for (const p of pads) { const d = Math.hypot(x - p.x, z - p.z); if (d < p.r * 1.8) h = lerp(h, p.h, sstep(p.r * 1.8, p.r, d)); }
    return h - H0;
  };
  const NV = N + 1, H = new Float32Array(NV * NV);
  for (let i = 0; i < NV; i++) for (let j = 0; j < NV; j++) H[i * NV + j] = genH(-half + j * step, -half + i * step);
  const heightAt = (x, z) => {
    const gx = clamp((x + half) / step, 0, N - 0.001), gz = clamp((z + half) / step, 0, N - 0.001);
    const j = Math.floor(gx), i = Math.floor(gz), fx = gx - j, fz = gz - i;
    const a = H[i * NV + j], b = H[i * NV + j + 1], c = H[(i + 1) * NV + j], d = H[(i + 1) * NV + j + 1];
    return fx + fz < 1 ? a + (b - a) * fx + (c - a) * fz : d + (c - d) * (1 - fx) + (b - d) * (1 - fz);
  };
  const normalAt = (x, z, out = new THREE.Vector3()) => out.set(heightAt(x - 1.5, z) - heightAt(x + 1.5, z), 3, heightAt(x, z - 1.5) - heightAt(x, z + 1.5)).normalize();

  // Terrain mesh
  const pos = new Float32Array(NV * NV * 3), uv = new Float32Array(NV * NV * 2), col = new Float32Array(NV * NV * 3);
  const cBright = new THREE.Color(1.22, 1.1, 1.0), cRust = new THREE.Color(1.0, 0.8, 0.68), cDark = new THREE.Color(0.58, 0.5, 0.46), tmp = new THREE.Color();
  for (let i = 0; i < NV; i++) for (let j = 0; j < NV; j++) {
    const k = i * NV + j, x = -half + j * step, z = -half + i * step, h = H[k];
    pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
    uv[k * 2] = x / 7; uv[k * 2 + 1] = z / 7;
    const hx = H[i * NV + Math.min(j + 1, N)] - H[i * NV + Math.max(j - 1, 0)], hz = H[Math.min(i + 1, N) * NV + j] - H[Math.max(i - 1, 0) * NV + j];
    const slope = clamp(Math.hypot(hx, hz) / (2 * step) * 1.6, 0, 1);
    const n1 = fbm(x / 140, z / 140, 3, L.seed + 4), n2 = fbm(x / 35, z / 35, 2, L.seed + 7);
    tmp.copy(cRust).lerp(cBright, sstep(0.38, 0.7, n1) * (1 - slope));
    tmp.lerp(cDark, clamp(slope * 0.9 + sstep(0.62, 0.8, n2) * 0.35 + (L.sky === 'dust' ? 0 : sstep(0.2, 0.05, n1) * 0.5), 0, 1));
    col[k * 3] = tmp.r; col[k * 3 + 1] = tmp.g; col[k * 3 + 2] = tmp.b;
  }
  const idx = new Uint32Array(N * N * 6);
  let q = 0;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const a = i * NV + j, b = a + 1, c = a + NV, d = c + 1; idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1)); geo.computeVertexNormals();
  const [alb, nor, rough] = await Promise.all([
    loadTex('tex/ground_soil_albedo.png', { repeat: true }), loadTex('tex/ground_soil_normal.png', { srgb: false, repeat: true }), loadTex('tex/ground_soil_roughness.png', { srgb: false, repeat: true }),
  ]);
  const tmat = new THREE.MeshStandardMaterial({ map: alb, normalMap: nor, normalScale: new THREE.Vector2(1.3, 1.3), roughnessMap: rough, roughness: 1, metalness: 0, vertexColors: true });
  tmat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `
      vec4 tA = texture2D(map, vMapUv); vec4 tB = texture2D(map, vMapUv * 0.161 + vec2(0.37, 0.11)); vec4 tC = texture2D(map, vMapUv * 0.031 + vec2(0.71, 0.53));
      float far = smoothstep(18.0, 220.0, length(vViewPosition));
      diffuseColor *= mix(mix(tA, tB, 0.42), mix(tB, tC, 0.5), far) * 1.12;`);
  };
  const terrain = new THREE.Mesh(geo, tmat); terrain.receiveShadow = true; scene.add(terrain);

  const hemi = new THREE.HemisphereLight(new THREE.Color(sky.hemiSky), new THREE.Color(sky.hemiGround), sky.hemiI); scene.add(hemi);
  const sun = new THREE.DirectionalLight(new THREE.Color(sky.sun), sky.sunI);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -75; sc.right = 75; sc.top = 75; sc.bottom = -75; sc.near = 10; sc.far = 600;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6;
  scene.add(sun, sun.target);
  const atmos = await buildAtmos(scene, L, sky, opts, { sun, hemi, heightAt });
  const sunDir = atmos.sunDir;
  const horizon = await buildHorizon(scene, L, heightAt, scene.fog.density, { sun, hemi });

  // Rocks — real meshes, instanced
  const colliders = [];
  const base = buildBase(heightAt, lay, L.lat); scene.add(base.group); colliders.push(...base.colliders);
  const heritage = placeHeritage(scene, L, heightAt, colliders, lay.start);
  const rockTpl = await Promise.all(['mars_rock_1', 'mars_rock_2', 'mars_rock_3'].map((n) => loadGLTF(n)));
  const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), e = new THREE.Euler(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
  const avoid = [...pads];
  if (lay.shield) avoid.push({ x: lay.shield[0], z: lay.shield[1], r: 30 });
  for (let t = 0; t < 3; t++) {
    let mesh; rockTpl[t].scene.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
    const g = mesh.geometry.clone(); g.computeBoundingBox(); const bb = g.boundingBox, c = bb.getCenter(new THREE.Vector3()), s = bb.getSize(new THREE.Vector3());
    g.translate(-c.x, -c.y, -c.z); g.scale(1 / Math.max(s.x, s.y, s.z), 1 / Math.max(s.x, s.y, s.z), 1 / Math.max(s.x, s.y, s.z));
    const mat = mesh.material.clone(); mat.color = new THREE.Color(0.95, 0.66, 0.5); mat.roughness = 0.95; mat.metalness = 0;
    const count = Math.round((quality > 0.7 ? 70 : 40));
    const im = new THREE.InstancedMesh(g, mat, count); im.castShadow = true; im.receiveShadow = true;
    let n = 0, tries = 0;
    while (n < count && tries++ < count * 6) {
      const a = R() * 6.283, r = Math.sqrt(R()) * (WORLD.PLAY + 120);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const big = R() < 0.35;
      const sc2 = big ? 4 + R() * 8 : 1.2 + R() ** 2 * 2.6;
      if (avoid.some((p) => Math.hypot(x - p.x, z - p.z) < p.r + sc2 + 4)) continue;
      pv.set(x, heightAt(x, z) - sc2 * 0.18, z); e.set(R() * 6, R() * 6, R() * 6); qq.setFromEuler(e); sv.set(sc2, sc2 * (0.55 + R() * 0.5), sc2 * (0.8 + R() * 0.4));
      im.setMatrixAt(n++, m4.compose(pv, qq, sv));
      if (big) colliders.push({ x, z, r: sc2 * 0.45 });
    }
    im.count = n; scene.add(im);
  }

  // Small scatter: cheap procedural stones
  for (let v = 0; v < 3; v++) {
    const g = new THREE.IcosahedronGeometry(1, 1), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const k = 0.7 + R() * 0.55; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.62, p.getZ(i) * k); }
    g.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.36 + v * 0.06, 0.25 + v * 0.03, 0.2), roughness: 0.95, flatShading: true });
    const n = quality > 0.7 ? 1400 : 700, im = new THREE.InstancedMesh(g, mat, n); im.castShadow = true; im.receiveShadow = true;
    let c = 0, tries = 0;
    while (c < n && tries++ < n * 4) {
      const a = R() * 6.283, r = Math.sqrt(R()) * (WORLD.PLAY + 60), x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (avoid.some((q) => Math.hypot(x - q.x, z - q.z) < q.r)) continue;
      const s = 0.12 + R() ** 3 * 0.9;
      pv.set(x, heightAt(x, z) + s * 0.15, z); e.set(R() * 0.5, R() * 6, R() * 0.5); qq.setFromEuler(e); sv.set(s, s, s * (0.7 + R() * 0.6));
      im.setMatrixAt(c++, m4.compose(pv, qq, sv));
    }
    im.count = c; scene.add(im);
  }

  // Drifting dust in the air around the camera
  const DN = 700, dpos = new Float32Array(DN * 3);
  for (let i = 0; i < DN; i++) { dpos[i * 3] = (Math.random() - 0.5) * 120; dpos[i * 3 + 1] = Math.random() * 30; dpos[i * 3 + 2] = (Math.random() - 0.5) * 120; }
  const dgeo = new THREE.BufferGeometry(); dgeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  const motes = new THREE.Points(dgeo, new THREE.PointsMaterial({ map: softDot(), color: new THREE.Color(sky.horizon).multiplyScalar(1.15), size: L.sky === 'dust' ? 0.3 : 0.17, transparent: true, opacity: L.sky === 'dust' ? 0.7 : 0.45, depthWrite: false }));
  motes.frustumCulled = false; scene.add(motes);
  const wind = atmos.wind; const moteOp = motes.material.opacity; const M_ = mats();

  const world = {
    heightAt, normalAt, colliders, sunDir, sun, hemi, sky, terrain, pads, atmos, base, heritage, horizon,
    get exposure() { return atmos.exposure; }, get night() { return atmos.night; }, get windLevel() { return atmos.windLevel; }, get buffet() { return atmos.buffet; }, clock: () => atmos.clock(),
    update(dt, focus, cam) {
      atmos.update(dt, focus, cam); horizon?.update(atmos.sunDir);
      const n = atmos.night;
      for (const l of base.lamps) l.light.intensity = l.k * n;
      for (const [mt, d0, d1] of M_.glows) mt.emissiveIntensity = lerp(d0, d1, n);
      motes.material.opacity = moteOp * (0.04 + 0.96 * atmos.day);
      animateFlags(performance.now() / 1000, wind); base.update(dt, performance.now() / 1000);
      sun.position.copy(focus).addScaledVector(sunDir, 260); sun.target.position.copy(focus);
      for (let i = 0; i < DN; i++) {
        let x = dpos[i * 3] + wind.x * dt, y = dpos[i * 3 + 1] + Math.sin(i + performance.now() * 0.0007) * 0.02, z = dpos[i * 3 + 2] + wind.z * dt;
        if (x - focus.x > 60) x -= 120; if (x - focus.x < -60) x += 120; if (z - focus.z > 60) z -= 120; if (z - focus.z < -60) z += 120;
        const g = heightAt(x, z); if (y < g + 0.2 || y > g + 32) y = g + 0.5 + Math.random() * 28;
        dpos[i * 3] = x; dpos[i * 3 + 1] = y; dpos[i * 3 + 2] = z;
      }
      dgeo.attributes.position.needsUpdate = true;
    },
  };
  return world;
}

export function buildShield(r) {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { t: { value: 0 }, hit: { value: 0 }, col: { value: new THREE.Color(1.0, 0.36, 0.16) } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vP = position; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: `uniform float t, hit; uniform vec3 col; varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.5); float bands = 0.5 + 0.5 * sin(vP.y * 0.9 - t * 2.0);
        float hex = step(0.92, fract(vP.x * 0.12 + vP.z * 0.07)) + step(0.92, fract(vP.y * 0.12));
        gl_FragColor = vec4(col * (f * (0.3 + 0.18 * bands) + hex * 0.03 + hit * 0.35), 1.0); }`,
  });
  const s = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), mat);
  s.renderOrder = 4; return s;
}

export async function buildDropship() {
  const t = await getTemplate('dropship', { length: 24 });
  const o = instantiate(t); o.position.y = 0.2; return o;
}
export async function buildCrates(n, R) {
  const t = await getTemplate('mars_crate', { length: 1.9 });
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) { const o = instantiate(t); o.position.set((R() - 0.5) * 7, 0, (R() - 0.5) * 5); o.rotation.y = R() * 6; g.add(o); }
  return g;
}
