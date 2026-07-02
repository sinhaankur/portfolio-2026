/**
 * flow-core.ts — Shi-Tomasi feature detection + Lucas-Kanade optical flow,
 * ported to plain TypeScript so the whole thing runs client-side in the
 * browser (no OpenCV, no WASM, no server — static-export safe).
 *
 * The two classic algorithms, exactly as named in the reference:
 *
 *   1. Shi-Tomasi "Good Features to Track" — at each pixel, build the 2×2
 *      structure tensor of image gradients over a small window; its smaller
 *      eigenvalue (min(λ1, λ2)) scores how "corner-like" the spot is. Keep the
 *      strongest, spaced out by a minimum distance. These are the DOTS.
 *
 *   2. Lucas-Kanade optical flow (pyramidal) — for each tracked point, assume
 *      the local window moves by a single (dx, dy) between frames and solve the
 *      2×2 normal equations for that motion. Coarse-to-fine over an image
 *      pyramid so we catch large motions too. This MOVES the dots smoothly.
 *
 * Everything operates on single-channel (grayscale) Float32 images derived from
 * the video frame, mirroring the NumPy-array workflow of the original.
 */

export type GrayImage = {
  data: Float32Array // length w*h, luminance 0..255
  width: number
  height: number
}

export type FeaturePoint = {
  x: number
  y: number
  /** Frames this point has survived — drives fade-in + colour age. */
  age: number
  /** Shi-Tomasi corner score at birth, for sizing/alpha. */
  strength: number
}

/** Pull a grayscale Float32 image out of RGBA ImageData (luminance weights). */
export function toGray(src: ImageData): GrayImage {
  const { data, width, height } = src
  const out = new Float32Array(width * height)
  for (let i = 0, p = 0; i < out.length; i++, p += 4) {
    // Rec. 601 luma — same weighting OpenCV uses by default.
    out[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]
  }
  return { data: out, width, height }
}

/** Separable 3-tap Gaussian blur (smooths gradients before corner scoring). */
export function blur(img: GrayImage): GrayImage {
  const { data, width: w, height: h } = img
  const tmp = new Float32Array(w * h)
  const out = new Float32Array(w * h)
  // horizontal
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const l = x > 0 ? data[i - 1] : data[i]
      const r = x < w - 1 ? data[i + 1] : data[i]
      tmp[i] = 0.25 * l + 0.5 * data[i] + 0.25 * r
    }
  }
  // vertical
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const u = y > 0 ? tmp[i - w] : tmp[i]
      const d = y < h - 1 ? tmp[i + w] : tmp[i]
      out[i] = 0.25 * u + 0.5 * tmp[i] + 0.25 * d
    }
  }
  return { data: out, width: w, height: h }
}

/** Sobel-ish central-difference gradients. */
function gradients(img: GrayImage): { gx: Float32Array; gy: Float32Array } {
  const { data, width: w, height: h } = img
  const gx = new Float32Array(w * h)
  const gy = new Float32Array(w * h)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      gx[i] = (data[i + 1] - data[i - 1]) * 0.5
      gy[i] = (data[i + w] - data[i - w]) * 0.5
    }
  }
  return { gx, gy }
}

/**
 * Shi-Tomasi corner detection.
 * Returns up to `maxCorners` points, each separated by `minDistance` px,
 * with corner score ≥ qualityLevel × (best score).
 */
export function shiTomasi(
  img: GrayImage,
  opts: {
    maxCorners: number
    qualityLevel: number // 0..1, fraction of the strongest corner
    minDistance: number // px between accepted corners
    blockSize?: number // window radius for the structure tensor
  }
): FeaturePoint[] {
  const { width: w, height: h } = img
  const block = opts.blockSize ?? 3
  const { gx, gy } = gradients(img)

  // min-eigenvalue of the windowed structure tensor at each pixel.
  const score = new Float32Array(w * h)
  let maxScore = 0
  for (let y = block; y < h - block; y++) {
    for (let x = block; x < w - block; x++) {
      let sxx = 0
      let syy = 0
      let sxy = 0
      for (let wy = -block; wy <= block; wy++) {
        for (let wx = -block; wx <= block; wx++) {
          const j = (y + wy) * w + (x + wx)
          const ix = gx[j]
          const iy = gy[j]
          sxx += ix * ix
          syy += iy * iy
          sxy += ix * iy
        }
      }
      // min eigenvalue of [[sxx, sxy],[sxy, syy]]
      const t = sxx + syy
      const d = sxx * syy - sxy * sxy
      const disc = Math.sqrt(Math.max(0, (t * t) / 4 - d))
      const minEig = t / 2 - disc
      score[y * w + x] = minEig
      if (minEig > maxScore) maxScore = minEig
    }
  }

  const thresh = maxScore * opts.qualityLevel
  // Collect candidates above threshold.
  const cands: FeaturePoint[] = []
  for (let y = block; y < h - block; y++) {
    for (let x = block; x < w - block; x++) {
      const s = score[y * w + x]
      if (s >= thresh && s > 0) cands.push({ x, y, age: 0, strength: s })
    }
  }
  cands.sort((a, b) => b.strength - a.strength)

  // Greedy non-max suppression by minimum distance (grid-accelerated).
  const cell = Math.max(1, opts.minDistance)
  const cols = Math.ceil(w / cell)
  const grid = new Map<number, FeaturePoint[]>()
  const accepted: FeaturePoint[] = []
  const minD2 = opts.minDistance * opts.minDistance
  for (const c of cands) {
    if (accepted.length >= opts.maxCorners) break
    const cx = Math.floor(c.x / cell)
    const cy = Math.floor(c.y / cell)
    let tooClose = false
    for (let dy = -1; dy <= 1 && !tooClose; dy++) {
      for (let dx = -1; dx <= 1 && !tooClose; dx++) {
        const bucket = grid.get((cy + dy) * cols + (cx + dx))
        if (!bucket) continue
        for (const p of bucket) {
          const ddx = p.x - c.x
          const ddy = p.y - c.y
          if (ddx * ddx + ddy * ddy < minD2) {
            tooClose = true
            break
          }
        }
      }
    }
    if (tooClose) continue
    accepted.push(c)
    const key = cy * cols + cx
    const bucket = grid.get(key)
    if (bucket) bucket.push(c)
    else grid.set(key, [c])
  }
  return accepted
}

