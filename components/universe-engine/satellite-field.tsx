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
import { useFrame, useThree } from "@react-three/fiber"
import { useGLTF, Line } from "@react-three/drei"
import * as THREE from "three"
import { simTimeRef, requestFollow, focusDepthRef, daysSinceJ2000 } from "./astronomy"

/**
 * Satellite archetypes — a small library of real-design Blender models picked by
 * the selected satellite's name / operator / orbit, so "every satellite has its
 * own design" without 15.7k individual meshes. The swarm stays a points field;
 * only the focused craft gets geometry, and which model it gets depends on what
 * it actually is.
 *
 *  realSpanM   real-world deployed span (m) — drives TRUE 1:1 scale vs Earth
 *  nativeSpan  the GLB's native width in model units (measured at export)
 *  k           scale coefficient: trueScale = k * earthVisualRadius
 */
type ArchetypeId = "cubesat" | "starlink" | "gps" | "comsat"
type Archetype = { url: string; label: string; realSpanM: number; nativeSpan: number; k: number }
function mkArch(url: string, label: string, realSpanM: number, nativeSpan: number): Archetype {
  return { url, label, realSpanM, nativeSpan, k: realSpanM / 1000 / 6371 / nativeSpan }
}
const ARCHETYPES: Record<ArchetypeId, Archetype> = {
  cubesat:  mkArch("/models/satellite-leopard.glb", "CubeSat",            1.7, 15.84),
  starlink: mkArch("/models/satellite-starlink.glb", "Starlink flat-pack", 30, 8.31),
  gps:      mkArch("/models/satellite-gps.glb",      "Navigation craft",   17, 11.42),
  comsat:   mkArch("/models/satellite-dish.glb",     "Dish comsat",        35, 12.22),
}
for (const a of Object.values(ARCHETYPES)) useGLTF.preload(a.url)

/** Pick an archetype from the satellite's name, operator, and orbit altitude. */
export function classifyArchetype(name: string, owner: string, altKm: number): ArchetypeId {
  const n = name.toUpperCase()
  if (n.includes("STARLINK")) return "starlink"
  if (n.includes("GPS") || n.includes("GLONASS") || n.includes("GALILEO") ||
      n.includes("NAVSTAR") || n.includes("BEIDOU") || n.includes("IRNSS") || n.includes("QZS"))
    return "gps"
  // navigation lives at MEO (~19,000–23,000 km); comms/weather at GEO (~35,786 km)
  if (altKm > 30000) return "comsat"
  if (altKm > 15000) return "gps"
  return "cubesat"
}

/**
 * Selection bridge — the explorer's search box (DOM) writes the chosen NORAD id
 * here; SatelliteField (R3F) reads it to highlight + follow + ring the satellite.
 * Module-scoped ref mirrors the engine's flyToRef/followRef loose-coupling.
 */
export const selectedSatRef: { current: number | null } = { current: null }

/** The chosen archetype label for the selected satellite (e.g. "Starlink
 *  flat-pack"), so the DOM search card can name what kind of craft it is. */
export const selectedArchetypeRef: { current: string | null } = { current: null }

export type SatMeta = { id: number; name: string; owner: string; type?: "PAY" | "R/B" | "DEB"; launchMs: number }

