/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine — see ./index.tsx for the full notice.
 * https://github.com/sinhaankur/portfolio-2026/blob/main/LICENSE
 *
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
  uniform float uBrightness; // dark-mode gain — lifts the Milky Way out of the
                             // wash that additive + ACES tone-mapping leaves it in
  void main() {
    vec2 uv = gl_PointCoord * 2.0 - 1.0;
    float dist = length(uv);
    if (dist > 1.0) discard;
    float falloff = exp(-3.2 * dist * dist);
    // uStarColor is a tint: white in dark mode (lets per-star color shine
    // through), ink in chart mode (flattens everything to ink-on-cream and
    // suppresses the per-star palette so the map stays monochrome).
    gl_FragColor = vec4(uStarColor * vColor, falloff * vAlpha * uBrightness);
  }
`

/* ============================================================
 * Body shaders — moved out of scene.tsx. Pure GLSL strings,
 * imported back by scene.tsx so all engine GLSL lives in one library.
 * ============================================================ */
/* ============================================================
 * Corona shader — Fresnel-style limb glow used by the Sun's
 * two concentric corona shells. Without this, each shell renders
 * as a uniform-alpha sphere → reads as a flat grey disc, not a
 * halo. The Fresnel pass brightens fragments at the silhouette
 * edge (where the normal is perpendicular to the view) and fades
 * toward the center, giving a real "wrap-around" glow.
 * ============================================================ */
export const CORONA_VERTEX_SHADER = `
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - worldPos.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`
export const CORONA_FRAGMENT_SHADER = `
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uPower;
  void main() {
    float fres = pow(1.0 - clamp(abs(dot(vWorldNormal, vViewDir)), 0.0, 1.0), uPower);
    gl_FragColor = vec4(uColor, fres * uIntensity);
  }
