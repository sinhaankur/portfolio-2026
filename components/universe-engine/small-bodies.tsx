"use client"

/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine — see ./index.tsx for the full notice.
 * https://github.com/sinhaankur/portfolio-2026/blob/main/LICENSE
 *
 * small-bodies — the minor-body sub-engine: comets, asteroids, and spacecraft
 * on real orbits (the named-body catalog).
 *
 * <NamedBodies> maps the astronomy catalog to one <NamedBodyMesh> each. A named
 * body renders from its REAL orbital elements (Kepler motion via
 * orbitalElementsToCartesian + solveKepler), sized from its real diameter
 * (smallBodyVisualRadius's log curve), with per-rock tumble; comets add a
 * sunward-streaming ion/dust TAIL and a glowing coma ENVELOPE (the comet
 * shaders). Hover routes to the InfoPanel; click follows the body.
 *
 * The long doc comment below is the scene-scale compression rationale: distances
 * are sqrt(real_AU)·3 (r computed in real AU from the actual elements, THEN
 * sqrt-compressed — not sqrt(a)), so perihelia scale faithfully and sungrazers
 * don't vanish into the Sun. Kept verbatim: it's the truth argument for the math.
 *
 * Composed by <SceneContents> in scene.tsx. Comet shaders come from ./shaders.
 */

import { useRef, useMemo, useState, useEffect, Suspense } from "react"
import { useFrame } from "@react-three/fiber"
import { Billboard, Clone, Html, useGLTF } from "@react-three/drei"
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  Mesh,
  NormalBlending,
  ShaderMaterial,
  SRGBColorSpace,
  SpriteMaterial,
  TextureLoader,
  Vector3,
} from "three"
import {
  DEG,
  TIME_WARP_DAYS_PER_SEC,
  namedBodies,
  daysSinceJ2000,
  eccentricToTrue,
  orbitalElementsToCartesian,
  requestFollow,
  simTimeRef,
  smallBodyVisualRadius,
  solveKepler,
  timeWarpRef,
} from "./astronomy"
import type { HoverHandler, NamedBody } from "./types"
import {
  COMET_TAIL_VERTEX_SHADER,
  COMET_TAIL_FRAGMENT_SHADER,
  COMET_ENVELOPE_VERTEX_SHADER,
  COMET_ENVELOPE_FRAGMENT_SHADER,
  DWARF_SURFACE_VERTEX_SHADER,
  DWARF_SURFACE_FRAGMENT_SHADER,
} from "./shaders"
import { SPACECRAFT_SHAPES } from "./spacecraft-shapes"
import { getCometAffordance, getCometDynamicProfile } from "./celestial-sub-engine"
import { pointSprite } from "./galaxy"

// Round sprite for the trail dots (shared with the galaxy points) — so comet /
// asteroid trails render as soft circles, not raw squares, when you zoom in near.
const TRAIL_SPRITE = typeof document !== "undefined" ? pointSprite() : null

// Scratch vectors for orienting a comet's tail away from the Sun each frame
// (reused, never allocated in the render loop). Comet-tail only, so they live
// here rather than in the shared pool.
const _tailFrom = new Vector3()
const _tailTo = new Vector3()
const _glintPos = new Vector3()

/** Round additive glint sprite — one shared texture for every named-body
 *  marker (built once). Same radial-gradient look as the trail sprite. */
const GLINT_SPRITE = typeof document !== "undefined" ? (() => {
  const c = document.createElement("canvas")
  c.width = c.height = 64
  const ctx = c.getContext("2d")!
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, "rgba(255,255,255,1)")
  g.addColorStop(0.35, "rgba(255,255,255,0.55)")
  g.addColorStop(1, "rgba(255,255,255,0)")
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  const { CanvasTexture } = require("three") as typeof import("three")
  return new CanvasTexture(c)
})() : null

/**
 * Build an irregular asteroid/rock geometry — real minor bodies are lumpy
 * shards, not spheres. We start from a smooth icosahedron and push each vertex
 * in/out along its normal by layered value-noise (seeded per body so every rock
 * has its own distinct silhouette), then apply the triaxial a:b:c scale so
 * elongated bodies (Eros the peanut, Apophis, Ida) read as their real shape.
 * Cached by a string key so we don't rebuild per frame.
 */
const _rockCache = new Map<string, BufferGeometry>()
function irregularRockGeometry(
  radius: number,
  seed: number,
  triaxial: [number, number, number],
  detail = 3,
): BufferGeometry {
  const key = `${radius.toFixed(4)}|${seed}|${triaxial.join(",")}|${detail}`
  const cached = _rockCache.get(key)
  if (cached) return cached
  const geo = new IcosahedronGeometry(radius, detail)
  const pos = geo.attributes.position as BufferAttribute
  // Deterministic pseudo-random from the seed — no Math.random, so a body's
  // shape is stable across reloads.
  const rand = (n: number) => {
    const x = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453
    return x - Math.floor(x)
  }
  // Three offset noise centres give the surface large lumps + medium bumps.
  const centres = [0, 1, 2].map((i) => new Vector3(
    rand(i * 3 + 1) * 2 - 1, rand(i * 3 + 2) * 2 - 1, rand(i * 3 + 3) * 2 - 1,
  ).normalize())
  const v = new Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const dir = v.clone().normalize()
    // Layered lobes: dot with each centre → big smooth swells; a high-freq
    // term adds craters/ridges. Kept in [~0.72, ~1.18] so the rock stays a
    // recognisable body, just deeply irregular.
    let d = 1
    d += 0.16 * Math.cos(dir.dot(centres[0]) * 2.3 + seed)
    d += 0.11 * Math.cos(dir.dot(centres[1]) * 3.7 + seed * 1.7)
    d += 0.07 * Math.sin(dir.dot(centres[2]) * 6.1 + seed * 2.3)
    d += 0.05 * Math.sin(dir.x * 11 + dir.y * 13 + dir.z * 7 + seed)
    v.multiplyScalar(Math.max(0.7, d))
    // Triaxial elongation (normalised so the mean radius is preserved-ish).
    v.x *= triaxial[0]; v.y *= triaxial[1]; v.z *= triaxial[2]
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  geo.computeVertexNormals()
  _rockCache.set(key, geo)
  return geo
}

/**
 * Procedural-surface profiles for the far Kuiper-Belt dwarfs we have NO real
 * image of. Every value is grounded in each body's real, published properties
 * (albedo, colour, ice vs tholin chemistry, a known feature) — this is honest
 * inference, not invention, and the InfoPanel labels it "surface inferred".
 *   base : real overall colour/albedo
 *   hi/lo: bright fresh-ice / darker rock-tholin extremes for the mottle
 *   rough: 0 = glassy high-albedo ice, 1 = matte
 *   spot : optional feature (Haumea's Dark Red Spot), dir in body-local space
 */
type DwarfSurfaceProfile = {
  base: string; hi: string; lo: string; rough: number
  spot?: { col: string; dir: [number, number, number]; size: number }
}
const DWARF_SURFACES: Record<string, DwarfSurfaceProfile> = {
  // Eris — the brightest solid body after Enceladus (albedo ~0.96): a nearly
  // uniform pale grey-white methane-ice frost. Almost no colour, very glassy.
  Eris: { base: "#e8ebef", hi: "#f6f8fb", lo: "#c8ccd4", rough: 0.15 },
  // Makemake — reddish-brown: large methane-ice grains reddened by tholins.
  // Darker + redder than Eris, matte where organics have accumulated.
  Makemake: { base: "#b57a56", hi: "#d8b48c", lo: "#7d4a32", rough: 0.55 },
  // Haumea — bright crystalline WATER ice (unusual for a TNO), plus the real
  // "Dark Red Spot" (a mineral/organic-rich region) confirmed by photometry.
  Haumea: {
    base: "#e6e8ec", hi: "#f4f6fa", lo: "#b8bcc6", rough: 0.28,
    spot: { col: "#7a4636", dir: [1, 0.15, 0.35], size: 0.9 },
  },
}

