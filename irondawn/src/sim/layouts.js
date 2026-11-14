// What stands at each place on the island. Every function takes a SiteBuilder and works in
// coordinates local to the site's centre (x east, z south). Besides the buildings each layout
// names the points that missions and the garrison's AI use: guard posts, patrol loops, cells,
// objectives, the thing to defend, and which way friendly ground lies (approach).

import { COL } from './sitekit.js';
import { BASE } from './baseplan.js';

const norm = (x, z) => {
  const d = Math.hypot(x, z) || 1;
  return { x: x / d, z: z / d };
};

// Guard posts spaced along a rectangle, looking outward.
function ringGuards(b, w, d, n, inset = 3) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.3;
    const x = Math.cos(a) * (w / 2 - inset);
    const z = Math.sin(a) * (d / 2 - inset);
    b.guard(Math.round(x), Math.round(z));
  }
}
const loop = (w, d) => [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]];

// ---------- Camp Hawthorne ----------
function base(b) {
  const A = b.anchors;
  const L = (p) => [p.x - b.cx, p.z - b.cz];

  // parade ground and colours
  b.slab(0, 8, 46, 34, COL.gravel);
  b.flagpole(0, -14, COL.blue, 10);
  // headquarters
  b.building(0, -76, 24, 14, 3.6, { doors: ['s'], color: COL.concrete, floor: COL.concreteDark });
  b.deco(0, 2.6, -68.8, 7, 0.8, 0.12, COL.olive);
  b.slab(0, -52, 5, 34, COL.gravel);
  // operations tent with the map table
  b.tent(40, -60, 12, 9, COL.canvas, true);
  b.box(40, 0, -61, 3.4, 0.9, 1.8, COL.wood);
  b.deco(40, 0.9, -61, 3.0, 0.05, 1.5, COL.plaster);
  // barracks row and the bunk tent
  for (const z of [-30, -10, 10, 30]) b.hut(-78, z, 22, 7, 2.6, COL.plank, COL.tin);
  b.tent(-66, 50, 6, 5, COL.canvas);
  // intake tent (yellow flag) and its desk
  b.tent(-34, 72, 9, 7, COL.canvasTan, true);
  b.box(-34, 0, 67, 2.6, 0.9, 0.9, COL.wood);
  b.flagpole(-27, 66, COL.yellow, 5);
  // classroom tent with benches
  b.tent(52, 52, 10, 8, COL.canvas, true);
  for (const z of [50, 52.4, 54.8]) b.box(53, 0, z, 5, 0.45, 0.5, COL.wood);
  b.box(47.6, 0, 52, 0.3, 1.9, 3.2, COL.black);
  // quartermaster's store
  b.building(82, -6, 14, 10, 3.2, { doors: ['w'], color: COL.concreteDark, floor: COL.concreteDark });
  b.crates(72, 4, 5);
  b.crates(73, -15, 3);
  // aid station
  b.tent(88, 52, 10, 8, COL.canvasWhite, true);
  b.deco(88, 2.3, 47.6, 1.4, 0.4, 0.1, COL.red);
  b.deco(88, 2.0, 47.6, 0.4, 1.0, 0.1, COL.red);
  b.box(90, 0, 53, 2, 0.6, 0.9, COL.white);
  // mess hall, water tower, motor pool
  b.hut(-46, 106, 20, 8, 2.8, COL.plank, COL.rust);
  b.cyl(-88, 0, 78, 0.5, 7, COL.metal);
  b.cyl(-88, 7, 78, 2.6, 3, COL.tin, { collide: false, seg: 10 });
  b.slab(56, -112, 36, 22, COL.asphalt);
  for (const x of [44, 54, 64]) b.truck(x, -112, false);
  b.hut(80, -124, 12, 9, 3.2, COL.tin, COL.metalDark);
  b.barrels(72, -104, 5);
  // flight line
  b.slab(118, -92, 18, 18, COL.asphalt);
  b.deco(118, 0.06, -92, 1.2, 0.02, 8, COL.white);
  b.deco(114.6, 0.06, -92, 0.9, 0.02, 8, COL.white);
  b.deco(121.4, 0.06, -92, 0.9, 0.02, 8, COL.white);
  b.shapes.push({ t: 'heli', x: b.wx(118), y: b.groundAt(118, -92), z: b.wz(-92) });
  b.box(118, 0, -92, 3, 3, 9, 0, { draw: false });

  // wire, gates and towers
  b.fence(-100, -150, 128, -150, [{ at: 34, w: 4 }, { at: 140, w: 10 }]);
  b.fence(-100, 150, 128, 150, [{ at: 100, w: 10 }]);
  b.fence(-100, -150, -100, 150, [{ at: 130, w: 6 }, { at: 262, w: 5 }]);
  b.fence(128, -150, 128, 150, [{ at: 246, w: 6 }]);
  b.hesco(-13, 150, -5.5, 150);
  b.hesco(5.5, 150, 13, 150);
  b.hesco(27, -150, 34.5, -150);
  b.hesco(45.5, -150, 53, -150);
  b.tower(-12, 142, 5, 'n');
  b.tower(56, -142, 5, 's');
  b.hut(9, 143, 3, 3, 2.3, COL.plank, COL.tin);
  for (const [x, z] of [[-20, 30], [22, 30], [-20, -14], [22, -14], [60, 20], [-50, 60], [100, -60], [0, 120], [40, -120]]) b.lamp(x, z);

  // ----- firing range (faces west) -----
  const range = BASE.range;
  const [rx] = L(range.line);
  b.slab(rx + 3, -20, 7, 26, COL.gravel);
  for (const z of [-32, -8]) for (const x of [rx + 0.4, rx + 6]) b.deco(x, 0, z, 0.16, 2.6, 0.16, COL.woodDark);
  b.deco(rx + 3.2, 2.6, -20, 7, 0.14, 25, COL.tin);
  b.wall(rx - 0.8, -32, rx - 0.8, -8, 0.85, { t: 0.7, color: COL.sandbag });
  for (const dist of [...range.near, ...range.far]) {
    b.deco(rx - dist, 0, -36, 0.1, 1.3, 0.1, COL.wood);
    b.deco(rx - dist, 1.0, -36, 0.9, 0.5, 0.06, COL.white);
  }
  b.box(rx - 316, 0, -20, 7, 5, 44, COL.dirt);
  // ----- confidence course (runs north along one lane) -----
  const cs = BASE.course;
  const lx = cs.x - b.cx;
  const lz = (z) => z - b.cz;
  const rope = (x) => {
    b.box(x, 0, 7, 0.12, 1.05, 190, 0, { collide: 'fence', draw: false });
    b.deco(x, 0.95, 7, 0.05, 0.05, 190, COL.rope);
    for (let z = -88; z <= 102; z += 6) b.deco(x, 0, z, 0.1, 1.05, 0.1, COL.wood);
  };
  rope(lx - cs.half);
  rope(lx + cs.half);
  const arch = (z, color) => {
    b.deco(lx - cs.half, 0, z, 0.25, 3.4, 0.25, color);
    b.deco(lx + cs.half, 0, z, 0.25, 3.4, 0.25, color);
    b.deco(lx, 3.2, z, cs.half * 2 + 0.25, 0.5, 0.2, color);
  };
  arch(lz(cs.start), COL.yellow);
  arch(lz(cs.finish), COL.red);
  for (const z of cs.hurdles) b.box(lx, 0, lz(z), cs.half * 2, 0.7, 0.25, COL.plank);
  // the crawl: wire close overhead
  const c0 = lz(cs.crawl[1]);
  const c1 = lz(cs.crawl[0]);
  b.box(lx, 0.85, (c0 + c1) / 2, cs.half * 2, 1.6, c1 - c0, 0, { draw: false, nowalk: true });
  b.deco(lx, 0.86, (c0 + c1) / 2, cs.half * 2, 0.04, c1 - c0, COL.wire);
  for (let z = c0; z <= c1; z += 3.5) for (const x of [lx - cs.half + 0.3, lx, lx + cs.half - 0.3]) b.deco(x, 0, z, 0.08, 0.9, 0.08, COL.wood);
  b.box(lx, 0, lz(cs.wall), cs.half * 2, 1.35, 0.5, COL.plank);
  cs.zigzag.forEach((z, i) => b.box(lx + (i % 2 ? 1.6 : -1.6), 0, lz(z), cs.half * 2 - 3.2, 1.7, 0.4, COL.woodDark));
  b.box(lx, 0, lz(cs.wall2), cs.half * 2, 1.15, 0.5, COL.plank);
  // ----- infiltration lane -----
  const lane = BASE.lane;
  const [fx, fz] = L(lane.flag);
  b.flagpole(fx, fz, COL.red, 4);
  const [sx, sz] = L(lane.start);
  b.deco(sx - 3, 0, sz - 2, 0.14, 2.2, 0.14, COL.wood);
  b.deco(sx + 3, 0, sz - 2, 0.14, 2.2, 0.14, COL.wood);
  b.deco(sx, 2.0, sz - 2, 6.2, 0.4, 0.1, COL.yellow);
  for (const [x, z, len, ax] of [[-14, 30, 7, true], [18, 44, 6, false], [-22, 66, 8, true], [10, 78, 7, true], [-6, 98, 6, false], [24, 104, 7, true]]) b.logs(sx + x, sz + z, len, ax);
  // ----- observation post -----
  const [ox, oz] = L(BASE.op.post);
  b.sandbags(ox - 4, oz - 3, ox + 4, oz - 3, 0.9);
  b.sandbags(ox - 4, oz - 3, ox - 4, oz + 2, 0.9);
  b.sandbags(ox + 4, oz - 3, ox + 4, oz + 2, 0.9);
  for (const [x, z] of [[-3.6, -2.6], [3.6, -2.6], [-3.6, 2.4], [3.6, 2.4]]) b.deco(ox + x, 0, oz + z, 0.14, 2.4, 0.14, COL.woodDark);
  b.deco(ox, 2.4, oz, 8.4, 0.14, 6, COL.canvas);

  A.cover.length = 0; // the camp is not a battlefield
  A.npcs = Object.fromEntries(Object.entries(BASE.npcs).map(([id, p]) => [id, { x: p.x, z: p.z, y: b.terrain.heightAt(p.x, p.z), yaw: p.yaw }]));
  A.asset = b.pt(0, -14);
  A.gate = b.pt(0, 150);
  A.insert = b.pt(118, -80);
  A.exfil = b.pt(118, -80);
  for (const [x, z] of [[-8, 140], [8, 140], [34, -140], [46, -140], [-90, 0], [118, 0]]) b.guard(x, z);
}

