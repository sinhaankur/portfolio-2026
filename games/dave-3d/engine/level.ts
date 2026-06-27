/**
 * Dave 3D — level data. A level is a set of solid 3D platform boxes plus the
 * collectibles + the two objectives (trophy, then door). Hand-authored for
 * readable third-person jumps.
 *
 * Coordinates: Y is up. The hero spawns on the start pad and works through a
 * designed course — a climb, a branch, a gap run — to the trophy then the door.
 *
 * NOTE on geometry: collision is axis-aligned-box (AABB) only, so every solid
 * here is a box. "Ramps" are stepped boxes; freeform Blender geometry would need
 * a mesh-collider rewrite (parked). Boxes give us a real, verifiable level today.
 */

export type Vec3 = [number, number, number]

export type Box = {
  /** center position */
  pos: Vec3
  /** full size (width, height, depth) */
  size: Vec3
}

export type Level = {
  spawn: Vec3
  platforms: Box[]
  gems: Vec3[]
  trophy: Vec3
  door: Vec3
  /** below this Y the player has fallen and respawns */
  killY: number
}

// A larger, designed course: start plaza → a stepped climb → a branching choice
// (high gem run vs. safe path) → a gap crossing on small pads → the trophy
// terrace → a final ascent to the door. Built entirely from boxes so the AABB
// collision handles it cleanly.
export const LEVEL_1: Level = {
  spawn: [0, 1, 0],
  killY: -16,
  platforms: [
    // --- start plaza ---
    { pos: [0, 0.5, 0], size: [8, 1, 8] },

    // --- stepped climb (a "ramp" made of steps so AABB collision works) ---
    { pos: [6.5, 1.0, 0], size: [3, 1, 5] },
    { pos: [9.5, 1.8, 0], size: [3, 1, 5] },
    { pos: [12.5, 2.6, 0], size: [3, 1, 5] },
    { pos: [15.5, 3.4, 0], size: [3.5, 1, 6] },

    // --- branch point: a wide landing that splits two ways ---
    { pos: [20, 4.0, 0], size: [6, 1, 8] },

    // BRANCH A — the high, risky gem run (small floating pads, +Y)
    { pos: [25, 5.2, 3], size: [2.5, 1, 2.5] },
    { pos: [29, 6.2, 4], size: [2.5, 1, 2.5] },
    { pos: [33, 7.0, 2.5], size: [2.5, 1, 2.5] },

    // BRANCH B — the lower, safer path (broader ledges, gentle rise)
    { pos: [25.5, 4.4, -4], size: [4, 1, 4] },
    { pos: [30.5, 4.9, -4], size: [4, 1, 4] },
    { pos: [35, 5.4, -2.5], size: [4, 1, 4] },

    // --- both paths rejoin on the trophy terrace ---
    { pos: [39, 6.0, 0], size: [8, 1, 8] },

    // --- gap crossing: a run of small pads over the void ---
    { pos: [45, 6.4, 0], size: [2.2, 1, 2.2] },
    { pos: [49, 6.8, 1.5], size: [2.2, 1, 2.2] },
    { pos: [53, 7.2, -1], size: [2.2, 1, 2.2] },
    { pos: [57, 7.6, 0], size: [2.2, 1, 2.2] },

    // --- final ascent to the door ---
    { pos: [62, 8.2, 0], size: [4, 1, 5] },
    { pos: [66, 9.0, 0], size: [4, 1, 5] },
    { pos: [70, 9.8, 0], size: [7, 1, 7] }, // goal terrace (door)

    // --- decorative / depth blocks below the path ---
    { pos: [12.5, 0.0, -7], size: [2.5, 3, 2.5] },
    { pos: [39, 2.0, -8], size: [3, 5, 3] },
    { pos: [62, 4.0, 6], size: [2.5, 4, 2.5] },
  ],
  gems: [
    // along the climb
    [9.5, 3.3, 0],
    [15.5, 4.9, 0],
    // BRANCH A high gems (the reward for the risky route)
    [25, 6.7, 3],
    [29, 7.7, 4],
    [33, 8.5, 2.5],
    // gap-crossing gems
    [49, 8.3, 1.5],
    [57, 9.1, 0],
    // near the door
    [66, 10.5, 0],
  ],
  trophy: [39, 7.4, 0],
  door: [70, 11.1, 0],
}
