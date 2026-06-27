"use client"

/**
 * World — the visible 3D level for Dave 3D: lit stone platforms, floating gems,
 * the gold trophy, and the exit door (which lights up once the trophy is taken).
 * Collection + the trophy/door logic run here each frame against the live player
 * position in `game`.
 */

import { useMemo, useRef, type ReactElement } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"
import { LEVEL_1, type Level, type Hazard, type GemKind } from "./level"
import { game } from "./state"

export function World({ level = LEVEL_1, onWin }: { level?: Level; onWin?: () => void }) {
  const sideOn = level.style === "side"
  return (
    <>
      {sideOn ? (
        // SIDE-ON: bright, even front lighting so the whole brick screen reads
        // clearly (like the original's flat, fully-lit look). A strong front key
        // from +Z, ambient fill, and a soft top light for a little dimension.
        <>
          <ambientLight intensity={0.85} />
          <directionalLight position={[6, 14, 20]} intensity={1.7} color="#fff4e6" />
          <directionalLight position={[-8, 6, 14]} intensity={0.5} color="#9fb8ff" />
        </>
      ) : (
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
        </>
      )}

      <Platforms level={level} />
      <Hazards level={level} />
      <Gems level={level} />
      <Pipes level={level} />
      {level.jetpack && <Jetpack level={level} />}
      {level.warp && <WarpPad level={level} />}
      <Trophy level={level} />
      <Door level={level} onWin={onWin} />
    </>
  )
}

// Hazards — spikes (gray cones), fire (orange glowing slab + flicker), water
// (translucent blue slab). Purely visual; the player's collision lives in player.tsx.
function Hazards({ level }: { level: Level }) {
  if (!level.hazards?.length) return null
  return (
    <group>
      {level.hazards.map((h, i) => (
        <HazardMesh key={i} h={h} />
      ))}
    </group>
  )
}

