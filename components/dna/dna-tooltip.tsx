"use client"

/**
 * DnaTooltip — a small, accessible "why?" affordance for the genome page.
 *
 * Every conclusion on this page (e.g. "your children won't get the flush variant
 * from your side") should be openable into its reasoning, not taken on faith.
 * This is click/tap-to-toggle — NOT hover-only — so it works on touch, closes on
 * outside-click or Escape, and reads by keyboard. The explanation is plain text.
 */

import { useEffect, useId, useRef, useState } from "react"
import { HelpCircle } from "lucide-react"

export function DnaTooltip({
  label = "Why?",
  children,
}: {
  /** short trigger text; defaults to "Why?". */
  label?: string
  /** the detailed explanation shown in the popover. */
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <span ref={ref} className="relative inline-block align-middle">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-cursor-hover
        aria-expanded={open}
        aria-controls={panelId}
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-wider uppercase transition-colors min-h-6 ${
          open
            ? "border-accent/60 bg-accent/10 text-accent"
            : "border-border text-foreground/60 hover:text-accent hover:border-accent/50"
        }`}
      >
        <HelpCircle className="h-3 w-3" aria-hidden />
        {label}
      </button>

      {open && (
        <span
          id={panelId}
          role="tooltip"
          className="absolute left-0 top-[calc(100%+6px)] z-40 block w-[min(20rem,80vw)] rounded-xl border border-accent/30 bg-background/98 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-sm motion-safe:animate-[dna-tab-in_0.25s_ease-out_both]"
        >
          <span className="block font-sans text-sm leading-relaxed text-foreground/85">
            {children}
          </span>
        </span>
      )}
    </span>
  )
}
