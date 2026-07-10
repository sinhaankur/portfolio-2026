"use client"

/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine — see ./index.tsx for the full notice.
 * https://github.com/sinhaankur/portfolio-2026/blob/main/LICENSE
 *
 * Universe Engine — Constellation sub-engine.
 *
 * The seven-figure catalog (Big Dipper, Polaris, Orion, Cassiopeia, Leo,
 * Lyra, Cygnus) lives in astronomy.ts; this renders it:
 *   - AsterismLine          the connect-the-dots asterism segments
 *   - ConstellationStarMesh  each member star (halo + honest lore/inference)
 *   - EdgeHitZone            invisible thick hover targets along each edge
 *   - ConstellationGroup     one constellation: line + figure + label + stars
 *   - Constellations         the whole catalog, with single-active hover state
 *
 * Consumers (scene.tsx) mount <Constellations onHover onResetView invert />.
 * Stars project from real J2000 RA/Dec onto the sky-shell around the Sun.
 */

import { useState, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { Html } from "@react-three/drei"
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Mesh,
  NormalBlending,
} from "three"

import {
  constellations,
  magToVisualRadius,
  raDecToScenePos,
  SKY_SHELL_DISTANCE,
} from "./astronomy"
import { CONSTELLATION_FIGURES } from "./constellation-figures"
import { WebGLLabel } from "./webgl-label"
import type {
  Constellation,
  ConstellationId,
  ConstellationStar,
  HoverHandler,
} from "./types"

/* ============================================================
 * Constellations
 *
 * The catalog (Big Dipper, Polaris, Orion, Cassiopeia, Leo, Lyra, Cygnus)
 * lives in astronomy.ts. Each constellation carries member stars + an edges
 * list that names which pairs the asterism line connects.
 *
 * Hover behavior: pointing at ANY star or asterism segment activates the
 * whole constellation. Active state lerps every frame:
 *   - member stars scale up and grow a warm halo
 *   - asterism lines brighten + warm to a constellation accent
 *
 * Polaris is a single-star "constellation" with `clickAction: 'reset-view'`,
 * so clicking it resets the camera to its initial framing.
 * ============================================================ */

type LineMatRef = import("three").LineBasicMaterial

function AsterismLine({
  stars,
  edges,
  active,
  invert = false,
}: {
  stars: ConstellationStar[]
  edges: [number, number][]
  active: boolean
  invert?: boolean
}) {
  const matRef = useRef<LineMatRef>(null)
  // Chart-mode (light theme): ink hairlines that flush warmer amber on hover,
  // mimicking how a vintage map annotates traced constellations in red-orange.
  const colorTarget = useMemo(() => new Color(invert ? "#0a0a0a" : "#ffffff"), [invert])
  const colorActive = useMemo(() => new Color(invert ? "#b34a13" : "#ffd66b"), [invert])
  // Idle opacity is higher in chart mode — dark ink on cream needs to read
  // without the additive bloom that helps it pop against deep space.
  const idleOpacity = invert ? 0.45 : 0.18
  const activeOpacity = invert ? 0.95 : 0.9

  const geometry = useMemo(() => {
    if (edges.length === 0) {
      const geo = new BufferGeometry()
      geo.setAttribute("position", new BufferAttribute(new Float32Array(0), 3))
      return geo
    }
    const arr = new Float32Array(edges.length * 2 * 3)
    edges.forEach(([a, b], i) => {
      const pa = raDecToScenePos(stars[a].raHours, stars[a].decDeg, SKY_SHELL_DISTANCE)
      const pb = raDecToScenePos(stars[b].raHours, stars[b].decDeg, SKY_SHELL_DISTANCE)
      arr[i * 6]     = pa[0]
      arr[i * 6 + 1] = pa[1]
      arr[i * 6 + 2] = pa[2]
      arr[i * 6 + 3] = pb[0]
      arr[i * 6 + 4] = pb[1]
      arr[i * 6 + 5] = pb[2]
    })
    const geo = new BufferGeometry()
    geo.setAttribute("position", new BufferAttribute(arr, 3))
    return geo
  }, [stars, edges])

  // Lerp opacity + color toward target each frame for a smooth highlight.
  useFrame((_, delta) => {
    if (!matRef.current) return
    const targetOpacity = active ? activeOpacity : idleOpacity
    const k = 1 - Math.exp(-delta * 8)
    matRef.current.opacity += (targetOpacity - matRef.current.opacity) * k
    matRef.current.color.lerp(active ? colorActive : colorTarget, k)
  })

  if (edges.length === 0) return null

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial
        ref={matRef as React.Ref<LineMatRef>}
        color={invert ? "#0a0a0a" : "#ffffff"}
        transparent
        opacity={idleOpacity}
        depthWrite={false}
      />
    </lineSegments>
  )
}

