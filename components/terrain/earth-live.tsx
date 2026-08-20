"use client"

/**
 * EarthLive — the "living Earth" layers for the Terrain Engine: an ocean sphere
 * at sea level, a drifting procedural cloud shell, and the REAL current Sun
 * direction so the day/night terminator matches now. No live data feed (works
 * offline / on the static export) — "today" comes from the real subsolar point
 * computed from the clock, and clouds are GLSL noise (no texture to source).
 */

import { useRef, useMemo } from "react"
import { useFrame } from "@react-three/fiber"
import { ShaderMaterial, Mesh, Vector3, BackSide, FrontSide } from "three"

/**
 * Direction from Earth's centre to the Sun RIGHT NOW, in the engine's frame
 * (lon 0 at +X, +Y north, +Z at lon 90°E) — matching latLonToUnitVec so the lit
 * hemisphere lines up with the surface. Uses the real subsolar point:
 *   • declination from the day-of-year (axial tilt · seasonal)
 *   • subsolar longitude from UTC time of day (the Sun is overhead at local noon)
 * Good to ~1° — plenty for a terminator that reads as "now".
 */
export function currentSunDirection(now = new Date()): Vector3 {
  const start = Date.UTC(now.getUTCFullYear(), 0, 0)
  const dayOfYear = Math.floor((now.getTime() - start) / 86_400_000)
  // Solar declination (deg) — standard approximation.
  const decl = -23.44 * Math.cos((2 * Math.PI / 365) * (dayOfYear + 10))
  const declRad = (decl * Math.PI) / 180
  // Subsolar longitude: at 12:00 UTC the Sun is over ~0° lon; it moves 15°/hour
  // westward. utcHours=0 → sun over 180°E (midnight at Greenwich).
  const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60
  const subsolarLon = (180 - utcHours * 15) * Math.PI / 180
  const cosD = Math.cos(declRad)
  return new Vector3(
    cosD * Math.cos(subsolarLon),
    Math.sin(declRad),
    cosD * Math.sin(subsolarLon),
  ).normalize()
}

// Procedural cloud shell — value-noise FBM masked so it looks like drifting cloud
// systems, lit by the same Sun so the night side of the clouds darkens. Drifts
// slowly and rotates, so the planet feels alive without any texture/feed.
const cloudVert = /* glsl */ `
varying vec3 vNormalW;
varying vec3 vPos;
void main() {
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vPos = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`
const cloudFrag = /* glsl */ `
precision highp float;
uniform vec3 uSunDir;
uniform float uTime;
varying vec3 vNormalW;
varying vec3 vPos;

// hash + value noise + fbm
float hash(vec3 p){ p = fract(p*0.3183099+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float noise(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hash(i+vec3(0,0,0)),hash(i+vec3(1,0,0)),f.x),
                 mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
                 mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float fbm(vec3 p){ float v=0.0, a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.03; a*=0.5;} return v; }

void main() {
  vec3 p = normalize(vPos);
  // Drift the cloud field slowly over time.
  float n = fbm(p * 2.6 + vec3(uTime * 0.012, 0.0, uTime * 0.006));
  n = smoothstep(0.48, 0.85, n);            // sparse, puffy coverage
  if (n < 0.02) discard;                     // clear sky = fully transparent
  // Light the clouds by the real Sun (night-side clouds go dark).
  float lit = clamp(dot(normalize(vNormalW), normalize(uSunDir)) * 0.9 + 0.25, 0.05, 1.0);
  vec3 col = vec3(1.0) * lit;
  gl_FragColor = vec4(col, n * 0.9);
}
`

export function EarthLive({ radiusUnits, oceanVisible }: { radiusUnits: number; oceanVisible: boolean }) {
  const cloudRef = useRef<Mesh>(null)
  const cloudMat = useRef<ShaderMaterial>(null)
  const oceanMat = useRef<ShaderMaterial>(null)

  const cloudUniforms = useMemo(() => ({
    uSunDir: { value: currentSunDirection() },
    uTime: { value: 0 },
  }), [])

  // Ocean: a smooth blue sphere at sea level with a real sunlit day/night
  // terminator, so water reads correctly and the lit side matches the clouds.
  const oceanUniforms = useMemo(() => ({
    uSunDir: { value: currentSunDirection() },
  }), [])

  useFrame((_, dt) => {
    // Refresh the real Sun direction periodically (cheap) so the terminator
    // tracks the actual time even on a long-open tab.
    const sun = currentSunDirection()
    if (cloudMat.current) {
      cloudMat.current.uniforms.uTime.value += dt
      cloudMat.current.uniforms.uSunDir.value.copy(sun)
    }
    if (oceanMat.current) oceanMat.current.uniforms.uSunDir.value.copy(sun)
    if (cloudRef.current) cloudRef.current.rotation.y += dt * 0.004 // gentle drift
  })

  return (
    <group>
      {/* Ocean at sea level (only when not drained) */}
      {oceanVisible && (
        <mesh>
          <sphereGeometry args={[radiusUnits * 1.0006, 128, 64]} />
          <shaderMaterial
            ref={oceanMat}
            transparent
            side={FrontSide}
            uniforms={oceanUniforms}
            vertexShader={/* glsl */`
              varying vec3 vN; varying vec3 vP;
              void main(){ vN = normalize(mat3(modelMatrix)*normal); vP = position;
                gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }
            `}
            fragmentShader={/* glsl */`
              precision highp float; uniform vec3 uSunDir; varying vec3 vN; varying vec3 vP;
              void main(){
                float lit = clamp(dot(normalize(vN), normalize(uSunDir)), 0.0, 1.0);
                // Deep ocean blue → brighter where sunlit; a touch of specular sky tint.
                vec3 deep = vec3(0.04, 0.15, 0.32);
                vec3 lit_c = vec3(0.12, 0.42, 0.62);
                vec3 col = mix(deep, lit_c, lit);
                float alpha = 0.9;
                gl_FragColor = vec4(col, alpha);
              }
            `}
          />
        </mesh>
      )}

      {/* Drifting cloud shell just above the surface */}
      <mesh ref={cloudRef}>
        <sphereGeometry args={[radiusUnits * 1.015, 96, 48]} />
        <shaderMaterial
          ref={cloudMat}
          transparent
          depthWrite={false}
          side={FrontSide}
          uniforms={cloudUniforms}
          vertexShader={cloudVert}
          fragmentShader={cloudFrag}
        />
      </mesh>

      {/* Thin atmosphere rim — a soft blue halo on the limb (backside shell). */}
      <mesh>
        <sphereGeometry args={[radiusUnits * 1.03, 64, 32]} />
        <shaderMaterial
          transparent
          side={BackSide}
          depthWrite={false}
          uniforms={{}}
          vertexShader={/* glsl */`
            varying vec3 vN; varying vec3 vView;
            void main(){ vN = normalize(mat3(modelMatrix)*normal);
              vec4 mv = modelViewMatrix*vec4(position,1.0); vView = normalize(-mv.xyz);
              gl_Position = projectionMatrix*mv; }
          `}
          fragmentShader={/* glsl */`
            precision highp float; varying vec3 vN; varying vec3 vView;
            void main(){
              float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), 3.0);
              gl_FragColor = vec4(vec3(0.35,0.6,1.0), rim * 0.6);
            }
          `}
        />
      </mesh>
    </group>
  )
}
