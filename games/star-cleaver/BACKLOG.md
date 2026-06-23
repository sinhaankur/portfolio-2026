# Star Cleaver / Helion Drift — Build Backlog

The work queue for the [helion-builder](../../.claude/agents/helion-builder.md)
agent. Items are ordered by priority within phases; the agent takes the top
unchecked item unless told otherwise. Each item has **acceptance criteria** and
the **files** it touches. `🎮` = needs Ankur to play-test before it's truly
"done"; `🗣` = player-facing copy, propose before shipping.

Design source of truth: [ROGUELIKE.md](./ROGUELIKE.md) (the loop),
[ENGINE.md](./ENGINE.md) (the engine). Verify against current code — this list
can drift.

---

## Phase 1 — Make combat a real fight (the loop has no teeth yet)

> Current state: the player shoots enemies, but **enemies don't shoot back** and
> the player only takes damage from gravity/boundary hazards. So nothing kills
> you in combat → the roguelike's "death loses your run" stakes are hollow. Fix
> the threat first; juice second.

- [ ] **1.1 Enemies fire at the player.** `🎮`
  Fighters/snipers spawn enemy projectiles aimed at the player (lead the target
  for snipers), on their `fireRate` cadence, only when roughly facing + in range.
  Reuse the projectile entity + `lib/neural-game-engine` collision path; tag
  `team: 'enemy'`. Player hull takes damage on hit (feeds the existing
  `hullDamageThisFrame`). Scale fire rate/damage with `sectorThreatScale`.
  *Accept:* build green, no console errors; enemy bolts visible firing toward the
  ship in a headless screenshot; player `health` decreases on hit (verify via
  `Runtime.evaluate` reading state). Feel/balance → Ankur.
  *Files:* `game-canvas.tsx` (sim loop + a spawnEnemyVolley), `enemies.ts`,
  `particles.tsx` (enemy bolt visual if needed).

- [ ] **1.2 Enemy contact/ram damage + collision.**
  Enemies colliding with the player deal a burst of hull damage + bounce/despawn,
  so swarms are dangerous up close.
  *Accept:* build green; player health drops on enemy contact (state check).
  *Files:* `game-canvas.tsx`.

- [ ] **1.3 Combat camera shake on hit + kill.** `🎮`
  Today only *boost* shakes the camera. Add a short, sharp shake when the player
  takes a hit (scaled by damage) and a softer punch on a kill. Reuse the
  `metadata.weaponRecoil`/event pattern; keep it subtle (no nausea), mobile-safe.
  *Accept:* build green, no errors; shake driven by hit/kill events (code review +
  no-crash). Intensity → Ankur.
  *Files:* `game-canvas.tsx` (CameraFollowController shake block).

- [ ] **1.4 Kill-confirm feedback.**
  On an enemy kill: brighter flash + a bigger debris burst + a distinct
  explosion sound (currently only the player *volley* has audio — kills are
  silent). Add a WebAudio explosion ping like `playVolleyAudio`.
  *Accept:* build green; kill events produce the sound (code review) + visible
  burst in a screenshot.
  *Files:* `game-canvas.tsx` (audio), `particles.tsx` (ImpactField/DebrisField tuning).

- [ ] **1.5 Hostile threat readout in the HUD.**
  When enemies are firing, show incoming-fire / low-hull warnings (reuse the
  existing gravity-warning HUD slot styling). Mobile-first.
  *Accept:* renders at ≤640px without overlap; build green.
  *Files:* `hud.tsx`.

## Phase 2 — Content: more sectors, more variety

- [ ] **2.1 Wire `swarm` enemies into Deep Run spawns.**
  Swarm type exists (`enemies.ts`) but Deep Run only spawns fighter/sniper. Mix
  swarms into deeper sectors (fast, low-HP, group pressure) via `spawnSector`.
  *Accept:* build green; swarms appear at depth (state/screenshot).
  *Files:* `game-canvas.tsx` (spawnSector), `run-state.ts` (mix weights by depth).

- [ ] **2.2 Sector variety / biomes.**
  Each sector reads distinctly: tie `SECTOR_NAMES` to a real body (Belt → Jupiter
  → Saturn → Kuiper → Pluto) and vary backdrop/hazard density/asteroid field per
  sector. Reuse Universe bodies + `AsteroidField`.
  *Accept:* build green; visibly different sectors across jumps (screenshots).
  *Files:* `game-canvas.tsx`, `run-state.ts`, `mission-layout.ts`.

- [ ] **2.3 Salvage as visible pickups.** `🎮`
  In addition to kill-salvage, drop floating salvage pickups (re-skin the
  DataCore pickup tech) you must fly through to collect — gives the scavenging a
  spatial act, not just a counter tick.
  *Accept:* build green; pickups render + collecting raises `runSalvage` (state).
  *Files:* `particles.tsx` (DataCore reuse), `game-canvas.tsx`.

- [ ] **2.4 Hazard tension in sectors.**
  Use the existing gravity hazards as real run threats (a star/planet you must
  avoid while fighting). Tune so deeper sectors are spatially tighter.
  *Accept:* build green; hazard present + damaging near it (state).
  *Files:* `game-canvas.tsx`, `mission-layout.ts`.

## Phase 3 — The boss (run climax)

- [ ] **3.1 Boss encounter at a milestone sector.** `🎮` `🗣`
  Every N sectors, spawn a boss (the `createBoss` variants already exist:
  warbird/decimator/…). Multi-phase, telegraphed attacks, a real HP bar in the
  HUD. Clearing it gives a big salvage bonus + a guaranteed jump-or-extract.
  *Accept:* build green, no errors; boss spawns + HP bar renders (screenshot/state).
  Fight feel + any boss barks → Ankur.
  *Files:* `game-canvas.tsx`, `enemies.ts`, `hud.tsx`, (boss GLB already in `public/models/`).

## Phase 4 — Balance & feel pass (mostly play-test-gated)

- [ ] **4.1 Economy + difficulty tuning.** `🎮`
  Tune `run-state.ts` curves (enemy count/threat, salvage per kill, clear bonus,
  upgrade costs) so the push-vs-extract decision is genuinely tense and upgrades
  feel impactful. Ship the knobs; Ankur play-tests and we iterate the numbers.
  *Files:* `run-state.ts`.

- [ ] **4.2 Onboarding for Deep Run.** `🗣`
  A short first-run prompt explaining salvage / jump gate / extract / death. Reuse
  the existing tutorial-message pattern. Terse, in-voice.
  *Files:* `game-canvas.tsx` (tutorialMessages), `hud.tsx`.

---

## Shipped
- Roguelike core loop (Deep Run): launch → sector → jump/extract → outfitting →
  upgrades. `run-state.ts`, `outfitting.tsx`, mode-select card, HUD readout. (commit 24b16c8)
- X-wing rebuilt (clean 4-S-foil, 182 KB GLB). (commit 74345ea)
- Arcade flight-feel retune (nose-aimed cam, velocity feed-forward, bank-into-turns). (commit 1e9c8ec)

## Parked (Phase 5+, not now)
- AI-driven enemy behaviour (the `lib/neural-game-engine` AI hook).
- Loot variety (weapons, modules, shields, consumables).
- The Pluto-wormhole finale / meta-narrative.
- Native Unity port — do NOT start until Ankur says so (`project_star_cleaver_engine_plan`).
