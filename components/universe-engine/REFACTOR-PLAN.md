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

## Next steps (ordered: shared primitives first, then big components)

- [ ] **Step 2 — Shared primitives → `scene-shared.ts`.** The small helpers used
      across many components must move FIRST so the big components can then
      import them cleanly:
      - the temp-vector pool (`_tmpAxis`, `_earthWorldPos`, `_sunWorldPos`,
        `_sunDirTmp`, …) — scattered at L1943, L3854-3856
      - `RoverPin` component (L2579)
      - shared types already in `./types` (HoverHandler etc. — leave there)
      - `latLonToVec3` and any other pure geometry helpers
- [ ] **Step 3 — MoonBody → `moon-body.tsx`** (~301 lines, L902). Now cleaner
      once shaders + shared primitives are importable. We just worked here (LOLA).
- [ ] **Step 4 — PlanetBody → `planet-body.tsx`** (~776 lines, L2684). The planet
      renderer (textures, MOLA displacement, day/night, clouds, aurora, rings).
- [ ] **Step 5 — NamedBodyMesh → `small-bodies.tsx`** (~918 lines, L3900). Comets
      + asteroids (tails, envelope, tumble, diameter sizing).
- [ ] **Step 6 — Galaxy/Nebula/BlackHole detail → their own files**
      (GalaxyDetail ~523, NebulaDetail ~215, BlackHoleDetail ~194).
- [ ] **Step 7 — MilkyWay + SkyPointMesh + ConstellationStarMesh → sky files.**
- [ ] **Step 8 — What remains in scene.tsx = the orchestrator** (`SolarSystem`,
      `SceneContents`, `FlyToController`, `SceneClock`) — the thin composition
      layer that wires the sub-engines together. This is the end state: scene.tsx
      becomes a readable ORCHESTRATOR, not a god-file.

## End-state structure (the "good structure")

```
universe-engine/
  astronomy.ts        truth spine — data + math (no React)   [already clean]
  shaders.ts          ALL engine GLSL                        [step 1 ✓]
  scene-shared.ts     temp-vector pool + small shared helpers [step 2]
  moon-body.tsx       one moon renderer                       [step 3]
  planet-body.tsx     one planet renderer                     [step 4]
  small-bodies.tsx    comets + asteroids                      [step 5]
  galaxy/nebula/…     the deep-space sub-engines              [step 6-7]
  scene.tsx           the ORCHESTRATOR — composes the above   [end state]
  hud.tsx / …         meaning layer (data → understanding)    [already separate]
```

Each file has ONE clear responsibility, small enough to read in a sitting.
Atomic-Design spirit for the engine = library-by-concern (sub-engines).
