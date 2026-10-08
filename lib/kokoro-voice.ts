/**
 * Vera's real voice in the browser — Kokoro (af_bella), the SAME model + voice
 * the native app uses, running fully on-device via kokoro-js (ONNX/WASM, WebGPU
 * when available). So the "Meet her" demo sounds like Vera herself, not the
 * generic browser voice.
 *
 * Everything here is lazy + client-only: the library (and its ~80 MB model) is
 * dynamic-imported on first use, never on page load, and never during SSR (the
 * site is a static export). One shared pipeline per tab; callers await speak().
 *
 * If anything fails (no WebGPU path, model won't load, offline), callers fall
 * back to the browser's speechSynthesis — the demo always talks.
 */

const VERA_VOICE = "af_bella" // Vera's voice in the native app (scripts/setup-kokoro.sh)

type KokoroTTS = {
  generate: (text: string, opts: { voice: string; speed?: number }) => Promise<{
    toBlob?: () => Blob
    toWav?: () => ArrayBuffer
    audio?: Float32Array
    sampling_rate?: number
  }>
}

let ttsPromise: Promise<KokoroTTS | null> | null = null

/** Load (once) the on-device Kokoro pipeline. Returns null if unavailable. */
export function loadKokoro(onProgress?: (p: number) => void): Promise<KokoroTTS | null> {
  if (ttsPromise) return ttsPromise
  ttsPromise = (async () => {
    if (typeof window === "undefined") return null
    try {
      const mod = await import("kokoro-js")
      const KokoroTTSClass = (mod as unknown as { KokoroTTS: { from_pretrained: (id: string, o: object) => Promise<KokoroTTS> } }).KokoroTTS
      // WebGPU where present (fast), else wasm (works everywhere).
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

let audioCtx: AudioContext | null = null
let current: AudioBufferSourceNode | null = null

/** True once Kokoro has finished loading for this tab. */
export function kokoroReady(): boolean {
  return ttsPromise !== null
}

/**
 * Speak `text` in Vera's real voice. Returns true if Kokoro spoke, false if it
 * couldn't (so the caller can fall back to the browser voice). Cancels any
 * in-flight utterance first.
 */
export async function speakKokoro(text: string, speed = 0.92): Promise<boolean> {
  try {
    const tts = await loadKokoro()
    if (!tts) return false
    const out = await tts.generate(text, { voice: VERA_VOICE, speed })
    const pcm = out.audio
    const sr = out.sampling_rate ?? 24000
    if (!pcm) return false

    audioCtx = audioCtx ?? new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    // resume if the tab gated it until a user gesture
    if (audioCtx.state === "suspended") await audioCtx.resume()
    stopKokoro()

    const buf = audioCtx.createBuffer(1, pcm.length, sr)
    // copy into a fresh Float32Array backed by a plain ArrayBuffer (the model's
    // output may be backed by a SharedArrayBuffer, which copyToChannel rejects).
    const channel = new Float32Array(pcm.length)
    channel.set(pcm)
    buf.copyToChannel(channel, 0)
    const src = audioCtx.createBufferSource()
    src.buffer = buf
    src.connect(audioCtx.destination)
    src.start()
    current = src
    return true
  } catch {
    return false
  }
}

/** Stop any Kokoro audio currently playing. */
export function stopKokoro() {
  try {
    current?.stop()
  } catch {
    /* already stopped */
  }
  current = null
}
