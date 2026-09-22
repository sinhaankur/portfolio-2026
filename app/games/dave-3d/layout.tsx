import type { Metadata } from "next"

// Legacy route: the game was renamed Dave 3D → Ritam 3D and moved to
// /games/ritam-3d. This path now redirects there (see page.tsx). noindex so
// search engines follow the canonical to the new URL.
export const metadata: Metadata = {
  robots: { index: false, follow: true },
  title: "Ritam 3D (moved)",
}

export default function Dave3DLegacyLayout({ children }: { children: React.ReactNode }) {
  return children
}
