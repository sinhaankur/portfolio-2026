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
| X-wing fighter | `xwing.glb` | detailed | Player ship. Fuselage + tapered nose + sensor, transparent canopy + frame, R2 astromech dome, 4 open-X S-foil wings with engine nacelles + deep dark intakes + bright recessed glow, 4 forward wingtip cannons, faded-red markings, wing flutes + greebles, bevelled edges. Weathered grey hull (procedural grime) tuned against the `rebels_x-wing_starfighter` reference. Y-forward to match `SHIP_MODEL_BASIS_ROTATION`. Source length ≈ 6.26 units. |
| Voyager probe | `voyager.glb` | detailed | HGA dish + feed horn + tripod struts + back ribs; gold-foil decagonal bus; 3× RTG with cooling fins; truss-lattice magnetometer mast (3 rails + cross-bracing); scan platform + camera barrels; golden record. 7 per-part materials (gold foil, aluminium dish, struts, RTG, fins, record, instruments). |
| Sun + 8 planets | `bodies/*.glb` | textured | Real relative radii (sqrt-compressed, Earth = 1 unit) + axial tilts from `astronomy.ts`. Equirect webp maps applied. Sun is emissive. Saturn ships with alpha-mapped ring geometry. Subsurf on the large bodies for close-ups. |
| Enemy fleet | `enemy-{fighter,sniper,swarm,boss}.glb` | detailed | Weathered-realism enemy ships matching the X-wing, cold-grey "empire" palette with glowing red eyes/viewports. Fighter (TIE-style pod + hex solar wings + chin cannons), sniper (long-barrel standoff + sensor eye + fins), swarm (tiny spiked drone), boss (capital wedge: command tower + spine ridges + 6 turret blisters + engine bank). Y-forward, bevelled. Maps to the 4 types in `engine/enemies.ts`. |
| Small bodies | `small-bodies/*.glb` | sculpted | Stony asteroid, carbonaceous asteroid, comet nucleus. Multi-octave noise form + bowl-and-rim crater pass + procedural micro-bump. Subsurf applied on export (~930 KB each — high-poly masters; decimate for a web LOD if needed). |

## Lighting rig
`renders/*-hero.png` use a 3-point space rig (in the `Lighting` collection):
hard warm Sun key (raking), cool soft area fill (planet-shine / reflected
starlight), warm area rim (separates the subject from the void). Cycles, 128–160
samples. The game lights its own scene — this rig is just for reference stills.

## Pipeline
Build at max detail in Blender → export GLB (`use_selection`, `+Y up`,
modifiers applied) → copy chosen GLBs into `public/models/` for the game.

**Workflow rules:**
- Every exported GLB is mirrored into `glb-backup/` (a safety copy kept
  separate from the working exports).
- Each asset lives in its own collection (`XWing`, `Spacecraft`, `Bodies`,
  `SmallBodies`). Before modelling a new object, isolate/clean its workspace so
  parts from one asset never leak into another's export selection.

## Texture reuse
Bodies reuse the existing `public/textures/*.webp` maps so game + site stay
visually consistent.
