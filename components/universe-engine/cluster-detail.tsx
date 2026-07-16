"use client"

/**
 * Star clusters — resolved member stars instead of placeholder blobs.
 *
 * Two layers, both honest to how clusters actually look and behave:
 *
 *  1. ClusterStarField — ONE merged <points> holding a modest idle sprinkle of
 *     member stars for every cluster in the catalog (~395 objects). This is
 *     the "binoculars" view: the fuzzy core glow (still rendered by
 *     SkyPointMesh) starts to granulate into individual stars. One draw call
 *     for the whole sky — it REPLACES the old per-cluster spray of 7 sphere
 *     meshes (395 × 7 ≈ 2,800 draws) that read as grey blobs.
 *
 *  2. ClusterDetail — a per-cluster resolved simulation that blooms in on
 *     hover/focus: the "telescope" view. Hundreds to thousands of stars
 *     sampled from a Plummer density profile (the standard first-order model
 *     for cluster structure), revealed core-outward like optics resolving the
 *     object.
 *
 * Population synthesis follows the real physics, per cluster type:
 *  - GLOBULAR (old, population II): warm white/yellow evolved stars, a sprinkle
 *    of orange/red giants, a few percent hot blue horizontal-branch stars —
 *    concentrated toward the dense core. Compact profile, near-spherical.
 *  - OPEN (young, population I): blue-white B/A main-sequence stars dominate,
 *    with a handful of bright evolved orange giants (M37's signature look),
 *    in a looser, slightly clumpy distribution.
 *
 * The individual member positions are procedural (seeded per cluster id, so
 * they're stable frame-to-frame and session-to-session) — real per-star
 * astrometry for 395 clusters isn't in our data budget. The profile, colour
 * mix, and concentration ARE the known astrophysics; the InfoPanel copy stays
 * strictly catalog-sourced.
 */

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  ShaderMaterial,
} from "three"
import { raDecToScenePos, skyPoints } from "./astronomy"
import { skyDepthRadius } from "./scene-shared"

