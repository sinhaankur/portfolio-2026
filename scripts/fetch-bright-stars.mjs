#!/usr/bin/env node
/**
 * fetch-bright-stars.mjs
 *
 * Downloads the HYG v3.7 stellar database (public-domain catalog
 * derived from HIPPARCOS + Yale Bright Star + Gliese), filters to
 * the naked-eye visible subset (apparent magnitude ≤ 6.5), converts
 * each star's B-V colour index to RGB and equatorial RA/Dec to
 * Cartesian sky-shell coordinates, and writes a compact TypeScript
 * module ready to import into the Universe Engine.
 *
 * Output: lib/data/bright-stars.ts (~80–120 KB after compaction)
 *
 * Run with: node scripts/fetch-bright-stars.mjs
 * (Or via the package.json script: pnpm data:stars)
 *
 * Re-run when:
 *   - You want fresher data (HYG updates every couple of years)
 *   - You want to widen/narrow the magnitude cutoff
 *   - HYG schema changes (column indices below would need updating)
 */

import { promises as fs } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const CACHE_DIR = path.join(ROOT, "scripts", ".cache")
const CACHE_FILE = path.join(CACHE_DIR, "hyg-v41.csv")
const OUT_FILE = path.join(ROOT, "lib", "data", "bright-stars.ts")

// HYG v4.1 (CURRENT) — astronexus public-domain catalog. Columns
// match v3.7. We hit the CURRENT alias rather than pinning a version;
// re-run the script (and commit the diff) when you want fresher data.
const HYG_URL =
  "https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v41.csv"

// Naked-eye magnitude limit. 6.5 ≈ what a sharp eye sees from a
// genuinely dark site. The dataset has ~9,100 stars at this cutoff.
// Drop to 5.5 if you want a tighter naked-eye-from-city subset (~1,600).
const MAG_LIMIT = 6.5

// Sky-shell radius — matches SKY_SHELL_DISTANCE in astronomy.ts. The
// star points project onto the same shell as the constellation
// figures so they sit at the same depth in the scene.
const SKY_SHELL = 150

// Optional: keep proper-motion + parallax + spectral metadata for
// later use (proper-motion time-warp visualisation, deep-info panel,
// SIMBAD cross-IDs). Adds ~30 KB but enables Tier 3 without re-fetching.
const KEEP_METADATA = true

/* ---------------------------------------------------------------- */

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true })
}

async function downloadIfMissing() {
  try {
    await fs.access(CACHE_FILE)
    console.log(`Using cached HYG dataset at ${path.relative(ROOT, CACHE_FILE)}`)
    return
  } catch {
    /* not cached */
  }
  await ensureDir(CACHE_DIR)
  console.log(`Downloading HYG v3.7 from astronexus…`)
  const res = await fetch(HYG_URL)
  if (!res.ok) {
    throw new Error(`HYG download failed: ${res.status} ${res.statusText}`)
  }
  const text = await res.text()
  await fs.writeFile(CACHE_FILE, text, "utf8")
  console.log(`Saved ${(text.length / 1024 / 1024).toFixed(1)} MB to ${path.relative(ROOT, CACHE_FILE)}`)
}

/* ---------------------------------------------------------------- */

/**
 * Convert B-V colour index to linear-light RGB. Reference: standard
 * astronomical mapping (e.g. http://www.vendian.org/mncharity/dir3/starcolor/).
 * Returns each channel in 0..1.
 *
 * The mapping is empirical — these constants are the ones used by
 * stellarium and most planetarium software. We linearly clamp to
 * keep colours from going wild at the extremes.
 */
