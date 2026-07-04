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
import { LEVEL_1, TILE, type Level, type Hazard, type GemKind } from "./level"
import { Atmosphere } from "./atmosphere"
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

/** Per-theme scene lighting — ties each level's mood to its atmosphere theme,
 *  so a fire cavern glows warm, ice reads cold, void goes purple, etc. */
const THEME_LIGHT: Record<string, { ambient: string; key: string; fill: string; rim: string }> = {
  cavern:  { ambient: "#8a7ab0", key: "#fff4e6", fill: "#9fb8ff", rim: "#c8a0ff" },
  fire:    { ambient: "#b06a40", key: "#ffd9a0", fill: "#ff9a5a", rim: "#ff5a2a" },
  flooded: { ambient: "#5a90c0", key: "#dff0ff", fill: "#5fb8ff", rim: "#2a9fd0" },
  machine: { ambient: "#9a9070", key: "#fff0d0", fill: "#d0c080", rim: "#c0a030" },
  ice:     { ambient: "#7fb0d0", key: "#eaf8ff", fill: "#9fd8ff", rim: "#7fd0ff" },
  void:    { ambient: "#8a60c0", key: "#f0e0ff", fill: "#b070ff", rim: "#a040ff" },
}

export function World({ level = LEVEL_1, onWin }: { level?: Level; onWin?: () => void }) {
  const sideOn = level.style === "side"
  return (
    <>
      {sideOn ? (
        // SIDE-ON: bright + readable, with a shadow-casting key across the brick
        // relief for depth, plus a per-THEME ambient + rim so each cavern reads
        // with its own mood (warm fire, cold ice, purple void, …) instead of
        // every level sharing one neutral light.
        <>
          {(() => {
            const t = THEME_LIGHT[level.theme ?? "cavern"]
            return (
              <>
                <ambientLight intensity={0.7} color={t.ambient} />
                <directionalLight
                  position={[7, 12, 16]}
                  intensity={2.0}
                  color={t.key}
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
                <directionalLight position={[-10, 5, 12]} intensity={0.5} color={t.fill} />
                <directionalLight position={[0, 3, -8]} intensity={0.4} color={t.rim} />
              </>
            )
          })()}
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

      {sideOn && (
        <Atmosphere
          theme={level.theme ?? "cavern"}
          bounds={{ w: level.bounds?.w ?? 26, h: level.bounds?.h ?? 14 }}
        />
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

/** Slow-drifting dust in the cavern air — the detail layer that makes the
 *  black background read as a SPACE instead of a void. ~70 additive points
 *  inside the room volume, each on its own drift phase; near-zero cost. */
function DustMotes({ level }: { level: Level }) {
  const ref = useRef<THREE.Points>(null)
  const { geometry, seeds } = useMemo(() => {
    const W = level.bounds?.w ?? 26
    const H = level.bounds?.h ?? 14
    const N = 70
    const pos = new Float32Array(N * 3)
    const seeds: { x: number; y: number; p: number; s: number }[] = []
    for (let i = 0; i < N; i++) {
      const x = (Math.random() - 0.5) * (W - 2)
      const y = 0.8 + Math.random() * (H - 2)
      pos.set([x, y, (Math.random() - 0.5) * 2.5], i * 3)
      seeds.push({ x, y, p: Math.random() * Math.PI * 2, s: 0.35 + Math.random() * 0.5 })
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3))
    return { geometry, seeds }
  }, [level])

  useFrame((st) => {
    const g = ref.current?.geometry
    if (!g) return
    const t = st.clock.elapsedTime
    const arr = (g.attributes.position as THREE.BufferAttribute).array as Float32Array
    for (let i = 0; i < seeds.length; i++) {
      const s = seeds[i]
      arr[i * 3] = s.x + Math.sin(t * 0.11 * s.s + s.p) * 1.2
      arr[i * 3 + 1] = s.y + Math.sin(t * 0.07 * s.s + s.p * 1.7) * 0.8
    }
    ;(g.attributes.position as THREE.BufferAttribute).needsUpdate = true
  })

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial
        color="#c8b490"
        size={0.055}
        transparent
        opacity={0.5}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  )
}

/** Back wall — a dark masonry panel closing every side-on room. Without it,
 *  tunnels and platforms float in void; with it, under-walkway passages read
 *  as actual tunnels and the whole screen reads as INSIDE a place. */
function BackWall({ level }: { level: Level }) {
  const W = level.bounds?.w ?? 26
  const H = level.bounds?.h ?? 14
  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      map: brickTexture(level.brick ?? "#6b5a47"),
      color: "#2a2a2e", // multiply the brick map down to a deep shadowed tone
      roughness: 1,
      metalness: 0,
    })
    if (m.map) {
      m.map = m.map.clone()
      m.map.needsUpdate = true
      m.map.repeat.set(Math.max(1, Math.round(W / 1.4)), Math.max(1, Math.round(H / 1.4)))
    }
    return m
  }, [level.brick, W, H])
  return (
    <mesh position={[0, H / 2 - 0.7, -0.72]} material={mat} receiveShadow>
      <planeGeometry args={[W, H]} />
    </mesh>
  )
}