// ---------- villages ----------
// houses: [x, z, w, d, door]. occupied = the Legion holds it (barricades, guards, cells).
function village(b, { houses, occupied = false, hall = null, well = [0, 0], barns = [] }) {
  const A = b.anchors;
  const tints = [COL.plaster, COL.plaster2, COL.plaster3, COL.stone];
  houses.forEach(([x, z, w, d, door], i) => {
    const h = b.building(x, z, w, d, 2.9, { doors: [door], color: tints[i % tints.length], roof: 'gable', roofColor: i % 3 === 0 ? COL.roofSlate : COL.roofTile });
    if (occupied && i < 3) b.cell(x, z);
    if (i % 2 === 0) b.lowWall(x - w / 2 - 3, z + (door === 's' ? -d / 2 - 2 : d / 2 + 2), x + w / 2 + 3, z + (door === 's' ? -d / 2 - 2 : d / 2 + 2), 1.0);
    b.loot(h.x + (i % 2 ? 1.5 : -1.5), h.z);
  });
  if (hall) {
    const h = b.building(hall[0], hall[1], hall[2], hall[3], 4.2, { doors: [hall[4], 'e'], color: COL.stone, roof: 'gable', roofColor: COL.roofSlate, rise: 2.4 });
    A.hvt = b.pt(hall[0], hall[1]);
    b.intel(hall[0] + 2, hall[1] - 1);
    b.guard(h.door.out.x - b.cx, h.door.out.z - b.cz);
  }
  for (const [x, z, w, d] of barns) b.hut(x, z, w, d, 3.6, COL.woodDark, COL.rust);
  // the square
  b.cyl(well[0], 0, well[1], 1.1, 0.9, COL.stone, { seg: 10 });
  b.deco(well[0] - 1, 0.9, well[1], 0.14, 1.6, 0.14, COL.wood);
  b.deco(well[0] + 1, 0.9, well[1], 0.14, 1.6, 0.14, COL.wood);
  b.deco(well[0], 2.4, well[1], 2.6, 0.14, 1.2, COL.roofTile);
  for (const [x, z] of [[-7, -5], [7, -6], [-8, 6], [8, 5]]) {
    b.box(well[0] + x, 0, well[1] + z, 2.4, 0.9, 1.2, COL.wood);
    b.deco(well[0] + x, 0.9, well[1] + z, 2.8, 1.3, 1.5, [COL.red, COL.blue, COL.yellow, COL.green][(x + z + 20) % 4], { collide: false });
    b.coverAround(well[0] + x, well[1] + z, 2.4);
  }
  for (const [x, z] of [[-18, 0], [18, 0], [0, -22], [0, 22]]) b.lamp(x, z, 4);
  A.asset = b.pt(well[0], well[1]);
  A.npcs.elder = b.pt(well[0] + 2.4, well[1] + 2.6, { yaw: Math.PI });
  // field walls and hay for cover on the edges
  for (const [x0, z0, x1, z1] of [[-58, -44, -30, -44], [30, -44, 58, -44], [-58, 44, -30, 44], [30, 44, 58, 44], [-62, -20, -62, 16], [62, -16, 62, 20]]) b.lowWall(x0, z0, x1, z1, 1.05);
  for (const [x, z] of [[-40, -52], [44, 52], [-46, 54], [50, -54], [0, -52], [0, 54]]) b.crate(x, z, 1.5, 1.3, COL.yellow);
  // where defenders stand
  for (const [x, z, yaw] of [[-12, -43, 0], [12, -43, 0], [40, -43, 0], [-40, -43, 0], [61, 0, 90], [-61, 0, -90], [-12, 43, 180], [12, 43, 180]]) b.defend(x, z, yaw);
  if (occupied) {
    // Legion barricades on the ways in
    b.sandbags(-6, -58, 6, -58);
    b.sandbags(-6, 58, 6, 58);
    b.sandbags(-70, -5, -70, 5);
    b.sandbags(70, -5, 70, 5);
    b.tower(-52, -52, 5, 'e');
    b.tower(52, 52, 5, 'w');
    b.truck(14, 30, true);
    b.crates(-16, 28, 4);
    for (const [x, z] of [[-3, -56], [3, -56], [-3, 56], [3, 56], [-68, 0], [68, 0], [10, 6], [-10, -6], [22, -20], [-24, 18], [30, 24], [-30, -24]]) b.guard(x, z);
    b.patrol([[-50, -30], [50, -30], [50, 30], [-50, 30]]);
    b.patrol([[-12, -40], [12, -40], [12, 40], [-12, 40]]);
    b.patrol([[-64, -64], [64, -64], [64, 64], [-64, 64]]);
    A.alarm = b.pt(4, -8);
    b.box(4, 0, -8, 0.5, 1.6, 0.5, COL.red);
    A.escape = b.pt(0, -84);
  } else {
    for (const [x, z] of [[-3, -50], [3, 50], [-55, 0], [55, 0]]) b.guard(x, z);
  }
}

