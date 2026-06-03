'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { GameState } from '../../../lib/neural-game-engine';

/* --------------------------------------------------------------------------
 * SpaceDust — instanced particle field that streaks past the ship based on
 * velocity. Uses a single InstancedMesh for performance (~600 points).
 * ------------------------------------------------------------------------ */

const DUST_COUNT = 600;
const DUST_BOX_SIZE = 320; // particles live in a cube this wide around the ship
const DUST_COLOR = new THREE.Color(0xaaccff);

export function SpaceDust({ gameState }: { gameState: GameState }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Pre-seed random positions so particles don't all clump
  const seeds = useMemo(() => {
    const arr: Array<{ x: number; y: number; z: number; size: number; speed: number }> = [];
    for (let i = 0; i < DUST_COUNT; i++) {
      arr.push({
        x: (Math.random() - 0.5) * DUST_BOX_SIZE,
        y: (Math.random() - 0.5) * DUST_BOX_SIZE,
        z: (Math.random() - 0.5) * DUST_BOX_SIZE,
        size: 0.08 + Math.random() * 0.18,
        speed: 0.7 + Math.random() * 0.3,
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
    const half = DUST_BOX_SIZE / 2;

    // Direction the ship is moving (world space)
    const moveDir = speed > 0.1 ? new THREE.Vector3(vx, vy, vz).normalize() : new THREE.Vector3(0, 0, -1);

    for (let i = 0; i < DUST_COUNT; i++) {
      const s = seeds[i];

      // Particle drifts opposite to ship velocity to create parallax
      const driftX = s.x - vx * delta * s.speed;
      const driftY = s.y - vy * delta * s.speed;
      const driftZ = s.z - vz * delta * s.speed;

      // Wrap around the bounding box relative to player position
      let wx = ((driftX - px) % DUST_BOX_SIZE);
      let wy = ((driftY - py) % DUST_BOX_SIZE);
      let wz = ((driftZ - pz) % DUST_BOX_SIZE);
      if (wx < -half) wx += DUST_BOX_SIZE;
      if (wx > half) wx -= DUST_BOX_SIZE;
      if (wy < -half) wy += DUST_BOX_SIZE;
      if (wy > half) wy -= DUST_BOX_SIZE;
      if (wz < -half) wz += DUST_BOX_SIZE;
      if (wz > half) wz -= DUST_BOX_SIZE;

      // Absolute world position
      const absX = px + wx;
      const absY = py + wy;
      const absZ = pz + wz;

      // Streak scale: stretch along velocity axis when moving fast
      const stretch = Math.min(1, speed / 60); // 0→1 as speed ramps
      const scaleX = s.size * (1 + stretch * 3);
      const scaleY = s.size * (1 + stretch * 3);
      const scaleZ = s.size * (1 + stretch * 10);

      dummy.position.set(absX, absY, absZ);
      dummy.scale.set(scaleX, scaleY, scaleZ);

      // Orient the stretch along velocity
      if (speed > 0.5) {
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), moveDir);
        dummy.quaternion.copy(q);
      } else {
        dummy.quaternion.set(0, 0, 0, 1);
      }

      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      // Store wrapped coords back for next frame
      s.x = absX;
      s.y = absY;
      s.z = absZ;
    }

    meshRef.current.instanceMatrix.needsUpdate = true;

    // Fade opacity by speed: invisible when still, bright when cruising
    const mat = meshRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = Math.min(0.55, speed / 120);
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, DUST_COUNT]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color={DUST_COLOR} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
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
