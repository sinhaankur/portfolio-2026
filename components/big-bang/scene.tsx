"use client"

/**
 * The Big Bang scene — a real-time R3F field that morphs across the cosmic
 * timeline. One GPU point cloud represents "the contents of the universe": at the
 * Planck epoch it's a blinding hot point; through inflation it explodes outward;
 * it cools through the quark soup and recombination (the field fades to the CMB
 * glow); then it collapses along filaments into the first stars and galaxies.
 *
 * Colour + density + turbulence are driven by the current epoch's `visual` data
 * (see timeline.ts), interpolated smoothly. Star/galaxy/nebula *elements* are
 * textured sprites baked in Blender (public/img/space) once available; until then
 * a procedural fallback keeps it working.
 */

import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"
import { EPOCHS, epochAtLog, type Epoch } from "./timeline"

const COUNT = 9000

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

/**
 * `tLogRef` is a ref the HUD scrubs (log10 seconds since the Big Bang). The scene
 * reads it every frame so scrubbing is smooth and decoupled from React renders.
 */
export function BigBangScene({ tLogRef }: { tLogRef: React.MutableRefObject<number> }) {
  const points = useRef<THREE.Points>(null)
  const mat = useRef<THREE.PointsMaterial>(null)

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
    // map tLog (-43 .. 17.6) → 0..1 then a smooth scale curve.
    const p = THREE.MathUtils.clamp((tLog + 43) / (17.64 + 43), 0, 1)
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
    if (mat.current) mat.current.size = THREE.MathUtils.lerp(0.5, 0.06, p)

    // gentle auto-rotation
    if (points.current) points.current.rotation.y += 0.0008
  })

  return (
    <>
      <points ref={points} geometry={geo}>
        <pointsMaterial
          ref={mat}
          vertexColors
          size={0.3}
          sizeAttenuation
          transparent
          opacity={0.95}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      {/* a soft central glow that's intense early (the hot dense universe) */}
      <CoreGlow tLogRef={tLogRef} />
    </>
  )
}

/** A billboard glow at the origin — bright at the Big Bang, fading as it expands. */
function CoreGlow({ tLogRef }: { tLogRef: React.MutableRefObject<number> }) {
  const ref = useRef<THREE.Sprite>(null)
  const tex = useMemo(() => {
    // procedural radial-gradient sprite (Blender bloom texture can replace this)
    const s = 128
    const cv = document.createElement("canvas"); cv.width = cv.height = s
    const ctx = cv.getContext("2d")!
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
    g.addColorStop(0, "rgba(255,255,255,1)")
    g.addColorStop(0.3, "rgba(255,220,160,0.7)")
    g.addColorStop(1, "rgba(120,80,255,0)")
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s)
    const t = new THREE.CanvasTexture(cv); t.needsUpdate = true
    return t
  }, [])
  useFrame(() => {
    const p = THREE.MathUtils.clamp((tLogRef.current + 43) / (17.64 + 43), 0, 1)
    if (ref.current) {
      const scale = THREE.MathUtils.lerp(2.5, 22, Math.pow(p, 0.6))
      ref.current.scale.setScalar(scale)
      const m = ref.current.material as THREE.SpriteMaterial
      m.opacity = THREE.MathUtils.lerp(1.0, 0.0, Math.pow(p, 0.35))
    }
  })
  return (
    <sprite ref={ref}>
      <spriteMaterial map={tex} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </sprite>
  )
}