// Hazards — spikes (gray cones), fire (living flame clusters + embers), water
// (translucent pool with a lit, rippling surface). Purely visual; the player's
// collision lives in player.tsx.
function Hazards({ level }: { level: Level }) {
  if (!level.hazards?.length) return null
  return (
    <group>
      {/* Recessed pits behind fire/water so they sit IN a hole in the floor,
          not on top of intact brick (spikes stay surface-mounted). */}
      {level.hazards.map((h, i) =>
        h.kind === "fire" || h.kind === "water" ? <HazardPit key={`pit-${i}`} h={h} brick={level.brick} /> : null,
      )}
      {level.hazards.map((h, i) => (
        <HazardMesh key={i} h={h} />
      ))}
    </group>
  )
}

/** A sunken cavity that carves fire/water DOWN into the floor: a dark recessed
 *  back + inner side walls + a front lip, so the hazard reads as a pit you can
 *  fall into rather than a glowing box resting on the ground. Purely visual. */
function HazardPit({ h, brick }: { h: Hazard; brick?: string }) {
  const [px, py, pz] = h.pos
  const [sx, sy] = h.size
  const depth = TILE * 1.15               // how deep the hole goes
  const wall = 0.18                       // inner wall thickness
  const wallMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: brick ?? "#6a3020", roughness: 1, metalness: 0 }),
    [brick],
  )
  const darkMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#050203", roughness: 1 }),
    [],
  )
  const cy = py - depth / 2 + sy / 2      // centre the recess below the hazard
  return (
    <group position={[px, cy, pz]}>
      {/* dark cavity back wall */}
      <mesh position={[0, 0, -TILE * 0.45]} material={darkMat}>
        <boxGeometry args={[sx + wall * 2, depth, 0.2]} />
      </mesh>
      {/* left / right inner walls */}
      <mesh position={[-sx / 2 - wall / 2, 0, 0]} material={wallMat} castShadow>
        <boxGeometry args={[wall, depth, TILE]} />
      </mesh>
      <mesh position={[sx / 2 + wall / 2, 0, 0]} material={wallMat} castShadow>
        <boxGeometry args={[wall, depth, TILE]} />
      </mesh>
      {/* pit floor at the bottom */}
      <mesh position={[0, -depth / 2 + 0.05, 0]} material={darkMat}>
        <boxGeometry args={[sx, 0.1, TILE]} />
      </mesh>
    </group>
  )
}

/** Fire — per-tile clusters of two nested flame cones (additive) that flicker
 *  and sway on independent phases, over a glowing coal bed, plus rising embers. */
