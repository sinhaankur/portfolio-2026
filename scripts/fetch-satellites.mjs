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
// Major real debris clouds (fragmentation events) — TLE groups CelesTrak hosts.
// These are the bulk of trackable LEO debris. PARKED: the merge into the TLE
// map isn't wired yet — kept (underscored) as the reference list for when the
// SATCAT debris/rocket-body records get elements to propagate.
const _DEBRIS_TLE_URLS = [
  "https://celestrak.org/NORAD/elements/gp.php?GROUP=cosmos-1408-debris&FORMAT=tle",
  "https://celestrak.org/NORAD/elements/gp.php?GROUP=fengyun-1c-debris&FORMAT=tle",
  "https://celestrak.org/NORAD/elements/gp.php?GROUP=iridium-33-debris&FORMAT=tle",
  "https://celestrak.org/NORAD/elements/gp.php?GROUP=cosmos-2251-debris&FORMAT=tle",
]

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
  console.log(`  SATCAT records: ${satcat.length}  |  active TLE objects: ${tle.size}`)
  // Fetch the major debris-cloud TLE groups DIRECTLY (the SATCAT 'active' query
  // doesn't list debris, but these groups ARE debris by definition). Each entry
  // becomes a DEB object, dated to its known fragmentation event. Best-effort:
  // a group that fails (rate-limit) is skipped without breaking the build.
  const DEBRIS_GROUPS = [
    { id: "cosmos-1408-debris", eventMs: Date.parse("2021-11-15T00:00:00Z") }, // Russian ASAT test
    { id: "fengyun-1c-debris",  eventMs: Date.parse("2007-01-11T00:00:00Z") }, // Chinese ASAT test
    { id: "iridium-33-debris",  eventMs: Date.parse("2009-02-10T00:00:00Z") }, // Iridium-Cosmos collision
    { id: "cosmos-2251-debris", eventMs: Date.parse("2009-02-10T00:00:00Z") }, // (other half of the collision)
  ]
  // Load the PREVIOUS catalogue (if any) so a rate-limited debris group this run
  // falls back to the fragments we already had, instead of silently vanishing.
  // CelesTrak throttles hard, so any single group can fail on any run — but a
  // debris cloud doesn't disappear from the sky between builds, only from the
  // response. Merging against the prior file makes the debris set monotonic:
  // successful fetches refresh a cloud's TLEs; a failed one keeps last-known.
  let prevByGroup = new Map() // groupId → [DEB objs from last build]
  try {
    const prev = JSON.parse(await fs.readFile(OUT, "utf8"))
    for (const s of prev.sats || []) {
      if (s.type !== "DEB" || !s.group) continue
      if (!prevByGroup.has(s.group)) prevByGroup.set(s.group, [])
      prevByGroup.get(s.group).push(s)
    }
  } catch { /* no prior file — first build */ }

  const debrisObjs = []
  // Small retry with backoff — CelesTrak 403s on burst; a short pause often clears it.
  async function fetchGroup(id, tries = 3) {
    for (let attempt = 1; ; attempt++) {
      try {
        return parseTle(await getText(`https://celestrak.org/NORAD/elements/gp.php?GROUP=${id}&FORMAT=tle`))
      } catch (e) {
        if (attempt >= tries) throw e
        await new Promise((r) => setTimeout(r, 1500 * attempt))
      }
    }
  }
  for (const g of DEBRIS_GROUPS) {
    try {
      const m = await fetchGroup(g.id)
      for (const [id, v] of m) debrisObjs.push({ id, name: v.name, owner: "—", type: "DEB", group: g.id, launchMs: g.eventMs, l1: v.l1, l2: v.l2 })
      console.log(`  + ${g.id}: ${m.size} fragments`)
    } catch (e) {
      // Rate-limited/failed this run → keep the fragments from the last build.
      const kept = prevByGroup.get(g.id) || []
      for (const s of kept) debrisObjs.push(s)
      console.warn(`  (${g.id} failed: ${e.message}) — kept ${kept.length} from previous build`)
    }
  }

  // Keep PAYLOADS + ROCKET BODIES + DEBRIS, so the explorer shows the real LEO
  // environment (LeoLabs-style): active satellites AND the junk around them.
  // Each carries a `type`: "PAY" | "R/B" | "DEB" so the client can colour/size
  // debris distinctly. Only objects WITH a TLE (propagatable) are kept.
  const TYPES = new Set(["PAY", "R/B", "DEB"])
  const sats = []
  const counts = { PAY: 0, "R/B": 0, DEB: 0 }
  for (const rec of satcat) {
    if (!TYPES.has(rec.OBJECT_TYPE)) continue
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
      type: rec.OBJECT_TYPE, // PAY | R/B | DEB
      launchMs,
      site: rec.LAUNCH_SITE || undefined, // CelesTrak launch-site code (origin)
      l1: t.l1,
      l2: t.l2,
    })
    counts[rec.OBJECT_TYPE] = (counts[rec.OBJECT_TYPE] || 0) + 1
  }

  // Append the directly-fetched debris fragments.
  for (const d of debrisObjs) { sats.push(d); counts.DEB++ }

  sats.sort((a, b) => a.launchMs - b.launchMs)

  const payload = {
    snapshot: new Date().toISOString().slice(0, 10),
    source: "CelesTrak SATCAT + GP/TLE (payloads + rocket bodies + debris)",
    count: sats.length,
    breakdown: counts,
    sats,
  }
  console.log(`  Payloads ${counts.PAY} · rocket bodies ${counts["R/B"]} · debris ${counts.DEB}`)

  await fs.mkdir(path.dirname(OUT), { recursive: true })
  await fs.writeFile(OUT, JSON.stringify(payload))
  const mb = ((await fs.stat(OUT)).size / 1048576).toFixed(2)
  console.log(`Wrote ${sats.length} satellites → public/data/satellites.json (${mb} MB)`)
  console.log(`Earliest: ${new Date(sats[0].launchMs).getUTCFullYear()}  Latest: ${new Date(sats.at(-1).launchMs).getUTCFullYear()}`)
}
