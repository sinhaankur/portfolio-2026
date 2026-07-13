"use client"

/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine — see ./index.tsx for the full notice.
 * https://github.com/sinhaankur/portfolio-2026/blob/main/LICENSE
 *
 * Universe Engine — Galaxy sub-engine.
 *
 * Everything that renders an external galaxy lives here:
 *   - GalaxyDetail   hover/focus reveal — procedural spiral/irregular discs
 *                    (Andromeda + companions, Triangulum, the Magellanic Clouds…)
 *   - Galaxy3D       a true 3D particle disc tilted to the galaxy's inclination,
 *                    with real depth + parallax (not a flat billboard)
 *   - GalaxySprite   camera-facing baked-texture billboard, radially masked so
 *                    the plane edge never shows — the far-distance LOD fallback
 *                    (also reused for baked nebula sprites by scene.tsx)
 *   - GALAXY_3D      per-galaxy 3D form table (tilt · type · palette · scale)
 *
 * Consumers (scene.tsx) pick between the 3D disc (GALAXY_3D[id] present),
 * the baked sprite, and the diffuse halo per sky-point. Adding a galaxy to
 * the 3D path is a one-row edit to GALAXY_3D.
 */

import { useRef, useMemo, useEffect, useState } from "react"
import { useFrame } from "@react-three/fiber"
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Group,
  Mesh,
  NormalBlending,
  ShaderMaterial,
  SRGBColorSpace,
  TextureLoader,
  type Texture,
} from "three"

import { DEG } from "./astronomy"

/**
 * GalaxyDetail
 *
 * Mounted under a galaxy sky-point. The idle visual is the regular warm
 * halo (handled by the parent). On hover/focus, a tilted spiral disc with
 * a bright central bulge fades in, along with companion galaxies where
 * known (M32 + M110 for Andromeda). Currently only Andromeda gets the
 * full treatment — Triangulum/LMC/SMC keep the existing halo.
 *
 * The arm point cloud is built once at mount with a small particle count
 * (~1500), so even multiple galaxies in view don't dominate the GPU.
 * Scale lerps from 0 → 1 on hover so the structure blooms in rather
 * than appearing all at once.
 */
