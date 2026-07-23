/**
 * DnaStudy — curated study materials + documentation for going deeper on your
 * DNA: how it works, the science + databases, origins, the ML/pattern-recognition
 * methods, the types of genome study, and reading your own data. Every link is a
 * public, authoritative educational resource. Renders the DNA_STUDY groups.
 */

import { ExternalLink } from "lucide-react"
import { DNA_STUDY, type StudyResource } from "@/lib/dna-study"

const LEVEL_STYLE: Record<StudyResource["level"], string> = {
  "start here": "text-emerald-300 border-emerald-500/30 bg-emerald-500/[0.06]",
  "go deeper": "text-accent border-accent/30 bg-accent/[0.06]",
  reference: "text-muted-foreground border-border bg-background/40",
}

export function DnaStudy() {
  return (
    <div className="space-y-12">
      {DNA_STUDY.map((group) => (
        <div key={group.heading}>
          <h2 className="font-display text-xl md:text-2xl font-light text-foreground mb-1">{group.heading}</h2>
          <p className="font-sans text-sm text-muted-foreground leading-relaxed max-w-2xl mb-5">{group.blurb}</p>
          <div className="grid md:grid-cols-2 gap-3">
            {group.items.map((r) => (
              <a
                key={r.url + r.title}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                data-cursor-hover
                className="group rounded-xl border border-border bg-card/40 p-4 hover:border-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-sans text-sm md:text-base text-foreground leading-snug group-hover:text-accent transition-colors">
                    {r.title}
                  </h3>
                  <span className={`shrink-0 font-mono text-[10px] tracking-[0.14em] uppercase px-2 py-1 rounded-full border ${LEVEL_STYLE[r.level]}`}>
                    {r.level}
                  </span>
                </div>
                <p className="mt-2 font-sans text-sm text-foreground/70 leading-relaxed">{r.what}</p>
                <div className="mt-3 inline-flex items-center gap-1.5 font-mono text-[10px] tracking-wider text-foreground/65 group-hover:text-accent transition-colors">
                  {r.by}
                  <ExternalLink className="w-3 h-3" />
                </div>
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
