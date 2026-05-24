import * as THREE from 'three';

export interface MissionLayout {
  planetPosition: THREE.Vector3;
  planetRadius: number;
  planetColor: number;
  atmosphereColor: number;
  stationPosition: THREE.Vector3;
  stationScale: number;
  spawnPosition: THREE.Vector3;
  spawnRotation: THREE.Vector3;
}

const BASE_LAYOUTS: MissionLayout[] = [
  {
    planetPosition: new THREE.Vector3(0, -140, -460),
    planetRadius: 112,
    planetColor: 0x3b82f6,
    atmosphereColor: 0x8ec5ff,
    stationPosition: new THREE.Vector3(0, -6, -330),
    stationScale: 1.15,
    spawnPosition: new THREE.Vector3(0, 8, -300),
    spawnRotation: new THREE.Vector3(0, Math.PI, 0),
  },
  {
    planetPosition: new THREE.Vector3(120, -170, -560),
    planetRadius: 98,
    planetColor: 0xc76a3b,
    atmosphereColor: 0xf2b47a,
    stationPosition: new THREE.Vector3(120, -24, -428),
    stationScale: 1.08,
    spawnPosition: new THREE.Vector3(120, -10, -398),
    spawnRotation: new THREE.Vector3(0, Math.PI, 0),
  },
  {
    planetPosition: new THREE.Vector3(-180, -130, -620),
    planetRadius: 82,
    planetColor: 0xb6d4ff,
    atmosphereColor: 0xeaf4ff,
    stationPosition: new THREE.Vector3(-180, -12, -506),
    stationScale: 1.0,
    spawnPosition: new THREE.Vector3(-180, 4, -474),
    spawnRotation: new THREE.Vector3(0, Math.PI, 0),
  },
  {
    planetPosition: new THREE.Vector3(240, -150, -700),
    planetRadius: 106,
    planetColor: 0xd4a55b,
    atmosphereColor: 0xf0d39e,
    stationPosition: new THREE.Vector3(240, -14, -568),
    stationScale: 1.18,
    spawnPosition: new THREE.Vector3(240, 2, -536),
    spawnRotation: new THREE.Vector3(0, Math.PI, 0),
  },
  {
    planetPosition: new THREE.Vector3(-300, -180, -780),
    planetRadius: 118,
    planetColor: 0x5e8aff,
    atmosphereColor: 0x9cc4ff,
    stationPosition: new THREE.Vector3(-300, -30, -632),
    stationScale: 1.2,
    spawnPosition: new THREE.Vector3(-300, -14, -598),
    spawnRotation: new THREE.Vector3(0, Math.PI, 0),
  },
  {
    planetPosition: new THREE.Vector3(360, -220, -840),
    planetRadius: 128,
    planetColor: 0x5fca9b,
    atmosphereColor: 0x9ef0cc,
    stationPosition: new THREE.Vector3(360, -56, -676),
    stationScale: 1.24,
    spawnPosition: new THREE.Vector3(360, -40, -640),
    spawnRotation: new THREE.Vector3(0, Math.PI, 0),
  },
  {
    planetPosition: new THREE.Vector3(-420, -260, -920),
    planetRadius: 136,
    planetColor: 0x7d69d7,
    atmosphereColor: 0xb5a9ff,
    stationPosition: new THREE.Vector3(-420, -82, -742),
    stationScale: 1.28,
    spawnPosition: new THREE.Vector3(-420, -66, -706),
    spawnRotation: new THREE.Vector3(0, Math.PI, 0),
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
