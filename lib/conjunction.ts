/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 *
 * Conjunction screening — close-approach prediction for Earth orbit.
 *
 * Given a catalog of TLEs (CelesTrak/Space-Track format), finds pairs of
 * objects that pass within a reporting threshold of each other over a
 * screening window, with the time of closest approach (TCA), miss distance,
 * and relative speed. This is the open-source analogue of the screening layer
 * commercial SSA providers (LeoLabs, COMSPOC) run against their radar
 * catalogs — here driven by the public TLE catalog instead.
 *
 * Pipeline (the standard sieve → coarse → refine shape):
 *
 *   1. SIEVE  — per-object perigee/apogee radii from the TLE mean elements;
 *               pairs whose radial bands don't overlap (padded) can never
 *               meet and are excluded by construction.
 *   2. COARSE — propagate the whole catalog on a fixed time grid (SGP4) and
 *               spatial-hash positions per step; only neighbours within
 *               adjacent cells are distance-tested. Tracks each pair's
 *               coarse minimum.
 *   3. REFINE — for pairs whose coarse minimum beats the candidate gate,
 *               golden-section-minimize the true distance(t) around the
 *               coarse TCA to sub-second precision.
 *
 * Honest limitations, stated once and clearly:
 *   - TLEs carry NO covariance. This screens GEOMETRY, not probability —
 *     no Pc is computed, because pretending to know one from TLEs would be
 *     fiction. Operators use owner ephemerides + tracked covariance for that.
 *   - SGP4 accuracy degrades with TLE age (km-scale within days). Screen
 *     near the catalog snapshot epoch; results are situational awareness,
 *     not operational collision avoidance.
 *
 * Pure module: no React, no DOM. satellite.js is imported dynamically (the
 * repo-wide convention — a static import hangs `next build`), so this runs
 * identically in the browser, a Web Worker, or Node.
 */

export type ScreeningObject = {
  id: number | string
  name: string
  /** TLE line 1 / line 2. */
  l1: string
  l2: string
  /** Optional catalog type (PAY / R/B / DEB) — carried through to results. */
  type?: string
  owner?: string
}

export type Conjunction = {
  a: { id: number | string; name: string; type?: string; owner?: string }
  b: { id: number | string; name: string; type?: string; owner?: string }
  /** Time of closest approach, ms since epoch. */
  tcaMs: number
  /** Refined miss distance, km. */
  missKm: number
  /** Relative speed at TCA, km/s. */
  relSpeedKms: number
}

export type ScreeningOptions = {
  /** Screening window start (ms since epoch). */
  startMs: number
  /** Window length in hours. Default 24. */
  hours?: number
  /** Coarse grid step, seconds. Default 60. */
  coarseStepS?: number
  /** Report pairs with refined miss ≤ this, km. Default 10. */
  reportKm?: number
  /**
   * Exclude pairs slower than this relative speed at TCA, km/s. Default 0.1.
   * Docked complexes (the ISS modules are catalogued as separate objects),
   * tethered pairs and formation flyers sit at ~0 km with ~0 km/s forever —
   * true positives geometrically, noise operationally. Set 0 to see them.
   */
  minRelSpeedKms?: number
  /** Refine pairs whose coarse minimum ≤ this, km. Default 100. */
  candidateKm?: number
  /**
   * Spatial-hash cell size, km. Must exceed the distance two objects can
   * close between coarse samples (~15 km/s worst-case relative speed →
   * 900 km at 60 s). Default 1000.
   */
  cellKm?: number
  /** Progress callback, 0..1. */
  onProgress?: (fraction: number) => void
  /** Cooperative-yield hook (e.g. `() => new Promise(r => setTimeout(r))`
   *  from a Worker) — called between coarse steps so long screens don't
   *  block the thread. */
  yieldEvery?: { steps: number; fn: () => Promise<void> }
}

// Minimal satellite.js surface (dynamic import; no bundled types needed).
type SatRec = { error: number }
type EciVec = { x: number; y: number; z: number }
type SatLib = {
  twoline2satrec: (l1: string, l2: string) => SatRec
  propagate: (rec: SatRec, date: Date) => { position?: EciVec | boolean; velocity?: EciVec | boolean }
}

