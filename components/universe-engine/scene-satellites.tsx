"use client"

/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine — see ./index.tsx for the full notice.
 * https://github.com/sinhaankur/portfolio-2026/blob/main/LICENSE
 *
 * scene-satellites — the "things around a body" sub-engine.
 *
 * Two shared concerns that both the moon renderer and the planet renderer need,
 * so they live here once instead of inside the god-file:
 *
 *   1. Human-made orbiters — procedural satellite SHELLS at true altitude ratios
 *      (Starlink / GPS / GEO / debris), plus named HERO craft loaded from real
 *      Blender GLB models (ISS, Hubble, JWST, Sputnik…). Composed by
 *      <SatelliteShells>. Data tables (SATELLITE_CATALOG, HERO_CRAFT) are keyed
 *      by body name and consumed by the planet renderer.
 *
 *   2. Surface pins — <RoverPin>, a single landing-site / surface-feature marker
 *      (rovers on Mars, Apollo sites on the Moon, natural landmarks). Used by
 *      both PlanetBody and MoonBody.
 *
 * Truth notes preserved from the originals: altitudes are REAL orbit-radius /
 * body-radius ratios, launch epochs gate each shell/craft on the timeline (no
 * Starlink in 1990), and the debris cloud is an honest Kessler explainer with no
 * faked live conjunction events.
 */

import { useRef, useMemo, useState, useEffect, Suspense } from "react"
import { useFrame } from "@react-three/fiber"
import { Html, useGLTF } from "@react-three/drei"
import {
  AdditiveBlending,
  BackSide,
  Box3,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Mesh,
  Points,
  Quaternion,
  Vector3,
} from "three"
import { DEG, simTimeRef, requestFollow, cancelFollow, followRef } from "./astronomy"
import type { HoverHandler, SurfaceFeature } from "./types"
import "./three-line"

/* ============================================================
 * Satellite shells — human-made orbiters around a body.
 *
 * Real spacecraft number in the thousands (Starlink alone ~6,000), so each
 * orbital regime is a procedural point-field at its true altitude ratio
 * (orbit radius / body radius), color-coded, riding a slow rotation. Web-light:
 * a few thousand points across a handful of shells, one draw each. Revealed on
 * demand (the engine shows them when a body's satellites are toggled on).
 *
 * Altitudes are expressed as a multiple of the body's radius so they scale to
 * each planet's visualRadius. Earth examples:
 *   ISS  ~420 km  → 1.066 R⊕      Starlink ~550 km → 1.086 R⊕
 *   GPS  ~20,200 km → 4.17 R⊕     GEO ~35,786 km   → 6.61 R⊕
 * ============================================================ */
export type SatelliteShell = {
  label: string
  /** orbit radius as a multiple of the body's radius */
  altRatio: number
  count: number
  color: string
  /** orbital inclination spread (radians) — how puffed the shell is in Y */
  incl: number
  speed: number
  /** Debris cloud: tracked orbital debris fills a THICK band of altitudes at ALL
   *  inclinations (a near-spherical shell), not a clean ring. Renders denser +
   *  fainter specks. `altSpread` (fraction of altRatio) sets the band thickness. */
  debris?: boolean
  altSpread?: number
  /** First-launch epoch of this constellation/band — the shell only exists on
   *  the timeline after this instant (truth: no Starlink in 1990). */
  launchMs?: number
}

