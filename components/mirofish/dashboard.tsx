"use client"

/**
 * MirofishDashboard — the DOM chrome around the WebGL terminal scene: header
 * bar (title · P&L · stat readouts), panel labels, and the SAMPLE-DATA badge.
 * The heavy R3F scene is lazy-loaded so it never blocks first paint.
 */

import dynamic from "next/dynamic"
import { useState } from "react"
import type { MirofishDashboard as DashboardData } from "@/lib/mirofish"

const DashboardScene = dynamic(() => import("./dashboard-scene"), {
  ssr: false,
  loading: () => <DashboardSkeleton />,
})

function DashboardSkeleton() {
  return (
    <div className="absolute inset-0 grid place-items-center">
      <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" aria-hidden />
        Booting terminal…
      </div>
    </div>
  )
}

function fmtUsd(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  })
}

export function MirofishDashboard({ data }: { data: DashboardData }) {
  // a static, deterministic clock label so the terminal reads "live" without
  // shifting on every render (no real-time claim).
  const [stamp] = useState("22:36:06 UTC")

  return (
    <section className="mb-14 overflow-hidden rounded-xl border border-border bg-background/80">
      {/* header bar */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-border bg-secondary/20 px-4 py-3 md:px-6">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full bg-[#f06c8d]/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
            <span className="h-2.5 w-2.5 rounded-full bg-accent/60" />
          </div>
          <div className="leading-tight">
            <p className="font-mono text-[11px] md:text-xs tracking-[0.15em] uppercase text-foreground">
              {data.header.title}
            </p>
            {data.header.subtitle && (
              <p className="font-mono text-[8px] md:text-[9px] tracking-[0.2em] uppercase text-muted-foreground">
                {data.header.subtitle}
              </p>
            )}
          </div>
        </div>

        {/* P&L */}
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground">
            P&amp;L
          </span>
          <span className="font-display text-xl md:text-2xl font-light tracking-tight text-accent tabular-nums">
            {fmtUsd(data.header.pnl)}
          </span>
        </div>

        {/* readouts */}
        <div className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-1">
          {data.header.readouts.map((r) => (
            <div key={r.label} className="flex items-baseline gap-1.5">
              <span className="font-mono text-[9px] tracking-[0.15em] uppercase text-muted-foreground">
                {r.label}
              </span>
              <span className="font-mono text-xs md:text-sm text-foreground/90 tabular-nums">
                {r.value}
              </span>
            </div>
          ))}
          <span className="font-mono text-[9px] tracking-[0.15em] text-muted-foreground tabular-nums">
            {stamp}
          </span>
        </div>
      </div>

      {/* WebGL stage + overlaid panel labels */}
      <div className="relative h-[420px] sm:h-[520px] md:h-[600px]">
        <DashboardScene data={data} />

        {/* panel labels — positioned to sit over their WebGL panels */}
        <span className="pointer-events-none absolute left-4 top-4 font-mono text-[9px] md:text-[10px] tracking-[0.15em] uppercase text-foreground/60">
          {data.probabilityLattice.label}
        </span>
        <span className="pointer-events-none absolute right-4 top-4 text-right font-mono text-[9px] md:text-[10px] tracking-[0.15em] uppercase text-foreground/60">
          {data.tailRidge.label}
        </span>
        <span className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 font-mono text-[9px] md:text-[10px] tracking-[0.15em] uppercase text-foreground/60">
          {data.relationshipGraph.label}
        </span>

        {/* sample-data badge — honesty about the placeholder series */}
        {data.sampleData && (
          <span className="pointer-events-none absolute bottom-4 right-4 inline-flex items-center gap-1.5 rounded-full border border-[#f0b86c]/40 bg-[#f0b86c]/10 px-2.5 py-1 font-mono text-[8px] md:text-[9px] tracking-[0.2em] uppercase text-[#f0b86c]">
            <span className="h-1 w-1 rounded-full bg-[#f0b86c]" aria-hidden />
            Sample data
          </span>
        )}
      </div>
    </section>
  )
}
