"use client"

/**
 * Universe Engine — spacecraft shapes.
 *
 * Procedural illustrations for each named spacecraft. Each silhouette is
 * composed from R3F primitives — kept geometry-light (no model loads, no
 * textures) and sized to read as engineered hardware, not a generic dot.
 *
 * Each spacecraft has ONE dominant feature that identifies it from any
 * angle (Voyager's dish, JWST's sunshield, Parker's heat shield, etc).
 * The rest of the silhouette plays support. Sizes are normalised — a
 * unit bounding sphere — and the caller scales by `visualRadius × scale`.
 *
 * Sizing budget: spacecraft are deliberately smaller than the smallest
 * planet (Mercury, ~0.13 scene-units) but bigger than moons (~0.05).
 * Default scale factor lands them at ~0.2-0.27 scene-units. At default
 * camera distance they're tiny dots; the user follow-modes (double-click)
 * to see the actual silhouette.
 *
 * Materials inherit theme via `invert`. Solar panels stay deep blue
 * (PV signature) regardless of theme.
 */

import { DoubleSide, PlaneGeometry } from "three"

type ShapeProps = { invert: boolean }

/* ---------- Shared palette ---------- */

const palette = (invert: boolean) => ({
  body:        invert ? "#3a3a3a" : "#e2e6ec",
  dish:        invert ? "#1f1a14" : "#f4ede0",
  panel:       "#1a3e6b",
  panelGlint:  "#5f86b8",
  shield:      invert ? "#8a3a14" : "#fff5d6",
  rtg:         invert ? "#6b2812" : "#b25c2a",
  boom:        invert ? "#2a2a2a" : "#9aa1ad",
})

/* ============================================================
 * Voyager 1 & 2
 *
 * Silhouette: the 3.7-m high-gain dish at top dominates everything.
 * Bus is a small 10-sided polygon prism beneath it. A long magnetometer
 * boom extends sideways (real one is 13m — way out of proportion to the
 * spacecraft body), and the RTG cluster sits on a shorter opposite boom.
 *
 * The proportions are the identity: the dish is huge relative to the
 * bus, and the magnetometer boom is much longer than the spacecraft is
 * wide. Both must be true for the silhouette to read as Voyager.
 * ============================================================ */
function VoyagerShape({ invert }: ShapeProps) {
  const c = palette(invert)
  return (
    <group>
      {/* High-gain dish — large parabolic disc, faces "up" by convention.
          Made from a thin cylinder (the white face) + a back cone for the
          parabolic profile. Rendered slightly tilted toward viewer so it
          reads as 3D not flat. */}
      <group rotation={[0.25, 0, 0]} position={[0, 0.30, 0]}>
        {/* Dish face — thin cylinder */}
        <mesh>
          <cylinderGeometry args={[0.45, 0.45, 0.012, 32]} />
          <meshStandardMaterial color={c.dish} side={DoubleSide} roughness={0.5} metalness={0.25} />
        </mesh>
        {/* Dish bowl — narrowing cone behind, gives the parabolic feel */}
        <mesh position={[0, -0.06, 0]}>
          <coneGeometry args={[0.45, 0.10, 24, 1, true]} />
          <meshStandardMaterial color={c.dish} side={DoubleSide} roughness={0.5} metalness={0.25} />
        </mesh>
        {/* Subreflector / feed — small disc above the bowl centre */}
        <mesh position={[0, 0.05, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.06, 12]} />
          <meshStandardMaterial color={c.body} />
        </mesh>
      </group>

      {/* Strut between dish and bus — thin cylinder */}
      <mesh position={[0, 0.14, 0]}>
        <cylinderGeometry args={[0.022, 0.022, 0.18, 8]} />
        <meshStandardMaterial color={c.boom} />
      </mesh>

      {/* Central bus — 10-sided polygon prism, small */}
      <mesh position={[0, 0.00, 0]}>
        <cylinderGeometry args={[0.13, 0.13, 0.12, 10]} />
        <meshStandardMaterial color={c.body} metalness={0.35} roughness={0.45} />
      </mesh>

      {/* Magnetometer boom — very long, very thin, sticking out to one
          side. This is the proportion that says "Voyager." */}
      <mesh position={[0.50, 0.00, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.006, 0.006, 0.85, 6]} />
        <meshStandardMaterial color={c.boom} />
      </mesh>

      {/* RTG boom — shorter, opposite side */}
      <mesh position={[-0.22, -0.02, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.010, 0.010, 0.30, 6]} />
        <meshStandardMaterial color={c.boom} />
      </mesh>
      {/* RTG cluster — three small cylinders inline at the boom's end */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[-0.36 - i * 0.04, -0.02, 0]}>
          <cylinderGeometry args={[0.030, 0.030, 0.07, 8]} />
          <meshStandardMaterial color={c.rtg} emissive={c.rtg} emissiveIntensity={invert ? 0.0 : 0.55} />
        </mesh>
      ))}

      {/* Science boom — short, third direction (perpendicular to other booms) */}
      <mesh position={[0, -0.05, 0.18]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.22, 6]} />
        <meshStandardMaterial color={c.boom} />
      </mesh>
      {/* Camera package at end of science boom */}
      <mesh position={[0, -0.05, 0.30]}>
        <boxGeometry args={[0.06, 0.05, 0.06]} />
        <meshStandardMaterial color={c.body} />
      </mesh>
    </group>
  )
}

