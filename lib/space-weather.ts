/**
 * space-weather — live geomagnetic conditions + aurora likelihood from NOAA's
 * Space Weather Prediction Center (SWPC). Free, no key.
 *
 * All values are real and current: planetary Kp index, solar-wind speed, and the
 * interplanetary magnetic field Bz (southward Bz drives aurora). We translate Kp
 * into the lowest geomagnetic latitude where aurora is typically visible, then
 * compare to the user's latitude for an honest "likely / possible / no" call.
 */

export type SpaceWeather = {
  kp: number
  kpTime: string
  windSpeedKms: number | null
  bz: number | null // nT; negative (south) is aurora-favorable
  auroraMinLatDeg: number // lowest geomagnetic lat aurora is usually visible at
  updated: string
}

// Kp → approximate lowest geomagnetic latitude of the auroral oval's equatorward
// edge (well-established NOAA/space-weather mapping). Higher Kp pushes it south.
const KP_TO_MIN_LAT: Record<number, number> = {
  0: 66, 1: 64, 2: 62, 3: 60, 4: 57, 5: 54, 6: 51, 7: 48, 8: 45, 9: 42,
}
export function kpToAuroraMinLat(kp: number): number {
  const k = Math.max(0, Math.min(9, Math.round(kp)))
  return KP_TO_MIN_LAT[k]
}

