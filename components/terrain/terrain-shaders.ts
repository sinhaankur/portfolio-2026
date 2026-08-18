/**
 * Terrain engine — GLSL.
 *
 * A displaced-sphere terrain shader: the vertex shader samples a real 16-bit
 * elevation map and pushes each vertex out along its normal by the true
 * elevation (× a labelled exaggeration). The fragment shader combines the body's
 * colour map with slope-shading and an optional hypsometric (elevation) tint so
 * relief reads clearly — the mountains you see are the measured mountains.
 *
 * Pure GLSL, no meshes (ENGINE-STANDARDS: GLSL-first). The height map is decoded
 * to real metres in-shader: metresAbove = uElevMinM + h * (uElevMaxM - uElevMinM),
 * where h is the normalised 0..1 sample.
 */

export const terrainVertexShader = /* glsl */ `
uniform sampler2D uHeightMap;
uniform float uElevMinM;      // real min elevation (m) encoded at h=0
uniform float uElevMaxM;      // real max elevation (m) encoded at h=1
uniform float uRadiusUnits;   // sphere radius in scene units
uniform float uRadiusKm;      // body radius in km (for real m→unit scaling)
uniform float uExaggeration;  // vertical exaggeration (labelled in the HUD)

varying vec2 vUv;
varying float vElevM;         // real elevation at this vertex, metres
varying float vNormAmt;       // normalised 0..1 elevation (for hypsometric tint)
varying vec3 vWorldNormal;

// Decode the packed height sample → normalised 0..1 relief.
float sampleHeight(vec2 uv) {
  return texture2D(uHeightMap, uv).r;
}

void main() {
  vUv = uv;
  float h = sampleHeight(uv);
  vNormAmt = h;

  // Real elevation in metres, then into scene units at the body's true scale.
  float elevM = mix(uElevMinM, uElevMaxM, h);
  vElevM = elevM;
  float unitsPerMetre = uRadiusUnits / (uRadiusKm * 1000.0);
  float displaceUnits = elevM * unitsPerMetre * uExaggeration;

  // Push the base sphere vertex outward along its (unit) normal.
  vec3 dir = normalize(position);
  vec3 displaced = position + dir * displaceUnits;

  vWorldNormal = normalize(mat3(modelMatrix) * dir);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
}
`

export const terrainFragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D uColorMap;
uniform sampler2D uHeightMap;
uniform float uElevMinM;
uniform float uElevMaxM;
uniform vec3 uSunDir;         // world-space light direction
uniform float uHypsometric;  // 0..1 blend of elevation tint over the colour map
uniform float uSlopeShade;   // 0..1 strength of slope/relief shading
uniform vec2 uTexel;         // 1/width, 1/height of the height map (for gradients)
uniform float uAmbient;      // base fill so night side isn't pure black

varying vec2 vUv;
varying float vElevM;
varying float vNormAmt;
varying vec3 vWorldNormal;

// Hypsometric palette: deep basins → blue-grey, lowlands → tan, highlands →
// warm ochre, peaks → near-white. A neutral scientific ramp that works across
// bodies; it's an OVERLAY, off by default, so the true colour map leads.
vec3 hypsometric(float t) {
  vec3 c0 = vec3(0.10, 0.18, 0.30);  // deepest
  vec3 c1 = vec3(0.35, 0.30, 0.26);  // basin
  vec3 c2 = vec3(0.62, 0.45, 0.30);  // lowland
  vec3 c3 = vec3(0.80, 0.62, 0.42);  // highland
  vec3 c4 = vec3(0.95, 0.92, 0.88);  // peak
  if (t < 0.25) return mix(c0, c1, t / 0.25);
  if (t < 0.50) return mix(c1, c2, (t - 0.25) / 0.25);
  if (t < 0.75) return mix(c2, c3, (t - 0.50) / 0.25);
  return mix(c3, c4, (t - 0.75) / 0.25);
}

// Reconstruct a surface normal from the height field via finite differences so
// slopes catch the light even where the base geometry is coarse. Scale is
// intentionally in "relief units", not physical — it's a shading cue.
vec3 reliefNormal() {
  float hL = texture2D(uHeightMap, vUv - vec2(uTexel.x, 0.0)).r;
  float hR = texture2D(uHeightMap, vUv + vec2(uTexel.x, 0.0)).r;
  float hD = texture2D(uHeightMap, vUv - vec2(0.0, uTexel.y)).r;
  float hU = texture2D(uHeightMap, vUv + vec2(0.0, uTexel.y)).r;
  float s = 4.0; // relief strength
  vec3 n = normalize(vec3((hL - hR) * s, (hD - hU) * s, 1.0));
  return n;
}

void main() {
  vec3 base = texture2D(uColorMap, vUv).rgb;

  // Optional hypsometric overlay (elevation-tinted), blended over true colour.
  vec3 col = mix(base, mix(base, hypsometric(vNormAmt), 0.65), uHypsometric);

  // Directional light on the true surface normal.
  float lambert = max(dot(normalize(vWorldNormal), normalize(uSunDir)), 0.0);

  // Slope/relief shading: darken slopes facing away from the sun, brighten those
  // facing it, using the reconstructed relief normal projected toward the light.
  vec3 rn = reliefNormal();
  float slope = clamp(rn.x * 0.5 + 0.5, 0.0, 1.0);
  float relief = mix(1.0, mix(0.75, 1.25, slope), uSlopeShade);

  float light = uAmbient + (1.0 - uAmbient) * lambert;
  gl_FragColor = vec4(col * light * relief, 1.0);
}
`
