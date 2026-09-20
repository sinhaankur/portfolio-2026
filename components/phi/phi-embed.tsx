"use client"

import dynamic from "next/dynamic"

const PhiViz = dynamic(
  () => import("./phi-viz").then((m) => ({ default: m.PhiViz })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full aspect-[4/3] rounded-2xl border border-border bg-gradient-to-b from-[#0a0b12] to-[#05060a] grid place-items-center">
        <span className="font-mono text-[11px] tracking-widest uppercase text-foreground/40">loading the spiral…</span>
      </div>
    ),
  },
)

export function PhiEmbed() { return <PhiViz /> }
