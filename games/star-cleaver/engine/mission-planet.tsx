"use client";

/**
 * MissionPlanet — the defended Earth, rendered with a procedural surface shader
 * instead of a flat blue sphere.
 *
 * No texture files: continents/oceans are generated with fractal value noise
 * (FBM), shaded with a day-side sun term and a cool night side, plus drifting
 * cloud bands and a Fresnel atmosphere rim. This turns the old "blue wall" into
 * a readable planet on the horizon while staying fully self-contained (matches
 * the universe-engine's GLSL approach).
 */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const VERT = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vPosW;
  varying vec3 vPosL;
  void main() {
    vPosL = position;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vPosW = wp.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  varying vec3 vPosL;

  uniform float uTime;
  uniform vec3  uSunDir;
  uniform vec3  uOcean;
  uniform vec3  uLand;
  uniform vec3  uAtmo;
  uniform vec3  uCamPos;

  // cheap hash + value noise + fbm (sphere surface, 3D)
  float hash(vec3 p){ p = fract(p*0.3183099 + 0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
  float vnoise(vec3 x){
    vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
    return mix(mix(mix(hash(i+vec3(0,0,0)),hash(i+vec3(1,0,0)),f.x),
                   mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
                   mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
  }
  float fbm(vec3 p){
    float v=0.0, a=0.5;
    for(int i=0;i<5;i++){ v+=a*vnoise(p); p*=2.03; a*=0.5; }
    return v;
  }

  void main(){
    vec3 n = normalize(vNormalW);
    vec3 sp = normalize(vPosL);

    // continents: threshold the fbm field
    float land = fbm(sp*2.4);
    land += 0.18*fbm(sp*6.0);
    float mask = smoothstep(0.52, 0.58, land);

    // surface colour: ocean -> land, with a little green/brown variation
    vec3 landCol = mix(uLand, uLand*vec3(0.7,0.85,0.55), fbm(sp*9.0));
    vec3 surf = mix(uOcean, landCol, mask);

    // ice caps near poles
    float lat = abs(sp.y);
    surf = mix(surf, vec3(0.92,0.95,0.99), smoothstep(0.82,0.93,lat));

    // clouds — drifting fbm band, additive white
    float clouds = smoothstep(0.55,0.75, fbm(sp*3.0 + vec3(uTime*0.012, 0.0, 0.0)));
    surf = mix(surf, vec3(1.0), clouds*0.55);

    // day / night
    float ndl = dot(n, normalize(uSunDir));
    float day = smoothstep(-0.15, 0.35, ndl);
    vec3 lit = surf * (0.08 + 0.95*day);
    // subtle night-side blue
    lit += uOcean*0.04*(1.0-day);

    // fresnel atmosphere rim
    vec3 viewDir = normalize(uCamPos - vPosW);
    float fres = pow(1.0 - max(dot(n, viewDir), 0.0), 2.5);
    lit += uAtmo * fres * (0.35 + 0.65*day);

    gl_FragColor = vec4(lit, 1.0);
  }
`;

export function MissionPlanet({
  radius,
  oceanColor,
  atmoColor,
  landColor = 0x3d7a45,
  sunDir = new THREE.Vector3(0.6, 0.4, 0.7),
}: {
  radius: number;
  oceanColor: number;
  atmoColor: number;
  /** secondary surface tone (Earth: green land; other bodies: their second
   *  hue — rocky highlights, gas-giant bands, ice). Defaults to Earth green. */
  landColor?: number;
  sunDir?: THREE.Vector3;
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(() => {
    const ocean = new THREE.Color(oceanColor);
    const atmo = new THREE.Color(atmoColor);
    return {
      uTime: { value: 0 },
      uSunDir: { value: sunDir.clone().normalize() },
      uOcean: { value: ocean },
      uLand: { value: new THREE.Color(landColor) },
      uAtmo: { value: atmo },
      uCamPos: { value: new THREE.Vector3() },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oceanColor, atmoColor, landColor]);

  useFrame((state) => {
    if (!matRef.current) return;
    matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    matRef.current.uniforms.uCamPos.value.copy(state.camera.position);
  });

  return (
    <group>
      {/* Surface */}
      <mesh>
        <sphereGeometry args={[radius, 64, 64]} />
        <shaderMaterial
          ref={matRef}
          vertexShader={VERT}
          fragmentShader={FRAG}
          uniforms={uniforms}
        />
      </mesh>
      {/* Soft outer atmosphere shell */}
      <mesh>
        <sphereGeometry args={[radius * 1.05, 48, 48]} />
        <meshBasicMaterial
          color={atmoColor}
          transparent
          opacity={0.08}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
