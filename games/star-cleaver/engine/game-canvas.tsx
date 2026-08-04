'use client';

import Link from 'next/link';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { Suspense, memo, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import * as THREE from 'three';

import {
  EntityManager,
  CollisionSystem,
  GameLoop,
  createEntityManager,
  createCollisionSystem,
  createGameLoop,
  type GameState,
  type GameEntity,
} from '../../../lib/neural-game-engine';
// import { createNeuralAgent, type NeuralAgent } from '../../../lib/neural-game-engine/ai-agent';
import { createInitialGameState, startIgnition, startExploration, selectGameMode, formatScore, IGNITION_STARTUP_DURATION } from './game-state';
import { ModeSelect } from './mode-select';
import { Outfitting, type RunSummary } from './outfitting';
import {
  loadMeta,
  newRun,
  buyUpgrade,
  bankRun,
  recordDeath,
  shipModsFor,
  sectorEnemyCount,
  sectorThreatScale,
  salvagePerKill,
  sectorClearBonus,
  sectorName,
  sectorInfo,
  sectorBackdrop,
  type MetaState,
  type RunState,
  type UpgradeId,
} from './run-state';
import { HUD } from './hud';
import { TestingConsole } from './testing-console';
import { PlayerShipModel, ProceduralPlayerShipModel, SHIP_MODEL_BASIS_ROTATION, getPlayerShipTransform } from './player-ship-model';
import type { SelectedShip } from './ship-selector';
import { getMissionLayout } from './mission-layout';
import { MissionPlanet } from './mission-planet';
import { createEnemy, createBoss } from './enemies';
import { SpaceDust, DataCoreField, createDataCores, BoostShockwave, ImpactField, DebrisField } from './particles';
import { AsteroidField } from './asteroid-field';
import type { DataCore } from './particles';
import {
  canInspectStation,
  isFlightPhase as isRuntimeFlightPhase,
  shouldAutoStartExploration,
  togglePausePhase,
} from './architecture/mission-director';
import { CAMERA_ASSIST_TUNING, CAMERA_PHASE_TUNING } from './architecture/camera-profiles';
import { SceneContents as UniverseSceneContents } from '../../../components/universe-engine/scene';
import { SUN_OFFSET_SCENE } from '../../../components/universe-engine/astronomy';

/**
 * The Universe Engine renders itself in tiny scene units (Sun at scene-x 66,
 * sky shell at 150). We inflate it so that the player ship — sized in single
 * digits — can fly across it meaningfully. At scale 40, the Milky Way disc
 * spans ~10,000 game units, the Sun sits ~2,640 units along +X, and the sky
 * shell of constellations sits at ~6,000 units (just outside the camera far
 * plane, hence the bumped frustum below).
 */
const UNIVERSE_SCALE = 40;
const NOOP = () => {};
const SIMPLE_JOURNEY_MODE = true;
// FLY-AROUND-ONLY: collapse the game to a single free-flight mode for now (drop
// straight into Exploration, no mode-select). Fixing the flight feel comes first;
// combat / Deep Run / Defend get added back after. Set false to restore the
// three-way mode-select start screen.
const FLY_AROUND_ONLY = true;
const KNOWN_UNIVERSE_RADIUS = 9100;

type GraphicsTier = 'low' | 'high' | 'ultra';

type GraphicsProfile = {
  tier: GraphicsTier;
  dpr: number | [number, number];
  shadows: boolean;
  shadowMapSize: number;
  universeMobile: boolean;
  powerPreference: WebGLPowerPreference;
  toneMappingExposure: number;
  dustCount: number;
};

const GRAPHICS_PROFILES: Record<GraphicsTier, GraphicsProfile> = {
  low: {
    tier: 'low',
    dpr: [1, 1.2],
    shadows: false,
    shadowMapSize: 1024,
    universeMobile: true,
    powerPreference: 'default',
    toneMappingExposure: 1.0,
    dustCount: 800,
  },
  high: {
    tier: 'high',
    dpr: [1, 1.75],
    shadows: true,
    shadowMapSize: 2048,
    universeMobile: false,
    powerPreference: 'high-performance',
    toneMappingExposure: 1.04,
    dustCount: 1400,
  },
  ultra: {
    tier: 'ultra',
    dpr: [1.25, 2.25],
    shadows: true,
    shadowMapSize: 4096,
    universeMobile: false,
    powerPreference: 'high-performance',
    toneMappingExposure: 1.08,
    dustCount: 2200,
  },
};

const ENGINE_VOLUME_STORAGE_KEY = 'star-cleaver-engine-volume';

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function detectGraphicsProfile(): GraphicsProfile {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return GRAPHICS_PROFILES.high;
  }

  const override = window.localStorage.getItem('star-cleaver-graphics-profile') as GraphicsTier | null;
  if (override && override in GRAPHICS_PROFILES) {
    return GRAPHICS_PROFILES[override];
  }

  const ua = navigator.userAgent;
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const touchPoints = navigator.maxTouchPoints ?? 0;
  const deviceMemory = Number((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8);
  const cores = navigator.hardwareConcurrency ?? 8;
  const pixelRatio = window.devicePixelRatio ?? 1;

  if (!isMobile && touchPoints <= 1 && deviceMemory >= 8 && cores >= 8 && pixelRatio >= 1.5) {
    return GRAPHICS_PROFILES.ultra;
  }

  if (!isMobile && deviceMemory >= 4 && cores >= 4) {
    return GRAPHICS_PROFILES.high;
  }

  return GRAPHICS_PROFILES.low;
}

type GravityHazard = {
  id: string;
  label: string;
  position: THREE.Vector3;
  influenceRadius: number;
  warningRadius: number;
  fatalRadius: number;
  gravityStrength: number;
  damagePerSecond: number;
};

type RouteWaypoint = {
  id: string;
  label: string;
  position: [number, number, number];
  radius: number;
  discoveryScore: number;
};

type RouteDefinition = {
  id: string;
  name: string;
  completionScore: number;
  waypoints: RouteWaypoint[];
};

type RouteState = {
  visited: string[];
  completed: boolean;
};

type MuzzleFlash = {
  id: string;
  position: { x: number; y: number; z: number };
  endTime: number;
};

const SOLAR_ANCHORS = {
  sol: [SUN_OFFSET_SCENE * UNIVERSE_SCALE, 0, 0] as [number, number, number],
  earthArc: [(SUN_OFFSET_SCENE - 0.63) * UNIVERSE_SCALE, 0, 2.93 * UNIVERSE_SCALE] as [number, number, number],
  saturnGate: [(SUN_OFFSET_SCENE + 9.27) * UNIVERSE_SCALE, 14, 0] as [number, number, number],
  paleBlueVantage: [(SUN_OFFSET_SCENE - 28) * UNIVERSE_SCALE, 22 * UNIVERSE_SCALE, 30 * UNIVERSE_SCALE] as [number, number, number],
};

const ROUTE_DEFINITIONS: RouteDefinition[] = SIMPLE_JOURNEY_MODE
  ? [
      {
        id: 'solar-system-orientation',
        name: 'Solar System Orientation',
        completionScore: 900,
        waypoints: [
          {
            id: 'sol-gate',
            label: 'Sol Gate',
            position: SOLAR_ANCHORS.sol,
            radius: 560,
            discoveryScore: 220,
          },
          {
            id: 'earth-arc',
            label: 'Earth Arc',
            position: SOLAR_ANCHORS.earthArc,
            radius: 460,
            discoveryScore: 280,
          },
          {
            id: 'saturn-gate',
            label: 'Saturn Transfer Gate',
            position: SOLAR_ANCHORS.saturnGate,
            radius: 620,
            discoveryScore: 360,
          },
        ],
      },
    ]
  : [
      {
        id: 'inner-system-survey',
        name: 'Inner System Survey',
        completionScore: 1200,
        waypoints: [
          {
            id: 'sol-gate',
            label: 'Sol Gate',
            position: SOLAR_ANCHORS.sol,
            radius: 460,
            discoveryScore: 180,
          },
          {
            id: 'earth-arc',
            label: 'Earth Arc',
            position: SOLAR_ANCHORS.earthArc,
            radius: 320,
            discoveryScore: 240,
          },
          {
            id: 'saturn-gate',
            label: 'Saturn Transfer Gate',
            position: SOLAR_ANCHORS.saturnGate,
            radius: 460,
            discoveryScore: 320,
          },
        ],
      },
      {
        id: 'pale-blue-express',
        name: 'Pale Blue Express',
        completionScore: 1800,
        waypoints: [
          {
            id: 'earth-arc-express',
            label: 'Earth Arc',
            position: SOLAR_ANCHORS.earthArc,
            radius: 280,
            discoveryScore: 220,
          },
          {
            id: 'pale-blue-vantage',
            label: 'Pale Blue Vantage',
            position: SOLAR_ANCHORS.paleBlueVantage,
            radius: 860,
            discoveryScore: 520,
          },
          {
            id: 'sol-return',
            label: 'Solar Return Window',
            position: SOLAR_ANCHORS.sol,
            radius: 460,
            discoveryScore: 260,
          },
        ],
      },
    ];

function buildGravityHazards(layout: ReturnType<typeof getMissionLayout>): GravityHazard[] {
  const missionPlanetRadius = Math.max(16, layout.planetRadius);
  const missionPlanet = {
    id: 'mission-planet',
    label: 'Defended Planet',
    position: layout.planetPosition.clone(),
    influenceRadius: missionPlanetRadius * 7,
    warningRadius: missionPlanetRadius * 1.7,
    fatalRadius: missionPlanetRadius * 1.08,
    gravityStrength: 260,
    damagePerSecond: 22,
  } as GravityHazard;

  const sunHazard = {
    id: 'sun-core',
    label: 'Sun',
    position: new THREE.Vector3(SUN_OFFSET_SCENE * UNIVERSE_SCALE, 0, 0),
    influenceRadius: 1800,
    warningRadius: 420,
    fatalRadius: 190,
    gravityStrength: 640,
    damagePerSecond: 58,
  } as GravityHazard;

  return [missionPlanet, sunHazard];
}

function updateRouteProgress(gameState: GameState) {
  if (!gameState.metadata) gameState.metadata = {};
  const metadata = gameState.metadata as Record<string, any>;
  const routeProgress = (metadata.routeProgress ??= {} as Record<string, RouteState>);
  const playerPos = gameState.playerEntity.position;

  for (const route of ROUTE_DEFINITIONS) {
    const routeState: RouteState =
      routeProgress[route.id] ??
      (routeProgress[route.id] = {
        visited: [],
        completed: false,
      });

    for (const waypoint of route.waypoints) {
      if (routeState.visited.includes(waypoint.id)) continue;

      const dx = playerPos.x - waypoint.position[0];
      const dy = playerPos.y - waypoint.position[1];
      const dz = playerPos.z - waypoint.position[2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist > waypoint.radius) continue;

      routeState.visited.push(waypoint.id);
      const discoveryReward = Math.round(waypoint.discoveryScore * gameState.comboMultiplier);
      gameState.score += discoveryReward;
      metadata.routeMessage = `Discovery: ${waypoint.label} +${discoveryReward}`;
      metadata.routeMessageUntil = gameState.simTime + 3.4;
    }

    if (!routeState.completed && routeState.visited.length === route.waypoints.length) {
      routeState.completed = true;
      const completionReward = Math.round(route.completionScore * gameState.comboMultiplier);
      gameState.score += completionReward;
      metadata.routeMessage = `Route complete: ${route.name} +${completionReward}`;
      metadata.routeMessageUntil = gameState.simTime + 4.2;
    }
  }

  const activeRoute = ROUTE_DEFINITIONS.find((route) => {
    const state = routeProgress[route.id] as RouteState | undefined;
    return state && !state.completed;
  });

  if (activeRoute) {
    const state = routeProgress[activeRoute.id] as RouteState;
    metadata.activeRouteName = activeRoute.name;
    metadata.activeRouteProgress = `${state.visited.length}/${activeRoute.waypoints.length}`;
  } else {
    metadata.activeRouteName = 'All Routes Complete';
    metadata.activeRouteProgress = `${ROUTE_DEFINITIONS.length}/${ROUTE_DEFINITIONS.length}`;
  }
}

/**
 * Universe Engine's <SceneContents /> sets a dense FogExp2 on the scene as
 * soon as it mounts (density 0.0035 → 50% extinction at ~198 world units),
 * which would swallow everything past the ship in game scale. We render this
 * sibling AFTER it so its effect runs second and replaces the fog with a
 * gentle exp2 falloff matched to game units.
 */
function GameFog() {
  const { scene } = useThree();
  useEffect(() => {
    const prev = scene.fog;
    scene.fog = new THREE.FogExp2('#040816', 0.000065);
    return () => {
      scene.fog = prev;
    };
  }, [scene]);
  return null;
}

/**
 * Game Canvas: Main React component for Helion Drift gameplay.
 * Integrates Universe Engine rendering with Neural Game Engine logic.
 */

interface GameCanvasProps {
  onGameEnd?: (state: GameState) => void;
  onPhaseChange?: (phase: GameState['phase']) => void;
  onReady?: () => void;
}

type CameraAssistLevel = 'low' | 'medium' | 'high';

const FIRE_CADENCE = 0.08;
const FIRE_RECOIL_KICK = 0.55;
const FIRE_RECOIL_DECAY = 6.8;
const FIRE_AUDIO_GAIN = 0.045;

// Weapon presets only differ in feel polish today; audioGain drives the
// volley sound level. (These symbols were previously referenced without a
// definition, which made the first cannon volley throw a ReferenceError.)
type WeaponTuningProfile = 'arcade' | 'cinematic' | 'sim';
const WEAPON_TUNING: Record<WeaponTuningProfile, { audioGain: number }> = {
  arcade: { audioGain: FIRE_AUDIO_GAIN * 1.25 },
  cinematic: { audioGain: FIRE_AUDIO_GAIN },
  sim: { audioGain: FIRE_AUDIO_GAIN * 0.8 },
};

/**
 * React re-render cadence for HUD/menus. The simulation and all Three.js
 * mutation run at full frame rate via refs; React only needs to repaint
 * DOM telemetry, so 12 Hz keeps it readable without reconciling the
 * whole scene graph 60 times a second.
 */
const UI_SYNC_INTERVAL = 1 / 12;

// Module-scope scratch objects, reused every frame to avoid per-frame
// allocations (GC hitches were a major source of frame drops).
const _playerEuler = new THREE.Euler();
const _playerQuat = new THREE.Quaternion();
// Scratch for the 6-DOF local-axis rotation deltas each frame.
const _dqPitch = new THREE.Quaternion();
const _dqYaw = new THREE.Quaternion();
const _dqRoll = new THREE.Quaternion();
const _axisX = new THREE.Vector3(1, 0, 0);
const _axisY = new THREE.Vector3(0, 1, 0);
const _axisZ = new THREE.Vector3(0, 0, 1);
// Dedicated scratch for the auto-level up/forward math (must NOT reuse the
// forwardLocal/rightLocal/upLocal scratch that velocity + firing read).
const _alUp = new THREE.Vector3();
const _alFwd = new THREE.Vector3();
const _alDesiredUp = new THREE.Vector3();
const _forwardLocal = new THREE.Vector3();
const _rightLocal = new THREE.Vector3();
const _upLocal = new THREE.Vector3();
const _desiredVel = new THREE.Vector3();
const _velScratch = new THREE.Vector3();
const _fwdNorm = new THREE.Vector3();
const _lateral = new THREE.Vector3();
const _playerPosVec = new THREE.Vector3();
const _gravityAccel = new THREE.Vector3();
const _hazardDelta = new THREE.Vector3();
const _outward = new THREE.Vector3();

/* --------------------------------------------------------------------------
 * Combat encounters — periodic hostile patrols the player can engage while
 * cruising. The enemy/projectile/score machinery already lives in the game
 * loop (checkProjectileCollisions → score + kill events); this just seeds
 * targets into the world ahead of the flight path and gives them simple
 * drift-toward-player movement. Kept deliberately light so exploration stays
 * the primary mode — patrols are a threat to shoot, not a wave gauntlet.
 * ------------------------------------------------------------------------ */
const ENCOUNTER_INTERVAL_S = 14; // seconds between patrol spawns
const ENCOUNTER_MIN_SPEED = 6; // player must be moving to trigger an encounter
const ENCOUNTER_SPAWN_AHEAD = 140; // scene units ahead along the flight vector
const ENCOUNTER_SPAWN_SPREAD = 26; // lateral scatter of a patrol cluster
const ENCOUNTER_DESPAWN_BEHIND = 260; // cull patrols that fall this far behind
const ENCOUNTER_MAX_LIVE = 9; // hard cap on simultaneous hostiles
const ENEMY_DRIFT_SPEED = 9; // units/sec each hostile closes on the player
const ENEMY_FIRE_RANGE = 170; // hostiles open fire within this distance
// Deep Run sector-entry weapons hold: sector hostiles seed close enough to be
// inside fire range immediately, which killed an idle/orienting player within
// ~10s of a first launch. On sector entry hostiles still close in but hold
// fire briefly — longest on the run's first sector, short deeper in so the
// veteran pacing is unchanged.
// First-sector grace matches the ~11s sector-fact banner so a new player can
// finish reading before the first bolt flies.
const SECTOR_GRACE_FIRST_S = 10;
const SECTOR_GRACE_DEEP_S = 4;
const ENEMY_BOLT_SPEED = 95; // units/sec for enemy projectiles
const ENEMY_BOLT_RADIUS = 0.32; // generous so hits register against the player
const PLAYER_HIT_RADIUS = 2.2; // player collision radius for incoming bolts
const _encounterSpawn = new THREE.Vector3();
const _encounterLateral = new THREE.Vector3();
const _enemyToPlayer = new THREE.Vector3();

const SHIP_THRUSTER_PRESETS: Record<SelectedShip, {
  lateral: number;
  vertical: number;
  coreZ: number;
  nozzleZ: number;
  outerNozzleZ: number;
}> = {
  // Tuned mount points for the default procedural interceptor.
  'default-vanguard': { lateral: 0.26, vertical: 0.22, coreZ: 0.78, nozzleZ: 0.98, outerNozzleZ: 1.14 },
  // Derived from the printed GLB exhausts (KESTREL_BUILD_OK ±0.14, ±0.10, 2.187;
  // GYRFALCON_BUILD_OK ±0.62, ±0.14, 2.438) via the same preset↔GLB mapping the
  // Peregrine uses (±0.681, ±0.146, 1.997 → 0.26/0.22/0.78).
  kestrel: { lateral: 0.05, vertical: 0.15, coreZ: 0.85, nozzleZ: 1.07, outerNozzleZ: 1.25 },
  gyrfalcon: { lateral: 0.24, vertical: 0.21, coreZ: 0.95, nozzleZ: 1.2, outerNozzleZ: 1.39 },
};

/**
 * Player ship component with enhanced thruster and RCS visuals.
 */
function PlayerShipGroup({ gameState, showForwardDebug }: { gameState: GameState; showForwardDebug: boolean }) {
  const outerGroupRef = useRef<THREE.Group>(null);
  const innerGroupRef = useRef<THREE.Group>(null);
  const engineGlow1Ref = useRef<THREE.Mesh>(null);
  const engineGlow2Ref = useRef<THREE.Mesh>(null);
  const engineGlow3Ref = useRef<THREE.Mesh>(null);
  const engineGlow4Ref = useRef<THREE.Mesh>(null);
  const engineCore1Ref = useRef<THREE.Mesh>(null);
  const engineCore2Ref = useRef<THREE.Mesh>(null);
  const engineCore3Ref = useRef<THREE.Mesh>(null);
  const engineCore4Ref = useRef<THREE.Mesh>(null);
  const thrusterCone1Ref = useRef<THREE.Mesh>(null);
  const thrusterCone2Ref = useRef<THREE.Mesh>(null);
  const thrusterCone3Ref = useRef<THREE.Mesh>(null);
  const thrusterCone4Ref = useRef<THREE.Mesh>(null);
  const outerPlume1Ref = useRef<THREE.Mesh>(null);
  const outerPlume2Ref = useRef<THREE.Mesh>(null);
  const outerPlume3Ref = useRef<THREE.Mesh>(null);
  const outerPlume4Ref = useRef<THREE.Mesh>(null);
  const rcsNoseLeftRef = useRef<THREE.Mesh>(null);
  const rcsNoseRightRef = useRef<THREE.Mesh>(null);
  const rcsTopRef = useRef<THREE.Mesh>(null);
  const rcsBottomRef = useRef<THREE.Mesh>(null);
  const rcsWingLeftRef = useRef<THREE.Mesh>(null);
  const rcsWingRightRef = useRef<THREE.Mesh>(null);
  const rcsRearLeftRef = useRef<THREE.Mesh>(null);
  const rcsRearRightRef = useRef<THREE.Mesh>(null);
  const rcsRearTopRef = useRef<THREE.Mesh>(null);
  const rcsRearBottomRef = useRef<THREE.Mesh>(null);
  const cockpitGlowRef = useRef<THREE.Mesh>(null);
  const noseGlowRef = useRef<THREE.Mesh>(null);
  const runningLightLeftRef = useRef<THREE.Mesh>(null);
  const runningLightRightRef = useRef<THREE.Mesh>(null);
  const visualBankRef = useRef(0);
  const recoilVisualRef = useRef(0);
  const gravityVisualRef = useRef(0);
  const thrusterRefs = useMemo(() => [thrusterCone1Ref, thrusterCone2Ref, thrusterCone3Ref, thrusterCone4Ref], []);
  const outerPlumeRefs = useMemo(() => [outerPlume1Ref, outerPlume2Ref, outerPlume3Ref, outerPlume4Ref], []);
  const selectedShip = (gameState.selectedShip || 'default-vanguard') as SelectedShip;
  const shipTransform = useMemo(() => getPlayerShipTransform(selectedShip, 'game'), [selectedShip]);
  const thrusterPreset = SHIP_THRUSTER_PRESETS[selectedShip] ?? SHIP_THRUSTER_PRESETS['default-vanguard'];
  const usingDefaultMountMap = selectedShip === 'default-vanguard';
  const engineMounts = useMemo(
    () => {
      if (usingDefaultMountMap) {
        // Mount map aligned to the Peregrine GLB's FOUR wing-root nacelle
        // exhausts — one plume per nacelle. Positions come straight from the
        // build's printed exhausts_three (build_peregrine.py):
        // (±0.681, ±0.146, 1.997) in GLB source space.
        return [
          [-0.681, 0.146, 1.997] as [number, number, number],
          [-0.681, -0.146, 1.997] as [number, number, number],
          [0.681, 0.146, 1.997] as [number, number, number],
          [0.681, -0.146, 1.997] as [number, number, number],
        ];
      }

      return [
        [-thrusterPreset.lateral, thrusterPreset.vertical, thrusterPreset.coreZ] as [number, number, number],
        [-thrusterPreset.lateral, -thrusterPreset.vertical, thrusterPreset.coreZ] as [number, number, number],
        [thrusterPreset.lateral, thrusterPreset.vertical, thrusterPreset.coreZ] as [number, number, number],
        [thrusterPreset.lateral, -thrusterPreset.vertical, thrusterPreset.coreZ] as [number, number, number],
      ];
    },
    [thrusterPreset, usingDefaultMountMap]
  );
  const rearNozzleZs = useMemo(
    () =>
      usingDefaultMountMap
        ? [2.05, 2.05, 2.05, 2.05]
        : [thrusterPreset.nozzleZ, thrusterPreset.nozzleZ, thrusterPreset.nozzleZ, thrusterPreset.nozzleZ],
    [usingDefaultMountMap, thrusterPreset.nozzleZ]
  );
  const rearOuterNozzleZs = useMemo(
    () =>
      usingDefaultMountMap
        ? [2.21, 2.21, 2.21, 2.21]
        : [thrusterPreset.outerNozzleZ, thrusterPreset.outerNozzleZ, thrusterPreset.outerNozzleZ, thrusterPreset.outerNozzleZ],
    [usingDefaultMountMap, thrusterPreset.outerNozzleZ]
  );
  const initialPlumeLength = 1.05;
  const initialThrusterCenters = useMemo(
    () => rearNozzleZs.map((z) => z - 0.9 * initialPlumeLength),
    [rearNozzleZs]
  );
  const initialOuterCenters = useMemo(
    () => rearOuterNozzleZs.map((z) => z - 1.2 * initialPlumeLength * 1.22),
    [rearOuterNozzleZs]
  );

  // Update engine trail, visual banking, and responsive glow
  useFrame((state, delta) => {
    // Track the sim at full frame rate — React renders are throttled, so the
    // ship's world transform must be copied imperatively every frame.
    if (outerGroupRef.current) {
      outerGroupRef.current.position.set(
        gameState.playerEntity.position.x,
        gameState.playerEntity.position.y,
        gameState.playerEntity.position.z
      );
      outerGroupRef.current.rotation.set(
        gameState.playerEntity.rotation.x,
        gameState.playerEntity.rotation.y,
        gameState.playerEntity.rotation.z
      );
    }

    const vx = gameState.playerEntity.velocity.x;
    const vy = gameState.playerEntity.velocity.y;
    const vz = gameState.playerEntity.velocity.z;
    const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);

    // Visual banking from lateral velocity
    const targetBank = Math.max(-0.35, Math.min(0.35, -vx * 0.018));
    const bankK = 1 - Math.exp(-delta * 4.5);
    visualBankRef.current += (targetBank - visualBankRef.current) * bankK;
    const recoilSignal = Number(gameState.playerEntity.metadata?.weaponRecoil ?? 0);
    const gravitySignal = Number(gameState.playerEntity.metadata?.gravityLoad ?? 0);
    recoilVisualRef.current += (recoilSignal - recoilVisualRef.current) * (1 - Math.exp(-delta * 16));
    gravityVisualRef.current += (gravitySignal - gravityVisualRef.current) * (1 - Math.exp(-delta * 8));
    if (innerGroupRef.current) {
      const gravityShake = gravityVisualRef.current * (0.01 + Math.sin(state.clock.elapsedTime * 28) * 0.012);
      innerGroupRef.current.rotation.z = visualBankRef.current;
      innerGroupRef.current.rotation.x = recoilVisualRef.current * 0.04 + gravityShake;
      innerGroupRef.current.position.z = recoilVisualRef.current * 0.18 - gravityVisualRef.current * 0.1;
      innerGroupRef.current.position.y = Math.sin(state.clock.elapsedTime * 19) * gravityVisualRef.current * 0.06;
    }

    // Velocity-responsive engine glow brightness and scale
    const thrustSignal = Number(gameState.playerEntity.metadata?.thrustLevel ?? 0);
    const boostActive = Boolean(gameState.playerEntity.metadata?.boostActive);
    const normalizedSpeed = Math.min(speed / 40, 1.0);
    const driveSignal = Math.max(normalizedSpeed, thrustSignal);
    const flicker =
      0.92 +
      Math.sin(state.clock.elapsedTime * (boostActive ? 38 : 26)) * 0.05 +
      Math.sin(state.clock.elapsedTime * (boostActive ? 61 : 47)) * 0.04;
    const engineOpacity = (0.08 + driveSignal * (boostActive ? 0.18 : 0.14)) * flicker;
    const engineScale = 0.44 + driveSignal * (boostActive ? 0.32 : 0.26);
    const coreOpacity = (0.28 + driveSignal * (boostActive ? 0.14 : 0.1)) * flicker;
    const coreScale = 0.74 + driveSignal * (boostActive ? 0.18 : 0.12);

    [engineGlow1Ref, engineGlow2Ref, engineGlow3Ref, engineGlow4Ref].forEach(ref => {
      if (!ref.current) return;
      (ref.current.material as THREE.MeshBasicMaterial).opacity = engineOpacity;
      ref.current.scale.setScalar(engineScale);
    });

    [engineCore1Ref, engineCore2Ref, engineCore3Ref, engineCore4Ref].forEach(ref => {
      if (!ref.current) return;
      (ref.current.material as THREE.MeshBasicMaterial).opacity = coreOpacity;
      ref.current.scale.setScalar(coreScale);
    });

    const plumeLength = 0.42 + driveSignal * (boostActive ? 0.84 : 0.68);
    const plumeRadius = 0.24 + driveSignal * (boostActive ? 0.06 : 0.05);
    const plumeOpacity = (0.04 + driveSignal * (boostActive ? 0.12 : 0.1)) * flicker;
    const outerPlumeOpacity = (0.015 + driveSignal * (boostActive ? 0.07 : 0.055)) * flicker;
    const thrusterHalfLength = 0.9 * plumeLength;
    const outerHalfLength = 1.2 * plumeLength * 1.22;
    thrusterRefs.forEach((ref, idx) => {
      if (!ref.current) return;
      ref.current.scale.set(plumeRadius, plumeLength, plumeRadius);
      (ref.current.material as THREE.MeshBasicMaterial).opacity = plumeOpacity;
      // Keep the cone base fixed at the rear nozzle and extend plume behind the ship.
      ref.current.position.z = rearNozzleZs[idx] - thrusterHalfLength;
    });

    outerPlumeRefs.forEach((ref, idx) => {
      if (!ref.current) return;
      ref.current.scale.set(plumeRadius * 1.5, plumeLength * 1.22, plumeRadius * 1.5);
      (ref.current.material as THREE.MeshBasicMaterial).opacity = outerPlumeOpacity;
      ref.current.position.z = rearOuterNozzleZs[idx] - outerHalfLength;
    });

    // RCS maneuvering thrusters — fire on the side matching user input.
    // Intuitive visual mapping: steer left → left-side thrusters glow.
    const rcsYaw = Number(gameState.playerEntity.metadata?.rcsYaw ?? 0);
    const rcsPitch = Number(gameState.playerEntity.metadata?.rcsPitch ?? 0);
    const rcsRoll = Number(gameState.playerEntity.metadata?.rcsRoll ?? 0);
    const rcsBrake = Number(gameState.playerEntity.metadata?.rcsBrake ?? 0);
    const yawStrength = Math.min(1, Math.abs(rcsYaw) * 18);
    const pitchStrength = Math.min(1, Math.abs(rcsPitch) * 18);
    const rollStrength = Math.min(1, Math.abs(rcsRoll) * 18);

    // Input direction → which side fires
    const yawLeft = rcsYaw > 0.02;   // steering left
    const yawRight = rcsYaw < -0.02; // steering right
    const pitchUp = rcsPitch > 0.02;
    const pitchDown = rcsPitch < -0.02;
    const rollLeft = rcsRoll > 0.02;
    const rollRight = rcsRoll < -0.02;

    const baseRcs = 0.02;
    const activeRcs = 0.65;

    const noseLeftOpacity = baseRcs + (yawLeft ? yawStrength * activeRcs : 0) + (rollLeft ? rollStrength * activeRcs * 0.5 : 0) + rcsBrake * 0.3;
    const noseRightOpacity = baseRcs + (yawRight ? yawStrength * activeRcs : 0) + (rollRight ? rollStrength * activeRcs * 0.5 : 0) + rcsBrake * 0.3;
    const topOpacity = baseRcs + (pitchUp ? pitchStrength * activeRcs : 0);
    const bottomOpacity = baseRcs + (pitchDown ? pitchStrength * activeRcs : 0);
    const wingLeftOpacity = baseRcs + (rollLeft ? rollStrength * activeRcs : 0) + (yawLeft ? yawStrength * activeRcs * 0.4 : 0);
    const wingRightOpacity = baseRcs + (rollRight ? rollStrength * activeRcs : 0) + (yawRight ? yawStrength * activeRcs * 0.4 : 0);
    const rearLeftOpacity = baseRcs + (yawLeft ? yawStrength * activeRcs : 0) + (rollLeft ? rollStrength * activeRcs * 0.5 : 0) + rcsBrake * 0.3;
    const rearRightOpacity = baseRcs + (yawRight ? yawStrength * activeRcs : 0) + (rollRight ? rollStrength * activeRcs * 0.5 : 0) + rcsBrake * 0.3;
    const rearTopOpacity = baseRcs + (pitchUp ? pitchStrength * activeRcs : 0);
    const rearBottomOpacity = baseRcs + (pitchDown ? pitchStrength * activeRcs : 0);

    const setRcs = (ref: React.RefObject<THREE.Mesh | null>, opacity: number, color = 0x9fd8ff) => {
      if (!ref.current) return;
      const mat = ref.current.material as THREE.MeshBasicMaterial;
      mat.opacity = opacity;
      if (opacity > 0.15) {
        mat.color.setHex(color);
      } else {
        mat.color.setHex(0x9fd8ff);
      }
    };

    setRcs(rcsNoseLeftRef, noseLeftOpacity, 0x40d8ff);
    setRcs(rcsNoseRightRef, noseRightOpacity, 0x40d8ff);
    setRcs(rcsTopRef, topOpacity, 0x40d8ff);
    setRcs(rcsBottomRef, bottomOpacity, 0x40d8ff);
    setRcs(rcsWingLeftRef, wingLeftOpacity, 0x40d8ff);
    setRcs(rcsWingRightRef, wingRightOpacity, 0x40d8ff);
    setRcs(rcsRearLeftRef, rearLeftOpacity, 0x40d8ff);
    setRcs(rcsRearRightRef, rearRightOpacity, 0x40d8ff);
    setRcs(rcsRearTopRef, rearTopOpacity, 0x40d8ff);
    setRcs(rcsRearBottomRef, rearBottomOpacity, 0x40d8ff);

    // Nose forward glow — pulses with thrust, brightens when boosting
    if (noseGlowRef.current) {
      const nosePulse = 0.45 + driveSignal * 0.28 + (boostActive ? 0.14 : 0);
      const noseScale = 0.72 + Math.sin(state.clock.elapsedTime * 4.2) * 0.08 + driveSignal * 0.18;
      noseGlowRef.current.scale.setScalar(noseScale);
      (noseGlowRef.current.material as THREE.MeshBasicMaterial).opacity = 0.07 * nosePulse;
    }

    // Running lights — aviation standard: red port (left), green starboard (right)
    if (runningLightLeftRef.current) {
      const blink = 0.7 + Math.sin(state.clock.elapsedTime * 2.8) * 0.3;
      (runningLightLeftRef.current.material as THREE.MeshBasicMaterial).opacity = 0.85 * blink;
    }
    if (runningLightRightRef.current) {
      const blink = 0.7 + Math.sin(state.clock.elapsedTime * 2.8 + 1.5) * 0.3;
      (runningLightRightRef.current.material as THREE.MeshBasicMaterial).opacity = 0.85 * blink;
    }

    // Cockpit glow pulses faster when boosting
    if (cockpitGlowRef.current) {
      const pulseFreq = 1.5 + driveSignal * (boostActive ? 5.0 : 3.0);
      const pulseAmt = 0.84 + Math.sin(state.clock.elapsedTime * pulseFreq) * 0.12;
      cockpitGlowRef.current.scale.setScalar(pulseAmt * 0.82);
      (cockpitGlowRef.current.material as THREE.MeshBasicMaterial).opacity = 0.08 + driveSignal * 0.05;
      (cockpitGlowRef.current.material as THREE.MeshBasicMaterial).color.set(
        gravityVisualRef.current > 0.62 ? 0xff7d7d : 0x7fffd4
      );
    }
  });

  return (
    <group
      ref={outerGroupRef}
      position={[gameState.playerEntity.position.x, gameState.playerEntity.position.y, gameState.playerEntity.position.z]}
      rotation={[gameState.playerEntity.rotation.x, gameState.playerEntity.rotation.y, gameState.playerEntity.rotation.z]}
    >
      <group ref={innerGroupRef}>
        <group scale={shipTransform.scale} position={shipTransform.position} rotation={shipTransform.rotation}>
          <group rotation={SHIP_MODEL_BASIS_ROTATION}>
          <Suspense fallback={<ProceduralPlayerShipModel shipId={selectedShip} mode="game" applyTransform={false} />}>
            <PlayerShipModel shipId={selectedShip} mode="game" applyTransform={false} applyBasisCorrection={false} />
          </Suspense>

          <pointLight position={[0, 0.18, 1.45]} intensity={0.72} distance={16} color={0xcde6ff} />
          <pointLight position={[0, 0.14, -0.82]} intensity={0.34} distance={10} color={0x9ecbff} />
          <pointLight position={[0, 0.72, 0.1]} intensity={0.26} distance={9} color={0xffffff} />

          {/* REMOVED: the big additive aura icosahedron, the cockpit-glow sphere,
              and the procedural canopy-glass shell. The Blender player-ship GLB
              already has its own canopy + emissive engine cores; these add-ons were
              sized/placed for the retired procedural hull and rendered as oversized
              glassy blobs floating beside the ship — the "looks funny" bug. We keep
              only the small, realigned exhaust plumes behind the real engine cores
              below. */}

          {/* Rear engine nozzle lips + cores for cleaner, higher-fidelity engine ends. */}
          {engineMounts.map((mount, idx) => (
            <group key={`engine-nozzle-${idx}`} position={[mount[0], mount[1], rearNozzleZs[idx]]}>
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.13, 0.19, 26]} />
                <meshStandardMaterial color={0x6f7f90} roughness={0.34} metalness={0.88} />
              </mesh>
              <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.012]}>
                <circleGeometry args={[0.1, 26]} />
                <meshStandardMaterial color={0x273a4a} roughness={0.18} metalness={0.95} emissive={0x345d7a} emissiveIntensity={0.2} />
              </mesh>
            </group>
          ))}

          {/* Engine exhaust — only the thrust plumes now (the static glow/core
              spheres were removed; they clung to the wingtips as pale blobs and
              the GLB nacelles already glow). The plumes animate with thrust. */}
          <mesh ref={thrusterCone1Ref} position={[engineMounts[0][0], engineMounts[0][1], initialThrusterCenters[0]]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.11, 1.1, 14, 1, true]} />
          <meshBasicMaterial color={0x8fdbff} transparent opacity={0.36} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
          <mesh ref={outerPlume1Ref} position={[engineMounts[0][0], engineMounts[0][1], initialOuterCenters[0]]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.16, 1.5, 14, 1, true]} />
          <meshBasicMaterial color={0x4c9dff} transparent opacity={0.2} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>

          <mesh ref={thrusterCone2Ref} position={[engineMounts[1][0], engineMounts[1][1], initialThrusterCenters[1]]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.11, 1.1, 14, 1, true]} />
          <meshBasicMaterial color={0x8fdbff} transparent opacity={0.36} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
          <mesh ref={outerPlume2Ref} position={[engineMounts[1][0], engineMounts[1][1], initialOuterCenters[1]]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.16, 1.5, 14, 1, true]} />
          <meshBasicMaterial color={0x4c9dff} transparent opacity={0.2} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>

          <mesh ref={thrusterCone3Ref} position={[engineMounts[2][0], engineMounts[2][1], initialThrusterCenters[2]]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.11, 1.1, 14, 1, true]} />
          <meshBasicMaterial color={0x8fdbff} transparent opacity={0.36} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
          <mesh ref={outerPlume3Ref} position={[engineMounts[2][0], engineMounts[2][1], initialOuterCenters[2]]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.16, 1.5, 14, 1, true]} />
          <meshBasicMaterial color={0x4c9dff} transparent opacity={0.2} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>

          <mesh ref={thrusterCone4Ref} position={[engineMounts[3][0], engineMounts[3][1], initialThrusterCenters[3]]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.11, 1.1, 14, 1, true]} />
          <meshBasicMaterial color={0x8fdbff} transparent opacity={0.36} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
          <mesh ref={outerPlume4Ref} position={[engineMounts[3][0], engineMounts[3][1], initialOuterCenters[3]]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.16, 1.5, 14, 1, true]} />
          <meshBasicMaterial color={0x4c9dff} transparent opacity={0.2} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>

          {/* Nose forward glow cone — orientation marker */}
          <mesh ref={noseGlowRef} position={[0, 0.08, -2.05]} rotation={[-Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.35, 1.2, 16, 1, true]} />
            <meshBasicMaterial color={0x40d8ff} transparent opacity={0.05} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>

          {/* Running lights — aviation standard: red port (left), green starboard (right) */}
          <mesh ref={runningLightLeftRef} position={[-1.05, 0.08, 0.8]}>
            <sphereGeometry args={[0.07, 8, 8]} />
            <meshBasicMaterial color={0xff3333} transparent opacity={0.7} blending={THREE.AdditiveBlending} toneMapped={false} depthWrite={false} />
          </mesh>
          <mesh ref={runningLightRightRef} position={[1.05, 0.08, 0.8]}>
            <sphereGeometry args={[0.07, 8, 8]} />
            <meshBasicMaterial color={0x33ff66} transparent opacity={0.7} blending={THREE.AdditiveBlending} toneMapped={false} depthWrite={false} />
          </mesh>

          {/* Ship outer halo ring for visibility against dark space */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[2.8, 3.0, 64]} />
            <meshBasicMaterial color={0x40d8ff} transparent opacity={0.02} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>

          {/* RCS maneuvering thrusters — front + rear for realistic attitude control */}
          {/* Front RCS */}
          <mesh ref={rcsNoseLeftRef} position={[-0.95, 0.06, -1.55]}>
            <sphereGeometry args={[0.1, 8, 8]} />
            <meshBasicMaterial color={0x9fd8ff} transparent opacity={0.02} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
          <mesh ref={rcsNoseRightRef} position={[0.95, 0.06, -1.55]}>
            <sphereGeometry args={[0.1, 8, 8]} />
            <meshBasicMaterial color={0x9fd8ff} transparent opacity={0.02} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
          <mesh ref={rcsTopRef} position={[0, 0.56, -0.55]}>
            <sphereGeometry args={[0.09, 8, 8]} />
            <meshBasicMaterial color={0x9fd8ff} transparent opacity={0.02} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
          <mesh ref={rcsBottomRef} position={[0, -0.56, -0.55]}>
            <sphereGeometry args={[0.09, 8, 8]} />
            <meshBasicMaterial color={0x9fd8ff} transparent opacity={0.02} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
          {/* Wing RCS */}
          <mesh ref={rcsWingLeftRef} position={[-1.35, 0, -0.22]}>
            <sphereGeometry args={[0.09, 8, 8]} />
            <meshBasicMaterial color={0x9fd8ff} transparent opacity={0.02} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
          <mesh ref={rcsWingRightRef} position={[1.35, 0, -0.22]}>
            <sphereGeometry args={[0.09, 8, 8]} />
            <meshBasicMaterial color={0x9fd8ff} transparent opacity={0.02} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
          {/* Rear RCS */}
          <mesh ref={rcsRearLeftRef} position={[-0.85, 0.06, 1.15]}>
            <sphereGeometry args={[0.1, 8, 8]} />
            <meshBasicMaterial color={0x9fd8ff} transparent opacity={0.02} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
          <mesh ref={rcsRearRightRef} position={[0.85, 0.06, 1.15]}>
            <sphereGeometry args={[0.1, 8, 8]} />
            <meshBasicMaterial color={0x9fd8ff} transparent opacity={0.02} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
          <mesh ref={rcsRearTopRef} position={[0, 0.52, 1.0]}>
            <sphereGeometry args={[0.09, 8, 8]} />
            <meshBasicMaterial color={0x9fd8ff} transparent opacity={0.02} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
          <mesh ref={rcsRearBottomRef} position={[0, -0.52, 1.0]}>
            <sphereGeometry args={[0.09, 8, 8]} />
            <meshBasicMaterial color={0x9fd8ff} transparent opacity={0.02} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>

          {/* Optional forward debug marker (nose direction). Toggle with V. */}
          {showForwardDebug && (
            <mesh position={[0, 0.06, -3.25]} rotation={[-Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.12, 0.42, 12]} />
              <meshBasicMaterial color={0x34d399} transparent opacity={0.9} depthWrite={false} />
            </mesh>
          )}
          </group>
        </group>
      </group>
    </group>
  );
}

