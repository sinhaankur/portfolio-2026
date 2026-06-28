"use client"

/**
 * World — the visible 3D level for Dave 3D: lit stone platforms, floating gems,
 * the gold trophy, and the exit door (which lights up once the trophy is taken).
 * Collection + the trophy/door logic run here each frame against the live player
 * position in `game`.
 */

import { useMemo, useRef, type ReactElement } from "react"
import { useFrame } from "@react-three/fiber"
import { useGLTF } from "@react-three/drei"
import { SkeletonUtils } from "three-stdlib"
import * as THREE from "three"
import { LEVEL_1, type Level, type Hazard, type GemKind } from "./level"
import { game } from "./state"

// Blender hero props (cup / gem / door). Preload so they're ready on first frame.
const CUP_GLB = "/models/dave/cup.glb"
const GEM_GLB = "/models/dave/gem.glb"
const DOOR_GLB = "/models/dave/door.glb"
const BRICK_GLB = "/models/dave/brick-panel.glb"
useGLTF.preload(CUP_GLB)
useGLTF.preload(GEM_GLB)
useGLTF.preload(DOOR_GLB)
useGLTF.preload(BRICK_GLB)

/** Deep-clone a loaded GLB scene (so many instances don't share one graph). */
function useClonedGlb(url: string): THREE.Group {
  const { scene } = useGLTF(url)
  return useMemo(() => {
    const root = SkeletonUtils.clone(scene) as THREE.Group
    root.traverse((o) => { o.castShadow = true; o.receiveShadow = true })
    return root
  }, [scene])
}

export function World({ level = LEVEL_1, onWin }: { level?: Level; onWin?: () => void }) {
  const sideOn = level.style === "side"
  return (
    <>
      {sideOn ? (
        // SIDE-ON: bright + readable like the original, but with a shadow-casting
        // key angled across the brick RELIEF so the masonry gets subtle self-
        // shadowing (depth), plus a cool fill + a warm rim for shape.
        <>
          <ambientLight intensity={0.62} />
          <directionalLight
            position={[7, 12, 16]}
            intensity={1.65}
            color="#fff4e6"
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-bias={-0.0004}
            shadow-camera-left={-40}
            shadow-camera-right={40}
            shadow-camera-top={28}
            shadow-camera-bottom={-12}
            shadow-camera-near={1}
            shadow-camera-far={80}
          />
          <directionalLight position={[-10, 5, 12]} intensity={0.45} color="#9fb8ff" />
          <directionalLight position={[0, 3, -8]} intensity={0.35} color="#ffcaa0" />
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
      {/* the box body (depth + sides + the textured back) */}
      {level.platforms.map((b, i) => {
        const color = b.tint ?? brick
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
      {/* real 3D brick relief tiled across each platform's FRONT face (-Z) */}
      <BrickRelief level={level} />
    </group>
  )
}

/**
 * BrickRelief — instanced Blender brick panels tiled over every platform's front
 * (-Z) face, giving real masonry depth instead of a flat texture. Two
 * InstancedMeshes (brick faces + mortar) share one set of per-panel transforms.
 */
function BrickRelief({ level }: { level: Level }) {
  const { scene } = useGLTF(BRICK_GLB)
  const baseBrick = level.brick ?? "#6b5a47"

  // pull the two sub-meshes (brick face / mortar) out of the panel GLB
  const { faceGeo, mortarGeo, mortarMat } = useMemo(() => {
    let face: THREE.BufferGeometry | null = null
    let mortar: THREE.BufferGeometry | null = null
    let mMat: THREE.Material | null = null
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      const matName = (mesh.material as THREE.Material)?.name ?? ""
      if (matName.includes("mortar")) { mortar = mesh.geometry; mMat = mesh.material as THREE.Material }
      else { face = mesh.geometry }
    })
    return { faceGeo: face, mortarGeo: mortar, mortarMat: mMat }
  }, [scene])

  // build per-panel instance matrices: tile the 1×1 panel across each platform
  // front face. The panel sits in the X-Y plane, pushed to the box front (-Z).
  const matrices = useMemo(() => {
    const out: THREE.Matrix4[] = []
    const T = 1.4 // panel world size (one tile)
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const s = new THREE.Vector3()
    const pos = new THREE.Vector3()
    for (const b of level.platforms) {
      const [bx, by, bz] = b.pos
      const [sx, sy, sz] = b.size
      const cols = Math.max(1, Math.round(sx / T))
      const rows = Math.max(1, Math.round(sy / T))
      const cw = sx / cols, ch = sy / rows
      const frontZ = bz + sz / 2 + 0.001
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          pos.set(bx - sx / 2 + cw * (c + 0.5), by - sy / 2 + ch * (r + 0.5), frontZ)
          s.set(cw, ch, 0.5) // scale the 1×1 panel to fill this cell, shallow on Z
          out.push(new THREE.Matrix4().compose(pos, q, s))
        }
      }
    }
    void m; void q
    return out
  }, [level])

  const faceMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: new THREE.Color(baseBrick), roughness: 0.9, metalness: 0.05 }),
    [baseBrick],
  )

  if (!faceGeo || !mortarGeo) return null
  return (
    <group>
      <instancedMesh args={[faceGeo, faceMat, matrices.length]} ref={(im) => applyMatrices(im, matrices)} castShadow receiveShadow />
      <instancedMesh args={[mortarGeo, mortarMat ?? undefined, matrices.length]} ref={(im) => applyMatrices(im, matrices)} />
    </group>
  )
}

