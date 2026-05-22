"use client"

import { useState, useEffect } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { ArrowUpRight, Download } from "lucide-react"

const socials: Array<{ label: string; href: string; download?: boolean }> = [
  { label: "Email", href: "mailto:sinhaankur@ymail.com" },
  { label: "LinkedIn", href: "https://linkedin.com/in/sinhaankur27" },
  { label: "GitHub", href: "https://github.com/sinhaankur" },
  { label: "Resume", href: "/ankur-sinha-resume.pdf", download: true },
]

export function Footer() {
  const prefersReducedMotion = useReducedMotion()
  const [time, setTime] = useState("")
  const [isHovered, setIsHovered] = useState(false)

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
      {/* Contact CTA — quiet section, single button */}
      <section
        aria-labelledby="contact-heading"
        className="relative px-6 md:px-12 py-20 md:py-28 border-t border-border"
      >
        <div className="mx-auto max-w-6xl flex flex-col md:flex-row md:items-end md:justify-between gap-8">
          <div className="max-w-2xl">
            <p className="font-mono text-xs tracking-[0.3em] text-muted-foreground mb-4">
              08 — CONTACT
            </p>
            <h2
              id="contact-heading"
              className="font-display text-3xl md:text-5xl lg:text-6xl font-light tracking-[-0.01em] text-foreground"
            >
              Let's <span className="italic">collaborate</span>.
            </h2>
            <p className="mt-4 font-sans text-base md:text-lg text-foreground/75 leading-relaxed">
              Working on a hard human–AI surface, a console for operators, or
              an open-source tool that needs a designer who writes their own
              code? Drop a line.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-start md:self-end shrink-0">
            <motion.a
              href="mailto:sinhaankur@ymail.com?subject=Let%27s%20collaborate"
              aria-label="Email Ankur Sinha to collaborate"
              data-cursor-hover
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              onFocus={() => setIsHovered(true)}
              onBlur={() => setIsHovered(false)}
              whileHover={prefersReducedMotion ? undefined : { x: 4 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="
                group inline-flex items-center gap-3
                px-6 py-3.5 border border-border rounded-full
                font-mono text-xs tracking-[0.25em] uppercase
                bg-background text-foreground
                hover:bg-accent hover:text-accent-foreground hover:border-accent
                transition-colors duration-300
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                focus-visible:ring-offset-4 focus-visible:ring-offset-background
                min-h-11
              "
            >
              Email me
              <motion.span
                aria-hidden="true"
                animate={
                  prefersReducedMotion ? undefined : { rotate: isHovered ? 45 : 0 }
                }
                transition={{ duration: 0.3 }}
                className="inline-flex"
              >
                <ArrowUpRight className="w-4 h-4" />
              </motion.span>
            </motion.a>

            {/* Secondary action — résumé download. Quieter (no fill on hover,
                muted border) so it doesn't compete with the primary email CTA. */}
            <a
              href="/ankur-sinha-resume.pdf"
              download
              data-cursor-hover
              aria-label="Download résumé (PDF)"
              className="
                group inline-flex items-center gap-3
                px-6 py-3.5 border border-border/70 rounded-full
                font-mono text-xs tracking-[0.25em] uppercase
                bg-transparent text-foreground/80
                hover:text-foreground hover:border-foreground/60
                transition-colors duration-300
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                focus-visible:ring-offset-4 focus-visible:ring-offset-background
                min-h-11
              "
            >
              Résumé
              <Download className="w-4 h-4" aria-hidden="true" />
            </a>
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
