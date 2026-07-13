"use client"

/**
 * Mobile controls for /lab/celestial.
 *
 * On phones the old layout stacked five competing bottom layers (learn-ticker,
 * body rail, timeline, Explore chip, …) over a black void, and the rail's
 * buttons fired on any touch-end so a scroll opened a detail tile. This
 * replaces all of that on mobile with ONE slim bar that expands into
 * drag-dismissable sheets — so most of the screen stays live, touch-draggable
 * scene, and tapping is never confused with scrolling.
 *
 * Desktop is unaffected: the explorer only mounts these under `md` breakpoints.
 */

import { useEffect, useRef, useState } from "react"
import { motion, type PanInfo } from "framer-motion"
import { X, Orbit, Sparkles, Clock } from "lucide-react"
import type { CelestialBody } from "@/lib/celestial-data"

/** True on coarse-pointer / small viewports (matches the engine's 768px cut). */
export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return
    const mq = window.matchMedia("(max-width: 768px)")
    const on = () => setMobile(mq.matches)
    on()
    mq.addEventListener("change", on)
    return () => mq.removeEventListener("change", on)
  }, [])
  return mobile
}

/**
 * A tap-vs-scroll guard. Returns handlers to spread on a touchable control:
 * `onClick` only fires when the pointer barely moved and was released quickly
 * (a real tap), so swiping to scroll a strip never triggers it. This is the
 * fix for "scrolling opens details unless I hold it".
 */
export function useTapGuard(onTap: () => void) {
  const start = useRef<{ x: number; y: number; t: number } | null>(null)
  return {
    onPointerDown: (e: React.PointerEvent) => {
      start.current = { x: e.clientX, y: e.clientY, t: Date.now() }
    },
    onPointerUp: (e: React.PointerEvent) => {
      const s = start.current
      start.current = null
      if (!s) return
      const moved = Math.hypot(e.clientX - s.x, e.clientY - s.y)
      const elapsed = Date.now() - s.t
      // <10px of travel and <500ms held = a deliberate tap, not a scroll/drag.
      if (moved < 10 && elapsed < 500) onTap()
    },
  }
}

/** A bottom sheet that slides up and can be dragged down to dismiss. */
export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 90 || info.velocity.y > 500) onClose()
  }
  return (
    <motion.div
      className="absolute inset-x-0 bottom-0 z-50 md:hidden"
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 320 }}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.4 }}
      onDragEnd={onDragEnd}
    >
      <div
        className="mx-auto max-h-[72vh] overflow-hidden rounded-t-2xl border border-b-0 border-border bg-background/95 backdrop-blur-md shadow-[0_-16px_50px_-12px_rgba(0,0,0,0.6)]"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        {/* Grab handle */}
        <div className="flex justify-center pt-2.5 pb-1">
          <span aria-hidden className="h-1 w-9 rounded-full bg-foreground/25" />
        </div>
        <div className="flex items-center justify-between px-4 pb-2 pt-1">
          <p className="font-mono text-[10px] tracking-[0.28em] uppercase text-accent">{title}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-full text-foreground/55 hover:text-foreground hover:bg-foreground/10 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-4 pb-3 [scrollbar-width:thin]" style={{ maxHeight: "60vh" }}>
          {children}
        </div>
      </div>
    </motion.div>
  )
}

/** Tap-safe body grid for the Bodies sheet — tap selects, scroll scrolls. */
function BodyTile({ body, active, onPick }: { body: CelestialBody; active: boolean; onPick: () => void }) {
  const tap = useTapGuard(onPick)
  return (
    <button
      type="button"
      {...tap}
      aria-pressed={active}
      aria-label={`Show ${body.name}`}
      className="flex flex-col items-center gap-1.5 rounded-xl p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <span
        className="h-14 w-14 overflow-hidden rounded-full border-2 transition-transform active:scale-95"
        style={{
          borderColor: active ? "var(--accent)" : "rgba(255,255,255,0.15)",
          boxShadow: active ? `0 0 18px -2px ${body.accent}` : "none",
        }}
      >
        <img src={body.img} alt="" aria-hidden loading="lazy" className="h-full w-full object-cover" style={{ background: body.accent }} />
      </span>
      <span className={`font-mono text-[9px] tracking-widest uppercase ${active ? "text-accent" : "text-foreground/80"}`}>
        {body.name}
      </span>
    </button>
  )
}

export function BodiesSheet({
  bodies,
  openName,
  onPick,
  onClose,
}: {
  bodies: CelestialBody[]
  openName: string | null
  onPick: (name: string) => void
  onClose: () => void
}) {
  return (
    <Sheet title="Bodies" onClose={onClose}>
      <div className="grid grid-cols-4 gap-1.5">
        {bodies.map((b) => (
          <BodyTile key={b.name} body={b} active={b.name === openName} onPick={() => onPick(b.name)} />
        ))}
      </div>
    </Sheet>
  )
}

/**
 * The always-on control bar — a compact centered pill with the three sheet
 * triggers (Bodies · Tools · Time) as icon buttons. Deliberately minimal so
 * the scene owns the screen; centered + `w-fit` so it never overflows at any
 * phone width.
 */
export function MobileBar({
  onOpenBodies,
  onOpenTools,
  onOpenTime,
}: {
  onOpenBodies: () => void
  onOpenTools: () => void
  onOpenTime: () => void
}) {
  return (
    <div
      className="absolute inset-x-0 bottom-0 z-30 md:hidden px-3"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto flex w-fit max-w-full items-center justify-center gap-1 overflow-hidden rounded-full border border-border bg-background/80 px-2 py-1 backdrop-blur-md shadow-[0_8px_30px_-8px_rgba(0,0,0,0.6)]">
        <BarButton icon={<Orbit className="h-[18px] w-[18px]" />} label="Bodies" onClick={onOpenBodies} />
        <span aria-hidden className="h-6 w-px bg-border/70" />
        <BarButton icon={<Sparkles className="h-[18px] w-[18px]" />} label="Tools" onClick={onOpenTools} />
        <span aria-hidden className="h-6 w-px bg-border/70" />
        <BarButton icon={<Clock className="h-[18px] w-[18px]" />} label="Time" onClick={onOpenTime} />
      </div>
    </div>
  )
}

/** Icon button with a short label — generous touch target (mobile-first). */
function BarButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex min-h-[44px] w-[52px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-full text-foreground/85 active:scale-95 active:bg-foreground/10 transition-transform"
    >
      <span className="text-accent">{icon}</span>
      <span className="font-mono text-[8px] tracking-widest uppercase text-foreground/60">{label}</span>
    </button>
  )
}
