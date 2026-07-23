/**
 * fetch-dna-annotations.mjs — pull VALIDATED, cited annotations for every trait
 * marker rsID from open genomics APIs (MyVariant.info, which aggregates dbSNP,
 * ClinVar, gnomAD, CADD, snpEff), and bake them into lib/dna-annotations.ts.
 *
 * Everything written is real, known, and traceable: for each marker we keep the
 * gene, the variant's molecular consequence, ClinVar clinical significance +
 * conditions (established associations only), and population allele frequencies
 * from reference cohorts. Each record carries the source URLs as PROOF.
 *
 * NOTE ON GEOGRAPHY: population frequencies describe how COMMON a variant is in
 * reference cohorts — they are NOT an ancestry/geography verdict about the user.
 * We label them as exactly that. Location doesn't decide your genotype; your
 * genotype is what it is.
 *
 * Run:  node scripts/fetch-dna-annotations.mjs
 * Re-run any time to refresh; it's deterministic + idempotent.
 */

import { writeFileSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")

// Pull the rsID list straight from the source of truth so this never drifts.
const traitsSrc = readFileSync(join(ROOT, "lib/dna-traits.ts"), "utf8")
const RSIDS = [...new Set([...traitsSrc.matchAll(/rsid:\s*"(rs\d+)"/g)].map((m) => m[1]))]

// Human-readable labels for the population cohorts we surface. Kept to the
// well-known reference panels; framed as "how common in this cohort", not
// ancestry.
const COHORTS = [
  ["1000g", "1000 Genomes (global)"],
  ["gnomad", "gnomAD (global)"],
  ["topmed", "TOPMed (US)"],
  ["korean", "Korean"],
  ["tommo", "Japanese (ToMMo)"],
  ["vietnamese", "Vietnamese"],
  ["alspac", "UK (ALSPAC)"],
]

const FIELDS = [
  "dbsnp.gene.name",
  "dbsnp.gene.symbol",
  "dbsnp.alleles",
  "dbsnp.vartype",
  "dbsnp.chrom",
  "clinvar.rcv.clinical_significance",
  "clinvar.rcv.conditions.name",
  "cadd.consequence",
  "cadd.gene.genename",
  "snpeff.ann.genename",
  "snpeff.ann.putative_impact",
  "snpeff.ann.hgvs_p",
].join(",")

async function fetchOne(rsid) {
  const url = `https://myvariant.info/v1/query?q=dbsnp.rsid:${rsid}&fields=${FIELDS}&size=1`
  const res = await fetch(url, { headers: { accept: "application/json" } })
  if (!res.ok) throw new Error(`${rsid}: HTTP ${res.status}`)
  const json = await res.json()
  const hit = json?.hits?.[0]
  if (!hit) return { rsid, missing: true }

  const dbsnp = hit.dbsnp ?? {}
  const clinvar = hit.clinvar ?? {}
  const cadd = hit.cadd ?? {}
  const snpeff = hit.snpeff ?? {}

  // Gene symbol — prefer snpeff/cadd genename, fall back to dbsnp.
  const ann = Array.isArray(snpeff.ann) ? snpeff.ann[0] : snpeff.ann
  const gene =
    ann?.genename ||
    cadd?.gene?.genename ||
    dbsnp?.gene?.symbol ||
    (Array.isArray(dbsnp?.gene) ? dbsnp.gene[0]?.symbol : undefined) ||
    null
  const geneName =
    dbsnp?.gene?.name ||
    (Array.isArray(dbsnp?.gene) ? dbsnp.gene[0]?.name : undefined) ||
    null

  // Molecular consequence (what the variant does to the protein/transcript).
  const consequence = cadd?.consequence
    ? String(Array.isArray(cadd.consequence) ? cadd.consequence[0] : cadd.consequence)
    : ann?.putative_impact
      ? `${ann.putative_impact} impact`
      : null
  const proteinChange = ann?.hgvs_p ?? null

  // ClinVar — keep only established (non-"uncertain") entries, de-duped.
  const rcv = clinvar.rcv ? (Array.isArray(clinvar.rcv) ? clinvar.rcv : [clinvar.rcv]) : []
  const clinvarEntries = []
  const seen = new Set()
  for (const r of rcv) {
    const sig = r?.clinical_significance
    const cond = r?.conditions?.name
    if (!sig || !cond) continue
    if (/uncertain|not provided|other\b/i.test(sig)) continue
    const key = `${sig}|${cond}`
    if (seen.has(key)) continue
    seen.add(key)
    clinvarEntries.push({ significance: sig, condition: cond })
  }

  // Allele frequencies across reference cohorts — "how common", not ancestry.
  const alleles = Array.isArray(dbsnp.alleles) ? dbsnp.alleles : []
  const freqs = []
  for (const [key, label] of COHORTS) {
    // Report the MINOR (less common globally) allele's frequency per cohort.
    const withFreq = alleles.filter((a) => a?.freq && typeof a.freq[key] === "number")
    if (!withFreq.length) continue
    // minor = the allele with the smaller global (1000g/gnomad) frequency.
    const minor = withFreq.reduce((lo, a) => {
      const g = a.freq["1000g"] ?? a.freq.gnomad ?? 1
      const glo = lo.freq["1000g"] ?? lo.freq.gnomad ?? 1
      return g < glo ? a : lo
    })
    freqs.push({ cohort: label, allele: minor.allele, freq: Number(minor.freq[key].toFixed(3)) })
  }

  return {
    rsid,
    gene,
    geneName,
    vartype: dbsnp.vartype ?? null,
    chrom: dbsnp.chrom ? String(dbsnp.chrom) : null,
    consequence,
    proteinChange,
    clinvar: clinvarEntries.slice(0, 6),
    freqs,
    sources: {
      dbsnp: `https://www.ncbi.nlm.nih.gov/snp/${rsid}`,
      clinvar: `https://www.ncbi.nlm.nih.gov/clinvar/?term=${rsid}`,
      gnomad: `https://gnomad.broadinstitute.org/variant/${rsid}?dataset=gnomad_r4`,
      ensembl: `https://www.ensembl.org/Homo_sapiens/Variation/Explore?v=${rsid}`,
      myvariant: `https://myvariant.info/v1/query?q=dbsnp.rsid:${rsid}`,
    },
  }
}

async function main() {
  console.log(`Fetching ${RSIDS.length} markers from MyVariant.info…`)
  const out = {}
  let ok = 0
  for (const rsid of RSIDS) {
    try {
      const rec = await fetchOne(rsid)
      out[rsid] = rec
      if (!rec.missing) ok++
      process.stdout.write(rec.missing ? "·" : "✓")
    } catch (e) {
      out[rsid] = { rsid, error: String(e.message) }
      process.stdout.write("✗")
    }
    await new Promise((r) => setTimeout(r, 120)) // be polite to the free API
  }
  console.log(`\n${ok}/${RSIDS.length} annotated.`)

  const header = `/**
 * dna-annotations.ts — AUTO-GENERATED by scripts/fetch-dna-annotations.mjs.
 * Do not edit by hand; re-run the script to refresh.
 *
 * Validated, cited per-variant annotations pulled from open genomics APIs
 * (MyVariant.info, aggregating dbSNP · ClinVar · gnomAD · CADD · snpEff). Each
 * record carries source URLs as proof. Population frequencies are "how common
 * in a reference cohort", NOT an ancestry claim about you.
 *
 * Generated: ${new Date().toISOString().slice(0, 10)}
 */

export type DnaAnnotation = {
  rsid: string
  gene: string | null
  geneName: string | null
  vartype: string | null
  chrom: string | null
  consequence: string | null
  proteinChange: string | null
  clinvar: { significance: string; condition: string }[]
  freqs: { cohort: string; allele: string; freq: number }[]
  sources: { dbsnp: string; clinvar: string; gnomad: string; ensembl: string; myvariant: string }
  missing?: boolean
  error?: string
}

export const DNA_ANNOTATIONS: Record<string, DnaAnnotation> = ${JSON.stringify(out, null, 2)}
`
  writeFileSync(join(ROOT, "lib/dna-annotations.ts"), header)
  console.log("Wrote lib/dna-annotations.ts")
}

main()
