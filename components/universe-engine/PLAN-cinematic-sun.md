# Plan — Cinematic focus-tier for the Sun

> **Goal:** close the gap between "truthful" and "the jaw-dropping look people
> imagine" — a Sun that churns with supergranulation, edge prominences, and real
> differential rotation *when you fly to it* — without paying that cost when it's
> a background disc. Additive fidelity, focus-gated, GLSL-first. Nothing changes
> at idle/far; the expensive shader only runs on the focused Sun.

## Why (context)
The built-vs-blob audit proved the engine is real, not faked. The remaining gap
isn't blobs — it's that the "cinematic space-render" look is hard on a live site
(no path-tracing, 60/30fps budget, no render farm). The strategy is a **focus-gated
cinematic tier**: cheap when idle, expensive only for the one focused body.

## Current state (verified)
- Sun surface shader: `shaders.ts:104-178` — samples a baked Blender photosphere
  (`uSunTex`), light `vnoise` shimmer, limb darkening, honest `uLifeStage` tint.
- Uniforms: `scene.tsx:703` `sunSurfUniforms` (`uTime`/`uSunTex`/`uIntensity`/`uLifeStage`),
  per-frame `uTime` update near `scene.tsx:806`, material ref `sunSurfMatRef`,
  mesh ref `sunSurfMeshRef`, real rotation `sunRotSpeed` (`scene.tsx:747`).
- Focus signal: `planet:Sun` handler flies to distance **3.2** (`scene.tsx:724-737`).
  We already know the Sun's world position each frame via `sunSurfMeshRef`.

## Change set

### 1. Shader — add a focus-gated cinematic layer (`shaders.ts`)
Extend `SUN_SURFACE_FRAGMENT_SHADER` with new uniforms and a branch that only does
work when `uFocus > 0`:
- `uniform float uFocus;`  // 0 = far (current cheap path), 1 = fully flown-in
- **Supergranulation:** domain-warped **curl-noise FBM** (2–3 octaves) modulating
  the baked texture's brightness — real convection-cell scale (~1000 km cells →
  fine; supergranules ~30000 km → coarse). Mix in by `uFocus` so far view is
  untouched.
- **Limb prominences:** at the disc edge (`mu` near 0), add emissive red-orange
  arcs from a second animated noise band — the classic solar-prominence ribbons.
  Amplitude scales with `uFocus`.
- **Differential rotation:** offset the noise domain's angular term by latitude
  (equator faster than poles) — real solar behaviour, cheap in-shader.
- Keep everything multiplied by `uFocus` so the frozen-far look is byte-identical
  to today; **Truth pillar:** color stays anchored to the 5772 K photosphere, all
  motion driven by real rotation (25.4 d) and real active-region latitudes.

### 2. Uniforms + per-frame gate (`scene.tsx`)
- Add `uFocus: { value: 0 }` to `sunSurfUniforms` (`scene.tsx:703`).
- In the per-frame block near `scene.tsx:806`, compute camera→Sun distance from
  `sunSurfMeshRef` world position vs `camera.position`; map distance to a smooth
  `0..1` (e.g. `smoothstep(farD, nearD, dist)`, nearD≈3.2 to match the fly-to,
  farD≈12) and **lerp** `uFocus.value` toward it (no snap). This is the same
  distance-detail idea as `focusDepthRef`/`detailActive` used elsewhere.

### 3. (Optional, phase 2) Bake a better base map in Blender
If the procedural tier wants a richer base, bake a higher-detail equirectangular
photosphere + a separate **flow map** in Blender (existing pipeline: textures in
`/public/textures`) and sample it under `uFocus`. Not required for phase 1.

## Standards check
- **Truth:** all motion from real rotation/latitude; color from real T_eff; no
  invented flares tied to fake dates. ✓
- **Performance:** zero added cost at idle/far (everything gated by `uFocus`);
  extra octaves run only on the single focused Sun. ✓
- **Presentation:** prominences confined to the limb, won't bleed into corona
  shells (corona is separate additive geometry). ✓
- **Robustness:** if `uSunTex` fails, the procedural layer still renders (no hard
  dependency). Static-export safe (client-only shader). ✓

## Verification
1. `pnpm build` — clean static export.
2. `pnpm lint` — stay at 0 errors.
3. Headless: `pnpm test:site` (serve `out/` first) — no console errors, Sun route ok.
4. Visual on a real GPU: home hero + fly to the Sun (`planet:Sun`). Confirm:
   - far view identical to today (no perf/visual change),
   - flying in reveals churning granulation + limb prominences that ramp smoothly,
   - fps holds ≥60 desktop / ≥30 mobile while focused (mobile: cap octaves via the
     existing perf tier).
5. Scrub the Sun-history timeline — `uLifeStage` tint still composes correctly with
   the new `uFocus` layer (giant/dwarf phases unaffected at far view).

## Out of scope (future additive targets)
Gas-giant flow-map storms (Jupiter GRS), volumetric aurora reuse, Earth cinematic
tier — each a separate focus-gated pass following this same pattern.
