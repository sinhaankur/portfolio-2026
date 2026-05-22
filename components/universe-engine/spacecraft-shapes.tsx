"use client"

/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine — see ./index.tsx for the full notice.
 * https://github.com/sinhaankur/Portfolio/blob/main/LICENSE
 *
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

/* ============================================================
 * Lucy
 *
 * Silhouette: two enormous circular solar arrays (7.3 m diameter each
 * in reality) sticking out from a small central bus — the largest
 * deployable circular arrays ever flown. They are the identifier. The
 * bus itself is almost invisible between them.
 * ============================================================ */
function LucyShape({ invert }: ShapeProps) {
  const c = palette(invert)
  return (
    <group>
      {/* Central bus — small octagonal prism */}
      <mesh>
        <cylinderGeometry args={[0.08, 0.08, 0.18, 8]} />
        <meshStandardMaterial color={c.body} metalness={0.4} roughness={0.6} />
      </mesh>
      {/* Twin circular solar arrays — Lucy's signature, equator-mounted
          on opposite sides. Sized way larger than the bus on purpose. */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.5, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh>
            <cylinderGeometry args={[0.42, 0.42, 0.015, 36]} />
            <meshStandardMaterial color={c.panel} metalness={0.7} roughness={0.3} />
          </mesh>
          {/* Concentric ring detail so the arrays read as the segmented
              fan-petal pattern Lucy actually uses (UltraFlex design). */}
          <mesh position={[0, 0.009, 0]}>
            <cylinderGeometry args={[0.42, 0.42, 0.001, 36, 1, true]} />
            <meshBasicMaterial color={c.panelGlint} side={DoubleSide} />
          </mesh>
          <mesh position={[0, 0.009, 0]}>
            <cylinderGeometry args={[0.21, 0.21, 0.002, 24, 1, true]} />
            <meshBasicMaterial color={c.panelGlint} side={DoubleSide} />
          </mesh>
        </group>
      ))}
      {/* High-gain antenna dish on top */}
      <mesh position={[0, 0.18, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.12, 0.06, 16, 1, true]} />
        <meshStandardMaterial color={c.dish} side={DoubleSide} roughness={0.4} />
      </mesh>
    </group>
  )
}

/* ============================================================
 * Hayabusa2 / OSIRIS-APEX — flat-paneled inner-system probes
 *
 * Both share the asteroid-rendezvous spacecraft form: rectangular box
 * bus with TWO flat solar wings deployed sideways, and a sample / arm
 * apparatus extending downward (Hayabusa's horn-shaped sampler vs
 * OSIRIS's TAGSAM arm). Compact shape factory shared by both with a
 * small variant flag.
 * ============================================================ */
function AsteroidProbeShape({ invert, variant }: ShapeProps & { variant: "hayabusa" | "osiris" }) {
  const c = palette(invert)
  return (
    <group>
      {/* Box bus */}
      <mesh>
        <boxGeometry args={[0.22, 0.18, 0.22]} />
        <meshStandardMaterial color={c.body} metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Twin flat solar panels — long rectangles either side */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.42, 0, 0]}>
          <boxGeometry args={[0.55, 0.005, 0.20]} />
          <meshStandardMaterial color={c.panel} metalness={0.6} roughness={0.3} />
        </mesh>
      ))}
      {/* Hayabusa's sample horn (centered tube) vs OSIRIS's TAGSAM arm
          (offset, longer reach). Both extend downward from the bus. */}
      {variant === "hayabusa" ? (
        <mesh position={[0, -0.18, 0]}>
          <cylinderGeometry args={[0.025, 0.04, 0.18, 12]} />
          <meshStandardMaterial color={c.boom} roughness={0.6} />
        </mesh>
      ) : (
        <group position={[0.05, -0.18, 0]} rotation={[0, 0, -0.3]}>
          <mesh>
            <cylinderGeometry args={[0.012, 0.012, 0.28, 8]} />
            <meshStandardMaterial color={c.boom} roughness={0.6} />
          </mesh>
          <mesh position={[0, -0.15, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 0.025, 16]} />
            <meshStandardMaterial color={c.body} metalness={0.5} roughness={0.4} />
          </mesh>
        </group>
      )}
      {/* High-gain antenna dish on top */}
      <mesh position={[0, 0.13, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.09, 0.05, 12, 1, true]} />
        <meshStandardMaterial color={c.dish} side={DoubleSide} roughness={0.4} />
      </mesh>
    </group>
  )
}

