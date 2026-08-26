"use client"

// An interactive 3D Rubik's Cube in WebGL (React Three Fiber) — the modern
// counterpart to the 2011 OpenGL project this page is about. Same fundamentals:
// 27 cubies positioned by translation, a face "turn" is the nine cubies sharing a
// coordinate on one axis, rotated about that axis and then re-snapped so the model's
// state genuinely updates (not just the picture). No solver — this is the graphics
// exercise, made touchable.

import { useRef, useState, useCallback, useMemo, useEffect } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { OrbitControls, RoundedBox } from "@react-three/drei"
import * as THREE from "three"

// classic Rubik sticker colours (slightly desaturated so they read on a dark page)
const FACE = {
  R: "#c62828", // +x  right   red
  L: "#ef6c00", // -x  left    orange
  U: "#f5f5f5", // +y  up      white
  D: "#fdd835", // -y  down    yellow
  F: "#2e7d32", // +z  front   green
  B: "#1565c0", // -z  back    blue
}
const PLASTIC = "#0c0d12"

type Axis = "x" | "y" | "z"
type Cubie = { id: number; pos: [number, number, number]; quat: THREE.Quaternion }

// the six moves, each = (axis, the layer coordinate, direction)
const MOVES: Record<string, { axis: Axis; layer: number; dir: 1 | -1 }> = {
  R: { axis: "x", layer: 1, dir: -1 }, "R'": { axis: "x", layer: 1, dir: 1 },
  L: { axis: "x", layer: -1, dir: 1 }, "L'": { axis: "x", layer: -1, dir: -1 },
  U: { axis: "y", layer: 1, dir: -1 }, "U'": { axis: "y", layer: 1, dir: 1 },
  D: { axis: "y", layer: -1, dir: 1 }, "D'": { axis: "y", layer: -1, dir: -1 },
  F: { axis: "z", layer: 1, dir: -1 }, "F'": { axis: "z", layer: 1, dir: 1 },
  B: { axis: "z", layer: -1, dir: 1 }, "B'": { axis: "z", layer: -1, dir: -1 },
}

function initialCubies(): Cubie[] {
  const c: Cubie[] = []
  let id = 0
  for (let x = -1; x <= 1; x++)
    for (let y = -1; y <= 1; y++)
      for (let z = -1; z <= 1; z++)
        c.push({ id: id++, pos: [x, y, z], quat: new THREE.Quaternion() })
  return c
}

/** One cubie: a rounded black cube with coloured stickers only on outward faces. */
function CubieMesh({ cubie }: { cubie: Cubie }) {
  const [x, y, z] = cubie.pos
  // a sticker is a thin coloured plane sitting just proud of each outward face
  const stickers: { color: string; position: [number, number, number]; rotation: [number, number, number] }[] = []
  const g = 0.505
  if (x === 1) stickers.push({ color: FACE.R, position: [g, 0, 0], rotation: [0, Math.PI / 2, 0] })
  if (x === -1) stickers.push({ color: FACE.L, position: [-g, 0, 0], rotation: [0, -Math.PI / 2, 0] })
  if (y === 1) stickers.push({ color: FACE.U, position: [0, g, 0], rotation: [-Math.PI / 2, 0, 0] })
  if (y === -1) stickers.push({ color: FACE.D, position: [0, -g, 0], rotation: [Math.PI / 2, 0, 0] })
  if (z === 1) stickers.push({ color: FACE.F, position: [0, 0, g], rotation: [0, 0, 0] })
  if (z === -1) stickers.push({ color: FACE.B, position: [0, 0, -g], rotation: [0, Math.PI, 0] })

  return (
    <group>
      <RoundedBox args={[0.98, 0.98, 0.98]} radius={0.08} smoothness={4}>
        <meshStandardMaterial color={PLASTIC} roughness={0.55} metalness={0.15} />
      </RoundedBox>
      {stickers.map((s, i) => (
        <mesh key={i} position={s.position} rotation={s.rotation}>
          <planeGeometry args={[0.82, 0.82]} />
          <meshStandardMaterial color={s.color} roughness={0.35} metalness={0.05} side={THREE.FrontSide} />
        </mesh>
      ))}
    </group>
  )
}

