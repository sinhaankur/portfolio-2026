import type { Metadata } from "next"
import Link from "next/link"
import { canonicalPath } from "@/lib/seo"
import { FamilyGate } from "@/components/family/family-gate"

// Unlisted on purpose: noindex + kept out of the sitemap (app/sitemap.ts). A
// private corner for family, reachable from /about with a passcode. The gate is
// soft (client-side, static export) — see components/family/family-gate.tsx.
export const metadata: Metadata = {
  ...canonicalPath("/family"),
  title: "For family",
  description: "A small private corner — photos and moments for the people I love.",
  robots: { index: false, follow: false },
}

export default function FamilyPage() {
  return (
    <main className="relative flex h-[100dvh] w-screen flex-col items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_center,#141018_0%,#0a0a0f_60%,#000_100%)]">
      {/* Soft warm blooms behind the content. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-40">
        <div className="absolute left-1/4 top-1/4 h-96 w-96 animate-pulse rounded-full bg-amber-500/10 blur-[130px]" />
        <div
          className="absolute bottom-1/3 right-1/4 h-80 w-80 animate-pulse rounded-full bg-rose-500/10 blur-[110px]"
          style={{ animationDelay: "2s" }}
        />
      </div>

      <div className="relative z-10 flex w-full flex-col items-center">
        <FamilyGate />
      </div>

      <Link
        href="/about"
        aria-label="Back to About"
        className="absolute bottom-8 right-8 z-30 rounded-full border border-white/10 bg-white/5 px-4 py-2 font-mono text-xs tracking-widest text-white/60 backdrop-blur-md transition-colors hover:text-white/90"
      >
        ← About
      </Link>
    </main>
  )
}
