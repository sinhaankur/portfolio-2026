"use client"

import { useRef, useMemo, useEffect, useState, useCallback } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { OrbitControls, Stars } from "@react-three/drei"
import {
  AdditiveBlending,
  BufferGeometry,
  BufferAttribute,
  Points,
  Mesh,
  Group,
  FogExp2,
  DoubleSide,
  ShaderMaterial,
} from "three"
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib"
import { GalaxyMusic } from "./galaxy-music"

/* ============================================================
   ASTRONOMICAL POSITIONING (real values, scene-scaled)
   ----------------------------------------------------------
   Real Milky Way diameter:        ~100,000 ly (radius ~52,850 ly)
   Real Sun → galactic center:     ~26,670 ly  (ratio 0.505)
   So in scene units (galaxy radius 130), the Sun sits at ~66.
   ============================================================ */

const GALAXY_RADIUS_SCENE = 130                       // half-width of disc
const SUN_OFFSET_SCENE = 66                            // ~26.7 kly / 52.85 kly ratio
const SOLAR_SYSTEM_POSITION: [number, number, number] = [SUN_OFFSET_SCENE, 0, 0]

/* ============================================================
   TYPES + INFO RECORDS (defined first — referenced by every body)
   ============================================================ */

export type BodyInfo = {
  name: string
  classification: string
  surfaceTempK?: { min?: number; mean: number; max?: number }
  surfaceTempC?: { mean: number }
  aAU?: number
  periodDays?: number
  rotHours?: number
  tiltDeg?: number
  radiusEarth?: number
  moons?: number
  fact?: string
}

type HoverHandler = (info: BodyInfo | null) => void

const MILKY_WAY_INFO: BodyInfo = {
  name: "Milky Way",
  classification: "Barred spiral galaxy · SBbc",
  fact: "~100,000 ly across · 400 billion stars · 4 major arms (Perseus, Sagittarius, Scutum-Centaurus, Norma). Our Sun sits ~26,670 ly from the galactic centre, on the Orion Arm.",
}

const SGR_A_INFO: BodyInfo = {
  name: "Sagittarius A*",
  classification: "Supermassive black hole",
  surfaceTempK: { mean: 0 },
  fact: "Galactic centre. ~4.15 million solar masses, event horizon ~24 million km. The whole Milky Way rotates around it.",
}

const SUN_INFO: BodyInfo = {
  name: "Sun",
  classification: "G2V — Yellow Dwarf",
  surfaceTempK: { mean: 5778 },
  surfaceTempC: { mean: 5505 },
  fact: "Core temperature ≈ 15.7M K. Converts ~4M tonnes of mass into energy every second.",
}

const ASTEROID_BELT_INFO: BodyInfo = {
  name: "Asteroid Belt",
  classification: "Circumstellar disc · 2.2–3.2 AU",
  fact: "Between Mars and Jupiter. ~1.9 million asteroids larger than 1 km — Ceres, Vesta, Pallas, Hygiea hold ~half the total mass. Total mass: ~4% of Earth's Moon.",
}

const KUIPER_BELT_INFO: BodyInfo = {
  name: "Kuiper Belt",
  classification: "Trans-Neptunian disc · 30–50 AU",
  fact: "Home to Pluto, Eris, Makemake, Haumea. Holds short-period comets. Source region for many of the icy bodies that visit the inner solar system.",
}

// Galactic plane is tilted ~60.2° relative to the ecliptic.
// Applied to the Milky Way group so the disc reads correctly from the solar system POV.
const GALACTIC_PLANE_TILT_RAD = 60.2 * (Math.PI / 180)

/* ============================================================
   Small helpers
   ============================================================ */

