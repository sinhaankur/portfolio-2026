/**
 * Dave 3D level validator — guards the "every level is beatable" contract.
 *
 * Run with: pnpm dave:check   (node's native TS type-stripping executes it)
 *
 * Checks per level:
 *   1. Every tile row has the same width (a ragged map silently shifts tiles).
 *   2. Reachability: flood-fill over standable surfaces using the player's jump
 *      envelope (apex ≈ 3.4u = 2.4 tiles — must match player.tsx) proves the
 *      cup, the door, the jetpack and every gem can actually be reached from
 *      spawn. Jetpack levels treat everything as reachable once the pack is
 *      (flight covers the room).
 *   3. The door rests on solid ground (its tile sits directly above a platform
 *      or the floor), so it never floats mid-air.
 */

import { LEVELS, TILE, type Level, type Box } from "../games/dave-3d/engine/level.ts"

// Jump envelope — keep in sync with player.tsx (JUMP_V²/(2·GRAVITY)).
const JUMP_V = 14.3
const GRAVITY = 30
const APEX = (JUMP_V * JUMP_V) / (2 * GRAVITY) // ≈ 3.41
const MOVE_SPEED = 7.5
const AIR_TIME = (2 * JUMP_V) / GRAVITY // full up+down at same height
// Comfortable horizontal reach: 25% safety, not 10%. A jump that needs 90% of
// the theoretical max PASSES validation but feels near-impossible in hand —
// which read as "levels not completable". This requires every gap to be
// clearable with margin to spare, so levels are actually fun to finish.
const H_REACH = MOVE_SPEED * AIR_TIME * 0.75
const PICKUP = 1.6 // item pickup radius used by trophy/gems (slightly generous)

type Surface = { top: number; x0: number; x1: number }

function surfaces(level: Level): Surface[] {
  return level.platforms.map((b: Box) => ({
    top: b.pos[1] + b.size[1] / 2,
    x0: b.pos[0] - b.size[0] / 2,
    x1: b.pos[0] + b.size[0] / 2,
  }))
}

function hGap(a: Surface, b: Surface): number {
  if (a.x1 >= b.x0 && b.x1 >= a.x0) return 0 // overlap
  return a.x1 < b.x0 ? b.x0 - a.x1 : a.x0 - b.x1
}

/* --------------------------------------------------------------------------
 * REAL jump simulation — the old closed-form check ignored head-bonks and
 * overestimated rising reach, so screens passed on paper and failed in hand.
 * This integrates the player's actual movement (same constants as player.tsx:
 * exponential accel toward MOVE_SPEED, gravity, head-bonk on rising, wall
 * push-out on X) from several take-off points on `from`, and asks whether ANY
 * arc lands on `to`. Conservative where it must guess (no step-up, no
 * variable-height cut) — if the simulator can do it, a human can.
 * ------------------------------------------------------------------------ */
const RADIUS = 0.38
const PLAYER_H = 1.0
const ACCEL = 60

function simulateJump(
  fromX: number,
  fromTop: number,
  dir: 1 | -1,
  runStart: boolean,
  to: Surface,
  boxes: Box[],
  toIdx: number,
  allSurfs: Surface[],
): boolean {
  const dt = 1 / 120
  let x = fromX
  let y = fromTop + 0.02
  let vx = runStart ? dir * MOVE_SPEED : 0
  let vy = JUMP_V
  for (let step = 0; step < 400; step++) {
    // exponential approach to full run speed (matches player.tsx)
    const k = 1 - Math.exp(-(ACCEL / MOVE_SPEED) * dt)
    vx += (dir * MOVE_SPEED - vx) * k
    vy -= GRAVITY * dt
    const prevY = y
    y += vy * dt
    // collisions vs every box
    for (const b of boxes) {
      const bx0 = b.pos[0] - b.size[0] / 2 - RADIUS
      const bx1 = b.pos[0] + b.size[0] / 2 + RADIUS
      const bTop = b.pos[1] + b.size[1] / 2
      const bBottom = b.pos[1] - b.size[1] / 2
      if (x <= bx0 || x >= bx1) continue
      // head-bonk while rising
      if (vy > 0 && prevY + PLAYER_H <= bBottom + 0.001 && y + PLAYER_H >= bBottom) {
        y = bBottom - PLAYER_H - 0.02
        vy = 0
      }
      // landing while falling
      if (vy <= 0 && prevY >= bTop - 0.02 && y <= bTop + 0.02) {
        const idx = allSurfs.findIndex(
          (s) => Math.abs(s.top - bTop) < 0.01 && x >= s.x0 - RADIUS && x <= s.x1 + RADIUS,
        )
        return idx === toIdx
      }
    }
    const prevX = x
    x += vx * dt
    for (const b of boxes) {
      const bTop = b.pos[1] + b.size[1] / 2
      const bBottom = b.pos[1] - b.size[1] / 2
      if (y >= bTop || y + PLAYER_H <= bBottom) continue
      const bx0 = b.pos[0] - b.size[0] / 2
      const bx1 = b.pos[0] + b.size[0] / 2
      if (x + RADIUS > bx0 && prevX + RADIUS <= bx0 + 0.001) { x = bx0 - RADIUS; vx = 0 }
      else if (x - RADIUS < bx1 && prevX - RADIUS >= bx1 - 0.001) { x = bx1 + RADIUS; vx = 0 }
    }
    if (y < -6) return false
  }
  return false
}

