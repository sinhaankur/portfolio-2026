"use client"

// A live visualization of the data-driven P2P streaming project. A source seeds
// media chunks; peers PULL the chunks they're missing from neighbours that already
// hold them (not from the server). You watch chunks propagate through the swarm and
// each peer's buffer / availability map fill — the actual idea of the 2012 project,
// made watchable. Dependency-free 2D canvas; no server; runs offline; static-export-safe.

import { useEffect, useRef, useState, useCallback } from "react"

const CHUNKS = 24 // chunks in the "live window" each peer tries to hold

type Peer = {
  id: number
  x: number; y: number
  have: boolean[]            // availability map — which chunks this peer holds
  neighbours: number[]
  isSource: boolean
}
type Transfer = { from: number; to: number; chunk: number; t: number } // t: 0→1 progress

function build(nPeers: number, w: number, h: number): Peer[] {
  const peers: Peer[] = []
  // the source sits at the centre-top; peers ring around it
  peers.push({ id: 0, x: w / 2, y: h * 0.16, have: Array(CHUNKS).fill(true), neighbours: [], isSource: true })
  const R = Math.min(w, h) * 0.34
  for (let i = 1; i < nPeers; i++) {
    const a = (i / (nPeers - 1)) * Math.PI * 2 + 0.3
    const rr = R * (0.72 + ((i * 7) % 5) / 5 * 0.5)
    peers.push({
      id: i,
      x: w / 2 + Math.cos(a) * rr,
      y: h * 0.56 + Math.sin(a) * rr * 0.72,
      have: Array(CHUNKS).fill(false),
      neighbours: [],
      isSource: false,
    })
  }
  // connect each peer to its ~3 nearest others (the gossip overlay)
  for (const p of peers) {
    const near = peers
      .filter((q) => q.id !== p.id)
      .sort((a, b) => (a.x - p.x) ** 2 + (a.y - p.y) ** 2 - ((b.x - p.x) ** 2 + (b.y - p.y) ** 2))
      .slice(0, p.isSource ? 4 : 3)
    p.neighbours = near.map((q) => q.id)
  }
  // symmetrize
  for (const p of peers) for (const n of p.neighbours)
    if (!peers[n].neighbours.includes(p.id)) peers[n].neighbours.push(p.id)
  return peers
}

