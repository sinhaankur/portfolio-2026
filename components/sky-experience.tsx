"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { StaticStarfield } from "./universe-engine/static-starfield"
import { GalaxyMusic } from "./galaxy-music"

// Same code-split as the home hero: the ~250 KB R3F engine streams in over the
// CSS starfield, so /sky paints instantly and the real sky blooms in after.
const UniverseEngine = dynamic(
  () => import("./universe-engine").then((m) => ({ default: m.UniverseEngine })),
  { ssr: false },
)

/**
 * /sky — the Universe Engine as a calm ambient window. No HUD, no labels, no
 * timeline: the passive journey drifts through the real sky (Milky Way, the
 * solar system, Saturn, Sgr A*, M87*…) and asks nothing of you. The one
 * control on the page is the opt-in piano (Einaudi). Fullscreen it and leave
 * it on.
 */
export function SkyExperience() {
  const [engineReady, setEngineReady] = useState(false)
  const [restful, setRestful] = useState(false)

  // The engine announces itself the same way it does on the home page.
  useEffect(() => {
    const onReady = () => setEngineReady(true)
    window.addEventListener("universe-ready", onReady)
    return () => window.removeEventListener("universe-ready", onReady)
  }, [])

  // After a quiet minute the page chrome (caption, wayfinding) fades away
  // entirely — just the sky. Any pointer or key press brings it back.
  useEffect(() => {
    let timer = setTimeout(() => setRestful(true), 60000)
    const wake = () => {
      setRestful(false)
      clearTimeout(timer)
      timer = setTimeout(() => setRestful(true), 60000)
    }
    window.addEventListener("pointermove", wake)
    window.addEventListener("keydown", wake)
    return () => {
      clearTimeout(timer)
      window.removeEventListener("pointermove", wake)
      window.removeEventListener("keydown", wake)
    }
  }, [])

  const chrome = `transition-opacity duration-1000 ${restful ? "opacity-0" : "opacity-100"}`

  return (
    <div className="fixed inset-0 bg-[#030308]">
      {/* CSS starfield underneath; the engine crossfades in over it. */}
      <div className="absolute inset-0">
        <StaticStarfield />
      </div>
      <div
        className={`absolute inset-0 transition-opacity duration-[2000ms] ${engineReady ? "opacity-100" : "opacity-0"}`}
      >
        <UniverseEngine interactive={false} showHud={false} showMusic={false} invert={false} />
      </div>

      {/* One line, bottom-left. It says what this is, then gets out of the way. */}
      <div className={`absolute bottom-6 left-6 md:bottom-8 md:left-10 z-20 pointer-events-none ${chrome}`}>
        <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-white/40">
          The sky, as it is right now
        </p>
        <p className="mt-1 font-sans text-[11px] text-white/25">
          Real positions, real time. Stay as long as you like.
        </p>
      </div>

      {/* The page's single control: opt-in piano. */}
      <div className={`absolute bottom-6 right-6 md:bottom-8 md:right-10 z-20 ${chrome}`}>
        <GalaxyMusic />
      </div>

      {/* Quiet wayfinding home. */}
      <div className={`absolute top-5 left-6 md:top-6 md:left-10 z-20 ${chrome}`}>
        <Link
          href="/"
          className="font-mono text-[10px] tracking-[0.25em] uppercase text-white/30 hover:text-white/70 transition-colors"
        >
          sinhaankur.com
        </Link>
      </div>
    </div>
  )
}
