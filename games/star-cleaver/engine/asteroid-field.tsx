'use client';

import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { SCENE_METERS_PER_UNIT } from './scale-contract';

/**
 * Asteroid field — drifting belt of Blender-authored small bodies.
 *
 * The meshes come from `blender/space-assets/small-bodies/` (stony +
 * carbonaceous asteroids, a comet nucleus), exported as GLB and copied into
 * `/public/models/`. This is the same Blender → GLB → useGLTF pipeline the
 * player ship uses (see player-ship-model.tsx); the field just instances the
 * rocks with per-body drift + tumble.
 *
 * The website's universe engine is untouched — this asset is game-only.
 */

const ASTEROID_MODELS = [
  '/models/asteroid-stony.glb',
  '/models/asteroid-carbon.glb',
  '/models/comet-nucleus.glb',
] as const;

// The GLBs are exported +Y up from Blender. The rocks have no inherent
// "forward", so no basis rotation is needed — only scale calibration.
// Source bodies are modelled ~1 unit radius in Blender; a belt asteroid should
// read as a few tens of metres across in-game.
const ASTEROID_DIAMETER_METERS = 28;
const GLB_SOURCE_RADIUS_UNITS = 1.0;
const ASTEROID_BASE_SCALE =
  ASTEROID_DIAMETER_METERS / SCENE_METERS_PER_UNIT / (GLB_SOURCE_RADIUS_UNITS * 2);

type AsteroidInstance = {
  modelIndex: number;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  /** radians/sec tumble on each axis */
  spin: THREE.Vector3;
  /** uniform scale multiplier on top of the base scale */
  scale: number;
  /** slow orbital drift around the belt centre, radians/sec */
  orbitSpeed: number;
  orbitRadius: number;
  orbitPhase: number;
  orbitY: number;
};

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildField(count: number, beltRadius: number, beltWidth: number, seed: number): AsteroidInstance[] {
  const rand = mulberry32(seed);
  const out: AsteroidInstance[] = [];
  for (let i = 0; i < count; i += 1) {
    const phase = rand() * Math.PI * 2;
    const radius = beltRadius + (rand() - 0.5) * beltWidth;
    const y = (rand() - 0.5) * beltWidth * 0.35;
    // Comet nucleus (index 2) is rarer than the asteroids.
    const roll = rand();
    const modelIndex = roll > 0.9 ? 2 : roll > 0.45 ? 1 : 0;
    out.push({
      modelIndex,
      position: new THREE.Vector3(Math.cos(phase) * radius, y, Math.sin(phase) * radius),
      rotation: new THREE.Euler(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI),
      spin: new THREE.Vector3((rand() - 0.5) * 0.4, (rand() - 0.5) * 0.4, (rand() - 0.5) * 0.4),
      scale: 0.45 + rand() * 1.6,
      orbitSpeed: (0.015 + rand() * 0.02) * (rand() > 0.5 ? 1 : -1),
      orbitRadius: radius,
      orbitPhase: phase,
      orbitY: y,
    });
  }
  return out;
}

function styleRock(scene: THREE.Object3D): THREE.Object3D {
  const cloned = scene.clone(true);
  cloned.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.castShadow = true;
    child.receiveShadow = true;
    child.frustumCulled = true;
    const apply = (material: THREE.Material) => {
      if (!(material instanceof THREE.MeshStandardMaterial)) return material;
      const mat = material.clone();
      // Keep the Blender base colour but ensure it reads in-engine: rocky,
      // non-metallic, picks up scene env light without blowing out.
      mat.roughness = Math.max(mat.roughness, 0.85);
      mat.metalness = 0;
      mat.envMapIntensity = Math.max(mat.envMapIntensity ?? 1, 1.1);
      mat.needsUpdate = true;
      return mat;
    };
    child.material = Array.isArray(child.material)
      ? child.material.map(apply)
      : apply(child.material);
  });
  return cloned;
}

type FieldMode = 'belt' | 'defend';

