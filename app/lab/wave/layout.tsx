import type { Metadata } from "next"
import { canonicalPath } from "@/lib/seo"

export const metadata: Metadata = {
  ...canonicalPath("/lab/wave"),
  title: "Universe & Wave — an AI film of the cosmos in motion",
  description:
    "A concept film: the Universe Engine's real sky, rendered as a wave — an AI-generated video treating the cosmos as one continuous motion. Where the real-data engine ends and generative video begins.",
}

export default function WaveLayout({ children }: { children: React.ReactNode }) {
  return children
}
