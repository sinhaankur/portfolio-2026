"use client"

/**
 * Language switcher — EN / عربية / 日本語. Links to the localized home routes
 * (/, /ar, /ja). Token-styled, keyboard-accessible, and remembers the choice in
 * localStorage so the next visit can be hinted. Used in the navbar + the
 * localized shells.
 */

import Link from "next/link"
import { LOCALES, LOCALE_LABEL, LOCALE_PATH, type Locale } from "@/lib/i18n"

export function LanguageSwitcher({ current = "en" }: { current?: Locale }) {
  const remember = (loc: Locale) => {
    try { localStorage.setItem("preferred-locale", loc) } catch { /* private mode */ }
  }
  return (
    <nav
      aria-label="Language"
      className="inline-flex items-center gap-1 rounded-full border border-border bg-background/50 backdrop-blur-sm p-1"
    >
      {LOCALES.map((loc) => {
        const active = loc === current
        return (
          <Link
            key={loc}
            href={LOCALE_PATH[loc]}
            hrefLang={loc}
            lang={loc}
            onClick={() => remember(loc)}
            aria-current={active ? "true" : undefined}
            data-cursor-hover
            className={`
              inline-flex items-center justify-center min-h-8 px-2.5 rounded-full
              font-mono text-[11px] tracking-wider transition-colors
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
              ${active
                ? "bg-foreground text-background"
                : "text-foreground/70 hover:text-foreground hover:bg-secondary/60"}
            `}
          >
            {LOCALE_LABEL[loc]}
          </Link>
        )
      })}
    </nav>
  )
}
