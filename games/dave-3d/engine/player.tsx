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
import { SkeletonUtils } from "three-stdlib"
import * as THREE from "three"
import { LEVEL_1, type Level, type Hazard } from "./level"
import { input, tickInput } from "./controls"
import { game } from "./state"

const DAVE_GLB = "/models/dave/dave.glb"
useGLTF.preload(DAVE_GLB)

// tuned platformer feel (crisp jump: coyote-time + jump-buffer + variable height)
// JUMP CONTRACT: apex = JUMP_V²/(2·GRAVITY) ≈ 3.41 world units = 2.4 tiles, so a
// 2-row climb (2.8u — every ledge step in level.ts) clears with ~0.6u of margin,
// matching the original Dave's two-tile jump. Change these together or levels
// become unbeatable — scripts/validate-dave-levels.ts guards the pairing.
const GRAVITY = 30
const MOVE_SPEED = 7.5
const ACCEL = 60          // ground responsiveness
const JUMP_V = 14.3
const COYOTE = 0.1        // s after leaving ground you can still jump
const BUFFER = 0.12       // s a jump press is remembered
const JUMP_CUT = 0.5      // releasing jump while rising cuts velocity
const RADIUS = 0.38       // player half-width (x/z)
// Dave's collision height must stay COMFORTABLY below the tile gap (TILE=1.4) or
// his head bonks the platform above and jumps die instantly. ~1.0 leaves real
// headroom to hop up into a one-tile gap (like the original). Model scaled to match.
const HEIGHT = 1.0        // player full height (feet→head)
const STEP_UP = 0.5       // walk over lips/steps up to this tall (don't treat as a wall)
const SKIN = 0.02         // tiny gap kept above a landed surface (avoids re-overlap jitter)

// jetpack (level 6): holding jump while fuelled gives controlled lift.
const JET_THRUST = 30     // upward accel while thrusting
const JET_MAX_UP = 9      // cap on upward velocity under thrust
const JET_DRAIN = 0.22    // fuel/s while thrusting
const PICKUP_R = 1.4      // pickup radius for jetpack / warp pads

// Respawn the player at the level spawn after a death (hazard or fall). Refuels
// the jetpack if they had it, and bumps the death counter for the HUD.
function die(p: THREE.Vector3, v: THREE.Vector3, level: Level) {
  p.set(...level.spawn)
  v.set(0, 0, 0)
  game.deaths += 1
  if (game.hasJetpack) game.jetFuel = 1 // keep the jetpack, top fuel back up
}

// Does the player (feet at py) touch a hazard volume? Same AABB test as above,
// reused for spike/fire/water boxes that respawn the player on contact.
function hazardHit(px: number, py: number, pz: number, h: Hazard): boolean {
  const [bx, by, bz] = h.pos
  const [sx, sy, sz] = h.size
  const footTop = py + HEIGHT
  return (
    Math.abs(px - bx) < RADIUS + sx / 2 &&
    py < by + sy / 2 && footTop > by - sy / 2 &&
    Math.abs(pz - bz) < RADIUS + sz / 2
  )
}

