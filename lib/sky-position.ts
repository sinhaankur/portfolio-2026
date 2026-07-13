/**
 * sky-position.ts — observatory-grade equatorial → horizontal astronomy.
 *
 * Given an observer's latitude/longitude and an exact instant, convert a
 * star / planet / constellation's celestial coordinates (right ascension,
 * declination) into what the observer actually sees: altitude above the
 * horizon and azimuth (compass bearing). This is the same transform a
 * telescope mount's pointing computer runs — pure, deterministic, and
 * sourced from Meeus, *Astronomical Algorithms* (2nd ed.).
 *
 * No React, no R3F, no network. Everything here is a pure function of
 * (RA, Dec, lat, lon, time) so it is fully testable and honest: it reports
 * real geometry, never a guess.
 *
 * References:
 *   - GMST:  Meeus ch. 12, eq. 12.4 (mean sidereal time at Greenwich).
 *   - Alt/Az: Meeus ch. 13, eq. 13.5 / 13.6 (equatorial → horizontal).
 *   - Rise/transit/set: derived from the hour angle at altitude 0 (with the
 *     standard −0°34′ refraction allowance for the geometric horizon).
 */

const DEG = Math.PI / 180
const HOURS_TO_DEG = 15 // 24h of RA span 360°, so 1h = 15°

/** Normalise an angle in degrees to [0, 360). */
function norm360(deg: number): number {
  return ((deg % 360) + 360) % 360
}

/** Normalise an angle in degrees to (−180, 180]. */
function norm180(deg: number): number {
  const d = norm360(deg)
  return d > 180 ? d - 360 : d
}

/**
 * Julian Date from a JS Date (UTC). Valid across the Gregorian calendar,
 * which is all the engine needs (it runs at the user's real "now").
 */
export function julianDate(date: Date): number {
  return date.getTime() / 86_400_000 + 2_440_587.5
}

/**
 * Greenwich Mean Sidereal Time, in DEGREES [0, 360). Meeus eq. 12.4 — the
 * full polynomial (not the truncated linear form) so it stays accurate to
 * arc-seconds over the engine's ±century timeline.
 */
export function gmstDeg(date: Date): number {
  const jd = julianDate(date)
  const T = (jd - 2_451_545.0) / 36_525 // Julian centuries from J2000.0
  const theta =
    280.460_618_37 +
    360.985_647_366_29 * (jd - 2_451_545.0) +
    0.000_387_933 * T * T -
    (T * T * T) / 38_710_000
  return norm360(theta)
}

/**
 * Local (apparent) Sidereal Time in DEGREES for an observer at `lonDeg`
 * (east-positive, the ISO / GeoJSON convention that browser geolocation
 * returns). LST tells you which RA is currently on the meridian.
 */
export function localSiderealDeg(date: Date, lonDeg: number): number {
  return norm360(gmstDeg(date) + lonDeg)
}

export interface EquatorialCoord {
  /** Right ascension in HOURS [0, 24). */
  raHours: number
  /** Declination in DEGREES [−90, +90]. */
  decDeg: number
}

export interface Observer {
  /** Geodetic latitude, degrees, north-positive. */
  latDeg: number
  /** Geodetic longitude, degrees, EAST-positive. */
  lonDeg: number
}

export interface HorizontalCoord {
  /** Altitude above the true horizon, degrees. Negative = below horizon. */
  altitudeDeg: number
  /** Azimuth, degrees clockwise from due north [0, 360). */
  azimuthDeg: number
  /** Hour angle at the observed instant, degrees (−180, 180]. */
  hourAngleDeg: number
}

/**
 * Equatorial (RA/Dec) → horizontal (Alt/Az) for a given observer + instant.
 * Meeus eq. 13.5 / 13.6, with azimuth measured from NORTH (Meeus measures
 * from south; we add 180° to return the compass convention people expect).
 */
export function equatorialToHorizontal(
  coord: EquatorialCoord,
  observer: Observer,
  date: Date,
): HorizontalCoord {
  const lst = localSiderealDeg(date, observer.lonDeg)
  const ha = norm180(lst - coord.raHours * HOURS_TO_DEG) // local hour angle, deg

  const haRad = ha * DEG
  const decRad = coord.decDeg * DEG
  const latRad = observer.latDeg * DEG

  const sinAlt =
    Math.sin(decRad) * Math.sin(latRad) +
    Math.cos(decRad) * Math.cos(latRad) * Math.cos(haRad)
  const altitudeDeg = Math.asin(Math.max(-1, Math.min(1, sinAlt))) / DEG

  // Azimuth from north, clockwise. atan2 form is stable at the poles/zenith.
  const y = Math.sin(haRad)
  const x = Math.cos(haRad) * Math.sin(latRad) - Math.tan(decRad) * Math.cos(latRad)
  const azFromSouth = Math.atan2(y, x) / DEG
  const azimuthDeg = norm360(azFromSouth + 180)

  return { altitudeDeg, azimuthDeg, hourAngleDeg: ha }
}

const COMPASS_16 = [
  "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
]

/** 16-point compass label for an azimuth in degrees. */
export function compassPoint(azimuthDeg: number): string {
  const i = Math.round(norm360(azimuthDeg) / 22.5) % 16
  return COMPASS_16[i]
}

/**
 * A plain-language altitude descriptor for a beginner standing outside —
 * "overhead", "high", "low", or "below the horizon". Kept honest: it maps
 * the exact number, it doesn't embellish.
 */
