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
    url: "https://planetarymaps.usgs.gov/mosaic/Mars_MGS_MOLA_DEM_mosaic_global_463m.tif",
    out: "mars-height-2k.png",
    minM: -8201,
    maxM: 21241,
    // The raw raster is already in metres; no scale needed.
    rawToMetres: 1,
    attribution: "NASA MGS MOLA / USGS Astrogeology (public domain)",
  },
  // Others wired as their bakes come online (LOLA / MESSENGER / Magellan / GEBCO).
  // moon:    { url: "…LOLA…",        out: "moon-height-2k.png",    minM: -9150, maxM: 10786, rawToMetres: 1 },
  // mercury: { url: "…MESSENGER…",   out: "mercury-height-2k.png", minM: -5380, maxM: 4480,  rawToMetres: 1 },
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
 */
function downsample(src, out, width, minM, maxM, rawToMetres) {
  const height = Math.round(width / 2) // equirectangular is 2:1
  const py = `
import sys, numpy as np
from PIL import Image
Image.MAX_IMAGE_PIXELS = None  # these mosaics exceed the decompression-bomb guard

src, out = ${JSON.stringify(src)}, ${JSON.stringify(out)}
W, H = ${width}, ${height}
minM, maxM, scale = ${minM}, ${maxM}, ${rawToMetres}

print(f"  ↳ opening {src} …", flush=True)
im = Image.open(src)
print(f"    source size: {im.size[0]}x{im.size[1]}, mode {im.mode}", flush=True)

# draft() lets the decoder skip pixels while reading (huge speed/mem win on big
# rasters); only meaningful for JPEG-backed data but harmless otherwise.
try:
    im.draft(im.mode, (W, H))
except Exception:
    pass

# Resize to target with a high-quality filter. Convert to 32-bit float first so
# negative elevations (below datum) survive; PIL 'I' is 32-bit signed int.
im = im.convert("F")
im = im.resize((W, H), Image.LANCZOS)
arr = np.asarray(im, dtype=np.float64) * scale  # raw → metres

# Clamp to the known real range, then normalise to full 16-bit.
arr = np.clip(arr, minM, maxM)
norm = (arr - minM) / (maxM - minM)             # 0..1 across true relief
u16 = np.rint(norm * 65535.0).astype(np.uint16)

# Report the real elevation actually present (sanity vs the declared range).
lo = minM + (u16.min() / 65535.0) * (maxM - minM)
hi = minM + (u16.max() / 65535.0) * (maxM - minM)
print(f"    encoded relief present: {lo:.0f} m … {hi:.0f} m (declared {minM}..{maxM})", flush=True)

# mode inferred from the uint16 array; save as 16-bit greyscale PNG.
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

  const srcPath = join(SCRATCH, `${body}-source.tif`)
  const outPath = join(OUT_DIR, s.out)

  console.log(`Terrain DEM: ${body}`)
  console.log(`  source: ${s.attribution}`)
  download(s.url, srcPath)
  console.log(`  ↳ downsampling → ${s.out} (${opts.width}×${Math.round(opts.width / 2)}, 16-bit)`)
  downsample(srcPath, outPath, opts.width, s.minM, s.maxM, s.rawToMetres)

  console.log(`  final: ${human(statSync(outPath).size)} committed to public/textures/terrain/`)
  if (!opts.keep) {
    console.log(`  (keeping the ${human(statSync(srcPath).size)} source in .terrain-cache/ — gitignored; pass nothing to re-use, delete to reclaim disk)`)
  }
  console.log("Done.")
}

main()
