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
import { createInitialGameState, startOpening, goToNexus, selectWorld, startIgnition, startExploration } from './game-state';
import { HUD } from './hud';
import { Starfield } from './starfield';
import { TestingConsole } from './testing-console';
import { OpeningSequence } from './opening-sequence';
import { NexusStation } from './nexus-station';
import { PlayerShipModel, ProceduralPlayerShipModel, getPlayerShipTransform } from './player-ship-model';
import type { SelectedShip } from './ship-selector';

/**
 * Game Canvas: Main React component for Star Cleaver gameplay.
 * Integrates Universe Engine rendering with Neural Game Engine logic.
 */

interface GameCanvasProps {
  onGameEnd?: (state: GameState) => void;
  onPhaseChange?: (phase: GameState['phase']) => void;
}

const GAS_CLOUD_FIELDS = [
  { position: [-260, 70, -520] as [number, number, number], radius: 170, density: 0.62, color: 0x6a96ff },
  { position: [320, -40, -780] as [number, number, number], radius: 220, density: 0.58, color: 0x87b7ff },
  { position: [40, 120, -1050] as [number, number, number], radius: 260, density: 0.5, color: 0x5a88db },
  { position: [-420, -120, -1320] as [number, number, number], radius: 300, density: 0.44, color: 0x7ab5ff },
];

const SHIP_THRUSTER_PRESETS: Record<SelectedShip, {
  lateral: number;
  vertical: number;
  coreZ: number;
  nozzleZ: number;
  outerNozzleZ: number;
}> = {
  'default-xwing': { lateral: 1.24, vertical: 0.58, coreZ: -2.65, nozzleZ: -2.95, outerNozzleZ: -3.02 },
  'alliance-xwing': { lateral: 1.3, vertical: 0.6, coreZ: -2.78, nozzleZ: -3.08, outerNozzleZ: -3.16 },
  't70-xwing': { lateral: 1.36, vertical: 0.64, coreZ: -2.95, nozzleZ: -3.27, outerNozzleZ: -3.35 },
  'x-blade': { lateral: 1.44, vertical: 0.7, coreZ: -3.08, nozzleZ: -3.42, outerNozzleZ: -3.5 },
};

