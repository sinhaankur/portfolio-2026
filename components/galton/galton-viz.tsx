"use client"

// The bell curve, made visible — a Galton board (quincunx).
//
// Drop balls through a triangle of pegs. At each peg a ball goes left or right by
// pure chance. After many rows those coin-flips ADD UP, and the balls pile into
// the same curve every time: the normal distribution, the bell curve. This is the
// Central Limit Theorem you can watch — sum enough independent random nudges and
// you always get a bell, no matter what the individual nudges look like.
//
// The theoretical curve n·2^(−rows)·C(rows,k) is overlaid so you can see the
// histogram converge to it. Original implementation; the math is universal.

import { useCallback, useEffect, useRef, useState } from "react"

const ROWS = 12                       // peg rows → bins = ROWS+1
const BINS = ROWS + 1

export function GaltonViz() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(true)
  const [rate, setRate] = useState(3)             // balls per frame-ish
  const [total, setTotal] = useState(0)
  const rafRef = useRef<number | null>(null)
  const bins = useRef<number[]>(new Array(BINS).fill(0))
  const balls = useRef<{ x: number; y: number; row: number; bin: number }[]>([])
  const rateRef = useRef(rate); rateRef.current = rate
  const runRef = useRef(running); runRef.current = running

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

  const reset = useCallback(() => {
    bins.current = new Array(BINS).fill(0); balls.current = []; setTotal(0)
  }, [])

  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    const ctx = cv.getContext("2d")!

    // binomial coefficient for the theoretical curve
    const choose = (n: number, k: number) => {
      let r = 1
      for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1)
      return r
    }

    const draw = () => {
      const box = cv.getBoundingClientRect()
      const W = box.width, H = box.height
      ctx.fillStyle = "#05060a"; ctx.fillRect(0, 0, W, H)

      const cx = W / 2
      const pegTop = H * 0.10, pegGapY = (H * 0.52) / ROWS, pegGapX = Math.min(W * 0.055, pegGapY)
      const floor = H * 0.92
      const binW = W / BINS

      // pegs
      ctx.fillStyle = "rgba(124,156,255,0.35)"
      for (let row = 0; row < ROWS; row++) {
        for (let i = 0; i <= row; i++) {
          const px = cx + (i - row / 2) * pegGapX
          const py = pegTop + row * pegGapY
          ctx.beginPath(); ctx.arc(px, py, 1.8, 0, Math.PI * 2); ctx.fill()
        }
      }

      // spawn balls
      if (runRef.current) {
        for (let s = 0; s < rateRef.current; s++) {
          if (Math.random() < 0.5) continue
          balls.current.push({ x: cx, y: pegTop - pegGapY, row: 0, bin: 0 })
        }
      }

      // advance balls down the pegs
      ctx.fillStyle = "#ffd24d"
      const still: typeof balls.current = []
      for (const b of balls.current) {
        if (b.row < ROWS) {
          // move toward the next row; at each row, flip left/right
          const targetY = pegTop + b.row * pegGapY
          if (b.y < targetY) {
            b.y += pegGapY * 0.5
          } else {
            const goRight = Math.random() < 0.5
            b.x += (goRight ? 0.5 : -0.5) * pegGapX
            b.bin += goRight ? 1 : 0
            b.row++
          }
          ctx.beginPath(); ctx.arc(b.x, b.y, 2.4, 0, Math.PI * 2); ctx.fill()
          still.push(b)
        } else {
          // landed → drop into its bin
          bins.current[b.bin]++
          setTotal((t) => t + 1)
        }
      }
      balls.current = still

      // histogram columns
      const maxBin = Math.max(1, ...bins.current)
      const colMaxH = floor - H * 0.64
      for (let k = 0; k < BINS; k++) {
        const h = (bins.current[k] / maxBin) * colMaxH
        const x = k * binW + binW * 0.15, w = binW * 0.7
        const grd = ctx.createLinearGradient(0, floor - h, 0, floor)
        grd.addColorStop(0, "rgba(120,200,255,0.9)")
        grd.addColorStop(1, "rgba(40,110,190,0.7)")
        ctx.fillStyle = grd
        ctx.fillRect(x, floor - h, w, h)
      }

      // the theoretical bell curve overlaid (binomial → normal)
      const tot = bins.current.reduce((a, c) => a + c, 0)
      if (tot > 0) {
        ctx.strokeStyle = "rgba(255,210,90,0.95)"; ctx.lineWidth = 2; ctx.lineCap = "round"
        ctx.beginPath()
        for (let k = 0; k < BINS; k++) {
          const p = choose(ROWS, k) / Math.pow(2, ROWS)   // probability for bin k
          const expected = p * tot
          const h = (expected / maxBin) * colMaxH
          const x = k * binW + binW / 2, y = floor - h
          k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        ctx.stroke()
      }

      rafRef.current = requestAnimationFrame(draw)
    }
    rafRef.current = requestAnimationFrame(draw)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])

  return (
    <div className="rounded-2xl border border-border bg-gradient-to-b from-[#0a0b12] to-[#05060a] p-4 md:p-6">
      <div className="grid gap-5 md:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <div>
          <canvas ref={canvasRef} className="w-full aspect-[3/4] rounded-lg border border-border/40 bg-black" />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button onClick={() => setRunning((r) => !r)} className="rounded-lg border border-accent bg-accent/10 px-3 py-1.5 font-mono text-[12px] text-accent">{running ? "Pause" : "Drop balls"}</button>
            <button onClick={reset} className="rounded-lg border border-border px-3 py-1.5 font-mono text-[12px] text-foreground/60 hover:border-accent/50">Reset</button>
            <label className="flex items-center gap-2 font-mono text-[11px] text-foreground/60">
              rate
              <input type="range" min={1} max={12} step={1} value={rate} onChange={(e) => setRate(parseInt(e.target.value))} className="w-24 accent-[color:var(--color-accent,#cf9a2c)]" aria-label="drop rate" />
            </label>
            <span className="font-mono text-[11px] text-foreground/45">{total.toLocaleString()} landed</span>
          </div>
        </div>
        <div>
          <p className="text-sm text-foreground/75 leading-relaxed">
            Each <span className="text-[#ffd24d]">ball</span> falls through the pegs;
            at every peg it goes left or right on a coin-flip. One ball is pure
            chance — you can&apos;t predict where it lands. But thousands of them
            pile into the exact same shape every time: the{" "}
            <span className="text-[#ffd24d]">bell curve</span> (the yellow line is
            the theoretical normal distribution — the histogram converges right onto
            it).
          </p>
          <p className="mt-3 text-sm text-foreground/70 leading-relaxed">
            This is the <strong>Central Limit Theorem</strong>, made visible: add up
            enough small independent random nudges and the total is <em>always</em>
            normally distributed — no matter what each nudge looks like. It&apos;s
            why the bell curve is everywhere — heights, measurement error, test
            scores, noise: they&apos;re all sums of many little randomnesses.
          </p>
          <p className="mt-3 text-sm text-foreground/60 leading-relaxed">
            Order out of pure randomness — the opposite feeling from{" "}
            <span className="italic">π</span> and Fourier, yet the same lesson:
            structure you can watch emerge, and trust because you saw it.
          </p>
        </div>
      </div>
    </div>
  )
}
