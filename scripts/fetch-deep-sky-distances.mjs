/**
 * fetch-deep-sky-distances.mjs — replace every "—" distance in the deep-sky
 * catalog with a REAL published distance from SIMBAD (CDS, Strasbourg).
 *
 * The 587 deep-sky blobs are all real objects (real RA/Dec/magnitude from
 * OpenNGC) but shipped with distance:"—". SIMBAD carries measured distances
 * (parallax / standard-candle) for the vast majority. We query each by its
 * Messier/NGC/IC identifier, convert to light-years, and rewrite the catalog so
 * every blob shows a true distance — and sits at its true depth in the scene.
 *
 * Idempotent: only fills "—" entries, leaves real ones alone. Run:
 *   node scripts/fetch-deep-sky-distances.mjs
 */

import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")
const FILE = join(ROOT, "lib/data/deep-sky.ts")

const MPC_TO_LY = 3.2615638e6
const KPC_TO_LY = 3261.5638
const PC_TO_LY = 3.2615638

function toLightYears(dist, unit) {
  const u = (unit || "").trim().toLowerCase()
  if (u === "mpc") return dist * MPC_TO_LY
  if (u === "kpc") return dist * KPC_TO_LY
  if (u === "pc") return dist * PC_TO_LY
  return null
}

/** Human-format a light-year distance to 3 significant figures. */
function fmtLy(ly) {
  if (ly >= 1e6) return `${Number((ly / 1e6).toPrecision(3))} million ly`
  return `${Number(ly.toPrecision(3)).toLocaleString()} ly`
}

/** Derive a SIMBAD identifier from our id + designation. */
function simId(id, desig) {
  const d = desig || ""
  const m = d.match(/\bM\s?(\d+)\b/)
  if (m) return `M ${m[1]}`
  const ngc = d.match(/NGC\s?(\d+)/i) || id.match(/ngc(\d+)/i)
  if (ngc) return `NGC ${ngc[1]}`
  const ic = d.match(/IC\s?(\d+)/i) || id.match(/ic(\d+)/i)
  if (ic) return `IC ${ic[1]}`
  // hand-mapped oddballs
  const MANUAL = { "c6": "NGC 6543" }
  return MANUAL[id] ?? null
}

async function simbadDistance(ident) {
  const q =
    `SELECT mesdistance.dist, mesdistance.unit FROM basic ` +
    `JOIN ident ON basic.oid=ident.oidref ` +
    `LEFT JOIN mesdistance ON basic.oid=mesdistance.oidref ` +
    `WHERE id='${ident.replace(/'/g, "''")}'`
  const url =
    `https://simbad.u-strasbg.fr/simbad/sim-tap/sync?request=doQuery&lang=adql&format=json&query=` +
    encodeURIComponent(q)
  const res = await fetch(url, { headers: { accept: "application/json" } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  const rows = (json.data || []).filter((r) => typeof r[0] === "number")
  if (!rows.length) return null
  // Prefer the median distance measurement to avoid outliers.
  const lys = rows.map((r) => toLightYears(r[0], r[1])).filter((x) => x && isFinite(x)).sort((a, b) => a - b)
  if (!lys.length) return null
  return lys[Math.floor(lys.length / 2)]
}

async function main() {
  let src = readFileSync(FILE, "utf8")
  // parse the id + designation + current distance of every entry
  const entries = [...src.matchAll(/"id":\s*"([^"]+)",\s*"name":\s*"[^"]*",\s*"designation":\s*"([^"]*)"[\s\S]*?"distance":\s*"([^"]*)"/g)]
    .map((m) => ({ id: m[1], desig: m[2], distance: m[3] }))
  const todo = entries.filter((e) => e.distance === "—")
  console.log(`${entries.length} objects, ${todo.length} missing distance. Querying SIMBAD…`)

  const resolved = {}
  let ok = 0
  for (const e of todo) {
    const ident = simId(e.id, e.desig)
    if (!ident) { process.stdout.write("·"); continue }
    try {
      const ly = await simbadDistance(ident)
      if (ly) { resolved[e.id] = fmtLy(ly); ok++; process.stdout.write("✓") }
      else process.stdout.write("·")
    } catch { process.stdout.write("✗") }
    await new Promise((r) => setTimeout(r, 90))
  }
  console.log(`\n${ok}/${todo.length} distances resolved from SIMBAD.`)

  // Rewrite: for each resolved id, replace its "distance": "—" with the real value.
  let replaced = 0
  for (const [id, dist] of Object.entries(resolved)) {
    const re = new RegExp(`("id":\\s*"${id}"[\\s\\S]*?"distance":\\s*)"—"`)
    if (re.test(src)) { src = src.replace(re, `$1"${dist}"`); replaced++ }
  }
  writeFileSync(FILE, src)
  console.log(`Rewrote ${replaced} distances into lib/data/deep-sky.ts`)
}

main()
