/**
 * CharacterController — the deterministic, fixed-timestep motion core for Dave.
 *
 * Extracted out of player.tsx so the physics is one small, testable unit and the
 * React component is just input-mapping + rendering. It owns:
 *   - crisp horizontal feel (drive toward top speed, hard brake, harder reversal)
 *   - the validated jump envelope (coyote-time + jump-buffer + variable height)
 *   - swept, axis-separated AABB collision against the level's platform boxes
 *     (Y first — authoritative ground/landing, no tunnelling through thin pads —
 *      then X and Z with a step-up tolerance so lips aren't walls)
 *
 * Space: the controller works in body-CENTRE space. `position` is the centre of
 * the collision box; the game reads FEET, so callers subtract `half.y`. Colliders
 * are the raw platform volumes (Box3) — the body's half-extents are added at test
 * time, so a point-vs-fattened-box test resolves the AABB overlap.
 *
 * Determinism: `update(dt)` runs on fixed sub-steps (accumulator) so the sim is
 * frame-rate independent and matches the jump apex the levels were validated
 * against. `renderPosition` is the interpolated (smooth) transform for drawing;
 * `position` is the authoritative end-of-step state for gameplay tests.
 */

import * as THREE from "three"

export type CharacterConfig = {
  /** half-extents of the collision box (x = radius, y = half height, z = radius) */
  half: THREE.Vector3
  /** top horizontal speed (world units/s) */
  maxSpeed: number
  /** ground responsiveness — accel toward top speed while steering (units/s²) */
  accel: number
  /** brake rate when there's no input (units/s²) */
  decel: number
  /** reversal rate when steering into the opposite direction (units/s²) */
  turnAccel: number
  /** downward gravity (units/s²) */
  gravity: number
  /** takeoff velocity of a jump (units/s) */
  jumpSpeed: number
  /** releasing jump while rising scales upward velocity toward this each 1/60s */
  jumpCut: number
  /** seconds after leaving the ground a jump still fires (coyote-time) */
  coyoteTime: number
  /** seconds a jump press is remembered (jump-buffer) */
  jumpBufferTime: number
  /** tiny gap kept above a landed surface, avoids re-overlap jitter */
  skin: number
  /** side-on screens pin Z to the spawn plane (no depth navigation) */
  lockZ: boolean
}

/** Per-frame overrides (jetpack: lighter gravity, no coyote/buffer jump). */
export type UpdateOptions = {
  /** scales gravity for this update (jetpack lift feels controllable at 0.35) */
  gravityScale?: number
  /** skip the coyote/buffer jump resolve (the jetpack drives Y directly) */
  suppressJump?: boolean
}

// Deterministic sub-step. Small enough that the jump apex is stable across frame
// rates; the accumulator carries the remainder between frames.
const FIXED_DT = 1 / 120
// Walk over lips/steps up to this tall instead of treating them as a wall. Baked
// in here (was STEP_UP in player.tsx) so callers don't have to thread it through.
const STEP_UP = 0.5
// Terminal fall speed — mirrors the old `if (v.y < -40) v.y = -40` clamp.
const MAX_FALL = 40

export class CharacterController {
  readonly cfg: CharacterConfig

  /** authoritative body-CENTRE position (end of the last fixed step) */
  readonly position = new THREE.Vector3()
  /** interpolated body-CENTRE position for smooth rendering */
  readonly renderPosition = new THREE.Vector3()
  /** current velocity (world units/s) */
  readonly velocity = new THREE.Vector3()

  /** standing on a surface this step */
  grounded = false
  /** touched down (air → ground) on the most recent step */
  justLanded = false
  /** downward speed at the instant of the most recent landing (positive) */
  landingVY = 0

  // raw platform volumes; the body's half-extents are added at test time so the
  // body reduces to a point vs a fattened footprint. Set via setColliders().
  private rawColliders: THREE.Box3[] = []

  // desired move intent this frame, in [-1..1] world axes (already camera-mapped)
  private moveX = 0
  private moveZ = 0
  private jumpHeld = false

  private coyote = 0
  private buffer = 0

  // interpolation: remember the previous authoritative centre + the leftover
  // fraction of a sub-step, so renderPosition can lerp between them.
  private prevPosition = new THREE.Vector3()
  private accumulator = 0

