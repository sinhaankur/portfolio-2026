"use client"

/**
 * Juice — the little "game feel" touches for Dave 3D: dust puffs on landing and
 * sparkle bursts on gem pickup (pooled point particles), plus tiny WebAudio SFX
 * (jump whoosh, land thud, coin pop). All event-driven off the one-shot stamps
 * in `game.fx`, so each effect fires exactly once.
 *
 * Particles are a single pooled THREE.Points (no per-particle React). Audio is
 * generated procedurally (no asset files), gated behind the first user gesture
 * so it never auto-plays before interaction.
 */

import { useEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"
import { game } from "./state"

const POOL = 80

type P = { life: number; max: number; vx: number; vy: number; vz: number; size: number }

export function Juice() {
  const ptsRef = useRef<THREE.Points>(null)
  const parts = useRef<P[]>(Array.from({ length: POOL }, () => ({ life: 0, max: 0, vx: 0, vy: 0, vz: 0, size: 0 })))
  const lastLand = useRef(-1)
  const lastCollect = useRef(-1)
  const lastJump = useRef(-1)
  const lastDeath = useRef(-1)

  const { geo, positions, colors } = useMemo(() => {
    const positions = new Float32Array(POOL * 3)
    const colors = new Float32Array(POOL * 3)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3))
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3))
    return { geo, positions, colors }
  }, [])

  // spawn `n` particles from a point with a colour + spread/velocity profile
  const spawn = (
    x: number, y: number, z: number, n: number,
    color: THREE.Color, spread: number, up: number, life: number,
  ) => {
    let made = 0
    for (let i = 0; i < POOL && made < n; i++) {
      const p = parts.current[i]
      if (p.life > 0) continue
      const a = Math.random() * Math.PI * 2
      const r = Math.random() * spread
      p.vx = Math.cos(a) * r
      p.vz = Math.sin(a) * r
      p.vy = up * (0.4 + Math.random() * 0.8)
      p.life = p.max = life * (0.7 + Math.random() * 0.6)
      p.size = 0.6 + Math.random() * 0.8
      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z
      colors[i * 3] = color.r; colors[i * 3 + 1] = color.g; colors[i * 3 + 2] = color.b
      made++
    }
  }

  const dust = useMemo(() => new THREE.Color("#cdbfa6"), [])
  const spark = useMemo(() => new THREE.Color("#5cf0e0"), [])
  const death = useMemo(() => new THREE.Color("#ff5a4a"), [])

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 1 / 30)

    // --- consume one-shot events ---
    if (game.fx.landAt > lastLand.current) {
      lastLand.current = game.fx.landAt
      const { x, y, z } = game.fx.landPos
      const pw = game.fx.landPower
      spawn(x, y + 0.05, z, 8 + Math.round(pw * 12), dust, 2.2 + pw * 2, 1.2, 0.5)
      sfx.land(pw)
    }
    if (game.fx.collectAt > lastCollect.current) {
      lastCollect.current = game.fx.collectAt
      const { x, y, z } = game.fx.collectPos
      spawn(x, y, z, 16, spark, 3.0, 2.4, 0.6)
      sfx.coin()
    }
    if (game.fx.jumpAt > lastJump.current) {
      lastJump.current = game.fx.jumpAt
      sfx.jump()
    }
    if (game.fx.deathAt > lastDeath.current) {
      lastDeath.current = game.fx.deathAt
      const { x, y, z } = game.fx.deathPos
      spawn(x, y, z, 22, death, 3.4, 2.0, 0.6)
      sfx.death()
    }

    // --- integrate live particles ---
    const pts = ptsRef.current
    if (!pts) return
    let alive = 0
    for (let i = 0; i < POOL; i++) {
      const p = parts.current[i]
      if (p.life <= 0) continue
      p.life -= dt
      p.vy -= 9 * dt // gravity
      positions[i * 3] += p.vx * dt
      positions[i * 3 + 1] += p.vy * dt
      positions[i * 3 + 2] += p.vz * dt
      if (p.life <= 0) {
        // park dead particles far below; alpha via size handled by fade in shader-free way
        positions[i * 3 + 1] = -9999
      } else {
        alive++
      }
    }
    geo.attributes.position.needsUpdate = true
    geo.attributes.color.needsUpdate = true
    pts.visible = alive > 0
  })

  return (
    <points ref={ptsRef} geometry={geo}>
      <pointsMaterial
        size={0.22}
        sizeAttenuation
        vertexColors
        transparent
        opacity={0.9}
        depthWrite={false}
      />
    </points>
  )
}

/* --------------------------------------------------------------------------
 * sfx — tiny procedural WebAudio. Lazily created on first use (after a user
 * gesture, since these only fire from jump/land/collect during play), so it
 * never auto-plays.
 * ----------------------------------------------------------------------------*/
const sfx = {
  ctx: null as AudioContext | null,
  ensure(): AudioContext | null {
    if (typeof window === "undefined") return null
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      this.ctx = new AC()
    }
    if (this.ctx.state === "suspended") void this.ctx.resume()
    return this.ctx
  },
  jump() {
    const c = this.ensure(); if (!c) return
    const t = c.currentTime
    const o = c.createOscillator(); const g = c.createGain()
    o.type = "sine"
    o.frequency.setValueAtTime(260, t)
    o.frequency.exponentialRampToValueAtTime(620, t + 0.12)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 0.18)
  },
  land(power: number) {
    const c = this.ensure(); if (!c) return
    const t = c.currentTime
    // low thud
    const o = c.createOscillator(); const g = c.createGain()
    o.type = "sine"
    o.frequency.setValueAtTime(150, t)
    o.frequency.exponentialRampToValueAtTime(55, t + 0.14)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.06 + power * 0.12, t + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2)
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 0.22)
  },
  death() {
    const c = this.ensure(); if (!c) return
    const t = c.currentTime
    // a quick descending "hurt" blip
    const o = c.createOscillator(); const g = c.createGain()
    o.type = "sawtooth"
    o.frequency.setValueAtTime(420, t)
    o.frequency.exponentialRampToValueAtTime(90, t + 0.22)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26)
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 0.28)
  },
  coin() {
    const c = this.ensure(); if (!c) return
    const t = c.currentTime
    // bright two-note pop
    ;[880, 1320].forEach((f, i) => {
      const o = c.createOscillator(); const g = c.createGain()
      o.type = "triangle"
      o.frequency.setValueAtTime(f, t + i * 0.06)
      g.gain.setValueAtTime(0.0001, t + i * 0.06)
      g.gain.exponentialRampToValueAtTime(0.09, t + i * 0.06 + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.06 + 0.12)
      o.connect(g); g.connect(c.destination); o.start(t + i * 0.06); o.stop(t + i * 0.06 + 0.14)
    })
  },
}

// Keep the audio context paused-friendly on unmount.
export function useJuiceAudioReset() {
  useEffect(() => () => { void sfx.ctx?.close?.(); sfx.ctx = null }, [])
}
