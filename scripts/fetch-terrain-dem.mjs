#!/usr/bin/env node
/**
 * fetch-terrain-dem — download a REAL global planetary DEM and downsample it to a
 * small, web-ready 16-bit greyscale height map for the terrain engine.
 *
 * The ground truth (USGS Astrogeology / GEBCO) ships as huge GeoTIFFs (the Mars
 * MOLA 463m mosaic is ~2.1 GB). We download the source ONCE to a scratch dir that
 * git never sees, downsample it to an equirectangular 16-bit PNG (default 2048×1024,
 * ~a few hundred KB), and write ONLY that small result into public/textures/terrain.
 * The 16-bit range preserves real relief (65,536 levels across the body's true
 * elevation span, decoded back to metres in the shader via elevationMin/Max).
 *
 * Heavy lifting is done in Python (PIL + numpy, present locally) because sharp
 * isn't top-level-linked here and Node has no good BigTIFF path. No new JS deps.
 *
 * Usage:
 *   node scripts/fetch-terrain-dem.mjs mars           # default 2048 wide
 *   node scripts/fetch-terrain-dem.mjs mars --width 4096
 *   node scripts/fetch-terrain-dem.mjs mars --keep     # keep the big source
 *
 * Sources are PUBLIC DOMAIN (USGS/NASA) or CC-BY (GEBCO, credited in the app).
 */

