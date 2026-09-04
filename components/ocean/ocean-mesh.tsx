"use client"

/**
 * OceanMesh — our own procedural sea. No external service, no AI video: a
 * real-time Gerstner-wave ocean rendered on the GPU, ours to control and
 * re-render at any resolution (8K-native — it's vector, not a video file).
 *
 * Vertex shader: sums N Gerstner wave trains (from the wind model) to displace
 * a big subdivided plane, and returns the analytic normal so lighting is exact.
 * Fragment shader: deep/shallow water color, a Fresnel sky mix, a sharp sun (or
 * moon) specular glint, and foam where wave crests steepen. The sun/moon
 * direction + colors are passed in from the real sea-astronomy sky, so the
 * water is lit by the same real sun and moon as the rest of the scene.
 */

import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"
import type { WaveTrain } from "./wind"

const MAX_TRAINS = 6

const vertex = /* glsl */ `
  uniform float uTime;
  uniform int uCount;
  uniform vec4 uWaveA[${MAX_TRAINS}]; // dirX, dirZ, amplitude, wavelength
  uniform vec2 uWaveB[${MAX_TRAINS}]; // speed, steepness
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vCrest;

  void main() {
    vec3 pos = position;
    vec3 tangent = vec3(1.0, 0.0, 0.0);
    vec3 binormal = vec3(0.0, 0.0, 1.0);
    float crest = 0.0;

    for (int i = 0; i < ${MAX_TRAINS}; i++) {
      if (i >= uCount) break;
      vec2 dir = normalize(uWaveA[i].xy);
      float amp = uWaveA[i].z;
      float wlen = uWaveA[i].w;
      float speed = uWaveB[i].x;
      float steep = uWaveB[i].y;
      float k = 6.28318530718 / wlen;          // wave number
      float f = k * (dot(dir, pos.xz) - speed * uTime);
      float a = steep / (k * float(uCount) + 1e-4);

      pos.x += dir.x * (a * cos(f));
      pos.z += dir.y * (a * cos(f));
      pos.y += amp * sin(f);

      // analytic partial derivatives for the normal
      float c = cos(f), s = sin(f);
      tangent += vec3(
        -dir.x * dir.x * (steep * s),
        dir.x * (amp * k * c),
        -dir.x * dir.y * (steep * s)
      );
      binormal += vec3(
        -dir.x * dir.y * (steep * s),
        dir.y * (amp * k * c),
        -dir.y * dir.y * (steep * s)
      );
      crest += max(0.0, s) * amp;
    }

    vNormal = normalize(cross(binormal, tangent));
    vCrest = crest;
    vec4 world = modelMatrix * vec4(pos, 1.0);
    vWorldPos = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const fragment = /* glsl */ `
  precision highp float;
  uniform vec3 uCamPos;
  uniform vec3 uLightDir;    // toward the sun/moon
  uniform vec3 uLightColor;
  uniform vec3 uSkyColor;    // horizon sky (for reflection + Fresnel)
  uniform vec3 uDeepColor;
  uniform vec3 uShallowColor;
  uniform float uFoam;       // 0..1 how much foam (wind-driven)
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vCrest;

  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(uCamPos - vWorldPos);
    vec3 L = normalize(uLightDir);

    // Fresnel — more sky reflected at grazing angles
    float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
    fres = clamp(0.02 + 0.98 * fres, 0.0, 1.0);

    // base water color by view angle (deep vs shallow look)
    float facing = max(dot(N, V), 0.0);
    vec3 water = mix(uShallowColor, uDeepColor, facing);

    // sky reflection
    vec3 refl = mix(water, uSkyColor, fres);

    // specular glint from the real sun/moon
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), 220.0);
    // a softer, longer sun-path shimmer near the light azimuth
    float shimmer = pow(max(dot(N, H), 0.0), 24.0) * 0.25;

    // foam on steep crests, scaled by wind
    float foam = smoothstep(0.35, 0.9, vCrest * (0.6 + uFoam)) * uFoam;

    vec3 col = refl
      + uLightColor * (spec * 2.2 + shimmer)
      + vec3(foam);

    // gentle tonemap
    col = col / (col + vec3(0.6));
    col = pow(col, vec3(0.85));
    gl_FragColor = vec4(col, 1.0);
  }
`

export function OceanMesh({
  trains,
  lightDir,
  lightColor,
  skyColor,
  foam,
  deepColor = [0.02, 0.09, 0.16],
  shallowColor = [0.05, 0.22, 0.28],
}: {
  trains: WaveTrain[]
  lightDir: [number, number, number]
  lightColor: [number, number, number]
  skyColor: [number, number, number]
  foam: number
  deepColor?: [number, number, number]
  shallowColor?: [number, number, number]
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null)

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uCount: { value: Math.min(MAX_TRAINS, trains.length) },
      uWaveA: { value: Array.from({ length: MAX_TRAINS }, () => new THREE.Vector4()) },
      uWaveB: { value: Array.from({ length: MAX_TRAINS }, () => new THREE.Vector2()) },
      uCamPos: { value: new THREE.Vector3() },
      uLightDir: { value: new THREE.Vector3(...lightDir) },
      uLightColor: { value: new THREE.Color(...lightColor) },
      uSkyColor: { value: new THREE.Color(...skyColor) },
      uDeepColor: { value: new THREE.Color(...deepColor) },
      uShallowColor: { value: new THREE.Color(...shallowColor) },
      uFoam: { value: foam },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  // Push live params each frame (cheap; keeps the sea in sync with the real sky).
  useFrame(({ clock, camera }) => {
    const u = uniforms
    u.uTime.value = clock.getElapsedTime()
    u.uCount.value = Math.min(MAX_TRAINS, trains.length)
    for (let i = 0; i < Math.min(MAX_TRAINS, trains.length); i++) {
      const t = trains[i]
      u.uWaveA.value[i].set(t.dirX, t.dirZ, t.amplitude, t.wavelength)
      u.uWaveB.value[i].set(t.speed, t.steepness)
    }
    u.uCamPos.value.copy(camera.position)
    u.uLightDir.value.set(...lightDir)
    u.uLightColor.value.setRGB(...lightColor)
    u.uSkyColor.value.setRGB(...skyColor)
    u.uFoam.value = foam
  })

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      {/* big, well-subdivided plane — plenty of verts for the Gerstner detail */}
      <planeGeometry args={[600, 600, 320, 320]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={vertex}
        fragmentShader={fragment}
        uniforms={uniforms}
      />
    </mesh>
  )
}
