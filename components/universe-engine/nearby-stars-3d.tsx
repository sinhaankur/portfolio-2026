"use client"

/**
 * NearbyStars3D — the solar neighbourhood as REAL 3D structure.
 *
 * The bright-star field paints stars on a fixed sky *shell* (all at radius 150) —
 * correct for "the fixed stars overhead," but it flattens the third dimension:
 * Alpha Centauri (4.3 ly) and a 2,000-ly supergiant sit at the same apparent
 * depth. This layer restores depth: each named star with a real distance is placed
 * at its TRUE 3D heliocentric position — direction (from its sky position) ×
 * distance (light-years) — so when you pull the camera out past the planets you
 * fly through the actual solar neighbourhood: Alpha Centauri nearest, then Sirius,
 * Procyon, Altair… at their real relative distances.
 *
 * Honest data only — direction + distance are both real (HYG). We cap the catalog
 * to a sensible radius so it stays navigable and perf-light, and skip the one
 * mislabelled outlier. The flat sky-shell field stays as the far backdrop; this
 * sits in front of it in true space.
 */

import { useMemo, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { Html } from "@react-three/drei"
import { AdditiveBlending, Vector3 } from "three"
import { BRIGHT_STAR_POSITIONS, NAMED_STARS } from "@/lib/data/bright-stars"
import type { BodyInfo, HoverHandler } from "./types"

// Scene units per light-year. Alpha Cen (4.3 ly) → ~86 units (just past the
// planets); 100 ly → ~2000 units. Camera far/maxDistance are raised to match.
const LY_SCALE = 20
// Only the genuinely-nearby stars get a true-3D point (keeps it legible + light).
const MAX_LY = 120
// Anything beyond this is a catalog error (one entry sits at ~326,000 ly) — skip.
const SANITY_LY = 5000

function spectralColor(s: string | null | undefined): string {
  const head = s?.trim()[0]?.toUpperCase()
  switch (head) {
    case "O": return "#9bb8ff"
    case "B": return "#aabfff"
    case "A": return "#cad8ff"
    case "F": return "#fbf8ff"
    case "G": return "#fff4e8"
    case "K": return "#ffd7a3"
    case "M": return "#ff9e8a"
    default: return "#ffffff"
  }
}

export function NearbyStars3D({
  onHover,
  invert = false,
}: {
  onHover: HoverHandler
  invert?: boolean
}) {
  const [hovered, setHovered] = useState<number | null>(null)
  const glowRefs = useRef<Map<number, import("three").Mesh>>(new Map())
  const dir = useMemo(() => new Vector3(), [])

  const stars = useMemo(() => {
    const out: {
      i: number
      pos: [number, number, number]
      color: string
      r: number
      info: BodyInfo
    }[] = []
    for (const meta of NAMED_STARS) {
      const d = meta.d
      if (d == null || d > MAX_LY || d > SANITY_LY) continue
      const b = meta.i * 3
      const x = BRIGHT_STAR_POSITIONS[b]
      const y = BRIGHT_STAR_POSITIONS[b + 1]
      const z = BRIGHT_STAR_POSITIONS[b + 2]
      // direction from the Sun (shell pos is centred on the sky origin)
      dir.set(x, y, z).normalize()
      const dist = d * LY_SCALE
      // brighter / nearer → a touch larger
      const r = Math.max(0.6, 2.4 - 0.4 * meta.m)
      out.push({
        i: meta.i,
        pos: [dir.x * dist, dir.y * dist, dir.z * dist],
        color: spectralColor(meta.s),
        r,
        info: {
          name: meta.n,
          classification: meta.s ? `Star · ${meta.s.trim()}` : "Naked-eye star",
          apparentMag: meta.m,
          distanceLy: d,
          spectralType: meta.s ?? undefined,
          fact: `${meta.n} sits ${d.toFixed(1)} light-years from the Sun — shown here at its TRUE 3D distance, not flattened onto the sky. ${
            d < 10 ? "One of our nearest stellar neighbours." : ""
          }`.trim(),
        },
      })
    }
    return out
  }, [dir])

  useFrame((_, delta) => {
    for (const [i, mesh] of glowRefs.current.entries()) {
      const mat = mesh.material as import("three").MeshBasicMaterial
      const target = i === hovered ? 0.6 : 0
      mat.opacity += (target - mat.opacity) * (1 - Math.exp(-delta * 12))
      mesh.visible = mat.opacity > 0.01
    }
  })

  if (invert) return null

  return (
    <group>
      {stars.map((s) => (
        <group key={`near-${s.i}`} position={s.pos}>
          {/* the star itself — small bright additive dot */}
          <mesh>
            <sphereGeometry args={[s.r * 0.5, 12, 12]} />
            <meshBasicMaterial color={s.color} transparent opacity={0.95} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
          {/* hover glow */}
          <mesh ref={(el) => { if (el) glowRefs.current.set(s.i, el); else glowRefs.current.delete(s.i) }} visible={false}>
            <sphereGeometry args={[s.r * 1.6, 16, 16]} />
            <meshBasicMaterial color={s.color} transparent opacity={0} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
          {/* label for the nearest handful so the neighbourhood is legible */}
          {s.info.distanceLy != null && s.info.distanceLy < 16 && (
            <Html center distanceFactor={120} style={{ pointerEvents: "none", userSelect: "none" }} zIndexRange={[4, 0]}>
              <div className="font-mono text-[9px] tracking-[0.18em] uppercase text-white/70 whitespace-nowrap" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>
                {s.info.name} · {s.info.distanceLy.toFixed(1)} ly
              </div>
            </Html>
          )}
          {/* hit sphere */}
          <mesh
            onPointerOver={(e) => { e.stopPropagation(); setHovered(s.i); onHover(s.info) }}
            onPointerOut={() => { setHovered((p) => (p === s.i ? null : p)); onHover(null) }}
          >
            <sphereGeometry args={[s.r, 8, 6]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
