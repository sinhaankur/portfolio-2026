/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 *
 * comet-visibility — "which comet is passing, when, and can I see it from where
 * I'm standing?"
 *
 * Real geometry, no invented events (the engine models real state):
 *   1. NEXT PERIHELION — perihelionTT + n·period → the next future closest
 *      approach to the Sun, i.e. when a periodic comet is brightest. This is
 *      the honest "when will it pass" answer.
 *   2. CURRENT SKY POSITION — heliocentric ecliptic (Kepler, anchored on the
 *      perihelion epoch) → geocentric (minus Earth) → equatorial RA/Dec. The
 *      same Meeus machinery lib/sky-position.ts uses for planets.
 *   3. VISIBLE FROM YOU — RA/Dec + your lat/lon → altitude/azimuth. Above the
 *      horizon = up right now. Brightness is estimated from heliocentric +
 *      geocentric distance (a comet only lights up near the Sun), so we don't
 *      claim a faint comet at aphelion is "visible."
 *
 * Everything here is a pure function of a Date — deterministic + testable.
 */

import type { NamedBody } from "@/components/universe-engine/types"
import {
  equatorialToHorizontal,
  compassPoint,
  altitudeBand,
  type EquatorialCoord,
  type Observer,
} from "@/lib/sky-position"

const DEG = Math.PI / 180
const HOURS_TO_DEG = 15
const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0)
const OBLIQUITY_J2000_DEG = 23.439_291
const MS_PER_DAY = 86_400_000
const DAYS_PER_YEAR = 365.25

function norm360(d: number): number {
  return ((d % 360) + 360) % 360
}

/** Solve Kepler's equation for the eccentric anomaly (rad). Handles e→1. */
function solveEccentricAnomaly(mRad: number, e: number): number {
  let E = e < 0.8 ? mRad : Math.PI
  for (let i = 0; i < 80; i++) {
    const dE = (E - e * Math.sin(E) - mRad) / (1 - e * Math.cos(E))
    E -= dE
    if (Math.abs(dE) < 1e-10) break
  }
  return E
}

/** Heliocentric ecliptic rectangular coords (AU, J2000) of a comet at `date`,
 *  anchored on its perihelion epoch (M = 0 at perihelion). */
function cometHeliocentric(
  el: { aAU: number; e: number; inclDeg: number; nodeDeg: number; argPeriDeg: number; periodDays: number; periMs: number },
  date: Date,
): { x: number; y: number; z: number } {
  const daysSincePeri = (date.getTime() - el.periMs) / MS_PER_DAY
  const M = ((2 * Math.PI * daysSincePeri) / el.periodDays) % (2 * Math.PI)
  const e = el.e
  const E = solveEccentricAnomaly(M, e)

  const xv = el.aAU * (Math.cos(E) - e)
  const yv = el.aAU * Math.sqrt(1 - e * e) * Math.sin(E)

  const omega = el.argPeriDeg * DEG
  const node = el.nodeDeg * DEG
  const incl = el.inclDeg * DEG
  const cosO = Math.cos(node), sinO = Math.sin(node)
  const cosW = Math.cos(omega), sinW = Math.sin(omega)
  const cosI = Math.cos(incl), sinI = Math.sin(incl)

  const x =
    (cosO * cosW - sinO * sinW * cosI) * xv +
    (-cosO * sinW - sinO * cosW * cosI) * yv
  const y =
    (sinO * cosW + cosO * sinW * cosI) * xv +
    (-sinO * sinW + cosO * cosW * cosI) * yv
  const z = sinW * sinI * xv + cosW * sinI * yv
  return { x, y, z }
}

/** Earth's heliocentric ecliptic position (AU) — low-precision Meeus, plenty
 *  accurate for "is the comet up and where." */
