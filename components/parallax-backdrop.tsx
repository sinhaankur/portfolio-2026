"use client"

import { useEffect, useRef } from "react"

/**
 * A fixed, full-viewport SVG backdrop that drifts slowly as you scroll — a
 * gentle parallax layer behind long-form tribute pages. Pure client-side
 * (scroll + rAF), so it works under `output: "export"`. Respects
 * prefers-reduced-motion. The motif is passed in as children (an <svg> group)
 * so each page can theme it — e.g. silk threads for Dr. Sinha.
 */
export function ParallaxBackdrop({
  children,
  /** How far the layer travels per pixel scrolled (0 = fixed, 0.3 = subtle). */
  speed = 0.15,
  className = "",
}: {
  children: React.ReactNode
  speed?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduce) return

    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        // Drift the motif up as the page scrolls down, plus a slow zoom.
        const y = window.scrollY * speed
        el.style.transform = `translate3d(0, ${-y}px, 0)`
      })
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [speed])

  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed inset-0 -z-10 overflow-hidden ${className}`}
    >
      <div ref={ref} className="absolute inset-0 will-change-transform">
        {children}
      </div>
    </div>
  )
}