function SatelliteShellPoints({
  shell,
  bodyRadius,
  onHover,
}: {
  shell: SatelliteShell
  bodyRadius: number
  onHover?: HoverHandler
}) {
  const ref = useRef<Points>(null)
  const gateRef = useRef<Group>(null)
  const geometry = useMemo(() => {
    const r = bodyRadius * shell.altRatio
    const positions = new Float32Array(shell.count * 3)
    for (let i = 0; i < shell.count; i++) {
      const a = Math.random() * Math.PI * 2
      if (shell.debris) {
        // Debris cloud: every inclination (a near-spherical shell) over a thick
        // altitude band — the real LEO debris environment, not a single lane.
        const u = Math.random() * 2 - 1            // cos(polar) → uniform sphere
        const ph = Math.acos(u)
        const rr = r * (1 + (Math.random() - 0.5) * (shell.altSpread ?? 0.18))
        positions[i * 3]     = rr * Math.sin(ph) * Math.cos(a)
        positions[i * 3 + 1] = rr * Math.cos(ph)
        positions[i * 3 + 2] = rr * Math.sin(ph) * Math.sin(a)
      } else {
        // REAL constellation geometry: every member flies at the SAME
        // inclination (shell.incl = the constellation's true tilt), in planes
        // spread around the pole (random RAAN). This is why Starlink weaves a
        // lattice and Iridium cages the poles — not a random inclination smear.
        const raan = Math.random() * Math.PI * 2
        const inc = shell.incl
        const px = Math.cos(a) * r
        const py = Math.sin(a) * Math.sin(inc) * r
        const pz = Math.sin(a) * Math.cos(inc) * r
        positions[i * 3]     = px * Math.cos(raan) + pz * Math.sin(raan)
        positions[i * 3 + 1] = py
        positions[i * 3 + 2] = -px * Math.sin(raan) + pz * Math.cos(raan)
      }
    }
    const geo = new BufferGeometry()
    geo.setAttribute("position", new BufferAttribute(positions, 3))
    return geo
  }, [shell, bodyRadius])

  // Faint orbit-path ring at the shell's altitude, so the orbital lane reads
  // even when the points are sparse. Slightly tilted to suggest inclination.
  const ringGeo = useMemo(() => {
    const r = bodyRadius * shell.altRatio
    const seg = 96
    const pts = new Float32Array((seg + 1) * 3)
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2
      pts[i * 3] = Math.cos(a) * r
      pts[i * 3 + 1] = 0
      pts[i * 3 + 2] = Math.sin(a) * r
    }
    const geo = new BufferGeometry()
    geo.setAttribute("position", new BufferAttribute(pts, 3))
    return geo
  }, [shell, bodyRadius])

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * shell.speed
    // Timeline truth: the band only exists after its constellation's first
    // launch/arrival. Polled per-frame so scrubbing reveals/hides it live.
    if (gateRef.current) {
      gateRef.current.visible =
        shell.launchMs == null || simTimeRef.current.simMs >= shell.launchMs
    }
  })

  return (
    <group ref={gateRef}>
      <points ref={ref} geometry={geometry}>
        <pointsMaterial
          // Real altitude ratios keep LEO tight to Earth, so the swarm only
          // fully resolves when you zoom in. Debris specks render smaller +
          // fainter than active satellites (tiny tracked fragments).
          size={shell.debris ? Math.max(0.005, bodyRadius * 0.009) : Math.max(0.008, bodyRadius * 0.016)}
          sizeAttenuation
          color={shell.color}
          transparent
          opacity={shell.debris ? 0.7 : 1.0}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </points>
      {/* orbital-path ring — only for constellations; a debris cloud has no
          single lane, so it's skipped. */}
      {!shell.debris && (
        <threeLine geometry={ringGeo} rotation={[shell.incl, 0, 0]}>
          <lineBasicMaterial color={shell.color} transparent opacity={0.18} depthWrite={false} />
        </threeLine>
      )}
      {/* Debris shell is hoverable → an honest conjunction / Kessler explainer
          (no faked live close-approach events; we don't have that feed). */}
      {shell.debris && onHover && (
        <mesh
          onPointerOver={(e) => {
            e.stopPropagation()
            onHover({
              name: "Orbital debris",
              classification: "Tracked space debris · LEO",
              fact: "~36,000 objects larger than 10 cm are tracked in orbit, plus an estimated 1,000,000+ between 1–10 cm — mostly junk: spent rocket stages, dead satellites, and fragments from collisions + anti-satellite tests.\n\n⚠ Conjunctions: operators get thousands of close-approach warnings a day; active satellites (e.g. the ISS, Starlink) perform avoidance manoeuvres. The risk is the Kessler syndrome — a collision cascade where debris begets more debris, potentially making some orbits unusable. (Specific live conjunction events aren't shown here — that needs a real tracking feed.)",
            })
          }}
          onPointerOut={() => onHover(null)}
        >
          <sphereGeometry args={[bodyRadius * shell.altRatio, 24, 16]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} side={BackSide} />
        </mesh>
      )}
    </group>
  )
}

/** Real human-made orbiter populations by body. Counts are scaled-down but
 *  proportionate (Starlink dominates Earth LEO); altitudes are true ratios. */
export const SATELLITE_CATALOG: Record<string, SatelliteShell[]> = {
  Earth: [
    // Altitudes are REAL ratios (orbit radius / Earth radius): LEO ~1.05–1.19,
    // MEO ~4.2, GEO ~6.6. At normal zoom the LEO band hugs Earth tightly (as it
    // truly does) — zoom into Earth to see the Starlink swarm resolve. Realism
    // over exaggeration, per the true-ratio goal.
    // --- LEO (~400–1200 km) — densest, dominated by Starlink ---
    { label: "Starlink (LEO ~550 km · 53°)", launchMs: Date.UTC(2019, 4, 24), altRatio: 1.086, count: 900, color: "#9fe0ff", incl: 0.925, speed: 0.18 },
    { label: "OneWeb (LEO ~1200 km · 87.9°)", launchMs: Date.UTC(2019, 1, 27), altRatio: 1.19, count: 240, color: "#a8c0ff", incl: 1.534, speed: 0.15 },
    { label: "Iridium (LEO ~780 km · 86.4°)", launchMs: Date.UTC(1997, 4, 5), altRatio: 1.12, count: 90, color: "#c0d8ff", incl: 1.508, speed: 0.16 },
    { label: "Earth-observation (sun-sync ~700 km · 97.8°)", launchMs: Date.UTC(1972, 6, 23), altRatio: 1.11, count: 130, color: "#bfeacb", incl: 1.707, speed: 0.16 },
    { label: "ISS / Tiangong / Hubble (~420–540 km · 28–52°)", launchMs: Date.UTC(1990, 3, 24), altRatio: 1.066, count: 90, color: "#ffffff", incl: 0.901, speed: 0.2 },
    // --- MEO (~20,000 km) — the navigation constellations ---
    { label: "GPS (MEO ~20,200 km · 55°)", launchMs: Date.UTC(1978, 1, 22), altRatio: 4.17, count: 31, color: "#ffd27a", incl: 0.96, speed: 0.06 },
    { label: "GLONASS (MEO ~19,100 km · 64.8°)", launchMs: Date.UTC(1982, 9, 12), altRatio: 4.0, count: 24, color: "#ffcaa0", incl: 1.131, speed: 0.062 },
    { label: "Galileo (MEO ~23,200 km · 56°)", launchMs: Date.UTC(2011, 9, 21), altRatio: 4.7, count: 28, color: "#a0ffd0", incl: 0.977, speed: 0.055 },
    { label: "BeiDou (MEO ~21,500 km · 55°)", launchMs: Date.UTC(2000, 9, 31), altRatio: 4.3, count: 30, color: "#ffb0e0", incl: 0.96, speed: 0.058 },
    // --- GEO (~35,786 km) — the equatorial comms/weather belt ---
    { label: "Geostationary belt (~35,786 km · 0°)", launchMs: Date.UTC(1963, 6, 26), altRatio: 6.61, count: 180, color: "#ff9a6b", incl: 0.01, speed: 0.02 },
    // --- Orbital DEBRIS — ~36,000 tracked objects >10 cm (most of LEO is junk):
    //     spent stages, dead satellites, collision + ASAT-test fragments. A
    //     near-spherical cloud at ALL inclinations, densest ~800–1000 km. The
    //     defining hazard of the LEO environment (cf. LeoLabs tracking). ---
    { label: "LEO debris cloud (~600–1100 km, all inclinations)", launchMs: Date.UTC(1961, 5, 29), altRatio: 1.13, count: 2600, color: "#ff7a6b", incl: 3.14, speed: 0.17, debris: true, altSpread: 0.10 },
    { label: "Upper-LEO debris (~1200–1500 km)", launchMs: Date.UTC(1961, 5, 29), altRatio: 1.22, count: 700, color: "#ffae8a", incl: 3.14, speed: 0.14, debris: true, altSpread: 0.10 },
  ],
  Mars: [
    { label: "Mars orbiters (MRO / MAVEN / Odyssey / TGO …)", launchMs: Date.UTC(1971, 10, 14), altRatio: 1.3, count: 14, color: "#ffb89a", incl: 1.1, speed: 0.12 },
  ],
  // Real (or historic) orbiters at the other planets — counts reflect reality:
  // these worlds have had only a handful of visiting spacecraft, never swarms.
  Mercury: [
    { label: "Mercury orbit (BepiColombo · MESSENGER, hist.)", launchMs: Date.UTC(2011, 2, 18), altRatio: 1.5, count: 2, color: "#cdbfae", incl: 1.0, speed: 0.1 },
  ],
  Venus: [
    { label: "Venus orbit (Akatsuki · Venus Express, hist.)", launchMs: Date.UTC(1975, 9, 22), altRatio: 1.45, count: 2, color: "#ffe6a8", incl: 0.9, speed: 0.1 },
  ],
  Jupiter: [
    { label: "Jupiter orbit (Juno · Galileo, hist.)", launchMs: Date.UTC(1995, 11, 7), altRatio: 1.6, count: 2, color: "#ffd9b0", incl: 1.3, speed: 0.07 },
  ],
  Saturn: [
    { label: "Saturn orbit (Cassini, hist. 1997–2017)", launchMs: Date.UTC(2004, 6, 1), altRatio: 1.7, count: 1, color: "#ffe9c0", incl: 0.6, speed: 0.05 },
  ],
}

