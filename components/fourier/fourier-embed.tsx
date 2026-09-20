"use client"

// Client boundary for the Fourier viz (canvas + rAF are client-only).

import dynamic from "next/dynamic"

const FourierViz = dynamic(
  () => import("./fourier-viz").then((m) => ({ default: m.FourierViz })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full aspect-[16/9] rounded-2xl border border-border bg-gradient-to-b from-[#0a0b12] to-[#05060a] grid place-items-center">
        <span className="font-mono text-[11px] tracking-widest uppercase text-foreground/40">loading the circles…</span>
      </div>
    ),
  },
)

export function FourierEmbed() { return <FourierViz /> }
