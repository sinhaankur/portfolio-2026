import type { Metadata } from "next"

// Legacy alias — the game now lives at /lab/helion-drift. This route is kept
// only as a redirect so old links/bookmarks don't 404; noindex + canonical so
// search engines don't treat it as a duplicate and consolidate on the real URL.
export const metadata: Metadata = {
  title: "Helion Drift",
  robots: { index: false, follow: true },
  alternates: { canonical: "/lab/helion-drift/" },
}

export default function StarCleaverRedirectLayout({ children }: { children: React.ReactNode }) {
  return children
}
