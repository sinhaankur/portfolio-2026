"use client"

/**
 * DnaHelix — an animated 3D double helix driven by the decrypted genome
 * summary. Each rung is one sampled base pair; the two backbone strands are
 * instanced spheres on a phase-shifted sinusoid. Colour encodes the nucleotide
 * (A/C/G/T). Heterozygous pairs (two different letters) get a subtle highlight
 * so the texture along the strand reflects real variation.
 *
 * Feel target: the smooth, reverent motion of the Universe Engine — slow
 * auto-rotation, soft additive glow, no jitter.
 */

import { useMemo, useRef } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import * as THREE from "three"
import type { DnaSummary } from "@/lib/dna-crypto"

// Nucleotide palette — warm/cool split so pairs read at a glance.
const BASE_COLOR: Record<string, string> = {
  A: "#f5b942", // amber
  C: "#4ad6c4", // teal
  G: "#7c6cf0", // violet
  T: "#f06c8d", // rose
  N: "#5a5a6a", // no-call grey
}

function colorFor(letter: string): THREE.Color {
  return new THREE.Color(BASE_COLOR[letter] ?? BASE_COLOR.N)
}

type HelixProps = { sample: { c: string; g: string }[] }

function HelixGeometry({ sample }: HelixProps) {
  const group = useRef<THREE.Group>(null)

  const RADIUS = 2.2
  const TURNS = 6
  const VERTICAL = 14
  const n = sample.length

  // Precompute per-rung geometry + colours once.
  const rungs = useMemo(() => {
    return sample.map((bp, i) => {
      const t = n > 1 ? i / (n - 1) : 0
      const angle = t * Math.PI * 2 * TURNS
      const y = (t - 0.5) * VERTICAL
      const xA = Math.cos(angle) * RADIUS
      const zA = Math.sin(angle) * RADIUS
      const xB = Math.cos(angle + Math.PI) * RADIUS
      const zB = Math.sin(angle + Math.PI) * RADIUS
      const a = bp.g[0] ?? "N"
      const b = bp.g[1] ?? "N"
      return {
        a: new THREE.Vector3(xA, y, zA),
        b: new THREE.Vector3(xB, y, zB),
        colorA: colorFor(a),
        colorB: colorFor(b),
        hetero: a !== b,
      }
    })
  }, [sample, n])

  // Two instanced backbones (sphere per rung end) + instanced rung cylinders.
  const backboneA = useRef<THREE.InstancedMesh>(null)
  const backboneB = useRef<THREE.InstancedMesh>(null)
  const rungMesh = useRef<THREE.InstancedMesh>(null)

  useFrame((_, delta) => {
    if (group.current) {
      group.current.rotation.y += delta * 0.18
    }
  })

  // Imperatively fill instances on first render.
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const filled = useRef(false)
  useFrame(() => {
    if (filled.current) return
    if (!backboneA.current || !backboneB.current || !rungMesh.current) return

    rungs.forEach((r, i) => {
      // backbone A sphere
      dummy.position.copy(r.a)
      dummy.scale.setScalar(0.16)
      dummy.updateMatrix()
      backboneA.current!.setMatrixAt(i, dummy.matrix)
      backboneA.current!.setColorAt(i, r.colorA)

      // backbone B sphere
      dummy.position.copy(r.b)
      dummy.scale.setScalar(0.16)
      dummy.updateMatrix()
      backboneB.current!.setMatrixAt(i, dummy.matrix)
      backboneB.current!.setColorAt(i, r.colorB)

      // rung cylinder between a and b
      const mid = r.a.clone().add(r.b).multiplyScalar(0.5)
      const dir = r.b.clone().sub(r.a)
      const len = dir.length()
      dummy.position.copy(mid)
      dummy.scale.set(r.hetero ? 0.05 : 0.035, len, r.hetero ? 0.05 : 0.035)
      dummy.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        dir.clone().normalize(),
      )
      dummy.updateMatrix()
      rungMesh.current!.setMatrixAt(i, dummy.matrix)
      // rung colour = blend of the two ends
      rungMesh.current!.setColorAt(
        i,
        r.colorA.clone().lerp(r.colorB, 0.5),
      )
    })

    backboneA.current.instanceMatrix.needsUpdate = true
    backboneB.current.instanceMatrix.needsUpdate = true
    rungMesh.current.instanceMatrix.needsUpdate = true
    if (backboneA.current.instanceColor) backboneA.current.instanceColor.needsUpdate = true
    if (backboneB.current.instanceColor) backboneB.current.instanceColor.needsUpdate = true
    if (rungMesh.current.instanceColor) rungMesh.current.instanceColor.needsUpdate = true
    filled.current = true
  })

  return (
    <group ref={group}>
      <instancedMesh ref={backboneA} args={[undefined, undefined, n]}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshStandardMaterial roughness={0.35} metalness={0.1} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={backboneB} args={[undefined, undefined, n]}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshStandardMaterial roughness={0.35} metalness={0.1} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={rungMesh} args={[undefined, undefined, n]}>
        <cylinderGeometry args={[1, 1, 1, 6]} />
        <meshStandardMaterial transparent opacity={0.85} roughness={0.4} toneMapped={false} />
      </instancedMesh>
    </group>
  )
}

export function DnaHelix({ sample }: HelixProps) {
  return (
    <Canvas
      camera={{ position: [0, 0, 13], fov: 50 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true }}
      className="touch-none"
    >
      <ambientLight intensity={0.7} />
      <pointLight position={[10, 10, 10]} intensity={120} />
      <pointLight position={[-10, -6, -8]} intensity={60} color="#7c6cf0" />
      <HelixGeometry sample={sample} />
    </Canvas>
  )
}
