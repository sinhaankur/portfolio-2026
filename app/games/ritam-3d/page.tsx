"use client"

import dynamic from "next/dynamic"

// R3F game — client-only (no SSR on a static export). Lazy-loaded so the heavy
// three.js chunk doesn't block the page; a themed loader shows meanwhile. The
// in-game HUD owns the "← Games" / pause / retry controls, so the page is just
// the full-bleed canvas frame. (Engine dir stays at games/dave-3d/engine — an
// internal path; the public route is /games/ritam-3d.)
const GameCanvas = dynamic(() => import("@/games/dave-3d/engine/game-canvas"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 grid place-items-center bg-[#05060c] text-white">
      <div className="flex flex-col items-center gap-3">
        <div className="h-1 w-40 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-1/3 animate-[ritamload_1.1s_ease-in-out_infinite] rounded-full bg-amber-300/80" />
        </div>
        <p className="font-mono text-[10px] tracking-[0.35em] uppercase text-white/55">Loading Ritam 3D…</p>
      </div>
      <style>{`@keyframes ritamload{0%{transform:translateX(-120%)}100%{transform:translateX(420%)}}`}</style>
    </div>
  ),
})

export default function Ritam3DPage() {
  return (
    // touch-action:none + overscroll-none lock the play area so dragging/pinching
    // on a phone drives the game instead of scrolling or zooming the page. (The
    // site-wide viewport still allows pinch-zoom elsewhere — this is scoped here.)
    <div
      className="fixed inset-0 overflow-hidden overscroll-none bg-[#05060c]"
      style={{ touchAction: "none" }}
    >
      <GameCanvas />
    </div>
  )
}
