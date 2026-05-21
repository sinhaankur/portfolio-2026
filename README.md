# Ankur Sinha — Portfolio

Personal portfolio of **Ankur Sinha**, Principal UX Designer working on
human-in-the-loop interfaces for agentic AI.

**Live:** [www.sinhaankur.com](https://www.sinhaankur.com)

---

## What's in this repository

This repo contains the source code and content for the live portfolio at
`www.sinhaankur.com`. Everything you see on the site — copy, designs, brand
mark, case studies, the universe engine — is the original work of Ankur
Sinha and is published here for transparency and reference.

Repository layout:

| Path | What it holds |
|------|----------------|
| [`brutalist-void-portfolio-template/`](./brutalist-void-portfolio-template) | The live Next.js 16 / React 19 / Tailwind v4 site that is deployed |
| [`_archive_legacy/`](./_archive_legacy) | The previous hand-written static-HTML build, parked but not deployed |
| [`LICENSE`](./LICENSE) | All-rights-reserved license — read before using any of this code |
| [`CLAUDE.md`](./CLAUDE.md) | Internal notes for the AI assistant that helps me iterate on the site |
| [`CNAME`](./CNAME) | Custom-domain configuration for GitHub Pages |
| [`netlify.toml`](./netlify.toml) | Legacy Netlify config; the site now ships via GitHub Pages |

---

## Highlights

- **Galaxy hero** — a hand-built R3F universe engine. Real astronomical
  positioning: the Milky Way disc is tilted 60.2° relative to the ecliptic,
  the Sun sits ~26,670 ly out on the Orion Arm, and seven constellations
  (Big Dipper, Orion, Cassiopeia, Leo, Lyra, Cygnus, Polaris) project from
  real J2000 RA/Dec coordinates onto a sky-shell around the Sun. Eight
  planets and one dwarf planet (Pluto) orbit at real AU values with real
  axial tilts and rotation periods.
- **Universe Engine** — extracted as a self-contained module under
  [`components/universe-engine/`](./brutalist-void-portfolio-template/components/universe-engine).
  Custom GLSL shaders, a sticky time-warp control, theme-aware "chart mode"
  rendering for light theme, and a mobile bottom sheet that replaces the
  desktop hover label on touch devices.
- **Astronomical reticle cursor** — context-aware. Switches to a target
  ring + warm-gold dot + body name label when over an interactive
  universe body.
- **Display preferences** — accessibility menu in the navbar. Three
  localStorage-persisted toggles (reduce motion, larger text, system
  cursor) that override OS settings per device.
- **Case studies** with shared layout primitives, reading-progress bar,
  auto-extracted table of contents (sticky on desktop, collapsible on
  mobile), and per-company "moments" image strips.

---

## Local development

The live site is the Next.js project inside `brutalist-void-portfolio-template/`.

```bash
cd brutalist-void-portfolio-template
pnpm install
pnpm dev          # http://localhost:3000
```

Other scripts:

- `pnpm build` — production build (used by the GitHub Pages workflow).
- `pnpm start` — serve the production build.
- `pnpm lint` — Next.js's built-in checks.

No test suite. No separate lint pipeline.

---

## Deployment

Deployed via **GitHub Pages** with a custom Actions workflow
(`.github/workflows/deploy.yml`) that builds the Next.js static export
and uploads it to Pages. Custom domain: `www.sinhaankur.com` (see
[`CNAME`](./CNAME)).

The Netlify config in [`netlify.toml`](./netlify.toml) is kept as a
fallback only; the live site no longer routes through Netlify.

---

## License & use

**All rights reserved. Copyright (c) 2026 Ankur Sinha.**

This is **not** open-source software. The repository is published for
transparency and portfolio review, not as a starter template or reusable
library.

- You **may** read the source, fork the repo on GitHub to study it, and
  reference techniques in your own original work with attribution.
- You **may not** republish, redeploy, or repurpose the visual design,
  brand mark, case-study copy, illustrations, or universe engine —
  in whole or in substantial part — without prior written permission
  from Ankur Sinha. This includes using any of it as the foundation of
  another personal site, template, or commercial product.
- You **may not** train, fine-tune, or evaluate ML models on this
  repository in any way that allows those models to reproduce the
  original content.

Third-party dependencies (Next.js, React, Three.js, react-three-fiber,
drei, framer-motion, Tailwind CSS, lucide-react, etc.) retain their own
licenses (typically MIT or Apache 2.0). Typefaces (Inter, Instrument
Serif, JetBrains Mono, Fraunces) are governed by the SIL Open Font
License 1.1.

Full terms: [LICENSE](./LICENSE).

For any use outside the permissions above, contact:

**Ankur Sinha** · h99311@gmail.com · [www.sinhaankur.com](https://www.sinhaankur.com)

---

## Acknowledgements

Code in this repository is authored solely by Ankur Sinha. Any AI
assistance used during development is treated as a tool; the work
product — design decisions, copy, code, and creative direction —
belongs to Ankur Sinha.
