"use client"

/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine — see ./index.tsx for the full notice.
 * https://github.com/sinhaankur/portfolio-2026/blob/main/LICENSE
 *
 * Universe Engine — Belt sub-engine (asteroid + Kuiper).
 *
 *   - Belt           a rotating point-field annulus with a hover hit-torus
 *                    (the uncountable small-body population as texture)
 *   - BeltAsteroids  a few dozen representative Blender rock/nucleus GLBs
 *                    scattered by a seeded PRNG across the real belt annulus,
 *                    each tumbling on its own axis. NOT catalogued positions —
 *                    the named big-4 (Ceres/Vesta/Pallas/Hygiea) are the real,
 *                    clickable bodies (see astronomy.ts + small-bodies.tsx).
 *
 * Consumers (scene.tsx → SolarSystem) mount both for the asteroid belt
 * (2.2–3.2 AU) and Kuiper belt (30–50 AU). The GLBs stream in on mount only
 * once the user enters explore mode, so the passive hero never pays for them.
 */

import { useRef, useMemo } from "react"
import { useFrame } from "@react-three/fiber"
import { Clone, useGLTF } from "@react-three/drei"
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, NormalBlending, Object3D, Points, ShaderMaterial } from "three"

import { _tmpAxis } from "./scene-shared"
import type { HoverHandler } from "./types"

// Round, feathered belt dust — the default pointsMaterial draws HARD SQUARES
// (the "square/blob" specks). This shader discards to a soft circle so the belt
// reads as clean dust, not a scatter of squares.
const BELT_VERT = /* glsl */ `
  uniform float uSize;
  uniform float uPixelRatio;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(uSize * uPixelRatio * (1.0 / -mv.z), 0.6 * uPixelRatio, 3.0 * uPixelRatio);
  }
`
const BELT_FRAG = /* glsl */ `
  precision mediump float;
  uniform vec3 uColor;
  uniform float uOpacity;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;                       // round, never square
    float a = (1.0 - smoothstep(0.15, 0.5, d)) * uOpacity; // soft feathered edge
    gl_FragColor = vec4(uColor, a);
  }
`

/* ============================================================
 * Belts (asteroid + Kuiper)
 * ============================================================ */

