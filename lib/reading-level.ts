"use client"

/**
 * Reading level — the visitor picks how dense the prose is.
 *
 *   deep   — Ankur's own words: dense, no compromises (the default; the edge stays)
 *   plain  — warm and clear, no jargon, same idea
 *   simple — one honest line, anyone gets it
 *
 * The choice is remembered on-device and shared across every consumer on the
 * page: the About principles and the hero sub-headline read the SAME store, so
 * flipping the toggle in one place updates the other live. Two channels keep it
 * in sync — the native `storage` event (other tabs) and a custom same-tab event
 * (this tab's other components), since `storage` doesn't fire in the tab that
 * made the change.
 */

import { useEffect, useState } from "react"

export type ReadingLevel = "deep" | "plain" | "simple"

const KEY = "reading-level-v1"
const EVENT = "reading-level-change"

export const READING_LEVELS: { id: ReadingLevel; label: string; hint: string }[] = [
  { id: "deep", label: "Deep", hint: "My own words — dense, no compromises" },
  { id: "plain", label: "Plain", hint: "Warm and clear, no jargon" },
  { id: "simple", label: "Simple", hint: "One honest line" },
]

function isLevel(v: unknown): v is ReadingLevel {
  return v === "deep" || v === "plain" || v === "simple"
}

/**
 * Shared reading-level state. Returns the current level and a setter that
 * persists + broadcasts so every other `useReadingLevel()` on the page follows.
 * SSR-safe: starts at "deep" and hydrates from storage on mount.
 */
export function useReadingLevel(): [ReadingLevel, (next: ReadingLevel) => void] {
  const [level, setLevelState] = useState<ReadingLevel>("deep")

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY)
      if (isLevel(saved)) setLevelState(saved)
    } catch {
      /* private mode — stay on default */
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY && isLevel(e.newValue)) setLevelState(e.newValue)
    }
    const onLocal = (e: Event) => {
      const detail = (e as CustomEvent<ReadingLevel>).detail
      if (isLevel(detail)) setLevelState(detail)
    }
    window.addEventListener("storage", onStorage)
    window.addEventListener(EVENT, onLocal as EventListener)
    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener(EVENT, onLocal as EventListener)
    }
  }, [])

  const setLevel = (next: ReadingLevel) => {
    setLevelState(next)
    try {
      localStorage.setItem(KEY, next)
    } catch {
      /* private mode — ignore */
    }
    // Same-tab broadcast (storage event only fires in *other* tabs).
    window.dispatchEvent(new CustomEvent<ReadingLevel>(EVENT, { detail: next }))
  }

  return [level, setLevel]
}
