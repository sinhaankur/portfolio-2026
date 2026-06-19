"use client"

/**
 * HUD for Dave 3D — gem counter, the live objective ("grab the trophy → reach the
 * door"), a win banner with restart, and on-screen touch controls (move + jump)
 * for phones. Polls `game` on an interval (the hot loop stays React-free).
 */

import { useEffect, useState } from "react"
import { game } from "./state"
import { setInput } from "./controls"

export function Hud({ onRestart }: { onRestart: () => void }) {
  const [gems, setGems] = useState(0)
  const [total, setTotal] = useState(0)
  const [trophy, setTrophy] = useState(false)
  const [won, setWon] = useState(false)

  useEffect(() => {
    const id = setInterval(() => {
      setGems(game.gemsGot)
      setTotal(game.gemsTotal)
      setTrophy(game.hasTrophy)
      setWon(game.phase === "won")
    }, 120)
    return () => clearInterval(id)
  }, [])

  const objective = won
    ? "Level cleared!"
    : trophy
      ? "Got the trophy — reach the glowing door 🚪"
      : "Grab the 🏆 trophy, then reach the door"

  return (
    <>
      {/* top status bar */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-20 flex items-center justify-between px-4 py-3 md:px-6 md:py-4 font-mono text-[11px] tracking-wider uppercase text-white/90">
        <span className="rounded-full bg-black/45 backdrop-blur px-3 py-1.5">💎 {gems} / {total}</span>
        <span className="rounded-full bg-black/45 backdrop-blur px-3 py-1.5 normal-case tracking-normal text-[12px]">{objective}</span>
        <span className="rounded-full bg-black/45 backdrop-blur px-3 py-1.5">{trophy ? "🏆" : "—"}</span>
      </div>

      {/* desktop hint */}
      <div className="pointer-events-none fixed inset-x-0 bottom-3 z-20 hidden md:flex justify-center font-mono text-[10px] tracking-[0.2em] uppercase text-white/55">
        WASD / arrows to move · Space to jump · drag to look
      </div>

      {/* win banner */}
      {won && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-black/55 backdrop-blur-sm">
          <div className="rounded-2xl border border-white/20 bg-[#12131f]/90 px-8 py-7 text-center text-white">
            <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-emerald-300">Level cleared</p>
            <h2 className="mt-2 font-display text-3xl font-light italic">You made it through.</h2>
            <p className="mt-2 text-sm text-white/70">Trophy claimed · {gems} / {total} gems</p>
            <button
              type="button"
              onClick={onRestart}
              className="mt-5 inline-flex items-center rounded-full border border-white/30 bg-white/10 px-6 py-3 font-mono text-xs tracking-widest uppercase hover:bg-white hover:text-black transition-colors"
            >
              Play again
            </button>
          </div>
        </div>
      )}

      {/* touch controls (coarse pointers) */}
      <TouchControls />
    </>
  )
}

function TouchControls() {
  const hold = (key: "forward" | "back" | "left" | "right" | "jump") => ({
    onTouchStart: (e: React.TouchEvent) => { e.preventDefault(); setInput(key, true) },
    onTouchEnd: (e: React.TouchEvent) => { e.preventDefault(); setInput(key, false) },
    onTouchCancel: () => setInput(key, false),
    onMouseDown: () => setInput(key, true),
    onMouseUp: () => setInput(key, false),
    onMouseLeave: () => setInput(key, false),
  })
  const btn =
    "select-none grid place-items-center h-14 w-14 rounded-full border border-white/25 bg-black/40 backdrop-blur text-white text-lg active:bg-white/25"
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 flex items-end justify-between px-4 pb-[max(16px,env(safe-area-inset-bottom))] md:hidden">
      {/* left: d-pad */}
      <div className="grid grid-cols-3 grid-rows-2 gap-1.5" style={{ touchAction: "none" }}>
        <span />
        <button className={btn} aria-label="Forward" {...hold("forward")}>▲</button>
        <span />
        <button className={btn} aria-label="Left" {...hold("left")}>◀</button>
        <button className={btn} aria-label="Back" {...hold("back")}>▼</button>
        <button className={btn} aria-label="Right" {...hold("right")}>▶</button>
      </div>
      {/* right: jump */}
      <button className={`${btn} h-20 w-20 bg-red-500/70 text-sm`} aria-label="Jump" {...hold("jump")} style={{ touchAction: "none" }}>
        JUMP
      </button>
    </div>
  )
}
