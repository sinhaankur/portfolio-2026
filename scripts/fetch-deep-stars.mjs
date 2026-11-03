#!/usr/bin/env node
/**
 * fetch-deep-stars.mjs
 *
 * The DEEP real-star catalog for the Milky Way hero — every star in the HYG
 * database (not just the mag ≤ 6.5 naked-eye subset that bright-stars.ts ships),
 * projected to the same sky-shell and packed into a COMPACT BINARY for lazy
 * loading. These are the REAL measured stars that replace the engine's old
 * *procedural* spiral-arm points: each one is a catalogued star at its true
 * RA/Dec, with blackbody colour from its B-V index and a size from its apparent
 * magnitude. The Milky Way band emerges because real stars genuinely crowd the
 * galactic plane.
 *
 * Output: public/data/deep-stars.bin  (fetched lazily by the galaxy hero)
 *   Layout: a small JSON-ish header line is NOT used; the file is pure binary.
 *   [0..3]   uint32  count N
 *   then three contiguous typed blocks, each N long:
 *     positions : int16  × 3N   (x,y,z on the sky-shell, scaled by POS_SCALE)
 *     colors    : uint8  × 3N   (r,g,b 0..255, blackbody from B-V)
 *     mags      : uint8  × N    ((mag + 2) × 8, so −2..30 fits 0..255; size derives)
 *   Sorted brightest-first so the renderer can slice the head for a mobile cap.
 *
 * Run with:  node scripts/fetch-deep-stars.mjs   (or: pnpm data:deepstars)
 * Reuses the cached HYG CSV from fetch-bright-stars.mjs (scripts/.cache).
 */
import { promises as fs } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const CACHE_FILE = path.join(ROOT, "scripts", ".cache", "hyg-v41.csv")
const OUT_FILE = path.join(ROOT, "public", "data", "deep-stars.bin")

const HYG_URL =
  "https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v41.csv"

// Sky-shell radius — matches BRIGHT_STAR_SKY_SHELL so the deep stars sit on the
// SAME shell as the naked-eye stars + constellations.
const SKY_SHELL = 150
// int16 position scale: shell is ±150, we store ×200 → ±30000, inside int16 range.
const POS_SCALE = 200
// No magnitude cap — we want the whole catalogue (the faint band stars are the
// point). The Sun (id 0) is skipped.

/* --- B-V → temperature → blackbody RGB (same physics as bright-stars) ------ */
function bvToTemp(bv) {
  const t = Math.max(-0.4, Math.min(2.0, bv))
  return 4600 * (1 / (0.92 * t + 1.7) + 1 / (0.92 * t + 0.62))
}
function tempToRgb(kelvin) {
  const t = Math.max(1000, Math.min(40000, kelvin)) / 100
  let r, g, b
  if (t <= 66) r = 255
  else r = 329.7 * Math.pow(t - 60, -0.1332)
  if (t <= 66) g = 99.47 * Math.log(t) - 161.12
  else g = 288.12 * Math.pow(t - 60, -0.0755)
  if (t >= 66) b = 255
  else if (t <= 19) b = 0
  else b = 138.52 * Math.log(t - 10) - 305.04
  const cl = (v) => Math.max(0, Math.min(255, v))
  let rgb = [cl(r), cl(g), cl(b)]
  const peak = Math.max(rgb[0], rgb[1], rgb[2]) || 1
  return rgb.map((v) => Math.round((v / peak) * 255))
}
function bvToRgb(bv) { return tempToRgb(bvToTemp(bv)) }

function raDecToCartesian(raHours, decDeg, radius) {
  const raRad = (raHours / 24) * 2 * Math.PI
  const decRad = (decDeg / 180) * Math.PI
  const cosDec = Math.cos(decRad)
  return [radius * cosDec * Math.cos(raRad), radius * Math.sin(decRad), radius * cosDec * Math.sin(raRad)]
}

function parseCsvLine(line) {
  const out = []; let cur = "", inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++ } else inQ = !inQ }
    else if (c === "," && !inQ) { out.push(cur); cur = "" }
    else cur += c
  }
  out.push(cur); return out
}

async function ensureHyg() {
  try { await fs.access(CACHE_FILE); return } catch { /* download */ }
  await fs.mkdir(path.dirname(CACHE_FILE), { recursive: true })
  console.log("Downloading HYG…")
  const res = await fetch(HYG_URL)
  if (!res.ok) throw new Error(`HYG download failed: ${res.status}`)
  await fs.writeFile(CACHE_FILE, await res.text(), "utf8")
}

async function main() {
  await ensureHyg()
  const text = await fs.readFile(CACHE_FILE, "utf8")
  const lines = text.split(/\r?\n/)
  const header = parseCsvLine(lines[0])
  const col = (name) => header.indexOf(name)
  const iRa = col("ra"), iDec = col("dec"), iMag = col("mag"), iCi = col("ci"),
        iId = col("id"), iProper = col("proper")

  const stars = []
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue
    const c = parseCsvLine(lines[i])
    if (c.length < header.length) continue
    if (c[iId] === "0" || c[iProper] === "Sol") continue      // skip the Sun
    const ra = Number(c[iRa]), dec = Number(c[iDec]), mag = Number(c[iMag])
    if (!Number.isFinite(ra) || !Number.isFinite(dec) || !Number.isFinite(mag)) continue
    const bv = Number(c[iCi])
    const [x, y, z] = raDecToCartesian(ra, dec, SKY_SHELL)
    const [cr, cg, cb] = bvToRgb(Number.isFinite(bv) ? bv : 0.6)
    stars.push({ x, y, z, cr, cg, cb, mag })
  }
  stars.sort((a, b) => a.mag - b.mag)        // brightest first (mobile can slice)
  const N = stars.length
  console.log(`Packing ${N.toLocaleString()} real stars…`)

  // ---- pack the binary ----
  const headerBytes = 4
  const posBytes = N * 3 * 2     // int16
  const colBytes = N * 3         // uint8
  const magBytes = N            // uint8
  const buf = new ArrayBuffer(headerBytes + posBytes + colBytes + magBytes)
  const dv = new DataView(buf)
  dv.setUint32(0, N, true)
  const pos = new Int16Array(buf, headerBytes, N * 3)
  const colBase = headerBytes + posBytes
  const col8 = new Uint8Array(buf, colBase, N * 3)
  const magBase = colBase + colBytes
  const mag8 = new Uint8Array(buf, magBase, N)
  for (let i = 0; i < N; i++) {
    const s = stars[i]
    pos[i * 3] = Math.round(s.x * POS_SCALE)
    pos[i * 3 + 1] = Math.round(s.y * POS_SCALE)
    pos[i * 3 + 2] = Math.round(s.z * POS_SCALE)
    col8[i * 3] = s.cr; col8[i * 3 + 1] = s.cg; col8[i * 3 + 2] = s.cb
    mag8[i] = Math.max(0, Math.min(255, Math.round((s.mag + 2) * 8)))
  }

  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true })
  await fs.writeFile(OUT_FILE, Buffer.from(buf))
  const kb = (buf.byteLength / 1024).toFixed(0)
  console.log(`Wrote ${path.relative(ROOT, OUT_FILE)} — ${kb} KB (${N} stars; gzips to ~${Math.round(buf.byteLength / 1024 / 2.2)} KB)`)
  console.log(`  layout: uint32 N · int16[3N] pos(×${POS_SCALE}) · uint8[3N] rgb · uint8[N] mag((m+2)×8)`)
}

main().catch((e) => { console.error(e); process.exit(1) })
