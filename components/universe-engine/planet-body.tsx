"use client"

/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine — see ./index.tsx for the full notice.
 * https://github.com/sinhaankur/portfolio-2026/blob/main/LICENSE
 *
 * planet-body — the planet sub-engine: ONE planet renderer (the biggest one).
 *
 * Renders a single planet with every real-data layer it warrants: a shaded
 * body; an sRGB surface texture with optional MOLA/LOLA displacement relief; a
 * day/night terminator shader (Earth) whose sun direction is updated each frame;
 * drifting cloud + band shells (gas giants); an aurora shell; an atmosphere
 * glow; Saturn's real ring system (band structure + cast shadow); surface pins
 * (RoverPin); its moons (MoonBody); its human-made orbiter shells + hero craft
 * (SatelliteShells / SATELLITE_CATALOG / HERO_CRAFT); and its orbital path
 * (OrbitRing). Hover/click drive the InfoPanel + fly-to follow, in both the
 * explore and true-scale modes.
 *
 * Saturn's ring geometry helper + ring shaders live here too — they are used
 * only by this renderer.
 *
 * Composed by <SolarSystem> in scene.tsx. Cross-cutting pieces are imported:
 * shaders from ./shaders, the scratch-vector pool from ./scene-shared, orbiters
 * + pins from ./scene-satellites, the moon renderer from ./moon-body, the shared
 * orbital-path ring from ./orbit-ring.
 */

import { useRef, useMemo, useState, useEffect, Suspense } from "react"
import { useFrame } from "@react-three/fiber"
import { Html } from "@react-three/drei"
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  ClampToEdgeWrapping,
  Color,
  DoubleSide,
  Group,
  Matrix3,
  Mesh,
  NormalBlending,
  RepeatWrapping,
  ShaderMaterial,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  type Texture,
} from "three"
import {
  DEG,
  SUN_OFFSET_SCENE,
  compressRadius,
  surfaceTextureUrl,
  hiResTexturesRef,
  deviceTierRef,
  focusDepthRef,
  meanAnomalyAt,
  earthRotationAngle,
  requestFollow,
  simTimeRef,
  cloudsVisibleRef,
  satellitesVisibleRef,
  planetToInfo,
  timeWarpRef,
  eccentricToTrue,
  solveKepler,
  moons,
} from "./astronomy"
import type { HoverHandler, ScenePlanet } from "./types"
import {
  DAY_NIGHT_VERTEX_SHADER,
  DAY_NIGHT_FRAGMENT_SHADER,
  CLOUD_VERTEX_SHADER,
  CLOUD_FRAGMENT_SHADER,
  AURORA_VERTEX_SHADER,
  AURORA_FRAGMENT_SHADER,
  BANDS_VERTEX_SHADER,
  BANDS_FRAGMENT_SHADER,
  ATMOS_VERTEX_SHADER,
  ATMOS_FRAGMENT_SHADER,
} from "./shaders"
import { _earthWorldPos, _sunWorldPos, _sunDirTmp } from "./scene-shared"
import {
  RoverPin,
  SatelliteShells,
  SATELLITE_CATALOG,
  HERO_CRAFT,
} from "./scene-satellites"
import { MoonBody } from "./moon-body"
import { SatelliteField } from "./satellite-field"
import { FlightField } from "./flight-field"

// One-shot latch so the Google-Earth auto-descend fires once per approach (not
// every frame while you sit at the surface); re-armed when the camera pulls back.
let _earthDescendArmed = false

/**
 * Build a ring geometry with proper radial UVs — `u` runs from 0 (inner
 * radius) to 1 (outer radius), `v` wraps 0→1 around the circumference.
 * Three.js's built-in RingGeometry uses an annular-projection UV layout
 * that doesn't let us cleanly map a horizontal strip texture.
 */
function radialUVRingGeometry(innerR: number, outerR: number, segments: number) {
  const verts: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2
    const cosT = Math.cos(theta)
    const sinT = Math.sin(theta)
    verts.push(cosT * innerR, sinT * innerR, 0)
    uvs.push(0, i / segments)
    verts.push(cosT * outerR, sinT * outerR, 0)
    uvs.push(1, i / segments)
  }
  for (let i = 0; i < segments; i++) {
    const a = i * 2
    indices.push(a, a + 2, a + 1)
    indices.push(a + 2, a + 3, a + 1)
  }
  const geo = new BufferGeometry()
  geo.setAttribute("position", new BufferAttribute(new Float32Array(verts), 3))
  geo.setAttribute("uv", new BufferAttribute(new Float32Array(uvs), 2))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

// Ring shader — keeps the texture's real band structure (C/B/Cassini/A/F) but
// adds two physically-real details a flat unlit material can't: (1) the planet's
// SHADOW cast across the rings (a dark arc — the signature Cassini-image look),
// and (2) a subtle forward/back-scatter brightness from the sun angle so the
// rings aren't uniformly flat. uv.x is radial (0=inner,1=outer); the shell
// passes the ring point's local position so we can test it against the shadow.
const RING_VERTEX_SHADER = `
  varying vec2 vUv;
  varying vec3 vLocal;
  void main() {
    vUv = uv;
    vLocal = position;                       // ring-plane local coords
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const RING_FRAGMENT_SHADER = `
  uniform sampler2D uMap;
  uniform float uOpacity;
  uniform vec3  uColor;
  uniform vec3  uSunDirLocal;   // sun direction in the ring's local frame
  uniform float uPlanetR;       // planet radius in the same local units
  uniform float uHasMap;
  varying vec2 vUv;
  varying vec3 vLocal;
  void main() {
    vec4 tex = uHasMap > 0.5 ? texture2D(uMap, vUv) : vec4(1.0);
    float alpha = tex.a * uOpacity;
    if (alpha < 0.003) discard;
    vec3 col = tex.rgb * uColor;

    // --- Planet shadow on the rings ---------------------------------------
    // Project the ring point onto the plane perpendicular to the sun; if the
    // component of its position across the sun-line falls within the planet's
    // radius AND it's on the far side of the planet from the sun, it's shadowed.
    vec3 s = normalize(uSunDirLocal);
    float along = dot(vLocal, s);                  // distance along sun-line
    vec3 perp = vLocal - s * along;                // offset from the sun-line
    float perpLen = length(perp);
    // shadowed = behind the planet (along<0) and within its radius of the line
    float core = 1.0 - smoothstep(uPlanetR * 0.82, uPlanetR * 1.02, perpLen);
    float behind = smoothstep(0.0, -0.15, along); // 1 when clearly behind
    float shadow = core * behind;
    col *= mix(1.0, 0.12, shadow);                 // deep umbra, soft penumbra
    alpha *= mix(1.0, 0.55, shadow);               // shadowed ring dims too

    gl_FragColor = vec4(col, alpha);
  }
