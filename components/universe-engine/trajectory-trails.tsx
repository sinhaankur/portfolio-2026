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
import { BufferGeometry, Float32BufferAttribute } from "three"
import type * as THREE from "three"
import "./three-line"
import {
  DEG,
  buildScenePlanets,
  eccentricToTrue,
  meanAnomalyAt,
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
 * Canonical planet placement — the SINGLE source of truth for both the trail
 * and the live dot, mirroring exactly how PlanetMesh places the body in
 * scene.tsx: local (r,0,0) inside an orbitRef rotated by (trueAnom+periRad)
 * about Y, inside an outer group tilted by `inclination` about X. r uses the
 * sqrt-compressed scene radius (planet.orbitRadius), NOT raw AU.
 * ------------------------------------------------------------------------ */
function planetTrailPoint(
  planet: ScenePlanet,
  e: number,
  periRad: number,
  M: number,
): [number, number, number] {
  const trueAnom = e > 0.01 ? eccentricToTrue(solveKepler(M, e), e) : M
  const r = (planet.orbitRadius * (1 - e * e)) / (1 + e * Math.cos(trueAnom))
  const ang = trueAnom + periRad
  const x = r * Math.cos(ang)
  const zFlat = -r * Math.sin(ang)
  const cosI = Math.cos(planet.inclination)
  const sinI = Math.sin(planet.inclination)
  return [x, -zFlat * sinI, zFlat * cosI]
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
    const periRad = planet.raw.periDeg != null ? planet.raw.periDeg * DEG : 0
    const positions: number[] = []
    // Trace the trail with the EXACT transform the live planet body uses in
    // scene.tsx (see the PlanetMesh useFrame): the planet sits at local
    // (r, 0, 0) inside an orbitRef rotated by (trueAnom + periRad) about Y,
    // inside an outer group tilted by `inclination` about X. r uses the
    // sqrt-compressed scene radius `planet.orbitRadius` — NOT a raw AU. The
    // old local keplerianPosition used a different formulation + radius, which
    // left the trail misaligned with the planet. Mirroring it exactly keeps
    // the body provably on its own trail.
    for (let s = 0; s <= PLANET_TRAIL_SEGMENTS; s++) {
      const M = (s / PLANET_TRAIL_SEGMENTS) * Math.PI * 2
      const [x, y, z] = planetTrailPoint(planet, e, periRad, M)
      positions.push(x, y, z)
    }
    const geo = new BufferGeometry()
    geo.setAttribute("position", new Float32BufferAttribute(positions, 3))
    return geo
  }, [planet])

  return (
    <threeLine geometry={geometry}>
      <lineBasicMaterial
        color={invert ? "#c95824" : TRAIL_COLOR}
        transparent
        opacity={TRAIL_OPACITY}
        depthWrite={false}
      />
    </threeLine>
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

    if (e >= 1) {
      // ESCAPE TRAJECTORY (Voyagers, Pioneers, New Horizons, interstellars).
      // These bodies are PINNED by the renderer at r = aAU along their escape
      // direction (their aAU is a positioning value, not a true hyperbola semi-
      // major axis), and the polar-form r blows up for e>1. So — matching the
      // proven small-bodies escape trail — draw a STRAIGHT outbound ray from the
      // Sun out to ~1.2× the body's escape position, using the SAME transform
      // that pins the body (e=0, θ=0). This is the "path out from Earth/Sun into
      // the universe" the craft actually rode, and it provably meets the body.
      const [ex, ey, ez] = orbitalElementsToCartesian(body.aAU * 1.2, 0, 0, i, node, peri)
      for (let s = 0; s <= segments; s++) {
        const f = s / segments
        positions.push(ex * f, ey * f, ez * f)
      }
    } else {
      for (let s = 0; s <= segments; s++) {
        const M = (s / segments) * Math.PI * 2
        const trueAnom = eccentricToTrue(solveKepler(M, e), e)
        const [x, y, z] = orbitalElementsToCartesian(body.aAU, e, trueAnom, i, node, peri)
        positions.push(x, y, z)
      }
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
    <threeLine geometry={geometry}>
      <lineBasicMaterial
        color={invert ? "#c95824" : color}
        transparent
        opacity={TRAIL_OPACITY * 0.7}
        depthWrite={false}
      />
    </threeLine>
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
    const periRad = planet.raw.periDeg != null ? planet.raw.periDeg * DEG : 0
    // Date-driven mean anomaly → true anomaly, then the SAME transform the
    // trail + live planet body use, so the dot rides exactly on its trail.
    const M =
      planet.raw.m0Deg != null
        ? meanAnomalyAt(planet.raw.m0Deg * DEG, planet.raw.periodDays, simTimeRef.current.simMs)
        : planet.raw.startPhase
    const p = planetTrailPoint(planet, e, periRad, M)
    meshRef.current.position.set(p[0], p[1], p[2])
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
  const planets = useMemo(() => buildScenePlanets(), [])

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