/** Bilinear sample of a grayscale image (sub-pixel). */
function sample(img: GrayImage, x: number, y: number): number {
  const { data, width: w, height: h } = img
  if (x < 0) x = 0
  if (y < 0) y = 0
  if (x > w - 1) x = w - 1
  if (y > h - 1) y = h - 1
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = Math.min(x0 + 1, w - 1)
  const y1 = Math.min(y0 + 1, h - 1)
  const fx = x - x0
  const fy = y - y0
  const a = data[y0 * w + x0]
  const b = data[y0 * w + x1]
  const c = data[y1 * w + x0]
  const d = data[y1 * w + x1]
  return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy
}

/** Half-resolution downsample (one pyramid level down), 2×2 box. */
export function downsample(img: GrayImage): GrayImage {
  const w = img.width >> 1
  const h = img.height >> 1
  const out = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = x << 1
      const sy = y << 1
      const i = sy * img.width + sx
      out[y * w + x] =
        0.25 * (img.data[i] + img.data[i + 1] + img.data[i + img.width] + img.data[i + img.width + 1])
    }
  }
  return { data: out, width: w, height: h }
}

/** Build a small image pyramid (level 0 = full res). */
export function buildPyramid(img: GrayImage, levels: number): GrayImage[] {
  const pyr = [img]
  for (let l = 1; l < levels; l++) {
    const prev = pyr[l - 1]
    if (prev.width < 16 || prev.height < 16) break
    pyr.push(downsample(prev))
  }
  return pyr
}

/**
 * Pyramidal Lucas-Kanade — track one point from prev → next.
 * Returns the new (x, y) and whether tracking is considered valid.
 */
function trackPoint(
  prevPyr: GrayImage[],
  nextPyr: GrayImage[],
  px: number,
  py: number,
  win: number,
  iters: number
): { x: number; y: number; ok: boolean } {
  const levels = Math.min(prevPyr.length, nextPyr.length)
  let gx = 0
  let gy = 0 // accumulated flow, in full-res px (carried down the pyramid)

  for (let l = levels - 1; l >= 0; l--) {
    const scale = 1 / (1 << l)
    const prev = prevPyr[l]
    const next = nextPyr[l]
    const x = px * scale
    const y = py * scale
    let vx = gx * scale
    let vy = gy * scale

    for (let it = 0; it < iters; it++) {
      // Build the 2×2 spatial-gradient matrix G and mismatch vector b over the
      // window, then solve G·[dvx,dvy]ᵀ = b (the LK normal equations).
      let sxx = 0
      let syy = 0
      let sxy = 0
      let bx = 0
      let by = 0
      for (let wy = -win; wy <= win; wy++) {
        for (let wx = -win; wx <= win; wx++) {
          const ax = x + wx
          const ay = y + wy
          // Temporal difference: next (shifted by current flow guess) − prev.
          const it0 = sample(next, ax + vx, ay + vy) - sample(prev, ax, ay)
          // Spatial gradients of prev at this window pixel — these populate both
          // the structure matrix G and the mismatch vector b (the LK equations).
          const gix = (sample(prev, ax + 1, ay) - sample(prev, ax - 1, ay)) * 0.5
          const giy = (sample(prev, ax, ay + 1) - sample(prev, ax, ay - 1)) * 0.5
          sxx += gix * gix
          syy += giy * giy
          sxy += gix * giy
          bx += -gix * it0
          by += -giy * it0
        }
      }
      const det = sxx * syy - sxy * sxy
      if (Math.abs(det) < 1e-6) break
      const dvx = (syy * bx - sxy * by) / det
      const dvy = (sxx * by - sxy * bx) / det
      vx += dvx
      vy += dvy
      if (dvx * dvx + dvy * dvy < 0.0009) break // converged (<0.03 px)
    }
    // promote this level's flow to full-res for the next finer level
    gx = vx / scale
    gy = vy / scale
  }

  const nx = px + gx
  const ny = py + gy
  const w0 = prevPyr[0].width
  const h0 = prevPyr[0].height
  const ok = nx >= 0 && ny >= 0 && nx < w0 && ny < h0 && Math.hypot(gx, gy) < Math.max(w0, h0)
  return { x: nx, y: ny, ok }
}

/** Track a whole set of points prev → next, dropping the ones that fail. */
export function trackPoints(
  prevPyr: GrayImage[],
  nextPyr: GrayImage[],
  points: FeaturePoint[],
  opts: { winSize?: number; iters?: number } = {}
): FeaturePoint[] {
  const win = opts.winSize ?? 7
  const iters = opts.iters ?? 8
  const out: FeaturePoint[] = []
  for (const p of points) {
    const r = trackPoint(prevPyr, nextPyr, p.x, p.y, win, iters)
    if (r.ok) out.push({ x: r.x, y: r.y, age: p.age + 1, strength: p.strength })
  }
  return out
}