async function jsonOrNull(url: string): Promise<unknown | null> {
  try {
    const r = await fetch(url)
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}

export async function fetchSpaceWeather(): Promise<SpaceWeather | null> {
  const [kpArr, windArr, magArr] = await Promise.all([
    jsonOrNull("https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json"),
    jsonOrNull("https://services.swpc.noaa.gov/products/summary/solar-wind-speed.json"),
    jsonOrNull("https://services.swpc.noaa.gov/products/summary/solar-wind-mag-field.json"),
  ])
  if (!Array.isArray(kpArr) || kpArr.length < 2) return null

  // kp product is a header row + data rows: [time_tag, Kp, a_running, station_count]
  const rows = kpArr as unknown[]
  const last = rows[rows.length - 1] as { time_tag?: string; Kp?: number } | (string | number)[]
  let kp = 0, kpTime = ""
  if (Array.isArray(last)) {
    kpTime = String(last[0]); kp = Number(last[1])
  } else {
    kpTime = String(last.time_tag ?? ""); kp = Number(last.Kp ?? 0)
  }

  const windSpeedKms =
    Array.isArray(windArr) && windArr[0] && typeof (windArr[0] as { proton_speed?: number }).proton_speed === "number"
      ? Math.round((windArr[0] as { proton_speed: number }).proton_speed)
      : null
  const bz =
    Array.isArray(magArr) && magArr[0] && typeof (magArr[0] as { bz_gsm?: number }).bz_gsm === "number"
      ? (magArr[0] as { bz_gsm: number }).bz_gsm
      : null

  return {
    kp,
    kpTime,
    windSpeedKms,
    bz,
    auroraMinLatDeg: kpToAuroraMinLat(kp),
    updated: new Date().toISOString(),
  }
}

/** Human label for the current geomagnetic activity from Kp. */
export function kpLabel(kp: number): string {
  if (kp < 4) return "Quiet"
  if (kp < 5) return "Unsettled"
  if (kp < 6) return "Minor storm (G1)"
  if (kp < 7) return "Moderate storm (G2)"
  if (kp < 8) return "Strong storm (G3)"
  if (kp < 9) return "Severe storm (G4)"
  return "Extreme storm (G5)"
}

/** Aurora call for a given observer latitude vs the current oval. */
export function auroraCall(userLatDeg: number, minLatDeg: number): "likely" | "possible" | "no" {
  const abs = Math.abs(userLatDeg)
  if (abs >= minLatDeg) return "likely"
  if (abs >= minLatDeg - 5) return "possible"
  return "no"
}

// --- DONKI: real solar-flare event history (NASA) -----------------------------
// The NASA key ships in the bundle (read-only, rate-limited). Falls back to
// DEMO_KEY if unset.
const NASA_KEY = process.env.NEXT_PUBLIC_NASA_KEY || "DEMO_KEY"

export type SolarFlare = {
  classType: string // e.g. "M1.6", "X2.3"
  peakTime: string
  region: string | null
}

/** Recent solar flares from NASA DONKI (last `days` days). "What the Sun
 *  actually did" — deeper than NOAA's live Kp snapshot. */
export async function fetchRecentFlares(days = 14): Promise<SolarFlare[]> {
  const end = new Date().toISOString().slice(0, 10)
  const start = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
  try {
    const r = await fetch(`https://api.nasa.gov/DONKI/FLR?startDate=${start}&endDate=${end}&api_key=${NASA_KEY}`)
    if (!r.ok) return []
    const j = (await r.json()) as { classType?: string; peakTime?: string; activeRegionNum?: number | null }[]
    if (!Array.isArray(j)) return []
    return j
      .map((f) => ({ classType: f.classType ?? "?", peakTime: f.peakTime ?? "", region: f.activeRegionNum ? String(f.activeRegionNum) : null }))
      .filter((f) => f.peakTime)
      .sort((a, b) => new Date(b.peakTime).getTime() - new Date(a.peakTime).getTime())
      .slice(0, 5)
  } catch {
    return []
  }
}

/** Rank a flare class for coloring: X > M > C > B/A. */
export function flareSeverity(classType: string): "high" | "med" | "low" {
  const c = classType[0]?.toUpperCase()
  if (c === "X") return "high"
  if (c === "M") return "med"
  return "low"
}

// --- NOAA/SWPC: live OVATION aurora forecast + GOES X-ray flux ----------------
// Both are keyless and served with `Access-Control-Allow-Origin: *`, so they load
// directly from the static site. These deepen the snapshot: OVATION gives the
// modelled aurora oval right now (not just the Kp-derived latitude), and the GOES
// X-ray flux is the Sun's live output that flare classes are read from.

export type AuroraForecast = {
  forecastTime: string
  /** Peak aurora probability (%) anywhere in the model grid. */
  peakProbability: number
  /** Peak aurora probability (%) within ±3° of the observer's latitude, if known. */
  atUserProbability: number | null
}

/**
 * NOAA OVATION aurora nowcast. The raw grid is ~65k [lon, lat, prob%] triples —
 * far too heavy to surface whole, so we reduce it to the peak probability overall
 * and (if we know the observer's latitude) the peak in their latitude band. Fails
 * soft to null.
 */
export async function fetchAuroraForecast(userLatDeg: number | null): Promise<AuroraForecast | null> {
  const j = await jsonOrNull("https://services.swpc.noaa.gov/json/ovation_aurora_latest.json")
  const grid = (j as { coordinates?: [number, number, number][]; ["Forecast Time"]?: string } | null)
  if (!grid || !Array.isArray(grid.coordinates)) return null

  let peak = 0
  let atUser = userLatDeg == null ? null : 0
  for (const c of grid.coordinates) {
    const lat = c[1]
    const prob = c[2]
    if (prob > peak) peak = prob
    if (userLatDeg != null && Math.abs(lat - userLatDeg) <= 3 && prob > (atUser as number)) atUser = prob
  }
  return {
    forecastTime: String(grid["Forecast Time"] ?? ""),
    peakProbability: Math.round(peak),
    atUserProbability: atUser == null ? null : Math.round(atUser),
  }
}

export type XrayFlux = {
  /** W/m² in the 0.1–0.8 nm band (the band GOES flare classes are defined on). */
  flux: number
  /** Derived flare-class label from the flux, e.g. "C2.4", "M1.1", "B7". */
  classLabel: string
  time: string
}

/** Convert a 0.1–0.8 nm flux (W/m²) to the standard A/B/C/M/X flare class. */
export function fluxToClass(flux: number): string {
  if (!Number.isFinite(flux) || flux <= 0) return "—"
  const bands: [string, number][] = [
    ["X", 1e-4], ["M", 1e-5], ["C", 1e-6], ["B", 1e-7], ["A", 1e-8],
  ]
  for (const [letter, base] of bands) {
    if (flux >= base) return `${letter}${(flux / base).toFixed(1)}`
  }
  return "<A1"
}

/** Live GOES long-band X-ray flux — the Sun's current output right now. */
export async function fetchXrayFlux(): Promise<XrayFlux | null> {
  const j = await jsonOrNull("https://services.swpc.noaa.gov/json/goes/primary/xrays-1-day.json")
  if (!Array.isArray(j) || j.length === 0) return null
  // Take the most recent long-band (0.1–0.8 nm) sample.
  const long = (j as { energy?: string; flux?: number; time_tag?: string }[])
    .filter((r) => r.energy === "0.1-0.8nm" && typeof r.flux === "number")
  const last = long[long.length - 1]
  if (!last || typeof last.flux !== "number") return null
  return { flux: last.flux, classLabel: fluxToClass(last.flux), time: String(last.time_tag ?? "") }
}
