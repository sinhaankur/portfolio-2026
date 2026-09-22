"use client"

/**
 * pixel-sprites — authentic Dangerous Dave pixel-art, drawn in code.
 *
 * The game is 3D, but the collectibles + hazards read best when they match the
 * original 16×16 VGA sprites tile-for-tile. Rather than smooth GLB props, each
 * item here is painted onto a tiny canvas (one canvas pixel = one sprite pixel),
 * uploaded as a NearestFilter texture (crisp, no blur), and shown on a small
 * camera-facing billboard. This is the same pixel-art technique the brick
 * masonry already uses (see `brickTexture` in world.tsx), applied to the props.
 *
 * Every sprite is authored from the real Dave palette + shapes:
 *   diamond · red ruby · gold cup (trophy) · gold crown · ring · fire · water.
 *
 * Public API:
 *   useSpriteTexture(kind)      → a memoised NearestFilter CanvasTexture
 *   <PixelBillboard kind .../>  → a bobbing, camera-facing sprite quad
 *   <FireSprite/> <WaterSprite/> → animated hazard sprite strips
 */

import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

// ── palette (authentic Dangerous Dave VGA-ish) ──────────────────────────────
const C = {
  _: null as string | null, // transparent
  // diamond (cyan)
  dHi: "#c8f6ff", dLt: "#7fe4ff", dMd: "#31c4ff", dDk: "#0b86d6", dEdge: "#075e9e",
  // ruby (red)
  rHi: "#ffb0b8", rLt: "#ff5a6e", rMd: "#e01230", rDk: "#9c0018", rEdge: "#5c000c",
  // gold (cup / crown / ring)
  gHi: "#fff6c8", gLt: "#ffe14a", gMd: "#f2b60d", gDk: "#b7790a", gEdge: "#7a4d05",
  // gem set into crown / ring
  jew: "#2fd0ff", jew2: "#ff3b5c",
  // fire
  fWhite: "#fff3c0", fYel: "#ffd21f", fOrg: "#ff8a12", fRed: "#e8340c", fDk: "#8a1704",
  // water
  wHi: "#bfeaff", wLt: "#5ab8ff", wMd: "#2f7de0", wDk: "#123f9e", wFoam: "#eafaff",
  blk: "#0a0a0a",
}

export type SpriteKind = "diamond" | "ruby" | "cup" | "crown" | "ring" | "jetpack" | "gun"

/** Each sprite is a 16×16 grid of palette keys (null = transparent). Authored to
 *  match the real 16px tiles. `.` shorthand kept readable by building from rows. */
type Grid = (string | null)[][]

// helper: expand a compact row string using a single-char → color map
function row(spec: string, map: Record<string, string | null>): (string | null)[] {
  return spec.split("").map((ch) => (ch === " " ? null : map[ch] ?? null))
}

// ── DIAMOND (cyan faceted gem) ───────────────────────────────────────────────
function diamondGrid(): Grid {
  const m = { H: C.dHi, L: C.dLt, M: C.dMd, D: C.dDk, E: C.dEdge }
  return [
    row("                ", m),
    row("      EEEE      ", m),
    row("     EHHHHE     ", m),
    row("    EHLLLLHE    ", m),
    row("   ELLMMMMLLE   ", m),
    row("  ELMMDDMMDMLE  ", m),
    row(" ELMMDDMMDDMMLE ", m),
    row("ELMDDMMDDMMDDMLE", m),
    row(" ELMDDMMDDMMDLE ", m),
    row("  ELMDDMMDDMLE  ", m),
    row("   ELMDDMMDLE   ", m),
    row("    ELMDDMLE    ", m),
    row("     ELMDLE     ", m),
    row("      ELLE      ", m),
    row("       EE       ", m),
    row("                ", m),
  ]
}

