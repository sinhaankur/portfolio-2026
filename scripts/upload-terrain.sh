#!/usr/bin/env bash
# upload-terrain.sh — push the heavy terrain height maps to Cloudflare R2 so the
# site serves them from assets.sinhaankur.com instead of the repo.
#
# The tiny Mars map (29 KB) ships from the repo and is NOT uploaded. The Moon
# (~3.2 MB) and Earth (~3.0 MB) maps are the R2 candidates. After a successful
# upload, flip `heightMapOnR2: true` for those bodies in
# lib/terrain/bodies.ts so production loads them from the CDN (with the committed
# copy staying as a local fallback).
#
# Usage:
#   ./scripts/upload-terrain.sh
#
# Requires the sibling assets repo (with its own R2 creds in .env.local) and
# rclone or awscli, exactly like sinhaankur-assets/upload.sh.
set -euo pipefail
cd "$(dirname "$0")/.."

ASSETS_REPO="${ASSETS_REPO:-$HOME/Documents/sinhaankur-assets}"
if [ ! -d "$ASSETS_REPO" ]; then
  echo "!! assets repo not found at $ASSETS_REPO — set ASSETS_REPO to its path"; exit 1
fi

# Heavy maps to upload → R2 key is terrain/<filename>.
HEAVY=( moon-height-2k.png earth-height-2k.png )
DEST_DIR="$ASSETS_REPO/terrain"
mkdir -p "$DEST_DIR"

echo "→ staging heavy terrain maps into $DEST_DIR"
for f in "${HEAVY[@]}"; do
  src="public/textures/terrain/$f"
  if [ ! -f "$src" ]; then
    echo "!! missing $src — bake it first: node scripts/fetch-terrain-dem.mjs <body>"; exit 1
  fi
  cp -v "$src" "$DEST_DIR/$f"
done

echo "→ uploading terrain/ to R2 via the assets repo's upload.sh"
( cd "$ASSETS_REPO" && ./upload.sh terrain )

echo "✓ terrain maps on R2. Next: set heightMapOnR2: true for Moon + Earth in"
echo "  lib/terrain/bodies.ts, then commit + deploy. The committed copies stay"
echo "  as local fallback."
