# Star Cleaver 3D Asset Pipeline (Free + Low-Pain)

This is a practical workflow for creating and shipping web-ready ship models for Star Cleaver without paid tools.

## 1) Use This Folder Strategy

- Source files (Blender, downloaded refs, WIP): `Xwing/` (not deployed)
- Final app assets (optimized GLB only): `public/models/`
- Runtime mapping in game: `games/star-cleaver/engine/player-ship-model.tsx`

Rule: keep heavy/raw files in `Xwing/`, copy only optimized `.glb` to `public/models/`.

## 2) Free Tools

- Modeling: Blender
- Free base assets/textures:
  - Poly Haven
  - ambientCG
  - TextureCan
  - OpenGameArt
- Optional AI concept mesh (free credits): Meshy / Tripo
- GLB optimization CLI: `@gltf-transform/cli` (run with `pnpm dlx`)

## 3) Blender Authoring Checklist

1. Scale and orientation
- Apply transforms (`Ctrl+A` -> Rotation + Scale)
- Face model forward on +Z (or whichever direction your game expects)
- Put pivot near ship center of mass

2. Geometry
- Keep game model low-poly enough for web
- Remove hidden/internal faces
- Avoid tiny floating detail unless visible in gameplay

3. Materials and textures
- Prefer one shared material set per ship
- Use packed textures where possible (fewer materials = fewer draw calls)
- Default to 1K maps; use 2K only if needed

4. UVs and bake
- Clean UV unwrap
- Bake normal/AO from high detail only when needed

## 4) Blender Export Settings (GLB)

Use `File -> Export -> glTF 2.0`:

- Format: `glTF Binary (.glb)`
- Include:
  - Selected Objects (if exporting one ship)
  - Apply Modifiers: On
  - UVs: On
  - Normals: On
  - Materials: Export
  - Tangents: On (if normal maps are used)
- Animation: Off (unless model has moving parts)
- Compression: leave default (optimize later with CLI)

## 5) Optimize Every Model Before Shipping

Example command (input in source folder, output to deployed folder):

```bash
pnpm dlx @gltf-transform/cli optimize \
  Xwing/my-ship.glb \
  public/models/my-ship.glb \
  --compress draco \
  --texture-compress webp \
  --texture-size 1024
```

If a model looks broken after optimization, retry without one of the compression flags and compare.

## 6) Quick Quality Gate Before Commit

For each ship GLB in `public/models/`:

1. Loads in local app without errors
2. Looks correct in both:
- Nexus 3D preview
- In-combat player ship view
3. Orientation is correct (nose points forward)
4. File size target:
- Ideal: under 10 MB each
- Acceptable for hero assets: up to ~20 MB if quality requires

## 7) Add New Ship Variant in Code

When adding a new ship:

1. Add model file to `public/models/`
2. Add ship config entry in `games/star-cleaver/engine/ship-selector.tsx`
3. Map ship ID to GLB path and transform in `games/star-cleaver/engine/player-ship-model.tsx`
4. Run `pnpm build`
5. Commit only needed files (do not commit raw source folder unless intended)

## 8) Keep Future Work Fast

Build a reusable Blender "ship kit" file containing:

- Cockpit module
- Wing modules
- Engine module variants
- Weapon pod variants
- Decal/trim sheet material

Then create new ships by recombining modules instead of starting from zero.

## 9) Suggested Naming Convention

- Source/WIP: `Xwing/<variant-name>.blend`, `Xwing/<variant-name>.glb`
- Deployed: `public/models/<variant-name>.glb`
- IDs in code: `kebab-case` (example: `alliance-xwing`, `x-blade`)

This keeps authoring, optimization, and runtime mapping simple and consistent.
