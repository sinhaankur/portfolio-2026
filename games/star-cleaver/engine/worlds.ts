import type { DefendedWorld } from '../../../lib/neural-game-engine';

/**
 * Star Cleaver: 7 Worlds to Defend
 * Based on real astronomical bodies from Universe Engine.
 * Progression: inner solar system → exoplanets.
 */

export const defendedWorlds: DefendedWorld[] = [
  {
    id: 'Earth',
    name: 'Earth',
    briefing: 'Our homeworld is under attack. Defend the cradle of civilization.',
    planetIndex: 2, // Earth is at index 2 in Universe Engine's planetsData
    waveConfigs: [
      {
        wave: 1,
        baseEnemyCount: 6,
        enemyTypes: [{ type: 'fighter', weight: 1 }],
      },
      {
        wave: 2,
        baseEnemyCount: 8,
        enemyTypes: [
          { type: 'fighter', weight: 0.7 },
          { type: 'sniper', weight: 0.3 },
        ],
      },
      {
        wave: 3,
        baseEnemyCount: 10,
        enemyTypes: [
          { type: 'fighter', weight: 0.6 },
          { type: 'sniper', weight: 0.4 },
        ],
      },
      {
        wave: 4,
        baseEnemyCount: 3,
        enemyTypes: [{ type: 'boss', weight: 1 }],
        bossType: 'warbird',
      },
    ],
  },

  {
    id: 'Mars',
    name: 'Mars',
    briefing: 'The red planet is humanity\'s second home. Protect our colony.',
    planetIndex: 3, // Mars
    waveConfigs: [
      {
        wave: 1,
        baseEnemyCount: 7,
        enemyTypes: [{ type: 'fighter', weight: 1 }],
      },
      {
        wave: 2,
        baseEnemyCount: 9,
        enemyTypes: [
          { type: 'fighter', weight: 0.6 },
          { type: 'sniper', weight: 0.4 },
        ],
      },
      {
        wave: 3,
        baseEnemyCount: 12,
        enemyTypes: [
          { type: 'fighter', weight: 0.5 },
          { type: 'sniper', weight: 0.3 },
          { type: 'swarm', weight: 0.2 },
        ],
      },
      {
        wave: 4,
        baseEnemyCount: 4,
        enemyTypes: [{ type: 'boss', weight: 1 }],
        bossType: 'decimator',
      },
    ],
  },

  {
    id: 'Europa',
    name: 'Europa',
    briefing: 'Jupiter\'s icy moon holds the secrets of life beneath the ice.',
    planetIndex: 11, // Europa (moon of Jupiter)
    waveConfigs: [
      {
        wave: 1,
        baseEnemyCount: 8,
        enemyTypes: [{ type: 'fighter', weight: 1 }],
      },
      {
        wave: 2,
        baseEnemyCount: 10,
        enemyTypes: [
          { type: 'fighter', weight: 0.5 },
          { type: 'swarm', weight: 0.5 },
        ],
      },
      {
        wave: 3,
        baseEnemyCount: 14,
        enemyTypes: [
          { type: 'fighter', weight: 0.4 },
          { type: 'sniper', weight: 0.3 },
          { type: 'swarm', weight: 0.3 },
        ],
      },
      {
        wave: 4,
        baseEnemyCount: 5,
        enemyTypes: [{ type: 'boss', weight: 1 }],
        bossType: 'apex',
      },
    ],
  },

  {
    id: 'Titan',
    name: 'Titan',
    briefing: 'Saturn\'s largest moon is a world of methane lakes and mystery.',
    planetIndex: 15, // Titan (moon of Saturn)
    waveConfigs: [
      {
        wave: 1,
        baseEnemyCount: 9,
        enemyTypes: [{ type: 'swarm', weight: 1 }],
      },
      {
        wave: 2,
        baseEnemyCount: 12,
        enemyTypes: [
          { type: 'fighter', weight: 0.4 },
          { type: 'swarm', weight: 0.6 },
        ],
      },
      {
        wave: 3,
        baseEnemyCount: 16,
        enemyTypes: [
          { type: 'fighter', weight: 0.3 },
          { type: 'sniper', weight: 0.2 },
          { type: 'swarm', weight: 0.5 },
        ],
      },
      {
        wave: 4,
        baseEnemyCount: 6,
        enemyTypes: [{ type: 'boss', weight: 1 }],
        bossType: 'reaper',
      },
    ],
  },

  {
    id: 'Proxima Centauri b',
    name: 'Proxima Centauri b',
    briefing: 'Our first exoplanet settlement at the edge of the galaxy. Hold the line.',
    planetIndex: -1, // Will be handled as a sky point, not a planet
    waveConfigs: [
      {
        wave: 1,
        baseEnemyCount: 10,
        enemyTypes: [{ type: 'sniper', weight: 1 }],
      },
      {
        wave: 2,
        baseEnemyCount: 13,
        enemyTypes: [
          { type: 'fighter', weight: 0.3 },
          { type: 'sniper', weight: 0.7 },
        ],
      },
      {
        wave: 3,
        baseEnemyCount: 18,
        enemyTypes: [
          { type: 'fighter', weight: 0.2 },
          { type: 'sniper', weight: 0.5 },
          { type: 'swarm', weight: 0.3 },
        ],
      },
      {
        wave: 4,
        baseEnemyCount: 7,
        enemyTypes: [{ type: 'boss', weight: 1 }],
        bossType: 'tyrant',
      },
    ],
  },

  {
    id: 'TRAPPIST-1e',
    name: 'TRAPPIST-1e',
    briefing: 'A habitable world in a distant system. Civilization depends on your skill.',
    planetIndex: -1, // Sky point
    waveConfigs: [
      {
        wave: 1,
        baseEnemyCount: 11,
        enemyTypes: [
          { type: 'fighter', weight: 0.5 },
          { type: 'sniper', weight: 0.5 },
        ],
      },
      {
        wave: 2,
        baseEnemyCount: 14,
        enemyTypes: [
          { type: 'fighter', weight: 0.3 },
          { type: 'sniper', weight: 0.3 },
          { type: 'swarm', weight: 0.4 },
        ],
      },
      {
        wave: 3,
        baseEnemyCount: 20,
        enemyTypes: [
          { type: 'fighter', weight: 0.2 },
          { type: 'sniper', weight: 0.3 },
          { type: 'swarm', weight: 0.5 },
        ],
      },
      {
        wave: 4,
        baseEnemyCount: 8,
        enemyTypes: [{ type: 'boss', weight: 1 }],
        bossType: 'sovereign',
      },
    ],
  },

  {
    id: 'Kepler-186f',
    name: 'Kepler-186f',
    briefing: 'The last stronghold of humanity. Defend it or lose everything.',
    planetIndex: -1, // Sky point
    waveConfigs: [
      {
        wave: 1,
        baseEnemyCount: 12,
        enemyTypes: [
          { type: 'fighter', weight: 0.4 },
          { type: 'sniper', weight: 0.3 },
          { type: 'swarm', weight: 0.3 },
        ],
      },
      {
        wave: 2,
        baseEnemyCount: 16,
        enemyTypes: [
          { type: 'fighter', weight: 0.25 },
          { type: 'sniper', weight: 0.25 },
          { type: 'swarm', weight: 0.5 },
        ],
      },
      {
        wave: 3,
        baseEnemyCount: 22,
        enemyTypes: [
          { type: 'fighter', weight: 0.15 },
          { type: 'sniper', weight: 0.25 },
          { type: 'swarm', weight: 0.6 },
        ],
      },
      {
        wave: 4,
        baseEnemyCount: 10,
        enemyTypes: [{ type: 'boss', weight: 1 }],
        bossType: 'annihilator',
      },
    ],
  },
];

/**
 * Get world by index (0–6).
 */
export function getWorld(worldIndex: number): DefendedWorld {
  return defendedWorlds[worldIndex];
}

/**
 * Get wave config for a world and wave number.
 */
export function getWaveConfig(worldIndex: number, waveNumber: number) {
  const world = getWorld(worldIndex);
  const config = world.waveConfigs.find((w) => w.wave === waveNumber);
  if (!config) throw new Error(`No wave config for world ${worldIndex} wave ${waveNumber}`);
  return config;
}

/**
 * Calculate difficulty scale for a wave.
 * Used to scale enemy count, health, damage.
 */
export function getDifficultyScale(worldIndex: number, waveNumber: number): number {
  return 1 + waveNumber * 0.3 + worldIndex * 0.15;
}
