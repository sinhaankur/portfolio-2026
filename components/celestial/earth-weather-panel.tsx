"use client"

/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine. Others may reference this work.
 * https://github.com/sinhaankur/portfolio-2026
 *
 * EarthWeatherPanel — live weather on the surface of the planet you're looking
 * at. The engine shows Earth from orbit; this shows what it's actually doing down
 * there right now: current conditions, a six-day forecast, and air quality, for
 * your location or any place you search. Alongside it, a real NASA Earth-
 * observation layer (MODIS land-surface temperature) as the whole-globe view —
 * the seed of the broader Earth-data theme.
 *
 * Every source is keyless + CORS-open (Open-Meteo, NASA GIBS). Fails soft.
 */

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { CloudSun, X, Search, MapPin, Thermometer } from "lucide-react"
import {
  searchPlaces,
  fetchWeather,
  weatherLabel,
  weatherIcon,
  aqiCategory,
  type Place,
  type Weather,
} from "@/lib/weather"
import { fetchGibsLandTemp, type GibsMosaic } from "@/lib/gibs"

export function EarthWeatherPanel({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Place[]>([])
  const [weather, setWeather] = useState<Weather | null>(null)
  const [loading, setLoading] = useState(true)
  const [landTemp, setLandTemp] = useState<GibsMosaic | null>(null)

  // On open: try the user's location, else a sensible default place.
  useEffect(() => {
    let alive = true
    const load = (p: Place) => fetchWeather(p).then((w) => { if (alive) { setWeather(w); setLoading(false) } })
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => load({ name: "Your location", country: null, lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => load({ name: "London", country: "United Kingdom", lat: 51.51, lon: -0.13 }),
        { timeout: 8000, maximumAge: 600000 },
      )
    } else {
      load({ name: "London", country: "United Kingdom", lat: 51.51, lon: -0.13 })
    }
    return () => { alive = false }
  }, [])

  // The NASA land-surface-temperature whole-globe layer (optional; loads async).
  useEffect(() => {
    let alive = true
    fetchGibsLandTemp().then((m) => { if (alive && m) setLandTemp(m) })
    return () => { alive = false }
  }, [])

  // Debounced place search.
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setResults([]); return }
    const id = setTimeout(() => { searchPlaces(q).then(setResults) }, 300)
    return () => clearTimeout(id)
  }, [query])

  const pick = (p: Place) => {
    setResults([])
    setQuery("")
    setLoading(true)
    fetchWeather(p).then((w) => { setWeather(w); setLoading(false) })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="w-[min(22rem,calc(100vw-2rem))] max-h-[80vh] overflow-y-auto rounded-xl border border-[#8ad0ff]/40 bg-background/90 backdrop-blur-md shadow-[0_16px_48px_-20px_rgba(0,0,0,0.7)]"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border bg-background/90 backdrop-blur">
        <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase text-[#8ad0ff]">
          <CloudSun className="h-3.5 w-3.5" /> Earth · weather · live
        </p>
        <button type="button" onClick={onClose} aria-label="Close"
          className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="p-4 space-y-3">
        {/* Place search */}
        <div className="relative">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-background/60 px-2.5 py-1.5">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search any place on Earth…"
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
            />
          </div>
          {results.length > 0 && (
            <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-background/95 backdrop-blur shadow-lg">
              {results.map((p, i) => (
                <li key={`${p.lat},${p.lon},${i}`}>
                  <button type="button" onClick={() => pick(p)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-foreground hover:bg-secondary/60">
                    <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span>{p.name}{p.country && <span className="text-muted-foreground"> · {p.country}</span>}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {loading && <p className="font-sans text-sm text-muted-foreground">Reading the weather…</p>}
        {!loading && !weather && (
          <p className="font-sans text-sm text-muted-foreground">Weather feed unavailable right now.</p>
        )}

        {!loading && weather && (
          <>
            {/* Current conditions */}
            <div className="rounded-lg border border-border bg-background/60 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-display text-lg leading-tight text-foreground">
                    {weather.place.name}
                    {weather.place.country && <span className="text-muted-foreground text-sm"> · {weather.place.country}</span>}
                  </p>
                  <p className="font-sans text-[13px] text-foreground/80">
                    {weatherIcon(weather.code)} {weatherLabel(weather.code)}
                  </p>
                </div>
                <p className="font-display text-3xl tabular-nums text-foreground">{Math.round(weather.tempC)}°</p>
              </div>
              <dl className="mt-2.5 grid grid-cols-3 gap-2 font-mono text-[10px]">
                <div>
                  <dt className="tracking-widest uppercase text-muted-foreground">Wind</dt>
                  <dd className="text-foreground tabular-nums">{Math.round(weather.windKmh)} km/h</dd>
                </div>
                <div>
                  <dt className="tracking-widest uppercase text-muted-foreground">Humidity</dt>
                  <dd className="text-foreground tabular-nums">{weather.humidity != null ? `${weather.humidity}%` : "—"}</dd>
                </div>
                {weather.aqi != null && (() => {
                  const cat = aqiCategory(weather.aqi)
                  return (
                    <div>
                      <dt className="tracking-widest uppercase text-muted-foreground">Air (US AQI)</dt>
                      <dd className="tabular-nums" style={{ color: cat.color }}>{weather.aqi} · {cat.label}</dd>
                    </div>
                  )
                })()}
              </dl>
            </div>

            {/* Six-day forecast */}
            {weather.days.length > 0 && (
              <div>
                <p className="mb-1.5 font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground">Next days</p>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {weather.days.map((d) => (
                    <div key={d.date} className="shrink-0 rounded-lg border border-border bg-background/60 px-2.5 py-2 text-center min-w-[3.5rem]">
                      <p className="font-mono text-[9px] uppercase text-muted-foreground">
                        {new Date(d.date).toLocaleDateString(undefined, { weekday: "short" })}
                      </p>
                      <p className="text-base leading-tight">{weatherIcon(d.code)}</p>
                      <p className="font-mono text-[10px] tabular-nums text-foreground">{Math.round(d.maxC)}°</p>
                      <p className="font-mono text-[10px] tabular-nums text-muted-foreground">{Math.round(d.minC)}°</p>
                      {d.precipProb != null && d.precipProb > 0 && (
                        <p className="font-mono text-[9px] tabular-nums text-[#8ad0ff]">{d.precipProb}%</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* NASA land-surface temperature — whole-globe Earth-observation layer */}
            {landTemp && (
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 font-mono text-[9px] tracking-[0.2em] uppercase text-[#ffb27a]">
                  <Thermometer className="h-3 w-3" /> Land-surface temperature · whole Earth
                </p>
                <div className="overflow-hidden rounded-lg border border-border bg-black">
                  <img src={landTemp.url} alt="NASA MODIS land-surface temperature, whole Earth"
                    loading="lazy" className="block w-full" referrerPolicy="no-referrer" />
                </div>
                <p className="mt-1 font-mono text-[9px] text-muted-foreground/70">
                  {landTemp.source} · {landTemp.date} — measured over cloud-free land only, so oceans + clouds read as gaps.
                </p>
              </div>
            )}

            <p className="font-mono text-[9px] text-muted-foreground/70">
              Sources: Open-Meteo (weather · air quality){landTemp ? " · NASA GIBS (land temp)" : ""}
            </p>
          </>
        )}
      </div>
    </motion.div>
  )
}