// ── RUBY (red gem, same cut, hotter palette) ─────────────────────────────────
function rubyGrid(): Grid {
  const m = { H: C.rHi, L: C.rLt, M: C.rMd, D: C.rDk, E: C.rEdge }
  return diamondGrid().map((r) =>
    r.map((cell) => {
      if (!cell) return null
      // remap the diamond palette hues → ruby hues by luminance rank
      const idx = [C.dHi, C.dLt, C.dMd, C.dDk, C.dEdge].indexOf(cell)
      return [m.H, m.L, m.M, m.D, m.E][idx] ?? C.rMd
    }),
  )
}

// ── GOLD CUP / TROPHY (the classic Dave goblet) ──────────────────────────────
function cupGrid(): Grid {
  const m = { H: C.gHi, L: C.gLt, M: C.gMd, D: C.gDk, E: C.gEdge }
  return [
    row("                ", m),
    row("  E          E  ", m),
    row("  ELHHHHHHHHLE  ", m),
    row("  ELMMMMMMMMLE  ", m),
    row("   EDMMMMMMDE   ", m),
    row("   E DMMMMD E   ", m),
    row("     EDMMDE     ", m),
    row("      EMME      ", m),
    row("      ELLE      ", m),
    row("      EMME      ", m),
    row("      EMME      ", m),
    row("     EDMMDE     ", m),
    row("    EHMMMMHE    ", m),
    row("    ELMMMMLE    ", m),
    row("   EDDDDDDDDE   ", m),
    row("                ", m),
  ]
}

// ── GOLD CROWN (jewelled) ────────────────────────────────────────────────────
function crownGrid(): Grid {
  const m = { H: C.gHi, L: C.gLt, M: C.gMd, D: C.gDk, E: C.gEdge, J: C.jew, R: C.jew2 }
  return [
    row("                ", m),
    row("                ", m),
    row("  E    E    E   ", m),
    row("  EL  ELE  LE   ", m),
    row(" EHLE EHLE ELHE ", m),
    row(" EHMLEHMMLEHMLE ", m),
    row(" ELMMMMMMMMMMLE ", m),
    row(" ELMJMMRMMJMMLE ", m),
    row(" ELMMMMMMMMMMLE ", m),
    row(" EHMMMMMMMMMMHE ", m),
    row(" ELMMMMMMMMMMLE ", m),
    row(" EDDDDDDDDDDDDE ", m),
    row("  EEEEEEEEEEEE  ", m),
    row("                ", m),
    row("                ", m),
    row("                ", m),
  ]
}

// ── GOLD RING (with a set stone) ─────────────────────────────────────────────
function ringGrid(): Grid {
  const m = { H: C.gHi, L: C.gLt, M: C.gMd, D: C.gDk, E: C.gEdge, J: C.jew2, K: C.rHi }
  return [
    row("                ", m),
    row("      EEEE      ", m),
    row("     EKJJKE     ", m),
    row("    EHJJJJHE    ", m),
    row("    ELMJJMLE    ", m),
    row("   EE ELLE EE   ", m),
    row("  EHLE    ELHE  ", m),
    row("  ELME    EMLE  ", m),
    row("  ELME    EMLE  ", m),
    row("  EHLE    ELHE  ", m),
    row("   ELLE  ELLE   ", m),
    row("    EDMMMMDE    ", m),
    row("     EDDDDE     ", m),
    row("      EEEE      ", m),
    row("                ", m),
    row("                ", m),
  ]
}

// ── JETPACK (the iconic Dave pack — grey body, orange nozzles) ────────────────
function jetpackGrid(): Grid {
  const m = {
    S: "#c9cdd6", H: "#eef1f6", D: "#7c8290", E: "#3b3f49", // steel body
    O: C.fOrg, Y: C.fYel, R: C.fRed, // exhaust
    B: "#ff4d3a", // warning band
  }
  return [
    row("                ", m),
    row("   EE    EE     ", m),
    row("   EHSE  EHSE   ", m),
    row("   ESSE  ESSE   ", m),
    row("  EEHSSEEHSSEE  ", m),
    row("  EHSSSSSSSSHE  ", m),
    row("  ESSBBBBBBSSE  ", m),
    row("  ESSSSSSSSSSE  ", m),
    row("  EHSSSSSSSSHE  ", m),
    row("  ESSDDDDDDSSE  ", m),
    row("  EEEDSSSSDEEE  ", m),
    row("    EEE  EEE    ", m),
    row("    EOE  EOE    ", m),
    row("    OYO  OYO    ", m),
    row("    ORO  ORO    ", m),
    row("     R    R     ", m),
  ]
}

