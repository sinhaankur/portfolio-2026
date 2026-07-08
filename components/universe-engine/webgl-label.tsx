"use client"

/**
 * WebGLLabel — a text label rendered as a canvas-textured sprite that lives
 * INSIDE the 3D scene (not a DOM overlay).
 *
 * Why this exists: the engine's other labels use drei's <Html>, i.e. DOM nodes
 * positioned in scene space. That works, but DOM labels (a) never occlude —
 * a label shows even when its body is behind the Sun, (b) trigger layout
 * reflow every time they reposition, and (c) get expensive at hundreds of
 * bodies. A sprite sits at true depth (so depth-testing can hide it behind
 * geometry) and costs the GPU, not the layout engine.
 *
 * The hard part of drawing text to a canvas texture is measuring + wrapping it
 * WITHOUT bouncing through the DOM (getBoundingClientRect / offsetHeight force
 * a synchronous reflow). We use @chenglou/pretext for that: a one-time
 * `prepare()` measures segments via the canvas font engine, then `layout()` is
 * pure arithmetic — reflow-free, and it handles CJK/Arabic/emoji correctly for
 * the engine's multilingual body names.
 *
 * Design note (the UX argument this makes): a label is only useful when it's
 * legible AND honest about depth. Rendering it in the scene means it obeys the
 * same physics as everything else — it can be occluded, it scales with
 * distance, it never floats over a body it's actually behind.
 */

import { useMemo } from "react"
import { useThree } from "@react-three/fiber"
import * as THREE from "three"
import { prepareWithSegments, layoutWithLines } from "@chenglou/pretext"

type WebGLLabelProps = {
  text: string
  position: [number, number, number]
  /** world-units tall for one line; the sprite scales from this. */
  fontSizePx?: number
  maxWidthPx?: number
  color?: string
  background?: string
  /** overall sprite scale in world units. */
  scale?: number
  opacity?: number
}

const DPR_CAP = 2
// Supersample beyond DPR so labels stay pixel-perfect crisp when the camera
// zooms in on them (the sprite magnifies past its baked size otherwise). 1.5×
// is a good crispness/memory trade — labels are small textures.
const SUPERSAMPLE = 1.5

/**
 * Build a canvas texture for `text`, wrapping to `maxWidthPx` using pretext for
 * reflow-free measurement. Returns the texture plus its pixel dimensions so the
 * sprite can keep the right aspect ratio.
 */
function makeLabelTexture(
  text: string,
  fontSizePx: number,
  maxWidthPx: number,
  color: string,
  background: string,
): { texture: THREE.CanvasTexture; w: number; h: number } | null {
  if (typeof document === "undefined") return null

  // Effective scale = device pixel ratio × supersample, so the baked canvas has
  // enough real pixels to stay sharp both on retina AND when zoomed close.
  const dpr = Math.min(DPR_CAP, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1)
    * SUPERSAMPLE
  const font = `${fontSizePx}px Inter, system-ui, sans-serif`
  const lineHeight = Math.round(fontSizePx * 1.3)
  const padX = Math.round(fontSizePx * 0.6)
  const padY = Math.round(fontSizePx * 0.35)

  // --- pretext: measure + lay out lines with NO DOM reflow ---
  // prepareWithSegments() does the one-time segmentation + canvas measurement;
  // layoutWithLines() then returns the actual wrapped line ranges via pure
  // arithmetic (no getBoundingClientRect, no reflow). We materialize each range
  // to its string for painting. If pretext can't run here we fall back to a
  // single unwrapped line.
  let lines: string[] = [text]
  let contentW = maxWidthPx
  let contentH = lineHeight
  try {
    const prepared = prepareWithSegments(text, font)
    const result = layoutWithLines(prepared, maxWidthPx, lineHeight)
    // pretext hands back the wrapped lines with their measured widths directly —
    // .text for painting, .width for sizing the box. No re-measure, no reflow.
    lines = result.lines.map((l) => l.text)
    if (lines.length === 0) lines = [text]
    contentH = Math.max(lineHeight, Math.round(result.height))
    contentW = Math.min(maxWidthPx, Math.max(...result.lines.map((l) => l.width)))
  } catch {
    lines = [text]
    contentW = Math.min(maxWidthPx, measureWidth(text, font))
    contentH = lineHeight
  }

  const cssW = Math.ceil(contentW + padX * 2)
  const cssH = Math.ceil(contentH + padY * 2)

  const canvas = document.createElement("canvas")
  canvas.width = Math.ceil(cssW * dpr)
  canvas.height = Math.ceil(cssH * dpr)
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  ctx.scale(dpr, dpr)

  // pill background
  if (background !== "transparent") {
    ctx.fillStyle = background
    roundRect(ctx, 0, 0, cssW, cssH, Math.min(cssH / 2, 10))
    ctx.fill()
  }

  ctx.font = font
  ctx.fillStyle = color
  ctx.textBaseline = "top"
  lines.forEach((line, i) => {
    ctx.fillText(line, padX, padY + i * lineHeight)
  })

  const texture = new THREE.CanvasTexture(canvas)
  // Crisp at every distance: trilinear mipmapping keeps far/small labels clean
  // (no shimmer), a linear mag filter keeps zoomed-in labels smooth, and high
  // anisotropy sharpens labels viewed at a grazing angle.
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = true
  texture.anisotropy = 8
  texture.needsUpdate = true
  return { texture, w: cssW, h: cssH }
}

// A canvas-context width measurement (used only for painting alignment; the
// authoritative wrapping decision comes from pretext's prepare/layout above).
let _measureCtx: CanvasRenderingContext2D | null = null
function measureWidth(s: string, font: string): number {
  if (typeof document === "undefined") return s.length * 8
  if (!_measureCtx) _measureCtx = document.createElement("canvas").getContext("2d")
  if (!_measureCtx) return s.length * 8
  _measureCtx.font = font
  return _measureCtx.measureText(s).width
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export function WebGLLabel({
  text,
  position,
  fontSizePx = 42,
  maxWidthPx = 420,
  color = "#ffffff",
  background = "rgba(0,0,0,0.55)",
  scale = 1,
  opacity = 1,
}: WebGLLabelProps) {
  const invalidate = useThree((s) => s.invalidate)

  const built = useMemo(() => {
    const t = makeLabelTexture(text, fontSizePx, maxWidthPx, color, background)
    invalidate()
    return t
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, fontSizePx, maxWidthPx, color, background])

  if (!built) return null
  const aspect = built.w / built.h
  const baseH = scale
  const baseW = baseH * aspect

  return (
    <sprite position={position} scale={[baseW, baseH, 1]}>
      <spriteMaterial
        map={built.texture}
        transparent
        opacity={opacity}
        depthWrite={false}
        toneMapped={false}
      />
    </sprite>
  )
}
