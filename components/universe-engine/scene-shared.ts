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

/** Reused for a body's world position when computing the sun direction, etc. */
export const _earthWorldPos = new Vector3()
/** The Sun's world position (set from SUN_OFFSET_SCENE each frame). */
export const _sunWorldPos = new Vector3()
/** Sun-direction scratch (sunWorldPos − bodyWorldPos, normalized). */
export const _sunDirTmp = new Vector3()
/** Scratch axis for per-object rotation (e.g. belt-rock tumble). */
export const _tmpAxis = new Vector3()
