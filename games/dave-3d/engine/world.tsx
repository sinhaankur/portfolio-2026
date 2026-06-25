"use client"

/**
 * World — the visible 3D level for Dave 3D: lit stone platforms, floating gems,
 * the gold trophy, and the exit door (which lights up once the trophy is taken).
 * Collection + the trophy/door logic run here each frame against the live player
 * position in `game`.
 */

import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"
import { LEVEL_1, type Level } from "./level"
import { game } from "./state"

export function World({ level = LEVEL_1, onWin }: { level?: Level; onWin?: () => void }) {
  return (
    <>
      {/* lighting — key + cool fill + ambient, for real 3D depth */}
      <hemisphereLight args={["#bcd0ff", "#2a2433", 0.7]} />
      <directionalLight
        position={[20, 30, 12]}
        intensity={2.1}
        color="#fff3e0"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-40}
        shadow-camera-right={60}
        shadow-camera-top={40}
        shadow-camera-bottom={-20}
        shadow-camera-far={120}
      />
      <directionalLight position={[-15, 10, -10]} intensity={0.5} color="#7da7ff" />

      <Platforms level={level} />
      <Gems level={level} />
      <Trophy level={level} />
      <Door level={level} onWin={onWin} />
    </>
  )
}

function Platforms({ level }: { level: Level }) {
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#6b5a47", roughness: 0.95, metalness: 0.05 }),
    [],
  )
  const topMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#7d6a54", roughness: 0.9 }),
    [],
  )
  return (
    <group>
      {level.platforms.map((b, i) => (
        <group key={i} position={b.pos}>
          <mesh castShadow receiveShadow material={mat}>
            <boxGeometry args={b.size} />
          </mesh>
          {/* a slightly lighter top cap for readable surfaces to land on */}
          <mesh position={[0, b.size[1] / 2 + 0.02, 0]} receiveShadow material={topMat}>
            <boxGeometry args={[b.size[0] * 0.98, 0.06, b.size[2] * 0.98]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function Gems({ level }: { level: Level }) {
  const group = useRef<THREE.Group>(null)
  const got = useRef<boolean[]>(level.gems.map(() => false))
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#28e0d0", emissive: "#0bb6a8", emissiveIntensity: 0.8, roughness: 0.2, metalness: 0.3 }),
    [],
  )
  useFrame((st) => {
    const t = st.clock.elapsedTime
    const g = group.current
    if (!g) return
    g.children.forEach((child, i) => {
      if (got.current[i]) return
      child.rotation.y = t * 1.5 + i
      child.position.y = level.gems[i][1] + Math.sin(t * 2 + i) * 0.18
      // collect on proximity to the player
      if (game.playerPos.distanceTo(child.position) < 1.3) {
        got.current[i] = true
        child.visible = false
        game.gemsGot += 1
        // juice: sparkle burst + coin pop at the gem
        game.fx.collectAt = t
        game.fx.collectPos.copy(child.position)
      }
    })
  })
  return (
    <group ref={group}>
      {level.gems.map((p, i) => (
        <mesh key={i} position={p} material={mat}>
          <octahedronGeometry args={[0.42, 0]} />
        </mesh>
      ))}
    </group>
  )
}

function Trophy({ level }: { level: Level }) {
  const ref = useRef<THREE.Group>(null)
  const taken = useRef(false)
  const gold = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#f5c020", emissive: "#7a5e00", emissiveIntensity: 0.5, roughness: 0.25, metalness: 0.9 }),
    [],
  )
  useFrame((st) => {
    const g = ref.current
    if (!g || taken.current) return
    g.rotation.y = st.clock.elapsedTime * 1.2
    g.position.y = level.trophy[1] + Math.sin(st.clock.elapsedTime * 1.6) * 0.15
    if (game.playerPos.distanceTo(g.position) < 1.6) {
      taken.current = true
      g.visible = false
      game.hasTrophy = true
    }
  })
  return (
    <group ref={ref} position={level.trophy}>
      {/* cup */}
      <mesh material={gold}><cylinderGeometry args={[0.34, 0.22, 0.4, 16]} /></mesh>
      <mesh position={[0, -0.32, 0]} material={gold}><cylinderGeometry args={[0.08, 0.08, 0.28, 12]} /></mesh>
      <mesh position={[0, -0.5, 0]} material={gold}><cylinderGeometry args={[0.28, 0.28, 0.1, 16]} /></mesh>
      {/* handles */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.34, 0.02, 0]} rotation={[0, 0, Math.PI / 2]} material={gold}>
          <torusGeometry args={[0.12, 0.03, 8, 16]} />
        </mesh>
      ))}
      <pointLight position={[0, 0.3, 0]} color="#ffd24a" intensity={1.2} distance={6} />
    </group>
  )
}

function Door({ level, onWin }: { level: Level; onWin?: () => void }) {
  const frame = useRef<THREE.Mesh>(null)
  const glow = useRef<THREE.Mesh>(null)
  const won = useRef(false)
  const lockMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#3a3550", roughness: 0.7, metalness: 0.3 }), [])
  const openMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#2a8f5a", emissive: "#1f7d4a", emissiveIntensity: 0.6, roughness: 0.5 }), [])
  useFrame(() => {
    const open = game.hasTrophy
    if (frame.current) (frame.current.material = open ? openMat : lockMat)
    if (glow.current) glow.current.visible = open
    if (open && !won.current && game.phase === "playing") {
      if (game.playerPos.distanceTo(new THREE.Vector3(...level.door)) < 1.8) {
        won.current = true
        game.phase = "won"
        onWin?.()
      }
    }
  })
  return (
    <group position={level.door}>
      <mesh ref={frame} castShadow material={lockMat}>
        <boxGeometry args={[1.4, 2.2, 0.4]} />
      </mesh>
      <mesh ref={glow} visible={false} position={[0, 0, 0.18]}>
        <planeGeometry args={[0.9, 1.7]} />
        <meshBasicMaterial color="#7dffc0" transparent opacity={0.55} toneMapped={false} />
      </mesh>
    </group>
  )
}
