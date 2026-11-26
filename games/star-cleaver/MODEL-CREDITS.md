# Model credits — Helion Drift / Star Cleaver

Third-party 3D assets used in the game, with their sources and licenses. Ankur's
own Blender-authored assets (the fleet ships, enemies, station, etc.) are his
own work and are not listed here — this file credits **outside sources only**,
per the project's attribution principle (always credit what we use; never omit it).

## Player + fleet ships — all original

The player fleet (Kestrel, Gyrfalcon, and the procedural interceptor) and all
enemy ships are Ankur's own original Blender-authored models. The default player
ship is the **Kestrel** hull. No third-party or branded ship designs are used.

_(A previously-trialled third-party player mesh has been removed from the game;
`public/models/xwing.glb` is no longer referenced by any code.)_

### 2026-11 rebuild (`games/star-cleaver/drift/`)

- **Shrike** (player ship) — original design, built procedurally in
  `drift/ship-model.ts` with canvas-generated livery in `drift/textures.ts`. No
  model file. Deliberately *not* based on any franchise ship (an uploaded X-wing
  mesh was reviewed and not used — it's Lucasfilm's design).
- Hostile bases, turrets and asteroids are procedural (`drift/scene.tsx`).
- Reused from this repo: `station.glb`, `enemy-fighter/sniper/swarm.glb` (Ankur's
  own), planet textures + `allsky-brunier-*.webp` + `data/deep-stars.bin`
  (already credited on /references).
