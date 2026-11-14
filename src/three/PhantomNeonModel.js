import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';

// Phantom Neon (the Iron Phantom MK-4): a polished gunmetal steam engine with blue plasma running
// through conduits and coils, arcing between its parts and lighting its wheels. It turns on a
// mirror-gloss showroom plinth under spotlights. Faces +X; rail top is y = 0.

// The paint scheme. The showroom uses the Phantom Neon's own; card art repaints it per model
// (see createPhantomViewer's `theme`).
const PHANTOM_THEME = { body: 0x1b2433, accent: 0x19c3e6, hot: 0x9ff3ff, floor: 0x0f6f8a, plate: 'Phantom Neon' };
let THEME = PHANTOM_THEME;
let CYAN = new THREE.Color(THEME.accent);
let CYAN_HI = new THREE.Color(THEME.hot);

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

// Brushed metal grain with faint panel seams (bump + roughness).
function drawBrushed(ctx, w, h) {
  const rng = seeded(31);
  ctx.fillStyle = '#7a7a7a';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) {
    const y = rng() * h;
    const v = 95 + rng() * 70;
    ctx.strokeStyle = `rgba(${v},${v},${v},0.35)`;
    ctx.lineWidth = 0.6 + rng();
    ctx.beginPath();
    const x = rng() * w;
    ctx.moveTo(x, y);
    ctx.lineTo(x + 40 + rng() * 160, y + (rng() - 0.5) * 1.5);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(30,30,30,0.9)';
  ctx.lineWidth = 2;
  for (let x = 0; x <= w; x += w / 4) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
}

function drawGlow(ctx, w, h) {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.2, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function drawPuff(ctx, w, h) {
  const rng = seeded(9);
  for (let i = 0; i < 9; i++) {
    const x = w * (0.3 + rng() * 0.4);
    const y = h * (0.3 + rng() * 0.4);
    const r = w * (0.18 + rng() * 0.16);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
}

function drawFloor(ctx, w, h) {
  ctx.fillStyle = '#05070a';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(25,195,230,0.07)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 16; i++) {
    const p = (i / 16) * w;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, h);
    ctx.moveTo(0, p);
    ctx.lineTo(w, p);
    ctx.stroke();
  }
}

function drawPlate(ctx, w, h) {
  ctx.fillStyle = '#0b1118';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#3b4c64';
  ctx.lineWidth = 6;
  ctx.strokeRect(5, 5, w - 10, h - 10);
  ctx.font = '800 64px Orbitron, Rajdhani, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;
  ctx.shadowColor = hex(THEME.accent);
  ctx.shadowBlur = 18;
  ctx.fillStyle = hex(THEME.hot);
  const label = (THEME.plate ?? 'PHANTOM NEON').toUpperCase();
  ctx.font = `800 ${label.length > 13 ? 52 : 64}px Orbitron, Rajdhani, Arial, sans-serif`;
  ctx.fillText(label, w / 2, h / 2 + 2);
}

