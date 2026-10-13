# Dave — engine package

Four dependency-free ES modules. No build step, no framework, no npm install. Drop the
folder into a project, serve it over http (ES modules need an origin), and import.

```
dave/
  engine.js     game logic — physics, collision, scoring, level state
  renderer.js        canvas drawing — flat vector on a light technical ground
  renderer-toon.js   canvas drawing — shaded, animated feature-film look
  input.js      keyboard + touch bindings, WebAudio sound effects
  levels.js     the ten level layouts and their builders
```

## Minimum viable game

```html
<canvas id="screen"></canvas>
<script type="module">
  import { DaveEngine } from './dave/engine.js';
  import { DaveRenderer } from './dave/renderer.js';
  import { bindKeyboard, createSfx } from './dave/input.js';
  import { LEVELS, TITLES } from './dave/levels.js';

  const game = new DaveEngine({ levels: LEVELS, titles: TITLES, lives: 3 });
  const view = new DaveRenderer(document.getElementById('screen'));
  game.on.sound = createSfx();
  bindKeyboard(game);
  game.start();

  (function frame() {
    game.step();
    view.draw(game);
    requestAnimationFrame(frame);
  })();
</script>
```

The canvas is sized by the renderer to 640×320 backing pixels at `dpr: 2`. Size it on
screen with CSS (`width: 100%; aspect-ratio: 2/1; image-rendering: auto`).

## engine.js

`new DaveEngine({ levels, titles?, lives?, practice? })`

| Member | What it is |
| --- | --- |
| `step()` | Advance one frame. Call at 60fps. |
| `setInput({left,right,up,down})` | Partial update; unspecified keys keep their value. |
| `toggleJetpack()` / `fire()` | Discrete actions — call on keydown, not per frame. |
| `advance()` | The single confirm action. Starts, retries, goes to the next level, restarts a finished run — whatever the current `mode` calls for. |
| `pause()` / `restartLevel()` / `resetRun()` | Self-explanatory. |
| `loadLevel(i)` | Jump to a level index. |
| `mode` | `title` · `playing` · `paused` · `dead` · `cleared` · `win` · `edit` |
| `score` `lives` `fuel` `ammo` `hasTrophy` `levelIndex` | HUD state. |
| `player` `monsters` `bullets` `map` `cam` `pops` `banner` | What the renderer reads. |
| `gemsTaken` / `gemsTotal` | For a completion tally. |
| `lastClear` | `{level, gems, gemsTotal, bonus}` set when a level is cleared. |
| `phys` | Live physics constants — tune `jumpVelocity`, `gravity`, `runSpeed` at runtime. |

### Events

Assign functions to `game.on.*`; all are optional.

```js
game.on.sound      = (name) => {};            // 'jump'|'pickup'|'trophy'|'shoot'|'door'|'die'|'kill'
game.on.score      = (delta, total) => {};
game.on.pickup     = (char, col, row) => {};
game.on.levelStart = (index) => {};
game.on.levelClear = (index, score) => {};
game.on.death      = (livesLeft) => {};
game.on.modeChange = (mode) => {};            // drive your React/Vue state from this
```

### Framework state

The engine mutates in place for speed — it does not emit a new object per frame. In
React, keep the engine in a `useRef` and mirror only the HUD numbers into state on an
interval or from `on.score` / `on.modeChange`; do not put the engine in state.

## renderer.js

`new DaveRenderer(canvas, { palette?, dpr? })` then `view.draw(game, { edit? })`.

Override any palette entry:

```js
new DaveRenderer(canvas, { palette: { prize: '#c2410c', terrain: '#101820' } });
```

Keys: `ground grid gridMajor terrain terrainCap terrainEdge water waterDeep hazard
hazardSoft prize prizeSoft ink paper steel steelLight muted`.

Colour carries meaning: steel is structure, amber is value, red is danger, and the
figure is the only white-visored object on screen.

## renderer-toon.js

Same interface as `DaveRenderer`, swap one for the other:

```js
import { ToonRenderer } from './dave/renderer-toon.js';
const view = new ToonRenderer(canvas);
game.on.sound = (n) => { sfx(n); view.fx(n, game); };  // impact effects
```

Squash and stretch on jump and landing, lean into runs, hair follow-through, blinking
eyes that track the player, parallax sky and hills, animated water and fire, additive
glow, dust/spark/ember particles and a death tumble. `fx()` is optional; without it you
lose the jump and pickup bursts but landing, death and monster-pop effects still run.
Override colours with `{ palette: { ... } }` — keys are in `TOON_PALETTE`.

## renderer-3d.js (Ritam 3D)

A three.js scene with the same engine. Pass THREE in so you control the version
(built against 0.160):

```js
import * as THREE from 'three';
import { Ritam3DRenderer } from './dave/renderer-3d.js';
import { LEVELS, TITLES } from './dave/levels-ritam.js';

const view = new Ritam3DRenderer(glCanvas, overlayCanvas, THREE, { shadows: true });
game.on.sound = (n) => { sfx(n); view.fx(n, game); };
view.draw(game);                 // perspective play view
view.draw(game, { edit: true }); // flat orthographic view of game.raw
view.setShadows(false);          // low-quality mode
view.dispose();
```

