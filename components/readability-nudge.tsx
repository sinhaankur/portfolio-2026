"use client"

/**
 * On long-form prose pages, the dark theme can fight the reader after a few
 * paragraphs — `text-foreground/85` over a deep-ink background is editorial
 * but not always comfortable for a full sit-down read. This nudge offers a
 * one-click switch to light mode, surfacing only after the reader has
 * committed (scrolled past the hero) and never again once dismissed.
 */

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { Sun, X } from "lucide-react"

const STORAGE_KEY = "readability-nudge-dismissed-v1"
const SCROLL_THRESHOLD = 600

export function ReadabilityNudge() {
  const { resolvedTheme, setTheme } = useTheme()
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

  const handleSwitch = () => {
    setTheme("light")
    persistDismissed()
  }

  if (!mounted) return null
  const isDark = resolvedTheme === "dark"
  const show = isDark && !dismissed && scrolledEnough

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
            fixed bottom-6 left-6 z-30
            inline-flex items-center gap-2 md:gap-3
            rounded-full border border-border
            bg-background/75 backdrop-blur-md
            pl-3 md:pl-4 pr-1.5 py-1.5
            shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)]
            max-w-[calc(100vw-3rem)]
          "
        >
          <Sun className="w-3.5 h-3.5 text-accent shrink-0" aria-hidden="true" />
          <span className="font-sans text-xs md:text-sm text-foreground/85 leading-tight">
            Easier to read in light mode.
          </span>
          <button
            type="button"
            onClick={handleSwitch}
            data-cursor-hover
            className="
              ml-1
              font-mono text-[10px] tracking-widest uppercase
              text-accent hover:text-foreground
              border border-accent/60 hover:border-foreground
              rounded-full px-3 py-1.5
              transition-colors duration-300
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
              focus-visible:ring-offset-2 focus-visible:ring-offset-background
              min-h-9
            "
          >
            Switch
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
