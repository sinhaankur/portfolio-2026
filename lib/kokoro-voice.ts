/**
 * Vera's real voice in the browser — Kokoro (af_heart), the SAME model + voice
 * the native app uses, running fully on-device via kokoro-js (ONNX/WASM, WebGPU
 * when available). So the "Meet her" demo sounds like Vera herself, not the
 * generic browser voice.
 *
 * Everything here is lazy + client-only: the library (and its model) is
 * dynamic-imported on first use, never on page load, and never during SSR (the
 * site is a static export).
 *
 * The audio pitfall this handles: generating speech is async and can take a
 * while on first run (model download + inference). If we only create/unlock the
 * AudioContext *after* that, the browser's user-gesture window is gone and
 * nothing plays. So we UNLOCK the context synchronously on the user's click
 * (unlockAudio), and then play back a Blob via a plain <audio> element, which
 * browsers resume far more reliably than a manually-started buffer source.
 *
 * If anything fails, callers fall back to speechSynthesis — the demo always talks.
 */

// Vera's canonical voice — matches the native app's default (kokoro_tts.py:
// _DEFAULT_VOICE = "af_heart", "warm, natural, clear — the best for her presence").
// Keep these in lock-step so she sounds like the SAME Vera on the site + the app.
const VERA_VOICE = "af_heart"

type RawAudio = { toBlob: () => Blob; audio?: Float32Array; sampling_rate?: number }
type KokoroTTS = {
  generate: (text: string, opts: { voice: string; speed?: number }) => Promise<RawAudio>
}

let ttsPromise: Promise<KokoroTTS | null> | null = null
let audioEl: HTMLAudioElement | null = null
let unlocked = false
let audioCtx: AudioContext | null = null

/**
 * Call this SYNCHRONOUSLY inside a user gesture (click/tap) BEFORE any await, so
 * the browser lets us play audio later even though generation is async.
 *
 * Generation is slow on first run, so by the time audio is ready the gesture is
 * long gone — which is exactly when iOS Safari and Chrome refuse to start sound.
 * We defend against that THREE ways, all inside this gesture:
 *   1. resume a real AudioContext (the authoritative "audio is allowed" bit) and
 *      tick a silent oscillator through it,
 *   2. prime the reusable <audio> element with a tiny silent play, and
 *   3. prime speechSynthesis with an empty utterance, so the browser-voice
 *      fallback can also speak later even outside a fresh gesture.
 * Safe to call repeatedly.
 */
export function unlockAudio() {
  if (typeof window === "undefined") return
  // (1) the AudioContext is the real gate — resume it and make a silent tick
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (Ctx) {
      if (!audioCtx) audioCtx = new Ctx()
      if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {})
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      gain.gain.value = 0.0001 // effectively silent
      osc.connect(gain).connect(audioCtx.destination)
      osc.start()
      osc.stop(audioCtx.currentTime + 0.03)
    }
  } catch {
    /* no AudioContext — the <audio> primes below are the fallback */
  }
  // (2) prime the reusable <audio> element with a silent data-URI play
  if (!audioEl) {
    audioEl = new Audio()
    audioEl.preload = "auto"
  }
  try {
    audioEl.muted = true
    const p = audioEl.play()
    if (p && typeof p.then === "function") {
      p.then(() => { audioEl!.pause(); audioEl!.muted = false }).catch(() => { audioEl!.muted = false })
    } else {
      audioEl.pause(); audioEl.muted = false
    }
  } catch {
    audioEl.muted = false
  }
  // (3) prime speechSynthesis so the browser-voice fallback can speak later
  try {
    const synth = window.speechSynthesis
    if (synth) {
      const u = new SpeechSynthesisUtterance("")
      u.volume = 0
      synth.speak(u)
      synth.cancel()
    }
  } catch {
    /* no speechSynthesis — Kokoro is the primary path anyway */
  }
  unlocked = true
}

/** Load (once) the on-device Kokoro pipeline. Returns null if unavailable. */
export function loadKokoro(onProgress?: (p: number) => void): Promise<KokoroTTS | null> {
  if (ttsPromise) return ttsPromise
  ttsPromise = (async () => {
    if (typeof window === "undefined") return null
    try {
      const mod = await import("kokoro-js")
      const KokoroTTSClass = (mod as unknown as { KokoroTTS: { from_pretrained: (id: string, o: object) => Promise<KokoroTTS> } }).KokoroTTS
      const device = "gpu" in navigator ? "webgpu" : "wasm"
      const tts = await KokoroTTSClass.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
        dtype: device === "webgpu" ? "fp32" : "q8",
        device,
        progress_callback: (p: { progress?: number }) => onProgress?.(p?.progress ?? 0),
      })
      return tts
    } catch {
      return null
    }
  })()
  return ttsPromise
}