  constructor(spawnCentre: THREE.Vector3, cfg: CharacterConfig) {
    this.cfg = cfg
    this.position.copy(spawnCentre)
    this.prevPosition.copy(spawnCentre)
    this.renderPosition.copy(spawnCentre)
  }

  /** Replace the collision set with the current level's platform volumes. */
  setColliders(boxes: THREE.Box3[]) {
    this.rawColliders = boxes
  }

  /** Teleport to a new centre and clear all momentum (so a respawn doesn't inherit
   *  a fall) — also zeroes the interpolation so the render pos snaps, not slides. */
  reset(centre: THREE.Vector3) {
    this.position.copy(centre)
    this.prevPosition.copy(centre)
    this.renderPosition.copy(centre)
    this.velocity.set(0, 0, 0)
    this.grounded = false
    this.justLanded = false
    this.landingVY = 0
    this.coyote = 0
    this.buffer = 0
    this.accumulator = 0
    if (this.cfg.lockZ) this.position.z = centre.z
  }

  /** Feed this frame's steering intent ([-1..1] per world axis) + jump-held. */
  setInput(intent: { moveX: number; moveZ: number; jumpHeld: boolean }) {
    this.moveX = intent.moveX
    this.moveZ = intent.moveZ
    this.jumpHeld = intent.jumpHeld
  }

  /** Edge-triggered jump press → buffer it; the step decides if it fires. */
  notifyJumpPressed() {
    this.buffer = this.cfg.jumpBufferTime
  }

  /** Directly set vertical velocity (jetpack thrust drives Y itself). */
  setVelocityY(vy: number) {
    this.velocity.y = vy
  }

  /**
   * Advance the sim by `dt` real seconds on fixed sub-steps, then update the
   * interpolated render position. `justLanded`/`landingVY` reflect whichever
   * sub-step touched down.
   */
  update(dt: number, opts?: UpdateOptions) {
    this.justLanded = false
    this.accumulator += dt

    // guard against a huge dt spiralling into hundreds of sub-steps
    let steps = 0
    while (this.accumulator >= FIXED_DT && steps < 8) {
      this.prevPosition.copy(this.position)
      this.step(FIXED_DT, opts)
      this.accumulator -= FIXED_DT
      steps += 1
    }
    if (steps === 8) this.accumulator = 0 // drop the backlog rather than lag

    const alpha = this.accumulator / FIXED_DT
    this.renderPosition.lerpVectors(this.prevPosition, this.position, alpha)
  }

  // --- one fixed sub-step of the sim -------------------------------------------

  private step(dt: number, opts?: UpdateOptions) {
    const cfg = this.cfg
    const v = this.velocity

    // --- horizontal: crisp accel / brake / reversal toward the wish velocity ---
    const wishX = this.moveX * cfg.maxSpeed
    this.velocity.x = this.approach(v.x, wishX, dt)
    if (cfg.lockZ) {
      v.z = 0
      this.position.z = this.prevPosition.z
    } else {
      const wishZ = this.moveZ * cfg.maxSpeed
      this.velocity.z = this.approach(v.z, wishZ, dt)
    }

    // --- jump: coyote + buffer + variable height (unless suppressed/jetting) ---
    if (!opts?.suppressJump) {
      if (this.grounded) this.coyote = cfg.coyoteTime
      else this.coyote = Math.max(0, this.coyote - dt)
      this.buffer = Math.max(0, this.buffer - dt)

      if (this.buffer > 0 && this.coyote > 0) {
        v.y = cfg.jumpSpeed
        this.grounded = false
        this.coyote = 0
        this.buffer = 0
      }
      // variable height: releasing jump while rising bleeds upward velocity
      if (!this.jumpHeld && v.y > 0 && cfg.jumpCut > 0) {
        v.y *= Math.pow(cfg.jumpCut, dt * 60)
      }
    } else {
      // jetting: keep coyote/buffer from firing the instant thrust ends
      this.coyote = 0
      this.buffer = 0
    }

    // --- gravity ---
    const g = cfg.gravity * (opts?.gravityScale ?? 1)
    v.y -= g * dt
    if (v.y < -MAX_FALL) v.y = -MAX_FALL

    // --- integrate + collide, axis-separated. Y first (authoritative ground) ---
    const wasAir = !this.grounded
    const vyBeforeLand = v.y
    this.collideY(dt)
    this.collideAxis("x", dt)
    if (!cfg.lockZ) this.collideAxis("z", dt)

    // landing this sub-step? flag it + record the impact speed (positive).
    if (this.grounded && wasAir && vyBeforeLand < -2) {
      this.justLanded = true
      this.landingVY = -vyBeforeLand
    }
  }

