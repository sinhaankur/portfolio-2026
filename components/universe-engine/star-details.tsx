"use client"

/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine — see ./index.tsx for the full notice.
 * https://github.com/sinhaankur/portfolio-2026/blob/main/LICENSE
 *
 * Universe Engine — Star-details sub-engine.
 *
 * Focus-time detail for two kinds of star sky-points:
 *   - ExoplanetSystem  a host star + its worlds as compressed concentric
 *                      orbits, with the liquid-water habitable-zone annulus
 *                      drawn explicitly (TRAPPIST-1, etc.)
 *   - PulsarDetail     a spinning neutron star with bipolar lighthouse beams
 *                      pulsing at the real rotation frequency
 *
 * Consumers (scene.tsx) mount these under a star sky-point when focused.
 * The pulsar's dynamic profile (pulseHz / beam dims) is computed by the
 * caller and passed in as props, so this file stays data-free.
 */

import { useRef } from "react"
import { useFrame } from "@react-three/fiber"
import {
  AdditiveBlending,
  DoubleSide,
  Group,
  NormalBlending,
} from "three"

import { timeWarpRef } from "./astronomy"
import type { SkyPoint } from "./types"

/**
 * Exoplanet system — child worlds rendered orbiting an exoplanet-host
 * star when focused. Visualisation is scene-compressed: real systems
 * like TRAPPIST-1 cluster within 0.062 AU of the star (closer than
 * Mercury to our Sun), so faithful absolute scaling would be invisible.
 * Compress aAU to scene-units via a log curve so all planets read as
 * distinct concentric rings; periods drive animated motion.
 */
export function ExoplanetSystem({
  planets,
  invert,
}: {
  planets: NonNullable<SkyPoint["planets"]>
  invert: boolean
}) {
  const groupRefs = useRef<Array<Group | null>>([])
  useFrame((_, delta) => {
    const tw = timeWarpRef.current
    planets.forEach((p, i) => {
      const g = groupRefs.current[i]
      if (!g) return
      // Period in seconds at default warp — compressed so even fast
      // inner-system orbits are watchable rather than blink-fast.
      const periodSec = Math.max(1.2, p.periodDays * 0.6)
      const speed = (2 * Math.PI) / periodSec
      g.rotation.y += delta * speed * tw
    })
  })
  // Habitable-zone band: the scene-radii spanning the HZ planets, so the famous
  // "planets in the liquid-water zone" is shown as a green annulus, not implied.
  const hzRadii = planets
    .filter((p) => p.habitableZone)
    .map((p) => 1.0 + Math.log10(1 + p.aAU * 200) * 0.9)
  const hzInner = hzRadii.length ? Math.min(...hzRadii) - 0.18 : 0
  const hzOuter = hzRadii.length ? Math.max(...hzRadii) + 0.18 : 0

  return (
    <group>
      {/* The host star itself — a small warm glow at the centre (ultra-cool red
          dwarf for TRAPPIST-1). Anchors the system so it reads as "a star + its
          worlds," not floating rings. */}
      <mesh>
        <sphereGeometry args={[0.34, 20, 20]} />
        <meshBasicMaterial color={invert ? "#8a3a1a" : "#ff8a4a"} toneMapped={false} />
      </mesh>
      {!invert && (
        <mesh>
          <sphereGeometry args={[0.62, 20, 20]} />
          <meshBasicMaterial color="#ff7a3a" transparent opacity={0.22} blending={AdditiveBlending} depthWrite={false} />
        </mesh>
      )}
      {/* Habitable-zone annulus — the liquid-water band. */}
      {hzRadii.length > 0 && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[hzInner, hzOuter, 80]} />
          <meshBasicMaterial color={invert ? "#1f6f3f" : "#7dffaf"} transparent opacity={invert ? 0.12 : 0.07} side={DoubleSide} depthWrite={false} blending={invert ? NormalBlending : AdditiveBlending} />
        </mesh>
      )}
      {planets.map((p, i) => {
        // Compressed radius: each planet sits at a distinct scene-distance
        // from the host. log-scaled so TRAPPIST-1's 7 planets between 0.01
        // and 0.06 AU all separate visibly.
        const orbitRadius = 1.0 + Math.log10(1 + p.aAU * 200) * 0.9
        const planetVisualRadius = Math.max(0.045, p.radiusEarth * 0.06)
        const dotColor = p.habitableZone
          ? (invert ? "#1f6f3f" : "#7dffaf")
          : (invert ? "#7a5028" : "#f0c890")
        return (
          <group key={p.name}>
            {/* Faint orbit ring */}
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <ringGeometry args={[orbitRadius - 0.003, orbitRadius + 0.003, 64]} />
              <meshBasicMaterial color={invert ? "#1a1208" : "#ffffff"} transparent opacity={0.20} side={DoubleSide} depthWrite={false} />
            </mesh>
            <group ref={(g) => { groupRefs.current[i] = g }} rotation={[0, (i / planets.length) * Math.PI * 2, 0]}>
              <mesh position={[orbitRadius, 0, 0]}>
                <sphereGeometry args={[planetVisualRadius, 14, 14]} />
                <meshBasicMaterial color={dotColor} />
              </mesh>
              {p.habitableZone && (
                <mesh position={[orbitRadius, 0, 0]}>
                  <sphereGeometry args={[planetVisualRadius * 1.8, 14, 14]} />
                  <meshBasicMaterial color={dotColor} transparent opacity={0.18} blending={invert ? NormalBlending : AdditiveBlending} depthWrite={false} />
                </mesh>
              )}
            </group>
          </group>
        )
      })}
    </group>
  )
}

