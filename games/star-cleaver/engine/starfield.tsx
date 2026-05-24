'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Dynamic starfield that surrounds the player.
 * Creates layers of stars at different depths for parallax effect.
 */
export function Starfield() {
  const starsRef = useRef<Array<THREE.Points | null>>([]);

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
      makeLayer(1800, 2600, 0.36, 0.55, 'sphere'),
      makeLayer(2600, 1700, 0.56, 0.72, 'sphere'),
      makeLayer(2200, 1200, 0.72, 0.95, 'sphere'),
      makeLayer(3200, 1800, 0.24, 0.48, 'disk'),
    ];
  }, []);

  useFrame((state, delta) => {
    starsRef.current.forEach((points, i) => {
      if (!points) return;
      const rate = 0.002 + i * 0.0015;
      points.rotation.y += delta * rate;
      points.rotation.z += delta * rate * 0.35;
    });
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
    </>
  );
}
