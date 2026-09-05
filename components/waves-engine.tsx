"use client"

/**
 * WavesEngine — the ocean sibling of the Universe Engine.
 *
 * Real footage of the sea (8K-ready: drops in whatever file sits at
 * /video/wave.mp4) plays as the water. Over it, a REAL astronomical sky:
 * the sun rising/setting at its true azimuth, a day→night gradient driven by
 * the sun's real altitude, and the moon with its correct phase, illuminated
 * fraction, and position — computed on-device from lib/sea-astronomy (no
 * dependency, no key). Wave-breaking sound is opt-in (browsers block autoplay
 * audio; a tap unmutes — same discipline as the galaxy music chip).
 *
 * It's an EXPLORATION: a "time" scrubber runs the sky forward across a day so
 * you can watch how the sun and moon move, and a panel explains the four
 * forces that actually change waves — the Moon (tides), the Sun, Wind, and
 * Climate. Reverence over spectacle; real over invented.
 */

import { useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import {
  sunPosition,
  moonPhase,
  tideIndicator,
  dayPhase,
  type DayPhase,
} from "@/lib/sea-astronomy"
import { seaState, type Wind } from "@/components/ocean/wind"

// The procedural ocean is heavy (R3F) — lazy-load it so the page paints first.
const OceanScene = dynamic(() => import("@/components/ocean/ocean-scene").then((m) => m.OceanScene), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-gradient-to-b from-[#0a1a2f] to-[#02040a]" />,
})

// Default vantage: a coastline. Ankur can point it anywhere; the sky is
// computed for this lat/lng. (Bay of Bengal coast near the family's east.)
const LAT = 21.63
const LNG = 87.51

// Sky gradients per day-phase — top color, horizon color.
const SKY: Record<DayPhase, [string, string]> = {
  night: ["#05070f", "#0b1330"],
  astronomical: ["#070a18", "#132145"],
  nautical: ["#0d1533", "#243a6b"],
  civil: ["#243a6b", "#7a6a9c"],
  golden: ["#5b6bb0", "#e7a05a"],
  day: ["#7db6e8", "#cfe4f2"],
}

function fmtClock(h: number) {
  const hh = Math.floor(h) % 24
  const mm = Math.floor((h - Math.floor(h)) * 60)
  const ap = hh < 12 ? "AM" : "PM"
  const h12 = hh % 12 === 0 ? 12 : hh % 12
  return `${h12}:${String(mm).padStart(2, "0")} ${ap}`
}

export function WavesEngine() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [muted, setMuted] = useState(true)
  const [videoFailed, setVideoFailed] = useState(false)
  const [live, setLive] = useState(true) // true = real now; false = scrubbed
  // Hour-of-day offset (0..24) used when scrubbing.
  const [hour, setHour] = useState(12)
  const [showInfo, setShowInfo] = useState(true)
  // Mode: real footage sea, or our own procedural ocean engine (8K-native).
  const [mode, setMode] = useState<"real" | "engine">("real")
  // Wind — the force that makes the waves. Drives the procedural ocean.
  const [wind, setWind] = useState<Wind>({ dirDeg: 210, speed: 7, fetchKm: 200 })

  // Client-only clock. `new Date()` differs between the server render and the
  // client hydration, so computing sky text from it during SSR throws React
  // #418 (text mismatch). We render a stable placeholder date on the server and
  // switch to the real now only after mount. This also drives the live tick.
  const [nowTick, setNowTick] = useState<number | null>(null)
  useEffect(() => {
    setNowTick(Date.now())
    if (!live) return
    const id = setInterval(() => setNowTick(Date.now()), 30000)
    return () => clearInterval(id)
  }, [live])
  const mounted = nowTick !== null

  // The date we compute the sky for: real now, or today at the scrubbed hour.
  // Before mount (SSR + first paint) use a fixed epoch so server and client agree.
  const when = useMemo(() => {
    const base = mounted ? new Date(nowTick) : new Date(0)
    if (live) return base
    const d = new Date(base)
    d.setHours(Math.floor(hour), Math.floor((hour % 1) * 60), 0, 0)
    return d
  }, [live, hour, mounted, nowTick])

  const sun = useMemo(() => sunPosition(when, LAT, LNG), [when])
  const phase = useMemo(() => moonPhase(when), [when])
  const tide = useMemo(() => tideIndicator(when), [when])
  const phaseBand = dayPhase(sun.altitude)
  const [skyTop, skyHorizon] = SKY[phaseBand]

  const localHour = live ? when.getHours() + when.getMinutes() / 60 : hour

  // The real footage already contains the real sun/moon/sky; we no longer paint
  // synthetic ones over it. We keep the sun altitude only for the data readout.
  const sunVisible = sun.altitude > -2

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-black">
      {/* ENGINE MODE — our own procedural ocean (real sky + Gerstner sea, 8K-native) */}
      {mode === "engine" && (
        <div className="absolute inset-0">
          <OceanScene when={when} lat={LAT} lng={LNG} wind={wind} />
        </div>
      )}

      {/* REAL MODE — the actual footage, FULL-SCREEN. It already has the real
          sky, real sun-glitter, real rocks and pebble shore, real horizon; we
          show it edge-to-edge and never paint a fake sky over it. The only
          overlay is an optional, subtle day/night colour wash when the
          day-scrubber is used, so dawn/dusk/night read differently — kept light
          so the real footage always dominates. */}
      {mode === "real" && (<>
        <div className="absolute inset-0">
          {videoFailed ? (
            <div className="h-full w-full bg-gradient-to-b from-[#9fb0bd] via-[#6b7f88] to-[#123]" />
          ) : (
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              src="/video/wave-hq.mp4"
              poster="/video/wave-poster.jpg"
              autoPlay
              muted={muted}
              loop
              playsInline
              preload="metadata"
              onError={() => setVideoFailed(true)}
            />
          )}

          {/* Optional day/night colour grade — only when scrubbed away from the
              real 'now/day' look. Real footage is daytime, so at 'day' we do
              nothing; toward dusk/night we wash it cooler + darker. */}
          {!live && phaseBand !== "day" && (
            <div
              className="pointer-events-none absolute inset-0 transition-opacity duration-1000"
              style={{
                background:
                  phaseBand === "night"
                    ? "linear-gradient(to bottom, #04060f 0%, #0a1020 60%, #06101c 100%)"
                    : `linear-gradient(to bottom, ${skyTop} 0%, ${skyHorizon} 70%, rgba(0,0,0,0.2) 100%)`,
                mixBlendMode: "multiply",
                opacity: phaseBand === "night" ? 0.7 : phaseBand === "golden" ? 0.35 : 0.5,
              }}
            />
          )}
          {/* Warm golden-hour light add, subtle */}
          {!live && phaseBand === "golden" && (
            <div
              className="pointer-events-none absolute inset-0"
              style={{ background: "radial-gradient(120% 80% at 50% 30%, rgba(255,180,90,0.22), transparent 60%)" }}
            />
          )}
          {/* Stars only when scrubbed to real night */}
          {!live && phaseBand === "night" && (
            <Stars opacity={0.8} />
          )}
        </div>
      </>)}

      {/* Top-right controls: mode toggle + (real-mode) sound */}
      <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
        <div className="flex overflow-hidden rounded-full border border-white/20 bg-black/30 backdrop-blur">
          {(["real", "engine"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] transition ${mode === m ? "bg-white text-black" : "text-white/75"}`}
            >
              {m === "real" ? "🎞 real" : "🌊 engine"}
            </button>
          ))}
        </div>
        {mode === "real" && (
          <button
            onClick={() => {
              setMuted((m) => !m)
              const v = videoRef.current
              if (v) { v.muted = !v.muted; v.play().catch(() => {}) }
            }}
            className="rounded-full border border-white/20 bg-black/30 px-4 py-2 font-mono text-xs uppercase tracking-[0.2em] text-white/85 backdrop-blur"
          >
            {muted ? "🔇 sound" : "🔊 on"}
          </button>
        )}
      </div>

      {/* Time readout + scrubber */}
      <div className="absolute inset-x-0 bottom-0 z-20 p-4 md:p-6">
        <div className="mx-auto max-w-3xl rounded-2xl border border-white/15 bg-black/35 p-4 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="font-mono text-white/90">
              <span className="text-lg tabular-nums">{fmtClock(localHour)}</span>{" "}
              <span className="text-xs text-white/50 uppercase tracking-widest">· {phaseBand}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-white/70">
              <span>{sunVisible ? `☀︎ ${sun.altitude.toFixed(0)}°` : "☀︎ below"}</span>
              <span>·</span>
              <span title={phase.name}>{moonGlyph(phase.phase)} {phase.name}</span>
            </div>
          </div>

          {/* Scrub the day to watch the sun + moon move */}
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={() => setLive((l) => !l)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${live ? "bg-white/15 text-white" : "bg-white text-black"}`}
            >
              {live ? "● live" : "scrub"}
            </button>
            <input
              type="range" min={0} max={24} step={0.25} value={hour}
              onChange={(e) => { setLive(false); setHour(parseFloat(e.target.value)) }}
              className="w-full accent-white"
              aria-label="Time of day"
            />
          </div>

          {/* Wind controls — engine mode: the force that makes the waves */}
          {mode === "engine" && (
            <div className="mt-3 border-t border-white/10 pt-3">
              <div className="flex items-center justify-between text-xs text-white/70">
                <span className="font-mono uppercase tracking-widest">💨 wind</span>
                <span className="text-white/90">{seaState(wind.speed)} · {wind.speed.toFixed(0)} m/s</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <label className="text-[11px] text-white/60">speed
                  <input type="range" min={0} max={20} step={0.5} value={wind.speed}
                    onChange={(e) => setWind((w) => ({ ...w, speed: parseFloat(e.target.value) }))}
                    className="mt-0.5 w-full accent-sky-400" />
                </label>
                <label className="text-[11px] text-white/60">fetch (km)
                  <input type="range" min={5} max={800} step={5} value={wind.fetchKm}
                    onChange={(e) => setWind((w) => ({ ...w, fetchKm: parseFloat(e.target.value) }))}
                    className="mt-0.5 w-full accent-sky-400" />
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* The exploration panel — the four forces that change waves */}
      {showInfo && (
        <div className="absolute left-4 top-16 z-20 max-w-xs rounded-2xl border border-white/15 bg-black/35 p-4 text-white/85 backdrop-blur md:left-6">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/60">What changes the waves</p>
            <button onClick={() => setShowInfo(false)} className="text-white/50">×</button>
          </div>
          <ul className="mt-3 space-y-2.5 text-[13px] leading-relaxed">
            <li>
              <b>🌙 Moon — tides.</b> The Moon&rsquo;s pull raises the tide.{" "}
              {tide.note} Right now: <b>{tide.kind}</b>, {phase.name.toLowerCase()} ({(phase.illumination * 100).toFixed(0)}% lit).
            </li>
            <li>
              <b>☀︎ Sun.</b> Adds to (or cancels) the Moon&rsquo;s tidal pull, and
              sets the light — {phaseBand} now, sun at {sun.altitude.toFixed(0)}°.
              Aligned Sun+Moon = the biggest tides.
            </li>
            <li>
              <b>💨 Wind.</b> Wind is what actually makes the waves — longer,
              stronger, steadier wind (fetch + duration) builds bigger swell.
              The break you see is that wind energy meeting the shore.
            </li>
            <li>
              <b>🌍 Climate.</b> Over seasons and years, storm tracks, sea
              temperature, and sea-level shift the whole regime — calmer or
              wilder, higher or lower water. Log it, and the pattern emerges.
            </li>
          </ul>
          <p className="mt-3 text-[11px] text-white/45">
            Sky is real — sun &amp; moon computed on-device for this coast. The sea is real footage.
          </p>
        </div>
      )}
      {!showInfo && (
        <button
          onClick={() => setShowInfo(true)}
          className="absolute left-4 top-16 z-20 rounded-full border border-white/20 bg-black/30 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-white/80 backdrop-blur md:left-6"
        >
          ⓘ forces
        </button>
      )}
    </div>
  )
}

/* ── Sub-components ────────────────────────────────────────────────────────── */

function moonGlyph(phase: number): string {
  const glyphs = ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"]
  return glyphs[Math.round(phase * 8) % 8]
}

function Stars({ opacity }: { opacity: number }) {
  const stars = useMemo(
    () =>
      Array.from({ length: 120 }, () => ({
        x: Math.random() * 100,
        y: Math.random() * 55,
        r: Math.random() * 1.3 + 0.3,
        o: Math.random() * 0.6 + 0.4,
      })),
    [],
  )
  if (opacity <= 0) return null
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" style={{ opacity }}>
      {stars.map((s, i) => (
        <circle key={i} cx={`${s.x}%`} cy={`${s.y}%`} r={s.r} fill="#fff" opacity={s.o} />
      ))}
    </svg>
  )
}
