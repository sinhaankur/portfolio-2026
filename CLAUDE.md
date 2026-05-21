# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

The **live site** is a Next.js 16 / React 19 / Tailwind v4 portfolio in
[`brutalist-void-portfolio-template/`](./brutalist-void-portfolio-template).
It is deployed by Netlify per [`netlify.toml`](./netlify.toml) at the repo root.
Custom domain: `www.sinhaankur.com` (see [`CNAME`](./CNAME)).

The previous hand-written static HTML portfolio has been parked in
[`_archive_legacy/`](./_archive_legacy/README.md) (switched over 2026-05-21). It is no longer deployed.
Do **not** link the live site to anything inside `_archive_legacy/` — if you need an asset
from there, copy it into
[`brutalist-void-portfolio-template/public/`](./brutalist-void-portfolio-template/public/)
and reference it from there.

## Local development

```bash
cd brutalist-void-portfolio-template
pnpm install
pnpm dev          # serves on http://localhost:3000
```

- `pnpm dev` — Next.js dev server (Turbopack).
- `pnpm build` — production build. Netlify runs this.
- `pnpm start` — serve the production build.

There is no test suite. There is no separate lint command beyond Next.js's
built-in checks.

## Deployment

Netlify is configured by [`netlify.toml`](./netlify.toml):

- `base = "brutalist-void-portfolio-template"`
- `command = "pnpm install --frozen-lockfile=false && pnpm build"`
- `publish = "brutalist-void-portfolio-template/.next"`
- `@netlify/plugin-nextjs` runs SSR / ISR / image optimisation.

Don't switch to a static-export unless you also strip the dynamic features
(custom cursor, theme toggle, galaxy scene, SoundCloud widget) that depend on
client-only execution.

## Site map (live)

App-router routes live under
[`brutalist-void-portfolio-template/app/`](./brutalist-void-portfolio-template/app):

- `/` — home (Hero galaxy + About + Works + Lab + Usability summary + Stack & Beliefs + Footer).
- `/works/oracle`, `/works/deloitte`, `/works/snowtint`, `/works/rage` — company case studies.
- `/lab/unhosted` — Unhosted (flagship open-source project case study).
- `/skills` — skills matrix with category + project filters.
- `/usability` — long-form usability guide.
- `/upcoming` — roadmap.
- `/games/Gamelist.html` — retro neobrutalism mini-games index, served from
  `public/games/` (preserved from the previous build as a separate visual language).

## Component conventions

- Section eyebrow numbering on home: `01 — DISCIPLINE`, `02 — DOMAIN`,
  `03 — PHILOSOPHY`, `04 — EXPERIENCE`, `05 — THE LAB`, `06 — HOW I WORK`,
  `07 — STACK & BELIEFS`, `08 — CONTACT`. Keep them in order if you add a new section.
- All sections wrap content in `max-w-6xl px-6 md:px-12` (or the `Container`
  primitive) so nothing stretches edge-to-edge on wide displays.
- Type ramp: `Inter` (sans), `Instrument Serif` italic (decorative italic moments),
  `JetBrains Mono` (eyebrows, mono labels). Configured in `app/layout.tsx`.
- Case studies use shared primitives from
  [`components/case-study/case-study-layout.tsx`](./brutalist-void-portfolio-template/components/case-study/case-study-layout.tsx):
  `CaseStudyLayout`, `CaseSectionHeading`, `CaseProse`, `CaseList`, `CasePullQuote`,
  `CaseLessons`, `CaseMoments`, `ProjectStory`, `CaseNextLinks`.
- Case-study back link is configurable via `backTo={{ label, href }}` on
  `CaseStudyLayout`. Lab case studies (Unhosted) point back to `/#lab`;
  company case studies default to `/#works`.
- Case-study moment images live under `public/img/case-studies/<company>/`.

## The galaxy hero

`components/hero.tsx` mounts `components/galaxy-scene.tsx` (R3F / Three.js). Overlay
controls cluster at the bottom-right corner: opt-in SoundCloud music chip
(`components/galaxy-music.tsx`, plays Ludovico Einaudi — Experience Reimagined via
SoundCloud Widget API) above a time-warp slider. Reset view appears at top-right when
in explore mode. Info panel sits bottom-left, lifted above the Enter Work CTA.

The scene only renders after the client mounts. Reduced-motion users get a static
fallback. Solar system positioning uses real AU values, planet axial tilts, and
RA/Dec for the Big Dipper / Polaris constellation.

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

- Don't link the live site to anything in `_archive_legacy/`.
- Don't introduce a global test runner or lint script unless the user asks for it.
- Don't put case-study images in `/public/img/*` at the root level; nest them
  under `/public/img/case-studies/<company>/` to keep things tidy.
- Don't auto-play music. The galaxy music chip is strictly opt-in.
- Don't ship features that depend on the legacy Netlify URL
  (`sinhaankur-portfolio.netlify.app/Mocks/...`). If a PDF needs to be linked,
  copy it into `public/` first or use a mailto CTA.
