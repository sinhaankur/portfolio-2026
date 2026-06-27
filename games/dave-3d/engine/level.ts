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

// Helper: a stepped climb of N boxes from a start to an end (so AABB stays clean).
function steps(
  from: Vec3,
  step: Vec3,
  count: number,
  size: Vec3,
): Box[] {
  const out: Box[] = []
  for (let i = 0; i < count; i++) {
    out.push({
      pos: [from[0] + step[0] * i, from[1] + step[1] * i, from[2] + step[2] * i],
      size,
    })
  }
  return out
}

// ── LEVEL 1 — the authentic Dangerous Dave opening screen, transcribed tile-for-
//    tile from the original: a red-brick room with two checkerboarded rows of
//    floating pedestals (each topped with a cyan diamond), the gold cup on the
//    centre pedestal, two long lower platforms, the door bottom-centre-right on a
//    step, the iconic pipe bottom-left, a purple gem top-left and a ruby top-right.
//    Row 0 = top. Bottom solid row is the floor. (See reference screenshot.)
const L1: Level = fromTiles(
  [
    "####################", // 0  top wall
    "#o                *#", // 1  purple gem (left), ruby (right)
    "#                  #", // 2
    "#  . .  . .  C  . . #", // 3  diamonds over the upper pedestals + cup diamond
    "#  ###  ###  ##  ####", // 4  upper pedestals (cup sits on the centre one)
    "#                  #", // 5
    "# .   . .  . .  . . #", // 6  diamonds over the middle pedestals
    "#    ###  ###  ###  #", // 7  middle pedestals
    "#                  #", // 8
    "# .    .           #", // 9  low diamonds
    "#  ######    ########", // 10 two long lower platforms
    "#P       @ ##D      #", // 11 pipe (left), spawn (open column), door on a step
    "####################", // 12 floor
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

// ── LEVEL 3 — Pipes & Tunnels: a Z-weaving route through low overhead blocks.
const L3: Level = {
  name: "3 — Pipes",
  spawn: [0, 1, 0],
  killY: -16,
  platforms: [
    { pos: [0, 0.5, 0], size: [7, 1, 7] },
    { pos: [6, 0.5, 4], size: [4, 1, 4] },
    { pos: [11, 0.5, -2], size: [4, 1, 4] },
    { pos: [16, 0.5, 4], size: [4, 1, 4] },
    { pos: [21, 1.0, -1], size: [6, 1, 7] }, // trophy terrace
    // overhead "pipe" blocks force ducking jumps (visual + collision)
    { pos: [6, 4.5, 4], size: [4, 1.2, 4] },
    { pos: [16, 4.5, 4], size: [4, 1.2, 4] },
    { pos: [27, 1.4, 3], size: [4, 1, 4] },
    { pos: [32, 1.8, -2], size: [4, 1, 4] },
    { pos: [38, 2.4, 0], size: [6, 1, 6] }, // door terrace
  ],
  hazards: [
    { pos: [13.5, 0.1, 1], size: [3, 0.4, 6], kind: "spike" },
  ],
  gems: [
    [6, 1.6, 4],
    [11, 1.6, -2],
    [16, 1.6, 4],
    [27, 2.5, 3],
    [32, 2.9, -2],
  ],
  trophy: [21, 2.1, 0],
  door: [38, 3.5, 0],
}

// ── LEVEL 4 — Fire Pits: lava-floor hazard; hop the safe islands.
const L4: Level = {
  name: "4 — Fire Pits",
  spawn: [0, 1, 0],
  killY: -16,
  platforms: [
    { pos: [0, 0.5, 0], size: [7, 1, 7] },
    { pos: [6, 1.2, 0], size: [2.6, 1, 2.6] },
    { pos: [10.5, 1.6, 1.5], size: [2.6, 1, 2.6] },
    { pos: [15, 2.0, -1], size: [2.6, 1, 2.6] },
    { pos: [20, 2.6, 0], size: [6, 1, 7] }, // trophy terrace
    { pos: [26, 3.0, 2], size: [2.6, 1, 2.6] },
    { pos: [30.5, 3.4, -1], size: [2.6, 1, 2.6] },
    { pos: [35, 3.8, 1.5], size: [2.6, 1, 2.6] },
    { pos: [40, 4.4, 0], size: [6, 1, 6] }, // door terrace
  ],
  hazards: [
    // a wide fire floor below the island run
    { pos: [13, 0.2, 0], size: [16, 0.5, 8], kind: "fire" },
    { pos: [32, 1.6, 0], size: [14, 0.5, 8], kind: "fire" },
  ],
  gems: [
    [6, 2.3, 0],
    [10.5, 2.7, 1.5],
    [15, 3.1, -1],
    [30.5, 4.5, -1],
    [35, 4.9, 1.5],
  ],
  trophy: [20, 3.7, 0],
  door: [40, 5.5, 0],
}

// ── LEVEL 5 — Water & Tight Jumps: water hazard + narrow precision pads.
const L5: Level = {
  name: "5 — Flooded",
  spawn: [0, 1, 0],
  killY: -16,
  platforms: [
    { pos: [0, 0.5, 0], size: [7, 1, 7] },
    { pos: [6, 0.8, 0], size: [1.8, 1, 1.8] },
    { pos: [10, 1.0, 2], size: [1.8, 1, 1.8] },
    { pos: [14, 1.2, -1.5], size: [1.8, 1, 1.8] },
    { pos: [18, 1.6, 1], size: [1.8, 1, 1.8] },
    { pos: [23, 2.0, 0], size: [6, 1, 7] }, // trophy terrace
    { pos: [29, 2.4, -2], size: [1.8, 1, 1.8] },
    { pos: [33, 2.8, 1.5], size: [1.8, 1, 1.8] },
    { pos: [37, 3.2, -1], size: [1.8, 1, 1.8] },
    { pos: [42, 3.8, 0], size: [6, 1, 6] }, // door terrace
  ],
  hazards: [
    { pos: [12, 0.0, 0], size: [20, 0.6, 10], kind: "water" },
    { pos: [34, 1.4, 0], size: [16, 0.6, 10], kind: "water" },
  ],
  gems: [
    [6, 1.9, 0],
    [10, 2.1, 2],
    [14, 2.3, -1.5],
    [18, 2.7, 1],
    [33, 3.9, 1.5],
  ],
  trophy: [23, 3.1, 0],
  door: [42, 4.9, 0],
}

// ── LEVEL 6 — JETPACK: grab the jetpack early, then FLY a long vertical gauntlet
//    of floating rings of fire. (The original Dave's signature jetpack level.)
const L6: Level = {
  name: "6 — Jetpack",
  spawn: [0, 1, 0],
  killY: -16,
  jetpack: [4, 2.0, 0],
  platforms: [
    { pos: [0, 0.5, 0], size: [8, 1, 8] }, // launch pad (jetpack sits here)
    // tall pillars to weave between while flying
    { pos: [12, 6, 4], size: [2.5, 14, 2.5] },
    { pos: [18, 9, -4], size: [2.5, 16, 2.5] },
    { pos: [24, 5, 3], size: [2.5, 12, 2.5] },
    { pos: [30, 11, 0], size: [6, 1, 7] }, // high trophy terrace (must fly up)
    { pos: [38, 7, -3], size: [2.5, 16, 2.5] },
    { pos: [44, 12, 2], size: [2.5, 18, 2.5] },
    { pos: [50, 14, 0], size: [7, 1, 7] }, // high door terrace
  ],
  hazards: [
    // floating fire rings to dodge mid-flight
    { pos: [15, 12, 0], size: [3, 3, 3], kind: "fire" },
    { pos: [27, 9, 0], size: [3, 3, 3], kind: "fire" },
    { pos: [41, 14, 0], size: [3, 3, 3], kind: "fire" },
  ],
  gems: [
    [12, 13.5, 4],
    [18, 17.5, -4],
    [30, 12.5, 2.5],
    [44, 21.5, 2],
    [50, 15.5, 0],
  ],
  trophy: [30, 12.7, 0],
  door: [50, 15.1, 0],
}

// ── LEVEL 7 — The Climb: a tight vertical ascent, spikes on the misses.
const L7: Level = {
  name: "7 — The Climb",
  spawn: [0, 1, 0],
  killY: -16,
  platforms: [
    { pos: [0, 0.5, 0], size: [7, 1, 7] },
    ...steps([5, 1.4, 0], [0, 1.0, 2.2], 4, [3, 1, 2.6]),
    { pos: [5, 6.4, 9.5], size: [6, 1, 6] }, // trophy terrace
    ...steps([5, 7.2, 9.5], [2.4, 0.9, -2.0], 5, [2.8, 1, 2.6]),
    { pos: [17, 11.7, 0], size: [7, 1, 7] }, // door terrace
  ],
  hazards: [
    { pos: [5, 0.1, 5], size: [6, 0.4, 4], kind: "spike" },
    { pos: [11, 7.0, 6], size: [4, 0.4, 4], kind: "spike" },
  ],
  gems: [
    [5, 2.5, 2.2],
    [5, 4.5, 6.6],
    [5, 7.5, 9.5],
    [10, 9.5, 6],
    [14.5, 11.3, 2],
  ],
  trophy: [5, 7.5, 9.5],
  door: [17, 12.8, 0],
}

// ── LEVEL 8 — The Gauntlet: a long horizontal run mixing every hazard so far.
const L8: Level = {
  name: "8 — Gauntlet",
  spawn: [0, 1, 0],
  killY: -16,
  platforms: [
    { pos: [0, 0.5, 0], size: [7, 1, 7] },
    { pos: [7, 0.5, 0], size: [3, 1, 5] },
    { pos: [13, 0.8, 0], size: [2.4, 1, 2.4] }, // fire gap
    { pos: [18, 1.0, 2], size: [2.4, 1, 2.4] },
    { pos: [23, 1.2, 0], size: [6, 1, 7] }, // trophy terrace
    { pos: [29, 1.4, 0], size: [3, 1, 5] }, // spike gap
    { pos: [35, 1.6, -2], size: [2.2, 1, 2.2] }, // water gap
    { pos: [40, 1.8, 1.5], size: [2.2, 1, 2.2] },
    { pos: [45, 2.2, 0], size: [3, 1, 5] },
    { pos: [51, 2.8, 0], size: [6, 1, 6] }, // door terrace
  ],
  hazards: [
    { pos: [10.5, 0.2, 0], size: [3, 0.5, 6], kind: "fire" },
    { pos: [15.5, 0.2, 1], size: [3, 0.5, 6], kind: "fire" },
    { pos: [31.5, 1.0, 0], size: [2.4, 0.4, 6], kind: "spike" },
    { pos: [37.5, 0.6, 0], size: [10, 0.6, 10], kind: "water" },
  ],
  gems: [
    [7, 1.6, 0],
    [18, 2.1, 2],
    [23, 2.3, 2.5],
    [40, 2.9, 1.5],
    [45, 3.3, 0],
  ],
  trophy: [23, 2.3, 0],
  door: [51, 3.9, 0],
}

// ── LEVEL 9 — Trap Maze: a denser branching field of pads + many hazards.
const L9: Level = {
  name: "9 — Trap Maze",
  spawn: [0, 1, 0],
  killY: -16,
  platforms: [
    { pos: [0, 0.5, 0], size: [7, 1, 7] },
    { pos: [6, 0.8, 3], size: [2.4, 1, 2.4] },
    { pos: [6, 0.8, -3], size: [2.4, 1, 2.4] },
    { pos: [11, 1.0, 0], size: [2.4, 1, 2.4] },
    { pos: [16, 1.2, 4], size: [2.4, 1, 2.4] },
    { pos: [16, 1.2, -4], size: [2.4, 1, 2.4] },
    { pos: [21, 1.6, 0], size: [6, 1, 7] }, // trophy terrace
    { pos: [27, 2.0, 3], size: [2.2, 1, 2.2] },
    { pos: [31, 2.4, -2], size: [2.2, 1, 2.2] },
    { pos: [35, 2.8, 2], size: [2.2, 1, 2.2] },
    { pos: [39, 3.0, -2], size: [2.2, 1, 2.2] },
    { pos: [44, 3.6, 0], size: [6, 1, 6] }, // door terrace
  ],
  hazards: [
    { pos: [11, 0.1, 3], size: [3, 0.4, 3], kind: "spike" },
    { pos: [11, 0.1, -3], size: [3, 0.4, 3], kind: "spike" },
    { pos: [29, 1.2, 0], size: [10, 0.5, 12], kind: "fire" },
    { pos: [37, 1.6, 0], size: [10, 0.5, 12], kind: "fire" },
  ],
  gems: [
    [6, 1.9, 3],
    [16, 2.3, 4],
    [16, 2.3, -4],
    [27, 3.1, 3],
    [35, 3.9, 2],
  ],
  trophy: [21, 2.7, 0],
  door: [44, 4.7, 0],
}

// ── LEVEL 10 — Final Ascent: the hardest climb, all hazards, plus a HIDDEN warp
//    pad off the main path (the original's secret). Reach the door to win it all.
const L10: Level = {
  name: "10 — Final Ascent",
  spawn: [0, 1, 0],
  killY: -16,
  warp: [3, 2.2, -10], // hidden off to the side — a secret skip / easter egg
  platforms: [
    { pos: [0, 0.5, 0], size: [8, 1, 9] },
    // the secret warp pad ledge, tucked behind spawn
    { pos: [3, 1.4, -10], size: [3, 1, 3] },
    // brutal stepped + gapped climb
    { pos: [7, 1.4, 0], size: [2.4, 1, 2.4] },
    { pos: [11, 2.2, 2], size: [2.2, 1, 2.2] },
    { pos: [15, 3.0, -2], size: [2.2, 1, 2.2] },
    { pos: [19, 3.8, 0], size: [6, 1, 7] }, // trophy terrace
    { pos: [25, 4.6, 3], size: [2.0, 1, 2.0] },
    { pos: [29, 5.6, -2], size: [2.0, 1, 2.0] },
    { pos: [33, 6.6, 2], size: [2.0, 1, 2.0] },
    { pos: [37, 7.6, -1], size: [2.0, 1, 2.0] },
    { pos: [42, 8.8, 0], size: [7, 1, 7] }, // final door terrace
  ],
  hazards: [
    { pos: [9, 0.6, 0], size: [10, 0.5, 9], kind: "fire" },
    { pos: [13, 1.4, 0], size: [10, 0.5, 9], kind: "fire" },
    { pos: [27, 4.0, 0], size: [12, 0.5, 10], kind: "spike" },
    { pos: [35, 6.0, 0], size: [12, 0.5, 10], kind: "spike" },
  ],
  gems: [
    [7, 2.5, 0],
    [11, 3.3, 2],
    [19, 4.9, 2.5],
    [29, 6.7, -2],
    [37, 8.7, -1],
  ],
  trophy: [19, 4.9, 0],
  door: [42, 9.9, 0],
}

/** The full 10-level campaign, in play order. */
export const LEVELS: Level[] = [L1, L2, L3, L4, L5, L6, L7, L8, L9, L10]

/** Back-compat: existing imports of LEVEL_1 keep working (now = first level). */
export const LEVEL_1: Level = L1
