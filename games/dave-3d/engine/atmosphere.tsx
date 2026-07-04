"use client"

/**
 * Atmosphere — the depth-and-mood layer that turns a flat brick room into a
 * place. All original, procedural, purely decorative (no collision): parallax
 * back-walls, cavern pillars and stalactites set behind the play plane, drifting
 * dust motes, per-theme set-dressing (torch flames, water caustics, gears), and
 * soft foreground occluders. Each level declares a `theme` and this renders it.
 *
 * Everything here sits on Z ranges that never touch the player's Z=0 play slab,
 * so it reads as a 3D world without changing how the platformer plays.
 */

import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

export type Theme = "cavern" | "fire" | "flooded" | "machine" | "ice" | "void"

type Bounds = { w: number; h: number }

/** Deterministic PRNG so a level's decoration is stable frame-to-frame. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const THEME_COLORS: Record<Theme, { back: string; mid: string; accent: string; particle: string }> = {
  cavern:  { back: "#140a1c", mid: "#241634", accent: "#6a4aa0", particle: "#9a7ad0" },
  fire:    { back: "#1c0904", mid: "#3a1206", accent: "#ff6a2a", particle: "#ffb060" },
  flooded: { back: "#04101c", mid: "#08243a", accent: "#2a9fd0", particle: "#8fd6ff" },
  machine: { back: "#0d0f12", mid: "#1a1f26", accent: "#c0a030", particle: "#e0c060" },
  ice:     { back: "#0a1420", mid: "#16303f", accent: "#7fd0ff", particle: "#d0f0ff" },
  void:    { back: "#0a0510", mid: "#160b22", accent: "#a040ff", particle: "#d080ff" },
}

export function Atmosphere({ theme = "cavern", bounds }: { theme?: Theme; bounds: Bounds }) {
  const c = THEME_COLORS[theme]
  const w = bounds.w, h = bounds.h

  return (
    <group>
      <BackWall color={c.back} w={w * 2.4} h={h * 1.8} z={-14} />
      <BackWall color={c.mid} w={w * 1.7} h={h * 1.4} z={-8} opacity={0.9} />
      <Pillars color={c.mid} w={w} h={h} theme={theme} />
      <Stalactites color={c.mid} w={w} h={h} theme={theme} />
      <DustField color={c.particle} w={w} h={h} />
      <ThemeDressing theme={theme} color={c.accent} w={w} h={h} />
      <ForegroundHaze color={c.back} w={w} h={h} />
    </group>
  )
}

function BackWall({ color, w, h, z, opacity = 1 }: { color: string; w: number; h: number; z: number; opacity?: number }) {
  return (
    <mesh position={[0, h * 0.35, z]}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} fog />
    </mesh>
  )
}

/** Vertical structural pillars behind the play plane — reads as cave/hall depth. */
function Pillars({ color, w, h, theme }: { color: string; w: number; h: number; theme: Theme }) {
  const items = useMemo(() => {
    const rng = mulberry32(theme.length * 7 + Math.round(w))
    const n = 5
    return Array.from({ length: n }, (_, i) => {
      const x = (i / (n - 1) - 0.5) * w * 1.3 + (rng() - 0.5) * 3
      const ph = h * (0.7 + rng() * 0.5)
      const pw = 1.2 + rng() * 1.4
      const z = -6 - rng() * 5
      return { x, ph, pw, z }
    })
  }, [color, w, h, theme])
  return (
    <group>
      {items.map((p, i) => (
        <mesh key={i} position={[p.x, p.ph / 2 - h * 0.1, p.z]}>
          <boxGeometry args={[p.pw, p.ph, p.pw]} />
          <meshStandardMaterial color={color} roughness={1} metalness={0} />
        </mesh>
      ))}
    </group>
  )
}

/** Ceiling stalactites (cavern/ice) or hanging fixtures (machine) — top framing. */
function Stalactites({ color, w, h, theme }: { color: string; w: number; h: number; theme: Theme }) {
  const items = useMemo(() => {
    const rng = mulberry32(Math.round(w) + theme.length * 13)
    const n = 10
    return Array.from({ length: n }, () => {
      const x = (rng() - 0.5) * w * 1.2
      const len = 1 + rng() * 3
      const rad = 0.3 + rng() * 0.6
      const z = -4 - rng() * 3
      return { x, len, rad, z }
    })
  }, [color, w, h, theme])
  return (
    <group>
      {items.map((s, i) => (
        <mesh key={i} position={[s.x, h * 0.85 - s.len / 2, s.z]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[s.rad, s.len, 6]} />
          <meshStandardMaterial color={color} roughness={1} />
        </mesh>
      ))}
    </group>
  )
}

/** Drifting dust motes — subtle life in the air. */
function DustField({ color, w, h }: { color: string; w: number; h: number }) {
  const ref = useRef<THREE.Points>(null)
  const { geom, mat } = useMemo(() => {
    const n = 90
    const pos = new Float32Array(n * 3)
    const rng = mulberry32(Math.round(w * 3.1))
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (rng() - 0.5) * w * 1.4
      pos[i * 3 + 1] = rng() * h * 1.1
      pos[i * 3 + 2] = -2 - rng() * 8
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3))
    const m = new THREE.PointsMaterial({
      color, size: 0.08, transparent: true, opacity: 0.5,
      depthWrite: false, blending: THREE.AdditiveBlending,
    })
    return { geom: g, mat: m }
  }, [color, w, h])
  useFrame((_, dt) => {
    if (!ref.current) return
    ref.current.rotation.y += dt * 0.02
    const p = ref.current.geometry.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i) + dt * 0.3
      if (y > h * 1.1) y = 0
      p.setY(i, y)
    }
    p.needsUpdate = true
  })
  return <points ref={ref} geometry={geom} material={mat} />
}

