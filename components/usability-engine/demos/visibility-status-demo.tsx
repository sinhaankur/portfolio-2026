"use client"

/**
 * Demo for the 'Visibility of system status' heuristic.
 *
 * Two side-by-side surfaces. Both are the same Submit button. The left
 * one is silent — click does nothing visible for 1.5s, then a result
 * appears. The right one shows immediate feedback: button changes label,
 * a spinner appears, then a confirmation.
 *
 * The visceral difference between the two is the whole point. The user
 * clicks BAD, has to wait without knowing if their click landed, often
 * double-clicks. They click GOOD and the system is talking back the
 * whole time.
 */

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

type State = "idle" | "submitting" | "done"

export function VisibilityStatusDemo() {
  return (
    <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
      <SilentVersion />
      <FeedbackVersion />
    </div>
  )
}

function SilentVersion() {
  const [state, setState] = useState<State>("idle")
  const [showResult, setShowResult] = useState(false)

  const submit = () => {
    if (state !== "idle") return
    // Silent. The button doesn't change. After a delay, a result appears.
    // From the user's POV, nothing happened — they often re-click here.
    setState("submitting")
    setTimeout(() => {
      setState("done")
      setShowResult(true)
    }, 1500)
  }

  const reset = () => {
    setState("idle")
    setShowResult(false)
  }

  return (
    <DemoFrame label="No feedback" labelTone="bad">
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4 min-h-[160px]">
        <button
          type="button"
          onClick={submit}
          className="px-5 py-2.5 border border-foreground/30 rounded-md font-mono text-xs tracking-widest uppercase text-foreground bg-background hover:border-foreground transition-colors"
        >
          Save
        </button>
        {showResult && (
          <p className="font-mono text-[11px] tracking-wider text-foreground/85">
            saved.
          </p>
        )}
      </div>
      <DemoFooter onReset={reset}>
        Click <span className="text-foreground">Save</span>. The button says nothing while it works.
      </DemoFooter>
    </DemoFrame>
  )
}

function FeedbackVersion() {
  const [state, setState] = useState<State>("idle")

  const submit = () => {
    if (state !== "idle") return
    setState("submitting")
    setTimeout(() => setState("done"), 1500)
  }
  const reset = () => setState("idle")

  return (
    <DemoFrame label="Live feedback" labelTone="good">
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4 min-h-[160px]">
        <button
          type="button"
          onClick={submit}
          disabled={state !== "idle"}
          className="
            px-5 py-2.5 border rounded-md
            font-mono text-xs tracking-widest uppercase
            transition-colors min-w-[120px]
            inline-flex items-center justify-center gap-2
            disabled:cursor-not-allowed
            border-accent text-accent-foreground bg-accent
            hover:bg-accent/90
            disabled:bg-accent/85
          "
          aria-busy={state === "submitting"}
        >
          <AnimatePresence mode="wait" initial={false}>
            {state === "idle" && (
              <motion.span
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                Save
              </motion.span>
            )}
            {state === "submitting" && (
              <motion.span
                key="submitting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="inline-flex items-center gap-2"
              >
                <span className="inline-block w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                Saving…
              </motion.span>
            )}
            {state === "done" && (
              <motion.span
                key="done"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                Saved ✓
              </motion.span>
            )}
          </AnimatePresence>
        </button>
        {state === "submitting" && (
          <p className="font-mono text-[11px] tracking-wider text-foreground/60">
            working…
          </p>
        )}
      </div>
      <DemoFooter onReset={reset}>
        Click <span className="text-foreground">Save</span>. The button narrates every state.
      </DemoFooter>
    </DemoFrame>
  )
}

/* ===== Shared demo chrome ===== */

export function DemoFrame({
  label,
  labelTone,
  children,
}: {
  label: string
  labelTone: "good" | "bad"
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col border border-border rounded-lg bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
        <span
          aria-hidden="true"
          className={`block w-1.5 h-1.5 rounded-full ${labelTone === "good" ? "bg-emerald-500" : "bg-foreground/40"}`}
        />
        <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-foreground/70">
          {label}
        </span>
      </div>
      {children}
    </div>
  )
}

export function DemoFooter({
  onReset,
  children,
}: {
  onReset: () => void
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 border-t border-border bg-background/40">
      <p className="font-sans text-xs text-muted-foreground leading-snug">
        {children}
      </p>
      <button
        type="button"
        onClick={onReset}
        className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors shrink-0"
      >
        Reset
      </button>
    </div>
  )
}
