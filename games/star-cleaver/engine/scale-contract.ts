import * as THREE from 'three';

export const SCENE_METERS_PER_UNIT = 3;

// Player ship calibration.
export const DEFAULT_VANGUARD_LENGTH_METERS = 12.5;
export const GLB_SOURCE_LENGTH_UNITS = 5.98;
export const CALIBRATED_SHIP_SCALE =
  (DEFAULT_VANGUARD_LENGTH_METERS / SCENE_METERS_PER_UNIT) / GLB_SOURCE_LENGTH_UNITS;

// Earth/station orbital calibration.
export const EARTH_RADIUS_KM = 6371;
export const STATION_ORBIT_ALTITUDE_KM = 550;
export const STATION_ORBIT_INCLINATION_DEG = 51.6;
export const STATION_ORBIT_PHASE_DEG = 60;

export function deriveEarthOrbitStationPosition(
  planetPosition: THREE.Vector3,
  planetRadius: number,
) {
  const orbitRadius = planetRadius * (1 + STATION_ORBIT_ALTITUDE_KM / EARTH_RADIUS_KM);
  const phaseRad = THREE.MathUtils.degToRad(STATION_ORBIT_PHASE_DEG);
  const inclinationRad = THREE.MathUtils.degToRad(STATION_ORBIT_INCLINATION_DEG);

  const orbitalVector = new THREE.Vector3(
    Math.cos(phaseRad) * orbitRadius,
    0,
    Math.sin(phaseRad) * orbitRadius,
  ).applyAxisAngle(new THREE.Vector3(1, 0, 0), -inclinationRad);

  return planetPosition.clone().add(orbitalVector);
}
