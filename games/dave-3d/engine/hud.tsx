"use client"

/**
 * HUD for Dave 3D — level counter + name, gem counter, death tally, the live
 * objective ("grab the cup → reach the door"), a jetpack fuel bar (level 6), a
 * brief "Level clear!" flash between levels, the final victory screen, and
 * on-screen touch controls (move + jump) for phones. Polls `game` on an interval
 * (the hot loop stays React-free).
 */

import { useEffect, useState } from "react"
import { game, TOTAL_LEVELS } from "./state"
import { LEVELS } from "./level"
import { setInput } from "./controls"

export function Hud({
  onRestartLevel,
  onRestartGame,
}: {
  onRestartLevel: () => void
  onRestartGame: () => void
}) {
  const [gems, setGems] = useState(0)
  const [total, setTotal] = useState(0)
  const [trophy, setTrophy] = useState(false)
  const [phase, setPhase] = useState<"playing" | "levelClear" | "won">("playing")
  const [levelIndex, setLevelIndex] = useState(0)
  const [deaths, setDeaths] = useState(0)
  const [hasJet, setHasJet] = useState(false)
  const [jetFuel, setJetFuel] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setGems(game.gemsGot)
      setTotal(game.gemsTotal)
      setTrophy(game.hasTrophy)
      setPhase(game.phase)
      setLevelIndex(game.levelIndex)
      setDeaths(game.deaths)
      setHasJet(game.hasJetpack)
      setJetFuel(game.jetFuel)
    }, 100)
    return () => clearInterval(id)
  }, [])

  const won = phase === "won"
  const cleared = phase === "levelClear"
  const levelName = LEVELS[levelIndex]?.name ?? ""

  const objective = trophy
    ? "Got the cup — reach the glowing door 🚪"
    : "Grab the 🏆 cup, then reach the door"

  return (
    <>
      {/* top status bar */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-20 flex items-center justify-between gap-2 px-4 py-3 md:px-6 md:py-4 font-mono text-[11px] tracking-wider uppercase text-white/90">
        <span className="rounded-full bg-black/45 backdrop-blur px-3 py-1.5">
          Lvl {levelIndex + 1}/{TOTAL_LEVELS}
        </span>
        <span className="hidden sm:block rounded-full bg-black/45 backdrop-blur px-3 py-1.5 normal-case tracking-normal text-[12px]">
          {objective}
        </span>
        <span className="flex items-center gap-2">
          <span className="rounded-full bg-black/45 backdrop-blur px-3 py-1.5">💎 {gems}/{total}</span>
          <span className="rounded-full bg-black/45 backdrop-blur px-3 py-1.5">{trophy ? "🏆" : "—"}</span>
          <span className="rounded-full bg-black/45 backdrop-blur px-3 py-1.5">💀 {deaths}</span>
        </span>
      </div>

      {/* level name under the bar */}
      <div className="pointer-events-none fixed inset-x-0 top-12 md:top-14 z-20 flex justify-center font-mono text-[10px] tracking-[0.3em] uppercase text-white/55">
        {levelName}
      </div>

      {/* jetpack fuel bar (only while you hold the pack) */}
      {hasJet && (
        <div className="pointer-events-none fixed left-1/2 top-20 z-20 w-44 max-w-[60vw] -translate-x-1/2">
          <div className="mb-1 text-center font-mono text-[9px] tracking-[0.3em] uppercase text-orange-300">
            🚀 Jetpack — hold jump
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full bg-orange-400 transition-[width] duration-100"
              style={{ width: `${Math.round(jetFuel * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* desktop hint */}
      <div className="pointer-events-none fixed inset-x-0 bottom-3 z-20 hidden md:flex justify-center font-mono text-[10px] tracking-[0.2em] uppercase text-white/55">
        WASD / arrows to move · Space to jump · drag to look
      </div>

      {/* between-levels corridor banner — the authentic Dave "GOOD WORK!" line,
          green retro caps near the top while Dave walks to the next door. */}
      {cleared && (
        <div className="pointer-events-none fixed inset-x-0 top-[28%] z-30 flex justify-center px-6">
          <p
            className="font-mono text-center text-[18px] md:text-[26px] font-bold tracking-[0.12em] uppercase text-[#46e06a]"
            style={{ textShadow: "0 0 10px rgba(70,224,106,0.5)" }}
          >
            {levelIndex + 1 >= TOTAL_LEVELS
              ? "Good work! The last door awaits!"
              : `Good work! Only ${TOTAL_LEVELS - (levelIndex + 1)} more to go!`}
          </p>
        </div>
      )}

      {/* final victory screen — all 10 levels beaten */}
      {won && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-black/60 backdrop-blur-sm">
          <div className="rounded-2xl border border-white/20 bg-[#12131f]/90 px-8 py-7 text-center text-white">
            <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-amber-300">All 10 levels cleared</p>
            <h2 className="mt-2 font-display text-3xl font-light italic">Dave conquers the cavern.</h2>
            <p className="mt-2 text-sm text-white/70">Total deaths: {deaths === 0 ? "0 — flawless!" : deaths}</p>
            <button
              type="button"
              onClick={onRestartGame}
              className="mt-5 inline-flex items-center rounded-full border border-white/30 bg-white/10 px-6 py-3 font-mono text-xs tracking-widest uppercase hover:bg-white hover:text-black transition-colors"
            >
              Play again from level 1
            </button>
          </div>
        </div>
      )}

      {/* retry-current-level button (top-right, hidden on the end screens) */}
      {!won && !cleared && (
        <button
          type="button"
          onClick={onRestartLevel}
          className="fixed right-3 top-[max(12px,env(safe-area-inset-top))] z-30 inline-flex items-center rounded-full border border-white/25 bg-black/45 backdrop-blur px-4 py-2 font-mono text-[11px] tracking-wider uppercase text-white/85 hover:bg-white/15 hover:text-white transition-colors md:right-4 md:top-4"
        >
          ↺ Retry
        </button>
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
