'use client';

import { useRef, useMemo } from 'react';
import * as THREE from 'three';

/**
 * Dynamic starfield that surrounds the player.
 * Creates layers of stars at different depths for parallax effect.
 */
export function Starfield() {
  const starsRef = useRef<THREE.Points[]>([]);

  // Generate multiple layers of stars
  const layers = useMemo(() => {
    const layers = [];

    // Layer 1: Distant stars (very far, sparse)
    const geometry1 = new THREE.BufferGeometry();
    const positions1: number[] = [];
    for (let i = 0; i < 500; i++) {
      positions1.push(
        (Math.random() - 0.5) * 2000,
        (Math.random() - 0.5) * 2000,
        (Math.random() - 0.5) * 2000
      );
    }
    geometry1.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions1), 3));
    layers.push({ geometry: geometry1, distance: 1000, brightness: 0.4 });

    // Layer 2: Medium stars
    const geometry2 = new THREE.BufferGeometry();
    const positions2: number[] = [];
    for (let i = 0; i < 1000; i++) {
      positions2.push(
        (Math.random() - 0.5) * 1200,
        (Math.random() - 0.5) * 1200,
        (Math.random() - 0.5) * 1200
      );
    }
    geometry2.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions2), 3));
    layers.push({ geometry: geometry2, distance: 600, brightness: 0.6 });

    // Layer 3: Near stars (closer, denser)
    const geometry3 = new THREE.BufferGeometry();
    const positions3: number[] = [];
    for (let i = 0; i < 1500; i++) {
      positions3.push(
        (Math.random() - 0.5) * 800,
        (Math.random() - 0.5) * 800,
        (Math.random() - 0.5) * 800
      );
    }
    geometry3.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions3), 3));
    layers.push({ geometry: geometry3, distance: 400, brightness: 0.8 });

    return layers;
  }, []);

  return (
    <>
      {layers.map((layer, idx) => (
        <points key={`starfield-${idx}`}>
          <bufferGeometry attach="geometry" {...layer.geometry} />
          <pointsMaterial
            attach="material"
            size={0.5 + idx * 0.3}
            color={0xffffff}
            opacity={layer.brightness}
            transparent
            toneMapped={false}
            sizeAttenuation
          />
        </points>
      ))}
    </>
  );
}
