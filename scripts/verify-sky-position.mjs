#!/usr/bin/env node
/**
 * verify-sky-position.mjs — permanent, in-repo validation of the pure astronomy
 * library at lib/sky-position.ts, against KNOWN references (Meeus worked
 * examples, solstice/equinox geometry, and live-verified JPL Horizons planet
 * positions). Run with `pnpm sky:verify`.
 *
 * The library is TypeScript; rather than add a bundler we compile it with the
 * repo's own tsc into a temp dir and import the emitted JS. Zero new deps,
 * matching the repo's other standalone validators (dave:check, test:site).
 *
 * True north: lib/sky-position.ts is meant to be extractable, observatory-grade
 * astronomy (the Mission-analysis OSS lane). This keeps it honest as it grows.
 */

import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"

const ROOT = process.cwd()
const TSC = join(ROOT, "node_modules", "typescript", "bin", "tsc")

let pass = 0
let fail = 0
const results = []

function ok(name, condition, detail = "") {
  if (condition) pass++
  else fail++
  results.push(`${condition ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`)
}

/** Absolute angular error between two angles in degrees, wrap-aware. */
function angErr(a, b) {
  let d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

async function main() {
  const out = mkdtempSync(join(tmpdir(), "sky-verify-"))
  try {
    execFileSync("node", [
      TSC,
      join(ROOT, "lib", "sky-position.ts"),
      "--target", "ES2020",
      "--module", "ESNext",
      "--moduleResolution", "bundler",
      "--outDir", out,
      "--skipLibCheck",
    ], { stdio: ["ignore", "ignore", "inherit"] })

    const mod = await import(pathToFileURL(join(out, "sky-position.js")).href)
    const {
      julianDate, gmstDeg, equatorialToHorizontal, riseTransitSet,
      planetEquatorial, sunEquatorial, twilightPhase, darknessWindow,
      centroidRaDec, localSiderealDeg,
    } = mod

    // ---- 1. Time + sidereal (Meeus Example 12.a) -------------------------
    const d0 = new Date(Date.UTC(1987, 3, 10, 0, 0, 0))
    ok("JD 1987-04-10 0h UT = 2446895.5", Math.abs(julianDate(d0) - 2446895.5) < 1e-6)
    ok("GMST 1987-04-10 0h UT ≈ 197.693°", Math.abs(gmstDeg(d0) - 197.693195) < 0.02,
      `${gmstDeg(d0).toFixed(4)}°`)

    // ---- 2. Horizontal transform sanity ----------------------------------
    const nyc = { latDeg: 40.7128, lonDeg: -74.006 }
    const t = new Date(Date.UTC(2026, 6, 12, 3, 0, 0))
    const polaris = equatorialToHorizontal({ raHours: 2.53, decDeg: 89.264 }, nyc, t)
    ok("Polaris altitude ≈ observer latitude", Math.abs(polaris.altitudeDeg - 40.71) < 1.0,
      `${polaris.altitudeDeg.toFixed(2)}°`)
    ok("Polaris azimuth ≈ due north", Math.min(polaris.azimuthDeg, 360 - polaris.azimuthDeg) < 3,
      `${polaris.azimuthDeg.toFixed(1)}°`)
    const lst = localSiderealDeg(t, nyc.lonDeg)
    const zenith = equatorialToHorizontal({ raHours: lst / 15, decDeg: nyc.latDeg }, nyc, t)
    ok("Zenith star altitude ≈ 90°", Math.abs(zenith.altitudeDeg - 90) < 0.5,
      `${zenith.altitudeDeg.toFixed(3)}°`)

    // ---- 3. Rise/set circumstance ----------------------------------------
    ok("Polaris circumpolar from NYC",
      riseTransitSet({ raHours: 2.53, decDeg: 89.264 }, nyc, t).circumstance === "circumpolar")
    ok("Polaris never rises from Sydney",
      riseTransitSet({ raHours: 2.53, decDeg: 89.264 }, { latDeg: -33.87, lonDeg: 151.21 }, t).circumstance === "never")

    // ---- 4. Planet ephemeris vs LIVE JPL Horizons (2025-01-01 00:00 UT) ---
    const EARTH   = { aAU: 1.000, eccentricity: 0.017, inclDeg: 0.000, longNodeDeg: 0.0,    periLonDeg: 102.947, m0Deg: 357.517, periodDays: 365.25 }
    const MARS    = { aAU: 1.524, eccentricity: 0.094, inclDeg: 1.850, longNodeDeg: 49.558, periLonDeg: 336.041, m0Deg: 19.412,  periodDays: 686.97 }
    const JUPITER = { aAU: 5.203, eccentricity: 0.049, inclDeg: 1.303, longNodeDeg: 100.464,periLonDeg: 14.728,  m0Deg: 19.676,  periodDays: 4332.59 }
    const dJan = new Date(Date.UTC(2025, 0, 1))
    const mars = planetEquatorial(MARS, EARTH, dJan)
    const jup = planetEquatorial(JUPITER, EARTH, dJan)
    // JPL Horizons astrometric (ICRF): Mars 08h18m59.8s +23°37'; Jupiter 04h46m00.9s +21°44'.
    ok("Mars RA vs JPL Horizons (<1.5°)", angErr(mars.raHours * 15, 8.3165 * 15) < 1.5,
      `Δ ${(angErr(mars.raHours * 15, 8.3165 * 15) * 60).toFixed(0)}′`)
    ok("Mars Dec vs JPL Horizons (<1.5°)", Math.abs(mars.decDeg - 23.624) < 1.5,
      `Δ ${(Math.abs(mars.decDeg - 23.624) * 60).toFixed(0)}′`)
    ok("Jupiter RA vs JPL Horizons (<1.5°)", angErr(jup.raHours * 15, 4.7669 * 15) < 1.5,
      `Δ ${(angErr(jup.raHours * 15, 4.7669 * 15) * 60).toFixed(0)}′`)
    ok("Jupiter Dec vs JPL Horizons (<1.5°)", Math.abs(jup.decDeg - 21.741) < 1.5,
      `Δ ${(Math.abs(jup.decDeg - 21.741) * 60).toFixed(0)}′`)

    // ---- 5. Solar position + twilight ------------------------------------
    ok("Sun dec at June solstice ≈ +23.44°",
      Math.abs(sunEquatorial(new Date(Date.UTC(2025, 5, 21, 2, 42))).decDeg - 23.44) < 0.2)
    ok("Sun dec at Dec solstice ≈ −23.44°",
      Math.abs(sunEquatorial(new Date(Date.UTC(2025, 11, 21, 15, 3))).decDeg + 23.44) < 0.2)
    ok("Sun RA at March equinox ≈ 0h", (() => {
      const ra = sunEquatorial(new Date(Date.UTC(2025, 2, 20, 9, 1))).raHours
      return Math.min(ra, 24 - ra) < 0.15
    })())
    ok("Twilight thresholds map correctly",
      twilightPhase(5) === "day" && twilightPhase(-3) === "civil" &&
      twilightPhase(-9) === "nautical" && twilightPhase(-15) === "astronomical" &&
      twilightPhase(-25) === "night")
    // NYC sunset 2025-06-21 ≈ 00:31 UT next day (20:31 EDT).
    const dw = darknessWindow(nyc, new Date(Date.UTC(2025, 5, 21, 22, 0)))
    ok("NYC sunset 2025-06-21 within 15 min of almanac",
      dw.sunset && Math.abs((dw.sunset.getTime() - Date.UTC(2025, 5, 22, 0, 31)) / 60000) < 15,
      dw.sunset ? dw.sunset.toISOString().slice(11, 16) + " UT" : "null")

    // ---- 6. Constellation centroid ---------------------------------------
    const c = centroidRaDec([
      { raHours: 5.533, decDeg: -0.299 }, { raHours: 5.604, decDeg: -1.202 }, { raHours: 5.679, decDeg: -1.943 },
    ])
    ok("Orion belt centroid RA ≈ 5.605h", Math.abs(c.raHours - 5.605) < 0.05, `${c.raHours.toFixed(3)}h`)
  } finally {
    rmSync(out, { recursive: true, force: true })
  }

  console.log("\nSky-position library verification\n" + "─".repeat(40))
  for (const r of results) console.log(r)
  console.log("─".repeat(40))
  console.log(`${pass} passed, ${fail} failed\n`)
  process.exit(fail ? 1 : 0)
}

main().catch((err) => {
  console.error("verify-sky-position failed to run:", err)
  process.exit(1)
})
