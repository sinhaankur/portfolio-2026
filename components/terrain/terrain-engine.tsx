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

import { useState, useMemo, useRef, useEffect, Suspense } from "react"
import { Canvas } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib"
import { TERRAIN_BODIES, getTerrainBody, latLonToUnitVec } from "@/lib/terrain/bodies"
import { TerrainBody } from "./terrain-body"
import { EarthLive, currentSunDirection } from "./earth-live"
import { DeepZoomController } from "./terrain-patch"
import { RoverPins } from "./rover-pin"
import { RoverImageryPanel } from "./rover-imagery-panel"
import { TerrainHud } from "./terrain-hud"

// The body sphere renders at a fixed visual radius; real proportions live in the
// data (radiusKm) and drive the height→displacement scaling, not the on-screen size.
const RADIUS_UNITS = 2

export function TerrainEngine({ initialBody = "mars" }: { initialBody?: string }) {
  const [bodyId, setBodyId] = useState(initialBody)
  const [exaggeration, setExaggeration] = useState<number | null>(null)
  // null = follow the body's default (Earth opens tinted to reveal the drained
  // seafloor); once the user toggles, their choice sticks for this body view.
  const [hypsometricOverride, setHypsometricOverride] = useState<boolean | null>(null)
  const [slopeShade, setSlopeShade] = useState(true)
  // Ocean defaults ON for bodies that have water (Earth) — the living planet, not
  // drained. null = follow the body default; once toggled, the choice sticks.
  const [oceanOverride, setOceanOverride] = useState<boolean | null>(null)
  const [selectedSite, setSelectedSite] = useState<number | null>(null)
  // 0 = full orbit view, 1 = skimming the surface. Drives the deep-zoom readout.
  const [zoomDepth, setZoomDepth] = useState(0)
  // Name of the high-res region the camera is over (e.g. "Valles Marineris"), or null.
  const [activeRegion, setActiveRegion] = useState<string | null>(null)
  const controlsRef = useRef<OrbitControlsImpl | null>(null)

  const body = getTerrainBody(bodyId) ?? TERRAIN_BODIES[0]
  // Exaggeration resets to the body's sensible default on switch, until the user
  // moves the slider (then their choice sticks for that body view).
  const exag = exaggeration ?? body.defaultExaggeration
  const hypsometric = hypsometricOverride ?? body.defaultHypsometric ?? false
  // Ocean on by default wherever the body has water (Earth); off elsewhere.
  const oceanVisible = oceanOverride ?? body.hasOcean ?? false
  // Real Sun direction for live bodies (Earth) — computed once at mount; the
  // per-frame refresh inside EarthLive keeps the terminator tracking the clock.
  const sunNow = useMemo(() => {
    const s = currentSunDirection()
    return [s.x, s.y, s.z] as [number, number, number]
  }, [])

  // Peak displacement in scene units (for pin float height) at current exaggeration.
  const maxDisplaceUnits = useMemo(() => {
    const unitsPerMetre = RADIUS_UNITS / (body.radiusKm * 1000)
    return Math.max(0, body.elevationMaxM) * unitsPerMetre * exag
  }, [body, exag])

  // Camera floor: clear the tallest exaggerated peak, then a modest clearance so
  // you can descend close to skim the surface ("go as deep as we want") WITHOUT
  // diving so far the terrain rises into the camera as a flat fill. 0.10×R is the
  // sweet spot — much closer than before, still shows relief. A regional hi-res
  // tile keeps the close-up crisp where one exists.
  const minDistance = RADIUS_UNITS + maxDisplaceUnits + RADIUS_UNITS * 0.1

  function pickBody(id: string, opts?: { push?: boolean }) {
    setBodyId(id)
    setExaggeration(null) // reset to new body's default
    setHypsometricOverride(null) // follow new body's default tint
    setSelectedSite(null)
    setOceanOverride(null) // follow new body's default (Earth = water on)
    if (typeof window !== "undefined") {
      const write = opts?.push ? "pushState" : "replaceState"
      window.history[write](null, "", `#${id}`)
    }
  }

  // Deep-link support: react to hash changes (shared links, back/forward). A hash
  // of "#body" or "#body/region" switches the body and, if a region is named,
  // flies down into it once the new body's tiles have loaded. This is what makes
  // sinhaankur.com/lab/terrain#mars/valles-marineris open right on the canyon.
  const pendingRegion = useRef<string | null>(null)
  useEffect(() => {
    function applyHash() {
      const raw = window.location.hash.replace(/^#/, "")
      if (!raw) return
      const [bId, regionId] = raw.split("/")
      const target = getTerrainBody(bId)
      if (!target) return
      if (bId !== bodyId) pickBody(bId)
      pendingRegion.current = regionId ?? null
    }
    window.addEventListener("hashchange", applyHash)
    return () => window.removeEventListener("hashchange", applyHash)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodyId])

  // Once a body switch settles, honour a pending region from the URL.
  useEffect(() => {
    if (!pendingRegion.current) return
    const regionId = pendingRegion.current
    pendingRegion.current = null
    // Small delay so the new body's controls + region tiles are mounted/loaded.
    const t = setTimeout(() => flyToRegion(regionId), 600)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodyId])

  // On first mount, honour a "#body/region" deep-link's region part. Retries
  // until the OrbitControls are mounted (the Canvas + region tiles load async),
  // so a cold shared link reliably lands on the region.
  useEffect(() => {
    const raw = typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : ""
    const regionId = raw.split("/")[1]
    if (!regionId) return
    let tries = 0
    const iv = setInterval(() => {
      tries++
      if (controlsRef.current) {
        flyToRegion(regionId)
        clearInterval(iv)
      } else if (tries > 40) {
        clearInterval(iv) // give up after ~8s
      }
    }, 200)
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fly the camera down into a region: point it at the region centre and pull it
  // just above the surface floor so the high-res tile engages.
  function flyToRegion(regionId: string) {
    const region = body.regions?.find((r) => r.id === regionId)
    const controls = controlsRef.current
    if (!region || !controls) return
    const latC = (region.latS + region.latN) / 2
    const lonC = (region.lonW + region.lonE) / 2
    const [x, y, z] = latLonToUnitVec(latC, lonC)
    const d = minDistance + RADIUS_UNITS * 0.12 // just above the floor
    const cam = controls.object
    cam.position.set(x * d, y * d, z * d)
    controls.target.set(0, 0, 0)
    controls.update()
    // Reflect the deep-dive in the URL so it's a shareable link.
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${body.id}/${regionId}`)
    }
  }

  // Copy the current view as a shareable link (body + any active region).
  const [shareState, setShareState] = useState<"idle" | "copied">("idle")
  async function shareView() {
    if (typeof window === "undefined") return
    const url = window.location.origin + window.location.pathname + window.location.hash
    try {
      await navigator.clipboard.writeText(url)
      setShareState("copied")
      setTimeout(() => setShareState("idle"), 1800)
    } catch {
      // Clipboard blocked — select-free fallback: no-op, the URL is already in the bar.
    }
  }

  const activeSite = selectedSite != null ? body.sites[selectedSite] : null

  return (
    <div className="relative h-[100dvh] w-full bg-black">
      <Canvas
        camera={{ position: [0, 1.5, 6], fov: 45, near: 0.002, far: 100 }}
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
            sunDir={body.live ? sunNow : undefined}
          />

          {/* The living Earth — ocean at sea level, drifting clouds, real-Sun
              terminator. Ocean hides when the user drains it; clouds/atmosphere
              stay. Only for bodies flagged `live` (Earth). */}
          {body.live && (
            <EarthLive radiusUnits={RADIUS_UNITS} oceanVisible={oceanVisible} />
          )}

          <RoverPins
            body={body}
            radiusUnits={RADIUS_UNITS}
            maxDisplaceUnits={maxDisplaceUnits}
            selectedIndex={selectedSite}
            onSelect={setSelectedSite}
          />
        </Suspense>

        {/* Deep-zoom: drives the local high-detail patch + reports zoom depth. */}
        <DeepZoomController
          body={body}
          radiusUnits={RADIUS_UNITS}
          exaggeration={exag}
          hypsometric={hypsometric ? 1 : 0}
          slopeShade={slopeShade ? 1 : 0}
          minDistance={minDistance}
          onDepthChange={setZoomDepth}
          onRegionChange={setActiveRegion}
        />

        <OrbitControls
          ref={controlsRef}
          enablePan={false}
          // Allow descent close to the surface so the local patch resolves, but
          // never below the tallest EXAGGERATED peak + a little clearance — else
          // the camera clips through the terrain into a flat fill.
          minDistance={minDistance}
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
        onHypsometric={setHypsometricOverride}
        slopeShade={slopeShade}
        onSlopeShade={setSlopeShade}
        oceanVisible={oceanVisible}
        onOcean={setOceanOverride}
        zoomDepth={zoomDepth}
        activeRegion={activeRegion}
        onDive={flyToRegion}
        onShare={shareView}
        shareState={shareState}
      />

      {activeSite && (
        <RoverImageryPanel site={activeSite} onClose={() => setSelectedSite(null)} />
      )}
    </div>
  )
}