function earthHeliocentric(date: Date): { x: number; y: number; z: number } {
  const d = (date.getTime() - J2000_MS) / MS_PER_DAY
  const L = norm360(280.46 + 0.985_647_4 * d) * DEG
  const g = norm360(357.528 + 0.985_600_3 * d) * DEG
  const lambdaSun = L + (1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * DEG
  const r = 1.000_14 - 0.016_71 * Math.cos(g) - 0.000_14 * Math.cos(2 * g)
  // Earth is opposite the Sun as seen heliocentrically → +π, in the ecliptic (β≈0).
  const lam = lambdaSun + Math.PI
  return { x: r * Math.cos(lam), y: r * Math.sin(lam), z: 0 }
}

function eclipticVecToEquatorial(gx: number, gy: number, gz: number): EquatorialCoord {
  const eps = OBLIQUITY_J2000_DEG * DEG
  const cosE = Math.cos(eps), sinE = Math.sin(eps)
  const xe = gx
  const ye = gy * cosE - gz * sinE
  const ze = gy * sinE + gz * cosE
  const raDeg = norm360(Math.atan2(ye, xe) / DEG)
  const decDeg = Math.atan2(ze, Math.sqrt(xe * xe + ye * ye)) / DEG
  return { raHours: raDeg / HOURS_TO_DEG, decDeg }
}

/** Internal: parse a comet NamedBody into the element bundle we compute on.
 *  Returns null if the body isn't a periodic comet with a perihelion anchor. */
function cometElements(body: NamedBody) {
  if (body.kind !== "comet") return null
  if (!body.perihelionTT || !isFinite(body.periodYears)) return null
  return {
    aAU: body.aAU,
    e: body.eccentricity,
    inclDeg: body.inclDeg,
    nodeDeg: body.longNodeDeg ?? 0,
    argPeriDeg: body.argPeriDeg ?? 0,
    periodDays: body.periodYears * DAYS_PER_YEAR,
    periMs: Date.parse(body.perihelionTT),
  }
}

/** The next perihelion passage at or after `now` for a periodic comet. */
export function nextPerihelion(body: NamedBody, now: Date): Date | null {
  const el = cometElements(body)
  if (!el) return null
  const periodMs = el.periodDays * MS_PER_DAY
  let t = el.periMs
  if (periodMs <= 0) return null
  // Step forward to the first perihelion >= now.
  const nMissed = Math.ceil((now.getTime() - t) / periodMs)
  if (nMissed > 0) t += nMissed * periodMs
  return new Date(t)
}

/** Heliocentric + geocentric distance (AU) of the comet at `date`. */
export function cometDistances(body: NamedBody, date: Date): { helioAU: number; geoAU: number } | null {
  const el = cometElements(body)
  if (!el) return null
  const c = cometHeliocentric(el, date)
  const eth = earthHeliocentric(date)
  const helioAU = Math.hypot(c.x, c.y, c.z)
  const geoAU = Math.hypot(c.x - eth.x, c.y - eth.y, c.z - eth.z)
  return { helioAU, geoAU }
}

/**
 * Rough apparent-magnitude estimate: m = H + 5·log10(Δ) + 2.5·n·log10(r).
 * We don't carry per-comet H/n, so use typical comet values (H≈7, n≈4) purely
 * to RANK "how bright right now" and gate the visible/not-visible call — it is
 * an estimate, surfaced as such, never a precise prediction.
 */
function estMagnitude(helioAU: number, geoAU: number): number {
  const H = 7, n = 4
  return H + 5 * Math.log10(Math.max(geoAU, 0.01)) + 2.5 * n * Math.log10(Math.max(helioAU, 0.01))
}

export interface CometSighting {
  name: string
  designation: string
  /** The next time it swings through perihelion (brightest). */
  nextPerihelion: Date | null
  /** Days until that perihelion (negative if it just passed). */
  daysToPerihelion: number | null
  /** Current heliocentric / geocentric distance, AU. */
  helioAU: number
  geoAU: number
  /** Estimated apparent magnitude now (lower = brighter). */
  estMag: number
  /** Is it a naked-eye / binocular target right now? (est mag ≤ ~9) */
  brightEnough: boolean
  /** Above the observer's horizon right now? */
  aboveHorizon: boolean
  /** Altitude° + compass bearing where to look, when above horizon. */
  altitudeDeg: number
  azimuthDeg: number
  compass: string
  band: "below" | "low" | "mid" | "high" | "overhead"
  /** Genuinely visible from here now = up AND bright enough. */
  visibleNow: boolean
}

/** Full sighting report for one comet from one observer at one instant. */
export function cometSighting(body: NamedBody, observer: Observer, date: Date): CometSighting | null {
  const el = cometElements(body)
  if (!el) return null
  const c = cometHeliocentric(el, date)
  const eth = earthHeliocentric(date)
  const helioAU = Math.hypot(c.x, c.y, c.z)
  const geoAU = Math.hypot(c.x - eth.x, c.y - eth.y, c.z - eth.z)
  const eq = eclipticVecToEquatorial(c.x - eth.x, c.y - eth.y, c.z - eth.z)
  const horiz = equatorialToHorizontal(eq, observer, date)
  const estMag = estMagnitude(helioAU, geoAU)
  const brightEnough = estMag <= 9
  const aboveHorizon = horiz.altitudeDeg > 0
  const peri = nextPerihelion(body, date)
  const daysToPerihelion = peri ? Math.round((peri.getTime() - date.getTime()) / MS_PER_DAY) : null
  return {
    name: body.name,
    designation: body.designation,
    nextPerihelion: peri,
    daysToPerihelion,
    helioAU,
    geoAU,
    estMag,
    brightEnough,
    aboveHorizon,
    altitudeDeg: horiz.altitudeDeg,
    azimuthDeg: horiz.azimuthDeg,
    compass: compassPoint(horiz.azimuthDeg),
    band: altitudeBand(horiz.altitudeDeg),
    visibleNow: aboveHorizon && brightEnough,
  }
}

/**
 * Rank every periodic comet for an observer:
 *  - visibleNow first (up + bright), brightest → dimmest
 *  - then upcoming passes soonest → latest (the "coming attractions")
 * So the UI can lead with "Comet X is up now, look ENE" then "next up: Y in N days."
 */
export function rankCometSightings(
  bodies: NamedBody[],
  observer: Observer,
  date: Date,
): CometSighting[] {
  const out: CometSighting[] = []
  for (const b of bodies) {
    const s = cometSighting(b, observer, date)
    if (s) out.push(s)
  }
  return out.sort((a, b) => {
    if (a.visibleNow !== b.visibleNow) return a.visibleNow ? -1 : 1
    if (a.visibleNow) return a.estMag - b.estMag
    // both not visible now — soonest next perihelion first
    const da = a.daysToPerihelion ?? Infinity
    const db = b.daysToPerihelion ?? Infinity
    return da - db
  })
}
