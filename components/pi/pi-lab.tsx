"use client"

// Pie — watching π get calculated three ways, live, and why it never lands on an
// exact value. Each method converges on screen; the digits it has "locked in"
// glow green as they stop changing. Original visuals (canvas), real math.
//
//   • Archimedes  — squeeze a circle between inscribed & circumscribed polygons,
//     double the sides, watch the perimeter close in on π.
//   • Leibniz     — the infinite series π = 4(1 − 1/3 + 1/5 − 1/7 + …), added term
//     by term, crawling toward π (and overshooting each step — why it's slow).
//   • Monte-Carlo — throw random darts at a square; the fraction landing inside
//     the circle × 4 ≈ π. Randomness computing a constant.

import { useCallback, useEffect, useRef, useState } from "react"

const PI = Math.PI
const PI_STR = "3.14159265358979323846"

// how many leading digits of `val` match π (for the "locked-in digits" readout)
function matchingDigits(val: number): number {
  const s = val.toFixed(15)
  let n = 0
  for (let i = 0; i < s.length && i < PI_STR.length; i++) {
    if (s[i] === PI_STR[i]) n++
    else break
  }
  return Math.max(0, n - 1) // don't count the "3." decimal point as a digit
}

type Method = "archimedes" | "leibniz" | "montecarlo"

