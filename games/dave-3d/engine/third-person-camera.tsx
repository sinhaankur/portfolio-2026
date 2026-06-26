"use client"

/**
 * Third-person ORBIT camera — full free-look around Dave. Drag (mouse / touch)
 * orbits yaw + pitch and HOLDS the angle you set (no snap-back to behind), so
 * you can view from any side, overhead, or low. Scroll / pinch zooms. The rig
 * still follows Dave's live position from `game` and keeps the landing-shake +
 * speed-FOV juice.
 */

import { useEffect, useRef } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"
import { game } from "./state"

export function ThirdPersonCamera() {
  const { camera, gl } = useThree()
  const orbitYaw = useRef(0.0)     // free yaw around the player (held, no decay)
  const pitch = useRef(0.5)        // free pitch (held)
  const dist = useRef(9)           // zoom distance (scroll/pinch)
  const dragging = useRef(false)
  const last = useRef({ x: 0, y: 0 })
  const pinch = useRef(0)          // last 2-touch distance
  const tmp = useRef(new THREE.Vector3())
  const lookAt = useRef(new THREE.Vector3())

  const MIN_DIST = 4
  const MAX_DIST = 22
  const PITCH_MIN = -0.35   // allow looking slightly UP from below
  const PITCH_MAX = 1.45    // allow near top-down

  useEffect(() => {
    const el = gl.domElement
    const down = (e: PointerEvent) => {
      dragging.current = true
      last.current = { x: e.clientX, y: e.clientY }
    }
    const move = (e: PointerEvent) => {
      if (!dragging.current) return
      const dx = e.clientX - last.current.x
      const dy = e.clientY - last.current.y
      last.current = { x: e.clientX, y: e.clientY }
      // free orbit: yaw + pitch both held (never decays back behind the player)
      orbitYaw.current -= dx * 0.007
      pitch.current = THREE.MathUtils.clamp(pitch.current + dy * 0.005, PITCH_MIN, PITCH_MAX)
    }
    const up = () => { dragging.current = false }
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      dist.current = THREE.MathUtils.clamp(dist.current + e.deltaY * 0.01, MIN_DIST, MAX_DIST)
    }
    // touch pinch-zoom
    const touchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const a = e.touches[0], b = e.touches[1]
        const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
        if (pinch.current > 0) {
          dist.current = THREE.MathUtils.clamp(dist.current - (d - pinch.current) * 0.03, MIN_DIST, MAX_DIST)
        }
        pinch.current = d
      }
    }
    const touchEnd = () => { pinch.current = 0 }
    el.addEventListener("pointerdown", down)
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
    el.addEventListener("wheel", wheel, { passive: false })
    el.addEventListener("touchmove", touchMove, { passive: true })
    window.addEventListener("touchend", touchEnd)
    return () => {
      el.removeEventListener("pointerdown", down)
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
      el.removeEventListener("wheel", wheel)
      el.removeEventListener("touchmove", touchMove)
      window.removeEventListener("touchend", touchEnd)
    }
  }, [gl])

  useFrame((state, dt) => {
    const target = game.playerPos
    // spherical orbit: full yaw + pitch around the player at the zoom distance,
    // so the camera can sit anywhere on the sphere (any side, overhead, low).
    const d = dist.current
    const cp = Math.cos(pitch.current)
    const desired = tmp.current.set(
      target.x + Math.sin(orbitYaw.current) * cp * d,
      target.y + 1.4 + Math.sin(pitch.current) * d,
      target.z + Math.cos(orbitYaw.current) * cp * d,
    )
    const k = 1 - Math.exp(-8 * dt)
    camera.position.lerp(desired, k)

    // --- juice: a short shake on hard landings (driven by landImpact). ---
    const land = game.landImpact
    if (land > 0.02) {
      const t = state.clock.elapsedTime
      const amp = land * 0.18
      camera.position.y += Math.sin(t * 90) * amp
      camera.position.x += Math.sin(t * 73 + 1.3) * amp * 0.6
    }

    // --- juice: subtle FOV kick with horizontal speed → sense of pace. ---
    const persp = camera as THREE.PerspectiveCamera
    if (persp.isPerspectiveCamera) {
      const targetFov = 55 + Math.min(game.playerSpeed / 7.5, 1) * 7
      const fk = 1 - Math.exp(-5 * dt)
      const next = persp.fov + (targetFov - persp.fov) * fk
      if (Math.abs(next - persp.fov) > 0.01) {
        persp.fov = next
        persp.updateProjectionMatrix()
      }
    }

    // look slightly above the player's feet, with a touch of velocity look-ahead
    lookAt.current.set(target.x, target.y + 1.2, target.z)
    camera.lookAt(lookAt.current)
  })

  return null
}
