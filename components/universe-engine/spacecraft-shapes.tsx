"use client"

/**
 * Universe Engine — spacecraft shapes.
 *
 * Procedural illustrations for each named spacecraft in the catalog. Each
 * shape is composed from R3F primitives (box, cylinder, plane) so it
 * stays geometry-light (no model loads, no textures) but reads as the
 * actual hardware rather than a generic dot.
 *
 * Sizes are normalised — the whole shape fits within a unit bounding
 * sphere — so the parent can scale by `visualRadius * factor` to keep
 * spacecraft proportional to the rest of the scene.
 *
 * Materials inherit theme via the `invert` prop: warm-amber accents in
 * dark mode, ink-on-cream in chart mode. Solar panels stay metallic
 * blue regardless so they read as photovoltaic surfaces.
 *
 * To add another spacecraft:
 *   1. Add a component below.
 *   2. Register it in SPACECRAFT_SHAPES.
 *   3. Done — NamedBodyMesh picks it up by spacecraft name.
 */

import { DoubleSide } from "three"

type ShapeProps = { invert: boolean }

/* ---------- Shared palette ---------- */

const palette = (invert: boolean) => ({
  // Spacecraft bus / hardware body — cool silver-white in dark, dark grey in chart mode.
  body:        invert ? "#3a3a3a" : "#e2e6ec",
  // Antenna dishes — slightly warmer
  dish:        invert ? "#1f1a14" : "#f4ede0",
  // Solar panels — characteristic deep blue regardless of theme so they read as PV
  panel:       "#1a3e6b",
  panelGlint:  "#5f86b8",
  // Heat shield (Parker) / sunshield (JWST) — bright reflective
  shield:      invert ? "#8a3a14" : "#fff5d6",
  // RTG (radioisotope thermoelectric generator) — warm copper glow
  rtg:         invert ? "#6b2812" : "#b25c2a",
  // Booms + structural lines
  boom:        invert ? "#2a2a2a" : "#9aa1ad",
})

/* ---------- Voyager 1 & 2 ---------- */
/**
 * The Voyagers' silhouette is dominated by the 3.7m high-gain dish at the
 * top, with the bus + RTGs hanging below and two long booms sticking out
 * sideways (magnetometer, science). Both spacecraft are nearly identical
 * — same shape, different orientation/trajectory in the catalog.
 */
function VoyagerShape({ invert }: ShapeProps) {
  const c = palette(invert)
  return (
    <group>
      {/* High-gain dish — large parabolic antenna at the top */}
      <mesh position={[0, 0.42, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.55, 0.18, 24, 1, true]} />
        <meshStandardMaterial color={c.dish} side={DoubleSide} roughness={0.6} metalness={0.2} />
      </mesh>
      {/* Dish rim */}
      <mesh position={[0, 0.33, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.55, 0.012, 8, 32]} />
        <meshStandardMaterial color={c.boom} />
      </mesh>
      {/* Feed (small bit hanging in the dish centre) */}
      <mesh position={[0, 0.18, 0]}>
        <boxGeometry args={[0.06, 0.10, 0.06]} />
        <meshStandardMaterial color={c.body} />
      </mesh>
      {/* Central bus — a small 10-sided polygon prism flattened to a box */}
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.20, 10]} />
        <meshStandardMaterial color={c.body} metalness={0.3} roughness={0.5} />
      </mesh>
      {/* Magnetometer boom — long thin cylinder extending to one side */}
      <mesh position={[0.55, 0.05, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.012, 0.012, 0.9, 6]} />
        <meshStandardMaterial color={c.boom} />
      </mesh>
      {/* Science boom — extends opposite */}
      <mesh position={[-0.30, -0.05, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.014, 0.014, 0.45, 6]} />
        <meshStandardMaterial color={c.boom} />
      </mesh>
      {/* RTG cluster on the science boom end */}
      <mesh position={[-0.52, -0.05, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.16, 8]} />
        <meshStandardMaterial color={c.rtg} emissive={c.rtg} emissiveIntensity={invert ? 0.0 : 0.5} />
      </mesh>
    </group>
  )
}

/* ---------- New Horizons ---------- */
/**
 * Triangular bus with a single big dish + a small RTG sticking out one
 * end. Smaller and more compact than the Voyagers.
 */
function NewHorizonsShape({ invert }: ShapeProps) {
  const c = palette(invert)
  return (
    <group>
      {/* Dish */}
      <mesh position={[0, 0.30, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.38, 0.14, 24, 1, true]} />
        <meshStandardMaterial color={c.dish} side={DoubleSide} roughness={0.6} metalness={0.2} />
      </mesh>
      {/* Bus — triangular wedge */}
      <mesh position={[0, 0.06, 0]}>
        <boxGeometry args={[0.34, 0.16, 0.22]} />
        <meshStandardMaterial color={c.body} metalness={0.3} roughness={0.5} />
      </mesh>
      {/* RTG — sticking out one side */}
      <mesh position={[0.28, 0.04, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.05, 0.05, 0.20, 8]} />
        <meshStandardMaterial color={c.rtg} emissive={c.rtg} emissiveIntensity={invert ? 0.0 : 0.5} />
      </mesh>
      {/* Connecting strut */}
      <mesh position={[0.18, 0.04, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.012, 0.012, 0.10, 6]} />
        <meshStandardMaterial color={c.boom} />
      </mesh>
    </group>
  )
}

