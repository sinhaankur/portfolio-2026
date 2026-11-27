import type { Metadata } from "next"
import { canonicalPath } from "@/lib/seo"

export const metadata: Metadata = {
  ...canonicalPath("/lab/mars-hawc"),
  title: "Mars HAWC — pilot a combat mech on the real Martian surface",
  description:
    "A third-person mech game on the real Martian surface, successor to G-NOME (7th Level, 1997). Eject, hijack an enemy HAWC, force its pilot out and steal the intact hull. Grounded hard sci-fi, real Mars data, runs entirely in the browser.",
}

export default function MarsHawcLayout({ children }: { children: React.ReactNode }) {
  return children
}
