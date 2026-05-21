"use client"

/**
 * Auto-extracted table of contents for case studies.
 *
 * On mount (and whenever the route changes) we walk the page for every
 * `<h2 data-case-section>` and build a list of { id, title } anchors.
 * IntersectionObserver tracks the currently visible section so the active
 * TOC item highlights as the reader scrolls. Click → smooth-scroll to anchor.
 *
 * Layout per breakpoint:
 *   ≥ xl (1280 px+) : floating sticky aside on the right margin
 *   < xl            : compact "Section ▾" disclosure pinned just below the
 *                     reading-progress bar, slides open as a sheet on tap
 *
 * Hidden entirely if there are fewer than three sections (no TOC needed
 * for short reads).
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown } from "lucide-react"

type Section = { id: string; title: string }

export function CaseStudyToc() {
  const [sections, setSections] = useState<Section[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const observerRef = useRef<IntersectionObserver | null>(null)

  // Scan the document for case-study section headings on mount.
  useEffect(() => {
    if (typeof document === "undefined") return
    const headings = Array.from(
      document.querySelectorAll<HTMLHeadingElement>("h2[data-case-section]"),
    )
    const next = headings
      .filter((h) => h.id)
      .map<Section>((h) => ({ id: h.id, title: h.textContent?.trim() ?? "" }))
    setSections(next)
    if (next.length > 0) setActiveId(next[0].id)
  }, [])

  // Highlight the section nearest the top of the reading area.
  useEffect(() => {
    if (sections.length === 0) return
    if (observerRef.current) observerRef.current.disconnect()

    observerRef.current = new IntersectionObserver(
      (entries) => {
        // Sort visible entries by their distance from the top of the viewport
        // (smallest top wins) so the active item lands on the section the
        // reader is actually on, not whichever observer callback fired last.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) =>
              a.boundingClientRect.top - b.boundingClientRect.top,
          )
        if (visible.length > 0) {
          setActiveId(visible[0].target.id)
        }
      },
      {
        // Active band is the top third of the viewport — feels like "what
        // the reader is currently looking at" without flicker as they scroll.
        rootMargin: "-25% 0% -60% 0%",
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    )

    sections.forEach((s) => {
      const el = document.getElementById(s.id)
      if (el) observerRef.current?.observe(el)
    })

    return () => observerRef.current?.disconnect()
  }, [sections])

  const jumpTo = useCallback((id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    el.scrollIntoView({ behavior: "smooth", block: "start" })
    setOpen(false)
  }, [])

  if (sections.length < 3) return null

  const activeTitle =
    sections.find((s) => s.id === activeId)?.title ?? sections[0]?.title ?? ""

  return (
    <>
      {/* Desktop — sticky aside on the right margin. xl+ only because the
          long-form pages already use a 48rem reading column; below xl this
          would push content too narrow. */}
      <aside
        aria-label="Sections"
        className="hidden xl:block fixed top-32 right-8 2xl:right-12 z-30 w-56"
      >
        <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-3">
          On this page
        </p>
        <ul className="space-y-1.5">
          {sections.map((s) => {
            const isActive = s.id === activeId
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => jumpTo(s.id)}
                  data-cursor-hover
                  className={`
                    group w-full text-left flex items-start gap-2.5
                    py-1 pl-3 -ml-3
                    transition-colors duration-200
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                    focus-visible:ring-offset-4 focus-visible:ring-offset-background
                    rounded-sm
                    ${isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"}
                  `}
                >
                  <span
                    aria-hidden="true"
                    className={`
                      mt-2 inline-block w-2 h-px shrink-0
                      transition-all duration-200
                      ${isActive ? "w-5 bg-accent" : "w-2 bg-border group-hover:bg-foreground/50"}
                    `}
                  />
                  <span className="font-sans text-sm leading-snug">
                    {s.title}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </aside>

      {/* Mobile / tablet — pinned disclosure that opens a sheet of sections. */}
      <div className="xl:hidden fixed top-[68px] md:top-[78px] left-1/2 -translate-x-1/2 z-30 w-[min(calc(100%-1.5rem),28rem)]">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Open section menu"
          aria-expanded={open}
          aria-controls="case-study-toc-sheet"
          data-cursor-hover
          className="
            group w-full flex items-center gap-2 px-4 py-2
            rounded-full border border-border bg-background/85 backdrop-blur-md
            shadow-sm
            font-mono text-[10px] tracking-[0.25em] uppercase
            text-foreground/80 hover:text-foreground hover:border-accent/60
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
            focus-visible:ring-offset-2 focus-visible:ring-offset-background
            transition-colors duration-200
          "
        >
          <span className="text-accent">§</span>
          <span className="flex-1 min-w-0 truncate text-left">
            {activeTitle || "Sections"}
          </span>
          <motion.span
            aria-hidden="true"
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="shrink-0"
          >
            <ChevronDown className="w-3 h-3" />
          </motion.span>
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              id="case-study-toc-sheet"
              role="dialog"
              aria-label="Sections"
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="
                mt-2 rounded-xl border border-border bg-background/95 backdrop-blur-md
                shadow-2xl p-3
              "
            >
              <ul className="space-y-0.5 max-h-[60vh] overflow-y-auto">
                {sections.map((s) => {
                  const isActive = s.id === activeId
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => jumpTo(s.id)}
                        className={`
                          w-full text-left px-3 py-2.5 rounded-md
                          font-sans text-sm
                          transition-colors duration-150
                          ${
                            isActive
                              ? "text-foreground bg-secondary/60"
                              : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                          }
                        `}
                      >
                        <span className="font-mono text-[10px] text-accent mr-2 tracking-widest">
                          {isActive ? "●" : "○"}
                        </span>
                        {s.title}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}