/**
 * Scene-scale compression curve.
 *
 * The solar system spans five orders of magnitude (Mercury 0.39 AU →
 * Voyager 1 ~160 AU). Linear scaling would either make the inner
 * planets invisibly small or push the outer ones off-screen, so we
 * compress radii with sqrt() — the same trick stellar charts use.
 *
 * The earlier implementation applied sqrt() to the semi-major axis
 * (`a`) and then plugged that into the Keplerian polar form
 * r = a(1-e²)/(1+e·cosθ). That's mathematically inconsistent: for
 * an eccentric orbit the perihelion ends up at sqrt(a)·(1-e), which
 * is much closer to the Sun than the consistent sqrt(a·(1-e)). Parker
 * Solar Probe (a=0.39, e=0.881, perihelion 0.046 AU) plunged INSIDE
 * the rendered Sun every quarter-year, and sungrazers (Ikeya-Seki,
 * perihelion 0.008 AU) effectively disappeared into the corona.
 *
 * Fix: compute r in real AU using the actual elements, then apply
 * sqrt-compression to r — not to a. Now scene perihelion =
 * sqrt(a·(1-e))·3, which faithfully scales to real perihelia.
 * Parker comes out at sqrt(0.046)·3 ≈ 0.64 scene units (well outside
 * the 0.9-unit Sun mesh), and the full orbit lives in scene space
 * where every body sits at sqrt(real_distance_AU)·3 from origin.
 *
 * Side effect: the orbit shape in scene space is no longer a perfect
 * ellipse — it's a sqrt-compressed ellipse, which looks slightly
 * less dramatic at high eccentricity. We accept that. The trade is
 * visual consistency with the rest of the scene (planets, moons,
 * named-body distances all live in the same sqrt(AU)·3 frame).
 */

/**
 * GLB comet nucleus — the first asset of the Blender-GLB pipeline. Swaps the
 * plain procedural icosahedron for a detailed irregular Blender rock. Isolated
 * so useGLTF suspends only this piece; the caller wraps it in <Suspense> with
 * the icosahedron as the fallback, so a slow/failed load never blanks the comet.
 * The parent still spins it via the forwarded nucleusRef.
 */
function CometNucleusGlb({ scale, nucleusRef }: { scale: number; nucleusRef: React.RefObject<Group | null> }) {
  const { scene } = useGLTF("/models/comet-nucleus-hi.glb")
  return (
    <group ref={nucleusRef as React.Ref<Group>} scale={scale}>
      <Clone object={scene} />
    </group>
  )
}
useGLTF.preload("/models/comet-nucleus-hi.glb")

/**
 * GLB spacecraft — real Blender craft models for the 9 that had no procedural
 * shape (rendered as featureless spheres). Keyed to each craft's dominant
 * feature. The other craft (Voyager/JWST/Parker/…) keep their hand-built
 * procedural shapes. Isolated + Suspense-wrapped so a load hiccup never blanks.
 */
const CRAFT_GLB: Record<string, string> = {
  "Mariner 10": "/models/craft-dish.glb",
  "Cassini": "/models/craft-dish.glb",
  "Solar Orbiter": "/models/craft-dish.glb",
  "Galileo": "/models/craft-spinner.glb",
  "Rosetta": "/models/craft-wings.glb",
  "Europa Clipper": "/models/craft-wings.glb",
  "JUICE": "/models/craft-wings.glb",
  "Psyche": "/models/craft-wings.glb",
  "DART": "/models/craft-wings.glb",
}
function SpacecraftGlb({ url }: { url: string }) {
  const { scene } = useGLTF(url)
  return <Clone object={scene} />
}
for (const u of new Set(Object.values(CRAFT_GLB))) useGLTF.preload(u)

