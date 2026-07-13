"use client"

/**
 * LaunchFeed — recent + upcoming orbital launches, live from the Launch Library
 * 2 API (thespacedevs, free/no-key). Real manifest: next launches counting down,
 * recent ones with outcome, each with rocket, provider, and pad.
 */

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Rocket, X } from "lucide-react"
import { fetchLaunches, relTime, type LaunchItem } from "@/lib/launches"

type State =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "done"; upcoming: LaunchItem[]; recent: LaunchItem[] }

function statusColor(s: string): string {
  const t = s.toLowerCase()
  if (t.includes("success")) return "text-[#5affc0]"
  if (t.includes("failure")) return "text-red-400"
  if (t.includes("go")) return "text-[#7affd0]"
  return "text-muted-foreground"
}

function Row({ l }: { l: LaunchItem; upcoming: boolean }) {
  return (
    <li className="rounded-lg border border-border bg-background/60 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="font-sans text-sm text-foreground truncate">{l.name}</span>
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground shrink-0">{relTime(l.net)}</span>
      </div>
      <p className="mt-0.5 font-mono text-[10px] tracking-wider text-muted-foreground truncate">
        {l.rocket} · {l.provider}
      </p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="font-mono text-[9px] text-muted-foreground/70 truncate">{l.locationName}</span>
        <span className={`font-mono text-[9px] tracking-widest uppercase shrink-0 ${statusColor(l.status)}`}>{l.status}</span>
      </div>
    </li>
  )
}

export function LaunchFeed({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<State>({ kind: "loading" })

  useEffect(() => {
    let alive = true
    fetchLaunches().then((r) => {
      if (!alive) return
      setState(r ? { kind: "done", upcoming: r.upcoming, recent: r.recent } : { kind: "error" })
    })
    return () => { alive = false }
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="w-[min(22rem,calc(100vw-2rem))] max-h-[70vh] overflow-y-auto rounded-xl border border-[#ffd27a]/40 bg-background/90 backdrop-blur-md shadow-[0_16px_48px_-20px_rgba(0,0,0,0.7)]"
    >
      <div className="sticky top-0 flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border bg-background/90 backdrop-blur">
        <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase text-[#ffd27a]">
          <Rocket className="h-3.5 w-3.5" /> Launches · live
        </p>
        <button type="button" onClick={onClose} aria-label="Close"
          className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="p-4">
        {state.kind === "loading" && <p className="font-sans text-sm text-muted-foreground">Reading the manifest…</p>}
        {state.kind === "error" && <p className="font-sans text-sm text-muted-foreground">Launch feed unavailable (rate-limited or offline).</p>}
        {state.kind === "done" && (
          <div className="space-y-4">
            {state.upcoming.length > 0 && (
              <div>
                <p className="font-mono text-[9px] tracking-[0.25em] uppercase text-muted-foreground mb-2">Upcoming</p>
                <ul className="space-y-2">{state.upcoming.map((l) => <Row key={l.id} l={l} upcoming />)}</ul>
              </div>
            )}
            {state.recent.length > 0 && (
              <div>
                <p className="font-mono text-[9px] tracking-[0.25em] uppercase text-muted-foreground mb-2">Recent</p>
                <ul className="space-y-2">{state.recent.map((l) => <Row key={l.id} l={l} upcoming={false} />)}</ul>
              </div>
            )}
            <p className="font-mono text-[9px] tracking-wider text-muted-foreground/70">Live from the Launch Library 2 API · thespacedevs</p>
          </div>
        )}
      </div>
    </motion.div>
  )
}
