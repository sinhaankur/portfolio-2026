/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine. Others may reference this work.
 * https://github.com/sinhaankur/portfolio-2026
 *
 * porkchop — an Earth→Mars launch-window (porkchop) plot from a Lambert solver.
 *
 * The Hohmann model (lib/transfer.ts) gives ONE optimal transfer. A porkchop
 * plot answers the real mission-design question: for every possible DEPARTURE
 * date × ARRIVAL date, what does the transfer cost? Sweeping that grid draws the
 * characteristic "porkchop" contours, and the minimum is the launch window.
 *
 * For each (departure, arrival) cell we:
 *   1. place Earth and Mars at their heliocentric positions on those dates,
 *   2. solve LAMBERT'S PROBLEM — the transfer orbit connecting the two position
 *      vectors in the given time of flight (universal-variable formulation,
 *      Bate/Mueller/White · Vallado),
 *   3. read the departure v∞ (→ C3, the launch energy) and arrival v∞.
 *
 * APPROXIMATIONS (stated honestly, same as transfer.ts): Earth and Mars on
 * circular, coplanar orbits at their mean radii; heliocentric two-body Lambert;
 * no planetary flyby, oblateness, or true ephemeris/inclination. This is the
 * standard first-order model — it lands the window within days and draws the
 * true shape of the problem. Real mission design uses full JPL ephemeris + a
 * 3-D Lambert solver, but the mathematics here is the same mathematics.
 */

const AU = 1.495978707e8 // km
const MU_SUN = 1.32712440018e11 // km^3/s^2
const DAY = 86400 // s

// Mean orbital radii (km) + periods (days) — matches lib/transfer.ts.
const EARTH_R = 1.0 * AU
const MARS_R = 1.523679 * AU
const EARTH_T = 365.256
const MARS_T = 686.980

type Vec3 = [number, number, number]

function sub(a: Vec3, b: Vec3): Vec3 { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]] }
function mag(a: Vec3): number { return Math.hypot(a[0], a[1], a[2]) }
function dot(a: Vec3, b: Vec3): number { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] }
function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

/**
 * Heliocentric position + velocity of a planet on a circular coplanar orbit,
 * `epochDaysFromRef` days after an arbitrary shared reference. The absolute
 * phase doesn't matter for the plot's SHAPE — only the Earth–Mars geometry
 * evolving in time does — but we anchor both planets to the same reference so
 * their relative angle is physical. r in km, v in km/s.
 */
function planetState(rKm: number, periodDays: number, phase0Rad: number, tDays: number): { r: Vec3; v: Vec3 } {
  const n = (2 * Math.PI) / (periodDays * DAY) // mean motion, rad/s
  const theta = phase0Rad + n * (tDays * DAY)
  const vCirc = Math.sqrt(MU_SUN / rKm)
  return {
    r: [rKm * Math.cos(theta), rKm * Math.sin(theta), 0],
    v: [-vCirc * Math.sin(theta), vCirc * Math.cos(theta), 0],
  }
}

// Stumpff functions for the universal-variable Lambert/Kepler formulation.
function stumpffC(z: number): number {
  if (z > 1e-6) return (1 - Math.cos(Math.sqrt(z))) / z
  if (z < -1e-6) { const s = Math.sqrt(-z); return (Math.cosh(s) - 1) / -z }
  return 1 / 2 - z / 24 // series near 0
}
function stumpffS(z: number): number {
  if (z > 1e-6) { const s = Math.sqrt(z); return (s - Math.sin(s)) / (s * s * s) }
  if (z < -1e-6) { const s = Math.sqrt(-z); return (Math.sinh(s) - s) / (s * s * s) }
  return 1 / 6 - z / 120
}

/**
 * Lambert's problem (universal-variable, prograde) — given start/end position
 * vectors and time of flight, return the required start/end velocity vectors.
 * Returns null if it doesn't converge (degenerate geometry / non-physical TOF).
 * Reference: Bate, Mueller & White; Curtis "Orbital Mechanics", Algorithm 5.2.
 */
export function lambert(r1: Vec3, r2: Vec3, tofSec: number, prograde = true): { v1: Vec3; v2: Vec3 } | null {
  const R1 = mag(r1)
  const R2 = mag(r2)
  const cr = cross(r1, r2)
  let dnu = Math.acos(Math.min(1, Math.max(-1, dot(r1, r2) / (R1 * R2))))
  // choose the transfer direction (prograde => cross-product z > 0 keeps dnu < π)
  if (prograde) { if (cr[2] < 0) dnu = 2 * Math.PI - dnu }
  else { if (cr[2] >= 0) dnu = 2 * Math.PI - dnu }

  const A = Math.sin(dnu) * Math.sqrt((R1 * R2) / (1 - Math.cos(dnu)))
  if (A === 0) return null

  let z = 0
  let C = stumpffC(z)
  let S = stumpffS(z)

  const yOf = (zz: number, Cc: number, Ss: number) => R1 + R2 + (A * (zz * Ss - 1)) / Math.sqrt(Cc)

  // Newton iteration on z to match the time of flight.
  let tries = 0
  let y = yOf(z, C, S)
  while (tries++ < 60) {
    C = stumpffC(z)
    S = stumpffS(z)
    y = R1 + R2 + (A * (z * S - 1)) / Math.sqrt(C)
    if (A > 0 && y < 0) { z += 0.1; continue } // nudge z up until y ≥ 0
    const chi = Math.sqrt(y / C)
    const t = (chi * chi * chi * S + A * Math.sqrt(y)) / Math.sqrt(MU_SUN)
    // derivative dt/dz (Curtis eq. 5.43)
    let dtdz: number
    if (Math.abs(z) < 1e-6) {
      dtdz = (Math.sqrt(2) / 40) * Math.pow(y, 1.5) + (A / 8) * (Math.sqrt(y) + A * Math.sqrt(1 / (2 * y)))
    } else {
      dtdz =
        (Math.pow(y / C, 1.5) * (1 / (2 * z) * (C - (3 * S) / (2 * C)) + (3 * S * S) / (4 * C)) +
          (A / 8) * ((3 * S / C) * Math.sqrt(y) + A * Math.sqrt(C / y))) /
        Math.sqrt(MU_SUN)
    }
    const dz = (tofSec - t) / dtdz
    z += dz
    if (Math.abs(dz) < 1e-6) break
    if (!isFinite(z)) return null
  }

  C = stumpffC(z)
  S = stumpffS(z)
  y = R1 + R2 + (A * (z * S - 1)) / Math.sqrt(C)
  if (!(y > 0)) return null

  const f = 1 - y / R1
  const g = A * Math.sqrt(y / MU_SUN)
  const gdot = 1 - y / R2

  const v1: Vec3 = [(r2[0] - f * r1[0]) / g, (r2[1] - f * r1[1]) / g, (r2[2] - f * r1[2]) / g]
  const v2: Vec3 = [(gdot * r2[0] - r1[0]) / g, (gdot * r2[1] - r1[1]) / g, (gdot * r2[2] - r1[2]) / g]
  if (v1.some((n) => !isFinite(n)) || v2.some((n) => !isFinite(n))) return null
  return { v1, v2 }
}

