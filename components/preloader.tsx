"use client"

/**
 * Preloader — a brief branded splash shown on first load while the page boots
 * (fonts, hydration, the heavy R3F hero chunk). It fades out once the window has
 * loaded plus a small minimum on-screen time so it never just flashes.
 *
 * Shown once per browser session (sessionStorage), so internal navigation and
 * refreshes within a session don't re-trigger it. Respects reduced motion.
 */

import { useEffect, useState } from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"

const SESSION_KEY = "preloader-shown-v1"
const MIN_VISIBLE_MS = 900

export function Preloader() {
  const prefersReducedMotion = useReducedMotion()
  // Start hidden during SSR; decide on mount to avoid hydration mismatch.
  const [visible, setVisible] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    let already = false
    try {
      already = sessionStorage.getItem(SESSION_KEY) === "1"
    } catch {
      already = false
    }
    if (already) return

    setVisible(true)
    try {
      sessionStorage.setItem(SESSION_KEY, "1")
    } catch {
      /* private mode — fine, it'll just show again next load */
    }

    const start = Date.now()
    const finish = () => {
      const elapsed = Date.now() - start
      const wait = Math.max(0, MIN_VISIBLE_MS - elapsed)
      window.setTimeout(() => setVisible(false), wait)
    }

    if (document.readyState === "complete") {
      finish()
    } else {
      window.addEventListener("load", finish, { once: true })
      // Safety net: never hold the splash longer than 4s even if `load` stalls.
      const hardStop = window.setTimeout(() => setVisible(false), 4000)
      return () => {
        window.removeEventListener("load", finish)
        window.clearTimeout(hardStop)
      }
    }
  }, [])

  // While the splash is up, lock scroll.
  useEffect(() => {
    if (!visible) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [visible])

  if (!mounted) return null

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="preloader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[200] grid place-items-center bg-background"
          aria-hidden="true"
        >
          <div className="flex flex-col items-center gap-6">
            {/* Orbit mark — a small ring with a tracing dot, echoing the galaxy hero. */}
            <div className="relative h-16 w-16">
              <span className="absolute inset-0 rounded-full border border-border" />
              {!prefersReducedMotion ? (
                <motion.span
                  className="absolute inset-0"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
                >
                  <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-accent shadow-[0_0_12px_var(--accent)]" />
                </motion.span>
              ) : (
                <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-accent" />
              )}
              {/* center sun */}
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full bg-foreground/70" />
            </div>

            <div className="text-center">
              <p className="font-display text-lg tracking-[-0.01em] text-foreground">
                Ankur Sinha
              </p>
              <motion.p
                className="mt-1 font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground"
                initial={{ opacity: 0.4 }}
                animate={prefersReducedMotion ? undefined : { opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              >
                Loading
              </motion.p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
