"use client"

/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine. Others may reference this work.
 * https://github.com/sinhaankur/portfolio-2026
 *
 * Quadtree LOD — the Phase C "descend anywhere with continuous detail" engine.
 *
 * As the camera approaches the surface, this loads the DEM tiles that cover the
 * view at a zoom matched to the camera altitude (from the terrain-tiles pyramid on
 * jsDelivr) and renders each as a finely-tessellated grid displaced by its own
 * real 16-bit elevation — so the surface stays sharp ANYWHERE on the body, not
 * just the hand-picked regions. Coarse tiles far out, fine tiles up close.
 *
 * Unlike the single-patch DeepZoomController (which follows the camera with ONE
 * patch sampling the global map), this pulls the actual pyramid tiles, so max-zoom
 * detail is bounded by the pyramid depth, not one 2K map. It complements the patch:
 * we run it for bodies that HAVE a pyramid (Earth), and leave others on the patch.
 *
 * Keyless + CORS-open (jsDelivr). Fails soft: if a tile or the manifest doesn't
 * load, the globe's own coarse map still shows through underneath.
 */

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { ShaderMaterial, TextureLoader, LinearFilter, ClampToEdgeWrapping, Vector2, Vector3, Vector4, Texture } from "three"
import { terrainFragmentShader } from "./terrain-shaders"
import type { TerrainBody } from "@/lib/terrain/bodies"
import {
  pyramidKeyForBody,
  fetchManifest,
  tileUrl,
  tileXToLonW,
  tileYToLatN,
  tilesX,
  tilesY,
  zoomForDistance,
  tilesForWindow,
  type PyramidManifest,
  type TileId,
} from "@/lib/terrain/pyramid"

// A tile mesh spans its own [lonW,lonE]×[latN,latS] window. The vertex shader wraps
// the flat grid onto the sphere and displaces by the tile's own height map. This is
// the patch vertex shader specialised to fixed per-tile bounds (no region branch).
const tileVertexShader = /* glsl */ `
uniform sampler2D uHeightMap;
uniform float uElevMinM;
uniform float uElevMaxM;
uniform float uRadiusUnits;
uniform float uRadiusKm;
uniform float uExaggeration;
uniform float uLonW; uniform float uLonE;
uniform float uLatN; uniform float uLatS;

varying vec2 vUv;
varying float vElevM;
varying float vNormAmt;
varying vec3 vWorldNormal;
varying vec2 vLonLat;

const float PI = 3.141592653589793;

void main() {
  // position.xy is a flat grid in [-1,1]; map to this tile's lon/lat window.
  float fx = position.x * 0.5 + 0.5;   // 0..1 west→east
  float fy = position.y * 0.5 + 0.5;   // 0..1 south→north
  float lon = mix(uLonW, uLonE, fx);
  float lat = mix(uLatS, uLatN, fy);

  // Tile-local UV (0..1). Height map v runs top(north)→bottom(south), so flip.
  vUv = vec2(fx, 1.0 - fy);
  vLonLat = vec2(lon, lat);

  float h = texture2D(uHeightMap, vUv).r;
  vNormAmt = h;
  float elevM = mix(uElevMinM, uElevMaxM, h);
  vElevM = elevM;

  float unitsPerMetre = uRadiusUnits / (uRadiusKm * 1000.0);
  float r = uRadiusUnits + elevM * unitsPerMetre * uExaggeration;

  float latR = lat * PI / 180.0;
  float lonR = lon * PI / 180.0;
  float cosLat = cos(latR);
  vec3 dir = vec3(cosLat * cos(lonR), sin(latR), cosLat * sin(lonR));
  vWorldNormal = normalize(mat3(modelMatrix) * dir);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(dir * r, 1.0);
}
`

interface TileMeshProps {
  body: TerrainBody
  radiusUnits: number
  exaggeration: number
  hypsometric: number
  slopeShade: number
  tex: Texture
  lonW: number
  lonE: number
  latN: number
  latS: number
  grid?: number
}

