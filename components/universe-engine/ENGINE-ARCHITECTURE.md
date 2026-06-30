# Universe Engine — Architecture (sub-engines)

> Companion to [`ENGINE-STANDARDS.md`](./ENGINE-STANDARDS.md). That file is the
> *bar* (what "good" means); this file is the *shape* (how the pieces fit).

The Universe Engine is one orchestrator composing a family of **domain
sub-engines** — each owns a class of objects: its data, its rendering, and its
level-of-detail / focus behaviour. Today these live as component groups inside
`scene.tsx` driven by one data spine (`astronomy.ts`); this document names them as
sub-engines so the model is explicit and can be migrated toward a registry safely.

```
                 ┌───────────────────────────────────────────┐
                 │            UniverseEngine (index.tsx)        │
                 │  Canvas · OrbitControls · camera · HUD        │
                 │  intro/ready · scale mode · time scrubber     │
                 └───────────────┬──────────────────────────────┘
                                 │ composes <SceneContents/> (scene.tsx)
   ┌──────────────┬──────────────┼──────────────┬──────────────┬──────────────┐
   ▼              ▼              ▼              ▼              ▼              ▼
 Planet         Star          Black-Hole      Nebula         Galaxy        Sub-system
 engine         engine        engine          engine         engine        engine
```

All of them read the **truth spine** — `astronomy.ts` (real data + math, no React):
J2000 epoch, `meanAnomalyAt` → `solveKepler` → `eccentricToTrue`, `raDecToScenePos`,
`schwarzschild/kerr…`, `compressRadius` (scale mode), `simTimeRef` clock.

---

## The orchestrator — `UniverseEngine` (`index.tsx`)
Owns the `<Canvas>`, `OrbitControls`, camera (near/far/maxDistance), the cinematic
intro (waits for `universe-ready`), the scale-mode toggle (`scaleModeRef`), the
time scrubber, music, and the HUD overlay. It mounts `<SceneContents>` and routes
focus/fly-to + hover up to the HUD. Per-frame time advances via `SceneClock`.

## Planet engine
**Data:** `PLANETS` / `MOONS` in `astronomy.ts` (real aAU, tilt, period, m0Deg…).
**Render (`scene.tsx`):** `SolarSystem` → `PlanetBody` (grey + textured globe,
day/night shader, atmosphere shell, drifting bands, clouds, aurora), `MoonBody`,
`OrbitRing` (live-rescaled by scale mode), `SaturnRings`, `RoverPin` (surface
features), `Belt` / `BeltAsteroids`, `SatelliteShells` / `HeroSatellite`.
**LOD/focus:** positions are pure fns of `simMs`; detail (clouds/atmos/aurora/pins)
fades in on hover/focus (`detailActive`); deep-zoom near-plane via `focusDepthRef`.

## Star engine
**Data:** `lib/data/bright-stars.ts` — 8,920 HYG stars (POSITIONS/COLORS/SIZES/
MOTION) + 358 `NAMED_STARS` (name, mag, distance, spectral, HR/HD); constellation
stars from `constellations`.
**Render:** `BrightStarField` (GPU point cloud, proper-motion, twinkle, diffraction
spikes), `NamedStarHoverLayer` (interactive named stars), `BrightStarPicker`
(every un-named star inspectable, honest data), `NearbyStars3D` (named stars in
TRUE 3D heliocentric depth), `Constellations` → `ConstellationStarMesh` /
`AsterismLine` (with real-fact + inferred-character exploration).
**LOD/focus:** mobile keeps the brightest subset; nearby-stars desktop-only.

## Black-hole engine
**Data:** black-hole `SkyPoint`s (Cygnus X-1, Sgr A*, M87*, TON 618, Phoenix A…)
with real `massSolar` + `spin`.
**Render:** a baked `blackhole.glb` mesh (`useGLTF` + `<Clone>`, Suspense-wrapped)
for the lensed horizon, plus GLSL `BlackHoleJets`, sized by
`computeBlackHoleProportions` (real Schwarzschild/Kerr horizon → log-scaled visual:
stellar ≈ 0.75× → supermassive ≈ 1.45×). Photon ring, lensed halo, accretion disk,
frame-dragging jets — Interstellar-grade. This is the showcase case where a baked
mesh carries detail a shader can't at close zoom. **Liked as-is; don't change
without cause.**

## Nebula engine
**Data:** nebula `SkyPoint`s (M42, M16, Carina, M57, M1, Helix…) at real RA/Dec.
**Render:** `SkyPointMesh` chooses: `VolumetricNebula` (raymarched 3D gas — cloud
or ring/shell mode, per-nebula palette in `VOLUMETRIC_NEBULAE`) for the showcase
nebulae; baked sprite (`NEBULA_SPRITES`, radial-masked `GalaxySprite`) for M42's
far LOD; `NebulaDetail` cloudlets on hover; soft halo otherwise.

## Galaxy engine
**Data:** galaxy `SkyPoint`s (M31, M33, M51, M101, M104, LMC, SMC…) + curated facts.
**Render:** `Galaxy3D` — a true 3D particle disc (arms + bulge + thickness) tilted
to inclination, real relative `scale` (M31 largest). Config in `GALAXY_3D`.
`GalaxyDetail` for the focused bloom. The home Milky Way is its own big
`MilkyWay` point-field + `NebulaClouds` (gas + dust lanes).

## Sub-system engine (divable stars)
**Data:** `exoplanet-host` `SkyPoint`s with `planets[]` (TRAPPIST-1: 7 real planets;
Kepler-186…).
**Render:** `ExoplanetSystem` — on focus, the host star glow + habitable-zone
annulus + planets orbiting at real relative periods. This is the **per-star
sub-engine**: any star with system data becomes divable. `celestial-sub-engine.ts`
is the related standalone path (the `/lab/celestial` solar-system explorer).

---

## Depth & scale (shared)
- Every object sits at real RA/Dec; deep-sky objects spread by **real distance**
  (`skyDepthRadius`) so the field parallaxes — true 3D, no flat shell.
- Scale is a **mode** (`scaleModeRef: explore | true`); `compressRadius` +
  `OrbitRing` live-rescale honour it. `NearbyStars3D` uses a light-year scale.

## Migration note (toward a real registry)
A future refactor can formalise each sub-engine as a registered module:
`{ id, data, <Render/>, lod(focus), hitInfo(point) }`, with the orchestrator
iterating the registry instead of hard-coding the component list in `scene.tsx`.
Do this incrementally (one domain at a time, behind tests/visual checks) — the
6,800-line `scene.tsx` is working and beloved; don't big-bang it. This doc is the
target shape; the standards file is the bar every step must still clear.