function HazardMesh({ h }: { h: Hazard }) {
  const ref = useRef<THREE.Mesh>(null)
  const mat = useMemo(() => {
    if (h.kind === "fire")
      return new THREE.MeshStandardMaterial({ color: "#ff5a1f", emissive: "#ff7a1f", emissiveIntensity: 1.1, roughness: 0.6 })
    if (h.kind === "water")
      return new THREE.MeshStandardMaterial({ color: "#2b6fff", emissive: "#123a8a", emissiveIntensity: 0.3, transparent: true, opacity: 0.55, roughness: 0.2, metalness: 0.1 })
    return new THREE.MeshStandardMaterial({ color: "#9aa0ad", roughness: 0.5, metalness: 0.4 }) // spike
  }, [h.kind])

  // fire flickers; water gently undulates
  useFrame((st) => {
    const m = ref.current
    if (!m) return
    const t = st.clock.elapsedTime
    if (h.kind === "fire") {
      const f = 0.85 + Math.sin(t * 14 + m.position.x) * 0.15
      ;(m.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.1 * f
      m.scale.y = 0.9 + Math.sin(t * 9 + m.position.x) * 0.12
    } else if (h.kind === "water") {
      m.position.y = h.pos[1] + Math.sin(t * 1.6 + m.position.x) * 0.05
    }
  })

  // spikes: render a row of cones across the slab instead of a flat box
  if (h.kind === "spike") {
    const cols = Math.max(1, Math.round(h.size[0] / 0.8))
    const rows = Math.max(1, Math.round(h.size[2] / 0.8))
    const tips: ReactElement[] = []
    for (let cx = 0; cx < cols; cx++) {
      for (let cz = 0; cz < rows; cz++) {
        const x = h.pos[0] - h.size[0] / 2 + (cx + 0.5) * (h.size[0] / cols)
        const z = h.pos[2] - h.size[2] / 2 + (cz + 0.5) * (h.size[2] / rows)
        tips.push(
          <mesh key={`${cx}-${cz}`} position={[x, h.pos[1] + 0.35, z]} material={mat} castShadow>
            <coneGeometry args={[0.22, 0.7, 6]} />
          </mesh>,
        )
      }
    }
    return <group>{tips}</group>
  }

  return (
    <mesh ref={ref} position={h.pos} material={mat} receiveShadow>
      <boxGeometry args={h.size} />
    </mesh>
  )
}

// Jetpack pickup — a small glowing pack that floats + spins; vanishes once grabbed.
function Jetpack({ level }: { level: Level }) {
  const ref = useRef<THREE.Group>(null)
  const base = level.jetpack!
  useFrame((st) => {
    const g = ref.current
    if (!g) return
    g.visible = !game.hasJetpack
    g.rotation.y = st.clock.elapsedTime * 1.5
    g.position.y = base[1] + Math.sin(st.clock.elapsedTime * 2) * 0.18
  })
  return (
    <group ref={ref} position={base}>
      <mesh castShadow>
        <boxGeometry args={[0.5, 0.7, 0.35]} />
        <meshStandardMaterial color="#d8d8e0" metalness={0.7} roughness={0.3} />
      </mesh>
      {[-0.18, 0.18].map((x) => (
        <mesh key={x} position={[x, -0.45, 0]}>
          <coneGeometry args={[0.12, 0.3, 8]} />
          <meshStandardMaterial color="#ff8a3a" emissive="#ff6a1f" emissiveIntensity={1.2} />
        </mesh>
      ))}
      <pointLight color="#ff9a4a" intensity={1.4} distance={5} />
    </group>
  )
}

// Warp pad — a glowing teal ring tucked off the main path (level 10's secret).
function WarpPad({ level }: { level: Level }) {
  const ref = useRef<THREE.Mesh>(null)
  const base = level.warp!
  useFrame((st) => {
    const m = ref.current
    if (!m) return
    m.rotation.z = st.clock.elapsedTime * 0.8
    const s = 1 + Math.sin(st.clock.elapsedTime * 3) * 0.08
    m.scale.setScalar(s)
  })
  return (
    <group position={base}>
      <mesh ref={ref} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.7, 0.12, 12, 32]} />
        <meshBasicMaterial color="#36f0d0" toneMapped={false} />
      </mesh>
      <pointLight color="#36f0d0" intensity={1.6} distance={6} />
    </group>
  )
}

