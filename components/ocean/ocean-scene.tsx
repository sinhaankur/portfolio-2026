"use client"

/**
 * OceanScene — the full procedural sea + real sky, in one R3F canvas. Ours,
 * end to end: the Gerstner OceanMesh below, a sky dome graded by the real
 * sun altitude, and sun + moon discs placed at their real azimuth/altitude
 * (from lib/sea-astronomy). Lit by the same real light. Renders at whatever
 * resolution the canvas is given — 8K-native, because it's geometry + shaders,
 * not a video file.
 */

import { useMemo } from "react"
import { Canvas } from "@react-three/fiber"
import * as THREE from "three"
import { waveTrains, type Wind } from "./wind"
import { OceanMesh } from "./ocean-mesh"
import {
  sunPosition,
  moonPosition,
  moonPhase,
  dayPhase,
  type DayPhase,
} from "@/lib/sea-astronomy"

// Sky colors per phase: [zenith, horizon] as linear-ish rgb 0..1.
const SKY: Record<DayPhase, { zenith: [number, number, number]; horizon: [number, number, number] }> = {
  night: { zenith: [0.01, 0.02, 0.05], horizon: [0.03, 0.06, 0.14] },
  astronomical: { zenith: [0.02, 0.03, 0.08], horizon: [0.06, 0.1, 0.22] },
  nautical: { zenith: [0.04, 0.07, 0.16], horizon: [0.12, 0.19, 0.36] },
  civil: { zenith: [0.11, 0.16, 0.34], horizon: [0.45, 0.36, 0.5] },
  golden: { zenith: [0.28, 0.36, 0.62], horizon: [0.92, 0.55, 0.28] },
  day: { zenith: [0.28, 0.55, 0.85], horizon: [0.78, 0.88, 0.95] },
}

/** Convert altitude/azimuth (deg) to a unit direction in scene space.
 *  Scene: +Y up, camera looks toward -Z (out to sea). Azimuth measured from
 *  north clockwise; we map so the sun tracks left→right across the sky. */
function altAzToDir(altDeg: number, azDeg: number): [number, number, number] {
  const alt = (altDeg * Math.PI) / 180
  const az = (azDeg * Math.PI) / 180
  const x = Math.cos(alt) * Math.sin(az)
  const y = Math.sin(alt)
  const z = -Math.cos(alt) * Math.cos(az)
  return [x, y, z]
}

function SkyDome({ phase }: { phase: DayPhase }) {
  const { zenith, horizon } = SKY[phase]
  const mat = useMemo(() => {
    return new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        uZenith: { value: new THREE.Color(...zenith) },
        uHorizon: { value: new THREE.Color(...horizon) },
      },
      vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader: `
        varying vec3 vDir; uniform vec3 uZenith; uniform vec3 uHorizon;
        void main(){
          float t = clamp(normalize(vDir).y*1.4+0.1, 0.0, 1.0);
          vec3 c = mix(uHorizon, uZenith, pow(t, 0.6));
          gl_FragColor = vec4(c, 1.0);
        }`,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])
  return (
    <mesh scale={[400, 400, 400]}>
      <sphereGeometry args={[1, 32, 16]} />
      <primitive object={mat} attach="material" />
    </mesh>
  )
}

function Disc({ dir, color, size, glow }: { dir: [number, number, number]; color: string; size: number; glow: number }) {
  const pos: [number, number, number] = [dir[0] * 300, dir[1] * 300, dir[2] * 300]
  return (
    <mesh position={pos}>
      <sphereGeometry args={[size, 24, 24]} />
      <meshBasicMaterial color={color} toneMapped={false} />
      {glow > 0 && (
        <mesh scale={[glow, glow, glow]}>
          <sphereGeometry args={[size, 16, 16]} />
          <meshBasicMaterial color={color} transparent opacity={0.12} toneMapped={false} />
        </mesh>
      )}
    </mesh>
  )
}

export function OceanScene({ when, lat, lng, wind }: { when: Date; lat: number; lng: number; wind: Wind }) {
  const sun = sunPosition(when, lat, lng)
  const moon = moonPosition(when, lat, lng)
  const phase = moonPhase(when)
  const band = dayPhase(sun.altitude)
  const sky = SKY[band]

  const trains = useMemo(() => waveTrains(wind), [wind])

  // Which light lights the water: the sun if up, else the moon.
  const sunDir = altAzToDir(sun.altitude, sun.azimuth)
  const moonDir = altAzToDir(moon.altitude, moon.azimuth)
  const sunUp = sun.altitude > -2
  const lightDir = sunUp ? sunDir : moonDir
  const lightColor: [number, number, number] = sunUp
    ? band === "golden"
      ? [1.0, 0.72, 0.42]
      : [1.0, 0.96, 0.86]
    : [0.55, 0.62, 0.8]

  const foam = Math.min(1, Math.max(0, (wind.speed - 4) / 10))

  return (
    <Canvas
      camera={{ position: [0, 4, 18], fov: 55, near: 0.1, far: 2000 }}
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      <SkyDome phase={band} />
      {sunUp && <Disc dir={sunDir} color={band === "golden" ? "#ffb04a" : "#fff6e0"} size={7} glow={2.4} />}
      {moon.altitude > -2 && <Disc dir={moonDir} color="#e6ecf5" size={4} glow={1.8 * phase.illumination + 0.4} />}
      <OceanMesh
        trains={trains}
        lightDir={lightDir}
        lightColor={lightColor}
        skyColor={sky.horizon}
        foam={foam}
      />
      <ambientLight intensity={sunUp ? 0.4 : 0.15} />
    </Canvas>
  )
}
