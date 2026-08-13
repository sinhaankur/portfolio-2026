/**
 * Dave 3D — level data. A recognizable 3D homage to the 1988 *Dangerous Dave*
 * 10-level campaign: each level is a set of solid 3D platform boxes plus
 * collectibles, hazards, the two objectives (cup/trophy, then door), and an
 * optional jetpack. Reach the door WITH the cup to advance to the next level.
 *
 * Coordinates: Y is up. The hero spawns on the start pad and works through a
 * designed course to the trophy then the door. Difficulty rises across the 10.
 *
 * NOTE on geometry: collision is axis-aligned-box (AABB) only, so every solid
 * here is a box. "Ramps" are stepped boxes. Hazards are also boxes: touching one
 * costs the player a respawn (back to the level's spawn). Boxes give us a real,
 * verifiable level today; freeform Blender geometry would need a mesh-collider
 * rewrite (parked).
 */

import type { Theme } from "./atmosphere"

export type Vec3 = [number, number, number]

export type Box = {
  /** center position */
  pos: Vec3
  /** full size (width, height, depth) */
  size: Vec3
  /** optional brick colour override (else uses the level's `brick`) */
  tint?: string
}

/** A hazard volume — touching it respawns the player. `kind` drives the look. */
export type Hazard = {
  pos: Vec3
  size: Vec3
  kind: "spike" | "fire" | "water"
}

/** gem look: cyan diamond, purple ball, or red ruby (all worth collecting). */
export type GemKind = "diamond" | "ball" | "ruby"

/**
 * An enemy — the real Dangerous Dave roster. `kind` drives the look + score;
 * `move` drives the motion pattern around the anchor `pos`. Touching an enemy
 * (or its shot) kills Dave. Most shoot; a couple don't (matching the original).
 *
 *   spider   L3  — spins a circular circuit, shoots            (300)
 *   blade    L4  — a purple spinning blade, no shots           (—)
 *   sun      L5  — red sun, counter-clockwise ellipse, shoots  (500)
 *   baton    L6  — green baton, moves horizontally, shoots     (600)
 *   cloud    L7  — cloud thing, spins + shoots                 (700)
 *   ufo      L8  — brown UFO, wobbles + shoots                 (800)
 *   blobby   L9  — green blob, moves horizontally, no gun      (900)
 *   disc     L10 — grey disc, moves left-right, shoots         (1000)
 */
export type EnemyKind =
  | "spider" | "blade" | "sun" | "baton" | "cloud" | "ufo" | "blobby" | "disc"

/** How an enemy moves around its anchor position. */
export type EnemyMove =
  | "stationary"          // holds position (still spins visually)
  | "patrolX"             // ↔ back-and-forth horizontally over `span`
  | "patrolY"             // ↕ back-and-forth vertically over `span`
  | "ellipse"             // elliptical orbit (span = [rx, ry])
  | "circle"              // circular circuit (span = radius)
  | "wobble"              // small jitter around the anchor

export type Enemy = {
  kind: EnemyKind
  /** anchor position (centre of the motion path) */
  pos: Vec3
  move: EnemyMove
  /** motion extent: patrol half-length, circle radius, or [rx, ry] for ellipse */
  span?: number | [number, number]
  /** motion speed multiplier (1 = default per-kind speed) */
  speed?: number
  /** does it fire at Dave? (defaults per-kind; blade/blobby never do) */
  shoots?: boolean
}

/** Per-kind defaults: base score, whether it shoots, and a tint for the look. */
export const ENEMY_SPEC: Record<EnemyKind, { score: number; shoots: boolean; tint: string }> = {
  spider: { score: 300, shoots: true, tint: "#c94db0" },
  blade: { score: 0, shoots: false, tint: "#a838d6" },
  sun: { score: 500, shoots: true, tint: "#ff5a3c" },
  baton: { score: 600, shoots: true, tint: "#4fd06a" },
  cloud: { score: 700, shoots: true, tint: "#bcd6ff" },
  ufo: { score: 800, shoots: true, tint: "#b98a4a" },
  blobby: { score: 900, shoots: false, tint: "#4fbf3a" },
  disc: { score: 1000, shoots: true, tint: "#9aa2ad" },
}

