"use client"

/**
 * VeraDotsStates — Vera's state vocabulary, shown. A small gallery of the dotted
 * orb in each of its states (idle · listening · thinking · searching ·
 * connecting · speaking), so the reader sees HOW she shows what she's doing
 * rather than just reading about it.
 *
 * Lives WITH Vera (on /lab/cognitive-twin) — the orb and the app are one thing.
 * Each orb animates live; the whole strip respects reduced motion (the orbs go
 * still) and auto light/dark.
 */

import { VeraDots } from "./vera-dots"

const STATES: { phase: "idle" | "listening" | "thinking" | "searching" | "connecting" | "speaking"; label: string; note: string }[] = [
  { phase: "idle", label: "At rest", note: "waiting, breathing" },
  { phase: "listening", label: "Listening", note: "receiving you" },
  { phase: "thinking", label: "Thinking", note: "turning it over" },
  { phase: "searching", label: "Searching", note: "scanning her memory" },
  { phase: "connecting", label: "Connecting", note: "linking the pieces" },
  { phase: "speaking", label: "Speaking", note: "finding the words" },
]

export function VeraDotsStates() {
  return (
    <div className="not-prose my-8 rounded-2xl border border-border bg-card/30 p-6 md:p-8">
      <p className="mb-6 font-mono text-[10px] tracking-[0.22em] uppercase text-muted-foreground">
        She shows what she&rsquo;s doing — a state, not a spinner
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3">
        {STATES.map((s) => (
          <div key={s.phase} className="flex flex-col items-center text-center">
            <VeraDots size={96} phase={s.phase} level={s.phase === "speaking" ? 0.8 : 0} />
            <div className="mt-3 font-sans text-sm text-foreground">{s.label}</div>
            <div className="mt-0.5 font-mono text-[10px] tracking-wide text-muted-foreground">{s.note}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
