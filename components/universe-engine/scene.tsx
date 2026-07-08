"use client"

/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine — see ./index.tsx for the full notice.
 * https://github.com/sinhaankur/portfolio-2026/blob/main/LICENSE
 *
 * Universe Engine — R3F scene graph.
 *
 * Every rendered body lives here. Public composition is <SceneContents />,
 * which the <UniverseEngine /> in ./index.tsx mounts inside its <Canvas>.
 *
 * Bodies follow real astronomical positioning: the Milky Way disc is tilted
 * 60.2° from the ecliptic, the Sun sits on the Orion Arm ~26,670 ly from the
 * galactic centre, and constellations project from RA/Dec onto a sky-shell
 * around the Sun (not the galactic centre).
 */

import { Suspense, useRef, useMemo, useEffect, useState } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { Clone, Html, useGLTF } from "@react-three/drei"
import { BrightStarField } from "./bright-star-field"
import { SatelliteField } from "./satellite-field"
import { NamedStarHoverLayer } from "./named-star-hover-layer"
import { BrightStarPicker } from "./bright-star-picker"
import { NearbyStars3D } from "./nearby-stars-3d"
import { GravityOverlay } from "./gravity-overlay"
import { WebGLLabel } from "./webgl-label"
import { TrajectoryTrails } from "./trajectory-trails"
import { SphereOfInfluence } from "./sphere-of-influence"
import "./three-line"

// The black-hole mesh (8.4 MB — "Blackhole" by rubykamen, CC-BY-4.0,
// https://sketchfab.com/3d-models/blackhole-74cbeaeae2174a218fe9455d77902b5c)
// is NOT preloaded at module init: that cost every visitor ~8.4 MB whether or
// not they ever engaged a black hole. BlackHoleDetail fetches it on first
// hover/focus intent instead — the fly-to flight time hides the download, and
// drei's loader cache shares the result across every BH instance.
import {
  AdditiveBlending,
  Box3,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  ClampToEdgeWrapping,
  Color,
  DoubleSide,
  FogExp2,
  Group,
  Matrix3,
  Mesh,
  NormalBlending,
  Points,
  RepeatWrapping,
  ShaderMaterial,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  type Texture,
} from "three"
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib"

import {
  ASTEROID_BELT_INFO,
  DEG,
  GALACTIC_PLANE_TILT_RAD,
  KUIPER_BELT_INFO,
  MILKY_WAY_INFO,
  SGR_A_INFO,
  SKY_SHELL_DISTANCE,
  SOLAR_SYSTEM_POSITION,
  SUN_INFO,
  SUN_OFFSET_SCENE,
  GALAXY_RADIUS_SCENE,
  TIME_WARP_DAYS_PER_SEC,
  blackHoleHorizonGravityMetersPerSec2,
  buildScenePlanets,
  compressRadius,
  constellations,
  daysSinceJ2000,
  eccentricToTrue,
  flyToRef,
  followRef,
  formatLength,
  formatSolarMass,
  gauss,
  kerrHorizonRadiusMeters,
  magToVisualRadius,
  meanAnomalyAt,
  moons,
  namedBodies,
  orbitalElementsToCartesian,
  planetToInfo,
  raDecToScenePos,
  requestFlyTo,
  requestFollow,
  schwarzschildRadiusMeters,
  simTimeRef,
  skyPoints,
  solveKepler,
  timeWarpRef,
  timeScaleRef,
  cloudsVisibleRef,
  satellitesVisibleRef,
  focusDepthRef,
  DEFAULT_CAMERA_NEAR,
  DEFAULT_MIN_DISTANCE,
} from "./astronomy"
import { GALAXY_FRAGMENT_SHADER, GALAXY_VERTEX_SHADER } from "./shaders"

/* ============================================================
 * Corona shader — Fresnel-style limb glow used by the Sun's
 * two concentric corona shells. Without this, each shell renders
 * as a uniform-alpha sphere → reads as a flat grey disc, not a
 * halo. The Fresnel pass brightens fragments at the silhouette
 * edge (where the normal is perpendicular to the view) and fades
 * toward the center, giving a real "wrap-around" glow.
 * ============================================================ */
