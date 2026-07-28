"use client"

/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine. Others may reference this work.
 * https://github.com/sinhaankur/portfolio-2026
 *
 * ScreeningPanel — ON-DEMAND conjunction screening. Paste ANY satellite's TLE
 * (two-line element set) and screen it against the full ~18,500-object catalogue
 * for close approaches over the next window. The democratizing feature commercial
 * SSA platforms gate behind a login — here it's open, on public data.
 *
 * Honesty, stated in the panel: geometry-only screening on public TLEs, which
 * carry no covariance — so NO collision probability is shown. This is situational
 * AWARENESS + education, not operational collision avoidance. Observe & understand,
 * never operate. (See components/universe-engine/SSA-OPENSOURCE-MAP.md.)
 */

import { useState } from "react"
import { motion } from "framer-motion"
import { X, ClipboardPaste, Crosshair, AlertTriangle } from "lucide-react"
import { screenOneObject, type Conjunction } from "@/lib/conjunction"
import { loadFullCatalog, selectedSatRef } from "@/components/universe-engine/satellite-field"
import { setSimMs, timeScaleRef, REALTIME_TIME_SCALE } from "@/components/universe-engine/astronomy"

const EXAMPLE_TLE = `ISS (ZARYA)
1 25544U 98067A   26199.50000000  .00016717  00000-0  10270-3 0  9008
2 25544  51.6400 200.0000 0007000  90.0000 270.0000 15.50000000 10000`

/** Pull {name?, l1, l2} out of a pasted 2- or 3-line TLE. */
function parseTle(text: string): { name: string; l1: string; l2: string } | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const l1 = lines.find((l) => l.startsWith("1 "))
  const l2 = lines.find((l) => l.startsWith("2 "))
  if (!l1 || !l2) return null
  const name = lines.find((l) => !l.startsWith("1 ") && !l.startsWith("2 ")) ?? "Your object"
  return { name, l1, l2 }
}

function fmtWhen(ms: number): string {
  const dMin = (ms - Date.now()) / 60000
  if (dMin < 60) return `in ${Math.round(dMin)} min`
  if (dMin < 1440) return `in ${(dMin / 60).toFixed(1)} h`
  return `in ${(dMin / 1440).toFixed(1)} d`
}

export function ScreeningPanel({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<Conjunction[] | null>(null)
  const [subject, setSubject] = useState<string>("")

  async function screen() {
    setError(null); setResults(null)
    const parsed = parseTle(text)
    if (!parsed) { setError("Paste a valid TLE — two lines starting with '1 ' and '2 '."); return }
    setBusy(true); setProgress(0); setSubject(parsed.name)
    try {
      const catalog = await loadFullCatalog()
      const cat = catalog.map((s) => ({ id: s.id, name: s.name, l1: s.l1, l2: s.l2, type: s.type }))
      const res = await screenOneObject(
        { id: "user", name: parsed.name, l1: parsed.l1, l2: parsed.l2 },
        cat,
        {
          startMs: Date.now(),
          hours: 24,
          reportKm: 50,
          onProgress: (f) => setProgress(f),
          // Yield to the UI so the browser stays responsive during the screen.
          yieldEvery: { steps: 40, fn: () => new Promise((r) => setTimeout(r)) },
        },
      )
      setResults(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Screening failed.")
    } finally {
      setBusy(false)
    }
  }

  function flyToApproach(c: Conjunction) {
    // Select the catalogued object and scrub to 90 s before closest approach at
    // real-time rate, so you watch it converge with your pasted object.
    if (typeof c.b.id === "number") selectedSatRef.current = c.b.id
    setSimMs(c.tcaMs - 90_000)
    timeScaleRef.current = REALTIME_TIME_SCALE
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
      className="w-full max-w-sm rounded-2xl border border-border bg-background/90 backdrop-blur-md p-4 shadow-2xl"
    >
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-mono text-[11px] tracking-[0.25em] uppercase text-foreground/80">On-demand screening</h2>
        <button onClick={onClose} aria-label="Close" className="w-7 h-7 inline-flex items-center justify-center rounded-full border border-border text-foreground/70 hover:text-foreground transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <p className="text-[11px] text-muted-foreground leading-snug mb-2">
        Paste any object&rsquo;s TLE to screen it against the {" "}
        <span className="text-foreground/80">18,500+</span> tracked objects for close approaches in the next 24 h.
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={EXAMPLE_TLE}
        spellCheck={false}
        rows={4}
        className="w-full rounded-lg border border-border bg-background/70 px-2.5 py-2 font-mono text-[10px] leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent resize-none"
      />

      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={screen} disabled={busy}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-accent px-3 py-2 font-mono text-[10px] tracking-[0.2em] uppercase text-accent-foreground disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          {busy ? `Screening… ${Math.round(progress * 100)}%` : "Screen for conjunctions"}
        </button>
        <button
          onClick={() => setText(EXAMPLE_TLE)}
          className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border px-3 py-2 font-mono text-[9px] tracking-wider uppercase text-foreground/70 hover:text-foreground transition-colors"
        >
          <ClipboardPaste className="w-3 h-3" /> Example
        </button>
      </div>

      {error && (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] text-red-400/90 leading-snug">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" /> {error}
        </p>
      )}

      {results && (
        <div className="mt-3">
          <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-foreground/50 mb-1.5">
            {results.length === 0
              ? `No approaches within 50 km for ${subject}.`
              : `${results.length} approach${results.length > 1 ? "es" : ""} · ${subject} ≤ 50 km`}
          </p>
          <ul className="max-h-56 overflow-y-auto overscroll-contain space-y-1 pr-1">
            {results.slice(0, 40).map((c, i) => {
              const sev = c.missKm < 1 ? "text-red-400" : c.missKm < 5 ? "text-amber-400" : "text-foreground/85"
              return (
                <li key={i}>
                  <button
                    onClick={() => flyToApproach(c)}
                    className="w-full flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/40 px-2.5 py-1.5 text-left hover:border-accent/60 transition-colors group"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[11px] text-foreground/90">{c.b.name}</span>
                      <span className="block font-mono text-[9px] text-muted-foreground">
                        {fmtWhen(c.tcaMs)} · {c.relSpeedKms.toFixed(1)} km/s
                      </span>
                    </span>
                    <span className="shrink-0 flex items-center gap-1.5">
                      <span className={`font-mono text-[11px] tabular-nums ${sev}`}>{c.missKm.toFixed(1)} km</span>
                      <Crosshair className="w-3 h-3 text-foreground/40 group-hover:text-accent transition-colors" />
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* The bright line, in the panel itself. */}
      <p className="mt-3 pt-2 border-t border-border/60 text-[9px] leading-snug text-muted-foreground/70">
        Geometry-only screening on public TLEs (CelesTrak/NORAD). TLEs carry no covariance, so no
        collision probability is shown — this is situational awareness &amp; education, not operational
        collision avoidance.
      </p>
    </motion.div>
  )
}
