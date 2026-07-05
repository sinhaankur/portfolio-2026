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