const MU_EARTH = 398600.4418 // km³/s²

let _satLib: Promise<SatLib> | null = null
function satLib(): Promise<SatLib> {
  if (!_satLib) _satLib = import("satellite.js") as unknown as Promise<SatLib>
  return _satLib
}

/** Perigee/apogee GEOCENTRIC radii (km) from a satrec's mean elements. */
function radialBand(rec: SatRec): { rp: number; ra: number } | null {
  const r = rec as unknown as { no: number; ecco: number }
  if (!isFinite(r.no) || r.no <= 0) return null
  const nRadS = r.no / 60 // satrec.no is rad/min
  const a = Math.cbrt(MU_EARTH / (nRadS * nRadS))
  const e = Math.min(0.999, Math.max(0, r.ecco))
  return { rp: a * (1 - e), ra: a * (1 + e) }
}

function dist2(ax: number, ay: number, az: number, bx: number, by: number, bz: number): number {
  const dx = ax - bx
  const dy = ay - by
  const dz = az - bz
  return dx * dx + dy * dy + dz * dz
}

/**
 * Screen a catalog for close approaches. Returns conjunctions sorted by
 * miss distance (closest first).
 */
export async function screenConjunctions(
  objects: ScreeningObject[],
  options: ScreeningOptions,
): Promise<Conjunction[]> {
  const sat = await satLib()
  const {
    startMs,
    hours = 24,
    coarseStepS = 60,
    reportKm = 10,
    candidateKm = 100,
    cellKm = 1000,
    minRelSpeedKms = 0.1,
    onProgress,
    yieldEvery,
  } = options

  // ---- 1. Init + radial-band sieve data -------------------------------
  const recs: SatRec[] = []
  const meta: ScreeningObject[] = []
  const bands: { rp: number; ra: number }[] = []
  for (const o of objects) {
    try {
      const rec = sat.twoline2satrec(o.l1, o.l2)
      if (rec.error !== 0) continue
      const band = radialBand(rec)
      if (!band) continue
      recs.push(rec)
      meta.push(o)
      bands.push(band)
    } catch {
      // Malformed TLE — skip; screening a public catalog must never throw.
    }
  }
  const n = recs.length

  // ---- 2. Coarse grid + spatial hash ----------------------------------
  const steps = Math.max(1, Math.round((hours * 3600) / coarseStepS))
  const px = new Float64Array(n)
  const py = new Float64Array(n)
  const pz = new Float64Array(n)
  const alive = new Uint8Array(n).fill(1)
  // Pair key → [coarse min (km²), t at min (ms)]. Keys pack the index pair.
  const pairMin = new Map<number, [number, number]>()
  const candGate2 = candidateKm * candidateKm
  const bandPad = candidateKm

  const cellOf = (v: number) => Math.floor(v / cellKm)

  for (let s = 0; s <= steps; s++) {
    const tMs = startMs + s * coarseStepS * 1000
    const date = new Date(tMs)

    // Propagate everything still healthy.
    const cells = new Map<string, number[]>()
    for (let i = 0; i < n; i++) {
      if (!alive[i]) continue
      const pv = sat.propagate(recs[i], date)
      const p = pv.position
      if (!p || typeof p === "boolean") {
        alive[i] = 0 // decayed / SGP4 error — drop for the rest of the window
        continue
      }
      px[i] = p.x
      py[i] = p.y
      pz[i] = p.z
      const key = `${cellOf(p.x)}:${cellOf(p.y)}:${cellOf(p.z)}`
      const bucket = cells.get(key)
      if (bucket) bucket.push(i)
      else cells.set(key, [i])
    }

    // Neighbour test: each object against its own cell + the 26 adjacent.
    // To visit each pair once, only look at cells in canonical (+) order.
    for (const [key, bucket] of cells) {
      const [cx, cy, cz] = key.split(":").map(Number)
      // In-cell pairs.
      for (let bi = 0; bi < bucket.length; bi++) {
        for (let bj = bi + 1; bj < bucket.length; bj++) {
          testPair(bucket[bi], bucket[bj], tMs)
        }
      }
      // Half of the 26 neighbours (the other half sees us from their side).
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          for (let oz = -1; oz <= 1; oz++) {
            if (ox === 0 && oy === 0 && oz === 0) continue
            if (ox < 0 || (ox === 0 && (oy < 0 || (oy === 0 && oz < 0)))) continue
            const other = cells.get(`${cx + ox}:${cy + oy}:${cz + oz}`)
            if (!other) continue
            for (const i of bucket) for (const j of other) testPair(i, j, tMs)
          }
        }
      }
    }

    onProgress?.(s / steps)
    if (yieldEvery && s % yieldEvery.steps === 0) await yieldEvery.fn()
  }

  function testPair(i: number, j: number, tMs: number) {
    // Radial-band sieve — non-overlapping bands can't meet.
    const A = bands[i]
    const B = bands[j]
    if (A.rp - bandPad > B.ra || B.rp - bandPad > A.ra) return
    const d2 = dist2(px[i], py[i], pz[i], px[j], py[j], pz[j])
    if (d2 > candGate2) return
    const key = i < j ? i * n + j : j * n + i
    const cur = pairMin.get(key)
    if (!cur || d2 < cur[0]) pairMin.set(key, [d2, tMs])
  }

  // ---- 3. Refine candidates -------------------------------------------
  const distAt = (i: number, j: number, tMs: number): number => {
    const date = new Date(tMs)
    const a = sat.propagate(recs[i], date).position
    const b = sat.propagate(recs[j], date).position
    if (!a || typeof a === "boolean" || !b || typeof b === "boolean") return Infinity
    return Math.sqrt(dist2(a.x, a.y, a.z, b.x, b.y, b.z))
  }

  const results: Conjunction[] = []
  const halfWinMs = coarseStepS * 1000
  const PHI = (Math.sqrt(5) - 1) / 2

  for (const [key, [, tCoarse]] of pairMin) {
    const i = Math.floor(key / n)
    const j = key % n
    // Golden-section minimum of distance(t) in [tCoarse − step, tCoarse + step].
    let lo = tCoarse - halfWinMs
    let hi = tCoarse + halfWinMs
    let t1 = hi - PHI * (hi - lo)
    let t2 = lo + PHI * (hi - lo)
    let d1 = distAt(i, j, t1)
    let d2v = distAt(i, j, t2)
    for (let iter = 0; iter < 40 && hi - lo > 100; iter++) {
      if (d1 <= d2v) {
        hi = t2
        t2 = t1
        d2v = d1
        t1 = hi - PHI * (hi - lo)
        d1 = distAt(i, j, t1)
      } else {
        lo = t1
        t1 = t2
        d1 = d2v
        t2 = lo + PHI * (hi - lo)
        d2v = distAt(i, j, t2)
      }
    }
    const tcaMs = (lo + hi) / 2
    const missKm = distAt(i, j, tcaMs)
    if (!isFinite(missKm) || missKm > reportKm) continue

    // Relative speed straight from the SGP4 velocity vectors at TCA.
    const date = new Date(tcaMs)
    const va = sat.propagate(recs[i], date).velocity
    const vb = sat.propagate(recs[j], date).velocity
    let relSpeedKms = 0
    if (va && typeof va !== "boolean" && vb && typeof vb !== "boolean") {
      relSpeedKms = Math.sqrt(dist2(va.x, va.y, va.z, vb.x, vb.y, vb.z))
    }
    if (relSpeedKms < minRelSpeedKms) continue

    results.push({
      a: { id: meta[i].id, name: meta[i].name, type: meta[i].type, owner: meta[i].owner },
      b: { id: meta[j].id, name: meta[j].name, type: meta[j].type, owner: meta[j].owner },
      tcaMs,
      missKm,
      relSpeedKms,
    })
  }

  results.sort((a, b) => a.missKm - b.missKm)
  return results
}
