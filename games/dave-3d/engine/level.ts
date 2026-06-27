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
  /** world width/height of a "side" room (for camera framing + bounds) */
  bounds?: { w: number; h: number }
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
 * Adjacent '#' cells are emitted as merged horizontal runs (fewer, wider boxes
 * → cleaner AABB collision and fewer draw calls).
 * ────────────────────────────────────────────────────────────────────────── */
export const TILE = 1.4          // world units per tile
const DEPTH = TILE               // thin slab depth on Z for side levels

export type TileMeta = {
  name: string
  brick?: string
  /** chars to treat as decorative pipes (rendered, no collision) */
}

export function fromTiles(rows: string[], meta: TileMeta): Level {
  const h = rows.length
  const w = Math.max(...rows.map((r) => r.length))
  const cell = (cx: number, cy: number) => rows[cy]?.[cx] ?? " "
  // world position of a tile CENTER. cy=0 is the TOP row; bottom row → y=0.
  const wx = (cx: number) => (cx - (w - 1) / 2) * TILE
  const wy = (cy: number) => (h - 1 - cy) * TILE

  const platforms: Box[] = []
  const gems: Vec3[] = []
  const gemKinds: GemKind[] = []
  const pipes: Vec3[] = []
  const hazards: Hazard[] = []
  let trophy: Vec3 = [0, 0, 0]
  let door: Vec3 = [0, 0, 0]
  let spawn: Vec3 = [0, 1, 0]
  let jetpack: Vec3 | undefined
  let warp: Vec3 | undefined

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
        case "X": warp = [x, y, 0]; break
        case "P": pipes.push([x, y, 0]); break
      }
    }
  }

  return {
    name: meta.name,
    style: "side",
    brick: meta.brick,
    bounds: { w: w * TILE, h: h * TILE },
    spawn,
    platforms,
    gems,
    gemKinds,
    pipes: pipes.length ? pipes : undefined,
    hazards: hazards.length ? hazards : undefined,
    trophy,
    door,
    jetpack,
    warp,
    killY: -TILE * 3, // a few tiles below the floor
  }
}


// ── LEVEL 1 — the authentic Dangerous Dave opening screen, transcribed tile-for-
//    tile from the original: a red-brick room with two checkerboarded rows of
//    floating pedestals (each topped with a cyan diamond), the gold cup on the
//    centre pedestal, two long lower platforms, the door bottom-centre-right on a
//    step, the iconic pipe bottom-left, a purple gem top-left and a ruby top-right.
//    Row 0 = top. Bottom solid row is the floor. (See reference screenshot.)
// Built from the ORIGINAL Dangerous Dave (AkhilRaja/Dave source) exact pixel
// coords → tile grid. Bordered red-brick room; a checkerboard of 2-wide brick
// pedestals each topped with a cyan diamond; the gold CUP on the centre pedestal;
// a purple ball (top-left) and a ruby (top-right); two long lower platforms; the
// door on a step bottom-centre-right; the iconic pipe bottom-left.
// Cols 0-18 (19 wide), rows 0-12 (0=top, 12=floor).
const L1: Level = fromTiles(
  // 0         1
  // 0123456789012345678   (every row is exactly 19 chars)
  [
    "###################", // 0  top wall
    "#o .   .   C   . *#", // 1  ball, upper diamonds, CUP (centre), ruby
    "#  ##  ##  ##  ## #", // 2  upper pedestals (cup sits on the col-11 one)
    "#.   .   .   .   .#", // 3  middle + edge diamonds
    "#    ##  ##  ##   #", // 4  middle pedestals (offset checkerboard)
    "#                 #", // 5
    "# .     .         #", // 6  two low diamonds
    "#                 #", // 7
    "#          D      #", // 8  door — rests on the right lower platform
    "#                 #", // 9
    "# ######   ########", // 10 two long lower platforms (gap cols 8-10)
    "#P@               #", // 11 pipe + spawn (bottom-left)
    "###################", // 12 floor
  ],
  { name: "1 — The Cavern", brick: "#b3361f" },
)

