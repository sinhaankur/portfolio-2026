"use client"

/**
 * MirofishDashboardScene — a WebGL (R3F) recreation of the Mirofish trading
 * terminal shown in the project's screenshots: a probability-lattice scatter,
 * a tail-probability ridgeline, and a relationship-graph force simulation.
 *
 * Data-driven from content/mirofish-dashboard.json (see MirofishDashboard).
 * While `sampleData` is true the series are generated placeholders — labelled
 * as such in the UI — so nothing reads as a real trading claim. Swap in real
 * export values (same schema) and every panel updates.
 *
 * This is the heavy module; the page lazy-loads it via next/dynamic with a
 * static fallback so it never blocks first paint (mirrors the Universe Engine).
 */

import { useMemo, useRef } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import * as THREE from "three"
import type { MirofishDashboard } from "@/lib/mirofish"

// Palette — pulled from the site tokens (accent green + ink) so the terminal
// reads as part of the portfolio, not a foreign embed.
const ACCENT = new THREE.Color("#7dd3a8")
const ACCENT_DIM = new THREE.Color("#3f6b54")
const WARM = new THREE.Color("#f0b86c")
const PINK = new THREE.Color("#f06c8d")
const INK = new THREE.Color("#0b0e0d")

/* -------------------------------------------------------------------------- */
/* Panel 1 — Probability Lattice (instanced scatter board)                    */
/* -------------------------------------------------------------------------- */

function ProbabilityLattice({ points }: { points: MirofishDashboard["probabilityLattice"]["points"] }) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const phases = useMemo(
    () => points.map((_, i) => (i * 12.9898) % (Math.PI * 2)),
    [points],
  )

  // Map normalized [0,1] coords onto an 8×5 board centred at origin.
  const W = 8
  const H = 5
  const positions = useMemo(
    () => points.map((p) => ({ x: (p.x - 0.5) * W, y: (p.y - 0.5) * H, w: p.w })),
    [points],
  )

  useFrame(({ clock }) => {
    const mesh = meshRef.current
    if (!mesh) return
    const t = clock.getElapsedTime()
    for (let i = 0; i < positions.length; i++) {
      const p = positions[i]
      const float = Math.sin(t * 0.8 + phases[i]) * 0.04
      dummy.position.set(p.x, p.y + float, 0)
      const s = 0.03 + p.w * 0.07
      dummy.scale.setScalar(s)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      const c = ACCENT.clone().lerp(WARM, 1 - p.w)
      mesh.setColorAt(i, c)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })

  return (
    <group position={[-5.2, 2.2, 0]}>
      <PanelFrame w={W} h={H} />
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, positions.length]}
      >
        <circleGeometry args={[1, 12]} />
        <meshBasicMaterial transparent opacity={0.85} toneMapped={false} />
      </instancedMesh>
    </group>
  )
}

/* -------------------------------------------------------------------------- */
/* Panel 2 — Tail Probability Ridge (animated ridgeline)                      */
/* -------------------------------------------------------------------------- */

function TailRidge({ rows }: { rows: number[][] }) {
  const groupRef = useRef<THREE.Group>(null)
  const W = 8
  const DEPTH = 4.5
  const rowCount = rows.length
  const colCount = rows[0]?.length ?? 0

  // One line per ridge row; we rebuild geometry each frame for a gentle shimmer.
  const lines = useMemo(() => {
    return rows.map((row, r) => {
      const geom = new THREE.BufferGeometry()
      const pos = new Float32Array(colCount * 3)
      geom.setAttribute("position", new THREE.BufferAttribute(pos, 3))
      const t = r / Math.max(1, rowCount - 1)
      const mat = new THREE.LineBasicMaterial({
        color: ACCENT_DIM.clone().lerp(ACCENT, t),
        transparent: true,
        opacity: 0.35 + 0.5 * t,
        toneMapped: false,
      })
      return { geom, mat, row, r }
    })
  }, [rows, colCount, rowCount])

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime()
    for (const { geom, row, r } of lines) {
      const pos = geom.getAttribute("position") as THREE.BufferAttribute
      const z = (r / Math.max(1, rowCount - 1) - 0.5) * DEPTH
      for (let c = 0; c < colCount; c++) {
        const x = (c / Math.max(1, colCount - 1) - 0.5) * W
        const shimmer = 1 + 0.06 * Math.sin(time * 1.2 + c * 0.3 + r * 0.5)
        const y = row[c] * 1.8 * shimmer
        pos.setXYZ(c, x, y, z)
      }
      pos.needsUpdate = true
      geom.computeBoundingSphere()
    }
  })

  return (
    <group ref={groupRef} position={[4.6, 1.6, 0]} rotation={[-0.5, 0, 0]}>
      {lines.map(({ geom, mat, r }) => (
        <primitive key={r} object={new THREE.Line(geom, mat)} />
      ))}
    </group>
  )
}

/* -------------------------------------------------------------------------- */
/* Panel 3 — Relationship Graph (force-directed network)                      */
/* -------------------------------------------------------------------------- */

type SimNode = {
  id: string
  group: number
  size: number
  x: number
  y: number
  vx: number
  vy: number
}

