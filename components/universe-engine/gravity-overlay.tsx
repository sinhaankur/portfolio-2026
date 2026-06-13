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
import { Html } from "@react-three/drei"
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
  DEG,
  SUN_OFFSET_SCENE,
  SKY_SHELL_DISTANCE,
  SGR_A_MASS_SOLAR,
  buildScenePlanets,
  eccentricToTrue,
  meanAnomalyAt,
  raDecToScenePos,
  simTimeRef,
  skyPoints,
  solveKepler,
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
// Minimum visible Hill-sphere radius (scene units) — matches
// sphere-of-influence.tsx so inner planets stay findable at camera distance.
const HILL_VISUAL_MIN = 0.18
const ARROW_MAX_SCALE = 0.62
const ARROW_MIN_SCALE = 0.07
const FIELD_STRENGTH_SCALE = 0.000_015
// Log-domain span the normalised field magnitude is divided by. Tuned so
// the field spreads smoothly across the arrow-length band: faint outer grid
// ≈0, mid-system ~0.1, near-Earth ~0.5, near-Jupiter ~0.9, near-Sun →1,
// rather than saturating near every mass and flooring everywhere else.
const FIELD_LOG_RANGE = 3.2
const ARROW_ALPHA_MIN = 0.06
const ARROW_ALPHA_MAX = 0.5

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

