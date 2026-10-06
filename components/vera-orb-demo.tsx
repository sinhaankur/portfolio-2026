"use client"

import { useEffect, useRef, useState } from "react"
import { VeraMark } from "@/components/vera-mark"

/**
 * VeraOrbDemo — a live, on-page taste of Vera.
 *
 * The real Vera runs on-device (a local brain this static page can't reach), so
 * this is an HONEST demo, not a fake backend: pick a prompt (or type one) and
 * watch the orb move through her real states — listening → thinking → speaking —
 * with a scripted reply that mirrors how she actually talks (warm, present, not a
 * list). It's a feel, clearly labelled as a demo.
 */

type Phase = "idle" | "listening" | "thinking" | "speaking"

const SCRIPTED: { q: string; a: string }[] = [
  {
    q: "rough day. just venting.",
    a: "I'm here. You don't have to make it tidy — say it however it comes. What's sitting heaviest right now?",
  },
  {
    q: "what am I working on?",
    a: "Your satellite engine and the waves piece, last I knew. Want me to pull up where you left off, or just talk it through?",
  },
  {
    q: "remind me to call mom",
    a: "Done — I'll nudge you this evening. Want me to make it a specific time, or just sometime after dinner?",
  },
  {
    q: "I can't focus today",
    a: "That happens, and it's not a character flaw. Let's shrink it — one small thing, ten minutes, and we see how it feels. What's the one?",
  },
]

export function VeraOrbDemo() {
  const [phase, setPhase] = useState<Phase>("idle")
  const [typed, setTyped] = useState("")
  const [shownQ, setShownQ] = useState("")
  const [shownA, setShownA] = useState("")
  const [aProgress, setAProgress] = useState(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearTimers = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }
  useEffect(() => () => clearTimers(), [])

  function run(q: string, a: string) {
    clearTimers()
    setShownQ(q)
    setShownA("")
    setAProgress(0)
    setPhase("listening")
    // listening → thinking → speaking, timed to feel alive
    timers.current.push(setTimeout(() => setPhase("thinking"), 700))
    timers.current.push(
      setTimeout(() => {
        setPhase("speaking")
        setShownA(a)
        // reveal the reply word-by-word
        const words = a.split(" ")
        words.forEach((_, i) => {
          timers.current.push(
            setTimeout(() => setAProgress(i + 1), 60 * i),
          )
        })
        timers.current.push(
          setTimeout(() => setPhase("idle"), 700 + words.length * 60),
        )
      }, 1700),
    )
  }

  function submit(e?: React.FormEvent) {
    e?.preventDefault()
    const q = typed.trim()
    if (!q) return
    // find the closest scripted reply, else a gentle default
    const hit =
      SCRIPTED.find((s) => q.toLowerCase().includes(s.q.split(" ")[0])) ??
      {
        q,
        a: "In the real app I'd answer this from my own on-device brain and what I know of you. Here it's a demo — but this is the shape of it: warm, present, yours.",
      }
    setTyped("")
    run(q, hit.a)
  }

  const label =
    phase === "listening"
      ? "listening…"
      : phase === "thinking"
        ? "thinking…"
        : phase === "speaking"
          ? "speaking"
          : "tap a prompt, or type your own"

  const revealed =
    phase === "speaking" || phase === "idle"
      ? shownA.split(" ").slice(0, aProgress).join(" ")
      : ""

  return (
    <div className="rounded-xl border border-border bg-secondary/20 p-6 md:p-8">
      <div className="flex items-center gap-2 mb-6">
        <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
          Live demo
        </span>
        <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-accent/80">
          · a feel, not the real brain
        </span>
      </div>

      <div className="flex flex-col items-center gap-5">
        {/* the orb — brighter/scaled while active */}
        <div
          style={{
            transform:
              phase === "speaking"
                ? "scale(1.06)"
                : phase === "listening"
                  ? "scale(1.03)"
                  : "scale(1)",
            transition: "transform 420ms cubic-bezier(.16,1,.3,1)",
            filter: phase === "thinking" ? "saturate(.8) brightness(.92)" : "none",
          }}
        >
          <VeraMark size={120} active />
        </div>
        <p
          className="font-mono text-[11px] tracking-[0.18em] uppercase text-muted-foreground"
          aria-live="polite"
        >
          {label}
        </p>
      </div>

      {/* the exchange */}
      {(shownQ || revealed) && (
        <div className="mt-6 space-y-3 max-w-md mx-auto">
          {shownQ && (
            <p className="text-right">
              <span className="inline-block rounded-2xl bg-accent/15 px-4 py-2 text-sm text-foreground/90">
                {shownQ}
              </span>
            </p>
          )}
          {revealed && (
            <p className="text-left">
              <span className="inline-block rounded-2xl border border-accent/25 bg-background px-4 py-2 text-sm text-foreground">
                {revealed}
                {phase === "speaking" && <span className="opacity-50">▌</span>}
              </span>
            </p>
          )}
        </div>
      )}

      {/* prompts */}
      <div className="mt-7 flex flex-wrap justify-center gap-2">
        {SCRIPTED.map((s) => (
          <button
            key={s.q}
            onClick={() => run(s.q, s.a)}
            data-cursor-hover
            className="
              rounded-full border border-border bg-background px-3.5 py-1.5
              text-xs text-foreground/80 hover:border-accent/60 hover:text-foreground
              transition-colors duration-200
            "
          >
            {s.q}
          </button>
        ))}
      </div>

      {/* type your own */}
      <form onSubmit={submit} className="mt-4 flex gap-2 max-w-md mx-auto">
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="…or say something to her"
          className="
            flex-1 rounded-full border border-border bg-background px-4 py-2
            text-sm text-foreground placeholder:text-muted-foreground/60
            focus:outline-none focus:border-accent/60
          "
        />
        <button
          type="submit"
          data-cursor-hover
          className="
            rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground
            hover:brightness-110 transition
          "
        >
          Send
        </button>
      </form>

      <p className="mt-5 text-center text-xs text-muted-foreground">
        The real Vera speaks this aloud in a warm neural voice, on your machine —
        nothing here is sent anywhere.
      </p>
    </div>
  )
}
