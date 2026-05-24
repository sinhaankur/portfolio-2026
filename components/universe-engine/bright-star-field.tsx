"use client"

/**
 * BrightStarField — real naked-eye stars on the sky shell.
 *
 * Replaces drei's procedural <Stars> with the HYG v4.1 subset baked
 * into lib/data/bright-stars.ts. Every star sits at its true RA/Dec,
 * sized by apparent magnitude, coloured by its B-V index (blue for
 * hot, red for cool). Constellations form naturally from the data —
 * the hand-drawn line figures in `constellations` just trace what's
 * already there.
 *
 * Rendering choices that make it look right (not generic):
 *
 *  1. NO distance attenuation.
 *     All stars are on the sky shell ~150 units from scene origin.
 *     A star is the same brightness regardless of which side of the
 *     sky it's on. The previous size formula multiplied gl_PointSize
 *     by 300/-z, which made stars on the far side of the shell shrink
 *     by ~2.7× as the camera rotated — astronomically wrong + visually
 *     unstable. Flat size is correct.
 *
 *  2. Device-pixel-ratio aware.
 *     gl_PointSize is in CSS pixels, but we want physical-pixel
 *     control. Multiplied by DPR so a faint star is at least 1
 *     device pixel rather than 0.5 (= invisible on retina).
 *
 *  3. Two-zone falloff — tight bright core + soft halo.
 *     Real stars (when not point-resolved through optics) have a
 *     concentrated centre + a softer Airy-disc halo. A single soft
 *     falloff blurs everything; a hard pixel is too aliased. Two
 *     smoothstep zones give the eye a crisp centre to lock onto.
 *
 *  4. Diffraction spikes on the brightest stars.
 *     Mag < ~1 (Sirius, Vega, Capella, Arcturus, Rigel, …) get a
 *     subtle 4-point cross sprite. That's the recognisable "this is
 *     a bright star" signature from photography — JWST + Hubble both
 *     produce them at their respective vane counts. We use a clean
 *     4-point cross, which reads as "bright star" without committing
 *     to any specific instrument's PSF.
 *
 *  5. Per-star atmospheric twinkle.
 *     Each star has a unique twinkle phase derived from its position
 *     (so adjacent stars don't synchronise) and an amplitude scaled
 *     by brightness — bright stars twinkle more visibly because the
 *     human eye is more sensitive to high-luminance flicker.
 *
 *  6. Bright-star colour desaturation.
 *     Very bright stars wash slightly toward white — a real perceptual
 *     effect from rod-saturated retinas, also what photographs show.
 *     Subtle (max 25%) so the colour signature still reads.
 *
 * Skipped in invert/chart mode — the ink-on-paper MilkyWay treatment
 * carries the sky background there.
 */

import { useEffect, useMemo, useRef } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  ShaderMaterial,
} from "three"
import {
  BRIGHT_STAR_COLORS,
  BRIGHT_STAR_COUNT,
  BRIGHT_STAR_MOTION_PER_YEAR,
  BRIGHT_STAR_POSITIONS,
  BRIGHT_STAR_SIZES,
} from "@/lib/data/bright-stars"
import { simTimeRef } from "./astronomy"

// J2000 epoch in ms (Jan 1, 2000 12:00 UTC). HYG proper motions are
// referenced from here, so "years since J2000" is the multiplier we
// apply to the per-star motion vector each frame. At page load with
// the simulation clock = real time, this is ~26 years (we're in 2026),
// so the stars already display their *current* positions on first
// frame, not their J2000 positions.
const J2000_MS = 946728000000

// Mobile cutoff: keep the top N brightest stars (the dataset is
// already sorted by magnitude). ~1,600 at mag ≤ 5 is the
// "city-sky naked eye" subset.
const MOBILE_STAR_COUNT = 1600

