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

const DEFAULT_DUST_COUNT = 1200;
const DUST_TUNNEL_LENGTH = 500; // particles spawn in a tunnel this long ahead
const DUST_TUNNEL_RADIUS = 140;
const DUST_COLORS = [
  new THREE.Color(0xffffff),
  new THREE.Color(0xcce8ff),
  new THREE.Color(0xaaccff),
  new THREE.Color(0x99bbee),
];

// Frame-scope scratch objects — the streak orientation is identical for every
// particle, so compute it once per frame instead of per instance.
const _dustMoveDir = new THREE.Vector3();
const _dustNegDir = new THREE.Vector3();
const _dustQuat = new THREE.Quaternion();
const _dustZ = new THREE.Vector3(0, 0, 1);

export function SpaceDust({ gameState, count = DEFAULT_DUST_COUNT }: { gameState: GameState; count?: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorsAppliedRef = useRef(false);

  // Each particle: position, color index, size, speed bias
  const seeds = useMemo(() => {
    const arr: Array<{
      x: number; y: number; z: number;
      colorIdx: number;
      baseSize: number;
      speedBias: number;
    }> = [];
    for (let i = 0; i < count; i++) {
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
  }, [count]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;

    // Per-particle colors are static — write them once on first frame.
    if (!colorsAppliedRef.current) {
      colorsAppliedRef.current = true;
      for (let i = 0; i < count; i++) {
        meshRef.current.setColorAt(i, DUST_COLORS[seeds[i].colorIdx]);
      }
      if (meshRef.current.instanceColor) {
        meshRef.current.instanceColor.needsUpdate = true;
      }
    }

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

    // Move direction + streak orientation, computed once for all particles.
    if (speed > 0.1) {
      _dustMoveDir.set(vx, vy, vz).normalize();
    } else {
      _dustMoveDir.set(0, 0, -1);
    }
    if (speed > 0.5) {
      // Particles stream backward relative to the ship.
      _dustQuat.setFromUnitVectors(_dustZ, _dustNegDir.copy(_dustMoveDir).negate());
    } else {
      _dustQuat.set(0, 0, 0, 1);
    }

    for (let i = 0; i < count; i++) {
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
      dummy.quaternion.copy(_dustQuat);

      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;

    // Global opacity ramps with speed
    const mat = meshRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = Math.min(0.65, speed / 80);
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
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

export function BoostShockwave({ gameState }: { gameState: GameState }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const startTimeRef = useRef<number>(-1);

  useFrame((state) => {
    if (!meshRef.current) return;
    const active = Boolean(gameState.playerEntity.metadata?.boostActive);
    if (active && startTimeRef.current < 0) {
      startTimeRef.current = state.clock.elapsedTime;
      meshRef.current.position.set(
        gameState.playerEntity.position.x,
        gameState.playerEntity.position.y,
        gameState.playerEntity.position.z
      );
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
    <mesh ref={meshRef} visible={false}>
      <ringGeometry args={[1, 1.3, 32]} />
      <meshBasicMaterial color={0x4fc8ff} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
    </mesh>
  );
}
