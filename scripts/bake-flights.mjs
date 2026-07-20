#!/usr/bin/env node
/**
 * bake-flights.mjs
 *
 * Bakes a real snapshot of aircraft in flight from the OpenSky Network's free
 * public API into a static JSON the /lab/celestial explorer can render — the
 * "planes" layer of the zoom-into-Earth descent.
 *
 * WHY BAKED, NOT LIVE: the site is a static export (no server), and OpenSky's
 * API sets access-control-allow-origin to its OWN origin — so a browser fetch
 * from sinhaankur.com is blocked by CORS. So we fetch it at BUILD TIME (server-
 * side, no CORS) on every deploy + the daily refresh, exactly like the satellite
 * catalogue + conjunction screen. The result is REAL aircraft positions from the
 * moment of the deploy — honestly labelled "snapshot", not a live feed.
 *
 *   public/data/flights.json
 *     { snapshot, count, source, flights: [{ icao, call, lon, lat, altM, velMs, hdg, country }] }
 *
 * Run:  node scripts/bake-flights.mjs
 * If OpenSky is unreachable/rate-limited, the deploy keeps the committed snapshot
 * (the workflow step is `|| echo warning`, like the orbital-data refresh).
 */

import { promises as fs } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const OUT = path.join(ROOT, "public/data/flights.json")

// OpenSky global state-vectors (all airborne aircraft it can see right now).
const OPENSKY_URL = "https://opensky-network.org/api/states/all"
// Keep the file web-light: a global cap. The swarm reads as "planes over the
// world" at deep zoom; more than a few thousand is just fill.
const MAX_FLIGHTS = 4000

async function main() {
  let json
  try {
    const r = await fetch(OPENSKY_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (celestial-flights)" },
      signal: AbortSignal.timeout(30000),
    })
    if (!r.ok) throw new Error(`OpenSky HTTP ${r.status}`)
    json = await r.json()
  } catch (err) {
    console.error(`bake-flights: OpenSky fetch failed (${err.message}). Leaving existing snapshot.`)
    process.exit(0) // don't fail the deploy — keep the committed flights.json
  }

  const states = Array.isArray(json.states) ? json.states : []
  // OpenSky state-vector indices: 0 icao24, 1 callsign, 2 origin_country,
  // 5 longitude, 6 latitude, 7 baro_altitude(m), 8 on_ground, 9 velocity(m/s),
  // 10 true_track(heading deg).
  const flights = []
  for (const s of states) {
    const lon = s[5], lat = s[6], onGround = s[8]
    if (onGround) continue                     // only aircraft in the air
    if (lon == null || lat == null) continue   // need a real position
    const altM = s[7]
    if (altM == null || altM < 150) continue   // drop ground clutter / bad data
    flights.push({
      icao: s[0],
      call: (s[1] || "").trim() || null,
      lon: Math.round(lon * 1000) / 1000,
      lat: Math.round(lat * 1000) / 1000,
      altM: Math.round(altM),
      velMs: s[9] != null ? Math.round(s[9]) : null,
      hdg: s[10] != null ? Math.round(s[10]) : null,
      country: s[2] || null,
    })
    if (flights.length >= MAX_FLIGHTS) break
  }

  const payload = {
    snapshot: new Date().toISOString(),
    count: flights.length,
    source: "OpenSky Network (opensky-network.org) — free public ADS-B feed",
    flights,
  }
  await fs.mkdir(path.dirname(OUT), { recursive: true })
  await fs.writeFile(OUT, JSON.stringify(payload))
  const kb = Math.round((JSON.stringify(payload).length / 1024))
  console.log(`Wrote ${flights.length} flights → public/data/flights.json (${kb} KB)`)
}

main().catch((e) => { console.error(e); process.exit(1) })
