"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"

type DataLayerEvent = {
  event: string
  [key: string]: string | number | boolean | null | undefined
}

declare global {
  interface Window {
    dataLayer?: DataLayerEvent[]
  }
}

const VISITOR_ID_KEY = "portfolio.visitor.id"
const VISITOR_FIRST_SEEN_KEY = "portfolio.visitor.first-seen"
const LAST_SEEN_DAY_KEY = "portfolio.visitor.last-seen-day"

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function getOrCreateVisitorId(): { id: string; isNew: boolean } {
  try {
    const existing = window.localStorage.getItem(VISITOR_ID_KEY)
    if (existing) return { id: existing, isNew: false }

    const id = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `v-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    window.localStorage.setItem(VISITOR_ID_KEY, id)
    window.localStorage.setItem(VISITOR_FIRST_SEEN_KEY, new Date().toISOString())
    return { id, isNew: true }
  } catch {
    const id = `ephemeral-${Date.now()}`
    return { id, isNew: true }
  }
}

function pushDataLayer(event: DataLayerEvent) {
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push(event)
}

export function VisitorAnalytics() {
  const pathname = usePathname()
  const didSendSessionRef = useRef(false)

  // One session-level event per page load. Includes a visitor identity signal
  // that GTM/GA4 can use for unique-vs-returning visitor dashboards.
  useEffect(() => {
    if (didSendSessionRef.current) return
    didSendSessionRef.current = true

    const { id, isNew } = getOrCreateVisitorId()
    const day = todayKey()
    let isFirstSessionToday = true

    try {
      const prevDay = window.localStorage.getItem(LAST_SEEN_DAY_KEY)
      isFirstSessionToday = prevDay !== day
      window.localStorage.setItem(LAST_SEEN_DAY_KEY, day)
    } catch {
      isFirstSessionToday = true
    }

    pushDataLayer({
      event: "visitor_session_start",
      visitor_id: id,
      visitor_new: isNew,
      visitor_first_session_today: isFirstSessionToday,
      visitor_day: day,
      referrer: typeof document !== "undefined" ? document.referrer || null : null,
    })
  }, [])

  // Emit route-based page views for SPA navigation.
  useEffect(() => {
    const query = typeof window !== "undefined" ? window.location.search : ""
    const path = query ? `${pathname}${query}` : pathname
    pushDataLayer({
      event: "page_view",
      page_path: path,
      page_location: typeof window !== "undefined" ? window.location.href : null,
      page_title: typeof document !== "undefined" ? document.title : null,
    })
  }, [pathname])

  return null
}
