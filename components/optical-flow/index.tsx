/**
 * Optical Flow engine — public entry.
 *
 * Mount <OpticalFlowEngine /> and nothing else. Internally it composes the CV
 * spine (flow-core), the field renderer (renderer), the tunable params/palettes
 * (config), and the control HUD (hud), driven by a camera + RAF orchestrator
 * (flow-canvas). Same "one entry, sub-layers behind it" shape as the Universe
 * Engine.
 *
 *   ┌──────────────────────────────────────────────┐
 *   │           OpticalFlowEngine (index)            │
 *   │  camera · RAF loop · params state · HUD         │
 *   └───────────────┬────────────────────────────────┘
 *      composes ▾
 *   flow-core.ts   renderer.ts   config.ts   hud.tsx
 *   (detect+track) (merge+draw)  (params)    (controls)
 *
 * The page wraps this in <RevealCanvas> so the camera is opt-in behind a click.
 */

export { FlowCanvas as OpticalFlowEngine } from "./flow-canvas"
export { RevealCanvas } from "./reveal-canvas"

// Re-export the spine + tunables so other surfaces (a future hero, a game) can
// drive the engine with their own params without reaching into internals.
export {
  PALETTES,
  DEFAULTS,
  densityToDetection,
  type EngineParams,
  type Palette,
} from "./config"
export {
  shiTomasi,
  trackPoints,
  buildPyramid,
  toGray,
  blur,
  type FeaturePoint,
  type GrayImage,
} from "./flow-core"
export { mergeField, drawField } from "./renderer"
