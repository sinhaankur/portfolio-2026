import * as THREE from "three"

/**
 * Fixed-timestep kinematic character controller — the deterministic motion core
 * for Deep Descent. Adapted from an original controller design to the game's
 * proven jump feel (the numbers the levels were validated against).
 *
 * Why this exists: the old player integrated movement against a variable render
 * dt with an exponential-approach lerp, so jumps behaved slightly differently at
 * 60Hz vs 144Hz and inputs had a floaty tail. Good levels then felt "impossible"
 * because the jump you could clear on one machine you couldn't on another. This
 * controller runs physics in fixed 1/120s slices (identical on any refresh),
 * uses linear moveToward for crisp stops/reversals, and resolves collisions with
 * a swept, axis-separated AABB so fast falls can't tunnel and corners don't jitter.
 *
 * The game layers its own concerns on top via the option hooks: side-on levels
 * lock Z; the jetpack overrides vertical velocity; hazards/gems are read by the
 * caller from the resolved position.
 */

export interface ControllerInput {
  moveX: number      // -1..1
  moveZ: number      // -1..1 (0 on side-on levels)
  jumpHeld: boolean
}

export interface ControllerConfig {
  half: THREE.Vector3
  maxSpeed: number
  accel: number
  decel: number
  turnAccel: number
  gravity: number
  jumpSpeed: number
  jumpCut: number        // velocity kept if jump released while rising
  coyoteTime: number
  jumpBufferTime: number
  skin: number
  lockZ: boolean         // side-on levels pin Z to the slab
}

const FIXED_DT = 1 / 120
const MAX_FRAME_TIME = 0.25

export class CharacterController {
  readonly position = new THREE.Vector3()
  readonly velocity = new THREE.Vector3()
  readonly renderPosition = new THREE.Vector3()
  grounded = false
  /** true exactly on the tick the controller lands (for landing FX). */
  justLanded = false
  /** downward speed at the moment of landing (for landing power). */
  landingVY = 0

  private prev = new THREE.Vector3()
  private accumulator = 0
  private input: ControllerInput = { moveX: 0, moveZ: 0, jumpHeld: false }
  private jumpBuffer = 0
  private coyote = 0
  private jumpCutApplied = false
  private colliders: THREE.Box3[] = []

  constructor(spawn: THREE.Vector3, private cfg: ControllerConfig) {
    this.position.copy(spawn)
    this.prev.copy(spawn)
    this.renderPosition.copy(spawn)
  }

  setColliders(boxes: THREE.Box3[]) { this.colliders = boxes }
  setInput(i: ControllerInput) { this.input = i }
  notifyJumpPressed() { this.jumpBuffer = this.cfg.jumpBufferTime }

  /** Teleport (respawn) — clears momentum so a respawn doesn't inherit a fall. */
  reset(to: THREE.Vector3) {
    this.position.copy(to); this.prev.copy(to); this.renderPosition.copy(to)
    this.velocity.set(0, 0, 0); this.accumulator = 0
    this.grounded = false; this.jumpBuffer = 0; this.coyote = 0
  }

  /** Directly set vertical velocity (jetpack thrust). */
  setVelocityY(v: number) { this.velocity.y = v }

  update(rawDt: number, opts?: { gravityScale?: number; suppressJump?: boolean }) {
    this.justLanded = false
    this.accumulator += Math.min(rawDt, MAX_FRAME_TIME)
    while (this.accumulator >= FIXED_DT) {
      this.prev.copy(this.position)
      this.step(FIXED_DT, opts?.gravityScale ?? 1, opts?.suppressJump ?? false)
      this.accumulator -= FIXED_DT
    }
    const alpha = this.accumulator / FIXED_DT
    this.renderPosition.lerpVectors(this.prev, this.position, alpha)
  }

