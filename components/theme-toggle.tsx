"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { Moon, Sun, Telescope } from "lucide-react"
import { markThemeChosenByUser } from "@/components/time-of-day-theme"

// The three themes cycle dark → light → observatory (the navigator's red-light
// night mode). One function so the click + Shift+L shortcut stay in sync.
const THEME_ORDER = ["dark", "light", "observatory"] as const
type ThemeName = (typeof THEME_ORDER)[number]
function nextTheme(current: string | undefined): ThemeName {
  const i = THEME_ORDER.indexOf((current as ThemeName) ?? "dark")
  return THEME_ORDER[(i + 1) % THEME_ORDER.length]
}
const THEME_LABEL: Record<ThemeName, string> = {
  dark: "dark",
  light: "light",
  observatory: "observatory (red-light)",
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const prefersReducedMotion = useReducedMotion()

  useEffect(() => {
    setMounted(true)
  }, [])

  // Global keyboard shortcut — Shift+L flips theme from anywhere.
  // Skipped when focus is inside a text-entry surface so users typing in
  // forms / contenteditable / select / inputs don't trip it.
  useEffect(() => {
    if (!mounted) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "L" || e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return
      if (target?.isContentEditable) return
      e.preventDefault()
      markThemeChosenByUser()
      setTheme(nextTheme(theme))
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [mounted, theme, setTheme])

  // Avoid hydration mismatch — render a fixed-size placeholder until theme resolves
  if (!mounted) {
    return (
      <button
        aria-hidden="true"
        tabIndex={-1}
        className={`inline-flex items-center justify-center w-10 h-10 rounded-full border border-border ${className}`}
      />
    )
  }

  const current = (theme as ThemeName) ?? "dark"
  const upcoming = nextTheme(current)
  const nextLabel = `Switch to ${THEME_LABEL[upcoming]} theme (Shift+L)`

  return (
    <button
      type="button"
      onClick={() => {
        markThemeChosenByUser()
        setTheme(upcoming)
      }}
      aria-label={nextLabel}
      title={nextLabel}
      data-cursor-hover
      className={`
        relative inline-flex items-center justify-center
        w-10 h-10 rounded-full border border-border
        bg-background/60 backdrop-blur-sm
        text-foreground
        hover:border-accent/60 hover:text-accent
        transition-colors duration-300
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
        focus-visible:ring-offset-2 focus-visible:ring-offset-background
        overflow-hidden
        ${className}
      `}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={current}
          initial={
            prefersReducedMotion
              ? { opacity: 0 }
              : { opacity: 0, rotate: -90, scale: 0.6 }
          }
          animate={
            prefersReducedMotion
              ? { opacity: 1 }
              : { opacity: 1, rotate: 0, scale: 1 }
          }
          exit={
            prefersReducedMotion
              ? { opacity: 0 }
              : { opacity: 0, rotate: 90, scale: 0.6 }
          }
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0 flex items-center justify-center"
        >
          {current === "dark" ? (
            <Moon className="w-4 h-4" aria-hidden="true" />
          ) : current === "light" ? (
            <Sun className="w-4 h-4" aria-hidden="true" />
          ) : (
            <Telescope className="w-4 h-4" aria-hidden="true" />
          )}
        </motion.span>
      </AnimatePresence>
    </button>
  )
}