const CORONA_VERTEX_SHADER = `
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - worldPos.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`
const CORONA_FRAGMENT_SHADER = `
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
const SUN_SURFACE_VERTEX_SHADER = `
  varying vec3 vPos;
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  void main() {
    vPos = position;                       // unit-sphere position → noise domain
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - worldPos.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`
const SUN_SURFACE_FRAGMENT_SHADER = `
  precision highp float;
  varying vec3 vPos;
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  uniform float uTime;
  uniform vec3  uCool;   // granule lane / cooler tone
  uniform vec3  uWarm;   // granule core / hotter tone
  uniform vec3  uHot;    // brightest network flash
  uniform float uIntensity;

  // 3D value noise + FBM (cheap, seam-free on a sphere since it samples 3D pos).
  float hash(vec3 p){ p = fract(p*0.3183099+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
  float vnoise(vec3 p){
    vec3 i=floor(p), f=fract(p);
    f=f*f*(3.0-2.0*f);
    return mix(mix(mix(hash(i+vec3(0,0,0)),hash(i+vec3(1,0,0)),f.x),
                   mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
                   mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
  }
  float fbm(vec3 p){
    float v=0.0, a=0.5;
    for(int i=0;i<6;i++){ v+=a*vnoise(p); p=p*2.02+vec3(11.3,7.1,3.7); a*=0.5; }
    return v;
  }
  void main() {
    vec3 p = normalize(vPos);
    float t = uTime * 0.06;
    // Two noise scales: fine granulation + a slow domain warp so cells churn.
    vec3 warp = vec3(fbm(p*3.0 + t), fbm(p*3.0 + 5.2), fbm(p*3.0 - 2.4)) - 0.5;
    float gran = fbm(p*14.0 + warp*1.5 + vec3(0.0, t*1.3, 0.0));    // convection cells
    float lanes = fbm(p*7.0 - warp + vec3(t*0.4));                  // supergranule network
    // Combine: bright granule interiors, darker intergranular lanes.
    float cell = smoothstep(0.35, 0.75, gran);
    float lane = smoothstep(0.30, 0.60, lanes);
    vec3 col = mix(uCool, uWarm, cell);
    col = mix(col, uHot, pow(cell, 3.0) * 0.7);            // hot network flashes
    col *= mix(0.72, 1.0, lane);                            // sink the lanes
    // Occasional sunspot: rare dark pooling where low-freq noise dips.
    float spot = smoothstep(0.16, 0.05, fbm(p*2.2 + 3.0));
    col = mix(col, uCool*0.35, spot*0.8);
    // Limb darkening — the classic dimming toward the disc edge.
    float mu = clamp(abs(dot(vWorldNormal, vViewDir)), 0.0, 1.0);
    float limb = 0.45 + 0.55 * pow(mu, 0.55);
    col *= limb;
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
const DAY_NIGHT_VERTEX_SHADER = `
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
const DAY_NIGHT_FRAGMENT_SHADER = `
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
const CLOUD_VERTEX_SHADER = `
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  void main() {
    vUv = uv;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const CLOUD_FRAGMENT_SHADER = `
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
const AURORA_VERTEX_SHADER = `
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  void main() {
    vUv = uv;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const AURORA_FRAGMENT_SHADER = `
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
const BANDS_VERTEX_SHADER = `
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  void main() {
    vUv = uv;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const BANDS_FRAGMENT_SHADER = `
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
const NEBULA_VERTEX_SHADER = `
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
const NEBULA_FRAGMENT_SHADER = `
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
const ATMOS_VERTEX_SHADER = `
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  void main() {
    vec4 wpos = modelMatrix * vec4(position, 1.0);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - wpos.xyz);
    gl_Position = projectionMatrix * viewMatrix * wpos;
  }
`
const ATMOS_FRAGMENT_SHADER = `
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
const COMET_TAIL_VERTEX_SHADER = `
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
const COMET_TAIL_FRAGMENT_SHADER = `
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
const COMET_ENVELOPE_VERTEX_SHADER = `
  varying vec3 vLocalNormal;
  varying vec3 vLocalPos;
  void main() {
    vLocalNormal = normalize(normal);
    vLocalPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const COMET_ENVELOPE_FRAGMENT_SHADER = `
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

import { CONSTELLATION_FIGURES } from "./constellation-figures"
import { SPACECRAFT_SHAPES } from "./spacecraft-shapes"
import {
  getBlackHoleAffordance,
  getCometDynamicProfile,
  getCometAffordance,
  getPulsarDynamicProfile,
  getSkyAffordance,
  getStarDynamicProfile,
} from "./celestial-sub-engine"
import type {
  Constellation,
  ConstellationId,
  ConstellationStar,
  HoverHandler,
  MoonData,
  SurfaceFeature,
  NamedBody,
  ScenePlanet,
  SkyPoint,
} from "./types"

/* ============================================================
 * Fly-to controller
 *
 * Reads the module-scoped flyToRef each frame. When `active` is set
 * (either by a body click in explore mode, or by the destinations
 * HUD menu), this controller lerps:
 *   - the OrbitControls target toward the requested world point
 *   - the camera distance toward the requested value
 *
 * When the target + distance have arrived within tolerance, it
 * clears the active flag. The user can drag/zoom mid-fly to take
 * over — any pointer-down on the controls would cancel by setting
 * a state flag, but for now we let the lerp finish.
 *
 * The autoRotate continues during the fly; that gives the camera a
 * gentle swing around the new target on arrival without extra code.
 * ============================================================ */

const _flyCamDir = new Vector3()
const _flyTargetVec = new Vector3()
const _flyDesiredCamPos = new Vector3()

function FlyToController({ interactive }: { interactive: boolean }) {
  const { camera, controls } = useThree() as unknown as {
    camera: import("three").PerspectiveCamera
    controls: OrbitControlsImpl | null
  }

  useFrame((_, delta) => {
    if (!controls) return

    // Per-focus deep-zoom: tighten the near-plane + zoom floor while a tiny body
    // (a satellite) is focused so the camera can dolly up to a true-1:1 craft;
    // restore the defaults the moment focus clears. Only touch the camera when a
    // value actually changes (updateProjectionMatrix isn't free).
    const fd = focusDepthRef.current
    const wantNear = fd ? fd.near : DEFAULT_CAMERA_NEAR
    const wantMin = fd ? fd.minDistance : DEFAULT_MIN_DISTANCE
    if (camera.near !== wantNear) {
      camera.near = wantNear
      camera.updateProjectionMatrix()
    }
    if (controls.minDistance !== wantMin) controls.minDistance = wantMin

    const follow = followRef.current
    // Follow mode wins over fly mode if both somehow set (requestFlyTo and
    // requestFollow both clear the other ref, but defending the order
    // here keeps the controller predictable).
    if (follow) {
      const pos = follow.getter()
      if (!pos) {
        // Follower vanished (e.g. unmounted) — drop follow and let the
        // user take over.
        followRef.current = null
        return
      }
      const k = 1 - Math.exp(-delta * 4.0)
      _flyTargetVec.set(pos.x, pos.y, pos.z)

      if (!follow.arrived) {
        // Fly-in phase. Two important details:
        //
        // 1. Target JUMPS to the body each frame (no lerp). Earlier
        //    versions lerped the target and the body would drift out
        //    from under it for fast inner planets — Mercury orbits in
        //    ~6 seconds of real time at default warp, faster than a
        //    13%/frame lerp can chase. With the jump, look-at is
        //    locked on the body from frame 1 and the camera can
        //    dolly in cinematically.
        //
        // 2. Camera position is the only thing lerped here — it
        //    glides toward `follow.distance` from the body.
        controls.target.copy(_flyTargetVec)
        _flyCamDir.copy(camera.position).sub(controls.target)
        const currentDist = _flyCamDir.length()
        if (currentDist < 1e-4) {
          _flyCamDir.set(0.6, 0.4, 1).normalize()
        } else {
          _flyCamDir.normalize()
        }
        const nextDist = currentDist + (follow.distance - currentDist) * k
        _flyDesiredCamPos.copy(controls.target).addScaledVector(_flyCamDir, nextDist)
        camera.position.copy(_flyDesiredCamPos)

        // Arrival = camera-to-body distance within ~8% of target. This
        // is independent of how fast the body is moving, so Mercury
        // (whirling around the Sun at 88-day period) arrives as
        // reliably as Pluto. Once arrived, the controller stops
        // overriding camera position entirely — pinch/scroll zooms
        // and drag-rotate respond normally.
        const distErr = Math.abs(currentDist - follow.distance) / Math.max(follow.distance, 0.001)
        if (distErr < 0.08) {
          follow.arrived = true
        }
      } else {
        // Arrived — track the moving target without overriding camera
        // distance. OrbitControls preserves the user's spherical
        // offset (radius + angles), so as the body sweeps through
        // space the camera slides along with it while drag/zoom
        // respond to input normally. We move target + camera by the
        // same per-frame delta so the *offset* OrbitControls reads
        // stays unchanged frame to frame.
        const targetDelta = _flyTargetVec.clone().sub(controls.target)
        controls.target.copy(_flyTargetVec)
        camera.position.add(targetDelta)
      }

      controls.update()
      return
    }

    const state = flyToRef.current
    if (!state.active) return

    // Smoothing factor — auto-journey (passive) wants a slow, cinematic
    // pan in/out so the camera feels like it's traversing a scene rather
    // than snapping between waypoints. Explore-mode clicks stay faster
    // because the user expects the camera to respond to their input.
    //
    // The exponent-of-time form gives a natural ease-out: fast at the
    // start of a transition (covering distance) and slow on arrival
    // (settling into the frame). For passive mode we also ease the very
    // start by stretching the early-distance portion of the curve —
    // when targetErr is large we ramp k up gradually instead of jumping.
    _flyTargetVec.set(state.target.x, state.target.y, state.target.z)
    const baseRate = interactive ? 3.2 : 1.6
    // Pre-lerp distance to the waypoint — used to ease the early segment
    // so far-away targets don't snap fast then crawl. Proximity goes 0
    // when far → 1 when close, so the effective rate ramps up gradually
    // toward the destination instead of front-loading the motion.
    const preLerpDistance = controls.target.distanceTo(_flyTargetVec)
    const proximity = interactive ? 1 : Math.min(1, 1 / (1 + preLerpDistance * 0.06))
    const k = 1 - Math.exp(-delta * baseRate * (interactive ? 1 : 0.5 + 0.7 * proximity))

    controls.target.lerp(_flyTargetVec, k)

    let arrivedCamera = false
    let nextDist: number

    if (state.cameraPos) {
      // Narrative-vantage mode — lerp the camera toward a *specific*
      // world point instead of along the existing ray. Used by waypoints
      // like Pale Blue Dot where the camera angle is itself the story.
      _flyDesiredCamPos.set(state.cameraPos.x, state.cameraPos.y, state.cameraPos.z)
      camera.position.lerp(_flyDesiredCamPos, k)
      nextDist = camera.position.distanceTo(controls.target)
      arrivedCamera = camera.position.distanceTo(_flyDesiredCamPos) < 0.5
    } else {
      // Default mode — move along the existing target→camera ray so the
      // user's viewing angle is preserved; only distance changes.
      _flyCamDir.copy(camera.position).sub(controls.target)
      const currentDist = _flyCamDir.length()
      if (currentDist < 1e-4) {
        // Degenerate case (camera on top of target) — pick a default look-up.
        _flyCamDir.set(0.6, 0.4, 1).normalize()
      } else {
        _flyCamDir.normalize()
      }
      nextDist = currentDist + (state.distance - currentDist) * k
      _flyDesiredCamPos.copy(controls.target).addScaledVector(_flyCamDir, nextDist)
      camera.position.copy(_flyDesiredCamPos)
      const distErr = Math.abs(nextDist - state.distance) / Math.max(state.distance, 0.001)
      arrivedCamera = distErr < 0.04
    }

    controls.update()

    // Arrival check — both target lerp and camera lerp converged.
    const targetErr = controls.target.distanceTo(_flyTargetVec)
    if (targetErr < 0.08 && arrivedCamera) {
      controls.target.copy(_flyTargetVec)
      state.active = false
    }
  })

  return null
}

/* ============================================================
 * SceneClock — advances the simulation-time accumulator each
 * frame using the same scaling every orbiting body uses. The
 * HUD's date readout reads from this so what it displays is
 * the same instant the planets are at; pausing the time-warp
 * slider freezes both at once.
 * ============================================================ */

function SceneClock() {
  useFrame((_, delta) => {
    // Advance the absolute simulation instant. timeWarpRef may be negative
    // to run time backwards; at 0 the clock (and every body) freezes. The
    // timeline scrubber writes simMs directly, so this is the only place
    // that *advances* it during playback.
    //
    // Clamp delta: when the frameloop resumes after being paused off-screen,
    // R3F reports the entire elapsed wall-clock gap as one delta — left
    // unclamped that snaps every body forward by minutes. Capping at 0.1s
    // (a dropped-frame's worth) keeps the resume seamless.
    const dt = Math.min(delta, 0.1)
    simTimeRef.current.simMs +=
      dt * TIME_WARP_DAYS_PER_SEC * timeWarpRef.current * timeScaleRef.current * 86_400_000
  })
  return null
}

/**
 * Build an onClick handler that asks the controller to fly to the body's
 * current world position. Used by every interactive body (planet, sun,
 * sky point, named body, Sgr A*).
 *
 * `interactive` gates the click — outside explore mode, clicks shouldn't
 * hijack the scene, since the canvas is below the typography + scrolls
 * with the page. When passive, this returns undefined so React doesn't
 * register a handler at all.
 */
function makeFocusHandler(
  interactive: boolean,
  desiredDistance: number,
  label?: string,
) {
  if (!interactive) return undefined
  return (e: { stopPropagation: () => void; object: import("three").Object3D }) => {
    e.stopPropagation()
    const world = new Vector3()
    e.object.getWorldPosition(world)
    requestFlyTo({ x: world.x, y: world.y, z: world.z }, desiredDistance, label)
  }
}

/* ============================================================
 * Nebula clouds — diffuse gas/dust haze tracing the spiral arms.
 * A handful of big soft additive billboards layered over the star field
 * to give the Milky Way the volumetric glow real galaxy images have.
 * ============================================================ */
function NebulaClouds({ mobile = false }: { mobile?: boolean }) {
  const pointsRef = useRef<Points>(null)
  const matRef = useRef<ShaderMaterial>(null)
  const dustRef = useRef<Points>(null)
  const { gl } = useThree()

  // Blender-baked nebula sprite (wispy filaments + soft radial fade) — richer
  // than the procedural radial falloff. Loaded async; the shader falls back to
  // the procedural blob until it lands (uHasTex flag).
  const [nebulaTex, setNebulaTex] = useState<Texture | null>(null)
  useEffect(() => {
    let alive = true
    new TextureLoader().load("/textures/nebula-sprite.webp", (t) => {
      t.colorSpace = SRGBColorSpace
      if (alive) setNebulaTex(t)
    })
    return () => { alive = false }
  }, [])

  const geometry = useMemo(() => {
    const radius = GALAXY_RADIUS_SCENE
    const branches = 4
    const spin = 7
    const count = mobile ? 22 : 44
    const positions = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const alphas = new Float32Array(count)
    const colors = new Float32Array(count * 3)

    const gauss = () =>
      (Math.random() + Math.random() + Math.random() + Math.random() - 2) / 2

    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      // Anchor each cloud on a spiral-arm position (same math as the stars).
      const r = (0.16 + Math.random() * 0.78) * radius
      const branch = Math.floor(Math.random() * branches)
      const branchAngle = (branch / branches) * Math.PI * 2
      const spinAngle = r * spin * 0.04
      positions[i3]     = Math.cos(branchAngle + spinAngle) * r + gauss() * 3.0
      positions[i3 + 1] = gauss() * 1.2
      positions[i3 + 2] = Math.sin(branchAngle + spinAngle) * r + gauss() * 3.0

      const normR = r / radius
      sizes[i]  = 26 + Math.random() * 46
      alphas[i] = 0.05 + Math.random() * 0.07 // deliberately faint — it's haze

      // Palette: Hα-pink/magenta in star-forming mid-arms, dusty blue in the
      // outskirts, warm amber dust nearer the core.
      const roll = Math.random()
      if (normR < 0.4 && roll < 0.7) {
        // Warm amber dust near the core
        colors[i3] = 0.95; colors[i3 + 1] = 0.62; colors[i3 + 2] = 0.34
      } else if (roll < 0.55) {
        // Hα pink/magenta star-forming clouds
        colors[i3] = 0.95; colors[i3 + 1] = 0.36; colors[i3 + 2] = 0.62
      } else {
        // Cool dusty blue
        colors[i3] = 0.40; colors[i3 + 1] = 0.55; colors[i3 + 2] = 0.95
      }
    }

    const geo = new BufferGeometry()
    geo.setAttribute("position", new BufferAttribute(positions, 3))
    geo.setAttribute("aSize", new BufferAttribute(sizes, 1))
    geo.setAttribute("aAlpha", new BufferAttribute(alphas, 1))
    geo.setAttribute("aColor", new BufferAttribute(colors, 3))
    return geo
  }, [mobile])

  // Dark dust lanes — light-absorbing interstellar dust threading the spiral
  // arms, tightly hugging the galactic plane (the dark veins in real Milky Way
  // photos). Same soft-billboard shader, but dark + normal-blended so it dims
  // the star field behind it rather than glowing.
  const dustGeometry = useMemo(() => {
    const radius = GALAXY_RADIUS_SCENE
    const branches = 4
    const spin = 7
    // Denser dust → the lanes read as continuous dark veins threading the arms,
    // and parallax against the stars as the camera moves (the 3D depth cue).
    const count = mobile ? 130 : 320
    const positions = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const alphas = new Float32Array(count)
    const colors = new Float32Array(count * 3)
    let s = 9001
    const rand = () => { s = (1664525 * s + 1013904223) >>> 0; return s / 4294967296 }
    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      const r = (0.20 + rand() * 0.76) * radius
      const branch = Math.floor(rand() * branches)
      const branchAngle = (branch / branches) * Math.PI * 2
      const spinAngle = r * spin * 0.04
      // Follow the SAME arm spurs/feathering the stars use, so dust sits IN the
      // lanes (the dark side of each arm), offset just inward of the star ridge.
      const spur = Math.sin(r * 0.9 + branchAngle * 3.0) * 0.10 + Math.sin(r * 2.7) * 0.04
      const a = branchAngle + spinAngle + spur - 0.06 // trail just inside the arm
      const jitter = (rand() - 0.5) * 6.0
      positions[i3] = Math.cos(a) * r + jitter
      // Thin in Y but with a little depth so layers parallax (not a flat sheet).
      positions[i3 + 1] = (rand() - 0.5) * 1.4
      positions[i3 + 2] = Math.sin(a) * r + (rand() - 0.5) * 6.0
      sizes[i] = 14 + rand() * 38
      alphas[i] = 0.05 + rand() * 0.08
      // Cold dark brown-grey dust.
      colors[i3] = 0.06; colors[i3 + 1] = 0.05; colors[i3 + 2] = 0.05
    }
    const geo = new BufferGeometry()
    geo.setAttribute("position", new BufferAttribute(positions, 3))
    geo.setAttribute("aSize", new BufferAttribute(sizes, 1))
    geo.setAttribute("aAlpha", new BufferAttribute(alphas, 1))
    geo.setAttribute("aColor", new BufferAttribute(colors, 3))
    return geo
  }, [mobile])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(gl.getPixelRatio(), 2) },
      uTex: { value: null as Texture | null },
      uHasTex: { value: 0 },
    }),
    [gl],
  )
  const dustUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(gl.getPixelRatio(), 2) },
      uTex: { value: null as Texture | null },
      uHasTex: { value: 0 },
    }),
    [gl],
  )
  // Feed the baked sprite into both materials once it loads.
  useEffect(() => {
    if (!nebulaTex) return
    uniforms.uTex.value = nebulaTex; uniforms.uHasTex.value = 1
    dustUniforms.uTex.value = nebulaTex; dustUniforms.uHasTex.value = 1
  }, [nebulaTex, uniforms, dustUniforms])

  useFrame((_, delta) => {
    // Drift with the disc (slow), and breathe via uTime.
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * 0.0004 * (1 + timeWarpRef.current * 0.05)
    }
    if (matRef.current) {
      ;(matRef.current.uniforms.uTime as { value: number }).value += delta
    }
    if (dustRef.current) {
      dustRef.current.rotation.y += delta * 0.0004 * (1 + timeWarpRef.current * 0.05)
    }
  })

  return (
    <group>
      <points ref={pointsRef} geometry={geometry}>
        <shaderMaterial
          ref={matRef}
          vertexShader={NEBULA_VERTEX_SHADER}
          fragmentShader={NEBULA_FRAGMENT_SHADER}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </points>
      {/* Dark dust lanes — normal blend so they absorb/dim, not glow. */}
      <points ref={dustRef} geometry={dustGeometry}>
        <shaderMaterial
          vertexShader={NEBULA_VERTEX_SHADER}
          fragmentShader={NEBULA_FRAGMENT_SHADER}
          uniforms={dustUniforms}
          transparent
          depthWrite={false}
          blending={NormalBlending}
        />
      </points>
    </group>
  )
}

/* ============================================================
 * Milky Way backdrop — 4 spiral arms + bulge, with hover hit-zones
 * for Sgr A* (galactic centre) and the galaxy itself.
 * ============================================================ */

function MilkyWay({
  onHover,
  mobile = false,
  invert = false,
  interactive = false,
}: {
  onHover: HoverHandler
  mobile?: boolean
  invert?: boolean
  interactive?: boolean
}) {
  const pointsRef = useRef<Points>(null)
  const matRef = useRef<ShaderMaterial>(null)
  const { gl } = useThree()

  const geometry = useMemo(() => {
    // Mobile counts run ~40% of desktop to keep the GPU breathing. The
    // shader is single-draw, so per-star count is the dominant cost.
    const armCount    = mobile ? 9000  : 30000
    const bulgeCount  = mobile ? 2800  : 7000
    const barCount    = mobile ? 900   : 2200
    // HII regions are distributed across a number of anchor clumps so they
    // read as discrete pink star-forming knots tracing the arms, not a haze.
    const hiiClumps   = mobile ? 16    : 38
    const hiiPerClump = 22
    const hiiCount    = hiiClumps * hiiPerClump
    // Globular cluster halo — sparse bright dots in a sphere around the disc.
    const haloCount   = mobile ? 50    : 110

    const total = armCount + bulgeCount + barCount + hiiCount + haloCount
    const positions = new Float32Array(total * 3)
    const sizes     = new Float32Array(total)
    const alphas    = new Float32Array(total)
    const colors    = new Float32Array(total * 3)

    const radius = 130
    const branches = 4
    const spin = 1.3

    // Chart-mode (invert) suppresses per-star colour — every star multiplies
    // through the dark uStarColor uniform, so we want a flat 1,1,1 here.
    // Dark-mode lets the palette through.
    const writeColor = (idx: number, r: number, g: number, b: number) => {
      const i3 = idx * 3
      if (invert) {
        colors[i3] = 1; colors[i3 + 1] = 1; colors[i3 + 2] = 1
      } else {
        colors[i3] = r; colors[i3 + 1] = g; colors[i3 + 2] = b
      }
    }

    // -- Arm stars: young blue O/B stars dominate the outer arms, white
    //    main-sequence stars in the mid arms, warmer yellows shading toward
    //    the bulge. This is what gives the spiral structure a real palette
    //    instead of a flat white wash.
    for (let i = 0; i < armCount; i++) {
      const r = Math.pow(Math.random(), 1.6) * radius
      const branchAngle = ((i % branches) / branches) * Math.PI * 2
      const spinAngle = r * spin * 0.04
      // Arm spurs/feathering — real spiral arms aren't smooth logarithmic
      // curves; they branch into spurs + feathers. A small radius-varying sine
      // perturbation on the angle gives that frayed, structured look instead of
      // four clean ribbons.
      const spur = Math.sin(r * 0.9 + branchAngle * 3.0) * 0.10
        + Math.sin(r * 2.7) * 0.04
      const armAngle = branchAngle + spinAngle + spur

      const randomness = 0.28
      const rx = Math.pow(Math.random(), 2.6) * (Math.random() < 0.5 ? 1 : -1) * randomness * r
      const ry = Math.pow(Math.random(), 2.6) * (Math.random() < 0.5 ? 1 : -1) * randomness * r * 0.12
      const rz = Math.pow(Math.random(), 2.6) * (Math.random() < 0.5 ? 1 : -1) * randomness * r

      const i3 = i * 3
      positions[i3]     = Math.cos(armAngle) * r + rx
      positions[i3 + 1] = ry
      positions[i3 + 2] = Math.sin(armAngle) * r + rz

      const sizeRoll = Math.pow(Math.random(), 3.5)
      sizes[i] = 1.0 + sizeRoll * 5
      const normR = r / radius
      alphas[i] = (0.08 + (1 - normR) * 0.25) * (0.5 + Math.random() * 0.5)

      // Color: bias warmer toward the centre, bluer toward the outskirts.
      const cRoll = Math.random()
      const blueBias = 0.18 + normR * 0.32 // 18% inner → 50% outer chance of a blue/white star
      if (cRoll < blueBias) {
        // Hot young blue-white star (O/B class)
        writeColor(i, 0.74 + Math.random() * 0.10, 0.82 + Math.random() * 0.08, 1.0)
      } else if (cRoll < blueBias + 0.30) {
        // White main-sequence
        const j = 0.95 + Math.random() * 0.05
        writeColor(i, j, j, j)
      } else if (cRoll < blueBias + 0.72) {
        // Warm yellow (sun-like)
        writeColor(i, 1.0, 0.93 + Math.random() * 0.04, 0.72 + Math.random() * 0.06)
      } else {
        // Cool orange / red giant
        writeColor(i, 1.0, 0.78 + Math.random() * 0.05, 0.58 + Math.random() * 0.06)
      }
    }

    // -- Bulge: older Population II — predominantly warm yellows and oranges.
    for (let i = 0; i < bulgeCount; i++) {
      const idx = armCount + i
      const i3 = idx * 3
      const r = Math.abs(gauss()) * radius * 0.18
      const theta = Math.random() * Math.PI * 2
      const phi = (Math.random() - 0.5) * 0.55

      positions[i3]     = r * Math.cos(theta) * Math.cos(phi)
      positions[i3 + 1] = r * Math.sin(phi) * 0.6
      positions[i3 + 2] = r * Math.sin(theta) * Math.cos(phi)

      const sizeRoll = Math.pow(Math.random(), 3)
      sizes[idx] = 2 + sizeRoll * 8
      alphas[idx] = 0.3 + Math.random() * 0.2

      // Warm bulge palette — amber-cream with the occasional red giant.
      if (Math.random() < 0.75) {
        writeColor(idx, 1.0, 0.90 + Math.random() * 0.05, 0.68 + Math.random() * 0.07)
      } else {
        writeColor(idx, 1.0, 0.74 + Math.random() * 0.06, 0.50 + Math.random() * 0.06)
      }
    }

    // -- Central bar: the Milky Way is SBbc — an elongated stellar bar
    //    runs through the bulge along a fixed axis. ~7000 ly half-length
    //    in real units → ~18 scene units half-length. Aligned along X
    //    so the disc rotation carries it naturally.
    const barHalfLength = radius * 0.21
    const barHalfWidth  = radius * 0.045
    const barHalfHeight = radius * 0.020
    for (let i = 0; i < barCount; i++) {
      const idx = armCount + bulgeCount + i
      const i3 = idx * 3
      // Concentrate stars toward the bar's long axis: cube the random
      // for length (mild tapering toward the ends) and gauss-fall for
      // width/height (thin in cross-section).
      const u = (Math.random() * 2 - 1) // -1..1 along the bar
      const along = Math.sign(u) * Math.pow(Math.abs(u), 0.9) * barHalfLength
      const across = gauss() * barHalfWidth * 0.55
      const vert   = gauss() * barHalfHeight * 0.55

      positions[i3]     = along
      positions[i3 + 1] = vert
      positions[i3 + 2] = across

      sizes[idx] = 2 + Math.pow(Math.random(), 2.5) * 6
      alphas[idx] = 0.32 + Math.random() * 0.22

      // Bar shares the bulge's old-population palette.
      writeColor(idx, 1.0, 0.88 + Math.random() * 0.05, 0.62 + Math.random() * 0.07)
    }

    // -- HII star-forming regions: pinkish/magenta clumps tracing the
    //    arms (Hα emission from ionised hydrogen around young hot stars).
    //    Each clump anchors on a spiral-arm position, then sprays a few
    //    points around it for a soft nebular cluster look.
    for (let c = 0; c < hiiClumps; c++) {
      const armR = (0.18 + Math.random() * 0.72) * radius
      const armBranch = Math.floor(Math.random() * branches)
      const branchAngle = (armBranch / branches) * Math.PI * 2
      const spinAngle = armR * spin * 0.04
      const armX = Math.cos(branchAngle + spinAngle) * armR
      const armZ = Math.sin(branchAngle + spinAngle) * armR

      const clumpScatter = 1.6 + Math.random() * 2.2
      for (let k = 0; k < hiiPerClump; k++) {
        const idx = armCount + bulgeCount + barCount + c * hiiPerClump + k
        const i3 = idx * 3
        const dx = gauss() * clumpScatter
        const dy = gauss() * 0.5
        const dz = gauss() * clumpScatter
        positions[i3]     = armX + dx
        positions[i3 + 1] = dy
        positions[i3 + 2] = armZ + dz

        sizes[idx]  = 3 + Math.random() * 4
        alphas[idx] = 0.35 + Math.random() * 0.35
        // Pink Hα emission with a touch of magenta variation. Hot blue stars
        // sometimes peek through as bluer cores — vary slightly per point.
        if (Math.random() < 0.18) {
          writeColor(idx, 0.78, 0.86, 1.0)
        } else {
          writeColor(idx, 1.0, 0.46 + Math.random() * 0.08, 0.70 + Math.random() * 0.10)
        }
      }
    }

    // -- Globular cluster halo: a sparse sphere of bright old clusters
    //    surrounding the disc. Spread well above and below the plane to
    //    sell the 3D structure of the galaxy.
    for (let i = 0; i < haloCount; i++) {
      const idx = armCount + bulgeCount + barCount + hiiCount + i
      const i3 = idx * 3
      // Spherical distribution biased outside the disc.
      const haloR = radius * (0.45 + Math.pow(Math.random(), 1.4) * 0.85)
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      positions[i3]     = haloR * Math.sin(phi) * Math.cos(theta)
      positions[i3 + 1] = haloR * Math.cos(phi) * 0.85
      positions[i3 + 2] = haloR * Math.sin(phi) * Math.sin(theta)

      sizes[idx] = 4 + Math.random() * 4
      alphas[idx] = 0.55 + Math.random() * 0.25
      // Warm old-cluster colour.
      writeColor(idx, 1.0, 0.86 + Math.random() * 0.05, 0.62 + Math.random() * 0.08)
    }

    const geo = new BufferGeometry()
    geo.setAttribute("position", new BufferAttribute(positions, 3))
    geo.setAttribute("aSize", new BufferAttribute(sizes, 1))
    geo.setAttribute("aAlpha", new BufferAttribute(alphas, 1))
    geo.setAttribute("aColor", new BufferAttribute(colors, 3))
    return geo
  }, [mobile, invert])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(gl.getPixelRatio(), 2) },
      uStarColor: { value: new Color(invert ? "#0a0a0a" : "#ffffff") },
      // Dark-mode brightness gain so the Milky Way band reads clearly against
      // ink (additive + ACES tone-mapping was washing it faint). Chart mode
      // keeps 1.0 — its NormalBlending ink look was already correct.
      uBrightness: { value: invert ? 1.0 : 1.9 },
    }),
    [gl, invert],
  )

  useFrame((_, delta) => {
    // Galactic rotation — real Milky Way takes ~225 million years per
    // rotation at the Sun's distance from the core. Even at our maximum
    // time warp that resolves to imperceptible drift, so we keep a small
    // base drift scaled to time warp: feels alive at idle, speeds up
    // noticeably when the user pushes the warp slider. Was a flat 0.008
    // rad/s — ~75,000× too fast and read as a carousel spin.
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * 0.0004 * (1 + timeWarpRef.current * 0.05)
    }
    if (matRef.current) {
      ;(matRef.current.uniforms.uTime as { value: number }).value += delta
    }
  })

  return (
    <group>
      <points ref={pointsRef} geometry={geometry}>
        <shaderMaterial
          ref={matRef}
          vertexShader={GALAXY_VERTEX_SHADER}
          fragmentShader={GALAXY_FRAGMENT_SHADER}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          // Additive looks right against ink; on cream paper additive blending
          // bleaches stars to invisible — fall back to NormalBlending then.
          blending={invert ? NormalBlending : AdditiveBlending}
        />
      </points>

      {/* Diffuse nebula / dust haze — soft glowing gas clouds tracing the
          arms (Hα-pink, dusty blue, amber). Skipped in chart mode. */}
      {!invert && <NebulaClouds mobile={mobile} />}

      {/* Sgr A* — the Milky Way's 4.15 million-M☉ supermassive black hole.
          Visible mark sized to be a small accent inside the bulge, not a
          dominant feature. (Earlier 0.9 / 2.4 was wildly too large — looked
          like a marble swallowing the core.) Real Sgr A* would be invisibly
          small at this scale; this is just a "you are here" mark. */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.12, 24, 24]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.35, 20, 20]} />
        <meshBasicMaterial
          color={invert ? "#5a2818" : "#ffb878"}
          transparent
          opacity={invert ? 0.30 : 0.45}
          blending={invert ? NormalBlending : AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {/* Hit-target — larger sphere so the BH is easy to hover/click against
          the dense star backdrop. Invisible material. */}
      <mesh
        position={[0, 0, 0]}
        onPointerOver={(e) => {
          e.stopPropagation()
          onHover(SGR_A_INFO)
        }}
        onPointerOut={() => {
          onHover(null)
        }}
        onClick={makeFocusHandler(interactive, 38, "Sagittarius A*")}
      >
        <sphereGeometry args={[6, 24, 24]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Wider Milky Way bulge hit-zone */}
      <mesh
        position={[0, 0, 0]}
        onPointerOver={(e) => {
          e.stopPropagation()
          onHover(MILKY_WAY_INFO)
        }}
        onPointerOut={() => {
          onHover(null)
        }}
      >
        <sphereGeometry args={[35, 24, 24]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

    </group>
  )
}

/* ============================================================
 * Moons — orbit their parent planet's equatorial plane.
 * ============================================================ */

function MoonBody({
  moon,
  onHover,
  highlighted = false,
  interactive = false,
  invert = false,
}: {
  moon: MoonData
  onHover: HoverHandler
  /** Set by the parent planet's hover state — gives the moon a coordinated scale-up + halo. */
  highlighted?: boolean
  /** When true, clicks engage follow mode on the moon. Same gesture as planets + comets. */
  interactive?: boolean
  invert?: boolean
}) {
  const orbitRef = useRef<Group>(null)
  const bodyRef = useRef<Mesh>(null)
  const haloRef = useRef<Mesh>(null)
  // The Moon has real human-made orbiters (LRO, etc.). When the Satellites
  // toggle is on, show a small shell scaled to the Moon's surface.
  const isLuna = moon.name.startsWith("Moon")
  const [moonSatsOn, setMoonSatsOn] = useState(false)
  const haloMatRef = useRef<import("three").MeshBasicMaterial>(null)
  /** Mesh ref on the textured moon surface — needed to read world position
   *  for the day/night shader's sun-direction uniform. */
  const texMeshRef = useRef<Mesh>(null)
  /** Day/night shader for tidally-locked moons with a real surface texture
   *  (just Luna today). Drives the lunar-phase visual: as the moon orbits
   *  the planet, the lit hemisphere rotates relative to it = phases. */
  const dayNightMatRef = useRef<ShaderMaterial>(null)
  const [texture, setTexture] = useState<Texture | null>(null)
  const dayNightUniforms = useMemo(
    () => ({
      tDay:                 { value: null as Texture | null },
      tNight:               { value: null as Texture | null },
      uSunDir:              { value: new Vector3(1, 0, 0) },
      uOpacity:             { value: 0 },
      uNightStrength:       { value: 0 },
      uHasNight:            { value: 0 },     // airless body
      uTerminatorSoftness:  { value: 0.04 },  // razor-sharp lunar terminator
      uPolarFix:            { value: 0 },     // moons don't need the polar-smear fix
      uPolarTint:           { value: new Color("#ffffff") },
    }),
    [],
  )
  useEffect(() => {
    if (texture) dayNightUniforms.tDay.value = texture
  }, [texture, dayNightUniforms])

  // Stable phase offset per moon (radians). Derived deterministically from
  // the moon's name rather than Math.random() so scrubbing the timeline
  // lands the moon at the same place every time you revisit a date — a
  // random phase would jump on every remount. We don't have per-moon J2000
  // ephemerides, so this is a fixed offset on top of date-driven motion,
  // not a true anchor: the period is real, the absolute longitude is not.
  const startPhase = useMemo(() => {
    let h = 0
    for (let i = 0; i < moon.name.length; i++) h = (h * 31 + moon.name.charCodeAt(i)) >>> 0
    return (h % 360) * DEG
  }, [moon.name])

  // Eagerly load the moon's surface texture on mount — same always-visible
  // treatment as the planets. Luna is the only moon shipping a texture today
  // (~550 KB WebP), and TextureLoader is async so first paint still lands fast.
  const textureUrl = moon.textureUrl
  useEffect(() => {
    if (!textureUrl || texture) return
    const loader = new TextureLoader()
    loader.load(textureUrl, (tex) => {
      tex.colorSpace = SRGBColorSpace
      tex.anisotropy = 8
      setTexture(tex)
    })
  }, [textureUrl, texture])

  useFrame((_, delta) => {
    // Date-driven so moons stay in lockstep with the scrubbable clock.
    if (orbitRef.current) {
      orbitRef.current.rotation.y = meanAnomalyAt(startPhase, moon.periodDays, simTimeRef.current.simMs)
    }
    // Poll the satellites toggle for the Moon's orbiter shell.
    if (isLuna) {
      const want = satellitesVisibleRef.current
      if (want !== moonSatsOn) setMoonSatsOn(want)
    }

    // Lerp the moon's visual emphasis when the parent planet is hovered.
    const k = 1 - Math.exp(-delta * 10)
    const scaleTarget = highlighted ? 1.6 : 1.0
    if (bodyRef.current) {
      const s = bodyRef.current.scale.x
      const next = s + (scaleTarget - s) * k
      bodyRef.current.scale.set(next, next, next)
    }
    if (haloRef.current) {
      // Halo size tuned tight (1.5×) so the moon is findable from far
      // away without the halo punching through the parent planet's
      // atmosphere on close zoom. Pre-tuning was 2.6× and blew out
      // Earth's atmosphere halo whenever Earth + Moon shared screen.
      const haloTarget = highlighted ? 1.5 : 0.001
      const s = haloRef.current.scale.x
      const next = s + (haloTarget - s) * k
      haloRef.current.scale.set(next, next, next)
    }
    if (haloMatRef.current) {
      // Halo opacity dropped from 0.35 → 0.18 for the same reason — the
      // additive blend at 0.35 dominated whatever was behind it.
      const opacityTarget = highlighted ? 0.18 : 0
      haloMatRef.current.opacity += (opacityTarget - haloMatRef.current.opacity) * k
    }
    // Day/night path (Luna) — lerp opacity AND update sun direction so
    // the moon's lit hemisphere shifts with its orbital phase. Real
    // lunar phases come out of this without any per-phase keyframes.
    // (The old meshStandardMaterial-based texture overlay was replaced
    // when the shader took over — no parallel opacity lerp needed.)
    if (texMeshRef.current && textureUrl) {
      const target = texture ? 1 : 0
      dayNightUniforms.uOpacity.value += (target - dayNightUniforms.uOpacity.value) * k
      texMeshRef.current.getWorldPosition(_earthWorldPos)
      _sunWorldPos.set(SUN_OFFSET_SCENE, 0, 0)
      _sunDirTmp.copy(_sunWorldPos).sub(_earthWorldPos).normalize()
      dayNightUniforms.uSunDir.value.copy(_sunDirTmp)
    }
  })

  const hitRadius = Math.max(moon.visualRadius * 3, 0.12)

  return (
    <group ref={orbitRef}>
      {/* Halo — only visible when the parent planet is being hovered. */}
      <mesh ref={haloRef} position={[moon.orbitRadius, 0, 0]} scale={0.001}>
        <sphereGeometry args={[moon.visualRadius, 16, 16]} />
        <meshBasicMaterial
          ref={haloMatRef as React.Ref<import("three").MeshBasicMaterial>}
          color="#fff2b8"
          transparent
          opacity={0}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={bodyRef} position={[moon.orbitRadius, 0, 0]}>
        <sphereGeometry args={[moon.visualRadius, 24, 24]} />
        <meshStandardMaterial color={moon.shade} roughness={0.95} />
        {/* Textured-globe overlay — currently only Luna ships a real surface
            map. Uses the day/night shader so the moon shows real lunar
            phases as it orbits its parent (the lit hemisphere rotates
            relative to the Sun's fixed position). Razor-sharp terminator
            because the Moon has no atmosphere. */}
        {textureUrl && texture && (
          <mesh ref={texMeshRef}>
            <sphereGeometry args={[moon.visualRadius * 1.01, 48, 48]} />
            <shaderMaterial
              ref={dayNightMatRef as React.Ref<ShaderMaterial>}
              vertexShader={DAY_NIGHT_VERTEX_SHADER}
              fragmentShader={DAY_NIGHT_FRAGMENT_SHADER}
              uniforms={dayNightUniforms}
              transparent
              depthWrite={false}
            />
          </mesh>
        )}
        {/* Surface landing-site pins — Apollo 11-17, Luna 9, Chang'e 4
            on the Moon. Uses the same RoverPin component as Mars; pins
            are children of bodyRef so they ride with the tidally-locked
            face that the Moon's body presents to its parent planet. */}
        {moon.surfaceFeatures && highlighted && moon.surfaceFeatures.map((feature) => (
          <RoverPin
            key={feature.name}
            feature={feature}
            planetRadius={moon.visualRadius}
            invert={invert}
            onHover={onHover}
          />
        ))}
      </mesh>

      {/* Lunar orbiter shell — LRO, Chang'e relays, Lunar Gateway-era craft.
          Real altitudes hug the surface (LRO ~50 km over a 1,737 km Moon →
          ~1.03 R), so the shell sits tight to the body. Shown when Satellites
          is toggled on. */}
      {isLuna && moonSatsOn && (
        <group position={[moon.orbitRadius, 0, 0]}>
          <SatelliteShells
            shells={[
              { label: "Low lunar orbit (LRO …)", launchMs: Date.UTC(2009, 5, 18), altRatio: 1.05, count: 40, color: "#dfe8ff", incl: 1.4, speed: 0.22 },
              { label: "Lunar relay / frozen orbit", launchMs: Date.UTC(1966, 7, 10), altRatio: 1.35, count: 14, color: "#ffd9a0", incl: 1.1, speed: 0.12 },
            ]}
            bodyRadius={moon.visualRadius}
          />
        </group>
      )}

      <mesh
        position={[moon.orbitRadius, 0, 0]}
        onPointerOver={(e) => {
          e.stopPropagation()
          onHover({
            name: moon.name,
            classification: `Moon of ${moon.parent}`,
            periodDays: moon.periodDays,
            fact: moon.fact,
            deep: moon.deep,
            followable: interactive,
          })
        }}
        onPointerOut={() => {
          onHover(null)
        }}
        // Click engages follow on the moon — same gesture pattern as
        // planets, comets, and spacecraft. The getter reads the moon
        // body's live world position each frame so the camera stays
        // glued to it as it orbits the parent planet (which is itself
        // orbiting the Sun). Distance scales with the moon's visual
        // radius so Phobos at 0.025 and Titan at 0.08 both frame
        // sensibly. The hit-mesh `e.object` is positioned inside the
        // orbit-rotated group, so its world position is always current.
        onClick={
          interactive
            ? (e) => {
                e.stopPropagation()
                const followDistance = Math.max(moon.visualRadius * 3.2, 0.09)
                const obj = e.object
                requestFollow(
                  () => {
                    const v = new Vector3()
                    obj.getWorldPosition(v)
                    return { x: v.x, y: v.y, z: v.z }
                  },
                  followDistance,
                  moon.name,
                )
              }
            : undefined
        }
        onDoubleClick={
          interactive
            ? (e) => {
                e.stopPropagation()
                const followDistance = Math.max(moon.visualRadius * 3.2, 0.09)
                const obj = e.object
                requestFollow(
                  () => {
                    const v = new Vector3()
                    obj.getWorldPosition(v)
                    return { x: v.x, y: v.y, z: v.z }
                  },
                  followDistance,
                  moon.name,
                )
              }
            : undefined
        }
      >
        <sphereGeometry args={[hitRadius, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

/* ============================================================
 * Constellations
 *
 * The catalog (Big Dipper, Polaris, Orion, Cassiopeia, Leo, Lyra, Cygnus)
 * lives in astronomy.ts. Each constellation carries member stars + an edges
 * list that names which pairs the asterism line connects.
 *
 * Hover behavior: pointing at ANY star or asterism segment activates the
 * whole constellation. Active state lerps every frame:
 *   - member stars scale up and grow a warm halo
 *   - asterism lines brighten + warm to a constellation accent
 *
 * Polaris is a single-star "constellation" with `clickAction: 'reset-view'`,
 * so clicking it resets the camera to its initial framing.
 * ============================================================ */

type LineMatRef = import("three").LineBasicMaterial

function AsterismLine({
  stars,
  edges,
  active,
  invert = false,
}: {
  stars: ConstellationStar[]
  edges: [number, number][]
  active: boolean
  invert?: boolean
}) {
  const matRef = useRef<LineMatRef>(null)
  // Chart-mode (light theme): ink hairlines that flush warmer amber on hover,
  // mimicking how a vintage map annotates traced constellations in red-orange.
  const colorTarget = useMemo(() => new Color(invert ? "#0a0a0a" : "#ffffff"), [invert])
  const colorActive = useMemo(() => new Color(invert ? "#b34a13" : "#ffd66b"), [invert])
  // Idle opacity is higher in chart mode — dark ink on cream needs to read
  // without the additive bloom that helps it pop against deep space.
  const idleOpacity = invert ? 0.45 : 0.18
  const activeOpacity = invert ? 0.95 : 0.9

  const geometry = useMemo(() => {
    if (edges.length === 0) {
      const geo = new BufferGeometry()
      geo.setAttribute("position", new BufferAttribute(new Float32Array(0), 3))
      return geo
    }
    const arr = new Float32Array(edges.length * 2 * 3)
    edges.forEach(([a, b], i) => {
      const pa = raDecToScenePos(stars[a].raHours, stars[a].decDeg, SKY_SHELL_DISTANCE)
      const pb = raDecToScenePos(stars[b].raHours, stars[b].decDeg, SKY_SHELL_DISTANCE)
      arr[i * 6]     = pa[0]
      arr[i * 6 + 1] = pa[1]
      arr[i * 6 + 2] = pa[2]
      arr[i * 6 + 3] = pb[0]
      arr[i * 6 + 4] = pb[1]
      arr[i * 6 + 5] = pb[2]
    })
    const geo = new BufferGeometry()
    geo.setAttribute("position", new BufferAttribute(arr, 3))
    return geo
  }, [stars, edges])

  // Lerp opacity + color toward target each frame for a smooth highlight.
  useFrame((_, delta) => {
    if (!matRef.current) return
    const targetOpacity = active ? activeOpacity : idleOpacity
    const k = 1 - Math.exp(-delta * 8)
    matRef.current.opacity += (targetOpacity - matRef.current.opacity) * k
    matRef.current.color.lerp(active ? colorActive : colorTarget, k)
  })

  if (edges.length === 0) return null

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial
        ref={matRef as React.Ref<LineMatRef>}
        color={invert ? "#0a0a0a" : "#ffffff"}
        transparent
        opacity={idleOpacity}
        depthWrite={false}
      />
    </lineSegments>
  )
}

/**
 * Constellation stars are real stars, but for most the detailed composition isn't
 * pinned down here. This returns an HONEST exploration line: known facts for the
 * well-studied headline stars, otherwise a clearly-labelled INFERENCE of what the
 * star is likely like, derived only from its apparent magnitude (a real cue to
 * luminosity class) — never presenting a guess as measured fact.
 */
const CONSTELLATION_STAR_LORE: Record<string, { type: string; note: string }> = {
  Betelgeuse: { type: "Red supergiant (M1-2)", note: "~700× the Sun's radius; nearing the end of its life — a future supernova." },
  Rigel:      { type: "Blue supergiant (B8)", note: "~120,000× the Sun's luminosity, ~860 ly away — far hotter and younger than Betelgeuse." },
  Bellatrix:  { type: "Blue giant (B2)", note: "Hot, ~6× the Sun's mass; Orion's left shoulder." },
  Aldebaran:  { type: "Orange giant (K5)", note: "A cooling red giant ~65 ly away — the fiery eye of Taurus." },
  Antares:    { type: "Red supergiant (M1)", note: "The 'rival of Mars' — vast and cool, a future supernova at the heart of Scorpius." },
  Spica:      { type: "Hot blue binary (B1)", note: "Two scorching blue stars orbiting every ~4 days, mutually distorted by gravity." },
  Deneb:      { type: "Blue-white supergiant (A2)", note: "One of the most luminous stars known — ~1,400 ly away yet still brilliant." },
  Vega:       { type: "White main-sequence (A0)", note: "A fast-spinning young A-star 25 ly away; defined magnitude zero." },
  Altair:     { type: "White main-sequence (A7)", note: "Spins so fast (~9 hr) it's visibly flattened; 17 ly away." },
  Pollux:     { type: "Orange giant (K0)", note: "The nearest giant star to the Sun (~34 ly) and host to a known exoplanet." },
  Regulus:    { type: "Blue-white (B8)", note: "A rapid rotator near break-up speed; the heart of Leo." },
}

/** Magnitude-only inference when we don't have the star's catalogued type. */
function inferStarCharacter(mag: number): string {
  if (mag < 0.5)  return "very luminous — likely a giant or supergiant, or a hot nearby star"
  if (mag < 1.5)  return "bright — probably a giant or a hot/large main-sequence star"
  if (mag < 2.5)  return "moderately bright to the eye — a luminous distant star or a closer Sun-like one"
  return "fainter to the eye — likely a more ordinary or more distant star"
}

function ConstellationStarMesh({
  star,
  active,
  isClickable,
  isPolaris,
  invert = false,
  onActivate,
  onDeactivate,
  onClick,
  onHover,
  constellationName,
  constellationFact,
}: {
  star: ConstellationStar
  active: boolean
  isClickable: boolean
  isPolaris: boolean
  invert?: boolean
  onActivate: () => void
  onDeactivate: () => void
  onClick?: () => void
  onHover: HoverHandler
  constellationName: string
  constellationFact: string
}) {
  const meshRef = useRef<Mesh>(null)
  const haloRef = useRef<Mesh>(null)
  const haloMatRef = useRef<import("three").MeshBasicMaterial>(null)
  const dotMatRef = useRef<import("three").MeshBasicMaterial>(null)

  const position = useMemo(
    () => raDecToScenePos(star.raHours, star.decDeg, SKY_SHELL_DISTANCE),
    [star.raHours, star.decDeg],
  )
  const baseRadius = magToVisualRadius(star.magnitude) * (isPolaris ? 1.4 : 1.0)
  // Chart-mode colours: ink dots on cream with a warm amber halo on hover.
  const dotColor = invert ? "#0a0a0a" : "#ffffff"
  const haloColorIdle = useMemo(
    () => new Color(invert ? "#1a1006" : "#ffffff"),
    [invert],
  )
  const haloColorActive = useMemo(
    () => new Color(invert ? "#b34a13" : "#fff2b8"),
    [invert],
  )
  // Idle halo opacity needs to be lower on cream (we don't have additive bloom)
  // or the warm tint becomes a muddy smear behind every star.
  const haloOpacityIdle = invert ? 0.08 : 0.18
  const haloOpacityActive = invert ? 0.55 : 0.6

  // Animated scale + halo brightness — lerp each frame so the highlight
  // doesn't snap. Same target reached from any direction.
  useFrame((_, delta) => {
    const k = 1 - Math.exp(-delta * 10)
    const targetScale = active ? 1.6 : 1.0
    if (meshRef.current) {
      const s = meshRef.current.scale.x
      const next = s + (targetScale - s) * k
      meshRef.current.scale.set(next, next, next)
    }
    if (haloRef.current) {
      const haloTarget = active ? 3.2 : 2.2
      const s = haloRef.current.scale.x
      const next = s + (haloTarget - s) * k
      haloRef.current.scale.set(next, next, next)
    }
    if (haloMatRef.current) {
      const opacityTarget = active ? haloOpacityActive : haloOpacityIdle
      haloMatRef.current.opacity += (opacityTarget - haloMatRef.current.opacity) * k
      haloMatRef.current.color.lerp(active ? haloColorActive : haloColorIdle, k)
    }
  })

  return (
    <group position={position}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[baseRadius, 16, 16]} />
        <meshBasicMaterial ref={dotMatRef as React.Ref<import("three").MeshBasicMaterial>} color={dotColor} />
      </mesh>
      <mesh ref={haloRef}>
        <sphereGeometry args={[baseRadius, 12, 12]} />
        <meshBasicMaterial
          ref={haloMatRef as React.Ref<import("three").MeshBasicMaterial>}
          color={dotColor}
          transparent
          opacity={haloOpacityIdle}
          // Normal blending on cream so the halo doesn't bleach to invisible.
          blending={invert ? NormalBlending : AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh
        onPointerOver={(e) => {
          e.stopPropagation()
          onActivate()
          {
            const lore = CONSTELLATION_STAR_LORE[star.name]
            const explore = lore
              ? `${lore.type}. ${lore.note}`
              : `Composition not catalogued here — but from its brightness it's ${inferStarCharacter(star.magnitude)}.`
            onHover({
              name: star.name,
              classification: star.designation,
              apparentMag: star.magnitude,
              spectralType: lore?.type,
              fact: `${isPolaris ? constellationFact : `Part of ${constellationName} — ${constellationFact}`}\n\n★ ${explore}`,
              clickable: isClickable,
            })
          }
        }}
        onPointerOut={() => {
          onDeactivate()
          onHover(null)
        }}
        onClick={(e) => {
          if (!onClick) return
          e.stopPropagation()
          onClick()
        }}
      >
        <sphereGeometry args={[baseRadius * 4, 12, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

function ConstellationGroup({
  constellation,
  active,
  setActive,
  onResetView,
  onHover,
  invert = false,
}: {
  constellation: Constellation
  active: boolean
  setActive: (id: ConstellationId | null) => void
  onResetView: () => void
  onHover: HoverHandler
  invert?: boolean
}) {
  const isClickable = constellation.clickAction === "reset-view"
  const isPolaris = constellation.id === "polaris"
  const onClick = isClickable ? onResetView : undefined

  // Centroid of the constellation's stars — anchor for the hover label.
  // Single-star "constellations" (Polaris) anchor on the star itself.
  const centroid = useMemo<[number, number, number]>(() => {
    const pts = constellation.stars.map((s) =>
      raDecToScenePos(s.raHours, s.decDeg, SKY_SHELL_DISTANCE),
    )
    const sum = pts.reduce(
      (acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]] as [number, number, number],
      [0, 0, 0] as [number, number, number],
    )
    const cx = sum[0] / pts.length
    const cy = sum[1] / pts.length
    const cz = sum[2] / pts.length
    return [cx, cy, cz]
  }, [constellation.stars])

  return (
    <group>
      <AsterismLine
        stars={constellation.stars}
        edges={constellation.edges}
        active={active}
        invert={invert}
      />

      {/* Mythological figure overlay — Hevelius / Bayer celestial-atlas
          tradition. Renders the constellation's classical figure as a
          thin-line SVG over the stars when the constellation is active.
          Five constellations carry figures (Orion, Leo, Cygnus, Lyra,
          Cassiopeia); Big Dipper + Polaris stay as-is. Catalog of figures
          lives in constellation-figures.tsx so adding more is a one-file edit. */}
      {active && CONSTELLATION_FIGURES[constellation.id] && (
        <Html
          position={centroid}
          center
          distanceFactor={CONSTELLATION_FIGURES[constellation.id]!.sizeFactor}
          zIndexRange={[5, 0]}
          style={{ pointerEvents: "none" }}
        >
          <div
            className={`
              select-none pointer-events-none
              ${invert ? "text-foreground" : "text-white"}
            `}
            style={{
              width: 200,
              height: 200,
              opacity: CONSTELLATION_FIGURES[constellation.id]!.opacityTarget,
              animation: "ue-label-in 360ms ease-out both",
            }}
          >
            {CONSTELLATION_FIGURES[constellation.id]!.render()}
          </div>
        </Html>
      )}

      {/* Hover label — fades in when the constellation is active.
          Rendered as an in-scene canvas-textured sprite (WebGLLabel) rather than
          a DOM <Html> overlay, so it sits at the constellation's true depth and
          is depth-tested like everything else — it can be occluded by the Sun or
          a planet instead of floating in front of them. The label's text is
          measured + wrapped reflow-free via pretext (canvas font engine, no
          getBoundingClientRect), so building the texture never forces a layout. */}
      {active && (
        <WebGLLabel
          text={constellation.name.toUpperCase()}
          position={centroid}
          fontSizePx={40}
          maxWidthPx={480}
          color={invert ? "#0b0e0d" : "#ffffff"}
          background={invert ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.55)"}
          scale={SKY_SHELL_DISTANCE * 0.05}
        />
      )}
      {/* Also let the user hover the asterism line itself — invisible thick
          hit segments along each edge so the line isn't just decorative. */}
      {constellation.edges.map(([a, b], i) => (
        <EdgeHitZone
          key={i}
          a={constellation.stars[a]}
          b={constellation.stars[b]}
          onActivate={() => setActive(constellation.id)}
          onDeactivate={() => setActive(null)}
          onHover={onHover}
          info={{
            name: constellation.name,
            classification: constellation.designation,
            fact: constellation.fact,
          }}
        />
      ))}
      {constellation.stars.map((star, index) => (
        <ConstellationStarMesh
          key={`${constellation.id}:${star.name || star.designation || index}`}
          star={star}
          active={active}
          isClickable={isClickable}
          isPolaris={isPolaris}
          invert={invert}
          onActivate={() => setActive(constellation.id)}
          onDeactivate={() => setActive(null)}
          onClick={onClick}
          onHover={onHover}
          constellationName={constellation.name}
          constellationFact={constellation.fact}
        />
      ))}
    </group>
  )
}

function EdgeHitZone({
  a,
  b,
  onActivate,
  onDeactivate,
  onHover,
  info,
}: {
  a: ConstellationStar
  b: ConstellationStar
  onActivate: () => void
  onDeactivate: () => void
  onHover: HoverHandler
  info: { name: string; classification: string; fact: string }
}) {
  // Build a thin cylinder along the edge as an invisible hover target so
  // pointing at the asterism line itself also activates the constellation.
  const { position, rotation, length } = useMemo(() => {
    const pa = raDecToScenePos(a.raHours, a.decDeg, SKY_SHELL_DISTANCE)
    const pb = raDecToScenePos(b.raHours, b.decDeg, SKY_SHELL_DISTANCE)
    const dx = pb[0] - pa[0]
    const dy = pb[1] - pa[1]
    const dz = pb[2] - pa[2]
    const len = Math.hypot(dx, dy, dz)
    const mid: [number, number, number] = [
      (pa[0] + pb[0]) / 2,
      (pa[1] + pb[1]) / 2,
      (pa[2] + pb[2]) / 2,
    ]
    // Default cylinder axis = Y. Rotate to point along (dx, dy, dz).
    const yaw = Math.atan2(dx, dz)
    const pitch = Math.atan2(Math.sqrt(dx * dx + dz * dz), dy)
    return {
      position: mid,
      rotation: [pitch, yaw, 0] as [number, number, number],
      length: len,
    }
  }, [a.raHours, a.decDeg, b.raHours, b.decDeg])

  return (
    <mesh
      position={position}
      rotation={rotation}
      onPointerOver={(e) => {
        e.stopPropagation()
        onActivate()
        onHover(info)
      }}
      onPointerOut={() => {
        onDeactivate()
        onHover(null)
      }}
    >
      <cylinderGeometry args={[0.7, 0.7, length, 8, 1, true]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}

function Constellations({
  onHover,
  onResetView,
  invert = false,
}: {
  onHover: HoverHandler
  onResetView: () => void
  invert?: boolean
}) {
  const [active, setActive] = useState<ConstellationId | null>(null)

  return (
    <group>
      {constellations.map((c) => (
        <ConstellationGroup
          key={c.id}
          constellation={c}
          active={active === c.id}
          setActive={setActive}
          onResetView={onResetView}
          onHover={onHover}
          invert={invert}
        />
      ))}
    </group>
  )
}

/* ============================================================
 * Shooting stars — cyclical meteor streaks across the sky.
 * ============================================================ */

function Meteor({ baseDelay, invert = false }: { baseDelay: number; invert?: boolean }) {
  const groupRef = useRef<Group>(null)
  const stateRef = useRef({
    t: -baseDelay,
    duration: 2.2 + Math.random() * 1.8,
    cooldown: 6 + Math.random() * 14,
    origin: [0, 0, 0] as [number, number, number],
    direction: [0, 0, 0] as [number, number, number],
    length: 0,
  })

  const resetMeteor = () => {
    const r = 50 + Math.random() * 30
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    const ox = r * Math.sin(phi) * Math.cos(theta) + SUN_OFFSET_SCENE
    const oy = r * Math.cos(phi) * 0.5
    const oz = r * Math.sin(phi) * Math.sin(theta)

    const tx = SUN_OFFSET_SCENE + (Math.random() - 0.5) * 30
    const ty = (Math.random() - 0.5) * 10
    const tz = (Math.random() - 0.5) * 30
    const dx = tx - ox
    const dy = ty - oy
    const dz = tz - oz
    const mag = Math.hypot(dx, dy, dz)

    stateRef.current.origin = [ox, oy, oz]
    stateRef.current.direction = [dx / mag, dy / mag, dz / mag]
    stateRef.current.length = 30 + Math.random() * 25
    stateRef.current.duration = 2.2 + Math.random() * 1.8
    stateRef.current.cooldown = 6 + Math.random() * 14
    stateRef.current.t = 0
  }

  useEffect(() => {
    resetMeteor()
    stateRef.current.t = -baseDelay
  }, [baseDelay])

  useFrame((_, delta) => {
    const s = stateRef.current
    s.t += delta

    if (!groupRef.current) return

    if (s.t < 0) {
      groupRef.current.visible = false
      return
    }
    if (s.t > s.duration) {
      groupRef.current.visible = false
      if (s.t > s.duration + s.cooldown) {
        resetMeteor()
      }
      return
    }

    groupRef.current.visible = true
    const progress = s.t / s.duration
    const x = s.origin[0] + s.direction[0] * progress * s.length
    const y = s.origin[1] + s.direction[1] * progress * s.length
    const z = s.origin[2] + s.direction[2] * progress * s.length
    groupRef.current.position.set(x, y, z)
  })

  const streakGeometry = useMemo(() => {
    const arr = new Float32Array(2 * 3)
    arr[0] = 0; arr[1] = 0; arr[2] = 0
    arr[3] = -1.2; arr[4] = 0; arr[5] = 0
    const geo = new BufferGeometry()
    geo.setAttribute("position", new BufferAttribute(arr, 3))
    return geo
  }, [])

  // On cream paper, ink streaks read as inked-meteor lines on a chart.
  const meteorColor = invert ? "#0a0a0a" : "#ffffff"
  const streakOpacity = invert ? 0.6 : 0.4

  return (
    <group ref={groupRef}>
      <mesh>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshBasicMaterial color={meteorColor} />
      </mesh>
      <threeLine geometry={streakGeometry}>
        <lineBasicMaterial color={meteorColor} transparent opacity={streakOpacity} />
      </threeLine>
    </group>
  )
}

function ShootingStars({ count = 6, invert = false }: { count?: number; invert?: boolean }) {
  return (
    <group>
      {Array.from({ length: count }).map((_, i) => (
        <Meteor key={i} baseDelay={i * 3 + Math.random() * 5} invert={invert} />
      ))}
    </group>
  )
}



/* ============================================================
 * Belts (asteroid + Kuiper)
 * ============================================================ */

function Belt({
  innerRadius,
  outerRadius,
  count,
  thickness,
  rotationSpeed,
  pointSize,
  opacity,
  info,
  onHover,
  invert = false,
}: {
  innerRadius: number
  outerRadius: number
  count: number
  thickness: number
  rotationSpeed: number
  pointSize: number
  opacity: number
  info: import("./types").BodyInfo
  onHover: HoverHandler
  invert?: boolean
}) {
  const ref = useRef<Points>(null)

  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const r = innerRadius + Math.random() * (outerRadius - innerRadius)
      const angle = Math.random() * Math.PI * 2
      const y = (Math.random() - 0.5) * thickness
      positions[i * 3] = Math.cos(angle) * r
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = Math.sin(angle) * r
    }
    const geo = new BufferGeometry()
    geo.setAttribute("position", new BufferAttribute(positions, 3))
    return geo
  }, [innerRadius, outerRadius, count, thickness])

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * rotationSpeed
  })

  const midRadius = (innerRadius + outerRadius) / 2
  const halfWidth = (outerRadius - innerRadius) / 2

  return (
    <group>
      <points ref={ref} geometry={geometry}>
        <pointsMaterial
          size={pointSize}
          sizeAttenuation
          // Ink dust on cream; pale grey on ink — same role, opposite end of the value scale.
          color={invert ? "#1a1208" : "#bcbcbc"}
          depthWrite={false}
          transparent
          opacity={opacity}
        />
      </points>
      <mesh
        rotation={[Math.PI / 2, 0, 0]}
        onPointerOver={(e) => {
          e.stopPropagation()
          onHover(info)
        }}
        onPointerOut={() => {
          onHover(null)
        }}
      >
        <torusGeometry args={[midRadius, halfWidth, 8, 96]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

/* ============================================================
 * Belt asteroids — REPRESENTATIVE rocky meshes scattered along the belt ring.
 *
 * TRUTH NOTE: these are NOT specific catalogued asteroids at real positions —
 * the belt holds ~1.9 million objects >1 km, which can't be individually placed.
 * These few dozen Blender rock/nucleus meshes stand in for that uncountable
 * small-body population, scattered by a seeded PRNG across the real belt annulus
 * (2.2–3.2 AU). The NAMED big-4 — Ceres, Vesta, Pallas, Hygiea — ARE real bodies
 * at their true orbital positions (see astronomy.ts); those are the ones you can
 * click + inspect. The scatter is texture; the named bodies are truth.
 *
 * The 3 GLBs load once and are cloned cheaply. Rides the slow belt rotation;
 * skipped in chart mode (keeps the ink map clean).
 * ============================================================ */
const BELT_ROCK_MODELS = [
  "/models/asteroid-stony.glb",
  "/models/asteroid-carbon.glb",
  "/models/comet-nucleus.glb",
] as const
// No module-init preload: the rocks (2.7 MB across 3 GLBs) mount only once the
// user enters explore mode (see SolarSystem), so the passive hero never pays
// for them. The component's own useGLTF suspends + streams them in on mount.

function BeltAsteroids({
  innerRadius,
  outerRadius,
  count,
  thickness,
  rotationSpeed,
  baseScale,
  seed = 1,
}: {
  innerRadius: number
  outerRadius: number
  count: number
  thickness: number
  rotationSpeed: number
  baseScale: number
  seed?: number
}) {
  const ref = useRef<import("three").Group>(null)
  // drei's useGLTF accepts an array natively — one hook call, stable order.
  const gltfs = useGLTF([...BELT_ROCK_MODELS])

  // Deterministic scatter so the belt is stable across re-renders.
  const placements = useMemo(() => {
    let s = seed
    const rand = () => {
      s = (1664525 * s + 1013904223) >>> 0
      return s / 4294967296
    }
    const out: {
      model: number
      pos: [number, number, number]
      rot: [number, number, number]
      scale: number
    }[] = []
    for (let i = 0; i < count; i++) {
      const r = innerRadius + rand() * (outerRadius - innerRadius)
      const a = rand() * Math.PI * 2
      out.push({
        model: Math.floor(rand() * BELT_ROCK_MODELS.length),
        pos: [Math.cos(a) * r, (rand() - 0.5) * thickness, Math.sin(a) * r],
        rot: [rand() * Math.PI * 2, rand() * Math.PI * 2, rand() * Math.PI * 2],
        scale: baseScale * (0.4 + rand() * 1.3),
      })
    }
    return out
  }, [innerRadius, outerRadius, count, thickness, baseScale, seed])

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * rotationSpeed
  })

  return (
    <group ref={ref}>
      {placements.map((p, i) => (
        <Clone
          key={i}
          object={gltfs[p.model].scene}
          position={p.pos}
          rotation={p.rot}
          scale={p.scale}
        />
      ))}
    </group>
  )
}

/* ============================================================
 * Satellite shells — human-made orbiters around a body.
 *
 * Real spacecraft number in the thousands (Starlink alone ~6,000), so each
 * orbital regime is a procedural point-field at its true altitude ratio
 * (orbit radius / body radius), color-coded, riding a slow rotation. Web-light:
 * a few thousand points across a handful of shells, one draw each. Revealed on
 * demand (the engine shows them when a body's satellites are toggled on).
 *
 * Altitudes are expressed as a multiple of the body's radius so they scale to
 * each planet's visualRadius. Earth examples:
 *   ISS  ~420 km  → 1.066 R⊕      Starlink ~550 km → 1.086 R⊕
 *   GPS  ~20,200 km → 4.17 R⊕     GEO ~35,786 km   → 6.61 R⊕
 * ============================================================ */
export type SatelliteShell = {
  label: string
  /** orbit radius as a multiple of the body's radius */
  altRatio: number
  count: number
  color: string
  /** orbital inclination spread (radians) — how puffed the shell is in Y */
  incl: number
  speed: number
  /** Debris cloud: tracked orbital debris fills a THICK band of altitudes at ALL
   *  inclinations (a near-spherical shell), not a clean ring. Renders denser +
   *  fainter specks. `altSpread` (fraction of altRatio) sets the band thickness. */
  debris?: boolean
  altSpread?: number
  /** First-launch epoch of this constellation/band — the shell only exists on
   *  the timeline after this instant (truth: no Starlink in 1990). */
  launchMs?: number
}

function SatelliteShellPoints({
  shell,
  bodyRadius,
  onHover,
}: {
  shell: SatelliteShell
  bodyRadius: number
  onHover?: HoverHandler
}) {
  const ref = useRef<Points>(null)
  const gateRef = useRef<Group>(null)
  const geometry = useMemo(() => {
    const r = bodyRadius * shell.altRatio
    const positions = new Float32Array(shell.count * 3)
    for (let i = 0; i < shell.count; i++) {
      const a = Math.random() * Math.PI * 2
      if (shell.debris) {
        // Debris cloud: every inclination (a near-spherical shell) over a thick
        // altitude band — the real LEO debris environment, not a single lane.
        const u = Math.random() * 2 - 1            // cos(polar) → uniform sphere
        const ph = Math.acos(u)
        const rr = r * (1 + (Math.random() - 0.5) * (shell.altSpread ?? 0.18))
        positions[i * 3]     = rr * Math.sin(ph) * Math.cos(a)
        positions[i * 3 + 1] = rr * Math.cos(ph)
        positions[i * 3 + 2] = rr * Math.sin(ph) * Math.sin(a)
      } else {
        // REAL constellation geometry: every member flies at the SAME
        // inclination (shell.incl = the constellation's true tilt), in planes
        // spread around the pole (random RAAN). This is why Starlink weaves a
        // lattice and Iridium cages the poles — not a random inclination smear.
        const raan = Math.random() * Math.PI * 2
        const inc = shell.incl
        const px = Math.cos(a) * r
        const py = Math.sin(a) * Math.sin(inc) * r
        const pz = Math.sin(a) * Math.cos(inc) * r
        positions[i * 3]     = px * Math.cos(raan) + pz * Math.sin(raan)
        positions[i * 3 + 1] = py
        positions[i * 3 + 2] = -px * Math.sin(raan) + pz * Math.cos(raan)
      }
    }
    const geo = new BufferGeometry()
    geo.setAttribute("position", new BufferAttribute(positions, 3))
    return geo
  }, [shell, bodyRadius])

  // Faint orbit-path ring at the shell's altitude, so the orbital lane reads
  // even when the points are sparse. Slightly tilted to suggest inclination.
  const ringGeo = useMemo(() => {
    const r = bodyRadius * shell.altRatio
    const seg = 96
    const pts = new Float32Array((seg + 1) * 3)
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2
      pts[i * 3] = Math.cos(a) * r
      pts[i * 3 + 1] = 0
      pts[i * 3 + 2] = Math.sin(a) * r
    }
    const geo = new BufferGeometry()
    geo.setAttribute("position", new BufferAttribute(pts, 3))
    return geo
  }, [shell, bodyRadius])

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * shell.speed
    // Timeline truth: the band only exists after its constellation's first
    // launch/arrival. Polled per-frame so scrubbing reveals/hides it live.
    if (gateRef.current) {
      gateRef.current.visible =
        shell.launchMs == null || simTimeRef.current.simMs >= shell.launchMs
    }
  })

  return (
    <group ref={gateRef}>
      <points ref={ref} geometry={geometry}>
        <pointsMaterial
          // Real altitude ratios keep LEO tight to Earth, so the swarm only
          // fully resolves when you zoom in. Debris specks render smaller +
          // fainter than active satellites (tiny tracked fragments).
          size={shell.debris ? Math.max(0.005, bodyRadius * 0.009) : Math.max(0.008, bodyRadius * 0.016)}
          sizeAttenuation
          color={shell.color}
          transparent
          opacity={shell.debris ? 0.7 : 1.0}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </points>
      {/* orbital-path ring — only for constellations; a debris cloud has no
          single lane, so it's skipped. */}
      {!shell.debris && (
        <threeLine geometry={ringGeo} rotation={[shell.incl, 0, 0]}>
          <lineBasicMaterial color={shell.color} transparent opacity={0.18} depthWrite={false} />
        </threeLine>
      )}
      {/* Debris shell is hoverable → an honest conjunction / Kessler explainer
          (no faked live close-approach events; we don't have that feed). */}
      {shell.debris && onHover && (
        <mesh
          onPointerOver={(e) => {
            e.stopPropagation()
            onHover({
              name: "Orbital debris",
              classification: "Tracked space debris · LEO",
              fact: "~36,000 objects larger than 10 cm are tracked in orbit, plus an estimated 1,000,000+ between 1–10 cm — mostly junk: spent rocket stages, dead satellites, and fragments from collisions + anti-satellite tests.\n\n⚠ Conjunctions: operators get thousands of close-approach warnings a day; active satellites (e.g. the ISS, Starlink) perform avoidance manoeuvres. The risk is the Kessler syndrome — a collision cascade where debris begets more debris, potentially making some orbits unusable. (Specific live conjunction events aren't shown here — that needs a real tracking feed.)",
            })
          }}
          onPointerOut={() => onHover(null)}
        >
          <sphereGeometry args={[bodyRadius * shell.altRatio, 24, 16]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} side={BackSide} />
        </mesh>
      )}
    </group>
  )
}

