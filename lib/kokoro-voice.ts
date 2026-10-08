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

/**
 * Call this SYNCHRONOUSLY inside a user gesture (click/tap) BEFORE any await, so
 * the browser lets us play audio later even though generation is async. Creates a
 * reusable <audio> element and primes it. Safe to call repeatedly.
 */
export function unlockAudio() {
  if (typeof window === "undefined") return
  if (!audioEl) {
    audioEl = new Audio()
    audioEl.preload = "auto"
  }
  // a muted, near-silent play() inside the gesture flips the "allowed" bit
  try {
    audioEl.muted = true
    const p = audioEl.play()
    if (p && typeof p.then === "function") p.then(() => { audioEl!.pause(); audioEl!.muted = false }).catch(() => { audioEl!.muted = false })
    else { audioEl.pause(); audioEl.muted = false }
    unlocked = true
  } catch {
    audioEl.muted = false
  }
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
    const url = URL.createObjectURL(blob)
    audioEl.src = url
    audioEl.muted = false
    audioEl.onended = () => URL.revokeObjectURL(url)
    // fire onStart the instant playback actually begins, so a caller can sync
    // its UI (e.g. the text reveal) to the voice rather than to the request.
    if (onStart) audioEl.onplaying = () => onStart()
    await audioEl.play()
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
