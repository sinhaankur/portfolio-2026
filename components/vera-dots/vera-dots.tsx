"use client"

/**
 * VeraDots — a point-cloud orb: dots arranged on a sphere, drawn in a plain 2D
 * canvas (no WebGL, no filters), that animate per PHASE so the orb SAYS what's
 * happening instead of just tinting.
 *
 * Inspired by the open-source "Thinking Orbs" concept (Jakub Antalik, MIT) — the
 * idea that each product state deserves its own distinct orb. This is our own
 * original implementation: a Fibonacci-sphere of points, rotated and perturbed
 * differently for each phase, rendered as depth-shaded dots.
 *
 *   idle       slow rotation, gentle breathe
 *   listening  dots ripple outward in rings (receiving you)
 *   thinking   points scatter + jitter, unsettled, turning it over
 *   speaking   the whole cloud pulses with the voice (level 0..1)
 *
 * Same prop API as <VeraMark /> so it drops into the guide orb and the form
 * switcher. Auto light/dark from the resolved theme. Reduced-motion → a still,
 * themed sphere (no animation), content still present.
 */

import { useEffect, useRef } from "react"
import { useReducedMotion } from "framer-motion"
import { useTheme } from "next-themes"

type Phase = "idle" | "listening" | "thinking" | "speaking" | "searching" | "connecting"

