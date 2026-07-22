"use client"

import { useState, useEffect } from "react"
import { Download } from "lucide-react"
import { SignalTuner } from "./signal-tuner"

// Baked at build time via next.config (NEXT_PUBLIC_BUILD_TIME). Falls back to
// now in dev. Reflects each deploy, not the visitor's clock.
const BUILD_TIME = process.env.NEXT_PUBLIC_BUILD_TIME || new Date().toISOString()

/* ── FooterSky — the quiet night sky behind the contact section ──────────
   House rule holds even for decoration: REAL data. The asterism is the Big
   Dipper plotted from the seven stars' actual J2000 RA/Dec (gnomonic-ish
   flat projection), dot radius following real apparent magnitude — Alioth
   and Dubhe largest, Megrez (3.3ᵐ) smallest. The same asterism the Universe
   Engine draws overhead in the hero.

   Star specks are positioned by a pure function of their index (no
   Math.random in render — build HTML and client hydration must agree, see
   the #418 note by the deploy date below). Twinkle is CSS-only and wrapped
   in prefers-reduced-motion. */
const DIPPER_STARS: Array<{ x: number; y: number; r: number; name: string }> = [
  { x: 12.1, y: 9.7, r: 1.25, name: "Dubhe" },   // α UMa · 1.79ᵐ
  { x: 11.1, y: 28.0, r: 1.05, name: "Merak" },  // β UMa · 2.34ᵐ
  { x: 35.9, y: 37.1, r: 1.0, name: "Phecda" },  // γ UMa · 2.41ᵐ
  { x: 46.1, y: 25.8, r: 0.8, name: "Megrez" },  // δ UMa · 3.32ᵐ
  { x: 64.5, y: 29.4, r: 1.3, name: "Alioth" },  // ε UMa · 1.76ᵐ
  { x: 78.8, y: 32.9, r: 1.1, name: "Mizar" },   // ζ UMa · 2.23ᵐ
  { x: 90.0, y: 52.0, r: 1.2, name: "Alkaid" },  // η UMa · 1.86ᵐ
]
const DIPPER_LINES: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 0], // the bowl
  [3, 4], [4, 5], [5, 6],         // the handle
]
const SPECK_COUNT = 22