function RelationshipGraph({
  nodes,
  edges,
}: {
  nodes: MirofishDashboard["relationshipGraph"]["nodes"]
  edges: MirofishDashboard["relationshipGraph"]["edges"]
}) {
  const nodeMeshRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  // Seeded init so the layout is stable between reloads before it settles.
  const sim = useMemo<SimNode[]>(() => {
    let seed = 99
    const r = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      return seed / 0x7fffffff
    }
    return nodes.map((n) => ({
      ...n,
      x: (r() - 0.5) * 5,
      y: (r() - 0.5) * 4,
      vx: 0,
      vy: 0,
    }))
  }, [nodes])

  const index = useMemo(() => {
    const m = new Map<string, SimNode>()
    sim.forEach((n) => m.set(n.id, n))
    return m
  }, [sim])

  const edgeLines = useMemo(
    () =>
      edges
        .map((e) => ({ a: index.get(e.source), b: index.get(e.target), w: e.weight }))
        .filter((e) => e.a && e.b) as { a: SimNode; b: SimNode; w: number }[],
    [edges, index],
  )

  const edgeGeom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(edgeLines.length * 6), 3),
    )
    return g
  }, [edgeLines])

  useFrame(() => {
    // One relaxation step per frame — classic repulsion + spring layout.
    const REPULSE = 1.4
    const SPRING = 0.02
    const CENTER = 0.012
    const DAMP = 0.86

    for (let i = 0; i < sim.length; i++) {
      const a = sim[i]
      for (let j = i + 1; j < sim.length; j++) {
        const b = sim[j]
        const dx = a.x - b.x
        const dy = a.y - b.y
        const d2 = dx * dx + dy * dy + 0.01
        const f = REPULSE / d2
        const d = Math.sqrt(d2)
        const fx = (dx / d) * f
        const fy = (dy / d) * f
        a.vx += fx
        a.vy += fy
        b.vx -= fx
        b.vy -= fy
      }
      a.vx -= a.x * CENTER
      a.vy -= a.y * CENTER
    }
    for (const e of edgeLines) {
      const dx = e.b.x - e.a.x
      const dy = e.b.y - e.a.y
      const f = SPRING * e.w
      e.a.vx += dx * f
      e.a.vy += dy * f
      e.b.vx -= dx * f
      e.b.vy -= dy * f
    }
    for (const n of sim) {
      n.vx *= DAMP
      n.vy *= DAMP
      n.x += n.vx * 0.5
      n.y += n.vy * 0.5
    }

    // nodes
    const mesh = nodeMeshRef.current
    if (mesh) {
      for (let i = 0; i < sim.length; i++) {
        const n = sim[i]
        dummy.position.set(n.x, n.y, 0)
        dummy.scale.setScalar(0.12 + n.size * 0.12)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
        mesh.setColorAt(i, n.group === 2 ? WARM : ACCENT)
      }
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }
    // edges
    const pos = edgeGeom.getAttribute("position") as THREE.BufferAttribute
    edgeLines.forEach((e, i) => {
      pos.setXYZ(i * 2, e.a.x, e.a.y, -0.05)
      pos.setXYZ(i * 2 + 1, e.b.x, e.b.y, -0.05)
    })
    pos.needsUpdate = true
  })

  return (
    <group position={[-1.4, -3.4, 0]}>
      <lineSegments>
        <primitive object={edgeGeom} attach="geometry" />
        <lineBasicMaterial color={ACCENT_DIM} transparent opacity={0.4} toneMapped={false} />
      </lineSegments>
      <instancedMesh ref={nodeMeshRef} args={[undefined, undefined, sim.length]}>
        <circleGeometry args={[1, 18]} />
        <meshBasicMaterial transparent opacity={0.95} toneMapped={false} />
      </instancedMesh>
    </group>
  )
}

/* -------------------------------------------------------------------------- */
/* Shared — a thin panel frame                                                */
/* -------------------------------------------------------------------------- */

function PanelFrame({ w, h }: { w: number; h: number }) {
  const geom = useMemo(() => {
    const hw = w / 2
    const hh = h / 2
    const pts = [
      new THREE.Vector3(-hw, -hh, -0.1),
      new THREE.Vector3(hw, -hh, -0.1),
      new THREE.Vector3(hw, hh, -0.1),
      new THREE.Vector3(-hw, hh, -0.1),
      new THREE.Vector3(-hw, -hh, -0.1),
    ]
    return new THREE.BufferGeometry().setFromPoints(pts)
  }, [w, h])
  return (
    <primitive
      object={new THREE.Line(geom, new THREE.LineBasicMaterial({ color: ACCENT_DIM, transparent: true, opacity: 0.25, toneMapped: false }))}
    />
  )
}

/* -------------------------------------------------------------------------- */
/* Scene + slow auto-orbit                                                     */
/* -------------------------------------------------------------------------- */

function SceneContents({ data }: { data: MirofishDashboard }) {
  const root = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (root.current) {
      // a very slight parallax sway — not a full spin, keeps the terminal legible
      root.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.15) * 0.12
      root.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.1) * 0.05
    }
  })
  return (
    <group ref={root}>
      <ProbabilityLattice points={data.probabilityLattice.points} />
      <TailRidge rows={data.tailRidge.rows} />
      <RelationshipGraph
        nodes={data.relationshipGraph.nodes}
        edges={data.relationshipGraph.edges}
      />
    </group>
  )
}

export default function MirofishDashboardScene({ data }: { data: MirofishDashboard }) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 14], fov: 42 }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: "transparent" }}
      onCreated={({ scene }) => {
        scene.fog = new THREE.Fog(INK, 16, 28)
      }}
    >
      <SceneContents data={data} />
    </Canvas>
  )
}
