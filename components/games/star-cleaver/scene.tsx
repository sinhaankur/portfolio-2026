"use client"

/**
 * Star Cleaver — defender R3F scene.
 *
 * Layout (right-handed; +Z toward camera):
 *
 *   z = -20  ╶─  defended planet (large, partial frame, lower-left)
 *   z = -18  ╶─  alien spawn shell (back wall)
 *   z =  +9  ╶─  player ship (the Cleaver)
 *   z = +14  ╶─  camera
 *   z > +11  ╶─  "alien leaked past us" — planet takes damage
 *
 * The camera is fixed but breathes/sways for cinematic feel. The
 * ship banks with the aim input so the player has a kinaesthetic
 * connection to the reticle. Drift particles streak from depth
 * toward camera to convey forward motion through space.
 *
 * Aliens are managed by AlienSwarm, which is the only component
 * that owns array state. Everything else is stateless / ref-driven.
 */

import { useEffect, useMemo, useRef } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  Object3D,
  ShaderMaterial,
  Vector3,
} from "three"
import { BrightStarField } from "@/components/universe-engine/bright-star-field"
import type { GameState } from "./state"
import { isAimable, isCombatActive } from "./state"
import { WORLDS, type DefendedWorld } from "./targets"

/* =============================================================
 * Defended planet
 * ============================================================= */

const PLANET_VERTEX = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vLocalPos;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vLocalPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const PLANET_FRAGMENT = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vLocalPos;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uLightDir;

  float hash3(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n000 = hash3(i);
    float n100 = hash3(i + vec3(1,0,0));
    float n010 = hash3(i + vec3(0,1,0));
    float n110 = hash3(i + vec3(1,1,0));
    float n001 = hash3(i + vec3(0,0,1));
    float n101 = hash3(i + vec3(1,0,1));
    float n011 = hash3(i + vec3(0,1,1));
    float n111 = hash3(i + vec3(1,1,1));
    return mix(
      mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
      mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
      f.z
    );
  }
  float fbm(vec3 p) {
    float s = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      s += a * noise3(p);
      p *= 2.05;
      a *= 0.5;
    }
    return s;
  }

  void main() {
    float n = fbm(vLocalPos * 1.6);
    vec3 base = mix(uColor2, uColor1, smoothstep(0.35, 0.7, n));
    float ndl = dot(normalize(vNormal), normalize(uLightDir));
    float lit = clamp(ndl * 0.5 + 0.5, 0.0, 1.0);
    gl_FragColor = vec4(base * (0.2 + 0.8 * lit), 1.0);
  }
`

function DefendedPlanet({ world }: { world: DefendedWorld }) {
  const groupRef = useRef<Group>(null)
  const lightDir = useMemo(() => new Vector3(0.7, 0.4, 0.5).normalize(), [])

  useFrame((_, dt) => {
    if (!groupRef.current) return
    groupRef.current.rotation.y += world.rotationSpeed * dt
  })

  return (
    <group ref={groupRef} position={[-1.5, -4.5, -20]}>
      <mesh>
        <sphereGeometry args={[world.radius, 64, 64]} />
        <shaderMaterial
          vertexShader={PLANET_VERTEX}
          fragmentShader={PLANET_FRAGMENT}
          uniforms={{
            uColor1: { value: new Color(world.color1) },
            uColor2: { value: new Color(world.color2) },
            uLightDir: { value: lightDir },
          }}
        />
      </mesh>
      {/* Atmospheric rim. */}
      <mesh scale={world.radius * 1.07}>
        <sphereGeometry args={[1, 32, 32]} />
        <shaderMaterial
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          side={DoubleSide}
          vertexShader={/* glsl */ `
            varying vec3 vNormalW;
            void main() {
              vNormalW = normalize(mat3(modelMatrix) * normal);
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={/* glsl */ `
            varying vec3 vNormalW;
            uniform vec3 uColor;
            void main() {
              float rim = pow(1.0 - clamp(dot(vNormalW, vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 2.5);
              gl_FragColor = vec4(uColor * 0.7, rim * 0.6);
            }
          `}
          uniforms={{ uColor: { value: new Color(world.atmoColor) } }}
        />
      </mesh>
    </group>
  )
}

/* =============================================================
 * The Cleaver — player ship
 * ============================================================= */

