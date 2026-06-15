"use client"

/**
 * Sphere of Influence overlay.
 *
 * Uses each planet's Hill radius as the physical boundary where the
 * planet's local gravity dominates over the Sun for nearby trajectories:
 *
 *   r_H = a * (m / (3M))^(1/3)
 *
 * Inner-planet Hill spheres are tiny at this scene scale, so we keep a
 * small visual minimum to preserve readability in Deep Dive mode.
 */

import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { AdditiveBlending, Color, DoubleSide } from "three"
import type { Mesh } from "three"
import {
  DEG,
  buildScenePlanets,
  eccentricToTrue,
  meanAnomalyAt,
  simTimeRef,
  solveKepler,
} from "./astronomy"
import type { ScenePlanet } from "./types"

const SUN_MASS_EARTH = 333_000
const MIN_VISUAL_HILL_RADIUS = 0.18
const SHELL_SEGMENTS = 24
const SHELL_SCALE = 1.018

function shellColor(hex: string, invert: boolean): string {
  const color = new Color(hex)
  if (invert) {
    // Keep the planet identity, but calm the palette so the shell still
    // feels chart-like rather than neon orange everywhere.
    color.lerp(new Color("#d8d0c4"), 0.42)
    color.offsetHSL(0, -0.15, 0.07)
  } else {
    color.offsetHSL(0, -0.05, 0.02)
  }
  return `#${color.getHexString()}`
}

function hillRadiusScene(planet: ScenePlanet): number {
  const mass = Math.max(planet.raw.deep?.massEarth ?? 0.1, 0.001)
  const ratio = mass / (3 * SUN_MASS_EARTH)
  const trueHill = planet.orbitRadius * Math.pow(ratio, 1 / 3)
  // True Hill radii are tiny at this scene scale, so a flat floor made every
  // inner planet show an identical bubble (uninformative + "looks off"). Blend
  // the real value with a gentle mass-scaled minimum so the shells still
  // DIFFER by planet — a more massive world reads as a bigger sphere — while
  // staying visible. Jupiter ends up clearly the largest, Mercury the smallest.
  const massFloor = MIN_VISUAL_HILL_RADIUS * (0.6 + 0.5 * Math.log10(1 + mass))
  return Math.max(massFloor, trueHill)
}

function planetScenePosition(planet: ScenePlanet, simMs: number) {
  // Date-driven, matching the scene renderer so each Hill sphere stays
  // centred on its planet as the timeline scrubs.
  const e = planet.raw.deep?.eccentricity ?? 0
  const periRad = planet.raw.periDeg != null ? planet.raw.periDeg * DEG : 0
  const meanAnomaly =
    planet.raw.m0Deg != null
      ? meanAnomalyAt(planet.raw.m0Deg * DEG, planet.raw.periodDays, simMs)
      : planet.raw.startPhase

  let theta = meanAnomaly
  let r = planet.orbitRadius
  if (e > 0.01) {
    const E = solveKepler(meanAnomaly, e)
    theta = eccentricToTrue(E, e)
    r = (planet.orbitRadius * (1 - e * e)) / (1 + e * Math.cos(theta))
  }
  theta += periRad

  const xLocal = r * Math.cos(theta)
  const zLocal = -r * Math.sin(theta)
  const y = -zLocal * Math.sin(planet.inclination)
  const z = zLocal * Math.cos(planet.inclination)
  return [xLocal, y, z] as const
}

function SphereShell({
  planet,
  invert,
}: {
  planet: ScenePlanet
  invert: boolean
}) {
  const ref = useRef<Mesh>(null)
  const radius = useMemo(() => hillRadiusScene(planet), [planet])
  const shellOpacity = useMemo(() => {
    if (radius > 1.2) return 0.13
    if (radius > 0.6) return 0.15
    return 0.18
  }, [radius])

  useFrame(() => {
    if (!ref.current) return
    const [x, y, z] = planetScenePosition(planet, simTimeRef.current.simMs)
    ref.current.position.set(x, y, z)
    ref.current.scale.setScalar(radius)
  })

  return (
    <group ref={ref}>
      <mesh scale={1}>
        <sphereGeometry args={[1, SHELL_SEGMENTS, SHELL_SEGMENTS]} />
        <meshBasicMaterial
          color={shellColor(planet.raw.shade, invert)}
          transparent
          opacity={invert ? 0.035 : 0.028}
          blending={AdditiveBlending}
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>
      <mesh scale={SHELL_SCALE}>
        <sphereGeometry args={[1, SHELL_SEGMENTS, SHELL_SEGMENTS]} />
        <meshBasicMaterial
          color={shellColor(planet.raw.shade, invert)}
          transparent
          opacity={shellOpacity}
          blending={AdditiveBlending}
          depthWrite={false}
          wireframe
          side={DoubleSide}
        />
      </mesh>
    </group>
  )
}

export function SphereOfInfluence({
  show,
  invert = false,
}: {
  show: boolean
  invert?: boolean
}) {
  const planets = useMemo(buildScenePlanets, [])

  if (!show) return null

  return (
    <group>
      {planets.map((planet) => (
        <SphereShell
          key={`soi-${planet.raw.name}`}
          planet={planet}
          invert={invert}
        />
      ))}
    </group>
  )
}
