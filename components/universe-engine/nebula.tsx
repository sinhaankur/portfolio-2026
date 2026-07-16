"use client"

/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine — see ./index.tsx for the full notice.
 * https://github.com/sinhaankur/portfolio-2026/blob/main/LICENSE
 *
 * Universe Engine — Nebula sub-engine.
 *
 * Everything that renders interstellar gas lives here:
 *   - NebulaClouds     background haze + dark dust lanes threading the arms
 *   - NebulaDetail     per-nebula hover reveal (Orion clouds, Ring shell, Crab)
 *   - VolumetricNebula true raymarched 3D gas volume on close approach
 *
 * Consumers (scene.tsx) mount these against the shared NEBULA_SPRITES /
 * VOLUMETRIC_NEBULAE data tables. Adding a new volumetric nebula is a one-row
 * edit to VOLUMETRIC_NEBULAE.
 */

import { useRef, useMemo, useEffect, useState } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  NormalBlending,
  Points,
  ShaderMaterial,
  SRGBColorSpace,
  TextureLoader,
  type Texture,
} from "three"

import { GALAXY_RADIUS_SCENE, timeWarpRef } from "./astronomy"
import { NEBULA_VERTEX_SHADER, NEBULA_FRAGMENT_SHADER } from "./shaders"

/* ============================================================
 * NebulaClouds — background gas haze + dark dust lanes.
 *
 * Both anchor on the same spiral-arm math the stars use, so the
 * haze glows where stars form and the dust threads the dark side
 * of each arm. Parallaxes against the star field for real depth.
 * ============================================================ */
