"use client"

// Client boundary for the limbic-net visualization (interactive state is
// client-only), so the page can stay a server component.

import dynamic from "next/dynamic"

const NetViz = dynamic(() => import("./net-viz").then((m) => ({ default: m.NetViz })), {
  ssr: false,
  loading: () => (
    <div className="w-full rounded-2xl border border-border bg-gradient-to-b from-[#0a0b12] to-[#05060a] p-10 grid place-items-center">
      <span className="font-mono text-[11px] tracking-widest uppercase text-foreground/40">
        waking the net…
      </span>
    </div>
  ),
})

export function NetVizEmbed() {
  return <NetViz />
}