/**
 * Player ship component: X-wing with enhanced visuals.
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
  const cockpitGlowRef = useRef<THREE.Mesh>(null);
  const visualBankRef = useRef(0);
  const thrusterRefs = useMemo(() => [thrusterCone1Ref, thrusterCone2Ref, thrusterCone3Ref, thrusterCone4Ref], []);
  const outerPlumeRefs = useMemo(() => [outerPlume1Ref, outerPlume2Ref, outerPlume3Ref, outerPlume4Ref], []);
  const selectedShip = (gameState.selectedShip || 'default-xwing') as SelectedShip;
  const shipTransform = useMemo(() => getPlayerShipTransform(selectedShip, 'game'), [selectedShip]);
  const thrusterPreset = SHIP_THRUSTER_PRESETS[selectedShip] ?? SHIP_THRUSTER_PRESETS['default-xwing'];
  const engineMounts = useMemo(
    () => [
      [-thrusterPreset.lateral, thrusterPreset.vertical, thrusterPreset.coreZ] as [number, number, number],
      [-thrusterPreset.lateral, -thrusterPreset.vertical, thrusterPreset.coreZ] as [number, number, number],
      [thrusterPreset.lateral, thrusterPreset.vertical, thrusterPreset.coreZ] as [number, number, number],
      [thrusterPreset.lateral, -thrusterPreset.vertical, thrusterPreset.coreZ] as [number, number, number],
    ],
    [thrusterPreset]
  );
  const initialPlumeLength = 1.05;
  const initialThrusterCenterZ = thrusterPreset.nozzleZ + 0.9 * initialPlumeLength;
  const initialOuterCenterZ = thrusterPreset.outerNozzleZ + 1.2 * initialPlumeLength * 1.22;

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
    if (innerGroupRef.current) {
      innerGroupRef.current.rotation.z = visualBankRef.current;
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
    const engineOpacity = (0.24 + driveSignal * (boostActive ? 0.56 : 0.42)) * flicker;
    const engineScale = 0.62 + driveSignal * (boostActive ? 0.86 : 0.64);
    const coreOpacity = (0.66 + driveSignal * (boostActive ? 0.28 : 0.2)) * flicker;
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

    const plumeLength = 1.05 + driveSignal * (boostActive ? 4.8 : 3.2);
    const plumeRadius = 0.84 + driveSignal * (boostActive ? 0.32 : 0.2);
    const plumeOpacity = (0.18 + driveSignal * (boostActive ? 0.6 : 0.4)) * flicker;
    const outerPlumeOpacity = (0.08 + driveSignal * (boostActive ? 0.42 : 0.26)) * flicker;
    const thrusterHalfLength = 0.9 * plumeLength;
    const outerHalfLength = 1.2 * plumeLength * 1.22;
    const rearNozzleZ = thrusterPreset.nozzleZ;
    const rearOuterNozzleZ = thrusterPreset.outerNozzleZ;

    thrusterRefs.forEach(ref => {
      if (!ref.current) return;
      ref.current.scale.set(plumeRadius, plumeLength, plumeRadius);
      (ref.current.material as THREE.MeshBasicMaterial).opacity = plumeOpacity;
      // Keep the cone base fixed at the rear nozzle and extend plume rearward as it scales.
      ref.current.position.z = rearNozzleZ + thrusterHalfLength;
    });

    outerPlumeRefs.forEach(ref => {
      if (!ref.current) return;
      ref.current.scale.set(plumeRadius * 1.5, plumeLength * 1.22, plumeRadius * 1.5);
      (ref.current.material as THREE.MeshBasicMaterial).opacity = outerPlumeOpacity;
      ref.current.position.z = rearOuterNozzleZ + outerHalfLength;
    });

    // RCS maneuvering thrusters for orientation/position hold.
    const rcsYaw = Number(gameState.playerEntity.metadata?.rcsYaw ?? 0);
    const rcsPitch = Number(gameState.playerEntity.metadata?.rcsPitch ?? 0);
    const rcsRoll = Number(gameState.playerEntity.metadata?.rcsRoll ?? 0);
    const rcsBrake = Number(gameState.playerEntity.metadata?.rcsBrake ?? 0);
    const yawStrength = Math.min(1, Math.abs(rcsYaw) * 22);
    const pitchStrength = Math.min(1, Math.abs(rcsPitch) * 22);
    const rollStrength = Math.min(1, Math.abs(rcsRoll) * 22);

    const noseLeftOpacity = 0.05 + (rcsYaw < 0 ? yawStrength * 0.7 : 0) + rcsBrake * 0.24;
    const noseRightOpacity = 0.05 + (rcsYaw > 0 ? yawStrength * 0.7 : 0) + rcsBrake * 0.24;
    const topOpacity = 0.04 + (rcsPitch < 0 ? pitchStrength * 0.78 : 0);
    const bottomOpacity = 0.04 + (rcsPitch > 0 ? pitchStrength * 0.78 : 0);
    const wingLeftOpacity = 0.04 + (rcsRoll > 0 ? rollStrength * 0.72 : 0);
    const wingRightOpacity = 0.04 + (rcsRoll < 0 ? rollStrength * 0.72 : 0);

    if (rcsNoseLeftRef.current) (rcsNoseLeftRef.current.material as THREE.MeshBasicMaterial).opacity = noseLeftOpacity;
    if (rcsNoseRightRef.current) (rcsNoseRightRef.current.material as THREE.MeshBasicMaterial).opacity = noseRightOpacity;
    if (rcsTopRef.current) (rcsTopRef.current.material as THREE.MeshBasicMaterial).opacity = topOpacity;
    if (rcsBottomRef.current) (rcsBottomRef.current.material as THREE.MeshBasicMaterial).opacity = bottomOpacity;
    if (rcsWingLeftRef.current) (rcsWingLeftRef.current.material as THREE.MeshBasicMaterial).opacity = wingLeftOpacity;
    if (rcsWingRightRef.current) (rcsWingRightRef.current.material as THREE.MeshBasicMaterial).opacity = wingRightOpacity;

    // Cockpit glow pulses faster when boosting
    if (cockpitGlowRef.current) {
      const pulseFreq = 1.5 + driveSignal * (boostActive ? 5.0 : 3.0);
      const pulseAmt = 0.85 + Math.sin(state.clock.elapsedTime * pulseFreq) * 0.15;
      cockpitGlowRef.current.scale.setScalar(pulseAmt);
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
          <mesh ref={thrusterCone1Ref} position={[engineMounts[0][0], engineMounts[0][1], initialThrusterCenterZ]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.18, 1.8, 14, 1, true]} />
          <meshBasicMaterial color={0x8fdbff} transparent opacity={0.36} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
          <mesh ref={outerPlume1Ref} position={[engineMounts[0][0], engineMounts[0][1], initialOuterCenterZ]} rotation={[Math.PI / 2, 0, 0]}>
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
          <mesh ref={thrusterCone2Ref} position={[engineMounts[1][0], engineMounts[1][1], initialThrusterCenterZ]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.18, 1.8, 14, 1, true]} />
          <meshBasicMaterial color={0x8fdbff} transparent opacity={0.36} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
          <mesh ref={outerPlume2Ref} position={[engineMounts[1][0], engineMounts[1][1], initialOuterCenterZ]} rotation={[Math.PI / 2, 0, 0]}>
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
          <mesh ref={thrusterCone3Ref} position={[engineMounts[2][0], engineMounts[2][1], initialThrusterCenterZ]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.18, 1.8, 14, 1, true]} />
          <meshBasicMaterial color={0x8fdbff} transparent opacity={0.36} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
          <mesh ref={outerPlume3Ref} position={[engineMounts[2][0], engineMounts[2][1], initialOuterCenterZ]} rotation={[Math.PI / 2, 0, 0]}>
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
          <mesh ref={thrusterCone4Ref} position={[engineMounts[3][0], engineMounts[3][1], initialThrusterCenterZ]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.18, 1.8, 14, 1, true]} />
          <meshBasicMaterial color={0x8fdbff} transparent opacity={0.36} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
          <mesh ref={outerPlume4Ref} position={[engineMounts[3][0], engineMounts[3][1], initialOuterCenterZ]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.28, 2.4, 14, 1, true]} />
          <meshBasicMaterial color={0x4c9dff} transparent opacity={0.2} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>

          {/* RCS maneuvering thrusters (attitude + position correction) */}
          <mesh ref={rcsNoseLeftRef} position={[-0.95, 0.06, 1.55]}>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshBasicMaterial color={0x9fd8ff} transparent opacity={0.05} depthWrite={false} />
          </mesh>
          <mesh ref={rcsNoseRightRef} position={[0.95, 0.06, 1.55]}>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshBasicMaterial color={0x9fd8ff} transparent opacity={0.05} depthWrite={false} />
          </mesh>
          <mesh ref={rcsTopRef} position={[0, 0.56, 0.55]}>
          <sphereGeometry args={[0.09, 8, 8]} />
          <meshBasicMaterial color={0xaee5ff} transparent opacity={0.04} depthWrite={false} />
          </mesh>
          <mesh ref={rcsBottomRef} position={[0, -0.56, 0.55]}>
          <sphereGeometry args={[0.09, 8, 8]} />
          <meshBasicMaterial color={0xaee5ff} transparent opacity={0.04} depthWrite={false} />
          </mesh>
          <mesh ref={rcsWingLeftRef} position={[-1.35, 0, -0.22]}>
          <sphereGeometry args={[0.09, 8, 8]} />
          <meshBasicMaterial color={0xb7e9ff} transparent opacity={0.04} depthWrite={false} />
          </mesh>
          <mesh ref={rcsWingRightRef} position={[1.35, 0, -0.22]}>
          <sphereGeometry args={[0.09, 8, 8]} />
          <meshBasicMaterial color={0xb7e9ff} transparent opacity={0.04} depthWrite={false} />
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

