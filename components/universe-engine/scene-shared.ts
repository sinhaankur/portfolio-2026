/**
 * scene-shared — small primitives shared across the engine's render components.
 *
 * A single reusable pool of scratch Vector3s. These are allocated ONCE at module
 * scope and reused every frame (copy/set into them) so the render loop never
 * allocates — the standard Three.js "don't `new` in useFrame" pattern. Living
 * here (not scattered through scene.tsx) means every sub-engine imports the same
 * canonical pool instead of redeclaring its own.
 *
 * Scratch vectors are inherently transient: only hold a value for the span of a
 * single calculation, never across an await/yield. Fine because the frame loop
 * is synchronous.
 */

import {
  ImageBitmapLoader,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector3,
  type ColorSpace,
  type WebGLRenderer,
} from "three"
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js"

import { requestFlyTo, SKY_SHELL_DISTANCE } from "./astronomy"

/* ============================================================
 * KTX2 — GPU-compressed textures (Basis Universal).
 *
 * KTX2 stores textures ALREADY in a GPU-native compressed format, so they
 * upload straight to the GPU with NO CPU decode step — killing the 100–600ms
 * main-thread decode stall an 8K/16K WebP causes — AND stay compressed in VRAM
 * (~1/4–1/6 the memory, which is what keeps mobile from dropping the WebGL
 * context). The Basis transcoder is SELF-HOSTED (public/basis/, like the Draco
 * decoder) so there's no third-party CDN dependency.
 *
 * The loader needs the WebGLRenderer to detect which compressed formats this GPU
 * supports; a scene component calls setKtx2Renderer(gl) once on mount. Until then
 * (and where KTX2 is unsupported) callers fall back to the WebP path.
 * ============================================================ */
let _ktx2: KTX2Loader | null = null
let _ktx2Renderer: WebGLRenderer | null = null

/** Wire the KTX2 loader to the live renderer (called once from a scene component
 *  with useThree().gl). Required before any .ktx2 can transcode. */
export function setKtx2Renderer(gl: WebGLRenderer): void {
  if (_ktx2Renderer === gl && _ktx2) return
  _ktx2Renderer = gl
  _ktx2 = new KTX2Loader().setTranscoderPath("/basis/").detectSupport(gl)
}

/**
 * Load a texture with OFF-THREAD image decoding.
 *
 * The default TextureLoader decodes the image on the MAIN thread (an <img>
 * element's synchronous decode), so loading an 8K/16K planet map freezes the
 * frame for 100–600 ms — the exact spikes the perf probe caught on the home
 * hero. ImageBitmapLoader routes the decode through createImageBitmap(), which
 * runs on a browser worker thread, so the main thread never stalls and the
 * globe's texture swap is jank-free.
 *
 * Same callback shape as TextureLoader.load(url, onLoad, undefined, onError) so
 * call sites just swap the loader. Falls back to TextureLoader where
 * createImageBitmap is unavailable (older Safari), so nothing regresses.
 */
