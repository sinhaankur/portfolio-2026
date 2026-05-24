"use client"

/**
 * Star Cleaver — defender game entry.
 *
 * Owns React state for the high-level game phase (title / briefing /
 * combat / charging / firing / victory / defeat / paused), and
 * polls the AlienSwarm's imperative handle on a tick to react to
 * kills + leaks. Aim and beam-fire are ref-driven so the inner
 * scene doesn't re-render every frame.
 *
 * Mobile-first: every control reachable with a thumb. The fire
 * button is a 56px+ target. Aim is set by dragging anywhere over
 * the scene; the reticle visualises where the next beam will go.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { Vector3 } from "three"
import {
  StarCleaverScene,
  aimToWorldDir,
  type AlienHandle,
} from "./scene"
import {
  BEAM_DURATION_MS,
  CHARGE_PER_SEC,
  DAMAGE_PER_LEAK,
  INITIAL_STATE,
  INTERWAVE_PAUSE_MS,
  MIN_CHARGE_TO_FIRE,
  SCORE_PER_KILL,
  SCORE_PER_WAVE,
  WAVES_PER_WORLD,
  enemiesForWave,
  isAimable,
  type GameState,
  type Phase,
} from "./state"
import { WORLDS, WORLD_COUNT } from "./targets"

const ORIGIN_VIDEO_URL = "https://www.youtube.com/watch?v=IGhZWH-umSk"

export function StarCleaver() {
  const [state, setState] = useState<GameState>(INITIAL_STATE)

  // Refs the scene + swarm read each frame.
  const aimWorldDirRef = useRef(new Vector3(0, 0, -1))
  const alienHandleRef = useRef<AlienHandle | null>(null)
  const sceneContainerRef = useRef<HTMLDivElement | null>(null)

  /* ---------- Aim handling ---------- */

  const updateAimFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const el = sceneContainerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const halfSpan = Math.min(rect.width, rect.height) * 0.5
      const ax = (clientX - cx) / halfSpan
      const ay = -(clientY - cy) / halfSpan
      // Clamp to the visible unit circle.
      const r2 = ax * ax + ay * ay
      const clamp = r2 > 1 ? 1 / Math.sqrt(r2) : 1
      const next = { x: ax * clamp, y: ay * clamp }
      aimWorldDirRef.current.copy(aimToWorldDir(next))
      setState((s) => (isAimable(s.phase) ? { ...s, aim: next } : s))
    },
    [],
  )

  useEffect(() => {
    if (!isAimable(state.phase)) return
    const handlePointer = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.closest("[data-fire-button]")) return
      updateAimFromPointer(e.clientX, e.clientY)
    }
    window.addEventListener("pointermove", handlePointer, { passive: true })
    return () => window.removeEventListener("pointermove", handlePointer)
  }, [state.phase, updateAimFromPointer])

  /* ---------- Charge tick ---------- */

  useEffect(() => {
    if (state.phase !== "charging") return
    let rafId = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      setState((s) => {
        if (s.phase !== "charging") return s
        const charge = Math.min(1, s.charge + CHARGE_PER_SEC * dt)
        return { ...s, charge }
      })
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [state.phase])

  /* ---------- Phase transitions ---------- */

  const beginDefense = useCallback(() => {
    setState((s) => ({ ...s, phase: "briefing" }))
  }, [])

  const engage = useCallback(() => {
    setState((s) => ({
      ...s,
      phase: "combat",
      wave: 0,
      charge: 0,
      planetHealth: s.worldIndex === 0 ? 1 : s.planetHealth, // reset on first world only
    }))
    // Spawn wave 0.
    const swarm = alienHandleRef.current
    if (swarm) {
      swarm.spawnWave(enemiesForWave(0), 1)
    }
  }, [])

  const onFirePress = useCallback(() => {
    setState((s) => (s.phase === "combat" ? { ...s, phase: "charging" } : s))
  }, [])

  const onFireRelease = useCallback(() => {
    setState((s) => {
      if (s.phase !== "charging") return s
      if (s.charge < MIN_CHARGE_TO_FIRE) {
        return { ...s, phase: "combat", charge: 0 }
      }
      // Fire: run hit test now while we have the current aim.
      const swarm = alienHandleRef.current
      let kills = 0
      if (swarm) {
        // Origin: emitter is roughly at (0, -1.5, 6.9) in world space.
        // (Player ship pos + emitter local · ship scale.)
        const origin = new Vector3(0, -1.5, 6.9)
        kills = swarm.hitTest(origin, aimWorldDirRef.current)
      }
      return {
        ...s,
        phase: "firing",
        charge: 0,
        score: s.score + kills * SCORE_PER_KILL,
      }
    })
  }, [])

  // Beam visible window then back to combat.
  useEffect(() => {
    if (state.phase !== "firing") return
    const id = window.setTimeout(() => {
      setState((s) => (s.phase === "firing" ? { ...s, phase: "combat" } : s))
    }, BEAM_DURATION_MS)
    return () => window.clearTimeout(id)
  }, [state.phase])

  /* ---------- Swarm event pump ---------- */

  // Poll the swarm each animation frame for kill/leak events and to
  // detect wave-empty conditions. Cheap: just consumes counters.
  useEffect(() => {
    if (state.phase !== "combat" && state.phase !== "charging" && state.phase !== "firing")
      return
    let rafId = 0
    const tick = () => {
      const swarm = alienHandleRef.current
      if (swarm) {
        const { leaks, aliveCount } = swarm.consumeEvents()
        if (leaks > 0) {
          setState((s) => {
            const nextHealth = Math.max(0, s.planetHealth - DAMAGE_PER_LEAK * leaks)
            if (nextHealth <= 0) {
              return { ...s, phase: "defeat", planetHealth: 0 }
            }
            return { ...s, planetHealth: nextHealth }
          })
        }
        if (aliveCount === 0) {
          // Wave cleared — bonus, advance.
          setState((s) => {
            if (s.phase === "defeat" || s.phase === "victory") return s
            const nextWave = s.wave + 1
            const isLastWaveOfWorld = nextWave >= WAVES_PER_WORLD
            const isLastWorld = s.worldIndex >= WORLD_COUNT - 1
            if (isLastWaveOfWorld && isLastWorld) {
              return {
                ...s,
                phase: "victory",
                score: s.score + SCORE_PER_WAVE,
              }
            }
            // Schedule next wave after a brief pause; we set wave/world
            // here, but actually spawn the swarm in a follow-up effect
            // because we don't have stable access to the swarm handle
            // mid-callback (we do, but keeping discipline).
            return {
              ...s,
              phase: "briefing",
              wave: isLastWaveOfWorld ? 0 : nextWave,
              worldIndex: isLastWaveOfWorld ? s.worldIndex + 1 : s.worldIndex,
              score: s.score + SCORE_PER_WAVE,
              planetHealth: isLastWaveOfWorld ? 1 : s.planetHealth, // heal on new world
            }
          })
        }
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [state.phase])

  /* ---------- Auto-spawn next wave after the briefing pause ---------- */

  // When the briefing arrives between waves (not from the title flow),
  // auto-advance into combat after INTERWAVE_PAUSE_MS. The first
  // briefing (from title) waits for the explicit Engage button.
  useEffect(() => {
    if (state.phase !== "briefing") return
    // Only auto-advance if the swarm has been spawned at least once.
    // The "from title" case happens when worldIndex is still 0 AND
    // alienHandleRef has never been called — but we don't track that
    // explicitly. Instead, we detect "between waves" by: are there
    // currently zero aliens AND we have a non-zero wave or worldIndex?
    if (state.worldIndex === 0 && state.wave === 0 && state.score === 0) return
    const id = window.setTimeout(() => {
      setState((s) => {
        if (s.phase !== "briefing") return s
        return { ...s, phase: "combat", charge: 0 }
      })
      const swarm = alienHandleRef.current
      if (swarm) {
        const speedMul = 1 + state.worldIndex * 0.12 + state.wave * 0.08
        swarm.spawnWave(enemiesForWave(state.wave), speedMul)
      }
    }, INTERWAVE_PAUSE_MS)
    return () => window.clearTimeout(id)
  }, [state.phase, state.wave, state.worldIndex, state.score])

  /* ---------- Keyboard controls ---------- */

  useEffect(() => {
    const handleDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault()
        if (state.phase === "combat") onFirePress()
      }
      if (e.code === "Escape") {
        setState((s) =>
          ["combat", "charging", "firing"].includes(s.phase)
            ? { ...s, phase: "paused" }
            : s.phase === "paused"
              ? { ...s, phase: "combat" }
              : s,
        )
      }
      if (e.code === "Enter") {
        if (state.phase === "title") beginDefense()
        else if (state.phase === "briefing" && state.worldIndex === 0 && state.wave === 0)
          engage()
      }
    }
    const handleUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault()
        if (state.phase === "charging") onFireRelease()
      }
    }
    window.addEventListener("keydown", handleDown)
    window.addEventListener("keyup", handleUp)
    return () => {
      window.removeEventListener("keydown", handleDown)
      window.removeEventListener("keyup", handleUp)
    }
  }, [
    state.phase,
    state.worldIndex,
    state.wave,
    beginDefense,
    engage,
    onFirePress,
    onFireRelease,
  ])

  const restart = useCallback(() => {
    const swarm = alienHandleRef.current
    if (swarm) swarm.clear()
    setState({ ...INITIAL_STATE, showOriginLink: false })
  }, [])

  const world = WORLDS[state.worldIndex]

  return (
    <div
      ref={sceneContainerRef}
      className="relative w-full h-full min-h-[560px] overflow-hidden rounded-lg border border-border bg-background"
    >
      <StarCleaverScene
        state={state}
        aimWorldDirRef={aimWorldDirRef}
        alienHandleRef={alienHandleRef}
      />

      {/* Reticle. */}
      {isAimable(state.phase) && <Reticle aim={state.aim} />}

      {/* Top status bar. */}
      <TopStatus
        phase={state.phase}
        worldName={world.name}
        wave={state.wave}
      />

      {/* Top-right score. */}
      {isAimable(state.phase) && (
        <ScoreBadge score={state.score} />
      )}

      {/* Top-centre planet health. */}
      {isAimable(state.phase) && (
        <PlanetHealthBar health={state.planetHealth} worldName={world.name} />
      )}

      {/* Overlays. */}
      {state.phase === "title" && (
        <TitleOverlay onBegin={beginDefense} showOriginLink={state.showOriginLink} />
      )}
      {state.phase === "briefing" && (
        <BriefingOverlay
          world={world}
          wave={state.wave}
          worldIndex={state.worldIndex}
          isFirstBriefing={state.worldIndex === 0 && state.wave === 0 && state.score === 0}
          onEngage={engage}
        />
      )}
      {state.phase === "paused" && (
        <PauseOverlay
          onResume={() => setState((s) => ({ ...s, phase: "combat" }))}
          onRestart={restart}
        />
      )}
      {state.phase === "victory" && (
        <VictoryOverlay score={state.score} onRestart={restart} />
      )}
      {state.phase === "defeat" && (
        <DefeatOverlay worldName={world.name} score={state.score} onRestart={restart} />
      )}

      {(state.phase === "combat" || state.phase === "charging" || state.phase === "firing") && (
        <BottomHud
          charge={state.charge}
          firing={state.phase === "firing"}
          onFirePress={onFirePress}
          onFireRelease={onFireRelease}
        />
      )}
    </div>
  )
}

