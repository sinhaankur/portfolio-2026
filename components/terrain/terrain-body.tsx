"use client"

/**
 * TerrainBody — a single body rendered as a REAL displaced sphere.
 *
 * The geometry is a high-segment sphere; the vertex shader displaces it by the
 * body's measured elevation map (16-bit) at its true scale × a labelled
 * exaggeration. This is the whole point of the terrain engine: what you fly over
 * is the surveyed surface (Olympus Mons, Valles Marineris), not a sculpt.
 *
 * Pure GLSL displacement (ENGINE-STANDARDS: GLSL-first, no terrain meshes). The
 * colour + height maps load via TextureLoader with graceful fallback: if the
 * height map is missing the sphere renders smooth (colour only), never crashes.
 */

import { useRef, useMemo, useEffect, useState } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import {
  ShaderMaterial,
  TextureLoader,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  ClampToEdgeWrapping,
  Vector2,
  Vector3,
  Texture,
} from "three"
import { terrainVertexShader, terrainFragmentShader } from "./terrain-shaders"
import type { TerrainBody as TerrainBodyData } from "@/lib/terrain/bodies"
import { cdnAsset } from "@/lib/asset-cdn"

interface Props {
  body: TerrainBodyData
  /** Sphere radius in scene units (visual size). */
  radiusUnits: number
  /** Vertical exaggeration (driven by the HUD slider; labelled). */
  exaggeration: number
  /** Hypsometric (elevation-tint) overlay strength, 0..1. */
  hypsometric: number
  /** Slope/relief shading strength, 0..1. */
  slopeShade: number
  /** Mesh segments — higher = smoother displacement, heavier. */
  segments?: number
}

export function TerrainBody({
  body,
  radiusUnits,
  exaggeration,
  hypsometric,
  slopeShade,
  segments = 512,
}: Props) {
  const matRef = useRef<ShaderMaterial>(null)
  const { gl } = useThree()
  const [heightTex, setHeightTex] = useState<Texture | null>(null)
  const [colorTex, setColorTex] = useState<Texture | null>(null)

  // Load the colour map (always present) — reuses the engine's body textures.
  useEffect(() => {
    let alive = true
    new TextureLoader().load(body.colorMap, (tex) => {
      if (!alive) return
      tex.wrapS = RepeatWrapping
      tex.wrapT = ClampToEdgeWrapping
      tex.minFilter = LinearMipmapLinearFilter
      tex.magFilter = LinearFilter
      tex.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy())
      tex.needsUpdate = true
      setColorTex(tex)
    })
    return () => { alive = false }
  }, [body.colorMap, gl])

  // Load the 16-bit height map — may be null (body not yet baked → smooth sphere).
  useEffect(() => {
    if (!body.heightMap) { setHeightTex(null); return }
    let alive = true
    // Resolve the height-map URL by hosting mode:
    //   • R2-only (GEBCO)   → R2 key, NO local fallback (no repo copy exists).
    //   • on R2 (Moon/Earth) → R2 with the committed copy as local fallback.
    //   • otherwise          → straight from the repo.
    // R2 key mirrors the filename under a "terrain/" prefix.
    const fileName = body.heightMap.split("/").pop() as string
    const heightUrl = body.heightMapR2Only
      ? cdnAsset(`terrain/${fileName}`) // no fallback — the visibility gate ensures the CDN is up
      : body.heightMapOnR2
        ? cdnAsset(`terrain/${fileName}`, body.heightMap)
        : body.heightMap
    new TextureLoader().load(
      heightUrl,
      (tex) => {
        if (!alive) return
        tex.wrapS = RepeatWrapping
        tex.wrapT = ClampToEdgeWrapping
        // Height must be sampled linearly but WITHOUT mipmaps in the vertex
        // shader (vertex texture fetch has no derivatives) — keep it crisp.
        tex.minFilter = LinearFilter
        tex.magFilter = LinearFilter
        tex.generateMipmaps = false
        tex.needsUpdate = true
        setHeightTex(tex)
      },
      undefined,
      () => { /* height load failed → stay smooth, never crash */ if (alive) setHeightTex(null) },
    )
    return () => { alive = false }
  }, [body.heightMap, body.heightMapOnR2, body.heightMapR2Only])

  const uniforms = useMemo(
    () => ({
      uHeightMap: { value: null as Texture | null },
      uColorMap: { value: null as Texture | null },
      uElevMinM: { value: body.elevationMinM },
      uElevMaxM: { value: body.elevationMaxM },
      uRadiusUnits: { value: radiusUnits },
      uRadiusKm: { value: body.radiusKm },
      uExaggeration: { value: exaggeration },
      uSunDir: { value: new Vector3(1, 0.4, 0.6).normalize() },
      uHypsometric: { value: hypsometric },
      uSlopeShade: { value: slopeShade },
      uTexel: { value: new Vector2(1 / 2048, 1 / 1024) },
      uAmbient: { value: 0.32 },
    }),
    // Intentionally build once; live values are pushed in useFrame below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [body.id],
  )

  // Push live prop/texture values into the material each frame (cheap, avoids
  // rebuilding the shader when the slider moves).
  useFrame(() => {
    const m = matRef.current
    if (!m) return
    m.uniforms.uHeightMap.value = heightTex
    m.uniforms.uColorMap.value = colorTex
    m.uniforms.uExaggeration.value = exaggeration
    m.uniforms.uHypsometric.value = hypsometric
    m.uniforms.uSlopeShade.value = slopeShade
    m.uniforms.uRadiusUnits.value = radiusUnits
    const img = heightTex?.image as { width?: number; height?: number } | undefined
    if (img?.width && img?.height) {
      m.uniforms.uTexel.value.set(1 / img.width, 1 / img.height)
    }
  })

  return (
    <mesh>
      <sphereGeometry args={[radiusUnits, segments, segments / 2]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={terrainVertexShader}
        fragmentShader={terrainFragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  )
}
