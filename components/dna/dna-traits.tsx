"use client"

/**
 * DnaTraits — the curated trait panel (diet, wellness, physical, health).
 *
 * Reads the decrypted `traits` map (marker id -> genotype), looks each up in
 * TRAIT_MARKERS, and renders a result card per marker with progressive
 * disclosure: headline verdict, then how it shows up day-to-day (`feels`), an
 * actionable tip, and a next-generation inheritance note where one exists.
 *
 * Category tabs + text search keep the growing panel navigable. The "health"
 * group carries its own stronger disclaimer (tendencies, not risk/diagnosis;
 * a genotyping chip can't resolve cancer/cardiac mutations).
 */

import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import { AlertCircle, Search, Baby } from "lucide-react"
import {
  TRAIT_MARKERS,
  normalizeGenotype,
  type TraitCategory,
  type TraitMarker,
  type TraitOutcome,
} from "@/lib/dna-traits"

type Resolved = {
  marker: TraitMarker
  genotype: string
  outcome: TraitOutcome | null
}

const CATEGORY_LABELS: Record<TraitCategory, string> = {
  diet: "Diet & Nutrition",
  fitness: "Fitness & Training",
  skin: "Skin care",
  wellness: "Wellness",
  physical: "Physical traits",
  health: "Health tendencies",
  pharma: "Drug response",
}
const CATEGORY_ORDER: TraitCategory[] = [
  "diet",
  "fitness",
  "skin",
  "wellness",
  "physical",
  "pharma",
  "health",
]

function resolve(traits: Record<string, string>): Resolved[] {
  return TRAIT_MARKERS.flatMap((marker) => {
    const raw = traits[marker.id]
    if (!raw) return []
    const norm = normalizeGenotype(raw)
    return [{ marker, genotype: norm, outcome: marker.outcomes[norm] ?? null }]
  })
}

