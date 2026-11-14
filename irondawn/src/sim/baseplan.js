// Camp Hawthorne's plan in world coordinates (metres; north is -z). The terrain reads the flat
// areas and clearings from here, worldgen builds the camp on them, and the training events use
// the same points, so the three can never disagree.

import { locationOf } from '../game/world.js';

const C = locationOf('hawthorne'); // { x: -260, z: 640 }
const at = (dx, dz) => ({ x: C.x + dx, z: C.z + dz });

export const BASE = {
  center: { x: C.x, z: C.z },
  spawn: { ...at(0, 138), yaw: 0 }, // where the truck drops a new recruit (facing north)
  arrival: at(0, 118), // where Briggs meets the truck
  gateSouth: at(0, 150),
  gateNorth: at(40, -150),
  parade: { ...at(0, 8), w: 46, d: 34 },
  flag: at(0, -14),
  bunk: at(-66, 44),
  npcs: {
    briggs: { ...at(0, 2), yaw: Math.PI },
    finch: { ...at(-34, 64), yaw: Math.PI / 2 },
    sato: { ...at(44, 52), yaw: -Math.PI / 2 },
    marsh: { ...at(40, -52), yaw: Math.PI },
    adeyemi: { ...at(0, -62), yaw: Math.PI },
    pops: { ...at(70, -6), yaw: -Math.PI / 2 },
    doc: { ...at(76, 52), yaw: -Math.PI / 2 },
    top: { ...at(-58, -2), yaw: Math.PI / 2 },
    holt: { ...at(104, -82), yaw: Math.PI },
    okoro: { ...at(-128, -30), yaw: Math.PI / 2 },
    vasquez: { ...at(132, 96), yaw: -Math.PI / 2 },
    ilves: { ...at(-128, 112), yaw: 0 },
    dane: { ...at(-62, -256), yaw: 0 },
  },
  helipad: at(118, -92),

  // Firing range: the line faces west; targets stand out to 300 m.
  range: {
    line: at(-136, -20), // centre of the firing line
    lineZ: [C.z - 30, C.z - 10], // the booth you shoot from spans this z
    facing: -Math.PI / 2, // yaw looking west (-x)
    near: [25, 40, 55, 75, 100, 125, 150], // target distances, stage one
    far: [200, 250, 300], // stage two
    lanes: [-27, -23.5, -20, -16.5, -13], // z offsets from C.z for target lanes
    flat: { x0: C.x - 470, x1: C.x - 120, z0: C.z - 48, z1: C.z + 8 },
  },

  // Confidence course: a straight lane running north along x = lane.x.
  course: {
    x: C.x + 140,
    half: 4.5, // lane half-width
    start: C.z + 92,
    gates: [C.z + 92, C.z + 52, C.z + 22, C.z - 12, C.z - 44, C.z - 78], // z of each timing gate, in order
    hurdles: [C.z + 76, C.z + 68, C.z + 60],
    crawl: [C.z + 44, C.z + 34], // wire from here to here
    wall: C.z + 10,
    zigzag: [C.z - 2, C.z - 20, C.z - 32],
    wall2: C.z - 56,
    finish: C.z - 78,
    flat: { x0: C.x + 126, x1: C.x + 154, z0: C.z - 90, z1: C.z + 104 },
  },

  // Infiltration lane: a wood south-west of camp. Start at the north edge, flag at the south.
  lane: {
    x: C.x - 128,
    start: { x: C.x - 128, z: C.z + 122 },
    flag: { x: C.x - 128, z: C.z + 238 },
    half: 46, // half-width of the wood
    z0: C.z + 118,
    z1: C.z + 246,
    checkpoints: [C.z + 122, C.z + 160, C.z + 200],
  },

  // Observation post: a low hill north-west of camp looking north.
  op: {
    post: at(-66, -262),
    bump: { x: C.x - 66, z: C.z - 264, r: 48, h: 10 },
    sector: { x: C.x - 66, z: C.z - 400, half: 130, depth: 130 }, // dummies hide in this box north of the post
    facing: 0,
  },
};

// Rectangles the terrain levels to the camp's height.
export const FLATS = [BASE.range.flat, BASE.course.flat];
// Gentle hills added to the terrain.
// (The second is the knoll south-east of Lake Miren that overlooks the Lakeside Villa.)
export const BUMPS = [BASE.op.bump, { x: 300, z: -124, r: 48, h: 12 }];
// Areas kept clear of wild trees and rocks (x0, x1, z0, z1).
export const CLEARINGS = [
  BASE.range.flat,
  BASE.course.flat,
  { x0: BASE.op.post.x - 14, x1: BASE.op.post.x + 14, z0: BASE.op.post.z - 12, z1: BASE.op.post.z + 14 },
  { x0: BASE.lane.x - 6, x1: BASE.lane.x + 6, z0: BASE.lane.z0 - 14, z1: BASE.lane.z0 + 2 },
];
// Open ground: no trees or rocks, but brush still grows (the valley below the observation post).
export const OPEN = [{ x0: BASE.op.sector.x - BASE.op.sector.half - 20, x1: BASE.op.sector.x + BASE.op.sector.half + 20, z0: BASE.op.sector.z - BASE.op.sector.depth / 2 - 20, z1: BASE.op.post.z - 10 }];
// Areas forced to dense woodland (the infiltration lane).
export const WOODS = [{ x0: BASE.lane.x - BASE.lane.half, x1: BASE.lane.x + BASE.lane.half, z0: BASE.lane.z0, z1: BASE.lane.z1 }];

export const inRect = (r, x, z, pad = 0) => x >= r.x0 - pad && x <= r.x1 + pad && z >= r.z0 - pad && z <= r.z1 + pad;
