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
import type * as THREE from "three"
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

/** Exact measured physics for well-studied stars (NASA/SIMBAD/Hipparcos).
 *  tempK = effective surface temperature; radius = solar radii; mass = solar
 *  masses; fusing = current nucleosynthesis stage; comp = composition note.
 *  Drives a real-temperature colour + a sourced physics line in the panel. */
type StarPhysical = { tempK: number; radius: number; mass: number; fusing: string; comp: string }
const STAR_PHYSICAL: Record<string, StarPhysical> = {
  Sirius:     { tempK: 9940,  radius: 1.71,  mass: 2.06, fusing: "Hydrogen → helium (main sequence)", comp: "Mostly hydrogen + helium; metal-rich (A-type) photosphere." },
  Betelgeuse: { tempK: 3600,  radius: 764,   mass: 16.5, fusing: "Helium → carbon (red supergiant)", comp: "Cool H/He envelope over a shell-burning core; fusing heavier elements toward an iron core." },
  Rigel:      { tempK: 12100, radius: 78.9,  mass: 21,   fusing: "Helium-shell burning (blue supergiant)", comp: "Hot hydrogen/helium envelope; evolving off the main sequence." },
  Vega:       { tempK: 9602,  radius: 2.36,  mass: 2.14, fusing: "Hydrogen → helium (main sequence)", comp: "Hydrogen-dominant A-type; rapid rotator, pole hotter than equator." },
  Arcturus:   { tempK: 4286,  radius: 25.4,  mass: 1.08, fusing: "Helium → carbon (red giant, He core burning)", comp: "Cooled, swollen H/He envelope; metal-poor (old halo star)." },
  Aldebaran:  { tempK: 3910,  radius: 45.1,  mass: 1.16, fusing: "Helium core burning (red giant)", comp: "Cool K-type giant; helium-fusing core, hydrogen-shell around it." },
  Antares:    { tempK: 3660,  radius: 680,   mass: 12,   fusing: "Helium → carbon (red supergiant)", comp: "Vast cool envelope; advanced shell burning, supernova-bound." },
  Canopus:    { tempK: 7400,  radius: 71,    mass: 8,    fusing: "Helium core burning (F-type supergiant)", comp: "Evolved bright giant; carbon-oxygen core forming." },
  Deneb:      { tempK: 8525,  radius: 203,   mass: 19,   fusing: "Helium-shell burning (blue-white supergiant)", comp: "One of the most luminous known; immense H/He envelope." },
  Altair:     { tempK: 7550,  radius: 1.79,  mass: 1.79, fusing: "Hydrogen → helium (main sequence)", comp: "A-type; spins near break-up, visibly oblate." },
  Spica:      { tempK: 22400, radius: 7.47,  mass: 11.4, fusing: "Hydrogen → helium (hot B main sequence)", comp: "Very hot, massive blue star; tight binary." },
  Procyon:    { tempK: 6530,  radius: 2.05,  mass: 1.50, fusing: "Hydrogen exhausting (F subgiant)", comp: "Just leaving the main sequence; white-dwarf companion." },
  Pollux:     { tempK: 4586,  radius: 8.8,   mass: 1.91, fusing: "Helium core burning (orange giant)", comp: "Nearest giant to the Sun; hosts a known exoplanet." },
  Regulus:    { tempK: 12460, radius: 3.09,  mass: 3.8,  fusing: "Hydrogen → helium (B main sequence)", comp: "Hot blue-white; extreme rotation flattens it." },
  Rigil:      { tempK: 5790,  radius: 1.22,  mass: 1.10, fusing: "Hydrogen → helium (main sequence)", comp: "Near-twin of the Sun (Alpha Centauri A); G2V." },
  Toliman:    { tempK: 5260,  radius: 0.86,  mass: 0.91, fusing: "Hydrogen → helium (main sequence)", comp: "Sun-like K1V partner (Alpha Centauri B)." },
  Polaris:    { tempK: 6015,  radius: 37.5,  mass: 5.4,  fusing: "Helium core burning (Cepheid supergiant)", comp: "Pulsating yellow supergiant; the North Star." },
  Capella:    { tempK: 4970,  radius: 11.98, mass: 2.57, fusing: "Helium core burning (yellow giants)", comp: "Two evolved G-type giants in a close pair." },
  Fomalhaut:  { tempK: 8590,  radius: 1.84,  mass: 1.92, fusing: "Hydrogen → helium (main sequence)", comp: "Young A-type with a sharp-edged debris ring." },
}