// ── GUN pickup (Dave's pistol) ───────────────────────────────────────────────
function gunGrid(): Grid {
  const m = { S: "#c9cdd6", H: "#eef1f6", D: "#7c8290", E: "#3b3f49", G: "#6b4a2a" }
  return [
    row("                ", m),
    row("                ", m),
    row("                ", m),
    row("   EEEEEEEEEE   ", m),
    row("  EHSSSSSSSSSE  ", m),
    row("  ESSSSSSSSSSE  ", m),
    row("  EDDDEEEEEEEE  ", m),
    row("  EGGE          ", m),
    row("  EGGE          ", m),
    row("  EGGGE         ", m),
    row("   EGGE         ", m),
    row("   EEE          ", m),
    row("                ", m),
    row("                ", m),
    row("                ", m),
    row("                ", m),
  ]
}

const GRID_FOR: Record<SpriteKind, () => Grid> = {
  diamond: diamondGrid,
  ruby: rubyGrid,
  cup: cupGrid,
  crown: crownGrid,
  ring: ringGrid,
  jetpack: jetpackGrid,
  gun: gunGrid,
}

// ── paint a grid to a crisp NearestFilter texture (one texel per sprite pixel) ─
const texCache = new Map<string, THREE.CanvasTexture>()
function gridTexture(kind: SpriteKind): THREE.CanvasTexture {
  const hit = texCache.get(kind)
  if (hit) return hit
  const grid = GRID_FOR[kind]()
  const N = grid.length
  const c = document.createElement("canvas")
  c.width = c.height = N
  const ctx = c.getContext("2d")!
  ctx.clearRect(0, 0, N, N)
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const col = grid[y][x]
      if (!col) continue
      ctx.fillStyle = col
      ctx.fillRect(x, y, 1, 1)
    }
  }
  const tex = new THREE.CanvasTexture(c)
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  tex.generateMipmaps = false
  tex.colorSpace = THREE.SRGBColorSpace
  texCache.set(kind, tex)
  return tex
}

export function useSpriteTexture(kind: SpriteKind) {
  return useMemo(() => gridTexture(kind), [kind])
}

// ── ANIMATED HAZARD FLIPBOOKS ────────────────────────────────────────────────
// Fire + water are drawn as a few 16×16 frames cycled each frame, so they flicker
// / churn like the original animated tiles rather than sitting still.

function paintGrid(ctx: CanvasRenderingContext2D, grid: Grid) {
  const N = grid.length
  ctx.clearRect(0, 0, N, N)
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const col = grid[y][x]
      if (!col) continue
      ctx.fillStyle = col
      ctx.fillRect(x, y, 1, 1)
    }
}

function makeFlipbook(frames: Grid[]): THREE.CanvasTexture[] {
  return frames.map((g) => {
    const N = g.length
    const c = document.createElement("canvas")
    c.width = c.height = N
    paintGrid(c.getContext("2d")!, g)
    const tex = new THREE.CanvasTexture(c)
    tex.magFilter = THREE.NearestFilter
    tex.minFilter = THREE.NearestFilter
    tex.generateMipmaps = false
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  })
}

