"use client"

/**
 * useAuditSession — manages the per-URL audit state.
 *
 * The session is persisted to localStorage so the user can pause an
 * audit and come back to it later (or refresh by accident without
 * losing their verdicts).
 *
 * Key behaviours:
 *   - One session per URL. Starting a new URL replaces the previous.
 *   - Verdicts are stored as { [heuristicId]: 'pass' | 'fail' | 'skip' }.
 *   - normalizeUrl() trims whitespace + adds https:// if no scheme is given,
 *     so the user can paste "example.com" or "https://example.com"
 *     interchangeably.
 */

import { useCallback, useEffect, useState } from "react"
import type { AuditSession, AuditVerdict } from "./types"

const STORAGE_KEY = "usability-engine.audit-session"

const EMPTY: AuditSession = { url: "", startedAt: 0, verdicts: {} }

export function normalizeUrl(input: string): { ok: boolean; url: string; host: string } {
  const trimmed = input.trim()
  if (!trimmed) return { ok: false, url: "", host: "" }
  // Prepend https:// if scheme is missing — typical user behavior is to
  // paste "example.com" and expect it to work.
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const u = new URL(withScheme)
    if (!u.hostname.includes(".")) {
      return { ok: false, url: "", host: "" }
    }
    return { ok: true, url: u.href, host: u.host }
  } catch {
    return { ok: false, url: "", host: "" }
  }
}

export function useAuditSession() {
  const [session, setSession] = useState<AuditSession>(EMPTY)

  // Hydrate from localStorage on mount only.
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as AuditSession
      if (parsed && typeof parsed.url === "string") setSession(parsed)
    } catch {
      // fail silent — bad data shouldn't crash the page
    }
  }, [])

  // Persist on every change. Keep this side-effect small.
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      if (!session.url) {
        localStorage.removeItem(STORAGE_KEY)
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
      }
    } catch {
      // ignore quota / privacy-mode failures
    }
  }, [session])

  const start = useCallback((url: string) => {
    setSession({ url, startedAt: Date.now(), verdicts: {} })
  }, [])

  const setVerdict = useCallback((heuristicId: string, verdict: AuditVerdict) => {
    setSession((s) => ({
      ...s,
      verdicts: { ...s.verdicts, [heuristicId]: verdict },
    }))
  }, [])

  const clear = useCallback(() => {
    setSession(EMPTY)
  }, [])

  const isActive = Boolean(session.url)

  return { session, isActive, start, setVerdict, clear }
}
