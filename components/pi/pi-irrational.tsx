"use client"

// The reason π "never completes", made visible — at its best.
//
// A point has two arms. The first turns at speed 1; the second at speed `ratio`,
// and its tip draws the curve. A RATIONAL ratio lines up after a whole number of
// turns and the curve CLOSES (finite flower). π is IRRATIONAL: the arms never
// align, so the tip never returns to its start — it lays a new, slightly-offset
// petal on every pass, forever. That is the same fact as "π has no exact value".
//
// This build: speed control, real fullscreen, HiDPI-crisp rendering, a glowing
// trail that fades so the freshest stroke leads while history lingers.
// Original implementation; the math is universal.

import { useCallback, useEffect, useRef, useState } from "react"

const TAU = Math.PI * 2

const RATIOS: { label: string; value: number; rational: boolean; note: string }[] = [
  { label: "π (irrational)", value: Math.PI, rational: false, note: "never closes — new petals forever" },
  { label: "3 (whole)", value: 3, rational: true, note: "closes after 1 turn — a clean 3-petal flower" },
  { label: "22/7 (≈π, rational)", value: 22 / 7, rational: true, note: "π's old approximation — LOOKS like π, but closes after 7 turns" },
  { label: "√2 (irrational)", value: Math.SQRT2, rational: false, note: "also never closes — irrationality isn't unique to π" },
]