  private step(dt: number, gravityScale: number, suppressJump: boolean) {
    const c = this.cfg
    // Horizontal: explicit accel / decel / turn (no lerp tail).
    const tx = (c.lockZ ? Math.sign(this.input.moveX) * Math.min(1, Math.abs(this.input.moveX)) : this.input.moveX) * c.maxSpeed
    const tz = c.lockZ ? 0 : this.input.moveZ * c.maxSpeed
    this.velocity.x = approach(this.velocity.x, tx, rate(this.velocity.x, tx, c) * dt)
    this.velocity.z = c.lockZ ? 0 : approach(this.velocity.z, tz, rate(this.velocity.z, tz, c) * dt)

    // Jump: coyote + buffer + variable height (skipped while jetpack drives Y).
    this.coyote = this.grounded ? c.coyoteTime : Math.max(0, this.coyote - dt)
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt)
    if (!suppressJump) {
      if (this.jumpBuffer > 0 && this.coyote > 0) {
        this.velocity.y = c.jumpSpeed
        this.jumpBuffer = 0; this.coyote = 0; this.jumpCutApplied = false; this.grounded = false
      }
      if (!this.input.jumpHeld && this.velocity.y > 0 && !this.jumpCutApplied) {
        this.velocity.y *= c.jumpCut
        this.jumpCutApplied = true
      }
      this.velocity.y -= c.gravity * gravityScale * dt
      if (this.velocity.y < -40) this.velocity.y = -40
    }

    // Swept, axis-separated resolution. Y first so landing is authoritative.
    const wasGrounded = this.grounded
    this.grounded = false
    const vyBefore = this.velocity.y
    this.moveAxis(1, this.velocity.y * dt)
    this.moveAxis(0, this.velocity.x * dt)
    if (!c.lockZ) this.moveAxis(2, this.velocity.z * dt)
    else this.position.z = 0

    if (this.grounded && !wasGrounded && vyBefore < -0.5) {
      this.justLanded = true
      this.landingVY = -vyBefore
    }
  }

  private moveAxis(axis: 0 | 1 | 2, delta: number) {
    if (delta === 0) return
    const a1 = ((axis + 1) % 3) as 0 | 1 | 2
    const a2 = ((axis + 2) % 3) as 0 | 1 | 2
    const pos = this.position.getComponent(axis)
    const halfA = this.cfg.half.getComponent(axis)
    const min1 = this.position.getComponent(a1) - this.cfg.half.getComponent(a1)
    const max1 = this.position.getComponent(a1) + this.cfg.half.getComponent(a1)
    const min2 = this.position.getComponent(a2) - this.cfg.half.getComponent(a2)
    const max2 = this.position.getComponent(a2) + this.cfg.half.getComponent(a2)
    const sign = Math.sign(delta)
    let allowed = delta
    for (const box of this.colliders) {
      if (box.max.getComponent(a1) <= min1 || box.min.getComponent(a1) >= max1) continue
      if (box.max.getComponent(a2) <= min2 || box.min.getComponent(a2) >= max2) continue
      if (sign > 0) {
        const gap = box.min.getComponent(axis) - (pos + halfA) - this.cfg.skin
        if (gap >= 0 && gap < allowed) allowed = gap
      } else {
        const gap = box.max.getComponent(axis) - (pos - halfA) + this.cfg.skin
        if (gap <= 0 && gap > allowed) allowed = gap
      }
    }
    this.position.setComponent(axis, pos + allowed)
    if (allowed !== delta) {
      if (axis === 1 && sign < 0) this.grounded = true
      this.velocity.setComponent(axis, 0)
    }
  }
}

/** Linear move toward target by at most maxDelta — reaches exactly, never overshoots. */
function approach(current: number, target: number, maxDelta: number): number {
  const d = target - current
  if (Math.abs(d) <= maxDelta) return target
  return current + Math.sign(d) * maxDelta
}

/** Pick accel / decel / turn rate based on whether we're driving, braking, or reversing. */
function rate(cur: number, target: number, c: ControllerConfig): number {
  const hasInput = Math.abs(target) > 1e-6
  if (!hasInput) return c.decel
  if (cur * target < 0) return c.turnAccel
  return c.accel
}
