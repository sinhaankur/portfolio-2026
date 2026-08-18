"use client"

/**
 * TerrainExplorer — client entry for /lab/terrain. Lazy-loads the R3F terrain
 * engine with ssr:false so the ~R3F bundle never runs during static export and
 * WebGL only initialises in the browser (matches the celestial/universe pattern).
 * Reads the initial body from the URL hash (#mars, #moon, …).
 */

import dynamic from "next/dynamic"
import { useEffect, useState } from "react"

const TerrainEngine = dynamic(
  () => import("./terrain-engine").then((m) => m.TerrainEngine),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[100dvh] w-full items-center justify-center bg-black">
        <div className="text-sm text-white/50">Loading terrain…</div>
      </div>
    ),
  },
)

export function TerrainExplorer() {
  const [initialBody, setInitialBody] = useState("mars")

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "")
    if (hash) setInitialBody(hash)
  }, [])

  return <TerrainEngine initialBody={initialBody} />
}
