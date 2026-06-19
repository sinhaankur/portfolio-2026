"use client"

/**
 * Localized home shell for /ar and /ja. Renders the language-agnostic galaxy
 * backdrop with TRANSLATED typography overlaid, the manifesto, a footer CTA, and
 * the language switcher. RTL-aware (Arabic) via `rtl:` variants + logical layout.
 *
 * Deliberately NOT the full English home — it's a localized overview that links
 * through to the complete English portfolio (scope = shell-first i18n).
 */

import dynamic from "next/dynamic"
import Link from "next/link"
import { StaticStarfield } from "./universe-engine/static-starfield"
import { UniverseRuntimeFallback } from "./universe-engine/runtime-fallback"
import { LocaleHtml } from "./locale-html"
import { getDict, type Locale } from "@/lib/i18n"

const UniverseEngine = dynamic(
  () => import("./universe-engine").then((m) => ({ default: m.UniverseEngine })),
  { ssr: false, loading: () => <StaticStarfield loading /> },
)

export function LocalizedHome({ locale }: { locale: Locale }) {
  const t = getDict(locale)

  return (
    <>
      <LocaleHtml locale={locale} />

      {/* ── Hero: galaxy backdrop + translated headline ── */}
      <section className="relative h-screen w-full overflow-hidden bg-background text-foreground">
        <div className="absolute inset-0" aria-hidden="true">
          <UniverseRuntimeFallback>
            <UniverseEngine showMusic={false} minimalControls />
          </UniverseRuntimeFallback>
        </div>

        {/* Top bar: name + switcher */}
        <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-6 md:px-12 py-6 pointer-events-none">
          <Link
            href="/"
            className="pointer-events-auto font-mono text-[11px] tracking-[0.25em] uppercase text-foreground/80 hover:text-foreground transition-colors"
          >
            {t.name}
          </Link>
          {/* Escape hatch — auto language is location-based with no switcher, so a
              misdetected visitor must still be able to reach English. */}
          <Link
            href="/"
            data-cursor-hover
            lang="en"
            className="pointer-events-auto inline-flex items-center min-h-9 px-3 rounded-full border border-border bg-background/50 backdrop-blur-sm font-mono text-[11px] tracking-wider text-foreground/80 hover:text-foreground hover:bg-secondary/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            English
          </Link>
        </div>

        {/* Headline block — start-aligned so it mirrors correctly in RTL */}
        <div className="relative z-10 h-full flex flex-col justify-end px-6 md:px-12 pb-24 md:pb-28 pointer-events-none">
          <p className="font-mono text-xs tracking-[0.3em] text-muted-foreground mb-3">
            {t.name}
          </p>
          <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-light tracking-[-0.02em] leading-[1.05] text-balance max-w-3xl">
            {t.heroLine1}
            <br />
            <span className="italic">{t.heroLine2}</span>
          </h1>
          <p className="mt-5 max-w-lg font-sans text-sm md:text-base leading-relaxed text-foreground/75">
            {t.heroValue}
          </p>
          <div className="mt-7 pointer-events-auto">
            <Link
              href="/#works"
              data-cursor-hover
              className="
                group inline-flex items-center gap-3 px-7 py-3.5
                border border-foreground/30 rounded-full
                font-mono text-xs tracking-[0.25em] uppercase
                bg-background/40 backdrop-blur-sm text-foreground
                hover:bg-foreground hover:text-background hover:border-foreground
                transition-colors duration-500 min-h-11
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
              "
            >
              {t.ctaEnterWork}
              <span aria-hidden className="transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1 rtl:rotate-180">
                →
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Manifesto ── */}
      <section className="relative py-24 md:py-32 px-6 md:px-12 border-t border-border">
        <div className="mx-auto w-full max-w-6xl">
          <p className="font-mono text-xs tracking-[0.3em] text-muted-foreground mb-4">
            {t.aboutEyebrow}
          </p>
          <h2 className="font-display text-3xl md:text-5xl font-light italic tracking-[-0.01em] leading-[1.05] mb-14 md:mb-20 max-w-3xl">
            {t.aboutHeading}
          </h2>

          <div className="grid gap-10 md:gap-14 md:grid-cols-2">
            {[
              [t.principle1, t.principle1Body],
              [t.principle2, t.principle2Body],
              [t.principle3, t.principle3Body],
              [t.principle4, t.principle4Body],
            ].map(([title, body], i) => (
              <div key={i} className="flex gap-5">
                <span className="font-mono text-sm text-accent shrink-0 pt-1 tabular-nums">
                  0{i + 1}
                </span>
                <div>
                  <h3 className="font-display text-xl md:text-2xl font-light tracking-[-0.01em] mb-3">
                    {title}
                  </h3>
                  <p className="font-sans text-sm md:text-base text-foreground/75 leading-relaxed">
                    {body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer CTA + back to English ── */}
      <footer className="relative py-20 md:py-28 px-6 md:px-12 border-t border-border">
        <div className="mx-auto w-full max-w-6xl text-center">
          <h2 className="font-display text-3xl md:text-5xl font-light italic tracking-[-0.01em] mb-8">
            {t.footerCTA}
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <a
              href="mailto:sinhaankur@ymail.com"
              data-cursor-hover
              className="inline-flex items-center min-h-11 px-6 py-3 rounded-full border border-foreground/30 bg-background/40 backdrop-blur-sm font-mono text-xs tracking-[0.2em] uppercase hover:bg-foreground hover:text-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {t.footerEmail}
            </a>
            <Link
              href="/"
              data-cursor-hover
              className="inline-flex items-center min-h-11 px-6 py-3 rounded-full border border-border font-mono text-xs tracking-[0.2em] uppercase text-foreground/70 hover:text-foreground transition-colors"
            >
              {t.viewEnglishSite} →
            </Link>
          </div>
          <p className="mt-10 mx-auto max-w-xl font-sans text-xs text-muted-foreground leading-relaxed">
            {t.langNote}
          </p>
        </div>
      </footer>
    </>
  )
}
