"use client"

/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine.
 *
 * SkyTonight — a simple, human "what's happening in the sky" panel.
 *
 * The point: anyone should be able to glance and know what's up there right now
 * (a meteor shower tonight, a planet at opposition next week) without knowing any
 * astronomy. It reads the shared Sky Events API (lib/sky-events) and offers an
 * opt-in browser-notification toggle so people can be reminded.
 *
 * Fully client-side + static-safe. Renders nothing until it has an event, so it
 * never adds noise on a quiet sky.
 */

import { useEffect, useState } from "react"
import { Bell, BellOff, Sparkles, X } from "lucide-react"

import { skyEvents, type SkyEvent } from "@/lib/sky-events"
import {
  notificationsSupported,
  notificationsEnabled,
  enableSkyNotifications,
  disableSkyNotifications,
  startSkyNotificationLoop,
} from "@/lib/sky-notifications"

const KIND_ICON: Record<SkyEvent["kind"], string> = {
  "meteor-shower": "✦",
  planet: "◐",
  eclipse: "☾",
  comet: "☄",
  event: "★",
}

function whenLabel(e: SkyEvent): string {
  if (e.status === "active") return "Active tonight"
  if (e.daysAway === 0) return "Peaks tonight"
  if (e.daysAway === 1) return "Tomorrow"
  return `In ${e.daysAway} days`
}

export function SkyTonight() {
  const [events, setEvents] = useState<{ active: SkyEvent[]; upcoming: SkyEvent[] }>({
    active: [],
    upcoming: [],
  })
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [notifOn, setNotifOn] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    setEvents(skyEvents())
    setNotifOn(notificationsEnabled())
    // keep periodic notifications running while the page is open (if enabled)
    const stop = startSkyNotificationLoop()
    return stop
  }, [])

  async function toggleNotif() {
    if (notifOn) {
      disableSkyNotifications()
      setNotifOn(false)
    } else {
      const ok = await enableSkyNotifications()
      setNotifOn(ok)
    }
  }

  const all = [...events.active, ...events.upcoming]
  if (dismissed || all.length === 0) return null

  const headline = events.active[0] ?? events.upcoming[0]

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-[9998] max-w-[calc(100vw-2rem)] w-80">
      {/* Collapsed chip — one glance tells you something's up. */}
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-2.5 rounded-full border border-border bg-background/95 px-4 py-2.5 text-left shadow-[0_12px_40px_-12px_rgba(0,0,0,0.5)] backdrop-blur-md transition hover:border-foreground/30"
        >
          <Sparkles className="h-4 w-4 shrink-0 text-amber-400" />
          <span className="flex-1 truncate text-sm">
            <span className="font-medium">{headline.title}</span>
            <span className="ml-1.5 text-xs text-muted-foreground">{whenLabel(headline)}</span>
          </span>
        </button>
      ) : (
        <div className="rounded-2xl border border-border bg-background/95 p-4 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.5)] backdrop-blur-md">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-semibold tracking-tight">In the sky</span>
            </div>
            <div className="flex items-center gap-1">
              {notificationsSupported() && (
                <button
                  onClick={toggleNotif}
                  aria-label={notifOn ? "Turn off sky reminders" : "Get reminded of sky events"}
                  title={notifOn ? "Reminders on — click to turn off" : "Remind me of sky events"}
                  className="rounded-full p-1.5 text-muted-foreground transition hover:bg-foreground/10 hover:text-foreground"
                >
                  {notifOn ? <Bell className="h-4 w-4 text-amber-400" /> : <BellOff className="h-4 w-4" />}
                </button>
              )}
              <button
                onClick={() => setDismissed(true)}
                aria-label="Dismiss"
                className="rounded-full p-1.5 text-muted-foreground transition hover:bg-foreground/10 hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <ul className="space-y-2.5">
            {all.slice(0, 5).map((e) => {
              const isOpen = expanded === e.id
              return (
                <li key={e.id}>
                  <button
                    onClick={() => setExpanded(isOpen ? null : e.id)}
                    className="flex w-full items-start gap-2.5 text-left"
                  >
                    <span className="mt-0.5 text-base leading-none" aria-hidden>
                      {KIND_ICON[e.kind]}
                    </span>
                    <span className="flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-medium">{e.title}</span>
                        <span
                          className={`shrink-0 text-[11px] ${
                            e.status === "active" ? "text-amber-400" : "text-muted-foreground"
                          }`}
                        >
                          {whenLabel(e)}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                        {isOpen ? e.summary : e.summary.split(".")[0] + "."}
                      </span>
                      {isOpen && e.howToSpot && (
                        <span className="mt-1.5 block text-xs leading-snug text-foreground/80">
                          <span className="font-medium">How to see it — </span>
                          {e.howToSpot}
                        </span>
                      )}
                      {isOpen && e.cameraTips && (
                        <span className="mt-1 block text-xs leading-snug text-foreground/80">
                          <span className="font-medium">Cameras — </span>
                          {e.cameraTips}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>

          {notificationsSupported() && !notifOn && (
            <button
              onClick={toggleNotif}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-border py-2 text-xs font-medium text-muted-foreground transition hover:border-foreground/30 hover:text-foreground"
            >
              <Bell className="h-3.5 w-3.5" />
              Remind me of sky events
            </button>
          )}
        </div>
      )}
    </div>
  )
}
