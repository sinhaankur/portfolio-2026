"use client"

/**
 * flow-canvas.tsx — the live Optical Flow demo.
 *
 * Pulls frames from the webcam, runs the Shi-Tomasi + Lucas-Kanade pipeline
 * from flow-core.ts on a downscaled copy of each frame, and renders the
 * tracked feature points as glowing dots on a 2D canvas. Density and palette
 * are live-adjustable, mirroring the "adjusted dot density to my liking, took
 * liberties with the colours" note from the reference.
 *
 * The live camera IS the experience — there's no pre-baked clip; the whole
 * point is watching your own motion become tracked data. Static-export safe:
 * everything is client-only, no network at all. getUserMedia is requested only
 * after an explicit user click (never auto), matching the site's opt-in-media
 * convention.
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

// Processing resolution — small enough to run the CV in real time on a laptop,
// upscaled to the display canvas. The original worked on NumPy arrays at modest
// res for the same reason.
const PROC_W = 240
const PROC_H = 180
const PYRAMID_LEVELS = 3

type Palette = { name: string; bg: string; dot: (age: number, strength: number) => string }

const PALETTES: Palette[] = [
  {
    name: "Ember",
    bg: "#0a0705",
    dot: (age) => {
      // young = white-hot, aging = amber → deep orange (took liberties w/ colour)
      const t = Math.min(1, age / 40)
      const r = 255
      const g = Math.round(240 - t * 150)
      const b = Math.round(200 - t * 190)
      return `rgb(${r},${g},${b})`
    },
  },
  {
    name: "Cyan",
    bg: "#03070a",
    dot: (age) => {
      const t = Math.min(1, age / 40)
      const r = Math.round(120 - t * 100)
      const g = Math.round(220 - t * 60)
      const b = 255
      return `rgb(${r},${g},${b})`
    },
  },
  {
    name: "Mono",
    bg: "#000000",
    dot: () => "rgba(255,255,255,0.92)",
  },
]

type Source = "idle" | "webcam"

export function FlowCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  // hidden scratch canvas for pulling pixels at processing resolution
  const scratchRef = useRef<HTMLCanvasElement>(null)

  const [source, setSource] = useState<Source>("idle")
  const [error, setError] = useState<string | null>(null)
  const [paletteIdx, setPaletteIdx] = useState(0)
  const [density, setDensity] = useState(0.6) // 0..1 → maxCorners + spacing
  const [showVideo, setShowVideo] = useState(false) // ghost the source under the dots

  // mutable per-frame state kept in refs so the RAF loop doesn't re-subscribe
  const pointsRef = useRef<FeaturePoint[]>([])
  const prevPyrRef = useRef<GrayImage[] | null>(null)
  const rafRef = useRef<number>(0)
  const runningRef = useRef(false)
  const paletteIdxRef = useRef(0)
  const densityRef = useRef(0.6)
  const showVideoRef = useRef(false)
  const frameCountRef = useRef(0)

  useEffect(() => {
    paletteIdxRef.current = paletteIdx
  }, [paletteIdx])
  useEffect(() => {
    densityRef.current = density
  }, [density])
  useEffect(() => {
    showVideoRef.current = showVideo
  }, [showVideo])

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

  const grayFromVideo = useCallback((): GrayImage | null => {
    const v = videoRef.current
    const scratch = scratchRef.current
    if (!v || !scratch || v.readyState < 2) return null
    const sctx = scratch.getContext("2d", { willReadFrequently: true })
    if (!sctx) return null
    // mirror the webcam horizontally so it reads like a mirror
    sctx.save()
    sctx.translate(PROC_W, 0)
    sctx.scale(-1, 1)
    sctx.drawImage(v, 0, 0, PROC_W, PROC_H)
    sctx.restore()
    const img = sctx.getImageData(0, 0, PROC_W, PROC_H)
    return blur(toGray(img))
  }, [])

  const loop = useCallback(() => {
    if (!runningRef.current) return
    const canvas = canvasRef.current
    const gray = grayFromVideo()
    if (canvas && gray) {
      const pyr = buildPyramid(gray, PYRAMID_LEVELS)
      frameCountRef.current++

      // 1) TRACK existing points forward (Lucas-Kanade)
      if (prevPyrRef.current && pointsRef.current.length) {
        pointsRef.current = trackPoints(prevPyrRef.current, pyr, pointsRef.current, {
          winSize: 7,
          iters: 6,
        })
      }

      // 2) REPLENISH via Shi-Tomasi when the herd thins or periodically, so the
      //    field stays alive as points drift off-frame or fail.
      const d = densityRef.current
      const maxCorners = Math.round(120 + d * 480) // 120..600
      const minDistance = Math.round(10 - d * 6) // sparse..dense
      const needTopUp =
        pointsRef.current.length < maxCorners * 0.7 || frameCountRef.current % 12 === 0
      if (needTopUp) {
        const fresh = shiTomasi(pyr[0], {
          maxCorners,
          qualityLevel: 0.06,
          minDistance,
          blockSize: 3,
        })
        // merge: keep tracked points, add fresh ones that aren't on top of them
        const merged = pointsRef.current.slice()
        const md2 = minDistance * minDistance
        for (const f of fresh) {
          let dup = false
          for (const p of pointsRef.current) {
            const dx = p.x - f.x
            const dy = p.y - f.y
            if (dx * dx + dy * dy < md2) {
              dup = true
              break
            }
          }
          if (!dup && merged.length < maxCorners) merged.push(f)
        }
        pointsRef.current = merged
      }

      prevPyrRef.current = pyr

      // 3) RENDER dots, scaled up to the display canvas
      const ctx = canvas.getContext("2d")
      if (ctx) {
        const W = canvas.width
        const H = canvas.height
        const pal = PALETTES[paletteIdxRef.current]
        ctx.fillStyle = pal.bg
        ctx.fillRect(0, 0, W, H)

        if (showVideoRef.current && videoRef.current) {
          ctx.save()
          ctx.globalAlpha = 0.18
          ctx.translate(W, 0)
          ctx.scale(-1, 1)
          ctx.drawImage(videoRef.current, 0, 0, W, H)
          ctx.restore()
        }

        const sx = W / PROC_W
        const sy = H / PROC_H
        ctx.globalCompositeOperation = "lighter"
        for (const p of pointsRef.current) {
          const x = p.x * sx
          const y = p.y * sy
          const fade = Math.min(1, p.age / 6) // gentle fade-in for new dots
          const r = (1.1 + Math.min(p.strength / 600, 2.2)) * (sx / 2)
          ctx.beginPath()
          ctx.fillStyle = pal.dot(p.age, p.strength)
          ctx.globalAlpha = 0.85 * fade
          ctx.arc(x, y, r, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.globalAlpha = 1
        ctx.globalCompositeOperation = "source-over"
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

      {/* controls */}
      {source !== "idle" && (
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
          <label className="flex items-center gap-2 font-mono text-[10px] tracking-wider uppercase text-foreground/70">
            Density
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={density}
              onChange={(e) => setDensity(parseFloat(e.target.value))}
              className="w-28 accent-accent"
              aria-label="Dot density"
            />
          </label>

          <div className="flex items-center gap-2 font-mono text-[10px] tracking-wider uppercase text-foreground/70">
            Palette
            {PALETTES.map((p, i) => (
              <button
                key={p.name}
                onClick={() => setPaletteIdx(i)}
                data-cursor-hover
                className={`rounded-full px-3 py-1 border transition-colors ${
                  paletteIdx === i
                    ? "border-accent text-accent"
                    : "border-border text-foreground/60 hover:text-foreground"
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 font-mono text-[10px] tracking-wider uppercase text-foreground/70 cursor-pointer">
            <input
              type="checkbox"
              checked={showVideo}
              onChange={(e) => setShowVideo(e.target.checked)}
              className="accent-accent"
            />
            Ghost source
          </label>

          <button
            onClick={() => {
              stop()
              setSource("idle")
            }}
            data-cursor-hover
            className="ml-auto rounded-full border border-border px-3 py-1 font-mono text-[10px] tracking-wider uppercase text-foreground/60 hover:text-foreground transition-colors"
          >
            Stop
          </button>
        </div>
      )}
    </div>
  )
}
