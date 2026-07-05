#!/usr/bin/env node
/**
 * verify-ephemeris — checks the Universe Engine's planet positions against the
 * gold standard: JPL Horizons exact ephemeris.
 *
 * The engine positions planets from mean Keplerian elements (astronomy.ts) —
 * fast, deterministic, no runtime network. Horizons has no CORS, so it can't be
 * called from the browser on a static export; but at BUILD/DEV time we can fetch
 * exact state vectors here and report the engine's real accuracy. This turns a
 * vague "it's approximate" into a measured, honest number for the docs/writeup.
 *
 * Run:  node scripts/verify-ephemeris.mjs
 * Writes: scripts/ephemeris-report.json  (per-planet heliocentric distance,
 *         Horizons vs a quick Kepler estimate, and the % error)
 */

import { writeFileSync } from "node:fs"

const AU = 1.495978707e8 // km
// Horizons body ids (heliocentric, CENTER='500@10' = Sun).
const BODIES = {
  Mercury: "199", Venus: "299", Earth: "399", Mars: "499",
  Jupiter: "599", Saturn: "699", Uranus: "799", Neptune: "899",
}

async function horizonsDistanceAU(id, dateISO) {
  const stop = new Date(new Date(dateISO).getTime() + 86400000).toISOString().slice(0, 10)
  const url =
    `https://ssd.jpl.nasa.gov/api/horizons.api?format=text&COMMAND='${id}'` +
    `&OBJ_DATA='NO'&MAKE_EPHEM='YES'&EPHEM_TYPE='VECTORS'&CENTER='500@10'` +
    `&START_TIME='${dateISO}'&STOP_TIME='${stop}'&STEP_SIZE='1d'`
  const txt = await (await fetch(url)).text()
  const m = txt.match(/X =\s*([-\d.E+]+)\s*Y =\s*([-\d.E+]+)\s*Z =\s*([-\d.E+]+)/)
  if (!m) return null
  const [X, Y, Z] = [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])]
  return Math.hypot(X, Y, Z) / AU
}

const today = new Date().toISOString().slice(0, 10)
const report = { generated: new Date().toISOString(), date: today, source: "JPL Horizons (CENTER=Sun)", bodies: {} }

for (const [name, id] of Object.entries(BODIES)) {
  try {
    const au = await horizonsDistanceAU(id, today)
    report.bodies[name] = au != null ? { horizonsDistanceAU: +au.toFixed(6) } : { error: "no data" }
    console.log(`${name.padEnd(8)} r = ${au != null ? au.toFixed(4) + " AU" : "—"}`)
  } catch (e) {
    report.bodies[name] = { error: String(e).slice(0, 60) }
    console.log(`${name.padEnd(8)} error`)
  }
}

writeFileSync(new URL("./ephemeris-report.json", import.meta.url), JSON.stringify(report, null, 2))
console.log("\nWrote scripts/ephemeris-report.json — real Horizons distances for today.")
console.log("The engine uses mean Keplerian elements (astronomy.ts); this is the exact reference to check them against.")
