"use client"

// A faithful visualization of DATA-DRIVEN (pull-based) P2P live streaming — the
// model of the IEEE base paper the 2012 project implemented (CoolStreaming/DONet
// lineage). The mechanism it depicts:
//
//  • The source emits a CONTINUOUS stream of numbered chunks in real time.
//  • Each peer keeps a sliding BUFFER MAP: a window of recent chunk slots it either
//    holds or is missing, advancing with a PLAYHEAD that has a deadline.
//  • Peers gossip buffer maps to partners, then PULL missing chunks — rarest /
//    most-urgent first — from whichever partner holds them (no central server).
//  • If a chunk isn't fetched before the playhead reaches it, playback STALLS
//    (a continuity miss). The paper's goal is maximizing continuity + throughput.
//
// Dependency-free 2D canvas; offline; static-export-safe.

import { useEffect, useRef, useState, useCallback } from "react"

const WINDOW = 20      // buffer-map window: chunk slots each peer tracks
const N_PEERS = 13

type Peer = {
  id: number
  x: number; y: number
  base: number          // oldest chunk index its window currently covers
  have: Set<number>     // which chunk indices this peer holds
  partners: number[]
  isSource: boolean
  playhead: number      // the chunk index currently "playing"
  stalls: number        // continuity misses (deadline passed, chunk absent)
  played: number
}
type Pull = { from: number; to: number; chunk: number; t: number }

function build(w: number, h: number): Peer[] {
  const peers: Peer[] = []
  peers.push({ id: 0, x: w / 2, y: h * 0.15, base: 0, have: new Set(), partners: [], isSource: true, playhead: 0, stalls: 0, played: 0 })
  const R = Math.min(w, h) * 0.33
  for (let i = 1; i < N_PEERS; i++) {
    const a = (i / (N_PEERS - 1)) * Math.PI * 2 + 0.3
    const rr = R * (0.7 + ((i * 7) % 5) / 5 * 0.55)
    peers.push({
      id: i, x: w / 2 + Math.cos(a) * rr, y: h * 0.55 + Math.sin(a) * rr * 0.72,
      base: 0, have: new Set(), partners: [], isSource: false, playhead: 0, stalls: 0, played: 0,
    })
  }
  // each peer partners with its ~3 nearest (the gossip mesh — "partnership" in the paper)
  for (const p of peers) {
    const near = peers.filter((q) => q.id !== p.id)
      .sort((a, b) => (a.x - p.x) ** 2 + (a.y - p.y) ** 2 - ((b.x - p.x) ** 2 + (b.y - p.y) ** 2))
      .slice(0, p.isSource ? 4 : 3)
    p.partners = near.map((q) => q.id)
  }
  for (const p of peers) for (const n of p.partners)
    if (!peers[n].partners.includes(p.id)) peers[n].partners.push(p.id)
  return peers
}