function FooterSky() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 text-foreground">
      {/* drifting specks — deterministic positions from the index */}
      <div className="absolute inset-0 opacity-50">
        {Array.from({ length: SPECK_COUNT }, (_, i) => {
          const x = ((i * 47 + 11) % 100)
          const y = ((i * 29 + 13) % 97)
          const s = 1 + ((i * 7) % 3) * 0.5
          const dur = 2.6 + ((i * 13) % 5) * 0.8
          const delay = ((i * 17) % 40) / 10
          return (
            <span
              key={i}
              className="absolute rounded-full bg-current"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                width: s,
                height: s,
                opacity: 0.18,
                animation: `footer-twinkle ${dur}s ease-in-out ${delay}s infinite`,
              }}
            />
          )
        })}
      </div>

      {/* the Big Dipper — top-right, faint, hairline-linked */}
      <svg
        viewBox="0 0 100 60"
        className="absolute right-4 top-8 w-36 opacity-25 md:right-16 md:top-12 md:w-56"
        fill="currentColor"
        stroke="currentColor"
      >
        {DIPPER_LINES.map(([a, b]) => (
          <line
            key={`${a}-${b}`}
            x1={DIPPER_STARS[a].x}
            y1={DIPPER_STARS[a].y}
            x2={DIPPER_STARS[b].x}
            y2={DIPPER_STARS[b].y}
            strokeWidth="0.3"
            opacity="0.5"
          />
        ))}
        {DIPPER_STARS.map((st) => (
          <circle key={st.name} cx={st.x} cy={st.y} r={st.r} stroke="none" />
        ))}
      </svg>

      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          @keyframes footer-twinkle {
            0%, 100% { opacity: 0.08; }
            50% { opacity: 0.38; }
          }
        }
      `}</style>
    </div>
  )
}

const socials: Array<{ label: string; href: string; download?: boolean }> = [
  { label: "Email", href: "mailto:sinhaankur@ymail.com" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/sinhaankur27" },
  { label: "GitHub", href: "https://github.com/sinhaankur" },
  { label: "Writing", href: "/writing" },
  { label: "Academic", href: "/academic/p2p-streaming" },
  { label: "Resume", href: "/ankur-sinha-resume.pdf", download: true },
]

export function Footer() {
  const [time, setTime] = useState("")

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      const hours = now.getHours().toString().padStart(2, "0")
      const minutes = now.getMinutes().toString().padStart(2, "0")
      setTime(`${hours}:${minutes}`)
    }

    updateTime()
    // Minute resolution — seconds add visual jitter for no benefit. Updates
    // every 30s so the displayed time is at most 30s stale.
    const interval = setInterval(updateTime, 30_000)
    return () => clearInterval(interval)
  }, [])

  return (
    <footer className="relative">
      {/* Contact section — split row on desktop, stacked on mobile.
          Left: eyebrow + headline + intro copy.
          Right: the SignalTuner panel (the new primary action).
          Below: a quieter Résumé download for visitors who'd rather
          read the PDF than open a mail client. */}
      <section
        aria-labelledby="contact-heading"
        className="relative overflow-hidden px-6 md:px-12 py-20 md:py-28 border-t border-border"
      >
        <FooterSky />
        <div className="relative mx-auto max-w-6xl">
          <div className="grid gap-10 md:gap-12 lg:gap-16 md:grid-cols-2 md:items-start">
            <div className="max-w-2xl">
              <p className="font-mono text-xs tracking-[0.3em] text-muted-foreground mb-4">
                08 — CONTACT
              </p>
              {/* Small celestial-atlas line-art mark — a paper plane
                  arcing across a horizon line. Encodes "outgoing
                  message" + ties back to the universe engine. */}
              <svg
                aria-hidden="true"
                viewBox="0 0 80 40"
                className="mb-6 w-16 h-8 text-accent/70"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              >
                <line x1="2" y1="34" x2="78" y2="34" strokeDasharray="1.5 2.5" />
                <polygon points="32,8 60,22 38,26" />
                <line x1="32" y1="8" x2="38" y2="26" />
                <path d="M 8 30 Q 18 24 30 22" strokeDasharray="2 2.5" />
              </svg>
              <h2
                id="contact-heading"
                className="font-display text-3xl md:text-5xl lg:text-6xl font-light tracking-[-0.01em] text-foreground"
              >
                Let's <span className="italic">collaborate</span>.
              </h2>
              <p className="mt-4 font-sans text-base md:text-lg text-foreground/75 leading-relaxed">
                Working on a hard human–AI surface, a console for operators, or
                an open-source tool that needs a designer who writes their own
                code? Open a channel.
              </p>

              {/* Résumé link — quieter sibling. Below the intro so it
                  doesn't compete with the tuner, but still discoverable. */}
              <a
                href="/ankur-sinha-resume.pdf"
                download
                data-cursor-hover
                aria-label="Download résumé (PDF)"
                className="
                  mt-8 inline-flex items-center gap-2.5
                  font-mono text-[11px] tracking-[0.25em] uppercase
                  text-muted-foreground hover:text-foreground
                  transition-colors duration-300
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                  focus-visible:ring-offset-2 focus-visible:ring-offset-background
                  rounded
                "
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                Résumé · PDF
              </a>
            </div>

            <div className="md:pt-2">
              <SignalTuner to="sinhaankur@ymail.com" defaultSubject="Transmission" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Bottom bar — two quiet rows on a shared grid ──────────────────
          Row 1: identity (left) + the link set (right).
          Row 2: hairline divider, then legal (left) + place/time/deploy (right).
          Left-anchored on mobile — centred mono fragments read as scatter. */}
      {/* pb-28 on mobile clears the floating UPCOMING badge (fixed, bottom-right)
          so the meta line never sits underneath it. */}
      <div className="px-6 md:px-12 pt-10 pb-28 md:py-10 border-t border-border">
        <div className="mx-auto w-full max-w-6xl">
          <div className="flex flex-col gap-6 md:flex-row md:items-baseline md:justify-between">
            <p className="font-mono text-xs tracking-[0.3em] text-foreground">
              ANKUR SINHA
            </p>

            <ul className="flex flex-wrap gap-x-7 gap-y-3">
              {socials.map((link) => {
                const isExternal = link.href.startsWith("http")
                const isDownload = "download" in link && link.download
                return (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      {...(isExternal
                        ? { target: "_blank", rel: "noreferrer noopener" }
                        : {})}
                      {...(isDownload ? { download: true } : {})}
                      data-cursor-hover
                      aria-label={
                        isExternal
                          ? `${link.label} — opens in a new tab`
                          : isDownload
                          ? `Download ${link.label}`
                          : link.label
                      }
                      className="
                        relative font-mono text-xs tracking-widest
                        text-muted-foreground hover:text-foreground
                        transition-colors duration-300
                        after:absolute after:-bottom-1 after:left-0 after:h-px after:w-full
                        after:origin-left after:scale-x-0 after:bg-accent
                        after:transition-transform after:duration-300 after:ease-out
                        hover:after:scale-x-100
                        focus-visible:outline-none
                        focus-visible:ring-2 focus-visible:ring-accent
                        focus-visible:ring-offset-2 focus-visible:ring-offset-background
                        rounded
                      "
                    >
                      {link.label.toUpperCase()}
                    </a>
                  </li>
                )
              })}
            </ul>
          </div>

          <div
            className="
              mt-8 pt-6 border-t border-border/60
              flex flex-col gap-2.5 md:flex-row md:items-baseline md:justify-between
              font-mono text-[11px] tracking-[0.16em] text-muted-foreground
            "
          >
            {/* Legal — the license file is one click away from the claim. */}
            <p>
              {/* Build-time UTC year, not the visitor's clock — same hydration
                  rule as the deploy date below (see #418 note). */}
              © {new Date(BUILD_TIME).getUTCFullYear()} Ankur Sinha ·{" "}
              <a
                href="https://github.com/sinhaankur/portfolio-2026/blob/main/LICENSE"
                target="_blank"
                rel="noreferrer noopener"
                data-cursor-hover
                className="
                  hover:text-foreground transition-colors duration-200
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                  focus-visible:ring-offset-2 focus-visible:ring-offset-background
                  rounded
                "
                aria-label="License — all rights reserved (opens on GitHub)"
              >
                All rights reserved
              </a>
            </p>

            {/* Place + live local time + deploy date, one quiet line. */}
            <p className="tabular-nums">
              Toronto ·{" "}
              <time aria-live="off">{time}</time> local · Updated{" "}
              <time dateTime={BUILD_TIME}>
                {/* Pinned to UTC: the CI server bakes this string into the HTML
                    in UTC, so letting the browser re-render it in the visitor's
                    timezone flips the date across midnight → React hydration
                    error #418 on every page. One timezone, one truth. */}
                {new Date(BUILD_TIME).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  timeZone: "UTC",
                })}
              </time>
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
