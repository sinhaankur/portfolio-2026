/**
 * DnaOrigins — the ancestry / "origins story" lens.
 *
 * The encrypted summary deliberately doesn't ship a re-identifiable ancestry
 * breakdown. But several markers on the trait panel are genuinely
 * ancestry-informative — each variant arose in a specific place and time and
 * spread with a migration. So we tell the honest story: the universal
 * out-of-Africa arc every human shares, plus the specific chapters YOUR
 * variants happen to trace. Grounded in real population genetics, framed as
 * heritage, never as a precise "you are X%" claim.
 */

"use client"

import { useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { Globe } from "lucide-react"
import { normalizeGenotype } from "@/lib/dna-traits"
import { DnaJourney } from "./dna-journey"

// R3F globe is lazy — never blocks the section's first paint, and only the
// bytes load if the visitor actually opens it.
const DnaMigrationGlobe = dynamic(
  () => import("./dna-migration-globe").then((m) => ({ default: m.DnaMigrationGlobe })),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-[52vh] min-h-[360px] w-full place-items-center rounded-2xl border border-border bg-[#05070d] font-mono text-[10px] tracking-widest uppercase text-white/50">
        Loading globe…
      </div>
    ),
  },
)

/** [lat, lng] in degrees. */
export type LatLng = [number, number]

type OriginChapter = {
  markerId: string
  gene: string
  /** genotypes that carry the "derived / arose-later" allele. */
  carries: string[]
  title: string
  /** the migration/adaptation story this variant traces. */
  story: string
  when: string
  /** where the variant is thought to have arisen. */
  origin: LatLng
  /** a short label for that place. */
  originPlace: string
  /** the rough direction it spread (for a great-circle arc on the globe). */
  spreadTo: LatLng
}

export const CHAPTERS: OriginChapter[] = [
  {
    markerId: "lactose", gene: "MCM6", carries: ["AA", "AG"],
    title: "The milk revolution",
    when: "~7,500 years ago",
    origin: [50, 20], originPlace: "Central Europe / Near East",
    spreadTo: [60, 10],
    story:
      "The variant that lets adults digest milk arose in dairy-herding populations of the Near East and Europe and spread astonishingly fast — one of the strongest signals of natural selection in the human genome. Carrying it places a branch of your ancestry among early herders.",
  },
  {
    markerId: "pigment", gene: "IRF4", carries: ["TT", "GT"],
    title: "Lighter skin, northern light",
    when: "~10,000–20,000 years ago",
    origin: [55, 15], originPlace: "Northern Europe",
    spreadTo: [62, 25],
    story:
      "Lighter-pigment variants rose in frequency as humans moved into high latitudes with weak sun — a trade-off that let skin make enough vitamin D. These are hallmarks of northern-European and related ancestry.",
  },
  {
    markerId: "eye-color", gene: "HERC2", carries: ["AA", "AG"],
    title: "The blue-eyed founder",
    when: "~6,000–10,000 years ago",
    origin: [44, 34], originPlace: "Black Sea region",
    spreadTo: [56, 20],
    story:
      "Every blue-eyed person alive traces to a single ancestor near the Black Sea in whom this mutation first switched down brown-pigment production. Carrying it links you to that one shared founder.",
  },
  {
    markerId: "alcohol-flush", gene: "ALDH2", carries: ["AG", "AA"],
    title: "The rice-and-alcohol story",
    when: "~2,000–3,000 years ago",
    origin: [30, 110], originPlace: "Southern China",
    spreadTo: [36, 138],
    story:
      "The 'flush' variant is common in East Asian populations, where it may have spread partly as protection during the rise of rice agriculture and fermentation. Carrying it points to East-Asian ancestry.",
  },
  {
    markerId: "endurance", gene: "PPARGC1A", carries: ["GG", "GA"],
    title: "Built to move",
    when: "deep ancestral",
    origin: [2, 37], originPlace: "East Africa",
    spreadTo: [20, 45],
    story:
      "Endurance-favouring metabolism is an ancient human signature — the persistence-hunting adaptation that let our ancestors run prey to exhaustion across the savannah. A thread every human shares, dialled by this variant.",
  },
]

/** The shared out-of-Africa root, drawn for everyone. */
export const HUMAN_ROOT: LatLng = [2, 37] // East Africa (Rift Valley)

