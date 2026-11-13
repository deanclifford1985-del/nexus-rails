// The ground of Corvane: a height grid generated from noise and then shaped by the map data
// (coast, lake, roads, flattened sites), plus what grows on it. Pure data and maths: the view
// draws it, the simulation walks on it.

import { WORLD, LOCATIONS, LAKES, ROADS, locationOf } from '../game/world.js';
import { clamp, lerp, smoothstep, mulberry } from '../game/balance.js';
import { FLATS, BUMPS, CLEARINGS, WOODS, inRect } from './baseplan.js';

export const GROUND = { grass: 0, forest: 1, dirt: 2, sand: 3, rock: 4, snow: 5, tallgrass: 6, farm: 7, gravel: 8, seabed: 9 };
export const SEA_LEVEL = 0;

// ---------- noise ----------
function hash(ix, iz, seed) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function vnoise(x, z, seed) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const v = fz * fz * fz * (fz * (fz * 6 - 15) + 10);
  const a = hash(ix, iz, seed);
  const b = hash(ix + 1, iz, seed);
  const c = hash(ix, iz + 1, seed);
  const d = hash(ix + 1, iz + 1, seed);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}

export function fbm(x, z, octaves, seed) {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * vnoise(x * freq, z * freq, seed + i * 101);
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}

function ridged(x, z, octaves, seed) {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(vnoise(x * freq, z * freq, seed + i * 57));
    sum += amp * n * n;
    norm += amp;
    amp *= 0.5;
    freq *= 2.1;
  }
  return sum / norm;
}

// ---------- the raw landform ----------
const S = WORLD.seed;

function landHeight(x, z) {
  const hills = fbm(x * 0.0021, z * 0.0021, 5, S);
  const detail = fbm(x * 0.011, z * 0.011, 3, S + 7);
  let h = 15 + hills * 20 + detail * 2.5;
  // The northern range.
  const range = smoothstep(-400, -720, z);
  if (range > 0) {
    const r = ridged(x * 0.0024, z * 0.0024, 4, S + 31);
    h += range * (20 + r * r * 150 + detail * 4);
  }
  // The western heights around Relay Hill.
  const west = Math.exp(-((x + 560) ** 2 + (z - 80) ** 2) / (2 * 150 * 150));
  h += west * 34;
  return h;
}

function islandMask(x, z) {
  const d = Math.hypot(x, z) / WORLD.coast;
  const n = fbm(x * 0.0035, z * 0.0035, 3, S + 53) * 0.13;
  return smoothstep(1.02, 0.78, d + n);
}

const rawHeight = (x, z) => -16 + (landHeight(x, z) + 16) * islandMask(x, z);

// ---------- roads as smooth lines ----------
function resolvePoint(p) {
  if (typeof p === 'string') {
    const loc = locationOf(p);
    return [loc.x, loc.z];
  }
  return p;
}

// Catmull-Rom through the control points, sampled about every `step` metres.
export function roadPolylines(step = 6) {
  return ROADS.map((road) => {
    const pts = road.map(resolvePoint);
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const length = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
      const n = Math.max(2, Math.round(length / step));
      for (let k = 0; k < n; k++) {
        const t = k / n;
        const t2 = t * t;
        const t3 = t2 * t;
        const x = 0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
        const z = 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
        out.push({ x, z, h: 0 });
      }
    }
    const last = pts[pts.length - 1];
    out.push({ x: last[0], z: last[1], h: 0 });
    return out;
  });
}

// Ground height each site is levelled to (some are set by hand).
const SITE_GROUND = { halden: 2.8, grayport: 2.8 };
const SITE_BLEND = 46;

export class Terrain {
  constructor() {
    this.size = WORLD.size;
    this.half = WORLD.half;
    this.cell = WORLD.cell;
    this.n = Math.round(WORLD.size / WORLD.cell) + 1;
    this.h = new Float32Array(this.n * this.n);
    this.type = new Uint8Array(this.n * this.n);
    this.forest = new Float32Array(this.n * this.n);
    this.roadDist = new Float32Array(this.n * this.n).fill(1e9);
    this.sites = {}; // id -> { x, z, r, ground }
    this.lakes = [];
    this.roads = roadPolylines();
    this.generate();
  }

