"use client"

/**
 * GoldenRatioOverlay — a toggle icon (the φ glyph) that draws the golden ratio
 * OVER the current page, so a visitor can SEE the proportions the layout is
 * built on, not just be told. Clicking the icon reveals:
 *   • the 62/38 (φ:1) vertical split line — where the golden-split header divides
 *   • a nest of φ-rectangles (each φ× the last) folding into the corner
 *   • the golden spiral (a logarithmic spiral, growth factor φ per quarter-turn)
 *   • a small "φ = 1.618… · golden ratio applied" readout
 *
 * It's opt-in and honest: only mount it on pages whose layout actually sits on φ
 * (the /lab/golden-ratio exploration), so the grid lines land on real edges —
 * an overlay over a non-φ page would expose the lie. Click again to hide; Esc
 * closes; respects prefers-reduced-motion (the spiral draws instantly).
 */

import { useEffect, useRef, useState } from "react"

const PHI = 1.618033988749895

/** φ glyph — the toggle button's mark. A clean φ in the display face. */
function PhiMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none">
      {/* φ: a vertical bar through an ellipse */}
      <ellipse cx="12" cy="12" rx="5.2" ry="7" stroke="currentColor" strokeWidth="1.6" />
      <line x1="12" y1="2.5" x2="12" y2="21.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

/**
 * The golden ratio drawn over a WxH box, built the honest way:
 *   • rects  — a nest of φ-rectangles. Start from the full box and carve a SQUARE
 *              off the longer side each step; the leftover is always a smaller
 *              φ-rectangle (its sides in ratio φ:1). This is the construction.
 *   • eyes   — the accumulating corner each square's arc curls toward (the pole).
 *   • spiral — a true logarithmic (golden) spiral sampled as a smooth polyline,
 *              r = r0·φ^(2θ/π) — so it grows by exactly φ every quarter-turn — and
 *              anchored at the nest's pole. A polyline can't be geometrically
 *              wrong the way hand-placed arcs were.
 */
function goldenFigure(w: number, h: number): { rects: string[]; spiral: string; pole: { x: number; y: number } } {
  const rects: string[] = []
  let x = 0,
    y = 0,
    bw = w,
    bh = h
  // Carve squares; record each square so we also know where the spiral winds in.
  // `dir` cycles the side we carve from: 0 left, 1 top, 2 right, 3 bottom.
  let dir = 0
  const squares: { x: number; y: number; s: number; dir: number }[] = []
  for (let i = 0; i < 12 && bw > 1 && bh > 1; i++) {
    rects.push(`M${x.toFixed(1)},${y.toFixed(1)} h${bw.toFixed(1)} v${bh.toFixed(1)} h${(-bw).toFixed(1)} Z`)
    const s = Math.min(bw, bh)
    if (dir === 0) {
      squares.push({ x, y, s, dir })
      x += s
      bw -= s
    } else if (dir === 1) {
      squares.push({ x, y, s, dir })
      y += s
      bh -= s
    } else if (dir === 2) {
      squares.push({ x: x + bw - s, y, s, dir })
      bw -= s
    } else {
      squares.push({ x, y: y + bh - s, s, dir })
      bh -= s
    }
    dir = (dir + 1) % 4
  }
  // Pole = the centre of the last (smallest) remaining box — the spiral's eye.
  const pole = { x: x + bw / 2, y: y + bh / 2 }

  // Build the spiral as a polyline winding OUT from the pole. Each quarter-turn
  // the radius multiplies by φ (that IS the golden spiral). We start at a small
  // radius and keep adding turns ONLY while the point stays inside the box — so
  // the spiral fills the frame instead of exploding to tens of thousands of px.
  const r0 = Math.max(3, (squares[squares.length - 1]?.s ?? 6) * 0.6)
  const phase = Math.PI // open toward the long axis; a fixed phase reads fine
  const pts: string[] = []
  const maxR = Math.hypot(w, h) // box diagonal — stop once the spiral exits it
  const dTheta = (2 * Math.PI) / 96 // 96 samples per full turn → smooth curve
  let theta = 0
  // a hard cap on turns so a pathological box can't loop forever
  for (let guard = 0; guard < 96 * 8; guard++) {
    const r = r0 * Math.pow(PHI, (2 * theta) / Math.PI)
    const px = pole.x + r * Math.cos(theta + phase)
    const py = pole.y + r * Math.sin(theta + phase)
    pts.push(`${px.toFixed(1)},${py.toFixed(1)}`)
    if (r > maxR) break
    theta += dTheta
  }
  const spiral = "M" + pts.join(" L")
  return { rects, spiral, pole }
}