export function PiIrrational() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ratioIdx, setRatioIdx] = useState(0)
  const [running, setRunning] = useState(true)
  const [speed, setSpeed] = useState(1)          // multiplier, 0.1×–5×
  const [turns, setTurns] = useState(0)
  const [fs, setFs] = useState(false)
  const [zoomOn, setZoomOn] = useState(true)     // cinematic push-in that follows the tip
  const [music, setMusic] = useState(false)      // opt-in generative bed
  const rafRef = useRef<number | null>(null)
  const tRef = useRef(0)
  const zoomRef = useRef(1)                       // eased current zoom factor
  const camRef = useRef({ x: 0, y: 0 })          // eased camera focus (world coords)
  const speedRef = useRef(speed)
  const runRef = useRef(running)
  const zoomOnRef = useRef(zoomOn)
  speedRef.current = speed
  runRef.current = running
  zoomOnRef.current = zoomOn

  const ratio = RATIOS[ratioIdx]
  const ratioRef = useRef(ratio)
  ratioRef.current = ratio

  // size the canvas to its box at device pixel ratio (crisp on Retina + fullscreen)
  const fit = useCallback(() => {
    const cv = canvasRef.current, wrap = wrapRef.current
    if (!cv || !wrap) return
    // HD render: honour the display's full pixel density (Retina ×2, ×3) and go
    // higher in fullscreen where the canvas is large — crisp lines at any size,
    // up to a sensible cap so a huge 5K/6K panel stays performant.
    const native = window.devicePixelRatio || 1
    const dpr = Math.min(document.fullscreenElement ? native * 1.5 : native, 4)
    const box = cv.getBoundingClientRect()
    cv.width = Math.round(box.width * dpr)
    cv.height = Math.round(box.height * dpr)
    const ctx = cv.getContext("2d")!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)      // draw in CSS pixels
    ctx.clearRect(0, 0, box.width, box.height)
  }, [])

  const restart = useCallback(() => {
    tRef.current = 0
    setTurns(0)
    fit()
  }, [fit])

  useEffect(() => { restart() }, [ratioIdx, restart])

  // refit on resize / fullscreen change
  useEffect(() => {
    fit()
    const onResize = () => fit()
    window.addEventListener("resize", onResize)
    const onFs = () => { setFs(!!document.fullscreenElement); setTimeout(fit, 60) }
    document.addEventListener("fullscreenchange", onFs)
    return () => { window.removeEventListener("resize", onResize); document.removeEventListener("fullscreenchange", onFs) }
  }, [fit])

  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    const ctx = cv.getContext("2d")!

    let frame = 0
    const draw = () => {
      frame++
      const box = cv.getBoundingClientRect()
      const W = box.width, H = box.height, cx = W / 2, cy = H / 2
      const R = Math.min(W, H) * 0.22
      const r1 = R, r2 = R
      const rt = ratioRef.current

      const tip = (t: number): [number, number] => {
        const a1 = t, a2 = t * rt.value
        return [cx + r1 * Math.cos(a1) + r2 * Math.cos(a2),
                cy + r1 * Math.sin(a1) + r2 * Math.sin(a2)]
      }

      // The reference's quality is ELEGANT RESTRAINT: thin luminous lines on pure
      // black, smooth continuous motion, the two guide-circles faintly visible.
      // A very slow fade keeps a long, clean tail without smearing. The fade runs
      // in SCREEN space (identity transform), so the zoom below never smears it.
      const dpr = cv.width / W
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.globalCompositeOperation = "source-over"
      // fade toward a near-black with the faintest blue — filmic, not flat black
      ctx.fillStyle = "rgba(3,4,9,0.022)"
      ctx.fillRect(0, 0, W, H)

      // ---- cinematic camera: ease a push-in that FOLLOWS the drawing tip ------
      // (the video's move). We compute the current tip, drift the camera toward
      // it, and ease the zoom in — then draw the whole scene through that frame.
      const now = tRef.current
      const [ctx0, cty0] = tip(now)
      const targetZoom = zoomOnRef.current ? 2.1 : 1
      zoomRef.current += (targetZoom - zoomRef.current) * 0.02      // slow, filmic ease
      if (zoomOnRef.current) {
        camRef.current.x += (ctx0 - camRef.current.x) * 0.035       // trail the tip, don't snap
        camRef.current.y += (cty0 - camRef.current.y) * 0.035
      } else {
        camRef.current.x += (cx - camRef.current.x) * 0.04
        camRef.current.y += (cy - camRef.current.y) * 0.04
      }
      const z = zoomRef.current
      // apply: screen-center, scale, then translate so the camera focus sits center
      ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (cx - camRef.current.x * z), dpr * (cy - camRef.current.y * z))

      if (runRef.current) {
        const t = tRef.current
        const dt = 0.02 * speedRef.current
        // sub-steps per frame scale with speed so the curve stays SMOOTH (no gaps)
        // at any speed — quality holds from 0.1× to 5×.
        const stepCount = Math.max(40, Math.round(90 * speedRef.current))
        const seg = (dt * 70) / stepCount

        // ELEGANT + MONOCHROME: one refined luminous line, not a rainbow. A cool
        // silver-white core over a whisper-thin wider halo — restrained, filmic.
        // widths divide by zoom so they stay the same visual weight as we push in.
        ctx.lineCap = "round"; ctx.lineJoin = "round"
        // rational curves get a soft mint (they'll close into a calm flower);
        // irrational π gets a cool argent white — timeless, not gaudy.
        const core = rt.rational ? "230,255,240" : "224,232,255"
        const stroke = (w: number, a: number) => {
          ctx.globalCompositeOperation = "lighter"
          ctx.lineWidth = w / z
          ctx.strokeStyle = `rgba(${core},${a})`
          ctx.beginPath()
          for (let i = 0; i <= stepCount; i++) {
            const [x, y] = tip(t + i * seg)
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
          }
          ctx.stroke()
        }
        stroke(4.0, 0.035)  // wide, faint atmosphere
        stroke(1.6, 0.10)   // mid bloom
        stroke(0.8, 0.85)   // crisp hairline core

        const t2 = t + stepCount * seg
        const a1 = t2, jx = cx + r1 * Math.cos(a1), jy = cy + r1 * Math.sin(a1)
        const [tx, ty] = tip(t2)

        // the two guide circles + arms — barely-there, elegant scaffolding
        ctx.globalCompositeOperation = "source-over"
        ctx.strokeStyle = "rgba(180,200,255,0.05)"; ctx.lineWidth = 1 / z
        ctx.beginPath(); ctx.arc(cx, cy, r1, 0, TAU); ctx.stroke()
        ctx.beginPath(); ctx.arc(jx, jy, r2, 0, TAU); ctx.stroke()
        ctx.strokeStyle = "rgba(210,220,255,0.18)"; ctx.lineWidth = 0.8 / z
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(jx, jy); ctx.lineTo(tx, ty); ctx.stroke()
        // pivot: a tiny, still point
        ctx.fillStyle = "rgba(220,228,255,0.35)"
        ctx.beginPath(); ctx.arc(cx, cy, 1.4, 0, TAU); ctx.fill()
        // leading tip — ONE clean luminous point (no scattered beads anywhere)
        ctx.globalCompositeOperation = "lighter"
        const g = ctx.createRadialGradient(tx, ty, 0, tx, ty, 7 / z)
        g.addColorStop(0, "rgba(255,255,255,0.9)")
        g.addColorStop(1, "rgba(210,224,255,0)")
        ctx.fillStyle = g
        ctx.beginPath(); ctx.arc(tx, ty, 7 / z, 0, TAU); ctx.fill()
        ctx.fillStyle = "#ffffff"
        ctx.beginPath(); ctx.arc(tx, ty, 1.3 / z, 0, TAU); ctx.fill()

        tRef.current = t2
        setTurns(Math.floor(t2 / TAU))
      }

      // filmic vignette (screen space, on top) — darkens the edges so the eye
      // rests on the luminous curve. Subtle; this is what makes it feel "shot".
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.globalCompositeOperation = "source-over"
      const vig = ctx.createRadialGradient(cx, cy, Math.min(W, H) * 0.28, cx, cy, Math.max(W, H) * 0.72)
      vig.addColorStop(0, "rgba(0,0,0,0)")
      vig.addColorStop(1, "rgba(2,3,8,0.5)")
      ctx.fillStyle = vig
      ctx.fillRect(0, 0, W, H)

      rafRef.current = requestAnimationFrame(draw)
    }
    rafRef.current = requestAnimationFrame(draw)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])

  // ---- original generative music: a slow, evolving ambient bed synthesized in
  // Web Audio (no samples, nothing copyrighted). Opt-in; starts only on click,
  // never autoplays. A drone + drifting overtones that swell as the curve fills —
  // "math and music go hand in hand": the notes are a simple harmonic series,
  // the same kind of whole-number ratios that decide whether the curve closes.
  const audioRef = useRef<{ ac: AudioContext; master: GainNode; stop: () => void } | null>(null)
  useEffect(() => {
    if (!music) { audioRef.current?.stop(); audioRef.current = null; return }
    try {
      const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)
      const ac = new AC()
      const master = ac.createGain()
      master.gain.value = 0
      master.gain.linearRampToValueAtTime(0.14, ac.currentTime + 3)  // gentle fade-in
      master.connect(ac.destination)
      // a soft low drone + a few harmonics (ratios 1, 3/2, 2, 5/2) that slowly
      // detune — consonant, calm, a little wistful
      const base = 110 // A2
      const partials = [1, 1.5, 2, 2.5, 3]
      const oscs = partials.map((p, i) => {
        const o = ac.createOscillator(); o.type = i === 0 ? "sine" : "triangle"
        o.frequency.value = base * p
        const g = ac.createGain(); g.gain.value = (i === 0 ? 0.5 : 0.12) / (i + 1)
        // slow LFO on gain so each voice breathes independently
        const lfo = ac.createOscillator(); lfo.frequency.value = 0.05 + i * 0.017
        const lg = ac.createGain(); lg.gain.value = g.gain.value * 0.6
        lfo.connect(lg); lg.connect(g.gain); lfo.start()
        o.connect(g); g.connect(master); o.start()
        return { o, lfo }
      })
      audioRef.current = {
        ac, master,
        stop: () => {
          try {
            master.gain.cancelScheduledValues(ac.currentTime)
            master.gain.linearRampToValueAtTime(0, ac.currentTime + 0.8)
            setTimeout(() => { oscs.forEach(({ o, lfo }) => { try { o.stop(); lfo.stop() } catch { /* */ } }); ac.close() }, 900)
          } catch { /* */ }
        },
      }
    } catch { /* audio unavailable — silently ignore */ }
    return () => { audioRef.current?.stop(); audioRef.current = null }
  }, [music])

  const toggleFs = useCallback(() => {
    const el = wrapRef.current
    if (!el) return
    if (document.fullscreenElement) document.exitFullscreen?.()
    else el.requestFullscreen?.().catch(() => {})
  }, [])

  const btn = "rounded-full px-3 py-1.5 font-mono text-[11px] tracking-wide backdrop-blur-md transition"
  return (
    // A cinematic black stage: the curve fills the frame; every control floats
    // over it in glass, so nothing competes with the art. Tall on the page,
    // taller in fullscreen. No academic box, no side column.
    <div
      ref={wrapRef}
      className={`relative overflow-hidden bg-black ${fs ? "h-full" : "w-full h-[62vh] min-h-[420px] md:h-[78vh]"}`}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full bg-black" />

      {/* ratio chips — top center, floating */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex flex-wrap justify-center gap-1.5">
        {RATIOS.map((r, i) => (
          <button
            key={r.label}
            onClick={() => setRatioIdx(i)}
            className={`${btn} ${i === ratioIdx ? "bg-white/15 text-white border border-white/30" : "bg-black/30 text-white/55 border border-white/10 hover:text-white/85"}`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* the current-state whisper — top left */}
      <div className="absolute top-4 left-4 z-10 font-mono text-[10px] text-white/45 leading-relaxed max-w-[42%] hidden sm:block">
        second arm turns at <span className="text-white/80">{ratio.label}</span>× the first
        <div className="mt-0.5 text-white/35">{ratio.rational ? "rational → the curve closes" : "irrational → it never closes"} · {turns} turns</div>
      </div>

      {/* controls — bottom, floating glass bar */}
      <div className="absolute bottom-0 inset-x-0 z-10 flex flex-wrap items-center justify-center gap-2 p-3 md:p-4
        bg-gradient-to-t from-black/70 via-black/30 to-transparent">
        <button onClick={() => setRunning((r) => !r)} className={`${btn} bg-white/12 text-white border border-white/25`}>{running ? "Pause" : "Play"}</button>
        <button onClick={restart} className={`${btn} bg-black/30 text-white/70 border border-white/10 hover:text-white`}>Restart</button>
        <button onClick={() => setZoomOn((z) => !z)} className={`${btn} ${zoomOn ? "bg-white/15 text-white border border-white/30" : "bg-black/30 text-white/60 border border-white/10 hover:text-white"}`}>{zoomOn ? "Zoom ⊙" : "Zoom off"}</button>
        <button onClick={() => setMusic((m) => !m)} className={`${btn} ${music ? "bg-white/15 text-white border border-white/30" : "bg-black/30 text-white/60 border border-white/10 hover:text-white"}`}>{music ? "♪ on" : "♪ music"}</button>
        <label className="flex items-center gap-2 font-mono text-[10px] text-white/55 px-2">
          speed
          <input type="range" min={0.1} max={5} step={0.1} value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))} className="w-20 md:w-28 accent-white" aria-label="animation speed" />
          <span className="tabular-nums w-8 text-white/75">{speed.toFixed(1)}×</span>
        </label>
        <button onClick={toggleFs} className={`${btn} bg-black/30 text-white/70 border border-white/10 hover:text-white`}>{fs ? "Exit ⤢" : "Fullscreen ⛶"}</button>
      </div>
    </div>
  )
}
