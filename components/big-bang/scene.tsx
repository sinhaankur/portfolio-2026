"use client"

/**
 * The Big Bang scene — a real-time R3F field that morphs across the cosmic
 * timeline. One GPU point cloud represents "the contents of the universe": at the
 * Planck epoch it's a blinding hot point; through inflation it explodes outward;
 * it cools through the quark soup and recombination (the field fades to the CMB
 * glow); then it collapses along filaments into the first stars and galaxies.
 *
 * Colour + density + turbulence are driven by the current epoch's `visual` data
 * (see timeline.ts), interpolated smoothly.
 *
 * Every *element* is Blender-baked (Cycles → public/img/space/bigbang/, made by
 * blender/big-bang/bake_elements.py): each particle is the `star` sprite, the
 * recombination "first light" is the `cmb` all-sky dome, and dusty depth comes
 * from `nebula` billboards. The R3F layer stays real-time/interactive; the things
 * you actually see were rendered in Blender — like the Universe Engine's globes.
 */

import { useMemo, useRef } from "react"
import { useFrame, useLoader } from "@react-three/fiber"
import * as THREE from "three"
import { epochAtLog, type Epoch } from "./timeline"

const COUNT = 9000

// Blender-baked element textures (Cycles renders).
const BASE = "/img/space/bigbang"
const STAR_TEX = `${BASE}/star.webp`
const NEBULA_TEX = `${BASE}/nebula.webp`
const CMB_TEX = `${BASE}/cmb.webp`

// the universe's log-time span, mirrored from timeline.ts for the 0..1 remap
const T_MIN = -43
const T_SPAN = 17.64 + 43

function lerpColor(a: string, b: string, t: number): THREE.Color {
  return new THREE.Color(a).lerp(new THREE.Color(b), t)
}

/** smoothly interpolate the visual of the timeline at a given log-time */
function visualAt(tLog: number) {
  const { epoch, next, frac } = epochAtLog(tLog)
  const e: Epoch = epoch
  const n: Epoch = next ?? epoch
  const pal0 = lerpColor(e.visual.palette[0], n.visual.palette[0], frac)
  const pal1 = lerpColor(e.visual.palette[1], n.visual.palette[1], frac)
  const pal2 = lerpColor(e.visual.palette[2], n.visual.palette[2], frac)
  const density = THREE.MathUtils.lerp(e.visual.density, n.visual.density, frac)
  const chaos = THREE.MathUtils.lerp(e.visual.chaos, n.visual.chaos, frac)
  return { pal0, pal1, pal2, density, chaos, epoch: e, frac }
}

/** 0..1 progress across the whole history, given log-time */
function progress01(tLog: number) {
  return THREE.MathUtils.clamp((tLog - T_MIN) / T_SPAN, 0, 1)
}

/**
 * `tLogRef` is a ref the HUD scrubs (log10 seconds since the Big Bang). The scene
 * reads it every frame so scrubbing is smooth and decoupled from React renders.
 */
