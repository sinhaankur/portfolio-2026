"use client"

// Client boundary for the Pi visualizations (canvas + rAF run client-only), so
// the Lab page can stay a server component (Next 16 disallows ssr:false dynamic
// imports in a server component).

import dynamic from "next/dynamic"

const PiIrrational = dynamic(
  () => import("./pi-irrational").then((m) => ({ default: m.PiIrrational })),
  { ssr: false, loading: () => <VizSkeleton label="loading the π curve…" /> },
)
const PiLab = dynamic(
  () => import("./pi-lab").then((m) => ({ default: m.PiLab })),
  { ssr: false, loading: () => <VizSkeleton label="loading the methods…" /> },
)
const PiDigits = dynamic(
  () => import("./pi-digits").then((m) => ({ default: m.PiDigits })),
  { ssr: false, loading: () => <VizSkeleton label="computing π…" /> },
)

function VizSkeleton({ label }: { label: string }) {
  return (
    <div className="w-full aspect-[16/10] rounded-2xl border border-border bg-gradient-to-b from-[#0a0b12] to-[#05060a] grid place-items-center">
      <span className="font-mono text-[11px] tracking-widest uppercase text-foreground/40">{label}</span>
    </div>
  )
}

export function PiIrrationalEmbed({ heroMode = false }: { heroMode?: boolean } = {}) {
  return <PiIrrational heroMode={heroMode} />
}
export function PiLabEmbed() { return <PiLab /> }
export function PiDigitsEmbed() { return <PiDigits /> }
