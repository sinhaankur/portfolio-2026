"use client"

/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine — see ./index.tsx for the full notice.
 * https://github.com/sinhaankur/portfolio-2026/blob/main/LICENSE
 *
 * Universe Engine — Shooting-stars sub-engine.
 *
 *   - Meteor         one streak: a bright head + a trailing line, on a cyclical
 *                    fly-across-and-cooldown loop with a per-instance delay
 *   - ShootingStars  a small pool of Meteors so a few are always in flight
 *   - MeteorShowerField  during a REAL active shower, meteors that stream from
 *                    the true radiant (see activeShowerRadiantScenePos)
 *
 * Ambient meteors are ephemeral flashes with randomised origins. A shower is
 * different and honest: when Earth is really crossing a debris stream (by
 * sim-date), meteors diverge from the shower's real radiant point on the sky.
 * Consumers (scene.tsx) mount <ShootingStars/> always, and <MeteorShowerField/>
 * when activeShowerAt(simMs) is non-null.
 */

import { useRef, useMemo, useEffect, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { BufferAttribute, BufferGeometry, Group } from "three"

import { SUN_OFFSET_SCENE, activeShowerRadiantScenePos } from "./astronomy"
import type { MeteorShower } from "./types"
// Registers the <threeLine> JSX element used for the meteor streak.
import "./three-line"

/* ============================================================
 * Shooting stars — cyclical meteor streaks across the sky.
 * ============================================================ */

function Meteor({ baseDelay, invert = false }: { baseDelay: number; invert?: boolean }) {
  const groupRef = useRef<Group>(null)
  const stateRef = useRef({
    t: -baseDelay,
    duration: 2.2 + Math.random() * 1.8,
    cooldown: 6 + Math.random() * 14,
    origin: [0, 0, 0] as [number, number, number],
    direction: [0, 0, 0] as [number, number, number],
    length: 0,
  })

  const resetMeteor = () => {
    const r = 50 + Math.random() * 30
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    const ox = r * Math.sin(phi) * Math.cos(theta) + SUN_OFFSET_SCENE
    const oy = r * Math.cos(phi) * 0.5
    const oz = r * Math.sin(phi) * Math.sin(theta)

    const tx = SUN_OFFSET_SCENE + (Math.random() - 0.5) * 30
    const ty = (Math.random() - 0.5) * 10
    const tz = (Math.random() - 0.5) * 30
    const dx = tx - ox
    const dy = ty - oy
    const dz = tz - oz
    const mag = Math.hypot(dx, dy, dz)

    stateRef.current.origin = [ox, oy, oz]
    stateRef.current.direction = [dx / mag, dy / mag, dz / mag]
    stateRef.current.length = 30 + Math.random() * 25
    stateRef.current.duration = 2.2 + Math.random() * 1.8
    stateRef.current.cooldown = 6 + Math.random() * 14
    stateRef.current.t = 0
  }

  useEffect(() => {
    resetMeteor()
    stateRef.current.t = -baseDelay
  }, [baseDelay])

  useFrame((_, delta) => {
    const s = stateRef.current
    s.t += delta

    if (!groupRef.current) return

    if (s.t < 0) {
      groupRef.current.visible = false
      return
    }
    if (s.t > s.duration) {
      groupRef.current.visible = false
      if (s.t > s.duration + s.cooldown) {
        resetMeteor()
      }
      return
    }

    groupRef.current.visible = true
    const progress = s.t / s.duration
    const x = s.origin[0] + s.direction[0] * progress * s.length
    const y = s.origin[1] + s.direction[1] * progress * s.length
    const z = s.origin[2] + s.direction[2] * progress * s.length
    groupRef.current.position.set(x, y, z)
  })

  const streakGeometry = useMemo(() => {
    const arr = new Float32Array(2 * 3)
    arr[0] = 0; arr[1] = 0; arr[2] = 0
    arr[3] = -1.2; arr[4] = 0; arr[5] = 0
    const geo = new BufferGeometry()
    geo.setAttribute("position", new BufferAttribute(arr, 3))
    return geo
  }, [])

  // On cream paper, ink streaks read as inked-meteor lines on a chart.
  const meteorColor = invert ? "#0a0a0a" : "#ffffff"
  const streakOpacity = invert ? 0.6 : 0.4

  return (
    <group ref={groupRef}>
      <mesh>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshBasicMaterial color={meteorColor} />
      </mesh>
      <threeLine geometry={streakGeometry}>
        <lineBasicMaterial color={meteorColor} transparent opacity={streakOpacity} />
      </threeLine>
    </group>
  )
}

export function ShootingStars({ count = 6, invert = false }: { count?: number; invert?: boolean }) {
  return (
    <group>
      {Array.from({ length: count }).map((_, i) => (
        <Meteor key={i} baseDelay={i * 3 + Math.random() * 5} invert={invert} />
      ))}
    </group>
  )
}

/* ============================================================
 * Meteor SHOWER — meteors that diverge from a real radiant.
 * During an active shower the origins cluster near the radiant point on the
 * sky, and each meteor streaks radially outward from it — the way a real
 * shower looks (the "radiant" is a perspective effect of parallel debris).
 * ============================================================ */
function ShowerMeteor({
  radiant,
  baseDelay,
  invert = false,
}: {
  radiant: [number, number, number]
  baseDelay: number
  invert?: boolean
}) {
  const groupRef = useRef<Group>(null)
  const stateRef = useRef({
    t: -baseDelay,
    duration: 1.4 + Math.random() * 1.2, // showers streak a touch faster
    cooldown: 3 + Math.random() * 8,
    origin: [0, 0, 0] as [number, number, number],
    direction: [0, 0, 0] as [number, number, number],
    length: 0,
  })

  const reset = () => {
    // Start a little off the radiant (meteors appear a few degrees from it, not
    // exactly on the point), then travel radially away from the radiant.
    const jitter = () => (Math.random() - 0.5)
    const spread = 26
    const ox = radiant[0] + jitter() * spread
    const oy = radiant[1] + jitter() * spread
    const oz = radiant[2] + jitter() * spread
    // direction = away from the radiant (radial), so all meteors diverge from it
    let dx = ox - radiant[0]
    let dy = oy - radiant[1]
    let dz = oz - radiant[2]
    const mag = Math.hypot(dx, dy, dz) || 1
    dx /= mag
    dy /= mag
    dz /= mag
    stateRef.current.origin = [ox, oy, oz]
    stateRef.current.direction = [dx, dy, dz]
    stateRef.current.length = 22 + Math.random() * 24
    stateRef.current.duration = 1.4 + Math.random() * 1.2
    stateRef.current.cooldown = 3 + Math.random() * 8
    stateRef.current.t = 0
  }

  useEffect(() => {
    reset()
    stateRef.current.t = -baseDelay
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseDelay, radiant[0], radiant[1], radiant[2]])

  useFrame((_, delta) => {
    const s = stateRef.current
    s.t += delta
    if (!groupRef.current) return
    if (s.t < 0) {
      groupRef.current.visible = false
      return
    }
    if (s.t > s.duration) {
      groupRef.current.visible = false
      if (s.t > s.duration + s.cooldown) reset()
      return
    }
    groupRef.current.visible = true
    const p = s.t / s.duration
    groupRef.current.position.set(
      s.origin[0] + s.direction[0] * p * s.length,
      s.origin[1] + s.direction[1] * p * s.length,
      s.origin[2] + s.direction[2] * p * s.length,
    )
  })

  const streakGeometry = useMemo(() => {
    const arr = new Float32Array([0, 0, 0, -1.4, 0, 0])
    const geo = new BufferGeometry()
    geo.setAttribute("position", new BufferAttribute(arr, 3))
    return geo
  }, [])

  const color = invert ? "#0a0a0a" : "#ffffff"
  const streakOpacity = invert ? 0.7 : 0.5
  return (
    <group ref={groupRef}>
      <mesh>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <threeLine geometry={streakGeometry}>
        <lineBasicMaterial color={color} transparent opacity={streakOpacity} />
      </threeLine>
    </group>
  )
}

/** A denser field of meteors diverging from a real radiant during an active
 * shower. `intensity` (0..1, from the shower's ZHR) scales the meteor count. */
export function MeteorShowerField({
  radiant,
  intensity = 0.6,
  invert = false,
  maxCount = 14,
}: {
  radiant: [number, number, number]
  intensity?: number
  invert?: boolean
  maxCount?: number
}) {
  const count = Math.max(4, Math.round(maxCount * Math.min(1, Math.max(0.2, intensity))))
  return (
    <group>
      {Array.from({ length: count }).map((_, i) => (
        <ShowerMeteor
          key={i}
          radiant={radiant}
          baseDelay={i * 0.8 + Math.random() * 3}
          invert={invert}
        />
      ))}
    </group>
  )
}

/** Watches sim-time and, when Earth is really crossing a shower's debris stream
 * (by date), renders a radiant-anchored MeteorShowerField. `onShowerChange` lets
 * the HUD surface the observing guide for whatever is active. Ref-driven so the
 * timeline can scroll years without re-rendering the whole scene each frame. */
export function MeteorShowerLayer({
  simTimeRef,
  invert = false,
  densityScale = 1,
  onShowerChange,
}: {
  simTimeRef: { current: { simMs: number } }
  invert?: boolean
  densityScale?: number
  onShowerChange?: (shower: MeteorShower | null) => void
}) {
  const [active, setActive] = useState<{
    shower: MeteorShower
    radiant: [number, number, number]
  } | null>(null)
  const lastId = useRef<string | null>(null)
  const nextCheck = useRef(0)

  useFrame((_, delta) => {
    // Cheap: only re-evaluate the date every ~1s, not every frame.
    nextCheck.current -= delta
    if (nextCheck.current > 0) return
    nextCheck.current = 1

    const found = activeShowerRadiantScenePos(simTimeRef.current.simMs)
    const id = found ? found.shower.id : null
    if (id === lastId.current) return
    lastId.current = id
    if (found) {
      setActive({
        shower: found.shower,
        radiant: [found.pos.x, found.pos.y, found.pos.z],
      })
      onShowerChange?.(found.shower)
    } else {
      setActive(null)
      onShowerChange?.(null)
    }
  })

  if (!active) return null
  // ZHR → intensity (Geminids/Quadrantids ~120 → full; Lyrids ~18 → sparse)
  const intensity = Math.min(1, active.shower.zhr / 120)
  return (
    <MeteorShowerField
      radiant={active.radiant}
      intensity={intensity}
      invert={invert}
      maxCount={Math.round(16 * densityScale)}
    />
  )
}