export type Level = {
  /** short title shown on the HUD ("1 — Cavern") */
  name: string
  spawn: Vec3
  platforms: Box[]
  gems: Vec3[]
  /** per-gem look, parallel to `gems` (defaults to diamond if absent) */
  gemKinds?: GemKind[]
  /** decorative pipe positions (rendered, no collision) */
  pipes?: Vec3[]
  trophy: Vec3
  door: Vec3
  /** hazards that respawn the player on contact */
  hazards?: Hazard[]
  /** enemies — touching one (or its shot) kills the player */
  enemies?: Enemy[]
  /** if present, a gun pickup at this position lets Dave shoot enemies */
  gun?: Vec3
  /** if present, a jetpack pickup at this position grants temporary flight */
  jetpack?: Vec3
  /** if present, a hidden warp pad that skips to the credits / final beat */
  warp?: Vec3
  /** below this Y the player has fallen and respawns */
  killY: number
  /**
   * "side" = a flat, side-on Dave screen (move left/right + jump only; camera
   * looks along -Z at the X/Y plane). "free" = the original free-roam 3D course.
   * Faithful Dave remakes use "side".
   */
  style?: "side" | "free"
  /** tint of the brick walls/platforms for this level (Dave recolours per level) */
  brick?: string
  /** background/fog tint for the level's cavern air (near-black, per-level hue) */
  bg?: string
  /** world width/height of a "side" room (for camera framing + bounds) */
  bounds?: { w: number; h: number }
  /** atmosphere theme — drives the decorative back-world + set-dressing */
  theme?: Theme
}

/* ──────────────────────────────────────────────────────────────────────────
 * Tile-grid authoring — transcribe a Dangerous Dave screen as an ASCII map and
 * get a side-on 3D level out. One char = one TILE (TILE units in world space).
 * Rows are top→bottom; the bottom row sits at y=0. This lets each real Dave
 * screen be matched cell-for-cell against its screenshot.
 *
 * Legend:
 *   #  brick (solid platform / wall)        space  empty
 *   .  cyan diamond (gem)                    o  purple ball gem
 *   *  ruby gem                              C  the gold cup (trophy)
 *   D  the exit door                         @  player spawn
 *   ^  spikes (hazard)                       F  fire (hazard)
 *   W  water (hazard)                        P  decorative pipe (no collision)
 *   J  jetpack pickup                        X  hidden warp pad
 *   G  gun pickup (lets Dave shoot)
 * Enemies (touch = death; letter → kind, default motion in fromTiles):
 *   S spider   B blade    U sun     T baton
 *   L cloud    Y ufo      Z blobby  E disc
 * Adjacent '#' cells are emitted as merged horizontal runs (fewer, wider boxes
 * → cleaner AABB collision and fewer draw calls).
 * ────────────────────────────────────────────────────────────────────────── */
export const TILE = 1.4          // world units per tile
const DEPTH = TILE               // thin slab depth on Z for side levels

export type TileMeta = {
  name: string
  brick?: string
  /** per-level background/fog tint (near-black; keeps each screen's own mood) */
  bg?: string
  /** atmosphere theme for the decorative back-world */
  theme?: Theme
}

