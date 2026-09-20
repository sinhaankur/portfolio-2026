"use client"

// Client boundary for the Gerstner wave viz (canvas + rAF are client-only), so
// the /waves/math page can stay a server component.

import dynamic from "next/dynamic"

const WaveViz = dynamic(
  () => import("./wave-viz").then((m) => ({ default: m.WaveViz })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full aspect-[16/9] rounded-2xl border border-border bg-gradient-to-b from-[#0a1830] to-[#010812] grid place-items-center">
        <span className="font-mono text-[11px] tracking-widest uppercase text-foreground/40">loading the sea…</span>
      </div>
    ),
  },
)

export function WaveEmbed() { return <WaveViz /> }
