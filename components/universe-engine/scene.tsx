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
import { Clone, Html, Stars, useGLTF } from "@react-three/drei"

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
import { CONSTELLATION_FIGURES } from "./constellation-figures"
import { SPACECRAFT_SHAPES } from "./spacecraft-shapes"
import type {
  Constellation,
  ConstellationId,
  ConstellationStar,
  HoverHandler,
  MoonData,
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
}: {
  moon: MoonData
  onHover: HoverHandler
  /** Set by the parent planet's hover state — gives the moon a coordinated scale-up + halo. */
  highlighted?: boolean
  /** When true, clicks engage follow mode on the moon. Same gesture as planets + comets. */
  interactive?: boolean
}) {
  const orbitRef = useRef<Group>(null)
  const bodyRef = useRef<Mesh>(null)
  const haloRef = useRef<Mesh>(null)
  const haloMatRef = useRef<import("three").MeshBasicMaterial>(null)
  const texMatRef = useRef<import("three").MeshStandardMaterial>(null)
  const [texture, setTexture] = useState<Texture | null>(null)

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
    // Texture overlay is always-on — fades in as soon as the JPEG lands so
    // the moon reads as a real photographed surface, not a chart marker.
    if (texMatRef.current) {
      const target = texture ? 1 : 0
      texMatRef.current.opacity += (target - texMatRef.current.opacity) * k
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
            map. Slightly larger to z-fight-cleanly above the grey marker,
            and lerps in only when the parent planet is highlighted. */}
        {textureUrl && texture && (
          <mesh>
            <sphereGeometry args={[moon.visualRadius * 1.01, 48, 48]} />
            <meshStandardMaterial
              ref={texMatRef as React.Ref<import("three").MeshStandardMaterial>}
              map={texture}
              roughness={0.95}
              metalness={0.0}
              transparent
              opacity={0}
              depthWrite={false}
            />
          </mesh>
        )}
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
      {constellation.stars.map((star) => (
        <ConstellationStarMesh
          key={star.name}
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

  useEffect(() => {
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
    if (orbitRef.current) orbitRef.current.rotation.y += delta * planet.orbitalSpeedRadPerSec * tw
    if (meshRef.current) meshRef.current.rotation.y += delta * visibleRotSpeed * tw

    // Eccentric-orbit planets (Pluto e=0.244, Mercury e=0.206) vary their
    // orbital distance with current phase to follow the elliptical ring.
    // Uses true-anomaly polar form r(θ) = a(1-e²)/(1+e·cosθ) — same shape
    // the OrbitRing renders, so body and path stay aligned. Kepler's 2nd
    // law (faster at perihelion) is approximated by uniform progression in
    // true anomaly; visually correct for our time-warp range.
    if (useEllipticalOrbit && positionRef.current && orbitRef.current) {
      const theta = orbitRef.current.rotation.y
      const r = (planet.orbitRadius * (1 - eccentricity * eccentricity)) /
                (1 + eccentricity * Math.cos(theta))
      positionRef.current.position.x = r
    }

    // Textured sphere rotates in lockstep with the grey one underneath so
    // surface features (Earth's continents, Jupiter's bands, Saturn's
    // stripes) drift naturally as time advances.
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
                in on hover OR focus. */}
            {hasTexture && texture && (
              <mesh ref={texMeshRef}>
                <sphereGeometry args={[
                  planet.visualRadius * 1.005,
                  planet.raw.name === "Earth" ? 96 : 64,
                  planet.raw.name === "Earth" ? 96 : 64,
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
function orbitalElementsToCartesian(
  a: number,
  e: number,
  trueAnomaly: number,
  inclination: number,
  longNode: number,
  argPeri: number,
): [number, number, number] {
  const r = (a * (1 - e * e)) / (1 + e * Math.cos(trueAnomaly))
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
  const [isHovered, setIsHovered] = useState(false)

  // Pre-compute everything time-independent: orbital scale, tilt, base colour.
  const config = useMemo(() => {
    const a = Math.sqrt(body.aAU) * 3 // scene-scale semi-major axis
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

    return { a, e, inclination, longNode, argPeri, visualRadius, angularSpeed, phase, shade, isLoop: isFinite(body.periodYears) }
  }, [body])

  // Pre-compute a thin trail of orbit positions so each body draws a
  // dotted ellipse behind it, hinting at the path. Uses the same full
  // orbital-element transform as the per-frame position below, so the
  // body always sits on its trail.
  const trailGeometry = useMemo(() => {
    const STEPS = config.isLoop ? 90 : 60
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

    const t = config.phase
    const [px, py, pz] = orbitalElementsToCartesian(
      config.a, config.e, t, config.inclination, config.longNode, config.argPeri,
    )
    groupRef.current.position.set(px, py, pz)
  })

  // Hit-zone radius — never smaller than 0.16 so even tiny bodies are
  // findable with a finger or cursor.
  const hitRadius = Math.max(0.16, config.visualRadius * 3)

  return (
    // Both the trail (anchored at the Sun) and the moving body live in the
    // same parent so they share the SolarSystem's coordinate frame.
    <group>
      {/* Orbit trail — thin dotted ellipse traced once at mount, never updated. */}
      <points geometry={trailGeometry}>
        <pointsMaterial
          size={invert ? 0.024 : 0.020}
          sizeAttenuation
          color={invert ? "#1a1208" : config.shade}
          transparent
          opacity={config.isLoop ? (invert ? 0.4 : 0.25) : (invert ? 0.3 : 0.18)}
          depthWrite={false}
        />
      </points>

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

  // Pre-built spiral arm point cloud, sized normalized so the outer
  // group's scale controls absolute size in scene units.
  const armsGeometry = useMemo(() => {
    const count = 1500
    const positions = new Float32Array(count * 3)
    const arms = 2
    const spin = 1.6
    const radius = 1.0
    for (let i = 0; i < count; i++) {
      const r = Math.pow(Math.random(), 1.4) * radius
      const armAngle = ((i % arms) / arms) * Math.PI * 2
      const spinAngle = r * spin * 1.2
      const randomness = 0.20
      const rx = Math.pow(Math.random(), 2.6) * (Math.random() < 0.5 ? 1 : -1) * randomness * r
      const ry = Math.pow(Math.random(), 2.6) * (Math.random() < 0.5 ? 1 : -1) * randomness * r * 0.10
      const rz = Math.pow(Math.random(), 2.6) * (Math.random() < 0.5 ? 1 : -1) * randomness * r
      const i3 = i * 3
      positions[i3]     = Math.cos(armAngle + spinAngle) * r + rx
      positions[i3 + 1] = ry
      positions[i3 + 2] = Math.sin(armAngle + spinAngle) * r + rz
    }
    const geo = new BufferGeometry()
    geo.setAttribute("position", new BufferAttribute(positions, 3))
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

  // Andromeda's apparent inclination is ~77° from face-on. Use that to
  // tilt the disc — almost edge-on but enough to see arms.
  const ANDROMEDA_TILT = 77 * DEG
  // Scene-units scale: idle halo is `size` (=5 for Andromeda); detail
  // blooms to ~3× so the spiral structure reads.
  const detailScale = size * 2.4

  // Arm palette — Andromeda's outer disc skews blue (young stars), inner
  // tilts warmer toward the bulge.
  const armColor = invert ? "#3a1a14" : "#a8c8ff"
  const bulgeColor = invert ? "#5a3416" : "#ffd9b0"
  // Dust lane — a dark band across the disc. We render this as a tilted
  // ring in normalBlending so it actually subtracts visual brightness
  // from the disc behind it. On invert it lifts darker; on dark it
  // creates a brown smudge that reads as dust silhouette.
  const dustColor = invert ? "#0a0a0a" : "#1a0a04"
  const companionColor = invert ? "#3a1d12" : "#ffd9c2"

  return (
    <group ref={rootRef} scale={0.001}>
      {/* Disc — tilted to apparent inclination so the spiral reads as a
          near-edge-on ellipse with a bright bulge. */}
      <group rotation={[ANDROMEDA_TILT, 0, 0]}>
        <group ref={spinRef}>
          {/* Spiral arms point cloud */}
          <points geometry={armsGeometry} scale={detailScale}>
            <pointsMaterial
              ref={armsMatRef as React.Ref<import("three").PointsMaterial>}
              size={detailScale * 0.06}
              sizeAttenuation
              color={armColor}
              transparent
              opacity={0}
              blending={invert ? NormalBlending : AdditiveBlending}
              depthWrite={false}
            />
          </points>
          {/* Bright central bulge — large warm sphere */}
          <mesh>
            <sphereGeometry args={[detailScale * 0.28, 24, 24]} />
            <meshBasicMaterial
              ref={bulgeMatRef as React.Ref<import("three").MeshBasicMaterial>}
              color={bulgeColor}
              transparent
              opacity={0}
              blending={invert ? NormalBlending : AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
          {/* Dust lane — a thin ring across the disc plane that suggests
              the iconic dark band Andromeda is famous for. */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[detailScale * 0.45, detailScale * 0.58, 48]} />
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
      {/* Findability halo — soft glow so the BH spots from sky-shell distance
          (~150 u away) without users having to scan blindly. Sized at 0.5 ×
          detailScale (was 0.9 — bigger halo collided with adjacent sky-points
          like the M87 / TON 618 pair in Virgo). Brightness bumped to keep it
          findable at the smaller radius — favour brightness over girth. */}
      <mesh>
        <sphereGeometry args={[props.detailScale * 0.5, 24, 24]} />
        <meshBasicMaterial
          color={invert ? "#3a2418" : "#ffd6a8"}
          transparent
          opacity={hovered ? (invert ? 0.22 : 0.32) : (invert ? 0.14 : 0.22)}
          blending={invert ? NormalBlending : AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

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
    /* exoplanet-host */                  0.5
  )

  // Per-kind colour palettes. Chart mode (invert) flips to ink-on-cream
  // accents so the halos stay readable.
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
      case "exoplanet-host":
      default:
        return {
          core: invert ? "#b34a13" : "#ffd66b",
          halo: invert ? "#7a3a16" : "#ffb84d",
        }
    }
  }, [point.kind, invert])

  // Hit-zone scales with the visual so even tiny exoplanet dots are findable.
  // Nebulae get a wider zone so the on-hover bloom doesn't fall outside the
  // tracked area and cause flicker as the cursor explores the expanded detail.
  const hitRadius = Math.max(1, visualSize * (point.kind === "nebula" ? 2.6 : 1.4))

  return (
    <group position={position}>
      {/* Diffuse halo — galaxies and nebulae get a soft warm halo. Black
          holes deliberately skip this because BlackHoleDetail renders the
          full Interstellar/Gargantua visualisation always (idle or
          hovered), and a simple halo would muddy it. */}
      {(point.kind === "galaxy" || point.kind === "nebula") && (
        <mesh>
          <sphereGeometry args={[visualSize, 16, 16]} />
          <meshBasicMaterial
            color={palette.halo}
            transparent
            opacity={invert ? 0.18 : 0.22}
            blending={invert ? NormalBlending : AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      )}
      {/* Core — additive glow for galaxies/nebulae/clusters, opaque dot
          for exoplanet hosts. Black holes use the dedicated detail
          component so their horizon shadow is built into that. */}
      {point.kind !== "black-hole" && (
        <mesh>
          <sphereGeometry args={[
            visualSize * (point.kind === "exoplanet-host" ? 1.0 : 0.45),
            14,
            14,
          ]} />
          <meshBasicMaterial
            color={palette.core}
            transparent
            opacity={point.kind === "exoplanet-host" ? 1 : (invert ? 0.55 : 0.55)}
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
                  point.kind === "exoplanet-host" ? 4 : Math.max(visualSize * 3.5, 9),
                  point.name,
                )
              }
            : undefined
        }
      >
        <sphereGeometry args={[hitRadius, 10, 10]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
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
      {/* drei <Stars> is white-only / additive. Drop it in inverted mode and
          let the MilkyWay points carry the field as ink-on-paper instead. */}
      {!invert && (
        <Stars
          radius={400}
          depth={100}
          count={mobile ? 1100 : 2200}
          factor={4}
          saturation={0}
          fade
          speed={enableMotion ? 0.2 : 0}
        />
      )}
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