// Box-Muller — approximate standard-normal sample. Used for galaxy bulge density.
function gauss(): number {
  let u = 0
  let v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

/* ============================================================
   MONOCHROME GALAXY BACKDROP
   ============================================================ */

const GALAXY_VERTEX_SHADER = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  varying float vAlpha;
  uniform float uTime;
  uniform float uPixelRatio;

  void main() {
    vAlpha = aAlpha;
    float twinkle = 0.9 + 0.1 * sin(uTime * 1.2 + position.x * 8.1 + position.z * 5.7);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * twinkle * uPixelRatio * (260.0 / -mv.z);
    gl_PointSize = clamp(gl_PointSize, 0.5, 14.0);
  }
`

const GALAXY_FRAGMENT_SHADER = /* glsl */ `
  varying float vAlpha;
  void main() {
    vec2 uv = gl_PointCoord * 2.0 - 1.0;
    float dist = length(uv);
    if (dist > 1.0) discard;
    float falloff = exp(-3.2 * dist * dist);
    gl_FragColor = vec4(vec3(1.0), falloff * vAlpha);
  }
`

// Milky Way structure: 4 spiral arms (Perseus, Sagittarius, Scutum-Centaurus, Norma),
// dense central bulge, thin disc. Our Sun sits ~26,000 ly out on the Orion Arm.
function MilkyWay({ onHover }: { onHover: HoverHandler }) {
  const pointsRef = useRef<Points>(null)
  const matRef = useRef<ShaderMaterial>(null)
  const { gl } = useThree()

  const geometry = useMemo(() => {
    // 4 spiral arms + central bulge
    const armCount = 14000
    const bulgeCount = 4000
    const total = armCount + bulgeCount
    const positions = new Float32Array(total * 3)
    const sizes = new Float32Array(total)
    const alphas = new Float32Array(total)

    const radius = 130
    const branches = 4
    const spin = 1.3

    // Spiral arms — dimmer so the solar system reads as foreground
    for (let i = 0; i < armCount; i++) {
      const i3 = i * 3
      const r = Math.pow(Math.random(), 1.6) * radius
      const branchAngle = ((i % branches) / branches) * Math.PI * 2
      const spinAngle = r * spin * 0.04

      const randomness = 0.28
      const rx = Math.pow(Math.random(), 2.6) * (Math.random() < 0.5 ? 1 : -1) * randomness * r
      const ry = Math.pow(Math.random(), 2.6) * (Math.random() < 0.5 ? 1 : -1) * randomness * r * 0.12
      const rz = Math.pow(Math.random(), 2.6) * (Math.random() < 0.5 ? 1 : -1) * randomness * r

      positions[i3]     = Math.cos(branchAngle + spinAngle) * r + rx
      positions[i3 + 1] = ry
      positions[i3 + 2] = Math.sin(branchAngle + spinAngle) * r + rz

      const sizeRoll = Math.pow(Math.random(), 3.5)
      sizes[i] = 1.0 + sizeRoll * 5
      const normR = r / radius
      // Significantly dimmed — galaxy is backdrop, not focal point
      alphas[i] = (0.08 + (1 - normR) * 0.25) * (0.5 + Math.random() * 0.5)
    }

    // Central bulge — concentrated but dim from solar-system POV
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
    }

    const geo = new BufferGeometry()
    geo.setAttribute("position", new BufferAttribute(positions, 3))
    geo.setAttribute("aSize", new BufferAttribute(sizes, 1))
    geo.setAttribute("aAlpha", new BufferAttribute(alphas, 1))
    return geo
  }, [])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(gl.getPixelRatio(), 2) },
    }),
    [gl],
  )

  useFrame((_, delta) => {
    if (pointsRef.current) pointsRef.current.rotation.y += delta * 0.008
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
          blending={AdditiveBlending}
        />
      </points>

      {/* Sgr A* — galactic center hover hit-target (invisible) */}
      <mesh
        position={[0, 0, 0]}
        onPointerOver={(e) => {
          e.stopPropagation()
          onHover(SGR_A_INFO)
          document.body.style.cursor = "help"
        }}
        onPointerOut={() => {
          onHover(null)
          document.body.style.cursor = "auto"
        }}
      >
        <sphereGeometry args={[6, 24, 24]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Wider hit zone for "Milky Way" itself — the larger bulge / arm region */}
      <mesh
        position={[0, 0, 0]}
        onPointerOver={(e) => {
          e.stopPropagation()
          onHover(MILKY_WAY_INFO)
          document.body.style.cursor = "help"
        }}
        onPointerOut={() => {
          onHover(null)
          document.body.style.cursor = "auto"
        }}
      >
        <sphereGeometry args={[35, 24, 24]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

/* ============================================================
   PLANET DATA (real astronomical values)
   ============================================================ */

type Planet = {
  name: string
  aAU: number
  radiusEarth: number
  periodDays: number
  tiltDeg: number
  rotHours: number
  inclDeg: number
  startPhase: number
  shade: string
  surfaceTempK: { min?: number; mean: number; max?: number }
  classification: string
  moons: number
  fact?: string
  hasRings?: boolean
}

const planetsData: Planet[] = [
  { name: "Mercury", aAU: 0.387, radiusEarth: 0.383, periodDays: 87.97,   tiltDeg: 0.03,   rotHours: 1407.6, inclDeg: 7.005, startPhase: 0.0, shade: "#7a7a7a", surfaceTempK: { min: 100, mean: 440, max: 700 }, classification: "Terrestrial planet", moons: 0, fact: "No atmosphere. Day side 700 K, night side 100 K — biggest swing in the solar system." },
  { name: "Venus",   aAU: 0.723, radiusEarth: 0.949, periodDays: 224.70,  tiltDeg: 177.4,  rotHours: -5832.5, inclDeg: 3.395, startPhase: 2.1, shade: "#bdbdbd", surfaceTempK: { mean: 737 }, classification: "Terrestrial planet (retrograde)", moons: 0, fact: "Hottest surface — 737 K — runaway CO₂ greenhouse. Rotates backwards on a 243-day day." },
  { name: "Earth",   aAU: 1.000, radiusEarth: 1.000, periodDays: 365.25,  tiltDeg: 23.44,  rotHours: 23.93,  inclDeg: 0.000, startPhase: 4.5, shade: "#dcdcdc", surfaceTempK: { min: 184, mean: 288, max: 330 }, classification: "Terrestrial planet — life", moons: 1, fact: "Mean surface 288 K. Only known planet with liquid water and life." },
  { name: "Mars",    aAU: 1.524, radiusEarth: 0.532, periodDays: 686.97,  tiltDeg: 25.19,  rotHours: 24.62,  inclDeg: 1.850, startPhase: 1.3, shade: "#8e8e8e", surfaceTempK: { min: 130, mean: 210, max: 308 }, classification: "Terrestrial planet", moons: 2, fact: "Thin CO₂ atmosphere, polar ice caps, evidence of ancient liquid water." },
  { name: "Jupiter", aAU: 5.203, radiusEarth: 11.21, periodDays: 4332.59, tiltDeg: 3.13,   rotHours: 9.92,   inclDeg: 1.303, startPhase: 5.8, shade: "#cfcfcf", surfaceTempK: { mean: 165 }, classification: "Gas giant", moons: 95, fact: "Largest planet. 10-hour day. Great Red Spot is a storm wider than Earth." },
  { name: "Saturn",  aAU: 9.537, radiusEarth: 9.449, periodDays: 10759.22,tiltDeg: 26.73,  rotHours: 10.66,  inclDeg: 2.485, startPhase: 3.2, shade: "#bababa", surfaceTempK: { mean: 134 }, classification: "Gas giant", moons: 146, fact: "Ring system spans 282,000 km but is only ~10 m thick.", hasRings: true },
  { name: "Uranus",  aAU: 19.19, radiusEarth: 4.007, periodDays: 30688.50,tiltDeg: 97.77,  rotHours: -17.24, inclDeg: 0.773, startPhase: 0.7, shade: "#a5a5a5", surfaceTempK: { mean: 76 }, classification: "Ice giant (sideways)", moons: 28, fact: "Rotates on its side at 98° tilt — likely from an ancient collision." },
  { name: "Neptune", aAU: 30.07, radiusEarth: 3.883, periodDays: 60182.00,tiltDeg: 28.32,  rotHours: 16.11,  inclDeg: 1.770, startPhase: 2.9, shade: "#8c8c8c", surfaceTempK: { mean: 72 }, classification: "Ice giant", moons: 16, fact: "Coldest planet. Fastest winds — 2,100 km/h. 165-year orbit." },
]

// Base time warp: at multiplier=1, Earth completes one orbit in 24 seconds.
// User slider scales this from 0 (paused) to 3× speed.
const BASE_TIME_WARP_DAYS_PER_SEC = 365.25 / 24

// Mutable singleton ref read inside useFrame — avoids re-render storms when slider moves.
const timeWarpRef = { current: 1.0 }

const TIME_WARP_DAYS_PER_SEC = BASE_TIME_WARP_DAYS_PER_SEC
const DEG = Math.PI / 180

type ScenePlanet = {
  raw: Planet
  orbitRadius: number
  visualRadius: number
  orbitalSpeedRadPerSec: number
  rotSpeedRadPerSec: number
  axialTilt: number
  inclination: number
}

function buildScenePlanets(): ScenePlanet[] {
  return planetsData.map((p) => {
    const orbitRadius = Math.sqrt(p.aAU) * 3
    const visualRadius = Math.sqrt(p.radiusEarth) * 0.2
    const orbitalSpeedRadPerSec = (2 * Math.PI) / (p.periodDays / TIME_WARP_DAYS_PER_SEC)
    const rotSpeedRadPerSec = (2 * Math.PI) / ((p.rotHours / 24) / TIME_WARP_DAYS_PER_SEC)
    return {
      raw: p,
      orbitRadius,
      visualRadius,
      orbitalSpeedRadPerSec,
      rotSpeedRadPerSec,
      axialTilt: p.tiltDeg * DEG,
      inclination: p.inclDeg * DEG,
    }
  })
}

function planetToInfo(p: Planet): BodyInfo {
  return {
    name: p.name,
    classification: p.classification,
    surfaceTempK: p.surfaceTempK,
    surfaceTempC: { mean: Math.round(p.surfaceTempK.mean - 273.15) },
    aAU: p.aAU,
    periodDays: p.periodDays,
    rotHours: p.rotHours,
    tiltDeg: p.tiltDeg,
    radiusEarth: p.radiusEarth,
    moons: p.moons,
    fact: p.fact,
  }
}

/* ============================================================
   MOONS (real data)
   ----------------------------------------------------------
   Visual radii kept small but proportional. Orbit radii scaled
   so they stay close to their parent planet but readable.
   ============================================================ */

type MoonData = {
  name: string
  parent: "Earth" | "Jupiter"
  visualRadius: number    // scene units
  orbitRadius: number     // scene units (relative to parent)
  periodDays: number      // real
  shade: string
  fact: string
}

// Names follow IAU canonical form. Period in real Earth days; negative period = retrograde orbit.
const moons: MoonData[] = [
  { name: "Moon (Luna)",     parent: "Earth",   visualRadius: 0.05,  orbitRadius: 0.42, periodDays: 27.32,  shade: "#bdbdbd", fact: "Earth's only natural satellite. Surface temp −173 to +127 °C. Tidally locked — same face always toward Earth." },
  { name: "Io",              parent: "Jupiter", visualRadius: 0.05,  orbitRadius: 0.95, periodDays: 1.77,   shade: "#cfcfcf", fact: "Most volcanically active body in the solar system — 400+ active volcanoes from tidal heating from Jupiter." },
  { name: "Europa",          parent: "Jupiter", visualRadius: 0.045, orbitRadius: 1.15, periodDays: 3.55,   shade: "#dcdcdc", fact: "Icy crust over a subsurface ocean. One of the best candidates for life beyond Earth." },
  { name: "Ganymede",        parent: "Jupiter", visualRadius: 0.07,  orbitRadius: 1.40, periodDays: 7.15,   shade: "#bababa", fact: "Largest moon in the solar system — bigger than Mercury. Has its own magnetic field." },
  { name: "Callisto",        parent: "Jupiter", visualRadius: 0.065, orbitRadius: 1.75, periodDays: 16.69,  shade: "#9a9a9a", fact: "Most heavily cratered body known. Outermost Galilean moon — sees least of Jupiter's radiation." },
  { name: "Titan",           parent: "Saturn",  visualRadius: 0.08,  orbitRadius: 1.85, periodDays: 15.95,  shade: "#d6c98c", fact: "Saturn's largest moon — bigger than Mercury. Only moon with a thick atmosphere (nitrogen + methane). Has lakes of liquid methane." },
  { name: "Triton",          parent: "Neptune", visualRadius: 0.055, orbitRadius: 0.95, periodDays: -5.88,  shade: "#d8c6b8", fact: "Neptune's largest moon. Orbits BACKWARDS (retrograde) — likely a captured Kuiper Belt object." },
]

function MoonBody({ moon, onHover }: { moon: MoonData; onHover: HoverHandler }) {
  const orbitRef = useRef<Group>(null)
  const speedRadPerSec = useMemo(
    () => (2 * Math.PI) / (moon.periodDays / TIME_WARP_DAYS_PER_SEC),
    [moon.periodDays],
  )
  // Random initial phase so moons don't all line up
  const startPhase = useMemo(() => Math.random() * Math.PI * 2, [])

  useEffect(() => {
    if (orbitRef.current) orbitRef.current.rotation.y = startPhase
  }, [startPhase])

  useFrame((_, delta) => {
    if (orbitRef.current) orbitRef.current.rotation.y += delta * speedRadPerSec * timeWarpRef.current
  })

  const hitRadius = Math.max(moon.visualRadius * 3, 0.12)

  return (
    <group ref={orbitRef}>
      <mesh position={[moon.orbitRadius, 0, 0]}>
        <sphereGeometry args={[moon.visualRadius, 24, 24]} />
        <meshStandardMaterial color={moon.shade} roughness={0.95} />
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
          })
          document.body.style.cursor = "help"
        }}
        onPointerOut={() => {
          onHover(null)
          document.body.style.cursor = "auto"
        }}
      >
        <sphereGeometry args={[hitRadius, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

/* ============================================================
   CONSTELLATIONS — real RA/Dec positions, scaled to a sky-shell
   around the solar system (~150 scene units away).
   Click Polaris (the North Star) to reset the camera view.
   ============================================================ */

type ConstellationStar = {
  name: string
  designation: string
  raHours: number
  decDeg: number
  magnitude: number     // lower = brighter (Vega = 0, naked-eye limit ~6)
}

// Convert RA (hours) + Dec (deg) → Cartesian direction, offset to sit
// around the Sun (solar system POV). Distance is the radius of the sky-shell.
function raDecToScenePos(
  raHours: number,
  decDeg: number,
  distance: number,
): [number, number, number] {
  const raRad = (raHours / 24) * 2 * Math.PI
  const decRad = decDeg * (Math.PI / 180)
  const x = distance * Math.cos(decRad) * Math.cos(raRad)
  const y = distance * Math.sin(decRad)
  const z = distance * Math.cos(decRad) * Math.sin(raRad)
  return [SUN_OFFSET_SCENE + x, y, z]
}

// Magnitude → visual scale. Brighter stars (lower magnitude) get larger spheres.
function magToVisualRadius(mag: number): number {
  // mag 1 → 0.18, mag 3 → 0.10, mag 5 → 0.06
  return Math.max(0.05, 0.22 - mag * 0.04)
}

// The Big Dipper — asterism inside Ursa Major.
// Coordinates from the SIMBAD / Wikipedia database (J2000).
const bigDipper: ConstellationStar[] = [
  { name: "Dubhe",  designation: "α Ursae Majoris", raHours: 11.062, decDeg: 61.751, magnitude: 1.81 },
  { name: "Merak",  designation: "β Ursae Majoris", raHours: 11.030, decDeg: 56.382, magnitude: 2.37 },
  { name: "Phecda", designation: "γ Ursae Majoris", raHours: 11.897, decDeg: 53.694, magnitude: 2.44 },
  { name: "Megrez", designation: "δ Ursae Majoris", raHours: 12.257, decDeg: 57.032, magnitude: 3.31 },
  { name: "Alioth", designation: "ε Ursae Majoris", raHours: 12.900, decDeg: 55.960, magnitude: 1.76 },
  { name: "Mizar",  designation: "ζ Ursae Majoris", raHours: 13.398, decDeg: 54.925, magnitude: 2.23 },
  { name: "Alkaid", designation: "η Ursae Majoris", raHours: 13.792, decDeg: 49.313, magnitude: 1.85 },
]

const polaris: ConstellationStar = {
  name: "Polaris",
  designation: "α Ursae Minoris (North Star)",
  raHours: 2.530,
  decDeg: 89.264,
  magnitude: 1.98,
}

const SKY_SHELL_DISTANCE = 150

function ConstellationStarMesh({
  star,
  onHover,
  onClick,
  isPolaris,
}: {
  star: ConstellationStar
  onHover: HoverHandler
  onClick?: () => void
  isPolaris?: boolean
}) {
  const position = useMemo(
    () => raDecToScenePos(star.raHours, star.decDeg, SKY_SHELL_DISTANCE),
    [star.raHours, star.decDeg],
  )
  const radius = magToVisualRadius(star.magnitude) * (isPolaris ? 1.4 : 1.0)

  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[radius, 16, 16]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      {/* Soft halo */}
      <mesh>
        <sphereGeometry args={[radius * 2.2, 12, 12]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.18} blending={AdditiveBlending} depthWrite={false} />
      </mesh>
      {/* Hover/click hit-sphere */}
      <mesh
        onPointerOver={(e) => {
          e.stopPropagation()
          onHover({
            name: star.name,
            classification: star.designation,
            fact: isPolaris
              ? `Magnitude ${star.magnitude}. The current pole star — Earth's rotation axis points within 0.74° of it. Click to reset the view.`
              : `Magnitude ${star.magnitude}. Part of the Big Dipper asterism in Ursa Major.`,
          })
          document.body.style.cursor = onClick ? "pointer" : "help"
        }}
        onPointerOut={() => {
          onHover(null)
          document.body.style.cursor = "auto"
        }}
        onClick={(e) => {
          if (!onClick) return
          e.stopPropagation()
          onClick()
        }}
      >
        <sphereGeometry args={[radius * 4, 12, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

function Constellations({
  onHover,
  onResetView,
}: {
  onHover: HoverHandler
  onResetView: () => void
}) {
  // Big Dipper connecting line (in order of the asterism)
  const dipperLineGeometry = useMemo(() => {
    const positions = new Float32Array(bigDipper.length * 3)
    bigDipper.forEach((s, i) => {
      const [x, y, z] = raDecToScenePos(s.raHours, s.decDeg, SKY_SHELL_DISTANCE)
      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z
    })
    const geo = new BufferGeometry()
    geo.setAttribute("position", new BufferAttribute(positions, 3))
    return geo
  }, [])

  return (
    <group>
      {/* Big Dipper line */}
      <line geometry={dipperLineGeometry}>
        <lineBasicMaterial color="#ffffff" transparent opacity={0.18} />
      </line>

      {bigDipper.map((s) => (
        <ConstellationStarMesh key={s.name} star={s} onHover={onHover} />
      ))}

      <ConstellationStarMesh
        star={polaris}
        onHover={onHover}
        onClick={onResetView}
        isPolaris
      />
    </group>
  )
}

/* ============================================================
   SHOOTING STARS — cyclical meteor streaks across the sky.
   Each meteor picks a random direction, fades in, streaks across,
   fades out, then waits a random interval before repeating.
   ============================================================ */

function Meteor({ baseDelay }: { baseDelay: number }) {
  const groupRef = useRef<Group>(null)
  const stateRef = useRef({
    t: -baseDelay,           // negative t means waiting
    duration: 2.2 + Math.random() * 1.8,
    cooldown: 6 + Math.random() * 14,
    origin: [0, 0, 0] as [number, number, number],
    direction: [0, 0, 0] as [number, number, number],
    length: 0,
  })

  const resetMeteor = () => {
    // Pick a random origin point ~50–80 units from the solar system,
    // and a velocity vector that crosses through the visible region.
    const r = 50 + Math.random() * 30
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    const ox = r * Math.sin(phi) * Math.cos(theta) + SUN_OFFSET_SCENE
    const oy = r * Math.cos(phi) * 0.5
    const oz = r * Math.sin(phi) * Math.sin(theta)

    // Direction roughly toward the solar system region
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
      // cooldown — invisible, then respawn
      groupRef.current.visible = false
      if (s.t > s.duration + s.cooldown) {
        resetMeteor()
      }
      return
    }

    groupRef.current.visible = true
    const progress = s.t / s.duration   // 0 → 1 across the screen
    const x = s.origin[0] + s.direction[0] * progress * s.length
    const y = s.origin[1] + s.direction[1] * progress * s.length
    const z = s.origin[2] + s.direction[2] * progress * s.length
    groupRef.current.position.set(x, y, z)
  })

  // Streak geometry — a short line segment along the direction of motion
  const streakGeometry = useMemo(() => {
    const arr = new Float32Array(2 * 3)
    arr[0] = 0; arr[1] = 0; arr[2] = 0
    arr[3] = -1.2; arr[4] = 0; arr[5] = 0
    const geo = new BufferGeometry()
    geo.setAttribute("position", new BufferAttribute(arr, 3))
    return geo
  }, [])

  return (
    <group ref={groupRef}>
      {/* Head — a small bright sphere */}
      <mesh>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      {/* Streak — a faint line trailing behind */}
      <line geometry={streakGeometry}>
        <lineBasicMaterial color="#ffffff" transparent opacity={0.4} />
      </line>
    </group>
  )
}

