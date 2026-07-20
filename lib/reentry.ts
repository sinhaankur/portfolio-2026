/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine. Others may reference this work.
 * https://github.com/sinhaankur/portfolio-2026
 *
 * reentry.ts — a pure, extractable re-entry / orbital-decay estimator from TLEs.
 *
 * LeoLabs' public claim to fame is re-entry prediction: which tracked objects are
 * sinking out of orbit, and roughly when they'll come down. This is the open,
 * honest version, built from the two physical signals a TLE actually carries:
 *
 *   - perigee altitude (from mean motion + eccentricity) — how deep into the
 *     atmosphere the object dips each orbit; drag rises ~exponentially as it falls.
 *   - B* (the TLE drag term, line 1 cols 54-61) — the object's ballistic drag
 *     coefficient proxy: high B* = light/draggy (sinks fast), low B* = dense/slick.
 *
 * HONESTY (stated wherever this is shown): this is a coarse ESTIMATE, not a
 * validated re-entry forecast. Real decay depends on the object's mass/area, its
 * tumble, and — dominantly — future solar activity (F10.7 / geomagnetic storms
 * puff the thermosphere up and down), none of which a TLE snapshot knows. Agencies
 * (18 SDS / ESA) run drag models fed by live space weather. Treat the numbers as
 * order-of-magnitude triage, not a countdown clock.
 */

export const EARTH_RADIUS_KM = 6371
const MU = 398600.4418 // km^3/s^2

/** Parse a TLE's perigee + apogee altitude (km) from line 2. */
export function tleAltitudes(l2: string): { perigeeKm: number; apogeeKm: number } | null {
  const meanMotion = parseFloat(l2.substring(52, 63)) // rev/day
  const ecc = parseFloat("0." + l2.substring(26, 33).trim())
  if (!(meanMotion > 0)) return null
  const nRadS = (meanMotion * 2 * Math.PI) / 86400
  const aKm = Math.cbrt(MU / (nRadS * nRadS))
  return {
    perigeeKm: aKm * (1 - ecc) - EARTH_RADIUS_KM,
    apogeeKm: aKm * (1 + ecc) - EARTH_RADIUS_KM,
  }
}

/** Parse B* (drag term) from TLE line 1, cols 54-61. Format: "±NNNNN±E" implying
 *  0.NNNNN × 10^E  (assumed-decimal-point exponential). Returns 0 for the "00000-0"
 *  (no-drag) sentinel. */
export function tleBstar(l1: string): number {
  const raw = l1.substring(53, 61).trim()
  if (!raw || raw === "00000-0" || raw === "00000+0") return 0
  let s = raw
  let sign = 1
  if (s[0] === "-") { sign = -1; s = s.slice(1) }
  else if (s[0] === "+") { s = s.slice(1) }
  // last two chars are the (signed) exponent, the rest the mantissa (implied 0.)
  const expStr = s.slice(-2)
  const mantStr = s.slice(0, -2)
  const exp = parseInt(expStr, 10)
  const mant = parseFloat("0." + mantStr)
  if (!isFinite(exp) || !isFinite(mant)) return 0
  return sign * mant * Math.pow(10, exp)
}

/** TLE epoch (line 1 cols 19-32, YYDDD.DDDD…) → Unix ms. */
export function tleEpochMs(l1: string): number {
  const yy = parseInt(l1.substring(18, 20), 10)
  const doy = parseFloat(l1.substring(20, 32))
  const year = yy < 57 ? 2000 + yy : 1900 + yy
  const jan1 = Date.UTC(year, 0, 1)
  return jan1 + (doy - 1) * 86400_000
}

/**
 * Baseline decay lifetime (days) from perigee alone — the same monotone heuristic
 * the swarm uses to sink junk over time, refined to a continuous curve. Drag falls
 * off roughly exponentially with altitude, so lifetime climbs steeply with perigee.
 * (Anchored to observed rules of thumb: ~200 km ≈ days, ~400 km ≈ a year or few,
 *  ~600 km ≈ decades, ~800 km ≈ centuries.)
 */
function baselineLifetimeDays(perigeeKm: number): number {
  if (perigeeKm < 150) return 3
  if (perigeeKm > 1200) return 365 * 5000
  // log-linear fit through the classic anchor points.
  const anchors: [number, number][] = [
    [150, 3], [200, 25], [250, 90], [300, 240], [400, 800],
    [500, 3300], [600, 9000], [700, 25000], [800, 90000], [1000, 700000], [1200, 1_800_000],
  ]
  for (let i = 0; i < anchors.length - 1; i++) {
    const [p0, l0] = anchors[i]
    const [p1, l1] = anchors[i + 1]
    if (perigeeKm >= p0 && perigeeKm <= p1) {
      const t = (perigeeKm - p0) / (p1 - p0)
      // interpolate in log space (lifetime spans many orders of magnitude)
      return Math.exp(Math.log(l0) + t * (Math.log(l1) - Math.log(l0)))
    }
  }
  return 365 * 5000
}

