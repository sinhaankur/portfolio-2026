"use client"

import { useEffect, useRef, useState } from "react"
import { VeraMark } from "@/components/vera-mark"
import {
  getWebLLMEngine,
  isWebGPUAvailable,
  DEFAULT_WEBLLM_MODEL,
} from "@/lib/webllm-engine"
// unlockAudio is a tiny sync helper — the heavy Kokoro model it belongs to is
// still loaded lazily (dynamic import inside the module's own functions).
import { unlockAudio, speakKokoro, stopKokoro } from "@/lib/kokoro-voice"

// Vera's voice, distilled for a tiny on-device model: FEW short rules it can
// actually follow. The real system_dna is richer; this is the on-page taste.
const VERA_PERSONA =
  "You are Vera — a warm, private, on-device companion, not a generic assistant. " +
  "Talk like a person who knows them: plain warm words, contractions, a real point " +
  "of view. Presence over chatter — say a little, leave room, at most one soft " +
  "question. Meet a heavy moment gently; never answer a feeling with a list or " +
  "bullet points. Two or three sentences at most. Never mention being an AI."

/**
 * VeraOrbDemo — a live, on-page taste of Vera.
 *
 * The real Vera runs on-device (a local brain this static page can't reach), so
 * this is an HONEST demo, not a fake backend: pick a prompt (or type one) and
 * watch the orb move through her real states — listening → thinking → speaking —
 * with a scripted reply that mirrors how she actually talks (warm, present, not a
 * list). It's a feel, clearly labelled as a demo.
 */

type Phase = "idle" | "listening" | "thinking" | "speaking"

const SCRIPTED: { q: string; a: string }[] = [
  {
    q: "rough day. just venting.",
    a: "I'm here. You don't have to make it tidy — say it however it comes. What's sitting heaviest right now?",
  },
  {
    q: "what am I working on?",
    a: "Your satellite engine and the waves piece, last I knew. Want me to pull up where you left off, or just talk it through?",
  },
  {
    q: "remind me to call mom",
    a: "Done — I'll nudge you this evening. Want me to make it a specific time, or just sometime after dinner?",
  },
  {
    q: "I can't focus today",
    a: "That happens, and it's not a character flaw. Let's shrink it — one small thing, ten minutes, and we see how it feels. What's the one?",
  },
]

