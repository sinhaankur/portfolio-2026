/**
 * Helion Drift — Roguelike run + meta state.
 *
 * See games/star-cleaver/ROGUELIKE.md for the design. This module is the spine
 * of the core loop: it owns the per-run state (lost on death) and the
 * persistent meta state (banked salvage + permanent upgrades, survives death).
 *
 * Pure data + functions — no React, no Three. State lives in the existing
 * GameState.metadata escape hatch (`metadata.run`) so we don't have to touch
 * the shared GameState interface, and meta is mirrored to localStorage so
 * progression persists across page loads.
 */

export type UpgradeId = 'hull' | 'cannons' | 'drive';

export interface RunState {
  sectorIndex: number;   // how deep this run has gone (0-based)
  runSalvage: number;    // collected this run, NOT yet banked (lost on death)
  runKills: number;      // enemies destroyed this run
  hullAtEntry: number;   // hull % when the current sector began
  sectorCleared: boolean; // all sector enemies destroyed → gate active
  active: boolean;       // a run is in progress
}

export interface MetaState {
  bankedSalvage: number;            // spendable currency (persists)
  upgrades: Record<UpgradeId, number>; // owned levels per upgrade
  bestSector: number;               // deepest sector reached, ever
  totalRuns: number;                // runs started, ever
  totalExtracts: number;            // successful extractions, ever
}

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  blurb: string;
  maxLevel: number;
  /** salvage cost to buy the NEXT level (0-based index = current level) */
  costs: number[];
  /** human-readable effect at a given owned level */
  effectLabel: (level: number) => string;
}

export const UPGRADES: Record<UpgradeId, UpgradeDef> = {
  hull: {
    id: 'hull',
    name: 'Reinforced Hull',
    blurb: 'Ablative plating. Survive deeper sectors.',
    maxLevel: 3,
    costs: [120, 280, 560],
    effectLabel: (lvl) => `+${lvl * 25}% max hull`,
  },
  cannons: {
    id: 'cannons',
    name: 'Overcharged Cannons',
    blurb: 'Hotter coils. Tear through hulls faster.',
    maxLevel: 3,
    costs: [140, 320, 640],
    effectLabel: (lvl) => `+${lvl * 30}% weapon damage`,
  },
  drive: {
    id: 'drive',
    name: 'Tuned Drive',
    blurb: 'Reworked thrusters. Reposition and escape.',
    maxLevel: 3,
    costs: [100, 240, 480],
    effectLabel: (lvl) => `+${lvl * 20}% boost & accel`,
  },
};

const META_STORAGE_KEY = 'helion-drift-meta-v1';

export function defaultMeta(): MetaState {
  return {
    bankedSalvage: 0,
    upgrades: { hull: 0, cannons: 0, drive: 0 },
    bestSector: 0,
    totalRuns: 0,
    totalExtracts: 0,
  };
}

export function loadMeta(): MetaState {
  if (typeof window === 'undefined') return defaultMeta();
  try {
    const raw = window.localStorage.getItem(META_STORAGE_KEY);
    if (!raw) return defaultMeta();
    const parsed = JSON.parse(raw) as Partial<MetaState>;
    const base = defaultMeta();
    return {
      ...base,
      ...parsed,
      // merge upgrades so a newly-added upgrade id defaults to 0
      upgrades: { ...base.upgrades, ...(parsed.upgrades ?? {}) },
    };
  } catch {
    return defaultMeta();
  }
}

export function saveMeta(meta: MetaState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(META_STORAGE_KEY, JSON.stringify(meta));
  } catch {
    /* storage full / blocked — non-fatal, progression just won't persist */
  }
}

export function newRun(): RunState {
  return {
    sectorIndex: 0,
    runSalvage: 0,
    runKills: 0,
    hullAtEntry: 1,
    sectorCleared: false,
    active: true,
  };
}

// ---- upgrade economy ----------------------------------------------------

/** Cost to buy the next level of an upgrade, or null if maxed. */
export function nextUpgradeCost(meta: MetaState, id: UpgradeId): number | null {
  const def = UPGRADES[id];
  const lvl = meta.upgrades[id];
  if (lvl >= def.maxLevel) return null;
  return def.costs[lvl];
}

export function canAfford(meta: MetaState, id: UpgradeId): boolean {
  const cost = nextUpgradeCost(meta, id);
  return cost !== null && meta.bankedSalvage >= cost;
}

/** Buy one level. Returns the new meta (unchanged if unaffordable/maxed). */
export function buyUpgrade(meta: MetaState, id: UpgradeId): MetaState {
  const cost = nextUpgradeCost(meta, id);
  if (cost === null || meta.bankedSalvage < cost) return meta;
  const next: MetaState = {
    ...meta,
    bankedSalvage: meta.bankedSalvage - cost,
    upgrades: { ...meta.upgrades, [id]: meta.upgrades[id] + 1 },
  };
  saveMeta(next);
  return next;
}

// ---- derived ship stats from upgrade levels -----------------------------

export interface ShipMods {
  maxHealth: number;     // absolute max-health for the run
  damageMult: number;    // multiply weapon damage
  driveMult: number;     // multiply boost/accel
}

const BASE_MAX_HEALTH = 100;

export function shipModsFor(meta: MetaState): ShipMods {
  return {
    maxHealth: BASE_MAX_HEALTH * (1 + meta.upgrades.hull * 0.25),
    damageMult: 1 + meta.upgrades.cannons * 0.30,
    driveMult: 1 + meta.upgrades.drive * 0.20,
  };
}

// ---- run economy (difficulty + reward curves) ---------------------------

/** Enemies to spawn in a sector at the given depth. */
export function sectorEnemyCount(sectorIndex: number): number {
  return 4 + sectorIndex * 2;
}

/** Per-enemy health/damage scale at the given depth. */
export function sectorThreatScale(sectorIndex: number): number {
  return 1 + sectorIndex * 0.28;
}

/** Salvage awarded per kill at the given depth (reward outpaces threat a bit). */
export function salvagePerKill(sectorIndex: number): number {
  return Math.round(18 * (1 + sectorIndex * 0.45));
}

/** Bonus salvage for clearing a whole sector. */
export function sectorClearBonus(sectorIndex: number): number {
  return Math.round(40 * (1 + sectorIndex * 0.6));
}

// ---- run lifecycle helpers ----------------------------------------------

/** Bank the run's salvage into meta (extract or natural end). */
export function bankRun(meta: MetaState, run: RunState, extracted: boolean): MetaState {
  const next: MetaState = {
    ...meta,
    bankedSalvage: meta.bankedSalvage + run.runSalvage,
    bestSector: Math.max(meta.bestSector, run.sectorIndex),
    totalExtracts: meta.totalExtracts + (extracted ? 1 : 0),
  };
  saveMeta(next);
  return next;
}

/** Death: run cargo is lost, but best-sector still counts. */
export function recordDeath(meta: MetaState, run: RunState): MetaState {
  const next: MetaState = {
    ...meta,
    bestSector: Math.max(meta.bestSector, run.sectorIndex),
  };
  saveMeta(next);
  return next;
}

/** Sector names for flavour — cycles through the story-bible order. */
export const SECTOR_NAMES = [
  'Asteroid Belt',
  'Jovian Approach',
  'Saturnian Rings',
  'Kuiper Verge',
  'Plutonian Dark',
];

export function sectorName(sectorIndex: number): string {
  return SECTOR_NAMES[Math.min(sectorIndex, SECTOR_NAMES.length - 1)] +
    (sectorIndex >= SECTOR_NAMES.length ? ` +${sectorIndex - SECTOR_NAMES.length + 1}` : '');
}
