// Everything solid that is not the ground: boxes (walls, crates, roofs) and upright cylinders
// (trees, rocks), in a spatial grid. Movement, bullets and sight lines all ask here.
//
// Box kinds:   solid  blocks movement, bullets and sight
//              fence  blocks movement only (wire: you can see and shoot through it)
//              ladder blocks nothing; standing in it lets you climb to its top
// A box whose top is within a step of your feet does not block you: you walk up onto it.

const CELL = 8;
const OFFSET = 512;
const STEP = 0.45;

export class Colliders {
  constructor(terrain) {
    this.terrain = terrain;
    this.boxes = [];
    this.circles = [];
    this.grid = new Map();
    this.query = 0;
    this.smokes = []; // { x, y, z, r } clouds that block sight
  }

  cellKey(cx, cz) {
    return (cx + OFFSET) * 2048 + (cz + OFFSET);
  }

  bucket(cx, cz, make) {
    const key = this.cellKey(cx, cz);
    let b = this.grid.get(key);
    if (!b && make) {
      b = { boxes: [], circles: [] };
      this.grid.set(key, b);
    }
    return b;
  }

  addBox(box) {
    box.kind ??= 'solid';
    box.q = 0;
    this.boxes.push(box);
    const cx0 = Math.floor(box.x0 / CELL);
    const cx1 = Math.floor(box.x1 / CELL);
    const cz0 = Math.floor(box.z0 / CELL);
    const cz1 = Math.floor(box.z1 / CELL);
    for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) this.bucket(cx, cz, true).boxes.push(box);
    return box;
  }

  addCircle(circle) {
    circle.q = 0;
    this.circles.push(circle);
    const cx0 = Math.floor((circle.x - circle.r) / CELL);
    const cx1 = Math.floor((circle.x + circle.r) / CELL);
    const cz0 = Math.floor((circle.z - circle.r) / CELL);
    const cz1 = Math.floor((circle.z + circle.r) / CELL);
    for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) this.bucket(cx, cz, true).circles.push(circle);
    return circle;
  }

  removeBox(box) {
    const i = this.boxes.indexOf(box);
    if (i >= 0) this.boxes.splice(i, 1);
    for (const bucket of this.grid.values()) {
      const j = bucket.boxes.indexOf(box);
      if (j >= 0) bucket.boxes.splice(j, 1);
    }
  }

  // ---------- movement ----------
  // Pushes a standing cylinder (radius rad, from feet to head) out of whatever it overlaps.
  // pos is { x, z } and is changed in place. Returns true if anything was touched.
  resolve(pos, rad, feet, head) {
    let touched = false;
    const cx0 = Math.floor((pos.x - rad) / CELL);
    const cx1 = Math.floor((pos.x + rad) / CELL);
    const cz0 = Math.floor((pos.z - rad) / CELL);
    const cz1 = Math.floor((pos.z + rad) / CELL);
    for (let cz = cz0; cz <= cz1; cz++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const bucket = this.grid.get(this.cellKey(cx, cz));
        if (!bucket) continue;
        for (const b of bucket.boxes) {
          if (b.kind === 'ladder') continue;
          if (feet >= b.y1 - STEP || head <= b.y0) continue;
          const nx = pos.x < b.x0 ? b.x0 : pos.x > b.x1 ? b.x1 : pos.x;
          const nz = pos.z < b.z0 ? b.z0 : pos.z > b.z1 ? b.z1 : pos.z;
          const dx = pos.x - nx;
          const dz = pos.z - nz;
          const d2 = dx * dx + dz * dz;
          if (d2 >= rad * rad) continue;
          touched = true;
          if (d2 > 1e-8) {
            const d = Math.sqrt(d2);
            pos.x = nx + (dx / d) * rad;
            pos.z = nz + (dz / d) * rad;
          } else {
            // centre is inside the box: leave by the nearest face
            const left = pos.x - b.x0;
            const right = b.x1 - pos.x;
            const near = pos.z - b.z0;
            const far = b.z1 - pos.z;
            const m = Math.min(left, right, near, far);
            if (m === left) pos.x = b.x0 - rad;
            else if (m === right) pos.x = b.x1 + rad;
            else if (m === near) pos.z = b.z0 - rad;
            else pos.z = b.z1 + rad;
          }
        }
        for (const c of bucket.circles) {
          if (feet >= c.y1 - STEP || head <= c.y0) continue;
          const dx = pos.x - c.x;
          const dz = pos.z - c.z;
          const min = rad + c.r;
          const d2 = dx * dx + dz * dz;
          if (d2 >= min * min) continue;
          touched = true;
          const d = Math.sqrt(d2) || 0.001;
          pos.x = c.x + (dx / d) * min;
          pos.z = c.z + (dz / d) * min;
        }
      }
    }
    return touched;
  }

  // The surface to stand on at a point: the ground, or the top of a box you are over and could
  // step onto from where your feet are.
  floorAt(x, z, feet) {
    let floor = this.terrain.heightAt(x, z);
    const bucket = this.grid.get(this.cellKey(Math.floor(x / CELL), Math.floor(z / CELL)));
    if (bucket) {
      for (const b of bucket.boxes) {
        if (b.kind !== 'solid' || b.nowalk) continue;
        if (x < b.x0 - 0.05 || x > b.x1 + 0.05 || z < b.z0 - 0.05 || z > b.z1 + 0.05) continue;
        if (b.y1 <= feet + STEP && b.y1 > floor) floor = b.y1;
      }
    }
    return floor;
  }

  // Something to pull yourself onto, straight ahead: { top, x, z } or null.
  findLedge(x, z, dirX, dirZ, feet, reach) {
    let best = null;
    for (const dist of [0.55, 0.9]) {
      const px = x + dirX * dist;
      const pz = z + dirZ * dist;
      const bucket = this.grid.get(this.cellKey(Math.floor(px / CELL), Math.floor(pz / CELL)));
      if (!bucket) continue;
      let top = -Infinity;
      for (const b of bucket.boxes) {
        if (b.kind === 'ladder' || b.nowalk) continue;
        if (px < b.x0 || px > b.x1 || pz < b.z0 || pz > b.z1) continue;
        if (b.y0 > feet + 1.7) continue; // overhead, not in the way
        if (b.y1 > top) top = b.y1;
      }
      if (top === -Infinity) continue;
      const rise = top - feet;
      if (rise <= STEP || rise > reach) continue;
      // room to stand up there?
      let clear = true;
      for (const b of bucket.boxes) {
        if (b.kind === 'ladder') continue;
        if (px < b.x0 || px > b.x1 || pz < b.z0 || pz > b.z1) continue;
        if (b.y0 >= top - 0.01 && b.y0 < top + 1.5) clear = false;
      }
      if (clear && (!best || top < best.top)) best = { top, x: px, z: pz };
    }
    return best;
  }

  // A ladder you are standing at: its box, or null.
  ladderAt(x, z, feet) {
    const bucket = this.grid.get(this.cellKey(Math.floor(x / CELL), Math.floor(z / CELL)));
    if (!bucket) return null;
    for (const b of bucket.boxes) {
      if (b.kind !== 'ladder') continue;
      if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && feet < b.y1 - 0.5 && feet > b.y0 - 1) return b;
    }
    return null;
  }

  // ---------- rays ----------
  // Casts a ray; returns the distance to the first thing hit (or Infinity) and fills `out`
  // ({ kind, box }) when given. Fences never stop a ray.
  raycast(ox, oy, oz, dx, dy, dz, maxDist, out = null) {
    let best = this.rayTerrain(ox, oy, oz, dx, dy, dz, maxDist);
    let kind = best < Infinity ? 'ground' : null;
    let hitBox = null;
    const stamp = ++this.query;
    const limit = Math.min(maxDist, best);

    // walk the grid cells the ray crosses (2D DDA)
    let cx = Math.floor(ox / CELL);
    let cz = Math.floor(oz / CELL);
    const stepX = dx > 0 ? 1 : -1;
    const stepZ = dz > 0 ? 1 : -1;
    const invX = Math.abs(dx) > 1e-9 ? 1 / dx : Infinity;
    const invZ = Math.abs(dz) > 1e-9 ? 1 / dz : Infinity;
    let tMaxX = invX === Infinity ? Infinity : ((dx > 0 ? (cx + 1) * CELL : cx * CELL) - ox) * invX;
    let tMaxZ = invZ === Infinity ? Infinity : ((dz > 0 ? (cz + 1) * CELL : cz * CELL) - oz) * invZ;
    const tDeltaX = invX === Infinity ? Infinity : Math.abs(CELL * invX);
    const tDeltaZ = invZ === Infinity ? Infinity : Math.abs(CELL * invZ);
    let tEnter = 0;
    for (let guard = 0; guard < 400; guard++) {
      const bucket = this.grid.get(this.cellKey(cx, cz));
      if (bucket) {
        for (const b of bucket.boxes) {
          if (b.q === stamp) continue;
          b.q = stamp;
          if (b.kind !== 'solid') continue;
          const t = rayBox(ox, oy, oz, dx, dy, dz, b);
          if (t >= 0 && t < best && t <= limit) {
            best = t;
            kind = 'box';
            hitBox = b;
          }
        }
        for (const c of bucket.circles) {
          if (c.q === stamp) continue;
          c.q = stamp;
          const t = rayCylinder(ox, oy, oz, dx, dy, dz, c);
          if (t >= 0 && t < best && t <= limit) {
            best = t;
            kind = c.kind ?? 'tree';
            hitBox = null;
          }
        }
      }
      const tExit = Math.min(tMaxX, tMaxZ);
      if (tExit > Math.min(best, maxDist)) break;
      if (tMaxX < tMaxZ) {
        cx += stepX;
        tEnter = tMaxX;
        tMaxX += tDeltaX;
      } else {
        cz += stepZ;
        tEnter = tMaxZ;
        tMaxZ += tDeltaZ;
      }
      if (tEnter > maxDist) break;
    }
    if (out) {
      out.kind = kind;
      out.box = hitBox;
    }
    return best <= maxDist ? best : Infinity;
  }

  // Distance along the ray at which it meets the ground, or Infinity.
  rayTerrain(ox, oy, oz, dx, dy, dz, maxDist) {
    const terrain = this.terrain;
    const step = 2.5;
    let prev = 0;
    if (oy < terrain.heightAt(ox, oz)) return 0;
    for (let t = step; t < maxDist + step; t += step) {
      const tt = Math.min(t, maxDist);
      const y = oy + dy * tt;
      const ground = terrain.heightAt(ox + dx * tt, oz + dz * tt);
      if (y < ground) {
        // bisect between prev and tt
        let lo = prev;
        let hi = tt;
        for (let i = 0; i < 7; i++) {
          const mid = (lo + hi) / 2;
          if (oy + dy * mid < terrain.heightAt(ox + dx * mid, oz + dz * mid)) hi = mid;
          else lo = mid;
        }
        return hi;
      }
      // a ray climbing away from the highest ground cannot come back down to it
      if (dy > 0 && y > 260) return Infinity;
      prev = tt;
      if (tt >= maxDist) break;
    }
    return Infinity;
  }

  // Is there a clear line between two points? Smoke blocks it; fences and brush do not.
  los(ax, ay, az, bx, by, bz) {
    const dx = bx - ax;
    const dy = by - ay;
    const dz = bz - az;
    const dist = Math.hypot(dx, dy, dz);
    if (dist < 0.01) return true;
    const ix = dx / dist;
    const iy = dy / dist;
    const iz = dz / dist;
    for (const s of this.smokes) {
      // closest approach of the segment to the cloud's centre
      const t = Math.max(0, Math.min(dist, (s.x - ax) * ix + (s.y - ay) * iy + (s.z - az) * iz));
      const px = ax + ix * t - s.x;
      const py = ay + iy * t - s.y;
      const pz = az + iz * t - s.z;
      if (px * px + py * py + pz * pz < s.r * s.r) return false;
    }
    return this.raycast(ax, ay, az, ix, iy, iz, dist - 0.05) === Infinity;
  }
}

