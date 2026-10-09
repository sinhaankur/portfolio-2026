"use client"

// The HUD-prism Vera form — the faceted inner mesh.
//
// An inverted triangular prism (a "Tet", after Oblivion) whose facets carry
// Vera's living iridescent palette (pink / purple / blue / cyan / orange) instead
// of cold metal — the bridge between the warm orb and the sharp Tet. It turns
// slowly and catches light on its faces; phase drives its speed + glow so it still
// visibly LISTENS, THINKS, SPEAKS.

import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

export type TetPhase = "idle" | "listening" | "thinking" | "speaking"

// Vera's palette, as the orb uses it — the facets are tinted from these so the
// two forms read as the same being.
const PALETTE = [
  new THREE.Color("#ff4590"), // pink
  new THREE.Color("#9e4dff"), // purple
  new THREE.Color("#3385ff"), // blue
  new THREE.Color("#2ed9f2"), // cyan
  new THREE.Color("#ff9e33"), // orange
  new THREE.Color("#ff5ec4"), // magenta
]

const PHASE_SPEED: Record<TetPhase, number> = {
  idle: 0.22,
  listening: 0.34,
  thinking: 0.5,
  speaking: 0.75,
}
const PHASE_EMISSIVE: Record<TetPhase, number> = {
  idle: 0.24,
  listening: 0.34,
  thinking: 0.46,
  speaking: 0.62,
}

/**
 * Build an inverted triangular prism and give each of its faces a vertex-colour
 * from Vera's palette, so the solid reads as faceted + iridescent (not flat).
 */
function useTetGeometry() {
  return useMemo(() => {
    // a triangular prism: top triangle (wide), bottom triangle (point down).
    // We author it as two triangular caps + three side quads, inverted (apex down).
    const r = 1.0 // top radius
    const h = 1.35 // height
    const topY = h * 0.42
    const botY = -h * 0.58
    const apexInset = 0.14 // bottom triangle is smaller → tapers to a near-point

    // triangle corner angles (pointing so one flat face is toward camera)
    const ang = [Math.PI / 2, Math.PI / 2 + (2 * Math.PI) / 3, Math.PI / 2 + (4 * Math.PI) / 3]
    const top = ang.map((a) => new THREE.Vector3(Math.cos(a) * r, topY, Math.sin(a) * r))
    const bot = ang.map((a) => new THREE.Vector3(Math.cos(a) * r * apexInset, botY, Math.sin(a) * r * apexInset))

    const positions: number[] = []
    const colors: number[] = []
    let faceIndex = 0
    const pushTri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
      const col = PALETTE[faceIndex % PALETTE.length]
      for (const v of [a, b, c]) {
        positions.push(v.x, v.y, v.z)
        colors.push(col.r, col.g, col.b)
      }
      faceIndex++
    }

    // top cap
    pushTri(top[0], top[1], top[2])
    // three side faces (each a quad → 2 tris, same colour so the facet is one plane)
    for (let i = 0; i < 3; i++) {
      const j = (i + 1) % 3
      const col = PALETTE[(faceIndex) % PALETTE.length]
      const quad = [top[i], top[j], bot[j], bot[i]]
      const tris = [
        [quad[0], quad[1], quad[2]],
        [quad[0], quad[2], quad[3]],
      ]
      for (const t of tris) {
        for (const v of t) {
          positions.push(v.x, v.y, v.z)
          colors.push(col.r, col.g, col.b)
        }
      }
      faceIndex++
    }
    // bottom cap (the point)
    pushTri(bot[2], bot[1], bot[0])

    const geo = new THREE.BufferGeometry()
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3))
    geo.computeVertexNormals()
    return geo
  }, [])
}

export function TetMesh({ phase = "idle" }: { phase?: TetPhase }) {
  const group = useRef<THREE.Group>(null)
  const mat = useRef<THREE.MeshStandardMaterial>(null)
  const geo = useTetGeometry()

  // smoothed targets so phase changes ease rather than snap
  const speed = useRef(PHASE_SPEED.idle)
  const emissive = useRef(PHASE_EMISSIVE.idle)

  useFrame((_, dt) => {
    const d = Math.min(dt, 0.05)
    speed.current += (PHASE_SPEED[phase] - speed.current) * Math.min(1, d * 3)
    emissive.current += (PHASE_EMISSIVE[phase] - emissive.current) * Math.min(1, d * 3)
    if (group.current) {
      group.current.rotation.y += speed.current * d
      // a gentle tumble + breathing bob
      group.current.rotation.x = Math.sin(performance.now() * 0.0004) * 0.12
      const bob = 1 + Math.sin(performance.now() * 0.0012) * 0.02
      group.current.scale.setScalar(bob)
    }
    if (mat.current) {
      mat.current.emissiveIntensity = emissive.current
    }
  })

  return (
    <group ref={group}>
      <mesh geometry={geo} castShadow>
        {/* emissive is driven by the VERTEX COLOURS (emissiveVertexColors-style via
            the colour attribute + a coloured emissive map substitute): we keep the
            base emissive subtle and let the lit vertex colours carry Vera's palette,
            so facets stay iridescent + catch light instead of blowing out to white. */}
        <meshStandardMaterial
          ref={mat}
          vertexColors
          emissive={"#6a5acf"}
          emissiveIntensity={0.28}
          metalness={0.5}
          roughness={0.22}
          flatShading
          toneMapped={false}
        />
      </mesh>
      {/* a faint wire over the facets to read the edges, like the poster's crisp lines */}
      <lineSegments>
        <edgesGeometry args={[geo, 1]} />
        <lineBasicMaterial color={"#ffffff"} transparent opacity={0.22} toneMapped={false} />
      </lineSegments>
    </group>
  )
}
