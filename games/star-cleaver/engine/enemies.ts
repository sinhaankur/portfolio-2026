import type { GameEntity } from '../../../lib/neural-game-engine';
import { createNeuralAgent } from '../../../lib/neural-game-engine';

/**
 * Enemy Archetypes: Factories for different enemy types.
 * Each creates a GameEntity + an AI agent to control it.
 */

export interface EnemyFactory {
  entity: GameEntity;
  agentId: string;
  type: 'fighter' | 'sniper' | 'swarm' | 'boss';
}

/**
 * Fighter: Aggressive, charges directly, basic tactics.
 */
export function createFighter(id: string, position: { x: number; y: number; z: number }): EnemyFactory {
  return {
    type: 'fighter',
    agentId: `ai_${id}`,
    entity: {
      id,
      position,
      velocity: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      health: 30,
      maxHealth: 30,
      radius: 0.8,
      team: 'enemy',
      type: 'ship',
      active: true,
      metadata: {
        class: 'fighter',
        damage: 10,
        fireRate: 0.5,
      },
    },
  };
}

/**
 * Sniper: Keeps distance, aims carefully, precise fire.
 */
export function createSniper(id: string, position: { x: number; y: number; z: number }): EnemyFactory {
  return {
    type: 'sniper',
    agentId: `ai_${id}`,
    entity: {
      id,
      position,
      velocity: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      health: 25,
      maxHealth: 25,
      radius: 0.7,
      team: 'enemy',
      type: 'ship',
      active: true,
      metadata: {
        class: 'sniper',
        damage: 15,
        fireRate: 0.3,
        preferredRange: 80,
      },
    },
  };
}

/**
 * Swarm: Low health, spawns in groups, tries to overwhelm.
 */
export function createSwarm(id: string, position: { x: number; y: number; z: number }): EnemyFactory {
  return {
    type: 'swarm',
    agentId: `ai_${id}`,
    entity: {
      id,
      position,
      velocity: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      health: 15,
      maxHealth: 15,
      radius: 0.5,
      team: 'enemy',
      type: 'ship',
      active: true,
      metadata: {
        class: 'swarm',
        damage: 5,
        fireRate: 1.0,
        speed: 25, // faster than fighters
      },
    },
  };
}

/**
 * Boss: High health, learns from player tactics, multi-phase behavior.
 */
export function createBoss(
  id: string,
  position: { x: number; y: number; z: number },
  variant: string
): EnemyFactory {
  const stats = {
    warbird: { health: 200, damage: 25, fireRate: 0.4, phase1Speed: 15 },
    decimator: { health: 250, damage: 30, fireRate: 0.3, phase1Speed: 12 },
    apex: { health: 280, damage: 35, fireRate: 0.25, phase1Speed: 10 },
    reaper: { health: 300, damage: 40, fireRate: 0.2, phase1Speed: 8 },
    tyrant: { health: 320, damage: 45, fireRate: 0.25, phase1Speed: 10 },
    sovereign: { health: 350, damage: 50, fireRate: 0.3, phase1Speed: 12 },
    annihilator: { health: 400, damage: 60, fireRate: 0.35, phase1Speed: 15 },
  };

  const stat = stats[variant as keyof typeof stats] || stats.warbird;

  return {
    type: 'boss',
    agentId: `ai_${id}`,
    entity: {
      id,
      position,
      velocity: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      health: stat.health,
      maxHealth: stat.health,
      radius: 2.5,
      team: 'enemy',
      type: 'ship',
      active: true,
      metadata: {
        class: 'boss',
        variant,
        damage: stat.damage,
        fireRate: stat.fireRate,
        phase: 1,
        phase1Speed: stat.phase1Speed,
      },
    },
  };
}

/**
 * Factory selector: create enemy of given type.
 */
export function createEnemy(
  type: string,
  id: string,
  position: { x: number; y: number; z: number }
): EnemyFactory {
  switch (type) {
    case 'fighter':
      return createFighter(id, position);
    case 'sniper':
      return createSniper(id, position);
    case 'swarm':
      return createSwarm(id, position);
    case 'boss':
      return createBoss(id, position, 'warbird');
    default:
      return createFighter(id, position);
  }
}

/**
 * Create AI agent for an enemy.
 * Different types have different system prompts.
 */
export function createEnemyAI(type: string, agentId: string) {
  switch (type) {
    case 'fighter':
      return createNeuralAgent(agentId, 'fighter');
    case 'sniper':
      return createNeuralAgent(agentId, 'sniper');
    case 'swarm':
      return createNeuralAgent(agentId, 'swarm');
    case 'boss':
      return createNeuralAgent(agentId, 'boss');
    default:
      return createNeuralAgent(agentId, 'fighter');
  }
}
