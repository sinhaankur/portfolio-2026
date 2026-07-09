# Universe Engine — scene.tsx refactor plan

**Goal:** break the ~7,000-line `scene.tsx` god-file into small, focused
libraries (sub-engines), so any part is readable and editable on its own —
the "tomorrow I can read and edit it" test. Lean coding: extract once, then
update the library, not the god-file.

**Method (non-negotiable — this is a *working* engine):** one component/concern
per step, each step **byte-identical** where possible, and **each step must
`pnpm build` green + render clean** before the next. Verify, commit, continue.
A failed boundary (e.g. accidentally swallowing an import/type) → revert the
step and redo with the correct boundary. Never batch risky cuts.

## Progress

- [x] **Step 1 — Shaders → `shaders.ts`** (commit 6daa03e). All 20 body shaders
      (corona, sun, day/night, cloud, aurora, bands, nebula, atmos, comet) +
      the galaxy shaders now live in one library. −549 lines from scene.tsx.
- [x] **Step 2 — Shared scratch-vector pool → `scene-shared.ts`** (commit b71dc7b).
      The reused temp `Vector3`s (`_earthWorldPos`, `_sunWorldPos`, `_sunDirTmp`,
      `_tmpAxis`) — one canonical pool every sub-engine imports.
- [x] **Step 3 — Shared render components → `scene-satellites.tsx`.** The two
      "things around a body" concerns needed by BOTH the moon and planet
      renderers, moved out ahead of the big components (correct dependency
      order): `SatelliteShells` + `SatelliteShellPoints` + `HeroSatellite` +
      the `SATELLITE_CATALOG`/`HERO_CRAFT` data tables + the `SatelliteShell`
      type, and the surface-pin `RoverPin`. −546 lines from scene.tsx
      (7,012 → 6,466). Build green + smoke test clean + celestial render clean.

- [x] **Step 4 — MoonBody → `moon-body.tsx`** (283 → 336-line file). The moon
      sub-engine: one natural-satellite renderer (day/night phase shader, LOLA
      relief, landing-site pins, orbiter shell). Imports `RoverPin` +
      `SatelliteShells` from `./scene-satellites`, the day/night shader from
      `./shaders`, the scratch pool from `./scene-shared`. scene.tsx
      6,466 → 6,187 lines. Build green + smoke clean + home engine renders
      (zero console errors). Also swept up two now-orphaned type imports
      (`MoonData`, `SurfaceFeature`).

## Next steps (big components — now that shared primitives are importable)

- [ ] **Step 5 — PlanetBody → `planet-body.tsx`** (~776 lines). The planet
      renderer (textures, MOLA displacement, day/night, clouds, aurora, rings).
- [ ] **Step 6 — NamedBodyMesh → `small-bodies.tsx`** (~918 lines). Comets
      + asteroids (tails, envelope, tumble, diameter sizing).
- [ ] **Step 7 — Galaxy/Nebula/BlackHole detail → their own files**
      (GalaxyDetail ~523, NebulaDetail ~215, BlackHoleDetail ~194).
- [ ] **Step 8 — MilkyWay + SkyPointMesh + ConstellationStarMesh → sky files.**
- [ ] **Step 9 — What remains in scene.tsx = the orchestrator** (`SolarSystem`,
      `SceneContents`, `FlyToController`, `SceneClock`) — the thin composition
      layer that wires the sub-engines together. This is the end state: scene.tsx
      becomes a readable ORCHESTRATOR, not a god-file.

## End-state structure (the "good structure")

```
universe-engine/
  astronomy.ts        truth spine — data + math (no React)   [already clean]
  shaders.ts          ALL engine GLSL                        [step 1 ✓]
  scene-shared.ts     temp-vector pool + small shared helpers [step 2 ✓]
  scene-satellites.tsx orbiters + hero craft + surface pins  [step 3 ✓]
  moon-body.tsx       one moon renderer                       [step 4 ✓]
  planet-body.tsx     one planet renderer                     [step 5]
  small-bodies.tsx    comets + asteroids                      [step 6]
  galaxy/nebula/…     the deep-space sub-engines              [step 7-8]
  scene.tsx           the ORCHESTRATOR — composes the above   [end state]
  hud.tsx / …         meaning layer (data → understanding)    [already separate]
```

Each file has ONE clear responsibility, small enough to read in a sitting.
Atomic-Design spirit for the engine = library-by-concern (sub-engines).
