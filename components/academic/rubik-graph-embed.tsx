"use client"

// Client boundary that lazy-loads the interactive graph-theory solver, so the
// case-study PAGE can stay a server component (Next 16 disallows `ssr: false`
// dynamic imports in server components). The solver + BFS only run client-side.

import dynamic from "next/dynamic"

const RubikGraphSolver = dynamic(
  () => import("./rubik-graph-solver").then((m) => ({ default: m.RubikGraphSolver })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full aspect-[16/9] rounded-2xl border border-border bg-gradient-to-b from-[#0a0b12] to-[#05060a] grid place-items-center">
        <span className="font-mono text-[11px] tracking-widest uppercase text-foreground/40">
          loading the graph…
        </span>
      </div>
    ),
  },
)

export function RubikGraphEmbed() {
  return <RubikGraphSolver />
}
