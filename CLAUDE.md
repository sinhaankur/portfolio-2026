# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

The **live site** is a Next.js 16 / React 19 / Tailwind v4 portfolio that lives
**at the repository root**. The Next.js App Router is in [`app/`](./app); shared
React components are in [`components/`](./components); static assets are in
[`public/`](./public).

Deployed via **GitHub Pages** using [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml).
Custom domain: `www.sinhaankur.com` (see [`CNAME`](./CNAME)). The
[`netlify.toml`](./netlify.toml) is kept as a fallback config but Netlify is not
the live host.

The previous hand-written static HTML portfolio is parked in
[`archive/`](./archive/README.md) (switched over 2026-05-21) and is no longer
deployed. Do **not** link the live site to anything inside `archive/` — if you
need an asset from there, copy it into [`public/`](./public/) and reference it
from there.

## Local development

```bash
pnpm install
pnpm dev          # serves on http://localhost:3000
```

- `pnpm dev` — Next.js dev server (Turbopack).
- `pnpm build` — production static export. The GitHub Pages workflow runs this.
- `pnpm start` — serve the production build.

There is no test suite. There is no separate lint command beyond Next.js's
built-in checks.

## Deployment

GitHub Pages workflow at [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml):

- `pnpm install --frozen-lockfile=false`
- `pnpm build` (Next.js static export — `next.config.mjs` sets `output: "export"`).
- Uploads `out/` to Pages via `actions/upload-pages-artifact@v3` + `actions/deploy-pages@v4`.

Because the site uses `output: "export"`, every dynamic feature (custom cursor,
theme toggle, galaxy scene, SoundCloud widget) runs client-only. Don't introduce
server-component data fetching that breaks static export.

## Site map (live)

App-router routes under [`app/`](./app):

- `/` — home (Hero galaxy + About + Works + Usability summary + Stack & Beliefs + Footer).
- `/lab` — **The Lab index page** (flagship + supporting open-source projects). Moved
  off the home scroll into its own route 2026-06-17; navbar "Lab" → `/lab`, and lab
  case studies link back to `/lab` (not `/#lab`). Renders `components/lab.tsx`.
- `/works/oracle`, `/works/deloitte`, `/works/snowtint`, `/works/rage` — company case studies.
- `/lab/unhosted` — Unhosted (flagship open-source project case study).
- `/lab/celestial` — the **Satellite Engine**: live real-time solar system + real
  satellite orbits + Mars/Moon imaging + live space data. Hosts the **AI copilot**
  (✦ button) — folded in here 2026-07 from the retired `/lab/universe-assistant`
  (that route now redirects here). The copilot is **keyless + on-device by default**
  (in-browser tiny LLM via `@mlc-ai/web-llm`; see `lib/webllm-*`), falling back to
  deterministic search/fly-to tools where WebGPU is absent.
- `/lab/helion-drift` — the **canonical game URL** (Helion Drift / Star Cleaver).
  `/lab/star-cleaver` is a legacy redirect → here; don't re-add it as a real page.
- `/lab/big-bang` — real-time cosmic timeline (Planck → today → Earth forms →
  oceans → life → us); every element Blender-baked (`blender/big-bang/bake_elements.py`).
- `/lab/usability-engine` — Usability Engine case study (design rationale +
  checkability framework; the live engine itself remains at `/usability`).
