/**
 * The reference datasets the DNA trait interpretations are built on. Public,
 * methodology-only — no personal genome touches this file. Each entry is a real
 * scientific resource with its own scope + licence; the page documents them so
 * every claim on /dna is traceable to a primary source.
 */

export type DnaDatabase = {
  id: string
  name: string
  short: string
  /** What it is, in plain language. */
  about: string
  /** What it covers / its scope. */
  coverage: string
  /** Licence / usage terms, in plain words. */
  license: string
  /** How the DNA page uses it. */
  usage: string
  url: string
  /** Maintained by. */
  by: string
  /** Whether we rely on it (used) or deliberately avoid it (avoided) + why. */
  status: "used" | "avoided"
  statusNote?: string
}

export const DNA_DATABASES: DnaDatabase[] = [
  {
    id: "dbsnp",
    name: "dbSNP",
    short: "The variant registry",
    about:
      "NCBI's public catalogue of human genetic variation — the canonical registry of SNPs. Every variant has a stable 'rs' number (e.g. rs4988235) that the whole field uses as a shared address.",
    coverage: "Hundreds of millions of human variants, cross-referenced to every other resource.",
    license: "Public domain (U.S. Government work). Free to use, link, and cite.",
    usage: "Every marker on this page links to its dbSNP record by rsID — the ground-truth address for the variant.",
    url: "https://www.ncbi.nlm.nih.gov/snp/",
    by: "NCBI · National Institutes of Health",
    status: "used",
  },
  {
    id: "gwas-catalog",
    name: "GWAS Catalog",
    short: "Trait ↔ variant associations",
    about:
      "A curated database of published genome-wide association studies — the studies that statistically link a variant to a trait or condition across large populations.",
    coverage: "Tens of thousands of studies, hundreds of thousands of trait–variant associations, each tied to its publication.",
    license: "Open (EMBL-EBI terms) — freely available for research and reuse with attribution.",
    usage: "The evidence layer for most trait cards: is this variant genuinely associated with the trait, and how strongly?",
    url: "https://www.ebi.ac.uk/gwas/",
    by: "EMBL-EBI & NHGRI",
    status: "used",
  },
  {
    id: "clinvar",
    name: "ClinVar",
    short: "Clinical significance",
    about:
      "NCBI's public archive of the relationships between human variants and health, with expert-reviewed clinical significance (benign → pathogenic).",
    coverage: "Millions of variant–condition records, many reviewed by clinical expert panels.",
    license: "Public domain — free to use and redistribute.",
    usage: "Used sparingly and carefully for health-relevant markers, always framed as association, never diagnosis.",
    url: "https://www.ncbi.nlm.nih.gov/clinvar/",
    by: "NCBI · National Institutes of Health",
    status: "used",
  },
  {
    id: "pharmgkb",
    name: "PharmGKB",
    short: "Drug–gene interactions",
    about:
      "A pharmacogenomics knowledge base — how genetic variants affect response to medications, including the CPIC clinical guidelines for prescribing.",
    coverage: "Curated drug–gene relationships, dosing guidance, and clinical annotations.",
    license: "Free for academic/research use (Creative-Commons-style attribution terms).",
    usage: "The basis for the pharma markers (caffeine, warfarin, clopidogrel, anaesthesia sensitivity) — informational, not a prescription.",
    url: "https://www.pharmgkb.org/",
    by: "Stanford University",
    status: "used",
  },
  {
    id: "snpedia",
    name: "SNPedia",
    short: "Plain-language write-ups",
    about:
      "A wiki of human SNPs with readable summaries of what each variant is associated with, linking back to the primary literature.",
    coverage: "Community-curated pages for well-studied variants.",
    license:
      "CC-BY-NC-SA (non-commercial) and owned by MyHeritage. Because of the non-commercial licence, its content is NOT copied into this page.",
    usage:
      "Linked out to from each marker card as a further-reading reference only — never scraped or embedded, to respect the licence.",
    url: "https://www.snpedia.com/",
    by: "MyHeritage",
    status: "avoided",
    statusNote:
      "Referenced by link only. The non-commercial licence means its text isn't reproduced here — the interpretations on this page are written independently from the open sources above.",
  },
]

export const DNA_PRINCIPLES = [
  {
    title: "Open sources only",
    body: "Interpretations are written from public-domain / open resources (dbSNP, GWAS Catalog, ClinVar, PharmGKB). Non-commercial content (SNPedia) is linked, never copied.",
  },
  {
    title: "Association, not destiny",
    body: "Every claim is 'associated with,' never 'you will.' A variant is one input among diet, environment, and chance — the page says so on every card.",
  },
  {
    title: "Traceable by design",
    body: "Each marker links to its dbSNP record so any claim can be checked against the primary source. Nothing here asks you to take it on faith.",
  },
  {
    title: "On-device + non-reconstructable",
    body: "The raw genome is never shipped. Only a derived, encrypted summary reaches the browser, decrypted locally with a password. This page (methodology) carries no personal data at all.",
  },
]
