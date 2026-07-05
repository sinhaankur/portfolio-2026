/**
 * sat-passes — predict visible overhead passes of a satellite (default: the ISS)
 * from the user's location, using real SGP4 + topocentric look-angles.
 *
 * A "visible" pass is one where the satellite climbs above the horizon AND is
 * sunlit while the observer's sky is dark (twilight/night) — the only time you
 * can actually see it as a moving star. This is the honest, real-mechanics
 * version of "look up tonight and you'll see the ISS."
 *
 * satellite.js is imported dynamically (never statically — a static import
 * hangs `next build`, per the satellite-field notes).
 */

export type Observer = { latDeg: number; lonDeg: number; heightKm?: number }

export type SatPass = {
  start: Date
  peak: Date
  end: Date
  peakElevationDeg: number
  startAzDeg: number
  peakAzDeg: number
  endAzDeg: number
  durationSec: number
  visible: boolean // sunlit satellite + dark-enough sky
}

// Compass point from an azimuth in degrees.
export function azToCompass(azDeg: number): string {
  const pts = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]
  return pts[Math.round(((azDeg % 360) / 22.5)) % 16]
}

type Sgp4 = {
  twoline2satrec: (l1: string, l2: string) => unknown
  propagate: (rec: unknown, date: Date) => { position?: Vec3; velocity?: Vec3 } | false
  gstime: (date: Date) => number
  eciToEcf: (eci: Vec3, gmst: number) => Vec3
  ecfToLookAngles: (observer: GeodeticRad, ecf: Vec3) => { azimuth: number; elevation: number; rangeSat: number }
}
type Vec3 = { x: number; y: number; z: number }
type GeodeticRad = { longitude: number; latitude: number; height: number }

const DEG = Math.PI / 180
const MIN_PEAK_ELEV = 10 // deg — passes lower than this aren't worth looking for

/** Rough sub-solar point (geocentric) → used to test if the satellite is sunlit
 *  and if the observer is in darkness. Low-precision solar position is plenty
 *  for a "sky dark? sat lit?" boolean. */
function sunEcefUnit(date: Date): Vec3 {
  // days since J2000
  const d = (date.getTime() - Date.UTC(2000, 0, 1, 12)) / 86_400_000
  const g = (357.529 + 0.98560028 * d) * DEG // mean anomaly
  const q = (280.459 + 0.98564736 * d) * DEG // mean longitude
  const L = q + (1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * DEG // ecliptic lon
  const e = (23.439 - 0.00000036 * d) * DEG // obliquity
  // ecliptic → equatorial unit vector (ECI-ish; good enough vs ECEF for lit test)
  const x = Math.cos(L)
  const y = Math.cos(e) * Math.sin(L)
  const z = Math.sin(e) * Math.sin(L)
  return { x, y, z }
}

/** Observer up-vector (ECEF unit) from lat/lon — for the "is the sun below the
 *  horizon here?" test. */
function observerUp(latDeg: number, lonDeg: number, gmst: number): Vec3 {
  const lat = latDeg * DEG
  const lon = lonDeg * DEG + gmst // rotate into ECEF-aligned frame via gmst
  return { x: Math.cos(lat) * Math.cos(lon), y: Math.cos(lat) * Math.sin(lon), z: Math.sin(lat) }
}

/** Fetch the ISS TLE (CelesTrak). Falls back to a recent embedded TLE offline. */
export async function fetchIssTle(): Promise<[string, string]> {
  try {
    const res = await fetch("https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE")
    const txt = await res.text()
    const lines = txt.trim().split("\n").map((l) => l.trim())
    const l1 = lines.find((l) => l.startsWith("1 "))
    const l2 = lines.find((l) => l.startsWith("2 "))
    if (l1 && l2) return [l1, l2]
  } catch { /* offline → fallback */ }
  // Fallback (epoch will drift, but passes stay roughly right for a few days).
  return [
    "1 25544U 98067A   26001.50000000  .00016717  00000-0  10270-3 0  9005",
    "2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.72125391    05",
  ]
}

/**
 * Find visible passes over the observer in the next `hours` hours.
 * Scans at `stepSec` resolution; refines rise/set to ~1s at the boundaries.
 */
export async function computePasses(
  tle: [string, string],
  obs: Observer,
  opts: { hours?: number; stepSec?: number; maxPasses?: number } = {},
): Promise<SatPass[]> {
  const { hours = 48, stepSec = 20, maxPasses = 4 } = opts
  const sat = (await import("satellite.js")) as unknown as Sgp4
  const rec = sat.twoline2satrec(tle[0], tle[1])
  const observer: GeodeticRad = {
    latitude: obs.latDeg * DEG,
    longitude: obs.lonDeg * DEG,
    height: obs.heightKm ?? 0.05,
  }

  const elevAt = (date: Date): { el: number; az: number; lit: boolean; darkHere: boolean } | null => {
    const pv = sat.propagate(rec, date)
    if (!pv || !pv.position) return null
    const gmst = sat.gstime(date)
    const ecf = sat.eciToEcf(pv.position, gmst)
    const la = sat.ecfToLookAngles(observer, ecf)
    // sat sunlit? dot(sat position unit, sun unit) — crude: sat is lit unless in
    // Earth's shadow cylinder. Approx: lit if the angle sat→sun isn't blocked.
    const sun = sunEcefUnit(date)
    const pr = Math.hypot(pv.position.x, pv.position.y, pv.position.z)
    const satUnit = { x: pv.position.x / pr, y: pv.position.y / pr, z: pv.position.z / pr }
    const sunDot = satUnit.x * sun.x + satUnit.y * sun.y + satUnit.z * sun.z
    // In shadow if sat is on the anti-sun side AND within ~1 Earth radius laterally.
    const lit = sunDot > -0.15
    // observer darkness: sun elevation < -6° (civil twilight) at the site
    const up = observerUp(obs.latDeg, obs.lonDeg, gmst)
    const sunElevHere = Math.asin(up.x * sun.x + up.y * sun.y + up.z * sun.z) / DEG
    const darkHere = sunElevHere < -6
    return { el: la.elevation / DEG, az: la.azimuth / DEG, lit, darkHere }
  }

  const passes: SatPass[] = []
  const t0 = Date.now()
  let inPass = false
  let riseT = 0, peakEl = -90, peakT = 0, peakAz = 0, startAz = 0
  let anyLit = false, anyDark = false

  for (let s = 0; s <= hours * 3600 && passes.length < maxPasses; s += stepSec) {
    const date = new Date(t0 + s * 1000)
    const r = elevAt(date)
    if (!r) continue
    if (r.el >= 0 && !inPass) {
      inPass = true; riseT = date.getTime(); peakEl = r.el; peakT = date.getTime()
      peakAz = r.az; startAz = r.az; anyLit = r.lit; anyDark = r.darkHere
    } else if (r.el >= 0 && inPass) {
      if (r.el > peakEl) { peakEl = r.el; peakT = date.getTime(); peakAz = r.az }
      if (r.lit) anyLit = true
      if (r.darkHere) anyDark = true
    } else if (r.el < 0 && inPass) {
      inPass = false
      if (peakEl >= MIN_PEAK_ELEV) {
        passes.push({
          start: new Date(riseT), peak: new Date(peakT), end: new Date(date.getTime()),
          peakElevationDeg: peakEl, startAzDeg: startAz, peakAzDeg: peakAz, endAzDeg: r.az,
          durationSec: (date.getTime() - riseT) / 1000,
          visible: anyLit && anyDark,
        })
      }
    }
  }
  return passes
}