// Ray against an axis-aligned box: entry distance, or -1.
function rayBox(ox, oy, oz, dx, dy, dz, b) {
  let tmin = 0;
  let tmax = Infinity;
  if (Math.abs(dx) < 1e-9) {
    if (ox < b.x0 || ox > b.x1) return -1;
  } else {
    let t1 = (b.x0 - ox) / dx;
    let t2 = (b.x1 - ox) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return -1;
  }
  if (Math.abs(dy) < 1e-9) {
    if (oy < b.y0 || oy > b.y1) return -1;
  } else {
    let t1 = (b.y0 - oy) / dy;
    let t2 = (b.y1 - oy) / dy;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return -1;
  }
  if (Math.abs(dz) < 1e-9) {
    if (oz < b.z0 || oz > b.z1) return -1;
  } else {
    let t1 = (b.z0 - oz) / dz;
    let t2 = (b.z1 - oz) / dz;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return -1;
  }
  return tmin;
}

// Ray against an upright cylinder { x, z, r, y0, y1 }: entry distance, or -1.
export function rayCylinder(ox, oy, oz, dx, dy, dz, c) {
  const fx = ox - c.x;
  const fz = oz - c.z;
  const a = dx * dx + dz * dz;
  if (a < 1e-9) return -1;
  const b = 2 * (fx * dx + fz * dz);
  const cc = fx * fx + fz * fz - c.r * c.r;
  const disc = b * b - 4 * a * cc;
  if (disc < 0) return -1;
  const root = Math.sqrt(disc);
  let t = (-b - root) / (2 * a);
  if (t < 0) {
    // started inside the circle
    if (cc > 0) return -1;
    t = 0;
  }
  const y = oy + dy * t;
  if (y < c.y0 || y > c.y1) {
    // might enter through the top or bottom cap while inside the circle's footprint
    if (Math.abs(dy) < 1e-9) return -1;
    const cap = dy < 0 ? c.y1 : c.y0;
    const tc = (cap - oy) / dy;
    if (tc < 0) return -1;
    const px = fx + dx * tc;
    const pz = fz + dz * tc;
    if (px * px + pz * pz > c.r * c.r) return -1;
    return tc;
  }
  return t;
}

// Ray against a sphere: entry distance, or -1.
export function raySphere(ox, oy, oz, dx, dy, dz, sx, sy, sz, r) {
  const fx = ox - sx;
  const fy = oy - sy;
  const fz = oz - sz;
  const b = fx * dx + fy * dy + fz * dz;
  const c = fx * fx + fy * fy + fz * fz - r * r;
  const disc = b * b - c;
  if (disc < 0) return -1;
  const t = -b - Math.sqrt(disc);
  return t >= 0 ? t : c <= 0 ? 0 : -1;
}
