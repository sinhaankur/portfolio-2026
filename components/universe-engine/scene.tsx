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
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  FogExp2,
  Group,
  Mesh,
  NormalBlending,
  Points,
  ShaderMaterial,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  Object3D,
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
  constellations,
  flyToRef,
  followRef,
  formatLength,
  formatSolarMass,
  gauss,
  kerrHorizonRadiusMeters,
  magToVisualRadius,
  moons,
  raDecToScenePos,
  requestFlyTo,
  requestFollow,
  schwarzschildRadiusMeters,
  simTimeRef,
  skyPoints,
  timeWarpRef,
  timeScaleRef,
  satellitesVisibleRef,
  focusDepthRef,
  DEFAULT_CAMERA_NEAR,
  DEFAULT_MIN_DISTANCE,
} from "./astronomy"
import { GALAXY_FRAGMENT_SHADER, GALAXY_VERTEX_SHADER } from "./shaders"

import {
  CORONA_VERTEX_SHADER,
  CORONA_FRAGMENT_SHADER,
  SUN_SURFACE_VERTEX_SHADER,
  SUN_SURFACE_FRAGMENT_SHADER,
} from "./shaders"
import { _tmpAxis } from "./scene-shared"
import { OrbitRing } from "./orbit-ring"
import { PlanetBody } from "./planet-body"
import { NamedBodies } from "./small-bodies"
import {
  NebulaClouds,
  NebulaDetail,
  VolumetricNebula,
  NEBULA_SPRITES,
  VOLUMETRIC_NEBULAE,
} from "./nebula"

import { CONSTELLATION_FIGURES } from "./constellation-figures"
import {
  getBlackHoleAffordance,
  getPulsarDynamicProfile,
  getSkyAffordance,
  getStarDynamicProfile,
} from "./celestial-sub-engine"
import type {
  Constellation,
  ConstellationId,
  ConstellationStar,
  HoverHandler,
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
      spinAxis: [number, number, number]
      spinRate: number
    }[] = []
    for (let i = 0; i < count; i++) {
      const r = innerRadius + rand() * (outerRadius - innerRadius)
      const a = rand() * Math.PI * 2
      // Per-rock tumble: a random spin axis + rate, so each asteroid rotates on
      // its OWN axis (real asteroids tumble independently) rather than all
      // riding one rigid ring. Small rates — a slow, varied churn, not a blur.
      const ax = rand() * 2 - 1, ay = rand() * 2 - 1, az = rand() * 2 - 1
      const len = Math.hypot(ax, ay, az) || 1
      out.push({
        model: Math.floor(rand() * BELT_ROCK_MODELS.length),
        pos: [Math.cos(a) * r, (rand() - 0.5) * thickness, Math.sin(a) * r],
        rot: [rand() * Math.PI * 2, rand() * Math.PI * 2, rand() * Math.PI * 2],
        scale: baseScale * (0.4 + rand() * 1.3),
        spinAxis: [ax / len, ay / len, az / len],
        spinRate: 0.08 + rand() * 0.35,
      })
    }
    return out
  }, [innerRadius, outerRadius, count, thickness, baseScale, seed])

  // Per-rock refs so each can tumble on its own axis in the frame loop.
  const rockRefs = useRef<(Object3D | null)[]>([])

  useFrame((_, delta) => {
    // The belt as a whole rides the slow orbital rotation…
    if (ref.current) ref.current.rotation.y += delta * rotationSpeed
    // …and each rock also tumbles independently, so it reads as thousands of
    // spinning bodies, not a rigid disc.
    for (let i = 0; i < rockRefs.current.length; i++) {
      const o = rockRefs.current[i]
      if (!o) continue
      const p = placements[i]
      o.rotateOnAxis(_tmpAxis.set(p.spinAxis[0], p.spinAxis[1], p.spinAxis[2]), delta * p.spinRate)
    }
  })

  return (
    <group ref={ref}>
      {placements.map((p, i) => (
        <Clone
          key={i}
          ref={(o: Object3D | null) => { rockRefs.current[i] = o }}
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
 * Planets + Sun + Orbit Rings
 * ============================================================ */



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
  // Photosphere = the baked Blender sun map (fiery, molten, real) + a light
  // live shimmer + limb darkening + an emissive boost so it glows like a star.
  const sunTexture = useMemo(() => {
    const tex = new TextureLoader().load("/textures/sun-surface.webp")
    tex.colorSpace = SRGBColorSpace
    return tex
  }, [])
  const sunSurfUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSunTex: { value: sunTexture },
      uIntensity: { value: invert ? 1.0 : 1.5 },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  useEffect(() => {
    sunSurfUniforms.uIntensity.value = invert ? 1.0 : 1.5
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
// Reusable vectors for the Earth day/night shader's sun-direction uniform.

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
