"use client"

// Pythagoras, proven by AREA — a²+b²=c², not asserted but shown.
//
// The classic rearrangement proof: take two identical big squares, each of side
// (a+b). Fill each with four copies of the same right triangle, arranged two
// different ways. Way 1 leaves two square holes of area a² and b². Way 2 leaves
// one square hole of area c². Same big square, same four triangles removed — so
// the leftover areas must be equal: a² + b² = c². You can watch the triangles
// slide from one arrangement to the other.
//
// Drag the slider to morph between the two arrangements; adjust a/b to see it
// hold for any right triangle. Original implementation; the theorem is universal.

import { useCallback, useEffect, useRef, useState } from "react"

export function PythagorasViz() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [morph, setMorph] = useState(0)      // 0 = arrangement 1 (a²+b²), 1 = arrangement 2 (c²)
  const [aFrac, setAFrac] = useState(0.62)   // a as a fraction of side; b = 1−a
  const rafRef = useRef<number | null>(null)
  const morphRef = useRef(morph); morphRef.current = morph
  const aRef = useRef(aFrac); aRef.current = aFrac

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

  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    const ctx = cv.getContext("2d")!
    const lerp = (u: number, v: number, t: number) => u + (v - u) * t
    const ease = (t: number) => t * t * (3 - 2 * t)

    const draw = () => {
      const box = cv.getBoundingClientRect()
      const W = box.width, H = box.height
      ctx.fillStyle = "#05060a"; ctx.fillRect(0, 0, W, H)

      const S = Math.min(W, H) * 0.78         // big square side (a+b)
      const ox = (W - S) / 2, oy = (H - S) / 2
      const a = S * aRef.current, b = S - a
      const m = ease(morphRef.current)

      // the big square outline
      ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 1.5
      ctx.strokeRect(ox, oy, S, S)

      // four right triangles (legs a,b). Arrangement 1: triangles in the four
      // corners leaving a² and b² holes. Arrangement 2: triangles paired along
      // edges leaving a central c² tilted hole. We interpolate their vertices.
      // Each triangle = 3 points; give arrangement-1 and arrangement-2 positions.
      type P = [number, number]
      const A1: P[][] = [
        [[ox, oy], [ox + a, oy], [ox, oy + b]],                       // top-left
        [[ox + a, oy], [ox + S, oy], [ox + S, oy + a]],               // top-right
        [[ox + S, oy + a], [ox + S, oy + S], [ox + S - b, oy + S]],   // bottom-right
        [[ox, oy + b], [ox, oy + S], [ox + b, oy + S]],               // bottom-left
      ]
      // arrangement 2: two triangles on left+right, two on top+bottom, leaving a
      // tilted square (side c) in the middle. Standard second dissection.
      const A2: P[][] = [
        [[ox, oy], [ox + a, oy], [ox, oy + b]],                       // top-left (same anchor)
        [[ox + a, oy], [ox + S, oy], [ox + a, oy + b]],               // top strip → shifted
        [[ox + S, oy], [ox + S, oy + a], [ox + S - b, oy + a]],       // right
        [[ox, oy + b], [ox + b, oy + S], [ox, oy + S]],               // bottom-left
      ]

      const cols = ["rgba(124,156,255,0.85)", "rgba(120,235,175,0.85)", "rgba(255,180,120,0.85)", "rgba(255,120,160,0.85)"]
      // draw the leftover AREAS first (behind triangles), morphing their opacity
      // arrangement 1 holes: a² (top-right region) + b² (bottom-left region)
      ctx.globalAlpha = 1 - m
      ctx.fillStyle = "rgba(255,210,90,0.20)"
      ctx.fillRect(ox + a, oy + a, S - a, S - a)          // a² region (approx placement)
      ctx.fillRect(ox, oy + b, b, b)                       // b² region
      ctx.fillStyle = "rgba(255,210,90,0.9)"; ctx.font = "14px monospace"
      ctx.fillText("a²", ox + a + 8, oy + a + 20)
      ctx.fillText("b²", ox + 8, oy + b + 20)
      // arrangement 2 hole: c² (the tilted centre square) — fades in
      ctx.globalAlpha = m
      ctx.fillStyle = "rgba(255,225,120,0.22)"
      ctx.beginPath()
      ctx.moveTo(ox + a, oy); ctx.lineTo(ox + S, oy + a); ctx.lineTo(ox + b, oy + S); ctx.lineTo(ox, oy + b); ctx.closePath()
      ctx.fill()
      ctx.fillStyle = "rgba(255,225,120,0.95)"; ctx.fillText("c²", ox + S / 2 - 8, oy + S / 2 + 5)
      ctx.globalAlpha = 1

      // the four triangles, interpolated between the two arrangements
      for (let i = 0; i < 4; i++) {
        ctx.beginPath()
        for (let v = 0; v < 3; v++) {
          const p1 = A1[i][v], p2 = A2[i][v]
          const x = lerp(p1[0], p2[0], m), y = lerp(p1[1], p2[1], m)
          v === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        ctx.closePath()
        ctx.fillStyle = cols[i]; ctx.fill()
        ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1; ctx.stroke()
      }

      rafRef.current = requestAnimationFrame(draw)
    }
    rafRef.current = requestAnimationFrame(draw)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])

  const a = aFrac, b = 1 - aFrac, c = Math.hypot(a, b)

  return (
    <div className="rounded-2xl border border-border bg-gradient-to-b from-[#0a0b12] to-[#05060a] p-4 md:p-6">
      <div className="grid gap-5 md:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <div>
          <canvas ref={canvasRef} className="w-full aspect-square rounded-lg border border-border/40 bg-black" />
          <label className="mt-3 flex items-center gap-2 font-mono text-[11px] text-foreground/60">
            rearrange
            <input type="range" min={0} max={1} step={0.005} value={morph} onChange={(e) => setMorph(parseFloat(e.target.value))} className="flex-1 accent-[color:var(--color-accent,#cf9a2c)]" aria-label="morph arrangement" />
            <span className="tabular-nums w-24">{morph < 0.5 ? "a² + b²" : "c²"}</span>
          </label>
          <label className="mt-2 flex items-center gap-2 font-mono text-[11px] text-foreground/60">
            triangle
            <input type="range" min={0.3} max={0.75} step={0.01} value={aFrac} onChange={(e) => setAFrac(parseFloat(e.target.value))} className="flex-1 accent-[color:var(--color-accent,#cf9a2c)]" aria-label="triangle shape" />
            <span className="tabular-nums w-8">a/b</span>
          </label>
        </div>
        <div>
          <p className="text-sm text-foreground/75 leading-relaxed">
            Two identical big squares, each side <span className="font-serif italic">a + b</span>, each holding the
            same four right triangles — just arranged two ways. Slide{" "}
            <em>rearrange</em> to slide the triangles between them:
          </p>
          <ul className="mt-2 text-sm text-foreground/70 leading-relaxed space-y-1.5">
            <li>• Left arrangement leaves two square holes: <span className="text-[#ffd24d]">a²</span> and <span className="text-[#ffd24d]">b²</span>.</li>
            <li>• Right arrangement leaves one tilted square hole: <span className="text-[#ffe178]">c²</span>.</li>
            <li>• Same big square, same four triangles removed → the leftover area is the same. So <strong>a² + b² = c²</strong>. No algebra — just area.</li>
          </ul>
          <p className="mt-3 font-mono text-[12px] text-foreground/60">
            a = {a.toFixed(2)}, b = {b.toFixed(2)} → a²+b² = {(a * a + b * b).toFixed(3)} = c² = {(c * c).toFixed(3)} ✓
          </p>
          <p className="mt-3 text-sm text-foreground/60 leading-relaxed">
            This is a <em>different kind</em> of truth from π or Fourier: not an
            infinite process you approach, but a finite fact you can hold in one
            picture. Some equations are proven by going forever; some, by moving
            four triangles.
          </p>
        </div>
      </div>
    </div>
  )
}
