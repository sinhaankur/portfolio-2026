/**
 * DnaExplainer — "how DNA actually works" + "DNA & human evolution".
 *
 * The trait panel tells you what YOUR variants mean; this section teaches the
 * mechanism underneath, so the numbers on the page are legible rather than
 * magic. Intuitive, honest, and grounded in the real biology — genes are one
 * input among many, and variation is the raw material evolution works on.
 */

const SCALE = [
  { label: "Nucleotide", value: "1 letter", detail: "A, C, G, or T — the smallest unit. Four letters spell everything." },
  { label: "Base pair", value: "1 rung", detail: "Each letter bonds to its partner (A–T, C–G) — the rungs of the helix." },
  { label: "Gene", value: "~10³–10⁶ bp", detail: "A stretch that codes for a protein or a function. Humans have ~20,000." },
  { label: "Chromosome", value: "~10⁸ bp", detail: "A packaged bundle of genes. You have 23 pairs — one set from each parent." },
  { label: "Genome", value: "~3.2 billion bp", detail: "Your complete code. It would fill ~1.5 GB — and it's in every cell." },
]

// How a cell actually runs the code — the central dogma, in plain machine terms.
const CENTRAL_DOGMA = [
  {
    step: "1 · Store",
    title: "DNA is the master copy",
    body:
      "The genome sits in the nucleus like a reference library that never leaves the building. It's too precious to hand out — so the cell copies just the page it needs.",
  },
  {
    step: "2 · Transcribe",
    title: "DNA → RNA",
    body:
      "An enzyme (RNA polymerase) unzips the relevant gene and transcribes it into a mobile working copy — messenger RNA. Same letters, but a portable single strand that can leave the nucleus.",
  },
  {
    step: "3 · Translate",
    title: "RNA → protein",
    body:
      "A ribosome — the cell's assembly machine — reads the mRNA three letters at a time. Each triplet (a 'codon') names one amino acid. String the amino acids together and they fold into a protein: an enzyme, a receptor, a pigment. Proteins are what actually do the work.",
  },
  {
    step: "4 · Change one letter",
    title: "Why a SNP matters",
    body:
      "Swap a single letter and the codon can name a different amino acid — so the protein folds a little differently and works a little differently. That's the whole mechanism behind the variants on this page: rs671 changes one amino acid in the ALDH2 enzyme, and that enzyme can no longer clear alcohol's toxic by-product. One letter → one changed machine → a trait you can feel.",
  },
]

const EVOLUTION = [
  {
    title: "Variation is the raw material",
    body:
      "Every time DNA copies itself, tiny errors slip through — a letter swapped, added, or dropped. Most do nothing. A few change a trait. These variants (SNPs — the rs-numbers on this page) are the differences between any two humans: about 0.1% of the genome, ~4–5 million letters.",
  },
  {
    title: "Selection keeps what works",
    body:
      "A variant that helps you survive and have children becomes more common over generations; one that hurts fades. Lactose tolerance is the textbook case — the variant that lets adults digest milk spread across dairy-herding populations in only a few thousand years, one of the fastest human adaptations on record.",
  },
  {
    title: "Your genome is a family tree",
    body:
      "You carry variants that arose in specific places and times — a pigment gene from one migration, a metabolism gene from another. Reading them backwards traces your ancestry. Reading them forwards is inheritance: half of each of yours goes to each child, reshuffled.",
  },
  {
    title: "We are 98–99% chimpanzee, ~1–2% Neanderthal",
    body:
      "Humans and chimps share ~98.8% of their DNA; the small remainder is what makes us us. And most people outside Africa carry 1–2% Neanderthal DNA from ancient interbreeding — real variants that still shape immunity, skin, and sleep today. Evolution didn't stop; it's written in the letters you inherited.",
  },
]

