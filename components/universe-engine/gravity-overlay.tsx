"use client"

/**
 * Gravity Overlay — visualises the gravitational influence of every massive
 * body in the scene: solar system (Sun + planets), sky-shell black holes
 * (M87*, TON 618, Cygnus X-1, …), and Sgr A* at the galactic centre.
 *
 *   1. Influence spheres: faint transparent shells around each body. Radius
 *      scales with sqrt(mass) and is capped at 45 scene units so supermassive
 *      black holes read as dramatic background domes without swallowing the
 *      entire viewport.
 *
 *   2. Ecliptic vector field: a 30×30 grid of arrows on the ecliptic plane
 *      showing net gravitational acceleration at each point. Distant masses
 *      (black holes, galactic centre) are included in the calculation so the
 *      field shows the true large-scale pull, not just the local solar-system
 *      gradient.
 *
 * Performance:
 *   - Grid resolution capped at 900 instances (InstancedMesh).
 *   - Body list rebuilt once per frame; distant bodies add ~10 entries.
 *   - Sphere meshes are low-poly (16–32 segments) and additive-blended.
 */

import { useRef, useMemo } from "react"
import { useFrame } from "@react-three/fiber"
import {
  AdditiveBlending,
  Color,
  ConeGeometry,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three"

import {
  SUN_OFFSET_SCENE,
  SKY_SHELL_DISTANCE,
  SGR_A_MASS_SOLAR,
  buildScenePlanets,
  eccentricToTrue,
  raDecToScenePos,
  simTimeRef,
  skyPoints,
  solveKepler,
  timeWarpRef,
} from "./astronomy"
import type { ScenePlanet, SkyPoint } from "./types"

/* --------------------------------------------------------------------------
 * Scene-scale constants
 * ------------------------------------------------------------------------ */

const SUN_MASS_EARTH = 333_000
const GRID_SIZE = 30
const GRID_EXTENT = 32
const GRID_Y = 0.06
const INFLUENCE_SCALE = 0.55
const INFLUENCE_CAP = 45 // scene units — prevents supermassive BHs from engulfing everything
const ARROW_MAX_SCALE = 0.55
const ARROW_MIN_SCALE = 0.08
const FIELD_STRENGTH_SCALE = 0.000_015

/* --------------------------------------------------------------------------
 * Precomputed sky black holes (massive bodies on the sky shell)
 * ------------------------------------------------------------------------ */

const SKY_MASSIVE_BODIES: Array<{
  name: string
  position: Vector3
  massEarth: number
  color: string
}> = skyPoints
  .filter((p): p is SkyPoint & { massSolar: number } => p.massSolar != null)
  .map((p) => {
    const [wx, wy, wz] = raDecToScenePos(p.raHours, p.decDeg, SKY_SHELL_DISTANCE)
    // GravityOverlay lives inside the solar-system group (origin at Sun).
    // raDecToScenePos bakes in SUN_OFFSET_SCENE, so subtract it for local coords.
    return {
      name: p.name,
      position: new Vector3(wx - SUN_OFFSET_SCENE, wy, wz),
      massEarth: p.massSolar * SUN_MASS_EARTH,
      color: p.shade ?? "#b0c8ff",
    }
  })

// Sgr A* at galactic centre — world origin, so local position is opposite the Sun offset.
const SGR_A_BODY = {
  name: "Sagittarius A*",
  position: new Vector3(-SUN_OFFSET_SCENE, 0, 0),
  massEarth: SGR_A_MASS_SOLAR * SUN_MASS_EARTH,
  color: "#b0c8ff",
}

/* --------------------------------------------------------------------------
 * Math helpers
 * ------------------------------------------------------------------------ */

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
    r = (planet.orbitRadius * (1 - e * e)) / (1 + e * Math.cos(theta))
  }

  const xLocal = r * Math.cos(theta)
  const zLocal = -r * Math.sin(theta)
  const y = -zLocal * Math.sin(planet.inclination)
  const z = zLocal * Math.cos(planet.inclination)

  return new Vector3(xLocal, y, z)
}

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

function influenceRadius(massEarth: number): number {
  return Math.min(INFLUENCE_CAP, Math.sqrt(massEarth) * INFLUENCE_SCALE)
}

/* --------------------------------------------------------------------------
 * Reusable temporaries
 * ------------------------------------------------------------------------ */
const _tempVec3A = new Vector3()
const _tempVec3B = new Vector3()
const _tempVec3C = new Vector3()
const _tempQuat = new Quaternion()
const _tempMatrix = new Matrix4()
const _tempColor = new Color()

/* --------------------------------------------------------------------------
 * Influence spheres — solar system + distant massive bodies
 * ------------------------------------------------------------------------ */

