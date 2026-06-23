"use client"

import dynamic from "next/dynamic"
import Link from "next/link"

// Real-time R3F scene — client-only on the static export, lazy-loaded so the
// three.js chunk doesn't block first paint.
const BigBangEngine = dynamic(() => import("@/components/big-bang"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 grid place-items-center bg-black text-white">
      <p className="font-mono text-[11px] tracking-[0.3em] uppercase text-white/60">
        Igniting the universe…
      </p>
    </div>
  ),
})

export default function BigBangPage() {
  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      <BigBangEngine />
      <Link
        href="/lab"
        className="fixed left-3 top-[max(12px,env(safe-area-inset-top))] z-40 inline-flex items-center rounded-full border border-white/25 bg-black/45 backdrop-blur px-4 py-2 font-mono text-[11px] tracking-wider uppercase text-white/85 hover:text-white hover:bg-white/15 transition-colors md:left-4 md:top-4"
      >
        ← Lab
      </Link>
    </div>
  )
}
