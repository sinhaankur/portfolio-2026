"use client"

/**
 * LabWaveBackground — the Lab breathes over the sea.
 *
 * A fixed, dimmed loop of the real ocean sits behind the whole Lab page (the
 * same footage that became the Waves engine), so "learning AI by building it"
 * plays out over living water. The soundtrack is the sea itself — the real
 * wave-breaking noise, opt-in via a small chip (never autoplays; browsers
 * block it and we respect that, same discipline as the galaxy music chip).
 *
 * Purely decorative: pointer-events-none, aria-hidden, behind a legibility
 * scrim so the content stays readable. Honors prefers-reduced-motion.
 */

import { useEffect, useRef, useState } from "react"

export function LabWaveBackground() {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReduced(m.matches)
    const on = () => setReduced(m.matches)
    m.addEventListener?.("change", on)
    return () => m.removeEventListener?.("change", on)
  }, [])

  function toggleSound() {
    const a = audioRef.current
    if (!a) return
    if (playing) {
      a.pause()
      setPlaying(false)
    } else {
      a.volume = 0
      a.play().then(() => {
        // gentle fade-in so the sea rises, doesn't slam
        let v = 0
        const id = setInterval(() => {
          v = Math.min(0.5, v + 0.03)
          a.volume = v
          if (v >= 0.5) clearInterval(id)
        }, 60)
        setPlaying(true)
      }).catch(() => {})
    }
  }

  return (
    <>
      {/* Fixed ocean backdrop, behind the content (z-0; content sits at z-10) */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#04121f]" aria-hidden>
        {!reduced ? (
          <video
            className="h-full w-full object-cover opacity-[0.6]"
            src="/video/wave.mp4"
            poster="/video/wave-poster.jpg"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
          />
        ) : (
          // reduced-motion: a still frame instead of moving video
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/video/wave-poster.jpg" alt="" className="h-full w-full object-cover opacity-50" />
        )}
        {/* Legibility scrim — lighter now so the waves read clearly, but still
            enough contrast under the text (heavier top+bottom, clear in the middle). */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/40 to-background/75" />
      </div>

      {/* The sea as soundtrack — opt-in wave noise */}
      <audio ref={audioRef} src="/video/wave-sound.m4a" loop preload="none" />
      <button
        onClick={toggleSound}
        data-cursor-hover
        aria-pressed={playing}
        className="fixed bottom-4 left-4 md:bottom-6 md:left-6 z-40 flex items-center gap-2 rounded-full border border-border bg-card/80 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.25em] text-foreground/80 backdrop-blur transition-colors hover:text-accent"
      >
        {playing ? "🌊 the sea" : "🔇 wave sound"}
      </button>
    </>
  )
}