// ── LEVEL 2 — the authentic Dave L2, a WIDE scrolling screen transcribed from the
//    three reference shots: purple (`=`) floating platforms over a fire floor with
//    a water pool, red-brick (`#`) columns and a maze on the right, the gold cup on
//    a brick ledge mid-right, a row of cyan diamonds, rubies + purple balls, and the
//    door up top-right. Fire (`F`) + water (`W`) span the bottom. Spawn mid-left.
const L2: Level = fromTiles(
  [
    "##########################################", // 0  top wall
    "#*           .            #####      #####", // 1  ruby, diamond / right maze ceiling
    "#  ==    ==          ==    #   #  D       #", // 2  upper purple platforms, door (right)
    "#                ====      #   ####   ### #", // 3  centre-high purple ledge
    "#   ==        .       =    #####   #     ##", // 4
    "#        @                 #   . ####  o  #", // 5  spawn (mid-left)
    "#   ===  ===   *     ===.  ### ###   ###  #", // 6  spawn platform + purple ledges, ruby
    "#                =====  C  #   o   #   #  #", // 7  cup on a brick ledge (mid-right)
    "#  ===           o     ====#####   ### ## #", // 8  purple platforms, purple ball
    "#       . . . .           #   ###     #   #", // 9
    "#  ====        ====   ====### . . . .##   #", // 10 lower purple platforms + diamond row
    "#FFFFFFFFFFFFFFWWWWFFF#####FFFFFFFFFFFFFF #", // 11 fire floor + water pool + brick maze base
    "##########################################", // 12 floor
  ],
  { name: "2 — The Descent", brick: "#b3361f" },
)

// ── LEVEL 3 — Pipes & Tunnels: overhead brick "pipes" with a spike pit below.
const L3: Level = fromTiles(
  [
    "###################", // 0
    "# .   .   .   .   #", // 1  diamonds over the upper pedestals
    "# ##  ##  ##  ##  #", // 2  upper pedestals
    "#                 #", // 3
    "#   .     C    .  #", // 4  diamonds + CUP (centre)
    "#  ###   ###  ### #", // 5  mid pedestals (cup sits on the centre one)
    "#                 #", // 6
    "# @             D #", // 7  spawn (left) + door (right) on the lower walk
    "######  ####  #####", // 8  lower walkway with gaps
    "#       .         #", // 9  a diamond down in a gap
    "#######  ######## #", // 10 floor ledges
    "#      ##         #", // 11 small step
    "###################", // 12 floor
  ],
  { name: "3 — Pipes", brick: "#b3361f" },
)

// ── LEVEL 4 — Fire Pits: hop the islands; fire burns in the floor gaps.
const L4: Level = fromTiles(
  [
    "###################", // 0
    "#                 #", // 1
    "#                 #", // 2
    "#  .    C    .    #", // 3  diamonds + CUP
    "#  ##   ##   ##   #", // 4  upper pedestals
    "#     .     .     #", // 5
    "#    ###   ###    #", // 6  mid pedestals
    "#              .  #", // 7
    "# ##  ##  ##  ### #", // 8  stepping stones
    "#                 #", // 9
    "#   ###  ###  ### #", // 10 islands over the fire
    "# @    FF   FF  D #", // 11 spawn, fire gaps, door
    "###################", // 12 floor
  ],
  { name: "4 — Fire Pits", brick: "#b3361f" },
)

// ── LEVEL 5 — Flooded: water in the floor gaps; thread the tight pads.
const L5: Level = fromTiles(
  [
    "###################", // 0
    "#                 #", // 1
    "#  .       C   .  #", // 2  diamonds + CUP
    "#  #   #   #   #  #", // 3  thin pillars
    "#    .   .   .    #", // 4
    "#    #   #   #    #", // 5  thin pads
    "#       .         #", // 6
    "# ##    ##    ### #", // 7  ledges
    "#                 #", // 8
    "#                 #", // 9
    "#   ###  ###  ### #", // 10 islands over the water
    "# @    WW   WW  D #", // 11 spawn, water gaps, door
    "###################", // 12 floor
  ],
  { name: "5 — Flooded", brick: "#2f6fb0" },
)