export function Player({ level = LEVEL_1 }: { level?: Level }) {
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

  const sideOn = level.style === "side"

  useFrame((state, dtRaw) => {
    // Freeze physics + input while not actively running (start screen / paused) or
    // when the level is cleared / won.
    if (!game.running || game.phase !== "playing") { tickInput(); return }
    const dt = Math.min(dtRaw, 1 / 30) // clamp big frames so physics stays stable
    const now = state.clock.elapsedTime
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
    if (sideOn) {
      // SIDE-ON Dave screen: pure left/right along world X (no depth nav). Only
      // A/D / ←/→ steer; up/down (forward/back) are unused. Z stays pinned to 0.
      let dir = 0
      if (input.right) dir += 1
      if (input.left) dir -= 1
      wish.set(dir, 0, 0)
    } else {
      if (input.forward) wish.add(camDir)
      if (input.back) wish.sub(camDir)
      if (input.right) wish.add(camRight)
      if (input.left) wish.sub(camRight)
    }
    const moving = wish.lengthSq() > 1e-4
    if (moving) wish.normalize().multiplyScalar(MOVE_SPEED)

    // accelerate horizontal velocity toward the wish velocity (snappy, frame-rate
    // independent). One exponential approach — not two fighting each other.
    const k = 1 - Math.exp(-(ACCEL / MOVE_SPEED) * dt)
    v.x += (wish.x - v.x) * k
    if (sideOn) { v.z = 0; p.z = 0 } else { v.z += (wish.z - v.z) * k }

    // --- jetpack flight (level 6): holding jump thrusts up while fuel remains,
    //     overriding the normal jump. Drains fuel; when empty, normal jump resumes.
    const jetActive = game.hasJetpack && game.jetFuel > 0 && input.jump
    if (jetActive) {
      v.y = Math.min(v.y + JET_THRUST * dt, JET_MAX_UP)
      game.jetFuel = Math.max(0, game.jetFuel - JET_DRAIN * dt)
      game.fx.jumpAt = now // reuse whoosh as a thruster hiss
      buffer.current = 0
    } else {
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
        game.fx.jumpAt = now // whoosh
      }
      if (!input.jump && v.y > 0) v.y *= JUMP_CUT > 0 ? Math.pow(JUMP_CUT, dt * 60) : 1
    }

    // gravity (lighter while actively jetting so lift feels controllable)
    v.y -= (jetActive ? GRAVITY * 0.35 : GRAVITY) * dt
    if (v.y < -40) v.y = -40

    // --- integrate + collide. Y FIRST (so ground/landing is authoritative and a
    //     fast fall can't tunnel through a thin platform), then X and Z with a
    //     step-up tolerance so small lips/steps don't act like walls. ---
    const wasAir = !onGround.current
    const vyBeforeLand = v.y

    // Y — swept: test the whole span the feet travel this frame, not just the end
    // point, so landing on a 1-unit-thick pad at high downward speed still catches.
    const prevFootTop = p.y + HEIGHT
    const prevFoot = p.y
    p.y += v.y * dt
    onGround.current = false
    for (const b of level.platforms) {
      const [bx, by, bz] = b.pos
      const [sx, sy, sz] = b.size
      // must overlap horizontally to interact vertically at all
      if (Math.abs(p.x - bx) >= RADIUS + sx / 2) continue
      if (Math.abs(p.z - bz) >= RADIUS + sz / 2) continue
      const boxTop = by + sy / 2
      const boxBottom = by - sy / 2
      if (v.y <= 0) {
        // falling/standing: land if the feet were at-or-above the box top at the
        // start of the frame (allowing the SKIN gap) and have now reached it.
        // Swept test catches a fast fall through a thin pad in one frame.
        if (prevFoot >= boxTop - SKIN - 0.001 && p.y <= boxTop + SKIN) {
          p.y = boxTop + SKIN
          v.y = 0
          onGround.current = true
        }
      } else {
        // rising: bonk head if the head crossed the box bottom this frame
        if (prevFootTop <= boxBottom + 0.001 && p.y + HEIGHT >= boxBottom) {
          p.y = boxBottom - HEIGHT - SKIN
          v.y = 0
        }
      }
    }

    // X — block only if the box is a genuine wall at our feet height (taller than
    // STEP_UP above our feet). Small steps are walked onto, not blocked.
    p.x += v.x * dt
    for (const b of level.platforms) {
      const [bx, by, bz] = b.pos
      const [sx, sy, sz] = b.size
      if (Math.abs(p.x - bx) >= RADIUS + sx / 2) continue
      if (Math.abs(p.z - bz) >= RADIUS + sz / 2) continue
      const boxTop = by + sy / 2
      const boxBottom = by - sy / 2
      // vertical overlap of the player's body with the box
      if (p.y >= boxTop || p.y + HEIGHT <= boxBottom) continue
      // if the box top is within step height above our feet, step up onto it
      if (boxTop - p.y <= STEP_UP && v.y <= 0) {
        p.y = boxTop + SKIN
        onGround.current = true
        v.y = 0
        continue
      }
      // otherwise it's a wall — push out in X
      p.x = bx + Math.sign(p.x - bx || 1) * (sx / 2 + RADIUS)
      v.x = 0
    }

    // Z — same logic as X
    p.z += v.z * dt
    for (const b of level.platforms) {
      const [bx, by, bz] = b.pos
      const [sx, sy, sz] = b.size
      if (Math.abs(p.x - bx) >= RADIUS + sx / 2) continue
      if (Math.abs(p.z - bz) >= RADIUS + sz / 2) continue
      const boxTop = by + sy / 2
      const boxBottom = by - sy / 2
      if (p.y >= boxTop || p.y + HEIGHT <= boxBottom) continue
      if (boxTop - p.y <= STEP_UP && v.y <= 0) {
        p.y = boxTop + SKIN
        onGround.current = true
        v.y = 0
        continue
      }
      p.z = bz + Math.sign(p.z - bz || 1) * (sz / 2 + RADIUS)
      v.z = 0
    }
    // landing this frame? spike landImpact by how hard we hit (drives the
    // squash on the character + a small camera shake).
    if (onGround.current && wasAir && vyBeforeLand < -2) {
      game.landImpact = Math.min(1, Math.abs(vyBeforeLand) / 14)
      // dust puff at the feet (thud SFX + particle burst)
      game.fx.landAt = now
      game.fx.landPos.set(p.x, p.y, p.z)
      game.fx.landPower = game.landImpact
    } else {
      game.landImpact = Math.max(0, game.landImpact - dt * 4)
    }

    // --- hazards: touching a spike/fire/water box = death → respawn ---
    if (level.hazards) {
      for (const h of level.hazards) {
        if (hazardHit(p.x, p.y, p.z, h)) {
          game.fx.deathAt = now
          game.fx.deathPos.set(p.x, p.y + 0.5, p.z)
          die(p, v, level)
          break
        }
      }
    }

    // fell off → respawn (also counts as a death)
    if (p.y < level.killY) {
      game.fx.deathAt = now
      game.fx.deathPos.set(p.x, level.spawn[1] + 0.5, p.z)
      die(p, v, level)
    }

    // --- jetpack pickup (level 6): grab it → flight enabled, full fuel ---
    if (level.jetpack && !game.hasJetpack) {
      const j = level.jetpack
      if (Math.hypot(p.x - j[0], p.y - j[1], p.z - j[2]) < PICKUP_R) {
        game.hasJetpack = true
        game.jetFuel = 1
        game.fx.collectAt = now
        game.fx.collectPos.set(j[0], j[1], j[2])
      }
    }

    // --- secret warp pad (level 10): step on it → jump straight to the win ---
    if (level.warp && game.phase === "playing") {
      const w = level.warp
      if (Math.hypot(p.x - w[0], p.y - w[1], p.z - w[2]) < PICKUP_R) {
        game.hasTrophy = true   // warp grants the cup so the win counts
        game.phase = "levelClear"
      }
    }

    // Face movement direction.
    //  • SIDE-ON: like the original Dave sprite, Dave TURNS to face the way he
    //    walks — profile-right when going right, profile-left when going left.
    //    The model's front is -Z, the camera sits at +Z looking -Z. Geometry
    //    (verified): yaw -PI/2 points his front to +X (right), +PI/2 to -X
    //    (left). Pure profile would hide his face from the camera, so we pull
    //    the turn back toward the camera by (1-FACE) — a three-quarter view that
    //    reads clearly as "facing right/left" while still showing his face.
    //    Idle: settle back to facing the camera straight-on.
    const FACE_CAM = Math.PI          // -Z model front → toward +Z camera (face us)
    const TURN = 0.68                 // how far toward full profile (0=face cam, 1=profile)
    if (sideOn) {
      let target: number
      if (v.x > 0.05) {
        // walking RIGHT: profile yaw is -PI/2 (front→+X). Blend from -PI (the
        // camera-facing angle, taken the SHORT way) → yaw ≈ -2.07: front tilts
        // +X and keeps +Z, i.e. a three-quarter view facing right, toward us.
        target = -Math.PI + (-Math.PI / 2 - -Math.PI) * TURN
      } else if (v.x < -0.05) {
        // walking LEFT: profile yaw is +PI/2 (front→-X). Blend from +PI → yaw
        // ≈ +2.07: front tilts -X, keeps +Z — three-quarter view facing left.
        target = Math.PI + (Math.PI / 2 - Math.PI) * TURN
      } else {
        target = FACE_CAM               // idle: face the camera straight-on
      }
      let d = target - yaw.current
      while (d > Math.PI) d -= Math.PI * 2
      while (d < -Math.PI) d += Math.PI * 2
      yaw.current += d * (1 - Math.exp(-16 * dt))
    } else if (moving) {
      const target = Math.atan2(-v.x, -v.z)
      let d = target - yaw.current
      while (d > Math.PI) d -= Math.PI * 2
      while (d < -Math.PI) d += Math.PI * 2
      yaw.current += d * (1 - Math.exp(-14 * dt))
    }

    // motion signals (read by the character animator + camera juice)
    const hSpeed = Math.hypot(v.x, v.z)
    game.playerSpeed = hSpeed
    game.playerVY = v.y
    game.playerAir = !onGround.current

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
      {/* Original chunky explorer hero (Blender GLB), animated procedurally:
          run bob + lean, jump stretch, landing squash, idle breathing. */}
      <DaveModel />
      {/* Soft key that travels with Dave so he reads clearly against the dark
          room no matter where he stands (the hero must never be a silhouette). */}
      <pointLight position={[0.6, 1.6, 2.2]} intensity={5} distance={6} decay={1.6} color="#ffe8cc" />
      {/* The LANTERN — a warm amber glow at the shoulder lamp that flickers
          gently, so the hero literally lights the hollow as he moves. The game's
          namesake, made real. */}
      <LanternLight />
    </group>
  )
}

