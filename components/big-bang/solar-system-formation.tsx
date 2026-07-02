"use client"

/**
 * Solar System formation — the payoff at the end of the cosmic timeline.
 *
 * As the scrub crosses the `solarsystem` epoch (~9.2 Gyr after the Big Bang),
 * this sub-scene fades in and plays out, in three overlapping beats driven by a
 * single 0..1 `phase` (derived from log-time, so scrubbing drives it too):
 *
 *   0.00 – 0.45  COLLAPSE   a spinning protoplanetary disk of dust + ice
 *                           condenses inward toward a dim, growing core.
 *   0.30 – 0.65  IGNITION   the core ignites — the Sun lights up, the inner
 *                           disk is blown clear, the disk thins.
 *   0.55 – 1.00  PLANETS    eight planets condense out of the disk and settle
 *                           into real-ratio (log-compressed) tilted orbits,
 *                           then orbit at their true relative speeds.
 *
 * Colours, AU spacing, and axial tilts are pulled from the Universe Engine's
 * astronomy table so this reads as *our* system, not a generic one. The render
 * is deliberately procedural (additive sprites + emissive spheres, no textures)
 * so it stays light on the static export and matches the baked-glow language of
 * the rest of the Big Bang scene.
 */

import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"
import "@/components/universe-engine/three-line"

// log-time of the two anchor epochs (must match timeline.ts timeSeconds).
const T_SOLAR = Math.log10(2.9e17) // ~9.2 Gyr — the "Our Solar System" epoch
const T_TODAY = Math.log10(4.35e17) // 13.8 Gyr — fully formed
// Start the formation right as the "Our Solar System" epoch label appears (only
// a hair before, so the disk is just beginning to gather as the words show) and
// finish a touch before "today". Keeping FADE_IN ≈ T_SOLAR means the on-screen
// story and the HUD label stay in sync.
const FADE_IN = T_SOLAR - 0.05
const FORM_END = T_TODAY - 0.02

/** phase 0..1 across the formation window (also drives the master opacity). */
function formationPhase(tLog: number) {
  return THREE.MathUtils.clamp((tLog - FADE_IN) / (FORM_END - FADE_IN), 0, 1)
}

const smooth = (e0: number, e1: number, x: number) => {
  const t = THREE.MathUtils.clamp((x - e0) / (e1 - e0), 0, 1)
  return t * t * (3 - 2 * t)
}

// --- our planets, in real order. shade + AU + tilt mirror astronomy.ts. ---
type Pl = { name: string; au: number; size: number; shade: string; tiltDeg: number; rings?: boolean }
const PLANETS: Pl[] = [
  { name: "Mercury", au: 0.39, size: 0.14, shade: "#8a8378", tiltDeg: 0 },
  { name: "Venus", au: 0.72, size: 0.21, shade: "#d8b87a", tiltDeg: 177.4 },
  { name: "Earth", au: 1.0, size: 0.23, shade: "#5b8fd6", tiltDeg: 23.44 },
  { name: "Mars", au: 1.52, size: 0.18, shade: "#c1623a", tiltDeg: 25.19 },
  { name: "Jupiter", au: 5.2, size: 0.62, shade: "#d8a878", tiltDeg: 3.13 },
  { name: "Saturn", au: 9.54, size: 0.55, shade: "#e0ce9a", tiltDeg: 26.73, rings: true },
  { name: "Uranus", au: 19.2, size: 0.38, shade: "#a5dad0", tiltDeg: 97.77 },
  { name: "Neptune", au: 30.07, size: 0.37, shade: "#4a6db8", tiltDeg: 28.32 },
]

// Compress the 0.39 → 30 AU range into a viewable radial band. Log compression
// keeps the inner rocky planets distinct while still fitting Neptune on screen —
// the same trick the Universe Engine uses so the system reads at a glance.
const R_MIN = 1.7
const R_MAX = 13.5
const auToRadius = (au: number) => {
  const lo = Math.log(0.39)
  const hi = Math.log(30.07)
  const f = (Math.log(au) - lo) / (hi - lo)
  return R_MIN + f * (R_MAX - R_MIN)
}

// relative orbital angular speed ∝ 1/√a (Kepler) — Mercury fast, Neptune slow.
const angularSpeed = (au: number) => 0.16 / Math.sqrt(au)

const DISK_COUNT = 2600

