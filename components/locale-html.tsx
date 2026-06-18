"use client"

/**
 * Sets <html lang> + dir for a localized route. The root layout renders a single
 * <html lang="en"> (and app-router doesn't let a child route replace it), so on a
 * static export the reliable way to localize the document is to set lang/dir on
 * the client when the localized page mounts — and restore "en"/ltr on unmount so
 * navigating back to English pages isn't left in RTL.
 *
 * globals.css keys all the locale font + RTL rules off html[lang], so flipping
 * this attribute is what actually applies Arabic/Japanese type + direction.
 */

import { useEffect } from "react"
import type { Locale } from "@/lib/i18n"
import { dir, htmlLang } from "@/lib/i18n"

export function LocaleHtml({ locale }: { locale: Locale }) {
  useEffect(() => {
    const el = document.documentElement
    const prevLang = el.lang
    const prevDir = el.dir
    el.lang = htmlLang(locale)
    el.dir = dir(locale)
    return () => {
      el.lang = prevLang || "en"
      el.dir = prevDir || "ltr"
    }
  }, [locale])
  return null
}
