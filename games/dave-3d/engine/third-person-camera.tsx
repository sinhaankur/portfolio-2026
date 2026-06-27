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
  // Free-orbit 3rd-person. Default sits the camera BEHIND Dave on +Z (yaw 0),
  // looking along -Z at the side-on level, with a gentle downward pitch. Drag
  // orbits yaw+pitch and HOLDS the angle; scroll/pinch zooms.
  const orbitYaw = useRef(0)       // free yaw around the player (held, no decay)
  const pitch = useRef(0.32)       // free pitch (held)
  const dist = useRef(12)          // zoom distance (scroll/pinch)
  const dragging = useRef(false)
  const last = useRef({ x: 0, y: 0 })
  const pinch = useRef(0)          // last 2-touch distance
  const tmp = useRef(new THREE.Vector3())
  const lookAt = useRef(new THREE.Vector3())
  // On side-on Dave screens we START with a flat, straight-on view that frames the
  // WHOLE room (1:1 with the original). The moment the user drags/zooms, we hand
  // over to the free-orbit follow camera so they can explore in 3D.
  const userTookControl = useRef(false)

  const MIN_DIST = 5
  const MAX_DIST = 28
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
      if (!userTookControl.current && (Math.abs(dx) > 1 || Math.abs(dy) > 1)) takeControl()
      // free orbit: yaw + pitch both held (never decays back behind the player)
      orbitYaw.current -= dx * 0.007
      pitch.current = THREE.MathUtils.clamp(pitch.current + dy * 0.005, PITCH_MIN, PITCH_MAX)
    }
    const up = () => { dragging.current = false }
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      takeControl()
      dist.current = THREE.MathUtils.clamp(dist.current + e.deltaY * 0.01, MIN_DIST, MAX_DIST)
    }
    // touch pinch-zoom
    const touchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const a = e.touches[0], b = e.touches[1]
        const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
        if (pinch.current > 0) {
          takeControl()
          dist.current = THREE.MathUtils.clamp(dist.current - (d - pinch.current) * 0.03, MIN_DIST, MAX_DIST)
        }
        pinch.current = d
      }
    }
    // First interaction on a side level: switch from flat framing to free-orbit,
    // seeding the orbit so it starts roughly where the flat view was (no jump).
    const takeControl = () => {
      if (userTookControl.current) return
      userTookControl.current = true
      orbitYaw.current = 0
      pitch.current = 0.12
      dist.current = Math.min(MAX_DIST, Math.max(MIN_DIST, game.boundsH * 0.9))
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

    // ── SIDE-ON default: a FLAT, straight-on view that frames the whole room 1:1
    //    with the original (no tilt). Camera dead-on +Z, centred; for rooms wider
    //    than a screen it pans horizontally to follow Dave. Until the user drags. ─
    if (game.sideOn && !userTookControl.current) {
      const persp = camera as THREE.PerspectiveCamera
      const fov = 52
      if (persp.isPerspectiveCamera && Math.abs(persp.fov - fov) > 0.05) {
        persp.fov = fov; persp.updateProjectionMatrix()
      }
      const aspect = persp.isPerspectiveCamera ? persp.aspect : 16 / 9
      const W = game.boundsW, H = game.boundsH
      const vFov = (fov * Math.PI) / 180
      const SCREEN_W = 30
      const showW = Math.min(W, SCREEN_W)
      const distH = (H / 2) / Math.tan(vFov / 2)
      const distW = (showW / 2) / (Math.tan(vFov / 2) * aspect)
      const fitDist = Math.max(distH, distW) * 1.04
      const viewW = 2 * Math.tan(vFov / 2) * aspect * fitDist
      const camX = W > viewW + 1
        ? THREE.MathUtils.clamp(target.x, -W / 2 + viewW / 2, W / 2 - viewW / 2)
        : 0
      const camY = H / 2 - 1.0
      camera.position.lerp(tmp.current.set(camX, camY, fitDist), 1 - Math.exp(-7 * dt))
      lookAt.current.set(camX, camY, 0)
      camera.lookAt(lookAt.current)
      return
    }

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
