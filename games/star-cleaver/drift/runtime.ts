import * as THREE from 'three';
import type { DriftSim, GameEvent } from './sim';
import type { FX } from './fx';
import type { InputManager } from './input';
import type { AudioEngine } from './audio';

export interface Settings {
  invertY: boolean;
  sensitivity: number; // 0.4 .. 2
  volume: number; // 0 .. 1
  quality: 'low' | 'high';
  showOrbits: boolean;
}

const SETTINGS_KEY = 'helion-drift-settings-v1';

export function defaultSettings(): Settings {
  const mobile = typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || window.innerWidth < 700);
  return { invertY: false, sensitivity: 1, volume: 0.7, quality: mobile ? 'low' : 'high', showOrbits: true };
}

export function loadSettings(): Settings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...defaultSettings(), ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return defaultSettings();
}

export function saveSettings(s: Settings) {
  try { window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

/** Shared, mutable, per-session objects. Never stored in React state. */
export interface Runtime {
  sim: DriftSim;
  input: InputManager;
  audio: AudioEngine;
  fx: FX | null;
  camera: THREE.PerspectiveCamera | null;
  origin: THREE.Vector3;
  shake: number;
  shieldFlash: number;
  settings: Settings;
  hudEvents: GameEvent[];
  /** set by the scene each frame: is the station/ship in view etc. */
  viewport: { w: number; h: number };
  fps: number;
  /** HUD hook: runs every frame after the camera has moved */
  onFrameHud?: () => void;
}
