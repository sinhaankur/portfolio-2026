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
// pole, Y = Z × X completes the right-handed frame.
function galacticBasis(): { x: Vector3; y: Vector3; z: Vector3 } {
  const z = raDecDir(12.8571, 27.128) // NGP
  const x = raDecDir(17.7611, -28.936) // galactic centre
  x.addScaledVector(z, -z.dot(x)).normalize() // orthogonalize against Z
  const y = new Vector3().crossVectors(z, x)
  return { x, y, z }
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
    // Gentle tone-down + true-black floor so the photograph sits UNDER the
    // point stars instead of washing them out.
    col = max(col * uTone - 0.012, 0.0);
    gl_FragColor = vec4(col, uOpacity);
  }
`

export function SkyPanorama({ mobile = false }: { mobile?: boolean }) {
  const matRef = useRef<ShaderMaterial>(null)
  const [tex, setTex] = useState<Texture | null>(null)

  useEffect(() => {
    let alive = true
    const url = mobile
      ? "/textures/allsky-brunier-2k.webp"
      : "/textures/allsky-brunier-4k.webp"
    new TextureLoader().load(url, (t) => {
      if (!alive) return
      t.colorSpace = SRGBColorSpace
      t.wrapS = RepeatWrapping // no seam at the l = ±180° join
      setTex(t)
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
