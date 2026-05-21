"use client"

/**
 * Demo for the 'Error prevention' heuristic.
 *
 * Two email-field forms side-by-side. Both validate the same input. The
 * left one waits for Submit and then yells. The right one validates
 * inline as you type and helps you reach a valid state.
 *
 * Same final outcome, very different felt experience.
 */

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { DemoFrame, DemoFooter } from "./visibility-status-demo"

function isValidEmail(s: string) {
  // Quick + pragmatic — not RFC-perfect, but mirrors what users actually need
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

export function ErrorPreventionDemo() {
  return (
    <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
      <SubmitOnlyValidation />
      <InlineValidation />
    </div>
  )
}

function SubmitOnlyValidation() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValidEmail(email)) {
      setError("Invalid email address.")
    } else {
      setError(null)
      alert("Submitted: " + email)
    }
  }
  const reset = () => {
    setEmail("")
    setError(null)
  }

  return (
    <DemoFrame label="Validate on submit" labelTone="bad">
      <form onSubmit={submit} className="p-5 flex flex-col gap-3 min-h-[180px]">
        <label className="font-mono text-[10px] tracking-widest uppercase text-foreground/70">
          Email
        </label>
        <input
          type="text"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          aria-invalid={Boolean(error)}
          className="px-3 py-2 border border-border rounded-md bg-background font-sans text-sm focus:outline-none focus:border-foreground"
        />
        <button
          type="submit"
          className="self-start px-4 py-2 border border-foreground/30 rounded-md font-mono text-[11px] tracking-widest uppercase text-foreground hover:border-foreground transition-colors"
        >
          Submit
        </button>
        {error && (
          <p className="font-mono text-[11px] tracking-wider text-red-500 mt-1">
            ✕ {error}
          </p>
        )}
      </form>
      <DemoFooter onReset={reset}>
        Type something wrong and submit. The form refuses, then leaves you to figure it out.
      </DemoFooter>
    </DemoFrame>
  )
}

function InlineValidation() {
  const [email, setEmail] = useState("")
  const [touched, setTouched] = useState(false)

  const valid = isValidEmail(email)
  const showError = touched && email.length > 0 && !valid
  const showSuccess = valid

  const helper = (() => {
    if (!email) return "Need an email — e.g. name@example.com"
    if (!email.includes("@")) return "Missing @ — try name@example.com"
    if (!email.includes(".") || email.endsWith(".")) return "Missing the domain ending (.com, .co, etc.)"
    if (!valid) return "Doesn't look quite right yet"
    return "Looks good."
  })()

  const reset = () => {
    setEmail("")
    setTouched(false)
  }

  return (
    <DemoFrame label="Validate inline" labelTone="good">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (valid) alert("Submitted: " + email)
        }}
        className="p-5 flex flex-col gap-3 min-h-[180px]"
      >
        <label className="font-mono text-[10px] tracking-widest uppercase text-foreground/70">
          Email
        </label>
        <div className="relative">
          <input
            type="text"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (!touched) setTouched(true)
            }}
            placeholder="you@example.com"
            aria-invalid={showError}
            className={`
              w-full px-3 py-2 pr-9 border rounded-md bg-background font-sans text-sm
              focus:outline-none transition-colors
              ${showError ? "border-red-500/60 focus:border-red-500" : showSuccess ? "border-emerald-500/60 focus:border-emerald-500" : "border-border focus:border-foreground"}
            `}
          />
          {(showError || showSuccess) && (
            <span
              aria-hidden="true"
              className={`absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-sm ${showSuccess ? "text-emerald-500" : "text-red-500"}`}
            >
              {showSuccess ? "✓" : "✕"}
            </span>
          )}
        </div>
        <AnimatePresence mode="wait">
          <motion.p
            key={helper}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className={`font-mono text-[11px] tracking-wider ${showSuccess ? "text-emerald-600 dark:text-emerald-400" : showError ? "text-red-500" : "text-foreground/60"}`}
          >
            {helper}
          </motion.p>
        </AnimatePresence>
        <button
          type="submit"
          disabled={!valid}
          className="
            self-start px-4 py-2 rounded-md
            font-mono text-[11px] tracking-widest uppercase
            bg-accent text-accent-foreground border border-accent
            disabled:bg-foreground/10 disabled:text-foreground/40 disabled:border-transparent disabled:cursor-not-allowed
            transition-colors
          "
        >
          Submit
        </button>
      </form>
      <DemoFooter onReset={reset}>
        Type into the field. The form helps you reach a valid state in real time.
      </DemoFooter>
    </DemoFrame>
  )
}
