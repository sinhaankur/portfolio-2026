"use client"

/**
 * LawModal — the click-through "pop view" for a single cognitive law.
 *
 * Built for CLARITY + MEMORABILITY (Ankur: "I need to remember them mostly"):
 *   • the mnemonic leads — a sticky one-liner you keep,
 *   • a bespoke visualization shows HOW it works (dual-coding),
 *   • "what it is" explains it plainly,
 *   • "how it helps users" gives the human payoff,
 *   • the apply note closes with what to do on a mock.
 *
 * Accessible: role=dialog, focus trap, Esc + scrim close, focus returns to the
 * trigger. Reduced-motion-safe (fade only). No deps.
 */

import { useEffect, useRef } from "react"
import { X } from "lucide-react"
import type { FrameworkLaw } from "@/lib/framework-data"
import { LawViz } from "@/components/framework-law-viz"

export function LawModal({ law, onClose }: { law: FrameworkLaw; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return }
      if (e.key === "Tab") {
        // simple focus trap within the panel
        const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button, input, [tabindex]:not([tabindex="-1"])',
        )
        if (!focusables || focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener("keydown", onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center p-4 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="law-modal-title"
    >
      {/* scrim — figure/ground: lifts the dialog above the page */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm ue-engine-fade-in"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        className="relative w-full max-w-lg max-h-[88vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-[0_24px_80px_-24px_rgba(0,0,0,0.7)] p-6 md:p-7 ue-engine-fade-in"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          data-cursor-hover
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-accent mb-2">Law of UX</p>
        <h3 id="law-modal-title" className="font-display text-2xl md:text-3xl font-light tracking-[-0.01em] pr-8">{law.name}</h3>

        {/* mnemonic — the thing to remember */}
        {law.mnemonic && (
          <p className="mt-3 rounded-xl border border-accent/30 bg-accent/[0.07] px-4 py-2.5 font-sans text-base text-foreground/90 italic">
            &ldquo;{law.mnemonic}&rdquo;
          </p>
        )}

        {/* visualization — how it works */}
        <div className="mt-5">
          <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-2">How it works</p>
          <LawViz viz={law.viz} />
        </div>

        {/* what it is */}
        <div className="mt-5">
          <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-1.5">What it is</p>
          <p className="font-sans text-sm text-foreground/75 leading-relaxed">{law.deep ?? law.what}</p>
        </div>

        {/* how it helps users */}
        {law.helps && (
          <div className="mt-4">
            <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-1.5">How it helps users</p>
            <p className="font-sans text-sm text-foreground/75 leading-relaxed">{law.helps}</p>
          </div>
        )}

        {/* apply */}
        {law.apply && (
          <div className="mt-5 rounded-xl border border-border bg-background/50 px-4 py-3">
            <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-accent mb-1">Apply it</p>
            <p className="font-sans text-sm text-foreground/80 leading-relaxed">{law.apply}</p>
          </div>
        )}
      </div>
    </div>
  )
}