function TileMesh({ body, radiusUnits, exaggeration, hypsometric, slopeShade, tex, lonW, lonE, latN, latS, grid = 96 }: TileMeshProps) {
  const matRef = useRef<ShaderMaterial>(null)
  const uniforms = useMemo(
    () => ({
      uHeightMap: { value: tex },
      uColorMap: { value: tex }, // colour comes from the DEM via hypsometric/slope; tile has no separate imagery
      uElevMinM: { value: body.elevationMinM },
      uElevMaxM: { value: body.elevationMaxM },
      uRadiusUnits: { value: radiusUnits },
      uRadiusKm: { value: body.radiusKm },
      uExaggeration: { value: exaggeration },
      uSunDir: { value: new Vector3(1, 0.4, 0.6).normalize() },
      uHypsometric: { value: hypsometric },
      uSlopeShade: { value: slopeShade },
      uTexel: { value: new Vector2(1 / 256, 1 / 256) },
      uAmbient: { value: 0.32 },
      uLonW: { value: lonW }, uLonE: { value: lonE },
      uLatN: { value: latN }, uLatS: { value: latS },
      // Imagery-overlay uniforms the shared fragment shader declares — inert here.
      uColorTile: { value: null as Texture | null },
      uUseColorTile: { value: 0 },
      uColorTileBounds: { value: new Vector4(0, 0, 0, 0) },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tex, lonW, lonE, latN, latS],
  )

  useFrame(() => {
    const m = matRef.current
    if (!m) return
    m.uniforms.uExaggeration.value = exaggeration
    m.uniforms.uHypsometric.value = hypsometric
    m.uniforms.uSlopeShade.value = slopeShade
  })

  return (
    <mesh renderOrder={2}>
      <planeGeometry args={[2, 2, grid, grid]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={tileVertexShader}
        fragmentShader={terrainFragmentShader}
        uniforms={uniforms}
        polygonOffset
        polygonOffsetFactor={-2}
      />
    </mesh>
  )
}

interface ControllerProps {
  body: TerrainBody
  radiusUnits: number
  exaggeration: number
  hypsometric: number
  slopeShade: number
  /** Reports the active pyramid zoom (or -1 when inactive), for the HUD. */
  onZoom?: (z: number) => void
}

const tileKey = (t: TileId) => `${t.z}/${t.x}/${t.y}`

export function QuadtreeController({ body, radiusUnits, exaggeration, hypsometric, slopeShade, onZoom }: ControllerProps) {
  const { camera } = useThree()
  const pyramidKey = pyramidKeyForBody(body.id)
  const [manifest, setManifest] = useState<PyramidManifest | null>(null)
  // Loaded tile textures, keyed by "z/x/y". Kept in a ref (no per-frame React).
  const texCache = useRef<Map<string, Texture>>(new Map())
  const loading = useRef<Set<string>>(new Set())
  // The tiles to render right now (state → triggers re-render when the set changes).
  const [active, setActive] = useState<TileId[]>([])
  const activeKeys = useRef<string>("")
  const lastZoom = useRef(-1)

  // Load the manifest once per body (only for bodies that have a pyramid).
  useEffect(() => {
    let alive = true
    setManifest(null)
    setActive([])
    texCache.current.forEach((t) => t.dispose())
    texCache.current.clear()
    loading.current.clear()
    activeKeys.current = ""
    if (!pyramidKey) { onZoom?.(-1); return }
    fetchManifest(pyramidKey).then((m) => { if (alive) setManifest(m) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body.id, pyramidKey])

  const tmp = useMemo(() => new Vector3(), [])

  useFrame(() => {
    if (!manifest || !pyramidKey) return
    const dist = camera.position.length()
    const z = zoomForDistance(dist, radiusUnits, manifest.maxZoom)
    if (z !== lastZoom.current) { lastZoom.current = z; onZoom?.(z) }
    // Below z1 the globe's own map is enough — don't overlay whole-world tiles.
    if (z < 1) {
      if (activeKeys.current !== "") { activeKeys.current = ""; setActive([]) }
      return
    }

    // Surface point under the camera → a lat/lon window sized to the visible span
    // at this zoom (a few tiles across, centred there).
    tmp.copy(camera.position).normalize()
    const latC = (Math.asin(Math.max(-1, Math.min(1, tmp.y))) * 180) / Math.PI
    const lonC = (Math.atan2(tmp.z, tmp.x) * 180) / Math.PI
    const spanDeg = 360 / tilesX(z) * 1.5 // ~1.5 tiles of longitude each way
    const latSpan = 180 / tilesY(z) * 1.5
    const want = tilesForWindow(z, lonC - spanDeg, lonC + spanDeg, latC - latSpan, latC + latSpan, 12)

    const key = want.map(tileKey).join(",")
    if (key === activeKeys.current) return
    activeKeys.current = key

    // Kick off loads for any not-yet-cached tiles; render whatever IS cached now.
    for (const t of want) {
      const k = tileKey(t)
      if (texCache.current.has(k) || loading.current.has(k)) continue
      loading.current.add(k)
      new TextureLoader().load(
        tileUrl(pyramidKey, t.z, t.x, t.y),
        (tex) => {
          tex.wrapS = ClampToEdgeWrapping; tex.wrapT = ClampToEdgeWrapping
          tex.minFilter = LinearFilter; tex.magFilter = LinearFilter
          tex.generateMipmaps = false
          texCache.current.set(k, tex)
          loading.current.delete(k)
          // Nudge a re-render if this tile is still wanted.
          if (activeKeys.current.includes(k)) setActive((prev) => [...prev])
        },
        undefined,
        () => { loading.current.delete(k) }, // tile 404/na → globe shows through
      )
    }
    setActive(want)
  })

  // Dispose textures on unmount.
  useEffect(() => () => { texCache.current.forEach((t) => t.dispose()); texCache.current.clear() }, [])

  if (!manifest || !pyramidKey) return null

  return (
    <>
      {active.map((t) => {
        const tex = texCache.current.get(tileKey(t))
        if (!tex) return null
        const lonW = tileXToLonW(t.x, t.z)
        const lonE = tileXToLonW(t.x + 1, t.z)
        const latN = tileYToLatN(t.y, t.z)
        const latS = tileYToLatN(t.y + 1, t.z)
        return (
          <TileMesh
            key={tileKey(t)}
            body={body}
            radiusUnits={radiusUnits}
            exaggeration={exaggeration}
            hypsometric={hypsometric}
            slopeShade={slopeShade}
            tex={tex}
            lonW={lonW}
            lonE={lonE}
            latN={latN}
            latS={latS}
          />
        )
      })}
    </>
  )
}
