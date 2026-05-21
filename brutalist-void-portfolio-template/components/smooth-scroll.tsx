"use client"

import { ReactLenis } from "lenis/react"
import { useEffect, useState, type ReactNode } from "react"

export function SmoothScroll({ children }: { children: ReactNode }) {
  const [enableLenis, setEnableLenis] = useState(true)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setEnableLenis(!mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])

  if (!enableLenis) {
    return <>{children}</>
  }

  return (
    <ReactLenis root options={{ lerp: 0.1, duration: 1.2, smoothWheel: true }}>
      {children}
    </ReactLenis>
  )
}
