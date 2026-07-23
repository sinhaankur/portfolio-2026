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

import { useMemo, useRef } from "react"
import { Canvas, useFrame, useLoader } from "@react-three/fiber"
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
  const ref = useRef<THREE.Mesh>(null)
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.05
  })
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[R, 64, 64]} />
      <meshStandardMaterial map={tex} roughness={1} metalness={0} />
    </mesh>
  )
}

function Marker({ at, color = "#f5b942" }: { at: LatLng; color?: string }) {
  const p = toVec3(at, R * 1.005)
  return (
    <mesh position={p}>
      <sphereGeometry args={[0.018, 12, 12]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  )
}

function Arc({ from, to, color = "#f5b942" }: { from: LatLng; to: LatLng; color?: string }) {
  const geom = useMemo(() => {
    const pts = arcCurve(from, to)
    return new THREE.BufferGeometry().setFromPoints(pts)
  }, [from, to])
  return (
    <primitive object={new THREE.Line(geom, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8, toneMapped: false }))} />
  )
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
        <EarthMesh />

        {/* Shared root — East Africa, drawn for everyone. */}
        <Marker at={root} color="#4ad6c4" />

        {/* Each variant: arc from root → origin (the journey there), then
            origin → spread. Origin dot amber. */}
        {chapters.map((c, i) => (
          <group key={i}>
            <Arc from={root} to={c.origin} color="#4ad6c4" />
            <Arc from={c.origin} to={c.spreadTo} color="#f5b942" />
            <Marker at={c.origin} color="#f5b942" />
          </group>
        ))}

        <OrbitControls
          enablePan={false}
          enableZoom={!showcase}
          minDistance={1.7}
          maxDistance={4.5}
          rotateSpeed={0.5}
          autoRotate={showcase}
          autoRotateSpeed={0.4}
        />
      </Canvas>

      {/* Legend */}
      <div className="pointer-events-none absolute left-3 bottom-3 flex flex-col gap-1 font-mono text-[10px] tracking-wider text-white/80">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "#4ad6c4" }} /> shared root · out of Africa</span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: "#f5b942" }} />
          {showcase ? "where human variants arose + spread" : "where your variants arose + spread"}
        </span>
      </div>
    </div>
  )
}
