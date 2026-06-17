"use client"

/**
 * SatelliteField — the real ~15,700-satellite catalogue as one GPU points field
 * orbiting Earth, positioned by true SGP4 propagation (satellite.js) and gated
 * to appear on each satellite's real launch date as the timeline scrubs.
 *
 * Data: /data/satellites.json (built by scripts/fetch-satellites.mjs from
 * CelesTrak SATCAT + TLE) — { id, name, owner, launchMs, l1, l2 }.
 *
 * Performance: 15.7k satellites is one draw call (a single <points>). The cost
 * is SGP4 propagation; we recompute positions on a throttle (~4 Hz) rather than
 * every frame, and gate visibility in the vertex shader (zero per-point JS for
 * the launch timeline). Mounted inside Earth's group so it inherits Earth's
 * world transform; sizes are in Earth-radii (earthVisualRadius prop).
 *
 * Honest limitation: TLEs are current-epoch, so positions are accurate for
 * ~now; scrubbing deep into the past still shows satellites appearing on their
 * real launch dates but on their present orbits (surfaced in the UI copy).
 */

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"
import { simTimeRef } from "./astronomy"

// satellite.js is imported DYNAMICALLY (below), not at the top level — a static
// import drags it into the Turbopack build graph and hangs `next build`. Loading
// it lazily at runtime keeps the production build fast and the SGP4 code out of
// the initial chunk.
type Sgp4 = {
  twoline2satrec: (l1: string, l2: string) => unknown
  propagate: (rec: unknown, date: Date) => { position?: { x: number; y: number; z: number } } | false
}

const EARTH_RADIUS_KM = 6371
const RECOMPUTE_MS = 250 // SGP4 refresh cadence (4 Hz)

// Owner → colour palette (broad operator/nation groups).
const OWNER_COLOR: Record<string, [number, number, number]> = {
  US: [0.45, 0.7, 1.0],
  PRC: [1.0, 0.5, 0.45],
  CIS: [1.0, 0.8, 0.5],
  UK: [0.6, 1.0, 0.7],
  ESA: [0.8, 0.7, 1.0],
  JPN: [1.0, 0.6, 0.8],
  IND: [0.7, 1.0, 0.85],
}
const DEFAULT_COLOR: [number, number, number] = [0.7, 0.75, 0.85]

type Sat = { id: number; name: string; owner: string; launchMs: number; l1: string; l2: string }

const VERT = /* glsl */ `
  attribute float aLaunchMs;
  attribute vec3 aColor;
  uniform float uTimeMs;
  uniform float uSize;
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying float vHidden;
  void main() {
    vColor = aColor;
    // Launch gating: not yet launched → collapse to zero size.
    vHidden = aLaunchMs > uTimeMs ? 1.0 : 0.0;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float s = vHidden > 0.5 ? 0.0 : uSize * uPixelRatio * (1.0 / -mv.z);
    gl_PointSize = clamp(s, 0.0, 4.0);
  }
`
const FRAG = /* glsl */ `
  precision mediump float;
  varying vec3 vColor;
  varying float vHidden;
  void main() {
    if (vHidden > 0.5) discard;
    // round point
    vec2 c = gl_PointCoord - 0.5;
    if (dot(c, c) > 0.25) discard;
    gl_FragColor = vec4(vColor, 0.9);
  }
`

export function SatelliteField({ earthVisualRadius }: { earthVisualRadius: number }) {
  const [sats, setSats] = useState<Sat[] | null>(null)
  const satrecs = useRef<unknown[]>([])
  const sgp4 = useRef<Sgp4 | null>(null)
  const pointsRef = useRef<THREE.Points>(null)
  const matRef = useRef<THREE.ShaderMaterial>(null)
  const lastCompute = useRef(0)
  // scene units per km, so satellite altitudes sit just above Earth's sphere
  const kmToScene = earthVisualRadius / EARTH_RADIUS_KM

  useEffect(() => {
    let cancelled = false
    // Load satellite.js + the catalogue in parallel, then build satrecs.
    Promise.all([
      import("satellite.js") as Promise<unknown> as Promise<Sgp4>,
      fetch("/data/satellites.json").then((r) => r.json()),
    ])
      .then(([lib, d]) => {
        if (cancelled) return
        sgp4.current = lib
        const list: Sat[] = d.sats
        satrecs.current = list.map((s) => {
          try { return lib.twoline2satrec(s.l1, s.l2) } catch { return null }
        })
        setSats(list)
      })
      .catch(() => setSats([]))
    return () => { cancelled = true }
  }, [])

  const geometry = useMemo(() => {
    if (!sats || sats.length === 0) return null
    const n = sats.length
    const positions = new Float32Array(n * 3)
    const colors = new Float32Array(n * 3)
    const launch = new Float32Array(n)
    sats.forEach((s, i) => {
      const c = OWNER_COLOR[s.owner] ?? DEFAULT_COLOR
      colors[i * 3] = c[0]; colors[i * 3 + 1] = c[1]; colors[i * 3 + 2] = c[2]
      launch[i] = s.launchMs
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3))
    g.setAttribute("aColor", new THREE.BufferAttribute(colors, 3))
    g.setAttribute("aLaunchMs", new THREE.BufferAttribute(launch, 1))
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), earthVisualRadius * 12)
    return g
  }, [sats, earthVisualRadius])

  useFrame(() => {
    if (matRef.current) matRef.current.uniforms.uTimeMs.value = simTimeRef.current.simMs
    const lib = sgp4.current
    if (!geometry || !sats || !lib) return
    const now = performance.now()
    if (now - lastCompute.current < RECOMPUTE_MS) return
    lastCompute.current = now

    const date = new Date(simTimeRef.current.simMs)
    const pos = geometry.getAttribute("position") as THREE.BufferAttribute
    const arr = pos.array as Float32Array
    const recs = satrecs.current
    for (let i = 0; i < recs.length; i++) {
      const rec = recs[i]
      if (!rec) continue
      let r: { position?: { x: number; y: number; z: number } } | false = false
      try { r = lib.propagate(rec, date) } catch { r = false }
      const p = r && r.position
      if (!p) { arr[i * 3] = 0; arr[i * 3 + 1] = 0; arr[i * 3 + 2] = 0; continue }
      // ECI km → scene units. Map ECI (x,y,z) to scene (x, z, -y) so the orbital
      // plane sits around Earth's equator in scene space.
      arr[i * 3] = p.x * kmToScene
      arr[i * 3 + 1] = p.z * kmToScene
      arr[i * 3 + 2] = -p.y * kmToScene
    }
    pos.needsUpdate = true
  })

  if (!geometry) return null

  return (
    <points ref={pointsRef} geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={matRef}
        vertexShader={VERT}
        fragmentShader={FRAG}
        transparent
        depthWrite={false}
        uniforms={{
          uTimeMs: { value: simTimeRef.current.simMs },
          uSize: { value: 90 },
          uPixelRatio: { value: typeof window !== "undefined" ? Math.min(window.devicePixelRatio, 2) : 1 },
        }}
      />
    </points>
  )
}