  /** Move `cur` toward `wish` using accel / decel / turnAccel depending on intent. */
  private approach(cur: number, wish: number, dt: number): number {
    const cfg = this.cfg
    let rate: number
    if (Math.abs(wish) < 1e-4) {
      rate = cfg.decel // no input → brake hard
    } else if (cur !== 0 && Math.sign(wish) !== Math.sign(cur)) {
      rate = cfg.turnAccel // steering against current motion → snap the reversal
    } else {
      rate = cfg.accel // driving toward top speed
    }
    const step = rate * dt
    if (cur < wish) return Math.min(cur + step, wish)
    if (cur > wish) return Math.max(cur - step, wish)
    return wish
  }

  // Y — swept: test the whole span the body centre travels this sub-step so a fast
  // fall can't tunnel through a thin pad. Lands on box tops, bonks head on bottoms.
  private collideY(dt: number) {
    const h = this.cfg.half
    const skin = this.cfg.skin
    const p = this.position
    const v = this.velocity

    const prevBottom = p.y - h.y // feet before the move
    const prevTop = p.y + h.y // head before the move
    p.y += v.y * dt
    this.grounded = false

    for (const b of this.rawColliders) {
      // must overlap horizontally (body as a point vs the fattened footprint)
      if (Math.abs(p.x - center(b, "x")) >= h.x + half(b, "x")) continue
      if (Math.abs(p.z - center(b, "z")) >= h.z + half(b, "z")) continue
      const boxTop = b.max.y
      const boxBottom = b.min.y
      if (v.y <= 0) {
        // falling/standing: land if the feet were at-or-above the box top at the
        // start of the sub-step and have now reached it (swept, with the SKIN gap).
        const foot = p.y - h.y
        if (prevBottom >= boxTop - skin - 0.001 && foot <= boxTop + skin) {
          p.y = boxTop + skin + h.y
          v.y = 0
          this.grounded = true
        }
      } else {
        // rising: bonk head if the head crossed the box bottom this sub-step
        const head = p.y + h.y
        if (prevTop <= boxBottom + 0.001 && head >= boxBottom) {
          p.y = boxBottom - h.y - skin
          v.y = 0
        }
      }
    }
  }

  // X / Z — block only genuine walls at the body's height. A box whose top is
  // within STEP_UP of the feet is stepped onto (lips aren't walls), matching the
  // original Dave feel; anything taller pushes the body out and kills that axis.
  private collideAxis(axis: "x" | "z", dt: number) {
    const h = this.cfg.half
    const skin = this.cfg.skin
    const p = this.position
    const v = this.velocity

    p[axis] += v[axis] * dt
    for (const b of this.rawColliders) {
      if (Math.abs(p.x - center(b, "x")) >= h.x + half(b, "x")) continue
      if (Math.abs(p.z - center(b, "z")) >= h.z + half(b, "z")) continue
      const boxTop = b.max.y
      const boxBottom = b.min.y
      const foot = p.y - h.y
      const head = p.y + h.y
      // no vertical overlap → not a wall we can hit on this axis
      if (foot >= boxTop || head <= boxBottom) continue
      // small step up → walk onto it instead of blocking
      if (boxTop - foot <= STEP_UP && v.y <= 0) {
        p.y = boxTop + skin + h.y
        this.grounded = true
        v.y = 0
        continue
      }
      // genuine wall → push out along this axis and stop
      const c = center(b, axis)
      const reach = half(b, axis) + h[axis]
      p[axis] = c + Math.sign(p[axis] - c || 1) * reach
      v[axis] = 0
    }
  }
}

// --- Box3 helpers (centre + half-extent along an axis) -----------------------
function center(b: THREE.Box3, axis: "x" | "y" | "z"): number {
  return (b.min[axis] + b.max[axis]) / 2
}
function half(b: THREE.Box3, axis: "x" | "y" | "z"): number {
  return (b.max[axis] - b.min[axis]) / 2
}
