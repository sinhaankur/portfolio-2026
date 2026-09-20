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
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [theta, setTheta] = useState(0)          // current angle (radians)
  const [running, setRunning] = useState(false)
  const rafRef = useRef<number | null>(null)

  // e^{iθ} = cos θ + i·sin θ  → the point (cos θ, sin θ)
  const re = Math.cos(theta)
  const im = Math.sin(theta)

  const play = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    setRunning(true)
    const step = () => {
      setTheta((t) => {
        const nt = t + 0.012
        if (nt >= TAU) { setRunning(false); return 0 }
        rafRef.current = requestAnimationFrame(step)
        return nt
      })
    }
    rafRef.current = requestAnimationFrame(step)
  }, [])

  const pause = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    setRunning(false)
  }, [])

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }, [])

  // draw the complex plane, unit circle, swept arc, the point, and its projections
  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    const ctx = cv.getContext("2d")!
    const W = cv.width, H = cv.height, cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.36
    ctx.clearRect(0, 0, W, H)

    // axes
    ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(20, cy); ctx.lineTo(W - 20, cy); ctx.moveTo(cx, 20); ctx.lineTo(cx, H - 20); ctx.stroke()
    ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.font = "11px monospace"
    ctx.fillText("real", W - 44, cy - 6)
    ctx.fillText("imaginary", cx + 6, 26)
    // the landmark points 1 and −1
    ctx.fillStyle = "rgba(255,255,255,0.5)"
    ctx.fillText("1", cx + R + 4, cy + 14)
    ctx.fillText("−1", cx - R - 20, cy + 14)

    // the unit circle
    ctx.strokeStyle = "rgba(124,156,255,0.55)"; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke()

    // the swept arc from 0 to θ (how far around we've gone)
    ctx.strokeStyle = "rgba(255,180,80,0.9)"; ctx.lineWidth = 3
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, -theta, true); ctx.stroke()  // canvas y is down → negate

    const px = cx + R * re, py = cy - R * im  // screen coords (y flipped)

    // radius to the point + its projections onto the axes
    ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke()
    ctx.setLineDash([3, 3]); ctx.strokeStyle = "rgba(80,220,140,0.6)"
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, cy); ctx.stroke()  // → real axis (cos)
    ctx.strokeStyle = "rgba(255,120,160,0.6)"
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(cx, py); ctx.stroke()  // → imag axis (sin)
    ctx.setLineDash([])

    // the moving point
    ctx.fillStyle = "#ffd24d"
    ctx.beginPath(); ctx.arc(px, py, 5, 0, TAU); ctx.fill()

    // highlight when we're at π (landed on −1)
    if (Math.abs(theta - Math.PI) < 0.03) {
      ctx.strokeStyle = "#ff6a6a"; ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(px, py, 11, 0, TAU); ctx.stroke()
    }
  }, [theta, re, im])

  const atPi = Math.abs(theta - Math.PI) < 0.05
  const turns = (theta / TAU)

  return (
    <div className="rounded-2xl border border-border bg-gradient-to-b from-[#0a0b12] to-[#05060a] p-4 md:p-6">
      <div className="grid gap-5 md:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <div>
          <canvas ref={canvasRef} width={340} height={340} className="w-full max-w-[340px] rounded-lg border border-border/40 bg-black" />
          <div className="mt-3 flex items-center gap-3">
            <button onClick={running ? pause : play} className="rounded-lg border border-accent bg-accent/10 px-3 py-1.5 font-mono text-[12px] text-accent">
              {running ? "Pause" : "Sweep θ"}
            </button>
            <button onClick={() => setTheta(Math.PI)} className="rounded-lg border border-border px-3 py-1.5 font-mono text-[12px] text-foreground/70 hover:border-accent/50">Jump to θ = π</button>
            <button onClick={() => { pause(); setTheta(0) }} className="rounded-lg border border-border px-3 py-1.5 font-mono text-[12px] text-foreground/60">Reset</button>
          </div>
          {/* manual scrub */}
          <input
            type="range" min={0} max={TAU} step={0.001} value={theta}
            onChange={(e) => { pause(); setTheta(parseFloat(e.target.value)) }}
            className="mt-3 w-full max-w-[340px] accent-[color:var(--color-accent,#cf9a2c)]"
            aria-label="angle theta"
          />
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-foreground/40 mb-2">
            e^{"{iθ}"} = cos θ + i·sin θ  —  a point on the unit circle
          </p>
          <div className="font-mono text-sm space-y-1">
            <div>θ = <span className="text-accent">{theta.toFixed(3)}</span> rad
              <span className="text-foreground/40"> ({(turns).toFixed(3)} turns · {(theta * 180 / Math.PI).toFixed(0)}°)</span></div>
            <div>e^{"{iθ}"} = <span className="text-emerald-400">{re.toFixed(3)}</span> + <span className="text-pink-400">{im.toFixed(3)}</span>·i</div>
          </div>
          <p className="mt-4 text-sm text-foreground/75 leading-relaxed">
            Raising e to an <em>imaginary</em> power sounds impossible — until you see
            what it does: <span className="font-serif italic">e^{"{iθ}"}</span> is just
            a point on the unit circle at angle θ. Its shadow on the
            <span className="text-emerald-400"> real</span> axis is cos θ; on the
            <span className="text-pink-400"> imaginary</span> axis, sin θ. Sweeping θ
            walks the point around the circle at unit speed.
          </p>
          <p className={`mt-3 rounded-lg border px-3.5 py-2.5 text-[13px] leading-relaxed transition-colors ${
            atPi ? "border-red-400/60 bg-red-400/[0.08] text-foreground/90" : "border-border/60 bg-accent/[0.05] text-foreground/70"
          }`}>
            At <span className="font-serif italic">θ = π</span> — exactly half a turn —
            the point lands on <strong>−1</strong>. So{" "}
            <span className="font-serif italic">e^{"{iπ}"} = −1</span>, which is the
            same as <span className="font-serif italic">e^{"{iπ}"} + 1 = 0</span>.
            {atPi ? " ← you're there now: the point is sitting on −1." : " Sweep it, or jump to π, and watch it land."}
          </p>
          <p className="mt-3 text-sm text-foreground/60 leading-relaxed">
            That&apos;s the whole &ldquo;most beautiful equation.&rdquo; It isn&apos;t
            mystical — it says a half-turn around the circle takes 1 to −1, and it
            quietly binds the five constants: e (growth), i (rotation), π (half a
            turn), 1 (unit), 0 (nothing).
          </p>
        </div>
      </div>
    </div>
  )
}