export function NebulaClouds({ mobile = false }: { mobile?: boolean }) {
  const pointsRef = useRef<Points>(null)
  const matRef = useRef<ShaderMaterial>(null)
  const dustRef = useRef<Points>(null)
  const { gl } = useThree()

  // Blender-baked nebula sprite (wispy filaments + soft radial fade) — richer
  // than the procedural radial falloff. Loaded async; the shader falls back to
  // the procedural blob until it lands (uHasTex flag).
  const [nebulaTex, setNebulaTex] = useState<Texture | null>(null)
  useEffect(() => {
    let alive = true
    new TextureLoader().load("/textures/nebula-sprite.webp", (t) => {
      t.colorSpace = SRGBColorSpace
      if (alive) setNebulaTex(t)
    })
    return () => { alive = false }
  }, [])

  const geometry = useMemo(() => {
    const radius = GALAXY_RADIUS_SCENE
    const branches = 4
    const spin = 7
    const count = mobile ? 22 : 44
    const positions = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const alphas = new Float32Array(count)
    const colors = new Float32Array(count * 3)

    const gauss = () =>
      (Math.random() + Math.random() + Math.random() + Math.random() - 2) / 2

    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      // Anchor each cloud on a spiral-arm position (same math as the stars).
      const r = (0.16 + Math.random() * 0.78) * radius
      const branch = Math.floor(Math.random() * branches)
      const branchAngle = (branch / branches) * Math.PI * 2
      const spinAngle = r * spin * 0.04
      positions[i3]     = Math.cos(branchAngle + spinAngle) * r + gauss() * 3.0
      positions[i3 + 1] = gauss() * 1.2
      positions[i3 + 2] = Math.sin(branchAngle + spinAngle) * r + gauss() * 3.0

      const normR = r / radius
      sizes[i]  = 26 + Math.random() * 46
      alphas[i] = 0.05 + Math.random() * 0.07 // deliberately faint — it's haze

      // Palette: Hα-pink/magenta in star-forming mid-arms, dusty blue in the
      // outskirts, warm amber dust nearer the core.
      const roll = Math.random()
      if (normR < 0.4 && roll < 0.7) {
        // Warm amber dust near the core
        colors[i3] = 0.95; colors[i3 + 1] = 0.62; colors[i3 + 2] = 0.34
      } else if (roll < 0.55) {
        // Hα pink/magenta star-forming clouds
        colors[i3] = 0.95; colors[i3 + 1] = 0.36; colors[i3 + 2] = 0.62
      } else {
        // Cool dusty blue
        colors[i3] = 0.40; colors[i3 + 1] = 0.55; colors[i3 + 2] = 0.95
      }
    }

    const geo = new BufferGeometry()
    geo.setAttribute("position", new BufferAttribute(positions, 3))
    geo.setAttribute("aSize", new BufferAttribute(sizes, 1))
    geo.setAttribute("aAlpha", new BufferAttribute(alphas, 1))
    geo.setAttribute("aColor", new BufferAttribute(colors, 3))
    return geo
  }, [mobile])

  // Dark dust lanes — light-absorbing interstellar dust threading the spiral
  // arms, tightly hugging the galactic plane (the dark veins in real Milky Way
  // photos). Same soft-billboard shader, but dark + normal-blended so it dims
  // the star field behind it rather than glowing.
  const dustGeometry = useMemo(() => {
    const radius = GALAXY_RADIUS_SCENE
    const branches = 4
    const spin = 7
    // Denser dust → the lanes read as continuous dark veins threading the arms,
    // and parallax against the stars as the camera moves (the 3D depth cue).
    const count = mobile ? 130 : 320
    const positions = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const alphas = new Float32Array(count)
    const colors = new Float32Array(count * 3)
    let s = 9001
    const rand = () => { s = (1664525 * s + 1013904223) >>> 0; return s / 4294967296 }
    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      const r = (0.20 + rand() * 0.76) * radius
      const branch = Math.floor(rand() * branches)
      const branchAngle = (branch / branches) * Math.PI * 2
      const spinAngle = r * spin * 0.04
      // Follow the SAME arm spurs/feathering the stars use, so dust sits IN the
      // lanes (the dark side of each arm), offset just inward of the star ridge.
      const spur = Math.sin(r * 0.9 + branchAngle * 3.0) * 0.10 + Math.sin(r * 2.7) * 0.04
      const a = branchAngle + spinAngle + spur - 0.06 // trail just inside the arm
      const jitter = (rand() - 0.5) * 6.0
      positions[i3] = Math.cos(a) * r + jitter
      // Thin in Y but with a little depth so layers parallax (not a flat sheet).
      positions[i3 + 1] = (rand() - 0.5) * 1.4
      positions[i3 + 2] = Math.sin(a) * r + (rand() - 0.5) * 6.0
      sizes[i] = 14 + rand() * 38
      alphas[i] = 0.05 + rand() * 0.08
      // Cold dark brown-grey dust.
      colors[i3] = 0.06; colors[i3 + 1] = 0.05; colors[i3 + 2] = 0.05
    }
    const geo = new BufferGeometry()
    geo.setAttribute("position", new BufferAttribute(positions, 3))
    geo.setAttribute("aSize", new BufferAttribute(sizes, 1))
    geo.setAttribute("aAlpha", new BufferAttribute(alphas, 1))
    geo.setAttribute("aColor", new BufferAttribute(colors, 3))
    return geo
  }, [mobile])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(gl.getPixelRatio(), 2) },
      uTex: { value: null as Texture | null },
      uHasTex: { value: 0 },
    }),
    [gl],
  )
  const dustUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(gl.getPixelRatio(), 2) },
      uTex: { value: null as Texture | null },
      uHasTex: { value: 0 },
    }),
    [gl],
  )
  // Feed the baked sprite into both materials once it loads.
  useEffect(() => {
    if (!nebulaTex) return
    uniforms.uTex.value = nebulaTex; uniforms.uHasTex.value = 1
    dustUniforms.uTex.value = nebulaTex; dustUniforms.uHasTex.value = 1
  }, [nebulaTex, uniforms, dustUniforms])

  useFrame((_, delta) => {
    // Drift with the disc (slow), and breathe via uTime.
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * 0.0004 * (1 + timeWarpRef.current * 0.05)
    }
    if (matRef.current) {
      ;(matRef.current.uniforms.uTime as { value: number }).value += delta
    }
    if (dustRef.current) {
      dustRef.current.rotation.y += delta * 0.0004 * (1 + timeWarpRef.current * 0.05)
    }
  })

  return (
    <group>
      <points ref={pointsRef} geometry={geometry}>
        <shaderMaterial
          ref={matRef}
          vertexShader={NEBULA_VERTEX_SHADER}
          fragmentShader={NEBULA_FRAGMENT_SHADER}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </points>
      {/* Dark dust lanes — normal blend so they absorb/dim, not glow. */}
      <points ref={dustRef} geometry={dustGeometry}>
        <shaderMaterial
          vertexShader={NEBULA_VERTEX_SHADER}
          fragmentShader={NEBULA_FRAGMENT_SHADER}
          uniforms={dustUniforms}
          transparent
          depthWrite={false}
          blending={NormalBlending}
        />
      </points>
    </group>
  )
}