/* ============================================================
 * New Horizons
 *
 * Silhouette: a triangular wedge bus with a body-mounted high-gain dish
 * dominating one face. Smaller, more compact than Voyager — single RTG
 * cylinder sticks out one side. Iconic "fast-moving spacecraft" feel.
 * ============================================================ */
function NewHorizonsShape({ invert }: ShapeProps) {
  const c = palette(invert)
  return (
    <group>
      {/* High-gain dish — body-mounted to the front face, tilted slightly */}
      <group rotation={[0.4, 0, 0]} position={[0, 0.18, -0.04]}>
        <mesh>
          <cylinderGeometry args={[0.32, 0.32, 0.012, 28]} />
          <meshStandardMaterial color={c.dish} side={DoubleSide} roughness={0.5} metalness={0.25} />
        </mesh>
        <mesh position={[0, -0.05, 0]}>
          <coneGeometry args={[0.32, 0.08, 22, 1, true]} />
          <meshStandardMaterial color={c.dish} side={DoubleSide} roughness={0.5} metalness={0.25} />
        </mesh>
        {/* Feed */}
        <mesh position={[0, 0.04, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.05, 10]} />
          <meshStandardMaterial color={c.body} />
        </mesh>
      </group>

      {/* Triangular bus — render as a wedge (3-sided prism) */}
      <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 6]}>
        <cylinderGeometry args={[0.18, 0.18, 0.16, 3]} />
        <meshStandardMaterial color={c.body} metalness={0.35} roughness={0.45} />
      </mesh>

      {/* RTG — single large cylinder sticking out the side
          (New Horizons has one large RTG, not a cluster like Voyager) */}
      <mesh position={[0.30, -0.03, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.060, 0.060, 0.20, 10]} />
        <meshStandardMaterial color={c.rtg} emissive={c.rtg} emissiveIntensity={invert ? 0.0 : 0.55} />
      </mesh>
      {/* Strut connecting RTG to bus */}
      <mesh position={[0.20, -0.03, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.012, 0.012, 0.08, 6]} />
        <meshStandardMaterial color={c.boom} />
      </mesh>

      {/* Small thruster pods on the back */}
      <mesh position={[-0.12, -0.10, 0]}>
        <boxGeometry args={[0.06, 0.04, 0.06]} />
        <meshStandardMaterial color={c.body} />
      </mesh>
    </group>
  )
}

/* ============================================================
 * JWST — James Webb Space Telescope
 *
 * Silhouette: diamond/kite-shaped sunshield (5 layers, ~21m × 14m IRL)
 * + 18-hex primary mirror sitting above it. The sunshield is the
 * dominant identifier — bigger than the mirror and oriented edge-on
 * from a typical viewing angle.
 * ============================================================ */
function JWSTShape({ invert }: ShapeProps) {
  const c = palette(invert)
  return (
    <group>
      {/* Sunshield — kite/diamond shape, rendered as a thin tilted plane.
          Use planeGeometry rotated to read as a diamond not a square. */}
      <group rotation={[Math.PI / 2 - 0.15, 0, Math.PI / 4]} position={[0, -0.08, 0]}>
        {/* Five layers stacked tightly — render as separate thin planes
            so the silhouette reads as a layered shield, not a single sheet. */}
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} position={[0, 0, -i * 0.012]}>
            <planeGeometry args={[0.95, 0.62]} />
            <meshStandardMaterial
              color={c.shield}
              side={DoubleSide}
              roughness={0.3}
              metalness={0.55}
              transparent
              opacity={0.95 - i * 0.08}
            />
          </mesh>
        ))}
        {/* Border outline so the kite shape reads even at small sizes */}
        <lineSegments>
          <edgesGeometry args={[new PlaneGeometry(0.95, 0.62)]} />
          <lineBasicMaterial color={c.boom} />
        </lineSegments>
      </group>

      {/* Spacecraft bus — small box sandwiched between sunshield and mirror */}
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[0.14, 0.08, 0.14]} />
        <meshStandardMaterial color={c.body} metalness={0.5} roughness={0.4} />
      </mesh>

      {/* Primary mirror — single hex plate. Real JWST has 18 segments
          but at this scale they'd mush together; one big hex reads more
          cleanly as "the mirror." */}
      <mesh position={[0, 0.22, 0]} rotation={[0.18, 0, 0]}>
        <cylinderGeometry args={[0.36, 0.36, 0.018, 6]} />
        <meshStandardMaterial color={c.shield} metalness={0.95} roughness={0.12} />
      </mesh>

      {/* Secondary mirror tripod — three thin struts in a Y rising from
          the primary, holding a small secondary disc above. */}
      {[0, 1, 2].map((i) => {
        const angle = (i / 3) * Math.PI * 2
        const x = Math.cos(angle) * 0.18
        const z = Math.sin(angle) * 0.18
        return (
          <mesh
            key={i}
            position={[x / 2, 0.32, z / 2]}
            rotation={[Math.atan2(z, 0.18), 0, Math.atan2(x, 0.18)]}
          >
            <cylinderGeometry args={[0.006, 0.006, 0.22, 4]} />
            <meshStandardMaterial color={c.boom} />
          </mesh>
        )
      })}
      {/* Secondary mirror — small disc at the top of the tripod */}
      <mesh position={[0, 0.42, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.012, 8]} />
        <meshStandardMaterial color={c.shield} metalness={0.95} roughness={0.12} />
      </mesh>
    </group>
  )
}

