export const CAMERA_PHASE_TUNING = {
  flight: {
    offsetDistance: 5.8,
    offsetHeight: 1.58,
    sideOffset: 0.56,
    baseFov: 55,
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
