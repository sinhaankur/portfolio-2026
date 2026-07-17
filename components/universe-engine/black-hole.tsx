"use client"

/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine — see ./index.tsx for the full notice.
 * https://github.com/sinhaankur/portfolio-2026/blob/main/LICENSE
 *
 * Universe Engine — Black-hole sub-engine.
 *
 * Everything that renders a black hole lives here:
 *   - computeBlackHoleProportions  physics → scene-scale radii (Kerr/Schwarzschild)
 *   - BlackHoleJets                bipolar relativistic outflow along the spin axis
 *   - BlackHoleShadowSphere        honest idle stand-in (event-horizon shadow)
 *   - BlackHoleRaymarch            per-pixel null-geodesic march: REAL gravitational
 *                                  lensing of the photographic sky + Doppler disk
 *   - BlackHoleDetail              the engaged view (raymarch + jets + physics HUD)
 *
 * Consumers (scene.tsx) mount <BlackHoleDetail /> under a black-hole sky-point.
 * Radii come from real mass/spin (schwarzschildRadiusMeters / kerrHorizonRadiusMeters).
 * The raymarcher replaced the former 13 MB Sketchfab GLB (2026-07-17): pure
 * GLSL, no downloads, and the shadow/photon-ring/lensing now EMERGE from the
 * geodesic math instead of being painted on a mesh.
 */

