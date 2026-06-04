import type { GameState } from '../../../../lib/neural-game-engine';

export type CorePhase =
  | 'opening'
  | 'nexus'
  | 'briefing'
  | 'ignition'
  | 'exploration'
  | 'combat'
  | 'charging'
  | 'firing'
  | 'victory'
  | 'defeat'
  | 'paused';

export function isFlightPhase(phase: GameState['phase']) {
  return phase === 'ignition' || phase === 'exploration';
}

export function isPreLaunchPhase(state: GameState) {
  return (
    state.phase === 'briefing' ||
    (state.phase === 'ignition' && typeof state.ignitionStartTime !== 'number')
  );
}

export function canInspectStation(state: GameState) {
  return isPreLaunchPhase(state);
}

export function shouldAutoStartExploration(state: GameState, ignitionStartupDuration: number) {
  if (state.phase !== 'ignition') return false;
  if (typeof state.ignitionStartTime !== 'number') return false;
  return state.simTime - state.ignitionStartTime >= ignitionStartupDuration;
}

export function togglePausePhase(phase: GameState['phase']): GameState['phase'] {
  if (phase === 'paused') return 'exploration';
  if (
    phase === 'exploration' ||
    phase === 'ignition' ||
    phase === 'combat' ||
    phase === 'charging'
  ) {
    return 'paused';
  }
  return phase;
}