export function SolarSystemFormation({ starTex, tLogRef }: {
  starTex: THREE.Texture
  tLogRef: React.MutableRefObject<number>
}) {
  const root = useRef<THREE.Group>(null)
  const diskPts = useRef<THREE.Points>(null)
  const diskMat = useRef<THREE.PointsMaterial>(null)
  const sun = useRef<THREE.Sprite>(null)
  const sunCore = useRef<THREE.Mesh>(null)
  const planetRefs = useRef<(THREE.Group | null)[]>([])
  const orbitRefs = useRef<(THREE.Line | null)[]>([])

  // protoplanetary disk: a flared annulus of dust. Each particle has an initial
  // (collapse-from) radius and a settled radius; we lerp between them by phase.
  const disk = useMemo(() => {
    const pos = new Float32Array(DISK_COUNT * 3)
    const col = new Float32Array(DISK_COUNT * 3)
    const seed = new Float32Array(DISK_COUNT) // angle
    const rStart = new Float32Array(DISK_COUNT)
    const rSettle = new Float32Array(DISK_COUNT)
    const yJit = new Float32Array(DISK_COUNT)
    const hot = new THREE.Color("#ffd9a0")
    const mid = new THREE.Color("#c98b5a")
    const cold = new THREE.Color("#5b6b9a")
    const tmp = new THREE.Color()
    for (let i = 0; i < DISK_COUNT; i++) {
      const ang = Math.random() * Math.PI * 2
      // settled radius weighted toward the inner disk
      const u = Math.pow(Math.random(), 0.6)
      const rs = R_MIN * 0.6 + u * (R_MAX + 1.2 - R_MIN * 0.6)
      seed[i] = ang
      rSettle[i] = rs
      // collapse from much farther out + a puffier initial cloud
      rStart[i] = rs * (1.7 + Math.random() * 1.6)
      // disk flare: thinner inside, puffier outside
      yJit[i] = (Math.random() - 0.5) * (0.18 + (rs / R_MAX) * 0.9)
      // colour by radius: hot dust inside → icy out
      const f = THREE.MathUtils.clamp((rs - R_MIN) / (R_MAX - R_MIN), 0, 1)
      tmp.copy(hot).lerp(mid, smooth(0, 0.45, f)).lerp(cold, smooth(0.45, 1, f))
      col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3))
    g.setAttribute("color", new THREE.BufferAttribute(col, 3))
    return { g, pos, seed, rStart, rSettle, yJit }
  }, [])

  // static orbit-ring geometries (tilted), one per planet.
  const orbits = useMemo(() => {
    return PLANETS.map((p) => {
      const r = auToRadius(p.au)
      const pts: THREE.Vector3[] = []
      for (let i = 0; i <= 128; i++) {
        const a = (i / 128) * Math.PI * 2
        pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r))
      }
      return new THREE.BufferGeometry().setFromPoints(pts)
    })
  }, [])

  useFrame((st) => {
    const tLog = tLogRef.current
    const phase = formationPhase(tLog)
    const t = st.clock.elapsedTime

    // master visibility: fade the whole rig in as we approach, and make sure the
    // *previous* abstract field has handed off (it dims via its own density).
    const master = smooth(0, 0.12, phase) * (1 - smooth(0.985, 1, Math.max(0, (tLog - FORM_END) / 0.2)))
    if (root.current) {
      root.current.visible = master > 0.002
      // a slow, stately tilt of the whole system for depth
      root.current.rotation.x = -0.42
      root.current.rotation.y = t * 0.02
    }
    if (master <= 0.002) return

    // beat envelopes
    const collapse = smooth(0.0, 0.5, phase) // disk gathers
    const ignite = smooth(0.28, 0.62, phase) // sun lights
    const planetsIn = smooth(0.52, 0.92, phase) // planets condense
    const diskClear = smooth(0.46, 0.8, phase) // disk dissipates after ignition

    // --- protoplanetary disk ---
    if (diskPts.current && diskMat.current) {
      const pos = disk.pos
      const spin = t * 0.22
      for (let i = 0; i < DISK_COUNT; i++) {
        const r = THREE.MathUtils.lerp(disk.rStart[i], disk.rSettle[i], collapse)
        // differential rotation: inner dust orbits faster (Keplerian-ish)
        const a = disk.seed[i] + spin * (2.4 / Math.sqrt(Math.max(0.4, r)))
        pos[i * 3] = Math.cos(a) * r
        pos[i * 3 + 1] = disk.yJit[i] * (1 - collapse * 0.55)
        pos[i * 3 + 2] = Math.sin(a) * r
      }
      disk.g.attributes.position.needsUpdate = true
      // disk reads strongly while it gathers, then fades as planets sweep it up
      // and the ignited Sun blows the inner disk clear.
      diskMat.current.opacity = master * (0.7 * (1 - diskClear) + 0.04)
      diskMat.current.size = THREE.MathUtils.lerp(0.16, 0.07, collapse)
    }

    // --- the Sun ---
    if (sun.current) {
      const m = sun.current.material as THREE.SpriteMaterial
      m.opacity = master * (0.15 + ignite * 0.95)
      const pulse = 1 + Math.sin(t * 1.6) * 0.02
      const s = THREE.MathUtils.lerp(1.4, 4.2, ignite) * pulse
      sun.current.scale.setScalar(s)
    }
    if (sunCore.current) {
      const m = sunCore.current.material as THREE.MeshBasicMaterial
      m.opacity = master
      const s = THREE.MathUtils.lerp(0.18, 0.62, ignite)
      sunCore.current.scale.setScalar(s)
    }

    // --- planets ---
    PLANETS.forEach((p, i) => {
      const g = planetRefs.current[i]
      const o = orbitRefs.current[i]
      if (!g) return
      // each planet condenses a little after the one inside it (inside-out)
      const stagger = i / PLANETS.length
      const appear = smooth(0.5 + stagger * 0.18, 0.72 + stagger * 0.22, phase)
      const r = auToRadius(p.au)
      const theta = i * 1.7 + t * angularSpeed(p.au) * (0.4 + planetsIn * 1.4)
      g.position.set(Math.cos(theta) * r, 0, Math.sin(theta) * r)
      const s = appear * (0.6 + planetsIn * 0.4)
      g.scale.setScalar(Math.max(0.0001, s))
      g.visible = s > 0.01
      // planet day-spin + axial tilt for character
      g.rotation.y = t * 0.4
      g.rotation.z = p.tiltDeg * (Math.PI / 180)
      if (o) {
        const om = (o.material as THREE.LineBasicMaterial)
        om.opacity = master * appear * 0.18
        o.visible = om.opacity > 0.01
      }
    })
  })

  return (
    <group ref={root} visible={false}>
      {/* protoplanetary disk */}
      <points ref={diskPts} geometry={disk.g}>
        <pointsMaterial
          ref={diskMat}
          map={starTex}
          alphaMap={starTex}
          vertexColors
          size={0.12}
          sizeAttenuation
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* the Sun: an emissive core + an additive glow sprite (baked star tex) */}
      <mesh ref={sunCore}>
        <sphereGeometry args={[1, 32, 24]} />
        <meshBasicMaterial color="#fff2cf" transparent opacity={0} toneMapped={false} />
      </mesh>
      <sprite ref={sun}>
        <spriteMaterial
          map={starTex}
          color="#ffd9a0"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </sprite>
      <pointLight position={[0, 0, 0]} intensity={3.2} distance={40} decay={1.6} color="#ffdca6" />
      {/* faint fill so planet night-sides keep their form instead of going black */}
      <ambientLight intensity={0.18} color="#5566aa" />

      {/* orbit rings */}
      {orbits.map((og, i) => (
        <threeLine
          key={`orbit-${i}`}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ref={(el: any) => { orbitRefs.current[i] = el }}
          geometry={og}
        >
          <lineBasicMaterial color={PLANETS[i].shade} transparent opacity={0} depthWrite={false} />
        </threeLine>
      ))}

      {/* planets */}
      {PLANETS.map((p, i) => (
        <group
          key={p.name}
          ref={(el) => { planetRefs.current[i] = el }}
          visible={false}
        >
          <mesh>
            <sphereGeometry args={[p.size, 28, 20]} />
            <meshStandardMaterial
              color={p.shade}
              emissive={new THREE.Color(p.shade)}
              emissiveIntensity={0.28}
              roughness={0.85}
              metalness={0.0}
            />
          </mesh>
          {p.rings && (
            <mesh rotation={[Math.PI / 2.4, 0, 0]}>
              <ringGeometry args={[p.size * 1.4, p.size * 2.2, 48]} />
              <meshBasicMaterial color="#e8dcb4" transparent opacity={0.5} side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  )
}
