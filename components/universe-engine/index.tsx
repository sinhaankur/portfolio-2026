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
 *   hud.tsx        DOM overlays (InfoPanel, TimeWarpSlider, ResetViewButton)
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

import {
  DEFAULT_JOURNEY,
  SOLAR_SYSTEM_POSITION,
  SUN_OFFSET_SCENE,
  cancelFlyTo,
  cancelFollow,
  flyToRef,
  followRef,
  requestFlyTo,
  timeWarpRef,
} from "./astronomy"
import { SceneContents } from "./scene"
import { DateReadout, InfoPanel, ResetViewButton, TimeWarpSlider } from "./hud"
import { MobileBodySheet } from "./mobile-sheet"
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
}

export function UniverseEngine({
  interactive = false,
  showHud = true,
  showMusic = true,
  invert: invertProp,
}: UniverseEngineProps) {
  const [mounted, setMounted] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [mobile, setMobile] = useState(false)
  const [hovered, setHovered] = useState<BodyInfo | null>(null)
  // Sticky selection — mobile devices fire pointerover/pointerout in pairs on
  // each tap, so `hovered` clears immediately. `selectedBody` latches on the
  // most-recent tap and only clears when the user dismisses the bottom sheet.
  const [selectedBody, setSelectedBody] = useState<BodyInfo | null>(null)
  const [timeWarpDisplay, setTimeWarpDisplay] = useState(timeWarpRef.current)
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
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-64 h-64 rounded-full border border-foreground/10 motion-safe:animate-pulse" />
      </div>
    )
  }

  return (
    <div className="relative w-full h-full ue-engine-fade-in">
      <Canvas
        // Camera default: close to the solar system on the Orion Arm.
        camera={{ position: [SUN_OFFSET_SCENE + 4, 6, 13], fov: 50, near: 0.1, far: 1000 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, toneMappingExposure: 1.05 }}
        className="w-full h-full"
        // pointerEvents stays auto so hover hit-tests work in both passive and
        // explore modes; OrbitControls.enabled gates drag/zoom independently.
        style={{ pointerEvents: "auto" }}
      >
        <SceneContents
          enableMotion={!reducedMotion}
          onHover={onHover}
          onResetView={handleReset}
          mobile={mobile}
          invert={invert}
          interactive={interactive}
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
          // minDistance lowered to 0.2 so users can zoom deep into Earth /
          // Jupiter / the Sun — close enough to see the texture detail, not
          // just the silhouette. Smaller bodies (moons, comets) also benefit
          // since users follow-mode to them.
          minDistance={0.2}
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

          {/* HUD cluster — horizontal row, anchored bottom-right alongside
              UPCOMING (which lives at bottom-6 right-6). The previous stacked
              layout placed the music chip at bottom-24+, which on shorter
              viewports collided with the "INTERACTION" italic baseline. Sitting
              on the same baseline as UPCOMING keeps the chip out of the
              typography zone entirely, with a horizontal gap to UPCOMING. */}
          <div className="absolute bottom-6 right-44 md:right-56 z-30 pointer-events-auto flex flex-row items-center gap-2">
            {/* Date + time-warp cluster stay desktop-only — the pills are
                too wide on phones, they would push the cluster into UPCOMING.
                Touch users still get pinch-zoom + drag + tap-to-explore. */}
            <div className="hidden md:flex items-center gap-2">
              <DateReadout />
              <TimeWarpSlider value={timeWarpDisplay} onChange={setTimeWarpDisplay} />
            </div>
            {showMusic && <GalaxyMusic />}
          </div>

          {interactive && <ResetViewButton onClick={handleReset} />}

          {/* Following indicator — only when follow mode is active. Same
              bottom-left slot the destinations menu used to live in. Click
              the chip to stop following; Reset (top-right) also clears it. */}
          {interactive && followingLabel && (
            <div className="absolute bottom-32 left-6 md:bottom-32 md:left-12 z-30 pointer-events-auto">
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