function bvToRgb(bv) {
  // Reasonable B-V range: -0.4 (blue) to +2.0 (deep red).
  const t = Math.max(-0.4, Math.min(2.0, bv))
  let r, g, b
  if (t < 0.0) {
    // Blue end — hottest stars
    r = 0.61 + (0.11 * (t + 0.4)) / 0.4
    g = 0.70 + (0.07 * (t + 0.4)) / 0.4
    b = 1.0
  } else if (t < 0.4) {
    // Blue-white
    r = 0.83 + (0.17 * t) / 0.4
    g = 0.87 + (0.11 * t) / 0.4
    b = 1.0
  } else if (t < 1.6) {
    // White → yellow → orange
    const f = (t - 0.4) / 1.2
    r = 1.0
    g = 0.98 - 0.42 * f
    b = 1.0 - 0.85 * f
  } else {
    // Red end — coolest stars
    const f = Math.min(1, (t - 1.6) / 0.4)
    r = 1.0 - 0.05 * f
    g = 0.56 - 0.12 * f
    b = 0.15
  }
  return [r, g, b]
}

/**
 * Convert equatorial RA (hours) + Dec (degrees) to Cartesian
 * coordinates on a sphere of radius `radius`. Matches the convention
 * the engine's existing `raDecToScenePos` uses.
 */
function raDecToCartesian(raHours, decDeg, radius) {
  const raRad = (raHours / 24) * 2 * Math.PI
  const decRad = (decDeg / 180) * Math.PI
  const cosDec = Math.cos(decRad)
  return [
    radius * cosDec * Math.cos(raRad),
    radius * Math.sin(decRad),
    radius * cosDec * Math.sin(raRad),
  ]
}

/**
 * Per-star point size from apparent magnitude. Brighter (lower mag)
 * = larger. Maps mag -1.5 (Sirius) → ~3.5x base, mag 6.5 → ~0.4x base.
 * Multiplied by a per-star size multiplier in the renderer.
 */
function magToSize(mag) {
  // Linear in magnitude is wrong (mag is log), but the eye is also
  // log-sensitive — so the final result looks calibrated.
  return Math.max(0.35, Math.min(4.0, 3.0 - 0.42 * mag))
}

/* ---------------------------------------------------------------- */

/**
 * Lightweight CSV parser — handles quoted fields with embedded commas.
 * HYG fields don't usually contain commas inside values but it's
 * cheap to handle.
 */
function parseCsv(text) {
  const lines = text.split(/\r?\n/)
  const header = parseCsvLine(lines[0])
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue
    const cells = parseCsvLine(lines[i])
    if (cells.length < header.length) continue
    const row = {}
    for (let j = 0; j < header.length; j++) row[header[j]] = cells[j]
    rows.push(row)
  }
  return rows
}

function parseCsvLine(line) {
  const out = []
  let cur = ""
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"'
        i++
      } else inQ = !inQ
    } else if (c === "," && !inQ) {
      out.push(cur)
      cur = ""
    } else cur += c
  }
  out.push(cur)
  return out
}

/* ---------------------------------------------------------------- */

