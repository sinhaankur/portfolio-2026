import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, FileText, Cpu, Sparkles, ShieldCheck } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { CustomCursor } from "@/components/custom-cursor"
import { Container } from "@/components/container"
import { canonicalPath } from "@/lib/seo"

// Public — the whole point is to explain the engine WITHOUT any personal data.
// Indexable, like /dna/databases and /dna/tools.
export const metadata: Metadata = {
  ...canonicalPath("/dna/how-it-works"),
  title: "How the DNA engine works — read, match, show, on your device",
  description:
    "What the DNA reader does with a raw genotype file: parsed entirely in your browser (never uploaded), matched against open scientific databases, and turned into readable traits, a plan, ancestry, and tools. The pipeline, the outputs, and the privacy model — no personal data required.",
}

const STEPS = [
  {
    icon: FileText,
    step: "1 · Read",
    title: "Your file is parsed in the browser",
    body:
      "You drop a raw genotype file — the .txt or .csv you download from MyHeritage, 23andMe, or AncestryDNA. It's just a long list of positions and the letters you carry there. JavaScript reads it in the tab. There is no server to upload to, so nothing is uploaded. It's gone when you close the tab.",
  },
  {
    icon: Cpu,
    step: "2 · Match",
    title: "Matched against open databases",
    body:
      "Only a small, curated set of well-studied markers is read; the rest of the file is ignored. Each is looked up against public scientific data — dbSNP, ClinVar, gnomAD, the GWAS Catalog, PharmGKB — and the published papers behind them. Every interpretation traces to a citation, not an opinion.",
  },
  {
    icon: Sparkles,
    step: "3 · Show",
    title: "Turned into something readable",
    body:
      "The matched markers become a trait panel, a personalized plan, a build-type read, an ancestry journey through deep time, and a live 3D render of your own sampled base pairs. Each claim links its source. Nothing is a diagnosis — it's an exploration.",
  },
]

const OUTPUTS = [
  { name: "Traits", body: "What your genotype at each marker is associated with — across diet, fitness, skin, wellness, physical and pharmacogenomic categories — with the everyday meaning, not just the rsID." },
  { name: "Your plan", body: "The trait reads turned into concrete, low-stakes suggestions: what your variants suggest you respond to, framed as tendencies to test, never prescriptions." },
  { name: "Build type", body: "Where your markers lean on each body-type axis, shown as a spectrum so you can see what a different genotype would read too." },
  { name: "Origins & deep-time journey", body: "The migration story your ancestry-informative variants trace, on a log-scaled timeline from human origins ~300,000 years ago to today." },
  { name: "The helix", body: "A live 3D double helix built from a sample of your actual base pairs — coloured by nucleotide, thicker where your two inherited copies differ." },
  { name: "DNA tools", body: "Interactive genealogy tools — a cM-to-relationship explainer, an ethnicities map, a chromosome browser, and match clustering." },
]

export default function DnaHowItWorksPage() {
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
              DNA · How it works
            </p>
            <h1 className="font-display text-3xl md:text-5xl font-light tracking-[-0.02em] leading-[1.05]">
              What it does with your DNA.
            </h1>
            <p className="mt-5 font-sans text-base md:text-lg text-foreground/75 leading-relaxed">
              This is a DNA reader that runs entirely in your browser. You give it
              a raw genotype file; it reads a curated set of well-studied markers,
              matches them against open science, and turns them into something
              readable. Your file never leaves the tab. Here&apos;s the whole
              pipeline — no upload needed to understand it.
            </p>

            {/* Pipeline */}
            <h2 className="mt-16 mb-6 font-display text-2xl md:text-3xl font-light tracking-[-0.01em]">
              The pipeline
            </h2>
            <ol className="grid gap-4 md:grid-cols-3">
              {STEPS.map((s) => (
                <li key={s.step} className="rounded-xl border border-border bg-card/40 p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <s.icon className="h-4 w-4 text-accent" aria-hidden />
                    <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-accent">{s.step}</span>
                  </div>
                  <h3 className="font-display text-base font-light text-foreground leading-snug mb-1.5">{s.title}</h3>
                  <p className="font-sans text-[13px] text-foreground/70 leading-relaxed">{s.body}</p>
                </li>
              ))}
            </ol>

            {/* At a glance */}
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-px bg-border border border-border rounded-xl overflow-hidden">
              {[
                { n: "41", label: "markers read" },
                { n: "5", label: "open databases" },
                { n: "100%", label: "on your device" },
                { n: "0", label: "uploads · ever" },
              ].map((s) => (
                <div key={s.label} className="bg-background p-4 text-center">
                  <div className="font-display text-2xl font-light text-foreground tabular-nums">{s.n}</div>
                  <div className="mt-1 font-mono text-[9px] tracking-[0.14em] uppercase text-muted-foreground leading-tight">{s.label}</div>
                </div>
              ))}
            </div>

            {/* What you get */}
            <h2 className="mt-16 mb-6 font-display text-2xl md:text-3xl font-light tracking-[-0.01em]">
              What it shows you
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {OUTPUTS.map((o) => (
                <div key={o.name} className="rounded-xl border border-border bg-card/40 p-5">
                  <div className="font-display text-lg font-light text-foreground mb-1.5">{o.name}</div>
                  <p className="font-sans text-sm text-foreground/70 leading-relaxed">{o.body}</p>
                </div>
              ))}
            </div>

            {/* Privacy */}
            <div className="mt-16 rounded-2xl border border-accent/30 bg-accent/[0.05] p-6 md:p-8">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="h-4 w-4 text-accent" aria-hidden />
                <h2 className="font-mono text-[11px] tracking-[0.2em] uppercase text-accent">The privacy model</h2>
              </div>
              <p className="font-sans text-sm md:text-base text-foreground/80 leading-relaxed">
                There is no account, no server, and no database of users. The file
                is read locally by JavaScript and discarded when you clear it or
                close the tab — it is never uploaded, stored, sold, or sent
                anywhere. That&apos;s not a policy promise; it&apos;s the
                architecture. It&apos;s also why the personal results can&apos;t be
                shown here without your file: this public page is the engine and
                the method, not anyone&apos;s genome.
              </p>
            </div>

            {/* Honest limits */}
            <div className="mt-6 rounded-2xl border border-border bg-secondary/20 p-6 md:p-8">
              <h2 className="font-mono text-[11px] tracking-[0.2em] uppercase text-muted-foreground mb-3">Honest limits</h2>
              <p className="font-sans text-sm text-foreground/75 leading-relaxed">
                Everything here is an <em>association</em>, not a verdict. A
                consumer genotyping file can&apos;t assess serious clinical
                mutations, and raw direct-to-consumer data carries real error
                rates — so surprising results are prompts to ask a clinician, not
                conclusions. The interpretations come from public datasets and
                published research, each linked on its card. Association, never
                destiny.
              </p>
            </div>

            {/* CTAs */}
            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                href="/dna"
                className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-2 font-mono text-[10px] tracking-widest uppercase text-accent hover:bg-accent hover:text-white transition-colors"
              >
                Try it with your file ↗
              </Link>
              <Link
                href="/dna/databases"
                className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 font-mono text-[10px] tracking-widest uppercase text-foreground/80 hover:border-accent/50 hover:text-foreground transition-colors"
              >
                The data behind the read ↗
              </Link>
              <Link
                href="/dna/tools"
                className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 font-mono text-[10px] tracking-widest uppercase text-foreground/80 hover:border-accent/50 hover:text-foreground transition-colors"
              >
                DNA tools ↗
              </Link>
            </div>
          </div>
        </Container>
      </main>
      <Footer />
    </>
  )
}
