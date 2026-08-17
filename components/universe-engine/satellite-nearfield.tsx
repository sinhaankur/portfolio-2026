/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine. Others may reference this work.
 * https://github.com/sinhaankur/portfolio-2026
 *
 * satellite-nearfield — the "dots become objects" layer.
 *
 * WHY: the swarm is a points field — fast (one draw call for ~18.7k objects), but
 * every satellite is a flat dot. Reference platforms (LeoLabs) feel authoritative
 * because when you fly IN, the nearest objects resolve into little lit 3D bodies
 * that catch the light — you read them as hardware, not pixels. Rendering 18.7k
 * real meshes is impossible; the trick is LEVEL OF DETAIL: only the handful of
 * objects closest to the camera get promoted to a solid slab, and only when the
 * camera is close enough for it to matter. Far away, this layer is invisible and
 * the cheap dots carry the scene.
 *
 * HOW: one InstancedMesh (a single small box geometry, one draw call) with a fixed
 * capacity (CAP). Every frame we scan the swarm's LIVE positions (the same buffer
 * the worker/fallback fills), keep the CAP closest that are actually on-screen,
 * and write one instance matrix + colour per kept object. Objects the user isn't
 * near simply aren't drawn. The whole layer fades in as the camera approaches, so
 * there's never a pop from "dots" to "objects".
 *
 * This layer is READ-ONLY: it never mutates the swarm buffer or selection. Picking,
 * following, colours-by-type, and culling all stay owned by the points field; this
 * is pure garnish that reads the same data.
 *
 * ── USER JOURNEY ─────────────────────────────────────────────────────────────
 *   1. User is at overview distance. Earth + a haze of dots. This layer is fully
 *      faded out (proximity ~0) → zero visual cost, nothing drawn.
 *   2. User scrolls/pinches IN toward the shell. As the camera nears the swarm,
 *      `proximity` climbs 0→1 and the nearest objects fade in as tiny lit slabs.
 *   3. User keeps flying among the satellites. Each frame we re-pick the closest
 *      objects to wherever the camera now is, so the solid bodies always surround
 *      the user's viewpoint — exactly the LeoLabs "wall of hardware" read.
 *   4. Green slab = active payload, yellow = rocket body, red = debris — the same
 *      honest legend as the dots. The user can still click any of them (the dots
 *      underneath own the click), so nothing about selection changes.
 *   5. User zooms back out → proximity falls → the slabs dissolve back into dots.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useMemo, useRef } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"
import type { SatType } from "./satellite-data"

/** Max objects promoted to solid bodies at once. A few hundred is plenty to fill
 *  the near field; more just costs matrix writes for objects off-screen anyway. */
const CAP = 260

/** Object-type colours — MUST match the points field's TYPE_* legend so a dot and
 *  its promoted slab are the same colour (green payload / yellow R-B / red debris). */
const COL_PAYLOAD = new THREE.Color(0.45, 1.0, 0.55)
const COL_ROCKET = new THREE.Color(1.0, 0.9, 0.35)
const COL_DEBRIS = new THREE.Color(1.0, 0.42, 0.38)
const COL_UNKNOWN = new THREE.Color(0.6, 0.72, 0.9)
function colorFor(type: SatType | undefined, out: THREE.Color): THREE.Color {
  if (type === "PAY") return out.copy(COL_PAYLOAD)
  if (type === "R/B") return out.copy(COL_ROCKET)
  if (type === "DEB") return out.copy(COL_DEBRIS)
  return out.copy(COL_UNKNOWN)
}

// Reused scratch objects — allocating these per frame would churn the GC while
// the user is flying, which is exactly when we need smoothness.
const _pos = new THREE.Vector3()
const _cam = new THREE.Vector3()
const _quat = new THREE.Quaternion()
const _scale = new THREE.Vector3()
const _mat = new THREE.Matrix4()
const _col = new THREE.Color()
// +Z basis — we orient each slab so its long axis points radially outward from
// Earth (setFromUnitVectors maps +Z → the object's radial direction).
const _upZ = new THREE.Vector3(0, 0, 1)

export type NearFieldProps = {
  /** The live swarm geometry — its `position` attribute is updated every frame by
   *  the worker (or inline fallback). We READ it; we never write it. */
  geometry: THREE.BufferGeometry | null
  /** Per-object type, index-aligned with the position buffer (for colour). */
  types: (SatType | undefined)[] | null
  /** Scene units per km — sets a real-ish slab size (a ~10 m satellite in scene). */
  kmToScene: number
  /** Earth's visual radius (scene units) — the distance scale for proximity fade. */
  earthVisualRadius: number
  /** Predicate: is this dot actually visible right now? Mirrors the field's cull so
   *  we never promote a dot the user can't see (would look like a floating ghost). */
  isVisible: (idx: number) => boolean
}

