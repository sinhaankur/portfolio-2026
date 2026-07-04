"use client"

/**
 * Dave 3D — the mountable game. A full-screen R3F <Canvas> composing the world,
 * the player controller, and the third-person follow camera, with a DOM HUD over
 * it. Drives the 10-level campaign: reach the door with the cup → advance; finish
 * level 10 → victory. Default export so the route can
 * `dynamic(() => import(...), {ssr:false})`.
 */

import { Suspense, useCallback, useEffect, useRef, useState } from "react"
import { Canvas, useThree } from "@react-three/fiber"
import * as THREE from "three"
import { LEVELS } from "./level"
import { World } from "./world"
import { Player } from "./player"
import { Corridor } from "./corridor"
import { ThirdPersonCamera } from "./third-person-camera"
import { Juice } from "./juice"
import { Hud } from "./hud"
import { bindKeyboard, resetInput } from "./controls"
import { game, resetGame, TOTAL_LEVELS } from "./state"

/** Applies the level's background/fog hue whenever the level changes (the
 *  Canvas onCreated only runs once). Lives inside the Canvas tree. */
function LevelAtmosphere({ bg }: { bg?: string }) {
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    const c = new THREE.Color(bg ?? "#05060c")
    scene.background = c
    if (scene.fog instanceof THREE.Fog) scene.fog.color.copy(c)
    else scene.fog = new THREE.Fog(c, 70, 160)
  }, [scene, bg])
  return null
}

export default function GameCanvas() {
  // levelIndex selects the level; sceneKey remounts the scene subtree on every
  // level change / restart so positions + collectibles fully reset.
  const [levelIndex, setLevelIndex] = useState(0)
  const [sceneKey, setSceneKey] = useState(0)
  const [mobile, setMobile] = useState(false)
  const [revealed, setRevealed] = useState(false) // smooth fade-in (no snap)

  const level = LEVELS[levelIndex]

  // load a level: sync shared state, reset per-level run, remount the scene.
  const loadLevel = useCallback((idx: number) => {
    const lv = LEVELS[idx]
    game.levelIndex = idx
    game.gemsTotal = lv.gems.length
    game.sideOn = lv.style === "side"
    if (lv.bounds) { game.boundsW = lv.bounds.w; game.boundsH = lv.bounds.h }
    game.deaths = 0
    resetGame()
    game.playerPos.set(...lv.spawn)
    resetInput()
    setLevelIndex(idx)
    setSceneKey((k) => k + 1)
  }, [])

  useEffect(() => {
    // `?level=N` (1-based) boots straight into a level — used by the per-level
    // stress-test harness and handy for play-testing a specific screen.
    let startIdx = 0
    try {
      const q = new URLSearchParams(window.location.search).get("level")
      if (q) startIdx = Math.min(TOTAL_LEVELS - 1, Math.max(0, parseInt(q, 10) - 1 || 0))
    } catch { /* no window/search — start at 1 */ }
    loadLevel(startIdx)
    const unbind = bindKeyboard()
    setMobile(window.matchMedia("(max-width: 768px)").matches)
    return () => { unbind(); resetInput() }
  }, [loadLevel])

  // Campaign driver: when a level is cleared, play the "GOOD WORK!" corridor
  // interstitial (Dave walks to the next door), THEN load the next level — or, if
  // it was the last level, flip straight to the final "won" screen. We poll the
  // shared phase (it's mutated outside React by the door/warp).
  const [inCorridor, setInCorridor] = useState(false)
  const advancing = useRef(false)
  useEffect(() => {
    const id = window.setInterval(() => {
      if (game.phase === "levelClear" && !advancing.current) {
        advancing.current = true
        const next = game.levelIndex + 1
        if (next >= TOTAL_LEVELS) {
          window.setTimeout(() => { game.phase = "won"; advancing.current = false }, 700)
        } else {
          setInCorridor(true) // show the corridor; onDone() advances + clears it
        }
      }
    }, 100)
    return () => window.clearInterval(id)
  }, [])

  // Corridor finished walking → load the next level and leave the corridor.
  const corridorDone = useCallback(() => {
    const next = game.levelIndex + 1
    setInCorridor(false)
    loadLevel(Math.min(next, TOTAL_LEVELS - 1))
    advancing.current = false
  }, [loadLevel])

  // HUD actions
  const restartLevel = () => loadLevel(game.levelIndex) // retry current level
  const restartGame = () => loadLevel(0)                // back to level 1

  return (
    <div className="fixed inset-0 bg-[#0c0f1a]">
      <Canvas
        shadows
        dpr={mobile ? [1, 1.5] : [1, 2]}
        camera={{ position: [0, 6, 12], fov: 55, near: 0.1, far: 400 }}
        gl={{ antialias: true }}
        onCreated={({ scene, gl }) => {
          // Cinematic grade: ACES Filmic tone mapping + lifted exposure turns the
          // flat, washed look into rich contrast with glowing highlights — the
          // single biggest "this looks like a real game" win, no extra deps.
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.25
          scene.fog = new THREE.Fog(level.bg ?? "#05060c", 70, 160)
          scene.background = new THREE.Color(level.bg ?? "#05060c")
          // reveal a beat after the first frames + textures settle, so the
          // world fades up smoothly instead of snapping in.
          requestAnimationFrame(() =>
            requestAnimationFrame(() => window.setTimeout(() => setRevealed(true), 220)),
          )
        }}
      >
        {/* Per-level cavern air — each screen gets its own near-black hue,
            like the original's per-level recolours. */}
        <LevelAtmosphere bg={level.bg} />
        <Suspense fallback={null}>
          {inCorridor ? (
            // between-levels "GOOD WORK!" corridor (Dave walks to the next door)
            <Corridor onDone={corridorDone} />
          ) : (
            <>
              <group key={sceneKey}>
                <World level={level} />
                <Player level={level} />
              </group>
              {/* dust puffs, gem sparkles + procedural SFX (jump/land/coin) */}
              <Juice />
              <ThirdPersonCamera />
            </>
          )}
        </Suspense>
      </Canvas>

      {/* Smooth reveal curtain — fades out once the scene is live (no pop). */}
      <div
        className="pointer-events-none fixed inset-0 bg-[#0c0f1a] transition-opacity duration-[900ms] ease-out"
        style={{ opacity: revealed ? 0 : 1 }}
        aria-hidden="true"
      />

      <Hud onRestartLevel={restartLevel} onRestartGame={restartGame} />
    </div>
  )
}
