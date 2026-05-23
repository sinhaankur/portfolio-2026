"use client"

/**
 * SignalTuner — the Contact section, framed as an amateur-radio transmitter.
 *
 * Type a message, hit TRANSMIT — a brief outbound-pulse animation plays
 * while a real mailto: opens underneath. The aesthetic is operator's-desk,
 * not retrofuturistic kitsch: monospace eyebrows, faint SVG waveform that
 * rises in amplitude as the message grows, a status LED that cycles
 * STANDBY → KEYING → TRANSMITTING → SENT.
 *
 * No server. mailto: is the transport; the tuner is the surface.
 */

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ChangeEvent,
} from "react"
import { motion, useReducedMotion } from "framer-motion"

type TuneState = "standby" | "keying" | "transmitting" | "sent"

const STATE_LABEL: Record<TuneState, string> = {
  standby: "Standby",
  keying: "Keying",
  transmitting: "Transmitting",
  sent: "Sent",
}

/** Map state → LED colour. Uses CSS custom properties so it tracks
 *  whichever theme is active. */
function ledClass(state: TuneState): string {
  switch (state) {
    case "standby":
      return "bg-muted-foreground/40"
    case "keying":
      return "bg-accent/80 shadow-[0_0_10px_var(--accent)]"
    case "transmitting":
      return "bg-accent shadow-[0_0_14px_var(--accent)]"
    case "sent":
      return "bg-foreground/80 shadow-[0_0_10px_var(--foreground)]"
  }
}