function brightwater(b) {
  village(b, {
    houses: [[-34, -20, 10, 8, 's'], [-16, -22, 8, 7, 's'], [16, -21, 9, 8, 's'], [36, -20, 10, 7, 's'], [-36, 20, 9, 8, 'n'], [-14, 21, 10, 7, 'n'], [14, 20, 8, 8, 'n'], [36, 21, 10, 8, 'n'], [-52, 0, 8, 9, 'e']],
    barns: [[52, -34, 12, 9], [-54, 34, 11, 8]],
  });
  b.anchors.approach = norm(-0.7, 0.7);
}

function stonebridge(b) {
  village(b, {
    occupied: true,
    houses: [[-36, -22, 10, 8, 's'], [-18, -22, 8, 7, 's'], [18, -22, 9, 8, 's'], [38, -22, 9, 7, 's'], [-38, 22, 9, 8, 'n'], [-18, 22, 9, 7, 'n'], [36, 22, 10, 8, 'n'], [-54, 2, 8, 9, 'e'], [54, -2, 8, 9, 'w']],
    hall: [14, 26, 14, 10, 'n'],
    barns: [[56, 36, 11, 8]],
  });
  b.anchors.approach = norm(-0.6, 0.8);
}

function port(b) {
  village(b, {
    houses: [[-30, -20, 10, 8, 's'], [-12, -21, 8, 7, 's'], [14, -20, 9, 8, 's'], [34, -20, 10, 7, 's'], [-32, 20, 9, 8, 'n'], [-12, 21, 10, 7, 'n'], [34, 21, 10, 8, 'n']],
    barns: [[12, 30, 16, 10], [-52, -30, 12, 9]],
  });
  // a quay and a pier out over the water to the south
  const g = b.terrain.sites.halden.ground;
  for (let z = 70; z < 170; z += 10) b.box(8, 0, z, 6, 0.5, 10, COL.plank, { ground: g - 0.2 });
  b.crates(4, 62, 5);
  b.container(-10, 58, true, COL.blue);
  b.anchors.approach = norm(-0.4, -0.9);
}

