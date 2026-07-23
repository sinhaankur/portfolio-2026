"use client"

/**
 * DnaMigrationGlobe — a small, self-contained R3F Earth that plots the human-
 * migration story YOUR variants trace: the shared out-of-Africa root, then an
 * arc from where each of your carried variants arose to where it spread.
 *
 * Honest framing (matches the section): this is the STORY the variants trace —
 * heritage — not an ancestry-percentage or a "last known location". DNA is the
 * source of truth; region is the context your variants moved through. Human
 * movement changed diet, and interbreeding mixed the lines — that's the whole
 * point of showing it on a globe.
 *
 * Reuses the site's real NASA Blue Marble texture (public/textures/earth-4k.webp)
 * — texture, not a GLB — so it's light and static-export safe. Lazy-mounted by
 * the Origins section behind a "show the globe" toggle so it never blocks paint.
 */

import { useMemo } from "react"
import { Canvas, useLoader } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import * as THREE from "three"
import type { LatLng } from "./dna-origins"

const R = 1

/** lat/lng (deg) → point on a sphere of radius r. */
function toVec3([lat, lng]: LatLng, r = R): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lng + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  )
}

/** A great-circle-ish arc between two lat/lngs, bowed out above the surface. */
function arcCurve(a: LatLng, b: LatLng): THREE.Vector3[] {
  const start = toVec3(a)
  const end = toVec3(b)
  const mid = start.clone().add(end).multiplyScalar(0.5)
  const lift = 1 + start.distanceTo(end) * 0.35
  mid.normalize().multiplyScalar(R * lift)
  const curve = new THREE.QuadraticBezierCurve3(start, mid, end)
  return curve.getPoints(48)
}

function EarthMesh() {
  const tex = useLoader(THREE.TextureLoader, "/textures/earth-4k.webp")
  return (
    <mesh>
      <sphereGeometry args={[R, 64, 64]} />
      <meshStandardMaterial map={tex} roughness={1} metalness={0} />
    </mesh>
  )
}

/**
 * The shared out-of-Africa journey EVERY human traces — drawn on every globe so
 * it's never just a couple of points. Waypoints follow the accepted broad route
 * (~60,000 years ago onward): E. Africa → Arabia → South Asia → SE Asia →
 * Australia, plus the branch up into Europe and across to the Americas.
 */
const OUT_OF_AFRICA: { at: LatLng; label: string }[] = [
  { at: [2, 37], label: "East Africa · ~200 kya" },
  { at: [15, 43], label: "Arabia · ~60 kya" },
  { at: [27, 66], label: "South Asia · ~50 kya" },
  { at: [15, 100], label: "SE Asia · ~50 kya" },
  { at: [-25, 133], label: "Australia · ~50 kya" },
  { at: [45, 20], label: "Europe · ~45 kya" },
  { at: [62, 105], label: "Siberia · ~30 kya" },
  { at: [64, -153], label: "Beringia → Americas · ~20 kya" },
  { at: [-15, -60], label: "South America · ~14 kya" },
]

/** The connected great-circle route through the waypoints, in order. */
const OOA_ROUTE: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], // south route to Australia
  [1, 5], // branch to Europe
  [2, 6], [6, 7], [7, 8], // north route to the Americas
]

function Marker({ at, color = "#f5b942", size = 0.018 }: { at: LatLng; color?: string; size?: number }) {
  const p = toVec3(at, R * 1.005)
  return (
    <mesh position={p}>
      <sphereGeometry args={[size, 14, 14]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  )
}

function Arc({ from, to, color = "#f5b942", opacity = 0.8 }: { from: LatLng; to: LatLng; color?: string; opacity?: number }) {
  const line = useMemo(() => {
    const geom = new THREE.BufferGeometry().setFromPoints(arcCurve(from, to))
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity, toneMapped: false })
    return new THREE.Line(geom, mat)
  }, [from, to, color, opacity])
  return <primitive object={line} />
}

export function DnaMigrationGlobe({
  root,
  chapters,
  showcase = false,
  className,
}: {
  root: LatLng
  chapters: { origin: LatLng; spreadTo: LatLng }[]
  /** teaser mode: gentle auto-rotate + a "the human story" legend. */
  showcase?: boolean
  /** override the container size/classes (defaults to the full-height panel). */
  className?: string
}) {
  return (
    <div className={className ?? "relative h-[52vh] min-h-[360px] w-full rounded-2xl border border-border bg-[#05070d] overflow-hidden"}>
      <Canvas camera={{ position: [0, 0.6, 3.1], fov: 42 }} dpr={[1, 1.5]}>
        <ambientLight intensity={0.55} />
        <directionalLight position={[3, 2, 4]} intensity={1.1} />

        {/* Earth AND every marker/arc live in ONE group, so the points are
            fixed to the globe — they rotate with it and never drift off. */}
        <group>
          <EarthMesh />

          {/* The shared out-of-Africa journey every human traces — always drawn,
              so the globe shows the full ~60,000-year history, not just a couple
              of points. */}
          {OOA_ROUTE.map(([a, b], i) => (
            <Arc key={`ooa-${i}`} from={OUT_OF_AFRICA[a].at} to={OUT_OF_AFRICA[b].at} color="#4ad6c4" opacity={0.55} />
          ))}
          {OUT_OF_AFRICA.map((w, i) => (
            <Marker key={`ooaw-${i}`} at={w.at} color="#4ad6c4" size={i === 0 ? 0.026 : 0.016} />
          ))}

          {/* Your carried variants layered on top — where each arose + spread. */}
          {chapters.map((c, i) => (
            <group key={i}>
              <Arc from={root} to={c.origin} color="#f5b942" opacity={0.9} />
              <Arc from={c.origin} to={c.spreadTo} color="#f5b942" opacity={0.9} />
              <Marker at={c.origin} color="#f5b942" size={0.022} />
            </group>
          ))}
        </group>

        <OrbitControls
          enablePan={false}
          enableZoom={!showcase}
          minDistance={1.7}
          maxDistance={4.5}
          rotateSpeed={0.5}
          autoRotate={false}
        />
      </Canvas>

      {/* Legend */}
      <div className="pointer-events-none absolute left-3 bottom-3 flex flex-col gap-1 font-mono text-[10px] tracking-wider text-white/80">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "#4ad6c4" }} /> out of Africa · the shared ~60,000-yr journey</span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: "#f5b942" }} />
          {showcase ? "where human variants arose + spread" : "where your variants arose + spread"}
        </span>
      </div>
      <div className="pointer-events-none absolute right-3 top-3 font-mono text-[9px] tracking-wider uppercase text-white/40">
        drag to rotate
      </div>
    </div>
  )
}
