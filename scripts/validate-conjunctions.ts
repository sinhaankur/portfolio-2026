/**
 * validate-conjunctions.ts — does the engine's conjunction screener produce
 * CORRECT numbers, not just plausible ones?
 *
 * Deep-tech discipline: "I built a conjunction tool" is worth little until it's
 * "the tool's TCA is accurate to within X and its miss-distance to within Y."
 * This script measures that, against checks we can reason about independently:
 *
 *   TEST A — Self-conjunction sanity: an object screened against a copy of
 *            itself must report miss ≈ 0 km at essentially every step. If the
 *            propagation or distance math were wrong, this would not hold.
 *
 *   TEST B — Known geometry: two objects on the SAME orbit separated by a small
 *            in-track phase have a miss distance we can compute analytically
 *            (chord of the orbit for that phase angle). We compare the screener's
 *            reported miss to that independent value and report the error.
 *
 *   TEST C — Reference cross-check (optional): if a REFERENCE_TLE_A/B and an
 *            expected TCA/miss are provided via env, compare against them. This
 *            is where a published SOCRATES/CDM event slots in when you have one.
 *
 * Run:  npx tsx scripts/validate-conjunctions.ts
 *
 * Honesty note: TEST B's analytic value assumes a circular orbit; the error we
 * report therefore includes the small eccentricity of the real TLE. We state
 * that, rather than hiding it — the point is a truthful error bar.
 */

import { screenConjunctions, type ScreeningObject } from "../lib/conjunction"

// A real, well-formed ISS TLE (public domain, CelesTrak). Used only as a
// numerically valid orbit to test the MATH against — not a real event.
const ISS_L1 = "1 25544U 98067A   24274.53472222  .00016717  00000-0  30074-3 0  9993"
const ISS_L2 = "2 25544  51.6412 199.4187 0006703  99.9083  70.1584 15.50127642000000"

function fmt(n: number, d = 3): string {
  return Number.isFinite(n) ? n.toFixed(d) : String(n)
}

// Build a TLE for the same orbit shifted in-track by `dPhaseDeg` (change the
// mean anomaly field, cols 44-51 of line 2), so we get a controlled companion.
function shiftMeanAnomaly(l2: string, dPhaseDeg: number): string {
  const ma = parseFloat(l2.slice(43, 51))
  let ma2 = (ma + dPhaseDeg) % 360
  if (ma2 < 0) ma2 += 360
  const field = ma2.toFixed(4).padStart(8, " ")
  return l2.slice(0, 43) + field + l2.slice(51)
}

async function main() {
  const startMs = Date.UTC(2024, 8, 30, 0, 0, 0) // within the TLE's validity window
  let failures = 0

  console.log("── Conjunction screener validation ──\n")

  // ---- TEST A: self-conjunction must be ~0 km ----
  {
    const objs: ScreeningObject[] = [
      { id: 1, name: "ISS", l1: ISS_L1, l2: ISS_L2 },
      { id: 2, name: "ISS-copy", l1: ISS_L1, l2: ISS_L2 },
    ]
    const cj = await screenConjunctions(objs, {
      startMs, hours: 2, coarseStepS: 30, reportKm: 5, candidateKm: 50,
      minRelSpeedKms: 0, // a copy has 0 relative speed — don't filter it out
    })
    const miss = cj.length ? cj[0].missKm : Number.NaN
    const pass = cj.length > 0 && miss < 0.001
    console.log(`TEST A  self-conjunction miss = ${fmt(miss, 6)} km  → ${pass ? "PASS" : "FAIL"} (expect ≈ 0)`)
    if (!pass) failures++
  }

  // ---- TEST B: known in-track geometry ----
  // Two objects on the same orbit, phase-separated by θ, are chord-distance
  // apart: d = 2·r·sin(θ/2). We check the screener's miss against that.
  {
    const phaseDeg = 0.20 // ~small separation
    const l2b = shiftMeanAnomaly(ISS_L2, phaseDeg)
    const objs: ScreeningObject[] = [
      { id: 1, name: "A", l1: ISS_L1, l2: ISS_L2 },
      { id: 2, name: "B", l1: ISS_L1, l2: l2b },
    ]
    const cj = await screenConjunctions(objs, {
      startMs, hours: 2, coarseStepS: 10, reportKm: 200, candidateKm: 400,
      minRelSpeedKms: 0,
    })
    // analytic expectation (circular approximation)
    const MU = 398600.4418
    const nRadS = (15.50127642 * 2 * Math.PI) / 86400 // mean motion rev/day → rad/s
    const a = Math.cbrt(MU / (nRadS * nRadS)) // semi-major axis km
    const expected = 2 * a * Math.sin((phaseDeg * Math.PI) / 180 / 2)
    const got = cj.length ? cj[0].missKm : Number.NaN
    const errKm = Math.abs(got - expected)
    const errPct = (errKm / expected) * 100
    // tolerance: circular approx + TLE eccentricity (~0.0007) → allow ~15%
    const pass = cj.length > 0 && errPct < 15
    console.log(`TEST B  in-track ${phaseDeg}° separation`)
    console.log(`        expected miss ≈ ${fmt(expected)} km (circular)`)
    console.log(`        screener miss  = ${fmt(got)} km`)
    console.log(`        error          = ${fmt(errKm)} km (${fmt(errPct, 1)}%)  → ${pass ? "PASS" : "FAIL"}`)
    if (!pass) failures++
  }

  // ---- TEST C: optional reference event ----
  const RA1 = process.env.REF_L1_A, RA2 = process.env.REF_L2_A
  const RB1 = process.env.REF_L1_B, RB2 = process.env.REF_L2_B
  if (RA1 && RA2 && RB1 && RB2) {
    const refStart = Number(process.env.REF_START_MS || startMs)
    const cj = await screenConjunctions(
      [
        { id: "A", name: "REF-A", l1: RA1, l2: RA2 },
        { id: "B", name: "REF-B", l1: RB1, l2: RB2 },
      ],
      { startMs: refStart, hours: Number(process.env.REF_HOURS || 24), coarseStepS: 10, reportKm: 50, candidateKm: 200, minRelSpeedKms: 0 },
    )
    if (cj.length) {
      const c = cj[0]
      console.log(`\nTEST C  reference event`)
      console.log(`        TCA   = ${new Date(c.tcaMs).toISOString()}`)
      console.log(`        miss  = ${fmt(c.missKm)} km   relSpeed = ${fmt(c.relSpeedKms)} km/s`)
      if (process.env.REF_MISS_KM) {
        const err = Math.abs(c.missKm - Number(process.env.REF_MISS_KM))
        console.log(`        vs reference miss ${process.env.REF_MISS_KM} km → error ${fmt(err)} km`)
      }
    } else {
      console.log(`\nTEST C  reference event → no conjunction found (check window/TLEs)`)
    }
  } else {
    console.log(`\nTEST C  (skipped — set REF_L1_A/REF_L2_A/REF_L1_B/REF_L2_B to cross-check a real event)`)
  }

  console.log(`\n${failures === 0 ? "✓ all checks passed" : `✗ ${failures} check(s) failed`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
