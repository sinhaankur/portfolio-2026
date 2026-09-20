"use client"

// The reason π "never completes", made visible.
//
// A point has two arms. The first turns at speed 1; the second turns at speed π,
// and its tip draws the curve. If that ratio were a simple fraction (say 3, or
// 22/7), the tip would return exactly to its start after a whole number of turns
// and the pattern would CLOSE — a finite flower. But π is IRRATIONAL: no whole
// number of turns of one arm ever lines up with a whole number of the other. So
// the tip never revisits its exact start; the curve keeps laying down new petals,
// slightly offset, forever — filling the disc without ever repeating.
//
// That is the same fact as "π has no exact decimal value": an irrational ratio
// never resolves into a clean, repeating whole. Watch it, and you're watching
// irrationality itself. (Original implementation — the math is universal.)

import { useCallback, useEffect, useRef, useState } from "react"

// A few ratios to compare: rational ones CLOSE; π never does.
const RATIOS: { label: string; value: number; rational: boolean; note: string }[] = [
  { label: "π (irrational)", value: Math.PI, rational: false,
    note: "never closes — new petals forever" },
  { label: "3 (whole)", value: 3, rational: true,
    note: "closes after 1 turn — a clean 3-petal flower" },
  { label: "22/7 (≈π, rational)", value: 22 / 7, rational: true,
    note: "π's old approximation — LOOKS like π, but closes after 7 turns" },
  { label: "√2 (irrational)", value: Math.SQRT2, rational: false,
    note: "also never closes — irrationality isn't unique to π" },
]

export function PiIrrational() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ratioIdx, setRatioIdx] = useState(0)
  const [running, setRunning] = useState(true)
  const [turns, setTurns] = useState(0)
  const rafRef = useRef<number | null>(null)
  const tRef = useRef(0)

  const ratio = RATIOS[ratioIdx]

  const restart = useCallback(() => {
    tRef.current = 0
    setTurns(0)
    const cv = canvasRef.current
    if (cv) cv.getContext("2d")!.clearRect(0, 0, cv.width, cv.height)
  }, [])

  useEffect(() => { restart() }, [ratioIdx, restart])

  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    const ctx = cv.getContext("2d")!
    const W = cv.width, H = cv.height, cx = W / 2, cy = H / 2
    const r1 = Math.min(W, H) * 0.20, r2 = Math.min(W, H) * 0.20

    const tip = (t: number): [number, number] => {
      // arm 1 at speed 1, arm 2 at speed `ratio` — tip is their sum (a 2-arm
      // harmonograph). The ratio is what decides whether it ever closes.
      const a1 = t, a2 = t * ratio.value
      const x1 = cx + r1 * Math.cos(a1), y1 = cy + r1 * Math.sin(a1)
      return [x1 + r2 * Math.cos(a2), y1 + r2 * Math.sin(a2)]
    }

    const draw = () => {
      const t = tRef.current
      // draw the freshly-traced arc segment (fade the canvas slightly so old
      // strokes persist but the newest glow — the "never repeats" accretion)
      const steps = 60, dt = 0.03
      ctx.lineWidth = 1
      for (let i = 0; i < steps; i++) {
        const [x0, y0] = tip(t + i * dt)
        const [x1p, y1p] = tip(t + (i + 1) * dt)
        // hue drifts slowly so successive passes are visibly offset (never same)
        const hue = (t * 6) % 360
        ctx.strokeStyle = ratio.rational
          ? "rgba(80,220,140,0.5)"                 // rational: calm green, will close
          : `hsla(${hue}, 70%, 65%, 0.5)`          // irrational: shifting, never same
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1p, y1p); ctx.stroke()
      }
      // the two arms + moving tip, drawn fresh each frame over a small clear box
      const t2 = t + steps * dt
      const a1 = t2, [tx, ty] = tip(t2)
      const jx = cx + r1 * Math.cos(a1), jy = cy + r1 * Math.sin(a1)
      // (arms drawn lightly so they don't erase the trace)
      ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(jx, jy); ctx.lineTo(tx, ty); ctx.stroke()

      tRef.current = t2
      setTurns(Math.floor(t2 / (2 * Math.PI)))
      rafRef.current = requestAnimationFrame(draw)
    }

    if (running) rafRef.current = requestAnimationFrame(draw)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [running, ratio])

  return (
    <div className="rounded-2xl border border-border bg-gradient-to-b from-[#0a0b12] to-[#05060a] p-4 md:p-6">
      <div className="grid gap-5 md:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <div>
          <canvas ref={canvasRef} width={360} height={360} className="w-full max-w-[360px] rounded-lg border border-border/40 bg-black" />
          <div className="mt-3 flex items-center gap-3">
            <button onClick={() => setRunning((r) => !r)} className="rounded-lg border border-accent bg-accent/10 px-3 py-1.5 font-mono text-[12px] text-accent">
              {running ? "Pause" : "Play"}
            </button>
            <button onClick={restart} className="rounded-lg border border-border px-3 py-1.5 font-mono text-[12px] text-foreground/60">Restart</button>
            <span className="font-mono text-[12px] text-foreground/60">{turns} turns</span>
          </div>
        </div>
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
              tip never returns to its exact start. It lays down a new, slightly-offset
              petal on every pass, <strong>forever</strong>.</li>
          </ul>
          <p className="mt-3 text-sm text-foreground/60 leading-relaxed">
            {ratio.rational
              ? <>You&apos;re watching <span className="text-emerald-400">{ratio.label}</span> — {ratio.note}. Let it run: it fills, then repeats.</>
              : <>You&apos;re watching <span className="text-accent">{ratio.label}</span> — {ratio.note}. It will <em>never</em> repeat, no matter how long you wait.</>}
          </p>
          <p className="mt-3 rounded-lg border border-border/60 bg-accent/[0.06] px-3.5 py-2.5 text-[13px] text-foreground/75 leading-relaxed">
            <strong>This is why π has no exact value.</strong> &ldquo;No exact decimal&rdquo;
            and &ldquo;this curve never closes&rdquo; are the <em>same fact</em>: an
            irrational number never resolves into a clean, repeating whole — not as a
            fraction, not as digits, not as a closed curve. It goes on forever, and
            you can see the forever.
          </p>
        </div>
      </div>
    </div>
  )
}
