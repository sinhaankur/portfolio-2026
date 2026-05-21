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

import { SOLAR_SYSTEM_POSITION, SUN_OFFSET_SCENE, timeWarpRef } from "./astronomy"
import { SceneContents } from "./scene"
import { InfoPanel, ResetViewButton, TimeWarpSlider } from "./hud"
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
    orbitRef.current?.reset()
  }, [])
  const dismissSheet = useCallback(() => setSelectedBody(null), [])

  if (!mounted) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-64 h-64 rounded-full border border-foreground/10 motion-safe:animate-pulse" />
      </div>
    )
  }

  return (
    <div className="relative w-full h-full">
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
        />

        <OrbitControls
          ref={orbitRef as React.Ref<OrbitControlsImpl>}
          enabled={interactive}
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
          minDistance={3}
          maxDistance={260}
          autoRotate={!reducedMotion}
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

          <div className="absolute bottom-6 right-6 md:bottom-8 md:right-12 z-30 pointer-events-auto flex flex-col items-end gap-2">
            {showMusic && <GalaxyMusic />}
            <TimeWarpSlider value={timeWarpDisplay} onChange={setTimeWarpDisplay} />
          </div>

          {interactive && <ResetViewButton onClick={handleReset} />}

          {mobile && (
            <MobileBodySheet
              body={selectedBody}
              onDismiss={dismissSheet}
              onAction={handleReset}
            />
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
