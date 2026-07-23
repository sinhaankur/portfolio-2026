import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, ExternalLink } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { CustomCursor } from "@/components/custom-cursor"
import { Container } from "@/components/container"
import { canonicalPath } from "@/lib/seo"
import { DNA_DATABASES, DNA_PRINCIPLES } from "@/lib/dna-databases"
import { DnaStudy } from "@/components/dna/dna-study"

// Public — this is methodology + references only, no personal genome. Making it
// indexable shows the rigour and lets anyone verify the science.
export const metadata: Metadata = {
  ...canonicalPath("/dna/databases"),
  title: "The data behind the DNA read — sources & databases",
  description:
    "The public scientific datasets the DNA trait interpretations are built on: dbSNP, the GWAS Catalog, ClinVar, and PharmGKB — what each is, its coverage, its licence, and how it's used. Open sources only; association, not destiny.",
}

export default function DnaDatabasesPage() {
  const used = DNA_DATABASES.filter((d) => d.status === "used")
  const avoided = DNA_DATABASES.filter((d) => d.status === "avoided")

  return (
    <>
      <CustomCursor />
      <Navbar />
      <main id="main" className="relative min-h-screen bg-background text-foreground pt-28 pb-24">
        <Container>
          <div className="max-w-3xl">
            <Link
              href="/dna"
              data-cursor-hover
              className="group inline-flex items-center gap-2 font-mono text-[10px] tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors mb-8"
            >
              <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
              Back to the genome
            </Link>

            <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-accent mb-4">
              DNA · Sources & databases
            </p>
            <h1 className="font-display text-3xl md:text-5xl font-light tracking-[-0.02em] leading-[1.05]">
              The data behind the read.
            </h1>
            <p className="mt-5 font-sans text-base md:text-lg text-foreground/75 leading-relaxed">
              Nothing on the DNA page is asked to be taken on faith. Every trait
              interpretation traces to a public scientific dataset — here&apos;s
              each one, what it covers, its licence, and exactly how it&apos;s
              used. Open sources only; association, never destiny.
            </p>
          </div>

          {/* Principles */}
          <div className="mt-14 grid md:grid-cols-2 gap-4 max-w-4xl">
            {DNA_PRINCIPLES.map((p) => (
              <div key={p.title} className="rounded-xl border border-border bg-card/40 p-5">
                <h2 className="font-display text-lg font-light text-foreground mb-2">{p.title}</h2>
                <p className="font-sans text-sm text-foreground/70 leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>

          {/* Open dataset — the repo others can use. The whole read is extracted
              into a public, cited dataset + pipeline anyone can build on. */}
          <a
            href="https://github.com/sinhaankur/open-genome-atlas"
            target="_blank"
            rel="noopener noreferrer"
            data-cursor-hover
            className="group mt-16 block max-w-4xl rounded-2xl border border-accent/40 bg-accent/[0.06] p-6 md:p-8 hover:bg-accent/10 transition-colors"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-accent">
                Open dataset · use it yourself
              </p>
              <span className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-widest uppercase text-accent group-hover:text-foreground transition-colors">
                github.com/sinhaankur/open-genome-atlas
                <ExternalLink className="w-3 h-3" />
              </span>
            </div>
            <h2 className="mt-3 font-display text-2xl md:text-3xl font-light text-foreground">
              open-genome-atlas
            </h2>
            <p className="mt-3 font-sans text-sm md:text-base text-foreground/75 leading-relaxed max-w-2xl">
              Every read on this page is extracted into a public, cited dataset —
              per-variant genetics (gene, molecular consequence, ClinVar,
              population frequency) plus curated diet/lifestyle/region evidence,
              each linking its primary source. Plain JSON + a zero-dependency
              pipeline, so anyone building genomics tools can reference or extend
              it. MIT (code) · CC0 (data). Grows over time.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {["dbSNP", "ClinVar", "gnomAD", "Ensembl", "PubMed"].map((s) => (
                <span key={s} className="rounded-full border border-border bg-background/40 px-2.5 py-1 font-mono text-[10px] tracking-wider text-foreground/70">
                  {s}
                </span>
              ))}
            </div>
          </a>

          {/* Used databases */}
          <div className="mt-16 max-w-4xl">
            <div className="flex items-baseline gap-4 mb-8">
              <span aria-hidden className="block w-12 h-px bg-accent" />
              <h2 className="font-display text-2xl md:text-3xl font-light tracking-[-0.01em]">
                The datasets used
              </h2>
            </div>
            <div className="space-y-5">
              {used.map((d) => (
                <DatabaseCard key={d.id} db={d} />
              ))}
            </div>
          </div>

          {/* Deliberately avoided */}
          {avoided.length > 0 && (
            <div className="mt-16 max-w-4xl">
              <div className="flex items-baseline gap-4 mb-8">
                <span aria-hidden className="block w-12 h-px bg-amber-400/70" />
                <h2 className="font-display text-2xl md:text-3xl font-light tracking-[-0.01em]">
                  Referenced, not reproduced
                </h2>
              </div>
              <div className="space-y-5">
                {avoided.map((d) => (
                  <DatabaseCard key={d.id} db={d} />
                ))}
              </div>
            </div>
          )}

          {/* Study materials + documentation — go deeper */}
          <div className="mt-20 max-w-4xl">
            <div className="flex items-baseline gap-4 mb-3">
              <span aria-hidden className="block w-12 h-px bg-accent" />
              <h2 className="font-display text-2xl md:text-3xl font-light tracking-[-0.01em]">
                Study materials &amp; documentation
              </h2>
            </div>
            <p className="font-sans text-sm md:text-base text-foreground/70 leading-relaxed max-w-2xl mb-10">
              Want to learn it properly? A curated path from &ldquo;what is a
              gene&rdquo; to the machine-learning methods reading genomes today —
              how DNA works, the databases + published studies, human origins, the
              types of genome study, and the ML/pattern-recognition frontier. All
              free, all authoritative.
            </p>
            <DnaStudy />
          </div>

          <p className="mt-16 max-w-3xl font-sans text-sm text-muted-foreground leading-relaxed">
            This page carries no personal genetic data. The genome itself is never
            shipped — only a derived, encrypted, non-reconstructable summary reaches
            the browser and is decrypted locally with a password. The methodology,
            though, is open: that&apos;s the whole point of putting it here.
          </p>
        </Container>
      </main>
      <Footer hideContact />
    </>
  )
}

function DatabaseCard({ db }: { db: (typeof DNA_DATABASES)[number] }) {
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-5 md:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h3 className="font-display text-xl md:text-2xl font-light text-foreground">{db.name}</h3>
          <span className="font-mono text-[10px] tracking-wider uppercase text-accent/80">{db.short}</span>
        </div>
        <span className="font-mono text-[10px] tracking-wider text-muted-foreground">{db.by}</span>
      </div>

      <p className="mt-3 font-sans text-sm text-foreground/80 leading-relaxed">{db.about}</p>

      <dl className="mt-4 grid sm:grid-cols-2 gap-x-6 gap-y-3">
        <Field label="Coverage" value={db.coverage} />
        <Field label="Licence" value={db.license} />
        <Field label="How it's used here" value={db.usage} full />
      </dl>

      {db.statusNote && (
        <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2 font-sans text-xs text-foreground/70 leading-relaxed">
          {db.statusNote}
        </p>
      )}

      <a
        href={db.url}
        target="_blank"
        rel="noopener noreferrer"
        data-cursor-hover
        className="mt-4 inline-flex items-center gap-1.5 font-mono text-[10px] tracking-widest uppercase text-accent hover:text-foreground transition-colors"
      >
        Visit {db.name}
        <ExternalLink className="w-3 h-3" />
      </a>
    </div>
  )
}

function Field({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <dt className="font-mono text-[9px] tracking-[0.16em] uppercase text-muted-foreground mb-1">{label}</dt>
      <dd className="font-sans text-sm text-foreground/75 leading-relaxed">{value}</dd>
    </div>
  )
}