export function PiLab() {
  const [method, setMethod] = useState<Method>("archimedes")
  return (
    <div className="rounded-2xl border border-border bg-gradient-to-b from-[#0a0b12] to-[#05060a] p-4 md:p-6">
      <div className="flex flex-wrap gap-2 mb-4">
        {([
          ["archimedes", "Archimedes — polygons"],
          ["leibniz", "Mādhava–Leibniz — infinite series"],
          ["montecarlo", "Monte-Carlo — darts"],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setMethod(k)}
            className={`rounded-lg px-3 py-1.5 font-mono text-[12px] transition ${
              method === k
                ? "border border-accent bg-accent/15 text-accent"
                : "border border-border text-foreground/70 hover:border-accent/50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {method === "archimedes" && <Archimedes />}
      {method === "leibniz" && <Leibniz />}
      {method === "montecarlo" && <MonteCarlo />}
    </div>
  )
}

// ---- shared readout: current estimate vs π, with locked digits glowing -------
function Readout({ estimate, note }: { estimate: number; note: string }) {
  const locked = matchingDigits(estimate)
  const s = estimate.toFixed(12)
  return (
    <div className="mt-4 font-mono text-sm">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-foreground/50 text-[11px] uppercase tracking-wide">estimate</span>
        <span className="text-lg">
          {s.split("").map((ch, i) => (
            <span key={i} className={i < locked + 2 ? "text-emerald-400" : "text-foreground/60"}>{ch}</span>
          ))}
        </span>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-3 mt-1">
        <span className="text-foreground/50 text-[11px] uppercase tracking-wide">actual π</span>
        <span className="text-foreground/40 text-[13px]">{PI_STR}…</span>
      </div>
      <div className="mt-2 text-[11px] text-foreground/45 leading-relaxed">
        {locked} correct digit{locked === 1 ? "" : "s"} locked in · {note}
      </div>
    </div>
  )
}

// ---- 1) Archimedes: inscribed/circumscribed polygons squeezing the circle ----
function Archimedes() {
  const [sides, setSides] = useState(6)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // inscribed & circumscribed perimeters / (2r) bracket π
  const inscribed = sides * Math.sin(Math.PI / sides)
  const circumscribed = sides * Math.tan(Math.PI / sides)
  const estimate = (inscribed + circumscribed) / 2

  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    const ctx = cv.getContext("2d")!
    const W = cv.width, H = cv.height, cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.36
    ctx.clearRect(0, 0, W, H)
    // the true circle
    ctx.strokeStyle = "rgba(124,156,255,0.9)"; ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI); ctx.stroke()
    // circumscribed polygon (outside) + inscribed (inside)
    const poly = (r: number, rot: number, color: string) => {
      ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath()
      for (let i = 0; i <= sides; i++) {
        const a = rot + (i / sides) * 2 * Math.PI
        const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a)
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    poly(R / Math.cos(Math.PI / sides), Math.PI / sides, "rgba(255,120,80,0.8)") // circumscribed
    poly(R, 0, "rgba(80,220,140,0.85)")                                          // inscribed
  }, [sides])

  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
      <div>
        <canvas ref={canvasRef} width={320} height={280} className="w-full max-w-[320px] rounded-lg border border-border/40 bg-black/30" />
        <div className="mt-3 flex items-center gap-3">
          <button onClick={() => setSides((s) => s + s)} className="rounded-lg border border-accent bg-accent/10 px-3 py-1.5 font-mono text-[12px] text-accent">Double the sides</button>
          <button onClick={() => setSides(6)} className="rounded-lg border border-border px-3 py-1.5 font-mono text-[12px] text-foreground/60">Reset</button>
          <span className="font-mono text-[12px] text-foreground/60">{sides.toLocaleString()} sides</span>
        </div>
      </div>
      <div>
        <p className="text-sm text-foreground/70 leading-relaxed">
          Archimedes (c. 250 BC) trapped the circle between two polygons — one
          <span className="text-emerald-400"> inside</span>, one
          <span className="text-orange-400"> outside</span>. π must lie between their
          perimeters. Double the sides and the gap shrinks: the polygons hug the
          circle. It never <em>reaches</em> π — a polygon is always straight edges,
          never a curve — it only closes in.
        </p>
        <div className="mt-3 font-mono text-[12px] text-foreground/55 space-y-1">
          <div><span className="text-emerald-400">inscribed</span> = n·sin(π/n) = {inscribed.toFixed(9)}</div>
          <div><span className="text-orange-400">circumscribed</span> = n·tan(π/n) = {circumscribed.toFixed(9)}</div>
        </div>
        <Readout estimate={estimate} note="the true value sits between the two polygons — forever narrowing, never exact" />
      </div>
    </div>
  )
}

// ---- 2) Leibniz: the infinite alternating series ----------------------------
function Leibniz() {
  const [terms, setTerms] = useState(1)
  const [running, setRunning] = useState(false)
  const rafRef = useRef<number | null>(null)
  const sumRef = useRef(0)
  const [estimate, setEstimate] = useState(0)

  const reset = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    setRunning(false); sumRef.current = 0; setEstimate(0); setTerms(1)
  }, [])

  const run = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    setRunning(true)
    let k = terms
    let sum = sumRef.current
    const step = () => {
      // add a batch of terms per frame (it converges painfully slowly)
      for (let i = 0; i < 2000; i++) {
        sum += (k % 2 === 0 ? 1 : -1) / (2 * k + 1)
        k++
      }
      sumRef.current = sum
      setTerms(k); setEstimate(4 * sum)
      if (k < 5_000_000) rafRef.current = requestAnimationFrame(step)
      else setRunning(false)
    }
    rafRef.current = requestAnimationFrame(step)
  }, [terms])

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }, [])

  return (
    <div>
      <p className="text-sm text-foreground/70 leading-relaxed">
        The Mādhava–Leibniz series is breathtakingly simple (found by Mādhava in
        Kerala c. 1400, ~300 years before Leibniz):
        <span className="font-serif italic text-accent"> π = 4 · (1 − 1/3 + 1/5 − 1/7 + 1/9 − …)</span>.
        Add the fractions forever and you get π exactly — but only at infinity. Each
        term overshoots then undershoots, so the sum <em>zig-zags</em> toward π,
        agonizingly slowly (half a million terms for ~5 digits). That&apos;s the
        point: the formula is finite to write, infinite to finish.
      </p>
      <div className="mt-3 flex items-center gap-3">
        <button onClick={run} disabled={running} className="rounded-lg border border-accent bg-accent/10 px-3 py-1.5 font-mono text-[12px] text-accent disabled:opacity-40">{running ? "adding…" : "Add terms"}</button>
        <button onClick={reset} className="rounded-lg border border-border px-3 py-1.5 font-mono text-[12px] text-foreground/60">Reset</button>
        <span className="font-mono text-[12px] text-foreground/60">{terms.toLocaleString()} terms added</span>
      </div>
      <Readout estimate={estimate} note="millions of terms for a handful of digits — it approaches π but never arrives" />
    </div>
  )
}

// ---- 3) Monte-Carlo: random darts in a square --------------------------------
function MonteCarlo() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const rafRef = useRef<number | null>(null)
  const insideRef = useRef(0)
  const totalRef = useRef(0)
  const [estimate, setEstimate] = useState(0)
  const [total, setTotal] = useState(0)

  const reset = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    setRunning(false); insideRef.current = 0; totalRef.current = 0
    setEstimate(0); setTotal(0)
    const ctx = canvasRef.current?.getContext("2d")
    if (ctx && canvasRef.current) {
      const W = canvasRef.current.width, H = canvasRef.current.height
      ctx.clearRect(0, 0, W, H)
      ctx.strokeStyle = "rgba(124,156,255,0.7)"; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.arc(W / 2, H / 2, Math.min(W, H) / 2 - 2, 0, 2 * Math.PI); ctx.stroke()
      ctx.strokeRect(1, 1, W - 2, H - 2)
    }
  }, [])

  useEffect(() => { reset() }, [reset])

  const run = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    setRunning(true)
    const cv = canvasRef.current!; const ctx = cv.getContext("2d")!
    const W = cv.width, H = cv.height, R = Math.min(W, H) / 2 - 2, cx = W / 2, cy = H / 2
    const step = () => {
      for (let i = 0; i < 400; i++) {
        const x = Math.random() * 2 - 1, y = Math.random() * 2 - 1  // in [-1,1]²
        const inside = x * x + y * y <= 1
        if (inside) insideRef.current++
        totalRef.current++
        ctx.fillStyle = inside ? "rgba(80,220,140,0.7)" : "rgba(255,120,80,0.55)"
        ctx.fillRect(cx + x * R, cy + y * R, 1.5, 1.5)
      }
      setTotal(totalRef.current)
      setEstimate(4 * insideRef.current / totalRef.current)
      if (totalRef.current < 400_000) rafRef.current = requestAnimationFrame(step)
      else setRunning(false)
    }
    rafRef.current = requestAnimationFrame(step)
  }, [])

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }, [])

  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
      <div>
        <canvas ref={canvasRef} width={280} height={280} className="w-full max-w-[280px] rounded-lg border border-border/40 bg-black/30" />
        <div className="mt-3 flex items-center gap-3">
          <button onClick={run} disabled={running} className="rounded-lg border border-accent bg-accent/10 px-3 py-1.5 font-mono text-[12px] text-accent disabled:opacity-40">{running ? "throwing…" : "Throw darts"}</button>
          <button onClick={reset} className="rounded-lg border border-border px-3 py-1.5 font-mono text-[12px] text-foreground/60">Reset</button>
        </div>
      </div>
      <div>
        <p className="text-sm text-foreground/70 leading-relaxed">
          Throw random darts at a square with a circle inside it. The circle&apos;s
          area is π/4 of the square&apos;s, so the fraction of darts landing
          <span className="text-emerald-400"> inside the circle</span>, times 4,
          approaches π. Pure randomness computing an exact-seeming constant — but
          the estimate jitters and only settles as the darts pile up. More darts,
          closer to π; never precisely there.
        </p>
        <div className="mt-3 font-mono text-[12px] text-foreground/55">
          {total.toLocaleString()} darts · 4 × (inside / total)
        </div>
        <Readout estimate={estimate} note="statistical — it wobbles toward π and tightens with more darts, never exact" />
      </div>
    </div>
  )
}
