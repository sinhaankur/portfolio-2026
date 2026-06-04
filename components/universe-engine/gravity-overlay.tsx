"use client"

/**
 * Gravity Overlay — visualises the gravitational influence of every major
 * body in the solar system.  Two modes, toggled together:
 *
 *   1. Influence spheres: faint transparent shells around each body whose
 *      radius scales with sqrt(mass).  Gives an immediate sense of which
 *      bodies dominate their neighbourhood.
 *
 *   2. Ecliptic vector field: a grid of small arrows on the ecliptic plane
 *      (y = 0.06) pointing in the direction of net gravitational acceleration
 *      at that point.  Arrow length / opacity encode field strength.
 *
 * Performance:
 *   - Grid resolution is capped at 30 × 30 = 900 instances — well within
 *     comfortable InstancedMesh territory.
 *   - Only the Sun + 8 planets contribute to field calculations; moons and
 *     small bodies are negligible at solar-system scale.
 *   - Positions are recomputed analytically each frame (same Kepler math
 *     the renderer uses) so no ref-walking or matrix-world queries are needed.
 */

import { useRef, useMemo } from "react"
import { useFrame } from "@react-three/fiber"
import {
  AdditiveBlending,
  Color,
  ConeGeometry,
  CylinderGeometry,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three"

import {
  SUN_OFFSET_SCENE,
  TIME_WARP_DAYS_PER_SEC,
  buildScenePlanets,
  eccentricToTrue,
  simTimeRef,
  solveKepler,
  timeWarpRef,
} from "./astronomy"
import type { ScenePlanet } from "./types"

/* --------------------------------------------------------------------------
 * Scene-scale constants
 * ------------------------------------------------------------------------ */

const SUN_MASS_EARTH = 333_000 // M☉ in Earth-masses
const GRID_SIZE = 30 // 30 × 30 arrows
const GRID_EXTENT = 32 // covers ±32 scene units (roughly Neptune orbit)
const GRID_Y = 0.06 // slightly above ecliptic to avoid z-fighting with rings
const INFLUENCE_SCALE = 0.55 // multiplier on sqrt(mass) → sphere radius
const ARROW_MAX_SCALE = 0.55 // maximum arrow length
const ARROW_MIN_SCALE = 0.08 // minimum arrow length (dead zone)
const FIELD_STRENGTH_SCALE = 0.000_015 // empirical: tunes arrow length

/* --------------------------------------------------------------------------
 * Math helpers
 * ------------------------------------------------------------------------ */

/** Current planet position in solar-system scene coordinates. */
function planetScenePosition(planet: ScenePlanet, simDays: number): Vector3 {
  const meanAnomaly =
    planet.raw.startPhase +
    simDays * planet.orbitalSpeedRadPerSec * timeWarpRef.current

  const e = planet.raw.deep?.eccentricity ?? 0
  let theta = meanAnomaly
  let r = planet.orbitRadius

  if (e > 0.01) {
    const E = solveKepler(meanAnomaly, e)
    theta = eccentricToTrue(E, e)
    r =
      (planet.orbitRadius * (1 - e * e)) /
      (1 + e * Math.cos(theta))
  }

  const xLocal = r * Math.cos(theta)
  const zLocal = -r * Math.sin(theta)
  const y = -zLocal * Math.sin(planet.inclination)
  const z = zLocal * Math.cos(planet.inclination)

  return new Vector3(xLocal, y, z)
}

/** Gravitational acceleration vector at `point` from all massive bodies. */
function netGravityAt(
  point: Vector3,
  bodies: Array<{ position: Vector3; mass: number }>,
): Vector3 {
  const net = new Vector3()
  for (const b of bodies) {
    const dir = _tempVec3A.subVectors(b.position, point)
    const distSq = dir.lengthSq()
    if (distSq < 0.0001) continue
    const strength = b.mass / distSq
    net.add(dir.normalize().multiplyScalar(strength))
  }
  return net
}

/* --------------------------------------------------------------------------
 * Reusable temporaries — avoid per-frame allocations
 * ------------------------------------------------------------------------ */
const _tempVec3A = new Vector3()
const _tempVec3B = new Vector3()
const _tempVec3C = new Vector3()
const _tempQuat = new Quaternion()
const _tempMatrix = new Matrix4()
const _tempColor = new Color()

/* --------------------------------------------------------------------------
 * Influence spheres — one per major body
 * ------------------------------------------------------------------------ */

function InfluenceSpheres({
  planets,
  invert,
}: {
  planets: ScenePlanet[]
  invert: boolean
}) {
  const groupRef = useRef<THREE.Group>(null)

  useFrame(() => {
    if (!groupRef.current) return
    const simDays = simTimeRef.current.days
    const children = groupRef.current.children as THREE.Mesh[]
    let idx = 0

    // Sun
    if (children[idx]) {
      children[idx].position.set(SUN_OFFSET_SCENE, 0, 0)
      const sunRadius = Math.sqrt(SUN_MASS_EARTH) * INFLUENCE_SCALE * 0.35
      children[idx].scale.setScalar(sunRadius)
      idx++
    }

    // Planets
    for (const planet of planets) {
      if (!children[idx]) continue
      const pos = planetScenePosition(planet, simDays)
      children[idx].position.copy(pos)
      const mass = planet.raw.deep?.massEarth ?? 0.1
      const radius = Math.sqrt(mass) * INFLUENCE_SCALE
      children[idx].scale.setScalar(Math.max(radius, 0.4))
      idx++
    }
  })

  const sunColor = invert ? "#c95824" : "#ffffff"
  const sunOpacity = invert ? 0.06 : 0.05

  return (
    <group ref={groupRef}>
      {/* Sun influence */}
      <mesh>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial
          color={sunColor}
          transparent
          opacity={sunOpacity}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {planets.map((p) => {
        const hue = p.raw.shade
        return (
          <mesh key={`gsphere-${p.raw.name}`}>
            <sphereGeometry args={[1, 24, 24]} />
            <meshBasicMaterial
              color={hue}
              transparent
              opacity={invert ? 0.07 : 0.06}
              blending={AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        )
      })}
    </group>
  )
}

/* --------------------------------------------------------------------------
 * Vector field — InstancedMesh of arrows on the ecliptic plane
 * ------------------------------------------------------------------------ */

function VectorField({
  planets,
  invert,
}: {
  planets: ScenePlanet[]
  invert: boolean
}) {
  const meshRef = useRef<InstancedMesh>(null)

  // Build arrow geometry once: cylinder shaft + cone head
  const arrowGeo = useMemo(() => {
    const shaft = new CylinderGeometry(0.015, 0.015, 0.5, 6)
    shaft.translate(0, 0.25, 0)
    shaft.rotateX(Math.PI / 2)

    const head = new ConeGeometry(0.04, 0.18, 6)
    head.translate(0, 0.59, 0)
    head.rotateX(Math.PI / 2)

    // Merge — three.js doesn't have a built-in merge, so we approximate by
    // parenting in the InstancedMesh (simpler: just use the cone as the
    // visible arrow, scaled along Y to become a pointer).
    return new ConeGeometry(0.035, 1, 6)
  }, [])

  const arrowMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: invert ? "#c95824" : "#7ec8ff",
        transparent: true,
        opacity: 0.35,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [invert],
  )

  const instanceCount = GRID_SIZE * GRID_SIZE

  useFrame(() => {
    if (!meshRef.current) return
    const simDays = simTimeRef.current.days

    // Build body list once per frame
    const bodies: Array<{ position: Vector3; mass: number }> = [
      { position: _tempVec3A.set(SUN_OFFSET_SCENE, 0, 0), mass: SUN_MASS_EARTH },
    ]
    for (const p of planets) {
      bodies.push({
        position: planetScenePosition(p, simDays),
        mass: p.raw.deep?.massEarth ?? 0.1,
      })
    }

    const halfExtent = GRID_EXTENT / 2
    const step = GRID_EXTENT / GRID_SIZE
    let instanceIdx = 0

    for (let ix = 0; ix < GRID_SIZE; ix++) {
      for (let iz = 0; iz < GRID_SIZE; iz++) {
        const x = -halfExtent + ix * step + step * 0.5
        const z = -halfExtent + iz * step + step * 0.5
        const point = _tempVec3B.set(x, GRID_Y, z)

        const g = netGravityAt(point, bodies)
        const strength = g.length()

        // Arrow scale based on field strength, clamped
        const scale =
          ARROW_MIN_SCALE +
          Math.min(
            1,
            strength * FIELD_STRENGTH_SCALE,
          ) *
            (ARROW_MAX_SCALE - ARROW_MIN_SCALE)

        // Orientation: arrow points in direction of gravity (toward masses)
        _tempQuat.setFromUnitVectors(
          _tempVec3C.set(0, 1, 0),
          g.normalize(),
        )

        _tempMatrix.compose(point, _tempQuat, _tempVec3A.set(scale, scale, scale))
        meshRef.current.setMatrixAt(instanceIdx, _tempMatrix)

        // Fade out very weak vectors
        const alpha =
          0.08 + Math.min(1, strength * FIELD_STRENGTH_SCALE * 2.5) * 0.35
        _tempColor.set(arrowMat.color)
        meshRef.current.setColorAt(
          instanceIdx,
          _tempColor.setRGB(
            _tempColor.r,
            _tempColor.g,
            _tempColor.b,
          ).multiplyScalar(alpha / 0.35),
        )

        instanceIdx++
      }
    }

    meshRef.current.instanceMatrix.needsUpdate = true
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true
    }
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[arrowGeo, arrowMat, instanceCount]}
      frustumCulled={false}
    />
  )
}

/* --------------------------------------------------------------------------
 * Public export
 * ------------------------------------------------------------------------ */

export function GravityOverlay({
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
      <InfluenceSpheres planets={planets} invert={invert} />
      <VectorField planets={planets} invert={invert} />
    </group>
  )
}
