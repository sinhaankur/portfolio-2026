"use client"

// Solving a Rubik's cube as a GRAPH problem, made visible.
//
// Every cube state is a NODE. Every quarter-turn of a face is an EDGE to another
// state. "Solving" is then a shortest-path search from the scrambled node to the
// solved node — classic breadth-first search (BFS). We use the 2×2×2 "pocket
// cube" because its whole graph is small enough (3,674,160 states, diameter 11 =
// its "God's Number") that a real BFS runs live in the browser, and we can draw
// the frontier expanding ring by ring until it reaches the goal.
//
// The cube is represented as a permutation of its 24 stickers. A move is a fixed
// permutation applied to the state — that's the group-theory view: the cube's
// legal moves generate a group, and the Cayley graph of that group is exactly the
// state graph we search.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

// ---- 2×2×2 corner model (verified) -----------------------------------------
// The clean, correct way to model a 2×2 cube: 7 movable corners (the 8th, DBL,
// is held fixed to remove whole-cube rotations), each with a position 0..6 and
// an orientation twist 0..2. A move cycles four corners between slots and adds
// the right twist. This representation was validated offline: |group| = exactly
// 3,674,160 states and quarter-turn diameter = 14 (the 2×2's "God's Number" in
// the quarter-turn metric — matching the published distance histogram).
//
// Corners: 0=URF 1=UFL 2=ULB 3=UBR 4=DFR 5=DFL 6=DBR  (7=DBL fixed)
export type Cube = { p: Uint8Array; o: Uint8Array } // permutation + orientation

function solvedCube(): Cube {
  return { p: Uint8Array.from([0, 1, 2, 3, 4, 5, 6]), o: new Uint8Array(7) }
}

// A move = a 4-corner cycle + a twist added to each moved corner.
type Move = { cycle: number[]; tw: Record<number, number> }
const M_U: Move = { cycle: [0, 3, 2, 1], tw: {} }               // U layer: no twist
const M_R: Move = { cycle: [0, 4, 6, 3], tw: { 0: 2, 4: 1, 6: 2, 3: 1 } }
const M_F: Move = { cycle: [0, 1, 5, 4], tw: { 0: 1, 1: 2, 5: 1, 4: 2 } }

function applyMove(s: Cube, m: Move): Cube {
  const p = s.p.slice(), o = s.o.slice()
  const c = m.cycle
  for (let i = 0; i < c.length; i++) {
    const dst = c[i], from = c[(i - 1 + c.length) % c.length]
    p[dst] = s.p[from]
    o[dst] = (s.o[from] + (m.tw[dst] || 0)) % 3
  }
  return { p, o }
}
// A quarter-turn's inverse is the same move applied three times (order 4).
function applyThrice(s: Cube, m: Move): Cube {
  return applyMove(applyMove(applyMove(s, m), m), m)
}

// The six quarter-turns we search over.
const MOVES: { name: string; run: (s: Cube) => Cube }[] = [
  { name: "U", run: (s) => applyMove(s, M_U) }, { name: "U'", run: (s) => applyThrice(s, M_U) },
  { name: "R", run: (s) => applyMove(s, M_R) }, { name: "R'", run: (s) => applyThrice(s, M_R) },
  { name: "F", run: (s) => applyMove(s, M_F) }, { name: "F'", run: (s) => applyThrice(s, M_F) },
]

function key(s: Cube): string {
  let k = ""
  for (let i = 0; i < 7; i++) k += s.p[i]
  k += "|"
  for (let i = 0; i < 7; i++) k += s.o[i]
  return k
}
function isSolved(s: Cube): boolean {
  for (let i = 0; i < 7; i++) if (s.p[i] !== i || s.o[i] !== 0) return false
  return true
}