function CleaverShip({
  charge,
  firing,
  aim,
  emitterRef,
}: {
  charge: number
  firing: boolean
  aim: { x: number; y: number }
  emitterRef: React.RefObject<Mesh | null>
}) {
  const groupRef = useRef<Group>(null)
  const emitterMatRef = useRef<{ emissiveIntensity?: number }>(null)

  useFrame((state) => {
    if (groupRef.current) {
      // Bank with aim x, pitch with aim y. Damped to avoid jitter.
      const targetRollZ = -aim.x * 0.45
      const targetPitchX = -aim.y * 0.25
      const targetYawY = aim.x * 0.18
      groupRef.current.rotation.z +=
        (targetRollZ - groupRef.current.rotation.z) * 0.12
      groupRef.current.rotation.x +=
        (targetPitchX - groupRef.current.rotation.x) * 0.12
      groupRef.current.rotation.y +=
        (targetYawY - groupRef.current.rotation.y) * 0.12
      // Lateral drift — small offset toward aim direction for parallax.
      const t = state.clock.elapsedTime
      groupRef.current.position.x = aim.x * 0.4 + Math.sin(t * 0.6) * 0.05
      groupRef.current.position.y = -1.5 + aim.y * 0.25 + Math.sin(t * 0.45) * 0.04
    }
    const mat = emitterMatRef.current
    if (mat) {
      const pulse = 0.4 + Math.sin(state.clock.elapsedTime * 6) * 0.15
      mat.emissiveIntensity = firing ? 8.0 : 0.4 + charge * (1.8 + pulse * 0.6)
    }
  })

  // Lambda-shuttle-inspired silhouette: long pointed cockpit, one
  // fixed top fin, two swept-down side wings. Built from R3F
  // primitives — no external assets, no IP-encumbered geometry.
  // Proportions are deliberately tweaked (longer cockpit, sharper
  // fin angle, the Cleaver's signature purple accents) so this
  // reads as "Lambda-flavoured gunship" rather than a clone.
  return (
    <group ref={groupRef} position={[0, -1.5, 9]} scale={0.55}>
      {/* Forward fuselage — long, pointed, the defining wedge. */}
      <mesh position={[0, 0, -1.6]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.22, 2.0, 6]} />
        <meshStandardMaterial color="#1a1a1d" roughness={0.5} metalness={0.7} />
      </mesh>
      {/* Mid hull — flat wedge box, wider than tall. */}
      <mesh position={[0, -0.03, -0.4]}>
        <boxGeometry args={[0.55, 0.32, 1.3]} />
        <meshStandardMaterial color="#26262a" roughness={0.5} metalness={0.7} />
      </mesh>
      {/* Cockpit viewport — thin horizontal strip near the front,
          subtly emissive so it reads as "someone's home". */}
      <mesh position={[0, 0.08, -1.05]}>
        <boxGeometry args={[0.32, 0.06, 0.18]} />
        <meshStandardMaterial
          color="#0a0a18"
          emissive="#b466ff"
          emissiveIntensity={0.7}
        />
      </mesh>
      {/* Aft hull — slightly wider engine block. */}
      <mesh position={[0, -0.05, 0.45]}>
        <boxGeometry args={[0.75, 0.36, 0.7]} />
        <meshStandardMaterial color="#1f1f24" roughness={0.55} metalness={0.7} />
      </mesh>
      {/* Top dorsal fin — tall trapezoid, the iconic "lambda" upright. */}
      <mesh position={[0, 0.55, 0.15]} rotation={[0, 0, 0]}>
        <boxGeometry args={[0.05, 0.85, 0.65]} />
        <meshStandardMaterial color="#1c1c20" roughness={0.5} metalness={0.7} />
      </mesh>
      {/* Top fin upper edge bevel — narrower bar near the top, gives
          the trapezoid the right cut-back profile. */}
      <mesh position={[0, 0.95, 0.32]} rotation={[0, 0, 0]}>
        <boxGeometry args={[0.06, 0.08, 0.32]} />
        <meshStandardMaterial color="#26262a" roughness={0.5} metalness={0.7} />
      </mesh>
      {/* Left wing — swept down at ~55° in flight position. */}
      <mesh position={[-0.55, -0.55, 0.18]} rotation={[0, 0, 0.95]}>
        <boxGeometry args={[0.85, 0.06, 0.55]} />
        <meshStandardMaterial color="#1c1c20" roughness={0.5} metalness={0.7} />
      </mesh>
      {/* Left wing tip — small accent bar at the wing's outer edge. */}
      <mesh position={[-0.95, -0.95, 0.18]} rotation={[0, 0, 0.95]}>
        <boxGeometry args={[0.12, 0.1, 0.55]} />
        <meshStandardMaterial color="#0e0e12" roughness={0.6} metalness={0.7} />
      </mesh>
      {/* Right wing — mirrored. */}
      <mesh position={[0.55, -0.55, 0.18]} rotation={[0, 0, -0.95]}>
        <boxGeometry args={[0.85, 0.06, 0.55]} />
        <meshStandardMaterial color="#1c1c20" roughness={0.5} metalness={0.7} />
      </mesh>
      <mesh position={[0.95, -0.95, 0.18]} rotation={[0, 0, -0.95]}>
        <boxGeometry args={[0.12, 0.1, 0.55]} />
        <meshStandardMaterial color="#0e0e12" roughness={0.6} metalness={0.7} />
      </mesh>
      {/* Twin rear thruster exhaust — wider stance than the original
          single thruster; reads as "two engines, defender-class". */}
      <mesh position={[-0.22, -0.05, 0.85]}>
        <coneGeometry args={[0.13, 0.55, 12]} />
        <meshBasicMaterial
          color="#9bd0ff"
          transparent
          opacity={0.6}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0.22, -0.05, 0.85]}>
        <coneGeometry args={[0.13, 0.55, 12]} />
        <meshBasicMaterial
          color="#9bd0ff"
          transparent
          opacity={0.6}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {/* Emitter — under-fuselage cannon, the beam exits from here. */}
      <mesh ref={emitterRef} position={[0, -0.12, -2.5]}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshStandardMaterial
          ref={(m) => {
            emitterMatRef.current = m as unknown as {
              emissiveIntensity?: number
            }
          }}
          color="#7a3acf"
          emissive="#b466ff"
          emissiveIntensity={0.4}
        />
      </mesh>
    </group>
  )
}

