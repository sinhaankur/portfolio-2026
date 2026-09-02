"use client"

/**
 * ConsentBanner — a minimal, on-brand cookie-consent notice (GDPR/ePrivacy).
 *
 * The site loads Google Tag Manager, which can set analytics cookies. Under EU
 * law, non-essential (analytics) cookies need consent BEFORE they run. This uses
 * Google Consent Mode v2: GTM boots with analytics DENIED, and only flips to
 * GRANTED once the visitor accepts here. Choice is remembered on-device.
 *
 * Deliberately light: one line, two buttons, matches the site's type + spacing.
 * No third-party CMP, no tracker to show the consent widget itself.
 */

import { useEffect, useState } from "react"

const KEY = "cookie-consent-v1" // "granted" | "denied"

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

function setConsent(granted: boolean) {
  window.gtag?.("consent", "update", {
    analytics_storage: granted ? "granted" : "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  })
}

export function ConsentBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(KEY)
    if (saved === "granted") setConsent(true)
    else if (saved === "denied") setConsent(false)
    else setVisible(true) // no choice yet → ask
  }, [])

  if (!visible) return null

  const choose = (granted: boolean) => {
    localStorage.setItem(KEY, granted ? "granted" : "denied")
    setConsent(granted)
    setVisible(false)
  }

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed inset-x-3 bottom-3 z-[90] mx-auto max-w-2xl rounded-2xl border border-border bg-background/95 p-4 shadow-2xl backdrop-blur-md md:inset-x-auto md:left-1/2 md:-translate-x-1/2"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-sans text-[13px] leading-relaxed text-foreground/75">
          This site uses privacy-friendly analytics to see which pages are useful.{" "}
          <a href="/about" className="text-accent hover:underline">Learn more</a>. No ads, ever.
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => choose(false)}
            data-cursor-hover
            className="rounded-full px-4 py-2 font-mono text-[10px] tracking-widest uppercase text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Decline
          </button>
          <button
            onClick={() => choose(true)}
            data-cursor-hover
            className="rounded-full bg-foreground px-4 py-2 font-mono text-[10px] tracking-widest uppercase text-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  )
}
