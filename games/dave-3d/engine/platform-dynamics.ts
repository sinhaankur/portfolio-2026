/**
 * platform-dynamics — the "living world" motion controller for Ritam 3D.
 *
 * A platform's authored `pos` in the Level is its ANCHOR. Each frame the
 * controller computes a live position from the box's `dyn` (moveX / moveY /
 * orbit / crumble) and writes it straight back into `box.pos`. That's the key
 * trick: player.tsx already reads `box.pos` live for collision, so a moving
 * platform pushes + carries the player for free — and the renderer reads the
 * same live pos so it visibly moves too.
 *
 * State (anchors, crumble timers) lives per-run in a module map keyed by the
 * box object identity, reset via `resetDynamics()` on level (re)load.
 */
import type { Box, Level, Vec3 } from "./level"

type Runtime = {
  anchor: Vec3
  // crumble state machine: solid → shaking → falling → gone → (respawn) solid
  crumblePhase: "solid" | "shaking" | "falling" | "gone"
  crumbleT: number
  fallVY: number
}

const state = new WeakMap<Box, Runtime>()

/** last-frame delta of each dynamic platform, so the player can be carried. */
export type PlatformDelta = { box: Box; dx: number; dy: number }
let lastDeltas: PlatformDelta[] = []

export function resetDynamics(level: Level) {
  for (const b of level.platforms) {
    if (!b.dyn) continue
    state.set(b, {
      anchor: [b.pos[0], b.pos[1], b.pos[2]],
      crumblePhase: "solid",
      crumbleT: 0,
      fallVY: 0,
    })
  }
  lastDeltas = []
}

/** True if a box is currently a solid surface (crumbled-away platforms aren't). */
export function isBoxSolid(b: Box): boolean {
  const rt = state.get(b)
  if (!rt || !b.dyn) return true
  if (b.dyn.kind === "crumble") return rt.crumblePhase !== "gone"
  return true
}

/** Tell a crumble platform the player is standing on it (starts the timer). */
export function touchCrumble(b: Box) {
  const rt = state.get(b)
  if (rt && b.dyn?.kind === "crumble" && rt.crumblePhase === "solid") {
    rt.crumblePhase = "shaking"
    rt.crumbleT = 0
  }
}

/**
 * Advance all dynamic platforms by dt, mutating each `box.pos`. Returns the
 * per-platform position deltas this frame (for player carry-along).
 */
export function tickDynamics(level: Level, dt: number, t: number): PlatformDelta[] {
  const deltas: PlatformDelta[] = []
  for (const b of level.platforms) {
    if (!b.dyn) continue
    let rt = state.get(b)
    if (!rt) { resetDynamics(level); rt = state.get(b)! }
    const [ax, ay] = rt.anchor
    const before0 = b.pos[0]
    const before1 = b.pos[1]

    switch (b.dyn.kind) {
      case "moveX": {
        const sp = b.dyn.speed ?? 1
        const ph = b.dyn.phase ?? 0
        b.pos[0] = ax + Math.sin(t * sp + ph) * b.dyn.span
        b.pos[1] = ay
        break
      }
      case "moveY": {
        const sp = b.dyn.speed ?? 1
        const ph = b.dyn.phase ?? 0
        b.pos[0] = ax
        b.pos[1] = ay + Math.sin(t * sp + ph) * b.dyn.span
        break
      }
      case "orbit": {
        const sp = b.dyn.speed ?? 1
        const ph = b.dyn.phase ?? 0
        b.pos[0] = ax + Math.cos(t * sp + ph) * b.dyn.radius
        b.pos[1] = ay + Math.sin(t * sp + ph) * b.dyn.radius
        break
      }
      case "crumble": {
        const delay = b.dyn.delay ?? 0.55
        const respawn = b.dyn.respawn ?? 2.5
        if (rt.crumblePhase === "shaking") {
          rt.crumbleT += dt
          // shudder in place, then let go
          b.pos[0] = ax + Math.sin(t * 40) * 0.03
          b.pos[1] = ay + Math.sin(t * 52) * 0.02
          if (rt.crumbleT >= delay) { rt.crumblePhase = "falling"; rt.fallVY = 0 }
        } else if (rt.crumblePhase === "falling") {
          rt.fallVY -= 28 * dt
          b.pos[1] += rt.fallVY * dt
          rt.crumbleT += dt
          if (b.pos[1] < ay - 14) { rt.crumblePhase = "gone"; rt.crumbleT = 0 }
        } else if (rt.crumblePhase === "gone") {
          rt.crumbleT += dt
          // park it far below so it can't collide, then respawn at the anchor
          b.pos[1] = ay - 999
          if (rt.crumbleT >= respawn) {
            rt.crumblePhase = "solid"; rt.crumbleT = 0; rt.fallVY = 0
            b.pos[0] = ax; b.pos[1] = ay
          }
        } else {
          b.pos[0] = ax; b.pos[1] = ay
        }
        break
      }
    }
    deltas.push({ box: b, dx: b.pos[0] - before0, dy: b.pos[1] - before1 })
  }
  lastDeltas = deltas
  return deltas
}

export function getLastDeltas(): PlatformDelta[] { return lastDeltas }
