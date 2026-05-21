"use client"

/**
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

import { SOLAR_SYSTEM_POSITION, SUN_OFFSET_SCENE, timeWarpRef } from "./astronomy"
import { SceneContents } from "./scene"
import { InfoPanel, ResetViewButton, TimeWarpSlider } from "./hud"
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
   * Future hook: render as a light "astronomical chart" (cream paper, ink stars)
   * instead of a dark planetarium. The shader path supports this; consumer UI
   * doesn't expose it yet.
   */
  invert?: boolean
}

export function UniverseEngine({
  interactive = false,
  showHud = true,
  showMusic = true,
  invert = false,
}: UniverseEngineProps) {
  const [mounted, setMounted] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [mobile, setMobile] = useState(false)
  const [hovered, setHovered] = useState<BodyInfo | null>(null)
  const [timeWarpDisplay, setTimeWarpDisplay] = useState(timeWarpRef.current)
  const orbitRef = useRef<OrbitControlsImpl | null>(null)

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
          <div className="absolute bottom-44 left-8 md:bottom-52 md:left-12 z-20 pointer-events-none max-w-70">
            <InfoPanel info={hovered} />
          </div>

          <div className="absolute bottom-6 right-6 md:bottom-8 md:right-12 z-30 pointer-events-auto flex flex-col items-end gap-2">
            {showMusic && <GalaxyMusic />}
            <TimeWarpSlider value={timeWarpDisplay} onChange={setTimeWarpDisplay} />
          </div>

          {interactive && <ResetViewButton onClick={handleReset} />}
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