// ---- sticker colors, derived from the corner state (for drawing the net) ----
// Each of the 7 movable corners carries 3 stickers; the fixed corner too. We map
// (corner, orientation) → which face-color shows in each of the 24 net slots.
// Corner facelet colors when solved, in [x,y,z]-ish sticker order per corner.
const CORNER_COLORS: number[][] = [
  [0, 1, 2], [0, 2, 4], [0, 4, 5], [0, 5, 1], // U corners: 0=U,1=R,2=F,4=L,5=B
  [3, 2, 1], [3, 4, 2], [3, 1, 5], [3, 5, 4], // D corners: 3=D
]
// which corner+slot fills each of the 24 net stickers (corner index, facelet 0..2)
const NET_SOURCE: [number, number][] = [
  [2, 0], [3, 0], [1, 0], [0, 0],       // U face (top-left, top-right, ...)
  [0, 1], [3, 2], [4, 2], [6, 1],       // R face
  [1, 2], [0, 2], [5, 1], [4, 1],       // F face
  [5, 0], [4, 0], [6, 0], [7, 0],       // D face
  [2, 1], [1, 1], [7, 2], [5, 2],       // L face
  [3, 1], [2, 2], [6, 2], [7, 1],       // B face
]
function stickerColors(s: Cube): number[] {
  // For a movable slot i (0..6) holding corner s.p[i] twisted by s.o[i], the
  // color at facelet f is the corner's color at (f - twist). The fixed corner 7
  // stays solved. We colour each net slot from its (slotCorner, facelet).
  const slotColor = (slot: number, facelet: number): number => {
    if (slot === 7) return CORNER_COLORS[7][facelet]
    const corner = s.p[slot], tw = s.o[slot]
    return CORNER_COLORS[corner][(facelet - tw + 3) % 3]
  }
  return NET_SOURCE.map(([slot, f]) => slotColor(slot, f))
}

// ---- BFS solver, yielding progress so we can animate the search ------------
type Step = { name: string; idx: number }
type SearchState = {
  frontierSize: number
  visited: number
  depth: number
  solution: Step[] | null
  done: boolean
}

function scramble(n: number): { state: Cube; moves: string[] } {
  let s = solvedCube()
  const moves: string[] = []
  let last = -1
  for (let i = 0; i < n; i++) {
    let m = Math.floor(Math.random() * MOVES.length)
    // avoid immediately undoing the previous move (m and its inverse are paired)
    while (Math.floor(m / 2) === Math.floor(last / 2)) m = Math.floor(Math.random() * MOVES.length)
    s = MOVES[m].run(s)
    moves.push(MOVES[m].name)
    last = m
  }
  return { state: s, moves }
}

const COLORS = ["#f5f5f0", "#c0392b", "#2e7d32", "#f2c200", "#e67e22", "#2b6cff"]
// U=white R=red F=green D=yellow L=orange B=blue

// A flat net layout (positions of each of the 24 stickers in a 2D cross).
// grid units; drawn as a mini "unfolded cube".
const NET: [number, number][] = [
  // U (top)
  [2, 0], [3, 0], [2, 1], [3, 1],
  // R (right)
  [4, 2], [5, 2], [4, 3], [5, 3],
  // F (front, center)
  [2, 2], [3, 2], [2, 3], [3, 3],
  // D (bottom)
  [2, 4], [3, 4], [2, 5], [3, 5],
  // L (left)
  [0, 2], [1, 2], [0, 3], [1, 3],
  // B (back, far right)
  [6, 2], [7, 2], [6, 3], [7, 3],
]

