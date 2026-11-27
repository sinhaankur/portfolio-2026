// Real horizon: MOLA heights (NASA Goddard, 4 px/degree) around the actual landing site, out to 160 km,
// dropped for the planet's curvature and folded into a shell just inside the sky so angles stay true.
import { THREE, fbm } from './lib.js?v=18';

let molaP = null;
const loadMola = () => molaP || (molaP = fetch(new URL('./mola.json', import.meta.url)).then((r) => r.json()).catch(() => ({})));
const R_M = 3389500, DEG = R_M * Math.PI / 180;

const VS = `attribute float aD; varying vec3 vN; varying float vD; varying float vH;
void main(){ vN = normalize(normalMatrix * normal); vD = aD; vH = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FS = `uniform vec3 sunDir, sunCol, skyCol, gndCol, fogCol, base; uniform float near, hazeD, fogK; varying vec3 vN; varying float vD; varying float vH;
void main(){
  vec3 n = normalize(vN); vec3 L = normalize((viewMatrix * vec4(sunDir, 0.0)).xyz);
  float dif = max(dot(n, L), 0.0); float up = dot(n, normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz)) * 0.5 + 0.5;
  vec3 c = base * (sunCol * dif + mix(gndCol, skyCol, up));
  float f0 = 1.0 - exp(-pow(fogK * min(vD, near), 2.0)), f = 1.0 - (1.0 - f0) * exp(-max(vD - near, 0.0) / hazeD);
  gl_FragColor = vec4(mix(c, fogCol, clamp(f, 0.0, 0.985)), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export async function buildHorizon(scene, L, heightAt, fogK, { sun, hemi }) {
  const db = await loadMola(), P = db[L.site] || db[L.stationName]; if (!P) return null;
  const lat0 = L.lat, lon0 = L.lon, cl = Math.cos(lat0 * Math.PI / 180);
  const mola = (lat, lon) => {
    const fx = (lon + 180) * 4 - 0.5 - P.x0, fy = (90 - lat) * 4 - 0.5 - P.y0, n = P.n;
    const ix = Math.max(0, Math.min(n - 2, Math.floor(fx))), iy = Math.max(0, Math.min(n - 2, Math.floor(fy))), tx = Math.min(1, Math.max(0, fx - ix)), ty = Math.min(1, Math.max(0, fy - iy));
    const g = (x, y) => P.d[y * n + x];
    return (g(ix, iy) * (1 - tx) + g(ix + 1, iy) * tx) * (1 - ty) + (g(ix, iy + 1) * (1 - tx) + g(ix + 1, iy + 1) * tx) * ty;
  };
  const h0 = mola(lat0, lon0), NA = 192, NR = 56, D0 = 1120, D1 = 160000, E = 1200;
  const pos = new Float32Array(NA * NR * 3), dist = new Float32Array(NA * NR), idx = [];
  for (let r = 0; r < NR; r++) {
    const d = D0 * Math.pow(D1 / D0, r / (NR - 1)), rr = d < 2600 ? d : 2600 + 1150 * (1 - Math.exp(-(d - 2600) / 45000)), s = rr / d;
    for (let a = 0; a < NA; a++) {
      const th = a / NA * Math.PI * 2, x = Math.cos(th) * d, z = Math.sin(th) * d;
      const lat = lat0 - z / DEG, lon = lon0 + x / (DEG * cl);
      const ex = Math.max(-E, Math.min(E, x)), ez = Math.max(-E, Math.min(E, z)), edge = heightAt(ex, ez) - 8;
      let h = mola(lat, lon) - h0 + (fbm(x / 9000, z / 9000, 4, 17) - 0.5) * (60 + d * 0.006) - d * d / (2 * R_M);
      const k = Math.min(1, Math.max(0, (d - D0) / 5000)); h = edge * (1 - k) + h * k;
      const i = r * NA + a; pos[i * 3] = x * s; pos[i * 3 + 1] = h * s; pos[i * 3 + 2] = z * s; dist[i] = d;
    }
  }
  for (let r = 0; r < NR - 1; r++) for (let a = 0; a < NA; a++) { const i = r * NA + a, j = r * NA + (a + 1) % NA, k = i + NA, l = j + NA; idx.push(i, k, j, j, k, l); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aD', new THREE.BufferAttribute(dist, 1)); geo.setIndex(idx); geo.computeVertexNormals();
  const U = { sunDir: { value: new THREE.Vector3() }, sunCol: { value: new THREE.Color() }, skyCol: { value: new THREE.Color() }, gndCol: { value: new THREE.Color() }, fogCol: { value: new THREE.Color() },
    base: { value: new THREE.Color(L.sky === 'dust' ? 0x9c6a4e : 0xa8684a) }, near: { value: E }, hazeD: { value: L.sky === 'dust' ? 14000 : 52000 }, fogK: { value: fogK } };
  const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: U, vertexShader: VS, fragmentShader: FS, fog: false }));
  mesh.frustumCulled = false; mesh.renderOrder = -1; scene.add(mesh);
  return {
    mesh,
    update(sunDir) { U.sunDir.value.copy(sunDir); U.sunCol.value.copy(sun.color).multiplyScalar(sun.intensity * 0.9); U.skyCol.value.copy(hemi.color).multiplyScalar(hemi.intensity * 0.8); U.gndCol.value.copy(hemi.groundColor).multiplyScalar(hemi.intensity * 0.8); U.fogCol.value.copy(scene.fog.color); U.fogK.value = scene.fog.density; },
  };
}
