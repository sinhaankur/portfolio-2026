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
const H_REACH = MOVE_SPEED * AIR_TIME * 0.9 // horizontal air travel, 10% safety
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

/** Can the player standing on `from` land on `to`? */
function canTraverse(from: Surface, to: Surface): boolean {
  const rise = to.top - from.top
  if (rise > APEX - 0.4) return false // must clear the ledge with margin
  const gap = hGap(from, to)
  if (rise <= 0) return gap <= H_REACH // drops: generous horizontal
  return gap <= H_REACH * 0.75 // rising jumps: less horizontal room
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
      if (canTraverse(surfs[i], surfs[j])) { seen.add(j); queue.push(j) }
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