export function DnaExplainer() {
  return (
    <div className="space-y-16">
      {/* How DNA works — the scale ladder */}
      <section>
        <div className="flex items-baseline gap-4 mb-6">
          <span aria-hidden className="block w-12 h-px bg-accent" />
          <h2 className="font-display text-2xl md:text-3xl font-light tracking-[-0.01em]">
            How DNA works
          </h2>
        </div>
        <p className="font-sans text-sm md:text-base text-foreground/75 leading-relaxed max-w-2xl mb-8">
          DNA is a four-letter instruction set. The same four letters, in
          different orders, build a bacterium and build you — the information is
          all in the sequence. Here&apos;s the scale, smallest to whole, so the
          rest of this page reads clearly:
        </p>
        <ol className="relative border-l border-border ml-2 space-y-6">
          {SCALE.map((s, i) => (
            <li key={s.label} className="relative pl-6">
              <span
                aria-hidden
                className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full border-2 border-accent bg-background"
              />
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="font-sans text-base md:text-lg text-foreground">{s.label}</span>
                <span className="font-mono text-[11px] tracking-wider text-accent/80">{s.value}</span>
                {i === SCALE.length - 1 && (
                  <span className="font-mono text-[11px] tracking-[0.2em] uppercase text-muted-foreground">you are here, ×37 trillion cells</span>
                )}
              </div>
              <p className="mt-1 font-sans text-sm text-muted-foreground leading-relaxed">{s.detail}</p>
            </li>
          ))}
        </ol>
        <div className="mt-8 rounded-lg border border-border bg-secondary/20 p-4 md:p-5">
          <p className="font-sans text-sm text-foreground/75 leading-relaxed">
            <strong className="text-foreground">Genotype vs. phenotype.</strong>{" "}
            You inherit two copies of most genes — one from each parent. The pair
            is your <em>genotype</em> (e.g. <span className="font-mono text-xs">AG</span>).
            What actually shows up — your height, your caffeine tolerance — is
            your <em>phenotype</em>, and it&apos;s the genotype{" "}
            <em>plus</em> environment, diet, and chance. That gap is why this page
            says &ldquo;associated with,&rdquo; never &ldquo;you will.&rdquo;
          </p>
        </div>
      </section>

      {/* How a cell reads DNA — the central dogma as a machine. */}
      <section>
        <div className="flex items-baseline gap-4 mb-6">
          <span aria-hidden className="block w-12 h-px bg-accent" />
          <h2 className="font-display text-2xl md:text-3xl font-light tracking-[-0.01em]">
            How a cell reads DNA
          </h2>
        </div>
        <p className="font-sans text-sm md:text-base text-foreground/75 leading-relaxed max-w-2xl mb-8">
          DNA doesn&apos;t <em>do</em> anything by itself — it&apos;s a blueprint.
          The mechanism that turns letters into you is the same in every living
          cell, and it&apos;s genuinely beautiful: a tiny, reliable machine
          reading code and building proteins. Once you see it, every variant on
          this page makes sense.
        </p>
        <div className="relative">
          {/* flow line */}
          <div aria-hidden className="absolute left-[15px] top-2 bottom-2 w-px bg-gradient-to-b from-accent/60 via-accent/30 to-transparent md:hidden" />
          <ol className="grid gap-4 md:grid-cols-2">
            {CENTRAL_DOGMA.map((d) => (
              <li key={d.step} className="rounded-xl border border-border bg-card/40 p-5">
                <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-accent">{d.step}</span>
                <h3 className="mt-1.5 font-display text-lg font-light text-foreground">{d.title}</h3>
                <p className="mt-1.5 font-sans text-sm text-foreground/75 leading-relaxed">{d.body}</p>
              </li>
            ))}
          </ol>
        </div>
        <p className="mt-6 rounded-lg border border-accent/25 bg-accent/[0.04] px-4 py-3 font-sans text-sm text-foreground/75 leading-relaxed max-w-2xl">
          <strong className="text-foreground">The one-line version:</strong>{" "}
          <span className="font-mono text-xs text-accent">DNA → RNA → protein → trait</span>.
          The deep dive on each trait names the exact protein change (like{" "}
          <span className="font-mono text-xs">p.Glu504Lys</span>) — now you can
          read it: which amino acid changed, in which machine, and what that machine does.
        </p>
      </section>

      {/* DNA & human evolution */}
      <section>
        <div className="flex items-baseline gap-4 mb-6">
          <span aria-hidden className="block w-12 h-px bg-accent" />
          <h2 className="font-display text-2xl md:text-3xl font-light tracking-[-0.01em]">
            DNA &amp; human evolution
          </h2>
        </div>
        <p className="font-sans text-sm md:text-base text-foreground/75 leading-relaxed max-w-2xl mb-8">
          The variants on this page aren&apos;t random trivia — they&apos;re the
          fossil record of your ancestors&apos; survival, written in you. Here&apos;s
          how the letters became a species:
        </p>
        <div className="grid md:grid-cols-2 gap-4 md:gap-5">
          {EVOLUTION.map((e) => (
            <div key={e.title} className="rounded-xl border border-border bg-card/40 p-5">
              <h3 className="font-display text-lg font-light text-foreground mb-2">{e.title}</h3>
              <p className="font-sans text-sm text-foreground/75 leading-relaxed">{e.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 font-sans text-sm text-foreground/55 leading-relaxed max-w-2xl italic">
          The genes below are a snapshot of that four-billion-year story, paused
          at you. The next reshuffle is your children&apos;s.
        </p>
      </section>
    </div>
  )
}
