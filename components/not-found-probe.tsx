"use client"

import { useEffect, useRef } from "react"

/**
 * The 404 "lost probe" scene — a single self-contained canvas.
 *
 * A small spacecraft drifts through a parallax starfield. Grab it (mouse or
 * touch) and fling it: it has momentum, coasts with a thruster trail, and gently
 * eases back toward centre when let go so it never escapes the frame. Purely
 * decorative and interactive — the real escape links live in the DOM above/below
 * this and remain fully usable if JS or WebGL is unavailable.
 *
 * Deliberately dependency-free (no R3F / three) — this renders on an error page
 * and must stay tiny and instant. Honours prefers-reduced-motion by falling back
 * to a still starfield with a stationary probe.
 */
export function NotFoundProbe() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    const c = cv.getContext("2d")
    if (!c) return
    // Narrowed, non-null aliases — nested function declarations below don't
    // inherit the null-guard narrowing, so bind explicit non-null consts.
    const canvasEl: HTMLCanvasElement = cv
    const context: CanvasRenderingContext2D = c

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

    let width = 0
    let height = 0
    let dpr = Math.min(window.devicePixelRatio || 1, 2)

    // --- Starfield: three parallax layers ---------------------------------
    type Star = { x: number; y: number; z: number; r: number }
    let stars: Star[] = []

    function seedStars() {
      const count = Math.round((width * height) / 6500)
      stars = Array.from({ length: count }, () => {
        const z = Math.random() // depth 0..1 (near..far handled by size)
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          z,
          r: 0.4 + z * 1.4,
        }
      })
    }

    function resize() {
      const rect = canvasEl.getBoundingClientRect()
      width = rect.width
      height = rect.height
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvasEl.width = Math.round(width * dpr)
      canvasEl.height = Math.round(height * dpr)
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      seedStars()
    }

    // --- The probe --------------------------------------------------------
    // Position, velocity, and a "home" it eases toward when released.
    const probe = {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 5, // nose direction, updated from velocity
      thrust: 0, // 0..1 glow intensity, decays over time
    }
    let homeX = 0
    let homeY = 0

    function placeHome() {
      // Home sits a little right-of-centre, vertically centred.
      homeX = width * 0.5
      homeY = height * 0.5
      if (probe.x === 0 && probe.y === 0) {
        probe.x = homeX
        probe.y = homeY
      }
    }

    // Pointer drag state.
    let dragging = false
    let lastPx = 0
    let lastPy = 0
    let pointerX = width / 2
    let pointerY = height / 2

    function pointerPos(e: PointerEvent) {
      const rect = canvasEl.getBoundingClientRect()
      return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }

    function onDown(e: PointerEvent) {
      const p = pointerPos(e)
      pointerX = p.x
      pointerY = p.y
      // Grab if the press lands near the probe; otherwise nudge toward the press.
      const near = Math.hypot(p.x - probe.x, p.y - probe.y) < 60
      if (near) {
        dragging = true
        lastPx = p.x
        lastPy = p.y
        canvasEl.setPointerCapture?.(e.pointerId)
      } else {
        // Fling the probe toward where you tapped.
        const dx = p.x - probe.x
        const dy = p.y - probe.y
        const d = Math.hypot(dx, dy) || 1
        probe.vx += (dx / d) * 3.4
        probe.vy += (dy / d) * 3.4
        probe.thrust = 1
      }
    }

    function onMove(e: PointerEvent) {
      const p = pointerPos(e)
      pointerX = p.x
      pointerY = p.y
      if (!dragging) return
      const nx = p.x - lastPx
      const ny = p.y - lastPy
      probe.x = p.x
      probe.y = p.y
      probe.vx = nx * 0.9
      probe.vy = ny * 0.9
      if (Math.hypot(nx, ny) > 0.5) probe.thrust = 1
      lastPx = p.x
      lastPy = p.y
    }

    function onUp() {
      dragging = false
    }

    // --- Drawing helpers --------------------------------------------------
    function drawProbe() {
      const { x, y, angle, thrust } = probe
      context.save()
      context.translate(x, y)
      context.rotate(angle)

      // Thruster plume behind the craft (points -x in local space).
      if (thrust > 0.02) {
        const len = 14 + thrust * 26
        const grad = context.createLinearGradient(-6, 0, -6 - len, 0)
        grad.addColorStop(0, `rgba(255,180,90,${0.55 * thrust})`)
        grad.addColorStop(0.5, `rgba(255,90,60,${0.35 * thrust})`)
        grad.addColorStop(1, "rgba(255,60,50,0)")
        context.fillStyle = grad
        context.beginPath()
        context.moveTo(-6, -4)
        context.lineTo(-6 - len, 0)
        context.lineTo(-6, 4)
        context.closePath()
        context.fill()
      }

      // Soft glow around the hull.
      const glow = context.createRadialGradient(0, 0, 0, 0, 0, 22)
      glow.addColorStop(0, "rgba(120,200,255,0.30)")
      glow.addColorStop(1, "rgba(120,200,255,0)")
      context.fillStyle = glow
      context.beginPath()
      context.arc(0, 0, 22, 0, Math.PI * 2)
      context.fill()

      // Hull — a small arrow/dart shape.
      context.fillStyle = "#e8eef7"
      context.strokeStyle = "rgba(20,30,50,0.55)"
      context.lineWidth = 1
      context.beginPath()
      context.moveTo(13, 0) // nose
      context.lineTo(-7, -7)
      context.lineTo(-3, 0)
      context.lineTo(-7, 7)
      context.closePath()
      context.fill()
      context.stroke()

      // Cockpit dot.
      context.fillStyle = "#6cc5ff"
      context.beginPath()
      context.arc(3, 0, 2, 0, Math.PI * 2)
      context.fill()

      context.restore()
    }

    // --- Main loop --------------------------------------------------------
    let raf = 0
    let t = 0

    function frame() {
      t += 1
      context.clearRect(0, 0, width, height)

      // Parallax offset from pointer (subtle) — near layers move more.
      const px = (pointerX / width - 0.5) * 2 // -1..1
      const py = (pointerY / height - 0.5) * 2

      // Stars.
      for (const s of stars) {
        const depth = 0.3 + s.z * 0.7
        const ox = reduce ? 0 : px * (1 - s.z) * 14
        const oy = reduce ? 0 : py * (1 - s.z) * 14
        // slow drift for the far field
        const drift = reduce ? 0 : Math.sin(t * 0.002 + s.x) * (1 - s.z) * 0.3
        const sx = s.x + ox + drift
        const sy = s.y + oy
        context.globalAlpha = 0.35 + s.z * 0.55
        context.fillStyle = s.z > 0.75 ? "#bcd4ff" : "#ffffff"
        context.beginPath()
        context.arc(sx, sy, s.r * depth, 0, Math.PI * 2)
        context.fill()
      }
      context.globalAlpha = 1

      if (!reduce) {
        // Physics: when not dragging, coast + ease home + light friction.
        if (!dragging) {
          const hx = homeX - probe.x
          const hy = homeY - probe.y
          probe.vx += hx * 0.0009
          probe.vy += hy * 0.0009
          probe.vx *= 0.985
          probe.vy *= 0.985
          probe.x += probe.vx
          probe.y += probe.vy
        }

        // Keep it inside the frame with a soft bounce.
        const m = 30
        if (probe.x < m) { probe.x = m; probe.vx = Math.abs(probe.vx) * 0.5 }
        if (probe.x > width - m) { probe.x = width - m; probe.vx = -Math.abs(probe.vx) * 0.5 }
        if (probe.y < m) { probe.y = m; probe.vy = Math.abs(probe.vy) * 0.5 }
        if (probe.y > height - m) { probe.y = height - m; probe.vy = -Math.abs(probe.vy) * 0.5 }

        // Face direction of travel when moving enough.
        const speed = Math.hypot(probe.vx, probe.vy)
        if (speed > 0.4) probe.angle = Math.atan2(probe.vy, probe.vx)
        probe.thrust *= 0.94
        if (speed > 1.2) probe.thrust = Math.min(1, probe.thrust + 0.1)
      }

      drawProbe()
      raf = requestAnimationFrame(frame)
    }

    resize()
    placeHome()
    window.addEventListener("resize", () => {
      resize()
      placeHome()
    })
    canvasEl.addEventListener("pointerdown", onDown)
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)

    if (reduce) {
      // One static frame is enough.
      frame()
      cancelAnimationFrame(raf)
      // redraw once more so the probe shows at home
      context.clearRect(0, 0, width, height)
      for (const s of stars) {
        context.globalAlpha = 0.35 + s.z * 0.55
        context.fillStyle = s.z > 0.75 ? "#bcd4ff" : "#ffffff"
        context.beginPath()
        context.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        context.fill()
      }
      context.globalAlpha = 1
      drawProbe()
    } else {
      raf = requestAnimationFrame(frame)
    }

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", resize)
      canvasEl.removeEventListener("pointerdown", onDown)
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 h-full w-full touch-none"
      style={{ cursor: "grab" }}
    />
  )
}
