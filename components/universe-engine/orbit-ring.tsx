"use client"

/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine — see ./index.tsx for the full notice.
 * https://github.com/sinhaankur/portfolio-2026/blob/main/LICENSE
 *
 * orbit-ring — one planet's orbital path, drawn as a faint hairline.
 *
 * Shared by BOTH the planet renderer (each planet draws its own orbit) and the
 * SolarSystem orchestrator, so it lives in its own tiny module rather than the
 * god-file (which would force a scene ↔ planet-body import cycle).
 *
 * Truth notes: eccentric orbits (Pluto, e=0.244) render as a polar-form ellipse
 * with the Sun at one focus — the correct astronomical shape — so Pluto's
 * perihelion visibly dips inside Neptune's circle instead of reading as a glitch.
 * When a real semi-major axis (`aAU`) is supplied the ring rescales live with the
 * active scale mode (explore ↔ true) to track the planet's live radius.
 */

import { useRef, useMemo } from "react"
import { useFrame } from "@react-three/fiber"
import { BufferAttribute, BufferGeometry, Group } from "three"
import { compressRadius } from "./astronomy"
import "./three-line"

export function OrbitRing({
  radius,
  aAU,
  inclination,
  eccentricity = 0,
  invert = false,
}: {
  radius: number
  /** Real semi-major axis (AU). When present, the ring rescales live with the
   *  active scale mode (explore ↔ true) so it tracks the planet's live radius. */
  aAU?: number
  inclination: number
  /** Optional orbital eccentricity. When > 0, draws a polar-form ellipse with
   *  the Sun at one focus (the astronomically correct shape). 0 = circle. */
  eccentricity?: number
  invert?: boolean
}) {
  // The geometry is baked at the static `radius`; to honour the live scale mode
  // we uniformly scale the whole ring group by liveRadius/radius each frame
  // (both circle + ellipse scale linearly with radius, so this stays exact).
  const scaleRef = useRef<Group>(null)
  useFrame((_, delta) => {
    if (!scaleRef.current || aAU == null || radius <= 0) return
    const target = compressRadius(aAU) / radius
    const k = 1 - Math.exp(-delta * 3)
    const s = scaleRef.current.scale.x + (target - scaleRef.current.scale.x) * k
    scaleRef.current.scale.set(s, s, s)
  })
  const geometry = useMemo(() => {
    const segments = 192
    const arr = new Float32Array((segments + 1) * 3)
    if (eccentricity > 0.01) {
      // Polar-form ellipse with focus at origin: r(θ) = a(1-e²) / (1 + e·cos θ)
      // This is the correct orbital shape for any e > 0; for low-e planets
      // it's visually indistinguishable from a circle, but for Pluto (e=0.244)
      // the perihelion visibly dips inside Neptune's circle — making the
      // real astronomical crossing legible rather than a render glitch.
      const a = radius
      const oneMinusESq = 1 - eccentricity * eccentricity
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2
        const r = (a * oneMinusESq) / (1 + eccentricity * Math.cos(theta))
        arr[i * 3] = r * Math.cos(theta)
        arr[i * 3 + 1] = 0
        arr[i * 3 + 2] = r * Math.sin(theta)
      }
    } else {
      // Circle in xz plane.
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2
        arr[i * 3] = Math.cos(angle) * radius
        arr[i * 3 + 1] = 0
        arr[i * 3 + 2] = Math.sin(angle) * radius
      }
    }
    const geo = new BufferGeometry()
    geo.setAttribute("position", new BufferAttribute(arr, 3))
    return geo
  }, [radius, eccentricity])

  // Eccentric orbits get a softer line — the ellipse crosses neighbouring
  // circular orbits (Pluto / Neptune most notably), and a fainter stroke
  // keeps the crossing from reading as a render collision.
  const isEccentric = eccentricity > 0.15
  // Whisper-faint: at 0.42 the light-theme orbit rings read as hard lines slicing
  // across the whole view (visual noise over Earth). A much lighter stroke keeps
  // them as delicate scaffolding you notice only when you look for it.
  const baseOpacity = invert ? 0.16 : 0.07
  const opacity = isEccentric ? baseOpacity * 0.55 : baseOpacity

  return (
    <group ref={scaleRef}>
      <group rotation={[inclination, 0, 0]}>
        <threeLine geometry={geometry}>
          <lineBasicMaterial
            // Faint hairline orbits — ink on cream needs ~6× the opacity to
            // read at the same value as white-on-black.
            color={invert ? "#0a0a0a" : "#ffffff"}
            transparent
            opacity={opacity}
          />
        </threeLine>
      </group>
    </group>
  )
}
