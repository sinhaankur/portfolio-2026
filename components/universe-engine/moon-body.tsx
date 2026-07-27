"use client"

/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine — see ./index.tsx for the full notice.
 * https://github.com/sinhaankur/portfolio-2026/blob/main/LICENSE
 *
 * moon-body — the moon sub-engine: ONE natural satellite renderer.
 *
 * Renders a single moon orbiting its parent planet: a shaded body that, for
 * moons shipping a real surface texture (just Luna today), overlays a day/night
 * shader so the lit hemisphere tracks the Sun — real lunar PHASES fall out of
 * the geometry, no per-phase keyframes. Luna also carries real LOLA terrain
 * relief (displacement) and Apollo/Luna/Chang'e landing-site pins (RoverPin),
 * and shows its human-made orbiter shell (SatelliteShells) when the Satellites
 * toggle is on.
 *
 * Motion is date-driven: orbital longitude = a deterministic phase offset (from
 * the moon's name — stable across timeline scrubs, not a true J2000 anchor) on
 * top of `meanAnomalyAt`. Hover routes to the InfoPanel; click follows the moon.
 *
 * Composed by <SolarSystem> in scene.tsx. Shared pieces (surface pins, orbiter
 * shells) come from ./scene-satellites; the day/night shader from ./shaders; the
 * per-frame scratch vectors from ./scene-shared.
 */

import { useRef, useMemo, useState, useEffect } from "react"
import { useFrame } from "@react-three/fiber"
import {
  AdditiveBlending,
  Color,
  Group,
  Mesh,
  ShaderMaterial,
  SRGBColorSpace,
  TextureLoader,
  Vector2,
  Vector3,
  type Texture,
} from "three"
import {
  DEG,
  SUN_OFFSET_SCENE,
  meanAnomalyAt,
  requestFollow,
  focusDepthRef,
  simTimeRef,
  satellitesVisibleRef,
  surfaceTextureUrl,
  hiResTexturesRef,
  deviceTierRef,
} from "./astronomy"
import { superClearRef } from "@/lib/device-tier"
import type { HoverHandler, MoonData } from "./types"
import { DAY_NIGHT_VERTEX_SHADER, DAY_NIGHT_FRAGMENT_SHADER } from "./shaders"
import { RoverPin, SatelliteShells, HERO_CRAFT } from "./scene-satellites"
import { _earthWorldPos, _sunWorldPos, _sunDirTmp, loadTextureAsync } from "./scene-shared"

export function MoonBody({
  moon,
  onHover,
  highlighted = false,
  interactive = false,
  invert = false,
}: {
  moon: MoonData
  onHover: HoverHandler
  /** Set by the parent planet's hover state — gives the moon a coordinated scale-up + halo. */
  highlighted?: boolean
  /** When true, clicks engage follow mode on the moon. Same gesture as planets + comets. */
  interactive?: boolean
  invert?: boolean
}) {
  const orbitRef = useRef<Group>(null)
  const bodyRef = useRef<Mesh>(null)
  const haloRef = useRef<Mesh>(null)
  // The Moon has real human-made orbiters (LRO, etc.). When the Satellites
  // toggle is on, show a small shell scaled to the Moon's surface.
  const isLuna = moon.name.startsWith("Moon")
  const [moonSatsOn, setMoonSatsOn] = useState(false)
  const haloMatRef = useRef<import("three").MeshBasicMaterial>(null)
  /** Mesh ref on the textured moon surface — needed to read world position
   *  for the day/night shader's sun-direction uniform. */
  const texMeshRef = useRef<Mesh>(null)
  /** Day/night shader for tidally-locked moons with a real surface texture
   *  (just Luna today). Drives the lunar-phase visual: as the moon orbits
   *  the planet, the lit hemisphere rotates relative to it = phases. */
  const dayNightMatRef = useRef<ShaderMaterial>(null)
  const [texture, setTexture] = useState<Texture | null>(null)
  const [elevationTexture, setElevationTexture] = useState<Texture | null>(null)
  const dayNightUniforms = useMemo(
    () => ({
      tDay:                 { value: null as Texture | null },
      tNight:               { value: null as Texture | null },
      uSunDir:              { value: new Vector3(1, 0, 0) },
      uOpacity:             { value: 0 },
      uNightStrength:       { value: 0 },
      uHasNight:            { value: 0 },     // airless body
      uTerminatorSoftness:  { value: 0.04 },  // razor-sharp lunar terminator
      uPolarFix:            { value: 0 },     // moons don't need the polar-smear fix
      uPolarTint:           { value: new Color("#ffffff") },
      // Real terrain relief (e.g. lunar LOLA) — off until a height map loads.
      tElevation:           { value: null as Texture | null },
      uElevation:           { value: 0 },
      // Per-pixel relief (bump/normal mapping) from the SAME LOLA height map —
      // lights every crater rim at pixel resolution so lunar depth reads
      // dramatically at any sun angle, not just the gentle vertex displacement.
      uNormalStrength:      { value: 0 },
      uElevationTexel:      { value: new Vector2(1 / 4096, 1 / 2048) },
    }),
    [],
  )
  useEffect(() => {
    if (texture) dayNightUniforms.tDay.value = texture
    if (elevationTexture) {
      dayNightUniforms.tElevation.value = elevationTexture
      // Super Clear exaggerates lunar relief ~2.2× (real LOLA), paired with the
      // denser mesh below, so craters read as genuine 3D on deep zoom.
      dayNightUniforms.uElevation.value =
        (moon.elevationScale ?? 0.03) * moon.visualRadius * (superClearRef.current ? 2.2 : 1)
      // Per-pixel relief: light every crater from the real LOLA gradient.
      const img = elevationTexture.image as { width?: number; height?: number } | undefined
      const w = img?.width ?? 4096
      const h = img?.height ?? 2048
      dayNightUniforms.uElevationTexel.value.set(1 / w, 1 / h)
      // uNormalStrength driven per-frame (distance + highlight aware) in useFrame.
    } else {
      dayNightUniforms.uNormalStrength.value = 0
    }
  }, [texture, elevationTexture, dayNightUniforms, moon.elevationScale, moon.visualRadius])

  // Optional elevation/height map for real terrain relief (Luna → LOLA). Loaded
  // after the surface texture; linear (raw height data, not sRGB). Gated on
  // hiResTexturesRef like the 4K maps — relief is a deep-zoom nicety, so only
  // the /lab/celestial explorer pays the download (see planet-body.tsx).
  const elevationUrl = moon.elevationUrl
  useEffect(() => {
    if (!elevationUrl || elevationTexture) return
    const timer = setTimeout(() => {
      // Load the relief on the deep-zoom explorer OR in Super Clear (the user
      // opted into max fidelity), desktop only.
      if ((!hiResTexturesRef.current && !superClearRef.current) || deviceTierRef.current !== "desktop") return
      new TextureLoader().load(elevationUrl, (tex) => {
        tex.anisotropy = 4
        setElevationTexture(tex)
      })
    }, 500)
    return () => clearTimeout(timer)
  }, [elevationUrl, elevationTexture])

  // Stable phase offset per moon (radians). Derived deterministically from
  // the moon's name rather than Math.random() so scrubbing the timeline
  // lands the moon at the same place every time you revisit a date — a
  // random phase would jump on every remount. We don't have per-moon J2000
  // ephemerides, so this is a fixed offset on top of date-driven motion,
  // not a true anchor: the period is real, the absolute longitude is not.
  const startPhase = useMemo(() => {
    let h = 0
    for (let i = 0; i < moon.name.length; i++) h = (h * 31 + moon.name.charCodeAt(i)) >>> 0
    return (h % 360) * DEG
  }, [moon.name])

  // Eagerly load the moon's surface texture on mount — same always-visible
  // treatment as the planets. Luna is the only moon shipping a texture today
  // (~550 KB WebP), and TextureLoader is async so first paint still lands fast.
  const textureUrl = surfaceTextureUrl(moon)  // KTX2/4K on desktop, 2K on mobile
  useEffect(() => {
    if (!textureUrl || texture) return
    // loadTextureAsync: off-thread decode for WebP, and routes .ktx2 through the
    // Basis transcoder (Luna's 4K → mars-style GPU-compressed). Falls back to the
    // shipped WebP if the ktx2 can't load.
    loadTextureAsync(
      textureUrl,
      (tex) => { tex.anisotropy = 8; setTexture(tex) },
      () => {
        // KTX2 miss → try the plain hi-res/base WebP so the moon still textures.
        const fallback = moon.hiResTextureUrl ?? moon.textureUrl
        if (!fallback || fallback === textureUrl) return
        loadTextureAsync(fallback, (tex) => { tex.anisotropy = 8; setTexture(tex) })
      },
    )
  }, [textureUrl, texture, moon.hiResTextureUrl, moon.textureUrl])

  // Make the moon addressable on the sky-focus channel (moon:<name>), so the
  // "Jump to" menu + assistant can FLY here — the "travel anywhere in a pinch"
  // goal. Mirrors the click handler: follow the live world position so it stays
  // framed as it orbits its planet (which is itself orbiting the Sun).
  useEffect(() => {
    if (!interactive) return
    const onFocus = (e: Event) => {
      const id = (e as CustomEvent<{ pointId?: string | null }>).detail?.pointId
      if (id !== `moon:${moon.name}`) return
      const obj = bodyRef.current
      if (!obj) return
      focusDepthRef.current = {
        near: Math.max(moon.visualRadius * 0.02, 0.002),
        minDistance: moon.visualRadius * 1.05,
      }
      requestFollow(
        () => {
          const v = new Vector3()
          obj.getWorldPosition(v)
          return { x: v.x, y: v.y, z: v.z }
        },
        Math.max(moon.visualRadius * 3.2, 0.09),
        moon.name,
      )
    }
    window.addEventListener("universe:sky-focus", onFocus)
    return () => window.removeEventListener("universe:sky-focus", onFocus)
  }, [interactive, moon.name, moon.visualRadius])

  useFrame((state, delta) => {
    // Date-driven so moons stay in lockstep with the scrubbable clock.
    if (orbitRef.current) {
      orbitRef.current.rotation.y = meanAnomalyAt(startPhase, moon.periodDays, simTimeRef.current.simMs)
    }
    // Poll the satellites toggle for the Moon's orbiter shell.
    if (isLuna) {
      const want = satellitesVisibleRef.current
      if (want !== moonSatsOn) setMoonSatsOn(want)
    }

    // Lerp the moon's visual emphasis when the parent planet is hovered.
    const k = 1 - Math.exp(-delta * 10)
    const scaleTarget = highlighted ? 1.6 : 1.0
    if (bodyRef.current) {
      const s = bodyRef.current.scale.x
      const next = s + (scaleTarget - s) * k
      bodyRef.current.scale.set(next, next, next)
    }
    if (haloRef.current) {
      // Halo size tuned tight (1.5×) so the moon is findable from far
      // away without the halo punching through the parent planet's
      // atmosphere on close zoom. Pre-tuning was 2.6× and blew out
      // Earth's atmosphere halo whenever Earth + Moon shared screen.
      const haloTarget = highlighted ? 1.5 : 0.001
      const s = haloRef.current.scale.x
      const next = s + (haloTarget - s) * k
      haloRef.current.scale.set(next, next, next)
    }
    if (haloMatRef.current) {
      // Halo opacity dropped from 0.35 → 0.18 for the same reason — the
      // additive blend at 0.35 dominated whatever was behind it.
      const opacityTarget = highlighted ? 0.18 : 0
      haloMatRef.current.opacity += (opacityTarget - haloMatRef.current.opacity) * k
    }
    // Day/night path (Luna) — lerp opacity AND update sun direction so
    // the moon's lit hemisphere shifts with its orbital phase. Real
    // lunar phases come out of this without any per-phase keyframes.
    // (The old meshStandardMaterial-based texture overlay was replaced
    // when the shader took over — no parallel opacity lerp needed.)
    if (texMeshRef.current && textureUrl) {
      const target = texture ? 1 : 0
      dayNightUniforms.uOpacity.value += (target - dayNightUniforms.uOpacity.value) * k
      texMeshRef.current.getWorldPosition(_earthWorldPos)
      _sunWorldPos.set(SUN_OFFSET_SCENE, 0, 0)
      _sunDirTmp.copy(_sunWorldPos).sub(_earthWorldPos).normalize()
      dayNightUniforms.uSunDir.value.copy(_sunDirTmp)
      // Per-pixel lunar relief is a deep-zoom reward — fade uNormalStrength in
      // only when the camera is close + the moon is highlighted, so the 4 extra
      // texture fetches + derivatives cost nothing at normal distance (the fix
      // for the relief-change lag).
      if (elevationTexture) {
        const camDist = state.camera.position.distanceTo(_earthWorldPos)
        const rad = moon.visualRadius
        const closeness = Math.max(0, Math.min(1, (14 * rad - camDist) / (10 * rad)))
        const peak = superClearRef.current ? 6.0 : 3.0
        const want = highlighted ? peak * closeness : 0
        dayNightUniforms.uNormalStrength.value += (want - dayNightUniforms.uNormalStrength.value) * k
      }
    }
  })

  const hitRadius = Math.max(moon.visualRadius * 3, 0.12)

  return (
    <group ref={orbitRef}>
      {/* Halo — only visible when the parent planet is being hovered. */}
      <mesh ref={haloRef} position={[moon.orbitRadius, 0, 0]} scale={0.001}>
        <sphereGeometry args={[moon.visualRadius, 16, 16]} />
        <meshBasicMaterial
          ref={haloMatRef as React.Ref<import("three").MeshBasicMaterial>}
          color="#fff2b8"
          transparent
          opacity={0}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={bodyRef} position={[moon.orbitRadius, 0, 0]}>
        {/* 64 segments (was 24): at close zoom the low-poly base read as a faceted
            white BALL before/without the texture — the "ISS looks wrong" ball was
            actually the Moon rendering low-poly. Smooth now at any zoom. */}
        <sphereGeometry args={[moon.visualRadius, 64, 64]} />
        <meshStandardMaterial color={moon.shade} roughness={0.95} />
        {/* Textured-globe overlay — currently only Luna ships a real surface
            map. Uses the day/night shader so the moon shows real lunar
            phases as it orbits its parent (the lit hemisphere rotates
            relative to the Sun's fixed position). Razor-sharp terminator
            because the Moon has no atmosphere. */}
        {textureUrl && texture && (
          <mesh ref={texMeshRef}>
            {/* Super Clear pushes the displaced mesh to 384 segments so the LOLA
                relief resolves as real 3D crater terrain on deep zoom. */}
            <sphereGeometry args={[
              moon.visualRadius * 1.01,
              moon.elevationUrl ? (superClearRef.current ? 384 : 128) : 48,
              moon.elevationUrl ? (superClearRef.current ? 384 : 128) : 48,
            ]} />
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
        {/* Surface landing-site pins — Apollo 11-17, Luna 9, Chang'e 4
            on the Moon. Uses the same RoverPin component as Mars; pins
            are children of bodyRef so they ride with the tidally-locked
            face that the Moon's body presents to its parent planet. */}
        {moon.surfaceFeatures && highlighted && moon.surfaceFeatures.map((feature) => (
          <RoverPin
            key={feature.name}
            feature={feature}
            planetRadius={moon.visualRadius}
            invert={invert}
            interactive={interactive}
            onHover={onHover}
          />
        ))}
      </mesh>

      {/* Lunar orbiter shell — LRO, Chang'e relays, Lunar Gateway-era craft.
          Real altitudes hug the surface (LRO ~50 km over a 1,737 km Moon →
          ~1.03 R), so the shell sits tight to the body. Shown when Satellites
          is toggled on. */}
      {isLuna && moonSatsOn && (
        <group position={[moon.orbitRadius, 0, 0]}>
          <SatelliteShells
            shells={[
              { label: "Low lunar orbit (LRO …)", launchMs: Date.UTC(2009, 5, 18), altRatio: 1.05, count: 40, color: "#dfe8ff", incl: 1.4, speed: 0.22 },
              { label: "Lunar relay / frozen orbit", launchMs: Date.UTC(1966, 7, 10), altRatio: 1.35, count: 14, color: "#ffd9a0", incl: 1.1, speed: 0.12 },
            ]}
            heroCraft={HERO_CRAFT["Moon (Luna)"]}
            bodyRadius={moon.visualRadius}
          />
        </group>
      )}

      <mesh
        position={[moon.orbitRadius, 0, 0]}
        onPointerOver={(e) => {
          e.stopPropagation()
          onHover({
            name: moon.name,
            classification: `Moon of ${moon.parent}`,
            periodDays: moon.periodDays,
            fact: moon.fact,
            deep: moon.deep,
            followable: interactive,
          })
        }}
        onPointerOut={() => {
          onHover(null)
        }}
        // Click engages follow on the moon — same gesture pattern as
        // planets, comets, and spacecraft. The getter reads the moon
        // body's live world position each frame so the camera stays
        // glued to it as it orbits the parent planet (which is itself
        // orbiting the Sun). Distance scales with the moon's visual
        // radius so Phobos at 0.025 and Titan at 0.08 both frame
        // sensibly. The hit-mesh `e.object` is positioned inside the
        // orbit-rotated group, so its world position is always current.
        onClick={
          interactive
            ? (e) => {
                e.stopPropagation()
                const followDistance = Math.max(moon.visualRadius * 3.2, 0.09)
                const obj = e.object
                // Let the camera dolly to the moon's surface (same as planets).
                focusDepthRef.current = {
                  near: Math.max(moon.visualRadius * 0.02, 0.002),
                  minDistance: moon.visualRadius * 1.05,
                }
                requestFollow(
                  () => {
                    const v = new Vector3()
                    obj.getWorldPosition(v)
                    return { x: v.x, y: v.y, z: v.z }
                  },
                  followDistance,
                  moon.name,
                )
              }
            : undefined
        }
        onDoubleClick={
          interactive
            ? (e) => {
                e.stopPropagation()
                const followDistance = Math.max(moon.visualRadius * 3.2, 0.09)
                const obj = e.object
                // Let the camera dolly to the moon's surface (same as planets).
                focusDepthRef.current = {
                  near: Math.max(moon.visualRadius * 0.02, 0.002),
                  minDistance: moon.visualRadius * 1.05,
                }
                requestFollow(
                  () => {
                    const v = new Vector3()
                    obj.getWorldPosition(v)
                    return { x: v.x, y: v.y, z: v.z }
                  },
                  followDistance,
                  moon.name,
                )
              }
            : undefined
        }
      >
        <sphereGeometry args={[hitRadius, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}
