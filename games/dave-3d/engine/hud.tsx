"use client"

/**
 * HUD for Dave 3D — a clean, non-overlapping interface over the game canvas:
 *   • top-left control cluster: ← Games, Pause, Retry (one row, no chip overlap)
 *   • top-centre: objective line; top-right: level / 💎 / 🏆 / 💀 status pills
 *   • a START / how-to-play overlay before the first level
 *   • a PAUSE overlay (Esc or the ⏸ button)
 *   • jetpack fuel bar, the "GOOD WORK!" corridor banner, the victory screen
 *   • on-screen touch controls (move + jump) for phones
 * Polls `game` on an interval so the hot render loop stays React-free.
 */

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
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

  // UX flow state (separate from the core phase): the start screen shows once,
  // then play begins; pause can toggle any time during play.
  const [started, setStarted] = useState(false)
  const [paused, setPaused] = useState(false)

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

  // The game runs only when started, not paused, and actually mid-level.
  useEffect(() => {
    game.running = started && !paused && phase === "playing"
  }, [started, paused, phase])

  const begin = useCallback(() => { setStarted(true); setPaused(false) }, [])
  const togglePause = useCallback(() => {
    if (!started || won) return
    setPaused((p) => !p)
  }, [started, won])

  // Esc / P toggles pause once the game has started.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "Escape" || e.key === "p" || e.key === "P") && started && !won) {
        e.preventDefault()
        setPaused((p) => !p)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [started, won])

  const objective = trophy
    ? "Got the cup — reach the glowing door"
    : "Grab the cup, then reach the door"

  const pill = "rounded-full bg-black/50 backdrop-blur px-2.5 py-1.5 leading-none"
  const ctrlBtn =
    "pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/50 backdrop-blur px-3 py-1.5 font-mono text-[11px] tracking-wider uppercase text-white/85 hover:bg-white/15 hover:text-white transition-colors"

  return (
    <>
      {/* ── TOP-LEFT control cluster (back / pause / retry) — one row, no overlap ── */}
      <div className="pointer-events-none fixed left-3 top-[max(10px,env(safe-area-inset-top))] z-40 flex items-center gap-2 md:left-4 md:top-4">
        <Link href="/games/Gamelist.html" className={ctrlBtn} aria-label="Back to games">
          ← Games
        </Link>
        {started && !won && (
          <button type="button" onClick={togglePause} className={ctrlBtn} aria-label={paused ? "Resume" : "Pause"}>
            {paused ? "▶ Resume" : "⏸ Pause"}
          </button>
        )}
        {started && !won && !cleared && (
          <button type="button" onClick={onRestartLevel} className={ctrlBtn} aria-label="Retry level">
            ↺ Retry
          </button>
        )}
      </div>

      {/* ── TOP-RIGHT status pills ── */}
      <div className="pointer-events-none fixed right-3 top-[max(10px,env(safe-area-inset-top))] z-30 flex items-center gap-1.5 font-mono text-[11px] tracking-wider uppercase text-white/90 md:right-4 md:top-4">
        <span className={pill}>Lvl {levelIndex + 1}/{TOTAL_LEVELS}</span>
        <span className={pill}>💎 {gems}/{total}</span>
        <span className={pill}>{trophy ? "🏆" : "·"}</span>
        <span className={pill}>💀 {deaths}</span>
      </div>

      {/* ── objective + level name, centred BELOW the button rows so they never
            collide with the corners ── */}
      {started && !won && !cleared && (
        <div className="pointer-events-none fixed inset-x-0 top-12 md:top-14 z-20 flex flex-col items-center gap-0.5 px-4 text-center">
          <p className="font-mono text-[11px] md:text-[12px] tracking-wide text-white/80">{objective}</p>
          <p className="font-mono text-[9px] tracking-[0.3em] uppercase text-white/45">{levelName}</p>
        </div>
      )}

      {/* jetpack fuel bar (only while you hold the pack) */}
      {hasJet && started && !paused && (
        <div className="pointer-events-none fixed left-1/2 top-24 z-20 w-44 max-w-[60vw] -translate-x-1/2">
          <div className="mb-1 text-center font-mono text-[9px] tracking-[0.3em] uppercase text-orange-300">
            🚀 Jetpack — hold jump
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/15">
            <div className="h-full bg-orange-400 transition-[width] duration-100" style={{ width: `${Math.round(jetFuel * 100)}%` }} />
          </div>
        </div>
      )}

      {/* desktop controls hint (bottom, subtle, while playing) */}
      {started && !paused && !won && (
        <div className="pointer-events-none fixed inset-x-0 bottom-3 z-20 hidden md:flex justify-center font-mono text-[10px] tracking-[0.2em] uppercase text-white/45">
          A / D · move &nbsp;·&nbsp; Space · jump &nbsp;·&nbsp; drag · look &nbsp;·&nbsp; Esc · pause
        </div>
      )}

      {/* ── START / how-to-play overlay ── */}
      {!started && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/70 backdrop-blur-sm px-6">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#12131f]/95 p-7 text-center text-white">
            <p className="font-mono text-[10px] tracking-[0.35em] uppercase text-amber-300">A 3D tribute</p>
            <h1 className="mt-1.5 font-display text-3xl md:text-4xl font-light italic">Dangerous Dave</h1>
            <p className="mt-3 text-sm text-white/70">
              Grab the <span className="text-amber-300">🏆 cup</span>, then reach the
              <span className="text-emerald-300"> door</span> to clear each of the {TOTAL_LEVELS} levels.
              Dodge fire, water and spikes. Diamonds are bonus.
            </p>
            <div className="mx-auto mt-5 grid max-w-xs grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-left font-mono text-[11px] text-white/75">
              <span className="text-white/50">A / D · ← →</span><span>Move left / right</span>
              <span className="text-white/50">Space · ↑</span><span>Jump</span>
              <span className="text-white/50">Drag</span><span>Orbit the camera (3D)</span>
              <span className="text-white/50">Esc · P</span><span>Pause</span>
            </div>
            <button
              type="button"
              onClick={begin}
              className="mt-6 inline-flex items-center rounded-full border border-white/30 bg-white/10 px-8 py-3 font-mono text-xs tracking-[0.2em] uppercase hover:bg-white hover:text-black transition-colors"
            >
              ▶ Start
            </button>
          </div>
        </div>
      )}

      {/* ── PAUSE overlay ── */}
      {paused && started && !won && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 backdrop-blur-sm px-6">
          <div className="w-full max-w-xs rounded-2xl border border-white/15 bg-[#12131f]/95 p-7 text-center text-white">
            <p className="font-mono text-[10px] tracking-[0.35em] uppercase text-white/50">Paused</p>
            <h2 className="mt-1 font-display text-2xl font-light italic">{levelName}</h2>
            <div className="mt-5 flex flex-col gap-2">
              <button type="button" onClick={() => setPaused(false)} className="rounded-full border border-white/30 bg-white/10 px-6 py-2.5 font-mono text-xs tracking-widest uppercase hover:bg-white hover:text-black transition-colors">
                ▶ Resume
              </button>
              <button type="button" onClick={() => { setPaused(false); onRestartLevel() }} className="rounded-full border border-white/20 px-6 py-2.5 font-mono text-xs tracking-widest uppercase text-white/80 hover:bg-white/10 transition-colors">
                ↺ Retry level
              </button>
              <Link href="/games/Gamelist.html" className="rounded-full border border-white/20 px-6 py-2.5 font-mono text-xs tracking-widest uppercase text-white/80 hover:bg-white/10 transition-colors">
                ← Quit to games
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* between-levels corridor banner — authentic Dave "GOOD WORK!" line */}
      {cleared && (
        <div className="pointer-events-none fixed inset-x-0 top-[28%] z-30 flex justify-center px-6">
          <p className="font-mono text-center text-[18px] md:text-[26px] font-bold tracking-[0.12em] uppercase text-[#46e06a]" style={{ textShadow: "0 0 10px rgba(70,224,106,0.5)" }}>
            {levelIndex + 1 >= TOTAL_LEVELS
              ? "Good work! The last door awaits!"
              : `Good work! Only ${TOTAL_LEVELS - (levelIndex + 1)} more to go!`}
          </p>
        </div>
      )}

      {/* final victory screen */}
      {won && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/70 backdrop-blur-sm px-6">
          <div className="w-full max-w-md rounded-2xl border border-white/20 bg-[#12131f]/95 px-8 py-7 text-center text-white">
            <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-amber-300">All {TOTAL_LEVELS} levels cleared</p>
            <h2 className="mt-2 font-display text-3xl font-light italic">Dave conquers the cavern.</h2>
            <p className="mt-2 text-sm text-white/70">Total deaths: {deaths === 0 ? "0 — flawless!" : deaths}</p>
            <button
              type="button"
              onClick={() => { onRestartGame() }}
              className="mt-5 inline-flex items-center rounded-full border border-white/30 bg-white/10 px-6 py-3 font-mono text-xs tracking-widest uppercase hover:bg-white hover:text-black transition-colors"
            >
              ▶ Play again
            </button>
          </div>
        </div>
      )}

      {/* touch controls (phones) — hidden during overlays */}
      {started && !paused && !won && !cleared && <TouchControls />}
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
    "select-none grid place-items-center h-16 w-16 rounded-full border border-white/25 bg-black/45 backdrop-blur text-white text-2xl active:bg-white/25"
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 flex items-end justify-between px-4 pb-[max(18px,env(safe-area-inset-bottom))] md:hidden">
      {/* left/right movement */}
      <div className="flex gap-2" style={{ touchAction: "none" }}>
        <button className={btn} aria-label="Left" {...hold("left")}>◀</button>
        <button className={btn} aria-label="Right" {...hold("right")}>▶</button>
      </div>
      {/* jump */}
      <button className={`${btn} h-20 w-20 bg-red-500/70 text-sm`} aria-label="Jump" {...hold("jump")} style={{ touchAction: "none" }}>
        JUMP
      </button>
    </div>
  )
}