export function fromTiles(rows: string[], meta: TileMeta): Level {
  const h = rows.length
  const w = Math.max(...rows.map((r) => r.length))
  // A ragged row means a transcription typo — mistiled maps fail fast rather
  // than shipping a room with a hole in its wall.
  const ragged = rows.findIndex((r) => r.length !== w)
  if (ragged !== -1)
    throw new Error(`fromTiles(${meta.name}): row ${ragged} is ${rows[ragged].length} chars, expected ${w}`)
  const cell = (cx: number, cy: number) => rows[cy]?.[cx] ?? " "
  // world position of a tile CENTER. cy=0 is the TOP row; bottom row → y=0.
  const wx = (cx: number) => (cx - (w - 1) / 2) * TILE
  const wy = (cy: number) => (h - 1 - cy) * TILE

  const platforms: Box[] = []
  const gems: Vec3[] = []
  const gemKinds: GemKind[] = []
  const pipes: Vec3[] = []
  const hazards: Hazard[] = []
  const enemies: Enemy[] = []
  let trophy: Vec3 = [0, 0, 0]
  let door: Vec3 = [0, 0, 0]
  let spawn: Vec3 = [0, 1, 0]
  let gun: Vec3 | undefined
  let jetpack: Vec3 | undefined
  let warp: Vec3 | undefined

  // Enemy tile letter → kind. Motion defaults are applied below (per the real
  // Dave roster); levels can override by supplying `enemies` directly instead.
  const ENEMY_CHAR: Record<string, EnemyKind> = {
    S: "spider", B: "blade", U: "sun", T: "baton",
    L: "cloud", Y: "ufo", Z: "blobby", E: "disc",
  }
  // Default motion + span per kind (matches the originals' feel).
  const ENEMY_MOVE: Record<EnemyKind, { move: EnemyMove; span?: number | [number, number] }> = {
    spider: { move: "circle", span: 1.4 },
    blade: { move: "stationary" },
    sun: { move: "ellipse", span: [1.8, 1.2] },
    baton: { move: "patrolX", span: 2.4 },
    cloud: { move: "circle", span: 1.2 },
    ufo: { move: "wobble", span: 0.6 },
    blobby: { move: "patrolX", span: 2.0 },
    disc: { move: "patrolX", span: 3.0 },
  }

  // solid chars: '#' = primary brick (level tint), '=' = secondary platform
  // (purple, Dave's L2 platforms). Both collide; only the colour differs.
  const isSolid = (ch: string) => ch === "#" || ch === "="
  const SECONDARY = "#a838d6" // purple platform tint

  for (let cy = 0; cy < h; cy++) {
    // merge horizontal runs of the SAME solid char into single boxes
    let cx = 0
    while (cx < w) {
      const ch = cell(cx, cy)
      if (isSolid(ch)) {
        let end = cx
        while (end < w && cell(end, cy) === ch) end++
        const run = end - cx
        const cxMid = cx + (run - 1) / 2
        platforms.push({
          pos: [wx(cxMid), wy(cy), 0],
          size: [run * TILE, TILE, DEPTH],
          tint: ch === "=" ? SECONDARY : undefined,
        })
        cx = end
        continue
      }
      cx++
    }
    // pass for the point items on this row
    for (let c = 0; c < w; c++) {
      const ch = cell(c, cy)
      const x = wx(c)
      const y = wy(cy)
      switch (ch) {
        case ".": gems.push([x, y, 0]); gemKinds.push("diamond"); break
        case "o": gems.push([x, y, 0]); gemKinds.push("ball"); break
        case "*": gems.push([x, y, 0]); gemKinds.push("ruby"); break
        case "C": trophy = [x, y, 0]; break
        case "D": door = [x, y, 0]; break
        case "@": spawn = [x, y + 0.05, 0]; break
        case "^": hazards.push({ pos: [x, y - TILE * 0.3, 0], size: [TILE, TILE * 0.4, DEPTH], kind: "spike" }); break
        case "F": hazards.push({ pos: [x, y - TILE * 0.25, 0], size: [TILE, TILE * 0.5, DEPTH], kind: "fire" }); break
        case "W": hazards.push({ pos: [x, y - TILE * 0.25, 0], size: [TILE, TILE * 0.5, DEPTH], kind: "water" }); break
        case "J": jetpack = [x, y, 0]; break
        case "G": gun = [x, y, 0]; break
        case "X": warp = [x, y, 0]; break
        case "P": pipes.push([x, y, 0]); break
        default: {
          const kind = ENEMY_CHAR[ch]
          if (kind) {
            const dflt = ENEMY_MOVE[kind]
            enemies.push({ kind, pos: [x, y, 0], move: dflt.move, span: dflt.span })
          }
        }
      }
    }
  }

  return {
    name: meta.name,
    style: "side",
    brick: meta.brick,
    bg: meta.bg,
    theme: meta.theme,
    bounds: { w: w * TILE, h: h * TILE },
    spawn,
    platforms,
    gems,
    gemKinds,
    pipes: pipes.length ? pipes : undefined,
    hazards: hazards.length ? hazards : undefined,
    enemies: enemies.length ? enemies : undefined,
    trophy,
    door,
    gun,
    jetpack,
    warp,
    killY: -TILE * 3, // a few tiles below the floor
  }
}


// ── VERTICAL RHYTHM (all levels) ──────────────────────────────────────────────
// Dave's jump clears exactly TWO tile-rows of height (apex ≈ 2.4 tiles — see
// player.tsx). So every climb in these maps steps up at most 2 rows at a time
// (floor → row-2 platform → row-4 pedestal → …), exactly like the original's
// tight vertical rhythm. Collectibles sit ONE row above a standable surface
// (walk-by pickup) or inside a jump arc. Doors always REST on a solid row.
// Breaking the 2-row rule makes a ledge unreachable — `pnpm dave:check`
// (scripts/validate-dave-levels.ts) verifies every item + door on every level.

