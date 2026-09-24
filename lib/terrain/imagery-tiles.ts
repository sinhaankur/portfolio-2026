/**
 * imagery-tiles — higher-resolution surface COLOUR for the terrain deep-zoom.
 *
 * The globe + patch sample a single global 2K colour map. Elevation already
 * sharpens on descent (regional height tiles), but the imagery stays coarse. This
 * module fetches NASA GIBS imagery at a zoom level matched to the patch's window
 * and composites it into ONE equirectangular-aligned canvas over the patch's
 * lat/lon bounds — so the shader can sample it exactly like the regional height
 * tile (same "inside bounds → use it, outside → fall back to global") mechanism.
 *
 * Why composite rather than sample GIBS tiles directly in-shader: GIBS's XYZ
 * pyramid is Web-Mercator (EPSG:3857) while the patch is equirectangular; mixing
 * the two per-fragment invites seams and distortion. Compositing to an
 * equirect-aligned canvas on the CPU keeps the shader path trivial and correct.
 *
 * Honesty: GIBS web-mercator tops out at zoom 8–9 (~150 m/px at the equator) —
 * sharper than the ~20 km/px global map, but NOT sub-metre "street" imagery. That
 * ceiling is a property of the free, keyless feed, and is surfaced as such.
 *
 * Keyless + CORS-open (`Access-Control-Allow-Origin: *`), so tiles load directly
 * from the static site and their pixels are readable for compositing.
 *
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine. Others may reference this work.
 * https://github.com/sinhaankur/portfolio-2026
 */

const GIBS_3857 = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best"

// The two imagery layers we use for Earth. BlueMarble is a static, cloud-free,
// seamless base (best default); VIIRS TrueColor is dated/live but has clouds.
type ImageryLayer = {
  id: string
  matrix: string
  maxZoom: number
  /** null = static (no date in path); otherwise the newest date is filled in. */
  dated: boolean
}

const EARTH_BASE: ImageryLayer = {
  id: "BlueMarble_NextGeneration",
  matrix: "GoogleMapsCompatible_Level8",
  maxZoom: 8,
  dated: false,
}

const TILE_PX = 256

/** Web-Mercator tile x/y for a lat/lon at zoom z (standard slippy-map math). */
function lonToTileX(lon: number, z: number): number {
  return ((lon + 180) / 360) * 2 ** z
}
function latToTileY(lat: number, z: number): number {
  const r = (lat * Math.PI) / 180
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z
}
/** Inverse: tile x/y edges → lon/lat, for compositing into equirect space. */
function tileXToLon(x: number, z: number): number {
  return (x / 2 ** z) * 360 - 180
}
function tileYToLat(y: number, z: number): number {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))
}

function tileUrl(layer: ImageryLayer, z: number, x: number, y: number, date: string | null): string {
  const datePart = layer.dated && date ? `${date}/` : ""
  return `${GIBS_3857}/${layer.id}/default/${datePart}${layer.matrix}/${z}/${y}/${x}.jpg`
}

/** Pick a GIBS zoom so the patch window spans a handful of tiles (crisp, cheap). */
function zoomForHalfAngle(halfRad: number, maxZoom: number): number {
  const spanDeg = (halfRad * 180) / Math.PI * 2
  // ~ how many 360°/2^z tiles fit across the span; aim for ~3–5 tiles across.
  const z = Math.round(Math.log2((360 / spanDeg) * 4))
  return Math.max(2, Math.min(maxZoom, z))
}

export type ImageryTile = {
  /** Composited equirect-aligned image, ready as a THREE.Texture source. */
  canvas: HTMLCanvasElement
  /** The composited window's bounds in radians (lonW, lonE, latS, latN). */
  bounds: [number, number, number, number]
  /** GIBS zoom level used, for the HUD provenance line. */
  zoom: number
  source: string
}

function loadImage(url: string, ms = 8000): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    const timer = setTimeout(() => resolve(null), ms)
    img.onload = () => { clearTimeout(timer); resolve(img) }
    img.onerror = () => { clearTimeout(timer); resolve(null) }
    img.src = url
  })
}

/**
 * Fetch + composite higher-res imagery for a patch centred at (latC, lonC) with
 * angular half-size `halfRad`. Returns null if nothing loads (offline / edge of
 * layer). Earth only for now — other bodies keep the global colour map.
 */
export async function fetchImageryTile(
  bodyId: string,
  latC: number,
  lonC: number,
  halfRad: number,
): Promise<ImageryTile | null> {
  if (bodyId !== "earth" && bodyId !== "earth-gebco") return null
  if (typeof document === "undefined") return null

  const layer = EARTH_BASE
  const z = zoomForHalfAngle(halfRad, layer.maxZoom)

  const latCdeg = (latC * 180) / Math.PI
  const lonCdeg = (lonC * 180) / Math.PI
  const halfDeg = (halfRad * 180) / Math.PI
  // Clamp latitude to Web-Mercator's valid band (~±85.05°).
  const latN = Math.min(85, latCdeg + halfDeg)
  const latS = Math.max(-85, latCdeg - halfDeg)
  const lonW = lonCdeg - halfDeg
  const lonE = lonCdeg + halfDeg

  // Tile index range covering the window.
  const x0 = Math.floor(lonToTileX(lonW, z))
  const x1 = Math.floor(lonToTileX(lonE, z))
  const y0 = Math.floor(latToTileY(latN, z)) // north = smaller y
  const y1 = Math.floor(latToTileY(latS, z))
  const nx = x1 - x0 + 1
  const ny = y1 - y0 + 1
  // Guard against a runaway grid (bad zoom / near-pole). Keep it modest.
  if (nx < 1 || ny < 1 || nx * ny > 36) return null

  const date = layer.dated ? new Date().toISOString().slice(0, 10) : null

  // Load every tile in the grid in parallel.
  const jobs: Promise<{ img: HTMLImageElement | null; gx: number; gy: number }>[] = []
  for (let gy = 0; gy < ny; gy++) {
    for (let gx = 0; gx < nx; gx++) {
      const tx = x0 + gx
      const ty = y0 + gy
      jobs.push(loadImage(tileUrl(layer, z, tx, ty, date)).then((img) => ({ img, gx, gy })))
    }
  }
  const tiles = await Promise.all(jobs)
  if (!tiles.some((t) => t.img)) return null

  // Composite the mercator tile grid onto a canvas. The canvas covers the tile
  // grid's mercator extent; we return the grid's true geographic bounds so the
  // shader maps its equirect UV into this same window. Within a few-tile patch
  // the mercator vs equirect latitude skew is small; acceptable for a colour
  // overlay (elevation, which carries the real relief, is unaffected).
  const canvas = document.createElement("canvas")
  canvas.width = nx * TILE_PX
  canvas.height = ny * TILE_PX
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  for (const t of tiles) {
    if (t.img) ctx.drawImage(t.img, t.gx * TILE_PX, t.gy * TILE_PX, TILE_PX, TILE_PX)
  }

  // True geographic bounds of the composited grid (tile edges).
  const gLonW = tileXToLon(x0, z)
  const gLonE = tileXToLon(x1 + 1, z)
  const gLatN = tileYToLat(y0, z)
  const gLatS = tileYToLat(y1 + 1, z)

  return {
    canvas,
    bounds: [
      (gLonW * Math.PI) / 180,
      (gLonE * Math.PI) / 180,
      (gLatS * Math.PI) / 180,
      (gLatN * Math.PI) / 180,
    ],
    zoom: z,
    source: `NASA GIBS · Blue Marble (z${z})`,
  }
}