  index(ix, iz) {
    return iz * this.n + ix;
  }

  generate() {
    const { n, cell, half, h } = this;
    // 1. raw landform and hills
    for (let iz = 0; iz < n; iz++) {
      const z = iz * cell - half;
      for (let ix = 0; ix < n; ix++) {
        const x = ix * cell - half;
        let y = rawHeight(x, z);
        for (const bump of BUMPS) {
          const d = Math.hypot(x - bump.x, z - bump.z);
          if (d < bump.r) y += bump.h * (0.5 + 0.5 * Math.cos((Math.PI * d) / bump.r));
        }
        h[iz * n + ix] = y;
      }
    }
    // 2. lakes: a levelled shore with a bowl in the middle
    for (const lake of LAKES) {
      let sum = 0;
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        sum += this.heightAt(lake.x + Math.cos(a) * lake.r, lake.z + Math.sin(a) * lake.r);
      }
      const level = clamp(sum / 16 - 1, 4, 40);
      this.lakes.push({ ...lake, level });
      this.stamp(lake.x, lake.z, lake.r + 120, (x, z, y) => {
        const d = Math.hypot(x - lake.x, z - lake.z);
        let out = lerp(y, level + 1.4, smoothstep(lake.r + 115, lake.r + 25, d));
        if (d < lake.r + 3) out = level + 1.4 - smoothstep(lake.r + 3, lake.r - 30, d) * 7.5;
        return out;
      });
    }
    // 3. sites: decide each one's ground height before roads are graded to meet them
    for (const loc of LOCATIONS) {
      const ground = SITE_GROUND[loc.id] ?? Math.max(3.4, this.heightAt(loc.x, loc.z));
      this.sites[loc.id] = { id: loc.id, x: loc.x, z: loc.z, r: loc.r, ground };
    }
    // 4. roads: a smoothed profile, with the ground blended to it on both sides
    const roadH = new Float32Array(n * n);
    for (const line of this.roads) {
      const raw = line.map((p) => {
        // inside a site the road sits at the site's level
        for (const site of Object.values(this.sites)) if (Math.hypot(p.x - site.x, p.z - site.z) < site.r + 10) return site.ground;
        return Math.max(1.6, this.heightAt(p.x, p.z));
      });
      const W = 14;
      for (let i = 0; i < line.length; i++) {
        let sum = 0;
        let count = 0;
        for (let k = -W; k <= W; k++) {
          const j = clamp(i + k, 0, line.length - 1);
          sum += raw[j];
          count++;
        }
        line[i].h = sum / count;
      }
      for (const p of line) {
        const ix0 = Math.max(0, Math.floor((p.x + half - 24) / cell));
        const ix1 = Math.min(n - 1, Math.ceil((p.x + half + 24) / cell));
        const iz0 = Math.max(0, Math.floor((p.z + half - 24) / cell));
        const iz1 = Math.min(n - 1, Math.ceil((p.z + half + 24) / cell));
        for (let iz = iz0; iz <= iz1; iz++) {
          for (let ix = ix0; ix <= ix1; ix++) {
            const d = Math.hypot(ix * cell - half - p.x, iz * cell - half - p.z);
            const i = iz * n + ix;
            if (d < this.roadDist[i]) {
              this.roadDist[i] = d;
              roadH[i] = p.h;
            }
          }
        }
      }
    }
    for (let i = 0; i < n * n; i++) {
      if (this.roadDist[i] < 24) h[i] = lerp(h[i], roadH[i], smoothstep(24, 7, this.roadDist[i]));
    }
    // 5. level the sites and the training grounds
    for (const loc of LOCATIONS) {
      const site = this.sites[loc.id];
      this.stamp(loc.x, loc.z, loc.r + SITE_BLEND, (x, z, y) => lerp(y, site.ground, smoothstep(loc.r + SITE_BLEND, loc.r, Math.hypot(x - loc.x, z - loc.z))));
    }
    const campGround = this.sites.hawthorne.ground;
    for (const rect of FLATS) {
      const pad = 30;
      this.stampRect(rect.x0 - pad, rect.x1 + pad, rect.z0 - pad, rect.z1 + pad, (x, z, y) => {
        const dx = Math.max(rect.x0 - x, 0, x - rect.x1);
        const dz = Math.max(rect.z0 - z, 0, z - rect.z1);
        return lerp(y, campGround, smoothstep(pad, 0, Math.hypot(dx, dz)));
      });
    }
    // The quarry is a pit.
    const quarry = this.sites.quarry;
    this.pit = { x: quarry.x, z: quarry.z, r: 52, depth: 8 };
    this.stamp(quarry.x, quarry.z, this.pit.r + 20, (x, z, y) => y - this.pit.depth * smoothstep(this.pit.r + 18, this.pit.r, Math.hypot(x - quarry.x, z - quarry.z)));
    quarry.floor = quarry.ground - this.pit.depth;

