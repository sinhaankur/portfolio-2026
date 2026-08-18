"use client"

/**
 * TerrainEngine — the /lab/terrain explorer.
 *
 * Composes the whole planetary-terrain experience: an R3F Canvas with a single
 * displaced-sphere body, orbit-to-surface controls, real landing-site pins with
 * live NASA rover imagery, an optional drained/filled ocean shell (Earth), and
 * the HUD (body picker, labelled exaggeration, layer toggles, attribution).
 *
 * Separate canvas from the orbital engine (scene.tsx) — its own lightweight
 * scene, mounted only on this route, so it can't destabilise the main engine.
 * Client-only + static-export safe.
 */

import { useState, useMemo, Suspense } from "react"
import { Canvas } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import { BackSide } from "three"
import { TERRAIN_BODIES, getTerrainBody } from "@/lib/terrain/bodies"
import { TerrainBody } from "./terrain-body"
import { RoverPins } from "./rover-pin"
import { RoverImageryPanel } from "./rover-imagery-panel"
import { TerrainHud } from "./terrain-hud"

// The body sphere renders at a fixed visual radius; real proportions live in the
// data (radiusKm) and drive the height→displacement scaling, not the on-screen size.
const RADIUS_UNITS = 2

export function TerrainEngine({ initialBody = "mars" }: { initialBody?: string }) {
  const [bodyId, setBodyId] = useState(initialBody)
  const [exaggeration, setExaggeration] = useState<number | null>(null)
  const [hypsometric, setHypsometric] = useState(false)
  const [slopeShade, setSlopeShade] = useState(true)
  const [oceanVisible, setOceanVisible] = useState(false)
  const [selectedSite, setSelectedSite] = useState<number | null>(null)

  const body = getTerrainBody(bodyId) ?? TERRAIN_BODIES[0]
  // Exaggeration resets to the body's sensible default on switch, until the user
  // moves the slider (then their choice sticks for that body view).
  const exag = exaggeration ?? body.defaultExaggeration

  // Peak displacement in scene units (for pin float height) at current exaggeration.
  const maxDisplaceUnits = useMemo(() => {
    const unitsPerMetre = RADIUS_UNITS / (body.radiusKm * 1000)
    return Math.max(0, body.elevationMaxM) * unitsPerMetre * exag
  }, [body, exag])

  function pickBody(id: string) {
    setBodyId(id)
    setExaggeration(null) // reset to new body's default
    setSelectedSite(null)
    setOceanVisible(false)
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${id}`)
    }
  }

  const activeSite = selectedSite != null ? body.sites[selectedSite] : null

  return (
    <div className="relative h-[100dvh] w-full bg-black">
      <Canvas
        camera={{ position: [0, 1.5, 6], fov: 45, near: 0.01, far: 100 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true }}
      >
        {/* Fill + key light; the shader's ambient keeps the night side readable. */}
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 3, 4]} intensity={1.1} />

        <Suspense fallback={null}>
          <TerrainBody
            key={body.id}
            body={body}
            radiusUnits={RADIUS_UNITS}
            exaggeration={exag}
            hypsometric={hypsometric ? 1 : 0}
            slopeShade={slopeShade ? 1 : 0}
          />

          {/* Earth ocean shell: a translucent sphere at sea level you can drain. */}
          {body.hasOcean && oceanVisible && (
            <mesh>
              <sphereGeometry args={[RADIUS_UNITS * 1.001, 96, 48]} />
              <meshStandardMaterial
                color="#1e5a8a"
                transparent
                opacity={0.62}
                roughness={0.15}
                metalness={0.0}
                side={BackSide}
              />
            </mesh>
          )}

          <RoverPins
            body={body}
            radiusUnits={RADIUS_UNITS}
            maxDisplaceUnits={maxDisplaceUnits}
            selectedIndex={selectedSite}
            onSelect={setSelectedSite}
          />
        </Suspense>

        <OrbitControls
          enablePan={false}
          minDistance={RADIUS_UNITS * 1.15}
          maxDistance={RADIUS_UNITS * 8}
          rotateSpeed={0.5}
          zoomSpeed={0.8}
          enableDamping
          dampingFactor={0.08}
        />
      </Canvas>

      <TerrainHud
        body={body}
        onPickBody={pickBody}
        exaggeration={exag}
        onExaggeration={setExaggeration}
        hypsometric={hypsometric}
        onHypsometric={setHypsometric}
        slopeShade={slopeShade}
        onSlopeShade={setSlopeShade}
        oceanVisible={oceanVisible}
        onOcean={setOceanVisible}
      />

      {activeSite && (
        <RoverImageryPanel site={activeSite} onClose={() => setSelectedSite(null)} />
      )}
    </div>
  )
}
