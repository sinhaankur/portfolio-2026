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

export function PiIrrational({ heroMode = false }: { heroMode?: boolean } = {}) {
  // heroMode = the cinematic page-hero treatment: the curve alone in a black
  // void (like the reel), controls collapsed behind a single toggle, cinematic
  // glow + ambient music on by default. The full control deck stays available
  // for the standalone/embedded use.
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ratioIdx, setRatioIdx] = useState(0)
  const [running, setRunning] = useState(true)
  // heroMode starts slower — the reel's hypnotic, contemplative accumulation —
  // while the standalone stays livelier. Slider still spans 0.1×–5×.
  const [speed, setSpeed] = useState(heroMode ? 0.85 : 1.6)
  const [turns, setTurns] = useState(0)
  const [fs, setFs] = useState(false)
  const [zoomOn, setZoomOn] = useState(false)    // opt-in closing zoom-OUT reveal (default = full rosette)
  const [trails, setTrails] = useState(true)     // show the two moving arms + dots (the mechanism)
  const [cinematic, setCinematic] = useState(heroMode)  // luminous glow look vs. clean reference loops
  const [music, setMusic] = useState(false)      // generative bed (starts on first user gesture in heroMode)
  const [controlsOpen, setControlsOpen] = useState(!heroMode) // hero collapses the deck
  const rafRef = useRef<number | null>(null)
  const tRef = useRef(0)
  const holdRef = useRef(0)                      // 0→1 opening beat (arms at rest)
  const introRef = useRef(0)                     // 0→1 cinematic slow-start ramp
  const outRef = useRef(0)                        // 0→1 closing zoom-OUT reveal ("never closes")
  const cineZoomRef = useRef(0)                    // 0→1 how much cinematic breathing-zoom is engaged
  const cinePhaseRef = useRef(0)                   // seconds phase for the breathing sine
  const zoomRef = useRef(1)                       // eased current zoom factor
  const camRef = useRef({ x: 0, y: 0 })          // eased camera focus (world coords)
  const lastCam = useRef({ x: 0, y: 0, z: 1 }).current  // prev-frame cam, for smear detect
  const userZoomRef = useRef(1)                   // scroll/pinch zoom multiplier (0.5–8×)
  const clickTargetRef = useRef<{ x: number; y: number } | null>(null) // click-to-follow point
  const [exploring, setExploring] = useState(false) // user has taken the camera
  const speedRef = useRef(speed)
  const runRef = useRef(running)
  const zoomOnRef = useRef(zoomOn)
  const trailsRef = useRef(trails)
  const cinematicRef = useRef(cinematic)
  speedRef.current = speed
  runRef.current = running
  zoomOnRef.current = zoomOn
  trailsRef.current = trails
  cinematicRef.current = cinematic

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
    holdRef.current = 0       // replay the opening swing
    introRef.current = 0      // replay the cinematic slow-start
    outRef.current = 0        // reset the closing zoom-out reveal
    zoomRef.current = 1       // back to the centered 1× framing
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

  // EXPLORE: scroll/pinch to zoom, click to fly the camera to a point + follow it.
  // Converts a screen point back to WORLD coords using the current camera, so a
  // click lands where you actually clicked regardless of zoom/pan.
  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    const screenToWorld = (sx: number, sy: number) => {
      const box = cv.getBoundingClientRect()
      const W = box.width, H = box.height
      const z = zoomRef.current * userZoomRef.current
      const cam = camRef.current
      // inverse of the draw transform: world = cam + (screen - center)/z
      return { x: cam.x + (sx - box.left - W / 2) / z, y: cam.y + (sy - box.top - H / 2) / z }
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const f = Math.exp(-e.deltaY * 0.0015)            // smooth exponential zoom
      userZoomRef.current = Math.min(8, Math.max(0.5, userZoomRef.current * f))
      setExploring(true)
    }
    const onClick = (e: MouseEvent) => {
      // ignore clicks in the bottom ~76px control strip (or top chip row) so the
      // canvas fly-to never competes with Pause / the other buttons.
      const box = cv.getBoundingClientRect()
      const y = e.clientY - box.top
      if (y > box.height - 76 || y < 52) return
      clickTargetRef.current = screenToWorld(e.clientX, e.clientY)
      setExploring(true)
    }
    // pinch (two-finger) zoom on touch
    let pinchStart = 0, pinchZoom0 = 1
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
    const onTouchStart = (e: TouchEvent) => { if (e.touches.length === 2) { pinchStart = dist(e.touches); pinchZoom0 = userZoomRef.current } }
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchStart) {
        e.preventDefault()
        userZoomRef.current = Math.min(8, Math.max(0.5, pinchZoom0 * (dist(e.touches) / pinchStart)))
        setExploring(true)
      }
    }
    cv.addEventListener("wheel", onWheel, { passive: false })
    cv.addEventListener("click", onClick)
    cv.addEventListener("touchstart", onTouchStart, { passive: false })
    cv.addEventListener("touchmove", onTouchMove, { passive: false })
    return () => {
      cv.removeEventListener("wheel", onWheel); cv.removeEventListener("click", onClick)
      cv.removeEventListener("touchstart", onTouchStart); cv.removeEventListener("touchmove", onTouchMove)
    }
  }, [])

  const resetView = useCallback(() => {
    userZoomRef.current = 1; clickTargetRef.current = null; setExploring(false)
  }, [])

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
      // CLEAR STRATEGY — the trailing fade only works when the CAMERA IS STILL.
      // The fade is a screen-space rect, but the curve is drawn in the zoomed/
      // panned camera space; if the camera is moving, last frame's strokes are at
      // a different screen position, so the faint fade can't erase them and they
      // SMEAR/drift ("the background going crazy"). So: hard-clear to black on any
      // frame where the camera moves (opening, intro push-in, tip-follow, or the
      // user zooming/panning). Only accumulate a trail when the camera is settled.
      const inOpening = holdRef.current < 1 && runRef.current
      // measure how much the camera actually moved THIS frame (pan + zoom). Only
      // a fast-moving camera smears the trail; a settled one (even with the gentle
      // tip-follow) is fine to accumulate. So: hard-clear only above a threshold.
      const zNow = zoomRef.current * userZoomRef.current
      const dCamX = Math.abs(camRef.current.x - lastCam.x)
      const dCamY = Math.abs(camRef.current.y - lastCam.y)
      const dZoom = Math.abs(zNow - lastCam.z)
      // ALWAYS hard-clear to black, then redraw the WHOLE traced curve fresh each
      // frame (below). That is the reel's exact look: distinct thin grey loops, all
      // history shown, but NO accumulation white-out and no smear. (The old fading
      // long-exposure piled the grey lines into an opaque blob — wrong model.)
      // `trails` now only chooses whether the two moving ARMS/dots are drawn.
      void inOpening; void dCamX; void dCamY; void dZoom
      lastCam.x = camRef.current.x; lastCam.y = camRef.current.y; lastCam.z = zNow
      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H)

      // ---- FIXED, CENTERED camera — faithful to the reference reel -------------
      // The reel does NOT push in or follow the tip: the frame stays put and the
      // rosette accumulates in place, centered. The only camera move is the
      // closing payoff — a slow ZOOM-OUT that grows the two arms into enormous
      // lines crossing the whole frame ("it never actually closes — it just keeps
      // going"), then the loop restarts small. `outRef` (0→1) drives that reveal;
      // it engages late in the run. Everything stays locked to screen-center.
      // The DEFAULT resting view is the full-frame rosette (the look you endorsed).
      // The zoom-OUT reveal ("it never closes — the arms are huge") is OPT-IN via
      // the Reveal button, and it's a gentle ONE-WAY breath-out that then eases
      // back, never getting stuck. It's drifted by real seconds (not turn-count) so
      // speed doesn't blow past it. When Reveal is on, outRef rises to 1 over ~4s,
      // holds briefly, then the button resets it; when off it always eases to 0.
      if (zoomOnRef.current && holdRef.current >= 1) {
        outRef.current = Math.min(1, outRef.current + 1 / (4 * 60))   // ~4s pull-back
      } else {
        outRef.current = Math.max(0, outRef.current - 1 / (1.5 * 60)) // ease back in ~1.5s
      }
      const outEase = outRef.current * outRef.current * (3 - 2 * outRef.current)
      // CINEMATIC breathing zoom — what you'd do on a clip in After Effects: a slow
      // push-in then pull-out that never stops, so the frame feels alive and shot.
      // A gentle sine (period ~22s) around 1×, ±10%, eased in only in cinematic
      // mode; reference mode stays locked at 1×. Layers under the reveal pull-back.
      const cineTarget = cinematicRef.current ? 1 : 0
      cineZoomRef.current += (cineTarget - cineZoomRef.current) * 0.03   // ease the breathing in/out
      const cineAmt = cineZoomRef.current
      cinePhaseRef.current += 1 / 60
      const breathe = 1 + cineAmt * 0.10 * Math.sin(cinePhaseRef.current * (TAU / 22))
      const targetZoom = (1 - 0.78 * outEase) * breathe   // reveal pull-back × cinematic breathing
      zoomRef.current += (targetZoom - zoomRef.current) * 0.03
      // camera focus. The reference reel keeps the frame FIXED and centred — the
      // figure accumulates in place, it does not chase the tip — so we stay
      // locked to screen-centre. A user click-to-fly point is the only override.
      const clicked = clickTargetRef.current
      if (clicked) {
        camRef.current.x += (clicked.x - camRef.current.x) * 0.06
        camRef.current.y += (clicked.y - camRef.current.y) * 0.06
      } else {
        camRef.current.x += (cx - camRef.current.x) * 0.06
        camRef.current.y += (cy - camRef.current.y) * 0.06
      }
      // effective zoom = the reveal zoom × the user's scroll/pinch zoom
      const z = zoomRef.current * userZoomRef.current
      // apply: screen-center, scale, then translate so the camera focus sits center
      ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (cx - camRef.current.x * z), dpr * (cy - camRef.current.y * z))

      if (runRef.current) {
        const t = tRef.current
        // A DIRECTED OPENING, not a loop. The reference doesn't just spin — it
        // (1) shows the two bare arms at rest, (2) starts them turning slowly so
        // the curve traces from nothing, (3) accelerates into the full flower.
        // holdRef counts a ~1.2s opening beat where the arms sit still (t doesn't
        // advance) — so you SEE the mechanism before it moves. Then the intro
        // ramp eases speed from a crawl up to the chosen speed over ~7s.
        holdRef.current = Math.min(1, holdRef.current + 1 / (1.6 * 60))   // ~1.6s opening
        const opening = holdRef.current < 1
        if (opening) {
          // THE WARRIOR SWING: don't sit still — the arms wind BACK then swing
          // FORWARD with momentum, like a fighter loading a strike, before the
          // real motion takes over. A back-then-over-then-settle easing on t.
          const h = holdRef.current
          // wind-up (dips negative), then a decisive forward swing past, easing in
          const swing = -0.9 * Math.sin(h * Math.PI * 0.5) * (1 - h)      // pull back, release
                        + 1.7 * (h * h)                                    // accelerate forward
          tRef.current = swing
          introRef.current = 0
        } else {
          introRef.current = Math.min(1, introRef.current + 1 / (4 * 60))   // ~4s build
        }
        const introEase = introRef.current * introRef.current * (3 - 2 * introRef.current) // smoothstep
        // build from a gentle crawl up to the chosen speed — reaches the full
        // rosette in a few seconds, then flows, cinematic and readable.
        const effSpeed = opening ? 0 : (0.25 + (speedRef.current - 0.25) * introEase)
        const dt = 0.02 * effSpeed
        // sub-steps per frame scale with speed so the curve stays SMOOTH (no gaps)
        // at any speed — quality holds throughout the ramp.
        const stepCount = Math.max(40, Math.round(90 * effSpeed))
        const seg = (dt * 70) / stepCount

        // FAITHFUL TO THE REEL: clean, uniform, thin GREY-WHITE loops on black —
        // no bloom, no rainbow, no glowing tip. Each pass lays another faint ring
        // and they persist, building the rosette in place. One flat stroke, drawn
        // over-source so lines stay even (not additively blown out where they
        // cross). Width divides by zoom so it holds weight through the reveal.
        ctx.lineCap = "round"; ctx.lineJoin = "round"
        ctx.globalCompositeOperation = "source-over"
        // Redraw a FIXED WINDOW of recent history (not 0→now) so the rosette holds
        // its beautiful DISTINCT-LOOP density forever instead of piling into a solid
        // grey mass. ~26 turns keeps exactly the clean overlapping-loops look of the
        // reel. Older strokes gently fade out at the trailing edge of the window so
        // there's no hard cut-off — the figure looks continuous and alive.
        const drawEnd = t + stepCount * seg
        const HISTORY = TAU * 26
        const winStart = Math.max(0, drawEnd - HISTORY)
        const drawSteps = Math.min(6000, Math.max(stepCount, Math.ceil((drawEnd - winStart) / seg)))
        const dseg = (drawEnd - winStart) / drawSteps
        ctx.lineCap = "round"; ctx.lineJoin = "round"
        const cine = cinematicRef.current
        // one pass over the history window; in CINEMATIC mode we stroke it a few
        // times additively (wide faint halo → mid bloom → crisp core) for a
        // luminous long-exposure look; in REFERENCE mode it's a single flat grey
        // line like the reel. Both share the oldest-slice fade-in.
        const passes = cine
          ? [ { w: 4.2, a: 0.05, c: "224,232,255", op: "lighter" as GlobalCompositeOperation },
              { w: 1.7, a: 0.14, c: "224,232,255", op: "lighter" as GlobalCompositeOperation },
              { w: 0.8, a: 0.9,  c: "236,242,255", op: "lighter" as GlobalCompositeOperation } ]
          : [ { w: 0.85, a: 0.5, c: "206,213,224", op: "source-over" as GlobalCompositeOperation } ]
        for (const pass of passes) {
          ctx.globalCompositeOperation = pass.op
          ctx.lineWidth = pass.w / z
          ctx.beginPath()
          ctx.strokeStyle = `rgba(${pass.c},${pass.a})`
          for (let i = 0; i <= drawSteps; i++) {
            const f = i / drawSteps
            const [x, y] = tip(winStart + i * dseg)
            if (i === 0) { ctx.moveTo(x, y); continue }
            ctx.lineTo(x, y)
            if (f < 0.12 && i % 8 === 0) {
              ctx.globalAlpha = f / 0.12
              ctx.stroke()
              ctx.beginPath(); ctx.moveTo(x, y)
            }
          }
          ctx.globalAlpha = 1
          ctx.stroke()
        }
        ctx.globalCompositeOperation = "source-over"

        // GUIDE CIRCLES — the two clean bright rings the reel shows: the fixed
        // outer circle (first arm's reach) and the moving inner circle (centred on
        // the elbow, second arm's reach). Quiet but crisp — they frame the figure.
        {
          const t2g = t + stepCount * seg
          const ejx = cx + r1 * Math.cos(t2g), ejy = cy + r1 * Math.sin(t2g)
          ctx.strokeStyle = "rgba(196,204,220,0.28)"; ctx.lineWidth = 0.8 / z
          ctx.beginPath(); ctx.arc(cx, cy, r1, 0, TAU); ctx.stroke()   // outer, fixed
          ctx.beginPath(); ctx.arc(ejx, ejy, r2, 0, TAU); ctx.stroke() // inner, moving
        }

        // THE ACTIVE LOOP — exactly like the reel: the dim grey rosette is the
        // history; the MOST RECENT pass is picked out BRIGHTER (soft white), with
        // small glowing beads spaced along it (the sample points). This is what
        // makes the motion read without a heavy glow — a subtle bright leading loop
        // over quiet grey. Length ≈ one full pass, fading in from the grey.
        {
          const loopLen = TAU * 1.0
          const tStart = Math.max(0, drawEnd - loopLen)
          const tSteps = Math.max(48, Math.ceil((drawEnd - tStart) / seg))
          const tSeg = (drawEnd - tStart) / tSteps
          const [x0, y0] = tip(tStart)
          const [x1, y1] = tip(drawEnd)
          // brighter recent loop, fading from grey→soft white toward the tip
          const grad = ctx.createLinearGradient(x0, y0, x1, y1)
          grad.addColorStop(0, "rgba(210,216,228,0)")
          grad.addColorStop(1, "rgba(238,243,252,0.9)")
          ctx.strokeStyle = grad
          ctx.lineWidth = 1.15 / z
          ctx.lineCap = "round"
          ctx.beginPath()
          for (let i = 0; i <= tSteps; i++) {
            const [x, y] = tip(tStart + i * tSeg)
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
          }
          ctx.stroke()
          // subtle beads along the active loop — small, spaced, gently brighter
          // toward the tip. Not a bloom; just tiny nodes like the reel.
          const beads = 22
          for (let k = 0; k <= beads; k++) {
            const f = k / beads
            const [bx, by] = tip(tStart + f * (drawEnd - tStart))
            const a = 0.12 + 0.5 * f * f          // fade in toward the tip
            ctx.fillStyle = `rgba(244,248,255,${a})`
            ctx.beginPath(); ctx.arc(bx, by, (1.0 + 0.6 * f) / z, 0, TAU); ctx.fill()
          }
          // CINEMATIC: a luminous bloom on the leading tip (additive radial glow)
          if (cine) {
            ctx.globalCompositeOperation = "lighter"
            const g = ctx.createRadialGradient(x1, y1, 0, x1, y1, 9 / z)
            g.addColorStop(0, "rgba(255,255,255,0.95)")
            g.addColorStop(1, "rgba(210,224,255,0)")
            ctx.fillStyle = g
            ctx.beginPath(); ctx.arc(x1, y1, 9 / z, 0, TAU); ctx.fill()
            ctx.globalCompositeOperation = "source-over"
          }
        }

        const t2 = t + stepCount * seg
        const a1 = t2, jx = cx + r1 * Math.cos(a1), jy = cy + r1 * Math.sin(a1)
        const [tx, ty] = tip(t2)

        // the two moving ARMS (pivot → elbow → tip) + three dots — the mechanism
        // the reel shows at rest and at the reveal. `trails` toggles them on/off so
        // you can watch just the pure figure if the moving arms feel distracting.
        if (trailsRef.current) {
          ctx.strokeStyle = "rgba(150,158,172,0.55)"; ctx.lineWidth = 0.9 / z
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(jx, jy); ctx.lineTo(tx, ty); ctx.stroke()
          const dot = (x: number, y: number, r: number, fill: string) => {
            ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, r / z, 0, TAU); ctx.fill()
          }
          dot(cx, cy, 2.4, "rgba(210,216,228,0.85)")   // pivot
          dot(jx, jy, 2.2, "rgba(190,197,210,0.8)")    // elbow
          // TIP — the drawing point. Like the reel it's a clean, crisp white dot
          // (not a big bloom) with just a whisper of glow in hero mode so the eye
          // can find it without it dominating the restrained black frame.
          if (heroMode) {
            ctx.globalCompositeOperation = "lighter"
            const g = ctx.createRadialGradient(tx, ty, 0, tx, ty, 5 / z)
            g.addColorStop(0, "rgba(255,255,255,0.55)")
            g.addColorStop(1, "rgba(200,220,255,0)")
            ctx.fillStyle = g
            ctx.beginPath(); ctx.arc(tx, ty, 5 / z, 0, TAU); ctx.fill()
            ctx.globalCompositeOperation = "source-over"
          }
          dot(tx, ty, 3.0, "rgba(255,255,255,1)")       // crisp white drawing dot
        }

        tRef.current = t2
        setTurns(Math.floor(t2 / TAU))
      }

      // Reset the transform (screen space) for the next frame's clear + overlays.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      // CINEMATIC: a filmic vignette so the eye rests on the luminous curve. In
      // reference mode we stay flat (a clean geometric line-drawing on black).
      if (cinematicRef.current) {
        ctx.globalCompositeOperation = "source-over"
        const vig = ctx.createRadialGradient(cx, cy, Math.min(W, H) * 0.30, cx, cy, Math.max(W, H) * 0.72)
        vig.addColorStop(0, "rgba(0,0,0,0)")
        vig.addColorStop(1, "rgba(2,3,8,0.55)")
        ctx.fillStyle = vig
        ctx.fillRect(0, 0, W, H)
      }

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

      {/* the current-state whisper — bottom-right, clear of the navbar + title.
          A quiet readout, never overlapping the page chrome. */}
      <div className="absolute bottom-24 right-4 z-20 text-right font-mono text-[10px] text-white/40 leading-relaxed max-w-[46%] hidden sm:block pointer-events-none">
        second arm turns at <span className="text-white/75">{ratio.label}</span>× the first
        <div className="mt-0.5 text-white/30">{ratio.rational ? "rational → the curve closes" : "irrational → it never closes"} · {turns} turns</div>
      </div>

      {/* heroMode: a single quiet toggle at the bottom-right instead of the full
          deck, so the curve owns the frame like the reference reel. Tapping it
          reveals the deck; it also kicks on the ambient music (first gesture). */}
      {heroMode && !controlsOpen && (
        <button
          onClick={() => { setControlsOpen(true); setMusic(true) }}
          className="absolute bottom-6 right-5 z-20 rounded-full px-4 py-2 font-mono text-[10px] tracking-widest uppercase bg-white/8 text-white/55 border border-white/15 backdrop-blur-sm hover:text-white hover:bg-white/15 transition"
        >
          ✦ controls · ♪
        </button>
      )}

      {/* controls — bottom, floating glass bar with the RATIO CHIPS on their own
          row on top, so nothing sits behind the navbar at the top of the page.
          z-20 keeps it ABOVE the canvas's full-cover click-to-fly handler so
          Pause and the other buttons always receive their clicks. In heroMode
          this stays hidden until the viewer opts in. */}
      <div className={`absolute bottom-0 inset-x-0 z-20 flex-col items-center gap-2 p-3 md:p-4
        bg-gradient-to-t from-black/80 via-black/45 to-transparent ${heroMode && !controlsOpen ? "hidden" : "flex"}`}>
        {heroMode && (
          <button
            onClick={() => setControlsOpen(false)}
            className={`${btn} self-end bg-black/30 text-white/50 border border-white/10 hover:text-white`}
          >
            hide ✕
          </button>
        )}
        {/* ratio chips — first row of the control cluster */}
        <div className="flex flex-wrap justify-center gap-1.5">
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
        {/* main controls row */}
        <div className="flex flex-wrap items-center justify-center gap-2">
        {/* Pause/Play — bigger, high-contrast, and a clear hit target so it's
            never hard to click (it sits above the canvas at z-20). */}
        <button
          onClick={() => setRunning((r) => !r)}
          aria-label={running ? "Pause" : "Play"}
          className="rounded-full px-5 py-2 font-mono text-[12px] tracking-wide bg-white text-black border border-white hover:bg-white/90 transition shadow-lg"
        >
          {running ? "❚❚ Pause" : "▶ Play"}
        </button>
        <button onClick={restart} className={`${btn} bg-black/30 text-white/70 border border-white/10 hover:text-white`}>Restart</button>
        <button onClick={() => setCinematic((c) => !c)} className={`${btn} ${cinematic ? "bg-amber-400/20 text-amber-100 border border-amber-300/50" : "bg-black/30 text-white/60 border border-white/10 hover:text-white"}`}>{cinematic ? "✦ Cinematic" : "Cinematic view"}</button>
        <button onClick={() => setZoomOn((z) => !z)} className={`${btn} ${zoomOn ? "bg-white/15 text-white border border-white/30" : "bg-black/30 text-white/60 border border-white/10 hover:text-white"}`}>{zoomOn ? "Reveal ⊙" : "Reveal off"}</button>
        <button onClick={() => setTrails((t) => !t)} className={`${btn} ${trails ? "bg-white/15 text-white border border-white/30" : "bg-black/30 text-white/60 border border-white/10 hover:text-white"}`}>{trails ? "Arms ⊹" : "Arms off"}</button>
        <button onClick={() => setMusic((m) => !m)} className={`${btn} ${music ? "bg-white/15 text-white border border-white/30" : "bg-black/30 text-white/60 border border-white/10 hover:text-white"}`}>{music ? "♪ on" : "♪ music"}</button>
        <label className="flex items-center gap-2 font-mono text-[10px] text-white/55 px-2">
          speed
          <input type="range" min={0.1} max={5} step={0.1} value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))} className="w-20 md:w-28 accent-white" aria-label="animation speed" />
          <span className="tabular-nums w-8 text-white/75">{speed.toFixed(1)}×</span>
        </label>
        <button onClick={toggleFs} className={`${btn} bg-black/30 text-white/70 border border-white/10 hover:text-white`}>{fs ? "Exit ⤢" : "Fullscreen ⛶"}</button>
          {exploring && (
            <button onClick={resetView} className={`${btn} bg-amber-400/15 text-amber-200 border border-amber-300/40`}>Reset view</button>
          )}
        </div>
      </div>

      {/* explore hint — bottom-left, clear of the navbar; fades once you explore */}
      {!exploring && (
        <div className="absolute bottom-24 left-4 z-20 font-mono text-[10px] text-white/35 leading-relaxed pointer-events-none hidden md:block">
          scroll to zoom<br />click a point to fly there
        </div>
      )}
    </div>
  )
}
