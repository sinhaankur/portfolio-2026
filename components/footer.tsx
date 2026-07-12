"use client"

import { useState, useEffect } from "react"
import { Download } from "lucide-react"
import { SignalTuner } from "./signal-tuner"

// Baked at build time via next.config (NEXT_PUBLIC_BUILD_TIME). Falls back to
// now in dev. Reflects each deploy, not the visitor's clock.
const BUILD_TIME = process.env.NEXT_PUBLIC_BUILD_TIME || new Date().toISOString()

const socials: Array<{ label: string; href: string; download?: boolean }> = [
  { label: "Email", href: "mailto:sinhaankur@ymail.com" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/sinhaankur27" },
  { label: "GitHub", href: "https://github.com/sinhaankur" },
  { label: "Writing", href: "/writing" },
  { label: "The Math", href: "/universe-engine/math" },
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
        className="relative px-6 md:px-12 py-20 md:py-28 border-t border-border"
      >
        <div className="mx-auto max-w-6xl">
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
                        font-mono text-xs tracking-widest
                        text-muted-foreground hover:text-foreground
                        transition-colors duration-300
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
              © {new Date().getFullYear()} Ankur Sinha ·{" "}
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
                {new Date(BUILD_TIME).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </time>
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