// ── LEVEL 6 — JETPACK: grab the pack on the floor, then FLY up to the high cup
//    (left) and the high door (right), weaving the fire. Dave's signature level.
const L6: Level = fromTiles(
  [
    "###################", // 0
    "#                 #", // 1
    "# #C##    .  ##D# #", // 2  high cup (left) + high door (right)
    "#                 #", // 3
    "#                 #", // 4
    "#       F.        #", // 5  fire to fly around
    "#                 #", // 6
    "#  . F      F  .  #", // 7
    "#                 #", // 8
    "#                 #", // 9
    "# @ J             #", // 10 spawn + jetpack on the floor
    "###################", // 11 floor
    "###################", // 12
  ],
  { name: "6 — Jetpack", brick: "#6a3da0" },
)

// ── LEVEL 7 — The Climb: a tight vertical ascent; spikes punish a missed jump.
const L7: Level = fromTiles(
  [
    "###################", // 0
    "#         C       #", // 1  CUP at the top
    "#       #####     #", // 2
    "#        .        #", // 3
    "#      ####       #", // 4
    "#     .     .     #", // 5
    "#    ####  ###    #", // 6
    "#   .       .     #", // 7
    "#  ###      ###   #", // 8
    "#     .       .D  #", // 9  door on the right ledge
    "#    ####    #### #", // 10
    "# @      ^^       #", // 11 spawn + spikes in the floor gap
    "###################", // 12 floor
  ],
  { name: "7 — The Climb", brick: "#b3361f" },
)

// ── LEVEL 8 — The Gauntlet: a long run mixing fire, spikes and water.
const L8: Level = fromTiles(
  [
    "###################", // 0
    "#                 #", // 1
    "#                 #", // 2
    "#  .     C    .   #", // 3  diamonds + CUP
    "#  ##    ##   ##  #", // 4
    "#     .     .     #", // 5
    "#     ##    ##    #", // 6
    "#                 #", // 7
    "# ##   ##  ##  ## #", // 8
    "#                 #", // 9
    "#    ###   ###    #", // 10
    "# @   F  ^^  WW D #", // 11 spawn, every hazard, door
    "###################", // 12 floor
  ],
  { name: "8 — Gauntlet", brick: "#b3361f" },
)

// ── LEVEL 9 — Trap Maze: a dense branching field of pads + hazards.
const L9: Level = fromTiles(
  [
    "###################", // 0
    "#                 #", // 1
    "# .    C    .   . #", // 2  diamonds + CUP
    "# ##   ##   ##  ###", // 3
    "#   .    .    .   #", // 4
    "#   ##   ##   ##  #", // 5
    "#                 #", // 6
    "# ##  ##   ##  ## #", // 7
    "#                 #", // 8
    "#                 #", // 9
    "#   ###  ###  ### #", // 10
    "# @   FF    ^^   D#", // 11 spawn, fire + spikes, door
    "###################", // 12 floor
  ],
  { name: "9 — Trap Maze", brick: "#b3361f" },
)

// ── LEVEL 10 — Final Ascent: the hardest climb, all hazards, plus a HIDDEN warp
//    pad far-right on the floor (the original's secret skip). Reach the door to win.
const L10: Level = fromTiles(
  [
    "###################", // 0
    "#                 #", // 1
    "#      #####      #", // 2
    "#        C        #", // 3  CUP near the top
    "#  ###   ###      #", // 4
    "#   .     .       #", // 5
    "#    ###   ###    #", // 6
    "#     .     .     #", // 7
    "# ###    ###  ### #", // 8
    "#  D  .        .  #", // 9  door on the left ledge
    "#    ###      ### #", // 10
    "# @     F^^ F    X#", // 11 spawn, hazards, hidden warp (far right)
    "###################", // 12 floor
  ],
  { name: "10 — Final Ascent", brick: "#7a1f1f" },
)

/** The full 10-level campaign, in play order. */
export const LEVELS: Level[] = [L1, L2, L3, L4, L5, L6, L7, L8, L9, L10]

/** Back-compat: existing imports of LEVEL_1 keep working (now = first level). */
export const LEVEL_1: Level = L1