export function BigBangScene({ tLogRef }: { tLogRef: React.MutableRefObject<number> }) {
  const points = useRef<THREE.Points>(null)
  const mat = useRef<THREE.PointsMaterial>(null)

  // the Blender star sprite — gives every particle a round soft glow (no squares)
  const starTex = useLoader(THREE.TextureLoader, STAR_TEX)

  // base random directions + radii for each particle (stable across frames)
  const base = useMemo(() => {
    const dir = new Float32Array(COUNT * 3)
    const rand = new Float32Array(COUNT)
    const v = new THREE.Vector3()
    for (let i = 0; i < COUNT; i++) {
      v.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1)
      if (v.lengthSq() < 1e-4) v.set(0, 1, 0)
      v.normalize()
      dir[i * 3] = v.x; dir[i * 3 + 1] = v.y; dir[i * 3 + 2] = v.z
      rand[i] = Math.random()
    }
    return { dir, rand }
  }, [])

  const positions = useMemo(() => new Float32Array(COUNT * 3), [])
  const colors = useMemo(() => new Float32Array(COUNT * 3), [])

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3))
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3))
    return g
  }, [positions, colors])

  useFrame((st) => {
    const tLog = tLogRef.current
    const { pal0, pal1, pal2, density, chaos } = visualAt(tLog)

    // expansion factor: tiny at the Planck epoch, large by "today".
    const p = progress01(tLog)
    const expansion = 0.15 + Math.pow(p, 0.6) * 9.5
    // structure: early = smooth shell; late = clumped along filaments
    const clump = THREE.MathUtils.clamp((p - 0.5) * 2, 0, 1)
    const t = st.clock.elapsedTime

    const pos = positions
    const col = colors
    for (let i = 0; i < COUNT; i++) {
      const dx = base.dir[i * 3], dy = base.dir[i * 3 + 1], dz = base.dir[i * 3 + 2]
      const r0 = base.rand[i]
      // radius grows with expansion; chaos adds turbulence; clump pulls some in
      const turb = (Math.sin(r0 * 40 + t * 0.4) * 0.5 + 0.5) * chaos
      let radius = expansion * (0.35 + r0 * 0.65) * (1 - turb * 0.35)
      // filamentary clumping late: bias radius toward shells
      if (clump > 0) {
        const shell = 0.6 + Math.sin(r0 * 12.0) * 0.4 * clump
        radius = THREE.MathUtils.lerp(radius, expansion * shell, clump * 0.5)
      }
      pos[i * 3] = dx * radius
      pos[i * 3 + 1] = dy * radius
      pos[i * 3 + 2] = dz * radius

      // colour: hot core → mid → cool by particle radius fraction
      const f = r0
      const c = f < 0.5 ? pal0.clone().lerp(pal1, f * 2)
                        : pal1.clone().lerp(pal2, (f - 0.5) * 2)
      // dim particles that "don't exist yet" at low density
      const vis = r0 < density ? 1 : 0.12
      col[i * 3] = c.r * vis; col[i * 3 + 1] = c.g * vis; col[i * 3 + 2] = c.b * vis
    }
    geo.attributes.position.needsUpdate = true
    geo.attributes.color.needsUpdate = true

    // particles shrink as space expands (so early = big hot blobs, late = fine stars)
    if (mat.current) mat.current.size = THREE.MathUtils.lerp(0.55, 0.09, p)

    // gentle auto-rotation
    if (points.current) points.current.rotation.y += 0.0008
  })

  return (
    <>
      <points ref={points} geometry={geo}>
        {/* Blender star sprite as the point texture → round glowing particles */}
        <pointsMaterial
          ref={mat}
          map={starTex}
          alphaMap={starTex}
          vertexColors
          size={0.4}
          sizeAttenuation
          transparent
          opacity={0.95}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      {/* recombination "first light" — the Blender-baked CMB all-sky dome */}
      <CmbDome tLogRef={tLogRef} />
      {/* dusty depth in the structure-forming epochs — Blender nebula billboards */}
      <NebulaField tLogRef={tLogRef} />
      {/* a soft central glow that's intense early (the hot dense universe) */}
      <CoreGlow tLogRef={tLogRef} starTex={starTex} />
    </>
  )
}

/**
 * The CMB dome: a large inward-facing sphere mapped with the Blender CMB render.
 * It fades IN around recombination (~10^13 s, the "first light") and back OUT as
 * the universe goes transparent and structure takes over — so you briefly stand
 * inside the surface of last scattering.
 */
