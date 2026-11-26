# Helion Drift — open-system rebuild (2026-11)

Mounted by `app/lab/helion-drift/page.tsx`. A space flight game across the
**real Solar System**: every planet sits where it actually is on launch day
(Universe Engine `planetsData` + Kepler), you refuel at stations, survey real
worlds for credits, mine the belt, and break five hostile bases.

## Loop

Launch → set a course (map **M** / **N**) → cruise drive (**C**, auto-aligns) →
arrive → survey / mine / fight → dock (**F**) → refuel, repair, rearm, sell ore,
upgrade → launch. Progress saves to `localStorage` whenever you dock.
Dying costs your cargo and 10% of credits; you respawn at the last station.

## Files

| file | role |
|---|---|
| `solar.ts` | real bodies: planets (true positions today), dwarfs, major moons, the Sun. States the game scale. |
| `world.ts` | stations, hostile base definitions, deterministic asteroid fields (belt, base clusters, trojans, Saturn ring zone). |
| `sim.ts` | the whole game simulation — flight model, cruise drive, fuel, weapons, enemy AI, bases, loot, docking, surveys, saves. Pure TS, no React. **All tuning lives in `TUNE` / `UPGRADES` / `ENEMY_STATS`.** |
| `scene.tsx` | R3F rendering. Floating origin (ship at 0,0,0). Real stars (`deep-stars.bin`) + real Milky Way (Brunier all-sky), planets, stations, bases, instanced rocks/bolts/loot, chase camera. |
| `ship-model.ts` | the **Shrike** — original player ship built in code. |
| `textures.ts` | canvas-generated livery, FX sprites, rock + alien materials. |
| `fx.ts` | pooled particles (sparks, fire, smoke, dust), flashes, shockwaves. |
| `shaders.ts` | atmosphere, shields, stars, panorama — all with log-depth chunks. |
| `input.ts` | keyboard + mouse (pointer-lock virtual stick), gamepad (standard mapping), touch. |
| `audio.ts` | all SFX synthesized live with Web Audio. |
| `hud.tsx` | instruments, on-screen markers, system map, station screen, pause/settings, touch controls. |
| `game.tsx` | root: title over a live scene, flight/dock/map/pause state. |

## Scale (stated, not hidden)

1 AU = 40,000 units, linear, so the layout is true. Planets keep real size
ratios but are drawn ~1,000× larger; the Sun is compressed so Mercury stays
outside it; moon orbits are compressed with a square-root law. Cruise tops out
at 60,000 u/s (≈1.5 AU/s), burning fuel in proportion to speed.

## Controls

Mouse steers (click to lock) · W/S throttle · A/D strafe · R/V up/down · Q/E roll ·
Shift boost · Click/Space fire · Right-click/G torpedo · T target ahead · Tab cycle ·
C cruise · X all stop · F dock · M map · N/B cycle course · Esc pause.
Gamepad: LS steer, RS throttle/strafe, RT fire, LT boost, LB/RB roll, A dock, B stop,
X cruise, Y target, R3 torpedo, D-pad map/course, Start pause. Touch: on-screen pad,
throttle slider and buttons.

## Testing

- Headless sim tests: write a script under `.tmp-simtest/` and run
  `npx tsx .tmp-simtest/x.ts` from the repo root (tsconfig paths resolve `@/`).
- In the browser, `?hd-debug` exposes the runtime as `window.__hd` for scripted
  play-tests (teleport, inspect `sim.enemies`, etc.).
- Balance (bot that strafes, retreats to recharge and uses torpedoes, 2026-11-26):
  Deimos Redoubt falls to the stock ship in ~1–1.5 min; Belt Hive needs level-1
  upgrades; Kuiper Bastion needs level-3. Needs a human play-test pass.

## Toward Steam

The game is self-contained and runs offline once loaded (no network calls after
the first asset fetch), takes a gamepad, and saves locally — the pieces a
desktop wrapper needs. Next: a Tauri/Electron shell, Steamworks (achievements,
cloud saves via the save JSON), and key remapping.
