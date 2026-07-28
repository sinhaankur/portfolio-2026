"use client"

/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine — see ./index.tsx for the full notice.
 * https://github.com/sinhaankur/portfolio-2026/blob/main/LICENSE
 *
 * Universe Engine — Milky Way backdrop sub-engine.
 *
 * The galaxy we live in, rendered as a single-draw point field: four spiral
 * arms + bulge + central bar + HII star-forming knots + a globular-cluster
 * halo, each with its own population palette. Embeds the diffuse NebulaClouds
 * gas/dust haze, and carries hover/focus hit-zones for Sagittarius A* (the
 * galactic centre) and the galaxy itself.
 *
 * Consumers (scene.tsx) mount <MilkyWay onHover mobile invert interactive />
 * inside the galactic-plane-tilted group. Star counts drop ~40% on mobile.
 */

import { useRef, useMemo } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Group,
  NormalBlending,
  Points,
  ShaderMaterial,
} from "three"

import { GALAXY_VERTEX_SHADER, GALAXY_FRAGMENT_SHADER, DUST_HAZE_VERTEX_SHADER, DUST_HAZE_FRAGMENT_SHADER } from "./shaders"
import { MILKY_WAY_INFO, SGR_A_INFO, gauss, timeWarpRef } from "./astronomy"
import { makeFocusHandler } from "./scene-shared"
import { NebulaClouds } from "./nebula"
import type { HoverHandler } from "./types"

/* ============================================================
 * Milky Way backdrop — 4 spiral arms + bulge, with hover hit-zones
 * for Sgr A* (galactic centre) and the galaxy itself.
 * ============================================================ */

