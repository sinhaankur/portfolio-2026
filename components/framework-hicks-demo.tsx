"use client"

/**
 * HicksDemo — a live proof of Hick's Law on the /framework page.
 *
 * The user picks how many choices a screen offers, then clicks "Go" and taps
 * the highlighted target. We time the pick. Do it across a few counts and the
 * pattern Hick predicted emerges: decision time rises roughly with log₂(n+1).
 * A predicted-time bar sits behind each result so the law is visible, not just
 * asserted — the page practising "answers you can act on".
 *
 * Self-contained, reduced-motion-safe, keyboard-operable, no deps.
 */

import { useCallback, useMemo, useRef, useState } from "react"

const COUNTS = [2, 4, 8, 16] as const

type Result = { count: number; ms: number }

export function HicksDemo() {
  const [count, setCount] = useState<number>(4)
  const [phase, setPhase] = useState<"idle" | "ready" | "picking">("idle")
  const [target, setTarget] = useState<number>(-1)
  const [results, setResults] = useState<Result[]>([])
  const startRef = useRef<number>(0)

  const start = useCallback(() => {
    setPhase("ready")
    // brief random delay so the user can't anticipate — then reveal the target.
    const delay = 500 + Math.random() * 700
    window.setTimeout(() => {
      setTarget(Math.floor(Math.random() * count))
      startRef.current = performance.now()
      setPhase("picking")
    }, delay)
  }, [count])

  const pick = useCallback(
    (i: number) => {
      if (phase !== "picking") return
      if (i !== target) return // must hit the highlighted one
      const ms = Math.round(performance.now() - startRef.current)
      setResults((prev) => {
        // keep the latest result per count so the chart reads clean
        const next = prev.filter((r) => r.count !== count)
        return [...next, { count, ms }].sort((a, b) => a.count - b.count)
      })
      setPhase("idle")
      setTarget(-1)
    },
    [phase, target, count],
  )

  // Hick's predicted time (illustrative): T = a + b·log₂(n+1), anchored so the
  // curve reads on the same axis as the measured results.
  const maxMs = useMemo(() => Math.max(900, ...results.map((r) => r.ms)), [results])
  const predicted = (n: number) => 180 + 130 * Math.log2(n + 1)

  return (
    <div className="rounded-2xl border border-border bg-card/40 p-5 md:p-6">
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <h4 className="font-sans text-sm font-medium text-foreground">Feel Hick&apos;s Law</h4>
        <span className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">live demo</span>
      </div>
      <p className="font-sans text-[13px] text-foreground/60 leading-relaxed mb-4">
        Pick a number of choices, hit <span className="text-foreground/80">Go</span>, then tap the highlighted box as fast as you can. More choices, slower pick — that&apos;s the law.
      </p>

      {/* count selector */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Choices</span>
        {COUNTS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => { setCount(c); setPhase("idle"); setTarget(-1) }}
            data-cursor-hover
            className={`rounded-full border px-3 py-1 font-mono text-[11px] transition-colors ${
              count === c ? "border-accent/60 bg-accent/15 text-accent" : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {c}
          </button>
        ))}
        <button
          type="button"
          onClick={start}
          disabled={phase !== "idle"}
          data-cursor-hover
          className="ml-auto rounded-full border border-accent/60 bg-accent/10 px-4 py-1.5 font-mono text-[11px] tracking-widest uppercase text-accent hover:bg-accent/20 disabled:opacity-50 transition-colors"
        >
          {phase === "ready" ? "wait…" : phase === "picking" ? "tap it!" : "Go"}
        </button>
      </div>

      {/* the choice grid */}
      <div
        className="grid gap-2 mb-4"
        style={{ gridTemplateColumns: `repeat(${Math.min(count, 8)}, minmax(0, 1fr))` }}
        aria-label="Choice targets"
      >
        {Array.from({ length: count }).map((_, i) => {
          const isTarget = phase === "picking" && i === target
          return (
            <button
              key={i}
              type="button"
              onClick={() => pick(i)}
              data-cursor-hover
              aria-label={isTarget ? "Target — tap this" : `Choice ${i + 1}`}
              className={`aspect-square rounded-lg border transition-colors ${
                isTarget
                  ? "border-accent bg-accent/80"
                  : "border-border bg-background/60 hover:border-border"
              }`}
            />
          )
        })}
      </div>

      {/* results vs Hick's prediction */}
      {results.length > 0 && (
        <div>
          <div className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground mb-2">
            Your pick time vs Hick&apos;s prediction
          </div>
          <ul className="space-y-2">
            {results.map((r) => (
              <li key={r.count} className="flex items-center gap-3">
                <span className="w-14 shrink-0 font-mono text-[11px] tabular-nums text-foreground/70">{r.count} opt</span>
                <div className="relative h-4 flex-1 overflow-hidden rounded-full bg-border/50">
                  {/* predicted marker */}
                  <span
                    className="absolute top-0 bottom-0 w-0.5 bg-foreground/50"
                    style={{ left: `${Math.min(100, (predicted(r.count) / maxMs) * 100)}%` }}
                    title="Hick's predicted time"
                  />
                  {/* measured bar */}
                  <span
                    className="absolute top-0 bottom-0 left-0 rounded-full bg-accent/70"
                    style={{ width: `${Math.min(100, (r.ms / maxMs) * 100)}%` }}
                  />
                </div>
                <span className="w-14 shrink-0 text-right font-mono text-[11px] tabular-nums text-accent">{r.ms} ms</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 font-mono text-[10px] text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-full bg-accent/70 align-middle" /> your time ·
            <span className="ml-1 inline-block h-2 w-0.5 bg-foreground/50 align-middle" /> Hick&apos;s log₂ prediction
          </p>
        </div>
      )}
    </div>
  )
}
