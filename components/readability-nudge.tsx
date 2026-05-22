"use client"

/**
 * On long-form prose pages, the dark theme can fight the reader after a few
 * paragraphs — `text-foreground/85` over a deep-ink background is editorial
 * but not always comfortable for a full sit-down read. This nudge surfaces
 * two options once the reader has committed (scrolled past the hero):
 *
 *   Reader → keeps dark theme but bumps prose to full contrast + wider
 *            line-height. Persists via DisplayPrefs so it sticks across pages.
 *   Light  → flips the whole site to light theme.
 *
 * Either choice dismisses the nudge for good. Hidden if the user is already
 * in light mode or already has reading-mode on.
 */

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { BookOpen, Sun, X } from "lucide-react"
import { useDisplayPrefs } from "./display-prefs"

const STORAGE_KEY = "readability-nudge-dismissed-v1"
const SCROLL_THRESHOLD = 600

export function ReadabilityNudge() {
  const { resolvedTheme, setTheme } = useTheme()
  const { readingMode, setPref } = useDisplayPrefs()
  const prefersReducedMotion = useReducedMotion()
  const [mounted, setMounted] = useState(false)
  const [dismissed, setDismissed] = useState(true)
  const [scrolledEnough, setScrolledEnough] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      setDismissed(localStorage.getItem(STORAGE_KEY) === "1")
    } catch {
      setDismissed(false)
    }
  }, [])

  useEffect(() => {
    if (!mounted) return
    const check = () => {
      if (window.scrollY > SCROLL_THRESHOLD) {
        setScrolledEnough(true)
        window.removeEventListener("scroll", check)
      }
    }
    check()
    window.addEventListener("scroll", check, { passive: true })
    return () => window.removeEventListener("scroll", check)
  }, [mounted])

  const persistDismissed = () => {
    setDismissed(true)
    try {
      localStorage.setItem(STORAGE_KEY, "1")
    } catch {
      // localStorage can throw in privacy modes — fail silent
    }
  }

  const handleReader = () => {
    setPref("readingMode", true)
    persistDismissed()
  }

  const handleLight = () => {
    setTheme("light")
    persistDismissed()
  }

  if (!mounted) return null
  const isDark = resolvedTheme === "dark"
  // Don't pester users who've already opted into either fix.
  const show = isDark && !readingMode && !dismissed && scrolledEnough

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="
            fixed z-30
            bottom-24 left-4 right-4
            md:bottom-6 md:left-6 md:right-auto
            flex items-center gap-2 md:gap-3
            rounded-full border border-border
            bg-background/75 backdrop-blur-md
            pl-3 md:pl-4 pr-1.5 py-1.5
            shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)]
          "
        >
          <BookOpen className="w-3.5 h-3.5 text-accent shrink-0" aria-hidden="true" />
          <span className="flex-1 md:flex-none font-sans text-xs md:text-sm text-foreground/85 leading-tight">
            <span className="hidden sm:inline">Easier on the eyes for a long read?</span>
            <span className="sm:hidden">Easier read?</span>
          </span>
          <button
            type="button"
            onClick={handleReader}
            data-cursor-hover
            title="Bump contrast for prose"
            className="
              inline-flex items-center gap-1
              font-mono text-[10px] tracking-widest uppercase
              text-accent hover:text-foreground
              border border-accent/60 hover:border-foreground
              rounded-full px-2.5 md:px-3 py-1.5
              transition-colors duration-300
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
              focus-visible:ring-offset-2 focus-visible:ring-offset-background
              min-h-9
            "
          >
            Reader
          </button>
          <button
            type="button"
            onClick={handleLight}
            data-cursor-hover
            title="Switch to light theme"
            className="
              inline-flex items-center gap-1
              font-mono text-[10px] tracking-widest uppercase
              text-foreground/85 hover:text-foreground
              border border-border hover:border-foreground
              rounded-full px-2.5 md:px-3 py-1.5
              transition-colors duration-300
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
              focus-visible:ring-offset-2 focus-visible:ring-offset-background
              min-h-9
            "
          >
            <Sun className="w-3 h-3" aria-hidden="true" />
            Light
          </button>
          <button
            type="button"
            onClick={persistDismissed}
            aria-label="Dismiss readability prompt"
            data-cursor-hover
            className="
              inline-flex items-center justify-center
              w-8 h-8 rounded-full
              text-muted-foreground hover:text-foreground
              hover:bg-secondary/60
              transition-colors duration-300
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
              focus-visible:ring-offset-2 focus-visible:ring-offset-background
            "
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
