import type { THREE } from '@react-three/fiber';

/**
 * Core entity type for all game objects (player, enemies, NPCs, projectiles).
 * Extends basic spatial + physics data, no direct mesh reference (decoupled).
 */
export interface GameEntity {
  id: string;
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  health: number;
  maxHealth: number;
  radius: number; // collision radius in scene units
  team: 'player' | 'enemy' | 'ally' | 'neutral';
  type: 'ship' | 'projectile' | 'explosion' | 'pickup' | 'hazard';
  active: boolean;
  metadata?: Record<string, any>;
}

/**
 * Action command returned by AI or input system.
 * Consumed by game loop to drive entity behavior.
 */
export interface ActionCommand {
  type: 'move' | 'fire' | 'charge' | 'idle' | 'dodge' | 'scan' | 'read_memory' | 'custom';
  target?: { x: number; y: number; z: number };
  intensity?: number; // 0–1, used for charge level, aim precision, etc.
  metadata?: Record<string, any>;
  reason?: string; // debug: why did the AI choose this?
}

/**
 * World state snapshot passed to AI agents for decision-making.
 * Filtered by field-of-view to reduce token count.
 */
export interface ReasoningContext {
  simTime: number; // cumulative simulation seconds
  wave: number;
  worldIndex: number;
  playerEntity: GameEntity;
  playerHealth: number;
  nearbyEnemies: Array<GameEntity & { distance: number }>;
  nearbyAllies: Array<GameEntity & { distance: number }>;
  visibleProjectiles: GameEntity[];
  lastActions: ActionCommand[]; // memory: last N actions from this agent
  events: GameEvent[]; // recent events (damage taken, killed, etc.)
  metadata?: Record<string, any>;
}

/**
 * Game event: used for scoring, AI memory, phase transitions.
 */
export interface GameEvent {
  type: 'entity_killed' | 'entity_damaged' | 'wave_started' | 'wave_cleared' | 'world_cleared' | 'game_over';
  source?: string; // entity id that caused it
  target?: string; // entity id that was affected
  amount?: number; // damage, score, etc.
  timestamp: number; // sim seconds
}

/**
 * Persistent memory buffer for an entity (NPC/enemy).
 * Carries knowledge across waves and worlds.
 */
export interface MemoryBuffer {
  entityId: string;
  observations: Array<{
    type: 'player_position' | 'player_action' | 'damage_taken' | 'kill_confirmed' | 'custom';
    detail: string;
    timestamp: number;
  }>;
  maxSize: number; // max observations to keep (FIFO buffer)
}

/**
 * Complete game state for a defender game session.
 * Enough to serialize/deserialize for save/load.
 */
export interface GameState {
  phase: 'opening' | 'nexus' | 'briefing' | 'ignition' | 'combat' | 'charging' | 'firing' | 'victory' | 'defeat' | 'upgrade' | 'paused';
  worldIndex: number; // 0–6: Earth → Kepler-186f
  wave: number; // 1–4 per world
  score: number;
  comboMultiplier: number;
  simTime: number; // cumulative seconds since game start
  waveStartTime: number;
  ignitionStartTime?: number; // when ignition sequence began (for timing animation)
  selectedShip?: 'default-xwing' | 't70-xwing' | 'x-blade'; // currently selected ship variant
  worldsCompleted: number; // total worlds beaten (for ship unlocks)

  playerEntity: GameEntity;
  playerMaxHealth: number;
  chargeLevel: number; // 0–1
  chargeRate: number; // units per second
  maxCharge: number; // 1.0
  canFire: boolean;

  enemies: GameEntity[];
  allies: GameEntity[];
  projectiles: GameEntity[];
  events: GameEvent[];
  entityIdCounter: number; // for generating unique IDs

  defendingPlanetId: string; // 'Earth', 'Mars', etc.
  defendingPlanetHealth: number; // 0–1
  leaksThisWave: number; // count of enemies that reached the planet

  waveConfig: {
    enemyCount: number;
    enemyTypes: Array<{ type: string; count: number }>;
    difficultyScale: number; // 1 + (wave * 0.3)
  };

  metadata?: Record<string, any>;
}

/**
 * Neural agent configuration and interface.
 * Used to instantiate AI-powered NPCs/enemies.
 */
export interface NeuralAgentConfig {
  id: string;
  systemPrompt: string;
  tools?: Record<string, (args: any) => Promise<any>>;
  memoryBuffer?: MemoryBuffer;
  modelId?: string; // 'claude-opus-4-7' | 'claude-sonnet-4-6' | 'claude-haiku-4-5'
  cachePrompt?: boolean; // use prompt caching
  temperature?: number;
  maxTokens?: number;
}

/**
 * World definition (planet to defend).
 * Extends Universe Engine Planet data.
 */
export interface DefendedWorld {
  id: string; // 'Earth', 'Mars', etc.
  name: string;
  briefing: string;
  planetIndex: number; // index into planetsData from universe-engine
  waveConfigs: Array<{
    wave: number;
    baseEnemyCount: number;
    enemyTypes: Array<{ type: string; weight: number }>;
    bossType?: string;
  }>;
}

/**
 * Procedural ship config (for generation or variant lookup).
 */
export interface ShipConfig {
  class: 'fighter' | 'corvette' | 'destroyer' | 'cruiser';
  faction: 'player' | 'alien_basic' | 'alien_sniper' | 'alien_swarm' | 'boss';
  seed: number; // for deterministic generation
  color1?: { r: number; g: number; b: number };
  color2?: { r: number; g: number; b: number };
  scale?: number;
}

/**
 * Collision raycast hit result.
 */
export interface CollisionHit {
  entity: GameEntity;
  distance: number;
  point: { x: number; y: number; z: number };
  normal: { x: number; y: number; z: number };
}