// FIRE — authentic Dave flame: a licking orange/yellow tongue over a hot base.
// Three flicker frames. Palette: white core → yellow → orange → red → dark.
function fireFrames(): Grid[] {
  const m = { W: C.fWhite, Y: C.fYel, O: C.fOrg, R: C.fRed, D: C.fDk }
  const f1 = [
    row("                ", m),
    row("       O        ", m),
    row("      ORO       ", m),
    row("      OYO        ", m),
    row("     ROYOR      ", m),
    row("     OYWYO      ", m),
    row("    ROYWYOR     ", m),
    row("    OYWWWYO     ", m),
    row("   ROYWWWYOR    ", m),
    row("   OYWWWWWYO    ", m),
    row("  ROYWWYWWYOR   ", m),
    row("  OYWWYRYWWYO   ", m),
    row(" ROYWWYRYWWYOR  ", m),
    row(" ORRYWWWWWYRRO  ", m),
    row(" DRROOOOOORRD   ", m),
    row("  DDDDDDDDDD    ", m),
  ]
  const f2 = [
    row("                ", m),
    row("        O       ", m),
    row("       OYO      ", m),
    row("      ROYO      ", m),
    row("      OYWYO     ", m),
    row("     ROYWYO     ", m),
    row("     OYWWYOR    ", m),
    row("    ROYWWWYO    ", m),
    row("    OYWWWWYOR   ", m),
    row("   ROYWWYWWYO   ", m),
    row("   OYWWYRYWWO   ", m),
    row("  ROYWWYRYWWYOR ", m),
    row("  OYWWWWYWWWYO  ", m),
    row(" RORYWWWWWYROR  ", m),
    row(" DRROOOOOORRD   ", m),
    row("  DDDDDDDDDD    ", m),
  ]
  const f3 = [
    row("                ", m),
    row("      O         ", m),
    row("      ORO       ", m),
    row("     ROYO       ", m),
    row("     OYWYOR     ", m),
    row("    ROYWYO      ", m),
    row("    OYWWYOR     ", m),
    row("   ROYWWWYO     ", m),
    row("   OYWWWWYOR    ", m),
    row("  ROYWWYWWYO    ", m),
    row("  OYWWYRYWWYOR  ", m),
    row(" ROYWWYRYWWYO   ", m),
    row(" OYWWWYWYWWWYO  ", m),
    row(" RORYWWWWWYRROR ", m),
    row(" DRROOOOOORRD   ", m),
    row("  DDDDDDDDDD    ", m),
  ]
  return [f1, f2, f3]
}

// WATER — a churning, near-boiling pool: a bright foam crest that ripples, deep
// blue body, and a few rising bubbles. Three phase frames.
function waterFrames(): Grid[] {
  const m = { F: C.wFoam, H: C.wHi, L: C.wLt, M: C.wMd, D: C.wDk, B: "#ffffff" }
  const base = (crest: string) => [
    row("                ", m),
    row("                ", m),
    row(crest, m),
    row(" HLHLHLHLHLHLHL ", m),
    row(" LMLMLMLMLMLMLM ", m),
    row(" MLMLMLMLMLMLML ", m),
    row(" MMBMMMMMMMBMMM ", m),
    row(" MMMMMMBMMMMMMM ", m),
    row(" DMMMMMMMMMMMMD ", m),
    row(" DDMMMBMMMMMMDD ", m),
    row(" DDDMMMMMMMBMDD ", m),
    row(" DDDDMMMMMMMDDD ", m),
    row(" DDDDDDMMMDDDDD ", m),
    row(" DDDDDDDDDDDDDD ", m),
    row(" DDDDDDDDDDDDDD ", m),
    row("                ", m),
  ]
  return [
    base(" FHFFHFHFFHFHFF "),
    base(" HFHFFHFHFFHFHF "),
    base(" FFHFHFFHFHFFHF "),
  ]
}

const flipCache = new Map<string, THREE.CanvasTexture[]>()
function flipbook(kind: "fire" | "water"): THREE.CanvasTexture[] {
  const hit = flipCache.get(kind)
  if (hit) return hit
  const fr = makeFlipbook(kind === "fire" ? fireFrames() : waterFrames())
  flipCache.set(kind, fr)
  return fr
}

/**
 * FireSprite — a strip of animated pixel flames across a hazard box, each column
 * flickering on its own frame so the row of fire never looks synchronised. Warm
 * light + rising ember points sell the heat.
 */
