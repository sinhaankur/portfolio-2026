"use client"

// The Fourier series, made visible: ANY wave is a sum of spinning circles.
//
// A square wave looks nothing like a sine — yet it's built from pure sines added
// together. Draw each sine as a spinning circle (an "epicycle"), stack them
// tip-to-tip, and the final tip traces the wave. More circles → sharper corners.
// It never becomes a *perfect* square with finitely many (the wiggle at the
// jump, "Gibbs phenomenon", never fully vanishes) — another "infinite process"
// that only ever approaches its target, like π.
//
// Square wave = (4/π)·Σ sin((2k−1)x)/(2k−1) over odd harmonics. Original
// implementation; the math is universal.

import { useCallback, useEffect, useRef, useState } from "react"

const TAU = Math.PI * 2

export function FourierViz() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [terms, setTerms] = useState(4)          // number of circles (odd harmonics)
  const [running, setRunning] = useState(true)
  const [fs, setFs] = useState(false)
  const rafRef = useRef<number | null>(null)
  const tRef = useRef(0)
  const wave = useRef<number[]>([])              // the traced-wave history buffer
  const termsRef = useRef(terms); termsRef.current = terms
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

    const draw = () => {
      const box = cv.getBoundingClientRect()
      const W = box.width, H = box.height
      ctx.clearRect(0, 0, W, H)
      // deep background
      ctx.fillStyle = "#05060a"; ctx.fillRect(0, 0, W, H)

      const t = tRef.current
      const n = termsRef.current
      // epicycle cluster sits on the left; the wave scrolls to the right
      const originX = W * 0.28, originY = H * 0.5
      const scale = Math.min(W, H) * 0.20

      // sum the odd-harmonic sines as chained spinning circles
      let x = originX, y = originY
      ctx.lineCap = "round"
      for (let k = 0; k < n; k++) {
        const harm = 2 * k + 1                     // 1, 3, 5, 7 … (odd only)
        const radius = (scale * 4 / Math.PI) / harm
        const prevX = x, prevY = y
        x += radius * Math.cos(harm * t)
        y += radius * Math.sin(harm * t)
        // the circle
        ctx.strokeStyle = "rgba(124,156,255,0.28)"; ctx.lineWidth = 1
        ctx.beginPath(); ctx.arc(prevX, prevY, radius, 0, TAU); ctx.stroke()
        // the radius arm
        ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(prevX, prevY); ctx.lineTo(x, y); ctx.stroke()
      }

      // record the current tip height into the wave buffer (newest at front)
      if (runRef.current) wave.current.unshift(y)
      const maxLen = Math.floor(W * 0.62)
      if (wave.current.length > maxLen) wave.current.length = maxLen

      // connector from the tip to where the wave begins
      const waveX0 = W * 0.40
      ctx.strokeStyle = "rgba(255,210,90,0.4)"; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(waveX0, wave.current[0] ?? y); ctx.stroke()

      // the traced wave, scrolling right — bright, HD
      ctx.strokeStyle = "rgba(255,225,120,0.95)"; ctx.lineWidth = 1.8
      ctx.beginPath()
      for (let i = 0; i < wave.current.length; i++) {
        const wx = waveX0 + i, wy = wave.current[i]
        i === 0 ? ctx.moveTo(wx, wy) : ctx.lineTo(wx, wy)
      }
      ctx.stroke()

      // the leading tip bead
      ctx.fillStyle = "#ffe14d"
      ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.fill()

      if (runRef.current) tRef.current = t + 0.02
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

  const reset = useCallback(() => { wave.current = []; tRef.current = 0 }, [])

  return (
    <div className="rounded-2xl border border-border bg-gradient-to-b from-[#0a0b12] to-[#05060a] p-4 md:p-6">
      <div ref={wrapRef} className={fs ? "relative bg-black flex flex-col h-full" : "relative"}>
        <canvas ref={canvasRef} className={fs ? "w-full flex-1 min-h-0" : "w-full aspect-[16/9] rounded-lg border border-border/40 bg-black"} />
        <div className={`flex flex-wrap items-center gap-3 ${fs ? "p-4" : "mt-3"}`}>
          <button onClick={() => setRunning((r) => !r)} className="rounded-lg border border-accent bg-accent/10 px-3 py-1.5 font-mono text-[12px] text-accent">{running ? "Pause" : "Play"}</button>
          <button onClick={() => { reset() }} className="rounded-lg border border-border px-3 py-1.5 font-mono text-[12px] text-foreground/60 hover:border-accent/50">Reset</button>
          <button onClick={toggleFs} className="rounded-lg border border-border px-3 py-1.5 font-mono text-[12px] text-foreground/70 hover:border-accent/50">{fs ? "Exit ⤢" : "Fullscreen ⛶"}</button>
          <label className="flex items-center gap-2 font-mono text-[11px] text-foreground/60">
            circles
            <input type="range" min={1} max={40} step={1} value={terms} onChange={(e) => setTerms(parseInt(e.target.value))} className="w-32 accent-[color:var(--color-accent,#cf9a2c)]" aria-label="number of circles" />
            <span className="tabular-nums w-8">{terms}</span>
          </label>
        </div>
      </div>
      {!fs && (
        <p className="mt-3 text-sm text-foreground/70 leading-relaxed">
          Each <span className="text-[#7c9cff]">circle</span> is one pure sine wave,
          spinning at an odd multiple of the base frequency (1×, 3×, 5×, …), each a
          little smaller. Stacked tip-to-tip, their combined tip traces the
          <span className="text-[#ffe178]"> wave</span> on the right. With one circle
          it&apos;s a plain sine; add more and the corners sharpen toward a square.
          Slide the count up — and notice the little overshoot at each jump never
          fully disappears (that&apos;s the <em>Gibbs phenomenon</em>): even here, a
          perfect square is an infinite sum you only ever approach — the same
          &ldquo;never quite arrives&rdquo; you saw with{" "}
          <span className="italic">π</span>.
        </p>
      )}
    </div>
  )
}
