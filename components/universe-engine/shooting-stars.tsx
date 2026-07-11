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
 *
 * Purely atmospheric — meteors are ephemeral flashes, not catalogued bodies,
 * so their origins/directions are randomised each cycle. Consumers (scene.tsx)
 * mount <ShootingStars count invert /> when reduced-motion is off.
 */

import { useRef, useMemo, useEffect } from "react"
import { useFrame } from "@react-three/fiber"
import { BufferAttribute, BufferGeometry, Group } from "three"

import { SUN_OFFSET_SCENE } from "./astronomy"
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
