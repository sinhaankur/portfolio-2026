"use client"

/**
 * CraftViewer — a small R3F canvas that renders one spacecraft's real GLB mesh,
 * slowly rotating. Auto-frames the model to the view regardless of its authored
 * size, so the whole catalog reads at a consistent scale. Suspense-wrapped so a
 * slow/failed load never blanks the card.
 */

import { Suspense, useRef, useMemo } from "react"
import { Canvas } from "@react-three/fiber"
import { useGLTF, Clone, Environment } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import { Box3, Vector3, Group } from "three"

function Model({ url, frame = 3.2 }: { url: string; frame?: number }) {
  const { scene } = useGLTF(url)
  const spin = useRef<Group>(null)

  // Auto-fit: measure the GLB's bounding box and scale it so its largest
  // dimension fills a consistent fraction of the view, then centre it.
  const { fitScale, center } = useMemo(() => {
    const box = new Box3().setFromObject(scene)
    const size = new Vector3(); box.getSize(size)
    const c = new Vector3(); box.getCenter(c)
    const maxDim = Math.max(size.x, size.y, size.z) || 1
    return { fitScale: 2.2 / maxDim, center: c }
  }, [scene])

  useFrame((_, dt) => {
    if (spin.current) spin.current.rotation.y += dt * 0.4
  })

  return (
    <group ref={spin} scale={fitScale} position={[-center.x * fitScale, -center.y * fitScale, -center.z * fitScale]}>
      <Clone object={scene} />
    </group>
  )
}

export function CraftViewer({ url, frame = 3.2 }: { url: string; frame?: number }) {
  return (
    <Canvas
      camera={{ position: [frame * 0.7, frame * 0.4, frame], fov: 40 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true }}
      style={{ background: "transparent" }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[4, 5, 3]} intensity={1.6} />
      <directionalLight position={[-3, -1, -2]} intensity={0.4} color="#8ab6ff" />
      <Suspense fallback={null}>
        <Model url={url} frame={frame} />
        <Environment preset="city" />
      </Suspense>
    </Canvas>
  )
}
