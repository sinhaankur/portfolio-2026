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

- [x] **Step 5 — PlanetBody → `planet-body.tsx`** (776-line component → 1,054-line
      file). The biggest, most-interwoven renderer: surface textures + MOLA/LOLA
      displacement, day/night terminator, cloud + band shells, aurora, atmosphere
      glow, Saturn's ring system, moons, orbiters, orbital path. Done in two safe
      cuts: **5a** pulled the shared `OrbitRing` (used by planet + orchestrator)
      into its own tiny `orbit-ring.tsx` so there's no scene↔planet-body import
      cycle; **5b** moved the ring geometry/shaders + `SaturnRings` + `PlanetBody`.
      scene.tsx 6,187 → 5,118 lines (from 7,012 at session start — −27%).
      Build green + smoke clean + home & celestial render identically.
      Lesson logged: scan imports against the FULL export list, not a guess list —
      three sibling-file deps (`timeWarpRef`, `daysSinceJ2000`/`eccentricToTrue`/
      `solveKepler`/`moons`, `SatelliteField`) were caught by the build gate, not
      the pre-scan. The gate works; the pre-scan should be exhaustive.
- [x] **Step 6 — NamedBodyMesh + NamedBodies → `small-bodies.tsx`** (918-line
      component + its thin collection wrapper → 1,042-line file). The minor-body
      sub-engine: comets, asteroids, and spacecraft on real Kepler orbits (real
      elements → cartesian, log-curve diameter sizing, per-rock tumble, comet
      ion/dust tail + coma envelope). Moved the comet-tail scratch vectors
      (`_tailFrom`/`_tailTo`) in with it. scene.tsx 5,118 → 4,125 lines (−41%
      from the 7,012 session start). Build green + smoke clean + celestial render
      identical. Two build-gate catches (`getCometAffordance`/`getCometDynamicProfile`
      from ./celestial-sub-engine, `SPACECRAFT_SHAPES`, the tail scratch vectors)
      — reinforced the exhaustive-scan lesson; added a scene-module-const leak
      check to the pre-scan.
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
  orbit-ring.tsx      one planet's orbital path (shared)       [step 5a ✓]
  planet-body.tsx     one planet renderer                     [step 5b ✓]
  small-bodies.tsx    comets + asteroids                      [step 6 ✓]
  galaxy/nebula/…     the deep-space sub-engines              [step 7-8]
  scene.tsx           the ORCHESTRATOR — composes the above   [end state]
  hud.tsx / …         meaning layer (data → understanding)    [already separate]
```

Each file has ONE clear responsibility, small enough to read in a sitting.
Atomic-Design spirit for the engine = library-by-concern (sub-engines).