// ── LEVEL 1 — the Dangerous Dave opening screen: a red-brick room, two
//    checkerboarded rows of gem-topped pedestals, the gold cup on the centre
//    pedestal, two long lower platforms, the door bottom-right on the floor, the
//    iconic pipe bottom-left, a purple ball top-left and a ruby top-right.
const L1: Level = fromTiles(
  // 0         1
  // 0123456789012345678   (every row is exactly 19 chars)
  [
    "###################", // 0  top wall
    "#                 #", // 1
    "#o .   .   C   . *#", // 2  ball, diamonds, CUP (centre), ruby
    "#  ##  ##  ##  ## #", // 3  upper pedestals (cup sits on the col-11 one)
    "#.   .   .   .   .#", // 4  middle gem row
    "#   ##   ##   ##  #", // 5  middle pedestals (offset checkerboard)
    "# .      .      . #", // 6  low gems above the long platforms
    "# ######   ########", // 7  two long lower platforms (gap cols 8-10)
    "#P@            D  #", // 8  pipe + spawn (left) · door on the floor (right)
    "###################", // 9  floor
  ],
  { name: "1 — The Cavern", brick: "#b3361f", bg: "#07040a", theme: "cavern" },
)

// ── LEVEL 2 — a WIDE scrolling screen: purple (`=`) floating platforms over a
//    fire floor with a water pool, a red-brick (`#`) structure on the right, the
//    gold cup on a mid-right ledge, and the door on a high right ledge. The
//    bottom walk row alternates safe floor and fire/water pits.
const L2: Level = fromTiles(
  [
    "##########################################", // 0  top wall
    "#*            .              .        D  #", // 1  ruby · diamonds · door (high right)
    "#  ==     ==       ==     ==     ==  #####", // 2  upper purple platforms + door ledge
    "#      .        o       .          .     #", // 3  gem row above the mid platforms
    "#    ==      ==      ==      ##     ==   #", // 4  mid platforms (purple + brick)
    "#  .      .       C       o        .     #", // 5  gems + CUP (centre-right ledge below)
    "# ==    ==      ####    ==     ==     == #", // 6  low-mid ledges (cup on the brick one)
    "#     .      .        .      *      .    #", // 7  gem row above the low platforms
    "#  ==     ==     ==      ==     ==    == #", // 8  low purple platforms
    "#     @      .       .       .      .   .#", // 9  spawn (above a SAFE island — col 2 dropped onto fire = death loop) + floor gems
    "#FFFF####WWWW####FFFF####WWWW####FFFF#####", // 10 fire/water pits between floor islands
    "##########################################", // 11 base
  ],
  { name: "2 — The Descent", brick: "#8a2f4a", bg: "#0a0410", theme: "void" },
)

// ── LEVEL 3 — Pipes & Tunnels: a mid-height walkway with jump-through gaps;
//    gems tucked underneath it, pedestal ladder above, door ON the walkway.
const L3: Level = fromTiles(
  [
    "###################", // 0
    "#                 #", // 1
    "# .   .   C   .   #", // 2  gem row + CUP
    "# ##  ##  ##  ##  #", // 3  upper pedestals
    "#        .        #", // 4
    "#   ##   ###   ## #", // 5  mid pedestals
    "# .    .        D #", // 6  gems + door ON the walkway
    "#####  ####  ######", // 7  walkway — 2-tile gaps (1-tile = a 0.6u threading window, unjumpable in practice)
    "#P@  .    .       #", // 8  spawn + gems in the under-tunnel
    "###################", // 9  floor
  ],
  { name: "3 — Pipes", brick: "#a06a28", bg: "#0a0703", theme: "machine" },
)

// ── LEVEL 4 — Fire Pits: fire pits punctuate the floor walk; island ladder up.
const L4: Level = fromTiles(
  [
    "###################", // 0
    "#                 #", // 1
    "#  .     C   .    #", // 2  gems + CUP
    "#  ##    ##  ##   #", // 3  upper pedestals
    "#     .      .    #", // 4
    "#    ##     ##    #", // 5  mid pedestals
    "# .            .  #", // 6
    "# ###  ###  ####  #", // 7  islands
    "#P@  F    F     D #", // 8  spawn · fire pits · door on the floor
    "###################", // 9  floor
  ],
  { name: "4 — Fire Pits", brick: "#9c2c14", bg: "#0c0402", theme: "fire" },
)

// ── LEVEL 5 — Flooded: water pools in the floor; thin pillars thread upward.
const L5: Level = fromTiles(
  [
    "###################", // 0
    "#                 #", // 1
    "#  .     C    .   #", // 2  gems + CUP
    "#  #     ##   #   #", // 3  thin pillars
    "#    .      .     #", // 4
    "#   ##      ##    #", // 5  thin pads
    "# .     .       . #", // 6
    "# ###  ####  #### #", // 7  ledges
    "#P@  W     W    D #", // 8  spawn · water pools · door on the floor
    "###################", // 9  floor
  ],
  { name: "5 — Flooded", brick: "#2f6fb0", bg: "#020710", theme: "flooded" },
)

