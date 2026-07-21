"use client"

/**
 * GoogleEarthView — Phase 2 photoreal Earth descent.
 *
 * A self-contained full-screen R3F view that streams Google's **Photorealistic
 * 3D Tiles** (Map Tiles API) so the user can explore a real-world 3D Earth
 * (buildings, terrain, landmarks) — the "street-level" leg beyond the GLSL
 * space engine. Deliberately SEPARATE from the 7k-line scene.tsx: its own
 * canvas, mounted only on explicit opt-in, so it can't destabilise the engine
 * and — critically — costs nothing until the user asks for it.
 *
 * COST SAFETY (the user's explicit constraint — stay inside the free credit):
 *   1. OPT-IN: canvas + TilesRenderer mount only when this component renders,
 *      which happens only after a deliberate "Descend to Earth" click. Idle
 *      visitors never load a tile → $0.
 *   2. HARD ZOOM CAP: GlobeControls.minDistance is raised well above street
 *      level so people can see cities/landmarks but CANNOT keep diving in —
 *      capping the depth caps how many high-detail tiles ever load.
 *   3. HARD SESSION CAP: an auto-exit timer closes the view after
 *      SESSION_LIMIT_MS, so a tab left open can't stream tiles forever.
 *   4. Referrer-locked key: can't be used off www.sinhaankur.com even though
 *      it ships in the bundle.
 */

import { Suspense, useEffect, useRef, useState } from "react"
import { Canvas } from "@react-three/fiber"
import { TilesRenderer, TilesPlugin, GlobeControls, TilesAttributionOverlay } from "3d-tiles-renderer/r3f"
import {
  GoogleCloudAuthPlugin,
  TileCompressionPlugin,
  UpdateOnChangePlugin,
  TilesFadePlugin,
} from "3d-tiles-renderer/plugins"
import { X } from "lucide-react"

/** Map Tiles API key, inlined at build time. Empty until provided. */
export const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? ""
export const hasGoogleEarthKey = GOOGLE_MAPS_KEY.length > 0

// --- Hard caps (cost control) -------------------------------------------------
// Closest the camera may get to the surface, in metres. Street level is ~10 m
// (the library default); we hold it at 600 m so you get a rich city/landmark
// view but can't keep diving into ever-higher-detail tiles. Raise/lower to taste.
const MIN_ZOOM_METERS = 600
// Farthest out (metres) — the initial vantage sits within this so the controls
// don't immediately yank the camera inward. ~25,000 km frames the whole globe.
const MAX_ZOOM_METERS = 25_000_000
// Auto-close the photoreal view after this long, so an idle open tab can't keep
// streaming tiles (and billing) indefinitely.
const SESSION_LIMIT_MS = 90 * 1000 // 90s — shorter cap to protect Google 3D-Tiles credit

type Props = {
  /** Close the photoreal view + return to the GLSL space engine. */
  onClose: () => void
}

/**
 * Full-screen photoreal Earth. Renders nothing (and never touches the API) when
 * the key is absent — the parent also hides the launch button in that case.
 */
export function GoogleEarthView({ onClose }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(Math.round(SESSION_LIMIT_MS / 1000))
  const closedRef = useRef(false)

  // Hard session cap: count down, then auto-close. Guarded so we only fire once.
  useEffect(() => {
    if (!hasGoogleEarthKey) return
    const started = Date.now()
    const id = window.setInterval(() => {
      const remaining = Math.max(0, SESSION_LIMIT_MS - (Date.now() - started))
      setSecondsLeft(Math.round(remaining / 1000))
      if (remaining <= 0 && !closedRef.current) {
        closedRef.current = true
        window.clearInterval(id)
        onClose()
      }
    }, 1000)
    return () => window.clearInterval(id)
  }, [onClose])

  // Close the view the moment the tab is hidden — a backgrounded tab must NOT keep
  // streaming paid tiles (protects Google credit if you switch away or lock the
  // screen without closing it).
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === "hidden" && !closedRef.current) {
        closedRef.current = true
        onClose()
      }
    }
    document.addEventListener("visibilitychange", onHidden)
    return () => document.removeEventListener("visibilitychange", onHidden)
  }, [onClose])

  if (!hasGoogleEarthKey) return null

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <Canvas
        // Google's tiles are Earth-CENTERED (globe at the origin, radius
        // ~6,378 km). Start the camera WELL OUTSIDE the planet — ~20,000 km up —
        // or it spawns inside the core and renders black. GlobeControls then
        // frames + lets the user orbit/descend from there.
        camera={{ position: [0, 0, 18_000_000], near: 100, far: 160_000_000, fov: 60 }}
        gl={{ antialias: true, logarithmicDepthBuffer: true }}
        dpr={[1, 1.5]}
      >
        <color attach="background" args={["#05060c"]} />
        <ambientLight intensity={1.1} />
        <directionalLight position={[1, 1, 1]} intensity={1.4} />

        <Suspense fallback={null}>
          <TilesRenderer>
            {/* Google auth — attaches the referrer-locked key + a session.
                args is the plugin constructor's parameter tuple (one options obj). */}
            <TilesPlugin
              plugin={GoogleCloudAuthPlugin}
              args={[{ apiToken: GOOGLE_MAPS_KEY, autoRefreshToken: true }]}
            />
            {/* Perf: decode compressed tiles, only update on camera change, and
                fade LOD swaps so they don't pop. Fewer redundant tile loads. */}
            <TilesPlugin plugin={TileCompressionPlugin} />
            <TilesPlugin plugin={UpdateOnChangePlugin} />
            <TilesPlugin plugin={TilesFadePlugin} />

            {/* Globe controls with the HARD zoom caps — the core cost guard. */}
            <GlobeControls
              enableDamping
              minDistance={MIN_ZOOM_METERS}
              maxDistance={MAX_ZOOM_METERS}
            />

            {/* Google requires visible data attribution. */}
            <TilesAttributionOverlay />
          </TilesRenderer>
        </Suspense>
      </Canvas>

      {/* Exit back to the space engine. */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Exit photoreal Earth"
        className="absolute top-4 left-4 md:top-6 md:left-6 z-10 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/50 px-3 py-2 font-mono text-[10px] tracking-widest uppercase text-white/85 backdrop-blur-sm transition-colors hover:text-white hover:border-white/40"
      >
        <X className="h-3.5 w-3.5" />
        Exit · back to space
      </button>

      {/* Session countdown — honest about the auto-close cap. */}
      <div className="pointer-events-none absolute top-4 right-4 md:top-6 md:right-6 z-10 rounded-full border border-white/15 bg-black/50 px-3 py-2 font-mono text-[10px] tracking-widest uppercase text-white/60 backdrop-blur-sm">
        Session · {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
      </div>

      {/* Provenance chip. */}
      <div className="pointer-events-none absolute bottom-4 right-4 z-10 max-w-[16rem] text-right">
        <p className="font-mono text-[9px] tracking-widest uppercase text-white/45">
          Photorealistic 3D Tiles · Google
        </p>
      </div>
    </div>
  )
}
