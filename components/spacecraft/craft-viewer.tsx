"use client"

/**
 * CraftViewer — a small R3F canvas that renders one spacecraft's real GLB mesh,
 * slowly rotating. Auto-frames the model to the view regardless of its authored
 * size, so the whole catalog reads at a consistent scale. Suspense-wrapped so a
 * slow/failed load never blanks the card.
 *
 * Lighting is SPACE-real, not studio-generic: one harsh warm sun (the only
 * light source out there), a black void, and a faint blue earthglow fill so the
 * shadow side stays readable the way real orbital photography does. The
 * environment is built in-canvas from Lightformers (no external HDR fetch) so
 * foil + solar cells pick up hard sun glints instead of city reflections.
 */

import { Suspense, useRef, useMemo } from "react"
import { Canvas } from "@react-three/fiber"
import { useGLTF, Clone, Environment, Lightformer } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import { Box3, Vector3, Group } from "three"

function Model({ url }: { url: string }) {
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

  useFrame((state, dt) => {
    if (!spin.current) return
    spin.current.rotation.y += dt * 0.32
    // A whisper of free-flyer tumble — real craft never sit dead-level.
    spin.current.rotation.x = 0.12 + Math.sin(state.clock.elapsedTime * 0.21) * 0.05
  })

  return (
    <group ref={spin} rotation={[0.12, 0, -0.06]}>
      <group scale={fitScale} position={[-center.x * fitScale, -center.y * fitScale, -center.z * fitScale]}>
        <Clone object={scene} />
      </group>
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
      {/* The Sun — one harsh warm key, the way space is actually lit. Exposure
          set for the LIT side (real orbital photos do the same): bright enough
          that white dishes + foil pop against the void. */}
      <directionalLight position={[5, 3, 4]} intensity={4.6} color="#fff3e0" />
      {/* Earthglow — the blue bounce that keeps real craft's shadow side
          readable in orbital photos. Dim by design; the contrast IS the look. */}
      <directionalLight position={[-3, -2, -1]} intensity={0.6} color="#6d8fc4" />
      <ambientLight intensity={0.16} />
      <Suspense fallback={null}>
        <Model url={url} />
        {/* In-canvas environment (no HDR download): a small blinding sun disc
            for hard specular glints on foil + metal, a broad faint blue panel
            below (earthshine), black everywhere else. */}
        <Environment resolution={256} frames={1}>
          <color attach="background" args={["#000000"]} />
          <Lightformer form="circle" intensity={40} position={[6, 4, 5]} scale={1.2} color="#fff5e6" />
          <Lightformer form="rect" intensity={0.9} position={[-4, -5, -2]} scale={[14, 8, 1]} color="#41618f" />
          <Lightformer form="rect" intensity={0.25} position={[0, 6, -6]} scale={[10, 6, 1]} color="#20242c" />
        </Environment>
      </Suspense>
    </Canvas>
  )
}
