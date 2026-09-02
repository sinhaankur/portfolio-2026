"use client"

/**
 * LinkedInBadge — an opt-in embed of LinkedIn's official profile badge.
 *
 * LinkedIn's badge hydrates a placeholder div via their platform script. That
 * script is a third-party tracker, so — matching the site's opt-in-media
 * convention (camera, SoundCloud) — we DON'T load it on page load. A branded
 * card shows first; clicking "Load LinkedIn card" injects the script once and
 * lets LinkedIn render its live badge in place. If it fails or is blocked, the
 * branded card + a plain profile link remain.
 */

import { useEffect, useRef, useState } from "react"

const PROFILE = "https://www.linkedin.com/in/sinhaankur27"
const VANITY = "sinhaankur27"

declare global {
  interface Window {
    // LinkedIn's badge script exposes this to (re)scan for badge divs.
    IN?: { parse?: (el?: HTMLElement) => void }
  }
}

export function LinkedInBadge() {
  const [loaded, setLoaded] = useState(false)
  const holderRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!loaded) return
    // Inject LinkedIn's badge script once, then let it parse our placeholder.
    const existing = document.getElementById("li-badge-script")
    const parse = () => window.IN?.parse?.(holderRef.current ?? undefined)
    if (existing) {
      parse()
      return
    }
    const s = document.createElement("script")
    s.id = "li-badge-script"
    s.src = "https://platform.linkedin.com/badges/js/profile.js"
    s.async = true
    s.defer = true
    s.onload = parse
    document.body.appendChild(s)
  }, [loaded])

  return (
    <div className="rounded-2xl border border-border bg-secondary/20 p-5">
      {/* Branded header — always present, on-brand even before the embed loads. */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
            LinkedIn
          </p>
          <p className="mt-1 font-display text-lg text-foreground">Ankur Sinha</p>
          <p className="text-sm text-muted-foreground">
            Principal UX Designer · Human–AI Interaction
          </p>
        </div>
        <a
          href={PROFILE}
          target="_blank"
          rel="noopener noreferrer"
          data-cursor-hover
          className="shrink-0 rounded-full border border-accent/50 bg-accent/10 px-4 py-2 font-mono text-[10px] tracking-widest uppercase text-accent transition-colors hover:bg-accent/20"
        >
          View profile ↗
        </a>
      </div>

      {/* The live badge mounts here after opt-in. */}
      {loaded ? (
        <div className="mt-4">
          <div
            ref={holderRef}
            className="badge-base LI-profile-badge"
            data-locale="en_US"
            data-size="medium"
            data-theme="light"
            data-type="VERTICAL"
            data-vanity={VANITY}
            data-version="v1"
          >
            <a
              className="badge-base__link LI-simple-link"
              href={`${PROFILE}?trk=profile-badge`}
            >
              Ankur Sinha
            </a>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setLoaded(true)}
          data-cursor-hover
          className="mt-4 w-full rounded-lg border border-border py-2.5 font-mono text-[10px] tracking-widest uppercase text-muted-foreground transition-colors hover:text-foreground hover:border-foreground/30"
        >
          Load live LinkedIn card
        </button>
      )}
      <p className="mt-3 text-[11px] text-muted-foreground/70">
        The live card loads LinkedIn&apos;s script only when you click it.
      </p>
    </div>
  )
}
