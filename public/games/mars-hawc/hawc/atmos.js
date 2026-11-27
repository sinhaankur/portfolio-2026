// Sky, sun and moons over a sol, clouds, wind, dust devils.
import { THREE, clamp, lerp, sstep } from './lib.js?v=19';
import { loadTex } from './assets.js?v=19';

const D2R = Math.PI / 180;
let dotTex;
export function softDot() {
  if (dotTex) return dotTex;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); dotTex = new THREE.CanvasTexture(c); return dotTex;
}

// Seasonal cloud cover, after the Mars viewer's model: aphelion belt, polar hoods.
function cloudCover(L) {
  const ls = L.ls ?? 90, la = L.lat;
  const aph = sstep(30, 60, ls) * (1 - sstep(140, 165, ls));
  const hoodN = clamp((ls > 150 ? sstep(150, 195, ls) : 0) + (ls < 45 ? 1 - sstep(0, 45, ls) : 0), 0, 1);
  const hoodS = sstep(10, 45, ls) * (1 - sstep(150, 195, ls));
  let c = 0.06 + aph * 0.42 * sstep(-14, -4, la) * (1 - sstep(26, 38, la)) + hoodN * 0.5 * sstep(45, 60, la) + hoodS * 0.5 * (1 - sstep(-60, -45, la));
  if (L.clouds != null) c = L.clouds;
  return L.sky === 'dust' ? c * 0.25 : c;
}

const SKY_VS = 'varying vec3 vDir; void main(){ vDir = position; vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }';
const SKY_FS = `uniform vec3 sunDir, horizon, zenith, glow, camPos, moonDir; uniform vec2 wdir; uniform float cover, time, dust, cspd, moonK; varying vec3 vDir;
float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x*p.y); }
float h31(vec3 p){ p = fract(p*0.3183099 + 0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x + p.y + p.z)); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0 - 2.0*f); return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p){ float n = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ n += a*vn(p); p = p*2.03 + vec2(1.7, 9.2); a *= 0.5; } return n; }
void main(){
  vec3 d = normalize(vDir); float sy = sunDir.y;
  float day = smoothstep(-0.06, 0.22, sy);
  float tw = smoothstep(-0.34, -0.02, sy)*(1.0 - smoothstep(0.05, 0.4, sy));
  float night = 1.0 - smoothstep(-0.2, 0.0, sy);
  float h = max(d.y, 0.0), s = max(dot(d, sunDir), 0.0);
  vec2 hz = normalize(d.xz + 1e-4), sz = normalize(sunDir.xz + 1e-4);
  float side = pow(max(dot(hz, sz), 0.0), 2.0);
  vec3 cDay = mix(horizon, zenith, pow(h, 0.5)) + glow*(pow(s, 6.0)*0.25 + pow(s, 48.0)*0.55);
  vec3 cTw = mix(horizon*(0.18 + 0.5*side), zenith*0.06, pow(h, 0.3));
  vec3 cN = mix(vec3(0.032, 0.028, 0.034), vec3(0.006, 0.008, 0.018), pow(h, 0.4)) + vec3(0.03, 0.036, 0.058)*moonK*(1.0 - 0.45*h);
  vec3 c = mix(cN, mix(cTw, cDay, day), clamp(day + tw, 0.0, 1.0));
  c += vec3(0.36, 0.56, 0.95)*(pow(s, 4.0)*0.45 + pow(s, 24.0)*1.3)*tw*(1.0 - day*0.7);
  c += vec3(0.16, 0.22, 0.38)*side*pow(1.0 - h, 4.0)*smoothstep(-0.42, -0.12, sy)*(1.0 - day);
  c += vec3(1.0, 0.96, 0.9)*smoothstep(0.99986, 0.99994, s)*6.0*smoothstep(-0.015, 0.015, sy);
  if (night > 0.001 && d.y > 0.0) {
    vec3 q = d*280.0; vec3 id = floor(q); float r = h31(id);
    if (r > 0.982) { vec3 off = vec3(h31(id + 3.1), h31(id + 7.7), h31(id + 1.3)) - 0.5; float sd = length(fract(q) - 0.5 - off*0.5);
      float b = (r - 0.982)*72.0*smoothstep(0.32, 0.0, sd)*(0.75 + 0.25*sin(time*2.7 + r*91.0));
      c += mix(vec3(1.0, 0.85, 0.7), vec3(0.75, 0.85, 1.0), h31(id + 5.0))*b*night*smoothstep(0.0, 0.3, d.y)*(1.0 - dust); }
    float band = exp(-pow(dot(d, normalize(vec3(0.3, 0.55, 0.78))), 2.0)*14.0);
    c += vec3(0.11, 0.1, 0.13)*band*fbm(d.xz*9.0 + d.y*4.0)*night*(1.0 - dust)*(1.0 - 0.6*moonK);
    float ms = max(dot(d, moonDir), 0.0); c += vec3(0.55, 0.62, 0.82)*(pow(ms, 16.0)*0.07 + pow(ms, 240.0)*0.25)*moonK*(1.0 - dust*0.5);
  }
  if (d.y > 0.012 && cover > 0.01) {
    float t = (3400.0 - camPos.y)/d.y; vec2 p = camPos.xz + d.xz*t;
    vec2 q = vec2(dot(p, wdir), dot(p, vec2(-wdir.y, wdir.x)))/vec2(2400.0, 900.0); q.x -= time*cspd/2400.0;
    float n = fbm(q) + 0.35*fbm(q*3.7 + 11.0) - 0.17;
    float dens = smoothstep(1.0 - cover, 1.0 - cover + 0.32, n)*smoothstep(0.012, 0.14, d.y)*exp(-t/26000.0);
    float lit = smoothstep(-0.16, 0.03, sy);
    float ph = 0.45 + 1.4*pow(s, 7.0) + 0.5*s*s;
    vec3 cc = mix(vec3(0.72, 0.8, 0.98)*0.7, mix(horizon*1.2, vec3(1.0, 0.98, 0.95), 0.45), day)*ph*lit;
    cc = mix(cN*1.3, cc, lit);
    c = mix(c, cc, dens*0.88);
  }
  if (d.y < 0.0) c *= mix(1.0, 0.78, min(-d.y*3.0, 1.0));
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const DEVIL_VS = 'varying vec2 vUv; varying float vF; void main(){ vUv = uv; vec4 mv = modelViewMatrix*vec4(position,1.0); vec3 n = normalize(normalMatrix*normal); vF = abs(dot(n, normalize(-mv.xyz))); gl_Position = projectionMatrix*mv; }';
const DEVIL_FS = `uniform float time, a, spin, skirt; uniform vec3 col; varying vec2 vUv; varying float vF;
float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)))*43758.5453); }
float vnp(vec2 p, float P){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0 - 2.0*f); float i0 = mod(i.x, P), i1 = mod(i.x + 1.0, P);
  return mix(mix(hh(vec2(i0, i.y)), hh(vec2(i1, i.y)), f.x), mix(hh(vec2(i0, i.y + 1.0)), hh(vec2(i1, i.y + 1.0)), f.x), f.y); }
