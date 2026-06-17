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
 * Selection / isolate: when one satellite is picked (search or click), the swarm
 * hides (shader uIsolate), a real LEOPARD CubeSat GLB rides that satellite's live
 * SGP4 position (oriented along travel), its full orbital path draws as a line,
 * and the camera follows. Only one detailed mesh ever exists, and the full
 * catalogue sweep is skipped while isolated — cheap enough for mobile.
 *
 * Honest limitation: TLEs are current-epoch, so positions are accurate for
 * ~now; scrubbing deep into the past still shows satellites appearing on their
 * real launch dates but on their present orbits (surfaced in the UI copy).
 */

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { useGLTF, Line } from "@react-three/drei"
import * as THREE from "three"
import { simTimeRef, requestFollow } from "./astronomy"

// Real CubeSat model (LEOPARD, built in Blender) shown for the SELECTED satellite
// — the 15.7k swarm stays a points field; only the focused one gets geometry.
const SAT_MODEL_URL = "/models/satellite-leopard.glb"
useGLTF.preload(SAT_MODEL_URL)

/**
 * Selection bridge — the explorer's search box (DOM) writes the chosen NORAD id
 * here; SatelliteField (R3F) reads it to highlight + follow + ring the satellite.
 * Module-scoped ref mirrors the engine's flyToRef/followRef loose-coupling.
 */
export const selectedSatRef: { current: number | null } = { current: null }

export type SatMeta = { id: number; name: string; owner: string; launchMs: number }

// Shared catalogue cache so the search box and the field don't double-fetch.
let _catalogPromise: Promise<SatMeta[]> | null = null
export function loadSatelliteCatalog(): Promise<SatMeta[]> {
  if (!_catalogPromise) {
    _catalogPromise = fetch("/data/satellites.json")
      .then((r) => r.json())
      .then((d) => (d.sats as SatMeta[]).map((s) => ({ id: s.id, name: s.name, owner: s.owner, launchMs: s.launchMs })))
      .catch(() => [])
  }
  return _catalogPromise
}

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
  uniform float uIsolate;   // 1.0 = a satellite is selected → hide the whole swarm
  varying vec3 vColor;
  varying float vHidden;
  void main() {
    vColor = aColor;
    // Launch gating: not yet launched → collapse to zero size.
    // Isolate: when one satellite is selected we hide the rest (show only the GLB).
    vHidden = (aLaunchMs > uTimeMs || uIsolate > 0.5) ? 1.0 : 0.0;
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

  const markerRef = useRef<THREE.Group>(null)
  const lastSelected = useRef<number | null>(null)
  // Orbit-path polyline for the selected satellite (recomputed on selection).
  const [orbitPts, setOrbitPts] = useState<THREE.Vector3[] | null>(null)
  // NORAD id → buffer index, for fast selection lookup.
  const idToIndex = useMemo(() => {
    const m = new Map<number, number>()
    sats?.forEach((s, i) => m.set(s.id, i))
    return m
  }, [sats])

  // Propagate one full orbit of a satrec into scene-space points (for the path
  // line). Period from mean motion `no` (rad/min); fall back to ~95 min LEO.
  function computeOrbit(rec: unknown): THREE.Vector3[] {
    const lib = sgp4.current
    if (!lib || !rec) return []
    const no = (rec as { no?: number }).no ?? 0
    const periodMin = no > 0 ? (2 * Math.PI) / no : 95
    const start = simTimeRef.current.simMs
    const steps = 128
    const out: THREE.Vector3[] = []
    for (let i = 0; i <= steps; i++) {
      const t = new Date(start + (periodMin * 60000 * i) / steps)
      let r: { position?: { x: number; y: number; z: number } } | false = false
      try { r = lib.propagate(rec, t) } catch { r = false }
      const p = r && r.position
      if (p) out.push(new THREE.Vector3(p.x * kmToScene, p.z * kmToScene, -p.y * kmToScene))
    }
    return out
  }

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
    const sel = selectedSatRef.current
    const isolated = sel != null
    // Isolate mode hides the whole swarm → tell the shader + skip the (expensive)
    // full-catalogue SGP4 sweep; we only propagate the one selected satellite.
    if (matRef.current) matRef.current.uniforms.uIsolate.value = isolated ? 1 : 0

    const now = performance.now()
    if (now - lastCompute.current < RECOMPUTE_MS) return
    lastCompute.current = now

    const date = new Date(simTimeRef.current.simMs)
    const pos = geometry.getAttribute("position") as THREE.BufferAttribute
    const arr = pos.array as Float32Array
    const recs = satrecs.current

    if (!isolated) {
      // swarm view: propagate every satellite (throttled to 4 Hz)
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
    }

    // --- selected satellite: position the GLB marker, orient it, follow, orbit ---
    const marker = markerRef.current
    if (sel != null && marker) {
      const idx = idToIndex.get(sel)
      const rec = idx != null ? recs[idx] : null
      if (rec) {
        let r: { position?: { x: number; y: number; z: number } } | false = false
        try { r = lib.propagate(rec, date) } catch { r = false }
        const p = r && r.position
        if (p) {
          const cur = new THREE.Vector3(p.x * kmToScene, p.z * kmToScene, -p.y * kmToScene)
          // orient the model along its direction of travel (sample a moment ahead)
          let r2: { position?: { x: number; y: number; z: number } } | false = false
          try { r2 = lib.propagate(rec, new Date(date.getTime() + 30000)) } catch { r2 = false }
          const p2 = r2 && r2.position
          marker.position.copy(cur)
          if (p2) {
            const ahead = new THREE.Vector3(p2.x * kmToScene, p2.z * kmToScene, -p2.y * kmToScene)
            if (ahead.distanceToSquared(cur) > 1e-9) marker.lookAt(ahead)
          }
          marker.visible = true
        }
        // On a NEW selection: follow + recompute the orbit polyline once.
        if (sel !== lastSelected.current) {
          lastSelected.current = sel
          setOrbitPts(computeOrbit(rec))
          const m = marker
          requestFollow(
            () => {
              const v = new THREE.Vector3()
              m.getWorldPosition(v)
              return { x: v.x, y: v.y, z: v.z }
            },
            Math.max(earthVisualRadius * 0.6, 0.08),
            sats.find((s) => s.id === sel)?.name,
          )
        }
      }
    } else if (marker) {
      marker.visible = false
      if (lastSelected.current !== null) { lastSelected.current = null; setOrbitPts(null) }
    }
  })

  if (!geometry) return null

  return (
    <>
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
            uIsolate: { value: 0 },
          }}
        />
      </points>

      {/* Selected satellite: the real LEOPARD CubeSat model + a faint locator ring,
          riding its live SGP4 position. Hidden until a selection is set. */}
      <group ref={markerRef} visible={false}>
        <SatModel scale={earthVisualRadius * 0.012} />
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[earthVisualRadius * 0.07, earthVisualRadius * 0.085, 40]} />
          <meshBasicMaterial color="#ffd24a" transparent opacity={0.55} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      </group>

      {/* Orbital path of the selected satellite (one full revolution). */}
      {orbitPts && orbitPts.length > 1 && (
        <Line points={orbitPts} color="#ffd24a" transparent opacity={0.4} lineWidth={1} />
      )}
    </>
  )
}

/** The LEOPARD CubeSat GLB, reused (cloned) for whichever satellite is selected. */
function SatModel({ scale }: { scale: number }) {
  const { scene } = useGLTF(SAT_MODEL_URL)
  const cloned = useMemo(() => scene.clone(), [scene])
  return <primitive object={cloned} scale={scale} />
}