Stack the overlay canvas on top of the WebGL canvas (`position:absolute; inset:0;
pointer-events:none`) — it carries score pops, the banner and the pause screen.
In edit mode the camera is orthographic, so pointer → tile maps linearly across the
canvas rect.

Game-feel options: `new DaveEngine({ ..., autoRespawn: true, hints: HINTS })` — a death
costs a life and respawns you at the last touched `F` flag (level state kept, 100
frames of invulnerability, mode `dying` in between). Landing on a blob, hopper, saucer
or the boss stomps it; rockets hurt. Saucers glow for `phys.flyerCharge` frames before
firing. Hazards use a shrunken hitbox so grazing fire or a pool edge is safe. Hit-stop
freezes a few frames on stomps, kills and key pickups.

Mechanics: `-` moving platforms and `!` lifts (both pause at their ends and sit flush
with the floor so you can walk on), `k` key opens every `L` lock, `X` fake walls hide
secret rooms (+500), `h` hoppers leap toward you, `B` is an 8-hit boss that fires
spreads and frees the caged cup when it falls. `lastClear.stars` is 1–3: cleared, all
treasures, no lives lost.

The 3D renderer adds an image-based environment for real reflections on gold, gems
and water, bump-mapped brick and grained wood, wall torches, a pool of six flickering
point lights handed to the nearest fires/torches/doors, floating dust and a vignette.
Each level starts at Ritam's house, whose front door swings open.

`levels-ritam.js` adds tiles the engine scores through `PICKUPS`: `*` diamond 100,
`r` ruby 150, `o` orb 50, `i` ring 200, `c` crown 300, `$` gold 1000 — plus `u`, a
saucer that flies and fires aimed shots (`engine.enemyShots`). Levels can be any width;
the engine reads each level's own column count.

## input.js

```js
const unbind = bindKeyboard(game, window);   // returns an unbind function
bindTouch(game, { left, right, jump, jet, shoot });  // DOM elements
game.on.sound = createSfx();                 // set .muted = true to silence
```

Keyboard map: arrows or WASD to move, up/W/Space to jump, up/down on a ladder to climb,
Alt or Z for the jetpack, Ctrl or X to fire, P to pause, R to restart the level, Enter
to confirm.

## levels.js

`LEVELS` is an array of ten levels, each an array of 10 strings 100 characters wide.

| Char | Tile | Char | Tile |
| --- | --- | --- | --- |
| `#` | wall | `~` | water (lethal) |
| `^` | fire (lethal) | `*` | gem, 150 |
| `$` | chest, 1000 | `T` | trophy, 1000 — unlocks the door |
| `D` | door (exit) | `J` | jetpack |
| `G` | gun, +6 ammo | `\|` | ladder |
| `m` | monster, horizontal | `w` | monster, vertical |
| `P` | player start | `.` | empty |

Every level's trophy, door and pickups were verified reachable against the jump arc the
engine actually produces (2 rows up, 3 tiles across) before shipping. If you edit a
level, re-run that check — a 4-tile gap or a fire on the lip of a water pit makes a
level impossible in a way that is easy to miss by eye.

### Editing at runtime

```js
game.paint(col, row, '#');          // paint a tile into game.raw
game.currentLevelSource();          // string[] for the current level
game.commitEdits();                 // write game.raw back into game.levels
game.emptyLevel();                  // bordered blank with a start point
view.draw(game, { edit: true });    // draws game.raw, no entities
```

Persist `game.levels` as JSON wherever you like.

## Scoring

Gem 150 · chest 1000 · trophy 1000 · monster 300 · door 500 plus 250 per remaining life.
All in `SCORE`, exported from `engine.js`.


## Blaster, space pack, random levels, stress test

- Blaster (G): +10 charges, recharges 1 every 110 frames up to 6, hold X / F to auto-fire every 11 frames.
  Shots auto-aim at the nearest enemy or enemy shot in front (up to ~60° up/down), so saucers and the boss
  can be hit from the ground; bolts also pop enemy shots. Ctrl still works but Ctrl+arrow switches desktops
  on macOS, so X / F are the primary keys.
- Space pack (J): Z / C / Alt toggles flight; worn on Ritam's back whenever it has fuel.
- `levelgen.js` — `generateLevel(seed)` builds a random level for one of the four worlds from the segment
  templates, always with the blaster and space pack at the start. Every candidate must pass a geometry
  bot (weaker jump/run) and `playthrough()` — a best-first search over the real engine with live enemies,
  moving platforms and one life — at normal settings and again with weak physics, 25% faster enemies and
  no space pack. Failures reroll the seed (~0.3 s average).
- Stress test results (one life, no deaths allowed): all 20 levels finish at normal and weak settings;
  51/51 generated random levels pass both.