/**
 * Constellation stars are real stars, but for most the detailed composition isn't
 * pinned down here. This returns an HONEST exploration line: known facts for the
 * well-studied headline stars, otherwise a clearly-labelled INFERENCE of what the
 * star is likely like, derived only from its apparent magnitude (a real cue to
 * luminosity class) — never presenting a guess as measured fact.
 */
const CONSTELLATION_STAR_LORE: Record<string, { type: string; note: string }> = {
  Betelgeuse: { type: "Red supergiant (M1-2)", note: "~700× the Sun's radius; nearing the end of its life — a future supernova." },
  Rigel:      { type: "Blue supergiant (B8)", note: "~120,000× the Sun's luminosity, ~860 ly away — far hotter and younger than Betelgeuse." },
  Bellatrix:  { type: "Blue giant (B2)", note: "Hot, ~6× the Sun's mass; Orion's left shoulder." },
  Aldebaran:  { type: "Orange giant (K5)", note: "A cooling red giant ~65 ly away — the fiery eye of Taurus." },
  Antares:    { type: "Red supergiant (M1)", note: "The 'rival of Mars' — vast and cool, a future supernova at the heart of Scorpius." },
  Spica:      { type: "Hot blue binary (B1)", note: "Two scorching blue stars orbiting every ~4 days, mutually distorted by gravity." },
  Deneb:      { type: "Blue-white supergiant (A2)", note: "One of the most luminous stars known — ~1,400 ly away yet still brilliant." },
  Vega:       { type: "White main-sequence (A0)", note: "A fast-spinning young A-star 25 ly away; defined magnitude zero." },
  Altair:     { type: "White main-sequence (A7)", note: "Spins so fast (~9 hr) it's visibly flattened; 17 ly away." },
  Pollux:     { type: "Orange giant (K0)", note: "The nearest giant star to the Sun (~34 ly) and host to a known exoplanet." },
  Regulus:    { type: "Blue-white (B8)", note: "A rapid rotator near break-up speed; the heart of Leo." },
}

/** Magnitude-only inference when we don't have the star's catalogued type. */
function inferStarCharacter(mag: number): string {
  if (mag < 0.5)  return "very luminous — likely a giant or supergiant, or a hot nearby star"
  if (mag < 1.5)  return "bright — probably a giant or a hot/large main-sequence star"
  if (mag < 2.5)  return "moderately bright to the eye — a luminous distant star or a closer Sun-like one"
  return "fainter to the eye — likely a more ordinary or more distant star"
}