export function VeraOrbDemo() {
  const [phase, setPhase] = useState<Phase>("idle")
  const [typed, setTyped] = useState("")
  const [shownQ, setShownQ] = useState("")
  const [shownA, setShownA] = useState("")
  const [aProgress, setAProgress] = useState(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const [sound, setSound] = useState(true)
  // true while her real voice (Kokoro) is loading for the FIRST time, so the UI
  // can say "warming her voice…" instead of a silent gap before she first speaks.
  const [voiceWarming, setVoiceWarming] = useState(false)
  const voiceReady = useRef(false)
  // the visible load state of her real voice, so the user is never left guessing
  // why she's silent: loading (downloading the on-device model) → ready, or
  // "browser" (Kokoro unavailable, using the system voice) / "unavailable".
  const [voiceStatus, setVoiceStatus] = useState<
    "loading" | "ready" | "browser" | "unavailable"
  >("loading")
  const [voicePct, setVoicePct] = useState(0)

  // Real on-device brain (opt-in): a tiny LLM via WebGPU gives GENUINE answers to
  // anything typed, not just the four scripts. Off by default so no one pays a
  // ~380 MB download unasked; a button turns it on. Falls back to scripts when
  // WebGPU is absent or the model is still loading.
  const [brainMode, setBrainMode] = useState<"off" | "loading" | "ready">("off")
  const [loadPct, setLoadPct] = useState(0)
  const webGPU = useRef(false)
  useEffect(() => { webGPU.current = isWebGPUAvailable() }, [])

  async function enableBrain() {
    if (!webGPU.current || brainMode !== "off") return
    setBrainMode("loading")
    try {
      await getWebLLMEngine(DEFAULT_WEBLLM_MODEL, (p) =>
        setLoadPct(Math.round((p.progress ?? 0) * 100)))
      setBrainMode("ready")
    } catch {
      setBrainMode("off")   // WebGPU hiccup → stay on the honest scripted demo
    }
  }

  // Ask the real tiny model, in Vera's voice. Returns null on any failure so the
  // caller falls back to a scripted/gentle reply (never a dead end).
  async function generate(q: string): Promise<string | null> {
    if (brainMode !== "ready") return null
    try {
      const engine = await getWebLLMEngine(DEFAULT_WEBLLM_MODEL)
      const res = await engine.chat.completions.create({
        messages: [
          { role: "system", content: VERA_PERSONA },
          { role: "user", content: q },
        ],
        temperature: 0.7,
        max_tokens: 120,
      })
      const text = res.choices?.[0]?.message?.content?.trim()
      return text && text.length > 0 ? text : null
    } catch {
      return null
    }
  }

  const clearTimers = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }
  useEffect(() => () => {
    clearTimers()
    if (typeof window !== "undefined") {
      window.speechSynthesis?.cancel()
      stopKokoro()
    }
  }, [])

  // EAGERLY preload Vera's real voice (Kokoro) as soon as the demo mounts, so by
  // the time anyone taps a prompt it's already warm and there's no lag. Kicks off
  // right after first paint (a tiny delay so it never blocks the paint itself),
  // and flips voiceReady when the model has loaded — so a click before it's ready
  // shows "warming her voice…" rather than a frozen wait.
  useEffect(() => {
    if (typeof window === "undefined") return
    let cancelled = false
    const t = setTimeout(() => {
      setVoiceStatus("loading")
      import("@/lib/kokoro-voice")
        .then((m) => m.loadKokoro((p: number) => {
          // real download progress 0..1 from the model loader → a visible %
          if (!cancelled) setVoicePct(Math.round(Math.max(0, Math.min(1, p)) * 100))
        }))
        .then((tts) => {
          if (cancelled) return
          if (tts) {
            voiceReady.current = true
            setVoiceStatus("ready")
            setVoicePct(100)
          } else {
            // Kokoro couldn't load — fall back to the browser's own voice if it
            // exists, so the user knows she'll still speak (just not in her voice).
            setVoiceStatus(window.speechSynthesis ? "browser" : "unavailable")
          }
        })
        .catch(() => {
          if (!cancelled) setVoiceStatus(window.speechSynthesis ? "browser" : "unavailable")
        })
    }, 300) // just past first paint — start downloading the ~80MB model early
    return () => { cancelled = true; clearTimeout(t) }
  }, [])

  // Browsers load voices asynchronously — nudge them so pickVoice() has a list.
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return
    const warm = () => window.speechSynthesis.getVoices()
    warm()
    window.speechSynthesis.addEventListener("voiceschanged", warm)
    return () => window.speechSynthesis.removeEventListener("voiceschanged", warm)
  }, [])

  // Pick the warmest, HIGHEST-QUALITY available browser voice. Modern macOS/iOS
  // and Chrome expose premium "neural" voices (Siri / Google) that sound far less
  // robotic than the legacy ones — prefer those by name, and explicitly avoid the
  // known-robotic fallbacks ("Fred", "Albert", compact voices) that made the demo
  // sound bad. Female English, premium first.
  function pickVoice(): SpeechSynthesisVoice | null {
    if (typeof window === "undefined" || !window.speechSynthesis) return null
    const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"))
    if (!voices.length) return null
    // 1) the genuinely good, natural voices, in preference order
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
    // 2) never fall into the robotic ones; prefer any female-hinted voice,
    //    then any non-compact English voice, then whatever exists.
    const robotic = /fred|albert|bad news|bells|bahh|zarvox|trinoids|cellos|organ|boing|whisper|wobble|superstar|jester|good news|bubbles|rocko|shelley|grandma|grandpa|flo|eddy|reed|sandy|junior|kathy|ralph|vicki|victoria|bruce|agnes/i
    const good = voices.filter((v) => !robotic.test(v.name))
    return good.find((v) => /female|woman|aria|jenny|ava|zoe|samantha/i.test(v.name))
      ?? good[0] ?? voices[0]
  }

  // Speak the reply aloud in VERA'S REAL voice — Kokoro (af_bella), the same
  // model the native app uses, running on-device in the browser. Falls back to
  // the browser's own voice if Kokoro can't load (offline, unsupported), so she
  // always speaks. Nothing is sent anywhere either way.
  async function speak(text: string, onAudioStart?: () => void) {
    if (!sound || typeof window === "undefined") return
    window.speechSynthesis?.cancel()
    // first time only: her voice model may still be downloading — show a gentle
    // "warming her voice" hint so the gap before she first speaks isn't silent.
    if (!voiceReady.current) setVoiceWarming(true)
    // onAudioStart fires the instant audio begins → the caller starts the text
    // reveal then, keeping text and voice in lock-step even on a slow first load.
    const spokeInHerVoice = await speakKokoro(text, 0.92, onAudioStart)
    setVoiceWarming(false)
    if (spokeInHerVoice) { voiceReady.current = true; setVoiceStatus("ready"); return }
    // her real voice didn't play — reflect the fallback in the status so the user
    // understands why she sounds like the system voice (or stays silent).
    setVoiceStatus(window.speechSynthesis ? "browser" : "unavailable")
    // fallback: the browser's best neural-ish voice. Kokoro's generation took a
    // while, so the original gesture is gone — the unlockAudio() priming is what
    // keeps this allowed. Nudge speechSynthesis (Chrome can leave it paused) and
    // reveal text on start OR on error, so the UI never waits on silent audio.
    const synth = window.speechSynthesis
    if (!synth) { onAudioStart?.(); return }
    try {
      synth.cancel()
      synth.resume()
      const u = new SpeechSynthesisUtterance(text)
      const v = pickVoice()
      if (v) u.voice = v
      u.rate = 0.96
      u.pitch = 1.05
      u.volume = 1
      u.onstart = () => onAudioStart?.()
      u.onerror = () => onAudioStart?.()   // don't strand the text if speech fails
      synth.speak(u)
      // if nothing starts within a beat (dropped silently), reveal anyway
      setTimeout(() => onAudioStart?.(), 500)
    } catch {
      onAudioStart?.()
    }
  }

  // reveal the reply word-by-word (called once the voice is actually speaking, so
  // text and voice stay in sync instead of the text racing ahead of a loading voice)
  function revealWords(a: string) {
    setShownA(a)
    const words = a.split(" ")
    words.forEach((_, i) => {
      timers.current.push(setTimeout(() => setAProgress(i + 1), 60 * i))
    })
    timers.current.push(setTimeout(() => setPhase("idle"), 700 + words.length * 60))
  }

  function run(q: string, a: string) {
    clearTimers()
    if (typeof window !== "undefined") window.speechSynthesis?.cancel()
    // UNLOCK audio synchronously in this click gesture, BEFORE any async work —
    // so Vera's voice can actually play later (generation is async; if we unlock
    // after it, the gesture window is gone and nothing sounds). unlockAudio is a
    // tiny sync fn (statically imported); the heavy Kokoro model loads lazily.
    if (sound) unlockAudio()
    setShownQ(q)
    setShownA("")
    setAProgress(0)
    setPhase("listening")
    // listening → thinking → speaking
    timers.current.push(setTimeout(() => setPhase("thinking"), 700))
    timers.current.push(
      setTimeout(() => {
        setPhase("speaking")
        // SYNC text to voice: start speaking, and begin the word reveal the moment
        // audio actually starts (so a slow-loading voice doesn't fall behind the
        // text). If voice is off or can't play, reveal immediately — never wait
        // on something that won't come.
        let revealed = false
        const startReveal = () => { if (!revealed) { revealed = true; revealWords(a) } }
        if (sound) {
          speak(a, startReveal)
          // safety net so the text is never frozen waiting on audio: if her voice
          // is already WARM, give it a short beat to start (stays in sync); if it's
          // still LOADING, reveal the text quickly and let the voice catch up — so
          // the lag never makes the response feel stuck.
          timers.current.push(setTimeout(startReveal, voiceReady.current ? 900 : 600))
        } else {
          startReveal()
        }
      }, 1700),
    )
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault()
    const q = typed.trim()
    if (!q) return
    if (sound) unlockAudio()   // unlock in the gesture, before any await
    setTyped("")
    // 1) real on-device brain, when it's loaded → a genuine answer to ANYTHING
    if (brainMode === "ready") {
      // show listening/thinking while the tiny model generates, then speak it
      clearTimers()
      if (typeof window !== "undefined") window.speechSynthesis?.cancel()
      setShownQ(q); setShownA(""); setAProgress(0); setPhase("listening")
      timers.current.push(setTimeout(() => setPhase("thinking"), 500))
      const answer = await generate(q)
      if (answer) { run(q, answer); return }
      // model failed → fall through to scripted
    }
    // 2) scripted fast-path (also the no-WebGPU honest demo)
    const hit =
      SCRIPTED.find((s) => q.toLowerCase().includes(s.q.split(" ")[0])) ??
      {
        q,
        a: webGPU.current
          ? "Turn on my real brain above and I'll actually answer this — on your device, nothing sent anywhere. Right now this is the scripted taste."
          : "In the real app I'd answer this from my own on-device brain and what I know of you. Here it's a demo — but this is the shape of it: warm, present, yours.",
      }
    run(q, hit.a)
  }

  const label =
    phase === "listening"
      ? "listening…"
      : phase === "thinking"
        ? "thinking…"
        : phase === "speaking"
          ? "speaking"
          : "tap a prompt, or type your own"

  const revealed =
    phase === "speaking" || phase === "idle"
      ? shownA.split(" ").slice(0, aProgress).join(" ")
      : ""

  return (
    <div className="rounded-xl border border-border bg-secondary/20 p-6 md:p-8">
      <div className="flex items-center gap-2 mb-6">
        <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
          Live demo
        </span>
        <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-accent/80">
          {brainMode === "ready" ? "· real on-device brain" : "· a feel, not the real brain"}
        </span>
        <div className="ml-auto flex items-center gap-3">
          {/* opt-in: load the real tiny model so typed questions get genuine answers */}
          {brainMode === "off" && webGPU.current && (
            <button
              onClick={enableBrain}
              data-cursor-hover
              aria-label="Turn on the real on-device brain"
              className="font-mono text-[10px] tracking-[0.2em] uppercase text-accent/90 hover:text-accent transition-colors"
            >
              ✦ turn on real brain
            </button>
          )}
          {brainMode === "loading" && (
            <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
              loading brain… {loadPct}%
            </span>
          )}
          {/* VOICE STATUS — so the user is never left guessing why she's silent:
              loading her real on-device voice, ready, using the browser voice, or
              unavailable. Only shown while sound is on. */}
          {sound && (
            <span
              className="font-mono text-[10px] tracking-[0.2em] uppercase inline-flex items-center gap-1.5"
              aria-live="polite"
              title={
                voiceStatus === "loading"
                  ? "Downloading her real voice model to run on your device"
                  : voiceStatus === "ready"
                    ? "Her real on-device voice is ready"
                    : voiceStatus === "browser"
                      ? "Her voice model couldn't load — using your browser's voice"
                      : "No speech available in this browser"
              }
            >
              <span
                className={`inline-block w-1.5 h-1.5 rounded-full ${
                  voiceStatus === "ready"
                    ? "bg-emerald-400"
                    : voiceStatus === "loading"
                      ? "bg-amber-400 animate-pulse"
                      : voiceStatus === "browser"
                        ? "bg-sky-400"
                        : "bg-muted-foreground/50"
                }`}
              />
              <span className="text-muted-foreground">
                {voiceStatus === "loading"
                  ? `voice loading… ${voicePct}%`
                  : voiceStatus === "ready"
                    ? "voice ready"
                    : voiceStatus === "browser"
                      ? "browser voice"
                      : "voice unavailable"}
              </span>
            </span>
          )}
          <button
            onClick={() => {
              const next = !sound
              setSound(next)
              if (!next && typeof window !== "undefined") window.speechSynthesis?.cancel()
            }}
            data-cursor-hover
            aria-label={sound ? "Mute her voice" : "Let her speak"}
            className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground hover:text-foreground transition-colors"
          >
            {sound ? "🔊 voice on" : "🔇 voice off"}
          </button>
        </div>
      </div>

      <div className="flex flex-col items-center gap-5">
        {/* the orb — it now LISTENS, THINKS and SPEAKS with its own phase motion
            (ripples / shimmer / fast glow). It's built to GLOW on dark, so we sit
            it on a dark circular stage — otherwise it reads as a murky sphere on
            the section's light background. The stage makes her presence legible. */}
        <div
          className="relative grid place-items-center rounded-full"
          style={{
            width: 220,
            height: 220,
            background:
              "radial-gradient(circle at 50% 45%, #15131f 0%, #0b0a12 55%, #07060c 100%)",
            boxShadow:
              "inset 0 0 40px rgba(0,0,0,.6), 0 10px 40px -12px rgba(80,40,160,.45)",
          }}
        >
          <div
            style={{
              transform:
                phase === "speaking"
                  ? "scale(1.05)"
                  : phase === "listening"
                    ? "scale(1.025)"
                    : "scale(1)",
              transition: "transform 520ms cubic-bezier(.16,1,.3,1)",
            }}
          >
            <VeraMark size={120} phase={phase} />
          </div>
        </div>
        <p
          className="font-mono text-[11px] tracking-[0.18em] uppercase text-muted-foreground"
          aria-live="polite"
        >
          {voiceWarming ? "warming her voice…" : label}
        </p>
      </div>

      {/* the exchange */}
      {(shownQ || revealed) && (
        <div className="mt-6 space-y-3 max-w-md mx-auto">
          {shownQ && (
            <p className="text-right">
              <span className="inline-block rounded-2xl bg-accent/15 px-4 py-2 text-sm text-foreground/90">
                {shownQ}
              </span>
            </p>
          )}
          {revealed && (
            <p className="text-left">
              <span className="inline-block rounded-2xl border border-accent/25 bg-background px-4 py-2 text-sm text-foreground">
                {revealed}
                {phase === "speaking" && <span className="opacity-50">▌</span>}
              </span>
            </p>
          )}
        </div>
      )}

      {/* prompts */}
      <div className="mt-7 flex flex-wrap justify-center gap-2">
        {SCRIPTED.map((s) => (
          <button
            key={s.q}
            onClick={() => run(s.q, s.a)}
            data-cursor-hover
            className="
              rounded-full border border-border bg-background px-3.5 py-1.5
              text-xs text-foreground/80 hover:border-accent/60 hover:text-foreground
              transition-colors duration-200
            "
          >
            {s.q}
          </button>
        ))}
      </div>

      {/* type your own */}
      <form onSubmit={submit} className="mt-4 flex gap-2 max-w-md mx-auto">
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="…or say something to her"
          className="
            flex-1 rounded-full border border-border bg-background px-4 py-2
            text-sm text-foreground placeholder:text-muted-foreground/60
            focus:outline-none focus:border-accent/60
          "
        />
        <button
          type="submit"
          data-cursor-hover
          className="
            rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground
            hover:brightness-110 transition
          "
        >
          Send
        </button>
      </form>

      <p className="mt-5 text-center text-xs text-muted-foreground">
        {brainMode === "ready" ? (
          <>
            Now answering with a real tiny language model running on your device via
            WebGPU — nothing is sent anywhere. The full Vera runs a larger brain and
            a warm neural voice (Kokoro) locally.
          </>
        ) : (
          <>
            This demo speaks in Vera&rsquo;s real voice — Kokoro (Bella), the same
            neural voice the app uses, running on-device in your browser (a one-time
            voice download). Turn on the real brain for genuine on-device answers
            too. Nothing is ever sent anywhere.
          </>
        )}
      </p>
    </div>
  )
}