/* =============================================================
 * Venator-inspired alien mothership
 *
 * Looms in the deep background, slightly offset from the
 * defended planet so it reads as a separate threat. Built as
 * a dagger-shaped wedge hull with twin command towers + an
 * angry red engine glow. Doesn't move or fight — just hangs
 * there as the silent mass the fighters spawn from.
 *
 * IP note: this is a silhouette inspired by the Venator-class
 * Star Destroyer aesthetic — built entirely from R3F primitives
 * with different proportions and an alien colour grading. The
 * Sketchfab model file is never ingested.
 * ============================================================= */

function VenatorMothership() {
  const groupRef = useRef<Group>(null)
  useFrame((state) => {
    if (!groupRef.current) return
    const t = state.clock.elapsedTime
    // Drift slowly so it doesn't read as static. Yaw + a hint of
    // lateral motion gives it weight without distracting.
    groupRef.current.rotation.y = Math.sin(t * 0.04) * 0.12
    groupRef.current.position.x = 4 + Math.sin(t * 0.05) * 0.6
    groupRef.current.position.y = 1.8 + Math.sin(t * 0.06) * 0.15
  })
  return (
    <group ref={groupRef} position={[4, 1.8, -28]} scale={2.2}>
      {/* Main hull — long flat dagger. The thing's silhouette. */}
      <mesh position={[0, 0, 0]} rotation={[0, 0, 0]}>
        <coneGeometry args={[1.6, 6.0, 3]} />
        <meshStandardMaterial color="#262630" roughness={0.55} metalness={0.7} />
      </mesh>
      {/* Hull top plate — slight rise on top of the dagger. */}
      <mesh position={[0, 0.18, 0.4]} rotation={[0, 0, 0]}>
        <coneGeometry args={[1.4, 5.4, 3]} />
        <meshStandardMaterial color="#2c2c38" roughness={0.55} metalness={0.7} />
      </mesh>
      {/* Hangar slot — ventral dark strip running along the underside. */}
      <mesh position={[0, -0.32, -0.5]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.5, 3.5]} />
        <meshStandardMaterial
          color="#0a0a14"
          emissive="#ff4a2a"
          emissiveIntensity={0.4}
          side={DoubleSide}
        />
      </mesh>
      {/* Left command tower — rear-mounted, tall + narrow. */}
      <mesh position={[-0.32, 0.55, 1.5]}>
        <boxGeometry args={[0.22, 0.55, 0.5]} />
        <meshStandardMaterial color="#1e1e26" roughness={0.5} metalness={0.7} />
      </mesh>
      {/* Right command tower — twin. */}
      <mesh position={[0.32, 0.55, 1.5]}>
        <boxGeometry args={[0.22, 0.55, 0.5]} />
        <meshStandardMaterial color="#1e1e26" roughness={0.5} metalness={0.7} />
      </mesh>
      {/* Command-tower bridges — small spheres on top. */}
      <mesh position={[-0.32, 0.95, 1.5]}>
        <sphereGeometry args={[0.16, 12, 12]} />
        <meshStandardMaterial
          color="#1a1a22"
          emissive="#ff7a4a"
          emissiveIntensity={0.5}
        />
      </mesh>
      <mesh position={[0.32, 0.95, 1.5]}>
        <sphereGeometry args={[0.16, 12, 12]} />
        <meshStandardMaterial
          color="#1a1a22"
          emissive="#ff7a4a"
          emissiveIntensity={0.5}
        />
      </mesh>
      {/* Rear engine bank — three glowing ports, hostile red. */}
      <mesh position={[-0.5, 0, 2.6]}>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshBasicMaterial
          color="#ff4a2a"
          transparent
          opacity={0.85}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, 0, 2.6]}>
        <sphereGeometry args={[0.28, 16, 16]} />
        <meshBasicMaterial
          color="#ff6a4a"
          transparent
          opacity={0.85}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0.5, 0, 2.6]}>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshBasicMaterial
          color="#ff4a2a"
          transparent
          opacity={0.85}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

