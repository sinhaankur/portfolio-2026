"use client"

/**
 * flow-canvas.tsx — the ORCHESTRATOR of the Optical Flow engine.
 *
 * Owns the camera (getUserMedia) and the RAF loop, and composes the three
 * pure layers around them:
 *   · flow-core.ts  — the CV spine (Shi-Tomasi detect + Lucas-Kanade track)
 *   · renderer.ts   — field merge (even spacing) + dot-field drawing
 *   · config.ts     — every tunable param / palette / default
 *   · hud.tsx       — the control surface
 * This file holds NO CV math and NO draw calls inline; it wires the layers.
 *
 * The live camera IS the experience — there's no pre-baked clip. Static-export
 * safe: client-only, no network. getUserMedia is requested only after an
 * explicit user click (never auto), matching the site's opt-in-media convention.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import {
  toGray,
  blur,
  shiTomasi,
  buildPyramid,
  trackPoints,
  type FeaturePoint,
  type GrayImage,
} from "./flow-core"
import {
  PROC_W,
  PROC_H,
  PYRAMID_LEVELS,
  LK,
  REPLENISH,
  PALETTES,
  DEFAULTS,
  densityToDetection,
  type EngineParams,
} from "./config"
import { mergeField, drawField } from "./renderer"
import { FlowHud } from "./hud"

type Source = "idle" | "webcam"

export function FlowCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const scratchRef = useRef<HTMLCanvasElement>(null) // hidden, proc-resolution

  const [source, setSource] = useState<Source>("idle")
  const [error, setError] = useState<string | null>(null)
  const [params, setParams] = useState<EngineParams>({
    density: DEFAULTS.density,
    paletteIdx: DEFAULTS.paletteIdx,
    ghostSource: DEFAULTS.ghostSource,
  })

  // Per-frame state in refs so the RAF loop never re-subscribes.
  const pointsRef = useRef<FeaturePoint[]>([])
  const prevPyrRef = useRef<GrayImage[] | null>(null)
  const rafRef = useRef<number>(0)
  const runningRef = useRef(false)
  const frameCountRef = useRef(0)
  const paramsRef = useRef(params)
  useEffect(() => {
    paramsRef.current = params
  }, [params])

  const updateParams = useCallback((next: Partial<EngineParams>) => {
    setParams((p) => ({ ...p, ...next }))
  }, [])

  const stop = useCallback(() => {
    runningRef.current = false
    cancelAnimationFrame(rafRef.current)
    const v = videoRef.current
    if (v && v.srcObject) {
      ;(v.srcObject as MediaStream).getTracks().forEach((t) => t.stop())
      v.srcObject = null
    }
    pointsRef.current = []
    prevPyrRef.current = null
  }, [])

  /** Pull the current frame as a blurred grayscale image at processing res. */
  const grayFromVideo = useCallback((): GrayImage | null => {
    const v = videoRef.current
    const scratch = scratchRef.current
    if (!v || !scratch || v.readyState < 2) return null
    const sctx = scratch.getContext("2d", { willReadFrequently: true })
    if (!sctx) return null
    sctx.save() // mirror so the webcam reads like a mirror
    sctx.translate(PROC_W, 0)
    sctx.scale(-1, 1)
    sctx.drawImage(v, 0, 0, PROC_W, PROC_H)
    sctx.restore()
    return blur(toGray(sctx.getImageData(0, 0, PROC_W, PROC_H)))
  }, [])

  const loop = useCallback(() => {
    if (!runningRef.current) return
    const canvas = canvasRef.current
    const gray = grayFromVideo()
    if (canvas && gray) {
      const pyr = buildPyramid(gray, PYRAMID_LEVELS)
      frameCountRef.current++
      const { density, paletteIdx, ghostSource } = paramsRef.current

      // 1) TRACK — move existing points forward (Lucas-Kanade).
      if (prevPyrRef.current && pointsRef.current.length) {
        pointsRef.current = trackPoints(prevPyrRef.current, pyr, pointsRef.current, LK)
      }

      // 2) REPLENISH — re-seed via Shi-Tomasi when the field thins or on cadence,
      //    then fold in with even spacing (renderer.mergeField kills clumping).
      const { maxCorners, minDistance, qualityLevel } = densityToDetection(density)
      const needTopUp =
        pointsRef.current.length < maxCorners * REPLENISH.thinFraction ||
        frameCountRef.current % REPLENISH.everyNFrames === 0
      if (needTopUp) {
        const fresh = shiTomasi(pyr[0], { maxCorners, qualityLevel, minDistance, blockSize: 3 })
        pointsRef.current = mergeField(pointsRef.current, fresh, minDistance, maxCorners)
      }

      prevPyrRef.current = pyr

      // 3) RENDER — draw the field (renderer.drawField).
      const ctx = canvas.getContext("2d")
      if (ctx) {
        drawField(ctx, pointsRef.current, PALETTES[paletteIdx], {
          ghost: ghostSource ? videoRef.current : null,
          mirror: true,
        })
      }
    }
    rafRef.current = requestAnimationFrame(loop)
  }, [grayFromVideo])

  const startWebcam = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false,
      })
      const v = videoRef.current
      if (!v) return
      v.srcObject = stream
      await v.play()
      setSource("webcam")
      runningRef.current = true
      rafRef.current = requestAnimationFrame(loop)
    } catch {
      setError(
        "No camera access — this experiment needs your webcam to track motion. Allow the camera and try again."
      )
    }
  }, [loop])

  useEffect(() => () => stop(), [stop])

  return (
    <div className="relative w-full">
      {/* hidden capture elements */}
      <video ref={videoRef} className="hidden" playsInline muted />
      <canvas ref={scratchRef} width={PROC_W} height={PROC_H} className="hidden" />

      <div className="relative overflow-hidden rounded-2xl border border-border bg-black">
        <canvas
          ref={canvasRef}
          width={960}
          height={720}
          className="block w-full h-auto aspect-[4/3]"
        />

        {source === "idle" && (
          <div className="absolute inset-0 grid place-items-center bg-black/70 backdrop-blur-sm p-6 text-center">
            <div className="max-w-md">
              <p className="font-mono text-[11px] tracking-[0.3em] uppercase text-white/55 mb-4">
                Shi-Tomasi · Lucas-Kanade · live
              </p>
              <p className="font-sans text-base md:text-lg text-white/85 leading-relaxed mb-6">
                Step into the camera and watch yourself resolve into tracked
                feature points — corners detected, then followed frame to frame.
              </p>
              <div className="flex items-center justify-center">
                <button
                  onClick={startWebcam}
                  data-cursor-hover
                  className="rounded-full bg-white text-black font-mono text-[11px] tracking-wider uppercase px-6 py-3 hover:bg-white/85 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                >
                  Use my camera
                </button>
              </div>
              <p className="mt-4 font-sans text-xs text-white/45">
                Camera frames are processed on your device and never leave it.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute left-3 top-3 rounded-md bg-black/70 px-3 py-1.5 font-mono text-[10px] tracking-wider text-amber-200">
            {error}
          </div>
        )}
      </div>

      {source !== "idle" && (
        <FlowHud
          params={params}
          onChange={updateParams}
          onStop={() => {
            stop()
            setSource("idle")
          }}
        />
      )}
    </div>
  )
}
