"use client"

/**
 * LabWaveBackground — the Lab breathes over the sea.
 *
 * A fixed, full-richness loop of the real ocean sits behind the whole Lab page
 * (the same footage that became the Waves engine), graded cinematically so
 * "learning AI by building it" plays out over living water — the sea reads clear
 * and alive, with legibility handled by targeted text bands (not a full wash that
 * erases the ocean). The soundtrack is the sea itself — the real
 * wave-breaking noise, opt-in via a small chip (never autoplays; browsers
 * block it and we respect that, same discipline as the galaxy music chip).
 *
 * Purely decorative: pointer-events-none, aria-hidden, behind a legibility
 * scrim so the content stays readable. Honors prefers-reduced-motion.
 */

import { useEffect, useRef, useState } from "react"
import { prefersLiteMedia } from "@/lib/device-tier"

export function LabWaveBackground() {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  // Skip the ~15 MB decorative wave VIDEO and show the light poster instead when:
  //  · the user prefers reduced motion,
  //  · the screen is small (phone — save the download + battery),
  //  · or the connection is metered / slow (Save-Data, or 2g/3g).
  // The poster (~0.2 MB) still gives the ocean feel; the video is a nice-to-have.
  const [lite, setLite] = useState(true) // default lite until we confirm it's safe

  useEffect(() => {
    // One shared device+network decision (screen, tier, RAM, Save-Data, 2g/3g,
    // reduced-motion) — the same primitive the Universe Engine uses, so the whole
    // site adapts consistently instead of each component guessing.
    setLite(prefersLiteMedia())
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
      {/* Fixed ocean backdrop, behind the content (z-0; content sits at z-10).
          A deep teal base shows through while the video loads, so it reads as the
          SEA — never the grey void it used to look like. */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#06202e]" aria-hidden>
        {!lite ? (
          <video
            // Full, RICH ocean at full strength (no opacity knockdown). The footage
            // + poster are now CROPPED to water-only — the dull overcast sky that
            // used to dominate the frame (and read "grey/sad") is gone, so the
            // sparkling sea fills the whole backdrop.
            className="h-full w-full object-cover"
            src="/video/wave.mp4"
            poster="/video/wave-poster.jpg"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
          />
        ) : (
          // Lite (mobile / reduced-motion / metered): the water-only poster at full
          // richness, no video download. Same living sea, a fraction of the bytes.
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/video/wave-poster.webp" alt="" className="h-full w-full object-cover" loading="lazy" />
        )}
        {/* LIGHT, cinematic grade — the sea stays RICH + visible (the old heavy
            background-wash is what greyed it into "sad"). A gentle teal multiply
            deepens the water a touch; legibility now comes from the frosted content
            panels on the page itself, not from drowning the ocean in a scrim. */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a3346]/15 via-transparent to-[#03111c]/25 mix-blend-multiply" />
        {/* The lightest possible theme tint so the page still feels cohesive with
            the rest of the site, without erasing the water (was /70 → now /25). */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/5 to-background/35" />
        {/* Cinematic edge vignette — draws the eye to the centre, like a film frame. */}
        <div className="absolute inset-0" style={{ boxShadow: "inset 0 0 200px 50px rgba(2,10,20,0.4)" }} />
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
