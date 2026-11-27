// Film look for missions: soft bloom on hot things, a warm grade, vignette, light grain. Falls back to a plain render if anything fails to load.
import { THREE } from './lib.js?v=18';

const BASE = 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/';
const GRADE = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVig: { value: 0.32 }, uGrain: { value: 0.035 }, uWarm: { value: 1 }, uNight: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uVig, uGrain, uWarm, uNight; varying vec2 vUv;
  float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main(){
    vec2 d = vUv - 0.5; float r2 = dot(d, d);
    vec3 c; c.r = texture2D(tDiffuse, vUv + d * 0.0016).r; c.g = texture2D(tDiffuse, vUv).g; c.b = texture2D(tDiffuse, vUv - d * 0.0016).b;
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    vec3 sh = vec3(0.92, 0.98, 1.08), hi = vec3(1.06, 0.99, 0.9);
    c *= mix(mix(vec3(1.0), sh, 1.0 - smoothstep(0.0, 0.45, l)), hi, smoothstep(0.45, 1.0, l)) * uWarm + (1.0 - uWarm);
    c = mix(vec3(l), c, 1.06 - uNight * 0.18);
    c = (c - 0.5) * 1.05 + 0.5;
    c *= 1.0 - uVig * smoothstep(0.08, 0.62, r2 * 1.6);
    c += (h(vUv * 1024.0 + fract(uTime * 7.31)) - 0.5) * uGrain * (0.6 + uNight);
    gl_FragColor = vec4(max(c, 0.0), 1.0);
  }`,
};

export async function makePost(renderer) {
  try {
    const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { ShaderPass }, { OutputPass }] = await Promise.all(
      ['EffectComposer', 'RenderPass', 'UnrealBloomPass', 'ShaderPass', 'OutputPass'].map((n) => import(BASE + n + '.js/+esm')));
    const size = renderer.getSize(new THREE.Vector2());
    const composer = new EffectComposer(renderer); const rp = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
    const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.3, 0.45, 1.6);
    const out = new OutputPass(), grade = new ShaderPass(GRADE);
    composer.addPass(rp); composer.addPass(bloom); composer.addPass(out); composer.addPass(grade);
    let t = 0;
    return {
      setSize(w, h, pr) { composer.setPixelRatio(pr); composer.setSize(w, h); },
      render(scene, camera, dt, night = 0) { rp.scene = scene; rp.camera = camera; t += dt; grade.uniforms.uTime.value = t; grade.uniforms.uNight.value = night; bloom.strength = 0.28 + night * 0.08; composer.render(dt); },
    };
  } catch (e) { console.warn('post-processing unavailable', e); return null; }
}
