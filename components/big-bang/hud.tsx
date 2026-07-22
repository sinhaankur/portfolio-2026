"use client"

/**
 * HUD for the Big Bang scene — a time scrubber across the whole cosmic history
 * (log scale) plus an info panel describing the current epoch (timestamp,
 * temperature, the physics, and an honest flag where the science is unknown).
 *
 * The scrubber writes into `tLogRef` (read by the scene every frame) and also
 * sets React state for the panel. An optional auto-play sweeps time forward.
 */

import { useEffect, useRef, useState } from "react"
import { EPOCHS, epochAtLog, epochToProgress, progressToLog } from "./timeline"

// Optional deep-link: `#t=0.97` opens the timeline parked at that 0..1 progress
// (and skips the auto-play sweep), so a specific moment — e.g. the Solar System
// forming — can be linked directly.
function readHashProgress(): number | null {
  if (typeof window === "undefined") return null
  const m = window.location.hash.match(/t=([0-9.]+)/)
  if (!m) return null
  const v = parseFloat(m[1])
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : null
}

export function BigBangHud({ tLogRef }: { tLogRef: React.MutableRefObject<number> }) {
  const hashStart = readHashProgress()
  const [progress, setProgress] = useState(hashStart ?? 0.0) // 0..1 slider
  const [playing, setPlaying] = useState(hashStart === null)
  const raf = useRef<number | null>(null)
  const last = useRef<number>(0)

  // push slider → tLogRef
  useEffect(() => {
    tLogRef.current = progressToLog(progress)
  }, [progress, tLogRef])

  // autoplay sweep (slow — the whole history in ~40s)
  useEffect(() => {
    if (!playing) return
    const step = (now: number) => {
      if (!last.current) last.current = now
      const dt = (now - last.current) / 1000
      last.current = now
      setProgress((p) => {
        const np = p + dt / 40
        if (np >= 1) { setPlaying(false); return 1 }
        return np
      })
      raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => { if (raf.current) cancelAnimationFrame(raf.current); last.current = 0 }
  }, [playing])

  const tLog = progressToLog(progress)
  const { epoch, index } = epochAtLog(tLog)

  return (
    <>
      {/* Epoch info panel — top-left. On mobile it's compact (essential epoch
          identity only) so it never grows down into the bottom scrubber; the
          longer prose appears from md+ where there's room. */}
      <div className="pointer-events-none fixed left-0 top-0 p-4 md:p-8 max-w-[88vw] sm:max-w-sm md:max-w-md z-20">
        <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-white/50 mb-2">
          {String(index + 1).padStart(2, "0")} / {EPOCHS.length} · cosmic timeline
        </p>
        <h2 className="font-display text-2xl sm:text-3xl md:text-5xl font-light text-white leading-[1.05]">
          {epoch.name}
        </h2>
        <div className="mt-2 md:mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11px] md:text-xs text-white/70">
          <span>t = {epoch.timeLabel}</span>
          <span>T ≈ {epoch.tempLabel}</span>
        </div>
        <p className="mt-3 md:mt-4 font-serif italic text-base sm:text-lg md:text-xl text-white/90">
          {epoch.headline}
        </p>
        {/* full description only where vertical space allows (avoids colliding
            with the bottom scrubber on phones) */}
        <p className="mt-3 font-sans text-sm md:text-base text-white/70 leading-relaxed hidden sm:block">
          {epoch.detail}
        </p>
        {epoch.speculative && (
          <p className="mt-2 md:mt-3 font-mono text-[10px] tracking-wider uppercase text-amber-300/80">
            ⚠ beyond tested physics — theoretical
          </p>
        )}
      </div>

      {/* Scrubber — bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-20 p-5 md:p-8">
        <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-black/40 backdrop-blur px-5 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => { last.current = 0; setPlaying((v) => !v) }}
              className="shrink-0 w-10 h-10 rounded-full border border-white/20 text-white grid place-items-center hover:bg-white/10 transition-colors"
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? "❚❚" : "▶"}
            </button>
            <div className="flex-1">
              <input
                type="range" min={0} max={1} step={0.0005} value={progress}
                onChange={(e) => { setPlaying(false); setProgress(parseFloat(e.target.value)) }}
                className="w-full accent-white cursor-pointer"
                aria-label="Scrub cosmic time"
              />
              {/* epoch ticks. The log axis crams the late-universe epochs into
                  the rightmost ~8% (recombination→today), so per-tick tap targets
                  would overlap and clip off-screen on a phone. Instead: the dots
                  stay purely VISUAL markers (the full-width range input above is
                  the scrub affordance, reliable on touch), and reliable epoch
                  JUMPING is offered through the dedicated chip row below. */}
              <div className="relative mt-1 h-2" aria-hidden="true">
                {EPOCHS.map((e, i) => {
                  const t = epochToProgress(i)
                  const active = e.id === epoch.id
                  return (
                    <span key={e.id}
                      title={`${e.name} · ${e.timeLabel}`}
                      className={`absolute top-0 -translate-x-1/2 w-1.5 h-1.5 rounded-full transition-colors ${active ? "bg-white" : "bg-white/35"}`}
                      style={{ left: `${Math.max(1, Math.min(99, t * 100))}%` }}
                    />
                  )
                })}
              </div>

              {/* Jump chips — horizontally scrollable on phones so every epoch
                  has a real ≥44px tap target regardless of log-axis crowding. */}
              <div className="mt-2 -mx-1 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {EPOCHS.map((e, i) => {
                  const t = epochToProgress(i)
                  const active = e.id === epoch.id
                  return (
                    <button key={e.id}
                      aria-label={`Jump to ${e.name}`}
                      aria-current={active ? "true" : undefined}
                      onClick={() => { setPlaying(false); setProgress(Math.max(0, Math.min(1, t))) }}
                      className={`shrink-0 rounded-full border px-3 py-1.5 font-mono text-[10px] tracking-wide whitespace-nowrap transition-colors ${
                        active
                          ? "border-white/70 bg-white/15 text-white"
                          : "border-white/15 text-white/55 hover:border-white/40 hover:text-white/90"
                      }`}
                    >
                      {e.name}
                    </button>
                  )
                })}
              </div>
            </div>
            <span className="hidden sm:block shrink-0 font-mono text-xs text-white/60 w-28 text-right">
              {epoch.timeLabel}
            </span>
          </div>
        </div>
      </div>
    </>
  )
}
