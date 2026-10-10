"use client"

// The neural network as a living instrument — signal flowing through the layers
// like particles falling through a filter. Rendered on a canvas: input cues at the
// top, connections drawn as weighted streamlines, particles travelling down them
// from fired inputs through the hidden neurons to the felt output, each node
// glowing with its real activation. Driven by the ACTUAL trained net
// (affect-net.ts) — not a decorative mock.
//
// Aesthetic reference: scientific particle-dynamics / filtration plates — dark
// field, thin wire structure, warm→cool activation colour, motion that reads the
// data rather than just decorating it.

import { useEffect, useRef } from "react"
import { readFeeling } from "./affect-net"

type Node = { x: number; y: number; r: number; act: number; label?: string }
type Edge = { from: Node; to: Node; w: number }           // signal strength 0..1
type Particle = { edge: Edge; t: number; speed: number }

// activation → colour: cool violet (low/heavy) → warm gold (high), like the
// velocity ramp in the reference plate. Returns an rgba string.
function actColor(a: number, alpha = 1): string {
  const t = Math.max(0, Math.min(1, a))
  // violet (159,139,255) → slate (154,166,196) → gold (255,210,122)
  const stops = [
    [159, 139, 255],
    [154, 166, 196],
    [255, 210, 122],
  ]
  const seg = t < 0.5 ? 0 : 1
  const f = t < 0.5 ? t / 0.5 : (t - 0.5) / 0.5
  const a0 = stops[seg], a1 = stops[seg + 1]
  const c = a0.map((v, i) => Math.round(v + (a1[i] - v) * f))
  return `rgba(${c[0]},${c[1]},${c[2]},${alpha})`
}

