"use client"

/**
 * MarsCoverage — an honest "how much of Mars have we actually seen?" map.
 *
 * A real Mars globe (NASA color + MOLA elevation, actually displaced so Olympus
 * Mons rises and Valles Marineris cuts in) with the real rover/lander sites
 * glowing at their true lat/lon. Click a site → the real surface photograph
 * taken there. A coverage readout tells the truth: rovers have imaged an almost
 * unmeasurably small fraction of the planet at ground resolution.
 *
 * TRUTH STANDARD (the whole point): every pixel is real NASA data. Surface
 * photos are genuine on-Mars panoramas (not artist renders); the coverage
 * numbers are computed from real traverse lengths + Mars's real area. Sites
 * without a confirmed real photo yet still show as hotspots — we don't fake one.
 */

import { Suspense, useMemo, useRef, useState } from "react"
import { Canvas, useFrame, useLoader } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import * as THREE from "three"
import { motion, AnimatePresence } from "framer-motion"
import { X, ArrowLeft } from "lucide-react"

// Real rover/lander sites (subset of Mars surfaceFeatures) with the honest photo
// mapping. Only the three with confirmed genuine surface panoramas carry a
// `photo`; the rest are real sites shown as hotspots without a fabricated image.
type Site = {
  name: string
  lat: number
  lon: number
  status: string
  agency: string
  fact: string
  photo?: string
  photoCredit?: string
}
const SITES: Site[] = [
  { name: "Perseverance", lat: 18.44, lon: 77.45, status: "active", agency: "NASA",
    fact: "Jezero Crater — an ancient river delta. Caching samples for return to Earth; flew Ingenuity, the first powered flight on another world.",
    photo: "/img/mars-surface/perseverance.webp", photoCredit: "NASA/JPL-Caltech/ASU · Mastcam-Z 360° panorama (PIA24264)" },
  { name: "Curiosity", lat: -4.59, lon: 137.44, status: "active", agency: "NASA",
    fact: "Gale Crater — climbing Mount Sharp since 2014, reading layered rock that records Mars's shift from wet to dry.",
    photo: "/img/mars-surface/curiosity.webp", photoCredit: "NASA/JPL-Caltech/MSSS · Mastcam (PIA19803)" },
  { name: "Opportunity", lat: -1.95, lon: 354.47, status: "lost", agency: "NASA",
    fact: "Meridiani Planum — built for 90 days, lasted 14 years and 45 km. \"My battery is low and it's getting dark.\"",
    photo: "/img/mars-surface/opportunity.webp", photoCredit: "NASA/JPL-Caltech/Cornell · Pancam, Perseverance Valley (PIA22074)" },
  { name: "Spirit", lat: -14.57, lon: 175.47, status: "lost", agency: "NASA",
    fact: "Gusev Crater — Opportunity's twin. Drove 7.7 km before bogging down in soft sand in 2009." },
  { name: "InSight", lat: 4.50, lon: 135.62, status: "completed", agency: "NASA",
    fact: "Elysium Planitia — recorded 1,300+ marsquakes, mapping the interior of another planet for the first time." },
  { name: "Zhurong", lat: 25.06, lon: 109.93, status: "lost", agency: "CNSA",
    fact: "Utopia Planitia — China's first Mars rover; explored for 358 sols before hibernation." },
]

// Honest coverage numbers (see the compute in the deep-dive notes).
const MARS_AREA_MKM2 = 144.4                 // million km²
const ROVER_GROUND_PCT = "0.0000016%"        // ground-level hi-res, all rovers combined
const HIRISE_PCT = "~3–4%"                    // orbital HiRISE at ~25 cm/px

// lat/lon (degrees) → position on a unit sphere. lon offset aligns with the
// equirectangular texture's 0° seam.
function latLonToVec3(latDeg: number, lonDeg: number, r = 1): THREE.Vector3 {
  const lat = (latDeg * Math.PI) / 180
  const lon = (lonDeg * Math.PI) / 180
  const x = r * Math.cos(lat) * Math.cos(lon)
  const y = r * Math.sin(lat)
  const z = -r * Math.cos(lat) * Math.sin(lon)
  return new THREE.Vector3(x, y, z)
}