/** True once Kokoro has finished (or started) loading for this tab. */
export function kokoroReady(): boolean {
  return ttsPromise !== null
}

/**
 * Speak `text` in Vera's real voice. Returns true if Kokoro spoke, false if it
 * couldn't (so the caller can fall back to the browser voice). Plays via a Blob
 * on a reusable <audio> element (robust resume behaviour). unlockAudio() should
 * have been called in the triggering gesture.
 */
export async function speakKokoro(
  text: string,
  speed = 0.92,
  onStart?: () => void,
): Promise<boolean> {
  try {
    const tts = await loadKokoro()
    if (!tts) return false
    const out = await tts.generate(text, { voice: VERA_VOICE, speed })
    const blob = out.toBlob()
    if (!blob) return false

    if (!audioEl) {
      audioEl = new Audio()
      audioEl.preload = "auto"
    }
    stopKokoro()
    // generation took a while; the AudioContext may have suspended again. Resume
    // it so playback isn't silently blocked when we finally have the audio.
    try { if (audioCtx && audioCtx.state === "suspended") await audioCtx.resume() } catch { /* best effort */ }
    const url = URL.createObjectURL(blob)
    audioEl.src = url
    audioEl.muted = false
    audioEl.volume = 1
    audioEl.onended = () => URL.revokeObjectURL(url)
    // fire onStart the instant playback actually begins, so a caller can sync
    // its UI (e.g. the text reveal) to the voice rather than to the request.
    if (onStart) audioEl.onplaying = () => onStart()
    try {
      await audioEl.play()
    } catch {
      // one retry after a resume — Safari sometimes needs the context nudged
      try { await audioCtx?.resume() } catch { /* ignore */ }
      try { await audioEl.play() } catch { return false }
    }
    return true
  } catch {
    return false
  }
}

/** Stop any Kokoro audio currently playing. */
export function stopKokoro() {
  try {
    if (audioEl) {
      audioEl.pause()
      audioEl.currentTime = 0
    }
  } catch {
    /* already stopped */
  }
}

/** Whether the audio output has been unlocked by a gesture yet. */
export function audioUnlocked(): boolean {
  return unlocked
}

/* ── Live voice level (for an audio-reactive orb) ──────────────────────────
 * Tap the Kokoro audio element with a Web Audio AnalyserNode so the orb's wave
 * can move with the REAL speech amplitude (loud = tall, quiet = flat). Lazily
 * wired on first read; shared across every orb so there's one analyser, not one
 * per component. Returns 0 when nothing is playing. */
let analyser: AnalyserNode | null = null
let levelData: Uint8Array<ArrayBuffer> | null = null
let srcNode: MediaElementAudioSourceNode | null = null

function ensureAnalyser() {
  if (analyser || !audioEl) return
  // CRITICAL: once createMediaElementSource() is called on the <audio>, its sound
  // is routed into the Web Audio graph and NO LONGER reaches the speakers on its
  // own — it MUST be connected through to audioCtx.destination or playback goes
  // permanently silent (the "audio-reactive orb muted the voice" bug). So we create
  // the source in its own guarded step and ALWAYS wire it to the speakers first;
  // the analyser tap is layered on top and is allowed to fail without killing sound.
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!audioCtx) audioCtx = new Ctx()
    // createMediaElementSource can only be called once per element — guard it, and
    // the instant it exists, connect it straight to the speakers so audio is safe.
    if (!srcNode) {
      srcNode = audioCtx.createMediaElementSource(audioEl)
      srcNode.connect(audioCtx.destination)   // guarantee audible, no matter what
    }
  } catch {
    // couldn't tap the element at all — leave the plain <audio> playing normally.
    srcNode = null
    analyser = null
    return
  }
  // analyser is a BONUS layer for the orb's level meter — if it fails, we keep the
  // direct source→destination path intact (audio never dies for a dead meter).
  try {
    analyser = audioCtx.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.75
    levelData = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount))
    srcNode.connect(analyser)   // parallel tap; source still reaches destination above
  } catch {
    analyser = null // tapping failed → level stays 0, but voice still plays
  }
}

/** Current voice loudness, 0..1 (RMS of the waveform). 0 when silent. */
export function getVoiceLevel(): number {
  if (!audioEl || audioEl.paused) return 0
  if (!analyser) ensureAnalyser()
  if (!analyser || !levelData) return 0
  analyser.getByteTimeDomainData(levelData)
  let sum = 0
  for (let i = 0; i < levelData.length; i++) {
    const v = (levelData[i] - 128) / 128
    sum += v * v
  }
  const rms = Math.sqrt(sum / levelData.length)
  return Math.min(1, rms * 2.4) // scale so normal speech reaches ~0.6–0.9
}