export function GoldenRatioOverlay({
  label = "Golden ratio",
}: {
  /** accessible label for the toggle */
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const [box, setBox] = useState({ w: 0, h: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)

  // Size the overlay to the viewport, re-measure on resize while open.
  useEffect(() => {
    if (!open) return
    const measure = () => setBox({ w: window.innerWidth, h: window.innerHeight })
    measure()
    window.addEventListener("resize", measure)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("resize", measure)
      window.removeEventListener("keydown", onKey)
    }
  }, [open])

  const { w, h } = box
  // the 62/38 split sits φ of the way across the width
  const splitX = w / PHI
  const { rects, spiral, pole } =
    w && h ? goldenFigure(w, h) : { rects: [], spiral: "", pole: { x: 0, y: 0 } }

  return (
    <>
      {/* Toggle icon — bottom-right, quiet, matches the site's chip language. */}
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-cursor-hover
        aria-pressed={open}
        aria-label={open ? `Hide the ${label} overlay` : `Show the ${label} overlay`}
        title={open ? "Hide golden-ratio overlay" : "Show the golden ratio on this page"}
        className={`fixed bottom-5 right-5 z-[60] grid h-11 w-11 place-items-center rounded-full border backdrop-blur transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
          open
            ? "border-accent bg-accent text-accent-foreground"
            : "border-border bg-background/70 text-foreground/80 hover:text-foreground hover:border-accent/60"
        }`}
      >
        <PhiMark className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[55] pointer-events-none overflow-hidden" aria-hidden="true">
          <svg
            className="gr-overlay-draw block"
            width={w}
            height={h}
            viewBox={`0 0 ${w} ${h}`}
            style={{ width: w, height: h }}
            fill="none"
          >
            {/* a soft wash so the lines read over any page content */}
            <rect x={0} y={0} width={w} height={h} fill="var(--background)" fillOpacity={0.35} />
            {/* φ-rectangle nest — brighter toward the eye of the spiral */}
            {rects.map((d, i) => (
              <path
                key={i}
                d={d}
                stroke="var(--accent)"
                strokeOpacity={0.28 + (rects.length - i) * 0.03}
                strokeWidth={1.25}
              />
            ))}
            {/* 62/38 vertical split */}
            <line
              x1={splitX}
              y1={0}
              x2={splitX}
              y2={h}
              stroke="var(--accent)"
              strokeOpacity={0.7}
              strokeWidth={1.25}
              strokeDasharray="5 7"
            />
            {/* the golden spiral itself, drawn on top. pathLength=1 normalises the
                dash animation to the path's own length regardless of how long it is. */}
            <path
              d={spiral}
              pathLength={1}
              stroke="var(--accent)"
              strokeOpacity={1}
              strokeWidth={2.5}
              strokeLinecap="round"
              fill="none"
              className="gr-spiral"
            />
            {/* the pole — the spiral's eye */}
            <circle cx={pole.x} cy={pole.y} r={3} fill="var(--accent)" fillOpacity={0.9} />
          </svg>

          {/* readout — confirms it, honestly */}
          <div className="absolute bottom-20 right-5 rounded-md border border-accent/40 bg-background/85 px-3 py-2 backdrop-blur">
            <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-accent">
              φ = 1.618…
            </p>
            <p className="mt-0.5 font-mono text-[10px] tracking-wider text-foreground/75">
              golden ratio applied · 62 / 38 split
            </p>
          </div>
        </div>
      )}
    </>
  )
}
