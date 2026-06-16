"use client"

/**
 * GlobeViewer — an interactive, orbitable 3D view of a celestial-body GLB,
 * in the spirit of the Universe Engine. Drag to rotate, scroll/pinch to zoom;
 * slow auto-rotate when idle.
 *
 * The GLBs (public/models/<body>-globe.glb) carry real displaced relief baked
 * from NASA/USGS elevation data, with 2K embedded textures — kept light enough
 * to stream in the browser. R3F is lazy-loaded by the page so this only costs
 * bytes when a viewer mounts.
 */

import { Suspense, useRef } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { useGLTF, OrbitControls } from "@react-three/drei"
import * as THREE from "three"

function Globe({ src }: { src: string }) {
  const { scene } = useGLTF(src)
  const ref = useRef<THREE.Group>(null)
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.08
  })
  return <primitive ref={ref} object={scene} />
}

export function GlobeViewer({ src, sunAngle = 0.6 }: { src: string; sunAngle?: number }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 2.6], fov: 45 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true }}
      className="touch-none"
    >
      <ambientLight intensity={0.25} />
      <directionalLight
        position={[Math.cos(sunAngle) * 5, 2, Math.sin(sunAngle) * 5]}
        intensity={3}
      />
      <Suspense fallback={null}>
        <Globe src={src} />
      </Suspense>
      <OrbitControls
        enablePan={false}
        minDistance={1.6}
        maxDistance={5}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.5}
      />
    </Canvas>
  )
}
