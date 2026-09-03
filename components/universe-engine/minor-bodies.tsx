"use client"

/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine — see ./index.tsx for the full notice.
 *
 * minor-bodies — the REAL small-body population, from data.
 *
 * Every asteroid brighter than H 8 (≈ every rock ≳ 65 km, including the big
 * trans-Neptunian worlds), every kilometre-class near-Earth object, and every
 * catalogued elliptical comet — 7,000+ bodies from NASA/JPL's Small-Body
 * Database, each carrying its six Keplerian elements at its JPL epoch. The
 * layer propagates all of them to their true positions for the CURRENT sim
 * date (same Kepler math, same compressed-AU frame as the planets), so what
 * you see is the real architecture of the solar system: the sparse belt of
 * true giants, the warm sprinkle of Earth-crossers, comet ellipses reaching
 * out past Neptune, and the Kuiper belt as an actual population — not a
 * painted ring.
 *
 * Presentation follows the house rules: findability by BRIGHTNESS not girth
 * (tiny additive glints, class-tinted), nothing invented, click any point to
 * follow the real body with its real elements in the info panel.
 */

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"
import {
  DEG,
  simTimeRef,
  requestFollow,
  minorBodiesVisibleRef,
  orbitalElementsToCartesian,
} from "./astronomy"
import { pointSprite } from "./galaxy"
import type { BodyInfo, HoverHandler } from "./types"

type MinorBody = {
  n: string; a: number; e: number; i: number; om: number; w: number
  ma: number; ep: number; H?: number; d?: number; c: string; k: "a" | "n" | "c"
}

const DOT_SPRITE = typeof document !== "undefined" ? pointSprite() : null

// JPL orbit classes → honest labels + the layer's palette. Comets cool
// cyan-green, Earth-crossers warm amber, distant ice soft blue — tinted for
// legibility, never brighter than the planets they thread between.
const CLASS_META: Record<string, { label: string; color: string }> = {
  JFc: { label: "Jupiter-family comet", color: "#7fe8d0" },
  JFC: { label: "Jupiter-family comet", color: "#7fe8d0" },
  HTC: { label: "Halley-type comet", color: "#8ff0e0" },
  ETc: { label: "Encke-type comet", color: "#7fe8d0" },
  CTc: { label: "Chiron-type comet", color: "#7fe8d0" },
  COM: { label: "Long-period comet", color: "#9ff5e8" },
  APO: { label: "Apollo near-Earth asteroid (Earth-crossing)", color: "#ffb066" },
  ATE: { label: "Aten near-Earth asteroid (Earth-crossing)", color: "#ffc078" },
  AMO: { label: "Amor near-Earth asteroid", color: "#ffab5e" },
  IEO: { label: "Atira asteroid (inside Earth's orbit)", color: "#ffd28a" },
  MBA: { label: "Main-belt asteroid", color: "#d8c9a8" },
  IMB: { label: "Inner main-belt asteroid", color: "#d8c9a8" },
  OMB: { label: "Outer main-belt asteroid", color: "#cfc2a4" },
  MCA: { label: "Mars-crossing asteroid", color: "#e8b88a" },
  TJN: { label: "Jupiter trojan", color: "#c9b8ff" },
  CEN: { label: "Centaur", color: "#8fe0c0" },
  TNO: { label: "Trans-Neptunian object", color: "#9fc0ff" },
}
const FALLBACK_META = { label: "Small body", color: "#c8c8c8" }

/** Solve Kepler's equation M → E (Newton), then return the true anomaly. */
function trueAnomalyFromMean(Mrad: number, e: number): number {
  let E = e < 0.8 ? Mrad : Math.PI
  for (let k = 0; k < 10; k++) {
    const f = E - e * Math.sin(E) - Mrad
    E -= f / (1 - e * Math.cos(E))
  }
  return 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2))
}

/** Propagate one body to scene coordinates at a sim time (ms). */
function propagate(b: MinorBody, simMs: number): [number, number, number] {
  const jd = simMs / 86_400_000 + 2_440_587.5
  const n = 0.9856076686 / Math.pow(b.a, 1.5) // deg/day
  const M = ((b.ma + n * (jd - b.ep)) % 360) * DEG
  const nu = trueAnomalyFromMean(M, b.e)
  return orbitalElementsToCartesian(b.a, b.e, nu, b.i * DEG, b.om * DEG, b.w * DEG)
}