/** The hero's shoulder lantern as a living warm light — a soft flicker over a
 *  steady base, casting an amber pool that travels with the player through the
 *  dark caverns. */
function LanternLight() {
  const ref = useRef<THREE.PointLight>(null)
  useFrame((st) => {
    if (!ref.current) return
    const t = st.clock.elapsedTime
    // steady base + two out-of-phase flickers → an organic lamp wobble
    ref.current.intensity = 3.4 + Math.sin(t * 9) * 0.35 + Math.sin(t * 23 + 1.3) * 0.18
  })
  return (
    <pointLight
      ref={ref}
      position={[0.42, 1.34, 0.5]}   // at the shoulder-lamp lens
      color="#ffcf80"
      intensity={3.4}
      distance={7.5}
      decay={1.4}
    />
  )
}

/**
 * DaveModel — an ORIGINAL chunky platformer hero built from primitives in code
 * (no external model), brought to life PROCEDURALLY from the live motion signals
 * in `game`:
 *   - idle: gentle breathing scale + sway
 *   - run:  vertical bob + side-to-side waddle + forward lean, paced by speed
 *   - jump: stretch tall when rising, tuck when falling
 *   - land: squash on impact (driven by landImpact), springing back
 * Volume-preserving squash/stretch (x,z compensate y) keeps it from looking like
 * a balloon. The character's legs also pump while running, arms swing. Exported so
 * the between-levels Corridor can render a walking Dave too.
 */