/**
 * Enemy ship component: procedurally generated with engine glow.
 */
/**
 * The ship's JSX subtree is large (engine glows, RCS thrusters, plumes) but
 * structurally static — all animation runs imperatively in its useFrame.
 * Re-render only when the selected hull or debug overlay changes.
 */
const MemoPlayerShipGroup = memo(
  PlayerShipGroup,
  (prev, next) =>
    prev.showForwardDebug === next.showForwardDebug &&
    prev.gameState.selectedShip === next.gameState.selectedShip
);

// Blender enemy GLBs by class. Built Y-forward (same basis as the player
// ship), so they reuse SHIP_MODEL_BASIS_ROTATION.
const ENEMY_MODEL_PATHS: Record<string, string> = {
  fighter: '/models/enemy-fighter.glb',
  sniper: '/models/enemy-sniper.glb',
  swarm: '/models/enemy-swarm.glb',
  boss: '/models/enemy-boss.glb',
};
Object.values(ENEMY_MODEL_PATHS).forEach((p) => useGLTF.preload(p));

/* --------------------------------------------------------------------------
 * TargetingReticles — combat HUD in 3D space. Draws four corner brackets that
 * billboard toward the camera on every active hostile (constant screen size via
 * distance scaling), tinted by threat. The NEAREST in-front hostile is the
 * "locked" target: it gets a brighter full bracket + a small lead indicator
 * (where to put your nose to hit it, given its velocity and the bolt speed).
 * Pure scene geometry — no DOM/React thrash. This is the single biggest "real
 * combat game vs tech demo" tell.
 * ----------------------------------------------------------------------------*/
const _trCamPos = new THREE.Vector3();
const _trToEnemy = new THREE.Vector3();
const _trLead = new THREE.Vector3();
const RETICLE_POOL = 12;

// One bracket = 4 small L-shaped corners on a unit square, as line segments.
function makeBracketGeometry(): THREE.BufferGeometry {
  const a = 0.5, arm = 0.18;
  const segs: number[] = [];
  const corner = (cx: number, cy: number, dx: number, dy: number) => {
    segs.push(cx, cy, 0, cx + dx * arm, cy, 0);
    segs.push(cx, cy, 0, cx, cy + dy * arm, 0);
  };
  corner(-a, a, 1, -1); corner(a, a, -1, -1);
  corner(-a, -a, 1, 1); corner(a, -a, -1, 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(segs, 3));
  return g;
}

function TargetingReticles({ gameState }: { gameState: GameState }) {
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const bracketGeo = useMemo(() => makeBracketGeometry(), []);
  // a small pool of reusable bracket line objects + the lock ring + lead marker
  const pool = useRef<THREE.LineSegments[]>([]);
  const lockRef = useRef<THREE.Mesh>(null);
  const leadRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const grp = groupRef.current;
    if (!grp) return;
    camera.getWorldPosition(_trCamPos);
    const px = gameState.playerEntity.position.x;
    const py = gameState.playerEntity.position.y;
    const pz = gameState.playerEntity.position.z;

    // pick the nearest active hostile that's roughly in front of the camera
    const active = gameState.enemies.filter((e) => e.active);
    let lockTarget: GameEntity | null = null;
    let lockDist = Infinity;

    let slot = 0;
    for (const e of active) {
      if (slot >= RETICLE_POOL) break;
      const seg = pool.current[slot];
      if (!seg) { slot++; continue; }
      _trToEnemy.set(e.position.x - _trCamPos.x, e.position.y - _trCamPos.y, e.position.z - _trCamPos.z);
      const camDist = _trToEnemy.length();
      seg.position.set(e.position.x, e.position.y, e.position.z);
      seg.quaternion.copy(camera.quaternion); // billboard
      // constant on-screen size: scale with distance from camera
      const s = Math.max(0.6, camDist * 0.045) + (e.radius || 0.8);
      seg.scale.setScalar(s);
      seg.visible = true;
      const mat = seg.material as THREE.LineBasicMaterial;
      const boss = e.metadata?.class === 'boss';
      mat.color.setHex(boss ? 0xff8a3a : 0xff5a52);
      mat.opacity = 0.5;
      // nearest to the PLAYER (not camera) = lock candidate
      const pd = Math.hypot(e.position.x - px, e.position.y - py, e.position.z - pz);
      if (pd < lockDist) { lockDist = pd; lockTarget = e; }
      slot++;
    }
    for (let i = slot; i < pool.current.length; i++) {
      if (pool.current[i]) pool.current[i].visible = false;
    }

    // Lock highlight + lead indicator on the nearest hostile
    const lock = lockRef.current;
    const lead = leadRef.current;
    if (lockTarget && lockDist < 240) {
      const e = lockTarget;
      _trToEnemy.set(e.position.x - _trCamPos.x, e.position.y - _trCamPos.y, e.position.z - _trCamPos.z);
      const camDist = _trToEnemy.length();
      const s = Math.max(0.6, camDist * 0.045) + (e.radius || 0.8);
      if (lock) {
        lock.visible = true;
        lock.position.set(e.position.x, e.position.y, e.position.z);
        lock.quaternion.copy(camera.quaternion);
        lock.scale.setScalar(s * 1.5);
        (lock.material as THREE.MeshBasicMaterial).opacity = 0.32 + Math.sin(gameState.simTime * 6) * 0.12;
      }
      // lead point: where the target will be when a bolt reaches it
      const tof = lockDist / 210; // player bolt speed ≈ 210
      _trLead.set(
        e.position.x + e.velocity.x * tof,
        e.position.y + e.velocity.y * tof,
        e.position.z + e.velocity.z * tof,
      );
      if (lead) {
        lead.visible = true;
        lead.position.copy(_trLead);
        lead.quaternion.copy(camera.quaternion);
        lead.scale.setScalar(Math.max(0.3, camDist * 0.02));
      }
    } else {
      if (lock) lock.visible = false;
      if (lead) lead.visible = false;
    }
  });

  return (
    <group ref={groupRef}>
      {Array.from({ length: RETICLE_POOL }).map((_, i) => (
        <lineSegments
          key={i}
          geometry={bracketGeo}
          visible={false}
          ref={(el: THREE.LineSegments | null) => { if (el) pool.current[i] = el; }}
        >
          <lineBasicMaterial transparent opacity={0.5} depthTest={false} toneMapped={false} />
        </lineSegments>
      ))}
      {/* lock ring on the nearest target */}
      <mesh ref={lockRef} visible={false} renderOrder={999}>
        <ringGeometry args={[0.62, 0.7, 40]} />
        <meshBasicMaterial color={0x7af0ff} transparent opacity={0.4} depthTest={false} toneMapped={false} />
      </mesh>
      {/* lead-aim marker (where to shoot) */}
      <mesh ref={leadRef} visible={false} renderOrder={999}>
        <ringGeometry args={[0.28, 0.4, 4]} />
        <meshBasicMaterial color={0x7af0ff} transparent opacity={0.85} depthTest={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

function EnemyShipGroup({ enemy }: { enemy: GameEntity }) {
  const groupRef = useRef<THREE.Group>(null);
  const factionClass = (enemy.metadata?.class ?? 'fighter') as any;
  const modelPath = ENEMY_MODEL_PATHS[factionClass] ?? ENEMY_MODEL_PATHS.fighter;
  const gltf = useGLTF(modelPath);
  const shipGroup = useMemo(() => {
    const cloned = gltf.scene.clone(true);
    cloned.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.frustumCulled = false;
      }
    });
    // Scale the model to the entity's gameplay radius (source enemies are
    // modelled ~1-3 units; normalise toward the sim radius).
    const s = (enemy.radius / 0.8) * 0.6;
    cloned.scale.setScalar(s);
    return cloned;
  }, [gltf.scene, enemy.radius]);

  // Calculate movement speed for glow intensity
  const speed = Math.sqrt(enemy.velocity.x ** 2 + enemy.velocity.y ** 2 + enemy.velocity.z ** 2);
  const glowIntensity = Math.min(speed / 10, 0.7);

  // The sim mutates the shared entity object in place; copy its transform at
  // full frame rate since React renders are throttled.
  useFrame(() => {
    if (!groupRef.current) return;
    groupRef.current.position.set(enemy.position.x, enemy.position.y, enemy.position.z);
    groupRef.current.rotation.set(enemy.rotation.x, enemy.rotation.y, enemy.rotation.z);
    groupRef.current.visible = enemy.active;
  });

  return (
    <group
      ref={groupRef}
      position={[enemy.position.x, enemy.position.y, enemy.position.z]}
      rotation={[enemy.rotation.x, enemy.rotation.y, enemy.rotation.z]}
    >
      {/* Y-forward GLB → game -Z forward, same basis as the player ship. */}
      <group rotation={SHIP_MODEL_BASIS_ROTATION}>
        <primitive object={shipGroup} />
      </group>

      {/* Engine glow */}
      <mesh position={[0, 0, -2]}>
        <sphereGeometry args={[0.4, 6, 6]} />
        <meshBasicMaterial
          color={factionClass === 'boss' ? 0xff6600 : 0xff3333}
          transparent
          opacity={0.3 + glowIntensity}
        />
      </mesh>
    </group>
  );
}