export function MilkyWay({
  onHover,
  mobile = false,
  invert = false,
  interactive = false,
  densityScale = 1,
}: {
  onHover: HoverHandler
  mobile?: boolean
  invert?: boolean
  interactive?: boolean
  /** Device-tier density multiplier (ultra 1.4 → richer arms, low 0.4 →
   *  lighter). Composes with the mobile halving below. */
  densityScale?: number
}) {
  const pointsRef = useRef<Points>(null)
  const matRef = useRef<ShaderMaterial>(null)
  const dustMatRef = useRef<ShaderMaterial>(null)
  const coreGlowRef = useRef<Group>(null)
  const { gl } = useThree()

  // Procedural radial-glow texture for the luminous core sprites — generated
  // once on a canvas (no asset, no Blender needed): a soft white→transparent
  // gaussian falloff. Reused across the three stacked core billboards.
  const coreTex = useMemo(() => {
    if (typeof document === "undefined") return null
    const s = 128
    const c = document.createElement("canvas")
    c.width = c.height = s
    const ctx = c.getContext("2d")!
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
    g.addColorStop(0, "rgba(255,255,255,1)")
    g.addColorStop(0.25, "rgba(255,255,255,0.7)")
    g.addColorStop(0.5, "rgba(255,255,255,0.25)")
    g.addColorStop(1, "rgba(255,255,255,0)")
    ctx.fillStyle = g
    ctx.fillRect(0, 0, s, s)
    const tex = new CanvasTexture(c)
    tex.needsUpdate = true
    return tex
  }, [])

  // Diffuse dust-haze uniforms — the soft glowing spine behind the point field.
  // Dark theme only (additive); chart mode keeps the clean ink look.
  const dustUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uBrightness: { value: 0.72 }, // richer dust glow for a clearer band
      uCoreColor: { value: new Color("#ffc089") }, // warm amber bulge
      uArmColor: { value: new Color("#5a6b9c") },  // cool dusty blue arms
    }),
    [],
  )

  const geometry = useMemo(() => {
    // Mobile counts run ~40% of desktop to keep the GPU breathing. The
    // shader is single-draw, so per-star count is the dominant cost. The
    // device-tier densityScale then lifts (ultra) or trims (low/mid) on top,
    // clamped so a mislabelled "ultra" can't balloon the arm draw unboundedly.
    const ds = Math.max(0.3, Math.min(1.5, densityScale))
    const armCount    = Math.round((mobile ? 9000  : 30000) * ds)
    const bulgeCount  = Math.round((mobile ? 2800  : 7000)  * ds)
    const barCount    = Math.round((mobile ? 900   : 2200)  * ds)
    // HII regions are distributed across a number of anchor clumps so they
    // read as discrete pink star-forming knots tracing the arms, not a haze.
    const hiiClumps   = Math.round((mobile ? 16    : 38)    * ds)
    const hiiPerClump = 22
    const hiiCount    = hiiClumps * hiiPerClump
    // Globular cluster halo — sparse bright dots in a sphere around the disc.
    const haloCount   = Math.round((mobile ? 50    : 110)   * ds)

    const total = armCount + bulgeCount + barCount + hiiCount + haloCount
    const positions = new Float32Array(total * 3)
    const sizes     = new Float32Array(total)
    const alphas    = new Float32Array(total)
    const colors    = new Float32Array(total * 3)

    const radius = 130
    const branches = 4
    const spin = 1.3

    // Chart-mode (invert) suppresses per-star colour — every star multiplies
    // through the dark uStarColor uniform, so we want a flat 1,1,1 here.
    // Dark-mode lets the palette through.
    const writeColor = (idx: number, r: number, g: number, b: number) => {
      const i3 = idx * 3
      if (invert) {
        colors[i3] = 1; colors[i3 + 1] = 1; colors[i3 + 2] = 1
      } else {
        colors[i3] = r; colors[i3 + 1] = g; colors[i3 + 2] = b
      }
    }

    // -- Arm stars: young blue O/B stars dominate the outer arms, white
    //    main-sequence stars in the mid arms, warmer yellows shading toward
    //    the bulge. This is what gives the spiral structure a real palette
    //    instead of a flat white wash.
    for (let i = 0; i < armCount; i++) {
      const r = Math.pow(Math.random(), 1.6) * radius
      const branchAngle = ((i % branches) / branches) * Math.PI * 2
      const spinAngle = r * spin * 0.04
      // Arm spurs/feathering — real spiral arms aren't smooth logarithmic
      // curves; they branch into spurs + feathers. A small radius-varying sine
      // perturbation on the angle gives that frayed, structured look instead of
      // four clean ribbons.
      const spur = Math.sin(r * 0.9 + branchAngle * 3.0) * 0.10
        + Math.sin(r * 2.7) * 0.04
      const armAngle = branchAngle + spinAngle + spur

      const randomness = 0.28
      const rx = Math.pow(Math.random(), 2.6) * (Math.random() < 0.5 ? 1 : -1) * randomness * r
      const ry = Math.pow(Math.random(), 2.6) * (Math.random() < 0.5 ? 1 : -1) * randomness * r * 0.12
      const rz = Math.pow(Math.random(), 2.6) * (Math.random() < 0.5 ? 1 : -1) * randomness * r

      const i3 = i * 3
      positions[i3]     = Math.cos(armAngle) * r + rx
      positions[i3 + 1] = ry
      positions[i3 + 2] = Math.sin(armAngle) * r + rz

      const sizeRoll = Math.pow(Math.random(), 3.5)
      sizes[i] = 1.0 + sizeRoll * 5
      const normR = r / radius
      alphas[i] = (0.08 + (1 - normR) * 0.25) * (0.5 + Math.random() * 0.5)

      // Color: bias warmer toward the centre, bluer toward the outskirts.
      const cRoll = Math.random()
      const blueBias = 0.18 + normR * 0.32 // 18% inner → 50% outer chance of a blue/white star
      if (cRoll < blueBias) {
        // Hot young blue-white star (O/B class)
        writeColor(i, 0.74 + Math.random() * 0.10, 0.82 + Math.random() * 0.08, 1.0)
      } else if (cRoll < blueBias + 0.30) {
        // White main-sequence
        const j = 0.95 + Math.random() * 0.05
        writeColor(i, j, j, j)
      } else if (cRoll < blueBias + 0.72) {
        // Warm yellow (sun-like)
        writeColor(i, 1.0, 0.93 + Math.random() * 0.04, 0.72 + Math.random() * 0.06)
      } else {
        // Cool orange / red giant
        writeColor(i, 1.0, 0.78 + Math.random() * 0.05, 0.58 + Math.random() * 0.06)
      }
    }

    // -- Bulge: older Population II — predominantly warm yellows and oranges.
    for (let i = 0; i < bulgeCount; i++) {
      const idx = armCount + i
      const i3 = idx * 3
      const r = Math.abs(gauss()) * radius * 0.18
      const theta = Math.random() * Math.PI * 2
      const phi = (Math.random() - 0.5) * 0.55

      positions[i3]     = r * Math.cos(theta) * Math.cos(phi)
      positions[i3 + 1] = r * Math.sin(phi) * 0.6
      positions[i3 + 2] = r * Math.sin(theta) * Math.cos(phi)

      const sizeRoll = Math.pow(Math.random(), 3)
      sizes[idx] = 2 + sizeRoll * 8
      alphas[idx] = 0.3 + Math.random() * 0.2

      // Warm bulge palette — amber-cream with the occasional red giant.
      if (Math.random() < 0.75) {
        writeColor(idx, 1.0, 0.90 + Math.random() * 0.05, 0.68 + Math.random() * 0.07)
      } else {
        writeColor(idx, 1.0, 0.74 + Math.random() * 0.06, 0.50 + Math.random() * 0.06)
      }
    }

    // -- Central bar: the Milky Way is SBbc — an elongated stellar bar
    //    runs through the bulge along a fixed axis. ~7000 ly half-length
    //    in real units → ~18 scene units half-length. Aligned along X
    //    so the disc rotation carries it naturally.
    const barHalfLength = radius * 0.21
    const barHalfWidth  = radius * 0.045
    const barHalfHeight = radius * 0.020
    for (let i = 0; i < barCount; i++) {
      const idx = armCount + bulgeCount + i
      const i3 = idx * 3
      // Concentrate stars toward the bar's long axis: cube the random
      // for length (mild tapering toward the ends) and gauss-fall for
      // width/height (thin in cross-section).
      const u = (Math.random() * 2 - 1) // -1..1 along the bar
      const along = Math.sign(u) * Math.pow(Math.abs(u), 0.9) * barHalfLength
      const across = gauss() * barHalfWidth * 0.55
      const vert   = gauss() * barHalfHeight * 0.55

      positions[i3]     = along
      positions[i3 + 1] = vert
      positions[i3 + 2] = across

      sizes[idx] = 2 + Math.pow(Math.random(), 2.5) * 6
      alphas[idx] = 0.32 + Math.random() * 0.22

      // Bar shares the bulge's old-population palette.
      writeColor(idx, 1.0, 0.88 + Math.random() * 0.05, 0.62 + Math.random() * 0.07)
    }

    // -- HII star-forming regions: pinkish/magenta clumps tracing the
    //    arms (Hα emission from ionised hydrogen around young hot stars).
    //    Each clump anchors on a spiral-arm position, then sprays a few
    //    points around it for a soft nebular cluster look.
    for (let c = 0; c < hiiClumps; c++) {
      const armR = (0.18 + Math.random() * 0.72) * radius
      const armBranch = Math.floor(Math.random() * branches)
      const branchAngle = (armBranch / branches) * Math.PI * 2
      const spinAngle = armR * spin * 0.04
      const armX = Math.cos(branchAngle + spinAngle) * armR
      const armZ = Math.sin(branchAngle + spinAngle) * armR

      const clumpScatter = 1.6 + Math.random() * 2.2
      for (let k = 0; k < hiiPerClump; k++) {
        const idx = armCount + bulgeCount + barCount + c * hiiPerClump + k
        const i3 = idx * 3
        const dx = gauss() * clumpScatter
        const dy = gauss() * 0.5
        const dz = gauss() * clumpScatter
        positions[i3]     = armX + dx
        positions[i3 + 1] = dy
        positions[i3 + 2] = armZ + dz

        sizes[idx]  = 3 + Math.random() * 4
        alphas[idx] = 0.35 + Math.random() * 0.35
        // Pink Hα emission with a touch of magenta variation. Hot blue stars
        // sometimes peek through as bluer cores — vary slightly per point.
        if (Math.random() < 0.18) {
          writeColor(idx, 0.78, 0.86, 1.0)
        } else {
          writeColor(idx, 1.0, 0.46 + Math.random() * 0.08, 0.70 + Math.random() * 0.10)
        }
      }
    }

    // -- Globular cluster halo: a sparse sphere of bright old clusters
    //    surrounding the disc. Spread well above and below the plane to
    //    sell the 3D structure of the galaxy.
    for (let i = 0; i < haloCount; i++) {
      const idx = armCount + bulgeCount + barCount + hiiCount + i
      const i3 = idx * 3
      // Spherical distribution biased outside the disc.
      const haloR = radius * (0.45 + Math.pow(Math.random(), 1.4) * 0.85)
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      positions[i3]     = haloR * Math.sin(phi) * Math.cos(theta)
      positions[i3 + 1] = haloR * Math.cos(phi) * 0.85
      positions[i3 + 2] = haloR * Math.sin(phi) * Math.sin(theta)

      sizes[idx] = 4 + Math.random() * 4
      alphas[idx] = 0.55 + Math.random() * 0.25
      // Warm old-cluster colour.
      writeColor(idx, 1.0, 0.86 + Math.random() * 0.05, 0.62 + Math.random() * 0.08)
    }

    const geo = new BufferGeometry()
    geo.setAttribute("position", new BufferAttribute(positions, 3))
    geo.setAttribute("aSize", new BufferAttribute(sizes, 1))
    geo.setAttribute("aAlpha", new BufferAttribute(alphas, 1))
    geo.setAttribute("aColor", new BufferAttribute(colors, 3))
    return geo
  }, [mobile, invert, densityScale])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(gl.getPixelRatio(), 2) },
      uStarColor: { value: new Color(invert ? "#0a0a0a" : "#ffffff") },
      // Dark-mode brightness gain so the Milky Way band reads clearly against
      // ink (additive + ACES tone-mapping was washing it faint). Chart mode
      // keeps 1.0 — its NormalBlending ink look was already correct.
      uBrightness: { value: invert ? 1.0 : 2.3 },
    }),
    [gl, invert],
  )

  useFrame((_, delta) => {
    // Galactic rotation — real Milky Way takes ~225 million years per
    // rotation at the Sun's distance from the core. Even at our maximum
    // time warp that resolves to imperceptible drift, so we keep a small
    // base drift scaled to time warp: feels alive at idle, speeds up
    // noticeably when the user pushes the warp slider. Was a flat 0.008
    // rad/s — ~75,000× too fast and read as a carousel spin.
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * 0.0004 * (1 + timeWarpRef.current * 0.05)
    }
    if (matRef.current) {
      ;(matRef.current.uniforms.uTime as { value: number }).value += delta
    }
    if (dustMatRef.current) {
      ;(dustMatRef.current.uniforms.uTime as { value: number }).value += delta
    }
  })

  return (
    <group>
      {/* Diffuse dust-haze spine — a single big additive disc lying in the
          galactic plane, giving the Milky Way the hazy luminous band + dust
          lanes of a real long-exposure sky. One draw call, no per-star cost, so
          it's safe on every tier. Dark theme only (additive bleaches on cream).
          Rendered first so it sits BEHIND the point field as pure glow. */}
      {!invert && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} scale={[58, 34, 1]}>
          <planeGeometry args={[1, 1]} />
          <shaderMaterial
            ref={dustMatRef}
            vertexShader={DUST_HAZE_VERTEX_SHADER}
            fragmentShader={DUST_HAZE_FRAGMENT_SHADER}
            uniforms={dustUniforms}
            transparent
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </mesh>
      )}

      {/* LUMINOUS CORE — the galactic bulge should SHINE like a real galaxy
          photo, not just be denser dots. Three stacked additive billboards
          (bright hot centre → warm mid → soft amber halo) give the core a real
          glowing bloom. Camera-facing so it reads from any angle. Dark only. */}
      {!invert && (
        <group ref={coreGlowRef}>
          <sprite scale={[16, 16, 1]}>
            <spriteMaterial map={coreTex} color="#fff4e0" transparent opacity={0.9} depthWrite={false} blending={AdditiveBlending} />
          </sprite>
          <sprite scale={[34, 34, 1]}>
            <spriteMaterial map={coreTex} color="#ffcf8a" transparent opacity={0.55} depthWrite={false} blending={AdditiveBlending} />
          </sprite>
          <sprite scale={[70, 70, 1]}>
            <spriteMaterial map={coreTex} color="#e8a860" transparent opacity={0.22} depthWrite={false} blending={AdditiveBlending} />
          </sprite>
        </group>
      )}

      <points ref={pointsRef} geometry={geometry}>
        <shaderMaterial
          ref={matRef}
          vertexShader={GALAXY_VERTEX_SHADER}
          fragmentShader={GALAXY_FRAGMENT_SHADER}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          // Additive looks right against ink; on cream paper additive blending
          // bleaches stars to invisible — fall back to NormalBlending then.
          blending={invert ? NormalBlending : AdditiveBlending}
        />
      </points>

      {/* Diffuse nebula / dust haze — soft glowing gas clouds tracing the
          arms (Hα-pink, dusty blue, amber). Skipped in chart mode. */}
      {!invert && <NebulaClouds mobile={mobile} densityScale={densityScale} />}

      {/* Sgr A* — the Milky Way's 4.15 million-M☉ supermassive black hole.
          Visible mark sized to be a small accent inside the bulge, not a
          dominant feature. (Earlier 0.9 / 2.4 was wildly too large — looked
          like a marble swallowing the core.) Real Sgr A* would be invisibly
          small at this scale; this is just a "you are here" mark. */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.12, 24, 24]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.35, 20, 20]} />
        <meshBasicMaterial
          color={invert ? "#5a2818" : "#ffb878"}
          transparent
          opacity={invert ? 0.30 : 0.45}
          blending={invert ? NormalBlending : AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {/* Hit-target — larger sphere so the BH is easy to hover/click against
          the dense star backdrop. Invisible material. */}
      <mesh
        position={[0, 0, 0]}
        onPointerOver={(e) => {
          e.stopPropagation()
          onHover(SGR_A_INFO)
        }}
        onPointerOut={() => {
          onHover(null)
        }}
        onClick={makeFocusHandler(interactive, 38, "Sagittarius A*")}
      >
        <sphereGeometry args={[6, 24, 24]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Wider Milky Way bulge hit-zone */}
      <mesh
        position={[0, 0, 0]}
        onPointerOver={(e) => {
          e.stopPropagation()
          onHover(MILKY_WAY_INFO)
        }}
        onPointerOut={() => {
          onHover(null)
        }}
      >
        <sphereGeometry args={[35, 24, 24]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

    </group>
  )
}
