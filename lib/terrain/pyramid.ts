/**
 * pyramid — client helpers for the Phase C quadtree DEM tile pyramid.
 *
 * The pyramid is baked by scripts/bake-terrain-pyramid.mjs and served from the
 * dedicated terrain-tiles repo over jsDelivr (heavy in tile count). This module is
 * pure math + fetch (no React/Three), mirroring lib/terrain/bodies.ts discipline:
 * the tile scheme, the camera-altitude → zoom mapping, and which tiles a lat/lon
 * window covers. The renderer (components/terrain/quadtree.tsx) uses these.
 *
 * Scheme (equirectangular, 2:1): at zoom z the world is 2^(z+1) × 2^z tiles.
 *   x: 0 … 2^(z+1)-1, east from lon -180°
 *   y: 0 … 2^z-1,     south from lat +90°
 *
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * https://github.com/sinhaankur/portfolio-2026
 */

// jsDelivr base for the terrain-tiles repo. Pinning @main is fine (jsDelivr caches
// with a short TTL); switch to a tag/commit for immutable caching once it settles.
const CDN_BASE = "https://cdn.jsdelivr.net/gh/sinhaankur/terrain-tiles@main/pyramid"

export type PyramidManifest = {
  body: string
  maxZoom: number
  tile: number
  scheme: string
  elevationMinM: number
  elevationMaxM: number
  attribution: string
}

/** Which baked pyramid backs a given terrain body id (some share a pyramid). */
export function pyramidKeyForBody(bodyId: string): string | null {
  if (bodyId === "earth" || bodyId === "earth-gebco") return "earth-gebco"
  return null // only Earth has a pyramid so far
}

export function manifestUrl(pyramidKey: string): string {
  return `${CDN_BASE}/${pyramidKey}/manifest.json`
}

export function tileUrl(pyramidKey: string, z: number, x: number, y: number): string {
  return `${CDN_BASE}/${pyramidKey}/${z}/${x}/${y}.png`
}

/** Fetch a pyramid's manifest (with a hard timeout). Null if unreachable. */
export async function fetchManifest(pyramidKey: string, ms = 7000): Promise<PyramidManifest | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    const r = await fetch(manifestUrl(pyramidKey), { signal: ctrl.signal })
    if (!r.ok) return null
    return (await r.json()) as PyramidManifest
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** Tiles across at zoom z (x dimension); y dimension is half this. */
export const tilesX = (z: number) => 2 ** (z + 1)
export const tilesY = (z: number) => 2 ** z

/** Longitude (deg, -180..180) → fractional tile X at zoom z. */
export function lonToTileX(lonDeg: number, z: number): number {
  return ((lonDeg + 180) / 360) * tilesX(z)
}
/** Latitude (deg, +90..-90) → fractional tile Y at zoom z (0 at +90, south-increasing). */
export function latToTileY(latDeg: number, z: number): number {
  return ((90 - latDeg) / 180) * tilesY(z)
}
/** Tile X index → its west-edge longitude (deg). */
export function tileXToLonW(x: number, z: number): number {
  return (x / tilesX(z)) * 360 - 180
}
/** Tile Y index → its north-edge latitude (deg). */
export function tileYToLatN(y: number, z: number): number {
  return 90 - (y / tilesY(z)) * 180
}

/**
 * Camera altitude → target pyramid zoom. `distUnits` is the camera distance from
 * the body centre in scene units; `radiusUnits` the body's rendered radius. Far
 * out → z0 (whole globe); as it approaches the surface, step up toward maxZoom.
 * The thresholds are geometric: each zoom roughly halves the visible span.
 */
export function zoomForDistance(distUnits: number, radiusUnits: number, maxZoom: number): number {
  const altitude = Math.max(0.0001, distUnits - radiusUnits) // height above surface
  const ratio = altitude / radiusUnits // 0 = on surface, large = far
  // ratio ≳ 1 → z0; each halving of ratio adds a zoom level.
  const z = Math.floor(Math.log2(1 / Math.max(0.03, ratio))) + 1
  return Math.max(0, Math.min(maxZoom, z))
}

export type TileId = { z: number; x: number; y: number }

/**
 * The tiles covering a lat/lon window at zoom z, capped to `maxTiles` so a wide
 * view can't request the world. Wraps X (longitude is cyclic); clamps Y to poles.
 */
export function tilesForWindow(
  z: number,
  lonWDeg: number,
  lonEDeg: number,
  latSDeg: number,
  latNDeg: number,
  maxTiles = 16,
): TileId[] {
  const nx = tilesX(z)
  const ny = tilesY(z)
  const x0 = Math.floor(lonToTileX(lonWDeg, z))
  const x1 = Math.floor(lonToTileX(lonEDeg, z))
  const y0 = Math.max(0, Math.floor(latToTileY(latNDeg, z))) // north → smaller y
  const y1 = Math.min(ny - 1, Math.floor(latToTileY(latSDeg, z)))
  const out: TileId[] = []
  const xr = x1 - x0
  for (let yy = y0; yy <= y1; yy++) {
    for (let dx = 0; dx <= xr; dx++) {
      const x = ((x0 + dx) % nx + nx) % nx // wrap longitude
      out.push({ z, x, y: yy })
      if (out.length >= maxTiles) return out
    }
  }
  return out
}
