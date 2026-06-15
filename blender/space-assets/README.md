# Space Assets — moved to a dedicated repo

The Blender game-asset **source** (master `.blend`, GLB exports, backups,
renders) now lives in its own repository to keep the portfolio lean:

> **`sinhaankur/star-cleaver-assets`** — local clone at `~/Documents/star-cleaver-assets`

These are GAME assets only. The live website's galaxy hero keeps its procedural
GLSL planets in `components/universe-engine/` — do **not** wire these meshes into
the live site.

## How assets reach the game
The game loads GLBs from the portfolio's committed `public/models/`. To refresh
them from the source-of-truth assets repo, run:

```bash
./scripts/sync-game-assets.sh
```

(Source of truth = the assets repo; `public/models/` stays committed so the
static build works without it.)

## Building / editing assets
Use the `star-cleaver-asset` skill (`.claude/skills/star-cleaver-asset/`) — it
encodes the full Blender → GLB → backup → sync → wire → verify → publish
pipeline and the project's art-direction conventions.