/** Named hero satellites — real Blender models orbiting at their true altitude,
 *  the recognizable craft among the procedural swarm. */
type HeroCraft = {
  label: string
  model: string
  altRatio: number
  incl: number
  speed: number
  /** model scale relative to body radius */
  sizeRatio: number
  phase: number
  /** Real-world detail surfaced in the InfoPanel on hover/focus. */
  agency?: string      // launching country / agency (with flag)
  orbit?: string       // orbit type + altitude + inclination + period
  launched?: string    // launch date / year (human-readable)
  size?: string        // physical dimensions
  fact?: string        // one-line description
  /** Launch instant (Unix ms). The craft only exists in the scene once the
   *  simulation clock passes this date — scrubbing the timeline back before it
   *  removes it, so the space age unfolds as you scrub forward from 1957. */
  launchMs?: number
}
export const HERO_CRAFT: Record<string, HeroCraft[]> = {
  Earth: [
    // sizeRatio bumped so the real craft stand out from the procedural swarm.
    { label: "ISS", model: "/models/sat-iss.glb", altRatio: 1.066, incl: 0.9, speed: 0.2, sizeRatio: 0.18, phase: 0,
      agency: "🌍 Multinational (NASA · Roscosmos · ESA · JAXA · CSA)", orbit: "LEO · ~420 km · 51.6° · ~92 min", launched: "1998 (first module)", size: "109 × 73 m", launchMs: Date.UTC(1998, 10, 20),
      fact: "The largest human structure in space — a continuously crewed laboratory since 2000, assembled from modules over a decade." },
    { label: "Tiangong", model: "/models/tiangong.glb", altRatio: 1.062, incl: 0.74, speed: 0.21, sizeRatio: 0.12, phase: 1.6,
      agency: "🇨🇳 CMSA (China)", orbit: "LEO · ~390 km · 41.5° · ~92 min", launched: "2021 (Tianhe core)", size: "~55 m, ~3 modules", launchMs: Date.UTC(2021, 3, 29),
      fact: "China's modular space station, completed in 2022 — the second continuously inhabited station in orbit." },
    { label: "Hubble", model: "/models/sat-hubble.glb", altRatio: 1.085, incl: 0.48, speed: 0.18, sizeRatio: 0.11, phase: 2.1,
      agency: "🇺🇸 NASA · 🇪🇺 ESA", orbit: "LEO · ~535 km · 28.5° · ~95 min", launched: "1990 (STS-31)", size: "13.2 m long · 4.2 m dia", launchMs: Date.UTC(1990, 3, 24),
      fact: "The space telescope that rewrote astronomy — serviced five times by Shuttle crews, still observing after 35 years." },
    { label: "GPS", model: "/models/sat-gps.glb", altRatio: 4.17, incl: 0.95, speed: 0.06, sizeRatio: 0.2, phase: 0.7,
      agency: "🇺🇸 US Space Force", orbit: "MEO · ~20,200 km · 55° · ~12 hr", launched: "1978 (first) · Block III now", size: "~2.5 m bus · ~18 m span", launchMs: Date.UTC(1978, 1, 22),
      fact: "A constellation of ~31 satellites; any point on Earth sees at least four, which is how your phone knows where it is." },
    // JWST sits at Sun–Earth L2 (~1.5M km out, anti-sunward). At this scene
    // scale a far ring around Earth reads it as the distant deep-space scope.
    { label: "JWST", model: "/models/sat-jwst.glb", altRatio: 9.0, incl: 0.2, speed: 0.04, sizeRatio: 0.2, phase: 3.5,
      agency: "🇺🇸 NASA · 🇪🇺 ESA · 🇨🇦 CSA", orbit: "Sun–Earth L2 · ~1.5M km", launched: "2021 (Ariane 5)", size: "21 × 14 m sunshield", launchMs: Date.UTC(2021, 11, 25),
      fact: "The largest space telescope ever flown — its gold mirror sees the first galaxies in infrared, shaded by a tennis-court sunshield." },
    { label: "Sputnik 1", model: "/models/craft-sputnik.glb", altRatio: 1.09, incl: 1.1, speed: 0.24, sizeRatio: 0.09, phase: 4.4,
      agency: "🇷🇺 USSR", orbit: "LEO · 215–939 km · 65.1° · ~96 min", launched: "4 Oct 1957", size: "0.58 m sphere", launchMs: Date.UTC(1957, 9, 4),
      fact: "The first artificial satellite — a polished sphere with four antennas that beeped for 21 days and began the Space Age." },
    // ----- more of the space age, in launch order (reuse models by silhouette) -----
    { label: "Explorer 1", model: "/models/sat-sputnik.glb", altRatio: 1.23, incl: 1.0, speed: 0.25, sizeRatio: 0.07, phase: 5.2,
      agency: "🇺🇸 USA (JPL · Army)", orbit: "LEO · 358–2,550 km · 33.2°", launched: "1 Feb 1958", size: "2.0 m × 0.15 m", launchMs: Date.UTC(1958, 1, 1),
      fact: "First US satellite. Its cosmic-ray detector discovered the Van Allen radiation belts — the first major scientific find of the space age." },
    { label: "Vostok 1", model: "/models/sat-sputnik.glb", altRatio: 1.04, incl: 0.7, speed: 0.26, sizeRatio: 0.085, phase: 2.7,
      agency: "🇷🇺 USSR", orbit: "LEO · 169–327 km · 64.9°", launched: "12 Apr 1961", size: "2.3 m capsule", launchMs: Date.UTC(1961, 3, 12),
      fact: "Carried Yuri Gagarin — the first human in space, one orbit of Earth in 108 minutes." },
    { label: "Telstar 1", model: "/models/sat-sputnik.glb", altRatio: 1.54, incl: 0.8, speed: 0.12, sizeRatio: 0.08, phase: 1.1,
      agency: "🇺🇸 AT&T · NASA", orbit: "MEO · 952–5,933 km · 44.8°", launched: "10 Jul 1962", size: "0.88 m sphere", launchMs: Date.UTC(1962, 6, 10),
      fact: "Relayed the first live transatlantic television — the satellite that made global broadcast possible." },
    { label: "Landsat 1", model: "/models/sat-hubble.glb", altRatio: 1.14, incl: 1.45, speed: 0.18, sizeRatio: 0.09, phase: 3.9,
      agency: "🇺🇸 NASA · USGS", orbit: "Sun-synchronous LEO · ~917 km", launched: "23 Jul 1972", size: "~3 m", launchMs: Date.UTC(1972, 6, 23),
      fact: "Began the longest continuous record of Earth's surface from space — still running over 50 years later." },
    { label: "Voyager 1 (launch)", model: "/models/sat-voyager.glb", altRatio: 6.5, incl: 0.5, speed: 0.05, sizeRatio: 0.16, phase: 5.7,
      agency: "🇺🇸 NASA", orbit: "Departed Earth → interstellar", launched: "5 Sep 1977", size: "3.7 m dish", launchMs: Date.UTC(1977, 8, 5),
      fact: "Left Earth in 1977 on the grand tour of the outer planets; now the most distant human object, in interstellar space." },
    { label: "Iridium", model: "/models/sat-gps.glb", altRatio: 1.13, incl: 1.5, speed: 0.2, sizeRatio: 0.08, phase: 0.3,
      agency: "🇺🇸 Iridium", orbit: "LEO · ~780 km · 86.4°", launched: "1997 (constellation)", size: "~4 m", launchMs: Date.UTC(1997, 4, 5),
      fact: "A 66-satellite constellation giving satellite-phone coverage over the entire planet, poles included." },
    { label: "Starlink", model: "/models/sat-gps.glb", altRatio: 1.086, incl: 0.95, speed: 0.22, sizeRatio: 0.07, phase: 2.4,
      agency: "🇺🇸 SpaceX", orbit: "LEO · ~550 km · 53°", launched: "2019 (first batch)", size: "2.8 × 1.4 m flat", launchMs: Date.UTC(2019, 4, 24),
      fact: "The largest satellite constellation ever — thousands of flat-pack satellites delivering broadband, now the majority of all active satellites." },
  ],
  Mars: [
    { label: "MRO", model: "/models/craft-mro.glb", altRatio: 1.084, incl: 0.95, speed: 0.16, sizeRatio: 0.1, phase: 1.0,
      agency: "🇺🇸 NASA", orbit: "Mars orbit · ~250–320 km", launched: "2005", size: "~6.5 m span", launchMs: Date.UTC(2005, 7, 12),
      fact: "Mars Reconnaissance Orbiter — its HiRISE camera returns the sharpest images of the Martian surface." },
    { label: "MAVEN", model: "/models/craft-mro.glb", altRatio: 1.22, incl: 1.2, speed: 0.11, sizeRatio: 0.09, phase: 3.4,
      agency: "🇺🇸 NASA", orbit: "Mars · 150–6,200 km elliptical", launched: "2013", size: "~11 m span", launchMs: Date.UTC(2013, 10, 18),
      fact: "Mars Atmosphere and Volatile EvolutioN — measures how Mars lost its atmosphere to space over billions of years." },
  ],
  Jupiter: [
    { label: "Juno", model: "/models/craft-juno.glb", altRatio: 1.5, incl: 1.4, speed: 0.06, sizeRatio: 0.16, phase: 0.8,
      agency: "🇺🇸 NASA", orbit: "Jupiter polar orbit · 53-day", launched: "2011 · arrived 2016", size: "~20 m solar span", launchMs: Date.UTC(2016, 6, 5),
      fact: "Juno — a polar orbiter with three huge solar wings (Jupiter gets ~4% of Earth's sunlight), probing the giant's deep structure, gravity, and aurorae." },
  ],
  "Moon (Luna)": [
    { label: "LRO", model: "/models/craft-lro.glb", altRatio: 1.11, incl: 1.55, speed: 0.14, sizeRatio: 0.12, phase: 0.4,
      agency: "🇺🇸 NASA", orbit: "Lunar polar orbit · ~50 km", launched: "2009", size: "~4.3 m span", launchMs: Date.UTC(2009, 5, 18),
      fact: "Lunar Reconnaissance Orbiter — mapping the Moon in fine detail since 2009, including the Apollo landing sites and permanently-shadowed polar craters." },
  ],
}
Object.values(HERO_CRAFT).flat().forEach((c) => useGLTF.preload(c.model))

