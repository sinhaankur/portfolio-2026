"use client"

/**
 * DnaDeepDive — the validated, cited "deep dive" for a single variant.
 *
 * DNA is the source of truth: the answer is in the genetics itself. So this
 * leads with what the variant DOES at the molecular level (its consequence +
 * protein change), then the established ClinVar associations, then how common
 * each allele is across reference cohorts — explicitly framed as "how common",
 * NOT an ancestry/geography verdict about you. Location doesn't decide your
 * genotype; your genotype is what it is.
 *
 * Every field is auto-pulled + validated from open APIs (dbSNP · ClinVar ·
 * gnomAD via MyVariant.info) by scripts/fetch-dna-annotations.mjs, and every
 * record links out to the primary source as proof.
 */

import { DNA_ANNOTATIONS } from "@/lib/dna-annotations"

/** Turn API consequence codes into plain English. */
function humanConsequence(c: string | null): { label: string; plain: string } | null {
  if (!c) return null
  const key = c.toUpperCase()
  const map: Record<string, string> = {
    NON_SYNONYMOUS: "changes an amino acid in the protein — so the protein itself works differently",
    SYNONYMOUS: "a silent letter change — the protein is unchanged",
    INTRONIC: "sits in a non-coding region that regulates HOW MUCH of the gene is made, rather than the protein's shape",
    STOP_GAINED: "cuts the protein short — usually disabling it",
    "5_PRIME_UTR": "sits in the gene's regulatory start region — tunes how much is produced",
    "3_PRIME_UTR": "sits in the gene's regulatory tail — affects stability/amount",
    REGULATORY: "regulatory — changes how much of the gene is expressed",
    SPLICE_SITE: "alters how the gene is spliced together",
    UPSTREAM: "upstream of the gene — can influence its expression",
    DOWNSTREAM: "downstream of the gene — can influence its expression",
  }
  const plain = map[key] ?? `${c.replace(/_/g, " ").toLowerCase()} variant`
  const label = key.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase())
  return { label, plain }
}

/** Colour a ClinVar significance term. */
function sigTone(sig: string): string {
  const s = sig.toLowerCase()
  if (/pathogenic/.test(s) && !/likely benign|benign/.test(s)) return "text-[#f06c8d] border-[#f06c8d]/40 bg-[#f06c8d]/[0.07]"
  if (/risk factor|drug response/.test(s)) return "text-accent border-accent/40 bg-accent/[0.07]"
  if (/protective|benign/.test(s)) return "text-emerald-300 border-emerald-500/30 bg-emerald-500/[0.06]"
  return "text-foreground/70 border-border bg-background/40"
}