/* ---------- JWST (James Webb Space Telescope) ---------- */
/**
 * Five-layer sunshield (rendered as one tilted plane) dominates the
 * silhouette, with the hexagonal-mirror array tucked above. The mirror
 * is simplified to a single hexagon ring; the actual JWST has 18 segments
 * but rendering them at this scale would mush together.
 */
function JWSTShape({ invert }: ShapeProps) {
  const c = palette(invert)
  return (
    <group>
      {/* Sunshield — large diamond-shaped tilted plane below the mirror */}
      <mesh position={[0, -0.10, 0]} rotation={[Math.PI / 2 - 0.18, Math.PI / 4, 0]}>
        <planeGeometry args={[1.0, 0.7]} />
        <meshStandardMaterial color={c.shield} side={DoubleSide} roughness={0.3} metalness={0.4} />
      </mesh>
      {/* Sunshield outline / strut */}
      <mesh position={[0, -0.10, 0]} rotation={[Math.PI / 2 - 0.18, Math.PI / 4, 0]}>
        <ringGeometry args={[0.48, 0.50, 4]} />
        <meshBasicMaterial color={c.boom} side={DoubleSide} />
      </mesh>
      {/* Bus — sandwiched between sunshield and mirror */}
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[0.18, 0.10, 0.14]} />
        <meshStandardMaterial color={c.body} metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Primary mirror — hexagonal segments approximated as a single thin hex */}
      <mesh position={[0, 0.22, 0]} rotation={[0.18, 0, 0]}>
        <cylinderGeometry args={[0.42, 0.42, 0.02, 6]} />
        <meshStandardMaterial color={c.shield} metalness={0.9} roughness={0.15} />
      </mesh>
      {/* Secondary mirror tripod — three thin struts above the primary */}
      <mesh position={[0, 0.30, 0]}>
        <cylinderGeometry args={[0.01, 0.01, 0.16, 6]} />
        <meshStandardMaterial color={c.boom} />
      </mesh>
      {/* Secondary mirror itself — tiny puck at the top of the tripod */}
      <mesh position={[0, 0.40, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.015, 8]} />
        <meshStandardMaterial color={c.shield} metalness={0.9} roughness={0.15} />
      </mesh>
    </group>
  )
}

/* ---------- Parker Solar Probe ---------- */
/**
 * The Parker silhouette is the white heat shield in front, the
 * spacecraft bus tucked behind it, and two solar panel wings folded
 * close (since at perihelion they retract to stay in the shield's shadow).
 */
function ParkerShape({ invert }: ShapeProps) {
  const c = palette(invert)
  return (
    <group>
      {/* Heat shield — bright white hexagonal disc facing the Sun (oriented
          so the disc is upright in the spacecraft frame). */}
      <mesh position={[0, 0.30, 0]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0.40, 0.40, 0.035, 8]} />
        <meshStandardMaterial color={c.shield} metalness={0.2} roughness={0.45} emissive={c.shield} emissiveIntensity={invert ? 0.0 : 0.25} />
      </mesh>
      {/* Bus — directly behind the heat shield */}
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[0.22, 0.30, 0.18]} />
        <meshStandardMaterial color={c.body} metalness={0.4} roughness={0.5} />
      </mesh>
      {/* Solar panels — two small wings tucked close to the bus */}
      <mesh position={[-0.22, 0.05, 0]} rotation={[0, 0, 0]}>
        <boxGeometry args={[0.20, 0.10, 0.012]} />
        <meshStandardMaterial color={palette(invert).panel} metalness={0.4} roughness={0.3} emissive={palette(invert).panelGlint} emissiveIntensity={invert ? 0.0 : 0.15} />
      </mesh>
      <mesh position={[0.22, 0.05, 0]} rotation={[0, 0, 0]}>
        <boxGeometry args={[0.20, 0.10, 0.012]} />
        <meshStandardMaterial color={palette(invert).panel} metalness={0.4} roughness={0.3} emissive={palette(invert).panelGlint} emissiveIntensity={invert ? 0.0 : 0.15} />
      </mesh>
      {/* High-gain antenna — small dish on top */}
      <mesh position={[0, -0.10, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.12, 0.06, 16, 1, true]} />
        <meshStandardMaterial color={c.dish} side={DoubleSide} roughness={0.6} />
      </mesh>
    </group>
  )
}

/* ---------- Registry ---------- */

type ShapeEntry = {
  render: (props: ShapeProps) => React.ReactNode
  /** Multiplier on the body's visualRadius to set the spacecraft's footprint.
   * Spacecraft are tiny in real life — to read as hardware we scale them up
   * vs. the catalog default. The per-entry value tunes by silhouette. */
  scale: number
}

export const SPACECRAFT_SHAPES: Record<string, ShapeEntry> = {
  "Voyager 1":                    { render: (p) => <VoyagerShape {...p} />,      scale: 14 },
  "Voyager 2":                    { render: (p) => <VoyagerShape {...p} />,      scale: 14 },
  "New Horizons":                 { render: (p) => <NewHorizonsShape {...p} />,  scale: 14 },
  "James Webb Space Telescope":   { render: (p) => <JWSTShape {...p} />,         scale: 18 },
  "Parker Solar Probe":           { render: (p) => <ParkerShape {...p} />,       scale: 14 },
}
