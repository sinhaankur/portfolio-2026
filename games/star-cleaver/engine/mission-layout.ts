import * as THREE from 'three';

export interface MissionLayout {
  planetPosition: THREE.Vector3;
  planetRadius: number;
  planetColor: number;
  atmosphereColor: number;
  stationPosition: THREE.Vector3;
  stationScale: number;
  stationStyle: 'civic' | 'industrial' | 'research' | 'frontier' | 'sentinel' | 'exo' | 'ark';
  spawnPosition: THREE.Vector3;
  spawnRotation: THREE.Vector3;
}

const BASE_LAYOUTS: MissionLayout[] = [
  {
    // Earth-like planet, station nearby
    planetPosition: new THREE.Vector3(0, -140, -460),
    planetRadius: 112,
    planetColor: 0x3b82f6, // blue for Earth
    atmosphereColor: 0x8ec5ff,
    stationPosition: new THREE.Vector3(0, -6, -330),
    stationScale: 1.15,
    stationStyle: 'civic',
    spawnPosition: new THREE.Vector3(0, 8, -300),
    // Keep yaw at 0 so gameplay forward (-Z) aligns with ship nose.
    spawnRotation: new THREE.Vector3(0, 0, 0),
  },
];

export function getMissionLayout(worldIndex: number): MissionLayout {
  const safeIndex = Math.max(0, Math.min(BASE_LAYOUTS.length - 1, worldIndex));
  const source = BASE_LAYOUTS[safeIndex];
  return {
    ...source,
    planetPosition: source.planetPosition.clone(),
    stationPosition: source.stationPosition.clone(),
    spawnPosition: source.spawnPosition.clone(),
    spawnRotation: source.spawnRotation.clone(),
  };
}
