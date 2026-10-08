"use client"

import { useEffect, useState } from "react"
import { Github, ExternalLink, Bug, Apple } from "lucide-react"

/**
 * Device-aware download for Vera.
 *
 * Vera is a native macOS app, so the primary CTA only makes sense on a Mac. This
 * detects the visitor's platform and shows the right thing:
 *   - macOS   → the real "Download Vera (macOS)" button (one package → latest release)
 *   - other   → an honest "macOS only" state with Source + a note, so a Windows/
 *               Linux/phone visitor isn't handed a download that can't run.
 *
 * SSR-safe: renders the neutral macOS button on the server + first paint (so SEO
 * and no-JS visitors still get the real link), then refines once mounted.
 */

const REPO = "https://github.com/sinhaankur/cognitive-twin-agent"
const LATEST = `${REPO}/releases/latest`

type OS = "mac" | "ios" | "windows" | "linux" | "other"

function detectOS(): OS {
  if (typeof navigator === "undefined") return "mac" // SSR default: the real target
  const ua = navigator.userAgent
  const plat = (navigator.platform || "").toLowerCase()
  if (/iPhone|iPad|iPod/.test(ua)) return "ios"
  if (/Mac/.test(ua) || plat.includes("mac")) return "mac"
  if (/Win/.test(ua) || plat.includes("win")) return "windows"
  if (/Linux|X11/.test(ua)) return "linux"
  return "other"
}

export function VeraDownload() {
  // start as the SSR default so first paint matches the server, then refine
  const [os, setOs] = useState<OS>("mac")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setOs(detectOS())
    setMounted(true)
  }, [])

  const isMac = os === "mac"

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-3">
        {isMac ? (
          <a
            href={LATEST}
            target="_blank"
            rel="noreferrer noopener"
            data-cursor-hover
            className="inline-flex items-center gap-2.5 px-5 py-3 rounded-full border border-accent/50 bg-accent/10 hover:border-accent transition-colors duration-300 font-mono text-xs tracking-[0.2em] uppercase text-foreground"
          >
            <Apple className="w-4 h-4" aria-hidden="true" />
            Download Vera (macOS)
            <ExternalLink className="w-3 h-3 opacity-60" aria-hidden="true" />
          </a>
        ) : (
          /* non-Mac visitor: be honest — it won't run, so don't pretend */
          <span
            className="inline-flex items-center gap-2.5 px-5 py-3 rounded-full border border-border bg-secondary/20 font-mono text-xs tracking-[0.2em] uppercase text-muted-foreground"
            title="Vera is a native macOS app"
          >
            <Apple className="w-4 h-4" aria-hidden="true" />
            {mounted ? "Vera is macOS-only (for now)" : "Download Vera (macOS)"}
          </span>
        )}

        <a
          href={REPO}
          target="_blank"
          rel="noreferrer noopener"
          data-cursor-hover
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-border bg-secondary/30 hover:border-accent/60 transition-colors duration-300 font-mono text-[10px] tracking-[0.2em] uppercase text-foreground/85"
        >
          <Github className="w-4 h-4" aria-hidden="true" />
          Source (open)
        </a>
        <a
          href={`${REPO}/issues/new`}
          target="_blank"
          rel="noreferrer noopener"
          data-cursor-hover
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-border bg-background hover:border-accent/60 transition-colors duration-300 font-mono text-[10px] tracking-[0.2em] uppercase text-foreground/85"
        >
          <Bug className="w-3.5 h-3.5" aria-hidden="true" />
          Report a problem
        </a>
      </div>

      {/* a one-line nudge for the non-Mac visitor, only after detection */}
      {mounted && !isMac && (
        <p className="text-xs text-muted-foreground">
          {os === "ios"
            ? "On iPhone? Firmament brings the Universe Engine to iOS — Vera herself runs on a Mac."
            : "Vera runs natively on macOS (Apple Silicon). You can still read the open source, or star it to follow along."}
        </p>
      )}
    </div>
  )
}