export function MinorBodies({
  onHover,
  interactive = false,
  invert = false,
}: {
  onHover: HoverHandler
  interactive?: boolean
  invert?: boolean
}) {
  const [bodies, setBodies] = useState<MinorBody[] | null>(null)
  const pointsRef = useRef<THREE.Points>(null)
  const geomRef = useRef<THREE.BufferGeometry | null>(null)
  // Chunked Kepler sweep state: which sim time the buffer was computed for,
  // and how far the current sweep has advanced.
  const computedMs = useRef<number | null>(null)
  const sweepTargetMs = useRef(0)
  const cursor = useRef(0)
  const selected = useRef<number | null>(null)

  useEffect(() => {
    let alive = true
    fetch("/data/minor-bodies.json")
      .then((r) => r.json())
      .then((d: { bodies: MinorBody[] }) => { if (alive) setBodies(d.bodies) })
      .catch(() => { /* layer simply doesn't mount — nothing invented */ })
    return () => { alive = false }
  }, [])

  const geometry = useMemo(() => {
    if (!bodies) return null
    const g = new THREE.BufferGeometry()
    const pos = new Float32Array(bodies.length * 3)
    const col = new Float32Array(bodies.length * 3)
    const c = new THREE.Color()
    for (let i = 0; i < bodies.length; i++) {
      const meta = CLASS_META[bodies[i].c] ?? FALLBACK_META
      c.set(meta.color)
      // Chart (light) mode wants dark dots on paper; night mode additive glints.
      if (invert) c.multiplyScalar(0.4)
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3))
    g.setAttribute("color", new THREE.BufferAttribute(col, 3))
    // Positions stream in over the first sweep; don't cull the growing cloud.
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6)
    geomRef.current = g
    return g
  }, [bodies, invert])

  useFrame(() => {
    const g = geomRef.current
    if (!g || !bodies) return
    if (pointsRef.current) pointsRef.current.visible = minorBodiesVisibleRef.current
    if (!minorBodiesVisibleRef.current) return

    const simMs = simTimeRef.current.simMs
    const sweeping = cursor.current < bodies.length
    // Start a fresh sweep when the clock has moved ≳ 20 sim-minutes from what
    // the buffer shows (comets near perihelion + NEOs move fastest; points
    // this small stay visually continuous at that cadence).
    if (!sweeping && (computedMs.current === null || Math.abs(simMs - computedMs.current) > 20 * 60_000)) {
      sweepTargetMs.current = simMs
      cursor.current = 0
    }
    if (cursor.current >= bodies.length) return
    const pos = g.getAttribute("position") as THREE.BufferAttribute
    const arr = pos.array as Float32Array
    // ~6 frames per full pass over the 7k catalogue — imperceptible while
    // scrubbing, ~free at real-time cadence.
    const end = Math.min(bodies.length, cursor.current + 1200)
    for (let i = cursor.current; i < end; i++) {
      const [x, y, z] = propagate(bodies[i], sweepTargetMs.current)
      arr[i * 3] = x; arr[i * 3 + 1] = y; arr[i * 3 + 2] = z
    }
    cursor.current = end
    pos.needsUpdate = true
    if (end >= bodies.length) computedMs.current = sweepTargetMs.current
  })

  if (!geometry || !bodies) return null

  return (
    <points
      ref={pointsRef}
      geometry={geometry}
      frustumCulled={false}
      onClick={interactive ? (e) => {
        // Drag guard — same lesson as the satellite swarm: a camera-orbit
        // release must never register as a pick.
        if ((e as unknown as { delta?: number }).delta && (e as unknown as { delta: number }).delta > 5) return
        const idx = e.index ?? e.intersections?.[0]?.index
        if (idx == null) return
        e.stopPropagation()
        selected.current = idx
        const b = bodies[idx]
        const meta = CLASS_META[b.c] ?? FALLBACK_META
        const periodYears = Math.pow(b.a, 1.5)
        const info: BodyInfo = {
          name: b.n,
          classification: meta.label,
          aAU: b.a,
          periodDays: periodYears * 365.25,
          fact:
            `${meta.label} on a real catalogued orbit: a ${b.a} AU, e ${b.e}, i ${b.i}° — one trip around the Sun every ` +
            (periodYears < 2 ? `${Math.round(periodYears * 365.25)} days` : `${periodYears.toFixed(1)} years`) +
            `.` +
            (b.d ? ` Measured diameter ${b.d} km.` : b.H != null ? ` Absolute magnitude H ${b.H}.` : "") +
            ` Position computed from its JPL Small-Body Database elements for the current date.`,
        }
        onHover(info)
        requestFollow(
          () => {
            const [x, y, z] = propagate(b, simTimeRef.current.simMs)
            return { x, y, z }
          },
          0.35,
          b.n,
        )
      } : undefined}
    >
      <pointsMaterial
        size={0.055}
        sizeAttenuation
        vertexColors
        transparent
        opacity={invert ? 0.85 : 0.95}
        depthWrite={false}
        blending={invert ? THREE.NormalBlending : THREE.AdditiveBlending}
        map={DOT_SPRITE}
      />
    </points>
  )
}
