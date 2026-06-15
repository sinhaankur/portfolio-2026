'use client';

import { useEffect, useMemo, useState } from 'react';
import type { GameState } from '../../../lib/neural-game-engine';
import { formatScore, getCurrentWorldName, IGNITION_STARTUP_DURATION } from './game-state';
import type { ShipModelAuditReport } from './ship-model-qa';
import { SHIP_CONFIGS, type SelectedShip, getAvailableShips } from './ship-selector';

declare global {
  interface Window {
    __starCleaverGraphicsTier?: string;
  }
}

interface HUDProps {
  gameState: GameState;
  showForwardDebug?: boolean;
  onShipSelect?: (shipId: SelectedShip) => void;
  waypoints?: Array<{ position: [number, number, number]; label: string }>;
}

/**
 * HUD: Desktop-first heads-up display for Helion Drift.
 * Matches universe-engine/hud.tsx design language: font-mono, tracking-wide, backdrop-blur-sm.
 */
export function HUD({ gameState, showForwardDebug = false, onShipSelect, waypoints }: HUDProps) {
  const [shipAudit, setShipAudit] = useState<ShipModelAuditReport | null>(null);
  const [graphicsTier, setGraphicsTier] = useState<string | null>(null);
  const healthPercent = (gameState.playerEntity.health / gameState.playerMaxHealth) * 100;
  const planetHealthPercent = gameState.defendingPlanetHealth * 100;
  const chargePercent = (gameState.chargeLevel / gameState.maxCharge) * 100;
  const worldName = getCurrentWorldName(gameState);
  // Computed inline: the velocity object is mutated in place by the sim, so
  // its identity never changes and memoizing on it would freeze the readout.
  const { x: velX, y: velY, z: velZ } = gameState.playerEntity.velocity;
  const speed = Math.sqrt(velX * velX + velY * velY + velZ * velZ);
  const throttle = Number(gameState.playerEntity.metadata?.throttle ?? 0);
  const maxForwardSpeed = Number(gameState.playerEntity.metadata?.maxForwardSpeed ?? 30);
  const brakeActive = Boolean(gameState.playerEntity.metadata?.rcsBrake);
  const flightAssistActive = Boolean(gameState.playerEntity.metadata?.flightAssistActive ?? true);
  const stopLock = Boolean(gameState.playerEntity.metadata?.stopLock);
  const nearStop = speed < 0.6;
  const stopAssistActive = stopLock || (Math.abs(throttle) < 0.05 && speed > 0.6) || brakeActive;
  const flightStateLabel = nearStop
    ? 'HOLD'
    : stopAssistActive
      ? 'STOPPING'
      : throttle > 0.05
        ? 'THRUST'
        : throttle < -0.05
          ? 'REVERSE'
          : 'DRIFT';
  const heading = useMemo(() => {
    const deg = (gameState.playerEntity.rotation.y * 180) / Math.PI;
    return Math.round(((deg % 360) + 360) % 360);
  }, [gameState.playerEntity.rotation.y]);
  const cruisePercent = Math.min(100, (speed / Math.max(8, maxForwardSpeed)) * 100);
  const boostActive = Boolean(gameState.playerEntity.metadata?.boostActive);
  const attackMode = Boolean(gameState.playerEntity.metadata?.attackMode);
  const gasCloudDensity = Number(gameState.playerEntity.metadata?.gasCloudDensity ?? 0);
  const interstellarDrive = String(gameState.playerEntity.metadata?.interstellarDrive ?? 'Fusion Torch');
  const accelKick = Number(gameState.playerEntity.metadata?.accelKick ?? 0);
  const speedJerk = Number(gameState.playerEntity.metadata?.speedJerk ?? 0);
  const routeName = String(gameState.metadata?.activeRouteName ?? 'Inner System Survey');
  const routeProgress = String(gameState.metadata?.activeRouteProgress ?? '0/0');
  const routeMessage = String(gameState.metadata?.routeMessage ?? '');
  const routeMessageUntil = Number(gameState.metadata?.routeMessageUntil ?? 0);
  const weaponMode = String(gameState.playerEntity.metadata?.weaponMode ?? 'wing-cannons');
  const weaponHeat = Number(gameState.playerEntity.metadata?.weaponHeat ?? 0);
  const weaponOverheated = Boolean(gameState.playerEntity.metadata?.weaponOverheated);
  const weaponStatus = String(gameState.playerEntity.metadata?.weaponStatus ?? 'NOMINAL');
  const weaponPreset = String(gameState.playerEntity.metadata?.weaponPreset ?? 'sim');
  const gravityLoad = Number(gameState.playerEntity.metadata?.gravityLoad ?? 0);
  const boundaryLoad = Number(gameState.playerEntity.metadata?.boundaryLoad ?? 0);
  const gravityWarning = String(gameState.playerEntity.metadata?.gravityWarning ?? '');
  const nearestHazard = String(gameState.playerEntity.metadata?.nearestHazard ?? '');
  const nearestHazardDistance = Number(gameState.playerEntity.metadata?.nearestHazardDistance ?? 0);
  const simpleJourneyMode = Boolean(gameState.playerEntity.metadata?.simpleJourneyMode);
  const showRouteMessage = routeMessage.length > 0 && routeMessageUntil > gameState.simTime;
  const isExplorationPhase =
    gameState.phase === 'exploration' || gameState.phase === 'ignition' || gameState.phase === 'combat';
  const ignitionProgress = useMemo(() => {
    if (gameState.phase !== 'ignition') return 0;
    if (typeof gameState.ignitionStartTime !== 'number') return 0;
    return Math.min(1, Math.max(0, (gameState.simTime - gameState.ignitionStartTime) / IGNITION_STARTUP_DURATION));
  }, [gameState.phase, gameState.ignitionStartTime, gameState.simTime]);
  const ignitionArmed = gameState.phase === 'ignition' && typeof gameState.ignitionStartTime === 'number';
  const isTouchDevice = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const primaryFlightHint = useMemo(() => {
    if (isTouchDevice) {
      if (speed < 3) return 'TILT TO STEER · TAP THRUST TO START';
      if (!boostActive) return 'TAP BOOST FOR BURST SPEED';
      return 'TAP FOILS FOR TIGHT TURNING';
    }

    if (speed < 3) return 'W ACCELERATE · S BRAKE TO ZERO · A/D OR ←/→ STEER · CLICK/J FIRE';
    if (!boostActive) return 'SHIFT OR SPACE BOOST · Q/E ROLL';
    if (!attackMode) return 'X TO ENTER ATTACK FOILS FOR SHARPER CONTROL';
    return 'R RESET HEADING IF YOU DRIFT OFF COURSE';
  }, [isTouchDevice, speed, boostActive, attackMode]);
  const secondaryFlightHint = useMemo(() => {
    if (isTouchDevice) return 'FLIGHT ASSIST AUTO-STABILIZES YOUR SHIP';
    return 'F FLIGHT ASSIST · H CONTROLS HELP · V NOSE MARKER';
  }, [isTouchDevice]);

  // Planet health color: green → yellow → red
  const planetHealthColor = useMemo(() => {
    if (planetHealthPercent > 66) return 'bg-green-500';
    if (planetHealthPercent > 33) return 'bg-yellow-500';
    return 'bg-red-500';
  }, [planetHealthPercent]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const shouldShowAudit =
      process.env.NODE_ENV !== 'production' || window.localStorage.getItem('star-cleaver-model-audit') === '1';

    if (!shouldShowAudit) return;

    const syncAudit = () => {
      setShipAudit(window.__starCleaverShipAudit ?? null);
      setGraphicsTier(window.__starCleaverGraphicsTier ?? null);
    };

    syncAudit();
    const intervalId = window.setInterval(syncAudit, 1500);
    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const maxTextureSize = useMemo(() => {
    if (!shipAudit || shipAudit.textures.length === 0) return 'NO TEX';
    const maxDim = shipAudit.textures.reduce((max, texture) => Math.max(max, texture.width, texture.height), 0);
    return maxDim > 0 ? `${maxDim}px` : 'NO TEX';
  }, [shipAudit]);

  return (
    <>
      {shipAudit && (
        <div className="fixed left-3 top-24 z-50 pointer-events-none sm:left-6 sm:top-28">
          <div className="rounded-2xl border border-cyan-300/20 bg-slate-950/70 px-3 py-2 shadow-[0_10px_25px_rgba(0,0,0,0.28)] backdrop-blur-md">
            <div className="font-mono text-[8px] uppercase tracking-[0.18em] text-cyan-200/75">
              Ship QA
            </div>
            <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-white/85">
              {shipAudit.triangles.toLocaleString()} tris
            </div>
            <div className="font-mono text-[8px] uppercase tracking-[0.12em] text-white/55">
              {shipAudit.meshes} meshes · {maxTextureSize}
            </div>
            {graphicsTier && (
              <div className="font-mono text-[8px] uppercase tracking-[0.12em] text-cyan-100/70">
                Graphics {graphicsTier}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Top bar: world info, health, score */}
      <div className="fixed top-0 inset-x-0 z-40 pointer-events-none">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center px-3 sm:px-6 py-3 sm:py-4 max-w-6xl mx-auto">
          {/* Left: World info */}
          <div className="font-mono text-[9px] sm:text-[11px] tracking-[0.14em] sm:tracking-[0.25em] uppercase text-foreground/85 drop-shadow-md">
            <div>{worldName}</div>
            {simpleJourneyMode && (
              <div className="mt-1 inline-flex rounded-full border border-cyan-300/35 bg-cyan-400/10 px-2 py-1 text-[8px] tracking-[0.18em] text-cyan-100/90">
                SIMPLE JOURNEY
              </div>
            )}
          </div>

          {/* Center: Player health bar with animation and gradient */}
          <div className="flex flex-col items-center sm:items-center gap-1.5 sm:gap-2">
            <div className="text-foreground/55 font-mono text-[8px] sm:text-[9px] tracking-[0.14em] sm:tracking-[0.2em] uppercase">
              HULL
            </div>
            <div className="relative w-[min(92vw,16rem)] sm:w-64 h-3 rounded-full bg-linear-to-r from-cyan-900/60 to-cyan-400/20 shadow-inner overflow-hidden border border-foreground/25">
              <div
                className="absolute left-0 top-0 h-full rounded-full bg-linear-to-r from-green-400 via-yellow-300 to-red-500 transition-all duration-500 shadow-lg"
                style={{ width: `${healthPercent}%`, boxShadow: '0 0 8px 2px rgba(34,211,238,0.25)' }}
              />
              <div className="absolute inset-0 flex items-center justify-center font-mono text-[10px] text-white/80 drop-shadow">
                {Math.round(healthPercent)}%
              </div>
            </div>
            <div className="text-foreground/70 font-mono text-[8px] sm:text-[9px]">
              {Math.ceil(gameState.playerEntity.health)} / {gameState.playerMaxHealth}
            </div>
          </div>

          {/* Right: Score */}
          <div className="text-left sm:text-right">
            <div className="font-mono text-[11px] sm:text-[13px] tracking-[0.12em] sm:tracking-widest uppercase text-foreground/85 tabular-nums drop-shadow">
              {formatScore(gameState.score)}
            </div>
            <div className="text-foreground/55 font-mono text-[9px] sm:text-[11px] tracking-[0.12em] sm:tracking-[0.2em] mt-1">
              ×{gameState.comboMultiplier.toFixed(1)}
            </div>
          </div>
        </div>
      </div>

      {/* Aiming reticle — center-screen crosshair so the player can read where
          their cannons fire. Shown only in flight. Tints warm in attack mode
          (tighter combat handling), cool otherwise. */}
      {isExplorationPhase && (() => {
        const reticleColor = attackMode ? '#ffb46b' : '#8ce6ff';
        return (
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none">
            <svg width="56" height="56" viewBox="0 0 56 56" className="drop-shadow-[0_0_3px_rgba(0,0,0,0.6)]">
              <circle cx="28" cy="28" r="15" fill="none" stroke={reticleColor} strokeOpacity="0.45" strokeWidth="1" />
              <line x1="28" y1="4" x2="28" y2="12" stroke={reticleColor} strokeOpacity="0.8" strokeWidth="1.5" />
              <line x1="28" y1="44" x2="28" y2="52" stroke={reticleColor} strokeOpacity="0.8" strokeWidth="1.5" />
              <line x1="4" y1="28" x2="12" y2="28" stroke={reticleColor} strokeOpacity="0.8" strokeWidth="1.5" />
              <line x1="44" y1="28" x2="52" y2="28" stroke={reticleColor} strokeOpacity="0.8" strokeWidth="1.5" />
              <circle cx="28" cy="28" r="1.5" fill={reticleColor} fillOpacity="0.9" />
            </svg>
          </div>
        );
      })()}

      {/* Pause indicator */}
      {gameState.phase === 'paused' && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none">
          <div className="font-mono text-[11px] tracking-[0.35em] uppercase text-cyan-300/90 drop-shadow-lg animate-pulse">
            Paused
          </div>
        </div>
      )}

      {/* Minimap radar — top-right, below score area on desktop */}
      {isExplorationPhase && (
        <Minimap
          playerPos={gameState.playerEntity.position}
          playerRotationY={gameState.playerEntity.rotation.y}
          waypoints={waypoints}
          enemies={gameState.enemies.filter((e) => e.active).map((e) => e.position)}
          nearestHazard={nearestHazard}
          nearestHazardDistance={nearestHazardDistance}
        />
      )}

      {/* Bottom bar: travel telemetry + charge meter */}
      <div className="fixed bottom-0 inset-x-0 z-40 pointer-events-none">
        <div className="mx-auto flex w-[min(95vw,40rem)] flex-col gap-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-5 px-3 sm:px-0">
          <div className="rounded-3xl border border-foreground/12 bg-background/28 px-3 py-3 shadow-[0_10px_26px_rgba(0,0,0,0.22)] backdrop-blur-md sm:px-4 sm:py-3.5">
            {isExplorationPhase ? (
              <div className="flex flex-col items-center gap-3">
                <div className="text-center font-mono text-[8px] sm:text-[9px] tracking-[0.16em] sm:tracking-[0.24em] uppercase text-foreground/60">
                  CRUISE VELOCITY
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full border border-foreground/20 bg-foreground/10">
                  <div
                    className="h-full bg-cyan-400 transition-all duration-100"
                    style={{ width: `${cruisePercent}%` }}
                  />
                </div>

                {/* Essentials only — a premium HUD shows what the pilot needs,
                    not a debug dump. Speed/heading, flight state, assist, route,
                    and weapon heat when it matters. The old deep-telemetry chip
                    wall (gas/push/jerk/gravity/boundary…) is gone. */}
                <div className="grid w-full grid-cols-2 gap-2 text-center sm:flex sm:flex-wrap sm:justify-center">
                  <div className="rounded-full border border-foreground/12 bg-foreground/4 px-2.5 py-1 text-[8px] font-mono uppercase tracking-[0.12em] text-foreground/70 sm:text-[9px] sm:tracking-[0.14em]">
                    SPD {Math.round(speed)} · HDG {heading}°
                  </div>
                  <div className={`rounded-full border px-2.5 py-1 text-[8px] font-mono uppercase tracking-[0.12em] sm:text-[9px] sm:tracking-[0.14em] ${stopAssistActive ? 'border-amber-300/35 bg-amber-500/10 text-amber-100/90' : nearStop ? 'border-green-300/35 bg-green-500/10 text-green-100/90' : 'border-foreground/15 bg-foreground/5 text-foreground/70'}`}>
                    STATE {flightStateLabel}
                  </div>
                  <div className={`rounded-full border px-2.5 py-1 text-[8px] font-mono uppercase tracking-[0.12em] sm:text-[9px] sm:tracking-[0.14em] ${flightAssistActive ? 'border-cyan-300/25 bg-cyan-400/7 text-cyan-100/85' : 'border-foreground/12 bg-foreground/4 text-foreground/65'}`}>
                    ASSIST {flightAssistActive ? 'ON' : 'OFF'}
                  </div>
                  <div className="rounded-full border border-foreground/12 bg-foreground/4 px-2.5 py-1 text-[8px] font-mono uppercase tracking-[0.12em] text-foreground/60 sm:text-[9px] sm:tracking-[0.14em]">
                    ROUTE {routeName.toUpperCase()} {routeProgress}
                  </div>
                  {/* Weapon heat only surfaces when it's actually a concern. */}
                  {!simpleJourneyMode && (weaponOverheated || weaponHeat > 0.5) && (
                    <div className={`rounded-full border px-2.5 py-1 text-[8px] font-mono uppercase tracking-[0.12em] sm:text-[9px] sm:tracking-[0.14em] ${weaponOverheated ? 'border-red-300/40 bg-red-500/15 text-red-200/95' : 'border-amber-300/30 bg-amber-500/10 text-amber-100/90'}`}>
                      HEAT {Math.round(weaponHeat * 100)}% · {weaponStatus}
                    </div>
                  )}
                  {/* Hazard warning only when there is one. */}
                  {gravityWarning && (
                    <div className="col-span-2 rounded-full border border-red-300/30 bg-red-500/10 px-2.5 py-1 text-[8px] font-mono uppercase tracking-[0.12em] text-red-200/95 sm:text-[9px] sm:tracking-[0.14em]">
                      {gravityWarning}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="text-center font-mono text-[8px] sm:text-[9px] tracking-[0.16em] sm:tracking-[0.24em] uppercase text-foreground/60">
                  PLANET SHIELD
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full border border-foreground/20 bg-foreground/10">
                  <div
                    className={`h-full transition-all duration-100 ${planetHealthColor}`}
                    style={{ width: `${planetHealthPercent}%` }}
                  />
                </div>
                <div className="font-mono text-[8px] uppercase tracking-[0.14em] text-foreground/70 sm:text-[9px]">
                  {Math.ceil(planetHealthPercent)}%
                </div>
              </div>
            )}

            {/* Charge meter - only visible when charging */}
            {gameState.phase === 'charging' && (
              <div className="mt-3 flex flex-col items-center gap-2 border-t border-foreground/10 pt-3">
                <div className="text-center font-mono text-[8px] sm:text-[9px] tracking-[0.16em] sm:tracking-[0.24em] uppercase text-foreground/60">
                  CHARGE LEVEL
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full border border-foreground/20 bg-foreground/10">
                  <div
                    className="h-full bg-purple-500 transition-all duration-50"
                    style={{ width: `${chargePercent}%` }}
                  />
                </div>
                <div className="font-mono text-[8px] uppercase tracking-[0.14em] text-foreground/70 sm:text-[9px]">
                  {Math.ceil(chargePercent)}% · RELEASE TO FIRE
                </div>
              </div>
            )}
          </div>

          {/* Ignition sequence — minimal, elegant */}
          {gameState.phase === 'ignition' && (
            <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/20 backdrop-blur-[2px] pointer-events-none"
            >
              <div className="text-center space-y-6"
              >
                <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-cyan-300/80"
                >
                  Cleaver-class Interceptor
                </div>
                <div className="font-serif text-4xl md:text-5xl text-white/90 font-light italic"
                >
                  {worldName}
                </div>
                <div className="h-px w-24 bg-linear-to-r from-transparent via-cyan-400/50 to-transparent mx-auto"
                />
                {ignitionArmed ? (
                  <>
                    <div className="mx-auto h-1.5 w-48 overflow-hidden rounded-full border border-cyan-300/20 bg-white/10">
                      <div
                        className="h-full bg-cyan-300 transition-all duration-150"
                        style={{ width: `${ignitionProgress * 100}%` }}
                      />
                    </div>
                    <div className="font-mono text-[9px] tracking-[0.2em] uppercase text-cyan-100/70"
                    >
                      Ignition sequence underway
                    </div>
                  </>
                ) : (
                  <div className="font-mono text-[9px] tracking-[0.2em] uppercase text-white/50"
                  >
                    Press W or Space to start ignition
                  </div>
                )}
              </div>
            </div>
          )}

          {gameState.phase === 'victory' && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-green-500/20 backdrop-blur-sm pointer-events-none">
              <div className="text-center">
                <div className="font-serif text-5xl text-green-400 mb-4 italic">
                  WAVE CLEAR
                </div>
                <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-foreground/55">
                  {gameState.wave === 4 ? 'WORLD SECURED' : 'PREPARE FOR NEXT WAVE'}
                </div>
              </div>
            </div>
          )}

          {gameState.phase === 'defeat' && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-red-500/20 backdrop-blur-sm pointer-events-none">
              <div className="text-center">
                <div className="font-serif text-5xl text-red-400 mb-4 italic">
                  LOST
                </div>
                <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-foreground/55">
                  PLANET COMPROMISED · RESTARTING WAVE
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Control hints and flight info */}
      {isExplorationPhase && (
        <div className="fixed bottom-28 sm:bottom-35 left-1/2 z-30 w-full max-w-[min(100vw,40rem)] -translate-x-1/2 px-3 text-center pointer-events-none">
          {showRouteMessage && (
            <div className="mb-2 inline-block max-w-full rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 font-mono text-[8px] sm:text-[9px] tracking-widest sm:tracking-[0.12em] uppercase text-cyan-100/90 leading-tight text-balance">
              {routeMessage}
            </div>
          )}
          <div className="mb-2 font-mono text-[8px] leading-relaxed tracking-[0.08em] uppercase text-foreground/40 sm:text-[9px] sm:tracking-[0.22em]">
            <span className="sm:hidden">
              {isTouchDevice
                ? 'TILT STEER · TAP THRUST · TAP BOOST'
                : 'W ACCELERATE · S BRAKE · A/D STEER · FIRE'}
            </span>
            <span className="hidden sm:inline">{primaryFlightHint}</span>
          </div>
          <div className="font-mono text-[8px] leading-relaxed tracking-[0.08em] text-foreground/50 sm:text-[9px] sm:tracking-[0.15em]">
            EXPLORATION · FOILS {attackMode ? 'ATTACK' : 'CRUISE'} · BOOST {boostActive ? 'ON' : 'OFF'} · SCORE {formatScore(gameState.score)} · FWD DBG {showForwardDebug ? 'ON' : 'OFF'}
          </div>
          <div className="mt-1 font-mono text-[8px] tracking-widest text-foreground/40 uppercase sm:text-[9px]">
            <span className="sm:hidden">F FLIGHT ASSIST · H CONTROLS · V NOSE MARKER</span>
            <span className="hidden sm:inline">{secondaryFlightHint}</span>
          </div>
        </div>
      )}

      {/* Briefing control hint */}
      {gameState.phase === 'briefing' && (
        <div className="fixed bottom-12 left-1/2 transform -translate-x-1/2 z-30 pointer-events-none text-center">
          <div className="font-mono text-[9px] tracking-[0.2em] uppercase text-foreground/55">
            E INSPECT STATION · SPACE TO LAUNCH
          </div>
        </div>
      )}
    </>
  );
}

/* --------------------------------------------------------------------------
 * Minimap — circular radar showing waypoints and hazards relative to ship.
 * Forward is always up. Range = 1500 world units.
 * ------------------------------------------------------------------------ */

function Minimap({
  playerPos,
  playerRotationY,
  waypoints,
  enemies,
  nearestHazard,
  nearestHazardDistance,
}: {
  playerPos: { x: number; y: number; z: number };
  playerRotationY: number;
  waypoints?: Array<{ position: [number, number, number]; label: string }>;
  enemies?: Array<{ x: number; y: number; z: number }>;
  nearestHazard: string;
  nearestHazardDistance: number;
}) {
  const size = 96;
  const radius = size / 2;
  const range = 1500;

  // Transform world position to minimap coordinates (forward = up)
  const worldToMap = (wx: number, wy: number, wz: number) => {
    const dx = wx - playerPos.x;
    const dz = wz - playerPos.z;
    const angle = Math.atan2(dx, -dz) - playerRotationY; // forward is -Z
    const dist = Math.sqrt(dx * dx + dz * dz);
    const clampedDist = Math.min(dist, range);
    const r = (clampedDist / range) * (radius - 4);
    return {
      x: radius + Math.sin(angle) * r,
      y: radius - Math.cos(angle) * r,
      outOfRange: dist > range,
    };
  };

  const blips = (waypoints ?? []).map((wp, i) => ({
    ...worldToMap(wp.position[0], wp.position[1], wp.position[2]),
    key: `wp-${i}`,
    color: '#4fffd1',
    size: 3,
  }));

  // Hostile contacts — red blips so the player can read incoming threats.
  (enemies ?? []).forEach((e, i) => {
    blips.push({
      ...worldToMap(e.x, e.y, e.z),
      key: `enemy-${i}`,
      color: '#ff4d4d',
      size: 2.5,
    });
  });

  // Add nearest hazard blip if close enough
  if (nearestHazard && nearestHazardDistance > 0 && nearestHazardDistance < range * 2) {
    // We don't have exact hazard position, so place it at edge in forward-ish direction
    // as a subtle warning
    blips.push({
      x: radius,
      y: radius - radius * 0.85,
      outOfRange: true,
      key: 'hazard',
      color: '#ff5555',
      size: 2.5,
    });
  }

  return (
    <div className="fixed top-16 right-3 sm:top-20 sm:right-6 z-40 pointer-events-none">
      <div className="relative rounded-full border border-white/15 bg-black/40 backdrop-blur-sm"
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} className="absolute inset-0">
          {/* Compass ring */}
          <circle cx={radius} cy={radius} r={radius - 2} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
          <circle cx={radius} cy={radius} r={radius * 0.5} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} />
          {/* Cardinal ticks */}
          <line x1={radius} y1={2} x2={radius} y2={6} stroke="rgba(255,255,255,0.25)" strokeWidth={1} />
          <line x1={radius} y1={size - 6} x2={radius} y2={size - 2} stroke="rgba(255,255,255,0.1)" strokeWidth={0.5} />
          <line x1={2} y1={radius} x2={6} y2={radius} stroke="rgba(255,255,255,0.1)" strokeWidth={0.5} />
          <line x1={size - 6} y1={radius} x2={size - 2} y2={radius} stroke="rgba(255,255,255,0.1)" strokeWidth={0.5} />
          {/* Ship triangle */}
          <polygon
            points={`${radius},${radius - 4} ${radius - 3},${radius + 3} ${radius + 3},${radius + 3}`}
            fill="#aee8ff"
            opacity={0.9}
          />
          {/* Blips */}
          {blips.map((blip) => (
            <circle
              key={blip.key}
              cx={blip.x}
              cy={blip.y}
              r={blip.size}
              fill={blip.color}
              opacity={blip.outOfRange ? 0.4 : 0.85}
            />
          ))}
        </svg>
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 font-mono text-[7px] tracking-widest uppercase text-white/40 whitespace-nowrap">
          {nearestHazardDistance > 0 && nearestHazardDistance < range * 2
            ? `${Math.round(nearestHazardDistance)}u`
            : `${range}u`}
        </div>
      </div>
    </div>
  );
}
