/**
 * sat-inventory — categorize the real satellite/debris catalogue by orbit regime
 * (LEO/MEO/GEO/HEO) and object type (payload/rocket-body/debris), computed from
 * the actual TLE mean motion + eccentricity. No guessing — real numbers.
 *
 * Also carries known real sizes for a curated set of named craft, with their
 * ratio to Earth's diameter (12,742 km) so "how big is it, really?" is honest:
 * even the ISS (109 m) is ~117,000× smaller than Earth.
 */

import type { SatMeta } from "@/components/universe-engine/satellite-field"

const R = 6371 // km
const MU = 398600.4418 // km^3/s^2
export const EARTH_DIAMETER_KM = 12742

export type Regime = "LEO" | "MEO" | "GEO" | "HEO"

export type InventoryRow = {
  regime: Regime
  label: string
  altRange: string
  payload: number
  rocket: number
  debris: number
  total: number
}

/** One 100-km altitude bin in the LEO density histogram — where the crowding
 *  actually is (the Starlink shell, the sun-sync belt), payload vs debris split. */
export type AltBin = {
  lowKm: number
  highKm: number
  payload: number
  debris: number // includes rocket bodies — all uncontrolled hazard
  total: number
}

export type Inventory = {
  rows: InventoryRow[]
  totals: { payload: number; rocket: number; debris: number; total: number }
  /** LEO altitude density, 0–2000 km in 100-km bins — the congestion picture. */
  leoDensity: AltBin[]
}

/** Altitude (km) of the orbit's semi-major axis from TLE line 2 mean motion. */
function altKm(l2: string): number | null {
  const mm = parseFloat(l2.substring(52, 63))
  if (!(mm > 0)) return null
  const n = (mm * 2 * Math.PI) / 86400
  const a = Math.cbrt(MU / (n * n))
  return a - R
}
function eccentricity(l2: string): number {
  return parseFloat("0." + l2.substring(26, 33).trim())
}

/** Classify one catalogue object into an orbit regime from its real elements. */
export function classifyRegime(l2: string): Regime | null {
  const alt = altKm(l2)
  if (alt == null) return null
  if (eccentricity(l2) > 0.25) return "HEO"
  if (alt < 2000) return "LEO"
  if (alt < 34000) return "MEO"
  if (alt < 37000) return "GEO"
  return "MEO" // rare very-high near-circular → lump with MEO
}

const REGIME_META: Record<Regime, { label: string; altRange: string }> = {
  LEO: { label: "Low Earth orbit", altRange: "160–2,000 km" },
  MEO: { label: "Medium Earth orbit", altRange: "2,000–34,000 km" },
  GEO: { label: "Geostationary belt", altRange: "~35,786 km" },
  HEO: { label: "Highly elliptical", altRange: "eccentric" },
}

/** Build the full inventory from the loaded catalogue (needs l2 — pass the raw
 *  sats array that carries the TLE lines). */
export function buildInventory(sats: { l2: string; type?: string }[]): Inventory {
  const acc: Record<Regime, { payload: number; rocket: number; debris: number }> = {
    LEO: { payload: 0, rocket: 0, debris: 0 },
    MEO: { payload: 0, rocket: 0, debris: 0 },
    GEO: { payload: 0, rocket: 0, debris: 0 },
    HEO: { payload: 0, rocket: 0, debris: 0 },
  }
  // LEO density histogram: 0–2000 km in 100-km bins (20 bins).
  const BIN = 100, N_BINS = 20
  const bins: AltBin[] = Array.from({ length: N_BINS }, (_, i) => ({
    lowKm: i * BIN, highKm: (i + 1) * BIN, payload: 0, debris: 0, total: 0,
  }))
  for (const s of sats) {
    const reg = classifyRegime(s.l2)
    if (!reg) continue
    if (s.type === "DEB") acc[reg].debris++
    else if (s.type === "R/B") acc[reg].rocket++
    else acc[reg].payload++
    // altitude-bin only LEO objects (the crowded band)
    const alt = altKm(s.l2)
    if (alt != null && alt >= 0 && alt < N_BINS * BIN) {
      const b = bins[Math.floor(alt / BIN)]
      if (s.type === "DEB" || s.type === "R/B") b.debris++
      else b.payload++
      b.total++
    }
  }
  const order: Regime[] = ["LEO", "MEO", "GEO", "HEO"]
  const rows: InventoryRow[] = order.map((regime) => {
    const a = acc[regime]
    return {
      regime,
      label: REGIME_META[regime].label,
      altRange: REGIME_META[regime].altRange,
      payload: a.payload,
      rocket: a.rocket,
      debris: a.debris,
      total: a.payload + a.rocket + a.debris,
    }
  })
  const totals = rows.reduce(
    (t, r) => ({ payload: t.payload + r.payload, rocket: t.rocket + r.rocket, debris: t.debris + r.debris, total: t.total + r.total }),
    { payload: 0, rocket: 0, debris: 0, total: 0 },
  )
  return { rows, totals, leoDensity: bins }
}

// Known real sizes (longest dimension, metres) for recognizable craft — sourced
// from public spec sheets. Ratio to Earth's diameter shows how vanishingly small
// even the biggest human structures in space are.
export const KNOWN_SIZES: { name: string; sizeM: number; note: string }[] = [
  { name: "ISS", sizeM: 109, note: "International Space Station — largest structure in orbit" },
  { name: "Tiangong", sizeM: 55, note: "China's space station" },
  { name: "Hubble", sizeM: 13.2, note: "Hubble Space Telescope" },
  { name: "Starlink", sizeM: 8.3, note: "one Starlink v1.5 (with solar array)" },
  { name: "GPS", sizeM: 17, note: "a GPS/NAVSTAR craft, arrays deployed" },
  { name: "CubeSat (3U)", sizeM: 0.34, note: "a common 3-unit CubeSat" },
]

/** Ratio string like "1 / 117,000th of Earth's diameter". */
export function earthRatio(sizeM: number): string {
  const ratio = EARTH_DIAMETER_KM * 1000 / sizeM
  return `1 / ${Math.round(ratio).toLocaleString()} of Earth's width`
}

// avoid an unused-import error while keeping the SatMeta type reference for docs
export type _Meta = SatMeta
