/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine. Others may reference this work.
 * https://github.com/sinhaankur/portfolio-2026
 *
 * iss-live — the ISS's live sub-satellite point, computed locally.
 *
 * Given the station's real orbital elements (TLE), SGP4 gives the position in
 * an Earth-centred inertial frame; converting that to geodetic lat/lon/alt is
 * the "sub-point" — the spot on Earth the ISS is directly over, right now. We
 * compute this locally (same SGP4 the pass planner uses) rather than polling an
 * external "where is the ISS" API: the math is identical, it needs no network
 * per tick, and it keeps the provenance honest (we own the computation).
 *
 * Velocity magnitude is the ECI speed (|v|), i.e. orbital speed (~7.66 km/s for
 * the ISS) — the real number, not a ground-track speed.
 *
 * satellite.js is imported dynamically (a static import hangs `next build`).
 */

export type IssState = {
  /** Sub-satellite latitude, degrees (+N). */
  latDeg: number
  /** Sub-satellite longitude, degrees (+E, wrapped to -180..180). */
  lonDeg: number
  /** Geodetic altitude above the ellipsoid, km. */
  altKm: number
  /** Orbital speed |v|, km/s. */
  speedKms: number
  /** The instant this state is valid for. */
  at: Date
}

type Vec3 = { x: number; y: number; z: number }
type GeodeticRad = { longitude: number; latitude: number; height: number }
type Sgp4 = {
  twoline2satrec: (l1: string, l2: string) => unknown
  propagate: (rec: unknown, date: Date) => { position?: Vec3; velocity?: Vec3 } | false
  gstime: (date: Date) => number
  eciToGeodetic: (eci: Vec3, gmst: number) => GeodeticRad
  degreesLat: (rad: number) => number
  degreesLong: (rad: number) => number
}

/** Wrap a longitude in degrees into the -180..180 range. */
function wrapLon(deg: number): number {
  let d = ((deg + 180) % 360 + 360) % 360 - 180
  if (d === -180) d = 180
  return d
}

/**
 * A live-position tracker for one satellite. Parse the TLE once, then call
 * `stateAt(date)` as fast as you like — SGP4 is cheap, so a 1 Hz UI tick costs
 * nothing. Returns null only if propagation fails (a decayed/invalid element set).
 */
export async function createIssTracker(tle: [string, string]) {
  const sat = (await import("satellite.js")) as unknown as Sgp4
  const rec = sat.twoline2satrec(tle[0], tle[1])

  function stateAt(date: Date = new Date()): IssState | null {
    const pv = sat.propagate(rec, date)
    if (!pv || !pv.position) return null
    const gmst = sat.gstime(date)
    const geo = sat.eciToGeodetic(pv.position, gmst)
    const v = pv.velocity
    const speedKms = v ? Math.hypot(v.x, v.y, v.z) : NaN
    return {
      latDeg: sat.degreesLat(geo.latitude),
      lonDeg: wrapLon(sat.degreesLong(geo.longitude)),
      altKm: geo.height,
      speedKms,
      at: date,
    }
  }

  return { stateAt }
}

/**
 * Reverse-geocode a sub-point to a coarse "what is it over" label — ocean or a
 * broad landmass region — WITHOUT any external service. This is intentionally
 * coarse (continent/ocean scale): honest about being an approximation, not a
 * precise place name, and it works offline. Good enough to answer "the ISS is
 * over the South Pacific / over Central Asia" as the dot moves.
 */
export function coarseRegion(latDeg: number, lonDeg: number): string {
  const lat = latDeg
  const lon = lonDeg
  // A few broad landmass boxes; everything else reads as the nearest ocean.
  const land: { name: string; latMin: number; latMax: number; lonMin: number; lonMax: number }[] = [
    { name: "North America", latMin: 15, latMax: 72, lonMin: -168, lonMax: -52 },
    { name: "South America", latMin: -56, latMax: 13, lonMin: -82, lonMax: -34 },
    { name: "Europe", latMin: 36, latMax: 71, lonMin: -10, lonMax: 40 },
    { name: "Africa", latMin: -35, latMax: 37, lonMin: -18, lonMax: 52 },
    { name: "Central & South Asia", latMin: 5, latMax: 55, lonMin: 40, lonMax: 90 },
    { name: "East Asia", latMin: 18, latMax: 54, lonMin: 90, lonMax: 146 },
    { name: "Southeast Asia", latMin: -11, latMax: 23, lonMin: 92, lonMax: 141 },
    { name: "Australia", latMin: -44, latMax: -10, lonMin: 112, lonMax: 154 },
    { name: "Antarctica", latMin: -90, latMax: -60, lonMin: -180, lonMax: 180 },
    { name: "the Arctic", latMin: 70, latMax: 90, lonMin: -180, lonMax: 180 },
  ]
  for (const r of land) {
    if (lat >= r.latMin && lat <= r.latMax && lon >= r.lonMin && lon <= r.lonMax) return r.name
  }
  // Oceans by longitude band + hemisphere.
  const south = lat < 0
  if (lon >= -70 && lon < 20) return south ? "the South Atlantic" : "the North Atlantic"
  if (lon >= 20 && lon < 150) return south ? "the Indian Ocean" : "the Arabian Sea / Bay of Bengal"
  return south ? "the South Pacific" : "the North Pacific"
}
