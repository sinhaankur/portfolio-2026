"use client"

/**
 * LiveStatus — a small "the site is live" signal.
 *
 * Branding + reassurance: a pulsing dot + "LIVE" that confirms the page is
 * operational, plus how long it's been up since the last deploy. Does a light
 * client-side self-check (can it fetch its own favicon?) so the badge reflects a
 * REAL health signal, not a hardcoded label — if the site's own assets can't
 * load, it honestly flips to "degraded".
 *
 * Static-export safe: no server. The deploy time is baked at build
 * (NEXT_PUBLIC_BUILD_TIME); everything else runs client-side.
 */

import { useEffect, useState } from "react"

const BUILD_TIME = process.env.NEXT_PUBLIC_BUILD_TIME || new Date().toISOString()

function sinceDeploy(deployMs: number): string {
  const s = Math.max(0, Math.floor((Date.now() - deployMs) / 1000))
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function LiveStatus() {
  const [state, setState] = useState<"checking" | "live" | "degraded">("checking")
  const [uptime, setUptime] = useState<string | null>(null)

  useEffect(() => {
    const deployMs = new Date(BUILD_TIME).getTime()
    // Real health check: can the page load its own asset? A cache-busted fetch
    // confirms the static host is actually serving. If it fails, be honest.
    // Probe /icon.svg — the export has no favicon.ico (Next serves app/icon.svg),
    // so the old favicon probe 404'd and the chip reported "degraded" on a
    // perfectly healthy site.
    let cancelled = false
    const check = async () => {
      try {
        const res = await fetch(`/icon.svg?ping=${Date.now()}`, { method: "HEAD", cache: "no-store" })
        if (!cancelled) setState(res.ok ? "live" : "degraded")
      } catch {
        if (!cancelled) setState("degraded")
      }
    }
    check()
    // Tick the uptime once a minute so it stays current on a long-open tab.
    const tick = () => setUptime(sinceDeploy(deployMs))
    tick()
    const id = window.setInterval(tick, 60_000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  const color =
    state === "live" ? "#3fb950" : state === "degraded" ? "#f0883e" : "#8b949e"
  const label =
    state === "live" ? "Live" : state === "degraded" ? "Degraded" : "Checking"

  return (
    <span
      className="inline-flex items-center gap-1.5 tabular-nums"
      title={
        state === "live"
          ? `Operational · up ${uptime ?? "—"} since last deploy`
          : state === "degraded"
            ? "Some assets aren't loading"
            : "Checking status…"
      }
      aria-label={`Site status: ${label}`}
    >
      <span className="relative inline-flex h-2 w-2" aria-hidden>
        {state === "live" && (
          <span
            className="absolute inline-flex h-full w-full rounded-full opacity-60 motion-safe:animate-ping"
            style={{ background: color }}
          />
        )}
        <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: color }} />
      </span>
      <span style={{ color }}>{label}</span>
      {state === "live" && uptime && (
        <span className="text-muted-foreground">· up {uptime}</span>
      )}
    </span>
  )
}