import { spawnSync } from "node:child_process"
import { mkdirSync, existsSync, statSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")
const OUT_DIR = join(ROOT, "public", "textures", "terrain")
// Scratch lives OUTSIDE the repo tree the site ships; big sources never enter git.
const SCRATCH = join(ROOT, ".terrain-cache")

/**
 * Per-body source registry. Each entry names the authoritative global DEM, its
 * output path, and — critically — the REAL elevation min/max in metres so the
 * downsample can normalise the raw values into the full 16-bit range with a known
 * decode. These min/max mirror lib/terrain/bodies.ts (single source of truth).
 */
const SOURCES = {
  mars: {
    // MOLA 463m global mosaic (MGS). ~2.1 GB BigTIFF, real metres relative to areoid.
    format: "geotiff",
    url: "https://planetarymaps.usgs.gov/mosaic/Mars_MGS_MOLA_DEM_mosaic_global_463m.tif",
    out: "mars-height-2k.png",
    minM: -8201,
    maxM: 21241,
    // The raw raster is already in metres; no scale needed.
    rawToMetres: 1,
    attribution: "NASA MGS MOLA / USGS Astrogeology (public domain)",
  },
  moon: {
    // LOLA LDEM_64 (64 pix/deg) from the PDS Geosciences node. A RAW headerless
    // PDS .img: 23040×11520, 16-bit signed little-endian. HEIGHT_m = DN × 0.5
    // (SCALING_FACTOR), relative to the 1737.4 km reference sphere. ~530 MB.
    format: "pds-raw",
    url: "https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/ldem_64.img",
    out: "moon-height-2k.png",
    ext: "img",
    rawWidth: 23040,
    rawHeight: 11520,
    rawDtype: "<i2", // little-endian signed 16-bit
    minM: -9126,
    maxM: 10773,
    // DN → metres per the label's SCALING_FACTOR.
    rawToMetres: 0.5,
    attribution: "NASA LRO LOLA (LDEM_64, PDS Geosciences) — public domain",
  },
  earth: {
    // ETOPO 2022 BED elevation, 60 arc-second (21600×10800), single global
    // GeoTIFF in metres. "Bed" = the solid surface below BOTH ice and water, so
    // draining the oceans reveals the real ocean floor: mid-ocean ridges,
    // abyssal plains, trenches. ~466 MB, public domain (NOAA NCEI). min/max are
    // read live from the data and printed; the declared range below is ETOPO's
    // known global bed relief and is corrected to the measured values on bake.
    format: "geotiff",
    url: "https://www.ngdc.noaa.gov/mgg/global/relief/ETOPO2022/data/60s/60s_bed_elev_gtif/ETOPO_2022_v1_60s_N90W180_bed.tif",
    out: "earth-height-2k.png",
    minM: -10900,
    maxM: 8849,
    rawToMetres: 1,
    attribution: "NOAA NCEI ETOPO 2022 bed elevation (public domain)",
  },
  mercury: {
    // MESSENGER global DEM, 665 m/pixel (23040×11520), single GeoTIFF in metres
    // relative to the 2439.4 km reference sphere. ~530 MB, public domain.
    format: "geotiff",
    url: "https://planetarymaps.usgs.gov/mosaic/Mercury_Messenger_USGS_DEM_Global_665m_v2.tif",
    out: "mercury-height-2k.png",
    minM: -5380,
    maxM: 4480,
    rawToMetres: 1,
    attribution: "NASA MESSENGER / USGS Astrogeology (public domain)",
  },
  venus: {
    // Magellan global topography, 4641 m/pixel. Small (~64 MB) GeoTIFF in metres
    // relative to the 6051 km reference sphere (radar altimetry). Public domain.
    format: "geotiff",
    url: "https://planetarymaps.usgs.gov/mosaic/Venus_Magellan_Topography_Global_4641m_v02.tif",
    out: "venus-height-2k.png",
    minM: -2900,
    maxM: 10998,
    rawToMetres: 1,
    attribution: "NASA Magellan / USGS Astrogeology (public domain)",
  },
  "earth-gebco": {
    // GEBCO 2024, 15 arc-second — ~4× ETOPO's resolution. Ships as a ZIP of 8
    // 90°×90° GeoTIFF tiles (4×2 grid) that must be MOSAICKED into one global
    // raster before downsampling. ~4.26 GB zipped. For the Phase 3 deep-zoom
    // tile pyramid — overkill for the current 2K globe (use `earth`/ETOPO there).
    // License: GEBCO Compilation Group (credit required; CC BY 4.0 via OpenTopography).
    format: "zip-mosaic",
    url: "https://dap.ceda.ac.uk/bodc/gebco/global/gebco_2024/ice_surface_elevation/geotiff/gebco_2024_geotiff.zip",
    out: "earth-gebco-height-4k.png",
    ext: "zip",
    // The 8 tiles in row-major order (N row then S row), west→east, matching the
    // filenames read from the zip directory. Each is 90° tall × 90° wide.
    tiles: [
      // North row (n90 → s0)
      "gebco_2024_n90.0_s0.0_w-180.0_e-90.0.tif",
      "gebco_2024_n90.0_s0.0_w-90.0_e0.0.tif",
      "gebco_2024_n90.0_s0.0_w0.0_e90.0.tif",
      "gebco_2024_n90.0_s0.0_w90.0_e180.0.tif",
      // South row (n0 → s-90)
      "gebco_2024_n0.0_s-90.0_w-180.0_e-90.0.tif",
      "gebco_2024_n0.0_s-90.0_w-90.0_e0.0.tif",
      "gebco_2024_n0.0_s-90.0_w0.0_e90.0.tif",
      "gebco_2024_n0.0_s-90.0_w90.0_e180.0.tif",
    ],
    tileCols: 4,
    tileRows: 2,
    minM: -10900,
    maxM: 8849,
    rawToMetres: 1,
    // GEBCO 15″ is huge; default this body to a wider bake so the extra data
    // survives. Override with --width as needed.
    defaultWidth: 4096,
    attribution: "GEBCO Compilation Group (GEBCO_2024 Grid) — CC BY 4.0",
  },
}

function parseArgs(argv) {
  const body = argv[2]
  const opts = { width: 2048, keep: false, widthExplicit: false, region: null }
  for (let i = 3; i < argv.length; i++) {
    if (argv[i] === "--width") { opts.width = parseInt(argv[++i], 10); opts.widthExplicit = true }
    else if (argv[i] === "--keep") opts.keep = true
    else if (argv[i] === "--region") opts.region = argv[++i]
  }
  return { body, opts }
}

/**
 * Named regional crops: a high-res tile is a lat/lon window of the body's native
 * source, downsampled to a tile. Bounds MUST mirror lib/terrain/bodies.ts regions
 * so the runtime UV mapping matches. Cropped from the SAME cached source — no new
 * download. Only geotiff sources (Mars/Earth-style) are croppable this way today.
 */
const REGIONS = {
  mars: {
    "valles-marineris": { out: "mars-valles-marineris-2k.png", lonW: -95, lonE: -35, latS: -20, latN: 10 },
    "olympus-mons": { out: "mars-olympus-mons-2k.png", lonW: -152, lonE: -116, latS: 2, latN: 34 },
    "jezero": { out: "mars-jezero-2k.png", lonW: 70, lonE: 85, latS: 12, latN: 24 },
  },
  moon: {
    "tycho": { out: "moon-tycho-2k.png", lonW: -19, lonE: -3, latS: -51, latN: -35 },
  },
  venus: {
    "maxwell-montes": { out: "venus-maxwell-montes-2k.png", lonW: -12, lonE: 20, latS: 55, latN: 75 },
  },
}

function human(bytes) {
  const u = ["B", "KB", "MB", "GB"]
  let n = bytes, i = 0
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++ }
  return `${n.toFixed(1)} ${u[i]}`
}