`

function SaturnRings({
  planetRadius,
  invert = false,
  highlighted = false,
}: {
  planetRadius: number
  invert?: boolean
  highlighted?: boolean
}) {
  // Rings sit in Saturn's equatorial plane. The parent group applies the
  // 26.73° axial tilt, so rings inherit it naturally.
  //
  // Real ring structure, in Saturn-radii — encoded into the texture's alpha
  // channel by Solar System Scope (CC BY 4.0, same source as the planet
  // surfaces). Span runs the C ring's inner edge (1.24×) through the F
  // ring's outer edge (2.34×). The Cassini Division shows up naturally as
  // the texture's transparent band. A shader adds the planet's cast shadow.
  const matRef = useRef<ShaderMaterial>(null)
  const [texture, setTexture] = useState<Texture | null>(null)
  const ringUniforms = useMemo(
    () => ({
      uMap:         { value: null as Texture | null },
      uOpacity:     { value: 0 },
      uColor:       { value: new Color(invert ? "#1a1208" : "#ffffff") },
      uSunDirLocal: { value: new Vector3(1, 0, 0) },
      uPlanetR:     { value: planetRadius },
      uHasMap:      { value: 0 },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [planetRadius],
  )

  // Custom geometry: u is radial (0 = C ring inner, 1 = F ring outer),
  // v wraps around the circle. Lets the horizontal-strip ring texture
  // map cleanly across the ring system.
  const ringGeometry = useMemo(
    () => radialUVRingGeometry(planetRadius * 1.24, planetRadius * 2.34, 192),
    [planetRadius],
  )

  useEffect(() => {
    if (texture) return
    const loader = new TextureLoader()
    loader.load("/textures/saturn-ring.webp", (tex) => {
      tex.colorSpace = SRGBColorSpace
      tex.anisotropy = 8
      tex.wrapS = ClampToEdgeWrapping
      tex.wrapT = RepeatWrapping
      setTexture(tex)
      ringUniforms.uMap.value = tex
      ringUniforms.uHasMap.value = 1
    })
  }, [texture, ringUniforms])

  useEffect(() => {
    ringUniforms.uColor.value.set(invert ? "#1a1208" : "#ffffff")
  }, [invert, ringUniforms])

  const idleOpacity = invert ? 0.78 : 0.62
  const hoverOpacity = invert ? 1.0 : 0.95

  const _ringSunWorld = useMemo(() => new Vector3(), [])
  const _ringGrpWorld = useMemo(() => new Vector3(), [])
  const _ringDirWorld = useMemo(() => new Vector3(), [])
  const _ringNormalMat = useMemo(() => new Matrix3(), [])
  const meshRef = useRef<Mesh>(null)

  useFrame((_, delta) => {
    if (!matRef.current) return
    const k = 1 - Math.exp(-delta * 8)
    const target = highlighted ? hoverOpacity : idleOpacity
    matRef.current.uniforms.uOpacity.value +=
      (target - matRef.current.uniforms.uOpacity.value) * k
    // Sun direction in the ring mesh's LOCAL frame (so the shadow tracks
    // Saturn's real orbital position + the 26.7° ring tilt). Take the world-space
    // sun→ring direction, then rotate it into local space with the inverse of the
    // mesh's world rotation (the normal matrix of the inverse world matrix).
    if (meshRef.current) {
      meshRef.current.getWorldPosition(_ringGrpWorld)
      _ringSunWorld.set(SUN_OFFSET_SCENE, 0, 0)
      _ringDirWorld.copy(_ringSunWorld).sub(_ringGrpWorld).normalize()
      _ringNormalMat.getNormalMatrix(meshRef.current.matrixWorld).invert()
      matRef.current.uniforms.uSunDirLocal.value
        .copy(_ringDirWorld)
        .applyMatrix3(_ringNormalMat)
        .normalize()
    }
  })

  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
      <mesh geometry={ringGeometry} ref={meshRef}>
        <shaderMaterial
          ref={matRef as React.Ref<ShaderMaterial>}
          vertexShader={RING_VERTEX_SHADER}
          fragmentShader={RING_FRAGMENT_SHADER}
          uniforms={ringUniforms}
          transparent
          side={DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}


export function PlanetBody({
  planet,
  onHover,
  invert = false,
  interactive = false,
  solarOnly = false,
}: {
  planet: ScenePlanet
  onHover: HoverHandler
  invert?: boolean
  interactive?: boolean
  /** In the solar-only explorer, Earth shows the full ~15.7k real-satellite
   *  catalogue (too heavy for the passive hero). */
  solarOnly?: boolean
}) {
  const meshRef = useRef<Mesh>(null)
  const orbitRef = useRef<Group>(null)
  const texMeshRef = useRef<Mesh>(null)
  const texMatRef = useRef<import("three").MeshStandardMaterial>(null)
  const bandsMeshRef = useRef<import("three").Mesh>(null)
  /** Rotates in lockstep with the planet body — children inherit the spin
   *  so surface features (rover pins on Mars) stay glued to the right spot. */
  const surfaceRotRef = useRef<Group>(null)
  /** Earth's day/night shader material — uniforms are updated each frame
   *  with the sun direction in world space so the terminator stays accurate
   *  as Earth orbits and rotates. */
  const dayNightMatRef = useRef<ShaderMaterial>(null)
  /** Ref on the position group so eccentric orbits (Pluto) can have their
   *  orbital distance vary with current orbit angle, matching the elliptical
   *  ring rendered by OrbitRing. */
  const positionRef = useRef<Group>(null)
  const [isHovered, setIsHovered] = useState(false)
  // `focused` persists after a click → fly-to so the planet's texture +
  // atmosphere bloom stay visible after arrival, even when the cursor
  // moves off the hit zone. Cleared by Reset or by focusing a different
  // body (same machinery the sky-points use).
  const [focused, setFocused] = useState(false)
  const [texture, setTexture] = useState<Texture | null>(null)
  const [nightTexture, setNightTexture] = useState<Texture | null>(null)
  const [elevationTexture, setElevationTexture] = useState<Texture | null>(null)
  const detailActive = isHovered || focused

  // Listen for a global focus-clear (e.g. Reset) so the planet collapses
  // back to its idle chart-marker appearance.
  useEffect(() => {
    const onSkyFocus = (e: Event) => {
      const detail = (e as CustomEvent<{ pointId: string | null; framing?: string }>).detail
      const id = detail?.pointId
      if (id !== `planet:${planet.raw.name}`) {
        setFocused(false)
        return
      }
      // "earth-moon" framing pulls the camera back far enough to hold BOTH Earth
      // (with its satellite shell) AND the Moon's orbit (0.42 units out) in one
      // view — the "Earth, its satellites, and Luna" preset.
      const earthMoonView = detail?.framing === "earth-moon" && planet.raw.name === "Earth"
      // This planet is the warp target — fly the camera to it. Mirrors the
      // click handler: follow the planet's live world position (read from the
      // orbital position group) so it stays framed as it orbits. This is what
      // makes the "Jump to" destinations menu work across both scale modes.
      setFocused(true)
      const obj = positionRef.current
      if (obj) {
        // In the solar explorer, Earth is the satellite-shell subject — pull the
        // camera back further so the WHOLE shell wraps visibly around the globe
        // (the LeoLabs framing) instead of filling the screen with a slice. Other
        // bodies + the home hero keep the tighter, hero-sized framing.
        const earthShellFraming = solarOnly && planet.raw.name === "Earth"
        // ~5× Earth radius: close enough that the LEO shell (a thin band ~6–30%
        // above the surface at true scale) reads as a visible ring, but pulled
        // back enough to see it wrap the whole globe. (3.5× = only a slice; 9× =
        // Earth too small, shell too thin to see.)
        const followDistance = earthMoonView
          // Frame Earth + the Moon's whole orbit (Moon at 0.42) with headroom.
          ? 1.05
          : Math.max(
              planet.visualRadius * (earthShellFraming ? 5 : planet.raw.hasRings ? 5 : 3.5),
              earthShellFraming ? 0.6 : 0.5,
            )
        // Arrive on the SUNLIT side (offset ~30° so the terminator + night-side
        // city lights stay in frame). Without this the camera keeps whatever
        // angle it held — often the night side, which reads as a black disc.
        let approachDir: { x: number; y: number; z: number } | undefined
        if (earthShellFraming) {
          const earthW = new Vector3()
          obj.getWorldPosition(earthW)
          const sunward = new Vector3(SUN_OFFSET_SCENE, 0, 0).sub(earthW).normalize()
          const side = new Vector3().crossVectors(sunward, new Vector3(0, 1, 0)).normalize()
          approachDir = sunward.addScaledVector(side, 0.55).add(new Vector3(0, 0.28, 0)).normalize()
        }
        // Let the camera actually DOLLY UP to the planet's surface: without a
        // per-focus depth override the global minDistance (0.006) + near-plane
        // frame the planet but zoom-IN stalls / clips before you reach the surface.
        // Set near + minDistance relative to THIS planet's radius so you can
        // approach it (like the satellite deep-zoom does). Cleared on Reset.
        focusDepthRef.current = {
          near: Math.max(planet.visualRadius * 0.02, 0.002),
          minDistance: planet.visualRadius * 1.05, // just above the surface
        }
        requestFollow(
          () => {
            const v = new Vector3()
            obj.getWorldPosition(v)
            return { x: v.x, y: v.y, z: v.z }
          },
          followDistance,
          planet.raw.name,
          approachDir,
        )
      }
    }
    window.addEventListener("universe:sky-focus", onSkyFocus)
    return () => window.removeEventListener("universe:sky-focus", onSkyFocus)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planet.raw.name])

  // 4K on desktop when available, lighter 2K on mobile (perf/texture budget).
  const textureUrl = surfaceTextureUrl(planet.raw)
  const hasTexture = Boolean(textureUrl)

  // Eagerly load each planet's equirectangular surface texture on mount —
  // the solar system is meant to read as the real solar system at a glance,
  // not an abstract chart that resolves on hover. TextureLoader is async, so
  // first paint isn't blocked: the grey markers render immediately and the
  // photographic surfaces fade in as each WebP (NASA Blue Marble for Earth,
  // Solar System Scope CC BY for the rest) lands. WebP keeps the same
  // visual quality at ~35% of the original JPEG size — meaningful on mobile.
  //
  // Mobile-first: outer planets (Jupiter + beyond) get a 500ms delay so the
  // inner-system textures (which are smaller in scene size + closer to the
  // camera on default load) win the browser's first round of fetch slots.
  // Total bandwidth is unchanged; first-paint quality improves on phones.
  // PROGRESSIVE load — Earth (and any planet) must show its surface FAST, then
  // sharpen. Always load the light base texture FIRST so the globe appears
  // immediately; if a hi-res tier applies (desktop deep-zoom, e.g. Earth's 8K),
  // load it in the background and swap it in when ready. The old code loaded
  // ONLY surfaceTextureUrl() — which returns the 8K on the celestial page — so
  // the globe stayed grey until 2.7 MB finished (or forever if it stalled). That
  // was the "grey ball" bug on deep-zoom.
  useEffect(() => {
    if (texture) return
    const isOuterPlanet = planet.raw.aAU > 4
    const delay = isOuterPlanet ? 500 : 0
    const baseUrl = planet.raw.textureUrl
    // Decide the hi-res tier from the DATA + device tier directly — NOT from
    // hiResTexturesRef, because that ref can flip true after this effect runs
    // (celestial sets it on its own mount), leaving Earth stuck on the blurry 2K
    // with no re-run to upgrade. If a planet HAS a hiResTextureUrl and we're on a
    // desktop-tier GPU, always chase it in the background.
    const hiResUrl =
      deviceTierRef.current === "desktop" && planet.raw.hiResTextureUrl
        ? planet.raw.hiResTextureUrl
        : undefined
    if (!baseUrl && !hiResUrl) return
    let cancelled = false
    const timer = setTimeout(() => {
      const loader = new TextureLoader()
      // 1) base first — the globe appears the moment this lands.
      loader.load(baseUrl ?? hiResUrl!, (tex) => {
        if (cancelled) return
        tex.colorSpace = SRGBColorSpace
        tex.anisotropy = 8
        setTexture(tex)
        // 2) upgrade to hi-res in the background, if different, then swap.
        if (hiResUrl && hiResUrl !== baseUrl) {
          loader.load(hiResUrl, (hi) => {
            if (cancelled) return
            hi.colorSpace = SRGBColorSpace
            hi.anisotropy = 8
            setTexture(hi)
          })
        }
      })
    }, delay)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [texture, planet.raw.aAU, planet.raw.textureUrl, planet.raw.hiResTextureUrl])

  // Optional night-side texture (city lights). Currently only Earth ships
  // this — drives the day/night shader below. Loaded with a small delay
  // so it lands after the day texture (which is the primary surface). On the
  // desktop deep-zoom explorer it swaps to the 8K Black Marble (city lights
  // resolve into individual cities) just like the day map's hiRes tier.
  const nightTextureUrl = planet.raw.nightTextureUrl
  // Same ref-race fix as the day map: decide from device tier + data, not the
  // hiResTexturesRef (which can flip after this runs).
  const hiResNightUrl =
    deviceTierRef.current === "desktop" && planet.raw.hiResNightTextureUrl
      ? planet.raw.hiResNightTextureUrl
      : undefined
  // Progressive, like the day map: load the light base night texture first (so the
  // day/night globe can show), then swap the 8K city-lights in behind it.
  useEffect(() => {
    if (!nightTextureUrl || nightTexture) return
    let cancelled = false
    const timer = setTimeout(() => {
      const loader = new TextureLoader()
      loader.load(nightTextureUrl, (tex) => {
        if (cancelled) return
        tex.colorSpace = SRGBColorSpace
        tex.anisotropy = 8
        setNightTexture(tex)
        if (hiResNightUrl && hiResNightUrl !== nightTextureUrl) {
          loader.load(hiResNightUrl, (hi) => {
            if (cancelled) return
            hi.colorSpace = SRGBColorSpace
            hi.anisotropy = 8
            setNightTexture(hi)
          })
        }
      })
    }, 300)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [nightTextureUrl, nightTexture, hiResNightUrl])

  // Optional elevation/height map (Mars MOLA) for real terrain relief. Loaded
  // last (after day + night) since it's a deep-zoom nicety, not the primary
  // surface. NOT sRGB — it's raw height data, sampled linearly in the shader.
  // Gated on hiResTexturesRef like the 4K maps: relief is invisible at the
  // hero's wide view but the MOLA map alone is ~1 MB — only the deep-zoom
  // explorer (/lab/celestial) pays for it. Read inside the timeout so the
  // gate reflects the consumer's mount-time flip.
  const elevationUrl = planet.raw.elevationUrl
  useEffect(() => {
    if (!elevationUrl || elevationTexture) return
    const timer = setTimeout(() => {
      if (!hiResTexturesRef.current || deviceTierRef.current !== "desktop") return
      const loader = new TextureLoader()
      loader.load(elevationUrl, (tex) => {
        tex.anisotropy = 4
        setElevationTexture(tex)
      })
    }, 500)
    return () => clearTimeout(timer)
  }, [elevationUrl, elevationTexture])

  // Day/night shader uniforms — stable object so the shader sees the same
  // reference across re-renders. Textures + sun direction are mutated in
  // place after the uniforms are wired up. Earth uses this with both
  // textures + a soft Earth-atmosphere terminator; Mercury / Mars use it
  // without a night texture (shadow side falls to ambient dark) with a
  // sharper terminator matching their atmospheres.
  const useDayNightShader = Boolean(nightTextureUrl) || Boolean(planet.raw.useDayNight)
  const dayNightUniforms = useMemo(
    () => ({
      tDay:                 { value: null as Texture | null },
      tNight:               { value: null as Texture | null },
      uSunDir:              { value: new Vector3(1, 0, 0) },
      uOpacity:             { value: 0 },
      uNightStrength:       { value: nightTextureUrl ? 1.8 : 0 },
      uHasNight:            { value: nightTextureUrl ? 1.0 : 0.0 },
      uTerminatorSoftness:  { value: planet.raw.terminatorSoftness ?? 0.18 },
      // Polar-smear fix: on for bodies whose equirectangular map streaks at the
      // poles (Mars). uPolarTint is the clean cap colour to fade toward.
      uPolarFix:            { value: planet.raw.polarTint ? 1 : 0 },
      uPolarTint:           { value: new Color(planet.raw.polarTint ?? "#ffffff") },
      // Real terrain relief from a height map (Mars MOLA). tElevation is set
      // once the map loads; uElevation is 0 until then (and for every body
      // without an elevationUrl), so displacement is off by default.
      tElevation:           { value: null as Texture | null },
      uElevation:           { value: 0 },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  useEffect(() => {
    if (texture) dayNightUniforms.tDay.value = texture
    if (nightTexture) dayNightUniforms.tNight.value = nightTexture
    // Only tell the shader there's a night map once it's ACTUALLY loaded — the
    // globe shows as soon as the DAY texture is ready (dark side falls to ambient
    // until the city-lights land), instead of staying grey waiting on both.
    dayNightUniforms.uHasNight.value = nightTexture ? 1.0 : 0.0
    dayNightUniforms.uNightStrength.value = nightTexture ? 1.8 : 0.0
    if (elevationTexture) {
      dayNightUniforms.tElevation.value = elevationTexture
      // Scale is in visual-radius units; small so relief reads without
      // shattering the mesh (matches the coverage view's ~0.035 feel).
      dayNightUniforms.uElevation.value =
        (planet.raw.elevationScale ?? 0.03) * planet.visualRadius
    }
  }, [texture, nightTexture, elevationTexture, dayNightUniforms, planet.raw.elevationScale, planet.visualRadius])

  // Procedural cloud shell — Earth only. Animated FBM noise lit by the Sun;
  // togglable via cloudsVisibleRef. uOpacity lerps with the planet's own
  // fade (so clouds appear/disappear with the textured globe) AND the toggle.
  const isEarth = planet.raw.name === "Earth"
  // Banded / hazy atmospheres that should DRIFT over their texture (a thin
  // animated turbulence shell): Venus's sulfuric haze + the four gas/ice giants'
  // latitudinal bands. Earth already has its own cloud shell, so it's excluded.
  const BANDED: Record<string, { speed: number; tint: string; strength: number }> = {
    Venus:   { speed: 0.020, tint: "#e8d8a0", strength: 0.30 },
    Jupiter: { speed: 0.060, tint: "#e7d3b0", strength: 0.42 },
    Saturn:  { speed: 0.040, tint: "#e9dcb8", strength: 0.30 },
    Uranus:  { speed: 0.015, tint: "#bfeee6", strength: 0.20 },
    Neptune: { speed: 0.050, tint: "#9fc0ff", strength: 0.34 },
  }
  const bandConf = BANDED[planet.raw.name]
  const isBanded = !!bandConf
  // Human-made orbiters for this body (Earth, Mars…), revealed by the HUD
  // "Satellites" toggle. Poll the module ref at low frequency so the shells
  // appear/disappear without prop-drilling.
  const satShells = SATELLITE_CATALOG[planet.raw.name]
  const [satsOn, setSatsOn] = useState(false)
  const cloudMatRef = useRef<ShaderMaterial | null>(null)
  const cloudUniforms = useMemo(
    () => ({
      uSunDir:   { value: new Vector3(1, 0, 0) },
      uOpacity:  { value: 0 },
      uTime:     { value: 0 },
      uCoverage: { value: 0.5 },
    }),
    [],
  )
  // Earth's polar aurora shell — night-side, high-latitude glow (deep-zoom).
  const auroraMatRef = useRef<ShaderMaterial | null>(null)
  const auroraUniforms = useMemo(
    () => ({
      uSunDir:  { value: new Vector3(1, 0, 0) },
      uOpacity: { value: 0 },
      uTime:    { value: 0 },
    }),
    [],
  )
  // Drifting band shell for Venus + the gas/ice giants.
  const bandsMatRef = useRef<ShaderMaterial | null>(null)
  const bandsUniforms = useMemo(
    () => ({
      uSunDir:    { value: new Vector3(1, 0, 0) },
      uTint:      { value: new Color(bandConf?.tint ?? "#ffffff") },
      uOpacity:   { value: 0 },
      uTime:      { value: 0 },
      uStrength:  { value: bandConf?.strength ?? 0.3 },
      // Great Red Spot — Jupiter only. A persistent anticyclone twice Earth's
      // width, in the South Equatorial Belt; the ochre-red is its real colour.
      uSpot:      { value: planet.raw.name === "Jupiter" ? 1 : 0 },
      uSpotColor: { value: new Color("#c56a3e") },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  // Atmospheric scattering shell uniforms — sun-aware Fresnel limb glow.
  const atmosShaderRef = useRef<ShaderMaterial | null>(null)
  const atmosUniforms = useMemo(
    () => ({
      uColor:   { value: new Color("#8ec5ff") },
      uSunDir:  { value: new Vector3(1, 0, 0) },
      uOpacity: { value: 0 },
      uPower:   { value: 3.0 },
    }),
    [],
  )

  // Date-driven mean anomaly. When the body has a real J2000 anchor
  // (m0Deg), its position is a pure function of the simulation date —
  // M(t) = M0 + 2π·(daysSinceJ2000 / period) — which is what makes the
  // timeline scrubber land every planet at its genuine real-world
  // position for any date. Bodies without an anchor fall back to the
  // legacy uniform accumulator so they still drift plausibly.
  const m0Rad = planet.raw.m0Deg != null ? planet.raw.m0Deg * DEG : null
  // Longitude-of-perihelion offset (radians) orients the apsidal line so
  // perihelion points the real direction for eccentric orbits.
  const periRad = planet.raw.periDeg != null ? planet.raw.periDeg * DEG : 0
  const meanAnomalyRef = useRef(planet.raw.startPhase)

  useEffect(() => {
    meanAnomalyRef.current = planet.raw.startPhase
    if (orbitRef.current && m0Rad == null) orbitRef.current.rotation.y = planet.raw.startPhase
  }, [planet.raw.startPhase, m0Rad])

  // rotHours in the data uses the signed convention (negative = retrograde),
  // but for planets like Venus (177°), Uranus (98°), and Pluto (123°) the
  // axial tilt > 90° ALSO encodes the retrograde flip. Using both at once
  // cancels back to prograde. When the tilt does the work, we use only the
  // magnitude of the spin so the visible rotation matches reality.
  const tiltEncodesRetrograde = Math.abs(planet.axialTilt) > Math.PI / 2
  const visibleRotSpeed = tiltEncodesRetrograde
    ? Math.abs(planet.rotSpeedRadPerSec)
    : planet.rotSpeedRadPerSec

  const eccentricity = planet.raw.deep?.eccentricity ?? 0
  const useEllipticalOrbit = eccentricity > 0.01

  useFrame((state, delta) => {
    const tw = timeWarpRef.current
    // Earth's spin is DATE-ANCHORED (GMST): its rotation is an absolute function
    // of the sim time, not a free-running increment, so the visible globe shows
    // true longitudes — required for a real ground track to land over the right
    // continents, and the point of a "time & date accurate" Earth. All other
    // bodies keep the incremental spin (their exact phase isn't the subject here).
    const earthAngle = isEarth ? earthRotationAngle(simTimeRef.current.simMs) : null
    if (meshRef.current) {
      if (earthAngle != null) meshRef.current.rotation.y = earthAngle
      else meshRef.current.rotation.y += delta * visibleRotSpeed * tw
    }

    // Mean anomaly for this frame. Anchored bodies derive it straight from
    // the simulation date (deterministic, scrubbable); legacy bodies keep
    // accumulating uniformly off their startPhase.
    let M: number
    if (m0Rad != null) {
      M = meanAnomalyAt(m0Rad, planet.raw.periodDays, simTimeRef.current.simMs)
    } else {
      meanAnomalyRef.current += delta * planet.orbitalSpeedRadPerSec * tw
      M = meanAnomalyRef.current
    }

    // Kepler's 2nd law in action: solve E - e·sin E = M for the eccentric
    // anomaly, convert to true anomaly, then set BOTH the orbit rotation
    // AND the radial distance from those values. Bodies on eccentric
    // orbits sweep equal areas in equal times — fast at perihelion,
    // slow at aphelion — matching the textbook Keplerian behaviour. The
    // periRad offset rotates the apsidal line so perihelion points the
    // real direction.
    // Live base orbit radius — recomputed from the ACTIVE scale mode each frame
    // (explore = sqrt-compressed; true = linear AU) and lerped, so flipping the
    // true-scale toggle smoothly spreads the planets to their real ratios instead
    // of snapping. Falls back to the static layout radius if aAU is absent.
    const baseR = planet.raw.aAU != null ? compressRadius(planet.raw.aAU) : planet.orbitRadius
    if (useEllipticalOrbit && positionRef.current && orbitRef.current) {
      const E = solveKepler(M, eccentricity)
      const trueAnom = eccentricToTrue(E, eccentricity)
      const r = (baseR * (1 - eccentricity * eccentricity)) /
                (1 + eccentricity * Math.cos(trueAnom))
      orbitRef.current.rotation.y = trueAnom + periRad
      const k = 1 - Math.exp(-delta * 3)
      positionRef.current.position.x += (r - positionRef.current.position.x) * k
    } else if (orbitRef.current) {
      // Circular orbit (or near-circular): true anomaly == mean anomaly.
      orbitRef.current.rotation.y = M + periRad
      if (positionRef.current) {
        const k = 1 - Math.exp(-delta * 3)
        positionRef.current.position.x += (baseR - positionRef.current.position.x) * k
      }
    }


    // Textured sphere rotates in lockstep with the grey one underneath so
    // surface features (Earth's continents, Jupiter's bands, Saturn's
    // stripes) drift naturally as time advances. The surface-pins group
    // also tracks the same spin so rover pins stay glued to their
    // landing coordinates as Mars rotates.
    if (surfaceRotRef.current) {
      if (earthAngle != null) surfaceRotRef.current.rotation.y = earthAngle
      else surfaceRotRef.current.rotation.y += delta * visibleRotSpeed * tw
    }
    if (texMeshRef.current) {
      if (earthAngle != null) texMeshRef.current.rotation.y = earthAngle
      else texMeshRef.current.rotation.y += delta * visibleRotSpeed * tw
    }
    // Band shell spins in lockstep with the texture so the drifting bands stay
    // glued to the globe's longitude.
    if (bandsMeshRef.current) {
      if (earthAngle != null) bandsMeshRef.current.rotation.y = earthAngle
      else bandsMeshRef.current.rotation.y += delta * visibleRotSpeed * tw
    }
    // Lerp the textured material's opacity to full as soon as the JPEG lands —
    // the photo-real globe is the default state now, not a hover reveal.
    if (texMatRef.current) {
      const k = 1 - Math.exp(-delta * 8)
      const target = texture ? 1 : 0
      texMatRef.current.opacity += (target - texMatRef.current.opacity) * k
    }
    // Day/night shader path (Earth only today) — update opacity + the sun
    // direction uniform each frame. Sun world position is fixed at the
    // solar system's origin offset; Earth's world position moves with the
    // orbit. dot(normal, sunDir) in the shader produces the terminator.
    if (useDayNightShader && texMeshRef.current) {
      const k = 1 - Math.exp(-delta * 8)
      // Show the surface as soon as the DAY texture is loaded — the night/city-
      // lights map fades in later via uHasNight. Waiting on BOTH left Earth a grey
      // ball on deep-zoom while 4 MB of 8K textures loaded (the live "this sucks"
      // bug). Airless day/night bodies (Mars, Mercury) never had a night map anyway.
      const target = texture ? 1 : 0
      dayNightUniforms.uOpacity.value += (target - dayNightUniforms.uOpacity.value) * k
      texMeshRef.current.getWorldPosition(_earthWorldPos)
      _sunWorldPos.set(SUN_OFFSET_SCENE, 0, 0)
      _sunDirTmp.copy(_sunWorldPos).sub(_earthWorldPos).normalize()
      dayNightUniforms.uSunDir.value.copy(_sunDirTmp)
    }
    // Poll the satellites toggle (only matters for bodies with orbiters).
    if (satShells) {
      const want = satellitesVisibleRef.current
      if (want !== satsOn) setSatsOn(want)
    }
    // Earth cloud shell — drift + sun direction + a fade that follows the
    // globe's reveal AND the cloud toggle (cloudsVisibleRef).
    if (isEarth && cloudMatRef.current) {
      cloudUniforms.uTime.value += delta * tw
      meshRef.current?.getWorldPosition(_earthWorldPos)
      _sunWorldPos.set(SUN_OFFSET_SCENE, 0, 0)
      cloudUniforms.uSunDir.value.copy(_sunDirTmp.copy(_sunWorldPos).sub(_earthWorldPos).normalize())
      const k = 1 - Math.exp(-delta * 6)
      const target = texture && cloudsVisibleRef.current ? 0.9 : 0
      cloudUniforms.uOpacity.value += (target - cloudUniforms.uOpacity.value) * k
    }
    // Earth's polar aurora shell — shimmers on the NIGHT side at high latitudes.
    // Fades in only on deep engagement (hover/focus) so it's a deep-zoom reward,
    // sharing the cloud toggle so "hide clouds" also hides the aurora.
    if (isEarth && auroraMatRef.current) {
      auroraUniforms.uTime.value += delta * tw
      meshRef.current?.getWorldPosition(_earthWorldPos)
      _sunWorldPos.set(SUN_OFFSET_SCENE, 0, 0)
      auroraUniforms.uSunDir.value.copy(_sunDirTmp.copy(_sunWorldPos).sub(_earthWorldPos).normalize())
      const k = 1 - Math.exp(-delta * 5)
      const target = detailActive && cloudsVisibleRef.current ? 1 : 0
      auroraUniforms.uOpacity.value += (target - auroraUniforms.uOpacity.value) * k
    }
    // Drifting atmosphere bands (Venus + gas/ice giants) — appear with the
    // textured globe, drift at the planet's own band speed, lit by the Sun.
    if (isBanded && bandsMatRef.current) {
      bandsUniforms.uTime.value += delta * tw * (bandConf?.speed ?? 0.03)
      meshRef.current?.getWorldPosition(_earthWorldPos)
      _sunWorldPos.set(SUN_OFFSET_SCENE, 0, 0)
      bandsUniforms.uSunDir.value.copy(_sunDirTmp.copy(_sunWorldPos).sub(_earthWorldPos).normalize())
      const k = 1 - Math.exp(-delta * 6)
      const target = texture ? 1 : 0
      bandsUniforms.uOpacity.value += (target - bandsUniforms.uOpacity.value) * k
    }
    // Rocky-planet atmospheric scattering shell — fades in on hover/focus.
    // Per-planet peak intensity matches real atmospheric depth (Venus dense,
    // Earth iconic-but-thinner, Mars almost transparent). The shader handles
    // the sun-aware limb glow; here we just drive opacity + the sun direction.
    if (atmosShaderRef.current) {
      const k = 1 - Math.exp(-delta * 8)
      const peakOpacity =
        planet.raw.name === "Venus" ? (invert ? 0.40 : 0.65) :
        planet.raw.name === "Earth" ? (invert ? 0.28 : 0.48) :
        planet.raw.name === "Mars"  ? (invert ? 0.14 : 0.24) :
        0.38
      // In the solar explorer, Earth keeps a baseline atmosphere rim (the thin
      // blue limb every real Earth-from-space shot has) — BUT it must fade out when
      // Earth is small on screen, or the rim glow overwhelms the tiny disc and Earth
      // reads as a fuzzy blob at the solar-overview zoom (Ankur's screenshot). Scale
      // the baseline by Earth's camera proximity: full when close, ~0 when far.
      let proximity = 1
      if (solarOnly && isEarth && meshRef.current) {
        meshRef.current.getWorldPosition(_earthWorldPos)
        const dist = state.camera.position.distanceTo(_earthWorldPos)
        // Earth visualRadius ~0.05: full glow within ~0.6 units, gone by ~2.5.
        proximity = Math.max(0, Math.min(1, (2.5 - dist) / (2.5 - 0.6)))
        // AUTO-DESCEND: when the camera drops right down to Earth's surface (the
        // static texture goes soft this close), signal the consumer to hand off to
        // the Google photoreal 3D-tiles Earth — the seamless satellites→planes→
        // cities→streets descent. Fire ONCE per approach (reset when you pull back).
        const DESCEND_DIST = 0.085          // ~just above the 0.05-radius surface
        if (dist < DESCEND_DIST) {
          if (!_earthDescendArmed) {
            _earthDescendArmed = true
            window.dispatchEvent(new CustomEvent("universe:earth-descend"))
          }
        } else if (dist > DESCEND_DIST * 1.6) {
          _earthDescendArmed = false        // re-arm after pulling back out
        }
      }
      const baseline = solarOnly && isEarth && !invert ? peakOpacity * 0.8 * proximity : 0
      const target = detailActive ? peakOpacity * Math.max(proximity, 0.35) : baseline
      atmosUniforms.uOpacity.value += (target - atmosUniforms.uOpacity.value) * k
      meshRef.current?.getWorldPosition(_earthWorldPos)
      _sunWorldPos.set(SUN_OFFSET_SCENE, 0, 0)
      atmosUniforms.uSunDir.value.copy(_sunDirTmp.copy(_sunWorldPos).sub(_earthWorldPos).normalize())
    }
  })

  const hitRadius = Math.max(planet.visualRadius * 2.2, 0.18)
  const childMoons = moons.filter((m) => m.parent === planet.raw.name)
  // Whichever planet's hovered or focused: its moons brighten + scale up.
  // Earth's Luna, Jupiter's Galilean four, Saturn's Titan, Neptune's Triton,
  // Pluto's Charon — all coordinated to the parent's interactive state.
  const moonsHighlighted = detailActive
  // Rocky planets with real atmospheres get a limb-glow halo on focus.
  // Colour matches each atmosphere's actual scattering — cyan-blue for
  // Earth, pale cream for Venus's sulfuric clouds, faint salmon for
  // Mars's thin CO₂ dust. Shell size scales with actual atmospheric
  // depth: Venus's dense deck bloats noticeably, Mars's barely halos.
  // Gas giants are skipped because the visible planet *is* its atmosphere.
  const atmosphereColor =
    planet.raw.name === "Earth" ? (invert ? "#3a5a7a" : "#7ec8ff") :
    planet.raw.name === "Venus" ? (invert ? "#5a4828" : "#fff0b8") :
    planet.raw.name === "Mars"  ? (invert ? "#4a2018" : "#ffa284") :
    null
  const hasAtmosphere = atmosphereColor !== null
  // Feed the per-planet atmosphere colour + a tighter Fresnel for thin
  // atmospheres into the scattering shader.
  useEffect(() => {
    if (atmosphereColor) atmosUniforms.uColor.value.set(atmosphereColor)
    atmosUniforms.uPower.value =
      planet.raw.name === "Mars" ? 4.0 :
      planet.raw.name === "Venus" ? 2.4 : 3.0
  }, [atmosphereColor, planet.raw.name, atmosUniforms])
  const atmosphereScale =
    planet.raw.name === "Venus" ? 1.060 :
    planet.raw.name === "Earth" ? 1.045 :
    planet.raw.name === "Mars"  ? 1.025 :
    1.045

  return (
    <group rotation={[planet.inclination, 0, 0]}>
      <group ref={orbitRef}>
        <group ref={positionRef} position={[planet.orbitRadius, 0, 0]}>
          <group rotation={[planet.axialTilt, 0, 0]}>
            <mesh ref={meshRef}>
              <sphereGeometry args={[planet.visualRadius, 48, 48]} />
              <meshStandardMaterial
                // Planet shades read fine on either theme — pale greys catch
                // both ink-and-cream and white-on-black light without changes.
                color={planet.raw.shade}
                roughness={0.95}
                metalness={0.0}
              />
            </mesh>

            {/* Textured-globe overlay — stacked on top of the grey sphere for
                any planet with a textureUrl. Higher segment count on Earth
                so deep-zoom inspection doesn't reveal facets. Opacity lerps
                in on hover OR focus.
                Earth takes the day/night shader path (lit + city-lights
                hemispheres separated by a smoothed terminator); everyone
                else uses the standard PBR sphere lit by the Sun point light. */}
            {hasTexture && useDayNightShader && texture && (
              <mesh ref={texMeshRef}>
                <sphereGeometry args={[planet.visualRadius * 1.005, (planet.raw.name === "Earth" || planet.raw.elevationUrl) ? 96 : 64, (planet.raw.name === "Earth" || planet.raw.elevationUrl) ? 96 : 64]} />
                <shaderMaterial
                  ref={dayNightMatRef as React.Ref<ShaderMaterial>}
                  vertexShader={DAY_NIGHT_VERTEX_SHADER}
                  fragmentShader={DAY_NIGHT_FRAGMENT_SHADER}
                  uniforms={dayNightUniforms}
                  transparent
                  depthWrite={false}
                />
              </mesh>
            )}
            {/* Earth's procedural cloud shell — sits just above the surface,
                lit by the Sun, animated + toggleable. No texture file. */}
            {isEarth && (
              <mesh>
                <sphereGeometry args={[planet.visualRadius * 1.02, 96, 96]} />
                <shaderMaterial
                  ref={cloudMatRef as React.Ref<ShaderMaterial>}
                  vertexShader={CLOUD_VERTEX_SHADER}
                  fragmentShader={CLOUD_FRAGMENT_SHADER}
                  uniforms={cloudUniforms}
                  transparent
                  depthWrite={false}
                />
              </mesh>
            )}
            {/* Earth's polar aurora — just above the clouds, additive, night-side
                + high-latitude only. A deep-zoom reward. */}
            {isEarth && (
              <mesh>
                <sphereGeometry args={[planet.visualRadius * 1.035, 96, 96]} />
                <shaderMaterial
                  ref={auroraMatRef as React.Ref<ShaderMaterial>}
                  vertexShader={AURORA_VERTEX_SHADER}
                  fragmentShader={AURORA_FRAGMENT_SHADER}
                  uniforms={auroraUniforms}
                  transparent
                  depthWrite={false}
                  blending={AdditiveBlending}
                />
              </mesh>
            )}

            {hasTexture && !useDayNightShader && texture && (
              <mesh ref={texMeshRef}>
                <sphereGeometry args={[
                  planet.visualRadius * 1.005,
                  64,
                  64,
                ]} />
                <meshStandardMaterial
                  ref={texMatRef as React.Ref<import("three").MeshStandardMaterial>}
                  map={texture}
                  roughness={0.85}
                  metalness={0.0}
                  transparent
                  opacity={0}
                  depthWrite={false}
                />
              </mesh>
            )}
            {/* Drifting atmosphere bands — Venus's haze + the gas/ice giants'
                zonal jets. A thin animated shell over the texture; the band
                motion lives in the shader (uTime longitude scroll). */}
            {isBanded && texture && (
              <mesh ref={bandsMeshRef}>
                <sphereGeometry args={[planet.visualRadius * 1.012, 64, 64]} />
                <shaderMaterial
                  ref={bandsMatRef as React.Ref<ShaderMaterial>}
                  vertexShader={BANDS_VERTEX_SHADER}
                  fragmentShader={BANDS_FRAGMENT_SHADER}
                  uniforms={bandsUniforms}
                  transparent
                  depthWrite={false}
                  blending={AdditiveBlending}
                />
              </mesh>
            )}

            {/* Surface landing-site pins — currently populated for Mars
                (rovers + landers). Rotates with the planet body so each
                pin stays glued to its real lat / lon as Mars spins.
                Renders only when the user is engaged with the planet
                (hover or focus), so far-out idle views don't clutter. */}
            {planet.raw.surfaceFeatures && detailActive && (
              <group ref={surfaceRotRef}>
                {planet.raw.surfaceFeatures.map((feature) => (
                  <RoverPin
                    key={feature.name}
                    feature={feature}
                    planetRadius={planet.visualRadius}
                    invert={invert}
                    interactive={interactive}
                    onHover={onHover}
                  />
                ))}
              </group>
            )}

            {/* Rocky-planet atmospheric scattering shell — Earth's cyan,
                Venus's pale yellow, Mars's faint salmon. A sun-aware Fresnel
                limb glow (brightest on the day-facing limb, with a faint
                terminator forward-scatter) instead of a flat halo, so it reads
                as real Rayleigh scattering seen from space. */}
            {hasAtmosphere && atmosphereColor && (
              <mesh>
                <sphereGeometry args={[planet.visualRadius * atmosphereScale, 64, 64]} />
                <shaderMaterial
                  ref={atmosShaderRef as React.Ref<ShaderMaterial>}
                  vertexShader={ATMOS_VERTEX_SHADER}
                  fragmentShader={ATMOS_FRAGMENT_SHADER}
                  uniforms={atmosUniforms}
                  transparent
                  blending={invert ? NormalBlending : AdditiveBlending}
                  depthWrite={false}
                  side={DoubleSide}
                />
              </mesh>
            )}

            <mesh
              onPointerOver={(e) => {
                e.stopPropagation()
                setIsHovered(true)
                onHover({ ...planetToInfo(planet.raw), followable: interactive })
              }}
              onPointerOut={() => {
                setIsHovered(false)
                onHover(null)
              }}
              // Click engages follow mode on the planet — the camera locks
              // onto its current world position and tracks as it orbits.
              // Same gesture as comets + spacecraft: a plain fly-to would
              // leave Mercury or Earth drifting out of frame seconds after
              // arrival. The focused flag stays set so the texture +
              // atmosphere bloom persist while we're tracking.
              onClick={
                interactive
                  ? (e) => {
                      e.stopPropagation()
                      setFocused(true)
                      window.dispatchEvent(
                        new CustomEvent("universe:sky-focus", {
                          detail: { pointId: `planet:${planet.raw.name}` },
                        }),
                      )
                      // Land close enough for a real surface read — Earth
                      // ends up at ~0.7 units (planet fills ~⅓ of the view),
                      // Jupiter at ~2.3 (banding readable), Saturn at ~3
                      // (rings frame). Users can scroll deeper to 0.2.
                      const followDistance = Math.max(
                        planet.visualRadius * (planet.raw.hasRings ? 5 : 3.5),
                        0.5,
                      )
                      // The getter captures e.object (the hit-mesh inside
                      // the orbit-rotated group) — its world position
                      // updates each frame as the planet orbits.
                      const obj = e.object
                      requestFollow(
                        () => {
                          const v = new Vector3()
                          obj.getWorldPosition(v)
                          return { x: v.x, y: v.y, z: v.z }
                        },
                        followDistance,
                        planet.raw.name,
                      )
                    }
                  : undefined
              }
              onDoubleClick={
                interactive
                  ? (e) => {
                      // Discoverability fallback — double-click runs the
                      // same follow as single click.
                      e.stopPropagation()
                      setFocused(true)
                      window.dispatchEvent(
                        new CustomEvent("universe:sky-focus", {
                          detail: { pointId: `planet:${planet.raw.name}` },
                        }),
                      )
                      const followDistance = Math.max(
                        planet.visualRadius * (planet.raw.hasRings ? 5 : 3.5),
                        0.5,
                      )
                      const obj = e.object
                      requestFollow(
                        () => {
                          const v = new Vector3()
                          obj.getWorldPosition(v)
                          return { x: v.x, y: v.y, z: v.z }
                        },
                        followDistance,
                        planet.raw.name,
                      )
                    }
                  : undefined
              }
            >
              <sphereGeometry args={[hitRadius, 24, 24]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
            {planet.raw.hasRings && (
              <SaturnRings
                planetRadius={planet.visualRadius}
                invert={invert}
                highlighted={isHovered}
              />
            )}
          </group>

          {/* Human-made satellite shells — orbit the planet centre (outside the
              axial-tilt group so they don't spin with the surface). Revealed by
              the HUD "Satellites" toggle. */}
          {satShells && satsOn && (
            <SatelliteShells
              shells={solarOnly && isEarth ? [] : satShells}
              heroCraft={HERO_CRAFT[planet.raw.name]}
              bodyRadius={planet.visualRadius}
              onHover={onHover}
              interactive={interactive}
              trueScale={solarOnly}
            />
          )}

          {/* Real ~15.7k-satellite catalogue (SGP4) — Earth only, in the
              solar-only explorer, when satellites are toggled on. */}
          {isEarth && solarOnly && satsOn && (
            <Suspense fallback={null}>
              <SatelliteField earthVisualRadius={planet.visualRadius} />
            </Suspense>
          )}

          {/* Real aircraft (baked OpenSky snapshot) — the "planes" layer of the
              descent. Only when satellites are on (same explore intent); they ride
              ~10 km up so they only separate from the surface at deep zoom. */}
          {isEarth && solarOnly && satsOn && (
            <Suspense fallback={null}>
              <FlightField earthVisualRadius={planet.visualRadius} />
            </Suspense>
          )}

          {/* Hover-label — small floating name above the planet, helping
              discoverability without forcing users to wait for the corner
              InfoPanel to update. Stays outside the axial-tilt group so
              the label points "up" in the orbit frame, not down through
              Venus's flipped pole. Hover only — mobile uses the bottom
              sheet (which already shows the name) so no double-up there. */}
          {isHovered && (
            // Fixed SMALL screen-size tag — no distanceFactor, which scaled the
            // label huge on close zoom (the giant "EARTH" pill filling the view).
            // A delicate dot + label, matching the satellite-tag style, not a boxy
            // pill covering the planet.
            <Html
              position={[0, Math.max(planet.visualRadius * 2.4, 0.28), 0]}
              center
              zIndexRange={[10, 0]}
              style={{ pointerEvents: "none" }}
            >
              <div
                className="flex items-center gap-1.5 whitespace-nowrap select-none pointer-events-none"
                style={{ animation: "ue-label-in 220ms ease-out both" }}
              >
                <span className={`h-1 w-1 rounded-full ${invert ? "bg-foreground/70" : "bg-white/80"}`} />
                <span className={`font-mono text-[10px] tracking-[0.25em] uppercase ${invert ? "text-foreground/80" : "text-white/85"} [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]`}>
                  {planet.raw.name}
                </span>
              </div>
            </Html>
          )}

          {childMoons.map((m) => (
            <MoonBody
              key={m.name}
              moon={m}
              onHover={onHover}
              highlighted={moonsHighlighted}
              interactive={interactive}
            />
          ))}
        </group>
      </group>
    </group>
  )
}
