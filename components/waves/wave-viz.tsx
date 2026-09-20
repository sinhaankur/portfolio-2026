"use client"

// Gerstner (trochoidal) waves, made visible — the real math behind the /waves
// ocean, animated in 2D so you can SEE why a sea looks the way it does.
//
// A sine wave just goes up and down. A real ocean doesn't: each water particle
// travels in a CIRCLE, so crests get sharp and troughs get broad. That's the
// Gerstner wave — it moves each point sideways as well as vertically:
//
//     x += Q·A·cos(k·x − ω·t)      (horizontal — the particle's circular orbit)
//     y  =    A·sin(k·x − ω·t)      (vertical  — the up/down)
//
//   k = 2π/L (wave number),  ω = √(gk) (deep-water dispersion — long waves run
//   faster),  Q = steepness. Sum several trains at different lengths/directions
//   and you get a real, living sea. This is the same math the GPU ocean runs
//   (components/ocean/ocean-mesh.tsx) — here in 2D, with the particle circles
//   drawn so the "why" is visible. Original implementation; the physics is universal.

import { useCallback, useEffect, useRef, useState } from "react"

const G = 9.81

type Train = { L: number; amp: number; dir: number } // wavelength(m), amplitude, direction(rad, for the sum)

export function WaveViz() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [mode, setMode] = useState<"single" | "sea">("single")
  const [steep, setSteep] = useState(0.7)      // Q — 0 = sine, 1 = sharp crests
  const [wind, setWind] = useState(1)          // scales amplitude + count
  const [running, setRunning] = useState(true)
  const [fs, setFs] = useState(false)
  const rafRef = useRef<number | null>(null)
  const tRef = useRef(0)
  const steepRef = useRef(steep); steepRef.current = steep
  const windRef = useRef(wind); windRef.current = wind
  const modeRef = useRef(mode); modeRef.current = mode
  const runRef = useRef(running); runRef.current = running

  const fit = useCallback(() => {
    const cv = canvasRef.current
    if (!cv) return
    const native = window.devicePixelRatio || 1
    const dpr = Math.min(document.fullscreenElement ? native * 1.5 : native, 4)
    const box = cv.getBoundingClientRect()
    cv.width = Math.round(box.width * dpr)
    cv.height = Math.round(box.height * dpr)
    cv.getContext("2d")!.setTransform(dpr, 0, 0, dpr, 0, 0)
  }, [])

  useEffect(() => {
    fit()
    const onR = () => fit(); window.addEventListener("resize", onR)
    const onFs = () => { setFs(!!document.fullscreenElement); setTimeout(fit, 60) }
    document.addEventListener("fullscreenchange", onFs)
    return () => { window.removeEventListener("resize", onR); document.removeEventListener("fullscreenchange", onFs) }
  }, [fit])

  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    const ctx = cv.getContext("2d")!

    // the wave trains for "sea" mode — a wind-driven spread of lengths/directions
    const seaTrains = (): Train[] => [
      { L: 320, amp: 26, dir: 0 },
      { L: 180, amp: 15, dir: 0.5 },
      { L: 95,  amp: 8,  dir: -0.6 },
      { L: 50,  amp: 4,  dir: 1.1 },
      { L: 28,  amp: 2,  dir: -1.3 },
    ]

    const draw = () => {
      const box = cv.getBoundingClientRect()
      const W = box.width, H = box.height
      const t = tRef.current
      const Q = steepRef.current
      const windAmp = 0.5 + windRef.current      // 0.5–2.5

      // sky→sea gradient background (cinematic, not flat black)
      const sky = ctx.createLinearGradient(0, 0, 0, H)
      sky.addColorStop(0, "#0a1830")
      sky.addColorStop(0.5, "#0b2a4a")
      sky.addColorStop(0.5, "#04101f")
      sky.addColorStop(1, "#010812")
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, W, H)

      const baseY = H * 0.55
      const trains = modeRef.current === "sea"
        ? seaTrains().slice(0, Math.max(2, Math.round(2 + windRef.current * 2)))
        : [{ L: Math.min(W * 0.5, 300), amp: H * 0.10, dir: 0 }]

      // sample the surface height + horizontal offset (Gerstner sum) at screen x
      const surf = (sx: number) => {
        let dx = 0, y = 0
        for (const tr of trains) {
          const k = (2 * Math.PI) / tr.L
          const omega = Math.sqrt(G * k) * 1.6            // dispersion: long waves faster
          const A = tr.amp * windAmp
          const phase = k * sx - omega * t
          y += A * Math.sin(phase)
          dx += Q * A * Math.cos(phase)                    // horizontal orbit → sharp crests
        }
        return { x: sx + dx, y: baseY - y }
      }

      // the water body — filled under the trochoidal surface
      ctx.beginPath()
      ctx.moveTo(0, H)
      for (let sx = -40; sx <= W + 40; sx += 3) { const p = surf(sx); ctx.lineTo(p.x, p.y) }
      ctx.lineTo(W, H); ctx.closePath()
      const water = ctx.createLinearGradient(0, baseY - 60, 0, H)
      water.addColorStop(0, "rgba(90,180,230,0.55)")
      water.addColorStop(0.3, "rgba(30,110,180,0.85)")
      water.addColorStop(1, "rgba(6,30,60,0.95)")
      ctx.fillStyle = water; ctx.fill()

      // crest line — bright, crisp (HD)
      ctx.beginPath()
      for (let sx = -40; sx <= W + 40; sx += 2) { const p = surf(sx); sx === -40 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y) }
      ctx.strokeStyle = "rgba(200,235,255,0.9)"; ctx.lineWidth = 1.6; ctx.lineCap = "round"; ctx.stroke()

      // foam glints on the steepest crests
      ctx.fillStyle = "rgba(255,255,255,0.8)"
      for (let sx = 0; sx <= W; sx += 6) {
        const p0 = surf(sx - 3), p1 = surf(sx + 3)
        const slope = Math.abs((p1.y - p0.y))
        if (slope > 7 * windAmp && Math.random() < 0.3) {
          ctx.beginPath(); ctx.arc(surf(sx).x, surf(sx).y, 1.1, 0, Math.PI * 2); ctx.fill()
        }
      }

      // SINGLE mode: draw the particle CIRCLES that make the wave trochoidal —
      // this is the teaching payoff (a marker orbiting a circle at each point)
      if (modeRef.current === "single") {
        const tr = trains[0]
        const k = (2 * Math.PI) / tr.L
        const omega = Math.sqrt(G * k) * 1.6
        const A = tr.amp * windAmp
        for (let sx = 40; sx < W; sx += tr.L / 4) {
          // the rest position (circle center) and the current particle position
          const cyC = baseY
          ctx.strokeStyle = "rgba(255,255,255,0.14)"; ctx.lineWidth = 1
          ctx.beginPath(); ctx.arc(sx, cyC, A * Math.max(0.15, Q), 0, Math.PI * 2); ctx.stroke()
          const phase = k * sx - omega * t
          const px = sx + Q * A * Math.cos(phase)
          const py = cyC - A * Math.sin(phase)
          ctx.fillStyle = "#ffd24d"
          ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill()
        }
      }

      if (runRef.current) tRef.current = t + 0.016
      rafRef.current = requestAnimationFrame(draw)
    }
    rafRef.current = requestAnimationFrame(draw)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])

  const toggleFs = useCallback(() => {
    const el = wrapRef.current; if (!el) return
    if (document.fullscreenElement) document.exitFullscreen?.()
    else el.requestFullscreen?.().catch(() => {})
  }, [])

  return (
    <div className="rounded-2xl border border-border bg-gradient-to-b from-[#0a0b12] to-[#05060a] p-4 md:p-6">
      <div ref={wrapRef} className={fs ? "relative bg-black flex flex-col h-full" : "relative"}>
        <canvas ref={canvasRef} className={fs ? "w-full flex-1 min-h-0" : "w-full aspect-[16/9] rounded-lg border border-border/40"} />
        <div className={`flex flex-wrap items-center gap-3 ${fs ? "p-4" : "mt-3"}`}>
          <div className="flex gap-2">
            {(["single", "sea"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)}
                className={`rounded-lg px-3 py-1.5 font-mono text-[12px] transition ${
                  mode === m ? "border border-accent bg-accent/15 text-accent" : "border border-border text-foreground/70 hover:border-accent/50"}`}>
                {m === "single" ? "One wave (see the circles)" : "A real sea (sum of trains)"}
              </button>
            ))}
          </div>
          <button onClick={() => setRunning((r) => !r)} className="rounded-lg border border-border px-3 py-1.5 font-mono text-[12px] text-foreground/70 hover:border-accent/50">{running ? "Pause" : "Play"}</button>
          <button onClick={toggleFs} className="rounded-lg border border-border px-3 py-1.5 font-mono text-[12px] text-foreground/70 hover:border-accent/50">{fs ? "Exit ⤢" : "Fullscreen ⛶"}</button>
          <label className="flex items-center gap-2 font-mono text-[11px] text-foreground/60">
            steepness
            <input type="range" min={0} max={1} step={0.02} value={steep} onChange={(e) => setSteep(parseFloat(e.target.value))} className="w-24 accent-[color:var(--color-accent,#cf9a2c)]" aria-label="steepness" />
            <span className="tabular-nums w-8">{steep.toFixed(2)}</span>
          </label>
          <label className="flex items-center gap-2 font-mono text-[11px] text-foreground/60">
            wind
            <input type="range" min={0} max={2} step={0.05} value={wind} onChange={(e) => setWind(parseFloat(e.target.value))} className="w-24 accent-[color:var(--color-accent,#cf9a2c)]" aria-label="wind" />
            <span className="tabular-nums w-8">{wind.toFixed(2)}</span>
          </label>
        </div>
      </div>
      {!fs && (
        <p className="mt-3 text-sm text-foreground/70 leading-relaxed">
          {mode === "single"
            ? <>Watch the <span className="text-[#ffd24d]">markers</span>: each water particle travels in a <em>circle</em>, not just up and down. That sideways motion (the Q·A·cos term) pinches the crests sharp and flattens the troughs — the difference between a bedsheet ripple and a real swell. Set steepness to 0 and it collapses to a plain sine.</>
            : <>A real sea is the <em>sum</em> of many wave trains at different wavelengths and directions — big slow swell plus short fast chop. Longer waves move faster (the √(gk) dispersion), so they slide through the short ones, and the interference never quite repeats. Push the wind up and watch it build.</>}
        </p>
      )}
    </div>
  )
}
