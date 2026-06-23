import type { Metadata } from "next"
import { TvShell } from "./tv-shell"

export const metadata: Metadata = {
  title: "Universe Engine TV",
  description:
    "A TV-first Universe Engine shell built for LG webOS and other smart TVs, with remote-friendly navigation and a large preview surface.",
  // Device-specific shell (smart TVs) — not a web search surface. Keep it out of
  // the index so it doesn't compete for crawl budget or show in results, but let
  // Google follow its links.
  robots: { index: false, follow: true },
}

export default function TvPage() {
  return <TvShell />
}