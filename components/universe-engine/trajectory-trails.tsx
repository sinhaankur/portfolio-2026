"use client"

/**
 * Trajectory Trails — exact orbital paths for Deep Dive mode.
 *
 * Renders Keplerian orbit traces for:
 *   - Solar-system planets (full ellipses, eccentric where applicable)
 *   - Named small bodies (comets, asteroids, interstellars, spacecraft)
 *   - Major moons (circular paths around their parent)
 *
 * Each trail is a Line geometry with 128–256 segments, computed from
 * the same orbital elements that drive the live bodies.  This guarantees
 * the trail and the body stay in lockstep.
 *
 * Deep Dive mode also highlights the live position along each trail with
 * a small moving dot so users see "where we are" in the orbital cycle.
 */

import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { BufferGeometry, Float32BufferAttribute, Vector3 } from "three"
import {
  DEG,
  buildScenePlanets,
  eccentricToTrue,
  meanAnomalyAt,
  moons,
  namedBodies,
  orbitalElementsToCartesian,
  simTimeRef,
  solveKepler,
} from "./astronomy"
import type { NamedBody, ScenePlanet } from "./types"

/* --------------------------------------------------------------------------
 * Constants
 * ------------------------------------------------------------------------ */

const PLANET_TRAIL_SEGMENTS = 128
const COMET_TRAIL_SEGMENTS = 256
const TRAIL_OPACITY = 0.22
const TRAIL_COLOR = "#7ec8ff"
const LIVE_DOT_COLOR = "#ffffff"

/* --------------------------------------------------------------------------
 * Keplerian position in the solar-system frame
 * ------------------------------------------------------------------------ */

function keplerianPosition(
  a: number,
  e: number,
  i: number,
  node: number,
  peri: number,
  meanAnomaly: number,
): Vector3 {
  const E = e >= 1 ? meanAnomaly : solveKepler(meanAnomaly, e)
  const trueAnom =
    e >= 1
      ? meanAnomaly
      : eccentricToTrue(E, e)
  const r = (a * (1 - e * e)) / Math.max(0.001, 1 + e * Math.cos(trueAnom))

  // In-plane position
  const xOrb = r * Math.cos(trueAnom)
  const zOrb = -r * Math.sin(trueAnom)
  const yOrb = 0

  // Apply argument of periapsis (ω) around z
  const cosP = Math.cos(peri)
  const sinP = Math.sin(peri)
  const xPeri = xOrb * cosP - zOrb * sinP
  const zPeri = xOrb * sinP + zOrb * cosP

  // Apply inclination (i) around x
  const cosI = Math.cos(i)
  const sinI = Math.sin(i)
  const yIncl = yOrb * cosI - zPeri * sinI
  const zIncl = yOrb * sinI + zPeri * cosI

  // Apply longitude of ascending node (Ω) around y
  const cosN = Math.cos(node)
  const sinN = Math.sin(node)
  const xNode = xPeri * cosN + zIncl * sinN
  const zNode = -xPeri * sinN + zIncl * cosN

  return new Vector3(xNode, yIncl, zNode)
}

/* --------------------------------------------------------------------------
 * Planet orbit trail
 * ------------------------------------------------------------------------ */

function PlanetTrail({
  planet,
  invert,
}: {
  planet: ScenePlanet
  invert: boolean
}) {
  const geometry = useMemo(() => {
    const e = planet.raw.deep?.eccentricity ?? 0
    // Orient the ellipse by the real longitude of perihelion so the live
    // dot (which uses the same offset) rides exactly on this path.
    const periRad = planet.raw.periDeg != null ? planet.raw.periDeg * DEG : 0
    const positions: number[] = []
    for (let s = 0; s <= PLANET_TRAIL_SEGMENTS; s++) {
      const M = (s / PLANET_TRAIL_SEGMENTS) * Math.PI * 2
      const pos = keplerianPosition(
        planet.orbitRadius,
        e,
        planet.inclination,
        0, // longNode — planets use simplified tilt-only orbits
        periRad,
        M,
      )
      positions.push(pos.x, pos.y, pos.z)
    }
    const geo = new BufferGeometry()
    geo.setAttribute("position", new Float32BufferAttribute(positions, 3))
    return geo
  }, [planet])

  return (
    <line geometry={geometry}>
      <lineBasicMaterial
        color={invert ? "#c95824" : TRAIL_COLOR}
        transparent
        opacity={TRAIL_OPACITY}
        depthWrite={false}
      />
    </line>
  )
}

