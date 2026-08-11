/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine.
 *
 * Sky notifications — opt-in browser Notifications API for real sky events.
 *
 * Fully client-side (no server, no push service) so it works on the static
 * GitHub Pages site. It uses the standard `Notification` web API:
 *   1. the user explicitly enables it (we request permission on a click)
 *   2. while the site is open, it checks skyEvents() periodically and fires a
 *      notification when a shower is active tonight, or a heads-up a few days
 *      before an upcoming peak
 *   3. it remembers what it already told you (localStorage) so it never repeats
 *
 * Honest about its limits: with no push backend, it only notifies while the
 * tab is open. That's the correct scope for static hosting — see README.
 */

import { skyEvents, type SkyEvent } from "./sky-events"

const SEEN_KEY = "sky-notif-seen-v1"
const ENABLED_KEY = "sky-notif-enabled-v1"
const DAY = 86_400_000
/** Heads-up this many days before an upcoming peak. */
const LEAD_DAYS = 3

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window
}

export function notificationsEnabled(): boolean {
  if (!notificationsSupported()) return false
  return (
    Notification.permission === "granted" &&
    localStorage.getItem(ENABLED_KEY) === "1"
  )
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  if (!notificationsSupported()) return "unsupported"
  return Notification.permission
}

/** Ask the user for permission (must be called from a user gesture). Enables
 * the feature and fires an immediate check on success. */
export async function enableSkyNotifications(): Promise<boolean> {
  if (!notificationsSupported()) return false
  let perm = Notification.permission
  if (perm === "default") perm = await Notification.requestPermission()
  if (perm !== "granted") return false
  localStorage.setItem(ENABLED_KEY, "1")
  checkAndNotify() // tell them right away if something's happening now
  return true
}

export function disableSkyNotifications(): void {
  if (typeof window !== "undefined") localStorage.removeItem(ENABLED_KEY)
}

function seen(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || "{}")
  } catch {
    return {}
  }
}
function markSeen(key: string): void {
  const s = seen()
  s[key] = Date.now()
  // prune anything older than ~400 days so the store can't grow forever
  const cutoff = Date.now() - 400 * DAY
  for (const k of Object.keys(s)) if (s[k] < cutoff) delete s[k]
  localStorage.setItem(SEEN_KEY, JSON.stringify(s))
}

/** A stable per-occurrence key so we notify once per active window / per peak,
 * not once per shower forever (the key includes the event's target date). */
function occurrenceKey(e: SkyEvent, phase: "active" | "lead"): string {
  const day = new Date(e.at).toISOString().slice(0, 10)
  return `${e.id}:${day}:${phase}`
}

function fire(title: string, body: string): void {
  try {
    new Notification(title, {
      body,
      icon: "/favicon.ico",
      tag: title, // collapse duplicates in the OS tray
    })
  } catch {
    /* some browsers throw off a service worker context — best-effort */
  }
}

/** Check current sky events and notify for anything new. Safe to call often. */
export function checkAndNotify(now: number = Date.now()): void {
  if (!notificationsEnabled()) return
  const { active, upcoming } = skyEvents(now)
  const s = seen()

  // Active tonight — the main event.
  for (const e of active) {
    const key = occurrenceKey(e, "active")
    if (s[key]) continue
    const extra = e.howToSpot ? ` ${e.howToSpot.split(".")[0]}.` : ""
    fire(`✦ ${e.title} is active tonight`, `${e.summary.split(".")[0]}.${extra}`)
    markSeen(key)
  }

  // Upcoming — a heads-up a few days before the peak, once.
  for (const e of upcoming) {
    if (e.daysAway < 0 || e.daysAway > LEAD_DAYS) continue
    const key = occurrenceKey(e, "lead")
    if (s[key]) continue
    const when =
      e.daysAway === 0 ? "peaks tonight" : e.daysAway === 1 ? "peaks tomorrow" : `peaks in ${e.daysAway} days`
    fire(`Sky heads-up — ${e.title}`, `${e.title} ${when}. ${e.summary.split(".")[0]}.`)
    markSeen(key)
  }
}

let timer: ReturnType<typeof setInterval> | null = null
/** Start periodic checks while the tab is open (default hourly). Returns a stop
 * fn. No-op if notifications aren't enabled. */
export function startSkyNotificationLoop(everyMs = 60 * 60 * 1000): () => void {
  if (timer) clearInterval(timer)
  checkAndNotify()
  timer = setInterval(() => checkAndNotify(), everyMs)
  return () => {
    if (timer) clearInterval(timer)
    timer = null
  }
}