function FireHazard({ h }: { h: Hazard }) {
  const cols = Math.max(1, Math.round(h.size[0] / 0.7))
  const flames = useRef<(THREE.Group | null)[]>([])
  const embers = useRef<THREE.Points>(null)
  const emberSeeds = useMemo(
    () => Array.from({ length: cols * 3 }, () => ({
      x: (Math.random() - 0.5) * h.size[0],
      p: Math.random() * Math.PI * 2,
      s: 0.6 + Math.random() * 0.8,
    })),
    [cols, h.size],
  )
  const emberGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(emberSeeds.length * 3), 3))
    return g
  }, [emberSeeds])

  useFrame((st) => {
    const t = st.clock.elapsedTime
    flames.current.forEach((f, i) => {
      if (!f) return
      const w = 0.85 + Math.sin(t * 11 + i * 2.1) * 0.18 + Math.sin(t * 23 + i) * 0.07
      f.scale.set(1 + (1 - w) * 0.5, w, 1)
      f.rotation.z = Math.sin(t * 5 + i * 1.7) * 0.08
    })
    const arr = (emberGeo.attributes.position as THREE.BufferAttribute).array as Float32Array
    emberSeeds.forEach((s, i) => {
      const cycle = (t * 0.55 * s.s + s.p) % 1.4
      arr[i * 3] = s.x + Math.sin(t * 2 + s.p) * 0.08
      arr[i * 3 + 1] = h.size[1] * 0.2 + cycle * 1.1
      arr[i * 3 + 2] = 0.2
    })
    ;(emberGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true
  })

  return (
    <group position={h.pos}>
      {/* glowing coal bed */}
      <mesh position={[0, -h.size[1] * 0.32, 0]}>
        <boxGeometry args={[h.size[0], h.size[1] * 0.36, h.size[2]]} />
        <meshStandardMaterial color="#1c0802" emissive="#8a2205" emissiveIntensity={0.55} roughness={0.95} />
      </mesh>
      {/* nested flame cones per tile-column */}
      {Array.from({ length: cols }, (_, c) => {
        const x = -h.size[0] / 2 + (c + 0.5) * (h.size[0] / cols)
        return (
          <group key={c} position={[x, h.size[1] * 0.1, 0]} ref={(el) => { flames.current[c] = el }}>
            <mesh position={[0, 0.62, 0]}>
              <coneGeometry args={[0.42, 1.35, 8]} />
              <meshBasicMaterial color="#ff5a10" transparent opacity={0.8} blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
            <mesh position={[0, 0.5, 0.06]}>
              <coneGeometry args={[0.22, 0.85, 8]} />
              <meshBasicMaterial color="#ffd23a" transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
          </group>
        )
      })}
      <points ref={embers} geometry={emberGeo}>
        <pointsMaterial color="#ffb04a" size={0.06} transparent opacity={0.85} blending={THREE.AdditiveBlending} depthWrite={false} sizeAttenuation />
      </points>
      <pointLight color="#ff7a1f" intensity={2.2} distance={4.5} position={[0, 0.6, 0.6]} />
    </group>
  )
}

/** Water — a deep translucent pool body with a bright, rippling surface strip
 *  and slow-rising bubbles, so it reads as liquid instead of a blue box. */
