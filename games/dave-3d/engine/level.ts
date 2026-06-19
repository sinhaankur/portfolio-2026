/**
 * Dave 3D — level data. A level is a set of solid 3D platform boxes plus the
 * collectibles + Dave's two iconic objectives (trophy, then door). Hand-authored
 * for readable third-person jumps: a rising path of platforms with gaps, gems to
 * grab along the way, the trophy partway, and the exit door at the end.
 *
 * Coordinates: Y is up. The hero spawns on the first platform and works rightward
 * (+X) and upward.
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

// One solid starter level. Platforms step up-and-across with jumpable gaps.
export const LEVEL_1: Level = {
  spawn: [0, 1.5, 0],
  killY: -12,
  platforms: [
    // start pad
    { pos: [0, 0, 0], size: [6, 1, 6] },
    // a gentle staircase of floating ledges, rising +Y as it goes +X
    { pos: [7, 0.6, 0], size: [4, 1, 4] },
    { pos: [13, 1.4, 1.5], size: [3.5, 1, 4] },
    { pos: [18.5, 2.4, 0], size: [3.5, 1, 4] },
    { pos: [24, 3.4, -1.5], size: [4, 1, 4] },
    // a wider mid platform with the trophy
    { pos: [30, 4.2, 0], size: [6, 1, 6] },
    // gap, then the final approach
    { pos: [37, 5.0, 1], size: [3.5, 1, 4] },
    { pos: [42.5, 5.8, -0.5], size: [3.5, 1, 4] },
    // goal platform with the door
    { pos: [48, 6.6, 0], size: [6, 1, 6] },
    // a couple of low side blocks for depth/variety
    { pos: [13, 0.0, -4.5], size: [2, 2, 2] },
    { pos: [30, 1.2, -5], size: [2, 3, 2] },
  ],
  gems: [
    [7, 2.1, 0],
    [13, 2.9, 1.5],
    [18.5, 3.9, 0],
    [24, 4.9, -1.5],
    [37, 6.5, 1],
    [42.5, 7.3, -0.5],
  ],
  trophy: [30, 5.6, 0],
  door: [48, 7.7, 0],
}