- `/skills` — skills matrix with category + project filters.
- `/usability` — long-form usability guide (hosts the interactive engine). The
  "Usability" navbar tab was removed 2026-07 (it duplicated the Lab's presence);
  the live engine is still reachable from `/lab/usability-engine`.
- `/upcoming` — roadmap.
- `/universe-engine/math` — **"The Math Behind the Universe Engine"**: the real
  formulas that drive the engine (J2000 epoch, mean anomaly, Kepler's equation,
  SGP4, ECI→topocentric). A public teaching page — keep it; linked from the
  footer ("The Math").
- `/games/Gamelist.html` — retro neobrutalism mini-games index, served from
  `public/games/` (preserved from the previous build as a separate visual language).

## Component conventions

- Section eyebrow numbering on home: `02 — DOMAIN`, `03 — PHILOSOPHY`,
  `04 — EXPERIENCE`, `06 — USABILITY`, `07 — STACK`, `08 — CONTACT`.
  (`01 — DISCIPLINE` was retired when the hero's top-left became the name
  block, and `05 — THE LAB` now lives on the standalone `/lab` page, so the
  home sequence starts at 02 and skips 05.) Keep them in order if you add a
  new section.
- All sections wrap content in `max-w-6xl px-6 md:px-12` (or the `Container`
  primitive) so nothing stretches edge-to-edge on wide displays.
- Type ramp: `Inter` (sans), `Fraunces` (display + italic moments, with `opsz`/`SOFT`/`WONK`
  axes wired via `font-variation-settings`), `Instrument Serif` for short
  inline italic emphasis, `JetBrains Mono` (eyebrows, mono labels). Configured in `app/layout.tsx`.
- Case studies use shared primitives from
  [`components/case-study/case-study-layout.tsx`](./components/case-study/case-study-layout.tsx):
  `CaseStudyLayout`, `CaseSectionHeading`, `CaseProse`, `CaseList`, `CasePullQuote`,
  `CaseLessons`, `CaseMoments`, `ProjectStory`, `CaseNextLinks`.
- Case-study back link is configurable via `backTo={{ label, href }}` on
  `CaseStudyLayout`. Lab case studies (Unhosted) point back to `/#lab`;
  company case studies default to `/#works`.
- Case-study moment images live under `public/img/case-studies/<company>/`.

## The Universe Engine

**Standards:** every change is held to the five pillars in
[`components/universe-engine/ENGINE-STANDARDS.md`](./components/universe-engine/ENGINE-STANDARDS.md)
(Truth · Performance · Presentation · Robustness · Accessibility). True north:
restore the real sky, faithfully + understandably; reverence over spectacle; real
over invented. Pure-GLSL — no GLB meshes in the engine (Blender may bake textures only).
**Build every body from real, known data (NASA/JPL/ESA/HYG/SIMBAD) — be EXACT**: a
star's measured composition / temperature / size drives how it's rendered; where
data genuinely isn't known, label it as inference, never present a guess as fact.
**Architecture:** the engine is an orchestrator of domain sub-engines (planet · star
· black-hole · nebula · galaxy · sub-system) — see
[`components/universe-engine/ENGINE-ARCHITECTURE.md`](./components/universe-engine/ENGINE-ARCHITECTURE.md).

The galaxy hero is powered by a self-contained R3F module in
[`components/universe-engine/`](./components/universe-engine):

```
types.ts        Shared types (BodyInfo, Constellation, Planet, etc.)
astronomy.ts    Real-world data + scene-scale + helpers (no React, no R3F)
shaders.ts      GLSL for the spiral-arm point field
scene.tsx       All R3F components, composed via <SceneContents />
hud.tsx         DOM overlays (InfoPanel, TimelineControl, ResetViewButton)
mobile-sheet.tsx  Slide-up bottom sheet for touch devices
static-starfield.tsx  CSS fallback used during lazy-load + on the 404 page
index.tsx       <UniverseEngine /> entry + public re-exports
```

Consumers mount `<UniverseEngine interactive showHud showMusic invert />` and
nothing else. Adding a new planet, moon, or constellation is a one-file edit in
`astronomy.ts`.

`components/hero.tsx` lazy-loads `<UniverseEngine />` via `next/dynamic` with a
`<StaticStarfield />` fallback so the ~250 KB R3F bundle doesn't block first paint.
Solar-system positioning uses real AU values, axial tilts, and J2000 RA/Dec for
the seven constellations (Big Dipper, Polaris, Orion, Cassiopeia, Leo, Lyra, Cygnus).

## Music attribution

The galaxy hero's music chip cycles **quiet → piano → drone → quiet**
(one button; the webOS TV remote's OK key clicks the same button on `/sky`):

- **Piano** — SoundCloud widget pointing at
  `https://soundcloud.com/ludovicoeinaudi/experience-reimagined`. The iframe is
  visually hidden — all control runs through the SoundCloud Widget API.
- **Deep Field drone** — an original generative ambient bed synthesized live in
  pure Web Audio ([`lib/space-drone.ts`](./lib/space-drone.ts)). No samples, no
  streaming, no licensing; it works offline, so TVs still get music when the
  SoundCloud embed can't load (the cycle then skips the piano).

Playback only starts after the user clicks; it never auto-plays.

## Navbar

Anchor-based nav items (`#works`, `#lab`, `#contact`) resolve to `/#anchor` when
not on the home route, so clicking them from a case-study page navigates back to
the home page and then scrolls. Don't revert to in-page-only `#anchor` hrefs.

## Things to avoid

- Don't link the live site to anything in `archive/`.
- Don't introduce a global test runner or lint script unless the user asks for it.
- Don't put case-study images in `/public/img/*` at the root level; nest them
  under `/public/img/case-studies/<company>/` to keep things tidy.
- Don't auto-play music. The galaxy music chip is strictly opt-in.
- Don't ship features that depend on the legacy Netlify URL
  (`sinhaankur-portfolio.netlify.app/Mocks/...`). If a PDF needs to be linked,
  copy it into `public/` first or use a mailto CTA.
- Don't add `Co-Authored-By` trailers in commits — the repo enforces a single
  canonical author (see `.mailmap` + git history rewrite log).