/** Deterministic per-cluster RNG so member stars never re-roll. */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashId(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** A cluster's type is in its OpenNGC-derived fact ("Globular cluster in…"). */
export const isGlobular = (fact: string): boolean => /globular/i.test(fact)

// Population tables: [r, g, b, weight, sizeMul]. Colours are blackbody-ish
// sRGB approximations for the stellar classes that dominate each population.
type Pop = [number, number, number, number, number]
const GLOBULAR_POP: Pop[] = [
  [1.0, 0.93, 0.78, 0.42, 1.0], // old F/G subgiants — warm white
  [1.0, 0.88, 0.68, 0.28, 1.0], // K stars — yellow
  [1.0, 0.72, 0.45, 0.12, 1.9], // K/M giants — orange, visibly brighter
  [0.8, 0.87, 1.0, 0.1, 1.25], // horizontal branch / blue stragglers
  [1.0, 0.62, 0.38, 0.08, 2.2], // reddest giants — the standout points
]
const OPEN_POP: Pop[] = [
  [0.82, 0.88, 1.0, 0.5, 1.2], // B/A main sequence — blue-white
  [0.9, 0.94, 1.0, 0.2, 1.0], // late A/F — pale blue-white
  [1.0, 0.96, 0.86, 0.2, 1.0], // F/G — white-yellow
  [1.0, 0.7, 0.42, 0.1, 2.0], // evolved orange-red giants
]

function pickPop(pops: Pop[], u: number): Pop {
  let acc = 0
  for (const p of pops) {
    acc += p[3]
    if (u <= acc) return p
  }
  return pops[0]
}

/**
 * Sample one cluster's member stars. Plummer profile: the cumulative-mass
 * inverse r = a / sqrt(u^(-2/3) − 1) gives the classic dense-core/soft-halo
 * falloff. Globulars get a tight core (a = 0.32·R) and near-spherical shape;
 * open clusters a loose core (a = 0.55·R) plus a couple of sub-clumps.
 */
function sampleCluster(opts: {
  seed: number
  count: number
  radius: number
  globular: boolean
  sizeBase: number
  sizeSpread: number
}): { offsets: Float32Array; colors: Float32Array; sizes: Float32Array; radii: Float32Array } {
  const { seed, count, radius, globular, sizeBase, sizeSpread } = opts
  const rng = mulberry32(seed)
  const offsets = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const radii = new Float32Array(count)

  const a = radius * (globular ? 0.32 : 0.55)
  const rMax = radius * (globular ? 2.4 : 2.0)
  const pops = globular ? GLOBULAR_POP : OPEN_POP

  // Open clusters aren't smooth — sample 3 mild sub-clump centres.
  const clumps: [number, number, number][] = []
  if (!globular) {
    for (let c = 0; c < 3; c++) {
      clumps.push([
        (rng() * 2 - 1) * radius * 0.9,
        (rng() * 2 - 1) * radius * 0.9,
        (rng() * 2 - 1) * radius * 0.9,
      ])
    }
  }

  for (let i = 0; i < count; i++) {
    const u = Math.max(1e-4, rng())
    let r = a / Math.sqrt(Math.pow(u, -2 / 3) - 1)
    if (r > rMax) r = rMax * (0.75 + rng() * 0.25)

    // Uniform direction on the sphere.
    const v = rng() * 2 - 1
    const theta = rng() * Math.PI * 2
    const s = Math.sqrt(1 - v * v)
    let x = r * s * Math.cos(theta)
    let y = r * v
    let z = r * s * Math.sin(theta)

    // A third of open-cluster stars gather around a sub-clump.
    if (!globular && rng() < 0.35) {
      const [cx, cy, cz] = clumps[Math.floor(rng() * clumps.length)]
      x = cx + x * 0.35
      y = cy + y * 0.35
      z = cz + z * 0.35
    }

    offsets[i * 3] = x
    offsets[i * 3 + 1] = y
    offsets[i * 3 + 2] = z
    radii[i] = Math.min(1, Math.sqrt(x * x + y * y + z * z) / rMax)

    const pop = pickPop(pops, rng())
    // Blue stragglers concentrate in globular cores — resample core-heavy.
    const jitter = () => (rng() - 0.5) * 0.08
    colors[i * 3] = Math.min(1, pop[0] + jitter())
    colors[i * 3 + 1] = Math.min(1, pop[1] + jitter())
    colors[i * 3 + 2] = Math.min(1, pop[2] + jitter())

    const t = rng()
    sizes[i] = (sizeBase + t * t * sizeSpread) * pop[4]
  }

  return { offsets, colors, sizes, radii }
}

// Shared point shader — tight core + soft halo like the HYG star field, with a
// per-star twinkle seeded from position and a core-outward reveal driven by
// the normalized radius attribute (uReveal 0→1 resolves the cluster from its
// dense centre outward, the way real optics do).
const CLUSTER_VERTEX = /* glsl */ `
  attribute float size;
  attribute vec3 color;
  attribute float aRadius;
  varying vec3 vColor;
  varying float vBrightness;
  varying float vRadius;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uPerspective;

  void main() {
    vColor = color;
    vBrightness = clamp(size / 3.5, 0.0, 1.0);
    vRadius = aRadius;
    float seed = position.x * 0.91 + position.y * 1.37 + position.z * 1.13;
    float twinkle = 1.0 + 0.12 * sin(uTime * 2.1 + seed * 37.0);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    // Two sizing modes:
    //  - Flat (idle field): constant pixel size, right for a far-away sprinkle
    //    seen from anywhere (same rationale as BrightStarField).
    //  - Perspective (resolved detail): stars GROW as the camera flies in, so
    //    arriving at a cluster feels like arriving — without this the members
    //    stay 1–2 px dust and the fly-in lands on an anticlimax.
    float persp = mix(1.0, 24.0 / max(2.0, -mvPosition.z), uPerspective);
    gl_PointSize = clamp(size * persp, 0.75, 18.0) * uPixelRatio * twinkle;
    gl_Position = projectionMatrix * mvPosition;
  }
`

const CLUSTER_FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vBrightness;
  varying float vRadius;
  uniform float uOpacity;
  uniform float uReveal;

  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float d = length(uv);
    if (d > 0.5) discard;

    float core = 1.0 - smoothstep(0.0, 0.14, d);
    float halo = pow(1.0 - smoothstep(0.1, 0.5, d), 1.7) * 0.5;
    float alpha = max(core, halo) * (0.55 + 0.45 * vBrightness);

    // Core-outward reveal: a star at normalized radius r fades in as the
    // reveal front passes it.
    alpha *= smoothstep(vRadius - 0.18, vRadius, uReveal);

    gl_FragColor = vec4(vColor, alpha * uOpacity);
  }
