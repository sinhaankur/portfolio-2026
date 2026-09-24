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

let cache: { at: number; mosaic: GibsMosaic } | null = null
const TTL = 1000 * 60 * 60 // 1 hr — GIBS publishes at most once per day

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** The whole-world level-0 tile URL for a given date. */
function urlForDate(date: string): string {
  return `${GIBS_4326}/${LAYER}/default/${date}/250m/0/0/0.jpg`
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

/**
 * The newest available global true-colour mosaic. Today's imagery can lag a few
 * hours, so we walk back up to `maxDaysBack` days and return the first that
 * resolves. Returns null if none do (offline / all pending).
 */
export async function fetchGibsMosaic(maxDaysBack = 4): Promise<GibsMosaic | null> {
  if (cache && Date.now() - cache.at < TTL) return cache.mosaic
  const now = Date.now()
  for (let i = 0; i <= maxDaysBack; i++) {
    const date = isoDay(new Date(now - i * 86_400_000))
    const url = urlForDate(date)
    if (await tileExists(url, 6000)) {
      const mosaic: GibsMosaic = { date, url, source: "NASA GIBS · VIIRS true colour" }
      cache = { at: Date.now(), mosaic }
      return mosaic
    }
  }
  return null
}
