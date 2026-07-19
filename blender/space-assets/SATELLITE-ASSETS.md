# Satellite asset program — every selected object gets its real design

The /lab/celestial swarm classifies every catalog object into an archetype
(`satellite-field.tsx` → `classifyArchetype`: type → name → operator → orbit
altitude), renders the points field by default, and swaps a real Blender GLB
onto the selected object's live orbit. Coverage is TOTAL — every one of the
18,000+ objects resolves to some archetype — and the program's job is to keep
replacing generic fallbacks with faithful craft, ordered by who actually
appears in the conjunction screening results.

Pipeline per asset: headless Blender build script (real published dimensions,
metres = model units) → GLB → `public/models/` → archetype table entry
(realSpanM + nativeSpan printed at export) → classifier line.

## Archetype library (current)

| Archetype | Model | Real span | Status |
|---|---|---|---|
| ISS | `iss.glb` | 109 m | ✅ faithful (craft 1: 8 wings, module stack, radiators) |
| Starlink v1 flat-pack | `satellite-starlink.glb` | 30 m | ✅ v1.5 single-wing (pre-2023 launches) |
| Starlink v2 Mini | `satellite-starlink2.glb` | 30 m | ✅ 2026-07-19 — twin 12 m wings, split by launch date |
| OneWeb bus | `satellite-oneweb.glb` | 5.6 m | ✅ 2026-07-18 — box bus, V-masted twin panels |
| Kuiper flat-bus | `satellite-kuiper.glb` | ~9 m | ✅ 2026-07-18 — envelope only; label says "approx." (design not public) |
| Iridium NEXT | `satellite-iridium.glb` | 9.4 m | ✅ 2026-07-18 — signature 40° L-band panel + twin wings |
| Debris fragment | `satellite-debris.glb` | ~1.5 m | ✅ 2026-07-18 — 3-shard torn-metal cluster (replaced placeholder) |
| Navigation craft | `satellite-gps.glb` | 17 m | ✅ generic GPS/GLONASS/Galileo bus |
| Dish comsat | `satellite-dish.glb` | 35 m | ✅ generic GEO comsat |
| Weather / GEO sat | `satellite-weather.glb` | 24 m | ✅ generic |
| Space telescope | `satellite-telescope.glb` | 13 m | ✅ Hubble-class |
| Space station | `satellite-station.glb` | 109 m | ✅ Tiangong/Mir-class |
| Spent rocket stage | `satellite-rocketbody.glb` | 10 m | ✅ generic (Falcon 9 S2 upgrade queued) |
| Smallsat | `satellite-smallsat.glb` | 2 m | ✅ Dove/Lemur-class |
| CubeSat | `satellite-leopard.glb` | 1.7 m | ✅ LEOPARD (the program's proof) |

## Build queue (fidelity upgrades, in order)

1. **Starlink v2 Mini** — the current-generation craft (~7k on orbit): flat
   bus + TWO 12.8 m wings (existing model is the single-wing v1.5 read).
2. **Falcon 9 second stage** — most common R/B: 3.7 m Ø, MVac bell, ~12 m.
3. **GPS III** — replace the generic nav bus with the real III-series body.
4. **Sentinel-class EO bus** — telescope-baffle + single wing for the many
   sun-sync earth observers now falling to `cubesat`.

## Known debris families (in the catalog + conjunction results)

These are the named clouds the screening keeps surfacing — real events, real
fragment counts from our CelesTrak snapshot:

| Family | Event | Fragments tracked | Notes |
|---|---|---|---|
| **Fengyun-1C** | 2007 Chinese ASAT test (865 km) | 1,910 | Largest debris event ever; crosses Starlink shells daily — #1 in our screen |
| **Cosmos-2251** | 2009 collision with Iridium 33 (789 km) | 592 | First accidental hypervelocity collision between intact satellites |
| **Iridium-33** | Same 2009 collision, the other half | 110 | Its partner family |

All three swap to the debris-shard cluster on selection; the InfoPanel's
provenance line (satellite-search) explains WHERE a selected fragment came
from. Future: per-family shard tinting (Fengyun = darker carbon composite,
Iridium = bus-panel shards).

## Rules

- Headless Blender (`build_constellation_sats.py` pattern); real dimensions
  from published references; keep GLBs lean (these swap in at close range).
- Where the real design is not public (Kuiper), model the known envelope and
  put "(approx.)" in the archetype label — never present a guess as the real
  craft.
- One craft at a time, finished and wired before the next.