export function DnaOrigins({ traits }: { traits: Record<string, string> }) {
  const chapters = useMemo(
    () =>
      CHAPTERS.filter((c) => {
        const raw = traits[c.markerId]
        if (!raw) return false
        return c.carries.map(normalizeGenotype).includes(normalizeGenotype(raw))
      }),
    [traits],
  )
  const [showGlobe, setShowGlobe] = useState(true)

  return (
    <section>
      <div className="flex items-baseline gap-4 mb-3">
        <span aria-hidden className="block w-12 h-px bg-accent" />
        <h2 className="font-display text-2xl md:text-3xl font-light tracking-[-0.01em]">
          Where you come from
        </h2>
      </div>
      <p className="font-sans text-sm md:text-base text-foreground/70 leading-relaxed max-w-2xl mb-8">
        Your DNA is a migration map. Every human alive descends from a small
        group that left Africa ~60,000 years ago — the deepest chapter we all
        share. From there, specific variants arose in specific places and rode
        specific journeys. These are the ones <em>your</em> markers happen to
        trace — heritage, not a precise percentage.
      </p>

      {/* Deep-time journey — the whole arc on one log-scaled axis (origins →
          today), plus the real ancestry-composition overlay when a local file
          supplies it. Sits above the per-variant chapters below. */}
      <DnaJourney
        chapters={chapters.map((c) => ({ markerId: c.markerId, title: c.title, when: c.when, gene: c.gene }))}
      />

      {/* The shared human root */}
      <div className="rounded-2xl border border-border bg-card/40 p-5 md:p-6 mb-6">
        <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-accent mb-2">Chapter 0 · shared by all</div>
        <h3 className="font-display text-xl font-light text-foreground mb-2">Out of Africa</h3>
        <p className="font-sans text-sm text-foreground/75 leading-relaxed">
          ~300,000 years ago, anatomically modern humans emerged in Africa.
          ~60,000 years ago a founding population spread across the world, meeting
          — and interbreeding with — Neanderthals and Denisovans along the way.
          If you have ancestry outside Africa, you carry ~1–2% Neanderthal DNA
          from those encounters. This root is in everyone reading this.
        </p>
      </div>

      {/* The globe — plot the story your variants trace. Toggle-gated + lazy. */}
      {chapters.length > 0 && (
        <div className="mb-6">
          {showGlobe ? (
            <DnaMigrationGlobe
              root={HUMAN_ROOT}
              chapters={chapters.map((c) => ({ origin: c.origin, spreadTo: c.spreadTo }))}
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowGlobe(true)}
              data-cursor-hover
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-accent/40 bg-accent/[0.06] py-5 font-mono text-[11px] tracking-widest uppercase text-accent hover:bg-accent/10 transition-colors"
            >
              <Globe className="h-4 w-4" aria-hidden />
              Show the migration globe
            </button>
          )}
          <p className="mt-2 font-mono text-[10px] tracking-wider text-muted-foreground/70">
            The story your variants trace — where each arose and spread. Heritage, not a location verdict.
          </p>
        </div>
      )}

      {/* Region vs. genetics — the honest reconciliation the user asked for. */}
      <div className="mb-8 rounded-2xl border border-border bg-secondary/20 p-5 md:p-6">
        <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-accent mb-2">Region vs. genetics</div>
        <p className="font-sans text-sm text-foreground/75 leading-relaxed">
          Region and genetics are tangled, and both matter — but not equally.
          <strong className="text-foreground"> Human movement changed diet</strong>{" "}
          (herding brought milk; farming brought rice and grain), and diet, in
          turn, selected for the variants that handled it — that&apos;s why lactose
          tolerance and the alcohol-flush variant map onto specific regions.{" "}
          <strong className="text-foreground">Interbreeding mixed the lines</strong>{" "}
          — migrations met and merged, and you carry Neanderthal and Denisovan
          fragments to prove it, so &ldquo;pure&rdquo; ancestry is a myth. Where a
          variant is <em>common</em> is real history. But it is context, not a
          verdict: your genotype is the truth, and it&apos;s yours whatever the map says.
        </p>
      </div>

      {/* Your specific chapters */}
      {chapters.length > 0 ? (
        <ol className="relative border-l border-border ml-2 space-y-6">
          {chapters.map((c, i) => (
            <li key={c.markerId} className="relative pl-6">
              <span
                aria-hidden
                className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full border-2 border-accent bg-background"
              />
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="font-mono text-[10px] tracking-[0.16em] uppercase text-muted-foreground">Chapter {i + 1} · {c.when}</span>
              </div>
              <h3 className="mt-1 font-display text-lg font-light text-foreground">{c.title}</h3>
              <p className="mt-1.5 font-sans text-sm text-foreground/75 leading-relaxed">{c.story}</p>
              <p className="mt-2 font-mono text-[10px] tracking-wider text-foreground/60">
                traced from your <span className="text-accent/80">{c.gene}</span> variant
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="font-sans text-sm text-muted-foreground italic">
          None of the ancestry-informative markers in this panel carry a
          later-arising variant for you — a reminder that the panel is a small,
          curated sample, not a full ancestry test.
        </p>
      )}

      <p className="mt-6 font-mono text-[10px] tracking-wider text-muted-foreground/80">
        Heritage narrative from ancestry-informative variants · not a substitute for a dedicated ancestry test
      </p>
    </section>
  )
}