function WaterHazard({ h }: { h: Hazard }) {
  const surface = useRef<THREE.Mesh>(null)
  const bubbles = useRef<THREE.Points>(null)
  const seeds = useMemo(
    () => Array.from({ length: 8 }, () => ({
      x: (Math.random() - 0.5) * h.size[0] * 0.9,
      p: Math.random() * Math.PI * 2,
      s: 0.5 + Math.random() * 0.6,
    })),
    [h.size],
  )
  const bubbleGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(seeds.length * 3), 3))
    return g
  }, [seeds])

  useFrame((st) => {
    const t = st.clock.elapsedTime
    if (surface.current) {
      surface.current.position.y = h.size[1] / 2 + Math.sin(t * 1.7 + h.pos[0]) * 0.035
      const m = surface.current.material as THREE.MeshStandardMaterial
      m.opacity = 0.55 + Math.sin(t * 2.3 + h.pos[0] * 2) * 0.12
    }
    const arr = (bubbleGeo.attributes.position as THREE.BufferAttribute).array as Float32Array
    seeds.forEach((s, i) => {
      const cycle = (t * 0.35 * s.s + s.p) % 1
      arr[i * 3] = s.x + Math.sin(t * 1.2 + s.p) * 0.06
      arr[i * 3 + 1] = -h.size[1] / 2 + cycle * h.size[1]
      arr[i * 3 + 2] = 0.15
    })
    ;(bubbleGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true
  })

  return (
    <group position={h.pos}>
      {/* pool body */}
      <mesh>
        <boxGeometry args={h.size} />
        <meshStandardMaterial color="#1a4fd6" emissive="#0a2a7a" emissiveIntensity={0.35} transparent opacity={0.6} roughness={0.15} metalness={0.1} />
      </mesh>
      {/* lit surface strip */}
      <mesh ref={surface} position={[0, h.size[1] / 2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[h.size[0] * 0.98, h.size[2] * 0.98]} />
        <meshStandardMaterial color="#7ec2ff" emissive="#3a7ad6" emissiveIntensity={0.5} transparent opacity={0.6} roughness={0.05} depthWrite={false} />
      </mesh>
      <points ref={bubbles} geometry={bubbleGeo}>
        <pointsMaterial color="#bfe4ff" size={0.045} transparent opacity={0.7} depthWrite={false} sizeAttenuation />
      </points>
    </group>
  )
}

function HazardMesh({ h }: { h: Hazard }) {
  if (h.kind === "fire") return <FireHazard h={h} />
  if (h.kind === "water") return <WaterHazard h={h} />
  return <SpikeHazard h={h} />
}

function SpikeHazard({ h }: { h: Hazard }) {
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#9aa0ad", roughness: 0.5, metalness: 0.4 }),
    [],
  )
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
// Deterministic per-color noise so a brick wall's pixel pattern is stable.
function seeded(seed: number) {
  let s = seed >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
}
function brickTexture(color: string): THREE.CanvasTexture {
  const hit = brickTexCache.get(color)
  if (hit) return hit
  // PIXEL-ART brick: paint on a small P×P grid so every cell is a chunky pixel,
  // then let nearest-neighbour filtering keep the crisp retro edges. Per-brick
  // tone variation + a lit top/left highlight and dark bottom/right shadow give
  // the masonry real pixel depth; a few cracks + speckles add grit.
  const P = 32                 // logical pixel grid (chunky)
  const c = document.createElement("canvas")
  c.width = c.height = P
  const ctx = c.getContext("2d")!
  const base = new THREE.Color(color)
  const rng = seeded(base.getHex() || 1)
  const px = (x: number, y: number, col: THREE.Color, a = 1) => {
    ctx.fillStyle = `rgba(${col.r * 255 | 0},${col.g * 255 | 0},${col.b * 255 | 0},${a})`
    ctx.fillRect(x, y, 1, 1)
  }
  // mortar background
  const mortar = base.clone().multiplyScalar(0.28)
  ctx.fillStyle = `rgb(${mortar.r * 255 | 0},${mortar.g * 255 | 0},${mortar.b * 255 | 0})`
  ctx.fillRect(0, 0, P, P)
  const rows = 4, bh = P / rows, bw = P / 2, mortarGap = 1
  for (let r = 0; r < rows; r++) {
    const off = r % 2 === 0 ? 0 : -bw / 2
    for (let bx = -1; bx < 3; bx++) {
      const x0 = Math.round(bx * bw + off) + mortarGap
      const y0 = Math.round(r * bh) + mortarGap
      const w = bw - mortarGap, h = bh - mortarGap
      const tone = 0.78 + rng() * 0.34
      const body = base.clone().multiplyScalar(tone)
      const hi = body.clone().lerp(new THREE.Color("#ffffff"), 0.22)
      const lo = body.clone().multiplyScalar(0.6)
      for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
        const gx = x0 + xx, gy = y0 + yy
        if (gx < 0 || gx >= P || gy < 0 || gy >= P) continue
        let col = body
        if (yy === 0 || xx === 0) col = hi                 // lit top/left edge
        else if (yy === h - 1 || xx === w - 1) col = lo     // shadow bottom/right
        else if (rng() < 0.08) col = body.clone().multiplyScalar(0.85) // speckle
        px(gx, gy, col)
      }
      // an occasional crack pixel through the brick face
      if (rng() < 0.35) {
        const cx = x0 + 1 + Math.floor(rng() * (w - 2))
        px(cx, y0 + 1 + Math.floor(rng() * (h - 2)), lo.clone().multiplyScalar(0.7))
      }
    }
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.magFilter = THREE.NearestFilter   // crisp pixels, no blur
  tex.minFilter = THREE.NearestFilter
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
          <group key={i}>
            <mesh position={b.pos} castShadow receiveShadow material={m}>
              <boxGeometry args={b.size} />
            </mesh>
            {/* faint glowing lip along the top-front edge — so every ledge reads
                clearly in the dark and the player always sees where to land. */}
            <mesh position={[b.pos[0], b.pos[1] + b.size[1] / 2 - 0.03, b.pos[2] + b.size[2] / 2 + 0.02]}>
              <boxGeometry args={[b.size[0] * 0.98, 0.06, 0.04]} />
              <meshBasicMaterial color={edgeGlow(color)} transparent opacity={0.55} toneMapped={false} />
            </mesh>
          </group>
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

  // TOP-CAP matrices: cap each platform's WALK surface (the top the side-on
  // camera looks down on) with the same brick panel laid flat, so the surface
  // you stand on reads as chiselled masonry instead of a plain textured lid.
  const topMatrices = useMemo(() => {
    const out: THREE.Matrix4[] = []
    const T = 1.4
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)) // lay flat
    const s = new THREE.Vector3()
    const pos = new THREE.Vector3()
    for (const b of level.platforms) {
      const [bx, by, bz] = b.pos
      const [sx, sy, sz] = b.size
      const cols = Math.max(1, Math.round(sx / T))
      const depth = Math.max(1, Math.round(sz / T))
      const cw = sx / cols, cd = sz / depth
      const topY = by + sy / 2 + 0.001
      for (let c = 0; c < cols; c++) {
        for (let d = 0; d < depth; d++) {
          pos.set(bx - sx / 2 + cw * (c + 0.5), topY, bz - sz / 2 + cd * (d + 0.5))
          s.set(cw, cd, 0.4)
          out.push(new THREE.Matrix4().compose(pos, q, s))
        }
      }
    }
    return out
  }, [level])

  const faceMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: new THREE.Color(baseBrick), roughness: 0.9, metalness: 0.05 }),
    [baseBrick],
  )
  // top caps read slightly brighter (lit from above) so the walk surface pops.
  const topMat = useMemo(() => {
    const c = new THREE.Color(baseBrick).lerp(new THREE.Color("#ffffff"), 0.15)
    return new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0.05 })
  }, [baseBrick])

  if (!faceGeo || !mortarGeo) return null
  return (
    <group>
      <instancedMesh args={[faceGeo, faceMat, matrices.length]} ref={(im) => applyMatrices(im, matrices)} castShadow receiveShadow />
      <instancedMesh args={[mortarGeo, mortarMat ?? undefined, matrices.length]} ref={(im) => applyMatrices(im, matrices)} />
      {/* masonry walk-surface caps on top of every platform */}
      <instancedMesh args={[faceGeo, topMat, topMatrices.length]} ref={(im) => applyMatrices(im, topMatrices)} castShadow receiveShadow />
      <instancedMesh args={[mortarGeo, mortarMat ?? undefined, topMatrices.length]} ref={(im) => applyMatrices(im, topMatrices)} />
    </group>
  )
}