// ---------- Checkpoint Echo ----------
function checkpoint(b) {
  const A = b.anchors;
  b.perimeter(0, 0, 44, 32, 'hesco', { n: { w: 8 }, s: { w: 8 } });
  b.slab(0, 0, 7, 60, COL.dirt);
  b.building(-13, 2, 9, 9, 2.8, { doors: ['e'], color: COL.concreteDark, windows: true });
  const radio = b.building(13, -5, 7, 6, 2.6, { doors: ['w'], color: COL.concrete });
  b.mast(18, -11, 13);
  b.tower(16, 9, 5, 'w', 0);
  b.tent(11, 8, 5, 4, COL.canvas);
  b.sandbags(-11, -23, -4.5, -23);
  b.sandbags(4.5, -23, 11, -23);
  b.sandbags(-26, -12, -26, -2);
  b.sandbags(26, -14, 26, -4);
  b.sandbags(-11, 23, -4.5, 23);
  b.sandbags(4.5, 23, 11, 23);
  b.crates(-6, 6, 3);
  b.crates(7, -10, 3);
  b.barrels(-16, -10, 3);
  // the boom across the road
  b.deco(-4.4, 0, -17, 0.3, 1.2, 0.3, COL.white);
  b.deco(0, 1.05, -17, 8.6, 0.14, 0.14, COL.red);
  for (const [x, z] of [[-12, -18], [12, -18], [-12, 14], [12, 14]]) b.lamp(x, z, 4.5);
  for (const [x, z, yaw] of [[-7.5, -21.6, 0], [7.5, -21.6, 0], [-24.6, -7, -90], [24.6, -9, 90], [-2.5, -13, 0], [2.5, -13, 0]]) b.defend(x, z, yaw);
  A.asset = radio.inside;
  A.gate = b.pt(0, 16);
  A.approach = norm(-0.3, 1);
  for (const [x, z] of [[-3, -19], [3, -19], [-3, 19], [3, 19]]) b.guard(x, z);
}

// ---------- Sawmill Camp ----------
function sawmill(b) {
  const A = b.anchors;
  const gates = b.perimeter(0, 0, 96, 76, 'fence', { s: { w: 8 }, n: { w: 6, at: 10 } });
  // the mill: a roof over the saw bench, logs stacked around it
  b.tent(-8, -4, 18, 10, COL.rust, true);
  b.box(-8, 0, -4, 6, 0.9, 1.4, COL.metalDark);
  b.coverAround(-8, -4, 6);
  for (const [x, z, len, ax] of [[-24, -8, 8, false], [8, -14, 9, true], [-8, 8, 10, true], [-22, 8, 6, true], [10, 4, 7, false]]) b.logs(x, z, len, ax);
  // holding sheds on the east side
  for (const z of [-16, 2]) {
    b.building(32, z, 7, 6, 2.6, { doors: ['w'], color: COL.woodDark, windows: false, roofColor: COL.tin });
    b.cell(32, z);
  }
  for (const z of [-18, -6, 6]) b.tent(-34, z, 7, 5, COL.canvas);
  const hut = b.building(8, 24, 8, 6, 2.6, { doors: ['n'], color: COL.plank, roofColor: COL.tin });
  A.hvt = hut.inside;
  b.intel(9.5, 25);
  b.loot(6, 25);
  b.tower(-43, 32, 5, 'e', Math.PI * 0.75);
  b.tower(43, -32, 5, 'w', -Math.PI / 4);
  b.crates(20, 18, 4);
  b.crates(-16, 24, 4);
  b.crates(22, -26, 3);
  b.barrels(-4, 28, 4);
  b.truck(-22, 30, true);
  for (const [x, z] of [[-20, -20], [18, -8], [-4, 16], [26, 26], [-36, 26], [36, -4]]) b.lamp(x, z, 4.5);
  for (const [x, z] of [[-3, 35], [3, 35], [10, -35], [27, -16], [27, 2], [-14, -2], [2, -8], [-28, -12], [-28, 2], [8, 19], [-10, 30], [20, 10]]) b.guard(x, z);
  b.patrol(loop(84, 64));
  b.patrol([[-60, -50], [62, -50], [62, 50], [-60, 50]]);
  A.alarm = b.pt(0, 12);
  b.box(0, 0, 12, 0.5, 1.6, 0.5, COL.red);
  A.gate = gates.s;
  A.approach = norm(-0.34, 0.94);
}

