#!/usr/bin/env node
/**
 * fetch-satellites.mjs
 *
 * Builds the real satellite catalog for the /lab/celestial explorer's live
 * timeline. Pulls two public CelesTrak datasets and joins them by NORAD id:
 *   1. SATCAT  (JSON) — name, owner, object type, LAUNCH_DATE, orbit summary
 *   2. Active GP/TLE (TLE) — the two-line elements SGP4 needs to propagate
 *      each satellite's real position.
 *
 * Keeps active PAYLOADS with a valid launch date + TLE, trims to the fields the
 * client needs, sorts by launch date, and writes a single static JSON:
 *
 *   public/data/satellites.json
 *     { snapshot, count, sats: [{ id, name, owner, launchMs, l1, l2 }] }
 *
 * Owner codes are normalised to a small operator/category set for colouring.
 *
 * Run:  node scripts/fetch-satellites.mjs
 * Re-run to refresh (TLEs drift from reality within weeks; the snapshot date is
 * recorded in the file + shown in the UI).
 */

import { promises as fs } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const OUT = path.join(ROOT, "public/data/satellites.json")

const SATCAT_URL = "https://celestrak.org/satcat/records.php?GROUP=active&FORMAT=json"
const TLE_URL = "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle"

/**
 * Fetch a URL, but fall back to a local cache file if given and the fetch fails
 * (CelesTrak aggressively rate-limits repeat requests with 403). Pass cache
 * paths via env: SATCAT_CACHE / TLE_CACHE.
 */
async function getText(url, cachePath) {
  try {
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (celestial-fetch)" } })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const text = await r.text()
    if (text.length < 1000) throw new Error("suspiciously small response")
    return text
  } catch (e) {
    if (cachePath) {
      console.warn(`  ${url} failed (${e.message}); using cache ${cachePath}`)
      return fs.readFile(cachePath, "utf8")
    }
    throw new Error(`${url} → ${e.message}`)
  }
}

/** Parse a CelesTrak TLE file into a map: noradId → { name, l1, l2 }. */
function parseTle(text) {
  const lines = text.split(/\r?\n/)
  const map = new Map()
  for (let i = 0; i + 2 < lines.length; i += 3) {
    const name = lines[i].trim()
    const l1 = lines[i + 1]
    const l2 = lines[i + 2]
    if (!l1?.startsWith("1 ") || !l2?.startsWith("2 ")) {
      // not aligned to a 3-line block — resync by scanning
      i -= 2
      continue
    }
    const id = parseInt(l1.slice(2, 7), 10)
    if (!Number.isNaN(id)) map.set(id, { name, l1, l2 })
  }
  return map
}

main().catch((e) => {
  console.error("FAILED:", e.message)
  process.exit(1)
})

async function main() {
  console.log("Fetching CelesTrak SATCAT + TLE …")
  const [satcatRaw, tleRaw] = await Promise.all([
    getText(SATCAT_URL, process.env.SATCAT_CACHE),
    getText(TLE_URL, process.env.TLE_CACHE),
  ])
  const satcat = JSON.parse(satcatRaw)
  const tle = parseTle(tleRaw)
  console.log(`  SATCAT records: ${satcat.length}  |  TLE objects: ${tle.size}`)

  const sats = []
  for (const rec of satcat) {
    if (rec.OBJECT_TYPE !== "PAY") continue // payloads only (skip rocket bodies/debris)
    if (!rec.LAUNCH_DATE) continue
    const id = rec.NORAD_CAT_ID
    const t = tle.get(id)
    if (!t) continue // need TLE to propagate
    const launchMs = Date.parse(rec.LAUNCH_DATE + "T00:00:00Z")
    if (Number.isNaN(launchMs)) continue
    sats.push({
      id,
      name: rec.OBJECT_NAME,
      owner: rec.OWNER || "TBD",
      launchMs,
      l1: t.l1,
      l2: t.l2,
    })
  }

  sats.sort((a, b) => a.launchMs - b.launchMs)

  const payload = {
    snapshot: new Date().toISOString().slice(0, 10),
    source: "CelesTrak SATCAT + active GP/TLE",
    count: sats.length,
    sats,
  }

  await fs.mkdir(path.dirname(OUT), { recursive: true })
  await fs.writeFile(OUT, JSON.stringify(payload))
  const mb = ((await fs.stat(OUT)).size / 1048576).toFixed(2)
  console.log(`Wrote ${sats.length} satellites → public/data/satellites.json (${mb} MB)`)
  console.log(`Earliest: ${new Date(sats[0].launchMs).getUTCFullYear()}  Latest: ${new Date(sats.at(-1).launchMs).getUTCFullYear()}`)
}
