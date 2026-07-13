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

/* ==========================================================================
 * Planet ephemeris — geocentric RA/Dec of a planet from its Keplerian
 * elements, so "Tonight's Sky" can place the planets (which move) alongside
 * the fixed constellations. Meeus ch. 25 (Sun/Earth) + ch. 33 (planets):
 *   1. heliocentric ecliptic position of the planet AND of Earth, in real AU;
 *   2. geocentric ecliptic = planet − Earth;
 *   3. ecliptic (λ, β) → equatorial (RA, Dec) via the obliquity ε.
 * Positions are J2000-mean-element accurate (arc-minutes over the engine's
 * timeline) — honest real geometry, not a stand-in.
 * ======================================================================== */

/** Minimal orbital-element record — the fields planetsData already carries. */
export interface KeplerianElements {
  aAU: number
  eccentricity: number
  /** Inclination to the ecliptic, degrees. */
  inclDeg: number
  /** Longitude of the ascending node Ω, degrees. */
  longNodeDeg: number
  /** Longitude of perihelion ϖ = Ω + ω, degrees (matches engine `periDeg`). */
  periLonDeg: number
  /** Mean anomaly at J2000, degrees (engine `m0Deg`). */
  m0Deg: number
  /** Orbital period, days. */
  periodDays: number
}

const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0) // J2000.0 = 2000-01-01 12:00 TT ≈ UTC here
const OBLIQUITY_J2000_DEG = 23.439_291 // mean obliquity of the ecliptic at J2000

function daysSinceJ2000(date: Date): number {
  return (date.getTime() - J2000_MS) / 86_400_000
}

/** Solve Kepler's equation M = E − e·sin E for the eccentric anomaly E (rad). */
function solveEccentricAnomaly(mRad: number, e: number): number {
  let E = e < 0.8 ? mRad : Math.PI
  for (let i = 0; i < 60; i++) {
    const dE = (E - e * Math.sin(E) - mRad) / (1 - e * Math.cos(E))
    E -= dE
    if (Math.abs(dE) < 1e-9) break
  }
  return E
}

/**
 * Heliocentric ECLIPTIC rectangular coordinates (real AU, J2000 frame) for a
 * body at `date`. x → vernal equinox, z → ecliptic north. Standard element
 * rotations (ω in-plane, i, then Ω about the pole), with ω = ϖ − Ω.
 */
function heliocentricEcliptic(el: KeplerianElements, date: Date): { x: number; y: number; z: number } {
  const M = norm360(el.m0Deg + (360 * daysSinceJ2000(date)) / el.periodDays) * DEG
  const e = el.eccentricity
  const E = solveEccentricAnomaly(M, e)

  // Position in the orbital plane (perifocal), AU.
  const xv = el.aAU * (Math.cos(E) - e)
  const yv = el.aAU * (Math.sqrt(1 - e * e) * Math.sin(E))

  const omega = (el.periLonDeg - el.longNodeDeg) * DEG // argument of perihelion ω
  const node = el.longNodeDeg * DEG
  const incl = el.inclDeg * DEG

  const cosO = Math.cos(node), sinO = Math.sin(node)
  const cosW = Math.cos(omega), sinW = Math.sin(omega)
  const cosI = Math.cos(incl), sinI = Math.sin(incl)

  // Rotate perifocal → ecliptic (Meeus eq. after 33; standard PQW → ecliptic).
  const x =
    (cosO * cosW - sinO * sinW * cosI) * xv +
    (-cosO * sinW - sinO * cosW * cosI) * yv
  const y =
    (sinO * cosW + cosO * sinW * cosI) * xv +
    (-sinO * sinW + cosO * cosW * cosI) * yv
  const z = (sinW * sinI) * xv + (cosW * sinI) * yv

  return { x, y, z }
}

/**
 * Geocentric apparent RA/Dec of a planet at `date`, given both the planet's
 * and Earth's Keplerian elements. Returns RA in hours, Dec in degrees — the
 * same shape the horizontal transform consumes.
 */
export function planetEquatorial(
  planet: KeplerianElements,
  earth: KeplerianElements,
  date: Date,
): EquatorialCoord {
  const p = heliocentricEcliptic(planet, date)
  const eth = heliocentricEcliptic(earth, date)

  // Geocentric ecliptic vector (planet as seen from Earth).
  const gx = p.x - eth.x
  const gy = p.y - eth.y
  const gz = p.z - eth.z

  // Ecliptic → equatorial rotation about the x-axis by the obliquity ε.
  const eps = OBLIQUITY_J2000_DEG * DEG
  const cosE = Math.cos(eps), sinE = Math.sin(eps)
  const xe = gx
  const ye = gy * cosE - gz * sinE
  const ze = gy * sinE + gz * cosE

  const raDeg = norm360(Math.atan2(ye, xe) / DEG)
  const decDeg = Math.atan2(ze, Math.sqrt(xe * xe + ye * ye)) / DEG
  return { raHours: raDeg / HOURS_TO_DEG, decDeg }
}

