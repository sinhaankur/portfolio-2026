/**
 * AutoClusters — organises your DNA matches into clusters that likely descend
 * from the same common ancestor. Renders the classic AutoCluster MATRIX: matches
 * on both axes, with coloured squares along the diagonal where a group of matches
 * all match each other (a shared-ancestor cluster).
 *
 * Runs on the local real match overlay if present, else the synthetic demo set.
 */

"use client"

import { useMemo } from "react"
import { getMatches } from "@/lib/dna-matches-source"

const CLUSTER_COLORS: Record<string, string> = {
  Maternal: "#4ad6c4",
  Paternal: "#f5b942",
  Unclustered: "#5b647a",
}

export function AutoClusters() {
  const { matches, isDemo } = useMemo(() => getMatches(), [])

  // order matches by cluster so same-cluster members sit adjacent (diagonal blocks)
  const ordered = useMemo(() => {
    const order = ["Maternal", "Paternal", "Unclustered"]
    return [...matches].sort(
      (a, b) => order.indexOf(a.cluster) - order.indexOf(b.cluster) || b.totalCm - a.totalCm,
    )
  }, [matches])

  const clusters = useMemo(() => {
    const map = new Map<string, typeof matches>()
    for (const m of ordered) {
      if (!map.has(m.cluster)) map.set(m.cluster, [])
      map.get(m.cluster)!.push(m)
    }
    return map
  }, [ordered])

  return (
    <div className="rounded-2xl border border-border bg-card/40 p-5 md:p-7">
      <div className="flex items-baseline gap-3 mb-2">
        <h3 className="font-display text-xl md:text-2xl font-light">AutoClusters</h3>
        <span className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">shared-ancestor groups</span>
      </div>
      <p className="font-sans text-sm text-foreground/70 leading-relaxed max-w-2xl mb-4">
        Matches who also match <em>each other</em> tend to descend from the same
        ancestral couple. AutoClusters groups them: each coloured block on the
        diagonal is one such cluster — usually a branch of your family tree.
      </p>
      {isDemo && (
        <p className="mb-5 rounded-lg border border-accent/30 bg-accent/[0.06] px-3 py-2 font-mono text-[10px] tracking-wide text-accent/90">
          Demo data — invented matches split into two clean clusters, to show how it reads. Drop your own export in locally to see yours.
        </p>
      )}

      {/* the matrix */}
      <div className="overflow-x-auto">
        <div
          className="inline-grid gap-[2px]"
          style={{ gridTemplateColumns: `120px repeat(${ordered.length}, 18px)` }}
        >
          {/* header row */}
          <div />
          {ordered.map((m) => (
            <div key={`h-${m.id}`} className="h-[70px] relative">
              <span className="absolute bottom-1 left-1/2 origin-bottom-left -rotate-45 whitespace-nowrap font-mono text-[9px] text-muted-foreground">
                {m.name}
              </span>
            </div>
          ))}
          {/* body rows */}
          {ordered.map((rowM) => (
            <div key={`r-${rowM.id}`} className="contents">
              <div className="flex items-center justify-end pr-2 font-mono text-[10px] text-muted-foreground truncate" style={{ height: 18 }}>
                {rowM.name}
              </div>
              {ordered.map((colM) => {
                const self = rowM.id === colM.id
                const together = rowM.cluster === colM.cluster && rowM.cluster !== "Unclustered"
                const color = self
                  ? "#ffffff22"
                  : together
                    ? CLUSTER_COLORS[rowM.cluster] ?? "#5b647a"
                    : "transparent"
                return (
                  <div
                    key={`${rowM.id}-${colM.id}`}
                    className="rounded-[2px] border border-white/[0.04]"
                    style={{ height: 18, backgroundColor: color, opacity: together ? 0.85 : 1 }}
                    title={self ? rowM.name : `${rowM.name} ↔ ${colM.name}${together ? ` · ${rowM.cluster} cluster` : ""}`}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* cluster summary */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[...clusters.entries()].map(([name, members]) => (
          <div key={name} className="rounded-xl border border-border bg-background/40 p-3">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CLUSTER_COLORS[name] ?? "#5b647a" }} />
              <span className="font-mono text-[10px] tracking-widest uppercase text-foreground">{name}</span>
              <span className="font-mono text-[10px] text-muted-foreground">· {members.length}</span>
            </div>
            <ul className="space-y-0.5">
              {members.map((m) => (
                <li key={m.id} className="font-sans text-xs text-foreground/70">
                  {m.name} <span className="text-muted-foreground">· {m.relationship}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="mt-5 font-mono text-[10px] tracking-wider text-muted-foreground/80">
        Diagonal colour blocks = shared-ancestor clusters · a starting map of which branch a match belongs to
      </p>
    </div>
  )
}
