"use client"

/**
 * Automatic, location-based language routing (no manual switcher).
 *
 * On the English home, detect the visitor's likely language and send them to the
 * matching localized route. Detection is privacy-light + static-site-friendly:
 *   1) navigator.languages — their own OS/browser locale (covers most cases)
 *   2) fallback: a keyless geo-IP country lookup (fails silently if blocked)
 *
 * Guards against loops + respecting intent:
 *   - only redirects once per session (sessionStorage),
 *   - if the visitor has already been to a locale (or came back to "/"), don't
 *     bounce them again,
 *   - the localized pages keep a small visible "English" link as the escape hatch.
 */

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { LOCALE_PATH, type Locale } from "@/lib/i18n"

const REDIRECTED_KEY = "locale-auto-redirected"

const COUNTRY_LOCALE: Record<string, Locale> = {
  SA: "ar", AE: "ar", EG: "ar", QA: "ar", KW: "ar", BH: "ar", OM: "ar",
  JO: "ar", LB: "ar", IQ: "ar", SY: "ar", DZ: "ar", MA: "ar", TN: "ar",
  LY: "ar", YE: "ar", PS: "ar", SD: "ar",
  JP: "ja",
}

function fromNavigator(): Locale | null {
  if (typeof navigator === "undefined") return null
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language]
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
    const res = await fetch("https://ipapi.co/country/", { signal: ctrl.signal })
    clearTimeout(t)
    if (!res.ok) return null
    const cc = (await res.text()).trim().toUpperCase()
    return COUNTRY_LOCALE[cc] ?? null
  } catch {
    return null
  }
}

export function LocaleRedirect() {
  const router = useRouter()
  useEffect(() => {
    let already = false
    try { already = sessionStorage.getItem(REDIRECTED_KEY) === "1" } catch { /* private */ }
    if (already) return

    const go = (loc: Locale | null) => {
      if (!loc || loc === "en") return false
      try { sessionStorage.setItem(REDIRECTED_KEY, "1") } catch { /* */ }
      router.replace(LOCALE_PATH[loc]) // replace so Back doesn't bounce to "/"
      return true
    }

    // 1) browser language (instant). 2) geo-IP fallback only if no language match.
    if (go(fromNavigator())) return
    fromGeoIP().then((loc) => go(loc))
  }, [router])

  return null
}