/** Real human-made orbiter populations by body. Counts are scaled-down but
 *  proportionate (Starlink dominates Earth LEO); altitudes are true ratios. */
const SATELLITE_CATALOG: Record<string, SatelliteShell[]> = {
  Earth: [
    // Altitudes are REAL ratios (orbit radius / Earth radius): LEO ~1.05–1.19,
    // MEO ~4.2, GEO ~6.6. At normal zoom the LEO band hugs Earth tightly (as it
    // truly does) — zoom into Earth to see the Starlink swarm resolve. Realism
    // over exaggeration, per the true-ratio goal.
    // --- LEO (~400–1200 km) — densest, dominated by Starlink ---
    { label: "Starlink (LEO ~550 km · 53°)", launchMs: Date.UTC(2019, 4, 24), altRatio: 1.086, count: 900, color: "#9fe0ff", incl: 0.925, speed: 0.18 },
    { label: "OneWeb (LEO ~1200 km · 87.9°)", launchMs: Date.UTC(2019, 1, 27), altRatio: 1.19, count: 240, color: "#a8c0ff", incl: 1.534, speed: 0.15 },
    { label: "Iridium (LEO ~780 km · 86.4°)", launchMs: Date.UTC(1997, 4, 5), altRatio: 1.12, count: 90, color: "#c0d8ff", incl: 1.508, speed: 0.16 },
    { label: "Earth-observation (sun-sync ~700 km · 97.8°)", launchMs: Date.UTC(1972, 6, 23), altRatio: 1.11, count: 130, color: "#bfeacb", incl: 1.707, speed: 0.16 },
    { label: "ISS / Tiangong / Hubble (~420–540 km · 28–52°)", launchMs: Date.UTC(1990, 3, 24), altRatio: 1.066, count: 90, color: "#ffffff", incl: 0.901, speed: 0.2 },
    // --- MEO (~20,000 km) — the navigation constellations ---
    { label: "GPS (MEO ~20,200 km · 55°)", launchMs: Date.UTC(1978, 1, 22), altRatio: 4.17, count: 31, color: "#ffd27a", incl: 0.96, speed: 0.06 },
    { label: "GLONASS (MEO ~19,100 km · 64.8°)", launchMs: Date.UTC(1982, 9, 12), altRatio: 4.0, count: 24, color: "#ffcaa0", incl: 1.131, speed: 0.062 },
    { label: "Galileo (MEO ~23,200 km · 56°)", launchMs: Date.UTC(2011, 9, 21), altRatio: 4.7, count: 28, color: "#a0ffd0", incl: 0.977, speed: 0.055 },
    { label: "BeiDou (MEO ~21,500 km · 55°)", launchMs: Date.UTC(2000, 9, 31), altRatio: 4.3, count: 30, color: "#ffb0e0", incl: 0.96, speed: 0.058 },
    // --- GEO (~35,786 km) — the equatorial comms/weather belt ---
    { label: "Geostationary belt (~35,786 km · 0°)", launchMs: Date.UTC(1963, 6, 26), altRatio: 6.61, count: 180, color: "#ff9a6b", incl: 0.01, speed: 0.02 },
    // --- Orbital DEBRIS — ~36,000 tracked objects >10 cm (most of LEO is junk):
    //     spent stages, dead satellites, collision + ASAT-test fragments. A
    //     near-spherical cloud at ALL inclinations, densest ~800–1000 km. The
    //     defining hazard of the LEO environment (cf. LeoLabs tracking). ---
    { label: "LEO debris cloud (~600–1100 km, all inclinations)", launchMs: Date.UTC(1961, 5, 29), altRatio: 1.13, count: 2600, color: "#ff7a6b", incl: 3.14, speed: 0.17, debris: true, altSpread: 0.10 },
    { label: "Upper-LEO debris (~1200–1500 km)", launchMs: Date.UTC(1961, 5, 29), altRatio: 1.22, count: 700, color: "#ffae8a", incl: 3.14, speed: 0.14, debris: true, altSpread: 0.10 },
  ],
  Mars: [
    { label: "Mars orbiters (MRO / MAVEN / Odyssey / TGO …)", launchMs: Date.UTC(1971, 10, 14), altRatio: 1.3, count: 14, color: "#ffb89a", incl: 1.1, speed: 0.12 },
  ],
  // Real (or historic) orbiters at the other planets — counts reflect reality:
  // these worlds have had only a handful of visiting spacecraft, never swarms.
  Mercury: [
    { label: "Mercury orbit (BepiColombo · MESSENGER, hist.)", launchMs: Date.UTC(2011, 2, 18), altRatio: 1.5, count: 2, color: "#cdbfae", incl: 1.0, speed: 0.1 },
  ],
  Venus: [
    { label: "Venus orbit (Akatsuki · Venus Express, hist.)", launchMs: Date.UTC(1975, 9, 22), altRatio: 1.45, count: 2, color: "#ffe6a8", incl: 0.9, speed: 0.1 },
  ],
  Jupiter: [
    { label: "Jupiter orbit (Juno · Galileo, hist.)", launchMs: Date.UTC(1995, 11, 7), altRatio: 1.6, count: 2, color: "#ffd9b0", incl: 1.3, speed: 0.07 },
  ],
  Saturn: [
    { label: "Saturn orbit (Cassini, hist. 1997–2017)", launchMs: Date.UTC(2004, 6, 1), altRatio: 1.7, count: 1, color: "#ffe9c0", incl: 0.6, speed: 0.05 },
  ],
}

/** Named hero satellites — real Blender models orbiting at their true altitude,
 *  the recognizable craft among the procedural swarm. */
type HeroCraft = {
  label: string
  model: string
  altRatio: number
  incl: number
  speed: number
  /** model scale relative to body radius */
  sizeRatio: number
  phase: number
  /** Real-world detail surfaced in the InfoPanel on hover/focus. */
  agency?: string      // launching country / agency (with flag)
  orbit?: string       // orbit type + altitude + inclination + period
  launched?: string    // launch date / year (human-readable)
  size?: string        // physical dimensions
  fact?: string        // one-line description
  /** Launch instant (Unix ms). The craft only exists in the scene once the
   *  simulation clock passes this date — scrubbing the timeline back before it
   *  removes it, so the space age unfolds as you scrub forward from 1957. */
  launchMs?: number
}
const HERO_CRAFT: Record<string, HeroCraft[]> = {
  Earth: [
    // sizeRatio bumped so the real craft stand out from the procedural swarm.
    { label: "ISS", model: "/models/sat-iss.glb", altRatio: 1.066, incl: 0.9, speed: 0.2, sizeRatio: 0.18, phase: 0,
      agency: "🌍 Multinational (NASA · Roscosmos · ESA · JAXA · CSA)", orbit: "LEO · ~420 km · 51.6° · ~92 min", launched: "1998 (first module)", size: "109 × 73 m", launchMs: Date.UTC(1998, 10, 20),
      fact: "The largest human structure in space — a continuously crewed laboratory since 2000, assembled from modules over a decade." },
    { label: "Tiangong", model: "/models/tiangong.glb", altRatio: 1.062, incl: 0.74, speed: 0.21, sizeRatio: 0.12, phase: 1.6,
      agency: "🇨🇳 CMSA (China)", orbit: "LEO · ~390 km · 41.5° · ~92 min", launched: "2021 (Tianhe core)", size: "~55 m, ~3 modules", launchMs: Date.UTC(2021, 3, 29),
      fact: "China's modular space station, completed in 2022 — the second continuously inhabited station in orbit." },
    { label: "Hubble", model: "/models/sat-hubble.glb", altRatio: 1.085, incl: 0.48, speed: 0.18, sizeRatio: 0.11, phase: 2.1,
      agency: "🇺🇸 NASA · 🇪🇺 ESA", orbit: "LEO · ~535 km · 28.5° · ~95 min", launched: "1990 (STS-31)", size: "13.2 m long · 4.2 m dia", launchMs: Date.UTC(1990, 3, 24),
      fact: "The space telescope that rewrote astronomy — serviced five times by Shuttle crews, still observing after 35 years." },
    { label: "GPS", model: "/models/sat-gps.glb", altRatio: 4.17, incl: 0.95, speed: 0.06, sizeRatio: 0.2, phase: 0.7,
      agency: "🇺🇸 US Space Force", orbit: "MEO · ~20,200 km · 55° · ~12 hr", launched: "1978 (first) · Block III now", size: "~2.5 m bus · ~18 m span", launchMs: Date.UTC(1978, 1, 22),
      fact: "A constellation of ~31 satellites; any point on Earth sees at least four, which is how your phone knows where it is." },
    // JWST sits at Sun–Earth L2 (~1.5M km out, anti-sunward). At this scene
    // scale a far ring around Earth reads it as the distant deep-space scope.
    { label: "JWST", model: "/models/sat-jwst.glb", altRatio: 9.0, incl: 0.2, speed: 0.04, sizeRatio: 0.2, phase: 3.5,
      agency: "🇺🇸 NASA · 🇪🇺 ESA · 🇨🇦 CSA", orbit: "Sun–Earth L2 · ~1.5M km", launched: "2021 (Ariane 5)", size: "21 × 14 m sunshield", launchMs: Date.UTC(2021, 11, 25),
      fact: "The largest space telescope ever flown — its gold mirror sees the first galaxies in infrared, shaded by a tennis-court sunshield." },
    { label: "Sputnik 1", model: "/models/sat-sputnik.glb", altRatio: 1.09, incl: 1.1, speed: 0.24, sizeRatio: 0.09, phase: 4.4,
      agency: "🇷🇺 USSR", orbit: "LEO · 215–939 km · 65.1° · ~96 min", launched: "4 Oct 1957", size: "0.58 m sphere", launchMs: Date.UTC(1957, 9, 4),
      fact: "The first artificial satellite — a polished sphere with four antennas that beeped for 21 days and began the Space Age." },
    // ----- more of the space age, in launch order (reuse models by silhouette) -----
    { label: "Explorer 1", model: "/models/sat-sputnik.glb", altRatio: 1.23, incl: 1.0, speed: 0.25, sizeRatio: 0.07, phase: 5.2,
      agency: "🇺🇸 USA (JPL · Army)", orbit: "LEO · 358–2,550 km · 33.2°", launched: "1 Feb 1958", size: "2.0 m × 0.15 m", launchMs: Date.UTC(1958, 1, 1),
      fact: "First US satellite. Its cosmic-ray detector discovered the Van Allen radiation belts — the first major scientific find of the space age." },
    { label: "Vostok 1", model: "/models/sat-sputnik.glb", altRatio: 1.04, incl: 0.7, speed: 0.26, sizeRatio: 0.085, phase: 2.7,
      agency: "🇷🇺 USSR", orbit: "LEO · 169–327 km · 64.9°", launched: "12 Apr 1961", size: "2.3 m capsule", launchMs: Date.UTC(1961, 3, 12),
      fact: "Carried Yuri Gagarin — the first human in space, one orbit of Earth in 108 minutes." },
    { label: "Telstar 1", model: "/models/sat-sputnik.glb", altRatio: 1.54, incl: 0.8, speed: 0.12, sizeRatio: 0.08, phase: 1.1,
      agency: "🇺🇸 AT&T · NASA", orbit: "MEO · 952–5,933 km · 44.8°", launched: "10 Jul 1962", size: "0.88 m sphere", launchMs: Date.UTC(1962, 6, 10),
      fact: "Relayed the first live transatlantic television — the satellite that made global broadcast possible." },
    { label: "Landsat 1", model: "/models/sat-hubble.glb", altRatio: 1.14, incl: 1.45, speed: 0.18, sizeRatio: 0.09, phase: 3.9,
      agency: "🇺🇸 NASA · USGS", orbit: "Sun-synchronous LEO · ~917 km", launched: "23 Jul 1972", size: "~3 m", launchMs: Date.UTC(1972, 6, 23),
      fact: "Began the longest continuous record of Earth's surface from space — still running over 50 years later." },
    { label: "Voyager 1 (launch)", model: "/models/sat-voyager.glb", altRatio: 6.5, incl: 0.5, speed: 0.05, sizeRatio: 0.16, phase: 5.7,
      agency: "🇺🇸 NASA", orbit: "Departed Earth → interstellar", launched: "5 Sep 1977", size: "3.7 m dish", launchMs: Date.UTC(1977, 8, 5),
      fact: "Left Earth in 1977 on the grand tour of the outer planets; now the most distant human object, in interstellar space." },
    { label: "Iridium", model: "/models/sat-gps.glb", altRatio: 1.13, incl: 1.5, speed: 0.2, sizeRatio: 0.08, phase: 0.3,
      agency: "🇺🇸 Iridium", orbit: "LEO · ~780 km · 86.4°", launched: "1997 (constellation)", size: "~4 m", launchMs: Date.UTC(1997, 4, 5),
      fact: "A 66-satellite constellation giving satellite-phone coverage over the entire planet, poles included." },
    { label: "Starlink", model: "/models/sat-gps.glb", altRatio: 1.086, incl: 0.95, speed: 0.22, sizeRatio: 0.07, phase: 2.4,
      agency: "🇺🇸 SpaceX", orbit: "LEO · ~550 km · 53°", launched: "2019 (first batch)", size: "2.8 × 1.4 m flat", launchMs: Date.UTC(2019, 4, 24),
      fact: "The largest satellite constellation ever — thousands of flat-pack satellites delivering broadband, now the majority of all active satellites." },
  ],
  Mars: [
    { label: "MRO", model: "/models/sat-hubble.glb", altRatio: 1.084, incl: 0.95, speed: 0.16, sizeRatio: 0.1, phase: 1.0,
      agency: "🇺🇸 NASA", orbit: "Mars orbit · ~250–320 km", launched: "2005", size: "~6.5 m span", launchMs: Date.UTC(2005, 7, 12),
      fact: "Mars Reconnaissance Orbiter — its HiRISE camera returns the sharpest images of the Martian surface." },
  ],
}
Object.values(HERO_CRAFT).flat().forEach((c) => useGLTF.preload(c.model))

function HeroSatellite({
  craft,
  bodyRadius,
  onHover,
  interactive = false,
  trueScale = false,
}: {
  craft: HeroCraft
  bodyRadius: number
  onHover?: HoverHandler
  interactive?: boolean
  /** Render at real measured span vs Earth (the celestial explorer). */
  trueScale?: boolean
}) {
  const ref = useRef<import("three").Group>(null)
  const craftRef = useRef<import("three").Group>(null)
  const gltf = useGLTF(craft.model)
  const cloned = useMemo(() => {
    const c = gltf.scene.clone(true)
    c.traverse((ch) => { if ((ch as import("three").Mesh).isMesh) { ch.frustumCulled = false } })
    return c
  }, [gltf.scene])
  const r = bodyRadius * craft.altRatio
  // Launch-date gating: the craft only exists once the simulation clock passes
  // its launch instant. Polled in-frame so scrubbing the timeline reveals/hides
  // it — the space age unfolds as you move from 1957 forward. Bodies without a
  // launchMs (legacy) are always present.
  const [launched, setLaunched] = useState(
    craft.launchMs == null || simTimeRef.current.simMs >= craft.launchMs,
  )
  useFrame((_, delta) => {
    if (craft.launchMs != null) {
      const isUp = simTimeRef.current.simMs >= craft.launchMs
      if (isUp !== launched) setLaunched(isUp)
    }
    if (!ref.current) return
    ref.current.rotation.y += delta * craft.speed
  })

  // Follow this craft: lock the camera onto its live world position so the
  // viewer rides along as it orbits — same gesture as moons/comets. The getter
  // reads the inner group's world position each frame (it's inside the spinning
  // orbit group), so the follow stays glued as the craft circles the body.
  const startFollow = (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    const obj = craftRef.current
    if (!obj) return
    requestFollow(
      () => {
        const v = new Vector3()
        obj.getWorldPosition(v)
        return { x: v.x, y: v.y, z: v.z }
      },
      trueScale
        ? Math.max(((spanM / 1000 / 6371) * bodyRadius) * 8, 0.02)
        : Math.max(bodyRadius * craft.sizeRatio * 6, 0.12),
      craft.label,
    )
  }

  // TRUE-scale mode (the /lab/celestial explorer): the craft renders at its
  // real measured span vs Earth — parsed from the max figure in its `size`
  // string (deployed span) against the GLB's actual bounding box. At true
  // ratio every craft is sub-pixel from orbit distance, so a small halo
  // marks the position and the generous hit-sphere (kept OUTSIDE the scaled
  // group) preserves hover/click; following zooms until the real model fills
  // the view. The home hero keeps its documented perceptual sizing.
  const spanM = useMemo(() => {
    const nums = (craft.size?.match(/\d+(?:\.\d+)?/g) ?? []).map(Number)
    return nums.length ? Math.max(...nums) : 3
  }, [craft.size])
  const nativeSpan = useMemo(() => {
    const box = new Box3().setFromObject(cloned)
    const s = new Vector3()
    box.getSize(s)
    return Math.max(s.x, s.y, s.z) || 1
  }, [cloned])
  const visScale = trueScale
    ? ((spanM / 1000 / 6371) * bodyRadius) / nativeSpan
    : bodyRadius * craft.sizeRatio

  return (
    <group ref={ref} rotation={[craft.incl * 0.35, craft.phase, 0]}>
      {/* Orbit ring — the craft's path, so each can be tailed by eye. Only in
          the true-scale explorer (the home hero stays clean). */}
      {trueScale && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[r, bodyRadius * 0.0035, 6, 96]} />
          <meshBasicMaterial color="#7ec8ff" transparent opacity={0.16} depthWrite={false} />
        </mesh>
      )}
      <group ref={craftRef} position={[r, 0, 0]} visible={launched}>
        <group scale={visScale}>
          <primitive object={cloned} />
        </group>
        {/* Findability halo — at true ratio the craft itself is sub-pixel from
            orbit distance; this small glow marks where it is. */}
        {trueScale && (
          <mesh>
            <sphereGeometry args={[bodyRadius * 0.014, 10, 10]} />
            <meshBasicMaterial color="#aef" transparent opacity={0.55} blending={AdditiveBlending} depthWrite={false} />
          </mesh>
        )}
        {/* Invisible hit-sphere so the small craft is easy to hover/click —
            sized in WORLD units (not inside the visual scale) so true-scale
            mode keeps a usable touch target. */}
        <mesh
          scale={bodyRadius * craft.sizeRatio}
          onPointerOver={(e) => {
            e.stopPropagation()
            // Build a rich, real-data fact: description + agency/orbit/size/launch.
            const lines = [
              craft.fact,
              craft.agency && `Built by: ${craft.agency}`,
              craft.orbit && `Orbit: ${craft.orbit}`,
              craft.size && `Size: ${craft.size}`,
              craft.launched && `Launched: ${craft.launched}`,
              interactive && "Click to follow it around its orbit.",
            ].filter(Boolean)
            onHover?.({
              name: craft.label,
              classification: craft.agency ? `Human-made satellite · ${craft.agency.replace(/^[^A-Za-z]+/, "").split(" (")[0]}` : "Human-made spacecraft",
              fact: lines.join("\n"),
              followable: interactive,
            })
          }}
          onPointerOut={() => onHover?.(null)}
          onClick={interactive ? startFollow : undefined}
          onDoubleClick={interactive ? startFollow : undefined}
        >
          <sphereGeometry args={[2.2, 12, 12]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
    </group>
  )
}

function SatelliteShells({
  shells,
  heroCraft,
  bodyRadius,
  onHover,
  interactive = false,
  trueScale = false,
}: {
  shells: SatelliteShell[]
  heroCraft?: HeroCraft[]
  bodyRadius: number
  onHover?: HoverHandler
  interactive?: boolean
  trueScale?: boolean
}) {
  return (
    <group>
      {shells.map((s) => (
        <SatelliteShellPoints key={s.label} shell={s} bodyRadius={bodyRadius} onHover={onHover} />
      ))}
      {heroCraft?.map((c) => (
        <Suspense key={c.label} fallback={null}>
          <HeroSatellite craft={c} bodyRadius={bodyRadius} onHover={onHover} interactive={interactive} trueScale={trueScale} />
        </Suspense>
      ))}
    </group>
  )
}

/* ============================================================
 * Planets + Sun + Orbit Rings
 * ============================================================ */

/**
 * Build a ring geometry with proper radial UVs — `u` runs from 0 (inner
 * radius) to 1 (outer radius), `v` wraps 0→1 around the circumference.
 * Three.js's built-in RingGeometry uses an annular-projection UV layout
 * that doesn't let us cleanly map a horizontal strip texture.
 */
function radialUVRingGeometry(innerR: number, outerR: number, segments: number) {
  const verts: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2
    const cosT = Math.cos(theta)
    const sinT = Math.sin(theta)
    verts.push(cosT * innerR, sinT * innerR, 0)
    uvs.push(0, i / segments)
    verts.push(cosT * outerR, sinT * outerR, 0)
    uvs.push(1, i / segments)
  }
  for (let i = 0; i < segments; i++) {
    const a = i * 2
    indices.push(a, a + 2, a + 1)
    indices.push(a + 2, a + 3, a + 1)
  }
  const geo = new BufferGeometry()
  geo.setAttribute("position", new BufferAttribute(new Float32Array(verts), 3))
  geo.setAttribute("uv", new BufferAttribute(new Float32Array(uvs), 2))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

// Ring shader — keeps the texture's real band structure (C/B/Cassini/A/F) but
// adds two physically-real details a flat unlit material can't: (1) the planet's
// SHADOW cast across the rings (a dark arc — the signature Cassini-image look),
// and (2) a subtle forward/back-scatter brightness from the sun angle so the
// rings aren't uniformly flat. uv.x is radial (0=inner,1=outer); the shell
// passes the ring point's local position so we can test it against the shadow.
const RING_VERTEX_SHADER = `
  varying vec2 vUv;
  varying vec3 vLocal;
  void main() {
    vUv = uv;
    vLocal = position;                       // ring-plane local coords
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const RING_FRAGMENT_SHADER = `
  uniform sampler2D uMap;
  uniform float uOpacity;
  uniform vec3  uColor;
  uniform vec3  uSunDirLocal;   // sun direction in the ring's local frame
  uniform float uPlanetR;       // planet radius in the same local units
  uniform float uHasMap;
  varying vec2 vUv;
  varying vec3 vLocal;
  void main() {
    vec4 tex = uHasMap > 0.5 ? texture2D(uMap, vUv) : vec4(1.0);
    float alpha = tex.a * uOpacity;
    if (alpha < 0.003) discard;
    vec3 col = tex.rgb * uColor;

    // --- Planet shadow on the rings ---------------------------------------
    // Project the ring point onto the plane perpendicular to the sun; if the
    // component of its position across the sun-line falls within the planet's
    // radius AND it's on the far side of the planet from the sun, it's shadowed.
    vec3 s = normalize(uSunDirLocal);
    float along = dot(vLocal, s);                  // distance along sun-line
    vec3 perp = vLocal - s * along;                // offset from the sun-line
    float perpLen = length(perp);
    // shadowed = behind the planet (along<0) and within its radius of the line
    float core = 1.0 - smoothstep(uPlanetR * 0.82, uPlanetR * 1.02, perpLen);
    float behind = smoothstep(0.0, -0.15, along); // 1 when clearly behind
    float shadow = core * behind;
    col *= mix(1.0, 0.12, shadow);                 // deep umbra, soft penumbra
    alpha *= mix(1.0, 0.55, shadow);               // shadowed ring dims too

    gl_FragColor = vec4(col, alpha);
  }
