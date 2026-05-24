"use client"

/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine — see ./index.tsx for the full notice.
 * https://github.com/sinhaankur/Portfolio/blob/main/LICENSE
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
import { NamedStarHoverLayer } from "./named-star-hover-layer"

// Preload the black-hole mesh at module init so it's ready by the time a
// user explores far enough to focus a sky-point BH. 8.4 MB asset — single
// network request, cached for every instance via drei's loader cache.
// Attribution: "Blackhole" by rubykamen, CC-BY-4.0
// https://sketchfab.com/3d-models/blackhole-74cbeaeae2174a218fe9455d77902b5c
useGLTF.preload("/models/blackhole.glb")
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  ClampToEdgeWrapping,
  Color,
  DoubleSide,
  FogExp2,
  Group,
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
  TIME_WARP_DAYS_PER_SEC,
  buildScenePlanets,
  constellations,
  flyToRef,
  followRef,
  formatLength,
  formatSolarMass,
  gauss,
  kerrHorizonRadiusMeters,
  magToVisualRadius,
  moons,
  namedBodies,
  planetToInfo,
  raDecToScenePos,
  requestFlyTo,
  requestFollow,
  schwarzschildRadiusMeters,
  simTimeRef,
  skyPoints,
  timeWarpRef,
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
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  void main() {
    vUv = uv;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
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
    // Night-side colour: either the night map (Earth's city lights) or
    // just an ambient-dimmed version of the day colour (Moon: shadow
    // side still has some earthshine; we approximate as 4% ambient).
    vec3 nightColor = uHasNight > 0.5
      ? texture2D(tNight, vUv).rgb * uNightStrength
      : dayColor * 0.04;
    vec3 color = mix(nightColor, dayColor, dayMix);
    gl_FragColor = vec4(color, uOpacity);
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
    simTimeRef.current.days += delta * TIME_WARP_DAYS_PER_SEC * timeWarpRef.current
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
    const armCount    = mobile ? 7200  : 18000
    const bulgeCount  = mobile ? 2200  : 5200
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

      const randomness = 0.28
      const rx = Math.pow(Math.random(), 2.6) * (Math.random() < 0.5 ? 1 : -1) * randomness * r
      const ry = Math.pow(Math.random(), 2.6) * (Math.random() < 0.5 ? 1 : -1) * randomness * r * 0.12
      const rz = Math.pow(Math.random(), 2.6) * (Math.random() < 0.5 ? 1 : -1) * randomness * r

      const i3 = i * 3
      positions[i3]     = Math.cos(branchAngle + spinAngle) * r + rx
      positions[i3 + 1] = ry
      positions[i3 + 2] = Math.sin(branchAngle + spinAngle) * r + rz

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
    }),
    [],
  )
  useEffect(() => {
    if (texture) dayNightUniforms.tDay.value = texture
  }, [texture, dayNightUniforms])

  const speedRadPerSec = useMemo(
    () => (2 * Math.PI) / (moon.periodDays / TIME_WARP_DAYS_PER_SEC),
    [moon.periodDays],
  )
  const startPhase = useMemo(() => Math.random() * Math.PI * 2, [])

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

  useEffect(() => {
    if (orbitRef.current) orbitRef.current.rotation.y = startPhase
  }, [startPhase])

  useFrame((_, delta) => {
    if (orbitRef.current) orbitRef.current.rotation.y += delta * speedRadPerSec * timeWarpRef.current

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
          />
        ))}
      </mesh>
      <mesh
        position={[moon.orbitRadius, 0, 0]}
        onPointerOver={(e) => {
          e.stopPropagation()
          onHover({
            name: moon.name,
            classification: `Moon of ${moon.parent}`,
            periodDays: moon.periodDays,
            fact: moon.fact,
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
                const followDistance = Math.max(moon.visualRadius * 6, 0.18)
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
                const followDistance = Math.max(moon.visualRadius * 6, 0.18)
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
          onHover({
            name: star.name,
            classification: star.designation,
            fact: `Magnitude ${star.magnitude}. ${isPolaris ? constellationFact : `Part of ${constellationName} — ${constellationFact}`}`,
            clickable: isClickable,
          })
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
          Lives outside the 3D point cloud as an HTML overlay so it stays crisp
          at any camera distance. drei's <Html> positions it in scene space. */}
      {active && (
        <Html
          position={centroid}
          center
          distanceFactor={120}
          zIndexRange={[10, 0]}
          // pointer events disabled — label is a hint, not a target
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
            style={{
              // Fade-in animation lives in CSS so it doesn't allocate a
              // motion node per constellation per frame.
              animation: "ue-label-in 220ms ease-out both",
            }}
          >
            {constellation.name}
          </div>
        </Html>
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
      <line geometry={streakGeometry}>
        <lineBasicMaterial color={meteorColor} transparent opacity={streakOpacity} />
      </line>
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
  // the texture's transparent band — no manual gap modelling needed.
  const matRef = useRef<import("three").MeshBasicMaterial>(null)
  const [texture, setTexture] = useState<Texture | null>(null)

  // Custom geometry: u is radial (0 = C ring inner, 1 = F ring outer),
  // v wraps around the circle. Lets the horizontal-strip ring texture
  // map cleanly across the ring system.
  const ringGeometry = useMemo(
    () => radialUVRingGeometry(planetRadius * 1.24, planetRadius * 2.34, 192),
    [planetRadius],
  )

  // Eagerly load the ring texture — Saturn is a common stop, the asset is
  // tiny (~6 KB WebP with alpha), and the band detail makes the planet
  // read as "the one with the rings" rather than "an orange ball with
  // bands". Same always-on treatment we applied to the planet surfaces.
  useEffect(() => {
    if (texture) return
    const loader = new TextureLoader()
    loader.load("/textures/saturn-ring.webp", (tex) => {
      tex.colorSpace = SRGBColorSpace
      tex.anisotropy = 8
      tex.wrapS = ClampToEdgeWrapping
      tex.wrapT = RepeatWrapping
      setTexture(tex)
    })
  }, [texture])

  const idleOpacity = invert ? 0.78 : 0.62
  const hoverOpacity = invert ? 1.0 : 0.95

  // Lerp ring opacity toward the hover target each frame. The whole strip
  // brightens together — its band structure (C / B / Cassini / A / F)
  // is baked into the texture itself.
  useFrame((_, delta) => {
    if (!matRef.current) return
    const k = 1 - Math.exp(-delta * 8)
    const target = highlighted ? hoverOpacity : idleOpacity
    matRef.current.opacity += (target - matRef.current.opacity) * k
  })

  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
      <mesh geometry={ringGeometry}>
        <meshBasicMaterial
          ref={matRef as React.Ref<import("three").MeshBasicMaterial>}
          map={texture}
          // Tint goes dark on cream so the rings read as ink-on-paper;
          // on dark theme the texture's natural amber dominates.
          color={invert ? "#1a1208" : "#ffffff"}
          transparent
          opacity={0}
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
}: {
  feature: SurfaceFeature
  planetRadius: number
  invert: boolean
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
        }}
        onPointerOut={() => setIsHovered(false)}
      >
        <sphereGeometry args={[hitRadius, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {isHovered && (
        <Html
          position={[0, pinRadius * 3, 0]}
          center
          distanceFactor={4}
          zIndexRange={[20, 0]}
          style={{ pointerEvents: "none" }}
        >
          <div
            className={`
              whitespace-nowrap select-none pointer-events-none
              font-mono text-[9px] tracking-[0.25em] uppercase
              px-2.5 py-1.5 rounded-md backdrop-blur-sm
              ${
                invert
                  ? "bg-white/90 border border-foreground/30 text-foreground"
                  : "bg-black/75 border border-white/25 text-white"
              }
            `}
            style={{ animation: "ue-label-in 220ms ease-out both", maxWidth: "18rem" }}
          >
            <div className="text-[10px] tracking-[0.22em] mb-1 opacity-90">
              {feature.name}
            </div>
            <div className="text-[8px] tracking-[0.18em] opacity-65 mb-1.5">
              {feature.agency} · {feature.date} · {feature.status}
            </div>
            <div className="font-sans normal-case tracking-normal text-[10px] leading-snug opacity-85 whitespace-normal">
              {feature.fact}
            </div>
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
}: {
  planet: ScenePlanet
  onHover: HoverHandler
  invert?: boolean
  interactive?: boolean
}) {
  const meshRef = useRef<Mesh>(null)
  const orbitRef = useRef<Group>(null)
  const texMeshRef = useRef<Mesh>(null)
  const texMatRef = useRef<import("three").MeshStandardMaterial>(null)
  const atmosMatRef = useRef<import("three").MeshBasicMaterial>(null)
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
  const detailActive = isHovered || focused

  // Listen for a global focus-clear (e.g. Reset) so the planet collapses
  // back to its idle chart-marker appearance.
  useEffect(() => {
    const onSkyFocus = (e: Event) => {
      const id = (e as CustomEvent<{ pointId: string | null }>).detail?.pointId
      if (id !== `planet:${planet.raw.name}`) setFocused(false)
    }
    window.addEventListener("universe:sky-focus", onSkyFocus)
    return () => window.removeEventListener("universe:sky-focus", onSkyFocus)
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
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  useEffect(() => {
    if (texture) dayNightUniforms.tDay.value = texture
    if (nightTexture) dayNightUniforms.tNight.value = nightTexture
  }, [texture, nightTexture, dayNightUniforms])

  // Mean anomaly accumulator for proper Kepler's-2nd-law motion. Phase
  // accumulates uniformly here; orbitRef.rotation.y is set to TRUE anomaly
  // each frame so eccentric planets (Pluto e=0.244, Mercury e=0.206) move
  // visibly faster near perihelion and slower at aphelion.
  const meanAnomalyRef = useRef(planet.raw.startPhase)

  useEffect(() => {
    meanAnomalyRef.current = planet.raw.startPhase
    if (orbitRef.current) orbitRef.current.rotation.y = planet.raw.startPhase
  }, [planet.raw.startPhase])

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
    meanAnomalyRef.current += delta * planet.orbitalSpeedRadPerSec * tw
    if (meshRef.current) meshRef.current.rotation.y += delta * visibleRotSpeed * tw

    // Kepler's 2nd law in action: solve E - e·sin E = M for the eccentric
    // anomaly, convert to true anomaly, then set BOTH the orbit rotation
    // AND the radial distance from those values. Bodies on eccentric
    // orbits sweep equal areas in equal times — fast at perihelion,
    // slow at aphelion — matching the textbook Keplerian behaviour.
    if (useEllipticalOrbit && positionRef.current && orbitRef.current) {
      const E = solveKepler(meanAnomalyRef.current, eccentricity)
      const trueAnom = eccentricToTrue(E, eccentricity)
      const r = (planet.orbitRadius * (1 - eccentricity * eccentricity)) /
                (1 + eccentricity * Math.cos(trueAnom))
      orbitRef.current.rotation.y = trueAnom
      positionRef.current.position.x = r
    } else if (orbitRef.current) {
      // Circular orbit (or near-circular): true anomaly == mean anomaly.
      orbitRef.current.rotation.y = meanAnomalyRef.current
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
    // Rocky-planet atmosphere glow — soft halo that fades in when the
    // planet is hovered or focused. Sells the "look closer" moment.
    // Per-planet intensity matches the actual atmospheric depth: Venus
    // is dense + reflective (you see the cloud deck, not the surface),
    // Earth's is iconic but thinner, Mars's is almost transparent.
    if (atmosMatRef.current) {
      const k = 1 - Math.exp(-delta * 8)
      const peakOpacity =
        planet.raw.name === "Venus" ? (invert ? 0.32 : 0.50) :
        planet.raw.name === "Earth" ? (invert ? 0.18 : 0.30) :
        planet.raw.name === "Mars"  ? (invert ? 0.10 : 0.16) :
        0.28
      const target = detailActive ? peakOpacity : 0
      atmosMatRef.current.opacity += (target - atmosMatRef.current.opacity) * k
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
                <sphereGeometry args={[planet.visualRadius * 1.005, planet.raw.name === "Earth" ? 96 : 64, planet.raw.name === "Earth" ? 96 : 64]} />
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
                  />
                ))}
              </group>
            )}

            {/* Rocky-planet atmosphere halo — Earth's cyan, Venus's pale
                yellow, Mars's faint salmon. Slightly larger sphere with
                additive blending; the limb glow reads as the planet's
                actual atmospheric scattering on approach. */}
            {hasAtmosphere && atmosphereColor && (
              <mesh>
                <sphereGeometry args={[planet.visualRadius * atmosphereScale, 64, 64]} />
                <meshBasicMaterial
                  ref={atmosMatRef as React.Ref<import("three").MeshBasicMaterial>}
                  color={atmosphereColor}
                  transparent
                  opacity={0}
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
  inclination,
  eccentricity = 0,
  invert = false,
}: {
  radius: number
  inclination: number
  /** Optional orbital eccentricity. When > 0, draws a polar-form ellipse with
   *  the Sun at one focus (the astronomically correct shape). 0 = circle. */
  eccentricity?: number
  invert?: boolean
}) {
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
    <group rotation={[inclination, 0, 0]}>
      <line geometry={geometry}>
        <lineBasicMaterial
          // Faint hairline orbits — ink on cream needs ~6× the opacity to
          // read at the same value as white-on-black.
          color={invert ? "#0a0a0a" : "#ffffff"}
          transparent
          opacity={opacity}
        />
      </line>
    </group>
  )
}

function SolarSystem({
  onHover,
  invert = false,
  interactive = false,
}: {
  onHover: HoverHandler
  invert?: boolean
  interactive?: boolean
}) {
  const sunRef = useRef<Mesh>(null)
  const coronaRef = useRef<Mesh>(null)
  const sunTexMeshRef = useRef<Mesh>(null)
  const sunTexMatRef = useRef<import("three").MeshStandardMaterial>(null)
  const coronaInnerMatRef = useRef<ShaderMaterial>(null)
  const coronaOuterMatRef = useRef<ShaderMaterial>(null)
  const [sunHovered, setSunHovered] = useState(false)
  const [sunTexture, setSunTexture] = useState<Texture | null>(null)
  const scenePlanets = useMemo(buildScenePlanets, [])
  const sunRotSpeed = useMemo(
    () => (2 * Math.PI) / (25 / TIME_WARP_DAYS_PER_SEC),
    [],
  )

  // Eagerly load the Solar System Scope Sun texture on mount — the Sun is
  // the centre of the scene, so its detailed view shouldn't be gated on
  // hover. Fades in via the opacity lerp below as soon as it lands.
  useEffect(() => {
    if (sunTexture) return
    const loader = new TextureLoader()
    loader.load("/textures/sun.webp", (tex) => {
      tex.colorSpace = SRGBColorSpace
      tex.anisotropy = 4
      setSunTexture(tex)
    })
  }, [sunTexture])

  useFrame((_, delta) => {
    const tw = timeWarpRef.current
    if (sunRef.current) sunRef.current.rotation.y += delta * sunRotSpeed * tw
    if (sunTexMeshRef.current) sunTexMeshRef.current.rotation.y += delta * sunRotSpeed * tw
    if (coronaRef.current) {
      const s = 1 + Math.sin(performance.now() * 0.0008) * 0.025
      coronaRef.current.scale.set(s, s, s)
    }
    // Texture is always-on — fades in once it lands, then stays at full
    // opacity. Hover still drives the corona flare below.
    if (sunTexMatRef.current) {
      const k = 1 - Math.exp(-delta * 7)
      const target = sunTexture ? 1 : 0
      sunTexMatRef.current.opacity += (target - sunTexMatRef.current.opacity) * k
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

  // Chart-mode Sun: a warm-amber disc ringed by a thin halo (like a printed
  // sun stamp on an old star map) instead of the glowing white sphere.
  // Lighting drops to almost ambient — planets get most of their colour from
  // the scene's ambientLight when invert is on.
  const sunBodyColor = invert ? "#c95824" : "#ffffff"
  const sunEmissive = invert ? "#7a3a16" : "#ffffff"
  const sunEmissiveIntensity = invert ? 0.0 : 1.6
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
      <mesh ref={sunRef}>
        <sphereGeometry args={[0.7, 64, 64]} />
        <meshStandardMaterial
          color={sunBodyColor}
          emissive={sunEmissive}
          emissiveIntensity={sunEmissiveIntensity}
          toneMapped={false}
        />
      </mesh>
      {/* Textured Sun layer — Solar System Scope Sol photo, fades in on hover
          over the abstract glowing sphere. Slightly larger so it doesn't
          z-fight with the base sphere. */}
      {sunTexture && (
        <mesh ref={sunTexMeshRef}>
          <sphereGeometry args={[0.705, 64, 64]} />
          <meshStandardMaterial
            ref={sunTexMatRef as React.Ref<import("three").MeshStandardMaterial>}
            map={sunTexture}
            emissiveMap={sunTexture}
            emissive="#ffffff"
            emissiveIntensity={invert ? 0.6 : 1.4}
            toneMapped={false}
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>
      )}
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
function solveKepler(meanAnomaly: number, e: number): number {
  if (e >= 1) return meanAnomaly
  let E = meanAnomaly + e * Math.sin(meanAnomaly)
  for (let i = 0; i < 8; i++) {
    const f = E - e * Math.sin(E) - meanAnomaly
    const fp = 1 - e * Math.cos(E)
    const dE = f / fp
    E -= dE
    if (Math.abs(dE) < 1e-8) break
  }
  return E
}

/**
 * Eccentric anomaly → true anomaly. For elliptical orbits.
 */
function eccentricToTrue(E: number, e: number): number {
  return 2 * Math.atan2(
    Math.sqrt(1 + e) * Math.sin(E / 2),
    Math.sqrt(1 - e) * Math.cos(E / 2),
  )
}

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
const SCENE_SCALE = 3 // scene units per sqrt(AU)
function compressRadius(rAU: number): number {
  return Math.sqrt(Math.max(rAU, 0)) * SCENE_SCALE
}

function orbitalElementsToCartesian(
  aAU: number,
  e: number,
  trueAnomaly: number,
  inclination: number,
  longNode: number,
  argPeri: number,
): [number, number, number] {
  // Polar form of the conic — r in REAL AU.
  // For hyperbolic orbits (e ≥ 1) the caller passes e=0, so this still
  // returns a finite r = aAU; callers using actual e ≥ 1 should pin
  // the body separately (see the e >= 1 branch in NamedBodyMesh).
  const rAU = (aAU * (1 - e * e)) / (1 + e * Math.cos(trueAnomaly))
  // Compress to scene units consistently with planet/moon scaling.
  const r = compressRadius(rAU)
  // Step 1: position in orbital plane, perihelion at +x_orbital.
  let xp = r * Math.cos(trueAnomaly)
  let zp = r * Math.sin(trueAnomaly)
  // Step 2: rotate by ω around the plane normal (y in orbital frame).
  if (argPeri !== 0) {
    const cw = Math.cos(argPeri)
    const sw = Math.sin(argPeri)
    const xRot = xp * cw - zp * sw
    const zRot = xp * sw + zp * cw
    xp = xRot
    zp = zRot
  }
  // Step 3: tilt by inclination around the line of nodes (x-axis when Ω=0).
  const yi = zp * Math.sin(inclination)
  const zi = zp * Math.cos(inclination)
  // Step 4: rotate by Ω around y (ecliptic pole).
  if (longNode === 0) return [xp, yi, zi]
  const cO = Math.cos(longNode)
  const sO = Math.sin(longNode)
  return [xp * cO - zi * sO, yi, xp * sO + zi * cO]
}

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
    return { a, e, inclination, longNode, argPeri, visualRadius, angularSpeed, phase, shade, shadeRgb, isLoop: isFinite(body.periodYears), hasTail, tailLengthFactor, hasAntiTail }
  }, [body])

  // Initialise the motion-trail ring buffer for comets / interstellars /
  // dwarfs — bodies whose motion is the headline detail. Built lazily so
  // bodies without a trail (asteroids, spacecraft using custom shapes)
  // don't allocate.
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

    // Advance phase; loop for periodic bodies, ping-pong for interstellars
    // so they continue to pass through the scene every couple of minutes.
    config.phase += delta * config.angularSpeed * tw
    if (config.isLoop) {
      if (config.phase > Math.PI * 2) config.phase -= Math.PI * 2
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
      // Ion tail — straight, electric-blue, points exactly anti-radial.
      if (tailMeshRef.current && tailMatRef.current) {
        const baseHalf = config.visualRadius * 7.0 * config.tailLengthFactor
        tailMeshRef.current.position.y = baseHalf * t
        tailMeshRef.current.scale.y = t
        const peakOpacity = invert ? 0.65 : 0.55
        tailMatRef.current.uniforms.uOpacity.value = t * peakOpacity
        tailMatRef.current.uniforms.uTime.value += delta
      }
      // Dust tail — broader, warm, slightly longer. Radiation pressure
      // pushes dust outward slower than the solar wind pushes ions, so
      // dust lags behind into a fan; the offset rotation in JSX captures
      // that curve. Smooth (no plasma knots).
      if (dustTailMeshRef.current && dustTailMatRef.current) {
        const baseHalf = config.visualRadius * 8.0 * config.tailLengthFactor
        dustTailMeshRef.current.position.y = baseHalf * t
        dustTailMeshRef.current.scale.y = t
        const peakOpacity = invert ? 0.55 : 0.48
        dustTailMatRef.current.uniforms.uOpacity.value = t * peakOpacity
      }
      // Sunward envelope — the bright dust hood pressed against the
      // Sun-facing side of an active comet. Same perihelion ramp; the
      // shader gradient handles the parabolic falloff toward the rim.
      if (envelopeMatRef.current) {
        const peakOpacity = invert ? 0.50 : 0.45
        envelopeMatRef.current.uniforms.uOpacity.value = t * peakOpacity
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
        jetMatRef.current.uniforms.uOpacity.value = jetT * peakOpacity
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
      const baseIdle = config.isLoop ? (invert ? 0.18 : 0.10) : (invert ? 0.14 : 0.08)
      const baseHover = config.isLoop ? (invert ? 0.65 : 0.50) : (invert ? 0.55 : 0.42)
      const target = isHovered ? baseHover : baseIdle
      const k = 1 - Math.exp(-delta * 8)
      trailMatRef.current.opacity += (target - trailMatRef.current.opacity) * k
    }
  })

  // Hit-zone radius — never smaller than 0.16 so even tiny bodies are
  // findable with a finger or cursor.
  const hitRadius = Math.max(0.16, config.visualRadius * 3)

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
          opacity={config.isLoop ? (invert ? 0.18 : 0.10) : (invert ? 0.14 : 0.08)}
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
              followable: interactive,
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
            position={[0, Math.max(config.visualRadius * 3.5, 0.35), 0]}
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
  const bulgeMatRef = useRef<import("three").MeshBasicMaterial>(null)
  const dustMatRef = useRef<import("three").MeshBasicMaterial>(null)
  const companionMatRefs = useRef<Array<import("three").MeshBasicMaterial | null>>([])

  // Only Andromeda for now — the others kind: "galaxy" stays as the
  // existing diffuse halo. Adding Triangulum is a one-rotation change.
  const isAndromeda = pointId === "m31"

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
      const z = (Math.random() - 0.5) * 0.04
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

  // Companion galaxy positions (Andromeda only — M32 + M110).
  // M32 sits south of the disc, M110 north-west; both are dwarf ellipticals.
  const companions = useMemo(
    () => [
      { offset: [0.55, -0.65, 0.05] as [number, number, number], radius: 0.08 }, // M32
      { offset: [-0.75, 0.50, -0.10] as [number, number, number], radius: 0.13 }, // M110
    ],
    [],
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
    const bulgeTarget = hovered ? (invert ? 0.55 : 0.75) : 0
    if (bulgeMatRef.current) {
      bulgeMatRef.current.opacity += (bulgeTarget - bulgeMatRef.current.opacity) * k
    }
    const dustTarget = hovered ? (invert ? 0.5 : 0.55) : 0
    if (dustMatRef.current) {
      dustMatRef.current.opacity += (dustTarget - dustMatRef.current.opacity) * k
    }
    const companionTarget = hovered ? (invert ? 0.4 : 0.55) : 0
    companionMatRefs.current.forEach((m) => {
      if (!m) return
      m.opacity += (companionTarget - m.opacity) * k
    })
  })

  if (!isAndromeda) return null

  // Andromeda's apparent inclination from Earth: 77° from face-on. The
  // position angle (orientation of the major axis on the sky) is ~38°.
  // Together these give the iconic tilted-oval look any naked-eye view
  // recognises immediately.
  const ANDROMEDA_TILT = 77 * DEG
  const ANDROMEDA_POSITION_ANGLE = 38 * DEG
  // Scene-units scale: idle halo is `size` (=5 for Andromeda); detail
  // blooms to ~3× so the spiral structure reads.
  const detailScale = size * 2.4

  // Tight central bulge core — kept as a soft warm glow because the
  // dense inner region in a real galaxy is too star-packed to resolve
  // into individual points. The star-cloud bulge baked into the
  // geometry handles the outer-bulge population.
  const bulgeColor = invert ? "#5a3416" : "#ffd9b0"
  const dustColor = invert ? "#0a0a0a" : "#1a0a04"
  const companionColor = invert ? "#3a1d12" : "#ffd9c2"

  return (
    <group ref={rootRef} scale={0.001}>
      {/* Position angle — rotates the apparent major-axis on the sky
          plane (≈38° east of north for Andromeda). Wraps the inclination
          + spin so the spiral's projection lands at the right angle. */}
      <group rotation={[0, 0, ANDROMEDA_POSITION_ANGLE]}>
        {/* Disc inclination — tilts the disc plane 77° from face-on so
            the spiral reads as a near-edge-on ellipse. */}
        <group rotation={[ANDROMEDA_TILT, 0, 0]}>
          <group ref={spinRef}>
            {/* Per-vertex coloured star cloud — bulge yellow / arm blue /
                H II pink, with logarithmic spiral arm structure baked in. */}
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
            {/* Tight bulge core — the unresolvable centre. Smaller and
                tighter than before so it complements the per-vertex
                bulge stars instead of swallowing them in a blob. */}
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
            {/* Dust lane — a thin elliptical band across the disc plane
                suggesting the iconic dark band that obscures part of
                Andromeda's near side. */}
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

  const props = useMemo(
    () => computeBlackHoleProportions(M, a, size),
    [M, a, size],
  )

  // Stellar-mass black holes (X-ray binaries) have brighter, hotter disks
  // relative to their horizon than supermassive ones. Drives the visual
  // spin speed below — small systems spin visibly faster.
  const isStellarMass = M < 1000

  // Sketchfab "Blackhole" by rubykamen (CC-BY-4.0). The model's natural
  // extent runs roughly ±5 units around origin; this factor brings it
  // into our scene-scale alongside the physics-driven detailScale.
  // 0.22 ≈ the visible footprint the old procedural disk used to have —
  // anything smaller turns into a pinprick at sky-shell distance (150 u).
  const { scene: bhScene } = useGLTF("/models/blackhole.glb")
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
            color={invert ? "#3a2418" : "#ffd6a8"}
            transparent
            opacity={invert ? 0.14 : 0.22}
            blending={invert ? NormalBlending : AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      )}

      <group ref={spinRef} scale={meshScale}>
        <Clone object={bhScene} />
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
    if (pointId === "m57") {
      return {
        variant: "ring" as const,
        ringColor: invert ? "#1e3a3a" : "#7adfd2",
        coreColor: invert ? "#5a2412" : "#ffe9b8",
        clouds: [] as Array<{ color: string; offset: [number, number, number]; scale: number }>,
      }
    }
    if (pointId === "m1") {
      return {
        variant: "filaments" as const,
        ringColor: "",
        coreColor: invert ? "#3a1530" : "#ff8acf",
        clouds: [
          { color: invert ? "#5a1c4a" : "#ff7ab8", offset: [0.4, 0.2, 0],    scale: 1.6 },
          { color: invert ? "#243a5a" : "#7ec8ff", offset: [-0.5, -0.3, 0.2], scale: 1.3 },
          { color: invert ? "#3a1530" : "#ffb38a", offset: [0.1, -0.4, -0.2], scale: 1.0 },
        ],
      }
    }
    // Default / Orion-style emission nebula.
    return {
      variant: pointId === "m42" ? "orion" : ("clouds" as const),
      ringColor: "",
      coreColor: invert ? "#5a2436" : "#ffb6c9",
      clouds: [
        { color: invert ? "#5a2436" : "#ff8fae", offset: [0.45, 0.15, 0.1],   scale: 1.7 }, // Hα pink
        { color: invert ? "#1f3a4a" : "#7fd6e8", offset: [-0.4, -0.2, 0.15],  scale: 1.4 }, // OIII teal
        { color: invert ? "#3a1f4a" : "#c19bff", offset: [0.05, 0.35, -0.3],  scale: 1.2 }, // dust-glow violet
      ],
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
        // Cloud variant — three offset emission billows.
        <group ref={swirlRef}>
          {config.clouds.map((c, i) => (
            <mesh
              key={i}
              position={[
                c.offset[0] * detailScale,
                c.offset[1] * detailScale,
                c.offset[2] * detailScale,
              ]}
            >
              <sphereGeometry args={[detailScale * 0.55 * c.scale, 24, 24]} />
              <meshBasicMaterial
                ref={(m) => { cloudMatRefs.current[i] = m }}
                color={c.color}
                transparent
                opacity={0}
                blending={blending}
                depthWrite={false}
              />
            </mesh>
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
  return (
    <group>
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
  const position = useMemo(
    () => raDecToScenePos(point.raHours, point.decDeg, SKY_SHELL_DISTANCE),
    [point.raHours, point.decDeg],
  )

  const visualSize = point.visualSize ?? (
    point.kind === "galaxy"           ? 5 :
    point.kind === "nebula"           ? 2.5 :
    point.kind === "cluster"          ? 2 :
    point.kind === "black-hole"       ? 1.5 :
    point.kind === "star"             ? 0.7 :
    /* exoplanet-host */                  0.5
  )

  // Per-kind colour palettes. Chart mode (invert) flips to ink-on-cream
  // accents so the halos stay readable. Individual stars override the
  // default palette via their `shade` field — driven by spectral class
  // (blue O/B, white A, yellow F/G, orange K, red M).
  const palette = useMemo(() => {
    switch (point.kind) {
      case "galaxy":
        return {
          core: invert ? "#3a1d12" : "#ffd9c2",
          halo: invert ? "#6b3a20" : "#d68a5c",
        }
      case "nebula":
        return {
          core: invert ? "#1e2a45" : "#a8d2ff",
          halo: invert ? "#3a5085" : "#5587d0",
        }
      case "cluster":
        return {
          core: invert ? "#0a0a0a" : "#ffffff",
          halo: invert ? "#2a2a2a" : "#cfd7ff",
        }
      case "black-hole":
        // Iconic Event-Horizon-Telescope colour scheme: a dark central
        // shadow ringed by a glowing orange accretion disk. The core
        // renders BLACK against any background so the silhouette pops.
        return {
          core: "#000000",
          halo: invert ? "#b34a13" : "#ff7a1a",
        }
      case "star": {
        // Star shade comes from the data (spectral class colour). Fallback
        // is white if unspecified. Halo lifts toward warmer for chart mode.
        const shade = point.shade ?? "#ffffff"
        return { core: shade, halo: invert ? "#5a4a18" : shade }
      }
      case "exoplanet-host":
      default:
        return {
          core: invert ? "#b34a13" : "#ffd66b",
          halo: invert ? "#7a3a16" : "#ffb84d",
        }
    }
  }, [point.kind, invert, point.shade])

  // Hit-zone scales with the visual so even tiny exoplanet dots are findable.
  // Nebulae get a wider zone so the on-hover bloom doesn't fall outside the
  // tracked area and cause flicker as the cursor explores the expanded detail.
  const hitRadius = Math.max(1, visualSize * (point.kind === "nebula" ? 2.6 : 1.4))

  return (
    <group position={position}>
      {/* Diffuse halo — galaxies, nebulae, and bright stars get a soft halo.
          Black holes skip this (BlackHoleDetail handles its own visual). */}
      {(point.kind === "galaxy" || point.kind === "nebula" || point.kind === "star") && (
        <mesh>
          <sphereGeometry args={[visualSize * (point.kind === "star" ? 0.7 : 1.0), 16, 16]} />
          <meshBasicMaterial
            color={palette.halo}
            transparent
            opacity={point.kind === "star" ? (invert ? 0.30 : 0.38) : (invert ? 0.18 : 0.22)}
            blending={invert ? NormalBlending : AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      )}
      {/* Core — additive glow for galaxies/nebulae/clusters/stars, opaque dot
          for exoplanet hosts. Black holes use the dedicated detail
          component so their horizon shadow is built into that. */}
      {point.kind !== "black-hole" && (
        <mesh>
          <sphereGeometry args={[
            visualSize * (point.kind === "exoplanet-host" ? 1.0 : point.kind === "star" ? 0.30 : 0.45),
            14,
            14,
          ]} />
          <meshBasicMaterial
            color={palette.core}
            transparent
            opacity={point.kind === "exoplanet-host" ? 1 : point.kind === "star" ? 1 : (invert ? 0.55 : 0.55)}
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
      {/* Exoplanet system — child planets rendered orbiting the host star
          when the host is focused. Only TRAPPIST-1 carries this data today.
          The orbits are heavily scene-compressed — real TRAPPIST-1 planets
          are all within 0.062 AU of their star, so faithfully rendering at
          our scale would cluster them invisibly tight. */}
      {point.kind === "exoplanet-host" && point.planets && detailActive && (
        <ExoplanetSystem planets={point.planets} invert={invert} />
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
                color={palette.core}
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
                                          "Exoplanet host star"
          const factWithDistance = point.distance
            ? `${point.fact} Distance · ${point.distance}.`
            : point.fact
          onHover({
            name: point.name,
            classification: `${classBase} · ${point.designation}`,
            fact: factWithDistance,
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
}: {
  enableMotion: boolean
  onHover: HoverHandler
  onResetView: () => void
  mobile?: boolean
  invert?: boolean
  /** When true, body clicks fly the camera to that body. Off in passive mode. */
  interactive?: boolean
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
      <BrightStarField invert={invert} mobile={mobile} enableMotion={enableMotion} />

      {/* Hover layer for the 358 stars with proper names (Sirius, Vega,
          Betelgeuse, Polaris…). Invisible pointer-eventable spheres
          sized by magnitude; hover lights up the existing InfoPanel
          with apparent mag, distance, spectral type, catalog IDs. */}
      <NamedStarHoverLayer onHover={onHover} invert={invert} />
      <group rotation={[GALACTIC_PLANE_TILT_RAD, 0, 0]}>
        <MilkyWay onHover={onHover} mobile={mobile} invert={invert} interactive={interactive} />
      </group>
      <group position={SOLAR_SYSTEM_POSITION}>
        <SolarSystem onHover={onHover} invert={invert} interactive={interactive} />
        {/* Comets, asteroids, interstellars — share the SolarSystem origin
            so their orbits sit around the same Sun the planets do. */}
        <NamedBodies onHover={onHover} invert={invert} interactive={interactive} />
      </group>
      <Constellations onHover={onHover} onResetView={onResetView} invert={invert} />
      {/* Deep-sky targets + exoplanet hosts — share the sky-shell with constellations. */}
      <SkyPoints onHover={onHover} invert={invert} interactive={interactive} />
      {enableMotion && <ShootingStars count={mobile ? 3 : 6} invert={invert} />}
      <ambientLight intensity={invert ? 0.55 : 0.18} />
    </>
  )
}