function MarsGlobe({ onPick }: { onPick: (s: Site) => void }) {
  const groupRef = useRef<THREE.Group>(null)
  const [color, mola] = useLoader(THREE.TextureLoader, [
    "/textures/mars-4k.webp",
    "/textures/mars-mola.webp",
  ])
  color.colorSpace = THREE.SRGBColorSpace

  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.03
  })

  return (
    <group ref={groupRef}>
      {/* Displaced globe: MOLA drives real relief (exaggerated ×0.03 so Olympus
          Mons + Valles Marineris read at globe scale without shattering the mesh). */}
      <mesh>
        <sphereGeometry args={[1, 256, 256]} />
        <meshStandardMaterial
          map={color}
          displacementMap={mola}
          displacementScale={0.035}
          metalness={0}
          roughness={1}
        />
      </mesh>
      {/* Rover-site hotspots at real lat/lon. */}
      {SITES.map((s) => {
        const p = latLonToVec3(s.lat, s.lon, 1.05)
        return (
          <mesh
            key={s.name}
            position={p}
            onClick={(e) => { e.stopPropagation(); onPick(s) }}
            onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer" }}
            onPointerOut={() => { document.body.style.cursor = "" }}
          >
            <sphereGeometry args={[0.02, 16, 16]} />
            <meshBasicMaterial color={s.status === "active" ? "#5affc0" : "#ffb14a"} toneMapped={false} />
          </mesh>
        )
      })}
    </group>
  )
}

type Props = { onClose: () => void }

export function MarsCoverage({ onClose }: Props) {
  const [picked, setPicked] = useState<Site | null>(null)

  return (
    <div className="fixed inset-0 z-50 bg-[#08060a]">
      <Canvas camera={{ position: [0, 0, 3.1], fov: 45 }} dpr={[1, 1.5]} gl={{ antialias: true }}>
        <ambientLight intensity={0.9} />
        <directionalLight position={[5, 3, 5]} intensity={1.5} />
        <directionalLight position={[-5, -2, -3]} intensity={0.5} />
        <Suspense fallback={null}>
          <MarsGlobe onPick={setPicked} />
        </Suspense>
        <OrbitControls enablePan={false} minDistance={1.4} maxDistance={6} enableDamping dampingFactor={0.08} rotateSpeed={0.4} />
      </Canvas>

      {/* Exit */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Exit Mars coverage map"
        className="absolute top-4 left-4 md:top-6 md:left-6 z-10 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/50 px-3 py-2 font-mono text-[10px] tracking-widest uppercase text-white/85 backdrop-blur-sm transition-colors hover:text-white hover:border-white/40"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back
      </button>

      {/* The honest coverage readout — the whole point. */}
      <div className="pointer-events-none absolute top-4 right-4 md:top-6 md:right-6 z-10 max-w-[17rem] text-right">
        <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#ff9a6b]">How much of Mars have we seen?</p>
        <p className="mt-2 font-sans text-xs text-white/70 leading-relaxed">
          Surface area <span className="text-white tabular-nums">{MARS_AREA_MKM2}M km²</span>. Rovers
          have imaged <span className="text-[#5affc0] tabular-nums">{ROVER_GROUND_PCT}</span> of it at
          ground resolution — a few thin driving corridors. Even orbital HiRISE covers only{" "}
          <span className="text-[#ffd27a]">{HIRISE_PCT}</span> at ~25 cm/px. The rest is mapped, but
          never truly <em>seen</em>.
        </p>
      </div>

      {/* Picked-site card with the REAL surface photo (or an honest "no ground
          photo yet" note — we never fabricate one). */}
      <AnimatePresence>
        {picked && (
          <motion.aside
            key={picked.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="absolute bottom-4 left-4 right-4 md:left-6 md:right-auto md:w-[30rem] z-20 overflow-hidden rounded-xl border border-white/15 bg-black/70 backdrop-blur-md"
          >
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-white/10">
              <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#ff9a6b]">
                {picked.agency} · {picked.status}
              </p>
              <button type="button" onClick={() => setPicked(null)} aria-label="Close"
                className="grid h-7 w-7 place-items-center rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {picked.photo ? (
              <figure className="m-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={picked.photo} alt={`Real surface panorama from ${picked.name}`} className="w-full aspect-[3/1] object-cover" loading="lazy" />
                <figcaption className="px-4 py-1.5 font-mono text-[9px] tracking-wider text-white/45">
                  {picked.photoCredit}
                </figcaption>
              </figure>
            ) : (
              <div className="px-4 py-4 font-sans text-xs text-white/55 leading-relaxed border-b border-white/5">
                No ground-level panorama wired in for this site yet — it&apos;s a real landing site,
                but we don&apos;t show a photo we can&apos;t verify as taken here.
              </div>
            )}
            <div className="p-4">
              <h3 className="font-display text-2xl font-light tracking-[-0.01em] text-white mb-1.5">{picked.name}</h3>
              <p className="font-sans text-sm text-white/75 leading-relaxed">{picked.fact}</p>
              <p className="mt-2 font-mono text-[10px] tracking-wider text-white/40 tabular-nums">
                {picked.lat.toFixed(2)}°, {picked.lon.toFixed(2)}°
              </p>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Provenance */}
      <div className="pointer-events-none absolute bottom-4 right-4 z-10 hidden md:block max-w-[15rem] text-right">
        <p className="font-mono text-[9px] tracking-widest uppercase text-white/35">
          Globe: NASA MOLA elevation + color · Photos: NASA rover panoramas
        </p>
      </div>
    </div>
  )
}