// ── LEVEL 6 — JETPACK: grab the pack on the floor, then FLY up to the high cup
//    (left) and the high door (right), weaving the fire. Dave's signature level.
const L6: Level = fromTiles(
  [
    "###################", // 0
    "#                 #", // 1
    "# #C#    .    #D# #", // 2  high cup (left) + high door (right)
    "# ###         ### #", // 3  ledges the cup + door rest on
    "#     F       F   #", // 4  fire to fly around
    "#  .            . #", // 5
    "#      F   F      #", // 6
    "#                 #", // 7
    "#P@  J       .    #", // 8  spawn + jetpack on the floor
    "###################", // 9  floor
  ],
  { name: "6 — Jetpack", brick: "#6a3da0", bg: "#070312", theme: "void" },
)

// ── LEVEL 7 — The Climb: a tall zig-zag ascent to the cup; spikes on the floor.
const L7: Level = fromTiles(
  [
    "###################", // 0
    "#        C        #", // 1  CUP at the very top
    "#      #####      #", // 2  summit ledge
    "#   .         .   #", // 3
    "#  ###       ###  #", // 4
    "#      .   .      #", // 5
    "#     ##   ##     #", // 6
    "# .            .  #", // 7
    "# ###        ###  #", // 8
    "#          D      #", // 9  door on the low ledge
    "#P@  ^^   ####    #", // 10 spawn · spikes · door ledge
    "###################", // 11 floor
  ],
  { name: "7 — The Climb", brick: "#5a6b7a", bg: "#04070a", theme: "ice" },
)

// ── LEVEL 8 — The Gauntlet: every hazard on one floor run, pedestal ladder up.
const L8: Level = fromTiles(
  [
    "###################", // 0
    "#                 #", // 1
    "#  .     C     .  #", // 2  gems + CUP
    "#  ##    ##    ## #", // 3  upper pedestals
    "#     .      .    #", // 4
    "#    ##      ##   #", // 5  mid pedestals
    "# .      .      . #", // 6
    "# ###   ####  ### #", // 7  ledges
    "#P@  F  ^^  W   D #", // 8  spawn · fire · spikes · water · door
    "###################", // 9  floor
  ],
  { name: "8 — Gauntlet", brick: "#a04418", bg: "#0a0503", theme: "fire" },
)

// ── LEVEL 9 — Trap Maze: a dense branching field of pads over fire + spikes.
const L9: Level = fromTiles(
  [
    "###################", // 0
    "#                 #", // 1
    "# .    C    .   . #", // 2  gems + CUP
    "# ##   ##   ## ## #", // 3  upper pads
    "#    .    .       #", // 4
    "#   ##   ##   ##  #", // 5  mid pads
    "# .    .      .   #", // 6
    "# ##  ###  ##  ## #", // 7  low pads
    "#P@ FF   ^^     D #", // 8  spawn · fire · spikes · door
    "###################", // 9  floor
  ],
  { name: "9 — Trap Maze", brick: "#4f7a3a", bg: "#030803", theme: "cavern" },
)

// ── LEVEL 10 — Final Ascent: the hardest climb, all hazards, plus a HIDDEN warp
//    pad far-right on the floor (the original's secret skip). Reach the door to win.
const L10: Level = fromTiles(
  [
    "###################", // 0
    "#  C              #", // 1  CUP at the summit (left)
    "# ####            #", // 2  summit ledge
    "#      .      .   #", // 3
    "#     ###    ###  #", // 4
    "# .          .    #", // 5
    "# ###       ###   #", // 6
    "#     .   .       #", // 7
    "#    ##   ###     #", // 8
    "#            D    #", // 9  door on the low ledge
    "#P@ F ^^ F  #### X#", // 10 spawn · hazards · door ledge · hidden warp
    "###################", // 11 floor
  ],
  { name: "10 — Final Ascent", brick: "#7a1f1f", bg: "#0c0204", theme: "void" },
)

/** The full 10-level campaign, in play order. */
export const LEVELS: Level[] = [L1, L2, L3, L4, L5, L6, L7, L8, L9, L10]

/** Back-compat: existing imports of LEVEL_1 keep working (now = first level). */
export const LEVEL_1: Level = L1
