/**
 * pattern-render.ts — the PATTERN-ENGINE layer of the Optical Flow experiment.
 *
 * The original engine tracks *motion* (Shi-Tomasi corners followed by
 * Lucas-Kanade). These modes go further: they capture the *whole image as
 * data* — the camera stops being a mirror and becomes a pattern engine that
 * reconstructs what it sees out of structured points, edges, regions or marks.
 *
 * Four pure render modes, all fed the SAME processing-resolution frame the CV
 * spine already produces (grayscale + the raw RGBA), so nothing new touches the
 * camera. Each is a pure function of (ctx, frame, palette) — no React, no RAF.
 *
 *   · dataField — every cell of the frame becomes a glowing point whose colour
 *     is the real pixel colour and whose size is its brightness. You literally
 *     become a field of data that still *reads* as you.
 *   · edges     — Sobel gradient magnitude → a flowing contour map: the engine
 *     traces the structure/pattern of the scene, not its fill.
 *   · regions   — a coarse colour-quantised mosaic: the frame collapses into
 *     pattern cells (a live low-bit / superpixel look).
 *   · ascii     — luminance mapped to a ramp of characters: the classic
 *     image-as-a-grid-of-symbols, pure data you can read.
 *
 * © Ankur Sinha. Hand-written; no CV library.
 */

import { PROC_W, PROC_H, type Palette, type PatternMode } from "./config"

export type { PatternMode }

/** The raw frame the modes read: proc-res RGBA + a grayscale luma array. */
export interface Frame {
  rgba: Uint8ClampedArray // PROC_W*PROC_H*4
  gray: Float32Array // PROC_W*PROC_H, 0..255
}

const idx = (x: number, y: number) => y * PROC_W + x

