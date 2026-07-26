"use client"

import { useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { motion, useScroll, useTransform, useMotionValueEvent, useReducedMotion } from "framer-motion"
import { StaticStarfield } from "./universe-engine/static-starfield"
import { UniverseRuntimeFallback } from "./universe-engine/runtime-fallback"

// The R3F universe scene is ~250 KB compressed of Three.js + drei + custom
// shaders. Loading it eagerly blocks the home page's first paint and bloats
// the initial JS payload for visitors who never scroll past the typography.
//
// Split it into a separate chunk that streams in after first paint. The
// living CSS starfield renders UNDERNEATH the engine layer the whole time
// (see the crossfade in Hero below), so there's no loading-component swap —
// the engine blooms in over the starfield on its `universe-ready` event.
const UniverseEngine = dynamic(
  () => import("./universe-engine").then((m) => ({ default: m.UniverseEngine })),
  { ssr: false },
)

export function Hero() {
  const containerRef = useRef<HTMLElement>(null)
  const prefersReducedMotion = useReducedMotion()
  const [interactive, setInteractive] = useState(false)
  const [tvBrowserFallback, setTvBrowserFallback] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const infoRef = useRef<HTMLDivElement>(null)

  // ── Lazy-load choreography ────────────────────────────────────────────────
  // `engineWanted` gates the dynamic import. Normally true right after mount,
  // but when the visitor's browser signals Data Saver we hold on the living
  // CSS starfield and let them opt in — the engine chunk + textures are real
  // megabytes on a metered connection.
  // `engineReady` flips on the engine's `universe-ready` event (its first real
  // frames), driving a crossfade: the engine layer blooms in over the
  // starfield instead of a component-swap snap.
  const [engineWanted, setEngineWanted] = useState(false)
  const [dataSaver, setDataSaver] = useState(false)
  const [engineReady, setEngineReady] = useState(false)
  // If iOS Safari drops the WebGL context, fall back to the static starfield
  // rather than a dead black canvas.
  const [contextLost, setContextLost] = useState(false)
  // Cinematic chrome: once the journey is underway the hero text/CTAs fade so
  // the universe fills the screen; any interaction (scroll, pointer, tap, or
  // entering explore) brings them right back. `chromeDimmed` drives the fade.
  const [chromeDimmed, setChromeDimmed] = useState(false)

  useEffect(() => {
    const conn = (navigator as { connection?: { saveData?: boolean } }).connection
    if (conn?.saveData === true) setDataSaver(true)
    else setEngineWanted(true)
  }, [])

  useEffect(() => {
    const onReady = () => setEngineReady(true)
    const onLost = () => setContextLost(true)
    window.addEventListener("universe-ready", onReady)
    window.addEventListener("universe-context-lost", onLost)
    return () => {
      window.removeEventListener("universe-ready", onReady)
      window.removeEventListener("universe-context-lost", onLost)
    }
  }, [])

  // Cinematic chrome fade. Once the engine is ready and we're not in explore
  // mode, let the hero text sit for a beat, then dim it so the journey fills
  // the screen. ANY interaction wakes it and resets the idle timer, so it never
  // hides while the visitor is engaged. Disabled for reduced-motion + on the
  // very first view where the intro already held the screen.
  useEffect(() => {
    if (prefersReducedMotion || interactive || !engineReady) {
      setChromeDimmed(false)
      return
    }
    let idle: ReturnType<typeof setTimeout>
    const DIM_AFTER = 4200 // let the name/headline read first
    const arm = () => {
      clearTimeout(idle)
      setChromeDimmed(false)
      idle = setTimeout(() => setChromeDimmed(true), DIM_AFTER)
    }
    arm()
    const wake = () => arm()
    window.addEventListener("pointermove", wake, { passive: true })
    window.addEventListener("pointerdown", wake, { passive: true })
    window.addEventListener("scroll", wake, { passive: true })
    window.addEventListener("keydown", wake)
    return () => {
      clearTimeout(idle)
      window.removeEventListener("pointermove", wake)
      window.removeEventListener("pointerdown", wake)
      window.removeEventListener("scroll", wake)
      window.removeEventListener("keydown", wake)
    }
  }, [prefersReducedMotion, interactive, engineReady])

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

  // Scroll → camera dolly. A ref (not state) so the engine reads it per-frame
  // with zero React churn; the engine ignores it in explore mode.
  const scrollDriveRef = useRef(0)
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    scrollDriveRef.current = prefersReducedMotion ? 0 : v
  })

  // ── Cinematic descent ─────────────────────────────────────────────────────
  // The galaxy is a FIXED backdrop that persists behind the hero AND the
  // scroll-cinema act break, then dissolves to `background` as the readable
  // sections arrive — so the whole opening scrolls as one continuous descent
  // through space, not a hero that snaps off into flat sections. Driven by raw
  // window scroll (in viewport units) because it must outlive the hero's own
  // one-viewport scroll range. Full sky for the first ~1.7 screens (hero + the
  // first principle lines), then fade out by ~3.0 screens, before <About>.
  const [skyOpacity, setSkyOpacity] = useState(1)
  useEffect(() => {
    if (prefersReducedMotion) return
    let raf = 0
    const compute = () => {
      raf = 0
      const vh = window.innerHeight || 1
      const screens = window.scrollY / vh
      // hold 1 until 1.7 screens, ramp to 0 by 3.0 screens
      const t = (screens - 1.7) / (3.0 - 1.7)
      setSkyOpacity(Math.max(0, Math.min(1, 1 - t)))
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(compute)
    }
    compute()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll, { passive: true })
    return () => {
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
    }
  }, [prefersReducedMotion])
  // In explore mode the sky must be fully present regardless of scroll.
  const effectiveSkyOpacity = interactive ? 1 : skyOpacity

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
      // No overflow-hidden + no z-index: the section must NOT create a stacking
      // context, so the fixed galaxy backdrop (z-0) participates in the root
      // stack and can persist visually behind the sections that follow. bg is
      // transparent so the fixed sky shows through the hero; the body's
      // bg-background is what the sky dissolves into.
      className="relative h-screen w-full text-foreground"
    >
      {/* Visually-hidden semantic H1 — gives screen readers a clean page title */}
      <h1 id="hero-name" className="sr-only">
        Ankur Sinha — UX designer by craft, exploring AI by building it. Design × Engineering × AI.
      </h1>

      {/* Universe engine — galaxy + solar system + constellations.
          Passive backdrop by default so page scroll works; explore mode flips it interactive.
          Layering: the living CSS starfield sits underneath the whole time; the
          engine layer fades + settles in over it once `universe-ready` fires,
          so the handoff is a bloom, not a swap.

          FIXED backdrop (not absolute): the galaxy stays pinned to the viewport
          so it persists behind the scroll-cinema act break — the opening reads
          as one continuous descent through space. `effectiveSkyOpacity` (scroll-
          driven) dissolves it to `background` before the readable sections, so
          text never fights the stars. z-0 keeps it below the hero's z-10 chrome;
          the chrome wrapper is pointer-events-none so drags still reach the
          canvas (explore mode). */}
      <div
        className="fixed inset-0 z-0 transition-opacity duration-500 ease-out"
        aria-hidden="true"
        style={{ opacity: effectiveSkyOpacity }}
      >
        <UniverseRuntimeFallback>
          {tvBrowserFallback || contextLost ? (
            <StaticStarfield />
          ) : (
            <>
              <div
                className="absolute inset-0 transition-opacity duration-1000 ease-out"
                style={{ opacity: engineReady ? 0 : 1 }}
              >
                <StaticStarfield loading={engineWanted && !engineReady} />
              </div>
              {engineWanted && (
                <div
                  className="absolute inset-0 will-change-[opacity,transform]"
                  style={{
                    opacity: engineReady ? 1 : 0,
                    transform:
                      prefersReducedMotion || engineReady ? "scale(1)" : "scale(1.02)",
                    transition: prefersReducedMotion
                      ? "opacity 400ms ease-out"
                      : "opacity 1100ms cubic-bezier(0.16, 1, 0.3, 1), transform 1400ms cubic-bezier(0.16, 1, 0.3, 1)",
                  }}
                >
                  {/* quietMobileChrome: on phones the engine's always-on bottom
                      chrome (LearnTicker, explore-mode timeline bar) lands in the
                      same band as the hero's own typography + CTAs — the ticker
                      sat directly on the "02 — DOMAIN" block. Same scene-first
                      trade as /lab/celestial; desktop keeps everything. */}
                  <UniverseEngine interactive={interactive} scrollDriveRef={scrollDriveRef} showMusic={true} minimalControls quietMobileChrome realtime />
                </div>
              )}
            </>
          )}
        </UniverseRuntimeFallback>
      </div>

      {/* Data Saver opt-in — shown instead of auto-loading the engine when the
          browser signals a metered connection. One tap streams the universe in. */}
      {dataSaver && !engineWanted && !tvBrowserFallback && (
        <button
          type="button"
          onClick={() => setEngineWanted(true)}
          data-cursor-hover
          className="
            absolute bottom-24 left-1/2 -translate-x-1/2 z-20
            inline-flex items-center gap-2 px-5 py-2.5 rounded-full
            border border-foreground/25 bg-background/50 backdrop-blur-sm
            font-mono text-[10px] tracking-[0.25em] uppercase
            text-foreground/85 hover:text-foreground hover:border-accent/60
            transition-colors duration-300
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
            focus-visible:ring-offset-2 focus-visible:ring-offset-background
            min-h-11 touch-manipulation
          "
        >
          <span aria-hidden="true" className="text-accent text-base leading-none">✺</span>
          Load the live universe
        </button>
      )}

      {/* Explore-mode toggle. On mobile: an icon-only circle (44×44) so it
          doesn't horizontally overlap the PRINCIPAL DESIGNER headline at the
          same Y. On desktop: a wider pill with the full "Tap to explore"
          label, since there's room. Positioned in the gap between the navbar
          and the hero typography (mobile) or in the top-right cluster (desktop). */}
      {!tvBrowserFallback && (
      <div ref={infoRef} className="absolute top-20 right-4 md:top-28 md:right-12 z-30 pointer-events-auto flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            // Data-saver visitors may tap Explore before opting into the
            // engine — treat that as the opt-in too.
            setEngineWanted(true)
            setInteractive((v) => !v)
          }}
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

      {/* Auto-tour hint — while the cinematic default is flying itself (engine
          ready, not yet in explore mode), tell visitors it's live AND that they
          can take over. Mobile-first: it's a real BUTTON (44px min touch target,
          tap = enter explore) centred low so it never collides with the hero
          typography or the bottom nav; verbs flip by modality (Tap vs Click). */}
      {engineReady && !interactive && !tvBrowserFallback && (
        <button
          type="button"
          onClick={() => {
            setEngineWanted(true)
            setInteractive(true)
          }}
          data-cursor-hover
          aria-label="Auto-touring the universe — tap to take control and explore"
          className="
            group absolute bottom-40 md:bottom-44 left-1/2 -translate-x-1/2 z-20
            inline-flex items-center gap-2 px-4 py-2.5 rounded-full
            border border-foreground/20 bg-background/55 backdrop-blur-sm
            font-mono text-[10px] tracking-[0.22em] uppercase
            text-foreground/70 hover:text-foreground hover:border-accent/50
            transition-colors duration-300 min-h-11 touch-manipulation
            max-w-[calc(100vw-2rem)]
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
            focus-visible:ring-offset-2 focus-visible:ring-offset-background
            motion-safe:animate-[ue-label-in_600ms_ease-out_both]
          "
        >
          <span
            aria-hidden="true"
            className="text-accent text-[13px] leading-none motion-safe:animate-spin"
            style={{ animationDuration: "6s" }}
          >
            ◐
          </span>
          <span className="whitespace-nowrap">
            <span className="text-foreground/55">Auto-touring · </span>
            <span className="md:hidden">tap to explore</span>
            <span className="hidden md:inline">tap to take control</span>
          </span>
        </button>
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
        // Cinematic fade: when the journey is breathing (chromeDimmed), drop the
        // hero chrome to a whisper so the universe fills the screen; interaction
        // brings it back. The scroll-driven `opacity` above still applies on top.
        animate={{ opacity: chromeDimmed ? 0.12 : 1 }}
        transition={{ duration: chromeDimmed ? 1.6 : 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 h-full flex flex-col justify-between px-6 pt-24 pb-44 md:p-12 md:px-12 md:py-20 pointer-events-none"
      >
        {/* Top Left */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="relative"
        >
          {/* Mobile-only legibility scrim: the hero copy sits over the densest
              part of the galaxy on a phone, so a soft gradient behind the text
              keeps it readable without hiding the scene. Desktop has room, so
              no scrim there. */}
          <div
            aria-hidden
            className="md:hidden pointer-events-none absolute -inset-x-6 -inset-y-4 z-[-1]"
            style={{ background: "radial-gradient(120% 90% at 20% 40%, var(--background) 30%, color-mix(in oklch, var(--background) 55%, transparent) 60%, transparent 100%)" }}
          />
          <p className="font-mono text-xs tracking-[0.3em] text-foreground/75 mb-2 [text-shadow:0_1px_8px_var(--background)]">
            ANKUR SINHA
          </p>
          {/* Mobile: three stacked lines at a size that fits ~360px, so
              "ENGINEERING" never runs off-screen. */}
          <p
            aria-hidden="true"
            className="md:hidden font-display text-[2rem] leading-[1.06] font-light tracking-[-0.01em] [text-shadow:0_2px_16px_var(--background)]"
          >
            DESIGN ×<br />ENGINEERING<br /><span className="italic">× AI</span>
          </p>
          {/* md+: the original two-line composition. */}
          <p
            aria-hidden="true"
            className="hidden md:block font-display md:text-6xl lg:text-7xl font-light tracking-[-0.02em] leading-[1.02] text-balance [text-shadow:0_2px_20px_var(--background)]"
          >
            DESIGN × ENGINEERING
            <br />
            <span className="italic">× AI</span>
          </p>
          <p className="mt-4 max-w-md font-sans text-sm md:text-base leading-relaxed text-foreground/90 [text-shadow:0_1px_10px_var(--background)]">
            <span className="text-foreground font-medium">Principal UX Designer at Oracle,</span>{" "}
            working at the human–AI seam. 12+ years designing enterprise
            products — and I build my own working prototypes, not just Figma.
          </p>
          <p className="mt-1.5 font-mono text-[11px] tracking-[0.15em] uppercase text-foreground/70 [text-shadow:0_1px_8px_var(--background)]">
            Toronto, ON
          </p>
        </motion.div>

        {/* CTA — anchored bottom-left, out of the way of the central sun.
            Stacked vertically on phones: side-by-side the Résumé pill reaches
            under the fixed UPCOMING badge (bottom-6 right-6) and the engine's
            music chip (bottom-20 right-6) — the column keeps both CTAs in the
            left lane so the right-edge chrome never overlaps a tap target. */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="absolute bottom-12 left-8 md:bottom-20 md:left-12 z-20 pointer-events-auto flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center"
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