// ---------- Relay Hill ----------
function relay(b) {
  const A = b.anchors;
  const gates = b.perimeter(0, 0, 46, 42, 'hesco', { s: { w: 6 } });
  b.mast(9, -9, 26);
  const hut = b.building(-9, -9, 7, 6, 2.6, { doors: ['s'], color: COL.concrete });
  b.intel(-10, -9.5);
  A.hvt = hut.inside;
  b.box(15, 0, 5, 2.4, 1.5, 1.6, COL.metalDark);
  b.barrels(15, 8, 3);
  b.tower(-17, 13, 6, 'e', Math.PI);
  b.tent(8, 12, 6, 5, COL.canvas);
  b.tent(-2, 13, 5, 4, COL.canvas);
  b.sandbags(-8, 26, -3.5, 26);
  b.sandbags(3.5, 26, 8, 26);
  b.crates(0, -2, 4);
  b.crates(16, -14, 3);
  for (const [x, z] of [[-14, -2], [14, -2], [0, 16]]) b.lamp(x, z, 4.5);
  for (const [x, z] of [[-3, 23], [3, 23], [6, -5], [-6, -4], [16, 10], [-12, 4], [2, 9], [-18, -14]]) b.guard(x, z);
  b.patrol(loop(36, 32));
  b.patrol([[-34, -32], [34, -32], [34, 34], [-34, 34]]);
  A.alarm = b.pt(6, -5);
  b.box(6, 0, -5, 0.5, 1.6, 0.5, COL.red);
  A.gate = gates.s;
  A.approach = norm(0.94, 0.33);
}

// ---------- Karst Quarry (a pit) ----------
function quarry(b) {
  const A = b.anchors;
  const office = b.building(-10, -6, 10, 8, 2.8, { doors: ['s'], color: COL.concreteDark });
  A.hvt = office.inside;
  b.intel(-12, -7);
  for (const [x, z] of [[18, -20], [26, 0], [18, 20]]) b.hut(x, z, 9, 7, 3, COL.tin, COL.metalDark);
  for (const z of [-30, -22]) {
    b.building(-30, z, 6, 5, 2.5, { doors: ['e'], color: COL.woodDark, windows: false, roofColor: COL.tin });
    b.cell(-30, z);
  }
  for (const [x, z, n] of [[4, 14, 5], [-8, 22, 4], [8, -22, 4], [30, -12, 3], [-24, 4, 4], [2, -34, 4], [34, 14, 3], [-18, -40, 3]]) b.crates(x, z, n);
  // the crusher and its conveyor
  b.box(-26, 0, 20, 5, 4, 5, COL.metalDark);
  b.box(-17, 0, 20, 13, 1.2, 1.4, COL.metal);
  b.coverAlong(-23.5, 20, -10.5, 20, 1.4);
  b.truck(2, 30, true);
  b.truck(-34, -8, false);
  b.truck(4, -66, true, COL.metalDark);
  A.escape = b.pt(4, -72);
  b.tower(-62, 44, 5, 'e', Math.PI * 0.75);
  b.tower(62, -44, 5, 'w', -Math.PI / 4);
  b.barrels(12, 6, 4);
  for (const [x, z] of [[-2, 4], [20, -8], [-20, -16], [10, 28], [-30, 28], [34, 26]]) b.lamp(x, z, 5);
  for (const [x, z] of [[-10, 0], [-6, 1], [14, -12], [22, 10], [-2, 20], [-20, 12], [8, -30], [-28, -14], [30, -24], [0, 44], [0, -50], [-60, -10], [60, 10]]) b.guard(x, z);
  b.patrol([[-36, -30], [36, -30], [36, 34], [-36, 34]]);
  b.patrol([[-66, -66], [66, -66], [66, 66], [-66, 66]]);
  b.patrol([[-10, 6], [20, 6], [20, -14], [-4, -18]]);
  A.alarm = b.pt(-3, 4);
  b.box(-3, 0, 4, 0.5, 1.6, 0.5, COL.red);
  A.gate = b.pt(0, 60);
  A.approach = norm(0.73, 0.68);
}

// ---------- Lakeside Villa ----------
function villa(b) {
  const A = b.anchors;
  const gates = b.perimeter(0, 0, 76, 60, 'low', { w: { w: 6 }, e: { w: 6 } });
  const house = b.building(0, -10, 18, 12, 3.4, { doors: ['s', 'n'], color: COL.plaster, roof: 'gable', roofColor: COL.roofTile, rise: 2.2 });
  b.building(-24, -16, 8, 7, 2.8, { doors: ['e'], color: COL.plaster2, roof: 'gable', roofColor: COL.roofTile });
  // the terrace on the lake side
  b.box(0, 0, 3, 18, 0.4, 10, COL.stone, {});
  b.lowWall(-9, 8.2, -2, 8.2, 0.9, COL.plaster);
  b.lowWall(2, 8.2, 9, 8.2, 0.9, COL.plaster);
  b.box(4, 0.4, 2, 1.4, 0.75, 1.4, COL.white);
  b.hut(26, -20, 9, 7, 2.8, COL.plaster2, COL.roofSlate);
  b.truck(24, -8, true, COL.black);
  b.hut(-30, 22, 5, 4, 2.4, COL.plank, COL.tin);
  b.tower(-33, -25, 5, 'e', Math.PI * 0.75);
  b.tower(33, 25, 5, 'w', Math.PI / 4);
  for (const [x, z] of [[-14, 14], [14, 14], [-20, -2], [20, 2], [0, 22]]) b.crate(x, z, 1.4, 1.1, COL.green);
  for (const [x, z] of [[-12, 6], [12, 6], [-30, 0], [30, 0], [0, -22]]) b.lamp(x, z, 4);
  for (const [x, z] of [[-35, 2], [35, -2], [-6, 12], [6, 12], [0, -20], [-16, -8], [16, -6], [-26, 20], [26, 18], [0, 26]]) b.guard(x, z);
  b.patrol(loop(64, 48));
  b.patrol([[-46, -38], [46, -38], [46, 38], [-46, 38]]);
  A.hvt = b.pt(0, 4);
  A.hvtWalk = [b.pt(-7, 4), b.pt(7, 4), b.pt(7, 1), b.pt(-7, 1)];
  A.interior.push(house.inside);
  b.intel(3, -11);
  A.escape = b.pt(46, 0);
  A.alarm = b.pt(-12, -2);
  b.box(-12, 0, -2, 0.5, 1.6, 0.5, COL.red);
  A.gate = gates.w;
  A.approach = norm(0.18, 0.98);
  // the shot is taken from the knoll south-east of the lake
  A.insert = { x: 304, z: -84 };
  A.exfil = { x: 330, z: -40 };
  A.perch = { x: 300, z: -124 };
}

