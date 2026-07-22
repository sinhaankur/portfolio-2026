import type { Metadata } from "next"

// Legacy alias — the universe assistant was folded into the Satellite Engine
// (/lab/celestial) as a keyless on-device copilot. This route now just redirects
// so old links don't 404; noindex + canonical so search consolidates on the
// real destination.
export const metadata: Metadata = {
  title: "Universe Assistant",
  robots: { index: false, follow: true },
  alternates: { canonical: "/lab/celestial/" },
}

export default function UniverseAssistantRedirectLayout({ children }: { children: React.ReactNode }) {
  return children
}
