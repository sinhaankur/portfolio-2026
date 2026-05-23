"use client"

/**
 * NamedStarHoverLayer — invisible pointer-eventable spheres at the
 * 358 named stars from HYG (Sirius, Vega, Betelgeuse, Polaris, …).
 *
 * Why this is separate from BrightStarField:
 *   BrightStarField renders 8,920 stars as a single Points buffer in
 *   one draw call. R3F Points support raycasting via threshold, but
 *   tuning a threshold that works for both mag -1.5 Sirius (huge
 *   visible glow) and mag 6.5 background stars is a losing battle —
 *   too tight and you can't hit Sirius; too loose and pointer hovers
 *   on empty sky catch four stars at once.
 *
 *   So: keep the Points rendering as-is for the visible field, and
 *   layer 358 individual invisible spheres at the *named* stars
 *   only. Each one carries a real hover handler that lights up the
 *   shared InfoPanel.
 *
 * Hit-target size scales with apparent magnitude (brighter star =
 * larger touch target) so Sirius and Vega are easy to land on, and
 * the dim ones aren't huge invisible voids you wonder why your
 * pointer keeps catching.
 *
 * Skipped in invert/chart mode for the same reason BrightStarField
 * is: the ink-on-paper sky has its own treatment.
 */

import { useMemo } from "react"
import {
  BRIGHT_STAR_POSITIONS,
  NAMED_STARS,
} from "@/lib/data/bright-stars"
import type { BodyInfo, HoverHandler } from "./types"

// Magnitude → hit-target radius (scene units). Bright (mag -1.5) gets
// ~3.5 units; dim (mag 4) gets ~0.7 units. The visible point sprite
// from BrightStarField is generally inside this radius, so the
// pointer reliably hits where you're looking.
function magToHitRadius(mag: number): number {
  return Math.max(0.7, Math.min(3.5, 2.5 - 0.45 * mag))
}

function buildStarClassification(spectralType: string | null): string {
  if (!spectralType) return "Naked-eye star"
  // First letter of spectral type → broad temperature class.
  const head = spectralType.trim()[0]?.toUpperCase()
  const temperature: Record<string, string> = {
    O: "Hot blue (O-class)",
    B: "Blue-white (B-class)",
    A: "White (A-class)",
    F: "Yellow-white (F-class)",
    G: "Yellow Sun-like (G-class)",
    K: "Orange (K-class)",
    M: "Cool red (M-class)",
  }
  const broad = head && temperature[head] ? temperature[head] : "Star"
  return `${broad} · ${spectralType.trim()}`
}

function buildStarFact(opts: {
  name: string
  mag: number
  distLy: number | null
  spectralType: string | null
  hr: number | null
  hd: number | null
}): string {
  const parts: string[] = []
  parts.push(`Apparent magnitude ${opts.mag.toFixed(2)}.`)
  if (opts.distLy != null) parts.push(`${opts.distLy.toFixed(1)} light-years from the Sun.`)
  if (opts.spectralType) parts.push(`Spectral type ${opts.spectralType.trim()}.`)
  const catalog: string[] = []
  if (opts.hr) catalog.push(`HR ${opts.hr}`)
  if (opts.hd) catalog.push(`HD ${opts.hd}`)
  if (catalog.length) parts.push(`Cataloged as ${catalog.join(", ")}.`)
  return parts.join(" ")
}

export function NamedStarHoverLayer({
  onHover,
  invert = false,
}: {
  onHover: HoverHandler
  invert?: boolean
}) {
  // Precompute per-star geometry inputs — positions are already in
  // sky-shell coords, baked at script time.
  const stars = useMemo(() => {
    return NAMED_STARS.map((meta) => {
      const baseIdx = meta.i * 3
      const x = BRIGHT_STAR_POSITIONS[baseIdx]
      const y = BRIGHT_STAR_POSITIONS[baseIdx + 1]
      const z = BRIGHT_STAR_POSITIONS[baseIdx + 2]
      const radius = magToHitRadius(meta.m)
      const info: BodyInfo = {
        name: meta.n,
        classification: buildStarClassification(meta.s),
        fact: buildStarFact({
          name: meta.n,
          mag: meta.m,
          distLy: meta.d,
          spectralType: meta.s,
          hr: meta.h,
          hd: meta.hd,
        }),
      }
      return { meta, x, y, z, radius, info }
    })
  }, [])

  if (invert) return null

  return (
    <group>
      {stars.map((s) => (
        <mesh
          key={`named-star-${s.meta.i}`}
          position={[s.x, s.y, s.z]}
          onPointerOver={(e) => {
            e.stopPropagation()
            onHover(s.info)
          }}
          onPointerOut={() => onHover(null)}
        >
          {/* 8-segment sphere is plenty — the mesh is invisible,
              its only job is raycasting. Higher segment counts
              would just burn vertex shader time for no visual gain. */}
          <sphereGeometry args={[s.radius, 8, 6]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}