export function loadTextureAsync(
  url: string,
  onLoad: (tex: Texture) => void,
  onError?: () => void,
  colorSpace: ColorSpace = SRGBColorSpace,
): void {
  // TextureLoader path (main-thread decode, but works cross-origin via <img>):
  // the safety net for (a) browsers without createImageBitmap and (b) an
  // ImageBitmap fetch that fails CORS — three's ImageBitmapLoader uses fetch(),
  // which REQUIRES the server to send Access-Control-Allow-Origin, whereas the
  // <img crossOrigin> path is more forgiving. We prefer off-thread, fall back here.
  const viaImg = () => {
    const loader = new TextureLoader()
    loader.setCrossOrigin("anonymous")
    loader.load(url, (tex) => { tex.colorSpace = colorSpace; onLoad(tex) }, undefined, () => onError?.())
  }

  // KTX2 (GPU-compressed) — no CPU decode at all, uploads straight to the GPU.
  // Only when the renderer's been wired (setKtx2Renderer) and this is a .ktx2.
  // On any failure we fall through to the WebP sibling if the caller passed one
  // via the url swap upstream — here we just report the error so the caller can
  // retry the .webp rung.
  if (/\.ktx2($|\?)/i.test(url) && _ktx2) {
    _ktx2.setCrossOrigin("anonymous").load(
      url,
      (tex) => { tex.colorSpace = colorSpace; onLoad(tex) },
      undefined,
      () => onError?.(),
    )
    return
  }

  if (typeof createImageBitmap === "undefined") { viaImg(); return }

  const loader = new ImageBitmapLoader()
  loader.setCrossOrigin("anonymous")
  // Decode already flipped to match GL's texture orientation, so the resulting
  // Texture keeps flipY = false (an ImageBitmap can't be flipped at upload time).
  loader.setOptions({ imageOrientation: "flipY", premultiplyAlpha: "none" })
  loader.load(
    url,
    (bitmap) => {
      const tex = new Texture(bitmap as unknown as HTMLImageElement)
      tex.flipY = false // the bitmap is pre-flipped above
      tex.colorSpace = colorSpace
      tex.needsUpdate = true
      onLoad(tex)
    },
    undefined,
    // Off-thread fetch failed (often CORS on a cross-origin CDN) → retry the
    // forgiving <img> path before giving up, so a missing CORS header degrades
    // to a working (if main-thread) load instead of a blank texture.
    () => viaImg(),
  )
}

/** Reused for a body's world position when computing the sun direction, etc. */
export const _earthWorldPos = new Vector3()
/** The Sun's world position (set from SUN_OFFSET_SCENE each frame). */
export const _sunWorldPos = new Vector3()
/** Sun-direction scratch (sunWorldPos − bodyWorldPos, normalized). */
export const _sunDirTmp = new Vector3()
/** Scratch axis for per-object rotation (e.g. belt-rock tumble). */
export const _tmpAxis = new Vector3()

/**
 * Build an onClick handler that flies the camera to the clicked object's world
 * position at a desired distance. Returns undefined when the scene isn't
 * interactive, so a non-interactive hero simply omits the click affordance.
 * Shared by every clickable body (the Milky Way core, the Sun, …) so the
 * fly-to gesture is defined once.
 */
export function makeFocusHandler(
  interactive: boolean,
  desiredDistance: number,
  label?: string,
) {
  if (!interactive) return undefined
  return (e: { stopPropagation: () => void; object: import("three").Object3D }) => {
    e.stopPropagation()
    const world = new Vector3()
    e.object.getWorldPosition(world)
    requestFlyTo({ x: world.x, y: world.y, z: world.z }, desiredDistance, label)
  }
}

/** Parse a human distance string ("4,500 ly", "2.5 million ly") → light-years. */
export function parseDistanceLy(distance?: string): number | null {
  if (!distance) return null
  const s = distance.toLowerCase().replace(/,/g, "")
  const num = parseFloat(s)
  if (!isFinite(num)) return null
  if (s.includes("billion") || /\bgly\b/.test(s)) return num * 1e9
  if (s.includes("million") || /\bmly\b/.test(s)) return num * 1e6
  if (s.includes("thousand") || /\bkly\b/.test(s)) return num * 1e3
  return num // plain light-years
}

/** Map a deep-sky object's real distance → a scene radius. The fixed-star shell
 *  is 150; deep-sky objects sit from ~the shell outward, log-spread by distance,
 *  so nearer objects parallax in front of farther ones as the camera moves. */
export function skyDepthRadius(distance?: string): number {
  const ly = parseDistanceLy(distance)
  if (ly == null) return SKY_SHELL_DISTANCE
  // log10(ly): nebulae ~3–4 (thousands), local-group galaxies ~6–7 (millions),
  // far galaxies ~7–8. Spread that ~3.5→8 range onto ~140→340 scene units.
  const L = Math.log10(Math.max(ly, 100))
  const t = Math.min(1, Math.max(0, (L - 3.0) / 5.0)) // 0 at 1k ly → 1 at 1e8 ly
  return 140 + t * 200
}
