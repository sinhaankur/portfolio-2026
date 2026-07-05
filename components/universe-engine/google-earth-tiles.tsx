"use client"

/**
 * GoogleEarthTiles — Phase 2 photoreal Earth descent.
 *
 * Streams Google's **Photorealistic 3D Tiles** (Map Tiles API) into the R3F
 * scene so the user can descend from the GLSL space-view Earth down to a
 * street-level, real-world 3D globe (buildings, terrain, landmarks).
 *
 * DEPENDENCIES (installed only once the key exists — see setup below):
 *   pnpm add 3d-tiles-renderer
 *
 * KEY (never committed):
 *   Put the Map Tiles API key in `.env.local` (gitignored) as
 *     NEXT_PUBLIC_GOOGLE_MAPS_KEY=AIza...
 *   Next inlines NEXT_PUBLIC_* at build time. On GitHub Pages the key is baked
 *   into the deployed bundle, and it's referrer-restricted to www.sinhaankur.com
 *   so a leaked bundle key can't be used off-domain.
 *
 * COST SAFETY: this component only mounts when the user explicitly clicks
 * "Descend to Earth" (see `active` prop). Idle visitors never load a tile, so
 * they never cost anything. The 3D Tiles API bills per session.
 *
 * STATUS: scaffold. The <TilesRenderer> wiring is stubbed until the key lands
 * (guarded by GOOGLE_MAPS_KEY). Everything else — the opt-in gate, the graceful
 * absent-key fallback, the mount lifecycle — is ready.
 */

import { useEffect, useState } from "react"

/** The Map Tiles API key, read from the build-time env. Empty string when the
 *  key hasn't been provided yet — every consumer checks `hasGoogleEarthKey`
 *  first so the whole feature is a no-op (and the UI hides) until it exists. */
export const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? ""
export const hasGoogleEarthKey = GOOGLE_MAPS_KEY.length > 0

// Google's Photorealistic 3D Tiles root tileset. The renderer appends the key.
export const GOOGLE_3D_TILES_URL =
  "https://tile.googleapis.com/v1/3dtiles/root.json"

type Props = {
  /** True once the user has opted in (clicked "Descend to Earth"). The tiles
   *  only stream while this is true — protecting the billing quota. */
  active: boolean
  /** Lat/lon to frame on descent (defaults to a recognisable location). */
  target?: { lat: number; lon: number }
}

/**
 * The actual tile-streaming layer. Currently a guarded stub: renders nothing
 * until the key is present AND the user has opted in. Once the key lands we
 * install `3d-tiles-renderer` and mount its <TilesRenderer> here, attaching the
 * Google session + the camera/controls from useThree().
 */
export function GoogleEarthTiles({ active }: Props) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Guard: do nothing without a key or without opt-in.
    if (!hasGoogleEarthKey || !active) return
    // --- WIRE HERE once `pnpm add 3d-tiles-renderer` is in: -----------------
    // const { TilesRenderer } = await import("3d-tiles-renderer")
    // const { GoogleCloudAuthPlugin, TilesFadePlugin } =
    //   await import("3d-tiles-renderer/plugins")
    // const tiles = new TilesRenderer(GOOGLE_3D_TILES_URL)
    // tiles.registerPlugin(new GoogleCloudAuthPlugin({ apiToken: GOOGLE_MAPS_KEY }))
    // tiles.setCamera(camera); tiles.setResolutionFromRenderer(camera, gl)
    // scene.add(tiles.group); ...update per-frame in useFrame; dispose on cleanup.
    setReady(true)
    return () => setReady(false)
  }, [active])

  // Nothing to render yet (stub). Real tiles.group gets added imperatively above.
  void ready
  return null
}
