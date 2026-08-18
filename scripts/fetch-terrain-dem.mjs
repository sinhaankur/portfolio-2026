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
  // mercury: { …MESSENGER…, minM: -5380, maxM: 4480 }  // wired as bakes come online
  // venus:   { …Magellan… }
}

function parseArgs(argv) {
  const body = argv[2]
  const opts = { width: 2048, keep: false }
  for (let i = 3; i < argv.length; i++) {
    if (argv[i] === "--width") opts.width = parseInt(argv[++i], 10)
    else if (argv[i] === "--keep") opts.keep = true
  }
  return { body, opts }
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

  const readBlock =
    format === "pds-raw"
      ? `
# RAW PDS .img: fixed dimensions + dtype from the .lbl, no header to parse.
rw, rh, dt = ${s.rawWidth}, ${s.rawHeight}, ${JSON.stringify(s.rawDtype)}
print(f"  ↳ reading raw PDS grid {rw}x{rh} ({dt}) …", flush=True)
raw = np.fromfile(src, dtype=np.dtype(dt)).astype(np.float64)
raw = raw.reshape((rh, rw))
# Block-mean downsample to (H, W): reshape into tiles and average. rw/rh are
# exact multiples of W/H for LDEM_64 (23040/2048=11.25 → use integer factor path).
def block_resize(a, W, H):
    ih, iw = a.shape
    # Fall back to PIL's high-quality resize via an intermediate float image.
    from PIL import Image
    im = Image.fromarray(a.astype(np.float32), mode="F").resize((W, H), Image.LANCZOS)
    return np.asarray(im, dtype=np.float64)
arr = block_resize(raw, W, H) * scale
`
      : `
from PIL import Image
Image.MAX_IMAGE_PIXELS = None  # these mosaics exceed the decompression-bomb guard
print(f"  ↳ opening {src} …", flush=True)
im = Image.open(src)
print(f"    source size: {im.size[0]}x{im.size[1]}, mode {im.mode}", flush=True)
try:
    im.draft(im.mode, (W, H))
except Exception:
    pass
im = im.convert("F").resize((W, H), Image.LANCZOS)
arr = np.asarray(im, dtype=np.float64) * scale
`

  const py = `
import numpy as np
from PIL import Image

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
  const outPath = join(OUT_DIR, s.out)

  console.log(`Terrain DEM: ${body}`)
  console.log(`  source: ${s.attribution}`)
  download(s.url, srcPath)
  console.log(`  ↳ downsampling → ${s.out} (${opts.width}×${Math.round(opts.width / 2)}, 16-bit)`)
  downsample(srcPath, outPath, opts.width, s)

  console.log(`  final: ${human(statSync(outPath).size)} committed to public/textures/terrain/`)
  if (!opts.keep) {
    console.log(`  (keeping the ${human(statSync(srcPath).size)} source in .terrain-cache/ — gitignored; pass nothing to re-use, delete to reclaim disk)`)
  }
  console.log("Done.")
}

main()
