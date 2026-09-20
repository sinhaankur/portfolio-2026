"use client"

// Client boundary for the Euler visualization (canvas + rAF are client-only), so
// the Lab page stays a server component.

import dynamic from "next/dynamic"

const EulerViz = dynamic(
  () => import("./euler-viz").then((m) => ({ default: m.EulerViz })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full aspect-[16/10] rounded-2xl border border-border bg-gradient-to-b from-[#0a0b12] to-[#05060a] grid place-items-center">
        <span className="font-mono text-[11px] tracking-widest uppercase text-foreground/40">loading the circle…</span>
      </div>
    ),
  },
)

export function EulerEmbed() { return <EulerViz /> }
