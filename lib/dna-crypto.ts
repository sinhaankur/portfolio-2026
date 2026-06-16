/**
 * Shared DNA summary type.
 *
 * The public DNA page is now upload-only: a raw genotyping file is parsed
 * entirely in the browser (lib/dna-parse.ts) into this shape and rendered by
 * <DnaVisualization>. No personal genome data ships with the site, so the
 * previous AES-GCM decryption path has been removed. (Kept this filename to
 * avoid churn across the components that import the type.)
 */

export type DnaSummary = {
  meta: {
    source: string
    derivedAt: string
    totalSnps: number
    note: string
  }
  chromosomes: { name: string; snps: number; heterozygosity: number }[]
  genotypeClasses: {
    homozygous: number
    heterozygous: number
    noCall: number
  }
  sample: { c: string; g: string }[]
  /** Curated trait panel: marker id -> genotype. */
  traits?: Record<string, string>
}