/** The whole cube: holds cubie state, animates a turn, then re-snaps the model. */
function CubeScene({
  cubies, setCubies, turning, onTurnDone,
}: {
  cubies: Cubie[]
  setCubies: (c: Cubie[]) => void
  turning: { move: string } | null
  onTurnDone: () => void
}) {
  const pivot = useRef<THREE.Group>(null!)
  const still = useRef<THREE.Group>(null!)
  const progress = useRef(0)
  // which cubie ids are in the turning layer + the target angle
  const turnData = useRef<{ ids: Set<number>; axis: Axis; angle: number } | null>(null)

  // when a turn begins, split cubies into the moving layer (pivot) and the rest
  useEffect(() => {
    if (!turning) { turnData.current = null; return }
    const m = MOVES[turning.move]
    const ids = new Set<number>()
    cubies.forEach((c) => { if (Math.round(c.pos[m.axis === "x" ? 0 : m.axis === "y" ? 1 : 2]) === m.layer) ids.add(c.id) })
    turnData.current = { ids, axis: m.axis, angle: (Math.PI / 2) * m.dir }
    progress.current = 0
    if (pivot.current) pivot.current.rotation.set(0, 0, 0)
  }, [turning, cubies])

  useFrame((_, dt) => {
    const td = turnData.current
    if (!td || !pivot.current) return
    const step = Math.min(1, progress.current + dt * 3.2) // ~0.3s per quarter-turn
    progress.current = step
    const a = td.angle * ease(step)
    pivot.current.rotation[td.axis] = a
    if (step >= 1) {
      // bake the rotation into each moving cubie's position + quaternion, then reset
      const rot = new THREE.Quaternion().setFromAxisAngle(AXIS[td.axis], td.angle)
      const next = cubies.map((c) => {
        if (!td.ids.has(c.id)) return c
        const v = new THREE.Vector3(...c.pos).applyQuaternion(rot)
        const q = rot.clone().multiply(c.quat)
        return { ...c, pos: [Math.round(v.x), Math.round(v.y), Math.round(v.z)] as [number, number, number], quat: q }
      })
      turnData.current = null
      setCubies(next)
      onTurnDone()
    }
  })

  const td = turnData.current
  return (
    <group>
      <group ref={pivot}>
        {cubies.filter((c) => td?.ids.has(c.id)).map((c) => (
          <group key={c.id} position={c.pos} quaternion={c.quat}><CubieMesh cubie={c} /></group>
        ))}
      </group>
      <group ref={still}>
        {cubies.filter((c) => !td?.ids.has(c.id)).map((c) => (
          <group key={c.id} position={c.pos} quaternion={c.quat}><CubieMesh cubie={c} /></group>
        ))}
      </group>
    </group>
  )
}

const AXIS = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) }
const ease = (t: number) => 1 - Math.pow(1 - t, 3) // easeOutCubic — a turn that reads as a turn

/** Is the cube solved? Every cubie back at its start orientation (identity quat)
 *  AND home position — i.e. each face shows a single colour. */
function isSolved(cubies: Cubie[]): boolean {
  return cubies.every((c) => {
    const q = c.quat
    // identity quaternion (within a small epsilon) means the cubie hasn't twisted
    return Math.abs(q.x) < 1e-4 && Math.abs(q.y) < 1e-4 && Math.abs(q.z) < 1e-4 && Math.abs(Math.abs(q.w) - 1) < 1e-4
  })
}