`

function makeClusterMaterial(perspective: boolean): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: CLUSTER_VERTEX,
    fragmentShader: CLUSTER_FRAGMENT,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
      uOpacity: { value: 1 },
      uReveal: { value: 1 },
      uPerspective: { value: perspective ? 1 : 0 },
    },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  })
}

/**
 * Every catalog cluster's idle member stars, merged into ONE draw call.
 * Positions are cluster centre (same raDec + depth-radius math as
 * SkyPointMesh, so the sprinkle sits exactly on its glow) + Plummer offsets.
 */
export function ClusterStarField({ mobile = false }: { mobile?: boolean }) {
  const matRef = useRef<ShaderMaterial>(null)
  const gl = useThree((state) => state.gl)

  const geometry = useMemo(() => {
    const clusters = skyPoints.filter((p) => p.kind === "cluster")
    const perGlobular = mobile ? 55 : 110
    const perOpen = mobile ? 35 : 70

    const chunks: { offsets: Float32Array; colors: Float32Array; sizes: Float32Array; radii: Float32Array; cx: number; cy: number; cz: number }[] = []
    let total = 0
    for (const p of clusters) {
      const globular = isGlobular(p.fact)
      const count = globular ? perGlobular : perOpen
      const [cx, cy, cz] = raDecToScenePos(
        p.raHours,
        p.decDeg,
        skyDepthRadius(p.distance),
      )
      const visualSize = p.visualSize ?? 2
      chunks.push({
        ...sampleCluster({
          seed: hashId(p.id),
          count,
          radius: visualSize,
          globular,
          sizeBase: 0.7,
          sizeSpread: 1.1,
        }),
        cx,
        cy,
        cz,
      })
      total += count
    }

    const positions = new Float32Array(total * 3)
    const colors = new Float32Array(total * 3)
    const sizes = new Float32Array(total)
    const radii = new Float32Array(total)
    let o = 0
    for (const c of chunks) {
      const n = c.sizes.length
      for (let i = 0; i < n; i++) {
        positions[(o + i) * 3] = c.cx + c.offsets[i * 3]
        positions[(o + i) * 3 + 1] = c.cy + c.offsets[i * 3 + 1]
        positions[(o + i) * 3 + 2] = c.cz + c.offsets[i * 3 + 2]
      }
      colors.set(c.colors, o * 3)
      sizes.set(c.sizes, o)
      radii.set(c.radii, o)
      o += n
    }

    const geo = new BufferGeometry()
    geo.setAttribute("position", new BufferAttribute(positions, 3))
    geo.setAttribute("color", new BufferAttribute(colors, 3))
    geo.setAttribute("size", new BufferAttribute(sizes, 1))
    geo.setAttribute("aRadius", new BufferAttribute(radii, 1))
    return geo
  }, [mobile])

  const material = useMemo(() => makeClusterMaterial(false), [])

  useFrame((state) => {
    if (!matRef.current) return
    matRef.current.uniforms.uTime.value = state.clock.elapsedTime
    matRef.current.uniforms.uPixelRatio.value = gl.getPixelRatio()
  })

  return (
    <points geometry={geometry} frustumCulled={false} matrixAutoUpdate={false}>
      <primitive object={material} ref={matRef} attach="material" />
    </points>
  )
}

/**
 * Per-cluster resolved view — blooms in on hover/focus. Built lazily on first
 * activation (idle cost before that: nothing), then kept mounted with its
 * opacity/reveal envelopes easing toward the active state so the resolve
 * in/out is smooth rather than a popped switch.
 */
export function ClusterDetail({
  pointId,
  fact,
  size,
  active,
}: {
  pointId: string
  fact: string
  size: number
  active: boolean
}) {
  const matRef = useRef<ShaderMaterial>(null)
  const gl = useThree((state) => state.gl)
  // Build lazily on first activation, then keep — repeat hovers are free.
  const [built, setBuilt] = useState(false)
  useEffect(() => {
    if (active) setBuilt(true)
  }, [active])

  const globular = isGlobular(fact)

  const geometry = useMemo(() => {
    if (!built) return null
    const count = globular ? 2200 : 750
    const { offsets, colors, sizes, radii } = sampleCluster({
      seed: hashId(pointId) ^ 0x9e3779b9, // different draw from the idle sprinkle
      count,
      radius: size,
      globular,
      sizeBase: 0.8,
      sizeSpread: 1.6,
    })
    const geo = new BufferGeometry()
    geo.setAttribute("position", new BufferAttribute(offsets, 3))
    geo.setAttribute("color", new BufferAttribute(colors, 3))
    geo.setAttribute("size", new BufferAttribute(sizes, 1))
    geo.setAttribute("aRadius", new BufferAttribute(radii, 1))
    return geo
  }, [built, pointId, size, globular])

  const material = useMemo(() => {
    const m = makeClusterMaterial(true)
    // Born invisible — the frame loop eases reveal/opacity up on activation.
    m.uniforms.uReveal.value = 0
    m.uniforms.uOpacity.value = 0
    return m
  }, [])

  useFrame((state, delta) => {
    const mat = matRef.current
    if (!mat) return
    mat.uniforms.uTime.value = state.clock.elapsedTime
    mat.uniforms.uPixelRatio.value = gl.getPixelRatio()
    // Reveal eases core-outward on activation (≈1.2 s to full), and the whole
    // cloud fades on deactivation.
    const k = 1 - Math.exp(-delta * (active ? 2.6 : 5))
    const reveal = mat.uniforms.uReveal
    const opacity = mat.uniforms.uOpacity
    reveal.value += ((active ? 1 : 0) - reveal.value) * k
    opacity.value += ((active ? 1 : 0.0) - opacity.value) * k
  })

  if (!geometry) return null

  return (
    <points geometry={geometry} frustumCulled={false} matrixAutoUpdate={false}>
      <primitive object={material} ref={matRef} attach="material" />
    </points>
  )
}
