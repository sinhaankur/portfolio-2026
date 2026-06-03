'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { GameState } from '../../../lib/neural-game-engine';

/* --------------------------------------------------------------------------
 * SpaceDust — instanced particle field that streaks past the ship based on
 * velocity. Uses a single InstancedMesh for performance (~1200 streaks).
 *
 * Realistic feel:
 *   - Particles spawn in a tunnel ahead of the ship, not a uniform cube
 *   - Long thin streaks aligned to velocity
 *   - Color temperature shifts from cool white to blue-purple at high speed
 *   - Boost triggers a "warp tunnel" effect with extreme streaking
 * ------------------------------------------------------------------------ */

const DUST_COUNT = 1200;
const DUST_TUNNEL_LENGTH = 500; // particles spawn in a tunnel this long ahead
const DUST_TUNNEL_RADIUS = 140;
const DUST_COLORS = [
  new THREE.Color(0xffffff),
  new THREE.Color(0xcce8ff),
  new THREE.Color(0xaaccff),
  new THREE.Color(0x99bbee),
];

export function SpaceDust({ gameState }: { gameState: GameState }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Each particle: position, color index, size, speed bias
  const seeds = useMemo(() => {
    const arr: Array<{
      x: number; y: number; z: number;
      colorIdx: number;
      baseSize: number;
      speedBias: number;
    }> = [];
    for (let i = 0; i < DUST_COUNT; i++) {
      // Cylindrical tunnel distribution — denser along the forward axis
      const t = Math.random(); // 0 = near ship, 1 = far ahead
      const angle = Math.random() * Math.PI * 2;
      const r = Math.pow(Math.random(), 0.6) * DUST_TUNNEL_RADIUS;
      arr.push({
        x: Math.cos(angle) * r,
        y: Math.sin(angle) * r,
        z: -t * DUST_TUNNEL_LENGTH, // ahead of ship (-Z is forward)
        colorIdx: Math.floor(Math.random() * DUST_COLORS.length),
        baseSize: 0.04 + Math.random() * 0.12,
        speedBias: 0.6 + Math.random() * 0.8,
      });
    }
    return arr;
  }, []);

  useFrame((_, delta) => {
    if (!meshRef.current) return;

    const px = gameState.playerEntity.position.x;
    const py = gameState.playerEntity.position.y;
    const pz = gameState.playerEntity.position.z;
    const vx = gameState.playerEntity.velocity.x;
    const vy = gameState.playerEntity.velocity.y;
    const vz = gameState.playerEntity.velocity.z;
    const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
    const boostActive = Boolean(gameState.playerEntity.metadata?.boostActive);

    // Warp factor: extreme stretch when boosting
    const warp = boostActive ? 3.5 : 1.0;

    // Move direction
    const moveDir = speed > 0.1
      ? new THREE.Vector3(vx, vy, vz).normalize()
      : new THREE.Vector3(0, 0, -1);

    for (let i = 0; i < DUST_COUNT; i++) {
      const s = seeds[i];

      // Particles stream past the ship — they drift opposite to velocity
      const driftRate = speed * s.speedBias * warp;
      s.z += driftRate * delta;

      // Wrap: when a particle passes behind the ship, respawn it far ahead
      if (s.z > 40) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.pow(Math.random(), 0.6) * DUST_TUNNEL_RADIUS;
        s.x = Math.cos(angle) * r;
        s.y = Math.sin(angle) * r;
        s.z = -DUST_TUNNEL_LENGTH * (0.3 + Math.random() * 0.7);
      }

      // World position
      const absX = px + s.x;
      const absY = py + s.y;
      const absZ = pz + s.z;

      // Streak: long thin line aligned to velocity
      const stretch = Math.min(1, speed / 30) * warp;
      const streakLen = s.baseSize * (1 + stretch * 18);
      const streakWidth = s.baseSize * (1 + stretch * 0.5);

      dummy.position.set(absX, absY, absZ);
      dummy.scale.set(streakWidth, streakWidth, streakLen);

      // Orient so Z aligns with movement (streak points along velocity)
      if (speed > 0.5) {
        const q = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 0, 1),
          moveDir.clone().negate() // particles stream backward relative to ship
        );
        dummy.quaternion.copy(q);
      } else {
        dummy.quaternion.set(0, 0, 0, 1);
      }

      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      // Per-particle color
      const col = DUST_COLORS[s.colorIdx];
      meshRef.current.setColorAt(i, col);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }

    // Global opacity ramps with speed
    const mat = meshRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = Math.min(0.65, speed / 80);
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, DUST_COUNT]}>
      <capsuleGeometry args={[0.5, 1, 4, 8]} />
      <meshBasicMaterial
        color={0xffffff}
        transparent
        opacity={0}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </instancedMesh>
  );
}