export function altitudeBand(altitudeDeg: number): "below" | "low" | "mid" | "high" | "overhead" {
  if (altitudeDeg < 0) return "below"
  if (altitudeDeg < 15) return "low"
  if (altitudeDeg < 45) return "mid"
  if (altitudeDeg < 70) return "high"
  return "overhead"
}

export interface RiseTransitSet {
  /** Whether the body ever rises for this observer on this day. */
  circumstance: "rises" | "circumpolar" | "never"
  /** Local time the body crosses the horizon rising, or null. */
  rise: Date | null
  /** Local time of upper culmination (highest point), or null if never up. */
  transit: Date | null
  /** Local time the body sets, or null. */
  set: Date | null
  /** Altitude at transit, degrees — its highest point today. */
  transitAltitudeDeg: number
}

/**
 * Rise / transit / set for a body of (approximately) fixed RA/Dec on the day
 * containing `date`. Iterative refinement around the analytic hour-angle
 * solution — accurate to well under a minute for stars, and a good estimate
 * for planets (whose RA/Dec drift slowly over a night).
 *
 * `standardAltitudeDeg` is the altitude that counts as the horizon: the
 * default −0.5667° is the customary refraction+geometric allowance for a
 * star's apparent rise/set (Meeus). Pass 0 for a true geometric horizon.
 */
export function riseTransitSet(
  coord: EquatorialCoord,
  observer: Observer,
  date: Date,
  standardAltitudeDeg = -0.5667,
): RiseTransitSet {
  const decRad = coord.decDeg * DEG
  const latRad = observer.latDeg * DEG
  const h0 = standardAltitudeDeg * DEG

  // cos H = (sin h0 − sin φ sin δ) / (cos φ cos δ)
  const cosH =
    (Math.sin(h0) - Math.sin(latRad) * Math.sin(decRad)) /
    (Math.cos(latRad) * Math.cos(decRad))

  // Transit altitude is the same regardless of rise/set circumstance.
  const transitAltitudeDeg = 90 - Math.abs(observer.latDeg - coord.decDeg)

  // Find transit: the instant LST == RA (hour angle 0), searched over the day.
  const transit = solveTransit(coord, observer, date)

  if (cosH < -1) {
    // Never sets — up all day.
    return { circumstance: "circumpolar", rise: null, transit, set: null, transitAltitudeDeg }
  }
  if (cosH > 1) {
    // Never rises.
    return { circumstance: "never", rise: null, transit: null, set: null, transitAltitudeDeg }
  }

  const H = Math.acos(Math.max(-1, Math.min(1, cosH))) / DEG // hour angle, deg
  const hoursOffset = H / HOURS_TO_DEG // sidereal ≈ solar over a few hours; good enough, then refine
  const rise = transit ? refineHorizon(coord, observer, new Date(transit.getTime() - hoursOffset * 3_600_000), standardAltitudeDeg, "rise") : null
  const set = transit ? refineHorizon(coord, observer, new Date(transit.getTime() + hoursOffset * 3_600_000), standardAltitudeDeg, "set") : null

  return { circumstance: "rises", rise, transit, set, transitAltitudeDeg }
}

/** Find the transit (hour angle → 0) nearest `date` by binary search on HA sign. */
function solveTransit(coord: EquatorialCoord, observer: Observer, date: Date): Date {
  // Hour angle sweeps ~360°/sidereal-day; search ±12h around `date`.
  let lo = date.getTime() - 12 * 3_600_000
  let hi = date.getTime() + 12 * 3_600_000
  const haAt = (t: number) => equatorialToHorizontal(coord, observer, new Date(t)).hourAngleDeg
  // We want HA = 0 crossing from negative → positive. Bisect on that.
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2
    const ha = haAt(mid)
    if (ha < 0) lo = mid
    else hi = mid
  }
  return new Date((lo + hi) / 2)
}

/** Refine a rise/set estimate to the exact horizon crossing by bisection. */
function refineHorizon(
  coord: EquatorialCoord,
  observer: Observer,
  guess: Date,
  standardAltitudeDeg: number,
  kind: "rise" | "set",
): Date {
  const altAt = (t: number) => equatorialToHorizontal(coord, observer, new Date(t)).altitudeDeg - standardAltitudeDeg
  let lo = guess.getTime() - 30 * 60_000
  let hi = guess.getTime() + 30 * 60_000
  // Ensure the bracket straddles the crossing; nudge outward if not.
  for (let i = 0; i < 6 && Math.sign(altAt(lo)) === Math.sign(altAt(hi)); i++) {
    lo -= 20 * 60_000
    hi += 20 * 60_000
  }
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    const v = altAt(mid)
    // For a rise, altitude increases with time; for a set, it decreases.
    const increasing = kind === "rise"
    if ((v < 0) === increasing) lo = mid
    else hi = mid
  }
  return new Date((lo + hi) / 2)
}

/**
 * Centroid (mean) RA/Dec of a set of stars, for placing a constellation as a
 * single point in the observer's sky. RA is averaged on the circle (via the
 * unit-vector mean) so the 0h/24h wrap doesn't skew it.
 */
export function centroidRaDec(
  stars: { raHours: number; decDeg: number }[],
): EquatorialCoord {
  if (stars.length === 0) return { raHours: 0, decDeg: 0 }
  let sx = 0
  let sy = 0
  let sdec = 0
  for (const s of stars) {
    const raRad = s.raHours * HOURS_TO_DEG * DEG
    sx += Math.cos(raRad)
    sy += Math.sin(raRad)
    sdec += s.decDeg
  }
  const raHours = norm360((Math.atan2(sy, sx) / DEG)) / HOURS_TO_DEG
  return { raHours, decDeg: sdec / stars.length }
}