function download(url, dest) {
  if (existsSync(dest) && statSync(dest).size > 0) {
    console.log(`  ↳ source already cached (${human(statSync(dest).size)}), skipping download`)
    return
  }
  console.log(`  ↳ downloading ${url}`)
  console.log(`    (this is the full ground-truth DEM — can be a couple of GB; resumable)`)
  // -C - resumes a partial file so a dropped connection doesn't restart 2 GB.
  const r = spawnSync("curl", ["-fL", "-C", "-", "--retry", "3", "-o", dest, url], {
    stdio: "inherit",
  })
  if (r.status !== 0) {
    throw new Error(`curl failed for ${url} (exit ${r.status})`)
  }
}

/**
 * Downsample the big DEM to a 16-bit equirectangular PNG using Python/PIL+numpy.
 * We normalise raw elevation → [0, 65535] across [minM, maxM] so the shader can
 * decode exact metres: metres = minM + (px/65535) * (maxM - minM).
 *
 * Two source formats:
 *   • "geotiff"  — opened with PIL (Mars MOLA and most USGS mosaics).
 *   • "pds-raw"  — a headerless PDS .img: read with numpy.fromfile using the
 *     dimensions + dtype from the product's .lbl (Moon LOLA LDEM_64).
 */
function downsample(src, out, width, s) {
  const height = Math.round(width / 2) // equirectangular is 2:1
  const { minM, maxM, rawToMetres, format } = s

  let readBlock
  if (format === "pds-raw") {
    readBlock = `
# RAW PDS .img: fixed dimensions + dtype from the .lbl, no header to parse.
rw, rh, dt = ${s.rawWidth}, ${s.rawHeight}, ${JSON.stringify(s.rawDtype)}
print(f"  ↳ reading raw PDS grid {rw}x{rh} ({dt}) …", flush=True)
raw = np.fromfile(src, dtype=np.dtype(dt)).astype(np.float64)
raw = raw.reshape((rh, rw))
def block_resize(a, W, H):
    from PIL import Image
    im = Image.fromarray(a.astype(np.float32), mode="F").resize((W, H), Image.LANCZOS)
    return np.asarray(im, dtype=np.float64)
arr = block_resize(raw, W, H) * scale
`
  } else if (format === "zip-mosaic") {
    // Mosaic N×M GeoTIFF tiles into one global grid WITHOUT ever holding all of
    // them in memory: downsample each tile straight into its cell of the output.
    readBlock = `
import zipfile, io
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
cols, rows = ${s.tileCols}, ${s.tileRows}
tiles = ${JSON.stringify(s.tiles)}
cw, ch = W // cols, H // rows           # per-tile output cell size
print(f"  ↳ mosaicking {len(tiles)} tiles ({cols}×{rows}) into {W}x{H} …", flush=True)
arr = np.zeros((H, W), dtype=np.float64)
with zipfile.ZipFile(src) as z:
    names = {n.split('/')[-1]: n for n in z.namelist()}
    for i, t in enumerate(tiles):
        member = names.get(t)
        if member is None:
            raise SystemExit(f"tile missing from zip: {t}")
        r, c = divmod(i, cols)
        with z.open(member) as fh:
            im = Image.open(io.BytesIO(fh.read()))
            im = im.convert("F").resize((cw, ch), Image.LANCZOS)
            arr[r*ch:(r+1)*ch, c*cw:(c+1)*cw] = np.asarray(im, dtype=np.float64)
        print(f"    tile {i+1}/{len(tiles)} placed [{r},{c}]", flush=True)
arr = arr * scale
`
  } else {
    // Read via tifffile so the sample format/bit-depth is honoured (many DEM
    // GeoTIFFs are int16 or float32; PIL misreads them as 32-bit int mode 'I' →
    // garbage). Mask obvious nodata (values outside a sane elevation window) so
    // fill sentinels don't blow out the normalisation, then resize via PIL.
    readBlock = `
import tifffile
from PIL import Image
print(f"  ↳ reading {src} via tifffile …", flush=True)
raw = tifffile.imread(src).astype(np.float64)
if raw.ndim == 3: raw = raw[..., 0]
print(f"    source size: {raw.shape[1]}x{raw.shape[0]}, dtype from file", flush=True)
# Nodata mask: anything far outside the plausible elevation window (in metres)
# is a fill sentinel; replace with the median of valid samples before resizing.
valid = np.isfinite(raw) & (raw > (minM - 2000)/scale) & (raw < (maxM + 2000)/scale)
if valid.mean() < 1.0:
    med = np.median(raw[valid]) if valid.any() else 0.0
    raw = np.where(valid, raw, med)
    print(f"    masked nodata: {100*(1-valid.mean()):.2f}% filled with median", flush=True)
im = Image.fromarray(raw.astype(np.float32), mode="F").resize((W, H), Image.LANCZOS)
arr = np.asarray(im, dtype=np.float64) * scale
`
  }

  const py = `
import numpy as np
from PIL import Image, ImageFile
# Some USGS mosaics (e.g. Venus Magellan) declare a hair more rows than the last
# strip actually contains — PIL errors on the short tail. Allow truncated loads:
# the missing sliver is off-map (a pole edge) and gets clamped anyway.
ImageFile.LOAD_TRUNCATED_IMAGES = True

src, out = ${JSON.stringify(src)}, ${JSON.stringify(out)}
W, H = ${width}, ${height}
minM, maxM, scale = ${minM}, ${maxM}, ${rawToMetres}
${readBlock}
# Clamp to the known real range, then normalise to full 16-bit.
arr = np.clip(arr, minM, maxM)
norm = (arr - minM) / (maxM - minM)             # 0..1 across true relief
u16 = np.rint(norm * 65535.0).astype(np.uint16)

lo = minM + (u16.min() / 65535.0) * (maxM - minM)
hi = minM + (u16.max() / 65535.0) * (maxM - minM)
print(f"    encoded relief present: {lo:.0f} m … {hi:.0f} m (declared {minM}..{maxM})", flush=True)

Image.fromarray(u16).save(out, optimize=True)
print(f"  ✓ wrote {out} ({W}x{H}, 16-bit)", flush=True)
`
  const r = spawnSync("python3", ["-c", py], { stdio: "inherit" })
  if (r.status !== 0) throw new Error(`python downsample failed (exit ${r.status})`)
}