/* --------------------------------------------------------------------------
 * ProjectileField — instanced renderer for plasma bolts. The sim owns the
 * projectile list; this component mirrors it into two InstancedMeshes (tracer
 * core + halo) every frame. No React reconciliation per bolt.
 * ------------------------------------------------------------------------ */

const PROJECTILE_POOL = 96;
const _projDummy = new THREE.Object3D();
const _projDir = new THREE.Vector3();
const _projZ = new THREE.Vector3(0, 0, 1);
const _projColor = new THREE.Color();

function ProjectileField({ gameState }: { gameState: GameState }) {
  const coreRef = useRef<THREE.InstancedMesh>(null);
  const haloRef = useRef<THREE.InstancedMesh>(null);

  useFrame(() => {
    const core = coreRef.current;
    const halo = haloRef.current;
    if (!core || !halo) return;

    let slot = 0;
    for (const proj of gameState.projectiles) {
      if (slot >= PROJECTILE_POOL) break;
      if (!proj.active) continue;

      _projDir.set(proj.velocity.x, proj.velocity.y, proj.velocity.z);
      if (_projDir.lengthSq() > 1e-6) {
        _projDir.normalize();
      } else {
        _projDir.set(0, 0, -1);
      }

      const age = Math.max(0, gameState.simTime - Number(proj.metadata?.bornAt ?? gameState.simTime));
      const pulse = 0.9 + Math.sin(age * 34) * 0.08;

      _projDummy.position.set(proj.position.x, proj.position.y, proj.position.z);
      _projDummy.quaternion.setFromUnitVectors(_projZ, _projDir);
      _projDummy.scale.setScalar(pulse);
      _projDummy.updateMatrix();

      const isEnemyBolt = proj.metadata?.isEnemyBolt === true;
      const isWingCannon = proj.metadata?.source === 'wing-cannon';
      // enemy fire reads hostile-red; player cannons stay cyan; misc = amber
      const coreHex = isEnemyBolt ? 0xff5a44 : isWingCannon ? 0x9de8ff : 0xffff00;
      const haloHex = isEnemyBolt ? 0xff3322 : isWingCannon ? 0x52c9ff : 0xffcc00;
      core.setMatrixAt(slot, _projDummy.matrix);
      core.setColorAt(slot, _projColor.setHex(coreHex));
      halo.setMatrixAt(slot, _projDummy.matrix);
      halo.setColorAt(slot, _projColor.setHex(haloHex));
      slot += 1;
    }

    core.count = slot;
    halo.count = slot;
    core.instanceMatrix.needsUpdate = true;
    halo.instanceMatrix.needsUpdate = true;
    if (core.instanceColor) core.instanceColor.needsUpdate = true;
    if (halo.instanceColor) halo.instanceColor.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={coreRef} args={[undefined, undefined, PROJECTILE_POOL]} frustumCulled={false}>
        <capsuleGeometry args={[0.08, 1.55, 8, 16]} />
        <meshBasicMaterial color={0xffffff} transparent opacity={0.95} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={haloRef} args={[undefined, undefined, PROJECTILE_POOL]} frustumCulled={false}>
        <capsuleGeometry args={[0.16, 2.1, 6, 12]} />
        <meshBasicMaterial color={0xffffff} transparent opacity={0.32} blending={THREE.AdditiveBlending} toneMapped={false} depthWrite={false} />
      </instancedMesh>
    </>
  );
}

/* --------------------------------------------------------------------------
 * MuzzleFlashField — small fixed pool of flash sprites driven imperatively.
 * Flashes live ~85ms, far shorter than a React sync interval, so they must
 * render from the sim state directly.
 * ------------------------------------------------------------------------ */

const MUZZLE_FLASH_POOL = 8;

function MuzzleFlashField({ gameState }: { gameState: GameState }) {
  const slotsRef = useRef<Array<THREE.Group | null>>([]);

  useFrame(() => {
    const flashes = (gameState.playerEntity.metadata?.muzzleFlashes as MuzzleFlash[] | undefined) ?? [];
    for (let i = 0; i < MUZZLE_FLASH_POOL; i++) {
      const slot = slotsRef.current[i];
      if (!slot) continue;
      const flash = flashes[i];
      if (!flash || flash.endTime <= gameState.simTime) {
        slot.visible = false;
        continue;
      }
      slot.visible = true;
      slot.position.set(flash.position.x, flash.position.y, flash.position.z);
      const life = Math.max(0, (flash.endTime - gameState.simTime) / 0.085);
      const coreMat = (slot.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial;
      const outerMat = (slot.children[1] as THREE.Mesh).material as THREE.MeshBasicMaterial;
      coreMat.opacity = 0.9 * life;
      outerMat.opacity = 0.45 * life;
    }
  });

  return (
    <>
      {Array.from({ length: MUZZLE_FLASH_POOL }).map((_, i) => (
        <group
          key={`muzzle-flash-${i}`}
          visible={false}
          ref={(el) => {
            slotsRef.current[i] = el;
          }}
        >
          <mesh>
            <sphereGeometry args={[0.22, 10, 10]} />
            <meshBasicMaterial color={0xd8f5ff} transparent opacity={0} blending={THREE.AdditiveBlending} toneMapped={false} depthWrite={false} />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.48, 10, 10]} />
            <meshBasicMaterial color={0x4fc8ff} transparent opacity={0} blending={THREE.AdditiveBlending} toneMapped={false} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </>
  );
}

function MissionStartScene({ worldIndex }: { worldIndex: number }) {
  const layout = useMemo(() => getMissionLayout(worldIndex), [worldIndex]);
  const stationRigRef = useRef<THREE.Group>(null);
  const dockingRingRef = useRef<THREE.Group>(null);
  const beaconCoreRef = useRef<THREE.Mesh>(null);
  const navLightRefs = useRef<Array<THREE.Mesh | null>>([]);

  // Star Wars-inspired outpost palette — warm industrial tones
  const hull = 0x6e665c;
  const deck = 0x504b43;
  const trim = 0x8a7e6e;
  const glow = 0xff9e3d;     // warm amber
  const glowHot = 0xff6622;  // exhaust orange
  const window = 0xffcc66;   // lit windows

  useFrame((state, delta) => {
    if (stationRigRef.current) {
      stationRigRef.current.rotation.y += delta * 0.016;
    }

    if (dockingRingRef.current) {
      dockingRingRef.current.rotation.z -= delta * 0.095;
    }

    if (beaconCoreRef.current) {
      const beaconMat = beaconCoreRef.current.material as THREE.MeshBasicMaterial;
      beaconMat.opacity = 0.5 + (Math.sin(state.clock.elapsedTime * 3.3) * 0.5 + 0.5) * 0.45;
      const s = 0.92 + (Math.sin(state.clock.elapsedTime * 3.3 + 0.4) * 0.5 + 0.5) * 0.24;
      beaconCoreRef.current.scale.setScalar(s);
    }

    navLightRefs.current.forEach((light, idx) => {
      if (!light) return;
      const mat = light.material as THREE.MeshBasicMaterial;
      const phase = idx * 0.65;
      mat.opacity = 0.32 + (Math.sin(state.clock.elapsedTime * 2.1 + phase) * 0.5 + 0.5) * 0.38;
    });
  });

  return (
    <group>
      {/* Defended planet — procedural Earth (continents, clouds, day/night,
          atmosphere rim) instead of a flat blue sphere. */}
      <group position={[layout.planetPosition.x, layout.planetPosition.y, layout.planetPosition.z]}>
        <MissionPlanet
          radius={layout.planetRadius}
          oceanColor={layout.planetColor}
          atmoColor={layout.atmosphereColor}
        />
      </group>

      {/* Orbital station — Star Wars outpost style */}
      <group
        position={[layout.stationPosition.x, layout.stationPosition.y, layout.stationPosition.z]}
        scale={[layout.stationScale, layout.stationScale, layout.stationScale]}
      >
        {/* Detailed Blender station replaces the procedural block below. The
            old rig is kept mounted but hidden (visible=false) so its animation
            refs stay valid and the swap is fully revertible. */}
        <StationModel scale={3.4} />
        <group ref={stationRigRef} rotation={[0, Math.PI * 0.12, 0]} visible={false}>
          {/* === MAIN HULL — wide horizontal block === */}
          <mesh>
            <boxGeometry args={[28, 10, 42]} />
            <meshStandardMaterial color={hull} roughness={0.55} metalness={0.58} />
          </mesh>

          {/* Hull surface greeble strips (top + bottom detail layers) */}
          {[-1, 1].map((side) => (
            <group key={`greeble-${side}`}>
              {Array.from({ length: 6 }).map((_, i) => (
                <mesh
                  key={`g-${i}`}
                  position={[
                    (i % 3 === 0 ? 14 : i % 3 === 1 ? -14 : 0) * side,
                    side * 5.2,
                    -14 + i * 5.6,
                  ]}
                >
                  <boxGeometry args={[3.2, 0.8, 2.4]} />
                  <meshStandardMaterial color={deck} roughness={0.6} metalness={0.5} />
                </mesh>
              ))}
            </group>
          ))}

          {/* === COMMAND TOWER — tall tapered spire on top === */}
          <group position={[0, 12, -8]}>
            <mesh>
              <boxGeometry args={[8, 14, 8]} />
              <meshStandardMaterial color={trim} roughness={0.45} metalness={0.68} />
            </mesh>
            {/* Tower windows */}
            {Array.from({ length: 4 }).map((_, i) => (
              <mesh key={`twin-${i}`} position={[0, -3 + i * 3.2, 4.1]}>
                <boxGeometry args={[4, 1.2, 0.3]} />
                <meshBasicMaterial color={window} transparent opacity={0.65} toneMapped={false} />
              </mesh>
            ))}
            {/* Antenna array on tower top */}
            <mesh position={[0, 8, 0]}>
              <cylinderGeometry args={[0.3, 0.3, 8, 8]} />
              <meshStandardMaterial color={trim} roughness={0.35} metalness={0.72} />
            </mesh>
            <mesh position={[2, 7, 0]} rotation={[0, 0, Math.PI * 0.15]}>
              <cylinderGeometry args={[0.15, 0.15, 5, 6]} />
              <meshStandardMaterial color={trim} roughness={0.35} metalness={0.72} />
            </mesh>
            <mesh position={[-2, 7, 0]} rotation={[0, 0, -Math.PI * 0.15]}>
              <cylinderGeometry args={[0.15, 0.15, 5, 6]} />
              <meshStandardMaterial color={trim} roughness={0.35} metalness={0.72} />
            </mesh>
            {/* Tower beacon */}
            <mesh ref={beaconCoreRef} position={[0, 12.5, 0]}>
              <sphereGeometry args={[0.8, 8, 8]} />
              <meshBasicMaterial color={glow} transparent opacity={0.85} blending={THREE.AdditiveBlending} toneMapped={false} depthWrite={false} />
            </mesh>
            <pointLight position={[0, 12.5, 0]} intensity={2.2} distance={120} color={glow} />
          </group>

          {/* === DOCKING RING — rotating berths around station core === */}
          <group ref={dockingRingRef} position={[0, -1.5, 2]} rotation={[Math.PI / 2, 0, 0]}>
            <mesh>
              <torusGeometry args={[21.5, 1.25, 22, 120]} />
              <meshStandardMaterial color={deck} roughness={0.48} metalness={0.72} />
            </mesh>
            <mesh>
              <torusGeometry args={[21.5, 0.38, 16, 120]} />
              <meshBasicMaterial color={0x7ad2ff} transparent opacity={0.18} blending={THREE.AdditiveBlending} toneMapped={false} depthWrite={false} />
            </mesh>
            {Array.from({ length: 8 }).map((_, idx) => {
              const a = (idx / 8) * Math.PI * 2;
              return (
                <group key={`dock-berth-${idx}`} position={[Math.cos(a) * 21.5, Math.sin(a) * 21.5, 0]} rotation={[0, 0, a]}>
                  <mesh position={[0, 0, 0.8]}>
                    <boxGeometry args={[2.4, 1.5, 1.6]} />
                    <meshStandardMaterial color={trim} roughness={0.52} metalness={0.64} />
                  </mesh>
                  <mesh position={[0, 0, 1.9]}>
                    <boxGeometry args={[1.1, 0.45, 0.45]} />
                    <meshBasicMaterial color={0x90dfff} transparent opacity={0.5} blending={THREE.AdditiveBlending} toneMapped={false} depthWrite={false} />
                  </mesh>
                </group>
              );
            })}
          </group>

          {/* === HANGAR BAYS — large rectangular openings on each side === */}
          {[-1, 1].map((side) => (
            <group key={`hangar-${side}`} position={[side * 16, -1, 4]}>
              {/* Bay frame */}
              <mesh>
                <boxGeometry args={[5, 7, 10]} />
                <meshStandardMaterial color={deck} roughness={0.52} metalness={0.55} />
              </mesh>
              {/* Bay interior glow */}
              <mesh position={[side * 0.8, 0, 0]}>
                <boxGeometry args={[0.2, 5, 7]} />
                <meshBasicMaterial color={glow} transparent opacity={0.35} blending={THREE.AdditiveBlending} toneMapped={false} depthWrite={false} />
              </mesh>
              {/* Bay doors (partially open) */}
              <mesh position={[side * 0.6, 3.8, 0]} rotation={[0, 0, side * 0.4]}>
                <boxGeometry args={[4, 0.4, 9]} />
                <meshStandardMaterial color={hull} roughness={0.6} metalness={0.6} />
              </mesh>
              <mesh position={[side * 0.6, -3.8, 0]} rotation={[0, 0, -side * 0.4]}>
                <boxGeometry args={[4, 0.4, 9]} />
                <meshStandardMaterial color={hull} roughness={0.6} metalness={0.6} />
              </mesh>
              {/* Red warning light above hangar */}
              <mesh position={[0, 4.2, 3.5]}>
                <sphereGeometry args={[0.35, 8, 8]} />
                <meshBasicMaterial color={0xff3333} transparent opacity={0.7} blending={THREE.AdditiveBlending} toneMapped={false} depthWrite={false} />
              </mesh>
            </group>
          ))}

          {/* === SENSOR DISH — classic round radar === */}
          <group position={[-18, 6, -6]} rotation={[0.3, 0.4, 0.2]}>
            <mesh>
              <cylinderGeometry args={[4, 0.8, 1.2, 20]} />
              <meshStandardMaterial color={trim} roughness={0.4} metalness={0.7} />
            </mesh>
            <mesh position={[0, 0.6, 0]}>
              <cylinderGeometry args={[0.4, 0.4, 2.5, 8]} />
              <meshStandardMaterial color={deck} roughness={0.5} metalness={0.6} />
            </mesh>
            <mesh position={[0, 2, 0]}>
              <sphereGeometry args={[0.3, 8, 8]} />
              <meshBasicMaterial color={glow} transparent opacity={0.5} blending={THREE.AdditiveBlending} toneMapped={false} depthWrite={false} />
            </mesh>
          </group>

          {/* === TRUSS ARMS — structural spars extending from main hull === */}
          {[
            [0, 0, 26, 0, 0, 0, 20],
            [0, 0, -26, 0, 0, 0, 20],
            [22, 0, 0, 0, Math.PI / 2, 0, 14],
            [-22, 0, 0, 0, Math.PI / 2, 0, 14],
          ].map(([x, y, z, rx, ry, rz, len], idx) => (
            <group key={`truss-${idx}`} position={[x, y, z]} rotation={[rx, ry, rz]}>
              {/* Main truss beam */}
              <mesh>
                <boxGeometry args={[1.6, 1.6, len]} />
                <meshStandardMaterial color={deck} roughness={0.58} metalness={0.62} />
              </mesh>
              {/* Cross-braces */}
              {Array.from({ length: 3 }).map((_, i) => (
                <mesh key={`brace-${i}`} position={[0, 0, -len / 3 + i * (len / 3)]}>
                  <boxGeometry args={[2.8, 0.25, 0.25]} />
                  <meshStandardMaterial color={trim} roughness={0.5} metalness={0.65} />
                </mesh>
              ))}
              {/* End cap */}
              <mesh position={[0, 0, len / 2]}>
                <cylinderGeometry args={[2.2, 2.2, 2.5, 12]} />
                <meshStandardMaterial color={hull} roughness={0.5} metalness={0.6} />
              </mesh>
            </group>
          ))}

          {/* === ENGINE BELLS — large nozzles at the rear === */}
          <group position={[0, -2, -24]}>
            {[-1, 1].map((side) => (
              <group key={`engine-${side}`} position={[side * 5, 0, 0]}>
                <mesh>
                  <cylinderGeometry args={[2.8, 3.8, 7, 14]} />
                  <meshStandardMaterial color={deck} roughness={0.45} metalness={0.75} />
                </mesh>
                {/* Engine interior glow */}
                <mesh position={[0, 0, -3.6]}>
                  <circleGeometry args={[2.6, 14]} />
                  <meshBasicMaterial color={glowHot} transparent opacity={0.55} blending={THREE.AdditiveBlending} toneMapped={false} side={THREE.DoubleSide} depthWrite={false} />
                </mesh>
                <pointLight position={[0, 0, -4]} intensity={1.8} distance={80} color={glowHot} />
              </group>
            ))}
          </group>

          {/* === DEFENSE TURRETS — small gun emplacements === */}
          {[
            [10, 6, 14],
            [-10, 6, 14],
            [10, 6, -14],
            [-10, 6, -14],
          ].map(([x, y, z], i) => (
            <group key={`turret-${i}`} position={[x, y, z]}>
              <mesh>
                <cylinderGeometry args={[0.7, 0.9, 1.8, 8]} />
                <meshStandardMaterial color={trim} roughness={0.48} metalness={0.7} />
              </mesh>
              <mesh position={[0, 1.1, 0]}>
                <boxGeometry args={[0.4, 0.5, 1.2]} />
                <meshStandardMaterial color={deck} roughness={0.5} metalness={0.65} />
              </mesh>
            </group>
          ))}

          {/* === RUNNING LIGHTS === */}
          {Array.from({ length: 10 }).map((_, idx) => {
            const angle = (idx / 10) * Math.PI * 2;
            const isRed = idx < 5;
            return (
              <mesh
                key={`nav-${idx}`}
                ref={(el) => {
                  navLightRefs.current[idx] = el;
                }}
                position={[Math.cos(angle) * 15, Math.sin(angle) * 2.5, Math.sin(angle) * 22]}
              >
                <sphereGeometry args={[0.35, 8, 8]} />
                <meshBasicMaterial
                  color={isRed ? 0xff3333 : 0x33ff55}
                  transparent
                  opacity={0.6}
                  blending={THREE.AdditiveBlending}
                  toneMapped={false}
                  depthWrite={false}
                />
              </mesh>
            );
          })}

          {/* === COMMUNICATIONS ARRAY — tall vertical spire with dishes === */}
          <group position={[12, 8, -10]}>
            <mesh>
              <cylinderGeometry args={[0.5, 0.7, 18, 8]} />
              <meshStandardMaterial color={trim} roughness={0.4} metalness={0.7} />
            </mesh>
            <mesh position={[0, 8, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <sphereGeometry args={[3, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.35]} />
              <meshStandardMaterial color={trim} roughness={0.4} metalness={0.7} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0, 10, 0]}>
              <sphereGeometry args={[0.6, 8, 8]} />
              <meshBasicMaterial color={glow} transparent opacity={0.6} blending={THREE.AdditiveBlending} toneMapped={false} depthWrite={false} />
            </mesh>
          </group>

          {/* Station ambient glow */}
          <pointLight position={[0, 8, 0]} intensity={1.5} distance={200} color={glow} />
          <pointLight position={[0, -4, -20]} intensity={1.2} distance={120} color={glowHot} />
        </group>
      </group>
    </group>
  );
}

/**
 * Camera follow controller: smooth chase cam like following a comet in Universe Engine.
 * Uses exponential smoothing for silk-smooth, responsive flight feel.
 */
// Station + world geometry is static per mission; skip it on HUD syncs.
const MemoMissionStartScene = memo(MissionStartScene);

/* --------------------------------------------------------------------------
 * SectorBackdrop — the Deep Run world. Instead of the fixed Earth+station, each
 * sector shows its REAL body (Belt rubble → banded Jupiter → ringed Saturn →
 * Kuiper ice → distant Pluto), sized + tinted from run-state SECTORS, with the
 * ambient light dimming/reddening as you travel outward. This makes a run look
 * like an actual journey through the Solar System.
 * ----------------------------------------------------------------------------*/
function SectorBackdrop({ sectorIndex }: { sectorIndex: number }) {
  const bd = useMemo(() => sectorBackdrop(sectorIndex), [sectorIndex]);
  const layout = useMemo(() => getMissionLayout(0), []);
  const pos = layout.planetPosition;
  const ringsRef = useRef<THREE.Mesh>(null);
  useFrame((_s, delta) => {
    if (ringsRef.current) ringsRef.current.rotation.z += delta * 0.02;
  });
  return (
    <group>
      {/* Sector body */}
      <group position={[pos.x, pos.y, pos.z]}>
        <MissionPlanet radius={bd.bodyRadius} oceanColor={bd.bodyColor} landColor={bd.landColor} atmoColor={bd.atmoColor} />
        {/* Saturn-style rings */}
        {bd.rings && (
          <mesh ref={ringsRef} rotation={[Math.PI / 2.3, 0, 0]}>
            <ringGeometry args={[bd.bodyRadius * 1.35, bd.bodyRadius * 2.25, 96]} />
            <meshStandardMaterial
              color={0xe8dcb8}
              roughness={0.8}
              metalness={0.1}
              transparent
              opacity={0.7}
              side={THREE.DoubleSide}
            />
          </mesh>
        )}
      </group>
      {/* Ambient light tinted + dimmed by distance from the Sun. */}
      <hemisphereLight args={[bd.lightTint, 0x080a14, bd.lightIntensity]} />
      <directionalLight position={[pos.x + 200, pos.y + 120, pos.z + 80]} intensity={bd.lightIntensity * 1.1} color={bd.lightTint} />
    </group>
  );
}
const MemoSectorBackdrop = memo(SectorBackdrop);

// Scratch objects for the camera follow math (per-frame, never retained).
const _camPlayerPos = new THREE.Vector3();
const _camEuler = new THREE.Euler();
const _camQuat = new THREE.Quaternion();

// User-controllable view: right-drag orbits the chase cam around the ship,
// scroll zooms. Module-scoped so input handlers + the camera controller share
// it without prop drilling. Decays back to centred when the user lets go.
const cameraOrbitRef = {
  current: {
    yaw: 0,        // radians, left/right around the ship
    pitch: 0,      // radians, up/down
    zoom: 1,       // multiplier on chase distance (1 = default)
    active: false, // true while right-dragging (suppresses auto-recenter)
  },
};
const _camForward = new THREE.Vector3();
const _camRight = new THREE.Vector3();
const _camWorldUp = new THREE.Vector3(0, 1, 0);
const _camShipUp = new THREE.Vector3();   // ship's own up (for the roll-follow blend)
const _camUpBlend = new THREE.Vector3();  // resulting blended camera up
const _camDesired = new THREE.Vector3();
const _camCatchUp = new THREE.Vector3();
const _camLook = new THREE.Vector3();
const _camVelDir = new THREE.Vector3();
const _camTmp = new THREE.Vector3();
const _camTmp2 = new THREE.Vector3();
const _camUpVec = new THREE.Vector3();

const STATION_MODEL_PATH = '/models/station.glb';

/** Detailed Blender orbital station (hub, docking ring, solar arrays, masts).
 *  Replaces the old procedural block. Self-rotates slowly; clones + lightly
 *  styles materials so emissive windows/panels stay lit in the game's rig. */
function StationModel({ scale = 9 }: { scale?: number }) {
  const gltf = useGLTF(STATION_MODEL_PATH);
  const ringRef = useRef<THREE.Group>(null);
  const styled = useMemo(() => {
    const c = gltf.scene.clone(true);
    c.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.frustumCulled = false;
      }
    });
    return c;
  }, [gltf.scene]);
  useFrame((_, delta) => {
    if (ringRef.current) ringRef.current.rotation.y += delta * 0.04;
  });
  return (
    <group ref={ringRef} scale={scale}>
      <primitive object={styled} />
    </group>
  );
}
useGLTF.preload(STATION_MODEL_PATH);

