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
import { EPOCHS, epochAtLog, progressToLog, T_LOG_MIN, T_LOG_MAX } from "./timeline"

export function BigBangHud({ tLogRef }: { tLogRef: React.MutableRefObject<number> }) {
  const [progress, setProgress] = useState(0.0) // 0..1 slider
  const [playing, setPlaying] = useState(true)
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
      {/* Epoch info panel — top-left */}
      <div className="pointer-events-none fixed left-0 top-0 p-5 md:p-8 max-w-md z-20">
        <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-white/50 mb-2">
          {String(index + 1).padStart(2, "0")} / {EPOCHS.length} · cosmic timeline
        </p>
        <h2 className="font-display text-3xl md:text-5xl font-light text-white leading-[1.05]">
          {epoch.name}
        </h2>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs text-white/70">
          <span>t = {epoch.timeLabel}</span>
          <span>T ≈ {epoch.tempLabel}</span>
        </div>
        <p className="mt-4 font-serif italic text-lg md:text-xl text-white/90">
          {epoch.headline}
        </p>
        <p className="mt-3 font-sans text-sm md:text-base text-white/70 leading-relaxed">
          {epoch.detail}
        </p>
        {epoch.speculative && (
          <p className="mt-3 font-mono text-[10px] tracking-wider uppercase text-amber-300/80">
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
              {/* epoch ticks */}
              <div className="relative mt-1 h-3">
                {EPOCHS.map((e) => {
                  const t = (Math.log10(e.timeSeconds) - T_LOG_MIN) / (T_LOG_MAX - T_LOG_MIN)
                  return (
                    <span key={e.id}
                      title={`${e.name} · ${e.timeLabel}`}
                      onClick={() => { setPlaying(false); setProgress(Math.max(0, Math.min(1, t))) }}
                      className="absolute -translate-x-1/2 w-1 h-1 rounded-full bg-white/40 hover:bg-white cursor-pointer"
                      style={{ left: `${t * 100}%` }}
                    />
                  )
                })}
              </div>
            </div>
            <span className="shrink-0 font-mono text-xs text-white/60 w-28 text-right">
              {epoch.timeLabel}
            </span>
          </div>
        </div>
      </div>
    </>
  )
}
