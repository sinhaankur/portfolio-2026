/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine. Others may reference this work.
 * https://github.com/sinhaankur/portfolio-2026
 *
 * device-tier — classify the visitor's hardware into low / mid / high so the
 * Universe Engine can scale its quality to fit. The goal: a powerful machine
 * gets the full rich scene, a weak one stays SMOOTH instead of janky — instead
 * of one compromise setting that's wrong for both.
 *
 * Two layers:
 *   1. A STATIC capability guess from real browser signals (below), for the
 *      initial quality on first paint.
 *   2. (optional, wired in the engine) a LIVE FPS probe that downgrades the tier
 *      if the scene actually runs slow — the ground truth over any guess.
 *
 * Signals are all best-effort — none is guaranteed cross-browser — so the tier
 * is a weighted vote, biased toward NOT over-promising (a wrong "high" janks; a
 * wrong "mid" just looks slightly plainer).
 */

export type DeviceTier = "low" | "mid" | "high" | "ultra"

export type OS = "macos" | "ios" | "ipados" | "windows" | "android" | "linux" | "webos" | "unknown"

export type DeviceProfile = {
  tier: DeviceTier
  /** Operating system, best-effort from UA + platform + touch. */
  os: OS
  /** CPU logical cores (navigator.hardwareConcurrency), or null if unknown. */
  cores: number | null
  /** Device RAM in GB (navigator.deviceMemory, Chromium-only), or null. */
  memoryGB: number | null
  /** Raw GPU renderer string (WEBGL_debug_renderer_info), or null. */
  gpu: string | null
  /** Coarse pointer → touch device. */
  touch: boolean
  /** devicePixelRatio at detection time. */
  dpr: number
  /** Small-viewport phone (the old `mobile` heuristic), kept for compatibility. */
  smallViewport: boolean
  /** One-line human explanation of why this tier was chosen (for debugging). */
  reason: string
}

/** Best-effort OS detection. iPadOS masquerades as macOS in Safari, so a
 *  "Mac" UA WITH touch points is treated as an iPad. */
function detectOS(): OS {
  if (typeof navigator === "undefined") return "unknown"
  const ua = navigator.userAgent || ""
  const plat = (navigator.platform || "").toLowerCase()
  const touchPoints = navigator.maxTouchPoints || 0
  // webOS TVs report "Web0S" (zero) + Linux — check BEFORE the generic Linux match.
  if (/web0s|webos|smart-?tv|netcast/i.test(ua)) return "webos"
  if (/iphone|ipod/i.test(ua)) return "ios"
  if (/ipad/i.test(ua)) return "ipados"
  // iPadOS 13+ reports as "MacIntel" but with touch — distinguish from a real Mac.
  if ((plat === "macintel" || /macintosh/i.test(ua)) && touchPoints > 1) return "ipados"
  if (/mac os x|macintosh/i.test(ua) || plat.startsWith("mac")) return "macos"
  if (/android/i.test(ua)) return "android"
  if (/windows|win32|win64/i.test(ua) || plat.startsWith("win")) return "windows"
  if (/linux/i.test(ua) || plat.includes("linux")) return "linux"
  return "unknown"
}

/** Read the GPU renderer string via the debug-renderer-info extension. Returns
 *  null if WebGL or the extension is unavailable (some privacy modes block it). */
