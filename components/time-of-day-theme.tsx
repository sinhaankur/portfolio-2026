"use client"

/**
 * Time-of-day theme — the site follows the visitor's sky.
 *
 * Daytime (07:00–18:59 local) defaults to the light "chart" theme; evening and
 * night default to the dark planetarium. An EXPLICIT choice (theme toggle /
 * Shift+L) always wins and pins the theme permanently — auto mode only applies
 * while the visitor has never picked one. `theme-source` in localStorage
 * records who set it ("user" | "auto"), mirroring how macOS Auto appearance
 * behaves: ambient by default, obedient once told.
 *
 * Runs once per page load (no mid-session flips — a theme change while
 * reading is more jarring than a stale one).
 */

import { useEffect } from "react"
import { useTheme } from "next-themes"

const DAY_START_HOUR = 7
const NIGHT_START_HOUR = 19

const THEME_SOURCE_KEY = "theme-source"

export function TimeOfDayTheme() {
  const { setTheme } = useTheme()

  useEffect(() => {
    let source: string | null = null
    try {
      source = localStorage.getItem(THEME_SOURCE_KEY)
    } catch {
      return // storage unavailable (private mode) — leave the default theme
    }
    if (source === "user") return

    const hour = new Date().getHours()
    const daytime = hour >= DAY_START_HOUR && hour < NIGHT_START_HOUR
    setTheme(daytime ? "light" : "dark")
    try {
      localStorage.setItem(THEME_SOURCE_KEY, "auto")
    } catch {
      /* private mode — fine */
    }
  }, [setTheme])

  return null
}

/** Call when the visitor explicitly picks a theme — pins it from then on. */
export function markThemeChosenByUser() {
  try {
    localStorage.setItem(THEME_SOURCE_KEY, "user")
  } catch {
    /* private mode — fine */
  }
}
