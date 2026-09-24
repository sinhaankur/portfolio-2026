/**
 * gibs.ts — NASA GIBS (Global Imagery Browse Services): the whole Earth as a
 * single daily true-colour mosaic, keyless and CORS-open.
 *
 * Source: NASA's Global Imagery Browse Services serves near-daily global imagery
 * from MODIS/VIIRS via a standard WMTS pyramid. Unlike the geostationary GOES /
 * Himawari disks (one hemisphere, live limb), GIBS gives the ENTIRE Earth flat,
 * for essentially any recent date — built each day from polar-orbiter swaths.
 *
 * We use the EPSG:4326 level-0 tile, which is the whole world in a single 2:1
 * equirectangular JPEG (~55 KB) — ideal for a panel preview without stitching a
 * tile grid. The endpoint sends `Access-Control-Allow-Origin: *`, so it loads
 * directly from the static site (and pixels are readable, unlike Himawari).
 *
 * Fidelity: real, dated NASA imagery relayed as-is, credited. Fails soft — we
 * probe recent dates and return the newest that resolves; null if none do.
 *
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine. Others may reference this work.
 * https://github.com/sinhaankur/portfolio-2026
 */

const GIBS_4326 = "https://gibs.earthdata.nasa.gov/wmts/epsg4326/best"
// VIIRS (NOAA-20/SNPP) corrected-reflectance true colour — the standard daily
// global true-colour product.
const LAYER = "VIIRS_SNPP_CorrectedReflectance_TrueColor"

export type GibsMosaic = {
  /** ISO date (YYYY-MM-DD) of the mosaic that resolved. */
  date: string
  /** Whole-world equirectangular JPEG URL, ready for <img src> or a texture. */
  url: string
  source: string
}

const TTL = 1000 * 60 * 60 // 1 hr — GIBS publishes at most once per day

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10)
}

// A GIBS raster layer we can pull the whole world for as a single L0 tile.
// (Only raster layers work in an <img>/texture; vector layers like the fires
// thermal-anomaly product are .mvt and are intentionally not listed here.)
type GibsLayer = {
  id: string
  matrix: string // TileMatrixSet, e.g. "250m", "1km"
  ext: "jpg" | "png"
  source: string
}

const LAYERS: Record<string, GibsLayer> = {
  trueColor: { id: LAYER, matrix: "250m", ext: "jpg", source: "NASA GIBS · VIIRS true colour" },
  landTemp: {
    id: "MODIS_Terra_Land_Surface_Temp_Day",
    matrix: "1km",
    ext: "png",
    source: "NASA GIBS · MODIS land-surface temperature (day)",
  },
}

/** The whole-world level-0 tile URL for a layer on a given date. */
function urlForLayer(layer: GibsLayer, date: string): string {
  return `${GIBS_4326}/${layer.id}/default/${date}/${layer.matrix}/0/0/0.${layer.ext}`
}

/** HEAD-style existence probe with a hard timeout. */
async function tileExists(url: string, ms: number): Promise<boolean> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    // Some CDNs don't honour HEAD; a GET we immediately discard is safe + small.
    const r = await fetch(url, { signal: ctrl.signal })
    return r.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

const layerCache = new Map<string, { at: number; mosaic: GibsMosaic }>()

/**
 * The newest available whole-world mosaic for a named GIBS layer. Imagery can lag
 * a few hours/days, so we walk back up to `maxDaysBack` days and return the first
 * that resolves. Returns null if none do (offline / all pending).
 */
async function fetchLayer(key: keyof typeof LAYERS, maxDaysBack: number): Promise<GibsMosaic | null> {
  const cached = layerCache.get(key)
  if (cached && Date.now() - cached.at < TTL) return cached.mosaic
  const layer = LAYERS[key]
  const now = Date.now()
  for (let i = 0; i <= maxDaysBack; i++) {
    const date = isoDay(new Date(now - i * 86_400_000))
    const url = urlForLayer(layer, date)
    if (await tileExists(url, 6000)) {
      const mosaic: GibsMosaic = { date, url, source: layer.source }
      layerCache.set(key, { at: Date.now(), mosaic })
      return mosaic
    }
  }
  return null
}

/** Newest daily whole-Earth true-colour mosaic (VIIRS). */
export function fetchGibsMosaic(maxDaysBack = 4): Promise<GibsMosaic | null> {
  return fetchLayer("trueColor", maxDaysBack)
}

/**
 * Newest daily whole-Earth land-surface temperature map (MODIS). A real
 * NASA Earth-observation layer — the "how hot is the ground" view that seeds the
 * broader Earth-data theme. LST is measured only over cloud-free land, so oceans
 * + cloudy areas read as gaps; that's honest, not missing data.
 */
export function fetchGibsLandTemp(maxDaysBack = 6): Promise<GibsMosaic | null> {
  return fetchLayer("landTemp", maxDaysBack)
}
