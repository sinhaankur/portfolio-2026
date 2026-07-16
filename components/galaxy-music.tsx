"use client"

import { useEffect, useRef, useState } from "react"
import { SpaceDrone } from "@/lib/space-drone"

const TRACK_URL =
  "https://soundcloud.com/ludovicoeinaudi/experience-reimagined"

// SoundCloud Widget API loaded once and cached.
type SCWidget = {
  bind: (event: string, cb: () => void) => void
  play: () => void
  pause: () => void
  setVolume: (v: number) => void
}
type SCAPI = {
  Widget: ((iframe: HTMLIFrameElement) => SCWidget) & {
    Events: { READY: string; PLAY: string; PAUSE: string; FINISH: string }
  }
}

declare global {
  interface Window {
    SC?: SCAPI
  }
}

const SC_API_SRC = "https://w.soundcloud.com/player/api.js"

function loadSoundCloudAPI(): Promise<SCAPI> {
  return new Promise((resolve, reject) => {
    if (window.SC) return resolve(window.SC)
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SC_API_SRC}"]`,
    )
    if (existing) {
      existing.addEventListener("load", () => {
        if (window.SC) resolve(window.SC)
        else reject(new Error("SoundCloud API failed to load"))
      })
      existing.addEventListener("error", () => reject(new Error("SC script error")))
      return
    }
    const script = document.createElement("script")
    script.src = SC_API_SRC
    script.async = true
    script.onload = () => {
      if (window.SC) resolve(window.SC)
      else reject(new Error("SoundCloud API failed to load"))
    }
    script.onerror = () => reject(new Error("SC script error"))
    document.head.appendChild(script)
  })
}

// The one music control cycles: quiet -> piano (Einaudi via SoundCloud) ->
// deep-field drone (original, synthesized live in lib/space-drone.ts) -> quiet.
// A single button keeps the TV story simple: the webOS remote's OK key clicks
// this same button (see sky-experience.tsx), so the cycle IS the TV UX. And
// because the drone is pure Web Audio, music survives even where the
// SoundCloud embed can't load (some TVs, blockers) — the cycle just skips
// the piano.
type MusicMode = "off" | "piano" | "drone"

const MODE_LABEL: Record<MusicMode, string> = {
  off: "quiet",
  piano: "piano — einaudi",
  drone: "deep field — drone",
}

