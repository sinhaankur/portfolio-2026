"use client"

// The reason π "never completes", made visible — at its best.
//
// A point has two arms. The first turns at speed 1; the second at speed `ratio`,
// and its tip draws the curve. A RATIONAL ratio lines up after a whole number of
// turns and the curve CLOSES (finite flower). π is IRRATIONAL: the arms never
// align, so the tip never returns to its start — it lays a new, slightly-offset
// petal on every pass, forever. That is the same fact as "π has no exact value".
//
// This build: speed control, real fullscreen, HiDPI-crisp rendering, a glowing
// trail that fades so the freshest stroke leads while history lingers.
// Original implementation; the math is universal.

import { useCallback, useEffect, useRef, useState } from "react"

const TAU = Math.PI * 2

const RATIOS: { label: string; value: number; rational: boolean; note: string }[] = [
  { label: "π (irrational)", value: Math.PI, rational: false, note: "never closes — new petals forever" },
  { label: "3 (whole)", value: 3, rational: true, note: "closes after 1 turn — a clean 3-petal flower" },
  { label: "22/7 (≈π, rational)", value: 22 / 7, rational: true, note: "π's old approximation — LOOKS like π, but closes after 7 turns" },
  { label: "√2 (irrational)", value: Math.SQRT2, rational: false, note: "also never closes — irrationality isn't unique to π" },
]

