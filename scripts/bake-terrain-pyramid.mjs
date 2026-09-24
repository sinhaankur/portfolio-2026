#!/usr/bin/env node
/**
 * bake-terrain-pyramid — split a global equirectangular DEM into a z/x/y quadtree
 * tile pyramid for the Phase C deep-zoom terrain (Google-Earth-style LOD).
 *
 * Why a pyramid: the single-patch deep-zoom (Phase A/B) samples one global map (or
 * a hand-picked regional crop). A pyramid lets the renderer load only the tiles
 * visible at the current camera altitude — coarse tiles far out, fine tiles as you
 * descend — so you get smooth, continuous detail ANYWHERE on the body, not just
 * the 5 named regions. The renderer never holds the whole fine map at once.
 *
 * Layout (equirectangular, 2:1). At zoom z the world is a grid of (2^(z+1)) × (2^z)
 * tiles, each `--tile` px (default 256). Tile (z, x, y): x east 0..2^(z+1)-1 from
 * lon -180, y south 0..2^z-1 from lat +90. Every tile is a 16-bit greyscale PNG
 * decoded with the body's declared elevMin/Max — identical decode to the globe, so
 * a tile drops straight into the terrain shader.
 *
 * Source: the already-baked equirect 16-bit height map (e.g. GEBCO 4K), so this
 * needs NO multi-GB download. Re-bake from a higher-res native source later to go
 * deeper — the layout + manifest are unchanged.
 *
 * Output: public/textures/terrain/pyramid/<body>/<z>/<x>/<y>.png + a manifest.json.
 * These are meant to move to the dedicated terrain-tiles repo/CDN (heavy in count).
 *
 * Usage:
 *   node scripts/bake-terrain-pyramid.mjs earth-gebco --maxZoom 4
 *   node scripts/bake-terrain-pyramid.mjs earth-gebco --maxZoom 4 --tile 256
 *
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * https://github.com/sinhaankur/portfolio-2026
 */

import { spawnSync } from "node:child_process"
import { mkdirSync, existsSync, writeFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")
const TERRAIN_DIR = join(ROOT, "public", "textures", "terrain")

// Pyramid sources: an already-baked equirect 16-bit height map + its real decode
// range (mirrors lib/terrain/bodies.ts). Adding a body = one entry.
const SOURCES = {
  "earth-gebco": {
    src: join(TERRAIN_DIR, "earth-gebco-height-4k.png"),
    minM: -10900,
    maxM: 8849,
    attribution: "GEBCO Compilation Group (GEBCO_2024 Grid) — CC BY 4.0",
  },
  earth: {
    src: join(TERRAIN_DIR, "earth-height-2k.png"),
    minM: -10900,
    maxM: 8849,
    attribution: "NOAA NCEI ETOPO 2022 bed elevation (public domain)",
  },
  mars: {
    src: join(TERRAIN_DIR, "mars-height-2k.png"),
    minM: -8201,
    maxM: 21241,
    attribution: "NASA MGS MOLA / USGS Astrogeology (public domain)",
  },
}

function parseArgs(argv) {
  const body = argv[2]
  const opts = { maxZoom: 4, tile: 256 }
  for (let i = 3; i < argv.length; i++) {
    if (argv[i] === "--maxZoom") opts.maxZoom = parseInt(argv[++i], 10)
    else if (argv[i] === "--tile") opts.tile = parseInt(argv[++i], 10)
  }
  return { body, opts }
}

function main() {
  const { body, opts } = parseArgs(process.argv)
  if (!body || !SOURCES[body]) {
    console.error("Usage: node scripts/bake-terrain-pyramid.mjs <body> [--maxZoom N] [--tile 256]")
    console.error(`Known: ${Object.keys(SOURCES).join(", ")}`)
    process.exit(1)
  }
  const s = SOURCES[body]
  if (!existsSync(s.src)) {
    console.error(`Source height map not found: ${s.src}`)
    console.error("Bake the global map first (scripts/fetch-terrain-dem.mjs).")
    process.exit(1)
  }

  const outRoot = join(TERRAIN_DIR, "pyramid", body)
  mkdirSync(outRoot, { recursive: true })

  console.log(`Terrain pyramid: ${body}`)
  console.log(`  source: ${s.attribution}`)
  console.log(`  → ${outRoot}  (z0..z${opts.maxZoom}, ${opts.tile}px tiles)`)

  // Python does the slicing: load the source once, and for each zoom resize the
  // whole map to that level's full pixel size, then cut it into tile-sized cells.
  const py = `
import os, json
import numpy as np
from PIL import Image
Image.MAX_IMAGE_PIXELS = None

src = ${JSON.stringify(s.src)}
outRoot = ${JSON.stringify(outRoot)}
maxZoom = ${opts.maxZoom}
T = ${opts.tile}
minM, maxM = ${s.minM}, ${s.maxM}

full = Image.open(src)
# 16-bit greyscale; work in float for clean resizing, re-encode to 16-bit per tile.
full = full.convert("I")
arr = np.asarray(full, dtype=np.float64)
SH, SW = arr.shape
print(f"  source {SW}x{SH} (16-bit)", flush=True)

total = 0
for z in range(maxZoom + 1):
    cols = 2 ** (z + 1)   # equirect 2:1 → twice as many x tiles as y
    rows = 2 ** z
    W, H = cols * T, rows * T
    # Resize the whole map to this level's pixel size (Lanczos preserves relief).
    lvl = np.asarray(Image.fromarray(arr.astype(np.float32), mode="F").resize((W, H), Image.LANCZOS), dtype=np.float64)
    for y in range(rows):
        for x in range(cols):
            cell = lvl[y*T:(y+1)*T, x*T:(x+1)*T]
            u16 = np.clip(cell, 0, 65535).astype(np.uint16)
            d = os.path.join(outRoot, str(z), str(x))
            os.makedirs(d, exist_ok=True)
            Image.fromarray(u16).save(os.path.join(d, f"{y}.png"), optimize=True)
            total += 1
    print(f"  z{z}: {cols}x{rows} = {cols*rows} tiles", flush=True)

manifest = {
    "body": ${JSON.stringify(body)},
    "maxZoom": maxZoom,
    "tile": T,
    "scheme": "equirect-2to1",       # x: 0..2^(z+1)-1 east from lon -180; y: 0..2^z-1 south from lat +90
    "elevationMinM": minM,
    "elevationMaxM": maxM,
    "attribution": ${JSON.stringify(s.attribution)},
}
with open(os.path.join(outRoot, "manifest.json"), "w") as f:
    json.dump(manifest, f, indent=2)
print(f"  ✓ {total} tiles + manifest.json", flush=True)
`
  const r = spawnSync("python3", ["-c", py], { stdio: "inherit" })
  if (r.status !== 0) { console.error("python pyramid bake failed"); process.exit(1) }

  // Also write the manifest path for the caller's convenience.
  const manifest = { body, root: `pyramid/${body}`, note: "tiles under <z>/<x>/<y>.png" }
  writeFileSync(join(outRoot, ".bake-info.json"), JSON.stringify(manifest, null, 2))
  console.log("Done.")
}

main()