export function VeraDots({
  size = 96,
  active = true,
  phase = "idle",
  level,
  className = "",
}: {
  size?: number
  active?: boolean
  phase?: Phase
  /** 0..1 live voice loudness; pulses the cloud while speaking. */
  level?: number
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()
  const { resolvedTheme } = useTheme()
  // Keep the latest phase/level/theme in refs so the rAF loop reads live values
  // without re-subscribing each frame.
  const stateRef = useRef({ phase, level: level ?? 0, light: false, on: active && !reduce })
  stateRef.current.phase = phase
  stateRef.current.level = level ?? 0
  stateRef.current.on = active && !reduce
  useEffect(() => { stateRef.current.light = resolvedTheme === "light" }, [resolvedTheme])

  // Build the sphere of points ONCE (Fibonacci distribution → even coverage).
  // Point count scales with size so small inline orbs (24–46px) don't turn into
  // a dense blob — fewer, cleaner dots read better tiny; the 64–140px orbs get
  // the full field.
  const pointsRef = useRef<{ x: number; y: number; z: number }[]>([])
  if (pointsRef.current.length === 0) {
    const N = size <= 32 ? 90 : size <= 56 ? 150 : 260
    const pts: { x: number; y: number; z: number }[] = []
    const golden = Math.PI * (3 - Math.sqrt(5))
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2 // 1 → -1
      const r = Math.sqrt(1 - y * y)
      const t = golden * i
      pts.push({ x: Math.cos(t) * r, y, z: Math.sin(t) * r })
    }
    pointsRef.current = pts
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)

    const pts = pointsRef.current
    const cx = size / 2
    const cy = size / 2
    const R = size * 0.40
    let raf = 0
    let t = 0
    const start = performance.now()

    // Per-phase accent — the orb speaks its state in hue. DARK theme uses bright
    // luminous colours (glow on black); LIGHT theme uses deeper, saturated
    // versions of the SAME hues so they read as coloured dots + a soft glow on
    // cream (not flat dull ink). Each theme gets its own alive treatment.
    const tintFor = (phase: Phase, light: boolean): [number, number, number] => {
      if (light) {
        switch (phase) {
          case "listening": return [214, 51, 108]   // deep pink
          case "thinking":  return [108, 74, 214]    // deep violet
          case "searching": return [30, 120, 200]    // deep blue
          case "connecting":return [20, 150, 120]    // deep teal
          case "speaking":  return [200, 110, 20]     // burnt amber
          default:          return [70, 80, 110]      // idle — slate ink-blue
        }
      }
      switch (phase) {
        case "listening": return [255, 120, 180]  // pink — receiving you
        case "thinking":  return [168, 140, 255]  // violet — turning it over
        case "searching": return [120, 200, 255]  // cyan — scanning
        case "connecting":return [120, 230, 190]  // teal — linking
        case "speaking":  return [255, 190, 110]  // amber — voicing
        default:          return [210, 220, 255]   // idle — cool white
      }
    }

    const draw = () => {
      const { phase, level, light, on } = stateRef.current
      t = (performance.now() - start) / 1000

      ctx.clearRect(0, 0, size, size)
      const [tr, tg, tb] = tintFor(phase, light)
      // DARK: lift the tint toward white so dots glow. LIGHT: use the deep tint
      // directly so coloured dots read crisply on cream.
      const dotRGB = light
        ? `${tr},${tg},${tb}`
        : `${Math.round(tr * 0.5 + 128)},${Math.round(tg * 0.5 + 128)},${Math.round(tb * 0.5 + 128)}`

      // GLOW — a soft radial bloom behind the sphere, tinted by the phase, so the
      // orb has luminous presence in BOTH themes. Brighter when active + speaking.
      if (on) {
        const pulse = phase === "speaking" ? 1 + Math.min(1, level) * 0.5 : 1
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.5 * pulse)
        // light mode needs a lighter-touch glow so it doesn't muddy the cream.
        const base = light ? (phase === "idle" ? 0.05 : 0.11) : (phase === "idle" ? 0.1 : 0.2)
        const a = base * pulse
        g.addColorStop(0, `rgba(${tr},${tg},${tb},${a})`)
        g.addColorStop(1, `rgba(${tr},${tg},${tb},0)`)
        ctx.fillStyle = g
        ctx.fillRect(0, 0, size, size)
      }

      // Phase drives: rotation speed, per-point radial perturbation, breathe +
      // the distinct state motions (ripple / jitter / scan sweep / orbit arc).
      let rotSpeed = 0.18
      let breathe = 1
      let jitter = 0
      let ripple = 0
      let scan = 0       // searching: a bright scan band sweeping around
      let orbitArc = 0   // connecting: dots pulled toward an equatorial ring
      if (phase === "listening") { rotSpeed = 0.3; ripple = 1; breathe = 1.03 }
      else if (phase === "thinking") { rotSpeed = 0.7; jitter = 0.2 }
      else if (phase === "searching") { rotSpeed = 0.9; scan = 1 }
      else if (phase === "connecting") { rotSpeed = 0.4; orbitArc = 1 }
      else if (phase === "speaking") { rotSpeed = 0.36; breathe = 1 + Math.min(1, level) * 0.28 }
      else { breathe = 1 + Math.sin(t * 1.0) * 0.02 }

      const ry = on ? t * rotSpeed : 0.6
      const rx = 0.32
      const cosY = Math.cos(ry), sinY = Math.sin(ry)
      const cosX = Math.cos(rx), sinX = Math.sin(rx)

      for (let i = 0; i < pts.length; i++) {
        const { x, y, z } = pts[i]
        let x1 = x * cosY - z * sinY
        const z1 = x * sinY + z * cosY
        let y1 = y * cosX - z1 * sinX
        let z2 = y * sinX + z1 * cosX

        let rad = breathe
        if (jitter) rad += Math.sin(t * 3.4 + i * 0.7) * jitter          // thinking scatter
        if (ripple) rad += Math.sin((y + 1) * 4 - t * 3.2) * 0.1          // listening rings
        if (orbitArc) rad += (1 - Math.abs(y)) * 0.14 * Math.sin(t * 2)   // connecting: equator swells

        x1 *= rad; y1 *= rad; z2 *= rad
        const px = cx + x1 * R
        const py = cy + y1 * R
        const depth = (z2 + 1) / 2
        let dotR = 0.5 + depth * 1.5
        let alpha = 0.16 + depth * 0.74

        // searching: a bright band sweeps around the longitude, lighting dots
        if (scan) {
          const ang = Math.atan2(z, x) // original longitude of this point
          const band = Math.cos(ang - t * 3.5)
          if (band > 0.6) { alpha = Math.min(1, alpha + (band - 0.6) * 2.2); dotR += (band - 0.6) * 2 }
        }

        // GLOW on the front-facing dots so the sphere's near face feels lit —
        // in both themes (lighter blur in light mode so it stays crisp on cream).
        if (depth > 0.72) { ctx.shadowBlur = light ? 2 : 4; ctx.shadowColor = `rgba(${tr},${tg},${tb},${light ? 0.5 : 0.9})` }
        else ctx.shadowBlur = 0

        ctx.beginPath()
        ctx.arc(px, py, dotR, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${dotRGB},${alpha.toFixed(3)})`
        ctx.fill()
      }
      ctx.shadowBlur = 0

      if (on) raf = requestAnimationFrame(draw)
    }

    draw()
    return () => { if (raf) cancelAnimationFrame(raf) }
  }, [size, reduce])

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label="Vera"
      className={className}
      style={{ width: size, height: size, display: "inline-block" }}
    />
  )
}
