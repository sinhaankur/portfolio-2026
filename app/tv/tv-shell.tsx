"use client"

import dynamic from "next/dynamic"
import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { StaticStarfield } from "@/components/universe-engine/static-starfield"
import { UniverseRuntimeFallback } from "@/components/universe-engine/runtime-fallback"

// StaticStarfield is used as the engine's loading fallback below.

const UniverseEngine = dynamic(
  () => import("@/components/universe-engine").then((mod) => mod.UniverseEngine),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 bg-black">
        <StaticStarfield />
      </div>
    ),
  },
)

type TvAction = {
  label: string
  description: string
  href?: string
  kind: "engine" | "route"
}

export function TvShell() {
  const router = useRouter()
  const [engineLive, setEngineLive] = useState(false)
  const actionRefs = useRef<Array<HTMLButtonElement | null>>([])

  const actions = useMemo<TvAction[]>(
    () => [
      {
        label: engineLive ? "Pause preview" : "Start preview",
        description: "Launch the Universe Engine as a living backdrop.",
        kind: "engine",
      },
      {
        label: "Open Helion Drift",
        description: "Jump into the lab-side game experience.",
        href: "/lab/helion-drift",
        kind: "route",
      },
      {
        label: "Open the Satellite Engine",
        description: "Explore the sky — with a built-in AI copilot to steer it in plain language.",
        href: "/lab/celestial",
        kind: "route",
      },
    ],
    [engineLive],
  )

  // Cinematic chrome: the menu overlays a full-bleed living engine, then fades
  // so the universe fills the TV like a screensaver. Any remote key wakes it.
  const [chromeVisible, setChromeVisible] = useState(true)

  useEffect(() => {
    actionRefs.current[0]?.focus()
  }, [])

  // Auto-hide the menu after idle so the engine breathes full-screen; any key
  // press (remote nav) brings it back and resets the timer.
  useEffect(() => {
    let idle: ReturnType<typeof setTimeout>
    const arm = () => {
      clearTimeout(idle)
      setChromeVisible(true)
      idle = setTimeout(() => setChromeVisible(false), 7000)
    }
    arm()
    const wake = () => arm()
    window.addEventListener("keydown", wake)
    window.addEventListener("pointermove", wake)
    return () => {
      clearTimeout(idle)
      window.removeEventListener("keydown", wake)
      window.removeEventListener("pointermove", wake)
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const activeIndex = actionRefs.current.findIndex((el) => el === document.activeElement)
      if (activeIndex === -1) return

      if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        event.preventDefault()
        const nextIndex = (activeIndex + 1) % actionRefs.current.length
        actionRefs.current[nextIndex]?.focus()
      }

      if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        event.preventDefault()
        const nextIndex = (activeIndex - 1 + actionRefs.current.length) % actionRefs.current.length
        actionRefs.current[nextIndex]?.focus()
      }

      if (event.key === "Escape" || event.key === "Backspace") {
        event.preventDefault()
        router.push("/")
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [router])

  const activateAction = (action: TvAction) => {
    if (action.kind === "engine") {
      setEngineLive((current) => !current)
      return
    }

    if (action.href) {
      router.push(action.href)
    }
  }

  return (
    <main className="fixed inset-0 bg-black text-[#f5f5f0] overflow-hidden">
      {/* FULL-BLEED living engine — the whole TV is the universe, like a
          cinematic screensaver. Auto-tours canonical sights until the viewer
          takes control. */}
      <div className="absolute inset-0">
        <UniverseRuntimeFallback>
          <UniverseEngine interactive={engineLive} showHud={false} showMusic={false} realtime />
        </UniverseRuntimeFallback>
      </div>

      {/* Cinematic vignette so overlaid text stays legible over any scene. */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 transition-opacity duration-1000 ${chromeVisible ? "opacity-100" : "opacity-0"}`}
        style={{ background: "radial-gradient(120% 90% at 15% 50%, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.35) 42%, transparent 72%)" }}
      />

      {/* Overlaid nav — a slim elegant column on the left that fades after idle,
          so the universe fills the screen. Any remote key brings it back. */}
      <div
        className={`absolute inset-y-0 left-0 z-20 flex flex-col justify-center px-8 sm:px-12 lg:px-16 transition-all duration-700 ${
          chromeVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-6 pointer-events-none"
        }`}
      >
        <p className="font-mono text-[11px] tracking-[0.3em] uppercase text-[#90c4ff]/80 mb-3">
          Ankur Sinha · Universe Engine
        </p>
        <h1 className="font-serif text-5xl leading-[1.02] sm:text-6xl lg:text-7xl max-w-[12ch] mb-2">
          A real-time <span className="italic">galaxy</span>, on your TV.
        </h1>
        <p className="max-w-[42ch] text-base leading-relaxed text-white/70 mb-8">
          Real planets, real orbits, real satellites — rendered live. Sit back, or
          steer it with your remote.
        </p>

        <div className="space-y-2.5 max-w-md">
          {actions.map((action, index) => (
            <button
              key={action.label}
              ref={(node) => {
                actionRefs.current[index] = node
              }}
              type="button"
              onClick={() => activateAction(action)}
              className="group w-full rounded-2xl border border-white/12 bg-black/40 px-6 py-4 text-left backdrop-blur-md transition-all duration-200 hover:border-white/30 hover:bg-black/60 focus-visible:outline-none focus-visible:border-[#90c4ff] focus-visible:bg-black/70 focus-visible:ring-4 focus-visible:ring-[#90c4ff]/40"
            >
              <div className="flex items-center justify-between gap-4">
                <span className="font-medium text-lg sm:text-xl">{action.label}</span>
                <span aria-hidden className="text-[#90c4ff]/60 transition-transform duration-200 group-focus-visible:translate-x-1 group-hover:translate-x-1">→</span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-white/55">{action.description}</p>
            </button>
          ))}
        </div>

        <p className="mt-8 font-mono text-[10px] tracking-[0.22em] uppercase text-white/40">
          ▲▼ move · OK select · Back exits
        </p>
      </div>

      {/* A tiny persistent hint when chrome is hidden, so a viewer knows it's live. */}
      <div
        className={`pointer-events-none absolute bottom-6 right-8 z-20 font-mono text-[10px] tracking-[0.22em] uppercase text-white/35 transition-opacity duration-700 ${
          chromeVisible ? "opacity-0" : "opacity-100"
        }`}
      >
        Press any key for menu
      </div>
    </main>
  )
}