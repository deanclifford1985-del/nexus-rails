// Builds low-poly geometry out of coloured boxes, roofs, cylinders, cones and blobs, all merged
// into one BufferGeometry (flat-shaded, vertex-coloured). The whole game is drawn this way.

import * as THREE from 'three';

const tmpColor = new THREE.Color();

export class GeoBuilder {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.col = [];
  }

  tri(ax, ay, az, bx, by, bz, cx, cy, cz, r, g, b) {
    const ux = bx - ax;
    const uy = by - ay;
    const uz = bz - az;
    const vx = cx - ax;
    const vy = cy - ay;
    const vz = cz - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;
    this.pos.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    this.nor.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
    this.col.push(r, g, b, r, g, b, r, g, b);
  }

  quad(a, b, c, d, r, g, bl) {
    this.tri(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], r, g, bl);
    this.tri(a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2], r, g, bl);
  }

  rgb(color) {
    tmpColor.setHex(color);
    return tmpColor;
  }

  // A box centred at (x, y, z). The top is drawn a touch lighter and the underside darker.
  box(x, y, z, sx, sy, sz, color) {
    const c = this.rgb(color);
    const r = c.r;
    const g = c.g;
    const b = c.b;
    const x0 = x - sx / 2;
    const x1 = x + sx / 2;
    const y0 = y - sy / 2;
    const y1 = y + sy / 2;
    const z0 = z - sz / 2;
    const z1 = z + sz / 2;
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], r * 1.08, g * 1.08, b * 1.08); // top
    this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], r * 0.7, g * 0.7, b * 0.7); // bottom
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], r, g, b); // +z
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], r, g, b); // -z
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], r * 0.93, g * 0.93, b * 0.93); // +x
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], r * 0.93, g * 0.93, b * 0.93); // -x
    return this;
  }

  // A gable roof: a sx by sz rectangle at height y, rising sy to a ridge along `axis`.
  roof(x, y, z, sx, sy, sz, color, axis = 'x') {
    const c = this.rgb(color);
    const r = c.r;
    const g = c.g;
    const b = c.b;
    const x0 = x - sx / 2;
    const x1 = x + sx / 2;
    const z0 = z - sz / 2;
    const z1 = z + sz / 2;
    const top = y + sy;
    if (axis === 'x') {
      this.quad([x0, y, z1], [x1, y, z1], [x1, top, z], [x0, top, z], r, g, b);
      this.quad([x1, y, z0], [x0, y, z0], [x0, top, z], [x1, top, z], r * 0.9, g * 0.9, b * 0.9);
      this.tri(x0, y, z0, x0, y, z1, x0, top, z, r * 0.8, g * 0.8, b * 0.8);
      this.tri(x1, y, z1, x1, y, z0, x1, top, z, r * 0.8, g * 0.8, b * 0.8);
    } else {
      this.quad([x1, y, z1], [x1, y, z0], [x, top, z0], [x, top, z1], r, g, b);
      this.quad([x0, y, z0], [x0, y, z1], [x, top, z1], [x, top, z0], r * 0.9, g * 0.9, b * 0.9);
      this.tri(x0, y, z1, x1, y, z1, x, top, z1, r * 0.8, g * 0.8, b * 0.8);
      this.tri(x1, y, z0, x0, y, z0, x, top, z0, r * 0.8, g * 0.8, b * 0.8);
    }
    return this;
  }

  // An upright prism with `seg` sides, centred at (x, y, z); r1 is the top radius (0 = a cone).
  cyl(x, y, z, r0, h, color, seg = 8, r1 = r0, cap = true) {
    const c = this.rgb(color);
    const y0 = y - h / 2;
    const y1 = y + h / 2;
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2;
      const a1 = ((i + 1) / seg) * Math.PI * 2;
      const shade = 0.82 + 0.22 * Math.cos(a0 + 0.6);
      const r = c.r * shade;
      const g = c.g * shade;
      const b = c.b * shade;
      const ax = Math.cos(a0);
      const az = Math.sin(a0);
      const bx = Math.cos(a1);
      const bz = Math.sin(a1);
      if (r1 > 0.001) this.quad([x + ax * r0, y0, z + az * r0], [x + ax * r1, y1, z + az * r1], [x + bx * r1, y1, z + bz * r1], [x + bx * r0, y0, z + bz * r0], r, g, b);
      else this.tri(x + ax * r0, y0, z + az * r0, x, y1, z, x + bx * r0, y0, z + bz * r0, r, g, b);
      if (cap && r1 > 0.001) this.tri(x, y1, z, x + bx * r1, y1, z + bz * r1, x + ax * r1, y1, z + az * r1, c.r * 1.08, c.g * 1.08, c.b * 1.08);
    }
    return this;
  }

  // A rough ball (an icosahedron, squashed by sy), for foliage and boulders.
  blob(x, y, z, r, color, sy = 1, jitter = 0.18, seed = 1) {
    const c = this.rgb(color);
    const geo = GeoBuilder.ico;
    const p = geo.attributes.position.array;
    let s = seed * 9301 + 49297;
    const rnd = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
    // jitter per unique vertex, so faces stay joined
    const offsets = new Map();
    const at = (i) => {
      const key = `${p[i].toFixed(3)},${p[i + 1].toFixed(3)},${p[i + 2].toFixed(3)}`;
      let k = offsets.get(key);
      if (k === undefined) offsets.set(key, (k = 1 + (rnd() - 0.5) * 2 * jitter));
      return k;
    };
    for (let i = 0; i < p.length; i += 9) {
      const ka = at(i);
      const kb = at(i + 3);
      const kc = at(i + 6);
      const shade = 0.8 + 0.3 * rnd();
      this.tri(
        x + p[i] * r * ka, y + p[i + 1] * r * sy * ka, z + p[i + 2] * r * ka,
        x + p[i + 3] * r * kb, y + p[i + 4] * r * sy * kb, z + p[i + 5] * r * kb,
        x + p[i + 6] * r * kc, y + p[i + 7] * r * sy * kc, z + p[i + 8] * r * kc,
        c.r * shade, c.g * shade, c.b * shade,
      );
    }
    return this;
  }

  build() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.pos), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(this.nor), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.col), 3));
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    return geo;
  }
}

GeoBuilder.ico = new THREE.IcosahedronGeometry(1, 0).toNonIndexed();

// A soft round dot, for sprites and particles.
export function dotTexture(size = 64, soft = 0.5) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(soft, 'rgba(255,255,255,0.7)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

// Fine grain multiplied over the ground so it does not look like flat paint up close.
export function grainTexture(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  let s = 12345;
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  for (let i = 0; i < size * size; i++) {
    const v = 205 + rnd() * 50;
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  // a few darker blotches so it tiles less obviously
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(0,0,0,${0.03 + rnd() * 0.05})`;
    ctx.beginPath();
    ctx.arc(rnd() * size, rnd() * size, 6 + rnd() * 22, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}