/** Effective temperature (K) → approximate blackbody RGB (real star colour). */
function tempToRGB(tempK: number): [number, number, number] {
  // Tanner Helland's blackbody approximation, normalised to 0..1.
  const t = tempK / 100
  let r: number, g: number, b: number
  if (t <= 66) r = 255
  else r = 329.7 * Math.pow(t - 60, -0.1332)
  if (t <= 66) g = 99.47 * Math.log(t) - 161.12
  else g = 288.12 * Math.pow(t - 60, -0.0755)
  if (t >= 66) b = 255
  else if (t <= 19) b = 0
  else b = 138.52 * Math.log(t - 10) - 305.04
  const cl = (x: number) => Math.max(0, Math.min(255, x)) / 255
  return [cl(r), cl(g), cl(b)]
}

function buildStarFact(opts: {
  name: string
  mag: number
  distLy: number | null
  spectralType: string | null
  tempK: number | null
  lumSun: number | null
  hr: number | null
  hd: number | null
}): string {
  const parts: string[] = []
  const lore = CURATED_STAR_FACTS[opts.name]
  if (lore) parts.push(lore)
  parts.push(`Apparent magnitude ${opts.mag.toFixed(2)}.`)
  if (opts.distLy != null) parts.push(`${opts.distLy.toFixed(1)} light-years from the Sun.`)
  if (opts.spectralType) parts.push(`Spectral type ${opts.spectralType.trim()}.`)
  // Real physical data from HYG — the star's actual measured properties.
  if (opts.tempK != null) parts.push(`Surface temperature ≈ ${opts.tempK.toLocaleString()} K (from its B-V colour).`)
  if (opts.lumSun != null) {
    const l = opts.lumSun
    const lStr = l >= 1000 ? `${Math.round(l).toLocaleString()}×` : l >= 10 ? `${Math.round(l)}×` : `${l}×`
    parts.push(`Luminosity ≈ ${lStr} the Sun.`)
  }
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
      // Exact known physics (where measured) → a sourced "what it is + what it's
      // burning" line, appended to the lore/catalog fact.
      const phys = STAR_PHYSICAL[meta.n]
      let fact = buildStarFact({
        name: meta.n, mag: meta.m, distLy: meta.d, spectralType: meta.s,
        tempK: meta.t ?? null, lumSun: meta.l ?? null, hr: meta.h, hd: meta.hd,
      })
      if (phys) {
        fact += `\n\n☀ Measured physics — ${phys.tempK.toLocaleString()} K surface, ${phys.radius < 1 ? phys.radius.toFixed(2) : phys.radius.toLocaleString()}× the Sun's radius, ${phys.mass}× its mass. Fusing: ${phys.fusing}. ${phys.comp}`
      }
      const info: BodyInfo = {
        name: meta.n,
        classification: buildStarClassification(meta.s),
        fact,
        clickable: isClickableStar(meta.n),
        apparentMag: meta.m,
        distanceLy: meta.d ?? undefined,
        spectralType: meta.s ?? undefined,
        catalogDesignation: cat || undefined,
      }
      // Glow colour from REAL effective temperature where we have it (true
      // blackbody hue), else fall back to the spectral-class colour.
      const glowColor = phys
        ? `rgb(${tempToRGB(phys.tempK).map((c) => Math.round(c * 255)).join(",")})`
        : spectralGlowColor(meta.s)
      return {
        meta,
        x,
        y,
        z,
        radius,
        info,
        glowColor,
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
