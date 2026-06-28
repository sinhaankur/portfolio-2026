"use client"

/**
 * BrightStarPicker — makes EVERY naked-eye bright star inspectable, not just the
 * 358 with proper names.
 *
 * The bright-star field renders ~8,920 real HYG stars as a single GPU point cloud
 * (no per-star meshes — that would be thousands of raycast targets). For the
 * un-named stars we still have real data baked into the buffers: position (true
 * RA/Dec on the sky shell), colour (B-V → temperature class) and size (apparent
 * magnitude). This layer lets you hover any of them and reports ONLY what we
 * genuinely know — relative brightness + colour-temperature class — labelled as an
 * unnamed naked-eye star. It never invents a name, distance or spectral subtype.
 *
 * Implementation: one transparent backstop sphere captures pointer-move; we cast
 * the pointer ray and find the bright star whose direction is closest to it
 * (angular nearest-neighbour over the position buffer — cheap, throttled). The 358
 * named stars are skipped here (their own layer gives the full readout), so the
 * two never fight.
 */

import { useMemo, useRef } from "react"
import { useThree } from "@react-three/fiber"
import { Raycaster, Vector2, Vector3, type Mesh } from "three"
import {
  BRIGHT_STAR_COLORS,
  BRIGHT_STAR_COUNT,
  BRIGHT_STAR_POSITIONS,
  BRIGHT_STAR_SIZES,
  NAMED_STARS,
} from "@/lib/data/bright-stars"
import type { BodyInfo, HoverHandler } from "./types"

const SKY_SHELL = 150

// size (0.35..4.0 from magToSize) → a friendly relative-brightness label.
function brightnessLabel(size: number): string {
  const b = (size - 0.35) / 3.65 // 0..1
  if (b > 0.78) return "Brilliant"
  if (b > 0.55) return "Very bright"
  if (b > 0.32) return "Bright"
  if (b > 0.14) return "Moderate"
  return "Faint (naked-eye limit)"
}

// B-V-derived RGB (already baked) → broad colour-temperature class. We read the
// channel balance rather than re-deriving a spectral subtype we don't have.
function colorClass(r: number, g: number, b: number): { label: string; hex: string } {
  const hex = `#${[r, g, b].map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, "0")).join("")}`
  if (b > r + 0.12) return { label: "Hot blue-white", hex }
  if (b > r + 0.03) return { label: "White", hex }
  if (Math.abs(r - b) <= 0.03) return { label: "Yellow-white (Sun-like)", hex }
  if (r > b + 0.18) return { label: "Cool orange-red", hex }
  return { label: "Yellow-orange", hex }
}

export function BrightStarPicker({
  onHover,
  invert = false,
  mobile = false,
}: {
  onHover: HoverHandler
  invert?: boolean
  mobile?: boolean
}) {
  const camera = useThree((s) => s.camera)
  const ray = useRef(new Raycaster())
  const ndc = useRef(new Vector2())
  const dir = useRef(new Vector3())
  const starDir = useRef(new Vector3())
  const lastPick = useRef(-1)
  const lastMove = useRef(0)

  // Indices of named stars (skip them — their own layer owns the full readout).
  const named = useMemo(() => new Set(NAMED_STARS.map((m) => m.i)), [])
  const count = mobile ? Math.min(1600, BRIGHT_STAR_COUNT) : BRIGHT_STAR_COUNT

  const onPointerMove = (e: { clientX: number; clientY: number; nativeEvent: PointerEvent }) => {
    // throttle to ~30 Hz; the angular search is cheap but no need every frame
    const now = performance.now()
    if (now - lastMove.current < 33) return
    lastMove.current = now

    const el = (e.nativeEvent.target as HTMLCanvasElement)
    const rect = el.getBoundingClientRect?.()
    if (!rect) return
    ndc.current.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    )
    ray.current.setFromCamera(ndc.current, camera)
    dir.current.copy(ray.current.ray.direction).normalize()

    // angular nearest star to the pointer ray (max dot product = min angle)
    let best = -1
    let bestDot = Math.cos((mobile ? 1.6 : 1.1) * Math.PI / 180) // ~1° pick radius
    for (let i = 0; i < count; i++) {
      if (named.has(i)) continue
      const j = i * 3
      starDir.current.set(BRIGHT_STAR_POSITIONS[j], BRIGHT_STAR_POSITIONS[j + 1], BRIGHT_STAR_POSITIONS[j + 2]).normalize()
      const d = starDir.current.dot(dir.current)
      if (d > bestDot) { bestDot = d; best = i }
    }

    if (best === lastPick.current) return
    lastPick.current = best
    if (best < 0) { onHover(null); return }

    const j = best * 3
    const size = BRIGHT_STAR_SIZES[best]
    const cc = colorClass(BRIGHT_STAR_COLORS[j], BRIGHT_STAR_COLORS[j + 1], BRIGHT_STAR_COLORS[j + 2])
    const info: BodyInfo = {
      name: "Unnamed star",
      classification: `${cc.label} · naked-eye`,
      fact: `A real naked-eye star from the HYG catalog at its true position on the sky. ${brightnessLabel(size)} to the eye, with a ${cc.label.toLowerCase()} hue. It has no proper name in our dataset — only the brighter, historically-named stars (Sirius, Vega, Betelgeuse…) carry distance and spectral detail here.`,
    }
    onHover(info)
  }

  if (invert) return null

  // A large transparent backstop just inside the sky shell catches pointer moves
  // across the whole celestial sphere. renderOrder + colorWrite off → invisible.
  return (
    <mesh
      ref={(m: Mesh | null) => { if (m) m.renderOrder = -1 }}
      onPointerMove={onPointerMove}
      onPointerOut={() => { lastPick.current = -1; onHover(null) }}
    >
      <sphereGeometry args={[SKY_SHELL * 0.99, 16, 12]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} side={1 /* BackSide */} />
    </mesh>
  )
}
