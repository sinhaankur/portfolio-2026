"use client"

import { useEffect, useRef, useState } from "react"

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

export function GalaxyMusic() {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const widgetRef = useRef<SCWidget | null>(null)
  const widgetReadyRef = useRef(false)
  const queuedActionRef = useRef<"play" | "pause" | null>(null)
  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [loadError, setLoadError] = useState(false)
  // PERF: the SoundCloud iframe + Widget API (~120 KB, 10 cross-origin requests,
  // third-party cookies) used to load on mount on every page that shows the music
  // chip — before the user ever opts in. We now defer ALL of it until the first
  // click, so the home/celestial/star-cleaver first load carries none of it.
  // Playback stays strictly opt-in (CLAUDE.md), and now so does the loading.
  const [activated, setActivated] = useState(false)

  // Bind the widget only once the iframe has been mounted (after first click).
  useEffect(() => {
    if (!activated) return
    let cancelled = false
    let readyFallback: ReturnType<typeof setTimeout> | null = null

    const bindWidget = (SC: SCAPI) => {
      if (cancelled || !iframeRef.current) return
      const widget = SC.Widget(iframeRef.current)
      widgetRef.current = widget
      widget.bind(SC.Widget.Events.READY, () => {
        if (cancelled) return
        widgetReadyRef.current = true
        if (readyFallback) clearTimeout(readyFallback)
        widget.setVolume(45)
        setReady(true)
        if (queuedActionRef.current === "play") widget.play()
        else if (queuedActionRef.current === "pause") widget.pause()
        queuedActionRef.current = null
      })
      widget.bind(SC.Widget.Events.PLAY, () => { if (!cancelled) setPlaying(true) })
      widget.bind(SC.Widget.Events.PAUSE, () => { if (!cancelled) setPlaying(false) })
      widget.bind(SC.Widget.Events.FINISH, () => { if (!cancelled) setPlaying(false) })
      // If READY hasn't arrived in 2.5s, enable the control anyway.
      readyFallback = setTimeout(() => { if (!cancelled) setReady(true) }, 2500)
    }

    loadSoundCloudAPI()
      .then(bindWidget)
      .catch(() => { if (!cancelled) setLoadError(true) })

    return () => {
      cancelled = true
      if (readyFallback) clearTimeout(readyFallback)
      try { widgetRef.current?.pause() } catch { /* already torn down */ }
    }
  }, [activated])

  const toggle = () => {
    // First click: mount the iframe + load the API, and queue play. The bind
    // effect picks up `activated` and starts playback once READY fires.
    if (!activated) {
      queuedActionRef.current = "play"
      setPlaying(true)        // optimistic — corrected by PLAY/PAUSE binds
      setActivated(true)
      return
    }
    const widget = widgetRef.current
    if (!widget) return
    if (!widgetReadyRef.current) {
      const nextAction = playing ? "pause" : "play"
      queuedActionRef.current = nextAction
      setPlaying(nextAction === "play")
      return
    }
    // Optimistically flip the icon — the PLAY/PAUSE binds will correct it.
    if (playing) { widget.pause(); setPlaying(false) }
    else { widget.play(); setPlaying(true) }
  }

  // Iframe is loaded but kept visually hidden — we control playback via the widget API.
  // src has auto_play=false so nothing happens until the user clicks the button.
  const embedSrc = `https://w.soundcloud.com/player/?url=${encodeURIComponent(
    TRACK_URL,
  )}&auto_play=false&buying=false&sharing=false&download=false&show_artwork=false&show_comments=false&show_playcount=false&show_user=false&visual=false`

  if (loadError) return null

  return (
    <>
      {/* Hidden audio source — only mounted AFTER the first click (activated), so
          the cross-origin iframe + its requests/cookies never load on a passive
          page visit. Kept off-screen (not zero-area) so browsers still fully
          initialise the iframe — a 1×1 / display:none frame can be deprioritised,
          which stops the Widget API from ever becoming ready. */}
      {activated && (
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

      {/* Compact icon-only toggle — stacks above the time-warp slider in galaxy-scene */}
      <button
        type="button"
        onClick={toggle}
        disabled={activated && !ready}
        aria-pressed={playing}
        title={
          playing
            ? "Pause ambient music — Einaudi, Experience (Reimagined)"
            : "Play ambient music — Einaudi, Experience (Reimagined)"
        }
        aria-label={
          playing
            ? "Pause ambient music — Einaudi, Experience (Reimagined)"
            : "Play ambient music — Einaudi, Experience (Reimagined)"
        }
        className="
          group inline-flex items-center justify-center
          w-9 h-9 rounded-full
          border border-foreground/25 bg-background/50 backdrop-blur-sm
          text-foreground/85 hover:text-foreground hover:border-accent/60
          transition-colors duration-300
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
          focus-visible:ring-offset-2 focus-visible:ring-offset-background
          disabled:opacity-50 disabled:cursor-not-allowed
        "
      >
        {playing ? (
          <span aria-hidden="true" className="flex gap-0.5">
            <span className="block w-0.5 h-3 bg-foreground" />
            <span className="block w-0.5 h-3 bg-foreground" />
          </span>
        ) : (
          <span
            aria-hidden="true"
            className="block w-0 h-0 ml-0.5 border-y-[5px] border-y-transparent border-l-[7px] border-l-current"
          />
        )}
      </button>
    </>
  )
}
