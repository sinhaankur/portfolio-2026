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
 *   - BlackHoleGlbMesh             the Sketchfab GLB, isolated so useGLTF runs lazily
 *   - BlackHoleDetail              the engaged view (shadow + disk + jets + physics HUD)
 *
 * Consumers (scene.tsx) mount <BlackHoleDetail /> under a black-hole sky-point.
 * Radii come from real mass/spin (schwarzschildRadiusMeters / kerrHorizonRadiusMeters);
 * the 8.4 MB GLB downloads only on first engagement, not at mount.
 */

import { Suspense, useRef, useMemo, useEffect, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { Clone, Html, useGLTF } from "@react-three/drei"
import {
  AdditiveBlending,
  DoubleSide,
  Group,
  NormalBlending,
} from "three"

import {
  blackHoleHorizonGravityMetersPerSec2,
  formatLength,
  formatSolarMass,
  kerrHorizonRadiusMeters,
  schwarzschildRadiusMeters,
} from "./astronomy"
import { getBlackHoleAffordance } from "./celestial-sub-engine"
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

/** The Sketchfab "Blackhole" by rubykamen (CC-BY-4.0) — isolated so useGLTF
 *  only runs (and downloads) once a BH is actually engaged. */
function BlackHoleGlbMesh() {
  const { scene: bhScene } = useGLTF("/models/blackhole.glb")
  return <Clone object={bhScene} />
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

  // The 8.4 MB GLB loads on first ENGAGEMENT (hover or focus), not at mount:
  // idle BHs render an honest black shadow sphere + findability halo — which
  // is what they look like from sky-shell distance anyway. Once any BH is
  // engaged, a module flag keeps the mesh path on for all instances (drei's
  // cache already has the bytes, matching the old always-mounted behavior).
  const [meshWanted, setMeshWanted] = useState(() => bhMeshRequested)
  useEffect(() => {
    if (hovered && !meshWanted) {
      bhMeshRequested = true
      useGLTF.preload("/models/blackhole.glb")
      setMeshWanted(true)
    }
  }, [hovered, meshWanted])
  // The model's natural extent runs roughly ±5 units around origin; this
  // factor brings it into scene-scale alongside the physics-driven
  // detailScale. 0.22 ≈ the visible footprint the old procedural disk had —
  // anything smaller turns into a pinprick at sky-shell distance (150 u).
  const meshScale = props.detailScale * 0.22

  useFrame((_, delta) => {
    const k = 1 - Math.exp(-delta * 6)
    if (rootRef.current) {
      const target = hovered ? 1.0 : 0.35
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
          // While the GLB streams in, the Suspense fallback keeps the same
          // shadow sphere on screen — engagement upgrades the look in place,
          // with no flash of nothing.
          <Suspense fallback={<BlackHoleShadowSphere />}>
            <BlackHoleGlbMesh />
          </Suspense>
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
