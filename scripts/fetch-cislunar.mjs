/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 *
 * fetch-cislunar.mjs — bake real CISLUNAR object trajectories for /lab/celestial.
 *
 * The Satellite Engine tracks Earth-orbit objects via CelesTrak TLEs + SGP4.
 * That model CANNOT handle Moon-crossing / escape trajectories, and CelesTrak
 * doesn't publish cislunar objects at all — which is exactly why a spent Falcon 9
 * stage drifting to the Moon (the Aug-2026 impact) fell into the engine's blind
 * spot. The people who DO track these compute n-body orbits: JPL Horizons carries
 * many artificial deep-space objects with real SPICE ephemerides.
 *
 * This script queries JPL Horizons for each object's GEOCENTRIC state vectors
 * (Earth-centered, km) over its approach window and writes a sampled ephemeris to
 * public/data/cislunar.json — the same static-site bake pattern as
 * fetch-satellites.mjs / bake-conjunctions.ts. The runtime interpolates it and
 * draws the object's TRUE path arcing toward the Moon, in the same Earth-centered
 * frame the satellite field uses (so it's flyable + consistent).
 *
 * Frame: CENTER='500@399' (Earth geocentre), OUT_UNITS='KM-S', ICRF vectors.
 * The runtime maps (x, z, -y)·kmToScene to match satellite-field's convention.
 *
 * Run:  node scripts/fetch-cislunar.mjs
 * Honesty: n-body ephemeris from JPL Horizons/SPICE; solar-radiation-pressure on
 * a tumbling body is the dominant residual uncertainty (Horizons folds in the
 * latest fit). Snapshot + source are recorded in the file and shown in the UI.
 */

import { writeFileSync } from "node:fs"

const HORIZONS = "https://ssd.jpl.nasa.gov/api/horizons.api"

/** Objects to bake. `command` is the Horizons record (SPICE id or designation).
 *  Windows are chosen to capture the interesting final approach. */
const OBJECTS = [
  {
    id: "2025-010D",
    command: "-162719", // Horizons SPICE id for the Falcon 9 RB booster
    name: "Falcon 9 stage (2025-010D)",
    kind: "impactor",
    // approach window → a little past the predicted impact so the path reaches it
    start: "2026-08-01",
    stop: "2026-08-05 06:36",
    step: "1h",
    note: "Falcon 9 Block-5 upper stage that launched Firefly's Blue Ghost. Impacted the Moon 2026-08-05 06:35:37 UTC near Einstein/Bell craters.",
  },
]

async function horizonsVectors(o) {
  const qs = new URLSearchParams({
    format: "text",
    COMMAND: `'${o.command}'`,
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'VECTORS'",
    CENTER: "'500@399'", // Earth geocentre
    START_TIME: `'${o.start}'`,
    STOP_TIME: `'${o.stop}'`,
    STEP_SIZE: `'${o.step}'`,
    VEC_TABLE: "'2'", // position + velocity
    OUT_UNITS: "'KM-S'",
    REF_PLANE: "'FRAME'", // ICRF/J2000 equatorial (matches ECI convention)
  })
  const res = await fetch(`${HORIZONS}?${qs}`)
  if (!res.ok) throw new Error(`Horizons HTTP ${res.status} for ${o.id}`)
  const text = await res.text()
  return parseVectors(text)
}

/** Parse the $$SOE…$$EOE vector block into [{tMs, x,y,z, vx,vy,vz}]. */
function parseVectors(text) {
  const soe = text.indexOf("$$SOE")
  const eoe = text.indexOf("$$EOE")
  if (soe < 0 || eoe < 0) {
    const err = text.match(/No matches|error|Cannot|EXCEEDED/i)
    throw new Error(`No vectors returned${err ? ` (${err[0]})` : ""}`)
  }
  const body = text.slice(soe + 5, eoe).trim().split("\n")
  const out = []
  for (let i = 0; i < body.length; i++) {
    const line = body[i]
    // epoch line: "<JD> = A.D. 2026-Aug-04 00:00:00.0000 TDB"
    const dateM = line.match(/A\.D\.\s+([\d]{4}-[A-Za-z]{3}-[\d]{2}\s[\d:.]+)/)
    if (!dateM) continue
    const tMs = tdbToMs(dateM[1])
    const posLine = body[i + 1] || ""
    const velLine = body[i + 2] || ""
    const p = posLine.match(/X\s*=\s*([-\d.E+]+)\s+Y\s*=\s*([-\d.E+]+)\s+Z\s*=\s*([-\d.E+]+)/)
    const v = velLine.match(/VX\s*=\s*([-\d.E+]+)\s+VY\s*=\s*([-\d.E+]+)\s+VZ\s*=\s*([-\d.E+]+)/)
    if (!p) continue
    out.push({
      tMs,
      x: +p[1], y: +p[2], z: +p[3],
      vx: v ? +v[1] : 0, vy: v ? +v[2] : 0, vz: v ? +v[3] : 0,
    })
    i += 2
  }
  return out
}

const MON = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 }
function tdbToMs(s) {
  // "2026-Aug-04 06:00:00.0000" → UTC ms (TDB≈UTC to within ~1 min at this scale;
  // fine for a visual track. We keep it simple and treat the label as UTC.)
  const m = s.match(/(\d{4})-([A-Za-z]{3})-(\d{2})\s(\d{2}):(\d{2}):(\d{2})/)
  if (!m) return NaN
  return Date.UTC(+m[1], MON[m[2]], +m[3], +m[4], +m[5], +m[6])
}

async function main() {
  const objects = []
  for (const o of OBJECTS) {
    process.stdout.write(`Fetching ${o.name} from JPL Horizons… `)
    try {
      const samples = await horizonsVectors(o)
      if (!samples.length) throw new Error("empty ephemeris")
      objects.push({
        id: o.id,
        name: o.name,
        kind: o.kind,
        note: o.note,
        impactMs: OBJECTS[0].id === o.id ? Date.UTC(2026, 7, 5, 6, 35, 37) : undefined,
        samples,
      })
      console.log(`${samples.length} samples ✓`)
    } catch (e) {
      console.log(`FAILED: ${e.message}`)
    }
  }

  const payload = {
    snapshot: new Date().toISOString(),
    source: "JPL Horizons (ssd.jpl.nasa.gov) — geocentric ICRF state vectors, KM-S",
    frame: "geocentric-icrf-km",
    objects,
  }
  const outUrl = new URL("../public/data/cislunar.json", import.meta.url)
  writeFileSync(outUrl, JSON.stringify(payload))
  console.log(`Wrote ${objects.length} object(s) → public/data/cislunar.json`)
}

main().catch((e) => { console.error(e); process.exit(1) })