// A small procedural brick texture (canvas) so platforms read as Dave's brick
// masonry instead of flat boxes. Tinted per-level via `color`. Cached by color.
const brickTexCache = new Map<string, THREE.CanvasTexture>()
function brickTexture(color: string): THREE.CanvasTexture {
  const hit = brickTexCache.get(color)
  if (hit) return hit
  const S = 128
  const c = document.createElement("canvas")
  c.width = c.height = S
  const ctx = c.getContext("2d")!
  // base mortar (dark)
  ctx.fillStyle = "#1a0d08"
  ctx.fillRect(0, 0, S, S)
  // brick rows, offset every other row, with subtle per-brick shading
  const rows = 4, bh = S / rows, bw = S / 2
  const base = new THREE.Color(color)
  for (let r = 0; r < rows; r++) {
    const offset = r % 2 === 0 ? 0 : -bw / 2
    for (let x = -1; x < 3; x++) {
      const bx = x * bw + offset + 3
      const by = r * bh + 3
      const shade = 0.82 + Math.random() * 0.3
      const col = base.clone().multiplyScalar(shade)
      ctx.fillStyle = `rgb(${col.r * 255 | 0},${col.g * 255 | 0},${col.b * 255 | 0})`
      ctx.fillRect(bx, by, bw - 5, bh - 5)
    }
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  brickTexCache.set(color, tex)
  return tex
}

function Platforms({ level }: { level: Level }) {
  const brick = level.brick ?? "#6b5a47"
  // one shared material per distinct tint (level brick + any per-box overrides)
  const matFor = useMemo(() => {
    const cache = new Map<string, THREE.MeshStandardMaterial>()
    return (color: string) => {
      let m = cache.get(color)
      if (!m) {
        m = new THREE.MeshStandardMaterial({ map: brickTexture(color), color: "#ffffff", roughness: 0.92, metalness: 0.05 })
        cache.set(color, m)
      }
      return m
    }
  }, [])
  return (
    <group>
      {level.platforms.map((b, i) => {
        const color = b.tint ?? brick
        // tile the brick texture by box size so bricks stay a consistent size
        const m = matFor(color).clone()
        if (m.map) {
          m.map = m.map.clone()
          m.map.needsUpdate = true
          m.map.repeat.set(Math.max(1, Math.round(b.size[0] / 1.4)), Math.max(1, Math.round(b.size[1] / 1.4)))
        }
        return (
          <mesh key={i} position={b.pos} castShadow receiveShadow material={m}>
            <boxGeometry args={b.size} />
          </mesh>
        )
      })}
    </group>
  )
}

function Gems({ level }: { level: Level }) {
  const group = useRef<THREE.Group>(null)
  const got = useRef<boolean[]>(level.gems.map(() => false))

  const diamondMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#36e6ff", emissive: "#0bb6e8", emissiveIntensity: 0.9, roughness: 0.15, metalness: 0.4 }),
    [],
  )
  const ballMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#c23bff", emissive: "#7a1fb0", emissiveIntensity: 0.8, roughness: 0.25, metalness: 0.5 }),
    [],
  )
  const rubyMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#ff2e4e", emissive: "#b00020", emissiveIntensity: 0.8, roughness: 0.18, metalness: 0.5 }),
    [],
  )
  const matFor = (k: GemKind) => (k === "ball" ? ballMat : k === "ruby" ? rubyMat : diamondMat)
  const kindOf = (i: number): GemKind => level.gemKinds?.[i] ?? "diamond"

  useFrame((st) => {
    const t = st.clock.elapsedTime
    const g = group.current
    if (!g) return
    g.children.forEach((child, i) => {
      if (got.current[i]) return
      // balls don't spin; diamonds/rubies do
      if (kindOf(i) !== "ball") child.rotation.y = t * 1.5 + i
      child.position.y = level.gems[i][1] + Math.sin(t * 2 + i) * 0.14
      if (game.playerPos.distanceTo(child.position) < 1.5) {
        got.current[i] = true
        child.visible = false
        game.gemsGot += 1
        game.fx.collectAt = t
        game.fx.collectPos.copy(child.position)
      }
    })
  })

  return (
    <group ref={group}>
      {level.gems.map((p, i) => {
        const k = kindOf(i)
        return (
          <mesh key={i} position={p} material={matFor(k)}>
            {k === "ball" ? (
              <sphereGeometry args={[0.4, 16, 16]} />
            ) : k === "ruby" ? (
              // a flatter, faceted ruby (squashed octahedron)
              <octahedronGeometry args={[0.46, 0]} />
            ) : (
              <octahedronGeometry args={[0.44, 0]} />
            )}
          </mesh>
        )
      })}
    </group>
  )
}

// Decorative pipe — the iconic silver/grey tube from the original (no collision).
function Pipes({ level }: { level: Level }) {
  if (!level.pipes?.length) return null
  const mat = new THREE.MeshStandardMaterial({ color: "#c8ccd4", metalness: 0.85, roughness: 0.3 })
  const dark = new THREE.MeshStandardMaterial({ color: "#15171c", roughness: 0.9 })
  return (
    <group>
      {level.pipes.map((p, i) => (
        <group key={i} position={[p[0], p[1] - 0.25, 0.2]} rotation={[Math.PI / 2, 0, 0]}>
          {/* tube body */}
          <mesh material={mat}>
            <cylinderGeometry args={[0.42, 0.42, 0.9, 18, 1, true]} />
          </mesh>
          {/* dark opening cap on top */}
          <mesh position={[0, -0.45, 0]} material={dark}>
            <cylinderGeometry args={[0.38, 0.38, 0.06, 18]} />
          </mesh>
        </group>
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
        game.phase = "levelClear" // game-canvas advances to the next level or wins
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