/**
 * Crop a lat/lon window out of the (equirectangular) source at NATIVE resolution,
 * then downsample that window to a tile. The tile carries far more detail per
 * degree than the whole-planet map. Same 16-bit decode as the global map (uses
 * the body's declared minM/maxM), so the runtime shader decodes both identically.
 */
function cropRegion(src, out, width, s, region) {
  const { minM, maxM, rawToMetres, format } = s
  const { lonW, lonE, latS, latN } = region
  // Tile height keeps the region's real aspect ratio (lon-span : lat-span).
  const aspect = (lonE - lonW) / (latN - latS)
  const height = Math.max(1, Math.round(width / aspect))
  // Read the full source grid: raw PDS .img via fromfile, else tifffile.
  const readFull =
    format === "pds-raw"
      ? `
print(f"  ↳ reading raw PDS {src} for crop …", flush=True)
full = np.fromfile(src, dtype=np.dtype(${JSON.stringify(s.rawDtype)})).reshape((${s.rawHeight}, ${s.rawWidth}))
`
      : `
import tifffile
print(f"  ↳ reading {src} via tifffile for crop …", flush=True)
full = tifffile.imread(src)
if full.ndim == 3: full = full[..., 0]
`
  const py = `
import numpy as np
from PIL import Image

src, out = ${JSON.stringify(src)}, ${JSON.stringify(out)}
W, H = ${width}, ${height}
minM, maxM, scale = ${minM}, ${maxM}, ${rawToMetres}
lonW, lonE, latS, latN = ${lonW}, ${lonE}, ${latS}, ${latN}
${readFull}
SH, SW = full.shape  # equirectangular: lon -180..180, lat 90..-90
def px(lon, lat):
    x = int(round((lon + 180.0) / 360.0 * SW))
    y = int(round((90.0 - lat) / 180.0 * SH))
    return max(0, min(SW, x)), max(0, min(SH, y))
x0, y0 = px(lonW, latN)   # top-left = west edge, north edge
x1, y1 = px(lonE, latS)   # bottom-right = east edge, south edge
print(f"    crop px box: ({x0},{y0})–({x1},{y1}) = {x1-x0}x{y1-y0} native", flush=True)
sub = full[y0:y1, x0:x1].astype(np.float64)
# Mask nodata within the crop before resizing.
valid = np.isfinite(sub) & (sub > (minM-2000)/scale) & (sub < (maxM+2000)/scale)
if valid.mean() < 1.0:
    sub = np.where(valid, sub, np.median(sub[valid]) if valid.any() else 0.0)
crop = Image.fromarray(sub.astype(np.float32), mode="F").resize((W, H), Image.LANCZOS)
arr = np.asarray(crop, dtype=np.float64) * scale

arr = np.clip(arr, minM, maxM)
norm = (arr - minM) / (maxM - minM)
u16 = np.rint(norm * 65535.0).astype(np.uint16)
lo = minM + (u16.min() / 65535.0) * (maxM - minM)
hi = minM + (u16.max() / 65535.0) * (maxM - minM)
print(f"    region relief: {lo:.0f} m … {hi:.0f} m", flush=True)
Image.fromarray(u16).save(out, optimize=True)
print(f"  ✓ wrote {out} ({W}x{H}, 16-bit regional tile)", flush=True)
`
  const r = spawnSync("python3", ["-c", py], { stdio: "inherit" })
  if (r.status !== 0) throw new Error(`python region crop failed (exit ${r.status})`)
}

