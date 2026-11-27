import { THREE, GLTFLoader, cloneSkinned, ASSET } from './lib.js?v=19';

const gltfLoader = new GLTFLoader();
const texLoader = new THREE.TextureLoader();
const cache = new Map();
let listeners = new Set();
let pending = 0, done = 0;
const track = (p, label) => {
  pending++; notify(label);
  return p.then((v) => { done++; notify(label); return v; }, (e) => { done++; notify(label); throw e; });
};
function notify(label) { for (const f of listeners) f({ p: pending ? done / pending : 1, label }); }
export function onProgress(f) { listeners.add(f); return () => listeners.delete(f); }
export function resetProgress() { pending = 0; done = 0; }

export function loadGLTF(name) {
  if (!cache.has('g:' + name)) cache.set('g:' + name, track(gltfLoader.loadAsync(ASSET('models/' + name + '.glb')), 'Loading ' + name.replace(/_/g, ' ')));
  return cache.get('g:' + name);
}
export function loadTex(path, { srgb = true, repeat = false, aniso = 8 } = {}) {
  const key = 't:' + path;
  if (!cache.has(key)) cache.set(key, track(texLoader.loadAsync(ASSET(path)), 'Loading textures').then((t) => {
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
    t.anisotropy = aniso;
    return t;
  }));
  return cache.get(key);
}
export function loadHeight(name) {
  const key = 'h:' + name;
  if (!cache.has(key)) cache.set(key, track(new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => {
      const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
      const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
      const px = g.getImageData(0, 0, im.width, im.height).data;
      const data = new Float32Array(im.width * im.height);
      for (let i = 0; i < data.length; i++) data[i] = (px[i * 4] * 256 + px[i * 4 + 1]) / 65535;
      res({ w: im.width, h: im.height, data });
    };
    im.onerror = rej; im.src = ASSET('terrain/' + name + '.png');
  }), 'Reading HiRISE terrain'));
  return cache.get(key);
}

const LIVERIES = {
  factory: null,
  union: { tint: new THREE.Color(0.66, 0.55, 0.38), amt: 0.82 },
  ash: { tint: new THREE.Color(0.7, 0.71, 0.72), amt: 0.75 },
  darken: { tint: new THREE.Color(0.2, 0.2, 0.22), amt: 0.93 },
};
const tintCache = new Map();
function tintMat(mat, liv) {
  const key = mat.uuid + ':' + liv;
  if (tintCache.has(key)) return tintCache.get(key);
  const L = LIVERIES[liv];
  const m = mat.clone();
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTint = { value: L.tint }; sh.uniforms.uAmt = { value: L.amt };
    sh.fragmentShader = 'uniform vec3 uTint; uniform float uAmt;\n' + sh.fragmentShader.replace('#include <map_fragment>',
      '#include <map_fragment>\n{ float l = dot(diffuseColor.rgb, vec3(0.299,0.587,0.114)); diffuseColor.rgb = mix(diffuseColor.rgb, uTint * (0.3 + l * 1.7), uAmt); }');
  };
  m.customProgramCacheKey = () => 'liv-' + liv;
  tintCache.set(key, m);
  return m;
}

const fixedClips = new WeakSet();
// Some of the Striker's clips store the pelvis offset Z-up while the rest of the rig is Y-up; rotate those keys into place.
function fixClips(clips) {
  for (const c of clips) {
    if (fixedClips.has(c)) continue; fixedClips.add(c);
    for (const t of c.tracks) {
      if (/LowerTorso_07\.quaternion$/.test(t.name)) {
        const v = t.values;
        if (Math.abs(v[3]) < 0.2 && Math.abs(v[1]) < 0.2) {
          const C = new THREE.Quaternion(0.5, 0.5, 0.5, -0.5), q = new THREE.Quaternion();
          for (let i = 0; i < v.length; i += 4) { q.set(v[i], v[i + 1], v[i + 2], v[i + 3]).premultiply(C); v[i] = q.x; v[i + 1] = q.y; v[i + 2] = q.z; v[i + 3] = q.w; }
        }
        continue;
      }
      if (!/LowerTorso_07\.position$/.test(t.name)) continue;
      const v = t.values, n = v.length / 3; let my = 0, mz = 0;
      for (let i = 0; i < n; i++) { my += v[i * 3 + 1] / n; mz += v[i * 3 + 2] / n; }
      if (mz > 3 && Math.abs(my) < 2) for (let i = 0; i < n; i++) { const y = v[i * 3 + 1], z = v[i * 3 + 2]; v[i * 3 + 1] = z; v[i * 3 + 2] = -y; }
    }
  }
}

const templates = new Map();
// Builds a normalized template: feet on y=0, centered, facing +Z, sized to `height` or `length` metres.
export async function getTemplate(name, { height, length, yaw = 0, idle }) {
  const key = name + '|' + height + '|' + length + '|' + yaw;
  if (templates.has(key)) return templates.get(key);
  const g = await loadGLTF(name);
  fixClips(g.animations);
  const inner = g.animations.length ? cloneSkinned(g.scene) : g.scene.clone(true);
  inner.rotation.y = yaw;
  let mixer;
  if (idle && g.animations.length) { mixer = new THREE.AnimationMixer(inner); const clip = g.animations.find((a) => a.name === idle); if (clip) { mixer.clipAction(clip).play(); mixer.update(0.3); } }
  inner.traverse((o) => { if (o.isMesh && o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) { if (m.map) m.map.anisotropy = 8; } } });
  inner.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(inner, true);
  const sz = b.getSize(new THREE.Vector3());
  const k = height ? height / sz.y : length / Math.max(sz.x, sz.z);
  if (mixer) { mixer.stopAllAction(); mixer.uncacheRoot(inner); }
  inner.scale.multiplyScalar(k);
  inner.position.set(-(b.min.x + sz.x / 2) * k, -b.min.y * k, -(b.min.z + sz.z / 2) * k);
  const wrap = new THREE.Group(); wrap.add(inner);
  wrap.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = !o.isSkinnedMesh; } });
  const t = { object: wrap, animations: g.animations, size: sz.clone().multiplyScalar(k), skinned: g.animations.length > 0 };
  templates.set(key, t);
  return t;
}
export function instantiate(t, livery) {
  const o = t.skinned ? cloneSkinned(t.object) : t.object.clone(true);
  if (livery && LIVERIES[livery]) o.traverse((m) => { if (m.isMesh) m.material = Array.isArray(m.material) ? m.material.map((x) => tintMat(x, livery)) : tintMat(m.material, livery); });
  return o;
}
export function darkenWreck(o) {
  o.traverse((m) => {
    if (!m.isMesh) return;
    const f = (x) => { const c = x.clone(); c.onBeforeCompile = x.onBeforeCompile; c.customProgramCacheKey = x.customProgramCacheKey; if (c.color) c.color.multiplyScalar(0.22); if (c.emissive) c.emissive.setScalar(0); c.emissiveIntensity = 0; c.roughness = 1; return c; };
    m.material = Array.isArray(m.material) ? m.material.map(f) : f(m.material);
  });
}
export const LIVERY_IDS = ['factory', 'union', 'ash'];
