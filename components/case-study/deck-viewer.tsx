"use client"

/**
 * View-only deck viewer for case-study project decks.
 *
 * The decks are sanitized client artifacts. We present them inline in a
 * full-screen modal rather than linking the raw file, and append
 * `#toolbar=0&navpanes=0` so the browser's built-in PDF viewer hides its
 * download/print chrome. This is "view only" in the practical sense — there's
 * no download affordance and the file isn't a bare link. (True DRM isn't
 * possible on a static site; a determined user can always fetch the asset.)
 *
 * Renders a trigger button styled to match `ProjectStory`'s old CTA link.
 */

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { X } from "lucide-react"

type DeckViewerProps = {
  /** Path to the PDF under /public, e.g. "/decks/snowtint/ipress.pdf". */
  href: string
  /** Button label, e.g. "Open the deck". */
  label: string
  /** Accessible title shown in the modal header (the deck's name). */
  title: string
}

export function DeckViewer({ href, label, title }: DeckViewerProps) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const prefersReducedMotion = useReducedMotion()

  useEffect(() => setMounted(true), [])

  // Lock body scroll + close on Escape while the viewer is open.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener("keydown", onKey)
    }
  }, [open])

  // Hide the native PDF toolbar (download/print) where the viewer honors it.
  const src = `${href}#toolbar=0&navpanes=0&statusbar=0&view=FitH`

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-cursor-hover
        className="
          inline-flex items-center gap-2
          font-mono text-xs tracking-widest uppercase
          text-accent hover:text-foreground
          border-b border-accent hover:border-foreground
          pb-1
          transition-colors duration-300
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
          focus-visible:ring-offset-4 focus-visible:ring-offset-background
          rounded-sm
        "
      >
        {label} →
      </button>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-label={title}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.25 }}
                onClick={() => setOpen(false)}
                className="
                  fixed inset-0 z-[100]
                  flex flex-col
                  bg-background/90 backdrop-blur-md
                  p-3 sm:p-6 md:p-10
                "
              >
                <motion.div
                  initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
                  transition={{ duration: prefersReducedMotion ? 0 : 0.3, ease: [0.16, 1, 0.3, 1] }}
                  onClick={(e) => e.stopPropagation()}
                  className="
                    flex flex-col flex-1 min-h-0 w-full max-w-5xl mx-auto
                    rounded-lg border border-border overflow-hidden
                    bg-background
                    shadow-[0_24px_80px_-24px_rgba(0,0,0,0.7)]
                  "
                >
                  {/* Header */}
                  <div className="flex items-center gap-3 px-4 md:px-5 py-3 border-b border-border shrink-0">
                    <span className="font-mono text-[10px] tracking-widest uppercase text-accent">
                      Deck
                    </span>
                    <p className="flex-1 min-w-0 truncate font-sans text-sm md:text-base text-foreground">
                      {title}
                    </p>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      aria-label="Close deck"
                      data-cursor-hover
                      className="
                        inline-flex items-center justify-center
                        w-9 h-9 rounded-full shrink-0
                        text-muted-foreground hover:text-foreground
                        hover:bg-secondary/60
                        transition-colors duration-300
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                        focus-visible:ring-offset-2 focus-visible:ring-offset-background
                      "
                    >
                      <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>

                  {/* PDF inline — view only */}
                  <iframe
                    src={src}
                    title={title}
                    className="flex-1 min-h-0 w-full bg-secondary/20"
                  />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  )
}
