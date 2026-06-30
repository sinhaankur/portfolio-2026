# Universe Engine — Standards

> **True north:** restore the real sky most people have lost — faithfully and
> understandably. Reverence over spectacle. Real over invented. *Understanding is
> the product; the spectacle is only the on-ramp.*
>
> **Litmus test for any change:** does it make the real universe more **truthful**
> AND more **comprehensible** to a person looking up? If it's only prettier, it's
> optional. If it bends the truth for effect, it's out.

Every change to this engine is held to the five pillars below.

## 1. Truth (non-negotiable)
- Every body's position is a **pure function of the simulation date** (J2000 epoch
  anchors + Kepler: `meanAnomalyAt` → `solveKepler` → `eccentricToTrue`). Scrub to
  any date and the sky is genuinely where it was / will be.
- **Real values only** — AU, axial tilts, J2000 RA/Dec, masses, periods. Sourced
  (NASA/JPL/ESA/HYG/SIMBAD) or not shown.
- **Build each body from its KNOWN data — be exact.** A body's measured physical
  state drives how it's rendered: a star's spectral type / temperature / radius /
  composition (e.g. a helium-burning giant) determines its colour, size, and
  behaviour; a planet's real albedo/atmosphere/tilt drive its look. Don't render a
  generic stand-in when the real parameters exist.
- **Never invent events** — no synthetic collisions, near-misses, or "what-if"
  states. The engine models real state.
- **Honest about the unknown** — surface only fields we actually have; where data
  genuinely isn't known (e.g. most constellation stars' detailed composition),
  present a clearly-LABELLED inference, never a guess dressed as measured fact.

## 2. Performance
- 60 fps on a modern laptop; **≥30 fps on mobile**. Off-screen Canvas pauses via
  IntersectionObserver; SceneClock delta clamped so resume doesn't snap.
- First paint is **not blocked** by the ~800 KB R3F chunk — `<StaticStarfield>`
  covers the lazy-load; the cinematic intro waits for the `universe-ready` event.
- Mobile DPR capped (≈[1, 1.5]); reduced star/nebula counts on mobile.
- **Texture budget:** no texture heavier than its visual need. 2048×1024 webp at
  ~q60–75 (~100–350 KB). Re-check any new/updated texture against this.

## 3. Presentation fidelity
- **No visual collisions** — halos / glows / jets / atmospheres must not bleed
  into neighbouring bodies. Favour brightness over girth for findability.
- Consistent HUD type ramp + units; tabular numerals for data.
- Reads cleanly in **every state** (idle, hover, deep-zoom) on **phone + desktop**
  (≤640px verified). No hover-only affordances.
- Reverence over spectacle: detail serves awe + understanding, not flash (e.g. the
  aurora is subtle, night-side, polar — where it's real).

## 4. Robustness
- **Graceful degradation:** WebGL unavailable → `<StaticStarfield>`; a texture that
  fails to load → procedural fallback (e.g. `uHasTex` flag on the nebula shader).
- **Zero runtime errors** in any state. Every async asset has a fallback.
- **Static-export safe** — the engine is client-only (`ssr: false`); never add
  server-component data fetching that breaks `output: "export"`.
- **GLSL-first, with curated GLB LODs.** The field — stars, nebulae, galaxies,
  atmospheres, the spiral arms — is pure GLSL; that's the default and the bulk of
  the engine. A small, curated set of bodies use a baked GLB mesh where a shader
  can't carry the detail at close zoom: the black hole (`blackhole.glb`), belt
  rocks (asteroid/comet nuclei), and the hero satellites. Each GLB is `useGLTF`-
  preloaded and wrapped in `<Suspense fallback={null}>` so a load failure degrades
  to empty, never to a crash. **Rule:** reach for GLSL first; add a GLB only when
  it earns its bytes at deep-zoom, and keep it on the curated list — don't let the
  point-field/nebula/galaxy layers drift into meshes. Blender bakes both the
  textures in `/public/textures` and these few meshes in `/public/models`.

## 5. Accessibility & polish
- `prefers-reduced-motion` respected (intro + animations).
- Keyboard + touch reachable; focus-visible rings on interactive HUD controls.
- No layout/overlap collisions; safe-area insets honoured.

---
*Architecture:* `astronomy.ts` is the **truth spine** (data + math, no React/R3F).
`scene.tsx` + `shaders` are the **render layer** (GLSL). `hud.tsx` / InfoPanel /
hover layers are the **meaning layer** (data → understanding). Scale is a **mode**
(`scaleModeRef: "explore" | "true"`), not a constant — keep `compressRadius`.
