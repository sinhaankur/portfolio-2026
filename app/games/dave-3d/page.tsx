"use client"

import dynamic from "next/dynamic"
import Link from "next/link"

// R3F game — client-only (no SSR on a static export). Lazy-loaded so the heavy
// three.js chunk doesn't block the page; a simple loader shows meanwhile.
const GameCanvas = dynamic(() => import("@/games/dave-3d/engine/game-canvas"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 grid place-items-center bg-[#0c0f1a] text-white">
      <p className="font-mono text-[11px] tracking-[0.3em] uppercase text-white/70">Loading Dave 3D…</p>
    </div>
  ),
})

export default function Dave3DPage() {
  return (
    <div className="fixed inset-0 overflow-hidden bg-[#0c0f1a]">
      <GameCanvas />
      <Link
        href="/games/Gamelist.html"
        className="fixed left-3 top-[max(12px,env(safe-area-inset-top))] z-40 inline-flex items-center rounded-full border border-white/25 bg-black/45 backdrop-blur px-4 py-2 font-mono text-[11px] tracking-wider uppercase text-white/85 hover:text-white hover:bg-white/15 transition-colors md:left-4 md:top-4"
      >
        ← Games
      </Link>
    </div>
  )
}