function planetScenePosition(planet: ScenePlanet, simMs: number): Vector3 {
  // Same date-driven basis the scene renderer uses, so the gravity field +
  // Hill spheres stay glued to where the planets actually are. Anchored
  // bodies (m0Deg) derive mean anomaly from the date; the rest fall back to
  // startPhase. The longitude-of-perihelion offset orients eccentric orbits.
  const periRad = planet.raw.periDeg != null ? planet.raw.periDeg * DEG : 0
  const meanAnomaly =
    planet.raw.m0Deg != null
      ? meanAnomalyAt(planet.raw.m0Deg * DEG, planet.raw.periodDays, simMs)
      : planet.raw.startPhase

  const e = planet.raw.deep?.eccentricity ?? 0
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

/** Visual marker radius for bodies with no orbital Hill sphere (the Sun,
 *  distant black holes). Mass-based, sqrt-compressed, capped so the
 *  supermassive ones don't engulf the scene. Not a physical boundary —
 *  just a "this is massive" halo. */
function influenceRadius(massEarth: number): number {
  return Math.min(INFLUENCE_CAP, Math.sqrt(massEarth) * INFLUENCE_SCALE)
}

/** Real Hill-sphere radius (scene units) for a planet: the region where the
 *  planet's gravity dominates the Sun's for nearby orbits.
 *      r_H = a · (m / 3M)^(1/3)
 *  Matches sphere-of-influence.tsx exactly so the two overlays agree when
 *  both are on. A visual minimum keeps inner-planet spheres findable. */
function planetHillRadius(planet: ScenePlanet): number {
  const mass = Math.max(planet.raw.deep?.massEarth ?? 0.1, 0.001)
  const trueHill = planet.orbitRadius * Math.cbrt(mass / (3 * SUN_MASS_EARTH))
  return Math.max(HILL_VISUAL_MIN, trueHill)
}

/* --------------------------------------------------------------------------
 * Reusable temporaries
 * ------------------------------------------------------------------------ */
const _tempVec3A = new Vector3()
const _tempVec3B = new Vector3()
const _tempVec3C = new Vector3()
const _tempQuat = new Quaternion()
const _tempMatrix = new Matrix4()

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
    const simMs = simTimeRef.current.simMs
    const children = groupRef.current.children as THREE.Mesh[]
    let idx = 0

    // Sun
    if (children[idx]) {
      children[idx].position.set(0, 0, 0)
      children[idx].scale.setScalar(influenceRadius(SUN_MASS_EARTH) * 0.35)
      idx++
    }

    // Planets — real Hill sphere (physical), not the mass-halo hack.
    for (const planet of planets) {
      if (!children[idx]) continue
      const pos = planetScenePosition(planet, simMs)
      children[idx].position.copy(pos)
      children[idx].scale.setScalar(planetHillRadius(planet))
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
  // Base RGB the per-instance brightness multiplies against.
  const arrowBaseColor = useMemo(
    () => new Color(invert ? "#c95824" : "#7ec8ff"),
    [invert],
  )

  const instanceCount = GRID_SIZE * GRID_SIZE

  useFrame(() => {
    if (!meshRef.current) return
    const simMs = simTimeRef.current.simMs

    const bodies: Array<{ position: Vector3; mass: number }> = [
      { position: _tempVec3A.set(0, 0, 0), mass: SUN_MASS_EARTH },
    ]
    for (const p of planets) {
      bodies.push({
        position: planetScenePosition(p, simMs),
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

        const gVec = netGravityAt(point, bodies)
        const strength = gVec.length()

        // Gravity spans many orders of magnitude (∝ 1/r²), so a linear map
        // saturates near every mass and floors everywhere else — the field
        // ends up reading as direction-only. Map magnitude through a LOG
        // curve instead, normalised across the field's real dynamic range,
        // so a faint outer-system pull and a strong near-planet pull both
        // land somewhere readable on the arrow-length band.
        const logStrength = Math.log10(1 + strength * FIELD_STRENGTH_SCALE)
        const norm = Math.min(1, logStrength / FIELD_LOG_RANGE)

        // Length encodes magnitude (the arrow reaches further when the pull
        // is stronger); the cross-section grows only gently so strong
        // vectors read as reach, not girth — keeps the field from clotting.
        const lengthScale = ARROW_MIN_SCALE + norm * (ARROW_MAX_SCALE - ARROW_MIN_SCALE)
        const girthScale = ARROW_MIN_SCALE + norm * (ARROW_MAX_SCALE - ARROW_MIN_SCALE) * 0.4

        _tempQuat.setFromUnitVectors(
          _tempVec3C.set(0, 1, 0),
          gVec.normalize(),
        )

        _tempMatrix.compose(
          point,
          _tempQuat,
          _tempVec3A.set(girthScale, lengthScale, girthScale),
        )
        meshRef.current.setMatrixAt(instanceIdx, _tempMatrix)

        // Brightness tracks the same normalised magnitude, so strong-field
        // regions glow and faint ones recede — a second, redundant channel
        // for the same quantity (helps the colour-blind + low-contrast case).
        const alpha = ARROW_ALPHA_MIN + norm * (ARROW_ALPHA_MAX - ARROW_ALPHA_MIN)
        const colAttr = meshRef.current.instanceColor
        if (colAttr) {
          const k = alpha / ARROW_ALPHA_MAX
          colAttr.setXYZ(
            instanceIdx,
            arrowBaseColor.r * k,
            arrowBaseColor.g * k,
            arrowBaseColor.b * k,
          )
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
 * Lagrange points — the 5 Sun–planet equilibrium points
 *
 * Where the Sun's and the planet's gravity, plus the orbital centrifugal
 * term, cancel out so a small body can sit at rest relative to the pair.
 * Real spacecraft live here (JWST + Gaia at Sun–Earth L2, SOHO at L1),
 * and the Jupiter Trojans swarm L4/L5. We show them only for a couple of
 * significant planets to stay legible.
 *
 * Geometry (μ = m/(3M))^(1/3):
 *   L1  Sun-ward of the planet at  a·(1 − μ)
 *   L2  beyond the planet at        a·(1 + μ)
 *   L3  opposite the Sun at        −a·(1 + 5m/12M)
 *   L4/L5  ±60° along the orbit (equilateral with Sun + planet)
 *
 * We derive each from the planet's current scene-space position vector:
 * L1–L3 scale the radial vector, L4/L5 rotate it ±60° about the ecliptic
 * normal — valid because the scene's radial compression preserves both
 * the radial fraction and the angular offset.
 * ------------------------------------------------------------------------ */

/** Planets to annotate with Lagrange points — kept small to avoid clutter.
 *  Earth (JWST/SOHO/Gaia) and Jupiter (Trojan asteroids) are the iconic
 *  cases people recognise. */
const LAGRANGE_PLANETS = new Set(["Earth", "Jupiter"])

const _eclipticNormal = new Vector3(0, 1, 0)

type LPoint = { id: "L1" | "L2" | "L3" | "L4" | "L5"; pos: Vector3; note: string }

function lagrangePointsFor(planet: ScenePlanet, simMs: number): LPoint[] {
  const mass = Math.max(planet.raw.deep?.massEarth ?? 0.1, 0.001)
  const mu = Math.cbrt(mass / (3 * SUN_MASS_EARTH))
  const planetPos = planetScenePosition(planet, simMs)
  const radial = planetPos.clone() // Sun (origin) → planet

  const l1 = radial.clone().multiplyScalar(1 - mu)
  const l2 = radial.clone().multiplyScalar(1 + mu)
  const l3 = radial.clone().multiplyScalar(-(1 + (5 * mass) / (12 * SUN_MASS_EARTH)))
  const l4 = radial.clone().applyAxisAngle(_eclipticNormal, +60 * DEG)
  const l5 = radial.clone().applyAxisAngle(_eclipticNormal, -60 * DEG)

  return [
    { id: "L1", pos: l1, note: "SOHO" },
    { id: "L2", pos: l2, note: "JWST · Gaia" },
    { id: "L3", pos: l3, note: "far side" },
    { id: "L4", pos: l4, note: "Trojans" },
    { id: "L5", pos: l5, note: "Trojans" },
  ]
}

function LagrangeMarker({ point, invert }: { point: LPoint; invert: boolean }) {
  const color = invert ? "#9a5a2c" : "#ffd27a"
  return (
    <group position={point.pos}>
      <mesh>
        <sphereGeometry args={[0.05, 12, 12]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.85}
          blending={invert ? undefined : AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <Html center distanceFactor={26} zIndexRange={[6, 0]} style={{ pointerEvents: "none" }}>
        <div
          className="select-none whitespace-nowrap font-mono uppercase leading-none"
          style={{ color, opacity: 0.9, transform: "translateY(-12px)" }}
        >
          <span className="text-[11px] tracking-[0.18em]">{point.id}</span>
          <span className="ml-1.5 text-[8px] tracking-[0.12em] opacity-60">{point.note}</span>
        </div>
      </Html>
    </group>
  )
}

function LagrangePoints({ planets, invert }: { planets: ScenePlanet[]; invert: boolean }) {
  const targets = useMemo(
    () => planets.filter((p) => LAGRANGE_PLANETS.has(p.raw.name)),
    [planets],
  )
  const groupRef = useRef<THREE.Group>(null)

  // Reposition each marker group every frame off the live date so the
  // L-points track their planet as it orbits + the timeline scrubs.
  useFrame(() => {
    if (!groupRef.current) return
    const simMs = simTimeRef.current.simMs
    let i = 0
    for (const planet of targets) {
      const pts = lagrangePointsFor(planet, simMs)
      for (const p of pts) {
        const child = groupRef.current.children[i]
        if (child) child.position.copy(p.pos)
        i++
      }
    }
  })

  // Initial render lays out the marker groups; useFrame keeps them placed.
  const initial = useMemo(() => {
    const simMs = simTimeRef.current.simMs
    return targets.flatMap((planet) =>
      lagrangePointsFor(planet, simMs).map((pt) => ({ key: `${planet.raw.name}-${pt.id}`, pt })),
    )
  }, [targets])

  return (
    <group ref={groupRef}>
      {initial.map(({ key, pt }) => (
        <LagrangeMarker key={key} point={pt} invert={invert} />
      ))}
    </group>
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
      <LagrangePoints planets={planets} invert={invert} />
    </group>
  )
}