/** Decay status band from perigee alone — usable when you already have the
 *  perigee (e.g. from a live SGP4 readout) and don't want to re-parse the TLE.
 *  Same thresholds as estimateDecay's status. */
export function statusFromPerigee(perigeeKm: number): DecayEstimate["status"] {
  if (perigeeKm < 300) return "imminent"
  if (perigeeKm < 600) return "decaying"
  if (perigeeKm < 2000) return "leo-longterm"
  return "stable"
}

/** Coarse remaining-lifetime label from perigee alone (no B* refinement). */
export function lifetimeFromPerigee(perigeeKm: number): number {
  return baselineLifetimeDays(perigeeKm)
}

export type DecayEstimate = {
  perigeeKm: number
  apogeeKm: number
  bstar: number
  /** Estimated remaining orbital lifetime in days (from the TLE epoch). */
  lifetimeDays: number
  /** Estimated re-entry as Unix ms (tle epoch + lifetime). */
  reentryMs: number
  /** Coarse status band for triage. */
  status: "imminent" | "decaying" | "leo-longterm" | "stable"
}

/**
 * Estimate orbital decay for one object from its TLE. Combines the perigee
 * baseline with a B*-based multiplier: a draggier-than-typical object (high B*
 * for its altitude) decays faster, a slick one slower. The multiplier is bounded
 * so a wild B* can't produce absurd numbers — it nudges the baseline, doesn't
 * replace the physics.
 */
export function estimateDecay(l1: string, l2: string): DecayEstimate | null {
  const alt = tleAltitudes(l2)
  if (!alt) return null
  const bstar = tleBstar(l1)
  const base = baselineLifetimeDays(alt.perigeeKm)

  // Typical B* for a given perigee (rough): draggier low, slicker high. Compare
  // the object's B* to this to get a multiplier around 1. Only meaningful in LEO
  // where drag dominates; above ~900 km B* is noise, so fade the effect out.
  let lifetimeDays = base
  if (alt.perigeeKm < 900 && bstar > 0) {
    const typicalBstar = 1e-4 * Math.max(0.2, (700 - Math.min(alt.perigeeKm, 700)) / 500 + 0.2)
    const ratio = bstar / typicalBstar
    // more drag → shorter life. Clamp the multiplier to [0.2, 5] so it nudges.
    const mult = Math.min(5, Math.max(0.2, ratio))
    lifetimeDays = base / mult
  }

  const reentryMs = tleEpochMs(l1) + lifetimeDays * 86400_000
  let status: DecayEstimate["status"]
  if (alt.perigeeKm < 300 || lifetimeDays < 120) status = "imminent"
  else if (alt.perigeeKm < 600 || lifetimeDays < 365 * 10) status = "decaying"
  else if (alt.perigeeKm < 2000) status = "leo-longterm"
  else status = "stable"

  return { perigeeKm: alt.perigeeKm, apogeeKm: alt.apogeeKm, bstar, lifetimeDays, reentryMs, status }
}

/** Does this orbit ever pass over a given latitude? A satellite reaches
 *  latitudes up to ±inclination (for inclinations ≤ 90°; retrograde orbits
 *  inc > 90° reach up to ±(180−inc)). So an observer at latitude φ can have the
 *  object pass overhead iff |φ| ≤ that reach. This is the honest "could it come
 *  down near me" filter — ground-track coverage, not a specific reentry point
 *  (which no one can predict from a TLE). */
export function orbitReachesLatitude(inclinationDeg: number, latDeg: number): boolean {
  const reach = inclinationDeg <= 90 ? inclinationDeg : 180 - inclinationDeg
  return Math.abs(latDeg) <= reach + 0.5
}

/** Inclination (deg) straight from TLE line 2 (cols 8-16). */
export function tleInclination(l2: string): number {
  return parseFloat(l2.substring(8, 16))
}

/** Human label for a lifetime in days. */
export function lifetimeLabel(days: number): string {
  if (days < 1) return "< 1 day"
  if (days < 90) return `~${Math.round(days)} days`
  if (days < 365 * 2) return `~${Math.round(days / 30)} months`
  if (days < 365 * 1000) return `~${Math.round(days / 365)} years`
  const millennia = days / 365 / 1000
  return `~${millennia.toFixed(millennia < 10 ? 1 : 0)}k years`
}
