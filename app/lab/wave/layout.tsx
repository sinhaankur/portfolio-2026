import type { Metadata } from "next"
import { canonicalPath } from "@/lib/seo"

export const metadata: Metadata = {
  ...canonicalPath("/lab/wave"),
  title: "The Waves — how the sea changes, under a real sky",
  description:
    "An exploration of how waves change: a procedural real-time ocean, driven by wind and lit by a real sun and moon (computed on-device), with real footage as reference. The Moon's tides, the Sun, wind and climate — the four forces of the sea, made legible.",
}

export default function WaveLayout({ children }: { children: React.ReactNode }) {
  return children
}