// ---------- Fort Anvil ----------
function fort(b) {
  const A = b.anchors;
  const gates = b.perimeter(0, 0, 86, 74, 'stone', { s: { w: 8 }, n: { w: 6 } });
  b.slab(0, 0, 84, 72, COL.gravel, 0.03);
  const keep = b.building(0, -14, 18, 12, 4.2, { doors: ['s', 'e'], color: COL.stone });
  A.hvt = keep.inside;
  b.intel(-3, -15);
  b.building(-27, 8, 9, 16, 3, { doors: ['e'], color: COL.stoneDark });
  b.building(27, 8, 9, 16, 3, { doors: ['w'], color: COL.stoneDark });
  b.building(-28, -24, 8, 8, 3, { doors: ['e'], color: COL.concreteDark });
  const cellBlock = b.building(26, -25, 10, 7, 2.8, { doors: ['w'], color: COL.concreteDark, windows: false });
  b.cell(24, -25);
  b.cell(28, -25);
  A.interior.push(cellBlock.inside);
  for (const [x, z, side, yaw] of [[-39, -33, 'e', -0.75], [39, -33, 'w', -0.25], [-39, 33, 'e', 0.75], [39, 33, 'w', 0.25]]) b.tower(x, z, 6, side, yaw * Math.PI);
  b.flagpole(0, 12, COL.red, 9);
  A.asset = b.pt(0, 12);
  b.sandbags(-10, 28, -4.5, 28);
  b.sandbags(4.5, 28, 10, 28);
  b.sandbags(-8, -30, -3.5, -30);
  b.sandbags(3.5, -30, 8, -30);
  b.sandbags(-14, 14, -14, 20);
  b.sandbags(14, 14, 14, 20);
  for (const [x, z, n] of [[-12, 4, 4], [12, 2, 4], [-16, -30, 3], [16, 30, 3], [0, 22, 3]]) b.crates(x, z, n);
  b.barrels(-34, -8, 4);
  b.truck(14, -30, true);
  for (const [x, z] of [[-16, 24], [16, 24], [-16, -6], [16, -6], [0, -30], [0, 2]]) b.lamp(x, z, 5);
  for (const [x, z] of [[-3, 32], [3, 32], [-3, -33], [3, -33], [-8, 26], [8, 26], [-20, 6], [20, 6], [0, -6], [10, -12], [-22, -20], [20, -22], [-34, 20], [34, -18], [0, 18], [-10, -26]]) b.guard(x, z);
  b.patrol(loop(70, 58));
  b.patrol([[-52, -46], [52, -46], [52, 46], [-52, 46]]);
  for (const [x, z, yaw] of [[-6, -28.8, 0], [6, -28.8, 0], [-30, -33, 0], [30, -33, 0], [-40, -10, -90], [-40, 14, -90], [40, -10, 90], [-7, 26.6, 180], [7, 26.6, 180]]) b.defend(x, z, yaw);
  A.alarm = b.pt(8, 4);
  b.box(8, 0, 4, 0.5, 1.6, 0.5, COL.red);
  A.gate = gates.s;
  A.approach = norm(0.1, 1);
}

// ---------- Fuel Depot ----------
function depot(b) {
  const A = b.anchors;
  const gates = b.perimeter(0, 0, 124, 88, 'fence', { w: { w: 10 }, s: { w: 6, at: 30 } });
  b.slab(0, 0, 120, 84, COL.gravel, 0.03);
  for (const z of [-24, 0, 24]) {
    b.cyl(32, 0, z, 5.5, 7, COL.white, { seg: 12 });
    b.deco(32, 7, z, 2, 0.5, 2, COL.metal);
    b.objective(25.2, z, 'Fuel tank');
    b.box(20, 0, z, 9, 0.7, 0.7, COL.metal);
    b.coverAlong(15.5, z, 24.5, z, 0.7);
  }
  b.box(20, 0, 0, 0.7, 0.7, 49, COL.metal);
  b.building(12, -34, 8, 6, 2.6, { doors: ['s'], color: COL.concrete });
  const office = b.building(-34, -26, 10, 8, 2.8, { doors: ['s'], color: COL.concreteDark });
  A.hvt = office.inside;
  b.intel(-36, -27);
  for (const z of [0, 10]) {
    b.building(-50, z, 6, 5, 2.5, { doors: ['e'], color: COL.woodDark, windows: false, roofColor: COL.tin });
    b.cell(-50, z);
  }
  b.hut(-32, 26, 16, 9, 3.4, COL.tin, COL.metalDark);
  for (const x of [-12, -4, 4]) b.truck(x, 28, false);
  b.tower(-56, 38, 5, 'e', Math.PI * 0.75);
  b.tower(56, -38, 5, 'w', -Math.PI / 4);
  b.barrels(8, 12, 6);
  b.barrels(44, -10, 4);
  b.barrels(-18, -8, 4);
  for (const [x, z, n] of [[0, -18, 4], [-20, 8, 4], [46, 34, 3], [10, 2, 3]]) b.crates(x, z, n);
  for (const [x, z] of [[24, -12], [24, 12], [40, -34], [40, 34], [-10, -30], [-10, 12], [-40, -8], [-40, 36], [8, 36], [56, 0]]) b.lamp(x, z, 5.5);
  for (const [x, z] of [[-58, -3], [-58, 3], [22, -30], [22, 6], [22, 30], [40, -12], [40, 12], [-30, -20], [-20, 18], [0, 22], [0, -6], [-44, 6], [10, -28], [48, 36]]) b.guard(x, z);
  b.patrol(loop(112, 76));
  b.patrol([[14, -34], [44, -34], [44, 34], [14, 34]]);
  b.patrol([[-56, -8], [-10, -8], [-10, 16], [-56, 16]]);
  A.alarm = b.pt(-20, -12);
  b.box(-20, 0, -12, 0.5, 1.6, 0.5, COL.red);
  A.gate = gates.w;
  A.approach = norm(-0.94, 0.34);
}