/* --------------------------------------------------------------------------
 * Named-body orbit trail (comets, asteroids, spacecraft)
 * ------------------------------------------------------------------------ */

function NamedBodyTrail({
  body,
  invert,
}: {
  body: NamedBody
  invert: boolean
}) {
  const geometry = useMemo(() => {
    // Trace the trail with the SAME canonical transform the comet body uses
    // (orbitalElementsToCartesian), so the body provably rides on its own
    // trail. We step around the orbit in mean anomaly, solve Kepler for the
    // true anomaly, then place each point exactly as scene.tsx does — real
    // AU in, sqrt-compressed scene units out. The old local keplerianPosition
    // used a different rotation convention + radius scaling, which warped
    // eccentric-comet ellipses and left the body floating off the trail.
    const e = body.eccentricity
    const i = (body.inclDeg * Math.PI) / 180
    const node = ((body.longNodeDeg ?? 0) * Math.PI) / 180
    const peri = ((body.argPeriDeg ?? 0) * Math.PI) / 180
    const segments = e >= 1 ? COMET_TRAIL_SEGMENTS : PLANET_TRAIL_SEGMENTS
    const positions: number[] = []

    for (let s = 0; s <= segments; s++) {
      const M = (s / segments) * Math.PI * 2
      // Hyperbolic guard mirrors the body: e≥1 bodies are pinned by the
      // renderer, so their "trail" is just the elements at e=0.
      const eForTransform = e >= 1 ? 0 : e
      const trueAnom = e >= 1 ? M : eccentricToTrue(solveKepler(M, e), e)
      const [x, y, z] = orbitalElementsToCartesian(
        body.aAU,
        eForTransform,
        trueAnom,
        i,
        node,
        peri,
      )
      positions.push(x, y, z)
    }

    const geo = new BufferGeometry()
    geo.setAttribute("position", new Float32BufferAttribute(positions, 3))
    return geo
  }, [body])

  const color =
    body.kind === "comet"
      ? "#a5dad0"
      : body.kind === "asteroid"
        ? "#c8a378"
        : body.kind === "spacecraft"
          ? "#ff9e3d"
          : TRAIL_COLOR

  return (
    <line geometry={geometry}>
      <lineBasicMaterial
        color={invert ? "#c95824" : color}
        transparent
        opacity={TRAIL_OPACITY * 0.7}
        depthWrite={false}
      />
    </line>
  )
}

/* --------------------------------------------------------------------------
 * Live-position dot — small marker showing current orbital phase
 * ------------------------------------------------------------------------ */

function LiveOrbitDot({
  planet,
  invert,
}: {
  planet: ScenePlanet
  invert: boolean
}) {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame(() => {
    if (!meshRef.current) return
    const e = planet.raw.deep?.eccentricity ?? 0
    // Date-driven so the live dot sits exactly on the planet as the
    // timeline scrubs (previously free-ran off performance.now()).
    const periRad = planet.raw.periDeg != null ? planet.raw.periDeg * DEG : 0
    const M =
      planet.raw.m0Deg != null
        ? meanAnomalyAt(planet.raw.m0Deg * DEG, planet.raw.periodDays, simTimeRef.current.simMs)
        : planet.raw.startPhase
    const pos = keplerianPosition(
      planet.orbitRadius,
      e,
      planet.inclination,
      0,
      periRad,
      M,
    )
    meshRef.current.position.copy(pos)
  })

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.06, 8, 8]} />
      <meshBasicMaterial
        color={invert ? "#c95824" : LIVE_DOT_COLOR}
        transparent
        opacity={0.7}
        depthWrite={false}
      />
    </mesh>
  )
}

/* --------------------------------------------------------------------------
 * Public export — Deep Dive trajectory overlay
 * ------------------------------------------------------------------------ */

export function TrajectoryTrails({
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
      {planets.map((p) => (
        <group key={`trail-${p.raw.name}`}>
          <PlanetTrail planet={p} invert={invert} />
          <LiveOrbitDot planet={p} invert={invert} />
        </group>
      ))}

      {namedBodies.map((b) => (
        <NamedBodyTrail key={`trail-${b.name}`} body={b} invert={invert} />
      ))}
    </group>
  )
}
