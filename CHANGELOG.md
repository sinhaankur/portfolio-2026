# Changelog

Notable changes to the portfolio and its engines. Newest first. Dates are the
work date; the site deploys continuously from `main`.

## 2026-08 — Space engines: fidelity, reach, and the living Earth

### Terrain Engine
- **New Planetary Terrain Engine** at `/lab/terrain` — a displaced-sphere renderer
  built from real elevation data. Bodies: Mars (NASA MOLA), the Moon (LOLA),
  Mercury (MESSENGER), Venus (Magellan), and Earth (NOAA ETOPO + GEBCO 15″).
- **The living Earth** — real water (oceans on by default), a drifting procedural
  cloud layer, a soft atmosphere rim, and lighting from the **real current Sun**
  so the day/night terminator matches now. Draining the oceans is an opt-in mode.
- **Deep-zoom descent** — fly from orbit down toward the surface; a local
  high-detail patch resolves real relief, and the camera floor was lowered so you
  can skim much closer.
- **Regional deep-dives** — one-click hi-res tiles for Valles Marineris, Olympus
  Mons, Jezero, Tycho, and Maxwell Montes (native-resolution DEM crops).
- **Live NASA rover imagery** at Mars landing sites (Perseverance, Curiosity…).
- **Shareable deep-links** — `#body/region` opens right on a place.
- Heavy DEM maps served from the Cloudflare R2 CDN; the repo stays lean.

### Universe / Satellite Engine
- **AI copilot: "take me to X at perihelion"** now works — a one-call tool computes
  the real perihelion date, sets the clock, and flies + follows the body.
- **Moons are flyable & searchable** — 44 moons (Phobos, Europa, Titan…) were
  rendered but absent from the copilot's catalog; now addressable.
- **Real 3D meshes for the deep-space fleet** — Voyager, Pioneer, New Horizons,
  Parker Solar Probe, BepiColombo, Hayabusa2, OSIRIS-APEX, and Lucy were blocky
  placeholders; each now has a real Blender GLB keyed to its identity.
- **Dedicated planetary-orbiter meshes** — MAVEN, MESSENGER, Akatsuki, Venus
  Express, and BepiColombo no longer reuse generic craft models.
- **Per-comet nucleus variety** — the never-imaged comets no longer share one
  identical rock (seeded shape/spin; honest, still a representative nucleus).
- **Shareable deep-links** — "Share this view" copies `?focus=…&date=…`.

### Reference & site
- **Spacecraft catalog** at `/reference/spacecraft` — a live-3D, art-gallery-style
  reference of 24 real missions with their history; reuses the engine meshes.
- **Engines cross-linked** — Satellite Engine ↔ Terrain Engine ↔ catalog.
- **Usability Engine** moved into the `/framework` page (it's the framework made
  runnable) rather than headlining the Lab.
- **Lab index** — featured the previously-unlinked Helion Drift and Firmament.
- **Docs** — added [`docs/ENGINES.md`](./docs/ENGINES.md), a system map of how the
  three engines relate, after an architecture audit (verdict: sound, no rewrite).

## Earlier

The site began as a hand-written static-HTML portfolio (now parked in
[`archive/`](./archive)) and was rebuilt on Next.js 16 / React 19 / Tailwind v4,
deployed via GitHub Pages to `www.sinhaankur.com`.
