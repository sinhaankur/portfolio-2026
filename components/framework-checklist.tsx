"use client"

/**
 * PreShipChecklist — the framework's pre-ship checklist, made usable.
 *
 * The page's own principle is "answers you can act on": instead of a static
 * bullet list, this is a real checklist a visitor can run on their own screen —
 * tap to check, a live progress bar, and it remembers state in localStorage so
 * it survives a refresh. A reset clears it. Reduced-motion-safe, keyboard-
 * operable (native checkboxes), no deps.
 */

import { useEffect, useState } from "react"
import { PRE_SHIP } from "@/lib/framework-data"

const KEY = "uef-preship-v1"

export function PreShipChecklist() {
  const [done, setDone] = useState<boolean[]>(() => PRE_SHIP.map(() => false))
  const [hydrated, setHydrated] = useState(false)

  // restore saved state once, client-side (static export renders unchecked).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) {
        const arr = JSON.parse(raw)
        if (Array.isArray(arr) && arr.length === PRE_SHIP.length) setDone(arr)
      }
    } catch { /* ignore */ }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try { localStorage.setItem(KEY, JSON.stringify(done)) } catch { /* ignore */ }
  }, [done, hydrated])

  const count = done.filter(Boolean).length
  const pct = Math.round((count / PRE_SHIP.length) * 100)
  const allDone = count === PRE_SHIP.length

  const toggle = (i: number) =>
    setDone((prev) => prev.map((v, j) => (j === i ? !v : v)))

  return (
    <div className="rounded-2xl border border-accent/30 bg-accent/[0.05] p-6">
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <h3 className="font-mono text-[11px] tracking-[0.2em] uppercase text-accent">Pre-ship checklist</h3>
        <span className="font-mono text-[11px] tabular-nums text-foreground/70">
          {count} / {PRE_SHIP.length}
          {count > 0 && (
            <button
              type="button"
              onClick={() => setDone(PRE_SHIP.map(() => false))}
              data-cursor-hover
              className="ml-3 text-muted-foreground hover:text-foreground transition-colors"
            >
              reset
            </button>
          )}
        </span>
      </div>

      {/* live progress */}
      <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-border/50" aria-hidden>
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ul className="space-y-1">
        {PRE_SHIP.map((c, i) => (
          <li key={c}>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-1.5 hover:bg-background/40 transition-colors" data-cursor-hover>
              <input
                type="checkbox"
                checked={done[i]}
                onChange={() => toggle(i)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
              />
              <span className={`font-sans text-sm leading-relaxed ${done[i] ? "text-foreground/40 line-through" : "text-foreground/80"}`}>
                {c}
              </span>
            </label>
          </li>
        ))}
      </ul>

      {allDone && (
        <p className="mt-4 rounded-lg border border-[#1e8e5a]/40 bg-[#1e8e5a]/[0.08] px-3 py-2 font-sans text-sm text-foreground/80">
          ✓ Every check passes — the screen is ready to ship.
        </p>
      )}
    </div>
  )
}
