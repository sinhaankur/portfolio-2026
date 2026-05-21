"use client"

/**
 * Universe Engine — R3F scene graph.
 *
 * Every rendered body lives here. Public composition is <SceneContents />,
 * which the <UniverseEngine /> in ./index.tsx mounts inside its <Canvas>.
 *
 * Bodies follow real astronomical positioning: the Milky Way disc is tilted
 * 60.2° from the ecliptic, the Sun sits on the Orion Arm ~26,670 ly from the
 * galactic centre, and constellations project from RA/Dec onto a sky-shell
 * around the Sun (not the galactic centre).
 */

import { useRef, useMemo, useEffect, useState } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { Html, Stars } from "@react-three/drei"
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  FogExp2,
  Group,
  Mesh,
  NormalBlending,
  Points,
  ShaderMaterial,
  SRGBColorSpace,
  TextureLoader,
  type Texture,
} from "three"

import {
  ASTEROID_BELT_INFO,
  DEG,
  GALACTIC_PLANE_TILT_RAD,
  KUIPER_BELT_INFO,
  MILKY_WAY_INFO,
  SGR_A_INFO,
  SKY_SHELL_DISTANCE,
  SOLAR_SYSTEM_POSITION,
  SUN_INFO,
  SUN_OFFSET_SCENE,
  TIME_WARP_DAYS_PER_SEC,
  buildScenePlanets,
  constellations,
  gauss,
  magToVisualRadius,
  moons,
  namedBodies,
  planetToInfo,
  raDecToScenePos,
  timeWarpRef,
} from "./astronomy"
import { GALAXY_FRAGMENT_SHADER, GALAXY_VERTEX_SHADER } from "./shaders"
import type {
  Constellation,
  ConstellationId,
  ConstellationStar,
  HoverHandler,
  MoonData,
  NamedBody,
  ScenePlanet,
} from "./types"

/* ============================================================
 * Milky Way backdrop — 4 spiral arms + bulge, with hover hit-zones
 * for Sgr A* (galactic centre) and the galaxy itself.
 * ============================================================ */