/* =============================================================
 * Beam
 * ============================================================= */

function Beam({
  visible,
  aimWorldDir,
  emitterRef,
}: {
  visible: boolean
  aimWorldDir: Vector3
  emitterRef: React.RefObject<Mesh | null>
}) {
  const groupRef = useRef<Group>(null)
  const emitterWorld = useMemo(() => new Vector3(), [])
  const BEAM_LEN = 36

  useFrame(() => {
    if (!groupRef.current || !visible || !emitterRef.current) return
    emitterRef.current.getWorldPosition(emitterWorld)
    // End point is far along aim direction.
    const end = emitterWorld
      .clone()
      .add(aimWorldDir.clone().multiplyScalar(BEAM_LEN))
    const mid = emitterWorld.clone().lerp(end, 0.5)
    groupRef.current.position.copy(mid)
    const up = new Vector3(0, 1, 0)
    const dir = end.clone().sub(emitterWorld).normalize()
    const axis = up.clone().cross(dir)
    const angle = Math.acos(up.dot(dir))
    if (axis.lengthSq() > 1e-6) {
      groupRef.current.quaternion.setFromAxisAngle(axis.normalize(), angle)
    }
    groupRef.current.scale.set(1, BEAM_LEN, 1)
  })

  if (!visible) return null
  return (
    <group ref={groupRef}>
      <mesh>
        <cylinderGeometry args={[0.1, 0.06, 1, 12, 1, true]} />
        <meshBasicMaterial
          color="#b466ff"
          transparent
          opacity={0.4}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
      <mesh>
        <cylinderGeometry args={[0.028, 0.018, 1, 8, 1, true]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={1}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
    </group>
  )
}

/* =============================================================
 * Alien ships + swarm
 * ============================================================= */

export type AlienHandle = {
  /** True if an alive alien is on (or near) the ray; kill it. Returns kills. */
  hitTest: (origin: Vector3, dir: Vector3) => number
  /** Reset to a fresh wave with `count` aliens, speed multiplier `speedMul`. */
  spawnWave: (count: number, speedMul: number) => void
  /** Imperatively clear all (e.g. on defeat / restart). */
  clear: () => void
  /** Snapshot of state — alive count + escaped count (leak events) since last call. */
  consumeEvents: () => { kills: number; leaks: number; aliveCount: number }
}

type Alien = {
  alive: boolean
  pos: Vector3
  vel: Vector3
  /** Sinusoidal wobble seed. */
  seed: number
  /** Per-alien speed scalar. */
  speed: number
}

function makeAlien(speedMul: number): Alien {
  return {
    alive: true,
    pos: new Vector3(
      (Math.random() - 0.5) * 16, // x: -8..8
      (Math.random() - 0.4) * 6, // y: -2.4..3.6 (biased above planet)
      -18 - Math.random() * 6, // z: -18..-24
    ),
    vel: new Vector3(0, 0, 0), // assigned per-frame from speed
    seed: Math.random() * Math.PI * 2,
    speed: (1.6 + Math.random() * 0.9) * speedMul,
  }
}

const AlienSwarm = (() => {
  return function AlienSwarmImpl({
    handleRef,
    active,
  }: {
    handleRef: React.MutableRefObject<AlienHandle | null>
    active: boolean
  }) {
    const groupRef = useRef<Group>(null)
    const aliensRef = useRef<Alien[]>([])
    // Events accumulated since the parent last consumed them.
    const eventsRef = useRef({ kills: 0, leaks: 0 })
    const meshesRef = useRef<Map<number, Object3D>>(new Map())

    // Imperative handle for the parent to call.
    useEffect(() => {
      const handle: AlienHandle = {
        hitTest(origin, dir) {
          const ndir = dir.clone().normalize()
          let kills = 0
          const HIT_RADIUS = 0.85
          for (const a of aliensRef.current) {
            if (!a.alive) continue
            // Perpendicular distance from alien to the ray.
            const op = a.pos.clone().sub(origin)
            const along = op.dot(ndir)
            if (along < 0) continue // alien is behind the emitter
            const perp = op.clone().sub(ndir.clone().multiplyScalar(along))
            if (perp.length() < HIT_RADIUS) {
              a.alive = false
              kills += 1
            }
          }
          eventsRef.current.kills += kills
          return kills
        },
        spawnWave(count, speedMul) {
          aliensRef.current = []
          for (let i = 0; i < count; i++) {
            aliensRef.current.push(makeAlien(speedMul))
          }
        },
        clear() {
          aliensRef.current = []
        },
        consumeEvents() {
          const out = {
            kills: eventsRef.current.kills,
            leaks: eventsRef.current.leaks,
            aliveCount: aliensRef.current.filter((a) => a.alive).length,
          }
          eventsRef.current.kills = 0
          eventsRef.current.leaks = 0
          return out
        },
      }
      handleRef.current = handle
    }, [handleRef])

    useFrame((state, dt) => {
      if (!groupRef.current) return
      const t = state.clock.elapsedTime
      // Step every alien. Keep meshes 1:1 with the array index so we
      // don't constantly recreate them; visibility is the alive flag.
      for (let i = 0; i < aliensRef.current.length; i++) {
        const a = aliensRef.current[i]
        if (!a.alive) {
          // Drop the mesh out of sight if it still has one.
          const mesh = meshesRef.current.get(i)
          if (mesh) mesh.visible = false
          continue
        }
        if (!active) continue
        // Movement: forward (+z) at speed, with x/y wobble.
        a.pos.z += a.speed * dt
        a.pos.x += Math.sin(t * 0.9 + a.seed) * 0.012 * a.speed
        a.pos.y += Math.cos(t * 0.7 + a.seed * 1.3) * 0.01 * a.speed
        if (a.pos.z > 11) {
          // Leak — past the player toward the planet behind us.
          a.alive = false
          eventsRef.current.leaks += 1
        }
      }
      // Position the rendered meshes.
      for (let i = 0; i < aliensRef.current.length; i++) {
        const a = aliensRef.current[i]
        const mesh = meshesRef.current.get(i)
        if (!mesh) continue
        if (!a.alive) {
          mesh.visible = false
          continue
        }
        mesh.visible = true
        mesh.position.copy(a.pos)
        // Slow yaw spin for menace.
        mesh.rotation.y = t * 1.2 + a.seed
        mesh.rotation.z = Math.sin(t * 1.5 + a.seed) * 0.2
      }
    })

    // Render a fixed pool of 64 meshes; map them to alien slots as
    // we go. Spawning more than 64 in a single wave is unsupported
    // (escalation curve never gets that high).
    const POOL_SIZE = 64
    return (
      <group ref={groupRef}>
        {Array.from({ length: POOL_SIZE }, (_, i) => (
          <AlienMesh
            key={i}
            attach={(o) => {
              if (o) meshesRef.current.set(i, o)
              else meshesRef.current.delete(i)
            }}
          />
        ))}
      </group>
    )
  }
})()

function AlienMesh({ attach }: { attach: (o: Object3D | null) => void }) {
  // TIE-Shuttle-inspired hostile fighter: central spherical cockpit
  // flanked by two flat hexagonal solar panels. Glowing red viewport
  // in the cockpit ball reads as "hostile". Procedural primitives
  // only — no external geometry.
  return (
    <group ref={(o) => attach(o)} visible={false} scale={0.5}>
      {/* Central cockpit ball — the iconic TIE silhouette anchor. */}
      <mesh>
        <sphereGeometry args={[0.32, 16, 16]} />
        <meshStandardMaterial color="#1a1a22" roughness={0.5} metalness={0.7} />
      </mesh>
      {/* Cockpit window — bright red, the "eye" that signals threat. */}
      <mesh position={[0, 0, 0.32]}>
        <sphereGeometry args={[0.18, 12, 12]} />
        <meshStandardMaterial
          color="#3a0808"
          emissive="#ff2a2a"
          emissiveIntensity={2.2}
        />
      </mesh>
      {/* Cockpit-to-panel pylon, left. */}
      <mesh position={[-0.42, 0, 0]}>
        <boxGeometry args={[0.18, 0.08, 0.12]} />
        <meshStandardMaterial color="#0e0e14" roughness={0.6} metalness={0.6} />
      </mesh>
      {/* Cockpit-to-panel pylon, right. */}
      <mesh position={[0.42, 0, 0]}>
        <boxGeometry args={[0.18, 0.08, 0.12]} />
        <meshStandardMaterial color="#0e0e14" roughness={0.6} metalness={0.6} />
      </mesh>
      {/* Left solar panel — hex-flavoured rectangle with a darker
          inner crosshatch (cylinderGeometry with 6 segments gives a
          hex when used flat). */}
      <mesh position={[-0.78, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.55, 0.55, 0.06, 6]} />
        <meshStandardMaterial color="#16161c" roughness={0.55} metalness={0.65} />
      </mesh>
      {/* Right solar panel. */}
      <mesh position={[0.78, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.55, 0.55, 0.06, 6]} />
        <meshStandardMaterial color="#16161c" roughness={0.55} metalness={0.65} />
      </mesh>
      {/* Panel inner detail — slightly raised central plate per panel
          for that "segmented solar array" read. */}
      <mesh position={[-0.78, 0, 0.04]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.32, 0.32, 0.04, 6]} />
        <meshStandardMaterial color="#0a0a10" roughness={0.6} metalness={0.7} />
      </mesh>
      <mesh position={[0.78, 0, 0.04]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.32, 0.32, 0.04, 6]} />
        <meshStandardMaterial color="#0a0a10" roughness={0.6} metalness={0.7} />
      </mesh>
    </group>
  )
}

