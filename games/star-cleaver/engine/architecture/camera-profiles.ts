export const CAMERA_PHASE_TUNING = {
  flight: {
    // Hero framing: ship sits large + low-front in the frame against the
    // backdrop. Distance scaled for the bigger (1.7x) ship; a wider FOV gives
    // a cinematic sense of speed and space.
    offsetDistance: 7.6,
    offsetHeight: 2.0,
    sideOffset: 0.5,
    baseFov: 60,
    nonAssistFollowRate: 6.2,
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

export const CAMERA_ASSIST_TUNING = {
  high: { follow: 8.1, look: 9.6, fov: 5.2 },
  medium: { follow: 6.5, look: 8.0, fov: 4.5 },
  low: { follow: 5.2, look: 6.7, fov: 3.6 },
} as const;
