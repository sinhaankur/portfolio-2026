"use client"

/**
 * Star Cleaver — game state.
 *
 * Defender game. The Cleaver is humanity's last gun against an
 * alien force sweeping through the system. Each level is a real
 * world; aliens attack in waves; the player aims and fires the
 * beam to shoot them down before they reach the world.
 *
 * Phases:
 *  - title:      splash screen, "Begin defense" button
 *  - briefing:   world being defended is named, "Engage" to enter combat
 *  - combat:     continuous flight; aliens spawn in waves; player aims
 *  - charging:   fire button held — beam not yet released
 *  - firing:     beam visible, hitscan against active aliens
 *  - victory:    all waves cleared, world saved
 *  - defeat:     planet health hit zero
 *  - paused:     pause overlay
 *
 * Charge + fire is the only mechanic that needs explicit player
 * input. Aim updates continuously. Aliens move on their own. The
 * combat → firing transition is brief (~200ms beam) and returns
 * straight back to combat — no aftermath phase like the previous
 * destroyer build, because there are many enemies, not one.
 */

export type Phase =
  | "title"
  | "briefing"
  | "combat"
  | "charging"
  | "firing"
  | "victory"
  | "defeat"
  | "paused"

export type GameState = {
  phase: Phase
  /** Which world we're defending (0..WORLDS.length-1). */
  worldIndex: number
  /** Wave within the current world (1-indexed for display, 0-indexed for state). */
  wave: number
  /** 0..1 — drops when aliens reach the planet. Defeat at 0. */
  planetHealth: number
  /** Cumulative score across waves. */
  score: number
  /** Charge level 0..1. Builds while phase === "charging". */
  charge: number
  /** Aim point in normalized space (-1..1 each axis), relative to scene centre. */
  aim: { x: number; y: number }
  /** Whether the title screen still shows the origin-video link. */
  showOriginLink: boolean
}

export const INITIAL_STATE: GameState = {
  phase: "title",
  worldIndex: 0,
  wave: 0,
  planetHealth: 1,
  score: 0,
  charge: 0,
  aim: { x: 0, y: 0 },
  showOriginLink: true,
}

/** Required charge to fire. Forces a deliberate trigger pull. */
export const MIN_CHARGE_TO_FIRE = 0.25

/** Charge rate per second while button is held. */
export const CHARGE_PER_SEC = 1.4

/** Beam visible duration on fire. Short — hitscan resolves immediately. */
export const BEAM_DURATION_MS = 220

/** Waves per world. */
export const WAVES_PER_WORLD = 4

/** Base enemies per wave; multiplied by (1 + wave * 0.3) for escalation. */
export const ENEMIES_BASE = 6

/** Planet damage per alien that reaches the surface (in 0..1). */
export const DAMAGE_PER_LEAK = 0.18

/** Score per alien killed. */
export const SCORE_PER_KILL = 100

/** Score bonus per wave cleared. */
export const SCORE_PER_WAVE = 250

/** Pause between waves (briefing flash). */
export const INTERWAVE_PAUSE_MS = 1800

/** True if the current phase accepts aim input. */
export function isAimable(phase: Phase): boolean {
  return phase === "combat" || phase === "charging" || phase === "firing"
}

/** True if combat is active and aliens should advance. */
export function isCombatActive(phase: Phase): boolean {
  return phase === "combat" || phase === "charging" || phase === "firing"
}

/** How many enemies should spawn in this wave. */
export function enemiesForWave(wave: number): number {
  return Math.round(ENEMIES_BASE * (1 + wave * 0.35))
}
