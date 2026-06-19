/**
 * Shared, mutable game state for Dave 3D — written by the player/loop, read by the
 * camera + HUD. Module-scoped refs (not React state) so the per-frame loop never
 * triggers re-renders; the HUD polls these on an interval.
 */

import * as THREE from "three"

export type Phase = "playing" | "won"

export const game = {
  // live player world position (camera follows this)
  playerPos: new THREE.Vector3(0, 1.5, 0),
  playerYaw: 0, // facing, radians
  gemsTotal: 0,
  gemsGot: 0,
  hasTrophy: false,
  phase: "playing" as Phase,
  /** bumped to force a restart (game-canvas watches it) */
  restartToken: 0,
}

export function resetGame() {
  game.gemsGot = 0
  game.hasTrophy = false
  game.phase = "playing"
}
