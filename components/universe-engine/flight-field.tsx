"use client"

/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine. Others may reference this work.
 * https://github.com/sinhaankur/portfolio-2026
 *
 * FlightField — real aircraft over the Earth, the "planes" layer of the
 * zoom-into-Earth descent (satellites → planes → cities).
 *
 * Positions come from public/data/flights.json — a BUILD-TIME snapshot of the
 * OpenSky Network's live ADS-B feed (baked server-side because OpenSky's CORS
 * blocks a browser fetch on a static site). Each plane is placed at its real
 * lat / lon / barometric altitude, in the Earth-FIXED frame (rotated by GMST like
 * the ground track) so it sits over the real continent it was flying over. They
 * ride ~10 km up — far below the satellite shell — so they only separate from the
 * surface at deep zoom: the moment you drop through the orbits toward the ground.
 *
 * Honest: a snapshot from the deploy, not a live second-by-second feed (the HUD
 * labels it as such). Real positions, real callsigns — not invented traffic.
 */

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"
import { earthRotationAngle, simTimeRef } from "./astronomy"

const EARTH_RADIUS_KM = 6371

type Flight = { icao: string; call: string | null; lon: number; lat: number; altM: number; velMs: number | null; hdg: number | null; country: string | null }
type FlightsFile = { snapshot: string; count: number; source: string; flights: Flight[] }

export function FlightField({ earthVisualRadius }: { earthVisualRadius: number }) {
  const [flights, setFlights] = useState<Flight[] | null>(null)
  const groupRef = useRef<THREE.Group>(null)
  const pointsRef = useRef<THREE.Points>(null)

  useEffect(() => {
    let alive = true
    fetch("/data/flights.json")
      .then((r) => r.json())
      .then((d: FlightsFile) => { if (alive) setFlights(d.flights ?? []) })
      .catch(() => { if (alive) setFlights([]) })
    return () => { alive = false }
  }, [])

  // Build the point cloud once: each plane at its geodetic lat/lon, lifted by its
  // real altitude (to scale). Earth-FIXED coords — the wrapping group applies the
  // current GMST rotation each frame so planes stay over their continents.
  const geometry = useMemo(() => {
    if (!flights || flights.length === 0) return null
    const kmToScene = earthVisualRadius / EARTH_RADIUS_KM
    const pos = new Float32Array(flights.length * 3)
    for (let i = 0; i < flights.length; i++) {
      const f = flights[i]
      const r = earthVisualRadius + (f.altM / 1000) * kmToScene
      const lat = (f.lat * Math.PI) / 180
      const lon = (f.lon * Math.PI) / 180
      const cl = Math.cos(lat)
      // ECEF unit vector → scene (x, z, -y), matching the ground-track mapping.
      const ex = cl * Math.cos(lon), ey = cl * Math.sin(lon), ez = Math.sin(lat)
      pos[i * 3] = ex * r
      pos[i * 3 + 1] = ez * r
      pos[i * 3 + 2] = -ey * r
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3))
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), earthVisualRadius * 1.02)
    return g
  }, [flights, earthVisualRadius])

  // Spin the Earth-fixed group in lockstep with the globe (same GMST angle the
  // Earth mesh uses), so planes track the rotating surface below them.
  useFrame(() => {
    if (groupRef.current) groupRef.current.rotation.y = earthRotationAngle(simTimeRef.current.simMs)
  })

  if (!geometry) return null
  return (
    <group ref={groupRef}>
      <points ref={pointsRef} geometry={geometry}>
        {/* Warm amber pinpoints — aircraft, distinct from the cool satellite
            shell. A hair above the surface, so they only resolve at deep zoom. */}
        <pointsMaterial
          size={earthVisualRadius * 0.006}
          sizeAttenuation
          color="#ffcf6b"
          transparent
          opacity={0.9}
          depthWrite={false}
          toneMapped={false}
        />
      </points>
    </group>
  )
}
