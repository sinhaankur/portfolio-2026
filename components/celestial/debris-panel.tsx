"use client"

/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine. Others may reference this work.
 * https://github.com/sinhaankur/portfolio-2026
 *
 * DebrisPanel — make the debris problem SEEABLE.
 *
 * Four real fragmentation events created most of the tracked debris in orbit. This
 * panel tells each one's story with its ACTUAL tracked-fragment count, and — the
 * "seeing is believing" payoff — isolates that cloud in the swarm so you watch one
 * event's ~2,000 fragments light up around Earth. One anti-satellite test
 * (Fengyun-1C, 2007) is still the single largest debris source in history.
 *
 * Counts are live from the current catalogue (not hardcoded), so they track reality
 * as fragments decay. Honest framing: this is why "just one collision" matters.
 */

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { X, Trash2, Eye } from "lucide-react"
import {
  loadSatelliteCatalog, classifyDebrisFamily, debrisFamilyFilterRef,
  satGroupFilterRef, selectedSatRef, DEBRIS_FAMILIES, type SatMeta,
} from "@/components/universe-engine/satellite-field"

export function DebrisPanel({ onClose, onJump }: { onClose?: () => void; onJump?: () => void }) {
  const [catalog, setCatalog] = useState<SatMeta[] | null>(null)
  const [isolated, setIsolated] = useState<number | null>(null)

  useEffect(() => {
    loadSatelliteCatalog().then(setCatalog)
    // Clear any family isolate when the panel unmounts.
    return () => { debrisFamilyFilterRef.current = -1 }
  }, [])

  // Live fragment count per family from the current catalogue.
  const counts = useMemo(() => {
    const c = new Map<number, number>()
    if (!catalog) return c
    for (const s of catalog) {
      if (s.type !== "DEB") continue
      const fam = classifyDebrisFamily(s.name)
      if (fam >= 0) c.set(fam, (c.get(fam) ?? 0) + 1)
    }
    return c
  }, [catalog])

  const totalTracked = useMemo(() => {
    let t = 0
    for (const v of counts.values()) t += v
    return t
  }, [counts])
  const maxCount = useMemo(() => Math.max(1, ...counts.values()), [counts])

  const isolate = (id: number) => {
    if (isolated === id) {
      // toggle off
      debrisFamilyFilterRef.current = -1
      setIsolated(null)
      return
    }
    // isolating a family: clear other filters + the selection, show only this cloud
    selectedSatRef.current = null
    satGroupFilterRef.current = -1
    debrisFamilyFilterRef.current = id
    setIsolated(id)
    // frame Earth so the whole cloud is on-screen
    window.dispatchEvent(new CustomEvent("universe:sky-focus", { detail: { pointId: "planet:Earth" } }))
    onJump?.()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="w-[min(27rem,calc(100vw-2rem))] max-h-[82vh] overflow-y-auto rounded-xl border border-red-400/40 bg-background/90 backdrop-blur-md shadow-[0_16px_48px_-20px_rgba(0,0,0,0.7)]"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border bg-background/90 backdrop-blur">
        <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase text-red-300">
          <Trash2 className="h-3.5 w-3.5" /> Debris clouds
        </p>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close"
            className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="p-4">
        {!catalog && (
          <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">Counting fragments…</p>
        )}
        {catalog && (
          <>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              A handful of events created most of the tracked debris in orbit —{" "}
              <span className="text-red-300 font-medium">{totalTracked.toLocaleString()}</span> fragments still
              circling. Plus the <span className="text-red-300 font-medium">analyst</span> set —
              uncorrelated objects whose parent isn&apos;t identified. Tap one to isolate
              its cloud in the swarm and see the scale of a single collision.
            </p>

            <ul className="mt-3 flex flex-col gap-1.5">
              {DEBRIS_FAMILIES.map((f) => {
                const count = counts.get(f.id) ?? 0
                const on = isolated === f.id
                return (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => isolate(f.id)}
                      data-cursor-hover
                      aria-pressed={on}
                      className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                        on ? "border-red-400/60 bg-red-400/10" : "border-border/60 bg-background/40 hover:border-foreground/30"
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-medium text-[13px] text-foreground/90">{f.label}</span>
                        <span className="font-mono text-[13px] tabular-nums text-red-300">
                          {count.toLocaleString()}
                          <span className="ml-1 text-[9px] text-muted-foreground">fragments</span>
                        </span>
                      </div>
                      <div className="mt-0.5 font-mono text-[9px] tracking-wider text-muted-foreground">
                        {f.event}{f.year ? ` · ${f.year}` : ""}
                      </div>
                      {/* Bar = this cloud's share of the biggest — the visual scale read. */}
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-border/60" aria-hidden>
                        <div className="h-full rounded-full bg-red-400/70" style={{ width: `${(count / maxCount) * 100}%` }} />
                      </div>
                      {on && (
                        <div className="mt-1.5 inline-flex items-center gap-1 font-mono text-[8px] tracking-[0.2em] uppercase text-red-300">
                          <Eye className="h-2.5 w-2.5" /> Isolated in view · tap to clear
                        </div>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>

            <p className="mt-3 border-t border-border/60 pt-2.5 text-[10px] leading-relaxed text-muted-foreground">
              Fragment counts are live from the current tracked catalogue (CelesTrak),
              matched by object name. The 2007 Fengyun-1C anti-satellite test alone is
              still the largest single debris source ever created — a lasting hazard to
              everything that shares its altitude.
            </p>
          </>
        )}
      </div>
    </motion.div>
  )
}
