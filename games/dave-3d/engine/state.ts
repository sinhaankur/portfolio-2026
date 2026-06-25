/**
 * Shared, mutable game state for Dave 3D — written by the player/loop, read by the
 * camera + HUD. Module-scoped refs (not React state) so the per-frame loop never
 * triggers re-renders; the HUD polls these on an interval.
 */

import * as THREE from "three"

export type Phase = "playing" | "won"

export const game = {
  // live player world position (camera follows this) — feet on the start pad
  playerPos: new THREE.Vector3(0, 0.5, 0),
  playerYaw: 0, // facing, radians
  // motion signals for procedural character + camera juice (written by Player):
  playerSpeed: 0,       // horizontal speed (units/s)
  playerVY: 0,          // vertical velocity (units/s)
  playerAir: false,     // true while airborne
  landImpact: 0,        // 0..1 spike on landing, decays — drives squash + cam shake
  // one-shot juice events: bumped/stamped by the player/gems, consumed by the
  // FX + SFX systems each frame (so they fire exactly once).
  fx: {
    jumpAt: -1,                                 // sim-time of last jump (whoosh)
    landAt: -1, landPos: new THREE.Vector3(), landPower: 0,  // dust puff
    collectAt: -1, collectPos: new THREE.Vector3(),          // gem sparkle + pop
  },
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