    this.classify();
  }

  // Applies fn(x, z, height) -> height to every vertex within radius of a point.
  stamp(cx, cz, radius, fn) {
    this.stampRect(cx - radius, cx + radius, cz - radius, cz + radius, fn);
  }
  stampRect(x0, x1, z0, z1, fn) {
    const { n, cell, half, h } = this;
    const ix0 = Math.max(0, Math.floor((x0 + half) / cell));
    const ix1 = Math.min(n - 1, Math.ceil((x1 + half) / cell));
    const iz0 = Math.max(0, Math.floor((z0 + half) / cell));
    const iz1 = Math.min(n - 1, Math.ceil((z1 + half) / cell));
    for (let iz = iz0; iz <= iz1; iz++) {
      for (let ix = ix0; ix <= ix1; ix++) {
        const i = iz * n + ix;
        h[i] = fn(ix * cell - half, iz * cell - half, h[i]);
      }
    }
  }

  // Ground type and woodland density for every vertex.
  classify() {
    const { n, cell, half, h } = this;
    for (let iz = 0; iz < n; iz++) {
      const z = iz * cell - half;
      for (let ix = 0; ix < n; ix++) {
        const x = ix * cell - half;
        const i = iz * n + ix;
        const y = h[i];
        const slope = this.slopeAt(x, z);
        const site = this.siteAt(x, z, 6);
        let wood = smoothstep(-0.08, 0.22, fbm(x * 0.0045 + 91, z * 0.0045 + 17, 3, S + 77));
        // The eastern woods around the Sawmill, and the infiltration lane.
        wood = Math.max(wood, 0.9 * smoothstep(260, 120, Math.hypot(x - 470, z - 30)));
        for (const rect of WOODS) if (inRect(rect, x, z)) wood = 1;
        if (site) wood *= smoothstep(site.r - 4, site.r + 22, Math.hypot(x - site.x, z - site.z));
        const inSite = this.siteAt(x, z, 0);
        if (inSite) wood = 0;
        if (this.roadDist[i] < 9) wood *= smoothstep(4, 9, this.roadDist[i]);
        for (const rect of CLEARINGS) if (inRect(rect, x, z, 3)) wood = 0;
        if (y < 2.8 || slope > 33 || y > 150) wood = 0;
        for (const lake of this.lakes) if (Math.hypot(x - lake.x, z - lake.z) < lake.r + 14) wood = 0;
        this.forest[i] = wood;

        let type = GROUND.grass;
        if (y < 0.2) type = GROUND.seabed;
        else if (y < 2.6) type = GROUND.sand;
        else if (y > 178 + fbm(x * 0.02, z * 0.02, 2, S + 3) * 14) type = GROUND.snow;
        else if (slope > 35 || y > 140) type = GROUND.rock;
        else if (this.roadDist[i] < 4.5) type = GROUND.dirt;
        else if (inSite) type = inSite.id === 'hawthorne' || inSite.id === 'anvil' || inSite.id === 'citadel' || inSite.id === 'grayport' || inSite.id === 'depot' ? GROUND.gravel : GROUND.dirt;
        else if (wood > 0.45) type = GROUND.forest;
        else {
          const village = this.near(x, z, ['brightwater', 'stonebridge', 'halden'], 150);
          const field = fbm(x * 0.012 + 5, z * 0.012 + 9, 2, S + 11);
          if (village && field > 0.05 && slope < 9) type = GROUND.farm;
          else if (fbm(x * 0.007 + 31, z * 0.007 + 3, 3, S + 19) > 0.12 && slope < 22) type = GROUND.tallgrass;
        }
        for (const lake of this.lakes) {
          const d = Math.hypot(x - lake.x, z - lake.z);
          if (d < lake.r + 2) type = GROUND.seabed;
          else if (d < lake.r + 9) type = GROUND.sand;
        }
        for (const rect of FLATS) if (inRect(rect, x, z)) type = rect === FLATS[0] ? GROUND.grass : GROUND.dirt;
        this.type[i] = type;
      }
    }
  }

  near(x, z, ids, extra) {
    for (const id of ids) {
      const s = this.sites[id];
      const d = Math.hypot(x - s.x, z - s.z);
      if (d > s.r - 10 && d < s.r + extra) return s;
    }
    return null;
  }

  // The site whose levelled circle (plus margin) contains this point, or null.
  siteAt(x, z, margin = 0) {
    for (const id in this.sites) {
      const s = this.sites[id];
      const dx = x - s.x;
      const dz = z - s.z;
      const r = s.r + margin;
      if (dx * dx + dz * dz < r * r) return s;
    }
    return null;
  }

  // ---------- sampling ----------
  heightAt(x, z) {
    const { n, cell, half, h } = this;
    const gx = clamp((x + half) / cell, 0, n - 1.001);
    const gz = clamp((z + half) / cell, 0, n - 1.001);
    const ix = gx | 0;
    const iz = gz | 0;
    const fx = gx - ix;
    const fz = gz - iz;
    const i = iz * n + ix;
    const a = h[i];
    const b = h[i + 1];
    const c = h[i + n];
    const d = h[i + n + 1];
    return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
  }

  // Steepness in degrees.
  slopeAt(x, z) {
    const e = 2;
    const dx = (this.heightAt(x + e, z) - this.heightAt(x - e, z)) / (2 * e);
    const dz = (this.heightAt(x, z + e) - this.heightAt(x, z - e)) / (2 * e);
    return (Math.atan(Math.hypot(dx, dz)) * 180) / Math.PI;
  }

  // Gradient (rise per metre) along x and z.
  gradAt(x, z, out) {
    const e = 1.2;
    out.x = (this.heightAt(x + e, z) - this.heightAt(x - e, z)) / (2 * e);
    out.z = (this.heightAt(x, z + e) - this.heightAt(x, z - e)) / (2 * e);
    return out;
  }

  nearestIndex(x, z) {
    const { n, cell, half } = this;
    const ix = clamp(Math.round((x + half) / cell), 0, n - 1);
    const iz = clamp(Math.round((z + half) / cell), 0, n - 1);
    return iz * n + ix;
  }
  typeAt(x, z) {
    return this.type[this.nearestIndex(x, z)];
  }
  forestAt(x, z) {
    return this.forest[this.nearestIndex(x, z)];
  }
  roadDistAt(x, z) {
    return this.roadDist[this.nearestIndex(x, z)];
  }

  // Height of the water surface over this point (sea or lake).
  waterAt(x, z) {
    for (const lake of this.lakes) if ((x - lake.x) ** 2 + (z - lake.z) ** 2 < (lake.r + 6) ** 2) return lake.level;
    return SEA_LEVEL;
  }
  depthAt(x, z) {
    return this.waterAt(x, z) - this.heightAt(x, z);
  }
  inBounds(x, z, margin = 0) {
    return Math.abs(x) < this.half - margin && Math.abs(z) < this.half - margin;
  }

  // ---------- what grows ----------
  // Trees, bushes and rocks, placed the same way every time.
  scatter() {
    const rng = mulberry(S + 404);
    const trees = [];
    const bushes = [];
    const rocks = [];
    const half = this.half - 20;
    const blocked = (x, z, pad) => {
      if (this.siteAt(x, z, pad)) return true;
      for (const rect of CLEARINGS) if (inRect(rect, x, z, 2)) return true;
      return false;
    };
    // trees on a jittered 8.5 m grid
    const T = 8.5;
    for (let z = -half; z < half; z += T) {
      for (let x = -half; x < half; x += T) {
        const px = x + rng() * T;
        const pz = z + rng() * T;
        const roll = rng();
        const pick = rng();
        const size = rng();
        const wood = this.forestAt(px, pz);
        if (roll > wood * 0.82 + 0.012) continue;
        const y = this.heightAt(px, pz);
        if (y < 2.9 || y > 150 || this.roadDistAt(px, pz) < 6.5 || blocked(px, pz, 4) || this.slopeAt(px, pz) > 33) continue;
        let lake = false;
        for (const l of this.lakes) if (Math.hypot(px - l.x, pz - l.z) < l.r + 12) lake = true;
        if (lake) continue;
        const pineShare = clamp(0.25 + smoothstep(100, -500, pz) * 0.55 + smoothstep(40, 110, y) * 0.3, 0, 0.95);
        const type = pick < pineShare ? 0 : pick < pineShare + (1 - pineShare) * 0.7 ? 1 : 2;
        trees.push({ x: px, z: pz, y, type, s: 0.75 + size * 0.7, r: 0.32 });
      }
    }
    // bushes: brush at the edges of woodland, and thick in the infiltration lane
    const Bz = 10;
    for (let z = -half; z < half; z += Bz) {
      for (let x = -half; x < half; x += Bz) {
        const px = x + rng() * Bz;
        const pz = z + rng() * Bz;
        const roll = rng();
        const size = rng();
        const wood = this.forestAt(px, pz);
        const y = this.heightAt(px, pz);
        if (roll > 0.07 + wood * 0.22) continue;
        if (y < 3 || y > 140 || this.roadDistAt(px, pz) < 5 || blocked(px, pz, 2) || this.slopeAt(px, pz) > 30) continue;
        bushes.push({ x: px, z: pz, y, r: 1 + size * 0.9 });
      }
    }
    for (const rect of WOODS) {
      for (let z = rect.z0 + 3; z < rect.z1 - 3; z += 5.5) {
        for (let x = rect.x0 + 3; x < rect.x1 - 3; x += 5.5) {
          const px = x + rng() * 5.5;
          const pz = z + rng() * 5.5;
          if (rng() > 0.55) continue;
          bushes.push({ x: px, z: pz, y: this.heightAt(px, pz), r: 1.2 + rng() * 0.9 });
        }
      }
    }
    // rocks: on steep ground and in the range, a few everywhere
    const R = 15;
    for (let z = -half; z < half; z += R) {
      for (let x = -half; x < half; x += R) {
        const px = x + rng() * R;
        const pz = z + rng() * R;
        const roll = rng();
        const size = rng();
        const y = this.heightAt(px, pz);
        if (y < 1.5) continue;
        const slope = this.slopeAt(px, pz);
        const chance = 0.014 + (slope > 20 ? 0.2 : 0) + smoothstep(-450, -700, pz) * 0.12;
        if (roll > chance || this.roadDistAt(px, pz) < 6 || blocked(px, pz, 3)) continue;
        const r = 0.7 + size * size * 2.2;
        rocks.push({ x: px, z: pz, y, r, h: r * (0.8 + rng() * 0.6) });
      }
    }
    return { trees, bushes, rocks };
  }
}