export function SignalTuner({
  to,
  defaultSubject = "Transmission",
}: {
  /** Email address — used to build the mailto: URL on transmit. */
  to: string
  /** Subject line prefix; the operator callsign is appended if provided. */
  defaultSubject?: string
}) {
  const [operator, setOperator] = useState("")
  const [message, setMessage] = useState("")
  const [state, setState] = useState<TuneState>("standby")
  const prefersReducedMotion = useReducedMotion()

  // Refs the rAF loop reads so it doesn't re-subscribe on every keystroke.
  const stateRef = useRef<TuneState>(state)
  const messageRef = useRef<string>(message)
  const pathRef = useRef<SVGPathElement>(null)
  const pulseRef = useRef<SVGCircleElement>(null)
  const transmitStartRef = useRef<number | null>(null)
  // Auto-return to standby after a keystroke pause.
  const keyingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    stateRef.current = state
  }, [state])
  useEffect(() => {
    messageRef.current = message
  }, [message])

  /** Drive the waveform with a single rAF loop. Path data is mutated via
   *  ref instead of re-rendering React state every frame — perf is fine
   *  and we avoid the textarea losing focus mid-key. */
  useEffect(() => {
    if (prefersReducedMotion) {
      // Static low-amplitude trace so the element still reads as an
      // oscilloscope, just without motion.
      const path = pathRef.current
      if (path) {
        let d = "M 0 50"
        for (let x = 4; x <= 600; x += 4) {
          const y = 50 + Math.sin(x * 0.08) * 4
          d += ` L ${x} ${y.toFixed(1)}`
        }
        path.setAttribute("d", d)
      }
      return
    }
    let raf = 0
    let phase = 0
    const draw = () => {
      const path = pathRef.current
      const pulse = pulseRef.current
      if (!path) return
      const W = 600
      const H = 100
      const s = stateRef.current
      const msgLen = messageRef.current.length
      // Amplitude + frequency vary by state. Keying ramps with message
      // length so the wave visibly "builds" as you type.
      let amplitude = 5
      let frequency = 0.08
      let noise = 1.0
      if (s === "keying") {
        amplitude = 10 + Math.min(msgLen / 4, 22)
        frequency = 0.11
        noise = 1.8
      } else if (s === "transmitting") {
        amplitude = 34
        frequency = 0.18
        noise = 3.0
      } else if (s === "sent") {
        amplitude = 8
        frequency = 0.07
        noise = 0.6
      }
      // Build path with a fixed step. 4-unit step is the sweet spot
      // between visual smoothness and per-frame work.
      let d = `M 0 ${H / 2}`
      for (let x = 4; x <= W; x += 4) {
        const y =
          H / 2 +
          Math.sin(x * frequency + phase) * amplitude +
          (Math.random() - 0.5) * noise
        d += ` L ${x} ${y.toFixed(1)}`
      }
      path.setAttribute("d", d)

      // Transmission pulse — a bright dot that races across the wave
      // once when TRANSMIT fires. After it lands at the right edge,
      // the state flips to "sent" and the dot fades out.
      if (pulse) {
        if (s === "transmitting" && transmitStartRef.current != null) {
          const t = (performance.now() - transmitStartRef.current) / 800
          const tt = Math.min(t, 1)
          const px = tt * W
          const py = H / 2 + Math.sin(px * 0.18 + phase) * 34
          pulse.setAttribute("cx", String(px))
          pulse.setAttribute("cy", String(py.toFixed(1)))
          pulse.setAttribute("r", String(4 + (1 - tt) * 4))
          pulse.setAttribute("opacity", String(0.9))
        } else {
          pulse.setAttribute("opacity", "0")
        }
      }

      phase += 0.16
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [prefersReducedMotion])

  const handleMessageChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      setMessage(e.target.value)
      if (stateRef.current !== "transmitting" && stateRef.current !== "sent") {
        setState("keying")
        if (keyingTimerRef.current) clearTimeout(keyingTimerRef.current)
        keyingTimerRef.current = setTimeout(() => {
          // If the user stops keying for 1.4s, fall back to standby.
          // Guard against late timer fires interfering with transmit.
          if (stateRef.current === "keying") setState("standby")
        }, 1400)
      }
    },
    [],
  )

  const handleOperatorChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setOperator(e.target.value)
    },
    [],
  )

  const handleTransmit = useCallback(() => {
    const trimmed = message.trim()
    if (!trimmed) return
    if (state === "transmitting") return
    if (keyingTimerRef.current) clearTimeout(keyingTimerRef.current)
    setState("transmitting")
    transmitStartRef.current = performance.now()
    // Brief outbound animation, then hand off to the user's mail client.
    // The mailto: is the actual transport — the waveform is just the
    // surface that frames the act of sending.
    const visualDelay = prefersReducedMotion ? 200 : 820
    window.setTimeout(() => {
      const opLabel = operator.trim() || "Visitor"
      const subject = `${defaultSubject} · ${opLabel}`
      const body = trimmed
      const url = `mailto:${to}?subject=${encodeURIComponent(
        subject,
      )}&body=${encodeURIComponent(body)}`
      // Use a hidden anchor click so popup blockers treat it as a
      // user-gesture-initiated navigation. window.location works too
      // but the anchor path is friendlier to mobile mail apps.
      const a = document.createElement("a")
      a.href = url
      a.rel = "noopener"
      a.click()
      setState("sent")
      transmitStartRef.current = null
      window.setTimeout(() => {
        // Drop back to standby. We leave the form filled in so the
        // operator can edit + retransmit if their mail client cancelled.
        setState("standby")
      }, 2200)
    }, visualDelay)
  }, [message, operator, state, to, defaultSubject, prefersReducedMotion])

  const transmitDisabled =
    state === "transmitting" || message.trim().length === 0

  // Operator callsign placeholder — rotates per render to feel alive
  // without a database (e.g. a real ham radio shack would have a fixed
  // callsign; this site is open to anyone, so we cycle suggestive ones).
  const operatorPlaceholder = "Your name or shop"

  return (
    <div
      className="
        relative overflow-hidden rounded-lg border border-border
        bg-card/40 backdrop-blur-[2px]
      "
      role="group"
      aria-labelledby="signal-tuner-heading"
    >
      <h3 id="signal-tuner-heading" className="sr-only">
        Signal tuner — send a message
      </h3>

      {/* Header strip — frequency + status LED. Mono labels match the
          existing section-eyebrow rhythm so the panel reads as part of
          the same engineered surface as the rest of the page. */}
      <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-2.5">
        <span className="font-mono text-[10px] tracking-[0.25em] text-muted-foreground uppercase">
          TX · 14.230 MHz
        </span>
        <span
          className="flex items-center gap-2 font-mono text-[10px] tracking-[0.25em] text-muted-foreground uppercase"
          aria-live="polite"
        >
          <motion.span
            aria-hidden="true"
            className={`inline-block w-2 h-2 rounded-full ${ledClass(state)}`}
            animate={
              prefersReducedMotion
                ? undefined
                : state === "transmitting"
                  ? { scale: [1, 1.4, 1] }
                  : state === "keying"
                    ? { opacity: [0.6, 1, 0.6] }
                    : { scale: 1, opacity: 1 }
            }
            transition={{
              duration: state === "transmitting" ? 0.6 : 1.6,
              repeat:
                state === "transmitting" || state === "keying" ? Infinity : 0,
              ease: "easeInOut",
            }}
          />
          {STATE_LABEL[state]}
        </span>
      </div>

      {/* Waveform display. Uses currentColor so it picks up the
          surrounding text colour in either theme. Aspect set via
          fixed height + preserveAspectRatio="none" so the path stays
          legible at any container width. */}
      <div className="relative h-24 bg-background/30">
        <svg
          viewBox="0 0 600 100"
          preserveAspectRatio="none"
          className="w-full h-full text-foreground"
          aria-hidden="true"
        >
          <line
            x1="0"
            y1="50"
            x2="600"
            y2="50"
            stroke="currentColor"
            strokeOpacity="0.15"
            strokeWidth="0.5"
            strokeDasharray="2 4"
          />
          <path
            ref={pathRef}
            stroke="currentColor"
            strokeOpacity="0.7"
            strokeWidth="1.3"
            fill="none"
          />
          <circle
            ref={pulseRef}
            cx="0"
            cy="50"
            r="0"
            opacity="0"
            fill="var(--accent)"
          />
        </svg>
      </div>

      {/* Form. Two fields + a single primary action. Labels use the
          same eyebrow tokens as the header strip — visually quiet but
          informative. */}
      <div className="px-4 py-4 space-y-4">
        <label className="block">
          <span className="font-mono text-[10px] tracking-[0.25em] text-muted-foreground uppercase mb-1.5 block">
            Operator
          </span>
          <input
            type="text"
            value={operator}
            onChange={handleOperatorChange}
            placeholder={operatorPlaceholder}
            autoComplete="name"
            className="
              w-full bg-transparent border-0 border-b border-border/60
              px-0 py-2 font-sans text-base text-foreground
              placeholder:text-muted-foreground/50
              focus:outline-none focus:border-accent
              transition-colors
            "
          />
        </label>

        <label className="block">
          <span className="font-mono text-[10px] tracking-[0.25em] text-muted-foreground uppercase mb-1.5 block">
            Message
          </span>
          <textarea
            value={message}
            onChange={handleMessageChange}
            rows={3}
            placeholder="A specific problem, a rough timeline, or what you're stuck on."
            className="
              w-full resize-none bg-transparent border-0 border-b border-border/60
              px-0 py-2 font-sans text-base text-foreground leading-relaxed
              placeholder:text-muted-foreground/50
              focus:outline-none focus:border-accent
              transition-colors
            "
          />
        </label>

        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground/70 uppercase">
            Opens your mail client
          </p>
          <button
            type="button"
            onClick={handleTransmit}
            disabled={transmitDisabled}
            data-cursor-hover
            aria-label="Transmit message — opens your email client"
            className="
              group inline-flex items-center gap-2.5
              px-5 py-2.5 rounded-full border
              font-mono text-[11px] tracking-[0.25em] uppercase
              transition-colors duration-300
              min-h-11
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
              focus-visible:ring-offset-4 focus-visible:ring-offset-background
              disabled:opacity-40 disabled:cursor-not-allowed
              enabled:border-foreground/60 enabled:bg-foreground enabled:text-background
              enabled:hover:bg-accent enabled:hover:border-accent enabled:hover:text-accent-foreground
            "
          >
            <span
              aria-hidden="true"
              className="inline-block w-1.5 h-1.5 rounded-full bg-current"
            />
            {state === "transmitting"
              ? "Sending"
              : state === "sent"
                ? "Sent"
                : "Transmit"}
          </button>
        </div>
      </div>
    </div>
  )
}