export type PorkchopCell = {
  departDay: number // days from grid start
  arriveDay: number // days from grid start
  tofDays: number
  c3: number | null // km²/s² (departure energy) — null if Lambert failed
  arriveVinf: number | null // km/s
}

export type PorkchopGrid = {
  startDate: Date
  departDays: number[] // departure offsets (x axis)
  arriveDays: number[] // arrival offsets (y axis)
  cells: PorkchopCell[]
  best: { departDay: number; arriveDay: number; tofDays: number; c3: number; departDate: Date; arriveDate: Date } | null
  c3Min: number
  c3Max: number
}

/**
 * Build the Earth→Mars porkchop grid. `startDate` anchors day 0; the grid sweeps
 * departure offsets and arrival offsets (both in days). For each cell it solves
 * Lambert and records C3 (departure energy) — the number a launch is quoted in.
 * The minimum-C3 cell is the launch window.
 */
export function earthMarsPorkchop(opts: {
  startDate?: Date
  departSpanDays?: number
  arriveMinDays?: number
  arriveMaxDays?: number
  stepDays?: number
  /** C3 ceiling (km²/s²). Cells above this are non-physical launch options — real
   *  porkchop plots only show the low-energy valley — so they're recorded as null
   *  (out of range) rather than plotted, which also drops the near-180° Lambert
   *  singularity + extreme short-angle corners. */
  c3Ceiling?: number
} = {}): PorkchopGrid {
  const startDate = opts.startDate ?? new Date()
  const departSpan = opts.departSpanDays ?? 400
  const arriveMin = opts.arriveMinDays ?? 120
  const arriveMax = opts.arriveMaxDays ?? 400
  const step = opts.stepDays ?? 12
  const c3Ceiling = opts.c3Ceiling ?? 100 // km²/s² — generous; the valley is ~9–30

  // Anchor both planets to the same reference so their relative angle is real.
  // Absolute phase is arbitrary; use 0 for Earth, and give Mars a phase that puts
  // a real transfer window inside the default span (Mars ahead by ~44°).
  const earthPhase0 = 0
  const marsPhase0 = (44 * Math.PI) / 180

  const departDays: number[] = []
  for (let d = 0; d <= departSpan; d += step) departDays.push(d)
  const arriveDays: number[] = []
  for (let a = arriveMin; a <= arriveMax; a += step) arriveDays.push(a)

  const cells: PorkchopCell[] = []
  let c3Min = Infinity
  let c3Max = -Infinity
  let best: PorkchopGrid["best"] = null

  for (const arriveDay of arriveDays) {
    for (const departDay of departDays) {
      const tofDays = arriveDay - departDay
      if (tofDays <= 20) {
        cells.push({ departDay, arriveDay, tofDays, c3: null, arriveVinf: null })
        continue
      }
      const e = planetState(EARTH_R, EARTH_T, earthPhase0, departDay)
      const m = planetState(MARS_R, MARS_T, marsPhase0, arriveDay)
      const sol = lambert(e.r, m.r, tofDays * DAY, true)
      if (!sol) {
        cells.push({ departDay, arriveDay, tofDays, c3: null, arriveVinf: null })
        continue
      }
      const vInfDepart = mag(sub(sol.v1, e.v)) // heliocentric excess at Earth
      const vInfArrive = mag(sub(sol.v2, m.v))
      const c3 = vInfDepart * vInfDepart
      // Above the ceiling = non-physical launch (or a near-singular Lambert cell):
      // record as out-of-range rather than plotting a garbage value.
      if (!isFinite(c3) || c3 > c3Ceiling) {
        cells.push({ departDay, arriveDay, tofDays, c3: null, arriveVinf: null })
        continue
      }
      cells.push({ departDay, arriveDay, tofDays, c3, arriveVinf: vInfArrive })
      if (isFinite(c3)) {
        if (c3 < c3Min) {
          c3Min = c3
          best = {
            departDay, arriveDay, tofDays, c3,
            departDate: new Date(startDate.getTime() + departDay * DAY * 1000),
            arriveDate: new Date(startDate.getTime() + arriveDay * DAY * 1000),
          }
        }
        if (c3 > c3Max) c3Max = c3
      }
    }
  }

  return { startDate, departDays, arriveDays, cells, best, c3Min, c3Max }
}
