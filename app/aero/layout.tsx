import type { Metadata } from "next"

// /aero is a branded redirect to the externally-deployed Aero Engine 3D app.
// noindex so search engines don't treat this thin redirect page as content;
// the real app lives on its own GitHub Pages URL.
export const metadata: Metadata = {
  title: "Aero Engine 3D",
  robots: { index: false, follow: true },
}

export default function AeroRedirectLayout({ children }: { children: React.ReactNode }) {
  return children
}
