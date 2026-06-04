'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
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
  type ActionCommand,
} from '../../../lib/neural-game-engine';
// import { createNeuralAgent, type NeuralAgent } from '../../../lib/neural-game-engine/ai-agent';
import { generateShip } from '../../../lib/ship-generator/procedural-ships';
import { createInitialGameState, startIgnition, startExploration, formatScore, IGNITION_STARTUP_DURATION } from './game-state';
import { HUD } from './hud';
import { TestingConsole } from './testing-console';
import { PlayerShipModel, ProceduralPlayerShipModel, getPlayerShipTransform } from './player-ship-model';
import type { SelectedShip } from './ship-selector';
import { getMissionLayout } from './mission-layout';
import { SpaceDust, DataCoreField, createDataCores, BoostShockwave } from './particles';
import type { DataCore } from './particles';
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
 * Game Canvas: Main React component for Star Cleaver gameplay.
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


const SHIP_THRUSTER_PRESETS: Record<SelectedShip, {
  lateral: number;
  vertical: number;
  coreZ: number;
  nozzleZ: number;
  outerNozzleZ: number;
}> = {
  // Tuned mount points for the default procedural interceptor.
  'default-vanguard': { lateral: 0.26, vertical: 0.22, coreZ: -0.78, nozzleZ: -0.98, outerNozzleZ: -1.14 },
};

/**
 * Player ship component with enhanced thruster and RCS visuals.
 */
