# Full debris catalogue — Space-Track.org

The Satellite Engine shows the **major tracked debris** by default (the named
CelesTrak fragmentation clouds + the `analyst` set, ~2.8k objects) — everything
reachable **without an account**.

The **complete** on-orbit debris + rocket-body catalogue (~25k objects) lives
behind a free [Space-Track.org](https://www.space-track.org) account. When
credentials are present, the build pulls the full set; when they're absent,
everything falls back to the keyless CelesTrak data automatically — the feature
is purely additive and nothing breaks either way.

## Enable it

1. **Create a free account** at <https://www.space-track.org> (US Space Force
   public catalogue; approval is usually quick).

2. **Add two GitHub repo secrets** (Settings → Secrets and variables → Actions):
   - `SPACETRACK_USER` — your Space-Track login (email)
   - `SPACETRACK_PASS` — your Space-Track password

   That's it. The next deploy (or the daily 06:00 UTC scheduled run) fetches the
   full catalogue. No code change needed — the workflow already passes these to
   `scripts/fetch-satellites.mjs`.

3. **Locally** (optional, to test before pushing):
   ```bash
   export SPACETRACK_USER='you@example.com'
   export SPACETRACK_PASS='…'
   node scripts/fetch-satellites.mjs
   ```
   The output line `debrisSource` in `public/data/satellites.json` will read
   `space-track-full` instead of `celestrak-keyless`, and `breakdown.DEB` jumps
   from ~2.8k to ~25k.

## What it does

- One login + one GP query per build (well under Space-Track's rate limits).
- Pulls all `DECAY_DATE = null` (still on-orbit) `DEBRIS` + `ROCKET BODY`
  objects as TLEs, deduped by NORAD id against the CelesTrak payloads.
- Capped at **26,000** objects at fetch time, and the live swarm is further
  bounded to **24,000 resident** on the strongest device (a ~164 MB satrec heap
  ceiling — see `MAX_RESIDENT_SWARM` in `lib/device-tier.ts`). The debris panels
  still load the complete set on demand, so no analysis loses coverage.

## Safety

- Credentials are **never committed** — they only exist as GitHub secrets /
  your shell env. `scripts/spacetrack.mjs` reads `process.env` and no-ops if
  either is unset.
- Any Space-Track failure (auth, rate-limit, outage) is caught: the build logs a
  warning and continues on the CelesTrak keyless debris. A deploy never fails on
  account of this.