export function DaveModel() {
  const inner = useRef<THREE.Group>(null)
  const legL = useRef<THREE.Object3D | null>(null)
  const legR = useRef<THREE.Object3D | null>(null)
  const armL = useRef<THREE.Object3D | null>(null)
  const armR = useRef<THREE.Object3D | null>(null)
  const phase = useRef(0)      // run-cycle phase
  const sx = useRef(1); const sy = useRef(1); const sz = useRef(1)
  const lean = useRef(0)

  // Load + deep-clone the Blender Dave GLB (clone so multiple Daves — e.g. the
  // corridor — don't share one mutated scene graph). Grab the limb nodes by name.
  const { scene } = useGLTF(DAVE_GLB)
  const model = useMemo(() => {
    const root = SkeletonUtils.clone(scene) as THREE.Group
    root.traverse((o) => {
      o.castShadow = true
      o.receiveShadow = true
    })
    legL.current = root.getObjectByName("legL") ?? null
    legR.current = root.getObjectByName("legR") ?? null
    armL.current = root.getObjectByName("armL") ?? null
    armR.current = root.getObjectByName("armR") ?? null
    // record each limb's rest rotation so we offset from it
    for (const l of [legL, legR, armL, armR]) if (l.current) l.current.userData.restX = l.current.rotation.x
    return root
  }, [scene])

  useFrame((state, dtRaw) => {
    const g = inner.current
    if (!g) return
    const dt = Math.min(dtRaw, 1 / 30)
    const t = state.clock.elapsedTime
    const speed = game.playerSpeed
    const air = game.playerAir
    const vy = game.playerVY
    const land = game.landImpact
    const runT = Math.min(1, speed / 7.5) // 0..1 how fast we're running

    // run cycle advances with speed; freezes when still
    phase.current += dt * (6 + runT * 7) * runT

    // --- target squash/stretch ---
    let tSy = 1, tSx = 1
    if (air) {
      const stretch = THREE.MathUtils.clamp(vy * 0.018, -0.12, 0.16)
      tSy = 1 + stretch
      tSx = 1 - stretch * 0.6
    } else {
      const breathe = Math.sin(t * 1.6) * 0.015 * (1 - runT)
      const bob = Math.abs(Math.sin(phase.current)) * 0.06 * runT
      tSy = 1 + breathe - bob * 0.5
      tSx = 1 - breathe * 0.5 + bob * 0.25
    }
    if (land > 0.02) {
      tSy = 1 - land * 0.32
      tSx = 1 + land * 0.22
    }
    const ease = 1 - Math.exp(-(air ? 18 : 14) * dt)
    sy.current += (tSy - sy.current) * ease
    sx.current += (tSx - sx.current) * ease
    sz.current = sx.current
    // base scale → the ~2.0-tall GLB renders ~1.2 world units (≈0.86 tiles, the
    // original sprite's proportion). Collision HEIGHT stays 1.0 so one-tile gaps
    // remain passable; the slight visual overshoot is imperceptible.
    const BASE = 0.66
    g.scale.set(BASE * sx.current, BASE * sy.current, BASE * sz.current)

    // run bob + waddle + lean
    const hop = air ? 0 : Math.abs(Math.sin(phase.current)) * 0.12 * runT
    g.position.y = hop
    const waddle = air ? 0 : Math.sin(phase.current) * 0.12 * runT
    const tLean = air ? THREE.MathUtils.clamp(-vy * 0.01, -0.12, 0.12) : runT * 0.18
    lean.current += (tLean - lean.current) * (1 - Math.exp(-10 * dt))
    g.rotation.set(lean.current, 0, waddle)

    // --- limbs: legs pump + arms swing (offset from each node's rest pose) ---
    const swing = Math.sin(phase.current) * 0.9 * runT
    const set = (ref: React.RefObject<THREE.Object3D | null>, x: number) => {
      if (ref.current) ref.current.rotation.x = (ref.current.userData.restX ?? 0) + x
    }
    if (air) {
      set(legL, -0.3); set(legR, -0.3); set(armL, 0.4); set(armR, 0.4)
    } else {
      set(legL, swing); set(legR, -swing); set(armL, -swing * 0.8); set(armR, swing * 0.8)
    }
  })

  // The GLB is built feet-at-origin (~2.0 tall) facing the game's forward axis.
  return (
    <group ref={inner}>
      <primitive object={model} />
    </group>
  )
}