/* ============================================================
 * NebulaDetail — per-nebula hover reveal.
 *
 * Blooms structured gas out of the idle halo when a nebula is
 * hovered/focused: Orion's layered Hα/O-III clouds + Trapezium,
 * the Ring's teal shell + white-dwarf core, the Crab's filaments.
 * ============================================================ */
export function NebulaDetail({
  pointId,
  size,
  hovered,
  invert,
  nebulaType,
}: {
  pointId: string
  size: number
  hovered: boolean
  invert: boolean
  /** OpenNGC sub-type — generalizes the per-id variants to the whole catalog:
   *  every planetary nebula gets the M57-style shell, every SNR the Crab-style
   *  filaments, reflection nebulae go blue, dark nebulae become dust
   *  silhouettes instead of glowing. */
  nebulaType?: "planetary" | "snr" | "emission" | "reflection" | "dark"
}) {
  const rootRef = useRef<Group>(null)
  const swirlRef = useRef<Group>(null)
  const cloudMatRefs = useRef<Array<import("three").MeshBasicMaterial | null>>([])
  const ringMatRef = useRef<import("three").MeshBasicMaterial>(null)
  const trapeziumMatRefs = useRef<Array<import("three").MeshBasicMaterial | null>>([])

  // Per-nebula palette + layout. Color choices match what astrophotos actually
  // show: Orion = pink Hα core + teal OIII wisps; Ring = teal annulus + warm
  // white-dwarf core; Crab = magenta + cyan filaments.
  const config = useMemo(() => {
    type NebulaCloud = {
      color: string
      offset: [number, number, number]
      scale: number
      stretch: [number, number, number]
    }
    if (pointId === "m57" || nebulaType === "planetary") {
      // Planetary nebula — an expanding shell of ionized gas around the dying
      // star's exposed core (a white dwarf): teal O III annulus + warm centre.
      return {
        variant: "ring" as const,
        ringColor: invert ? "#1e3a3a" : "#7adfd2",
        coreColor: invert ? "#5a2412" : "#ffe9b8",
        clouds: [] as NebulaCloud[],
      }
    }
    if (nebulaType === "reflection") {
      // Reflection nebula — starlight scattered by dust; blue for the same
      // reason the daytime sky is (scattering efficiency rises with frequency).
      const clouds: NebulaCloud[] = [
        { color: invert ? "#243a5a" : "#8fb6ff", offset: [0.40, 0.14, 0.10], scale: 1.5, stretch: [1.5, 0.75, 1.2] },
        { color: invert ? "#1f3a4a" : "#7fd6e8", offset: [-0.42, -0.16, 0.14], scale: 1.3, stretch: [1.25, 0.7, 1.5] },
        { color: invert ? "#2b3b56" : "#a8c8ff", offset: [0.05, 0.34, -0.26], scale: 1.1, stretch: [1.3, 0.8, 1.2] },
        { color: invert ? "#264963" : "#bfe4ff", offset: [-0.20, 0.30, 0.20], scale: 0.85, stretch: [1.05, 0.65, 1.3] },
      ]
      return {
        variant: "clouds" as const,
        ringColor: "",
        coreColor: invert ? "#2b3b56" : "#c6dcff",
        clouds,
      }
    }
    if (nebulaType === "dark") {
      // Dark nebula — cold dust that BLOCKS light. It must not glow: near-black
      // brown silhouettes rendered with normal blending against the starfield.
      const clouds: NebulaCloud[] = [
        { color: invert ? "#c9bfae" : "#140b06", offset: [0.35, 0.10, 0.08], scale: 1.6, stretch: [1.6, 0.8, 1.2] },
        { color: invert ? "#bdb2a0" : "#0e0804", offset: [-0.38, -0.14, 0.12], scale: 1.4, stretch: [1.3, 0.75, 1.4] },
        { color: invert ? "#cfc6b6" : "#1a0f08", offset: [0.02, -0.30, -0.20], scale: 1.1, stretch: [1.2, 0.7, 1.1] },
      ]
      return {
        variant: "dark" as const,
        ringColor: "",
        coreColor: invert ? "#c9bfae" : "#0e0804",
        clouds,
      }
    }
    if (pointId === "m1" || nebulaType === "snr") {
      const clouds: NebulaCloud[] = [
        { color: invert ? "#5a1c4a" : "#ff7ab8", offset: [0.42, 0.20, 0.04],  scale: 1.5, stretch: [1.5, 0.8, 1.3] },
        { color: invert ? "#243a5a" : "#7ec8ff", offset: [-0.52, -0.28, 0.16], scale: 1.2, stretch: [1.2, 0.7, 1.6] },
        { color: invert ? "#3a1530" : "#ffb38a", offset: [0.10, -0.42, -0.18], scale: 0.95, stretch: [1.3, 0.75, 1.1] },
        { color: invert ? "#274963" : "#8fe8ff", offset: [-0.08, 0.36, -0.24], scale: 0.9, stretch: [1.1, 0.65, 1.4] },
      ]
      return {
        variant: "filaments" as const,
        ringColor: "",
        coreColor: invert ? "#3a1530" : "#ff8acf",
        clouds,
      }
    }
    // Default / Orion-style emission nebula.
    const clouds: NebulaCloud[] = [
      { color: invert ? "#5a2436" : "#ff8fae", offset: [0.42, 0.12, 0.10], scale: 1.6, stretch: [1.55, 0.75, 1.20] },
      { color: invert ? "#1f3a4a" : "#7fd6e8", offset: [-0.40, -0.18, 0.15], scale: 1.35, stretch: [1.25, 0.70, 1.50] },
      { color: invert ? "#3a1f4a" : "#c19bff", offset: [0.04, 0.34, -0.28], scale: 1.15, stretch: [1.35, 0.82, 1.22] },
      { color: invert ? "#4a2c1f" : "#ffb58f", offset: [0.12, -0.36, -0.16], scale: 0.95, stretch: [1.15, 0.68, 1.10] },
      { color: invert ? "#2b3b56" : "#8fb6ff", offset: [-0.26, 0.32, 0.22], scale: 0.85, stretch: [1.05, 0.64, 1.30] },
    ]
    return {
      variant: pointId === "m42" ? "orion" : ("clouds" as const),
      ringColor: "",
      coreColor: invert ? "#5a2436" : "#ffb6c9",
      clouds,
    }
  }, [pointId, invert, nebulaType])

  // Trapezium positions — the four bright young O-class stars at the heart of
  // Orion. Approximate relative layout, scaled into the local frame.
  const trapezium = useMemo<Array<[number, number, number]>>(
    () => [
      [-0.12,  0.05, 0],
      [ 0.10,  0.08, 0],
      [-0.04, -0.10, 0],
      [ 0.14, -0.04, 0],
    ],
    [],
  )

  useFrame((_, delta) => {
    const k = 1 - Math.exp(-delta * 6)

    // Lerp the whole detail group's scale toward the hover target so the
    // reveal feels like a soft bloom, not a snap.
    if (rootRef.current) {
      const target = hovered ? 1.0 : 0.001
      const s = rootRef.current.scale.x
      const next = s + (target - s) * k
      rootRef.current.scale.set(next, next, next)
    }

    // Slow swirl on the cloud group — readable rotation without strobing.
    if (swirlRef.current && hovered) {
      swirlRef.current.rotation.z += delta * 0.05
    }

    // Dark nebulae silhouette rather than glow — slightly lower ceiling so the
    // dust reads as absence-of-stars, not a brown lamp.
    const cloudTarget = hovered ? (config.variant === "dark" ? 0.5 : invert ? 0.55 : 0.62) : 0
    cloudMatRefs.current.forEach((m) => {
      if (!m) return
      m.opacity += (cloudTarget - m.opacity) * k
    })

    if (ringMatRef.current) {
      const ringTarget = hovered ? (invert ? 0.8 : 0.85) : 0
      ringMatRef.current.opacity += (ringTarget - ringMatRef.current.opacity) * k
    }

    const trapeziumTarget = hovered ? 1 : 0
    trapeziumMatRefs.current.forEach((m) => {
      if (!m) return
      m.opacity += (trapeziumTarget - m.opacity) * k
    })
  })

  // Dark nebulae must occlude (normal blending) — additive can only add light.
  const blending = invert || config.variant === "dark" ? NormalBlending : AdditiveBlending
  // Detail scale: the cloud structure should bloom out well past the idle halo
  // so the hover state reads as a real reveal, not a subtle tint.
  const detailScale = size * 2.4

  return (
    <group ref={rootRef} scale={0.001}>
      {config.variant === "ring" ? (
        // Planetary-nebula ring (M57). Sits perpendicular to the line of sight
        // so the annulus reads as a flat ring, not a sphere.
        <>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[detailScale * 0.42, detailScale * 0.58, 64]} />
            <meshBasicMaterial
              ref={ringMatRef as React.Ref<import("three").MeshBasicMaterial>}
              color={config.ringColor}
              transparent
              opacity={0}
              side={DoubleSide}
              blending={blending}
              depthWrite={false}
            />
          </mesh>
          {/* White-dwarf core — the dying star at the ring's centre. */}
          <mesh>
            <sphereGeometry args={[detailScale * 0.06, 12, 12]} />
            <meshBasicMaterial
              ref={(m) => { trapeziumMatRefs.current[0] = m }}
              color={config.coreColor}
              transparent
              opacity={0}
              blending={blending}
              depthWrite={false}
            />
          </mesh>
        </>
      ) : (
        // Cloud variant — stretched layered billows with a softer envelope,
        // so gas reads like depth volume instead of chunky spheres.
        <group ref={swirlRef}>
          {config.clouds.map((c, i) => (
            <group
              key={i}
              position={[
                c.offset[0] * detailScale,
                c.offset[1] * detailScale,
                c.offset[2] * detailScale,
              ]}
              rotation={[0, i * 0.45, i * 0.22]}
            >
              <mesh scale={c.stretch}>
                <sphereGeometry args={[detailScale * 0.50 * c.scale, 30, 30]} />
                <meshBasicMaterial
                  ref={(m) => { cloudMatRefs.current[i] = m }}
                  color={c.color}
                  transparent
                  opacity={0}
                  blending={blending}
                  depthWrite={false}
                />
              </mesh>
              <mesh scale={[c.stretch[0] * 1.35, c.stretch[1] * 1.35, c.stretch[2] * 1.35]}>
                <sphereGeometry args={[detailScale * 0.54 * c.scale, 24, 24]} />
                <meshBasicMaterial
                  color={c.color}
                  transparent
                  opacity={invert ? 0.16 : 0.14}
                  blending={blending}
                  depthWrite={false}
                />
              </mesh>
            </group>
          ))}
        </group>
      )}

      {/* Trapezium — Orion only. Four bright young O-stars at the core,
          arranged in the trademark quadrilateral. */}
      {config.variant === "orion" &&
        trapezium.map((pos, i) => (
          <mesh key={i} position={[pos[0] * detailScale, pos[1] * detailScale, pos[2] * detailScale]}>
            <sphereGeometry args={[detailScale * 0.04, 12, 12]} />
            <meshBasicMaterial
              ref={(m) => { trapeziumMatRefs.current[i] = m }}
              color={invert ? "#0a0a0a" : "#ffffff"}
              transparent
              opacity={0}
              blending={blending}
              depthWrite={false}
            />
          </mesh>
        ))}
    </group>
  )
}