export function DnaDeepDive({ rsid }: { rsid: string }) {
  const a = DNA_ANNOTATIONS[rsid]
  if (!a || a.missing || a.error) return null

  const cons = humanConsequence(a.consequence)
  const maxFreq = Math.max(0.01, ...a.freqs.map((f) => f.freq))

  return (
    <div className="rounded-lg border border-accent/25 bg-accent/[0.04] p-4 md:p-5 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-accent">
          Deep dive · validated
        </p>
        <span className="font-mono text-[10px] tracking-wider text-foreground/50">
          {a.gene}
          {a.chrom ? ` · chr${a.chrom}` : ""}
        </span>
      </div>

      {/* What the variant DOES — the genetics itself, the source of truth. */}
      {cons && (
        <div>
          <p className="font-mono text-[10px] tracking-widest uppercase text-foreground/60 mb-1.5">
            What this variant does
          </p>
          <p className="font-sans text-sm text-foreground/85 leading-relaxed">
            It&apos;s a <span className="text-accent">{cons.label.toLowerCase()}</span> change
            {a.proteinChange ? (
              <> (<span className="font-mono text-xs text-foreground/70">{a.proteinChange}</span>)</>
            ) : null}{" "}
            — it {cons.plain}.
            {a.geneName ? (
              <>
                {" "}
                <span className="text-foreground/60">{a.gene}</span> is the{" "}
                <span className="text-foreground/70">{a.geneName}</span> gene.
              </>
            ) : null}
          </p>
        </div>
      )}

      {/* Functional-impact prediction — for coding variants, do the algorithms
          think the amino-acid change harms the protein? Honest: these are
          computational predictions (SIFT, PolyPhen), not verdicts. */}
      {a.impact && (a.impact.sift || a.impact.polyphen) && (
        <div>
          <p className="font-mono text-[10px] tracking-widest uppercase text-foreground/60 mb-2">
            Predicted effect on the protein
          </p>
          <div className="flex flex-wrap gap-1.5">
            {a.impact.sift && (
              <span className={`rounded-full border px-2.5 py-1 font-mono text-[10px] tracking-wider ${
                a.impact.sift === "deleterious"
                  ? "text-[#f06c8d] border-[#f06c8d]/40 bg-[#f06c8d]/[0.07]"
                  : "text-emerald-300 border-emerald-500/30 bg-emerald-500/[0.06]"
              }`}>
                SIFT · {a.impact.sift}
              </span>
            )}
            {a.impact.polyphen && (
              <span className={`rounded-full border px-2.5 py-1 font-mono text-[10px] tracking-wider ${
                /damaging/.test(a.impact.polyphen) && !/possibly/.test(a.impact.polyphen)
                  ? "text-[#f06c8d] border-[#f06c8d]/40 bg-[#f06c8d]/[0.07]"
                  : /possibly/.test(a.impact.polyphen)
                    ? "text-accent border-accent/40 bg-accent/[0.07]"
                    : "text-emerald-300 border-emerald-500/30 bg-emerald-500/[0.06]"
              }`}>
                PolyPhen · {a.impact.polyphen}
              </span>
            )}
          </div>
          <p className="mt-1.5 font-sans text-[11px] text-foreground/55 leading-relaxed">
            Computational predictions of whether the amino-acid change disrupts the
            protein — a signal, not a diagnosis.
          </p>
        </div>
      )}

      {/* Established clinical associations — known types only. */}
      {a.clinvar.length > 0 && (
        <div>
          <p className="font-mono text-[10px] tracking-widest uppercase text-foreground/60 mb-2">
            Established associations · ClinVar
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {a.clinvar.map((c, i) => (
              <li
                key={i}
                className={`rounded-full border px-2.5 py-1 font-mono text-[10px] tracking-wider ${sigTone(c.significance)}`}
                title={c.significance}
              >
                <span className="uppercase">{c.significance}</span>
                <span className="opacity-70"> · {c.condition.toLowerCase()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* How common — reference cohorts, explicitly NOT an ancestry verdict. */}
      {a.freqs.length > 0 && (
        <div>
          <p className="font-mono text-[10px] tracking-widest uppercase text-foreground/60 mb-1">
            How common is this variant
          </p>
          <p className="font-sans text-[11px] text-foreground/55 leading-relaxed mb-3">
            Frequency of the notable allele across reference cohorts — this is
            &ldquo;how common,&rdquo; not a statement about <em>your</em> ancestry.
            Geography is context; your genotype is the truth.
          </p>
          <ul className="space-y-1.5">
            {a.freqs.map((f) => (
              <li key={f.cohort} className="grid grid-cols-[8.5rem_1fr_3rem] items-center gap-2">
                <span className="font-sans text-xs text-foreground/70 truncate">{f.cohort}</span>
                <span className="relative h-2 rounded-full bg-secondary/40 overflow-hidden">
                  <span
                    className="absolute inset-y-0 left-0 rounded-full bg-accent/70"
                    style={{ width: `${(f.freq / maxFreq) * 100}%` }}
                  />
                </span>
                <span className="font-mono text-[10px] text-foreground/60 tabular-nums text-right">
                  {f.allele} {(f.freq * 100).toFixed(1)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Proof — every claim above links to its primary source. */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1 font-mono text-[10px] tracking-wider">
        <span className="text-foreground/45 uppercase">Proof:</span>
        {[
          ["dbSNP", a.sources.dbsnp],
          ["ClinVar", a.sources.clinvar],
          ["gnomAD", a.sources.gnomad],
          ["Ensembl", a.sources.ensembl],
        ].map(([label, href]) => (
          <a
            key={label}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent/80 hover:text-accent underline underline-offset-2 decoration-dotted"
          >
            {label} ↗
          </a>
        ))}
      </div>
    </div>
  )
}