function Rock({
  instance,
  baseMeshes,
  mode,
  earthLocal,
  beltRadius,
}: {
  instance: AsteroidInstance;
  baseMeshes: THREE.Object3D[];
  mode: FieldMode;
  /** Earth position expressed in the field group's local space. */
  earthLocal: THREE.Vector3;
  beltRadius: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const styled = useMemo(() => styleRock(baseMeshes[instance.modelIndex]), [baseMeshes, instance.modelIndex]);
  // Live position for defend mode (mutated each frame).
  const posRef = useRef(instance.position.clone());
  // Per-rock incoming speed (scene units/sec), seeded off the orbit speed.
  const speed = useRef(40 + Math.abs(instance.orbitSpeed) * 1200);

  // Reset a defend-mode rock to a fresh spawn far out, aimed at Earth.
  const respawn = (g: THREE.Group) => {
    const a = Math.random() * Math.PI * 2;
    const r = beltRadius * (1.1 + Math.random() * 0.5);
    posRef.current.set(
      earthLocal.x + Math.cos(a) * r,
      earthLocal.y + (Math.random() - 0.5) * beltRadius * 0.6,
      earthLocal.z + Math.sin(a) * r,
    );
    g.position.copy(posRef.current);
  };

  useFrame((_, delta) => {
    const g = groupRef.current;
    if (!g) return;
    // tumble (both modes)
    g.rotation.x += instance.spin.x * delta;
    g.rotation.y += instance.spin.y * delta;
    g.rotation.z += instance.spin.z * delta;

    if (mode === 'defend') {
      // Drift toward Earth; respawn once it arrives so the swarm never empties.
      const dir = earthLocal.clone().sub(posRef.current);
      const dist = dir.length();
      if (dist < 60) {
        respawn(g);
        return;
      }
      dir.normalize().multiplyScalar(speed.current * delta);
      posRef.current.add(dir);
      g.position.copy(posRef.current);
    } else {
      // Belt: slow orbital drift around belt centre.
      instance.orbitPhase += instance.orbitSpeed * delta;
      g.position.set(
        Math.cos(instance.orbitPhase) * instance.orbitRadius,
        instance.orbitY,
        Math.sin(instance.orbitPhase) * instance.orbitRadius,
      );
    }
  });

  return (
    <group ref={groupRef} position={instance.position} scale={ASTEROID_BASE_SCALE * instance.scale}>
      <primitive object={styled} />
    </group>
  );
}

export function AsteroidField({
  count = 60,
  beltRadius = 220,
  beltWidth = 90,
  seed = 1337,
  center = [0, 0, 0],
  mode = 'belt',
  earthPosition = [0, -140, -460],
}: {
  count?: number;
  beltRadius?: number;
  beltWidth?: number;
  seed?: number;
  center?: [number, number, number];
  /** 'belt' = ambient orbiting field; 'defend' = swarm drifting toward Earth. */
  mode?: FieldMode;
  /** World-space Earth position; asteroids in 'defend' mode home toward it. */
  earthPosition?: [number, number, number];
}) {
  const gltfs = ASTEROID_MODELS.map((path) => useGLTF(path));
  const baseMeshes = useMemo(() => gltfs.map((g) => g.scene), [gltfs]);
  const field = useMemo(() => buildField(count, beltRadius, beltWidth, seed), [count, beltRadius, beltWidth, seed]);

  // Earth in the field group's local space (group is offset by `center`).
  const earthLocal = useMemo(
    () =>
      new THREE.Vector3(
        earthPosition[0] - center[0],
        earthPosition[1] - center[1],
        earthPosition[2] - center[2],
      ),
    [earthPosition, center],
  );

  return (
    <group position={center}>
      {field.map((instance, i) => (
        <Rock
          key={i}
          instance={instance}
          baseMeshes={baseMeshes}
          mode={mode}
          earthLocal={earthLocal}
          beltRadius={beltRadius}
        />
      ))}
    </group>
  );
}

ASTEROID_MODELS.forEach((path) => useGLTF.preload(path));
