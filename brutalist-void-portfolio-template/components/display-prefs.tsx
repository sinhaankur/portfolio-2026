"use client"

/**
 * Display preferences — user-facing overrides for accessibility and chrome.
 *
 * Three toggles, persisted in localStorage, applied as classes on <html>
 * so the rest of the app can react via CSS without prop-drilling:
 *
 *   reduceMotion → html.motion-reduced  (kills animations and marquees)
 *   largeText    → html.text-larger     (bumps the rem base by ~12%)
 *   systemCursor → html.cursor-system   (disables the custom reticle cursor)
 *
 * The values default to OFF (browser/OS state wins). When a user opts in,
 * their choice persists across reloads and overrides the OS — e.g. someone
 * who DOESN'T set OS-level reduced-motion can still force-disable animation
 * on this site alone.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"

export type DisplayPrefs = {
  reduceMotion: boolean
  largeText: boolean
  systemCursor: boolean
}

const DEFAULT_PREFS: DisplayPrefs = {
  reduceMotion: false,
  largeText: false,
  systemCursor: false,
}

const STORAGE_KEY = "display-prefs-v1"

type ContextValue = DisplayPrefs & {
  setPref: <K extends keyof DisplayPrefs>(key: K, value: DisplayPrefs[K]) => void
  reset: () => void
}

const DisplayPrefsContext = createContext<ContextValue | null>(null)

export function DisplayPrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<DisplayPrefs>(DEFAULT_PREFS)

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) })
    } catch {
      // localStorage can throw in privacy modes — fail silent
    }
  }, [])

  useEffect(() => {
    if (typeof document === "undefined") return
    const root = document.documentElement
    root.classList.toggle("motion-reduced", prefs.reduceMotion)
    root.classList.toggle("text-larger", prefs.largeText)
    root.classList.toggle("cursor-system", prefs.systemCursor)
  }, [prefs.reduceMotion, prefs.largeText, prefs.systemCursor])

  const setPref = useCallback(
    <K extends keyof DisplayPrefs>(key: K, value: DisplayPrefs[K]) => {
      setPrefs((p) => {
        const next = { ...p, [key]: value }
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        } catch {
          // ignore
        }
        return next
      })
    },
    [],
  )

  const reset = useCallback(() => {
    setPrefs(DEFAULT_PREFS)
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }, [])

  return (
    <DisplayPrefsContext.Provider value={{ ...prefs, setPref, reset }}>
      {children}
    </DisplayPrefsContext.Provider>
  )
}

export function useDisplayPrefs() {
  const ctx = useContext(DisplayPrefsContext)
  if (!ctx) {
    // Components outside the provider get the no-op defaults so they don't
    // crash during isolated tests or storybook-style renders.
    return {
      ...DEFAULT_PREFS,
      setPref: () => {},
      reset: () => {},
    } satisfies ContextValue
  }
  return ctx
}