`

function SaturnRings({
  planetRadius,
  invert = false,
  highlighted = false,
}: {
  planetRadius: number
  invert?: boolean
  highlighted?: boolean
}) {
  // Rings sit in Saturn's equatorial plane. The parent group applies the
  // 26.73° axial tilt, so rings inherit it naturally.
  //
  // Real ring structure, in Saturn-radii — encoded into the texture's alpha
  // channel by Solar System Scope (CC BY 4.0, same source as the planet
  // surfaces). Span runs the C ring's inner edge (1.24×) through the F
  // ring's outer edge (2.34×). The Cassini Division shows up naturally as
  // the texture's transparent band. A shader adds the planet's cast shadow.
  const matRef = useRef<ShaderMaterial>(null)
  const [texture, setTexture] = useState<Texture | null>(null)
  const ringUniforms = useMemo(
    () => ({
      uMap:         { value: null as Texture | null },
      uOpacity:     { value: 0 },
      uColor:       { value: new Color(invert ? "#1a1208" : "#ffffff") },
      uSunDirLocal: { value: new Vector3(1, 0, 0) },
      uPlanetR:     { value: planetRadius },
      uHasMap:      { value: 0 },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [planetRadius],
  )

  // Custom geometry: u is radial (0 = C ring inner, 1 = F ring outer),
  // v wraps around the circle. Lets the horizontal-strip ring texture
  // map cleanly across the ring system.
  const ringGeometry = useMemo(
    () => radialUVRingGeometry(planetRadius * 1.24, planetRadius * 2.34, 192),
    [planetRadius],
  )

  useEffect(() => {
    if (texture) return
    const loader = new TextureLoader()
    loader.load("/textures/saturn-ring.webp", (tex) => {
      tex.colorSpace = SRGBColorSpace
      tex.anisotropy = 8
      tex.wrapS = ClampToEdgeWrapping
      tex.wrapT = RepeatWrapping
      setTexture(tex)
      ringUniforms.uMap.value = tex
      ringUniforms.uHasMap.value = 1
    })
  }, [texture, ringUniforms])

  useEffect(() => {
    ringUniforms.uColor.value.set(invert ? "#1a1208" : "#ffffff")
  }, [invert, ringUniforms])

  const idleOpacity = invert ? 0.78 : 0.62
  const hoverOpacity = invert ? 1.0 : 0.95

  const _ringSunWorld = useMemo(() => new Vector3(), [])
  const _ringGrpWorld = useMemo(() => new Vector3(), [])
  const _ringDirWorld = useMemo(() => new Vector3(), [])
  const _ringNormalMat = useMemo(() => new Matrix3(), [])
  const meshRef = useRef<Mesh>(null)

  useFrame((_, delta) => {
    if (!matRef.current) return
    const k = 1 - Math.exp(-delta * 8)
    const target = highlighted ? hoverOpacity : idleOpacity
    matRef.current.uniforms.uOpacity.value +=
      (target - matRef.current.uniforms.uOpacity.value) * k
    // Sun direction in the ring mesh's LOCAL frame (so the shadow tracks
    // Saturn's real orbital position + the 26.7° ring tilt). Take the world-space
    // sun→ring direction, then rotate it into local space with the inverse of the
    // mesh's world rotation (the normal matrix of the inverse world matrix).
    if (meshRef.current) {
      meshRef.current.getWorldPosition(_ringGrpWorld)
      _ringSunWorld.set(SUN_OFFSET_SCENE, 0, 0)
      _ringDirWorld.copy(_ringSunWorld).sub(_ringGrpWorld).normalize()
      _ringNormalMat.getNormalMatrix(meshRef.current.matrixWorld).invert()
      matRef.current.uniforms.uSunDirLocal.value
        .copy(_ringDirWorld)
        .applyMatrix3(_ringNormalMat)
        .normalize()
    }
  })

  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
      <mesh geometry={ringGeometry} ref={meshRef}>
        <shaderMaterial
          ref={matRef as React.Ref<ShaderMaterial>}
          vertexShader={RING_VERTEX_SHADER}
          fragmentShader={RING_FRAGMENT_SHADER}
          uniforms={ringUniforms}
          transparent
          side={DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

/** Single rover landing-site pin — a tiny coloured dome on the planet
 *  surface plus an invisible larger hit-zone so the pin is touch-findable.
 *  Hover surfaces the rover's full name + date + fact as a floating label. */
function RoverPin({
  feature,
  planetRadius,
  invert,
  onHover,
}: {
  feature: SurfaceFeature
  planetRadius: number
  invert: boolean
  onHover?: HoverHandler
}) {
  const [isHovered, setIsHovered] = useState(false)
  const latRad = feature.lat * DEG
  const lonRad = feature.lon * DEG
  // Lat / lon → 3D position on the planet's surface in mesh-local frame
  // (after axial tilt, before per-frame rotation). Standard planetographic
  // spherical-to-cartesian: lat measures from equator, lon eastward from
  // the prime meridian (treated as local +x at rotation = 0).
  const r = planetRadius * 1.012   // sit slightly above surface so the
  const x = r * Math.cos(latRad) * Math.cos(lonRad)
  const y = r * Math.sin(latRad)
  const z = r * Math.cos(latRad) * Math.sin(lonRad)

  const isNatural = feature.status === "natural"
  const pinRadius = planetRadius * (isNatural ? 0.055 : 0.025)
  const hitRadius = Math.max(planetRadius * 0.12, 0.05)
  // Status colour: active = green, completed = warm amber, lost = muted red,
  // natural = warm tan ring (geographic landmark, not a mission target).
  const color =
    feature.status === "active"    ? (invert ? "#1f6f3f" : "#7dffaf") :
    feature.status === "completed" ? (invert ? "#7a4a14" : "#ffc878") :
    feature.status === "lost"      ? (invert ? "#7a2828" : "#ff8888") :
    /* natural */                    (invert ? "#7a5028" : "#f0c890")

  return (
    <group position={[x, y, z]}>
      {/* Naturals render as a thin outline ring instead of a solid dot —
          they represent extended regions (volcanoes, canyons, basins),
          not point landing sites. Mission pins keep the solid sphere. */}
      {isNatural ? (
        <mesh>
          <torusGeometry args={[pinRadius, pinRadius * 0.15, 8, 24]} />
          <meshBasicMaterial color={color} transparent opacity={0.85} />
        </mesh>
      ) : (
        <mesh>
          <sphereGeometry args={[pinRadius, 10, 10]} />
          <meshBasicMaterial color={color} />
        </mesh>
      )}
      {/* Touch-friendly hit zone — invisible sphere larger than the visible
          pin so a finger or cursor can land on the landing site without
          surgical precision. */}
      <mesh
        onPointerOver={(e) => {
          e.stopPropagation()
          setIsHovered(true)
          // Route the rich detail to the standard left InfoPanel (like planets,
          // stars, comets) instead of a big centred floating tooltip. The pin
          // keeps a tiny name label for the in-3D location cue.
          const statusLabel =
            feature.status === "natural" ? "Surface feature" :
            feature.status === "active" ? "Mission · active" :
            feature.status === "lost" ? "Mission · lost" : "Mission · completed"
          const agencyDate = [feature.agency !== "—" ? feature.agency : null, feature.date !== "natural" ? feature.date : null]
            .filter(Boolean).join(" · ")
          onHover?.({
            name: feature.name,
            classification: agencyDate ? `${statusLabel} · ${agencyDate}` : statusLabel,
            fact: feature.fact,
          })
        }}
        onPointerOut={() => { setIsHovered(false); onHover?.(null) }}
      >
        <sphereGeometry args={[hitRadius, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {/* Just a small name tag at the pin — the full detail (agency, date,
          fact) now shows in the standard left InfoPanel via onHover, so this
          is only the in-3D location cue, not a big centred popup. */}
      {isHovered && (
        <Html
          position={[0, pinRadius * 3, 0]}
          center
          distanceFactor={5}
          zIndexRange={[20, 0]}
          style={{ pointerEvents: "none" }}
        >
          <div
            className={`
              whitespace-nowrap select-none pointer-events-none
              font-mono text-[9px] tracking-[0.22em] uppercase
              px-2 py-1 rounded
              ${invert ? "bg-white/90 text-foreground" : "bg-black/75 text-white"}
            `}
            style={{ animation: "ue-label-in 220ms ease-out both" }}
          >
            {feature.name}
          </div>
        </Html>
      )}
    </group>
  )
}

function PlanetBody({
  planet,
  onHover,
  invert = false,
  interactive = false,
  solarOnly = false,
}: {
  planet: ScenePlanet
  onHover: HoverHandler
  invert?: boolean
  interactive?: boolean
  /** In the solar-only explorer, Earth shows the full ~15.7k real-satellite
   *  catalogue (too heavy for the passive hero). */
  solarOnly?: boolean
}) {
  const meshRef = useRef<Mesh>(null)
  const orbitRef = useRef<Group>(null)
  const texMeshRef = useRef<Mesh>(null)
  const texMatRef = useRef<import("three").MeshStandardMaterial>(null)
  const bandsMeshRef = useRef<import("three").Mesh>(null)
  /** Rotates in lockstep with the planet body — children inherit the spin
   *  so surface features (rover pins on Mars) stay glued to the right spot. */
  const surfaceRotRef = useRef<Group>(null)
  /** Earth's day/night shader material — uniforms are updated each frame
   *  with the sun direction in world space so the terminator stays accurate
   *  as Earth orbits and rotates. */
  const dayNightMatRef = useRef<ShaderMaterial>(null)
  /** Ref on the position group so eccentric orbits (Pluto) can have their
   *  orbital distance vary with current orbit angle, matching the elliptical
   *  ring rendered by OrbitRing. */
  const positionRef = useRef<Group>(null)
  const [isHovered, setIsHovered] = useState(false)
  // `focused` persists after a click → fly-to so the planet's texture +
  // atmosphere bloom stay visible after arrival, even when the cursor
  // moves off the hit zone. Cleared by Reset or by focusing a different
  // body (same machinery the sky-points use).
  const [focused, setFocused] = useState(false)
  const [texture, setTexture] = useState<Texture | null>(null)
  const [nightTexture, setNightTexture] = useState<Texture | null>(null)
  const [elevationTexture, setElevationTexture] = useState<Texture | null>(null)
  const detailActive = isHovered || focused

  // Listen for a global focus-clear (e.g. Reset) so the planet collapses
  // back to its idle chart-marker appearance.
  useEffect(() => {
    const onSkyFocus = (e: Event) => {
      const id = (e as CustomEvent<{ pointId: string | null }>).detail?.pointId
      if (id !== `planet:${planet.raw.name}`) {
        setFocused(false)
        return
      }
      // This planet is the warp target — fly the camera to it. Mirrors the
      // click handler: follow the planet's live world position (read from the
      // orbital position group) so it stays framed as it orbits. This is what
      // makes the "Jump to" destinations menu work across both scale modes.
      setFocused(true)
      const obj = positionRef.current
      if (obj) {
        // In the solar explorer, Earth is the satellite-shell subject — pull the
        // camera back further so the WHOLE shell wraps visibly around the globe
        // (the LeoLabs framing) instead of filling the screen with a slice. Other
        // bodies + the home hero keep the tighter, hero-sized framing.
        const earthShellFraming = solarOnly && planet.raw.name === "Earth"
        // ~5× Earth radius: close enough that the LEO shell (a thin band ~6–30%
        // above the surface at true scale) reads as a visible ring, but pulled
        // back enough to see it wrap the whole globe. (3.5× = only a slice; 9× =
        // Earth too small, shell too thin to see.)
        const followDistance = Math.max(
          planet.visualRadius * (earthShellFraming ? 5 : planet.raw.hasRings ? 5 : 3.5),
          earthShellFraming ? 0.6 : 0.5,
        )
        requestFollow(
          () => {
            const v = new Vector3()
            obj.getWorldPosition(v)
            return { x: v.x, y: v.y, z: v.z }
          },
          followDistance,
          planet.raw.name,
        )
      }
    }
    window.addEventListener("universe:sky-focus", onSkyFocus)
    return () => window.removeEventListener("universe:sky-focus", onSkyFocus)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planet.raw.name])

  const textureUrl = planet.raw.textureUrl
  const hasTexture = Boolean(textureUrl)

  // Eagerly load each planet's equirectangular surface texture on mount —
  // the solar system is meant to read as the real solar system at a glance,
  // not an abstract chart that resolves on hover. TextureLoader is async, so
  // first paint isn't blocked: the grey markers render immediately and the
  // photographic surfaces fade in as each WebP (NASA Blue Marble for Earth,
  // Solar System Scope CC BY for the rest) lands. WebP keeps the same
  // visual quality at ~35% of the original JPEG size — meaningful on mobile.
  //
  // Mobile-first: outer planets (Jupiter + beyond) get a 500ms delay so the
  // inner-system textures (which are smaller in scene size + closer to the
  // camera on default load) win the browser's first round of fetch slots.
  // Total bandwidth is unchanged; first-paint quality improves on phones.
  useEffect(() => {
    if (!textureUrl || texture) return
    const isOuterPlanet = planet.raw.aAU > 4
    const delay = isOuterPlanet ? 500 : 0
    const timer = setTimeout(() => {
      const loader = new TextureLoader()
      loader.load(textureUrl, (tex) => {
        tex.colorSpace = SRGBColorSpace
        tex.anisotropy = 8
        setTexture(tex)
      })
    }, delay)
    return () => clearTimeout(timer)
  }, [textureUrl, texture, planet.raw.aAU])

  // Optional night-side texture (city lights). Currently only Earth ships
  // this — drives the day/night shader below. Loaded with a small delay
  // so it lands after the day texture (which is the primary surface).
  const nightTextureUrl = planet.raw.nightTextureUrl
  useEffect(() => {
    if (!nightTextureUrl || nightTexture) return
    const timer = setTimeout(() => {
      const loader = new TextureLoader()
      loader.load(nightTextureUrl, (tex) => {
        tex.colorSpace = SRGBColorSpace
        tex.anisotropy = 8
        setNightTexture(tex)
      })
    }, 300)
    return () => clearTimeout(timer)
  }, [nightTextureUrl, nightTexture])

  // Optional elevation/height map (Mars MOLA) for real terrain relief. Loaded
  // last (after day + night) since it's a deep-zoom nicety, not the primary
  // surface. NOT sRGB — it's raw height data, sampled linearly in the shader.
  const elevationUrl = planet.raw.elevationUrl
  useEffect(() => {
    if (!elevationUrl || elevationTexture) return
    const timer = setTimeout(() => {
      const loader = new TextureLoader()
      loader.load(elevationUrl, (tex) => {
        tex.anisotropy = 4
        setElevationTexture(tex)
      })
    }, 500)
    return () => clearTimeout(timer)
  }, [elevationUrl, elevationTexture])

  // Day/night shader uniforms — stable object so the shader sees the same
  // reference across re-renders. Textures + sun direction are mutated in
  // place after the uniforms are wired up. Earth uses this with both
  // textures + a soft Earth-atmosphere terminator; Mercury / Mars use it
  // without a night texture (shadow side falls to ambient dark) with a
  // sharper terminator matching their atmospheres.
  const useDayNightShader = Boolean(nightTextureUrl) || Boolean(planet.raw.useDayNight)
  const dayNightUniforms = useMemo(
    () => ({
      tDay:                 { value: null as Texture | null },
      tNight:               { value: null as Texture | null },
      uSunDir:              { value: new Vector3(1, 0, 0) },
      uOpacity:             { value: 0 },
      uNightStrength:       { value: nightTextureUrl ? 1.8 : 0 },
      uHasNight:            { value: nightTextureUrl ? 1.0 : 0.0 },
      uTerminatorSoftness:  { value: planet.raw.terminatorSoftness ?? 0.18 },
      // Polar-smear fix: on for bodies whose equirectangular map streaks at the
      // poles (Mars). uPolarTint is the clean cap colour to fade toward.
      uPolarFix:            { value: planet.raw.polarTint ? 1 : 0 },
      uPolarTint:           { value: new Color(planet.raw.polarTint ?? "#ffffff") },
      // Real terrain relief from a height map (Mars MOLA). tElevation is set
      // once the map loads; uElevation is 0 until then (and for every body
      // without an elevationUrl), so displacement is off by default.
      tElevation:           { value: null as Texture | null },
      uElevation:           { value: 0 },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  useEffect(() => {
    if (texture) dayNightUniforms.tDay.value = texture
    if (nightTexture) dayNightUniforms.tNight.value = nightTexture
    if (elevationTexture) {
      dayNightUniforms.tElevation.value = elevationTexture
      // Scale is in visual-radius units; small so relief reads without
      // shattering the mesh (matches the coverage view's ~0.035 feel).
      dayNightUniforms.uElevation.value =
        (planet.raw.elevationScale ?? 0.03) * planet.visualRadius
    }
  }, [texture, nightTexture, elevationTexture, dayNightUniforms, planet.raw.elevationScale, planet.visualRadius])

  // Procedural cloud shell — Earth only. Animated FBM noise lit by the Sun;
  // togglable via cloudsVisibleRef. uOpacity lerps with the planet's own
  // fade (so clouds appear/disappear with the textured globe) AND the toggle.
  const isEarth = planet.raw.name === "Earth"
  // Banded / hazy atmospheres that should DRIFT over their texture (a thin
  // animated turbulence shell): Venus's sulfuric haze + the four gas/ice giants'
  // latitudinal bands. Earth already has its own cloud shell, so it's excluded.
  const BANDED: Record<string, { speed: number; tint: string; strength: number }> = {
    Venus:   { speed: 0.020, tint: "#e8d8a0", strength: 0.30 },
    Jupiter: { speed: 0.060, tint: "#e7d3b0", strength: 0.42 },
    Saturn:  { speed: 0.040, tint: "#e9dcb8", strength: 0.30 },
    Uranus:  { speed: 0.015, tint: "#bfeee6", strength: 0.20 },
    Neptune: { speed: 0.050, tint: "#9fc0ff", strength: 0.34 },
  }
  const bandConf = BANDED[planet.raw.name]
  const isBanded = !!bandConf
  // Human-made orbiters for this body (Earth, Mars…), revealed by the HUD
  // "Satellites" toggle. Poll the module ref at low frequency so the shells
  // appear/disappear without prop-drilling.
  const satShells = SATELLITE_CATALOG[planet.raw.name]
  const [satsOn, setSatsOn] = useState(false)
  const cloudMatRef = useRef<ShaderMaterial | null>(null)
  const cloudUniforms = useMemo(
    () => ({
      uSunDir:   { value: new Vector3(1, 0, 0) },
      uOpacity:  { value: 0 },
      uTime:     { value: 0 },
      uCoverage: { value: 0.5 },
    }),
    [],
  )
  // Earth's polar aurora shell — night-side, high-latitude glow (deep-zoom).
  const auroraMatRef = useRef<ShaderMaterial | null>(null)
  const auroraUniforms = useMemo(
    () => ({
      uSunDir:  { value: new Vector3(1, 0, 0) },
      uOpacity: { value: 0 },
      uTime:    { value: 0 },
    }),
    [],
  )
  // Drifting band shell for Venus + the gas/ice giants.
  const bandsMatRef = useRef<ShaderMaterial | null>(null)
  const bandsUniforms = useMemo(
    () => ({
      uSunDir:    { value: new Vector3(1, 0, 0) },
      uTint:      { value: new Color(bandConf?.tint ?? "#ffffff") },
      uOpacity:   { value: 0 },
      uTime:      { value: 0 },
      uStrength:  { value: bandConf?.strength ?? 0.3 },
      // Great Red Spot — Jupiter only. A persistent anticyclone twice Earth's
      // width, in the South Equatorial Belt; the ochre-red is its real colour.
      uSpot:      { value: planet.raw.name === "Jupiter" ? 1 : 0 },
      uSpotColor: { value: new Color("#c56a3e") },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  // Atmospheric scattering shell uniforms — sun-aware Fresnel limb glow.
  const atmosShaderRef = useRef<ShaderMaterial | null>(null)
  const atmosUniforms = useMemo(
    () => ({
      uColor:   { value: new Color("#8ec5ff") },
      uSunDir:  { value: new Vector3(1, 0, 0) },
      uOpacity: { value: 0 },
      uPower:   { value: 3.0 },
    }),
    [],
  )

  // Date-driven mean anomaly. When the body has a real J2000 anchor
  // (m0Deg), its position is a pure function of the simulation date —
  // M(t) = M0 + 2π·(daysSinceJ2000 / period) — which is what makes the
  // timeline scrubber land every planet at its genuine real-world
  // position for any date. Bodies without an anchor fall back to the
  // legacy uniform accumulator so they still drift plausibly.
  const m0Rad = planet.raw.m0Deg != null ? planet.raw.m0Deg * DEG : null
  // Longitude-of-perihelion offset (radians) orients the apsidal line so
  // perihelion points the real direction for eccentric orbits.
  const periRad = planet.raw.periDeg != null ? planet.raw.periDeg * DEG : 0
  const meanAnomalyRef = useRef(planet.raw.startPhase)

  useEffect(() => {
    meanAnomalyRef.current = planet.raw.startPhase
    if (orbitRef.current && m0Rad == null) orbitRef.current.rotation.y = planet.raw.startPhase
  }, [planet.raw.startPhase, m0Rad])

  // rotHours in the data uses the signed convention (negative = retrograde),
  // but for planets like Venus (177°), Uranus (98°), and Pluto (123°) the
  // axial tilt > 90° ALSO encodes the retrograde flip. Using both at once
  // cancels back to prograde. When the tilt does the work, we use only the
  // magnitude of the spin so the visible rotation matches reality.
  const tiltEncodesRetrograde = Math.abs(planet.axialTilt) > Math.PI / 2
  const visibleRotSpeed = tiltEncodesRetrograde
    ? Math.abs(planet.rotSpeedRadPerSec)
    : planet.rotSpeedRadPerSec

  const eccentricity = planet.raw.deep?.eccentricity ?? 0
  const useEllipticalOrbit = eccentricity > 0.01

  useFrame((_, delta) => {
    const tw = timeWarpRef.current
    if (meshRef.current) meshRef.current.rotation.y += delta * visibleRotSpeed * tw

    // Mean anomaly for this frame. Anchored bodies derive it straight from
    // the simulation date (deterministic, scrubbable); legacy bodies keep
    // accumulating uniformly off their startPhase.
    let M: number
    if (m0Rad != null) {
      M = meanAnomalyAt(m0Rad, planet.raw.periodDays, simTimeRef.current.simMs)
    } else {
      meanAnomalyRef.current += delta * planet.orbitalSpeedRadPerSec * tw
      M = meanAnomalyRef.current
    }

    // Kepler's 2nd law in action: solve E - e·sin E = M for the eccentric
    // anomaly, convert to true anomaly, then set BOTH the orbit rotation
    // AND the radial distance from those values. Bodies on eccentric
    // orbits sweep equal areas in equal times — fast at perihelion,
    // slow at aphelion — matching the textbook Keplerian behaviour. The
    // periRad offset rotates the apsidal line so perihelion points the
    // real direction.
    // Live base orbit radius — recomputed from the ACTIVE scale mode each frame
    // (explore = sqrt-compressed; true = linear AU) and lerped, so flipping the
    // true-scale toggle smoothly spreads the planets to their real ratios instead
    // of snapping. Falls back to the static layout radius if aAU is absent.
    const baseR = planet.raw.aAU != null ? compressRadius(planet.raw.aAU) : planet.orbitRadius
    if (useEllipticalOrbit && positionRef.current && orbitRef.current) {
      const E = solveKepler(M, eccentricity)
      const trueAnom = eccentricToTrue(E, eccentricity)
      const r = (baseR * (1 - eccentricity * eccentricity)) /
                (1 + eccentricity * Math.cos(trueAnom))
      orbitRef.current.rotation.y = trueAnom + periRad
      const k = 1 - Math.exp(-delta * 3)
      positionRef.current.position.x += (r - positionRef.current.position.x) * k
    } else if (orbitRef.current) {
      // Circular orbit (or near-circular): true anomaly == mean anomaly.
      orbitRef.current.rotation.y = M + periRad
      if (positionRef.current) {
        const k = 1 - Math.exp(-delta * 3)
        positionRef.current.position.x += (baseR - positionRef.current.position.x) * k
      }
    }


    // Textured sphere rotates in lockstep with the grey one underneath so
    // surface features (Earth's continents, Jupiter's bands, Saturn's
    // stripes) drift naturally as time advances. The surface-pins group
    // also tracks the same spin so rover pins stay glued to their
    // landing coordinates as Mars rotates.
    if (surfaceRotRef.current) {
      surfaceRotRef.current.rotation.y += delta * visibleRotSpeed * tw
    }
    if (texMeshRef.current) {
      texMeshRef.current.rotation.y += delta * visibleRotSpeed * tw
    }
    // Band shell spins in lockstep with the texture so the drifting bands stay
    // glued to the globe's longitude.
    if (bandsMeshRef.current) {
      bandsMeshRef.current.rotation.y += delta * visibleRotSpeed * tw
    }
    // Lerp the textured material's opacity to full as soon as the JPEG lands —
    // the photo-real globe is the default state now, not a hover reveal.
    if (texMatRef.current) {
      const k = 1 - Math.exp(-delta * 8)
      const target = texture ? 1 : 0
      texMatRef.current.opacity += (target - texMatRef.current.opacity) * k
    }
    // Day/night shader path (Earth only today) — update opacity + the sun
    // direction uniform each frame. Sun world position is fixed at the
    // solar system's origin offset; Earth's world position moves with the
    // orbit. dot(normal, sunDir) in the shader produces the terminator.
    if (useDayNightShader && texMeshRef.current) {
      const k = 1 - Math.exp(-delta * 8)
      const target = texture && nightTexture ? 1 : 0
      dayNightUniforms.uOpacity.value += (target - dayNightUniforms.uOpacity.value) * k
      texMeshRef.current.getWorldPosition(_earthWorldPos)
      _sunWorldPos.set(SUN_OFFSET_SCENE, 0, 0)
      _sunDirTmp.copy(_sunWorldPos).sub(_earthWorldPos).normalize()
      dayNightUniforms.uSunDir.value.copy(_sunDirTmp)
    }
    // Poll the satellites toggle (only matters for bodies with orbiters).
    if (satShells) {
      const want = satellitesVisibleRef.current
      if (want !== satsOn) setSatsOn(want)
    }
    // Earth cloud shell — drift + sun direction + a fade that follows the
    // globe's reveal AND the cloud toggle (cloudsVisibleRef).
    if (isEarth && cloudMatRef.current) {
      cloudUniforms.uTime.value += delta * tw
      meshRef.current?.getWorldPosition(_earthWorldPos)
      _sunWorldPos.set(SUN_OFFSET_SCENE, 0, 0)
      cloudUniforms.uSunDir.value.copy(_sunDirTmp.copy(_sunWorldPos).sub(_earthWorldPos).normalize())
      const k = 1 - Math.exp(-delta * 6)
      const target = texture && cloudsVisibleRef.current ? 0.9 : 0
      cloudUniforms.uOpacity.value += (target - cloudUniforms.uOpacity.value) * k
    }
    // Earth's polar aurora shell — shimmers on the NIGHT side at high latitudes.
    // Fades in only on deep engagement (hover/focus) so it's a deep-zoom reward,
    // sharing the cloud toggle so "hide clouds" also hides the aurora.
    if (isEarth && auroraMatRef.current) {
      auroraUniforms.uTime.value += delta * tw
      meshRef.current?.getWorldPosition(_earthWorldPos)
      _sunWorldPos.set(SUN_OFFSET_SCENE, 0, 0)
      auroraUniforms.uSunDir.value.copy(_sunDirTmp.copy(_sunWorldPos).sub(_earthWorldPos).normalize())
      const k = 1 - Math.exp(-delta * 5)
      const target = detailActive && cloudsVisibleRef.current ? 1 : 0
      auroraUniforms.uOpacity.value += (target - auroraUniforms.uOpacity.value) * k
    }
    // Drifting atmosphere bands (Venus + gas/ice giants) — appear with the
    // textured globe, drift at the planet's own band speed, lit by the Sun.
    if (isBanded && bandsMatRef.current) {
      bandsUniforms.uTime.value += delta * tw * (bandConf?.speed ?? 0.03)
      meshRef.current?.getWorldPosition(_earthWorldPos)
      _sunWorldPos.set(SUN_OFFSET_SCENE, 0, 0)
      bandsUniforms.uSunDir.value.copy(_sunDirTmp.copy(_sunWorldPos).sub(_earthWorldPos).normalize())
      const k = 1 - Math.exp(-delta * 6)
      const target = texture ? 1 : 0
      bandsUniforms.uOpacity.value += (target - bandsUniforms.uOpacity.value) * k
    }
    // Rocky-planet atmospheric scattering shell — fades in on hover/focus.
    // Per-planet peak intensity matches real atmospheric depth (Venus dense,
    // Earth iconic-but-thinner, Mars almost transparent). The shader handles
    // the sun-aware limb glow; here we just drive opacity + the sun direction.
    if (atmosShaderRef.current) {
      const k = 1 - Math.exp(-delta * 8)
      const peakOpacity =
        planet.raw.name === "Venus" ? (invert ? 0.40 : 0.65) :
        planet.raw.name === "Earth" ? (invert ? 0.28 : 0.48) :
        planet.raw.name === "Mars"  ? (invert ? 0.14 : 0.24) :
        0.38
      // In the solar explorer, Earth is the permanent anchor of the view, so
      // keep a baseline atmosphere rim always on (the thin blue limb every real
      // Earth-from-space shot has) — not gated on hover. Elsewhere it's a
      // deep-engagement reward.
      const baseline = solarOnly && isEarth && !invert ? peakOpacity * 0.8 : 0
      const target = detailActive ? peakOpacity : baseline
      atmosUniforms.uOpacity.value += (target - atmosUniforms.uOpacity.value) * k
      meshRef.current?.getWorldPosition(_earthWorldPos)
      _sunWorldPos.set(SUN_OFFSET_SCENE, 0, 0)
      atmosUniforms.uSunDir.value.copy(_sunDirTmp.copy(_sunWorldPos).sub(_earthWorldPos).normalize())
    }
  })

  const hitRadius = Math.max(planet.visualRadius * 2.2, 0.18)
  const childMoons = moons.filter((m) => m.parent === planet.raw.name)
  // Whichever planet's hovered or focused: its moons brighten + scale up.
  // Earth's Luna, Jupiter's Galilean four, Saturn's Titan, Neptune's Triton,
  // Pluto's Charon — all coordinated to the parent's interactive state.
  const moonsHighlighted = detailActive
  // Rocky planets with real atmospheres get a limb-glow halo on focus.
  // Colour matches each atmosphere's actual scattering — cyan-blue for
  // Earth, pale cream for Venus's sulfuric clouds, faint salmon for
  // Mars's thin CO₂ dust. Shell size scales with actual atmospheric
  // depth: Venus's dense deck bloats noticeably, Mars's barely halos.
  // Gas giants are skipped because the visible planet *is* its atmosphere.
  const atmosphereColor =
    planet.raw.name === "Earth" ? (invert ? "#3a5a7a" : "#7ec8ff") :
    planet.raw.name === "Venus" ? (invert ? "#5a4828" : "#fff0b8") :
    planet.raw.name === "Mars"  ? (invert ? "#4a2018" : "#ffa284") :
    null
  const hasAtmosphere = atmosphereColor !== null
  // Feed the per-planet atmosphere colour + a tighter Fresnel for thin
  // atmospheres into the scattering shader.
  useEffect(() => {
    if (atmosphereColor) atmosUniforms.uColor.value.set(atmosphereColor)
    atmosUniforms.uPower.value =
      planet.raw.name === "Mars" ? 4.0 :
      planet.raw.name === "Venus" ? 2.4 : 3.0
  }, [atmosphereColor, planet.raw.name, atmosUniforms])
  const atmosphereScale =
    planet.raw.name === "Venus" ? 1.060 :
    planet.raw.name === "Earth" ? 1.045 :
    planet.raw.name === "Mars"  ? 1.025 :
    1.045

  return (
    <group rotation={[planet.inclination, 0, 0]}>
      <group ref={orbitRef}>
        <group ref={positionRef} position={[planet.orbitRadius, 0, 0]}>
          <group rotation={[planet.axialTilt, 0, 0]}>
            <mesh ref={meshRef}>
              <sphereGeometry args={[planet.visualRadius, 48, 48]} />
              <meshStandardMaterial
                // Planet shades read fine on either theme — pale greys catch
                // both ink-and-cream and white-on-black light without changes.
                color={planet.raw.shade}
                roughness={0.95}
                metalness={0.0}
              />
            </mesh>

            {/* Textured-globe overlay — stacked on top of the grey sphere for
                any planet with a textureUrl. Higher segment count on Earth
                so deep-zoom inspection doesn't reveal facets. Opacity lerps
                in on hover OR focus.
                Earth takes the day/night shader path (lit + city-lights
                hemispheres separated by a smoothed terminator); everyone
                else uses the standard PBR sphere lit by the Sun point light. */}
            {hasTexture && useDayNightShader && texture && (!nightTextureUrl || nightTexture) && (
              <mesh ref={texMeshRef}>
                <sphereGeometry args={[planet.visualRadius * 1.005, (planet.raw.name === "Earth" || planet.raw.elevationUrl) ? 96 : 64, (planet.raw.name === "Earth" || planet.raw.elevationUrl) ? 96 : 64]} />
                <shaderMaterial
                  ref={dayNightMatRef as React.Ref<ShaderMaterial>}
                  vertexShader={DAY_NIGHT_VERTEX_SHADER}
                  fragmentShader={DAY_NIGHT_FRAGMENT_SHADER}
                  uniforms={dayNightUniforms}
                  transparent
                  depthWrite={false}
                />
              </mesh>
            )}
            {/* Earth's procedural cloud shell — sits just above the surface,
                lit by the Sun, animated + toggleable. No texture file. */}
            {isEarth && (
              <mesh>
                <sphereGeometry args={[planet.visualRadius * 1.02, 96, 96]} />
                <shaderMaterial
                  ref={cloudMatRef as React.Ref<ShaderMaterial>}
                  vertexShader={CLOUD_VERTEX_SHADER}
                  fragmentShader={CLOUD_FRAGMENT_SHADER}
                  uniforms={cloudUniforms}
                  transparent
                  depthWrite={false}
                />
              </mesh>
            )}
            {/* Earth's polar aurora — just above the clouds, additive, night-side
                + high-latitude only. A deep-zoom reward. */}
            {isEarth && (
              <mesh>
                <sphereGeometry args={[planet.visualRadius * 1.035, 96, 96]} />
                <shaderMaterial
                  ref={auroraMatRef as React.Ref<ShaderMaterial>}
                  vertexShader={AURORA_VERTEX_SHADER}
                  fragmentShader={AURORA_FRAGMENT_SHADER}
                  uniforms={auroraUniforms}
                  transparent
                  depthWrite={false}
                  blending={AdditiveBlending}
                />
              </mesh>
            )}

            {hasTexture && !useDayNightShader && texture && (
              <mesh ref={texMeshRef}>
                <sphereGeometry args={[
                  planet.visualRadius * 1.005,
                  64,
                  64,
                ]} />
                <meshStandardMaterial
                  ref={texMatRef as React.Ref<import("three").MeshStandardMaterial>}
                  map={texture}
                  roughness={0.85}
                  metalness={0.0}
                  transparent
                  opacity={0}
                  depthWrite={false}
                />
              </mesh>
            )}
            {/* Drifting atmosphere bands — Venus's haze + the gas/ice giants'
                zonal jets. A thin animated shell over the texture; the band
                motion lives in the shader (uTime longitude scroll). */}
            {isBanded && texture && (
              <mesh ref={bandsMeshRef}>
                <sphereGeometry args={[planet.visualRadius * 1.012, 64, 64]} />
                <shaderMaterial
                  ref={bandsMatRef as React.Ref<ShaderMaterial>}
                  vertexShader={BANDS_VERTEX_SHADER}
                  fragmentShader={BANDS_FRAGMENT_SHADER}
                  uniforms={bandsUniforms}
                  transparent
                  depthWrite={false}
                  blending={AdditiveBlending}
                />
              </mesh>
            )}

            {/* Surface landing-site pins — currently populated for Mars
                (rovers + landers). Rotates with the planet body so each
                pin stays glued to its real lat / lon as Mars spins.
                Renders only when the user is engaged with the planet
                (hover or focus), so far-out idle views don't clutter. */}
            {planet.raw.surfaceFeatures && detailActive && (
              <group ref={surfaceRotRef}>
                {planet.raw.surfaceFeatures.map((feature) => (
                  <RoverPin
                    key={feature.name}
                    feature={feature}
                    planetRadius={planet.visualRadius}
                    invert={invert}
                    onHover={onHover}
                  />
                ))}
              </group>
            )}

            {/* Rocky-planet atmospheric scattering shell — Earth's cyan,
                Venus's pale yellow, Mars's faint salmon. A sun-aware Fresnel
                limb glow (brightest on the day-facing limb, with a faint
                terminator forward-scatter) instead of a flat halo, so it reads
                as real Rayleigh scattering seen from space. */}
            {hasAtmosphere && atmosphereColor && (
              <mesh>
                <sphereGeometry args={[planet.visualRadius * atmosphereScale, 64, 64]} />
                <shaderMaterial
                  ref={atmosShaderRef as React.Ref<ShaderMaterial>}
                  vertexShader={ATMOS_VERTEX_SHADER}
                  fragmentShader={ATMOS_FRAGMENT_SHADER}
                  uniforms={atmosUniforms}
                  transparent
                  blending={invert ? NormalBlending : AdditiveBlending}
                  depthWrite={false}
                  side={DoubleSide}
                />
              </mesh>
            )}

            <mesh
              onPointerOver={(e) => {
                e.stopPropagation()
                setIsHovered(true)
                onHover({ ...planetToInfo(planet.raw), followable: interactive })
              }}
              onPointerOut={() => {
                setIsHovered(false)
                onHover(null)
              }}
              // Click engages follow mode on the planet — the camera locks
              // onto its current world position and tracks as it orbits.
              // Same gesture as comets + spacecraft: a plain fly-to would
              // leave Mercury or Earth drifting out of frame seconds after
              // arrival. The focused flag stays set so the texture +
              // atmosphere bloom persist while we're tracking.
              onClick={
                interactive
                  ? (e) => {
                      e.stopPropagation()
                      setFocused(true)
                      window.dispatchEvent(
                        new CustomEvent("universe:sky-focus", {
                          detail: { pointId: `planet:${planet.raw.name}` },
                        }),
                      )
                      // Land close enough for a real surface read — Earth
                      // ends up at ~0.7 units (planet fills ~⅓ of the view),
                      // Jupiter at ~2.3 (banding readable), Saturn at ~3
                      // (rings frame). Users can scroll deeper to 0.2.
                      const followDistance = Math.max(
                        planet.visualRadius * (planet.raw.hasRings ? 5 : 3.5),
                        0.5,
                      )
                      // The getter captures e.object (the hit-mesh inside
                      // the orbit-rotated group) — its world position
                      // updates each frame as the planet orbits.
                      const obj = e.object
                      requestFollow(
                        () => {
                          const v = new Vector3()
                          obj.getWorldPosition(v)
                          return { x: v.x, y: v.y, z: v.z }
                        },
                        followDistance,
                        planet.raw.name,
                      )
                    }
                  : undefined
              }
              onDoubleClick={
                interactive
                  ? (e) => {
                      // Discoverability fallback — double-click runs the
                      // same follow as single click.
                      e.stopPropagation()
                      setFocused(true)
                      window.dispatchEvent(
                        new CustomEvent("universe:sky-focus", {
                          detail: { pointId: `planet:${planet.raw.name}` },
                        }),
                      )
                      const followDistance = Math.max(
                        planet.visualRadius * (planet.raw.hasRings ? 5 : 3.5),
                        0.5,
                      )
                      const obj = e.object
                      requestFollow(
                        () => {
                          const v = new Vector3()
                          obj.getWorldPosition(v)
                          return { x: v.x, y: v.y, z: v.z }
                        },
                        followDistance,
                        planet.raw.name,
                      )
                    }
                  : undefined
              }
            >
              <sphereGeometry args={[hitRadius, 24, 24]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
            {planet.raw.hasRings && (
              <SaturnRings
                planetRadius={planet.visualRadius}
                invert={invert}
                highlighted={isHovered}
              />
            )}
          </group>

          {/* Human-made satellite shells — orbit the planet centre (outside the
              axial-tilt group so they don't spin with the surface). Revealed by
              the HUD "Satellites" toggle. */}
          {satShells && satsOn && (
            <SatelliteShells
              shells={solarOnly && isEarth ? [] : satShells}
              heroCraft={HERO_CRAFT[planet.raw.name]}
              bodyRadius={planet.visualRadius}
              onHover={onHover}
              interactive={interactive}
              trueScale={solarOnly}
            />
          )}

          {/* Real ~15.7k-satellite catalogue (SGP4) — Earth only, in the
              solar-only explorer, when satellites are toggled on. */}
          {isEarth && solarOnly && satsOn && (
            <Suspense fallback={null}>
              <SatelliteField earthVisualRadius={planet.visualRadius} />
            </Suspense>
          )}

          {/* Hover-label — small floating name above the planet, helping
              discoverability without forcing users to wait for the corner
              InfoPanel to update. Stays outside the axial-tilt group so
              the label points "up" in the orbit frame, not down through
              Venus's flipped pole. Hover only — mobile uses the bottom
              sheet (which already shows the name) so no double-up there. */}
          {isHovered && (
            <Html
              position={[0, Math.max(planet.visualRadius * 2.4, 0.28), 0]}
              center
              distanceFactor={8}
              zIndexRange={[10, 0]}
              style={{ pointerEvents: "none" }}
            >
              <div
                className={`
                  whitespace-nowrap select-none pointer-events-none
                  font-mono text-[10px] tracking-[0.3em] uppercase
                  px-2 py-1 rounded-full backdrop-blur-sm
                  ${
                    invert
                      ? "bg-white/85 border border-foreground/25 text-foreground"
                      : "bg-black/55 border border-white/20 text-white"
                  }
                `}
                style={{ animation: "ue-label-in 220ms ease-out both" }}
              >
                {planet.raw.name}
              </div>
            </Html>
          )}

          {childMoons.map((m) => (
            <MoonBody
              key={m.name}
              moon={m}
              onHover={onHover}
              highlighted={moonsHighlighted}
              interactive={interactive}
            />
          ))}
        </group>
      </group>
    </group>
  )
}

function OrbitRing({
  radius,
  aAU,
  inclination,
  eccentricity = 0,
  invert = false,
}: {
  radius: number
  /** Real semi-major axis (AU). When present, the ring rescales live with the
   *  active scale mode (explore ↔ true) so it tracks the planet's live radius. */
  aAU?: number
  inclination: number
  /** Optional orbital eccentricity. When > 0, draws a polar-form ellipse with
   *  the Sun at one focus (the astronomically correct shape). 0 = circle. */
  eccentricity?: number
  invert?: boolean
}) {
  // The geometry is baked at the static `radius`; to honour the live scale mode
  // we uniformly scale the whole ring group by liveRadius/radius each frame
  // (both circle + ellipse scale linearly with radius, so this stays exact).
  const scaleRef = useRef<Group>(null)
  useFrame((_, delta) => {
    if (!scaleRef.current || aAU == null || radius <= 0) return
    const target = compressRadius(aAU) / radius
    const k = 1 - Math.exp(-delta * 3)
    const s = scaleRef.current.scale.x + (target - scaleRef.current.scale.x) * k
    scaleRef.current.scale.set(s, s, s)
  })
  const geometry = useMemo(() => {
    const segments = 192
    const arr = new Float32Array((segments + 1) * 3)
    if (eccentricity > 0.01) {
      // Polar-form ellipse with focus at origin: r(θ) = a(1-e²) / (1 + e·cos θ)
      // This is the correct orbital shape for any e > 0; for low-e planets
      // it's visually indistinguishable from a circle, but for Pluto (e=0.244)
      // the perihelion visibly dips inside Neptune's circle — making the
      // real astronomical crossing legible rather than a render glitch.
      const a = radius
      const oneMinusESq = 1 - eccentricity * eccentricity
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2
        const r = (a * oneMinusESq) / (1 + eccentricity * Math.cos(theta))
        arr[i * 3] = r * Math.cos(theta)
        arr[i * 3 + 1] = 0
        arr[i * 3 + 2] = r * Math.sin(theta)
      }
    } else {
      // Circle in xz plane.
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2
        arr[i * 3] = Math.cos(angle) * radius
        arr[i * 3 + 1] = 0
        arr[i * 3 + 2] = Math.sin(angle) * radius
      }
    }
    const geo = new BufferGeometry()
    geo.setAttribute("position", new BufferAttribute(arr, 3))
    return geo
  }, [radius, eccentricity])

  // Eccentric orbits get a softer line — the ellipse crosses neighbouring
  // circular orbits (Pluto / Neptune most notably), and a fainter stroke
  // keeps the crossing from reading as a render collision.
  const isEccentric = eccentricity > 0.15
  const baseOpacity = invert ? 0.42 : 0.08
  const opacity = isEccentric ? baseOpacity * 0.55 : baseOpacity

  return (
    <group ref={scaleRef}>
      <group rotation={[inclination, 0, 0]}>
        <threeLine geometry={geometry}>
          <lineBasicMaterial
            // Faint hairline orbits — ink on cream needs ~6× the opacity to
            // read at the same value as white-on-black.
            color={invert ? "#0a0a0a" : "#ffffff"}
            transparent
            opacity={opacity}
          />
        </threeLine>
      </group>
    </group>
  )
}

function SolarSystem({
  onHover,
  invert = false,
  interactive = false,
  mobile = false,
  solarOnly = false,
}: {
  onHover: HoverHandler
  invert?: boolean
  interactive?: boolean
  mobile?: boolean
  solarOnly?: boolean
}) {
  const coronaRef = useRef<Mesh>(null)
  const sunSurfMeshRef = useRef<Mesh>(null)
  const sunSurfMatRef = useRef<ShaderMaterial>(null)
  const coronaInnerMatRef = useRef<ShaderMaterial>(null)
  const coronaOuterMatRef = useRef<ShaderMaterial>(null)
  const [sunHovered, setSunHovered] = useState(false)
  // Procedural photosphere uniforms — colours are the REAL blackbody hues of
  // the Sun's surface temperatures (the Sun is a near-white 5,772 K body, not
  // orange — that's an atmospheric illusion). Same tempToRgb physics as the
  // star field, so the Sun is consistent with the catalogue:
  //   intergranular lanes ~5,400 K #ffecdb · photosphere 5,772 K #fff2e6 ·
  //   bright network ~6,800 K #faf6ff. Contrast (not orange) reads as
  //   convection. Chart/invert mode keeps the amber brand tint for legibility
  //   on the light theme.
  const SUN_LANE = "#ffe4c4"   // slightly deepened 5,400 K lane for granule contrast
  const SUN_PHOTO = "#fff2e6"  // real 5,772 K photosphere
  const SUN_NET = "#fbf7ff"    // ~6,800 K hot network
  const sunSurfUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uCool: { value: new Color(invert ? "#8a3a12" : SUN_LANE) },
      uWarm: { value: new Color(invert ? "#c9662a" : SUN_PHOTO) },
      uHot:  { value: new Color(invert ? "#e8b070" : SUN_NET) },
      uIntensity: { value: invert ? 0.9 : 1.25 },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  useEffect(() => {
    sunSurfUniforms.uCool.value.set(invert ? "#8a3a12" : SUN_LANE)
    sunSurfUniforms.uWarm.value.set(invert ? "#c9662a" : SUN_PHOTO)
    sunSurfUniforms.uHot.value.set(invert ? "#e8b070" : SUN_NET)
    sunSurfUniforms.uIntensity.value = invert ? 0.9 : 1.25
  }, [invert, sunSurfUniforms])
  // Chunky belt-rock GLBs (2.7 MB) stream in the first time the user enters
  // explore mode — at passive-backdrop distances the point-cloud belts carry
  // the look, so the rocks aren't missed. Sticky: once loaded, keep them
  // mounted across explore-mode toggles (no churn, they're already cached).
  const [rocksWanted, setRocksWanted] = useState(false)
  useEffect(() => {
    if (interactive && !rocksWanted) setRocksWanted(true)
  }, [interactive, rocksWanted])
  const scenePlanets = useMemo(() => buildScenePlanets(), [])
  const sunRotSpeed = useMemo(
    () => (2 * Math.PI) / (25 / TIME_WARP_DAYS_PER_SEC),
    [],
  )

  useFrame((_, delta) => {
    const tw = timeWarpRef.current
    if (sunSurfMeshRef.current) sunSurfMeshRef.current.rotation.y += delta * sunRotSpeed * tw
    if (coronaRef.current) {
      const s = 1 + Math.sin(performance.now() * 0.0008) * 0.025
      coronaRef.current.scale.set(s, s, s)
    }
    // Advance the procedural photosphere (granulation churn). Runs at real time,
    // not warped, so the surface simmers at a natural pace regardless of the
    // orbital time-warp.
    if (sunSurfMatRef.current) {
      sunSurfMatRef.current.uniforms.uTime.value += delta
    }
    const flareBoost = sunHovered ? 1 : 0
    const k = 1 - Math.exp(-delta * 6)
    // The corona's intensity rides on a shader uniform now — the Fresnel
    // pass already shapes the radial falloff, we just lerp peak brightness.
    if (coronaInnerMatRef.current) {
      const baseOpacity = invert ? 0.55 : 0.50
      const targetOpacity = baseOpacity + flareBoost * (invert ? 0.40 : 0.55)
      const u = coronaInnerMatRef.current.uniforms.uIntensity
      u.value += (targetOpacity - u.value) * k
    }
    if (coronaOuterMatRef.current) {
      const baseOpacity = invert ? 0.30 : 0.22
      const targetOpacity = baseOpacity + flareBoost * (invert ? 0.30 : 0.42)
      const u = coronaOuterMatRef.current.uniforms.uIntensity
      u.value += (targetOpacity - u.value) * k
    }
  })

  // Chart-mode Sun: the procedural photosphere shifts to amber via its uniforms
  // (see sunSurfUniforms). Lighting drops to almost ambient — planets get most
  // of their colour from the scene's ambientLight when invert is on.
  const coronaBlending = invert ? NormalBlending : AdditiveBlending
  // Peak Fresnel intensities — the shader bakes in radial falloff, so
  // these are the *limb-edge* brightness ceilings, not flat-disc opacities.
  // Bumped from the pre-Fresnel values because most of the sphere now
  // contributes near-zero alpha; only the silhouette edge glows.
  const coronaInnerOpacity = invert ? 0.55 : 0.50
  const coronaOuterOpacity = invert ? 0.30 : 0.22
  const pointLightIntensity = invert ? 0.5 : 3.5

  const coronaInnerUniforms = useMemo(
    () => ({
      uColor: { value: new Color(invert ? "#c95824" : "#ffffff") },
      uIntensity: { value: coronaInnerOpacity },
      uPower: { value: 3.0 },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const coronaOuterUniforms = useMemo(
    () => ({
      uColor: { value: new Color(invert ? "#e5a878" : "#ffffff") },
      uIntensity: { value: coronaOuterOpacity },
      uPower: { value: 1.5 },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  // Keep uniform colour in sync with theme changes without recreating the
  // uniforms object (which would break the animated intensity lerp).
  useEffect(() => {
    coronaInnerUniforms.uColor.value.set(invert ? "#c95824" : "#ffffff")
    coronaOuterUniforms.uColor.value.set(invert ? "#e5a878" : "#ffffff")
  }, [invert, coronaInnerUniforms, coronaOuterUniforms])

  return (
    <group>
      {/* Procedural photosphere — a living, seam-free Sun surface (animated
          granulation + limb darkening) replacing the old stretched sun.webp
          that read as hard blocky patches. Higher-poly sphere so the silhouette
          is smooth at close focus. The old flat base sphere is gone: this shader
          renders the full lit disc itself. */}
      <mesh ref={sunSurfMeshRef}>
        <sphereGeometry args={[0.705, 128, 128]} />
        <shaderMaterial
          ref={sunSurfMatRef as React.Ref<ShaderMaterial>}
          vertexShader={SUN_SURFACE_VERTEX_SHADER}
          fragmentShader={SUN_SURFACE_FRAGMENT_SHADER}
          uniforms={sunSurfUniforms}
          toneMapped={false}
        />
      </mesh>
      {/* Inner corona — tight bright limb glow. Power 3.0 keeps the
          alpha concentrated near the silhouette so it reads as a
          chromosphere-style halo wrapping the Sun. */}
      <mesh ref={coronaRef}>
        <sphereGeometry args={[0.92, 48, 48]} />
        <shaderMaterial
          ref={coronaInnerMatRef as React.Ref<ShaderMaterial>}
          vertexShader={CORONA_VERTEX_SHADER}
          fragmentShader={CORONA_FRAGMENT_SHADER}
          uniforms={coronaInnerUniforms}
          transparent
          blending={coronaBlending}
          depthWrite={false}
        />
      </mesh>
      {/* Outer corona — wide soft falloff. Power 1.5 spreads the glow
          much further from the limb, giving the diffuse atmospheric
          halo you see in real solar imagery. */}
      <mesh>
        <sphereGeometry args={[1.3, 48, 48]} />
        <shaderMaterial
          ref={coronaOuterMatRef as React.Ref<ShaderMaterial>}
          vertexShader={CORONA_VERTEX_SHADER}
          fragmentShader={CORONA_FRAGMENT_SHADER}
          uniforms={coronaOuterUniforms}
          transparent
          blending={coronaBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh
        onPointerOver={(e) => {
          e.stopPropagation()
          setSunHovered(true)
          onHover(SUN_INFO)
        }}
        onPointerOut={() => {
          setSunHovered(false)
          onHover(null)
        }}
        // Click flies the camera to the Sun. Distance ~3.2 frames the sphere
        // + corona without losing the inner planets at the edges.
        onClick={makeFocusHandler(interactive, 3.2, "Sun")}
      >
        <sphereGeometry args={[0.9, 32, 32]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <pointLight position={[0, 0, 0]} intensity={pointLightIntensity} distance={60} color="#ffffff" decay={1.3} />

      {scenePlanets.map((p) => (
        <OrbitRing
          key={`orbit-${p.raw.name}`}
          radius={p.orbitRadius}
          aAU={p.raw.aAU}
          inclination={p.inclination}
          eccentricity={p.raw.deep?.eccentricity ?? 0}
          invert={invert}
        />
      ))}

      {scenePlanets.map((p) => (
        <PlanetBody
          key={p.raw.name}
          planet={p}
          onHover={onHover}
          invert={invert}
          interactive={interactive}
          solarOnly={solarOnly}
        />
      ))}

      {/* Asteroid Belt — 2.2–3.2 AU → sqrt × 3 → 4.45–5.37 scene units */}
      <Belt
        innerRadius={4.45}
        outerRadius={5.37}
        count={900}
        thickness={0.12}
        rotationSpeed={0.05}
        pointSize={0.035}
        opacity={0.75}
        info={ASTEROID_BELT_INFO}
        onHover={onHover}
        invert={invert}
      />
      {/* Real Blender rock meshes scattered through the asteroid belt — the
          chunky bodies the eye catches; the point cloud above carries the
          thousands of distant specks. Streams in via Suspense; off in chart. */}
      {!invert && rocksWanted && (
        <Suspense fallback={null}>
          <BeltAsteroids
            innerRadius={4.45}
            outerRadius={5.37}
            count={mobile ? 26 : 48}
            thickness={0.12}
            rotationSpeed={0.05}
            baseScale={0.05}
            seed={7}
          />
        </Suspense>
      )}

      {/* Kuiper Belt — 30–50 AU → 16.43–21.21 scene units */}
      <Belt
        innerRadius={16.43}
        outerRadius={21.21}
        count={1400}
        thickness={0.35}
        rotationSpeed={0.012}
        pointSize={0.03}
        opacity={0.5}
        info={KUIPER_BELT_INFO}
        onHover={onHover}
        invert={invert}
      />
      {/* Real icy bodies through the Kuiper Belt — sparser + larger than the
          asteroid belt (Pluto-class chunks out here). */}
      {!invert && rocksWanted && (
        <Suspense fallback={null}>
          <BeltAsteroids
            innerRadius={16.43}
            outerRadius={21.21}
            count={mobile ? 16 : 30}
            thickness={0.35}
            rotationSpeed={0.012}
            baseScale={0.09}
            seed={42}
          />
        </Suspense>
      )}
    </group>
  )
}

/* ============================================================
 * Named small bodies — comets, asteroids, interstellars
 *
 * Each body is animated continuously along its own elliptical / hyperbolic
 * path defined in astronomy.ts. The orbit math is a deliberate
 * simplification of Kepler's laws — true anomaly is approximated as a
 * uniform angle around the focus (the Sun) rather than solving Kepler's
 * equation per frame — so the motion isn't physically accurate but reads
 * correctly (slower at aphelion, faster at perihelion).
 *
 * Each body is also a hover target. The cursor reticle picks up its name,
 * the InfoPanel surfaces its designation + fact, and (on mobile) the
 * MobileBodySheet slides up with the same data.
 *
 * Scene-scale: same sqrt(aAU) * 3 mapping the planets use, so a comet at
 * 17.8 AU sits at the right radial distance relative to Saturn/Uranus.
 * ============================================================ */

/**
 * Convert orbital elements at true anomaly t to a Cartesian (x, y, z)
 * position in the solar-system frame. Standard orbital-mechanics sequence:
 *   1. Position in orbital plane with perihelion at +x_orbital
 *   2. Rotate by argument of periapsis (ω) around plane normal
 *   3. Tilt by inclination (i) around line of nodes
 *   4. Rotate by longitude of ascending node (Ω) around y-axis
 *
 * With Ω = 0 and ω = 0 this reduces to the simpler "tilt-only" math we
 * used before — backwards-compatible for bodies that don't specify them.
 *
 * The solar-system frame's +x aligns with vernal equinox (RA = 0), +y is
 * the ecliptic pole, +z is RA = 6h — same convention `raDecToScenePos`
 * uses for the sky shell, so escape directions line up with constellations.
 */
// Reusable vectors for per-frame comet tail orientation — avoid allocating
// fresh Vector3s every frame for every comet.
const _tailFrom = new Vector3()
const _tailTo = new Vector3()

// Reusable vectors for the Earth day/night shader's sun-direction uniform.
const _earthWorldPos = new Vector3()
const _sunWorldPos = new Vector3()
const _sunDirTmp = new Vector3()

/**
 * Solve Kepler's equation M = E - e·sin(E) for the eccentric anomaly E.
 * Used to make orbital motion honour Kepler's 2nd law — bodies move
 * faster at perihelion, slower at aphelion. Newton-Raphson, typically
 * converges in 4–6 iterations even for e ~ 0.97 (Halley's eccentricity).
 *
 * Returns mean anomaly directly for hyperbolic orbits (e >= 1) — solving
 * the hyperbolic-Kepler analog is a separate equation we don't need at
 * scene scale, and our hyperbolic bodies (Voyagers, 'Oumuamua etc.)
 * already use a phase-wrap loop rather than real Kepler motion.
 */
/**
 * Scene-scale compression curve.
 *
 * The solar system spans five orders of magnitude (Mercury 0.39 AU →
 * Voyager 1 ~160 AU). Linear scaling would either make the inner
 * planets invisibly small or push the outer ones off-screen, so we
 * compress radii with sqrt() — the same trick stellar charts use.
 *
 * The earlier implementation applied sqrt() to the semi-major axis
 * (`a`) and then plugged that into the Keplerian polar form
 * r = a(1-e²)/(1+e·cosθ). That's mathematically inconsistent: for
 * an eccentric orbit the perihelion ends up at sqrt(a)·(1-e), which
 * is much closer to the Sun than the consistent sqrt(a·(1-e)). Parker
 * Solar Probe (a=0.39, e=0.881, perihelion 0.046 AU) plunged INSIDE
 * the rendered Sun every quarter-year, and sungrazers (Ikeya-Seki,
 * perihelion 0.008 AU) effectively disappeared into the corona.
 *
 * Fix: compute r in real AU using the actual elements, then apply
 * sqrt-compression to r — not to a. Now scene perihelion =
 * sqrt(a·(1-e))·3, which faithfully scales to real perihelia.
 * Parker comes out at sqrt(0.046)·3 ≈ 0.64 scene units (well outside
 * the 0.9-unit Sun mesh), and the full orbit lives in scene space
 * where every body sits at sqrt(real_distance_AU)·3 from origin.
 *
 * Side effect: the orbit shape in scene space is no longer a perfect
 * ellipse — it's a sqrt-compressed ellipse, which looks slightly
 * less dramatic at high eccentricity. We accept that. The trade is
 * visual consistency with the rest of the scene (planets, moons,
 * named-body distances all live in the same sqrt(AU)·3 frame).
 */

function NamedBodyMesh({
  body,
  onHover,
  invert = false,
  interactive = false,
}: {
  body: NamedBody
  onHover: HoverHandler
  invert?: boolean
  interactive?: boolean
}) {
  const groupRef = useRef<Group>(null)
  /** Comet nucleus mesh — rotated slowly each frame so the surface
   *  appears to spin like a real cometary nucleus (67P rotates every
   *  ~12.4 hours; jets pulse on and off as active areas swing into the
   *  sunlight). The rotation here is decorative, not period-accurate. */
  const nucleusRef = useRef<Mesh>(null)
  /** Comet-tail orientation — quaternion-rotated each frame so the tail
   *  always streams away from the Sun (origin), matching real solar-wind
   *  physics. Only used when body.kind === "comet" (or Comet Borisov). */
  const tailRef = useRef<Group>(null)
  /** Sunward parabolic envelope — bright dust hood that hangs on the
   *  Sun-facing side of an active comet. Opacity fades with heliocentric
   *  distance the same way the tails do. Lives inside tailRef so it
   *  stays oriented correctly without per-frame quaternion work. */
  const envelopeMatRef = useRef<ShaderMaterial>(null)
  /** Jet streamers group — three thin plumes shooting from the nucleus
   *  on the sunward hemisphere. Rotated slowly to simulate the nucleus
   *  spinning, so active spots periodically turn into and out of the
   *  Sun like real cometary jets. */
  const jetsRef = useRef<Group>(null)
  const jetMatRef = useRef<ShaderMaterial>(null)
  /** Comet ion-tail mesh — position + scale updated each frame so the
   *  tail length tracks distance from Sun (long at perihelion, faint at
   *  aphelion), matching real solar-wind sublimation. Uses a custom
   *  shader so the tail fades along its length (vapour, not plastic). */
  const tailMeshRef = useRef<Mesh>(null)
  const tailMatRef = useRef<ShaderMaterial>(null)
  /** Comet dust-tail mesh — second tail rendered in warm gold, offset
   *  from the ion tail by ~15° to fake the curve produced by radiation
   *  pressure pushing dust out slower than solar wind ions. */
  const dustTailMeshRef = useRef<Mesh>(null)
  const dustTailMatRef = useRef<ShaderMaterial>(null)
  /** Anti-tail spike — a short, sunward-pointing dust spike visible
   *  only for certain great comets at specific viewing geometries
   *  (Tsuchinshan–ATLAS 2024 is the textbook recent example). Not a
   *  real third tail — a projection artefact of dust spread along the
   *  orbital plane seen edge-on. Rendered as a thin cone pointing
   *  toward the Sun, only fading in close to perihelion. */
  const antiTailMeshRef = useRef<Mesh>(null)
  const antiTailMatRef = useRef<ShaderMaterial>(null)
  const comaInnerMatRef = useRef<import("three").MeshBasicMaterial>(null)
  const comaMidMatRef = useRef<import("three").MeshBasicMaterial>(null)
  const comaOuterMatRef = useRef<import("three").MeshBasicMaterial>(null)
  const cometPulseRef = useRef(Math.random() * Math.PI * 2)
  /** Motion trail — ring buffer of recent positions rendered as fading
   *  particles behind the body. Makes orbital movement legible at any
   *  time-warp (the body itself moves slowly in any given second; the
   *  trail makes that motion visible by streaking the recent path). */
  const motionTrailRef = useRef<{
    positions: Float32Array
    colors: Float32Array
    ages: Float32Array
    geometry: BufferGeometry
    nextIdx: number
  } | null>(null)
  /** Trail material — opacity lerps with hover state so the static orbit
   *  paths don't pile up at crossings (the no-collisions rule). */
  const trailMatRef = useRef<import("three").PointsMaterial>(null)
  const [isHovered, setIsHovered] = useState(false)

  // Pre-compute everything time-independent: orbital scale, tilt, base colour.
  const config = useMemo(() => {
    // `a` is the REAL semi-major axis in AU. Scene-space compression is
    // applied inside orbitalElementsToCartesian (sqrt(r)·3) so the
    // perihelion + aphelion of every eccentric orbit scale consistently
    // with planet distances — Parker, Ikeya-Seki etc. no longer plunge
    // through the Sun mesh.
    const a = body.aAU
    const e = body.eccentricity
    const inclination = body.inclDeg * DEG
    const visualRadius = body.visualRadius ?? 0.05
    // Periodic bodies loop; interstellars get a finite "passage window"
    // measured in seconds of scene time so the user can see them coming
    // and going without them living on screen indefinitely.
    const period = isFinite(body.periodYears)
      ? body.periodYears * 365.25 / TIME_WARP_DAYS_PER_SEC
      : 120 // ~2 minutes of scene time end-to-end for interstellars
    // Inclinations > 90° encode retrograde orbits (Halley at 162°, etc.) —
    // we reverse the phase increment so the body actually marches backward
    // along the ellipse, not just on a tilted prograde plane.
    const direction = body.inclDeg > 90 ? -1 : 1
    const angularSpeed = direction * (2 * Math.PI) / period
    const phase = body.startPhase * Math.PI * 2
    // Date-driven anchor for periodic bodies: real period in days + a base
    // mean anomaly. Each frame we recompute config.phase from the sim date
    // so periodic comets are scrubbable and land in the same place every
    // time you revisit a date.
    //
    // When the body carries a real perihelion-passage date (perihelionTT),
    // mean anomaly is anchored to it: M = 0 exactly at perihelion, so
    // jumping the timeline to a known perihelion (Halley 2061) puts the
    // comet at perihelion for real. Bodies without that date fall back to
    // a fixed startPhase offset — period + direction are real, absolute
    // longitude is approximate.
    const periodDaysReal = isFinite(body.periodYears) ? body.periodYears * 365.25 : 0
    const perihelionMs = body.perihelionTT ? Date.parse(body.perihelionTT) : null
    const baseMeanAnomaly = phase
    // Orientation of the orbital plane in 3D — without these the orbit is
    // correctly tilted but oriented arbitrarily, so Voyager 1's escape
    // doesn't point toward Ophiuchus and Voyager 2's toward Telescopium.
    // Default 0 for bodies where the exact sky direction isn't called out.
    const longNode = (body.longNodeDeg ?? 0) * DEG
    const argPeri = (body.argPeriDeg ?? 0) * DEG

    // Default colours by kind. Comets: warm ice-blue (gas+dust coma).
    // Asteroids: dusty grey-brown. Interstellars: warm accent for the
    // two rare visitors we have. Spacecraft: cold silver-white so they
    // read as engineered hardware drifting through a sky of natural bodies.
    // Dwarf planets: warm earthy-pink — Eris and Sedna's actual surface
    // reflectance, plus differentiates them from main-belt asteroids.
    const defaultShade =
      body.kind === "comet"        ? "#9ed4ff" :
      body.kind === "asteroid"     ? "#b8a482" :
      body.kind === "spacecraft"   ? "#e8eef5" :
      body.kind === "dwarf"        ? "#d49a76" :
      /* interstellar */              "#ffd66b"
    const shade = body.shade ?? defaultShade

    // Tail flag — comets get coma + tail. Borisov was interstellar but
    // clearly a comet by appearance (visible coma + tail), so flag it too.
    const hasTail = body.kind === "comet" || body.name === "Comet Borisov"
    // Pre-parsed RGB for the motion-trail particle colour, in 0..1 range.
    const shadeRgb = (() => {
      const hex = shade.replace("#", "")
      return {
        r: parseInt(hex.slice(0, 2), 16) / 255,
        g: parseInt(hex.slice(2, 4), 16) / 255,
        b: parseInt(hex.slice(4, 6), 16) / 255,
      }
    })()
    // Famous "great comets" — visible to the naked eye, long iconic
    // tails. We stretch their tails ~50% longer than the routine periodic
    // comets so Hale-Bopp's signature plume actually reads at scene scale.
    // Hyakutake had the longest measured tail in history (570 Mkm); we
    // can't show that to scale without breaking the scene, but we lean
    // into it. Sungrazers (Ikeya-Seki) also get the boost — their tails
    // are spectacular because perihelion is so close.
    const GREAT_COMETS = new Set([
      "Comet Hale-Bopp",
      "Comet Hyakutake",
      "Comet NEOWISE",
      "Comet Tsuchinshan-ATLAS",
      "Comet Ikeya-Seki",
    ])
    const tailLengthFactor = GREAT_COMETS.has(body.name) ? 1.55 : 1.0
    // The anti-tail is a real visible feature for a few specific comets
    // (Arend-Roland 1957, Tsuchinshan-ATLAS 2024). Of the catalog, only
    // Tsuchinshan-ATLAS qualifies — its fact text already calls it out.
    const hasAntiTail = body.name === "Comet Tsuchinshan-ATLAS"
    return { a, e, inclination, longNode, argPeri, visualRadius, angularSpeed, phase, periodDaysReal, perihelionMs, baseMeanAnomaly, direction, shade, shadeRgb, isLoop: isFinite(body.periodYears), hasTail, tailLengthFactor, hasAntiTail }
  }, [body])
  const cometAffordance = useMemo(
    () =>
      getCometAffordance({
        kind: body.kind,
        name: body.name,
        visualRadius: config.visualRadius,
        isLoop: config.isLoop,
        invert,
      }),
    [body.kind, body.name, config.visualRadius, config.isLoop, invert],
  )
  const cometDynamic = useMemo(
    () => getCometDynamicProfile(body.name),
    [body.name],
  )

  // Initialise the motion-trail ring buffer for comets / interstellars /
  // dwarfs — bodies whose motion is the headline detail. Built lazily so
  // bodies without a trail (asteroids, spacecraft using custom shapes)
  // don't allocate.
  // Programmatic focus — the timeline "Moments" waypoints dispatch
  // universe:sky-focus with pointId "named:<name>" to frame a comet after
  // jumping to its perihelion. Mirrors the click handler's requestFollow so
  // the camera locks on and tracks the body as it sweeps perihelion.
  useEffect(() => {
    if (!interactive) return
    const onFocus = (e: Event) => {
      const id = (e as CustomEvent<{ pointId?: string }>).detail?.pointId
      if (id !== `named:${body.name}`) return
      requestFollow(
        () => {
          const g = groupRef.current
          if (!g) return null
          const v = new Vector3()
          g.getWorldPosition(v)
          return { x: v.x, y: v.y, z: v.z }
        },
        body.kind === "dwarf" ? 2.4 : 1.6,
        body.name,
      )
    }
    window.addEventListener("universe:sky-focus", onFocus)
    return () => window.removeEventListener("universe:sky-focus", onFocus)
  }, [interactive, body.name, body.kind])

  useEffect(() => {
    const wantsTrail = body.kind === "comet" || body.kind === "interstellar" || body.kind === "dwarf" || body.name === "Comet Borisov"
    if (!wantsTrail) return
    const MOTION_TRAIL_LEN = 48
    const positions = new Float32Array(MOTION_TRAIL_LEN * 3)
    const colors = new Float32Array(MOTION_TRAIL_LEN * 3)
    const ages = new Float32Array(MOTION_TRAIL_LEN)
    // Start fully aged so nothing renders before the first useFrame pushes
    // real positions into the buffer.
    for (let i = 0; i < MOTION_TRAIL_LEN; i++) ages[i] = 999
    const geometry = new BufferGeometry()
    geometry.setAttribute("position", new BufferAttribute(positions, 3))
    geometry.setAttribute("color", new BufferAttribute(colors, 3))
    motionTrailRef.current = { positions, colors, ages, geometry, nextIdx: 0 }
    return () => {
      geometry.dispose()
      motionTrailRef.current = null
    }
  }, [body.kind, body.name])

  // Pre-compute a thin trail of orbit positions so each body draws a
  // dotted ellipse behind it, hinting at the path. Uses the same full
  // orbital-element transform as the per-frame position below, so the
  // body always sits on its trail.
  //
  // Hyperbolic bodies (Voyagers, escape trajectories) get a STRAIGHT
  // outward line from the Sun instead of an ellipse — they don't loop
  // and the polar-form r blows up for e > 1.
  const trailGeometry = useMemo(() => {
    if (config.e >= 1) {
      // Straight outbound line from the Sun to ~1.2× the body's
      // current heliocentric distance along the escape direction.
      const STEPS = 24
      const positions = new Float32Array(STEPS * 3)
      const endPos = orbitalElementsToCartesian(
        config.a * 1.2, 0, 0, config.inclination, config.longNode, config.argPeri,
      )
      for (let i = 0; i < STEPS; i++) {
        const f = i / (STEPS - 1)
        positions[i * 3]     = endPos[0] * f
        positions[i * 3 + 1] = endPos[1] * f
        positions[i * 3 + 2] = endPos[2] * f
      }
      const geo = new BufferGeometry()
      geo.setAttribute("position", new BufferAttribute(positions, 3))
      return geo
    }
    const STEPS = 90
    const positions = new Float32Array(STEPS * 3)
    for (let i = 0; i < STEPS; i++) {
      const t = (i / STEPS) * Math.PI * 2
      const pos = orbitalElementsToCartesian(
        config.a, config.e, t, config.inclination, config.longNode, config.argPeri,
      )
      positions[i * 3]     = pos[0]
      positions[i * 3 + 1] = pos[1]
      positions[i * 3 + 2] = pos[2]
    }
    const geo = new BufferGeometry()
    geo.setAttribute("position", new BufferAttribute(positions, 3))
    return geo
  }, [config])

  // Shader uniforms for the comet's plume meshes — built once per
  // component instance so each comet animates independently. Per-frame
  // updates (uOpacity, uTime) mutate these in useFrame above.
  // Colours are tuned to real comet spectroscopy:
  //   - Ion tail: cyan/electric blue from CO+ and H2O+ fluorescence
  //   - Dust tail: warm cream/gold from sun-reflected silicates
  //   - Envelope: pale cyan, brighter than the surrounding coma
  //   - Jets: white-cyan to read against the green inner coma
  //   - Anti-tail: warm cream, matches dust-tail palette
  const ionTailUniforms = useMemo(() => ({
    uColorHead:    { value: new Color(invert ? "#1a4080" : "#bfe4ff") },
    uColorTail:    { value: new Color(invert ? "#3060a0" : "#5a8fd0") },
    uOpacity:      { value: 0 },
    uTime:         { value: 0 },
    uHalfHeight:   { value: config.visualRadius * 7.0 * config.tailLengthFactor },
    uKnotStrength: { value: 0.32 },
  }), [invert, config.visualRadius, config.tailLengthFactor])
  const dustTailUniforms = useMemo(() => ({
    uColorHead:    { value: new Color(invert ? "#7a4818" : "#ffd590") },
    uColorTail:    { value: new Color(invert ? "#a06840" : "#d8a865") },
    uOpacity:      { value: 0 },
    uTime:         { value: 0 },
    uHalfHeight:   { value: config.visualRadius * 8.0 * config.tailLengthFactor },
    uKnotStrength: { value: 0.0 },
  }), [invert, config.visualRadius, config.tailLengthFactor])
  const envelopeUniforms = useMemo(() => ({
    uColor:        { value: new Color(invert ? "#3a5a90" : "#cfeaff") },
    uOpacity:      { value: 0 },
  }), [invert])
  const jetUniforms = useMemo(() => ({
    uColorHead:    { value: new Color(invert ? "#3060a0" : "#e6f4ff") },
    uColorTail:    { value: new Color(invert ? "#5080b0" : "#88c4f0") },
    uOpacity:      { value: 0 },
    uTime:         { value: 0 },
    uHalfHeight:   { value: config.visualRadius * 0.85 },
    uKnotStrength: { value: 0.55 },
  }), [invert, config.visualRadius])
  const antiTailUniforms = useMemo(() => ({
    uColorHead:    { value: new Color(invert ? "#8a5828" : "#fff0c8") },
    uColorTail:    { value: new Color(invert ? "#a87848" : "#dcc090") },
    uOpacity:      { value: 0 },
    uTime:         { value: 0 },
    uHalfHeight:   { value: config.visualRadius * 1.4 },
    uKnotStrength: { value: 0.0 },
  }), [invert, config.visualRadius])

  useFrame((_, delta) => {
    const tw = timeWarpRef.current
    if (!groupRef.current) return

    // Periodic bodies derive phase straight from the simulation date so
    // they're scrubbable and deterministic; interstellars keep ping-ponging
    // off the accumulator since they don't loop and have no period.
    if (config.isLoop && config.periodDaysReal > 0) {
      if (config.perihelionMs != null) {
        // Real anchor: M = 0 at perihelion, growing with days since it.
        const daysSincePeri = (simTimeRef.current.simMs - config.perihelionMs) / 86_400_000
        config.phase = config.direction * 2 * Math.PI * daysSincePeri / config.periodDaysReal
      } else {
        // Approximate anchor off J2000 + a fixed offset.
        config.phase =
          config.baseMeanAnomaly +
          config.direction * 2 * Math.PI * daysSinceJ2000(simTimeRef.current.simMs) / config.periodDaysReal
      }
    } else {
      config.phase += delta * config.angularSpeed * tw
    }
    if (config.isLoop) {
      // keep within a sane range for the Kepler solver
      config.phase = config.phase % (Math.PI * 2)
    } else {
      // Interstellar — keep phase in [0, 2π] and reset position when it
      // wanders too far so the body re-enters the scene periodically.
      if (config.phase > Math.PI * 2) {
        config.phase = 0
      }
    }

    let px: number, py: number, pz: number
    if (config.e >= 1) {
      // Hyperbolic / escape trajectory (Voyagers, Pioneers, NH,
      // interstellars). The elliptical polar-form r = a(1-e²)/(1+e·cosθ)
      // produces negative or near-zero r for e > 1, which was placing
      // these bodies inside the Sun. Instead we pin them at their
      // current aAU heliocentric distance along the escape direction
      // (which is what Ω/ω/i are set up to orient toward). Motion
      // through the interstellar medium at 15–17 km/s is effectively
      // invisible at our scene scale anyway — visitors see their
      // current real-world position rather than a fake loop.
      ;[px, py, pz] = orbitalElementsToCartesian(
        config.a, 0, 0, config.inclination, config.longNode, config.argPeri,
      )
    } else {
      // Elliptical orbit — solve Kepler's equation so the body actually
      // obeys the 2nd law (sweeps equal areas in equal times, i.e. moves
      // fast at perihelion + slow at aphelion). Phase accumulates as
      // MEAN anomaly; we solve for true anomaly each frame.
      const M = config.phase
      const E = solveKepler(M, config.e)
      const trueAnom = eccentricToTrue(E, config.e)
      ;[px, py, pz] = orbitalElementsToCartesian(
        config.a, config.e, trueAnom, config.inclination, config.longNode, config.argPeri,
      )
    }
    groupRef.current.position.set(px, py, pz)

    // Comet tail orientation — the tail group's local +y axis is rotated
    // each frame to point away from the Sun (origin). Solar wind blows
    // gas + dust radially outward, so this matches real comet visuals
    // independent of the body's velocity direction.
    // Motion trail — push the current world-frame-equivalent position into
    // the ring buffer and age every existing particle. Per-vertex colour
    // is set so newer particles are bright (full shade) and older ones
    // fade to black. With additive blending, this reads as a glowing
    // streak following the body's recent path through space — orbital
    // motion becomes legible at any time-warp.
    const trail = motionTrailRef.current
    if (trail) {
      const idx = trail.nextIdx * 3
      trail.positions[idx]     = px
      trail.positions[idx + 1] = py
      trail.positions[idx + 2] = pz
      trail.ages[trail.nextIdx] = 0
      trail.nextIdx = (trail.nextIdx + 1) % trail.ages.length
      const TRAIL_LIFE = 2.4 // seconds (real time, ignores warp so user
                              // sees a consistent-length trail)
      const r = config.shadeRgb.r
      const g = config.shadeRgb.g
      const b = config.shadeRgb.b
      const dimMul = invert ? 0.7 : 1.0
      for (let i = 0; i < trail.ages.length; i++) {
        trail.ages[i] += delta
        const intensity = Math.max(0, 1 - trail.ages[i] / TRAIL_LIFE) * dimMul
        const ci = i * 3
        trail.colors[ci]     = r * intensity
        trail.colors[ci + 1] = g * intensity
        trail.colors[ci + 2] = b * intensity
      }
      trail.geometry.attributes.position.needsUpdate = true
      trail.geometry.attributes.color.needsUpdate = true
    }

    if (tailRef.current && config.hasTail) {
      const len = Math.sqrt(px * px + py * py + pz * pz) || 1
      cometPulseRef.current += delta
      const TAU = Math.PI * 2
      const comaPulse =
        1 +
        Math.sin(cometPulseRef.current * TAU * cometDynamic.comaPulseHz) * cometDynamic.comaPulseAmp +
        Math.sin(cometPulseRef.current * TAU * cometDynamic.comaPulseHz * 0.53 + 0.7) * cometDynamic.comaPulseAmp * 0.35
      const jetPulse =
        1 +
        Math.sin(cometPulseRef.current * TAU * cometDynamic.jetPulseHz + 0.9) * cometDynamic.jetPulseAmp
      _tailFrom.set(0, 1, 0)
      _tailTo.set(px / len, py / len, pz / len)
      tailRef.current.quaternion.setFromUnitVectors(_tailFrom, _tailTo)

      // Tail length + opacity track distance from the Sun — real comet
      // tails are blown bright + long when volatiles sublimate near the
      // Sun (under ~3 AU), then fade as the comet retreats to aphelion.
      // Linear ramp in scene-units: full tail inside 5u, fading to 0
      // by 18u. So Halley flares dramatically each time it swings inside
      // Mars's orbit, then trails off as it heads back to Pluto-distance.
      const t = Math.max(0, Math.min(1, (18 - len) / 13))
      const activityT = Math.max(0, Math.min(1, t * cometDynamic.activityMul))

      const comaBoost = (0.75 + activityT * 0.25) * Math.max(0.6, comaPulse)
      if (comaInnerMatRef.current) {
        const base = invert ? 0.55 : 0.55
        comaInnerMatRef.current.opacity = Math.max(0, Math.min(1, base * comaBoost))
      }
      if (comaMidMatRef.current) {
        const base = invert ? 0.45 : 0.42
        comaMidMatRef.current.opacity = Math.max(0, Math.min(1, base * comaBoost))
      }
      if (comaOuterMatRef.current) {
        const base = invert ? 0.22 : 0.16
        comaOuterMatRef.current.opacity = Math.max(0, Math.min(1, base * comaBoost))
      }

      // Ion tail — straight, electric-blue, points exactly anti-radial.
      if (tailMeshRef.current && tailMatRef.current) {
        const baseHalf = config.visualRadius * 7.0 * config.tailLengthFactor
        tailMeshRef.current.position.y = baseHalf * activityT
        tailMeshRef.current.scale.y = activityT
        const peakOpacity = invert ? 0.65 : 0.55
        tailMatRef.current.uniforms.uOpacity.value = activityT * peakOpacity * Math.max(0.68, jetPulse)
        tailMatRef.current.uniforms.uTime.value += delta
      }
      // Dust tail — broader, warm, slightly longer. Radiation pressure
      // pushes dust outward slower than the solar wind pushes ions, so
      // dust lags behind into a fan; the offset rotation in JSX captures
      // that curve. Smooth (no plasma knots).
      if (dustTailMeshRef.current && dustTailMatRef.current) {
        const baseHalf = config.visualRadius * 8.0 * config.tailLengthFactor
        dustTailMeshRef.current.position.y = baseHalf * activityT
        dustTailMeshRef.current.scale.y = activityT
        const peakOpacity = invert ? 0.55 : 0.48
        dustTailMatRef.current.uniforms.uOpacity.value = activityT * peakOpacity * Math.max(0.72, comaPulse)
      }
      // Sunward envelope — the bright dust hood pressed against the
      // Sun-facing side of an active comet. Same perihelion ramp; the
      // shader gradient handles the parabolic falloff toward the rim.
      if (envelopeMatRef.current) {
        const peakOpacity = invert ? 0.50 : 0.45
        envelopeMatRef.current.uniforms.uOpacity.value = activityT * peakOpacity * Math.max(0.74, comaPulse)
      }
      // Jet streamers — only really fire close to the Sun. Tighter ramp
      // than the tails (gone by 8u, full inside 3u). The group rotates
      // slowly so individual jets sweep into and out of view — the
      // signature pulsing you see in Rosetta's footage of 67P.
      if (jetsRef.current) {
        jetsRef.current.rotation.y += delta * 0.55
      }
      if (jetMatRef.current) {
        const jetT = Math.max(0, Math.min(1, (8 - len) / 5))
        const peakOpacity = invert ? 0.70 : 0.60
        jetMatRef.current.uniforms.uOpacity.value = jetT * peakOpacity * Math.max(0.66, jetPulse)
        jetMatRef.current.uniforms.uTime.value += delta * 2.2
      }
      // Anti-tail — short sunward spike, visible only inside ~4u and
      // only for the one comet (Tsuchinshan–ATLAS) that famously
      // showed it in 2024. Even tighter window than the jets.
      if (config.hasAntiTail && antiTailMeshRef.current && antiTailMatRef.current) {
        const atT = Math.max(0, Math.min(1, (4 - len) / 2))
        const peakOpacity = invert ? 0.55 : 0.45
        antiTailMatRef.current.uniforms.uOpacity.value = atT * peakOpacity
        antiTailMeshRef.current.scale.y = 0.3 + 0.7 * atT
      }
    }

    // Nucleus rotation — slow tumble on two axes so the irregular
    // facets read as a real spinning body. Independent of the perihelion
    // ramp (real nuclei rotate everywhere along the orbit, they just
    // aren't visible from Earth until the coma lights them up).
    if (nucleusRef.current) {
      nucleusRef.current.rotation.y += delta * 0.35
      nucleusRef.current.rotation.x += delta * 0.12
    }

    // Trail opacity lerps with hover state — addresses the no-collisions
    // rule for orbit paths. With ~20 named bodies all drawing static
    // trails (comets cross every inner-planet ring, asteroids cross each
    // other), the screen was a tangle. Hovered body brightens, others
    // stay at a faint baseline so crossings read as ghostly rather than
    // colliding.
    if (trailMatRef.current) {
      const target = isHovered ? cometAffordance.trailHover : cometAffordance.trailIdle
      const k = 1 - Math.exp(-delta * 8)
      trailMatRef.current.opacity += (target - trailMatRef.current.opacity) * k
    }
  })

  // Hit-zone radius — never smaller than 0.16 so even tiny bodies are
  // findable with a finger or cursor.
  const hitRadius = cometAffordance.hitRadius

  return (
    // Both the trail (anchored at the Sun) and the moving body live in the
    // same parent so they share the SolarSystem's coordinate frame.
    <group>
      {/* Orbit trail — thin dotted ellipse traced once at mount, never updated.
          Opacity is driven by the useFrame above so the hovered body's path
          brightens and the rest stay faint — keeps crossings (Halley over
          every inner-planet ring, asteroid trails over each other) from
          piling up into visual noise. */}
      <points geometry={trailGeometry}>
        <pointsMaterial
          ref={trailMatRef as React.Ref<import("three").PointsMaterial>}
          size={invert ? 0.024 : 0.020}
          sizeAttenuation
          color={invert ? "#1a1208" : config.shade}
          transparent
          opacity={cometAffordance.trailIdle}
          depthWrite={false}
        />
      </points>

      {/* Motion trail — fading particle streak following the body's recent
          actual movement (not the static orbit ellipse above). Per-vertex
          colours drive per-particle fade from full shade → black. Makes
          the body's orbital motion legible even when angular speed is
          slow (Halley moves ~0.4° per real second at 1× warp; the trail
          shows that motion as a visible streak). */}
      {motionTrailRef.current && (
        <points geometry={motionTrailRef.current.geometry}>
          <pointsMaterial
            size={invert ? 0.05 : 0.045}
            sizeAttenuation
            vertexColors
            transparent
            opacity={0.95}
            blending={invert ? NormalBlending : AdditiveBlending}
            depthWrite={false}
          />
        </points>
      )}

      {/* The body itself — moved each frame to its current orbit position.
          Spacecraft with a registered procedural shape (Voyager, JWST,
          Parker, New Horizons) render their actual silhouette instead of a
          generic sphere. Everything else (comets, asteroids, dwarf planets,
          interstellars) stays as the standard glowing sphere. */}
      <group ref={groupRef}>
        {body.kind === "spacecraft" && SPACECRAFT_SHAPES[body.name] ? (
          <group scale={config.visualRadius * SPACECRAFT_SHAPES[body.name].scale}>
            {SPACECRAFT_SHAPES[body.name].render({ invert })}
          </group>
        ) : config.hasTail ? (
          // Comet anatomy, built up in layers:
          //   1. Nucleus — dark, irregular, slowly rotating. Real cometary
          //      surfaces (Halley, 67P) are blacker than asphalt; we keep
          //      it faceted (icosahedron) so its silhouette feels like a
          //      lump of rock, not a polished ball.
          //   2. Inner coma — tight greenish glow (C2 / CN fluorescence).
          //   3. Mid coma — wider cyan halo (water photodissociation).
          //   4. Outer coma — faint diffuse envelope, fades into space.
          //   5. Sunward envelope — bright parabolic dust hood pressed
          //      against the sub-solar side by radiation pressure.
          //   6. Jets — 3 narrow plumes from active spots on the nucleus,
          //      rotating with it so they sweep into / out of view.
          //   7. Ion tail — straight, electric-blue, plasma knots, points
          //      directly anti-solar (solar wind blows it straight out).
          //   8. Dust tail — warm cream, broader, slightly longer, offset
          //      ~14° from the ion tail (radiation pressure pushes dust
          //      out slower than ions, so it curves orbit-trailing).
          //   9. Anti-tail — for Tsuchinshan–ATLAS only — short sunward
          //      spike, fades in near perihelion.
          <>
            {/* 1. Nucleus — irregular, dark, tumbling. */}
            <mesh ref={nucleusRef}>
              <icosahedronGeometry args={[config.visualRadius * 0.42, 0]} />
              <meshBasicMaterial color={invert ? "#0a0a14" : "#6a6258"} />
            </mesh>

            {/* 2. Inner coma — C2/CN green close to the nucleus.
                Real Halley and Hale-Bopp comae show this clearly through
                a small telescope: a green core fading to cyan further out. */}
            <mesh>
              <sphereGeometry args={[config.visualRadius * 0.85, 18, 14]} />
              <meshBasicMaterial
                ref={comaInnerMatRef as React.Ref<import("three").MeshBasicMaterial>}
                color={invert ? "#4d8478" : "#b8ffd4"}
                transparent
                opacity={invert ? 0.55 : 0.55}
                blending={invert ? NormalBlending : AdditiveBlending}
                depthWrite={false}
              />
            </mesh>

            {/* 3. Mid coma — cyan halo, the layer the eye reads as "the comet". */}
            <mesh>
              <sphereGeometry args={[config.visualRadius * 1.55, 20, 16]} />
              <meshBasicMaterial
                ref={comaMidMatRef as React.Ref<import("three").MeshBasicMaterial>}
                color={config.shade}
                transparent
                opacity={invert ? 0.45 : 0.42}
                blending={invert ? NormalBlending : AdditiveBlending}
                depthWrite={false}
              />
            </mesh>

            {/* 4. Outer coma — very faint diffuse glow, fades into space.
                Suggests the immense hydrogen envelope without making
                the comet look bloated. */}
            <mesh>
              <sphereGeometry args={[config.visualRadius * 2.5, 20, 16]} />
              <meshBasicMaterial
                ref={comaOuterMatRef as React.Ref<import("three").MeshBasicMaterial>}
                color={config.shade}
                transparent
                opacity={invert ? 0.22 : 0.16}
                blending={invert ? NormalBlending : AdditiveBlending}
                depthWrite={false}
              />
            </mesh>

            {/* 5–9 all live inside tailRef so they share the
                "y-axis points anti-solar" orientation set per-frame. */}
            <group ref={tailRef}>
              {/* 5. Sunward envelope — bright dust hood on the Sun-facing
                  side. Half-sphere at the -y pole (sunward); shader makes
                  the apex brightest, fading to the rim. */}
              <mesh>
                <sphereGeometry args={[
                  config.visualRadius * 1.4,
                  20, 12,
                  0, Math.PI * 2,
                  Math.PI * 0.42, Math.PI * 0.58,
                ]} />
                <shaderMaterial
                  ref={envelopeMatRef}
                  vertexShader={COMET_ENVELOPE_VERTEX_SHADER}
                  fragmentShader={COMET_ENVELOPE_FRAGMENT_SHADER}
                  uniforms={envelopeUniforms}
                  transparent
                  blending={invert ? NormalBlending : AdditiveBlending}
                  depthWrite={false}
                  side={DoubleSide}
                />
              </mesh>

              {/* 6. Jets — three thin plumes biased toward the sunward
                  hemisphere. Rotate slowly via jetsRef so each jet
                  swings in and out of view, faking the rotation of the
                  underlying nucleus (the signature pulsing in Rosetta
                  footage of 67P's coma). All three share one shader
                  material so the per-frame uniform update is cheap. */}
              <group ref={jetsRef}>
                {[
                  { tiltX: Math.PI - 0.15, tiltZ:  0.0,  yaw: 0.0 },
                  { tiltX: Math.PI - 0.30, tiltZ:  0.55, yaw: 2.1 },
                  { tiltX: Math.PI - 0.12, tiltZ: -0.45, yaw: 4.0 },
                ].map((j, i) => (
                  <mesh
                    key={i}
                    rotation={[j.tiltX, j.yaw, j.tiltZ]}
                  >
                    <coneGeometry args={[
                      config.visualRadius * 0.10,
                      config.visualRadius * 1.7,
                      10, 1, true,
                    ]} />
                    <shaderMaterial
                      ref={i === 0 ? jetMatRef : undefined}
                      vertexShader={COMET_TAIL_VERTEX_SHADER}
                      fragmentShader={COMET_TAIL_FRAGMENT_SHADER}
                      uniforms={jetUniforms}
                      transparent
                      blending={invert ? NormalBlending : AdditiveBlending}
                      depthWrite={false}
                      side={DoubleSide}
                    />
                  </mesh>
                ))}
              </group>

              {/* 7. Ion tail — straight, anti-radial. Knotted plasma
                  flicker driven by the shader's uTime + uKnotStrength. */}
              <mesh
                ref={tailMeshRef}
                position={[0, config.visualRadius * 7.0 * config.tailLengthFactor, 0]}
              >
                <coneGeometry args={[
                  config.visualRadius * 0.55,
                  config.visualRadius * 14 * config.tailLengthFactor,
                  16, 1, true,
                ]} />
                <shaderMaterial
                  ref={tailMatRef}
                  vertexShader={COMET_TAIL_VERTEX_SHADER}
                  fragmentShader={COMET_TAIL_FRAGMENT_SHADER}
                  uniforms={ionTailUniforms}
                  transparent
                  blending={invert ? NormalBlending : AdditiveBlending}
                  depthWrite={false}
                  side={DoubleSide}
                />
              </mesh>

              {/* 8. Dust tail — broader, warmer, slightly longer; offset
                  14° around local z so it visibly splays from the ion
                  tail. Smooth (no plasma knots). */}
              <mesh
                ref={dustTailMeshRef}
                position={[0, config.visualRadius * 8.0 * config.tailLengthFactor, 0]}
                rotation={[0, 0, 0.24]}
              >
                <coneGeometry args={[
                  config.visualRadius * 0.95,
                  config.visualRadius * 16 * config.tailLengthFactor,
                  16, 1, true,
                ]} />
                <shaderMaterial
                  ref={dustTailMatRef}
                  vertexShader={COMET_TAIL_VERTEX_SHADER}
                  fragmentShader={COMET_TAIL_FRAGMENT_SHADER}
                  uniforms={dustTailUniforms}
                  transparent
                  blending={invert ? NormalBlending : AdditiveBlending}
                  depthWrite={false}
                  side={DoubleSide}
                />
              </mesh>

              {/* 9. Anti-tail — only built for the one comet that famously
                  showed one. Points sunward (rotation flips the cone so
                  apex is at -y). Fades in tightly around perihelion. */}
              {config.hasAntiTail && (
                <mesh
                  ref={antiTailMeshRef}
                  position={[0, -config.visualRadius * 1.4, 0]}
                  rotation={[Math.PI, 0, 0]}
                >
                  <coneGeometry args={[
                    config.visualRadius * 0.30,
                    config.visualRadius * 2.8,
                    12, 1, true,
                  ]} />
                  <shaderMaterial
                    ref={antiTailMatRef}
                    vertexShader={COMET_TAIL_VERTEX_SHADER}
                    fragmentShader={COMET_TAIL_FRAGMENT_SHADER}
                    uniforms={antiTailUniforms}
                    transparent
                    blending={invert ? NormalBlending : AdditiveBlending}
                    depthWrite={false}
                    side={DoubleSide}
                  />
                </mesh>
              )}
            </group>
          </>
        ) : (
          <mesh>
            <sphereGeometry args={[config.visualRadius, 16, 16]} />
            <meshStandardMaterial
              color={config.shade}
              emissive={config.shade}
              emissiveIntensity={invert ? 0.0 : 0.6}
              roughness={0.7}
            />
          </mesh>
        )}
        <mesh
          onPointerOver={(e) => {
            e.stopPropagation()
            setIsHovered(true)
            onHover({
              name: body.name,
              classification:
                body.kind === "comet"        ? `Comet · ${body.designation}` :
                body.kind === "asteroid"     ? `Asteroid · ${body.designation}` :
                body.kind === "spacecraft"   ? `Spacecraft · ${body.designation}` :
                body.kind === "dwarf"        ? `Dwarf planet · ${body.designation}` :
                /* interstellar */              `Interstellar · ${body.designation}`,
              aAU: body.aAU,
              periodDays: isFinite(body.periodYears) ? body.periodYears * 365.25 : undefined,
              fact: body.fact,
              deep: body.deep,
              followable: interactive,
                gravityMeasurement:
                  body.kind === "comet" || body.kind === "asteroid"
                    ? {
                        label: "Gravity",
                        note: "Microgravity body; no catalogued surface gravity value",
                      }
                    : undefined,
              orbital: {
                eccentricity: body.eccentricity,
                inclDeg: body.inclDeg,
                longNodeDeg: body.longNodeDeg,
                argPeriDeg: body.argPeriDeg,
                elementsEpoch: body.elementsEpoch,
              },
            })
          }}
          onPointerOut={() => {
            setIsHovered(false)
            onHover(null)
          }}
          // Single click engages follow mode — the camera locks onto this
          // body and tracks it as it sweeps its orbit. A plain fly-to would
          // leave fast movers (comets at perihelion, the ISS, interstellar
          // visitors) drifting out of frame, so follow is the default for
          // every named body. Double-click is wired to the same handler as
          // a discoverability fallback for users who instinctively
          // double-click a moving target.
          onClick={
            interactive
              ? (e) => {
                  e.stopPropagation()
                  // The getter captures groupRef.current — read fresh each
                  // frame so we always see the body's current orbital phase.
                  requestFollow(
                    () => {
                      const g = groupRef.current
                      if (!g) return null
                      const v = new Vector3()
                      g.getWorldPosition(v)
                      return { x: v.x, y: v.y, z: v.z }
                    },
                    body.kind === "dwarf" ? 2.4 : 1.6,
                    body.name,
                  )
                }
              : undefined
          }
          onDoubleClick={
            interactive
              ? (e) => {
                  e.stopPropagation()
                  requestFollow(
                    () => {
                      const g = groupRef.current
                      if (!g) return null
                      const v = new Vector3()
                      g.getWorldPosition(v)
                      return { x: v.x, y: v.y, z: v.z }
                    },
                    body.kind === "dwarf" ? 2.4 : 1.6,
                    body.name,
                  )
                }
              : undefined
          }
        >
          <sphereGeometry args={[hitRadius, 12, 12]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        {/* Hover label — matches the planet hover-label pattern so comets,
            asteroids, spacecraft, and dwarfs all get the same floating-name
            affordance. Desktop only; mobile uses the bottom sheet. */}
        {isHovered && (
          <Html
            position={[0, cometAffordance.labelOffset, 0]}
            center
            distanceFactor={8}
            zIndexRange={[10, 0]}
            style={{ pointerEvents: "none" }}
          >
            <div
              className={`
                whitespace-nowrap select-none pointer-events-none
                font-mono text-[10px] tracking-[0.3em] uppercase
                px-2 py-1 rounded-full backdrop-blur-sm
                ${
                  invert
                    ? "bg-white/85 border border-foreground/25 text-foreground"
                    : "bg-black/55 border border-white/20 text-white"
                }
              `}
              style={{ animation: "ue-label-in 220ms ease-out both" }}
            >
              {body.name}
            </div>
          </Html>
        )}
      </group>
    </group>
  )
}

function NamedBodies({
  onHover,
  invert = false,
  interactive = false,
}: {
  onHover: HoverHandler
  invert?: boolean
  interactive?: boolean
}) {
  return (
    <group>
      {namedBodies.map((body) => (
        <NamedBodyMesh
          key={body.designation}
          body={body}
          onHover={onHover}
          invert={invert}
          interactive={interactive}
        />
      ))}
    </group>
  )
}

/* ============================================================
 * Sky points — far-field galaxies, nebulae, clusters, exoplanet hosts
 *
 * Catalog lives in astronomy.ts as `skyPoints`. Each entry has J2000
 * RA/Dec and projects onto the same sky-shell that constellations use.
 *
 * Rendering per kind:
 *   galaxy   — diffuse warm halo at the projected position
 *   nebula   — diffuse cool halo with a brighter core
 *   cluster  — small tight clump of bright points
 *   host     — single accent dot with a "host star" hint on hover
 *
 * All four kinds share the same hover-info pipeline so the cursor
 * label + InfoPanel + mobile sheet all light up the same way.
 * ============================================================ */

/**
 * GalaxyDetail
 *
 * Mounted under a galaxy sky-point. The idle visual is the regular warm
 * halo (handled by the parent). On hover/focus, a tilted spiral disc with
 * a bright central bulge fades in, along with companion galaxies where
 * known (M32 + M110 for Andromeda). Currently only Andromeda gets the
 * full treatment — Triangulum/LMC/SMC keep the existing halo.
 *
 * The arm point cloud is built once at mount with a small particle count
 * (~1500), so even multiple galaxies in view don't dominate the GPU.
 * Scale lerps from 0 → 1 on hover so the structure blooms in rather
 * than appearing all at once.
 */
function GalaxyDetail({
  pointId,
  size,
  hovered,
  invert,
}: {
  pointId: string
  size: number
  hovered: boolean
  invert: boolean
}) {
  const rootRef = useRef<Group>(null)
  const spinRef = useRef<Group>(null)
  const armsMatRef = useRef<import("three").PointsMaterial>(null)
  const haloMatRef = useRef<import("three").PointsMaterial>(null)
  const barMatRef = useRef<import("three").PointsMaterial>(null)
  const bulgeMatRef = useRef<import("three").MeshBasicMaterial>(null)
  const dustMatRef = useRef<import("three").MeshBasicMaterial>(null)
  const irregularMatRef = useRef<import("three").PointsMaterial>(null)
  const irregularHaloMatRef = useRef<import("three").PointsMaterial>(null)
  const irregularBulgeMatRef = useRef<import("three").MeshBasicMaterial>(null)
  const companionMatRefs = useRef<Array<import("three").MeshBasicMaterial | null>>([])

  // The headline galaxies get the full procedural spiral / irregular model;
  // everything else keeps the cheap diffuse halo. The spiral path covers the
  // famous grand-design spirals (Andromeda, Triangulum, Whirlpool, Sombrero,
  // Pinwheel, Bode's, Cigar); the irregular path covers the Magellanic Clouds.
  const isAndromeda = pointId === "m31"
  const isTriangulum = pointId === "m33"
  const isLmc = pointId === "lmc"
  const isSmc = pointId === "smc"
  // Additional famous spirals — rendered with the same spiral model as M33.
  const SPIRAL_GALAXY_IDS = new Set(["m51", "m104", "m101", "m81", "m82"])
  const isExtraSpiral = SPIRAL_GALAXY_IDS.has(pointId)
  // Spiral-model galaxies reuse the Triangulum render path. Folding the extra
  // spirals in here means the geometry builders + tilt logic that key off
  // "Triangulum" fire for them too, without duplicating the model.
  const useSpiralModel = isTriangulum || isExtraSpiral
  const isDetailedGalaxy = isAndromeda || isTriangulum || isLmc || isSmc || isExtraSpiral

  // Andromeda procedural model — built to the structural spec:
  //   - 30% of stars in a dense central bulge, exponential radial decay,
  //     warm yellow-orange-white colour (older stars)
  //   - 70% in two logarithmic spiral arms (r = a · e^(bθ), b = 0.26 to
  //     match Andromeda's tight winding)
  //   - 15% of arm stars are pink H II regions (star-forming clouds)
  //   - The rest are blue/white young main-sequence stars
  // Geometry is normalized to roughly [-1, 1] so the parent scale lerp
  // controls absolute scene-size. Per-vertex colour attribute drives
  // the pointsMaterial via vertexColors.
  const armsGeometry = useMemo(() => {
    const numStars = 9000
    const numBulge = Math.floor(numStars * 0.30)
    const numArms = numStars - numBulge
    const positions = new Float32Array(numStars * 3)
    const colors = new Float32Array(numStars * 3)

    // Bulge — dense exponential cluster around the centre, slightly puffy.
    for (let i = 0; i < numBulge; i++) {
      const r = -Math.log(Math.max(1e-4, Math.random())) * 0.18
      const theta = Math.random() * Math.PI * 2
      const z = (Math.random() - 0.5) * 0.12 * Math.exp(-r * 1.5)
      const i3 = i * 3
      positions[i3]     = r * Math.cos(theta)
      positions[i3 + 1] = z
      positions[i3 + 2] = r * Math.sin(theta)
      // Yellow / orange / white — older stellar population
      colors[i3]     = 0.92 + Math.random() * 0.08
      colors[i3 + 1] = 0.80 + Math.random() * 0.12
      colors[i3 + 2] = 0.58 + Math.random() * 0.14
    }

    // Spiral arms — two logarithmic arms with realistic dispersion.
    const a = 0.06          // anchor radius
    const b = 0.26          // arm tightness — matches Andromeda's spec
    const armOffsets = [0, Math.PI]
    for (let i = numBulge; i < numStars; i++) {
      const r = 0.16 + Math.pow(Math.random(), 0.7) * 0.95
      const armChoice = armOffsets[i % 2]
      let theta = Math.log(r / a) / b + armChoice
      const dispersion = (Math.random() - 0.5) * (0.40 / (r + 0.1))
      theta += dispersion
      const warp = Math.sin(theta * 1.35) * (0.018 + r * 0.05)
      const z = (Math.random() - 0.5) * 0.04 + warp
      const i3 = i * 3
      positions[i3]     = r * Math.cos(theta)
      positions[i3 + 1] = z
      positions[i3 + 2] = r * Math.sin(theta)
      // 15% pink H II star-forming regions, 85% blue-white young stars.
      if (Math.random() < 0.15) {
        colors[i3]     = 0.92 + Math.random() * 0.08
        colors[i3 + 1] = 0.52 + Math.random() * 0.10
        colors[i3 + 2] = 0.72 + Math.random() * 0.10
      } else {
        colors[i3]     = 0.62 + Math.random() * 0.18
        colors[i3 + 1] = 0.72 + Math.random() * 0.18
        colors[i3 + 2] = 0.92 + Math.random() * 0.08
      }
    }

    const geo = new BufferGeometry()
    geo.setAttribute("position", new BufferAttribute(positions, 3))
    geo.setAttribute("color", new BufferAttribute(colors, 3))
    return geo
  }, [])

  // Faint stellar halo — loose, old stars spread far beyond the bright disc.
  // This is what makes Andromeda feel like a real galaxy instead of a flat icon.
  const haloGeometry = useMemo(() => {
    const numStars = 2200
    const positions = new Float32Array(numStars * 3)
    const colors = new Float32Array(numStars * 3)
    for (let i = 0; i < numStars; i++) {
      const radius = Math.pow(Math.random(), 0.28) * 1.25
      const theta = Math.random() * Math.PI * 2
      const thickness = (Math.random() - 0.5) * 0.28 * (1 - radius * 0.45)
      const haloBias = 0.45 + Math.random() * 0.15
      const i3 = i * 3
      positions[i3] = radius * Math.cos(theta)
      positions[i3 + 1] = thickness
      positions[i3 + 2] = radius * Math.sin(theta)
      colors[i3] = 0.78 + Math.random() * 0.10
      colors[i3 + 1] = 0.80 + Math.random() * 0.08
      colors[i3 + 2] = haloBias
    }
    const geo = new BufferGeometry()
    geo.setAttribute("position", new BufferAttribute(positions, 3))
    geo.setAttribute("color", new BufferAttribute(colors, 3))
    return geo
  }, [])

  // Inner bar / nuclear region — Andromeda's center is not a perfect
  // sphere. A subtle elongated stellar bar helps the real structure read.
  const barGeometry = useMemo(() => {
    const numStars = 2600
    const positions = new Float32Array(numStars * 3)
    const colors = new Float32Array(numStars * 3)
    for (let i = 0; i < numStars; i++) {
      const along = (Math.random() - 0.5) * 0.85
      const cross = (Math.random() - 0.5) * 0.12 * (1 - Math.abs(along) * 0.8)
      const vertical = (Math.random() - 0.5) * 0.06 * Math.exp(-Math.abs(along) * 1.4)
      const i3 = i * 3
      positions[i3] = along
      positions[i3 + 1] = vertical
      positions[i3 + 2] = cross
      colors[i3] = 0.92 + Math.random() * 0.06
      colors[i3 + 1] = 0.78 + Math.random() * 0.10
      colors[i3 + 2] = 0.56 + Math.random() * 0.10
    }
    const geo = new BufferGeometry()
    geo.setAttribute("position", new BufferAttribute(positions, 3))
    geo.setAttribute("color", new BufferAttribute(colors, 3))
    return geo
  }, [])

  // Non-Andromeda galaxy detail: Triangulum gets a looser flocculent spiral,
  // while LMC/SMC are rendered as irregular clumpy dwarfs.
  const irregularGeometry = useMemo(() => {
    if (!useSpiralModel && !isLmc && !isSmc) return null
    const numStars = useSpiralModel ? 7000 : isLmc ? 6200 : 5000
    const positions = new Float32Array(numStars * 3)
    const colors = new Float32Array(numStars * 3)

    for (let i = 0; i < numStars; i++) {
      const i3 = i * 3

      if (useSpiralModel) {
        const armOffsets = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3]
        const a = 0.08
        const b = 0.18
        const r = 0.12 + Math.pow(Math.random(), 0.58) * 1.02
        const armChoice = armOffsets[i % armOffsets.length]
        let theta = Math.log(r / a) / b + armChoice
        theta += (Math.random() - 0.5) * (0.72 / (r + 0.2))
        const z = (Math.random() - 0.5) * 0.06 + Math.sin(theta * 0.8) * (0.012 + r * 0.035)
        positions[i3] = r * Math.cos(theta)
        positions[i3 + 1] = z
        positions[i3 + 2] = r * Math.sin(theta)
      } else if (isLmc) {
        const t = Math.random()
        if (t < 0.44) {
          const along = (Math.random() - 0.5) * 1.2
          const cross = (Math.random() - 0.5) * 0.18 * (1 - Math.min(1, Math.abs(along) * 0.7))
          positions[i3] = along
          positions[i3 + 1] = (Math.random() - 0.5) * 0.08
          positions[i3 + 2] = cross + along * 0.08
        } else if (t < 0.78) {
          const theta = Math.random() * Math.PI * 1.4 - Math.PI * 0.2
          const r = 0.24 + Math.pow(Math.random(), 0.6) * 0.9
          positions[i3] = r * Math.cos(theta) * 0.95 - 0.15
          positions[i3 + 1] = (Math.random() - 0.5) * 0.10 + Math.sin(theta * 2.2) * 0.03
          positions[i3 + 2] = r * Math.sin(theta) * 0.7 + 0.08
        } else {
          const clump = Math.random() < 0.5 ? [-0.42, 0.0, 0.32] : [0.35, 0.0, -0.28]
          positions[i3] = clump[0] + (Math.random() - 0.5) * 0.18
          positions[i3 + 1] = clump[1] + (Math.random() - 0.5) * 0.10
          positions[i3 + 2] = clump[2] + (Math.random() - 0.5) * 0.16
        }
      } else {
        const core = Math.random() < 0.62 ? [0.12, 0.0, 0.08] : [-0.38, 0.02, -0.24]
        const bridgePull = Math.random()
        positions[i3] = core[0] + (Math.random() - 0.5) * 0.34 + bridgePull * 0.18
        positions[i3 + 1] = core[1] + (Math.random() - 0.5) * 0.11
        positions[i3 + 2] = core[2] + (Math.random() - 0.5) * 0.30 - bridgePull * 0.12
      }

      if (Math.random() < (useSpiralModel ? 0.24 : isLmc ? 0.28 : 0.22)) {
        colors[i3] = 0.96
        colors[i3 + 1] = 0.56 + Math.random() * 0.12
        colors[i3 + 2] = 0.76 + Math.random() * 0.12
      } else {
        colors[i3] = 0.68 + Math.random() * 0.18
        colors[i3 + 1] = 0.76 + Math.random() * 0.16
        colors[i3 + 2] = 0.92 + Math.random() * 0.08
      }
    }

    const geo = new BufferGeometry()
    geo.setAttribute("position", new BufferAttribute(positions, 3))
    geo.setAttribute("color", new BufferAttribute(colors, 3))
    return geo
  }, [useSpiralModel, isLmc, isSmc])

  const irregularHaloGeometry = useMemo(() => {
    if (!useSpiralModel && !isLmc && !isSmc) return null
    const numStars = useSpiralModel ? 1600 : isLmc ? 1300 : 1100
    const positions = new Float32Array(numStars * 3)
    const colors = new Float32Array(numStars * 3)
    const eccentricity = useSpiralModel ? 0.92 : isLmc ? 0.84 : 0.78
    for (let i = 0; i < numStars; i++) {
      const radius = Math.pow(Math.random(), 0.26) * (isSmc ? 1.0 : 1.2)
      const theta = Math.random() * Math.PI * 2
      const i3 = i * 3
      positions[i3] = radius * Math.cos(theta)
      positions[i3 + 1] = (Math.random() - 0.5) * 0.24 * (1 - radius * 0.4)
      positions[i3 + 2] = radius * Math.sin(theta) * eccentricity
      colors[i3] = 0.78 + Math.random() * 0.10
      colors[i3 + 1] = 0.80 + Math.random() * 0.08
      colors[i3 + 2] = 0.45 + Math.random() * 0.15
    }
    const geo = new BufferGeometry()
    geo.setAttribute("position", new BufferAttribute(positions, 3))
    geo.setAttribute("color", new BufferAttribute(colors, 3))
    return geo
  }, [useSpiralModel, isLmc, isSmc])

  // Companion galaxy positions (Andromeda only — M32 + M110).
  // M32 sits south of the disc, M110 north-west; both are dwarf ellipticals.
  const companions = useMemo(
    () =>
      isAndromeda
        ? [
            { offset: [0.55, -0.65, 0.05] as [number, number, number], radius: 0.08 },
            { offset: [-0.75, 0.50, -0.10] as [number, number, number], radius: 0.13 },
          ]
        : [],
    [isAndromeda],
  )

  useFrame((_, delta) => {
    const k = 1 - Math.exp(-delta * 6)
    // Whole-group scale lerp — bloom in from 0
    if (rootRef.current) {
      const target = hovered ? 1.0 : 0.001
      const s = rootRef.current.scale.x
      const next = s + (target - s) * k
      rootRef.current.scale.set(next, next, next)
    }
    // Slow rotation around the disc normal while hovered, like the real
    // galaxy rotating in place. Subtle so it doesn't feel like a spinner.
    if (spinRef.current && hovered) {
      spinRef.current.rotation.y += delta * 0.02
    }

    const armTarget = hovered ? (invert ? 0.45 : 0.55) : 0
    if (armsMatRef.current) {
      armsMatRef.current.opacity += (armTarget - armsMatRef.current.opacity) * k
    }
    const haloTarget = hovered ? (invert ? 0.18 : 0.24) : 0
    if (haloMatRef.current) {
      haloMatRef.current.opacity += (haloTarget - haloMatRef.current.opacity) * k
    }
    const barTarget = hovered ? (invert ? 0.38 : 0.46) : 0
    if (barMatRef.current) {
      barMatRef.current.opacity += (barTarget - barMatRef.current.opacity) * k
    }
    const bulgeTarget = hovered ? (invert ? 0.55 : 0.75) : 0
    if (bulgeMatRef.current) {
      bulgeMatRef.current.opacity += (bulgeTarget - bulgeMatRef.current.opacity) * k
    }
    const dustTarget = isAndromeda && hovered ? (invert ? 0.5 : 0.55) : 0
    if (dustMatRef.current) {
      dustMatRef.current.opacity += (dustTarget - dustMatRef.current.opacity) * k
    }
    const irregularTarget = hovered ? (invert ? 0.42 : 0.55) : 0
    if (irregularMatRef.current) {
      irregularMatRef.current.opacity += (irregularTarget - irregularMatRef.current.opacity) * k
    }
    const irregularHaloTarget = hovered ? (invert ? 0.14 : 0.22) : 0
    if (irregularHaloMatRef.current) {
      irregularHaloMatRef.current.opacity += (irregularHaloTarget - irregularHaloMatRef.current.opacity) * k
    }
    const irregularBulgeTarget = hovered ? (invert ? 0.45 : 0.62) : 0
    if (irregularBulgeMatRef.current) {
      irregularBulgeMatRef.current.opacity += (irregularBulgeTarget - irregularBulgeMatRef.current.opacity) * k
    }
    const companionTarget = hovered ? (invert ? 0.4 : 0.55) : 0
    companionMatRefs.current.forEach((m) => {
      if (!m) return
      m.opacity += (companionTarget - m.opacity) * k
    })
  })

  if (!isDetailedGalaxy) return null

  // Per-galaxy projection. The extra famous spirals (Whirlpool/Sombrero/…)
  // reuse a Triangulum-like tilt; Sombrero is shown near edge-on (its signature
  // look), the rest closer to face-on so the arms read.
  const tiltDeg = isAndromeda ? 77 : pointId === "m104" ? 80 : useSpiralModel ? 48 : isLmc ? 35 : 20
  const positionAngleDeg = isAndromeda ? 38 : useSpiralModel ? 22 : isLmc ? 170 : 45
  const detailScale = size * (isAndromeda ? 2.4 : useSpiralModel ? 2.2 : isLmc ? 2.0 : 1.9)
  const galaxyTilt = tiltDeg * DEG
  const galaxyAngle = positionAngleDeg * DEG

  // Tight central bulge core — kept as a soft warm glow because the
  // dense inner region in a real galaxy is too star-packed to resolve
  // into individual points. The star-cloud bulge baked into the
  // geometry handles the outer-bulge population.
  const bulgeColor = invert ? "#5a3416" : "#ffd9b0"
  const haloColor = invert ? "#8b7358" : "#dce7ff"
  const barColor = invert ? "#6c4524" : "#ffe2bf"
  const dustColor = invert ? "#0a0a0a" : "#1a0a04"
  const companionColor = invert ? "#3a1d12" : "#ffd9c2"

  return (
    <group ref={rootRef} scale={0.001}>
      {/* Position angle — rotates the apparent major-axis on the sky
          plane (≈38° east of north for Andromeda). Wraps the inclination
          + spin so the spiral's projection lands at the right angle. */}
      <group rotation={[0, 0, galaxyAngle]}>
        {/* Disc inclination — tilts the disc plane 77° from face-on so
            the spiral reads as a near-edge-on ellipse. */}
        <group rotation={[galaxyTilt, 0, 0]}>
          <group ref={spinRef}>
            {isAndromeda ? (
              <>
                <points geometry={haloGeometry} scale={detailScale * 1.14}>
                  <pointsMaterial
                    ref={haloMatRef as React.Ref<import("three").PointsMaterial>}
                    size={detailScale * 0.018}
                    sizeAttenuation
                    vertexColors
                    color={haloColor}
                    transparent
                    opacity={0}
                    blending={invert ? NormalBlending : AdditiveBlending}
                    depthWrite={false}
                  />
                </points>

                <points geometry={barGeometry} scale={detailScale * 0.72} rotation={[0, 0, Math.PI / 8]}>
                  <pointsMaterial
                    ref={barMatRef as React.Ref<import("three").PointsMaterial>}
                    size={detailScale * 0.032}
                    sizeAttenuation
                    vertexColors
                    color={barColor}
                    transparent
                    opacity={0}
                    blending={invert ? NormalBlending : AdditiveBlending}
                    depthWrite={false}
                  />
                </points>

                <points geometry={armsGeometry} scale={detailScale}>
                  <pointsMaterial
                    ref={armsMatRef as React.Ref<import("three").PointsMaterial>}
                    size={detailScale * 0.045}
                    sizeAttenuation
                    vertexColors
                    color={"#ffffff"}
                    transparent
                    opacity={0}
                    blending={invert ? NormalBlending : AdditiveBlending}
                    depthWrite={false}
                  />
                </points>

                <mesh>
                  <sphereGeometry args={[detailScale * 0.14, 20, 20]} />
                  <meshBasicMaterial
                    ref={bulgeMatRef as React.Ref<import("three").MeshBasicMaterial>}
                    color={bulgeColor}
                    transparent
                    opacity={0}
                    blending={invert ? NormalBlending : AdditiveBlending}
                    depthWrite={false}
                  />
                </mesh>

                <mesh rotation={[Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[detailScale * 0.45, detailScale * 0.58, 64]} />
                  <meshBasicMaterial
                    ref={dustMatRef as React.Ref<import("three").MeshBasicMaterial>}
                    color={dustColor}
                    transparent
                    opacity={0}
                    side={DoubleSide}
                    depthWrite={false}
                  />
                </mesh>
              </>
            ) : (
              <>
                {irregularHaloGeometry && (
                  <points geometry={irregularHaloGeometry} scale={detailScale * (isSmc ? 1.04 : 1.10)}>
                    <pointsMaterial
                      ref={irregularHaloMatRef as React.Ref<import("three").PointsMaterial>}
                      size={detailScale * 0.020}
                      sizeAttenuation
                      vertexColors
                      color={isTriangulum ? (invert ? "#6c6a64" : "#d5e4ff") : (invert ? "#61584f" : "#dce1f2")}
                      transparent
                      opacity={0}
                      blending={invert ? NormalBlending : AdditiveBlending}
                      depthWrite={false}
                    />
                  </points>
                )}

                {irregularGeometry && (
                  <points geometry={irregularGeometry} scale={detailScale}>
                    <pointsMaterial
                      ref={irregularMatRef as React.Ref<import("three").PointsMaterial>}
                      size={detailScale * (isSmc ? 0.05 : 0.045)}
                      sizeAttenuation
                      vertexColors
                      color={"#ffffff"}
                      transparent
                      opacity={0}
                      blending={invert ? NormalBlending : AdditiveBlending}
                      depthWrite={false}
                    />
                  </points>
                )}

                <mesh>
                  <sphereGeometry args={[detailScale * (isTriangulum ? 0.1 : isLmc ? 0.12 : 0.11), 20, 20]} />
                  <meshBasicMaterial
                    ref={irregularBulgeMatRef as React.Ref<import("three").MeshBasicMaterial>}
                    color={isSmc ? (invert ? "#54331c" : "#fbc897") : (invert ? "#5a3416" : "#ffd9b0")}
                    transparent
                    opacity={0}
                    blending={invert ? NormalBlending : AdditiveBlending}
                    depthWrite={false}
                  />
                </mesh>
              </>
            )}
          </group>
        </group>
      </group>

      {/* Companion galaxies — M32 + M110 — sit beside the main disc.
          They're rendered without tilt so they read as small ellipticals
          at their own apparent positions. */}
      {companions.map((c, i) => (
        <mesh
          key={i}
          position={[c.offset[0] * detailScale, c.offset[1] * detailScale, c.offset[2] * detailScale]}
        >
          <sphereGeometry args={[detailScale * c.radius, 16, 16]} />
          <meshBasicMaterial
            ref={(m) => { companionMatRefs.current[i] = m }}
            color={companionColor}
            transparent
            opacity={0}
            blending={invert ? NormalBlending : AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  )
}

/**
 * BlackHoleDetail
 *
 * Strict Gargantua / Interstellar recreation, used for every black hole
 * in the scene (Sgr A*, M87*, Cygnus X-1, TON 618, V404 Cygni, …). The
 * structure is:
 *   - opaque shadow sphere at the centre, sized to the apparent shadow
 *     (~2.6 × event-horizon radius for Schwarzschild),
 *   - a bright thin photon ring tight against the shadow's edge —
 *     visually the brightest element, the Einstein-ring sliver,
 *   - an edge-on accretion disk that wraps around the sphere as four
 *     concentric belts from white-hot inner edge to warm-golden outer,
 *   - two arcs over the top and under the bottom — the disk's far side
 *     gravitationally lensed up and over the BH, which is what gives
 *     Gargantua its iconic "halo" silhouette.
 *
 * Real lensing is a ray-trace problem; we fake it by rendering the
 * lensed top/bottom as half-rings rotated 180° apart. Per Nolan's
 * directive (Kip Thorne, 2015), Doppler beaming is suppressed for
 * cinematic legibility — both halo arcs render at identical brightness.
 *
 * All other bodies (planets, Sun, moons, comets, asteroids, nebulae,
 * galaxies) follow NASA / catalog astronomical data, not Nolan's
 * stylisation. The Gargantua look is intentionally scoped to BHs.
 */
/**
 * Physics-driven proportions for the black hole detail.
 *
 *   horizon       — Kerr event-horizon (Schwarzschild collapses to this when spin=0)
 *   photon ring   — 1.5 × rs (photon sphere for a non-rotating BH)
 *   ISCO disk     — 6 × rs for Schwarzschild prograde; collapses to ~rs for max Kerr
 *   outer disk    — ~15 × rs (typical observed extent)
 *
 * Real Schwarzschild radii vary from ~62 km (Cygnus X-1) to ~1300 AU
 * (TON 618) — a 10⁹ ratio. We use a log-scale to map that to a visible
 * scene-unit range so all three black holes read as distinct sizes
 * without the stellar-mass one becoming a single pixel.
 */
function computeBlackHoleProportions(massSolar: number, spin: number, baseScale: number) {
  const rsMeters = schwarzschildRadiusMeters(massSolar)
  const rPlusMeters = kerrHorizonRadiusMeters(massSolar, spin)
  const photonMeters = rsMeters * 1.5
  // ISCO (innermost stable circular orbit) — Schwarzschild = 6 rs;
  // maximal Kerr prograde collapses to ~1 rs. Smooth interp by spin.
  const iscoFactor = 6 - 5 * Math.min(spin, 1)
  const iscoMeters = rsMeters * iscoFactor
  const outerMeters = rsMeters * 15
  // Log-scale visualisation: maps Cygnus X-1's ~60 km up to TON 618's
  // ~10¹¹ km onto a roughly 1× → 1.4× scene-scale ratio. Math.log10(rs)
  // would give ~5 → ~14 (range ~9); we normalise to a tighter band.
  const logRs = Math.log10(rsMeters)
  // Stellar mass ~ 5, supermassive ~ 13. Map [5, 13] → [0.75, 1.45].
  const visualMultiplier = 0.75 + Math.max(0, Math.min(1, (logRs - 5) / 8)) * 0.7
  const detailScale = baseScale * 4.0 * visualMultiplier

  // Scene-unit radii — Gargantua-style proportions.
  //
  // Two distinct things here: the *horizon* (actual event horizon — the
  // boundary of no return) and the *shadow* (what you SEE — a darker,
  // larger region because photons in the photon sphere's catchment area
  // are all bent into the horizon). For Schwarzschild the shadow is
  // 3√3/2 ≈ 2.598 × the horizon radius; for max-spin Kerr it shrinks
  // slightly and becomes asymmetric. We interpolate linearly with spin.
  //
  // Everything visible (the black silhouette, the photon ring, the
  // lensed halo, the disk) is scaled off `shadowR`, not `horizonR` —
  // that's what makes the proportions read as Interstellar's Gargantua.
  const horizonR = detailScale * 0.22 * (rPlusMeters / rsMeters)
  const shadowFactor = 2.598 - 0.55 * Math.min(spin, 1)
  const shadowR = horizonR * shadowFactor
  return {
    rsMeters,
    rPlusMeters,
    photonMeters,
    iscoMeters,
    outerMeters,
    iscoFactor,
    horizonR,
    shadowR,
    // Photon ring — thin Einstein-ring sliver sitting right at the edge
    // of the shadow. In Interstellar this is the brightest thing on
    // screen and the single most recognisable element.
    photonInner: shadowR * 0.97,
    photonOuter: shadowR * 1.03,
    // Lensed halo — the secondary image of the disk's far side, bent
    // gravitationally over the top and under the bottom of the shadow.
    // This is the iconic "ring above + below the BH" that makes the
    // Interstellar still look the way it does.
    haloInner:   shadowR * 1.03,
    haloOuter:   shadowR * 1.35,
    // Primary accretion disk — four concentric belts from white-hot
    // inner edge to warm-golden outer. Extent kept compact (~6 ×
    // shadow) so the disk reads as a defined ring around the BH
    // instead of sprawling into the rest of the scene.
    diskInner1:  shadowR * 1.18,
    diskOuter1:  shadowR * 2.00,
    diskInner2:  shadowR * 2.00,
    diskOuter2:  shadowR * 3.20,
    diskInner3:  shadowR * 3.20,
    diskOuter3:  shadowR * 4.50,
    diskInner4:  shadowR * 4.50,
    diskOuter4:  shadowR * 6.20,
    detailScale,
  }
}

/**
 * Bipolar relativistic jet — two emissive cones extending from the horizon
 * along the BH's spin axis. Real black holes (M87*, Sgr A*, Cygnus X-1)
 * eject these as the byproduct of accretion + frame-dragging; visually
 * they sit perpendicular to the disk.
 *
 * The jet axis defaults to local "y" because that's where the Sketchfab
 * model's disk normal lands; if a future model imports the disk in a
 * different orientation, flip `jet.axis` on the SkyPoint to "x" or "z".
 *
 * Both jets share geometry but the far-side opacity is dimmed to suggest
 * Doppler beaming — the approaching side appears brighter in real radio
 * observations.
 */
function BlackHoleJets({
  jet,
  detailScale,
  invert,
}: {
  jet: NonNullable<SkyPoint["jet"]>
  detailScale: number
  invert: boolean
}) {
  const axis = jet.axis ?? "y"
  const lengthFactor = jet.lengthFactor ?? 12
  const brightness = jet.brightness ?? 0.55
  const asymmetry = Math.max(0, Math.min(1, jet.asymmetry ?? 0.6))
  const color = jet.color ?? "#bcd9ff"

  // Geometry sized in rootRef-local frame, which the hover scale lerp will
  // grow from 0.001 → 1.0. detailScale here is the BH's per-instance size
  // factor, so jets scale with the BH naturally.
  const length = detailScale * lengthFactor * 0.06
  const radiusBase = detailScale * 0.012
  const radiusTip = detailScale * 0.038

  // Rotate the whole jet pair so the cylinders' local +y axis lines up with
  // the chosen world axis. Cylinder geometry defaults to extending along y.
  const rotation: [number, number, number] =
    axis === "x" ? [0, 0, -Math.PI / 2] :
    axis === "z" ? [Math.PI / 2, 0, 0] :
    [0, 0, 0]

  const farOpacity = brightness * (1 - asymmetry)
  // Light-mode pass: jets fight a bright background, so dial them back and
  // switch to normal blending — additive on cream looks washed out.
  const blendMode = invert ? NormalBlending : AdditiveBlending
  const nearAlpha = invert ? brightness * 0.55 : brightness
  const farAlpha = invert ? farOpacity * 0.55 : farOpacity

  return (
    <group rotation={rotation}>
      {/* Bright (near) jet — radius narrows at base, widens slightly at tip
          to read as a collimated outflow that broadens with distance. */}
      <mesh position={[0, length / 2, 0]}>
        <cylinderGeometry args={[radiusTip, radiusBase, length, 18, 1, true]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={nearAlpha}
          blending={blendMode}
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>
      {/* Far (dim) jet — mirrored across the BH centre. Lower opacity sells
          the Doppler asymmetry without needing per-pixel beaming math. */}
      <mesh position={[0, -length / 2, 0]} rotation={[Math.PI, 0, 0]}>
        <cylinderGeometry args={[radiusTip, radiusBase, length, 18, 1, true]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={farAlpha}
          blending={blendMode}
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>
    </group>
  )
}

// Module flag: flips true the first time ANY black hole is engaged, so every
// other instance switches to the (now-cached) GLB path too.
let bhMeshRequested = false

/** Idle stand-in for the BH model: the event-horizon shadow as a plain black
 *  sphere, sized to the GLB's dark core within the same spin/scale group. */
function BlackHoleShadowSphere() {
  return (
    <mesh>
      <sphereGeometry args={[1.3, 24, 24]} />
      <meshBasicMaterial color="#000000" />
    </mesh>
  )
}

/** The Sketchfab "Blackhole" by rubykamen (CC-BY-4.0) — isolated so useGLTF
 *  only runs (and downloads) once a BH is actually engaged. */
function BlackHoleGlbMesh() {
  const { scene: bhScene } = useGLTF("/models/blackhole.glb")
  return <Clone object={bhScene} />
}

function BlackHoleDetail({
  size,
  hovered,
  invert,
  massSolar,
  spin,
  name,
  jet,
}: {
  size: number
  hovered: boolean
  invert: boolean
  /** Mass in solar masses — drives Schwarzschild radius. */
  massSolar?: number
  /** Kerr spin parameter (0–1). Defaults to 0 (Schwarzschild). */
  spin?: number
  /** Display name for the data readout. */
  name?: string
  /** Optional bipolar relativistic jet config — see SkyPoint["jet"]. */
  jet?: SkyPoint["jet"]
}) {
  const rootRef = useRef<Group>(null)
  const spinRef = useRef<Group>(null)

  // Default to a generic supermassive value if mass wasn't declared on
  // the sky-point — keeps the renderer working even if someone adds a
  // BH without populating the physics data.
  const M = massSolar ?? 1e8
  const a = spin ?? 0
  const horizonGravity = useMemo(
    () => blackHoleHorizonGravityMetersPerSec2(M, a),
    [M, a],
  )

  const props = useMemo(
    () => computeBlackHoleProportions(M, a, size),
    [M, a, size],
  )
  const bhAffordance = useMemo(
    () => getBlackHoleAffordance({ invert, name, massSolar: M }),
    [invert, name, M],
  )

  // Stellar-mass black holes (X-ray binaries) have brighter, hotter disks
  // relative to their horizon than supermassive ones. Drives the visual
  // spin speed below — small systems spin visibly faster.
  const isStellarMass = M < 1000

  // The 8.4 MB GLB loads on first ENGAGEMENT (hover or focus), not at mount:
  // idle BHs render an honest black shadow sphere + findability halo — which
  // is what they look like from sky-shell distance anyway. Once any BH is
  // engaged, a module flag keeps the mesh path on for all instances (drei's
  // cache already has the bytes, matching the old always-mounted behavior).
  const [meshWanted, setMeshWanted] = useState(() => bhMeshRequested)
  useEffect(() => {
    if (hovered && !meshWanted) {
      bhMeshRequested = true
      useGLTF.preload("/models/blackhole.glb")
      setMeshWanted(true)
    }
  }, [hovered, meshWanted])
  // The model's natural extent runs roughly ±5 units around origin; this
  // factor brings it into scene-scale alongside the physics-driven
  // detailScale. 0.22 ≈ the visible footprint the old procedural disk had —
  // anything smaller turns into a pinprick at sky-shell distance (150 u).
  const meshScale = props.detailScale * 0.22

  useFrame((_, delta) => {
    const k = 1 - Math.exp(-delta * 6)
    if (rootRef.current) {
      const target = hovered ? 1.0 : 0.35
      const s = rootRef.current.scale.x
      const next = s + (target - s) * k
      rootRef.current.scale.set(next, next, next)
    }
    // Stellar-mass BHs spin faster (smaller systems, higher angular
    // frequency at ISCO). Disk visual rotation reflects that.
    const baseSpin = isStellarMass ? 0.14 : 0.06
    if (spinRef.current) {
      spinRef.current.rotation.y += delta * (hovered ? baseSpin : baseSpin * 0.4)
    }
  })

  return (
    <group ref={rootRef} scale={0.001}>
      {/* Sketchfab "Blackhole" by rubykamen (CC-BY-4.0) — replaces the
          procedural Gargantua build. The spinning wrapper rotates the
          full model (event horizon + accretion disk + lensed skins) as
          a unit; per-BH scale stays driven by computeBlackHoleProportions
          so Cygnus X-1 and TON 618 still read as distinct sizes. */}
      {/* Findability halo — soft glow so the BH spots from sky-shell distance.
          Only visible when NOT hovered: it's a spotting aid for users
          scanning the sky, not an embellishment to show on top of the
          model. The moment a user engages (hover/focus), the halo
          disappears so the BH silhouette + disk + jets read clean. */}
      {!hovered && (
        <mesh>
          <sphereGeometry args={[props.detailScale * 0.5, 24, 24]} />
          <meshBasicMaterial
            color={bhAffordance.haloColor}
            transparent
            opacity={bhAffordance.haloOpacity}
            blending={invert ? NormalBlending : AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      )}

      <group ref={spinRef} scale={meshScale}>
        {meshWanted ? (
          // While the GLB streams in, the Suspense fallback keeps the same
          // shadow sphere on screen — engagement upgrades the look in place,
          // with no flash of nothing.
          <Suspense fallback={<BlackHoleShadowSphere />}>
            <BlackHoleGlbMesh />
          </Suspense>
        ) : (
          <BlackHoleShadowSphere />
        )}
      </group>

      {/* Bipolar relativistic jets — perpendicular to the accretion disk
          along the spin axis. M87, Sgr A*, and Cygnus X-1 all have
          observed jets in reality; this renders them additively over the
          model so the GLB's existing lensed look stays untouched. */}
      {jet && <BlackHoleJets jet={jet} detailScale={props.detailScale} invert={invert} />}

      {/* Physics data overlay — fades in on hover. Mass, Schwarzschild
          radius, photon-sphere radius, ISCO factor. Anchored to the side
          of the BH so it doesn't sit on top of the shadow. */}
      {hovered && (
        <Html
          position={[props.detailScale * 1.5, 0, 0]}
          distanceFactor={6}
          zIndexRange={[10, 0]}
          style={{ pointerEvents: "none" }}
        >
          <div
            className={`
              select-none pointer-events-none whitespace-nowrap
              font-mono text-[10px] tracking-[0.12em] uppercase
              px-3 py-2 rounded-md backdrop-blur-sm
              ${
                invert
                  ? "bg-white/85 border border-foreground/25 text-foreground"
                  : "bg-black/65 border border-white/20 text-white"
              }
            `}
            style={{ animation: "ue-label-in 240ms ease-out both", minWidth: "11rem" }}
          >
            {name && (
              <div className="text-[11px] tracking-[0.22em] mb-1.5 opacity-80">
                {name}
              </div>
            )}
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[9px] normal-case tracking-normal font-sans">
              <span className="opacity-55">Mass</span>
              <span className="text-right tabular-nums">{formatSolarMass(M)}</span>
              <span className="opacity-55">Horizon g</span>
              <span className="text-right tabular-nums">{horizonGravity.toExponential(2)} m/s²</span>
              <span className="opacity-55">rₛ</span>
              <span className="text-right tabular-nums">{formatLength(props.rsMeters)}</span>
              <span className="opacity-55">photon sphere</span>
              <span className="text-right tabular-nums">{formatLength(props.photonMeters)}</span>
              <span className="opacity-55">ISCO</span>
              <span className="text-right tabular-nums">{props.iscoFactor.toFixed(1)} rₛ</span>
              {a > 0 && (
                <>
                  <span className="opacity-55">spin a</span>
                  <span className="text-right tabular-nums">{a.toFixed(2)}</span>
                </>
              )}
            </div>
            <div className="mt-1.5 pt-1.5 border-t border-current/15 text-[8px] tracking-[0.18em] opacity-45">
              Model · rubykamen · CC-BY-4.0
            </div>
          </div>
        </Html>
      )}
    </group>
  )
}

/**
 * NebulaDetail
 *
 * Mounted under a nebula sky-point. The idle visual is just the regular halo
 * (handled by the parent). On hover, this group lerps in three offset emission
 * cloudlets (Hα + OIII palette, additive blend) and — for Orion specifically —
 * the four Trapezium stars at the core. Ring (M57) gets a thin annulus instead
 * of cloudlets; Crab (M1) shifts to a magenta + cyan filament palette.
 *
 * Everything inside this group lives at scale 0 until hovered, so the cost
 * for non-hovered nebulae is just a few inert meshes per nebula.
 */
function NebulaDetail({
  pointId,
  size,
  hovered,
  invert,
}: {
  pointId: string
  size: number
  hovered: boolean
  invert: boolean
}) {
  const rootRef = useRef<Group>(null)
  const swirlRef = useRef<Group>(null)
  const cloudMatRefs = useRef<Array<import("three").MeshBasicMaterial | null>>([])
  const ringMatRef = useRef<import("three").MeshBasicMaterial>(null)
  const trapeziumMatRefs = useRef<Array<import("three").MeshBasicMaterial | null>>([])

  // Per-nebula palette + layout. Color choices match what astrophotos actually
  // show: Orion = pink Hα core + teal OIII wisps; Ring = teal annulus + warm
  // white-dwarf core; Crab = magenta + cyan filaments.
  const config = useMemo(() => {
    type NebulaCloud = {
      color: string
      offset: [number, number, number]
      scale: number
      stretch: [number, number, number]
    }
    if (pointId === "m57") {
      return {
        variant: "ring" as const,
        ringColor: invert ? "#1e3a3a" : "#7adfd2",
        coreColor: invert ? "#5a2412" : "#ffe9b8",
        clouds: [] as NebulaCloud[],
      }
    }
    if (pointId === "m1") {
      const clouds: NebulaCloud[] = [
        { color: invert ? "#5a1c4a" : "#ff7ab8", offset: [0.42, 0.20, 0.04],  scale: 1.5, stretch: [1.5, 0.8, 1.3] },
        { color: invert ? "#243a5a" : "#7ec8ff", offset: [-0.52, -0.28, 0.16], scale: 1.2, stretch: [1.2, 0.7, 1.6] },
        { color: invert ? "#3a1530" : "#ffb38a", offset: [0.10, -0.42, -0.18], scale: 0.95, stretch: [1.3, 0.75, 1.1] },
        { color: invert ? "#274963" : "#8fe8ff", offset: [-0.08, 0.36, -0.24], scale: 0.9, stretch: [1.1, 0.65, 1.4] },
      ]
      return {
        variant: "filaments" as const,
        ringColor: "",
        coreColor: invert ? "#3a1530" : "#ff8acf",
        clouds,
      }
    }
    // Default / Orion-style emission nebula.
    const clouds: NebulaCloud[] = [
      { color: invert ? "#5a2436" : "#ff8fae", offset: [0.42, 0.12, 0.10], scale: 1.6, stretch: [1.55, 0.75, 1.20] },
      { color: invert ? "#1f3a4a" : "#7fd6e8", offset: [-0.40, -0.18, 0.15], scale: 1.35, stretch: [1.25, 0.70, 1.50] },
      { color: invert ? "#3a1f4a" : "#c19bff", offset: [0.04, 0.34, -0.28], scale: 1.15, stretch: [1.35, 0.82, 1.22] },
      { color: invert ? "#4a2c1f" : "#ffb58f", offset: [0.12, -0.36, -0.16], scale: 0.95, stretch: [1.15, 0.68, 1.10] },
      { color: invert ? "#2b3b56" : "#8fb6ff", offset: [-0.26, 0.32, 0.22], scale: 0.85, stretch: [1.05, 0.64, 1.30] },
    ]
    return {
      variant: pointId === "m42" ? "orion" : ("clouds" as const),
      ringColor: "",
      coreColor: invert ? "#5a2436" : "#ffb6c9",
      clouds,
    }
  }, [pointId, invert])

  // Trapezium positions — the four bright young O-class stars at the heart of
  // Orion. Approximate relative layout, scaled into the local frame.
  const trapezium = useMemo<Array<[number, number, number]>>(
    () => [
      [-0.12,  0.05, 0],
      [ 0.10,  0.08, 0],
      [-0.04, -0.10, 0],
      [ 0.14, -0.04, 0],
    ],
    [],
  )

  useFrame((_, delta) => {
    const k = 1 - Math.exp(-delta * 6)

    // Lerp the whole detail group's scale toward the hover target so the
    // reveal feels like a soft bloom, not a snap.
    if (rootRef.current) {
      const target = hovered ? 1.0 : 0.001
      const s = rootRef.current.scale.x
      const next = s + (target - s) * k
      rootRef.current.scale.set(next, next, next)
    }

    // Slow swirl on the cloud group — readable rotation without strobing.
    if (swirlRef.current && hovered) {
      swirlRef.current.rotation.z += delta * 0.05
    }

    const cloudTarget = hovered ? (invert ? 0.55 : 0.62) : 0
    cloudMatRefs.current.forEach((m) => {
      if (!m) return
      m.opacity += (cloudTarget - m.opacity) * k
    })

    if (ringMatRef.current) {
      const ringTarget = hovered ? (invert ? 0.8 : 0.85) : 0
      ringMatRef.current.opacity += (ringTarget - ringMatRef.current.opacity) * k
    }

    const trapeziumTarget = hovered ? 1 : 0
    trapeziumMatRefs.current.forEach((m) => {
      if (!m) return
      m.opacity += (trapeziumTarget - m.opacity) * k
    })
  })

  const blending = invert ? NormalBlending : AdditiveBlending
  // Detail scale: the cloud structure should bloom out well past the idle halo
  // so the hover state reads as a real reveal, not a subtle tint.
  const detailScale = size * 2.4

  return (
    <group ref={rootRef} scale={0.001}>
      {config.variant === "ring" ? (
        // Planetary-nebula ring (M57). Sits perpendicular to the line of sight
        // so the annulus reads as a flat ring, not a sphere.
        <>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[detailScale * 0.42, detailScale * 0.58, 64]} />
            <meshBasicMaterial
              ref={ringMatRef as React.Ref<import("three").MeshBasicMaterial>}
              color={config.ringColor}
              transparent
              opacity={0}
              side={DoubleSide}
              blending={blending}
              depthWrite={false}
            />
          </mesh>
          {/* White-dwarf core — the dying star at the ring's centre. */}
          <mesh>
            <sphereGeometry args={[detailScale * 0.06, 12, 12]} />
            <meshBasicMaterial
              ref={(m) => { trapeziumMatRefs.current[0] = m }}
              color={config.coreColor}
              transparent
              opacity={0}
              blending={blending}
              depthWrite={false}
            />
          </mesh>
        </>
      ) : (
        // Cloud variant — stretched layered billows with a softer envelope,
        // so gas reads like depth volume instead of chunky spheres.
        <group ref={swirlRef}>
          {config.clouds.map((c, i) => (
            <group
              key={i}
              position={[
                c.offset[0] * detailScale,
                c.offset[1] * detailScale,
                c.offset[2] * detailScale,
              ]}
              rotation={[0, i * 0.45, i * 0.22]}
            >
              <mesh scale={c.stretch}>
                <sphereGeometry args={[detailScale * 0.50 * c.scale, 30, 30]} />
                <meshBasicMaterial
                  ref={(m) => { cloudMatRefs.current[i] = m }}
                  color={c.color}
                  transparent
                  opacity={0}
                  blending={blending}
                  depthWrite={false}
                />
              </mesh>
              <mesh scale={[c.stretch[0] * 1.35, c.stretch[1] * 1.35, c.stretch[2] * 1.35]}>
                <sphereGeometry args={[detailScale * 0.54 * c.scale, 24, 24]} />
                <meshBasicMaterial
                  color={c.color}
                  transparent
                  opacity={invert ? 0.16 : 0.14}
                  blending={blending}
                  depthWrite={false}
                />
              </mesh>
            </group>
          ))}
        </group>
      )}

      {/* Trapezium — Orion only. Four bright young O-stars at the core,
          arranged in the trademark quadrilateral. */}
      {config.variant === "orion" &&
        trapezium.map((pos, i) => (
          <mesh key={i} position={[pos[0] * detailScale, pos[1] * detailScale, pos[2] * detailScale]}>
            <sphereGeometry args={[detailScale * 0.04, 12, 12]} />
            <meshBasicMaterial
              ref={(m) => { trapeziumMatRefs.current[i] = m }}
              color={invert ? "#0a0a0a" : "#ffffff"}
              transparent
              opacity={0}
              blending={blending}
              depthWrite={false}
            />
          </mesh>
        ))}
    </group>
  )
}

/**
 * Exoplanet system — child worlds rendered orbiting an exoplanet-host
 * star when focused. Visualisation is scene-compressed: real systems
 * like TRAPPIST-1 cluster within 0.062 AU of the star (closer than
 * Mercury to our Sun), so faithful absolute scaling would be invisible.
 * Compress aAU to scene-units via a log curve so all planets read as
 * distinct concentric rings; periods drive animated motion.
 */
function ExoplanetSystem({
  planets,
  invert,
}: {
  planets: NonNullable<SkyPoint["planets"]>
  invert: boolean
}) {
  const groupRefs = useRef<Array<Group | null>>([])
  useFrame((_, delta) => {
    const tw = timeWarpRef.current
    planets.forEach((p, i) => {
      const g = groupRefs.current[i]
      if (!g) return
      // Period in seconds at default warp — compressed so even fast
      // inner-system orbits are watchable rather than blink-fast.
      const periodSec = Math.max(1.2, p.periodDays * 0.6)
      const speed = (2 * Math.PI) / periodSec
      g.rotation.y += delta * speed * tw
    })
  })
  // Habitable-zone band: the scene-radii spanning the HZ planets, so the famous
  // "planets in the liquid-water zone" is shown as a green annulus, not implied.
  const hzRadii = planets
    .filter((p) => p.habitableZone)
    .map((p) => 1.0 + Math.log10(1 + p.aAU * 200) * 0.9)
  const hzInner = hzRadii.length ? Math.min(...hzRadii) - 0.18 : 0
  const hzOuter = hzRadii.length ? Math.max(...hzRadii) + 0.18 : 0

  return (
    <group>
      {/* The host star itself — a small warm glow at the centre (ultra-cool red
          dwarf for TRAPPIST-1). Anchors the system so it reads as "a star + its
          worlds," not floating rings. */}
      <mesh>
        <sphereGeometry args={[0.34, 20, 20]} />
        <meshBasicMaterial color={invert ? "#8a3a1a" : "#ff8a4a"} toneMapped={false} />
      </mesh>
      {!invert && (
        <mesh>
          <sphereGeometry args={[0.62, 20, 20]} />
          <meshBasicMaterial color="#ff7a3a" transparent opacity={0.22} blending={AdditiveBlending} depthWrite={false} />
        </mesh>
      )}
      {/* Habitable-zone annulus — the liquid-water band. */}
      {hzRadii.length > 0 && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[hzInner, hzOuter, 80]} />
          <meshBasicMaterial color={invert ? "#1f6f3f" : "#7dffaf"} transparent opacity={invert ? 0.12 : 0.07} side={DoubleSide} depthWrite={false} blending={invert ? NormalBlending : AdditiveBlending} />
        </mesh>
      )}
      {planets.map((p, i) => {
        // Compressed radius: each planet sits at a distinct scene-distance
        // from the host. log-scaled so TRAPPIST-1's 7 planets between 0.01
        // and 0.06 AU all separate visibly.
        const orbitRadius = 1.0 + Math.log10(1 + p.aAU * 200) * 0.9
        const planetVisualRadius = Math.max(0.045, p.radiusEarth * 0.06)
        const dotColor = p.habitableZone
          ? (invert ? "#1f6f3f" : "#7dffaf")
          : (invert ? "#7a5028" : "#f0c890")
        return (
          <group key={p.name}>
            {/* Faint orbit ring */}
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <ringGeometry args={[orbitRadius - 0.003, orbitRadius + 0.003, 64]} />
              <meshBasicMaterial color={invert ? "#1a1208" : "#ffffff"} transparent opacity={0.20} side={DoubleSide} depthWrite={false} />
            </mesh>
            <group ref={(g) => { groupRefs.current[i] = g }} rotation={[0, (i / planets.length) * Math.PI * 2, 0]}>
              <mesh position={[orbitRadius, 0, 0]}>
                <sphereGeometry args={[planetVisualRadius, 14, 14]} />
                <meshBasicMaterial color={dotColor} />
              </mesh>
              {p.habitableZone && (
                <mesh position={[orbitRadius, 0, 0]}>
                  <sphereGeometry args={[planetVisualRadius * 1.8, 14, 14]} />
                  <meshBasicMaterial color={dotColor} transparent opacity={0.18} blending={invert ? NormalBlending : AdditiveBlending} depthWrite={false} />
                </mesh>
              )}
            </group>
          </group>
        )
      })}
    </group>
  )
}

function PulsarDetail({
  size,
  hovered,
  invert,
  pulseHz,
  beamLengthMul,
  beamWidthMul,
  beamColor,
}: {
  size: number
  hovered: boolean
  invert: boolean
  pulseHz: number
  beamLengthMul: number
  beamWidthMul: number
  beamColor: string
}) {
  const spinRef = useRef<Group>(null)
  const pulseRef = useRef(0)
  const beamNearRef = useRef<import("three").MeshBasicMaterial>(null)
  const beamFarRef = useRef<import("three").MeshBasicMaterial>(null)
  const ringRef = useRef<import("three").MeshBasicMaterial>(null)

  useFrame((_, delta) => {
    pulseRef.current += delta
    const phase = pulseRef.current * pulseHz * Math.PI * 2
    const pulse = Math.max(0, Math.sin(phase))
    if (spinRef.current) {
      spinRef.current.rotation.y += delta * 3.2
      spinRef.current.rotation.z = Math.sin(pulseRef.current * 0.8) * 0.1
    }
    if (beamNearRef.current) {
      const target = (hovered ? 0.48 : 0.32) * (0.35 + pulse * 0.95)
      beamNearRef.current.opacity += (target - beamNearRef.current.opacity) * (1 - Math.exp(-delta * 10))
    }
    if (beamFarRef.current) {
      const target = (hovered ? 0.32 : 0.2) * (0.2 + pulse * 0.7)
      beamFarRef.current.opacity += (target - beamFarRef.current.opacity) * (1 - Math.exp(-delta * 10))
    }
    if (ringRef.current) {
      const target = (hovered ? 0.3 : 0.18) * (0.6 + pulse * 0.35)
      ringRef.current.opacity += (target - ringRef.current.opacity) * (1 - Math.exp(-delta * 8))
    }
  })

  const beamLength = size * beamLengthMul
  const beamRadius = Math.max(size * 0.16 * beamWidthMul, 0.03)

  return (
    <group ref={spinRef} rotation={[0.62, 0, 0.44]}>
      <mesh position={[0, beamLength * 0.5, 0]}>
        <coneGeometry args={[beamRadius, beamLength, 20, 1, true]} />
        <meshBasicMaterial
          ref={beamNearRef}
          color={beamColor}
          transparent
          opacity={0.01}
          side={DoubleSide}
          blending={invert ? NormalBlending : AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, -beamLength * 0.5, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[beamRadius, beamLength, 20, 1, true]} />
        <meshBasicMaterial
          ref={beamFarRef}
          color={beamColor}
          transparent
          opacity={0.01}
          side={DoubleSide}
          blending={invert ? NormalBlending : AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[Math.max(size * 0.72, 0.22), Math.max(size * 0.06, 0.018), 10, 42]} />
        <meshBasicMaterial
          ref={ringRef}
          color={beamColor}
          transparent
          opacity={0.01}
          blending={invert ? NormalBlending : AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

/** Parse a SkyPoint distance string → light-years (best effort). Handles
 *  "2.5 million ly", "31 Mly", "1,344 ly", "40.7 ly". Returns null if unknown. */
function parseDistanceLy(distance?: string): number | null {
  if (!distance) return null
  const s = distance.toLowerCase().replace(/,/g, "")
  const num = parseFloat(s)
  if (!isFinite(num)) return null
  if (s.includes("billion") || /\bgly\b/.test(s)) return num * 1e9
  if (s.includes("million") || /\bmly\b/.test(s)) return num * 1e6
  if (s.includes("thousand") || /\bkly\b/.test(s)) return num * 1e3
  return num // plain light-years
}

/** Map a deep-sky object's real distance → a scene radius. The fixed-star shell
 *  is 150; deep-sky objects sit from ~the shell outward, log-spread by distance,
 *  so nearer nebulae parallax in front of farther galaxies. */
function skyDepthRadius(distance?: string): number {
  const ly = parseDistanceLy(distance)
  if (ly == null) return SKY_SHELL_DISTANCE
  // log10(ly): nebulae ~3–4 (thousands), local-group galaxies ~6–7 (millions),
  // far galaxies ~7–8. Spread that ~3.5→8 range onto ~140→340 scene units.
  const L = Math.log10(Math.max(ly, 100))
  const t = Math.min(1, Math.max(0, (L - 3.0) / 5.0)) // 0 at 1k ly → 1 at 1e8 ly
  return 140 + t * 200
}

/** SkyPoint id → Blender-baked nebula sprite (Hα/O-III emission clouds). */
const NEBULA_SPRITES: Record<string, string> = {
  m42: "/textures/nebulae/orion.webp",
}

/** Per-nebula volumetric config (real Hα/O-III look). Only listed nebulae get
 *  the raymarched 3D volume on close approach. mode: 0 = emission cloud,
 *  1 = ring/shell (planetary nebula). */
const VOLUMETRIC_NEBULAE: Record<string, { glow: [number, number, number]; rim: [number, number, number]; mode: number; density: number }> = {
  m42:    { glow: [0.95, 0.45, 0.62], rim: [0.45, 0.70, 0.95], mode: 0, density: 1.0 }, // Orion — Hα pink + O-III teal
  m16:    { glow: [0.90, 0.40, 0.45], rim: [0.55, 0.75, 0.55], mode: 0, density: 1.15 }, // Eagle — red Hα + green pillars
  carina: { glow: [0.95, 0.55, 0.50], rim: [0.55, 0.65, 0.95], mode: 0, density: 1.25 }, // Carina — vast bright Hα
  m8:     { glow: [0.95, 0.42, 0.52], rim: [0.50, 0.62, 0.90], mode: 0, density: 1.0 },  // Lagoon (if present)
  m57:    { glow: [0.55, 0.85, 0.80], rim: [0.95, 0.70, 0.45], mode: 1, density: 0.9 },  // Ring — teal shell, warm core
  m20:    { glow: [0.70, 0.45, 0.90], rim: [0.55, 0.70, 0.95], mode: 0, density: 1.0 },  // Trifid (if present) — pink+blue
}

/**
 * VolumetricNebula — a TRUE 3D gas cloud, raymarched live in GLSL (no billboard,
 * so it has real parallax + depth you can move through). Rendered on the inside
 * of a box: the fragment shader marches from the camera through the box volume,
 * accumulating FBM-noise emission. Only mounted when a nebula is focused/near, so
 * the per-pixel march cost is paid only when it matters. uOpacity blends it in.
 */
const VOLNEB_VERT = `
  varying vec3 vLocalPos;
  varying vec3 vCamLocal;
  void main() {
    vLocalPos = position;
    // camera position in this mesh's local space — the ray origin for marching
    vCamLocal = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const VOLNEB_FRAG = `
  precision highp float;
  varying vec3 vLocalPos;
  varying vec3 vCamLocal;
  uniform float uTime;
  uniform float uOpacity;
  uniform vec3  uGlow;
  uniform vec3  uRim;
  uniform float uMode;     // 0 = emission cloud, 1 = ring/shell (planetary)
  uniform float uDensity;  // overall density multiplier

  float hash(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7)))*43758.5453123); }
  float vnoise(vec3 p){
    vec3 i=floor(p); vec3 f=fract(p); f=f*f*(3.0-2.0*f);
    float n000=hash(i), n100=hash(i+vec3(1,0,0)), n010=hash(i+vec3(0,1,0)), n110=hash(i+vec3(1,1,0));
    float n001=hash(i+vec3(0,0,1)), n101=hash(i+vec3(1,0,1)), n011=hash(i+vec3(0,1,1)), n111=hash(i+vec3(1,1,1));
    return mix(mix(mix(n000,n100,f.x),mix(n010,n110,f.x),f.y),
               mix(mix(n001,n101,f.x),mix(n011,n111,f.x),f.y), f.z);
  }
  float fbm(vec3 p){ float v=0.0,a=0.5; for(int i=0;i<6;i++){ v+=a*vnoise(p); p=p*2.03+vec3(1.7); a*=0.5; } return v; }

  // density at a point in local space (~[-1,1]). Richer than a plain blob: a
  // base radial falloff carved by multi-octave FBM, with a brighter dense core;
  // ring mode hollows the centre into a shell (planetary nebulae like M57).
  float density(vec3 p){
    float r = length(p);
    // domain-warp the sample point with a low-freq noise → billowy, not uniform
    vec3 warp = vec3(fbm(p*0.9 + uTime*0.015), fbm(p*0.9 + 3.1), fbm(p*0.9 - 2.2)) - 0.5;
    vec3 q = p + warp * 0.6;
    float n = fbm(q * 2.0);
    n = smoothstep(0.42, 0.95, n);
    float fall;
    if (uMode > 0.5) {
      // ring/shell: peak at a mid radius, hollow centre + faded edge
      fall = smoothstep(0.18, 0.42, r) * (1.0 - smoothstep(0.55, 0.95, r));
    } else {
      fall = smoothstep(1.0, 0.12, r);
    }
    float core = (uMode > 0.5) ? 0.0 : pow(smoothstep(0.35, 0.0, r), 2.0) * 0.5; // bright nucleus
    return (n * fall + core) * uDensity;
  }

  void main(){
    vec3 rd = normalize(vLocalPos - vCamLocal);
    const int STEPS = 56;
    float stepLen = 2.7 / float(STEPS);
    vec3 p = vLocalPos;            // start at the entry face, march toward camera
    vec3 dir = -rd * stepLen;
    vec3 acc = vec3(0.0);
    float trans = 1.0;
    for(int i=0;i<STEPS;i++){
      float d = density(p);
      if(d > 0.001){
        // colour: faint rim → bright core hue as density rises
        vec3 col = mix(uRim, uGlow, smoothstep(0.0, 0.55, d));
        float a = d * 0.12;
        acc += trans * a * col;
        trans *= (1.0 - a);
        if(trans < 0.02) break;
      }
      p += dir;
    }
    float alpha = (1.0 - trans) * uOpacity;
    gl_FragColor = vec4(acc * uOpacity * 2.1, alpha);
  }
`

function VolumetricNebula({ size, active, glow, rim, mode, density }: {
  size: number
  active: boolean
  glow: [number, number, number]
  rim: [number, number, number]
  mode: number
  density: number
}) {
  const matRef = useRef<ShaderMaterial>(null)
  const uniforms = useMemo(() => ({
    uTime:    { value: 0 },
    uOpacity: { value: 0 },
    uGlow:    { value: new Color(...glow) },
    uRim:     { value: new Color(...rim) },
    uMode:    { value: mode },
    uDensity: { value: density },
  }), [glow, rim, mode, density])
  useFrame((_, delta) => {
    uniforms.uTime.value += delta
    const k = 1 - Math.exp(-delta * 3)
    uniforms.uOpacity.value += ((active ? 1 : 0) - uniforms.uOpacity.value) * k
  })
  return (
    <mesh scale={size}>
      <boxGeometry args={[2, 2, 2]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={VOLNEB_VERT}
        fragmentShader={VOLNEB_FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={BackSide}
        blending={AdditiveBlending}
      />
    </mesh>
  )
}

// Galaxy sprite shader — samples the baked texture AND multiplies by a soft
// radial mask so the square plane edge is ALWAYS invisible (the texture corners
// can never show as a rectangle, the bug that made them read as flat images).
const GALAXY_SPRITE_FRAG = `
  uniform sampler2D uTex;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    vec4 t = texture2D(uTex, vUv);
    // radial vignette: 1 at centre → 0 by the edge (corners fully gone)
    float d = length(vUv - 0.5) * 2.0;       // 0 centre, ~1.41 corner
    float mask = 1.0 - smoothstep(0.7, 1.0, d);
    // additive: brightness carries the look; force corners to black
    gl_FragColor = vec4(t.rgb * uOpacity * mask, 1.0);
  }
`
const GALAXY_SPRITE_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

/** Per-galaxy 3D form. tilt = inclination of the disc (rad, 0 = face-on,
 *  ~1.5 = edge-on); type drives arm/bulge proportions; color = star palette bias. */
const GALAXY_3D: Record<string, { tilt: number; type: "spiral" | "edgeon" | "irregular"; warm: boolean; scale: number }> = {
  // scale reflects real relative size: Andromeda (~152k ly, larger than the
  // Milky Way) is the biggest here; the Magellanic dwarfs are small.
  m31:  { tilt: 1.30, type: "spiral",     warm: true,  scale: 1.5 }, // Andromeda — biggest
  m33:  { tilt: 0.95, type: "spiral",     warm: false, scale: 0.9 }, // Triangulum
  m51:  { tilt: 0.35, type: "spiral",     warm: false, scale: 1.0 }, // Whirlpool
  m101: { tilt: 0.40, type: "spiral",     warm: false, scale: 1.25 }, // Pinwheel — large
  m104: { tilt: 1.48, type: "edgeon",     warm: true,  scale: 1.1 }, // Sombrero
  lmc:  { tilt: 0.70, type: "irregular",  warm: false, scale: 0.55 }, // LMC — dwarf
  smc:  { tilt: 0.80, type: "irregular",  warm: false, scale: 0.4 },  // SMC — smaller dwarf
}

const GAL3D_VERT = `
  attribute float aSize;
  attribute vec3 aColor;
  varying vec3 vColor;
  uniform float uPixelRatio;
  uniform float uScale;
  void main() {
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uScale * uPixelRatio * (14.0 / -mv.z);
    gl_PointSize = clamp(gl_PointSize, 0.6, 7.0);
  }
`
const GAL3D_FRAG = `
  varying vec3 vColor;
  uniform float uOpacity;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;
    float a = pow(1.0 - d * 2.0, 1.8);
    gl_FragColor = vec4(vColor, a * uOpacity);
  }
`

/**
 * Galaxy3D — a real THREE-DIMENSIONAL galaxy: a procedural particle disc (spiral
 * arms + bulge + genuine thickness), tilted to the galaxy's inclination. Unlike a
 * flat billboard it has true depth + parallax — you see it from different angles
 * as the camera moves, the way a real object in 3-space does. Generated once.
 */
function Galaxy3D({ id, size, invert }: { id: string; size: number; invert: boolean }) {
  const cfg = GALAXY_3D[id] ?? { tilt: 0.8, type: "spiral" as const, warm: false, scale: 1.0 }
  const groupRef = useRef<Group>(null)
  const matRef = useRef<ShaderMaterial>(null)

  const geometry = useMemo(() => {
    const arm = 3200
    const bulge = 900
    const total = arm + bulge
    const pos = new Float32Array(total * 3)
    const col = new Float32Array(total * 3)
    const siz = new Float32Array(total)
    const R = 1.0
    const branches = cfg.type === "irregular" ? 2 : (cfg.type === "edgeon" ? 2 : 4)
    const spin = cfg.type === "spiral" ? 2.4 : 1.0
    const thickness = cfg.type === "edgeon" ? 0.05 : 0.10
    const irregular = cfg.type === "irregular"

    const setCol = (i: number, r: number, g: number, b: number) => {
      if (invert) { col[i*3]=0.05; col[i*3+1]=0.05; col[i*3+2]=0.05 }
      else { col[i*3]=r; col[i*3+1]=g; col[i*3+2]=b }
    }
    // arms
    for (let i = 0; i < arm; i++) {
      const r = Math.pow(Math.random(), 0.7) * R
      const branch = (i % branches) / branches * Math.PI * 2
      const spinA = r * spin
      const scatter = irregular ? (Math.random() - 0.5) * 2.5 : 0
      const a = branch + spinA + scatter
      const jitter = (irregular ? 0.5 : 0.18) * r
      const rx = (Math.random()-0.5) * jitter * 2
      const rz = (Math.random()-0.5) * jitter * 2
      pos[i*3]   = Math.cos(a) * r + rx
      pos[i*3+1] = (Math.random()-0.5) * thickness * 2 * (1 - r*0.5)
      pos[i*3+2] = Math.sin(a) * r + rz
      siz[i] = 1.0 + Math.pow(Math.random(),3)*3
      const normR = r / R
      if (Math.random() < 0.2 + normR*0.3) setCol(i, 0.75, 0.83, 1.0)     // blue
      else if (Math.random() < 0.5) setCol(i, 0.97,0.97,0.97)             // white
      else setCol(i, 1.0, cfg.warm?0.88:0.92, cfg.warm?0.7:0.8)          // warm
    }
    // bulge
    for (let i = 0; i < bulge; i++) {
      const idx = arm + i
      const r = Math.abs((Math.random()+Math.random()+Math.random())/3 - 0.5) * 2 * R * 0.3
      const th = Math.random()*Math.PI*2
      const ph = (Math.random()-0.5) * (cfg.type==="edgeon" ? 0.9 : 0.5)
      pos[idx*3]   = r*Math.cos(th)*Math.cos(ph)
      pos[idx*3+1] = r*Math.sin(ph)*(cfg.type==="edgeon"?0.7:0.5)
      pos[idx*3+2] = r*Math.sin(th)*Math.cos(ph)
      siz[idx] = 1.0 + Math.pow(Math.random(),3)*2
      setCol(idx, 1.0, 0.9, 0.72)   // warm old core
    }
    const g = new BufferGeometry()
    g.setAttribute("position", new BufferAttribute(pos, 3))
    g.setAttribute("aColor", new BufferAttribute(col, 3))
    g.setAttribute("aSize", new BufferAttribute(siz, 1))
    return g
  }, [id, invert, cfg.type, cfg.warm])

  const uniforms = useMemo(() => ({
    uOpacity: { value: invert ? 0.9 : 0.85 },
    uPixelRatio: { value: typeof window !== "undefined" ? Math.min(window.devicePixelRatio, 2) : 1 },
    uScale: { value: 1 },
  }), [invert])

  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.04
  })

  return (
    // outer group: tilt the disc to the galaxy's inclination → real 3D orientation;
    // per-galaxy scale reflects real relative size (Andromeda largest).
    <group rotation={[cfg.tilt, 0, 0]} scale={size * cfg.scale}>
      <group ref={groupRef}>
        <points geometry={geometry}>
          <shaderMaterial
            ref={matRef}
            vertexShader={GAL3D_VERT}
            fragmentShader={GAL3D_FRAG}
            uniforms={uniforms}
            transparent
            depthWrite={false}
            blending={invert ? NormalBlending : AdditiveBlending}
          />
        </points>
      </group>
    </group>
  )
}

/** A camera-facing billboard showing a baked galaxy texture (additive, radially
 *  masked so the plane edge never shows). Kept as a far-distance LOD fallback. */
function GalaxySprite({ url, size }: { url: string; size: number }) {
  const ref = useRef<Mesh>(null)
  const matRef = useRef<ShaderMaterial>(null)
  const [tex, setTex] = useState<Texture | null>(null)
  useEffect(() => {
    let alive = true
    new TextureLoader().load(url, (t) => { t.colorSpace = SRGBColorSpace; if (alive) setTex(t) })
    return () => { alive = false }
  }, [url])
  const uniforms = useMemo(() => ({ uTex: { value: null as Texture | null }, uOpacity: { value: 0.9 } }), [])
  useEffect(() => { if (tex) uniforms.uTex.value = tex }, [tex, uniforms])
  useFrame(({ camera }) => { if (ref.current) ref.current.quaternion.copy(camera.quaternion) })
  if (!tex) return null
  return (
    <mesh ref={ref} renderOrder={-1}>
      <planeGeometry args={[size, size]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={GALAXY_SPRITE_VERT}
        fragmentShader={GALAXY_SPRITE_FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </mesh>
  )
}

function SkyPointMesh({
  point,
  onHover,
  invert = false,
  interactive = false,
}: {
  point: SkyPoint
  onHover: HoverHandler
  invert?: boolean
  interactive?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const starHaloMatRef = useRef<import("three").MeshBasicMaterial>(null)
  const starCoreMatRef = useRef<import("three").MeshBasicMaterial>(null)
  const starPulseRef = useRef(Math.random() * Math.PI * 2)
  // `focused` is set on click (in interactive mode) and stays true until
  // the user resets or focuses a different sky-point. This makes the rich
  // detail (galaxy spiral, nebula bloom) stay visible after the camera
  // has flown there — without it, the detail would collapse the moment
  // the cursor leaves the (now-closer) hit zone.
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    const onSkyFocus = (e: Event) => {
      const id = (e as CustomEvent<{ pointId: string | null }>).detail?.pointId
      // Clear focus on any other point's click or on global reset (id===null).
      if (id !== point.id) setFocused(false)
    }
    window.addEventListener("universe:sky-focus", onSkyFocus)
    return () => window.removeEventListener("universe:sky-focus", onSkyFocus)
  }, [point.id])
  const detailActive = hovered || focused
  // Real DEPTH: place each deep-sky object at a radius that grows with its true
  // distance (log-compressed), instead of pinning everything to the flat shell —
  // so nearer nebulae sit in front of farther galaxies and the whole field
  // PARALLAXES as the camera moves (the visceral 3D cue). Stars stay at the
  // shell (150); deep-sky objects spread from ~the shell outward by distance.
  const depthRadius = useMemo(() => skyDepthRadius(point.distance), [point.distance])
  const position = useMemo(
    () => raDecToScenePos(point.raHours, point.decDeg, depthRadius),
    [point.raHours, point.decDeg, depthRadius],
  )

  const visualSize = point.visualSize ?? (
    point.kind === "galaxy"           ? 5 :
    point.kind === "nebula"           ? 2.5 :
    point.kind === "cluster"          ? 2 :
    point.kind === "black-hole"       ? 1.5 :
    point.kind === "star"             ? 0.7 :
    /* exoplanet-host */                  0.5
  )

  const skyAffordance = useMemo(
    () =>
      getSkyAffordance({
        kind: point.kind,
        pointId: point.id,
        visualSize,
        invert,
        shade: point.shade,
      }),
    [point.kind, point.id, visualSize, invert, point.shade],
  )
  const starDynamic = useMemo(
    () => (point.kind === "star" ? getStarDynamicProfile(point.id) : null),
    [point.kind, point.id],
  )
  const pulsarDynamic = useMemo(
    () => (point.kind === "exoplanet-host" ? getPulsarDynamicProfile(point.id) : null),
    [point.kind, point.id],
  )
  const isPulsar = point.kind === "exoplanet-host" && !!pulsarDynamic

  useFrame((_, delta) => {
    if (point.kind !== "star" && !isPulsar) return
    const haloMat = starHaloMatRef.current
    const coreMat = starCoreMatRef.current
    if (!haloMat || !coreMat) return

    starPulseRef.current += delta
    const TAU = Math.PI * 2
    let haloTarget = skyAffordance.haloOpacity
    let coreTarget = skyAffordance.coreOpacity

    if (point.kind === "star" && starDynamic) {
      const primary = Math.sin(starPulseRef.current * TAU * starDynamic.twinkleHz)
      const secondary = Math.sin(starPulseRef.current * TAU * starDynamic.twinkleHz * 0.37 + 1.2)
      const mod = 1 + primary * starDynamic.amplitude + secondary * starDynamic.amplitude * 0.35
      haloTarget = Math.max(0, Math.min(1, skyAffordance.haloOpacity * starDynamic.baseBias * mod))
      coreTarget = Math.max(0, Math.min(1, skyAffordance.coreOpacity * (0.92 + (mod - 1) * 0.45)))
    }

    if (isPulsar && pulsarDynamic) {
      const pulse = Math.max(0, Math.sin(starPulseRef.current * TAU * pulsarDynamic.pulseHz))
      const pulseMix = 0.32 + pulse * 0.68
      haloTarget = Math.max(0, Math.min(1, skyAffordance.haloOpacity * pulsarDynamic.haloBias * pulseMix))
      coreTarget = Math.max(0, Math.min(1, skyAffordance.coreOpacity * (0.76 + pulse * 0.4)))
    }

    const k = 1 - Math.exp(-delta * 7)
    haloMat.opacity += (haloTarget - haloMat.opacity) * k
    coreMat.opacity += (coreTarget - coreMat.opacity) * k
  })

  // Hit-zone scales with the visual so even tiny exoplanet dots are findable.
  // Nebulae get a wider zone so the on-hover bloom doesn't fall outside the
  // tracked area and cause flicker as the cursor explores the expanded detail.
  const hitRadius = Math.max(skyAffordance.minHitRadius, visualSize * skyAffordance.hitRadiusMul)

  return (
    <group position={position}>
      {/* Blender-baked galaxy sprite — for the iconic galaxies we've baked
          (M31, M33, M51, M101, M104, LMC, SMC), show the real spiral/edge-on
          SHAPE instead of a generic fuzzy halo. Billboarded to face the camera,
          additive. Falls through to the halo below for galaxies without a bake. */}
      {point.kind === "galaxy" && GALAXY_3D[point.id] && (
        <Galaxy3D id={point.id} size={visualSize * 1.7} invert={invert} />
      )}
      {/* Blender-baked nebula sprite — for the nebulae we've baked (M42 Orion),
          show the real Hα/O-III cloud instead of a generic halo. Same masked
          additive billboard as galaxies (radial mask = no square edge). */}
      {point.kind === "nebula" && NEBULA_SPRITES[point.id] && !invert && (
        <GalaxySprite url={NEBULA_SPRITES[point.id]} size={visualSize * 2.8} />
      )}
      {/* Diffuse halo — galaxies/nebulae WITHOUT a bake, and bright stars, get a
          soft halo. Baked-sprite objects + black holes skip it. */}
      {((point.kind === "galaxy" && !GALAXY_3D[point.id]) || (point.kind === "nebula" && !(NEBULA_SPRITES[point.id] && !invert)) || point.kind === "star" || isPulsar) && (
        <mesh>
          <sphereGeometry args={[visualSize * skyAffordance.haloRadiusMul, 16, 16]} />
          <meshBasicMaterial
            ref={(point.kind === "star" || isPulsar) ? (starHaloMatRef as React.Ref<import("three").MeshBasicMaterial>) : undefined}
            color={skyAffordance.halo}
            transparent
            opacity={skyAffordance.haloOpacity}
            blending={invert ? NormalBlending : AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      )}
      {/* Core — additive glow for galaxies/nebulae/clusters/stars, opaque dot
          for exoplanet hosts. Skipped for baked-sprite galaxies (the sprite IS
          the core) + black holes (dedicated detail component). */}
      {point.kind !== "black-hole" && !(point.kind === "galaxy" && GALAXY_3D[point.id]) && !(point.kind === "nebula" && NEBULA_SPRITES[point.id] && !invert) && (
        <mesh>
          <sphereGeometry args={[
            visualSize * skyAffordance.coreRadiusMul,
            14,
            14,
          ]} />
          <meshBasicMaterial
            ref={(point.kind === "star" || isPulsar) ? (starCoreMatRef as React.Ref<import("three").MeshBasicMaterial>) : undefined}
            color={skyAffordance.core}
            transparent
            opacity={skyAffordance.coreOpacity}
            blending={invert ? NormalBlending : AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      )}
      {/* Nebula hover detail — layered emission cloudlets that bloom in on hover,
          plus the Trapezium for Orion. Idle cost is ~3 inert meshes at scale 0.
          Uses `detailActive` so the bloom persists after a click → fly-to lands. */}
      {point.kind === "nebula" && (
        <NebulaDetail pointId={point.id} size={visualSize} hovered={detailActive} invert={invert} />
      )}
      {/* True 3D raymarched gas volume — real depth/parallax you can move through,
          mounted only for listed nebulae and only while focused (perf). */}
      {point.kind === "nebula" && !invert && VOLUMETRIC_NEBULAE[point.id] && (
        <VolumetricNebula
          size={visualSize * 2.2}
          active={detailActive}
          glow={VOLUMETRIC_NEBULAE[point.id].glow}
          rim={VOLUMETRIC_NEBULAE[point.id].rim}
          mode={VOLUMETRIC_NEBULAE[point.id].mode}
          density={VOLUMETRIC_NEBULAE[point.id].density}
        />
      )}
      {/* Exoplanet system — child planets rendered orbiting the host star
          when the host is focused. Only TRAPPIST-1 carries this data today.
          The orbits are heavily scene-compressed — real TRAPPIST-1 planets
          are all within 0.062 AU of their star, so faithfully rendering at
          our scale would cluster them invisibly tight. */}
      {point.kind === "exoplanet-host" && point.planets && detailActive && (
        <ExoplanetSystem planets={point.planets} invert={invert} />
      )}
      {isPulsar && pulsarDynamic && (
        <PulsarDetail
          size={visualSize}
          hovered={detailActive}
          invert={invert}
          pulseHz={pulsarDynamic.pulseHz}
          beamLengthMul={pulsarDynamic.beamLengthMul}
          beamWidthMul={pulsarDynamic.beamWidthMul}
          beamColor={pulsarDynamic.beamColor}
        />
      )}
      {/* Galaxy hover detail — currently Andromeda only. Spiral arm point
          cloud + bulge + dust lane + companions M32 / M110 bloom in. */}
      {point.kind === "galaxy" && (
        <GalaxyDetail pointId={point.id} size={visualSize} hovered={detailActive} invert={invert} />
      )}
      {/* Black-hole hover detail — Sketchfab "Blackhole" by rubykamen
          (CC-BY-4.0), 8.4 MB GLB preloaded at module init. Wrapped in
          Suspense so the first BH render doesn't unmount the rest of
          the scene while the asset is still in flight; fallback is the
          plain black shadow sphere sized to the BH's apparent shadow. */}
      {point.kind === "black-hole" && (
        <Suspense
          fallback={
            <mesh>
              <sphereGeometry args={[visualSize * 0.5, 16, 16]} />
              <meshBasicMaterial color="#000000" />
            </mesh>
          }
        >
          <BlackHoleDetail
            size={visualSize}
            hovered={detailActive}
            invert={invert}
            massSolar={point.massSolar}
            spin={point.spin}
            name={point.name}
            jet={point.jet}
          />
        </Suspense>
      )}
      {/* Cluster spray — for star clusters, add a handful of bright pinpoints
          around the core to suggest individual stars. */}
      {point.kind === "cluster" && (
        <group>
          {[
            [0.7, 0.5, 0],
            [-0.5, 0.8, 0.2],
            [0.4, -0.6, -0.3],
            [-0.7, -0.3, 0.1],
            [0.0, 0.9, -0.4],
            [-0.9, 0.1, 0.3],
            [0.6, 0.0, 0.5],
          ].map(([dx, dy, dz], i) => (
            <mesh key={i} position={[dx * visualSize * 0.7, dy * visualSize * 0.7, dz * visualSize * 0.7]}>
              <sphereGeometry args={[visualSize * 0.12, 8, 8]} />
              <meshBasicMaterial
                color={skyAffordance.core}
                transparent
                opacity={0.9}
                blending={invert ? NormalBlending : AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
          ))}
        </group>
      )}
      {/* Hover hit-zone — invisible, scaled up so small dots are tappable.
          For nebulae we grow the zone further so the on-hover detail bloom has
          room to be entered/exited cleanly without flickering. */}
      <mesh
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
          const classBase =
            point.kind === "galaxy"     ? "Galaxy" :
            point.kind === "nebula"     ? "Nebula" :
            point.kind === "cluster"    ? "Star cluster" :
            point.kind === "black-hole" ? "Black hole" :
            point.kind === "star"       ? "Star" :
            isPulsar                     ? "Pulsar host star" :
                                          "Exoplanet host star"
              const gravityMeasurement =
                point.kind === "black-hole" && point.massSolar !== undefined
                  ? {
                      label: "Horizon gravity",
                      value: blackHoleHorizonGravityMetersPerSec2(point.massSolar, point.spin ?? 0),
                      unit: "m/s²",
                      note: "Newtonian-equivalent acceleration at the event horizon",
                    }
                  : undefined
          const factWithDistance = point.distance
            ? `${point.fact} Distance · ${point.distance}.`
            : point.fact
          onHover({
            name: point.name,
            classification: `${classBase} · ${point.designation}`,
            fact: factWithDistance,
                gravityMeasurement,
          })
        }}
        onPointerOut={() => {
          setHovered(false)
          onHover(null)
        }}
        // Click flies to the sky point AND marks this one as the focused
        // sky-point so the detail bloom persists after arrival (without
        // this, hovering away would collapse the spiral / nebula reveal).
        // Distance scales with the visual so nebulae get framed wide enough
        // to see the detail, exoplanet hosts get framed tight.
        onClick={
          interactive
            ? (e) => {
                e.stopPropagation()
                setFocused(true)
                window.dispatchEvent(
                  new CustomEvent("universe:sky-focus", { detail: { pointId: point.id } }),
                )
                const world = new Vector3()
                e.object.getWorldPosition(world)
                requestFlyTo(
                  { x: world.x, y: world.y, z: world.z },
                  point.kind === "exoplanet-host" || point.kind === "star" ? 4 : Math.max(visualSize * 3.5, 9),
                  point.name,
                )
              }
            : undefined
        }
      >
        <sphereGeometry args={[hitRadius, 10, 10]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {/* Hover label — completes the parity pattern: planets, named bodies,
          and sky-points (galaxies, nebulae, clusters, exoplanet hosts) all
          surface a floating name on cursor hover. BHs skip this — their
          existing physics overlay already shows the name. */}
      {hovered && point.kind !== "black-hole" && (
        <Html
          position={[0, Math.max(visualSize * 1.2, 1.5), 0]}
          center
          distanceFactor={28}
          zIndexRange={[10, 0]}
          style={{ pointerEvents: "none" }}
        >
          <div
            className={`
              whitespace-nowrap select-none pointer-events-none
              font-mono text-[10px] tracking-[0.3em] uppercase
              px-2 py-1 rounded-full backdrop-blur-sm
              ${
                invert
                  ? "bg-white/85 border border-foreground/25 text-foreground"
                  : "bg-black/55 border border-white/20 text-white"
              }
            `}
            style={{ animation: "ue-label-in 220ms ease-out both" }}
          >
            {point.name}
          </div>
        </Html>
      )}
    </group>
  )
}

function SkyPoints({
  onHover,
  invert = false,
  interactive = false,
}: {
  onHover: HoverHandler
  invert?: boolean
  interactive?: boolean
}) {
  return (
    <group>
      {skyPoints.map((p) => (
        <SkyPointMesh
          key={p.id}
          point={p}
          onHover={onHover}
          invert={invert}
          interactive={interactive}
        />
      ))}
    </group>
  )
}

/**
 * SolarBackdrop — a faint, static field of distant stars used only in
 * `solarOnly` mode (the /lab/celestial explorer), where the full HYG starfield,
 * Milky Way, and constellations are hidden. Just enough points for depth and a
 * sense of space, with none of the catalog weight or sky labels.
 */
function SolarBackdrop({ invert }: { invert: boolean }) {
  const geom = useMemo(() => {
    const N = 1400
    const positions = new Float32Array(N * 3)
    const R = 6000
    for (let i = 0; i < N; i++) {
      // uniform on a far sphere shell
      const u = Math.random() * 2 - 1
      const theta = Math.random() * Math.PI * 2
      const r = R * (0.85 + Math.random() * 0.15)
      const s = Math.sqrt(1 - u * u)
      positions[i * 3] = r * s * Math.cos(theta)
      positions[i * 3 + 1] = r * u
      positions[i * 3 + 2] = r * s * Math.sin(theta)
    }
    const g = new BufferGeometry()
    g.setAttribute("position", new BufferAttribute(positions, 3))
    return g
  }, [])
  return (
    <points geometry={geom} frustumCulled={false}>
      <pointsMaterial
        size={2.2}
        sizeAttenuation={false}
        color={invert ? "#3a3a44" : "#cdd3e0"}
        transparent
        opacity={invert ? 0.5 : 0.7}
        depthWrite={false}
      />
    </points>
  )
}

/* ============================================================
 * Public scene composition — mounted inside the <Canvas>.
 * ============================================================ */

export function SceneContents({
  enableMotion,
  onHover,
  onResetView,
  mobile = false,
  invert = false,
  interactive = false,
  showGravityOverlay = false,
  showDeepDive = false,
  solarOnly = false,
}: {
  enableMotion: boolean
  onHover: HoverHandler
  onResetView: () => void
  mobile?: boolean
  invert?: boolean
  /** When true, body clicks fly the camera to that body. Off in passive mode. */
  interactive?: boolean
  /** Show gravitational-influence visualization. */
  showGravityOverlay?: boolean
  /** Show exact orbital trajectory trails and live position dots. */
  showDeepDive?: boolean
  /** Focus on our solar system only — hide constellations, named stars, the
   *  Milky Way, deep-sky/exoplanet points. Used by /lab/celestial. */
  solarOnly?: boolean
}) {
  const { scene } = useThree()
  useEffect(() => {
    scene.fog = new FogExp2(invert ? "#efece3" : "#050505", 0.0035)
    return () => {
      scene.fog = null
    }
  }, [scene, invert])

  return (
    <>
      <FlyToController interactive={interactive} />
      <SceneClock />
      {/* Real-position naked-eye star field from HYG v4.1 (8,920 stars
          at mag ≤ 6.5, mobile gets the brightest ~1,600). Constellations
          form naturally from the data — the hand-drawn constellation
          line figures just trace what's already there. Skipped in
          invert/chart mode, matching the previous drei <Stars> behaviour. */}
      {/* Deep-space layers — hidden in solarOnly (the /lab/celestial explorer),
          which focuses purely on our solar system. */}
      {!solarOnly && (
        <BrightStarField invert={invert} mobile={mobile} enableMotion={enableMotion} />
      )}

      {/* Hover layer for the 358 stars with proper names (Sirius, Vega,
          Betelgeuse, Polaris…). Invisible pointer-eventable spheres
          sized by magnitude; hover lights up the existing InfoPanel
          with apparent mag, distance, spectral type, catalog IDs. */}
      {!solarOnly && <NamedStarHoverLayer onHover={onHover} invert={invert} />}
      {/* Picker for the OTHER ~8,500 bright stars (no proper name) — hover any of
          them for an honest readout (relative brightness + colour class). The
          named layer above is hit first (closer spheres); this far backstop only
          reports when nothing nearer is under the cursor. */}
      {!solarOnly && interactive && <BrightStarPicker onHover={onHover} invert={invert} mobile={mobile} />}
      {/* The solar neighbourhood in TRUE 3D — nearby named stars placed at their
          real heliocentric distance (not flattened on the sky shell), so pulling
          the camera out flies past Alpha Centauri, Sirius, Procyon… at real depth. */}
      {!solarOnly && !mobile && <NearbyStars3D onHover={onHover} invert={invert} />}
      {!solarOnly && (
        <group rotation={[GALACTIC_PLANE_TILT_RAD, 0, 0]}>
          <MilkyWay onHover={onHover} mobile={mobile} invert={invert} interactive={interactive} />
        </group>
      )}
      {/* Calm, faint backdrop so solar-only space still has depth without the
          full HYG catalog / constellations. */}
      {solarOnly && <SolarBackdrop invert={invert} />}
      <group position={SOLAR_SYSTEM_POSITION}>
        <SolarSystem onHover={onHover} invert={invert} interactive={interactive} mobile={mobile} solarOnly={solarOnly} />
        <GravityOverlay show={showGravityOverlay} invert={invert} />
        <TrajectoryTrails show={showDeepDive} invert={invert} />
        <SphereOfInfluence show={showDeepDive} invert={invert} />
        {/* Comets, asteroids, interstellars — share the SolarSystem origin
            so their orbits sit around the same Sun the planets do. */}
        <NamedBodies onHover={onHover} invert={invert} interactive={interactive} />
      </group>
      {!solarOnly && <Constellations onHover={onHover} onResetView={onResetView} invert={invert} />}
      {/* Deep-sky targets + exoplanet hosts — share the sky-shell with constellations. */}
      {!solarOnly && <SkyPoints onHover={onHover} invert={invert} interactive={interactive} />}
      {enableMotion && <ShootingStars count={mobile ? 3 : 6} invert={invert} />}
      <ambientLight intensity={invert ? 0.55 : 0.18} />
    </>
  )
}
