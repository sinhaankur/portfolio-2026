"use client"

/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 *
 * The Universe Engine — its scene composition, custom GLSL shaders,
 * constellation catalog, planet table, scale model, and HUD chrome — is
 * the original work of Ankur Sinha and is published under the terms of
 * the LICENSE file at the repository root. It is NOT open source and
 * may not be redistributed, repurposed, or used as the basis for another
 * portfolio, template, or product without prior written permission.
 *
 * https://github.com/sinhaankur/Portfolio/blob/main/LICENSE
 *
 * ---
 * Universe Engine — public entry.
 *
 * Mounts the R3F <Canvas>, wires OrbitControls + viewport/motion detection,
 * manages hover state, and lays out the HUD chrome (info panel, time-warp
 * slider, music chip, reset button). Consumers only need <UniverseEngine />.
 *
 * Module layout:
 *   types.ts       Shared types (BodyInfo, Constellation, Planet, etc.)
 *   astronomy.ts   Real-world data + scale + helpers (no React, no R3F)
 *   shaders.ts     GLSL for the spiral-arm point field
 *   scene.tsx      All R3F components, composed via <SceneContents />
 *   hud.tsx        DOM overlays (InfoPanel, TimelineControl, ResetViewButton)
 *   index.tsx      <UniverseEngine /> + public re-exports (this file)
 *
 * Limitations:
 *   - Only one engine instance per page (shared timeWarpRef singleton).
 *   - GalaxyMusic is opt-in but the iframe loads on mount.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { Canvas } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import { TOUCH } from "three"
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib"
import { useTheme } from "next-themes"
import { motion } from "framer-motion"

import {
  DEFAULT_JOURNEY,
  SOLAR_SYSTEM_POSITION,
  SUN_OFFSET_SCENE,
  cancelFlyTo,
  cancelFollow,
  flyToRef,
  followRef,
  requestFlyTo,
  cloudsVisibleRef,
  satellitesVisibleRef,
  scaleModeRef,
  timeScaleRef,
} from "./astronomy"
import { SceneContents } from "./scene"
import { CloudToggle, DeepDiveToggle, DestinationsMenu, GravityToggle, InfoPanel, ResetViewButton, SatelliteToggle, ScaleToggle, TimelineControl } from "./hud"
import { MobileBodySheet } from "./mobile-sheet"
import { StaticStarfield } from "./static-starfield"
import { GalaxyMusic } from "../galaxy-music"
import type { BodyInfo, HoverHandler } from "./types"

export type UniverseEngineProps = {
  /** Enable drag-to-rotate + scroll-to-zoom. Defaults to false (passive backdrop). */
  interactive?: boolean
  /** Show the bottom-right HUD cluster (music + time-warp). Defaults to true. */
  showHud?: boolean
  /** Show the music opt-in chip in the HUD cluster. Defaults to true. */
  showMusic?: boolean
  /**
   * Force chart-mode rendering (ink stars on cream paper). When omitted,
   * the engine reads the page theme via next-themes and inverts itself in
   * light mode automatically.
   */
  invert?: boolean
  /**
   * Boot in true-scale (real ratio) mode rather than the compressed "explore"
   * layout. Defaults to false. The Scale toggle still flips it at runtime.
   */
  defaultTrueScale?: boolean
  /**
   * Focus purely on our solar system — hide constellations, named stars, the
   * Milky Way, and deep-sky/exoplanet points. Used by /lab/celestial.
   */
  solarOnly?: boolean
}

