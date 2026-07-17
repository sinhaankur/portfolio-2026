import type { Metadata } from "next"
import { StoryExperience } from "@/components/story-experience"

// EXPERIMENT B — alternative home for look-and-feel comparison against "/".
// Unlisted on purpose: noindex + excluded from the sitemap. If the experiment
// wins, its ideas move into the real home; this route doesn't become a
// second permanent homepage.
export const metadata: Metadata = {
  title: "Story — experiment",
  robots: { index: false, follow: false },
}

export default function StoryPage() {
  return <StoryExperience />
}
