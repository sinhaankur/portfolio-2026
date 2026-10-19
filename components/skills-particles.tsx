"use client"

/**
 * SkillParticles — each skill's visual as a POINT-CLOUD that forms its motif.
 *
 * Exploration ("skills AS particles"): instead of a static SVG, each skill tile
 * is a 2D-canvas particle system whose points settle into the shape that
 * represents the skill (a spiral galaxy, a neural net, a decision tree, …) and
 * drift gently — the dotted-orb aesthetic scaled to the skills page. On hover
 * the particles energise (faster drift + brighter).
 *
 * Lightweight: plain canvas, ~90–140 points, one rAF loop, pauses offscreen,
 * reduced-motion → a still formed shape. Monochrome cream + a hot-accent subset
 * (matches the gallery palette).
 */

import { useEffect, useRef } from "react"

const ACCENT = "#fb4e2b"
const CREAM = "255,229,213"

type Pt = { tx: number; ty: number; x: number; y: number; vx: number; vy: number; hot: boolean; r: number }

// Each shape returns target points in a 0..1 box (x right, y down).
function shapeFor(motif: string, n: number): { x: number; y: number; hot: boolean }[] {
  const out: { x: number; y: number; hot: boolean }[] = []
  const rnd = mulberry32(hashStr(motif))
  switch (motif) {
    case "graphics": { // spiral galaxy
      for (let i = 0; i < n; i++) {
        const t = i / n
        const arm = i % 2
        const r = t * 0.42
        const ang = r * 10 + arm * Math.PI + (rnd() - 0.5) * 0.6
        out.push({ x: 0.5 + Math.cos(ang) * r, y: 0.5 + Math.sin(ang) * r * 0.62, hot: rnd() < 0.16 })
      }
      break
    }
    case "ai": { // neural net — 3 columns of nodes + scatter along edges
      const cols = [0.22, 0.5, 0.78]
      const rows = [[0.28, 0.5, 0.72], [0.36, 0.64], [0.4, 0.6]]
      let placed = 0
      cols.forEach((cx, ci) => rows[ci].forEach((cy) => { out.push({ x: cx, y: cy, hot: ci === 1 }); placed++ }))
      for (let i = placed; i < n; i++) out.push({ x: 0.2 + rnd() * 0.6, y: 0.25 + rnd() * 0.5, hot: rnd() < 0.2 })
      break
    }
    case "strategy": { // decision tree → one lit node
      for (let i = 0; i < n; i++) {
        if (i < n * 0.25) out.push({ x: 0.16, y: 0.2 + (i / (n * 0.25)) * 0.6, hot: false })
        else if (i > n * 0.85) out.push({ x: 0.78 + (rnd() - 0.5) * 0.08, y: 0.5 + (rnd() - 0.5) * 0.08, hot: true })
        else { const t = rnd(); out.push({ x: 0.16 + t * 0.62, y: 0.2 + rnd() * 0.6 + (0.5 - (0.2 + rnd() * 0.6)) * t, hot: false }) }
      }
      break
    }
    case "math": { // epicycle → wave
      for (let i = 0; i < n; i++) {
        if (i < n * 0.4) { const a = rnd() * Math.PI * 2; const r = 0.1 + rnd() * 0.14; out.push({ x: 0.28 + Math.cos(a) * r, y: 0.5 + Math.sin(a) * r, hot: false }) }
        else { const t = (i - n * 0.4) / (n * 0.6); out.push({ x: 0.4 + t * 0.52, y: 0.5 + Math.sin(t * Math.PI * 3) * 0.22, hot: t > 0.5 }) }
      }
      break
    }
    case "product": { // value/constraint curve — an S-curve rising, one lit point
      for (let i = 0; i < n; i++) {
        const t = i / n
        const x = 0.14 + t * 0.72
        const y = 0.76 - (1 / (1 + Math.exp(-(t - 0.5) * 9))) * 0.52
        out.push({ x: x + (rnd() - 0.5) * 0.03, y: y + (rnd() - 0.5) * 0.03, hot: Math.abs(t - 0.5) < 0.06 })
      }
      break
    }
    case "framework": { // a connected lattice / node graph
      const nodes = [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7], [0.5, 0.18], [0.5, 0.82], [0.5, 0.5]]
      for (let i = 0; i < n; i++) {
        if (i < nodes.length) out.push({ x: nodes[i][0], y: nodes[i][1], hot: i === nodes.length - 1 })
        else { // scatter along edges toward the centre node
          const nd = nodes[Math.floor(rnd() * (nodes.length - 1))]; const t = rnd()
          out.push({ x: nd[0] + (0.5 - nd[0]) * t, y: nd[1] + (0.5 - nd[1]) * t, hot: false })
        }
      }
      break
    }
    case "ia": { // nested hierarchy — stacked rows of boxes narrowing down
      const rows = [[0.5, 0.2, 0.62], [0.32, 0.4, 0.26], [0.68, 0.4, 0.26], [0.4, 0.62, 0.16], [0.6, 0.62, 0.16]]
      for (let i = 0; i < n; i++) {
        const [cx, cy, w] = rows[i % rows.length]
        out.push({ x: cx + (rnd() - 0.5) * w, y: cy + (rnd() - 0.5) * 0.05, hot: i % rows.length === 0 && rnd() < 0.5 })
      }
      break
    }
    case "interaction": { // state machine — 3 nodes in a row + transitions
      const st = [[0.22, 0.5], [0.5, 0.5], [0.78, 0.5]]
      for (let i = 0; i < n; i++) {
        if (i < n * 0.5) { const s = st[i % 3]; const a = rnd() * Math.PI * 2; const r = rnd() * 0.08; out.push({ x: s[0] + Math.cos(a) * r, y: s[1] + Math.sin(a) * r, hot: i % 3 === 1 }) }
        else { const seg = rnd() < 0.5 ? 0 : 1; const t = rnd(); out.push({ x: st[seg][0] + (st[seg + 1][0] - st[seg][0]) * t, y: 0.5, hot: false }) }
      }
      break
    }
    case "system": { // a grid of tokens, one lit
      const cols = 6, rowsN = 4
      for (let i = 0; i < n; i++) {
        const c = i % cols, r = Math.floor(i / cols) % rowsN
        out.push({ x: 0.16 + (c / (cols - 1)) * 0.68, y: 0.22 + (r / (rowsN - 1)) * 0.56, hot: c === 3 && r === 1 })
      }
      break
    }
    case "usability": { // a checklist — rows with a check mark, measured bars
      for (let i = 0; i < n; i++) {
        const row = i % 4
        const y = 0.22 + row * 0.19
        const t = rnd()
        out.push({ x: 0.2 + t * (row < 3 ? 0.62 : 0.4), y: y + (rnd() - 0.5) * 0.02, hot: row < 3 && t < 0.12 })
      }
      break
    }
    case "frontend": { // code brackets </> + a rendered frame
      for (let i = 0; i < n; i++) {
        if (i < n * 0.5) { // bracket chevrons on the left
          const t = (i % (n * 0.25)) / (n * 0.25); const left = i < n * 0.25
          const x = left ? 0.18 + Math.abs(t - 0.5) * 0.14 : 0.42 - Math.abs(t - 0.5) * 0.14
          out.push({ x, y: 0.28 + t * 0.44, hot: false })
        } else { // the frame on the right
          const t = rnd(); const edge = rnd() < 0.5
          out.push({ x: edge ? (rnd() < 0.5 ? 0.56 : 0.86) : 0.56 + t * 0.3, y: edge ? 0.3 + rnd() * 0.4 : (rnd() < 0.5 ? 0.3 : 0.7), hot: rnd() < 0.08 })
        }
      }
      break
    }
    case "facilitation": { // three parties converging on one point
      const corners = [[0.2, 0.25], [0.2, 0.75], [0.84, 0.5]]
      for (let i = 0; i < n; i++) {
        if (i < 3) out.push({ x: corners[i][0], y: corners[i][1], hot: false })
        else if (i > n * 0.9) out.push({ x: 0.5 + (rnd() - 0.5) * 0.06, y: 0.5 + (rnd() - 0.5) * 0.06, hot: true })
        else { const c = corners[Math.floor(rnd() * 3)]; const t = rnd(); out.push({ x: c[0] + (0.5 - c[0]) * t, y: c[1] + (0.5 - c[1]) * t, hot: false }) }
      }
      break
    }
    case "research": { // a climbing bar chart
      const bars = [[0.3, 0.4], [0.46, 0.55], [0.62, 0.3], [0.78, 0.18]]
      for (let i = 0; i < n; i++) {
        const [bx, h] = bars[i % bars.length]
        out.push({ x: bx + (rnd() - 0.5) * 0.05, y: 0.82 - rnd() * (0.82 - h), hot: i % bars.length === 3 })
      }
      break
    }
    case "inclusive": { // large 'Aa' letterforms + a focus ring (as a dotted frame)
      for (let i = 0; i < n; i++) {
        if (i < n * 0.55) { const a = rnd() * Math.PI * 2; const r = 0.12 + rnd() * 0.12; out.push({ x: 0.36 + Math.cos(a) * r * 0.7, y: 0.5 + Math.sin(a) * r, hot: false }) } // Aa cluster
        else { // dashed focus ring around it
          const a = (i / n) * Math.PI * 2 * 3
          out.push({ x: 0.36 + Math.cos(a) * 0.3, y: 0.5 + Math.sin(a) * 0.36, hot: i % 3 === 0 })
        }
      }
      break
    }
    default: { // generic: a soft dotted disc
      for (let i = 0; i < n; i++) { const a = rnd() * Math.PI * 2; const r = Math.sqrt(rnd()) * 0.4; out.push({ x: 0.5 + Math.cos(a) * r, y: 0.5 + Math.sin(a) * r, hot: rnd() < 0.14 }) }
    }
  }
  return out.slice(0, n)
}

