import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// The Iron Phoenix, the flagship engine, built in code: an ornate black-iron locomotive with a
// phoenix head and crest over the smokebox, a beaked prow with ember eyes, molten veins in the
// iron, wings and flank streamers of fire, red driving wheels with working rods, a steam plume
// and drifting sparks. It sits on a turntable and turns a full circle to show itself off.
// The train faces +X; rail top is y = 0.

// ---------- small helpers ----------

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTexture(w, h, draw, { color = false, repeat = [1, 1] } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 8;
  if (color) t.encoding = THREE.sRGBEncoding;
  return t;
}

// Raised scrollwork for the iron (used as bump and roughness).
function drawFiligree(ctx, w, h) {
  const rng = seeded(1789);
  ctx.fillStyle = '#5a5a5a';
  ctx.fillRect(0, 0, w, h);
  ctx.lineCap = 'round';
  const scroll = (x, y, size, dir, rot) => {
    ctx.beginPath();
    for (let i = 0; i <= 60; i++) {
      const t = (i / 60) * Math.PI * 3.2;
      const r = size * (1 - i / 66);
      const a = rot + dir * t;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  };
  for (let pass = 0; pass < 2; pass++) {
    ctx.strokeStyle = pass ? '#d8d8d8' : '#2a2a2a';
    ctx.lineWidth = pass ? 2.2 : 5;
    const r2 = seeded(42);
    for (let gy = 0; gy < 8; gy++) {
      for (let gx = 0; gx < 8; gx++) {
        const x = (gx + 0.5) * (w / 8) + (r2() - 0.5) * 18;
        const y = (gy + 0.5) * (h / 8) + (r2() - 0.5) * 18;
        const size = 14 + r2() * 16;
        scroll(x, y, size, (gx + gy) % 2 ? 1 : -1, r2() * Math.PI * 2);
        // a leaf flick off each scroll
        ctx.beginPath();
        ctx.moveTo(x + size, y);
        ctx.quadraticCurveTo(x + size * 1.6, y - size * 0.6, x + size * 2.1, y + size * 0.2);
        ctx.stroke();
      }
    }
  }
  // fine hammered grain
  for (let i = 0; i < 4000; i++) {
    const v = 70 + rng() * 80;
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(rng() * w, rng() * h, 1.5, 1.5);
  }
}

// Molten cracks for the emissive map.
function drawVeins(ctx, w, h) {
  const rng = seeded(911);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.lineCap = 'round';
  const crack = (x, y, a, len, width, depth) => {
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let i = 0; i < len; i++) {
      a += (rng() - 0.5) * 0.7;
      x += Math.cos(a) * 6;
      y += Math.sin(a) * 6;
      ctx.lineTo(x, y);
      if (depth < 2 && rng() < 0.08) {
        ctx.stroke();
        crack(x, y, a + (rng() < 0.5 ? 0.9 : -0.9), Math.floor(len * 0.45), width * 0.6, depth + 1);
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(x, y);
      }
    }
    ctx.stroke();
  };
  ctx.shadowColor = '#ff5a1a';
  ctx.shadowBlur = 10;
  ctx.strokeStyle = '#ff7a2a';
  for (let i = 0; i < 9; i++) crack(rng() * w, rng() * h, rng() * Math.PI * 2, 30 + rng() * 30, 2.6, 0);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#ffd27a';
  ctx.globalAlpha = 0.6;
  const r2 = seeded(911);
  for (let i = 0; i < 9; i++) crack(r2() * w, r2() * h, r2() * Math.PI * 2, 30 + r2() * 30, 0.9, 1);
  ctx.globalAlpha = 1;
}

