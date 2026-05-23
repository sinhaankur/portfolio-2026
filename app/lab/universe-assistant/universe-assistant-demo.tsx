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
        lg:grid-cols-[1.4fr_1fr]
        rounded-lg overflow-hidden
      "
    >
      {/* Engine viewport. Fixed aspect on small screens; tall on desktop
          so the inner system is legible. */}
      <div
        className="
          relative aspect-[16/10] lg:aspect-auto lg:min-h-[560px]
          rounded-lg overflow-hidden
          border border-border
          bg-background
        "
      >
        <UniverseEngine interactive showHud showMusic={false} />
      </div>

      {/* Assistant — full-height column on desktop, sits below the engine
          on small screens. */}
      <div className="lg:min-h-[560px]">
        <AssistantPanel />
      </div>
    </div>
  )
}
