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
| [`app/`](./app)              | Next.js 16 App Router — routes, metadata, OG image, sitemap |
| [`components/`](./components) | React components (including the universe-engine module) |
| [`public/`](./public)        | Static assets — favicons, OG image fallback, planet textures, resume PDF |
| [`hooks/`](./hooks)          | Custom React hooks |
| [`lib/`](./lib)              | Utility helpers |
| [`styles/`](./styles)        | Global styling beyond Tailwind |
| [`archive/`](./archive)      | The previous hand-written static-HTML build, parked but not deployed |
| [`docs/`](./docs)            | Architecture notes — incl. [`ENGINES.md`](./docs/ENGINES.md), the three-engine system map |
| [`CHANGELOG.md`](./CHANGELOG.md) | Notable changes, newest first |
| [`LICENSE`](./LICENSE)        | All-rights-reserved license — read before using any of this code |
| [`CLAUDE.md`](./CLAUDE.md)    | Internal notes for the AI assistant that helps me iterate on the site |
| [`CNAME`](./CNAME)            | Custom-domain configuration for GitHub Pages |
| [`netlify.toml`](./netlify.toml) | Legacy Netlify config; the site now ships via GitHub Pages |

---

## The three engines

The site is built around a family of real-data, WebGL space engines. They share
one truth spine and cross-link — see the system map in
[`docs/ENGINES.md`](./docs/ENGINES.md) for how they fit together.

- **Universe Engine** ([`components/universe-engine/`](./components/universe-engine))
  — the reusable core (`<UniverseEngine/>`), mounted across the galaxy hero, `/sky`,
  `/story`, `/tv`, and the game. A pure-GLSL point-field galaxy, real J2000
  constellations, and a full solar system where every body's position is a *pure
  function of the simulation date* (J2000 epoch → Kepler). The data + math live in
  a React/three-free truth spine, `astronomy.ts`.

