"use client"

import dynamic from "next/dynamic"
import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { StaticStarfield } from "@/components/universe-engine/static-starfield"
import { UniverseRuntimeFallback } from "@/components/universe-engine/runtime-fallback"

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
        label: "Open Universe Assistant",
        description: "Use natural language to steer the engine.",
        href: "/lab/universe-assistant",
        kind: "route",
      },
    ],
    [engineLive],
  )

  useEffect(() => {
    actionRefs.current[0]?.focus()
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
    <main className="min-h-screen bg-[#050505] text-[#f5f5f0] overflow-hidden">
      <div className="relative min-h-screen px-4 py-4 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute inset-0">
          <StaticStarfield />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(90,161,255,0.08),transparent_28%)]" />
        </div>

        <div className="relative grid min-h-[calc(100vh-2rem)] gap-4 lg:grid-cols-[minmax(260px,0.9fr)_minmax(0,1.5fr)] lg:gap-6">
          <section className="flex h-full flex-col justify-between rounded-[28px] border border-white/10 bg-black/55 p-6 backdrop-blur-md sm:p-8 lg:p-10">
            <div className="space-y-5">
              <p className="font-mono text-[10px] tracking-[0.28em] uppercase text-white/45">
                LG webOS · Smart TV shell
              </p>
              <div className="space-y-4">
                <h1 className="max-w-[10ch] font-serif text-4xl leading-none sm:text-5xl lg:text-6xl">
                  Universe Engine TV
                </h1>
                <p className="max-w-prose text-sm leading-relaxed text-white/72 sm:text-base">
                  A remote-friendly launch surface for the Universe Engine,
                  tuned for LG webOS and other smart TV browsers. Large focus
                  targets, shallow navigation, and a single-step path into the
                  live experience.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-relaxed text-white/75">
                <p className="font-mono text-[10px] tracking-[0.24em] uppercase text-white/50">
                  Remote controls
                </p>
                <p className="mt-2">
                  Arrow keys move focus. OK/Enter activates. Back or Escape
                  returns home.
                </p>
              </div>

              <div className="space-y-3">
                {actions.map((action, index) => (
                  <button
                    key={action.label}
                    ref={(node) => {
                      actionRefs.current[index] = node
                    }}
                    type="button"
                    onClick={() => activateAction(action)}
                    className="group w-full rounded-2xl border border-white/12 bg-white/6 px-5 py-4 text-left transition-all duration-200 hover:border-white/28 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#90c4ff] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-medium text-base sm:text-lg">
                        {action.label}
                      </span>
                      <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-white/35">
                        {index === 0 ? "Primary" : "Open"}
                      </span>
                    </div>
                    <p className="mt-2 max-w-[34ch] text-sm leading-relaxed text-white/65">
                      {action.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 border-t border-white/10 pt-5 text-xs leading-relaxed text-white/50">
              Publishing target: one static TV-friendly route now, then a
              packaged webOS shell that can point at this experience or ship it
              locally.
            </div>
          </section>

          <section className="relative min-h-[60vh] overflow-hidden rounded-[28px] border border-white/10 bg-black/70 shadow-2xl shadow-black/40 lg:min-h-full">
            <UniverseRuntimeFallback>
              <div className="absolute inset-0">
                <UniverseEngine interactive={engineLive} showHud={false} showMusic={false} />
              </div>
            </UniverseRuntimeFallback>

            <div className="pointer-events-none absolute inset-x-4 top-4 z-20 rounded-2xl border border-white/10 bg-black/55 px-4 py-3 backdrop-blur-md sm:left-4 sm:right-auto sm:max-w-md">
              <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-white/50">
                TV preview
              </p>
              <p className="mt-1 text-sm leading-relaxed text-white/78">
                {engineLive
                  ? "Interactive mode is live. Use a pointer, mouse, or touch-capable TV to explore the engine in-place."
                  : "Preview mode is active. The engine auto-cycles canonical sights while the menu stays remote-friendly."}
              </p>
            </div>

            <div className="pointer-events-none absolute inset-x-4 bottom-4 z-20 rounded-2xl border border-white/10 bg-black/50 px-4 py-3 backdrop-blur-md sm:left-4 sm:right-auto sm:max-w-lg">
              <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-white/45">
                Next step
              </p>
              <p className="mt-1 text-sm leading-relaxed text-white/72">
                Build the webOS package around this route, then test on the LG
                simulator and a physical TV.
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}