/* ============================================================
 * HUD pieces
 * ============================================================ */

function Reticle({ aim }: { aim: { x: number; y: number } }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-10">
      <div className="relative aspect-square h-full max-h-full max-w-full">
        <div
          className="absolute"
          style={{
            left: `${50 + aim.x * 50}%`,
            top: `${50 - aim.y * 50}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          <div className="relative">
            <div className="w-9 h-9 rounded-full border border-[#b466ff]/60" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-px h-3.5 bg-[#b466ff]" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-px w-3.5 bg-[#b466ff]" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 bg-[#b466ff] rounded-full" />
          </div>
        </div>
      </div>
    </div>
  )
}

function TopStatus({
  phase,
  worldName,
  wave,
}: {
  phase: Phase
  worldName: string
  wave: number
}) {
  return (
    <div className="pointer-events-none absolute top-3 left-3 sm:top-4 sm:left-4 z-20">
      <div className="font-mono text-[10px] sm:text-xs uppercase tracking-[0.18em] text-white/80 bg-black/45 px-2.5 py-1.5 rounded backdrop-blur-sm border border-white/10">
        {worldName} · Wave {wave + 1}/{WAVES_PER_WORLD} · {phaseLabel(phase)}
      </div>
    </div>
  )
}

function ScoreBadge({ score }: { score: number }) {
  return (
    <div className="pointer-events-none absolute top-3 right-16 sm:top-4 sm:right-20 z-20">
      <div className="font-mono text-[10px] sm:text-xs uppercase tracking-[0.18em] text-white/80 bg-black/45 px-2.5 py-1.5 rounded backdrop-blur-sm border border-white/10">
        Score · {score.toLocaleString()}
      </div>
    </div>
  )
}

function PlanetHealthBar({
  health,
  worldName,
}: {
  health: number
  worldName: string
}) {
  const pct = Math.round(health * 100)
  const critical = health < 0.3
  return (
    <div className="pointer-events-none absolute top-14 sm:top-16 left-1/2 -translate-x-1/2 z-20 w-[180px] sm:w-[240px]">
      <div className="font-mono text-[9px] sm:text-[10px] uppercase tracking-[0.22em] text-white/65 mb-1 text-center">
        {worldName} integrity · {pct}%
      </div>
      <div className="relative h-1.5 w-full rounded-full bg-white/10 overflow-hidden border border-white/10">
        <div
          className="absolute inset-y-0 left-0 transition-[width] duration-150"
          style={{
            width: `${pct}%`,
            background: critical
              ? "linear-gradient(90deg, #ff5a5a, #ff9a9a)"
              : "linear-gradient(90deg, #8ab6e8, #ffffff)",
          }}
        />
      </div>
    </div>
  )
}

function phaseLabel(phase: Phase): string {
  switch (phase) {
    case "title":
      return "Standby"
    case "briefing":
      return "Briefing"
    case "combat":
      return "Hold the line"
    case "charging":
      return "Charging"
    case "firing":
      return "Firing"
    case "victory":
      return "World saved"
    case "defeat":
      return "Overrun"
    case "paused":
      return "Paused"
  }
}

function BottomHud({
  charge,
  firing,
  onFirePress,
  onFireRelease,
}: {
  charge: number
  firing: boolean
  onFirePress: () => void
  onFireRelease: () => void
}) {
  const pct = Math.round(charge * 100)
  const ready = charge >= MIN_CHARGE_TO_FIRE
  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-5 pt-3 sm:pb-6 flex flex-col items-center gap-3 pointer-events-none">
      <div className="w-full max-w-[280px] sm:max-w-[320px] pointer-events-none">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/70 mb-1.5 text-center">
          Charge · {pct}%
        </div>
        <div className="relative h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 transition-[width] duration-75"
            style={{
              width: `${pct}%`,
              background: ready
                ? "linear-gradient(90deg, #b466ff, #ffffff)"
                : "linear-gradient(90deg, #5a3a8a, #b466ff)",
            }}
          />
          <div
            className="absolute inset-y-0"
            style={{
              left: `${MIN_CHARGE_TO_FIRE * 100}%`,
              width: 1,
              background: "rgba(255,255,255,0.4)",
            }}
          />
        </div>
      </div>
      <button
        data-fire-button
        onPointerDown={(e) => {
          e.preventDefault()
          onFirePress()
        }}
        onPointerUp={(e) => {
          e.preventDefault()
          onFireRelease()
        }}
        onPointerLeave={onFireRelease}
        onPointerCancel={onFireRelease}
        className={`
          pointer-events-auto select-none touch-none
          min-h-[56px] min-w-[160px]
          px-7 py-3
          font-mono text-xs sm:text-sm uppercase tracking-[0.22em]
          rounded-full
          border transition-colors
          ${
            firing
              ? "bg-white text-black border-white shadow-[0_0_24px_rgba(255,255,255,0.6)]"
              : ready
                ? "bg-[#b466ff] text-black border-[#b466ff] shadow-[0_0_24px_rgba(180,102,255,0.55)]"
                : "bg-white/5 text-white border-white/30 hover:bg-white/10"
          }
        `}
      >
        {firing ? "Firing" : ready ? "Release to fire" : "Hold to charge"}
      </button>
    </div>
  )
}

/* ---------- Overlays ---------- */

function TitleOverlay({
  onBegin,
  showOriginLink,
}: {
  onBegin: () => void
  showOriginLink: boolean
}) {
  return (
    <OverlayShell>
      <div className="text-center max-w-md">
        <div className="font-mono text-[10px] sm:text-xs uppercase tracking-[0.28em] text-white/60 mb-3">
          Working title
        </div>
        <h2 className="text-3xl sm:text-4xl font-serif italic text-white mb-3">
          Star Cleaver
        </h2>
        <p className="text-sm sm:text-base text-white/75 leading-relaxed mb-6">
          A weapon woke up. It chose us.
          <br />
          <span className="text-white/55">
            Seven worlds. Wave after wave. Hold the line.
          </span>
        </p>
        <button
          onClick={onBegin}
          className="
            min-h-[48px] px-8 py-3
            font-mono text-xs uppercase tracking-[0.22em]
            rounded-full
            bg-white text-black
            hover:bg-white/90 transition-colors
          "
        >
          Begin defense →
        </button>
        {showOriginLink && (
          <div className="mt-5 text-[11px] sm:text-xs text-white/45">
            <a
              href={ORIGIN_VIDEO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 hover:text-white/70"
            >
              Watch the origin clip ↗
            </a>
            <span className="px-1.5">·</span>
            <span>opens YouTube in a new tab</span>
          </div>
        )}
      </div>
    </OverlayShell>
  )
}

function BriefingOverlay({
  world,
  wave,
  worldIndex,
  isFirstBriefing,
  onEngage,
}: {
  world: (typeof WORLDS)[number]
  wave: number
  worldIndex: number
  isFirstBriefing: boolean
  onEngage: () => void
}) {
  return (
    <OverlayShell>
      <div className="text-center max-w-md">
        <div className="font-mono text-[10px] sm:text-xs uppercase tracking-[0.22em] text-[#b466ff] mb-2">
          World {worldIndex + 1} of {WORLD_COUNT} · {world.kind}
        </div>
        <h3 className="text-2xl sm:text-3xl font-serif text-white mb-2">
          {world.name}
        </h3>
        <div className="font-mono text-[10px] sm:text-xs uppercase tracking-[0.18em] text-white/55 mb-4">
          Wave {wave + 1} of {WAVES_PER_WORLD}
        </div>
        <p className="text-sm text-white/70 leading-relaxed mb-6 italic">
          {world.briefing}
        </p>
        {isFirstBriefing ? (
          <button
            onClick={onEngage}
            className="
              min-h-[48px] px-7 py-3
              font-mono text-xs uppercase tracking-[0.22em]
              rounded-full
              border border-[#b466ff] text-[#b466ff]
              hover:bg-[#b466ff] hover:text-black transition-colors
            "
          >
            Engage →
          </button>
        ) : (
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">
            Stand by ·  {Math.ceil(INTERWAVE_PAUSE_MS / 1000)}s
          </div>
        )}
      </div>
    </OverlayShell>
  )
}

function PauseOverlay({
  onResume,
  onRestart,
}: {
  onResume: () => void
  onRestart: () => void
}) {
  return (
    <OverlayShell>
      <div className="text-center max-w-sm">
        <h3 className="text-2xl font-serif text-white mb-6">Paused</h3>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={onResume}
            className="min-h-[48px] px-6 py-3 font-mono text-xs uppercase tracking-[0.22em] rounded-full bg-white text-black hover:bg-white/90 transition-colors"
          >
            Resume
          </button>
          <button
            onClick={onRestart}
            className="min-h-[48px] px-6 py-3 font-mono text-xs uppercase tracking-[0.22em] rounded-full border border-white/40 text-white hover:bg-white/10 transition-colors"
          >
            Restart
          </button>
        </div>
      </div>
    </OverlayShell>
  )
}

function VictoryOverlay({ score, onRestart }: { score: number; onRestart: () => void }) {
  return (
    <OverlayShell>
      <div className="text-center max-w-md">
        <div className="font-mono text-[10px] sm:text-xs uppercase tracking-[0.28em] text-white/60 mb-3">
          All worlds defended
        </div>
        <h3 className="text-3xl sm:text-4xl font-serif italic text-white mb-3">
          They didn&apos;t get past you.
        </h3>
        <p className="text-sm text-white/65 leading-relaxed mb-3">
          Seven worlds intact. The Cleaver is still warm. The next
          fleet is months away. Earth&apos;s long-range arrays will
          see them coming.
        </p>
        <div className="font-mono text-sm uppercase tracking-[0.22em] text-[#b466ff] mb-6">
          Final score · {score.toLocaleString()}
        </div>
        <button
          onClick={onRestart}
          className="min-h-[48px] px-8 py-3 font-mono text-xs uppercase tracking-[0.22em] rounded-full border border-white/40 text-white hover:bg-white/10 transition-colors"
        >
          Run sequence again
        </button>
      </div>
    </OverlayShell>
  )
}

function DefeatOverlay({
  worldName,
  score,
  onRestart,
}: {
  worldName: string
  score: number
  onRestart: () => void
}) {
  return (
    <OverlayShell>
      <div className="text-center max-w-md">
        <div className="font-mono text-[10px] sm:text-xs uppercase tracking-[0.28em] text-red-400/80 mb-3">
          {worldName} · Overrun
        </div>
        <h3 className="text-3xl sm:text-4xl font-serif italic text-white mb-3">
          They got through.
        </h3>
        <p className="text-sm text-white/65 leading-relaxed mb-3">
          The Cleaver kept firing until the last leak. It was not
          enough. The remaining worlds will need someone better.
        </p>
        <div className="font-mono text-sm uppercase tracking-[0.22em] text-white/70 mb-6">
          Score · {score.toLocaleString()}
        </div>
        <button
          onClick={onRestart}
          className="min-h-[48px] px-8 py-3 font-mono text-xs uppercase tracking-[0.22em] rounded-full border border-white/40 text-white hover:bg-white/10 transition-colors"
        >
          Try again
        </button>
      </div>
    </OverlayShell>
  )
}

function OverlayShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="
        absolute inset-0 z-30
        flex items-center justify-center
        bg-black/55 backdrop-blur-[3px]
        px-5
      "
    >
      {children}
    </div>
  )
}