// Plasma: bright pulses travelling along a tube's length (uv.x), over a steady core glow.
function plasmaMaterial({ speed = 1.2, freq = 9, base = 0.45, glow = false, color = CYAN, opacity = 1 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: color.clone() },
      uHot: { value: CYAN_HI.clone() },
      uSpeed: { value: speed },
      uFreq: { value: freq },
      uBase: { value: base },
      uOpacity: { value: opacity },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vView;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uTime, uSpeed, uFreq, uBase, uOpacity;
      uniform vec3 uColor, uHot;
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vView;
      void main() {
        float x = vUv.x * uFreq - uTime * uSpeed;
        float pulse = pow(0.5 + 0.5 * sin(x * 6.2831), 6.0);
        float ripple = 0.5 + 0.5 * sin(x * 23.0 + vUv.y * 6.2831 * 2.0 - uTime * 4.0);
        float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), ${glow ? '1.2' : '2.0'});
        float core = ${glow ? 'rim * 0.9' : '0.75 + 0.25 * (1.0 - rim)'};
        float k = (uBase + pulse * 1.3 + ripple * 0.15) * core;
        vec3 col = mix(uColor, uHot, clamp(pulse * 0.9 + (1.0 - rim) * ${glow ? '0.0' : '0.35'}, 0.0, 1.0));
        gl_FragColor = vec4(col * k * ${glow ? '1.1' : '1.6'}, clamp(k, 0.0, 1.0) * uOpacity);
      }`,
    transparent: true,
    depthWrite: !glow,
    blending: glow ? THREE.AdditiveBlending : THREE.NormalBlending,
    toneMapped: false,
  });
}

// ---------- the locomotive ----------

function buildPhantom(tex, plasmaMats) {
  const train = new THREE.Group();
  const parts = { drivers: [], small: [], rods: [], glows: [], arcAnchors: [] };

  const gun = new THREE.MeshPhysicalMaterial({
    color: THEME.body,
    metalness: 0.78,
    roughness: 0.34,
    clearcoat: 0.5,
    clearcoatRoughness: 0.14,
    bumpMap: tex.brushed,
    bumpScale: 0.004,
    roughnessMap: tex.brushed,
    envMapIntensity: 0.32,
  });
  const gunDark = new THREE.MeshPhysicalMaterial({ color: 0x0c1118, metalness: 0.75, roughness: 0.38, clearcoat: 0.4, clearcoatRoughness: 0.2, envMapIntensity: 0.25 });
  const gunLight = new THREE.MeshPhysicalMaterial({ color: 0x2f3d52, metalness: 0.85, roughness: 0.26, clearcoat: 0.7, clearcoatRoughness: 0.1, envMapIntensity: 0.4 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0x8592a3, metalness: 1, roughness: 0.18, envMapIntensity: 0.5 });
  const black = new THREE.MeshStandardMaterial({ color: 0x07090c, metalness: 0.6, roughness: 0.5 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x06141c, metalness: 0, roughness: 0.05, clearcoat: 1, emissive: THEME.accent, emissiveIntensity: 0.32, envMapIntensity: 0.8 });
  const lens = new THREE.MeshBasicMaterial({ color: 0xe6fdff, toneMapped: false });
  const ember = new THREE.MeshBasicMaterial({ color: 0xff9d1c, toneMapped: false });

  const plasma = (opts) => {
    const m = plasmaMaterial(opts);
    plasmaMats.push(m);
    return m;
  };
  const coreMat = plasma({ speed: 1.4, freq: 7 });
  const glowMat = plasma({ speed: 1.4, freq: 7, glow: true, base: 0.35, opacity: 0.8 });

  const add = (geo, mat, x, y, z, parent = train) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  // a plasma line: bright core tube plus a soft additive sheath
  const conduit = (points, r = 0.035, { closed = false, mat = coreMat, glow = glowMat, segs = 120 } = {}) => {
    const curve = new THREE.CatmullRomCurve3(points, closed);
    const core = new THREE.Mesh(new THREE.TubeGeometry(curve, segs, r, 10, closed), mat);
    const sheath = new THREE.Mesh(new THREE.TubeGeometry(curve, segs, r * 3.2, 12, closed), glow);
    train.add(core, sheath);
    return curve;
  };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  // --- frame and running board ---
  add(new RoundedBoxGeometry(8.4, 0.34, 1.9, 4, 0.06), gunDark, 0.4, 1.12, 0);
  add(new RoundedBoxGeometry(8.4, 0.12, 2.5, 4, 0.04), gun, 0.4, 1.42, 0);
  for (const side of [-1, 1]) conduit([V(-3.7, 1.42, side * 1.27), V(1, 1.42, side * 1.27), V(4.55, 1.42, side * 1.27)], 0.026, { segs: 80 });

  // --- boiler ---
  const boiler = add(new THREE.CylinderGeometry(1.0, 1.0, 5.1, 128, 1, false), gun, 1.0, 2.5, 0);
  boiler.rotation.z = Math.PI / 2;
  for (const x of [-0.6, 0.6, 1.8, 3.0]) {
    const band = add(new THREE.TorusGeometry(1.012, 0.05, 16, 128), gunLight, x, 2.5, 0);
    band.rotation.y = Math.PI / 2;
  }
  // rivets
  const rivetGeo = new THREE.SphereGeometry(0.026, 10, 8);
  const rivets = new THREE.InstancedMesh(rivetGeo, chrome, 4 * 2 * 24);
  const dummy = new THREE.Object3D();
  let ri = 0;
  for (const x of [-0.6, 0.6, 1.8, 3.0]) {
    for (const off of [-0.1, 0.1]) {
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        dummy.position.set(x + off, 2.5 + Math.cos(a) * 1.0, Math.sin(a) * 1.0);
        dummy.updateMatrix();
        rivets.setMatrixAt(ri++, dummy.matrix);
      }
    }
  }
  train.add(rivets);
  // side conduits with emitter nodes, like the drawing's four blue dots
  for (const side of [-1, 1]) {
    conduit([V(-1.45, 2.45, side * 1.03), V(0.5, 2.45, side * 1.035), V(2.5, 2.45, side * 1.035), V(3.55, 2.45, side * 1.03)], 0.04);
    for (const x of [-0.6, 0.6, 1.8, 3.0]) {
      const node = add(new THREE.SphereGeometry(0.09, 24, 16), lens, x, 2.45, side * 1.06);
      node.castShadow = false;
      parts.glows.push({ at: V(x, 2.45, side * 1.12), size: 0.7 });
      parts.arcAnchors.push(V(x, 2.45, side * 1.1));
    }
  }
  // plasma coil spiralling around the boiler
  const helix = [];
  const turns = 5.5;
  for (let i = 0; i <= 220; i++) {
    const t = i / 220;
    const a = t * turns * Math.PI * 2;
    helix.push(V(-1.3 + t * 4.7, 2.5 + Math.cos(a) * 1.06, Math.sin(a) * 1.06));
  }
  conduit(helix, 0.02, { mat: plasma({ speed: 2.2, freq: 22, base: 0.5 }), glow: plasma({ speed: 2.2, freq: 22, glow: true, base: 0.35, opacity: 0.75 }), segs: 600 });

  // --- smokebox, headlight, beam ---
  const smoke = add(new THREE.CylinderGeometry(1.05, 1.05, 0.95, 128), gunDark, 4.0, 2.5, 0);
  smoke.rotation.z = Math.PI / 2;
  const door = add(new THREE.CylinderGeometry(0.98, 1.02, 0.12, 128), gun, 4.5, 2.5, 0);
  door.rotation.z = Math.PI / 2;
  const doorRing = [];
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    doorRing.push(V(4.57, 2.5 + Math.cos(a) * 0.78, Math.sin(a) * 0.78));
  }
  conduit(doorRing, 0.03, { closed: true, segs: 128 });
  const hub = add(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 48), chrome, 4.6, 2.5, 0);
  hub.rotation.z = Math.PI / 2;
  add(new RoundedBoxGeometry(0.55, 0.42, 0.5, 4, 0.06), gunDark, 4.35, 3.72, 0);
  const lamp = add(new THREE.CylinderGeometry(0.15, 0.15, 0.06, 48), lens, 4.64, 3.72, 0);
  lamp.rotation.z = Math.PI / 2;
  parts.glows.push({ at: V(4.72, 3.72, 0), size: 1.6, bright: true });
  const beamGeo = new THREE.ConeGeometry(1.4, 6, 48, 1, true);
  beamGeo.translate(0, -3, 0);
  const beam = new THREE.Mesh(
    beamGeo,
    new THREE.ShaderMaterial({
      uniforms: { uColor: { value: CYAN_HI.clone() } },
      vertexShader: 'varying float vY; void main(){ vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 uColor; varying float vY; void main(){ float a = clamp(1.0 + vY / 6.0, 0.0, 1.0); gl_FragColor = vec4(uColor, a * a * 0.16); }',
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    }),
  );
  beam.position.set(4.68, 3.72, 0);
  beam.rotation.z = Math.PI / 2;
  train.add(beam);
  const headSpot = new THREE.SpotLight(THEME.hot, 3, 14, 0.38, 0.6, 1.5);
  headSpot.position.set(4.7, 3.72, 0);
  headSpot.target.position.set(10, 2.2, 0);
  train.add(headSpot, headSpot.target);

  // --- stack (with a hot ember mouth), domes, whistle ---
  const stackProfile = [
    V(0, 0, 0), V(0.34, 0, 0), V(0.28, 0.15, 0), V(0.22, 0.55, 0), V(0.26, 0.9, 0), V(0.4, 1.1, 0), V(0.42, 1.18, 0), V(0.32, 1.18, 0), V(0.3, 1.05, 0), V(0, 1.05, 0),
  ].map((p) => new THREE.Vector2(p.x, p.y));
  add(new THREE.LatheGeometry(stackProfile, 96), gun, 3.2, 3.38, 0);
  const mouth = add(new THREE.CircleGeometry(0.3, 48), ember, 3.2, 4.47, 0);
  mouth.rotation.x = -Math.PI / 2;
  parts.glows.push({ at: V(3.2, 4.5, 0), size: 1.1, color: 0xff9d1c });
  const stackRing = [];
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    stackRing.push(V(3.2 + Math.cos(a) * 0.235, 4.0, Math.sin(a) * 0.235));
  }
  conduit(stackRing, 0.022, { closed: true, segs: 96 });
  parts.stackTop = V(3.2, 4.6, 0);
  parts.arcAnchors.push(V(3.2, 4.0, 0.25), V(3.2, 4.0, -0.25));
  const dome = [];
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * (Math.PI / 2);
    dome.push(new THREE.Vector2(Math.cos(a) * 0.48, Math.sin(a) * 0.58));
  }
  add(new THREE.LatheGeometry(dome, 96), gunLight, 1.75, 3.38, 0);
  const domeRing = [];
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    domeRing.push(V(1.75 + Math.cos(a) * 0.36, 3.75, Math.sin(a) * 0.36));
  }
  conduit(domeRing, 0.02, { closed: true, segs: 96 });
  const sand = add(new RoundedBoxGeometry(0.7, 0.4, 0.8, 4, 0.1), gun, 0.35, 3.5, 0);
  sand.rotation.z = 0.05;
  add(new THREE.CylinderGeometry(0.05, 0.05, 0.45, 24), chrome, 2.55, 3.65, 0);
  const whistleTip = add(new THREE.ConeGeometry(0.09, 0.14, 24), lens, 2.55, 3.95, 0);
  whistleTip.rotation.x = Math.PI;
  parts.glows.push({ at: V(2.55, 3.95, 0), size: 0.6 });

  // --- cab ---
  add(new RoundedBoxGeometry(2.0, 2.6, 2.3, 6, 0.08), gun, -2.55, 2.75, 0);
  const roof = add(new RoundedBoxGeometry(2.5, 0.14, 2.7, 4, 0.06), gunLight, -2.5, 4.12, 0);
  roof.rotation.z = -0.07;
  for (const side of [-1, 1]) {
    const win = add(new RoundedBoxGeometry(1.15, 0.85, 0.06, 4, 0.04), glass, -2.55, 3.3, side * 1.15);
    win.castShadow = false;
    add(new THREE.BoxGeometry(0.05, 0.85, 0.08), gunDark, -2.55, 3.3, side * 1.17);
    conduit([V(-3.55, 2.62, side * 1.16), V(-2.5, 2.62, side * 1.165), V(-1.55, 2.62, side * 1.16)], 0.026, { segs: 40 });
  }
  const fireGrate = add(new THREE.BoxGeometry(0.9, 0.22, 1.5), ember, -1.4, 1.2, 0);
  fireGrate.castShadow = false;
  for (let i = 0; i < 6; i++) add(new THREE.BoxGeometry(0.05, 0.26, 1.55), black, -1.8 + i * 0.16, 1.2, 0);
  parts.glows.push({ at: V(-1.4, 1.1, 1.0), size: 0.9, color: 0xff7a1a });
  parts.glows.push({ at: V(-1.4, 1.1, -1.0), size: 0.9, color: 0xff7a1a });

  // --- tender with nameplate ---
  add(new RoundedBoxGeometry(2.5, 2.0, 2.4, 6, 0.16), gun, -5.0, 2.2, 0);
  const coal = add(new RoundedBoxGeometry(2.2, 0.3, 2.1, 4, 0.12), black, -5.0, 3.22, 0);
  coal.castShadow = false;
  const rng = seeded(4);
  for (let i = 0; i < 14; i++) {
    const e = add(new THREE.SphereGeometry(0.03 + rng() * 0.03, 10, 8), ember, -6.0 + rng() * 2, 3.38, (rng() - 0.5) * 1.8);
    e.castShadow = false;
  }
  for (const side of [-1, 1]) {
    conduit([V(-6.2, 2.62, side * 1.21), V(-5.0, 2.62, side * 1.215), V(-3.8, 2.62, side * 1.21)], 0.026, { segs: 40 });
    const plate = add(new THREE.PlaneGeometry(1.6, 0.32), new THREE.MeshBasicMaterial({ map: tex.plate, toneMapped: false }), -5.0, 2.15, side * 1.205);
    plate.rotation.y = side < 0 ? Math.PI : 0;
    plate.castShadow = false;
    for (let i = 0; i < 6; i++) add(new THREE.SphereGeometry(0.03, 10, 8), chrome, -5.95 + i * 0.38, 3.0, side * 1.205);
  }

  // --- wheels with plasma rims ---
  const rimMat = plasma({ speed: 1.8, freq: 5, base: 0.5 });
  const rimGlow = plasma({ speed: 1.8, freq: 5, glow: true, base: 0.4, opacity: 0.75 });
  const makeWheel = (r, spokes) => {
    const g = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.17, 96, 1, true), gunLight);
    tire.rotation.x = Math.PI / 2;
    g.add(tire);
    for (const zf of [-0.085, 0.085]) {
      const face = new THREE.Mesh(new THREE.RingGeometry(r * 0.83, r, 96), gunDark);
      face.material = gunDark;
      face.position.z = zf;
      face.rotation.y = zf < 0 ? Math.PI : 0;
      g.add(face);
    }
    const spin = new THREE.Group();
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r * 0.88, r * 0.04, 12, 128), rimMat);
    rim.position.z = 0.09;
    const rimSheath = new THREE.Mesh(new THREE.TorusGeometry(r * 0.88, r * 0.12, 12, 128), rimGlow);
    rimSheath.position.z = 0.09;
    spin.add(rim, rimSheath);
    for (let i = 0; i < spokes; i++) {
      const holder = new THREE.Group();
      holder.rotation.z = (i / spokes) * Math.PI * 2;
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, r * 0.8, 12), gunLight);
      s.position.y = r * 0.42;
      holder.add(s);
      spin.add(holder);
    }
    const hubM = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.2, r * 0.22, 0.26, 48), chrome);
    hubM.rotation.x = Math.PI / 2;
    spin.add(hubM);
    const core = new THREE.Mesh(new THREE.CircleGeometry(r * 0.09, 32), lens);
    core.position.z = 0.135;
    spin.add(core);
    if (r > 0.6) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.72, r * 0.72, 0.1, 64, 1, false, Math.PI * 0.75, Math.PI * 0.5), gunDark);
      w.rotation.x = Math.PI / 2;
      spin.add(w);
    }
    g.add(spin);
    g.traverse((o) => {
      if (o.isMesh && o.material !== rimMat && o.material !== rimGlow && o.material !== lens) o.castShadow = true;
    });
    return { group: g, spin };
  };
  const R = 0.9;
  parts.R = R;
  const driverX = [0.0, 1.45, 2.9];
  parts.driverX = driverX;
  for (const side of [-1, 1]) {
    for (const x of driverX) {
      const w = makeWheel(R, 16);
      w.group.position.set(x, R, side * 1.07);
      if (side < 0) w.group.rotation.y = Math.PI;
      train.add(w.group);
      parts.drivers.push({ ...w, side });
      parts.arcAnchors.push(V(x, R * 1.6, side * 1.2));
    }
    for (const [x, r] of [[-2.3, 0.5], [-5.6, 0.5], [-4.4, 0.5], [4.05, 0.45]]) {
      const w = makeWheel(r, 10);
      w.group.position.set(x, r, side * 1.02);
      if (side < 0) w.group.rotation.y = Math.PI;
      train.add(w.group);
      parts.small.push({ ...w, r, side });
    }
    // cylinder with plasma ring, guides and rods
    const cyl = add(new THREE.CylinderGeometry(0.32, 0.32, 1.0, 64), gun, 4.0, 1.05, side * 1.28);
    cyl.rotation.z = Math.PI / 2;
    const cylRing = [];
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      cylRing.push(V(3.62, 1.05 + Math.cos(a) * 0.33, side * 1.28 + Math.sin(a) * 0.33));
    }
    conduit(cylRing, 0.02, { closed: true, segs: 96 });
    add(new THREE.BoxGeometry(1.4, 0.05, 0.05), chrome, 2.95, 1.05, side * 1.34);
    const coupling = add(new THREE.BoxGeometry(driverX[2] - driverX[0] + 0.24, 0.1, 0.07), chrome, 0, 0, side * 1.27);
    const main = add(new THREE.BoxGeometry(1, 0.11, 0.07), chrome, 0, 0, side * 1.35);
    const crosshead = add(new THREE.BoxGeometry(0.24, 0.18, 0.13), gunLight, 0, 1.05, side * 1.34);
    const piston = add(new THREE.CylinderGeometry(0.04, 0.04, 1, 16), chrome, 0, 1.05, side * 1.34);
    piston.rotation.z = Math.PI / 2;
    parts.rods.push({ side, coupling, main, crosshead, piston });
  }

  // --- pilot plow with a plasma leading edge ---
  const plowShape = new THREE.Shape();
  plowShape.moveTo(0, 0);
  plowShape.lineTo(1.25, 0);
  plowShape.lineTo(0, 1.05);
  plowShape.lineTo(0, 0);
  const plowGeo = new THREE.ExtrudeGeometry(plowShape, { depth: 2.0, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 3 });
  plowGeo.translate(0, 0, -1.0);
  const pp = plowGeo.attributes.position;
  for (let i = 0; i < pp.count; i++) {
    const k = THREE.MathUtils.clamp(pp.getX(i) / 1.25, 0, 1);
    pp.setZ(i, pp.getZ(i) * (1 - 0.45 * k));
  }
  plowGeo.computeVertexNormals();
  add(plowGeo, gunDark, 4.55, 0.06, 0);
  for (let i = -3; i <= 3; i++) add(new THREE.BoxGeometry(1.5, 0.05, 0.05), gunLight, 5.1, 0.55, i * 0.24).rotation.z = -0.7;
  for (const side of [-1, 1]) conduit([V(4.58, 1.1, side * 1.0), V(5.2, 0.55, side * 0.8), V(5.8, 0.08, side * 0.55)], 0.026, { segs: 30 });

  return { train, parts };
}

// ---------- the showroom ----------

export function createPhantomViewer(host, { reducedMotion = false, startAngle = -0.55, spin = true, theme = null, preserve = false } = {}) {
  THEME = { ...PHANTOM_THEME, ...(theme ?? {}) };
  CYAN = new THREE.Color(THEME.accent);
  CYAN_HI = new THREE.Color(THEME.hot);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: preserve });
  const mobile = Math.min(window.innerWidth, window.innerHeight) < 600;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x04060a, 1);
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x04060a, 24, 48);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;

  const camera = new THREE.PerspectiveCamera(28, 16 / 10, 0.1, 120);
  const target = new THREE.Vector3(0, 1.9, 0);

  const tex = {
    brushed: canvasTexture(512, 512, drawBrushed, { repeat: [2, 1] }),
    glow: canvasTexture(128, 128, drawGlow, { color: true }),
    puff: canvasTexture(128, 128, drawPuff, { color: true }),
    floor: canvasTexture(1024, 1024, drawFloor, { color: true, repeat: [6, 6] }),
    plate: canvasTexture(512, 104, drawPlate, { color: true }),
  };
  tex.plate.wrapS = tex.plate.wrapT = THREE.ClampToEdgeWrapping;
  const plasmaMats = [];

  // lighting: three overhead showroom spots, a cool fill and a cyan kicker from below
  scene.add(new THREE.HemisphereLight(0x6f8fb8, 0x05070a, 0.12));
  const key = new THREE.SpotLight(0xfff4e6, 2.6, 40, 0.42, 0.55, 1.2);
  key.position.set(4, 16, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0003;
  key.shadow.radius = 5;
  scene.add(key, key.target);
  const backSpot = new THREE.SpotLight(0x9fd8ff, 2.0, 40, 0.5, 0.6, 1.2);
  backSpot.position.set(-8, 13, -9);
  scene.add(backSpot, backSpot.target);
  const sideSpot = new THREE.SpotLight(0xffffff, 1.1, 40, 0.5, 0.6, 1.2);
  sideSpot.position.set(-10, 10, 8);
  scene.add(sideSpot, sideSpot.target);
  const fill = new THREE.DirectionalLight(0x6aa8ff, 0.18);
  fill.position.set(6, 3, 10);
  scene.add(fill);

  // visible light shafts from the ceiling spots
  const shaftMat = new THREE.ShaderMaterial({
    uniforms: {},
    vertexShader: 'varying float vY; void main(){ vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying float vY; void main(){ float a = clamp((vY + 9.0) / 18.0, 0.0, 1.0); gl_FragColor = vec4(vec3(0.75,0.9,1.0), (1.0 - a) * 0.022 + a * 0.006); }',
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  for (const [x, z] of [[-9, -12], [0, -15], [9, -12]]) {
    const shaft = new THREE.Mesh(new THREE.ConeGeometry(2.8, 18, 48, 1, true), shaftMat);
    shaft.position.set(x, 8.5, z);
    scene.add(shaft);
  }

  // mirror-gloss floor: a reflector under a dark lacquer layer
  const mirror = new Reflector(new THREE.CircleGeometry(40, 64), {
    textureWidth: Math.floor((host.clientWidth || 800) * (mobile ? 0.75 : 1)),
    textureHeight: Math.floor((host.clientHeight || 500) * (mobile ? 0.75 : 1)),
    color: 0x3a434e,
  });
  mirror.rotation.x = -Math.PI / 2;
  mirror.position.y = -0.505;
  scene.add(mirror);
  const lacquer = new THREE.Mesh(
    new THREE.CircleGeometry(40, 64),
    new THREE.MeshStandardMaterial({ map: tex.floor, color: 0x06080b, metalness: 0.1, roughness: 0.4, transparent: true, opacity: 0.72, envMapIntensity: 0.05 }),
  );
  lacquer.rotation.x = -Math.PI / 2;
  lacquer.position.y = -0.5;
  lacquer.receiveShadow = true;
  scene.add(lacquer);

  // the turntable plinth with an underglow
  const turn = new THREE.Group();
  scene.add(turn);
  const plinthMat = new THREE.MeshPhysicalMaterial({ color: 0x05070a, metalness: 0.5, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 0.08 });
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(7.6, 7.75, 0.32, 160), plinthMat);
  plinth.position.y = -0.34;
  plinth.receiveShadow = true;
  turn.add(plinth);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(7.7, 0.035, 10, 240), new THREE.MeshBasicMaterial({ color: THEME.accent, toneMapped: false }));
  lip.rotation.x = Math.PI / 2;
  lip.position.y = -0.47;
  scene.add(lip);
  const under = new THREE.Mesh(
    new THREE.RingGeometry(7.4, 9.6, 160),
    new THREE.MeshBasicMaterial({ map: tex.glow, color: THEME.accent, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  under.visible = false;
  scene.add(under);
  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 22),
    new THREE.MeshBasicMaterial({ map: tex.glow, color: THEME.floor, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = -0.49;
  scene.add(halo);
  const shadowCatcher = new THREE.Mesh(new THREE.CircleGeometry(7.5, 96), new THREE.ShadowMaterial({ opacity: 0.6 }));
  shadowCatcher.rotation.x = -Math.PI / 2;
  shadowCatcher.position.y = -0.175;
  shadowCatcher.receiveShadow = true;
  turn.add(shadowCatcher);
  const railMat = new THREE.MeshStandardMaterial({ color: 0x6d7a8a, metalness: 1, roughness: 0.22, envMapIntensity: 0.4 });
  const tieMat = new THREE.MeshStandardMaterial({ color: 0x080b0f, metalness: 0.3, roughness: 0.7, envMapIntensity: 0.1 });
  for (const z of [-1.07, 1.07]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(14.8, 0.14, 0.12), railMat);
    rail.position.set(0, -0.07, z);
    rail.castShadow = rail.receiveShadow = true;
    turn.add(rail);
  }
  for (let i = 0; i < 27; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.06, 2.9), tieMat);
    s.position.set(-7.2 + i * 0.555, -0.16, 0);
    s.receiveShadow = true;
    turn.add(s);
  }

  const { train, parts } = buildPhantom(tex, plasmaMats);
  train.position.x = -0.1;
  turn.add(train);
  const R = parts.R;

  for (const g of parts.glows) {
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex.glow, color: g.color ?? THEME.accent, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: g.bright ? 1 : 0.8, toneMapped: false }),
    );
    s.position.copy(g.at);
    s.scale.setScalar(g.size);
    train.add(s);
    g.sprite = s;
  }
  const plasmaLights = [];
  for (const [x, y, z] of [[1.0, 2.6, 1.9], [1.0, 2.6, -1.9], [1.5, 0.9, 1.7], [1.5, 0.9, -1.7]]) {
    const l = new THREE.PointLight(THEME.accent, 2.4, 6, 2);
    l.position.set(x, y, z);
    train.add(l);
    plasmaLights.push(l);
  }

  // plasma arcs: jagged bolts that jump between anchor points and flicker
  const arcMat = new THREE.MeshBasicMaterial({ color: 0xbff8ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const arcGlowMat = new THREE.MeshBasicMaterial({ color: THEME.accent, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const arcs = [];
  const arng = seeded(2024);
  const makeArc = (arc) => {
    const anchors = parts.arcAnchors;
    const a = anchors[Math.floor(arng() * anchors.length)];
    let b = anchors[Math.floor(arng() * anchors.length)];
    if (a.distanceTo(b) > 3.2 || a === b) b = a.clone().add(new THREE.Vector3((arng() - 0.5) * 1.6, 0.6 + arng() * 0.9, Math.sign(a.z || 1) * (0.25 + arng() * 0.4)));
    const pts = [];
    const n = 14;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = a.clone().lerp(b, t);
      const amp = Math.sin(t * Math.PI) * 0.28;
      p.x += (arng() - 0.5) * amp;
      p.y += (arng() - 0.5) * amp + Math.sin(t * Math.PI) * 0.35;
      p.z += (arng() - 0.5) * amp + Math.sign(a.z || 1) * Math.sin(t * Math.PI) * 0.18;
      pts.push(p);
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    arc.core.geometry.dispose();
    arc.glow.geometry.dispose();
    arc.core.geometry = new THREE.TubeGeometry(curve, 40, 0.012, 5, false);
    arc.glow.geometry = new THREE.TubeGeometry(curve, 40, 0.05, 6, false);
    arc.life = 0.07 + arng() * 0.16;
    arc.rest = arng() * 0.9;
  };
  for (let i = 0; i < 4; i++) {
    const core = new THREE.Mesh(new THREE.BufferGeometry(), arcMat);
    const glow = new THREE.Mesh(new THREE.BufferGeometry(), arcGlowMat);
    train.add(core, glow);
    const arc = { core, glow, life: 0, rest: i * 0.3 };
    arcs.push(arc);
  }

  // drifting plasma motes around the body
  const moteCount = 140;
  const moteGeo = new THREE.BufferGeometry();
  const motePos = new Float32Array(moteCount * 3);
  const moteSeed = new Float32Array(moteCount);
  const mr = seeded(88);
  for (let i = 0; i < moteCount; i++) moteSeed[i] = mr() * 100;
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({ color: THEME.hot, size: 0.07, map: tex.glow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  train.add(motes);

  // steam
  const puffs = [];
  for (let i = 0; i < 22; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.puff, color: 0x8796a8, transparent: true, depthWrite: false, opacity: 0 }));
    s.userData.age = (i / 22) * 4;
    train.add(s);
    puffs.push(s);
  }

  // --- sizing ---
  const resize = () => {
    const w = host.clientWidth || 640;
    const h = host.clientHeight || 400;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const distH = 8.2 / 2 / Math.tan(vFov / 2);
    const distW = 15.6 / 2 / (Math.tan(vFov / 2) * camera.aspect);
    const dist = Math.max(distH, distW);
    camera.position.set(0, target.y + dist * 0.3, dist);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    mirror.getRenderTarget?.().setSize(Math.floor(w * renderer.getPixelRatio() * (mobile ? 0.6 : 0.85)), Math.floor(h * renderer.getPixelRatio() * (mobile ? 0.6 : 0.85)));
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  // drag to turn
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

  let visible = true;
  const io = new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting);
  });
  io.observe(host);

  const clock = new THREE.Clock();
  let angle = startAngle;
  let travel = 0;
  let raf = 0;
  const spinSpeed = reducedMotion ? 0.08 : (Math.PI * 2) / 22;

  const frame = () => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!visible || document.hidden) return;
    const t = clock.elapsedTime;
    if (spin && !dragging && performance.now() > resumeAt) angle += spinSpeed * dt;
    turn.rotation.y = angle + manual;
    lip.rotation.z = turn.rotation.y;

    for (const m of plasmaMats) m.uniforms.uTime.value = t;

    // wheels and rods
    travel += dt * (reducedMotion ? 0.4 : 1.5);
    const a = travel / R;
    for (const w of parts.drivers) w.spin.rotation.z = -a * (w.side < 0 ? -1 : 1);
    for (const w of parts.small) w.spin.rotation.z = (-travel / w.r) * (w.side < 0 ? -1 : 1);
    const crank = R * 0.42;
    const pinX = Math.cos(-a + Math.PI / 2) * crank;
    const pinY = Math.sin(-a + Math.PI / 2) * crank;
    const [d0, d1, d2] = parts.driverX;
    for (const r of parts.rods) {
      r.coupling.position.set(d1 + pinX, R + pinY, r.side * 1.27);
      const mx = d2 + pinX;
      const my = R + pinY;
      const L = 0.6;
      const cx = mx + Math.sqrt(Math.max(0.01, L * L - (my - 1.05) ** 2));
      r.crosshead.position.x = cx;
      r.piston.position.x = (cx + 4.0) / 2;
      r.piston.scale.y = Math.max(0.05, 4.0 - cx);
      r.main.position.set((mx + cx) / 2, (my + 1.05) / 2, r.side * 1.35);
      r.main.rotation.z = Math.atan2(1.05 - my, cx - mx);
      r.main.scale.x = Math.hypot(cx - mx, 1.05 - my);
    }
    void d0;

    // plasma flicker on lights and node glows
    const flick = 0.85 + Math.sin(t * 13) * 0.08 + Math.sin(t * 31) * 0.05;
    for (const l of plasmaLights) l.intensity = 2.4 * flick;
    for (const g of parts.glows) g.sprite.material.opacity = (g.bright ? 1 : 0.75) * (g.color ? 0.9 : flick);

    // arcs
    for (const arc of arcs) {
      if (arc.life > 0) {
        arc.life -= dt;
        const on = arc.life > 0;
        arc.core.visible = arc.glow.visible = on;
        if (on && Math.random() < 0.35) makeArc(arc);
      } else {
        arc.core.visible = arc.glow.visible = false;
        arc.rest -= dt;
        if (arc.rest <= 0 && !reducedMotion) {
          makeArc(arc);
          arc.core.visible = arc.glow.visible = true;
        }
      }
    }

    // motes ride a slow helix around the boiler and cab
    for (let i = 0; i < moteCount; i++) {
      const sd = moteSeed[i];
      const u = ((sd * 0.137 + t * 0.06) % 1 + 1) % 1;
      const ang = sd + t * (0.6 + (sd % 1) * 0.6);
      const rad = 1.25 + (sd % 0.7);
      motePos[i * 3] = -6 + u * 11.5;
      motePos[i * 3 + 1] = 2.4 + Math.cos(ang) * rad * 0.9;
      motePos[i * 3 + 2] = Math.sin(ang) * rad;
    }
    moteGeo.attributes.position.needsUpdate = true;

    // steam
    for (const s of puffs) {
      s.userData.age += dt;
      if (s.userData.age > 4) s.userData.age -= 4;
      const k = s.userData.age / 4;
      s.position.set(parts.stackTop.x - k * 4.5, parts.stackTop.y + k * 3.2 + Math.sin(k * 6 + s.id) * 0.1, Math.sin(s.id * 1.7) * 0.4 * k);
      s.scale.setScalar(0.5 + k * 2.6);
      s.material.opacity = Math.sin(Math.min(1, k * 1.15) * Math.PI) * 0.22;
    }

    renderer.render(scene, camera);
  };
  frame();

  return {
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
      mirror.getRenderTarget?.().dispose();
      Object.values(tex).forEach((x) => x.dispose());
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      // Hand the WebGL context back now rather than whenever the browser gets round to it: the Hall
      // of Legends builds a new viewer for every machine looked at, and a page only gets so many.
      try {
        renderer.forceContextLoss();
      } catch {
        // Not every browser has the extension; the context is then freed with the canvas.
      }
      canvas.remove();
    },
  };
}
