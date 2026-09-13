"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import {
  observerRef,
  scanOverheadSky,
  type OverheadSat,
} from "@/components/universe-engine/satellite-data"
import { selectedSatRef } from "@/components/universe-engine/satellite-refs"

/**
 * SkyDome — "look up from where you're standing."
 *
 * A local-sky planetarium: the horizon is the outer circle, the zenith (straight
 * up) is the centre, N/E/S/W around the rim. Every satellite currently above your
 * horizon is plotted at its REAL azimuth + elevation (topocentric look-angles
 * straight from SGP4 — see scanOverheadSky), updating live. Standing on Earth,
 * looking up, made literal: seeing is believing.
 *
 * Keyless + on-device: your location never leaves the browser (it only feeds the
 * in-page SGP4 math); the catalogue is already loaded by the 3D field. No account,
 * no server call — that's why it can be free for anyone.
 *
 * Colour = family (Starlink / navigation / stations / debris / other), matched to
 * the swarm's palette so the dome and the 3D scene tell the same story. Tap a dot
 * to select it in the engine.
 */

// Family palette — mirrors the swarm's group colours so the two views agree.
function famColor(s: OverheadSat): string {
  const g = (s.group || "").toLowerCase()
  const n = s.name.toUpperCase()
  if (s.type === "DEB" || g.includes("debris") || g.includes("analyst")) return "#9aa0aa"
  if (s.type === "R/B" || n.includes("R/B") || n.includes("ROCKET")) return "#c98b5a"
  if (n.startsWith("STARLINK")) return "#4ea3ff"
  if (n.startsWith("ONEWEB")) return "#7c5cff"
  if (n.includes("GPS") || n.includes("GLONASS") || n.includes("GALILEO") || n.includes("BEIDOU") || n.includes("NAVSTAR")) return "#ffd24d"
  if (n.includes("ISS") || n.includes("ZARYA") || n.includes("CSS") || n.includes("TIANHE")) return "#ff6f6f"
  return "#c7ccd6"
}

// Az/el → x,y on a unit dome (radius 1). Zenith (el 90) at centre, horizon (el 0)
// at the rim. Azimuth measured from north, clockwise (N up, E right) — the way you
// actually orient looking up with a map, so it reads intuitively.
function project(azDeg: number, elDeg: number): { x: number; y: number } {
  const rr = 1 - Math.max(0, Math.min(90, elDeg)) / 90 // 0 at zenith → 1 at horizon
  const a = ((azDeg - 90) * Math.PI) / 180 // rotate so 0°=N points up
  return { x: rr * Math.cos(a), y: rr * Math.sin(a) }
}