function ShootingStars({ count = 6 }: { count?: number }) {
  // Stagger meteor starts so they don't all fire at once
  return (
    <group>
      {Array.from({ length: count }).map((_, i) => (
        <Meteor key={i} baseDelay={i * 3 + Math.random() * 5} />
      ))}
    </group>
  )
}

/* ============================================================
   BELTS — Asteroid Belt (2.2–3.2 AU) and Kuiper Belt (30–50 AU)
   ============================================================ */

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
}: {
  innerRadius: number
  outerRadius: number
  count: number
  thickness: number
  rotationSpeed: number
  pointSize: number
  opacity: number
  info: BodyInfo
  onHover: HoverHandler
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
          color="#bcbcbc"
          depthWrite={false}
          transparent
          opacity={opacity}
        />
      </points>
      {/* Invisible torus hit-zone */}
      <mesh
        rotation={[Math.PI / 2, 0, 0]}
        onPointerOver={(e) => {
          e.stopPropagation()
          onHover(info)
          document.body.style.cursor = "help"
        }}
        onPointerOut={() => {
          onHover(null)
          document.body.style.cursor = "auto"
        }}
      >
        <torusGeometry args={[midRadius, halfWidth, 8, 96]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

/* ============================================================
   Hover-detectable bodies
   ============================================================ */

function SaturnRings({ planetRadius }: { planetRadius: number }) {
  // Rings sit in Saturn's equatorial plane — perpendicular to its spin axis (exactly 90°).
  // The parent group already applies Saturn's 26.73° axial tilt, so the rings inherit
  // that tilt naturally and end up at the real ~26.7° relative to the ecliptic.
  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
      <mesh>
        <ringGeometry args={[planetRadius * 1.45, planetRadius * 1.78, 96]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.35} side={DoubleSide} />
      </mesh>
      <mesh>
        <ringGeometry args={[planetRadius * 1.85, planetRadius * 2.10, 96]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.28} side={DoubleSide} />
      </mesh>
    </group>
  )
}

function PlanetBody({
  planet,
  onHover,
}: {
  planet: ScenePlanet
  onHover: HoverHandler
}) {
  const meshRef = useRef<Mesh>(null)
  const orbitRef = useRef<Group>(null)

  useEffect(() => {
    if (orbitRef.current) orbitRef.current.rotation.y = planet.raw.startPhase
  }, [planet.raw.startPhase])

  useFrame((_, delta) => {
    const tw = timeWarpRef.current
    if (orbitRef.current) orbitRef.current.rotation.y += delta * planet.orbitalSpeedRadPerSec * tw
    if (meshRef.current) meshRef.current.rotation.y += delta * planet.rotSpeedRadPerSec * tw
  })

  const hitRadius = Math.max(planet.visualRadius * 2.2, 0.18)
  const childMoons = moons.filter((m) => m.parent === planet.raw.name)

  return (
    <group rotation={[planet.inclination, 0, 0]}>
      <group ref={orbitRef}>
        <group position={[planet.orbitRadius, 0, 0]}>
          {/* Axial-tilted planet body + rings */}
          <group rotation={[planet.axialTilt, 0, 0]}>
            <mesh ref={meshRef}>
              <sphereGeometry args={[planet.visualRadius, 48, 48]} />
              <meshStandardMaterial
                color={planet.raw.shade}
                roughness={0.95}
                metalness={0.0}
              />
            </mesh>
            <mesh
              onPointerOver={(e) => {
                e.stopPropagation()
                onHover(planetToInfo(planet.raw))
                document.body.style.cursor = "help"
              }}
              onPointerOut={() => {
                onHover(null)
                document.body.style.cursor = "auto"
              }}
            >
              <sphereGeometry args={[hitRadius, 24, 24]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
            {planet.raw.hasRings && <SaturnRings planetRadius={planet.visualRadius} />}
          </group>

          {/* Moons orbit the planet (NOT the axial-tilt group, so they stay in the planet's equatorial plane) */}
          {childMoons.map((m) => (
            <MoonBody key={m.name} moon={m} onHover={onHover} />
          ))}
        </group>
      </group>
    </group>
  )
}

function OrbitRing({ radius, inclination }: { radius: number; inclination: number }) {
  const geometry = useMemo(() => {
    const segments = 192
    const arr = new Float32Array((segments + 1) * 3)
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2
      arr[i * 3] = Math.cos(angle) * radius
      arr[i * 3 + 1] = 0
      arr[i * 3 + 2] = Math.sin(angle) * radius
    }
    const geo = new BufferGeometry()
    geo.setAttribute("position", new BufferAttribute(arr, 3))
    return geo
  }, [radius])

  return (
    <group rotation={[inclination, 0, 0]}>
      <line geometry={geometry}>
        <lineBasicMaterial color="#ffffff" transparent opacity={0.08} />
      </line>
    </group>
  )
}

function SolarSystem({ onHover }: { onHover: HoverHandler }) {
  const sunRef = useRef<Mesh>(null)
  const coronaRef = useRef<Mesh>(null)
  const scenePlanets = useMemo(buildScenePlanets, [])
  const sunRotSpeed = useMemo(
    () => (2 * Math.PI) / (25 / TIME_WARP_DAYS_PER_SEC),
    [],
  )

  useFrame((_, delta) => {
    if (sunRef.current) sunRef.current.rotation.y += delta * sunRotSpeed * timeWarpRef.current
    if (coronaRef.current) {
      const s = 1 + Math.sin(performance.now() * 0.0008) * 0.025
      coronaRef.current.scale.set(s, s, s)
    }
  })

  return (
    <group>
      <mesh ref={sunRef}>
        <sphereGeometry args={[0.7, 64, 64]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={1.6}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={coronaRef}>
        <sphereGeometry args={[0.92, 48, 48]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.22} blending={AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[1.3, 48, 48]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.08} blending={AdditiveBlending} depthWrite={false} />
      </mesh>
      {/* Sun hover hit-target */}
      <mesh
        onPointerOver={(e) => {
          e.stopPropagation()
          onHover(SUN_INFO)
          document.body.style.cursor = "help"
        }}
        onPointerOut={() => {
          onHover(null)
          document.body.style.cursor = "auto"
        }}
      >
        <sphereGeometry args={[0.9, 32, 32]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <pointLight position={[0, 0, 0]} intensity={3.5} distance={60} color="#ffffff" decay={1.3} />

      {scenePlanets.map((p) => (
        <OrbitRing key={`orbit-${p.raw.name}`} radius={p.orbitRadius} inclination={p.inclination} />
      ))}

      {scenePlanets.map((p) => (
        <PlanetBody key={p.raw.name} planet={p} onHover={onHover} />
      ))}

      {/* Asteroid Belt — between Mars (3.7) and Jupiter (6.8) in scene units.
          Real positioning: 2.2–3.2 AU → sqrt × 3 = 4.45–5.37 scene units. */}
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
      />

      {/* Kuiper Belt — beyond Neptune. Real positioning: 30–50 AU → 16.43–21.21 scene units. */}
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
      />
    </group>
  )
}

/* ============================================================
   Info panel (rendered as plain HTML in the Hero, not inside Canvas)
   ============================================================ */

function InfoPanel({ info }: { info: BodyInfo | null }) {
  if (!info) {
    return (
      <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-white/35 pointer-events-none">
        Hover any body for data
      </div>
    )
  }

  const k = info.surfaceTempK
  const c = info.surfaceTempC

  return (
    <div className="font-mono text-[11px] text-white/90 leading-relaxed pointer-events-none">
      <div className="text-[10px] tracking-[0.3em] uppercase text-white/50 mb-1">
        {info.classification}
      </div>
      <div className="text-base font-sans tracking-tight text-white mb-2">
        {info.name}
      </div>

      {k && (
        <div>
          <span className="text-white/55">Surface temp · </span>
          {k.min !== undefined && k.max !== undefined ? (
            <>
              {k.min}–{k.max} K
            </>
          ) : (
            <>{k.mean} K</>
          )}
          {c && <span className="text-white/55"> ({c.mean}°C avg)</span>}
        </div>
      )}

      {info.aAU !== undefined && (
        <div>
          <span className="text-white/55">Orbit · </span>
          {info.aAU.toFixed(2)} AU · {Math.round(info.periodDays ?? 0).toLocaleString()} days
        </div>
      )}

      {info.rotHours !== undefined && (
        <div>
          <span className="text-white/55">Day · </span>
          {Math.abs(info.rotHours) < 100
            ? `${Math.abs(info.rotHours).toFixed(1)} h${info.rotHours < 0 ? " (retrograde)" : ""}`
            : `${(Math.abs(info.rotHours) / 24).toFixed(0)} days${info.rotHours < 0 ? " (retrograde)" : ""}`}
        </div>
      )}

      {info.tiltDeg !== undefined && (
        <div>
          <span className="text-white/55">Axial tilt · </span>
          {info.tiltDeg.toFixed(1)}°
        </div>
      )}

      {info.radiusEarth !== undefined && (
        <div>
          <span className="text-white/55">Radius · </span>
          {info.radiusEarth.toFixed(2)} × Earth
        </div>
      )}

      {info.moons !== undefined && info.moons > 0 && (
        <div>
          <span className="text-white/55">Moons · </span>
          {info.moons}
        </div>
      )}

      {info.fact && (
        <div className="mt-2 max-w-xs text-white/70 font-sans text-[12px] leading-snug">
          {info.fact}
        </div>
      )}
    </div>
  )
}

/* ============================================================
   Scene
   ============================================================ */

function SceneContents({
  enableMotion,
  onHover,
  onResetView,
}: {
  enableMotion: boolean
  onHover: HoverHandler
  onResetView: () => void
}) {
  const { scene } = useThree()
  useEffect(() => {
    scene.fog = new FogExp2("#050505", 0.0035)
    return () => {
      scene.fog = null
    }
  }, [scene])

  return (
    <>
      <Stars
        radius={400}
        depth={100}
        count={2200}
        factor={4}
        saturation={0}
        fade
        speed={enableMotion ? 0.2 : 0}
      />
      {/* Milky Way disc is tilted ~60.2° relative to the ecliptic in real life. */}
      <group rotation={[GALACTIC_PLANE_TILT_RAD, 0, 0]}>
        <MilkyWay onHover={onHover} />
      </group>
      {/* Solar system on the Orion Arm — ~26,670 ly out of the galactic centre */}
      <group position={SOLAR_SYSTEM_POSITION}>
        <SolarSystem onHover={onHover} />
      </group>
      {/* Big Dipper + Polaris (North Star) — click Polaris to reset the view */}
      <Constellations onHover={onHover} onResetView={onResetView} />
      {/* Cyclical shooting stars across the sky */}
      {enableMotion && <ShootingStars count={6} />}
      <ambientLight intensity={0.18} />
    </>
  )
}

export function GalaxyScene({ interactive = false }: { interactive?: boolean }) {
  const [mounted, setMounted] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [hovered, setHovered] = useState<BodyInfo | null>(null)
  const [timeWarpDisplay, setTimeWarpDisplay] = useState(1)
  const orbitRef = useRef<OrbitControlsImpl | null>(null)

  useEffect(() => {
    setMounted(true)
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReducedMotion(mq.matches)
    const update = () => setReducedMotion(mq.matches)
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])

  const onHover = useCallback<HoverHandler>((info) => setHovered(info), [])

  const handleReset = useCallback(() => {
    orbitRef.current?.reset()
  }, [])

  if (!mounted) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-64 h-64 rounded-full border border-white/10 motion-safe:animate-pulse" />
      </div>
    )
  }

  return (
    <div className="relative w-full h-full">
      <Canvas
        // Camera default: close to the solar system on the Orion Arm.
        // Position is solar system + offset (4, 6, 13) — same close-up framing as before
        // but the solar system is now at ~66 scene units along x.
        camera={{ position: [SUN_OFFSET_SCENE + 4, 6, 13], fov: 50, near: 0.1, far: 1000 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, toneMappingExposure: 1.05 }}
        className="w-full h-full"
        // Always auto: lets hover hit-test work in both passive and explore modes.
        // OrbitControls.enabled gates drag/zoom; the canvas itself doesn't capture
        // wheel events so page scroll still works in passive mode.
        style={{ pointerEvents: "auto" }}
      >
        <SceneContents enableMotion={!reducedMotion} onHover={onHover} onResetView={handleReset} />

        <OrbitControls
          ref={orbitRef as React.Ref<OrbitControlsImpl>}
          enabled={interactive}
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
          minDistance={3}        /* close-up of the Sun */
          maxDistance={260}      /* far enough out to frame the whole Milky Way */
          autoRotate={!reducedMotion}
          autoRotateSpeed={0.15}
          rotateSpeed={0.5}
          zoomSpeed={0.7}
          // Camera orbits around the solar system, not the galactic centre.
          target={SOLAR_SYSTEM_POSITION}
          makeDefault
        />
      </Canvas>

      {/* Info panel — bottom-left, lifted well clear of the Enter Work CTA below it */}
      <div className="absolute bottom-44 left-8 md:bottom-52 md:left-12 z-20 pointer-events-none max-w-70">
        <InfoPanel info={hovered} />
      </div>

      {/* Galaxy HUD cluster — bottom-right.
          Stack: music toggle (icon) above the time-warp slider. */}
      <div className="absolute bottom-6 right-6 md:bottom-8 md:right-12 z-30 pointer-events-auto flex flex-col items-end gap-2">
        <GalaxyMusic />

        <label className="flex items-center gap-3 px-4 py-2.5 border border-white/25 rounded-full bg-black/40 backdrop-blur-sm">
          <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-white/70">
            Time
          </span>
          <input
            type="range"
            min={0}
            max={3}
            step={0.05}
            value={timeWarpDisplay}
            onChange={(e) => {
              const v = parseFloat(e.target.value)
              setTimeWarpDisplay(v)
              timeWarpRef.current = v
            }}
            aria-label="Adjust simulation speed"
            className="w-32 md:w-40 accent-white cursor-ew-resize"
          />
          <span className="font-mono text-[10px] tracking-widest text-white/85 tabular-nums w-10 text-right">
            {timeWarpDisplay === 0 ? "PAUSED" : `${timeWarpDisplay.toFixed(2)}×`}
          </span>
        </label>
      </div>

      {/* Reset view — only useful while exploring; sits clearly below the
          hero's "Exploring · Esc to exit" button at top-right */}
      {interactive && (
        <button
          type="button"
          onClick={handleReset}
          className="
            absolute top-20 right-6 md:top-40 md:right-12 z-30
            inline-flex items-center gap-2 px-3.5 py-2
            border border-white/25 rounded-full
            bg-black/40 backdrop-blur-sm
            font-mono text-[10px] tracking-[0.25em] uppercase
            text-white/85 hover:text-white hover:border-accent/60
            transition-colors duration-300
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
            focus-visible:ring-offset-2 focus-visible:ring-offset-background
            min-h-9
          "
          aria-label="Reset camera view"
        >
          ↺ Reset view
        </button>
      )}
    </div>
  )
}