function TraitCard({ r, i }: { r: Resolved; i: number }) {
  const notable = r.outcome?.tone === "notable"
  return (
    <motion.details
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4, delay: Math.min(i * 0.03, 0.3) }}
      className="group rounded-md border border-border bg-background open:bg-secondary/20 transition-colors"
    >
      <summary
        className="
          list-none cursor-pointer flex items-center gap-4 px-5 py-4
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
          focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-md
        "
      >
        <div className="flex-1 min-w-0">
          <p className="font-sans text-base md:text-lg text-foreground leading-snug">
            {r.marker.title}
          </p>
          <p className="mt-0.5 font-mono text-[10px] tracking-wider uppercase text-muted-foreground">
            {r.marker.gene} · {r.genotype}
          </p>
        </div>
        <span
          className={`
            font-mono text-[10px] tracking-wider uppercase px-3 py-1.5 rounded-full border shrink-0 text-right
            ${notable ? "border-accent/60 text-accent bg-accent/10" : "border-border text-foreground/70"}
          `}
        >
          {r.outcome?.label ?? "No call"}
        </span>
      </summary>
      <div className="px-5 pb-5 pt-1 border-t border-border/60 space-y-4">
        <p className="font-sans text-xs text-muted-foreground mt-3">{r.marker.about}</p>
        {/* Verifiable provenance — every marker links out to the public dbSNP
            record for its rsID (and SNPedia's write-up) so any claim here can be
            checked against the primary source. Honest by construction. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] tracking-wider text-muted-foreground/80">
          {r.marker.source && (
            <span>
              Source: <span className="text-foreground/70">{r.marker.source}</span>
              {r.marker.evidence ? ` · ${r.marker.evidence}` : ""}
            </span>
          )}
          <a
            href={`https://www.ncbi.nlm.nih.gov/snp/${r.marker.rsid}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent/80 hover:text-accent underline underline-offset-2 decoration-dotted"
          >
            {r.marker.rsid} · dbSNP ↗
          </a>
          <a
            href={`https://www.snpedia.com/index.php/${r.marker.rsid}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground/70 hover:text-foreground underline underline-offset-2 decoration-dotted"
          >
            SNPedia ↗
          </a>
        </div>
        <p className="font-sans text-sm md:text-base text-foreground/85 leading-relaxed">
          {r.outcome?.detail ??
            "Your genotype at this marker isn't one of the well-characterised forms, so no interpretation is shown."}
        </p>
        {r.outcome?.feels && (
          <div className="rounded-md bg-secondary/40 px-4 py-3">
            <p className="font-mono text-[10px] tracking-widest uppercase text-accent mb-1.5">
              How it shows up
            </p>
            <p className="font-sans text-sm text-foreground/80 leading-relaxed">{r.outcome.feels}</p>
          </div>
        )}
        {r.outcome?.tip && (
          <div className="rounded-md border border-accent/25 px-4 py-3">
            <p className="font-mono text-[10px] tracking-widest uppercase text-accent mb-1.5">
              What helps
            </p>
            <p className="font-sans text-sm text-foreground/80 leading-relaxed">{r.outcome.tip}</p>
          </div>
        )}
        {r.marker.inherit && (
          <div className="flex gap-2.5">
            <Baby className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" aria-hidden />
            <p className="font-sans text-xs text-muted-foreground leading-relaxed">
              <span className="text-foreground/70">Passing it on — </span>
              {r.marker.inherit}
            </p>
          </div>
        )}
      </div>
    </motion.details>
  )
}

export function DnaTraits({ traits }: { traits: Record<string, string> }) {
  const resolved = useMemo(() => resolve(traits), [traits])
  const [active, setActive] = useState<TraitCategory | "all">("all")
  const [query, setQuery] = useState("")

  const present = CATEGORY_ORDER.filter((c) =>
    resolved.some((r) => r.marker.category === c),
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return resolved.filter((r) => {
      if (active !== "all" && r.marker.category !== active) return false
      if (!q) return true
      return (
        r.marker.title.toLowerCase().includes(q) ||
        r.marker.gene.toLowerCase().includes(q) ||
        (r.outcome?.label.toLowerCase().includes(q) ?? false) ||
        (r.outcome?.feels?.toLowerCase().includes(q) ?? false)
      )
    })
  }, [resolved, active, query])

  if (!resolved.length) return null

  const groups = present
    .map((c) => ({ cat: c, items: filtered.filter((r) => r.marker.category === c) }))
    .filter((g) => g.items.length)

  return (
    <section>
      <div className="flex items-baseline gap-4 mb-6">
        <span aria-hidden className="block w-12 h-px bg-accent" />
        <h2 className="font-display text-2xl md:text-3xl font-light tracking-[-0.01em]">
          What your genome says
        </h2>
      </div>
      <p className="max-w-2xl mb-6 font-sans text-sm md:text-base text-foreground/75 leading-relaxed">
        {resolved.length} well-studied markers read from your actual genotypes —
        across diet, wellness, physical traits, drug response, and broad health
        tendencies, each drawn from an open dataset (GWAS Catalog, ClinVar,
        PharmGKB) and cited on the card. Tap any trait to expand: what it means,
        how it shows up day-to-day, what helps, and how it passes to the next
        generation.
      </p>

      {/* General disclaimer */}
      <div className="mb-6 flex gap-3 rounded-md border border-accent/30 bg-accent/5 p-4">
        <AlertCircle className="h-4 w-4 text-accent shrink-0 mt-0.5" aria-hidden />
        <p className="font-sans text-xs md:text-sm text-foreground/75 leading-relaxed">
          <strong>Not medical advice.</strong> A genotyping array is not a
          clinical test. These are informational common variants — genes are one
          input among many, and lifestyle usually matters more. For anything
          health-related, talk to a clinician.
        </p>
      </div>

      {/* Controls — category tabs + search */}
      <div className="mb-8 flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="flex flex-wrap gap-2">
          {(["all", ...present] as const).map((c) => {
            const label = c === "all" ? "All" : CATEGORY_LABELS[c]
            const on = active === c
            return (
              <button
                key={c}
                type="button"
                onClick={() => setActive(c)}
                data-cursor-hover
                className={`
                  font-mono text-[10px] tracking-widest uppercase px-3 py-2 rounded-full border min-h-9
                  transition-colors
                  ${on ? "border-accent bg-accent/10 text-accent" : "border-border text-foreground/70 hover:border-foreground/40"}
                `}
              >
                {label}
              </button>
            )
          })}
        </div>
        <div className="relative sm:ml-auto sm:w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search traits…"
            aria-label="Search traits"
            className="
              w-full rounded-full border border-border bg-background pl-9 pr-4 py-2
              font-sans text-sm text-foreground placeholder:text-muted-foreground
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
              focus-visible:ring-offset-2 focus-visible:ring-offset-background
            "
          />
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="font-sans text-sm text-muted-foreground py-8 text-center">
          No traits match “{query}”.
        </p>
      ) : (
        <div className="space-y-12">
          {groups.map(({ cat, items }) => (
            <div key={cat}>
              <h3 className="font-mono text-[10px] tracking-widest uppercase text-accent mb-4">
                {CATEGORY_LABELS[cat]}
              </h3>

              {/* Stronger, section-specific warning for health tendencies */}
              {cat === "health" && (
                <div className="mb-4 flex gap-3 rounded-md border border-[#f06c8d]/40 bg-[#f06c8d]/5 p-4">
                  <AlertCircle className="h-4 w-4 text-[#f06c8d] shrink-0 mt-0.5" aria-hidden />
                  <p className="font-sans text-xs md:text-sm text-foreground/80 leading-relaxed">
                    <strong>Read this first.</strong> These are <em>tendencies</em>,
                    not risk scores or diagnoses. A consumer genotyping chip{" "}
                    <strong>cannot</strong> reliably assess cancer or serious heart
                    disease — it misses almost all of the rare BRCA and cardiac
                    mutations that actually matter, so a reassuring result here is{" "}
                    <em>not</em> a clean bill of health. Anything flagged worth
                    acting on must be confirmed by a clinician on a validated test.
                    Raw DTC data also carries real error rates.
                  </p>
                </div>
              )}

              <div className="space-y-2.5">
                {items.map((r, i) => (
                  <TraitCard key={r.marker.id} r={r} i={i} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