export function SkyDome({ onClose }: { onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [geo, setGeo] = useState<"idle" | "prompt" | "on" | "off">(
    observerRef.current ? "on" : "idle",
  )
  const [count, setCount] = useState(0)
  const [minEl, setMinEl] = useState(10) // hide horizon-huggers by default
  const [hover, setHover] = useState<OverheadSat | null>(null)
  const satsRef = useRef<OverheadSat[]>([])
  const dprRef = useRef(1)
  // dot screen positions cached each draw so hover/tap hit-testing is cheap.
  const dotsRef = useRef<{ x: number; y: number; s: OverheadSat }[]>([])

  const requestLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) { setGeo("off"); return }
    setGeo("prompt")
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, altitude } = pos.coords
        observerRef.current = {
          latitude: (latitude * Math.PI) / 180,
          longitude: (longitude * Math.PI) / 180,
          height: (altitude ?? 0) / 1000,
        }
        setGeo("on")
      },
      () => setGeo("off"),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 },
    )
  }, [])

  // If the site already has permission (the search card / ISS panel may have used
  // it), light up straight away — no second prompt.
  useEffect(() => {
    if (observerRef.current) { setGeo("on"); return }
    if (typeof navigator === "undefined" || !navigator.permissions?.query) return
    navigator.permissions.query({ name: "geolocation" }).then((p) => {
      if (p.state === "granted") requestLocation()
    }).catch(() => { /* user can tap the button */ })
  }, [requestLocation])

  // Live scan — re-propagate the whole catalogue every 2s while the dome is open.
  useEffect(() => {
    if (geo !== "on") return
    let alive = true
    const run = () => {
      if (!alive) return
      const list = scanOverheadSky(Date.now(), minEl)
      satsRef.current = list
      setCount(list.length)
    }
    run()
    const id = setInterval(run, 2000)
    return () => { alive = false; clearInterval(id) }
  }, [geo, minEl])

  // Draw loop — the dome, the compass rose, the elevation rings, and every dot.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    let raf = 0

    const resize = () => {
      const parent = canvas.parentElement
      if (!parent) return
      const size = Math.min(parent.clientWidth, parent.clientHeight)
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      dprRef.current = dpr
      canvas.width = size * dpr
      canvas.height = size * dpr
      canvas.style.width = `${size}px`
      canvas.style.height = `${size}px`
    }
    resize()
    window.addEventListener("resize", resize)

    const draw = () => {
      const dpr = dprRef.current
      const W = canvas.width
      const cx = W / 2
      const cy = W / 2
      const R = W / 2 - 18 * dpr
      ctx.clearRect(0, 0, W, W)

      // Dome fill — a faint radial so the centre (overhead) glows slightly.
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R)
      bg.addColorStop(0, "rgba(30,40,64,0.55)")
      bg.addColorStop(1, "rgba(6,8,14,0.15)")
      ctx.fillStyle = bg
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill()

      // Elevation rings (horizon, 30°, 60°) + zenith mark.
      ctx.strokeStyle = "rgba(255,255,255,0.14)"
      ctx.lineWidth = 1 * dpr
      for (const el of [0, 30, 60]) {
        const rr = (1 - el / 90) * R
        ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke()
      }
      // cardinal cross-hair
      ctx.beginPath()
      ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy)
      ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R)
      ctx.stroke()

      // Cardinal labels — N up, E right, S down, W left.
      ctx.fillStyle = "rgba(255,255,255,0.6)"
      ctx.font = `${11 * dpr}px "JetBrains Mono", monospace`
      ctx.textAlign = "center"; ctx.textBaseline = "middle"
      ctx.fillText("N", cx, cy - R - 9 * dpr)
      ctx.fillText("S", cx, cy + R + 9 * dpr)
      ctx.fillText("E", cx + R + 9 * dpr, cy)
      ctx.fillText("W", cx - R - 9 * dpr, cy)

      // Plot dots.
      dotsRef.current = []
      for (const s of satsRef.current) {
        const p = project(s.azimuthDeg, s.elevationDeg)
        const x = cx + p.x * R
        const y = cy + p.y * R
        dotsRef.current.push({ x, y, s })
        // higher in the sky = bigger + brighter (closer, more overhead)
        const t = Math.max(0, Math.min(1, s.elevationDeg / 90))
        const rad = (1.4 + t * 2.6) * dpr
        const col = famColor(s)
        ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2)
        ctx.fillStyle = col
        ctx.globalAlpha = 0.55 + t * 0.45
        ctx.fill()
        ctx.globalAlpha = 1
      }

      // Hover ring + label
      if (hover) {
        const hit = dotsRef.current.find((d) => d.s.id === hover.id)
        if (hit) {
          ctx.strokeStyle = "rgba(255,255,255,0.9)"
          ctx.lineWidth = 1.5 * dpr
          ctx.beginPath(); ctx.arc(hit.x, hit.y, 8 * dpr, 0, Math.PI * 2); ctx.stroke()
        }
      }

      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize) }
  }, [hover])

  const hitTest = useCallback((clientX: number, clientY: number): OverheadSat | null => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const dpr = dprRef.current
    const x = (clientX - rect.left) * dpr
    const y = (clientY - rect.top) * dpr
    let best: { d: number; s: OverheadSat } | null = null
    for (const dot of dotsRef.current) {
      const dx = dot.x - x, dy = dot.y - y
      const d = dx * dx + dy * dy
      const rad = 12 * dpr
      if (d <= rad * rad && (!best || d < best.d)) best = { d, s: dot.s }
    }
    return best?.s ?? null
  }, [])

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" role="dialog" aria-label="Sky above you">
      <div className="relative w-full max-w-lg rounded-3xl border border-white/12 bg-[#0a0c14]/95 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-white/45">Look up</div>
            <h2 className="mt-0.5 text-lg font-semibold text-white">The sky above you</h2>
            <p className="mt-1 text-[12px] leading-snug text-white/55">
              Every tracked object over your horizon, right now — plotted where it really is.
              Your location stays on your device.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-cursor-hover
            aria-label="Close"
            className="rounded-full border border-white/15 px-2.5 py-1 font-mono text-[11px] text-white/70 hover:bg-white/10"
          >
            ✕
          </button>
        </div>

        {geo !== "on" ? (
          <div className="mt-6 flex flex-col items-center gap-3 py-10 text-center">
            <p className="max-w-xs text-[13px] text-white/60">
              {geo === "off"
                ? "Location unavailable — the sky dome needs your position to know which satellites are overhead."
                : "Share your location to see the real satellites crossing your sky right now."}
            </p>
            <button
              type="button"
              onClick={requestLocation}
              data-cursor-hover
              className="rounded-full bg-white px-5 py-2 text-[13px] font-semibold text-black hover:bg-white/90"
            >
              {geo === "prompt" ? "Waiting…" : geo === "off" ? "Try again" : "Show my sky"}
            </button>
          </div>
        ) : (
          <>
            <div
              className="relative mx-auto mt-4 aspect-square w-full max-w-sm"
              onPointerMove={(e) => setHover(hitTest(e.clientX, e.clientY))}
              onPointerLeave={() => setHover(null)}
              onClick={(e) => {
                const s = hitTest(e.clientX, e.clientY)
                if (s && s.id >= 0) {
                  selectedSatRef.current = s.id
                  window.dispatchEvent(new Event("celestial:sat-selected"))
                }
              }}
            >
              <canvas ref={canvasRef} data-cursor-hover className="cursor-crosshair" />
            </div>

            {/* Live readout + horizon-cutoff control */}
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="font-mono text-[11px] text-white/60">
                <span className="text-white">{count}</span> overhead
                {hover && (
                  <span className="ml-2 text-white/80">
                    · {hover.name} <span className="text-white/45">{hover.elevationDeg.toFixed(0)}° up</span>
                  </span>
                )}
              </div>
              <label className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-white/45">
                Above
                <select
                  value={minEl}
                  onChange={(e) => setMinEl(Number(e.target.value))}
                  className="rounded-md border border-white/15 bg-white/5 px-1.5 py-0.5 text-white/80"
                >
                  <option value={0}>Horizon</option>
                  <option value={10}>10°</option>
                  <option value={30}>30°</option>
                  <option value={60}>60°</option>
                </select>
              </label>
            </div>
            <p className="mt-2 text-center font-mono text-[9px] uppercase tracking-widest text-white/30">
              Zenith at centre · horizon at rim · tap a dot to track it
            </p>
          </>
        )}
      </div>
    </div>
  )
}