function PlayerShipGroup({ gameState, showForwardDebug }: { gameState: GameState; showForwardDebug: boolean }) {
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
        // Tuned mount map for the default procedural hull (top-left, bottom-left, top-right, bottom-right).
        return [
          [-0.46, 0.44, -0.86] as [number, number, number],
          [-0.46, -0.20, -0.94] as [number, number, number],
          [0.46, 0.44, -0.86] as [number, number, number],
          [0.46, -0.20, -0.94] as [number, number, number],
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
        ? [-1.10, -1.20, -1.10, -1.20]
        : [thrusterPreset.nozzleZ, thrusterPreset.nozzleZ, thrusterPreset.nozzleZ, thrusterPreset.nozzleZ],
    [usingDefaultMountMap, thrusterPreset.nozzleZ]
  );
  const rearOuterNozzleZs = useMemo(
    () =>
      usingDefaultMountMap
        ? [-1.26, -1.36, -1.26, -1.36]
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
    const engineOpacity = (0.14 + driveSignal * (boostActive ? 0.31 : 0.26)) * flicker;
    const engineScale = 0.56 + driveSignal * (boostActive ? 0.54 : 0.48);
    const coreOpacity = (0.52 + driveSignal * (boostActive ? 0.17 : 0.14)) * flicker;
    const coreScale = 0.92 + driveSignal * (boostActive ? 0.24 : 0.16);

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

    const plumeLength = 0.54 + driveSignal * (boostActive ? 1.18 : 0.96);
    const plumeRadius = 0.32 + driveSignal * (boostActive ? 0.085 : 0.07);
    const plumeOpacity = (0.08 + driveSignal * (boostActive ? 0.21 : 0.17)) * flicker;
    const outerPlumeOpacity = (0.03 + driveSignal * (boostActive ? 0.14 : 0.11)) * flicker;
    const thrusterHalfLength = 0.9 * plumeLength;
    const outerHalfLength = 1.2 * plumeLength * 1.22;
    thrusterRefs.forEach((ref, idx) => {
      if (!ref.current) return;
      ref.current.scale.set(plumeRadius, plumeLength, plumeRadius);
      (ref.current.material as THREE.MeshBasicMaterial).opacity = plumeOpacity;
      // Keep the cone base fixed at the rear nozzle and extend plume rearward (-Z).
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
      const nosePulse = 0.6 + driveSignal * 0.4 + (boostActive ? 0.25 : 0);
      const noseScale = 0.9 + Math.sin(state.clock.elapsedTime * 4.2) * 0.1 + driveSignal * 0.3;
      noseGlowRef.current.scale.setScalar(noseScale);
      (noseGlowRef.current.material as THREE.MeshBasicMaterial).opacity = 0.12 * nosePulse;
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
      const pulseAmt = 0.85 + Math.sin(state.clock.elapsedTime * pulseFreq) * 0.15;
      cockpitGlowRef.current.scale.setScalar(pulseAmt * 1.15);
      (cockpitGlowRef.current.material as THREE.MeshBasicMaterial).opacity = 0.24 + driveSignal * 0.12;
      (cockpitGlowRef.current.material as THREE.MeshBasicMaterial).color.set(
        gravityVisualRef.current > 0.62 ? 0xff7d7d : 0x7fffd4
      );
    }
  });

  return (
    <group
      position={[gameState.playerEntity.position.x, gameState.playerEntity.position.y, gameState.playerEntity.position.z]}
      rotation={[gameState.playerEntity.rotation.x, gameState.playerEntity.rotation.y, gameState.playerEntity.rotation.z]}
    >
      <group ref={innerGroupRef}>
        <group scale={shipTransform.scale} position={shipTransform.position} rotation={shipTransform.rotation}>
          <Suspense fallback={<ProceduralPlayerShipModel shipId={selectedShip} mode="game" applyTransform={false} />}>
            <PlayerShipModel shipId={selectedShip} mode="game" applyTransform={false} />
          </Suspense>

          <pointLight position={[0, 0.35, 1.9]} intensity={1.9} distance={34} color={0xf3f8ff} />
          <pointLight position={[0, -0.2, -1.8]} intensity={1.45} distance={28} color={0xff9b6a} />
          <pointLight position={[0, 0.95, 0.25]} intensity={0.85} distance={20} color={0xffffff} />

          <mesh position={[0, 0.02, 0.25]}>
            <icosahedronGeometry args={[2.85, 1]} />
            <meshBasicMaterial color={0xffac80} transparent opacity={0.08} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>

          {/* Cockpit glow - subtle green-cyan */}
          <mesh ref={cockpitGlowRef} position={[0, 0.3, 1.2]}>
          <sphereGeometry args={[0.42, 10, 10]} />
          <meshBasicMaterial color={0x7fffd4} transparent opacity={0.16} />
          </mesh>

          {/* Four-engine glow (rear) - blue plasma signature */}
          <mesh ref={engineCore1Ref} position={engineMounts[0]}>
          <sphereGeometry args={[0.18, 12, 12]} />
          <meshBasicMaterial color={0xfff4d2} transparent opacity={0.72} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
          <mesh ref={engineGlow1Ref} position={engineMounts[0]}>
          <sphereGeometry args={[0.55, 8, 8]} />
          <meshBasicMaterial color={0x6ecbff} transparent opacity={0.2} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
          <mesh ref={thrusterCone1Ref} position={[engineMounts[0][0], engineMounts[0][1], initialThrusterCenters[0]]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.18, 1.8, 14, 1, true]} />
          <meshBasicMaterial color={0x8fdbff} transparent opacity={0.36} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
          <mesh ref={outerPlume1Ref} position={[engineMounts[0][0], engineMounts[0][1], initialOuterCenters[0]]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.28, 2.4, 14, 1, true]} />
          <meshBasicMaterial color={0x4c9dff} transparent opacity={0.2} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>

          <mesh ref={engineCore2Ref} position={engineMounts[1]}>
          <sphereGeometry args={[0.18, 12, 12]} />
          <meshBasicMaterial color={0xfff4d2} transparent opacity={0.72} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
          <mesh ref={engineGlow2Ref} position={engineMounts[1]}>
          <sphereGeometry args={[0.55, 8, 8]} />
          <meshBasicMaterial color={0x6ecbff} transparent opacity={0.2} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
          <mesh ref={thrusterCone2Ref} position={[engineMounts[1][0], engineMounts[1][1], initialThrusterCenters[1]]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.18, 1.8, 14, 1, true]} />
          <meshBasicMaterial color={0x8fdbff} transparent opacity={0.36} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
          <mesh ref={outerPlume2Ref} position={[engineMounts[1][0], engineMounts[1][1], initialOuterCenters[1]]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.28, 2.4, 14, 1, true]} />
          <meshBasicMaterial color={0x4c9dff} transparent opacity={0.2} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>

          <mesh ref={engineCore3Ref} position={engineMounts[2]}>
          <sphereGeometry args={[0.18, 12, 12]} />
          <meshBasicMaterial color={0xfff4d2} transparent opacity={0.72} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
          <mesh ref={engineGlow3Ref} position={engineMounts[2]}>
          <sphereGeometry args={[0.55, 8, 8]} />
          <meshBasicMaterial color={0x6ecbff} transparent opacity={0.2} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
          <mesh ref={thrusterCone3Ref} position={[engineMounts[2][0], engineMounts[2][1], initialThrusterCenters[2]]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.18, 1.8, 14, 1, true]} />
          <meshBasicMaterial color={0x8fdbff} transparent opacity={0.36} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
          <mesh ref={outerPlume3Ref} position={[engineMounts[2][0], engineMounts[2][1], initialOuterCenters[2]]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.28, 2.4, 14, 1, true]} />
          <meshBasicMaterial color={0x4c9dff} transparent opacity={0.2} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>

          <mesh ref={engineCore4Ref} position={engineMounts[3]}>
          <sphereGeometry args={[0.18, 12, 12]} />
          <meshBasicMaterial color={0xfff4d2} transparent opacity={0.72} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
          <mesh ref={engineGlow4Ref} position={engineMounts[3]}>
          <sphereGeometry args={[0.55, 8, 8]} />
          <meshBasicMaterial color={0x6ecbff} transparent opacity={0.2} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
          <mesh ref={thrusterCone4Ref} position={[engineMounts[3][0], engineMounts[3][1], initialThrusterCenters[3]]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.18, 1.8, 14, 1, true]} />
          <meshBasicMaterial color={0x8fdbff} transparent opacity={0.36} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
          <mesh ref={outerPlume4Ref} position={[engineMounts[3][0], engineMounts[3][1], initialOuterCenters[3]]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.28, 2.4, 14, 1, true]} />
          <meshBasicMaterial color={0x4c9dff} transparent opacity={0.2} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>

          {/* Nose forward glow cone — orientation marker */}
          <mesh ref={noseGlowRef} position={[0, 0.1, -2.2]} rotation={[-Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.35, 1.2, 16, 1, true]} />
            <meshBasicMaterial color={0x40d8ff} transparent opacity={0.12} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
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
            <meshBasicMaterial color={0x40d8ff} transparent opacity={0.06} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>

          {/* RCS maneuvering thrusters — front + rear for realistic attitude control */}
          {/* Front RCS */}
          <mesh ref={rcsNoseLeftRef} position={[-0.95, 0.06, 1.55]}>
            <sphereGeometry args={[0.1, 8, 8]} />
            <meshBasicMaterial color={0x9fd8ff} transparent opacity={0.02} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
          <mesh ref={rcsNoseRightRef} position={[0.95, 0.06, 1.55]}>
            <sphereGeometry args={[0.1, 8, 8]} />
            <meshBasicMaterial color={0x9fd8ff} transparent opacity={0.02} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
          <mesh ref={rcsTopRef} position={[0, 0.56, 0.55]}>
            <sphereGeometry args={[0.09, 8, 8]} />
            <meshBasicMaterial color={0x9fd8ff} transparent opacity={0.02} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
          <mesh ref={rcsBottomRef} position={[0, -0.56, 0.55]}>
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
          <mesh ref={rcsRearLeftRef} position={[-0.85, 0.06, -1.15]}>
            <sphereGeometry args={[0.1, 8, 8]} />
            <meshBasicMaterial color={0x9fd8ff} transparent opacity={0.02} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
          <mesh ref={rcsRearRightRef} position={[0.85, 0.06, -1.15]}>
            <sphereGeometry args={[0.1, 8, 8]} />
            <meshBasicMaterial color={0x9fd8ff} transparent opacity={0.02} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
          <mesh ref={rcsRearTopRef} position={[0, 0.52, -1.0]}>
            <sphereGeometry args={[0.09, 8, 8]} />
            <meshBasicMaterial color={0x9fd8ff} transparent opacity={0.02} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
          <mesh ref={rcsRearBottomRef} position={[0, -0.52, -1.0]}>
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
  );
}

