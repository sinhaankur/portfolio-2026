# Space Assets (Blender)

Game-bound 3D models of solar-system bodies and spacecraft, built in Blender.

These are **for the future game** (Star Cleaver / Neural Game Engine), **not** the
live website. The website's galaxy hero keeps its procedural GLSL planets in
`components/universe-engine/` — do not wire these meshes into the live site.

## Why these exist
The universe engine renders planets/star/nebula procedurally (tiny web payload,
date-accurate). That's right for the web but gives the game no real geometry to
collide with, fly around, or light. This folder is the game's mesh source.

## Contents
- `space-assets.blend` — master Blender file (all assets, organised under the
  `SpaceAssets` collection → `Spacecraft` / `SmallBodies`).
- `*.glb` — per-asset exports for the R3F game engine (drop into `public/models/`).
- `renders/` — reference stills.

## Assets
| Asset | File | Status | Notes |
|-------|------|--------|-------|
| Voyager probe | `voyager.glb` | base mesh | HGA dish, 3× RTG, magnetometer mast, scan platform + camera barrels, golden record. Detail pass pending. |
| Sun + 8 planets | `bodies/*.glb` | textured | Real relative radii (sqrt-compressed, Earth = 1 unit) + axial tilts from `astronomy.ts`. Equirect webp maps applied. Sun is emissive. Saturn ships with alpha-mapped ring geometry. Subsurf on the large bodies for close-ups. |
| Small bodies | `small-bodies/*.glb` | sculpted | Stony asteroid, carbonaceous asteroid, comet nucleus. Multi-octave noise form + bowl-and-rim crater pass + procedural micro-bump. Subsurf applied on export (~930 KB each — high-poly masters; decimate for a web LOD if needed). |

## Pipeline
Build at max detail in Blender → export GLB (`use_selection`, `+Y up`,
modifiers applied) → copy chosen GLBs into `public/models/` for the game.

## Texture reuse
Bodies reuse the existing `public/textures/*.webp` maps so game + site stay
visually consistent.
