#!/usr/bin/env bash
# Sync curated game GLBs from the source-of-truth assets repo into the
# portfolio's public/models/ (which stays committed so the live static build
# works without the assets repo present).
#
# Source of truth: ~/Documents/star-cleaver-assets  (sinhaankur/star-cleaver-assets)
# Usage: ./scripts/sync-game-assets.sh
set -euo pipefail

ASSETS="${STAR_CLEAVER_ASSETS:-$HOME/Documents/star-cleaver-assets}"
DEST="$(cd "$(dirname "$0")/.." && pwd)/public/models"

if [[ ! -d "$ASSETS" ]]; then
  echo "Assets repo not found at: $ASSETS" >&2
  echo "Set STAR_CLEAVER_ASSETS or clone sinhaankur/star-cleaver-assets there." >&2
  exit 1
fi

# The GLBs the game actually loads. Add new entries here as assets are wired in.
GAME_GLBS=(
  "xwing.glb"
  "enemy-fighter.glb"
  "enemy-sniper.glb"
  "enemy-swarm.glb"
  "enemy-boss.glb"
  "station.glb"
  "small-bodies/asteroid-stony.glb"
  "small-bodies/asteroid-carbon.glb"
  "small-bodies/comet-nucleus.glb"
)

echo "Syncing game GLBs:  $ASSETS  ->  $DEST"
for rel in "${GAME_GLBS[@]}"; do
  src="$ASSETS/$rel"
  if [[ -f "$src" ]]; then
    cp "$src" "$DEST/$(basename "$rel")"
    echo "  ✓ $(basename "$rel")"
  else
    echo "  ! missing: $rel" >&2
  fi
done
echo "Done. Review + commit public/models/ in the portfolio repo."
