"use client"

/**
 * Corridor — the authentic Dangerous Dave between-levels interstitial, in 3D.
 *
 * After a level is cleared, the screen cuts to a blue-brick corridor: Dave walks
 * in from a door on the RIGHT and strides LEFT toward the next level's door, while
 * the "GOOD WORK! ONLY N MORE TO GO!" banner sits above (rendered by the HUD). When
 * Dave reaches the left door, `onDone()` fires and the next level loads.
 *
 * It reuses the same blue-brick look + walking Dave as the original. Self-contained
 * R3F (mounted inside the game Canvas); the side camera frames it like a level.
 */

import { useMemo, useRef } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"
import { game } from "./state"
import { DaveModel } from "./player"

// world layout of the corridor (side-on, X horizontal / Y up)
const FLOOR_Y = 0          // top of the floor band
const WALK_Y = FLOOR_Y     // Dave's feet ride the floor
const LEFT_DOOR_X = -11    // exit door (next level) on the left
const RIGHT_DOOR_X = 11    // entry door on the right
const WALK_SPEED = 5.2     // units/sec

export function Corridor({ onDone }: { onDone: () => void }) {
  const { camera } = useThree()
  const daveX = useRef(RIGHT_DOOR_X - 1.2)
  const yaw = useRef(-Math.PI / 2) // face LEFT (walking left)
  const daveRef = useRef<THREE.Group>(null)
  const done = useRef(false)
  const t0 = useRef(-1)

  // a tiled blue-brick texture for the corridor walls/floor/ceiling
  const blueTex = useMemo(() => makeBlueBrick(), [])
  const wallMat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: blueTex, roughness: 0.9, metalness: 0.05 }),
    [blueTex],
  )
  const tiled = (w: number, h: number) => {
    const m = wallMat.clone()
    m.map = wallMat.map!.clone()
    m.map.needsUpdate = true
    m.map.repeat.set(Math.max(1, Math.round(w / 1.6)), Math.max(1, Math.round(h / 1.6)))
    return m
  }
  const floorMat = useMemo(() => tiled(30, 2), [])
  const ceilMat = useMemo(() => tiled(30, 2), [])
  const doorMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#9a5a2c", roughness: 0.7, metalness: 0.1 }),
    [],
  )

  useFrame((state) => {
    // Time-based walk so it's frame-rate independent and always completes.
    if (t0.current < 0) t0.current = state.clock.elapsedTime
    const elapsed = state.clock.elapsedTime - t0.current
    const startX = RIGHT_DOOR_X - 1.2
    const endX = LEFT_DOOR_X + 0.4
    const totalDist = startX - endX
    const walked = Math.min(totalDist, WALK_SPEED * elapsed)
    daveX.current = startX - walked

    if (!done.current && daveX.current <= endX + 0.001) {
      done.current = true
      window.setTimeout(onDone, 450) // small beat at the door, then advance
    }

    // drive the shared motion signals so DaveModel animates a walk cycle
    game.playerSpeed = done.current ? 0 : WALK_SPEED
    game.playerAir = false
    game.playerVY = 0
    game.landImpact = 0

    if (daveRef.current) {
      daveRef.current.position.set(daveX.current, WALK_Y, 0)
      daveRef.current.rotation.y = yaw.current
    }

    // static side camera framing the whole corridor
    camera.position.set(0, 2.4, 18)
    camera.lookAt(0, 2.2, 0)
    const persp = camera as THREE.PerspectiveCamera
    if (persp.isPerspectiveCamera && Math.abs(persp.fov - 52) > 0.05) {
      persp.fov = 52
      persp.updateProjectionMatrix()
    }
  })

  return (
    <group>
      <ambientLight intensity={0.8} />
      <directionalLight position={[4, 10, 18]} intensity={1.5} color="#dbe6ff" />

      {/* floor + ceiling bands */}
      <mesh position={[0, FLOOR_Y - 1, 0]} material={floorMat} receiveShadow>
        <boxGeometry args={[30, 2, 2]} />
      </mesh>
      <mesh position={[0, 5.5, 0]} material={ceilMat}>
        <boxGeometry args={[30, 1.6, 2]} />
      </mesh>
      {/* back wall (thin, behind everything) */}
      <mesh position={[0, 2.4, -1.2]} material={tiled(30, 8)}>
        <boxGeometry args={[30, 8, 0.4]} />
      </mesh>

      {/* the two doors */}
      <CorridorDoor x={LEFT_DOOR_X} mat={doorMat} glow />
      <CorridorDoor x={RIGHT_DOOR_X} mat={doorMat} />

      {/* walking Dave */}
      <group ref={daveRef} position={[daveX.current, WALK_Y, 0]}>
        <DaveModel />
      </group>
    </group>
  )
}

const tmp = new THREE.Vector3()

function CorridorDoor({ x, mat, glow }: { x: number; mat: THREE.Material; glow?: boolean }) {
  return (
    <group position={[x, FLOOR_Y + 1.1, 0]}>
      <mesh material={mat} castShadow>
        <boxGeometry args={[1.4, 2.2, 0.4]} />
      </mesh>
      {/* handle */}
      <mesh position={[0.4, 0, 0.22]}>
        <sphereGeometry args={[0.08, 12, 12]} />
        <meshStandardMaterial color="#ffd24a" emissive="#7a5e00" emissiveIntensity={0.5} />
      </mesh>
      {glow && (
        <mesh position={[0, 0, 0.22]}>
          <planeGeometry args={[1.0, 1.8]} />
          <meshBasicMaterial color="#7dffc0" transparent opacity={0.18} toneMapped={false} />
        </mesh>
      )}
    </group>
  )
}

// procedural blue-brick texture matching the original's corridor masonry
function makeBlueBrick(): THREE.CanvasTexture {
  const S = 128
  const c = document.createElement("canvas")
  c.width = c.height = S
  const ctx = c.getContext("2d")!
  ctx.fillStyle = "#04060f"
  ctx.fillRect(0, 0, S, S)
  const rows = 4, bh = S / rows, bw = S / 2
  for (let r = 0; r < rows; r++) {
    const offset = r % 2 === 0 ? 0 : -bw / 2
    for (let x = -1; x < 3; x++) {
      const bx = x * bw + offset + 3
      const by = r * bh + 3
      const shade = 120 + Math.floor(Math.random() * 70)
      ctx.fillStyle = `rgb(${Math.floor(shade * 0.25)},${Math.floor(shade * 0.45)},${shade + 40})`
      ctx.fillRect(bx, by, bw - 5, bh - 5)
    }
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}