/* =============================================================
 * Motion debris — parallax sparks streaming past the camera
 * ============================================================= */

const DEBRIS_VERTEX = /* glsl */ `
  attribute vec3 aSeed;
  uniform float uTime;
  uniform float uPixelRatio;
  varying float vBrightness;
  void main() {
    // Forward streaming: z cycles from -40 → +18 over (10 / speed) seconds.
    float speed = 0.8 + aSeed.x * 1.6;
    float cycle = 58.0 / speed;
    float zPhase = mod(uTime + aSeed.y * cycle, cycle) / cycle; // 0..1
    float z = -40.0 + zPhase * 58.0;
    // Lateral position from seed.
    float ang = aSeed.z * 6.2831853;
    float radius = 2.0 + aSeed.x * 9.0;
    vec3 pos = vec3(cos(ang) * radius, sin(ang) * radius * 0.55, z);
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    // Smaller in the distance, bigger up close — gives them motion presence.
    gl_PointSize = (2.0 + zPhase * 6.0) * uPixelRatio;
    vBrightness = 0.4 + zPhase * 0.6;
  }
`
const DEBRIS_FRAGMENT = /* glsl */ `
  varying float vBrightness;
  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float d = length(uv);
    if (d > 0.5) discard;
    float a = (1.0 - smoothstep(0.0, 0.5, d)) * vBrightness * 0.55;
    gl_FragColor = vec4(0.85, 0.9, 1.0, a);
  }
`