export function Belt({
  innerRadius,
  outerRadius,
  count,
  thickness,
  rotationSpeed,
  pointSize,
  opacity,
  info,
  onHover,
  invert = false,
}: {
  innerRadius: number
  outerRadius: number
  count: number
  thickness: number
  rotationSpeed: number
  pointSize: number
  opacity: number
  info: import("./types").BodyInfo
  onHover: HoverHandler
  invert?: boolean
}) {
  const ref = useRef<Points>(null)

  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      // sqrt radial sampling → uniform AREAL density (pure random clumps at the
      // inner edge). A subtle gaussian-ish vertical falloff so the belt has a soft
      // dense mid-plane fading to thin edges, not a hard-sided slab.
      const t = Math.random()
      const r = Math.sqrt(innerRadius * innerRadius + t * (outerRadius * outerRadius - innerRadius * innerRadius))
      const angle = Math.random() * Math.PI * 2
      const y = ((Math.random() + Math.random() + Math.random()) / 3 - 0.5) * thickness
      positions[i * 3] = Math.cos(angle) * r
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = Math.sin(angle) * r
    }
    const geo = new BufferGeometry()
    geo.setAttribute("position", new BufferAttribute(positions, 3))
    return geo
  }, [innerRadius, outerRadius, count, thickness])

  // Round, feathered dust material (replaces the square pointsMaterial).
  const material = useMemo(() => new ShaderMaterial({
    vertexShader: BELT_VERT,
    fragmentShader: BELT_FRAG,
    uniforms: {
      uSize: { value: Math.max(60, pointSize * 900) },
      uPixelRatio: { value: typeof window !== "undefined" ? Math.min(window.devicePixelRatio, 2) : 1 },
      uColor: { value: new Color(invert ? "#3a2c14" : "#cfcabf") },
      uOpacity: { value: opacity },
    },
    transparent: true,
    depthWrite: false,
    blending: invert ? NormalBlending : AdditiveBlending,
  }), [pointSize, opacity, invert])

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * rotationSpeed
  })

  const midRadius = (innerRadius + outerRadius) / 2
  const halfWidth = (outerRadius - innerRadius) / 2

  return (
    <group>
      <points ref={ref} geometry={geometry} material={material} />
      <mesh
        rotation={[Math.PI / 2, 0, 0]}
        onPointerOver={(e) => {
          e.stopPropagation()
          onHover(info)
        }}
        onPointerOut={() => {
          onHover(null)
        }}
      >
        <torusGeometry args={[midRadius, halfWidth, 8, 96]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

/* ============================================================
 * Belt asteroids — REPRESENTATIVE rocky meshes scattered along the belt ring.
 *
 * TRUTH NOTE: these are NOT specific catalogued asteroids at real positions —
 * the belt holds ~1.9 million objects >1 km, which can't be individually placed.
 * These few dozen Blender rock/nucleus meshes stand in for that uncountable
 * small-body population, scattered by a seeded PRNG across the real belt annulus
 * (2.2–3.2 AU). The NAMED big-4 — Ceres, Vesta, Pallas, Hygiea — ARE real bodies
 * at their true orbital positions (see astronomy.ts); those are the ones you can
 * click + inspect. The scatter is texture; the named bodies are truth.
 *
 * The 3 GLBs load once and are cloned cheaply. Rides the slow belt rotation;
 * skipped in chart mode (keeps the ink map clean).
 * ============================================================ */
const BELT_ROCK_MODELS = [
  "/models/asteroid-stony.glb",
  "/models/asteroid-carbon.glb",
  "/models/comet-nucleus.glb",
] as const
// No module-init preload: the rocks (2.7 MB across 3 GLBs) mount only once the
// user enters explore mode (see SolarSystem), so the passive hero never pays
// for them. The component's own useGLTF suspends + streams them in on mount.

export function BeltAsteroids({
  innerRadius,
  outerRadius,
  count,
  thickness,
  rotationSpeed,
  baseScale,
  seed = 1,
}: {
  innerRadius: number
  outerRadius: number
  count: number
  thickness: number
  rotationSpeed: number
  baseScale: number
  seed?: number
}) {
  const ref = useRef<import("three").Group>(null)
  // drei's useGLTF accepts an array natively — one hook call, stable order.
  const gltfs = useGLTF([...BELT_ROCK_MODELS])

  // Deterministic scatter so the belt is stable across re-renders.
  const placements = useMemo(() => {
    let s = seed
    const rand = () => {
      s = (1664525 * s + 1013904223) >>> 0
      return s / 4294967296
    }
    const out: {
      model: number
      pos: [number, number, number]
      rot: [number, number, number]
      scale: number
      spinAxis: [number, number, number]
      spinRate: number
    }[] = []
    for (let i = 0; i < count; i++) {
      const r = innerRadius + rand() * (outerRadius - innerRadius)
      const a = rand() * Math.PI * 2
      // Per-rock tumble: a random spin axis + rate, so each asteroid rotates on
      // its OWN axis (real asteroids tumble independently) rather than all
      // riding one rigid ring. Small rates — a slow, varied churn, not a blur.
      const ax = rand() * 2 - 1, ay = rand() * 2 - 1, az = rand() * 2 - 1
      const len = Math.hypot(ax, ay, az) || 1
      out.push({
        model: Math.floor(rand() * BELT_ROCK_MODELS.length),
        pos: [Math.cos(a) * r, (rand() - 0.5) * thickness, Math.sin(a) * r],
        rot: [rand() * Math.PI * 2, rand() * Math.PI * 2, rand() * Math.PI * 2],
        scale: baseScale * (0.4 + rand() * 1.3),
        spinAxis: [ax / len, ay / len, az / len],
        spinRate: 0.08 + rand() * 0.35,
      })
    }
    return out
  }, [innerRadius, outerRadius, count, thickness, baseScale, seed])

  // Per-rock refs so each can tumble on its own axis in the frame loop.
  const rockRefs = useRef<(Object3D | null)[]>([])

  useFrame((_, delta) => {
    // The belt as a whole rides the slow orbital rotation…
    if (ref.current) ref.current.rotation.y += delta * rotationSpeed
    // …and each rock also tumbles independently, so it reads as thousands of
    // spinning bodies, not a rigid disc.
    for (let i = 0; i < rockRefs.current.length; i++) {
      const o = rockRefs.current[i]
      if (!o) continue
      const p = placements[i]
      o.rotateOnAxis(_tmpAxis.set(p.spinAxis[0], p.spinAxis[1], p.spinAxis[2]), delta * p.spinRate)
    }
  })

  return (
    <group ref={ref}>
      {placements.map((p, i) => (
        <Clone
          key={i}
          ref={(o: Object3D | null) => { rockRefs.current[i] = o }}
          object={gltfs[p.model].scene}
          position={p.pos}
          rotation={p.rot}
          scale={p.scale}
        />
      ))}
    </group>
  )
}
