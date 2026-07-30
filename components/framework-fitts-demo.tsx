"use client"

/**
 * FittsDemo — a live proof of Fitts's Law on the /framework page.
 *
 * A target appears at a random spot and size inside the arena; the moment it
 * shows, we start timing. On click we record the time against the target's
 * "index of difficulty" — ID = log₂(distance/size + 1), the exact quantity
 * Fitts's Law says movement time is proportional to. Do a handful and the
 * scatter climbs left-to-right: bigger/closer = fast, smaller/farther = slow.
 *
 * Self-contained, reduced-motion-safe, pointer + keyboard, no deps.
 */

import { useCallback, useMemo, useRef, useState } from "react"

type Shot = { id: number; ms: number }

const ARENA_H = 220 // px

export function FittsDemo() {
  const [active, setActive] = useState(false)
  const [target, setTarget] = useState<{ x: number; y: number; size: number; id: number } | null>(null)
  const [shots, setShots] = useState<Shot[]>([])
  const arenaRef = useRef<HTMLDivElement>(null)
  const startRef = useRef(0)
  const lastCenterRef = useRef<{ x: number; y: number }>({ x: 0.5, y: 0.5 }) // fractions
  const idRef = useRef(0)

  const spawn = useCallback(() => {
    const arena = arenaRef.current
    if (!arena) return
    const w = arena.clientWidth
    const h = ARENA_H
    // random size (24–72px) + random position with margin
    const size = 24 + Math.random() * 48
    const mx = size / 2 + 6
    const x = mx + Math.random() * (w - 2 * mx)
    const y = mx + Math.random() * (h - 2 * mx)
    // index of difficulty from the previous target's centre
    const px = lastCenterRef.current.x * w
    const py = lastCenterRef.current.y * h
    const dist = Math.hypot(x - px, y - py)
    const ID = Math.log2(dist / size + 1)
    idRef.current = ID
    lastCenterRef.current = { x: x / w, y: y / h }
    startRef.current = performance.now()
    setTarget({ x, y, size, id: Math.round(ID * 100) })
    setActive(true)
  }, [])

  const hit = useCallback(() => {
    if (!active || !target) return
    const ms = Math.round(performance.now() - startRef.current)
    setShots((prev) => [...prev.slice(-11), { id: idRef.current, ms }])
    setActive(false)
    setTarget(null)
  }, [active, target])

  const maxMs = useMemo(() => Math.max(700, ...shots.map((s) => s.ms)), [shots])
  const maxId = 3.2 // log2 range for the arena
  // simple least-squares slope just to draw the trend the scatter implies
  const trend = useMemo(() => {
    if (shots.length < 2) return null
    const n = shots.length
    const sx = shots.reduce((s, p) => s + p.id, 0)
    const sy = shots.reduce((s, p) => s + p.ms, 0)
    const sxx = shots.reduce((s, p) => s + p.id * p.id, 0)
    const sxy = shots.reduce((s, p) => s + p.id * p.ms, 0)
    const denom = n * sxx - sx * sx
    if (Math.abs(denom) < 1e-6) return null
    const b = (n * sxy - sx * sy) / denom
    const a = (sy - b * sx) / n
    return { a, b }
  }, [shots])

  return (
    <div className="rounded-2xl border border-border bg-card/40 p-5 md:p-6">
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <h4 className="font-sans text-sm font-medium text-foreground">Feel Fitts&apos;s Law</h4>
        <span className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">live demo</span>
      </div>
      <p className="font-sans text-[13px] text-foreground/60 leading-relaxed mb-4">
        Hit <span className="text-foreground/80">Start</span>, then click each target the instant it appears. Big &amp; close is quick; small &amp; far is slow — and your times line up with the target&apos;s difficulty.
      </p>

      {/* arena */}
      <div
        ref={arenaRef}
        className="relative w-full overflow-hidden rounded-xl border border-border bg-background/60"
        style={{ height: ARENA_H }}
      >
        {target && active ? (
          <button
            type="button"
            onClick={hit}
            data-cursor-hover
            aria-label="Target — click it"
            className="absolute rounded-full bg-accent/80 hover:bg-accent transition-colors"
            style={{ left: target.x - target.size / 2, top: target.y - target.size / 2, width: target.size, height: target.size }}
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center">
            <button
              type="button"
              onClick={spawn}
              data-cursor-hover
              className="rounded-full border border-accent/60 bg-accent/10 px-5 py-2 font-mono text-[11px] tracking-widest uppercase text-accent hover:bg-accent/20 transition-colors"
            >
              {shots.length === 0 ? "Start" : "Next target"}
            </button>
          </div>
        )}
      </div>

      {/* scatter: time vs index of difficulty */}
      {shots.length > 0 && (
        <div className="mt-4">
          <div className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground mb-2">
            Your time vs target difficulty (Fitts ID)
          </div>
          <div className="relative h-28 w-full rounded-lg border border-border/60 bg-background/40">
            {/* trend line the scatter implies */}
            {trend && (
              <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
                <line
                  x1={0}
                  y1={100 - Math.min(100, ((trend.a) / maxMs) * 100)}
                  x2={100}
                  y2={100 - Math.min(100, ((trend.a + trend.b * maxId) / maxMs) * 100)}
                  stroke="currentColor"
                  className="text-foreground/30"
                  strokeWidth={0.6}
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            )}
            {shots.map((s, i) => (
              <span
                key={i}
                className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/80"
                style={{ left: `${Math.min(98, (s.id / maxId) * 100)}%`, top: `${100 - Math.min(98, (s.ms / maxMs) * 100)}%` }}
                title={`ID ${s.id.toFixed(2)} · ${s.ms} ms`}
              />
            ))}
          </div>
          <div className="mt-1 flex justify-between font-mono text-[9px] uppercase tracking-widest text-muted-foreground/70">
            <span>← easier (big / close)</span>
            <span>harder (small / far) →</span>
          </div>
          <p className="mt-2 font-mono text-[10px] text-muted-foreground">
            Movement time ∝ log₂(distance / size + 1). The harder targets — small and far — cost you more, exactly as Fitts predicts.
          </p>
        </div>
      )}
    </div>
  )
}
