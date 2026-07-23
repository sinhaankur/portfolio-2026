"use client"

/**
 * DnaVisualization — the unlocked view. Composes the R3F helix with DOM panels
 * for the chromosome map, genotype distribution, and provenance. All driven by
 * the decrypted abstract summary (no raw loci).
 */

import { useState } from "react"
import dynamic from "next/dynamic"
import { motion } from "framer-motion"
import type { DnaSummary } from "@/lib/dna-crypto"
import { DnaTraits } from "./dna-traits"
import { DnaExplainer } from "./dna-explainer"
import { DnaPlan } from "./dna-plan"
import { DnaOrigins } from "./dna-origins"
import { DnaBodyType } from "./dna-body-type"
import { DnaCompare } from "./dna-compare"
import { DnaHero } from "./dna-hero"
import { DnaTabs } from "./dna-tabs"
import { DnaStudy } from "./dna-study"
import { DnaInheritance } from "./dna-inheritance"
import { DnaRadar } from "./dna-radar"

// Helix is R3F (~Three.js) — lazy-load so the gate + panels paint first.
const DnaHelix = dynamic(
  () => import("./helix").then((m) => ({ default: m.DnaHelix })),
  { ssr: false, loading: () => <div className="absolute inset-0 grid place-items-center font-mono text-[10px] tracking-widest uppercase text-muted-foreground">Rendering helix…</div> },
)

function fmt(n: number) {
  return n.toLocaleString()
}