function HeroSatellite({
  craft,
  bodyRadius,
  onHover,
  interactive = false,
  trueScale = false,
}: {
  craft: HeroCraft
  bodyRadius: number
  onHover?: HoverHandler
  interactive?: boolean
  /** Render at real measured span vs Earth (the celestial explorer). */
  trueScale?: boolean
}) {
  const ref = useRef<import("three").Group>(null)
  const craftRef = useRef<import("three").Group>(null)
  const gltf = useGLTF(craft.model)
  const cloned = useMemo(() => {
    const c = gltf.scene.clone(true)
    c.traverse((ch) => { if ((ch as import("three").Mesh).isMesh) { ch.frustumCulled = false } })
    return c
  }, [gltf.scene])
  const r = bodyRadius * craft.altRatio
  // Launch-date gating: the craft only exists once the simulation clock passes
  // its launch instant. Polled in-frame so scrubbing the timeline reveals/hides
  // it — the space age unfolds as you move from 1957 forward. Bodies without a
  // launchMs (legacy) are always present.
  const [launched, setLaunched] = useState(
    craft.launchMs == null || simTimeRef.current.simMs >= craft.launchMs,
  )
  useFrame((_, delta) => {
    if (craft.launchMs != null) {
      const isUp = simTimeRef.current.simMs >= craft.launchMs
      if (isUp !== launched) setLaunched(isUp)
    }
    if (!ref.current) return
    ref.current.rotation.y += delta * craft.speed
  })

  // Follow this craft: lock the camera onto its live world position so the
  // viewer rides along as it orbits — same gesture as moons/comets. The getter
  // reads the inner group's world position each frame (it's inside the spinning
  // orbit group), so the follow stays glued as the craft circles the body.
  const startFollow = (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    const obj = craftRef.current
    if (!obj) return
    requestFollow(
      () => {
        const v = new Vector3()
        obj.getWorldPosition(v)
        return { x: v.x, y: v.y, z: v.z }
      },
      trueScale
        ? Math.max(((spanM / 1000 / 6371) * bodyRadius) * 8, 0.02)
        : Math.max(bodyRadius * craft.sizeRatio * 6, 0.12),
      craft.label,
    )
  }

  // TRUE-scale mode (the /lab/celestial explorer): the craft renders at its
  // real measured span vs Earth — parsed from the max figure in its `size`
  // string (deployed span) against the GLB's actual bounding box. At true
  // ratio every craft is sub-pixel from orbit distance, so a small halo
  // marks the position and the generous hit-sphere (kept OUTSIDE the scaled
  // group) preserves hover/click; following zooms until the real model fills
  // the view. The home hero keeps its documented perceptual sizing.
  const spanM = useMemo(() => {
    const nums = (craft.size?.match(/\d+(?:\.\d+)?/g) ?? []).map(Number)
    return nums.length ? Math.max(...nums) : 3
  }, [craft.size])
  const nativeSpan = useMemo(() => {
    const box = new Box3().setFromObject(cloned)
    const s = new Vector3()
    box.getSize(s)
    return Math.max(s.x, s.y, s.z) || 1
  }, [cloned])
  const visScale = trueScale
    ? ((spanM / 1000 / 6371) * bodyRadius) / nativeSpan
    : bodyRadius * craft.sizeRatio

  return (
    <group ref={ref} rotation={[craft.incl * 0.35, craft.phase, 0]}>
      {/* Orbit ring — the craft's path, so each can be tailed by eye. Only in
          the true-scale explorer (the home hero stays clean). */}
      {trueScale && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[r, bodyRadius * 0.0035, 6, 96]} />
          <meshBasicMaterial color="#7ec8ff" transparent opacity={0.16} depthWrite={false} />
        </mesh>
      )}
      <group ref={craftRef} position={[r, 0, 0]} visible={launched}>
        <group scale={visScale}>
          <primitive object={cloned} />
        </group>
        {/* Findability halo — at true ratio the craft itself is sub-pixel from
            orbit distance; this small glow marks where it is. */}
        {trueScale && (
          <mesh>
            <sphereGeometry args={[bodyRadius * 0.014, 10, 10]} />
            <meshBasicMaterial color="#aef" transparent opacity={0.55} blending={AdditiveBlending} depthWrite={false} />
          </mesh>
        )}
        {/* Invisible hit-sphere so the small craft is easy to hover/click —
            sized in WORLD units (not inside the visual scale) so true-scale
            mode keeps a usable touch target. */}
        <mesh
          scale={bodyRadius * craft.sizeRatio}
          onPointerOver={(e) => {
            e.stopPropagation()
            // Build a rich, real-data fact: description + agency/orbit/size/launch.
            const lines = [
              craft.fact,
              craft.agency && `Built by: ${craft.agency}`,
              craft.orbit && `Orbit: ${craft.orbit}`,
              craft.size && `Size: ${craft.size}`,
              craft.launched && `Launched: ${craft.launched}`,
              interactive && "Click to follow it around its orbit.",
            ].filter(Boolean)
            onHover?.({
              name: craft.label,
              classification: craft.agency ? `Human-made satellite · ${craft.agency.replace(/^[^A-Za-z]+/, "").split(" (")[0]}` : "Human-made spacecraft",
              fact: lines.join("\n"),
              followable: interactive,
            })
          }}
          onPointerOut={() => onHover?.(null)}
          onClick={interactive ? startFollow : undefined}
          onDoubleClick={interactive ? startFollow : undefined}
        >
          <sphereGeometry args={[2.2, 12, 12]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
    </group>
  )
}

