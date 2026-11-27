// The real sky around Mars, for right now: NASA SVS Deep Star Maps 2020 Milky Way (Gaia/Hipparcos/Tycho), 9,096 Yale Bright Star Catalogue stars,
// the Sun at its true size from Mars, and the planets placed with JPL Keplerian elements (Standish, 1800–2050). Everything sits in the J2000
// equatorial frame, rotated onto the globe with the IAU Mars pole and prime meridian, so the terminator on the globe is today's.
import { THREE } from './lib.js?v=19';
import { loadTex } from './assets.js?v=19';

const D = Math.PI / 180, EPS = 23.43928 * D, AU_KM = 149597870.7;
const EL = { // a, e, I, L, varpi, Omega  +  rates per Julian century
  Mercury: [0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593, 0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081],
  Venus: [0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255, 0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418],
  Earth: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0, 0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0],
  Mars: [1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891, 0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343],
  Jupiter: [5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909, -0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106],
  Saturn: [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448, -0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794],
  Uranus: [19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.95427630, 74.01692503, -0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589],
  Neptune: [30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574, 0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664],
};
const LOOK = { Mercury: [-0.42, 0x9c968e], Venus: [-4.40, 0xfff1d6], Earth: [-3.86, 0x9cc6ff], Jupiter: [-9.40, 0xffe9c8], Saturn: [-8.88, 0xf2dca6], Uranus: [-7.19, 0xc8f0f4], Neptune: [-6.87, 0x9fb8ff] };

