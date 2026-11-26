/**
 * Custom shader materials. Every one includes three's logarithmic-depth
 * chunks, because the game renders from 0.3 to millions of units with a
 * log depth buffer — without them, occlusion breaks.
 */
import * as THREE from 'three';

const LOG_V_PARS = '#include <common>\n#include <logdepthbuf_pars_vertex>\n';
const LOG_V = '#include <logdepthbuf_vertex>\n';
const LOG_F_PARS = '#include <common>\n#include <logdepthbuf_pars_fragment>\n';
const LOG_F = '#include <logdepthbuf_fragment>\n';

/** Rim-lit atmosphere shell: bright toward the limb, only on the day side. */
export function atmosphereMaterial(color: string, strength: number) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uSun: { value: new THREE.Vector3(1, 0, 0) }, uStrength: { value: strength } },
    vertexShader: LOG_V_PARS + `
      varying vec3 vN; varying vec3 vV;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
        ` + LOG_V + `
      }`,
    fragmentShader: LOG_F_PARS + `
      uniform vec3 uColor; uniform vec3 uSun; uniform float uStrength;
      varying vec3 vN; varying vec3 vV;
      void main() {
        ` + LOG_F + `
        float ndv = max(dot(vN, vV), 0.0);
        float fres = pow(1.0 - ndv, 2.6);
        float lit = smoothstep(-0.35, 0.55, dot(vN, uSun));
        float a = (fres * 1.25 + 0.06) * lit * uStrength;
        gl_FragColor = vec4(uColor * a, a);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}

/** Energy bubble (base shield, player shield flash). */
export function shieldMaterial(color: string) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0.6 }, uTime: { value: 0 } },
    vertexShader: LOG_V_PARS + `
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - wp.xyz);
        vP = position;
        gl_Position = projectionMatrix * viewMatrix * wp;
        ` + LOG_V + `
      }`,
    fragmentShader: LOG_F_PARS + `
      uniform vec3 uColor; uniform float uOpacity; uniform float uTime;
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main() {
        ` + LOG_F + `
        float fres = pow(1.0 - abs(dot(vN, vV)), 2.2);
        float hex = 0.5 + 0.5 * sin(vP.x * 0.35 + uTime * 1.3) * sin(vP.y * 0.35 - uTime) * sin(vP.z * 0.35 + uTime * 0.7);
        float a = (fres * 0.9 + hex * 0.12) * uOpacity;
        gl_FragColor = vec4(uColor * a, a);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
}

/** Catalogued stars as round points; size + brightness from real magnitude. */
export function starMaterial(pixelRatio: number) {
  return new THREE.ShaderMaterial({
    uniforms: { uPR: { value: pixelRatio }, uFade: { value: 1 } },
    vertexShader: LOG_V_PARS + `
      attribute float aMag; attribute vec3 aCol;
      varying vec3 vCol; varying float vA;
      uniform float uPR; uniform float uFade;
      void main() {
        vCol = aCol;
        float m = aMag;
        vA = clamp(1.35 - 0.14 * m, 0.12, 1.0) * uFade;
        gl_PointSize = clamp(3.4 - 0.36 * m, 0.9, 4.2) * uPR;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        ` + LOG_V + `
      }`,
    fragmentShader: LOG_F_PARS + `
      varying vec3 vCol; varying float vA;
      void main() {
        ` + LOG_F + `
        vec2 d = gl_PointCoord - 0.5;
        float r = dot(d, d) * 4.0;
        float a = vA * exp(-r * 3.2);
        if (a < 0.01) discard;
        gl_FragColor = vec4(vCol * a, a);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}

/**
 * The real Milky Way (Serge Brunier's all-sky photograph, galactic coords),
 * sampled through the true J2000 galactic basis in the equatorial frame.
 * Same mapping as components/universe-engine/sky-panorama.tsx.
 */
export function panoramaMaterial(map: THREE.Texture, gx: THREE.Vector3, gy: THREE.Vector3, gz: THREE.Vector3, opacity: number) {
  return new THREE.ShaderMaterial({
    uniforms: { uMap: { value: map }, uGalX: { value: gx }, uGalY: { value: gy }, uGalZ: { value: gz }, uOpacity: { value: opacity } },
    vertexShader: LOG_V_PARS + `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        ` + LOG_V + `
      }`,
    fragmentShader: LOG_F_PARS + `
      uniform sampler2D uMap; uniform vec3 uGalX; uniform vec3 uGalY; uniform vec3 uGalZ; uniform float uOpacity;
      varying vec3 vDir;
      void main() {
        ` + LOG_F + `
        vec3 d = normalize(vDir);
        float lon = atan(dot(d, uGalY), dot(d, uGalX));
        float lat = asin(clamp(dot(d, uGalZ), -1.0, 1.0));
        vec2 uv = vec2(0.5 - lon / 6.28318530718, 0.5 + lat / 3.14159265359);
        vec3 c = texture2D(uMap, uv).rgb;
        c = max(c - 0.035, 0.0) * 1.15;
        gl_FragColor = vec4(c * uOpacity, 1.0);
      }`,
    side: THREE.BackSide, depthWrite: false,
  });
}
