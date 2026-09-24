"use client"

/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine. Others may reference this work.
 * https://github.com/sinhaankur/portfolio-2026
 *
 * EarthWeatherProbe — click anywhere on the 3D Earth to read the LIVE weather
 * there. An invisible pickable sphere at the base radius captures the click; the
 * hit point (a unit direction) converts to real lat/lon, and Open-Meteo returns
 * that location's current conditions — the live-data half of the terrain engine,
 * married to the real measured relief.
 *
 * Earth only. Keyless + CORS-open (Open-Meteo). Fails soft.
 */

import { useState } from "react"
import type { ThreeEvent } from "@react-three/fiber"
import { fetchWeather, weatherLabel, weatherIcon, type Weather } from "@/lib/weather"
import { normLon } from "@/lib/terrain/bodies"

/** A picked point on Earth + the weather fetched for it (or "loading"). */
export type ProbeState =
  | { kind: "loading"; lat: number; lon: number }
  | { kind: "done"; lat: number; lon: number; weather: Weather | null }

interface Props {
  radiusUnits: number
  onProbe: (s: ProbeState | null) => void
}

/**
 * The invisible click-catcher sphere. Sits at the base radius (just under the
 * displaced terrain) so a click anywhere on the globe resolves to a surface
 * lat/lon. Renders nothing visible; only reports the probe upward.
 */
export function EarthWeatherProbe({ radiusUnits, onProbe }: Props) {
  const [busy, setBusy] = useState(false)

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (busy) return
    // The hit point on the sphere → unit direction → lat/lon (inverse of
    // latLonToUnitVec: x=cosLat cosLon, y=sinLat, z=cosLat sinLon).
    const p = e.point.clone().normalize()
    const lat = (Math.asin(Math.max(-1, Math.min(1, p.y))) * 180) / Math.PI
    const lon = normLon((Math.atan2(p.z, p.x) * 180) / Math.PI)

    setBusy(true)
    onProbe({ kind: "loading", lat, lon })
    fetchWeather({ name: "Picked point", country: null, lat, lon })
      .then((weather) => onProbe({ kind: "done", lat, lon, weather }))
      .finally(() => setBusy(false))
  }

  return (
    <mesh
      onClick={handleClick}
      onPointerOver={() => { document.body.style.cursor = "crosshair" }}
      onPointerOut={() => { document.body.style.cursor = "" }}
    >
      <sphereGeometry args={[radiusUnits * 0.999, 48, 24]} />
      {/* Invisible but still raycast-hittable. */}
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}

/** DOM readout for the current probe. Rendered by the engine outside the Canvas. */
export function EarthWeatherReadout({ probe, onClose }: { probe: ProbeState; onClose: () => void }) {
  const coord = `${Math.abs(probe.lat).toFixed(2)}°${probe.lat >= 0 ? "N" : "S"}, ${Math.abs(probe.lon).toFixed(2)}°${probe.lon >= 0 ? "E" : "W"}`
  return (
    <div className="absolute left-4 top-24 md:left-6 z-40 w-[min(15rem,calc(100vw-2rem))] rounded-xl border border-[#8ad0ff]/40 bg-black/80 backdrop-blur-md p-3 shadow-[0_16px_48px_-20px_rgba(0,0,0,0.7)]">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-[#8ad0ff]">Live weather · here</p>
        <button type="button" onClick={onClose} aria-label="Close"
          className="text-white/50 hover:text-white text-xs leading-none">✕</button>
      </div>
      <p className="mt-1 font-mono text-[10px] tabular-nums text-white/60">{coord}</p>
      {probe.kind === "loading" && (
        <p className="mt-2 text-[13px] text-white/70">Reading the weather…</p>
      )}
      {probe.kind === "done" && !probe.weather && (
        <p className="mt-2 text-[13px] text-white/70">No reading for that spot (ocean or feed offline).</p>
      )}
      {probe.kind === "done" && probe.weather && (
        <div className="mt-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] text-white/85">
              {weatherIcon(probe.weather.code)} {weatherLabel(probe.weather.code)}
            </p>
            <p className="font-display text-2xl tabular-nums text-white">{Math.round(probe.weather.tempC)}°</p>
          </div>
          <p className="mt-1 font-mono text-[10px] tabular-nums text-white/60">
            wind {Math.round(probe.weather.windKmh)} km/h
            {probe.weather.humidity != null && <> · {probe.weather.humidity}% RH</>}
            {probe.weather.aqi != null && <> · AQI {probe.weather.aqi}</>}
          </p>
        </div>
      )}
      <p className="mt-2 font-mono text-[8px] text-white/40">Open-Meteo · click the globe to move</p>
    </div>
  )
}
