import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { CustomCursor } from "@/components/custom-cursor"
import { Container } from "@/components/container"
import { canonicalPath } from "@/lib/seo"
import { CmExplainer } from "@/components/dna/tools/cm-explainer"
import { EthnicitiesMap } from "@/components/dna/tools/ethnicities-map"
import { ChromosomeBrowser } from "@/components/dna/tools/chromosome-browser"
import { AutoClusters } from "@/components/dna/tools/auto-clusters"

// Public — these are educational/interactive tools with no personal genome data
// (the segment tools run on a synthetic demo unless a local overlay is present).
// Indexable so the tooling shows, like /dna/databases.
export const metadata: Metadata = {
  ...canonicalPath("/dna/tools"),
  title: "DNA Tools — cM Explainer, Ethnicities Map, Chromosome Browser, AutoClusters",
  description:
    "Interactive DNA tools: turn shared centimorgans into likely relationships, explore which ancestries are common where, paint shared DNA segments across chromosomes, and cluster matches into shared-ancestor groups. Educational; no personal data required.",
}

const TOOLS = [
  { id: "cm-explainer", name: "cM Explainer", desc: "Turn a shared-DNA amount (centimorgans) into the relationships it's consistent with, ranked by fit." },
  { id: "ethnicities-map", name: "Ethnicities Map", desc: "Which ancestries are most common in each region — and where each ancestry is concentrated." },
  { id: "chromosome-browser", name: "Chromosome Browser", desc: "Paint the DNA segments you share with matches across all 23 chromosomes; overlaps hint at a common ancestor." },
  { id: "auto-clusters", name: "AutoClusters", desc: "Group matches who also match each other into likely shared-ancestor clusters." },
]

export default function DnaToolsPage() {
  return (
    <>
      <CustomCursor />
      <Navbar />
      <main id="main" className="relative min-h-screen bg-background text-foreground pt-28 pb-24">
        <Container>
          <div className="max-w-4xl">
            <Link
              href="/dna"
              data-cursor-hover
              className="group inline-flex items-center gap-2 font-mono text-[10px] tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors mb-8"
            >
              <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
              Back to the genome
            </Link>

            <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-accent mb-4">
              DNA · Tools
            </p>
            <h1 className="font-display text-3xl md:text-5xl font-light tracking-[-0.02em] leading-[1.05]">
              DNA tools.
            </h1>
            <p className="mt-5 font-sans text-base md:text-lg text-foreground/75 leading-relaxed max-w-2xl">
              Four interactive tools for making sense of DNA. The first two need no
              data at all — they teach the ideas. The segment tools run on a
              synthetic demo here; drop your own match export in locally to see
              your real results. Nothing is uploaded or stored.
            </p>

            {/* quick index */}
            <nav className="mt-8 grid gap-3 sm:grid-cols-2" aria-label="Tools">
              {TOOLS.map((t) => (
                <a
                  key={t.id}
                  href={`#${t.id}`}
                  data-cursor-hover
                  className="rounded-xl border border-border bg-card/40 p-4 transition-colors hover:border-accent/50"
                >
                  <div className="font-display text-lg font-light text-foreground">{t.name}</div>
                  <p className="mt-1 font-sans text-sm text-foreground/65 leading-relaxed">{t.desc}</p>
                </a>
              ))}
            </nav>

            {/* the tools */}
            <div className="mt-12 space-y-12">
              <section id="cm-explainer" className="scroll-mt-28">
                <CmExplainer />
              </section>
              <section id="ethnicities-map" className="scroll-mt-28">
                <EthnicitiesMap />
              </section>
              <section id="chromosome-browser" className="scroll-mt-28">
                <ChromosomeBrowser />
              </section>
              <section id="auto-clusters" className="scroll-mt-28">
                <AutoClusters />
              </section>
            </div>
          </div>
        </Container>
      </main>
      <Footer />
    </>
  )
}