const STAR_VERTEX_SHADER = /* glsl */ `
  attribute float size;
  attribute vec3 color;
  attribute vec3 aMotionPerYear;
  varying vec3 vColor;
  varying float vBrightness;
  uniform float uSizeBoost;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uYearsFromEpoch;
  uniform float uSkyShellRadius;

  void main() {
    vColor = color;
    // size is 0.35..4.0 from magToSize; map to 0.1..1.0 brightness 0–1.
    vBrightness = clamp((size - 0.35) / 3.65, 0.0, 1.0);

    // Proper-motion displacement.
    //
    // aMotionPerYear is a tangent-frame vector in radians per year
    // (baked from HYG pmra/pmdec at J2000). At sky-shell radius R,
    // angular displacement θ rad corresponds to Cartesian
    // displacement θ × R (small-angle approximation, accurate enough
    // for ~100,000-year scales). Linear extrapolation is fine; real
    // stellar dynamics are nonlinear over megayears but invisible at
    // our timescales.
    //
    // At default sim time (~26 years from J2000), most stars shift
    // by < 1 scene unit — invisible. Crank the time-warp slider to
    // run thousands of years and Barnard's Star (~10,000 mas/yr)
    // will visibly streak; the Big Dipper's bowl will deform.
    vec3 displaced = position + aMotionPerYear * uSkyShellRadius * uYearsFromEpoch;

    // Stable per-star seed for twinkle phase. Using original position
    // (not the displaced one) so the seed stays stable across the
    // time-warp slider — stars don't change their twinkle phase as
    // they drift.
    float seed = position.x * 0.13 + position.y * 0.17 + position.z * 0.11;

    // Atmospheric twinkle: low-amplitude wobble, more pronounced on
    // bright stars (visually + scientifically — the eye notices
    // luminance flicker more on bright sources).
    float twinkle = 1.0 + (0.06 + 0.10 * vBrightness) * sin(uTime * 1.8 + seed);

    vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);

    // FLAT size — no distance attenuation. All sky-shell stars are
    // ~the same distance in reality; size variation should come from
    // magnitude alone, not from where the camera's looking.
    gl_PointSize = size * uSizeBoost * uPixelRatio * twinkle;

    gl_Position = projectionMatrix * mvPosition;
  }
`

const STAR_FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vColor;
  varying float vBrightness;

  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float d = length(uv);
    if (d > 0.5) discard;

    // Tight bright core (0..0.12) + soft halo (0.12..0.5). The hard
    // outer cutoff is masked by the additive blending so it doesn't
    // read as a hard circle edge.
    float core = 1.0 - smoothstep(0.0, 0.12, d);
    float halo = pow(1.0 - smoothstep(0.10, 0.5, d), 1.6) * 0.55;
    float alpha = max(core, halo);

    // Diffraction spike — only the brightest stars (vBrightness > 0.65,
    // ≈ apparent mag < 1). A 4-point cross adds the photographic
    // "look at me, I'm bright" signature without committing to a
    // specific instrument's PSF.
    if (vBrightness > 0.65) {
      float spikeH = pow(max(0.0, 1.0 - abs(uv.y) * 7.0), 5.0);
      float spikeV = pow(max(0.0, 1.0 - abs(uv.x) * 7.0), 5.0);
      // Spike amplitude ramps with brightness and is constrained
      // inside the point's bounding box — the discard at d>0.5 above
      // clips it cleanly; otherwise the cross would extend off-point.
      float spike = max(spikeH, spikeV)
                  * smoothstep(0.65, 1.0, vBrightness)
                  * (1.0 - smoothstep(0.35, 0.5, d));
      alpha = max(alpha, spike * 0.55);
    }

    // Brightest stars desaturate slightly toward white — real
    // perceptual effect (rod saturation) + makes Sirius/Vega read
    // as the headline stars they are.
    vec3 col = mix(vColor, vec3(1.0), vBrightness * 0.25);

    gl_FragColor = vec4(col, alpha);
  }
