/**
 * fetch-planet-textures.mjs
 *
 * Downloads REAL 4K equirectangular surface maps (NASA / USGS Astrogeology,
 * public domain) for the bodies whose detail actually rewards 4K — Earth, the
 * Moon, Mercury — and encodes them to webp in public/textures/ as
 * `<body>-4k.webp`. The engine points at these when present (same pattern as
 * the existing Mars 4K map); 2K stays the fallback.
 *
 * Only these three: gas giants and smooth/hazy moons show no extra detail at
 * 4K, so 4K there would be pure bundle bloat (see the audit — Uranus/Neptune/
 * Titan textures are already <20 KB because there's nothing to resolve).
 *
 *   pnpm data:textures            # fetch any missing, encode to webp
 *   pnpm data:textures --force    # re-fetch + re-encode all
 *
 * Requires `cwebp` (Google's WebP encoder; `brew install webp`). Sources are
 * cited per-body; all are public domain (US government works).
 */

import { promises as fs } from "node:fs"
import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { execFile } from "node:child_process"
import { promisify } from "node:util"

const execFileP = promisify(execFile)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CACHE = path.join(__dirname, ".cache")
const OUT = path.join(__dirname, "..", "public", "textures")

// Real public-domain 4K maps. Each: the body, its source URL, and a citation.
// URLs point at NASA SVS / USGS Astrogeology equirectangular basemaps.
const MAPS = [
  {
    body: "earth",
    // NASA Visible Earth — Blue Marble Next Generation, 4K land+ocean.
    url: "https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73909/world.topo.bathy.200412.3x5400x2700.jpg",
    source: "NASA Visible Earth — Blue Marble Next Generation (public domain)",
  },
  {
    body: "moon",
    // NASA SVS CGI Moon Kit 2025 — LROC WAC colour, 4K equirectangular (TIFF;
    // cwebp reads it). Verified 200 OK. https://svs.gsfc.nasa.gov/4720
    url: "https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_16bit_srgb_4k.tif",
    source: "NASA SVS / LRO LROC CGI Moon Kit 2025 colour mosaic (public domain)",
  },
  // TODO Mercury: NASA MESSENGER MDIS global mosaic — need a verified direct
  // 4K JPG/TIF URL (the SVS/USGS paths tried so far 404). Add here when found;
  // the 2K mercury.webp stays until then. Earth + Moon are the top-value pair.
]

async function ensureDirs() {
  await fs.mkdir(CACHE, { recursive: true })
  await fs.mkdir(OUT, { recursive: true })
}

async function download(url, dest) {
  const res = await fetch(url, { redirect: "follow" })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  await fs.writeFile(dest, buf)
  return buf.length
}

async function toWebp(src, dest) {
  // -q 82: strong quality at a fraction of the PNG/JPG size. -resize to a max
  // 4096 width keeps it a true 4K equirect (2:1).
  await execFileP("cwebp", ["-q", "82", "-resize", "4096", "0", src, "-o", dest])
}

async function main() {
  const force = process.argv.includes("--force")
  await ensureDirs()

  // Guard: cwebp must exist.
  try {
    await execFileP("cwebp", ["-version"])
  } catch {
    console.error("cwebp not found — install it: brew install webp")
    process.exit(1)
  }

  for (const m of MAPS) {
    const out = path.join(OUT, `${m.body}-4k.webp`)
    if (existsSync(out) && !force) {
      console.log(`✓ ${m.body}-4k.webp already present (use --force to re-fetch)`)
      continue
    }
    const ext = path.extname(new URL(m.url).pathname) || ".jpg"
    const cached = path.join(CACHE, `${m.body}-src${ext}`)
    try {
      if (!existsSync(cached) || force) {
        process.stdout.write(`↓ ${m.body}: downloading source… `)
        const bytes = await download(m.url, cached)
        console.log(`${(bytes / 1e6).toFixed(1)} MB`)
      }
      process.stdout.write(`  encoding ${m.body}-4k.webp… `)
      await toWebp(cached, out)
      const { size } = await fs.stat(out)
      console.log(`${(size / 1e3).toFixed(0)} KB`)
      console.log(`  source: ${m.source}`)
    } catch (e) {
      console.error(`✗ ${m.body}: ${e.message}`)
      console.error(`  (source URL may have moved — update MAPS in this script)`)
    }
  }
  console.log("\nDone. Wire the engine: set each body's textureUrl to /textures/<body>-4k.webp")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
