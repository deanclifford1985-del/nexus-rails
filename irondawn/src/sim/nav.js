// Path finding for soldiers. The island is a grid of one-metre cells marked walkable or not
// (walls, deep water, cliffs); A* runs inside a window around the trip, which is plenty for a
// squad following its leader or a wave walking in through a gate. Longer trips are walked in legs.

const WINDOW = 256;
const SQRT2 = Math.SQRT2;

export class Nav {
  constructor(terrain, colliders) {
    this.terrain = terrain;
    this.size = terrain.size; // one cell per metre
    this.half = terrain.half;
    this.blocked = new Uint8Array(this.size * this.size);
    // scratch for the search window
    const count = WINDOW * WINDOW;
    this.g = new Float32Array(count);
    this.came = new Int32Array(count);
    this.state = new Uint8Array(count); // 0 unseen, 1 open, 2 closed
    this.heap = new Int32Array(count * 4);
    this.heapF = new Float32Array(count * 4);
    this.build(colliders);
  }

  build(colliders) {
    const { terrain, size, half, blocked } = this;
    // ground too steep to walk, or under deep water: judged per 4 m block
    const B = 4;
    for (let bz = 0; bz < size; bz += B) {
      for (let bx = 0; bx < size; bx += B) {
        const x = bx - half + B / 2;
        const z = bz - half + B / 2;
        // nothing steeper than the least practised climber can manage (see B.DERIVE.SLOPE)
        const bad = terrain.slopeAt(x, z) > 35 || terrain.depthAt(x, z) > 1.1;
        if (!bad) continue;
        for (let dz = 0; dz < B; dz++) for (let dx = 0; dx < B; dx++) blocked[(bz + dz) * size + bx + dx] = 1;
      }
    }
    for (const b of colliders.boxes) this.markBox(b);
    for (const c of colliders.circles) {
      const x0 = Math.floor(c.x - c.r + half);
      const x1 = Math.floor(c.x + c.r + half);
      const z0 = Math.floor(c.z - c.r + half);
      const z1 = Math.floor(c.z + c.r + half);
      for (let z = z0; z <= z1; z++) {
        for (let x = x0; x <= x1; x++) {
          if (x < 0 || z < 0 || x >= size || z >= size) continue;
          const dx = x + 0.5 - half - c.x;
          const dz = z + 0.5 - half - c.z;
          if (dx * dx + dz * dz < (c.r + 0.2) * (c.r + 0.2)) blocked[z * size + x] = 1;
        }
      }
    }
  }

