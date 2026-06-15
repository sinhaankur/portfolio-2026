"use client"

/**
 * DnaInheritance — the "what you pass on" view.
 *
 * For each trait marker you carry, this shows the honest Mendelian story of
 * what a child inherits *from you*:
 *   - homozygous (e.g. "GG")  → you pass that same allele to every child.
 *   - heterozygous (e.g. "AG") → each child gets one or the other, 50/50.
 *
 * It uses only your own genotypes (no partner data), so every statement is
 * always true regardless of who the other parent is. Where the marker module
 * defines an `inherit` note (dominant/recessive consequence), we surface it.
 *
 * This is the "for the next generation" lens on the genome — inheritance as
 * legacy, computed straight from real genotypes, nothing fabricated.
 */

import { motion } from "framer-motion"
import {
  TRAIT_MARKERS,
  normalizeGenotype,
  type TraitMarker,
} from "@/lib/dna-traits"

type Row = {
  marker: TraitMarker
  genotype: string
  alleles: [string, string]
  homozygous: boolean
}

function build(traits: Record<string, string>): Row[] {
  return TRAIT_MARKERS.flatMap((marker) => {
    const raw = traits[marker.id]
    if (!raw) return []
    const g = normalizeGenotype(raw)
    const alleles: [string, string] = [g[0], g[1]]
    return [{ marker, genotype: g, alleles, homozygous: g[0] === g[1] }]
  })
}

function passStatement(row: Row): string {
  if (row.homozygous) {
    return `Every child inherits ${row.alleles[0]} from you at this marker.`
  }
  return `Each child gets either ${row.alleles[0]} or ${row.alleles[1]} from you — a 50/50 coin flip.`
}

export function DnaInheritance({ traits }: { traits: Record<string, string> }) {
  const rows = build(traits)
  if (!rows.length) return null

  const fixed = rows.filter((r) => r.homozygous).length
  const variable = rows.length - fixed

  return (
    <section>
      <div className="flex items-baseline gap-4 mb-6">
        <span aria-hidden className="block w-12 h-px bg-accent" />
        <h2 className="font-display text-2xl md:text-3xl font-light tracking-[-0.01em]">
          What you pass on
        </h2>
      </div>
      <p className="max-w-2xl mb-8 font-sans text-sm md:text-base text-foreground/75 leading-relaxed">
        You carry two copies of every gene and pass exactly one to each child, at
        random. Where your two copies match, every child inherits that copy from
        you — it&apos;s settled. Where they differ, it&apos;s a coin flip. This is
        the part of you that carries forward.
      </p>

      {/* Certain-pass portrait — what your side contributes for sure */}
      {(() => {
        const certain = rows.filter((r) => r.homozygous && r.marker.certainPass)
        if (!certain.length) return null
        return (
          <div className="mb-8 rounded-lg border border-accent/30 bg-accent/5 p-6 md:p-8">
            <p className="font-mono text-[10px] tracking-widest uppercase text-accent mb-4">
              Inherited from you, for certain
            </p>
            <p className="font-sans text-sm md:text-base text-foreground/80 leading-relaxed mb-5 max-w-2xl">
              Where your two copies match, there&apos;s no coin flip — every child
              gets that copy from you. From your side, that means:
            </p>
            <ul className="space-y-3">
              {certain.map((r) => (
                <li key={r.marker.id} className="flex gap-3">
                  <span aria-hidden className="text-accent mt-1 shrink-0">→</span>
                  <p className="font-sans text-sm md:text-base text-foreground/85 leading-relaxed">
                    <span className="text-foreground">{r.marker.title}.</span>{" "}
                    {r.marker.certainPass}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )
      })()}

      {/* Split summary */}
      <div className="grid grid-cols-2 gap-px bg-border border border-border rounded-md overflow-hidden mb-8">
        <div className="bg-background p-5">
          <p className="font-mono text-[10px] tracking-widest uppercase text-accent mb-2">
            Settled
          </p>
          <p className="font-display text-2xl md:text-3xl font-light tabular-nums">{fixed}</p>
          <p className="font-sans text-xs text-muted-foreground mt-1">
            traits where every child inherits the same copy from you
          </p>
        </div>
        <div className="bg-background p-5">
          <p className="font-mono text-[10px] tracking-widest uppercase text-accent mb-2">
            Coin flip
          </p>
          <p className="font-display text-2xl md:text-3xl font-light tabular-nums">{variable}</p>
          <p className="font-sans text-xs text-muted-foreground mt-1">
            traits where each child gets one of two copies, 50/50
          </p>
        </div>
      </div>

      <ul className="space-y-2.5">
        {rows.map((row, i) => (
          <motion.li
            key={row.marker.id}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.35, delay: Math.min(i * 0.025, 0.3) }}
            className="rounded-md border border-border bg-background px-5 py-4"
          >
            <div className="flex items-center gap-3 mb-2">
              <p className="flex-1 font-sans text-sm md:text-base text-foreground">
                {row.marker.title}
              </p>
              {/* the two alleles you carry */}
              <span className="flex gap-1.5 shrink-0" aria-hidden>
                {row.alleles.map((a, idx) => (
                  <span
                    key={idx}
                    className={`
                      grid place-items-center h-7 w-7 rounded-md font-mono text-xs
                      ${row.homozygous ? "bg-accent/15 text-accent border border-accent/40" : "bg-secondary/60 text-foreground/80 border border-border"}
                    `}
                  >
                    {a}
                  </span>
                ))}
              </span>
            </div>
            <p className="font-sans text-sm text-foreground/75 leading-relaxed">
              {passStatement(row)}
            </p>
            {row.marker.inherit && (
              <p className="mt-2 font-sans text-xs text-muted-foreground leading-relaxed">
                {row.marker.inherit}
              </p>
            )}
          </motion.li>
        ))}
      </ul>

      <p className="mt-6 font-sans text-xs text-muted-foreground leading-relaxed max-w-2xl">
        What a child actually <em>is</em> depends on the other parent too — these
        statements describe only your half of the inheritance, which is always
        true regardless of who they have children with.
      </p>
    </section>
  )
}
