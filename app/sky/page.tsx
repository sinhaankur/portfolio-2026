import type { Metadata } from "next"
import { canonicalPath } from "@/lib/seo"
import { SkyExperience } from "@/components/sky-experience"

export const metadata: Metadata = {
  title: "The Sky — a quiet place",
  description:
    "The real night sky, drifting in real time — planets, the Milky Way, black holes — with optional piano. Nothing to click, nothing asked of you. Fullscreen it and relax.",
  ...canonicalPath("/sky"),
}

export default function SkyPage() {
  return <SkyExperience />
}
