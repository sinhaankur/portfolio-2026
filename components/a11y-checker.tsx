"use client"

/**
 * A11yChecker — a WAVE-style accessibility panel. A button (mounted from the
 * display/accessibility menu) opens a slide-in report that scans THIS page live
 * and lists errors · alerts · features, each with a plain-language "why it
 * matters." Purely client-side DOM inspection (no external service), so it
 * evaluates the real rendered page a visitor's assistive tech would meet.
 */

import { useEffect, useState } from "react"
import { scanAccessibility, type ScanResult, type Severity } from "@/lib/a11y-scan"

const META: Record<Severity, { label: string; icon: string; color: string; ring: string }> = {
  error: { label: "Errors", icon: "✕", color: "text-red-500", ring: "border-red-500/40 bg-red-500/10" },
  alert: { label: "Alerts", icon: "!", color: "text-amber-500", ring: "border-amber-500/40 bg-amber-500/10" },
  feature: { label: "Features", icon: "✓", color: "text-emerald-500", ring: "border-emerald-500/40 bg-emerald-500/10" },
}

export function A11yChecker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [result, setResult] = useState<ScanResult | null>(null)
  const [scanning, setScanning] = useState(false)

  const runScan = () => {
    setScanning(true)
    // Defer so the panel paints first, then scan (keeps it responsive).
    requestAnimationFrame(() => {
      setResult(scanAccessibility())
      setScanning(false)
    })
  }

  useEffect(() => {
    if (open && !result) runScan()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Close on Escape.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex justify-end" role="dialog" aria-modal="true" aria-label="Accessibility check">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-md flex-col overflow-hidden border-l border-border bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground">Accessibility check</p>
            <h2 className="mt-1 font-display text-xl text-foreground">How accessible is this page?</h2>
          </div>
          <button onClick={onClose} data-cursor-hover aria-label="Close accessibility check" className="rounded-full p-2 text-2xl leading-none text-muted-foreground hover:text-foreground">×</button>
        </div>

        {/* Intro */}
        <div className="border-b border-border px-5 py-3">
          <p className="text-sm text-foreground/70 leading-relaxed">
            A live, in-page evaluation (in the spirit of{" "}
            <a href="https://wave.webaim.org" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">WAVE</a>
            ). It inspects what a screen reader and keyboard user would actually meet — right now, on this page. Nothing leaves your device.
          </p>
        </div>

        {/* Summary counts */}
        {result && (
          <div className="grid grid-cols-3 gap-2 border-b border-border px-5 py-4">
            {(["error", "alert", "feature"] as Severity[]).map((s) => (
              <div key={s} className={`rounded-xl border px-3 py-3 text-center ${META[s].ring}`}>
                <p className={`text-2xl font-bold tabular-nums ${META[s].color}`}>{result.counts[s]}</p>
                <p className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{META[s].label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Findings */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {scanning || !result ? (
            <p className="text-sm text-muted-foreground">Scanning this page…</p>
          ) : (
            <ul className="space-y-3">
              {result.findings.map((f, i) => (
                <li key={i} className="rounded-xl border border-border bg-secondary/20 p-3">
                  <div className="flex items-start gap-2.5">
                    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${META[f.severity].ring} ${META[f.severity].color}`}>
                      {META[f.severity].icon}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {f.label} {f.count > 1 && <span className="text-muted-foreground">× {f.count}</span>}
                      </p>
                      <p className="mt-0.5 text-[13px] text-foreground/70">{f.detail}</p>
                      <p className="mt-1 text-[12px] italic text-muted-foreground">{f.why}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Re-scan */}
        <div className="border-t border-border px-5 py-3">
          <button onClick={runScan} data-cursor-hover className="w-full rounded-full border border-border py-2.5 font-mono text-[10px] tracking-widest uppercase text-muted-foreground transition-colors hover:text-foreground hover:border-foreground/30">
            Re-scan this page
          </button>
        </div>
      </div>
    </div>
  )
}
