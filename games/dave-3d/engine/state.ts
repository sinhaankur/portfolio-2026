/**
 * Shared, mutable game state for Dave 3D — written by the player/loop, read by the
 * camera + HUD. Module-scoped refs (not React state) so the per-frame loop never
 * triggers re-renders; the HUD polls these on an interval.
 */

import * as THREE from "three"

// "playing" → on a level; "levelClear" → brief beat after reaching the door;
// "won" → finished all 10 levels (final victory screen).
export type Phase = "playing" | "levelClear" | "won"

export const TOTAL_LEVELS = 10

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
    deathAt: -1, deathPos: new THREE.Vector3(),              // hazard hit → puff
  },
  gemsTotal: 0,
  gemsGot: 0,
  hasTrophy: false,
  // ── campaign progression ──
  levelIndex: 0,        // 0-based index into LEVELS (0..9)
  sideOn: false,        // true on side-on Dave screens (drives the camera mode)
  boundsW: 28,          // side-room world width  (for camera framing)
  boundsH: 18,          // side-room world height (for camera framing)
  deaths: 0,            // hazard/fall deaths on the current level
  // ── jetpack (level 6) ──
  hasJetpack: false,    // picked up the jetpack this level
  jetFuel: 0,           // 0..1 remaining flight fuel (drains while flying)
  phase: "playing" as Phase,
  /** bumped to force a restart (game-canvas watches it) */
  restartToken: 0,
}

/** Reset the per-level run state (gems, trophy, jetpack) — keeps levelIndex. */
export function resetGame() {
  game.gemsGot = 0
  game.hasTrophy = false
  game.hasJetpack = false
  game.jetFuel = 0
  game.phase = "playing"
}
