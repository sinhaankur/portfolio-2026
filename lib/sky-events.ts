/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine.
 *
 * Sky Events API — "what's happening in the sky right now (and soon)".
 *
 * A small, framework-agnostic data layer that unifies the engine's real
 * astronomical events into one simple list a person can read:
 *
 *   - Meteor showers   (recurring annual events — real radiant/date/ZHR)
 *   - Dated events     (oppositions, conjunctions, eclipses — TIMELINE_WAYPOINTS)
 *
 * Everything here is derived from real published data already in the engine
 * (astronomy.ts) — nothing is invented. Pure functions of a timestamp, so it's
 * fully client-side and works on the static site. The engine's HUD, a simple
 * "what's up" panel, and the browser-notification scheduler all read from this.
 */

import {
  METEOR_SHOWERS,
  TIMELINE_WAYPOINTS,
  activeShowerAt,
} from "@/components/universe-engine/astronomy"
import type { MeteorShower } from "@/components/universe-engine/types"

export type SkyEventKind = "meteor-shower" | "planet" | "eclipse" | "comet" | "event"

/** One thing happening (or about to) in the sky, in plain language. */
export type SkyEvent = {
  id: string
  kind: SkyEventKind
  title: string
  /** When it peaks / occurs (absolute instant). */
  at: number
  /** Whole days from "now" to `at`. 0 = today/active, negative = in progress. */
  daysAway: number
  /** One-line what-it-is. */
  summary: string
  /** How to actually see it (naked-eye-first), when we have it. */
  howToSpot?: string
  /** Practical camera guidance, when we have it. */
  cameraTips?: string
  /** For notifications: is it live right now, or a heads-up for something soon? */
  status: "active" | "upcoming"
}

const DAY = 86_400_000

/** The next time this annually-recurring shower peaks, at/after `from`. */
function nextShowerPeak(shower: MeteorShower, from: number): number {
  const d = new Date(from)
  const year = d.getUTCFullYear()
  // try this year's peak, then next year's if it's already past
  for (const y of [year, year + 1]) {
    const peak = Date.UTC(y, shower.peakMonth - 1, shower.peakDay, 6, 0, 0)
    if (peak >= from - 1.5 * DAY) return peak // allow "just peaked" to still count
  }
  return Date.UTC(year + 1, shower.peakMonth - 1, shower.peakDay, 6, 0, 0)
}

function showerToEvent(shower: MeteorShower, now: number, active: boolean): SkyEvent {
  const at = nextShowerPeak(shower, now)
  const daysAway = Math.round((at - now) / DAY)
  return {
    id: `shower-${shower.id}`,
    kind: "meteor-shower",
    title: `${shower.name} meteor shower`,
    at,
    daysAway,
    summary: `Up to ${shower.zhr}/hour, radiating from ${shower.radiantIn}. ${shower.fact}`,
    howToSpot: shower.howToSpot,
    cameraTips: shower.cameraTips,
    status: active ? "active" : "upcoming",
  }
}

/**
 * What's happening in the sky around `now` (defaults to real current time).
 *   - `active`:   showers within their real window right now
 *   - `upcoming`: showers + dated events peaking within `horizonDays` (default 30)
 * Sorted soonest-first. This is the single source the UI + notifications read.
 */
export function skyEvents(
  now: number = Date.now(),
  horizonDays = 30,
): { active: SkyEvent[]; upcoming: SkyEvent[] } {
  const active: SkyEvent[] = []
  const upcoming: SkyEvent[] = []

  // 1) Meteor showers — one is "active" if we're inside its window.
  const activeShower = activeShowerAt(now)
  for (const shower of METEOR_SHOWERS) {
    const isActive = activeShower?.id === shower.id
    const ev = showerToEvent(shower, now, isActive)
    if (isActive) active.push(ev)
    else if (ev.daysAway >= 0 && ev.daysAway <= horizonDays) upcoming.push(ev)
  }

  // 2) Dated events (oppositions, conjunctions, eclipses) — only future ones
  //    inside the horizon. Kind is inferred from the label for a nicer icon.
  for (const wp of TIMELINE_WAYPOINTS) {
    const at = Date.parse(wp.iso)
    if (!Number.isFinite(at)) continue
    const daysAway = Math.round((at - now) / DAY)
    if (daysAway < 0 || daysAway > horizonDays) continue
    upcoming.push({
      id: `event-${wp.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      kind: inferKind(wp.label),
      title: wp.label,
      at,
      daysAway,
      summary: wp.note,
      status: "upcoming",
    })
  }

  active.sort((a, b) => a.at - b.at)
  upcoming.sort((a, b) => a.at - b.at)
  return { active, upcoming }
}

function inferKind(label: string): SkyEventKind {
  const l = label.toLowerCase()
  if (l.includes("eclipse")) return "eclipse"
  if (l.includes("comet") || l.includes("halley") || l.includes("perihelion")) return "comet"
  if (
    l.includes("opposition") ||
    l.includes("conjunction") ||
    /\b(mars|jupiter|saturn|venus|mercury|neptune|uranus)\b/.test(l)
  )
    return "planet"
  return "event"
}

/** A one-line human headline for the single most relevant event, or null when
 * the sky is quiet. Used by compact chrome (a chip, a notification title). */
export function skyHeadline(now: number = Date.now()): string | null {
  const { active, upcoming } = skyEvents(now)
  if (active.length) {
    const e = active[0]
    return `${e.title} is active tonight`
  }
  const soon = upcoming[0]
  if (soon && soon.daysAway <= 7) {
    const when = soon.daysAway === 0 ? "tonight" : soon.daysAway === 1 ? "tomorrow" : `in ${soon.daysAway} days`
    return `${soon.title} — ${when}`
  }
  return null
}