export function NetField({ text, height = 440 }: { text: string; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textRef = useRef(text)
  textRef.current = text

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let raf = 0
    let w = 0, h = 0
    const dpr = Math.min(2, window.devicePixelRatio || 1)

    // layers rebuilt from the real net reading, remembered across frames so the
    // particles keep flowing and nodes ease toward their new activations.
    let inputs: Node[] = []
    let hiddens: Node[] = []
    let outputs: Node[] = []
    let edges: Edge[] = []
    let particles: Particle[] = []
    let lastText = ""

    function resize() {
      const rect = canvas!.getBoundingClientRect()
      w = rect.width; h = height
      canvas!.width = w * dpr; canvas!.height = h * dpr
      canvas!.style.height = `${h}px`
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      rebuild(true)
    }

    function rebuild(reposition: boolean) {
      const reading = readFeeling(textRef.current)
      const fired = reading.firedCues.slice(0, 10)      // the input cues that lit
      const hid = reading.hidden
      const out = [Math.abs(reading.valence), reading.arousal]

      const topY = 54, midY = h * 0.52, botY = h - 54
      const colX = (n: number, i: number) => w * (0.12 + 0.76 * (n <= 1 ? 0.5 : i / (n - 1)))

      if (reposition || inputs.length !== fired.length) {
        inputs = fired.map((c, i) => ({
          x: colX(Math.max(fired.length, 1), i), y: topY, r: 4 + c.value * 5,
          act: c.value, label: c.feature,
        }))
      } else {
        fired.forEach((c, i) => { if (inputs[i]) { inputs[i].act = c.value; inputs[i].label = c.feature } })
      }
      if (reposition || hiddens.length !== hid.length) {
        const mx = Math.max(0.001, ...hid.map(Math.abs))
        hiddens = hid.map((a, i) => ({ x: colX(hid.length, i), y: midY, r: 6 + (Math.abs(a) / mx) * 10, act: Math.abs(a) / mx }))
      } else {
        const mx = Math.max(0.001, ...hid.map(Math.abs))
        hid.forEach((a, i) => { hiddens[i].act = Math.abs(a) / mx; hiddens[i].r = 6 + (Math.abs(a) / mx) * 10 })
      }
      outputs = [
        { x: w * 0.38, y: botY, r: 8 + out[0] * 10, act: out[0], label: "valence" },
        { x: w * 0.62, y: botY, r: 8 + out[1] * 10, act: out[1], label: "arousal" },
      ]

      // edges: every fired input → every hidden; every hidden → both outputs.
      // weight = product of endpoint activations (what's actually flowing).
      edges = []
      for (const inp of inputs) for (const hd of hiddens)
        edges.push({ from: inp, to: hd, w: Math.min(1, inp.act * (0.4 + hd.act)) })
      for (const hd of hiddens) for (const o of outputs)
        edges.push({ from: hd, to: o, w: Math.min(1, hd.act * (0.5 + o.act)) })

      lastText = textRef.current
    }

    function spawn() {
      // emit particles from the strongest edges, proportional to their weight —
      // so the eye sees where the signal actually flows.
      for (const e of edges) {
        if (e.w > 0.12 && Math.random() < e.w * 0.08) {
          particles.push({ edge: e, t: 0, speed: 0.012 + e.w * 0.02 })
        }
      }
      if (particles.length > 500) particles.splice(0, particles.length - 500)
    }

    function frame() {
      if (textRef.current !== lastText) rebuild(false)
      ctx!.clearRect(0, 0, w, h)

      // faint wireframe box (the instrument frame)
      ctx!.strokeStyle = "rgba(150,160,185,0.12)"
      ctx!.lineWidth = 1
      ctx!.strokeRect(10, 10, w - 20, h - 20)

      // edges — thin streamlines, brighter with weight
      for (const e of edges) {
        if (e.w < 0.06) continue
        ctx!.beginPath()
        ctx!.moveTo(e.from.x, e.from.y)
        const cx = (e.from.x + e.to.x) / 2
        ctx!.bezierCurveTo(cx, e.from.y + 30, cx, e.to.y - 30, e.to.x, e.to.y)
        ctx!.strokeStyle = actColor((e.from.act + e.to.act) / 2, 0.05 + e.w * 0.22)
        ctx!.lineWidth = 0.4 + e.w * 1.2
        ctx!.stroke()
      }

      // particles flowing down the edges
      spawn()
      particles = particles.filter((p) => p.t < 1)
      for (const p of particles) {
        p.t += p.speed
        const { from, to } = p.edge
        const cx = (from.x + to.x) / 2
        const t = p.t, mt = 1 - t
        const x = mt * mt * mt * from.x + 3 * mt * mt * t * cx + 3 * mt * t * t * cx + t * t * t * to.x
        const y = mt * mt * mt * from.y + 3 * mt * mt * t * (from.y + 30) + 3 * mt * t * t * (to.y - 30) + t * t * t * to.y
        ctx!.beginPath()
        ctx!.arc(x, y, 1.3 + p.edge.w * 1.6, 0, Math.PI * 2)
        ctx!.fillStyle = actColor(p.edge.to.act, 0.8)
        ctx!.fill()
      }

      // nodes — glowing circles, size+glow = activation
      const drawNode = (n: Node, ring: boolean) => {
        const g = ctx!.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 2.4)
        g.addColorStop(0, actColor(n.act, 0.9))
        g.addColorStop(1, actColor(n.act, 0))
        ctx!.beginPath(); ctx!.arc(n.x, n.y, n.r * 2.4, 0, Math.PI * 2)
        ctx!.fillStyle = g; ctx!.fill()
        ctx!.beginPath(); ctx!.arc(n.x, n.y, n.r, 0, Math.PI * 2)
        ctx!.fillStyle = actColor(n.act, 0.95); ctx!.fill()
        if (ring) {
          ctx!.beginPath(); ctx!.arc(n.x, n.y, n.r + 2, 0, Math.PI * 2)
          ctx!.strokeStyle = actColor(n.act, 0.5); ctx!.lineWidth = 1; ctx!.stroke()
        }
      }
      for (const n of hiddens) drawNode(n, true)
      for (const n of inputs) drawNode(n, false)
      for (const n of outputs) drawNode(n, true)

      // labels for inputs (the cues) + outputs
      ctx!.font = "9px ui-monospace, monospace"
      ctx!.textAlign = "center"
      for (const n of inputs) {
        if (n.label && n.act > 0.05) {
          ctx!.fillStyle = actColor(n.act, 0.75)
          ctx!.fillText(n.label, n.x, n.y - n.r - 5)
        }
      }
      for (const n of outputs) {
        ctx!.fillStyle = actColor(n.act, 0.8)
        ctx!.fillText(n.label!, n.x, n.y + n.r + 14)
      }

      // layer captions (left)
      ctx!.font = "8px ui-monospace, monospace"
      ctx!.textAlign = "left"
      ctx!.fillStyle = "rgba(150,160,185,0.4)"
      ctx!.fillText("INPUT CUES", 16, 46)
      ctx!.fillText("HIDDEN NEURONS", 16, h * 0.52 - 16)
      ctx!.fillText("FELT OUTPUT", 16, h - 46)

      raf = requestAnimationFrame(frame)
    }

    resize()
    window.addEventListener("resize", resize)
    frame()
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize) }
  }, [height])

  return (
    <canvas
      ref={canvasRef}
      className="w-full rounded-2xl border border-border"
      style={{ height, background: "radial-gradient(130% 90% at 50% 20%, #0b0a14 0%, #060509 70%, #040407 100%)" }}
    />
  )
}
