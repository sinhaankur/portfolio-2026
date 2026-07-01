"use client"

import { useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion"
import { StaticStarfield } from "./universe-engine/static-starfield"
import { UniverseRuntimeFallback } from "./universe-engine/runtime-fallback"

// The R3F universe scene is ~250 KB compressed of Three.js + drei + custom
// shaders. Loading it eagerly blocks the home page's first paint and bloats
// the initial JS payload for visitors who never scroll past the typography.
//
// Split it into a separate chunk that streams in after first paint. While
// it's loading, show the static starfield so the hero still reads as a
// cosmic scene instead of a blank rectangle.
const UniverseEngine = dynamic(
  () => import("./universe-engine").then((m) => ({ default: m.UniverseEngine })),
  {
    ssr: false,
    loading: () => <StaticStarfield />,
  },
)

export function Hero() {
  const containerRef = useRef<HTMLElement>(null)
  const prefersReducedMotion = useReducedMotion()
  const [interactive, setInteractive] = useState(false)
  const [tvBrowserFallback, setTvBrowserFallback] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const infoRef = useRef<HTMLDivElement>(null)

  // Dismiss the "⋯" info popover on outside click / Escape.
  useEffect(() => {
    if (!infoOpen) return
    const onDown = (e: PointerEvent) => {
      if (infoRef.current && !infoRef.current.contains(e.target as Node)) {
        setInfoOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setInfoOpen(false)
    }
    window.addEventListener("pointerdown", onDown)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("pointerdown", onDown)
      window.removeEventListener("keydown", onKey)
    }
  }, [infoOpen])
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  })

  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0])
  const scale = useTransform(scrollYProgress, [0, 0.5], [1, 0.8])

  // Esc exits explore mode
  useEffect(() => {
    if (!interactive) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setInteractive(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [interactive])

  // Gesture affordance — shows once per session the first time the user
  // enters explore mode. Auto-dismisses after 6.5s or on any pointer/wheel
  // interaction (whichever comes first), since once you've moved the
  // camera you don't need the prompt anymore.
  const [gestureHintVisible, setGestureHintVisible] = useState(false)
  useEffect(() => {
    if (!interactive || typeof window === "undefined") return
    if (sessionStorage.getItem("ue-gesture-seen") === "1") return
    setGestureHintVisible(true)
    sessionStorage.setItem("ue-gesture-seen", "1")
    const t = setTimeout(() => setGestureHintVisible(false), 6500)
    return () => clearTimeout(t)
  }, [interactive])
  useEffect(() => {
    if (!gestureHintVisible) return
    const el = containerRef.current
    if (!el) return
    const dismiss = () => setGestureHintVisible(false)
    el.addEventListener("wheel", dismiss, { once: true, passive: true })
    el.addEventListener("pointerdown", dismiss, { once: true })
    return () => {
      el.removeEventListener("wheel", dismiss)
      el.removeEventListener("pointerdown", dismiss)
    }
  }, [gestureHintVisible])

  useEffect(() => {
    if (typeof window === "undefined") return
    const ua = window.navigator.userAgent.toLowerCase()
    const isTvBrowser = /(web0s|webos|smarttv|smart-tv|netcast|tizen|viera|hbbtv|appletv|googletv|roku)/.test(ua)
    setTvBrowserFallback(isTvBrowser)
  }, [])

  return (
    <section
      ref={containerRef}
      aria-labelledby="hero-name"
      // Hero tracks the page theme. In dark mode it reads as the classic
      // planetarium; in light mode the universe engine flips itself into
      // chart mode (ink stars on cream paper, warm-amber sun, hairline orbits)
      // via its internal theme detection.
      className="relative h-screen w-full overflow-hidden bg-background text-foreground"
    >
      {/* Visually-hidden semantic H1 — gives screen readers a clean page title */}
      <h1 id="hero-name" className="sr-only">
        Ankur Sinha — UX designer by craft, exploring AI by building it. Design × Engineering × AI.
      </h1>

      {/* Universe engine — galaxy + solar system + constellations.
          Passive backdrop by default so page scroll works; explore mode flips it interactive. */}
      <div className="absolute inset-0" aria-hidden="true">
        <UniverseRuntimeFallback>
          {tvBrowserFallback ? (
            <StaticStarfield />
          ) : (
            <UniverseEngine interactive={interactive} showMusic={true} minimalControls />
          )}
        </UniverseRuntimeFallback>
      </div>

      {/* Explore-mode toggle. On mobile: an icon-only circle (44×44) so it
          doesn't horizontally overlap the PRINCIPAL DESIGNER headline at the
          same Y. On desktop: a wider pill with the full "Tap to explore"
          label, since there's room. Positioned in the gap between the navbar
          and the hero typography (mobile) or in the top-right cluster (desktop). */}
      {!tvBrowserFallback && (
      <div ref={infoRef} className="absolute top-20 right-4 md:top-28 md:right-12 z-30 pointer-events-auto flex items-center gap-2">
        <button
          type="button"
          onClick={() => setInteractive((v) => !v)}
          data-cursor-hover
          aria-pressed={interactive}
          aria-label={interactive ? "Exit explore mode" : "Tap to explore the universe"}
          title={interactive ? "Exit explore mode" : "Tap to explore the universe"}
          className="
            inline-flex items-center justify-center gap-2
            h-11 w-11 md:h-auto md:w-auto md:px-4 md:py-2.5
            border border-foreground/25 rounded-full
            bg-background/40 backdrop-blur-sm
            font-mono text-[10px] tracking-[0.25em] uppercase
            text-foreground/85 hover:text-foreground hover:border-accent/60
            transition-colors duration-300
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
            focus-visible:ring-offset-2 focus-visible:ring-offset-background
            touch-manipulation
          "
        >
          {interactive ? (
            <>
              <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
                <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
              </span>
              <span className="hidden md:inline">Exploring · Esc to exit</span>
            </>
          ) : (
            <>
              <span aria-hidden="true" className="text-accent text-base md:text-xs leading-none">✺</span>
              <span className="hidden md:inline">Tap to explore</span>
            </>
          )}
        </button>

        {/* "⋯" info button — collapses the scale explainer so it doesn't crowd
            the navbar. Tap to reveal; dismisses on outside-click / Esc. */}
        <button
          type="button"
          onClick={() => setInfoOpen((v) => !v)}
          data-cursor-hover
          aria-expanded={infoOpen}
          aria-label="About this view"
          title="About this view"
          className="
            inline-flex items-center justify-center
            h-11 w-11 md:h-9 md:w-9 shrink-0
            border border-foreground/25 rounded-full
            bg-background/40 backdrop-blur-sm
            text-foreground/75 hover:text-foreground hover:border-accent/60
            transition-colors duration-300
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
            focus-visible:ring-offset-2 focus-visible:ring-offset-background
            touch-manipulation
          "
        >
          <span aria-hidden="true" className="text-base leading-none tracking-widest">⋯</span>
        </button>

        {infoOpen && (
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-label="About this view"
            className="
              absolute top-full right-0 mt-3
              w-[min(20rem,calc(100vw-2rem))]
              rounded-2xl border border-foreground/15 bg-background/80 backdrop-blur-md
              px-4 py-3
              shadow-[0_12px_40px_-16px_rgba(0,0,0,0.7)]
            "
          >
            <p className="font-mono text-[10px] tracking-[0.24em] uppercase text-foreground/65">
              Home Hero · UX Scale
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-foreground/70">
              Distances and body sizes are perceptually compressed here for
              readability, motion, and exploration.
            </p>
          </motion.div>
        )}
      </div>
      )}

      {/* Explore-mode hint — phrasing flips by input modality so the verbs
          match what the user actually does (pinch on touch, scroll on a
          trackpad / mouse wheel). Click-to-focus + Destinations menu give
          users a way to actually fly to bodies. */}
      {interactive && !tvBrowserFallback && (
        <p className="absolute bottom-36 md:bottom-52 lg:bottom-48 left-1/2 -translate-x-1/2 z-20 font-mono text-[10px] tracking-[0.25em] uppercase text-foreground/55 pointer-events-none whitespace-nowrap max-w-[calc(100vw-4rem)] text-center">
          <span className="md:hidden">Tap any body to follow its orbit</span>
          <span className="hidden md:inline">Click any body — planet, moon, comet, spacecraft — to follow its orbit</span>
        </p>
      )}

      {/* First-time gesture affordance — three explicit verbs (drag /
          scroll / click) so a new visitor doesn't have to discover the
          universe is interactive on their own. Shown once per session,
          dismissed automatically on first pointer/wheel interaction. */}
      {interactive && gestureHintVisible && !tvBrowserFallback && (
        <div
          className="absolute bottom-52 md:bottom-36 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
          style={{ animation: "ue-label-in 420ms ease-out both" }}
        >
          <div className="flex items-center gap-3 md:gap-4 px-4 py-2 rounded-full border border-foreground/25 bg-background/65 backdrop-blur-sm">
            <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.22em] uppercase text-foreground/80">
              <span aria-hidden="true" className="text-accent text-[12px] leading-none">↻</span>
              Drag
            </span>
            <span aria-hidden="true" className="text-foreground/30">·</span>
            <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.22em] uppercase text-foreground/80">
              <span aria-hidden="true" className="text-accent text-[12px] leading-none">⇅</span>
              Scroll
            </span>
            <span aria-hidden="true" className="text-foreground/30">·</span>
            <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.22em] uppercase text-foreground/80">
              <span aria-hidden="true" className="text-accent text-[12px] leading-none">✺</span>
              Click
            </span>
          </div>
        </div>
      )}

      {/* Typography Overlay — pointer-events disabled on the wrapper so drag passes through to the canvas.
          Mobile uses pt-24 to fully clear the fixed navbar (~44 px tall + breathing room) and pb-44 so
          HUMAN–AI sits above the HUD chip + Upcoming badge cluster. Without these, "01 — DISCIPLINE"
          collides with "ANKUR SINHA" in the navbar at the same Y. */}
      <motion.div
        style={prefersReducedMotion ? undefined : { opacity, scale }}
        className="relative z-10 h-full flex flex-col justify-between px-6 pt-24 pb-44 md:p-12 md:px-12 md:py-20 pointer-events-none"
      >
        {/* Top Left */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <p className="font-mono text-xs tracking-[0.3em] text-muted-foreground mb-2">
            ANKUR SINHA
          </p>
          <p
            aria-hidden="true"
            className="font-display text-4xl md:text-6xl lg:text-7xl font-light tracking-[-0.02em] leading-[1.02] text-balance"
          >
            DESIGN × ENGINEERING
            <br />
            <span className="italic">× AI</span>
          </p>
          <p className="mt-4 max-w-md font-sans text-sm md:text-base leading-relaxed text-foreground/80">
            <span className="text-foreground">Principal UX Designer at Oracle,</span>{" "}
            working at the human–AI seam. 12+ years designing enterprise
            products — and I build my own working prototypes, not just Figma.
          </p>
          <p className="mt-1.5 font-mono text-[11px] tracking-[0.15em] uppercase text-muted-foreground">
            Toronto, ON
          </p>
        </motion.div>

        {/* CTA — anchored bottom-left, out of the way of the central sun */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="absolute bottom-12 left-8 md:bottom-20 md:left-12 z-20 pointer-events-auto flex flex-wrap items-center gap-3"
        >
          {/* Primary — high-contrast, obvious. The one thing to do next. */}
          <motion.a
            href="#works"
            data-cursor-hover
            whileHover={prefersReducedMotion ? undefined : { x: 4 }}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="
              group relative inline-flex items-center gap-3
              px-7 py-3.5 rounded-full
              font-mono text-xs tracking-[0.25em] uppercase
              bg-foreground text-background border border-foreground
              hover:bg-foreground/90
              transition-colors duration-300
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
              focus-visible:ring-offset-2 focus-visible:ring-offset-background
              min-h-11
            "
          >
            View my work
            <span
              aria-hidden="true"
              className="transition-transform duration-300 group-hover:translate-x-1"
            >
              →
            </span>
          </motion.a>

          {/* Secondary — résumé, the thing recruiters reach for. */}
          <motion.a
            href="/ankur-sinha-resume.pdf"
            target="_blank"
            rel="noopener noreferrer"
            data-cursor-hover
            whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
            className="
              inline-flex items-center gap-2
              px-6 py-3.5 rounded-full
              font-mono text-xs tracking-[0.25em] uppercase
              border border-foreground/30 bg-background/40 backdrop-blur-sm
              text-foreground
              hover:border-foreground/70
              transition-colors duration-300
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
              focus-visible:ring-offset-2 focus-visible:ring-offset-background
              min-h-11
            "
          >
            Résumé
          </motion.a>
        </motion.div>

        {/* Bottom Right */}
        <motion.div
          initial={{ opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="self-end text-right max-w-[20rem] md:max-w-[24rem]"
        >
          <p className="font-mono text-xs tracking-[0.3em] text-muted-foreground mb-2">
            02 — DOMAIN
          </p>
          <p
            aria-hidden="true"
            className="font-display text-2xl md:text-4xl font-light tracking-[-0.02em] leading-[1.05] text-balance text-foreground/85"
          >
            Human–AI
            <br />
            <span className="italic">interaction</span>
          </p>
        </motion.div>
      </motion.div>

      {/* Scroll Indicator — hidden on mobile because the Enter Work CTA covers
          the same affordance and the bottom band is crowded enough on phones. */}
      {!interactive && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="hidden md:block absolute bottom-8 left-1/2 -translate-x-1/2 z-10"
        aria-hidden="true"
      >
        <motion.div
          animate={
            prefersReducedMotion
              ? undefined
              : { y: [0, 8, 0] }
          }
          transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
          className="flex flex-col items-center gap-2"
        >
          <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Scroll
          </span>
          <div className="w-px h-8 bg-linear-to-b from-foreground/50 to-transparent" />
        </motion.div>
      </motion.div>
      )}
    </section>
  )
}
