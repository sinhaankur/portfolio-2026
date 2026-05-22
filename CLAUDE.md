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

- `/` — home (Hero galaxy + About + Works + Lab + Usability summary + Stack & Beliefs + Footer).
- `/works/oracle`, `/works/deloitte`, `/works/snowtint`, `/works/rage` — company case studies.
- `/lab/unhosted` — Unhosted (flagship open-source project case study).
- `/lab/usability-engine` — Usability Engine case study (design rationale +
  checkability framework; the live engine itself remains at `/usability`).
- `/skills` — skills matrix with category + project filters.
- `/usability` — long-form usability guide (hosts the interactive engine).
- `/upcoming` — roadmap.
- `/games/Gamelist.html` — retro neobrutalism mini-games index, served from
  `public/games/` (preserved from the previous build as a separate visual language).

## Component conventions

- Section eyebrow numbering on home: `01 — DISCIPLINE`, `02 — DOMAIN`,
  `03 — PHILOSOPHY`, `04 — EXPERIENCE`, `05 — THE LAB`, `06 — HOW I WORK`,
  `07 — STACK & BELIEFS`, `08 — CONTACT`. Keep them in order if you add a new section.
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

The galaxy hero is powered by a self-contained R3F module in
[`components/universe-engine/`](./components/universe-engine):

```
types.ts        Shared types (BodyInfo, Constellation, Planet, etc.)
astronomy.ts    Real-world data + scene-scale + helpers (no React, no R3F)
shaders.ts      GLSL for the spiral-arm point field
scene.tsx       All R3F components, composed via <SceneContents />
hud.tsx         DOM overlays (InfoPanel, TimeWarpSlider, ResetViewButton)
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

The galaxy hero embeds a SoundCloud widget pointing at
`https://soundcloud.com/ludovicoeinaudi/experience-reimagined` and exposes a small
opt-in play button. Playback only starts after the user clicks; it never auto-plays.
The widget iframe is visually hidden — all control runs through the SoundCloud
Widget API.

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
