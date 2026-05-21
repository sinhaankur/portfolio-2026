# Legacy static site — archived

This directory holds the hand-written static HTML portfolio that used to live
at the repo root. As of **2026-05-21** it is no longer deployed.

The live site is now the Next.js portfolio in
[`../brutalist-void-portfolio-template`](../brutalist-void-portfolio-template),
built by Netlify (see [`../netlify.toml`](../netlify.toml)).

## Why it is kept

- Provenance for case-study content, Mocks (PDFs / Sketch files), team photos,
  and the chat-bot config.
- Reference for the older Material Design / Materialize implementation if any
  page ever needs to be reproduced.
- A safety net while the new site is being polished.

## What lives here

- `index.html`, `projects/*.html`, `booking.html`, `usability.html`,
  `technical-insights.html`, `tools-experiments.html`, `skills-breakdown.html`,
  `upcoming.html`, `lets-build-together.html`, `404.html` — old pages.
- `css/`, `js/`, `fonts/`, `videos/`, `img/` — old static assets.
- `Mocks/` — case-study PDFs, Sketch files, prior wireframes.
- `webgames/` — the retro/neobrutalism mini-games. A copy of this lives at
  [`../brutalist-void-portfolio-template/public/games`](../brutalist-void-portfolio-template/public/games)
  and is served by the live site at `/games/Gamelist.html`.
- `_archive/`, `_resources/` — earlier nested archives.
- `Oracle Figma Plugin/` — separate repo-ish project, kept for reference.
- `resume.pdf`, `resume-2026-autodesk.md`, `dataclaw_export.jsonl` — misc.
- `root-package.json`, `root-pnpm-lock.yaml`, `root-node_modules/` —
  stray v0 scaffolding that used to live at the repo root.

## Do not link to anything in here from the live site

If a case study or page needs an asset from this directory, copy it into
`../brutalist-void-portfolio-template/public/` and reference it from there.
