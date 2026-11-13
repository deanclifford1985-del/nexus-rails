// A kit for building sites out of boxes. Everything is axis-aligned. Coordinates given to a
// SiteBuilder are local to the site's centre (x east, z south, y above the local ground); the
// builder records what to draw (shapes), what is solid (colliders) and the named points that
// missions and the AI use (anchors).

import { mulberry, hashString } from '../game/balance.js';

export const COL = {
  concrete: 0x9a968c, concreteDark: 0x7b786f, wood: 0x7a5a3a, woodDark: 0x5a4028, plank: 0x8f6f48, tin: 0x77818b, rust: 0x8a4f3a,
  canvas: 0x5f6844, canvasTan: 0x9c9069, canvasWhite: 0xd9d6c8, sandbag: 0xb3a276, hesco: 0x91876a, stone: 0x8b867c, stoneDark: 0x6c6860,
  plaster: 0xd9d0b9, plaster2: 0xc8b79e, plaster3: 0xb9c2c4, roofTile: 0x9c4c3a, roofSlate: 0x505662, metal: 0x4d545b, metalDark: 0x2f3438,
  olive: 0x4f5a34, red: 0xb5392d, yellow: 0xdcb53a, white: 0xe9e7dd, black: 0x1b1d1e, crate: 0x7d6c46, crateDark: 0x5e5135, blue: 0x3f6f9a,
  green: 0x3d7a4f, orange: 0xc96b2a, lamp: 0xfff0b8, rope: 0xa7915c, asphalt: 0x3d3e40, gravel: 0x9d988b, dirt: 0x87714f, target: 0xe9e1d1,
  wire: 0x6a6f66, glass: 0x9fc4cf,
};

const snapHalf = (v) => Math.floor(v) + 0.5;

export class SiteBuilder {
  constructor(world, loc) {
    this.world = world;
    this.terrain = world.terrain;
    this.colliders = world.colliders;
    this.id = loc.id;
    this.cx = loc.x;
    this.cz = loc.z;
    this.r = loc.r;
    this.rng = mulberry(hashString(loc.id) + 91);
    this.shapes = [];
    this.anchors = {
      guards: [], towers: [], patrols: [], interior: [], cells: [], objectives: [], intel: [], defend: [], loot: [], cover: [], lamps: [],
      hvt: null, asset: null, escape: null, alarm: null, gate: null, insert: null, alt: null, exfil: null, approach: { x: 0, z: 1 }, npcs: {},
    };
  }

  // local -> world
  wx(x) {
    return this.cx + x;
  }
  wz(z) {
    return this.cz + z;
  }
  groundAt(x, z) {
    return this.terrain.heightAt(this.cx + x, this.cz + z);
  }
  pt(x, z, extra = {}) {
    const wx = this.cx + x;
    const wz = this.cz + z;
    return { x: wx, z: wz, y: this.terrain.heightAt(wx, wz), ...extra };
  }

  // ---------- primitives ----------
  // A box centred on (x, z), standing on the ground with its base y metres above it.
  box(x, y, z, sx, sy, sz, color, opts = {}) {
    const wx = this.cx + x;
    const wz = this.cz + z;
    const ground = opts.ground ?? this.terrain.heightAt(wx, wz);
    const base = ground + y;
    if (opts.draw !== false) this.shapes.push({ t: 'box', x: wx, y: base + sy / 2 - (y === 0 ? 0.3 : 0), z: wz, sx, sy: sy + (y === 0 ? 0.6 : 0), sz, c: color, glow: opts.glow });
    const collide = opts.collide ?? 'solid';
    if (collide) {
      const box = { x0: wx - sx / 2, x1: wx + sx / 2, z0: wz - sz / 2, z1: wz + sz / 2, y0: base, y1: base + sy, kind: collide };
      if (opts.nowalk) box.nowalk = true;
      if (opts.tag) box.tag = opts.tag;
      if (opts.exit) box.exit = opts.exit;
      this.colliders.addBox(box);
      return box;
    }
    return null;
  }

  // Drawn only.
  deco(x, y, z, sx, sy, sz, color, opts = {}) {
    return this.box(x, y, z, sx, sy, sz, color, { ...opts, collide: false });
  }