function helio(name, T) { // heliocentric J2000 equatorial position, AU
  const E0 = EL[name], [a, e, I, L, w, O] = E0.slice(0, 6).map((v, i) => v + E0[i + 6] * T);
  const M = ((L - w) % 360 + 540) % 360 - 180, om = (w - O) * D, Mr = M * D;
  let E = Mr + e * Math.sin(Mr); for (let k = 0; k < 8; k++) E -= (E - e * Math.sin(E) - Mr) / (1 - e * Math.cos(E));
  const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cw = Math.cos(om), sw = Math.sin(om), cO = Math.cos(O * D), sO = Math.sin(O * D), cI = Math.cos(I * D), sI = Math.sin(I * D);
  const x = (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp, y = (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp, z = sw * sI * xp + cw * sI * yp;
  return new THREE.Vector3(x, y * Math.cos(EPS) - z * Math.sin(EPS), y * Math.sin(EPS) + z * Math.cos(EPS));
}
const eqVec = (raDeg, decDeg) => { const a = raDeg * D, d = decDeg * D; return new THREE.Vector3(Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)); };
function kelvin(K) { // blackbody tint, pulled toward white the way the eye sees stars
  const t = Math.max(1000, Math.min(40000, K)) / 100;
  const r = t <= 66 ? 255 : 329.7 * Math.pow(t - 60, -0.1332), g = t <= 66 ? 99.47 * Math.log(t) - 161.12 : 288.12 * Math.pow(t - 60, -0.0755), b = t >= 66 ? 255 : t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04;
  const c = new THREE.Color(Math.min(255, r) / 255, Math.min(255, Math.max(0, g)) / 255, Math.min(255, Math.max(0, b)) / 255);
  return c.lerp(new THREE.Color(1, 1, 1), 0.45);
}
// Equatorial → Mars body-fixed (IAU): Rz(W)·Rx(90°−δ0)·Rz(90°+α0)
function eqToBody(d) {
  const T = d / 36525, a0 = (317.68143 - 0.1061 * T) * D, d0 = (52.88650 - 0.0609 * T) * D, W = ((176.630 + 350.89198226 * d) % 360) * D;
  const Rz = (t) => new THREE.Matrix3().set(Math.cos(t), Math.sin(t), 0, -Math.sin(t), Math.cos(t), 0, 0, 0, 1);
  const Rx = (t) => new THREE.Matrix3().set(1, 0, 0, 0, Math.cos(t), Math.sin(t), 0, -Math.sin(t), Math.cos(t));
  return Rz(W).multiply(Rx(Math.PI / 2 - d0)).multiply(Rz(Math.PI / 2 + a0));
}

const STAR_VS = `attribute float aSize; attribute vec3 aCol; attribute float aA; uniform float uPR; varying vec3 vC; varying float vA;
void main(){ vC = aCol; vA = aA; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = aSize * uPR; }`;
const STAR_FS = `varying vec3 vC; varying float vA; void main(){ vec2 p = gl_PointCoord - 0.5; float r2 = dot(p, p) * 4.0; float k = exp(-r2 * 4.5) + 0.12 * exp(-r2 * 1.2); if (k < 0.01) discard; gl_FragColor = vec4(vC * k * vA, 1.0); }`;
const MW_VS = `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const MW_FS = `uniform sampler2D map; uniform float gain; varying vec3 vP;
void main(){ vec3 d = normalize(vP); float ra = atan(d.y, d.x), dec = asin(clamp(d.z, -1.0, 1.0));
  float u = 0.5 - ra / 6.2831853, v = 0.5 + dec / 3.1415927; float u1 = fract(u), u2 = fract(u + 0.5) - 0.5;
  vec2 g1 = vec2(dFdx(u1), dFdy(u1)), g2 = vec2(dFdx(u2), dFdy(u2)); bool b = dot(g1, g1) <= dot(g2, g2);
  vec2 dx = vec2(b ? g1.x : g2.x, dFdx(v)), dy = vec2(b ? g1.y : g2.y, dFdy(v));
  vec3 c = textureGrad(map, vec2(fract(u), v), dx, dy).rgb; c = max(c - vec3(0.018), vec3(0.0)) * gain; gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;

const glowTex = (() => { let t; return () => t || (t = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.06, 'rgba(255,248,236,0.9)'); gr.addColorStop(0.16, 'rgba(255,226,190,0.28)'); gr.addColorStop(0.45, 'rgba(255,190,140,0.06)'); gr.addColorStop(1, 'rgba(255,160,110,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256); const x = new THREE.CanvasTexture(c); x.colorSpace = THREE.SRGBColorSpace; return x; })()); })();

export async function buildCosmos(scene, renderer, toLocal, layer, date = new Date()) {
  const R = 600, root = new THREE.Group(); root.matrixAutoUpdate = false; scene.add(root);
  const d = date.getTime() / 86400000 + 2440587.5 - 2451545.0, T = d / 36525;
  // equatorial → world: world = toLocal · eqToBody
  const B = eqToBody(d), m3 = toLocal.clone().multiply(B), m = new THREE.Matrix4().setFromMatrix3(m3); root.matrix.copy(m); root.matrixWorldNeedsUpdate = true;
  const [mwTex, stars] = await Promise.all([loadTex('tex/milkyway.jpg'), fetch(new URL('./stars.json', import.meta.url)).then((r) => r.json())]);
  mwTex.generateMipmaps = true; mwTex.minFilter = THREE.LinearMipmapLinearFilter; mwTex.anisotropy = 8;
  const mw = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 48), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: { map: { value: mwTex }, gain: { value: 1.05 } }, vertexShader: MW_VS, fragmentShader: MW_FS }));
  mw.renderOrder = -10; mw.frustumCulled = false; root.add(mw);
  const n = stars.length / 4, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n), al = new Float32Array(n);
  const addStar = (i, v, mag, c) => { v.multiplyScalar(R * 0.98).toArray(pos, i * 3); const f = Math.pow(10, -0.4 * (mag - 6)); size[i] = Math.min(9, 1.5 + 0.8 * Math.pow(f, 0.25)); al[i] = Math.min(1.4, 0.22 + 0.32 * Math.sqrt(f)); c.toArray(col, i * 3); };
  for (let i = 0; i < n; i++) addStar(i, eqVec(stars[i * 4], stars[i * 4 + 1]), stars[i * 4 + 2], kelvin(stars[i * 4 + 3]));
  const mkPoints = (p, c, s, a) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aCol', new THREE.BufferAttribute(c, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(s, 1)); g.setAttribute('aA', new THREE.BufferAttribute(a, 1));
    const pts = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: { uPR: { value: renderer.getPixelRatio() } }, vertexShader: STAR_VS, fragmentShader: STAR_FS, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    pts.frustumCulled = false; pts.renderOrder = -9; root.add(pts); return pts; };
  const starPts = mkPoints(pos, col, size, al);
  // Sun and planets from Mars, today
  const mars = helio('Mars', T), sunEq = mars.clone().negate(), rM = sunEq.length(); sunEq.normalize();
  const sunAng = 2 * Math.atan(695700 / (rM * AU_KM)); // ≈ 0.35° at 1.52 AU
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  core.scale.setScalar(R * Math.tan(sunAng) * 9); core.position.copy(sunEq).multiplyScalar(R * 0.95); root.add(core);
  const glare = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xffd9b0, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  glare.scale.setScalar(R * 0.22); glare.position.copy(core.position); root.add(glare);
  const names = Object.keys(LOOK), pp = new Float32Array(names.length * 3), pc = new Float32Array(names.length * 3), ps = new Float32Array(names.length), pa = new Float32Array(names.length), planets = [];
  names.forEach((nm, i) => {
    const h = helio(nm, T), v = h.clone().sub(mars), del = v.length(), r = h.length(); v.normalize();
    const ph = Math.acos(Math.max(-1, Math.min(1, h.clone().normalize().dot(h.clone().sub(mars).normalize())))) / D;
    const mag = LOOK[nm][0] + 5 * Math.log10(r * del) + (nm === 'Mercury' || nm === 'Venus' || nm === 'Earth' ? 0.016 * ph : 0.005 * ph);
    addStarTo(pp, pc, ps, pa, i, v.clone(), mag, new THREE.Color(LOOK[nm][1]));
    planets.push({ name: nm, dir: v, mag, dist: del });
  });
  function addStarTo(P, C, S, A, i, v, mag, c) { v.multiplyScalar(R * 0.97).toArray(P, i * 3); const f = Math.pow(10, -0.4 * (mag - 6)); S[i] = Math.min(11, 2.2 + 0.9 * Math.pow(f, 0.25)); A[i] = Math.min(1.6, 0.3 + 0.35 * Math.sqrt(f)); c.toArray(C, i * 3); }
  mkPoints(pp, pc, ps, pa);
  // Labels: the Sun and naked-eye planets
  const labels = [];
  if (layer) for (const p of [{ name: 'Sun', dir: sunEq, mag: -26 }, ...planets.filter((p) => p.mag < 6)]) {
    const el = document.createElement('span'); el.textContent = p.name === 'Sun' ? 'Sun' : `${p.name} · ${p.dist.toFixed(2)} AU`;
    el.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;font-family:var(--font-heading);font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:rgba(242,242,243,.55);white-space:nowrap;visibility:hidden;text-shadow:0 1px 2px #000';
    layer.appendChild(el); labels.push({ el, dir: p.dir });
  }
  const sunWorld = sunEq.clone().applyMatrix3(m3).normalize(), v = new THREE.Vector3(), w = new THREE.Vector3();
  return {
    sunWorld, planets, date, m3, eqVec,
    update(camera, wpx, hpx, show) {
      camera.getWorldDirection(w);
      for (const L of labels) {
        v.copy(L.dir).applyMatrix3(m3).normalize(); const cp = camera.position, b = cp.dot(v), hit = b < 0 && b * b - (cp.lengthSq() - 1.07) > 0, facing = v.dot(w) > 0.2 && !hit; v.multiplyScalar(R * 0.9).add(camera.position).project(camera);
        const vis = show && facing && Math.abs(v.x) < 1 && Math.abs(v.y) < 1;
        L.el.style.visibility = vis ? 'visible' : 'hidden'; if (vis) L.el.style.transform = `translate(${((v.x + 1) / 2 * wpx + 8).toFixed(1)}px, ${((1 - v.y) / 2 * hpx - 5).toFixed(1)}px)`;
      }
    },
    hide() { for (const L of labels) L.el.style.visibility = 'hidden'; },
  };
}
