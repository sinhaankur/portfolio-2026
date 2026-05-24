'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, Preload } from '@react-three/drei';
import { useEffect, useRef, useState, useMemo, Suspense } from 'react';
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
import { Starfield } from './starfield';

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
  const innerGroupRef = useRef<THREE.Group>(null);
  const engineGlow1Ref = useRef<THREE.Mesh>(null);
  const engineGlow2Ref = useRef<THREE.Mesh>(null);
  const cockpitGlowRef = useRef<THREE.Mesh>(null);
  const visualBankRef = useRef(0);

  // Create a memoized clone with basic setup
  const shipModel = useMemo(() => {
    if (!gltf.scene) return null;
    const clone = gltf.scene.clone(true);
    clone.scale.set(2, 2, 2);
    clone.rotateZ(Math.PI / 2);

    // Basic setup: enable shadows, don't modify materials to avoid shader issues
    clone.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    return clone;
  }, [gltf.scene]);

  // Update engine trail, visual banking, and responsive glow
  useFrame((state, delta) => {
    const vx = gameState.playerEntity.velocity.x;
    const vy = gameState.playerEntity.velocity.y;
    const vz = gameState.playerEntity.velocity.z;
    const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);

    // Trail animation
    if (speed > 0.5 && trailRef.current) {
      const pos = new THREE.Vector3(
        gameState.playerEntity.position.x,
        gameState.playerEntity.position.y,
        gameState.playerEntity.position.z - 2
      );
      trailPointsRef.current.push(pos);

      if (trailPointsRef.current.length > 30) {
        trailPointsRef.current.shift();
      }

      if (trailRef.current.geometry) {
        (trailRef.current.geometry as THREE.BufferGeometry).setFromPoints(trailPointsRef.current);
      }
    }

    // Visual banking from lateral velocity
    const targetBank = Math.max(-0.35, Math.min(0.35, -vx * 0.018));
    const bankK = 1 - Math.exp(-delta * 4.5);
    visualBankRef.current += (targetBank - visualBankRef.current) * bankK;
    if (innerGroupRef.current) {
      innerGroupRef.current.rotation.z = visualBankRef.current;
    }

    // Velocity-responsive engine glow brightness and scale
    const normalizedSpeed = Math.min(speed / 25, 1.0);
    const engineOpacity = 0.3 + normalizedSpeed * 0.55;
    const engineScale = 0.7 + normalizedSpeed * 0.9;

    [engineGlow1Ref, engineGlow2Ref].forEach(ref => {
      if (!ref.current) return;
      (ref.current.material as THREE.MeshBasicMaterial).opacity = engineOpacity;
      ref.current.scale.setScalar(engineScale);
    });

    // Cockpit glow pulses faster when boosting
    if (cockpitGlowRef.current) {
      const pulseFreq = 1.5 + normalizedSpeed * 3.0;
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
        {shipModel ? (
          <primitive object={shipModel} />
        ) : (
          <mesh>
            <coneGeometry args={[2, 4, 8]} />
            <meshStandardMaterial color={0xff00ff} emissive={0xff00ff} emissiveIntensity={1} />
          </mesh>
        )}

        {/* Cockpit glow - bright green-cyan */}
        <mesh position={[0, 0.3, 1.2]}>
          <sphereGeometry args={[0.4, 12, 12]} />
          <meshBasicMaterial color={0x00ff99} />
        </mesh>
        <mesh ref={cockpitGlowRef} position={[0, 0.3, 1.2]}>
          <sphereGeometry args={[0.65, 8, 8]} />
          <meshBasicMaterial color={0x00ff99} transparent opacity={0.2} />
        </mesh>

        {/* Weapon pod highlights - orange hot glow */}
        <mesh position={[-0.8, 0, 0.5]}>
          <sphereGeometry args={[0.2, 8, 8]} />
          <meshBasicMaterial color={0xff6600} />
        </mesh>
        <mesh position={[-0.8, 0, 0.5]}>
          <sphereGeometry args={[0.4, 6, 6]} />
          <meshBasicMaterial color={0xff8833} transparent opacity={0.25} />
        </mesh>
        <mesh position={[0.8, 0, 0.5]}>
          <sphereGeometry args={[0.2, 8, 8]} />
          <meshBasicMaterial color={0xff6600} />
        </mesh>
        <mesh position={[0.8, 0, 0.5]}>
          <sphereGeometry args={[0.4, 6, 6]} />
          <meshBasicMaterial color={0xff8833} transparent opacity={0.25} />
        </mesh>

        {/* Engine thrust trail */}
        <line ref={trailRef}>
          <bufferGeometry />
          <lineBasicMaterial color={0x00ffff} linewidth={3} transparent opacity={0.8} />
        </line>

        {/* Dual engine glow (rear) - cyan hot plasma */}
        <mesh position={[-0.4, 0, -2.8]}>
          <sphereGeometry args={[0.6, 10, 10]} />
          <meshBasicMaterial color={0x00ffff} transparent opacity={0.6} />
        </mesh>
        <mesh ref={engineGlow1Ref} position={[-0.4, 0, -2.8]}>
          <sphereGeometry args={[1.0, 6, 6]} />
          <meshBasicMaterial color={0x00ccff} transparent opacity={0.15} />
        </mesh>
        <mesh position={[0.4, 0, -2.8]}>
          <sphereGeometry args={[0.6, 10, 10]} />
          <meshBasicMaterial color={0x00ffff} transparent opacity={0.6} />
        </mesh>
        <mesh ref={engineGlow2Ref} position={[0.4, 0, -2.8]}>
          <sphereGeometry args={[1.0, 6, 6]} />
          <meshBasicMaterial color={0x00ccff} transparent opacity={0.15} />
        </mesh>

        {/* Energy shield: pulsing geometric field */}
        <mesh position={[0, 0, 0]} scale={[1 + Math.sin(gameState.simTime * 2.5) * 0.08, 1 + Math.sin(gameState.simTime * 2.5) * 0.08, 1 + Math.sin(gameState.simTime * 2.5) * 0.08]}>
          <icosahedronGeometry args={[3.0, 1]} />
          <meshBasicMaterial color={0x00aaff} wireframe transparent opacity={0.12} />
        </mesh>

        {/* Additional charge indicator aura when charging */}
        {gameState.phase === 'charging' && (
          <mesh position={[0, 0, 0]} scale={[0.8 + gameState.chargeLevel * 0.4, 0.8 + gameState.chargeLevel * 0.4, 0.8 + gameState.chargeLevel * 0.4]}>
            <sphereGeometry args={[2.2, 16, 16]} />
            <meshBasicMaterial
              color={0xff00ff}
              transparent
              opacity={0.08 + gameState.chargeLevel * 0.1}
            />
          </mesh>
        )}
      </group>
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
 * Uses exponential smoothing for silk-smooth, responsive flight feel.
 */
function CameraFollowController({ gameState }: { gameState: GameState }) {
  const { camera } = useThree();
  const smoothPosRef = useRef(camera.position.clone());

  // Dynamic offset based on phase: tighter during combat, wider during exploration
  const offsetDistance = gameState.phase === 'combat' ? 14 : 20;
  const offsetHeight = gameState.phase === 'combat' ? 7 : 9;

  useFrame((state, delta) => {
    const playerPos = new THREE.Vector3(
      gameState.playerEntity.position.x,
      gameState.playerEntity.position.y,
      gameState.playerEntity.position.z
    );

    // Calculate desired camera position (behind and above player for exploration view)
    const cameraOffset = new THREE.Vector3(0, offsetHeight, offsetDistance);
    const desiredCameraPos = playerPos.clone().add(cameraOffset);

    // Ultra-smooth exponential follow: k = 1 - exp(-delta * rate)
    // Matches Universe Engine's comet-following smoothness
    const followRate = gameState.phase === 'combat' ? 3.5 : 2.8;
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
      lookTarget.add(velocityDir.multiplyScalar(lookAheadDistance));
    }

    camera.lookAt(lookTarget);
  });

  return null;
}

function GameScene({
  gameState,
  onUpdate,
  keysPressed,
}: {
  gameState: GameState;
  onUpdate: (state: GameState) => void;
  keysPressed: React.MutableRefObject<Set<string>>;
}) {
  const { camera, scene } = useThree();
  const gameLoopRef = useRef<GameLoop | null>(null);
  const entityManagerRef = useRef<EntityManager | null>(null);
  const collisionSystemRef = useRef<CollisionSystem | null>(null);
  const enemyAgentsRef = useRef<Map<string, any>>(new Map());
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

  // Main update loop with player input
  useFrame((state, delta) => {
    if (!gameLoopRef.current || !entityManagerRef.current) return;

    // Cap delta at 0.1 to prevent spiral of death
    const clampedDelta = Math.min(delta, 0.1);

    // --- EXPLORATION CONTROLS: Arrow keys for rotation, W/Up for thrust ---
    if (gameState.phase === 'combat' || gameState.phase === 'charging' || gameState.phase === 'briefing') {
      // Get current forward direction from player rotation
      const playerQuat = new THREE.Quaternion();
      const playerEuler = new THREE.Euler(
        gameState.playerEntity.rotation.x,
        gameState.playerEntity.rotation.y,
        gameState.playerEntity.rotation.z
      );
      playerQuat.setFromEuler(playerEuler);

      // Forward vector in local space (0, 0, 1)
      const forwardLocal = new THREE.Vector3(0, 0, 1);
      forwardLocal.applyQuaternion(playerQuat);

      // Right vector
      const rightLocal = new THREE.Vector3(1, 0, 0);
      rightLocal.applyQuaternion(playerQuat);

      // Up vector
      const upLocal = new THREE.Vector3(0, 1, 0);
      upLocal.applyQuaternion(playerQuat);

      // Arrow key rotation
      const rotationSpeed = 2.0; // radians/sec
      const arrowSensitivity = 0.05;

      if (keysPressed.current.has('ArrowUp')) {
        gameState.playerEntity.rotation.x += arrowSensitivity;
      }
      if (keysPressed.current.has('ArrowDown')) {
        gameState.playerEntity.rotation.x -= arrowSensitivity;
      }
      if (keysPressed.current.has('ArrowLeft')) {
        gameState.playerEntity.rotation.y += arrowSensitivity;
      }
      if (keysPressed.current.has('ArrowRight')) {
        gameState.playerEntity.rotation.y -= arrowSensitivity;
      }

      // Roll with Q/E
      if (keysPressed.current.has('KeyQ')) {
        gameState.playerEntity.rotation.z += arrowSensitivity;
      }
      if (keysPressed.current.has('KeyE')) {
        gameState.playerEntity.rotation.z -= arrowSensitivity;
      }

      // Forward thrust with W or Up arrow (continuous)
      const thrustSpeed = keysPressed.current.has('KeyW') || keysPressed.current.has('ArrowUp') ? 20 : 0;

      // Boost with Shift
      const boostMultiplier = keysPressed.current.has('ShiftLeft') || keysPressed.current.has('ShiftRight') ? 1.8 : 1.0;

      // Apply velocity based on forward direction
      gameState.playerEntity.velocity.x = forwardLocal.x * thrustSpeed * boostMultiplier;
      gameState.playerEntity.velocity.y = forwardLocal.y * thrustSpeed * boostMultiplier;
      gameState.playerEntity.velocity.z = forwardLocal.z * thrustSpeed * boostMultiplier;
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
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const keysPressed = useRef<Set<string>>(new Set());

  // Keyboard-based exploration controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current.add(e.code);
      // Start combat on spacebar (briefing → combat)
      if (e.code === 'Space') {
        e.preventDefault();
        setGameState((s) => {
          if (s.phase === 'briefing') {
            return startCombat(s);
          }
          return s;
        });
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.code);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
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
        <color attach="background" args={['#0a0e27']} />
        <fog attach="fog" args={['#0a0e27', 400, 1000]} />

        {/* Starfield backdrop for universe exploration feeling */}
        <Starfield />

        {/* Scene lighting: cinematic + directional for exploring universe */}
        <ambientLight intensity={0.4} color={0xffffff} />
        <directionalLight position={[80, 50, 60]} intensity={1.0} color={0xffffff} castShadow />
        <directionalLight position={[-60, 30, -40]} intensity={0.5} color={0x3b82f6} />
        <pointLight position={[0, 5, 10]} intensity={0.6} color={0xa855f7} />

        {/* Defending planet (Earth as default) */}
        <mesh position={[0, 0, -20]} castShadow receiveShadow>
          <sphereGeometry args={[10, 128, 128]} />
          <meshStandardMaterial
            color={0x3b82f6}
            emissive={0x1e40af}
            emissiveIntensity={0.2}
            metalness={0.0}
            roughness={0.7}
          />
        </mesh>

        {/* Planet atmosphere glow */}
        <mesh position={[0, 0, -20]}>
          <sphereGeometry args={[10.5, 32, 32]} />
          <meshBasicMaterial
            color={0x60a5fa}
            transparent
            opacity={0.1}
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
        <GameScene gameState={gameState} onUpdate={setGameState} keysPressed={keysPressed} />

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