export function GalaxyMusic() {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const widgetRef = useRef<SCWidget | null>(null)
  const widgetReadyRef = useRef(false)
  const queuedActionRef = useRef<"play" | "pause" | null>(null)
  const droneRef = useRef<SpaceDrone | null>(null)
  const modeRef = useRef<MusicMode>("off")
  const [mode, setMode] = useState<MusicMode>("off")
  const [loadError, setLoadError] = useState(false)
  // PERF: the SoundCloud iframe + Widget API (~120 KB, 10 cross-origin requests,
  // third-party cookies) used to load on mount on every page that shows the music
  // chip — before the user ever opts in. We now defer ALL of it until the first
  // click, so the home/celestial/star-cleaver first load carries none of it.
  // Playback stays strictly opt-in (CLAUDE.md), and now so does the loading.
  const [activated, setActivated] = useState(false)

  // Transient caption so every press has visible feedback (the icon alone
  // can't say WHICH track you just landed on — matters on TV where the
  // "button" is an invisible OK key).
  const [labelVisible, setLabelVisible] = useState(false)
  const firstModeRef = useRef(true)

  const applyMode = (m: MusicMode) => {
    modeRef.current = m
    setMode(m)
  }

  useEffect(() => {
    if (firstModeRef.current) {
      firstModeRef.current = false
      return
    }
    setLabelVisible(true)
    const t = setTimeout(() => setLabelVisible(false), 4000)
    return () => clearTimeout(t)
  }, [mode])

  // Bind the widget only once the iframe has been mounted (after first click).
  useEffect(() => {
    if (!activated) return
    let cancelled = false

    const bindWidget = (SC: SCAPI) => {
      if (cancelled || !iframeRef.current) return
      const widget = SC.Widget(iframeRef.current)
      widgetRef.current = widget
      widget.bind(SC.Widget.Events.READY, () => {
        if (cancelled) return
        widgetReadyRef.current = true
        widget.setVolume(45)
        if (queuedActionRef.current === "play") widget.play()
        else if (queuedActionRef.current === "pause") widget.pause()
        queuedActionRef.current = null
      })
      // No PAUSE bind on purpose: PAUSE only ever fires from our own
      // piano→drone handoff or from a silently-failed play() (some TVs). If it
      // regressed the mode to "off", a TV with a broken SoundCloud embed would
      // loop piano-retry forever and never reach the drone — pressing the
      // button must always move the cycle forward. Only FINISH ends the piano.
      widget.bind(SC.Widget.Events.FINISH, () => {
        if (!cancelled && modeRef.current === "piano") applyMode("off")
      })
    }

    loadSoundCloudAPI()
      .then(bindWidget)
      .catch(() => { if (!cancelled) setLoadError(true) })

    return () => {
      cancelled = true
      try { widgetRef.current?.pause() } catch { /* already torn down */ }
    }
  }, [activated])

  // Stop the drone if the page unmounts under us.
  useEffect(() => () => droneRef.current?.stop(), [])

  const advance = () => {
    const drone = (droneRef.current ??= new SpaceDrone())
    if (mode === "off") {
      if (loadError) {
        // Piano unavailable — the cycle becomes quiet <-> drone.
        drone.start()
        applyMode("drone")
        return
      }
      // First click: mount the iframe + load the API, and queue play. The bind
      // effect picks up `activated` and starts playback once READY fires.
      queuedActionRef.current = "play"
      applyMode("piano") // optimistic — PAUSE/FINISH binds correct it
      if (!activated) setActivated(true)
      else if (widgetReadyRef.current) {
        queuedActionRef.current = null
        widgetRef.current?.play()
      }
    } else if (mode === "piano") {
      if (widgetReadyRef.current) widgetRef.current?.pause()
      else queuedActionRef.current = "pause"
      drone.start()
      applyMode("drone")
    } else {
      drone.stop()
      applyMode("off")
    }
  }

  const nextActionText =
    mode === "off"
      ? loadError
        ? "Play music — Deep Field, an original space drone (synthesized live)"
        : "Play music — piano: Einaudi, Experience (Reimagined). Press again for the Deep Field drone."
      : mode === "piano"
        ? "Switch to Deep Field — an original space drone (synthesized live)"
        : "Turn music off"

  // Iframe is loaded but kept visually hidden — we control playback via the widget API.
  // auto_play=true is SAFE and still strictly opt-in: this iframe only MOUNTS after
  // the user clicks the play chip (that click is the consent). It also FIXES the
  // "clicked but nothing plays" bug: calling widget.play() from the async READY
  // callback lands outside the browser's user-activation window and Chrome silently
  // blocks the audio — letting the widget start itself inside the click-initiated
  // load is the reliable path.
  const embedSrc = `https://w.soundcloud.com/player/?url=${encodeURIComponent(
    TRACK_URL,
  )}&auto_play=true&buying=false&sharing=false&download=false&show_artwork=false&show_comments=false&show_playcount=false&show_user=false&visual=false`

  return (
    <span className="inline-flex items-center gap-2">
      {/* Hidden audio source — only mounted AFTER the first click (activated), so
          the cross-origin iframe + its requests/cookies never load on a passive
          page visit. Kept off-screen (not zero-area) so browsers still fully
          initialise the iframe — a 1×1 / display:none frame can be deprioritised,
          which stops the Widget API from ever becoming ready. */}
      {activated && !loadError && (
        <iframe
          ref={iframeRef}
          src={embedSrc}
          width="320"
          height="166"
          title="Ambient music — Ludovico Einaudi, Experience (Reimagined)"
          aria-hidden="true"
          allow="autoplay"
          tabIndex={-1}
          style={{
            position: "fixed",
            width: 320,
            height: 166,
            opacity: 0,
            pointerEvents: "none",
            border: 0,
            left: -10000,
            top: 0,
          }}
        />
      )}

      {/* Which track just landed — fades after a few seconds. */}
      <span
        aria-hidden="true"
        className={`pointer-events-none select-none whitespace-nowrap font-mono text-[10px] tracking-[0.2em] uppercase text-foreground/50 transition-opacity duration-500 ${labelVisible ? "opacity-100" : "opacity-0"}`}
      >
        {MODE_LABEL[mode]}
      </span>

      {/* Compact icon-only control — stacks above the time-warp slider in galaxy-scene */}
      <button
        type="button"
        onClick={advance}
        aria-pressed={mode !== "off"}
        title={nextActionText}
        aria-label={nextActionText}
        className="
          group inline-flex items-center justify-center
          w-9 h-9 rounded-full
          border border-foreground/25 bg-background/50 backdrop-blur-sm
          text-foreground/85 hover:text-foreground hover:border-accent/60
          transition-colors duration-300
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
          focus-visible:ring-offset-2 focus-visible:ring-offset-background
        "
      >
        {mode === "off" ? (
          <span
            aria-hidden="true"
            className="block w-0 h-0 ml-0.5 border-y-[5px] border-y-transparent border-l-[7px] border-l-current"
          />
        ) : mode === "piano" ? (
          <span aria-hidden="true" className="flex gap-0.5">
            <span className="block w-0.5 h-3 bg-foreground" />
            <span className="block w-0.5 h-3 bg-foreground" />
          </span>
        ) : (
          <span aria-hidden="true" className="flex items-end gap-0.5">
            <span className="block w-0.5 h-2 bg-foreground" />
            <span className="block w-0.5 h-3.5 bg-foreground" />
            <span className="block w-0.5 h-2.5 bg-foreground" />
          </span>
        )}
      </button>
    </span>
  )
}