export function SatelliteShells({
  shells,
  heroCraft,
  bodyRadius,
  onHover,
  interactive = false,
  trueScale = false,
}: {
  shells: SatelliteShell[]
  heroCraft?: HeroCraft[]
  bodyRadius: number
  onHover?: HoverHandler
  interactive?: boolean
  trueScale?: boolean
}) {
  return (
    <group>
      {shells.map((s) => (
        <SatelliteShellPoints key={s.label} shell={s} bodyRadius={bodyRadius} onHover={onHover} />
      ))}
      {heroCraft?.map((c) => (
        <Suspense key={c.label} fallback={null}>
          <HeroSatellite craft={c} bodyRadius={bodyRadius} onHover={onHover} interactive={interactive} trueScale={trueScale} />
        </Suspense>
      ))}
    </group>
  )
}

/** Single rover landing-site pin — a tiny coloured dome on the planet
 *  surface plus an invisible larger hit-zone so the pin is touch-findable.
 *  Hover surfaces the rover's full name + date + fact as a floating label. */
/* Scratch vectors for RoverPin's label occlusion test — module-scoped so the
 * per-frame check allocates nothing. */
const _pinWorld = new Vector3()
const _pinCenterWorld = new Vector3()
const _pinToCam = new Vector3()

/** Animated impact SIMULATION for a `status:"impact"` surface feature (a crash
 *  site). Loops a ~4.2 s cycle: a bright flash, an expanding shockwave ring, and
 *  a plume of debris particles arcing up and settling back — so the event reads
 *  as a live, highlighted happening, not a static dot. Sits on the surface at the
 *  feature's lat/lon (same placement math as RoverPin) and rotates with the body. */