/* ============================================================
 * Volumetric nebula data + raymarched 3D volume.
 * ============================================================ */

export const NEBULA_SPRITES: Record<string, string> = {
  m42: "/textures/nebulae/orion.webp",
}

/** Per-nebula volumetric config (real Hα/O-III look). Only listed nebulae get
 *  the raymarched 3D volume on close approach. mode: 0 = emission cloud,
 *  1 = ring/shell (planetary nebula). */
export const VOLUMETRIC_NEBULAE: Record<string, { glow: [number, number, number]; rim: [number, number, number]; mode: number; density: number }> = {
  m42:    { glow: [0.95, 0.45, 0.62], rim: [0.45, 0.70, 0.95], mode: 0, density: 1.0 }, // Orion — Hα pink + O-III teal
  m16:    { glow: [0.90, 0.40, 0.45], rim: [0.55, 0.75, 0.55], mode: 0, density: 1.15 }, // Eagle — red Hα + green pillars
  carina: { glow: [0.95, 0.55, 0.50], rim: [0.55, 0.65, 0.95], mode: 0, density: 1.25 }, // Carina — vast bright Hα
  m8:     { glow: [0.95, 0.42, 0.52], rim: [0.50, 0.62, 0.90], mode: 0, density: 1.0 },  // Lagoon (if present)
  m57:    { glow: [0.55, 0.85, 0.80], rim: [0.95, 0.70, 0.45], mode: 1, density: 0.9 },  // Ring — teal shell, warm core
  m20:    { glow: [0.70, 0.45, 0.90], rim: [0.55, 0.70, 0.95], mode: 0, density: 1.0 },  // Trifid (if present) — pink+blue
}

