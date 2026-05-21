"use client"

import { useEffect, useState } from "react"
import { motion, useMotionValue, useSpring, AnimatePresence } from "framer-motion"
import { useTheme } from "next-themes"
import type { BodyInfo } from "./universe-engine/types"
import { useDisplayPrefs } from "./display-prefs"

/**
 * Custom cursor.
 *
 * Three states:
 *   idle    — small astronomical reticle (centre dot + four hairlines)
 *   link    — solid filled disc (over <a> / <button> / [data-cursor-hover])
 *   body    — target ring + warm dot + floating body name
 *             (driven by the `universe:hover` event from <UniverseEngine />)
 *
 * Drops mix-blend-difference — over bright pixels like the Sun, difference
 * blending muddies the cursor to grey. We use solid colour + a small
 * drop-shadow so contrast holds against both deep-space and stellar surfaces.
 */

type CursorState = "idle" | "link" | "body"

type UniverseHoverDetail = {
  body: BodyInfo | null
  clickable?: boolean
}

export function CustomCursor() {
  const [supportsCustom, setSupportsCustom] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [isHoveringLink, setIsHoveringLink] = useState(false)
  const [universeBody, setUniverseBody] = useState<BodyInfo | null>(null)
  const [universeClickable, setUniverseClickable] = useState(false)
  const [themeMounted, setThemeMounted] = useState(false)
  const { systemCursor, reduceMotion } = useDisplayPrefs()
  const { resolvedTheme } = useTheme()

  // next-themes returns undefined on first render — gate the cursor-colour
  // theme branch on a mounted flag so SSR matches CSR.
  useEffect(() => {
    setThemeMounted(true)
  }, [])

  // User pref wins over capability: opt-in `systemCursor` or `reduceMotion`
  // disables the reticle even on capable devices.
  const enabled = supportsCustom && !systemCursor && !reduceMotion

  const x = useMotionValue(0)
  const y = useMotionValue(0)
  // Spring smooths the cursor follow — slightly looser than a stiff snap so
  // movement reads as a guided reticle, not a glued pointer.
  const springX = useSpring(x, { stiffness: 500, damping: 32, mass: 0.4 })
  const springY = useSpring(y, { stiffness: 500, damping: 32, mass: 0.4 })

  useEffect(() => {
    if (typeof window === "undefined") return
    const finePointer = window.matchMedia("(pointer: fine)")
    const osReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => {
      setSupportsCustom(finePointer.matches && !osReducedMotion.matches)
    }
    update()
    finePointer.addEventListener("change", update)
    osReducedMotion.addEventListener("change", update)
    return () => {
      finePointer.removeEventListener("change", update)
      osReducedMotion.removeEventListener("change", update)
    }
  }, [])

  // Hide the native system cursor while the custom reticle is on duty —
  // without this they double-up and the system cursor competes for attention
  // (especially noticeable over the Sun, where mix-blend-difference muddied
  // the old white dot).
  useEffect(() => {
    if (!enabled) return
    const prev = document.documentElement.style.cursor
    document.documentElement.style.cursor = "none"
    return () => {
      document.documentElement.style.cursor = prev
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return

    const handleMove = (e: MouseEvent) => {
      x.set(e.clientX)
      y.set(e.clientY)
      setIsVisible(true)
    }
    const handleEnter = () => setIsVisible(true)
    const handleLeave = () => setIsVisible(false)
    const handleHoverStart = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest?.("a, button, [data-cursor-hover]")) {
        setIsHoveringLink(true)
      }
    }
    const handleHoverEnd = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest?.("a, button, [data-cursor-hover]")) {
        setIsHoveringLink(false)
      }
    }
    const handleUniverseHover = (e: Event) => {
      const detail = (e as CustomEvent<UniverseHoverDetail>).detail
      setUniverseBody(detail?.body ?? null)
      setUniverseClickable(Boolean(detail?.clickable))
    }

    window.addEventListener("mousemove", handleMove)
    document.addEventListener("mouseenter", handleEnter)
    document.addEventListener("mouseleave", handleLeave)
    document.addEventListener("mouseover", handleHoverStart)
    document.addEventListener("mouseout", handleHoverEnd)
    window.addEventListener("universe:hover", handleUniverseHover)

    return () => {
      window.removeEventListener("mousemove", handleMove)
      document.removeEventListener("mouseenter", handleEnter)
      document.removeEventListener("mouseleave", handleLeave)
      document.removeEventListener("mouseover", handleHoverStart)
      document.removeEventListener("mouseout", handleHoverEnd)
      window.removeEventListener("universe:hover", handleUniverseHover)
    }
  }, [enabled, x, y])

  if (!enabled) return null

  const state: CursorState = universeBody ? "body" : isHoveringLink ? "link" : "idle"
  const ringSize = state === "body" ? 44 : state === "link" ? 36 : 18
  const ringOpacity = state === "body" ? 0.95 : state === "link" ? 1 : 0.75
  // Light theme flips the reticle to ink-on-paper and the body-state highlight
  // to a deep warm amber (matching the chart-mode constellation accent), so
  // the cursor reads correctly against a cream page.
  const isLight = themeMounted && resolvedTheme === "light"
  const inkColor = isLight ? "#0a0a0a" : "#ffffff"
  const accentColor = isLight ? "#b34a13" : "#ffd66b"
  const ringColor = state === "body" ? accentColor : inkColor
  // Drop-shadow tint matches the surrounding page so the reticle gets a soft
  // outline rather than the chromatic bleed of mix-blend-difference.
  const dropShadowColor = isLight ? "rgba(245,245,240,0.85)" : "rgba(0,0,0,0.45)"

  // Hairlines are visible in idle + body states (astronomical reticle).
  // In body state they extend further to form a clear target sight.
  const hairlineLength = state === "body" ? 14 : 6
  const hairlineGap = state === "body" ? 26 : 11

  return (
    <motion.div
      aria-hidden="true"
      className="fixed top-0 left-0 pointer-events-none z-10000"
      style={{
        x: springX,
        y: springY,
        // Drop shadow flips to a soft paper-coloured glow on light theme so
        // the ink reticle gets a halo against bright photographic pixels
        // (the Sun, planet highlights) without going muddy.
        filter: `drop-shadow(0 0 4px ${dropShadowColor})`,
      }}
      animate={{ opacity: isVisible ? 1 : 0 }}
      transition={{ opacity: { duration: 0.15 } }}
    >
      {/* Outer ring — target sight in body state, filled disc in link state, small reticle ring in idle */}
      <motion.div
        className="absolute top-0 left-0 rounded-full"
        style={{ translateX: "-50%", translateY: "-50%" }}
        animate={{
          width: ringSize,
          height: ringSize,
          borderWidth: state === "link" ? 0 : 1.5,
          borderColor: ringColor,
          backgroundColor: state === "link" ? inkColor : "transparent",
          opacity: ringOpacity,
        }}
        transition={{ type: "spring", stiffness: 450, damping: 28, mass: 0.5 }}
      />

      {/* Centre dot — accent over universe bodies, ink otherwise. Hidden when link. */}
      <motion.div
        className="absolute top-0 left-0 rounded-full"
        style={{ translateX: "-50%", translateY: "-50%" }}
        animate={{
          width: state === "body" ? 5 : state === "link" ? 0 : 2.5,
          height: state === "body" ? 5 : state === "link" ? 0 : 2.5,
          backgroundColor: state === "body" ? accentColor : inkColor,
        }}
        transition={{ type: "spring", stiffness: 450, damping: 28, mass: 0.5 }}
      />

      {/* Crosshair hairlines — vertical + horizontal, with a centre gap. Hidden when link. */}
      {state !== "link" && (
        <>
          <motion.span
            className="absolute top-0 left-0"
            style={{ translateX: "-50%", width: 1, backgroundColor: inkColor }}
            animate={{
              height: hairlineLength,
              top: -hairlineGap,
              opacity: state === "body" ? 0.85 : 0.55,
            }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
          />
          <motion.span
            className="absolute top-0 left-0"
            style={{ translateX: "-50%", width: 1, backgroundColor: inkColor }}
            animate={{
              height: hairlineLength,
              top: hairlineGap - hairlineLength,
              opacity: state === "body" ? 0.85 : 0.55,
            }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
          />
          <motion.span
            className="absolute top-0 left-0"
            style={{ translateY: "-50%", height: 1, backgroundColor: inkColor }}
            animate={{
              width: hairlineLength,
              left: -hairlineGap,
              opacity: state === "body" ? 0.85 : 0.55,
            }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
          />
          <motion.span
            className="absolute top-0 left-0"
            style={{ translateY: "-50%", height: 1, backgroundColor: inkColor }}
            animate={{
              width: hairlineLength,
              left: hairlineGap - hairlineLength,
              opacity: state === "body" ? 0.85 : 0.55,
            }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
          />
        </>
      )}

      {/* Floating body-name label when hovering a universe body */}
      <AnimatePresence>
        {state === "body" && universeBody && (
          <motion.div
            key="label"
            className="absolute top-0 left-0 font-mono text-[10px] tracking-[0.22em] uppercase whitespace-nowrap"
            style={{ translateX: 28, translateY: -8 }}
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 28 }}
            exit={{ opacity: 0, x: 18 }}
            transition={{ duration: 0.18 }}
          >
            <span className="rounded-full bg-background/70 backdrop-blur-sm border border-foreground/15 px-2.5 py-1 text-foreground/95">
              <span className="text-accent">✺</span> {universeBody.name}
              {universeClickable && (
                <span className="ml-2 text-foreground/55">· click</span>
              )}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
