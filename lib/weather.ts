/**
 * weather.ts — live terrestrial weather + air quality for any place on Earth,
 * from Open-Meteo. Free, keyless, and CORS-open, so it loads directly from the
 * static-export site with nothing to leak.
 *
 * This is the SURFACE-of-Earth complement to the space-weather feed (SWPC) and
 * the from-orbit imagery (Himawari / GIBS): what the weather is actually doing
 * where you (or any searched place) are standing right now, plus the days ahead.
 *
 * Source: Open-Meteo (open-meteo.com) blends national weather-service models
 * (ECMWF, GFS, ICON, …) into a single keyless API. Geocoding (name → lat/lon)
 * and air quality (US AQI, PM2.5) come from the same family of endpoints.
 *
 * Fidelity: real model output surfaced as-is, credited. Every call has a hard
 * timeout and fails soft to null so the panel degrades gracefully.
 *
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine. Others may reference this work.
 * https://github.com/sinhaankur/portfolio-2026
 */

const FORECAST = "https://api.open-meteo.com/v1/forecast"
const GEOCODE = "https://geocoding-api.open-meteo.com/v1/search"
const AIR = "https://air-quality-api.open-meteo.com/v1/air-quality"

export type Place = {
  name: string
  country: string | null
  lat: number
  lon: number
}

export type DayForecast = {
  date: string
  code: number
  maxC: number
  minC: number
  precipProb: number | null
}

export type Weather = {
  place: Place
  tempC: number
  windKmh: number
  humidity: number | null
  isDay: boolean
  code: number
  aqi: number | null
  pm25: number | null
  days: DayForecast[]
  updated: string
}

/** Fetch JSON with a hard timeout; null on any failure. */
async function getJson(url: string, ms = 7000): Promise<unknown | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    const r = await fetch(url, { signal: ctrl.signal })
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** Place search (name → coordinates). Returns up to `count` matches. */
export async function searchPlaces(query: string, count = 5): Promise<Place[]> {
  const q = query.trim()
  if (!q) return []
  const j = await getJson(`${GEOCODE}?name=${encodeURIComponent(q)}&count=${count}&language=en&format=json`)
  const results = (j as { results?: { name: string; country?: string; latitude: number; longitude: number; admin1?: string }[] } | null)?.results
  if (!Array.isArray(results)) return []
  return results.map((r) => ({
    name: r.admin1 && r.admin1 !== r.name ? `${r.name}, ${r.admin1}` : r.name,
    country: r.country ?? null,
    lat: r.latitude,
    lon: r.longitude,
  }))
}

/** Current conditions + a short daily forecast + air quality for a place. */
export async function fetchWeather(place: Place): Promise<Weather | null> {
  const fUrl =
    `${FORECAST}?latitude=${place.lat}&longitude=${place.lon}` +
    `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,is_day` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
    `&forecast_days=6&timezone=auto`
  const aUrl = `${AIR}?latitude=${place.lat}&longitude=${place.lon}&current=us_aqi,pm2_5`

  const [f, a] = await Promise.all([getJson(fUrl), getJson(aUrl)])
  const cur = (f as { current?: Record<string, number> } | null)?.current
  if (!cur || typeof cur.temperature_2m !== "number") return null

  const daily = (f as { daily?: Record<string, (number | string)[]> }).daily
  const days: DayForecast[] = []
  if (daily && Array.isArray(daily.time)) {
    for (let i = 0; i < daily.time.length; i++) {
      days.push({
        date: String(daily.time[i]),
        code: Number(daily.weather_code?.[i] ?? 0),
        maxC: Number(daily.temperature_2m_max?.[i] ?? NaN),
        minC: Number(daily.temperature_2m_min?.[i] ?? NaN),
        precipProb:
          daily.precipitation_probability_max?.[i] != null
            ? Number(daily.precipitation_probability_max[i])
            : null,
      })
    }
  }

  const air = (a as { current?: Record<string, number> } | null)?.current
  return {
    place,
    tempC: cur.temperature_2m,
    windKmh: Number(cur.wind_speed_10m ?? NaN),
    humidity: typeof cur.relative_humidity_2m === "number" ? cur.relative_humidity_2m : null,
    isDay: cur.is_day === 1,
    code: Number(cur.weather_code ?? 0),
    aqi: air && typeof air.us_aqi === "number" ? Math.round(air.us_aqi) : null,
    pm25: air && typeof air.pm2_5 === "number" ? air.pm2_5 : null,
    days,
    updated: new Date().toISOString(),
  }
}

// WMO weather-interpretation codes → short label + a plain emoji glyph. The codes
// are the standard set Open-Meteo returns in `weather_code`.
const WMO: Record<number, { label: string; icon: string }> = {
  0: { label: "Clear", icon: "☀️" },
  1: { label: "Mainly clear", icon: "🌤️" },
  2: { label: "Partly cloudy", icon: "⛅" },
  3: { label: "Overcast", icon: "☁️" },
  45: { label: "Fog", icon: "🌫️" },
  48: { label: "Rime fog", icon: "🌫️" },
  51: { label: "Light drizzle", icon: "🌦️" },
  53: { label: "Drizzle", icon: "🌦️" },
  55: { label: "Heavy drizzle", icon: "🌧️" },
  61: { label: "Light rain", icon: "🌦️" },
  63: { label: "Rain", icon: "🌧️" },
  65: { label: "Heavy rain", icon: "🌧️" },
  66: { label: "Freezing rain", icon: "🌧️" },
  67: { label: "Freezing rain", icon: "🌧️" },
  71: { label: "Light snow", icon: "🌨️" },
  73: { label: "Snow", icon: "🌨️" },
  75: { label: "Heavy snow", icon: "❄️" },
  77: { label: "Snow grains", icon: "🌨️" },
  80: { label: "Rain showers", icon: "🌦️" },
  81: { label: "Rain showers", icon: "🌧️" },
  82: { label: "Violent showers", icon: "⛈️" },
  85: { label: "Snow showers", icon: "🌨️" },
  86: { label: "Snow showers", icon: "❄️" },
  95: { label: "Thunderstorm", icon: "⛈️" },
  96: { label: "Thunderstorm + hail", icon: "⛈️" },
  99: { label: "Thunderstorm + hail", icon: "⛈️" },
}

export function weatherLabel(code: number): string {
  return WMO[code]?.label ?? "—"
}
export function weatherIcon(code: number): string {
  return WMO[code]?.icon ?? "🌡️"
}

/** US AQI → category label + colour, per the EPA scale. */
export function aqiCategory(aqi: number): { label: string; color: string } {
  if (aqi <= 50) return { label: "Good", color: "#7affd0" }
  if (aqi <= 100) return { label: "Moderate", color: "#ffd27a" }
  if (aqi <= 150) return { label: "Unhealthy (sensitive)", color: "#ffa24a" }
  if (aqi <= 200) return { label: "Unhealthy", color: "#ff7a7a" }
  if (aqi <= 300) return { label: "Very unhealthy", color: "#d17aff" }
  return { label: "Hazardous", color: "#ff5a5a" }
}
