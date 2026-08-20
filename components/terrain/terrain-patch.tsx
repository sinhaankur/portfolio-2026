"use client"

/**
 * Deep-zoom — the Phase 3 "descend into the terrain" system.
 *
 * As the camera zooms toward the globe, a single high-detail PATCH mesh is spawned
 * over the surface region the camera is looking at. The patch is a finely
 * tessellated lat/lon grid (much denser than the whole-globe sphere) displaced by
 * the SAME real height map — so zooming into Valles Marineris or a lunar crater
 * resolves the actual measured relief, not a smooth interpolation of the globe.
 *
 * Approach (per the design): ONE local patch, not a full quadtree. Robust and
 * incremental — the patch follows where you look, tessellates finely, and blends
 * into the globe at its edges. A regional (higher-res) DEM tile can later replace
 * the global-map sampling inside the patch without touching this control flow.
 *
 * `DeepZoomController` lives inside the Canvas (needs useFrame/useThree). It:
 *   1. maps camera distance → a 0..1 zoom depth and reports it to the HUD,
 *   2. once past a threshold, finds the surface lat/lon under the camera,
 *   3. renders <TerrainPatch> there and keeps it centred as you pan/rotate.
 */

import { useRef, useState, useMemo, useEffect } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import {
  ShaderMaterial,
  TextureLoader,
  LinearFilter,
  RepeatWrapping,
  ClampToEdgeWrapping,
  Vector2,
  Vector3,
  Vector4,
  Texture,
} from "three"
import { terrainFragmentShader } from "./terrain-shaders"
import type { TerrainBody as TerrainBodyData } from "@/lib/terrain/bodies"
import { cdnAsset } from "@/lib/asset-cdn"

// Zoom depth band. DEPTH_FAR matches maxDistance; the NEAR end and patch-spawn
// threshold are derived per-body from the actual minDistance (which is dynamic —
// it depends on the exaggerated peak height) so the patch always engages before
// you hit the floor, on every body.
const DEPTH_FAR = 8 // full orbit (matches maxDistance)

/** The patch covers this angular half-size (radians) of the surface, shrinking
 *  as you zoom so tessellation concentrates where you look. */
function patchHalfAngle(camDist: number, near: number, spawn: number): number {
  const t = (camDist - near) / Math.max(0.001, spawn - near) // 0 near … 1 at spawn
  // Shrink hard as you descend so the fixed vertex budget concentrates on an ever
  // smaller patch → finer effective detail the deeper you go (1.2°..22°).
  const deg = 1.2 + 20.8 * Math.min(1, Math.max(0, t))
  return (deg * Math.PI) / 180
}

/**
 * Vertex shader for the patch: a flat grid whose UV spans [lonC±half, latC±half].
 * Each vertex is placed on the sphere at its lat/lon and displaced by the height
 * map, matching the globe's displacement exactly so the patch sits flush on it.
 */
const patchVertexShader = /* glsl */ `
uniform sampler2D uHeightMap;   // global equirectangular height map
uniform sampler2D uRegionMap;   // high-res regional tile (when uUseRegion=1)
uniform float uUseRegion;       // 0 = global map, 1 = regional tile
uniform vec4 uRegionBounds;     // (lonW, lonE, latS, latN) in radians
uniform float uElevMinM;
uniform float uElevMaxM;
uniform float uRadiusUnits;
uniform float uRadiusKm;
uniform float uExaggeration;
uniform float uLatC;      // patch centre latitude (rad)
uniform float uLonC;      // patch centre longitude (rad)
uniform float uHalf;      // angular half-size (rad)

varying vec2 vUv;         // equirectangular UV into the GLOBAL map (for colour)
varying float vElevM;
varying float vNormAmt;
varying vec3 vWorldNormal;

const float PI = 3.141592653589793;

void main() {
  // position.xy comes in as a flat grid in [-1, 1]; map to lat/lon around centre.
  float lat = uLatC + position.y * uHalf;
  float lon = uLonC + position.x * uHalf;

  // Global equirectangular UV (used for colour, and for height off-region).
  float u = lon / (2.0 * PI) + 0.5;
  float v = lat / PI + 0.5;
  vUv = vec2(u, v);

  // Height: from the high-res regional tile if active + within its bounds,
  // else the global map. The tile spans [lonW,lonE]×[latS,latN], remapped to 0..1.
  float h;
  if (uUseRegion > 0.5) {
    float ru = (lon - uRegionBounds.x) / (uRegionBounds.y - uRegionBounds.x);
    float rv = (lat - uRegionBounds.z) / (uRegionBounds.w - uRegionBounds.z);
    // Inside the tile → sample it; outside → fall back to the global map so the
    // patch edges blend seamlessly into the surrounding globe.
    if (ru >= 0.0 && ru <= 1.0 && rv >= 0.0 && rv <= 1.0) {
      h = texture2D(uRegionMap, vec2(ru, rv)).r;
    } else {
      h = texture2D(uHeightMap, vec2(u, v)).r;
    }
  } else {
    h = texture2D(uHeightMap, vec2(u, v)).r;
  }
  vNormAmt = h;
  float elevM = mix(uElevMinM, uElevMaxM, h);
  vElevM = elevM;

  float unitsPerMetre = uRadiusUnits / (uRadiusKm * 1000.0);
  float r = uRadiusUnits + elevM * unitsPerMetre * uExaggeration;

  // lat/lon → sphere direction (matches lib/terrain latLonToUnitVec + globe).
  float cosLat = cos(lat);
  vec3 dir = vec3(cosLat * cos(lon), sin(lat), cosLat * sin(lon));
  vec3 pos = dir * r;

  vWorldNormal = normalize(mat3(modelMatrix) * dir);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`