function ConstellationStarMesh({
  star,
  active,
  isClickable,
  isPolaris,
  invert = false,
  onActivate,
  onDeactivate,
  onClick,
  onHover,
  constellationName,
  constellationFact,
}: {
  star: ConstellationStar
  active: boolean
  isClickable: boolean
  isPolaris: boolean
  invert?: boolean
  onActivate: () => void
  onDeactivate: () => void
  onClick?: () => void
  onHover: HoverHandler
  constellationName: string
  constellationFact: string
}) {
  const meshRef = useRef<Mesh>(null)
  const haloRef = useRef<Mesh>(null)
  const haloMatRef = useRef<import("three").MeshBasicMaterial>(null)
  const dotMatRef = useRef<import("three").MeshBasicMaterial>(null)

  const position = useMemo(
    () => raDecToScenePos(star.raHours, star.decDeg, SKY_SHELL_DISTANCE),
    [star.raHours, star.decDeg],
  )
  const baseRadius = magToVisualRadius(star.magnitude) * (isPolaris ? 1.4 : 1.0)
  // Chart-mode colours: ink dots on cream with a warm amber halo on hover.
  const dotColor = invert ? "#0a0a0a" : "#ffffff"
  const haloColorIdle = useMemo(
    () => new Color(invert ? "#1a1006" : "#ffffff"),
    [invert],
  )
  const haloColorActive = useMemo(
    () => new Color(invert ? "#b34a13" : "#fff2b8"),
    [invert],
  )
  // Idle halo opacity needs to be lower on cream (we don't have additive bloom)
  // or the warm tint becomes a muddy smear behind every star.
  const haloOpacityIdle = invert ? 0.08 : 0.18
  const haloOpacityActive = invert ? 0.55 : 0.6

  // Animated scale + halo brightness — lerp each frame so the highlight
  // doesn't snap. Same target reached from any direction.
  useFrame((_, delta) => {
    const k = 1 - Math.exp(-delta * 10)
    const targetScale = active ? 1.6 : 1.0
    if (meshRef.current) {
      const s = meshRef.current.scale.x
      const next = s + (targetScale - s) * k
      meshRef.current.scale.set(next, next, next)
    }
    if (haloRef.current) {
      const haloTarget = active ? 3.2 : 2.2
      const s = haloRef.current.scale.x
      const next = s + (haloTarget - s) * k
      haloRef.current.scale.set(next, next, next)
    }
    if (haloMatRef.current) {
      const opacityTarget = active ? haloOpacityActive : haloOpacityIdle
      haloMatRef.current.opacity += (opacityTarget - haloMatRef.current.opacity) * k
      haloMatRef.current.color.lerp(active ? haloColorActive : haloColorIdle, k)
    }
  })

  return (
    <group position={position}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[baseRadius, 16, 16]} />
        <meshBasicMaterial ref={dotMatRef as React.Ref<import("three").MeshBasicMaterial>} color={dotColor} />
      </mesh>
      <mesh ref={haloRef}>
        <sphereGeometry args={[baseRadius, 12, 12]} />
        <meshBasicMaterial
          ref={haloMatRef as React.Ref<import("three").MeshBasicMaterial>}
          color={dotColor}
          transparent
          opacity={haloOpacityIdle}
          // Normal blending on cream so the halo doesn't bleach to invisible.
          blending={invert ? NormalBlending : AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh
        onPointerOver={(e) => {
          e.stopPropagation()
          onActivate()
          {
            const lore = CONSTELLATION_STAR_LORE[star.name]
            const explore = lore
              ? `${lore.type}. ${lore.note}`
              : `Composition not catalogued here — but from its brightness it's ${inferStarCharacter(star.magnitude)}.`
            onHover({
              name: star.name,
              classification: star.designation,
              apparentMag: star.magnitude,
              spectralType: lore?.type,
              fact: `${isPolaris ? constellationFact : `Part of ${constellationName} — ${constellationFact}`}\n\n★ ${explore}`,
              clickable: isClickable,
            })
          }
        }}
        onPointerOut={() => {
          onDeactivate()
          onHover(null)
        }}
        onClick={(e) => {
          if (!onClick) return
          e.stopPropagation()
          onClick()
        }}
      >
        <sphereGeometry args={[baseRadius * 4, 12, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

function ConstellationGroup({
  constellation,
  active,
  setActive,
  onResetView,
  onHover,
  invert = false,
}: {
  constellation: Constellation
  active: boolean
  setActive: (id: ConstellationId | null) => void
  onResetView: () => void
  onHover: HoverHandler
  invert?: boolean
}) {
  const isClickable = constellation.clickAction === "reset-view"
  const isPolaris = constellation.id === "polaris"
  const onClick = isClickable ? onResetView : undefined

  // Centroid of the constellation's stars — anchor for the hover label.
  // Single-star "constellations" (Polaris) anchor on the star itself.
  const centroid = useMemo<[number, number, number]>(() => {
    const pts = constellation.stars.map((s) =>
      raDecToScenePos(s.raHours, s.decDeg, SKY_SHELL_DISTANCE),
    )
    const sum = pts.reduce(
      (acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]] as [number, number, number],
      [0, 0, 0] as [number, number, number],
    )
    const cx = sum[0] / pts.length
    const cy = sum[1] / pts.length
    const cz = sum[2] / pts.length
    return [cx, cy, cz]
  }, [constellation.stars])

  return (
    <group>
      <AsterismLine
        stars={constellation.stars}
        edges={constellation.edges}
        active={active}
        invert={invert}
      />

      {/* Mythological figure overlay — Hevelius / Bayer celestial-atlas
          tradition. Renders the constellation's classical figure as a
          thin-line SVG over the stars when the constellation is active.
          Five constellations carry figures (Orion, Leo, Cygnus, Lyra,
          Cassiopeia); Big Dipper + Polaris stay as-is. Catalog of figures
          lives in constellation-figures.tsx so adding more is a one-file edit. */}
      {active && CONSTELLATION_FIGURES[constellation.id] && (
        <Html
          position={centroid}
          center
          distanceFactor={CONSTELLATION_FIGURES[constellation.id]!.sizeFactor}
          zIndexRange={[5, 0]}
          style={{ pointerEvents: "none" }}
        >
          <div
            className={`
              select-none pointer-events-none
              ${invert ? "text-foreground" : "text-white"}
            `}
            style={{
              width: 200,
              height: 200,
              opacity: CONSTELLATION_FIGURES[constellation.id]!.opacityTarget,
              animation: "ue-label-in 360ms ease-out both",
            }}
          >
            {CONSTELLATION_FIGURES[constellation.id]!.render()}
          </div>
        </Html>
      )}

      {/* Hover label — fades in when the constellation is active.
          Rendered as an in-scene canvas-textured sprite (WebGLLabel) rather than
          a DOM <Html> overlay, so it sits at the constellation's true depth and
          is depth-tested like everything else — it can be occluded by the Sun or
          a planet instead of floating in front of them. The label's text is
          measured + wrapped reflow-free via pretext (canvas font engine, no
          getBoundingClientRect), so building the texture never forces a layout. */}
      {active && (
        <WebGLLabel
          text={constellation.name.toUpperCase()}
          position={centroid}
          fontSizePx={40}
          maxWidthPx={480}
          color={invert ? "#0b0e0d" : "#ffffff"}
          background={invert ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.55)"}
          scale={SKY_SHELL_DISTANCE * 0.05}
        />
      )}
      {/* Also let the user hover the asterism line itself — invisible thick
          hit segments along each edge so the line isn't just decorative. */}
      {constellation.edges.map(([a, b], i) => (
        <EdgeHitZone
          key={i}
          a={constellation.stars[a]}
          b={constellation.stars[b]}
          onActivate={() => setActive(constellation.id)}
          onDeactivate={() => setActive(null)}
          onHover={onHover}
          info={{
            name: constellation.name,
            classification: constellation.designation,
            fact: constellation.fact,
          }}
        />
      ))}
      {constellation.stars.map((star, index) => (
        <ConstellationStarMesh
          key={`${constellation.id}:${star.name || star.designation || index}`}
          star={star}
          active={active}
          isClickable={isClickable}
          isPolaris={isPolaris}
          invert={invert}
          onActivate={() => setActive(constellation.id)}
          onDeactivate={() => setActive(null)}
          onClick={onClick}
          onHover={onHover}
          constellationName={constellation.name}
          constellationFact={constellation.fact}
        />
      ))}
    </group>
  )
}

function EdgeHitZone({
  a,
  b,
  onActivate,
  onDeactivate,
  onHover,
  info,
}: {
  a: ConstellationStar
  b: ConstellationStar
  onActivate: () => void
  onDeactivate: () => void
  onHover: HoverHandler
  info: { name: string; classification: string; fact: string }
}) {
  // Build a thin cylinder along the edge as an invisible hover target so
  // pointing at the asterism line itself also activates the constellation.
  const { position, rotation, length } = useMemo(() => {
    const pa = raDecToScenePos(a.raHours, a.decDeg, SKY_SHELL_DISTANCE)
    const pb = raDecToScenePos(b.raHours, b.decDeg, SKY_SHELL_DISTANCE)
    const dx = pb[0] - pa[0]
    const dy = pb[1] - pa[1]
    const dz = pb[2] - pa[2]
    const len = Math.hypot(dx, dy, dz)
    const mid: [number, number, number] = [
      (pa[0] + pb[0]) / 2,
      (pa[1] + pb[1]) / 2,
      (pa[2] + pb[2]) / 2,
    ]
    // Default cylinder axis = Y. Rotate to point along (dx, dy, dz).
    const yaw = Math.atan2(dx, dz)
    const pitch = Math.atan2(Math.sqrt(dx * dx + dz * dz), dy)
    return {
      position: mid,
      rotation: [pitch, yaw, 0] as [number, number, number],
      length: len,
    }
  }, [a.raHours, a.decDeg, b.raHours, b.decDeg])

  return (
    <mesh
      position={position}
      rotation={rotation}
      onPointerOver={(e) => {
        e.stopPropagation()
        onActivate()
        onHover(info)
      }}
      onPointerOut={() => {
        onDeactivate()
        onHover(null)
      }}
    >
      <cylinderGeometry args={[0.7, 0.7, length, 8, 1, true]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}

export function Constellations({
  onHover,
  onResetView,
  invert = false,
}: {
  onHover: HoverHandler
  onResetView: () => void
  invert?: boolean
}) {
  const [active, setActive] = useState<ConstellationId | null>(null)

  return (
    <group>
      {constellations.map((c) => (
        <ConstellationGroup
          key={c.id}
          constellation={c}
          active={active === c.id}
          setActive={setActive}
          onResetView={onResetView}
          onHover={onHover}
          invert={invert}
        />
      ))}
    </group>
  )
}
