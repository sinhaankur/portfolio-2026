import * as THREE from 'three';

const EARTH_RADIUS_KM = 6371;
const STATION_ORBIT_ALTITUDE_KM = 550;
const STATION_ORBIT_INCLINATION_DEG = 51.6;
const STATION_ORBIT_PHASE_DEG = 60;

function deriveEarthOrbitStationPosition(planetPosition: THREE.Vector3, planetRadius: number): THREE.Vector3 {
  const orbitRadius = planetRadius * (1 + STATION_ORBIT_ALTITUDE_KM / EARTH_RADIUS_KM);
  const phaseRad = THREE.MathUtils.degToRad(STATION_ORBIT_PHASE_DEG);
  const inclinationRad = THREE.MathUtils.degToRad(STATION_ORBIT_INCLINATION_DEG);

  // Start in the planet's equatorial plane (x-z), then tilt by inclination.
  const orbitalVector = new THREE.Vector3(
    Math.cos(phaseRad) * orbitRadius,
    0,
    Math.sin(phaseRad) * orbitRadius,
  ).applyAxisAngle(new THREE.Vector3(1, 0, 0), -inclinationRad);

  return planetPosition.clone().add(orbitalVector);
}

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
    // Physically-derived low Earth orbit placement (scaled from real values):
    // 550 km altitude, 51.6 deg inclination (ISS-like orbital plane).
    stationPosition: deriveEarthOrbitStationPosition(new THREE.Vector3(0, -140, -460), 112),
    stationScale: 1.42,
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
