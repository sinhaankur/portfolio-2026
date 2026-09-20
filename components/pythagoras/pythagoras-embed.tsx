"use client"

import dynamic from "next/dynamic"

const PythagorasViz = dynamic(
  () => import("./pythagoras-viz").then((m) => ({ default: m.PythagorasViz })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full aspect-square rounded-2xl border border-border bg-gradient-to-b from-[#0a0b12] to-[#05060a] grid place-items-center">
        <span className="font-mono text-[11px] tracking-widest uppercase text-foreground/40">loading the squares…</span>
      </div>
    ),
  },
)

export function PythagorasEmbed() { return <PythagorasViz /> }