void main(){ float y = vUv.y; float sw = vUv.x*7.0 + y*6.0 - time*spin;
  float n = 0.6*vnp(vec2(sw, y*9.0 - time*0.7), 7.0) + 0.4*vnp(vec2(sw*2.0 + 3.0, y*23.0 - time*1.3), 14.0);
  float prof = mix(smoothstep(0.0, 0.04, y)*(1.0 - smoothstep(0.35, 1.0, y)), smoothstep(0.0, 0.1, y)*(1.0 - smoothstep(0.2, 1.0, y)), skirt);
  float al = a*pow(vF, 1.5)*prof*smoothstep(0.3, 0.8, n);
  gl_FragColor = vec4(col*(0.75 + 0.35*n), al); }`;

const MOON_VS = 'varying vec3 vN; varying vec2 vUv; void main(){ vUv = uv; vN = normalize(mat3(modelMatrix)*normal); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position.z = gl_Position.w*0.99999; }';
const MOON_FS = `uniform sampler2D map; uniform vec3 sunDir; uniform float k, alpha; varying vec3 vN; varying vec2 vUv;
void main(){ vec3 a = texture2D(map, vUv).rgb; float l = max(dot(normalize(vN), sunDir), 0.0); gl_FragColor = vec4(a*l*k*1.8 + a*0.01, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export async function buildAtmos(scene, L, sky, opts, { sun, hemi, heightAt }) {
  const lat = L.lat * D2R, dec = Math.asin(Math.sin(25.19 * D2R) * Math.sin((L.ls ?? 90) * D2R));
  const st = { hour: L.hour ?? 12, rate: opts.dayLen > 0 ? 24 / (opts.dayLen * 60) : 0, t: 0 };
  const enu = (E, N, U, out) => out.set(E, U, -N).normalize();
  const sunAt = (hour, out) => { const H = (hour - 12) * 15 * D2R; return enu(-Math.cos(dec) * Math.sin(H), Math.sin(dec) * Math.cos(lat) - Math.cos(dec) * Math.cos(H) * Math.sin(lat), Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(H) * Math.cos(lat), out); };
  const eqAt = (h, out) => enu(-Math.sin(h), -Math.cos(h) * Math.sin(lat), Math.cos(h) * Math.cos(lat), out);
  const sunDir = sunAt(st.hour, new THREE.Vector3());
  const dust = L.sky === 'dust' ? 1 : 0;
  const wAng = (L.windDir ?? (L.seed * 47) % 360) * D2R, wBase = L.wind ?? (dust ? 9 : 3.5);
  const wdir = new THREE.Vector2(Math.cos(wAng), Math.sin(wAng));
  const U = {
    sunDir: { value: sunDir }, horizon: { value: new THREE.Color(sky.horizon) }, zenith: { value: new THREE.Color(sky.zenith) }, glow: { value: new THREE.Color(sky.glow) },
    camPos: { value: new THREE.Vector3() }, wdir: { value: wdir }, cover: { value: cloudCover(L) }, time: { value: 0 }, dust: { value: dust ? 0.85 : 0.1 }, cspd: { value: 22 }, moonDir: { value: new THREE.Vector3(0, 1, 0) }, moonK: { value: 0 },
  };
  const skyMesh = new THREE.Mesh(new THREE.SphereGeometry(4000, 48, 24), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: U, vertexShader: SKY_VS, fragmentShader: SKY_FS }));
  skyMesh.renderOrder = -2; skyMesh.frustumCulled = false; scene.add(skyMesh);
  scene.fog = new THREE.FogExp2(new THREE.Color(sky.fog), L.haze * (L.sky === 'dust' ? 0.8 : 0.5)); scene.background = new THREE.Color(sky.fog);

  // Phobos (west to east, fast) and Deimos (east to west, slow); textures from the Mars viewer
  const [tP, tD] = await Promise.all([loadTex('tex/phobos.jpg'), loadTex('tex/deimos.jpg')]);
  const moon = (tex, r, sx, sy, sz) => {
    const g = new THREE.IcosahedronGeometry(1, 4); g.scale(sx, sy, sz);
    const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: { map: { value: tex }, sunDir: { value: sunDir }, k: { value: 1 }, alpha: { value: 1 } }, vertexShader: MOON_VS, fragmentShader: MOON_FS, transparent: true, depthWrite: false, fog: false }));
    m.scale.setScalar(r); m.renderOrder = -1; m.frustumCulled = false; scene.add(m); return m;
  };
  const phobos = moon(tP, 11, 1.0, 0.8, 0.68), deimos = moon(tD, 3.2, 1.0, 0.8, 0.73);
  const hP0 = (L.phobosH ?? 70) * D2R, hD0 = (L.deimosH ?? -35) * D2R;

  // Wind: steady direction, gusting speed, stronger in the afternoon
  const wind = new THREE.Vector3(); let gust = 1;
  // Saltating dust skimming the ground
  const SN = 900, spos = new Float32Array(SN * 3);
  for (let i = 0; i < SN; i++) { spos[i * 3] = (Math.random() - 0.5) * 140; spos[i * 3 + 2] = (Math.random() - 0.5) * 140; spos[i * 3 + 1] = -999; }
  const sgeo = new THREE.BufferGeometry(); sgeo.setAttribute('position', new THREE.BufferAttribute(spos, 3));
  const smat = new THREE.PointsMaterial({ map: softDot(), color: new THREE.Color(sky.horizon).multiplyScalar(1.1), size: 0.55, transparent: true, opacity: 0.2, depthWrite: false });
  const salt = new THREE.Points(sgeo, smat); salt.frustumCulled = false; scene.add(salt);

  // Dust devils
  const fGeo = new THREE.CylinderGeometry(1, 0.32, 1, 28, 16, true); fGeo.translate(0, 0.5, 0);
  const kGeo = new THREE.CylinderGeometry(1, 1.5, 1, 28, 2, true); kGeo.translate(0, 0.5, 0);
  const devils = [], nDev = L.devils ?? (dust ? 0 : 2);
  const dmat = (skirt) => new THREE.ShaderMaterial({ uniforms: { time: { value: 0 }, a: { value: 0 }, spin: { value: 1.4 }, skirt: { value: skirt }, col: { value: new THREE.Color(sky.horizon) } }, vertexShader: DEVIL_VS, fragmentShader: DEVIL_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  for (let i = 0; i < nDev; i++) {
    const a = new THREE.Mesh(fGeo, dmat(0)), b = new THREE.Mesh(kGeo, dmat(1)); a.renderOrder = b.renderOrder = 3; a.frustumCulled = b.frustumCulled = false; scene.add(a, b);
    devils.push({ a, b, x: 0, z: 0, age: 0, life: 0, r: 10, h: 200, spin: 1.4, ph: Math.random() * 6, init: false });
  }
  const respawn = (d, f, first) => {
    const ang = Math.atan2(wdir.y, wdir.x) + Math.PI + (Math.random() - 0.5) * 1.8, r = first ? 140 + Math.random() * 360 : 380 + Math.random() * 220;
    d.x = clamp(f.x + Math.cos(ang) * r, -1050, 1050); d.z = clamp(f.z + Math.sin(ang) * r, -1050, 1050);
    d.age = 0; d.life = 70 + Math.random() * 90; d.r = 7 + Math.random() * 14; d.h = 110 + Math.random() * 230; d.spin = 1.1 + Math.random() * 0.9; d.init = true;
  };

  const C = (h) => new THREE.Color(h);
  const dayFog = C(sky.fog), twFog = C(sky.horizon).multiplyScalar(0.3), nightFog = C('#0b0c11'), moonFog = C('#1a2030');
  const daySun = C(sky.sun), lowSun = C('#ffc79a');
  const hemiSkyD = C(sky.hemiSky), hemiSkyN = C('#4c5a7e'), hemiGndD = C(sky.hemiGround), hemiGndN = C('#1d1512');
  const tmp = new THREE.Color(), tmp2 = new THREE.Color(), _v = new THREE.Vector3();
  const moonL = new THREE.DirectionalLight(0xa9bbdf, 0); scene.add(moonL, moonL.target);
  const A = {
    sunDir, wind, devils, day: 1, night: 0, tw: 0, moonK: 0, exposure: sky.exposure, windLevel: 0.1, buffet: 0,
    get hour() { return st.hour; }, setHour(h) { st.hour = h; },
    clock() { const h = Math.floor(st.hour), m = Math.floor((st.hour - h) * 60); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; },
    update(dt, focus, cam) {
      st.t += dt; st.hour = (st.hour + dt * st.rate) % 24; sunAt(st.hour, sunDir);
      const sy = sunDir.y, day = sstep(-0.06, 0.22, sy), tw = sstep(-0.34, -0.02, sy) * (1 - sstep(0.05, 0.4, sy)), night = 1 - sstep(-0.1, 0.05, sy);
      A.day = day; A.tw = tw; A.night = night;
      // moons: position, phase, and the light they throw
      const hrs = st.t * st.rate; let kP = 0, kD = 0;
      for (const [m, h, base] of [[phobos, hP0 - hrs * 2 * Math.PI / 11.1, 1], [deimos, hD0 + hrs * 2 * Math.PI / 131, 0.6]]) {
        eqAt(h, _v); m.visible = _v.y > -0.05; m.position.copy(cam.position).addScaledVector(_v, 3500); m.rotation.y = h;
        m.material.uniforms.alpha.value = clamp(1 - day * 0.8, 0.12, 1) * base + (1 - base) * (1 - day);
        const k = sstep(-0.02, 0.14, _v.y) * (1 - _v.dot(sunDir)) / 2;
        if (m === phobos) { kP = k; if (k > 0.01) U.moonDir.value.copy(_v); } else { kD = k; if (kP < 0.05 && k > 0.01) U.moonDir.value.copy(_v); }
      }
      const moonK = clamp(kP + kD * 0.35, 0, 1) * night * (1 - dust * 0.5); A.moonK = moonK; U.moonK.value = moonK;
      moonL.intensity = night * (0.45 + 0.6 * kP + 0.15 * kD) * (1 - dust * 0.4);
      _v.copy(U.moonDir.value); if (_v.y < 0.2) _v.y = 0.2; moonL.position.copy(focus).addScaledVector(_v.normalize(), 300); moonL.target.position.copy(focus);
      U.time.value = st.t; U.camPos.value.copy(cam.position); skyMesh.position.copy(cam.position);
      sun.intensity = sky.sunI * sstep(-0.03, 0.1, sy) * lerp(0.6, 1, sstep(0.05, 0.5, sy));
      sun.color.copy(lowSun).lerp(daySun, sstep(0.02, 0.35, sy));
      hemi.intensity = lerp(0.55 + 0.22 * moonK, sky.hemiI, day) + tw * 0.14;
      hemi.color.copy(hemiSkyN).lerp(hemiSkyD, day); hemi.groundColor.copy(hemiGndN).lerp(hemiGndD, day);
      tmp.copy(nightFog).lerp(moonFog, moonK * 0.6).lerp(tmp2.copy(twFog).lerp(dayFog, day), clamp(day + tw * 0.9, 0, 1));
      scene.fog.color.copy(tmp); scene.background.copy(tmp);
      A.exposure = lerp(2.05, sky.exposure, day);
      // wind
      const t = st.t, aft = 0.7 + 0.55 * sstep(9, 13, st.hour) * (1 - sstep(16, 19, st.hour));
      gust = clamp(1 + 0.35 * Math.sin(t * 0.21) + 0.25 * Math.sin(t * 0.53 + 1.3) + 0.2 * Math.sin(t * 1.7 + 4.1), 0.3, 1.9);
      const sp = wBase * gust * aft; wind.set(wdir.x * sp, 0, wdir.y * sp);
      for (let i = 0; i < SN; i++) {
        let x = spos[i * 3] + wind.x * 1.7 * dt, z = spos[i * 3 + 2] + wind.z * 1.7 * dt;
        if (x - focus.x > 70) x -= 140; if (x - focus.x < -70) x += 140; if (z - focus.z > 70) z -= 140; if (z - focus.z < -70) z += 140;
        spos[i * 3] = x; spos[i * 3 + 2] = z; spos[i * 3 + 1] = heightAt(x, z) + 0.15 + (i % 9) * 0.22 + Math.sin(t * 3 + i) * 0.12;
      }
      sgeo.attributes.position.needsUpdate = true;
      smat.opacity = clamp(0.03 + (gust - 0.85) * 0.35, 0.02, 0.4) * (dust ? 1.8 : 1) * (0.25 + 0.75 * day);
      // dust devils: daytime convection only
      const act = sstep(9.5, 11, st.hour) * (1 - sstep(16, 17.5, st.hour)) * (dust ? 0 : 1);
      let buf = 0;
      for (const d of devils) {
        if (!d.init) respawn(d, focus, true);
        d.age += dt; const px = -wdir.y, pz = wdir.x, mw = Math.sin(d.age * 0.25 + d.ph) * 3;
        d.x += (wind.x * 0.9 + px * mw) * dt; d.z += (wind.z * 0.9 + pz * mw) * dt;
        const dist = Math.hypot(d.x - focus.x, d.z - focus.z);
        if (d.age > d.life || dist > 950) respawn(d, focus, false);
        const fade = sstep(0, 8, d.age) * (1 - sstep(d.life - 8, d.life, d.age)) * act;
        const y = heightAt(d.x, d.z) - 0.5, col = tmp.copy(U.horizon.value).multiplyScalar(0.55 + 0.6 * day);
        d.a.position.set(d.x, y, d.z); d.a.scale.set(d.r, d.h, d.r); d.a.rotation.z = 0.06 * gust;
        d.b.position.set(d.x, y, d.z); d.b.scale.set(d.r * 0.9, 9, d.r * 0.9);
        for (const [m, k] of [[d.a, 0.5], [d.b, 0.75]]) { const u = m.material.uniforms; u.time.value = t; u.a.value = fade * k; u.spin.value = d.spin; u.col.value.copy(col); m.visible = fade > 0.01; }
        const R = d.r * 0.6 + 7; if (dist < R) buf = Math.max(buf, (1 - dist / R) * fade);
      }
      A.buffet = buf;
      A.windLevel = clamp(0.05 + sp * 0.02 + buf * 0.35, 0, 0.6);
    },
  };
  return A;
}
