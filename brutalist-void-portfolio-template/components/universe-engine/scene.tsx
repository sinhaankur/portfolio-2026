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
import { Stars } from "@react-three/drei"
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
} from "three"

import {
  ASTEROID_BELT_INFO,
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

function MoonBody({ moon, onHover }: { moon: MoonData; onHover: HoverHandler }) {
  const orbitRef = useRef<Group>(null)
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
  })

  const hitRadius = Math.max(moon.visualRadius * 3, 0.12)

  return (
    <group ref={orbitRef}>
      <mesh position={[moon.orbitRadius, 0, 0]}>
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
}: {
  stars: ConstellationStar[]
  edges: [number, number][]
  active: boolean
}) {
  const matRef = useRef<LineMatRef>(null)
  const colorTarget = useMemo(() => new Color("#ffffff"), [])
  const colorActive = useMemo(() => new Color("#ffd66b"), [])

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
    const targetOpacity = active ? 0.9 : 0.18
    const k = 1 - Math.exp(-delta * 8)
    matRef.current.opacity += (targetOpacity - matRef.current.opacity) * k
    matRef.current.color.lerp(active ? colorActive : colorTarget, k)
  })

  if (edges.length === 0) return null

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial
        ref={matRef as React.Ref<LineMatRef>}
        color="#ffffff"
        transparent
        opacity={0.18}
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

  const position = useMemo(
    () => raDecToScenePos(star.raHours, star.decDeg, SKY_SHELL_DISTANCE),
    [star.raHours, star.decDeg],
  )
  const baseRadius = magToVisualRadius(star.magnitude) * (isPolaris ? 1.4 : 1.0)
  const haloColorIdle = useMemo(() => new Color("#ffffff"), [])
  const haloColorActive = useMemo(() => new Color("#fff2b8"), [])

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
      const opacityTarget = active ? 0.6 : 0.18
      haloMatRef.current.opacity += (opacityTarget - haloMatRef.current.opacity) * k
      haloMatRef.current.color.lerp(active ? haloColorActive : haloColorIdle, k)
    }
  })

  return (
    <group position={position}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[baseRadius, 16, 16]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh ref={haloRef}>
        <sphereGeometry args={[baseRadius, 12, 12]} />
        <meshBasicMaterial
          ref={haloMatRef as React.Ref<import("three").MeshBasicMaterial>}
          color="#ffffff"
          transparent
          opacity={0.18}
          blending={AdditiveBlending}
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
}: {
  constellation: Constellation
  active: boolean
  setActive: (id: ConstellationId | null) => void
  onResetView: () => void
  onHover: HoverHandler
}) {
  const isClickable = constellation.clickAction === "reset-view"
  const isPolaris = constellation.id === "polaris"
  const onClick = isClickable ? onResetView : undefined

  return (
    <group>
      <AsterismLine
        stars={constellation.stars}
        edges={constellation.edges}
        active={active}
      />
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
}: {
  onHover: HoverHandler
  onResetView: () => void
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
        />
      ))}
    </group>
  )
}

/* ============================================================
 * Shooting stars — cyclical meteor streaks across the sky.
 * ============================================================ */

function Meteor({ baseDelay }: { baseDelay: number }) {
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

  return (
    <group ref={groupRef}>
      <mesh>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <line geometry={streakGeometry}>
        <lineBasicMaterial color="#ffffff" transparent opacity={0.4} />
      </line>
    </group>
  )
}

function ShootingStars({ count = 6 }: { count?: number }) {
  return (
    <group>
      {Array.from({ length: count }).map((_, i) => (
        <Meteor key={i} baseDelay={i * 3 + Math.random() * 5} />
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
          color="#bcbcbc"
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

function SaturnRings({ planetRadius }: { planetRadius: number }) {
  // Rings sit in Saturn's equatorial plane. The parent group applies the
  // 26.73° axial tilt, so rings inherit it naturally.
  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
      <mesh>
        <ringGeometry args={[planetRadius * 1.45, planetRadius * 1.78, 96]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.35} side={DoubleSide} />
      </mesh>
      <mesh>
        <ringGeometry args={[planetRadius * 1.85, planetRadius * 2.10, 96]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.28} side={DoubleSide} />
      </mesh>
    </group>
  )
}

function PlanetBody({
  planet,
  onHover,
}: {
  planet: ScenePlanet
  onHover: HoverHandler
}) {
  const meshRef = useRef<Mesh>(null)
  const orbitRef = useRef<Group>(null)

  useEffect(() => {
    if (orbitRef.current) orbitRef.current.rotation.y = planet.raw.startPhase
  }, [planet.raw.startPhase])

  useFrame((_, delta) => {
    const tw = timeWarpRef.current
    if (orbitRef.current) orbitRef.current.rotation.y += delta * planet.orbitalSpeedRadPerSec * tw
    if (meshRef.current) meshRef.current.rotation.y += delta * planet.rotSpeedRadPerSec * tw
  })

  const hitRadius = Math.max(planet.visualRadius * 2.2, 0.18)
  const childMoons = moons.filter((m) => m.parent === planet.raw.name)

  return (
    <group rotation={[planet.inclination, 0, 0]}>
      <group ref={orbitRef}>
        <group position={[planet.orbitRadius, 0, 0]}>
          <group rotation={[planet.axialTilt, 0, 0]}>
            <mesh ref={meshRef}>
              <sphereGeometry args={[planet.visualRadius, 48, 48]} />
              <meshStandardMaterial
                color={planet.raw.shade}
                roughness={0.95}
                metalness={0.0}
              />
            </mesh>
            <mesh
              onPointerOver={(e) => {
                e.stopPropagation()
                onHover(planetToInfo(planet.raw))
              }}
              onPointerOut={() => {
                onHover(null)
              }}
            >
              <sphereGeometry args={[hitRadius, 24, 24]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
            {planet.raw.hasRings && <SaturnRings planetRadius={planet.visualRadius} />}
          </group>

          {childMoons.map((m) => (
            <MoonBody key={m.name} moon={m} onHover={onHover} />
          ))}
        </group>
      </group>
    </group>
  )
}

function OrbitRing({ radius, inclination }: { radius: number; inclination: number }) {
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
        <lineBasicMaterial color="#ffffff" transparent opacity={0.08} />
      </line>
    </group>
  )
}

function SolarSystem({ onHover }: { onHover: HoverHandler }) {
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

  return (
    <group>
      <mesh ref={sunRef}>
        <sphereGeometry args={[0.7, 64, 64]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={1.6}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={coronaRef}>
        <sphereGeometry args={[0.92, 48, 48]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.22} blending={AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[1.3, 48, 48]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.08} blending={AdditiveBlending} depthWrite={false} />
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
      <pointLight position={[0, 0, 0]} intensity={3.5} distance={60} color="#ffffff" decay={1.3} />

      {scenePlanets.map((p) => (
        <OrbitRing key={`orbit-${p.raw.name}`} radius={p.orbitRadius} inclination={p.inclination} />
      ))}

      {scenePlanets.map((p) => (
        <PlanetBody key={p.raw.name} planet={p} onHover={onHover} />
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
      />
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
        <SolarSystem onHover={onHover} />
      </group>
      <Constellations onHover={onHover} onResetView={onResetView} />
      {enableMotion && <ShootingStars count={mobile ? 3 : 6} />}
      <ambientLight intensity={invert ? 0.55 : 0.18} />
    </>
  )
}
