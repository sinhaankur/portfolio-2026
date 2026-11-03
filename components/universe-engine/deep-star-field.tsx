/**
 * DeepStarField — the REAL Milky Way, star by star.
 *
 * Lazy-loads public/data/deep-stars.bin: all ~119,625 stars in the HYG v4.1
 * catalogue (not just the mag ≤ 6.5 naked-eye subset that BrightStarField ships),
 * each at its TRUE RA/Dec on the sky-shell, with a blackbody colour from its B-V
 * index and a point size from its apparent magnitude. This replaces the engine's
 * old *procedural* spiral-arm point field (invented positions) with real
 * catalogued stars — the "real over invented" standard applied to the galaxy.
 * The luminous band emerges on its own because real stars crowd the galactic
 * plane (HYG is ~1.23× denser within 15° of it); the procedural dust-haze still
 * carries the diffuse glow of the billions of stars too faint for any catalogue.
 *
 * Binary layout (see scripts/fetch-deep-stars.mjs):
 *   uint32 N · int16[3N] pos(×200) · uint8[3N] rgb · uint8[N] mag((m+2)×8)
 * Sorted brightest-first, so a weaker device can render just the head slice.
 *
 * Skipped in invert/chart mode — the ink-on-paper Milky Way carries the light
 * theme. Additively blended; one draw call.
 */
import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { AdditiveBlending, BufferAttribute, BufferGeometry, ShaderMaterial } from "three"

const POS_SCALE = 200 // must match scripts/fetch-deep-stars.mjs

// Device caps: the full 119k on capable GPUs; a brightest-first slice elsewhere.
const COUNT_FOR = { ultra: 119625, high: 90000, mid: 45000, low: 18000, mobile: 14000 } as const

type Tier = keyof typeof COUNT_FOR

const DEEP_VERTEX_SHADER = /* glsl */ `
  attribute float aMag;        // apparent magnitude, decoded
  attribute vec3 color;
  varying vec3 vColor;
  varying float vBright;
  uniform float uSizeBoost;
  uniform float uPixelRatio;
  uniform float uTime;
  void main() {
    vColor = color;
    // magnitude → brightness 0..1 (mag −1.5 bright → ~1, mag 9 faint → ~0)
    vBright = clamp((6.5 - aMag) / 8.0, 0.0, 1.0);
    // size from magnitude: faint band stars are small specks; bright ones larger.
    float size = mix(0.6, 3.2, pow(vBright, 1.4));
    // gentle collective twinkle keyed off position so the field shimmers subtly
    float seed = position.x * 0.021 + position.y * 0.017 + position.z * 0.013;
    float tw = 1.0 + 0.05 * vBright * sin(uTime * 1.5 + seed);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * uSizeBoost * uPixelRatio * tw;
    gl_Position = projectionMatrix * mv;
  }
`

const DEEP_FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vColor;
  varying float vBright;
  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float d = length(uv);
    if (d > 0.5) discard;
    // tight core + soft halo; faint stars are nearly all core (small specks)
    float core = 1.0 - smoothstep(0.0, 0.16, d);
    float halo = pow(1.0 - smoothstep(0.12, 0.5, d), 1.8) * 0.4 * vBright;
    float alpha = max(core, halo) * (0.35 + 0.65 * vBright);
    // brightest stars desaturate slightly toward white
    vec3 col = mix(vColor, vec3(1.0), vBright * 0.22);
    gl_FragColor = vec4(col, alpha);
  }
`

export function DeepStarField({
  invert = false,
  tier = "high",
  sizeBoost = 1.0,
}: {
  invert?: boolean
  tier?: Tier
  sizeBoost?: number
}) {
  const { gl } = useThree()
  const matRef = useRef<ShaderMaterial>(null)
  const [geometry, setGeometry] = useState<BufferGeometry | null>(null)

  // lazy-fetch + unpack the binary once (after first paint). Aborts on unmount.
  useEffect(() => {
    if (invert) return
    let alive = true
    const ac = new AbortController()
    ;(async () => {
      try {
        const res = await fetch("/data/deep-stars.bin", { signal: ac.signal })
        if (!res.ok) return
        const buf = await res.arrayBuffer()
        if (!alive) return
        const dv = new DataView(buf)
        const N = dv.getUint32(0, true)
        const want = Math.min(N, COUNT_FOR[tier] ?? COUNT_FOR.high)
        let off = 4
        const posI16 = new Int16Array(buf, off, N * 3); off += N * 3 * 2
        const col8 = new Uint8Array(buf, off, N * 3); off += N * 3
        const mag8 = new Uint8Array(buf, off, N)
        // decode the head slice (stars are brightest-first)
        const positions = new Float32Array(want * 3)
        const colors = new Float32Array(want * 3)
        const mags = new Float32Array(want)
        for (let i = 0; i < want; i++) {
          positions[i * 3] = posI16[i * 3] / POS_SCALE
          positions[i * 3 + 1] = posI16[i * 3 + 1] / POS_SCALE
          positions[i * 3 + 2] = posI16[i * 3 + 2] / POS_SCALE
          colors[i * 3] = col8[i * 3] / 255
          colors[i * 3 + 1] = col8[i * 3 + 1] / 255
          colors[i * 3 + 2] = col8[i * 3 + 2] / 255
          mags[i] = mag8[i] / 8 - 2 // inverse of (mag+2)*8
        }
        const geo = new BufferGeometry()
        geo.setAttribute("position", new BufferAttribute(positions, 3))
        geo.setAttribute("color", new BufferAttribute(colors, 3))
        geo.setAttribute("aMag", new BufferAttribute(mags, 1))
        if (alive) setGeometry(geo)
      } catch {
        /* abort / fetch failure → silently skip; the haze still carries the band */
      }
    })()
    return () => {
      alive = false
      ac.abort()
    }
  }, [invert, tier])

  const uniforms = useMemo(
    () => ({
      uSizeBoost: { value: sizeBoost },
      uPixelRatio: { value: typeof window !== "undefined" ? gl.getPixelRatio() : 1 },
      uTime: { value: 0 },
    }),
    [gl, sizeBoost],
  )

  useEffect(() => {
    if (matRef.current) matRef.current.uniforms.uPixelRatio.value = gl.getPixelRatio()
  })

  useFrame((state) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = state.clock.elapsedTime
  })

  // the ink-on-paper Milky Way carries the light theme; no real-star layer there.
  if (invert || !geometry) return null

  return (
    <points geometry={geometry} frustumCulled={false} matrixAutoUpdate={false}>
      <shaderMaterial
        ref={matRef}
        vertexShader={DEEP_VERTEX_SHADER}
        fragmentShader={DEEP_FRAGMENT_SHADER}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  )
}
