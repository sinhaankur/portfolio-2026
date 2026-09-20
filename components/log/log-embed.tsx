"use client"

import dynamic from "next/dynamic"

const LogViz = dynamic(
  () => import("./log-viz").then((m) => ({ default: m.LogViz })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full grid place-items-center bg-black">
        <span className="font-mono text-[11px] tracking-widest uppercase text-white/40">loading the scales…</span>
      </div>
    ),
  },
)

export function LogEmbed() { return <LogViz /> }
