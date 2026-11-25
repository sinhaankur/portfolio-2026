"use client"

/**
 * SkyPanorama — the real photographic sky.
 *
 * ESO's 360° Milky Way panorama (Serge Brunier, ESO — CC BY 4.0,
 * https://www.eso.org/public/images/eso0932a/) projected onto the sky shell:
 * the actual Sagittarius bulge, the Great Rift dust lane, the Cygnus and
 * Scutum star clouds, both Magellanic Clouds — every photon in this layer is
 * a photograph of the real sky, not procedure. The HYG point stars render on
 * top of it (they carry the twinkle, colour and interactivity); this layer
 * carries the continuous glow and the DUST that no point field can fake.
 *
 * Coordinate honesty: the source image is an equirectangular map in GALACTIC
 * coordinates (galactic centre at image centre, longitude increasing leftward
 * per astronomical convention). The fragment shader converts each view
 * direction to galactic lon/lat through the true J2000 galactic basis —
 * computed from the IAU definitions (galactic centre RA 17h45.6m Dec −28.94°,
 * north galactic pole RA 12h51.4m Dec +27.13°) — so the band lands exactly
 * where it belongs among our equatorial-frame stars and constellations.
 *
 * Vantage crossfade: this is the sky AS SEEN FROM the solar system. Near the
 * Sun it's fully visible; flying out toward the galaxy model it fades away —
 * same two-vantage philosophy as the engine's compressed/true scale modes.
 * (The in-scene 3D Milky Way keeps its stylized placement; re-anchoring it to
 * the true galactic frame is on the pixel-perfect roadmap.)
 */

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import {
  BackSide,
  LinearMipmapLinearFilter,
  LinearFilter,
  NormalBlending,
  RepeatWrapping,
  ShaderMaterial,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  type Texture,
} from "three"
import { SUN_OFFSET_SCENE } from "./astronomy"

const PANO_RADIUS = 900
const SHELL_CENTER = new Vector3(SUN_OFFSET_SCENE, 0, 0)

// Direction on the unit sphere for a J2000 RA/Dec — same axis convention as
// raDecToScenePos (x/z in the equatorial plane, +y = north celestial pole).
function raDecDir(raHours: number, decDeg: number): Vector3 {
  const ra = (raHours / 12) * Math.PI
  const dec = (decDeg * Math.PI) / 180
  return new Vector3(
    Math.cos(dec) * Math.cos(ra),
    Math.sin(dec),
    Math.cos(dec) * Math.sin(ra),
  )
}

// True J2000 galactic basis (IAU): X → galactic centre, Z → north galactic
// pole, Y = Z × X completes the right-handed frame. Exported — the black-hole
// raymarcher lenses this exact sky, so both must share one mapping.
export function galacticBasis(): { x: Vector3; y: Vector3; z: Vector3 } {
  const z = raDecDir(12.8571, 27.128) // NGP
  const x = raDecDir(17.7611, -28.936) // galactic centre
  x.addScaledVector(z, -z.dot(x)).normalize() // orthogonalize against Z
  const y = new Vector3().crossVectors(z, x)
  return { x, y, z }
}

// Shared, cached texture load — the panorama sphere and every black hole's
// lensing shader pull from the same promise so the sky downloads once.
const _texCache = new Map<string, Promise<Texture>>()
export function loadAllSkyTexture(mobile: boolean): Promise<Texture> {
  const url = mobile
    ? "/textures/allsky-brunier-2k.webp"
    : "/textures/allsky-brunier-4k.webp"
  let p = _texCache.get(url)
  if (!p) {
    p = new Promise((resolve, reject) => {
      new TextureLoader().load(
        url,
        (t) => {
          t.colorSpace = SRGBColorSpace
          t.wrapS = RepeatWrapping // no seam at the l = ±180° join
          // Detail pass: the sky shell was the one surface left on DEFAULT
          // filtering while planets/moon/labels already run anisotropy 8 — so
          // the Milky Way's dust lanes and star clouds read soft and aliased at
          // grazing angles. Trilinear mipmaps + max anisotropy (16, hardware-
          // capped) sharpen the real photograph everywhere without touching a
          // pixel of the data. No extra download — same texture, better sampling.
          t.anisotropy = 16
          t.generateMipmaps = true
          t.minFilter = LinearMipmapLinearFilter
          t.magFilter = LinearFilter
          t.needsUpdate = true
          resolve(t)
        },
        undefined,
        reject,
      )
    })
    _texCache.set(url, p)
  }
  return p
}