/* --------------------------------------------------------------------------
 * DataCoreField — glowing collectible orbs placed at route waypoints.
 * Flying through them grants score and shows a brief pickup flash.
 * ------------------------------------------------------------------------ */

export type DataCore = {
  id: string;
  position: [number, number, number];
  collected: boolean;
  value: number;
  pulseOffset: number;
};

export function createDataCores(waypoints: Array<{ id: string; position: [number, number, number]; discoveryScore: number }>): DataCore[] {
  return waypoints.map((wp) => ({
    id: `core-${wp.id}`,
    position: wp.position,
    collected: false,
    value: Math.round(wp.discoveryScore * 0.4),
    pulseOffset: Math.random() * Math.PI * 2,
  }));
}

export function DataCoreField({
  cores,
  gameState,
  onCollect,
}: {
  cores: DataCore[];
  gameState: GameState;
  onCollect: (coreId: string, value: number) => void;
}) {
  const groupRefs = useRef<Map<string, THREE.Group>>(new Map());
  const collectedRef = useRef<Set<string>>(new Set());

  // Check collection distance every frame
  useFrame((state) => {
    const px = gameState.playerEntity.position.x;
    const py = gameState.playerEntity.position.y;
    const pz = gameState.playerEntity.position.z;

    for (const core of cores) {
      if (core.collected || collectedRef.current.has(core.id)) continue;

      const dx = px - core.position[0];
      const dy = py - core.position[1];
      const dz = pz - core.position[2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist < 260) {
        collectedRef.current.add(core.id);
        onCollect(core.id, core.value);
      }

      // Animate pulse
      const group = groupRefs.current.get(core.id);
      if (group) {
        const pulse = 1 + Math.sin(state.clock.elapsedTime * 2.2 + core.pulseOffset) * 0.12;
        group.scale.setScalar(pulse);
      }
    }
  });

  return (
    <>
      {cores.map((core) => {
        if (core.collected || collectedRef.current.has(core.id)) return null;
        return (
          <group
            key={core.id}
            ref={(el) => {
              if (el) groupRefs.current.set(core.id, el);
            }}
            position={core.position}
          >
            {/* Core glow */}
            <mesh>
              <sphereGeometry args={[14, 16, 16]} />
              <meshBasicMaterial color={0x4fffd1} transparent opacity={0.28} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
            </mesh>
            {/* Inner bright sphere */}
            <mesh>
              <sphereGeometry args={[6, 12, 12]} />
              <meshBasicMaterial color={0xcffff0} transparent opacity={0.65} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
            </mesh>
            {/* Orbital ring */}
            <mesh rotation={[Math.PI * 0.3, Math.PI * 0.2, 0]}>
              <torusGeometry args={[22, 1.2, 8, 32]} />
              <meshBasicMaterial color={0x4fffd1} transparent opacity={0.18} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
            </mesh>
            {/* Point light */}
            <pointLight intensity={1.8} distance={120} color={0x4fffd1} />
          </group>
        );
      })}
    </>
  );
}

/* --------------------------------------------------------------------------
 * BoostShockwave — brief ring expansion when boost engages
 * ------------------------------------------------------------------------ */

export function BoostShockwave({ active, position }: { active: boolean; position: [number, number, number] }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const startTimeRef = useRef<number>(-1);

  useFrame((state) => {
    if (!meshRef.current) return;
    if (active && startTimeRef.current < 0) {
      startTimeRef.current = state.clock.elapsedTime;
    }
    if (!active) {
      startTimeRef.current = -1;
      meshRef.current.visible = false;
      return;
    }

    const elapsed = state.clock.elapsedTime - startTimeRef.current;
    if (elapsed > 0.6) {
      meshRef.current.visible = false;
      return;
    }

    meshRef.current.visible = true;
    const progress = elapsed / 0.6;
    const scale = 1 + progress * 18;
    meshRef.current.scale.setScalar(scale);
    (meshRef.current.material as THREE.MeshBasicMaterial).opacity = 0.35 * (1 - progress);
  });

  return (
    <mesh ref={meshRef} position={position} visible={false}>
      <ringGeometry args={[1, 1.3, 32]} />
      <meshBasicMaterial color={0x4fc8ff} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
    </mesh>
  );
}
