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
}

/** Module-scoped current tier + profile, so any engine component can read the
 *  device tier without prop-drilling (same pattern as the other engine refs).
 *  Starts at "mid" — a safe default before detection runs on mount. */
export const deviceProfileRef: { current: DeviceProfile | null } = { current: null }
export const perfTierRef: { current: DeviceTier } = { current: "mid" }

/** Run detection once and latch it into the shared refs. Returns the profile. */
export function initDeviceTier(): DeviceProfile {
  const p = detectDeviceProfile()
  deviceProfileRef.current = p
  perfTierRef.current = p.tier
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

/** Order tiers so a live probe can only ever step DOWN (never optimistically up). */
const TIER_ORDER: DeviceTier[] = ["low", "mid", "high", "ultra"]
export function downgradeTier(t: DeviceTier): DeviceTier {
  const i = TIER_ORDER.indexOf(t)
  return TIER_ORDER[Math.max(0, i - 1)]
}

export function qualityForTier(tier: DeviceTier): QualitySettings {
  // webOS TV profile: the absolute pixel budget (dprForCanvas) does the heavy
  // lifting — a 4K panel renders ≤1080p and upscales, 4× less fill — which buys
  // back enough headroom to keep the sky RICHER than generic "low" (0.6 density,
  // not 0.4). Big-screen quality with TV-chip smoothness; textures/effects
  // stay conservative.
  if (deviceProfileRef.current?.os === "webos") {
    return { dpr: [0.5, 1], densityScale: 0.6, allowHiResTextures: false, allowHeavyEffects: false }
  }
  switch (tier) {
    case "ultra":
      // A clearly high-end PC: render the richest scene. Native-res canvas (DPR
      // up to 3 for HiDPI displays) and MORE decorative density than "high" —
      // this is the "use the power for a good experience" tier. The live FPS
      // probe steps it back to "high" if the machine can't hold ~36fps.
      return { dpr: [1, 3], densityScale: 1.4, allowHiResTextures: true, allowHeavyEffects: true }
    case "high":
      return { dpr: [1, 2], densityScale: 1.0, allowHiResTextures: true, allowHeavyEffects: true }
    case "mid":
      return { dpr: [1, 1.5], densityScale: 0.7, allowHiResTextures: true, allowHeavyEffects: true }
    case "low":
    default:
      return { dpr: [1, 1.25], densityScale: 0.4, allowHiResTextures: false, allowHeavyEffects: false }
  }
}