function readGpu(): string | null {
  if (typeof document === "undefined") return null
  try {
    const canvas = document.createElement("canvas")
    const gl = (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null
    if (!gl) return null
    const ext = gl.getExtension("WEBGL_debug_renderer_info")
    if (!ext) return null
    const r = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string
    return typeof r === "string" ? r : null
  } catch {
    return null
  }
}

/** Classify a GPU renderer string into a rough tier hint, or null if unknown. */
function gpuTierHint(gpu: string | null): DeviceTier | null {
  if (!gpu) return null
  const g = gpu.toLowerCase()
  // Top-end enthusiast GPUs → ULTRA (render the richest scene at native DPR).
  //   NVIDIA RTX 30/40/50-series, high Radeon RX 6000/7000/9000, Apple Max/Ultra.
  if (/rtx\s?(30|40|50)[0-9]{2}|rtx\s?(3080|3090|4070|4080|4090|5080|5090)/.test(g)) return "ultra"
  if (/radeon rx\s?(6[89]|7[89]|9[07])[0-9]{2}/.test(g)) return "ultra"
  if (/apple m[0-9]+ (max|ultra)/.test(g)) return "ultra"
  // Discrete / high-end desktop GPUs → high.
  if (/rtx|radeon rx|geforce (gtx|rtx)|quadro|arc a[0-9]/.test(g)) return "high"
  // Apple Silicon Pro → high; base M-series is solidly mid-high.
  if (/apple m[0-9]+ pro/.test(g)) return "high"
  if (/apple m[0-9]/.test(g)) return "mid" // base M1/M2/M3 → mid (safe; live probe can lift)
  // Integrated / mobile GPUs that struggle with a heavy full-screen scene.
  if (/intel.*(hd|uhd) graphics|intel.*iris|mali|adreno|powervr|swiftshader|llvmpipe/.test(g)) return "low"
  if (/intel/.test(g)) return "mid"
  return null
}

/**
 * Detect the device profile from static signals. Safe to call once on mount.
 * The tier is a vote: GPU string (strongest) + cores + memory + touch + DPR.
 */
export function detectDeviceProfile(): DeviceProfile {
  const nav = typeof navigator !== "undefined" ? navigator : ({} as Navigator)
  const cores = typeof nav.hardwareConcurrency === "number" ? nav.hardwareConcurrency : null
  const memoryGB = typeof (nav as Navigator & { deviceMemory?: number }).deviceMemory === "number"
    ? (nav as Navigator & { deviceMemory?: number }).deviceMemory ?? null
    : null
  const gpu = readGpu()
  const os = detectOS()
  const touch = typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(pointer: coarse)").matches
    : false
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1
  const smallViewport = typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(max-width: 768px)").matches
    : false

  // --- weighted vote toward a tier ---
  const gpuHint = gpuTierHint(gpu)
  let score = 0 // negative → low, ~0 → mid, positive → high
  const notes: string[] = []

  if (gpuHint === "ultra") { score += 3; notes.push(`top GPU:${gpu}`) }
  else if (gpuHint === "high") { score += 2; notes.push(`GPU:${gpu}`) }
  else if (gpuHint === "low") { score -= 2; notes.push(`weak GPU:${gpu}`) }
  else if (gpuHint === "mid") { score += 0; notes.push(`GPU:${gpu ?? "mid"}`) }

  if (cores != null) {
    if (cores >= 8) { score += 1; notes.push(`${cores} cores`) }
    else if (cores <= 4) { score -= 1; notes.push(`${cores} cores`) }
  }
  if (memoryGB != null) {
    if (memoryGB >= 8) { score += 1; notes.push(`${memoryGB}GB`) }
    else if (memoryGB <= 4) { score -= 1; notes.push(`${memoryGB}GB`) }
  }
  // A touch device on a small screen is a phone/tablet → cap toward low/mid.
  if (touch && smallViewport) { score -= 1; notes.push("touch+small") }

  // OS signal. When the GPU string is unavailable (blocked in some browsers),
  // the OS is a useful fallback prior: desktop macOS/Windows skew stronger than a
  // phone OS. Weight it lightly so it never overrides a known GPU.
  if (gpuHint == null) {
    if (os === "macos") { score += 1; notes.push("macOS") }
    else if (os === "windows" || os === "linux") { notes.push(os) } // neutral — huge range
    else if (os === "android") { score -= 1; notes.push("Android") }
    else if (os === "ios") { score -= 1; notes.push("iOS") }
    else if (os === "ipados") { notes.push("iPadOS") } // modern iPads are strong
  } else {
    notes.push(os)
  }

  let tier: DeviceTier
  // ULTRA requires a clear top-end GPU AND corroborating cores/RAM — never on the
  // GPU string alone, so a mislabelled renderer can't over-promise. The live FPS
  // probe still steps it down if the machine can't actually hold the frames.
  if (score >= 4 && gpuHint === "ultra") tier = "ultra"
  else if (score >= 2) tier = "high"
  else if (score <= -1) tier = "low"
  else tier = "mid"

  // CONSERVATIVE START when the GPU is unknown. Browsers increasingly MASK the
  // WebGL renderer string (privacy) → gpuHint is null, and we'd otherwise lean on
  // soft priors (macOS +1, core/RAM counts) that can over-promise on an
  // integrated GPU and make the scene "lag big time" for the first seconds until
  // the probe claws it back down. Starting one notch lower and letting the live
  // FPS probe climb UP with proven headroom is always smoother than starting high
  // and stuttering down. So with no real GPU signal, cap the opening tier at mid.
  if (gpuHint == null && (tier === "high" || tier === "ultra")) {
    tier = "mid"
    notes.push("GPU masked → conservative start")
  }

  // Hard floor: a phone/tablet never gets the heavy desktop scene.
  if ((os === "ios" || os === "android") && (tier === "high" || tier === "ultra")) tier = "mid"
  if (touch && smallViewport && (tier === "high" || tier === "ultra")) tier = "mid"
  // TVs: always the TV profile — webOS panels are fill-rate-bound; the engine
  // gives them an absolute pixel budget + their own quality knobs below.
  if (os === "webos") { tier = "low"; notes.push("webOS TV") }

  return {
    tier,
    os,
    cores,
    memoryGB,
    gpu,
    touch,
    dpr,
    smallViewport,
    reason: `${tier} · ${os} (score ${score}: ${notes.join(", ") || "no signals"})`,
  }
}

/** Per-tier quality knobs the engine reads to scale the scene. One place to tune. */
export type QualitySettings = {
  /** Canvas dpr clamp [min, max]. */
  dpr: [number, number]
  /** Multiplier on decorative point counts (Milky Way, stars, nebulae, meteors). */
  densityScale: number
  /** Allow the 4K deep-zoom planet textures. */
  allowHiResTextures: boolean
  /** Allow the heaviest optional effects (volumetric nebulae, etc.). */
  allowHeavyEffects: boolean
  /**
   * Max satellites the LIVE SWARM parses into SGP4 satrecs + renders. The full
   * catalogue is ~18.7k objects; each parsed satrec is a fat JS object (~7 KB),
   * so holding all of them is ~130 MB of RAM plus a per-pass CPU cost. On weaker
   * devices that's the single biggest memory/CPU load of the whole engine. This
   * caps the RENDERED SWARM to a representative sample so a phone/low-RAM machine
   * stays smooth; the sample is chosen by importance (active payloads first), and
   * the HUD says "showing N of 18,744" so it's honest, never a silent lie. The
   * analysis panels (reentry / conjunction / proximity) still load the FULL
   * catalogue on demand — this only bounds what's held live for the swarm.
   * `Infinity` = no cap (every object, the full truth) for high/ultra.
   */
  maxSwarmSats: number
}

/** Module-scoped current tier + profile, so any engine component can read the
 *  device tier without prop-drilling (same pattern as the other engine refs).
 *  Starts at "mid" — a safe default before detection runs on mount. */
export const deviceProfileRef: { current: DeviceProfile | null } = { current: null }
export const perfTierRef: { current: DeviceTier } = { current: "mid" }

/**
 * RESOLUTION — the user's explicit texture-quality choice, a step above the
 * automatic tier system. Three levels the real asset tiers map onto:
 *   - "auto"  — Standard (~2K base maps); the adaptive controller manages detail.
 *   - "high"  — the 4K/8K hi-res tier (Earth 8K, Mars/Moon 4K) where a body ships it.
 *   - "ultra" — MAX fidelity: the HD / 16K "Super Clear" maps + ultra tier pinned
 *               (all heavy effects, max DPR) with auto-downgrade disabled.
 * Off ("auto") by default; the user opts up. Read across the engine to pick the
 * texture tier per body. */
export type ResolutionLevel = "auto" | "high" | "ultra"
export const resolutionRef: { current: ResolutionLevel } = { current: "auto" }

/**
 * SUPER CLEAR — back-compat boolean derived from resolutionRef ("ultra" ⇒ true).
 * Kept so the many `superClearRef.current` reads across the engine (texture
 * resolvers, perf probe, shaders) keep working unchanged; setResolution() below
 * keeps it in sync. True only at the top "ultra" level. */
export const superClearRef: { current: boolean } = { current: false }

/** True when the user picked at least the 4K/8K hi-res tier (high or ultra).
 *  Texture resolvers use this to decide whether to reach for a body's hi-res map
 *  regardless of the deep-zoom/device gate. */
export const hiResChosenRef: { current: boolean } = { current: false }

/** Set the user's resolution level and keep the derived refs in sync. */
export function setResolution(level: ResolutionLevel): void {
  resolutionRef.current = level
  superClearRef.current = level === "ultra"
  hiResChosenRef.current = level === "high" || level === "ultra"
}

/** Publish the current perf tier to a global so anything outside the engine
 *  (e.g. the bug reporter) can read what tier the device converged to. Keeps
 *  perfTierRef the single source of truth; this just mirrors it. */
export function setPerfTier(tier: DeviceTier): void {
  perfTierRef.current = tier
  if (typeof window !== "undefined") {
    ;(window as unknown as { __ueTier?: string }).__ueTier = tier
  }
}

/** Run detection once and latch it into the shared refs. Returns the profile. */
export function initDeviceTier(): DeviceProfile {
  const p = detectDeviceProfile()
  deviceProfileRef.current = p
  setPerfTier(p.tier)
  return p
}

/** R3F Canvas dpr for the current device. TVs get an ABSOLUTE pixel budget:
 *  the canvas renders at most ~1920 px wide and the panel upscales it —
 *  invisible at couch distance, 4× less fill on a 4K TV (the difference
 *  between a slideshow and a smooth drift on a TV GPU). Everything else keeps
 *  the tier's [min, max] clamp. */
export function dprForCanvas(clamp: [number, number]): number | [number, number] {
  if (deviceProfileRef.current?.os === "webos" && typeof window !== "undefined") {
    return Math.min(clamp[1], Math.max(0.5, 1920 / Math.max(window.innerWidth, 1)))
  }
  return clamp
}

/** Tier ladder, weakest → richest. The adaptive controller walks it both ways. */
export const TIER_ORDER: DeviceTier[] = ["low", "mid", "high", "ultra"]
export function downgradeTier(t: DeviceTier): DeviceTier {
  const i = TIER_ORDER.indexOf(t)
  return TIER_ORDER[Math.max(0, i - 1)]
}
export function upgradeTier(t: DeviceTier): DeviceTier {
  const i = TIER_ORDER.indexOf(t)
  return TIER_ORDER[Math.min(TIER_ORDER.length - 1, i + 1)]
}

/**
 * The adaptive-quality DECISION — the heart of "best experience on any device".
 *
 * Given the current tier and a recent frame-time reading (ms), decide whether to
 * step DOWN (protect smoothness), UP (spend spare headroom), or hold. Pure +
 * testable; the engine drives it from a rolling FPS window.
 *
 * IMPORTANT — feed this the p95 (near-worst) frame time, NOT the median.
 * Perceived CHOPPINESS is the worst frames, not the typical one: a device can
 * post a lovely 16 ms median while 1-in-10 frames spike to 40 ms, and that
 * stutter is exactly what reads as "laggy". Judging the p95 makes the controller
 * downgrade on the stutter a median would hide — the fix for "still feels choppy
 * even though the average looks fine".
 *
 * Asymmetric on purpose:
 *  - DOWN fast & eagerly: a slow p95 (>~26 ms ≈ <38 fps for the worst frames)
 *    means the current tier stutters HERE — drop immediately for smoothness.
 *  - UP slowly & cautiously: only when even the p95 is comfortably fast
 *    (<~15 ms ≈ >66 fps), leaving margin so a step up doesn't reintroduce jank.
 *    `ceiling` caps the climb: once a tier proved too heavy (a down-step), the
 *    controller won't exceed the tier below it again — so it CONVERGES on each
 *    device's best sustainable tier instead of oscillating.
 */
export function adaptTier(
  tier: DeviceTier,
  p95Ms: number,
  ceiling: DeviceTier | null,
): { tier: DeviceTier; direction: "down" | "up" | "hold" } {
  const DOWN_MS = 26 // p95 above this = the worst frames stutter → too heavy
  const UP_MS = 15   // even the p95 is fast → real headroom to climb
  if (p95Ms > DOWN_MS) {
    // CRASH-LAND when it's badly slow: stepping down one tier per window takes
    // ~6s to reach the floor from ultra, so a device that "lags big time" limps
    // for seconds first. If the p95 is way over budget, drop TWO tiers at once
    // (e.g. >~52ms ≈ worse than 19fps). A merely-over p95 still steps down one.
    const steps = p95Ms > DOWN_MS * 2 ? 2 : 1
    let next = tier
    for (let i = 0; i < steps; i++) next = downgradeTier(next)
    return { tier: next, direction: next === tier ? "hold" : "down" }
  }
  if (p95Ms < UP_MS) {
    const next = upgradeTier(tier)
    // Never climb TO OR ABOVE a tier that already proved too heavy here. The
    // ceiling is the tier that janked; the best sustainable tier is the one just
    // below it, so an up-step must stay strictly under the ceiling. This is what
    // stops the mid-device high↔mid oscillation and makes the loop converge.
    if (ceiling && TIER_ORDER.indexOf(next) >= TIER_ORDER.indexOf(ceiling)) {
      return { tier, direction: "hold" }
    }
    return { tier: next, direction: next === tier ? "hold" : "up" }
  }
  return { tier, direction: "hold" }
}

/**
 * The effective live-swarm cap for this device — the tier's `maxSwarmSats`, but
 * with a HARD RAM FLOOR that a strong-GPU / weak-RAM machine can't escape.
 *
 * Why a separate floor: the tier is a GPU-weighted vote, so a laptop with a
 * discrete GPU but only 4 GB of RAM can land on "high" and then try to hold the
 * full ~130 MB satrec heap — exactly the machine that can least afford it. The
 * GPU says "I can draw it"; RAM says "I can't hold it". This clamps by RAM
 * regardless of tier. `navigator.deviceMemory` is Chromium-only and coarse
 * (bucketed, capped at 8 GB), so we only ACT on a low reading (a present, small
 * value) and never loosen the cap when it's unknown.
 */
export function swarmCapForDevice(tier: DeviceTier): number {
  const tierCap = qualityForTier(tier).maxSwarmSats
  const mem = deviceProfileRef.current?.memoryGB ?? null
  if (mem == null) return tierCap // unknown → trust the tier (never loosen)
  // ≤2 GB: very tight — match the low floor. ≤4 GB: match the mid floor. These
  // only ever TIGHTEN (Math.min), never raise a low tier's already-small cap.
  if (mem <= 2) return Math.min(tierCap, 5000)
  if (mem <= 4) return Math.min(tierCap, 10000)
  return tierCap
}

export function qualityForTier(tier: DeviceTier): QualitySettings {
  // webOS TV profile: the absolute pixel budget (dprForCanvas) does the heavy
  // lifting — a 4K panel renders ≤1080p and upscales, 4× less fill — which buys
  // back enough headroom to keep the sky RICHER than generic "low" (0.6 density,
  // not 0.4). Big-screen quality with TV-chip smoothness; textures/effects
  // stay conservative.
  if (deviceProfileRef.current?.os === "webos") {
    // TV chips are fill-rate-bound AND memory-tight — a full 130 MB satrec heap
    // is a real risk of the browser tab being killed. Cap the live swarm hard.
    return { dpr: [0.5, 1], densityScale: 0.6, allowHiResTextures: false, allowHeavyEffects: false, maxSwarmSats: 4000 }
  }
  switch (tier) {
    case "ultra":
      // A clearly high-end PC: render the richest scene. Native-res canvas (DPR
      // up to 3 for HiDPI displays) and MORE decorative density than "high" —
      // this is the "use the power for a good experience" tier. The live FPS
      // probe steps it back to "high" if the machine can't hold ~36fps.
      return { dpr: [1, 3], densityScale: 1.4, allowHiResTextures: true, allowHeavyEffects: true, maxSwarmSats: Infinity }
    case "high":
      // Plenty of RAM + CPU: hold the WHOLE catalogue — the full truth, every dot live.
      return { dpr: [1, 2], densityScale: 1.0, allowHiResTextures: true, allowHeavyEffects: true, maxSwarmSats: Infinity }
    case "mid":
      // Keep the rich sky (density + effects) but DON'T auto-pull the heavy 4K/8K
      // R2 textures — a lot of real-world devices land on "mid" (it's the default
      // before detection + the unknown-GPU fallback), and force-loading hi-res
      // maps there was a real lag source. Base maps still render crisp; the user
      // can opt up to hi-res via the resolution picker ("High"/"Ultra"), which
      // sets hiResChosenRef and overrides this. Fidelity stays available — it's
      // just not forced onto a mid device that didn't ask for it.
      // A LOT of real devices land on "mid" (it's the default + the unknown-GPU
      // fallback). Holding all ~18.7k satrecs (~130 MB) here was a real memory
      // load; cap the live swarm to a representative 10k so the tab stays light
      // while the sky still reads as dense. The panels keep full-catalogue truth.
      return { dpr: [1, 1.5], densityScale: 0.7, allowHiResTextures: false, allowHeavyEffects: true, maxSwarmSats: 10000 }
    case "low":
    default:
      // Floor allows rendering BELOW native (0.75× → the canvas draws at 3/4 the
      // pixels and the browser upscales) — the single biggest fill-rate win for a
      // device that lags big time. Softness is a fair trade for smooth; the probe
      // only lands here when higher tiers proved too heavy. Density + effects cut.
      return { dpr: [0.75, 1], densityScale: 0.35, allowHiResTextures: false, allowHeavyEffects: false, maxSwarmSats: 5000 }
  }
}
