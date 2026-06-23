"use client"

/**
 * <BigBangEngine /> — the full real-time Big Bang experience: an R3F canvas
 * running the morphing cosmic field, with a HUD that scrubs the scientific
 * timeline (Planck epoch → today). Mounts client-only on the static export.
 */

import { useRef } from "react"
import { Canvas } from "@react-three/fiber"
import * as THREE from "three"
import { T_LOG_MIN } from "./timeline"
import { BigBangScene } from "./scene"
import { BigBangHud } from "./hud"

export function BigBangEngine() {
  // shared log-time (seconds since the Big Bang, log10). HUD writes, scene reads.
  const tLogRef = useRef<number>(T_LOG_MIN)

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0, 26], fov: 55, near: 0.1, far: 500 }}
        gl={{ antialias: true }}
        onCreated={({ scene }) => { scene.background = new THREE.Color("#04040a") }}
      >
        <BigBangScene tLogRef={tLogRef} />
      </Canvas>
      <BigBangHud tLogRef={tLogRef} />
    </div>
  )
}

export default BigBangEngine