const IMPACT_CYCLE = 4.2
const PLUME_N = 120
export function ImpactMarker({ feature, planetRadius }: { feature: SurfaceFeature; planetRadius: number }) {
  const flashRef = useRef<Mesh>(null)
  const ring1Ref = useRef<Mesh>(null)
  const ring2Ref = useRef<Mesh>(null)
  const coreRef = useRef<Mesh>(null)
  const plumeRef = useRef<Points>(null)

  const latRad = feature.lat * DEG
  const lonRad = feature.lon * DEG
  const r = planetRadius * 1.008
  const pos = useMemo(
    () => new Vector3(
      r * Math.cos(latRad) * Math.cos(lonRad),
      r * Math.sin(latRad),
      r * Math.cos(latRad) * Math.sin(lonRad),
    ),
    [r, latRad, lonRad],
  )
  const s = planetRadius // size unit

  // debris plume: per-particle launch direction (biased upward = surface normal)
  const plume = useMemo(() => {
    const positions = new Float32Array(PLUME_N * 3)
    const vel: Vector3[] = []
    const up = pos.clone().normalize()
    for (let i = 0; i < PLUME_N; i++) {
      // random hemisphere direction, biased toward the surface normal
      const v = new Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
        .normalize().multiplyScalar(0.35).add(up.clone().multiplyScalar(0.9)).normalize()
      vel.push(v.multiplyScalar(0.4 + Math.random() * 1.0))
    }
    const geo = new BufferGeometry()
    geo.setAttribute("position", new BufferAttribute(positions, 3))
    return { geo, positions, vel }
  }, [pos])

  const col = useMemo(() => new Color("#ffcaa0"), [])

  useFrame(() => {
    const t = ((performance.now() / 1000) % IMPACT_CYCLE) / IMPACT_CYCLE
    // phase 0–0.12: flash; 0–1: rings expand + fade; plume launches at t≈0 and arcs
    const flash = Math.max(0, 1 - t / 0.12)
    if (flashRef.current) {
      const m = flashRef.current.material as { opacity: number }
      m.opacity = flash * 0.95
      flashRef.current.scale.setScalar(s * (0.3 + flash * 1.6))
    }
    if (coreRef.current) {
      const m = coreRef.current.material as { opacity: number }
      m.opacity = 0.5 + 0.5 * Math.sin(performance.now() * 0.006) // steady hot pulse
    }
    const ringAt = (ref: typeof ring1Ref, phase: number) => {
      const rt = (t + phase) % 1
      if (!ref.current) return
      ref.current.scale.setScalar(s * (0.2 + rt * 3.4))
      const m = ref.current.material as { opacity: number }
      m.opacity = (1 - rt) * 0.5
    }
    ringAt(ring1Ref, 0)
    ringAt(ring2Ref, 0.5)
    // plume: launch at t≈0, arc up under a gentle "gravity", fade over the cycle
    if (plumeRef.current) {
      const tp = t // 0→1 across the cycle
      for (let i = 0; i < PLUME_N; i++) {
        const v = plume.vel[i]
        const g = 1.1 * tp * tp // simple parabolic fall-back
        const up = pos.clone().normalize()
        const p = pos.clone()
          .addScaledVector(v, tp * s * 2.2)
          .addScaledVector(up, -g * s * 1.4)
        plume.positions[3 * i] = p.x
        plume.positions[3 * i + 1] = p.y
        plume.positions[3 * i + 2] = p.z
      }
      plume.geo.attributes.position.needsUpdate = true
      const m = plumeRef.current.material as { opacity: number }
      m.opacity = (1 - t) * 0.85
    }
  })

  return (
    <group>
      {/* hot core — always glowing at the crash point */}
      <mesh ref={coreRef} position={pos}>
        <sphereGeometry args={[s * 0.05, 12, 12]} />
        <meshBasicMaterial color="#fff2d0" transparent opacity={0.9} blending={AdditiveBlending} depthWrite={false} />
      </mesh>
      {/* impact flash */}
      <mesh ref={flashRef} position={pos}>
        <sphereGeometry args={[s * 0.14, 12, 12]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0} blending={AdditiveBlending} depthWrite={false} />
      </mesh>
      {/* two expanding shockwave rings, oriented tangent to the surface */}
      <mesh ref={ring1Ref} position={pos} quaternion={surfaceQuat(pos)}>
        <ringGeometry args={[s * 0.12, s * 0.16, 40]} />
        <meshBasicMaterial color="#ffb890" transparent opacity={0} blending={AdditiveBlending} depthWrite={false} side={BackSide} />
      </mesh>
      <mesh ref={ring2Ref} position={pos} quaternion={surfaceQuat(pos)}>
        <ringGeometry args={[s * 0.12, s * 0.16, 40]} />
        <meshBasicMaterial color="#ff9a6b" transparent opacity={0} blending={AdditiveBlending} depthWrite={false} side={BackSide} />
      </mesh>
      {/* debris plume */}
      <points ref={plumeRef} geometry={plume.geo} frustumCulled={false}>
        <pointsMaterial size={s * 0.03} color={col} transparent opacity={0.8} depthWrite={false} blending={AdditiveBlending} sizeAttenuation />
      </points>
    </group>
  )
}

