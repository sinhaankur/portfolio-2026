"use client"

/**
 * Display preferences popover.
 *
 * Sits in the navbar next to the theme toggle. Opens a small panel with the
 * three accessibility toggles wired to {@link useDisplayPrefs}. Visible
 * surface intentionally tells the user that these prefs override their OS,
 * since e.g. honoring `prefers-reduced-motion` invisibly is good — but
 * surfacing the choice is *better*.
 */

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Accessibility } from "lucide-react"
import { useDisplayPrefs, type DisplayPrefs } from "./display-prefs"
import { A11yChecker } from "./a11y-checker"
import { READING_LEVELS, useReadingLevel } from "@/lib/reading-level"

export function DisplayMenu() {
  const [open, setOpen] = useState(false)
  const [checkerOpen, setCheckerOpen] = useState(false)
  const { reduceMotion, largeText, systemCursor, readingMode, fastMode, setPref, reset } = useDisplayPrefs()
  const [readingLevel, setReadingLevel] = useReadingLevel()
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocPointer = (e: MouseEvent | TouchEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onDocPointer)
    document.addEventListener("touchstart", onDocPointer, { passive: true })
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDocPointer)
      document.removeEventListener("touchstart", onDocPointer)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const anyEnabled = reduceMotion || largeText || systemCursor || readingMode || fastMode

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Display preferences"
        aria-expanded={open}
        aria-haspopup="dialog"
        data-cursor-hover
        className="
          relative w-10 h-10 inline-flex items-center justify-center rounded-full
          border border-border hover:border-accent/60 hover:text-foreground
          text-foreground/85
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
          focus-visible:ring-offset-2 focus-visible:ring-offset-background
          transition-colors duration-300
        "
      >
        <Accessibility className="w-4 h-4" aria-hidden="true" />
        {anyEnabled && (
          <span
            aria-hidden="true"
            className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-accent"
          />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-label="Display preferences"
            className="
              absolute top-12 right-0 w-72 z-50
              rounded-xl border border-border bg-background/95 backdrop-blur-md
              shadow-2xl p-4
            "
          >
            <div className="flex items-baseline justify-between mb-3">
              <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
                Display
              </p>
              {anyEnabled && (
                <button
                  type="button"
                  onClick={reset}
                  data-cursor-hover
                  className="
                    font-mono text-[10px] tracking-widest uppercase
                    text-muted-foreground hover:text-foreground transition-colors
                  "
                >
                  Reset
                </button>
              )}
            </div>

            {/* Reading level — how dense the writing is. Deep is Ankur's own
                voice (default); Plain and Simple make the same points plainer.
                Shared store: this drives the hero + About copy live. */}
            <div className="mb-4">
              <div className="flex items-baseline justify-between">
                <p className="font-sans text-sm text-foreground leading-tight">Reading level</p>
                <p className="font-mono text-[10px] tracking-wider text-muted-foreground">
                  {READING_LEVELS.find((l) => l.id === readingLevel)?.hint}
                </p>
              </div>
              <div
                role="radiogroup"
                aria-label="Reading level"
                className="mt-2 flex items-center rounded-lg border border-border bg-secondary/30 p-1"
              >
                {READING_LEVELS.map((lv) => {
                  const active = lv.id === readingLevel
                  return (
                    <button
                      key={lv.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setReadingLevel(lv.id)}
                      data-cursor-hover
                      title={lv.hint}
                      className={`relative flex-1 rounded-md px-2 py-1.5 font-mono text-[10px] tracking-widest uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                        active ? "text-background" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="display-reading-level-pill"
                          transition={{ type: "spring", stiffness: 400, damping: 34 }}
                          className="absolute inset-0 rounded-md bg-foreground"
                        />
                      )}
                      <span className="relative">{lv.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <ul className="space-y-1">
              <ToggleRow
                label="Fast mode"
                description="Skip the cinematic intro and go straight in — for faster, repeat use"
                checked={fastMode}
                onChange={(v) => setPref("fastMode", v)}
              />
              <ToggleRow
                label="Reading mode"
                description="Full-contrast prose and wider line-height for long-form pages"
                checked={readingMode}
                onChange={(v) => setPref("readingMode", v)}
              />
              <ToggleRow
                label="Reduce motion"
                description="Disable animations and transitions"
                checked={reduceMotion}
                onChange={(v) => setPref("reduceMotion", v)}
              />
              <ToggleRow
                label="Larger text"
                description="Increase the base font size"
                checked={largeText}
                onChange={(v) => setPref("largeText", v)}
              />
              <ToggleRow
                label="System cursor"
                description="Use the native pointer instead of the reticle"
                checked={systemCursor}
                onChange={(v) => setPref("systemCursor", v)}
              />
            </ul>

            {/* Live accessibility check — opens a WAVE-style report for this page. */}
            <button
              type="button"
              onClick={() => { setCheckerOpen(true); setOpen(false) }}
              data-cursor-hover
              className="mt-3 flex w-full items-center justify-between rounded-lg border border-border bg-secondary/20 px-3 py-2.5 text-left transition-colors hover:border-accent/50"
            >
              <span>
                <span className="block text-sm font-medium text-foreground">Check this page&apos;s accessibility</span>
                <span className="block text-[11px] text-muted-foreground">A live WAVE-style report — see how it works</span>
              </span>
              <span className="text-accent" aria-hidden>→</span>
            </button>

            <p className="mt-4 pt-3 border-t border-border font-mono text-[10px] tracking-wider text-muted-foreground/80 leading-relaxed">
              Stored on this device. Overrides your OS settings.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <A11yChecker open={checkerOpen} onClose={() => setCheckerOpen(false)} />
    </div>
  )
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        role="switch"
        aria-checked={checked}
        data-cursor-hover
        className="
          group w-full flex items-start gap-3 text-left
          rounded-md p-2 -mx-2
          hover:bg-secondary/40 transition-colors
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
        "
      >
        <span className="flex-1 min-w-0">
          <span className="block font-sans text-sm text-foreground leading-tight">
            {label}
          </span>
          <span className="block font-sans text-xs text-muted-foreground mt-1 leading-snug">
            {description}
          </span>
        </span>
        <span
          aria-hidden="true"
          className={`
            mt-0.5 shrink-0 inline-flex items-center
            w-9 h-5 rounded-full border transition-colors duration-200
            ${checked ? "bg-accent border-accent" : "bg-secondary border-border"}
          `}
        >
          <span
            className={`
              inline-block w-3.5 h-3.5 rounded-full bg-background
              transition-transform duration-200
              ${checked ? "translate-x-[1.125rem]" : "translate-x-0.5"}
            `}
          />
        </span>
      </button>
    </li>
  )
}

export type { DisplayPrefs }
