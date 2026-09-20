"use client"

// Euler's identity, made obvious: e^{iπ} + 1 = 0.
//
// The mystery dissolves the moment you SEE what e^{iθ} means: it's a point on the
// unit circle at angle θ. Start at θ=0 (the point is at 1). Sweep θ round the
// circle. At θ=π — half a turn — the point sits exactly at −1. So e^{iπ} = −1,
// i.e. e^{iπ} + 1 = 0. No mysticism: it's a half-turn landing on the far side.
//
// Original implementation; the math is universal.

import { useCallback, useEffect, useRef, useState } from "react"

const TAU = Math.PI * 2

export function EulerViz() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [theta, setTheta] = useState(0)          // current angle (radians)
  const [running, setRunning] = useState(true)   // auto-sweeps on load
  const rafRef = useRef<number | null>(null)
  const thetaRef = useRef(0); thetaRef.current = theta
  const runRef = useRef(running); runRef.current = running
  const introRef = useRef(0)                     // cinematic slow-start ramp
  const holdRef = useRef(0)                      // 0→1 beat timer (holds)
  const phaseRef = useRef(0)                     // 0 hold@0 · 1 sweep→π · 2 hold@π · 3 finish

  const re = Math.cos(theta)
  const im = Math.sin(theta)

  const pause = useCallback(() => setRunning(false), [])
  const play = useCallback(() => setRunning(true), [])

  const fit = useCallback(() => {
    const cv = canvasRef.current
    if (!cv) return
    const dpr = Math.min(window.devicePixelRatio || 1, 3)
    const box = cv.getBoundingClientRect()
    cv.width = Math.round(box.width * dpr)
    cv.height = Math.round(box.height * dpr)
    cv.getContext("2d")!.setTransform(dpr, 0, 0, dpr, 0, 0)
  }, [])

  useEffect(() => { fit(); const r = () => fit(); window.addEventListener("resize", r); return () => window.removeEventListener("resize", r) }, [fit])

  // one rAF loop: advance θ (slow-start ramp) when running, and draw HD.
  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    const ctx = cv.getContext("2d")!

    const draw = () => {
      const box = cv.getBoundingClientRect()
      const W = box.width, H = box.height, cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.34

      // advance θ with a cinematic slow-start (eases from crawl to full sweep)
      // A DIRECTED SEQUENCE, not a bland loop (recreate the video's pacing so the
      // reveal lands): (1) hold at θ=0 — the bare circle + point at rest, the
      // setup; (2) a slow sweep, easing from a crawl; (3) HOLD at θ=π — the
      // point sitting on −1, the payoff — for a beat; (4) finish the loop and
      // pause again at 0. phaseRef counts the beats.
      if (runRef.current) {
        const ph = phaseRef.current
        if (ph === 0) {                 // opening hold at 0
          holdRef.current += 1 / (1.3 * 60)
          if (holdRef.current >= 1) { phaseRef.current = 1; introRef.current = 0 }
        } else if (ph === 1) {          // sweep 0 → π
          introRef.current = Math.min(1, introRef.current + 1 / (5 * 60))
          const e = introRef.current * introRef.current * (3 - 2 * introRef.current)
          let nt = thetaRef.current + (0.0015 + 0.011 * e)
          if (nt >= Math.PI) { nt = Math.PI; phaseRef.current = 2; holdRef.current = 0 }
          thetaRef.current = nt; setTheta(nt)
        } else if (ph === 2) {          // HOLD at π — the reveal
          holdRef.current += 1 / (2.2 * 60)
          if (holdRef.current >= 1) { phaseRef.current = 3 }
        } else {                        // sweep π → 2π, then reset the sequence
          let nt = thetaRef.current + 0.011
          if (nt >= TAU) { nt = 0; phaseRef.current = 0; holdRef.current = 0; introRef.current = 0 }
          thetaRef.current = nt; setTheta(nt)
        }
      }
      const th = thetaRef.current, cRe = Math.cos(th), cIm = Math.sin(th)

      // deep space background + vignette
      const bg = ctx.createRadialGradient(cx, cy, R * 0.4, cx, cy, Math.max(W, H) * 0.7)
      bg.addColorStop(0, "#080b16"); bg.addColorStop(1, "#03040a")
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)

      // axes — faint
      ctx.strokeStyle = "rgba(200,215,255,0.10)"; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(W * 0.08, cy); ctx.lineTo(W * 0.92, cy); ctx.moveTo(cx, H * 0.08); ctx.lineTo(cx, H * 0.92); ctx.stroke()
      ctx.fillStyle = "rgba(220,228,255,0.4)"; ctx.font = "12px ui-monospace, monospace"
      ctx.fillText("real", cx + R + 8, cy + 16)
      ctx.fillText("−1", cx - R - 26, cy + 16)
      ctx.fillText("i", cx + 8, cy - R - 6)

      // the unit circle — luminous
      ctx.strokeStyle = "rgba(124,156,255,0.6)"; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke()
      // swept arc so far — glowing accent
      ctx.strokeStyle = "rgba(255,205,90,0.95)"; ctx.lineWidth = 3; ctx.lineCap = "round"
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, -th, true); ctx.stroke()

      const px = cx + R * cRe, py = cy - R * cIm
      // radius + projections
      ctx.strokeStyle = "rgba(230,236,255,0.55)"; ctx.lineWidth = 1.2
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke()
      ctx.setLineDash([4, 4])
      ctx.strokeStyle = "rgba(90,225,150,0.55)"; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, cy); ctx.stroke()
      ctx.strokeStyle = "rgba(255,130,170,0.55)"; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(cx, py); ctx.stroke()
      ctx.setLineDash([])

      // the moving point — glowing bead
      const atP = Math.abs(th - Math.PI) < 0.05
      const g = ctx.createRadialGradient(px, py, 0, px, py, 16)
      g.addColorStop(0, atP ? "rgba(255,150,150,0.95)" : "rgba(255,235,170,0.9)")
      g.addColorStop(1, "rgba(255,210,90,0)")
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, 16, 0, TAU); ctx.fill()
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(px, py, 3, 0, TAU); ctx.fill()

      // vignette
      const vig = ctx.createRadialGradient(cx, cy, Math.min(W, H) * 0.3, cx, cy, Math.max(W, H) * 0.72)
      vig.addColorStop(0, "rgba(0,0,0,0)"); vig.addColorStop(1, "rgba(2,3,8,0.55)")
      ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H)

      rafRef.current = requestAnimationFrame(draw)
    }
    rafRef.current = requestAnimationFrame(draw)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])

  const atPi = Math.abs(theta - Math.PI) < 0.05
  const turns = (theta / TAU)
  const btn = "rounded-full px-3 py-1.5 font-mono text-[11px] tracking-wide backdrop-blur-md transition"

  return (
    <div ref={wrapRef} className="relative w-full h-full overflow-hidden bg-black">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* live readout — top left */}
      <div className="absolute top-4 left-4 z-10 font-mono text-[11px] text-white/60 leading-relaxed">
        <div>θ = <span className="text-amber-300">{theta.toFixed(3)}</span> rad
          <span className="text-white/40"> · {(theta * 180 / Math.PI).toFixed(0)}°</span></div>
        <div className="text-white/50">e<sup>iθ</sup> = <span className="text-emerald-300">{re.toFixed(3)}</span> + <span className="text-pink-300">{im.toFixed(3)}</span> i</div>
        {atPi && <div className="mt-1 text-red-300">θ = π → the point is on −1 · e<sup>iπ</sup> + 1 = 0</div>}
      </div>

      {/* controls — floating glass bar, bottom */}
      <div className="absolute bottom-0 inset-x-0 z-10 flex flex-wrap items-center justify-center gap-2 p-3 md:p-4 bg-gradient-to-t from-black/70 via-black/30 to-transparent">
        <button onClick={running ? pause : play} className={`${btn} bg-white/12 text-white border border-white/25`}>{running ? "Pause" : "Sweep θ"}</button>
        <button onClick={() => { thetaRef.current = Math.PI; setTheta(Math.PI); setRunning(false) }} className={`${btn} bg-black/30 text-white/70 border border-white/10 hover:text-white`}>Jump to π</button>
        <button onClick={() => { thetaRef.current = 0; setTheta(0); introRef.current = 0 }} className={`${btn} bg-black/30 text-white/60 border border-white/10 hover:text-white`}>Reset</button>
        <label className="flex items-center gap-2 font-mono text-[10px] text-white/55 px-2">
          scrub θ
          <input type="range" min={0} max={TAU} step={0.001} value={theta}
            onChange={(e) => { setRunning(false); const v = parseFloat(e.target.value); thetaRef.current = v; setTheta(v) }}
            className="w-32 md:w-48 accent-white" aria-label="angle theta" />
        </label>
      </div>
    </div>
  )
}