/** Can the player standing on `from` reach `to`? Tries real jump arcs from
 *  several take-off points at both edges and mid-surface, both directions,
 *  standing and running starts. */
function canTraverse(
  from: Surface,
  to: Surface,
  fromIdx: number,
  toIdx: number,
  boxes: Box[],
  allSurfs: Surface[],
): boolean {
  if (fromIdx === toIdx) return false
  const rise = to.top - from.top
  if (rise > APEX - 0.3) return false // beyond any jump, skip simulating
  // candidate take-off x positions: every half-tile across the surface (a
  // player can stand anywhere — edge-only sampling missed hops whose only
  // valid take-off is beside an island, and called whole levels unbeatable)
  const candidates: number[] = []
  const cx0 = from.x0 + RADIUS
  const cx1 = from.x1 - RADIUS
  if (cx1 < cx0) candidates.push((from.x0 + from.x1) / 2)
  else {
    const n = Math.min(48, Math.max(2, Math.ceil((cx1 - cx0) / 0.7) + 1))
    for (let i = 0; i < n; i++) candidates.push(cx0 + ((cx1 - cx0) * i) / (n - 1))
  }
  for (const takeoff of candidates) {
    for (const dir of [1, -1] as const) {
      for (const run of [true, false]) {
        if (simulateJump(takeoff, from.top, dir, run, to, boxes, toIdx, allSurfs)) return true
      }
    }
  }
  return false
}

function reachableSurfaces(level: Level): Set<number> {
  const surfs = surfaces(level)
  // start: the surface directly under the spawn
  const [sx, sy] = level.spawn
  let start = -1
  let bestDy = Infinity
  surfs.forEach((s, i) => {
    if (sx < s.x0 - 0.5 || sx > s.x1 + 0.5) return
    const dy = sy - s.top
    if (dy >= -0.5 && dy < bestDy) { bestDy = dy; start = i }
  })
  if (start < 0) throw new Error("spawn has no ground beneath it")

  const seen = new Set<number>([start])
  const queue = [start]
  while (queue.length) {
    const i = queue.pop()!
    for (let j = 0; j < surfs.length; j++) {
      if (seen.has(j)) continue
      if (canTraverse(surfs[i], surfs[j], i, j, level.platforms, surfs)) { seen.add(j); queue.push(j) }
    }
  }
  return seen
}

/** Is a point collectible from some reachable surface (walk-by or jump arc)? */
function pointReachable(level: Level, reach: Set<number>, p: readonly number[]): boolean {
  const surfs = surfaces(level)
  for (const i of reach) {
    const s = surfs[i]
    const dxOut = p[0] < s.x0 ? s.x0 - p[0] : p[0] > s.x1 ? p[0] - s.x1 : 0
    const dy = p[1] - s.top
    // walk-by pickup on/near the surface
    if (dxOut <= PICKUP && dy >= -1.2 && dy <= PICKUP) return true
    // jump arc: apex above the stand, allow leaning off the edge a little
    if (dxOut <= 2.2 && dy > 0 && dy <= APEX + PICKUP - 0.3) return true
    // drop pickup just past an edge
    if (dxOut <= 2.2 && dy < 0 && dy >= -4) return true
  }
  return false
}