  // A thin slab on the ground: parade squares, pads, floors.
  slab(x, z, sx, sz, color, lift = 0.04) {
    const wx = this.cx + x;
    const wz = this.cz + z;
    this.shapes.push({ t: 'box', x: wx, y: this.terrain.heightAt(wx, wz) + lift / 2 + 0.01, z: wz, sx, sy: lift, sz, c: color });
  }

  cyl(x, y, z, r, h, color, opts = {}) {
    const wx = this.cx + x;
    const wz = this.cz + z;
    const base = this.terrain.heightAt(wx, wz) + y;
    this.shapes.push({ t: 'cyl', x: wx, y: base + h / 2 - (y === 0 ? 0.2 : 0), z: wz, r, h: h + (y === 0 ? 0.4 : 0), c: color, seg: opts.seg ?? 8, glow: opts.glow });
    if (opts.collide !== false) this.colliders.addCircle({ x: wx, z: wz, r, y0: base, y1: base + h, kind: 'prop' });
  }

  // A gable roof (drawn) with a thin solid slab under it. axis is the ridge direction.
  roof(x, y, z, sx, sz, rise, color, axis = 'x') {
    const wx = this.cx + x;
    const wz = this.cz + z;
    const base = this.terrain.heightAt(wx, wz) + y;
    this.shapes.push({ t: 'roof', x: wx, y: base, z: wz, sx, sy: rise, sz, c: color, axis });
    this.colliders.addBox({ x0: wx - sx / 2, x1: wx + sx / 2, z0: wz - sz / 2, z1: wz + sz / 2, y0: base - 0.05, y1: base + 0.2, kind: 'solid', nowalk: true });
  }

  // ---------- walls ----------
  // A wall along x or z from (x0, z0) to (x1, z1). openings: [{ at, w, y0, y1 }] measured from the
  // start; a door is y0 = 0, a window has a sill.
  wall(x0, z0, x1, z1, h, opts = {}) {
    const t = opts.t ?? 0.3;
    const color = opts.color ?? COL.concrete;
    const kind = opts.kind ?? 'solid';
    const alongX = Math.abs(x1 - x0) >= Math.abs(z1 - z0);
    const length = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
    const dir = alongX ? Math.sign(x1 - x0) || 1 : Math.sign(z1 - z0) || 1;
    const piece = (from, to, y, height) => {
      if (to - from < 0.05 || height < 0.05) return;
      const mid = (from + to) / 2;
      const len = to - from;
      if (alongX) this.box(x0 + dir * mid, y, z0, len, height, t, color, { collide: kind, nowalk: opts.nowalk });
      else this.box(x0, y, z0 + dir * mid, t, height, len, color, { collide: kind, nowalk: opts.nowalk });
    };
    const openings = [...(opts.openings ?? [])].sort((a, b) => a.at - b.at);
    let cursor = 0;
    for (const o of openings) {
      const a = Math.max(cursor, o.at - o.w / 2);
      const b = Math.min(length, o.at + o.w / 2);
      piece(cursor, a, 0, h);
      if ((o.y0 ?? 0) > 0) piece(a, b, 0, o.y0);
      if ((o.y1 ?? 2.2) < h) piece(a, b, o.y1 ?? 2.2, h - (o.y1 ?? 2.2));
      cursor = b;
    }
    piece(cursor, length, 0, h);
  }

  // Distance along a wall at which a door should sit so its centre lands on a half-metre in
  // world coordinates (which keeps the doorway open on the navigation grid).
  doorAt(start, world0, wanted) {
    const worldCentre = snapHalf(world0 + wanted);
    return worldCentre - world0 + (start ?? 0);
  }