function applyMatrices(im: THREE.InstancedMesh | null, matrices: THREE.Matrix4[]) {
  if (!im) return
  matrices.forEach((mx, i) => im.setMatrixAt(i, mx))
  im.instanceMatrix.needsUpdate = true
  im.count = matrices.length
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
  const kindOf = (i: number): GemKind => level.gemKinds?.[i] ?? "diamond"

  // The Blender faceted gem GLB, cloned per kind and tinted. (Balls stay spheres.)
  const { scene: gemScene } = useGLTF(GEM_GLB)
  const gemFor = useMemo(() => {
    const build = (mat: THREE.Material) => {
      const c = SkeletonUtils.clone(gemScene) as THREE.Group
      c.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) { (o as THREE.Mesh).material = mat; o.castShadow = true }
      })
      return c
    }
    return { diamond: build(diamondMat), ruby: build(rubyMat) }
  }, [gemScene, diamondMat, rubyMat])

  useFrame((st) => {
    const t = st.clock.elapsedTime
    const g = group.current
    if (!g) return
    g.children.forEach((child, i) => {
      if (got.current[i]) return
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
        if (k === "ball") {
          return (
            <mesh key={i} position={p} material={ballMat}>
              <sphereGeometry args={[0.4, 16, 16]} />
            </mesh>
          )
        }
        // diamond / ruby → the Blender faceted gem (cloned so each instance is its own node)
        const proto = k === "ruby" ? gemFor.ruby : gemFor.diamond
        return (
          <group key={i} position={p} scale={0.95}>
            <primitive object={proto.clone()} />
          </group>
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
  const cup = useClonedGlb(CUP_GLB)
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
      {/* Blender gold cup — GLB is ~0.8 tall built feet-at-origin; centre + scale */}
      <group position={[0, -0.4, 0]} scale={1.15}>
        <primitive object={cup} />
      </group>
      <pointLight position={[0, 0.3, 0]} color="#ffd24a" intensity={1.2} distance={6} />
    </group>
  )
}

function Door({ level, onWin }: { level: Level; onWin?: () => void }) {
  const glow = useRef<THREE.Mesh>(null)
  const lightRef = useRef<THREE.PointLight>(null)
  const won = useRef(false)
  const door = useClonedGlb(DOOR_GLB)
  useFrame((st) => {
    const open = game.hasTrophy
    // when unlocked: show the green glow + a pulsing light so it reads as "go here"
    if (glow.current) glow.current.visible = open
    if (lightRef.current) lightRef.current.intensity = open ? 1.6 + Math.sin(st.clock.elapsedTime * 4) * 0.5 : 0
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
      {/* Blender wooden door — GLB built feet-at-origin (~2.2 tall); centre it on
          the level's door point. */}
      <group position={[0, -1.0, 0]}>
        <primitive object={door} />
      </group>
      {/* green "unlocked" glow + light, shown once the cup is taken */}
      <mesh ref={glow} visible={false} position={[0, 0.1, 0.25]}>
        <planeGeometry args={[1.0, 1.9]} />
        <meshBasicMaterial color="#7dffc0" transparent opacity={0.4} toneMapped={false} />
      </mesh>
      <pointLight ref={lightRef} position={[0, 0.4, 0.6]} color="#7dffc0" intensity={0} distance={6} />
    </group>
  )
}