/**
 * Camera follow controller: smooth chase cam like following a comet in Universe Engine.
 * Uses exponential smoothing for silk-smooth, responsive flight feel.
 */
function CameraFollowController({ gameState }: { gameState: GameState }) {
  const { camera } = useThree();
  const smoothPosRef = useRef(camera.position.clone());
  const smoothLookRef = useRef(new THREE.Vector3());

  // Dynamic offset based on phase: flight cam behind ship during ignition/exploration, wide during briefing
  const isFlightPhase = gameState.phase === 'ignition' || gameState.phase === 'exploration';
  const baseOffsetDistance = isFlightPhase ? 8 : 20;
  const baseOffsetHeight = isFlightPhase ? 2.5 : 9;

  useFrame((state, delta) => {
    const playerPos = new THREE.Vector3(
      gameState.playerEntity.position.x,
      gameState.playerEntity.position.y,
      gameState.playerEntity.position.z
    );
    const speed = Math.sqrt(
      gameState.playerEntity.velocity.x ** 2 +
      gameState.playerEntity.velocity.y ** 2 +
      gameState.playerEntity.velocity.z ** 2
    );
    const boostSpool = Number(gameState.playerEntity.metadata?.boostSpool ?? 0);
    const cloudDensity = Number(gameState.playerEntity.metadata?.gasCloudDensity ?? 0);
    const accelKick = Number(gameState.playerEntity.metadata?.accelKick ?? 0);
    const travelStretch = Math.min(speed / 50, 1.1);

    const offsetDistance = baseOffsetDistance + travelStretch * 2.8 + boostSpool * 2.4 + accelKick * 1.1;
    const offsetHeight = baseOffsetHeight + travelStretch * 0.35;

    // Calculate desired camera position (behind and above player for exploration view)
    const cloudShake = cloudDensity * (0.12 + boostSpool * 0.12);
    const turbulenceX = Math.sin(state.clock.elapsedTime * 3.4) * cloudShake;
    const turbulenceY = Math.sin(state.clock.elapsedTime * 5.1 + 1.7) * cloudShake * 0.6;
    const cameraOffset = new THREE.Vector3(turbulenceX, offsetHeight + turbulenceY, offsetDistance);
    const desiredCameraPos = playerPos.clone().add(cameraOffset);

    // Ultra-smooth exponential follow: k = 1 - exp(-delta * rate)
    // Tighter during flight phases for responsive cockpit view
    const followRate = isFlightPhase ? 4.5 : 2.8;
    const k = 1 - Math.exp(-delta * followRate);

    smoothPosRef.current.lerp(desiredCameraPos, k);
    camera.position.copy(smoothPosRef.current);

    // Look slightly ahead of player for better anticipation
    const lookAheadDistance = Math.sqrt(
      gameState.playerEntity.velocity.x ** 2 +
      gameState.playerEntity.velocity.y ** 2 +
      gameState.playerEntity.velocity.z ** 2
    ) * 0.1;

    const lookTarget = playerPos.clone();
    if (lookAheadDistance > 0.1) {
      const velocityDir = new THREE.Vector3(
        gameState.playerEntity.velocity.x,
        gameState.playerEntity.velocity.y,
        gameState.playerEntity.velocity.z
      ).normalize();
      lookTarget.add(velocityDir.multiplyScalar(lookAheadDistance + boostSpool * 1.4));
    }

    const lookK = 1 - Math.exp(-delta * 8.0);
    smoothLookRef.current.lerp(lookTarget, lookK);
    camera.lookAt(smoothLookRef.current);

    // Dynamic FOV gives a clear sensation of acceleration and boost.
    const boostActive = Boolean(gameState.playerEntity.metadata?.boostActive);
    const targetFov =
      55 +
      Math.min(speed / 5.6, 10) +
      boostSpool * 5.5 +
      (boostActive ? 1.5 : 0) +
      cloudDensity * 1.25;
    const currentFov = (camera as THREE.PerspectiveCamera).fov ?? 55;
    const fovK = 1 - Math.exp(-delta * 4.5);
    const nextFov = currentFov + (targetFov - currentFov) * fovK;
    if (Math.abs(nextFov - currentFov) > 0.02) {
      (camera as THREE.PerspectiveCamera).fov = nextFov;
      (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
    }
  });

  return null;
}

function GameScene({
  gameState,
  onUpdate,
  keysPressed,
  mouseRotation,
  deviceOrientation,
}: {
  gameState: GameState;
  onUpdate: (state: GameState) => void;
  keysPressed: React.MutableRefObject<Set<string>>;
  mouseRotation: React.MutableRefObject<{ pitch: number; yaw: number }>;
  deviceOrientation: React.MutableRefObject<{ alpha: number; beta: number; gamma: number }>;
}) {
  const { camera, scene } = useThree();
  const gameLoopRef = useRef<GameLoop | null>(null);
  const entityManagerRef = useRef<EntityManager | null>(null);
  const collisionSystemRef = useRef<CollisionSystem | null>(null);
  const enemyAgentsRef = useRef<Map<string, any>>(new Map());
  const entityMeshesRef = useRef<Map<string, THREE.Group>>(new Map());
  const frameCountRef = useRef(0);
  const forwardSpeedRef = useRef(14);
  const throttleRef = useRef(0.34);
  const boostSpoolRef = useRef(0);
  const prevForwardSpeedRef = useRef(14);

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

      // The imported ship mesh faces -Z in gameplay orientation.
      // Use local -Z as thrust-forward so W moves toward the pointy nose.
      const forwardLocal = new THREE.Vector3(0, 0, -1).applyQuaternion(playerQuat);

      const attackMode = Boolean(gameState.playerEntity.metadata?.attackMode);
      const arrowSensitivity = attackMode ? 0.065 : 0.045;
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      let pitchDelta = 0;
      let yawDelta = 0;
      let rollDelta = 0;

      if (keysPressed.current.has('ArrowUp')) pitchDelta += arrowSensitivity;
      if (keysPressed.current.has('ArrowDown')) pitchDelta -= arrowSensitivity;
      if (keysPressed.current.has('ArrowLeft')) yawDelta += arrowSensitivity;
      if (keysPressed.current.has('ArrowRight')) yawDelta -= arrowSensitivity;
      if (keysPressed.current.has('KeyQ')) rollDelta += arrowSensitivity;
      if (keysPressed.current.has('KeyE')) rollDelta -= arrowSensitivity;

      if (!isMobile) {
        const mouseSensitivity = attackMode ? 0.018 : 0.013;
        pitchDelta += mouseRotation.current.pitch * mouseSensitivity;
        yawDelta += mouseRotation.current.yaw * mouseSensitivity;
      }

      if (isMobile && deviceOrientation.current.beta !== 0) {
        const deviceSensitivity = attackMode ? 0.009 : 0.007;
        pitchDelta += (deviceOrientation.current.beta / 180) * deviceSensitivity * 2;
        yawDelta -= (deviceOrientation.current.gamma / 90) * deviceSensitivity * 2;
        rollDelta += (deviceOrientation.current.alpha / 360) * deviceSensitivity * 0.5;
      }

      gameState.playerEntity.rotation.x += pitchDelta;
      gameState.playerEntity.rotation.y += yawDelta;
      gameState.playerEntity.rotation.z += rollDelta;

      const isAccelerating = keysPressed.current.has('KeyW') || keysPressed.current.has('ArrowUp');
      const isBraking = keysPressed.current.has('KeyS') || keysPressed.current.has('ArrowDown');
      const isBoosting = keysPressed.current.has('ShiftLeft') || keysPressed.current.has('ShiftRight');

      const px = gameState.playerEntity.position.x;
      const py = gameState.playerEntity.position.y;
      const pz = gameState.playerEntity.position.z;
      let gasCloudDensity = 0;
      GAS_CLOUD_FIELDS.forEach((cloud) => {
        const dx = px - cloud.position[0];
        const dy = py - cloud.position[1];
        const dz = pz - cloud.position[2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist >= cloud.radius) return;
        const normalized = 1 - dist / cloud.radius;
        gasCloudDensity += normalized * normalized * cloud.density;
      });
      gasCloudDensity = Math.min(1, gasCloudDensity);

      // Analog throttle model: engines spool up/down instead of instant speed snapping.
      const cruiseThrottle = attackMode ? 0.26 : 0.34;
      let targetThrottle = cruiseThrottle;
      if (isAccelerating) targetThrottle = 1.0;
      if (isBraking) targetThrottle = -0.5;

      const throttleResponse =
        targetThrottle > throttleRef.current
          ? (isBoosting ? 4.2 : attackMode ? 3.7 : 3.3)
          : (isBraking ? 6.4 : 4.9);
      const throttleK = 1 - Math.exp(-clampedDelta * throttleResponse);
      throttleRef.current += (targetThrottle - throttleRef.current) * throttleK;

      const boostTarget = isBoosting && throttleRef.current > 0.05 ? 1 : 0;
      const boostResponse = boostTarget > boostSpoolRef.current ? 5.4 : 7.4;
      const boostK = 1 - Math.exp(-clampedDelta * boostResponse);
      boostSpoolRef.current += (boostTarget - boostSpoolRef.current) * boostK;

      const cruiseSpeed = attackMode ? 11 : 16;
      const maxForwardSpeed = attackMode ? 33 : 48;
      const maxReverseSpeed = attackMode ? -14 : -21;

      const throttleSpeed =
        throttleRef.current >= 0
          ? cruiseSpeed + throttleRef.current * (maxForwardSpeed - cruiseSpeed)
          : throttleRef.current * Math.abs(maxReverseSpeed);
      const boostSpeedBonus = boostSpoolRef.current * (attackMode ? 16 : 24);
      const cloudSpeedPenalty = gasCloudDensity * (attackMode ? 5.5 : 8.5);
      const targetSpeed =
        throttleSpeed + (throttleRef.current > 0 ? boostSpeedBonus : 0) - (throttleRef.current > 0 ? cloudSpeedPenalty : 0);

      if (!Number.isFinite(forwardSpeedRef.current)) {
        forwardSpeedRef.current = cruiseSpeed;
      }

      const accelLimit = ((attackMode ? 34 : 48) + boostSpoolRef.current * (attackMode ? 22 : 34)) * (1 - gasCloudDensity * 0.28);
      const decelLimit = isBraking ? (attackMode ? 78 : 94) : attackMode ? 42 : 56;
      const speedDelta = targetSpeed - forwardSpeedRef.current;
      const maxUpStep = accelLimit * clampedDelta;
      const maxDownStep = decelLimit * clampedDelta;
      if (speedDelta >= 0) {
        forwardSpeedRef.current += Math.min(speedDelta, maxUpStep);
      } else {
        forwardSpeedRef.current += Math.max(speedDelta, -maxDownStep);
      }

      if (!isAccelerating && !isBraking && forwardSpeedRef.current < cruiseSpeed) {
        forwardSpeedRef.current = Math.max(forwardSpeedRef.current, cruiseSpeed);
      }

      gameState.playerEntity.velocity.x = forwardLocal.x * forwardSpeedRef.current;
      gameState.playerEntity.velocity.y = forwardLocal.y * forwardSpeedRef.current;
      gameState.playerEntity.velocity.z = forwardLocal.z * forwardSpeedRef.current;

      if (gasCloudDensity > 0.02) {
        const localRight = new THREE.Vector3(1, 0, 0).applyQuaternion(playerQuat);
        const localUp = new THREE.Vector3(0, 1, 0).applyQuaternion(playerQuat);
        const turbulence = gasCloudDensity * (attackMode ? 0.8 : 1.15);
        const wobbleA = Math.sin(state.clock.elapsedTime * 2.6 + px * 0.0023) * turbulence;
        const wobbleB = Math.sin(state.clock.elapsedTime * 4.1 + pz * 0.0017) * turbulence;
        gameState.playerEntity.velocity.x += (localRight.x * wobbleA + localUp.x * wobbleB) * clampedDelta * 6;
        gameState.playerEntity.velocity.y += (localRight.y * wobbleA + localUp.y * wobbleB) * clampedDelta * 6;
        gameState.playerEntity.velocity.z += (localRight.z * wobbleA + localUp.z * wobbleB) * clampedDelta * 6;
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
      gameState.playerEntity.metadata.gasCloudDensity = gasCloudDensity;
      const accelKick = Math.max(0, forwardSpeedRef.current - prevForwardSpeedRef.current) / Math.max(0.0001, clampedDelta * 42);
      gameState.playerEntity.metadata.accelKick = Math.min(1, accelKick);
      prevForwardSpeedRef.current = forwardSpeedRef.current;
      gameState.playerEntity.metadata.attackMode = attackMode;
      gameState.playerEntity.metadata.rcsYaw = yawDelta;
      gameState.playerEntity.metadata.rcsPitch = pitchDelta;
      gameState.playerEntity.metadata.rcsRoll = rollDelta;
      gameState.playerEntity.metadata.rcsBrake = isBraking ? 1 : 0;
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

function GameRenderer() {
  const [gameState, setGameState] = useState<GameState>(createInitialGameState());
  const [showTestConsole, setShowTestConsole] = useState(false);
  const [showForwardDebug, setShowForwardDebug] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const keysPressed = useRef<Set<string>>(new Set());
  const mouseRotationRef = useRef({ pitch: 0, yaw: 0 });
  const deviceOrientationRef = useRef({ alpha: 0, beta: 0, gamma: 0 });

  // Guardrail: if ignition timer completes but phase did not flip for any reason,
  // force transition to exploration so it never appears frozen on countdown.
  useEffect(() => {
    if (gameState.phase !== 'ignition') return;
    const elapsed = gameState.simTime - (gameState.ignitionStartTime ?? 0);
    if (elapsed <= 3.05) return;
    setGameState((s) => (s.phase === 'ignition' ? startExploration(s) : s));
  }, [gameState.phase, gameState.simTime, gameState.ignitionStartTime]);

  // Multi-input flight controls: keyboard, mouse, device orientation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current.add(e.code);
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
      if (e.code === 'KeyV') {
        e.preventDefault();
        setShowForwardDebug((v) => !v);
      }
      // Start ignition on spacebar
      if (e.code === 'Space') {
        e.preventDefault();
        setGameState((s) => {
          if (s.phase === 'briefing') {
            return startIgnition(s);
          }
          if (s.phase === 'ignition') {
            const elapsedSinceIgnition = s.simTime - (s.ignitionStartTime ?? 0);
            if (elapsedSinceIgnition > 3.0) {
              return startExploration(s);
            }
          }
          return s;
        });
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.code);
    };

    // Mouse look: map mouse position to pitch/yaw for aiming
    const handleMouseMove = (e: MouseEvent) => {
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      const mouseX = (e.clientX - centerX) / centerX;
      const mouseY = (e.clientY - centerY) / centerY;

      // Convert mouse position to rotation (±0.3 radians = ±17°)
      mouseRotationRef.current.yaw = mouseX * 0.4;
      mouseRotationRef.current.pitch = -mouseY * 0.3;
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
      window.removeEventListener('deviceorientation', handleDeviceOrientation);
      window.removeEventListener('keydown', handleTestConsole);
    };
  }, []);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      {/* Opening Sequence */}
      {gameState.phase === 'opening' && (
        <OpeningSequence onComplete={() => setGameState((s) => goToNexus(s))} />
      )}

      {/* Nexus Station Command Center */}
      {gameState.phase === 'nexus' && (
        <NexusStation
          gameState={gameState}
          onLaunchMission={(worldIndex, shipId) => setGameState((s) => startIgnition({
            ...selectWorld(s, worldIndex),
            selectedShip: shipId,
          }))}
        />
      )}

      {/* Game Canvas (hidden during opening/nexus) */}
      {gameState.phase !== 'opening' && gameState.phase !== 'nexus' && (
        <>
        <div ref={canvasRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
          <Canvas
        camera={{ fov: 55, near: 0.1, far: 6000, position: [0, 8, 25] }}
        gl={{
          antialias: true,
          alpha: true,
          toneMappingExposure: 1.0,
        }}
      >
        <color attach="background" args={['#040816']} />
        <fog attach="fog" args={['#040816', 1800, 5400]} />

        {/* Starfield backdrop for universe exploration feeling */}
        <Starfield gasClouds={GAS_CLOUD_FIELDS} />

        {/* Scene lighting: cinematic + directional for exploring universe */}
        <ambientLight intensity={0.4} color={0xffffff} />
        <directionalLight position={[80, 50, 60]} intensity={1.0} color={0xffffff} castShadow />
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
          <group
            key={proj.id}
            position={[proj.position.x, proj.position.y, proj.position.z]}
          >
            {/* Core bolt */}
            <mesh>
              <sphereGeometry args={[0.25, 12, 12]} />
              <meshBasicMaterial color={0xffff00} />
            </mesh>
            {/* Energy halo */}
            <mesh>
              <sphereGeometry args={[0.5, 8, 8]} />
              <meshBasicMaterial color={0xffcc00} transparent opacity={0.4} />
            </mesh>
            {/* Outer glow */}
            <mesh>
              <sphereGeometry args={[0.9, 6, 6]} />
              <meshBasicMaterial color={0xffaa00} transparent opacity={0.15} />
            </mesh>
          </group>
        ))}

        {/* Game logic integration */}
        <GameScene
          gameState={gameState}
          onUpdate={setGameState}
          keysPressed={keysPressed}
          mouseRotation={mouseRotationRef}
          deviceOrientation={deviceOrientationRef}
        />

        {/* Camera follow: chase the player ship */}
        <CameraFollowController gameState={gameState} />
      </Canvas>
        </div>

        {/* HUD Layer */}
        <HUD
          gameState={gameState}
          showForwardDebug={showForwardDebug}
          onShipSelect={(shipId) => {
            setGameState((s) => ({ ...s, selectedShip: shipId }));
          }}
        />

        {/* Testing Console (Ctrl+Shift+T) */}
        {showTestConsole && <TestingConsole gameState={gameState} onStateChange={setGameState} />}
        </>
      )}
    </div>
  );
}

export default function GameCanvas({ onGameEnd, onPhaseChange }: GameCanvasProps) {
  return <GameRenderer />;
}