  // A hollow building you can walk into. doors: sides ('n' 's' 'e' 'w'). Returns handy points.
  building(x, z, w, d, h, o = {}) {
    const color = o.color ?? COL.concrete;
    const doors = o.doors ?? ['s'];
    const win = o.windows !== false;
    const x0 = x - w / 2;
    const x1 = x + w / 2;
    const z0 = z - d / 2;
    const z1 = z + d / 2;
    const out = { x, z, w, d, h, doors: {}, inside: this.pt(x, z) };
    const windowsAlong = (length, skip) => {
      const list = [];
      if (!win) return list;
      for (let at = 2.2; at < length - 1.6; at += 3.6) {
        if (skip !== null && Math.abs(at - skip) < 2.4) continue;
        list.push({ at, w: 1.1, y0: 1.05, y1: 1.95 });
      }
      return list;
    };
    const side = (name, ax, az, bx, bz, alongX) => {
      const length = alongX ? w : d;
      let doorPos = null;
      const openings = [];
      if (doors.includes(name)) {
        const world0 = alongX ? this.cx + ax : this.cz + az;
        doorPos = snapHalf(world0 + length / 2 + (o.doorShift ?? 0)) - world0;
        openings.push({ at: doorPos, w: 1.8, y0: 0, y1: 2.2 });
        const px = alongX ? ax + doorPos : ax;
        const pz = alongX ? az : az + doorPos;
        const nx = name === 'e' ? 1 : name === 'w' ? -1 : 0;
        const nz = name === 's' ? 1 : name === 'n' ? -1 : 0;
        out.doors[name] = { out: this.pt(px + nx * 1.6, pz + nz * 1.6), in: this.pt(px - nx * 1.4, pz - nz * 1.4) };
      }
      openings.push(...windowsAlong(length, doorPos));
      this.wall(ax, az, bx, bz, h, { color, openings });
    };
    side('n', x0, z0, x1, z0, true);
    side('s', x0, z1, x1, z1, true);
    side('w', x0, z0, x0, z1, false);
    side('e', x1, z0, x1, z1, false);
    if (o.roof === 'gable') this.roof(x, h, z, w + 0.8, d + 0.8, o.rise ?? 1.6, o.roofColor ?? COL.roofTile, w >= d ? 'x' : 'z');
    else this.box(x, h, z, w + 0.5, 0.25, d + 0.5, o.roofColor ?? COL.concreteDark, { nowalk: o.roofWalk ? undefined : true });
    if (o.floor) this.slab(x, z, w, d, o.floor);
    this.anchors.interior.push(out.inside);
    out.door = out.doors[doors[0]];
    return out;
  }

  // A solid hut with a pitched roof: scenery you cannot enter.
  hut(x, z, w, d, h, color = COL.plank, roofColor = COL.tin) {
    this.box(x, 0, z, w, h, d, color);
    this.shapes.push({ t: 'roof', x: this.cx + x, y: this.groundAt(x, z) + h, z: this.cz + z, sx: w + 0.7, sy: 1.5, sz: d + 0.7, c: roofColor, axis: w >= d ? 'x' : 'z' });
  }

