"use client"

// The golden ratio φ, made visible — and why it's "the most irrational number".
//
// Two views:
//  • SPIRAL — Fibonacci squares (1,1,2,3,5,8,…) tiling into the golden spiral,
//    the ratio of successive squares homing in on φ = 1.618….
//  • SEEDS  — the sunflower / phyllotaxis pattern: place N points, each turned
//    by the golden angle (360°/φ² ≈ 137.5°) from the last. Because φ is the
//    HARDEST number to approximate by fractions, that angle never lines the seeds
//    into wasteful spokes — it packs them perfectly. Turn the angle even slightly
//    off φ and gaps/spokes appear. Irrationality you can see doing useful work.
//
// φ = (1+√5)/2. Original implementation; the math is universal.

import { useCallback, useEffect, useRef, useState } from "react"

const PHI = (1 + Math.sqrt(5)) / 2
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))   // ≈ 2.399963 rad ≈ 137.5°
const TAU = Math.PI * 2

export function PhiViz() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [mode, setMode] = useState<"spiral" | "seeds">("spiral")
  const [angleDeg, setAngleDeg] = useState(137.5)   // seed turn angle (° per seed)
  const [running, setRunning] = useState(true)
  const [fs, setFs] = useState(false)
  const rafRef = useRef<number | null>(null)
  const growthRef = useRef(0)                        // eased "how much has grown"
  const modeRef = useRef(mode); modeRef.current = mode
  const angleRef = useRef(angleDeg); angleRef.current = angleDeg
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

  useEffect(() => { growthRef.current = 0 }, [mode])

  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    const ctx = cv.getContext("2d")!

    const draw = () => {
      const box = cv.getBoundingClientRect()
      const W = box.width, H = box.height
      ctx.fillStyle = "#05060a"; ctx.fillRect(0, 0, W, H)

      if (runRef.current) growthRef.current = Math.min(1, growthRef.current + 0.006)
      const grow = growthRef.current

      if (modeRef.current === "spiral") {
        // Fibonacci squares tiling into the golden spiral
        const fib = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55]
        const total = fib[fib.length - 1] + fib[fib.length - 2]
        const unit = Math.min(W, H) * 0.9 / total
        // walk the squares outward, turning 90° each time (classic construction)
        let x = W / 2, y = H / 2
        let dir = 0                        // 0=right,1=down,2=left,3=up
        const shown = Math.max(2, Math.floor(2 + grow * (fib.length - 2)))
        // pre-place using the standard spiral-of-squares layout
        const squares: { x: number; y: number; s: number; a0: number }[] = []
        let cxp = W / 2, cyp = H / 2
        for (let i = 0; i < fib.length; i++) {
          const s = fib[i] * unit
          // position each square adjacent to the previous, spiralling CCW
          if (i === 0) { squares.push({ x: cxp, y: cyp, s, a0: Math.PI }) }
          else {
            const prev = squares[i - 1]
            switch (dir) {
              case 0: cxp = prev.x + prev.s; cyp = prev.y; break
              case 1: cxp = prev.x; cyp = prev.y + prev.s; break
              case 2: cxp = prev.x - s; cyp = prev.y + prev.s - s; break
              case 3: cxp = prev.x + prev.s - s; cyp = prev.y - s; break
            }
            squares.push({ x: cxp, y: cyp, s, a0: 0 })
            dir = (dir + 1) % 4
          }
        }
        // recentre so the whole figure sits in view
        const minx = Math.min(...squares.map(q => q.x)), maxx = Math.max(...squares.map(q => q.x + q.s))
        const miny = Math.min(...squares.map(q => q.y)), maxy = Math.max(...squares.map(q => q.y + q.s))
        const ox = (W - (maxx - minx)) / 2 - minx, oy = (H - (maxy - miny)) / 2 - miny

        ctx.lineWidth = 1
        for (let i = 0; i < shown && i < squares.length; i++) {
          const q = squares[i]
          ctx.strokeStyle = "rgba(124,156,255,0.30)"
          ctx.strokeRect(q.x + ox, q.y + oy, q.s, q.s)
          ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = "11px monospace"
          ctx.fillText(String(fib[i]), q.x + ox + 4, q.y + oy + 14)
        }
        // the golden spiral: a quarter-arc in each square
        ctx.strokeStyle = "rgba(255,210,90,0.95)"; ctx.lineWidth = 2; ctx.lineCap = "round"
        ctx.beginPath()
        for (let i = 0; i < shown && i < squares.length; i++) {
          const q = squares[i], s = q.s
          // arc centre + start angle depend on the square's corner the spiral hugs
          let ax = q.x + ox, ay = q.y + oy, start = 0
          switch (i % 4) {
            case 0: ax = q.x + ox + s; ay = q.y + oy + s; start = Math.PI; break
            case 1: ax = q.x + ox; ay = q.y + oy + s; start = -Math.PI / 2; break
            case 2: ax = q.x + ox; ay = q.y + oy; start = 0; break
            case 3: ax = q.x + ox + s; ay = q.y + oy; start = Math.PI / 2; break
          }
          ctx.arc(ax, ay, s, start, start + Math.PI / 2)
        }
        ctx.stroke()
        // the converging ratio readout
        const k = Math.min(shown, fib.length - 1)
        const ratio = fib[k] / fib[k - 1]
        ctx.fillStyle = "rgba(255,225,150,0.95)"; ctx.font = "13px monospace"
        ctx.fillText(`${fib[k]} / ${fib[k - 1]} = ${ratio.toFixed(6)}   →  φ = ${PHI.toFixed(6)}`, 16, H - 16)
      } else {
        // phyllotaxis: N seeds, each turned by `angle` from the last, radius ∝ √n
        const cx = W / 2, cy = H / 2
        const ang = (angleRef.current * Math.PI) / 180
        const N = Math.floor(60 + grow * 640)
        const scale = Math.min(W, H) * 0.028
        for (let n = 1; n <= N; n++) {
          const r = scale * Math.sqrt(n)
          const a = n * ang
          const px = cx + r * Math.cos(a), py = cy + r * Math.sin(a)
          const hue = (n * 2.2) % 360
          ctx.fillStyle = `hsl(${hue}, 70%, 62%)`
          ctx.beginPath(); ctx.arc(px, py, Math.max(1.2, scale * 0.34), 0, TAU); ctx.fill()
        }
        const off = Math.abs(angleRef.current - 137.507)
        ctx.fillStyle = "rgba(255,225,150,0.95)"; ctx.font = "13px monospace"
        ctx.fillText(
          off < 0.2 ? "137.5° — the golden angle: perfect packing, no spokes"
                    : `${angleRef.current.toFixed(1)}° — off φ: spokes & gaps appear`,
          16, H - 16)
      }

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
        <canvas ref={canvasRef} className={fs ? "w-full flex-1 min-h-0" : "w-full aspect-square md:aspect-[4/3] rounded-lg border border-border/40 bg-black"} />
        <div className={`flex flex-wrap items-center gap-3 ${fs ? "p-4" : "mt-3"}`}>
          <div className="flex gap-2">
            {(["spiral", "seeds"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)}
                className={`rounded-lg px-3 py-1.5 font-mono text-[12px] transition ${mode === m ? "border border-accent bg-accent/15 text-accent" : "border border-border text-foreground/70 hover:border-accent/50"}`}>
                {m === "spiral" ? "Fibonacci spiral" : "Sunflower seeds"}
              </button>
            ))}
          </div>
          <button onClick={() => setRunning((r) => !r)} className="rounded-lg border border-border px-3 py-1.5 font-mono text-[12px] text-foreground/70 hover:border-accent/50">{running ? "Pause" : "Play"}</button>
          <button onClick={() => { growthRef.current = 0 }} className="rounded-lg border border-border px-3 py-1.5 font-mono text-[12px] text-foreground/60 hover:border-accent/50">Regrow</button>
          <button onClick={toggleFs} className="rounded-lg border border-border px-3 py-1.5 font-mono text-[12px] text-foreground/70 hover:border-accent/50">{fs ? "Exit ⤢" : "Fullscreen ⛶"}</button>
          {mode === "seeds" && (
            <label className="flex items-center gap-2 font-mono text-[11px] text-foreground/60">
              angle
              <input type="range" min={130} max={145} step={0.1} value={angleDeg} onChange={(e) => setAngleDeg(parseFloat(e.target.value))} className="w-32 accent-[color:var(--color-accent,#cf9a2c)]" aria-label="seed angle" />
              <span className="tabular-nums w-12">{angleDeg.toFixed(1)}°</span>
              <button onClick={() => setAngleDeg(137.5)} className="rounded border border-border px-1.5 py-0.5 text-[10px] hover:border-accent/50">→ φ</button>
            </label>
          )}
        </div>
      </div>
      {!fs && (
        <p className="mt-3 text-sm text-foreground/70 leading-relaxed">
          {mode === "spiral"
            ? <>Squares sized by the Fibonacci numbers (1, 1, 2, 3, 5, 8, …) tile without gaps, and a quarter-circle in each traces the <span className="text-[#ffd24d]">golden spiral</span>. The ratio of each number to the one before homes in on <span className="font-serif italic">φ = 1.618…</span> — the golden ratio, <span className="font-serif italic">(1+√5)/2</span>.</>
            : <>Each <span className="text-[#7c9cff]">seed</span> is placed one <em>golden angle</em> (≈137.5°) around from the last — that&apos;s 360°/φ². Because <span className="font-serif italic">φ</span> is the number <em>hardest</em> to approximate by any fraction (&ldquo;the most irrational&rdquo;), the seeds never line up into wasteful spokes; they pack perfectly. Nudge the angle even a fraction off φ and spokes and gaps appear at once. This is why sunflowers, pinecones and pineapples grow this way — irrationality doing real work.</>}
        </p>
      )}
    </div>
  )
}