function MotionDebris() {
  const matRef = useRef<ShaderMaterial>(null)
  const gl = useThree((s) => s.gl)
  const geometry = useMemo(() => {
    const N = 280
    const seeds = new Float32Array(N * 3)
    for (let i = 0; i < N; i++) {
      seeds[i * 3 + 0] = Math.random() // x.r: radial size
      seeds[i * 3 + 1] = Math.random() // y.g: phase offset
      seeds[i * 3 + 2] = Math.random() // z.b: angular position
    }
    const geo = new BufferGeometry()
    geo.setAttribute("position", new BufferAttribute(new Float32Array(N * 3), 3))
    geo.setAttribute("aSeed", new BufferAttribute(seeds, 3))
    return geo
  }, [])

  useEffect(() => {
    if (matRef.current) {
      matRef.current.uniforms.uPixelRatio.value = gl.getPixelRatio()
    }
  }, [gl])

  useFrame((state) => {
    if (matRef.current)
      matRef.current.uniforms.uTime.value = state.clock.elapsedTime
  })

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={matRef}
        vertexShader={DEBRIS_VERTEX}
        fragmentShader={DEBRIS_FRAGMENT}
        uniforms={{
          uTime: { value: 0 },
          uPixelRatio: { value: 1 },
        }}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  )
}