// ---------- Highcrag Camp ----------
function powcamp(b) {
  const A = b.anchors;
  const gates = b.perimeter(0, 0, 84, 62, 'fence', { s: { w: 8 } });
  for (const x of [-18, -6, 6, 18]) {
    b.building(x, -18, 7, 6, 2.6, { doors: ['s'], color: COL.concreteDark, windows: false });
    b.cell(x, -18);
  }
  b.hut(-28, 10, 14, 7, 2.8, COL.plank, COL.tin);
  b.hut(28, 10, 14, 7, 2.8, COL.plank, COL.tin);
  const hut = b.building(0, 14, 8, 7, 2.8, { doors: ['n'], color: COL.concrete });
  A.hvt = hut.inside;
  b.intel(1.5, 15);
  for (const [x, z, side, yaw] of [[-37, -26, 'e', -0.75], [37, -26, 'w', -0.25], [-37, 26, 'e', 0.75], [37, 26, 'w', 0.25]]) b.tower(x, z, 6, side, yaw * Math.PI);
  b.sandbags(-9, 27, -4.5, 27);
  b.sandbags(4.5, 27, 9, 27);
  b.sandbags(-12, -6, 12, -6);
  for (const [x, z, n] of [[-16, 2, 4], [16, 0, 4], [30, -8, 3], [-30, -10, 3]]) b.crates(x, z, n);
  b.truck(16, 22, true);
  for (const [x, z] of [[-24, -8], [24, -8], [0, -8], [-14, 22], [14, 22], [0, 4]]) b.lamp(x, z, 5.5);
  for (const [x, z] of [[-3, 29], [3, 29], [-18, -12], [-6, -12], [6, -12], [18, -12], [0, 8], [-22, 4], [22, 4], [-34, -4], [34, -2], [10, 20], [-10, 22]]) b.guard(x, z);
  b.patrol(loop(74, 52));
  b.patrol([[-52, -42], [52, -42], [52, 42], [-52, 42]]);
  A.alarm = b.pt(10, 2);
  b.box(10, 0, 2, 0.5, 1.6, 0.5, COL.red);
  A.gate = gates.s;
  A.approach = norm(0.3, 0.95);
}

// ---------- Grayport ----------
function harbor(b) {
  const A = b.anchors;
  const g = b.terrain.sites.grayport.ground;
  const gates = b.perimeter(8, 0, 136, 124, 'fence', { e: { w: 10 }, s: { w: 6, at: 20 } });
  b.slab(8, 0, 132, 120, COL.gravel, 0.03);
  b.hut(-12, -34, 22, 12, 6, COL.tin, COL.metalDark);
  b.hut(-12, -4, 22, 12, 6, COL.tin, COL.rust);
  b.hut(22, -34, 22, 12, 6, COL.tin, COL.metalDark);
  const store = b.building(22, -4, 20, 12, 4.4, { doors: ['w', 'e'], color: COL.tin, roofColor: COL.metalDark });
  b.intel(24, -5);
  const office = b.building(-30, 30, 12, 9, 3, { doors: ['e'], color: COL.concrete });
  A.hvt = office.inside;
  b.intel(-32, 29);
  A.interior.push(store.inside);
  const tints = [COL.blue, COL.rust, COL.green, COL.orange, COL.white];
  let k = 0;
  for (const z of [24, 34, 44]) for (const x of [12, 22, 32, 46]) b.container(x, z, true, tints[k++ % tints.length], (k % 3) + 1 > 2 ? 2 : 1);
  for (const x of [56, 62]) for (const z of [-20, -8]) b.container(x, z, false, tints[k++ % tints.length], 1);
  // two piers out over the water to the west
  for (const z of [-22, 22]) for (let x = -64; x > -124; x -= 10) b.box(x, 0, z, 10, 0.5, 6, COL.plank, { ground: g - 0.25 });
  b.box(-118, 0.25, 26, 7, 1.6, 2.6, COL.metalDark, { ground: g - 0.9 });
  b.box(-104, 0.25, -26, 9, 2, 3, COL.rust, { ground: g - 0.9 });
  A.escape = { x: b.wx(-112), z: b.wz(22), y: g + 0.25 };
  // the crane
  b.box(-50, 0, 0, 3, 16, 3, COL.yellow);
  b.deco(-58, 15, 0, 20, 1, 1.4, COL.yellow);
  b.tower(64, -52, 6, 'w', -Math.PI / 4);
  b.tower(64, 52, 6, 'w', Math.PI / 4);
  b.tower(-44, -52, 6, 'e', -Math.PI * 0.75);
  b.barrels(-36, 10, 5);
  for (const [x, z, n] of [[-42, -20, 4], [0, 16, 4], [40, 8, 4], [-20, 48, 3], [50, -44, 3]]) b.crates(x, z, n);
  b.truck(44, -44, true);
  b.truck(4, 52, true);
  for (const [x, z] of [[-30, -18], [-30, 14], [4, -18], [4, 14], [40, -20], [40, 16], [-56, -22], [-56, 22], [60, 20], [20, 54]]) b.lamp(x, z, 6);
  for (const [x, z] of [[73, -3], [73, 3], [-24, 30], [-22, 36], [0, -20], [8, 12], [40, -6], [34, 40], [-44, 0], [-60, -22], [-60, 22], [-80, 22], [50, -30], [-6, 48], [26, 18], [-34, -44]]) b.guard(x, z);
  b.patrol([[-54, -50], [66, -50], [66, 54], [-54, 54]]);
  b.patrol([[2, -44], [2, 14], [40, 14], [40, -44]]);
  b.patrol([[-58, -22], [-110, -22], [-58, -22], [-58, 22], [-110, 22], [-58, 22]]);
  A.alarm = b.pt(-22, 22);
  b.box(-22, 0, 22, 0.5, 1.6, 0.5, COL.red);
  A.gate = gates.e;
  A.approach = norm(0.5, 0.86);
}

