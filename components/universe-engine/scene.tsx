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
import { Html } from "@react-three/drei"
import { BrightStarField } from "./bright-star-field"
import { NamedStarHoverLayer } from "./named-star-hover-layer"
import { BrightStarPicker } from "./bright-star-picker"
import { NearbyStars3D } from "./nearby-stars-3d"
import { GravityOverlay } from "./gravity-overlay"
import { TrajectoryTrails } from "./trajectory-trails"
import { SphereOfInfluence } from "./sphere-of-influence"

// The black-hole GLB (13 MB) loads on first hover/focus engagement, not at
// module init — the fly-to flight time hides the download.
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  FogExp2,
  Mesh,
  NormalBlending,
  ShaderMaterial,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
} from "three"
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib"

import {
  ASTEROID_BELT_INFO,
  GALACTIC_PLANE_TILT_RAD,
  KUIPER_BELT_INFO,
  SOLAR_SYSTEM_POSITION,
  SUN_INFO,
  TIME_WARP_DAYS_PER_SEC,
  blackHoleHorizonGravityMetersPerSec2,
  buildScenePlanets,
  compressRadius,
  SCENE_SCALE,
  cancelFollow,
  flyToRef,
  followRef,
  raDecToScenePos,
  requestFlyTo,
  simTimeRef,
  skyPoints,
  timeWarpRef,
  timeScaleRef,
  focusDepthRef,
  DEFAULT_CAMERA_NEAR,
  DEFAULT_CAMERA_FAR,
  DEFAULT_MIN_DISTANCE,
} from "./astronomy"

import {
  CORONA_VERTEX_SHADER,
  CORONA_FRAGMENT_SHADER,
  SUN_SURFACE_VERTEX_SHADER,
  SUN_SURFACE_FRAGMENT_SHADER,
  ZODIACAL_VERTEX_SHADER,
  ZODIACAL_FRAGMENT_SHADER,
} from "./shaders"
import { makeFocusHandler, parseDistanceLy, skyDepthRadius } from "./scene-shared"
import { ClusterDetail, ClusterStarField, isGlobular } from "./cluster-detail"
import { SkyPanorama } from "./sky-panorama"
import { OrbitRing } from "./orbit-ring"
import { PlanetBody } from "./planet-body"
import { NamedBodies } from "./small-bodies"
import {
  NebulaDetail,
  VolumetricNebula,
  NEBULA_SPRITES,
  VOLUMETRIC_NEBULAE,
} from "./nebula"
import { BlackHoleDetail, computeBlackHoleProportions } from "./black-hole"
import { GalaxyDetail, Galaxy3D, GalaxySprite, GALAXY_3D, BESPOKE_GALAXY_IDS, ProceduralGalaxy } from "./galaxy"
import { Constellations } from "./constellations"
import { ExoplanetSystem, PulsarDetail } from "./star-details"
import { MilkyWay } from "./milky-way"
import { Belt, BeltAsteroids } from "./belt"
import { ShootingStars } from "./shooting-stars"

import {
  getPulsarDynamicProfile,
  getSkyAffordance,
  getStarDynamicProfile,
} from "./celestial-sub-engine"
import type {
  HoverHandler,
  SkyPoint,
} from "./types"

/* Belt radii, DERIVED from real AU via compressRadius so they track SCENE_SCALE
 * automatically (was hardcoded to SCENE_SCALE=3 values, which drifted out of the
 * planets when the scale changed). Asteroid belt 2.1–3.3 AU, Kuiper 30–50 AU. */
