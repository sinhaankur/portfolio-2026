/**
 * dna-journey — the deep-time "DNA journey through the years, from its origins"
 * data model + the PUBLIC (generic, educational) journey shown to every visitor.
 *
 * Two layers, mirroring the DNA page's privacy architecture:
 *   1. PUBLIC  — the universal human arc every genome shares (out-of-Africa →
 *      Neolithic farming → today). No personal data. Shipped in this file.
 *   2. PRIVATE — a person's REAL ancestry composition through deep time (e.g. a
 *      MyHeritage "Ancient Origins" era breakdown). This is personal + can't be
 *      reproduced from a raw SNP CSV, so it is NEVER committed: it loads only
 *      from a gitignored local overlay (see lib/dna-ancestry-private).
 *
 * The <DnaJourney> component renders the private overlay when present, otherwise
 * the public arc — so the public repo/site stays free of personal ancestry data.
 */

/** One stop on the deep-time axis. `yearsAgo` drives the log-scaled position. */
export type JourneyStop = {
  id: string
  /** Years before present. `0` = today. Used for the log-time position. */
  yearsAgo: number
  /** Short axis label (e.g. "60,000 yrs"). */
  age: string
  title: string
  blurb: string
  /** Optional: this stop is one YOU carry / trace (highlighted on the axis). */
  personal?: boolean
}

/** A named ancient population with a share of someone's ancestry, in one era. */
export type AncestryComponent = {
  population: string
  /** Percent 0–100. */
  pct: number
  /** Optional real date range for the population (e.g. "3300–2000 BC"). */
  date?: string
}

/** One historical era's ancestral breakdown (MyHeritage-style). */
export type AncestryEra = {
  id: string
  label: string
  /** Rough midpoint years-ago, for ordering on the axis. */
  yearsAgo: number
  components: AncestryComponent[]
}

/** The full private ancestry overlay for one person. All optional so a partial
 *  local file still renders. */
export type AncestryProfile = {
  /** Deep ancestral source composition (hunter-gatherer / farmer breakdown). */
  deepAncestry?: AncestryComponent[]
  /** Per-era ancient-origins breakdown — the spine of the journey. */
  eras?: AncestryEra[]
  /** Closest ancient populations (ranked; lower distance = closer). */
  closest?: { population: string; distance: number }[]
  /** One-line human framing shown atop the journey. */
  summary?: string
}

/**
 * PUBLIC deep-time journey — the arc EVERY human genome traces. Shown when no
 * private overlay is present. Purely educational; no personal claims.
 */
export const PUBLIC_JOURNEY: JourneyStop[] = [
  {
    id: "origin",
    yearsAgo: 300000,
    age: "~300,000 yrs",
    title: "Origins — Africa",
    blurb:
      "Anatomically modern humans emerge in Africa. Every genome alive today, including yours, roots here.",
  },
  {
    id: "exodus",
    yearsAgo: 60000,
    age: "~60,000 yrs",
    title: "Out of Africa",
    blurb:
      "A founding population spreads across the world — meeting, and interbreeding with, Neanderthals and Denisovans. Non-African ancestry still carries ~1–2% Neanderthal DNA.",
  },
  {
    id: "ice-age",
    yearsAgo: 20000,
    age: "~20,000 yrs",
    title: "Ice-age dispersals",
    blurb:
      "Populations adapt to new latitudes and light. Pigment, cold and altitude variants rise where they help — the body tuned by place.",
  },
  {
    id: "neolithic",
    yearsAgo: 10000,
    age: "~10,000 yrs",
    title: "The Neolithic — farming begins",
    blurb:
      "Agriculture and herding reshape diet and demography. New selection: lactase persistence for milk, starch and metabolism variants for grain.",
  },
  {
    id: "bronze",
    yearsAgo: 4500,
    age: "~4,500 yrs",
    title: "Bronze Age — great mixings",
    blurb:
      "Steppe expansions, river-valley civilizations and long-distance trade fold populations together. Most living ancestries are admixtures formed around here.",
  },
  {
    id: "today",
    yearsAgo: 0,
    age: "Today",
    title: "You",
    blurb:
      "The living end of an unbroken ~300,000-year line — every ancestor in it survived long enough to pass a genome forward. That thread is you.",
    personal: true,
  },
]
