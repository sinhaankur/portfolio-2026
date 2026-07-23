"use client"

/**
 * DnaTabs — a two-level (L1 / L2) tabbed shell for the genome page.
 *
 * The page has a lot of ground; tabs make it navigable one focused area at a
 * time instead of an endless scroll. L1 = the four things people come for
 * (Overview · Your Body · Ancestry · Learn); L2 = the sub-views inside each.
 * Selecting an L1 shows its L2 row and its first sub-view; the parent renders
 * whichever section id is active. Intuitive: you always see the whole map (both
 * tab rows) and exactly where you are.
 */

import { useState } from "react"

export type TabConfig = {
  id: string
  label: string
  children: { id: string; label: string }[]
}

export const DNA_TABS: TabConfig[] = [
  {
    // L1 #1 — everything about YOUR genome.
    id: "analysis", label: "Your DNA analysis",
    children: [
      // Insight-first: lead with the actionable + personal reads, then context
      // and ancestry. The more educational views live in the second tab.
      { id: "hero", label: "At a glance" },
      { id: "dna-plan", label: "Your plan" },
      { id: "dna-traits", label: "Traits" },
      { id: "dna-compare", label: "You vs. average" },
      { id: "dna-origins", label: "Origins" },
    ],
  },
  {
    // L1 #2 — the science, how it passes on, resources, and sources.
    id: "learn", label: "How DNA works & sources",
    children: [
      { id: "how-dna-works", label: "How DNA works" },
      { id: "dna-evolution", label: "Evolution" },
      { id: "dna-inheritance", label: "Inheritance" },
      { id: "dna-helix", label: "The helix" },
      { id: "dna-sources", label: "Sources & study material" },
    ],
  },
]

export function DnaTabs({
  active,
  onChange,
}: {
  active: string
  onChange: (sectionId: string) => void
}) {
  // Which L1 owns the active L2 section.
  const activeL1 = DNA_TABS.find((t) => t.children.some((c) => c.id === active)) ?? DNA_TABS[0]
  const [openL1, setOpenL1] = useState(activeL1.id)
  const openTab = DNA_TABS.find((t) => t.id === openL1) ?? DNA_TABS[0]

  const pickL1 = (t: TabConfig) => {
    setOpenL1(t.id)
    onChange(t.children[0].id) // jump to its first sub-view
  }

  return (
    <div className="sticky top-16 z-30 -mx-6 mb-10 border-b border-border bg-background/85 backdrop-blur-md px-6 pt-3 pb-2">
      {/* L1 */}
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Genome areas">
        {DNA_TABS.map((t) => {
          const on = t.id === openL1
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => pickL1(t)}
              data-cursor-hover
              className={`rounded-full px-4 py-2 font-mono text-[11px] tracking-[0.14em] uppercase transition-colors ${
                on ? "bg-accent text-white" : "text-muted-foreground hover:text-foreground border border-transparent hover:border-border"
              }`}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {/* L2 — sub-views of the open L1 */}
      <div className="mt-2 flex flex-wrap gap-1.5" role="tablist" aria-label={`${openTab.label} views`}>
        {openTab.children.map((c) => {
          const on = c.id === active
          return (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onChange(c.id)}
              data-cursor-hover
              className={`rounded-md px-3 py-1.5 font-mono text-[10px] tracking-[0.12em] uppercase transition-colors border ${
                on ? "border-accent/60 text-accent bg-accent/10" : "border-border text-muted-foreground/70 hover:text-foreground"
              }`}
            >
              {c.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