/* ============================================================
 * BepiColombo
 *
 * Silhouette: stacked composite — Mercury Transfer Module (with its
 * giant solar wings) on bottom, the two orbiters (MPO + MIO) stacked
 * on top. The arrays are angled differently from Earth probes because
 * they're managing extreme heat near Mercury.
 * ============================================================ */
function BepiColomboShape({ invert }: ShapeProps) {
  const c = palette(invert)
  return (
    <group>
      {/* Mercury Transfer Module (bottom) — with twin angled solar wings */}
      <mesh position={[0, -0.18, 0]}>
        <boxGeometry args={[0.22, 0.10, 0.22]} />
        <meshStandardMaterial color={c.body} metalness={0.45} roughness={0.5} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.5, -0.18, 0]} rotation={[0, 0, side * 0.25]}>
          <boxGeometry args={[0.6, 0.005, 0.18]} />
          <meshStandardMaterial color={c.panel} metalness={0.6} roughness={0.3} />
        </mesh>
      ))}
      {/* MPO — Mercury Planetary Orbiter (middle box) */}
      <mesh position={[0, -0.05, 0]}>
        <boxGeometry args={[0.18, 0.14, 0.18]} />
        <meshStandardMaterial color={c.shield} roughness={0.55} />
      </mesh>
      {/* MIO — Mercury Magnetospheric Orbiter (octagonal top) */}
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.10, 0.10, 0.10, 8]} />
        <meshStandardMaterial color={c.body} metalness={0.45} roughness={0.5} />
      </mesh>
      {/* High-gain antenna */}
      <mesh position={[0, 0.18, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.08, 0.05, 12, 1, true]} />
        <meshStandardMaterial color={c.dish} side={DoubleSide} roughness={0.4} />
      </mesh>
    </group>
  )
}

type ShapeEntry = {
  render: (props: ShapeProps) => React.ReactNode
  scale: number
}

export const SPACECRAFT_SHAPES: Record<string, ShapeEntry> = {
  "Voyager 1":                    { render: (p) => <VoyagerShape {...p} />,      scale: 5.0 },
  "Voyager 2":                    { render: (p) => <VoyagerShape {...p} />,      scale: 5.0 },
  "New Horizons":                 { render: (p) => <NewHorizonsShape {...p} />,  scale: 4.5 },
  "James Webb Space Telescope":   { render: (p) => <JWSTShape {...p} />,         scale: 3.0 },
  "Parker Solar Probe":           { render: (p) => <ParkerShape {...p} />,       scale: 4.0 },
  // Pioneers 10 / 11 share the Voyager-era high-gain antenna + RTG boom
  // hardware — close enough to reuse the shape rather than draw a near
  // duplicate. Different mission, same silhouette family.
  "Pioneer 10":                   { render: (p) => <VoyagerShape {...p} />,      scale: 4.5 },
  "Pioneer 11":                   { render: (p) => <VoyagerShape {...p} />,      scale: 4.5 },
  // Inner-system probes — distinctive silhouettes per craft so the four
  // active missions stop looking identical at the eyepiece.
  "Lucy":                         { render: (p) => <LucyShape {...p} />,         scale: 5.0 },
  "Hayabusa2":                    { render: (p) => <AsteroidProbeShape {...p} variant="hayabusa" />, scale: 4.0 },
  "OSIRIS-APEX":                  { render: (p) => <AsteroidProbeShape {...p} variant="osiris" />,   scale: 4.0 },
  "BepiColombo":                  { render: (p) => <BepiColomboShape {...p} />,  scale: 4.2 },
}