// Shared catalogue cache so the search box and the field don't double-fetch.
let _catalogPromise: Promise<SatMeta[]> | null = null
export function loadSatelliteCatalog(): Promise<SatMeta[]> {
  if (!_catalogPromise) {
    _catalogPromise = fetch("/data/satellites.json")
      .then((r) => r.json())
      .then((d) => (d.sats as SatMeta[]).map((s) => ({ id: s.id, name: s.name, owner: s.owner, type: s.type, launchMs: s.launchMs })))
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
// Debris + rocket bodies read as a hazard colour (dull red/amber), distinct from
// the cooler operator palette — the LeoLabs-style "junk vs active" separation.
const DEBRIS_COLOR: [number, number, number] = [1.0, 0.42, 0.32]
const RB_COLOR: [number, number, number] = [1.0, 0.62, 0.4]

type SatType = "PAY" | "R/B" | "DEB"
type Sat = { id: number; name: string; owner: string; type?: SatType; launchMs: number; l1: string; l2: string }

// Launch-gating uses days-since-J2000 (small → exact in a float32 shader uniform).
// Reuse the engine's canonical J2000 epoch + day helper (see astronomy.ts).
const msToJ2000Day = (ms: number) => daysSinceJ2000(ms)

const VERT = /* glsl */ `
  // NOTE: launch gating uses DAYS-since-J2000, not epoch-milliseconds. A GLSL
  // float is 32-bit (~24-bit mantissa, exact only to ~16.7M), so epoch-ms values
  // (~1.8e12 today) lose ~10^5 ms of precision — enough to corrupt the
  // 'launched yet?' comparison and leak pre-Space-Age satellites. Days-since-J2000
  // (|value| < ~25,000) is exact in float32, so the gate is reliable.
  attribute float aLaunchDay;   // days since J2000 (2000-01-01 12:00 UTC)
  attribute vec3 aColor;
  attribute float aDebris;      // 1 = debris / rocket body → render smaller
  uniform float uTimeDay;       // current sim time, days since J2000
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uIsolate;   // 1.0 = a satellite is selected → hide the whole swarm
  varying vec3 vColor;
  varying float vHidden;
  void main() {
    vColor = aColor;
    // Launch gating: not yet launched → collapse to zero size.
    // Isolate: when one satellite is selected we hide the rest (show only the GLB).
    vHidden = (aLaunchDay > uTimeDay || uIsolate > 0.5) ? 1.0 : 0.0;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    // debris are tiny fragments → ~60% the size of an active satellite dot.
    float sizeMul = aDebris > 0.5 ? 0.6 : 1.0;
    float s = vHidden > 0.5 ? 0.0 : uSize * sizeMul * uPixelRatio * (1.0 / -mv.z);
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
  const haloRef = useRef<THREE.Mesh>(null)
  const { camera } = useThree()
  const lastSelected = useRef<number | null>(null)
  // Orbit-path polyline for the selected satellite (recomputed on selection).
  const [orbitPts, setOrbitPts] = useState<THREE.Vector3[] | null>(null)
  // Which archetype model the selected satellite uses (chosen on selection).
  const [arch, setArch] = useState<Archetype>(ARCHETYPES.cubesat)
  const archRef = useRef<Archetype>(ARCHETYPES.cubesat)
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
    const isDeb = new Float32Array(n) // 1 = debris/rocket body → smaller in shader
    sats.forEach((s, i) => {
      const c =
        s.type === "DEB" ? DEBRIS_COLOR :
        s.type === "R/B" ? RB_COLOR :
        (OWNER_COLOR[s.owner] ?? DEFAULT_COLOR)
      colors[i * 3] = c[0]; colors[i * 3 + 1] = c[1]; colors[i * 3 + 2] = c[2]
      isDeb[i] = (s.type === "DEB" || s.type === "R/B") ? 1 : 0
      // store launch as days-since-J2000 (small → exact in the float32 attribute)
      launch[i] = msToJ2000Day(s.launchMs)
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3))
    g.setAttribute("aColor", new THREE.BufferAttribute(colors, 3))
    g.setAttribute("aLaunchDay", new THREE.BufferAttribute(launch, 1))
    g.setAttribute("aDebris", new THREE.BufferAttribute(isDeb, 1))
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), earthVisualRadius * 12)
    return g
  }, [sats, earthVisualRadius])

  useFrame(() => {
    if (matRef.current) matRef.current.uniforms.uTimeDay.value = msToJ2000Day(simTimeRef.current.simMs)
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

          // Locator halo: subtends a ~constant small screen size when far (so you
          // can FIND the otherwise-invisible 1:1 craft), then shrinks + fades to
          // nothing as you approach, letting the real model emerge. Sized in the
          // marker's LOCAL space (it's the group child) from the camera distance.
          const halo = haloRef.current
          if (halo) {
            const world = new THREE.Vector3()
            marker.getWorldPosition(world)
            const dist = camera.position.distanceTo(world)
            const span = archRef.current.k * earthVisualRadius * archRef.current.nativeSpan
            // fade band: full halo beyond span*60, gone by span*8 (craft takes over)
            const fade = Math.min(1, Math.max(0, (dist / span - 8) / 52))
            // local scale ÷ marker's world scale so the screen size is distance-stable
            const worldScale = marker.getWorldScale(new THREE.Vector3()).x || 1
            const haloLocal = (dist * 0.015 * fade) / worldScale
            halo.scale.setScalar(haloLocal)
            const mat = halo.material as THREE.MeshBasicMaterial
            mat.opacity = 0.85 * fade
            halo.visible = fade > 0.01
          }
        }
        // On a NEW selection: pick the archetype, follow, recompute the orbit, and
        // tighten the camera near-plane / zoom floor so the user can dolly right
        // up to the true-1:1 craft (FlyToController reads focusDepthRef).
        if (sel !== lastSelected.current) {
          lastSelected.current = sel
          setOrbitPts(computeOrbit(rec))

          // altitude (km) from a fresh propagate → drives archetype choice
          const meta = sats.find((s) => s.id === sel)
          let altKm = 0
          {
            let rr: { position?: { x: number; y: number; z: number } } | false = false
            try { rr = lib.propagate(rec, date) } catch { rr = false }
            const pp = rr && rr.position
            if (pp) altKm = Math.sqrt(pp.x * pp.x + pp.y * pp.y + pp.z * pp.z) - EARTH_RADIUS_KM
          }
          const a = ARCHETYPES[classifyArchetype(meta?.name ?? "", meta?.owner ?? "", altKm)]
          archRef.current = a
          setArch(a)

          // true on-screen span of THIS archetype's model, in scene units
          const span = a.k * earthVisualRadius * a.nativeSpan
          // Let the camera approach to ~0.8× the craft's size; near-plane half that.
          focusDepthRef.current = {
            near: Math.max(span * 0.5, 1e-6),
            minDistance: Math.max(span * 0.8, 2e-6),
          }
          // expose the chosen archetype label to the search card (DOM side)
          selectedArchetypeRef.current = a.label
          const m = marker
          requestFollow(
            () => {
              const v = new THREE.Vector3()
              m.getWorldPosition(v)
              return { x: v.x, y: v.y, z: v.z }
            },
            // fly in to a few craft-widths away — close enough to read the craft,
            // far enough to take it in. (Was 0.6 Earth-radii = a fifth of Earth.)
            Math.max(span * 6, 3e-6),
            meta?.name,
          )
        }
      }
    } else if (marker) {
      marker.visible = false
      if (lastSelected.current !== null) {
        lastSelected.current = null
        setOrbitPts(null)
        focusDepthRef.current = null   // restore normal near-plane / zoom limits
      }
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
            uTimeDay: { value: msToJ2000Day(simTimeRef.current.simMs) },
            uSize: { value: 90 },
            uPixelRatio: { value: typeof window !== "undefined" ? Math.min(window.devicePixelRatio, 2) : 1 },
            uIsolate: { value: 0 },
          }}
        />
      </points>

      {/* Selected satellite, riding its live SGP4 position. The model (one of four
          archetypes chosen by what the craft actually is) is at TRUE 1:1 scale vs
          Earth — invisibly small from afar — so a locator halo (haloRef) marks the
          spot when far and shrinks to nothing as you approach, revealing the real
          craft. Hidden until a selection is set. */}
      <group ref={markerRef} visible={false}>
        <SatModel url={arch.url} scale={arch.k * earthVisualRadius} />
        <mesh ref={haloRef}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshBasicMaterial color="#ffd24a" transparent opacity={0.85} toneMapped={false} depthWrite={false} />
        </mesh>
      </group>

      {/* Orbital path of the selected satellite (one full revolution). */}
      {orbitPts && orbitPts.length > 1 && (
        <Line points={orbitPts} color="#ffd24a" transparent opacity={0.4} lineWidth={1} />
      )}
    </>
  )
}

/** The chosen archetype GLB, cloned for the selected satellite. Cloning keys on
 *  the url so switching archetypes swaps the mesh. */
function SatModel({ url, scale }: { url: string; scale: number }) {
  const { scene } = useGLTF(url)
  const cloned = useMemo(() => scene.clone(), [scene, url])
  return <primitive object={cloned} scale={scale} />
}
