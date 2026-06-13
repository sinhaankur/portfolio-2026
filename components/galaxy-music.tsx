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
  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let cancelled = false
    // Failsafe: the SoundCloud Widget READY event is occasionally flaky
    // (it never fires if the API binds before the cross-origin iframe has
    // posted back). Don't let that leave the button disabled forever —
    // enable it after a short grace period and let the first click drive
    // playback, which forces the widget to initialise anyway.
    let readyFallback: ReturnType<typeof setTimeout> | null = null

    const bindWidget = (SC: SCAPI) => {
      if (cancelled || !iframeRef.current) return
      const widget = SC.Widget(iframeRef.current)
      widgetRef.current = widget
      widget.bind(SC.Widget.Events.READY, () => {
        if (cancelled) return
        if (readyFallback) clearTimeout(readyFallback)
        widget.setVolume(45)
        setReady(true)
      })
      widget.bind(SC.Widget.Events.PLAY, () => {
        if (!cancelled) setPlaying(true)
      })
      widget.bind(SC.Widget.Events.PAUSE, () => {
        if (!cancelled) setPlaying(false)
      })
      widget.bind(SC.Widget.Events.FINISH, () => {
        if (!cancelled) setPlaying(false)
      })
      // If READY hasn't arrived in 2.5s, enable the control anyway.
      readyFallback = setTimeout(() => {
        if (!cancelled) setReady(true)
      }, 2500)
    }

    loadSoundCloudAPI()
      .then(bindWidget)
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })

    return () => {
      cancelled = true
      if (readyFallback) clearTimeout(readyFallback)
      try {
        widgetRef.current?.pause()
      } catch {
        /* widget may already be torn down */
      }
    }
  }, [])

  const toggle = () => {
    const widget = widgetRef.current
    if (!widget) return
    // Optimistically flip the icon — the PLAY/PAUSE binds will correct it.
    // Some browsers won't deliver the bound events until the first user
    // gesture, so driving the icon off local intent keeps the UI honest.
    if (playing) {
      widget.pause()
      setPlaying(false)
    } else {
      widget.play()
      setPlaying(true)
    }
  }

  // Iframe is loaded but kept visually hidden — we control playback via the widget API.
  // src has auto_play=false so nothing happens until the user clicks the button.
  const embedSrc = `https://w.soundcloud.com/player/?url=${encodeURIComponent(
    TRACK_URL,
  )}&auto_play=false&buying=false&sharing=false&download=false&show_artwork=false&show_comments=false&show_playcount=false&show_user=false&visual=false`

  if (loadError) return null

  return (
    <>
      {/* Hidden audio source. Kept off-screen (not zero-area) so browsers
          still fully initialise the cross-origin iframe — a 1×1 / display:none
          frame can be deprioritised, which stops the Widget API from ever
          becoming ready. We give it real dimensions and push it off-screen. */}
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

      {/* Compact icon-only toggle — stacks above the time-warp slider in galaxy-scene */}
      <button
        type="button"
        onClick={toggle}
        disabled={!ready}
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
