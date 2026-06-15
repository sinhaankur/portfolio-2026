/**
 * Browser-side raw-DNA parser.
 *
 * Lets anyone analyze their own genotyping file ENTIRELY in their browser — the
 * file is read with FileReader and processed in memory; nothing is uploaded,
 * encrypted, or sent anywhere. This mirrors the server-side derivation in
 * scripts/encrypt-dna.mjs so the same <DnaVisualization> renders the result.
 *
 * Supports the common consumer formats:
 *   - MyHeritage  : "rsid","chrom","pos","result"   (quoted CSV, ## headers)
 *   - 23andMe     : rsid\tchrom\tpos\tgenotype       (TSV, # headers)
 *   - AncestryDNA : rsid\tchrom\tpos\tallele1\tallele2 (TSV, # headers)
 *   - Tellme/FTDNA: usually CSV like MyHeritage
 *
 * We sniff the delimiter and column layout from the first data row.
 */

import type { DnaSummary } from "./dna-crypto"
import { TRAIT_MARKERS } from "./dna-traits"

const TRAIT_RSIDS: Record<string, string> = Object.fromEntries(
  TRAIT_MARKERS.map((m) => [m.rsid.toLowerCase(), m.id]),
)

const CHROM_ORDER = [
  "1","2","3","4","5","6","7","8","9","10","11","12",
  "13","14","15","16","17","18","19","20","21","22","X","Y","MT",
]

export type ParseResult =
  | { ok: true; summary: DnaSummary }
  | { ok: false; error: string }

function clean(s: string): string {
  return s.replace(/^"|"$/g, "").trim()
}

/** Sniff a data line: returns column indices for chrom + the genotype pieces. */
function detectLayout(line: string): {
  delim: string
  chromIdx: number
  rsidIdx: number
  genoIdxs: number[]
} | null {
  const delim = line.includes("\t") ? "\t" : ","
  const cols = line.split(delim).map(clean)
  if (cols.length < 4) return null
  // rsid is col 0 in every supported format
  // AncestryDNA: rsid, chrom, pos, allele1, allele2  (5 cols)
  // others:      rsid, chrom, pos, genotype          (4 cols)
  if (cols.length >= 5 && cols[3].length === 1 && cols[4].length === 1) {
    return { delim, rsidIdx: 0, chromIdx: 1, genoIdxs: [3, 4] }
  }
  return { delim, rsidIdx: 0, chromIdx: 1, genoIdxs: [3] }
}

export function parseRawDna(text: string): ParseResult {
  const lines = text.split(/\r?\n/)
  const counts = new Map<string, number>()
  const het = new Map<string, number>()
  const genotypeClasses = { homozygous: 0, heterozygous: 0, noCall: 0 }
  const SAMPLE_SIZE = 1200
  const sample: { c: string; g: string }[] = []
  const traits: Record<string, string> = {}
  let total = 0
  let layout: ReturnType<typeof detectLayout> | null = null

  for (const line of lines) {
    if (!line) continue
    const first = line[0]
    // skip comments + obvious header rows
    if (first === "#") continue
    const lower = line.toLowerCase()
    if (lower.startsWith("rsid") || lower.startsWith('"rsid"')) continue

    if (!layout) {
      layout = detectLayout(line)
      if (!layout) continue
    }

    const cols = line.split(layout.delim).map(clean)
    if (cols.length <= layout.chromIdx) continue

    const rsid = cols[layout.rsidIdx]
    const chrom = cols[layout.chromIdx]
    const geno = layout.genoIdxs.map((i) => cols[i] ?? "").join("").toUpperCase()
    if (!chrom || !geno) continue

    if (TRAIT_RSIDS[rsid.toLowerCase()] && /^[ACGT]{2}$/.test(geno)) {
      traits[TRAIT_RSIDS[rsid.toLowerCase()]] = geno
    }

    counts.set(chrom, (counts.get(chrom) || 0) + 1)
    total++

    const callable = geno.length === 2 && /^[ACGT]{2}$/.test(geno)
    if (!callable) {
      genotypeClasses.noCall++
    } else if (geno[0] === geno[1]) {
      genotypeClasses.homozygous++
    } else {
      genotypeClasses.heterozygous++
      het.set(chrom, (het.get(chrom) || 0) + 1)
    }

    if (callable) {
      if (sample.length < SAMPLE_SIZE) {
        sample.push({ c: chrom, g: geno })
      } else {
        const j = Math.floor(Math.random() * total)
        if (j < SAMPLE_SIZE) sample[j] = { c: chrom, g: geno }
      }
    }
  }

  if (total < 1000) {
    return {
      ok: false,
      error:
        "This doesn't look like a raw DNA file. Expected a MyHeritage, 23andMe, or AncestryDNA genotype export (rsid, chromosome, position, genotype).",
    }
  }

  const chromosomes = CHROM_ORDER.filter((c) => counts.has(c)).map((c) => {
    const n = counts.get(c)!
    const h = het.get(c) || 0
    return { name: c, snps: n, heterozygosity: n ? +(h / n).toFixed(4) : 0 }
  })

  return {
    ok: true,
    summary: {
      meta: {
        source: "Your uploaded raw DNA",
        derivedAt: new Date().toISOString(),
        totalSnps: total,
        note:
          "Processed entirely in your browser. Your file was never uploaded, stored, or sent anywhere.",
      },
      chromosomes,
      genotypeClasses,
      sample,
      traits,
    },
  }
}

/** Read a File and parse it, all client-side. */
export function parseDnaFile(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onerror = () =>
      resolve({ ok: false, error: "Couldn't read that file. Try again." })
    reader.onload = () => {
      try {
        resolve(parseRawDna(String(reader.result)))
      } catch {
        resolve({ ok: false, error: "Couldn't parse that file." })
      }
    }
    reader.readAsText(file)
  })
}
