"use client"

/**
 * DnaTraits — the curated diet/wellness trait panel.
 *
 * Reads the decrypted `traits` map (marker id -> genotype), looks each up in
 * the TRAIT_MARKERS definitions, and renders a result card per marker. Grouped
 * into Diet & Nutrition and Wellness. Carries a non-negotiable "not medical
 * advice" disclaimer — these are informational genetics, not a clinical test.
 */

import { motion } from "framer-motion"
import { AlertCircle } from "lucide-react"
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
      transition={{ duration: 0.4, delay: Math.min(i * 0.04, 0.4) }}
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
      <div className="px-5 pb-5 pt-1 border-t border-border/60">
        <p className="font-sans text-xs text-muted-foreground mb-3 mt-3">
          {r.marker.about}
        </p>
        <p className="font-sans text-sm md:text-base text-foreground/85 leading-relaxed">
          {r.outcome?.detail ??
            "Your genotype at this marker isn't one of the well-characterised forms, so no interpretation is shown."}
        </p>
      </div>
    </motion.details>
  )
}

function Group({
  title,
  items,
}: {
  title: string
  items: Resolved[]
}) {
  if (!items.length) return null
  return (
    <div>
      <h3 className="font-mono text-[10px] tracking-widest uppercase text-accent mb-4">
        {title}
      </h3>
      <div className="space-y-2.5">
        {items.map((r, i) => (
          <TraitCard key={r.marker.id} r={r} i={i} />
        ))}
      </div>
    </div>
  )
}

export function DnaTraits({ traits }: { traits: Record<string, string> }) {
  const resolved = resolve(traits)
  if (!resolved.length) return null

  const byCat = (c: TraitCategory) =>
    resolved.filter((r) => r.marker.category === c)

  return (
    <section>
      <div className="flex items-baseline gap-4 mb-6">
        <span aria-hidden className="block w-12 h-px bg-accent" />
        <h2 className="font-display text-2xl md:text-3xl font-light tracking-[-0.01em]">
          What your genome says
        </h2>
      </div>
      <p className="max-w-2xl mb-6 font-sans text-sm md:text-base text-foreground/75 leading-relaxed">
        A curated panel of well-studied diet, nutrition, and wellness markers,
        read from your actual genotypes. Tap any trait to expand. {resolved.length}{" "}
        markers found in your data.
      </p>

      {/* Disclaimer — non-negotiable. */}
      <div className="mb-10 flex gap-3 rounded-md border border-accent/30 bg-accent/5 p-4">
        <AlertCircle className="h-4 w-4 text-accent shrink-0 mt-0.5" aria-hidden />
        <p className="font-sans text-xs md:text-sm text-foreground/75 leading-relaxed">
          <strong>Not medical advice.</strong> A genotyping array is not a
          clinical test. These are informational, well-replicated common
          variants about diet and wellness — not disease risk, diagnoses, or
          carrier status. Genes are one input among many; lifestyle and
          environment usually matter more. Talk to a clinician for anything
          health-related.
        </p>
      </div>

      <div className="space-y-12">
        <Group title="Diet & Nutrition" items={byCat("diet")} />
        <Group title="Wellness" items={byCat("wellness")} />
      </div>
    </section>
  )
}