function main() {
  const { body, opts } = parseArgs(process.argv)
  if (!body || !SOURCES[body]) {
    console.error(`Usage: node scripts/fetch-terrain-dem.mjs <body> [--width N] [--keep]`)
    console.error(`Known bodies: ${Object.keys(SOURCES).join(", ")}`)
    process.exit(1)
  }
  const s = SOURCES[body]
  mkdirSync(OUT_DIR, { recursive: true })
  mkdirSync(SCRATCH, { recursive: true })

  const srcPath = join(SCRATCH, `${body}-source.${s.ext ?? "tif"}`)
  // A source can prefer a wider bake (GEBCO 15″); an explicit --width still wins.
  const width = opts.widthExplicit ? opts.width : s.defaultWidth ?? opts.width

  console.log(`Terrain DEM: ${body}`)
  console.log(`  source: ${s.attribution}`)
  download(s.url, srcPath)

  // Regional tile mode: crop a named lat/lon window at native resolution.
  if (opts.region) {
    const region = REGIONS[body]?.[opts.region]
    if (!region) {
      console.error(`Unknown region "${opts.region}" for ${body}.`)
      console.error(`Known regions: ${Object.keys(REGIONS[body] ?? {}).join(", ") || "(none)"}`)
      process.exit(1)
    }
    const tilePath = join(OUT_DIR, region.out)
    // Regional tiles default to 1536px — plenty of local detail (they cover a
    // small window) while staying within the texture budget when committed.
    const rw = opts.widthExplicit ? opts.width : 1536
    console.log(`  ↳ cropping region "${opts.region}" → ${region.out}`)
    cropRegion(srcPath, tilePath, rw, s, region)
    console.log(`  final: ${human(statSync(tilePath).size)} → public/textures/terrain/`)
    console.log("Done.")
    return
  }

  const outPath = join(OUT_DIR, s.out)
  console.log(`  ↳ downsampling → ${s.out} (${width}×${Math.round(width / 2)}, 16-bit)`)
  downsample(srcPath, outPath, width, s)

  console.log(`  final: ${human(statSync(outPath).size)} committed to public/textures/terrain/`)
  if (!opts.keep) {
    console.log(`  (keeping the ${human(statSync(srcPath).size)} source in .terrain-cache/ — gitignored; pass nothing to re-use, delete to reclaim disk)`)
  }
  console.log("Done.")
}

main()
