/**
 * scene-shared — small primitives shared across the engine's render components.
 *
 * A single reusable pool of scratch Vector3s. These are allocated ONCE at module
 * scope and reused every frame (copy/set into them) so the render loop never
 * allocates — the standard Three.js "don't `new` in useFrame" pattern. Living
 * here (not scattered through scene.tsx) means every sub-engine imports the same
 * canonical pool instead of redeclaring its own.
 *
 * Scratch vectors are inherently transient: only hold a value for the span of a
 * single calculation, never across an await/yield. Fine because the frame loop
 * is synchronous.
 */

import { Vector3 } from "three"

import { requestFlyTo } from "./astronomy"

/** Reused for a body's world position when computing the sun direction, etc. */
export const _earthWorldPos = new Vector3()
/** The Sun's world position (set from SUN_OFFSET_SCENE each frame). */
export const _sunWorldPos = new Vector3()
/** Sun-direction scratch (sunWorldPos − bodyWorldPos, normalized). */
export const _sunDirTmp = new Vector3()
/** Scratch axis for per-object rotation (e.g. belt-rock tumble). */
export const _tmpAxis = new Vector3()

/**
 * Build an onClick handler that flies the camera to the clicked object's world
 * position at a desired distance. Returns undefined when the scene isn't
 * interactive, so a non-interactive hero simply omits the click affordance.
 * Shared by every clickable body (the Milky Way core, the Sun, …) so the
 * fly-to gesture is defined once.
 */
export function makeFocusHandler(
  interactive: boolean,
  desiredDistance: number,
  label?: string,
) {
  if (!interactive) return undefined
  return (e: { stopPropagation: () => void; object: import("three").Object3D }) => {
    e.stopPropagation()
    const world = new Vector3()
    e.object.getWorldPosition(world)
    requestFlyTo({ x: world.x, y: world.y, z: world.z }, desiredDistance, label)
  }
}