export function SatelliteNearField({
  geometry,
  types,
  kmToScene,
  earthVisualRadius,
  isVisible,
}: NearFieldProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const { camera } = useThree()

  // PERF SPLIT (throttled selection, live positions):
  // Finding the CAP-closest objects means scanning all ~18k positions — too much
  // to do 60×/sec. But the objects the user is near barely change frame-to-frame,
  // so we RE-PICK the set only ~10×/sec and cache the winning indices here. Every
  // frame we still move those cached objects to their live positions, so motion is
  // perfectly smooth while the expensive scan runs a sixth as often.
  const keptIdx = useRef<number[]>([]) // the currently-promoted object indices
  const lastScanMs = useRef(0)
  const SCAN_INTERVAL_MS = 100 // re-pick the near-field set at ~10 Hz

  // A tiny box stands in for a satellite bus. Slight non-cube proportions read as
  // "panel/body" rather than a die. Size ~ a 12 m craft at the scene's km scale,
  // floored so it's never sub-pixel when you're right next to it.
  const boxSize = Math.max(kmToScene * 0.012, earthVisualRadius * 0.0015)

  // A holder for per-instance colour. InstancedMesh needs its instanceColor set up
  // once; we fill it each frame for the kept objects.
  const geo = useMemo(() => new THREE.BoxGeometry(boxSize * 0.5, boxSize * 0.5, boxSize * 1.6), [boxSize])
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        // Emissive so the slabs glow like the dots do, readable against dark space
        // and Earth's night side without needing a key light to catch them.
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 0.35,
        roughness: 0.5,
        metalness: 0.1,
        transparent: true,
        opacity: 0,
      }),
    [],
  )

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh || !geometry || !types) return
    const posAttr = geometry.getAttribute("position") as THREE.BufferAttribute | undefined
    if (!posAttr) { mesh.count = 0; return }
    const arr = posAttr.array as Float32Array
    const n = arr.length / 3

    // PROXIMITY 0→1: how close is the camera to Earth's shell? Far → 0 (nothing
    // drawn, dots carry the scene); near the shell → 1 (full solid bodies). The
    // band is tuned to the point where individual dots start to separate.
    const camDist = _cam.copy(camera.position).length()
    const near = earthVisualRadius * 1.15 // just above the surface (LEO shell)
    const far = earthVisualRadius * 6.0 // overview distance — objects are dots
    const proximity = THREE.MathUtils.clamp((far - camDist) / (far - near), 0, 1)
    material.opacity = proximity * 0.95
    // Fully faded out: skip ALL work (scan and write) — the cheapest common case.
    if (proximity <= 0.001) { mesh.count = 0; return }

    // ── STEP 1 (throttled ~10 Hz): re-pick the CAP closest VISIBLE objects ──
    // This is the expensive part — a linear pass over all ~18k positions. The set
    // of nearby objects changes slowly, so we only redo it every SCAN_INTERVAL_MS
    // and cache the winning indices in keptIdx. One max-heap-free pass: keep the
    // CAP closest, replacing the current farthest once full.
    const now = performance.now()
    if (now - lastScanMs.current >= SCAN_INTERVAL_MS || keptIdx.current.length === 0) {
      lastScanMs.current = now
      const kept: { idx: number; d2: number }[] = []
      let farthestSlot = -1
      let farthestD2 = -1
      for (let i = 0; i < n; i++) {
        const j = i * 3
        const x = arr[j], y = arr[j + 1], z = arr[j + 2]
        // (0,0,0) is the "culled/NaN" sentinel the propagator writes — skip it.
        if (x === 0 && y === 0 && z === 0) continue
        if (!isVisible(i)) continue
        const dx = x - camera.position.x, dy = y - camera.position.y, dz = z - camera.position.z
        const d2 = dx * dx + dy * dy + dz * dz
        if (kept.length < CAP) {
          kept.push({ idx: i, d2 })
          if (d2 > farthestD2) { farthestD2 = d2; farthestSlot = kept.length - 1 }
        } else if (d2 < farthestD2) {
          kept[farthestSlot] = { idx: i, d2 }
          farthestD2 = -1
          for (let k = 0; k < kept.length; k++) if (kept[k].d2 > farthestD2) { farthestD2 = kept[k].d2; farthestSlot = k }
        }
      }
      // Cache just the indices; positions are re-read live below every frame.
      keptIdx.current = kept.map((k) => k.idx)
    }

    // ── STEP 2 (every frame): move the cached objects to their LIVE positions ──
    // Cheap — only CAP (≤260) matrix writes. Because we read the live buffer each
    // frame, the slabs glide with the swarm even though the SET only refreshes at
    // 10 Hz. Orientation: long axis points radially outward from Earth centre — a
    // cheap, honest "roughly how a bus sits" without real attitude data (no TLE).
    const idxs = keptIdx.current
    _scale.set(1, 1, 1)
    for (let k = 0; k < idxs.length; k++) {
      const i = idxs[k]
      const j = i * 3
      _pos.set(arr[j], arr[j + 1], arr[j + 2])
      const radial = _cam.copy(_pos).normalize()
      _quat.setFromUnitVectors(_upZ, radial)
      _mat.compose(_pos, _quat, _scale)
      mesh.setMatrixAt(k, _mat)
      mesh.setColorAt(k, colorFor(types[i], _col))
    }
    mesh.count = idxs.length
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    // Keep it from being frustum-culled as a whole (positions live far apart).
    mesh.frustumCulled = false
  })

  if (!geometry || !types) return null
  return (
    <instancedMesh
      ref={meshRef}
      args={[geo, material, CAP]}
      // Start at 0 — the frame loop sets the real count each frame.
      count={0}
      frustumCulled={false}
      // Below the selection reticle etc.; it's ambient garnish, not chrome.
      renderOrder={1}
    />
  )
}
