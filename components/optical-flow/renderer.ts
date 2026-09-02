/**
 * renderer.ts — the field layer of the Optical Flow engine.
 *
 * Two pure concerns, both free of React and camera plumbing:
 *   1. mergeField  — fold freshly-detected corners into the tracked field with
 *      EVEN spacing enforced (kills clumping), via a spatial-hash grid.
 *   2. drawField   — paint the point field to a 2D canvas as soft, varied,
 *      glowing dots floating on the palette background.
 *
 * The orchestrator (flow-canvas.tsx) owns the camera + RAF loop and calls into
 * these; it never inlines spacing math or draw calls itself.
 */

import type { FeaturePoint } from "./flow-core"
import { PROC_W, PROC_H, RENDER, type Palette } from "./config"

/**
 * Merge fresh Shi-Tomasi corners into the existing tracked field, keeping
 * tracked points (they have history) and only admitting fresh ones that sit at
 * least `minDistance` from every accepted point — including each other. A
 * grid keyed by the min-distance cell makes the neighbour test cheap.
 */
export function mergeField(
  tracked: FeaturePoint[],
  fresh: FeaturePoint[],
  minDistance: number,
  maxCorners: number
): FeaturePoint[] {
  const md2 = minDistance * minDistance
  const cell = Math.max(1, minDistance)
  const cols = Math.ceil(PROC_W / cell) + 1
  const grid = new Map<number, FeaturePoint[]>()

  const cellKey = (x: number, y: number) =>
    Math.floor(y / cell) * cols + Math.floor(x / cell)

  const farEnough = (x: number, y: number): boolean => {
    const cx = Math.floor(x / cell)
    const cy = Math.floor(y / cell)
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const bucket = grid.get((cy + dy) * cols + (cx + dx))
        if (!bucket) continue
        for (const q of bucket) {
          const ex = q.x - x
          const ey = q.y - y
          if (ex * ex + ey * ey < md2) return false
        }
      }
    }
    return true
  }

  const add = (p: FeaturePoint) => {
    const k = cellKey(p.x, p.y)
    const b = grid.get(k)
    if (b) b.push(p)
    else grid.set(k, [p])
  }

  const merged = tracked.slice()
  for (const p of merged) add(p) // tracked points keep priority
  for (const f of fresh) {
    if (merged.length >= maxCorners) break
    if (farEnough(f.x, f.y)) {
      merged.push(f)
      add(f)
    }
  }
  return merged
}

/**
 * Paint the point field. Each dot is a soft radial gradient — a glowing point,
 * not a hard disc — with size + brightness varying by corner strength so the
 * field shimmers instead of reading flat. Drawn additively over the palette
 * background; an optional ghost of the source video can sit underneath.
 */
export function drawField(
  ctx: CanvasRenderingContext2D,
  points: FeaturePoint[],
  palette: Palette,
  opts: { ghost?: HTMLVideoElement | null; mirror?: boolean } = {}
): void {
  const W = ctx.canvas.width
  const H = ctx.canvas.height

  ctx.fillStyle = palette.bg
  ctx.fillRect(0, 0, W, H)

  if (opts.ghost) {
    ctx.save()
    ctx.globalAlpha = 0.18
    if (opts.mirror) {
      ctx.translate(W, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(opts.ghost, 0, 0, W, H)
    ctx.restore()
  }

  const sx = W / PROC_W
  const sy = H / PROC_H
  ctx.globalCompositeOperation = "lighter"
  for (const p of points) {
    const x = p.x * sx
    const y = p.y * sy
    const fade = Math.min(1, p.age / RENDER.fadeInFrames)
    const core =
      (RENDER.sizeBase + Math.min(p.strength / RENDER.sizeStrengthDiv, RENDER.sizeStrengthMax)) *
      (sx / 2)
    const radius = core * RENDER.glowSpread
    const col = palette.dot(p.age, p.strength)
    const alpha =
      (RENDER.alphaBase + Math.min(p.strength / RENDER.alphaStrengthDiv, RENDER.alphaStrengthMax)) *
      fade

    // Soft halo — a gentle 4-stop falloff so dots bloom without hard edges.
    const grad = ctx.createRadialGradient(x, y, 0, x, y, radius)
    grad.addColorStop(0, col)
    grad.addColorStop(0.18, col)
    grad.addColorStop(0.55, withAlpha(col, 0.35))
    grad.addColorStop(1, "transparent")
    ctx.beginPath()
    ctx.fillStyle = grad
    ctx.globalAlpha = alpha
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()

    // Crisp bright pin-point core inside the halo — makes each dot read as a
    // real light source (a jewel), lifting the whole dense field.
    const coreR = Math.max(0.6, radius * RENDER.coreDotFraction)
    ctx.beginPath()
    ctx.fillStyle = col
    ctx.globalAlpha = Math.min(1, alpha + 0.25) * fade
    ctx.arc(x, y, coreR, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = "source-over"
}

/** Turn an `rgb(r,g,b)` / `rgba(...)` colour string into one at a given alpha,
 *  for the halo's mid falloff stop. Falls back to the input if unparseable. */
function withAlpha(col: string, a: number): string {
  const m = col.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (!m) return col
  return `rgba(${m[1]},${m[2]},${m[3]},${a})`
}

/** Convenience: the proc-resolution constants, re-exported for the scratch canvas. */
export { PROC_W, PROC_H }
