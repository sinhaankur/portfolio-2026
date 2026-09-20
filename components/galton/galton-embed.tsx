"use client"

import dynamic from "next/dynamic"

const GaltonViz = dynamic(
  () => import("./galton-viz").then((m) => ({ default: m.GaltonViz })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full aspect-[3/4] rounded-2xl border border-border bg-gradient-to-b from-[#0a0b12] to-[#05060a] grid place-items-center">
        <span className="font-mono text-[11px] tracking-widest uppercase text-foreground/40">loading the board…</span>
      </div>
    ),
  },
)

export function GaltonEmbed() { return <GaltonViz /> }
