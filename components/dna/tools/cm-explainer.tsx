/**
 * CmExplainer — enter a shared-DNA amount (cM) → the relationships it's
 * consistent with, ranked by fit. A teaching tool: it shows WHY a single cM
 * value maps to several possible relationships, not one answer.
 *
 * Pure + public: no personal data, no upload. All math in lib/dna-cm.ts.
 */

"use client"

import { useMemo, useState } from "react"
import { relationshipsForCm, cmToPercent } from "@/lib/dna-cm"

const PRESETS = [
  { label: "Sibling", cm: 2613 },
  { label: "Grandparent", cm: 1754 },
  { label: "1st cousin", cm: 866 },
  { label: "2nd cousin", cm: 229 },
  { label: "3rd cousin", cm: 73 },
]

export function CmExplainer() {
  const [cm, setCm] = useState(866)
  const matches = useMemo(() => relationshipsForCm(cm), [cm])
  const pct = useMemo(() => cmToPercent(cm), [cm])

  return (
    <div className="rounded-2xl border border-border bg-card/40 p-5 md:p-7">
      <div className="flex items-baseline gap-3 mb-2">
        <h3 className="font-display text-xl md:text-2xl font-light">cM Explainer</h3>
        <span className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">shared DNA → relationship</span>
      </div>
      <p className="font-sans text-sm text-foreground/70 leading-relaxed max-w-2xl mb-6">
        Enter the total DNA you share with a match, in <strong>centimorgans (cM)</strong>.
        Because DNA recombines differently every generation, one amount fits
        several relationships — so this shows the whole candidate set, ranked by
        how well the amount fits each. A probability aid, not a verdict.
      </p>

      {/* input */}
      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end mb-4">
        <div>
          <label htmlFor="cm-input" className="block font-mono text-[10px] tracking-widest uppercase text-muted-foreground mb-1.5">
            Shared cM
          </label>
          <input
            id="cm-input"
            type="number"
            min={0}
            max={3720}
            value={cm}
            onChange={(e) => setCm(Math.max(0, Math.min(3720, Number(e.target.value) || 0)))}
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <input
            type="range"
            min={0}
            max={3720}
            value={cm}
            onChange={(e) => setCm(Number(e.target.value))}
            aria-label="Shared cM slider"
            className="mt-3 w-full accent-[var(--accent)]"
          />
        </div>
        <div className="text-right">
          <div className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground mb-1">of genome</div>
          <div className="font-display text-2xl text-accent tabular-nums">{pct.toFixed(1)}%</div>
        </div>
      </div>

      {/* presets */}
      <div className="flex flex-wrap gap-2 mb-6">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => setCm(p.cm)}
            data-cursor-hover
            className={`rounded-full border px-3 py-1 font-mono text-[10px] tracking-wider uppercase transition-colors ${
              cm === p.cm ? "border-accent/60 text-accent bg-accent/10" : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* results */}
      {matches.length > 0 ? (
        <ol className="space-y-2.5">
          {matches.map((m, i) => (
            <li
              key={m.label}
              className={`rounded-xl border px-4 py-3 ${i === 0 ? "border-accent/50 bg-accent/[0.05]" : "border-border bg-background/40"}`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="font-sans text-sm font-medium text-foreground">
                  {i === 0 && <span className="mr-1.5 font-mono text-[9px] uppercase tracking-widest text-accent">best fit</span>}
                  {m.label}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                  avg {m.avg} cM · range {m.range[0]}–{m.range[1]}
                </span>
              </div>
              {/* fit bar */}
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-foreground/10">
                <div className="h-full rounded-full bg-accent/70" style={{ width: `${Math.round(m.fit * 100)}%` }} />
              </div>
              <p className="mt-1.5 font-sans text-xs text-foreground/65 leading-relaxed">{m.note}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="font-sans text-sm text-muted-foreground italic">
          No relationship range spans {cm} cM. Above ~3720 cM you&apos;re looking at
          an identical twin or the same person; 0 cM means no detectable shared DNA.
        </p>
      )}

      <p className="mt-5 font-mono text-[10px] tracking-wider text-muted-foreground/80">
        Reference ranges from the community Shared cM Project (Bettinger et al.) · averages + observed ranges from tens of thousands of known relationships
      </p>
    </div>
  )
}