`

export function BrightStarField({
  invert = false,
  mobile = false,
  enableMotion = true,
}: {
  invert?: boolean
  mobile?: boolean
  enableMotion?: boolean
}) {
  const matRef = useRef<ShaderMaterial>(null)
  const gl = useThree((state) => state.gl)

  const { geometry } = useMemo(() => {
    const n = mobile ? Math.min(MOBILE_STAR_COUNT, BRIGHT_STAR_COUNT) : BRIGHT_STAR_COUNT
    const geo = new BufferGeometry()
    // Subarray — same underlying buffer, no allocation. The dataset
    // is sorted by magnitude so subarray(0, n) is "top N brightest".
    geo.setAttribute(
      "position",
      new BufferAttribute(BRIGHT_STAR_POSITIONS.subarray(0, n * 3), 3),
    )
    geo.setAttribute(
      "color",
      new BufferAttribute(BRIGHT_STAR_COLORS.subarray(0, n * 3), 3),
    )
    geo.setAttribute("size", new BufferAttribute(BRIGHT_STAR_SIZES.subarray(0, n), 1))
    // Per-star proper-motion vector in rad/yr (HYG, ref J2000).
    // Shader multiplies by sky-shell radius × uYearsFromEpoch each
    // frame to get the live displacement.
    geo.setAttribute(
      "aMotionPerYear",
      new BufferAttribute(BRIGHT_STAR_MOTION_PER_YEAR.subarray(0, n * 3), 3),
    )
    return { geometry: geo }
  }, [mobile])

  // Initial DPR + keep in sync if the user moves between displays
  // (e.g. external monitor with different DPR). R3F's pixel ratio is
  // already capped to a sensible max so we just read it directly.
  useEffect(() => {
    if (matRef.current) {
      matRef.current.uniforms.uPixelRatio.value = gl.getPixelRatio()
    }
  }, [gl])

  useFrame((state) => {
    if (!matRef.current) return
    if (enableMotion) {
      matRef.current.uniforms.uTime.value = state.clock.elapsedTime
    }
    // Years from J2000 (the HYG proper-motion reference epoch). The
    // simulation clock advances at TIME_WARP_DAYS_PER_SEC × timeWarp
    // each real second; at warp 100 a year passes every ~2.7 s of
    // real time and the deformation becomes visible. Cheap math, no
    // throttling — one float per frame.
    const simMs = simTimeRef.current.epochMs + simTimeRef.current.days * 86_400_000
    const years = (simMs - J2000_MS) / (365.25 * 86_400_000)
    matRef.current.uniforms.uYearsFromEpoch.value = years
  })

  // Chart mode — drop the star field. The MilkyWay ink-on-paper
  // treatment carries the sky background in invert mode.
  if (invert) return null

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={matRef}
        vertexShader={STAR_VERTEX_SHADER}
        fragmentShader={STAR_FRAGMENT_SHADER}
        uniforms={{
          // Multiplies every star's baked size. 2.6 gives Sirius
          // (size ≈ 3.6) ~9 device-pixels and mag-6 stars ~1 pixel.
          uSizeBoost: { value: 2.6 },
          uTime: { value: 0 },
          uPixelRatio: { value: 1 },
          // Proper-motion drift. Set per frame from simTimeRef.
          uYearsFromEpoch: { value: 0 },
          // Sky-shell radius in scene units — must match the value the
          // fetch script projected positions onto (SKY_SHELL there).
          uSkyShellRadius: { value: 150 },
        }}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  )
}

// Exposed so the parent can pick the correct rendered count for
// any "N stars visible" copy in the HUD or InfoPanel.
export const getRenderedStarCount = (mobile: boolean): number =>
  mobile ? Math.min(MOBILE_STAR_COUNT, BRIGHT_STAR_COUNT) : BRIGHT_STAR_COUNT

// Type re-export for callers that want to walk the named subset
// without pulling the full data module.
export type { NamedStarMeta } from "@/lib/data/bright-stars"
export { NAMED_STARS, BRIGHT_STAR_COUNT } from "@/lib/data/bright-stars"