// One feather: dark red at the quill, orange body, a hot gold edge and tip.
function drawFeather(ctx, w, h) {
  const mid = h / 2;
  const leaf = new Path2D();
  leaf.moveTo(0, mid - 5);
  leaf.bezierCurveTo(w * 0.3, 2, w * 0.78, 2, w, mid);
  leaf.bezierCurveTo(w * 0.78, h - 2, w * 0.3, h - 2, 0, mid + 5);
  leaf.closePath();
  ctx.save();
  ctx.clip(leaf);
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, '#2a0402');
  g.addColorStop(0.3, '#8a1406');
  g.addColorStop(0.62, '#d8380c');
  g.addColorStop(0.9, '#ff7a1e');
  g.addColorStop(1, '#ffb04a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // barbs
  ctx.strokeStyle = 'rgba(255, 150, 70, 0.28)';
  ctx.lineWidth = 1;
  for (let x = 8; x < w; x += 7) {
    ctx.beginPath();
    ctx.moveTo(x, mid);
    ctx.lineTo(x + 16, 0);
    ctx.moveTo(x, mid);
    ctx.lineTo(x + 16, h);
    ctx.stroke();
  }
  // darker inner vane so the edge reads hot
  const v = ctx.createLinearGradient(0, 0, 0, h);
  v.addColorStop(0, 'rgba(255,150,50,0.5)');
  v.addColorStop(0.25, 'rgba(0,0,0,0)');
  v.addColorStop(0.75, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(255,150,50,0.5)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  // quill
  ctx.strokeStyle = '#ffb35a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, mid);
  ctx.quadraticCurveTo(w * 0.5, mid - 1, w * 0.94, mid);
  ctx.stroke();
}

function drawGlow(ctx, w, h) {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function drawPuff(ctx, w, h) {
  const rng = seeded(5);
  for (let i = 0; i < 9; i++) {
    const x = w * (0.3 + rng() * 0.4);
    const y = h * (0.3 + rng() * 0.4);
    const r = w * (0.18 + rng() * 0.16);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
}

function drawFloor(ctx, w, h) {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(60,24,12,1)');
  g.addColorStop(0.45, 'rgba(22,12,10,1)');
  g.addColorStop(1, 'rgba(6,6,9,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255,120,40,0.08)';
  for (let r = 40; r < w / 2; r += 40) {
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// ---------- the model ----------

function buildPhoenix(tex) {
  const train = new THREE.Group();
  const parts = { drivers: [], bogies: [], rods: [], wings: [], glows: [], eyes: [] };

  const iron = new THREE.MeshStandardMaterial({
    color: 0x0f0c0b,
    metalness: 0.65,
    roughness: 0.55,
    bumpMap: tex.filigree,
    bumpScale: 0.035,
    roughnessMap: tex.filigree,
    emissive: 0xff5a1a,
    emissiveMap: tex.veins,
    emissiveIntensity: 1.6,
    envMapIntensity: 0.45,
  });
  const ironPlain = new THREE.MeshStandardMaterial({ color: 0x0b0909, metalness: 0.75, roughness: 0.5, envMapIntensity: 0.4 });
  const ironBright = new THREE.MeshStandardMaterial({ color: 0x1d1714, metalness: 0.9, roughness: 0.34, bumpMap: tex.filigree, bumpScale: 0.02, envMapIntensity: 0.6 });
  const red = new THREE.MeshStandardMaterial({ color: 0x7e140a, metalness: 0.5, roughness: 0.42, emissive: 0x5a0a04, emissiveIntensity: 0.5, envMapIntensity: 0.45 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x8f8a86, metalness: 1, roughness: 0.25 });
  const ember = new THREE.MeshBasicMaterial({ color: 0xff8a2a });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffb347, toneMapped: false });
  const feather = new THREE.MeshStandardMaterial({
    map: tex.feather,
    emissive: 0xffffff,
    emissiveMap: tex.feather,
    emissiveIntensity: 0.6,
    roughness: 0.75,
    metalness: 0,
    side: THREE.DoubleSide,
    alphaTest: 0.35,
    transparent: false,
  });

  const add = (geo, mat, x, y, z, parent = train) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  // --- frame, valance and ember trim ---
  add(new RoundedBoxGeometry(7.4, 0.32, 1.9, 4, 0.06), ironPlain, -1.1, 1.1, 0);
  for (const side of [-1, 1]) {
    add(new RoundedBoxGeometry(7.4, 0.26, 0.14, 4, 0.05), iron, -1.1, 1.42, side * 1.26);
    add(new THREE.BoxGeometry(7.3, 0.035, 0.03), ember, -1.1, 1.29, side * 1.335);
  }
  add(new RoundedBoxGeometry(7.4, 0.08, 2.6, 3, 0.03), iron, -1.1, 1.56, 0);

  // --- boiler with ribbed bands ---
  const boiler = add(new THREE.CylinderGeometry(1.0, 1.0, 5.8, 96, 1, false), iron, -0.3, 2.35, 0);
  boiler.rotation.z = Math.PI / 2;
  for (const x of [-2.6, -1.4, -0.2, 1.0, 2.0]) {
    const band = add(new THREE.TorusGeometry(1.01, 0.045, 12, 96), ironBright, x, 2.35, 0);
    band.rotation.y = Math.PI / 2;
  }
  // rivet rows along the boiler
  const rivetGeo = new THREE.SphereGeometry(0.028, 8, 6);
  const rivets = new THREE.InstancedMesh(rivetGeo, ironBright, 2 * 5 * 18);
  let ri = 0;
  const dummy = new THREE.Object3D();
  for (const bandX of [-2.6, -1.4, -0.2, 1.0, 2.0]) {
    for (const off of [-0.09, 0.09]) {
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        dummy.position.set(bandX + off, 2.35 + Math.cos(a) * 1.01, Math.sin(a) * 1.01);
        dummy.updateMatrix();
        rivets.setMatrixAt(ri++, dummy.matrix);
      }
    }
  }
  train.add(rivets);

  // --- the prow: a beaked, tapering armoured face ---
  const prowShape = new THREE.Shape();
  prowShape.moveTo(2.0, 0.22);
  prowShape.lineTo(4.7, 0.16);
  prowShape.quadraticCurveTo(5.35, 0.18, 5.25, 0.55);
  prowShape.quadraticCurveTo(4.6, 1.5, 4.05, 2.2);
  prowShape.quadraticCurveTo(3.35, 3.05, 2.4, 3.3);
  prowShape.lineTo(2.0, 3.32);
  prowShape.lineTo(2.0, 0.22);
  const prowGeo = new THREE.ExtrudeGeometry(prowShape, { depth: 2.4, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 6, curveSegments: 32, steps: 1 });
  prowGeo.translate(0, 0, -1.2);
  const pp = prowGeo.attributes.position;
  for (let i = 0; i < pp.count; i++) {
    const x = pp.getX(i);
    const k = THREE.MathUtils.clamp((x - 2.0) / 3.3, 0, 1);
    // narrow towards the beak, and round the shoulders a touch
    const hy = THREE.MathUtils.clamp(pp.getY(i) / 3.3, 0, 1);
    pp.setZ(i, pp.getZ(i) * (1 - 0.74 * Math.pow(k, 1.1)) * (1 - 0.42 * hy * hy));
  }
  prowGeo.computeVertexNormals();
  const prow = add(prowGeo, iron, 0, 0, 0);
  prow.material = iron;
  // armoured cheek ridges sweeping back from the face, laid on the prow's surface
  const prowHalf = (x, y) => {
    const k = THREE.MathUtils.clamp((x - 2.0) / 3.3, 0, 1);
    const hy = THREE.MathUtils.clamp(y / 3.3, 0, 1);
    return 1.3 * (1 - 0.74 * Math.pow(k, 1.1)) * (1 - 0.42 * hy * hy);
  };
  for (const side of [-1, 1]) {
    for (let j = 0; j < 4; j++) {
      const pts = [];
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        const x = 4.55 - j * 0.12 - t * (2.2 - j * 0.1);
        const y = 1.05 + j * 0.38 + t * (0.25 + j * 0.12) - Math.sin(t * Math.PI) * 0.12;
        pts.push(new THREE.Vector3(x, y, side * (prowHalf(x, y) + 0.015)));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      add(new THREE.TubeGeometry(curve, 48, 0.045 - j * 0.006, 8, false), ironBright, 0, 0, 0);
      const glowPts = pts.map((p) => new THREE.Vector3(p.x, p.y - 0.09, p.z + side * 0.012));
      add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(glowPts), 48, 0.014, 6, false), ember, 0, 0, 0);
    }
  }

  // fluted ribs down the face
  for (let i = -2; i <= 2; i++) {
    const rib = add(new THREE.CylinderGeometry(0.035, 0.05, 1.9, 10), ironBright, 4.55 - Math.abs(i) * 0.05, 1.05, i * 0.17);
    rib.rotation.z = 0.62;
  }

  // the face's ember eyes and brows
  for (const side of [-1, 1]) {
    const eye = add(new THREE.SphereGeometry(0.3, 32, 16), eyeMat, 4.36, 1.55, side * 0.56);
    eye.scale.set(1.55, 0.6, 0.5);
    eye.rotation.set(side * 0.45, -side * 0.55, 0.75);
    parts.eyes.push(eye);
    const brow = add(new THREE.CylinderGeometry(0.035, 0.06, 0.9, 12), ironBright, 4.25, 1.8, side * 0.5);
    brow.rotation.set(side * 0.4, 0, 2.2);
    parts.glows.push({ at: new THREE.Vector3(4.5, 1.52, side * 0.48), size: 1.6, color: 0xff9a3a });
    // molten streaks running from the eyes down the face
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(4.55, 1.35, side * 0.4),
      new THREE.Vector3(4.75, 1.0, side * 0.33),
      new THREE.Vector3(4.95, 0.65, side * 0.26),
      new THREE.Vector3(5.1, 0.35, side * 0.2),
    ]);
    add(new THREE.TubeGeometry(curve, 24, 0.022, 6, false), ember, 0, 0, 0);
    const curve2 = new THREE.CatmullRomCurve3([
      new THREE.Vector3(3.9, 1.85, side * 0.66),
      new THREE.Vector3(3.3, 1.5, side * 0.92),
      new THREE.Vector3(2.7, 1.0, side * 1.13),
    ]);
    add(new THREE.TubeGeometry(curve2, 20, 0.02, 6, false), ember, 0, 0, 0);
  }

  // --- the phoenix head on its neck ---
  const neckPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(2.5, 3.0, 0),
    new THREE.Vector3(2.85, 3.75, 0),
    new THREE.Vector3(3.15, 4.4, 0),
    new THREE.Vector3(3.45, 4.85, 0),
  ]);
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    const p = neckPath.getPoint(t);
    const r = 0.62 - t * 0.28;
    const seg = add(new THREE.SphereGeometry(r, 40, 24), iron, p.x, p.y, 0);
    seg.scale.set(1, 1, 0.82);
  }
  // feather-scale collar
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const s = add(new THREE.ConeGeometry(0.12, 0.5, 12), ironBright, 2.6 + Math.cos(a) * 0.1, 3.2 + Math.sin(a) * 0.08, Math.sin(a) * 0.5);
    s.rotation.set(Math.sin(a) * 0.6, 0, 1.9);
  }
  const head = add(new THREE.SphereGeometry(0.62, 48, 32), iron, 3.66, 5.02, 0);
  head.scale.set(1.25, 0.86, 0.8);
  // upper beak with a hooked tip, and the lower jaw
  const beak = add(new THREE.ConeGeometry(0.26, 1.05, 32), ironBright, 4.42, 4.82, 0);
  beak.rotation.z = -Math.PI / 2 - 0.55;
  beak.scale.set(1, 1, 0.8);
  const hook = add(new THREE.ConeGeometry(0.09, 0.36, 16), ironBright, 4.83, 4.5, 0);
  hook.rotation.z = Math.PI + 0.4;
  const jaw = add(new THREE.ConeGeometry(0.15, 0.62, 24), iron, 4.2, 4.62, 0);
  jaw.rotation.z = -Math.PI / 2 - 0.2;
  for (const side of [-1, 1]) {
    const e = add(new THREE.SphereGeometry(0.09, 20, 12), eyeMat, 4.06, 5.1, side * 0.37);
    e.scale.set(1.6, 0.8, 0.6);
    e.rotation.z = 0.35;
    parts.eyes.push(e);
    parts.glows.push({ at: new THREE.Vector3(4.1, 5.1, side * 0.4), size: 0.7, color: 0xffb04a });
    const brow = add(new THREE.ConeGeometry(0.07, 0.55, 10), ironBright, 4.02, 5.25, side * 0.36);
    brow.rotation.set(0, 0, -1.25);
  }
  // crest
  const crest = [
    [3.45, 5.35, 0, 0.55, 1.15],
    [3.3, 5.3, 0.13, 0.75, 1.0],
    [3.3, 5.3, -0.13, 0.75, 1.0],
    [3.15, 5.2, 0.2, 1.0, 0.85],
    [3.15, 5.2, -0.2, 1.0, 0.85],
    [3.6, 5.38, 0, 0.25, 0.75],
  ];
  for (const [x, y, z, tilt, h] of crest) {
    const spike = add(new THREE.ConeGeometry(0.075, h, 16), iron, x, y + h * 0.35, z);
    spike.rotation.set(z * 1.6, 0, tilt);
    spike.geometry.translate(0, 0, 0);
  }

  // --- smokestack behind the head, domes, whistle ---
  const stackProfile = [
    new THREE.Vector2(0.0, 0),
    new THREE.Vector2(0.34, 0),
    new THREE.Vector2(0.3, 0.12),
    new THREE.Vector2(0.24, 0.5),
    new THREE.Vector2(0.27, 0.85),
    new THREE.Vector2(0.38, 1.05),
    new THREE.Vector2(0.4, 1.12),
    new THREE.Vector2(0.3, 1.12),
    new THREE.Vector2(0.28, 1.0),
    new THREE.Vector2(0.0, 1.0),
  ];
  add(new THREE.LatheGeometry(stackProfile, 64), ironBright, 1.55, 3.2, 0);
  const coal = add(new THREE.CircleGeometry(0.28, 32), ember, 1.55, 4.24, 0);
  coal.rotation.x = -Math.PI / 2;
  parts.glows.push({ at: new THREE.Vector3(1.55, 4.3, 0), size: 0.9, color: 0xff7a2a });
  parts.stackTop = new THREE.Vector3(1.55, 4.35, 0);
  const domeProfile = [];
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * (Math.PI / 2);
    domeProfile.push(new THREE.Vector2(Math.cos(a) * 0.42, Math.sin(a) * 0.5));
  }
  add(new THREE.LatheGeometry(domeProfile, 64), iron, 0.2, 3.25, 0);
  add(new THREE.LatheGeometry(domeProfile, 64), iron, -1.5, 3.25, 0).scale.set(0.8, 0.8, 0.8);
  add(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 16), steel, -2.4, 3.5, 0);

  // --- cab with glowing firelight and a sweeping roof ---
  add(new RoundedBoxGeometry(1.9, 2.3, 2.4, 6, 0.12), iron, -4.0, 2.55, 0);
  const roof = add(new THREE.CylinderGeometry(1.45, 1.45, 2.4, 64, 1, false, Math.PI * 0.18, Math.PI * 0.64), ironBright, -4.0, 2.55, 0);
  roof.rotation.set(Math.PI / 2, 0, Math.PI / 2);
  roof.scale.set(1, 1, 0.55);
  roof.position.y = 3.02;
  for (const side of [-1, 1]) {
    const win = add(new THREE.PlaneGeometry(0.85, 0.7), new THREE.MeshBasicMaterial({ color: 0xff8a3a }), -4.05, 2.95, side * 1.215);
    win.rotation.y = side < 0 ? Math.PI : 0;
    const frame = add(new THREE.TorusGeometry(0.47, 0.035, 8, 48), ironBright, -4.05, 2.95, side * 1.22);
    frame.scale.set(1, 0.85, 1);
  }
  parts.glows.push({ at: new THREE.Vector3(-4.05, 2.95, 1.3), size: 0.9, color: 0xff7a2a });
  parts.glows.push({ at: new THREE.Vector3(-4.05, 2.95, -1.3), size: 0.9, color: 0xff7a2a });
  // firebox grille under the cab
  add(new THREE.BoxGeometry(1.2, 0.3, 1.6), ember, -3.2, 1.0, 0);
  for (let i = 0; i < 7; i++) add(new THREE.BoxGeometry(0.05, 0.34, 1.65), ironPlain, -3.7 + i * 0.17, 1.0, 0);
  add(new RoundedBoxGeometry(0.4, 0.4, 0.4, 3, 0.08), ironPlain, -5.15, 1.05, 0);

  // --- wheels ---
  const makeWheel = (r, spokes) => {
    const w = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.17, 64, 1, true), ironPlain);
    tire.rotation.x = Math.PI / 2;
    w.add(tire);
    for (const zf of [-0.085, 0.085]) {
      const face = new THREE.Mesh(new THREE.RingGeometry(r * 0.8, r, 64), ironPlain);
      face.position.z = zf;
      face.material.side = THREE.DoubleSide;
      w.add(face);
    }
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r * 0.88, r * 0.075, 16, 64), red);
    w.add(rim);
    const spin = new THREE.Group();
    for (let i = 0; i < spokes; i++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.06, r * 0.84, 0.07), red);
      s.position.y = r * 0.42;
      const holder = new THREE.Group();
      holder.rotation.z = (i / spokes) * Math.PI * 2;
      holder.add(s);
      spin.add(holder);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.2, r * 0.22, 0.24, 32), red);
    hub.rotation.x = Math.PI / 2;
    spin.add(hub);
    if (r > 0.6) {
      const weight = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.72, r * 0.72, 0.09, 48, 1, false, Math.PI * 0.75, Math.PI * 0.5), red);
      weight.rotation.x = Math.PI / 2;
      spin.add(weight);
    }
    w.add(spin);
    w.traverse((o) => {
      o.castShadow = true;
    });
    return { group: w, spin };
  };
  const driverX = [-3.0, -1.55, -0.1];
  const R = 0.8;
  parts.R = R;
  for (const side of [-1, 1]) {
    for (const x of driverX) {
      const wheel = makeWheel(R, 14);
      wheel.group.position.set(x, R, side * 1.06);
      train.add(wheel.group);
      parts.drivers.push(wheel);
    }
    for (const x of [1.35, 2.35]) {
      const wheel = makeWheel(0.46, 10);
      wheel.group.position.set(x, 0.46, side * 1.0);
      train.add(wheel.group);
      parts.bogies.push(wheel);
    }
    // cylinder, crosshead guide, coupling and main rods
    const cyl = add(new THREE.CylinderGeometry(0.3, 0.3, 1.0, 40), ironBright, 1.95, 0.95, side * 1.24);
    cyl.rotation.z = Math.PI / 2;
    add(new THREE.BoxGeometry(1.4, 0.06, 0.06), steel, 1.0, 0.95, side * 1.3);
    const coupling = add(new THREE.BoxGeometry(driverX[2] - driverX[0] + 0.2, 0.09, 0.06), steel, 0, 0, side * 1.25);
    const main = add(new THREE.BoxGeometry(1, 0.1, 0.06), steel, 0, 0, side * 1.32);
    const crosshead = add(new THREE.BoxGeometry(0.22, 0.16, 0.12), steel, 0, 0.95, side * 1.3);
    const piston = add(new THREE.CylinderGeometry(0.035, 0.035, 1, 12), steel, 0, 0.95, side * 1.3);
    piston.rotation.z = Math.PI / 2;
    parts.rods.push({ side, coupling, main, crosshead, piston });
  }

  // --- feathers: wings, flank streamers, tail ---
  const featherGeo = new THREE.PlaneGeometry(1, 0.24, 16, 2);
  featherGeo.translate(0.5, 0, 0);
  const fp = featherGeo.attributes.position;
  for (let i = 0; i < fp.count; i++) {
    const x = fp.getX(i);
    // a gentle curl along the length
    fp.setZ(i, 0.06 * Math.sin(x * Math.PI) + 0.05 * x * x);
  }
  featherGeo.computeVertexNormals();
  const plume = (parent, x, y, z, angle, length, width, lift = 0) => {
    const m = new THREE.Mesh(featherGeo, feather);
    m.position.set(x, y, z);
    m.rotation.set(lift, 0, Math.PI - angle);
    m.scale.set(length, width, 1);
    m.castShadow = true;
    parent.add(m);
    return m;
  };

  for (const side of [-1, 1]) {
    const wing = new THREE.Group();
    wing.position.set(0.3, 3.05, side * 0.82);
    wing.userData.side = side;
    // primaries: long, sweeping up and back
    const prim = 18;
    for (let i = 0; i < prim; i++) {
      const t = i / (prim - 1);
      const ang = THREE.MathUtils.degToRad(18 + t * 68);
      const len = 2.3 + 1.9 * Math.sin(t * Math.PI * 0.85 + 0.25);
      plume(wing, -0.15 - t * 0.55, 0.25 + t * 1.05, side * 0.02 * i, ang, len, 3.8);
    }
    // secondaries
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      const ang = THREE.MathUtils.degToRad(6 + t * 52);
      plume(wing, 0.1 - t * 0.3, 0.1 + t * 0.55, side * (0.3 + 0.01 * i), ang, 1.5 + t * 0.8, 2.8);
    }
    // coverts close to the body
    for (let i = 0; i < 8; i++) {
      const t = i / 7;
      plume(wing, 0.25 - t * 0.2, 0.05 + t * 0.4, side * (0.42 + 0.01 * i), THREE.MathUtils.degToRad(t * 60), 0.85 + t * 0.35, 2.6);
    }
    train.add(wing);
    parts.wings.push(wing);

    // fiery streamers sweeping back along the flanks
    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      plume(train, 3.3 - t * 0.3, 2.1 + t * 0.55, side * (1.07 + t * 0.06), THREE.MathUtils.degToRad(-6 + t * 14), 2.6 + t * 1.2, 1.9, side * 0.1);
    }
  }
  // tail fan off the back of the cab
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    plume(train, -4.7, 3.4, (t - 0.5) * 0.9, THREE.MathUtils.degToRad(12 + t * 30), 1.6 + Math.sin(t * Math.PI) * 0.8, 1.9, (t - 0.5) * 0.8);
  }

  return { train, parts };
}

