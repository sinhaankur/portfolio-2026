/**
 * google-earth-config — the Three-FREE feature-flag + key for the Google
 * photoreal-Earth view. Lives apart from google-earth-tiles.tsx (which imports
 * @react-three/fiber) so the DOM chrome can check `hasGoogleEarthKey` to decide
 * whether to show the entry point WITHOUT dragging in the ~800 KB Three bundle.
 * The heavy <GoogleEarthView> stays behind a dynamic import.
 */

export const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? ""

// Explicit kill-switch: Google 3D Tiles need ACTIVE billing even with free
// credits, so if billing is off the key is present but every tile fails (black
// screen). Set NEXT_PUBLIC_GOOGLE_EARTH_ENABLED="false" (or leave the key empty)
// to hide the entry point and keep the graceful-degradation path.
const GOOGLE_EARTH_ENABLED = process.env.NEXT_PUBLIC_GOOGLE_EARTH_ENABLED !== "false"

export const hasGoogleEarthKey = GOOGLE_EARTH_ENABLED && GOOGLE_MAPS_KEY.length > 0
