"use client"

/**
 * Third-person camera — trails behind + above Dave, smoothly following his live
 * position from `game`. Drag (mouse / touch) orbits the yaw around him; the rig
 * keeps a fixed height + distance with a gentle look-ahead. Pure useFrame, no
 * OrbitControls (we want a follow-cam, not a free orbit).
 */

import { useEffect, useRef } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"
import { game } from "./state"

export function ThirdPersonCamera() {
  const { camera, gl } = useThree()
  const orbitYaw = useRef(0.0)     // user-controlled orbit around the player
  const pitch = useRef(0.5)        // fixed-ish downward tilt
  const dragging = useRef(false)
  const last = useRef({ x: 0, y: 0 })
  const tmp = useRef(new THREE.Vector3())
  const lookAt = useRef(new THREE.Vector3())

  const DIST = 9
  const HEIGHT = 4.5

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
      orbitYaw.current -= dx * 0.006
      pitch.current = THREE.MathUtils.clamp(pitch.current + dy * 0.004, 0.15, 1.1)
    }
    const up = () => { dragging.current = false }
    el.addEventListener("pointerdown", down)
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
    return () => {
      el.removeEventListener("pointerdown", down)
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    }
  }, [gl])

  useFrame((state, dt) => {
    const target = game.playerPos
    // desired camera position: behind by orbitYaw, raised, pulled back by DIST
    const horiz = DIST * Math.cos(pitch.current)
    const desired = tmp.current.set(
      target.x + Math.sin(orbitYaw.current) * horiz,
      target.y + HEIGHT + DIST * Math.sin(pitch.current) * 0.4,
      target.z + Math.cos(orbitYaw.current) * horiz,
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