/* ==========================================================================
 * Sun position + twilight — so "Tonight's Sky" knows when it is actually dark
 * enough to observe. The Sun's altitude below the horizon defines the
 * standard twilight phases (civil −6°, nautical −12°, astronomical −18°);
 * below −18° the sky is truly dark. Meeus ch. 25 low-precision solar formula
 * (accurate to ~0.01°, far better than we need to answer "is it dark?").
 * ======================================================================== */

/** Apparent geocentric RA/Dec of the Sun at `date` (Meeus ch. 25, low-precision). */
export function sunEquatorial(date: Date): EquatorialCoord {
  const d = julianDate(date) - 2_451_545.0 // days since J2000.0
  const T = d / 36_525
  const L0 = norm360(280.460 + 0.985_647_4 * d) // geometric mean longitude
  const g = norm360(357.528 + 0.985_600_3 * d) * DEG // mean anomaly
  // Ecliptic longitude with the equation of centre (first two terms).
  const lambda =
    (L0 + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * DEG
  // Obliquity of the ecliptic (slowly decreasing).
  const eps = (23.439 - 0.000_000_36 * d - 0.013_004 * T) * DEG
  const raDeg = norm360(Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda)) / DEG)
  const decDeg = Math.asin(Math.sin(eps) * Math.sin(lambda)) / DEG
  return { raHours: raDeg / HOURS_TO_DEG, decDeg }
}

/** The Sun's altitude above the horizon (degrees) for an observer + instant. */
export function sunAltitude(observer: Observer, date: Date): number {
  return equatorialToHorizontal(sunEquatorial(date), observer, date).altitudeDeg
}

export type TwilightPhase = "day" | "civil" | "nautical" | "astronomical" | "night"

/** Map a Sun altitude to the standard observing phase. */
export function twilightPhase(sunAltitudeDeg: number): TwilightPhase {
  if (sunAltitudeDeg > -0.833) return "day" // upper limb at the horizon (refraction)
  if (sunAltitudeDeg > -6) return "civil"
  if (sunAltitudeDeg > -12) return "nautical"
  if (sunAltitudeDeg > -18) return "astronomical"
  return "night"
}

export interface DarknessWindow {
  /** Current Sun altitude, degrees. */
  sunAltitudeDeg: number
  /** Current phase from that altitude. */
  phase: TwilightPhase
  /** Sunset (upper limb crossing the horizon) tonight, local time, or null. */
  sunset: Date | null
  /** Sunrise tomorrow morning, local time, or null. */
  sunrise: Date | null
  /** When astronomical darkness begins tonight (Sun reaches −18°), or null if
   *  it never gets that dark from this latitude at this time of year. */
  darkStart: Date | null
  /** When astronomical darkness ends (Sun climbs back to −18°), or null. */
  darkEnd: Date | null
  /** True if the Sun is currently below −18° — genuinely dark, best viewing. */
  isDark: boolean
}

/**
 * Tonight's darkness window for an observer: the sunset/sunrise bracket and the
 * astronomical-darkness sub-window inside it. The Sun's RA/Dec drifts <1°/day,
 * so treating it as fixed over the search night is fine here. Crossings are
 * found by scanning the Sun's altitude forward from `date` and bisecting.
 */
export function darknessWindow(observer: Observer, date: Date): DarknessWindow {
  const altAt = (t: number) => sunAltitude(observer, new Date(t))
  const now = date.getTime()

  // Find the next time the Sun's altitude crosses `edge` (deg), scanning
  // forward up to 24h in coarse steps, then bisecting the bracket. `dir`:
  // "down" = descending crossing (e.g. sunset), "up" = ascending (sunrise).
  const nextCrossing = (edge: number, dir: "down" | "up"): Date | null => {
    const stepMs = 10 * 60_000 // 10-min scan
    let prevT = now
    let prevV = altAt(prevT) - edge
    for (let t = now + stepMs; t <= now + 24 * 3_600_000; t += stepMs) {
      const v = altAt(t) - edge
      const crossed = dir === "down" ? prevV > 0 && v <= 0 : prevV < 0 && v >= 0
      if (crossed) {
        let lo = prevT
        let hi = t
        for (let i = 0; i < 40; i++) {
          const mid = (lo + hi) / 2
          const mv = altAt(mid) - edge
          if ((mv > 0) === (dir === "down")) lo = mid
          else hi = mid
        }
        return new Date((lo + hi) / 2)
      }
      prevT = t
      prevV = v
    }
    return null
  }

  const sunAltitudeDeg = altAt(now)
  return {
    sunAltitudeDeg,
    phase: twilightPhase(sunAltitudeDeg),
    sunset: nextCrossing(-0.833, "down"),
    sunrise: nextCrossing(-0.833, "up"),
    darkStart: nextCrossing(-18, "down"),
    darkEnd: nextCrossing(-18, "up"),
    isDark: sunAltitudeDeg <= -18,
  }
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