function CmbDome({ tLogRef }: { tLogRef: React.MutableRefObject<number> }) {
  const ref = useRef<THREE.Mesh>(null)
  const cmbTex = useLoader(THREE.TextureLoader, CMB_TEX)

  // recombination sits at ~1.2e13 s → log ≈ 13.08; fade window around it
  const REC = Math.log10(1.2e13)
  useFrame(() => {
    const tLog = tLogRef.current
    // triangular fade: 0 before REC-2, peak at REC, 0 by REC+2.2 (in log decades)
    const d = tLog - REC
    let a = 0
    if (d > -2.2 && d <= 0) a = (d + 2.2) / 2.2
    else if (d > 0 && d < 2.4) a = 1 - d / 2.4
    a = THREE.MathUtils.clamp(a, 0, 1)
    if (ref.current) {
      const m = ref.current.material as THREE.MeshBasicMaterial
      m.opacity = a * 0.55
      ref.current.visible = a > 0.001
      ref.current.rotation.y += 0.0002
    }
  })

  return (
    <mesh ref={ref} scale={120}>
      <sphereGeometry args={[1, 48, 32]} />
      <meshBasicMaterial
        map={cmbTex}
        side={THREE.BackSide}
        transparent
        opacity={0}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}

/**
 * A handful of Blender nebula billboards scattered at mid-distance. They fade in
 * during the dark-ages → first-stars → galaxies epochs to give the late universe
 * dusty depth behind the star field. Pure background; they don't move with time
 * beyond a slow drift.
 */
function NebulaField({ tLogRef }: { tLogRef: React.MutableRefObject<number> }) {
  const group = useRef<THREE.Group>(null)
  const nebTex = useLoader(THREE.TextureLoader, NEBULA_TEX)

  const clouds = useMemo(() => {
    const out: { pos: [number, number, number]; scale: number; rot: number; tint: THREE.Color }[] = []
    const tints = ["#5a3a8a", "#7a4a6a", "#3a4a8a", "#8a5a4a"]
    for (let i = 0; i < 7; i++) {
      const r = 14 + Math.random() * 10
      const th = Math.random() * Math.PI * 2
      const ph = Math.acos(2 * Math.random() - 1)
      out.push({
        pos: [
          r * Math.sin(ph) * Math.cos(th),
          r * Math.cos(ph) * 0.6,
          r * Math.sin(ph) * Math.sin(th),
        ],
        scale: 9 + Math.random() * 9,
        rot: Math.random() * Math.PI,
        tint: new THREE.Color(tints[i % tints.length]),
      })
    }
    return out
  }, [])

  useFrame(() => {
    // structure epochs: p ~ 0.78 (dark ages) → 1.0 (today). Fade in across that.
    const p = progress01(tLogRef.current)
    const a = THREE.MathUtils.clamp((p - 0.74) / 0.18, 0, 1)
    if (group.current) {
      group.current.visible = a > 0.001
      group.current.children.forEach((c) => {
        const m = (c as THREE.Sprite).material as THREE.SpriteMaterial
        m.opacity = a * 0.5
      })
      group.current.rotation.y += 0.00012
    }
  })

  return (
    <group ref={group}>
      {clouds.map((c, i) => (
        <sprite key={i} position={c.pos} scale={[c.scale, c.scale, 1]}>
          <spriteMaterial
            map={nebTex}
            color={c.tint}
            transparent
            opacity={0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            rotation={c.rot}
          />
        </sprite>
      ))}
    </group>
  )
}

/**
 * A billboard glow at the origin — bright at the Big Bang, fading as it expands.
 * Reuses the Blender star sprite as the bloom texture (so the central first-light
 * is the same baked element, not a separate procedural gradient).
 */
function CoreGlow({
  tLogRef,
  starTex,
}: {
  tLogRef: React.MutableRefObject<number>
  starTex: THREE.Texture
}) {
  const ref = useRef<THREE.Sprite>(null)
  useFrame(() => {
    const p = progress01(tLogRef.current)
    if (ref.current) {
      const scale = THREE.MathUtils.lerp(3.0, 24, Math.pow(p, 0.6))
      ref.current.scale.setScalar(scale)
      const m = ref.current.material as THREE.SpriteMaterial
      m.opacity = THREE.MathUtils.lerp(1.0, 0.0, Math.pow(p, 0.32))
    }
  })
  return (
    <sprite ref={ref}>
      <spriteMaterial
        map={starTex}
        color={"#fff0d8"}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </sprite>
  )
}
