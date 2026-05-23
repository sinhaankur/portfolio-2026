"use client"

import { useState, useEffect } from "react"
import { Download } from "lucide-react"
import { SignalTuner } from "./signal-tuner"

const socials: Array<{ label: string; href: string; download?: boolean }> = [
  { label: "Email", href: "mailto:sinhaankur@ymail.com" },
  { label: "LinkedIn", href: "https://linkedin.com/in/sinhaankur27" },
  { label: "GitHub", href: "https://github.com/sinhaankur" },
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
    <footer id="contact" className="relative">
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

      {/* Footer Info */}
      <div className="px-6 md:px-12 py-8 border-t border-border">
        <div className="mx-auto w-full max-w-6xl flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Local Time */}
          <div className="font-mono text-xs tracking-widest text-muted-foreground">
            <span className="mr-2">LOCAL TIME</span>
            <span className="text-foreground tabular-nums" aria-live="off">
              {time}
            </span>
          </div>

          {/* Links */}
          <ul className="flex flex-wrap justify-center gap-6 md:gap-8">
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

          {/* Copyright — link goes to the LICENSE file on GitHub so the
              "all rights reserved" stance is one click away from the footer. */}
          <p className="font-mono text-xs tracking-widest text-muted-foreground">
            ©{" "}{new Date().getFullYear()}{" "}ANKUR SINHA · {" "}
            <a
              href="https://github.com/sinhaankur/Portfolio/blob/main/LICENSE"
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
              ALL RIGHTS RESERVED
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
