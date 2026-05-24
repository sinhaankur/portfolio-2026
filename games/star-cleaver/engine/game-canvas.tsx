'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { useEffect, useRef, useState, useMemo } from 'react';
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
import { createEnemy } from './enemies';
import { createInitialGameState, setWorld, startCombat, fireWeapon as fireWeaponState } from './game-state';
import { defendedWorlds, getWaveConfig } from './worlds';
import { HUD } from './hud';

/**
 * Game Canvas: Main React component for Star Cleaver gameplay.
 * Integrates Universe Engine rendering with Neural Game Engine logic.
 */

interface GameCanvasProps {
  onGameEnd?: (state: GameState) => void;
  onPhaseChange?: (phase: GameState['phase']) => void;
}

/**
 * Player ship component: X-wing with enhanced visuals.
 */
function PlayerShipGroup({ gameState }: { gameState: GameState }) {
  const gltf = useGLTF('/models/rebels_x-wing_starfighter.glb');
  const trailRef = useRef<THREE.Line>(null);
  const trailPointsRef = useRef<THREE.Vector3[]>([]);

  // Create a memoized clone with enhanced materials
  const shipModel = useMemo(() => {
    if (!gltf.scene) return null;
    const clone = gltf.scene.clone(true);
    clone.scale.set(2, 2, 2);
    clone.rotateZ(Math.PI / 2);

    // Enhance all materials with better metallic properties
    clone.traverse((child: any) => {
      if (child.isMesh && child.material) {
        child.material.metalness = Math.max(child.material.metalness ?? 0.5, 0.6);
        child.material.roughness = Math.min(child.material.roughness ?? 0.5, 0.4);
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    return clone;
  }, [gltf.scene]);

  // Update engine trail
  useFrame(() => {
    const speed = Math.sqrt(
      gameState.playerEntity.velocity.x ** 2 +
      gameState.playerEntity.velocity.y ** 2 +
      gameState.playerEntity.velocity.z ** 2
    );

    if (speed > 0.5 && trailRef.current) {
      // Add trail point
      const pos = new THREE.Vector3(
        gameState.playerEntity.position.x,
        gameState.playerEntity.position.y,
        gameState.playerEntity.position.z - 2 // Behind ship
      );
      trailPointsRef.current.push(pos);

      // Keep only last 30 points
      if (trailPointsRef.current.length > 30) {
        trailPointsRef.current.shift();
      }

      // Update geometry
      if (trailRef.current.geometry) {
        (trailRef.current.geometry as THREE.BufferGeometry).setFromPoints(trailPointsRef.current);
      }
    }
  });

  return (
    <group
      position={[gameState.playerEntity.position.x, gameState.playerEntity.position.y, gameState.playerEntity.position.z]}
      rotation={[gameState.playerEntity.rotation.x, gameState.playerEntity.rotation.y, gameState.playerEntity.rotation.z]}
    >
      {shipModel ? (
        <primitive object={shipModel} />
      ) : (
        <mesh>
          <coneGeometry args={[0.8, 3, 8]} />
          <meshStandardMaterial color={0x6600ff} emissive={0x3300ff} emissiveIntensity={0.3} />
        </mesh>
      )}

      {/* Cockpit glow */}
      <mesh position={[0, 0.3, 1.2]}>
        <sphereGeometry args={[0.3, 8, 8]} />
        <meshBasicMaterial color={0x00ff88} emissive={0x00ff88} toneMapped={false} />
      </mesh>

      {/* Weapon pod highlights */}
      <mesh position={[-0.8, 0, 0.5]}>
        <sphereGeometry args={[0.15, 6, 6]} />
        <meshBasicMaterial color={0xffaa00} emissive={0xff8800} opacity={0.7} transparent toneMapped={false} />
      </mesh>
      <mesh position={[0.8, 0, 0.5]}>
        <sphereGeometry args={[0.15, 6, 6]} />
        <meshBasicMaterial color={0xffaa00} emissive={0xff8800} opacity={0.7} transparent toneMapped={false} />
      </mesh>

      {/* Engine thrust trail */}
      <line ref={trailRef}>
        <bufferGeometry />
        <lineBasicMaterial color={0x00ffff} linewidth={2} transparent opacity={0.7} />
      </line>

      {/* Dual engine glow (rear) */}
      <mesh position={[-0.4, 0, -2.8]}>
        <sphereGeometry args={[0.5, 8, 8]} />
        <meshBasicMaterial color={0x00ffff} transparent opacity={0.5} toneMapped={false} />
      </mesh>
      <mesh position={[0.4, 0, -2.8]}>
        <sphereGeometry args={[0.5, 8, 8]} />
        <meshBasicMaterial color={0x00ffff} transparent opacity={0.5} toneMapped={false} />
      </mesh>

      {/* Energy shield pulse */}
      <mesh position={[0, 0, 0]} scale={[1 + Math.sin(gameState.simTime * 3) * 0.1, 1 + Math.sin(gameState.simTime * 3) * 0.1, 1 + Math.sin(gameState.simTime * 3) * 0.1]}>
        <icosahedronGeometry args={[2.5, 1]} />
        <meshBasicMaterial color={0x0099ff} wireframe transparent opacity={0.15} toneMapped={false} />
      </mesh>
    </group>
  );
}

/**
 * Enemy ship component: procedurally generated with engine glow.
 */
function EnemyShipGroup({ enemy }: { enemy: GameEntity }) {
  const faction = (enemy.metadata?.class ?? 'fighter') as any;
  const shipGroup = useMemo(() => {
    return generateShip({
      faction: faction === 'ship' ? 'alien_basic' : `alien_${faction}`,
      seed: parseInt(enemy.id.replace(/\D/g, '')) || Math.random() * 1000,
      scale: enemy.radius / 0.8,
      color1: faction === 'boss' ? { r: 0.6, g: 0.2, b: 0.1 } : { r: 0.5, g: 0.1, b: 0.1 },
      color2: faction === 'boss' ? { r: 1, g: 0.3, b: 0.1 } : { r: 0.9, g: 0.2, b: 0.2 },
    });
  }, [enemy.id, faction]);

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
          color={faction === 'boss' ? 0xff6600 : 0xff3333}
          transparent
          opacity={0.3 + glowIntensity}
        />
      </mesh>
    </group>
  );
}

/**
 * Camera follow controller: smooth chase cam like following a comet in Universe Engine.
 */
function CameraFollowController({ gameState }: { gameState: GameState }) {
  const { camera } = useThree();
  const cameraVelRef = useRef(new THREE.Vector3());
  const lookVelRef = useRef(new THREE.Vector3());

  // Dynamic offset based on phase (closer during combat, further during briefing)
  const offsetDistance = gameState.phase === 'combat' ? 12 : 18;
  const offsetHeight = gameState.phase === 'combat' ? 6 : 8;

  useFrame((state, delta) => {
    const playerPos = new THREE.Vector3(
      gameState.playerEntity.position.x,
      gameState.playerEntity.position.y,
      gameState.playerEntity.position.z
    );

    // Calculate desired camera position (behind and above player)
    const cameraOffset = new THREE.Vector3(0, offsetHeight, offsetDistance);
    const desiredCameraPos = playerPos.clone().add(cameraOffset);

    // Smooth velocity-based following (more natural than direct lerp)
    const cameraToTarget = desiredCameraPos.clone().sub(camera.position);
    const distance = cameraToTarget.length();

    if (distance > 0.01) {
      // Exponential smoothing for silky motion
      const followSpeed = Math.min(distance * delta * 3, distance);
      camera.position.add(cameraToTarget.normalize().multiplyScalar(followSpeed));
    }

    // Smooth look-at with slight lag for elegance
    const lookTarget = playerPos.clone();
    const lookOffset = lookTarget.clone().sub(camera.position);
    const currentForward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const blend = Math.min(delta * 2, 1);

    camera.position.add(lookOffset.clone().multiplyScalar((1 - blend) * delta * 0.5));
    camera.lookAt(playerPos);
  });

  return null;
}

function GameScene({ gameState, onUpdate }: { gameState: GameState; onUpdate: (state: GameState) => void }) {
  const { camera, scene } = useThree();
  const gameLoopRef = useRef<GameLoop | null>(null);
  const entityManagerRef = useRef<EntityManager | null>(null);
  const collisionSystemRef = useRef<CollisionSystem | null>(null);
  const enemyAgentsRef = useRef<Map<string, NeuralAgent>>(new Map());
  const entityMeshesRef = useRef<Map<string, THREE.Group>>(new Map());
  const frameCountRef = useRef(0);

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

  // Spawn enemies when entering combat
  useEffect(() => {
    if (gameState.phase !== 'combat' || gameState.enemies.length > 0) return;

    const waveConfig = getWaveConfig(gameState.worldIndex, gameState.wave);
    const difficulty = 1 + gameState.wave * 0.3 + gameState.worldIndex * 0.15;
    const totalEnemies = Math.ceil(waveConfig.baseEnemyCount * difficulty);

    for (let i = 0; i < totalEnemies; i++) {
      const enemyType = waveConfig.enemyTypes[Math.floor(Math.random() * waveConfig.enemyTypes.length)];
      // Spawn enemies spread around in a larger space (chasing through universe)
      const angle = (i / totalEnemies) * Math.PI * 2;
      const distance = 60 + Math.random() * 40;
      const position = {
        x: Math.cos(angle) * distance,
        y: (Math.random() - 0.5) * 30,
        z: Math.sin(angle) * distance + 50,
      };

      const enemyFactory = createEnemy(enemyType.type, `enemy_${i}`, position);
      const enemy = enemyFactory.entity;

      if (entityManagerRef.current) {
        entityManagerRef.current.register(enemy);
        gameState.enemies.push(enemy);

        // TODO: Create AI agent for this enemy (deferred)
        // const aiAgent = createNeuralAgent(enemyFactory.agentId, enemyType.type);
        // enemyAgentsRef.current.set(enemy.id, aiAgent);
      }
    }
  }, [gameState.phase, gameState.wave, gameState.worldIndex]);

  // Main update loop
  useFrame((state, delta) => {
    if (!gameLoopRef.current || !entityManagerRef.current) return;

    // Cap delta at 0.1 to prevent spiral of death
    const clampedDelta = Math.min(delta, 0.1);

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
  const containerRef = useRef<HTMLDivElement>(null);
  const mousePos = useRef({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  // Mouse aiming: convert mouse position to 3D aim direction
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      mousePos.current = {
        x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
        y: -((e.clientY - rect.top) / rect.height) * 2 + 1,
      };
    };

    // Mouse down: start charging
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        // Left click
        setGameState((s) => {
          if (s.phase === 'combat') {
            return { ...s, phase: 'charging' };
          } else if (s.phase === 'briefing') {
            return startCombat(s);
          }
          return s;
        });
      }
    };

    // Mouse up: fire
    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        setGameState((s) => {
          if (s.phase === 'charging') {
            return fireWeaponState(s);
          }
          return s;
        });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      {/* Import HUD */}
      <div ref={canvasRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
        <Canvas
        camera={{ fov: 55, near: 0.1, far: 2000, position: [0, 8, 25] }}
        gl={{
          antialias: true,
          alpha: true,
          toneMappingExposure: 1.0,
        }}
      >
        <color attach="background" args={['#000000']} />
        <fog attach="fog" args={['#000000', 200, 500]} />

        {/* Scene lighting */}
        <ambientLight intensity={0.3} />
        <directionalLight position={[60, 40, 50]} intensity={0.8} />
        <directionalLight position={[-40, 20, -30]} intensity={0.4} color={0x2563eb} />
        <pointLight position={[0, 5, 10]} intensity={0.4} color={0x9933ff} />

        {/* Defending planet (Earth as default) */}
        <mesh position={[0, 0, -20]}>
          <sphereGeometry args={[10, 64, 64]} />
          <meshStandardMaterial
            color={0x2563eb}
            emissive={0x1e40af}
            emissiveIntensity={0.1}
            metalness={0.1}
            roughness={0.8}
          />
        </mesh>

        {/* Player ship: Cleaver-class */}
        {gameState.playerEntity && (
          <PlayerShipGroup gameState={gameState} />
        )}

        {/* Enemy ships */}
        {gameState.enemies.map((enemy) => (
          <EnemyShipGroup key={enemy.id} enemy={enemy} />
        ))}

        {/* Projectiles */}
        {gameState.projectiles.map((proj) => (
          <group
            key={proj.id}
            position={[proj.position.x, proj.position.y, proj.position.z]}
          >
            <mesh>
              <sphereGeometry args={[0.3, 12, 12]} />
              <meshBasicMaterial color={0xffff00} toneMapped={false} />
            </mesh>
            <mesh>
              <sphereGeometry args={[0.6, 8, 8]} />
              <meshBasicMaterial color={0xffff00} transparent opacity={0.2} toneMapped={false} />
            </mesh>
          </group>
        ))}

        {/* Game logic integration */}
        <GameScene gameState={gameState} onUpdate={setGameState} />

        {/* Camera follow: chase the player ship */}
        <CameraFollowController gameState={gameState} />
      </Canvas>
      </div>
      {/* HUD Layer */}
      <HUD gameState={gameState} />
    </div>
  );
}

export default function GameCanvas({ onGameEnd, onPhaseChange }: GameCanvasProps) {
  return <GameRenderer />;
}