export function P2PSwarm() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(true)
  const [mode, setMode] = useState<"p2p" | "server">("p2p")
  const stateRef = useRef<{ peers: Peer[]; transfers: Transfer[]; w: number; h: number; tick: number }>({
    peers: [], transfers: [], w: 0, h: 0, tick: 0,
  })
  const runningRef = useRef(running)
  const modeRef = useRef(mode)
  runningRef.current = running
  modeRef.current = mode

  const seed = useCallback((w: number, h: number) => {
    stateRef.current = { peers: build(14, w, h), transfers: [], w, h, tick: 0 }
  }, [])

  const reset = useCallback(() => {
    const s = stateRef.current
    if (s.w) seed(s.w, s.h)
  }, [seed])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!
    let raf = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    const size = () => {
      const r = canvas.getBoundingClientRect()
      canvas.width = r.width * dpr; canvas.height = r.height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (!stateRef.current.peers.length || stateRef.current.w !== r.width) seed(r.width, r.height)
    }
    size()
    window.addEventListener("resize", size)

    const step = () => {
      const s = stateRef.current
      const { peers, transfers } = s
      s.tick++

      if (runningRef.current) {
        // advance in-flight transfers; on arrival, the chunk lands in the buffer
        for (let i = transfers.length - 1; i >= 0; i--) {
          const tr = transfers[i]
          tr.t += 0.02
          if (tr.t >= 1) { peers[tr.to].have[tr.chunk] = true; transfers.splice(i, 1) }
        }
        // every few ticks, each peer requests ONE missing chunk from a peer that has it
        if (s.tick % 6 === 0) {
          for (const p of peers) {
            if (p.isSource) continue
            const missing = p.have.map((h, c) => (h ? -1 : c)).filter((c) => c >= 0)
            if (!missing.length) continue
            // rarest-first-ish: pick a random missing chunk (keeps it lively + legible)
            const chunk = missing[Math.floor((s.tick * 7 + p.id * 13) % missing.length)]
            // in P2P: pull from any neighbour that holds it. in server: only from source.
            const sources = modeRef.current === "server"
              ? [0].filter((id) => peers[id].have[chunk])
              : p.neighbours.filter((id) => peers[id].have[chunk])
            if (!sources.length) continue
            // server mode throttles: the single uplink can only push a few at once
            if (modeRef.current === "server" &&
                transfers.filter((t) => t.from === 0).length >= 2) continue
            if (transfers.some((t) => t.to === p.id && t.chunk === chunk)) continue
            const from = sources[(s.tick + p.id) % sources.length]
            transfers.push({ from, to: p.id, chunk, t: 0 })
          }
        }
      }

      // ---- draw ----
      ctx.clearRect(0, 0, s.w, s.h)
      // overlay edges
      ctx.lineWidth = 1
      for (const p of peers) for (const n of p.neighbours) {
        if (n < p.id) continue
        const q = peers[n]
        ctx.strokeStyle = "rgba(150,170,220,0.10)"
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke()
      }
      // transfers — a travelling packet of light
      for (const tr of transfers) {
        const a = peers[tr.from], b = peers[tr.to]
        const x = a.x + (b.x - a.x) * tr.t, y = a.y + (b.y - a.y) * tr.t
        ctx.strokeStyle = "rgba(126,200,255,0.35)"
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(x, y); ctx.stroke()
        ctx.fillStyle = "rgba(180,225,255,0.95)"
        ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill()
        ctx.fillStyle = "rgba(126,200,255,0.25)"
        ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.fill()
      }
      // peers — a node with a ring buffer showing how full its availability map is
      for (const p of peers) {
        const got = p.have.filter(Boolean).length
        const frac = got / CHUNKS
        const rad = p.isSource ? 15 : 11
        // buffer ring
        ctx.lineWidth = 3
        ctx.strokeStyle = "rgba(120,135,170,0.25)"
        ctx.beginPath(); ctx.arc(p.x, p.y, rad + 4, 0, 7); ctx.stroke()
        ctx.strokeStyle = p.isSource ? "rgba(255,214,140,0.95)" : "rgba(127,209,185,0.95)"
        ctx.beginPath(); ctx.arc(p.x, p.y, rad + 4, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2); ctx.stroke()
        // node core
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad)
        if (p.isSource) { g.addColorStop(0, "#ffe9b8"); g.addColorStop(1, "#e0961f") }
        else { g.addColorStop(0, frac >= 1 ? "#bff0dd" : "#8fa2c8"); g.addColorStop(1, frac >= 1 ? "#3aa07a" : "#2a3350") }
        ctx.fillStyle = g
        ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, 7); ctx.fill()
        if (p.isSource) {
          ctx.fillStyle = "rgba(20,15,5,0.85)"; ctx.font = "600 8px ui-monospace, monospace"
          ctx.textAlign = "center"; ctx.textBaseline = "middle"
          ctx.fillText("SRC", p.x, p.y)
        }
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", size) }
  }, [seed])

  return (
    <div className="w-full">
      <div className="relative w-full aspect-[4/3] sm:aspect-[16/9] rounded-2xl overflow-hidden border border-border bg-gradient-to-b from-[#0a0b12] to-[#05060a]">
        <canvas ref={canvasRef} className="w-full h-full block" />
        <div className="pointer-events-none absolute left-3 top-3 font-mono text-[10px] tracking-widest uppercase text-white/40">
          {mode === "p2p" ? "data-driven P2P — peers pull from each other" : "single server — one uplink feeds everyone"}
        </div>
        {/* legend */}
        <div className="pointer-events-none absolute right-3 bottom-3 flex flex-col gap-1 font-mono text-[9px] text-white/45">
          <span><span className="inline-block w-2 h-2 rounded-full align-middle mr-1" style={{ background: "#e0961f" }} />source</span>
          <span><span className="inline-block w-2 h-2 rounded-full align-middle mr-1" style={{ background: "#3aa07a" }} />fully buffered</span>
          <span><span className="inline-block w-2 h-2 rounded-full align-middle mr-1" style={{ background: "#2a3350" }} />still filling</span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex overflow-hidden rounded-lg border border-border">
          <button
            onClick={() => setMode("p2p")}
            className={`px-4 py-2 font-mono text-sm transition-colors ${mode === "p2p" ? "bg-accent/20 text-foreground" : "text-foreground/60 hover:bg-accent/10"}`}
          >P2P (data-driven)</button>
          <button
            onClick={() => setMode("server")}
            className={`px-4 py-2 font-mono text-sm border-l border-border transition-colors ${mode === "server" ? "bg-accent/20 text-foreground" : "text-foreground/60 hover:bg-accent/10"}`}
          >Single server</button>
        </div>
        <button onClick={() => setRunning((r) => !r)} className="px-4 py-2 rounded-lg border border-border font-mono text-sm text-foreground/85 hover:bg-accent/15 transition-colors">
          {running ? "Pause" : "Play"}
        </button>
        <button onClick={reset} className="px-4 py-2 rounded-lg border border-border font-mono text-sm text-foreground/60 hover:bg-accent/15 transition-colors">
          Reseed
        </button>
      </div>
      <p className="mt-3 font-sans text-[13px] leading-relaxed text-foreground/50">
        Each node&apos;s ring shows how full its playback buffer is. In{" "}
        <span className="text-foreground/70">P2P</span> mode a peer pulls missing chunks
        from any neighbour that already holds them, so the swarm&apos;s collective upload
        bandwidth fills everyone quickly. Switch to{" "}
        <span className="text-foreground/70">single server</span> and watch the one uplink
        become the bottleneck — the thing the project set out to fix.
      </p>
    </div>
  )
}