// ── dataField ───────────────────────────────────────────────────────────────
// Sample the frame on a grid; each sample becomes a soft glowing dot in its own
// real colour, sized by brightness. Dense grid → the whole image is rebuilt out
// of points. This is the "you become data" mode.
export function drawDataField(
  ctx: CanvasRenderingContext2D,
  frame: Frame,
  palette: Palette,
  density: number
): void {
  const W = ctx.canvas.width
  const H = ctx.canvas.height
  ctx.fillStyle = palette.bg
  ctx.fillRect(0, 0, W, H)

  // Grid step in proc pixels: denser at higher density.
  const step = Math.max(2, Math.round(6 - density * 4)) // 6..2
  const sx = W / PROC_W
  const sy = H / PROC_H
  const cell = step * sx

  ctx.globalCompositeOperation = "lighter"
  for (let py = 0; py < PROC_H; py += step) {
    for (let px = 0; px < PROC_W; px += step) {
      const i = idx(px, py) * 4
      const r = frame.rgba[i]
      const g = frame.rgba[i + 1]
      const b = frame.rgba[i + 2]
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
      if (lum < 0.06) continue // skip near-black → keeps the field breathing
      const x = px * sx
      const y = py * sy
      const radius = cell * (0.35 + lum * 0.75)
      const grad = ctx.createRadialGradient(x, y, 0, x, y, radius)
      grad.addColorStop(0, `rgb(${r},${g},${b})`)
      grad.addColorStop(0.4, `rgb(${r},${g},${b})`)
      grad.addColorStop(1, "transparent")
      ctx.globalAlpha = 0.55 + lum * 0.45
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = "source-over"
}

// ── edges ───────────────────────────────────────────────────────────────────
// Sobel gradient magnitude on the grayscale frame → a glowing contour map. The
// engine traces the *pattern/structure* of the scene as flowing lines.
export function drawEdges(
  ctx: CanvasRenderingContext2D,
  frame: Frame,
  palette: Palette,
  density: number
): void {
  const W = ctx.canvas.width
  const H = ctx.canvas.height
  const g = frame.gray

  // Compute Sobel magnitude into an offscreen ImageData at proc-res, then scale.
  const out = ctx.createImageData(PROC_W, PROC_H)
  const [er, eg, eb] = edgeColor(palette)
  const thresh = 40 + (1 - density) * 90 // higher density → more edges kept
  for (let y = 1; y < PROC_H - 1; y++) {
    for (let x = 1; x < PROC_W - 1; x++) {
      const gx =
        -g[idx(x - 1, y - 1)] - 2 * g[idx(x - 1, y)] - g[idx(x - 1, y + 1)] +
        g[idx(x + 1, y - 1)] + 2 * g[idx(x + 1, y)] + g[idx(x + 1, y + 1)]
      const gy =
        -g[idx(x - 1, y - 1)] - 2 * g[idx(x, y - 1)] - g[idx(x + 1, y - 1)] +
        g[idx(x - 1, y + 1)] + 2 * g[idx(x, y + 1)] + g[idx(x + 1, y + 1)]
      const mag = Math.sqrt(gx * gx + gy * gy)
      const o = idx(x, y) * 4
      if (mag > thresh) {
        const t = Math.min(1, mag / 255)
        out.data[o] = er * t
        out.data[o + 1] = eg * t
        out.data[o + 2] = eb * t
        out.data[o + 3] = 255 * Math.min(1, t * 1.4)
      } else {
        out.data[o + 3] = 0
      }
    }
  }
  // Paint bg then the (upscaled) edge layer with a soft glow.
  ctx.fillStyle = palette.bg
  ctx.fillRect(0, 0, W, H)
  scaleImageData(ctx, out, W, H)
}

// ── regions ─────────────────────────────────────────────────────────────────
// Colour-quantise into a coarse mosaic — the frame collapses into pattern cells
// (a live low-bit / superpixel look). Averages each block, snaps to a small
// palette of levels, and paints rounded tiles.
export function drawRegions(
  ctx: CanvasRenderingContext2D,
  frame: Frame,
  palette: Palette,
  density: number
): void {
  const W = ctx.canvas.width
  const H = ctx.canvas.height
  ctx.fillStyle = palette.bg
  ctx.fillRect(0, 0, W, H)

  const block = Math.max(6, Math.round(20 - density * 12)) // 20..8 proc px
  const levels = 5 // quantisation steps per channel
  const q = (v: number) => Math.round((v / 255) * (levels - 1)) * (255 / (levels - 1))
  const sx = W / PROC_W
  const sy = H / PROC_H
  const tw = block * sx
  const th = block * sy

  for (let by = 0; by < PROC_H; by += block) {
    for (let bx = 0; bx < PROC_W; bx += block) {
      let r = 0, gg = 0, b = 0, n = 0
      for (let y = by; y < Math.min(by + block, PROC_H); y++) {
        for (let x = bx; x < Math.min(bx + block, PROC_W); x++) {
          const i = idx(x, y) * 4
          r += frame.rgba[i]; gg += frame.rgba[i + 1]; b += frame.rgba[i + 2]; n++
        }
      }
      if (!n) continue
      const rr = q(r / n), gr = q(gg / n), br = q(b / n)
      ctx.fillStyle = `rgb(${rr},${gr},${br})`
      roundRect(ctx, bx * sx + 1, by * sy + 1, tw - 2, th - 2, Math.min(tw, th) * 0.22)
      ctx.fill()
    }
  }
}

// ── ascii ───────────────────────────────────────────────────────────────────
// Map luminance to a ramp of characters — image as a grid of symbols. Dark →
// space, bright → dense glyph. Reads as literal data you can scan.
const RAMP = " .:-=+*#%@"
export function drawAscii(
  ctx: CanvasRenderingContext2D,
  frame: Frame,
  palette: Palette,
  density: number
): void {
  const W = ctx.canvas.width
  const H = ctx.canvas.height
  ctx.fillStyle = palette.bg
  ctx.fillRect(0, 0, W, H)

  const cols = Math.round(60 + density * 80) // 60..140 chars wide
  const cw = W / cols
  const rows = Math.round(cols * (PROC_H / PROC_W) * 0.52) // char aspect
  const ch = H / rows
  const bx = PROC_W / cols
  const by = PROC_H / rows

  ctx.font = `${Math.round(ch)}px ui-monospace, Menlo, monospace`
  ctx.textBaseline = "top"
  const [cr, cg, cb] = edgeColor(palette)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const px = Math.min(PROC_W - 1, Math.floor(c * bx))
      const py = Math.min(PROC_H - 1, Math.floor(r * by))
      const lum = frame.gray[idx(px, py)] / 255
      const ch2 = RAMP[Math.min(RAMP.length - 1, Math.floor(lum * RAMP.length))]
      if (ch2 === " ") continue
      const t = 0.35 + lum * 0.65
      ctx.fillStyle = `rgba(${cr},${cg},${cb},${t})`
      ctx.fillText(ch2, c * cw, r * ch)
    }
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────
function edgeColor(palette: Palette): [number, number, number] {
  // Reuse a bright dot colour from the palette for edges/ascii accents.
  const c = palette.dot(30, 40) // aged, strong
  const m = c.match(/(\d+),\s*(\d+),\s*(\d+)/)
  if (m) return [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])]
  return [255, 255, 255]
}

function scaleImageData(
  ctx: CanvasRenderingContext2D,
  img: ImageData,
  W: number,
  H: number
): void {
  // Put the small ImageData on a scratch canvas, then draw it upscaled + glowy.
  const s = document.createElement("canvas")
  s.width = PROC_W
  s.height = PROC_H
  const sctx = s.getContext("2d")
  if (!sctx) return
  sctx.putImageData(img, 0, 0)
  ctx.save()
  ctx.imageSmoothingEnabled = true
  ctx.globalCompositeOperation = "lighter"
  ctx.drawImage(s, 0, 0, W, H)
  // a second, blurred pass for glow
  ctx.globalAlpha = 0.5
  ctx.filter = "blur(2px)"
  ctx.drawImage(s, 0, 0, W, H)
  ctx.restore()
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
