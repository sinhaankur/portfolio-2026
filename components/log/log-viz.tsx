"use client"

// Logarithms, made visible — why a "log book" (and the slide rule) could multiply
// huge numbers by hand for 300 years before calculators.
//
// The whole trick: a logarithm turns MULTIPLICATION into ADDITION.
//   log(a·b) = log(a) + log(b)
// On a LOG scale, the DISTANCE from 1 to a number is its logarithm. So to
// multiply a×b you just lay the distance-to-a and the distance-to-b end to end —
// and where you land is a·b. Adding lengths = multiplying numbers. That is a
// slide rule. This page animates it: pick a and b, watch their log-lengths add
// up to the product. Original implementation; the math is universal.

import { useCallback, useEffect, useRef, useState } from "react"

export function LogViz() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [a, setA] = useState(2)
  const [b, setB] = useState(3)
  const [phase, setPhase] = useState(0)       // directed reveal beat
  const rafRef = useRef<number | null>(null)
  const aRef = useRef(a); aRef.current = a
  const bRef = useRef(b); bRef.current = b
  const slideRef = useRef(0)                    // 0→1 eased slide of the b-length
  const holdRef = useRef(0)
  const phaseRef = useRef(0); phaseRef.current = phase

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

  const restart = useCallback(() => { slideRef.current = 0; holdRef.current = 0; phaseRef.current = 0; setPhase(0) }, [])
  useEffect(() => { restart() }, [a, b, restart])

  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    const ctx = cv.getContext("2d")!
    const MAX = 100                              // log scale runs 1 … 100
    const L = Math.log10(MAX)                    // total log length in decades

    const draw = () => {
      const box = cv.getBoundingClientRect()
      const W = box.width, H = box.height
      const padL = 44, padR = 24
      const scaleW = W - padL - padR
      const yLin = H * 0.30, yLog = H * 0.66
      const xLin = (v: number) => padL + (v / MAX) * scaleW
      const xLog = (v: number) => padL + (Math.log10(v) / L) * scaleW

      ctx.fillStyle = "#05060a"; ctx.fillRect(0, 0, W, H)

      // ---- directed pacing: (0) show the scales, (1) draw a-length, (2) SLIDE
      // the b-length onto the end of a, (3) HOLD on the product. ----
      const ph = phaseRef.current
      if (ph === 0) { holdRef.current += 1 / (1.1 * 60); if (holdRef.current >= 1) { phaseRef.current = 1; setPhase(1); holdRef.current = 0 } }
      else if (ph === 1) { holdRef.current += 1 / (0.9 * 60); if (holdRef.current >= 1) { phaseRef.current = 2; setPhase(2); slideRef.current = 0 } }
      else if (ph === 2) { slideRef.current = Math.min(1, slideRef.current + 0.012); if (slideRef.current >= 1) { phaseRef.current = 3; setPhase(3) } }
      const slide = slideRef.current * slideRef.current * (3 - 2 * slideRef.current) // smoothstep

      const A = aRef.current, B = bRef.current, P = A * B

      // ===== LINEAR scale (top) — evenly spaced, the "normal" number line =====
      ctx.strokeStyle = "rgba(200,215,255,0.25)"; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.moveTo(padL, yLin); ctx.lineTo(W - padR, yLin); ctx.stroke()
      ctx.fillStyle = "rgba(220,228,255,0.4)"; ctx.font = "11px ui-monospace, monospace"; ctx.textAlign = "center"
      ctx.fillText("linear scale — evenly spaced", W / 2, yLin - 22)
      for (let v = 0; v <= MAX; v += 10) {
        const x = xLin(v)
        ctx.strokeStyle = "rgba(200,215,255,0.18)"; ctx.beginPath(); ctx.moveTo(x, yLin - 5); ctx.lineTo(x, yLin + 5); ctx.stroke()
        ctx.fillStyle = "rgba(200,215,255,0.4)"; ctx.fillText(String(v), x, yLin + 20)
      }

      // ===== LOG scale (bottom) — where 1,10,100 are EVENLY spaced =====
      ctx.strokeStyle = "rgba(255,205,120,0.35)"; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.moveTo(padL, yLog); ctx.lineTo(W - padR, yLog); ctx.stroke()
      ctx.fillStyle = "rgba(255,215,150,0.55)"; ctx.fillText("log scale — the distance from 1 to n is log(n)", W / 2, yLog + 30)
      for (const v of [1, 2, 3, 4, 5, 7, 10, 20, 30, 50, 70, 100]) {
        const x = xLog(v)
        ctx.strokeStyle = "rgba(255,205,120,0.25)"; ctx.beginPath(); ctx.moveTo(x, yLog - 5); ctx.lineTo(x, yLog + 5); ctx.stroke()
        ctx.fillStyle = "rgba(255,215,150,0.5)"; ctx.fillText(String(v), x, yLog - 12)
      }

      // the a-length (1 → a) on the log scale, glowing
      if (ph >= 1) {
        ctx.strokeStyle = "rgba(120,235,175,0.95)"; ctx.lineWidth = 4; ctx.lineCap = "round"
        ctx.beginPath(); ctx.moveTo(xLog(1), yLog); ctx.lineTo(xLog(A), yLog); ctx.stroke()
        ctx.fillStyle = "rgba(120,235,175,0.95)"; ctx.fillText(`log ${A}`, (xLog(1) + xLog(A)) / 2, yLog + 46)
      }
      // the b-length, sliding from its own spot onto the END of the a-length
      if (ph >= 2) {
        const startX0 = xLog(1), startX1 = xLog(B)          // where log(b) sits by itself
        const endX0 = xLog(A), endX1 = xLog(P)              // laid at the end of a → lands on a·b
        const bx0 = startX0 + (endX0 - startX0) * slide
        const bx1 = startX1 + (endX1 - startX1) * slide
        ctx.strokeStyle = "rgba(255,130,170,0.95)"; ctx.lineWidth = 4
        ctx.beginPath(); ctx.moveTo(bx0, yLog); ctx.lineTo(bx1, yLog); ctx.stroke()
        ctx.fillStyle = "rgba(255,150,185,0.95)"; ctx.fillText(`log ${B}`, (bx0 + bx1) / 2, yLog + 46)
      }
      // the product marker, revealed when the slide lands
      if (ph >= 3 || (ph === 2 && slide > 0.98)) {
        const x = xLog(P)
        ctx.fillStyle = "#ffd24d"
        ctx.beginPath(); ctx.arc(x, yLog, 5, 0, Math.PI * 2); ctx.fill()
        ctx.font = "bold 13px ui-monospace, monospace"; ctx.fillStyle = "#ffe14d"
        ctx.fillText(`${A} × ${B} = ${P}`, x, yLog - 30)
      }

      // connecting note in the middle
      ctx.textAlign = "left"; ctx.fillStyle = "rgba(230,236,255,0.55)"; ctx.font = "12px ui-monospace, monospace"
      ctx.fillText("log(a) + log(b) = log(a·b)   →   adding lengths multiplies numbers", padL, H * 0.46)

      rafRef.current = requestAnimationFrame(draw)
    }
    rafRef.current = requestAnimationFrame(draw)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])

  const btn = "rounded-full px-3 py-1.5 font-mono text-[11px] tracking-wide backdrop-blur-md transition"
  return (
    <div ref={wrapRef} className="relative w-full h-full overflow-hidden bg-black">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      <div className="absolute bottom-0 inset-x-0 z-10 flex flex-wrap items-center justify-center gap-3 p-3 md:p-4 bg-gradient-to-t from-black/70 via-black/30 to-transparent">
        <label className="flex items-center gap-2 font-mono text-[11px] text-white/60">
          a = <span className="text-emerald-300 tabular-nums w-5">{a}</span>
          <input type="range" min={2} max={9} step={1} value={a} onChange={(e) => setA(parseInt(e.target.value))} className="w-24 accent-white" aria-label="a" />
        </label>
        <label className="flex items-center gap-2 font-mono text-[11px] text-white/60">
          b = <span className="text-pink-300 tabular-nums w-5">{b}</span>
          <input type="range" min={2} max={9} step={1} value={b} onChange={(e) => setB(parseInt(e.target.value))} className="w-24 accent-white" aria-label="b" />
        </label>
        <button onClick={restart} className={`${btn} bg-white/12 text-white border border-white/25`}>Replay</button>
        <span className="font-mono text-[11px] text-amber-200/80">{a} × {b} = {a * b}</span>
      </div>
    </div>
  )
}
