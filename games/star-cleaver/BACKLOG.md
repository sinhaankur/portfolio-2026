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

- [x] **1.1 Enemies fire at the player.** `🎮` (shipped — see commit below)
  Hostiles within `ENEMY_FIRE_RANGE` shoot red bolts at the player on a per-enemy
  `fireRate` cadence; snipers lead the target. Bolts (`team:'enemy'`,
  `isEnemyBolt`) are resolved against the player in the sim loop → feed
  `hullDamageThisFrame`, so taking fire drains the hull (and can end a Deep Run).
  Verified: build green, no console errors, sector spawns hostiles. *Whether it
  feels threatening needs Ankur flying — headless can't move the ship to engage.*

- [x] **1.2 Enemy contact/ram damage + collision.** (shipped — see commit below)
  Contact costs a hull burst (35% of the rammer's max health, min 8) and
  destroys the rammer through the 'entity_killed' path, so the existing
  kill-confirm explosion + camera punch fire at the impact point and the
  incoming-fire shake/HUD react. Ram kills grant NO salvage. Damage scalar →
  Ankur to confirm in play.

- [x] **1.3 Combat camera shake on hit.** `🎮` (shipped — see commit below)
  Sharp ease-in camera jolt when taking fire, driven by the decaying
  `incomingFire` signal. Modest (no nausea), additive on camera position.
  Kill-punch deferred to the kill-confirm pass (1.4). Intensity → Ankur.

- [x] **1.4 Kill-confirm feedback.** (shipped — see commit below)
  Enemy kills now: a WebAudio explosion (filtered-noise burst + low thump), a
  brief camera kill-punch (distinct from the rattling hit-shake), and a bigger
  ImpactField burst (size 5.5→7, longer life). Fires off `entity_killed` events
  in ALL combat modes via an onKill hook. Sound/feel → Ankur to confirm in play.

- [x] **1.5 Hostile threat readout in the HUD.** (shipped — see commit below)
  "⚠ INCOMING FIRE" / "⚠ HULL CRITICAL" warning in the existing warning slot,
  pulsing, mobile-safe. Driven by `incomingFire` + hull %.

## Phase 2 — Content: more sectors, more variety

- [x] **2.1 Wire `swarm` enemies into Deep Run spawns.** (shipped — see commit)
  `spawnSector` now mixes type by depth: snipers thicken with depth, fast low-HP
  swarm drones appear from sector 2+. Build green. Feel → Ankur.

- [x] **2.2 Sector variety + teaching.** (shipped — see commit)
  Each sector is a real region (Belt→Jupiter→Saturn→Kuiper→Pluto) with a REAL
  fact on arrival AND a distinct VISUAL backdrop: per-sector body colour + land
  tone + size + Saturn-style rings + asteroid density + ambient light that dims/
  reddens outward (`SECTORS[].backdrop` in run-state; `SectorBackdrop` component;
  `MissionPlanet` gained a `landColor` prop so bodies aren't all green-Earth).
  Deep Run swaps the Earth+station backdrop for the sector body. Verified
  headless: Belt reads rocky (not green Earth), no errors. Deeper sectors share
  the path (Jupiter bands / Saturn rings) — confirm in play.
  STILL OPTIONAL: per-sector gravity-hazard tuning (2.4).

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

- [x] **3.1 Boss encounter at a milestone sector.** `🎮` (shipped — see commit)
  Every 3rd sector (2, 5, 8…) spawns a single BOSS instead of a swarm —
  depth-scaled variant (warbird→…→annihilator), durability ×sectorThreatScale.
  Multi-phase aggression: fire rate ramps as its hull drops (<60%, <30%), from a
  captured baseFireRate so it doesn't compound. Prominent red boss HP bar in the
  HUD (top-center), and a 3× salvage clear bonus. Existing "all enemies dead →
  jump gate" naturally gates the run on the kill. Verified: build green, no
  runtime errors, boss bar correctly hidden on non-boss sectors. The FIGHT (feel,
  difficulty) needs Ankur — headless can't fly to sector 2.
  STILL OPTIONAL: telegraphed special attacks, boss barks (`🗣`).

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