/** The public component: the canvas + a clean control strip. */
export function RubikCube() {
  const [cubies, setCubies] = useState<Cubie[]>(initialCubies)
  const [queue, setQueue] = useState<string[]>([])
  const [turning, setTurning] = useState<{ move: string } | null>(null)
  const [moves, setMoves] = useState(0)
  const [scrambled, setScrambled] = useState(false)

  // drain the queue one move at a time
  useEffect(() => {
    if (!turning && queue.length) {
      setTurning({ move: queue[0] })
      setQueue((q) => q.slice(1))
    }
  }, [turning, queue])

  const enqueue = useCallback((...moves: string[]) => setQueue((q) => [...q, ...moves]), [])
  const onTurnDone = useCallback(() => { setTurning(null); setMoves((m) => m + 1) }, [])

  const scramble = useCallback(() => {
    const keys = Object.keys(MOVES)
    const seq = Array.from({ length: 20 }, () => keys[Math.floor(Math.random() * keys.length)])
    setScrambled(true); setMoves(0)
    enqueue(...seq)
  }, [enqueue])

  const reset = useCallback(() => {
    setQueue([]); setTurning(null); setCubies(initialCubies()); setMoves(0); setScrambled(false)
  }, [])

  // keyboard: U/D/L/R/F/B turn a face; hold Shift for the counter-clockwise (inverse)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toUpperCase()
      if (!"UDLRFB".includes(k)) return
      // ignore when the user is typing in a field
      const el = document.activeElement
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return
      enqueue(e.shiftKey ? k + "'" : k)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [enqueue])

  const solved = scrambled && queue.length === 0 && !turning && isSolved(cubies)
  const faceButtons: [string, string][] = [["U", "U"], ["D", "D"], ["L", "L"], ["R", "R"], ["F", "F"], ["B", "B"]]

  return (
    <div className="w-full">
      <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] rounded-2xl overflow-hidden border border-border bg-gradient-to-b from-[#0a0b12] to-[#05060a]">
        <Canvas camera={{ position: [4.2, 4, 5.4], fov: 40 }} dpr={[1, 2]}>
          <ambientLight intensity={0.7} />
          <directionalLight position={[6, 8, 5]} intensity={1.1} />
          <directionalLight position={[-5, -3, -4]} intensity={0.35} />
          <CubeScene cubies={cubies} setCubies={setCubies} turning={turning} onTurnDone={onTurnDone} />
          <OrbitControls enablePan={false} minDistance={5} maxDistance={12} enableDamping dampingFactor={0.08} />
        </Canvas>
        <div className="pointer-events-none absolute left-3 top-3 font-mono text-[10px] tracking-widest uppercase text-white/40">
          drag to orbit · keys U D L R F B (⇧ inverse)
        </div>
        {(scrambled || moves > 0) && (
          <div className="pointer-events-none absolute right-3 top-3 font-mono text-[11px] text-white/55">
            {moves} {moves === 1 ? "move" : "moves"}
          </div>
        )}
        {solved && (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
            <span className="rounded-full border border-emerald-400/40 bg-emerald-400/15 px-4 py-1.5 font-mono text-sm text-emerald-200 backdrop-blur">
              ✓ solved in {moves} moves
            </span>
          </div>
        )}
      </div>

      {/* the control strip — face turns, then their inverses, then scramble/reset */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {faceButtons.map(([label, mv]) => (
          <div key={mv} className="inline-flex overflow-hidden rounded-lg border border-border">
            <button
              onClick={() => enqueue(mv)}
              className="px-3 py-2 font-mono text-sm text-foreground/85 hover:bg-accent/15 hover:text-foreground transition-colors"
              aria-label={`Turn ${label} face clockwise`}
            >{label}</button>
            <button
              onClick={() => enqueue(mv + "'")}
              className="px-2 py-2 font-mono text-xs text-foreground/55 border-l border-border hover:bg-accent/15 hover:text-foreground transition-colors"
              aria-label={`Turn ${label} face counter-clockwise`}
            >′</button>
          </div>
        ))}
        <div className="mx-1 h-6 w-px bg-border" />
        <button onClick={scramble} className="px-4 py-2 rounded-lg border border-border font-mono text-sm text-foreground/85 hover:bg-accent/15 hover:text-foreground transition-colors">
          Scramble
        </button>
        <button onClick={reset} className="px-4 py-2 rounded-lg border border-border font-mono text-sm text-foreground/60 hover:bg-accent/15 hover:text-foreground transition-colors">
          Reset
        </button>
      </div>
      <p className="mt-3 font-sans text-[13px] leading-relaxed text-foreground/50">
        Each letter is a face turn (U/D/L/R/F/B); the small ′ is the counter-clockwise
        version. A turn rotates the nine cubies sharing a coordinate on one axis, then
        re-snaps the model — the same maths the original OpenGL project worked out by hand,
        now in WebGL.
      </p>
    </div>
  )
}
