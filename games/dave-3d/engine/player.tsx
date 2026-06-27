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

import { useEffect, useRef } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"
import { LEVEL_1, type Level, type Hazard } from "./level"
import { input, tickInput } from "./controls"
import { game } from "./state"

// tuned platformer feel (crisp jump: coyote-time + jump-buffer + variable height)
const GRAVITY = 26
const MOVE_SPEED = 7.5
const ACCEL = 60          // ground responsiveness
const JUMP_V = 11
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
    if (game.phase !== "playing") { tickInput(); return }
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
    //  • SIDE-ON: turn to a left/right PROFILE so the camera (looking down -Z)
    //    sees Dave from the side, like a 2D platformer. +X → +90°, -X → -90°.
    //  • FREE: face the travel vector (model's -Z front aligns to velocity).
    if (sideOn) {
      if (Math.abs(v.x) > 0.05) {
        const target = v.x > 0 ? Math.PI / 2 : -Math.PI / 2
        let d = target - yaw.current
        while (d > Math.PI) d -= Math.PI * 2
        while (d < -Math.PI) d += Math.PI * 2
        yaw.current += d * (1 - Math.exp(-18 * dt))
      }
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
      {/* Original, built-in-code chunky platformer hero (no external model).
          Brought to life PROCEDURALLY: run bob + lean, jump stretch, landing
          squash, idle breathing. */}
      <DaveModel />
    </group>
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
  const legL = useRef<THREE.Group>(null)
  const legR = useRef<THREE.Group>(null)
  const armL = useRef<THREE.Group>(null)
  const armR = useRef<THREE.Group>(null)
  const phase = useRef(0)      // run-cycle phase
  const sx = useRef(1); const sy = useRef(1); const sz = useRef(1)
  const lean = useRef(0)

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
      // stretch tall rising, tuck slightly falling
      const stretch = THREE.MathUtils.clamp(vy * 0.018, -0.12, 0.16)
      tSy = 1 + stretch
      tSx = 1 - stretch * 0.6
    } else {
      // idle breathing + running bob baked into vertical scale
      const breathe = Math.sin(t * 1.6) * 0.015 * (1 - runT)
      const bob = Math.abs(Math.sin(phase.current)) * 0.06 * runT
      tSy = 1 + breathe - bob * 0.5
      tSx = 1 - breathe * 0.5 + bob * 0.25
    }
    // landing squash overrides — a quick flatten that springs back
    if (land > 0.02) {
      tSy = 1 - land * 0.32
      tSx = 1 + land * 0.22
    }
    // volume-ish preservation: z follows x
    const ease = 1 - Math.exp(-(air ? 18 : 14) * dt)
    sy.current += (tSy - sy.current) * ease
    sx.current += (tSx - sx.current) * ease
    sz.current = sx.current
    // base scale ~0.56 → the ~1.8-tall local model renders ~1.0 world units,
    // matching the HEIGHT collision box so Dave fits a one-tile gap.
    const BASE = 0.56
    g.scale.set(BASE * sx.current, BASE * sy.current, BASE * sz.current)

    // --- run bob (vertical hop) + waddle (z-roll) + forward lean ---
    const hop = air ? 0 : Math.abs(Math.sin(phase.current)) * 0.12 * runT
    g.position.y = hop
    const waddle = air ? 0 : Math.sin(phase.current) * 0.12 * runT
    const tLean = air ? THREE.MathUtils.clamp(-vy * 0.01, -0.12, 0.12) : runT * 0.18
    lean.current += (tLean - lean.current) * (1 - Math.exp(-10 * dt))
    g.rotation.set(lean.current, 0, waddle)

    // --- limbs: legs pump + arms swing while running; tuck in the air ---
    const swing = Math.sin(phase.current) * 0.9 * runT
    if (air) {
      // tuck legs up a touch, arms slightly back when airborne
      if (legL.current) legL.current.rotation.x = -0.3
      if (legR.current) legR.current.rotation.x = -0.3
      if (armL.current) armL.current.rotation.x = 0.4
      if (armR.current) armR.current.rotation.x = 0.4
    } else {
      if (legL.current) legL.current.rotation.x = swing
      if (legR.current) legR.current.rotation.x = -swing
      if (armL.current) armL.current.rotation.x = -swing * 0.8
      if (armR.current) armR.current.rotation.x = swing * 0.8
    }
  })

  // palette — a friendly, readable explorer
  const skin = "#f0c098"
  const shirt = "#d2483f"   // red
  const pants = "#3a5a8c"   // blue
  const boots = "#39322c"
  const cap = "#e0b53e"     // gold cap
  const capDark = "#a37d1f" // cap brim/button
  const eye = "#202020"
  const brow = "#7a4a28"    // eyebrows / brows match a warm brown

  // The hero is built feet-at-origin, standing on +Y, facing -Z (game forward).
  // Heights below are in local units; the whole thing is ~1.8 tall.
  return (
    <group ref={inner}>
      {/* LEGS — pivot at the hip so they swing from the top */}
      <group ref={legL} position={[-0.16, 0.55, 0]}>
        <mesh castShadow position={[0, -0.28, 0]}>
          <boxGeometry args={[0.22, 0.56, 0.24]} />
          <meshStandardMaterial color={pants} roughness={0.85} />
        </mesh>
        <mesh castShadow position={[0, -0.6, 0.04]}>
          <boxGeometry args={[0.24, 0.16, 0.34]} />
          <meshStandardMaterial color={boots} roughness={0.7} />
        </mesh>
      </group>
      <group ref={legR} position={[0.16, 0.55, 0]}>
        <mesh castShadow position={[0, -0.28, 0]}>
          <boxGeometry args={[0.22, 0.56, 0.24]} />
          <meshStandardMaterial color={pants} roughness={0.85} />
        </mesh>
        <mesh castShadow position={[0, -0.6, 0.04]}>
          <boxGeometry args={[0.24, 0.16, 0.34]} />
          <meshStandardMaterial color={boots} roughness={0.7} />
        </mesh>
      </group>

      {/* TORSO */}
      <mesh castShadow position={[0, 0.92, 0]}>
        <boxGeometry args={[0.56, 0.62, 0.36]} />
        <meshStandardMaterial color={shirt} roughness={0.8} />
      </mesh>
      {/* belt */}
      <mesh position={[0, 0.62, 0]}>
        <boxGeometry args={[0.58, 0.1, 0.38]} />
        <meshStandardMaterial color={boots} roughness={0.6} />
      </mesh>

      {/* ARMS — pivot at the shoulder */}
      <group ref={armL} position={[-0.34, 1.18, 0]}>
        <mesh castShadow position={[0, -0.26, 0]}>
          <boxGeometry args={[0.16, 0.5, 0.18]} />
          <meshStandardMaterial color={shirt} roughness={0.8} />
        </mesh>
        <mesh castShadow position={[0, -0.54, 0]}>
          <boxGeometry args={[0.17, 0.14, 0.19]} />
          <meshStandardMaterial color={skin} roughness={0.7} />
        </mesh>
      </group>
      <group ref={armR} position={[0.34, 1.18, 0]}>
        <mesh castShadow position={[0, -0.26, 0]}>
          <boxGeometry args={[0.16, 0.5, 0.18]} />
          <meshStandardMaterial color={shirt} roughness={0.8} />
        </mesh>
        <mesh castShadow position={[0, -0.54, 0]}>
          <boxGeometry args={[0.17, 0.14, 0.19]} />
          <meshStandardMaterial color={skin} roughness={0.7} />
        </mesh>
      </group>

      {/* HEAD — rounded (sphere) for a friendlier, less-blocky look, with a
          proper expressive face: white eyes + pupils, brows, nose, and a smile.
          Built facing -Z (forward). */}
      <group position={[0, 1.5, 0]}>
        {/* rounded skull, very slightly squashed so it's not a perfect ball */}
        <mesh castShadow scale={[1, 0.94, 0.96]}>
          <sphereGeometry args={[0.27, 24, 20]} />
          <meshStandardMaterial color={skin} roughness={0.55} />
        </mesh>
        {/* ears */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.26, -0.01, 0]} scale={[0.6, 1, 0.7]}>
            <sphereGeometry args={[0.07, 10, 10]} />
            <meshStandardMaterial color={skin} roughness={0.6} />
          </mesh>
        ))}
        {/* eye whites */}
        {[-0.1, 0.1].map((x) => (
          <mesh key={`w${x}`} position={[x, 0.04, -0.24]} scale={[1, 1.25, 0.5]}>
            <sphereGeometry args={[0.066, 14, 14]} />
            <meshStandardMaterial color="#ffffff" roughness={0.35} />
          </mesh>
        ))}
        {/* pupils */}
        {[-0.095, 0.105].map((x) => (
          <mesh key={`p${x}`} position={[x, 0.03, -0.285]}>
            <sphereGeometry args={[0.032, 12, 12]} />
            <meshStandardMaterial color={eye} />
          </mesh>
        ))}
        {/* eyebrows — a touch of attitude */}
        {[-0.1, 0.1].map((x, i) => (
          <mesh key={`b${x}`} position={[x, 0.13, -0.25]} rotation={[0, 0, (i ? -1 : 1) * 0.18]}>
            <boxGeometry args={[0.11, 0.025, 0.03]} />
            <meshStandardMaterial color={brow} roughness={0.8} />
          </mesh>
        ))}
        {/* nose */}
        <mesh position={[0, -0.02, -0.28]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.045, 0.1, 10]} />
          <meshStandardMaterial color={skin} roughness={0.6} />
        </mesh>
        {/* smile — a thin curved torus arc */}
        <mesh position={[0, -0.12, -0.24]} rotation={[Math.PI, 0, 0]}>
          <torusGeometry args={[0.075, 0.018, 8, 14, Math.PI]} />
          <meshStandardMaterial color="#7a3b2e" roughness={0.7} />
        </mesh>

        {/* CAP — rounded crown (half-sphere) + a curved brim, set back off the face */}
        <group position={[0, 0.16, 0.03]}>
          <mesh castShadow scale={[1.05, 0.7, 1.05]}>
            <sphereGeometry args={[0.27, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={cap} roughness={0.5} />
          </mesh>
          {/* button on top */}
          <mesh position={[0, 0.12, 0]}>
            <sphereGeometry args={[0.035, 10, 10]} />
            <meshStandardMaterial color={capDark} roughness={0.5} />
          </mesh>
          {/* brim out the front */}
          <mesh position={[0, -0.02, -0.26]} rotation={[-0.12, 0, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 0.04, 18, 1, false, 0, Math.PI]} />
            <meshStandardMaterial color={capDark} roughness={0.5} />
          </mesh>
        </group>
      </group>
    </group>
  )
}