const AST_BELT_INNER = compressRadius(2.1)
const AST_BELT_OUTER = compressRadius(3.3)
const KUIPER_BELT_INNER = compressRadius(30)
const KUIPER_BELT_OUTER = compressRadius(50)

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
const _flyApproachDir = new Vector3()
// Chase-frame scratch (orbital-frame follow): travel dir, radial up, sideways.
const _chT = new Vector3()
const _chUp = new Vector3()
const _chS = new Vector3()
const _chOff = new Vector3()
// Remembers that WE turned auto-rotate off for a follow (vs it being off
// by prop), so it's restored exactly when the chase ends.
let _autoRotateSuspended = false
// Gentle-drift scratch + a "the user is grabbing the camera" flag so the drift
// yields to interaction and never fights a drag/zoom.
const _driftOff = new Vector3()
const _driftAxis = new Vector3(0, 1, 0)
let _userGrabbing = false
let _grabReleaseAt = 0

function FlyToController({ interactive }: { interactive: boolean }) {
  const { camera, controls, gl } = useThree() as unknown as {
    camera: import("three").PerspectiveCamera
    controls: OrbitControlsImpl | null
    gl: import("three").WebGLRenderer
  }

  // Track when the user is actively driving the camera, so the gentle drift
  // yields to them and resumes a beat after they let go (no jarring snap-back).
  useEffect(() => {
    const el = gl.domElement
    const grab = () => { _userGrabbing = true }
    const release = () => { _userGrabbing = false; _grabReleaseAt = performance.now() }
    // SNAP OUT ON PINCH/ZOOM OUT: while following a satellite, a decisive zoom-OUT
    // gesture releases the chase and reframes Earth — so pinching out cleanly
    // returns you to the overview instead of drifting into empty space.
    let zoomOutAccum = 0
    const onWheel = (e: WheelEvent) => {
      _userGrabbing = true; _grabReleaseAt = performance.now()
      const follow = followRef.current
      if (follow && follow.frame) {                 // only for a satellite chase
        if (e.deltaY > 0) {                          // zoom OUT
          zoomOutAccum += e.deltaY
          if (zoomOutAccum > 240) {                  // decisive, not a nudge
            zoomOutAccum = 0
            cancelFollow()
            window.dispatchEvent(new CustomEvent("universe:sky-focus", { detail: { pointId: "planet:Earth" } }))
          }
        } else {
          zoomOutAccum = 0                            // zoom-in resets the accumulator
        }
      } else {
        zoomOutAccum = 0
      }
    }
    el.addEventListener("pointerdown", grab)
    window.addEventListener("pointerup", release)
    el.addEventListener("wheel", onWheel, { passive: true })
    return () => {
      el.removeEventListener("pointerdown", grab)
      window.removeEventListener("pointerup", release)
      el.removeEventListener("wheel", onWheel)
    }
  }, [gl])

  useFrame((_, delta) => {
    if (!controls) return
    // Drift is allowed only when the user isn't driving AND a ~2.5 s cool-down
    // after their last input has elapsed (so it never snaps back on release).
    const driftAllowed = !_userGrabbing && (!_grabReleaseAt || performance.now() - _grabReleaseAt > 2500)

    // Per-focus deep-zoom: tighten the near-plane + zoom floor while a tiny body
    // (a satellite) is focused so the camera can dolly up to a true-1:1 craft;
    // restore the defaults the moment focus clears. Only touch the camera when a
    // value actually changes (updateProjectionMatrix isn't free).
    const fd = focusDepthRef.current
    const wantNear = fd ? fd.near : DEFAULT_CAMERA_NEAR
    const wantMin = fd ? fd.minDistance : DEFAULT_MIN_DISTANCE
    // Pull FAR in during a satellite close-follow so the linear depth buffer's
    // precision concentrates near the craft (kills z-fighting vs Earth's limb);
    // restore the full 3000 for everything else so distant stars still draw.
    const wantFar = fd && fd.far ? fd.far : DEFAULT_CAMERA_FAR
    if (camera.near !== wantNear || camera.far !== wantFar) {
      camera.near = wantNear
      camera.far = wantFar
      camera.updateProjectionMatrix()
    }
    if (controls.minDistance !== wantMin) controls.minDistance = wantMin

    const follow = followRef.current
    // Defense: auto-rotate during a chase gets baked into the re-recorded
    // chase offset every frame and compounds into a corkscrew around the
    // target ("the whole engine goes into a spiral"). Hard-off while any
    // follow is active; restored the moment it ends.
    if (follow && controls.autoRotate) {
      _autoRotateSuspended = true
      controls.autoRotate = false
    } else if (!follow && _autoRotateSuspended) {
      _autoRotateSuspended = false
      controls.autoRotate = true
    }
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
        // CINEMATIC fly-in. The target JUMPS to the body each frame (no lerp) so
        // look-at is locked from frame 1 even for a fast inner planet; only the
        // camera DISTANCE + view DIRECTION are animated — with an ease-IN-OUT so
        // the move accelerates smoothly from rest, cruises, then decelerates into
        // the frame, instead of the old exp() ease-out that lurched fast then
        // crawled. Progress is time-based (≈1.15 s) so every craft arrives with the
        // same designed pacing regardless of how far the camera started.
        controls.target.copy(_flyTargetVec)
        _flyCamDir.copy(camera.position).sub(controls.target)
        const currentDist = _flyCamDir.length()
        if (currentDist < 1e-4) {
          _flyCamDir.set(0.6, 0.4, 1).normalize()
        } else {
          _flyCamDir.normalize()
        }

        // Capture the starting distance once, at the first fly-in frame.
        if (follow.flyStartDist == null) {
          follow.flyStartDist = currentDist
          follow.flyElapsed = 0
        }
        follow.flyElapsed = (follow.flyElapsed ?? 0) + delta
        // Distance-aware pacing: short hops stay snappy (~1.15 s floor), but a
        // long crossing of the (now 2× larger) system stretches so it reads as
        // a RIDE across real distance, not a teleport — capped at 2.6 s so it
        // never drags. Span = how far the camera actually travels this fly.
        const flySpan = Math.abs((follow.flyStartDist ?? currentDist) - follow.distance)
        const FLY_DURATION = Math.min(2.6, 1.15 + flySpan * 0.02)
        const t = Math.min(1, follow.flyElapsed / FLY_DURATION)
        // smootherstep (6t⁵−15t⁴+10t³): zero velocity AND acceleration at both
        // ends — the signature "eased" camera move.
        const s = t * t * t * (t * (t * 6 - 15) + 10)

        // Vantage swing: ease the view direction toward the chosen approach dir on
        // the SAME eased curve (slightly ahead so it settles before arrival).
        let dirErr = 0
        if (follow.approachDir) {
          _flyApproachDir.set(follow.approachDir.x, follow.approachDir.y, follow.approachDir.z).normalize()
          const sDir = Math.min(1, s * 1.25)
          _flyCamDir.copy(camera.position).sub(controls.target).normalize()
          _flyCamDir.lerp(_flyApproachDir, sDir).normalize()
          dirErr = _flyCamDir.angleTo(_flyApproachDir)
        }

        // Distance eases from the captured start to the target along the curve.
        const nextDist = follow.flyStartDist + (follow.distance - follow.flyStartDist) * s
        _flyDesiredCamPos.copy(controls.target).addScaledVector(_flyCamDir, nextDist)
        camera.position.copy(_flyDesiredCamPos)

        // Arrival: the eased progress has essentially completed AND (if a vantage
        // swing was requested) the direction has settled. Time-based completion
        // means it always lands cleanly, no lingering micro-settle.
        if (t >= 0.999 && dirErr < 0.06) {
          follow.arrived = true
        }
      } else {
        // Arrived — track the moving target without overriding camera
        // distance.
        const fr = follow.frame ? follow.frame() : null
        if (fr) {
          // ORBITAL-FRAME chase (satellites): the camera should ride in the
          // craft's travel frame so "behind" stays behind as it sweeps its orbit —
          // BUT the user must still be able to zoom + drag freely. So we DON'T
          // hard-set the camera from a stored offset (that overwrote the user's
          // scroll each frame → "can't zoom"). Instead:
          //   1. shift the camera by the SAME delta the target moved (preserves
          //      the exact offset OrbitControls manages — user zoom/drag intact),
          //   2. then re-orient that offset into the craft's rotating travel frame
          //      so the chase framing holds around the orbit.
          _chT.set(fr.t.x, fr.t.y, fr.t.z).normalize()
          _chUp.set(fr.up.x, fr.up.y, fr.up.z)
          _chUp.addScaledVector(_chT, -_chT.dot(_chUp)).normalize()
          _chS.crossVectors(_chT, _chUp)

          // Current camera offset from the (old) target, decomposed into the
          // PREVIOUS travel frame — its magnitude is the user's chosen distance.
          _chOff.copy(camera.position).sub(controls.target)
          const prev = follow.chaseFrame
          const lx = prev ? (_chOff.x * prev.s.x + _chOff.y * prev.s.y + _chOff.z * prev.s.z) : _chOff.dot(_chS)
          const ly = prev ? (_chOff.x * prev.up.x + _chOff.y * prev.up.y + _chOff.z * prev.up.z) : _chOff.dot(_chUp)
          const lz = prev ? (_chOff.x * prev.t.x + _chOff.y * prev.t.y + _chOff.z * prev.t.z) : _chOff.dot(_chT)

          // Rebuild the offset in the NEW travel frame (same local components →
          // "behind" stays behind), preserving the user's zoom distance + angle.
          controls.target.copy(_flyTargetVec)
          camera.position.copy(_flyTargetVec)
            .addScaledVector(_chS, lx)
            .addScaledVector(_chUp, ly)
            .addScaledVector(_chT, lz)
          // Remember this frame's basis so next frame's decompose is consistent,
          // and let OrbitControls apply the user's zoom/drag on top.
          follow.chaseFrame = { s: _chS.clone(), up: _chUp.clone(), t: _chT.clone() }
          controls.update()
          return
        }
        // Planets/comets: OrbitControls preserves the user's spherical
        // offset (radius + angles), so as the body sweeps through
        // space the camera slides along with it while drag/zoom
        // respond to input normally. We move target + camera by the
        // same per-frame delta so the *offset* OrbitControls reads
        // stays unchanged frame to frame.
        const targetDelta = _flyTargetVec.clone().sub(controls.target)
        controls.target.copy(_flyTargetVec)
        camera.position.add(targetDelta)
        // Gentle life: a very slow contemplative orbit around the body so the view
        // BREATHES instead of sitting dead-still (the celestial Earth-follow had no
        // auto-rotate). Paused while the user drives + a cool-down after.
        if (interactive && driftAllowed) {
          _driftOff.copy(camera.position).sub(controls.target)
          _driftOff.applyAxisAngle(_driftAxis, delta * 0.02) // ~0.02 rad/s = a slow drift
          camera.position.copy(controls.target).add(_driftOff)
        }
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
      // like Pale Blue Dot and the black holes' above-the-disk approach.
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

    // Headless-test / debug readout: real camera + fly state, no guessing.
    if (typeof window !== "undefined") {
      ;(window as unknown as { __ueFly?: object }).__ueFly = {
        cam: [camera.position.x, camera.position.y, camera.position.z],
        target: [controls.target.x, controls.target.y, controls.target.z],
        want: state.cameraPos ? [state.cameraPos.x, state.cameraPos.y, state.cameraPos.z] : null,
        dist: state.distance,
        active: state.active,
        targetErr,
      }
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

/* ============================================================
 * Planets + Sun + Orbit Rings
 * ============================================================ */



/**
 * Zodiacal light — the faint glow of sunlight scattered off the interplanetary
 * dust disc in the ecliptic plane. A real, previously-missing phenomenon: it
 * fills the space between the planets with a diffuse triangular glow, brightest
 * near the Sun (forward-scattering), with a faint gegenschein opposite it.
 *
 * A large flat disc in the local x–z plane (the scene's ecliptic), centred on
 * the Sun at the group origin. The shader shapes the brightness; here we just
 * feed it the live camera position + time and fade it by proximity so it only
 * shows once the viewer is actually inside the solar system (never from the
 * far galaxy hero, where it would be physically wrong to see it).
 *
 * Deliberately dim + additive — reverence over spectacle; it must never
 * compete with a planet or the corona.
 */
function ZodiacalLight({ invert }: { invert: boolean }) {
  const meshRef = useRef<Mesh>(null)
  const matRef = useRef<ShaderMaterial>(null)
  // Scales with SCENE_SCALE so the dust disc always reaches the giant planets
  // (was a fixed 13, calibrated at scale 3 — after the 2× space bump Jupiter/
  // Saturn fell OUTSIDE it). 4.3×scale ≈ out to Saturn's orbit at any scale.
  const RADIUS = SCENE_SCALE * 4.3 // scene units — covers the inner + giant planets
  const _localCam = useMemo(() => new Vector3(), [])
  const uniforms = useMemo(
    () => ({
      uColor: { value: new Color(invert ? "#e8d8b0" : "#fff0d8") },
      uOpacity: { value: 0 },
      uRadius: { value: RADIUS },
      uTime: { value: 0 },
      uCamPos: { value: new Vector3() },
    }),
    [invert],
  )

  useFrame((state, delta) => {
    const m = matRef.current
    const mesh = meshRef.current
    if (!m || !mesh) return
    m.uniforms.uTime.value += delta
    // Camera position in THIS MESH's local frame (Sun at local origin), so the
    // shader's sunward geometry is correct regardless of world placement and
    // the mesh's own -π/2 tilt. worldToLocal mutates in place → copy first.
    _localCam.copy(state.camera.position)
    mesh.worldToLocal(_localCam)
    m.uniforms.uCamPos.value.copy(_localCam)

    // Proximity fade: the dust glow is only realistic when you're within the
    // planetary region. Fade from ~0 far out to full when the camera is within
    // a few disc-radii of the Sun. Very low ceiling so it stays a whisper.
    const dist = _localCam.length()
    const near = 1 - smoothstepScalar(RADIUS * 0.6, RADIUS * 2.4, dist)
    const target = near * (invert ? 0.10 : 0.16)
    m.uniforms.uOpacity.value += (target - m.uniforms.uOpacity.value) * Math.min(1, delta * 2)
  })

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} renderOrder={-2}>
      {/* Flat disc in x–z once rotated; high enough segments for smooth radial falloff. */}
      <circleGeometry args={[RADIUS, 96]} />
      <shaderMaterial
        ref={matRef as React.Ref<ShaderMaterial>}
        vertexShader={ZODIACAL_VERTEX_SHADER}
        fragmentShader={ZODIACAL_FRAGMENT_SHADER}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={invert ? NormalBlending : AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  )
}

/** Scalar smoothstep (GLSL semantics) for the proximity fade above. */
function smoothstepScalar(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
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
  // Outer corona softened: the Fresnel rim at radius 1.05 was reading as a hard
  // grey/tan RING around the Sun on zoom-out. Lower intensity so it's a faint
  // diffuse halo, not a visible circle. (uPower raised below tightens it too.)
  const coronaOuterOpacity = invert ? 0.16 : 0.19
  const pointLightIntensity = invert ? 0.5 : 3.5

  // Corona colour: WARM in both themes. The dark-space Sun read too white/cold
  // after the ring-softening pass ("Sun was good earlier orange"); a stellar
  // corona is not white — the inner glow is a hot amber-gold and the outer halo
  // fades to a soft orange. This restores the fiery look without bringing back
  // the hard grey ring (that was a falloff-shape problem, fixed via uPower).
  const coronaInnerUniforms = useMemo(
    () => ({
      uColor: { value: new Color(invert ? "#c95824" : "#ffb24d") },
      uIntensity: { value: coronaInnerOpacity },
      uPower: { value: 3.0 },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const coronaOuterUniforms = useMemo(
    () => ({
      uColor: { value: new Color(invert ? "#e5a878" : "#ff7a2e") },
      uIntensity: { value: coronaOuterOpacity },
      uPower: { value: 2.4 },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  // Keep uniform colour in sync with theme changes without recreating the
  // uniforms object (which would break the animated intensity lerp).
  useEffect(() => {
    coronaInnerUniforms.uColor.value.set(invert ? "#c95824" : "#ffb24d")
    coronaOuterUniforms.uColor.value.set(invert ? "#e5a878" : "#ff7a2e")
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
        {/* Outer corona trimmed 1.3 → 1.05: at the compressed inner-system scale
            (Earth only ~3 units out) the wide glow crowded Mercury/Venus and read
            as bodies "colliding" with the Sun on zoom-out. Tighter halo = the inner
            planets breathe. */}
        <sphereGeometry args={[1.05, 48, 48]} />
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
      {/* Sunlight reach scales with SCENE_SCALE so every planet stays lit no
          matter the spacing — distance 20×scale reaches past the Kuiper belt
          (was a fixed 60 that went dark on the outer planets after the 2× space
          bump). Keeps the engine consistent when the scale changes. */}
      <pointLight position={[0, 0, 0]} intensity={pointLightIntensity} distance={SCENE_SCALE * 20} color="#ffffff" decay={1.3} />

      {/* Zodiacal light — faint sunlit-dust glow in the ecliptic plane, so the
          space between the planets reads as a real dust disc, not black void.
          Renders under the planets; fades in only when the camera is inside
          the planetary region. */}
      <ZodiacalLight invert={invert} />

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

      {/* Asteroid Belt — 2.1–3.3 AU, radii derived from compressRadius. */}
      <Belt
        innerRadius={AST_BELT_INNER}
        outerRadius={AST_BELT_OUTER}
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
            innerRadius={AST_BELT_INNER}
            outerRadius={AST_BELT_OUTER}
            count={mobile ? 26 : 48}
            thickness={0.12}
            rotationSpeed={0.05}
            baseScale={0.012}
            seed={7}
          />
        </Suspense>
      )}

      {/* Kuiper Belt — 30–50 AU, radii derived from compressRadius. */}
      <Belt
        innerRadius={KUIPER_BELT_INNER}
        outerRadius={KUIPER_BELT_OUTER}
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
            innerRadius={KUIPER_BELT_INNER}
            outerRadius={KUIPER_BELT_OUTER}
            count={mobile ? 16 : 30}
            thickness={0.35}
            rotationSpeed={0.012}
            baseScale={0.02}
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

// parseDistanceLy + skyDepthRadius moved to scene-shared.ts — the merged
// ClusterStarField needs the same distance→depth math to sit exactly on
// each cluster's glow.

// Black holes: approach from ≥ ~20° above the disk plane. An in-plane
// arrival (common when flying out from the solar system) sees the razor-thin
// disk exactly edge-on and the whole show collapses to a hairline —
// Interstellar framed Gargantua from above the plane for the same reason.
// Viewing angle is presentation; the physics stays untouched.
function blackHoleVantage(
  camPos: Vector3,
  target: { x: number; y: number; z: number },
  dist: number,
): { x: number; y: number; z: number } {
  const dir = new Vector3(
    camPos.x - target.x,
    camPos.y - target.y,
    camPos.z - target.z,
  )
  if (dir.lengthSq() < 1e-6) dir.set(0.6, 0.4, 1)
  dir.normalize()
  // ~30° elevation: high enough that the disk presents as a plate (20° left
  // it foreshortened into a sliver), low enough to keep the lensed far-side
  // arcs over the shadow.
  if (Math.abs(dir.y) < 0.5) {
    dir.y = dir.y >= 0 ? 0.5 : -0.5
    dir.normalize()
  }
  return {
    x: target.x + dir.x * dist,
    y: target.y + dir.y * dist,
    z: target.z + dir.z * dist,
  }
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
  const camera = useThree((s) => s.camera)
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
      if (id !== point.id) {
        setFocused(false)
        return
      }
      // Event targeted at THIS point from outside the scene (Jump-to menu,
      // assistant tools). A direct click already set focused + flew; doing it
      // here too is idempotent, and it makes every deep-sky id addressable on
      // the same channel planets ("planet:X") and comets ("named:X") already
      // use — previously these ids had no handler, so jumping to a cluster or
      // nebula silently did nothing.
      setFocused(true)
      const [wx, wy, wz] = raDecToScenePos(
        point.raHours,
        point.decDeg,
        skyDepthRadius(point.distance),
      )
      const target = { x: wx, y: wy, z: wz }
      const dist =
        point.kind === "exoplanet-host" || point.kind === "star"
          ? 4
          : point.kind === "nebula"
            ? Math.max((point.visualSize ?? 2) * 6, 12) // frame the cloud, don't sit inside it
            : point.kind === "black-hole"
              // Frame from the physics: far enough out that the shadow +
              // lensed disk both fit, whatever the mass/spin.
              ? Math.max(computeBlackHoleProportions(point.massSolar ?? 1e8, point.spin ?? 0, point.visualSize ?? 2).shadowR * 5, 8)
              : Math.max((point.visualSize ?? 2) * 3.5, 9)
      requestFlyTo(
        target,
        dist,
        point.name,
        point.kind === "black-hole"
          ? { cameraPos: blackHoleVantage(camera.position, target, dist) }
          : undefined,
      )
    }
    window.addEventListener("universe:sky-focus", onSkyFocus)
    return () => window.removeEventListener("universe:sky-focus", onSkyFocus)
  }, [point.id, point.raHours, point.decDeg, point.distance, point.kind, point.visualSize, point.name])
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
  // Galaxies that resolve via the generic morphology-driven model: everything
  // except the bespoke headliners + the Blender-baked 3D discs, IF OpenNGC
  // actually classified them (no morphology → keep the honest halo).
  const galaxyResolves =
    point.kind === "galaxy" &&
    !GALAXY_3D[point.id] &&
    !BESPOKE_GALAXY_IDS.has(point.id) &&
    Boolean(point.morphology)

  useFrame((_, delta) => {
    // Clusters + morphology-resolving galaxies: the fuzzy glow is UNRESOLVED
    // light. When the real structure resolves on hover/focus (ClusterDetail /
    // ProceduralGalaxy), the glow dissolves to a faint remnant — otherwise a
    // loose open cluster (M37) or a sparse spiral keeps reading as a blob
    // underneath its own resolved stars. Eased, not switched.
    if (point.kind === "cluster" || galaxyResolves) {
      if (invert) return
      const k = 1 - Math.exp(-delta * 5)
      const coreMat = starCoreMatRef.current
      if (coreMat) {
        const target = skyAffordance.coreOpacity * (detailActive ? 0.12 : 1)
        coreMat.opacity += (target - coreMat.opacity) * k
      }
      const haloMat = starHaloMatRef.current
      if (haloMat) {
        const target = skyAffordance.haloOpacity * (detailActive ? 0.1 : 1)
        haloMat.opacity += (target - haloMat.opacity) * k
      }
      return
    }
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
            ref={(point.kind === "star" || isPulsar || galaxyResolves) ? (starHaloMatRef as React.Ref<import("three").MeshBasicMaterial>) : undefined}
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
            ref={(point.kind === "star" || isPulsar || point.kind === "cluster" || galaxyResolves) ? (starCoreMatRef as React.Ref<import("three").MeshBasicMaterial>) : undefined}
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
        <NebulaDetail
          pointId={point.id}
          size={visualSize}
          hovered={detailActive}
          invert={invert}
          nebulaType={point.nebulaType}
        />
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
      {/* Galaxy hover detail — bespoke hand-tuned models for the headliners
          (Andromeda + companions, Triangulum, Whirlpool…). */}
      {point.kind === "galaxy" && (
        <GalaxyDetail pointId={point.id} size={visualSize} hovered={detailActive} invert={invert} />
      )}
      {/* Every OTHER catalog galaxy resolves too — point-cloud built from its
          real OpenNGC Hubble morphology (spiral/barred/elliptical/lenticular/
          irregular), inclined by its measured axis ratio, rotated to its
          catalog position angle. Galaxies with no classification keep the
          halo — the engine doesn't invent shapes. */}
      {galaxyResolves && (
        <ProceduralGalaxy
          morphology={point.morphology}
          axisRatio={point.axisRatio}
          posAngDeg={point.posAngDeg}
          size={visualSize}
          active={detailActive}
          invert={invert}
        />
      )}
      {/* Black-hole hover detail — Sketchfab "Blackhole" by rubykamen
          (CC-BY-4.0) GLB, restored 2026-07-17 on Ankur's call after the
          raymarch experiment ("the GLB was better"). The GLSL null-geodesic
          raymarcher lives in git history (3c54d13e) with its remaining
          units bug diagnosed — candidate to return once it beats the GLB. */}
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
      {/* Cluster resolve — on hover/focus the cluster stops being a glow and
          RESOLVES into its member stars (Plummer profile + honest population
          colours, revealed core-outward like a telescope pulling focus). The
          idle sprinkle for every cluster lives in the merged ClusterStarField.
          Chart mode keeps a small ink spray instead — additive points don't
          read on paper. */}
      {point.kind === "cluster" && !invert && (
        <ClusterDetail
          pointId={point.id}
          fact={point.fact}
          size={visualSize}
          active={detailActive}
        />
      )}
      {point.kind === "cluster" && invert && (
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
                blending={NormalBlending}
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
            point.kind === "cluster"    ? (isGlobular(point.fact) ? "Globular cluster" : "Open cluster") :
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
          // Skip the catalog's "—" placeholder — "Distance · —" reads broken.
          const factWithDistance = point.distance && point.distance !== "—"
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
                const clickTarget = { x: world.x, y: world.y, z: world.z }
                const clickDist =
                  point.kind === "exoplanet-host" || point.kind === "star"
                    ? 4
                    : point.kind === "nebula"
                      ? Math.max(visualSize * 6, 12) // frame the cloud, don't sit inside it
                      : point.kind === "black-hole"
                        // Frame from the physics — shadow + lensed disk fit.
                        ? Math.max(computeBlackHoleProportions(point.massSolar ?? 1e8, point.spin ?? 0, visualSize).shadowR * 5, 8)
                        : Math.max(visualSize * 3.5, 9)
                requestFlyTo(
                  clickTarget,
                  clickDist,
                  point.name,
                  point.kind === "black-hole"
                    ? { cameraPos: blackHoleVantage(camera.position, clickTarget, clickDist) }
                    : undefined,
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
      {/* Idle member stars for all ~395 catalog clusters, merged into ONE
          points draw — the fuzzy cluster glows granulate into real star
          sprinkles (globulars warm/old, open clusters blue/young). Replaces
          the old per-cluster 7-sphere spray (~2,800 draw calls → 1). */}
      {!solarOnly && !invert && <ClusterStarField mobile={mobile} />}
      {/* The real photographic sky (ESO/Brunier 360° panorama, CC BY 4.0) —
          actual dust lanes, star clouds and the Magellanic Clouds, mapped
          through the true J2000 galactic→equatorial rotation. Visible from
          the solar-system vantage; fades out as the camera flies to deep-sky
          distances where the 3D galaxy model takes over. */}
      {!solarOnly && !invert && <SkyPanorama mobile={mobile} />}

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