import { useRef, useMemo, useEffect, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { Html } from "@react-three/drei"
import {
  AdditiveBlending,
  DoubleSide,
  Group,
  Mesh,
  NormalBlending,
  ShaderMaterial,
  Vector3,
  type Texture,
} from "three"

import {
  SUN_OFFSET_SCENE,
  blackHoleHorizonGravityMetersPerSec2,
  formatLength,
  formatSolarMass,
  kerrHorizonRadiusMeters,
  schwarzschildRadiusMeters,
} from "./astronomy"
import { getBlackHoleAffordance } from "./celestial-sub-engine"
import { galacticBasis, loadAllSkyTexture } from "./sky-panorama"
import type { SkyPoint } from "./types"

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
export function computeBlackHoleProportions(massSolar: number, spin: number, baseScale: number) {
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

/** Idle stand-in: the event-horizon shadow as a plain black sphere sized to
 *  the apparent shadow — honestly what a BH looks like from shell distance. */
function BlackHoleShadowSphere({ radius }: { radius: number }) {
  return (
    <mesh>
      <sphereGeometry args={[radius, 24, 24]} />
      <meshBasicMaterial color="#000000" />
    </mesh>
  )
}

/* ============================================================
 * BlackHoleRaymarch — the physics does the drawing.
 *
 * A camera-facing quad around the hole; every fragment integrates a null
 * geodesic in Schwarzschild spacetime (units of rs = 1) using the conserved
 * angular-momentum form  a = −(3/2)·h²·x/r⁵ :
 *
 *   - rays that spiral below r = rs are captured → the SHADOW (nothing is
 *     painted black; black is where light genuinely cannot come from)
 *   - rays crossing the equatorial plane inside [ISCO, outer] pick up disk
 *     emission — temperature ramp (white-hot → golden → deep orange),
 *     Keplerian shear streaks, and Doppler beaming (β = √(rs/2r); the
 *     approaching side genuinely brightens + blue-shifts) — the far side
 *     of the disk appears ABOVE and BELOW the shadow because that's where
 *     its light really bends, and the photon ring emerges at ~2.6 rs on
 *     its own
 *   - rays that escape sample the REAL photographic sky (ESO/Brunier
 *     panorama) through the same IAU galactic mapping the SkyPanorama
 *     uses — the Einstein-ring smear around the shadow is the actual
 *     Milky Way behind the hole, displaced exactly as gravity would
 *
 * The quad's rim fades out radially so it composites seamlessly whether or
 * not the panorama sphere is currently visible at this vantage.
 * ============================================================ */

const BH_QUAD_RS = 18 // quad half-extent in rs units (disk reaches ~16)

const BH_VERT = /* glsl */ `
  varying vec3 vWorldPos;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const BH_FRAG = /* glsl */ `
  precision highp float;
  varying vec3 vWorldPos;
  varying vec2 vUv;
  uniform sampler2D uSky;
  uniform vec3 uGalX;
  uniform vec3 uGalY;
  uniform vec3 uGalZ;
  uniform vec3 uCenter;   // BH centre, world units
  uniform float uUnit;    // world length of 1 rs (tracks the scale lerp)
  uniform float uIscoRs;  // ISCO in rs units (6 → 1 with spin)
  uniform float uDiskOuterRs;
  uniform float uTime;
  uniform float uHasSky;
  uniform float uSkyLevel; // matches SkyPanorama's vantage fade

  const float ESCAPE_R = 27.0;
  const int STEPS = 110;

  vec3 skySample(vec3 d) {
    float gx = dot(d, uGalX);
    float gy = dot(d, uGalY);
    float gz = dot(d, uGalZ);
    float lon = atan(gy, gx);
    float lat = asin(clamp(gz, -1.0, 1.0));
    vec2 uv = vec2(0.5 - lon / 6.28318530718, 0.5 + lat / 3.14159265359);
    return texture2D(uSky, uv).rgb;
  }

  // Streaky shear noise — cheap stand-in for turbulent disk structure.
  // Incommensurate frequencies + a phase warp keep it organic; regular
  // sin products produce zebra-stripe moiré across the lensed disk.
  float streaks(float az, float r) {
    float warp = sin(az * 2.7 - r * 1.31) * 1.4;
    float s = sin(az * 6.1 + r * 2.9 + warp) * sin(az * 10.7 - r * 1.7 + warp * 0.6);
    return 0.5 + 0.5 * s;
  }

  vec3 diskEmission(vec2 hitXZ, vec3 rayDir, out float da) {
    float r = length(hitXZ);
    float az = atan(hitXZ.y, hitXZ.x);
    // Keplerian angular speed falls with radius — inner streaks lap outer.
    float s = streaks(az + uTime * (1.6 / (r * sqrt(r))) * 8.0, r);
    float t = clamp((r - uIscoRs) / (uDiskOuterRs - uIscoRs), 0.0, 1.0);
    vec3 hot  = vec3(1.45, 1.36, 1.22);
    vec3 warm = vec3(1.30, 0.84, 0.42);
    vec3 cool = vec3(0.72, 0.34, 0.13);
    vec3 col = mix(hot, mix(warm, cool, smoothstep(0.3, 1.0, t)), smoothstep(0.0, 0.4, t));
    // Radiative flux rises steeply toward the inner edge (~r^-3). The 3.2
    // ceiling keeps stellar-mass holes (small on screen) reading bright.
    float lum = 3.2 / (0.4 + r * r * 0.045);
    float fadeIn = smoothstep(uIscoRs, uIscoRs * 1.18, r);
    float fadeOut = 1.0 - smoothstep(uDiskOuterRs * 0.68, uDiskOuterRs, r);
    // Doppler beaming: v/c = sqrt(rs/2r) on a circular orbit; the side
    // orbiting toward the camera brightens ∝ D^~2.4 and shifts blue.
    float beta = sqrt(0.5 / max(r, 0.8));
    vec2 tangent = normalize(vec2(-hitXZ.y, hitXZ.x));
    float cosv = dot(tangent, -normalize(rayDir.xz));
    float dop = 1.0 / max(0.25, 1.0 - beta * cosv);
    col *= pow(dop, 2.4);
    col = mix(col, col * vec3(0.82, 0.9, 1.25), clamp((dop - 1.0) * 1.4, -0.3, 0.5));
    // Grazing incidence: a ray skimming the disk plane traverses a LONGER
    // path through the gas, so edge-on views (Cygnus X-1 arrival) brighten
    // instead of vanishing into a hairline. Steep crossings (M87*'s
    // off-plane vantage) keep factor ≈ 1.
    float grazing = clamp(0.35 / max(0.06, abs(rayDir.y) / max(1e-4, length(rayDir))), 1.0, 5.0);
    da = clamp(fadeIn * fadeOut * (0.45 + 0.55 * s) * min(grazing, 2.0), 0.0, 1.0);
    // Gentle streak modulation on colour (0.7–1.0) — full-depth modulation
    // reads as hard stripes once the disk is lensed across the screen.
    return col * (0.7 + 0.3 * s) * lum * grazing * fadeIn * fadeOut;
  }

  void main() {
    // Ray in rs units, in the BH's rest frame (world-aligned; disk = y plane).
    vec3 ro = (cameraPosition - uCenter) / uUnit;
    vec3 rd = normalize(vWorldPos - cameraPosition);

    // Skip the empty space up to the r = ESCAPE_R sphere analytically.
    float b = dot(ro, rd);
    float c = dot(ro, ro) - ESCAPE_R * ESCAPE_R;
    if (c > 0.0) {
      float disc = b * b - c;
      if (disc < 0.0) discard;
      ro += rd * max(0.0, -b - sqrt(disc));
    }

    vec3 pos = ro;
    vec3 vel = rd;
    vec3 hv = cross(pos, vel);
    float h2 = dot(hv, hv);

    vec3 emis = vec3(0.0);
    float emisA = 0.0;
    bool captured = false;
    float prevY = pos.y;

    for (int i = 0; i < STEPS; i++) {
      float r = length(pos);
      if (r < 1.0) { captured = true; break; }
      if (r > ESCAPE_R + 1.0 && dot(pos, vel) > 0.0) break;
      // Adaptive steps: coarse in the flat far field (bending is negligible
      // out there — with fine steps a ray starting ~24 rs out exhausts the
      // whole budget just APPROACHING and escapes unbent), fine deep in the
      // well where the curvature actually is.
      float dt = 0.3 * clamp(r * 0.22, 0.15, 5.0);
      vel += (-1.5 * h2 * pos / pow(r, 5.0)) * dt;
      pos += vel * dt;
      // Equatorial-plane crossing inside the disk annulus → emission.
      if (pos.y * prevY < 0.0) {
        float f = prevY / max(1e-6, prevY - pos.y);
        vec3 hit = mix(pos - vel * dt, pos, f);
        float hr = length(hit.xz);
        if (hr > uIscoRs && hr < uDiskOuterRs) {
          float da;
          vec3 dc = diskEmission(hit.xz, vel, da);
          emis += dc * da * (1.0 - emisA);
          emisA = min(1.0, emisA + da * 0.85);
          if (emisA > 0.98) break;
        }
      }
      prevY = pos.y;
    }

    vec3 col;
    float alpha = 1.0;
    if (captured) {
      // Disk light collected in FRONT of the horizon still shows; behind it
      // is the shadow — genuinely unlit, not painted.
      col = emis;
    } else {
      // Lensing conserves surface brightness: every escaped ray paints the
      // sky it actually reaches, at full alpha. uSkyLevel matches the
      // panorama sphere's vantage fade, so inside/outside the quad the sky
      // stays continuous (at low bending lensed ≈ straight — a seamless
      // rim), and at deep vantages the lens shows disk + shadow over dark.
      vec3 bg = uHasSky > 0.5 ? skySample(normalize(vel)) * uSkyLevel : vec3(0.0);
      col = emis + bg * (1.0 - emisA);
    }

    // Radial rim fade — the quad edge must never read as a square.
    float rim = length(vUv - 0.5) * 2.0;
    alpha *= 1.0 - smoothstep(0.82, 1.0, rim);

    // Soft highlight compression — the white-hot inner disk at fly-in range
    // otherwise clips a large area to flat white.
    col = col / (1.0 + 0.14 * max(col.r, max(col.g, col.b)));

    gl_FragColor = vec4(col, alpha);
  }
`

function BlackHoleRaymarch({
  rsScene,
  iscoFactor,
}: {
  /** World-scene length of one Schwarzschild radius at root scale 1. */
  rsScene: number
  /** ISCO in rs units (6 for Schwarzschild → ~1 for max prograde Kerr). */
  iscoFactor: number
}) {
  const meshRef = useRef<Mesh>(null)
  const matRef = useRef<ShaderMaterial>(null)
  const [sky, setSky] = useState<Texture | null>(null)

  useEffect(() => {
    let alive = true
    // 2k is plenty — the lensed patch covers a small solid angle.
    loadAllSkyTexture(true).then((t) => {
      if (alive) setSky(t)
    })
    return () => {
      alive = false
    }
  }, [])

  const uniforms = useMemo(() => {
    const basis = galacticBasis()
    return {
      uSky: { value: null as Texture | null },
      uGalX: { value: basis.x },
      uGalY: { value: basis.y },
      uGalZ: { value: basis.z },
      uCenter: { value: new Vector3() },
      uUnit: { value: rsScene },
      uIscoRs: { value: iscoFactor },
      uDiskOuterRs: { value: 16.0 },
      uTime: { value: 0 },
      uHasSky: { value: 0 },
      uSkyLevel: { value: 1 },
    }
  }, [rsScene, iscoFactor])

  useEffect(() => {
    if (sky) {
      uniforms.uSky.value = sky
      uniforms.uHasSky.value = 1
    }
  }, [sky, uniforms])

  useFrame(({ camera, clock }) => {
    const mesh = meshRef.current
    if (!mesh) return
    // Billboard the quad; the geodesic march runs in the WORLD-aligned BH
    // rest frame (uCenter/uUnit), so the disk plane stays put — matching
    // the jets' world-y axis — while the quad tracks the camera.
    mesh.quaternion.copy(camera.quaternion)
    mesh.getWorldPosition(uniforms.uCenter.value)
    mesh.getWorldScale(_bhWorldScale)
    uniforms.uUnit.value = rsScene * _bhWorldScale.x
    uniforms.uTime.value = clock.elapsedTime
    // Same vantage fade as SkyPanorama (130→300 from the shell centre) so
    // the lensed sky never disagrees with the sky around the quad.
    const dist = camera.position.distanceTo(_bhShellCenter)
    uniforms.uSkyLevel.value = 1 - Math.min(1, Math.max(0, (dist - 130) / 170))
    // Headless-test readout — real shader inputs, no guessing.
    if (typeof window !== "undefined") {
      ;(window as unknown as { __ueBH?: object }).__ueBH = {
        unit: uniforms.uUnit.value,
        rsScene,
        worldScale: _bhWorldScale.x,
        center: [uniforms.uCenter.value.x, uniforms.uCenter.value.y, uniforms.uCenter.value.z],
        camToCenter: camera.position.distanceTo(uniforms.uCenter.value),
        skyLevel: uniforms.uSkyLevel.value,
      }
    }
  })

  const half = rsScene * BH_QUAD_RS
  return (
    <mesh ref={meshRef} renderOrder={-5} frustumCulled={false}>
      <planeGeometry args={[half * 2, half * 2]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={BH_VERT}
        fragmentShader={BH_FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={NormalBlending}
      />
    </mesh>
  )
}

const _bhWorldScale = new Vector3()
const _bhShellCenter = new Vector3(SUN_OFFSET_SCENE, 0, 0)

/**
 * BlackHoleDetail
 *
 * Used for every black hole in the scene (M87*, Cygnus X-1, TON 618, …).
 * The engaged view is the BlackHoleRaymarch above — real lensing is a
 * ray-trace problem, and now it's actually ray-traced: the shadow, the
 * photon ring, the disk's far side arcing over and under the hole, and
 * the Einstein-smeared Milky Way behind it all EMERGE from integrating
 * null geodesics per pixel, scaled by the object's published mass and
 * spin. Unlike the film's Gargantua (Doppler suppressed on Nolan's
 * directive), the beaming stays in: the approaching disk side is
 * genuinely brighter and bluer.
 */
export function BlackHoleDetail({
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

  // The raymarcher mounts on first ENGAGEMENT (hover or focus), not at mount:
  // idle BHs render an honest black shadow sphere + findability halo — which
  // is what they look like from sky-shell distance anyway. Once engaged, it
  // stays mounted so re-hovers are instant. Chart mode keeps the plain
  // sphere: raymarched sky doesn't belong on ink-on-paper.
  const [engaged, setEngaged] = useState(false)
  useEffect(() => {
    if (hovered) setEngaged(true)
  }, [hovered])

  // Shader-local unit: shadow diameter emerges at 2.598 rs (Schwarzschild),
  // so anchoring rs to shadowR/2.598 keeps every BH's on-screen footprint
  // identical to the previous model's proportions.
  const rsScene = props.shadowR / 2.598

  useFrame((_, delta) => {
    const k = 1 - Math.exp(-delta * 6)
    if (rootRef.current) {
      const target = hovered ? 1.0 : 0.35
      const s = rootRef.current.scale.x
      const next = s + (target - s) * k
      rootRef.current.scale.set(next, next, next)
    }
  })

  return (
    <group ref={rootRef} scale={0.001}>
      {/* Findability halo — soft glow so the BH spots from sky-shell distance.
          Only visible when NOT hovered: it's a spotting aid for users
          scanning the sky, not an embellishment to show on top of the
          lensing. The moment a user engages (hover/focus), the halo
          disappears so the shadow + disk + jets read clean. */}
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

      {engaged && !invert ? (
        <BlackHoleRaymarch rsScene={rsScene} iscoFactor={props.iscoFactor} />
      ) : (
        <BlackHoleShadowSphere radius={props.shadowR} />
      )}

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
              Lensing · GLSL null-geodesic march
            </div>
          </div>
        </Html>
      )}
    </group>
  )
}