  // A ridge tent. open = a fly on poles you can stand under.
  tent(x, z, w, d, color = COL.canvas, open = false) {
    const axis = w >= d ? 'x' : 'z';
    if (open) {
      for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) this.box(x + (px * (w - 0.3)) / 2, 0, z + (pz * (d - 0.3)) / 2, 0.14, 2.3, 0.14, COL.woodDark);
      this.shapes.push({ t: 'roof', x: this.cx + x, y: this.groundAt(x, z) + 2.3, z: this.cz + z, sx: w + 0.6, sy: 1.1, sz: d + 0.6, c: color, axis });
    } else {
      this.box(x, 0, z, w, 1.3, d, color);
      this.shapes.push({ t: 'roof', x: this.cx + x, y: this.groundAt(x, z) + 1.3, z: this.cz + z, sx: w + 0.3, sy: 1.5, sz: d + 0.3, c: color, axis });
    }
  }

  // ---------- fieldworks ----------
  sandbags(x0, z0, x1, z1, h = 1.0) {
    this.wall(x0, z0, x1, z1, h, { t: 0.75, color: COL.sandbag });
    this.coverAlong(x0, z0, x1, z1, 0.75);
  }
  hesco(x0, z0, x1, z1, h = 2.3) {
    this.wall(x0, z0, x1, z1, h, { t: 1.3, color: COL.hesco });
  }
  stoneWall(x0, z0, x1, z1, h = 3.2, openings = []) {
    this.wall(x0, z0, x1, z1, h, { t: 0.9, color: COL.stone, openings });
  }
  lowWall(x0, z0, x1, z1, h = 1.1, color = COL.stoneDark) {
    this.wall(x0, z0, x1, z1, h, { t: 0.5, color });
    this.coverAlong(x0, z0, x1, z1, 0.5);
  }

  // Wire fence: stops movement, not bullets or sight. gaps: [{ at, w }].
  fence(x0, z0, x1, z1, gaps = [], h = 2.3) {
    const alongX = Math.abs(x1 - x0) >= Math.abs(z1 - z0);
    const length = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
    const dir = alongX ? Math.sign(x1 - x0) || 1 : Math.sign(z1 - z0) || 1;
    const run = (from, to) => {
      if (to - from < 0.3) return;
      const mid = (from + to) / 2;
      const len = to - from;
      const px = alongX ? x0 + dir * mid : x0;
      const pz = alongX ? z0 : z0 + dir * mid;
      this.box(px, 0, pz, alongX ? len : 0.16, h, alongX ? 0.16 : len, 0, { collide: 'fence', draw: false });
      for (const wy of [0.5, 1.2, 1.9]) this.deco(px, wy, pz, alongX ? len : 0.04, 0.04, alongX ? 0.04 : len, COL.wire);
      for (let at = from; at <= to + 0.01; at += 4) {
        const qx = alongX ? x0 + dir * at : x0;
        const qz = alongX ? z0 : z0 + dir * at;
        this.deco(qx, 0, qz, 0.12, h, 0.12, COL.metal);
      }
    };
    let cursor = 0;
    for (const gap of [...gaps].sort((a, b) => a.at - b.at)) {
      run(cursor, gap.at - gap.w / 2);
      cursor = gap.at + gap.w / 2;
    }
    run(cursor, length);
  }

  // A rectangle of wall, hesco or fence centred on (x, z), with gates. gates: { s: { at, w }, ... }
  // where `at` is the offset of the gate from the middle of that side. Returns the gate points.
  perimeter(x, z, w, d, kind, gates = {}) {
    const x0 = x - w / 2;
    const x1 = x + w / 2;
    const z0 = z - d / 2;
    const z1 = z + d / 2;
    const points = {};
    const side = (name, ax, az, bx, bz, length) => {
      const gate = gates[name];
      const gaps = gate ? [{ at: length / 2 + (gate.at ?? 0), w: gate.w ?? 8 }] : [];
      if (kind === 'fence') this.fence(ax, az, bx, bz, gaps);
      else {
        const openings = gaps.map((g) => ({ ...g, y0: 0, y1: 99 }));
        if (kind === 'hesco') this.wall(ax, az, bx, bz, 2.3, { t: 1.3, color: COL.hesco, openings });
        else if (kind === 'stone') this.wall(ax, az, bx, bz, 3.4, { t: 0.9, color: COL.stone, openings });
        else this.wall(ax, az, bx, bz, 1.0, { t: 0.75, color: COL.sandbag, openings });
      }
      if (gate) {
        const along = length / 2 + (gate.at ?? 0);
        const px = name === 'n' || name === 's' ? ax + along : ax;
        const pz = name === 'n' || name === 's' ? az : az + along;
        points[name] = this.pt(px, pz);
      }
    };
    side('n', x0, z0, x1, z0, w);
    side('s', x0, z1, x1, z1, w);
    side('w', x0, z0, x0, z1, d);
    side('e', x1, z0, x1, z1, d);
    return points;
  }

  // A watchtower: platform on legs with a ladder on its `side`. Registers a tower post.
  tower(x, z, h = 5, side = 's', facing = 0) {
    const s = 3.2;
    for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) this.box(x + px * (s / 2 - 0.15), 0, z + pz * (s / 2 - 0.15), 0.22, h, 0.22, COL.woodDark);
    this.box(x, h, z, s, 0.2, s, COL.plank);
    const top = h + 0.2;
    const rail = (rx, rz, sx, sz) => this.box(x + rx, top, z + rz, sx, 1.0, sz, COL.wood);
    if (side !== 'n') rail(0, -s / 2 + 0.08, s, 0.14);
    if (side !== 's') rail(0, s / 2 - 0.08, s, 0.14);
    if (side !== 'w') rail(-s / 2 + 0.08, 0, 0.14, s);
    if (side !== 'e') rail(s / 2 - 0.08, 0, 0.14, s);
    for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) this.deco(x + px * (s / 2 - 0.1), top, z + pz * (s / 2 - 0.1), 0.1, 2.3, 0.1, COL.woodDark);
    this.deco(x, top + 2.3, z, s + 0.6, 0.14, s + 0.6, COL.tin);
    // ladder
    const lx = side === 'e' ? s / 2 + 0.35 : side === 'w' ? -s / 2 - 0.35 : 0;
    const lz = side === 's' ? s / 2 + 0.35 : side === 'n' ? -s / 2 - 0.35 : 0;
    const exit = this.pt(x + lx * 0.45, z + lz * 0.45);
    exit.y = this.groundAt(x, z) + top;
    this.box(x + lx, 0, z + lz, side === 'e' || side === 'w' ? 0.7 : 1.0, top, side === 'e' || side === 'w' ? 1.0 : 0.7, 0, { collide: 'ladder', draw: false, exit });
    for (let y = 0.3; y < top; y += 0.4) this.deco(x + lx, y, z + lz, side === 'e' || side === 'w' ? 0.06 : 0.6, 0.05, side === 'e' || side === 'w' ? 0.6 : 0.06, COL.wood);
    const post = this.pt(x, z, { yaw: facing });
    post.y = this.groundAt(x, z) + top;
    post.tower = true;
    this.anchors.towers.push(post);
    return post;
  }

  crate(x, z, s = 1.1, h = s, color = COL.crate) {
    this.box(x, 0, z, s, h, s, color);
    if (h >= 0.8 && h <= 1.5) this.coverAround(x, z, s);
  }
  // A cluster of crates, some stacked.
  crates(x, z, n = 4) {
    for (let i = 0; i < n; i++) {
      const px = x + (this.rng() - 0.5) * 3.2;
      const pz = z + (this.rng() - 0.5) * 3.2;
      const s = 1 + this.rng() * 0.5;
      const tall = this.rng() < 0.3;
      this.crate(Math.round(px * 2) / 2, Math.round(pz * 2) / 2, s, tall ? s * 1.9 : s, this.rng() < 0.5 ? COL.crate : COL.crateDark);
    }
  }
  barrel(x, z, color = COL.olive) {
    this.cyl(x, 0, z, 0.36, 1.0, color);
  }
  barrels(x, z, n = 3) {
    for (let i = 0; i < n; i++) this.barrel(x + (i % 2) * 0.8 + (this.rng() - 0.5) * 0.2, z + Math.floor(i / 2) * 0.8, this.rng() < 0.3 ? COL.red : COL.olive);
  }
  logs(x, z, len = 6, alongX = true) {
    for (let k = 0; k < 2; k++) this.box(x, k * 0.5, z, alongX ? len : 1.3 - k * 0.5, 0.55, alongX ? 1.3 - k * 0.5 : len, k ? COL.wood : COL.woodDark);
    this.coverAlong(alongX ? x - len / 2 : x, alongX ? z : z - len / 2, alongX ? x + len / 2 : x, alongX ? z : z + len / 2, 1.3);
  }

  // A lamp on a pole. Lit ground gives away anyone standing in it at night.
  lamp(x, z, h = 5) {
    this.deco(x, 0, z, 0.14, h, 0.14, COL.metalDark);
    this.deco(x, h, z, 0.5, 0.16, 0.5, COL.lamp, { glow: true });
    const p = this.pt(x, z);
    this.anchors.lamps.push({ x: p.x, z: p.z, y: p.y + h, r: 15 });
  }

  flagpole(x, z, color = COL.red, h = 8) {
    this.deco(x, 0, z, 0.12, h, 0.12, COL.white);
    this.shapes.push({ t: 'flag', x: this.cx + x, y: this.groundAt(x, z) + h - 0.9, z: this.cz + z, c: color });
  }

  truck(x, z, alongX = true, color = COL.olive) {
    const L = 6.4;
    const W = 2.4;
    const sx = alongX ? L : W;
    const sz = alongX ? W : L;
    this.box(x, 0.5, z, sx, 0.5, sz, COL.metalDark, { collide: false });
    this.box(x, 0, z, sx, 2.6, sz, 0, { draw: false });
    const cab = alongX ? [x + 2.1, z] : [x, z + 2.1];
    const bed = alongX ? [x - 1.1, z] : [x, z - 1.1];
    this.deco(cab[0], 1.0, cab[1], alongX ? 2.0 : W, 1.5, alongX ? W : 2.0, color);
    this.deco(bed[0], 1.0, bed[1], alongX ? 4.0 : W, 1.6, alongX ? W : 4.0, COL.canvas);
    for (const a of [-2.1, 1.9]) for (const b of [-1, 1]) this.deco(alongX ? x + a : x + b * 1.1, 0.05, alongX ? z + b * 1.1 : z + a, alongX ? 0.9 : 0.3, 0.9, alongX ? 0.3 : 0.9, COL.black);
    this.coverAround(x, z, Math.max(sx, sz) * 0.75);
  }

  // A shipping container; stack = how many high.
  container(x, z, alongX = true, color = COL.blue, stack = 1) {
    const sx = alongX ? 6.1 : 2.44;
    const sz = alongX ? 2.44 : 6.1;
    for (let i = 0; i < stack; i++) this.box(x, i * 2.6, z, sx, 2.6, sz, i % 2 ? COL.rust : color);
  }

  // A radio mast: lattice legs and a red light.
  mast(x, z, h = 24) {
    for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) this.deco(x + px * 0.9, 0, z + pz * 0.9, 0.14, h, 0.14, COL.metal);
    for (let y = 2; y < h; y += 3) this.deco(x, y, z, 2.0, 0.1, 2.0, COL.metal);
    this.box(x, 0, z, 2.2, 2.2, 2.2, COL.metalDark);
    this.deco(x, h, z, 0.3, 0.3, 0.3, COL.red, { glow: true });
  }

  // ---------- anchors ----------
  guard(x, z, yawDeg = null) {
    const p = this.pt(x, z);
    p.yaw = yawDeg === null ? Math.atan2(x, -z) : (yawDeg * Math.PI) / 180; // by default look outward
    this.anchors.guards.push(p);
    return p;
  }
  patrol(points) {
    this.anchors.patrols.push(points.map(([x, z]) => this.pt(x, z)));
  }
  cell(x, z) {
    this.anchors.cells.push(this.pt(x, z));
  }
  objective(x, z, label) {
    this.anchors.objectives.push(this.pt(x, z, { label }));
  }
  intel(x, z) {
    this.anchors.intel.push(this.pt(x, z));
  }
  defend(x, z, yawDeg = 0) {
    this.anchors.defend.push(this.pt(x, z, { yaw: (yawDeg * Math.PI) / 180 }));
  }
  loot(x, z) {
    this.anchors.loot.push(this.pt(x, z));
  }
  coverPoint(x, z) {
    this.anchors.cover.push(this.pt(x, z));
  }
  // Cover on both sides of a low wall.
  coverAlong(x0, z0, x1, z1, t) {
    const alongX = Math.abs(x1 - x0) >= Math.abs(z1 - z0);
    const length = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
    const dir = alongX ? Math.sign(x1 - x0) || 1 : Math.sign(z1 - z0) || 1;
    for (let at = 0.8; at < length; at += 2.2) {
      for (const sideSign of [-1, 1]) {
        const off = sideSign * (t / 2 + 0.7);
        if (alongX) this.coverPoint(x0 + dir * at, z0 + off);
        else this.coverPoint(x0 + off, z0 + dir * at);
      }
    }
  }
  coverAround(x, z, s) {
    const off = s / 2 + 0.7;
    this.coverPoint(x + off, z);
    this.coverPoint(x - off, z);
    this.coverPoint(x, z + off);
    this.coverPoint(x, z - off);
  }
}
