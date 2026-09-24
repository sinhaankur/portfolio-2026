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
import { QuadtreeController } from "./quadtree"
import { RoverPins } from "./rover-pin"
import { RoverImageryPanel } from "./rover-imagery-panel"
import { EarthWeatherProbe, EarthWeatherReadout, type ProbeState } from "./earth-weather-probe"
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
  // Active quadtree pyramid zoom (Phase C), or -1 when no pyramid / far out.
  const [quadZoom, setQuadZoom] = useState(-1)
  // Live-weather probe (Earth only): the last point clicked on the globe + its
  // fetched weather. Null when nothing is probed / on a non-live body.
  const [probe, setProbe] = useState<ProbeState | null>(null)
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
    setProbe(null) // clear any live-weather readout from the previous body
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
    const [hashBody, regionId] = raw.split("/")
    if (!regionId) return
    let tries = 0
    const iv = setInterval(() => {
      tries++
      // Wait for BOTH the controls to mount AND the active body to actually be
      // the hash's body (the Mars→Earth switch is async) — else the dive fires
      // against the wrong planet and no-ops.
      const ready = controlsRef.current && bodyId === hashBody
      if (ready) {
        flyToRegion(regionId)
        clearInterval(iv)
      } else if (tries > 60) {
        clearInterval(iv) // give up after ~12s
      }
    }, 200)
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodyId])

  // Fly the camera down into a region: point it at the region centre and pull it
  // just above the surface floor so the high-res tile engages.
  function flyToRegion(regionId: string) {
    // Resolve the region against the ACTIVE body. On a cold "#body/region" load
    // this can fire while the closed-over `body` is still the default (Mars), so
    // fall back to the current bodyId's data — else the fly-to silently no-ops and
    // the deep-link "lands on the wrong planet / never dives".
    const activeBody = getTerrainBody(bodyId) ?? body
    const region = activeBody.regions?.find((r) => r.id === regionId)
    const controls = controlsRef.current
    if (!region || !controls) return
    // Underwater regions (Mariana Trench) are just dark water with the ocean on —
    // drain it and turn on the elevation tint so the real seafloor relief shows.
    if (region.underwater) {
      setOceanOverride(false)
      setHypsometricOverride(true)
    }
    const latC = (region.latS + region.latN) / 2
    const lonC = (region.lonW + region.lonE) / 2
    const [x, y, z] = latLonToUnitVec(latC, lonC)
    // Frame the region from a standoff that keeps it VISIBLE and lit — not buried
    // at the floor (which showed a black void). Sit well above the surface and,
    // crucially, LOOK AT the region point on the surface, not the globe centre, so
    // the trench/mountain fills the view instead of the camera pointing through
    // the planet at the dark far side.
    const surf = RADIUS_UNITS
    const d = surf + RADIUS_UNITS * 0.55 // comfortable standoff above the region
    const cam = controls.object
    cam.position.set(x * d, y * d, z * d)
    // Target the surface point (region centre on the globe), not the origin.
    controls.target.set(x * surf, y * surf, z * surf)
    controls.update()
    // Reflect the deep-dive in the URL so it's a shareable link.
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${activeBody.id}/${regionId}`)
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

          {/* Click anywhere on the living Earth to read its live weather. Only on
              Earth (live) — an invisible pickable sphere at the base radius. */}
          {body.live && (
            <EarthWeatherProbe radiusUnits={RADIUS_UNITS} onProbe={setProbe} />
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

        {/* Quadtree LOD (Phase C): for bodies with a baked pyramid (Earth), pull
            real DEM tiles from the terrain-tiles CDN matched to camera altitude, so
            the surface stays sharp anywhere — not just the named regions. No-ops on
            bodies without a pyramid. */}
        <QuadtreeController
          body={body}
          radiusUnits={RADIUS_UNITS}
          exaggeration={exag}
          hypsometric={hypsometric ? 1 : 0}
          slopeShade={slopeShade ? 1 : 0}
          onZoom={setQuadZoom}
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
        quadZoom={quadZoom}
        onDive={flyToRegion}
        onShare={shareView}
        shareState={shareState}
      />

      {activeSite && (
        <RoverImageryPanel site={activeSite} onClose={() => setSelectedSite(null)} />
      )}

      {body.live && probe && (
        <EarthWeatherReadout probe={probe} onClose={() => setProbe(null)} />
      )}
    </div>
  )
}
