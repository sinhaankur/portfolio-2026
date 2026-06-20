"use client"

/**
 * Player — Dave (dave.glb) as a kinematic 3rd-person platformer character.
 *
 * Movement is camera-relative (push "forward" → move away from the camera).
 * Physics: gravity + a simple, robust collision resolve against the level's
 * platform boxes (AABB, axis-separated), with the crisp jump feel tuned in the 2D
 * version (coyote-time + jump-buffer + variable height). Writes its live position
 * + yaw into `game` so the camera + world (collection) can read it.
 */

import { useEffect, useMemo, useRef } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { useGLTF } from "@react-three/drei"
import * as THREE from "three"
import { LEVEL_1, type Level, type Box } from "./level"
import { input, tickInput } from "./controls"
import { game } from "./state"

const MODEL = "/models/dave.glb"
useGLTF.preload(MODEL)

// tuned feel (mirrors the 2D version's Dave-feel)
const GRAVITY = 26
const MOVE_SPEED = 7.5
const ACCEL = 60          // ground responsiveness
const JUMP_V = 11
const COYOTE = 0.1        // s after leaving ground you can still jump
const BUFFER = 0.12       // s a jump press is remembered
const JUMP_CUT = 0.5      // releasing jump while rising cuts velocity
const RADIUS = 0.45       // player half-width (x/z)
const HEIGHT = 1.9        // player full height (feet→head)

// AABB overlap between the player and a box. The player's feet are at `py`, so
// the player occupies the vertical span [py, py + HEIGHT]; the box occupies
// [by - sy/2, by + sy/2]. Standard interval overlap on all three axes.
function aabbOverlap(px: number, py: number, pz: number, b: Box): boolean {
  const [bx, by, bz] = b.pos
  const [sx, sy, sz] = b.size
  const footTop = py + HEIGHT
  const boxBottom = by - sy / 2
  const boxTop = by + sy / 2
  return (
    Math.abs(px - bx) < RADIUS + sx / 2 &&
    py < boxTop && footTop > boxBottom &&   // vertical spans overlap
    Math.abs(pz - bz) < RADIUS + sz / 2
  )
}

export function Player({ level = LEVEL_1 }: { level?: Level }) {
  const { scene } = useGLTF(MODEL)
  const model = useMemo(() => scene.clone(), [scene])
  const ref = useRef<THREE.Group>(null)
  const camera = useThree((s) => s.camera)

  const vel = useRef(new THREE.Vector3())
  const pos = useRef(new THREE.Vector3(...level.spawn))
  const onGround = useRef(false)
  const coyote = useRef(0)
  const buffer = useRef(0)
  const yaw = useRef(0)

  // reset to spawn when the level/restart changes
  useEffect(() => {
    pos.current.set(...level.spawn)
    vel.current.set(0, 0, 0)
  }, [level])

  useFrame((_, dtRaw) => {
    if (game.phase !== "playing") { tickInput(); return }
    const dt = Math.min(dtRaw, 1 / 30) // clamp big frames so physics stays stable
    const p = pos.current
    const v = vel.current

    // --- camera-relative input → desired horizontal velocity ---
    const camDir = new THREE.Vector3()
    camera.getWorldDirection(camDir)
    camDir.y = 0
    if (camDir.lengthSq() < 1e-4) camDir.set(0, 0, -1)
    camDir.normalize()
    const camRight = new THREE.Vector3().crossVectors(camDir, new THREE.Vector3(0, 1, 0)).normalize()

    const wish = new THREE.Vector3()
    if (input.forward) wish.add(camDir)
    if (input.back) wish.sub(camDir)
    if (input.right) wish.add(camRight)
    if (input.left) wish.sub(camRight)
    const moving = wish.lengthSq() > 1e-4
    if (moving) wish.normalize().multiplyScalar(MOVE_SPEED)

    // accelerate horizontal velocity toward the wish velocity (snappy, frame-rate
    // independent). One exponential approach — not two fighting each other.
    const k = 1 - Math.exp(-(ACCEL / MOVE_SPEED) * dt)
    v.x += (wish.x - v.x) * k
    v.z += (wish.z - v.z) * k

    // --- jump: coyote + buffer + variable height ---
    if (onGround.current) coyote.current = COYOTE
    else coyote.current = Math.max(0, coyote.current - dt)
    if (input.jumpPressed) buffer.current = BUFFER
    else buffer.current = Math.max(0, buffer.current - dt)
    if (buffer.current > 0 && coyote.current > 0) {
      v.y = JUMP_V
      onGround.current = false
      coyote.current = 0
      buffer.current = 0
    }
    if (!input.jump && v.y > 0) v.y *= JUMP_CUT > 0 ? Math.pow(JUMP_CUT, dt * 60) : 1

    // gravity
    v.y -= GRAVITY * dt
    if (v.y < -40) v.y = -40

    // --- integrate + collide, axis-separated against platforms ---
    // X
    p.x += v.x * dt
    for (const b of level.platforms) {
      if (aabbOverlap(p.x, p.y, p.z, b)) {
        const [bx, , ] = b.pos; const sx = b.size[0]
        p.x = bx + Math.sign(p.x - bx) * (sx / 2 + RADIUS)
        v.x = 0
      }
    }
    // Z
    p.z += v.z * dt
    for (const b of level.platforms) {
      if (aabbOverlap(p.x, p.y, p.z, b)) {
        const [, , bz] = b.pos; const sz = b.size[2]
        p.z = bz + Math.sign(p.z - bz) * (sz / 2 + RADIUS)
        v.z = 0
      }
    }
    // Y
    p.y += v.y * dt
    onGround.current = false
    for (const b of level.platforms) {
      if (aabbOverlap(p.x, p.y, p.z, b)) {
        const [, by] = b.pos; const sy = b.size[1]
        if (v.y <= 0) {
          // landing on top
          p.y = by + sy / 2
          v.y = 0
          onGround.current = true
        } else {
          // bonk head
          p.y = by - sy / 2 - HEIGHT
          v.y = 0
        }
      }
    }

    // fell off → respawn
    if (p.y < level.killY) {
      p.set(...level.spawn)
      v.set(0, 0, 0)
    }

    // face movement direction
    if (moving) {
      const target = Math.atan2(v.x, v.z)
      let d = target - yaw.current
      while (d > Math.PI) d -= Math.PI * 2
      while (d < -Math.PI) d += Math.PI * 2
      yaw.current += d * (1 - Math.exp(-14 * dt))
    }

    // commit to the transform + shared state
    if (ref.current) {
      ref.current.position.copy(p)
      ref.current.rotation.y = yaw.current
    }
    game.playerPos.copy(p)
    game.playerYaw = yaw.current

    tickInput()
  })

  return (
    <group ref={ref}>
      {/* dave.glb origin is at feet; scale to ~1.7 units tall (model is ~2.4) */}
      <primitive object={model} scale={0.72} />
    </group>
  )
}
