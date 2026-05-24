"use client"

import dynamic from "next/dynamic"
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
  return (
    <div
      className="
        grid gap-6 lg:gap-8
        lg:grid-cols-[1.75fr_1fr]
        rounded-lg overflow-hidden
      "
    >
      {/* Engine viewport.
          Mobile: 4:5 ratio — taller than wide, gives the inner solar
            system enough vertical space to be legible on a 375px-wide
            phone. 16:10 (the old default) made it too flat to see Mars
            properly when stacked above the assistant.
          Tablet (sm+): 16:10 — landscape-leaning, fits the typical
            tablet-portrait viewport without overwhelming.
          Desktop (lg+): fills the available column height (≥ 560px). */}
      <div
        className="
          relative
          aspect-4/5 sm:aspect-16/10 lg:aspect-auto lg:min-h-140
          rounded-lg overflow-hidden
          ring-1 ring-white/10
          bg-background
        "
      >
        <UniverseEngine interactive showHud showMusic={false} />
      </div>

      {/* Assistant.
          Mobile: at least 520px tall so the chat history has room
            before the visitor scrolls — without this it'd collapse
            to ~340px of empty state + composer and feel like a widget.
          Desktop: matches the engine's column height. */}
      <div className="flex flex-col overflow-hidden min-h-130 lg:min-h-140">
        <AssistantPanel />
      </div>
    </div>
  )
}
