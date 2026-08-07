"use client"

import { useState, useCallback } from "react"

/**
 * Report a bug — a static-site-friendly reporter. No backend: it composes a
 * mailto with the diagnostic context pre-filled (page, viewport, device, GPU,
 * and any perf tier the engine exposes) so a report is actually actionable
 * ("laggy" is useless without knowing the device + GPU). The user still writes
 * what went wrong; we just capture the environment for them.
 *
 * Renders as either a quiet inline link (`variant="link"`, for the footer) or a
 * small floating pill button (`variant="pill"`, for the engines/games).
 */

const REPORT_EMAIL = "sinhaankur@ymail.com"

/** Best-effort WebGL renderer string (the actual GPU), for engine reports. */
function readGpu(): string {
  try {
    const canvas = document.createElement("canvas")
    const gl =
      (canvas.getContext("webgl2") as WebGL2RenderingContext | null) ||
      (canvas.getContext("webgl") as WebGLRenderingContext | null)
    if (!gl) return "no-webgl"
    const dbg = gl.getExtension("WEBGL_debug_renderer_info")
    const renderer = dbg
      ? (gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) as string)
      : (gl.getParameter(gl.RENDERER) as string)
    return renderer || "unknown-gpu"
  } catch {
    return "gpu-read-failed"
  }
}

/** Collect the environment so a bug report is diagnosable. */
function collectContext(area: string): string {
  if (typeof window === "undefined") return ""
  const nav = window.navigator
  const lines: string[] = [
    `Area: ${area}`,
    `Page: ${window.location.href}`,
    `Viewport: ${window.innerWidth}×${window.innerHeight} @ DPR ${window.devicePixelRatio}`,
    `Device memory: ${(nav as Navigator & { deviceMemory?: number }).deviceMemory ?? "n/a"} GB`,
    `CPU cores: ${nav.hardwareConcurrency ?? "n/a"}`,
    `GPU: ${readGpu()}`,
    `Reduced motion: ${window.matchMedia("(prefers-reduced-motion: reduce)").matches}`,
    `User agent: ${nav.userAgent}`,
  ]
  // Any engine perf tier surfaced globally (set by the engine when it converges).
  const tier = (window as unknown as { __ueTier?: string }).__ueTier
  if (tier) lines.push(`Engine tier: ${tier}`)
  return lines.join("\n")
}

function buildMailto(area: string): string {
  const subject = `Bug report — ${area}`
  const body = [
    "What went wrong (please describe):",
    "",
    "",
    "What you expected:",
    "",
    "",
    "— — — — — — — — — —",
    "Diagnostics (auto-collected, please keep):",
    collectContext(area),
  ].join("\n")
  return `mailto:${REPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export function ReportBug({
  area,
  variant = "link",
  className = "",
}: {
  /** Where the report is from, e.g. "Universe Engine", "Satellite Engine", "Website". */
  area: string
  variant?: "link" | "pill"
  className?: string
}) {
  const [opening, setOpening] = useState(false)

  const onClick = useCallback(() => {
    setOpening(true)
    window.location.href = buildMailto(area)
    // brief visual ack
    window.setTimeout(() => setOpening(false), 1200)
  }, [area])

  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={onClick}
        data-cursor-hover
        aria-label={`Report a bug in the ${area}`}
        className={`inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/40 px-3 py-1.5 font-mono text-[10px] tracking-[0.15em] uppercase text-white/70 backdrop-blur-sm transition-colors hover:text-white hover:border-white/30 ${className}`}
      >
        <BugGlyph />
        {opening ? "Opening…" : "Report a bug"}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      data-cursor-hover
      aria-label="Report a bug"
      className={`relative font-mono text-xs tracking-widest text-muted-foreground hover:text-foreground transition-colors duration-300 ${className}`}
    >
      {opening ? "OPENING…" : "REPORT A BUG"}
    </button>
  )
}

function BugGlyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden>
      <ellipse cx="8" cy="9" rx="3.5" ry="4.5" />
      <path d="M8 4.5V3M5.5 5 4 3.5M10.5 5 12 3.5M4.5 9H2M11.5 9H14M5 12l-1.5 1.5M11 12l1.5 1.5" strokeLinecap="round" />
    </svg>
  )
}
