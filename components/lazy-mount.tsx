"use client"

/**
 * LazyMount — defers mounting its children until the placeholder scrolls near
 * the viewport. Used to lazy-load below-the-fold home sections so their JS and
 * render cost don't block first paint.
 *
 * It reserves vertical space with `minHeight` so the page doesn't jump as
 * sections mount, and uses a generous rootMargin so content is ready before the
 * user actually reaches it. Falls back to mounting immediately if
 * IntersectionObserver is unavailable (or reduced-data not a concern here).
 */

import { useEffect, useRef, useState, type ReactNode } from "react"

export function LazyMount({
  children,
  minHeight = 480,
  rootMargin = "600px",
  anchorId,
}: {
  children: ReactNode
  /** Reserved height (px) for the placeholder, to avoid layout shift. */
  minHeight?: number
  /** How early to mount before entering the viewport. */
  rootMargin?: string
  /**
   * If the wrapped section owns a page anchor (e.g. #works), pass it here so the
   * id lives on the always-present wrapper. That keeps deep links like /#works
   * working even before the section has mounted, and triggers the mount via the
   * scroll into view.
   */
  anchorId?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (show) return
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === "undefined") {
      setShow(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShow(true)
          io.disconnect()
        }
      },
      { rootMargin },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [show, rootMargin])

  return (
    <div
      ref={ref}
      id={anchorId}
      style={show ? undefined : { minHeight, scrollMarginTop: "5rem" }}
    >
      {show ? children : null}
    </div>
  )
}
