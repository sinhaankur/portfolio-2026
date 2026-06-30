# Optical Flow Engine — notes

A self-contained, client-side computer-vision engine: it turns a live video
frame into a field of tracked feature points, in real time, with no OpenCV, no
WASM, and no server. Two classic algorithms — **Shi-Tomasi** "Good Features to
Track" and **Lucas-Kanade** optical flow — ported by hand to TypeScript.

Mount it and nothing else:

```tsx
import { OpticalFlowEngine } from "@/components/optical-flow"
// (the Lab page wraps it in <RevealCanvas> so the camera is opt-in)
```

## Layers (truth spine → render → control)

| File | Role |
|---|---|
| `flow-core.ts` | **CV spine.** `shiTomasi` (detect corners), `trackPoints` (pyramidal Lucas-Kanade), `buildPyramid`, `toGray`, `blur`. No React, no canvas. |
| `renderer.ts` | **Field layer.** `mergeField` (fold fresh corners in with *even spacing* — kills clumping) + `drawField` (soft, varied, glowing dots on near-black). Pure. |
| `config.ts` | **Tunables.** Proc resolution, pyramid/LK params, the density→detection mapping, palettes, render tuning, defaults. One knob-board. |
| `flow-canvas.tsx` | **Orchestrator.** Owns the camera (getUserMedia) + RAF loop; wires core → renderer → hud. No CV math or draw calls inline. |
| `hud.tsx` | **Control surface.** Density · palette · ghost · stop. Presentational. |
| `reveal-canvas.tsx` | **Opt-in gate.** Button that mounts the engine only on click, so nothing touches the camera until the user asks. |
| `index.tsx` | **Entry.** `<OpticalFlowEngine />` + re-exports of the spine/tunables. |

## The pipeline, per frame

1. **Grab** the webcam frame → mirror → downscale to 240×180 → grayscale + blur.
2. **Track** existing points forward with Lucas-Kanade (3-level pyramid, 7px window).
3. **Replenish** — when the field thins below 70% of target (or every 12 frames),
   re-detect with Shi-Tomasi at a low quality bar (so cheeks/neck/shoulders fill,
   not just the hottest corners) and `mergeField` them in with even spacing.
4. **Draw** the surviving points as soft radial-gradient dots, sized + brightened
   by corner strength, additively over the palette background.

## Design intent (true to the reference)

- **Even, dense coverage** of the whole form — not clumps on glasses/hairline.
  The spacing grid in `mergeField` is what makes the silhouette read.
- **Floats on near-black.** Ghost-source is OFF by default; the form should read
  from the dot field alone.
- **The aesthetic is a byproduct of correct tracking** — real corners, moved by
  real measured flow, not a particle effect chasing a silhouette.

## Extending

- New palette → add to `PALETTES` in `config.ts`.
- Different feel → tune `RENDER` / `densityToDetection` in `config.ts` only.
- New source (e.g. a file, or a baked clip) → the orchestrator's `grayFromVideo`
  is the single seam; everything downstream is source-agnostic.

## Constraints

- **Client-only / static-export safe** — no server, no network.
- **Camera is opt-in** — `getUserMedia` only after an explicit click.
- **On-device** — frames never leave the machine; there is no upload.