export function DnaVisualization({ data }: { data: DnaSummary }) {
  const [helixView, setHelixView] = useState<"3d" | "illustrated">("3d")
  // Active L2 section id — the tabs pick one at a time so the page reads as a
  // focused view, not an endless scroll. Defaults to the at-a-glance hero.
  const [active, setActive] = useState<string>("hero")
  // Switching tabs also scrolls back to the top of the panel, so a long previous
  // tab doesn't leave you mid-page on the next one.
  const pick = (id: string) => {
    setActive(id)
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" })
  }
  // Show helper: a section is visible only when it's the active tab, and when it
  // IS active it plays a soft fade-in so switching tabs feels alive (fixes the
  // 'monotonous' read) rather than a hard swap.
  const show = (id: string) =>
    active === id ? "motion-safe:animate-[dna-tab-in_0.5s_cubic-bezier(0.16,1,0.3,1)_both]" : "hidden"
  const maxSnps = Math.max(...data.chromosomes.map((c) => c.snps))
  const { homozygous, heterozygous, noCall } = data.genotypeClasses
  const totalCalls = homozygous + heterozygous + noCall || 1
  const hetPct = ((heterozygous / totalCalls) * 100).toFixed(1)
  const homPct = ((homozygous / totalCalls) * 100).toFixed(1)

  const legend = [
    { base: "A", name: "Adenine", color: "#f5b942", pair: "T" },
    { base: "C", name: "Cytosine", color: "#4ad6c4", pair: "G" },
    { base: "G", name: "Guanine", color: "#7c6cf0", pair: "C" },
    { base: "T", name: "Thymine", color: "#f06c8d", pair: "A" },
  ]

  const hasTraits = Boolean(data.traits && Object.keys(data.traits).length > 0)

  return (
    <div>
      {/* L1 / L2 tabbed navigation — one focused view at a time. */}
      <DnaTabs active={active} onChange={pick} />

      {/* Hero / At-a-glance */}
      <div className={show("hero")}>
        <DnaHero data={data} showNav={false} />
      </div>

      {/* How to read it — Blender diagram + legend */}
      <section id="how-dna-works" className={show("how-dna-works")}>
        <div className="flex items-baseline gap-4 mb-6">
          <span aria-hidden className="block w-12 h-px bg-accent" />
          <h2 className="font-display text-2xl md:text-3xl font-light tracking-[-0.01em]">
            How to read it
          </h2>
        </div>
        <div className="grid md:grid-cols-2 gap-8 md:gap-10 items-center">
          <div className="rounded-lg border border-border bg-secondary/20 p-4">
            <img
              src="/img/dna/helix-diagram.png"
              alt="Labeled double-helix diagram: two backbone strands connected by colored base-pair rungs"
              loading="lazy"
              decoding="async"
              className="w-full h-auto"
            />
          </div>
          <div className="space-y-5">
            <p className="font-sans text-sm md:text-base text-foreground/75 leading-relaxed">
              DNA is two strands wound into a double helix, held together by
              rungs. Each rung is a <strong>base pair</strong> — one of four
              nucleotides (A, C, G, T) bonded to its partner (A–T, C–G). The
              order of those letters is your genetic code.
            </p>
            <ul className="grid grid-cols-2 gap-3">
              {legend.map((l) => (
                <li
                  key={l.base}
                  className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2.5"
                >
                  <span
                    aria-hidden
                    className="h-3.5 w-3.5 rounded-full shrink-0"
                    style={{ backgroundColor: l.color }}
                  />
                  <span className="font-mono text-xs">
                    <span style={{ color: l.color }}>{l.base}</span>
                    <span className="text-muted-foreground"> pairs with {l.pair}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="font-sans text-sm text-foreground/60 leading-relaxed">
              The live render below maps your actual sampled base pairs onto this
              structure — colour by nucleotide, thicker rungs where your two
              inherited copies differ.
            </p>
          </div>
        </div>
      </section>

      {/* How DNA works + human evolution — teach the mechanism under the data. */}
      <div id="dna-evolution" className={show("dna-evolution")}>
        <DnaExplainer />
      </div>

      {/* Origins — the ancestry / migration story your variants trace. */}
      {hasTraits && (
        <div id="dna-origins" className={show("dna-origins")}>
          <DnaOrigins traits={data.traits!} />
        </div>
      )}

      {/* Personalized plan — supplements, diet, habits, and things to avoid. */}
      {hasTraits && (
        <div id="dna-plan" className={show("dna-plan")}>
          <DnaPlan traits={data.traits!} />
        </div>
      )}

      {/* Build type — the body-type lean, with the full spectrum per axis. */}
      {hasTraits && (
        <div id="dna-body-type" className={show("dna-body-type")}>
          <DnaBodyType traits={data.traits!} />
        </div>
      )}

      {/* You vs. the average — put the numbers in human context */}
      <div id="dna-compare" className={show("dna-compare")}>
        <DnaCompare data={data} />
      </div>

      {/* Traits — radar + the full panel together under one tab */}
      {hasTraits && (
        <div id="dna-traits" className={`space-y-16 ${show("dna-traits")}`}>
          <DnaRadar traits={data.traits!} />
          <DnaTraits traits={data.traits!} />
        </div>
      )}

      {/* Inheritance — what passes to the next generation */}
      {hasTraits && (
        <div id="dna-inheritance" className={show("dna-inheritance")}>
          <DnaInheritance traits={data.traits!} />
        </div>
      )}

      {/* Helix — switchable between the live 3D render and the illustration */}
      <section id="dna-helix" className={show("dna-helix")}>
        <div className="flex flex-wrap items-baseline justify-between gap-4 mb-6">
          <div className="flex items-baseline gap-4">
            <span aria-hidden className="block w-12 h-px bg-accent" />
            <h2 className="font-display text-2xl md:text-3xl font-light tracking-[-0.01em]">
              The double helix
            </h2>
          </div>
          {/* View switcher */}
          <div className="inline-flex rounded-full border border-border p-0.5 bg-background">
            {([
              ["3d", "3D interactive"],
              ["illustrated", "Illustrated"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setHelixView(key)}
                data-cursor-hover
                aria-pressed={helixView === key}
                className={`
                  font-mono text-[10px] tracking-widest uppercase px-3 py-2 rounded-full min-h-9
                  transition-colors
                  ${helixView === key ? "bg-accent/15 text-accent" : "text-muted-foreground hover:text-foreground"}
                `}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <p className="max-w-2xl mb-5 font-sans text-sm md:text-base text-foreground/75 leading-relaxed">
          {helixView === "3d" ? (
            <>
              A live render of {fmt(data.sample.length)} sampled base pairs from
              your genome. Each rung is one pair; colour encodes the nucleotide.
              Thicker rungs mark heterozygous pairs — the spots where your two
              inherited copies differ.
            </>
          ) : (
            <>
              The classic double-helix diagram. Two sugar-phosphate backbones
              twist around base pairs; each pair is two complementary nucleotides
              bonded across the middle (A–T, C–G). The order of these letters
              along the strand is the genetic code.
            </>
          )}
        </p>

        {/* Per-base legend — explains each nucleotide / strand */}
        <ul className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {legend.map((l) => (
            <li
              key={l.base}
              className="flex items-center gap-2.5 rounded-md border border-border bg-background px-3 py-2"
            >
              <span
                aria-hidden
                className="h-3.5 w-3.5 rounded-sm shrink-0"
                style={{ backgroundColor: l.color }}
              />
              <span className="font-mono text-[11px] leading-tight">
                <span style={{ color: l.color }}>{l.base}</span>
                <span className="text-muted-foreground"> · {l.name}</span>
                <br />
                <span className="text-muted-foreground/70">pairs {l.pair}</span>
              </span>
            </li>
          ))}
        </ul>

        {helixView === "3d" ? (
          <div className="relative h-[60vh] min-h-[420px] w-full rounded-lg border border-border bg-secondary/20 overflow-hidden">
            <DnaHelix sample={data.sample} />
          </div>
        ) : (
          <div className="relative w-full overflow-hidden rounded-lg border border-border bg-secondary/20 grid place-items-center py-10 md:py-14">
            {/* soft glow behind the helix so it reads as luminous, not a flat PNG */}
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl opacity-40"
              style={{ background: "radial-gradient(circle, color-mix(in oklch, var(--accent) 35%, transparent), transparent 70%)" }}
            />
            {/* gentle float so the illustration has life without the 3D cost */}
            <img
              src="/img/dna/helix-illustrated.png"
              alt="Illustrated double helix: two backbones with colour-coded base-pair rungs (A amber, C teal, G violet, T rose)"
              loading="lazy"
              decoding="async"
              className="relative max-h-[54vh] w-auto motion-safe:animate-[dna-float_6s_ease-in-out_infinite] drop-shadow-[0_10px_40px_rgba(0,0,0,0.25)]"
            />
            <p className="relative mt-6 max-w-md text-center font-sans text-xs text-muted-foreground/70 leading-relaxed">
              Prefer it live? Switch to <button type="button" onClick={() => setHelixView("3d")} className="text-accent underline underline-offset-2 hover:text-foreground transition-colors">3D interactive</button> to rotate + explore your actual sampled base pairs.
            </p>
          </div>
        )}
      </section>

      {/* Stat strip */}
      <section className={`mt-16 grid grid-cols-2 md:grid-cols-4 gap-px bg-border border border-border rounded-md overflow-hidden ${show("dna-helix")}`}>
        {[
          { label: "Total SNPs", value: fmt(data.meta.totalSnps) },
          { label: "Chromosomes", value: String(data.chromosomes.length) },
          { label: "Heterozygous", value: `${hetPct}%` },
          { label: "Homozygous", value: `${homPct}%` },
        ].map((s) => (
          <div key={s.label} className="bg-background p-5 md:p-6">
            <p className="font-mono text-[10px] tracking-widest uppercase text-accent mb-2">
              {s.label}
            </p>
            <p className="font-display text-2xl md:text-3xl font-light tabular-nums">
              {s.value}
            </p>
          </div>
        ))}
      </section>

      {/* Chromosome map */}
      <section className={`mt-16 ${show("dna-helix")}`}>
        <div className="flex items-baseline gap-4 mb-6">
          <span aria-hidden className="block w-12 h-px bg-accent" />
          <h2 className="font-display text-2xl md:text-3xl font-light tracking-[-0.01em]">
            Chromosome map
          </h2>
        </div>
        <p className="max-w-2xl mb-8 font-sans text-sm md:text-base text-foreground/75 leading-relaxed">
          SNPs measured per chromosome. Bar length is the SNP count; the amber
          tip shows that chromosome&apos;s heterozygosity — how much of it varies
          between your two copies.
        </p>
        <ul className="space-y-2.5">
          {data.chromosomes.map((c, i) => (
            <motion.li
              key={c.name}
              initial={{ opacity: 0, x: -12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: Math.min(i * 0.02, 0.4) }}
              className="grid grid-cols-[2.5rem_1fr_4.5rem] items-center gap-3"
            >
              <span className="font-mono text-xs text-muted-foreground text-right">
                {c.name}
              </span>
              <div className="relative h-4 rounded-full bg-secondary/40 overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-foreground/25"
                  style={{ width: `${(c.snps / maxSnps) * 100}%` }}
                />
                {/* heterozygosity overlay — amber, proportional within the bar */}
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-accent/70"
                  style={{ width: `${(c.snps / maxSnps) * 100 * c.heterozygosity}%` }}
                />
              </div>
              <span className="font-mono text-[10px] text-foreground/60 tabular-nums text-right">
                {fmt(c.snps)}
              </span>
            </motion.li>
          ))}
        </ul>
      </section>

      {/* Sources & study material — the science, references, and learn-more. */}
      <section id="dna-sources" className={show("dna-sources")}>
        <div className="flex items-baseline gap-4 mb-3">
          <span aria-hidden className="block w-12 h-px bg-accent" />
          <h2 className="font-display text-2xl md:text-3xl font-light tracking-[-0.01em]">
            Sources &amp; study material
          </h2>
        </div>
        <p className="max-w-2xl mb-6 font-sans text-sm md:text-base text-foreground/75 leading-relaxed">
          Every claim here traces to a public dataset, and every trait card links
          to its dbSNP record + the published paper. Want to go deeper? A curated
          learn-more path — from &ldquo;what is a gene&rdquo; to the machine-learning
          methods reading genomes today.
        </p>
        <a
          href="/dna/databases"
          className="mb-10 inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-2 font-mono text-[10px] tracking-widest uppercase text-accent hover:bg-accent hover:text-white transition-colors"
        >
          Open the full sources &amp; databases page ↗
        </a>
        <DnaStudy />
      </section>


      {/* Provenance */}
      <section className="mt-16 rounded-md border border-border bg-secondary/20 p-6 md:p-8">
        <p className="font-mono text-[10px] tracking-widest uppercase text-accent mb-3">
          Provenance
        </p>
        <p className="max-w-2xl font-sans text-sm text-foreground/70 leading-relaxed">
          Source: {data.meta.source}. Derived {new Date(data.meta.derivedAt).toLocaleDateString()}.
          {" "}
          {data.meta.note}
        </p>
      </section>
    </div>
  )
}