  // A box blocks every cell it touches, if it stands in the way at body height.
  markBox(b, value = 1) {
    if (b.kind === 'ladder') return;
    const { terrain, size, half, blocked } = this;
    const ground = terrain.heightAt((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2);
    if (b.y0 > ground + 1.4 || b.y1 < ground + 0.45) return; // overhead, or low enough to step on
    // every cell the box touches: a thin wall or a wire fence must never fall between cell centres
    const pad = 0.05;
    const x0 = Math.floor(b.x0 - pad + half);
    const x1 = Math.floor(b.x1 + pad + half);
    const z0 = Math.floor(b.z0 - pad + half);
    const z1 = Math.floor(b.z1 + pad + half);
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        if (x >= 0 && z >= 0 && x < size && z < size) blocked[z * size + x] = value;
      }
    }
  }

  isBlocked(x, z) {
    const cx = Math.floor(x + this.half);
    const cz = Math.floor(z + this.half);
    if (cx < 0 || cz < 0 || cx >= this.size || cz >= this.size) return true;
    return this.blocked[cz * this.size + cx] === 1;
  }

  // The nearest walkable point to (x, z), searching outward a few metres.
  nearestFree(x, z, reach = 6) {
    if (!this.isBlocked(x, z)) return { x, z };
    for (let r = 1; r <= reach; r++) {
      for (let k = 0; k < 8 * r; k++) {
        const a = (k / (8 * r)) * Math.PI * 2;
        const px = x + Math.cos(a) * r;
        const pz = z + Math.sin(a) * r;
        if (!this.isBlocked(px, pz)) return { x: px, z: pz };
      }
    }
    return null;
  }

  // Can a soldier walk straight from a to b? (Checks every cell the line passes near.)
  walkable(ax, az, bx, bz) {
    const dist = Math.hypot(bx - ax, bz - az);
    const steps = Math.max(1, Math.ceil(dist / 0.5));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      if (this.isBlocked(ax + (bx - ax) * t, az + (bz - az) * t)) return false;
    }
    return true;
  }

  // A* from start to goal. Returns a list of { x, z } waypoints (not including the start), or
  // null when there is no way within the window.
  findPath(sx, sz, gx, gz) {
    const { size, half, blocked, g, came, state } = this;
    const start = this.nearestFree(sx, sz, 9);
    const goal = this.nearestFree(gx, gz, 8);
    this.lastFound = false;
    this.lastExpanded = 0;
    if (!start || !goal) return null;
    this.lastFound = true;
    if (this.walkable(start.x, start.z, goal.x, goal.z)) return [{ x: goal.x, z: goal.z }];

    // window centred between the two, clamped to the world
    const mx = Math.floor((start.x + goal.x) / 2 + half);
    const mz = Math.floor((start.z + goal.z) / 2 + half);
    const wx = Math.max(0, Math.min(size - WINDOW, mx - WINDOW / 2));
    const wz = Math.max(0, Math.min(size - WINDOW, mz - WINDOW / 2));
    const scx = Math.floor(start.x + half) - wx;
    const scz = Math.floor(start.z + half) - wz;
    let gcx = Math.floor(goal.x + half) - wx;
    let gcz = Math.floor(goal.z + half) - wz;
    this.lastFound = false;
    if (scx < 0 || scz < 0 || scx >= WINDOW || scz >= WINDOW) return null;
    // a goal outside the window: aim for the point on the window's edge nearest to it
    gcx = Math.max(1, Math.min(WINDOW - 2, gcx));
    gcz = Math.max(1, Math.min(WINDOW - 2, gcz));

    state.fill(0);
    let heapSize = 0;
    const heap = this.heap;
    const heapF = this.heapF;
    const push = (node, f) => {
      let i = heapSize++;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heapF[p] <= f) break;
        heap[i] = heap[p];
        heapF[i] = heapF[p];
        i = p;
      }
      heap[i] = node;
      heapF[i] = f;
    };
    const pop = () => {
      const top = heap[0];
      heapSize--;
      if (heapSize > 0) {
        const node = heap[heapSize];
        const f = heapF[heapSize];
        let i = 0;
        for (;;) {
          let c = i * 2 + 1;
          if (c >= heapSize) break;
          if (c + 1 < heapSize && heapF[c + 1] < heapF[c]) c++;
          if (heapF[c] >= f) break;
          heap[i] = heap[c];
          heapF[i] = heapF[c];
          i = c;
        }
        heap[i] = node;
        heapF[i] = f;
      }
      return top;
    };
    const hOf = (cx, cz) => {
      const dx = Math.abs(cx - gcx);
      const dz = Math.abs(cz - gcz);
      return dx + dz + (SQRT2 - 2) * Math.min(dx, dz);
    };
    const isFree = (cx, cz) => cx >= 0 && cz >= 0 && cx < WINDOW && cz < WINDOW && blocked[(cz + wz) * size + cx + wx] === 0;

    const startNode = scz * WINDOW + scx;
    const goalNode = gcz * WINDOW + gcx;
    g[startNode] = 0;
    came[startNode] = -1;
    state[startNode] = 1;
    push(startNode, hOf(scx, scz));
    let found = -1;
    let bestNode = startNode;
    let bestH = hOf(scx, scz);
    let expanded = 0;
    while (heapSize > 0 && expanded < 22000 && heapSize < heap.length - 16) {
      const node = pop();
      if (state[node] === 2) continue;
      state[node] = 2;
      expanded++;
      if (node === goalNode) {
        found = node;
        break;
      }
      const cx = node % WINDOW;
      const cz = (node / WINDOW) | 0;
      const h = hOf(cx, cz);
      if (h < bestH) {
        bestH = h;
        bestNode = node;
      }
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dz === 0) continue;
          const nx = cx + dx;
          const nz = cz + dz;
          if (!isFree(nx, nz)) continue;
          // no cutting corners
          if (dx !== 0 && dz !== 0 && (!isFree(cx + dx, cz) || !isFree(cx, cz + dz))) continue;
          const next = nz * WINDOW + nx;
          if (state[next] === 2) continue;
          const cost = g[node] + (dx !== 0 && dz !== 0 ? SQRT2 : 1);
          if (state[next] === 0 || cost < g[next]) {
            g[next] = cost;
            came[next] = node;
            state[next] = 1;
            push(next, cost + hOf(nx, nz) * 1.5);
          }
        }
      }
    }
    // No route all the way: walk to the closest point reached, which is usually the right idea.
    this.lastFound = found >= 0;
    this.lastExpanded = expanded;
    const end = found >= 0 ? found : bestNode;
    if (end === startNode) return null;
    const cells = [];
    for (let node = end; node !== -1; node = came[node]) cells.push(node);
    cells.reverse();
    const points = cells.map((node) => ({ x: (node % WINDOW) + wx + 0.5 - half, z: ((node / WINDOW) | 0) + wz + 0.5 - half }));
    if (found >= 0 && !this.isBlocked(goal.x, goal.z)) points[points.length - 1] = { x: goal.x, z: goal.z };

    // pull the path tight: drop waypoints you can walk straight past
    const out = [];
    let anchor = { x: start.x, z: start.z };
    let i = 1;
    while (i < points.length) {
      let far = i;
      for (let j = Math.min(points.length - 1, i + 40); j > i; j--) {
        if (this.walkable(anchor.x, anchor.z, points[j].x, points[j].z)) {
          far = j;
          break;
        }
      }
      out.push(points[far]);
      anchor = points[far];
      i = far + 1;
    }
    return out.length ? out : null;
  }
}
