"use client"

/**
 * NamedStarHoverLayer — interactive stars with visual affordances.
 *
 * Every named star (358 from HYG) gets:
 *   - An invisible hit sphere for raycasting
 *   - A hover glow ring that fades in on pointer-over
 *   - A persistent label for bright stars (mag < 2)
 *   - A clickable ring for stars with special actions (Polaris → reset view)
 *
 * The hover state lifts into React so sibling components (InfoPanel, cursor)
 * react to the same gesture.
 */

import { useMemo, useState, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { Html } from "@react-three/drei"
import { AdditiveBlending, MeshBasicMaterial, SphereGeometry, Vector3 } from "three"
import {
  BRIGHT_STAR_POSITIONS,
  NAMED_STARS,
} from "@/lib/data/bright-stars"
import type { BodyInfo, HoverHandler } from "./types"

function magToHitRadius(mag: number): number {
  return Math.max(0.7, Math.min(3.5, 2.5 - 0.45 * mag))
}

function buildStarClassification(spectralType: string | null): string {
  if (!spectralType) return "Naked-eye star"
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

/** Curated lore for the most iconic stars — prepended to the auto-generated
 *  data line so the headline stars read as more than a catalog entry. Keyed by
 *  proper name (matches NAMED_STARS `n`). */
const CURATED_STAR_FACTS: Record<string, string> = {
  Sirius: "The brightest star in the night sky — a hot blue-white A-star just 8.6 ly away, with a white-dwarf companion (Sirius B, 'the Pup'). Its heliacal rising marked the Nile flood for ancient Egypt.",
  Betelgeuse: "A red supergiant on Orion's shoulder, ~700× the Sun's radius — if placed at the Sun it would swallow Mars. Late in its life and will end as a supernova; its 2019–20 'Great Dimming' briefly had astronomers wondering if it was imminent.",
  Rigel: "Orion's brilliant blue-white foot — a luminous supergiant ~120,000× the Sun's output, 860 ly away. Far younger and hotter than Betelgeuse across the constellation.",
  Vega: "The 5th-brightest star and a former pole star (~12,000 BC; again ~13,700 AD via precession). Defined magnitude zero for the photometric scale, and its debris disk was early evidence for forming planetary systems.",
  Polaris: "The North Star — sits within ~0.7° of the north celestial pole, so it barely moves as the sky wheels around it. A Cepheid variable + the navigator's anchor for centuries.",
  Arcturus: "A K-type orange giant 37 ly away, the brightest star in the northern celestial hemisphere. Racing through the galaxy on a steep orbit — part of an ancient stream of stars from a long-ago merger.",
  Aldebaran: "The fiery orange eye of Taurus — a red giant ~65 ly away. Appears among the Hyades cluster but is actually far closer, a chance line-of-sight alignment.",
  Antares: "The 'rival of Mars' — a vast red supergiant at the heart of Scorpius, ~700× the Sun's radius and a future supernova. Its reddish hue genuinely resembles the planet.",
  Canopus: "The 2nd-brightest star, a distant F-type supergiant. Spacecraft use it as a navigation reference ('Canopus star tracker') because it's bright and far from the ecliptic.",
  Deneb: "One of the most luminous stars known — a blue-white supergiant ~1,400 ly away yet still 19th-brightest in our sky. The tail of Cygnus and a corner of the Summer Triangle.",
  Altair: "A fast-spinning A-star just 17 ly away — rotating so quickly it's visibly flattened into an oblate spheroid. A corner of the Summer Triangle.",
  Spica: "A hot blue binary in Virgo — the two stars orbit every 4 days, so close they distort each other into eggshapes. A standard for hot B-type stars.",
  Procyon: "The 8th-brightest star, just 11.5 ly away, with a white-dwarf companion like Sirius. 'Procyon' = 'before the dog', as it rises before Sirius (the Dog Star).",
  Capella: "Actually four stars — two yellow giants orbiting closely plus a distant red-dwarf pair. The brightest star in Auriga and one of the closest first-magnitude systems.",
  Fomalhaut: "A young A-star girdled by a sharp-edged debris ring — Hubble imaged a candidate planet (Fomalhaut b) sculpting it, one of the first directly-imaged exoplanet candidates.",
  Rigil: "Rigil Kentaurus (Alpha Centauri A) — the nearest bright star system at 4.3 ly. A near-twin of the Sun; with companion Toliman and the red dwarf Proxima it's our closest stellar neighbour.",
  Toliman: "Alpha Centauri B — the Sun-like partner of Rigil Kentaurus, 4.3 ly away. The Alpha Centauri system is the prime target for interstellar mission concepts.",
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
  const lore = CURATED_STAR_FACTS[opts.name]
  if (lore) parts.push(lore)
  parts.push(`Apparent magnitude ${opts.mag.toFixed(2)}.`)
  if (opts.distLy != null) parts.push(`${opts.distLy.toFixed(1)} light-years from the Sun.`)
  if (opts.spectralType) parts.push(`Spectral type ${opts.spectralType.trim()}.`)
  const catalog: string[] = []
  if (opts.hr) catalog.push(`HR ${opts.hr}`)
  if (opts.hd) catalog.push(`HD ${opts.hd}`)
  if (catalog.length) parts.push(`Cataloged as ${catalog.join(", ")}.`)
  return parts.join(" ")
}

function catalogDesignation(opts: { hr: number | null; hd: number | null }): string {
  const parts: string[] = []
  if (opts.hr) parts.push(`HR ${opts.hr}`)
  if (opts.hd) parts.push(`HD ${opts.hd}`)
  return parts.join(" · ")
}

/** Spectral-class colour for the glow ring. */
function spectralGlowColor(spectralType: string | null): string {
  if (!spectralType) return "#ffffff"
  const head = spectralType.trim()[0]?.toUpperCase()
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

/** True for stars that should always show their name label. */
function isBrightStar(mag: number): boolean {
  return mag <= 2.0
}

/** True for stars with a special click action (e.g. Polaris). */
function isClickableStar(name: string): boolean {
  return name === "Polaris"
}

export function NamedStarHoverLayer({
  onHover,
  invert = false,
}: {
  onHover: HoverHandler
  invert?: boolean
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const glowRefs = useRef<Map<number, THREE.Mesh>>(new Map())

  const stars = useMemo(() => {
    return NAMED_STARS.map((meta) => {
      const baseIdx = meta.i * 3
      const x = BRIGHT_STAR_POSITIONS[baseIdx]
      const y = BRIGHT_STAR_POSITIONS[baseIdx + 1]
      const z = BRIGHT_STAR_POSITIONS[baseIdx + 2]
      const radius = magToHitRadius(meta.m)
      const cat = catalogDesignation({ hr: meta.h, hd: meta.hd })
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
        clickable: isClickableStar(meta.n),
        apparentMag: meta.m,
        distanceLy: meta.d ?? undefined,
        spectralType: meta.s ?? undefined,
        catalogDesignation: cat || undefined,
      }
      return {
        meta,
        x,
        y,
        z,
        radius,
        info,
        glowColor: spectralGlowColor(meta.s),
        showLabel: isBrightStar(meta.m),
        isClickable: isClickableStar(meta.n),
      }
    })
  }, [])

  // Animate glow opacity in useFrame for smooth fade
  useFrame((_, delta) => {
    for (const [idx, mesh] of glowRefs.current.entries()) {
      const mat = mesh.material as MeshBasicMaterial
      const target = idx === hoveredIndex ? 0.55 : 0
      const k = 1 - Math.exp(-delta * 12)
      mat.opacity += (target - mat.opacity) * k
      mesh.visible = mat.opacity > 0.01
    }
  })

  if (invert) return null

  return (
    <group>
      {stars.map((s) => (
        <group key={`star-affordance-${s.meta.i}`} position={[s.x, s.y, s.z]}>
          {/* Persistent label for bright stars */}
          {s.showLabel && (
            <Html
              center
              distanceFactor={20}
              style={{ pointerEvents: "none", userSelect: "none" }}
              zIndexRange={[5, 0]}
            >
              <div className="text-center whitespace-nowrap">
                <div
                  className="font-mono text-[9px] tracking-[0.18em] uppercase text-white/75"
                  style={{ textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}
                >
                  {s.meta.n}
                </div>
                {s.meta.s && (
                  <div
                    className="font-mono text-[8px] tracking-wider text-white/50 mt-0.5"
                    style={{ textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}
                  >
                    {s.meta.s}
                  </div>
                )}
              </div>
            </Html>
          )}

          {/* Clickable indicator ring (persistent, subtle) */}
          {s.isClickable && (
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <ringGeometry args={[s.radius * 1.2, s.radius * 1.35, 32]} />
              <meshBasicMaterial
                color="#40d8ff"
                transparent
                opacity={0.35}
                blending={AdditiveBlending}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
          )}

          {/* Hover glow sphere */}
          <mesh
            ref={(el) => {
              if (el) glowRefs.current.set(s.meta.i, el)
              else glowRefs.current.delete(s.meta.i)
            }}
            visible={false}
          >
            <sphereGeometry args={[s.radius * 1.6, 16, 16]} />
            <meshBasicMaterial
              color={s.glowColor}
              transparent
              opacity={0}
              blending={AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>

          {/* Invisible hit sphere */}
          <mesh
            onPointerOver={(e) => {
              e.stopPropagation()
              setHoveredIndex(s.meta.i)
              onHover(s.info)
            }}
            onPointerOut={() => {
              setHoveredIndex((prev) => (prev === s.meta.i ? null : prev))
              onHover(null)
            }}
          >
            <sphereGeometry args={[s.radius, 8, 6]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