const PANO_VERT = /* glsl */ `
  varying vec3 vWorldPos;
  void main() {
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const PANO_FRAG = /* glsl */ `
  varying vec3 vWorldPos;
  uniform sampler2D uMap;
  uniform vec3 uCenter;
  uniform vec3 uGalX;
  uniform vec3 uGalY;
  uniform vec3 uGalZ;
  uniform float uOpacity;
  uniform float uTone;

  void main() {
    vec3 d = normalize(vWorldPos - uCenter);
    float gx = dot(d, uGalX);
    float gy = dot(d, uGalY);
    float gz = dot(d, uGalZ);
    float lon = atan(gy, gx);
    float lat = asin(clamp(gz, -1.0, 1.0));
    // Astronomical convention: galactic longitude increases LEFTWARD on the
    // sky map, centre of the image is l = 0.
    float u = 0.5 - lon / 6.28318530718;
    float v = 0.5 + lat / 3.14159265359;
    vec3 col = texture2D(uMap, vec2(u, v)).rgb;

    // ── Depth grade — enhance the REAL photograph, invent nothing ───────────
    // The flat linear dim (col*tone - floor) made the dust and the core read
    // thin. This grade adds dimensionality while keeping every value sourced:
    //   luma → a gentle S-curve so the bright star-clouds separate from the
    //   mid dust and the Great Rift goes genuinely deep; then a mild saturation
    //   lift so the warm Sagittarius core and the blue O/B clouds hold their
    //   true colour instead of greying out.
    col *= uTone;
    float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
    // gentle S-curve contrast around the mid — pushes the dark dust down,
    // lifts the star-cloud glow, so the Great Rift reads with real depth.
    float contrast = (luma - 0.5) * 1.18 + 0.5;          // 1.18 = gentle S
    contrast = clamp(contrast, 0.0, 2.0);
    col *= (luma > 0.0004) ? (contrast / max(luma, 0.0004)) : 1.0;
    // saturation lift (around the graded luma) — keep the core warm, rift blue.
    float l2 = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(vec3(l2), col, 1.14);

    // Core glow — the galactic centre (l≈0, b≈0) is the brightest real region;
    // give it a faint extra lift so the Sagittarius bulge GLOWS with depth.
    // Based purely on the true galactic direction we already computed.
    float toCore = length(vec2(lon, lat * 1.6));   // 0 at galactic centre
    float coreGlow = exp(-toCore * toCore * 3.2) * 0.14;
    col += col * coreGlow;

    // true-black floor so the photograph still sits UNDER the point stars.
    col = max(col - 0.012, 0.0);
    gl_FragColor = vec4(col, uOpacity);
  }
`

export function SkyPanorama({ mobile = false }: { mobile?: boolean }) {
  const matRef = useRef<ShaderMaterial>(null)
  const [tex, setTex] = useState<Texture | null>(null)

  useEffect(() => {
    let alive = true
    loadAllSkyTexture(mobile).then((t) => {
      if (alive) setTex(t)
    })
    return () => {
      alive = false
    }
  }, [mobile])

  const uniforms = useMemo(() => {
    const basis = galacticBasis()
    return {
      uMap: { value: null as Texture | null },
      uCenter: { value: SHELL_CENTER.clone() },
      uGalX: { value: basis.x },
      uGalY: { value: basis.y },
      uGalZ: { value: basis.z },
      uOpacity: { value: 0 },
      uTone: { value: 0.85 },
    }
  }, [])

  useEffect(() => {
    if (tex) uniforms.uMap.value = tex
  }, [tex, uniforms])

  useFrame(({ camera }, delta) => {
    const mat = matRef.current
    if (!mat) return
    // This layer is the sky as seen from the solar system: full inside the
    // shell, gone by the time the camera is out among the deep-sky depths
    // (the 3D galaxy model owns that vantage).
    const dist = camera.position.distanceTo(SHELL_CENTER)
    const t = Math.min(1, Math.max(0, (dist - 130) / 170)) // 0 at ≤130 → 1 at ≥300
    const target = tex ? 1 - t : 0
    const k = 1 - Math.exp(-delta * 3)
    mat.uniforms.uOpacity.value += (target - mat.uniforms.uOpacity.value) * k
  })

  if (!tex) return null

  return (
    <mesh position={SHELL_CENTER} renderOrder={-20} frustumCulled={false}>
      <sphereGeometry args={[PANO_RADIUS, 48, 32]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={PANO_VERT}
        fragmentShader={PANO_FRAG}
        uniforms={uniforms}
        side={BackSide}
        transparent
        depthWrite={false}
        blending={NormalBlending}
      />
    </mesh>
  )
}