export function SkillParticles({ motif, className = "" }: { motif: string; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const hoverRef = useRef(false)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const g = ctx // non-null alias for the nested rAF closure
    const parent = canvas.parentElement!
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    let W = 0, H = 0; const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const N = 120
    let pts: Pt[] = []

    const layout = () => {
      W = parent.clientWidth; H = parent.clientHeight
      canvas.width = W * dpr; canvas.height = H * dpr
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      const targets = shapeFor(motif, N)
      pts = targets.map((t) => ({
        tx: t.x * W, ty: t.y * H,
        x: Math.random() * W, y: Math.random() * H,
        vx: 0, vy: 0, hot: t.hot, r: t.hot ? 1.6 : 0.9 + Math.random() * 0.5,
      }))
    }
    layout()

    let raf = 0, t = 0, visible = true
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !raf) raf = requestAnimationFrame(draw) }, { threshold: 0 })
    io.observe(parent)

    function draw() {
      if (!visible) { raf = 0; return }
      t += 0.016
      g.clearRect(0, 0, W, H)
      const energy = hoverRef.current ? 1.8 : 1
      for (const p of pts) {
        // spring toward the target + gentle idle drift
        const driftX = Math.sin(t * 0.8 + p.tx) * 1.2 * energy
        const driftY = Math.cos(t * 0.7 + p.ty) * 1.2 * energy
        const ax = (p.tx + driftX - p.x) * 0.06
        const ay = (p.ty + driftY - p.y) * 0.06
        p.vx = (p.vx + ax) * 0.82
        p.vy = (p.vy + ay) * 0.82
        if (!reduce) { p.x += p.vx; p.y += p.vy } else { p.x = p.tx; p.y = p.ty }
        g.beginPath()
        g.arc(p.x, p.y, p.r * (hoverRef.current ? 1.25 : 1), 0, Math.PI * 2)
        g.fillStyle = p.hot ? ACCENT : `rgba(${CREAM},${0.5 + (p.hot ? 0.4 : 0.25)})`
        g.fill()
      }
      if (!reduce) raf = requestAnimationFrame(draw)
    }
    draw()

    const ro = new ResizeObserver(layout)
    ro.observe(parent)
    const onEnter = () => { hoverRef.current = true; if (!raf && visible) raf = requestAnimationFrame(draw) }
    const onLeave = () => { hoverRef.current = false }
    parent.addEventListener("pointerenter", onEnter)
    parent.addEventListener("pointerleave", onLeave)

    return () => {
      if (raf) cancelAnimationFrame(raf)
      io.disconnect(); ro.disconnect()
      parent.removeEventListener("pointerenter", onEnter)
      parent.removeEventListener("pointerleave", onLeave)
    }
  }, [motif])

  return <canvas ref={ref} aria-hidden className={`absolute inset-0 h-full w-full ${className}`} />
}

// tiny seeded RNG so each motif's scatter is stable
function hashStr(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }
function mulberry32(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