/** A brightened tint of the platform color for the glowing ledge rim, so the
 *  lip reads as a lit edge that matches the level's palette. */
function edgeGlow(color: string): string {
  return "#" + new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.55).getHexString()
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
              <sphereGeometry args={[0.45, 16, 16]} />
            </mesh>
          )
        }
        // diamond / ruby → the Blender faceted gem (cloned so each instance is its own node)
        const proto = k === "ruby" ? gemFor.ruby : gemFor.diamond
        return (
          <group key={i} position={p} scale={1.15}>
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
          {/* tube body — CLOSED so orbit angles never see a hollow black disc */}
          <mesh material={mat}>
            <cylinderGeometry args={[0.42, 0.42, 0.9, 18]} />
          </mesh>
          {/* pipe mouth: inset dark disc + a rim lip on the camera-facing end,
              so end-on it reads as a pipe opening, not a void */}
          <mesh position={[0, 0.451, 0]} rotation={[-Math.PI / 2, 0, 0]} material={dark}>
            <circleGeometry args={[0.34, 18]} />
          </mesh>
          <mesh position={[0, 0.44, 0]} rotation={[Math.PI / 2, 0, 0]} material={mat}>
            <torusGeometry args={[0.4, 0.05, 10, 24]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function Trophy({ level }: { level: Level }) {
  const ref = useRef<THREE.Group>(null)
  const burstGroup = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Mesh>(null)
  const flash = useRef<THREE.PointLight>(null)
  const taken = useRef(false)
  const takenAt = useRef(-1)
  const cup = useClonedGlb(CUP_GLB)
  useFrame((st) => {
    const g = ref.current
    if (g && !taken.current) {
      g.rotation.y = st.clock.elapsedTime * 1.2
      g.position.y = level.trophy[1] + Math.sin(st.clock.elapsedTime * 1.6) * 0.15
      if (game.playerPos.distanceTo(g.position) < 1.6) {
        taken.current = true
        takenAt.current = st.clock.elapsedTime
        g.visible = false
        game.hasTrophy = true
        game.fx.collectAt = st.clock.elapsedTime
        game.fx.collectPos.set(...level.trophy)
      }
    }
    // pickup burst: an expanding golden ring + flash that plays for ~0.6s
    if (taken.current && burstGroup.current) {
      const dt = st.clock.elapsedTime - takenAt.current
      const alive = dt < 0.7
      burstGroup.current.visible = alive
      if (alive) {
        const p = dt / 0.7
        if (ring.current) {
          const s = 0.4 + p * 3.2
          ring.current.scale.set(s, s, s)
          ;(ring.current.material as THREE.MeshBasicMaterial).opacity = (1 - p) * 0.8
        }
        if (flash.current) flash.current.intensity = (1 - p) * 6
      }
    }
  })
  return (
    <>
      <group ref={ref} position={level.trophy}>
        <group position={[0, -0.4, 0]} scale={1.15}>
          <primitive object={cup} />
        </group>
        <pointLight position={[0, 0.3, 0]} color="#ffd24a" intensity={1.2} distance={6} />
      </group>
      {/* celebratory pickup burst — expanding gold ring + flash */}
      <group ref={burstGroup} position={level.trophy} visible={false}>
        <mesh ref={ring} rotation={[0, 0, 0]}>
          <ringGeometry args={[0.5, 0.62, 24]} />
          <meshBasicMaterial color="#ffe07a" transparent opacity={0.8} toneMapped={false} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
        <pointLight ref={flash} color="#ffe6a0" intensity={0} distance={8} />
      </group>
    </>
  )
}

function Door({ level, onWin }: { level: Level; onWin?: () => void }) {
  const glow = useRef<THREE.Mesh>(null)
  const runes = useRef<THREE.Mesh>(null)
  const lightRef = useRef<THREE.PointLight>(null)
  const sparks = useRef<THREE.Points>(null)
  const won = useRef(false)
  const openT = useRef(0)          // 0→1 unlock animation progress
  const wasOpen = useRef(false)
  const door = useClonedGlb(DOOR_GLB)

  // a ring of ascending "unlock" sparks that burst when the relic is taken
  const sparkGeo = useMemo(() => {
    const n = 26
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3))
    return g
  }, [])
  const sparkSeeds = useMemo(
    () => Array.from({ length: 26 }, () => ({
      a: Math.random() * Math.PI * 2, r: 0.3 + Math.random() * 0.5,
      spd: 0.6 + Math.random() * 0.9, p: Math.random(),
    })),
    [],
  )

  useFrame((st, dt) => {
    const open = game.hasTrophy
    // ease the unlock progress in when the relic is first taken (one-way)
    if (open) openT.current = Math.min(1, openT.current + dt * 2.5)
    const k = openT.current
    if (glow.current) {
      glow.current.visible = k > 0.01
      const m = glow.current.material as THREE.MeshBasicMaterial
      m.opacity = 0.25 * k + Math.sin(st.clock.elapsedTime * 4) * 0.12 * k
    }
    if (runes.current) {
      runes.current.visible = k > 0.01
      runes.current.rotation.z = st.clock.elapsedTime * 0.6
      ;(runes.current.material as THREE.MeshBasicMaterial).opacity = 0.5 * k
    }
    if (lightRef.current) lightRef.current.intensity = k * (2.0 + Math.sin(st.clock.elapsedTime * 4) * 0.6)

    // spark burst on the FIRST frame it opens, then a gentle rising shimmer
    if (open && !wasOpen.current) game.fx.collectAt = st.clock.elapsedTime // reuse chime cue
    wasOpen.current = open
    if (sparks.current) {
      sparks.current.visible = k > 0.01
      const arr = (sparkGeo.attributes.position as THREE.BufferAttribute).array as Float32Array
      const t = st.clock.elapsedTime
      sparkSeeds.forEach((s, i) => {
        const cyc = (t * s.spd + s.p) % 1
        arr[i * 3] = Math.cos(s.a) * s.r * (0.6 + cyc)
        arr[i * 3 + 1] = -0.6 + cyc * 2.2
        arr[i * 3 + 2] = 0.3 + Math.sin(s.a) * s.r * 0.4
      })
      ;(sparkGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true
      ;(sparks.current.material as THREE.PointsMaterial).opacity = 0.85 * k
    }

    if (open && !won.current && game.phase === "playing") {
      if (game.playerPos.distanceTo(new THREE.Vector3(...level.door)) < 1.8) {
        won.current = true
        game.phase = "levelClear"
        onWin?.()
      }
    }
  })
  return (
    <group position={level.door}>
      <group position={[0, -0.7, 0]}>
        <primitive object={door} />
      </group>
      {/* soft green portal glow */}
      <mesh ref={glow} visible={false} position={[0, 0.1, 0.25]}>
        <planeGeometry args={[1.0, 1.9]} />
        <meshBasicMaterial color="#7dffc0" transparent opacity={0.4} toneMapped={false} depthWrite={false} />
      </mesh>
      {/* a slowly-turning rune ring behind the door — "this gate is now active" */}
      <mesh ref={runes} visible={false} position={[0, 0.1, 0.18]}>
        <ringGeometry args={[0.7, 0.82, 6]} />
        <meshBasicMaterial color="#aeffd8" transparent opacity={0} toneMapped={false} depthWrite={false} />
      </mesh>
      {/* rising unlock sparks */}
      <points ref={sparks} geometry={sparkGeo} visible={false}>
        <pointsMaterial color="#c8ffe0" size={0.09} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} sizeAttenuation />
      </points>
      <pointLight ref={lightRef} position={[0, 0.4, 0.6]} color="#7dffc0" intensity={0} distance={7} />
    </group>
  )
}
