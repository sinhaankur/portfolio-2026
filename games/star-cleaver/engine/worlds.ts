import type { DefendedWorld } from '../../../lib/neural-game-engine';
// Star Cleaver: Only Earth is present in this minimal build.

export const defendedWorlds: DefendedWorld[] = [
  {
    id: 'Earth',
    name: 'Earth',
    briefing: 'Our homeworld is under attack. Defend the cradle of civilization.',
    planetIndex: 2, // Earth index in Universe Engine's planetsData
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
];

/**
 * Get wave config for a world and wave number.
 */
export function getWaveConfig(worldIndex: number, waveNumber: number) {
  const world = defendedWorlds[worldIndex];
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
