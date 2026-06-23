# Helion Drift — Roguelike Core Loop (Vertical Slice)

> Creative direction, 2026-06-23. The game had strong tech (flight, chase cam,
> a real solar system, combat, particles) but **no loop** — no reason to play
> again. This doc commits the game to one fantasy: **Everspace-style roguelike
> runs**, grounded in the `Cole Vance / 2184` story bible. Build a single
> complete, *fun* loop end-to-end (vertical slice) before scaling content.

## The fantasy (one sentence)

You are Cole Vance, 2184. Launch from the last station, push outward through
hostile sectors, fight and scavenge **salvage**, and gamble each jump — go
deeper for more, or **extract** to bank it. Death loses the run's cargo, but
banked salvage buys **permanent ship upgrades**, so the next run goes further.

## Why this loop works

- **Stakes**: salvage you haven't extracted is lost on death → tension.
- **Decision**: every jump is push-your-luck (Risk vs. bank). The fun is the
  choice, not just the shooting.
- **Progression**: death is not failure, it's currency → "one more run".
- **Owns the bible**: Belt → Jupiter → Saturn → Kuiper → Pluto matches the
  story bible's sector order; the wormhole is the deep extract.

## The loop (what we build for the slice)

```
  LAUNCH ───► SECTOR ───► [clear enemies + grab salvage] ───► GATE
                ▲                                              │
                │                              ┌───────────────┴───────────────┐
                │                         JUMP DEEPER                       EXTRACT
                │                       (harder, richer)                 (bank salvage,
                │                              │                          run ends safe)
                └──────────────────────────────┘                              │
                                                                              ▼
   DEATH (lose run cargo) ───────────────────────────────────────────► OUTFITTING
                                                                    (spend banked salvage
                                                                     on permanent upgrades)
                                                                              │
                                                                              ▼
                                                                          LAUNCH (stronger)
```

### Run state (per-run, lost on death)
- `sectorIndex` — how deep this run has gone (0-based).
- `runSalvage` — salvage collected this run but **not yet banked**.
- `runKills` — enemies destroyed this run (for the run-summary screen).
- `hullAtEntry` — for "no-damage sector" bonuses later.

### Meta state (persists in localStorage, survives death)
- `bankedSalvage` — spendable currency.
- `upgrades` — owned permanent upgrade levels.
- `bestSector` / `totalRuns` — for the summary + bragging.

### Upgrades (slice = 3 meaningful ones, each 3 levels)
1. **Reinforced Hull** — +max health per level. (survive deeper)
2. **Overcharged Cannons** — +weapon damage per level. (clear faster)
3. **Tuned Drive** — +boost/accel per level. (dodge, reposition, escape)

Each level costs more than the last; clears read as a real power jump.

### Sector model (slice)
- A sector = a pocket of space around a real Solar-System body (reuse the
  Universe Engine bodies the game already flies near).
- Spawns N enemies (scaling with `sectorIndex`) + M salvage pickups.
- "Cleared" when all enemies are destroyed → the **jump gate** activates.
- Salvage drops from killed enemies + floats as pickups (reuse the existing
  DataCore pickup tech, re-skinned as salvage).

### Difficulty curve (slice)
- Enemy count + health + damage scale with `sectorIndex`.
- Salvage reward scales faster than difficulty, so pushing deeper is tempting
  but the death-risk compounds (more/tougher enemies, lower relative hull).

## Architecture (how it slots into existing code, non-invasively)

- **`run-state.ts`** — pure module: types + helpers for run + meta state, all
  stored in `gameState.metadata.run` / `.meta` and mirrored to localStorage.
  No changes to the core `GameState` interface (uses the existing `metadata`
  escape hatch). Pure functions, unit-test-able, no React/Three.
- **`outfitting.tsx`** — the between-runs DOM screen: shows banked salvage +
  run summary, lets the player buy upgrades, then relaunch.
- **Phase reuse**: a run launch routes through the existing
  `ignition → exploration` startup (keeps the cinematic). Death uses the
  existing `defeat` phase; we add an `outfitting` step after it. Extract is a
  clean win → outfitting.
- **Feature flag** `ROGUELIKE_MODE`: a third mode-select option ("Deep Run")
  so the existing Exploration / Defend Earth modes keep working while the
  slice is proven. Once it's fun, it becomes the default.
- **Reuse, don't rebuild**: flight model, chase cam, enemies, particles,
  Universe bodies, audio, HUD all stay. We add the *loop* on top.

## Slice acceptance ("is it fun yet?")

1. Launch → fight a sector → it clears → gate appears.
2. Choosing **Jump** loads a visibly harder sector; **Extract** banks salvage
   and ends the run safely.
3. Dying drops you on Outfitting with the run summary + banked salvage.
4. Buying an upgrade makes the next run *feel* stronger (more hull / damage /
   speed — verifiable in the HUD and in play).
5. The whole thing is replayable without reloading the page.

## Out of scope for the slice (Phase 2+)
- Many hand-built sectors, biomes, set-pieces.
- Elite/named enemies, the wormhole boss, the Pluto finale.
- Loot variety (weapons, modules), shields, consumables.
- AI-driven enemy behaviour (the neural-engine hook).
- Native Unity port (stays parked per the engine plan).
```
