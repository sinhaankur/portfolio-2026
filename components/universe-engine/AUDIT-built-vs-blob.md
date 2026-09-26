# Universe Engine — Built vs. Blob audit

> Segment-by-segment audit (2026-09-26) grading each sub-engine as **BUILT**
> (real, data-driven, working, honest) vs. **BLOB** (placeholder, faked,
> unfinished, or dead weight) against the five pillars in `ENGINE-STANDARDS.md`.
>
> **Headline:** the engine is overwhelmingly BUILT. No faked data, no dead code,
> no bodies rendered as generic stand-ins where real parameters exist. The only
> findings are minor classification/honesty polish, not blobs.

## Method
- Segments = the six sub-engines named in `ENGINE-ARCHITECTURE.md` (Planet, Star,
  Black-hole, Nebula, Galaxy, Sub-system) + the shared truth spine (`astronomy.ts`).
- For each: verify the data source is real & cited, verify the render is driven by
  that data (not a generic stand-in), verify unknowns are labelled not invented,
  check for dead/unused code.

## Segment matrix

| Segment | Verdict | Evidence |
|---|---|---|
| **Truth spine** (`astronomy.ts`, 115 bodies) | ✅ BUILT | 115 bodies with `aAU`; 79 `periodDays`, 71 `eccentricity`, real J2000 elements. Bodies without a period are surface features / rovers / spacecraft that legitimately have no heliocentric orbit — not placeholders. |
| **Planet engine** | ✅ BUILT | 30 real texture refs (`/textures/*.webp` + `.ktx2`), day/night shader, atmosphere, real tilt/period. No grey stand-in where a texture exists. |
| **Star engine** | ✅ BUILT | `lib/data/bright-stars.ts` = HYG v3.7 (public domain), mag ≤ 6.5, **8,920 stars**; colours from B-V index, sizes from apparent magnitude. 358 NAMED_STARS. |
| **Black-hole engine** | ✅ BUILT | `blackhole.glb` + GLSL jets sized by real `massSolar`/`spin`. Reverted raymarcher is **NOT** in the tree (0 `raymarch`/`geodesic` refs in `black-hole.tsx`) — lives only at commit 3c54d13e as documented. |
| **Nebula engine** | ✅ BUILT | 6 real volumetric configs (M42/M16/Carina/M8/M57/M20) with real Hα/O-III colour science; Helix has a bespoke Blender GLB for its double-ring; nebulae without a config keep an honest procedural shell — inference stops at the data. |
| **Galaxy engine** | ✅ BUILT | `DEEP_SKY_CATALOG` = **579 objects from OpenNGC (MIT)**. `classifyMorphology()` maps real Hubble types → form; inclination from measured axis ratio; unknown type → plain halo (no invented shape). 9 bespoke hand-tuned models win on merge. |
| **Sub-system engine** | ✅ BUILT (1 flag) | 14 exoplanet-hosts; **13 have real `planets[]`** (TRAPPIST-1 = 7 real planets, Kepler-186, etc.). See finding F1. |
| **Dead code** | ✅ NONE | Every engine file is imported somewhere; no orphaned modules. |

## Findings (polish, not blobs)

### F1 — Tabby's Star: honest data, over-promising `kind` — ✅ FIXED (2026-09-26)
`astronomy.ts:3291` — Tabby's Star (KIC 8462852) was `kind: "exoplanet-host"` but has
**no `planets[]`** — correctly, because it has *no confirmed planets* (the dimming is
unexplained). The `ExoplanetSystem` mount is already guarded by `point.planets &&`
(`scene.tsx:1484`) so no empty annulus rendered — the only issue was the InfoPanel
labelling it an exoplanet-host.
**Fix applied:** retagged as `kind: "star"` (it already renders as a famous star),
added `shade` (F3 V/IV yellow-white) and the F-class designation, and sharpened the
fact to state it has NO confirmed planets despite intense scrutiny — turning the flag
into a teaching moment.

## What was checked and is explicitly fine
- The dozens of `fake`/`invent`/`guess`/`placeholder` matches in the code are almost
  all **comments asserting the engine does NOT do these things** (a running honesty
  ledger), not actual fakery.
- The 27 MB of terrain height PNGs and the 5.9 MB web-llm chunk (from the earlier
  perf pass) are irreducible truth-data / correctly lazy-loaded — out of scope here.

## Recommendation
No blob removal needed. The single actionable item is **F1** (Tabby's Star kind).
Everything else is built to the standard. If we want a "next-level" pass, it's
*additive fidelity* (more volumetric nebulae, more bespoke galaxy models, more
exoplanet systems) — not blob cleanup.