export function GalaxyDetail({
  pointId,
  size,
  hovered,
  invert,
}: {
  pointId: string
  size: number
  hovered: boolean
  invert: boolean
}) {
  const rootRef = useRef<Group>(null)
  const spinRef = useRef<Group>(null)
  const armsMatRef = useRef<import("three").PointsMaterial>(null)
  const haloMatRef = useRef<import("three").PointsMaterial>(null)
  const barMatRef = useRef<import("three").PointsMaterial>(null)
  const bulgeMatRef = useRef<import("three").MeshBasicMaterial>(null)
  const dustMatRef = useRef<import("three").MeshBasicMaterial>(null)
  const irregularMatRef = useRef<import("three").PointsMaterial>(null)
  const irregularHaloMatRef = useRef<import("three").PointsMaterial>(null)
  const irregularBulgeMatRef = useRef<import("three").MeshBasicMaterial>(null)
  const companionMatRefs = useRef<Array<import("three").MeshBasicMaterial | null>>([])

  // The headline galaxies get the full procedural spiral / irregular model;
  // everything else keeps the cheap diffuse halo. The spiral path covers the
  // famous grand-design spirals (Andromeda, Triangulum, Whirlpool, Sombrero,
  // Pinwheel, Bode's, Cigar); the irregular path covers the Magellanic Clouds.
  const isAndromeda = pointId === "m31"
  const isTriangulum = pointId === "m33"
  const isLmc = pointId === "lmc"
  const isSmc = pointId === "smc"
  // Additional famous spirals — rendered with the same spiral model as M33.
  const SPIRAL_GALAXY_IDS = new Set(["m51", "m104", "m101", "m81", "m82"])
  const isExtraSpiral = SPIRAL_GALAXY_IDS.has(pointId)
  // Spiral-model galaxies reuse the Triangulum render path. Folding the extra
  // spirals in here means the geometry builders + tilt logic that key off
  // "Triangulum" fire for them too, without duplicating the model.
  const useSpiralModel = isTriangulum || isExtraSpiral
  const isDetailedGalaxy = isAndromeda || isTriangulum || isLmc || isSmc || isExtraSpiral

  // Andromeda procedural model — built to the structural spec:
  //   - 30% of stars in a dense central bulge, exponential radial decay,
  //     warm yellow-orange-white colour (older stars)
  //   - 70% in two logarithmic spiral arms (r = a · e^(bθ), b = 0.26 to
  //     match Andromeda's tight winding)
  //   - 15% of arm stars are pink H II regions (star-forming clouds)
  //   - The rest are blue/white young main-sequence stars
  // Geometry is normalized to roughly [-1, 1] so the parent scale lerp
  // controls absolute scene-size. Per-vertex colour attribute drives
  // the pointsMaterial via vertexColors.
  const armsGeometry = useMemo(() => {
    const numStars = 9000
    const numBulge = Math.floor(numStars * 0.30)
    const positions = new Float32Array(numStars * 3)
    const colors = new Float32Array(numStars * 3)

    // Bulge — dense exponential cluster around the centre, slightly puffy.
    for (let i = 0; i < numBulge; i++) {
      const r = -Math.log(Math.max(1e-4, Math.random())) * 0.18
      const theta = Math.random() * Math.PI * 2
      const z = (Math.random() - 0.5) * 0.12 * Math.exp(-r * 1.5)
      const i3 = i * 3
      positions[i3]     = r * Math.cos(theta)
      positions[i3 + 1] = z
      positions[i3 + 2] = r * Math.sin(theta)
      // Yellow / orange / white — older stellar population
      colors[i3]     = 0.92 + Math.random() * 0.08
      colors[i3 + 1] = 0.80 + Math.random() * 0.12
      colors[i3 + 2] = 0.58 + Math.random() * 0.14
    }

    // Spiral arms — two logarithmic arms with realistic dispersion.
    const a = 0.06          // anchor radius
    const b = 0.26          // arm tightness — matches Andromeda's spec
    const armOffsets = [0, Math.PI]
    for (let i = numBulge; i < numStars; i++) {
      const r = 0.16 + Math.pow(Math.random(), 0.7) * 0.95
      const armChoice = armOffsets[i % 2]
      let theta = Math.log(r / a) / b + armChoice
      const dispersion = (Math.random() - 0.5) * (0.40 / (r + 0.1))
      theta += dispersion
      const warp = Math.sin(theta * 1.35) * (0.018 + r * 0.05)
      const z = (Math.random() - 0.5) * 0.04 + warp
      const i3 = i * 3
      positions[i3]     = r * Math.cos(theta)
      positions[i3 + 1] = z
      positions[i3 + 2] = r * Math.sin(theta)
      // 15% pink H II star-forming regions, 85% blue-white young stars.
      if (Math.random() < 0.15) {
        colors[i3]     = 0.92 + Math.random() * 0.08
        colors[i3 + 1] = 0.52 + Math.random() * 0.10
        colors[i3 + 2] = 0.72 + Math.random() * 0.10
      } else {
        colors[i3]     = 0.62 + Math.random() * 0.18
        colors[i3 + 1] = 0.72 + Math.random() * 0.18
        colors[i3 + 2] = 0.92 + Math.random() * 0.08
      }
    }

    const geo = new BufferGeometry()
    geo.setAttribute("position", new BufferAttribute(positions, 3))
    geo.setAttribute("color", new BufferAttribute(colors, 3))
    return geo
  }, [])

  // Faint stellar halo — loose, old stars spread far beyond the bright disc.
  // This is what makes Andromeda feel like a real galaxy instead of a flat icon.
  const haloGeometry = useMemo(() => {
    const numStars = 2200
    const positions = new Float32Array(numStars * 3)
    const colors = new Float32Array(numStars * 3)
    for (let i = 0; i < numStars; i++) {
      const radius = Math.pow(Math.random(), 0.28) * 1.25
      const theta = Math.random() * Math.PI * 2
      const thickness = (Math.random() - 0.5) * 0.28 * (1 - radius * 0.45)
      const haloBias = 0.45 + Math.random() * 0.15
      const i3 = i * 3
      positions[i3] = radius * Math.cos(theta)
      positions[i3 + 1] = thickness
      positions[i3 + 2] = radius * Math.sin(theta)
      colors[i3] = 0.78 + Math.random() * 0.10
      colors[i3 + 1] = 0.80 + Math.random() * 0.08
      colors[i3 + 2] = haloBias
    }
    const geo = new BufferGeometry()
    geo.setAttribute("position", new BufferAttribute(positions, 3))
    geo.setAttribute("color", new BufferAttribute(colors, 3))
    return geo
  }, [])

  // Inner bar / nuclear region — Andromeda's center is not a perfect
  // sphere. A subtle elongated stellar bar helps the real structure read.
  const barGeometry = useMemo(() => {
    const numStars = 2600
    const positions = new Float32Array(numStars * 3)
    const colors = new Float32Array(numStars * 3)
    for (let i = 0; i < numStars; i++) {
      const along = (Math.random() - 0.5) * 0.85
      const cross = (Math.random() - 0.5) * 0.12 * (1 - Math.abs(along) * 0.8)
      const vertical = (Math.random() - 0.5) * 0.06 * Math.exp(-Math.abs(along) * 1.4)
      const i3 = i * 3
      positions[i3] = along
      positions[i3 + 1] = vertical
      positions[i3 + 2] = cross
      colors[i3] = 0.92 + Math.random() * 0.06
      colors[i3 + 1] = 0.78 + Math.random() * 0.10
      colors[i3 + 2] = 0.56 + Math.random() * 0.10
    }
    const geo = new BufferGeometry()
    geo.setAttribute("position", new BufferAttribute(positions, 3))
    geo.setAttribute("color", new BufferAttribute(colors, 3))
    return geo
  }, [])

  // Non-Andromeda galaxy detail: Triangulum gets a looser flocculent spiral,
  // while LMC/SMC are rendered as irregular clumpy dwarfs.
  const irregularGeometry = useMemo(() => {
    if (!useSpiralModel && !isLmc && !isSmc) return null
    const numStars = useSpiralModel ? 7000 : isLmc ? 6200 : 5000
    const positions = new Float32Array(numStars * 3)
    const colors = new Float32Array(numStars * 3)

    for (let i = 0; i < numStars; i++) {
      const i3 = i * 3

      if (useSpiralModel) {
        const armOffsets = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3]
        const a = 0.08
        const b = 0.18
        const r = 0.12 + Math.pow(Math.random(), 0.58) * 1.02
        const armChoice = armOffsets[i % armOffsets.length]
        let theta = Math.log(r / a) / b + armChoice
        theta += (Math.random() - 0.5) * (0.72 / (r + 0.2))
        const z = (Math.random() - 0.5) * 0.06 + Math.sin(theta * 0.8) * (0.012 + r * 0.035)
        positions[i3] = r * Math.cos(theta)
        positions[i3 + 1] = z
        positions[i3 + 2] = r * Math.sin(theta)
      } else if (isLmc) {
        const t = Math.random()
        if (t < 0.44) {
          const along = (Math.random() - 0.5) * 1.2
          const cross = (Math.random() - 0.5) * 0.18 * (1 - Math.min(1, Math.abs(along) * 0.7))
          positions[i3] = along
          positions[i3 + 1] = (Math.random() - 0.5) * 0.08
          positions[i3 + 2] = cross + along * 0.08
        } else if (t < 0.78) {
          const theta = Math.random() * Math.PI * 1.4 - Math.PI * 0.2
          const r = 0.24 + Math.pow(Math.random(), 0.6) * 0.9
          positions[i3] = r * Math.cos(theta) * 0.95 - 0.15
          positions[i3 + 1] = (Math.random() - 0.5) * 0.10 + Math.sin(theta * 2.2) * 0.03
          positions[i3 + 2] = r * Math.sin(theta) * 0.7 + 0.08
        } else {
          const clump = Math.random() < 0.5 ? [-0.42, 0.0, 0.32] : [0.35, 0.0, -0.28]
          positions[i3] = clump[0] + (Math.random() - 0.5) * 0.18
          positions[i3 + 1] = clump[1] + (Math.random() - 0.5) * 0.10
          positions[i3 + 2] = clump[2] + (Math.random() - 0.5) * 0.16
        }
      } else {
        const core = Math.random() < 0.62 ? [0.12, 0.0, 0.08] : [-0.38, 0.02, -0.24]
        const bridgePull = Math.random()
        positions[i3] = core[0] + (Math.random() - 0.5) * 0.34 + bridgePull * 0.18
        positions[i3 + 1] = core[1] + (Math.random() - 0.5) * 0.11
        positions[i3 + 2] = core[2] + (Math.random() - 0.5) * 0.30 - bridgePull * 0.12
      }

      if (Math.random() < (useSpiralModel ? 0.24 : isLmc ? 0.28 : 0.22)) {
        colors[i3] = 0.96
        colors[i3 + 1] = 0.56 + Math.random() * 0.12
        colors[i3 + 2] = 0.76 + Math.random() * 0.12
      } else {
        colors[i3] = 0.68 + Math.random() * 0.18
        colors[i3 + 1] = 0.76 + Math.random() * 0.16
        colors[i3 + 2] = 0.92 + Math.random() * 0.08
      }
    }

    const geo = new BufferGeometry()
    geo.setAttribute("position", new BufferAttribute(positions, 3))
    geo.setAttribute("color", new BufferAttribute(colors, 3))
    return geo
  }, [useSpiralModel, isLmc, isSmc])

  const irregularHaloGeometry = useMemo(() => {
    if (!useSpiralModel && !isLmc && !isSmc) return null
    const numStars = useSpiralModel ? 1600 : isLmc ? 1300 : 1100
    const positions = new Float32Array(numStars * 3)
    const colors = new Float32Array(numStars * 3)
    const eccentricity = useSpiralModel ? 0.92 : isLmc ? 0.84 : 0.78
    for (let i = 0; i < numStars; i++) {
      const radius = Math.pow(Math.random(), 0.26) * (isSmc ? 1.0 : 1.2)
      const theta = Math.random() * Math.PI * 2
      const i3 = i * 3
      positions[i3] = radius * Math.cos(theta)
      positions[i3 + 1] = (Math.random() - 0.5) * 0.24 * (1 - radius * 0.4)
      positions[i3 + 2] = radius * Math.sin(theta) * eccentricity
      colors[i3] = 0.78 + Math.random() * 0.10
      colors[i3 + 1] = 0.80 + Math.random() * 0.08
      colors[i3 + 2] = 0.45 + Math.random() * 0.15
    }
    const geo = new BufferGeometry()
    geo.setAttribute("position", new BufferAttribute(positions, 3))
    geo.setAttribute("color", new BufferAttribute(colors, 3))
    return geo
  }, [useSpiralModel, isLmc, isSmc])

  // Companion galaxy positions (Andromeda only — M32 + M110).
  // M32 sits south of the disc, M110 north-west; both are dwarf ellipticals.
  const companions = useMemo(
    () =>
      isAndromeda
        ? [
            { offset: [0.55, -0.65, 0.05] as [number, number, number], radius: 0.08 },
            { offset: [-0.75, 0.50, -0.10] as [number, number, number], radius: 0.13 },
          ]
        : [],
    [isAndromeda],
  )

  useFrame((_, delta) => {
    const k = 1 - Math.exp(-delta * 6)
    // Whole-group scale lerp — bloom in from 0
    if (rootRef.current) {
      const target = hovered ? 1.0 : 0.001
      const s = rootRef.current.scale.x
      const next = s + (target - s) * k
      rootRef.current.scale.set(next, next, next)
    }
    // Slow rotation around the disc normal while hovered, like the real
    // galaxy rotating in place. Subtle so it doesn't feel like a spinner.
    if (spinRef.current && hovered) {
      spinRef.current.rotation.y += delta * 0.02
    }

    const armTarget = hovered ? (invert ? 0.45 : 0.55) : 0
    if (armsMatRef.current) {
      armsMatRef.current.opacity += (armTarget - armsMatRef.current.opacity) * k
    }
    const haloTarget = hovered ? (invert ? 0.18 : 0.24) : 0
    if (haloMatRef.current) {
      haloMatRef.current.opacity += (haloTarget - haloMatRef.current.opacity) * k
    }
    const barTarget = hovered ? (invert ? 0.38 : 0.46) : 0
    if (barMatRef.current) {
      barMatRef.current.opacity += (barTarget - barMatRef.current.opacity) * k
    }
    const bulgeTarget = hovered ? (invert ? 0.55 : 0.75) : 0
    if (bulgeMatRef.current) {
      bulgeMatRef.current.opacity += (bulgeTarget - bulgeMatRef.current.opacity) * k
    }
    const dustTarget = isAndromeda && hovered ? (invert ? 0.5 : 0.55) : 0
    if (dustMatRef.current) {
      dustMatRef.current.opacity += (dustTarget - dustMatRef.current.opacity) * k
    }
    const irregularTarget = hovered ? (invert ? 0.42 : 0.55) : 0
    if (irregularMatRef.current) {
      irregularMatRef.current.opacity += (irregularTarget - irregularMatRef.current.opacity) * k
    }
    const irregularHaloTarget = hovered ? (invert ? 0.14 : 0.22) : 0
    if (irregularHaloMatRef.current) {
      irregularHaloMatRef.current.opacity += (irregularHaloTarget - irregularHaloMatRef.current.opacity) * k
    }
    const irregularBulgeTarget = hovered ? (invert ? 0.45 : 0.62) : 0
    if (irregularBulgeMatRef.current) {
      irregularBulgeMatRef.current.opacity += (irregularBulgeTarget - irregularBulgeMatRef.current.opacity) * k
    }
    const companionTarget = hovered ? (invert ? 0.4 : 0.55) : 0
    companionMatRefs.current.forEach((m) => {
      if (!m) return
      m.opacity += (companionTarget - m.opacity) * k
    })
  })

  if (!isDetailedGalaxy) return null

  // Per-galaxy projection. The extra famous spirals (Whirlpool/Sombrero/…)
  // reuse a Triangulum-like tilt; Sombrero is shown near edge-on (its signature
  // look), the rest closer to face-on so the arms read.
  const tiltDeg = isAndromeda ? 77 : pointId === "m104" ? 80 : useSpiralModel ? 48 : isLmc ? 35 : 20
  const positionAngleDeg = isAndromeda ? 38 : useSpiralModel ? 22 : isLmc ? 170 : 45
  const detailScale = size * (isAndromeda ? 2.4 : useSpiralModel ? 2.2 : isLmc ? 2.0 : 1.9)
  const galaxyTilt = tiltDeg * DEG
  const galaxyAngle = positionAngleDeg * DEG

  // Tight central bulge core — kept as a soft warm glow because the
  // dense inner region in a real galaxy is too star-packed to resolve
  // into individual points. The star-cloud bulge baked into the
  // geometry handles the outer-bulge population.
  const bulgeColor = invert ? "#5a3416" : "#ffd9b0"
  const haloColor = invert ? "#8b7358" : "#dce7ff"
  const barColor = invert ? "#6c4524" : "#ffe2bf"
  const dustColor = invert ? "#0a0a0a" : "#1a0a04"
  const companionColor = invert ? "#3a1d12" : "#ffd9c2"

  return (
    <group ref={rootRef} scale={0.001}>
      {/* Position angle — rotates the apparent major-axis on the sky
          plane (≈38° east of north for Andromeda). Wraps the inclination
          + spin so the spiral's projection lands at the right angle. */}
      <group rotation={[0, 0, galaxyAngle]}>
        {/* Disc inclination — tilts the disc plane 77° from face-on so
            the spiral reads as a near-edge-on ellipse. */}
        <group rotation={[galaxyTilt, 0, 0]}>
          <group ref={spinRef}>
            {isAndromeda ? (
              <>
                <points geometry={haloGeometry} scale={detailScale * 1.14}>
                  <pointsMaterial
                    ref={haloMatRef as React.Ref<import("three").PointsMaterial>}
                    size={detailScale * 0.018}
                    sizeAttenuation
                    vertexColors
                    color={haloColor}
                    transparent
                    opacity={0}
                    blending={invert ? NormalBlending : AdditiveBlending}
                    depthWrite={false}
                  />
                </points>

                <points geometry={barGeometry} scale={detailScale * 0.72} rotation={[0, 0, Math.PI / 8]}>
                  <pointsMaterial
                    ref={barMatRef as React.Ref<import("three").PointsMaterial>}
                    size={detailScale * 0.032}
                    sizeAttenuation
                    vertexColors
                    color={barColor}
                    transparent
                    opacity={0}
                    blending={invert ? NormalBlending : AdditiveBlending}
                    depthWrite={false}
                  />
                </points>

                <points geometry={armsGeometry} scale={detailScale}>
                  <pointsMaterial
                    ref={armsMatRef as React.Ref<import("three").PointsMaterial>}
                    size={detailScale * 0.045}
                    sizeAttenuation
                    vertexColors
                    color={"#ffffff"}
                    transparent
                    opacity={0}
                    blending={invert ? NormalBlending : AdditiveBlending}
                    depthWrite={false}
                  />
                </points>

                <mesh>
                  <sphereGeometry args={[detailScale * 0.14, 20, 20]} />
                  <meshBasicMaterial
                    ref={bulgeMatRef as React.Ref<import("three").MeshBasicMaterial>}
                    color={bulgeColor}
                    transparent
                    opacity={0}
                    blending={invert ? NormalBlending : AdditiveBlending}
                    depthWrite={false}
                  />
                </mesh>

                <mesh rotation={[Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[detailScale * 0.45, detailScale * 0.58, 64]} />
                  <meshBasicMaterial
                    ref={dustMatRef as React.Ref<import("three").MeshBasicMaterial>}
                    color={dustColor}
                    transparent
                    opacity={0}
                    side={DoubleSide}
                    depthWrite={false}
                  />
                </mesh>
              </>
            ) : (
              <>
                {irregularHaloGeometry && (
                  <points geometry={irregularHaloGeometry} scale={detailScale * (isSmc ? 1.04 : 1.10)}>
                    <pointsMaterial
                      ref={irregularHaloMatRef as React.Ref<import("three").PointsMaterial>}
                      size={detailScale * 0.020}
                      sizeAttenuation
                      vertexColors
                      color={isTriangulum ? (invert ? "#6c6a64" : "#d5e4ff") : (invert ? "#61584f" : "#dce1f2")}
                      transparent
                      opacity={0}
                      blending={invert ? NormalBlending : AdditiveBlending}
                      depthWrite={false}
                    />
                  </points>
                )}

                {irregularGeometry && (
                  <points geometry={irregularGeometry} scale={detailScale}>
                    <pointsMaterial
                      ref={irregularMatRef as React.Ref<import("three").PointsMaterial>}
                      size={detailScale * (isSmc ? 0.05 : 0.045)}
                      sizeAttenuation
                      vertexColors
                      color={"#ffffff"}
                      transparent
                      opacity={0}
                      blending={invert ? NormalBlending : AdditiveBlending}
                      depthWrite={false}
                    />
                  </points>
                )}

                <mesh>
                  <sphereGeometry args={[detailScale * (isTriangulum ? 0.1 : isLmc ? 0.12 : 0.11), 20, 20]} />
                  <meshBasicMaterial
                    ref={irregularBulgeMatRef as React.Ref<import("three").MeshBasicMaterial>}
                    color={isSmc ? (invert ? "#54331c" : "#fbc897") : (invert ? "#5a3416" : "#ffd9b0")}
                    transparent
                    opacity={0}
                    blending={invert ? NormalBlending : AdditiveBlending}
                    depthWrite={false}
                  />
                </mesh>
              </>
            )}
          </group>
        </group>
      </group>

      {/* Companion galaxies — M32 + M110 — sit beside the main disc.
          They're rendered without tilt so they read as small ellipticals
          at their own apparent positions. */}
      {companions.map((c, i) => (
        <mesh
          key={i}
          position={[c.offset[0] * detailScale, c.offset[1] * detailScale, c.offset[2] * detailScale]}
        >
          <sphereGeometry args={[detailScale * c.radius, 16, 16]} />
          <meshBasicMaterial
            ref={(m) => { companionMatRefs.current[i] = m }}
            color={companionColor}
            transparent
            opacity={0}
            blending={invert ? NormalBlending : AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  )
}

// Galaxy sprite shader — samples the baked texture AND multiplies by a soft
// radial mask so the square plane edge is ALWAYS invisible (the texture corners
// can never show as a rectangle, the bug that made them read as flat images).
const GALAXY_SPRITE_FRAG = `
  uniform sampler2D uTex;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    vec4 t = texture2D(uTex, vUv);
    // radial vignette: 1 at centre → 0 by the edge (corners fully gone)
    float d = length(vUv - 0.5) * 2.0;       // 0 centre, ~1.41 corner
    float mask = 1.0 - smoothstep(0.7, 1.0, d);
    // additive: brightness carries the look; force corners to black
    gl_FragColor = vec4(t.rgb * uOpacity * mask, 1.0);
  }
`
const GALAXY_SPRITE_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

/** Per-galaxy 3D form. tilt = inclination of the disc (rad, 0 = face-on,
 *  ~1.5 = edge-on); type drives arm/bulge proportions; color = star palette bias. */
export const GALAXY_3D: Record<string, { tilt: number; type: "spiral" | "edgeon" | "irregular"; warm: boolean; scale: number }> = {
  // scale reflects real relative size: Andromeda (~152k ly, larger than the
  // Milky Way) is the biggest here; the Magellanic dwarfs are small.
  m31:  { tilt: 1.30, type: "spiral",     warm: true,  scale: 1.5 }, // Andromeda — biggest
  m33:  { tilt: 0.95, type: "spiral",     warm: false, scale: 0.9 }, // Triangulum
  m51:  { tilt: 0.35, type: "spiral",     warm: false, scale: 1.0 }, // Whirlpool
  m101: { tilt: 0.40, type: "spiral",     warm: false, scale: 1.25 }, // Pinwheel — large
  m104: { tilt: 1.48, type: "edgeon",     warm: true,  scale: 1.1 }, // Sombrero
  lmc:  { tilt: 0.70, type: "irregular",  warm: false, scale: 0.55 }, // LMC — dwarf
  smc:  { tilt: 0.80, type: "irregular",  warm: false, scale: 0.4 },  // SMC — smaller dwarf
}

const GAL3D_VERT = `
  attribute float aSize;
  attribute vec3 aColor;
  varying vec3 vColor;
  uniform float uPixelRatio;
  uniform float uScale;
  void main() {
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uScale * uPixelRatio * (14.0 / -mv.z);
    gl_PointSize = clamp(gl_PointSize, 0.6, 7.0);
  }
`
const GAL3D_FRAG = `
  varying vec3 vColor;
  uniform float uOpacity;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;
    float a = pow(1.0 - d * 2.0, 1.8);
    gl_FragColor = vec4(vColor, a * uOpacity);
  }
`

/**
 * Galaxy3D — a real THREE-DIMENSIONAL galaxy: a procedural particle disc (spiral
 * arms + bulge + genuine thickness), tilted to the galaxy's inclination. Unlike a
 * flat billboard it has true depth + parallax — you see it from different angles
 * as the camera moves, the way a real object in 3-space does. Generated once.
 */
export function Galaxy3D({ id, size, invert }: { id: string; size: number; invert: boolean }) {
  const cfg = GALAXY_3D[id] ?? { tilt: 0.8, type: "spiral" as const, warm: false, scale: 1.0 }
  const groupRef = useRef<Group>(null)
  const matRef = useRef<ShaderMaterial>(null)

  const geometry = useMemo(() => {
    const arm = 3200
    const bulge = 900
    const total = arm + bulge
    const pos = new Float32Array(total * 3)
    const col = new Float32Array(total * 3)
    const siz = new Float32Array(total)
    const R = 1.0
    const branches = cfg.type === "irregular" ? 2 : (cfg.type === "edgeon" ? 2 : 4)
    const spin = cfg.type === "spiral" ? 2.4 : 1.0
    const thickness = cfg.type === "edgeon" ? 0.05 : 0.10
    const irregular = cfg.type === "irregular"

    const setCol = (i: number, r: number, g: number, b: number) => {
      if (invert) { col[i*3]=0.05; col[i*3+1]=0.05; col[i*3+2]=0.05 }
      else { col[i*3]=r; col[i*3+1]=g; col[i*3+2]=b }
    }
    // arms
    for (let i = 0; i < arm; i++) {
      const r = Math.pow(Math.random(), 0.7) * R
      const branch = (i % branches) / branches * Math.PI * 2
      const spinA = r * spin
      const scatter = irregular ? (Math.random() - 0.5) * 2.5 : 0
      const a = branch + spinA + scatter
      const jitter = (irregular ? 0.5 : 0.18) * r
      const rx = (Math.random()-0.5) * jitter * 2
      const rz = (Math.random()-0.5) * jitter * 2
      pos[i*3]   = Math.cos(a) * r + rx
      pos[i*3+1] = (Math.random()-0.5) * thickness * 2 * (1 - r*0.5)
      pos[i*3+2] = Math.sin(a) * r + rz
      siz[i] = 1.0 + Math.pow(Math.random(),3)*3
      const normR = r / R
      if (Math.random() < 0.2 + normR*0.3) setCol(i, 0.75, 0.83, 1.0)     // blue
      else if (Math.random() < 0.5) setCol(i, 0.97,0.97,0.97)             // white
      else setCol(i, 1.0, cfg.warm?0.88:0.92, cfg.warm?0.7:0.8)          // warm
    }
    // bulge
    for (let i = 0; i < bulge; i++) {
      const idx = arm + i
      const r = Math.abs((Math.random()+Math.random()+Math.random())/3 - 0.5) * 2 * R * 0.3
      const th = Math.random()*Math.PI*2
      const ph = (Math.random()-0.5) * (cfg.type==="edgeon" ? 0.9 : 0.5)
      pos[idx*3]   = r*Math.cos(th)*Math.cos(ph)
      pos[idx*3+1] = r*Math.sin(ph)*(cfg.type==="edgeon"?0.7:0.5)
      pos[idx*3+2] = r*Math.sin(th)*Math.cos(ph)
      siz[idx] = 1.0 + Math.pow(Math.random(),3)*2
      setCol(idx, 1.0, 0.9, 0.72)   // warm old core
    }
    const g = new BufferGeometry()
    g.setAttribute("position", new BufferAttribute(pos, 3))
    g.setAttribute("aColor", new BufferAttribute(col, 3))
    g.setAttribute("aSize", new BufferAttribute(siz, 1))
    return g
  }, [id, invert, cfg.type, cfg.warm])

  const uniforms = useMemo(() => ({
    uOpacity: { value: invert ? 0.9 : 0.85 },
    uPixelRatio: { value: typeof window !== "undefined" ? Math.min(window.devicePixelRatio, 2) : 1 },
    uScale: { value: 1 },
  }), [invert])

  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.04
  })

  return (
    // outer group: tilt the disc to the galaxy's inclination → real 3D orientation;
    // per-galaxy scale reflects real relative size (Andromeda largest).
    <group rotation={[cfg.tilt, 0, 0]} scale={size * cfg.scale}>
      <group ref={groupRef}>
        <points geometry={geometry}>
          <shaderMaterial
            ref={matRef}
            vertexShader={GAL3D_VERT}
            fragmentShader={GAL3D_FRAG}
            uniforms={uniforms}
            transparent
            depthWrite={false}
            blending={invert ? NormalBlending : AdditiveBlending}
          />
        </points>
      </group>
    </group>
  )
}

/** A camera-facing billboard showing a baked galaxy texture (additive, radially
 *  masked so the plane edge never shows). Kept as a far-distance LOD fallback. */
export function GalaxySprite({ url, size }: { url: string; size: number }) {
  const ref = useRef<Mesh>(null)
  const matRef = useRef<ShaderMaterial>(null)
  const [tex, setTex] = useState<Texture | null>(null)
  useEffect(() => {
    let alive = true
    new TextureLoader().load(url, (t) => { t.colorSpace = SRGBColorSpace; if (alive) setTex(t) })
    return () => { alive = false }
  }, [url])
  const uniforms = useMemo(() => ({ uTex: { value: null as Texture | null }, uOpacity: { value: 0.9 } }), [])
  useEffect(() => { if (tex) uniforms.uTex.value = tex }, [tex, uniforms])
  useFrame(({ camera }) => { if (ref.current) ref.current.quaternion.copy(camera.quaternion) })
  if (!tex) return null
  return (
    <mesh ref={ref} renderOrder={-1}>
      <planeGeometry args={[size, size]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={GALAXY_SPRITE_VERT}
        fragmentShader={GALAXY_SPRITE_FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </mesh>
  )
}
