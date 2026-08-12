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
import { CharacterController } from "./character-controller"
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
const ACCEL = 60          // ground responsiveness (drive toward top speed)
// Crisp stops/reversals — the "walk properly" feel. A hard brake and an even
// harder turn kill the floaty, ice-skating drift the old exponential-lerp had:
// let go and Dave halts in a couple frames; press the other way and he snaps
// direction instead of coasting through zero. Higher than ACCEL on purpose.
const DECEL = 90          // brake rate when no input (units/s²)
const TURN_ACCEL = 120    // reversal rate when steering into the opposite way
const JUMP_V = 14.3
const COYOTE = 0.1        // s after leaving ground you can still jump
const BUFFER = 0.12       // s a jump press is remembered
const JUMP_CUT = 0.5      // releasing jump while rising cuts velocity
const RADIUS = 0.38       // player half-width (x/z)
// Dave's collision height must stay COMFORTABLY below the tile gap (TILE=1.4) or
// his head bonks the platform above and jumps die instantly. ~1.0 leaves real
// headroom to hop up into a one-tile gap (like the original). Model scaled to match.
const HEIGHT = 1.0        // player full height (feet→head)
const SKIN = 0.02         // tiny gap kept above a landed surface (avoids re-overlap jitter)

// jetpack (level 6): holding jump while fuelled gives controlled lift.
const JET_THRUST = 30     // upward accel while thrusting
const JET_MAX_UP = 9      // cap on upward velocity under thrust
const JET_DRAIN = 0.22    // fuel/s while thrusting
const PICKUP_R = 1.4      // pickup radius for jetpack / warp pads