function NamedBodyMesh({
  body,
  onHover,
  invert = false,
  interactive = false,
}: {
  body: NamedBody
  onHover: HoverHandler
  invert?: boolean
  interactive?: boolean
}) {
  const groupRef = useRef<Group>(null)
  /** Always-visible glint — a small additive round sprite pinned to the body
   *  so distant bodies (Voyagers at ~57 scene-units, faint comets, sub-km NEOs)
   *  never vanish to a sub-pixel speck. Scaled each frame to hold a minimum
   *  apparent size on screen (a findable point of light), the same "min-px
   *  floor" idea the satellite swarm uses. Without it, "a lot of items are not
   *  visible by default" and Voyager reads as empty space. */
  const glintRef = useRef<import("three").Sprite>(null)
  /** Comet nucleus mesh — rotated slowly each frame so the surface
   *  appears to spin like a real cometary nucleus (67P rotates every
   *  ~12.4 hours; jets pulse on and off as active areas swing into the
   *  sunlight). The rotation here is decorative, not period-accurate. */
  // Mesh (procedural fallback) OR Group (GLB nucleus) — both have .rotation.
  const nucleusRef = useRef<Mesh | Group | null>(null)
  /** Comet-tail orientation — quaternion-rotated each frame so the tail
   *  always streams away from the Sun (origin), matching real solar-wind
   *  physics. Only used when body.kind === "comet" (or Comet Borisov). */
  const tailRef = useRef<Group>(null)
  /** Sunward parabolic envelope — bright dust hood that hangs on the
   *  Sun-facing side of an active comet. Opacity fades with heliocentric
   *  distance the same way the tails do. Lives inside tailRef so it
   *  stays oriented correctly without per-frame quaternion work. */
  const envelopeMatRef = useRef<ShaderMaterial>(null)
  /** Jet streamers group — three thin plumes shooting from the nucleus
   *  on the sunward hemisphere. Rotated slowly to simulate the nucleus
   *  spinning, so active spots periodically turn into and out of the
   *  Sun like real cometary jets. */
  const jetsRef = useRef<Group>(null)
  const jetMatRef = useRef<ShaderMaterial>(null)
  /** Comet ion-tail mesh — position + scale updated each frame so the
   *  tail length tracks distance from Sun (long at perihelion, faint at
   *  aphelion), matching real solar-wind sublimation. Uses a custom
   *  shader so the tail fades along its length (vapour, not plastic). */
  const tailMeshRef = useRef<Mesh>(null)
  const tailMatRef = useRef<ShaderMaterial>(null)
  /** Comet dust-tail mesh — second tail rendered in warm gold, offset
   *  from the ion tail by ~15° to fake the curve produced by radiation
   *  pressure pushing dust out slower than solar wind ions. */
  const dustTailMeshRef = useRef<Mesh>(null)
  const dustTailMatRef = useRef<ShaderMaterial>(null)
  /** Anti-tail spike — a short, sunward-pointing dust spike visible
   *  only for certain great comets at specific viewing geometries
   *  (Tsuchinshan–ATLAS 2024 is the textbook recent example). Not a
   *  real third tail — a projection artefact of dust spread along the
   *  orbital plane seen edge-on. Rendered as a thin cone pointing
   *  toward the Sun, only fading in close to perihelion. */
  const antiTailMeshRef = useRef<Mesh>(null)
  const antiTailMatRef = useRef<ShaderMaterial>(null)
  const comaInnerMatRef = useRef<import("three").MeshBasicMaterial>(null)
  const comaMidMatRef = useRef<import("three").MeshBasicMaterial>(null)
  const comaOuterMatRef = useRef<import("three").MeshBasicMaterial>(null)
  const cometPulseRef = useRef(Math.random() * Math.PI * 2)
  /** Motion trail — ring buffer of recent positions rendered as fading
   *  particles behind the body. Makes orbital movement legible at any
   *  time-warp (the body itself moves slowly in any given second; the
   *  trail makes that motion visible by streaking the recent path). */
  const motionTrailRef = useRef<{
    positions: Float32Array
    colors: Float32Array
    ages: Float32Array
    geometry: BufferGeometry
    nextIdx: number
  } | null>(null)
  /** Trail material — opacity lerps with hover state so the static orbit
   *  paths don't pile up at crossings (the no-collisions rule). */
  const trailMatRef = useRef<import("three").PointsMaterial>(null)
  const [isHovered, setIsHovered] = useState(false)

  // Pre-compute everything time-independent: orbital scale, tilt, base colour.
  const config = useMemo(() => {
    // `a` is the REAL semi-major axis in AU. Scene-space compression is
    // applied inside orbitalElementsToCartesian (sqrt(r)·3) so the
    // perihelion + aphelion of every eccentric orbit scale consistently
    // with planet distances — Parker, Ikeya-Seki etc. no longer plunge
    // through the Sun mesh.
    const a = body.aAU
    const e = body.eccentricity
    const inclination = body.inclDeg * DEG
    // Size from the body's REAL diameter when known (compressed-but-truthful so
    // Ceres visibly dwarfs a sub-km NEO); else an explicit visualRadius; else the
    // flat default.
    const visualRadius = body.diameterKm != null
      ? smallBodyVisualRadius(body.diameterKm)
      : body.visualRadius ?? 0.05
    // Periodic bodies loop; interstellars get a finite "passage window"
    // measured in seconds of scene time so the user can see them coming
    // and going without them living on screen indefinitely.
    const period = isFinite(body.periodYears)
      ? body.periodYears * 365.25 / TIME_WARP_DAYS_PER_SEC
      : 120 // ~2 minutes of scene time end-to-end for interstellars
    // Inclinations > 90° encode retrograde orbits (Halley at 162°, etc.) —
    // we reverse the phase increment so the body actually marches backward
    // along the ellipse, not just on a tilted prograde plane.
    const direction = body.inclDeg > 90 ? -1 : 1
    const angularSpeed = direction * (2 * Math.PI) / period
    const phase = body.startPhase * Math.PI * 2
    // Date-driven anchor for periodic bodies: real period in days + a base
    // mean anomaly. Each frame we recompute config.phase from the sim date
    // so periodic comets are scrubbable and land in the same place every
    // time you revisit a date.
    //
    // When the body carries a real perihelion-passage date (perihelionTT),
    // mean anomaly is anchored to it: M = 0 exactly at perihelion, so
    // jumping the timeline to a known perihelion (Halley 2061) puts the
    // comet at perihelion for real. Bodies without that date fall back to
    // a fixed startPhase offset — period + direction are real, absolute
    // longitude is approximate.
    const periodDaysReal = isFinite(body.periodYears) ? body.periodYears * 365.25 : 0
    const perihelionMs = body.perihelionTT ? Date.parse(body.perihelionTT) : null
    const baseMeanAnomaly = phase
    // Orientation of the orbital plane in 3D — without these the orbit is
    // correctly tilted but oriented arbitrarily, so Voyager 1's escape
    // doesn't point toward Ophiuchus and Voyager 2's toward Telescopium.
    // Default 0 for bodies where the exact sky direction isn't called out.
    const longNode = (body.longNodeDeg ?? 0) * DEG
    const argPeri = (body.argPeriDeg ?? 0) * DEG

    // Default colours by kind. Comets: warm ice-blue (gas+dust coma).
    // Asteroids: dusty grey-brown. Interstellars: warm accent for the
    // two rare visitors we have. Spacecraft: cold silver-white so they
    // read as engineered hardware drifting through a sky of natural bodies.
    // Dwarf planets: warm earthy-pink — Eris and Sedna's actual surface
    // reflectance, plus differentiates them from main-belt asteroids.
    const defaultShade =
      body.kind === "comet"        ? "#9ed4ff" :
      body.kind === "asteroid"     ? "#b8a482" :
      body.kind === "spacecraft"   ? "#e8eef5" :
      body.kind === "dwarf"        ? "#d49a76" :
      /* interstellar */              "#ffd66b"
    const shade = body.shade ?? defaultShade

    // Tail flag — comets get coma + tail. Borisov was interstellar but
    // clearly a comet by appearance (visible coma + tail), so flag it too.
    const hasTail = body.kind === "comet" || body.name === "Comet Borisov"
    // Pre-parsed RGB for the motion-trail particle colour, in 0..1 range.
    const shadeRgb = (() => {
      const hex = shade.replace("#", "")
      return {
        r: parseInt(hex.slice(0, 2), 16) / 255,
        g: parseInt(hex.slice(2, 4), 16) / 255,
        b: parseInt(hex.slice(4, 6), 16) / 255,
      }
    })()
    // Famous "great comets" — visible to the naked eye, long iconic
    // tails. We stretch their tails ~50% longer than the routine periodic
    // comets so Hale-Bopp's signature plume actually reads at scene scale.
    // Hyakutake had the longest measured tail in history (570 Mkm); we
    // can't show that to scale without breaking the scene, but we lean
    // into it. Sungrazers (Ikeya-Seki) also get the boost — their tails
    // are spectacular because perihelion is so close.
    const GREAT_COMETS = new Set([
      "Comet Hale-Bopp",
      "Comet Hyakutake",
      "Comet NEOWISE",
      "Comet Tsuchinshan-ATLAS",
      "Comet Ikeya-Seki",
    ])
    const tailLengthFactor = GREAT_COMETS.has(body.name) ? 1.55 : 1.0
    // The anti-tail is a real visible feature for a few specific comets
    // (Arend-Roland 1957, Tsuchinshan-ATLAS 2024). Of the catalog, only
    // Tsuchinshan-ATLAS qualifies — its fact text already calls it out.
    const hasAntiTail = body.name === "Comet Tsuchinshan-ATLAS"
    return { a, e, inclination, longNode, argPeri, visualRadius, angularSpeed, phase, periodDaysReal, perihelionMs, baseMeanAnomaly, direction, shade, shadeRgb, isLoop: isFinite(body.periodYears), hasTail, tailLengthFactor, hasAntiTail }
  }, [body])
  const cometAffordance = useMemo(
    () =>
      getCometAffordance({
        kind: body.kind,
        name: body.name,
        visualRadius: config.visualRadius,
        isLoop: config.isLoop,
        invert,
      }),
    [body.kind, body.name, config.visualRadius, config.isLoop, invert],
  )
  const cometDynamic = useMemo(
    () => getCometDynamicProfile(body.name),
    [body.name],
  )

  // Real surface map (Dawn/New Horizons mosaics) for any body that has one —
  // Ceres, Vesta, Pluto. A UV-mapped texture needs a clean sphere, so a textured
  // body renders as a lightly-shaped sphere (not the noise-displaced rock, which
  // would smear the map). Absent = procedural surface.
  const surfaceTexture = useMemo(() => {
    if (!body.textureUrl) return null
    const tex = new TextureLoader().load(body.textureUrl)
    tex.colorSpace = SRGBColorSpace
    return tex
  }, [body.textureUrl])

  // Irregular-rock geometry for UN-textured asteroids (Eros, Apophis, Ida…).
  // Real asteroids are lumpy shards, not glowing balls — this displaces an
  // icosahedron with per-body noise + the triaxial a:b:c shape so each rock has
  // a distinct, real silhouette. Seed from the name so it's stable + unique.
  // Textured asteroids (Vesta) skip this and use the mapped sphere below.
  const rockGeometry = useMemo(() => {
    if (body.kind !== "asteroid" || body.textureUrl) return null
    const seed = body.name.split("").reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 100000, 7)
    const tri = body.triaxial ?? [1, 1, 1]
    return irregularRockGeometry(config.visualRadius, seed, tri, 3)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body.kind, body.name, body.textureUrl, config.visualRadius])

  // Always-visible glint — must read in BOTH themes. In dark mode an additive
  // bright glow works; in light (invert) mode an additive glint is invisible on
  // white, so we flip to a DARKER, saturated dot with normal blending so it
  // shows as a solid point on the pale background. Either way, nothing needs to
  // be selected to be seen.
  const glintMaterial = useMemo(() => {
    if (!GLINT_SPRITE) return null
    const col = new Color(config.shade)
    if (invert) {
      // Deepen + saturate so it's a visible dark point on white.
      const hsl = { h: 0, s: 0, l: 0 }
      col.getHSL(hsl)
      col.setHSL(hsl.h, Math.min(1, hsl.s * 1.3 + 0.2), Math.min(hsl.l, 0.42))
    }
    return new SpriteMaterial({
      map: GLINT_SPRITE,
      color: col,
      transparent: true,
      opacity: invert ? 0.9 : 0.9,
      blending: invert ? NormalBlending : AdditiveBlending,
      depthWrite: false,
      depthTest: true,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.shade, invert])

  // Procedural surface for the un-imaged Kuiper dwarfs (Eris/Makemake/Haumea).
  // Grounded in each body's REAL published properties — honest inference, not
  // invention (the InfoPanel flags it "surface inferred"). uSunDir is refreshed
  // each frame from the body's world position (Sun is at scene origin).
  const dwarfSurfMatRef = useRef<ShaderMaterial>(null)
  const dwarfSurfaceMaterial = useMemo(() => {
    if (surfaceTexture) return null  // real map wins
    const p = DWARF_SURFACES[body.name]
    if (!p) return null
    const spot = p.spot
    return new ShaderMaterial({
      vertexShader: DWARF_SURFACE_VERTEX_SHADER,
      fragmentShader: DWARF_SURFACE_FRAGMENT_SHADER,
      uniforms: {
        uBase: { value: new Color(p.base) },
        uHi: { value: new Color(p.hi) },
        uLo: { value: new Color(p.lo) },
        uSunDir: { value: new Vector3(0, 0, 1) },
        uRough: { value: p.rough },
        uAmbient: { value: invert ? 0.6 : 0.14 },
        uSpotCol: { value: new Color(spot?.col ?? "#000000") },
        uSpotDir: { value: spot ? new Vector3(...spot.dir).normalize() : new Vector3(0, 0, 0) },
        uSpotSize: { value: spot?.size ?? 0 },
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body.name, surfaceTexture, invert])

  // Initialise the motion-trail ring buffer for comets / interstellars /
  // dwarfs — bodies whose motion is the headline detail. Built lazily so
  // bodies without a trail (asteroids, spacecraft using custom shapes)
  // don't allocate.
  // Programmatic focus — the timeline "Moments" waypoints dispatch
  // universe:sky-focus with pointId "named:<name>" to frame a comet after
  // jumping to its perihelion. Mirrors the click handler's requestFollow so
  // the camera locks on and tracks the body as it sweeps perihelion.
  useEffect(() => {
    if (!interactive) return
    const onFocus = (e: Event) => {
      const id = (e as CustomEvent<{ pointId?: string }>).detail?.pointId
      if (id !== `named:${body.name}`) return
      requestFollow(
        () => {
          const g = groupRef.current
          if (!g) return null
          const v = new Vector3()
          g.getWorldPosition(v)
          return { x: v.x, y: v.y, z: v.z }
        },
        body.kind === "dwarf" ? 2.4 : 1.6,
        body.name,
      )
    }
    window.addEventListener("universe:sky-focus", onFocus)
    return () => window.removeEventListener("universe:sky-focus", onFocus)
  }, [interactive, body.name, body.kind])

  useEffect(() => {
    const wantsTrail = body.kind === "comet" || body.kind === "interstellar" || body.kind === "dwarf" || body.name === "Comet Borisov"
    if (!wantsTrail) return
    const MOTION_TRAIL_LEN = 48
    const positions = new Float32Array(MOTION_TRAIL_LEN * 3)
    const colors = new Float32Array(MOTION_TRAIL_LEN * 3)
    const ages = new Float32Array(MOTION_TRAIL_LEN)
    // Start fully aged so nothing renders before the first useFrame pushes
    // real positions into the buffer.
    for (let i = 0; i < MOTION_TRAIL_LEN; i++) ages[i] = 999
    const geometry = new BufferGeometry()
    geometry.setAttribute("position", new BufferAttribute(positions, 3))
    geometry.setAttribute("color", new BufferAttribute(colors, 3))
    motionTrailRef.current = { positions, colors, ages, geometry, nextIdx: 0 }
    return () => {
      geometry.dispose()
      motionTrailRef.current = null
    }
  }, [body.kind, body.name])

  // Pre-compute a thin trail of orbit positions so each body draws a
  // dotted ellipse behind it, hinting at the path. Uses the same full
  // orbital-element transform as the per-frame position below, so the
  // body always sits on its trail.
  //
  // Hyperbolic bodies (Voyagers, escape trajectories) get a STRAIGHT
  // outward line from the Sun instead of an ellipse — they don't loop
  // and the polar-form r blows up for e > 1.
  const trailGeometry = useMemo(() => {
    if (config.e >= 1) {
      // Straight outbound line from the Sun to ~1.2× the body's
      // current heliocentric distance along the escape direction.
      const STEPS = 24
      const positions = new Float32Array(STEPS * 3)
      const endPos = orbitalElementsToCartesian(
        config.a * 1.2, 0, 0, config.inclination, config.longNode, config.argPeri,
      )
      for (let i = 0; i < STEPS; i++) {
        const f = i / (STEPS - 1)
        positions[i * 3]     = endPos[0] * f
        positions[i * 3 + 1] = endPos[1] * f
        positions[i * 3 + 2] = endPos[2] * f
      }
      const geo = new BufferGeometry()
      geo.setAttribute("position", new BufferAttribute(positions, 3))
      return geo
    }
    const STEPS = 90
    const positions = new Float32Array(STEPS * 3)
    for (let i = 0; i < STEPS; i++) {
      const t = (i / STEPS) * Math.PI * 2
      const pos = orbitalElementsToCartesian(
        config.a, config.e, t, config.inclination, config.longNode, config.argPeri,
      )
      positions[i * 3]     = pos[0]
      positions[i * 3 + 1] = pos[1]
      positions[i * 3 + 2] = pos[2]
    }
    const geo = new BufferGeometry()
    geo.setAttribute("position", new BufferAttribute(positions, 3))
    return geo
  }, [config])

  // Shader uniforms for the comet's plume meshes — built once per
  // component instance so each comet animates independently. Per-frame
  // updates (uOpacity, uTime) mutate these in useFrame above.
  // Colours are tuned to real comet spectroscopy:
  //   - Ion tail: cyan/electric blue from CO+ and H2O+ fluorescence
  //   - Dust tail: warm cream/gold from sun-reflected silicates
  //   - Envelope: pale cyan, brighter than the surrounding coma
  //   - Jets: white-cyan to read against the green inner coma
  //   - Anti-tail: warm cream, matches dust-tail palette
  const ionTailUniforms = useMemo(() => ({
    uColorHead:    { value: new Color(invert ? "#1a4080" : "#bfe4ff") },
    uColorTail:    { value: new Color(invert ? "#3060a0" : "#5a8fd0") },
    uOpacity:      { value: 0 },
    uTime:         { value: 0 },
    uHalfHeight:   { value: config.visualRadius * 7.0 * config.tailLengthFactor },
    uKnotStrength: { value: 0.32 },
  }), [invert, config.visualRadius, config.tailLengthFactor])
  const dustTailUniforms = useMemo(() => ({
    uColorHead:    { value: new Color(invert ? "#7a4818" : "#ffd590") },
    uColorTail:    { value: new Color(invert ? "#a06840" : "#d8a865") },
    uOpacity:      { value: 0 },
    uTime:         { value: 0 },
    uHalfHeight:   { value: config.visualRadius * 8.0 * config.tailLengthFactor },
    uKnotStrength: { value: 0.0 },
  }), [invert, config.visualRadius, config.tailLengthFactor])
  const envelopeUniforms = useMemo(() => ({
    uColor:        { value: new Color(invert ? "#3a5a90" : "#cfeaff") },
    uOpacity:      { value: 0 },
  }), [invert])
  const jetUniforms = useMemo(() => ({
    uColorHead:    { value: new Color(invert ? "#3060a0" : "#e6f4ff") },
    uColorTail:    { value: new Color(invert ? "#5080b0" : "#88c4f0") },
    uOpacity:      { value: 0 },
    uTime:         { value: 0 },
    uHalfHeight:   { value: config.visualRadius * 0.85 },
    uKnotStrength: { value: 0.55 },
  }), [invert, config.visualRadius])
  const antiTailUniforms = useMemo(() => ({
    uColorHead:    { value: new Color(invert ? "#8a5828" : "#fff0c8") },
    uColorTail:    { value: new Color(invert ? "#a87848" : "#dcc090") },
    uOpacity:      { value: 0 },
    uTime:         { value: 0 },
    uHalfHeight:   { value: config.visualRadius * 1.4 },
    uKnotStrength: { value: 0.0 },
  }), [invert, config.visualRadius])

  useFrame((state, delta) => {
    const tw = timeWarpRef.current
    if (!groupRef.current) return

    // Periodic bodies derive phase straight from the simulation date so
    // they're scrubbable and deterministic; interstellars keep ping-ponging
    // off the accumulator since they don't loop and have no period.
    if (config.isLoop && config.periodDaysReal > 0) {
      if (config.perihelionMs != null) {
        // Real anchor: M = 0 at perihelion, growing with days since it.
        const daysSincePeri = (simTimeRef.current.simMs - config.perihelionMs) / 86_400_000
        config.phase = config.direction * 2 * Math.PI * daysSincePeri / config.periodDaysReal
      } else {
        // Approximate anchor off J2000 + a fixed offset.
        config.phase =
          config.baseMeanAnomaly +
          config.direction * 2 * Math.PI * daysSinceJ2000(simTimeRef.current.simMs) / config.periodDaysReal
      }
    } else {
      config.phase += delta * config.angularSpeed * tw
    }
    if (config.isLoop) {
      // keep within a sane range for the Kepler solver
      config.phase = config.phase % (Math.PI * 2)
    } else {
      // Interstellar — keep phase in [0, 2π] and reset position when it
      // wanders too far so the body re-enters the scene periodically.
      if (config.phase > Math.PI * 2) {
        config.phase = 0
      }
    }

    let px: number, py: number, pz: number
    if (config.e >= 1) {
      // Hyperbolic / escape trajectory (Voyagers, Pioneers, NH,
      // interstellars). The elliptical polar-form r = a(1-e²)/(1+e·cosθ)
      // produces negative or near-zero r for e > 1, which was placing
      // these bodies inside the Sun. Instead we pin them at their
      // current aAU heliocentric distance along the escape direction
      // (which is what Ω/ω/i are set up to orient toward). Motion
      // through the interstellar medium at 15–17 km/s is effectively
      // invisible at our scene scale anyway — visitors see their
      // current real-world position rather than a fake loop.
      ;[px, py, pz] = orbitalElementsToCartesian(
        config.a, 0, 0, config.inclination, config.longNode, config.argPeri,
      )
    } else {
      // Elliptical orbit — solve Kepler's equation so the body actually
      // obeys the 2nd law (sweeps equal areas in equal times, i.e. moves
      // fast at perihelion + slow at aphelion). Phase accumulates as
      // MEAN anomaly; we solve for true anomaly each frame.
      const M = config.phase
      const E = solveKepler(M, config.e)
      const trueAnom = eccentricToTrue(E, config.e)
      ;[px, py, pz] = orbitalElementsToCartesian(
        config.a, config.e, trueAnom, config.inclination, config.longNode, config.argPeri,
      )
    }
    groupRef.current.position.set(px, py, pz)

    // Glint scale-hold — keep the marker a findable point of light at any
    // distance. A Sprite is billboarded + world-scaled, so at 57 scene-units
    // (Voyager) a fixed local size becomes a sub-pixel dot. We scale it with
    // camera distance so it holds a roughly constant apparent size, then never
    // let it shrink below the body's own visual radius (so up close the real
    // mesh takes over and the glint tucks inside it rather than bloating).
    if (glintRef.current) {
      const cam = state.camera
      const dist = cam.position.distanceTo(groupRef.current.getWorldPosition(_glintPos))
      // ~1.4% of distance ≈ a small constant on-screen dot; clamp to the body
      // size so the glint is a subtle halo up close, a visible point far away.
      const s = Math.max(config.visualRadius * 1.1, dist * 0.014)
      glintRef.current.scale.setScalar(s)
    }

    // Procedural dwarf surface — light it from the real Sun (scene origin), so
    // the terminator points the right way as the body orbits. uSunDir = the
    // body→Sun direction in world space (= -normalize(worldPos)).
    if (dwarfSurfMatRef.current) {
      groupRef.current.getWorldPosition(_glintPos)
      dwarfSurfMatRef.current.uniforms.uSunDir.value
        .copy(_glintPos).multiplyScalar(-1).normalize()
    }

    // Comet tail orientation — the tail group's local +y axis is rotated
    // each frame to point away from the Sun (origin). Solar wind blows
    // gas + dust radially outward, so this matches real comet visuals
    // independent of the body's velocity direction.
    // Motion trail — push the current world-frame-equivalent position into
    // the ring buffer and age every existing particle. Per-vertex colour
    // is set so newer particles are bright (full shade) and older ones
    // fade to black. With additive blending, this reads as a glowing
    // streak following the body's recent path through space — orbital
    // motion becomes legible at any time-warp.
    const trail = motionTrailRef.current
    if (trail) {
      const idx = trail.nextIdx * 3
      trail.positions[idx]     = px
      trail.positions[idx + 1] = py
      trail.positions[idx + 2] = pz
      trail.ages[trail.nextIdx] = 0
      trail.nextIdx = (trail.nextIdx + 1) % trail.ages.length
      const TRAIL_LIFE = 2.4 // seconds (real time, ignores warp so user
                              // sees a consistent-length trail)
      const r = config.shadeRgb.r
      const g = config.shadeRgb.g
      const b = config.shadeRgb.b
      const dimMul = invert ? 0.7 : 1.0
      for (let i = 0; i < trail.ages.length; i++) {
        trail.ages[i] += delta
        const intensity = Math.max(0, 1 - trail.ages[i] / TRAIL_LIFE) * dimMul
        const ci = i * 3
        trail.colors[ci]     = r * intensity
        trail.colors[ci + 1] = g * intensity
        trail.colors[ci + 2] = b * intensity
      }
      trail.geometry.attributes.position.needsUpdate = true
      trail.geometry.attributes.color.needsUpdate = true
    }

    if (tailRef.current && config.hasTail) {
      const len = Math.sqrt(px * px + py * py + pz * pz) || 1
      cometPulseRef.current += delta
      const TAU = Math.PI * 2
      const comaPulse =
        1 +
        Math.sin(cometPulseRef.current * TAU * cometDynamic.comaPulseHz) * cometDynamic.comaPulseAmp +
        Math.sin(cometPulseRef.current * TAU * cometDynamic.comaPulseHz * 0.53 + 0.7) * cometDynamic.comaPulseAmp * 0.35
      const jetPulse =
        1 +
        Math.sin(cometPulseRef.current * TAU * cometDynamic.jetPulseHz + 0.9) * cometDynamic.jetPulseAmp
      _tailFrom.set(0, 1, 0)
      _tailTo.set(px / len, py / len, pz / len)
      tailRef.current.quaternion.setFromUnitVectors(_tailFrom, _tailTo)

      // Tail length + opacity track distance from the Sun — real comet
      // tails are blown bright + long when volatiles sublimate near the
      // Sun (under ~3 AU), then fade as the comet retreats to aphelion.
      // Linear ramp in scene-units: full tail inside 5u, fading to 0
      // by 18u. So Halley flares dramatically each time it swings inside
      // Mars's orbit, then trails off as it heads back to Pluto-distance.
      const t = Math.max(0, Math.min(1, (18 - len) / 13))
      const activityT = Math.max(0, Math.min(1, t * cometDynamic.activityMul))

      const comaBoost = (0.75 + activityT * 0.25) * Math.max(0.6, comaPulse)
      if (comaInnerMatRef.current) {
        const base = invert ? 0.55 : 0.55
        comaInnerMatRef.current.opacity = Math.max(0, Math.min(1, base * comaBoost))
      }
      if (comaMidMatRef.current) {
        const base = invert ? 0.45 : 0.42
        comaMidMatRef.current.opacity = Math.max(0, Math.min(1, base * comaBoost))
      }
      if (comaOuterMatRef.current) {
        const base = invert ? 0.22 : 0.16
        comaOuterMatRef.current.opacity = Math.max(0, Math.min(1, base * comaBoost))
      }

      // Ion tail — straight, electric-blue, points exactly anti-radial.
      if (tailMeshRef.current && tailMatRef.current) {
        const baseHalf = config.visualRadius * 7.0 * config.tailLengthFactor
        tailMeshRef.current.position.y = baseHalf * activityT
        tailMeshRef.current.scale.y = activityT
        const peakOpacity = invert ? 0.65 : 0.55
        tailMatRef.current.uniforms.uOpacity.value = activityT * peakOpacity * Math.max(0.68, jetPulse)
        tailMatRef.current.uniforms.uTime.value += delta
      }
      // Dust tail — broader, warm, slightly longer. Radiation pressure
      // pushes dust outward slower than the solar wind pushes ions, so
      // dust lags behind into a fan; the offset rotation in JSX captures
      // that curve. Smooth (no plasma knots).
      if (dustTailMeshRef.current && dustTailMatRef.current) {
        const baseHalf = config.visualRadius * 8.0 * config.tailLengthFactor
        dustTailMeshRef.current.position.y = baseHalf * activityT
        dustTailMeshRef.current.scale.y = activityT
        const peakOpacity = invert ? 0.55 : 0.48
        dustTailMatRef.current.uniforms.uOpacity.value = activityT * peakOpacity * Math.max(0.72, comaPulse)
      }
      // Sunward envelope — the bright dust hood pressed against the
      // Sun-facing side of an active comet. Same perihelion ramp; the
      // shader gradient handles the parabolic falloff toward the rim.
      if (envelopeMatRef.current) {
        const peakOpacity = invert ? 0.50 : 0.45
        envelopeMatRef.current.uniforms.uOpacity.value = activityT * peakOpacity * Math.max(0.74, comaPulse)
      }
      // Jet streamers — only really fire close to the Sun. Tighter ramp
      // than the tails (gone by 8u, full inside 3u). The group rotates
      // slowly so individual jets sweep into and out of view — the
      // signature pulsing you see in Rosetta's footage of 67P.
      if (jetsRef.current) {
        jetsRef.current.rotation.y += delta * 0.55
      }
      if (jetMatRef.current) {
        const jetT = Math.max(0, Math.min(1, (8 - len) / 5))
        const peakOpacity = invert ? 0.70 : 0.60
        jetMatRef.current.uniforms.uOpacity.value = jetT * peakOpacity * Math.max(0.66, jetPulse)
        jetMatRef.current.uniforms.uTime.value += delta * 2.2
      }
      // Anti-tail — short sunward spike, visible only inside ~4u and
      // only for the one comet (Tsuchinshan–ATLAS) that famously
      // showed it in 2024. Even tighter window than the jets.
      if (config.hasAntiTail && antiTailMeshRef.current && antiTailMatRef.current) {
        const atT = Math.max(0, Math.min(1, (4 - len) / 2))
        const peakOpacity = invert ? 0.55 : 0.45
        antiTailMatRef.current.uniforms.uOpacity.value = atT * peakOpacity
        antiTailMeshRef.current.scale.y = 0.3 + 0.7 * atT
      }
    }

    // Nucleus rotation — slow tumble on two axes so the irregular
    // facets read as a real spinning body. Independent of the perihelion
    // ramp (real nuclei rotate everywhere along the orbit, they just
    // aren't visible from Earth until the coma lights them up).
    if (nucleusRef.current) {
      nucleusRef.current.rotation.y += delta * 0.35
      nucleusRef.current.rotation.x += delta * 0.12
    }

    // Trail opacity lerps with hover state — addresses the no-collisions
    // rule for orbit paths. With ~20 named bodies all drawing static
    // trails (comets cross every inner-planet ring, asteroids cross each
    // other), the screen was a tangle. Hovered body brightens, others
    // stay at a faint baseline so crossings read as ghostly rather than
    // colliding.
    if (trailMatRef.current) {
      const target = isHovered ? cometAffordance.trailHover : cometAffordance.trailIdle
      const k = 1 - Math.exp(-delta * 8)
      trailMatRef.current.opacity += (target - trailMatRef.current.opacity) * k
    }
  })

  // Hit-zone radius — never smaller than 0.16 so even tiny bodies are
  // findable with a finger or cursor.
  const hitRadius = cometAffordance.hitRadius

  return (
    // Both the trail (anchored at the Sun) and the moving body live in the
    // same parent so they share the SolarSystem's coordinate frame.
    <group>
      {/* Orbit trail — thin dotted ellipse traced once at mount, never updated.
          Opacity is driven by the useFrame above so the hovered body's path
          brightens and the rest stay faint — keeps crossings (Halley over
          every inner-planet ring, asteroid trails over each other) from
          piling up into visual noise. */}
      <points geometry={trailGeometry}>
        <pointsMaterial
          ref={trailMatRef as React.Ref<import("three").PointsMaterial>}
          size={invert ? 0.024 : 0.020}
          sizeAttenuation
          color={invert ? "#1a1208" : config.shade}
          map={TRAIL_SPRITE ?? undefined}
          alphaTest={0.01}
          transparent
          opacity={cometAffordance.trailIdle}
          depthWrite={false}
        />
      </points>

      {/* Motion trail — fading particle streak following the body's recent
          actual movement (not the static orbit ellipse above). Per-vertex
          colours drive per-particle fade from full shade → black. Makes
          the body's orbital motion legible even when angular speed is
          slow (Halley moves ~0.4° per real second at 1× warp; the trail
          shows that motion as a visible streak). */}
      {motionTrailRef.current && (
        <points geometry={motionTrailRef.current.geometry}>
          <pointsMaterial
            size={invert ? 0.05 : 0.045}
            sizeAttenuation
            vertexColors
            map={TRAIL_SPRITE ?? undefined}
            alphaTest={0.01}
            transparent
            opacity={0.95}
            blending={invert ? NormalBlending : AdditiveBlending}
            depthWrite={false}
          />
        </points>
      )}

      {/* The body itself — moved each frame to its current orbit position.
          Spacecraft with a registered procedural shape (Voyager, JWST,
          Parker, New Horizons) render their actual silhouette instead of a
          generic sphere. Everything else (comets, asteroids, dwarf planets,
          interstellars) stays as the standard glowing sphere. */}
      <group ref={groupRef}>
        {body.kind === "spacecraft" && CRAFT_GLB[body.name] ? (
          // Real Blender GLB craft (the 9 that had no procedural shape). Same
          // small silhouette cap as the procedural path; Suspense falls back to
          // the standard sphere while it loads so nothing blanks.
          <Suspense fallback={
            <mesh><sphereGeometry args={[config.visualRadius * 0.6, 16, 16]} />
              <meshStandardMaterial color="#e8eef5" roughness={0.5} /></mesh>
          }>
            <group scale={Math.min(0.06, config.visualRadius * 4.5)}>
              <SpacecraftGlb url={CRAFT_GLB[body.name]} />
            </group>
          </Suspense>
        ) : body.kind === "spacecraft" && SPACECRAFT_SHAPES[body.name] ? (
          // Spacecraft are metres-to-tens-of-metres — truly invisible at
          // solar-system scale (Parker is ~3 m vs Earth's 12,742 km). They must
          // be inflated to read at all, but the old size (visualRadius×scale ≈
          // 0.18) drew Parker/Voyager nearly Earth-sized. Cap the rendered
          // silhouette small so it's a legible craft when you fly to it without
          // dwarfing planets from afar; the always-visible glint carries
          // findability at distance (a point of light, as it really appears).
          <group scale={Math.min(0.05, config.visualRadius * SPACECRAFT_SHAPES[body.name].scale)}>
            {SPACECRAFT_SHAPES[body.name].render({ invert })}
          </group>
        ) : config.hasTail ? (
          // Comet anatomy, built up in layers:
          //   1. Nucleus — dark, irregular, slowly rotating. Real cometary
          //      surfaces (Halley, 67P) are blacker than asphalt; we keep
          //      it faceted (icosahedron) so its silhouette feels like a
          //      lump of rock, not a polished ball.
          //   2. Inner coma — tight greenish glow (C2 / CN fluorescence).
          //   3. Mid coma — wider cyan halo (water photodissociation).
          //   4. Outer coma — faint diffuse envelope, fades into space.
          //   5. Sunward envelope — bright parabolic dust hood pressed
          //      against the sub-solar side by radiation pressure.
          //   6. Jets — 3 narrow plumes from active spots on the nucleus,
          //      rotating with it so they sweep into / out of view.
          //   7. Ion tail — straight, electric-blue, plasma knots, points
          //      directly anti-solar (solar wind blows it straight out).
          //   8. Dust tail — warm cream, broader, slightly longer, offset
          //      ~14° from the ion tail (radiation pressure pushes dust
          //      out slower than ions, so it curves orbit-trailing).
          //   9. Anti-tail — for Tsuchinshan–ATLAS only — short sunward
          //      spike, fades in near perihelion.
          <>
            {/* 1. Nucleus — a detailed Blender GLB rock (the first asset of the
                GLB pipeline), with the procedural icosahedron as the Suspense
                fallback so a slow/failed load never blanks the comet. Both spin
                via nucleusRef. */}
            <Suspense
              fallback={
                <mesh ref={nucleusRef as React.Ref<Mesh>}>
                  <icosahedronGeometry args={[config.visualRadius * 0.42, 1]} />
                  <meshStandardMaterial color={invert ? "#0a0a14" : "#5a534a"} roughness={0.95} flatShading />
                </mesh>
              }
            >
              <CometNucleusGlb scale={config.visualRadius * 0.42} nucleusRef={nucleusRef as React.RefObject<Group | null>} />
            </Suspense>

            {/* 2. Inner coma — C2/CN green close to the nucleus.
                Real Halley and Hale-Bopp comae show this clearly through
                a small telescope: a green core fading to cyan further out. */}
            <mesh>
              <sphereGeometry args={[config.visualRadius * 0.85, 40, 32]} />
              <meshBasicMaterial
                ref={comaInnerMatRef as React.Ref<import("three").MeshBasicMaterial>}
                color={invert ? "#4d8478" : "#b8ffd4"}
                transparent
                opacity={invert ? 0.55 : 0.55}
                blending={invert ? NormalBlending : AdditiveBlending}
                depthWrite={false}
              />
            </mesh>

            {/* 3. Mid coma — cyan halo, the layer the eye reads as "the comet". */}
            <mesh>
              <sphereGeometry args={[config.visualRadius * 1.55, 40, 32]} />
              <meshBasicMaterial
                ref={comaMidMatRef as React.Ref<import("three").MeshBasicMaterial>}
                color={config.shade}
                transparent
                opacity={invert ? 0.45 : 0.42}
                blending={invert ? NormalBlending : AdditiveBlending}
                depthWrite={false}
              />
            </mesh>

            {/* 4. Outer coma — very faint diffuse glow, fades into space.
                Suggests the immense hydrogen envelope without making
                the comet look bloated. */}
            <mesh>
              <sphereGeometry args={[config.visualRadius * 2.5, 40, 32]} />
              <meshBasicMaterial
                ref={comaOuterMatRef as React.Ref<import("three").MeshBasicMaterial>}
                color={config.shade}
                transparent
                opacity={invert ? 0.22 : 0.16}
                blending={invert ? NormalBlending : AdditiveBlending}
                depthWrite={false}
              />
            </mesh>

            {/* 5–9 all live inside tailRef so they share the
                "y-axis points anti-solar" orientation set per-frame. */}
            <group ref={tailRef}>
              {/* 5. Sunward envelope — bright dust hood on the Sun-facing
                  side. Half-sphere at the -y pole (sunward); shader makes
                  the apex brightest, fading to the rim. */}
              <mesh>
                <sphereGeometry args={[
                  config.visualRadius * 1.4,
                  20, 12,
                  0, Math.PI * 2,
                  Math.PI * 0.42, Math.PI * 0.58,
                ]} />
                <shaderMaterial
                  ref={envelopeMatRef}
                  vertexShader={COMET_ENVELOPE_VERTEX_SHADER}
                  fragmentShader={COMET_ENVELOPE_FRAGMENT_SHADER}
                  uniforms={envelopeUniforms}
                  transparent
                  blending={invert ? NormalBlending : AdditiveBlending}
                  depthWrite={false}
                  side={DoubleSide}
                />
              </mesh>

              {/* 6. Jets — three thin plumes biased toward the sunward
                  hemisphere. Rotate slowly via jetsRef so each jet
                  swings in and out of view, faking the rotation of the
                  underlying nucleus (the signature pulsing in Rosetta
                  footage of 67P's coma). All three share one shader
                  material so the per-frame uniform update is cheap. */}
              <group ref={jetsRef}>
                {[
                  { tiltX: Math.PI - 0.15, tiltZ:  0.0,  yaw: 0.0 },
                  { tiltX: Math.PI - 0.30, tiltZ:  0.55, yaw: 2.1 },
                  { tiltX: Math.PI - 0.12, tiltZ: -0.45, yaw: 4.0 },
                ].map((j, i) => (
                  <mesh
                    key={i}
                    rotation={[j.tiltX, j.yaw, j.tiltZ]}
                  >
                    <coneGeometry args={[
                      config.visualRadius * 0.10,
                      config.visualRadius * 1.7,
                      20, 1, true,
                    ]} />
                    <shaderMaterial
                      ref={i === 0 ? jetMatRef : undefined}
                      vertexShader={COMET_TAIL_VERTEX_SHADER}
                      fragmentShader={COMET_TAIL_FRAGMENT_SHADER}
                      uniforms={jetUniforms}
                      transparent
                      blending={invert ? NormalBlending : AdditiveBlending}
                      depthWrite={false}
                      side={DoubleSide}
                    />
                  </mesh>
                ))}
              </group>

              {/* 7. Ion tail — straight, anti-radial. Knotted plasma
                  flicker driven by the shader's uTime + uKnotStrength. */}
              <mesh
                ref={tailMeshRef}
                position={[0, config.visualRadius * 7.0 * config.tailLengthFactor, 0]}
              >
                <coneGeometry args={[
                  config.visualRadius * 0.55,
                  config.visualRadius * 14 * config.tailLengthFactor,
                  32, 1, true,
                ]} />
                <shaderMaterial
                  ref={tailMatRef}
                  vertexShader={COMET_TAIL_VERTEX_SHADER}
                  fragmentShader={COMET_TAIL_FRAGMENT_SHADER}
                  uniforms={ionTailUniforms}
                  transparent
                  blending={invert ? NormalBlending : AdditiveBlending}
                  depthWrite={false}
                  side={DoubleSide}
                />
              </mesh>

              {/* 8. Dust tail — broader, warmer, slightly longer; offset
                  14° around local z so it visibly splays from the ion
                  tail. Smooth (no plasma knots). */}
              <mesh
                ref={dustTailMeshRef}
                position={[0, config.visualRadius * 8.0 * config.tailLengthFactor, 0]}
                rotation={[0, 0, 0.24]}
              >
                <coneGeometry args={[
                  config.visualRadius * 0.95,
                  config.visualRadius * 16 * config.tailLengthFactor,
                  32, 1, true,
                ]} />
                <shaderMaterial
                  ref={dustTailMatRef}
                  vertexShader={COMET_TAIL_VERTEX_SHADER}
                  fragmentShader={COMET_TAIL_FRAGMENT_SHADER}
                  uniforms={dustTailUniforms}
                  transparent
                  blending={invert ? NormalBlending : AdditiveBlending}
                  depthWrite={false}
                  side={DoubleSide}
                />
              </mesh>

              {/* 9. Anti-tail — only built for the one comet that famously
                  showed one. Points sunward (rotation flips the cone so
                  apex is at -y). Fades in tightly around perihelion. */}
              {config.hasAntiTail && (
                <mesh
                  ref={antiTailMeshRef}
                  position={[0, -config.visualRadius * 1.4, 0]}
                  rotation={[Math.PI, 0, 0]}
                >
                  <coneGeometry args={[
                    config.visualRadius * 0.30,
                    config.visualRadius * 2.8,
                    12, 1, true,
                  ]} />
                  <shaderMaterial
                    ref={antiTailMatRef}
                    vertexShader={COMET_TAIL_VERTEX_SHADER}
                    fragmentShader={COMET_TAIL_FRAGMENT_SHADER}
                    uniforms={antiTailUniforms}
                    transparent
                    blending={invert ? NormalBlending : AdditiveBlending}
                    depthWrite={false}
                    side={DoubleSide}
                  />
                </mesh>
              )}
            </group>
          </>
        ) : surfaceTexture ? (
          // Real mapped world — Ceres, Vesta, and any body with a mission mosaic
          // (Dawn / New Horizons). A clean 64-seg sphere so the map wraps without
          // seams, lightly triaxially-scaled so large irregular bodies (Vesta's
          // oblateness) still read their true shape. Lit, not emissive: a real
          // sunlit surface, not a lamp. The scale group tumbles via nucleusRef.
          <group
            ref={nucleusRef as React.Ref<Group>}
            scale={body.triaxial ?? [1, 1, 1]}
          >
            <mesh>
              <sphereGeometry args={[config.visualRadius, 64, 64]} />
              <meshStandardMaterial
                map={surfaceTexture}
                color="#ffffff"
                roughness={0.9}
                metalness={0.0}
                emissive={config.shade}
                emissiveIntensity={invert ? 0.0 : 0.05}
              />
            </mesh>
          </group>
        ) : body.kind === "asteroid" && rockGeometry ? (
          // Real asteroid — a lumpy, tumbling shard with the body's true triaxial
          // shape (Eros peanut, Apophis elongated, Ida a shattered fragment), not
          // a glowing ball. Rough, sunlit rock; reuses nucleusRef so it tumbles.
          <mesh ref={nucleusRef} geometry={rockGeometry}>
            <meshStandardMaterial
              color={config.shade}
              roughness={0.96}
              metalness={0.0}
              emissive={config.shade}
              emissiveIntensity={invert ? 0.0 : 0.14}
              flatShading={false}
            />
          </mesh>
        ) : body.kind === "dwarf" && dwarfSurfaceMaterial ? (
          // Un-imaged Kuiper dwarf (Eris/Makemake/Haumea) — a PROCEDURAL ice/rock
          // surface driven only by real published properties (albedo, colour,
          // ice vs tholin, Haumea's Dark Red Spot). Honest inference, flagged
          // "surface inferred" in the InfoPanel. Triaxially scaled so Haumea
          // keeps its extreme 3.9-hour-spin football shape; tumbles via nucleusRef.
          <group ref={nucleusRef as React.Ref<Group>} scale={body.triaxial ?? [1, 1, 1]}>
            <mesh>
              <sphereGeometry args={[config.visualRadius, 64, 64]} />
              <primitive object={dwarfSurfaceMaterial} attach="material" ref={dwarfSurfMatRef} />
            </mesh>
          </group>
        ) : body.kind === "dwarf" ? (
          // Dwarf planet with NO map + no profile — a shaded world tinted to its
          // real albedo/colour. We don't invent detail we don't have.
          <mesh>
            <sphereGeometry args={[config.visualRadius, 64, 64]} />
            <meshStandardMaterial
              color={config.shade}
              roughness={0.85}
              metalness={0.0}
              emissive={config.shade}
              emissiveIntensity={invert ? 0.0 : 0.08}
            />
          </mesh>
        ) : (
          // Interstellars / anything else — smooth shaded body.
          <mesh>
            <sphereGeometry args={[config.visualRadius, 48, 48]} />
            <meshStandardMaterial
              color={config.shade}
              emissive={config.shade}
              emissiveIntensity={invert ? 0.0 : 0.5}
              roughness={0.7}
            />
          </mesh>
        )}
        {/* Always-visible glint — a findable point of light so NOTHING needs to
            be selected first to be seen (Voyager at 57 units, faint NEOs, distant
            comets). Scaled each frame to hold a min apparent size; tucks inside
            the real body up close. Non-raycasting so it never blocks a click. */}
        {glintMaterial && (
          <sprite ref={glintRef} material={glintMaterial} raycast={() => null} />
        )}
        <mesh
          onPointerOver={(e) => {
            e.stopPropagation()
            setIsHovered(true)
            onHover({
              name: body.name,
              classification:
                body.kind === "comet"        ? `Comet · ${body.designation}` :
                body.kind === "asteroid"     ? `Asteroid · ${body.designation}` :
                body.kind === "spacecraft"   ? `Spacecraft · ${body.designation}` :
                body.kind === "dwarf"        ? `Dwarf planet · ${body.designation}` :
                /* interstellar */              `Interstellar · ${body.designation}`,
              aAU: body.aAU,
              periodDays: isFinite(body.periodYears) ? body.periodYears * 365.25 : undefined,
              fact: body.fact,
              deep: body.deep,
              followable: interactive,
                gravityMeasurement:
                  body.kind === "comet" || body.kind === "asteroid"
                    ? {
                        label: "Gravity",
                        note: "Microgravity body; no catalogued surface gravity value",
                      }
                    : undefined,
              orbital: {
                eccentricity: body.eccentricity,
                inclDeg: body.inclDeg,
                longNodeDeg: body.longNodeDeg,
                argPeriDeg: body.argPeriDeg,
                elementsEpoch: body.elementsEpoch,
              },
            })
          }}
          onPointerOut={() => {
            setIsHovered(false)
            onHover(null)
          }}
          // Single click engages follow mode — the camera locks onto this
          // body and tracks it as it sweeps its orbit. A plain fly-to would
          // leave fast movers (comets at perihelion, the ISS, interstellar
          // visitors) drifting out of frame, so follow is the default for
          // every named body. Double-click is wired to the same handler as
          // a discoverability fallback for users who instinctively
          // double-click a moving target.
          onClick={
            interactive
              ? (e) => {
                  e.stopPropagation()
                  // The getter captures groupRef.current — read fresh each
                  // frame so we always see the body's current orbital phase.
                  requestFollow(
                    () => {
                      const g = groupRef.current
                      if (!g) return null
                      const v = new Vector3()
                      g.getWorldPosition(v)
                      return { x: v.x, y: v.y, z: v.z }
                    },
                    body.kind === "dwarf" ? 2.4 : 1.6,
                    body.name,
                  )
                }
              : undefined
          }
          onDoubleClick={
            interactive
              ? (e) => {
                  e.stopPropagation()
                  requestFollow(
                    () => {
                      const g = groupRef.current
                      if (!g) return null
                      const v = new Vector3()
                      g.getWorldPosition(v)
                      return { x: v.x, y: v.y, z: v.z }
                    },
                    body.kind === "dwarf" ? 2.4 : 1.6,
                    body.name,
                  )
                }
              : undefined
          }
        >
          <sphereGeometry args={[hitRadius, 12, 12]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        {/* Target ring — the AFFORDANCE. On hover, a thin billboarded ring
            around the body signals "this is a real object you can click + fly
            to", so comets/spacecraft don't read as inert smudges. Sized to the
            body's visual radius; faces the camera. */}
        {isHovered && (
          <Billboard>
            <mesh>
              <ringGeometry args={[config.visualRadius * 1.6, config.visualRadius * 1.78, 48]} />
              <meshBasicMaterial
                color={invert ? "#1a1a1a" : "#ffffff"}
                transparent
                opacity={0.7}
                side={DoubleSide}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
          </Billboard>
        )}

        {/* Hover label — matches the planet hover-label pattern so comets,
            asteroids, spacecraft, and dwarfs all get the same floating-name
            affordance. Desktop only; mobile uses the bottom sheet. */}
        {isHovered && (
          <Html
            position={[0, cometAffordance.labelOffset, 0]}
            center
            distanceFactor={8}
            zIndexRange={[10, 0]}
            style={{ pointerEvents: "none" }}
          >
            <div
              className={`
                whitespace-nowrap select-none pointer-events-none
                font-mono text-[10px] tracking-[0.3em] uppercase
                px-2 py-1 rounded-full backdrop-blur-sm
                ${
                  invert
                    ? "bg-white/85 border border-foreground/25 text-foreground"
                    : "bg-black/55 border border-white/20 text-white"
                }
              `}
              style={{ animation: "ue-label-in 220ms ease-out both" }}
            >
              {body.name}
            </div>
          </Html>
        )}
      </group>
    </group>
  )
}

export function NamedBodies({
  onHover,
  invert = false,
  interactive = false,
}: {
  onHover: HoverHandler
  invert?: boolean
  interactive?: boolean
}) {
  return (
    <group>
      {namedBodies.map((body) => (
        <NamedBodyMesh
          key={body.designation}
          body={body}
          onHover={onHover}
          invert={invert}
          interactive={interactive}
        />
      ))}
    </group>
  )
}