export function FireSprite({
  width,
  height,
  depth = 0.6,
  lit = true,
}: {
  width: number
  height: number
  depth?: number
  /** whether this fire casts a real point light (capped per level for perf) */
  lit?: boolean
}) {
  const frames = useMemo(() => flipbook("fire"), [])
  const cols = Math.max(1, Math.round(width / 0.7))
  const meshes = useRef<(THREE.Mesh | null)[]>([])
  const mats = useMemo(
    () =>
      Array.from(
        { length: cols },
        () =>
          new THREE.MeshBasicMaterial({
            map: frames[0],
            transparent: true,
            alphaTest: 0.5,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
          }),
      ),
    [cols, frames],
  )
  const embers = useRef<THREE.Points>(null)
  const emberSeeds = useMemo(
    () =>
      Array.from({ length: cols * 3 }, () => ({
        x: (Math.random() - 0.5) * width,
        p: Math.random() * Math.PI * 2,
        s: 0.6 + Math.random() * 0.8,
      })),
    [cols, width],
  )
  const emberGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(emberSeeds.length * 3), 3))
    return g
  }, [emberSeeds])

  useFrame((st) => {
    const t = st.clock.elapsedTime
    mats.forEach((mm, i) => {
      const f = Math.floor(t * 12 + i * 1.7) % frames.length
      mm.map = frames[f]
      mm.needsUpdate = true
    })
    meshes.current.forEach((mm, i) => {
      if (mm) mm.scale.y = 1 + Math.sin(t * 9 + i * 2.1) * 0.12
    })
    const arr = (emberGeo.attributes.position as THREE.BufferAttribute).array as Float32Array
    emberSeeds.forEach((s, i) => {
      const cyc = (t * 0.55 * s.s + s.p) % 1.4
      arr[i * 3] = s.x + Math.sin(t * 2 + s.p) * 0.08
      arr[i * 3 + 1] = height * 0.1 + cyc * 1.1
      arr[i * 3 + 2] = 0.2
    })
    ;(emberGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true
  })

  const flameH = Math.max(height * 1.4, 1.1)
  return (
    <group>
      {/* glowing coal / ember bed under the flames */}
      <mesh position={[0, -height * 0.34, 0]}>
        <boxGeometry args={[width, height * 0.35, depth]} />
        <meshStandardMaterial color="#1c0802" emissive="#b02c05" emissiveIntensity={0.7} roughness={0.95} />
      </mesh>
      {Array.from({ length: cols }, (_, c) => {
        const x = -width / 2 + (c + 0.5) * (width / cols)
        return (
          <mesh
            key={c}
            ref={(el) => { meshes.current[c] = el }}
            position={[x, flameH * 0.32, 0.02]}
            material={mats[c]}
          >
            <planeGeometry args={[width / cols + 0.15, flameH]} />
          </mesh>
        )
      })}
      <points ref={embers} geometry={emberGeo}>
        <pointsMaterial color="#ffb04a" size={0.06} transparent opacity={0.85} blending={THREE.AdditiveBlending} depthWrite={false} sizeAttenuation />
      </points>
      {lit && <pointLight color="#ff7a1f" intensity={2.4} distance={5} position={[0, 0.6, 0.6]} />}
    </group>
  )
}

/**
 * WaterSprite — animated near-boiling water: a pixel water tile scrolled/cycled
 * across the pool surface, a deep translucent body below, rising bubbles + a
 * little steam so it reads as HOT water, not a calm blue box.
 */
