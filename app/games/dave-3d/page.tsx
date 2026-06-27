"use client"

import dynamic from "next/dynamic"

// R3F game — client-only (no SSR on a static export). Lazy-loaded so the heavy
// three.js chunk doesn't block the page; a themed loader shows meanwhile. The
// in-game HUD owns the "← Games" / pause / retry controls, so the page is just
// the full-bleed canvas frame.
const GameCanvas = dynamic(() => import("@/games/dave-3d/engine/game-canvas"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 grid place-items-center bg-[#05060c] text-white">
      <div className="flex flex-col items-center gap-3">
        <div className="h-1 w-40 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-1/3 animate-[daveload_1.1s_ease-in-out_infinite] rounded-full bg-amber-300/80" />
        </div>
        <p className="font-mono text-[10px] tracking-[0.35em] uppercase text-white/55">Loading Dangerous Dave…</p>
      </div>
      <style>{`@keyframes daveload{0%{transform:translateX(-120%)}100%{transform:translateX(420%)}}`}</style>
    </div>
  ),
})

export default function Dave3DPage() {
  return (
    <div className="fixed inset-0 overflow-hidden bg-[#05060c]">
      <GameCanvas />
    </div>
  )
}
