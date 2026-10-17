"use client"

/**
 * useVeraVoice — the ONE shared voice path for every orb on the site.
 *
 * Both the big Vera orb (/lab/cognitive-twin) and the small corner guide orb use
 * this, so there's a single voice engine, not two copies: Vera's real on-device
 * Kokoro voice (af_bella — the same model the native app uses), eagerly warmed,
 * with a graceful fall back to the browser's best neural voice, then silence.
 * Nothing is ever sent anywhere — the whole pipeline runs in the browser.
 *
 * Usage:
 *   const voice = useVeraVoice(soundOn)
 *   voice.preload()                       // optional: warm it early (on open)
 *   await voice.speak(text, () => reveal) // speaks; onStart fires at audio begin
 *   voice.status                          // "loading" | "ready" | "browser" | "unavailable"
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { unlockAudio, speakKokoro, stopKokoro } from "@/lib/kokoro-voice"

export type VoiceStatus = "idle" | "loading" | "ready" | "browser" | "unavailable"

export function useVeraVoice(enabled: boolean) {
  const [status, setStatus] = useState<VoiceStatus>("idle")
  const [pct, setPct] = useState(0)
  const [warming, setWarming] = useState(false)
  const ready = useRef(false)
  const started = useRef(false)

  // Nudge the browser to load its voice list (for the fallback path).
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return
    const warm = () => window.speechSynthesis.getVoices()
    warm()
    window.speechSynthesis.addEventListener("voiceschanged", warm)
    return () => window.speechSynthesis.removeEventListener("voiceschanged", warm)
  }, [])

  useEffect(() => () => {
    if (typeof window !== "undefined") {
      window.speechSynthesis?.cancel()
      stopKokoro()
    }
  }, [])

  /** Start downloading Kokoro (idempotent). Call when the orb opens so it's warm. */
  const preload = useCallback(() => {
    if (started.current || typeof window === "undefined") return
    started.current = true
    setStatus("loading")
    import("@/lib/kokoro-voice")
      .then((m) => m.loadKokoro((p: number) => setPct(Math.round(Math.max(0, Math.min(1, p)) * 100))))
      .then((tts) => {
        if (tts) { ready.current = true; setStatus("ready"); setPct(100) }
        else setStatus(window.speechSynthesis ? "browser" : "unavailable")
      })
      .catch(() => setStatus(window.speechSynthesis ? "browser" : "unavailable"))
  }, [])

  /** Prime audio inside a user gesture so playback is allowed later. Sync. */
  const unlock = useCallback(() => { if (enabled) unlockAudio() }, [enabled])

  function pickVoice(): SpeechSynthesisVoice | null {
    if (typeof window === "undefined" || !window.speechSynthesis) return null
    const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"))
    if (!voices.length) return null
    const premium = [
      "Ava (Premium)", "Zoe (Premium)", "Allison (Premium)", "Samantha (Enhanced)",
      "Ava (Enhanced)", "Serena (Premium)", "Google US English",
      "Microsoft Aria", "Microsoft Jenny", "Samantha", "Ava", "Allison", "Zoe",
      "Serena", "Nicky", "Google UK English Female",
    ]
    for (const name of premium) {
      const v = voices.find((x) => x.name === name) ?? voices.find((x) => x.name.includes(name))
      if (v) return v
    }
    const robotic = /fred|albert|bad news|bells|bahh|zarvox|trinoids|cellos|organ|boing|whisper|wobble|superstar|jester|good news|bubbles|rocko|shelley|grandma|grandpa|flo|eddy|reed|sandy|junior|kathy|ralph|vicki|victoria|bruce|agnes/i
    const good = voices.filter((v) => !robotic.test(v.name))
    return good.find((v) => /female|woman|aria|jenny|ava|zoe|samantha/i.test(v.name)) ?? good[0] ?? voices[0]
  }

  /** Speak `text` aloud in Vera's voice. onStart fires the instant audio begins
   *  (sync your text reveal to it). No-op when sound is off. */
  const speak = useCallback(async (text: string, onStart?: () => void) => {
    if (!enabled || typeof window === "undefined") return
    window.speechSynthesis?.cancel()
    if (!ready.current) setWarming(true)
    const spoke = await speakKokoro(text, 0.92, onStart)
    setWarming(false)
    if (spoke) { ready.current = true; setStatus("ready"); return }
    // Kokoro didn't play → browser voice fallback.
    setStatus(window.speechSynthesis ? "browser" : "unavailable")
    const synth = window.speechSynthesis
    if (!synth) { onStart?.(); return }
    try {
      synth.cancel(); synth.resume()
      const u = new SpeechSynthesisUtterance(text)
      const v = pickVoice()
      if (v) u.voice = v
      u.rate = 0.96; u.pitch = 1.05; u.volume = 1
      u.onstart = () => onStart?.()
      u.onerror = () => onStart?.()
      synth.speak(u)
      setTimeout(() => onStart?.(), 500)
    } catch { onStart?.() }
  }, [enabled])

  const stop = useCallback(() => {
    if (typeof window !== "undefined") window.speechSynthesis?.cancel()
    stopKokoro()
    setWarming(false)
  }, [])

  return { status, pct, warming, preload, unlock, speak, stop }
}
