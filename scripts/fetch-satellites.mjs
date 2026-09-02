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
  // Load the previous build once — used as the fallback for BOTH the payload
  // feed (if CelesTrak throttles the main GP/SATCAT request) and each debris
  // group. A satellite map doesn't empty out between builds just because a
  // request 403'd, so a throttled run refreshes what it can and keeps the rest.
  let prevBuild = null
  try {
    prevBuild = JSON.parse(await fs.readFile(OUT, "utf8"))
  } catch { /* first build — no prior file */ }

  // Fetch SATCAT + active TLE; if the live feed fails (403 burst), reuse the
  // prior build's payloads so the whole catalogue never collapses to nothing.
  let satcat, tle, usedPrevPayloads = false
  try {
    const [satcatRaw, tleRaw] = await Promise.all([
      getText(SATCAT_URL, process.env.SATCAT_CACHE),
      getText(TLE_URL, process.env.TLE_CACHE),
    ])
    satcat = JSON.parse(satcatRaw)
    tle = parseTle(tleRaw)
    console.log(`  SATCAT records: ${satcat.length}  |  active TLE objects: ${tle.size}`)
  } catch (e) {
    if (!prevBuild) throw new Error(`payload feed failed and no prior build to fall back to → ${e.message}`)
    console.warn(`  payload feed failed (${e.message}) — reusing ${prevBuild.sats.filter((s) => s.type === "PAY" || s.type === "R/B").length} payloads from previous build`)
    usedPrevPayloads = true
    // Rebuild `satcat` + `tle` from the prior file so the merge below is uniform.
    satcat = prevBuild.sats
      .filter((s) => s.type === "PAY" || s.type === "R/B")
      .map((s) => ({ NORAD_CAT_ID: s.id, OBJECT_NAME: s.name, OWNER: s.owner, OBJECT_TYPE: s.type, LAUNCH_DATE: new Date(s.launchMs).toISOString().slice(0, 10), LAUNCH_SITE: s.site }))
    tle = new Map(prevBuild.sats.filter((s) => s.type === "PAY" || s.type === "R/B").map((s) => [s.id, { name: s.name, l1: s.l1, l2: s.l2 }]))
  }
  // Fetch the debris TLE groups DIRECTLY (the SATCAT 'active' query lists ONLY
  // payloads — it excludes debris + rocket bodies by design, so those must come
  // from the GP element groups). Each entry becomes a DEB object.
  //
  // Keyless honesty note: CelesTrak's public feeds expose the NAMED
  // fragmentation clouds + the `analyst` set (uncorrelated tracked objects),
  // NOT the full ~40k tracked-debris catalogue — that lives behind a
  // Space-Track.org account. So this is "the major tracked debris", labeled as
  // such in the UI, never presented as the complete population.
  //   • fragmentation clouds — dated to their known breakup event.
  //   • analyst — uncorrelated / unidentified tracked objects (effectively
  //     debris whose parent isn't attributed); no single event date, so they
  //     carry the epoch of their own TLE (dated when first tracked).
  const DEBRIS_GROUPS = [
    { id: "cosmos-1408-debris", eventMs: Date.parse("2021-11-15T00:00:00Z") }, // Russian ASAT test
    { id: "fengyun-1c-debris",  eventMs: Date.parse("2007-01-11T00:00:00Z") }, // Chinese ASAT test
    { id: "iridium-33-debris",  eventMs: Date.parse("2009-02-10T00:00:00Z") }, // Iridium-Cosmos collision
    { id: "cosmos-2251-debris", eventMs: Date.parse("2009-02-10T00:00:00Z") }, // (other half of the collision)
    { id: "analyst",            eventMs: null }, // uncorrelated tracked objects — date from each TLE epoch
  ]
  // Load the PREVIOUS catalogue (if any) so a rate-limited debris group this run
  // falls back to the fragments we already had, instead of silently vanishing.
  // CelesTrak throttles hard, so any single group can fail on any run — but a
  // debris cloud doesn't disappear from the sky between builds, only from the
  // response. Merging against the prior file makes the debris set monotonic:
  // successful fetches refresh a cloud's TLEs; a failed one keeps last-known.
  const prevByGroup = new Map() // groupId → [DEB objs from last build]
  for (const s of prevBuild?.sats || []) {
    if (s.type !== "DEB" || !s.group) continue
    if (!prevByGroup.has(s.group)) prevByGroup.set(s.group, [])
    prevByGroup.get(s.group).push(s)
  }
  // Also index the prior debris by NAME prefix, so clouds saved BEFORE the
  // `group` field existed (older builds) still back-fill a throttled group.
  const prevByNameGuess = (groupId) => {
    const key = groupId.replace(/-debris$/, "").replace(/-/g, " ").toUpperCase()
    return (prevBuild?.sats || []).filter((s) => s.type === "DEB" && s.name?.toUpperCase().startsWith(key))
  }

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
  // TLE line-1 epoch (cols 19–32, YYDDD.DDDD…) → ms. Used when a group has no
  // single event date (the `analyst` set) so each object still gets a real,
  // honest appearance date for the launch-timeline gate.
  const tleEpochMs = (l1) => {
    const yy = parseInt(l1.slice(18, 20), 10)
    const doy = parseFloat(l1.slice(20, 32))
    if (!Number.isFinite(yy) || !Number.isFinite(doy)) return Date.UTC(2000, 0, 1)
    const year = yy < 57 ? 2000 + yy : 1900 + yy
    return Date.UTC(year, 0, 1) + (doy - 1) * 86400000
  }
  for (const g of DEBRIS_GROUPS) {
    try {
      const m = await fetchGroup(g.id)
      for (const [id, v] of m) {
        const launchMs = g.eventMs ?? tleEpochMs(v.l1)
        debrisObjs.push({ id, name: v.name, owner: "—", type: "DEB", group: g.id, launchMs, l1: v.l1, l2: v.l2 })
      }
      console.log(`  + ${g.id}: ${m.size} fragments`)
    } catch (e) {
      // Rate-limited/failed this run → keep the fragments from the last build.
      // Prefer the group-tagged copy; fall back to a name-prefix match for
      // clouds saved before the `group` field existed.
      let kept = prevByGroup.get(g.id) || []
      if (kept.length === 0) kept = prevByNameGuess(g.id).map((s) => ({ ...s, group: g.id }))
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
    source: "CelesTrak SATCAT + GP/TLE — active payloads + rocket bodies + major tracked debris (fragmentation clouds + analyst set). Full ~40k debris catalogue is Space-Track-gated; not included.",
    count: sats.length,
    breakdown: counts,
    // True if the live payload feed was throttled this build and payloads came
    // from the previous snapshot (debris groups may still be fresh).
    payloadsFromPrevBuild: usedPrevPayloads || undefined,
    sats,
  }
  console.log(`  Payloads ${counts.PAY} · rocket bodies ${counts["R/B"]} · debris ${counts.DEB}`)

  await fs.mkdir(path.dirname(OUT), { recursive: true })
  await fs.writeFile(OUT, JSON.stringify(payload))
  const mb = ((await fs.stat(OUT)).size / 1048576).toFixed(2)
  console.log(`Wrote ${sats.length} satellites → public/data/satellites.json (${mb} MB)`)
  console.log(`Earliest: ${new Date(sats[0].launchMs).getUTCFullYear()}  Latest: ${new Date(sats.at(-1).launchMs).getUTCFullYear()}`)
}