/* ============================================================
 * Parker Solar Probe
 *
 * Silhouette: bright white circular heat shield (TPS) in front, small
 * spacecraft bus tucked behind it, two solar panel wings extending
 * outward. The shield is iconic — it stays sun-pointed at all times.
 * ============================================================ */
function ParkerShape({ invert }: ShapeProps) {
  const c = palette(invert)
  return (
    <group>
      {/* Heat shield (TPS) — bright white round disc */}
      <mesh position={[0, 0.30, 0]}>
        <cylinderGeometry args={[0.36, 0.36, 0.04, 24]} />
        <meshStandardMaterial
          color={c.shield}
          roughness={0.4}
          metalness={0.15}
          emissive={c.shield}
          emissiveIntensity={invert ? 0.0 : 0.3}
        />
      </mesh>
      {/* Shield rim for definition */}
      <mesh position={[0, 0.30, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.36, 0.012, 6, 32]} />
        <meshStandardMaterial color={c.boom} />
      </mesh>

      {/* Strut from shield to bus */}
      <mesh position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.016, 0.016, 0.18, 8]} />
        <meshStandardMaterial color={c.boom} />
      </mesh>

      {/* Bus — small hexagonal body behind the shield */}
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.13, 0.13, 0.20, 6]} />
        <meshStandardMaterial color={c.body} metalness={0.5} roughness={0.4} />
      </mesh>

      {/* Two solar panel wings — small rectangles. At perihelion they
          retract into the shadow; we render them in mid-position. */}
      {[-1, 1].map((dir) => (
        <group key={dir} position={[dir * 0.22, 0.05, 0]}>
          {/* Wing root strut */}
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.008, 0.008, 0.08, 4]} />
            <meshStandardMaterial color={c.boom} />
          </mesh>
          {/* Panel */}
          <mesh position={[dir * 0.12, 0, 0]}>
            <boxGeometry args={[0.20, 0.12, 0.008]} />
            <meshStandardMaterial
              color={palette(invert).panel}
              metalness={0.4}
              roughness={0.3}
              emissive={palette(invert).panelGlint}
              emissiveIntensity={invert ? 0.0 : 0.18}
            />
          </mesh>
          {/* Panel grid — a couple of internal lines */}
          <mesh position={[dir * 0.12, 0.03, 0.005]}>
            <boxGeometry args={[0.18, 0.002, 0.001]} />
            <meshStandardMaterial color={c.boom} />
          </mesh>
          <mesh position={[dir * 0.12, -0.03, 0.005]}>
            <boxGeometry args={[0.18, 0.002, 0.001]} />
            <meshStandardMaterial color={c.boom} />
          </mesh>
        </group>
      ))}

      {/* Small low-gain antenna at the back */}
      <mesh position={[0, -0.12, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.08, 6]} />
        <meshStandardMaterial color={c.boom} />
      </mesh>
    </group>
  )
}

/* ============================================================
 * Registry
 *
 * Sizing budget: spacecraft sit between moons (~0.05 scene-units) and
 * Mercury (~0.13). Visual radius declared on the body × the scale here.
 *
 * Cygnus X-1 reference: spacecraft visualRadius is ~0.05 in the catalog,
 * so final size = 0.05 × scale. We target ~0.20–0.27 scene-units —
 * smaller than every planet, bigger than every moon. At default camera
 * distance (~13 units) they're tiny; users follow-mode (double-click) to
 * get the full silhouette.
 * ============================================================ */

type ShapeEntry = {
  render: (props: ShapeProps) => React.ReactNode
  scale: number
}

export const SPACECRAFT_SHAPES: Record<string, ShapeEntry> = {
  "Voyager 1":                    { render: (p) => <VoyagerShape {...p} />,      scale: 5.0 },
  "Voyager 2":                    { render: (p) => <VoyagerShape {...p} />,      scale: 5.0 },
  "New Horizons":                 { render: (p) => <NewHorizonsShape {...p} />,  scale: 4.5 },
  "James Webb Space Telescope":   { render: (p) => <JWSTShape {...p} />,         scale: 5.5 },
  "Parker Solar Probe":           { render: (p) => <ParkerShape {...p} />,       scale: 4.0 },
}
