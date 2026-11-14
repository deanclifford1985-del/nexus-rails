// The world the simulation runs in: the ground, everything built on it, what grows on it, and
// the navigation grid. Built once, the same way every time. The view draws from `shapes`,
// `trees`, `bushes` and `rocks`; the simulation asks it questions.

import { B, clamp, mulberry } from '../game/balance.js';
import { LOCATIONS, WORLD } from '../game/world.js';
import { Terrain, GROUND } from './terrain.js';
import { Colliders } from './colliders.js';
import { Nav } from './nav.js';
import { SiteBuilder } from './sitekit.js';
import { LAYOUTS } from './layouts.js';

// How bright the sky is at an hour of the day: 1 = full day, about 0.14 = moonlight.
export function daylight(hour) {
  const h = ((hour % 24) + 24) % 24;
  const dawn0 = B.WORLD.NIGHT_END - 0.5;
  const dawn1 = B.WORLD.NIGHT_END + 1.5;
  const dusk0 = B.WORLD.NIGHT_START - 2;
  const dusk1 = B.WORLD.NIGHT_START + 0.4;
  const night = 0.14;
  if (h >= dawn1 && h <= dusk0) return 1;
  if (h > dawn0 && h < dawn1) return night + ((h - dawn0) / (dawn1 - dawn0)) * (1 - night);
  if (h > dusk0 && h < dusk1) return 1 - ((h - dusk0) / (dusk1 - dusk0)) * (1 - night);
  return night;
}
export const isNight = (hour) => daylight(hour) < 0.4;

const BUSH_CELL = 6;

export class World {
  constructor() {
    this.terrain = new Terrain();
    this.colliders = new Colliders(this.terrain);
    this.sites = {};
    this.shapes = {}; // site id -> shapes to draw
    this.lamps = [];
    this.powerOff = {}; // site id -> true when a plan cut the power

    // what grows
    const veg = this.terrain.scatter();
    this.trees = veg.trees;
    this.bushes = veg.bushes;
    this.rocks = veg.rocks;
    for (const t of this.trees) this.colliders.addCircle({ x: t.x, z: t.z, r: t.r * t.s, y0: t.y - 1, y1: t.y + 5 * t.s, kind: 'tree' });
    for (const r of this.rocks) this.colliders.addCircle({ x: r.x, z: r.z, r: r.r * 0.9, y0: r.y - 1, y1: r.y + r.h, kind: 'rock' });
    this.bushGrid = new Map();
    for (const b of this.bushes) {
      const key = Math.floor(b.x / BUSH_CELL) * 4096 + Math.floor(b.z / BUSH_CELL);
      let list = this.bushGrid.get(key);
      if (!list) this.bushGrid.set(key, (list = []));
      list.push(b);
    }

    // what is built
    for (const loc of LOCATIONS) {
      const builder = new SiteBuilder(this, loc);
      LAYOUTS[loc.layout](builder);
      this.shapes[loc.id] = builder.shapes;
      const anchors = builder.anchors;
      for (const lamp of anchors.lamps) this.lamps.push({ ...lamp, site: loc.id });
      this.sites[loc.id] = { id: loc.id, name: loc.name, kind: loc.kind, x: loc.x, z: loc.z, r: loc.r, tier: loc.tier ?? 1, ground: this.terrain.sites[loc.id].ground, anchors };
    }
    this.lampGrid = new Map();
    for (const lamp of this.lamps) {
      const key = Math.floor(lamp.x / 32) * 4096 + Math.floor(lamp.z / 32);
      let list = this.lampGrid.get(key);
      if (!list) this.lampGrid.set(key, (list = []));
      list.push(lamp);
    }

    this.nav = new Nav(this.terrain, this.colliders);
    for (const site of Object.values(this.sites)) this.finishAnchors(site);
    this.caches = this.placeCaches();
  }

