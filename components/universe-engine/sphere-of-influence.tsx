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
import { AdditiveBlending } from "three"
import type { Mesh } from "three"
import {
  buildScenePlanets,
  eccentricToTrue,
  simTimeRef,
  solveKepler,
} from "./astronomy"
import type { ScenePlanet } from "./types"

const SUN_MASS_EARTH = 333_000
const MIN_VISUAL_HILL_RADIUS = 0.18

function hillRadiusScene(planet: ScenePlanet): number {
  const mass = Math.max(planet.raw.deep?.massEarth ?? 0.1, 0.001)
  const ratio = mass / (3 * SUN_MASS_EARTH)
  const trueHill = planet.orbitRadius * Math.pow(ratio, 1 / 3)
  return Math.max(MIN_VISUAL_HILL_RADIUS, trueHill)
}

function planetScenePosition(planet: ScenePlanet, simDays: number) {
  const e = planet.raw.deep?.eccentricity ?? 0
  const meanAnomaly =
    planet.raw.startPhase + simDays * planet.orbitalSpeedRadPerSec

  let theta = meanAnomaly
  let r = planet.orbitRadius
  if (e > 0.01) {
    const E = solveKepler(meanAnomaly, e)
    theta = eccentricToTrue(E, e)
    r = (planet.orbitRadius * (1 - e * e)) / (1 + e * Math.cos(theta))
  }

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

  useFrame(() => {
    if (!ref.current) return
    const [x, y, z] = planetScenePosition(planet, simTimeRef.current.days)
    ref.current.position.set(x, y, z)
    ref.current.scale.setScalar(radius)
  })

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[1, 20, 20]} />
      <meshBasicMaterial
        color={invert ? "#c95824" : planet.raw.shade}
        transparent
        opacity={invert ? 0.16 : 0.14}
        blending={AdditiveBlending}
        depthWrite={false}
        wireframe
      />
    </mesh>
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