/** A pair of lights that follow the player ship so it always reads as the
 *  brightest, clearest object on screen. A warm key from above-front and a
 *  cool rim from behind for separation against the void. */
function ShipKeyLight({ gameState }: { gameState: GameState }) {
  const keyRef = useRef<THREE.PointLight>(null);
  const rimRef = useRef<THREE.PointLight>(null);
  useFrame(() => {
    const p = gameState.playerEntity.position;
    if (keyRef.current) keyRef.current.position.set(p.x + 6, p.y + 10, p.z + 8);
    if (rimRef.current) rimRef.current.position.set(p.x - 5, p.y + 2, p.z - 9);
  });
  return (
    <>
      <pointLight ref={keyRef} intensity={140} distance={70} decay={2} color={0xfff0d8} />
      <pointLight ref={rimRef} intensity={90} distance={60} decay={2} color={0x88b4ff} />
    </>
  );
}

function CameraFollowController({
  gameState,
  cameraAssist,
  stationExploreMode,
}: {
  gameState: GameState;
  cameraAssist: CameraAssistLevel;
  stationExploreMode: boolean;
}) {
  const { camera } = useThree();
  const smoothPosRef = useRef(camera.position.clone());
  const smoothLookRef = useRef(new THREE.Vector3());
  const smoothForwardRef = useRef(new THREE.Vector3(0, 0, -1));
  const lookAheadRef = useRef(new THREE.Vector3(0, 0, -1));
  const camRollRef = useRef(0); // smoothed camera bank (rad) for lean-into-turns
  const prevPlayerPosRef = useRef<THREE.Vector3 | null>(null); // for velocity feed-forward
  // Tracks whether the camera has been snapped to the ship for the current
  // flight session. Reset whenever we leave flight (menus, briefing, station)
  // so the next launch snaps cleanly instead of crawling from the old vantage.
  const flightSnappedRef = useRef(false);
  const layout = useMemo(() => getMissionLayout(gameState.worldIndex), [gameState.worldIndex]);

  // Dynamic offset based on phase: flight cam behind ship during ignition/exploration, wide during briefing
  const isFlightPhase = isRuntimeFlightPhase(gameState.phase);
  const canExploreStation = canInspectStation(gameState);
  const stationInspectActive = canExploreStation && stationExploreMode;
  const phaseProfile = isFlightPhase ? CAMERA_PHASE_TUNING.flight : CAMERA_PHASE_TUNING.briefing;

  useFrame((state, delta) => {
    // Any non-flight camera mode invalidates the flight snap; the next time we
    // enter flight the camera will jump straight onto the ship.
    if (!isFlightPhase || stationInspectActive) {
      flightSnappedRef.current = false;
      prevPlayerPosRef.current = null;
    }

    if (stationInspectActive) {
      const center = layout.stationPosition;
      const t = state.clock.elapsedTime;
      const orbitRadius = CAMERA_PHASE_TUNING.stationInspect.orbitRadius * layout.stationScale;
      const desiredPos = _camDesired.set(
        center.x + Math.cos(t * 0.22) * orbitRadius,
        center.y + CAMERA_PHASE_TUNING.stationInspect.orbitHeight + Math.sin(t * 0.37) * CAMERA_PHASE_TUNING.stationInspect.orbitHeightWave,
        center.z + Math.sin(t * 0.22) * orbitRadius,
      );
      const k = 1 - Math.exp(-delta * CAMERA_PHASE_TUNING.stationInspect.followRate);
      smoothPosRef.current.lerp(desiredPos, k);
      camera.position.copy(smoothPosRef.current);

      const lookTarget = _camLook.set(center.x, center.y + 6, center.z);
      const lookK = 1 - Math.exp(-delta * CAMERA_PHASE_TUNING.stationInspect.lookRate);
      smoothLookRef.current.lerp(lookTarget, lookK);
      // ensure no leftover bank from flight mode tilts the orbit cam
      camera.up.set(0, 1, 0);
      camRollRef.current = 0;
      camera.lookAt(smoothLookRef.current);

      const perspective = camera as THREE.PerspectiveCamera;
      const targetFov = CAMERA_PHASE_TUNING.stationInspect.fov;
      const fovK = 1 - Math.exp(-delta * 3.5);
      const nextFov = perspective.fov + (targetFov - perspective.fov) * fovK;
      if (Math.abs(nextFov - perspective.fov) > 0.02) {
        perspective.fov = nextFov;
        perspective.updateProjectionMatrix();
      }
      return;
    }

    const playerPos = _camPlayerPos.set(
      gameState.playerEntity.position.x,
      gameState.playerEntity.position.y,
      gameState.playerEntity.position.z
    );
    _camEuler.set(
      gameState.playerEntity.rotation.x,
      gameState.playerEntity.rotation.y,
      gameState.playerEntity.rotation.z
    );
    _camQuat.setFromEuler(_camEuler);
    const forwardDir = _camForward.set(0, 0, -1).applyQuaternion(_camQuat).normalize();
    // Chase-cam up: blend world-up with the SHIP's own up so the camera partially
    // rolls with a bank/loop (reads as real 6-DOF flight) but never goes fully
    // upside-down (which is disorienting). ~45% follow keeps it legible.
    const shipUp = _camShipUp.set(0, 1, 0).applyQuaternion(_camQuat);
    const worldUp = _camUpBlend.copy(shipUp).multiplyScalar(0.45).addScaledVector(_camWorldUp, 0.55).normalize();
    const rightDir = _camRight.crossVectors(forwardDir, worldUp).normalize();
    const speed = Math.sqrt(
      gameState.playerEntity.velocity.x ** 2 +
      gameState.playerEntity.velocity.y ** 2 +
      gameState.playerEntity.velocity.z ** 2
    );
    const boostSpool = Number(gameState.playerEntity.metadata?.boostSpool ?? 0);
    const accelKick = Number(gameState.playerEntity.metadata?.accelKick ?? 0);
    const speedJerk = Number(gameState.playerEntity.metadata?.speedJerk ?? 0);
    // Flight-mode signals (read once for both the shake + FOV below).
    const jetMix = Number(gameState.playerEntity.metadata?.jetMix ?? 0);
    const supersonic = Boolean(gameState.playerEntity.metadata?.supersonic);
    const travelStretch = Math.min(speed / 50, 1.1);
    const ignitionCinematic = gameState.phase === 'ignition' ? 1 : 0;

    // Smooth the forward vector to avoid micro-twitches from rapid Euler updates.
    const forwardK = 1 - Math.exp(-delta * 8.2);
    smoothForwardRef.current.lerp(forwardDir, forwardK).normalize();

    // User view control: orbit yaw/pitch + zoom. Decays back to centred when
    // the user isn't right-dragging, so the cam always settles behind the ship.
    const orbit = cameraOrbitRef.current;
    if (!orbit.active) {
      const decay = 1 - Math.exp(-delta * 2.4);
      orbit.yaw += (0 - orbit.yaw) * decay;
      orbit.pitch += (0 - orbit.pitch) * decay;
    }

    const offsetDistance =
      (phaseProfile.offsetDistance +
        ignitionCinematic * 1.5 +
        travelStretch * 2.8 +
        boostSpool * 2.4 +
        accelKick * 1.1 +
        speedJerk * 2.2) * orbit.zoom;
    const offsetHeight = phaseProfile.offsetHeight + ignitionCinematic * 0.42 + travelStretch * 0.35;

    // Keep camera behind ship orientation so nose direction is always readable.
    const cloudShake = speedJerk * 0.08;
    const turbulenceSide = Math.sin(state.clock.elapsedTime * 3.4) * cloudShake;
    const turbulenceUp = Math.sin(state.clock.elapsedTime * 5.1 + 1.7) * cloudShake * 0.6;
    // Base "behind + above" offset from the ship.
    const behind = _camDesired
      .copy(smoothForwardRef.current)
      .multiplyScalar(-offsetDistance)
      .addScaledVector(rightDir, phaseProfile.sideOffset + turbulenceSide)
      .addScaledVector(worldUp, offsetHeight + turbulenceUp);
    // Apply the user's orbit: yaw around world-up, pitch around the camera's
    // right axis. Lets the player look around the ship NFS-style.
    if (orbit.yaw !== 0) behind.applyAxisAngle(worldUp, orbit.yaw);
    if (orbit.pitch !== 0) behind.applyAxisAngle(rightDir, orbit.pitch);
    const desiredCameraPos = behind.add(playerPos);

    // Ultra-smooth exponential follow: k = 1 - exp(-delta * rate)
    // Tighter and snappier during flight phases for a more responsive feel
    const assistConfig = CAMERA_ASSIST_TUNING[cameraAssist];

    const followRate = isFlightPhase ? assistConfig.follow : phaseProfile.nonAssistFollowRate;
    const k = 1 - Math.exp(-delta * followRate);

    // First flight frame after a menu/briefing: snap straight onto the ship so
    // the camera never crawls across the system from its old parked vantage.
    if (!flightSnappedRef.current) {
      smoothPosRef.current.copy(desiredCameraPos);
      smoothLookRef.current.copy(playerPos);
      camera.position.copy(desiredCameraPos);
      prevPlayerPosRef.current = playerPos.clone();
      flightSnappedRef.current = true;
    }

    // VELOCITY FEED-FORWARD: advance the camera by the ship's actual displacement
    // this frame BEFORE smoothing. Without this, a pure lerp leaves a steady-state
    // lag proportional to speed — at interstellar velocity the ship outruns the
    // camera and flies off-screen (the bug). Feeding the displacement forward
    // means the lerp only has to correct for OFFSET changes (turns, accel), so
    // the ship stays pinned in frame at any speed while turns still ease in.
    if (prevPlayerPosRef.current) {
      const shipDelta = _camCatchUp.copy(playerPos).sub(prevPlayerPosRef.current);
      smoothPosRef.current.add(shipDelta);
    }
    prevPlayerPosRef.current = prevPlayerPosRef.current
      ? prevPlayerPosRef.current.copy(playerPos)
      : playerPos.clone();

    smoothPosRef.current.lerp(desiredCameraPos, k);
    camera.position.copy(smoothPosRef.current);

    // Boost + supersonic camera shake: high-frequency micro-jitter. Jet mode adds
    // a steady airframe buffet, and crossing the sonic line kicks a brief, sharper
    // shudder — the cinematic "the whole cockpit rattles at Mach" beat.
    const boostActive = Boolean(gameState.playerEntity.metadata?.boostActive);
    const jetBuffet = jetMix * 0.045 + (supersonic ? 0.05 : 0);
    // Decaying boom shudder from the last sonic-boom timestamp.
    const boomAt = Number(gameState.playerEntity.metadata?.sonicBoomAt ?? -999);
    const boomAge = gameState.simTime - boomAt;
    const boomShake = boomAge >= 0 && boomAge < 0.6 ? (1 - boomAge / 0.6) * 0.16 : 0;
    if (boostActive || boostSpool > 0.05 || jetBuffet > 0.001 || boomShake > 0) {
      const shakeIntensity = boostSpool * 0.08 + (boostActive ? 0.03 : 0) + jetBuffet + boomShake;
      const t = state.clock.elapsedTime;
      camera.position.x += Math.sin(t * 47) * shakeIntensity * 0.5;
      camera.position.y += Math.sin(t * 61 + 1.3) * shakeIntensity * 0.5;
      camera.position.z += Math.sin(t * 53 + 2.7) * shakeIntensity * 0.35;
    }

    // Combat HIT shake — a short sharp jolt when the player is taking fire, so
    // damage is felt, not just a number ticking down. Driven by the decaying
    // `incomingFire` signal set in the sim when an enemy bolt connects. Kept
    // modest (no nausea) and additive on top of position so it never fights the
    // follow. (Backlog 1.3)
    const incomingFire = Number(gameState.playerEntity.metadata?.incomingFire ?? 0);
    if (incomingFire > 0.01) {
      const t = state.clock.elapsedTime;
      const jolt = incomingFire * incomingFire * 0.22; // ease-in so small hits barely shake
      camera.position.x += Math.sin(t * 91) * jolt;
      camera.position.y += Math.sin(t * 113 + 2.1) * jolt;
    }

    // Kill punch — a softer, higher-frequency snap when you destroy a hostile,
    // so kills feel rewarding (distinct from the rattling hit-shake). (1.4)
    const killPunch = Number(gameState.playerEntity.metadata?.killPunch ?? 0);
    if (killPunch > 0.01) {
      const t = state.clock.elapsedTime;
      const p = killPunch * 0.1;
      camera.position.x += Math.sin(t * 140) * p;
      camera.position.y += Math.cos(t * 155) * p;
    }

    // Look ahead down the NOSE, not the drift velocity. In manual mode velocity
    // lags the heading (inertial drift), so aiming the camera at the velocity
    // made turns feel disconnected — you'd look where you were sliding, not
    // where you were pointing. Anticipating the nose keeps turns tight and
    // readable (arcade feel). We still bias slightly toward velocity at very
    // high speed so fast straight-line travel reads forward.
    // Keep the look-ahead modest relative to the follow distance so the ship
    // stays framed in the lower-centre (a big look-ahead aims past the ship and
    // pushes it off the bottom of the screen).
    const lookAheadDistance = Math.min(speed * 0.05, 6) + boostSpool * 0.8;

    const lookTarget = _camLook.copy(playerPos).add(_camTmp.set(0, 0.7, 0));
    // Blend the smoothed nose forward with a touch of velocity direction.
    const velLen = speed;
    const aimDir = _camVelDir.copy(smoothForwardRef.current);
    if (velLen > 0.1) {
      const velocityDir = _camTmp2.set(
        gameState.playerEntity.velocity.x,
        gameState.playerEntity.velocity.y,
        gameState.playerEntity.velocity.z
      ).multiplyScalar(1 / velLen);
      // mostly nose (0.8), a little velocity (0.2) so high-speed cruise reads fwd
      aimDir.multiplyScalar(0.8).addScaledVector(velocityDir, 0.2).normalize();
    }
    const lookVelK = 1 - Math.exp(-delta * 9.0);
    lookAheadRef.current.lerp(aimDir, lookVelK).normalize();
    lookTarget.addScaledVector(lookAheadRef.current, Math.max(2.2, lookAheadDistance));

    const lookK = 1 - Math.exp(-delta * assistConfig.look);
    smoothLookRef.current.lerp(lookTarget, lookK);

    // Bank the CAMERA into turns so hard steering feels dynamic instead of flat.
    // Roll the camera's up-vector toward the turn (opposite the yaw input), eased
    // so it's smooth. This rides on top of the ship's own visual bank, selling
    // the arcade "lean into the corner" feel.
    const turnSignal = Number(gameState.playerEntity.metadata?.rcsYaw ?? 0);
    const targetRoll = THREE.MathUtils.clamp(turnSignal, -1, 1) * 0.32; // ~18° max
    const rollK = 1 - Math.exp(-delta * 5.0);
    camRollRef.current += (targetRoll - camRollRef.current) * rollK;
    // build a banked up-vector: world-up rolled about the camera forward axis
    const camFwd = _camTmp.copy(smoothLookRef.current).sub(camera.position).normalize();
    _camUpVec.copy(worldUp).applyAxisAngle(camFwd, camRollRef.current);
    camera.up.copy(_camUpVec);
    camera.lookAt(smoothLookRef.current);

    // Dynamic FOV gives a clear sensation of acceleration and boost. Tie a chunk
    // of it to ACCELERATION (accelKick) + throttle spool, not just raw speed —
    // raw speed pins the FOV instantly at interstellar velocities, so you lose
    // the surge-on-throttle sensation. accelKick fades as you reach top speed,
    // giving a satisfying push when you hit the gas and a settle when you cruise.
    // Jet mode adds a cinematic FOV punch — the walls of the world pull wider so
    // supersonic actually FEELS supersonic, with an extra kick past the sonic line.
    const targetFov =
      phaseProfile.baseFov +
      Math.min(speed / 9.0, 6) +
      accelKick * 7.0 +
      boostSpool * 6.5 +
      (boostActive ? 1.5 : 0) +
      speedJerk * 2.4 +
      jetMix * 7.0 +
      (supersonic ? 4.5 : 0);
    const currentFov = (camera as THREE.PerspectiveCamera).fov ?? 55;
    const fovK = 1 - Math.exp(-delta * assistConfig.fov);
    const nextFov = currentFov + (targetFov - currentFov) * fovK;
    if (Math.abs(nextFov - currentFov) > 0.02) {
      (camera as THREE.PerspectiveCamera).fov = nextFov;
      (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
    }
  });

  return null;
}

function CanvasReadySignal({ onReady }: { onReady?: () => void }) {
  useThree();

  useEffect(() => {
    onReady?.();
  }, [onReady]);

  return null;
}

function GameScene({
  gameState,
  onUiSync,
  onVolley,
  keysPressed,
  mouseRotation,
  deviceOrientation,
  assistedFlight,
  updateEngineAudio,
  joystickRef,
  metaRef,
  onRunEnd,
  onKill,
}: {
  gameState: GameState;
  onUiSync: () => void;
  onVolley?: (pair: number) => void;
  keysPressed: React.MutableRefObject<Set<string>>;
  mouseRotation: React.MutableRefObject<{ pitch: number; yaw: number }>;
  deviceOrientation: React.MutableRefObject<{ alpha: number; beta: number; gamma: number }>;
  assistedFlight: boolean;
  updateEngineAudio?: (speed: number, throttle: number, boost: boolean, boostSpool: number) => void;
  joystickRef?: React.MutableRefObject<{ active: boolean; originX: number; originY: number; dx: number; dy: number }>;
  /** persistent meta-progression (Deep Run). null in the other modes. */
  metaRef?: React.MutableRefObject<MetaState>;
  /** called when a run ends (death or extract) to show Outfitting. */
  onRunEnd?: (summary: RunSummary) => void;
  /** fired once per enemy kill (any combat mode) for the explosion sound. */
  onKill?: () => void;
}) {
  const gameLoopRef = useRef<GameLoop | null>(null);
  const entityManagerRef = useRef<EntityManager | null>(null);
  const collisionSystemRef = useRef<CollisionSystem | null>(null);
  const enemyAgentsRef = useRef<Map<string, any>>(new Map());
  const uiSyncAccumRef = useRef(0);
  const lastSyncedPhaseRef = useRef(gameState.phase);
  const hazardsCacheRef = useRef<{ worldIndex: number; hazards: GravityHazard[] } | null>(null);
  const encounterTimerRef = useRef(ENCOUNTER_INTERVAL_S * 0.5); // first patrol comes a touch sooner
  const enemyIdCounterRef = useRef(0);
  const forwardSpeedRef = useRef(0);
  const throttleRef = useRef(0.34);
  const boostSpoolRef = useRef(0);
  const prevForwardSpeedRef = useRef(0);
  const prevForwardAccelRef = useRef(0);
  const fireCooldownRef = useRef(0);
  const cannonCycleRef = useRef(0);
  const smoothedInputRef = useRef({ pitch: 0, yaw: 0, roll: 0 });
  // Flight mode: 'cruise' (normal, controlled) vs 'jet' (supersonic — faster top
  // speed, wider FOV, harder bank, sonic character). Toggled with a key. jetMix
  // eases 0→1 so the transition between the two modes is smooth, not a snap.
  const flightModeRef = useRef<'cruise' | 'jet'>('cruise');
  const jetMixRef = useRef(0);
  // Edge-detect the F toggle inside the frame loop (keysPressed is the shared
  // input set; the keydown handler lives in a different component, so we flip the
  // mode on the rising edge here instead of plumbing a ref across components).
  const fKeyWasDownRef = useRef(false);
  // Auto-cruise: hold a comfortable forward speed hands-free so the fly-around is
  // about STEERING, not pinning W. Toggled with C (edge-detected in the loop).
  // When on, the ship maintains a cruise throttle unless the player overrides with
  // W (faster) or S (brake); tapping S to a near-stop cancels cruise so you can park.
  const autoCruiseRef = useRef(false);
  const cKeyWasDownRef = useRef(false);
  // Auto-bank: the roll the ship eases into as it yaws (banks into its turns like
  // a real fighter) — a big part of making turns feel natural instead of clunky.
  const autoBankRef = useRef(0);
  // 6-DOF orientation as a QUATERNION — the source of truth for the ship's facing.
  // Pitch/yaw/roll are applied as rotations about the ship's OWN local axes each
  // frame (which is what makes free maneuvering work with no gimbal lock — you can
  // loop, bank, fly inverted, and change course in any direction). The entity's
  // Euler rotation is written FROM this each frame so the renderer + camera, which
  // read Euler, stay in sync. Seeded from the entity's initial Euler on first use.
  const orientRef = useRef<THREE.Quaternion | null>(null);
  // Tracks the heading-reset signal so R (reset heading) / external Euler sets
  // re-seed the orientation quaternion instead of being overwritten by it.
  const headingResetSeenRef = useRef(0);
  // Latches so a sonic-boom effect fires once each time we cross into supersonic.
  const wasSupersonicRef = useRef(false);
  // Deep Run loop: tracks whether the current sector's enemies have been
  // spawned yet (so we seed a sector exactly once on entry), and the last
  // event index we processed for salvage-on-kill.
  const sectorSpawnedRef = useRef(false);
  const lastEventLenRef = useRef(0);
  // General kill-confirm scan (all combat modes) — separate from the run-mode
  // salvage scan so the explosion sound + camera punch fire everywhere.
  const lastKillScanRef = useRef(0);

  // Seed a small hostile patrol ahead of the flight vector. Each ship is
  // registered with the entity manager so the existing projectile-collision
  // path (game-loop) scores kills automatically.
  const spawnEncounter = (forward: THREE.Vector3, right: THREE.Vector3, up: THREE.Vector3) => {
    const em = entityManagerRef.current;
    if (!em) return;

    const liveCount = gameState.enemies.filter((e) => e.active).length;
    if (liveCount >= ENCOUNTER_MAX_LIVE) return;

    const headroom = ENCOUNTER_MAX_LIVE - liveCount;
    const count = Math.min(headroom, 2 + Math.floor(Math.random() * 3)); // 2–4

    const base = _encounterSpawn
      .copy(forward)
      .multiplyScalar(ENCOUNTER_SPAWN_AHEAD)
      .add(gameState.playerEntity.position as THREE.Vector3);

    for (let i = 0; i < count; i++) {
      const lateral = _encounterLateral
        .copy(right)
        .multiplyScalar((Math.random() - 0.5) * ENCOUNTER_SPAWN_SPREAD * 2)
        .addScaledVector(up, (Math.random() - 0.5) * ENCOUNTER_SPAWN_SPREAD);

      // Mostly fighters; an occasional sniper to vary the threat.
      const type = Math.random() < 0.25 ? 'sniper' : 'fighter';
      const id = `enemy_${enemyIdCounterRef.current++}`;
      const { entity } = createEnemy(type, id, {
        x: base.x + lateral.x,
        y: base.y + lateral.y,
        z: base.z + lateral.z,
      });

      em.register(entity);
      gameState.enemies.push(entity);
    }
  };

  // Deep Run: seed an entire sector's hostiles at once, scaled by depth. Unlike
  // the cruise-patrol spawner, this fixes the count (so "clear the sector" is a
  // real objective) and scales enemy health/damage with sector depth.
  const spawnSector = (forward: THREE.Vector3, right: THREE.Vector3, up: THREE.Vector3, sectorIndex: number) => {
    const em = entityManagerRef.current;
    if (!em) return;
    const count = sectorEnemyCount(sectorIndex);
    const threat = sectorThreatScale(sectorIndex);
    // 1.5× (was 1.2×) puts the seed just OUTSIDE fire range (210 vs 170), so
    // hostiles readably approach before engaging instead of shooting on frame 1.
    const base = _encounterSpawn
      .copy(forward)
      .multiplyScalar(ENCOUNTER_SPAWN_AHEAD * 1.5)
      .add(gameState.playerEntity.position as THREE.Vector3);
    for (let i = 0; i < count; i++) {
      const lateral = _encounterLateral
        .copy(right)
        .multiplyScalar((Math.random() - 0.5) * ENCOUNTER_SPAWN_SPREAD * 3)
        .addScaledVector(up, (Math.random() - 0.5) * ENCOUNTER_SPAWN_SPREAD * 2);
      // Enemy mix scales with depth: snipers (precise, lead shots) thicken, and
      // fast low-HP swarm drones start appearing from sector 2+ for group
      // pressure — so deeper sectors feel distinct, not just numerically harder.
      const roll = Math.random();
      const sniperChance = Math.min(0.45, 0.16 + sectorIndex * 0.06);
      const swarmChance = sectorIndex >= 2 ? Math.min(0.4, (sectorIndex - 1) * 0.12) : 0;
      const type = roll < swarmChance ? 'swarm' : roll < swarmChance + sniperChance ? 'sniper' : 'fighter';
      const id = `enemy_${enemyIdCounterRef.current++}`;
      const { entity } = createEnemy(type, id, {
        x: base.x + lateral.x,
        y: base.y + lateral.y,
        z: base.z + lateral.z,
      });
      // scale durability + bite with depth
      entity.health = Math.round(entity.health * threat);
      entity.maxHealth = entity.health;
      if (entity.metadata) {
        entity.metadata.damage = Math.round((Number(entity.metadata.damage) || 10) * threat);
        // Stagger the pack's first shots so the end of the entry grace is a
        // trickle that escalates, not a simultaneous alpha strike.
        entity.metadata.fireCooldown = 0.6 + i * 0.8 + Math.random() * 0.4;
      }
      em.register(entity);
      gameState.enemies.push(entity);
    }
  };

  // Boss sector: one big multi-phase hostile instead of a swarm. Variant +
  // durability scale with depth so the climax keeps escalating. The existing
  // sector-clear logic (all enemies dead → jump gate) gates the run on the kill.
  const spawnBoss = (forward: THREE.Vector3, sectorIndex: number) => {
    const em = entityManagerRef.current;
    if (!em) return;
    const variants = ['warbird', 'decimator', 'apex', 'reaper', 'tyrant', 'sovereign', 'annihilator'];
    const variant = variants[Math.min(Math.floor(sectorIndex / 3), variants.length - 1)];
    const threat = sectorThreatScale(sectorIndex);
    const pos = _encounterSpawn
      .copy(forward)
      .multiplyScalar(ENCOUNTER_SPAWN_AHEAD * 1.4)
      .add(gameState.playerEntity.position as THREE.Vector3);
    const id = `boss_${enemyIdCounterRef.current++}`;
    const { entity } = createBoss(id, { x: pos.x, y: pos.y, z: pos.z }, variant);
    entity.health = Math.round(entity.health * threat);
    entity.maxHealth = entity.health;
    if (entity.metadata) {
      entity.metadata.damage = Math.round((Number(entity.metadata.damage) || 25) * threat);
    }
    em.register(entity);
    gameState.enemies.push(entity);
  };

  // Enemy fire: spawn a hostile bolt aimed at the player. Snipers lead the
  // target (aim where the ship WILL be) so they're a real threat; fighters fire
  // straight at the current position. Stored on gameState.projectiles with
  // team 'enemy' + isEnemyBolt so the sim loop can resolve hits on the player.
  const spawnEnemyBolt = (enemy: GameEntity, spread = 0) => {
    const em = entityManagerRef.current;
    if (!em) return;
    const md = enemy.metadata ?? {};
    const isSniper = md.class === 'sniper';
    const px = gameState.playerEntity.position.x;
    const py = gameState.playerEntity.position.y;
    const pz = gameState.playerEntity.position.z;
    // lead the target for snipers using the player's current velocity
    const lead = isSniper ? 0.9 : 0;
    const aimX = px + gameState.playerEntity.velocity.x * lead;
    const aimY = py + gameState.playerEntity.velocity.y * lead;
    const aimZ = pz + gameState.playerEntity.velocity.z * lead;
    let dx = aimX - enemy.position.x;
    let dy = aimY - enemy.position.y;
    let dz = aimZ - enemy.position.z;
    const d = Math.hypot(dx, dy, dz) || 1;
    dx /= d; dy /= d; dz /= d;
    // optional horizontal fan (boss spread volley): rotate the aim about world-up
    if (spread !== 0) {
      const cs = Math.cos(spread), sn = Math.sin(spread);
      const nx = dx * cs - dz * sn;
      const nz = dx * sn + dz * cs;
      dx = nx; dz = nz;
    }
    const dmg = Number(md.damage) || 10;
    const bolt: GameEntity = {
      id: `enemy_bolt_${enemyIdCounterRef.current++}`,
      position: { x: enemy.position.x + dx * 1.2, y: enemy.position.y + dy * 1.2, z: enemy.position.z + dz * 1.2 },
      velocity: { x: dx * ENEMY_BOLT_SPEED, y: dy * ENEMY_BOLT_SPEED, z: dz * ENEMY_BOLT_SPEED },
      rotation: { x: 0, y: Math.atan2(dx, dz), z: 0 },
      health: 1,
      maxHealth: 1,
      radius: ENEMY_BOLT_RADIUS,
      team: 'enemy',
      type: 'projectile',
      active: true,
      metadata: { damage: dmg, isEnemyBolt: true, bornAt: gameState.simTime, sniper: isSniper },
    };
    em.register(bolt);
    gameState.projectiles.push(bolt);
  };

  const spawnPlayerVolley = (forward: THREE.Vector3, right: THREE.Vector3, up: THREE.Vector3) => {
    if (!entityManagerRef.current) return;

    const playerPos = new THREE.Vector3(
      gameState.playerEntity.position.x,
      gameState.playerEntity.position.y,
      gameState.playerEntity.position.z
    );
    const playerVel = new THREE.Vector3(
      gameState.playerEntity.velocity.x,
      gameState.playerEntity.velocity.y,
      gameState.playerEntity.velocity.z
    );

    // Fighter layout: two wing-tip cannons firing as alternating upper/lower pairs.
    const pair = cannonCycleRef.current % 2;
    cannonCycleRef.current += 1;
    const verticalOffset = pair === 0 ? 0.26 : -0.1;
    const muzzleOffsets: Array<[number, number, number]> = [
      [-1.24, verticalOffset, 2.05],
      [1.24, verticalOffset, 2.05],
    ];

    const baseSpeed = 210;
    muzzleOffsets.forEach((offset, idx) => {
      const muzzlePos = playerPos
        .clone()
        .add(right.clone().multiplyScalar(offset[0]))
        .add(up.clone().multiplyScalar(offset[1]))
        .add(forward.clone().multiplyScalar(offset[2]));

      const shotSpeed = baseSpeed + Math.min(220, forwardSpeedRef.current * 1.2);
      const shotVel = forward
        .clone()
        .multiplyScalar(shotSpeed)
        .add(playerVel.clone().multiplyScalar(0.45));

      const projectile: GameEntity = {
        id: `player_laser_${Date.now()}_${pair}_${idx}`,
        position: { x: muzzlePos.x, y: muzzlePos.y, z: muzzlePos.z },
        velocity: { x: shotVel.x, y: shotVel.y, z: shotVel.z },
        rotation: {
          x: gameState.playerEntity.rotation.x,
          y: gameState.playerEntity.rotation.y,
          z: gameState.playerEntity.rotation.z,
        },
        health: 1,
        maxHealth: 1,
        radius: 0.16,
        team: 'player',
        type: 'projectile',
        active: true,
        metadata: {
          // Deep Run: cannons upgrade scales weapon damage.
          damage: Math.round(22 * (metaRef ? shipModsFor(metaRef.current).damageMult : 1)),
          scoreReward: 120,
          source: 'wing-cannon',
          bornAt: gameState.simTime,
        },
      };

      entityManagerRef.current?.register(projectile);
      gameState.projectiles.push(projectile);
    });

    if (!gameState.playerEntity.metadata) gameState.playerEntity.metadata = {};
    const flashes = (gameState.playerEntity.metadata.muzzleFlashes ??= [] as MuzzleFlash[]);
    muzzleOffsets.forEach((offset, idx) => {
      const muzzlePos = playerPos
        .clone()
        .add(right.clone().multiplyScalar(offset[0]))
        .add(up.clone().multiplyScalar(offset[1]))
        .add(forward.clone().multiplyScalar(offset[2]));
      flashes.push({
        id: `flash_${Date.now()}_${pair}_${idx}`,
        position: { x: muzzlePos.x, y: muzzlePos.y, z: muzzlePos.z },
        endTime: gameState.simTime + 0.085,
      });
    });
    gameState.playerEntity.metadata.lastVolleyAt = gameState.simTime;
    gameState.playerEntity.metadata.lastVolleyPair = pair;
    gameState.playerEntity.metadata.lastVolleyIndex = Number(gameState.playerEntity.metadata.lastVolleyIndex ?? 0) + 1;
    gameState.playerEntity.metadata.weaponRecoil = Math.min(1, Number(gameState.playerEntity.metadata.weaponRecoil ?? 0) + FIRE_RECOIL_KICK);
    gameState.playerEntity.metadata.weaponMode = 'wing-cannons';
    // Fire audio runs through a direct callback so it stays sample-accurate
    // even though React only re-renders at UI_SYNC_INTERVAL.
    onVolley?.(pair);
  };

  // Initialize game systems on mount
  useEffect(() => {
    const em = createEntityManager();
    const cs = createCollisionSystem(em);
    const gl = createGameLoop(em, cs, gameState);

    entityManagerRef.current = em;
    collisionSystemRef.current = cs;
    gameLoopRef.current = gl;

    return () => {
      // Cleanup
      enemyAgentsRef.current.clear();
    };
  }, []);

  // Main update loop with player input
  useFrame((state, delta) => {
    if (!gameLoopRef.current || !entityManagerRef.current) return;

    // Freeze simulation when paused
    if (gameState.phase === 'paused') return;

    // Keep the loop pointed at the shared state object (cheap pointer sync;
    // matters after restarts where helpers may swap nested references).
    gameLoopRef.current.setState(gameState);

    // Cap delta at 0.1 to prevent spiral of death
    const clampedDelta = Math.min(delta, 0.1);

    // --- FLIGHT CONTROLS: Arrow keys for rotation, W/Up for thrust ---
    if (gameState.phase === 'ignition' || gameState.phase === 'exploration' || gameState.phase === 'charging') {
      _playerEuler.set(
        gameState.playerEntity.rotation.x,
        gameState.playerEntity.rotation.y,
        gameState.playerEntity.rotation.z
      );
      _playerQuat.setFromEuler(_playerEuler);

      // Canonical gameplay convention: ship nose points along local -Z.
      // Weapons fire along this vector; engine thrust pushes in the opposite direction.
      const forwardLocal = _forwardLocal.set(0, 0, -1).applyQuaternion(_playerQuat);
      const rightLocal = _rightLocal.set(1, 0, 0).applyQuaternion(_playerQuat);
      const upLocal = _upLocal.set(0, 1, 0).applyQuaternion(_playerQuat);

      // --- Combat encounters: spawn + advance hostile patrols while cruising.
      if (gameState.phase === 'exploration') {
        const defendMode = gameState.gameMode === 'defend';
        const runMode = gameState.gameMode === 'run';

        // ===== DEEP RUN core loop =====
        if (runMode) {
          const meta = metaRef?.current;
          const md = (gameState.playerEntity.metadata ??= {});
          let run = md.run as RunState | undefined;
          if (!run || !run.active) {
            run = newRun();
            // Apply permanent upgrades to the ship for this run + count the run.
            if (meta && metaRef) {
              const mods = shipModsFor(meta);
              gameState.playerEntity.maxHealth = mods.maxHealth;
              gameState.playerEntity.health = mods.maxHealth;
              gameState.playerMaxHealth = mods.maxHealth;
              metaRef.current = { ...meta, totalRuns: meta.totalRuns + 1 };
            }
            run.hullAtEntry = 1;
            md.run = run;
            sectorSpawnedRef.current = false;
            lastEventLenRef.current = gameState.events.length;
          }

          // Seed this sector's hostiles exactly once on entry, and surface a
          // REAL fact about this region so each jump teaches the Solar System.
          // Every 3rd sector (2, 5, 8…) is a BOSS sector — the run's climax.
          const isBossSector = run.sectorIndex > 0 && (run.sectorIndex + 1) % 3 === 0;
          if (!sectorSpawnedRef.current) {
            if (isBossSector) {
              spawnBoss(forwardLocal, run.sectorIndex);
            } else {
              spawnSector(forwardLocal, rightLocal, upLocal, run.sectorIndex);
            }
            sectorSpawnedRef.current = true;
            run.sectorCleared = false;
            // weapons-hold window on entry (see SECTOR_GRACE_* constants)
            md.holdFireUntil =
              gameState.simTime + (run.sectorIndex === 0 ? SECTOR_GRACE_FIRST_S : SECTOR_GRACE_DEEP_S);
            const info = sectorInfo(run.sectorIndex);
            md.sectorFact = isBossSector
              ? `⚠ CAPITAL HOSTILE INBOUND — ${info.name}. Break it to clear the sector.`
              : info.fact;
            md.sectorFactUntil = gameState.simTime + 11; // show for ~11s on arrival
          }
          md.bossSector = isBossSector;

          // Salvage on kill: scan new 'entity_killed' events since last frame.
          // Skip synthetic boss-detonation fragments (they're pure FX, not kills).
          for (let i = lastEventLenRef.current; i < gameState.events.length; i++) {
            const ev = gameState.events[i];
            if (ev.type === 'entity_killed' && ev.source !== 'boss_detonation' && ev.source !== 'ram') {
              run.runSalvage += salvagePerKill(run.sectorIndex);
              run.runKills += 1;
            }
          }
          lastEventLenRef.current = gameState.events.length;

          // Boss: multi-phase aggression + HUD HP bar. As its hull drops it
          // speeds up and fires faster (a real escalating climax).
          const boss = gameState.enemies.find((e) => e.active && e.metadata?.class === 'boss');
          if (boss && boss.metadata) {
            const frac = boss.health / boss.maxHealth;
            md.bossActive = true;
            md.bossHpFrac = Math.max(0, frac);
            md.bossName = String(boss.metadata.variant ?? 'capital');
            // charge wind-up 0..1 → HUD "incoming volley" telegraph the player can dodge
            const ch = Number(boss.metadata.charge ?? 0);
            const chMax = Number(boss.metadata.chargeMax ?? 0.7);
            md.bossCharging = ch > 0 ? 1 - ch / chMax : 0;
            // phase up at <60% and <30% hull. Compute fire rate from a STABLE
            // base captured once (multiplying the live value would compound).
            if (boss.metadata.baseFireRate === undefined) {
              boss.metadata.baseFireRate = Number(boss.metadata.fireRate) || 0.35;
            }
            const phase = frac < 0.3 ? 3 : frac < 0.6 ? 2 : 1;
            boss.metadata.phase = phase;
            boss.metadata.fireRate = Number(boss.metadata.baseFireRate) * (1 + (phase - 1) * 0.4);
          } else {
            md.bossActive = false;
          }

          // Sector cleared → activate the jump gate (once spawned + all dead).
          const liveEnemies = gameState.enemies.filter((e) => e.active).length;
          if (sectorSpawnedRef.current && liveEnemies === 0 && !run.sectorCleared) {
            run.sectorCleared = true;
            // Boss sectors pay a big bonus — the run's climax should feel rewarding.
            const bonus = sectorClearBonus(run.sectorIndex) * (isBossSector ? 3 : 1);
            run.runSalvage += bonus;
          }

          // Player input at the gate: G = jump deeper, T = extract.
          if (run.sectorCleared) {
            if (keysPressed.current.has('KeyG')) {
              keysPressed.current.delete('KeyG');
              run.sectorIndex += 1;
              run.sectorCleared = false;
              sectorSpawnedRef.current = false; // next frame seeds the new sector
              run.hullAtEntry = gameState.playerEntity.health / gameState.playerEntity.maxHealth;
            } else if (keysPressed.current.has('KeyT')) {
              keysPressed.current.delete('KeyT');
              run.active = false;
              if (meta && metaRef) metaRef.current = bankRun(meta, run, true);
              onRunEnd?.({
                extracted: true,
                sectorReached: run.sectorIndex,
                sectorName: sectorName(run.sectorIndex),
                kills: run.runKills,
                salvageBanked: run.runSalvage,
              });
              gameState.phase = 'outfitting';
            }
          }

          // expose run status to the HUD
          md.runSalvage = run.runSalvage;
          md.runSectorIndex = run.sectorIndex;
          md.runSectorName = sectorName(run.sectorIndex);
          md.runSectorCleared = run.sectorCleared;
          md.runLiveEnemies = liveEnemies;
        }

        encounterTimerRef.current -= clampedDelta;
        // Defend Earth spawns waves on a timer regardless of speed (you're
        // holding a line, not cruising); exploration spawns patrols only while
        // moving. Defend waves also come faster. Deep Run manages its own
        // sector spawns, so the cruise-patrol spawner is disabled there.
        const wantSpawn = runMode
          ? false
          : defendMode
            ? encounterTimerRef.current <= 0
            : encounterTimerRef.current <= 0 && forwardSpeedRef.current > ENCOUNTER_MIN_SPEED;
        if (wantSpawn) {
          encounterTimerRef.current = defendMode ? ENCOUNTER_INTERVAL_S * 0.5 : ENCOUNTER_INTERVAL_S;
          spawnEncounter(forwardLocal, rightLocal, upLocal);
        }

        // Defend Earth: incoming threats chip away at the planet. When an
        // enemy slips past the player and reaches Earth, it damages the planet
        // and is consumed. At zero health, the homeworld falls → defeat.
        if (defendMode) {
          const earth = getMissionLayout(gameState.worldIndex).planetPosition;
          const earthRadius = getMissionLayout(gameState.worldIndex).planetRadius;
          for (const enemy of gameState.enemies) {
            if (!enemy.active) continue;
            const dx = earth.x - enemy.position.x;
            const dy = earth.y - enemy.position.y;
            const dz = earth.z - enemy.position.z;
            if (dx * dx + dy * dy + dz * dz < (earthRadius * 1.4) ** 2) {
              gameState.defendingPlanetHealth = Math.max(0, gameState.defendingPlanetHealth - 0.06);
              enemy.active = false;
              entityManagerRef.current?.remove(enemy.id);
            }
          }
          if (gameState.defendingPlanetHealth <= 0) {
            gameState.phase = 'defeat';
            gameState.waveStartTime = gameState.simTime;
          }
        }

        // Drift live hostiles toward their target; cull dead or far-behind.
        // Exploration: all hostiles hunt the player. Defend Earth: most press
        // toward the planet (the thing you protect), so you must intercept.
        const defendTarget = defendMode
          ? getMissionLayout(gameState.worldIndex).planetPosition
          : null;
        if (gameState.enemies.length > 0) {
          const survivors: GameEntity[] = [];
          for (const enemy of gameState.enemies) {
            if (!enemy.active) {
              entityManagerRef.current?.remove(enemy.id);
              continue;
            }
            // In defend mode, enemies that aren't snipers make for Earth;
            // snipers still stalk the player. Exploration: everyone hunts you.
            const huntEarth =
              defendTarget !== null && enemy.metadata?.class !== 'sniper';
            const tx = huntEarth ? defendTarget!.x : gameState.playerEntity.position.x;
            const ty = huntEarth ? defendTarget!.y : gameState.playerEntity.position.y;
            const tz = huntEarth ? defendTarget!.z : gameState.playerEntity.position.z;
            const toPlayer = _enemyToPlayer.set(
              tx - enemy.position.x,
              ty - enemy.position.y,
              tz - enemy.position.z
            );
            const dist = toPlayer.length();
            // Cull patrols the player has long since outrun — but only for
            // player-hunting enemies. Earth-bound attackers spawn far from
            // the planet by design, so distance-to-Earth must not cull them.
            if (!huntEarth && dist > ENCOUNTER_DESPAWN_BEHIND) {
              entityManagerRef.current?.remove(enemy.id);
              continue;
            }
            if (dist > 0.001) {
              toPlayer.multiplyScalar(ENEMY_DRIFT_SPEED / dist);
              enemy.velocity.x = toPlayer.x;
              enemy.velocity.y = toPlayer.y;
              enemy.velocity.z = toPlayer.z;
              enemy.position.x += toPlayer.x * clampedDelta;
              enemy.position.y += toPlayer.y * clampedDelta;
              enemy.position.z += toPlayer.z * clampedDelta;
              // Face the player so the model nose tracks the approach.
              enemy.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
              enemy.rotation.x = -Math.asin(Math.max(-1, Math.min(1, toPlayer.y / ENEMY_DRIFT_SPEED)));
            }

            // --- Enemy fire: hostiles shoot back when facing + in range. Gives
            // combat real teeth so the roguelike's "death loses your run" stakes
            // actually bite. (Deep Run + Defend; not pure free-roam Explore.)
            const isBoss = enemy.metadata?.class === 'boss';
            const fireRange = isBoss ? ENEMY_FIRE_RANGE * 1.6 : ENEMY_FIRE_RANGE;
            const holdFireUntil = Number(gameState.playerEntity.metadata?.holdFireUntil ?? 0);
            if (gameState.gameMode !== 'explore' && dist < fireRange && gameState.simTime >= holdFireUntil) {
              const md = (enemy.metadata ??= {});
              const cd = Number(md.fireCooldown ?? Math.random() * 1.2);
              const next = cd - clampedDelta;
              if (isBoss) {
                // Boss fires a TELEGRAPHED spread: a brief charge wind-up (read by
                // the HUD/model as a warning flash) then a fan of bolts, so it's a
                // readable, dodgeable threat rather than a bullet hose.
                const charge = Number(md.charge ?? 0);
                if (next <= 0 && charge <= 0) {
                  md.charge = 0.7; // wind-up seconds
                  md.chargeMax = 0.7;
                }
                if (charge > 0) {
                  const c2 = charge - clampedDelta;
                  md.charge = c2;
                  if (c2 <= 0) {
                    // release the fan: 3–5 bolts spread by depth phase
                    const phase = Number(md.phase) || 1;
                    const n = 2 + phase; // 3,4,5 bolts
                    for (let s = 0; s < n; s++) {
                      spawnEnemyBolt(enemy, (s - (n - 1) / 2) * 0.14);
                    }
                    const rate = Number(md.fireRate) || 0.4;
                    md.fireCooldown = (1.1 + Math.random() * 0.5) / Math.max(0.15, rate);
                  }
                } else {
                  md.fireCooldown = next;
                }
              } else if (next <= 0) {
                const rate = Number(md.fireRate) || 0.5; // shots/sec-ish weight
                md.fireCooldown = (0.9 + Math.random() * 0.6) / Math.max(0.15, rate);
                spawnEnemyBolt(enemy);
              } else {
                md.fireCooldown = next;
              }
            }
            survivors.push(enemy);
          }
          if (survivors.length !== gameState.enemies.length) {
            gameState.enemies = survivors;
          }
        }

        // Retire spent bolts: consumed on hit, or older than their travel
        // window. Without this the projectiles array grows unbounded.
        if (gameState.projectiles.length > 0) {
          const liveBolts = gameState.projectiles.filter((p) => {
            if (!p.active) {
              entityManagerRef.current?.remove(p.id);
              return false;
            }
            const bornAt = Number(p.metadata?.bornAt ?? gameState.simTime);
            if (gameState.simTime - bornAt > 2.5) {
              p.active = false;
              entityManagerRef.current?.remove(p.id);
              return false;
            }
            return true;
          });
          if (liveBolts.length !== gameState.projectiles.length) {
            gameState.projectiles = liveBolts;
          }
        }
      }

      const attackMode = Boolean(gameState.playerEntity.metadata?.attackMode);
      // Quicker base turn rate for a responsive arcade feel (was 2.1 / 1.6).
      const turnSpeed = attackMode ? 2.5 : 2.0;
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const ignitionSequenceActive = gameState.phase === 'ignition';

      let pitchInput = 0;
      let yawInput = 0;
      let rollInput = 0;

      if (!ignitionSequenceActive) {
        if (keysPressed.current.has('ArrowUp')) pitchInput += 1;
        if (keysPressed.current.has('ArrowDown')) pitchInput -= 1;
        if (keysPressed.current.has('ArrowLeft')) yawInput += 1;
        if (keysPressed.current.has('ArrowRight')) yawInput -= 1;
        if (keysPressed.current.has('KeyA')) yawInput += 1;
        if (keysPressed.current.has('KeyD')) yawInput -= 1;
        if (keysPressed.current.has('KeyQ')) rollInput += 1;
        if (keysPressed.current.has('KeyE')) rollInput -= 1;

        if (!isMobile) {
          const mouseSensitivity = attackMode ? 1.0 : 0.85;
          pitchInput += mouseRotation.current.pitch * mouseSensitivity;
          yawInput += mouseRotation.current.yaw * mouseSensitivity;
        }

        if (isMobile && deviceOrientation.current.beta !== 0) {
          const deviceSensitivity = attackMode ? 0.009 : 0.007;
          pitchInput += (deviceOrientation.current.beta / 180) * deviceSensitivity * 240;
          yawInput -= (deviceOrientation.current.gamma / 90) * deviceSensitivity * 240;
          rollInput += (deviceOrientation.current.alpha / 360) * deviceSensitivity * 120;
        }

        // Virtual joystick input for touch devices
        if (joystickRef?.current?.active) {
          const joystickSensitivity = attackMode ? 0.022 : 0.018;
          const maxR = 48;
          const normX = joystickRef.current.dx / maxR;
          const normY = joystickRef.current.dy / maxR;
          yawInput -= normX * joystickSensitivity * 60;
          pitchInput += normY * joystickSensitivity * 60;
        }
      }

      const applyDeadzone = (value: number, deadzone = 0.045) => {
        if (Math.abs(value) <= deadzone) return 0;
        return Math.sign(value) * ((Math.abs(value) - deadzone) / (1 - deadzone));
      };

      pitchInput = applyDeadzone(Math.max(-1, Math.min(1, pitchInput)));
      yawInput = applyDeadzone(Math.max(-1, Math.min(1, yawInput)));
      rollInput = applyDeadzone(Math.max(-1, Math.min(1, rollInput)));

      // Snappier steering response: input ramps up fast (immediate) but still
      // eases, so turns feel connected/precise rather than mushy.
      const turnK = 1 - Math.exp(-clampedDelta * 16.0);
      smoothedInputRef.current.pitch += (pitchInput - smoothedInputRef.current.pitch) * turnK;
      smoothedInputRef.current.yaw += (yawInput - smoothedInputRef.current.yaw) * turnK;
      smoothedInputRef.current.roll += (rollInput - smoothedInputRef.current.roll) * turnK;

      // Speed-adaptive turn rate: ease it down a touch at high speed so the ship
      // isn't twitchy when screaming along, keep agility at cruise. Jet trades a
      // little agility for the committed high-speed line.
      const speedFrac = Math.min(1, Math.abs(forwardSpeedRef.current) / 600);
      const turnScale = (1 - speedFrac * 0.28) * (1 - jetMixRef.current * 0.14);
      const effTurn = turnSpeed * turnScale;

      // ===== 6-DOF QUATERNION FLIGHT =====================================
      // Rotate the ship about its OWN local axes (pitch=local X, yaw=local Y,
      // roll=local Z). Composing local-axis quaternions means there's no gimbal
      // lock: you can pitch straight up, loop, fly inverted, and change course in
      // ANY direction — real free maneuvering. The entity keeps an Euler rotation
      // for the renderer/camera, so we seed the quaternion from it once, integrate
      // in quaternion space, then write the Euler back at the end.
      // Re-seed from the entity Euler on first frame OR whenever an external
      // heading reset (R key / fly-to) bumped the reset signal — so those set the
      // orientation rather than being clobbered by the quaternion next frame.
      const resetSeq = Number(gameState.playerEntity.metadata?.headingResetSeq ?? 0);
      if (!orientRef.current || resetSeq !== headingResetSeenRef.current) {
        headingResetSeenRef.current = resetSeq;
        _playerEuler.set(
          gameState.playerEntity.rotation.x,
          gameState.playerEntity.rotation.y,
          gameState.playerEntity.rotation.z,
          'YXZ',
        );
        if (!orientRef.current) orientRef.current = new THREE.Quaternion().setFromEuler(_playerEuler);
        else orientRef.current.setFromEuler(_playerEuler);
      }
      const q = orientRef.current;

      // AUTO-BANK: a fighter rolls INTO its turns. Target roll from yaw input, eased.
      const bankTarget = -smoothedInputRef.current.yaw * (0.5 + jetMixRef.current * 0.22);
      autoBankRef.current += (bankTarget - autoBankRef.current) * (1 - Math.exp(-clampedDelta * 4.5));

      // Per-frame rotation amounts (radians) about each local axis.
      const pitchAmt = smoothedInputRef.current.pitch * effTurn * clampedDelta;
      const yawAmt = smoothedInputRef.current.yaw * effTurn * clampedDelta;
      // Manual roll (Q/E) + a slice of the auto-bank folded in as roll rate so the
      // ship visibly banks while turning, without ever snapping the whole roll.
      const rollAmt =
        smoothedInputRef.current.roll * effTurn * clampedDelta +
        autoBankRef.current * (1 - Math.exp(-clampedDelta * 2.2)) * (1 - Math.abs(smoothedInputRef.current.roll)) * 0.5;

      _dqPitch.setFromAxisAngle(_axisX, pitchAmt);
      _dqYaw.setFromAxisAngle(_axisY, yawAmt);
      _dqRoll.setFromAxisAngle(_axisZ, rollAmt);
      // Post-multiply (q * dq) → rotate about the ship's LOCAL axes.
      q.multiply(_dqYaw).multiply(_dqPitch).multiply(_dqRoll);

      if (assistedFlight) {
        // Fly-by-wire auto-level: a GENTLE nudge that rolls the ship's own up back
        // toward world-up so it settles wings-level when you stop steering — but
        // deliberately weak and only when you're not actively steering at all, so
        // it never fights an intentional bank/climb. Free-flight should feel free;
        // this just keeps a hands-off ship from drifting into a slow roll. You can
        // still fly fully inverted by holding roll (rollHold gates it off).
        const steering =
          Math.abs(smoothedInputRef.current.roll) +
          Math.abs(smoothedInputRef.current.yaw) +
          Math.abs(smoothedInputRef.current.pitch) +
          Math.abs(autoBankRef.current);
        if (steering < 0.12) {
          const up = _alUp.set(0, 1, 0).applyQuaternion(q);
          const fwd = _alFwd.set(0, 0, -1).applyQuaternion(q);
          // Desired up = world up projected perpendicular to the nose.
          const desiredUp = _alDesiredUp.set(0, 1, 0).addScaledVector(fwd, -fwd.y).normalize();
          // Only correct SMALL residual roll (settle), never a big upside-down
          // flip — if the ship is far from level the player put it there on purpose.
          if (desiredUp.lengthSq() > 1e-4 && up.dot(desiredUp) > 0.55) {
            const levelQ = _dqRoll.setFromUnitVectors(up, desiredUp);
            const autoLevelK = 1 - Math.exp(-clampedDelta * 0.9);
            _dqPitch.identity().slerp(levelQ, autoLevelK);
            q.premultiply(_dqPitch);
          }
        }
      }

      q.normalize();
      // Write the integrated orientation back to the entity's Euler (YXZ order to
      // match the seed) for the renderer + camera, which read rotation.x/y/z.
      _playerEuler.setFromQuaternion(q, 'YXZ');
      gameState.playerEntity.rotation.x = _playerEuler.x;
      gameState.playerEntity.rotation.y = _playerEuler.y;
      gameState.playerEntity.rotation.z = _playerEuler.z;
      // Refresh the direction vectors from the JUST-updated orientation so velocity
      // and cannon-fire use the ship's CURRENT facing (no one-frame lag), and so
      // course changes translate to travel + aim immediately.
      forwardLocal.set(0, 0, -1).applyQuaternion(q);
      rightLocal.set(1, 0, 0).applyQuaternion(q);
      upLocal.set(0, 1, 0).applyQuaternion(q);

      const isAccelerating = !ignitionSequenceActive && keysPressed.current.has('KeyW');
      const isBraking = !ignitionSequenceActive && keysPressed.current.has('KeyS');
      const isBoosting = !ignitionSequenceActive && (keysPressed.current.has('ShiftLeft') || keysPressed.current.has('ShiftRight'));
      const isFiring = !ignitionSequenceActive && (keysPressed.current.has('Mouse0') || keysPressed.current.has('KeyJ') || keysPressed.current.has('Enter'));

      // Tab toggles the flight mode (Cruise ↔ Jet) on the key's rising edge.
      // (F is already flight-assist; Tab reads as a clean "shift gears".)
      const gearDown = keysPressed.current.has('Tab');
      if (gearDown && !fKeyWasDownRef.current && !ignitionSequenceActive) {
        flightModeRef.current = flightModeRef.current === 'jet' ? 'cruise' : 'jet';
      }
      fKeyWasDownRef.current = gearDown;

      // C toggles auto-cruise so you can fly hands-free and just steer.
      const cruiseKeyDown = keysPressed.current.has('KeyC');
      if (cruiseKeyDown && !cKeyWasDownRef.current && !ignitionSequenceActive) {
        autoCruiseRef.current = !autoCruiseRef.current;
      }
      cKeyWasDownRef.current = cruiseKeyDown;

      // Throttle model. By default the ship holds at rest until W is pressed, so
      // you can park anywhere. With auto-cruise ON it settles to a comfortable
      // hands-free cruise (0.6 throttle) that you can still override: W pushes to
      // full, S brakes — and braking to a near-stop cancels cruise so you can park.
      let targetThrottle = 0;
      if (autoCruiseRef.current) {
        targetThrottle = 0.6;
        if (isBraking && Math.abs(forwardSpeedRef.current) < 8) autoCruiseRef.current = false;
      }
      if (isAccelerating) targetThrottle = 1.0;
      if (isBraking) targetThrottle = -0.5;

      const throttleResponse =
        targetThrottle > throttleRef.current
          ? (isBoosting ? 4.2 : attackMode ? 3.7 : 3.3)
          : (isBraking ? 6.4 : 2.2);
      const throttleK = 1 - Math.exp(-clampedDelta * throttleResponse);
      throttleRef.current += (targetThrottle - throttleRef.current) * throttleK;
      // Hard floor at zero so the ship can actually come to a stop
      if (Math.abs(throttleRef.current) < 0.001) throttleRef.current = 0;

      const boostTarget = isBoosting && throttleRef.current > 0.05 ? 1 : 0;
      const boostResponse = boostTarget > boostSpoolRef.current ? 5.4 : 7.4;
      const boostK = 1 - Math.exp(-clampedDelta * boostResponse);
      boostSpoolRef.current += (boostTarget - boostSpoolRef.current) * boostK;

      // Ease the Cruise↔Jet blend so switching modes ramps smoothly (no snap).
      // Jet spools up a touch slower than it spools down — a jet takes a moment
      // to hit supersonic but drops back quickly when you shift down.
      const jetTarget = flightModeRef.current === 'jet' ? 1 : 0;
      const jetResponse = jetTarget > jetMixRef.current ? 2.6 : 3.8;
      jetMixRef.current += (jetTarget - jetMixRef.current) * (1 - Math.exp(-clampedDelta * jetResponse));
      const jetMix = jetMixRef.current;

      const forwardThrottle = Math.max(0, throttleRef.current);
      const interstellarBlend = attackMode ? 0 : Math.max(0, Math.min(1, forwardThrottle * 0.62 + boostSpoolRef.current * 0.84));
      // Speed tuned for the scene scale (Earth ~200 units away): a readable
      // cruise + a strong-but-controllable boost, so the ship reads as a hero
      // gliding through space rather than teleporting off-screen. Was 280 +
      // blend*1280 (up to 1560 u/s), which crossed the whole scene in <1s.
      // Jet mode lifts the cruise ceiling into the supersonic band — a clearly
      // faster gear, not just a nudge. Cruise ~120–480; Jet ~120–840.
      const maxForwardSpeed = attackMode ? 42 : 120 + interstellarBlend * (360 + jetMix * 360);
      const maxReverseSpeed = attackMode ? -14 : -21;

      const throttleSpeed =
        throttleRef.current >= 0
          ? forwardThrottle * maxForwardSpeed
          : throttleRef.current * Math.abs(maxReverseSpeed);
      // Deep Run: the Tuned Drive upgrade scales boost + acceleration.
      const driveMult = gameState.gameMode === 'run' && metaRef
        ? shipModsFor(metaRef.current).driveMult
        : 1;
      const boostSpeedBonus = boostSpoolRef.current * (attackMode ? 26 : (210 + interstellarBlend * 520) * (1 + jetMix * 0.6)) * driveMult;
      const targetSpeed =
        throttleSpeed + (forwardThrottle > 0 ? boostSpeedBonus : 0);

      if (!Number.isFinite(forwardSpeedRef.current)) {
        forwardSpeedRef.current = 0;
      }

      // Jet mode also pushes harder off the line so the extra top speed is
      // reachable — the acceleration ceiling lifts with jetMix.
      const accelLimit =
        ((attackMode ? 44 : (160 + interstellarBlend * 320) * (1 + jetMix * 0.5)) + boostSpoolRef.current * (attackMode ? 26 : 420)) * driveMult;
      const decelLimit = isBraking ? (attackMode ? 78 : 94) : attackMode ? 42 : 56;
      const speedDelta = targetSpeed - forwardSpeedRef.current;
      const maxUpStep = accelLimit * clampedDelta;
      const maxDownStep = decelLimit * clampedDelta;
      if (speedDelta >= 0) {
        forwardSpeedRef.current += Math.min(speedDelta, maxUpStep);
      } else {
        forwardSpeedRef.current += Math.max(speedDelta, -maxDownStep);
      }

      // Gentle friction deceleration to zero when no thrust input (skipped while
      // auto-cruise is holding a set speed for you).
      if (!isAccelerating && !isBraking && !autoCruiseRef.current && Math.abs(forwardSpeedRef.current) > 0) {
        const next = Math.abs(forwardSpeedRef.current) - 10 * clampedDelta;
        forwardSpeedRef.current = Math.sign(forwardSpeedRef.current) * Math.max(0, next);
        if (Math.abs(forwardSpeedRef.current) < 0.05) forwardSpeedRef.current = 0;
      }

      const stopLock =
        (isBraking && Math.abs(forwardSpeedRef.current) < 1.2) ||
        (assistedFlight && !isAccelerating && !isBraking && Math.abs(forwardSpeedRef.current) < 0.2);
      if (stopLock) {
        forwardSpeedRef.current = 0;
        throttleRef.current = 0;
        boostSpoolRef.current = 0;
      }

      const desiredForwardVelocity = _desiredVel.copy(forwardLocal).multiplyScalar(forwardSpeedRef.current);
      if (assistedFlight) {
        // Fly-by-wire, but with a HAIR of momentum: velocity chases the nose fast
        // (so course changes are immediate) yet eases over ~1 frame at 60fps, so a
        // hard turn has a touch of weight/lean instead of the ship snapping rigidly
        // onto its new heading like it's on rails. Much nicer free-flight feel.
        const vel = _velScratch.set(
          gameState.playerEntity.velocity.x,
          gameState.playerEntity.velocity.y,
          gameState.playerEntity.velocity.z
        );
        const trackK = 1 - Math.exp(-clampedDelta * 14);
        vel.lerp(desiredForwardVelocity, trackK);
        gameState.playerEntity.velocity.x = vel.x;
        gameState.playerEntity.velocity.y = vel.y;
        gameState.playerEntity.velocity.z = vel.z;
      } else {
        // Manual mode keeps inertial drift but steers velocity toward the nose a
        // bit more eagerly (was 1.15) so turns translate into actual direction
        // change quickly — the floaty "sliding past the turn" lag was a big part
        // of the off feel. Still inertial, just more responsive.
        const vel = _velScratch.set(
          gameState.playerEntity.velocity.x,
          gameState.playerEntity.velocity.y,
          gameState.playerEntity.velocity.z
        );
        const steerK = 1 - Math.exp(-clampedDelta * 2.4);
        vel.lerp(desiredForwardVelocity, steerK);
        gameState.playerEntity.velocity.x = vel.x;
        gameState.playerEntity.velocity.y = vel.y;
        gameState.playerEntity.velocity.z = vel.z;
      }

      // Update continuous engine audio
      updateEngineAudio?.(forwardSpeedRef.current, throttleRef.current, isBoosting, boostSpoolRef.current);

      if (hazardsCacheRef.current?.worldIndex !== gameState.worldIndex) {
        hazardsCacheRef.current = {
          worldIndex: gameState.worldIndex,
          hazards: buildGravityHazards(getMissionLayout(gameState.worldIndex)),
        };
      }
      const gravityHazards = hazardsCacheRef.current.hazards;
      const playerPosVec = _playerPosVec.set(
        gameState.playerEntity.position.x,
        gameState.playerEntity.position.y,
        gameState.playerEntity.position.z
      );
      const gravityAcceleration = _gravityAccel.set(0, 0, 0);
      let gravityLoad = 0;
      let boundaryLoad = 0;
      let hullDamageThisFrame = 0;
      let fatalSource = '';
      let nearestHazard = '';
      let nearestDist = Number.POSITIVE_INFINITY;

      gravityHazards.forEach((hazard) => {
        const deltaToHazard = _hazardDelta.copy(hazard.position).sub(playerPosVec);
        const distance = deltaToHazard.length();
        if (distance < nearestDist) {
          nearestDist = distance;
          nearestHazard = hazard.label;
        }
        if (distance > hazard.influenceRadius || distance <= 0.0001) return;

        const normalizedInfluence = 1 - distance / hazard.influenceRadius;
        const safeDistance = Math.max(20, distance);
        const pullStrength = (hazard.gravityStrength * normalizedInfluence * normalizedInfluence) / safeDistance;
        gravityAcceleration.add(deltaToHazard.normalize().multiplyScalar(pullStrength));
        gravityLoad = Math.max(gravityLoad, Math.min(1, normalizedInfluence * 1.25));

        if (distance < hazard.warningRadius) {
          const warningRange = Math.max(1, hazard.warningRadius - hazard.fatalRadius);
          const warningPressure = 1 - Math.max(0, distance - hazard.fatalRadius) / warningRange;
          hullDamageThisFrame += warningPressure * hazard.damagePerSecond * clampedDelta;
        }

        if (distance <= hazard.fatalRadius) {
          fatalSource = hazard.label;
        }
      });

      // --- Incoming enemy fire: resolve enemy bolts hitting the player. Folds
      // into hullDamageThisFrame, so taking fire actually drains the hull (and,
      // in Deep Run, can end the run). Consumed bolts are deactivated.
      let tookFireThisFrame = 0;
      if (gameState.projectiles.length > 0) {
        for (const p of gameState.projectiles) {
          if (!p.active || !p.metadata?.isEnemyBolt) continue;
          const bdx = p.position.x - playerPosVec.x;
          const bdy = p.position.y - playerPosVec.y;
          const bdz = p.position.z - playerPosVec.z;
          const hitR = PLAYER_HIT_RADIUS + p.radius;
          if (bdx * bdx + bdy * bdy + bdz * bdz <= hitR * hitR) {
            const dmg = Number(p.metadata.damage) || 10;
            hullDamageThisFrame += dmg;
            tookFireThisFrame += dmg;
            p.active = false;
            entityManagerRef.current?.remove(p.id);
            // record a hit event so the camera shake / HUD can react (item 1.3)
            gameState.events.push({
              type: 'entity_damaged',
              source: p.id,
              target: gameState.playerEntity.id,
              amount: dmg,
              timestamp: gameState.simTime,
              position: { x: playerPosVec.x, y: playerPosVec.y, z: playerPosVec.z },
            });
          }
        }
      }
      // --- Ram damage (1.2): enemies colliding with the hull. A swarm pressing
      // in close is now genuinely dangerous — contact costs a burst of hull and
      // destroys the rammer. Routed through 'entity_killed' so the existing
      // kill-confirm feedback (explosion + punch) fires at the impact point;
      // salvage explicitly excludes ram kills (no reward for eating a hit).
      for (const e of gameState.enemies) {
        if (!e.active) continue;
        const rdx = e.position.x - playerPosVec.x;
        const rdy = e.position.y - playerPosVec.y;
        const rdz = e.position.z - playerPosVec.z;
        const ramR = PLAYER_HIT_RADIUS + e.radius;
        if (rdx * rdx + rdy * rdy + rdz * rdz > ramR * ramR) continue;
        const dmg = Math.max(8, Math.round((e.maxHealth || 20) * 0.35));
        hullDamageThisFrame += dmg;
        tookFireThisFrame += dmg;
        e.active = false;
        e.health = 0;
        entityManagerRef.current?.remove(e.id);
        gameState.events.push({
          type: 'entity_killed',
          source: 'ram',
          target: e.id,
          amount: dmg,
          timestamp: gameState.simTime,
          position: { x: e.position.x, y: e.position.y, z: e.position.z },
        });
      }

      if (!gameState.playerEntity.metadata) gameState.playerEntity.metadata = {};
      // decay an incoming-fire signal for HUD/feedback
      const prevFire = Number(gameState.playerEntity.metadata.incomingFire ?? 0);
      gameState.playerEntity.metadata.incomingFire = Math.max(
        tookFireThisFrame > 0 ? 1 : 0,
        prevFire - clampedDelta * 2.5
      );

      gameState.playerEntity.velocity.x += gravityAcceleration.x * clampedDelta;
      gameState.playerEntity.velocity.y += gravityAcceleration.y * clampedDelta;
      gameState.playerEntity.velocity.z += gravityAcceleration.z * clampedDelta;

      const distanceFromKnownCenter = playerPosVec.length();
      if (distanceFromKnownCenter > KNOWN_UNIVERSE_RADIUS) {
        const overflow = distanceFromKnownCenter - KNOWN_UNIVERSE_RADIUS;
        const outward = _outward.copy(playerPosVec).normalize();
        const inwardBrake = Math.min(280, 60 + overflow * 0.1);
        gameState.playerEntity.velocity.x -= outward.x * inwardBrake * clampedDelta;
        gameState.playerEntity.velocity.y -= outward.y * inwardBrake * clampedDelta;
        gameState.playerEntity.velocity.z -= outward.z * inwardBrake * clampedDelta;

        forwardSpeedRef.current = Math.max(0, forwardSpeedRef.current - (40 + overflow * 0.02) * clampedDelta);
        boundaryLoad = Math.min(1, overflow / 900);
        hullDamageThisFrame += (6 + boundaryLoad * 26) * clampedDelta;
      }

      if (assistedFlight) {
        // Apply post-force anti-drift damping so gravity/boundary forces do not
        // leave persistent lateral slip in assisted mode.
        const vel = _velScratch.set(
          gameState.playerEntity.velocity.x,
          gameState.playerEntity.velocity.y,
          gameState.playerEntity.velocity.z
        );
        const forwardNorm = _fwdNorm.copy(forwardLocal).normalize();
        const forwardMag = vel.dot(forwardNorm);
        const forwardComponent = forwardNorm.multiplyScalar(forwardMag);
        const lateralComponent = _lateral.copy(vel).sub(forwardComponent);
        const driftDamp = 1 - Math.exp(-clampedDelta * 6.0);
        lateralComponent.multiplyScalar(1 - driftDamp);
        gameState.playerEntity.velocity.x = forwardComponent.x + lateralComponent.x;
        gameState.playerEntity.velocity.y = forwardComponent.y + lateralComponent.y;
        gameState.playerEntity.velocity.z = forwardComponent.z + lateralComponent.z;
      }

      const updatedHealth = Math.max(0, gameState.playerEntity.health - hullDamageThisFrame);
      gameState.playerEntity.health = updatedHealth;

      const gravityWarning =
        fatalSource.length > 0
          ? `${fatalSource.toUpperCase()} PROXIMITY CRITICAL`
          : boundaryLoad > 0.2
            ? 'BOUNDARY LIMIT REACHED: RETURN TO KNOWN SPACE'
            : gravityLoad > 0.35
              ? `GRAVITY SHEAR: ${nearestHazard.toUpperCase()}`
              : '';

      if (fatalSource.length > 0 || updatedHealth <= 0) {
        if (!gameState.metadata) gameState.metadata = {};
        gameState.metadata.routeMessage = fatalSource.length > 0
          ? `Hull lost near ${fatalSource}`
          : 'Hull integrity lost';
        gameState.metadata.routeMessageUntil = gameState.simTime + 4;
        // Deep Run: death loses the run's un-banked cargo and routes to
        // Outfitting (spend what you'd already banked); other modes → defeat.
        const run = gameState.playerEntity.metadata?.run as RunState | undefined;
        if (gameState.gameMode === 'run' && run?.active) {
          run.active = false;
          if (metaRef) metaRef.current = recordDeath(metaRef.current, run);
          onRunEnd?.({
            extracted: false,
            sectorReached: run.sectorIndex,
            sectorName: sectorName(run.sectorIndex),
            kills: run.runKills,
            salvageBanked: 0,
          });
          gameState.phase = 'outfitting';
        } else {
          gameState.phase = 'defeat';
        }
        gameState.waveStartTime = gameState.simTime;
      }

      if (!gameState.playerEntity.metadata) {
        gameState.playerEntity.metadata = {};
      }
      gameState.playerEntity.metadata.thrustLevel = Math.min(
        1,
        Math.max(0, throttleRef.current) * 0.75 + Math.max(0, boostSpoolRef.current) * 0.25
      );
      gameState.playerEntity.metadata.boostActive = boostSpoolRef.current > 0.12;
      gameState.playerEntity.metadata.boostSpool = boostSpoolRef.current;
      gameState.playerEntity.metadata.throttle = throttleRef.current;
      // Flight mode signals for the camera + engine visuals: jetMix (0=cruise,
      // 1=jet) and a supersonic flag once we're actually past the sonic threshold.
      gameState.playerEntity.metadata.jetMix = jetMixRef.current;
      gameState.playerEntity.metadata.flightMode = flightModeRef.current;
      gameState.playerEntity.metadata.autoCruise = autoCruiseRef.current;
      gameState.playerEntity.metadata.forwardSpeed = forwardSpeedRef.current;
      const supersonic = jetMixRef.current > 0.5 && forwardSpeedRef.current > 480;
      gameState.playerEntity.metadata.supersonic = supersonic;
      // Fire a one-shot sonic-boom shockwave the moment we break into supersonic.
      if (supersonic && !wasSupersonicRef.current) {
        gameState.playerEntity.metadata.sonicBoomAt = gameState.simTime;
      }
      wasSupersonicRef.current = supersonic;
      const currentAccel = (forwardSpeedRef.current - prevForwardSpeedRef.current) / Math.max(0.0001, clampedDelta);
      const jerk = (currentAccel - prevForwardAccelRef.current) / Math.max(0.0001, clampedDelta);
      const accelKick = Math.max(0, currentAccel) / (attackMode ? 80 : 420);
      const speedJerk = Math.min(1, Math.max(0, Math.abs(jerk) / (attackMode ? 400 : 2600)));
      gameState.playerEntity.metadata.accelKick = Math.min(1, accelKick);
      gameState.playerEntity.metadata.speedJerk = speedJerk;
      // Speed is shown numerically in HUD — no drive tier labels needed.
      gameState.playerEntity.metadata.maxForwardSpeed = maxForwardSpeed;
      gameState.playerEntity.metadata.currentAccel = currentAccel;
      prevForwardSpeedRef.current = forwardSpeedRef.current;
      prevForwardAccelRef.current = currentAccel;
      gameState.playerEntity.metadata.attackMode = attackMode;
      gameState.playerEntity.metadata.flightAssistActive = assistedFlight;
      gameState.playerEntity.metadata.stopLock = stopLock;
      gameState.playerEntity.metadata.rcsYaw = smoothedInputRef.current.yaw;
      gameState.playerEntity.metadata.rcsPitch = smoothedInputRef.current.pitch;
      gameState.playerEntity.metadata.rcsRoll = smoothedInputRef.current.roll;
      gameState.playerEntity.metadata.rcsBrake = isBraking ? 1 : 0;
      gameState.playerEntity.metadata.weaponRecoil = Math.max(0, Number(gameState.playerEntity.metadata.weaponRecoil ?? 0) - clampedDelta * FIRE_RECOIL_DECAY);
      gameState.playerEntity.metadata.simpleJourneyMode = SIMPLE_JOURNEY_MODE;
      gameState.playerEntity.metadata.gravityLoad = Math.max(gravityLoad, boundaryLoad);
      gameState.playerEntity.metadata.boundaryLoad = boundaryLoad;
      gameState.playerEntity.metadata.gravityWarning = gravityWarning;
      gameState.playerEntity.metadata.nearestHazard = nearestHazard;
      gameState.playerEntity.metadata.nearestHazardDistance = Number.isFinite(nearestDist) ? Math.round(nearestDist) : 0;

      if (gameState.phase === 'exploration' || gameState.phase === 'ignition') {
        updateRouteProgress(gameState);
      }

      if (!gameState.playerEntity.metadata) {
        gameState.playerEntity.metadata = {};
      }
      const flashes = (gameState.playerEntity.metadata.muzzleFlashes ??= []) as MuzzleFlash[];
      gameState.playerEntity.metadata.muzzleFlashes = flashes.filter((flash) => flash.endTime > gameState.simTime);

      fireCooldownRef.current = Math.max(0, fireCooldownRef.current - clampedDelta);
      if (gameState.phase === 'exploration' && isFiring && fireCooldownRef.current <= 0) {
        fireCooldownRef.current = FIRE_CADENCE;
        spawnPlayerVolley(forwardLocal.clone().normalize(), rightLocal.clone().normalize(), upLocal.clone().normalize());
      }

      // Weapon status is always ready — no heat/overheat system.
    }

    // Update game logic — mutates the shared gameState object in place.
    // Three.js visuals read it directly each frame; no React state involved.
    gameLoopRef.current.update(clampedDelta);

    // Kill-confirm (all combat modes): scan fresh kill events → explosion sound
    // + a brief camera kill-punch signal (read by CameraFollowController). The
    // ImpactField/DebrisField already render the burst off the same events.
    if (gameState.events.length < lastKillScanRef.current) {
      lastKillScanRef.current = 0; // events array was reset (new wave/run)
    }
    let killsThisFrame = 0;
    let bossKilled = false;
    let bossKillPos: { x: number; y: number; z: number } | null = null;
    for (let i = lastKillScanRef.current; i < gameState.events.length; i++) {
      const ev = gameState.events[i];
      if (ev?.type !== 'entity_killed') continue;
      killsThisFrame++;
      if (typeof ev.target === 'string' && ev.target.startsWith('boss_')) {
        bossKilled = true;
        bossKillPos = ev.position ?? null;
      }
    }
    lastKillScanRef.current = gameState.events.length;
    if (killsThisFrame > 0) {
      onKill?.();
      const md = (gameState.playerEntity.metadata ??= {});
      md.killPunch = Math.min(1, Number(md.killPunch ?? 0) + 0.6 * killsThisFrame);
      // Boss death = a big, slow detonation: extra explosion sounds, a hard
      // camera punch, and a fan of synthetic kill bursts so the ImpactField/
      // DebrisField throw a large wreckage cloud at the boss's last position.
      if (bossKilled) {
        md.killPunch = 1;
        md.bossActive = false;
        onKill?.(); onKill?.();
        if (bossKillPos) {
          for (let b = 0; b < 7; b++) {
            gameState.events.push({
              type: 'entity_killed',
              source: 'boss_detonation',
              target: `boss_frag_${b}`,
              amount: 0,
              timestamp: gameState.simTime,
              position: {
                x: bossKillPos.x + (Math.random() - 0.5) * 6,
                y: bossKillPos.y + (Math.random() - 0.5) * 6,
                z: bossKillPos.z + (Math.random() - 0.5) * 6,
              },
            });
          }
          lastKillScanRef.current = gameState.events.length; // don't re-scan our own frags
        }
      }
    } else {
      const md = gameState.playerEntity.metadata;
      if (md && md.killPunch) md.killPunch = Math.max(0, Number(md.killPunch) - clampedDelta * 3);
    }

    // Low-frequency React sync: phase changes flush immediately (menus,
    // overlays), everything else repaints on the UI_SYNC_INTERVAL cadence.
    uiSyncAccumRef.current += delta;
    const phaseChanged = gameState.phase !== lastSyncedPhaseRef.current;
    if (phaseChanged || uiSyncAccumRef.current >= UI_SYNC_INTERVAL) {
      uiSyncAccumRef.current = 0;
      lastSyncedPhaseRef.current = gameState.phase;
      onUiSync();
    }

    // TODO: AI decisions via Claude API (deferred)
    // For now, enemies move using basic patterns defined in game-loop.ts
  });

  return null; // Rendering handled by entity meshes
}

function GameRenderer({ onReady }: { onReady?: () => void }) {
  // THE game state: one mutable object the simulation writes into at frame
  // rate. Three.js visuals read it inside useFrame at 60 fps. React renders
  // are decoupled — bumpUi() repaints HUD/menus at UI_SYNC_INTERVAL (~12 Hz)
  // or instantly on phase changes, and render code reads current values out
  // of this same stable object.
  const gameStateRef = useRef<GameState | null>(null);
  if (gameStateRef.current === null) {
    const s = createInitialGameState();
    // FLY-AROUND MODE: for now the game is just free-flight — skip the three-way
    // mode-select and drop straight into Exploration so we can nail the flight
    // feel first, then add combat / Deep Run / Defend back on top. Flip
    // FLY_AROUND_ONLY to false to restore the mode-select start screen.
    gameStateRef.current = FLY_AROUND_ONLY ? selectGameMode(s, 'explore') : s;
  }
  const gameState = gameStateRef.current;
  const [, bumpUi] = useReducer((c: number) => c + 1, 0);
  const [graphicsProfile, setGraphicsProfile] = useState<GraphicsProfile>(GRAPHICS_PROFILES.high);
  const [engineVolume, setEngineVolume] = useState(0.38);
  const [showTestConsole, setShowTestConsole] = useState(false);
  const [showForwardDebug, setShowForwardDebug] = useState(false);
  const [assistedFlight, setAssistedFlight] = useState(true);
  const [cameraAssist, setCameraAssist] = useState<CameraAssistLevel>('medium');
  const [weaponTune, setWeaponTune] = useState<WeaponTuningProfile>(SIMPLE_JOURNEY_MODE ? 'arcade' : 'sim');
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialIndex, setTutorialIndex] = useState(0);
  const [showControlsHelp, setShowControlsHelp] = useState(false);
  const [showSettings, setShowSettings] = useState(false); // gear-collapsed settings sheet
  // Touch-capability, resolved after mount (SSR-safe + catches iPads, which
  // report as "Mac" but have maxTouchPoints > 1). Gates the on-screen controls.
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    const ua = navigator.userAgent;
    const uaTouch = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const capTouch = (navigator.maxTouchPoints ?? 0) > 1 || 'ontouchstart' in window;
    setIsTouch(uaTouch || capTouch);
  }, []);
  const [stationExploreMode, setStationExploreMode] = useState(false);
  const [dataCores, setDataCores] = useState<DataCore[]>(() =>
    createDataCores(ROUTE_DEFINITIONS.flatMap((r) => r.waypoints))
  );
  // Deep Run: persistent meta-progression (banked salvage + upgrades) and the
  // summary of the run that just ended (shown on the Outfitting screen).
  const metaRef = useRef<MetaState>(loadMeta());
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const keysPressed = useRef<Set<string>>(new Set());
  const mouseRotationRef = useRef({ pitch: 0, yaw: 0 });
  const deviceOrientationRef = useRef({ alpha: 0, beta: 0, gamma: 0 });
  const joystickRef = useRef({ active: false, originX: 0, originY: 0, dx: 0, dy: 0 });
  // DOM handle to the joystick knob so it can follow the thumb live (a ref
  // change doesn't re-render, so the knob used to sit dead-centre — no feedback).
  const joystickKnobRef = useRef<HTMLDivElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const engineAudioRef = useRef<{
    ctx: AudioContext;
    osc: OscillatorNode;
    rumble: OscillatorNode;
    filter: BiquadFilterNode;
    gain: GainNode;
    ambienceOsc: OscillatorNode;
    ambienceSub: OscillatorNode;
    ambienceFilter: BiquadFilterNode;
    ambienceGain: GainNode;
    ambienceLfo: OscillatorNode;
    ambienceLfoGain: GainNode;
    active: boolean;
  } | null>(null);

  const tutorialMessages = SIMPLE_JOURNEY_MODE
    ? [
        'W accelerate · S brake · A/D or Arrow keys steer',
        'C auto-cruise (fly hands-free) · Tab shifts to Jet',
        'Shift boosts · Q/E roll · R recenters heading',
      ]
    : [
        'W accelerate · S brake · A/D or Arrow keys steer',
        'Shift or Space boosts · R recenters heading',
        'F toggles flight assist · H opens controls help',
        'Camera assist (Low/Medium/High) lives in the top-right panel',
        'Press X for attack foils when you want tighter turning',
      ];

  useEffect(() => {
    setGraphicsProfile(detectGraphicsProfile());
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = Number(window.localStorage.getItem(ENGINE_VOLUME_STORAGE_KEY));
    if (Number.isFinite(saved)) {
      setEngineVolume(clamp01(saved));
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(ENGINE_VOLUME_STORAGE_KEY, String(clamp01(engineVolume)));
  }, [engineVolume]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.__starCleaverGraphicsTier = graphicsProfile.tier;
  }, [graphicsProfile]);

  useEffect(() => {
    if (!shouldAutoStartExploration(gameState, IGNITION_STARTUP_DURATION)) return;
    Object.assign(gameState, startExploration(gameState));
    bumpUi();
  }, [gameState.phase, gameState.ignitionStartTime, gameState.simTime]);

  useEffect(() => {
    const canExploreStation = canInspectStation(gameState);
    if (!canExploreStation && stationExploreMode) {
      setStationExploreMode(false);
    }
  }, [gameState.phase, gameState.ignitionStartTime, stationExploreMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const key = 'star-cleaver-first-flight-v1';
    if (window.localStorage.getItem(key) === 'seen') return;
    window.localStorage.setItem(key, 'seen');
    setShowTutorial(true);

    const intervalId = window.setInterval(() => {
      setTutorialIndex((i) => (i + 1) % tutorialMessages.length);
    }, 4000);
    const timeoutId = window.setTimeout(() => {
      setShowTutorial(false);
      window.clearInterval(intervalId);
    }, 20000);

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, []);

  // Called directly from the sim when a volley fires — sample-accurate even
  // though React only repaints at UI_SYNC_INTERVAL.
  const playVolleyAudio = (pair: number) => {
    if (typeof window === 'undefined') return;
    const profile = WEAPON_TUNING[weaponTune];
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = audioContextRef.current ?? new AudioCtx();
    audioContextRef.current = ctx;
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(pair === 0 ? 820 : 740, now);
    osc.frequency.exponentialRampToValueAtTime(pair === 0 ? 360 : 330, now + 0.08);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(profile.audioGain, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

    panner.pan.setValueAtTime(pair === 0 ? -0.35 : 0.35, now);

    osc.connect(gain);
    gain.connect(panner);
    panner.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.1);
  };

  // Kill-confirm explosion: a short filtered-noise burst + a low body thump, so
  // destroying a hostile lands with a satisfying punch instead of going silent.
  const playExplosionAudio = () => {
    if (typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = audioContextRef.current ?? new AudioCtx();
    audioContextRef.current = ctx;
    if (ctx.state === 'suspended') void ctx.resume();
    const now = ctx.currentTime;

    // noise burst (the crack/debris)
    const dur = 0.34;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / data.length;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2); // decaying noise
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(2200, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(300, now + dur);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.32, now + 0.012);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    noise.connect(noiseFilter); noiseFilter.connect(noiseGain); noiseGain.connect(ctx.destination);

    // low body thump
    const thump = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(140, now);
    thump.frequency.exponentialRampToValueAtTime(46, now + 0.22);
    thumpGain.gain.setValueAtTime(0.0001, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.28, now + 0.015);
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);
    thump.connect(thumpGain); thumpGain.connect(ctx.destination);

    noise.start(now); noise.stop(now + dur);
    thump.start(now); thump.stop(now + 0.28);
  };

  useEffect(() => {
    return () => {
      const ctx = audioContextRef.current;
      if (ctx) {
        void ctx.close();
        audioContextRef.current = null;
      }
    };
  }, []);

  const resetHeadingToMission = () => {
    const layout = getMissionLayout(gameState.worldIndex);
    const toTarget = new THREE.Vector3(
      layout.stationPosition.x - gameState.playerEntity.position.x,
      layout.stationPosition.y - gameState.playerEntity.position.y,
      layout.stationPosition.z - gameState.playerEntity.position.z
    );

    if (toTarget.lengthSq() < 1e-6) {
      toTarget.set(0, 0, -1);
    } else {
      toTarget.normalize();
    }

    gameState.playerEntity.rotation.x = -Math.asin(Math.max(-1, Math.min(1, toTarget.y)));
    gameState.playerEntity.rotation.y = Math.atan2(-toTarget.x, -toTarget.z);
    gameState.playerEntity.rotation.z = 0;
    // Tell the 6-DOF flight integrator to RE-SEED its orientation quaternion from
    // this Euler next frame (otherwise the quaternion source-of-truth would just
    // overwrite the reset). Consumed + cleared in the flight loop.
    (gameState.playerEntity.metadata ??= {}).headingResetSeq =
      Number(gameState.playerEntity.metadata?.headingResetSeq ?? 0) + 1;
    bumpUi();
  };

  /**
   * Initialize continuous engine audio on first user interaction.
   */
  const initEngineAudio = () => {
    if (typeof window === 'undefined') return;
    if (engineAudioRef.current) return;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = audioContextRef.current ?? new AudioCtx();
    audioContextRef.current = ctx;
    if (ctx.state === 'suspended') void ctx.resume();

    const osc = ctx.createOscillator();
    const rumble = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    const ambienceOsc = ctx.createOscillator();
    const ambienceSub = ctx.createOscillator();
    const ambienceFilter = ctx.createBiquadFilter();
    const ambienceGain = ctx.createGain();
    const ambienceLfo = ctx.createOscillator();
    const ambienceLfoGain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.value = 46;
    rumble.type = 'sine';
    rumble.frequency.value = 24;
    ambienceOsc.type = 'triangle';
    ambienceOsc.frequency.value = 110;
    ambienceSub.type = 'sine';
    ambienceSub.frequency.value = 55;
    ambienceLfo.type = 'sine';
    ambienceLfo.frequency.value = 0.08;

    filter.type = 'lowpass';
    filter.frequency.value = 120;
    filter.Q.value = 0.35;
    ambienceFilter.type = 'lowpass';
    ambienceFilter.frequency.value = 560;
    ambienceFilter.Q.value = 0.42;

    gain.gain.value = 0.0001;
    ambienceGain.gain.value = 0.0001;
    ambienceLfoGain.gain.value = 24;

    osc.connect(filter);
    rumble.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    ambienceOsc.connect(ambienceFilter);
    ambienceSub.connect(ambienceFilter);
    ambienceFilter.connect(ambienceGain);
    ambienceGain.connect(ctx.destination);
    ambienceLfo.connect(ambienceLfoGain);
    ambienceLfoGain.connect(ambienceFilter.frequency);

    osc.start();
    rumble.start();
    ambienceOsc.start();
    ambienceSub.start();
    ambienceLfo.start();

    engineAudioRef.current = {
      ctx,
      osc,
      rumble,
      filter,
      gain,
      ambienceOsc,
      ambienceSub,
      ambienceFilter,
      ambienceGain,
      ambienceLfo,
      ambienceLfoGain,
      active: true,
    };
  };

  /**
   * Update engine audio params based on flight state.
   */
  const updateEngineAudio = (speed: number, throttle: number, boost: boolean, boostSpool: number) => {
    const audio = engineAudioRef.current;
    if (!audio || !audio.active) return;
    const now = audio.ctx.currentTime;
    const drive = Math.min(1, Math.max(0.02, throttle * 0.58 + Math.min(speed / 90, 1) * 0.34 + boostSpool * 0.22));
    const boostBlend = boost ? 0.4 + boostSpool * 0.35 : boostSpool * 0.18;
    const baseGain = 0.0052 + drive * 0.018;
    const targetGain = baseGain * engineVolume * (1 - boostBlend * 0.08);
    const ambienceGain = (0.0036 + drive * 0.0054 + boostSpool * 0.0018) * engineVolume;

    audio.osc.frequency.setTargetAtTime(46 + drive * 42 - boostBlend * 5, now, 0.16);
    audio.rumble.frequency.setTargetAtTime(24 + drive * 10 + boostBlend * 7, now, 0.16);
    audio.filter.frequency.setTargetAtTime(120 + drive * 180 - boostBlend * 28, now, 0.2);
    audio.gain.gain.setTargetAtTime(Math.max(0.0001, targetGain), now, 0.18);
    audio.ambienceOsc.frequency.setTargetAtTime(110 + drive * 26 + boostSpool * 12, now, 0.35);
    audio.ambienceSub.frequency.setTargetAtTime(55 + drive * 9 + boostSpool * 4, now, 0.38);
    audio.ambienceFilter.frequency.setTargetAtTime(540 + drive * 220 + boostSpool * 80, now, 0.45);
    audio.ambienceGain.gain.setTargetAtTime(Math.max(0.0001, ambienceGain), now, 0.3);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const unlockAudio = () => {
      initEngineAudio();
    };

    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    window.addEventListener('keydown', unlockAudio);

    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  /**
   * Handle data core collection: score reward + audio chime + HUD message.
   */
  const handleCoreCollect = (coreId: string, value: number) => {
    setDataCores((prev) => prev.map((c) => (c.id === coreId ? { ...c, collected: true } : c)));
    if (!gameState.metadata) gameState.metadata = {};
    gameState.score += value;
    gameState.metadata.routeMessage = `Data core recovered +${value}`;
    gameState.metadata.routeMessageUntil = gameState.simTime + 2.5;
    bumpUi();

    // Audio chime
    if (typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = audioContextRef.current ?? new AudioCtx();
    audioContextRef.current = ctx;
    if (ctx.state === 'suspended') void ctx.resume();

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1760, now + 0.12);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.03, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  };

  // Regenerate data cores when world changes
  useEffect(() => {
    setDataCores(createDataCores(ROUTE_DEFINITIONS.flatMap((r) => r.waypoints)));
  }, [gameState.worldIndex]);

  // Multi-input flight controls: keyboard, mouse, device orientation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current.add(e.code);
      initEngineAudio();
      // Tab shifts flight gear (Cruise↔Jet, handled in the frame loop) — stop it
      // from moving DOM focus off the game canvas.
      if (e.code === 'Tab') e.preventDefault();
      if (e.code === 'KeyX') {
        const meta = (gameState.playerEntity.metadata ??= {});
        meta.attackMode = !meta.attackMode;
        bumpUi();
      }
      // Pause / resume
      if (e.code === 'Escape' || e.code === 'KeyP') {
        e.preventDefault();
        const nextPhase = togglePausePhase(gameState.phase);
        if (nextPhase !== gameState.phase) {
          gameState.phase = nextPhase;
          bumpUi();
        }
      }
      if (e.code === 'KeyV') {
        e.preventDefault();
        setShowForwardDebug((v) => !v);
      }
      if (e.code === 'KeyF') {
        e.preventDefault();
        setAssistedFlight((v) => !v);
      }
      if (e.code === 'KeyR') {
        e.preventDefault();
        resetHeadingToMission();
      }
      if (e.code === 'KeyH' || (e.code === 'Slash' && e.shiftKey)) {
        e.preventDefault();
        setShowControlsHelp((v) => !v);
      }
      if (e.code === 'KeyE') {
        const canExploreStation = canInspectStation(gameState);
        if (canExploreStation) {
          e.preventDefault();
          setStationExploreMode((v) => !v);
        }
      }
      // Start ignition on spacebar / W, then transition to exploration when startup completes.
      if (e.code === 'Space' || e.code === 'KeyW') {
        e.preventDefault();
        if (gameState.phase === 'ignition') {
          if (typeof gameState.ignitionStartTime !== 'number') {
            Object.assign(gameState, startIgnition(gameState));
            bumpUi();
          }
        } else if (gameState.phase === 'exploration' || gameState.phase === 'charging' || gameState.phase === 'combat') {
          keysPressed.current.add('ShiftLeft');
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.code);
      if (e.code === 'Space') {
        keysPressed.current.delete('ShiftLeft');
      }
    };

    // Mouse look: map mouse position to pitch/yaw while cursor is inside canvas.
    const handleMouseMove = (e: MouseEvent) => {
      const canvasEl = canvasRef.current;
      if (!canvasEl) return;
      const rect = canvasEl.getBoundingClientRect();
      const inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
      if (!inside) {
        mouseRotationRef.current.yaw = 0;
        mouseRotationRef.current.pitch = 0;
        return;
      }

      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const mouseX = (e.clientX - centerX) / Math.max(1, rect.width / 2);
      const mouseY = (e.clientY - centerY) / Math.max(1, rect.height / 2);

      // Keep analog steering subtle; deadzone + smoothing in GameScene handles feel.
      mouseRotationRef.current.yaw = mouseX * 0.6;
      mouseRotationRef.current.pitch = -mouseY * 0.5;
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const canvasEl = canvasRef.current;
      if (!canvasEl) return;
      const rect = canvasEl.getBoundingClientRect();
      const inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
      if (!inside) return;
      keysPressed.current.add('Mouse0');
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button !== 0) return;
      keysPressed.current.delete('Mouse0');
    };

    // --- User-controllable view: right-drag to orbit the chase cam, wheel to
    // zoom. Doesn't touch steering (that's left-button / mouse-look). ---
    let orbiting = false;
    let lastX = 0;
    let lastY = 0;
    const handleContextMenu = (e: MouseEvent) => {
      // Suppress the browser menu so right-drag can orbit the camera.
      e.preventDefault();
    };
    const handleOrbitDown = (e: MouseEvent) => {
      if (e.button !== 2) return; // right button
      orbiting = true;
      cameraOrbitRef.current.active = true;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const handleOrbitMove = (e: MouseEvent) => {
      if (!orbiting) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      const o = cameraOrbitRef.current;
      o.yaw += dx * 0.005;
      o.pitch = Math.max(-1.1, Math.min(1.1, o.pitch + dy * 0.005));
    };
    const handleOrbitUp = (e: MouseEvent) => {
      if (e.button !== 2) return;
      orbiting = false;
      cameraOrbitRef.current.active = false;
    };
    const handleWheel = (e: WheelEvent) => {
      const o = cameraOrbitRef.current;
      o.zoom = Math.max(0.55, Math.min(2.4, o.zoom + (e.deltaY > 0 ? 0.12 : -0.12)));
    };

    // Device orientation for mobile: use gyroscope to fly
    const handleDeviceOrientation = (e: DeviceOrientationEvent) => {
      if (e.alpha !== null && e.beta !== null && e.gamma !== null) {
        deviceOrientationRef.current = {
          alpha: e.alpha, // rotation around Z axis (0-360)
          beta: e.beta,   // rotation around X axis (-180 to 180)
          gamma: e.gamma, // rotation around Y axis (-90 to 90)
        };
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousedown', handleOrbitDown);
    window.addEventListener('mousemove', handleOrbitMove);
    window.addEventListener('mouseup', handleOrbitUp);
    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('wheel', handleWheel, { passive: true });
    window.addEventListener('deviceorientation', handleDeviceOrientation);

    // Testing console shortcut: Ctrl+Shift+T
    const handleTestConsole = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.code === 'KeyT') {
        e.preventDefault();
        setShowTestConsole((s) => !s);
      }
    };

    // Request permission for iOS 13+
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      (DeviceOrientationEvent as any).requestPermission()
        .then((permission: string) => {
          if (permission === 'granted') {
            window.addEventListener('deviceorientation', handleDeviceOrientation);
          }
        })
        .catch(() => console.log('Device orientation permission denied'));
    }

    window.addEventListener('keydown', handleTestConsole);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousedown', handleOrbitDown);
      window.removeEventListener('mousemove', handleOrbitMove);
      window.removeEventListener('mouseup', handleOrbitUp);
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('deviceorientation', handleDeviceOrientation);
      window.removeEventListener('keydown', handleTestConsole);
    };
  }, []);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <>
        <div ref={canvasRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
          <Canvas
        dpr={graphicsProfile.dpr}
        shadows={graphicsProfile.shadows}
        camera={{ fov: 55, near: 0.1, far: 80000, position: [1.1, 2, 6.2] }}
        gl={{
          antialias: graphicsProfile.tier !== 'low',
          alpha: true,
          powerPreference: graphicsProfile.powerPreference,
        }}
        onCreated={({ gl }) => {
          gl.toneMappingExposure = graphicsProfile.toneMappingExposure;
          gl.shadowMap.enabled = graphicsProfile.shadows;
          gl.shadowMap.type = graphicsProfile.tier === 'ultra' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
        }}
      >
        <CanvasReadySignal onReady={onReady} />
        <color attach="background" args={['#030611']} />

        {/* Real Universe Engine ecosystem — same Milky Way disc, Sun, planets,
            constellations, deep-sky catalog the homepage hero renders, scaled
            up to game space so the ship can actually fly across it.
            Memoized: this subtree is huge and must not re-reconcile on the
            12 Hz HUD sync. */}
        <Suspense fallback={null}>
          {useMemo(
            () => (
              <group scale={UNIVERSE_SCALE}>
                <UniverseSceneContents
                  enableMotion
                  onHover={NOOP}
                  onResetView={NOOP}
                  interactive={false}
                  mobile={graphicsProfile.universeMobile}
                  invert={false}
                />
              </group>
            ),
            [graphicsProfile.universeMobile]
          )}
        </Suspense>
        {/* Must mount AFTER the universe so its fog override wins. */}
        <GameFog />

        {/* Backdrop: Deep Run shows the current sector's real body (a journey
            outward); Explore/Defend keep the Earth + start station. */}
        {gameState.gameMode === 'run' ? (
          <MemoSectorBackdrop sectorIndex={Number(gameState.playerEntity.metadata?.runSectorIndex ?? 0)} />
        ) : (
          <MemoMissionStartScene worldIndex={gameState.worldIndex} />
        )}

        {/* Blender-authored asteroids — stony + carbon rocks + comet nucleus.
            In Defend Earth mode they become an incoming swarm drifting toward
            Earth; otherwise an ambient orbiting belt. GLBs stream in via
            Suspense so they never block first frame; count scales by hardware. */}
        <Suspense fallback={null}>
          <AsteroidField
            count={(() => {
              const base = graphicsProfile.tier === 'ultra' ? 70 : graphicsProfile.universeMobile ? 24 : 48;
              // Deep Run: belt sectors are thick with rock, gas-giant sectors sparse.
              const dens = gameState.gameMode === 'run'
                ? sectorBackdrop(Number(gameState.playerEntity.metadata?.runSectorIndex ?? 0)).asteroidDensity
                : 1;
              return Math.round(base * dens);
            })()}
            beltRadius={260}
            beltWidth={120}
            mode={gameState.gameMode === 'defend' ? 'defend' : 'belt'}
            earthPosition={(() => {
              const l = getMissionLayout(gameState.worldIndex);
              return [l.planetPosition.x, l.planetPosition.y, l.planetPosition.z];
            })()}
          />
        </Suspense>

        {/* Scene lighting: brighter cinematic rig so the ship + space read with
            depth (was too dim/flat). Warm key + cool fill + magenta accent, plus
            a hemisphere fill to lift shadow sides off pure black. */}
        <hemisphereLight args={[0x99bbff, 0x1a1f2e, 0.55]} />
        <ambientLight intensity={0.62} color={0xffffff} />
        <directionalLight
          position={[80, 50, 60]}
          intensity={graphicsProfile.tier === 'ultra' ? 1.85 : 1.7}
          color={0xfff2e0}
          castShadow={graphicsProfile.shadows}
          shadow-mapSize-width={graphicsProfile.shadowMapSize}
          shadow-mapSize-height={graphicsProfile.shadowMapSize}
          shadow-bias={-0.00018}
        />
        <directionalLight position={[-60, 30, -40]} intensity={0.85} color={0x6aa0ff} />
        <pointLight position={[0, 5, 10]} intensity={0.7} color={0xa855f7} />

        {/* Keep near-field clear in travel mode so no large blobs sit in front of the ship. */}

        {/* Player ship: Cleaver-class */}
        {gameState.playerEntity && (
          <MemoPlayerShipGroup gameState={gameState} showForwardDebug={showForwardDebug} />
        )}

        {/* Hero key-light that rides with the ship so the player ship is always
            clearly lit no matter where it flies (fixes "ship hard to see"). */}
        {gameState.playerEntity && <ShipKeyLight gameState={gameState} />}

        {/* Enemy ships */}
        {gameState.enemies.map((enemy) => (
          <EnemyShipGroup key={enemy.id} enemy={enemy} />
        ))}

        {/* Targeting reticles — billboarded brackets on every hostile, with a
            highlighted lock + lead indicator on the nearest target. */}
        <TargetingReticles gameState={gameState} />

        {/* Projectiles: high-energy plasma bolts (instanced, sim-driven) */}
        <ProjectileField gameState={gameState} />

        {/* Cannon muzzle flashes (pooled, sim-driven) */}
        <MuzzleFlashField gameState={gameState} />

        {/* Space dust / speed lines — velocity-responsive particle field */}
        <SpaceDust gameState={gameState} count={graphicsProfile.dustCount} />

        {/* Data core collectibles at route waypoints */}
        <DataCoreField cores={dataCores} gameState={gameState} onCollect={handleCoreCollect} />

        {/* Boost shockwave ring (sim-driven) */}
        <BoostShockwave gameState={gameState} />

        {/* Combat juice: weapon-impact + kill bursts at hit points (sim-driven) */}
        <ImpactField gameState={gameState} />

        {/* Tumbling 3D wreckage chunks flung from each kill (Blender debris.glb) */}
        <Suspense fallback={null}>
          <DebrisField gameState={gameState} />
        </Suspense>

        {/* Game logic integration */}
        <GameScene
          gameState={gameState}
          onUiSync={bumpUi}
          onVolley={playVolleyAudio}
          keysPressed={keysPressed}
          mouseRotation={mouseRotationRef}
          deviceOrientation={deviceOrientationRef}
          assistedFlight={assistedFlight}
          updateEngineAudio={updateEngineAudio}
          joystickRef={joystickRef}
          metaRef={metaRef}
          onRunEnd={(summary) => {
            setRunSummary(summary);
            bumpUi();
          }}
          onKill={playExplosionAudio}
        />

        {/* Camera follow: chase the player ship */}
        <CameraFollowController gameState={gameState} cameraAssist={cameraAssist} stationExploreMode={stationExploreMode} />
      </Canvas>
        </div>

        {/* Mobile touch controls — only visible on touch devices (resolved
            post-mount so it's SSR-safe and catches iPads). */}
        {isTouch && (
          <>
            {/* Virtual joystick — bottom-left */}
            <div
              className="pointer-events-auto fixed bottom-24 left-6 z-50"
              onTouchStart={(e) => {
                e.preventDefault();
                initEngineAudio();
                const touch = e.touches[0];
                joystickRef.current = {
                  active: true,
                  originX: touch.clientX,
                  originY: touch.clientY,
                  dx: 0,
                  dy: 0,
                };
              }}
              onTouchMove={(e) => {
                e.preventDefault();
                if (!joystickRef.current.active) return;
                const touch = e.touches[0];
                const maxR = 48;
                let dx = touch.clientX - joystickRef.current.originX;
                let dy = touch.clientY - joystickRef.current.originY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > maxR) {
                  dx = (dx / dist) * maxR;
                  dy = (dy / dist) * maxR;
                }
                joystickRef.current.dx = dx;
                joystickRef.current.dy = dy;
                // Move the knob live (DOM-direct, no React re-render) so the
                // control has real tactile feedback.
                if (joystickKnobRef.current) {
                  joystickKnobRef.current.style.transform =
                    `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
                }
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                joystickRef.current = { active: false, originX: 0, originY: 0, dx: 0, dy: 0 };
                if (joystickKnobRef.current) {
                  joystickKnobRef.current.style.transform = 'translate(-50%, -50%)';
                }
              }}
            >
              <div className="relative w-28 h-28 rounded-full border border-white/15 bg-black/30 backdrop-blur-sm">
                <div
                  ref={joystickKnobRef}
                  className="absolute top-1/2 left-1/2 w-12 h-12 rounded-full bg-cyan-400/25 border border-cyan-300/50"
                  style={{ transform: 'translate(-50%, -50%)' }}
                />
              </div>
              <div className="mt-1 text-center font-mono text-[7px] tracking-widest uppercase text-white/40">
                STEER
              </div>
            </div>

            {/* Thrust button — bottom-center-left */}
            <div className="pointer-events-auto fixed bottom-24 left-1/2 -translate-x-1/2 z-50">
              <button
                type="button"
                className="w-16 h-16 rounded-full border border-white/20 bg-black/35 backdrop-blur-sm active:bg-cyan-400/20 active:border-cyan-300/50 transition-colors"
                onTouchStart={(e) => {
                  e.preventDefault();
                  initEngineAudio();
                  keysPressed.current.add('KeyW');
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  keysPressed.current.delete('KeyW');
                }}
              >
                <span className="block font-mono text-[8px] tracking-widest uppercase text-white/60 mt-1">THRUST</span>
              </button>
            </div>

            {/* Boost button — bottom-right */}
            <div className="pointer-events-auto fixed bottom-36 right-6 z-50">
              <button
                type="button"
                className="w-14 h-14 rounded-full border border-white/20 bg-black/35 backdrop-blur-sm active:bg-purple-400/20 active:border-purple-300/50 transition-colors"
                onTouchStart={(e) => {
                  e.preventDefault();
                  initEngineAudio();
                  keysPressed.current.add('ShiftLeft');
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  keysPressed.current.delete('ShiftLeft');
                }}
              >
                <span className="block font-mono text-[7px] tracking-widest uppercase text-white/60 mt-1">BOOST</span>
              </button>
            </div>

            {/* Fire button — bottom-right, above boost */}
            <div className="pointer-events-auto fixed bottom-24 right-6 z-50">
              <button
                type="button"
                className="w-14 h-14 rounded-full border border-white/20 bg-black/35 backdrop-blur-sm active:bg-red-400/20 active:border-red-300/50 transition-colors"
                onTouchStart={(e) => {
                  e.preventDefault();
                  initEngineAudio();
                  keysPressed.current.add('Mouse0');
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  keysPressed.current.delete('Mouse0');
                }}
              >
                <span className="block font-mono text-[7px] tracking-widest uppercase text-white/60 mt-1">FIRE</span>
              </button>
            </div>
          </>
        )}

        {/* Back to main site */}
        <Link
          href="/"
          className="pointer-events-auto fixed left-3 top-3 z-50 inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-black/55 px-3 py-2 backdrop-blur-sm font-mono text-[9px] uppercase tracking-[0.14em] text-white/75 hover:text-white hover:border-white/40 transition-colors"
        >
          <span aria-hidden="true">←</span>
          Back
        </Link>

        {/* Gear — collapses all settings/debug controls off the flight HUD so
            the cockpit reads clean. The dense panel only appears on demand. */}
        <button
          type="button"
          onClick={() => setShowSettings((v) => !v)}
          aria-label="Settings"
          className="pointer-events-auto fixed right-3 top-3 z-50 grid h-9 w-9 place-items-center rounded-xl border border-white/15 bg-black/40 text-white/70 backdrop-blur-sm transition-colors hover:text-white hover:border-white/35"
        >
          <span className="text-[15px] leading-none">{showSettings ? '✕' : '⚙'}</span>
        </button>

        {showSettings && (
        <div className="pointer-events-auto fixed right-3 top-14 z-50 w-[min(86vw,18rem)] rounded-2xl border border-white/12 bg-background/80 px-4 py-3.5 backdrop-blur-xl space-y-3">
          <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-foreground/50">Flight Assist</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAssistedFlight((v) => !v)}
              className={`rounded border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] ${assistedFlight ? 'border-cyan-300/60 text-cyan-200' : 'border-white/25 text-white/70'}`}
            >
              {assistedFlight ? 'On' : 'Off'} (F)
            </button>
            <button
              type="button"
              onClick={resetHeadingToMission}
              className="rounded border border-white/25 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-white/75"
            >
              Reset Heading (R)
            </button>
            <button
              type="button"
              onClick={() => {
                Object.assign(gameState, createInitialGameState());
                setDataCores(createDataCores(ROUTE_DEFINITIONS.flatMap((r) => r.waypoints)));
                bumpUi();
              }}
              className="rounded border border-white/25 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-white/75 hover:text-red-300 hover:border-red-300/40 transition-colors"
            >
              Restart
            </button>
          </div>
          <div className="mt-2 flex items-center gap-1">
            {(['low', 'medium', 'high'] as CameraAssistLevel[]).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setCameraAssist(level)}
                className={`rounded border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] ${cameraAssist === level ? 'border-cyan-300/60 text-cyan-200' : 'border-white/25 text-white/70'}`}
              >
                {level}
              </button>
            ))}
          </div>
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setShowControlsHelp((v) => !v)}
              className="rounded border border-white/25 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-white/75"
            >
              Controls Help (H)
            </button>
          </div>
          {canInspectStation(gameState) && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setStationExploreMode((v) => !v)}
                className={`rounded border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] ${stationExploreMode ? 'border-cyan-300/60 text-cyan-200' : 'border-white/25 text-white/75'}`}
              >
                {stationExploreMode ? 'Station View On' : 'Station View Off'} (E)
              </button>
            </div>
          )}
          <div className="mt-3">
            <div className="flex items-center justify-between gap-3 font-mono text-[9px] uppercase tracking-[0.16em] text-white/65">
              <span>Engine Mix</span>
              <span>{Math.round(engineVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round(engineVolume * 100)}
              onChange={(event) => {
                initEngineAudio();
                setEngineVolume(clamp01(Number(event.target.value) / 100));
              }}
              className="mt-2 block w-full accent-cyan-300"
              aria-label="Engine audio volume"
            />
          </div>
          {!SIMPLE_JOURNEY_MODE && (
            <div className="mt-2">
              <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/65">Weapon Tune</div>
              <div className="mt-1 flex items-center gap-1">
                {(['arcade', 'cinematic', 'sim'] as WeaponTuningProfile[]).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setWeaponTune(preset)}
                    className={`rounded border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] ${weaponTune === preset ? 'border-cyan-300/60 text-cyan-200' : 'border-white/25 text-white/70'}`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        )}

        {showControlsHelp && (
          <div className="pointer-events-auto fixed left-1/2 top-1/2 z-60 w-[min(92vw,34rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-cyan-200/30 bg-black/80 px-5 py-4 text-white backdrop-blur-md">
            <div className="flex items-center justify-between">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-200/85">Helion Drift Controls</div>
              <button
                type="button"
                onClick={() => setShowControlsHelp(false)}
                className="rounded border border-white/25 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-white/75"
              >
                Close
              </button>
            </div>
            <div className="mt-3 space-y-2 font-mono text-[11px] text-white/85">
              <div>Move: W accelerate, S brake, Shift or Space boost</div>
              <div>Cruise: C toggles auto-cruise (fly hands-free, just steer)</div>
              <div>Gear: Tab toggles Cruise ↔ Jet (supersonic)</div>
              <div>Steer: A/D or Arrow keys, Q/E roll, mouse for fine aim</div>
              <div>Weapons: Hold left click, J, or Enter to fire wing cannons</div>
              <div>Audio: Engine mix slider lives in the top-right panel</div>
              <div>Safety: F flight assist toggle, R reset heading</div>
              {!SIMPLE_JOURNEY_MODE && <div>Mode: X toggles cruise/attack foils</div>}
              <div>Debug: V nose marker, H toggles this panel</div>
            </div>
          </div>
        )}

        {showTutorial && (
          <div className="pointer-events-none fixed bottom-20 left-1/2 z-50 w-[min(92vw,32rem)] -translate-x-1/2 rounded-xl border border-cyan-200/25 bg-black/55 px-4 py-3 text-center backdrop-blur-sm">
            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-cyan-200/75">First Flight Guide</div>
            <div className="mt-1 text-sm text-white/85">{tutorialMessages[tutorialIndex]}</div>
          </div>
        )}

        {/* Live flight readout — only while actually flying (not in menus) */}
        {(gameState.phase === 'exploration' || gameState.phase === 'ignition' || gameState.phase === 'charging' || gameState.phase === 'firing') && (
          <FlightHud gameStateRef={gameStateRef} />
        )}

        {/* Mode-select start screen: Deep Run / Exploration / Defend Earth */}
        {gameState.phase === 'mode-select' && (
          <ModeSelect
            onSelect={(mode) => {
              Object.assign(gameState, selectGameMode(gameState, mode));
              bumpUi();
            }}
          />
        )}

        {/* Deep Run: between-runs Outfitting (spend salvage, relaunch) */}
        {gameState.phase === 'outfitting' && (
          <Outfitting
            meta={metaRef.current}
            summary={runSummary}
            onBuy={(id: UpgradeId) => {
              metaRef.current = buyUpgrade(metaRef.current, id);
              bumpUi();
            }}
            onLaunch={() => {
              // fresh run: clear the player's run state + relaunch via ignition
              if (gameState.playerEntity.metadata) {
                delete gameState.playerEntity.metadata.run;
              }
              Object.assign(gameState, selectGameMode(gameState, 'run'));
              setRunSummary(null);
              bumpUi();
            }}
            onQuit={() => {
              if (gameState.playerEntity.metadata) {
                delete gameState.playerEntity.metadata.run;
              }
              gameState.phase = 'mode-select';
              gameState.gameMode = undefined;
              setRunSummary(null);
              bumpUi();
            }}
          />
        )}

        {/* Pause Overlay */}
        {gameState.phase === 'paused' && (
          <div className="pointer-events-auto fixed inset-0 z-60 flex flex-col items-center justify-center bg-black/70 backdrop-blur-md">
            <div className="text-center space-y-8">
              <div className="font-mono text-[13px] tracking-[0.35em] uppercase text-cyan-300/90">Paused</div>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    gameState.phase = 'exploration';
                    bumpUi();
                  }}
                  className="block w-56 rounded-full border border-cyan-300/50 bg-cyan-400/10 px-6 py-3 font-mono text-[11px] uppercase tracking-[0.2em] text-cyan-200 hover:bg-cyan-400/20 transition-colors"
                >
                  Resume (Esc)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    Object.assign(gameState, createInitialGameState());
                    setDataCores(createDataCores(ROUTE_DEFINITIONS.flatMap((r) => r.waypoints)));
                    bumpUi();
                  }}
                  className="block w-56 rounded-full border border-white/25 bg-white/5 px-6 py-3 font-mono text-[11px] uppercase tracking-[0.2em] text-white/80 hover:bg-white/10 transition-colors"
                >
                  Restart Mission
                </button>
                <button
                  type="button"
                  onClick={() => setShowControlsHelp(true)}
                  className="block w-56 rounded-full border border-white/25 bg-white/5 px-6 py-3 font-mono text-[11px] uppercase tracking-[0.2em] text-white/80 hover:bg-white/10 transition-colors"
                >
                  Controls (H)
                </button>
              </div>
              <div className="font-mono text-[9px] tracking-[0.2em] uppercase text-white/50">
                Score · {formatScore(gameState.score)}
              </div>
            </div>
          </div>
        )}

        {/* HUD Layer */}
        <HUD
          gameState={gameState}
          showForwardDebug={showForwardDebug}
          waypoints={ROUTE_DEFINITIONS.flatMap((r) => r.waypoints).map((w) => ({
            position: w.position,
            label: w.label,
          }))}
        />

        {/* Testing Console (Ctrl+Shift+T) */}
        {showTestConsole && (
          <TestingConsole
            gameState={gameState}
            onStateChange={(next) => {
              Object.assign(gameState, next);
              bumpUi();
            }}
          />
        )}
      </>
    </div>
  );
}

// Live flight readout — speed, gear (Cruise/Jet), and auto-cruise state. Reads the
// player metadata each frame via its own rAF (the sim runs on refs inside the
// canvas, not React state), so the numbers track the ship without re-rendering the
// whole overlay. Kept minimal + bottom-left so it never crowds the scene.
function FlightHud({ gameStateRef }: { gameStateRef: React.RefObject<GameState | null> }) {
  const [hud, setHud] = useState({ speed: 0, ratio: 0, gear: 'cruise' as 'cruise' | 'jet', cruise: false, supersonic: false });
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const md = gameStateRef.current?.playerEntity?.metadata;
      if (md) {
        const speed = Number(md.forwardSpeed ?? 0);
        const maxV = Math.max(1, Number(md.maxForwardSpeed ?? 1));
        setHud({
          speed: Math.max(0, Math.round(speed)),
          ratio: Math.max(0, Math.min(1, speed / maxV)),
          gear: (md.flightMode as 'cruise' | 'jet') ?? 'cruise',
          cruise: Boolean(md.autoCruise),
          supersonic: Boolean(md.supersonic),
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [gameStateRef]);

  const jet = hud.gear === 'jet';
  return (
    <div className="pointer-events-none fixed bottom-6 left-6 z-50 select-none font-mono">
      <div className="flex items-end gap-2">
        <div className={`text-3xl font-semibold tabular-nums leading-none ${hud.supersonic ? 'text-orange-300' : 'text-cyan-100'}`}>
          {hud.speed}
        </div>
        <div className="mb-0.5 text-[10px] uppercase tracking-[0.2em] text-white/50">u/s</div>
      </div>
      {/* Throttle bar */}
      <div className="mt-1.5 h-1 w-40 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-[width] duration-100 ${hud.supersonic ? 'bg-orange-300' : jet ? 'bg-cyan-300' : 'bg-cyan-200/80'}`}
          style={{ width: `${Math.round(hud.ratio * 100)}%` }}
        />
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 text-[9px] uppercase tracking-[0.16em]">
        <span className={`rounded px-1.5 py-0.5 ${jet ? 'bg-orange-400/20 text-orange-200' : 'bg-cyan-400/15 text-cyan-200/80'}`}>
          {jet ? 'Jet' : 'Cruise'}
        </span>
        {hud.cruise && <span className="rounded bg-emerald-400/15 px-1.5 py-0.5 text-emerald-200/80">Auto</span>}
        {hud.supersonic && <span className="rounded bg-orange-400/20 px-1.5 py-0.5 text-orange-200">Mach</span>}
      </div>
    </div>
  );
}

export default function GameCanvas({ onReady }: GameCanvasProps) {
  return <GameRenderer onReady={onReady} />;
}
