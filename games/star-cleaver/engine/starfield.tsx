'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Dynamic starfield that surrounds the player.
 * Creates layers of stars at different depths for parallax effect.
 */
interface GasCloudField {
  position: [number, number, number];
  radius: number;
  density: number;
  color: number;
}

export function Starfield({ gasClouds = [] }: { gasClouds?: GasCloudField[] }) {
  const starsRef = useRef<Array<THREE.Points | null>>([]);
  const solarSystemRef = useRef<THREE.Group>(null);

  // Generate layered starfield + subtle galactic band for depth readability.
  const layers = useMemo(() => {
    const makeLayer = (
      count: number,
      spread: number,
      brightness: number,
      size: number,
      mode: 'sphere' | 'disk' = 'sphere'
    ) => {
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);

      for (let i = 0; i < count; i++) {
        const idx = i * 3;

        if (mode === 'disk') {
          const angle = Math.random() * Math.PI * 2;
          const radius = Math.sqrt(Math.random()) * spread;
          positions[idx] = Math.cos(angle) * radius;
          positions[idx + 1] = (Math.random() - 0.5) * spread * 0.16;
          positions[idx + 2] = Math.sin(angle) * radius;
        } else {
          positions[idx] = (Math.random() - 0.5) * spread;
          positions[idx + 1] = (Math.random() - 0.5) * spread;
          positions[idx + 2] = (Math.random() - 0.5) * spread;
        }

        // Slightly varied star temperatures (cool blue -> warm white).
        const t = Math.random();
        const r = 0.78 + t * 0.22;
        const g = 0.84 + t * 0.16;
        const b = 1.0 - t * 0.18;
        colors[idx] = r;
        colors[idx + 1] = g;
        colors[idx + 2] = b;
      }

      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      return { geometry, brightness, size };
    };

    return [
      makeLayer(2200, 3200, 0.42, 0.62, 'sphere'),
      makeLayer(3200, 2200, 0.62, 0.82, 'sphere'),
      makeLayer(2600, 1500, 0.8, 1.05, 'sphere'),
      makeLayer(3800, 2500, 0.3, 0.52, 'disk'),
    ];
  }, []);

  useFrame((state, delta) => {
    starsRef.current.forEach((points, i) => {
      if (!points) return;
      const rate = 0.002 + i * 0.0015;
      points.rotation.y += delta * rate;
      points.rotation.z += delta * rate * 0.35;
    });

    if (solarSystemRef.current) {
      solarSystemRef.current.rotation.y += delta * 0.02;
    }
  });

  return (
    <>
      {layers.map((layer, idx) => (
        <points
          key={`starfield-${idx}`}
          ref={(el) => {
            starsRef.current[idx] = el;
          }}
        >
          <bufferGeometry attach="geometry" {...layer.geometry} />
          <pointsMaterial
            attach="material"
            size={layer.size}
            vertexColors
            opacity={layer.brightness}
            transparent
            toneMapped={false}
            sizeAttenuation
            depthWrite={false}
          />
        </points>
      ))}

      {/* Nebula haze for universe visibility against dark backgrounds */}
      <mesh>
        <sphereGeometry args={[900, 32, 32]} />
        <meshBasicMaterial color={0x123a78} transparent opacity={0.08} side={THREE.BackSide} depthWrite={false} />
      </mesh>
      <mesh rotation={[0.25, 0.9, 0]}>
        <sphereGeometry args={[620, 24, 24]} />
        <meshBasicMaterial color={0x2a4b9f} transparent opacity={0.06} side={THREE.BackSide} depthWrite={false} />
      </mesh>

      {/* Distant solar-system landmark cluster for navigation context. */}
      <group ref={solarSystemRef} position={[260, 90, -640]}>
        <mesh>
          <sphereGeometry args={[18, 24, 24]} />
          <meshBasicMaterial color={0xffcf74} toneMapped={false} />
        </mesh>
        <mesh>
          <sphereGeometry args={[28, 24, 24]} />
          <meshBasicMaterial color={0xffa84a} transparent opacity={0.16} toneMapped={false} />
        </mesh>

        <mesh position={[46, 0, 0]}>
          <sphereGeometry args={[2.6, 14, 14]} />
          <meshBasicMaterial color={0xa7c8ff} toneMapped={false} />
        </mesh>
        <mesh position={[72, 0, -6]}>
          <sphereGeometry args={[3.5, 14, 14]} />
          <meshBasicMaterial color={0xd8b27f} toneMapped={false} />
        </mesh>
        <mesh position={[102, 0, 10]}>
          <sphereGeometry args={[3.8, 14, 14]} />
          <meshBasicMaterial color={0x5ea0ff} toneMapped={false} />
        </mesh>
        <mesh position={[136, 0, -8]}>
          <sphereGeometry args={[4.6, 14, 14]} />
          <meshBasicMaterial color={0xcf8565} toneMapped={false} />
        </mesh>

        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[44.5, 45.2, 96]} />
          <meshBasicMaterial color={0x4f6ca3} transparent opacity={0.18} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[70.5, 71.2, 96]} />
          <meshBasicMaterial color={0x6587bf} transparent opacity={0.16} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[100.5, 101.2, 96]} />
          <meshBasicMaterial color={0x7da1da} transparent opacity={0.14} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[134.5, 135.2, 96]} />
          <meshBasicMaterial color={0x90b6ef} transparent opacity={0.12} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>

      {/* Volumetric gas clouds: visible traversal zones that affect ship feel. */}
      {gasClouds.map((cloud, idx) => (
        <group key={`gas-cloud-${idx}`} position={cloud.position}>
          <mesh>
            <sphereGeometry args={[cloud.radius * 0.62, 24, 24]} />
            <meshBasicMaterial
              color={cloud.color}
              transparent
              opacity={0.06 + cloud.density * 0.08}
              side={THREE.DoubleSide}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          <mesh>
            <sphereGeometry args={[cloud.radius * 0.88, 24, 24]} />
            <meshBasicMaterial
              color={cloud.color}
              transparent
              opacity={0.03 + cloud.density * 0.05}
              side={THREE.DoubleSide}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          <mesh>
            <sphereGeometry args={[cloud.radius, 20, 20]} />
            <meshBasicMaterial
              color={cloud.color}
              transparent
              opacity={0.02 + cloud.density * 0.04}
              side={THREE.DoubleSide}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
    </>
  );
}