export function WaterSprite({
  width,
  height,
  depth = 0.6,
}: {
  width: number
  height: number
  depth?: number
}) {
  const frames = useMemo(() => flipbook("water"), [])
  const cols = Math.max(1, Math.round(width / 1.0))
  const surfMats = useMemo(
    () =>
      Array.from(
        { length: cols },
        () =>
          new THREE.MeshBasicMaterial({
            map: frames[0],
            transparent: true,
            alphaTest: 0.4,
            toneMapped: false,
          }),
      ),
    [cols, frames],
  )
  const steam = useRef<THREE.Points>(null)
  const steamSeeds = useMemo(
    () =>
      Array.from({ length: Math.max(6, cols * 3) }, () => ({
        x: (Math.random() - 0.5) * width * 0.9,
        p: Math.random() * Math.PI * 2,
        s: 0.4 + Math.random() * 0.6,
      })),
    [cols, width],
  )
  const steamGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(steamSeeds.length * 3), 3))
    return g
  }, [steamSeeds])

  useFrame((st) => {
    const t = st.clock.elapsedTime
    surfMats.forEach((mm, i) => {
      const f = Math.floor(t * 6 + i) % frames.length
      mm.map = frames[f]
      mm.needsUpdate = true
    })
    const arr = (steamGeo.attributes.position as THREE.BufferAttribute).array as Float32Array
    steamSeeds.forEach((s, i) => {
      const cyc = (t * 0.4 * s.s + s.p) % 1
      arr[i * 3] = s.x + Math.sin(t * 1.5 + s.p) * 0.12
      arr[i * 3 + 1] = height * 0.4 + cyc * 1.0
      arr[i * 3 + 2] = 0.15
    })
    ;(steamGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true
  })

  return (
    <group>
      {/* deep water body */}
      <mesh>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color="#12409e" emissive="#0a2a7a" emissiveIntensity={0.4} transparent opacity={0.75} roughness={0.1} metalness={0.1} />
      </mesh>
      {/* animated churning surface tiles */}
      {Array.from({ length: cols }, (_, c) => {
        const x = -width / 2 + (c + 0.5) * (width / cols)
        return (
          <mesh key={c} position={[x, height / 2 + 0.01, 0.02]} rotation={[-Math.PI / 2, 0, 0]} material={surfMats[c]}>
            <planeGeometry args={[width / cols + 0.05, depth * 0.98]} />
          </mesh>
        )
      })}
      {/* front-facing churn strip so the boil reads from the platformer camera */}
      {Array.from({ length: cols }, (_, c) => {
        const x = -width / 2 + (c + 0.5) * (width / cols)
        return (
          <mesh key={`f${c}`} position={[x, height * 0.18, depth / 2 + 0.02]} material={surfMats[c]}>
            <planeGeometry args={[width / cols + 0.05, height * 0.9]} />
          </mesh>
        )
      })}
      {/* rising steam wisps → "boiling hot" */}
      <points ref={steam} geometry={steamGeo}>
        <pointsMaterial color="#dff2ff" size={0.09} transparent opacity={0.35} depthWrite={false} sizeAttenuation />
      </points>
      {/* no point light — water isn't a light source, and one per water tile
          added up to a real frame cost on long pools; the surface is emissive. */}
    </group>
  )
}

/**
 * PixelBillboard — a crisp sprite quad that always faces the camera (yaw only, so
 * it stays upright like a 2D sprite in a 3D world) with a gentle float + optional
 * spin-flip. Emissive so the gems glow in the dark caverns.
 */
export function PixelBillboard({
  kind,
  size = 1.2,
  glow = 0.9,
  glowColor,
  float = true,
  y0 = 0,
}: {
  kind: SpriteKind
  size?: number
  glow?: number
  glowColor?: string
  float?: boolean
  y0?: number
}) {
  const ref = useRef<THREE.Mesh>(null)
  const tex = useSpriteTexture(kind)
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        alphaTest: 0.5, // hard pixel edges, no soft halo
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [tex],
  )
  // The camera is a fixed side-on platformer view, so the sprite quad already
  // faces it — no per-frame billboard math needed (that forced a matrix solve
  // on every gem, every frame). Only the gentle float remains, and only when
  // asked. Gems are emissive (toneMapped:false) so they glow WITHOUT a real
  // point light — dozens of dynamic lights were the main cause of the lag.
  useFrame((st) => {
    const m = ref.current
    if (!m || !float) return
    m.position.y = y0 + Math.sin(st.clock.elapsedTime * 2 + m.id) * 0.12
  })
  // glow/glowColor are kept in the signature so callers don't need to change,
  // but the glow now comes from the emissive (toneMapped:false) sprite itself
  // rather than a per-gem dynamic light — the fix for the frame-rate lag.
  void glow; void glowColor
  return (
    <group>
      <mesh ref={ref} position={[0, y0, 0]} material={mat}>
        <planeGeometry args={[size, size]} />
      </mesh>
    </group>
  )
}