`

/* ============================================================
 * Photosphere shader — a LIVING Sun surface, procedurally.
 *
 * Replaces the flat stretched sun.webp (which read as hard blocky
 * patches) with animated 3D value-noise FBM on the sphere: bright
 * convection granules separated by darker network lanes, slow
 * turbulent drift, occasional darker sunspot pooling, plus classic
 * limb darkening (the disc edge is cooler/dimmer than centre). Pure
 * GLSL, no texture file — matches the engine's GLSL-first standard
 * and never looks pixelated at any zoom.
 * ============================================================ */
export const SUN_SURFACE_VERTEX_SHADER = `
  varying vec3 vPos;
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  varying vec2 vUv;
  void main() {
    vPos = position;                       // unit-sphere position → noise domain
    vUv = uv;                              // equirect UVs for the baked sun map
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - worldPos.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`
export const SUN_SURFACE_FRAGMENT_SHADER = `
  precision highp float;
  varying vec3 vPos;
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  uniform float uTime;
  uniform sampler2D uSunTex;  // baked Blender photosphere (equirectangular)
  uniform float uIntensity;
  varying vec2 vUv;

  // Tiny 3D value noise — used ONLY for a gentle live shimmer over the baked
  // texture, so the Sun churns subtly rather than sitting dead still.
  float hash(vec3 p){ p = fract(p*0.3183099+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
  float vnoise(vec3 p){
    vec3 i=floor(p), f=fract(p);
    f=f*f*(3.0-2.0*f);
    return mix(mix(mix(hash(i+vec3(0,0,0)),hash(i+vec3(1,0,0)),f.x),
                   mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
                   mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
  }
  void main() {
    vec3 p = normalize(vPos);
    // Base: the real Blender-rendered photosphere — fiery, molten, alive.
    vec3 col = texture2D(uSunTex, vUv).rgb;
    // Subtle animated shimmer so the surface breathes (very light — the texture
    // already carries the granulation; this just keeps it from looking frozen).
    float shimmer = vnoise(p * 9.0 + vec3(0.0, uTime * 0.25, uTime * 0.15));
    col *= 0.9 + 0.18 * shimmer;
    // Limb darkening — the disc edge is cooler/dimmer than centre.
    float mu = clamp(abs(dot(vWorldNormal, vViewDir)), 0.0, 1.0);
    float limb = 0.55 + 0.45 * pow(mu, 0.5);
    col *= limb;
    // Emissive boost so it reads as a light source, not a lit ball.
    gl_FragColor = vec4(col * uIntensity, 1.0);
  }
`

/* ============================================================
 * Day / night shader — currently scoped to Earth.
 *
 * Lambert dot(normal, sunDir) drives a smooth terminator between the
 * NASA Blue Marble day texture and NASA Black Marble night-lights
 * texture. No PBR — we don't need the standard material's lighting
 * because the day texture already encodes sun-lit color. The night
 * side gets boosted city-lights emission so they read as bright
 * pinpricks against the shadow.
 * ============================================================ */
export const DAY_NIGHT_VERTEX_SHADER = `
  uniform sampler2D tElevation;  // grayscale height map (e.g. Mars MOLA)
  uniform float uElevation;      // displacement scale; 0 = flat (no relief)
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  void main() {
    vUv = uv;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    // Optional real terrain relief: push each vertex out along its normal by the
    // sampled elevation. Gated by uElevation (0 for every body without a height
    // map, so this is a no-op everywhere except bodies that opt in, e.g. Mars).
    vec3 displaced = position;
    if (uElevation > 0.0) {
      float h = texture2D(tElevation, uv).r;
      displaced += normal * (h * uElevation);
    }
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`
export const DAY_NIGHT_FRAGMENT_SHADER = `
  uniform sampler2D tDay;
  uniform sampler2D tNight;
  uniform vec3 uSunDir;
  uniform float uOpacity;
  uniform float uNightStrength;
  uniform float uHasNight;       // 1 = blend night map, 0 = night side goes to ambient
  uniform float uTerminatorSoftness; // 0.18 for Earth, ~0.04 for airless bodies
  uniform float uPolarFix;        // >0 = fade the top/bottom texture rows (fixes
  uniform vec3  uPolarTint;       //   equirectangular polar smear, e.g. Mars caps)
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  void main() {
    float NdotL = dot(normalize(vWorldNormal), normalize(uSunDir));
    // Smoothstep across the terminator — atmospheric scattering on Earth
    // softens the day/night boundary over ~5°. Airless bodies (Moon,
    // Mercury) have a razor-sharp terminator instead; uTerminatorSoftness
    // controls how wide the blend zone is.
    float dayMix = smoothstep(-uTerminatorSoftness * 0.4, uTerminatorSoftness, NdotL);
    vec3 dayColor = texture2D(tDay, vUv).rgb;
    // Fix equirectangular polar smear: the top/bottom rows of some maps (e.g.
    // Mars) are stretched ice-cap streaks that wrap into blobs at the poles.
    // Fade the outermost band toward a clean polar tint so the caps read right.
    if (uPolarFix > 0.5) {
      float d = min(vUv.y, 1.0 - vUv.y);          // distance from nearest pole
      float pole = 1.0 - smoothstep(0.0, 0.06, d); // 1 at the pole → 0 by ~6% in
      dayColor = mix(dayColor, uPolarTint, pole * 0.9);
    }
    // Night-side colour: either the night map (Earth's city lights) or
    // just an ambient-dimmed version of the day colour (Moon: shadow
    // side still has some earthshine; we approximate as 4% ambient).
    // For Earth, add a faint blue base so the shadowed globe still reads as a
    // SPHERE (dim oceans/land like real ISS night photos) instead of a black
    // void — this is what lets the satellite shell read against a defined Earth.
    vec3 nightColor;
    if (uHasNight > 0.5) {
      vec3 cityLights = texture2D(tNight, vUv).rgb * uNightStrength;
      vec3 nightBase = dayColor * 0.055 + vec3(0.008, 0.014, 0.028); // dim earth + blue floor
      nightColor = nightBase + cityLights;
    } else {
      nightColor = dayColor * 0.04;
    }
    vec3 color = mix(nightColor, dayColor, dayMix);
    gl_FragColor = vec4(color, uOpacity);
  }
`

/* ============================================================
 * Procedural cloud shell shader (Earth).
 *
 * No texture file: clouds are generated with fractal value noise (FBM) so
 * the engine stays web-light. The shell sits just above the surface, drifts
 * slowly (uTime), is lit by the Sun (clouds only show on the day side and
 * fade through the terminator), and is fully toggleable via uOpacity (the
 * "hide clouds" switch sets this to 0). Stylised, not a NASA cloud map, but
 * it reads as a living weather layer over the globe.
 * ============================================================ */
export const CLOUD_VERTEX_SHADER = `
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  void main() {
    vUv = uv;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
export const CLOUD_FRAGMENT_SHADER = `
  uniform vec3  uSunDir;
  uniform float uOpacity;   // master fade-in (hover/focus) × toggle
  uniform float uTime;      // slow cloud drift
  uniform float uCoverage;  // 0..1 how much of the globe is clouded
  varying vec2 vUv;
  varying vec3 vWorldNormal;

  // Hash + value noise + FBM — standard cheap procedural noise.
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),
               mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * vnoise(p);
      p *= 2.0;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    // Drift the cloud field slowly in longitude; stretch in U so bands read
    // as latitudinal weather systems rather than blobs.
    vec2 p = vec2(vUv.x * 6.0 + uTime * 0.012, vUv.y * 3.0);
    float n = fbm(p);
    // Coverage threshold carves cloud vs. clear sky with a soft edge.
    float clouds = smoothstep(1.0 - uCoverage, 1.0 - uCoverage + 0.22, n);

    // Day-side only: clouds catch sunlight, fade across the terminator.
    float NdotL = dot(normalize(vWorldNormal), normalize(uSunDir));
    float lit = smoothstep(-0.08, 0.18, NdotL);

    float alpha = clouds * lit * uOpacity;
    // Soft warm-white, slightly brighter where light grazes (limb).
    vec3 col = vec3(1.0, 0.99, 0.96);
    gl_FragColor = vec4(col, alpha);
  }
`

/* ============================================================
 * Aurora shell shader (Earth) — the real polar auroral glow.
 *
 * A thin shell just above the cloud layer that glows green/teal ONLY on the
 * NIGHT side and ONLY at high latitudes (the auroral ovals around each pole),
 * where it actually appears. Shimmering vertical "curtains" come from animated
 * FBM in longitude. Additive blend so it reads as light, not paint. Visible on
 * deep-zoom into Earth (opacity lerps in with the globe's focus, like clouds).
 * Stylised but physically motivated — reverence over spectacle.
 * ============================================================ */
export const AURORA_VERTEX_SHADER = `
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  void main() {
    vUv = uv;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
export const AURORA_FRAGMENT_SHADER = `
  uniform vec3  uSunDir;
  uniform float uOpacity;   // master fade-in (focus) × toggle
  uniform float uTime;      // shimmer / curtain drift
  varying vec2 vUv;
  varying vec3 vWorldNormal;

  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453123); }
  float vnoise(vec2 p){
    vec2 i=floor(p); vec2 f=fract(p); vec2 u=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y);
  }
  float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<4;i++){ v+=a*vnoise(p); p*=2.0; a*=0.5; } return v; }

  void main() {
    // latitude band: vUv.y is 0 at the south pole, 1 at the north (sphere UV).
    // The auroral ovals sit ~65-75° — i.e. near both poles, not the equator.
    float lat = abs(vUv.y - 0.5) * 2.0;            // 0 equator → 1 pole
    float oval = smoothstep(0.62, 0.78, lat) * (1.0 - smoothstep(0.9, 1.0, lat));

    // NIGHT side only (inverse of the cloud day-side test).
    float NdotL = dot(normalize(vWorldNormal), normalize(uSunDir));
    float night = smoothstep(0.10, -0.15, NdotL);

    // shimmering vertical curtains: animated noise in longitude
    float curtains = fbm(vec2(vUv.x * 26.0 + uTime * 0.25, lat * 6.0 - uTime * 0.05));
    curtains = smoothstep(0.45, 0.95, curtains);

    float intensity = oval * night * curtains;
    // green at the base shading to teal/violet higher up the curtain
    vec3 col = mix(vec3(0.15, 1.0, 0.45), vec3(0.35, 0.65, 1.0), smoothstep(0.62, 0.86, lat));
    gl_FragColor = vec4(col, intensity * uOpacity * 0.9);
  }
`

/* ============================================================
 * Atmospheric band shader (Venus + gas/ice giants).
 *
 * A thin shell over the planet texture that adds DRIFTING latitudinal turbulence
 * so the bands feel alive instead of a frozen photo. FBM stretched hard in
 * longitude (bands read horizontal), scrolling at a per-planet speed, modulated
 * by latitude into stacked zones. Day-side lit (fades across the terminator) and
 * soft-additive so it brightens/darkens the existing bands rather than repainting
 * them. Stylised but physically motivated (zonal jets / Great-Red-Spot turbulence).
 * ============================================================ */
export const BANDS_VERTEX_SHADER = `
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  void main() {
    vUv = uv;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
export const BANDS_FRAGMENT_SHADER = `
  uniform vec3  uSunDir;
  uniform vec3  uTint;
  uniform float uOpacity;
  uniform float uTime;
  uniform float uStrength;
  uniform float uSpot;      // >0.5 → draw the Great Red Spot (Jupiter only)
  uniform vec3  uSpotColor; // spot tint (warm ochre-red)
  varying vec2 vUv;
  varying vec3 vWorldNormal;

  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453123); }
  float vnoise(vec2 p){
    vec2 i=floor(p); vec2 f=fract(p); vec2 u=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y);
  }
  float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<5;i++){ v+=a*vnoise(p); p*=2.0; a*=0.5; } return v; }

  void main() {
    // zonal jets: different latitude bands drift at alternating speeds/directions.
    float lat = vUv.y;
    float zone = sin(lat * 38.0);                 // stacked horizontal bands
    float dir = sign(zone);                        // alternate drift direction
    // FBM stretched in U so turbulence smears into bands; scroll in longitude.
    vec2 p = vec2(vUv.x * 9.0 + uTime * dir, lat * 26.0);
    float turb = fbm(p);
    // curl the turbulence a touch so bands show festoons/swirls, not flat stripes
    float swirl = fbm(p * 2.3 + vec2(turb * 1.5, 0.0));
    float bands = 0.5 + 0.5 * zone;
    float detail = mix(bands, mix(turb, swirl, 0.4), 0.6);

    vec3 tint = uTint;

    // --- Great Red Spot: a persistent anticyclonic oval in the southern belt.
    // Centered ~ lat 0.38, drifting slowly westward in longitude; elliptical
    // (wider than tall) with a swirled interior + a darker collar ring.
    if (uSpot > 0.5) {
      float sx = fract(0.62 + uTime * 0.004);            // slow longitudinal drift
      vec2 d = vec2(vUv.x - sx, (vUv.y - 0.38));
      d.x = d.x - floor(d.x + 0.5);                       // wrap in longitude
      // elliptical distance (spot is ~2.2× wider than tall)
      float e = length(vec2(d.x / 0.11, d.y / 0.05));
      float oval = 1.0 - smoothstep(0.7, 1.05, e);
      // internal swirl (rotate sample around the spot centre by radius)
      float ang = atan(d.y, d.x) + (1.0 - e) * 3.0 + uTime * 0.2;
      float spin = fbm(vec2(cos(ang), sin(ang)) * 3.0 + e * 4.0);
      float collar = smoothstep(0.75, 0.95, e) * (1.0 - smoothstep(0.95, 1.1, e));
      detail = mix(detail, 0.55 + 0.45 * spin, oval * 0.9);
      tint = mix(tint, uSpotColor, oval * 0.85);
      tint = mix(tint, uSpotColor * 0.6, collar * 0.5);  // darker rim
    }

    float NdotL = dot(normalize(vWorldNormal), normalize(uSunDir));
    float lit = smoothstep(-0.12, 0.20, NdotL);

    // soft signed modulation around 0 so it lightens AND darkens the texture.
    float m = (detail - 0.5) * 2.0 * uStrength * lit * uOpacity;
    gl_FragColor = vec4(tint * (0.5 + 0.5 * detail), abs(m));
  }
`

/* ============================================================
 * Nebula haze shader — big soft additive billboards for diffuse gas/dust.
 * Each point is a large, very soft radial blob with a gentle per-cloud
 * twinkle so the haze breathes. Color + size + alpha come from attributes.
 * ============================================================ */
export const NEBULA_VERTEX_SHADER = `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3  aColor;
  varying float vAlpha;
  varying vec3  vColor;
  uniform float uTime;
  uniform float uPixelRatio;
  void main() {
    vAlpha = aAlpha;
    vColor = aColor;
    float breathe = 0.92 + 0.08 * sin(uTime * 0.4 + position.x * 2.3 + position.z * 1.7);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * breathe * uPixelRatio * (320.0 / -mv.z);
    gl_PointSize = clamp(gl_PointSize, 4.0, 520.0);
  }
`
export const NEBULA_FRAGMENT_SHADER = `
  varying float vAlpha;
  varying vec3  vColor;
  uniform sampler2D uTex;
  uniform float uHasTex;
  void main() {
    vec2 uv = gl_PointCoord * 2.0 - 1.0;
    float d = length(uv);
    if (d > 1.0) discard;
    // Procedural soft falloff — gas haze, not a star. Squared for a smooth core.
    float a = pow(1.0 - d, 2.4);
    // Blender-baked filament sprite (alpha = cloud density) when available —
    // gives real wispy structure instead of a plain blob.
    if (uHasTex > 0.5) {
      a = texture2D(uTex, gl_PointCoord).a;
    }
    gl_FragColor = vec4(vColor, a * vAlpha);
  }
`

/* ============================================================
 * Atmospheric scattering shell shader.
 *
 * Replaces the old flat additive halo with a sun-aware limb glow: a Fresnel
 * term concentrates the glow at the silhouette (the limb), and a sun-facing
 * term brightens the day side + adds a faint forward-scatter "blue hour"
 * crescent at the terminator — the look of real Rayleigh scattering seen from
 * space. uOpacity fades it in on hover/focus exactly like the old halo, so the
 * idle wide view stays clean.
 * ============================================================ */
export const ATMOS_VERTEX_SHADER = `
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  void main() {
    vec4 wpos = modelMatrix * vec4(position, 1.0);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - wpos.xyz);
    gl_Position = projectionMatrix * viewMatrix * wpos;
  }
`
export const ATMOS_FRAGMENT_SHADER = `
  uniform vec3  uColor;
  uniform vec3  uSunDir;
  uniform float uOpacity;
  uniform float uPower;   // Fresnel sharpness (higher = tighter limb)
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  void main() {
    vec3 N = normalize(vWorldNormal);
    // Fresnel: glow concentrates where the surface grazes the view (the limb).
    float fres = pow(1.0 - max(dot(N, normalize(vViewDir)), 0.0), uPower);
    // Sun term: brighten the day-facing limb, keep a soft floor so the whole
    // limb still reads as a thin shell.
    float sun = max(dot(N, normalize(uSunDir)), 0.0);
    float lit = 0.25 + 0.95 * sun;
    // Terminator forward-scatter: a subtle lift right at the day/night edge.
    float terminator = smoothstep(0.0, 0.25, sun) * (1.0 - smoothstep(0.25, 0.6, sun));
    float intensity = fres * lit + fres * terminator * 0.5;
    gl_FragColor = vec4(uColor, clamp(intensity, 0.0, 1.0) * uOpacity);
  }
`

/* ============================================================
 * Comet-tail shader.
 *
 * A real plasma/dust tail is a sparse plume — densest at the
 * coma, fading to nothing where the solar wind disperses it.
 * The earlier solid-cone meshBasicMaterial read like a plastic
 * cone, not vapour. This shader:
 *  - fades alpha along local +Y (base near nucleus → tip far),
 *    with a power curve so the head reads punchy and the tip
 *    feathers gently to zero
 *  - adds a slight radial soft edge using the cone's UV.x
 *    angular coordinate isn't useful, but we approximate a
 *    central spine by sampling distance-from-axis derived
 *    from local x/z position
 *  - introduces a low-frequency time-varying flicker (knots in
 *    the ion tail; real plasma tails knot and pulse as solar
 *    magnetic sectors push through them)
 * ============================================================ */
export const COMET_TAIL_VERTEX_SHADER = `
  varying vec2 vUv;
  varying float vAxialT;    // 0 at base, 1 at tip — for alpha falloff
  varying float vRadial;    // 0 at axis, 1 at rim — for spine highlight
  uniform float uHalfHeight;
  void main() {
    // ConeGeometry: base at y = -h/2, apex at y = +h/2.
    vAxialT = clamp((position.y + uHalfHeight) / (2.0 * uHalfHeight), 0.0, 1.0);
    // Radial distance from the cone's axis, normalised by the
    // local radius at this slice. At the apex (vAxialT=1) the
    // local radius collapses to ~0; clamp the divisor so we
    // don't blow up.
    float localR = mix(1.0, 0.01, vAxialT);
    vRadial = clamp(length(position.xz) / localR, 0.0, 1.0);
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
export const COMET_TAIL_FRAGMENT_SHADER = `
  varying vec2 vUv;
  varying float vAxialT;
  varying float vRadial;
  uniform vec3  uColorHead;    // bright colour at the coma end
  uniform vec3  uColorTail;    // cooler/dimmer colour out at the tip
  uniform float uOpacity;
  uniform float uTime;
  uniform float uKnotStrength; // 0 for dust tail (smooth), ~0.35 for ion tail
  void main() {
    // Axial falloff — fast bright lobe near the head, long feather to the tip.
    float axial = pow(1.0 - vAxialT, 1.7);
    // Radial spine — bright down the centre, soft on the edges.
    float spine = pow(1.0 - vRadial, 1.2);
    // Plasma knots — low-freq sin in axial direction, time-varying.
    // Strength controlled per-tail (ion: knotty, dust: smooth).
    float knots = 1.0 + uKnotStrength * sin(vAxialT * 18.0 - uTime * 1.8);
    float a = axial * spine * knots * uOpacity;
    // Colour gradient along the tail length.
    vec3 col = mix(uColorHead, uColorTail, vAxialT);
    gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
  }
`

/* ============================================================
 * Comet sunward-envelope shader.
 *
 * The bright, parabolic dust hood that hangs on the sun-facing
 * side of an active comet — where outflowing gas meets the
 * inward radiation pressure and piles up in a curved sheath.
 * This shader gives a half-sphere a bright leading rim that
 * fades toward the equator (where it meets the tail) and
 * toward the inside of the cap.
 * ============================================================ */
export const COMET_ENVELOPE_VERTEX_SHADER = `
  varying vec3 vLocalNormal;
  varying vec3 vLocalPos;
  void main() {
    vLocalNormal = normalize(normal);
    vLocalPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
export const COMET_ENVELOPE_FRAGMENT_SHADER = `
  varying vec3 vLocalNormal;
  varying vec3 vLocalPos;
  uniform vec3  uColor;
  uniform float uOpacity;
  void main() {
    // Brightest at the apex (local -y, the sunward tip) and
    // fades toward the open rim (local y → 0). Local sphere
    // is constructed sunward-facing so -y is the sub-solar
    // point; tweak the sign if the model orientation flips.
    float sunward = clamp(-vLocalNormal.y, 0.0, 1.0);
    float falloff = pow(sunward, 1.4);
    gl_FragColor = vec4(uColor, falloff * uOpacity);
  }
`

/* ============================================================
 * Zodiacal light — sunlight scattered off the interplanetary
 * dust disc that lies in the ecliptic plane.
 *
 * A real, faint phenomenon: a diffuse triangular glow along the
 * ecliptic, brightest near the Sun (forward-scattering by the dust),
 * tapering outward, with a subtle brightening at the anti-solar point
 * (the gegenschein — backscatter). Rendered as a large flat disc in the
 * local x–z plane centred on the Sun; the shader shapes the glow so the
 * space between planets stops reading as pure black void.
 *
 * Deliberately dim + additive (reverence over spectacle): it must never
 * compete with a planet or the corona. Brightness, not girth.
 * ============================================================ */
export const ZODIACAL_VERTEX_SHADER = `
  varying vec2  vDisc;       // disc-plane coords, native to the CircleGeometry (x–y)
  varying vec3  vLocalPos;   // local-space fragment position (Sun at local origin)
  void main() {
    vDisc = position.xy;                             // CircleGeometry lies in x–y (z=0)
    vLocalPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
export const ZODIACAL_FRAGMENT_SHADER = `
  uniform vec3  uColor;      // warm sunlit-dust tint
  uniform float uOpacity;    // master fade (focus/proximity × toggle)
  uniform float uRadius;     // disc outer radius (local units)
  uniform float uTime;       // slow mottle drift
  uniform vec3  uCamPos;     // camera position in THIS MESH's local frame (Sun = origin)
  varying vec2  vDisc;
  varying vec3  vLocalPos;

  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453123); }
  float vnoise(vec2 p){
    vec2 i=floor(p); vec2 f=fract(p); vec2 u=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y);
  }
  float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<4;i++){ v+=a*vnoise(p); p*=2.05; a*=0.5; } return v; }

  void main() {
    // Radial distance from the Sun (local origin), normalised to the disc.
    float r = length(vDisc);
    float rn = r / uRadius;
    if (rn > 1.0) discard;

    // Dust column density falls ~1/r; scattered brightness falls faster.
    // A soft inner cap keeps the glow from blowing out right at the Sun
    // (the corona owns that region).
    float radial = smoothstep(0.02, 0.10, rn) * (1.0 / (0.15 + rn * rn * 3.0));

    // View geometry, all in local space (Sun at origin). Is the camera looking
    // toward the Sun through this dust? Forward-scattering makes the near-Sun
    // dust much brighter than the rest.
    vec3 toSun    = normalize(-vLocalPos);              // fragment → Sun
    vec3 toCam    = normalize(uCamPos - vLocalPos);     // fragment → camera
    float phase   = dot(toCam, -toSun);                 // +1 = looking sunward through dust
    float forward = pow(clamp(phase * 0.5 + 0.5, 0.0, 1.0), 3.0);   // strong forward lobe
    float gegen   = pow(clamp(-phase, 0.0, 1.0), 8.0) * 0.35;        // faint backscatter bump

    // Gentle mottle so the band isn't a perfectly smooth wash.
    float mottle = 0.75 + 0.25 * fbm(vDisc * 0.6 + vec2(uTime * 0.01, 0.0));

    float intensity = radial * (0.35 + 0.65 * forward + gegen) * mottle;

    // Warm tint, cooling slightly outward (dust reddening near the Sun).
    vec3 col = mix(uColor, uColor * vec3(0.82, 0.86, 1.0), smoothstep(0.1, 0.9, rn));

    gl_FragColor = vec4(col, clamp(intensity, 0.0, 1.0) * uOpacity);
  }
`
