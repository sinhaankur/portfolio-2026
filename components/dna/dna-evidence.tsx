"use client"

/**
 * DnaEvidencePanel — the "how diet, lifestyle & region modulate this" layer.
 *
 * DNA is the source of truth (the deep dive above shows the fixed molecular
 * effect). This is the honest, cited second half: what the literature says can
 * dial that effect up or down — grain type, alcohol type, movement, and where a
 * variant is common. Region/diet/lifestyle MODULATE; they never override the
 * genetics. Every entry links its proof.
 */

import { Utensils, Activity, Globe, Info, ExternalLink } from "lucide-react"
import { evidenceFor, type Evidence, type EvidenceKind } from "@/lib/dna-evidence"

const KIND_META: Record<EvidenceKind, { label: string; icon: typeof Utensils; tone: string }> = {
  diet: { label: "Diet", icon: Utensils, tone: "text-emerald-300 border-emerald-500/30 bg-emerald-500/[0.05]" },
  lifestyle: { label: "Lifestyle", icon: Activity, tone: "text-accent border-accent/30 bg-accent/[0.05]" },
  geo: { label: "Region", icon: Globe, tone: "text-[#7c6cf0] border-[#7c6cf0]/30 bg-[#7c6cf0]/[0.05]" },
  note: { label: "Note", icon: Info, tone: "text-foreground/70 border-border bg-background/40" },
}

function proofHref(e: Evidence): string | null {
  if (e.url) return e.url
  if (e.pmid) return `https://pubmed.ncbi.nlm.nih.gov/${e.pmid}/`
  return null
}

export function DnaEvidencePanel({ markerId }: { markerId: string }) {
  const items = evidenceFor(markerId)
  if (!items.length) return null

  return (
    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.03] p-4 md:p-5">
      <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-emerald-300 mb-1">
        What modulates it · diet · lifestyle · region
      </p>
      <p className="font-sans text-[11px] text-foreground/55 leading-relaxed mb-4">
        Your genotype is fixed — but the literature shows what dials its effect up
        or down. These MODULATE the variant; they don&apos;t override it. Each is cited.
      </p>
      <ul className="space-y-3">
        {items.map((e, i) => {
          const meta = KIND_META[e.kind]
          const Icon = meta.icon
          const href = proofHref(e)
          return (
            <li key={i} className="rounded-lg border border-border bg-background/50 p-3.5">
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[9px] tracking-widest uppercase ${meta.tone}`}>
                  <Icon className="h-2.5 w-2.5" aria-hidden />
                  {meta.label}
                </span>
                <span className="font-sans text-sm text-foreground leading-snug">{e.factor}</span>
              </div>
              <p className="font-sans text-sm text-foreground/75 leading-relaxed">{e.finding}</p>
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 font-mono text-[10px] tracking-wider text-accent/80 hover:text-accent underline underline-offset-2 decoration-dotted"
                >
                  {e.source}
                  {e.pmid ? ` · PubMed ${e.pmid}` : ""}
                  <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              ) : (
                <p className="mt-2 font-mono text-[10px] tracking-wider text-foreground/50">{e.source}</p>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