// ---------- the viewer ----------

export function createPhoenixViewer(host, { reducedMotion = false, startAngle = -0.6, spin = true, preserve = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: preserve });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x07070a, 1);
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x07070a, 22, 44);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;

  const camera = new THREE.PerspectiveCamera(30, 4 / 3, 0.1, 100);
  const target = new THREE.Vector3(0, 2.55, 0);

  const tex = {
    filigree: canvasTexture(512, 512, drawFiligree, { repeat: [2, 2] }),
    veins: canvasTexture(512, 512, drawVeins, { color: true, repeat: [1.5, 1.5] }),
    feather: canvasTexture(256, 64, drawFeather, { color: true }),
    glow: canvasTexture(128, 128, drawGlow, { color: true }),
    puff: canvasTexture(128, 128, drawPuff, { color: true }),
    floor: canvasTexture(1024, 1024, drawFloor, { color: true }),
  };
  tex.feather.wrapS = tex.feather.wrapT = THREE.ClampToEdgeWrapping;

  // lights
  scene.add(new THREE.HemisphereLight(0x8a96b8, 0x1a0c08, 0.35));
  const key = new THREE.DirectionalLight(0xffe0bc, 2.2);
  key.position.set(8, 13, 9);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -9;
  key.shadow.camera.right = 9;
  key.shadow.camera.top = 9;
  key.shadow.camera.bottom = -9;
  key.shadow.bias = -0.0004;
  key.shadow.radius = 4;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xff7a3a, 1.6);
  rim.position.set(-9, 6, -8);
  scene.add(rim);
  const cool = new THREE.DirectionalLight(0x7a9cff, 0.5);
  cool.position.set(-6, 3, 10);
  scene.add(cool);

  // floor and turntable
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ map: tex.floor, transparent: true, depthWrite: false }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.52;
  scene.add(floor);
  const shadowCatcher = new THREE.Mesh(new THREE.CircleGeometry(7.6, 96), new THREE.ShadowMaterial({ opacity: 0.55 }));
  shadowCatcher.rotation.x = -Math.PI / 2;
  shadowCatcher.position.y = -0.199;
  shadowCatcher.receiveShadow = true;

  const turn = new THREE.Group();
  scene.add(turn);
  const deck = new THREE.Mesh(
    new THREE.CylinderGeometry(7.6, 7.8, 0.3, 128),
    new THREE.MeshStandardMaterial({ color: 0x070606, metalness: 0.5, roughness: 0.72, bumpMap: tex.filigree, bumpScale: 0.01, envMapIntensity: 0.2 }),
  );
  deck.position.y = -0.36;
  deck.receiveShadow = true;
  turn.add(deck);
  turn.add(shadowCatcher);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(7.62, 0.04, 10, 200), new THREE.MeshBasicMaterial({ color: 0xff6a22 }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -0.2;
  turn.add(ring);
  const railMat = new THREE.MeshStandardMaterial({ color: 0x6a6560, metalness: 1, roughness: 0.3, envMapIntensity: 0.5 });
  const sleeperMat = new THREE.MeshStandardMaterial({ color: 0x120c09, metalness: 0.1, roughness: 0.9, envMapIntensity: 0.2 });
  for (const z of [-1.06, 1.06]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(14.6, 0.14, 0.12), railMat);
    rail.position.set(0, -0.07, z);
    rail.castShadow = rail.receiveShadow = true;
    turn.add(rail);
  }
  for (let i = 0; i < 26; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 2.9), sleeperMat);
    s.position.set(-7 + i * 0.56, -0.18, 0);
    s.receiveShadow = true;
    turn.add(s);
  }

  const { train, parts } = buildPhoenix(tex);
  const R = parts.R;
  train.position.x = 0.3;
  turn.add(train);

  // ember glow sprites (cheap bloom where the fire is)
  for (const g of parts.glows) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.glow, color: g.color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.85 }));
    s.position.copy(g.at);
    s.scale.setScalar(g.size);
    train.add(s);
    g.sprite = s;
  }
  const lightEyes = new THREE.PointLight(0xff7a2a, 2.2, 5, 2);
  lightEyes.position.set(4.9, 1.7, 0);
  train.add(lightEyes);
  for (const side of [-1, 1]) {
    const wingLight = new THREE.PointLight(0xff5a1a, 2.4, 7, 2);
    wingLight.position.set(-0.8, 4.4, side * 1.9);
    train.add(wingLight);
  }

  // steam plume from the stack, drifting back and up
  const puffs = [];
  for (let i = 0; i < 26; i++) {
    const m = new THREE.SpriteMaterial({ map: tex.puff, color: 0xd9b37a, transparent: true, depthWrite: false, opacity: 0 });
    const s = new THREE.Sprite(m);
    s.userData.age = (i / 26) * 4.2;
    train.add(s);
    puffs.push(s);
  }
  // sparks rising off the wings
  const sparkCount = 90;
  const sparkGeo = new THREE.BufferGeometry();
  const sparkPos = new Float32Array(sparkCount * 3);
  const sparkLife = new Float32Array(sparkCount);
  const rng = seeded(77);
  const resetSpark = (i, age = 0) => {
    const side = rng() < 0.5 ? -1 : 1;
    sparkPos[i * 3] = -1.5 + rng() * 3;
    sparkPos[i * 3 + 1] = 3 + rng() * 2.5;
    sparkPos[i * 3 + 2] = side * (1.2 + rng() * 1.6);
    sparkLife[i] = age;
  };
  for (let i = 0; i < sparkCount; i++) resetSpark(i, rng() * 3);
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ color: 0xffa040, size: 0.07, map: tex.glow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  train.add(sparks);

  // --- sizing ---
  const resize = () => {
    const w = host.clientWidth || 400;
    const h = host.clientHeight || 300;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the whole engine and its wings in frame at any aspect
    const fitHeight = 9.4;
    const fitWidth = 15.5;
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const distH = fitHeight / 2 / Math.tan(vFov / 2);
    const distW = fitWidth / 2 / (Math.tan(vFov / 2) * camera.aspect);
    const dist = Math.max(distH, distW);
    camera.position.set(0, target.y + dist * 0.26, dist);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  // --- interaction: drag to turn it yourself ---
  let dragging = false;
  let lastX = 0;
  let manual = 0;
  let resumeAt = 0;
  const canvas = renderer.domElement;
  canvas.style.touchAction = 'pan-y';
  canvas.style.cursor = 'grab';
  const down = (e) => {
    dragging = true;
    lastX = e.clientX;
    canvas.style.cursor = 'grabbing';
    canvas.setPointerCapture?.(e.pointerId);
  };
  const move = (e) => {
    if (!dragging) return;
    manual += (e.clientX - lastX) * 0.01;
    lastX = e.clientX;
  };
  const up = () => {
    dragging = false;
    canvas.style.cursor = 'grab';
    resumeAt = performance.now() + 1500;
  };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  // --- animation ---
  let visible = true;
  const io = new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting);
  });
  io.observe(host);

  const clock = new THREE.Clock();
  let angle = startAngle;
  let travel = 0;
  let raf = 0;
  const spinSpeed = reducedMotion ? 0.08 : (Math.PI * 2) / 20; // one full turn every 20 seconds
  const tmp = new THREE.Vector3();

  const frame = () => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!visible || document.hidden) return;
    const t = clock.elapsedTime;
    if (spin && !dragging && performance.now() > resumeAt) angle += spinSpeed * dt;
    turn.rotation.y = angle + manual;

    // wheels roll as if on display rollers; rods follow the crank pins
    travel += dt * (reducedMotion ? 0.4 : 1.6);
    const a = travel / R;
    for (const w of parts.drivers) w.spin.rotation.z = -a;
    for (const w of parts.bogies) w.spin.rotation.z = -travel / 0.46;
    const crank = R * 0.42;
    const pinX = Math.cos(-a + Math.PI / 2) * crank;
    const pinY = Math.sin(-a + Math.PI / 2) * crank;
    for (const r of parts.rods) {
      r.coupling.position.set(-1.55 + pinX, R + pinY, r.side * 1.25);
      const mx = -0.1 + pinX;
      const my = R + pinY;
      const L = 1.5;
      const cx = mx + Math.sqrt(Math.max(0.01, L * L - (my - 0.95) ** 2));
      r.crosshead.position.x = cx;
      r.piston.position.x = (cx + 1.95) / 2;
      r.piston.scale.y = Math.max(0.05, 1.95 - cx);
      r.main.position.set((mx + cx) / 2, (my + 0.95) / 2, r.side * 1.32);
      r.main.rotation.z = Math.atan2(0.95 - my, cx - mx);
      r.main.scale.x = Math.hypot(cx - mx, 0.95 - my);
    }

    // wings breathe; fire flickers
    for (const w of parts.wings) {
      const side = w.userData.side;
      w.rotation.x = side * (0.55 + Math.sin(t * 1.3) * 0.07);
      w.rotation.y = side * (0.12 + Math.sin(t * 1.3 + 0.6) * 0.04);
    }
    const flick = 0.85 + Math.sin(t * 9) * 0.06 + Math.sin(t * 23) * 0.04;
    for (const g of parts.glows) g.sprite.material.opacity = 0.75 * flick;
    lightEyes.intensity = 2.2 * flick;

    // steam
    for (const s of puffs) {
      s.userData.age += dt;
      if (s.userData.age > 4.2) s.userData.age -= 4.2;
      const k = s.userData.age / 4.2;
      tmp.copy(parts.stackTop);
      s.position.set(tmp.x - k * 4.2, tmp.y + k * 3.4 + Math.sin(k * 6 + s.id) * 0.12, Math.sin(s.id * 1.7) * 0.4 * k);
      s.scale.setScalar(0.5 + k * 2.6);
      s.material.opacity = Math.sin(Math.min(1, k * 1.15) * Math.PI) * 0.5;
      s.material.color.setHSL(0.09, 0.45, 0.6 - k * 0.25);
    }
    // sparks
    for (let i = 0; i < sparkCount; i++) {
      sparkLife[i] += dt;
      sparkPos[i * 3 + 1] += dt * 0.9;
      sparkPos[i * 3] -= dt * 0.35;
      if (sparkLife[i] > 3) resetSpark(i);
    }
    sparkGeo.attributes.position.needsUpdate = true;

    renderer.render(scene, camera);
  };
  frame();

  return {
    canvas,
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      });
      Object.values(tex).forEach((t) => t.dispose());
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