interface PatchProps {
  body: TerrainBodyData
  radiusUnits: number
  exaggeration: number
  hypsometric: number
  slopeShade: number
  latC: number
  lonC: number
  half: number
  heightTex: Texture | null
  colorTex: Texture | null
  /** High-res regional tile + its bounds (radians), when the patch is over one. */
  regionTex: Texture | null
  regionBounds: [number, number, number, number] | null
  /** Grid resolution (verts per side). */
  grid?: number
}

function TerrainPatch({
  body,
  radiusUnits,
  exaggeration,
  hypsometric,
  slopeShade,
  latC,
  lonC,
  half,
  heightTex,
  colorTex,
  regionTex,
  regionBounds,
  grid = 384,
}: PatchProps) {
  const matRef = useRef<ShaderMaterial>(null)

  const uniforms = useMemo(
    () => ({
      uHeightMap: { value: null as Texture | null },
      uRegionMap: { value: null as Texture | null },
      uUseRegion: { value: 0 },
      uRegionBounds: { value: new Vector4(0, 0, 0, 0) },
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
      uLatC: { value: latC },
      uLonC: { value: lonC },
      uHalf: { value: half },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [body.id],
  )

  useFrame(() => {
    const m = matRef.current
    if (!m) return
    m.uniforms.uHeightMap.value = heightTex
    m.uniforms.uColorMap.value = colorTex
    m.uniforms.uExaggeration.value = exaggeration
    m.uniforms.uHypsometric.value = hypsometric
    m.uniforms.uSlopeShade.value = slopeShade
    m.uniforms.uLatC.value = latC
    m.uniforms.uLonC.value = lonC
    m.uniforms.uHalf.value = half
    // Regional tile: active only when we have both the texture and its bounds.
    const useRegion = regionTex != null && regionBounds != null
    m.uniforms.uUseRegion.value = useRegion ? 1 : 0
    m.uniforms.uRegionMap.value = regionTex
    if (regionBounds) m.uniforms.uRegionBounds.value.set(...regionBounds)
    const img = heightTex?.image as { width?: number; height?: number } | undefined
    if (img?.width && img?.height) m.uniforms.uTexel.value.set(1 / img.width, 1 / img.height)
  })

  return (
    <mesh renderOrder={1}>
      {/* A flat grid in the [-1,1] plane; the vertex shader wraps it onto the
          sphere. planeGeometry gives us grid×grid verts cheaply. */}
      <planeGeometry args={[2, 2, grid, grid]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={patchVertexShader}
        fragmentShader={terrainFragmentShader}
        uniforms={uniforms}
        polygonOffset
        polygonOffsetFactor={-1}
      />
    </mesh>
  )
}

interface ControllerProps {
  body: TerrainBodyData
  radiusUnits: number
  exaggeration: number
  hypsometric: number
  slopeShade: number
  /** The camera's minimum distance (dynamic, from the engine). Patch thresholds
   *  derive from it so the patch always engages before the floor. */
  minDistance: number
  onDepthChange: (depth: number) => void
  /** Reports the high-res region the camera is over (or null). */
  onRegionChange?: (regionName: string | null) => void
}

export function DeepZoomController({
  body,
  radiusUnits,
  exaggeration,
  hypsometric,
  slopeShade,
  minDistance,
  onDepthChange,
  onRegionChange,
}: ControllerProps) {
  const { camera } = useThree()
  const [heightTex, setHeightTex] = useState<Texture | null>(null)
  const [colorTex, setColorTex] = useState<Texture | null>(null)
  // Loaded regional tiles keyed by region id, + which region is active now.
  const regionTexes = useRef<Record<string, Texture>>({})
  const [activeRegionId, setActiveRegionId] = useState<string | null>(null)
  // Patch placement, updated in useFrame; kept in refs to avoid per-frame React.
  const [patchOn, setPatchOn] = useState(false)
  const latC = useRef(0)
  const lonC = useRef(0)
  const half = useRef(0.3)
  const lastDepth = useRef(-1)

  // Load the same maps the globe uses (so the patch matches exactly).
  useEffect(() => {
    let alive = true
    new TextureLoader().load(body.colorMap, (t) => {
      if (!alive) return
      t.wrapS = RepeatWrapping; t.wrapT = ClampToEdgeWrapping
      t.minFilter = LinearFilter; t.magFilter = LinearFilter
      setColorTex(t)
    })
    if (body.heightMap) {
      const fileName = body.heightMap.split("/").pop() as string
      const url = body.heightMapR2Only
        ? cdnAsset(`terrain/${fileName}`)
        : body.heightMapOnR2
          ? cdnAsset(`terrain/${fileName}`, body.heightMap)
          : body.heightMap
      new TextureLoader().load(url, (t) => {
        if (!alive) return
        t.wrapS = RepeatWrapping; t.wrapT = ClampToEdgeWrapping
        t.minFilter = LinearFilter; t.magFilter = LinearFilter
        t.generateMipmaps = false
        setHeightTex(t)
      }, undefined, () => { if (alive) setHeightTex(null) })
    } else {
      setHeightTex(null)
    }
    return () => { alive = false }
  }, [body.id, body.colorMap, body.heightMap, body.heightMapOnR2, body.heightMapR2Only])

  // Load the body's high-res regional tiles (once per body). Kept in a ref map so
  // switching over a region just flips activeRegionId without reloading.
  useEffect(() => {
    let alive = true
    regionTexes.current = {}
    setActiveRegionId(null)
    for (const region of body.regions ?? []) {
      const fileName = region.tile.split("/").pop() as string
      const url = region.tileOnR2 ? cdnAsset(`terrain/${fileName}`) : region.tile
      new TextureLoader().load(url, (t) => {
        if (!alive) return
        t.wrapS = ClampToEdgeWrapping; t.wrapT = ClampToEdgeWrapping
        t.minFilter = LinearFilter; t.magFilter = LinearFilter
        t.generateMipmaps = false
        regionTexes.current[region.id] = t
      })
    }
    return () => { alive = false }
  }, [body.id, body.regions])

  const tmp = useMemo(() => new Vector3(), [])

  useFrame(() => {
    const dist = camera.position.length()
    // Patch engages within a band above the floor; spawn threshold scales with
    // how tall the terrain floor sits (bodies with big exaggerated peaks start
    // their patch further out).
    const near = minDistance
    const spawn = minDistance + radiusUnits * 0.9

    // Zoom depth 0 (far) … 1 (near/floor) for the HUD readout.
    const depth = Math.min(1, Math.max(0, (DEPTH_FAR - dist) / (DEPTH_FAR - near)))
    if (Math.abs(depth - lastDepth.current) > 0.005) {
      lastDepth.current = depth
      onDepthChange(depth)
    }

    const shouldPatch = dist < spawn && heightTex != null
    if (shouldPatch) {
      // The surface point under the camera = camera direction from origin.
      tmp.copy(camera.position).normalize()
      // dir → lat/lon (inverse of latLonToUnitVec: x=cosLat cosLon, y=sinLat, z=cosLat sinLon)
      const latRad = Math.asin(Math.max(-1, Math.min(1, tmp.y)))
      const lonRad = Math.atan2(tmp.z, tmp.x)
      latC.current = latRad
      lonC.current = lonRad
      half.current = patchHalfAngle(dist, near, spawn)

      // Which region (if any) is the camera centred over? Bounds are in degrees.
      const latDeg = (latRad * 180) / Math.PI
      const lonDeg = (lonRad * 180) / Math.PI
      let found: string | null = null
      for (const r of body.regions ?? []) {
        if (
          regionTexes.current[r.id] &&
          lonDeg >= r.lonW && lonDeg <= r.lonE &&
          latDeg >= r.latS && latDeg <= r.latN
        ) { found = r.id; break }
      }
      if (found !== activeRegionId) {
        setActiveRegionId(found)
        const name = found ? (body.regions?.find((r) => r.id === found)?.name ?? null) : null
        onRegionChange?.(name)
      }
    }
    if (shouldPatch !== patchOn) {
      setPatchOn(shouldPatch)
      if (!shouldPatch && activeRegionId) { setActiveRegionId(null); onRegionChange?.(null) }
    }
  })

  if (!patchOn || !heightTex) return null

  const activeRegion = body.regions?.find((r) => r.id === activeRegionId) ?? null
  const regionTex = activeRegion ? regionTexes.current[activeRegion.id] ?? null : null
  const regionBounds: [number, number, number, number] | null = activeRegion
    ? [
        (activeRegion.lonW * Math.PI) / 180,
        (activeRegion.lonE * Math.PI) / 180,
        (activeRegion.latS * Math.PI) / 180,
        (activeRegion.latN * Math.PI) / 180,
      ]
    : null

  return (
    <TerrainPatch
      body={body}
      radiusUnits={radiusUnits}
      exaggeration={exaggeration}
      hypsometric={hypsometric}
      slopeShade={slopeShade}
      latC={latC.current}
      lonC={lonC.current}
      half={half.current}
      heightTex={heightTex}
      colorTex={colorTex}
      regionTex={regionTex}
      regionBounds={regionBounds}
    />
  )
}