// Quaternion that lays a ring flat against the sphere surface at point p
// (its default normal +Z → the outward surface normal).
function surfaceQuat(p: Vector3) {
  return new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), p.clone().normalize())
}

export function RoverPin({
  feature,
  planetRadius,
  invert,
  interactive = false,
  onHover,
}: {
  feature: SurfaceFeature
  planetRadius: number
  invert: boolean
  /** Explore mode — gates the click-to-fly camera move (the auto journey owns
   *  the camera in passive mode, so pins only annotate there). */
  interactive?: boolean
  onHover?: HoverHandler
}) {
  const [isHovered, setIsHovered] = useState(false)
  // Sticky selection — the tag + InfoPanel open on CLICK (tap), not hover, so
  // the interaction works identically on touch and the label can't ambush the
  // scene just because the cursor crossed a hit zone. Re-click dismisses.
  const [selected, setSelected] = useState(false)
  const groupRef = useRef<Group>(null)
  const labelRef = useRef<HTMLDivElement>(null)
  const latRad = feature.lat * DEG
  const lonRad = feature.lon * DEG
  // Lat / lon → 3D position on the planet's surface in mesh-local frame
  // (after axial tilt, before per-frame rotation). Standard planetographic
  // spherical-to-cartesian: lat measures from equator, lon eastward from
  // the prime meridian (treated as local +x at rotation = 0).
  const r = planetRadius * 1.012   // sit slightly above surface so the
  const x = r * Math.cos(latRad) * Math.cos(lonRad)
  const y = r * Math.sin(latRad)
  const z = r * Math.cos(latRad) * Math.sin(lonRad)

  const isNatural = feature.status === "natural"
  const pinRadius = planetRadius * (isNatural ? 0.055 : 0.025)
  const hitRadius = Math.max(planetRadius * 0.12, 0.05)
  // Status colour: active = green, completed = warm amber, lost = muted red,
  // natural = warm tan ring (geographic landmark, not a mission target).
  const color =
    feature.status === "impact"    ? (invert ? "#c23a10" : "#ff7a3c") :
    feature.status === "active"    ? (invert ? "#1f6f3f" : "#7dffaf") :
    feature.status === "completed" ? (invert ? "#7a4a14" : "#ffc878") :
    feature.status === "lost"      ? (invert ? "#7a2828" : "#ff8888") :
    /* natural */                    (invert ? "#7a5028" : "#f0c890")
  const isImpact = feature.status === "impact"
  const year = feature.date !== "natural" ? feature.date.slice(0, 4) : null

  // Rich detail for the InfoPanel (desktop) / bottom sheet (mobile).
  const pinInfo = () => {
    const statusLabel =
      feature.status === "natural" ? "Surface feature" :
      feature.status === "active" ? "Mission · active" :
      feature.status === "lost" ? "Mission · lost" : "Mission · completed"
    const agencyDate = [feature.agency !== "—" ? feature.agency : null, feature.date !== "natural" ? feature.date : null]
      .filter(Boolean).join(" · ")
    return {
      name: feature.name,
      classification: agencyDate ? `${statusLabel} · ${agencyDate}` : statusLabel,
      fact: feature.fact,
    }
  }

  // Hover is only an affordance now: flip the custom cursor into its target
  // ring so the pin reads as clickable. Opening the detail is click's job.
  const broadcastCursor = (hovering: boolean) => {
    if (typeof window === "undefined") return
    window.dispatchEvent(
      new CustomEvent("universe:hover", {
        detail: { body: hovering ? pinInfo() : null, clickable: hovering },
      }),
    )
  }

  const select = () => {
    setSelected(true)
    onHover?.(pinInfo())
    // Single annotation at a time — other pins listen and stand down.
    window.dispatchEvent(new CustomEvent("ue:pin-select", { detail: { name: feature.name } }))
    // "View that place": ease the camera down to the site itself. The getter
    // tracks the pin's live world position, so the camera rides the body's
    // rotation and the site stays centred. Explore mode only — the passive
    // hero's journey owns the camera.
    if (interactive && groupRef.current) {
      const obj = groupRef.current
      requestFollow(
        () => {
          const v = new Vector3()
          obj.getWorldPosition(v)
          return { x: v.x, y: v.y, z: v.z }
        },
        Math.max(planetRadius * 1.6, 0.07),
        feature.name,
      )
    }
  }
  const deselect = () => {
    setSelected(false)
    onHover?.(null)
    // Release the camera only if this pin's follow is still the active one.
    if (followRef.current?.label === feature.name) cancelFollow()
  }

  // Stand down when another pin takes the selection (it owns the InfoPanel
  // now, so don't clear it) or when any sky-focus / reset supersedes us.
  useEffect(() => {
    if (!selected) return
    const onPin = (e: Event) => {
      const name = (e as CustomEvent<{ name?: string }>).detail?.name
      if (name !== feature.name) setSelected(false)
    }
    const onSkyFocus = () => setSelected(false)
    window.addEventListener("ue:pin-select", onPin)
    window.addEventListener("universe:sky-focus", onSkyFocus)
    return () => {
      window.removeEventListener("ue:pin-select", onPin)
      window.removeEventListener("universe:sky-focus", onSkyFocus)
    }
  }, [selected, feature.name])

  // Far-side occlusion — the pin's dot depth-tests against the globe, but the
  // Html tag floats above the canvas, so fade it when the site rotates away
  // from the camera. Dot product of the site's outward normal with the
  // pin→camera direction; no raycast, no allocation.
  useFrame(({ camera }) => {
    if (!selected || !labelRef.current || !groupRef.current) return
    groupRef.current.getWorldPosition(_pinWorld)
    groupRef.current.parent?.getWorldPosition(_pinCenterWorld)
    _pinToCam.copy(camera.position).sub(_pinWorld)
    const facing = _pinWorld.sub(_pinCenterWorld).dot(_pinToCam) > 0
    labelRef.current.style.opacity = facing ? "1" : "0"
  })

  return (
    <group ref={groupRef} position={[x, y, z]}>
      {/* Naturals render as a thin outline ring instead of a solid dot —
          they represent extended regions (volcanoes, canyons, basins),
          not point landing sites. Mission pins keep the solid sphere.
          Hover/selection swells the marker slightly as the click cue. */}
      <group scale={isHovered || selected ? 1.45 : 1}>
        {isImpact ? (
          <mesh>
            <sphereGeometry args={[pinRadius * 1.3, 12, 12]} />
            <meshBasicMaterial color={color} />
          </mesh>
        ) : isNatural ? (
          <mesh>
            <torusGeometry args={[pinRadius, pinRadius * 0.15, 8, 24]} />
            <meshBasicMaterial color={color} transparent opacity={0.85} />
          </mesh>
        ) : (
          <mesh>
            <sphereGeometry args={[pinRadius, 10, 10]} />
            <meshBasicMaterial color={color} />
          </mesh>
        )}
      </group>
      {/* Touch-friendly hit zone — invisible sphere larger than the visible
          pin so a finger or cursor can land on the landing site without
          surgical precision. Click (tap) toggles the annotation + detail. */}
      <mesh
        onPointerOver={(e) => {
          e.stopPropagation()
          setIsHovered(true)
          broadcastCursor(true)
        }}
        onPointerOut={() => {
          setIsHovered(false)
          broadcastCursor(false)
        }}
        onClick={(e) => {
          e.stopPropagation()
          if (selected) deselect()
          else select()
        }}
      >
        <sphereGeometry args={[hitRadius, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {/* Annotation tag — constant screen size (no distanceFactor: world-scaled
          Html blows up to a screen-wide slab at close zoom in the compressed
          scene). Chart-annotation styling: status dot + name + year in a quiet
          translucent chip, hairline leader line down to the pin. */}
      {selected && (
        <Html position={[0, pinRadius * 2.5, 0]} zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
          <div
            ref={labelRef}
            className="pointer-events-none flex -translate-x-1/2 -translate-y-full select-none flex-col items-center transition-opacity duration-200"
            style={{ animation: "ue-label-in 220ms ease-out both" }}
          >
            <div
              className={`
                flex items-center gap-1.5 whitespace-nowrap
                rounded-full border px-2.5 py-1 backdrop-blur-sm
                font-mono text-[9px] tracking-[0.22em] uppercase
                ${invert ? "border-black/15 bg-white/85 text-black/80" : "border-white/15 bg-black/55 text-white/90"}
              `}
            >
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: color }}
              />
              {feature.name}
              {year && <span className={invert ? "text-black/45" : "text-white/45"}>· {year}</span>}
            </div>
            <span aria-hidden="true" className={`h-2.5 w-px ${invert ? "bg-black/30" : "bg-white/30"}`} />
          </div>
        </Html>
      )}
    </group>
  )
}