function MilkyWay({
  onHover,
  mobile = false,
  invert = false,
}: {
  onHover: HoverHandler
  mobile?: boolean
  invert?: boolean
}) {
  const pointsRef = useRef<Points>(null)
  const matRef = useRef<ShaderMaterial>(null)
  const { gl } = useThree()

  const geometry = useMemo(() => {
    // Halved counts on mobile to keep the GPU breathing.
    const armCount = mobile ? 6000 : 14000
    const bulgeCount = mobile ? 1800 : 4000
    const total = armCount + bulgeCount
    const positions = new Float32Array(total * 3)
    const sizes = new Float32Array(total)
    const alphas = new Float32Array(total)

    const radius = 130
    const branches = 4
    const spin = 1.3

    for (let i = 0; i < armCount; i++) {
      const i3 = i * 3
      const r = Math.pow(Math.random(), 1.6) * radius
      const branchAngle = ((i % branches) / branches) * Math.PI * 2
      const spinAngle = r * spin * 0.04

      const randomness = 0.28
      const rx = Math.pow(Math.random(), 2.6) * (Math.random() < 0.5 ? 1 : -1) * randomness * r
      const ry = Math.pow(Math.random(), 2.6) * (Math.random() < 0.5 ? 1 : -1) * randomness * r * 0.12
      const rz = Math.pow(Math.random(), 2.6) * (Math.random() < 0.5 ? 1 : -1) * randomness * r

      positions[i3]     = Math.cos(branchAngle + spinAngle) * r + rx
      positions[i3 + 1] = ry
      positions[i3 + 2] = Math.sin(branchAngle + spinAngle) * r + rz

      const sizeRoll = Math.pow(Math.random(), 3.5)
      sizes[i] = 1.0 + sizeRoll * 5
      const normR = r / radius
      alphas[i] = (0.08 + (1 - normR) * 0.25) * (0.5 + Math.random() * 0.5)
    }

    for (let i = 0; i < bulgeCount; i++) {
      const idx = armCount + i
      const i3 = idx * 3
      const r = Math.abs(gauss()) * radius * 0.18
      const theta = Math.random() * Math.PI * 2
      const phi = (Math.random() - 0.5) * 0.55

      positions[i3]     = r * Math.cos(theta) * Math.cos(phi)
      positions[i3 + 1] = r * Math.sin(phi) * 0.6
      positions[i3 + 2] = r * Math.sin(theta) * Math.cos(phi)

      const sizeRoll = Math.pow(Math.random(), 3)
      sizes[idx] = 2 + sizeRoll * 8
      alphas[idx] = 0.3 + Math.random() * 0.2
    }

    const geo = new BufferGeometry()
    geo.setAttribute("position", new BufferAttribute(positions, 3))
    geo.setAttribute("aSize", new BufferAttribute(sizes, 1))
    geo.setAttribute("aAlpha", new BufferAttribute(alphas, 1))
    return geo
  }, [mobile])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(gl.getPixelRatio(), 2) },
      uStarColor: { value: new Color(invert ? "#0a0a0a" : "#ffffff") },
    }),
    [gl, invert],
  )

  useFrame((_, delta) => {
    if (pointsRef.current) pointsRef.current.rotation.y += delta * 0.008
    if (matRef.current) {
      ;(matRef.current.uniforms.uTime as { value: number }).value += delta
    }
  })

  return (
    <group>
      <points ref={pointsRef} geometry={geometry}>
        <shaderMaterial
          ref={matRef}
          vertexShader={GALAXY_VERTEX_SHADER}
          fragmentShader={GALAXY_FRAGMENT_SHADER}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          // Additive looks right against ink; on cream paper additive blending
          // bleaches stars to invisible — fall back to NormalBlending then.
          blending={invert ? NormalBlending : AdditiveBlending}
        />
      </points>

      {/* Sgr A* hit-target (invisible) */}
      <mesh
        position={[0, 0, 0]}
        onPointerOver={(e) => {
          e.stopPropagation()
          onHover(SGR_A_INFO)
        }}
        onPointerOut={() => {
          onHover(null)
        }}
      >
        <sphereGeometry args={[6, 24, 24]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Wider Milky Way bulge hit-zone */}
      <mesh
        position={[0, 0, 0]}
        onPointerOver={(e) => {
          e.stopPropagation()
          onHover(MILKY_WAY_INFO)
        }}
        onPointerOut={() => {
          onHover(null)
        }}
      >
        <sphereGeometry args={[35, 24, 24]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

/* ============================================================
 * Moons — orbit their parent planet's equatorial plane.
 * ============================================================ */

function MoonBody({
  moon,
  onHover,
  highlighted = false,
}: {
  moon: MoonData
  onHover: HoverHandler
  /** Set by the parent planet's hover state — gives the moon a coordinated scale-up + halo. */
  highlighted?: boolean
}) {
  const orbitRef = useRef<Group>(null)
  const bodyRef = useRef<Mesh>(null)
  const haloRef = useRef<Mesh>(null)
  const haloMatRef = useRef<import("three").MeshBasicMaterial>(null)

  const speedRadPerSec = useMemo(
    () => (2 * Math.PI) / (moon.periodDays / TIME_WARP_DAYS_PER_SEC),
    [moon.periodDays],
  )
  const startPhase = useMemo(() => Math.random() * Math.PI * 2, [])

  useEffect(() => {
    if (orbitRef.current) orbitRef.current.rotation.y = startPhase
  }, [startPhase])

  useFrame((_, delta) => {
    if (orbitRef.current) orbitRef.current.rotation.y += delta * speedRadPerSec * timeWarpRef.current

    // Lerp the moon's visual emphasis when the parent planet is hovered.
    const k = 1 - Math.exp(-delta * 10)
    const scaleTarget = highlighted ? 1.6 : 1.0
    if (bodyRef.current) {
      const s = bodyRef.current.scale.x
      const next = s + (scaleTarget - s) * k
      bodyRef.current.scale.set(next, next, next)
    }
    if (haloRef.current) {
      const haloTarget = highlighted ? 2.6 : 0.001
      const s = haloRef.current.scale.x
      const next = s + (haloTarget - s) * k
      haloRef.current.scale.set(next, next, next)
    }
    if (haloMatRef.current) {
      const opacityTarget = highlighted ? 0.35 : 0
      haloMatRef.current.opacity += (opacityTarget - haloMatRef.current.opacity) * k
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
        <sphereGeometry args={[moon.visualRadius, 24, 24]} />
        <meshStandardMaterial color={moon.shade} roughness={0.95} />
      </mesh>
      <mesh
        position={[moon.orbitRadius, 0, 0]}
        onPointerOver={(e) => {
          e.stopPropagation()
          onHover({
            name: moon.name,
            classification: `Moon of ${moon.parent}`,
            periodDays: moon.periodDays,
            fact: moon.fact,
          })
        }}
        onPointerOut={() => {
          onHover(null)
        }}
      >
        <sphereGeometry args={[hitRadius, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

/* ============================================================
 * Constellations
 *
 * The catalog (Big Dipper, Polaris, Orion, Cassiopeia, Leo, Lyra, Cygnus)
 * lives in astronomy.ts. Each constellation carries member stars + an edges
 * list that names which pairs the asterism line connects.
 *
 * Hover behavior: pointing at ANY star or asterism segment activates the
 * whole constellation. Active state lerps every frame:
 *   - member stars scale up and grow a warm halo
 *   - asterism lines brighten + warm to a constellation accent
 *
 * Polaris is a single-star "constellation" with `clickAction: 'reset-view'`,
 * so clicking it resets the camera to its initial framing.
 * ============================================================ */

type LineMatRef = import("three").LineBasicMaterial

function AsterismLine({
  stars,
  edges,
  active,
  invert = false,
}: {
  stars: ConstellationStar[]
  edges: [number, number][]
  active: boolean
  invert?: boolean
}) {
  const matRef = useRef<LineMatRef>(null)
  // Chart-mode (light theme): ink hairlines that flush warmer amber on hover,
  // mimicking how a vintage map annotates traced constellations in red-orange.
  const colorTarget = useMemo(() => new Color(invert ? "#0a0a0a" : "#ffffff"), [invert])
  const colorActive = useMemo(() => new Color(invert ? "#b34a13" : "#ffd66b"), [invert])
  // Idle opacity is higher in chart mode — dark ink on cream needs to read
  // without the additive bloom that helps it pop against deep space.
  const idleOpacity = invert ? 0.45 : 0.18
  const activeOpacity = invert ? 0.95 : 0.9

  const geometry = useMemo(() => {
    if (edges.length === 0) {
      const geo = new BufferGeometry()
      geo.setAttribute("position", new BufferAttribute(new Float32Array(0), 3))
      return geo
    }
    const arr = new Float32Array(edges.length * 2 * 3)
    edges.forEach(([a, b], i) => {
      const pa = raDecToScenePos(stars[a].raHours, stars[a].decDeg, SKY_SHELL_DISTANCE)
      const pb = raDecToScenePos(stars[b].raHours, stars[b].decDeg, SKY_SHELL_DISTANCE)
      arr[i * 6]     = pa[0]
      arr[i * 6 + 1] = pa[1]
      arr[i * 6 + 2] = pa[2]
      arr[i * 6 + 3] = pb[0]
      arr[i * 6 + 4] = pb[1]
      arr[i * 6 + 5] = pb[2]
    })
    const geo = new BufferGeometry()
    geo.setAttribute("position", new BufferAttribute(arr, 3))
    return geo
  }, [stars, edges])

  // Lerp opacity + color toward target each frame for a smooth highlight.
  useFrame((_, delta) => {
    if (!matRef.current) return
    const targetOpacity = active ? activeOpacity : idleOpacity
    const k = 1 - Math.exp(-delta * 8)
    matRef.current.opacity += (targetOpacity - matRef.current.opacity) * k
    matRef.current.color.lerp(active ? colorActive : colorTarget, k)
  })

  if (edges.length === 0) return null

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial
        ref={matRef as React.Ref<LineMatRef>}
        color={invert ? "#0a0a0a" : "#ffffff"}
        transparent
        opacity={idleOpacity}
        depthWrite={false}
      />
    </lineSegments>
  )
}

function ConstellationStarMesh({
  star,
  active,
  isClickable,
  isPolaris,
  invert = false,
  onActivate,
  onDeactivate,
  onClick,
  onHover,
  constellationName,
  constellationFact,
}: {
  star: ConstellationStar
  active: boolean
  isClickable: boolean
  isPolaris: boolean
  invert?: boolean
  onActivate: () => void
  onDeactivate: () => void
  onClick?: () => void
  onHover: HoverHandler
  constellationName: string
  constellationFact: string
}) {
  const meshRef = useRef<Mesh>(null)
  const haloRef = useRef<Mesh>(null)
  const haloMatRef = useRef<import("three").MeshBasicMaterial>(null)
  const dotMatRef = useRef<import("three").MeshBasicMaterial>(null)

  const position = useMemo(
    () => raDecToScenePos(star.raHours, star.decDeg, SKY_SHELL_DISTANCE),
    [star.raHours, star.decDeg],
  )
  const baseRadius = magToVisualRadius(star.magnitude) * (isPolaris ? 1.4 : 1.0)
  // Chart-mode colours: ink dots on cream with a warm amber halo on hover.
  const dotColor = invert ? "#0a0a0a" : "#ffffff"
  const haloColorIdle = useMemo(
    () => new Color(invert ? "#1a1006" : "#ffffff"),
    [invert],
  )
  const haloColorActive = useMemo(
    () => new Color(invert ? "#b34a13" : "#fff2b8"),
    [invert],
  )
  // Idle halo opacity needs to be lower on cream (we don't have additive bloom)
  // or the warm tint becomes a muddy smear behind every star.
  const haloOpacityIdle = invert ? 0.08 : 0.18
  const haloOpacityActive = invert ? 0.55 : 0.6

  // Animated scale + halo brightness — lerp each frame so the highlight
  // doesn't snap. Same target reached from any direction.
  useFrame((_, delta) => {
    const k = 1 - Math.exp(-delta * 10)
    const targetScale = active ? 1.6 : 1.0
    if (meshRef.current) {
      const s = meshRef.current.scale.x
      const next = s + (targetScale - s) * k
      meshRef.current.scale.set(next, next, next)
    }
    if (haloRef.current) {
      const haloTarget = active ? 3.2 : 2.2
      const s = haloRef.current.scale.x
      const next = s + (haloTarget - s) * k
      haloRef.current.scale.set(next, next, next)
    }
    if (haloMatRef.current) {
      const opacityTarget = active ? haloOpacityActive : haloOpacityIdle
      haloMatRef.current.opacity += (opacityTarget - haloMatRef.current.opacity) * k
      haloMatRef.current.color.lerp(active ? haloColorActive : haloColorIdle, k)
    }
  })

  return (
    <group position={position}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[baseRadius, 16, 16]} />
        <meshBasicMaterial ref={dotMatRef as React.Ref<import("three").MeshBasicMaterial>} color={dotColor} />
      </mesh>
      <mesh ref={haloRef}>
        <sphereGeometry args={[baseRadius, 12, 12]} />
        <meshBasicMaterial
          ref={haloMatRef as React.Ref<import("three").MeshBasicMaterial>}
          color={dotColor}
          transparent
          opacity={haloOpacityIdle}
          // Normal blending on cream so the halo doesn't bleach to invisible.
          blending={invert ? NormalBlending : AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh
        onPointerOver={(e) => {
          e.stopPropagation()
          onActivate()
          onHover({
            name: star.name,
            classification: star.designation,
            fact: `Magnitude ${star.magnitude}. ${isPolaris ? constellationFact : `Part of ${constellationName} — ${constellationFact}`}`,
            clickable: isClickable,
          })
        }}
        onPointerOut={() => {
          onDeactivate()
          onHover(null)
        }}
        onClick={(e) => {
          if (!onClick) return
          e.stopPropagation()
          onClick()
        }}
      >
        <sphereGeometry args={[baseRadius * 4, 12, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

function ConstellationGroup({
  constellation,
  active,
  setActive,
  onResetView,
  onHover,
  invert = false,
}: {
  constellation: Constellation
  active: boolean
  setActive: (id: ConstellationId | null) => void
  onResetView: () => void
  onHover: HoverHandler
  invert?: boolean
}) {
  const isClickable = constellation.clickAction === "reset-view"
  const isPolaris = constellation.id === "polaris"
  const onClick = isClickable ? onResetView : undefined

  // Centroid of the constellation's stars — anchor for the hover label.
  // Single-star "constellations" (Polaris) anchor on the star itself.
  const centroid = useMemo<[number, number, number]>(() => {
    const pts = constellation.stars.map((s) =>
      raDecToScenePos(s.raHours, s.decDeg, SKY_SHELL_DISTANCE),
    )
    const sum = pts.reduce(
      (acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]] as [number, number, number],
      [0, 0, 0] as [number, number, number],
    )
    const cx = sum[0] / pts.length
    const cy = sum[1] / pts.length
    const cz = sum[2] / pts.length
    return [cx, cy, cz]
  }, [constellation.stars])

  return (
    <group>
      <AsterismLine
        stars={constellation.stars}
        edges={constellation.edges}
        active={active}
        invert={invert}
      />

      {/* Hover label — fades in when the constellation is active.
          Lives outside the 3D point cloud as an HTML overlay so it stays crisp
          at any camera distance. drei's <Html> positions it in scene space. */}
      {active && (
        <Html
          position={centroid}
          center
          distanceFactor={120}
          zIndexRange={[10, 0]}
          // pointer events disabled — label is a hint, not a target
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
            style={{
              // Fade-in animation lives in CSS so it doesn't allocate a
              // motion node per constellation per frame.
              animation: "ue-label-in 220ms ease-out both",
            }}
          >
            {constellation.name}
          </div>
        </Html>
      )}
      {/* Also let the user hover the asterism line itself — invisible thick
          hit segments along each edge so the line isn't just decorative. */}
      {constellation.edges.map(([a, b], i) => (
        <EdgeHitZone
          key={i}
          a={constellation.stars[a]}
          b={constellation.stars[b]}
          onActivate={() => setActive(constellation.id)}
          onDeactivate={() => setActive(null)}
          onHover={onHover}
          info={{
            name: constellation.name,
            classification: constellation.designation,
            fact: constellation.fact,
          }}
        />
      ))}
      {constellation.stars.map((star) => (
        <ConstellationStarMesh
          key={star.name}
          star={star}
          active={active}
          isClickable={isClickable}
          isPolaris={isPolaris}
          invert={invert}
          onActivate={() => setActive(constellation.id)}
          onDeactivate={() => setActive(null)}
          onClick={onClick}
          onHover={onHover}
          constellationName={constellation.name}
          constellationFact={constellation.fact}
        />
      ))}
    </group>
  )
}

function EdgeHitZone({
  a,
  b,
  onActivate,
  onDeactivate,
  onHover,
  info,
}: {
  a: ConstellationStar
  b: ConstellationStar
  onActivate: () => void
  onDeactivate: () => void
  onHover: HoverHandler
  info: { name: string; classification: string; fact: string }
}) {
  // Build a thin cylinder along the edge as an invisible hover target so
  // pointing at the asterism line itself also activates the constellation.
  const { position, rotation, length } = useMemo(() => {
    const pa = raDecToScenePos(a.raHours, a.decDeg, SKY_SHELL_DISTANCE)
    const pb = raDecToScenePos(b.raHours, b.decDeg, SKY_SHELL_DISTANCE)
    const dx = pb[0] - pa[0]
    const dy = pb[1] - pa[1]
    const dz = pb[2] - pa[2]
    const len = Math.hypot(dx, dy, dz)
    const mid: [number, number, number] = [
      (pa[0] + pb[0]) / 2,
      (pa[1] + pb[1]) / 2,
      (pa[2] + pb[2]) / 2,
    ]
    // Default cylinder axis = Y. Rotate to point along (dx, dy, dz).
    const yaw = Math.atan2(dx, dz)
    const pitch = Math.atan2(Math.sqrt(dx * dx + dz * dz), dy)
    return {
      position: mid,
      rotation: [pitch, yaw, 0] as [number, number, number],
      length: len,
    }
  }, [a.raHours, a.decDeg, b.raHours, b.decDeg])

  return (
    <mesh
      position={position}
      rotation={rotation}
      onPointerOver={(e) => {
        e.stopPropagation()
        onActivate()
        onHover(info)
      }}
      onPointerOut={() => {
        onDeactivate()
        onHover(null)
      }}
    >
      <cylinderGeometry args={[0.7, 0.7, length, 8, 1, true]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}

function Constellations({
  onHover,
  onResetView,
  invert = false,
}: {
  onHover: HoverHandler
  onResetView: () => void
  invert?: boolean
}) {
  const [active, setActive] = useState<ConstellationId | null>(null)

  return (
    <group>
      {constellations.map((c) => (
        <ConstellationGroup
          key={c.id}
          constellation={c}
          active={active === c.id}
          setActive={setActive}
          onResetView={onResetView}
          onHover={onHover}
          invert={invert}
        />
      ))}
    </group>
  )
}

/* ============================================================
 * Shooting stars — cyclical meteor streaks across the sky.
 * ============================================================ */

function Meteor({ baseDelay, invert = false }: { baseDelay: number; invert?: boolean }) {
  const groupRef = useRef<Group>(null)
  const stateRef = useRef({
    t: -baseDelay,
    duration: 2.2 + Math.random() * 1.8,
    cooldown: 6 + Math.random() * 14,
    origin: [0, 0, 0] as [number, number, number],
    direction: [0, 0, 0] as [number, number, number],
    length: 0,
  })

  const resetMeteor = () => {
    const r = 50 + Math.random() * 30
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    const ox = r * Math.sin(phi) * Math.cos(theta) + SUN_OFFSET_SCENE
    const oy = r * Math.cos(phi) * 0.5
    const oz = r * Math.sin(phi) * Math.sin(theta)

    const tx = SUN_OFFSET_SCENE + (Math.random() - 0.5) * 30
    const ty = (Math.random() - 0.5) * 10
    const tz = (Math.random() - 0.5) * 30
    const dx = tx - ox
    const dy = ty - oy
    const dz = tz - oz
    const mag = Math.hypot(dx, dy, dz)

    stateRef.current.origin = [ox, oy, oz]
    stateRef.current.direction = [dx / mag, dy / mag, dz / mag]
    stateRef.current.length = 30 + Math.random() * 25
    stateRef.current.duration = 2.2 + Math.random() * 1.8
    stateRef.current.cooldown = 6 + Math.random() * 14
    stateRef.current.t = 0
  }

  useEffect(() => {
    resetMeteor()
    stateRef.current.t = -baseDelay
  }, [baseDelay])

  useFrame((_, delta) => {
    const s = stateRef.current
    s.t += delta

    if (!groupRef.current) return

    if (s.t < 0) {
      groupRef.current.visible = false
      return
    }
    if (s.t > s.duration) {
      groupRef.current.visible = false
      if (s.t > s.duration + s.cooldown) {
        resetMeteor()
      }
      return
    }

    groupRef.current.visible = true
    const progress = s.t / s.duration
    const x = s.origin[0] + s.direction[0] * progress * s.length
    const y = s.origin[1] + s.direction[1] * progress * s.length
    const z = s.origin[2] + s.direction[2] * progress * s.length
    groupRef.current.position.set(x, y, z)
  })

  const streakGeometry = useMemo(() => {
    const arr = new Float32Array(2 * 3)
    arr[0] = 0; arr[1] = 0; arr[2] = 0
    arr[3] = -1.2; arr[4] = 0; arr[5] = 0
    const geo = new BufferGeometry()
    geo.setAttribute("position", new BufferAttribute(arr, 3))
    return geo
  }, [])

  // On cream paper, ink streaks read as inked-meteor lines on a chart.
  const meteorColor = invert ? "#0a0a0a" : "#ffffff"
  const streakOpacity = invert ? 0.6 : 0.4

  return (
    <group ref={groupRef}>
      <mesh>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshBasicMaterial color={meteorColor} />
      </mesh>
      <line geometry={streakGeometry}>
        <lineBasicMaterial color={meteorColor} transparent opacity={streakOpacity} />
      </line>
    </group>
  )
}

function ShootingStars({ count = 6, invert = false }: { count?: number; invert?: boolean }) {
  return (
    <group>
      {Array.from({ length: count }).map((_, i) => (
        <Meteor key={i} baseDelay={i * 3 + Math.random() * 5} invert={invert} />
      ))}
    </group>
  )
}

/* ============================================================
 * Belts (asteroid + Kuiper)
 * ============================================================ */

function Belt({
  innerRadius,
  outerRadius,
  count,
  thickness,
  rotationSpeed,
  pointSize,
  opacity,
  info,
  onHover,
  invert = false,
}: {
  innerRadius: number
  outerRadius: number
  count: number
  thickness: number
  rotationSpeed: number
  pointSize: number
  opacity: number
  info: import("./types").BodyInfo
  onHover: HoverHandler
  invert?: boolean
}) {
  const ref = useRef<Points>(null)

  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const r = innerRadius + Math.random() * (outerRadius - innerRadius)
      const angle = Math.random() * Math.PI * 2
      const y = (Math.random() - 0.5) * thickness
      positions[i * 3] = Math.cos(angle) * r
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = Math.sin(angle) * r
    }
    const geo = new BufferGeometry()
    geo.setAttribute("position", new BufferAttribute(positions, 3))
    return geo
  }, [innerRadius, outerRadius, count, thickness])

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * rotationSpeed
  })

  const midRadius = (innerRadius + outerRadius) / 2
  const halfWidth = (outerRadius - innerRadius) / 2

  return (
    <group>
      <points ref={ref} geometry={geometry}>
        <pointsMaterial
          size={pointSize}
          sizeAttenuation
          // Ink dust on cream; pale grey on ink — same role, opposite end of the value scale.
          color={invert ? "#1a1208" : "#bcbcbc"}
          depthWrite={false}
          transparent
          opacity={opacity}
        />
      </points>
      <mesh
        rotation={[Math.PI / 2, 0, 0]}
        onPointerOver={(e) => {
          e.stopPropagation()
          onHover(info)
        }}
        onPointerOut={() => {
          onHover(null)
        }}
      >
        <torusGeometry args={[midRadius, halfWidth, 8, 96]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

/* ============================================================
 * Planets + Sun + Orbit Rings
 * ============================================================ */

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
  const ringColor = invert ? "#1a1208" : "#ffffff"
  const innerMatRef = useRef<import("three").MeshBasicMaterial>(null)
  const outerMatRef = useRef<import("three").MeshBasicMaterial>(null)

  const innerIdle = invert ? 0.55 : 0.35
  const outerIdle = invert ? 0.42 : 0.28
  const innerHover = invert ? 0.85 : 0.65
  const outerHover = invert ? 0.7 : 0.55

  // Lerp ring opacity toward the hover target each frame — rings become
  // markedly more present when Saturn is hovered, signalling "this is the
  // body you're inspecting" alongside the texture morph on the planet.
  useFrame((_, delta) => {
    const k = 1 - Math.exp(-delta * 8)
    if (innerMatRef.current) {
      const target = highlighted ? innerHover : innerIdle
      innerMatRef.current.opacity += (target - innerMatRef.current.opacity) * k
    }
    if (outerMatRef.current) {
      const target = highlighted ? outerHover : outerIdle
      outerMatRef.current.opacity += (target - outerMatRef.current.opacity) * k
    }
  })

  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
      <mesh>
        <ringGeometry args={[planetRadius * 1.45, planetRadius * 1.78, 96]} />
        <meshBasicMaterial
          ref={innerMatRef as React.Ref<import("three").MeshBasicMaterial>}
          color={ringColor}
          transparent
          opacity={innerIdle}
          side={DoubleSide}
        />
      </mesh>
      <mesh>
        <ringGeometry args={[planetRadius * 1.85, planetRadius * 2.10, 96]} />
        <meshBasicMaterial
          ref={outerMatRef as React.Ref<import("three").MeshBasicMaterial>}
          color={ringColor}
          transparent
          opacity={outerIdle}
          side={DoubleSide}
        />
      </mesh>
    </group>
  )
}

function PlanetBody({
  planet,
  onHover,
  invert = false,
}: {
  planet: ScenePlanet
  onHover: HoverHandler
  invert?: boolean
}) {
  const meshRef = useRef<Mesh>(null)
  const orbitRef = useRef<Group>(null)
  const texMeshRef = useRef<Mesh>(null)
  const texMatRef = useRef<import("three").MeshStandardMaterial>(null)
  const [isHovered, setIsHovered] = useState(false)
  const [texture, setTexture] = useState<Texture | null>(null)

  const textureUrl = planet.raw.textureUrl
  const hasTexture = Boolean(textureUrl)

  // Lazy-load the planet's equirectangular surface texture on demand —
  // only once the planet is hovered for the first time, so the assets
  // (NASA Blue Marble for Earth, Solar System Scope CC BY for Jupiter +
  // Saturn) never enter the critical path for visitors who don't explore.
  useEffect(() => {
    if (!textureUrl || !isHovered || texture) return
    const loader = new TextureLoader()
    loader.load(textureUrl, (tex) => {
      tex.colorSpace = SRGBColorSpace
      tex.anisotropy = 4
      setTexture(tex)
    })
  }, [textureUrl, isHovered, texture])

  useEffect(() => {
    if (orbitRef.current) orbitRef.current.rotation.y = planet.raw.startPhase
  }, [planet.raw.startPhase])

  useFrame((_, delta) => {
    const tw = timeWarpRef.current
    if (orbitRef.current) orbitRef.current.rotation.y += delta * planet.orbitalSpeedRadPerSec * tw
    if (meshRef.current) meshRef.current.rotation.y += delta * planet.rotSpeedRadPerSec * tw

    // Textured sphere rotates in lockstep with the grey one underneath so
    // surface features (Earth's continents, Jupiter's bands, Saturn's
    // stripes) drift naturally as time advances.
    if (texMeshRef.current) {
      texMeshRef.current.rotation.y += delta * planet.rotSpeedRadPerSec * tw
    }
    // Lerp the textured material's opacity toward the hover target — the
    // morph between abstract chart-marker and photographic globe stays smooth.
    if (texMatRef.current) {
      const k = 1 - Math.exp(-delta * 8)
      const target = isHovered && texture ? 1 : 0
      texMatRef.current.opacity += (target - texMatRef.current.opacity) * k
    }
  })

  const hitRadius = Math.max(planet.visualRadius * 2.2, 0.18)
  const childMoons = moons.filter((m) => m.parent === planet.raw.name)
  // Whichever planet's hovered: its moons brighten + scale up. Earth's
  // Luna, Jupiter's Galilean four, Saturn's Titan, Neptune's Triton,
  // Pluto's Charon — all coordinated to the parent's hover state.
  const moonsHighlighted = isHovered

  return (
    <group rotation={[planet.inclination, 0, 0]}>
      <group ref={orbitRef}>
        <group position={[planet.orbitRadius, 0, 0]}>
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
                any planet with a textureUrl (Earth, Jupiter, Saturn). Material
                opacity lerps in/out via useFrame so the swap reads as a smooth
                morph from chart-marker to photographic globe. The textured
                sphere is fractionally larger so it doesn't z-fight with the
                grey one underneath. */}
            {hasTexture && texture && (
              <mesh ref={texMeshRef}>
                <sphereGeometry args={[planet.visualRadius * 1.005, 64, 64]} />
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

            <mesh
              onPointerOver={(e) => {
                e.stopPropagation()
                setIsHovered(true)
                onHover(planetToInfo(planet.raw))
              }}
              onPointerOut={() => {
                setIsHovered(false)
                onHover(null)
              }}
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

          {childMoons.map((m) => (
            <MoonBody
              key={m.name}
              moon={m}
              onHover={onHover}
              highlighted={moonsHighlighted}
            />
          ))}
        </group>
      </group>
    </group>
  )
}

function OrbitRing({
  radius,
  inclination,
  invert = false,
}: {
  radius: number
  inclination: number
  invert?: boolean
}) {
  const geometry = useMemo(() => {
    const segments = 192
    const arr = new Float32Array((segments + 1) * 3)
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2
      arr[i * 3] = Math.cos(angle) * radius
      arr[i * 3 + 1] = 0
      arr[i * 3 + 2] = Math.sin(angle) * radius
    }
    const geo = new BufferGeometry()
    geo.setAttribute("position", new BufferAttribute(arr, 3))
    return geo
  }, [radius])

  return (
    <group rotation={[inclination, 0, 0]}>
      <line geometry={geometry}>
        <lineBasicMaterial
          // Faint hairline orbits — ink on cream needs ~6× the opacity to
          // read at the same value as white-on-black.
          color={invert ? "#0a0a0a" : "#ffffff"}
          transparent
          opacity={invert ? 0.42 : 0.08}
        />
      </line>
    </group>
  )
}

function SolarSystem({
  onHover,
  invert = false,
}: {
  onHover: HoverHandler
  invert?: boolean
}) {
  const sunRef = useRef<Mesh>(null)
  const coronaRef = useRef<Mesh>(null)
  const scenePlanets = useMemo(buildScenePlanets, [])
  const sunRotSpeed = useMemo(
    () => (2 * Math.PI) / (25 / TIME_WARP_DAYS_PER_SEC),
    [],
  )

  useFrame((_, delta) => {
    if (sunRef.current) sunRef.current.rotation.y += delta * sunRotSpeed * timeWarpRef.current
    if (coronaRef.current) {
      const s = 1 + Math.sin(performance.now() * 0.0008) * 0.025
      coronaRef.current.scale.set(s, s, s)
    }
  })

  // Chart-mode Sun: a warm-amber disc ringed by a thin halo (like a printed
  // sun stamp on an old star map) instead of the glowing white sphere.
  // Lighting drops to almost ambient — planets get most of their colour from
  // the scene's ambientLight when invert is on.
  const sunBodyColor = invert ? "#c95824" : "#ffffff"
  const sunEmissive = invert ? "#7a3a16" : "#ffffff"
  const sunEmissiveIntensity = invert ? 0.0 : 1.6
  const coronaBlending = invert ? NormalBlending : AdditiveBlending
  const coronaInnerOpacity = invert ? 0.32 : 0.22
  const coronaOuterOpacity = invert ? 0.14 : 0.08
  const pointLightIntensity = invert ? 0.5 : 3.5

  return (
    <group>
      <mesh ref={sunRef}>
        <sphereGeometry args={[0.7, 64, 64]} />
        <meshStandardMaterial
          color={sunBodyColor}
          emissive={sunEmissive}
          emissiveIntensity={sunEmissiveIntensity}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={coronaRef}>
        <sphereGeometry args={[0.92, 48, 48]} />
        <meshBasicMaterial
          color={invert ? "#c95824" : "#ffffff"}
          transparent
          opacity={coronaInnerOpacity}
          blending={coronaBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[1.3, 48, 48]} />
        <meshBasicMaterial
          color={invert ? "#e5a878" : "#ffffff"}
          transparent
          opacity={coronaOuterOpacity}
          blending={coronaBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh
        onPointerOver={(e) => {
          e.stopPropagation()
          onHover(SUN_INFO)
        }}
        onPointerOut={() => {
          onHover(null)
        }}
      >
        <sphereGeometry args={[0.9, 32, 32]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <pointLight position={[0, 0, 0]} intensity={pointLightIntensity} distance={60} color="#ffffff" decay={1.3} />

      {scenePlanets.map((p) => (
        <OrbitRing
          key={`orbit-${p.raw.name}`}
          radius={p.orbitRadius}
          inclination={p.inclination}
          invert={invert}
        />
      ))}

      {scenePlanets.map((p) => (
        <PlanetBody key={p.raw.name} planet={p} onHover={onHover} invert={invert} />
      ))}

      {/* Asteroid Belt — 2.2–3.2 AU → sqrt × 3 → 4.45–5.37 scene units */}
      <Belt
        innerRadius={4.45}
        outerRadius={5.37}
        count={900}
        thickness={0.12}
        rotationSpeed={0.05}
        pointSize={0.035}
        opacity={0.75}
        info={ASTEROID_BELT_INFO}
        onHover={onHover}
        invert={invert}
      />

      {/* Kuiper Belt — 30–50 AU → 16.43–21.21 scene units */}
      <Belt
        innerRadius={16.43}
        outerRadius={21.21}
        count={1400}
        thickness={0.35}
        rotationSpeed={0.012}
        pointSize={0.03}
        opacity={0.5}
        info={KUIPER_BELT_INFO}
        onHover={onHover}
        invert={invert}
      />
    </group>
  )
}

/* ============================================================
 * Named small bodies — comets, asteroids, interstellars
 *
 * Each body is animated continuously along its own elliptical / hyperbolic
 * path defined in astronomy.ts. The orbit math is a deliberate
 * simplification of Kepler's laws — true anomaly is approximated as a
 * uniform angle around the focus (the Sun) rather than solving Kepler's
 * equation per frame — so the motion isn't physically accurate but reads
 * correctly (slower at aphelion, faster at perihelion).
 *
 * Each body is also a hover target. The cursor reticle picks up its name,
 * the InfoPanel surfaces its designation + fact, and (on mobile) the
 * MobileBodySheet slides up with the same data.
 *
 * Scene-scale: same sqrt(aAU) * 3 mapping the planets use, so a comet at
 * 17.8 AU sits at the right radial distance relative to Saturn/Uranus.
 * ============================================================ */

function NamedBodyMesh({
  body,
  onHover,
  invert = false,
}: {
  body: NamedBody
  onHover: HoverHandler
  invert?: boolean
}) {
  const groupRef = useRef<Group>(null)

  // Pre-compute everything time-independent: orbital scale, tilt, base colour.
  const config = useMemo(() => {
    const a = Math.sqrt(body.aAU) * 3 // scene-scale semi-major axis
    const e = body.eccentricity
    const inclination = body.inclDeg * DEG
    const visualRadius = body.visualRadius ?? 0.05
    // Periodic bodies loop; interstellars get a finite "passage window"
    // measured in seconds of scene time so the user can see them coming
    // and going without them living on screen indefinitely.
    const period = isFinite(body.periodYears)
      ? body.periodYears * 365.25 / TIME_WARP_DAYS_PER_SEC
      : 120 // ~2 minutes of scene time end-to-end for interstellars
    const angularSpeed = (2 * Math.PI) / period
    const phase = body.startPhase * Math.PI * 2

    // Default colours by kind: comets get a warm ice-blue, asteroids a
    // dusty grey-brown, interstellars a sharper accent.
    const defaultShade =
      body.kind === "comet"        ? "#9ed4ff" :
      body.kind === "asteroid"     ? "#b8a482" :
      /* interstellar */              "#ffd66b"
    const shade = body.shade ?? defaultShade

    return { a, e, inclination, visualRadius, angularSpeed, phase, shade, isLoop: isFinite(body.periodYears) }
  }, [body])

  // Pre-compute a thin trail of orbit positions so each body draws a
  // dotted ellipse behind it, hinting at the path.
  const trailGeometry = useMemo(() => {
    const STEPS = config.isLoop ? 90 : 60
    const positions = new Float32Array(STEPS * 3)
    for (let i = 0; i < STEPS; i++) {
      const t = (i / STEPS) * Math.PI * 2
      // Kepler ellipse with the Sun at one focus.
      const r = config.a * (1 - config.e * config.e) / (1 + config.e * Math.cos(t))
      const x = r * Math.cos(t)
      const z = r * Math.sin(t)
      const y = z * Math.sin(config.inclination)
      const z2 = z * Math.cos(config.inclination)
      positions[i * 3]     = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z2
    }
    const geo = new BufferGeometry()
    geo.setAttribute("position", new BufferAttribute(positions, 3))
    return geo
  }, [config])

  useFrame((_, delta) => {
    const tw = timeWarpRef.current
    if (!groupRef.current) return

    // Advance phase; loop for periodic bodies, ping-pong for interstellars
    // so they continue to pass through the scene every couple of minutes.
    config.phase += delta * config.angularSpeed * tw
    if (config.isLoop) {
      if (config.phase > Math.PI * 2) config.phase -= Math.PI * 2
    } else {
      // Interstellar — keep phase in [0, 2π] and reset position when it
      // wanders too far so the body re-enters the scene periodically.
      if (config.phase > Math.PI * 2) {
        config.phase = 0
      }
    }

    const t = config.phase
    const r = config.a * (1 - config.e * config.e) / (1 + config.e * Math.cos(t))
    const x = r * Math.cos(t)
    const z = r * Math.sin(t)
    const y = z * Math.sin(config.inclination)
    const z2 = z * Math.cos(config.inclination)
    groupRef.current.position.set(x, y, z2)
  })

  // Hit-zone radius — never smaller than 0.16 so even tiny bodies are
  // findable with a finger or cursor.
  const hitRadius = Math.max(0.16, config.visualRadius * 3)

  return (
    // Both the trail (anchored at the Sun) and the moving body live in the
    // same parent so they share the SolarSystem's coordinate frame.
    <group>
      {/* Orbit trail — thin dotted ellipse traced once at mount, never updated. */}
      <points geometry={trailGeometry}>
        <pointsMaterial
          size={invert ? 0.024 : 0.020}
          sizeAttenuation
          color={invert ? "#1a1208" : config.shade}
          transparent
          opacity={config.isLoop ? (invert ? 0.4 : 0.25) : (invert ? 0.3 : 0.18)}
          depthWrite={false}
        />
      </points>

      {/* The body itself — moved each frame to its current orbit position. */}
      <group ref={groupRef}>
        <mesh>
          <sphereGeometry args={[config.visualRadius, 16, 16]} />
          <meshStandardMaterial
            color={config.shade}
            emissive={config.shade}
            emissiveIntensity={invert ? 0.0 : 0.6}
            roughness={0.7}
          />
        </mesh>
        <mesh
          onPointerOver={(e) => {
            e.stopPropagation()
            onHover({
              name: body.name,
              classification:
                body.kind === "comet"        ? `Comet · ${body.designation}` :
                body.kind === "asteroid"     ? `Asteroid · ${body.designation}` :
                /* interstellar */              `Interstellar · ${body.designation}`,
              aAU: body.aAU,
              periodDays: isFinite(body.periodYears) ? body.periodYears * 365.25 : undefined,
              fact: body.fact,
            })
          }}
          onPointerOut={() => onHover(null)}
        >
          <sphereGeometry args={[hitRadius, 12, 12]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
    </group>
  )
}

function NamedBodies({
  onHover,
  invert = false,
}: {
  onHover: HoverHandler
  invert?: boolean
}) {
  return (
    <group>
      {namedBodies.map((body) => (
        <NamedBodyMesh key={body.designation} body={body} onHover={onHover} invert={invert} />
      ))}
    </group>
  )
}

/* ============================================================
 * Public scene composition — mounted inside the <Canvas>.
 * ============================================================ */

export function SceneContents({
  enableMotion,
  onHover,
  onResetView,
  mobile = false,
  invert = false,
}: {
  enableMotion: boolean
  onHover: HoverHandler
  onResetView: () => void
  mobile?: boolean
  invert?: boolean
}) {
  const { scene } = useThree()
  useEffect(() => {
    scene.fog = new FogExp2(invert ? "#efece3" : "#050505", 0.0035)
    return () => {
      scene.fog = null
    }
  }, [scene, invert])

  return (
    <>
      {/* drei <Stars> is white-only / additive. Drop it in inverted mode and
          let the MilkyWay points carry the field as ink-on-paper instead. */}
      {!invert && (
        <Stars
          radius={400}
          depth={100}
          count={mobile ? 1100 : 2200}
          factor={4}
          saturation={0}
          fade
          speed={enableMotion ? 0.2 : 0}
        />
      )}
      <group rotation={[GALACTIC_PLANE_TILT_RAD, 0, 0]}>
        <MilkyWay onHover={onHover} mobile={mobile} invert={invert} />
      </group>
      <group position={SOLAR_SYSTEM_POSITION}>
        <SolarSystem onHover={onHover} invert={invert} />
        {/* Comets, asteroids, interstellars — share the SolarSystem origin
            so their orbits sit around the same Sun the planets do. */}
        <NamedBodies onHover={onHover} invert={invert} />
      </group>
      <Constellations onHover={onHover} onResetView={onResetView} invert={invert} />
      {enableMotion && <ShootingStars count={mobile ? 3 : 6} invert={invert} />}
      <ambientLight intensity={invert ? 0.55 : 0.18} />
    </>
  )
}
