"use client"

/**
 * Locale suggestion banner — "based on location" language nudge.
 *
 * Static site (GitHub Pages) = no server, so there's no real server-side geo.
 * We detect the visitor's likely language in two steps, privacy-light:
 *   1) navigator.language(s) — their own OS/browser locale (covers most cases)
 *   2) fallback: a keyless geo-IP lookup mapping country → locale (fails silently
 *      if blocked/offline — the browser-language path already handles most users)
 *
 * Behavior is a GENTLE, dismissible banner with a one-click switch — NOT an
 * auto-redirect (redirects hurt SEO + surprise people who chose their URL).
 * Shows only when a better locale than the current page is detected, and never
 * nags: a dismissal or a previously-picked language is remembered.
 *
 * Mounted globally; `current` is the locale of the page it's on (default "en").
 */

import { useEffect, useState } from "react"
import Link from "next/link"
import { LOCALE_PATH, type Locale } from "@/lib/i18n"

const DISMISS_KEY = "locale-suggest-dismissed"
const CHOSEN_KEY = "preferred-locale"

// Countries that map to our supported non-English locales (geo-IP fallback).
const COUNTRY_LOCALE: Record<string, Locale> = {
  // Arabic-speaking
  SA: "ar", AE: "ar", EG: "ar", QA: "ar", KW: "ar", BH: "ar", OM: "ar",
  JO: "ar", LB: "ar", IQ: "ar", SY: "ar", DZ: "ar", MA: "ar", TN: "ar",
  LY: "ar", YE: "ar", PS: "ar", SD: "ar",
  // Japanese
  JP: "ja",
}

const PROMPT: Record<Exclude<Locale, "en">, { text: string; cta: string }> = {
  ar: { text: "هل تريد عرض هذا الموقع بالعربية؟", cta: "العربية" },
  ja: { text: "この サイトを日本語でご覧になりますか？", cta: "日本語へ" },
}

function fromNavigator(): Locale | null {
  if (typeof navigator === "undefined") return null
  const langs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language]
  for (const l of langs) {
    const code = (l || "").toLowerCase()
    if (code.startsWith("ar")) return "ar"
    if (code.startsWith("ja")) return "ja"
  }
  return null
}

async function fromGeoIP(): Promise<Locale | null> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 2500)
    // keyless, CORS-friendly country endpoint; silent-fail if blocked/rate-limited
    const res = await fetch("https://ipapi.co/country/", { signal: ctrl.signal })
    clearTimeout(t)
    if (!res.ok) return null
    const cc = (await res.text()).trim().toUpperCase()
    return COUNTRY_LOCALE[cc] ?? null
  } catch {
    return null
  }
}

export function LocaleSuggest({ current = "en" }: { current?: Locale }) {
  const [suggest, setSuggest] = useState<Exclude<Locale, "en"> | null>(null)

  useEffect(() => {
    let cancelled = false
    // never nag: respect a prior dismissal or an explicit choice
    let dismissed = false, chosen: string | null = null
    try {
      dismissed = sessionStorage.getItem(DISMISS_KEY) === "1"
      chosen = localStorage.getItem(CHOSEN_KEY)
    } catch { /* private mode */ }
    if (dismissed) return
    // if they've already chosen a language, don't suggest a different one
    if (chosen && chosen !== current) return

    const consider = (loc: Locale | null) => {
      if (cancelled || !loc || loc === current || loc === "en") return false
      setSuggest(loc as Exclude<Locale, "en">)
      return true
    }

    // 1) browser language
    if (consider(fromNavigator())) return
    // 2) geo-IP fallback (only if browser language didn't already match)
    fromGeoIP().then((loc) => consider(loc))

    return () => { cancelled = true }
  }, [current])

  if (!suggest) return null
  const p = PROMPT[suggest]

  const dismiss = () => {
    try { sessionStorage.setItem(DISMISS_KEY, "1") } catch { /* */ }
    setSuggest(null)
  }
  const choose = () => {
    try { localStorage.setItem(CHOSEN_KEY, suggest) } catch { /* */ }
  }

  return (
    <div
      role="region"
      aria-label="Language suggestion"
      dir={suggest === "ar" ? "rtl" : "ltr"}
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[120] w-[min(28rem,calc(100vw-2rem))]"
    >
      <div className="flex items-center gap-3 rounded-full border border-border bg-background/90 backdrop-blur-md px-4 py-2.5 shadow-[0_16px_48px_-20px_rgba(0,0,0,0.7)]">
        <span className="flex-1 text-sm text-foreground/85" style={{ fontFamily: suggest === "ar" ? "var(--font-ar)" : "var(--font-jp)" }}>
          {p.text}
        </span>
        <Link
          href={LOCALE_PATH[suggest]}
          onClick={choose}
          data-cursor-hover
          className="shrink-0 inline-flex items-center min-h-9 px-3 rounded-full bg-foreground text-background font-mono text-[11px] tracking-wider hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          style={{ fontFamily: suggest === "ar" ? "var(--font-ar)" : "var(--font-jp)" }}
        >
          {p.cta}
        </Link>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          data-cursor-hover
          className="shrink-0 grid place-items-center h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