/**
 * VolumetricNebula — a TRUE 3D gas cloud, raymarched live in GLSL (no billboard,
 * so it has real parallax + depth you can move through). Rendered on the inside
 * of a box: the fragment shader marches from the camera through the box volume,
 * accumulating FBM-noise emission. Only mounted when a nebula is focused/near, so
 * the per-pixel march cost is paid only when it matters. uOpacity blends it in.
 */
const VOLNEB_VERT = `
  varying vec3 vLocalPos;
  varying vec3 vCamLocal;
  void main() {
    vLocalPos = position;
    // camera position in this mesh's local space — the ray origin for marching
    vCamLocal = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const VOLNEB_FRAG = `
  precision highp float;
  varying vec3 vLocalPos;
  varying vec3 vCamLocal;
  uniform float uTime;
  uniform float uOpacity;
  uniform vec3  uGlow;
  uniform vec3  uRim;
  uniform float uMode;     // 0 = emission cloud, 1 = ring/shell (planetary)
  uniform float uDensity;  // overall density multiplier

  float hash(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7)))*43758.5453123); }
  float vnoise(vec3 p){
    vec3 i=floor(p); vec3 f=fract(p); f=f*f*(3.0-2.0*f);
    float n000=hash(i), n100=hash(i+vec3(1,0,0)), n010=hash(i+vec3(0,1,0)), n110=hash(i+vec3(1,1,0));
    float n001=hash(i+vec3(0,0,1)), n101=hash(i+vec3(1,0,1)), n011=hash(i+vec3(0,1,1)), n111=hash(i+vec3(1,1,1));
    return mix(mix(mix(n000,n100,f.x),mix(n010,n110,f.x),f.y),
               mix(mix(n001,n101,f.x),mix(n011,n111,f.x),f.y), f.z);
  }
  float fbm(vec3 p){ float v=0.0,a=0.5; for(int i=0;i<6;i++){ v+=a*vnoise(p); p=p*2.03+vec3(1.7); a*=0.5; } return v; }

  // density at a point in local space (~[-1,1]). Richer than a plain blob: a
  // base radial falloff carved by multi-octave FBM, with a brighter dense core;
  // ring mode hollows the centre into a shell (planetary nebulae like M57).
  float density(vec3 p){
    float r = length(p);
    // domain-warp the sample point with a low-freq noise → billowy, not uniform
    vec3 warp = vec3(fbm(p*0.9 + uTime*0.015), fbm(p*0.9 + 3.1), fbm(p*0.9 - 2.2)) - 0.5;
    vec3 q = p + warp * 0.6;
    float n = fbm(q * 2.0);
    n = smoothstep(0.42, 0.95, n);
    float fall;
    if (uMode > 0.5) {
      // ring/shell: peak at a mid radius, hollow centre + faded edge
      fall = smoothstep(0.18, 0.42, r) * (1.0 - smoothstep(0.55, 0.95, r));
    } else {
      fall = smoothstep(1.0, 0.12, r);
    }
    float core = (uMode > 0.5) ? 0.0 : pow(smoothstep(0.35, 0.0, r), 2.0) * 0.5; // bright nucleus
    return (n * fall + core) * uDensity;
  }

  void main(){
    vec3 rd = normalize(vLocalPos - vCamLocal);
    const int STEPS = 56;
    float stepLen = 2.7 / float(STEPS);
    vec3 p = vLocalPos;            // start at the entry face, march toward camera
    vec3 dir = -rd * stepLen;
    vec3 acc = vec3(0.0);
    float trans = 1.0;
    for(int i=0;i<STEPS;i++){
      float d = density(p);
      if(d > 0.001){
        // colour: faint rim → bright core hue as density rises
        vec3 col = mix(uRim, uGlow, smoothstep(0.0, 0.55, d));
        float a = d * 0.12;
        acc += trans * a * col;
        trans *= (1.0 - a);
        if(trans < 0.02) break;
      }
      p += dir;
    }
    float alpha = (1.0 - trans) * uOpacity;
    gl_FragColor = vec4(acc * uOpacity * 2.1, alpha);
  }
`

export function VolumetricNebula({ size, active, glow, rim, mode, density }: {
  size: number
  active: boolean
  glow: [number, number, number]
  rim: [number, number, number]
  mode: number
  density: number
}) {
  const matRef = useRef<ShaderMaterial>(null)
  const uniforms = useMemo(() => ({
    uTime:    { value: 0 },
    uOpacity: { value: 0 },
    uGlow:    { value: new Color(...glow) },
    uRim:     { value: new Color(...rim) },
    uMode:    { value: mode },
    uDensity: { value: density },
  }), [glow, rim, mode, density])
  useFrame((_, delta) => {
    uniforms.uTime.value += delta
    const k = 1 - Math.exp(-delta * 3)
    uniforms.uOpacity.value += ((active ? 1 : 0) - uniforms.uOpacity.value) * k
  })
  return (
    <mesh scale={size}>
      <boxGeometry args={[2, 2, 2]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={VOLNEB_VERT}
        fragmentShader={VOLNEB_FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={BackSide}
        blending={AdditiveBlending}
      />
    </mesh>
  )
}
