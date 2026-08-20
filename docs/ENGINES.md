# The three engines — system map

How the **Universe Engine**, **Satellite Engine**, and **Terrain Engine** relate.
This is the map (how the pieces fit across the whole site); the per-engine depth
lives in [`components/universe-engine/ENGINE-ARCHITECTURE.md`](../components/universe-engine/ENGINE-ARCHITECTURE.md)
(the sub-engine shape) and [`ENGINE-STANDARDS.md`](../components/universe-engine/ENGINE-STANDARDS.md)
(the bar every change clears).

> **One-line summary:** the Universe Engine is the reusable core; the Satellite
> Engine is a UI wrapper around it; the Terrain Engine is a deliberately separate
> sibling. All real-space views share one truth spine, `astronomy.ts`.

---

## The shape

```
                         astronomy.ts  ← the TRUTH SPINE
              (pure data + math, no React/R3F, 3,503 lines)
        J2000 epoch · Kepler · real AU/tilt/RA·Dec · simTimeRef clock
        imported by ~30 files · positions = pure fn of simMs
                                 │
        ┌────────────────────────┼─────────────────────────┐
        ▼                        ▼                          ▼
┌──────────────────┐   ┌──────────────────┐     ┌────────────────────┐
│ UNIVERSE ENGINE  │   │ SATELLITE ENGINE │     │  TERRAIN ENGINE    │
│ the reusable core│   │ a UI WRAPPER     │     │  a SEPARATE sibling│
│ components/       │   │ components/      │     │  components/terrain│
│   universe-engine│◄──│   celestial      │     │  + lib/terrain     │
│ ~26.7k lines     │   │ ~5.5k lines      │     │  ~1.8k lines       │
│ <UniverseEngine/>│   │ mounts the core, │     │  own canvas + own  │
│                  │   │ adds SSA panels  │     │  displaced-sphere  │
└──────────────────┘   └──────────────────┘     │  shader (no core)  │
        │                                        └────────────────────┘
        │ the SAME <UniverseEngine/> is mounted across many surfaces:
        ▼
  hero.tsx · sky · story · localized-home · /tv · /lab/helion-drift ·
  /lab/celestial (Satellite Engine)
```

---

## 1. Universe Engine — the core (`components/universe-engine/`)

The heart. A self-contained R3F module exposed as one component:
`<UniverseEngine interactive showHud showMusic … />`. Consumers mount it and
pass props; nothing else.

- **Entry:** `index.tsx` — owns the `<Canvas>`, OrbitControls, camera, cinematic
  intro, scale-mode toggle, time scrubber, HUD. Composes `<SceneContents>` (`scene.tsx`).
- **Truth spine:** `astronomy.ts` — real data + math, **no React/three imports**
  (verified). Every body's position is a pure function of `simTimeRef.simMs`.
- **Sub-engines** (real, separate files — not aspirational): `planet-body.tsx`,
  `moon-body.tsx`, `small-bodies.tsx` (comets/asteroids/spacecraft), `belt.tsx`,
  `black-hole.tsx`, `nebula.tsx`, `galaxy.tsx`, `constellations.tsx`, the star
  fields, `satellite-field.tsx` (the ~18k live SGP4 swarm).
- **Render layer:** `shaders.ts` + the per-body components (GLSL-first; a curated
  few GLBs — black hole, hero craft, belt rocks — see STANDARDS §4).
- **Reused across the site** — mounted in `hero.tsx`, `/sky`, `/story`,
  `localized-home`, `/tv`, `/lab/helion-drift`, and the Satellite Engine. Props
  (`interactive`, `showHud`, `solarOnly`, `minimalControls`, `realtime`, …) tune
  it per surface. **This is why it must stay a clean component, not a page.**

## 2. Satellite Engine — a UI wrapper (`components/celestial/`)

`/lab/celestial` → `CelestialExplorer`. It **mounts `<UniverseEngine … solarOnly>`**
and layers space-situational-awareness UI on top: the satellite search, ISS
passes, conjunction screening, orbital census, re-entry watch, transfer/porkchop,
imagery/APOD, and the AI copilot (`components/assistant`). It reuses the core's
refs (`satellite-refs`, `astronomy`) — it does **not** fork the engine.

Think of it as: *the Universe Engine, focused on Earth orbit, with SSA tools and
a copilot bolted around it.* Shareable deep-links: `?focus=<pointId>&date=…`.

## 3. Terrain Engine — a separate sibling (`components/terrain/` + `lib/terrain/`)

`/lab/terrain` → `TerrainExplorer` → `TerrainEngine`. **Deliberately standalone:**
its own `<Canvas>`, its own `terrain-shaders.ts` (a displaced-sphere vertex shader),
its own truth table `lib/terrain/bodies.ts`. It does **not** import the Universe
Engine's `scene.tsx` or planet renderer.

Why separate: a full quadtree terrain-LOD system inside the 6.8k-line `scene.tsx`
would have been high-risk; isolating it keeps the core stable and lets terrain
iterate freely. It still honours the same conventions (real DEM ranges, lat/lon,
GLSL-first, honesty labels). Shareable deep-links: `#body/region`
(e.g. `#mars/valles-marineris`). Heavy DEM/tiles served from R2.

**The one seam:** there are now *two* ways a planet gets drawn (the orbital
planet-body vs. the terrain displaced-sphere). That's fine today — they're used in
different contexts. It would only need bridging if you ever want a single
continuous "orbit → descend to the surface" camera move.

---

## Reference catalog (not an engine)

`/reference/spacecraft` (`components/spacecraft/`) is a browsable catalog, not a
live engine. It **reuses the engine's GLB meshes** (`lib/spacecraft-catalog.ts`
points at the same `/models/*.glb`), so the catalog and the engines share one
source of truth for what each craft looks like.

---

## Health assessment (2026-08-20)

**The architecture is sound — no rewrite needed.**
- ✅ Shared truth spine, genuinely React/R3F-free, imported by ~30 files.
- ✅ Sub-engine decomposition is real (separate files), `scene.tsx` orchestrates.
- ✅ Clean layering: core component · UI wrapper · separate terrain sibling.
- ✅ Static-export safe throughout (client-only, graceful WebGL fallback).

**Watch (not broken, just large):** `astronomy.ts` (3.5k) and `satellite-field.tsx`
(2.4k) are the files most likely to get hard to change. Split incrementally behind
existing exports *if* a change gets painful — don't big-bang it (per
ENGINE-ARCHITECTURE.md: "working and beloved").

**Adding things stays a one-file edit:** a new body → `astronomy.ts` (or
`lib/terrain/bodies.ts` for terrain); a new SSA tool → a panel in
`components/celestial/`; a new craft mesh → `/models` + the relevant map.