async function main() {
  await downloadIfMissing()

  console.log(`Parsing HYG dataset…`)
  const text = await fs.readFile(CACHE_FILE, "utf8")
  const rows = parseCsv(text)
  console.log(`  Total entries: ${rows.length.toLocaleString()}`)

  // HYG column reference: https://github.com/astronexus/HYG-Database
  // Key fields we use:
  //   id, hip (HIPPARCOS), hd (Henry Draper), hr (Yale BSC), proper (proper name)
  //   ra (hours), dec (degrees), dist (parsecs), mag (apparent V), absmag, ci (B-V), spect, var, pmra, pmdec
  //
  // The Sun shows up as a row with id=0; skip it (we render the Sun
  // explicitly in the scene). Anything with no magnitude is unusable.
  // Conversion factor: 1 milliarcsecond → radian.
  //   1 mas = 1e-3 arcsec = 1e-3 / 3600 degree = π / (180 × 3600 × 1000) rad
  const MAS_PER_RAD = (180 * 3600 * 1000) / Math.PI
  const RAD_PER_MAS = 1 / MAS_PER_RAD

  const filtered = []
  for (const r of rows) {
    const mag = Number(r.mag)
    if (!Number.isFinite(mag) || mag > MAG_LIMIT) continue
    if (r.proper === "Sol" || r.id === "0") continue
    const ra = Number(r.ra)
    const dec = Number(r.dec)
    if (!Number.isFinite(ra) || !Number.isFinite(dec)) continue
    const bv = Number(r.ci)
    const dist = Number(r.dist) // parsecs
    const distLy = Number.isFinite(dist) ? dist * 3.2615638 : null
    const [x, y, z] = raDecToCartesian(ra, dec, SKY_SHELL)
    const [cr, cg, cb] = bvToRgb(Number.isFinite(bv) ? bv : 0.6)
    const size = magToSize(mag)

    // Proper motion → motion-per-year vector at the star's sky-shell
    // position. HYG stores pmra/pmdec as mas/yr (already includes the
    // cos(dec) factor on pmra so we don't double-correct).
    //
    // Tangent frame on the sky shell:
    //   east  = (-sin(ra), 0, cos(ra))           — direction of +RA
    //   north = (-sin(dec)·cos(ra), cos(dec), -sin(dec)·sin(ra))  — +Dec
    // Motion per year (radians) along these axes:
    //   v = east · pmra_rad + north · pmdec_rad
    // Cartesian displacement at radius SKY_SHELL is v · SKY_SHELL,
    // but we encode WITHOUT the radius so the shader can lift one
    // multiplication out (uniform × pre-baked vector).
    const pmraMas = Number(r.pmra)
    const pmdecMas = Number(r.pmdec)
    const pmra = Number.isFinite(pmraMas) ? pmraMas * RAD_PER_MAS : 0
    const pmdec = Number.isFinite(pmdecMas) ? pmdecMas * RAD_PER_MAS : 0
    const raRad = (ra / 24) * 2 * Math.PI
    const decRad = (dec / 180) * Math.PI
    const cosRa = Math.cos(raRad), sinRa = Math.sin(raRad)
    const cosDec = Math.cos(decRad), sinDec = Math.sin(decRad)
    const eastX = -sinRa, eastY = 0, eastZ = cosRa
    const northX = -sinDec * cosRa, northY = cosDec, northZ = -sinDec * sinRa
    const mx = eastX * pmra + northX * pmdec
    const my = eastY * pmra + northY * pmdec
    const mz = eastZ * pmra + northZ * pmdec

    filtered.push({
      raw: r,
      ra,
      dec,
      mag,
      bv: Number.isFinite(bv) ? bv : null,
      distLy,
      x, y, z,
      cr, cg, cb,
      size,
      mx, my, mz, // motion per year in radians (multiply by SKY_SHELL in shader)
    })
  }
  console.log(`  Filtered to mag ≤ ${MAG_LIMIT}: ${filtered.length.toLocaleString()} stars`)

  // Sort by magnitude — brightest first — so the renderer can keep
  // a smaller mobile subset by slicing the head of the array.
  filtered.sort((a, b) => a.mag - b.mag)

  // ---- Pack into Float32Arrays for compact serialisation ----
  const n = filtered.length
  const positions = new Float32Array(n * 3)
  const colors = new Float32Array(n * 3)
  const sizes = new Float32Array(n)
  const motionPerYear = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const s = filtered[i]
    positions[i * 3] = s.x
    positions[i * 3 + 1] = s.y
    positions[i * 3 + 2] = s.z
    colors[i * 3] = s.cr
    colors[i * 3 + 1] = s.cg
    colors[i * 3 + 2] = s.cb
    sizes[i] = s.size
    motionPerYear[i * 3] = s.mx
    motionPerYear[i * 3 + 1] = s.my
    motionPerYear[i * 3 + 2] = s.mz
  }

  // ---- Per-star metadata: only the named ones to keep size sane ----
  // Stars with a `proper` name (Sirius, Betelgeuse, Vega…) get
  // metadata; the rest are anonymous points. Adds ~10 KB.
  const named = []
  if (KEEP_METADATA) {
    for (let i = 0; i < n; i++) {
      const s = filtered[i]
      const r = s.raw
      const propName = (r.proper || "").trim()
      if (!propName) continue
      named.push({
        i,
        n: propName,
        h: r.hr ? Number(r.hr) : null,
        hd: r.hd ? Number(r.hd) : null,
        m: Number(s.mag.toFixed(2)),
        d: s.distLy != null ? Number(s.distLy.toFixed(1)) : null,
        s: r.spect || null,
      })
    }
  }
  console.log(`  Named stars (with proper names): ${named.length}`)

  // ---- Serialise ----
  // Use plain number arrays (JSON-safe). The runtime can wrap them in
  // Float32Array via `new Float32Array(positions)` if needed for R3F
  // BufferAttribute. JSON adds a bit of bloat vs raw binary, but keeps
  // tree-shaking + tooling simple. ~80 KB after Gzip.
  const out = `// AUTO-GENERATED by scripts/fetch-bright-stars.mjs. Do not edit by hand.
// Source: HYG v3.7 (astronexus, public domain) filtered to mag ≤ ${MAG_LIMIT}.
// Re-generate: pnpm data:stars

/**
 * Real naked-eye stars, projected to RA/Dec on the same sky-shell
 * (radius ${SKY_SHELL}) that the engine's constellations live on.
 * Colours derived from B-V index, sizes from apparent magnitude.
 *
 * The arrays are interleaved-by-three for positions/colors so they
 * map directly to a Three.js BufferAttribute with itemSize=3.
 */

export const BRIGHT_STAR_COUNT = ${n}
export const BRIGHT_STAR_SKY_SHELL = ${SKY_SHELL}
export const BRIGHT_STAR_MAG_LIMIT = ${MAG_LIMIT}

export const BRIGHT_STAR_POSITIONS = new Float32Array(${JSON.stringify(Array.from(positions).map((v) => Number(v.toFixed(3))))})
export const BRIGHT_STAR_COLORS = new Float32Array(${JSON.stringify(Array.from(colors).map((v) => Number(v.toFixed(3))))})
export const BRIGHT_STAR_SIZES = new Float32Array(${JSON.stringify(Array.from(sizes).map((v) => Number(v.toFixed(2))))})

/**
 * Per-star angular motion in RADIANS PER YEAR, expressed as a 3D
 * tangent vector at the star's sky-shell position. Multiply by the
 * sky-shell radius (150) in the shader to get a Cartesian
 * displacement per year. Source: HYG pmra/pmdec (mas/yr at J2000).
 *
 * Most stars have proper motion < 50 mas/yr — invisible at human
 * timescales. The drama is at the extremes: Barnard's Star (~10,000
 * mas/yr) will streak visibly across the sky as the time-warp
 * slider advances thousands of years. Use uYearsFromEpoch in the
 * BrightStarField shader.
 */
export const BRIGHT_STAR_MOTION_PER_YEAR = new Float32Array(${JSON.stringify(Array.from(motionPerYear).map((v) => Number(v.toExponential(4))))})

/**
 * Per-star metadata for the ${named.length} naked-eye stars with proper
 * names (Sirius, Vega, Betelgeuse, etc.). Keyed by index into the
 * arrays above — \`i\` is the star's position in BRIGHT_STAR_POSITIONS.
 *
 *   n: proper name
 *   h: Yale Bright Star Catalogue (HR) number
 *  hd: Henry Draper number
 *   m: apparent V magnitude
 *   d: distance in light-years
 *   s: spectral type (Morgan-Keenan)
 */
export type NamedStarMeta = {
  i: number
  n: string
  h: number | null
  hd: number | null
  m: number
  d: number | null
  s: string | null
}

export const NAMED_STARS: NamedStarMeta[] = ${JSON.stringify(named, null, 0).replace(/\\\"/g, '"')}
`

  await ensureDir(path.dirname(OUT_FILE))
  await fs.writeFile(OUT_FILE, out, "utf8")
  const stat = await fs.stat(OUT_FILE)
  console.log(
    `Wrote ${path.relative(ROOT, OUT_FILE)} — ${(stat.size / 1024).toFixed(1)} KB raw (≈ ${(stat.size / 1024 / 3).toFixed(0)} KB Gzipped)`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