/* =============================================================
 * Scene contents — orchestrates the whole 3D layer
 * ============================================================= */

function CameraBreath({ aim }: { aim: { x: number; y: number } }) {
  const { camera } = useThree()
  useEffect(() => {
    camera.position.set(0, 0.5, 14)
    camera.lookAt(0, -0.5, 0)
  }, [camera])
  useFrame((state) => {
    const t = state.clock.elapsedTime
    // Subtle sway — keeps the frame alive even when nothing is happening.
    camera.position.x = Math.sin(t * 0.32) * 0.18 + aim.x * 0.5
    camera.position.y = 0.5 + Math.sin(t * 0.27) * 0.12 + aim.y * 0.3
    camera.lookAt(aim.x * 1.6, -0.5 + aim.y * 1.0, 0)
  })
  return null
}

export function SceneContents({
  state,
  aimWorldDirRef,
  alienHandleRef,
}: {
  state: GameState
  aimWorldDirRef: React.MutableRefObject<Vector3>
  alienHandleRef: React.MutableRefObject<AlienHandle | null>
}) {
  const world = WORLDS[state.worldIndex]
  const emitterRef = useRef<Mesh>(null)

  return (
    <>
      <ambientLight intensity={0.22} />
      <directionalLight position={[5, 4, 7]} intensity={1.1} />
      <BrightStarField />

      <DefendedPlanet world={world} />

      {/* Alien capital ship — looming in the deep background near
          the defended planet. Doesn't engage; it's the source the
          fighters spawn from + the silent presence behind everything. */}
      <VenatorMothership />

      <MotionDebris />

      <AlienSwarm
        handleRef={alienHandleRef}
        active={isCombatActive(state.phase)}
      />

      <CleaverShip
        charge={state.charge}
        firing={state.phase === "firing"}
        aim={state.aim}
        emitterRef={emitterRef}
      />

      <Beam
        visible={state.phase === "firing"}
        aimWorldDir={aimWorldDirRef.current}
        emitterRef={emitterRef}
      />

      <CameraBreath aim={state.aim} />
    </>
  )
}

/* =============================================================
 * Canvas wrapper
 * ============================================================= */

export function StarCleaverScene(props: {
  state: GameState
  aimWorldDirRef: React.MutableRefObject<Vector3>
  alienHandleRef: React.MutableRefObject<AlienHandle | null>
}) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ fov: 55, near: 0.1, far: 500, position: [0, 0.5, 14] }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      <SceneContents {...props} />
    </Canvas>
  )
}

/* =============================================================
 * Aim helper
 * ============================================================= */

/**
 * Map a normalized aim point (-1..1 each axis, where (0,0) is the
 * screen centre) into a world-space unit vector relative to the
 * player ship's emitter — i.e. the direction the beam travels.
 *
 * The screen is the camera's image plane; the aim point on that
 * plane corresponds to a world direction at the camera's near
 * plane. We approximate by mapping x → world+X, y → world+Y, with
 * z = -1 (forward into depth, where the aliens are). This is a
 * cheap parallel projection that's accurate enough for the
 * combat range — the beam appears to track the reticle exactly.
 */
export function aimToWorldDir(aim: { x: number; y: number }): Vector3 {
  // Aim half-FOV ≈ 30 degrees → tan(30°) ≈ 0.577.
  const k = 0.6
  return new Vector3(aim.x * k, aim.y * k, -1).normalize()
}

export { WORLDS }