export function UniverseEngine({
  interactive = false,
  showHud = true,
  showMusic = true,
  invert: invertProp,
  defaultTrueScale = false,
  solarOnly = false,
}: UniverseEngineProps) {
  // Set the module-scoped scale ref synchronously on first render so the very
  // first scene mount already lays bodies out at true ratios (the effect below
  // keeps it in sync afterwards).
  if (typeof window !== "undefined" && defaultTrueScale) {
    scaleModeRef.current = "true"
  }
  // Calm, slow drift for the solar-only explorer; restore on unmount so the
  // home hero keeps its normal pace.
  useEffect(() => {
    if (!solarOnly) return
    timeScaleRef.current = 0.12
    return () => {
      timeScaleRef.current = 1.0
    }
  }, [solarOnly])
  const [mounted, setMounted] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [mobile, setMobile] = useState(false)
  // Gates the render loop: the hero is h-screen, so once the user scrolls past
  // it the Canvas is fully off-screen yet keeps rendering at 60fps. Pausing the
  // frameloop while hidden frees the GPU for the rest of the page.
  const [onScreen, setOnScreen] = useState(true)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [hovered, setHovered] = useState<BodyInfo | null>(null)
  // Sticky selection — mobile devices fire pointerover/pointerout in pairs on
  // each tap, so `hovered` clears immediately. `selectedBody` latches on the
  // most-recent tap and only clears when the user dismisses the bottom sheet.
  const [selectedBody, setSelectedBody] = useState<BodyInfo | null>(null)
  const [showGravityOverlay, setShowGravityOverlay] = useState(false)
  const [showDeepDive, setShowDeepDive] = useState(false)
  // Earth cloud-shell visibility — drives the module-scoped ref the scene reads.
  const [showClouds, setShowClouds] = useState(true)
  useEffect(() => {
    cloudsVisibleRef.current = showClouds
  }, [showClouds])
  // Human-made satellite shells (Earth/Mars orbiters) — drives the module ref.
  const [showSatellites, setShowSatellites] = useState(false)
  useEffect(() => {
    satellitesVisibleRef.current = showSatellites
  }, [showSatellites])
  // Scale mode: "explore" (compressed, default) vs "true" (real ratios). Writes
  // the module ref AND bumps a key so the scene subtree remounts and re-lays
  // every body at the new scale.
  const [trueScale, setTrueScale] = useState(defaultTrueScale)
  useEffect(() => {
    scaleModeRef.current = trueScale ? "true" : "explore"
  }, [trueScale])
  const orbitRef = useRef<OrbitControlsImpl | null>(null)
  const { resolvedTheme } = useTheme()
  // Prop override wins; otherwise the engine flips to chart mode automatically
  // when the page theme is light. Gated on `mounted` to avoid the SSR/CSR
  // mismatch that next-themes deliberately introduces.
  const invert = invertProp ?? (mounted && resolvedTheme === "light")

  useEffect(() => {
    setMounted(true)
    const motionMq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const mobileMq = window.matchMedia("(max-width: 768px)")
    setReducedMotion(motionMq.matches)
    setMobile(mobileMq.matches)
    const onMotion = () => setReducedMotion(motionMq.matches)
    const onMobile = () => setMobile(mobileMq.matches)
    motionMq.addEventListener("change", onMotion)
    mobileMq.addEventListener("change", onMobile)
    return () => {
      motionMq.removeEventListener("change", onMotion)
      mobileMq.removeEventListener("change", onMobile)
    }
  }, [])

  // Pause the render loop when the engine scrolls out of view. A small
  // negative rootMargin keeps it running through the scroll transition so the
  // scene is already live when it re-enters, never caught mid-freeze.
  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof IntersectionObserver === "undefined") return
    const io = new IntersectionObserver(
      ([entry]) => setOnScreen(entry.isIntersecting),
      { rootMargin: "120px", threshold: 0 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [mounted])

  const onHover = useCallback<HoverHandler>((info) => {
    setHovered(info)
    // Latch the most-recent body so the mobile sheet has something to show
    // after pointerout fires (touch always pairs over/out per tap).
    if (info) setSelectedBody(info)
    // Broadcast the hover state so the custom cursor can adapt — e.g. switch
    // into target-ring + body-label mode without coupling the cursor to the
    // engine via props. detail.body is null when the pointer leaves a body.
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("universe:hover", {
          detail: { body: info, clickable: Boolean(info?.clickable) },
        }),
      )
    }
  }, [])
  const handleReset = useCallback(() => {
    // Cancel any sustained follow first; otherwise the controller would
    // immediately re-target the followed body and undo the reset.
    cancelFollow()
    cancelFlyTo()
    orbitRef.current?.reset()
    // Broadcast a sky-focus clear so any persistent detail blooms (galaxy
    // spiral, nebula reveal) collapse back to their idle halos.
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("universe:sky-focus", { detail: { pointId: null } }),
      )
    }
  }, [])
  const dismissSheet = useCallback(() => setSelectedBody(null), [])

  // Following-mode banner. Polls the module-scoped followRef on a 200ms
  // interval — cheap enough vs. re-rendering on every frame, fresh enough
  // that the banner appears/disappears in step with the user's actions.
  const [followingLabel, setFollowingLabel] = useState<string | null>(null)
  useEffect(() => {
    const tick = () => setFollowingLabel(followRef.current?.label ?? null)
    tick()
    const id = setInterval(tick, 200)
    return () => clearInterval(id)
  }, [])

  // Narrative caption from the active journey waypoint (Pale Blue Dot,
  // etc.). Same 200ms-poll pattern as followingLabel. Null when the
  // current waypoint doesn't carry a caption, which is most of them.
  const [caption, setCaption] = useState<{
    text: string
    source: string | null
  } | null>(null)
  useEffect(() => {
    const tick = () => {
      const f = flyToRef.current
      const text = f.active ? f.caption : null
      setCaption(text ? { text, source: f.captionSource ?? null } : null)
    }
    tick()
    const id = setInterval(tick, 200)
    return () => clearInterval(id)
  }, [])
  const stopFollowing = useCallback(() => {
    cancelFollow()
    setFollowingLabel(null)
  }, [])

  // Default journey — auto-cycles canonical sights while the user hasn't
  // entered explore mode. When `interactive` flips true the journey
  // cleans up and the in-flight fly-to is cancelled so the camera stops
  // moving and hands control to the user.
  useEffect(() => {
    if (interactive) {
      cancelFlyTo()
      return
    }
    if (reducedMotion) return

    let cancelled = false
    let i = 0
    let timer: ReturnType<typeof setTimeout> | null = null

    const tick = () => {
      if (cancelled) return
      const wp = DEFAULT_JOURNEY[i]
      requestFlyTo(wp.target, wp.distance, wp.label, {
        cameraPos: wp.cameraPos,
        caption: wp.caption,
        captionSource: wp.captionSource,
      })
      i = (i + 1) % DEFAULT_JOURNEY.length
      timer = setTimeout(tick, wp.linger)
    }

    // Initial delay so the page can paint + the user can read the hero
    // typography before the camera starts to move.
    timer = setTimeout(tick, 3500)

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [interactive, reducedMotion])

  if (!mounted) {
    return (
      <div className="relative w-full h-full overflow-hidden bg-background">
        <StaticStarfield />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="font-mono text-[11px] tracking-[0.22em] uppercase text-foreground/60">
            Loading Universe
          </div>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative w-full h-full ue-engine-fade-in">
      <Canvas
        // Camera default: close to the solar system on the Orion Arm.
        camera={{ position: [SUN_OFFSET_SCENE + 4, 6, 13], fov: 50, near: 0.012, far: 1000 }}
        // Cap device-pixel-ratio lower on phones — rendering this scene at full
        // 2× on a mobile GPU is a real frame-rate + battery cost for little
        // visible gain. Desktop keeps the crisp [1, 2] range.
        dpr={mobile ? [1, 1.5] : [1, 2]}
        // Stop drawing entirely while scrolled past the hero (see onScreen).
        frameloop={onScreen ? "always" : "never"}
        gl={{ antialias: true, alpha: true, toneMappingExposure: 1.05 }}
        className="w-full h-full"
        // pointerEvents stays auto so hover hit-tests work in both passive and
        // explore modes; OrbitControls.enabled gates drag/zoom independently.
        style={{ pointerEvents: "auto" }}
      >
        <SceneContents
          // Remount when the scale mode flips so every body re-lays at the new
          // scale (orbit radii are computed at build time via compressRadius).
          key={trueScale ? "scale-true" : "scale-explore"}
          enableMotion={!reducedMotion}
          onHover={onHover}
          onResetView={handleReset}
          mobile={mobile}
          invert={invert}
          interactive={interactive}
          showGravityOverlay={showGravityOverlay}
          showDeepDive={showDeepDive}
          solarOnly={solarOnly}
        />

        <OrbitControls
          ref={orbitRef as React.Ref<OrbitControlsImpl>}
          enabled={interactive}
          // Pan available in explore mode so keyboard arrows + right-click drag
          // let users drift past the default radius around the Sun. Screen-space
          // panning keeps the gesture predictable across viewing angles.
          enablePan={interactive}
          screenSpacePanning
          keyPanSpeed={8}
          enableDamping
          dampingFactor={0.08}
          // minDistance 0.02 (paired with camera near 0.012) lets you zoom in
          // as close as the renderer allows — right down to a Starlink point in
          // LEO, the Moon's surface, a comet nucleus — without near-plane
          // clipping. "Zoom till possible." far stays 1000 so the depth-buffer
          // ratio is still safe enough to avoid z-fighting on distant bodies.
          minDistance={0.02}
          maxDistance={260}
          // Pause autoRotate while in follow mode — otherwise the
          // contemplative spin fights the user's drag and the camera
          // feels "stuck." Resumes the moment follow is cleared (via
          // Reset or by switching to a new body's fly-to).
          autoRotate={!reducedMotion && !followingLabel}
          autoRotateSpeed={0.15}
          rotateSpeed={0.5}
          zoomSpeed={0.7}
          touches={{ ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN }}
          target={SOLAR_SYSTEM_POSITION}
          makeDefault
        />
      </Canvas>

      {showHud && (
        <>
          {/* Corner info panel — desktop only. Mobile gets the bottom sheet
              instead (richer, dismissable, doesn't fight with the time-warp HUD). */}
          {!mobile && (
            <div className="absolute bottom-44 left-8 md:bottom-52 md:left-12 z-20 pointer-events-none max-w-70">
              <InfoPanel info={hovered} />
            </div>
          )}

          {/* Deep Dive legend — compact key for the orbital overlays. */}
          {showDeepDive && !mobile && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="absolute bottom-6 left-8 md:left-12 z-30 pointer-events-none max-w-72"
            >
              <div className="rounded-2xl border border-foreground/12 bg-background/70 backdrop-blur-xl px-4 py-3.5">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-[9px] tracking-[0.3em] uppercase text-foreground/45">
                    Deep Dive
                  </span>
                  <span className="font-mono text-[8px] tracking-[0.24em] uppercase text-cyan-300/70">
                    Orbital overlays
                  </span>
                </div>
                <ul className="space-y-2 font-mono text-[10px] text-foreground/70">
                  <li className="flex items-center gap-2.5">
                    <span className="inline-block h-px w-4 rounded-full bg-cyan-400/80" />
                    Planet + comet orbit paths
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-white" />
                    Live position marker
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-full border border-cyan-300/50 bg-cyan-300/10" />
                    Hill sphere — local gravity boundary
                  </li>
                </ul>
                <p className="mt-3 pt-2.5 border-t border-foreground/10 font-sans text-[10px] leading-4 text-foreground/45">
                  Paths from real orbital elements (J2000). Hill radius r_H = a·(m/3M)<sup>1/3</sup>.
                </p>
              </div>
            </motion.div>
          )}

          {/* Satellites legend — color key for the orbital shells, shown while
              the Satellites layer is on. */}
          {showSatellites && !mobile && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="absolute bottom-6 right-8 md:right-12 z-30 pointer-events-none max-w-64"
            >
              <div className="rounded-2xl border border-foreground/12 bg-background/70 backdrop-blur-xl px-4 py-3.5">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-[9px] tracking-[0.3em] uppercase text-foreground/45">Satellites</span>
                  <span className="font-mono text-[8px] tracking-[0.24em] uppercase text-cyan-300/70">Real orbits</span>
                </div>
                <ul className="space-y-1.5 font-mono text-[10px] text-foreground/70">
                  {[
                    ["#9fe0ff", "LEO · Starlink / OneWeb / ISS"],
                    ["#bfeacb", "Polar · Earth-observation"],
                    ["#ffd27a", "MEO · GPS / GLONASS / Galileo"],
                    ["#ff9a6b", "GEO · comms + weather belt"],
                  ].map(([c, label]) => (
                    <li key={label} className="flex items-center gap-2.5">
                      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: c as string }} />
                      {label}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 pt-2.5 border-t border-foreground/10 font-sans text-[10px] leading-4 text-foreground/45">
                  Named craft (ISS, Hubble, Tiangong, GPS, JWST) ride their real altitudes. Focus the Moon or Mars for their orbiters.
                </p>
              </div>
            </motion.div>
          )}

          {showDeepDive && mobile && (
            // bottom-44 keeps it clear of the bottom-20 timeline bar on phones.
            <div className="absolute bottom-44 left-4 right-4 z-30 pointer-events-none">
              <div className="mx-auto max-w-md rounded-full border border-foreground/12 bg-background/78 px-4 py-2.5 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-cyan-300/40 bg-cyan-300/10 text-[8px] text-cyan-200">
                    ●
                  </span>
                  <div className="min-w-0">
                    <div className="font-mono text-[9px] tracking-[0.24em] uppercase text-foreground/45">
                      Deep Dive
                    </div>
                    <div className="font-mono text-[10px] text-foreground/75 truncate leading-tight">
                      Orbit trails and Hill spheres are visible
                    </div>
                    <div className="font-mono text-[9px] tracking-[0.16em] uppercase text-foreground/45 truncate leading-tight">
                      Gravity + speed + orbit shape drive the motion
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* HUD cluster — anchored bottom-right alongside UPCOMING (which lives
              at bottom-6 right-6). On phones the cluster sits ABOVE the UPCOMING
              pill (bottom-20, flush to right-6) so the two can never collide
              horizontally no matter how wide the UPCOMING label gets. On desktop
              it returns to the same baseline as UPCOMING, sitting to its left
              with a horizontal gap (right-56). */}
          <div className="absolute bottom-20 right-6 md:bottom-6 md:right-56 z-30 pointer-events-auto flex flex-row items-center gap-2">
            {/* Overlay toggles stay desktop-only — too wide on phones, they
                would push the cluster into UPCOMING. Touch users still get
                pinch-zoom + drag + tap-to-explore. */}
            <div className="hidden md:flex items-center gap-2">
              <CloudToggle active={showClouds} onToggle={() => setShowClouds(v => !v)} />
              <SatelliteToggle active={showSatellites} onToggle={() => setShowSatellites(v => !v)} />
              <ScaleToggle active={trueScale} onToggle={() => setTrueScale(v => !v)} />
              <DestinationsMenu />
              <GravityToggle active={showGravityOverlay} onToggle={() => setShowGravityOverlay(v => !v)} />
              <DeepDiveToggle active={showDeepDive} onToggle={() => setShowDeepDive(v => !v)} />
            </div>
            {showMusic && <GalaxyMusic />}
          </div>

          {/* Timeline — the time machine. Bottom-centre so it reads as the
              primary control on every viewport (phones included). Only shown
              in interactive mode since it drives the shared simulation clock;
              the passive hero render keeps a still, present-day sky. Sits
              above UPCOMING/music (bottom-6) with clearance. */}
          {interactive && (
            <div className="absolute bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-30 flex justify-center">
              <TimelineControl />
            </div>
          )}

          {interactive && <ResetViewButton onClick={handleReset} />}

          {/* Following indicator — only when follow mode is active. Same
              bottom-left slot the destinations menu used to live in. Click
              the chip to stop following; Reset (top-right) also clears it. */}
          {interactive && followingLabel && (
            // Mobile: sit above the bottom-20 timeline bar; desktop: original slot.
            <div className="absolute bottom-44 left-6 md:bottom-32 md:left-12 z-30 pointer-events-auto">
              <button
                type="button"
                onClick={stopFollowing}
                aria-label={`Stop following ${followingLabel}`}
                className="
                  inline-flex items-center gap-2 px-3 py-1.5
                  border border-accent/60 rounded-full
                  bg-background/70 backdrop-blur-sm
                  font-mono text-[10px] tracking-[0.25em] uppercase
                  text-foreground hover:border-accent
                  transition-colors duration-300
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                "
              >
                <span aria-hidden="true" className="relative flex h-1.5 w-1.5">
                  <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
                </span>
                Following · {followingLabel}
                <span aria-hidden="true" className="text-foreground/60 ml-1">×</span>
              </button>
            </div>
          )}

          {mobile && (
            <MobileBodySheet
              body={selectedBody}
              onDismiss={dismissSheet}
              onAction={handleReset}
            />
          )}

          {/* Narrative caption — only renders during journey waypoints that
              carry text (currently just the Pale Blue Dot beat). Centered
              and held within a narrow column so the Sagan passage reads
              cinematically rather than dashed across the viewport. */}
          {caption && (
            <div
              key={caption.text}
              className="
                pointer-events-none
                absolute top-32 md:top-40 left-1/2 -translate-x-1/2
                z-20 max-w-md md:max-w-lg px-6 text-center
              "
              style={{ animation: "ue-label-in 700ms ease-out both" }}
            >
              <p className="font-serif italic text-foreground/85 text-base md:text-[18px] leading-relaxed">
                {caption.text}
              </p>
              {caption.source && (
                <p className="mt-3 font-mono text-[9px] tracking-[0.25em] uppercase text-foreground/55">
                  {caption.source}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export type { BodyInfo, HoverHandler } from "./types"
export type {
  Constellation,
  ConstellationId,
  ConstellationStar,
  MoonData,
  Planet,
  ScenePlanet,
} from "./types"
export { constellations, planetsData, moons } from "./astronomy"