export function PulsarDetail({
  size,
  hovered,
  invert,
  pulseHz,
  beamLengthMul,
  beamWidthMul,
  beamColor,
}: {
  size: number
  hovered: boolean
  invert: boolean
  pulseHz: number
  beamLengthMul: number
  beamWidthMul: number
  beamColor: string
}) {
  const spinRef = useRef<Group>(null)
  const pulseRef = useRef(0)
  const beamNearRef = useRef<import("three").MeshBasicMaterial>(null)
  const beamFarRef = useRef<import("three").MeshBasicMaterial>(null)
  const ringRef = useRef<import("three").MeshBasicMaterial>(null)

  useFrame((_, delta) => {
    pulseRef.current += delta
    const phase = pulseRef.current * pulseHz * Math.PI * 2
    const pulse = Math.max(0, Math.sin(phase))
    if (spinRef.current) {
      spinRef.current.rotation.y += delta * 3.2
      spinRef.current.rotation.z = Math.sin(pulseRef.current * 0.8) * 0.1
    }
    if (beamNearRef.current) {
      const target = (hovered ? 0.48 : 0.32) * (0.35 + pulse * 0.95)
      beamNearRef.current.opacity += (target - beamNearRef.current.opacity) * (1 - Math.exp(-delta * 10))
    }
    if (beamFarRef.current) {
      const target = (hovered ? 0.32 : 0.2) * (0.2 + pulse * 0.7)
      beamFarRef.current.opacity += (target - beamFarRef.current.opacity) * (1 - Math.exp(-delta * 10))
    }
    if (ringRef.current) {
      const target = (hovered ? 0.3 : 0.18) * (0.6 + pulse * 0.35)
      ringRef.current.opacity += (target - ringRef.current.opacity) * (1 - Math.exp(-delta * 8))
    }
  })

  const beamLength = size * beamLengthMul
  const beamRadius = Math.max(size * 0.16 * beamWidthMul, 0.03)

  return (
    <group ref={spinRef} rotation={[0.62, 0, 0.44]}>
      <mesh position={[0, beamLength * 0.5, 0]}>
        <coneGeometry args={[beamRadius, beamLength, 20, 1, true]} />
        <meshBasicMaterial
          ref={beamNearRef}
          color={beamColor}
          transparent
          opacity={0.01}
          side={DoubleSide}
          blending={invert ? NormalBlending : AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, -beamLength * 0.5, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[beamRadius, beamLength, 20, 1, true]} />
        <meshBasicMaterial
          ref={beamFarRef}
          color={beamColor}
          transparent
          opacity={0.01}
          side={DoubleSide}
          blending={invert ? NormalBlending : AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[Math.max(size * 0.72, 0.22), Math.max(size * 0.06, 0.018), 10, 42]} />
        <meshBasicMaterial
          ref={ringRef}
          color={beamColor}
          transparent
          opacity={0.01}
          blending={invert ? NormalBlending : AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}
