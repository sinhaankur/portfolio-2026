import type { GameState } from '../../../lib/neural-game-engine';
import { defendedWorlds, getWaveConfig, getDifficultyScale } from './worlds';

/**
 * Star Cleaver Game State initialization and helpers.
 */

/**
 * Create initial game state for a new game.
 */
export function createInitialGameState(): GameState {
  return {
    phase: 'briefing',
    worldIndex: 0,
    wave: 1,
    score: 0,
    comboMultiplier: 1,
    simTime: 0,
    waveStartTime: 0,

    playerEntity: {
      id: 'player_ship',
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      health: 100,
      maxHealth: 100,
      radius: 1,
      team: 'player',
      type: 'ship',
      active: true,
      metadata: {
        class: 'player_cleaver',
      },
    },

    playerMaxHealth: 100,
    chargeLevel: 0,
    chargeRate: 1.4, // units per second
    maxCharge: 1.0,
    canFire: true,

    enemies: [],
    allies: [],
    projectiles: [],
    events: [],
    entityIdCounter: 0,

    defendingPlanetId: defendedWorlds[0].id,
    defendingPlanetHealth: 1.0,
    leaksThisWave: 0,

    waveConfig: getWaveConfig(0, 1),
  };
}

/**
 * Set up a specific world and wave.
 */
export function setWorld(state: GameState, worldIndex: number, waveNumber: number): GameState {
  const world = defendedWorlds[worldIndex];
  const waveConfig = getWaveConfig(worldIndex, waveNumber);
  const difficulty = getDifficultyScale(worldIndex, waveNumber);

  return {
    ...state,
    worldIndex,
    wave: waveNumber,
    defendingPlanetId: world.id,
    defendingPlanetHealth: 1.0,
    leaksThisWave: 0,
    waveConfig: {
      enemyCount: Math.ceil(waveConfig.baseEnemyCount * difficulty),
      enemyTypes: waveConfig.enemyTypes,
      difficultyScale: difficulty,
    },
    enemies: [],
    allies: [],
    projectiles: [],
    events: [],
  };
}

/**
 * Transition to briefing for next world/wave.
 */
export function startBriefing(state: GameState): GameState {
  return {
    ...state,
    phase: 'briefing',
    simTime: 0,
  };
}

/**
 * Transition from briefing to combat.
 */
export function startCombat(state: GameState): GameState {
  return {
    ...state,
    phase: 'combat',
    simTime: 0,
    waveStartTime: 0,
  };
}

/**
 * Handle player input: start charging fire.
 */
export function startCharging(state: GameState): GameState {
  if (state.phase !== 'combat') return state;
  return {
    ...state,
    phase: 'charging',
  };
}

/**
 * Handle player input: release fire (execute charge).
 */
export function fireWeapon(state: GameState): GameState {
  if (state.phase !== 'charging') return state;
  return {
    ...state,
    phase: 'firing',
    chargeLevel: Math.min(state.chargeLevel, state.maxCharge),
    waveStartTime: state.simTime,
  };
}

/**
 * Cancel charging (player releases fire button before firing).
 */
export function cancelCharge(state: GameState): GameState {
  if (state.phase !== 'charging') return state;
  return {
    ...state,
    phase: 'combat',
    chargeLevel: 0,
  };
}

/**
 * Get briefing text for current world.
 */
export function getCurrentBriefing(state: GameState): string {
  const world = defendedWorlds[state.worldIndex];
  return world?.briefing || 'Defend your world.';
}

/**
 * Get world name.
 */
export function getCurrentWorldName(state: GameState): string {
  const world = defendedWorlds[state.worldIndex];
  return world?.name || 'Unknown World';
}

/**
 * Calculate combo multiplier based on consecutive successful waves.
 * Reset on damage taken, increase on perfect waves.
 */
export function updateComboMultiplier(state: GameState, damageThisFrame: boolean): GameState {
  if (damageThisFrame) {
    return {
      ...state,
      comboMultiplier: Math.max(1, state.comboMultiplier - 0.1),
    };
  }
  return state;
}

/**
 * Check if game is over (all worlds cleared).
 */
export function isGameWon(state: GameState): boolean {
  return state.worldIndex >= 6 && state.wave >= 4 && state.phase === 'victory';
}

/**
 * Check if game is lost (planet destroyed).
 */
export function isGameLost(state: GameState): boolean {
  return state.defendingPlanetHealth <= 0;
}

/**
 * Get progress percentage (0–100).
 */
export function getProgress(state: GameState): number {
  const totalWorlds = defendedWorlds.length;
  const waveProgress = (state.wave - 1) / 4; // 0–0.75
  const worldProgress = state.worldIndex / totalWorlds;
  return (worldProgress + (waveProgress / totalWorlds)) * 100;
}

/**
 * Format score with commas.
 */
export function formatScore(score: number): string {
  return score.toLocaleString();
}
