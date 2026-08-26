"use client"

// Client boundary that lazy-loads the WebGL cube. Kept separate so the case-study
// PAGE can stay a server component (Next 16 disallows `ssr: false` dynamic imports
// in server components). The ~3D bundle only loads on the client, after paint.

import dynamic from "next/dynamic"

const RubikCube = dynamic(
  () => import("./rubik-cube").then((m) => ({ default: m.RubikCube })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full aspect-[4/3] sm:aspect-[16/10] rounded-2xl border border-border bg-gradient-to-b from-[#0a0b12] to-[#05060a] grid place-items-center">
        <span className="font-mono text-[11px] tracking-widest uppercase text-foreground/40">
          loading the cube…
        </span>
      </div>
    ),
  },
)

export function RubikCubeEmbed() {
  return <RubikCube />
}
