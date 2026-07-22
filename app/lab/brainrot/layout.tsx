import type { Metadata } from "next"
import { canonicalPath } from "@/lib/seo"

export const metadata: Metadata = {
  ...canonicalPath("/lab/brainrot"),
  title: "BrainRot — see your feed's bias",
  description:
    "A browser extension + on-device engine that scans the sentiment of what you scroll and mirrors the algorithm's hidden bias back to you. Feed mode reflects your algorithmic profile; article mode reads a news piece's editorial slant. Keyless, private — nothing leaves your browser.",
}

export default function BrainRotLayout({ children }: { children: React.ReactNode }) {
  return children
}