- **Satellite Engine** ([`/lab/celestial`](https://www.sinhaankur.com/lab/celestial))
  — the Universe Engine focused on Earth orbit, with ~18,600 satellites propagated
  live on real SGP4 orbits, ISS passes over your location, conjunction screening,
  re-entry watch, Earth→Mars transfers, and an **on-device, keyless AI copilot**
  (a tiny in-browser LLM) that flies the camera in plain language. Views are
  shareable deep-links (`?focus=…&date=…`).

- **Terrain Engine** ([`/lab/terrain`](https://www.sinhaankur.com/lab/terrain))
  — fly over the *measured* surface of the planets. A displaced-sphere renderer
  driven by real elevation data (NASA MOLA · LOLA · MESSENGER · Magellan · NOAA
  ETOPO · GEBCO), with a living Earth (real water, drifting clouds, today's Sun),
  a drained-ocean mode, one-click deep-dives into named regions (Valles Marineris,
  Olympus Mons, Tycho…), and live NASA rover imagery at landing sites. Shareable
  as `#body/region`.

- **Spacecraft catalog** ([`/reference/spacecraft`](https://www.sinhaankur.com/reference/spacecraft))
  — a browsable reference of real missions (Voyager, Cassini, Hubble, JWST, the
  Mars orbiters…), each shown as a live rotating 3D model with its real agency,
  orbit, launch date, and history — the same meshes the engines fly.

Every body is built from real, sourced data (NASA/JPL/ESA/USGS/HYG); where a
value genuinely isn't known it's labelled as inference, never presented as fact.
See [`ENGINE-STANDARDS.md`](./components/universe-engine/ENGINE-STANDARDS.md).

## Other highlights

- **Astronomical reticle cursor**, theme-aware "chart mode" rendering, and a
  mobile bottom sheet in place of hover labels on touch devices.
- **Accessibility preferences** — reduce motion, larger text, system cursor —
  persisted per device, overriding OS settings.
- **Case studies** with shared layout primitives, reading-progress, an
  auto-extracted table of contents, and per-company image strips.
- **A UX framework** ([`/framework`](https://www.sinhaankur.com/framework)) — the
  cognitive laws, Nielsen's heuristics, and a runnable Usability Engine.

---

## Asset provenance note (Helion Drift)

For transparency: the player ship in Helion Drift is the **"Vanguard"** — an
original twin-boom interceptor designed and modelled from scratch in Blender
(central delta cockpit pod, two engine booms with emissive cores and forward
cannon tips). It is not based on any existing or licensed spacecraft. The
model is built reproducibly and headlessly by
[`blender/space-assets/build_vanguard.py`](./blender/space-assets/build_vanguard.py)
→ [`public/models/vanguard.glb`](./public/models/vanguard.glb).

---

## Deployment

Deployed via **GitHub Pages** with a custom Actions workflow
([`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml)) that
builds the Next.js static export and uploads it to Pages. Custom domain:
`www.sinhaankur.com` (see [`CNAME`](./CNAME)).

The Netlify config in [`netlify.toml`](./netlify.toml) is kept as a
fallback only; the live site no longer routes through Netlify.

---

## Autonomous systems — how the site keeps itself working

Parts of this site run **on their own**, with no person in the loop. The design
rule is the same as the engines': *degrade, never break* — if a feed or a model
is unavailable, the feature gets simpler, it doesn't die.

### 1. Data-freshness worker — keeps the simulation *real* (no AI, free, forever)

The `/lab/celestial` Satellite Engine is only honest if its data is current —
real satellite orbits (TLEs) drift within weeks. A scheduled job keeps them
fresh with **zero LLM and zero cost**:

- **Daily at 06:00 UTC** ([`deploy.yml`](./.github/workflows/deploy.yml), `schedule`),
  the deploy re-fetches the live catalog + screens the next 24 h of close
  approaches: [`fetch-satellites.mjs`](./scripts/fetch-satellites.mjs) (CelesTrak,
  keyless) + [`bake-conjunctions.ts`](./scripts/bake-conjunctions.ts), plus a
  real [`bake-flights.mjs`](./scripts/bake-flights.mjs) ADS-B snapshot.
- The refreshed catalogs are **committed back to `main`** (`[skip ci]`), so the
  git fallback is always ~yesterday — never months stale.
- A **freshness tripwire** ([`check-data-freshness.mjs`](./scripts/check-data-freshness.mjs))
  flags any feed past its age limit (TLEs 14 d · conjunctions 3 d · flights 30 d)
  as a non-blocking workflow warning, so silent staleness surfaces instead of
  drifting. It's pure, no-network, no-dep code — it runs anywhere, free.

If a third-party source is down, the deploy proceeds on the committed snapshot —
a data outage never breaks the site.

### 2. `sky-copilot` — our own LLM brain, on free GPU compute

The `/lab/celestial` copilot (the ✦ button) can run against
[`worker/sky-copilot.js`](./worker/sky-copilot.js) — a Cloudflare **Workers AI**
endpoint (free GPU tier). No Anthropic, no API key, no WebGPU, no local setup.

- **OpenAI-compatible** (`/v1/chat/completions` + `/v1/models`), so it slots into
  the site's existing provider layer ([`lib/llm-provider.ts`](./lib/llm-provider.ts))
  as the `cfai` provider — *"Cloud (free · our GPU)"*.
- **Adaptive by quota + quality:** the client picks a tier — `fast` · `balanced` ·
  `best` — and the Worker cascades down its model list on a quota/model error,
  returning `{ fallback: true }` only when everything's exhausted, so the browser
  falls back to its deterministic search/fly-to tools. The feature never
  dead-ends; it gets simpler when the free compute is tight.
- Qwen stays prominent in the cascade — the same family as our own fine-tune,
  [`sinhaankur/helmsman-4b`](https://huggingface.co/sinhaankur/helmsman-4b).

Deploy: `cd worker && npx wrangler deploy -c wrangler.sky.toml`.

### Status

| System | What it does | Runs on | Needs a key? | Status |
|---|---|---|---|---|
| Data-freshness worker | fresh TLEs + conjunctions + flights, committed back | GitHub Actions (daily) | no | **live** |
| Freshness tripwire | warns if any feed goes stale | GitHub Actions | no | **live** |
| `sky-copilot` LLM | free GPU brain for the sky copilot | Cloudflare Workers AI | no | **live** |
| Multi-agent build swarm | opens PRs for backlog items, auto-merges on green | GitHub Actions + a frontier model | yes (frontier) | *planned* |

The first three keep working **without Claude or any paid inference**. Only
autonomous *feature-building* (writing new code) needs a frontier model — that's
the one part that isn't free.

---

## Visitor analytics

Visitor tracking is enabled through Google Tag Manager in
[`app/layout.tsx`](./app/layout.tsx) and a client analytics bridge in
[`components/analytics/visitor-analytics.tsx`](./components/analytics/visitor-analytics.tsx).

Events pushed to `dataLayer`:

- `visitor_session_start`
  - `visitor_id` (anonymous localStorage id)
  - `visitor_new` (first time on this browser)
  - `visitor_first_session_today`
  - `visitor_day`
  - `referrer`
- `page_view`
  - `page_path`
  - `page_title`

In GTM/GA4, map these event names and parameters to report unique visitors,
new vs returning sessions, and per-route traffic.

---

## License & use

**Personal Portfolio License. Copyright (c) 2026 Ankur Sinha. All rights reserved.**

This is a **personal-use license**, not open-source software. The
repository is published for portfolio review, transparency, and
personal study — not as a starter template or reusable library.

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
License 1.1. Planet surface textures for Jupiter and Saturn are © Solar
System Scope, CC BY 4.0; Earth's Blue Marble is NASA public domain.

Full terms: [LICENSE](./LICENSE).

For any use outside the permissions above, contact:

**Ankur Sinha** · sinhaankur@ymail.com · [www.sinhaankur.com](https://www.sinhaankur.com)

---

## Acknowledgements

Code in this repository is authored solely by Ankur Sinha. Any AI
assistance used during development is treated as a tool; the work
product — design decisions, copy, code, and creative direction —
belongs to Ankur Sinha.