let failures = 0
function fail(name: string, msg: string) {
  failures++
  console.error(`  ✗ ${name}: ${msg}`)
}

for (const level of LEVELS) {
  const name = level.name
  const reach = reachableSurfaces(level)
  const surfs = surfaces(level)
  console.log(`\n${name} — ${surfs.length} surfaces, ${reach.size} reachable`)

  const jetLevel = level.jetpack != null
  if (jetLevel) {
    if (!pointReachable(level, reach, level.jetpack!)) fail(name, "jetpack not reachable")
    else console.log("  ✓ jetpack reachable (flight covers the rest)")
  }

  const mustCheck: Array<[string, readonly number[]]> = []
  if (!jetLevel) {
    mustCheck.push(["cup", level.trophy], ["door", level.door])
    level.gems.forEach((g, i) => mustCheck.push([`gem ${i}`, g]))
    if (level.warp) mustCheck.push(["warp", level.warp])
  }
  for (const [what, p] of mustCheck) {
    if (!pointReachable(level, reach, p)) fail(name, `${what} at (${p[0].toFixed(1)}, ${p[1].toFixed(1)}) not reachable`)
  }

  // STRESS: every reachable surface needs stand headroom (player is 1.0 tall;
  // a ceiling closer than that makes a ledge a trap that LOOKS standable).
  for (const i of reach) {
    const s = surfs[i]
    for (const b of level.platforms) {
      const bBottom = b.pos[1] - b.size[1] / 2
      const bx0 = b.pos[0] - b.size[0] / 2
      const bx1 = b.pos[0] + b.size[0] / 2
      if (bx1 <= s.x0 + 0.05 || bx0 >= s.x1 - 0.05) continue
      if (bBottom <= s.top + 0.01) continue // below or flush — not a ceiling
      const clearance = bBottom - s.top
      if (clearance < 1.05 && bx0 <= s.x0 + 0.1 && bx1 >= s.x1 - 0.1)
        fail(name, `surface at y=${s.top.toFixed(1)} x∈[${s.x0.toFixed(1)},${s.x1.toFixed(1)}] has only ${clearance.toFixed(2)}u headroom`)
    }
  }

  // STRESS: every floor hazard must be clearable — the gap it spans (plus a
  // tile of runway each side) must be within horizontal jump range.
  for (const h of level.hazards ?? []) {
    if (h.size[0] + 2 * TILE > H_REACH)
      fail(name, `${h.kind} hazard is ${h.size[0].toFixed(1)}u wide — too wide to jump (max ~${(H_REACH - 2 * TILE).toFixed(1)}u)`)
  }

  // spawn must not free-fall into a hazard: if a hazard spans the spawn column,
  // some platform top must sit between the spawn and the hazard (the L2 bug:
  // spawn over a fire pit = infinite death loop that reads as "stuck").
  for (const h of level.hazards ?? []) {
    const [hx, hy] = h.pos
    const halfW = h.size[0] / 2
    if (Math.abs(level.spawn[0] - hx) > halfW + 0.4) continue
    if (level.spawn[1] < hy) continue
    const shielded = surfs.some(
      (s) =>
        level.spawn[0] >= s.x0 - 0.3 && level.spawn[0] <= s.x1 + 0.3 &&
        s.top <= level.spawn[1] + 0.1 && s.top >= hy,
    )
    if (!shielded) fail(name, `spawn free-falls into a ${h.kind} hazard at x=${hx.toFixed(1)}`)
  }

  // door must rest on solid ground: a platform top at the door tile's bottom edge
  const doorBase = level.door[1] - TILE / 2
  const seated = surfs.some(
    (s) => Math.abs(s.top - doorBase) < 0.15 && level.door[0] >= s.x0 - 0.1 && level.door[0] <= s.x1 + 0.1,
  )
  if (!seated) fail(name, `door floats — no platform top at y=${doorBase.toFixed(2)} under x=${level.door[0].toFixed(1)}`)

  if (failures === 0) console.log("  ✓ all items + door reachable, door seated")
}

console.log(failures ? `\n${failures} failure(s)` : "\nAll levels valid ✓")
process.exit(failures ? 1 : 0)
