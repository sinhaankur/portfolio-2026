/**
 * Universe Engine — GLSL shaders.
 *
 * The galaxy backdrop renders ~25k points with a custom shader so each star
 * gets its own size, alpha, color, and a per-vertex twinkle. drei's <Stars>
 * couldn't carry per-point alpha or color and saturated to white on additive
 * blend. Per-star color is what lets the arms read as a mix of young blue
 * stars and warm yellow ones, with pink HII regions and a warm-amber bulge.
 */

export const GALAXY_VERTEX_SHADER = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  varying float vAlpha;
  varying vec3 vColor;
  uniform float uTime;
  uniform float uPixelRatio;

  void main() {
    vAlpha = aAlpha;
    vColor = aColor;
    float twinkle = 0.9 + 0.1 * sin(uTime * 1.2 + position.x * 8.1 + position.z * 5.7);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * twinkle * uPixelRatio * (260.0 / -mv.z);
    gl_PointSize = clamp(gl_PointSize, 0.5, 14.0);
  }
`

export const GALAXY_FRAGMENT_SHADER = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;
  uniform vec3 uStarColor;
  void main() {
    vec2 uv = gl_PointCoord * 2.0 - 1.0;
    float dist = length(uv);
    if (dist > 1.0) discard;
    float falloff = exp(-3.2 * dist * dist);
    // uStarColor is a tint: white in dark mode (lets per-star color shine
    // through), ink in chart mode (flattens everything to ink-on-cream and
    // suppresses the per-star palette so the map stays monochrome).
    gl_FragColor = vec4(uStarColor * vColor, falloff * vAlpha);
  }
`
