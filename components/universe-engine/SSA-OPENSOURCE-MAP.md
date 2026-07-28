# Open-source SSA — what we can build (with compliance & safety)

A map of LeoLabs-class Space Situational Awareness features, what the Satellite
Engine (`/lab/celestial`) already has, and what's worth building next — all on
public data, for **understanding not operations**.

## Already built (open-source, LeoLabs-parity)
- **LEO catalog + visualization** — 18,500-object swarm on real SGP4/TLE.
- **Conjunction screening** — `lib/conjunction.ts`, `lib/collision-system.ts`,
  `components/celestial/conjunction-panel.tsx` (close-approach TCA screening).
- **Reentry** — `reentry-panel.tsx` (decay status/lifetime from perigee).
- **Launch tracking** — `launch-feed.tsx`.
- **Orbit analytics / transfers** — `porkchop-plot.tsx`, `porkchop.ts`, `transfer-tool.tsx`.
- **Pass planning / overhead** — `pass-planner.tsx`, `overhead-passes.tsx`.
- **Space weather** — `space-weather-panel.tsx`.
- **NEO tracking** — `neo-panel.tsx`.
- **Object-type legend** — payload / rocket body / debris / unknown.
- **Satellite card** — live sub-lat/lon, altitude, speed, apogee/perigee, period,
  inclination, slant-range-to-you, launch site + origin arc.

## Gaps worth building — ranked (value × safety)

### Tier 1 — highest value, fully safe (public data only)  ✅ ALL SHIPPED
1. ✅ **On-Demand Screening** — screening-panel.tsx "Screen a TLE"
   (lib/conjunction.ts `screenOneObject`, 1-vs-N).
2. ✅ **Proximity / State Comparison** — proximity-panel.tsx "Proximity (2 objects)"
   (`screenTwoObjects` + separation sparkline).
3. ✅ **Ephemeris export** — the selected sat's card exports CSV / CCSDS OEM
   (lib/ephemeris.ts `computeEphemeris`/`toCSV`/`toOEM`). Verified: ISS |r|=6790 km.

### Tier 2 — strong, still safe
4. **Embeddable mini-tracker** — an iframe others drop into their sites (reach).
5. **Public read API** — expose the baked catalog as JSON so others build on it.

## Compliance & safety framing (the important part)
- **Public-domain data ONLY** — CelesTrak/NORAD TLEs, NASA/NOAA. No ITAR/EAR-
  controlled or classified ephemeris. This is the compliance shield.
- **Screening ≠ operational collision avoidance** — LABEL everything "for
  awareness / education, not operational maneuver decisions." We provide
  transparency; commercial SSA sells operations. A prominent disclaimer keeps us
  safely on the education/research side.
- **Observe & understand, NEVER operate** — never add anything that commands or
  tasks a real satellite/radar (LeoLabs "Tasking Requests" talks to hardware).
  That's the bright line, and it matches Ankur's standing "never act
  autonomously" principle.
- **Attribution always** — cite CelesTrak / NORAD / NASA / NOAA (already done).

## Positioning
"Open, transparent orbital awareness for everyone — the SSA tools commercial
platforms gatekeep, built on public data, for understanding not operations."
The democratize-space-tech mission ([[project_spacetech_public_mission]]).
