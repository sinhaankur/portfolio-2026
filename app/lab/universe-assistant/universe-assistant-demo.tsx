"use client"

import { type FormEvent, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { executeAssistantTool, searchUniverseCatalog } from "@/lib/assistant-tools"
import { StaticStarfield } from "@/components/universe-engine/static-starfield"
import { AssistantPanel } from "@/components/assistant"

// Lazy-load the engine same way the home hero does — keeps the ~250KB
// R3F bundle out of the initial HTML payload, fades in once mounted.
const UniverseEngine = dynamic(
  () =>
    import("@/components/universe-engine").then(
      (mod) => mod.UniverseEngine,
    ),
  {
    ssr: false,
    loading: () => <StaticStarfield />,
  },
)

export function UniverseAssistantDemo() {
  const [panelOpen, setPanelOpen] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchFocus, setSearchFocus] = useState(false)
  const [flyStatus, setFlyStatus] = useState<string | null>(null)

  const searchResults = useMemo(() => searchUniverseCatalog(searchQuery, 10), [searchQuery])

  const handleFlyTo = async (name: string) => {
    const result = await executeAssistantTool("flyToBody", { name })
    setFlyStatus(result.content)
    setSearchFocus(false)
  }

  const handleSearchSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (searchResults.length === 0) return
    await handleFlyTo(searchResults[0].name)
  }

  return (
    <div className="space-y-4">
      <div className="relative min-h-[78vh] md:min-h-[88vh] rounded-xl overflow-hidden ring-1 ring-white/10 bg-background">
        <UniverseEngine interactive showHud showMusic={false} />

        <div className="pointer-events-none absolute left-4 top-4 z-20 max-w-xs rounded-2xl border border-white/12 bg-black/55 px-4 py-3 backdrop-blur-sm">
          <p className="font-mono text-[10px] tracking-[0.24em] uppercase text-white/60">
            Universe First · Fullscreen View
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-white/78">
            Explore the simulation directly. The AI copilot is optional and can be opened only when needed.
          </p>
        </div>

        <div className="absolute left-4 top-24 z-30 pointer-events-auto w-[min(28rem,calc(100%-2rem))]">
          <form
            onSubmit={handleSearchSubmit}
            className="rounded-xl border border-white/14 bg-black/55 backdrop-blur-sm p-2"
          >
            <label className="sr-only" htmlFor="universe-inline-search">
              Search universe objects
            </label>
            <input
              id="universe-inline-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocus(true)}
              placeholder="Search planets, comets, hosts, constellations..."
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-white/35"
            />

            {searchFocus && searchQuery.trim().length > 0 && (
              <div className="mt-2 max-h-64 overflow-auto rounded-lg border border-white/12 bg-black/70">
                {searchResults.length > 0 ? (
                  <ul className="divide-y divide-white/10">
                    {searchResults.map((hit) => (
                      <li key={`${hit.source}:${hit.name}`}>
                        <button
                          type="button"
                          onClick={() => void handleFlyTo(hit.name)}
                          className="w-full px-3 py-2.5 text-left hover:bg-white/8 transition-colors"
                        >
                          <div className="text-sm text-white/90">{hit.name}</div>
                          <div className="mt-0.5 font-mono text-[10px] tracking-[0.18em] uppercase text-white/50">
                            {hit.kind}
                            {hit.subtitle ? ` · ${hit.subtitle}` : ""}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-3 py-3 text-xs text-white/60">No match in the current universe catalog.</p>
                )}
              </div>
            )}
          </form>
          {flyStatus && (
            <p className="mt-2 rounded-lg border border-white/12 bg-black/50 px-3 py-2 text-[11px] text-white/70">
              {flyStatus}
            </p>
          )}
        </div>

        <div className="absolute right-4 top-4 z-30 pointer-events-auto">
          <button
            type="button"
            onClick={() => setPanelOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/55 px-4 py-2.5 font-mono text-[10px] tracking-[0.22em] uppercase text-white/85 backdrop-blur-sm hover:border-white/35 hover:text-white transition-colors"
            aria-expanded={panelOpen}
            aria-label={panelOpen ? "Hide AI copilot" : "Show AI copilot"}
          >
            <span aria-hidden="true">*</span>
            {panelOpen ? "Hide Copilot" : "Open Copilot"}
          </button>
        </div>

        {panelOpen && (
          <aside
            className="
              absolute z-30 pointer-events-auto
              left-3 right-3 bottom-3 h-[52vh]
              md:left-auto md:right-0 md:top-0 md:bottom-0 md:h-full md:w-104
              border border-white/12 md:border-y-0 md:border-r-0 md:border-l-white/12
              bg-black/70 backdrop-blur-xl
              rounded-xl md:rounded-none overflow-hidden
            "
          >
            <AssistantPanel />
          </aside>
        )}
      </div>

      <div className="rounded-lg border border-border/70 bg-secondary/20 px-4 py-3">
        <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">Interaction model</p>
        <p className="mt-1 text-sm text-foreground/80 leading-relaxed">
          The universe remains the primary surface. Use the copilot to jump to objects, change time, or ask focused questions without leaving the fullscreen scene.
        </p>
      </div>
    </div>
  )
}