// ---------- The Citadel ----------
function citadel(b) {
  const A = b.anchors;
  const gates = b.perimeter(0, 0, 164, 132, 'stone', { s: { w: 10 }, e: { w: 6, at: 20 } });
  b.slab(0, 0, 162, 130, COL.gravel, 0.03);
  // the keep, split in two by an inner wall
  const keep = b.building(0, -28, 32, 22, 5.2, { doors: ['s', 'w', 'e'], color: COL.stone });
  b.wall(-16, -30, 16, -30, 5.2, { color: COL.stoneDark, openings: [{ at: b.doorAt(0, b.cx - 16, 16), w: 1.8, y0: 0, y1: 2.2 }] });
  A.hvt = b.pt(0, -35);
  b.intel(8, -36);
  A.interior.push(keep.inside);
  for (const x of [-56, 56]) {
    // anti-air battery in its own sandbagged court
    b.box(x, 0, 22, 4, 1.2, 4, COL.metalDark);
    b.deco(x - 0.6, 1.2, 21, 0.3, 3.4, 0.3, COL.metal);
    b.deco(x + 0.6, 1.2, 21, 0.3, 3.4, 0.3, COL.metal);
    b.objective(x, 25, 'Anti-air battery');
    b.sandbags(x - 6, 16, x + 6, 16);
    b.sandbags(x - 6, 16, x - 6, 28);
    b.sandbags(x + 6, 16, x + 6, 28);
  }
  b.building(-52, -34, 16, 8, 3, { doors: ['e'], color: COL.stoneDark });
  b.building(52, -34, 16, 8, 3, { doors: ['w'], color: COL.stoneDark });
  b.hut(-30, 44, 16, 8, 3, COL.stoneDark, COL.roofSlate);
  b.hut(30, 44, 16, 8, 3, COL.stoneDark, COL.roofSlate);
  for (const [x, z, side, yaw] of [[-77, -61, 'e', -0.75], [77, -61, 'w', -0.25], [-77, 61, 'e', 0.75], [77, 61, 'w', 0.25], [-12, 60, 'n', 1], [12, 60, 'n', 1]]) b.tower(x, z, 7, side, yaw * Math.PI);
  b.sandbags(-12, 50, -5.5, 50);
  b.sandbags(5.5, 50, 12, 50);
  b.sandbags(-14, -8, -4, -8);
  b.sandbags(4, -8, 14, -8);
  b.hesco(-30, 10, -22, 10, 1.6);
  b.hesco(22, 10, 30, 10, 1.6);
  b.hesco(-6, 26, 6, 26, 1.6);
  for (const [x, z, n] of [[-20, 30, 4], [20, 30, 4], [-36, -8, 4], [36, -8, 4], [0, 8, 4], [-60, 46, 3], [60, 46, 3], [66, -10, 3], [-66, -10, 3]]) b.crates(x, z, n);
  b.truck(-24, 56, true);
  b.truck(40, 20, false);
  b.flagpole(0, -12, COL.red, 12);
  for (const [x, z] of [[-40, 30], [40, 30], [-40, -10], [40, -10], [0, 40], [0, -4], [-68, 30], [68, 30], [-68, -40], [68, -40]]) b.lamp(x, z, 6);
  for (const [x, z] of [[-4, 58], [4, 58], [-9, 48], [9, 48], [-56, 14], [56, 14], [-50, 26], [50, 26], [-20, 12], [20, 12], [0, 28], [-9, -6], [9, -6], [-40, -30], [40, -30], [-18, -14], [18, -14], [0, -22], [-70, 0], [70, 0], [79, 17], [-30, 36], [30, 36], [0, -44]]) b.guard(x, z);
  b.patrol(loop(140, 110));
  b.patrol([[-40, 4], [40, 4], [40, 40], [-40, 40]]);
  b.patrol([[-96, -80], [96, -80], [96, 80], [-96, 80]]);
  A.alarm = b.pt(14, 2);
  b.box(14, 0, 2, 0.5, 1.6, 0.5, COL.red);
  A.asset = b.pt(0, -12);
  A.gate = gates.s;
  A.approach = norm(-0.37, 0.93);
}

export const LAYOUTS = { base, port, checkpoint, village: brightwater, sawmill, relay, quarry, villa, fort, depot, village2: stonebridge, powcamp, harbor, citadel };