export function PiIrrational() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ratioIdx, setRatioIdx] = useState(0)
  const [running, setRunning] = useState(true)
  const [speed, setSpeed] = useState(1)          // multiplier, 0.1×–5×
  const [turns, setTurns] = useState(0)
  const [fs, setFs] = useState(false)
  const rafRef = useRef<number | null>(null)
  const tRef = useRef(0)
  const speedRef = useRef(speed)
  const runRef = useRef(running)
  speedRef.current = speed
  runRef.current = running

  const ratio = RATIOS[ratioIdx]
  const ratioRef = useRef(ratio)
  ratioRef.current = ratio

  // size the canvas to its box at device pixel ratio (crisp on Retina + fullscreen)
  const fit = useCallback(() => {
    const cv = canvasRef.current, wrap = wrapRef.current
    if (!cv || !wrap) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const box = cv.getBoundingClientRect()
    cv.width = Math.round(box.width * dpr)
    cv.height = Math.round(box.height * dpr)
    const ctx = cv.getContext("2d")!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)      // draw in CSS pixels
    ctx.clearRect(0, 0, box.width, box.height)
  }, [])

  const restart = useCallback(() => {
    tRef.current = 0
    setTurns(0)
    fit()
  }, [fit])

  useEffect(() => { restart() }, [ratioIdx, restart])

  // refit on resize / fullscreen change
  useEffect(() => {
    fit()
    const onResize = () => fit()
    window.addEventListener("resize", onResize)
    const onFs = () => { setFs(!!document.fullscreenElement); setTimeout(fit, 60) }
    document.addEventListener("fullscreenchange", onFs)
    return () => { window.removeEventListener("resize", onResize); document.removeEventListener("fullscreenchange", onFs) }
  }, [fit])

  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    const ctx = cv.getContext("2d")!

    const draw = () => {
      const box = cv.getBoundingClientRect()
      const W = box.width, H = box.height, cx = W / 2, cy = H / 2
      const R = Math.min(W, H) * 0.22
      const r1 = R, r2 = R
      const rt = ratioRef.current

      const tip = (t: number): [number, number] => {
        const a1 = t, a2 = t * rt.value
        return [cx + r1 * Math.cos(a1) + r2 * Math.cos(a2),
                cy + r1 * Math.sin(a1) + r2 * Math.sin(a2)]
      }

      // gentle fade of the whole canvas each frame → glowing trail that lingers
      // but never fully erases; the newest stroke reads brightest.
      ctx.globalCompositeOperation = "source-over"
      ctx.fillStyle = "rgba(5,6,10,0.045)"
      ctx.fillRect(0, 0, W, H)

      if (runRef.current) {
        const t = tRef.current
        const stepCount = 70
        const dt = 0.02 * speedRef.current
        ctx.globalCompositeOperation = "lighter"       // additive → luminous overlaps
        ctx.lineWidth = 1.4
        for (let i = 0; i < stepCount; i++) {
          const [x0, y0] = tip(t + i * dt)
          const [x1p, y1p] = tip(t + (i + 1) * dt)
          const hue = (t * 8) % 360
          ctx.strokeStyle = rt.rational
            ? "rgba(80,220,140,0.55)"
            : `hsla(${hue}, 75%, 62%, 0.55)`
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1p, y1p); ctx.stroke()
        }
        const t2 = t + stepCount * dt
        // arms + tip, drawn fresh (source-over so they're crisp, not additive)
        ctx.globalCompositeOperation = "source-over"
        const a1 = t2, jx = cx + r1 * Math.cos(a1), jy = cy + r1 * Math.sin(a1)
        const [tx, ty] = tip(t2)
        ctx.strokeStyle = "rgba(255,255,255,0.28)"; ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(jx, jy); ctx.lineTo(tx, ty); ctx.stroke()
        ctx.fillStyle = "#ffd24d"
        ctx.beginPath(); ctx.arc(tx, ty, 3, 0, TAU); ctx.fill()

        tRef.current = t2
        setTurns(Math.floor(t2 / TAU))
      }
      rafRef.current = requestAnimationFrame(draw)
    }
    rafRef.current = requestAnimationFrame(draw)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])

  const toggleFs = useCallback(() => {
    const el = wrapRef.current
    if (!el) return
    if (document.fullscreenElement) document.exitFullscreen?.()
    else el.requestFullscreen?.().catch(() => {})
  }, [])

  return (
    <div className="rounded-2xl border border-border bg-gradient-to-b from-[#0a0b12] to-[#05060a] p-4 md:p-6">
      <div className={fs ? "grid gap-0" : "grid gap-5 md:grid-cols-[minmax(0,420px)_minmax(0,1fr)]"}>
        <div ref={wrapRef} className={fs ? "relative bg-black flex flex-col" : "relative"}>
          <canvas
            ref={canvasRef}
            className={fs ? "w-full flex-1 min-h-0 bg-black" : "w-full aspect-square rounded-lg border border-border/40 bg-black"}
          />
          {/* controls overlay */}
          <div className={`flex flex-wrap items-center gap-3 ${fs ? "p-4" : "mt-3"}`}>
            <button onClick={() => setRunning((r) => !r)} className="rounded-lg border border-accent bg-accent/10 px-3 py-1.5 font-mono text-[12px] text-accent">
              {running ? "Pause" : "Play"}
            </button>
            <button onClick={restart} className="rounded-lg border border-border px-3 py-1.5 font-mono text-[12px] text-foreground/60 hover:border-accent/50">Restart</button>
            <button onClick={toggleFs} className="rounded-lg border border-border px-3 py-1.5 font-mono text-[12px] text-foreground/70 hover:border-accent/50">
              {fs ? "Exit fullscreen ⤢" : "Fullscreen ⛶"}
            </button>
            <label className="flex items-center gap-2 font-mono text-[11px] text-foreground/60">
              speed
              <input
                type="range" min={0.1} max={5} step={0.1} value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="w-28 accent-[color:var(--color-accent,#cf9a2c)]"
                aria-label="animation speed"
              />
              <span className="tabular-nums w-9">{speed.toFixed(1)}×</span>
            </label>
            <span className="font-mono text-[11px] text-foreground/45">{turns} turns</span>
          </div>
        </div>

        {!fs && (
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-foreground/40 mb-2">
              two arms · second turns at {ratio.label}× the first
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              {RATIOS.map((r, i) => (
                <button
                  key={r.label}
                  onClick={() => setRatioIdx(i)}
                  className={`rounded-lg px-2.5 py-1 font-mono text-[11px] transition ${
                    i === ratioIdx ? "border border-accent bg-accent/15 text-accent"
                      : "border border-border text-foreground/70 hover:border-accent/50"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <p className="text-sm text-foreground/75 leading-relaxed">
              The tip of the second arm draws the curve. Whether it ever{" "}
              <em>closes</em> depends entirely on the ratio of the two speeds:
            </p>
            <ul className="mt-2 text-sm text-foreground/70 leading-relaxed space-y-1.5">
              <li>• A <span className="text-emerald-400">rational</span> ratio (3, or 22/7)
                lines up after a whole number of turns — the curve <strong>closes</strong>
                into a finite flower and then just retraces itself.</li>
              <li>• An <span className="text-accent">irrational</span> ratio like{" "}
                <span className="font-serif italic">π</span> <strong>never</strong> lines
                up — no whole number of turns of one arm ever matches the other — so the
                tip never returns to its exact start. A new, slightly-offset petal on
                every pass, <strong>forever</strong>.</li>
            </ul>
            <p className="mt-3 text-sm text-foreground/60 leading-relaxed">
              {ratio.rational
                ? <>You&apos;re watching <span className="text-emerald-400">{ratio.label}</span> — {ratio.note}. Let it run: it fills, then repeats.</>
                : <>You&apos;re watching <span className="text-accent">{ratio.label}</span> — {ratio.note}. It will <em>never</em> repeat, no matter how long you wait.</>}
            </p>
            <p className="mt-3 rounded-lg border border-border/60 bg-accent/[0.06] px-3.5 py-2.5 text-[13px] text-foreground/75 leading-relaxed">
              <strong>This is why π has no exact value.</strong> &ldquo;No exact decimal&rdquo;
              and &ldquo;this curve never closes&rdquo; are the <em>same fact</em>: an
              irrational number never resolves into a clean, repeating whole. It goes on
              forever — and you can see the forever.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
