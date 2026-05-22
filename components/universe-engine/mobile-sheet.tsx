"use client"

/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine — see ./index.tsx for the full notice.
 * https://github.com/sinhaankur/Portfolio/blob/main/LICENSE
 *
 * Mobile body sheet.
 *
 * Replaces the corner InfoPanel on touch devices. When a body is tapped,
 * this sheet slides up from the bottom carrying the same data the desktop
 * cursor-label + corner panel would show. Drag-down or hit the close button
 * to dismiss. Tap-through the empty area still lets the user interact with
 * the universe behind.
 *
 * Why this exists: on mobile the custom reticle cursor isn't rendered
 * (`pointer: coarse`), so tap-to-select had no acknowledgement at all.
 */

import { motion, AnimatePresence, type PanInfo } from "framer-motion"
import type { BodyInfo } from "./types"
import { DeepFactsDisclosure } from "./hud"

export function MobileBodySheet({
  body,
  onDismiss,
  onAction,
}: {
  body: BodyInfo | null
  onDismiss: () => void
  /** Called when the user taps the clickable-body action (e.g. reset view). */
  onAction?: () => void
}) {
  const handleDragEnd = (
    _: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    // Dismiss if the user dragged > 80px down or flicked downward.
    if (info.offset.y > 80 || info.velocity.y > 500) {
      onDismiss()
    }
  }

  return (
    <AnimatePresence>
      {body && (
        // Stable key so swapping bodies updates content in-place. Slide-in/out
        // only fires when the sheet first appears or finally dismisses.
        <motion.div
          key="universe-mobile-sheet"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 320, damping: 32, mass: 0.7 }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.6 }}
          onDragEnd={handleDragEnd}
          role="dialog"
          aria-label={`${body.name} details`}
          className="
            fixed bottom-0 inset-x-0 z-40
            rounded-t-2xl border-t border-border bg-background/95 backdrop-blur-md
            shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.6)]
            touch-pan-y
          "
          style={{
            // Respect iOS home-indicator safe area.
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.25rem)",
          }}
        >
          {/* Drag handle — also a tap target for accessibility */}
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close details"
            className="
              w-full flex justify-center pt-3 pb-2
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
              focus-visible:ring-offset-2 focus-visible:ring-offset-background
              rounded-t-2xl
            "
          >
            <span
              aria-hidden="true"
              className="w-10 h-1 rounded-full bg-foreground/30"
            />
          </button>

          <div className="px-6 pb-4">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="min-w-0">
                <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-foreground/55">
                  {body.classification}
                </p>
                <h2 className="font-display text-2xl font-light tracking-[-0.01em] text-foreground mt-1">
                  {body.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={onDismiss}
                aria-label="Close"
                className="
                  shrink-0 w-9 h-9 inline-flex items-center justify-center
                  rounded-full border border-border text-foreground/80
                  hover:border-accent/60 hover:text-foreground
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                  transition-colors
                "
              >
                ×
              </button>
            </div>

            <BodyStats body={body} />

            {body.clickable && onAction && (
              <button
                type="button"
                onClick={() => {
                  onAction()
                  onDismiss()
                }}
                aria-label="Reset camera view"
                className="
                  mt-5 w-full inline-flex items-center justify-center gap-2 px-4 py-3
                  rounded-full border border-accent text-accent
                  hover:bg-accent hover:text-accent-foreground transition-colors
                  font-mono text-xs tracking-[0.25em] uppercase
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                  focus-visible:ring-offset-2 focus-visible:ring-offset-background
                "
              >
                ↺ Reset view
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function BodyStats({ body }: { body: BodyInfo }) {
  const k = body.surfaceTempK
  const c = body.surfaceTempC
  return (
    <dl className="space-y-2 font-mono text-xs text-foreground/85">
      {k && (
        <Row label="Surface temp">
          {k.min !== undefined && k.max !== undefined
            ? `${k.min}–${k.max} K`
            : `${k.mean} K`}
          {c && <span className="text-foreground/55"> ({c.mean}°C avg)</span>}
        </Row>
      )}
      {body.aAU !== undefined && (
        <Row label="Orbit">
          {body.aAU.toFixed(2)} AU · {Math.round(body.periodDays ?? 0).toLocaleString()} days
        </Row>
      )}
      {body.rotHours !== undefined && (
        <Row label="Day">
          {Math.abs(body.rotHours) < 100
            ? `${Math.abs(body.rotHours).toFixed(1)} h${body.rotHours < 0 ? " (retrograde)" : ""}`
            : `${(Math.abs(body.rotHours) / 24).toFixed(0)} days${body.rotHours < 0 ? " (retrograde)" : ""}`}
        </Row>
      )}
      {body.tiltDeg !== undefined && (
        <Row label="Axial tilt">{body.tiltDeg.toFixed(1)}°</Row>
      )}
      {body.radiusEarth !== undefined && (
        <Row label="Radius">{body.radiusEarth.toFixed(2)} × Earth</Row>
      )}
      {body.moons !== undefined && body.moons > 0 && (
        <Row label="Moons">{body.moons}</Row>
      )}
      {body.fact && (
        <div className="mt-4 pt-3 border-t border-border font-sans text-sm text-foreground/85 leading-relaxed">
          {body.fact}
        </div>
      )}
      {/* Deeper NASA Planetary Fact Sheet data — collapsed by default so the
          sheet stays scannable; tap to expand. Keyed on name to reset when
          the user opens a different body. */}
      <DeepFactsDisclosure key={body.name} deep={body.deep} variant="sheet" />
    </dl>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="text-foreground/55 shrink-0">{label} ·</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  )
}
