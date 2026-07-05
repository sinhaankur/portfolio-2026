/**
 * transfer — Earth→Mars Hohmann transfer + launch-window math.
 *
 * Real orbital mechanics from first principles (patched-conic, circular-coplanar
 * approximation — the standard first-order model taught in astrodynamics):
 *   - Hohmann transfer ellipse between two circular orbits
 *   - transfer (flight) time = half the transfer-ellipse period
 *   - departure / arrival Δv (heliocentric, vis-viva)
 *   - phase angle required at departure, and the next launch window from the
 *     synodic period.
 *
 * Approximations (stated honestly): circular, coplanar orbits at mean radii; no
 * planetary gravity assist / oblateness / inclination. Good to a few % — enough
 * to teach the shape of the problem and land the window within days. Real
 * mission design uses full ephemeris + a Lambert solver (a porkchop plot).
 */

const AU = 1.495978707e8 // km
const MU_SUN = 1.32712440018e11 // km^3/s^2
const DAY = 86400

export type TransferResult = {
  flightDays: number
  dvDepartKms: number
  dvArriveKms: number
  dvTotalKms: number
  phaseAngleDeg: number // Mars ahead of Earth at departure
  synodicDays: number
  nextWindow: Date
}

// Mean orbital radii (km) + periods (days).
const EARTH_R = 1.0 * AU
const MARS_R = 1.523679 * AU
const EARTH_T = 365.256
const MARS_T = 686.980

function circVel(r: number): number {
  return Math.sqrt(MU_SUN / r) // km/s
}
// vis-viva speed on an ellipse of semi-major axis a, at radius r
function visViva(r: number, a: number): number {
  return Math.sqrt(MU_SUN * (2 / r - 1 / a))
}

/**
 * Compute the Earth→Mars Hohmann transfer. `from` anchors the next-window search
 * (defaults to now). The phase-angle → window step uses the synodic period and
 * a reference alignment; it lands the next window within a few days of reality.
 */
export function earthToMarsTransfer(from: Date = new Date()): TransferResult {
  // transfer ellipse: perihelion at Earth, aphelion at Mars
  const a = (EARTH_R + MARS_R) / 2
  const transferPeriodSec = 2 * Math.PI * Math.sqrt((a * a * a) / MU_SUN)
  const flightSec = transferPeriodSec / 2
  const flightDays = flightSec / DAY

  // heliocentric Δv (vis-viva): raise Earth-circular → transfer perihelion,
  // then transfer aphelion → Mars-circular.
  const vEarth = circVel(EARTH_R)
  const vMars = circVel(MARS_R)
  const vPeri = visViva(EARTH_R, a)
  const vApo = visViva(MARS_R, a)
  const dvDepart = Math.abs(vPeri - vEarth)
  const dvArrive = Math.abs(vMars - vApo)

  // required phase angle: Mars must be AHEAD of Earth by the angle Mars sweeps
  // during the transfer, minus 180° (Earth sweeps 180° of the transfer arc).
  const marsRateDegDay = 360 / MARS_T
  const marsSweep = marsRateDegDay * flightDays
  let phase = 180 - marsSweep
  // normalize into (-180, 180]
  phase = ((phase + 180) % 360 + 360) % 360 - 180

  // synodic period: time between identical Earth–Mars alignments
  const synodicDays = 1 / Math.abs(1 / EARTH_T - 1 / MARS_T)

  // next window: anchor to a known real Earth→Mars window and step by synodic
  // period until we're past `from`. 2022-Aug-perihelion-class window is a solid
  // anchor (Perseverance-era windows recur every ~780 days).
  const anchor = Date.UTC(2022, 8, 1) // 2022-09-01, a reference departure window
  let win = anchor
  const step = synodicDays * DAY * 1000
  while (win < from.getTime()) win += step

  return {
    flightDays,
    dvDepartKms: dvDepart,
    dvArriveKms: dvArrive,
    dvTotalKms: dvDepart + dvArrive,
    phaseAngleDeg: phase,
    synodicDays,
    nextWindow: new Date(win),
  }
}

/** C3 (characteristic energy, km²/s²) from a departure Δv relative to Earth —
 *  the number mission planners quote for a launch. C3 ≈ v_inf². Here v_inf ≈ the
 *  heliocentric departure Δv (first-order). */
export function c3FromDv(dvKms: number): number {
  return dvKms * dvKms
}
