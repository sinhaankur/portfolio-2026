export const CAMERA_PHASE_TUNING = {
  flight: {
    // NFS / Everspace chase cam: camera sits directly BEHIND + slightly ABOVE
    // the ship, centred (no side offset), looking down the nose. The ship
    // sits lower-centre in frame with the world ahead. Pulled in tighter
    // (was 9.0/2.6) so the ship fills more of the frame and the cam reads as
    // hugging it — tight arcade feel rather than a distant float.
    offsetDistance: 7.4,
    offsetHeight: 2.3,
    sideOffset: 0,
    baseFov: 62,
    nonAssistFollowRate: 7.6,
  },
  briefing: {
    offsetDistance: 12.5,
    offsetHeight: 4.4,
    sideOffset: 0,
    baseFov: 52,
    nonAssistFollowRate: 3.2,
  },
  stationInspect: {
    orbitRadius: 54,
    orbitHeight: 16,
    orbitHeightWave: 4,
    fov: 47,
    followRate: 3.2,
    lookRate: 3.9,
  },
} as const;

// Tightened for a responsive arcade feel: faster follow + look so the camera
// stays glued behind the nose through turns (less trailing float). Low is still
// the loosest/most cinematic for players who want it.
export const CAMERA_ASSIST_TUNING = {
  high: { follow: 10.5, look: 12.0, fov: 5.8 },
  medium: { follow: 8.6, look: 10.0, fov: 5.0 },
  low: { follow: 6.4, look: 7.6, fov: 4.0 },
} as const;