  // Fills in the points a layout did not name: where to insert, where to leave, where attackers
  // gather, and drops any cover point that ended up inside something.
  finishAnchors(site) {
    const A = site.anchors;
    const ap = A.approach;
    const place = (x, z, reach = 30) => {
      const free = this.walkableNear(x, z, reach);
      const p = free ?? { x, z };
      return { x: p.x, z: p.z, y: this.terrain.heightAt(p.x, p.z) };
    };
    const rot = (v, deg) => {
      const a = (deg * Math.PI) / 180;
      return { x: v.x * Math.cos(a) - v.z * Math.sin(a), z: v.x * Math.sin(a) + v.z * Math.cos(a) };
    };
    A.center = { x: site.x, z: site.z, y: site.ground };
    A.gate = A.gate ? place(A.gate.x, A.gate.z, 6) : place(site.x + ap.x * site.r * 0.6, site.z + ap.z * site.r * 0.6);
    // A point outside the site that a soldier can actually walk to the gate from. Tries the
    // wanted bearing first, then swings round either way until it finds one.
    const linked = (p) => {
      const path = this.nav.findPath(p.x, p.z, A.gate.x, A.gate.z);
      return !!path && this.nav.lastFound;
    };
    const outside = (dir, dist) => {
      for (const turn of [0, 20, -20, 40, -40, 65, -65, 90, -90]) {
        const d = rot(dir, turn);
        const p = this.walkableNear(site.x + d.x * dist, site.z + d.z * dist, 20);
        if (p && linked(p)) return { x: p.x, z: p.z, y: this.terrain.heightAt(p.x, p.z) };
      }
      return place(site.x + dir.x * dist, site.z + dir.z * dist);
    };
    A.insert = A.insert ? place(A.insert.x, A.insert.z) : outside(ap, site.r + 105);
    A.alt = A.alt ? place(A.alt.x, A.alt.z) : outside(rot(ap, 150), site.r + 95);
    A.exfil = A.exfil ? place(A.exfil.x, A.exfil.z) : outside(rot(ap, 32), site.r + 95);
    // gathering points for attackers, all round the site (only ones with a way in)
    A.spawns = [];
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const dir = { x: Math.cos(a), z: Math.sin(a) };
      const p = this.walkableNear(site.x + dir.x * (site.r + 78), site.z + dir.z * (site.r + 78), 16);
      if (p && linked(p)) A.spawns.push({ x: p.x, z: p.z, y: this.terrain.heightAt(p.x, p.z), dir, away: -(dir.x * ap.x + dir.z * ap.z) });
    }
    A.cover = A.cover.filter((p) => !this.nav.isBlocked(p.x, p.z));
    A.guards = A.guards.map((p) => {
      if (!this.nav.isBlocked(p.x, p.z)) return p;
      const free = this.nav.nearestFree(p.x, p.z, 4);
      return free ? { ...p, x: free.x, z: free.z, y: this.terrain.heightAt(free.x, free.z) } : p;
    });
    if (!A.patrols.length) A.patrols.push([0, 1, 2, 3].map((k) => place(site.x + Math.cos(k * 1.57) * site.r * 0.6, site.z + Math.sin(k * 1.57) * site.r * 0.6, 8)));
  }

  // A point near (x, z) a soldier can stand on: open on the grid, dry and not too steep.
  walkableNear(x, z, reach = 12) {
    const ok = (px, pz) => this.terrain.inBounds(px, pz, 30) && !this.nav.isBlocked(px, pz) && this.terrain.depthAt(px, pz) < 0.3 && this.terrain.slopeAt(px, pz) < 30;
    if (ok(x, z)) return { x, z };
    for (let r = 3; r <= reach; r += 3) {
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        const px = x + Math.cos(a) * r;
        const pz = z + Math.sin(a) * r;
        if (ok(px, pz)) return { x: px, z: pz };
      }
    }
    return null;
  }

  // Supply caches hidden in Legion country, the same ones every game.
  placeCaches() {
    const rng = mulberry(WORLD.seed + 9001);
    const out = [];
    let guard = 0;
    while (out.length < 26 && guard++ < 4000) {
      const x = (rng() * 2 - 1) * 1050;
      const z = -1050 + rng() * (1050 + WORLD.front);
      if (this.terrain.heightAt(x, z) < 4 || this.terrain.slopeAt(x, z) > 20) continue;
      if (this.terrain.siteAt(x, z, 25) || this.nav.isBlocked(x, z)) continue;
      if (out.some((c) => Math.hypot(c.x - x, c.z - z) < 150)) continue;
      const tier = clamp(Math.round(1 + ((WORLD.front - z) / 1100) * 8), 1, 9);
      out.push({ id: `cache${out.length}`, x, z, y: this.terrain.heightAt(x, z), tier });
    }
    // and one in each site that marked a spot for it
    for (const site of Object.values(this.sites)) {
      site.anchors.loot.slice(0, 2).forEach((p, i) => out.push({ id: `${site.id}-loot${i}`, x: p.x, z: p.z, y: p.y, tier: site.tier, site: site.id }));
    }
    return out;
  }

  // ---------- questions the simulation asks ----------
  bushAt(x, z) {
    const cx = Math.floor(x / BUSH_CELL);
    const cz = Math.floor(z / BUSH_CELL);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const list = this.bushGrid.get((cx + dx) * 4096 + cz + dz);
        if (!list) continue;
        for (const b of list) if ((b.x - x) ** 2 + (b.z - z) ** 2 < b.r * b.r) return b;
      }
    }
    return null;
  }

  // What you are standing in, for concealment: 'bush', 'tallgrass' or null.
  coverAt(x, z) {
    if (this.bushAt(x, z)) return 'bush';
    return this.terrain.typeAt(x, z) === GROUND.tallgrass ? 'tallgrass' : null;
  }

  // How much of a watcher's sight survives the woodland between two points (1 = open ground).
  sightThrough(ax, az, bx, bz) {
    const dist = Math.hypot(bx - ax, bz - az);
    if (dist < 6) return 1;
    let wooded = 0;
    const n = 5;
    for (let i = 1; i <= n; i++) {
      const t = i / (n + 1);
      wooded += this.terrain.forestAt(ax + (bx - ax) * t, az + (bz - az) * t) > 0.5 ? 1 : 0;
    }
    return Math.exp(-(wooded / n) * dist * B.STEALTH.FOREST_PER_M);
  }

  // Light on the ground here: daylight, or a lamp at night (unless that site's power is cut).
  lightAt(x, z, hour) {
    const day = daylight(hour);
    if (day >= 0.75) return day;
    const cx = Math.floor(x / 32);
    const cz = Math.floor(z / 32);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const list = this.lampGrid.get((cx + dx) * 4096 + cz + dz);
        if (!list) continue;
        for (const lamp of list) {
          if (this.powerOff[lamp.site]) continue;
          const d2 = (lamp.x - x) ** 2 + (lamp.z - z) ** 2;
          if (d2 < lamp.r * lamp.r) return Math.max(day, 0.9 - (Math.sqrt(d2) / lamp.r) * 0.35);
        }
      }
    }
    return day;
  }

  siteNear(x, z, extra = 60) {
    let best = null;
    let bestD = Infinity;
    for (const site of Object.values(this.sites)) {
      const d = Math.hypot(site.x - x, site.z - z) - site.r;
      if (d < extra && d < bestD) {
        best = site;
        bestD = d;
      }
    }
    return best;
  }
}