/** Per-theme signature dressing that sells the level's identity. */
function ThemeDressing({ theme, color, w, h }: { theme: Theme; color: string; w: number; h: number }) {
  if (theme === "fire") return <Torches color={color} w={w} h={h} />
  if (theme === "flooded" || theme === "ice") return <Caustics color={color} w={w} h={h} />
  if (theme === "machine") return <Gears color={color} w={w} h={h} />
  if (theme === "void") return <VoidStars color={color} w={w} h={h} />
  return null
}

/** Flickering torch flames mounted on the back wall. */
function Torches({ color, w, h }: { color: string; w: number; h: number }) {
  const lights = useRef<THREE.PointLight[]>([])
  const spots = useMemo(() => {
    const rng = mulberry32(Math.round(w) + 99)
    return Array.from({ length: 4 }, (_, i) => ({
      x: (i / 3 - 0.5) * w * 0.9, y: h * (0.3 + rng() * 0.4), phase: rng() * 10,
    }))
  }, [w, h])
  useFrame((state) => {
    const t = state.clock.elapsedTime
    lights.current.forEach((l, i) => {
      if (l) l.intensity = 1.4 + Math.sin(t * 12 + spots[i].phase) * 0.5 + Math.sin(t * 27) * 0.2
    })
  })
  return (
    <group>
      {spots.map((s, i) => (
        <group key={i} position={[s.x, s.y, -3]}>
          <mesh>
            <coneGeometry args={[0.3, 0.9, 8]} />
            <meshBasicMaterial color={color} transparent opacity={0.85} />
          </mesh>
          <pointLight ref={(el) => { if (el) lights.current[i] = el }} color={color} distance={8} intensity={1.6} />
        </group>
      ))}
    </group>
  )
}

/** Slow shifting light bands — water/ice caustics on the back wall. */
function Caustics({ color, w, h }: { color: string; w: number; h: number }) {
  const ref = useRef<THREE.Mesh>(null)
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false }),
    [color]
  )
  useFrame((state) => {
    if (ref.current) {
      ref.current.position.x = Math.sin(state.clock.elapsedTime * 0.3) * w * 0.15
      const m = ref.current.material as THREE.MeshBasicMaterial
      m.opacity = 0.1 + Math.abs(Math.sin(state.clock.elapsedTime * 0.5)) * 0.12
    }
  })
  return (
    <mesh ref={ref} position={[0, h * 0.4, -7]} material={mat}>
      <planeGeometry args={[w * 1.5, h]} />
    </mesh>
  )
}

/** Slowly turning gears — the machine theme. */
function Gears({ color, w, h }: { color: string; w: number; h: number }) {
  const refs = useRef<THREE.Group[]>([])
  const gears = useMemo(() => {
    const rng = mulberry32(Math.round(w) + 41)
    return Array.from({ length: 4 }, () => ({
      x: (rng() - 0.5) * w * 1.1, y: rng() * h, z: -5 - rng() * 4,
      r: 1 + rng() * 2.2, spd: (rng() - 0.5) * 0.6, teeth: 8 + Math.floor(rng() * 6),
    }))
  }, [w, h])
  useFrame((_, dt) => refs.current.forEach((g, i) => { if (g) g.rotation.z += dt * gears[i].spd }))
  return (
    <group>
      {gears.map((g, i) => (
        <group key={i} ref={(el) => { if (el) refs.current[i] = el }} position={[g.x, g.y, g.z]}>
          <mesh>
            <torusGeometry args={[g.r, g.r * 0.28, 6, g.teeth * 2]} />
            <meshStandardMaterial color={color} metalness={0.7} roughness={0.4} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** Twinkling far stars — the void theme. */
function VoidStars({ color, w, h }: { color: string; w: number; h: number }) {
  const { geom, mat } = useMemo(() => {
    const n = 120
    const pos = new Float32Array(n * 3)
    const rng = mulberry32(Math.round(w) + 7)
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (rng() - 0.5) * w * 2
      pos[i * 3 + 1] = rng() * h * 1.6
      pos[i * 3 + 2] = -12 - rng() * 6
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3))
    return { geom: g, mat: new THREE.PointsMaterial({ color, size: 0.12, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }) }
  }, [color, w, h])
  const ref = useRef<THREE.Points>(null)
  useFrame((s) => { if (ref.current) (ref.current.material as THREE.PointsMaterial).opacity = 0.5 + Math.abs(Math.sin(s.clock.elapsedTime)) * 0.4 })
  return <points ref={ref} geometry={geom} material={mat} />
}

/** A faint tinted plane just in front of the play slab — atmospheric depth cue. */
function ForegroundHaze({ color, w, h }: { color: string; w: number; h: number }) {
  return (
    <mesh position={[0, h * 0.4, 3.5]}>
      <planeGeometry args={[w * 2, h * 1.6]} />
      <meshBasicMaterial color={color} transparent opacity={0.06} depthWrite={false} />
    </mesh>
  )
}