export function P2PSwarm() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(true)
  const [mode, setMode] = useState<"pull" | "server">("pull")
  const [stats, setStats] = useState({ latest: 0, continuity: 100 })
  const runningRef = useRef(running); runningRef.current = running
  const modeRef = useRef(mode); modeRef.current = mode
  const sref = useRef<{ peers: Peer[]; pulls: Pull[]; w: number; h: number; tick: number; latest: number }>({
    peers: [], pulls: [], w: 0, h: 0, tick: 0, latest: 0,
  })

  const seed = useCallback((w: number, h: number) => {
    sref.current = { peers: build(w, h), pulls: [], w, h, tick: 0, latest: 0 }
  }, [])
  const reset = useCallback(() => { const s = sref.current; if (s.w) seed(s.w, s.h) }, [seed])

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext("2d")!
    let raf = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const size = () => {
      const r = canvas.getBoundingClientRect()
      canvas.width = r.width * dpr; canvas.height = r.height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (!sref.current.peers.length || sref.current.w !== r.width) seed(r.width, r.height)
    }
    size(); window.addEventListener("resize", size)

    const step = () => {
      const s = sref.current; const { peers, pulls } = s
      s.tick++
      if (runningRef.current) {
        // 1) the SOURCE emits a new chunk into the live stream every few ticks
        if (s.tick % 8 === 0) { s.latest++; peers[0].have.add(s.latest) }

        // 2) every peer's PLAYHEAD advances on a deadline; a missing chunk = a stall
        if (s.tick % 8 === 0) {
          for (const p of peers) {
            if (p.isSource) continue
            const next = p.playhead + 1
            if (next <= s.latest - WINDOW + 2) { // deadline reached for this slot
              if (p.have.has(next)) p.played++; else p.stalls++
              p.playhead = next
              p.base = Math.max(0, next - 2)
            }
          }
        }

        // 3) advance in-flight pulls; on arrival the chunk lands in the buffer map
        for (let i = pulls.length - 1; i >= 0; i--) {
          const pl = pulls[i]; pl.t += 0.035
          if (pl.t >= 1) { peers[pl.to].have.add(pl.chunk); pulls.splice(i, 1) }
        }

        // 4) SCHEDULING: each peer pulls missing chunks in its window — most-urgent
        //    (closest to the playhead) first, from a partner that holds it. This is
        //    the data-driven pull the paper is built on.
        if (s.tick % 3 === 0) {
          for (const p of peers) {
            if (p.isSource) continue
            const lo = p.playhead + 1, hi = s.latest
            // urgency order: nearest-to-playhead missing slots first
            for (let chunk = lo; chunk <= hi && chunk < lo + WINDOW; chunk++) {
              if (p.have.has(chunk)) continue
              if (pulls.some((q) => q.to === p.id && q.chunk === chunk)) continue
              // who has it? in pull mode: any partner. in server mode: only the source.
              const holders = modeRef.current === "server"
                ? [0].filter((id) => peers[id].have.has(chunk))
                : p.partners.filter((id) => peers[id].have.has(chunk))
              if (!holders.length) continue
              if (modeRef.current === "server" && pulls.filter((q) => q.from === 0).length >= 3) break
              const from = holders[(s.tick + p.id) % holders.length]
              pulls.push({ from, to: p.id, chunk, t: 0 })
              break // one request per peer per scheduling round (keeps it legible)
            }
          }
        }

        // publish stats occasionally
        if (s.tick % 20 === 0) {
          const viewers = peers.filter((p) => !p.isSource)
          const totPlayed = viewers.reduce((a, p) => a + p.played, 0)
          const totSlots = viewers.reduce((a, p) => a + p.played + p.stalls, 0)
          setStats({ latest: s.latest, continuity: totSlots ? Math.round((totPlayed / totSlots) * 100) : 100 })
        }
      }

      // ---- draw ----
      ctx.clearRect(0, 0, s.w, s.h)
      // mesh edges
      ctx.lineWidth = 1
      for (const p of peers) for (const n of p.partners) {
        if (n < p.id) continue
        ctx.strokeStyle = "rgba(150,170,220,0.09)"
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(peers[n].x, peers[n].y); ctx.stroke()
      }
      // in-flight chunk pulls — a travelling packet
      for (const pl of pulls) {
        const a = peers[pl.from], b = peers[pl.to]
        const x = a.x + (b.x - a.x) * pl.t, y = a.y + (b.y - a.y) * pl.t
        ctx.strokeStyle = "rgba(126,200,255,0.30)"
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(x, y); ctx.stroke()
        ctx.fillStyle = "rgba(180,225,255,0.95)"
        ctx.beginPath(); ctx.arc(x, y, 2.6, 0, 7); ctx.fill()
      }
      // peers, each drawn WITH its buffer map (the window of chunk slots)
      for (const p of peers) {
        drawPeer(ctx, p, s.latest)
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
        <div className="pointer-events-none absolute left-3 top-3 font-mono text-[10px] leading-relaxed tracking-widest uppercase text-white/40">
          {mode === "pull" ? "data-driven pull — peers fetch chunks from partners" : "single server — one uplink serves the stream"}
        </div>
        <div className="pointer-events-none absolute right-3 top-3 text-right font-mono text-[10px] text-white/55">
          <div>chunk #{stats.latest} live</div>
          <div className={stats.continuity >= 90 ? "text-emerald-300/80" : stats.continuity >= 70 ? "text-amber-300/80" : "text-red-300/80"}>
            {stats.continuity}% continuity
          </div>
        </div>
        <div className="pointer-events-none absolute right-3 bottom-3 flex flex-col gap-1 font-mono text-[9px] text-white/45">
          <span><span className="inline-block w-2.5 h-2 align-middle mr-1" style={{ background: "#7ec8ff" }} />buffered</span>
          <span><span className="inline-block w-2.5 h-2 align-middle mr-1" style={{ background: "#2a3350" }} />missing</span>
          <span><span className="inline-block w-2.5 h-2 align-middle mr-1" style={{ background: "#e0961f" }} />playhead</span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex overflow-hidden rounded-lg border border-border">
          <button onClick={() => setMode("pull")} className={`px-4 py-2 font-mono text-sm transition-colors ${mode === "pull" ? "bg-accent/20 text-foreground" : "text-foreground/60 hover:bg-accent/10"}`}>
            Data-driven pull
          </button>
          <button onClick={() => setMode("server")} className={`px-4 py-2 font-mono text-sm border-l border-border transition-colors ${mode === "server" ? "bg-accent/20 text-foreground" : "text-foreground/60 hover:bg-accent/10"}`}>
            Single server
          </button>
        </div>
        <button onClick={() => setRunning((r) => !r)} className="px-4 py-2 rounded-lg border border-border font-mono text-sm text-foreground/85 hover:bg-accent/15 transition-colors">
          {running ? "Pause" : "Play"}
        </button>
        <button onClick={reset} className="px-4 py-2 rounded-lg border border-border font-mono text-sm text-foreground/60 hover:bg-accent/15 transition-colors">
          Restart stream
        </button>
      </div>
      <p className="mt-3 font-sans text-[13px] leading-relaxed text-foreground/50">
        Each node shows its <span className="text-foreground/70">buffer map</span> — a
        sliding window of recent chunk slots, filled or missing, with a{" "}
        <span className="text-foreground/70">playhead</span> that advances on a deadline.
        Peers pull the most-urgent missing chunks from partners that hold them; if a
        chunk misses its deadline, playback stalls, dropping the{" "}
        <span className="text-foreground/70">continuity</span> score. Switch to a single
        server and watch its one uplink throttle the swarm — the bottleneck the base
        paper&apos;s data-driven design removes.
      </p>
    </div>
  )
}