export function RubikGraphSolver() {
  const [state, setState] = useState<Cube>(() => solvedCube())
  const [scrambleMoves, setScrambleMoves] = useState<string[]>([])
  const [search, setSearch] = useState<SearchState | null>(null)
  const [running, setRunning] = useState(false)
  const [solutionIdx, setSolutionIdx] = useState(0)
  const rafRef = useRef<number | null>(null)

  const doScramble = useCallback((n: number) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    setRunning(false)
    setSearch(null)
    setSolutionIdx(0)
    const { state: s, moves } = scramble(n)
    setState(s)
    setScrambleMoves(moves)
  }, [])

  const reset = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    setRunning(false)
    setSearch(null)
    setSolutionIdx(0)
    setState(solvedCube())
    setScrambleMoves([])
  }, [])

  // Run BFS incrementally across animation frames so the UI stays live and you
  // can watch the frontier (the "ring" of states at each distance) grow.
  const solve = useCallback((start: Cube) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    setRunning(true)
    setSolutionIdx(0)

    const visited = new Set<string>([key(start)])
    let frontier: { s: Cube; path: Step[] }[] = [{ s: start, path: [] }]
    let depth = 0

    const stepFrame = () => {
      if (!frontier.length) {
        setSearch({ frontierSize: 0, visited: visited.size, depth, solution: null, done: true })
        setRunning(false)
        return
      }
      const next: { s: Cube; path: Step[] }[] = []
      let solution: Step[] | null = null
      // expand this whole distance-ring (one BFS layer) per frame
      for (const node of frontier) {
        if (isSolved(node.s)) { solution = node.path; break }
        for (let mi = 0; mi < MOVES.length; mi++) {
          const ns = MOVES[mi].run(node.s)
          const k = key(ns)
          if (!visited.has(k)) {
            visited.add(k)
            next.push({ s: ns, path: [...node.path, { name: MOVES[mi].name, idx: mi }] })
          }
        }
      }
      if (!solution) {
        for (const node of next) if (isSolved(node.s)) { solution = node.path; break }
      }
      depth++
      if (solution) {
        setSearch({ frontierSize: next.length, visited: visited.size, depth, solution, done: true })
        setRunning(false)
        return
      }
      frontier = next
      setSearch({ frontierSize: frontier.length, visited: visited.size, depth, solution: null, done: false })
      rafRef.current = requestAnimationFrame(stepFrame)
    }
    rafRef.current = requestAnimationFrame(stepFrame)
  }, [])

  // play the solution back on the cube, one move at a time
  useEffect(() => {
    if (!search?.solution) return
    if (solutionIdx >= search.solution.length) return
    const t = setTimeout(() => {
      setState((cur) => MOVES[search.solution![solutionIdx].idx].run(cur))
      setSolutionIdx((i) => i + 1)
    }, 550)
    return () => clearTimeout(t)
  }, [search, solutionIdx])

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }, [])

  const solved = useMemo(() => isSolved(state), [state])

  return (
    <div className="rounded-2xl border border-border bg-gradient-to-b from-[#0a0b12] to-[#05060a] p-4 md:p-6">
      <div className="grid gap-6 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        {/* the cube net */}
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-foreground/40 mb-2">
            The cube (a node in the graph)
          </p>
          <CubeNet state={state} />
          <div className="mt-3 flex flex-wrap gap-1.5 min-h-[1.5rem]">
            {scrambleMoves.map((m, i) => (
              <span key={i} className="font-mono text-[11px] px-1.5 py-0.5 rounded border border-border/60 text-foreground/60">{m}</span>
            ))}
          </div>
          <p className="mt-1 font-mono text-[11px] text-foreground/50">
            {solved ? "✓ solved" : `${scrambleMoves.length ? "scrambled" : "solved"}`}
          </p>
        </div>

        {/* the search visualization */}
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-foreground/40 mb-2">
            Breadth-first search (the graph expanding)
          </p>
          <SearchViz search={search} running={running} />
          <div className="mt-3 grid grid-cols-3 gap-3 font-mono text-[11px]">
            <Stat label="Depth (moves)" value={search ? search.depth : 0} />
            <Stat label="States seen" value={search ? search.visited.toLocaleString() : 0} />
            <Stat label="Frontier" value={search ? search.frontierSize.toLocaleString() : 0} />
          </div>
          {search?.solution && (
            <div className="mt-3">
              <p className="font-mono text-[11px] text-accent mb-1">
                Shortest solution — {search.solution.length} moves (playing back):
              </p>
              <div className="flex flex-wrap gap-1.5">
                {search.solution.map((m, i) => (
                  <span
                    key={i}
                    className={`font-mono text-[12px] px-2 py-0.5 rounded border ${
                      i < solutionIdx ? "border-accent bg-accent/20 text-accent" : "border-border/60 text-foreground/60"
                    }`}
                  >
                    {m.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* controls */}
      <div className="mt-5 flex flex-wrap gap-2">
        <button onClick={() => doScramble(6)} className="rounded-lg border border-border px-3 py-1.5 font-mono text-[12px] text-foreground/80 hover:border-accent/60 hover:text-accent transition">Scramble (easy)</button>
        <button onClick={() => doScramble(11)} className="rounded-lg border border-border px-3 py-1.5 font-mono text-[12px] text-foreground/80 hover:border-accent/60 hover:text-accent transition">Scramble (hard · 11)</button>
        <button onClick={() => solve(state)} disabled={running || solved} className="rounded-lg border border-accent bg-accent/10 px-3 py-1.5 font-mono text-[12px] text-accent disabled:opacity-40 hover:bg-accent/20 transition">
          {running ? "searching…" : "Solve (BFS)"}
        </button>
        <button onClick={reset} className="rounded-lg border border-border px-3 py-1.5 font-mono text-[12px] text-foreground/60 hover:text-foreground transition">Reset</button>
      </div>
      <p className="mt-3 font-mono text-[10.5px] leading-relaxed text-foreground/40">
        Real BFS over the 2×2×2 state graph (3,674,160 nodes; quarter-turn diameter 14
        — the 2×2&rsquo;s &ldquo;God&rsquo;s Number&rdquo;). Each layer is one
        &ldquo;distance ring&rdquo; from the scramble; the search stops the instant it
        touches the solved node — that path is provably the fewest possible moves.
      </p>
    </div>
  )
}

function CubeNet({ state }: { state: Cube }) {
  const cell = 26, gap = 3
  const W = 8 * (cell + gap), H = 6 * (cell + gap)
  const colors = stickerColors(state)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[280px]" role="img" aria-label="Rubik's cube net">
      {NET.map(([x, y], i) => (
        <rect
          key={i}
          x={x * (cell + gap)} y={y * (cell + gap)}
          width={cell} height={cell} rx={4}
          fill={COLORS[colors[i]]} stroke="rgba(0,0,0,.35)" strokeWidth={1}
        />
      ))}
    </svg>
  )
}

function SearchViz({ search, running }: { search: SearchState | null; running: boolean }) {
  // Draw concentric rings — one per BFS depth — scaled by (log) frontier size,
  // so you SEE the graph fanning out and then snapping to the goal.
  const depth = search?.depth ?? 0
  const rings = Array.from({ length: Math.max(depth, 1) }, (_, i) => i + 1)
  const found = !!search?.solution
  return (
    <svg viewBox="0 0 300 200" className="w-full rounded-lg border border-border/40 bg-black/30" role="img" aria-label="BFS frontier">
      {/* start node */}
      <circle cx={40} cy={100} r={6} fill="#e67e22" />
      <text x={40} y={122} fontSize={9} fill="rgba(255,255,255,.5)" textAnchor="middle" fontFamily="monospace">start</text>
      {/* rings fanning right */}
      {rings.map((r) => {
        const x = 40 + (r / Math.max(rings.length, 1)) * (found ? 200 : 220)
        return (
          <g key={r}>
            <line x1={40} y1={100} x2={x} y2={100} stroke="rgba(124,156,255,.15)" strokeWidth={1} />
            <circle cx={x} cy={100} r={3 + Math.min(9, r)} fill="none" stroke="rgba(124,156,255,.55)" strokeWidth={1.5}>
              {running && r === rings.length && (
                <animate attributeName="stroke-opacity" values="0.2;1;0.2" dur="1s" repeatCount="indefinite" />
              )}
            </circle>
            <text x={x} y={100 - (6 + Math.min(9, r)) - 4} fontSize={8} fill="rgba(255,255,255,.4)" textAnchor="middle" fontFamily="monospace">{r}</text>
          </g>
        )
      })}
      {/* goal node, lit when found */}
      {found && (
        <>
          <circle cx={270} cy={100} r={7} fill="#2e7d32" />
          <text x={270} y={122} fontSize={9} fill="#7bd88f" textAnchor="middle" fontFamily="monospace">solved</text>
          <line x1={40} y1={100} x2={270} y2={100} stroke="#2e7d32" strokeWidth={2} strokeDasharray="4 3" opacity={0.7} />
        </>
      )}
    </svg>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-black/20 px-2.5 py-2">
      <div className="text-[9px] uppercase tracking-wide text-foreground/40">{label}</div>
      <div className="text-foreground/90 text-[14px] tabular-nums">{value}</div>
    </div>
  )
}
