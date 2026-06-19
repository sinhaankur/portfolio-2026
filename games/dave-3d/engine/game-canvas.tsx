"use client"

/**
 * Dave 3D — the mountable game. A full-screen R3F <Canvas> composing the world,
 * the player controller, and the third-person follow camera, with a DOM HUD over
 * it. Default export so the route can `dynamic(() => import(...), {ssr:false})`.
 */

import { Suspense, useEffect, useState } from "react"
import { Canvas } from "@react-three/fiber"
import * as THREE from "three"
import { LEVEL_1 } from "./level"
import { World } from "./world"
import { Player } from "./player"
import { ThirdPersonCamera } from "./third-person-camera"
import { Hud } from "./hud"
import { bindKeyboard, resetInput } from "./controls"
import { game, resetGame } from "./state"

export default function GameCanvas() {
  // restartKey remounts the scene subtree to fully reset positions/collectibles
  const [restartKey, setRestartKey] = useState(0)
  const [mobile, setMobile] = useState(false)

  useEffect(() => {
    game.gemsTotal = LEVEL_1.gems.length
    game.gemsGot = 0
    resetGame()
    const unbind = bindKeyboard()
    setMobile(window.matchMedia("(max-width: 768px)").matches)
    return () => { unbind(); resetInput() }
  }, [])

  const restart = () => {
    resetInput()
    resetGame()
    game.gemsGot = 0
    game.playerPos.set(...LEVEL_1.spawn)
    setRestartKey((k) => k + 1)
  }

  return (
    <div className="fixed inset-0 bg-[#0c0f1a]">
      <Canvas
        shadows
        dpr={mobile ? [1, 1.5] : [1, 2]}
        camera={{ position: [0, 6, 12], fov: 55, near: 0.1, far: 400 }}
        gl={{ antialias: true }}
        onCreated={({ scene }) => {
          scene.fog = new THREE.Fog("#0c0f1a", 40, 110)
          scene.background = new THREE.Color("#0c0f1a")
        }}
      >
        <Suspense fallback={null}>
          <group key={restartKey}>
            <World level={LEVEL_1} />
            <Player level={LEVEL_1} />
          </group>
          <ThirdPersonCamera />
        </Suspense>
      </Canvas>

      <Hud onRestart={restart} />
    </div>
  )
}
