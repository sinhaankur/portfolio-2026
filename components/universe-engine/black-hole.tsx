"use client"

/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine — see ./index.tsx for the full notice.
 * https://github.com/sinhaankur/portfolio-2026/blob/main/LICENSE
 *
 * Universe Engine — Black-hole sub-engine.
 *
 * Everything that renders a black hole lives here:
 *   - computeBlackHoleProportions  physics → scene-scale radii (Kerr/Schwarzschild)
 *   - BlackHoleJets                bipolar relativistic outflow along the spin axis
 *   - BlackHoleShadowSphere        honest idle stand-in (event-horizon shadow)
 *   - BlackHoleRaymarch            the engaged view: pure-GLSL null-geodesic
 *                                  lensing (shadow + photon ring + disk arcing
 *                                  over/under + lensed real Milky Way)
 *   - BlackHoleDetail              composes the above + jets + physics HUD
 *
 * Consumers (scene.tsx) mount <BlackHoleDetail /> under a black-hole sky-point.
 * Radii come from real mass/spin (schwarzschildRadiusMeters / kerrHorizonRadiusMeters);
 * the engaged lensing is pure GLSL (no download) — it mounts on first engagement.
 */

import { useRef, useMemo, useEffect, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { Html } from "@react-three/drei"
import {
  AdditiveBlending,
  DoubleSide,
  Group,
  Mesh,
  NormalBlending,
  ShaderMaterial,
  Vector3,
  type Texture,
} from "three"

import {
  blackHoleHorizonGravityMetersPerSec2,
  formatLength,
  formatSolarMass,
  kerrHorizonRadiusMeters,
  schwarzschildRadiusMeters,
  viewBandRef,
  SUN_OFFSET_SCENE,
} from "./astronomy"
import { bandBrightness } from "@/lib/observe"
import { perfTierRef, superClearRef } from "@/lib/device-tier"
import { getBlackHoleAffordance } from "./celestial-sub-engine"
import { galacticBasis, loadAllSkyTexture } from "./sky-panorama"
import type { SkyPoint } from "./types"

/**
 * Physics-driven proportions for the black hole detail.
 *
 *   horizon       — Kerr event-horizon (Schwarzschild collapses to this when spin=0)
 *   photon ring   — 1.5 × rs (photon sphere for a non-rotating BH)
 *   ISCO disk     — 6 × rs for Schwarzschild prograde; collapses to ~rs for max Kerr
 *   outer disk    — ~15 × rs (typical observed extent)
 *
 * Real Schwarzschild radii vary from ~62 km (Cygnus X-1) to ~1300 AU
 * (TON 618) — a 10⁹ ratio. We use a log-scale to map that to a visible
 * scene-unit range so all three black holes read as distinct sizes
 * without the stellar-mass one becoming a single pixel.
 */
export function computeBlackHoleProportions(massSolar: number, spin: number, baseScale: number) {
  const rsMeters = schwarzschildRadiusMeters(massSolar)
  const rPlusMeters = kerrHorizonRadiusMeters(massSolar, spin)
  const photonMeters = rsMeters * 1.5
  // ISCO (innermost stable circular orbit) — Schwarzschild = 6 rs;
  // maximal Kerr prograde collapses to ~1 rs. Smooth interp by spin.
  const iscoFactor = 6 - 5 * Math.min(spin, 1)
  const iscoMeters = rsMeters * iscoFactor
  const outerMeters = rsMeters * 15
  // Log-scale visualisation: maps Cygnus X-1's ~60 km up to TON 618's
  // ~10¹¹ km onto a roughly 1× → 1.4× scene-scale ratio. Math.log10(rs)
  // would give ~5 → ~14 (range ~9); we normalise to a tighter band.
  const logRs = Math.log10(rsMeters)
  // Stellar mass ~ 5, supermassive ~ 13. Map [5, 13] → [0.75, 1.45].
  const visualMultiplier = 0.75 + Math.max(0, Math.min(1, (logRs - 5) / 8)) * 0.7
  const detailScale = baseScale * 4.0 * visualMultiplier

  // Scene-unit radii — Gargantua-style proportions.
  //
  // Two distinct things here: the *horizon* (actual event horizon — the
  // boundary of no return) and the *shadow* (what you SEE — a darker,
  // larger region because photons in the photon sphere's catchment area
  // are all bent into the horizon). For Schwarzschild the shadow is
  // 3√3/2 ≈ 2.598 × the horizon radius; for max-spin Kerr it shrinks
  // slightly and becomes asymmetric. We interpolate linearly with spin.
  //
  // Everything visible (the black silhouette, the photon ring, the
  // lensed halo, the disk) is scaled off `shadowR`, not `horizonR` —
  // that's what makes the proportions read as Interstellar's Gargantua.
  const horizonR = detailScale * 0.22 * (rPlusMeters / rsMeters)
  const shadowFactor = 2.598 - 0.55 * Math.min(spin, 1)
  const shadowR = horizonR * shadowFactor
  return {
    rsMeters,
    rPlusMeters,
    photonMeters,
    iscoMeters,
    outerMeters,
    iscoFactor,
    horizonR,
    shadowR,
    // Photon ring — thin Einstein-ring sliver sitting right at the edge
    // of the shadow. In Interstellar this is the brightest thing on
    // screen and the single most recognisable element.
    photonInner: shadowR * 0.97,
    photonOuter: shadowR * 1.03,
    // Lensed halo — the secondary image of the disk's far side, bent
    // gravitationally over the top and under the bottom of the shadow.
    // This is the iconic "ring above + below the BH" that makes the
    // Interstellar still look the way it does.
    haloInner:   shadowR * 1.03,
    haloOuter:   shadowR * 1.35,
    // Primary accretion disk — four concentric belts from white-hot
    // inner edge to warm-golden outer. Extent kept compact (~6 ×
    // shadow) so the disk reads as a defined ring around the BH
    // instead of sprawling into the rest of the scene.
    diskInner1:  shadowR * 1.18,
    diskOuter1:  shadowR * 2.00,
    diskInner2:  shadowR * 2.00,
    diskOuter2:  shadowR * 3.20,
    diskInner3:  shadowR * 3.20,
    diskOuter3:  shadowR * 4.50,
    diskInner4:  shadowR * 4.50,
    diskOuter4:  shadowR * 6.20,
    detailScale,
  }
}

/**
 * Bipolar relativistic jet — two emissive cones extending from the horizon
 * along the BH's spin axis. Real black holes (M87*, Sgr A*, Cygnus X-1)
 * eject these as the byproduct of accretion + frame-dragging; visually
 * they sit perpendicular to the disk.
 *
 * The jet axis defaults to local "y" because that's where the Sketchfab
 * model's disk normal lands; if a future model imports the disk in a
 * different orientation, flip `jet.axis` on the SkyPoint to "x" or "z".
 *
 * Both jets share geometry but the far-side opacity is dimmed to suggest
 * Doppler beaming — the approaching side appears brighter in real radio
 * observations.
 */
function BlackHoleJets({
  jet,
  detailScale,
  invert,
}: {
  jet: NonNullable<SkyPoint["jet"]>
  detailScale: number
  invert: boolean
}) {
  const axis = jet.axis ?? "y"
  const lengthFactor = jet.lengthFactor ?? 12
  const brightness = jet.brightness ?? 0.55
  const asymmetry = Math.max(0, Math.min(1, jet.asymmetry ?? 0.6))
  const color = jet.color ?? "#bcd9ff"

  // Geometry sized in rootRef-local frame, which the hover scale lerp will
  // grow from 0.001 → 1.0. detailScale here is the BH's per-instance size
  // factor, so jets scale with the BH naturally.
  const length = detailScale * lengthFactor * 0.06
  const radiusBase = detailScale * 0.012
  const radiusTip = detailScale * 0.038

  // Rotate the whole jet pair so the cylinders' local +y axis lines up with
  // the chosen world axis. Cylinder geometry defaults to extending along y.
  const rotation: [number, number, number] =
    axis === "x" ? [0, 0, -Math.PI / 2] :
    axis === "z" ? [Math.PI / 2, 0, 0] :
    [0, 0, 0]

  const farOpacity = brightness * (1 - asymmetry)
  // Light-mode pass: jets fight a bright background, so dial them back and
  // switch to normal blending — additive on cream looks washed out.
  const blendMode = invert ? NormalBlending : AdditiveBlending
  const nearAlpha = invert ? brightness * 0.55 : brightness
  const farAlpha = invert ? farOpacity * 0.55 : farOpacity

  return (
    <group rotation={rotation}>
      {/* Bright (near) jet — radius narrows at base, widens slightly at tip
          to read as a collimated outflow that broadens with distance. */}
      <mesh position={[0, length / 2, 0]}>
        <cylinderGeometry args={[radiusTip, radiusBase, length, 18, 1, true]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={nearAlpha}
          blending={blendMode}
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>
      {/* Far (dim) jet — mirrored across the BH centre. Lower opacity sells
          the Doppler asymmetry without needing per-pixel beaming math. */}
      <mesh position={[0, -length / 2, 0]} rotation={[Math.PI, 0, 0]}>
        <cylinderGeometry args={[radiusTip, radiusBase, length, 18, 1, true]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={farAlpha}
          blending={blendMode}
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>
    </group>
  )
}

// Module flag: flips true the first time ANY black hole is engaged, so every
// other instance switches to the (now-cached) GLB path too.
let bhMeshRequested = false

/** Idle stand-in for the BH model: the event-horizon shadow as a plain black
 *  sphere, sized to the GLB's dark core within the same spin/scale group. */
function BlackHoleShadowSphere() {
  return (
    <mesh>
      <sphereGeometry args={[1.3, 24, 24]} />
      <meshBasicMaterial color="#000000" />
    </mesh>
  )
}

/* ============================================================
 * BlackHoleRaymarch — the physics does the drawing (pure GLSL).
 *
 * Per pixel, a photon is traced BACKWARDS through curved spacetime via
 * null-geodesic integration (kick-drift-kick leapfrog, accel = -1.5 h² pos/r⁵),
 * so the shadow, the bright photon ring, the accretion disk's far side arcing
 * OVER and UNDER the hole, and the Einstein-lensed real Milky Way behind it all
 * EMERGE from the geometry — nothing is painted on a mesh. Scaled by each
 * object's published mass + spin. This replaces the 13 MB Sketchfab GLB:
 * BHs rejoin the engine's pure-GLSL field.
 *
 * The look is the cinematic Gargantua (Interstellar): warm golden disk with the
 * Doppler asymmetry dialed down (Nolan's choice), a razor photon ring, and a
 * subtle IMAX anamorphic flare. Ring-moire is killed by a per-pixel march
 * dither + transmission compositing (near disk image attenuates the ones behind),
 * the proven method from real-time geodesic renderers.
 * ============================================================ */
// Quad half-extent in rs units. The disk reaches ~16 rs, but the billboard is
// camera-facing — at grazing/oblique orbit angles the disk projects WIDER than its
// own radius, so an 18-rs quad clipped it (the "flat / cut-off" look from some
// angles). 30 gives comfortable margin so the full lensed disk + its over/under
// halo stay on the quad from EVERY angle. (Pixels outside the shadow+disk escape
// the march cheaply, so the extra margin costs almost nothing.)
const BH_QUAD_RS = 30

const BH_VERT = /* glsl */ `
  varying vec3 vWorldPos;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const BH_FRAG = /* glsl */ `
  precision highp float;
  varying vec3 vWorldPos;
  varying vec2 vUv;
  uniform sampler2D uSky;
  uniform vec3 uGalX; uniform vec3 uGalY; uniform vec3 uGalZ;
  uniform vec3 uCenter;    // BH centre, world units
  uniform float uUnit;     // world length of 1 rs (tracks the scale lerp)
  uniform float uIscoRs;   // ISCO in rs units (6 → 1 with spin)
  uniform float uDiskOuterRs;
  uniform float uSpin;
  uniform float uTime;
  uniform float uHasSky;
  uniform float uSkyLevel; // matches SkyPanorama's vantage fade
  uniform float uMaxSteps; // perf gate — the loop runs to STEPS but BREAKS here

  // The loop bound must be a compile-time constant in GLSL, so we loop to a high
  // ceiling but break early at uMaxSteps — the device tier dials it down so a
  // weak GPU doesn't choke on the full geodesic march (ultra 240 → low ~90).
  const int STEPS = 320;
  const float ESCAPE_R = 44.0;

  float hash(vec2 p){ p=fract(p*vec2(123.34,345.45)); p+=dot(p,p+34.345); return fract(p.x*p.y); }
  float vnoise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }
  float fbm(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<4;i++){ s+=a*vnoise(p); p*=2.03; a*=0.5; } return s; }

  vec3 skySample(vec3 d){
    float gx=dot(d,uGalX), gy=dot(d,uGalY), gz=dot(d,uGalZ);
    float lon=atan(gy,gx), lat=asin(clamp(gz,-1.0,1.0));
    vec2 uv=vec2(0.5 - lon/6.28318530718, 0.5 + lat/3.14159265359);
    return texture2D(uSky, uv).rgb;
  }

  vec3 diskEmission(vec2 xz, out float a){
    float r=length(xz);
    float fadeIn=smoothstep(uIscoRs,uIscoRs*1.3,r);
    float fadeOut=1.0-smoothstep(uDiskOuterRs*0.65,uDiskOuterRs,r);
    float ang=atan(xz.y,xz.x);
    float swirl=ang - 4.0/pow(r,1.2) - uTime*0.4;
    float flow=fbm(vec2(swirl*1.3,r*0.5))*0.6 + 0.4*fbm(vec2(swirl*2.6,r*1.1));
    float bright=0.8+0.6*flow;
    float t=clamp(1.0-(r-uIscoRs)/(uDiskOuterRs-uIscoRs),0.0,1.0);
    // warm GOLD Gargantua tone (hot cream inner → amber-gold outer)
    vec3 hot=vec3(1.0,0.96,0.86), gold=vec3(1.0,0.78,0.45), amber=vec3(1.0,0.62,0.28);
    vec3 col = t>0.55 ? mix(gold,hot,(t-0.55)/0.45) : mix(amber,gold,t/0.55);
    col *= 1.0 + 1.3*smoothstep(uIscoRs*1.7,uIscoRs,r);
    a=clamp(fadeIn*fadeOut*bright,0.0,1.0);
    return col*bright;
  }

  void main(){
    // Ray in rs units, in the BH's world-aligned rest frame (disk = y plane).
    vec3 ro=(cameraPosition - uCenter)/uUnit;
    vec3 rd=normalize(vWorldPos - cameraPosition);
    float b=dot(ro,rd), c=dot(ro,ro)-ESCAPE_R*ESCAPE_R;
    if(c>0.0){ float disc=b*b-c; if(disc<0.0) discard; ro+=rd*max(0.0,-b-sqrt(disc)); }
    // per-pixel dither breaks the discrete-step moire (grey concentric rings)
    float jit=hash(gl_FragCoord.xy+fract(uTime));
    ro += rd*(jit-0.5)*clamp(length(ro)*0.14,0.04,2.8);

    vec3 pos=ro, vel=rd; vec3 hv=cross(pos,vel); float h2=dot(hv,hv);
    vec3 emis=vec3(0.0); float trans=1.0; bool captured=false; float prevY=pos.y; float rMin=1e9;
    for(int i=0;i<STEPS;i++){
      if(float(i)>=uMaxSteps) break;   // perf gate (tier-driven)
      float r=length(pos); rMin=min(rMin,r);
      if(r<1.0){ captured=true; break; }
      if(r>ESCAPE_R+1.0 && dot(pos,vel)>0.0) break;
      if(trans<0.02) break;
      // FINER near the hole + per-STEP jitter — the grey concentric-ring moiré came
      // from a coarse step quantising each ray's closest approach (rMin) into shells.
      // A tighter floor (0.03→0.012) resolves the photon ring smoothly, and jittering
      // the step length itself (not just the ray origin) dissolves any residual banding.
      float dt=clamp(r*0.09,0.012,2.5) * (0.85 + 0.3*hash(gl_FragCoord.xy + float(i) + fract(uTime)));
      vec3 a0=-1.5*h2*pos/pow(r,5.0) + uSpin*0.9/max(r*r,1.0)*vec3(-pos.z,0.0,pos.x)/max(length(pos.xz),1e-3);
      vec3 vh=vel+a0*dt*0.5; vec3 np=pos+vh*dt; float nr=length(np);
      vec3 a1=-1.5*h2*np/pow(nr,5.0); vec3 nv=vh+a1*dt*0.5;
      if(np.y*prevY<0.0){
        float f=prevY/max(1e-6,prevY-np.y);
        vec3 hit=mix(pos,np,f); float hr=length(hit.xz);
        if(hr>uIscoRs && hr<uDiskOuterRs){
          float da; vec3 dc=diskEmission(hit.xz,da);
          float mid=mix(uIscoRs,uDiskOuterRs,0.5);
          float rad=0.9*exp(-pow((hr-mid)/(0.42*(uDiskOuterRs-uIscoRs)),2.0));
          float op=clamp(da*rad,0.0,1.0);
          emis += dc*op*trans; trans *= (1.0-op);
        }
      }
      pos=np; vel=nv; prevY=np.y;
    }
    // Photon ring — a thin bright Einstein ring at the photon sphere (rMin≈1.5 rs).
    // Softened the core width (0.11→0.18) so any residual march banding can't read as
    // hard concentric rings, and kept the broad warm halo. Only the TIGHT ring near
    // the sphere glows — far-out rMin values (the old grey bullseye) contribute ~0.
    float dr=clamp(rMin-1.5,-8.0,8.0);
    float ring=exp(-(dr/0.18)*(dr/0.18)) + 0.35*exp(-(dr/0.5)*(dr/0.5));
    // TRUE-BLACK SHADOW: a captured ray fell past the horizon — nothing escapes, so
    // it must be pure black. The broad ring halo was leaking ~0.13 grey INTO the
    // shadow (rMin<1.5 → the wide gaussian still had value), which is why the hole
    // read grey, not black. Kill the ring (and any emission) for captured rays.
    vec3 ringCol = captured ? vec3(0.0) : vec3(1.0,0.96,0.88)*ring*3.0;
    vec3 bg = captured ? vec3(0.0) : (uHasSky>0.5 ? skySample(normalize(vel))*uSkyLevel : vec3(0.0))*trans;
    vec3 col = captured ? vec3(0.0) : (emis + bg + ringCol);
    // cinematic grade: crush blacks, bloom, warm halo.
    col = max(col-0.035,0.0)/(1.0-0.035);
    float lum=max(col.r,max(col.g,col.b));
    col += col*smoothstep(0.55,1.9,lum)*0.95;
    col += vec3(1.0,0.82,0.55)*smoothstep(1.2,3.0,lum)*0.25;
    // SEAM REMOVED 2026-11-07: the "disk glint" (exp(-(vel.y)²)) lit up the whole
    // plane of rays that ended parallel to the disk — which projected as a bright
    // VERTICAL LINE straight through the shadow (the seam). It added nothing the
    // bloom + photon ring don't already give, so it's gone. No fixed screen-space
    // band = no seam, from any angle.
    col = col/(1.0+0.08*lum);
    col = pow(col,vec3(0.82));
    // ALL-ANGLES FIX: fade only the EXTREME quad corners (no hard circular crop,
    // which cropped the disk flat at oblique views). The disk/shadow already fade
    // by physics; this just hides the literal quad edge very gently so it never
    // reads as a square — without clipping the lensed disk that extends past centre.
    float rim=length(vUv-0.5)*2.0;
    float alpha=1.0 - smoothstep(0.94,1.0,rim);
    gl_FragColor=vec4(col,alpha);
  }
`

const _bhWorldScale = new Vector3()
const _bhShellCenter = new Vector3(SUN_OFFSET_SCENE, 0, 0)

function BlackHoleRaymarch({
  rsScene,
  iscoFactor,
  spin,
}: {
  /** World-scene length of one Schwarzschild radius at root scale 1. */
  rsScene: number
  /** ISCO in rs units (6 for Schwarzschild → ~1 for max prograde Kerr). */
  iscoFactor: number
  /** Dimensionless spin 0..1. */
  spin: number
}) {
  const meshRef = useRef<Mesh>(null)
  const matRef = useRef<ShaderMaterial>(null)
  const [sky, setSky] = useState<Texture | null>(null)

  useEffect(() => {
    let alive = true
    loadAllSkyTexture(true).then((t) => { if (alive) setSky(t) })
    return () => { alive = false }
  }, [])

  const uniforms = useMemo(() => {
    const basis = galacticBasis()
    return {
      uSky: { value: null as Texture | null },
      uGalX: { value: basis.x }, uGalY: { value: basis.y }, uGalZ: { value: basis.z },
      uCenter: { value: new Vector3() },
      uUnit: { value: rsScene },
      uIscoRs: { value: iscoFactor },
      uDiskOuterRs: { value: 16.0 },
      uSpin: { value: spin },
      uTime: { value: 0 },
      uHasSky: { value: 0 },
      uSkyLevel: { value: 1 },
      uMaxSteps: { value: 240 },
    }
  }, [rsScene, iscoFactor, spin])

  useEffect(() => {
    if (sky) { uniforms.uSky.value = sky; uniforms.uHasSky.value = 1 }
  }, [sky, uniforms])

  useFrame(({ camera, clock }) => {
    const mesh = meshRef.current
    if (!mesh) return
    // Billboard the quad; the geodesic march runs in the WORLD-aligned BH rest
    // frame (uCenter/uUnit) so the disk plane stays put while the quad tracks
    // the camera.
    mesh.quaternion.copy(camera.quaternion)
    mesh.getWorldPosition(uniforms.uCenter.value)
    mesh.getWorldScale(_bhWorldScale)
    uniforms.uUnit.value = rsScene * _bhWorldScale.x
    uniforms.uTime.value = clock.elapsedTime
    // Perf gate: scale the geodesic march depth to the live tier so the heaviest
    // shader in the engine never chokes a weak GPU. Ultra gets the full march;
    // low drops to coarser lensing (still reads correctly). SUPER CLEAR (16K /
    // max-detail) pins the full march. Ceilings raised with the finer near-hole
    // step (dt floor 0.03→0.012) so rays still reach the hole without starving.
    const t = perfTierRef.current
    uniforms.uMaxSteps.value = superClearRef.current ? 320
      : t === "ultra" ? 320 : t === "high" ? 240 : t === "mid" ? 170 : 110
    // Same vantage fade as SkyPanorama (130→300 from the shell centre).
    const dist = camera.position.distanceTo(_bhShellCenter)
    uniforms.uSkyLevel.value = 1 - Math.min(1, Math.max(0, (dist - 130) / 170))
    if (typeof window !== "undefined") {
      ;(window as unknown as { __ueBH?: object }).__ueBH = {
        unit: uniforms.uUnit.value, rsScene, worldScale: _bhWorldScale.x,
        camToCenter: camera.position.distanceTo(uniforms.uCenter.value),
        skyLevel: uniforms.uSkyLevel.value,
      }
    }
  })

  const half = rsScene * BH_QUAD_RS
  return (
    <mesh ref={meshRef} renderOrder={-5} frustumCulled={false}>
      <planeGeometry args={[half * 2, half * 2]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={BH_VERT}
        fragmentShader={BH_FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={NormalBlending}
      />
    </mesh>
  )
}

/**
 * BlackHoleDetail
 *
 * Strict Gargantua / Interstellar recreation, used for every black hole
 * in the scene (Sgr A*, M87*, Cygnus X-1, TON 618, V404 Cygni, …). The
 * structure is:
 *   - opaque shadow sphere at the centre, sized to the apparent shadow
 *     (~2.6 × event-horizon radius for Schwarzschild),
 *   - a bright thin photon ring tight against the shadow's edge —
 *     visually the brightest element, the Einstein-ring sliver,
 *   - an edge-on accretion disk that wraps around the sphere as four
 *     concentric belts from white-hot inner edge to warm-golden outer,
 *   - two arcs over the top and under the bottom — the disk's far side
 *     gravitationally lensed up and over the BH, which is what gives
 *     Gargantua its iconic "halo" silhouette.
 *
 * Real lensing is a ray-trace problem; we fake it by rendering the
 * lensed top/bottom as half-rings rotated 180° apart. Per Nolan's
 * directive (Kip Thorne, 2015), Doppler beaming is suppressed for
 * cinematic legibility — both halo arcs render at identical brightness.
 *
 * All other bodies (planets, Sun, moons, comets, asteroids, nebulae,
 * galaxies) follow NASA / catalog astronomical data, not Nolan's
 * stylisation. The Gargantua look is intentionally scoped to BHs.
 */
export function BlackHoleDetail({
  size,
  hovered,
  invert,
  massSolar,
  spin,
  name,
  jet,
}: {
  size: number
  hovered: boolean
  invert: boolean
  /** Mass in solar masses — drives Schwarzschild radius. */
  massSolar?: number
  /** Kerr spin parameter (0–1). Defaults to 0 (Schwarzschild). */
  spin?: number
  /** Display name for the data readout. */
  name?: string
  /** Optional bipolar relativistic jet config — see SkyPoint["jet"]. */
  jet?: SkyPoint["jet"]
}) {
  const rootRef = useRef<Group>(null)
  const spinRef = useRef<Group>(null)

  // Default to a generic supermassive value if mass wasn't declared on
  // the sky-point — keeps the renderer working even if someone adds a
  // BH without populating the physics data.
  const M = massSolar ?? 1e8
  const a = spin ?? 0
  const horizonGravity = useMemo(
    () => blackHoleHorizonGravityMetersPerSec2(M, a),
    [M, a],
  )

  const props = useMemo(
    () => computeBlackHoleProportions(M, a, size),
    [M, a, size],
  )
  const bhAffordance = useMemo(
    () => getBlackHoleAffordance({ invert, name, massSolar: M }),
    [invert, name, M],
  )

  // Stellar-mass black holes (X-ray binaries) have brighter, hotter disks
  // relative to their horizon than supermassive ones. Drives the visual
  // spin speed below — small systems spin visibly faster.
  const isStellarMass = M < 1000

  // The geodesic raymarcher mounts on first ENGAGEMENT (hover or focus), not at
  // mount: idle BHs render an honest black shadow sphere + findability halo —
  // which is what they look like from sky-shell distance anyway. Once any BH is
  // engaged, a module flag keeps the raymarch path on for all instances. (No
  // download — it's pure GLSL; the only async bit is the shared ESO sky texture,
  // which is already loaded by the SkyPanorama.)
  const [meshWanted, setMeshWanted] = useState(() => bhMeshRequested)
  useEffect(() => {
    if (hovered && !meshWanted) {
      bhMeshRequested = true
      setMeshWanted(true)
    }
  }, [hovered, meshWanted])
  // Brings the raymarch quad into scene-scale alongside the physics-driven
  // detailScale. 0.22 ≈ the visible footprint the old procedural disk had —
  // anything smaller turns into a pinprick at sky-shell distance (150 u).
  const meshScale = props.detailScale * 0.22

  useFrame((_, delta) => {
    const k = 1 - Math.exp(-delta * 6)
    if (rootRef.current) {
      // Wavelength view: a black hole emits ONLY in X-ray + radio (the
      // superheated infalling gas + polar jets); in visible/IR/UV/gamma there's
      // effectively nothing to see. So scale the whole BH toward its shadow in
      // those bands — the accretion disk blazes in X-ray, near-vanishes in
      // visible — teaching exactly how we actually detect black holes.
      const band = viewBandRef.current
      const bandMul = band ? bandBrightness(band, "black hole") : 1
      const target = (hovered ? 1.0 : 0.35) * (0.2 + 0.8 * bandMul)
      const s = rootRef.current.scale.x
      const next = s + (target - s) * k
      rootRef.current.scale.set(next, next, next)
    }
    // Stellar-mass BHs spin faster (smaller systems, higher angular
    // frequency at ISCO). Disk visual rotation reflects that.
    const baseSpin = isStellarMass ? 0.14 : 0.06
    if (spinRef.current) {
      spinRef.current.rotation.y += delta * (hovered ? baseSpin : baseSpin * 0.4)
    }
  })

  return (
    <group ref={rootRef} scale={0.001}>
      {/* Sketchfab "Blackhole" by rubykamen (CC-BY-4.0) — replaces the
          procedural Gargantua build. The spinning wrapper rotates the
          full model (event horizon + accretion disk + lensed skins) as
          a unit; per-BH scale stays driven by computeBlackHoleProportions
          so Cygnus X-1 and TON 618 still read as distinct sizes. */}
      {/* Findability halo — soft glow so the BH spots from sky-shell distance.
          Only visible when NOT hovered: it's a spotting aid for users
          scanning the sky, not an embellishment to show on top of the
          model. The moment a user engages (hover/focus), the halo
          disappears so the BH silhouette + disk + jets read clean. */}
      {!hovered && (
        <mesh>
          <sphereGeometry args={[props.detailScale * 0.5, 24, 24]} />
          <meshBasicMaterial
            color={bhAffordance.haloColor}
            transparent
            opacity={bhAffordance.haloOpacity}
            blending={invert ? NormalBlending : AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      )}

      <group ref={spinRef} scale={meshScale}>
        {meshWanted ? (
          // ENGAGED: the pure-GLSL geodesic raymarcher — real lensing, photon
          // ring, disk arcing over/under, and the lensed real Milky Way, all
          // emerging from the physics. rsScene is the LOCAL length of one rs
          // (horizon in local units, ≈ rs for Schwarzschild); useFrame reads
          // the live world scale so uUnit tracks the engage/band scale lerp.
          <BlackHoleRaymarch
            rsScene={props.horizonR / Math.max(meshScale, 1e-6)}
            iscoFactor={props.iscoFactor}
            spin={a}
          />
        ) : (
          <BlackHoleShadowSphere />
        )}
      </group>

      {/* Bipolar relativistic jets — perpendicular to the accretion disk
          along the spin axis. M87, Sgr A*, and Cygnus X-1 all have
          observed jets in reality; this renders them additively over the
          model so the GLB's existing lensed look stays untouched. */}
      {jet && <BlackHoleJets jet={jet} detailScale={props.detailScale} invert={invert} />}

      {/* Physics data overlay — fades in on hover. Mass, Schwarzschild
          radius, photon-sphere radius, ISCO factor. Anchored to the side
          of the BH so it doesn't sit on top of the shadow. */}
      {hovered && (
        <Html
          position={[props.detailScale * 1.5, 0, 0]}
          distanceFactor={6}
          zIndexRange={[10, 0]}
          style={{ pointerEvents: "none" }}
        >
          <div
            className={`
              select-none pointer-events-none whitespace-nowrap
              font-mono text-[10px] tracking-[0.12em] uppercase
              px-3 py-2 rounded-md backdrop-blur-sm
              ${
                invert
                  ? "bg-white/85 border border-foreground/25 text-foreground"
                  : "bg-black/65 border border-white/20 text-white"
              }
            `}
            style={{ animation: "ue-label-in 240ms ease-out both", minWidth: "11rem" }}
          >
            {name && (
              <div className="text-[11px] tracking-[0.22em] mb-1.5 opacity-80">
                {name}
              </div>
            )}
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[9px] normal-case tracking-normal font-sans">
              <span className="opacity-55">Mass</span>
              <span className="text-right tabular-nums">{formatSolarMass(M)}</span>
              <span className="opacity-55">Horizon g</span>
              <span className="text-right tabular-nums">{horizonGravity.toExponential(2)} m/s²</span>
              <span className="opacity-55">rₛ</span>
              <span className="text-right tabular-nums">{formatLength(props.rsMeters)}</span>
              <span className="opacity-55">photon sphere</span>
              <span className="text-right tabular-nums">{formatLength(props.photonMeters)}</span>
              <span className="opacity-55">ISCO</span>
              <span className="text-right tabular-nums">{props.iscoFactor.toFixed(1)} rₛ</span>
              {a > 0 && (
                <>
                  <span className="opacity-55">spin a</span>
                  <span className="text-right tabular-nums">{a.toFixed(2)}</span>
                </>
              )}
            </div>
            <div className="mt-1.5 pt-1.5 border-t border-current/15 text-[8px] tracking-[0.18em] opacity-45">
              Model · rubykamen · CC-BY-4.0
            </div>
          </div>
        </Html>
      )}
    </group>
  )
}
