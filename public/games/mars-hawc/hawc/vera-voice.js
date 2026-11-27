// Vera's voice for Mars HAWC — the SAME warm neural voice (Kokoro af_heart) the
// site + the native Vera app use, running fully on-device (ONNX via WebGPU/WASM).
// This is a plain-JS mirror of the site's lib/kokoro-voice.ts, adapted for the
// game's self-contained static bundle: kokoro-js is dynamic-imported from a CDN
// on first use (it pulls @huggingface/transformers + phonemizer; too heavy to
// hand-vendor), and the model streams from HuggingFace — exactly as the site's
// own Vera voice already does.
//
// EVERYTHING here is lazy + degrades gracefully: nothing loads until voice is
// used, and if Kokoro is unavailable (no WebGPU, offline, load fails) every
// function reports failure so engine.js falls back to the instant browser voice.
// Gameplay is never blocked waiting on Vera.

// Vera's canonical voice — matches the native app + site default (af_heart:
// "warm, natural, clear — the best for her presence"). Keep in lock-step.
const VERA_VOICE = 'af_heart';
const KOKORO_URL = 'https://esm.sh/kokoro-js@1.2.1';
const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';

let ttsPromise = null;      // Promise<KokoroTTS|null>, created once
let audioEl = null;         // reusable <audio> for robust playback/resume
let audioCtx = null;        // the real "audio allowed" gate
let unlocked = false;
let loadFailed = false;     // once true, stop trying — go straight to fallback

// Call SYNCHRONOUSLY inside a user gesture (click/keydown) BEFORE any await, so
// the browser lets us play audio later even though generation is async. Mirrors
// the three-way unlock in lib/kokoro-voice.ts (AudioContext tick + silent <audio>
// prime + speechSynthesis prime). Safe to call repeatedly.
export function unlockVera() {
  if (typeof window === 'undefined') return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) {
      if (!audioCtx) audioCtx = new Ctx();
      if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      gain.gain.value = 0.0001;
      osc.connect(gain).connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.03);
    }
  } catch (e) { /* no AudioContext — the <audio> prime below covers us */ }
  if (!audioEl) { audioEl = new Audio(); audioEl.preload = 'auto'; }
  try {
    audioEl.muted = true;
    const p = audioEl.play();
    if (p && typeof p.then === 'function') {
      p.then(() => { audioEl.pause(); audioEl.muted = false; }).catch(() => { audioEl.muted = false; });
    } else { audioEl.pause(); audioEl.muted = false; }
  } catch (e) { audioEl.muted = false; }
  try {
    const synth = window.speechSynthesis;
    if (synth) { const u = new SpeechSynthesisUtterance(''); u.volume = 0; synth.speak(u); synth.cancel(); }
  } catch (e) { /* fallback path handles this */ }
  unlocked = true;
}

// Load (once) the on-device Kokoro pipeline. Returns null if unavailable. Begin
// this early (in the background) so the first spoken line isn't the slowest.
export function loadVera(onProgress) {
  if (loadFailed) return Promise.resolve(null);
  if (ttsPromise) return ttsPromise;
  ttsPromise = (async () => {
    if (typeof window === 'undefined') { loadFailed = true; return null; }
    try {
      const mod = await import(/* @vite-ignore */ KOKORO_URL);
      const KokoroTTSClass = mod.KokoroTTS;
      if (!KokoroTTSClass) { loadFailed = true; return null; }
      const device = 'gpu' in navigator ? 'webgpu' : 'wasm';
      const tts = await KokoroTTSClass.from_pretrained(MODEL_ID, {
        dtype: device === 'webgpu' ? 'fp32' : 'q8',
        device,
        progress_callback: (p) => { try { onProgress && onProgress((p && p.progress) || 0); } catch (e) {} },
      });
      return tts;
    } catch (e) {
      loadFailed = true;
      return null;
    }
  })();
  return ttsPromise;
}

// True once Kokoro has actually finished loading and is ready to speak THIS turn
// with no load delay — engine.js uses this to decide Vera-now vs instant-fallback.
let ready = false;
export function veraReady() { return ready; }

// Speak `text` in Vera's voice. Returns true if she spoke, false if she couldn't
// (caller then uses the browser voice). `speed` ~0.92 matches the site. Plays via
// a Blob on the reusable <audio> element (robust resume). `interrupt` cuts any
// line currently playing (used for urgent/overlapping radio).
export async function speakVera(text, { speed = 0.95, interrupt = false } = {}) {
  if (loadFailed) return false;
  try {
    const tts = await loadVera();
    if (!tts) return false;
    ready = true;
    const clean = String(text).replace(/\[(\w)\]/g, '$1').replace(/·/g, ',');
    const out = await tts.generate(clean, { voice: VERA_VOICE, speed });
    const blob = out && out.toBlob ? out.toBlob() : null;
    if (!blob) return false;

    if (!audioEl) { audioEl = new Audio(); audioEl.preload = 'auto'; }
    if (interrupt) stopVera();
    else if (!audioEl.paused) return true; // a line is already speaking — don't stack
    try { if (audioCtx && audioCtx.state === 'suspended') await audioCtx.resume(); } catch (e) {}
    const url = URL.createObjectURL(blob);
    audioEl.src = url;
    audioEl.muted = false;
    audioEl.volume = 0.9;
    audioEl.onended = () => URL.revokeObjectURL(url);
    try {
      await audioEl.play();
    } catch (e) {
      try { await (audioCtx && audioCtx.resume()); } catch (e2) {}
      try { await audioEl.play(); } catch (e3) { return false; }
    }
    return true;
  } catch (e) {
    return false;
  }
}

// Stop any Vera audio currently playing.
export function stopVera() {
  try { if (audioEl) { audioEl.pause(); audioEl.currentTime = 0; } } catch (e) {}
}

export function veraUnlocked() { return unlocked; }
