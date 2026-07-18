# Satellite asset program — one craft at a time, max detail

The /lab/celestial swarm classifies every catalog object into an archetype
(`satellite-field.tsx` → `selectedArchetypeRef`), renders a procedural shape by
default, and swaps in a real Blender GLB on selection (the ISS and LEOPARD
CubeSat already do this). This is the build list for the rest — ordered by how
often each appears in the conjunction screening results, because those are the
craft people will actually fly to now.

Pipeline per asset (matches the ISS build, craft 1):
Blender (headless, real dimensions from public references) → GLB →
`public/models/` → wire in the archetype→GLB map on select. Real proportions
from published spec sheets/imagery only — no guessed geometry.

## Build order

| # | Asset | Why / where it shows | Real-world reference | Status |
|---|-------|----------------------|----------------------|--------|
| 1 | **Starlink v2 Mini** | Dominates the catalog (~7k) AND the conjunction list | Flat-pack bus ~2.7×1.4 m, TWO 12.8 m solar wings, argon Hall thrusters | TODO — next craft |
| 2 | **Starlink v1.5** | The earlier shells, still thousands on orbit | Flat bus, SINGLE solar wing (the classic "flying panel") | TODO |
| 3 | **OneWeb** | Second mega-constellation, 1,200 km shell | Compact boxy bus, two small square wings, ~150 kg | TODO |
| 4 | **Kuiper** | Newest constellation, already in the top conjunctions | Ka-band flat panel bus (public imagery is limited — model conservatively, label as approximate) | TODO |
| 5 | **Iridium NEXT** | Famous constellation, polar shell, historic collision family | Distinctive slanted L-band panel + two wings, ~860 kg | TODO |
| 6 | **GPS III** | The navigation layer everyone actually uses | Big single-body bus + two 4-panel wings | TODO |
| 7 | **Falcon 9 second stage** | The most common ROCKET BODY in the R/B class | 3.7 m Ø cylinder, MVac bell, ~12 m | TODO |
| 8 | **Generic EO bus (Sentinel-class)** | Covers the many single-payload earth observers | Rectangular bus + single wing + telescope baffle | TODO |
| 9 | **Debris fragment set** | DEB class (Fengyun-1C, Cosmos-2251, Iridium-33 families) | Irregular shards — upgrade the existing `debris.glb` with a 3-variant set | exists, upgrade |

## Already built

- **ISS** — `public/models/iss.glb` (craft 1: 8 wings in 4 pairs, module stack,
  radiators, docked Soyuz/Dragon)
- **LEOPARD CubeSat** — select-swap already wired (the archetype program's proof)
- **satellite-telescope / satellite-station** — generic archetypes in
  `blender/space-assets/`

## Rules

- Headless Blender via the project pipeline (blender-* skills); real dimensions
  from published references; bake textures, keep GLBs lean (≤ ~300 KB each —
  these swap in at close range only).
- Where the real design is not public (Kuiper), model the known envelope and
  say "approximate" in the archetype label — never present a guess as the
  real craft.
- One at a time, finished properly, wired into the select-swap before starting
  the next.
