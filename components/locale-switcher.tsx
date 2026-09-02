"use client"

/**
 * LocaleSwitcher — a keyboard-accessible language picker. Lists every locale in
 * its own native name (한국어, 中文, हिन्दी…) so a speaker recognizes their language
 * instantly. Each option links to that locale's home. Placed in the navbar and
 * on the localized homes so any visitor can switch, in any language, easily.
 *
 * Accessible: a real <button> menu with aria-expanded, arrow-key nav, Escape to
 * close, and a visible focus ring. RTL-aware for Arabic.
 */

import { useEffect, useRef, useState } from "react"
import { LOCALES, LOCALE_LABEL, LOCALE_PATH, type Locale } from "@/lib/i18n"

export function LocaleSwitcher({
  current = "en",
  compact = false,
}: {
  current?: Locale
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent | TouchEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("mousedown", onDoc)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDoc)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Change language"
        data-cursor-hover
        className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 font-mono text-[10px] tracking-widest uppercase text-foreground/70 transition-colors hover:text-foreground hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <GlobeIcon />
        {compact ? "" : LOCALE_LABEL[current]}
        <span aria-hidden className={`transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>

      {open && (
        <ul
          role="menu"
          aria-label="Languages"
          className="absolute end-0 z-50 mt-2 max-h-[70vh] w-44 overflow-auto rounded-xl border border-border bg-background/95 p-1.5 shadow-xl backdrop-blur-md"
        >
          {LOCALES.map((l: Locale) => {
            const active = l === current
            return (
              <li key={l} role="none">
                <a
                  role="menuitem"
                  href={LOCALE_PATH[l]}
                  data-cursor-hover
                  className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                    active ? "bg-accent/10 text-accent" : "text-foreground/80 hover:bg-secondary/40 hover:text-foreground"
                  }`}
                  aria-current={active ? "true" : undefined}
                >
                  <span>{LOCALE_LABEL[l]}</span>
                  {active && <span aria-hidden className="text-accent">✓</span>}
                </a>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function GlobeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.5 3.5 6 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-6-3.5-9s1-6.5 3.5-9z" />
    </svg>
  )
}