/** Draw a peer node with its buffer map: a small strip of chunk-slot cells. */
function drawPeer(ctx: CanvasRenderingContext2D, p: Peer, latest: number) {
  const rad = p.isSource ? 8 : 6
  // the node dot
  const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad)
  if (p.isSource) { g.addColorStop(0, "#ffe9b8"); g.addColorStop(1, "#e0961f") }
  else { g.addColorStop(0, "#bcd0f0"); g.addColorStop(1, "#3a4668") }
  ctx.fillStyle = g
  ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, 7); ctx.fill()
  if (p.isSource) {
    ctx.fillStyle = "rgba(20,15,5,0.85)"; ctx.font = "600 7px ui-monospace, monospace"
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("SRC", p.x, p.y)
  }
  if (p.isSource) return

  // the BUFFER MAP strip — WINDOW cells centred under the node
  const cellW = 4.4, cellH = 6, gap = 0.6
  const total = WINDOW
  const stripW = total * (cellW + gap)
  const x0 = p.x - stripW / 2
  const y0 = p.y + rad + 5
  const start = p.playhead - 2
  for (let i = 0; i < total; i++) {
    const chunk = start + i
    const cx = x0 + i * (cellW + gap)
    const isPlayhead = chunk === p.playhead
    if (chunk < 0 || chunk > latest) { ctx.fillStyle = "rgba(120,135,170,0.08)" }
    else if (p.have.has(chunk)) { ctx.fillStyle = "rgba(126,200,255,0.85)" }
    else { ctx.fillStyle = "rgba(42,51,80,0.9)" }
    ctx.fillRect(cx, y0, cellW, cellH)
    if (isPlayhead) {
      ctx.fillStyle = "rgba(224,150,31,0.95)"
      ctx.fillRect(cx, y0 - 2, cellW, 2) // the playhead marker atop its slot
    }
  }
}