function InfluenceSpheres({
  planets,
  invert,
}: {
  planets: ScenePlanet[]
  invert: boolean
}) {
  const groupRef = useRef<THREE.Group>(null)

  // Precompute static sphere count so useFrame knows which mesh is which.
  const solarSystemCount = 1 + planets.length // Sun + planets
  const distantCount = SKY_MASSIVE_BODIES.length + 1 // sky BHs + Sgr A*
  const totalCount = solarSystemCount + distantCount

  useFrame(() => {
    if (!groupRef.current) return
    const simDays = simTimeRef.current.days
    const children = groupRef.current.children as THREE.Mesh[]
    let idx = 0

    // Sun
    if (children[idx]) {
      children[idx].position.set(0, 0, 0)
      children[idx].scale.setScalar(influenceRadius(SUN_MASS_EARTH) * 0.35)
      idx++
    }

    // Planets
    for (const planet of planets) {
      if (!children[idx]) continue
      const pos = planetScenePosition(planet, simDays)
      children[idx].position.copy(pos)
      const mass = planet.raw.deep?.massEarth ?? 0.1
      children[idx].scale.setScalar(Math.max(0.4, influenceRadius(mass)))
      idx++
    }

    // Sky black holes
    for (const bh of SKY_MASSIVE_BODIES) {
      if (!children[idx]) continue
      children[idx].position.copy(bh.position)
      children[idx].scale.setScalar(influenceRadius(bh.massEarth))
      idx++
    }

    // Sgr A*
    if (children[idx]) {
      children[idx].position.copy(SGR_A_BODY.position)
      children[idx].scale.setScalar(influenceRadius(SGR_A_BODY.massEarth))
      idx++
    }
  })

  const sunColor = invert ? "#c95824" : "#ffffff"
  const sunOpacity = invert ? 0.06 : 0.05
  const distantOpacity = invert ? 0.05 : 0.04

  return (
    <group ref={groupRef}>
      {/* Sun */}
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

      {/* Planets */}
      {planets.map((p) => (
        <mesh key={`gsphere-${p.raw.name}`}>
          <sphereGeometry args={[1, 24, 24]} />
          <meshBasicMaterial
            color={p.raw.shade}
            transparent
            opacity={invert ? 0.07 : 0.06}
            blending={AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* Sky black holes */}
      {SKY_MASSIVE_BODIES.map((bh) => (
        <mesh key={`gsphere-bh-${bh.name}`}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshBasicMaterial
            color={bh.color}
            transparent
            opacity={distantOpacity}
            blending={AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* Sgr A* */}
      <mesh>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial
          color={SGR_A_BODY.color}
          transparent
          opacity={distantOpacity}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

/* --------------------------------------------------------------------------
 * Vector field — includes distant masses for true large-scale gravity
 * ------------------------------------------------------------------------ */

function VectorField({
  planets,
  invert,
}: {
  planets: ScenePlanet[]
  invert: boolean
}) {
  const meshRef = useRef<InstancedMesh>(null)

  const arrowGeo = useMemo(() => new ConeGeometry(0.035, 1, 6), [])
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

    const bodies: Array<{ position: Vector3; mass: number }> = [
      { position: _tempVec3A.set(0, 0, 0), mass: SUN_MASS_EARTH },
    ]
    for (const p of planets) {
      bodies.push({
        position: planetScenePosition(p, simDays),
        mass: p.raw.deep?.massEarth ?? 0.1,
      })
    }
    for (const bh of SKY_MASSIVE_BODIES) {
      bodies.push({ position: bh.position, mass: bh.massEarth })
    }
    bodies.push({ position: SGR_A_BODY.position, mass: SGR_A_BODY.massEarth })

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

        const scale =
          ARROW_MIN_SCALE +
          Math.min(1, strength * FIELD_STRENGTH_SCALE) *
            (ARROW_MAX_SCALE - ARROW_MIN_SCALE)

        _tempQuat.setFromUnitVectors(
          _tempVec3C.set(0, 1, 0),
          g.normalize(),
        )

        _tempMatrix.compose(point, _tempQuat, _tempVec3A.set(scale, scale, scale))
        meshRef.current.setMatrixAt(instanceIdx, _tempMatrix)

        const alpha =
          0.08 + Math.min(1, strength * FIELD_STRENGTH_SCALE * 2.5) * 0.35
        _tempColor.set(arrowMat.color)
        meshRef.current.setColorAt(
          instanceIdx,
          _tempColor.setRGB(_tempColor.r, _tempColor.g, _tempColor.b),
        )
        // Dim the instance by alpha via the color multiplier trick
        const colAttr = meshRef.current.instanceColor
        if (colAttr) {
          const r = _tempColor.r * (alpha / 0.35)
          const g = _tempColor.g * (alpha / 0.35)
          const b = _tempColor.b * (alpha / 0.35)
          colAttr.setXYZ(instanceIdx, r, g, b)
        }

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
