/**
 * wind — the force that actually makes the waves.
 *
 * A tiny, honest wave model: wind speed + fetch + duration set the sea state
 * (roughly the Beaufort/Douglas idea). We turn a wind description into the
 * parameters the Gerstner ocean shader needs — a set of wave trains with
 * directions spread around the wind, amplitudes/wavelengths that grow with
 * wind, plus a chop factor. Not a full spectral (JONSWAP) model — a legible
 * approximation that behaves right: more wind → taller, longer, steeper waves.
 */

export type Wind = {
  /** Direction the wind blows TOWARD, degrees (0=N, 90=E). */
  dirDeg: number
  /** Wind speed, m/s (~0 calm, 5 breeze, 10 fresh, 15+ strong). */
  speed: number
  /** Fetch — open-water distance the wind has worked over, km (bigger = bigger swell). */
  fetchKm: number
}

export type WaveTrain = {
  dirX: number
  dirZ: number
  amplitude: number
  wavelength: number
  speed: number
  steepness: number
}

/** Sea-state label from wind speed (Beaufort-ish). */
export function seaState(speed: number): string {
  if (speed < 1) return "Glassy calm"
  if (speed < 3) return "Rippled"
  if (speed < 6) return "Small waves"
  if (speed < 9) return "Moderate swell"
  if (speed < 12) return "Fresh, whitecaps"
  if (speed < 16) return "Strong, spray"
  return "Rough sea"
}

/**
 * Build a set of Gerstner wave trains from the wind. Waves fan out around the
 * wind direction; the dominant wavelength + amplitude scale with wind speed and
 * fetch (empirically-shaped, not spectral). A gentle chop rides on top.
 */
export function waveTrains(wind: Wind, count = 5): WaveTrain[] {
  const rad = (wind.dirDeg * Math.PI) / 180
  // Fully-developed-ish dominant wavelength grows with wind speed (m) and fetch.
  const fetchBoost = Math.min(2, 0.6 + wind.fetchKm / 400)
  const baseLen = Math.max(4, wind.speed * wind.speed * 0.9 * fetchBoost) // ~ U²/g-ish
  const baseAmp = Math.max(0.05, wind.speed * 0.09 * fetchBoost)

  const trains: WaveTrain[] = []
  for (let i = 0; i < count; i++) {
    // Spread directions ±~55° around the wind, biggest wave aligned with it.
    const spread = ((i - (count - 1) / 2) / count) * (55 * Math.PI) / 180
    const a = rad + spread
    const scale = 1 - i * 0.14 // successive trains a bit smaller/shorter
    const wavelength = baseLen * (0.5 + scale)
    const amplitude = baseAmp * scale * (0.7 + 0.3 * Math.cos(spread))
    // Deep-water phase speed c = sqrt(g·L/2π)
    const speed = Math.sqrt((9.81 * wavelength) / (2 * Math.PI))
    // Steepness rises with wind (chop); capped so it never self-intersects.
    const steepness = Math.min(0.9, 0.18 + wind.speed * 0.03) / count
    trains.push({
      dirX: Math.sin(a),
      dirZ: Math.cos(a),
      amplitude,
      wavelength: Math.max(1.5, wavelength),
      speed,
      steepness,
    })
  }
  return trains
}
