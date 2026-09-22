# Neural rendering for the engines — scope (no build yet)

Ankur, 2026-09-15: "Neural Rendering" as a direction for the best/16K
experience. This is the scoping doc the backlog asked for — what's real,
what fits our constraints, what a pilot would look like. Decision is yours.

## The honest constraint set

- Static export on GitHub Pages: no server-side inference, ever.
- Truth floor (ENGINE-STANDARDS): positions/data stay ephemeris + SGP4 +
  catalogues. Neural techniques may only touch the APPEARANCE layer, and
  anything reconstructed must be labelled as reconstruction.
- Device range: phones to desktops; adaptive-quality controller already
  gates every cost knob. A neural tier must slot in as another gated knob.

## What actually fits (2026 state of the art)

**1. 3D Gaussian Splatting (3DGS) — the practical winner.**
- Runs TODAY in WebGL2 three.js (no WebGPU needed): mkkellogg/GaussianSplats3D,
  @playcanvas splat viewers; drei has community splat components. 60fps on
  mid hardware for 200k–1M splats.
- What it buys us: photoreal *captured* objects — a real scanned scene or a
  Blender-rendered synthetic capture (render 150–300 views of our own
  Cycles ISS/terrain → train a splat → ship it). Synthetic-source splats
  keep the attribution clean: our renders, our splat, © Ankur Sinha.
- Sizes: raw .ply splats are 50–250MB (no), but compressed formats are
  shippable: .splat ~15–40MB, SOGS/compressed ~4–12MB for a single object
  at good quality. R2 free tier (10GB, $0 egress) absorbs this easily as a
  CDN-only Ultra-tier asset (cdnOnlyAsset path already exists).
- Where it shines here: ONE hero object per scene, not whole skies —
  e.g. a photoreal ISS close-up tier (swap the GLB when within N spans on
  ultra tier), or a Mars-terrain vignette in /lab/terrain.

**2. NeRF (classic neural radiance fields) — not yet.**
Real-time NeRF in-browser still needs WebGPU + heavy VRAM; quality/perf is
dominated by 3DGS for our use case. Skip.

**3. "Neural upscaling" (DLSS-style) — not applicable.**
Browser has no vendor upscalers; TAA/upscale tricks are shader work, not
neural. Our resolution picker already covers the texture axis (16K tier).

## Recommended pilot (smallest honest slice)

**Splat-ISS Ultra tier**: Blender Cycles renders of our existing detailed ISS
(build_iss_detailed.py) from ~200 orbit views → train 3DGS offline (nerfstudio
or OpenSplat, local M-series is fine) → compress (SOGS) → host on R2 →
load via GaussianSplats3D ONLY when (a) resolution=ultra, (b) craft is the
selected follow target, (c) desktop tier. Fallback stays the GLB. Labelled
"reconstruction from our renders" in the inspector.

- Effort: ~1 session capture+train, ~1 session integration.
- Risk: renderer coexistence (splat pass vs R3F scene ordering/depth) — known
  solvable; the viewer libs support three.js scene integration.
- Kill criterion (same rule as the black-hole raymarch trial): if it doesn't
  beat the GLB on looks at equal frame budget, revert and keep the doc.

## Open questions for Ankur

1. Pilot target: ISS close-up, Mars terrain vignette, or a /waves ocean still?
2. Does "neural" here also mean the GAME (Helion) — e.g. a splat skybox?
3. Budget gate: cap Ultra splat downloads at ~10MB per object?