/**
 * Enemy ship component: procedurally generated with engine glow.
 */
function EnemyShipGroup({ enemy }: { enemy: GameEntity }) {
  const factionClass = (enemy.metadata?.class ?? 'fighter') as any;
  const shipGroup = useMemo(() => {
    let shipFaction: 'player' | 'alien_basic' | 'alien_sniper' | 'alien_swarm' | 'boss' = 'alien_basic';
    if (factionClass === 'sniper') shipFaction = 'alien_sniper';
    else if (factionClass === 'swarm') shipFaction = 'alien_swarm';
    else if (factionClass === 'boss') shipFaction = 'boss';

    return generateShip({
      faction: shipFaction,
      class: factionClass === 'boss' ? 'destroyer' : 'fighter',
      seed: parseInt(enemy.id.replace(/\D/g, '')) || Math.random() * 1000,
      scale: enemy.radius / 0.8,
      color1: factionClass === 'boss' ? { r: 0.6, g: 0.2, b: 0.1 } : { r: 0.5, g: 0.1, b: 0.1 },
      color2: factionClass === 'boss' ? { r: 1, g: 0.3, b: 0.1 } : { r: 0.9, g: 0.2, b: 0.2 },
    });
  }, [enemy.id, factionClass]);

  // Calculate movement speed for glow intensity
  const speed = Math.sqrt(enemy.velocity.x ** 2 + enemy.velocity.y ** 2 + enemy.velocity.z ** 2);
  const glowIntensity = Math.min(speed / 10, 0.7);

  return (
    <group
      position={[enemy.position.x, enemy.position.y, enemy.position.z]}
      rotation={[enemy.rotation.x, enemy.rotation.y, enemy.rotation.z]}
    >
      <primitive object={shipGroup} />

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

function MissionStartScene({ worldIndex }: { worldIndex: number }) {
  const layout = useMemo(() => getMissionLayout(worldIndex), [worldIndex]);

  // Star Wars-inspired outpost palette — warm industrial tones
  const hull = 0x6e665c;
  const deck = 0x504b43;
  const trim = 0x8a7e6e;
  const glow = 0xff9e3d;     // warm amber
  const glowHot = 0xff6622;  // exhaust orange
  const window = 0xffcc66;   // lit windows

  return (
    <group>
      {/* Defended planet */}
      <group position={[layout.planetPosition.x, layout.planetPosition.y, layout.planetPosition.z]}>
        <mesh>
          <sphereGeometry args={[layout.planetRadius, 48, 48]} />
          <meshStandardMaterial color={layout.planetColor} roughness={0.88} metalness={0.06} />
        </mesh>
        <mesh>
          <sphereGeometry args={[layout.planetRadius * 1.05, 48, 48]} />
          <meshBasicMaterial
            color={layout.atmosphereColor}
            transparent
            opacity={0.12}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* Orbital station — Star Wars outpost style */}
      <group
        position={[layout.stationPosition.x, layout.stationPosition.y, layout.stationPosition.z]}
        scale={[layout.stationScale, layout.stationScale, layout.stationScale]}
      >
        <group rotation={[0, Math.PI * 0.12, 0]}>
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
            <mesh position={[0, 12.5, 0]}>
              <sphereGeometry args={[0.8, 8, 8]} />
              <meshBasicMaterial color={glow} transparent opacity={0.85} blending={THREE.AdditiveBlending} toneMapped={false} depthWrite={false} />
            </mesh>
            <pointLight position={[0, 12.5, 0]} intensity={2.2} distance={120} color={glow} />
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
function CameraFollowController({ gameState, cameraAssist }: { gameState: GameState; cameraAssist: CameraAssistLevel }) {
  const { camera } = useThree();
  const smoothPosRef = useRef(camera.position.clone());
  const smoothLookRef = useRef(new THREE.Vector3());

  // Dynamic offset based on phase: flight cam behind ship during ignition/exploration, wide during briefing
  const isFlightPhase = gameState.phase === 'ignition' || gameState.phase === 'exploration';
  // Camera is closer and lower for a more cinematic chase view
  const baseOffsetDistance = isFlightPhase ? 5.1 : 18;
  const baseOffsetHeight = isFlightPhase ? 1.35 : 7.5;
  // Add a slight side offset for a dynamic angle
  const baseSideOffset = isFlightPhase ? 1.1 : 0.0;

  useFrame((state, delta) => {
    const playerPos = new THREE.Vector3(
      gameState.playerEntity.position.x,
      gameState.playerEntity.position.y,
      gameState.playerEntity.position.z
    );
    const playerEuler = new THREE.Euler(
      gameState.playerEntity.rotation.x,
      gameState.playerEntity.rotation.y,
      gameState.playerEntity.rotation.z
    );
    const playerQuat = new THREE.Quaternion().setFromEuler(playerEuler);
    const forwardDir = new THREE.Vector3(0, 0, 1).applyQuaternion(playerQuat).normalize();
    const worldUp = new THREE.Vector3(0, 1, 0);
    const rightDir = new THREE.Vector3().crossVectors(forwardDir, worldUp).normalize();
    const speed = Math.sqrt(
      gameState.playerEntity.velocity.x ** 2 +
      gameState.playerEntity.velocity.y ** 2 +
      gameState.playerEntity.velocity.z ** 2
    );
    const boostSpool = Number(gameState.playerEntity.metadata?.boostSpool ?? 0);
    const accelKick = Number(gameState.playerEntity.metadata?.accelKick ?? 0);
    const speedJerk = Number(gameState.playerEntity.metadata?.speedJerk ?? 0);
    const travelStretch = Math.min(speed / 50, 1.1);

    const offsetDistance =
      baseOffsetDistance +
      travelStretch * 2.8 +
      boostSpool * 2.4 +
      accelKick * 1.1 +
      speedJerk * 2.2;
    const offsetHeight = baseOffsetHeight + travelStretch * 0.35;

    // Keep camera behind ship orientation so nose direction is always readable.
    const cloudShake = speedJerk * 0.22;
    const turbulenceSide = Math.sin(state.clock.elapsedTime * 3.4) * cloudShake;
    const turbulenceUp = Math.sin(state.clock.elapsedTime * 5.1 + 1.7) * cloudShake * 0.6;
    const jerkBacklash = Math.sin(state.clock.elapsedTime * 17.0 + 0.5) * speedJerk * 0.32;
    const desiredCameraPos = playerPos
      .clone()
      .add(forwardDir.clone().multiplyScalar(-(offsetDistance + jerkBacklash)))
      .add(rightDir.clone().multiplyScalar(baseSideOffset + turbulenceSide))
      .add(worldUp.clone().multiplyScalar(offsetHeight + turbulenceUp));

    // Ultra-smooth exponential follow: k = 1 - exp(-delta * rate)
    // Tighter and snappier during flight phases for a more responsive feel
    const assistConfig = cameraAssist === 'high'
      ? { follow: 8.1, look: 9.6, fov: 5.2 }
      : cameraAssist === 'low'
        ? { follow: 5.2, look: 6.7, fov: 3.6 }
        : { follow: 6.5, look: 8.0, fov: 4.5 };

    const followRate = isFlightPhase ? assistConfig.follow : 3.2;
    const k = 1 - Math.exp(-delta * followRate);

    smoothPosRef.current.lerp(desiredCameraPos, k);
    camera.position.copy(smoothPosRef.current);

    // Boost camera shake: high-frequency micro-jitter when boost is active
    const boostActive = Boolean(gameState.playerEntity.metadata?.boostActive);
    if (boostActive || boostSpool > 0.05) {
      const shakeIntensity = boostSpool * 0.18 + (boostActive ? 0.08 : 0);
      const t = state.clock.elapsedTime;
      camera.position.x += Math.sin(t * 47) * shakeIntensity * 0.5;
      camera.position.y += Math.sin(t * 61 + 1.3) * shakeIntensity * 0.5;
      camera.position.z += Math.sin(t * 53 + 2.7) * shakeIntensity * 0.35;
    }

    // Look slightly ahead and above the player for better anticipation and visibility
    const lookAheadDistance = Math.sqrt(
      gameState.playerEntity.velocity.x ** 2 +
      gameState.playerEntity.velocity.y ** 2 +
      gameState.playerEntity.velocity.z ** 2
    ) * 0.13;

    const lookTarget = playerPos.clone().add(new THREE.Vector3(0, 0.7, 0));
    if (lookAheadDistance > 0.1) {
      const velocityDir = new THREE.Vector3(
        gameState.playerEntity.velocity.x,
        gameState.playerEntity.velocity.y,
        gameState.playerEntity.velocity.z
      ).normalize();
      lookTarget.add(velocityDir.multiplyScalar(lookAheadDistance + boostSpool * 1.7));
    } else {
      lookTarget.add(forwardDir.clone().multiplyScalar(2.2));
    }

    const lookK = 1 - Math.exp(-delta * assistConfig.look);
    smoothLookRef.current.lerp(lookTarget, lookK);
    camera.lookAt(smoothLookRef.current);

    // Dynamic FOV gives a clear sensation of acceleration and boost.
    const targetFov =
      55 +
      Math.min(speed / 5.6, 10) +
      boostSpool * 5.5 +
      (boostActive ? 1.5 : 0) +
      speedJerk * 2.4;
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
  onUpdate,
  keysPressed,
  mouseRotation,
  deviceOrientation,
  assistedFlight,
  updateEngineAudio,
  joystickRef,
}: {
  gameState: GameState;
  onUpdate: (state: GameState) => void;
  keysPressed: React.MutableRefObject<Set<string>>;
  mouseRotation: React.MutableRefObject<{ pitch: number; yaw: number }>;
  deviceOrientation: React.MutableRefObject<{ alpha: number; beta: number; gamma: number }>;
  assistedFlight: boolean;
  updateEngineAudio?: (speed: number, throttle: number, boost: boolean, boostSpool: number) => void;
  joystickRef?: React.MutableRefObject<{ active: boolean; originX: number; originY: number; dx: number; dy: number }>;
}) {
  const { camera, scene } = useThree();
  const gameLoopRef = useRef<GameLoop | null>(null);
  const entityManagerRef = useRef<EntityManager | null>(null);
  const collisionSystemRef = useRef<CollisionSystem | null>(null);
  const enemyAgentsRef = useRef<Map<string, any>>(new Map());
  const entityMeshesRef = useRef<Map<string, THREE.Group>>(new Map());
  const frameCountRef = useRef(0);
  const forwardSpeedRef = useRef(0);
  const throttleRef = useRef(0.34);
  const boostSpoolRef = useRef(0);
  const prevForwardSpeedRef = useRef(0);
  const prevForwardAccelRef = useRef(0);
  const fireCooldownRef = useRef(0);
  const cannonCycleRef = useRef(0);
  const smoothedInputRef = useRef({ pitch: 0, yaw: 0, roll: 0 });

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
          damage: 22,
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
      entityMeshesRef.current.clear();
      enemyAgentsRef.current.clear();
    };
  }, []);

  // Travel-only mode: ensure enemy list remains empty while cruising.
  useEffect(() => {
    if (gameState.phase !== 'exploration') return;
    if (gameState.enemies.length === 0) return;
    onUpdate({ ...gameState, enemies: [] });
  }, [gameState, onUpdate]);

  // Main update loop with player input
  useFrame((state, delta) => {
    if (!gameLoopRef.current || !entityManagerRef.current) return;

    // Freeze simulation when paused
    if (gameState.phase === 'paused') return;

    // Sync loop snapshot with latest React state before sim stepping.
    gameLoopRef.current.setState(gameState);

    // Cap delta at 0.1 to prevent spiral of death
    const clampedDelta = Math.min(delta, 0.1);

    // --- FLIGHT CONTROLS: Arrow keys for rotation, W/Up for thrust ---
    if (gameState.phase === 'ignition' || gameState.phase === 'exploration' || gameState.phase === 'charging') {
      const playerQuat = new THREE.Quaternion();
      const playerEuler = new THREE.Euler(
        gameState.playerEntity.rotation.x,
        gameState.playerEntity.rotation.y,
        gameState.playerEntity.rotation.z
      );
      playerQuat.setFromEuler(playerEuler);

      // Canonical gameplay convention: ship nose points along local +Z.
      // Weapons fire along this vector; engine thrust pushes in the opposite direction.
      const forwardLocal = new THREE.Vector3(0, 0, 1).applyQuaternion(playerQuat);
      const rightLocal = new THREE.Vector3(1, 0, 0).applyQuaternion(playerQuat);
      const upLocal = new THREE.Vector3(0, 1, 0).applyQuaternion(playerQuat);

      const attackMode = Boolean(gameState.playerEntity.metadata?.attackMode);
      const turnSpeed = attackMode ? 2.1 : 1.6;
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

      const turnK = 1 - Math.exp(-clampedDelta * 10.5);
      smoothedInputRef.current.pitch += (pitchInput - smoothedInputRef.current.pitch) * turnK;
      smoothedInputRef.current.yaw += (yawInput - smoothedInputRef.current.yaw) * turnK;
      smoothedInputRef.current.roll += (rollInput - smoothedInputRef.current.roll) * turnK;

      gameState.playerEntity.rotation.x += smoothedInputRef.current.pitch * turnSpeed * clampedDelta;
      gameState.playerEntity.rotation.y += smoothedInputRef.current.yaw * turnSpeed * clampedDelta;
      gameState.playerEntity.rotation.z += smoothedInputRef.current.roll * turnSpeed * clampedDelta;

      if (assistedFlight) {
        const autoLevelK = 1 - Math.exp(-clampedDelta * 1.8);
        gameState.playerEntity.rotation.z += (0 - gameState.playerEntity.rotation.z) * autoLevelK;
        gameState.playerEntity.rotation.x += (0 - gameState.playerEntity.rotation.x) * (autoLevelK * 0.22);
      }

      const isAccelerating = !ignitionSequenceActive && keysPressed.current.has('KeyW');
      const isBraking = !ignitionSequenceActive && keysPressed.current.has('KeyS');
      const isBoosting = !ignitionSequenceActive && (keysPressed.current.has('ShiftLeft') || keysPressed.current.has('ShiftRight'));
      const isFiring = !ignitionSequenceActive && (keysPressed.current.has('Mouse0') || keysPressed.current.has('KeyJ') || keysPressed.current.has('Enter'));

      // Analog throttle model: user must actively thrust to move.
      // No auto-cruise — ship starts and stays at rest until W is pressed.
      let targetThrottle = 0;
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

      const interstellarBlend = attackMode ? 0 : Math.max(0, Math.min(1, throttleRef.current * 0.62 + boostSpoolRef.current * 0.84));
      const cruiseSpeed = attackMode ? 11 : 22 + interstellarBlend * 84;
      const maxForwardSpeed = attackMode ? 42 : 280 + interstellarBlend * 1280;
      const maxReverseSpeed = attackMode ? -14 : -21;

      const throttleSpeed =
        throttleRef.current >= 0
          ? cruiseSpeed + throttleRef.current * (maxForwardSpeed - cruiseSpeed)
          : throttleRef.current * Math.abs(maxReverseSpeed);
      const boostSpeedBonus = boostSpoolRef.current * (attackMode ? 26 : 210 + interstellarBlend * 520);
      const targetSpeed =
        throttleSpeed + (throttleRef.current > 0 ? boostSpeedBonus : 0);

      if (!Number.isFinite(forwardSpeedRef.current)) {
        forwardSpeedRef.current = 0;
      }

      const accelLimit =
        (attackMode ? 44 : 160 + interstellarBlend * 320) + boostSpoolRef.current * (attackMode ? 26 : 420);
      const decelLimit = isBraking ? (attackMode ? 78 : 94) : attackMode ? 42 : 56;
      const speedDelta = targetSpeed - forwardSpeedRef.current;
      const maxUpStep = accelLimit * clampedDelta;
      const maxDownStep = decelLimit * clampedDelta;
      if (speedDelta >= 0) {
        forwardSpeedRef.current += Math.min(speedDelta, maxUpStep);
      } else {
        forwardSpeedRef.current += Math.max(speedDelta, -maxDownStep);
      }

      // Gentle friction deceleration to zero when no thrust input
      if (!isAccelerating && !isBraking && forwardSpeedRef.current > 0) {
        forwardSpeedRef.current = Math.max(0, forwardSpeedRef.current - 8 * clampedDelta);
      }

      gameState.playerEntity.velocity.x = forwardLocal.x * forwardSpeedRef.current;
      gameState.playerEntity.velocity.y = forwardLocal.y * forwardSpeedRef.current;
      gameState.playerEntity.velocity.z = forwardLocal.z * forwardSpeedRef.current;

      // Update continuous engine audio
      updateEngineAudio?.(forwardSpeedRef.current, throttleRef.current, isBoosting, boostSpoolRef.current);

      if (assistedFlight) {
        const vel = new THREE.Vector3(
          gameState.playerEntity.velocity.x,
          gameState.playerEntity.velocity.y,
          gameState.playerEntity.velocity.z
        );
        const forwardNorm = forwardLocal.clone().normalize();
        const forwardMag = vel.dot(forwardNorm);
        const forwardComponent = forwardNorm.multiplyScalar(forwardMag);
        const lateralComponent = vel.sub(forwardComponent);
        const driftDamp = 1 - Math.exp(-clampedDelta * 2.4);
        lateralComponent.multiplyScalar(1 - driftDamp);
        const corrected = forwardComponent.add(lateralComponent);
        gameState.playerEntity.velocity.x = corrected.x;
        gameState.playerEntity.velocity.y = corrected.y;
        gameState.playerEntity.velocity.z = corrected.z;
      }

      const layout = getMissionLayout(gameState.worldIndex);
      const gravityHazards = buildGravityHazards(layout);
      const playerPosVec = new THREE.Vector3(
        gameState.playerEntity.position.x,
        gameState.playerEntity.position.y,
        gameState.playerEntity.position.z
      );
      const gravityAcceleration = new THREE.Vector3();
      let gravityLoad = 0;
      let boundaryLoad = 0;
      let hullDamageThisFrame = 0;
      let fatalSource = '';
      let nearestHazard = '';
      let nearestDist = Number.POSITIVE_INFINITY;

      gravityHazards.forEach((hazard) => {
        const deltaToHazard = hazard.position.clone().sub(playerPosVec);
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

      gameState.playerEntity.velocity.x += gravityAcceleration.x * clampedDelta;
      gameState.playerEntity.velocity.y += gravityAcceleration.y * clampedDelta;
      gameState.playerEntity.velocity.z += gravityAcceleration.z * clampedDelta;

      const distanceFromKnownCenter = playerPosVec.length();
      if (distanceFromKnownCenter > KNOWN_UNIVERSE_RADIUS) {
        const overflow = distanceFromKnownCenter - KNOWN_UNIVERSE_RADIUS;
        const outward = playerPosVec.clone().normalize();
        const inwardBrake = Math.min(280, 60 + overflow * 0.1);
        gameState.playerEntity.velocity.x -= outward.x * inwardBrake * clampedDelta;
        gameState.playerEntity.velocity.y -= outward.y * inwardBrake * clampedDelta;
        gameState.playerEntity.velocity.z -= outward.z * inwardBrake * clampedDelta;

        forwardSpeedRef.current = Math.max(cruiseSpeed * 0.25, forwardSpeedRef.current - (40 + overflow * 0.02) * clampedDelta);
        boundaryLoad = Math.min(1, overflow / 900);
        hullDamageThisFrame += (6 + boundaryLoad * 26) * clampedDelta;
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
        gameState.phase = 'defeat';
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
      const flashes = (gameState.playerEntity.metadata.muzzleFlashes ??= [] as MuzzleFlash[]);
      gameState.playerEntity.metadata.muzzleFlashes = flashes.filter((flash) => flash.endTime > gameState.simTime);

      fireCooldownRef.current = Math.max(0, fireCooldownRef.current - clampedDelta);
      if ((gameState.phase === 'exploration' || gameState.phase === 'combat') && isFiring && fireCooldownRef.current <= 0) {
        fireCooldownRef.current = FIRE_CADENCE;
        spawnPlayerVolley(forwardLocal.clone().normalize(), rightLocal.clone().normalize(), upLocal.clone().normalize());
      }

      // Weapon status is always ready — no heat/overheat system.
    }

    // Update game logic
    const updatedState = gameLoopRef.current.update(clampedDelta);
    onUpdate(updatedState);

    // Update entity positions in Three.js
    entityManagerRef.current.getAll().forEach((entity) => {
      const mesh = entityMeshesRef.current.get(entity.id);
      if (mesh) {
        mesh.position.set(entity.position.x, entity.position.y, entity.position.z);
        mesh.rotation.set(entity.rotation.x, entity.rotation.y, entity.rotation.z);
        mesh.visible = entity.active;
      }
    });

    // TODO: AI decisions via Claude API (deferred)
    // For now, enemies move using basic patterns defined in game-loop.ts
  });

  return null; // Rendering handled by entity meshes
}

function GameRenderer({ onReady }: { onReady?: () => void }) {
  const [gameState, setGameState] = useState<GameState>(createInitialGameState());
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
  const [dataCores, setDataCores] = useState<DataCore[]>(() =>
    createDataCores(ROUTE_DEFINITIONS.flatMap((r) => r.waypoints))
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const keysPressed = useRef<Set<string>>(new Set());
  const mouseRotationRef = useRef({ pitch: 0, yaw: 0 });
  const deviceOrientationRef = useRef({ alpha: 0, beta: 0, gamma: 0 });
  const joystickRef = useRef({ active: false, originX: 0, originY: 0, dx: 0, dy: 0 });
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastVolleyAudioRef = useRef<number>(-1);
  const lastCoreAudioRef = useRef<number>(-1);
  const engineAudioRef = useRef<{
    ctx: AudioContext;
    osc: OscillatorNode;
    rumble: OscillatorNode;
    filter: BiquadFilterNode;
    gain: GainNode;
    active: boolean;
  } | null>(null);

  const tutorialMessages = SIMPLE_JOURNEY_MODE
    ? [
        'W accelerate · S brake · A/D or Arrow keys steer',
        'Shift boosts · Click/J fires cannons',
        'R recenters heading · F toggles flight assist',
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
    if (gameState.phase !== 'ignition') return;
    if (typeof gameState.ignitionStartTime !== 'number') return;
    if (gameState.simTime - gameState.ignitionStartTime < IGNITION_STARTUP_DURATION) return;

    setGameState((s) => {
      if (s.phase !== 'ignition' || typeof s.ignitionStartTime !== 'number') return s;
      if (s.simTime - s.ignitionStartTime < IGNITION_STARTUP_DURATION) return s;
      return startExploration(s);
    });
  }, [gameState.phase, gameState.ignitionStartTime, gameState.simTime]);

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

  useEffect(() => {
    const volleyIndex = Number(gameState.playerEntity.metadata?.lastVolleyIndex ?? -1);
    if (volleyIndex < 0 || volleyIndex === lastVolleyAudioRef.current) return;
    lastVolleyAudioRef.current = volleyIndex;

    if (typeof window === 'undefined') return;
    const pair = Number(gameState.playerEntity.metadata?.lastVolleyPair ?? 0);
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
  }, [gameState.playerEntity.metadata?.lastVolleyIndex, gameState.playerEntity.metadata?.lastVolleyPair, weaponTune]);

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
    setGameState((s) => {
      const layout = getMissionLayout(s.worldIndex);
      const toTarget = new THREE.Vector3(
        layout.stationPosition.x - s.playerEntity.position.x,
        layout.stationPosition.y - s.playerEntity.position.y,
        layout.stationPosition.z - s.playerEntity.position.z
      );

      if (toTarget.lengthSq() < 1e-6) {
        toTarget.set(0, 0, 1);
      } else {
        toTarget.normalize();
      }

      const yaw = Math.atan2(toTarget.x, toTarget.z);
      const pitch = -Math.asin(Math.max(-1, Math.min(1, toTarget.y)));

      return {
        ...s,
        playerEntity: {
          ...s.playerEntity,
          rotation: {
            x: pitch,
            y: yaw,
            z: 0,
          },
        },
      };
    });
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

    osc.type = 'triangle';
    osc.frequency.value = 46;
    rumble.type = 'sine';
    rumble.frequency.value = 24;

    filter.type = 'lowpass';
    filter.frequency.value = 120;
    filter.Q.value = 0.35;

    gain.gain.value = 0.0001;

    osc.connect(filter);
    rumble.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    rumble.start();

    engineAudioRef.current = { ctx, osc, rumble, filter, gain, active: true };
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
    const baseGain = 0.0022 + drive * 0.0056;
    const targetGain = baseGain * engineVolume * (1 - boostBlend * 0.08);

    audio.osc.frequency.setTargetAtTime(46 + drive * 42 - boostBlend * 5, now, 0.16);
    audio.rumble.frequency.setTargetAtTime(24 + drive * 10 + boostBlend * 7, now, 0.16);
    audio.filter.frequency.setTargetAtTime(120 + drive * 180 - boostBlend * 28, now, 0.2);
    audio.gain.gain.setTargetAtTime(Math.max(0.0001, targetGain), now, 0.18);
  };

  /**
   * Handle data core collection: score reward + audio chime + HUD message.
   */
  const handleCoreCollect = (coreId: string, value: number) => {
    setDataCores((prev) => prev.map((c) => (c.id === coreId ? { ...c, collected: true } : c)));
    setGameState((s) => {
      if (!s.metadata) s.metadata = {};
      const nextScore = s.score + value;
      s.metadata.routeMessage = `Data core recovered +${value}`;
      s.metadata.routeMessageUntil = s.simTime + 2.5;
      return { ...s, score: nextScore };
    });

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
      if (e.code === 'KeyX') {
        setGameState((s) => {
          const current = Boolean(s.playerEntity.metadata?.attackMode);
          return {
            ...s,
            playerEntity: {
              ...s.playerEntity,
              metadata: {
                ...(s.playerEntity.metadata ?? {}),
                attackMode: !current,
              },
            },
          };
        });
      }
      // Pause / resume
      if (e.code === 'Escape' || e.code === 'KeyP') {
        e.preventDefault();
        setGameState((s) => {
          if (s.phase === 'paused') {
            return { ...s, phase: 'exploration' };
          }
          if (s.phase === 'exploration' || s.phase === 'ignition' || s.phase === 'combat' || s.phase === 'charging') {
            return { ...s, phase: 'paused' };
          }
          return s;
        });
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
      // Start ignition on spacebar / W, then transition to exploration when startup completes.
      if (e.code === 'Space' || e.code === 'KeyW') {
        e.preventDefault();
        setGameState((s) => {
          if (s.phase === 'ignition') {
            if (typeof s.ignitionStartTime === 'number') {
              return s;
            }
            return startIgnition(s);
          }
          if (s.phase === 'exploration' || s.phase === 'charging' || s.phase === 'combat') {
            keysPressed.current.add('ShiftLeft');
          }
          return s;
        });
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
            up to game space so the ship can actually fly across it. */}
        <Suspense fallback={null}>
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
        </Suspense>
        {/* Must mount AFTER the universe so its fog override wins. */}
        <GameFog />

        {/* Selected mission world + floating orbital station start point. */}
        <MissionStartScene worldIndex={gameState.worldIndex} />

        {/* Scene lighting: cinematic + directional for exploring universe */}
        <ambientLight intensity={0.4} color={0xffffff} />
        <directionalLight
          position={[80, 50, 60]}
          intensity={graphicsProfile.tier === 'ultra' ? 1.08 : 1.0}
          color={0xffffff}
          castShadow={graphicsProfile.shadows}
          shadow-mapSize-width={graphicsProfile.shadowMapSize}
          shadow-mapSize-height={graphicsProfile.shadowMapSize}
          shadow-bias={-0.00018}
        />
        <directionalLight position={[-60, 30, -40]} intensity={0.5} color={0x3b82f6} />
        <pointLight position={[0, 5, 10]} intensity={0.6} color={0xa855f7} />

        {/* Keep near-field clear in travel mode so no large blobs sit in front of the ship. */}

        {/* Player ship: Cleaver-class */}
        {gameState.playerEntity && (
          <PlayerShipGroup gameState={gameState} showForwardDebug={showForwardDebug} />
        )}

        {/* Enemy ships */}
        {gameState.enemies.map((enemy) => (
          <EnemyShipGroup key={enemy.id} enemy={enemy} />
        ))}

        {/* Projectiles: high-energy plasma bolts */}
        {gameState.projectiles.map((proj) => (
          (() => {
            const v = new THREE.Vector3(proj.velocity.x, proj.velocity.y, proj.velocity.z);
            const dir = v.lengthSq() > 1e-6 ? v.clone().normalize() : new THREE.Vector3(0, 0, 1);
            const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
            const rot = new THREE.Euler().setFromQuaternion(q);
            const isWingCannon = proj.metadata?.source === 'wing-cannon';
            const boltColor = isWingCannon ? 0x9de8ff : 0xffff00;
            const haloColor = isWingCannon ? 0x52c9ff : 0xffcc00;
            const age = Math.max(0, gameState.simTime - Number(proj.metadata?.bornAt ?? gameState.simTime));
            const pulse = 0.9 + Math.sin(age * 34) * 0.08;

            return (
              <group
                key={proj.id}
                position={[proj.position.x, proj.position.y, proj.position.z]}
                rotation={[rot.x, rot.y, rot.z]}
              >
                {/* Tracer core */}
                <mesh scale={[pulse, pulse, pulse]}>
                  <capsuleGeometry args={[0.08, 1.55, 8, 16]} />
                  <meshBasicMaterial color={boltColor} transparent opacity={0.95} toneMapped={false} />
                </mesh>
                {/* Plasma halo */}
                <mesh scale={[pulse, pulse, pulse]}>
                  <capsuleGeometry args={[0.16, 2.1, 6, 12]} />
                  <meshBasicMaterial color={haloColor} transparent opacity={0.32} blending={THREE.AdditiveBlending} toneMapped={false} depthWrite={false} />
                </mesh>
              </group>
            );
          })()
        ))}

        {/* Cannon muzzle flashes */}
        {((gameState.playerEntity.metadata?.muzzleFlashes as MuzzleFlash[] | undefined) ?? []).map((flash) => {
          const life = Math.max(0, (flash.endTime - gameState.simTime) / 0.085);
          const outerOpacity = 0.45 * life;
          const coreOpacity = 0.9 * life;
          return (
            <group key={flash.id} position={[flash.position.x, flash.position.y, flash.position.z]}>
              <mesh>
                <sphereGeometry args={[0.22, 10, 10]} />
                <meshBasicMaterial color={0xd8f5ff} transparent opacity={coreOpacity} blending={THREE.AdditiveBlending} toneMapped={false} depthWrite={false} />
              </mesh>
              <mesh>
                <sphereGeometry args={[0.48, 10, 10]} />
                <meshBasicMaterial color={0x4fc8ff} transparent opacity={outerOpacity} blending={THREE.AdditiveBlending} toneMapped={false} depthWrite={false} />
              </mesh>
            </group>
          );
        })}

        {/* Space dust / speed lines — velocity-responsive particle field */}
        <SpaceDust gameState={gameState} count={graphicsProfile.dustCount} />

        {/* Data core collectibles at route waypoints */}
        <DataCoreField cores={dataCores} gameState={gameState} onCollect={handleCoreCollect} />

        {/* Boost shockwave ring */}
        <BoostShockwave
          active={Boolean(gameState.playerEntity.metadata?.boostActive)}
          position={[
            gameState.playerEntity.position.x,
            gameState.playerEntity.position.y,
            gameState.playerEntity.position.z,
          ]}
        />

        {/* Game logic integration */}
        <GameScene
          gameState={gameState}
          onUpdate={setGameState}
          keysPressed={keysPressed}
          mouseRotation={mouseRotationRef}
          deviceOrientation={deviceOrientationRef}
          assistedFlight={assistedFlight}
          weaponTune={weaponTune}
          updateEngineAudio={updateEngineAudio}
          joystickRef={joystickRef}
        />

        {/* Camera follow: chase the player ship */}
        <CameraFollowController gameState={gameState} cameraAssist={cameraAssist} />
      </Canvas>
        </div>

        {/* Mobile touch controls — only visible on touch devices */}
        {typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) && (
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
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                joystickRef.current = { active: false, originX: 0, originY: 0, dx: 0, dy: 0 };
              }}
            >
              <div className="relative w-28 h-28 rounded-full border border-white/15 bg-black/30 backdrop-blur-sm">
                <div
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-cyan-400/20 border border-cyan-300/40 transition-transform duration-75"
                  style={{
                    transform: `translate(calc(-50% + ${joystickRef.current.dx * 0.6}px), calc(-50% + ${joystickRef.current.dy * 0.6}px))`,
                  }}
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
        <a
          href="/"
          className="pointer-events-auto fixed left-3 top-3 z-50 inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-black/55 px-3 py-2 backdrop-blur-sm font-mono text-[9px] uppercase tracking-[0.14em] text-white/75 hover:text-white hover:border-white/40 transition-colors"
        >
          <span aria-hidden="true">←</span>
          Back
        </a>

        <div className="pointer-events-auto fixed right-3 top-3 z-50 rounded-xl border border-white/20 bg-black/55 px-3 py-2 backdrop-blur-sm">
          <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/70">Flight Assist</div>
          <div className="mt-2 flex items-center gap-2">
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
                setGameState(createInitialGameState());
                setDataCores(createDataCores(ROUTE_DEFINITIONS.flatMap((r) => r.waypoints)));
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

        {showControlsHelp && (
          <div className="pointer-events-auto fixed left-1/2 top-1/2 z-60 w-[min(92vw,34rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-cyan-200/30 bg-black/80 px-5 py-4 text-white backdrop-blur-md">
            <div className="flex items-center justify-between">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-200/85">Star Cleaver Controls</div>
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

        {/* Pause Overlay */}
        {gameState.phase === 'paused' && (
          <div className="pointer-events-auto fixed inset-0 z-60 flex flex-col items-center justify-center bg-black/70 backdrop-blur-md">
            <div className="text-center space-y-8">
              <div className="font-mono text-[13px] tracking-[0.35em] uppercase text-cyan-300/90">Paused</div>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setGameState((s) => ({ ...s, phase: 'exploration' }))}
                  className="block w-56 rounded-full border border-cyan-300/50 bg-cyan-400/10 px-6 py-3 font-mono text-[11px] uppercase tracking-[0.2em] text-cyan-200 hover:bg-cyan-400/20 transition-colors"
                >
                  Resume (Esc)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGameState(createInitialGameState());
                    setDataCores(createDataCores(ROUTE_DEFINITIONS.flatMap((r) => r.waypoints)));
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
        {showTestConsole && <TestingConsole gameState={gameState} onStateChange={setGameState} />}
      </>
    </div>
  );
}

export default function GameCanvas({ onGameEnd, onPhaseChange, onReady }: GameCanvasProps) {
  return <GameRenderer onReady={onReady} />;
}