// Respawn the player at the level spawn after a death (hazard or fall). Teleports
// the controller (which clears momentum so a respawn doesn't inherit a fall),
// refuels the jetpack if they had it, and bumps the death counter for the HUD.
// The controller works in body-CENTRE space, so we lift the feet-space spawn by
// half the body height.
function respawn(c: CharacterController, level: Level) {
  c.reset(new THREE.Vector3(level.spawn[0], level.spawn[1] + HEIGHT / 2, level.spawn[2]))
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

  const yaw = useRef(0)
  const sideOn = level.style === "side"

  // The deterministic, fixed-timestep motion core. Same jump envelope the levels
  // were validated against (JUMP_V/GRAVITY/MOVE_SPEED), but frame-rate independent
  // and with crisp accel/decel/turn so walking + stopping feel intentional. Built
  // fresh per level so its colliders/spawn track the current room.
  const controller = useMemo(() => {
    return new CharacterController(new THREE.Vector3(...level.spawn), {
      half: new THREE.Vector3(RADIUS, HEIGHT / 2, RADIUS),
      maxSpeed: MOVE_SPEED,
      accel: ACCEL,
      decel: DECEL,
      turnAccel: TURN_ACCEL,
      gravity: GRAVITY,
      jumpSpeed: JUMP_V,
      jumpCut: JUMP_CUT,
      coyoteTime: COYOTE,
      jumpBufferTime: BUFFER,
      skin: SKIN,
      lockZ: sideOn,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level])

  // Precompute the level's platform AABBs once (the controller centres its body
  // on `position`, so the boxes are the raw platform volumes). Rebuilt per level.
  const colliders = useMemo(() => {
    return level.platforms.map((b) => {
      const [bx, by, bz] = b.pos
      const [sx, sy, sz] = b.size
      return new THREE.Box3(
        new THREE.Vector3(bx - sx / 2, by - sy / 2, bz - sz / 2),
        new THREE.Vector3(bx + sx / 2, by + sy / 2, bz + sz / 2),
      )
    })
  }, [level])

  // The controller anchors its body at the CENTRE of the collision box, but the
  // rest of the game (spawn, gems, hazards, rendering) treats the stored position
  // as FEET. We keep a feet-space position for the game and lift it to centre for
  // the controller. HALF_H is that offset.
  const HALF_H = HEIGHT / 2

  // reset to spawn when the level/restart changes
  useEffect(() => {
    controller.setColliders(colliders)
    const spawn = new THREE.Vector3(level.spawn[0], level.spawn[1] + HALF_H, level.spawn[2])
    controller.reset(spawn)
    yaw.current = sideOn ? Math.PI : 0
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, controller, colliders])

  useFrame((state, dtRaw) => {
    // Freeze physics + input while not actively running (start screen / paused) or
    // when the level is cleared / won.
    if (!game.running || game.phase !== "playing") { tickInput(); return }
    const dt = Math.min(dtRaw, 1 / 30) // clamp big frames so physics stays stable
    const now = state.clock.elapsedTime
    const c = controller

    // --- camera-relative input → the controller's [-1..1] move axes ---
    let moveX = 0
    let moveZ = 0
    if (sideOn) {
      // SIDE-ON Dave screen: pure left/right along world X (no depth nav). Only
      // A/D / ←/→ steer; up/down (forward/back) are unused. Z is locked by the
      // controller (cfg.lockZ), so we only feed moveX.
      if (input.right) moveX += 1
      if (input.left) moveX -= 1
    } else {
      // FREE roam: project WASD onto the camera's ground plane, then read the
      // world-space X/Z the controller integrates against.
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
      if (wish.lengthSq() > 1e-4) wish.normalize()
      moveX = wish.x
      moveZ = wish.z
    }
    const moving = Math.abs(moveX) + Math.abs(moveZ) > 1e-3

    // --- jetpack flight (level 6): holding jump thrusts up while fuel remains,
    //     overriding the normal jump. Drives the controller's Y directly and
    //     suppresses the coyote/buffer jump so the two don't fight. ---
    const jetActive = game.hasJetpack && game.jetFuel > 0 && input.jump
    if (jetActive) {
      c.setVelocityY(Math.min(c.velocity.y + JET_THRUST * dt, JET_MAX_UP))
      game.jetFuel = Math.max(0, game.jetFuel - JET_DRAIN * dt)
      game.fx.jumpAt = now // reuse whoosh as a thruster hiss
    } else if (input.jumpPressed) {
      // edge-triggered press → buffer it (the controller decides if it fires,
      // honouring coyote-time); it stamps the whoosh implicitly on take-off.
      c.notifyJumpPressed()
    }

    // Feed the frame's intent, then advance the deterministic fixed-timestep
    // core. Under the jetpack we lighten gravity and suppress its jump handling.
    const vyBefore = c.velocity.y
    c.setInput({ moveX, moveZ, jumpHeld: input.jump })
    c.update(dt, jetActive ? { gravityScale: 0.35, suppressJump: true } : undefined)

    // Whoosh on a fresh take-off — the controller kicks velocity.y up to jumpSpeed
    // on the tick it jumps (coyote or grounded), so a sharp non-gravity rise in
    // upward velocity marks the launch.
    if (!jetActive && c.velocity.y > vyBefore + 1) {
      game.fx.jumpAt = now
    }

    // The controller works in body-CENTRE space; the game reads FEET. Lower the
    // resolved centre back to feet for hazards / pickups / rendering.
    const px = c.renderPosition.x
    const pyFeet = c.renderPosition.y - HALF_H
    const pz = c.renderPosition.z
    // authoritative (non-interpolated) feet position for gameplay tests
    const solidFeetY = c.position.y - HALF_H

    // landing this frame? the controller flags justLanded + the impact speed.
    if (c.justLanded && c.landingVY > 2) {
      game.landImpact = Math.min(1, c.landingVY / 14)
      game.fx.landAt = now
      game.fx.landPos.set(px, pyFeet, pz)
      game.fx.landPower = game.landImpact
    } else {
      game.landImpact = Math.max(0, game.landImpact - dt * 4)
    }

    // --- hazards: touching a spike/fire/water box = death → respawn ---
    if (level.hazards) {
      for (const h of level.hazards) {
        if (hazardHit(px, solidFeetY, pz, h)) {
          game.fx.deathAt = now
          game.fx.deathPos.set(px, solidFeetY + 0.5, pz)
          respawn(c, level)
          break
        }
      }
    }

    // fell off → respawn (also counts as a death)
    if (solidFeetY < level.killY) {
      game.fx.deathAt = now
      game.fx.deathPos.set(px, level.spawn[1] + 0.5, pz)
      respawn(c, level)
    }

    // --- jetpack pickup (level 6): grab it → flight enabled, full fuel ---
    if (level.jetpack && !game.hasJetpack) {
      const j = level.jetpack
      if (Math.hypot(px - j[0], solidFeetY - j[1], pz - j[2]) < PICKUP_R) {
        game.hasJetpack = true
        game.jetFuel = 1
        game.fx.collectAt = now
        game.fx.collectPos.set(j[0], j[1], j[2])
      }
    }

    // --- secret warp pad (level 10): step on it → jump straight to the win ---
    if (level.warp && game.phase === "playing") {
      const w = level.warp
      if (Math.hypot(px - w[0], solidFeetY - w[1], pz - w[2]) < PICKUP_R) {
        game.hasTrophy = true   // warp grants the cup so the win counts
        game.phase = "levelClear"
      }
    }

    // Face movement direction.
    //  • SIDE-ON: the default camera sits BEHIND Dave on +Z looking along -Z,
    //    so at yaw 0 we'd see his BACK — which read as "he goes backward".
    //    Instead, keep his FACE toward the camera (yaw ≈ π, the model's -Z
    //    front pointing to +Z where the camera is) and lean left/right from
    //    there toward travel. Walking right → face-right lean; left → face-left
    //    lean. You always see his face and clearly which way he's headed.
    //  • FREE: face the travel vector.
    const vx = c.velocity.x
    const vz = c.velocity.z
    const FACE_CAM = Math.PI          // -Z model front → toward +Z camera
    const LEAN = Math.PI * 0.28       // ~50° lean toward the walk direction
    if (sideOn) {
      const target = Math.abs(vx) > 0.05
        ? FACE_CAM - Math.sign(vx) * LEAN  // right (+x) leans one way, left the other
        : FACE_CAM                         // idle: face the camera straight-on
      let d = target - yaw.current
      while (d > Math.PI) d -= Math.PI * 2
      while (d < -Math.PI) d += Math.PI * 2
      yaw.current += d * (1 - Math.exp(-16 * dt))
    } else if (moving) {
      const target = Math.atan2(-vx, -vz)
      let d = target - yaw.current
      while (d > Math.PI) d -= Math.PI * 2
      while (d < -Math.PI) d += Math.PI * 2
      yaw.current += d * (1 - Math.exp(-14 * dt))
    }

    // motion signals (read by the character animator + camera juice)
    game.playerSpeed = Math.hypot(vx, vz)
    game.playerVY = c.velocity.y
    game.playerAir = !c.grounded

    // commit to the transform + shared state (feet-space)
    if (ref.current) {
      ref.current.position.set(px, pyFeet, pz)
      ref.current.rotation.y = yaw.current
    }
    game.playerPos.set(px, pyFeet, pz)
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
