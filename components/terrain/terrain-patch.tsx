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
  const deg = 4 + 18 * Math.min(1, Math.max(0, t)) // 4°(close) … 22°(far)
  return (deg * Math.PI) / 180
}

/**
 * Vertex shader for the patch: a flat grid whose UV spans [lonC±half, latC±half].
 * Each vertex is placed on the sphere at its lat/lon and displaced by the height
 * map, matching the globe's displacement exactly so the patch sits flush on it.
 */
const patchVertexShader = /* glsl */ `
uniform sampler2D uHeightMap;
uniform float uElevMinM;
uniform float uElevMaxM;
uniform float uRadiusUnits;
uniform float uRadiusKm;
uniform float uExaggeration;
uniform float uLatC;      // patch centre latitude (rad)
uniform float uLonC;      // patch centre longitude (rad)
uniform float uHalf;      // angular half-size (rad)

varying vec2 vUv;         // equirectangular UV into the global map (for colour)
varying float vElevM;
varying float vNormAmt;
varying vec3 vWorldNormal;

const float PI = 3.141592653589793;

void main() {
  // position.xy comes in as a flat grid in [-1, 1]; map to lat/lon around centre.
  float lat = uLatC + position.y * uHalf;
  float lon = uLonC + position.x * uHalf;

  // Equirectangular UV so both patch and globe sample the SAME texel.
  float u = lon / (2.0 * PI) + 0.5;
  float v = lat / PI + 0.5;
  vUv = vec2(u, v);

  float h = texture2D(uHeightMap, vec2(u, v)).r;
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
  grid = 256,
}: PatchProps) {
  const matRef = useRef<ShaderMaterial>(null)

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
}

export function DeepZoomController({
  body,
  radiusUnits,
  exaggeration,
  hypsometric,
  slopeShade,
  minDistance,
  onDepthChange,
}: ControllerProps) {
  const { camera } = useThree()
  const [heightTex, setHeightTex] = useState<Texture | null>(null)
  const [colorTex, setColorTex] = useState<Texture | null>(null)
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
      latC.current = Math.asin(Math.max(-1, Math.min(1, tmp.y)))
      lonC.current = Math.atan2(tmp.z, tmp.x)
      half.current = patchHalfAngle(dist, near, spawn)
    }
    if (shouldPatch !== patchOn) setPatchOn(shouldPatch)
  })

  if (!patchOn || !heightTex) return null
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
    />
  )
}
