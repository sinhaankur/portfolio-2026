"use client"

/**
 * RoverPins — landing-site markers sitting on the real surface, and the panel
 * that opens live NASA imagery when you select one. Positions come from each
 * site's real lat/lon (lib/terrain/bodies.ts), placed just above the displaced
 * terrain so the pin rides the mountains, not the base sphere.
 */

import { useMemo } from "react"
import { Billboard, Html } from "@react-three/drei"
import type { TerrainBody } from "@/lib/terrain/bodies"
import { latLonToUnitVec } from "@/lib/terrain/bodies"

interface Props {
  body: TerrainBody
  radiusUnits: number
  /** Peak displacement in units (so pins float just clear of the tallest relief). */
  maxDisplaceUnits: number
  selectedIndex: number | null
  onSelect: (index: number | null) => void
}

export function RoverPins({ body, radiusUnits, maxDisplaceUnits, selectedIndex, onSelect }: Props) {
  const pins = useMemo(
    () =>
      body.sites.map((site) => {
        const [x, y, z] = latLonToUnitVec(site.lat, site.lon)
        // Sit the pin at radius + a little above the tallest relief so it never
        // sinks into a mountain regardless of exaggeration.
        const r = radiusUnits + maxDisplaceUnits + radiusUnits * 0.012
        return { site, pos: [x * r, y * r, z * r] as [number, number, number] }
      }),
    [body.sites, radiusUnits, maxDisplaceUnits],
  )

  return (
    <group>
      {pins.map(({ site, pos }, i) => {
        const active = selectedIndex === i
        return (
          <group key={site.name} position={pos}>
            <Billboard>
              <mesh
                onClick={(e) => { e.stopPropagation(); onSelect(active ? null : i) }}
                onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer" }}
                onPointerOut={() => { document.body.style.cursor = "" }}
              >
                <circleGeometry args={[active ? radiusUnits * 0.018 : radiusUnits * 0.012, 24]} />
                <meshBasicMaterial
                  color={site.roverSlug ? "#7ee0a5" : body.accent}
                  transparent
                  opacity={active ? 1 : 0.85}
                />
              </mesh>
              {/* Outer ring for findability without girth (favour brightness). */}
              <mesh>
                <ringGeometry args={[radiusUnits * 0.02, radiusUnits * 0.024, 24]} />
                <meshBasicMaterial color={site.roverSlug ? "#7ee0a5" : body.accent} transparent opacity={0.5} />
              </mesh>
            </Billboard>
            {active && (
              <Html center distanceFactor={radiusUnits * 6} zIndexRange={[40, 0]}>
                <div className="pointer-events-none -translate-y-8 whitespace-nowrap rounded-md bg-black/80 px-2 py-1 text-[10px] font-mono text-white/90 ring-1 ring-white/15">
                  {site.name} · {site.year}
                </div>
              </Html>
            )}
          </group>
        )
      })}
    </group>
  )
}
