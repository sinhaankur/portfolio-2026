# Transcribing your Dave levels — the 15-minute-per-screen guide

Ankur: this is the hand-off point for exact layouts. Play (or pause a
recording of) **your copy** of the game one screen at a time, and type what
you see into an ASCII grid below. Paste each finished grid into `fromTiles()`
in `engine/level.ts`, run `pnpm dave:check`, and the validator will prove the
screen is beatable before you ever load it. Everything else — 3D bricks,
props, physics, palettes, camera — is already wired and applies automatically.

## Legend (one character = one tile)

| char | meaning                       | char | meaning                    |
|------|-------------------------------|------|----------------------------|
| `#`  | brick (solid)                 | `=`  | purple/secondary platform  |
| ` `  | empty                         | `P`  | decorative pipe            |
| `.`  | cyan diamond                  | `o`  | purple ball gem            |
| `*`  | ruby / red gem                | `C`  | the cup (trophy)           |
| `D`  | exit door                     | `@`  | Dave's spawn               |
| `^`  | spikes                        | `F`  | fire                       |
| `W`  | water                         | `J`  | jetpack pickup             |
| `X`  | hidden warp pad               |      |                            |

## Rules the validator enforces (so your transcription "just works")

1. **Every row the same width.** Count characters — `fromTiles` refuses
   ragged rows.
2. **Climbs step ≤ 2 rows at a time** (the jump clears 2.4 tiles). If the
   original screen relies on a taller jump, tell me — we retune the jump
   contract once, globally, instead of bending the map.
3. **Vertical squeezes need a 2-tile gap.** A 1-tile hole in a ceiling is
   unjumpable-through in practice.
4. **The door sits ON something.** Put `D` directly above a `#` row.
5. **Spawn never hangs over a hazard.**

Wide, scrolling screens are fine — the camera follows Dave (see L2, 42
columns). Height is flexible too; 10–12 rows matches the original's feel.

## Workflow per level

```
1. Pause your game/recording on the screen.
2. Type the grid (any width, rows top→bottom, bottom row = floor).
3. Replace that level's rows in engine/level.ts.
4. pnpm dave:check         ← proves reachability, spawn safety, door seating
5. pnpm build && pnpm test:dave   ← boots it headless, zero-error gate
6. Play it: /games/dave-3d/?level=N
```

If a screen uses something the legend can't express (a monster, a moving
part, a tree/decoration you care about), write it in a note next to the grid
— I'll build the mechanic/prop as original work and extend the legend.

## Blank worksheets

Level 1 (replace with what your copy shows):
```
###################
#                 #
#                 #
#                 #
#                 #
#                 #
#                 #
#                 #
#                 #
###################
```
(duplicate this block for levels 2–10; widen freely for scrolling screens)
