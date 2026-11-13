// The 3D race scene, ported from Iron Rail Duel and bent along the course: PS1-style low-res
// rendering with wobbling vertices, streamed countryside, steam locomotives (and a few mythic
// ones), weapon and spell effects. It only draws; the race engine (src/game/race.js) decides
// everything. Each frame it reads the race and drains race.fx.
import * as THREE from 'three';
import { sfx } from './sfx.js';
import { elevationAt } from '../game/course.js';
import { B } from '../game/balance.js';
import { BOSS_LIVERY, CREATURES, buildCreature } from './BossModels.js';

const UNITS_PER_MILE = 110;
const CH = 120; // terrain chunk length
const LANE = 9; // distance between tracks
const PIECE = 4; // track is laid in 4-unit pieces so it can follow the bends
const RAMP = 18; // units over which a bend eases in and out
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sstep = (a, b, t) => {
  const k = clamp((t - a) / (b - a), 0, 1);
  return k * k * (3 - 2 * k);
};
function mulberry(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Paint schemes. The player is the Crimson Comet unless driving a mythic engine.
export const LIVERY = {
  player: { body: 0xa3242c, trim: 0xd8b04a, wheel: 0xb8322a, lamp: 0xfff2a8, win: 0xffd98a, css: '#e0433c' },
  phoenix: { body: 0xc2410c, trim: 0xffc94a, wheel: 0x8a2a0a, lamp: 0xffe08a, win: 0xffb347, css: '#ff8a2a' },
  dragon: { body: 0x6e1414, trim: 0xe0a030, wheel: 0x2a0c0c, lamp: 0xff7a1a, win: 0xff9a3a, css: '#ff5a3a' },
  wizard: { body: 0x2b1f5c, trim: 0x9ad7ff, wheel: 0x1c1440, lamp: 0xc8b6ff, win: 0x9ad7ff, css: '#a98bff' },
  titan: { body: 0x5d5a52, trim: 0xc08a3e, wheel: 0x3a3833, lamp: 0xffe2a0, win: 0xffd27a, css: '#d9a35a' },
  bullet: { body: 0x2a3244, trim: 0x55c7e8, wheel: 0x343a46, lamp: 0x8bffd0, win: 0x8bffd0, css: '#55c7e8' },
  tank: { body: 0x3f4f2c, trim: 0xb9a35a, wheel: 0x2f3a22, lamp: 0xfff2a8, win: 0xe8d890, css: '#9cc06a' },
  stable: { body: 0x4b2a6e, trim: 0xd7b3ff, wheel: 0x352048, lamp: 0xe9d6ff, win: 0xd7b3ff, css: '#b98af0' },
  longrun: { body: 0x1f5a56, trim: 0x9fe3d4, wheel: 0x1a3e3b, lamp: 0xc8fff2, win: 0x9fe3d4, css: '#5fd3bd' },
  scrappy: { body: 0x6b4a2e, trim: 0xc9a27a, wheel: 0x4a3420, lamp: 0xffe2b0, win: 0xffd29a, css: '#d29a5f' },
  benchmark: { body: 0x5a616c, trim: 0xf2f2f2, wheel: 0x3a3f47, lamp: 0xffffff, win: 0xdfe8ff, css: '#e8edf5' },
  // The newer legendary machines.
  marauder: { body: 0x3b2a24, trim: 0xc8502a, wheel: 0x221814, lamp: 0xffb060, win: 0xff8a3a, css: '#e0703a' },
  glacier: { body: 0xd7ecf7, trim: 0x6fc4ee, wheel: 0x7fa6bd, lamp: 0xe6fbff, win: 0x9fe6ff, css: '#8fd8ff' },
  sandshark: { body: 0xb08a52, trim: 0x5e4526, wheel: 0x6e5532, lamp: 0xffe2a0, win: 0xffc860, css: '#e0b060' },
  graviton: { body: 0x14101f, trim: 0x9b6bff, wheel: 0x0c0a14, lamp: 0xd7c2ff, win: 0xb48cff, css: '#b48cff' },
  // Boss war-trains.
  ...BOSS_LIVERY,
};
const OWN_LOOK = ['phoenix', 'dragon', 'wizard', 'titan', 'marauder', 'glacier', 'sandshark', 'graviton'];
export const liveryFor = (train) => {
  if (train.isBoss && CREATURES[train.model]) return { css: CREATURES[train.model].css };
  return train.isPlayer && !OWN_LOOK.includes(train.model) ? LIVERY.player : LIVERY[train.model] ?? LIVERY.bullet;
};

// ---------- the path the line follows ----------
// s runs along the centre line in world units; u is the sideways offset (positive to the right).
// Bends are eased in and out so nothing kinks. Far from the tracks, the inside of a bend is
// squeezed so the ground never folds over itself.
class Path {
  constructor(course, distanceMiles) {
    this.length = Math.ceil((distanceMiles + 3) * UNITS_PER_MILE);
    const n = this.length + 1;
    this.x = new Float32Array(n);
    this.z = new Float32Array(n);
    this.h = new Float32Array(n);
    this.k = new Float32Array(n);
    // Height of the line, from the course's hills, exaggerated a little so the climbs read on screen.
    this.y = new Float32Array(n);
    const lift = UNITS_PER_MILE * (B.TRACK.sceneLift ?? 3);
    for (let i = 0; i < n; i++) this.y[i] = elevationAt(course, i / UNITS_PER_MILE) * lift;
    // Round off the crests and dips: three box-blur passes make a smooth, bell-shaped easing, so
    // a climb starts and ends gradually instead of with a kink.
    const R = 24;
    let src = this.y;
    for (let pass = 0; pass < 3; pass++) {
      const out = new Float32Array(n);
      let sum = 0;
      for (let j = -R; j <= R; j++) sum += src[clamp(j, 0, n - 1)];
      for (let i = 0; i < n; i++) {
        out[i] = sum / (2 * R + 1);
        sum += src[clamp(i + R + 1, 0, n - 1)] - src[clamp(i - R, 0, n - 1)];
      }
      src = out;
    }
    this.y = src;
    const bends = (course?.bends ?? []).map((b) => {
      const s0 = b.start * UNITS_PER_MILE;
      const s1 = b.end * UNITS_PER_MILE;
      const ramp = Math.min(RAMP, (s1 - s0) / 3);
      // Curvature that turns the bend's full angle once the easing is allowed for.
      return { s0, s1, ramp, k: (b.dir * b.turn) / (s1 - s0 - ramp) };
    });
    let bi = 0;
    let x = 0;
    let z = 0;
    let h = 0;
    for (let s = 0; s < n; s++) {
      while (bi < bends.length && bends[bi].s1 < s) bi++;
      let k = 0;
      const b = bends[bi];
      if (b && s >= b.s0 && s <= b.s1) k = b.k * Math.min(sstep(b.s0, b.s0 + b.ramp, s), 1 - sstep(b.s1 - b.ramp, b.s1, s));
      this.x[s] = x;
      this.z[s] = z;
      this.h[s] = h;
      this.k[s] = k;
      h += k;
      x += Math.sin(h);
      z += Math.cos(h);
    }
  }
  elev(s) {
    if (s <= 0) return 0;
    if (s >= this.length) return this.y[this.length];
    const i = Math.floor(s);
    return this.y[i] + (this.y[i + 1] - this.y[i]) * (s - i);
  }
  // Rise over run of the line here, in scene units.
  slope(s) {
    return (this.elev(s + 2) - this.elev(s - 2)) / 4;
  }
  sample(s) {
    if (s <= 0) return { x: 0, z: s, h: 0, k: 0 };
    if (s >= this.length) {
      const h = this.h[this.length];
      const d = s - this.length;
      return { x: this.x[this.length] + Math.sin(h) * d, z: this.z[this.length] + Math.cos(h) * d, h, k: 0 };
    }
    const i = Math.floor(s);
    const f = s - i;
    return {
      x: this.x[i] + (this.x[i + 1] - this.x[i]) * f,
      z: this.z[i] + (this.z[i + 1] - this.z[i]) * f,
      h: this.h[i] + (this.h[i + 1] - this.h[i]) * f,
      k: this.k[i],
    };
  }
  // World position of (u, s), with the squeeze beyond `keep` on the inside of a bend.
  toWorld(u, s, keep = 40) {
    const p = this.sample(s);
    let w = u;
    const inside = p.k * u > 0 && Math.abs(u) > keep;
    if (inside) {
      const room = Math.max(keep + 4, 0.92 / Math.abs(p.k)) - keep;
      w = Math.sign(u) * (keep + room * Math.tanh((Math.abs(u) - keep) / room));
    }
    // The normal points right of the direction of travel.
    return { x: p.x + Math.cos(p.h) * w, z: p.z - Math.sin(p.h) * w, y: this.elev(s), h: p.h, k: p.k };
  }
}

// ---------- textures ----------
function radialTex(stops, size = 64) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => g.addColorStop(o, col));
  x.fillStyle = g;
  x.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}
function makeTextures() {
  const cloud = (() => {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 64;
    const x = c.getContext('2d');
    for (let i = 0; i < 9; i++) {
      const cx = 20 + i * 11 + Math.random() * 6;
      const cy = 36 + Math.random() * 8 - (i > 2 && i < 7 ? 8 : 0);
      const r = 14 + Math.random() * 10;
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.7, 'rgba(250,252,255,0.9)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g;
      x.fillRect(0, 0, 128, 64);
    }
    return new THREE.CanvasTexture(c);
  })();
  const checker = (() => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 8;
    const x = c.getContext('2d');
    for (let i = 0; i < 16; i++)
      for (let j = 0; j < 2; j++) {
        x.fillStyle = (i + j) % 2 ? '#111' : '#f4f4f4';
        x.fillRect(i * 4, j * 4, 4, 4);
      }
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter;
    t.wrapS = THREE.RepeatWrapping;
    return t;
  })();
  return {
    smoke: radialTex([[0, 'rgba(255,255,255,0.95)'], [0.5, 'rgba(235,235,240,0.6)'], [1, 'rgba(220,220,230,0)']]),
    fire: radialTex([[0, 'rgba(255,255,240,1)'], [0.25, 'rgba(255,220,90,1)'], [0.55, 'rgba(255,110,20,0.8)'], [1, 'rgba(200,30,0,0)']]),
    spark: radialTex([[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(190,225,255,0.9)'], [1, 'rgba(90,140,255,0)']], 32),
    ball: radialTex([[0, 'rgba(90,90,96,1)'], [0.55, 'rgba(40,40,46,1)'], [0.7, 'rgba(20,20,24,0.9)'], [1, 'rgba(0,0,0,0)']], 32),
    cloud,
    checker,
  };
}

// ---------- terrain noise ----------
function hash(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x, z) {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi);
  const b = hash(xi + 1, zi);
  const c = hash(xi, zi + 1);
  const d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, z) => vnoise(x, z) * 0.6 + vnoise(x * 2.1, z * 2.1) * 0.3 + vnoise(x * 4.3, z * 4.3) * 0.1;
const PAL = {
  grass: [0.34, 0.56, 0.25],
  grass2: [0.29, 0.5, 0.21],
  dark: [0.21, 0.39, 0.19],
  rock: [0.56, 0.48, 0.35],
  rock2: [0.46, 0.39, 0.3],
  sand: [0.66, 0.6, 0.43],
  dirt: [0.45, 0.37, 0.25],
};

// Each terrain's palette, sky and trees.
const LOOKS = {
  plains: { horizon: 0xa8cbec, top: 0x1a3aa4, plain: 0x8f9a5c, mount: [0x6f8fa3, 0x7f9bab, 0x5f8094, 0x8aa6b2], pine: [0x2f6a34, 0x3e7d3a], round: 0x4f8c3c, water: 0x3b78c2, river: true, trees: 52, pal: PAL, fog: [150, 560] },
  flooded: {
    horizon: 0xb4c4cc, top: 0x3a5a8a, plain: 0x6f7d58, mount: [0x7b8c96, 0x8a99a2, 0x6a7c88, 0x95a3ab], pine: [0x2f5a34, 0x3a6a3a], round: 0x4a7a3c, water: 0x5f8396, river: true, trees: 34,
    pal: { grass: [0.3, 0.46, 0.24], grass2: [0.27, 0.42, 0.21], dark: [0.2, 0.33, 0.18], rock: [0.5, 0.46, 0.38], rock2: [0.42, 0.38, 0.31], sand: [0.42, 0.38, 0.28], dirt: [0.36, 0.3, 0.22] },
    fog: [120, 480],
  },
  desert: {
    horizon: 0xf2d9a8, top: 0x2f6fc4, plain: 0xc8a065, mount: [0xb8744a, 0xc98a58, 0xa8643e, 0xd49a68], pine: [0x5f7a3a, 0x6e8a44], round: 0x7a8a48, water: 0xc8a46a, river: false, trees: 12,
    pal: { grass: [0.82, 0.66, 0.42], grass2: [0.78, 0.6, 0.38], dark: [0.7, 0.48, 0.3], rock: [0.72, 0.42, 0.26], rock2: [0.62, 0.36, 0.22], sand: [0.86, 0.72, 0.48], dirt: [0.7, 0.54, 0.34] },
    fog: [180, 620],
  },
  snow: {
    horizon: 0xdbe6f0, top: 0x5a7ab0, plain: 0xe6edf3, mount: [0xdfe7ef, 0xc9d4e0, 0xeef3f8, 0xb8c6d4], pine: [0x24503a, 0x2c5e44], round: 0x3a6a50, water: 0xbcd8ea, river: true, trees: 44,
    pal: { grass: [0.92, 0.94, 0.97], grass2: [0.86, 0.89, 0.94], dark: [0.74, 0.79, 0.86], rock: [0.55, 0.57, 0.62], rock2: [0.46, 0.48, 0.54], sand: [0.8, 0.86, 0.92], dirt: [0.62, 0.62, 0.64] },
    fog: [110, 460],
  },
};

export class RailScene {
  /**
   * @param {object} opts
   * @param {HTMLCanvasElement} opts.canvas
   * @param {HTMLElement} opts.host       element the canvas fills (for size)
   * @param {HTMLElement} opts.nums       layer for floating damage numbers
   * @param {HTMLElement} opts.flash      white flash layer for lightning
   * @param {object} opts.race            the engine's race object
   */
  constructor({ canvas, host, nums, flash, race }) {
    this.canvas = canvas;
    this.host = host;
    this.numsEl = nums;
    this.flashEl = flash;
    this.race = race;
    this.reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    // Smooth rendering only: the old PS1 pixel mode is gone.
    this.pixelMode = false;
    // Helicopter hovers close above your engine; bird's-eye is far out over the whole field. Both
    // can be dragged round (and pinched or scrolled in and out) to look behind or ahead.
    this.camModes = ['chase', 'helicopter', 'birdseye', 'side', 'front'];
    this.view = { yaw: 0, pitch: 0, zoom: 1 };
    // Sighting cinematics: slow time, fly down the line to what the lookout just spotted.
    this.cine = null;
    this.timeFactor = 1;
    try {
      this.cineOn = window.localStorage.getItem('nexus-rails/cine') !== 'off';
    } catch {
      this.cineOn = true;
    }
    this.camMode = 0;
    this.shake = 0;
    this.flash = 0;
    this.orbit = 0;
    this.chuffAcc = 0;
    this.time = 0;
    this.parts = [];
    this.nums = [];
    this.shotFx = new Map(); // shot id -> visuals
    this.strikes = []; // lightning bolts still crackling
    this.chunks = new Map();
    this.v3 = new THREE.Vector3();
    this.path = new Path(race.course, race.distance);

    // One track per train, side by side. A boss creature flies (or burrows) beside the line instead.
    const onRails = race.trains.map((t) => !(t.isBoss && CREATURES[t.model]));
    const n = onRails.filter(Boolean).length;
    this.halfTracks = ((n - 1) / 2) * LANE;
    this.flat = Math.max(20, this.halfTracks + 12);
    this.keep = this.flat + 18;
    let lane = 0;
    this.trainX = race.trains.map((t, i) => (onRails[i] ? (lane++ - (n - 1) / 2) * LANE : this.halfTracks + (CREATURES[t.model]?.side ?? 13)));
    this.laneX = this.trainX.filter((_, i) => onRails[i]);

    // Terrain: plains, flooded plains, desert or a frozen pass.
    this.theme = LOOKS[race.course?.theme] ? race.course.theme : 'plains';
    this.look = LOOKS[this.theme];
    this.pal = this.look.pal;
    this.floods = (race.course?.water ?? []).map((w) => [w.start * UNITS_PER_MILE, w.end * UNITS_PER_MILE]);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    const horizon = new THREE.Color(this.look.horizon);
    this.renderer.setClearColor(horizon);
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(horizon, this.look.fog[0], this.look.fog[1]);
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.5, 14000);
    this.fogNear = this.look.fog[0];
    this.fogFar = this.look.fog[1];
    this.snap = { on: { value: this.pixelMode ? 1 : 0 }, res: { value: new THREE.Vector2(160, 120) } };
    this.TEX = makeTextures();

    this.buildWorld(horizon);
    this.buildShared();
    this.trains = race.trains.map((train, i) => this.makeTrain(train, i));
    this.buildTags();
    this.rocks = race.obstacles.map((rock) => this.makeRock(rock));
    this.falling = []; // rocks a boss has just thrown onto the line
    this.bossVis = this.trains.find((t) => t.train.isBoss) ?? null;
    this.buildFinish();
    this.buildMap();

    this.camOff = new THREE.Vector3(30, 12, 20);
    this.camLook = new THREE.Vector3(0, 2.5, -4);
    this.camHeading = 0;
    this.resize();
    for (let i = 0; i < 8; i++) this.updateChunks(0);
    this.onResize = () => this.resize();
    window.addEventListener('resize', this.onResize);
    this.bindDrag();
  }

  // Drag (mouse or one finger) to swing the overhead cameras round; pinch or scroll to zoom.
  bindDrag() {
    const el = this.canvas;
    const pts = new Map();
    let pinch = null;
    const orbitable = () => ['helicopter', 'birdseye'].includes(this.camModes[this.camMode]);
    const down = (e) => {
      if (!orbitable()) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      el.setPointerCapture?.(e.pointerId);
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.view.zoom };
      }
    };
    const move = (e) => {
      const p = pts.get(e.pointerId);
      if (!p || !orbitable()) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (pts.size >= 2 && pinch) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        this.view.zoom = clamp((pinch.zoom * pinch.d) / Math.max(20, d), 0.45, 2.2);
        return;
      }
      this.view.yaw -= dx * 0.008;
      this.view.pitch = clamp(this.view.pitch + dy * 0.005, -0.6, 0.6);
    };
    const up = (e) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
    };
    const wheel = (e) => {
      if (!orbitable()) return;
      e.preventDefault();
      this.view.zoom = clamp(this.view.zoom * Math.exp(e.deltaY * 0.001), 0.45, 2.2);
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });
    this.unbindDrag = () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('wheel', wheel);
    };
  }

  // Jump straight to a named camera (the camera lesson's "Try it" button).
  setCamera(mode) {
    const i = this.camModes.indexOf(mode);
    if (i < 0) return null;
    this.camMode = i;
    this.resetView();
    this.heliMid = undefined;
    this.heliAlt = undefined;
    return mode;
  }

  // Back to the default angle for this camera.
  resetView() {
    this.view = { yaw: 0, pitch: 0, zoom: 1 };
  }

  // ---------- materials ----------
  ps1(material) {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uSnapOn = this.snap.on;
      shader.uniforms.uSnapRes = this.snap.res;
      shader.vertexShader =
        'uniform float uSnapOn;\nuniform vec2 uSnapRes;\n' +
        shader.vertexShader.replace(
          '#include <project_vertex>',
          '#include <project_vertex>\nif(uSnapOn>0.5 && gl_Position.w>0.0){vec4 sp=gl_Position;sp.xy=floor(sp.xy/sp.w*uSnapRes+0.5)/uSnapRes*sp.w;gl_Position=sp;}',
        );
    };
    return material;
  }
  lam(color, extra = {}) {
    return this.ps1(new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra }));
  }
  glow(color) {
    return new THREE.MeshBasicMaterial({ color });
  }

  resize() {
    const w = this.host.clientWidth || window.innerWidth;
    const h = this.host.clientHeight || window.innerHeight;
    let iw;
    let ih;
    const d = Math.min(window.devicePixelRatio || 1, 2);
    iw = Math.round(w * d);
    ih = Math.round(h * d);
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(iw, ih, false);
    this.snap.res.value.set(iw / 3, ih / 3);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  cycleCamera() {
    this.camMode = (this.camMode + 1) % this.camModes.length;
    this.resetView();
    this.heliMid = undefined;
    this.heliAlt = undefined;
    return this.camModes[this.camMode];
  }

  // Place an object at (u, s), facing along the line, `y` above the ground.
  place(obj, u, s, y = 0, yaw = 0) {
    const p = this.path.toWorld(u, s, this.keep);
    obj.position.set(p.x, y + p.y, p.z);
    obj.rotation.y = p.h + yaw;
    return p;
  }

  // ---------- world ----------
  buildWorld(horizon) {
    const { scene } = this;
    scene.add(new THREE.HemisphereLight(0xc6dcff, 0x4d5a2c, 0.75));
    const sun = new THREE.DirectionalLight(0xfff1d6, 0.95);
    sun.position.set(-60, 100, 40);
    scene.add(sun);
    this.flashLights = [];
    for (let i = 0; i < 3; i++) {
      const light = new THREE.PointLight(0xffaa55, 0, 45, 2);
      light.userData.t = 0;
      scene.add(light);
      this.flashLights.push(light);
    }

    const skyGeo = new THREE.SphereGeometry(1400, 24, 12);
    const top = new THREE.Color(this.look.top);
    const cols = [];
    const p = skyGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) / 1400;
      const c = y > 0 ? horizon.clone().lerp(top, Math.pow(y, 0.55)) : horizon.clone();
      cols.push(c.r, c.g, c.b);
    }
    skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    this.sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    scene.add(this.sky);

    this.mountains = new THREE.Group();
    scene.add(this.mountains);
    const mats = this.look.mount.map((c) => this.lam(c, { fog: false }));
    const r = mulberry(7);
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2 + r() * 0.08;
      const h = 120 + r() * 200;
      const rad = 90 + r() * 110;
      const m = new THREE.Mesh(new THREE.ConeGeometry(rad, h, 5 + Math.floor(r() * 3)), mats[i % 4]);
      const d = 950 + r() * 150;
      m.position.set(Math.cos(a) * d, h / 2 - 30, Math.sin(a) * d);
      m.rotation.y = r() * 3;
      this.mountains.add(m);
    }

    // A wide plain under everything, so the high cameras never see past the edge of the land.
    this.plain = new THREE.Mesh(new THREE.CircleGeometry(9000, 48), new THREE.MeshLambertMaterial({ color: this.look.plain }));
    this.plain.rotation.x = -Math.PI / 2;
    scene.add(this.plain);

    this.clouds = [];
    for (let i = 0; i < 16; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.TEX.cloud, fog: false, transparent: true, depthWrite: false, opacity: 0.92 }));
      s.scale.set(rand(140, 260), rand(50, 90), 1);
      s.userData.off = new THREE.Vector3(rand(-700, 700), rand(170, 300), rand(-200, 1100));
      scene.add(s);
      this.clouds.push(s);
    }
  }

  riverAt(s) {
    return -(this.flat + 85) + Math.sin(s * 0.006) * 22;
  }

  // 0 outside a flood, rising to 1 within 50 units of its edges.
  floodAt(s) {
    let f = 0;
    for (const [a, b] of this.floods) f = Math.max(f, Math.min(sstep(a - 50, a, s), 1 - sstep(b, b + 50, s)));
    return f;
  }

  heightAt(u, s) {
    const f = this.floods.length ? this.floodAt(s) : 0;
    const dry = this.dryHeight(u, s);
    // Floodwater: the land sinks just under the water line, so only the train shows above it.
    if (f > 0) return dry * (1 - f) + Math.min(dry, -0.4 - vnoise(u * 0.05, s * 0.05) * 0.8) * f;
    return dry;
  }

  dryHeight(u, s) {
    const F = this.flat;
    const ax = Math.abs(u);
    if (ax <= F) return 0;
    let h = (fbm(u * 0.011, s * 0.011) * 20 - 3) * sstep(F, F + 32, ax);
    const cliff = F + 40;
    if (u > cliff) h += sstep(cliff, cliff + 110, u) * 60 * (0.55 + 0.45 * vnoise(u * 0.018, s * 0.014));
    const d = this.look.river ? Math.abs(u - this.riverAt(s)) : 99;
    if (d < 42) {
      const k = sstep(12, 42, d);
      h = h * k - 7 * (1 - k);
    }
    if (u < -(F + 130)) h += sstep(F + 130, F + 250, -u) * 48 * (0.6 + 0.4 * vnoise(u * 0.02, s * 0.02));
    return h;
  }

  groundColor(u, y, s, slope) {
    const P = this.pal;
    let c;
    if (y < -2.2) c = P.sand;
    else if (this.floods.length && this.floodAt(s) > 0.5) c = hash(u, s) > 0.5 ? P.dirt : P.sand; // mud under the water
    else if (Math.abs(u) < this.flat + 1) c = hash(u, s) > 0.5 ? P.dirt : P.grass2;
    else if (slope > 9 || y > 30) c = hash(u * 0.3, s) > 0.5 ? P.rock : P.rock2;
    else if (y > 13) c = this.theme === 'snow' ? P.grass : P.dark;
    else c = hash(u * 0.7, s * 1.3) > 0.45 ? P.grass : P.grass2;
    const j = 0.93 + hash(s, u) * 0.12;
    return [c[0] * j, c[1] * j, c[2] * j];
  }

  buildShared() {
    const roof = (() => {
      const s = new THREE.Shape();
      s.moveTo(-3.6, 0);
      s.lineTo(3.6, 0);
      s.lineTo(0, 2.8);
      s.lineTo(-3.6, 0);
      const g = new THREE.ExtrudeGeometry(s, { depth: 6, bevelEnabled: false });
      g.translate(0, 0, -3);
      return g;
    })();
    this.G = {
      trunk: new THREE.CylinderGeometry(0.35, 0.5, 2.4, 5),
      pine: new THREE.ConeGeometry(2.4, 6.5, 6),
      round: new THREE.DodecahedronGeometry(2.4, 0),
      rock: new THREE.DodecahedronGeometry(1.7, 0),
      sleeper: new THREE.BoxGeometry(3, 0.18, 0.5),
      rail: new THREE.BoxGeometry(0.16, 0.22, PIECE + 0.12),
      ballast: new THREE.BoxGeometry(3.9, 0.3, PIECE + 0.12),
      pole: new THREE.CylinderGeometry(0.12, 0.16, 7, 4),
      arm: new THREE.BoxGeometry(2.2, 0.15, 0.15),
      house: new THREE.BoxGeometry(6, 4, 5),
      beam: new THREE.BoxGeometry(0.1, 4, 5.04),
      roof,
      chimney: new THREE.BoxGeometry(0.7, 2, 0.7),
      milepost: new THREE.BoxGeometry(0.4, 2.2, 0.4),
      mileSign: new THREE.BoxGeometry(1.6, 0.9, 0.12),
      boulder: new THREE.DodecahedronGeometry(1.6, 0),
    };
    this.M = {
      trunk: this.lam(0x6b4a2c),
      pine: this.lam(this.look.pine[0]),
      pine2: this.lam(this.look.pine[1]),
      round: this.lam(this.look.round),
      rock: this.lam(0x8a8072),
      boulder: this.lam(0x7d7366),
      sleeper: this.lam(0x5a4632),
      rail: this.lam(0x9aa0a8),
      ballast: this.lam(0x6f6a62),
      pole: this.lam(0x5b4630),
      wall: this.lam(0xd9caa0),
      timber: this.lam(0x5c3d26),
      roofs: [this.lam(0x3d5ea8), this.lam(0xa8413a), this.lam(0x4f7a8c)],
      wire: new THREE.LineBasicMaterial({ color: 0x2a2a2a }),
      ground: this.lam(0xffffff, { vertexColors: true }),
      water: this.lam(this.look.water, { transparent: true, opacity: this.theme === 'snow' ? 1 : 0.9 }),
      flood: this.lam(0x3f6b70, { transparent: true, opacity: 0.74 }),
      sign: this.lam(0xf2efe2),
    };
  }

  // A strip of ground, bent along the line: u from u0 to u1, s across one chunk.
  bentStrip(u0, u1, segU, s0, segS, heightFn, colorFn) {
    const g = new THREE.PlaneGeometry(1, 1, segU, segS);
    const p = g.attributes.position;
    const local = [];
    for (let k = 0; k < p.count; k++) {
      // PlaneGeometry spans -0.5..0.5; map x to u and y to s (y up the plane is +s).
      const u = u0 + (p.getX(k) + 0.5) * (u1 - u0);
      const s = s0 + (p.getY(k) + 0.5) * CH;
      const w = this.path.toWorld(u, s, this.keep);
      p.setXYZ(k, w.x, heightFn(u, s) + w.y, w.z);
      local.push([u, s]);
    }
    // PlaneGeometry faces +z; bent onto the xz plane its winding must face up.
    const index = g.index.array;
    for (let i = 0; i < index.length; i += 3) {
      const t = index[i + 1];
      index[i + 1] = index[i + 2];
      index[i + 2] = t;
    }
    const ng = g.toNonIndexed();
    g.dispose();
    if (colorFn) {
      const np = ng.attributes.position;
      const col = new Float32Array(np.count * 3);
      // Recover u and s per triangle from its first vertex through the index order.
      const order = Array.from(index);
      for (let t = 0; t < np.count; t += 3) {
        const ys = [np.getY(t), np.getY(t + 1), np.getY(t + 2)];
        const [ua, sa] = local[order[t]];
        const [ub, sb] = local[order[t + 1]];
        const [uc, sc] = local[order[t + 2]];
        const c = colorFn((ua + ub + uc) / 3, (ys[0] + ys[1] + ys[2]) / 3, (sa + sb + sc) / 3, Math.max(...ys) - Math.min(...ys));
        for (let v = 0; v < 3; v++) col.set(c, (t + v) * 3);
      }
      ng.setAttribute('color', new THREE.BufferAttribute(col, 3));
    }
    ng.computeVertexNormals();
    return ng;
  }

  makeChunk(i) {
    const { G, M } = this;
    const grp = new THREE.Group();
    const own = [];
    const z0 = i * CH;
    const r = mulberry(i * 9973 + 17);
    // ground
    const ground = this.bentStrip(-280, 280, 28, z0, 10, (u, s) => this.heightAt(u, s), (u, y, s, slope) => this.groundColor(u, y, s, slope));
    grp.add(new THREE.Mesh(ground, M.ground));
    own.push(ground);
    // the river, wherever it winds (a dry wash in the desert)
    if (this.look.river) {
      const rc = this.riverAt(z0 + CH / 2);
      const water = this.bentStrip(rc - 40, rc + 40, 4, z0, 6, () => -2.8, null);
      grp.add(new THREE.Mesh(water, M.water));
      own.push(water);
    }
    // floodwater over the track: deep enough to cover the rails, not the train
    if (this.floods.some(([a, b]) => z0 + CH > a - 40 && z0 < b + 40)) {
      const flood = this.bentStrip(-280, 280, 10, z0, 6, () => 0.95, null);
      grp.add(new THREE.Mesh(flood, M.flood));
      own.push(flood);
    }
    // one track per train, laid in short pieces so it follows the bends
    const pieces = CH / PIECE;
    const lanes = this.laneX.length;
    const rails = new THREE.InstancedMesh(G.rail, M.rail, pieces * lanes * 2);
    const ballast = new THREE.InstancedMesh(G.ballast, M.ballast, pieces * lanes);
    const sleepers = new THREE.InstancedMesh(G.sleeper, M.sleeper, pieces * lanes);
    const obj = new THREE.Object3D();
    let ri = 0;
    let bi = 0;
    for (const tx of this.laneX) {
      for (let k = 0; k < pieces; k++) {
        const s = z0 + k * PIECE + PIECE / 2;
        const w = this.place(obj, tx, s, 0.15);
        // Pitch each piece to the grade so the pieces meet end to end instead of stepping.
        const grade = this.path.slope(s);
        obj.rotation.order = 'YXZ';
        obj.rotation.x = -Math.atan(grade);
        const stretch = Math.sqrt(1 + grade * grade);
        const squash = (1 - w.k * tx) * stretch;
        obj.scale.set(1, 1, squash);
        obj.updateMatrix();
        ballast.setMatrixAt(bi, obj.matrix);
        obj.scale.set(1, 1, 1);
        obj.position.y = 0.39 + w.y;
        obj.updateMatrix();
        sleepers.setMatrixAt(bi++, obj.matrix);
        for (const rx of [-0.75, 0.75]) {
          this.place(obj, tx + rx, s, 0.59);
          obj.scale.set(1, 1, (1 - w.k * (tx + rx)) * stretch);
          obj.updateMatrix();
          rails.setMatrixAt(ri++, obj.matrix);
        }
        obj.scale.set(1, 1, 1);
      }
    }
    grp.add(ballast, sleepers, rails);
    own.push(ballast, sleepers, rails);
    // telegraph poles and wires beside the outside track
    const px = -(this.halfTracks + 7.5);
    for (let s = 0; s < 4; s++) {
      const z = z0 + s * 30 + 15;
      const pole = new THREE.Mesh(G.pole, M.pole);
      this.place(pole, px, z, 3.5);
      grp.add(pole);
      const arm = new THREE.Mesh(G.arm, M.pole);
      this.place(arm, px, z, 6.6);
      grp.add(arm);
    }
    for (const wx of [px - 0.9, px + 0.9]) {
      const pts = [];
      for (let s = 0; s <= 8; s++) {
        const a = z0 - 15 + s * 15;
        const w = this.path.toWorld(wx, a, this.keep);
        pts.push(new THREE.Vector3(w.x, (s % 2 ? 6.2 : 6.7) + w.y, w.z));
      }
      const wg = new THREE.BufferGeometry().setFromPoints(pts);
      grp.add(new THREE.Line(wg, M.wire));
      own.push(wg);
    }
    // a mile post every mile, on the right
    const mile = Math.floor((z0 + CH) / UNITS_PER_MILE);
    const mz = mile * UNITS_PER_MILE;
    if (mile > 0 && mz >= z0 && mz < z0 + CH) {
      const post = new THREE.Mesh(G.milepost, M.timber);
      this.place(post, this.halfTracks + 4.5, mz, 1.1);
      grp.add(post);
      const sign = new THREE.Mesh(G.mileSign, M.sign);
      this.place(sign, this.halfTracks + 4.5, mz, 2.4);
      grp.add(sign);
    }
    // trees and rocks
    const trees = this.floods.length && this.floodAt(z0 + CH / 2) > 0.5 ? 10 : this.look.trees;
    for (let t = 0; t < trees; t++) {
      const u = (r() * 2 - 1) * 270;
      const s = z0 + r() * CH;
      if (Math.abs(u) < this.flat - 3) continue;
      const y = this.heightAt(u, s);
      if (y < -2.2) continue;
      const sc = 0.75 + r() * 0.9;
      const kind = r();
      const w = this.path.toWorld(u, s, this.keep);
      if (kind < 0.12) {
        const rk = new THREE.Mesh(G.rock, M.rock);
        rk.position.set(w.x, y + 0.4 + w.y, w.z);
        rk.scale.setScalar(sc * 1.2);
        rk.rotation.set(r() * 3, r() * 3, 0);
        grp.add(rk);
        continue;
      }
      const tr = new THREE.Mesh(G.trunk, M.trunk);
      tr.position.set(w.x, y + 1.2 * sc + w.y, w.z);
      tr.scale.setScalar(sc);
      grp.add(tr);
      const top = kind < 0.62 ? new THREE.Mesh(G.pine, r() > 0.5 ? M.pine : M.pine2) : new THREE.Mesh(G.round, M.round);
      top.position.set(w.x, y + (kind < 0.62 ? 5.3 : 4.4) * sc + w.y, w.z);
      top.scale.setScalar(sc);
      top.rotation.y = r() * 3;
      grp.add(top);
    }
    // an occasional farmhouse
    if (r() < (this.theme === 'plains' || this.theme === 'flooded' ? 0.38 : 0.12) && i > 0) {
      const side = r() > 0.5 ? 1 : -1;
      const u = side * (this.flat + 6 + r() * 14);
      const s = z0 + 20 + r() * 80;
      const y = this.heightAt(u, s);
      if (y > -1 && !(this.floods.length && this.floodAt(s) > 0.05)) {
        const h = new THREE.Group();
        this.place(h, u, s, y, r() * 0.6 - 0.3);
        const body = new THREE.Mesh(G.house, M.wall);
        body.position.y = 2;
        h.add(body);
        for (const bx of [-3.02, 3.02]) {
          const beam = new THREE.Mesh(G.beam, M.timber);
          beam.position.set(bx, 2, 0);
          h.add(beam);
        }
        const roofMesh = new THREE.Mesh(G.roof, M.roofs[Math.floor(r() * 3)]);
        roofMesh.position.y = 4;
        roofMesh.rotation.y = Math.PI / 2;
        h.add(roofMesh);
        const ch = new THREE.Mesh(G.chimney, M.timber);
        ch.position.set(1.6, 5.6, 1);
        h.add(ch);
        grp.add(h);
      }
    }
    this.scene.add(grp);
    return { grp, own };
  }

  updateChunks(z, behind = 160, ahead = 580, perFrame = 2) {
    const a = Math.floor((z - behind) / CH);
    const b = Math.floor((z + ahead) / CH);
    for (const [k, c] of this.chunks) {
      if (k < a || k > b) {
        this.scene.remove(c.grp);
        c.own.forEach((o) => o.dispose?.());
        this.chunks.delete(k);
      }
    }
    let made = 0;
    for (let k = a; k <= b; k++) {
      if (!this.chunks.has(k) && made < perFrame) {
        this.chunks.set(k, this.makeChunk(k));
        made++;
      }
    }
  }

  buildFinish() {
    const arch = new THREE.Group();
    const post = this.lam(0x7a1f1f);
    const half = this.halfTracks + 6.5;
    for (const x of [-half, half]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.8, 10, 0.8), post);
      p.position.set(x, 5, 0);
      arch.add(p);
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2, 3), this.lam(0xffd24a));
      f.position.set(x, 11, 0);
      arch.add(f);
    }
    this.TEX.checker.repeat.set((half * 2 + 1) / 23, 1);
    const ban = new THREE.Mesh(new THREE.BoxGeometry(half * 2 + 1, 2.2, 0.3), new THREE.MeshLambertMaterial({ map: this.TEX.checker }));
    ban.position.y = 9.4;
    arch.add(ban);
    this.place(arch, 0, this.race.distance * UNITS_PER_MILE, 0);
    this.scene.add(arch);
  }

  // ---------- trains ----------
  // Built as three cars (engine, tender, coach) so the train bends round the curves.
  makeTrain(train, index) {
    if (train.isBoss && CREATURES[train.model]) return this.makeCreature(train, index);
    const o = liveryFor(train);
    const cars = [new THREE.Group(), new THREE.Group(), new THREE.Group()];
    const centre = [0, -6.5, -14.2];
    const carFor = (z) => (z > -4 ? 0 : z > -9.6 ? 1 : 2);
    const wheels = [];
    const rods = [];
    const mBody = this.lam(o.body);
    const mTrim = this.lam(o.trim);
    const mDark = this.lam(0x1d1f25);
    const mWheel = this.lam(o.wheel);
    const mMetal = this.lam(0x737a84);
    const mCoal = this.lam(0x16161a);
    const mLamp = this.glow(o.lamp);
    const mWin = this.glow(o.win);
    const P = (geo, mat, x, y, z, car = carFor(z)) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z - centre[car]);
      cars[car].add(m);
      return m;
    };
    const cylZ = (r1, r2, l, s) => new THREE.CylinderGeometry(r1, r2, l, s).rotateX(Math.PI / 2);
    const model = train.model;
    P(new THREE.BoxGeometry(2.3, 0.5, 10.4), mDark, 0, 1.15, 0.3, 0);
    P(cylZ(1.05, 1.05, 6.4, 10), mBody, 0, 2.3, 1.6);
    for (const z of [-0.8, 0.9, 2.6, 4.3]) P(cylZ(1.1, 1.1, 0.22, 10), mTrim, 0, 2.3, z);
    P(cylZ(1.12, 1.12, 0.9, 10), mDark, 0, 2.3, 4.9);
    P(cylZ(0.78, 0.78, 0.12, 10), mTrim, 0, 2.3, 5.38);
    if (model !== 'wizard') {
      P(new THREE.CylinderGeometry(0.42, 0.32, 1.6, 8), mDark, 0, 4.0, 4.6);
      P(new THREE.CylinderGeometry(0.66, 0.42, 0.45, 8), mDark, 0, 4.9, 4.6);
    }
    P(new THREE.SphereGeometry(0.58, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), mTrim, 0, 3.3, 2.1);
    P(new THREE.CylinderGeometry(0.3, 0.36, 0.6, 8), mTrim, 0, 3.6, 0.4);
    P(new THREE.BoxGeometry(2.7, 2.5, 2.6), mBody, 0, 2.85, -2.5, 0);
    P(new THREE.BoxGeometry(3.1, 0.22, 3.2), mDark, 0, 4.2, -2.5, 0);
    for (const s of [-1, 1]) P(new THREE.BoxGeometry(0.06, 0.9, 1.3), mWin, s * 1.36, 3.3, -2.3, 0);
    P(new THREE.BoxGeometry(0.62, 0.5, 0.45), mDark, 0, 3.55, 5.0);
    P(new THREE.BoxGeometry(0.44, 0.34, 0.06), mLamp, 0, 3.55, 5.24);
    P(new THREE.BoxGeometry(2.6, 0.4, 0.3), mTrim, 0, 1.35, 5.55);
    this.makeFront(train.front ?? 'cowcatcher', P, mTrim, mDark);
    for (const s of [-1, 1]) P(cylZ(0.42, 0.42, 1.4, 8), mMetal, s * 1.35, 1.25, 4.0);
    const wGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.26, 12).rotateZ(Math.PI / 2);
    const swGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.22, 10).rotateZ(Math.PI / 2);
    const spoke = new THREE.BoxGeometry(0.3, 1.45, 0.2);
    const sspoke = new THREE.BoxGeometry(0.26, 0.9, 0.16);
    const wheel = (big, x, z, car) => {
      const w = P(big ? wGeo : swGeo, mWheel, x, big ? 0.8 : 0.5, z, car);
      w.userData.r = big ? 0.8 : 0.5;
      const a = new THREE.Mesh(big ? spoke : sspoke, mDark);
      const b = a.clone();
      b.rotation.x = Math.PI / 2;
      w.add(a, b);
      wheels.push(w);
    };
    for (const s of [-1, 1]) {
      for (const z of [-0.9, 0.9, 2.7]) wheel(true, s * 1.3, z, 0);
      wheel(false, s * 1.2, 4.5, 0);
      rods.push(P(new THREE.BoxGeometry(0.1, 0.16, 3.9), mMetal, s * 1.48, 0.8, 0.9, 0));
    }
    // tender
    P(new THREE.BoxGeometry(2.2, 0.4, 4.8), mDark, 0, 1.0, -6.5, 1);
    P(new THREE.BoxGeometry(2.6, 2.0, 4.6), mBody, 0, 2.2, -6.5, 1);
    P(new THREE.BoxGeometry(2.64, 0.2, 4.64), mTrim, 0, 2.7, -6.5, 1);
    P(new THREE.BoxGeometry(2.2, 0.5, 3.6), mCoal, 0, 3.35, -6.2, 1);
    for (const s of [-1, 1]) for (const z of [-8, -5]) wheel(false, s * 1.2, z, 1);
    // coach (stands in for the cargo)
    P(new THREE.BoxGeometry(2.2, 0.4, 9), mDark, 0, 1.0, -14.2, 2);
    P(new THREE.BoxGeometry(2.7, 2.5, 9), mBody, 0, 2.45, -14.2, 2);
    P(new THREE.BoxGeometry(2.74, 0.22, 9.04), mTrim, 0, 1.6, -14.2, 2);
    P(new THREE.BoxGeometry(2.95, 0.32, 9.4), mDark, 0, 3.85, -14.2, 2);
    for (const s of [-1, 1]) for (let k = 0; k < 4; k++) P(new THREE.BoxGeometry(0.06, 0.8, 1.2), mWin, s * 1.36, 2.9, -17.4 + k * 2.1, 2);
    for (const s of [-1, 1]) for (const z of [-11.2, -12.4, -16, -17.2]) wheel(false, s * 1.2, z, 2);
    const shadow = new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.3, depthWrite: false });
    [11, 5.6, 9.6].forEach((len, car) => {
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(3.6, len).rotateX(-Math.PI / 2), shadow);
      sh.position.set(0, -0.38, car === 0 ? 0.5 : 0);
      cars[car].add(sh);
    });

    const extras = { orb: null, mouth: null };
    this.decorate(model, P, cars, extras, { mBody, mTrim, mDark, mLamp });
    this.mountArms(train.arms ?? [], P, { mDark, mMetal, mTrim });

    // Wind Jet panels: folded flat against the tender, swung out into the wind when deployed.
    if (train.windMax > 0) {
      extras.windPanels = [];
      for (const side of [-1, 1]) {
        const pivot = new THREE.Group();
        const panel = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 3.2), mMetal);
        panel.position.set(side * 0.9, 0, 0);
        pivot.add(panel);
        const vane = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.2), this.glow(0x9fe8ff));
        vane.position.set(side * 0.9, 0.07, 1.4);
        pivot.add(vane);
        P(new THREE.BoxGeometry(0.1, 0.1, 0.1), mMetal, side * 1.45, 3.6, -15.8, 2).add(pivot);
        pivot.userData.side = side;
        extras.windPanels.push(pivot);
      }
    }
    const barrier = new THREE.Mesh(
      new THREE.SphereGeometry(1, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0x7cf5c9, wireframe: true, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    barrier.scale.set(3.4, 3.6, 13.5);
    barrier.position.set(0, 2.4, 0.5);
    barrier.visible = false;
    cars[1].add(barrier);
    if (model === 'titan') cars.forEach((car) => car.scale.set(1.3, 1.2, 1));
    if (model === 'bastion') cars.forEach((car) => car.scale.set(1.45, 1.35, 1));
    if (model === 'scrap') cars.forEach((car) => car.scale.set(1.2, 1.15, 1));
    cars.forEach((car) => this.scene.add(car));
    return { id: train.id, train, x: this.trainX[index], s: 0, v: 0, crank: 0, smokeAcc: Math.random(), cars, centre, wheels, rods, barrier, tilt: 0, ...extras };
  }

  // A boss creature: one body that rides beside the line at its own height.
  makeCreature(train, index) {
    const made = buildCreature(this, train.model);
    const { group, look } = made;
    const barrier = new THREE.Mesh(
      new THREE.SphereGeometry(1, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0xff8a6a, wireframe: true, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    barrier.scale.set(7, 5, 14);
    barrier.visible = false;
    group.add(barrier);
    group.visible = false;
    this.scene.add(group);
    const alt = look.alt;
    return {
      id: train.id, train, x: this.trainX[index], s: 0, v: 0, crank: 0, smokeAcc: 0, cars: [group], centre: [0], wheels: [], rods: [], barrier, tilt: 0,
      creature: { ...made, alt, fall: 0, dust: 0 },
      // Where its shots leave from, where shots at it land, and how high its damage numbers float.
      muzzleAt: [made.mouth[0], alt + made.mouth[1], made.mouth[2]],
      aimAt: [0, alt + (look.kind === 'wurm' ? 4 : 0), look.kind === 'wurm' ? 6 : 1],
      numY: alt + (look.kind === 'wurm' ? 9 : 4),
    };
  }

  // The front: the cowcatcher, or one of the heavier fronts that crash through debris.
  makeFront(front, P, mTrim, mDark) {
    const iron = this.lam(0x6d737c);
    const steel = this.lam(0x9aa3ad);
    if (front === 'plow') {
      // A wide iron wedge.
      const plow = P(new THREE.ConeGeometry(1.6, 1.8, 4, 1), iron, 0, 0.95, 6.3, 0);
      plow.rotation.set(Math.PI / 2, Math.PI / 4, 0);
      plow.scale.set(1.15, 1, 0.55);
      P(new THREE.BoxGeometry(2.7, 0.18, 0.2), mTrim, 0, 1.5, 5.75, 0);
    } else if (front === 'ram') {
      // A long spiked prow with braces.
      const ram = P(new THREE.ConeGeometry(0.75, 3.2, 6), steel, 0, 1.6, 7.3, 0);
      ram.rotation.x = Math.PI / 2;
      for (const s of [-1, 1]) {
        const brace = P(new THREE.BoxGeometry(0.16, 0.16, 2.2), mDark, s * 0.8, 1.2, 6.3, 0);
        brace.rotation.y = -s * 0.35;
      }
      const plate = P(new THREE.ConeGeometry(1.5, 1.4, 4, 1), iron, 0, 0.9, 6.2, 0);
      plate.rotation.set(Math.PI / 2, Math.PI / 4, 0);
      plate.scale.set(1, 1, 0.5);
    } else if (front === 'breaker') {
      // A great blade wider than the train, with teeth.
      const blade = P(new THREE.BoxGeometry(3.6, 1.9, 0.35), steel, 0, 1.3, 6.4, 0);
      blade.rotation.x = -0.35;
      for (let i = 0; i < 5; i++) {
        const tooth = P(new THREE.ConeGeometry(0.22, 0.7, 4), iron, -1.4 + i * 0.7, 0.45, 6.85, 0);
        tooth.rotation.x = Math.PI / 2 + 0.3;
      }
      for (const s of [-1, 1]) P(new THREE.BoxGeometry(0.3, 1.2, 1.6), mDark, s * 1.55, 1.3, 5.8, 0);
    } else {
      const cc = P(new THREE.BoxGeometry(2.3, 0.14, 1.5), mTrim, 0, 0.95, 5.95, 0);
      cc.rotation.x = 0.62;
    }
  }

  // The mythic engines get their own shapes.
  decorate(model, P, cars, extras, { mBody, mTrim, mDark }) {
    if (model === 'dragon') {
      const scale = this.lam(0x8e1c14);
      P(new THREE.BoxGeometry(1.5, 1.0, 1.6), scale, 0, 2.5, 6.4, 0); // snout
      const jaw = P(new THREE.BoxGeometry(1.3, 0.35, 1.4), mDark, 0, 1.85, 6.3, 0);
      jaw.rotation.x = 0.18;
      for (const s of [-1, 1]) {
        P(new THREE.BoxGeometry(0.2, 0.16, 0.12), this.glow(0xffb020), s * 0.5, 2.85, 7.2, 0); // eyes
        const horn = P(new THREE.ConeGeometry(0.22, 1.5, 5), mTrim, s * 0.55, 3.6, 5.6, 0);
        horn.rotation.x = -0.9;
        // A swept-back wing: a triangle along the boiler, tipped up and out.
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.lineTo(-3.6, 0.1);
        shape.lineTo(-2.6, 0.9);
        shape.lineTo(-1.6, 2.2);
        shape.lineTo(-0.4, 1.0);
        shape.lineTo(0, 0);
        const wing = P(new THREE.ShapeGeometry(shape).rotateY(-Math.PI / 2), this.lam(0x7a140e, { side: THREE.DoubleSide }), s * 1.2, 3.1, 3.2, 0);
        wing.rotation.z = s * 0.9;
      }
      for (let i = 0; i < 5; i++) {
        const spike = P(new THREE.ConeGeometry(0.2, 0.7, 4), mTrim, 0, 3.55, 3.8 - i * 1.0, 0);
        spike.rotation.x = -0.4;
      }
      extras.mouth = [0, 2.2, 7.4];
    } else if (model === 'wizard') {
      const hat = P(new THREE.ConeGeometry(0.8, 2.8, 8), this.lam(0x3a2a80), 0, 5.2, 4.6, 0);
      hat.rotation.x = -0.12;
      P(new THREE.CylinderGeometry(1.0, 1.0, 0.14, 12), this.lam(0x3a2a80), 0, 3.85, 4.6, 0); // brim
      P(new THREE.OctahedronGeometry(0.22, 0), this.glow(0xfff2a0), 0, 6.7, 4.4, 0);
      for (const z of [0.4, 2.0, 3.6]) {
        const ring = P(new THREE.TorusGeometry(1.22, 0.06, 4, 18), this.glow(0x9ad7ff), 0, 2.3, z, 0);
        ring.rotation.y = 0;
      }
      const orb = P(new THREE.SphereGeometry(0.45, 10, 8), this.glow(0xb69cff), 0, 5.4, -2.5, 0);
      orb.userData.y = 5.4;
      extras.orb = orb;
    } else if (model === 'titan') {
      for (const s of [-1, 1]) {
        P(new THREE.BoxGeometry(0.28, 1.6, 5.2), this.lam(0x47443e), s * 1.25, 2.3, 1.8, 0); // armour plates
        P(new THREE.BoxGeometry(0.9, 0.7, 2.8), mTrim, s * 1.55, 4.3, -2.5, 0); // pauldrons
        P(new THREE.BoxGeometry(0.25, 1.9, 4.8), this.lam(0x47443e), s * 1.4, 2.2, -14.2, 2);
      }
      const plow = P(new THREE.ConeGeometry(1.7, 1.6, 4), mTrim, 0, 1.0, 6.4, 0);
      plow.rotation.set(Math.PI / 2, Math.PI / 4, 0);
      P(new THREE.BoxGeometry(0.5, 0.5, 0.5), this.glow(0xffc060), 0, 4.1, 4.6, 0);
    } else if (model === 'phoenix') {
      for (let i = 0; i < 4; i++) {
        const flame = P(new THREE.ConeGeometry(0.3, 1.2 - i * 0.15, 5), this.glow(i % 2 ? 0xffc94a : 0xff6a1a), 0, 3.9, 3.4 - i * 1.0, 0);
        flame.rotation.x = -0.5;
      }
      for (const s of [-1, 1]) {
        const fin = P(new THREE.BoxGeometry(0.08, 1.2, 2.6), this.lam(0xff8a2a), s * 1.5, 3.2, 1.4, 0);
        fin.rotation.z = s * 0.6;
      }
    }
    if (model === 'marauder' || model === 'scrap') {
      // A pirate war-train: welded plate, spikes, a jagged prow and a black flag.
      const rust = this.lam(model === 'scrap' ? 0x6a4630 : 0x54382a);
      for (const s of [-1, 1]) {
        P(new THREE.BoxGeometry(0.2, 1.3, 5.6), rust, s * 1.2, 2.3, 1.6, 0);
        for (let i = 0; i < 4; i++) {
          const spike = P(new THREE.ConeGeometry(0.16, 0.8, 4), mTrim, s * 1.45, 2.5, 0.2 + i * 1.2, 0);
          spike.rotation.z = -s * Math.PI / 2;
        }
      }
      for (let i = 0; i < 3; i++) {
        const tooth = P(new THREE.ConeGeometry(0.3, 1.5, 4), mTrim, -0.8 + i * 0.8, 1.2, 6.5, 0);
        tooth.rotation.x = Math.PI / 2;
      }
      P(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 4), mDark, 0.9, 5.4, -3.2, 0);
      P(new THREE.BoxGeometry(0.05, 0.9, 1.4), this.lam(0x0e0e10, { side: THREE.DoubleSide }), 0.9, 6.1, -3.95, 0);
      P(new THREE.BoxGeometry(0.07, 0.3, 0.3), this.glow(0xf2efe2), 0.9, 6.15, -3.9, 0);
      P(new THREE.CylinderGeometry(0.3, 0.26, 1.2, 6), mDark, -0.7, 4.0, 3.4, 0);
      if (model === 'scrap') {
        // Rustjaw's own guns: a turret on the tender and a battery down the coach.
        P(new THREE.CylinderGeometry(0.8, 0.9, 0.6, 8), rust, 0, 3.7, -6.5, 1);
        P(new THREE.CylinderGeometry(0.28, 0.36, 3.0, 8).rotateX(Math.PI / 2), mDark, 0, 4.15, -5.1, 1);
        for (const z of [-11.4, -14.2, -17]) {
          P(new THREE.BoxGeometry(1.0, 0.7, 1.0), rust, 0, 4.25, z, 2);
          for (const s of [-1, 1]) {
            const gun = P(new THREE.CylinderGeometry(0.16, 0.2, 1.8, 6), mDark, s * 1.0, 4.3, z, 2);
            gun.rotation.z = Math.PI / 2;
          }
        }
        for (const s of [-1, 1]) P(new THREE.BoxGeometry(0.16, 0.14, 0.1), this.glow(0xff3b2a), s * 0.35, 3.1, 5.42, 0);
      }
    } else if (model === 'glacier') {
      // Ice: crystal spines down the boiler, a frosted prow and a cold light inside.
      const ice = new THREE.MeshLambertMaterial({ color: 0xbfeeff, flatShading: true, transparent: true, opacity: 0.85, emissive: 0x1d4a66 });
      for (let i = 0; i < 6; i++) {
        const shard = P(new THREE.ConeGeometry(0.28 + (i % 2) * 0.12, 1.3 + (i % 3) * 0.5, 5), ice, (i % 2 ? 0.35 : -0.35), 3.7, 4.0 - i * 1.0, 0);
        shard.rotation.set(-0.35, 0, (i % 2 ? -0.3 : 0.3));
      }
      for (const s of [-1, 1]) {
        const blade = P(new THREE.ConeGeometry(0.5, 2.6, 4), ice, s * 0.7, 1.3, 6.6, 0);
        blade.rotation.set(Math.PI / 2, 0, s * 0.3);
        P(new THREE.OctahedronGeometry(0.42, 0), this.glow(0x9fe6ff), s * 1.45, 3.4, -2.5, 0);
      }
      P(new THREE.OctahedronGeometry(0.7, 0), this.glow(0xd9f6ff), 0, 5.3, -6.5, 1);
    } else if (model === 'sandshark') {
      // The Devourer's jaws for a front, and a fin down its back.
      const hide = this.lam(0x8a6a3c);
      const tooth = this.lam(0xf2e6c8);
      const upper = P(new THREE.BoxGeometry(2.5, 0.7, 2.6), hide, 0, 2.5, 6.4, 0);
      upper.rotation.x = -0.22;
      const lower = P(new THREE.BoxGeometry(2.3, 0.5, 2.4), mDark, 0, 1.15, 6.3, 0);
      lower.rotation.x = 0.2;
      for (let i = 0; i < 6; i++) {
        const up = P(new THREE.ConeGeometry(0.16, 0.6, 4), tooth, -1.0 + i * 0.4, 2.05, 7.3, 0);
        up.rotation.x = Math.PI;
        P(new THREE.ConeGeometry(0.16, 0.6, 4), tooth, -1.0 + i * 0.4, 1.6, 7.2, 0);
      }
      P(new THREE.BoxGeometry(2.0, 0.5, 0.3), this.glow(0xff5a2a), 0, 1.85, 6.5, 0);
      for (const s of [-1, 1]) P(new THREE.BoxGeometry(0.1, 0.24, 0.5), this.glow(0xffc040), s * 1.27, 2.75, 6.2, 0);
      const fin = new THREE.Shape();
      fin.moveTo(0, 0);
      fin.lineTo(-3.4, 0);
      fin.lineTo(-2.6, 2.6);
      fin.lineTo(0, 0);
      P(new THREE.ShapeGeometry(fin).rotateY(-Math.PI / 2), this.lam(0x6e5230, { side: THREE.DoubleSide }), 0, 3.35, 3.4, 0);
      for (const s of [-1, 1]) P(new THREE.BoxGeometry(0.22, 1.5, 5.0), hide, s * 1.25, 2.3, 1.6, 0);
    } else if (model === 'graviton') {
      // A singularity engine: a dark core over the cab, ringed, and violet bands round the boiler.
      for (const z of [0.2, 1.8, 3.4]) P(new THREE.TorusGeometry(1.24, 0.07, 4, 18), this.glow(0x9b6bff), 0, 2.3, z, 0);
      const core = P(new THREE.SphereGeometry(0.75, 12, 10), new THREE.MeshBasicMaterial({ color: 0x05030a }), 0, 6.0, -2.5, 0);
      core.userData.y = 6.0;
      extras.orb = core;
      const ring = P(new THREE.TorusGeometry(1.25, 0.09, 6, 24), this.glow(0xc7a8ff), 0, 6.0, -2.5, 0);
      ring.rotation.x = Math.PI / 2 - 0.35;
      extras.ring = ring;
      const ring2 = P(new THREE.TorusGeometry(1.7, 0.05, 6, 24), this.glow(0x6b46d6), 0, 6.0, -2.5, 0);
      ring2.rotation.x = Math.PI / 2 + 0.5;
      extras.ring2 = ring2;
      for (const s of [-1, 1]) P(new THREE.BoxGeometry(0.1, 0.5, 6.0), this.glow(0x7a4ce0), s * 1.12, 2.3, 1.6, 0);
    } else if (model === 'bastion') {
      // A fortress on rails: battlements, armor skirts, turrets and a great plow.
      const plate = this.lam(0x39424c);
      const stone = this.lam(0x6b7885);
      for (const s of [-1, 1]) {
        P(new THREE.BoxGeometry(0.3, 2.0, 6.0), plate, s * 1.3, 2.2, 1.6, 0);
        P(new THREE.BoxGeometry(0.3, 2.2, 4.6), plate, s * 1.45, 2.1, -6.5, 1);
        P(new THREE.BoxGeometry(0.3, 2.4, 9.0), plate, s * 1.5, 2.2, -14.2, 2);
        for (let i = 0; i < 5; i++) P(new THREE.BoxGeometry(0.34, 0.5, 0.9), stone, s * 1.5, 3.65, -17.8 + i * 1.8, 2);
      }
      for (const [z, car] of [[-6.5, 1], [-11.6, 2], [-16.6, 2]]) {
        P(new THREE.CylinderGeometry(0.95, 1.05, 0.8, 8), stone, 0, 4.2 + (car === 1 ? -0.5 : 0), z, car);
        P(new THREE.CylinderGeometry(0.3, 0.38, 3.4, 8).rotateX(Math.PI / 2), mDark, 0, 4.5 + (car === 1 ? -0.5 : 0), z + 1.6, car);
      }
      const plow = P(new THREE.ConeGeometry(1.9, 1.9, 4), stone, 0, 1.0, 6.5, 0);
      plow.rotation.set(Math.PI / 2, Math.PI / 4, 0);
      for (const s of [-1, 1]) P(new THREE.BoxGeometry(0.18, 0.16, 0.1), this.glow(0xff3b2a), s * 0.35, 3.1, 5.42, 0);
      P(new THREE.BoxGeometry(0.6, 0.6, 0.6), this.glow(0xff4a3a), 0, 4.2, 4.6, 0);
    }
    void mBody;
    void mDark;
    void cars;
  }

  // Weapons show on the roofs: cannons on the tender and coach, a crystal for the plasma lance.
  mountArms(arms, P, { mDark, mMetal, mTrim }) {
    const cylZ = (r1, r2, l, s) => new THREE.CylinderGeometry(r1, r2, l, s).rotateX(Math.PI / 2);
    if (arms.includes('cannon')) {
      P(new THREE.CylinderGeometry(0.55, 0.65, 0.5, 8), mMetal, 0, 3.75, -7.0, 1);
      P(cylZ(0.22, 0.3, 2.4, 8), mDark, 0, 4.05, -5.9, 1);
    }
    if (arms.includes('heavy')) {
      P(new THREE.BoxGeometry(1.6, 0.6, 2.2), mMetal, 0, 4.25, -12.2, 2);
      P(cylZ(0.34, 0.44, 3.6, 8), mDark, 0, 4.6, -10.4, 2);
    }
    if (arms.includes('plasma')) {
      P(new THREE.CylinderGeometry(0.3, 0.5, 0.4, 6), mTrim, 0, 4.2, -16.4, 2);
      P(new THREE.OctahedronGeometry(0.5, 0), this.glow(0xb48cff), 0, 4.9, -16.4, 2);
    }
    if (arms.includes('shield')) {
      P(new THREE.SphereGeometry(0.5, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), this.glow(0x6fb8ff), 0, 4.0, -17.8, 2);
    }
    if (arms.includes('launcher')) {
      // a six-tube missile pod on a turntable
      P(new THREE.CylinderGeometry(0.6, 0.7, 0.35, 8), mMetal, 0, 3.75, -3.0, 1);
      P(new THREE.BoxGeometry(1.5, 0.9, 1.6), mDark, 0, 4.35, -3.0, 1);
      for (let i = 0; i < 6; i++) P(cylZ(0.16, 0.16, 0.2, 6), mTrim, -0.45 + (i % 3) * 0.45, 4.15 + Math.floor(i / 3) * 0.42, -2.15, 1);
    }
    if (arms.includes('heat')) {
      // the Heat Cannon: a squat flared barrel fed by glowing heat pipes from the boiler
      P(cylZ(0.55, 0.85, 2.2, 10), mDark, 0, 4.15, -6.6, 1);
      P(cylZ(0.62, 0.62, 0.25, 10), this.glow(0xff7a20), 0, 4.15, -5.5, 1);
      for (const sx of [-0.55, 0.55]) P(new THREE.CylinderGeometry(0.1, 0.1, 1.6, 6).rotateX(Math.PI / 2), this.glow(0xff9a3a), sx, 3.7, -7.4, 1);
    }
    if (arms.includes('tesla')) {
      // the Tesla Coil: a tall coil with a crown, and a battery pack of glowing cells behind it
      P(new THREE.CylinderGeometry(0.22, 0.38, 1.8, 8), mMetal, 0, 4.6, -11.6, 2);
      for (let i = 0; i < 4; i++) P(new THREE.TorusGeometry(0.5 - i * 0.07, 0.06, 6, 16).rotateX(Math.PI / 2), mTrim, 0, 3.95 + i * 0.42, -11.6, 2);
      P(new THREE.TorusGeometry(0.55, 0.12, 8, 18).rotateX(Math.PI / 2), this.glow(0x7fc8ff), 0, 5.6, -11.6, 2);
      for (let i = 0; i < 3; i++) P(new THREE.BoxGeometry(0.42, 0.7, 0.42), this.glow(0x5aa8ff), -0.5 + i * 0.5, 3.8, -13.4, 2);
    }
    if (arms.includes('arc')) {
      // a Tesla coil: stacked rings and a glowing sphere
      P(new THREE.CylinderGeometry(0.25, 0.4, 1.4, 8), mMetal, 0, 4.4, -14.6, 2);
      for (let i = 0; i < 3; i++) P(new THREE.TorusGeometry(0.45 - i * 0.08, 0.07, 6, 16).rotateX(Math.PI / 2), mTrim, 0, 4.0 + i * 0.4, -14.6, 2);
      P(new THREE.SphereGeometry(0.42, 10, 8), this.glow(0x8fd8ff), 0, 5.35, -14.6, 2);
    }
  }

  makeRock(rock, look = null) {
    const g = new THREE.Group();
    const r = mulberry(Math.floor(rock.at * 1000) + 3);
    if (rock.size === 'debris') {
      // Fallen timber and rubble.
      for (let i = 0; i < 3; i++) {
        const log = new THREE.Mesh(this.G.trunk, this.M.trunk);
        log.rotation.set(Math.PI / 2, 0, (r() - 0.5) * 2.4);
        log.position.set((r() - 0.5) * 2.4, 0.5 + i * 0.25, (r() - 0.5) * 1.2);
        log.scale.set(0.9, 1.5, 0.9);
        g.add(log);
      }
    }
    for (let i = 0; i < (rock.size === 'debris' ? 2 : 3); i++) {
      const m = new THREE.Mesh(this.G.boulder, this.M.boulder);
      m.position.set((r() - 0.5) * 2.2, 0.9 + i * 0.6, (r() - 0.5) * 1.6);
      m.scale.setScalar(0.8 + r() * 0.6);
      m.rotation.set(r() * 3, r() * 3, 0);
      g.add(m);
    }
    // What a boss throws: ice, mines or burning rock.
    if (look === 'ice' || look === 'mine' || look === 'meteor') {
      const tint = look === 'ice' ? new THREE.MeshLambertMaterial({ color: 0xbfeeff, flatShading: true, transparent: true, opacity: 0.88, emissive: 0x1d4a66 }) : this.lam(look === 'mine' ? 0x23262c : 0x3a2018);
      g.children.forEach((m) => {
        m.material = tint;
      });
      const light = new THREE.Mesh(new THREE.OctahedronGeometry(look === 'mine' ? 0.5 : 0.9, 0), this.glow(look === 'ice' ? 0xd9f6ff : look === 'mine' ? 0xff3b2a : 0xff7a1a));
      light.position.y = look === 'mine' ? 2.6 : 1.4;
      g.add(light);
    }
    g.scale.setScalar(rock.big ? 3.2 : { debris: 0.55, boulder: 1, large: 1.7, giant: 3.2 }[rock.size] ?? 1);
    this.place(g, this.laneX[0], rock.at * UNITS_PER_MILE, 0.4);
    this.scene.add(g);
    return { id: rock.id, rock, x: this.laneX[0], s: rock.at * UNITS_PER_MILE, v: 0, g, look };
  }

  // Anything a shot can come from or land on: a train or a boulder.
  vis(id) {
    return this.trains.find((t) => t.id === id) ?? this.rocks.find((r) => r.id === id);
  }
  // Name tags that float over every train in the high cameras, so a speck far below is still readable.
  buildTags() {
    const colors = ['#19c3e6', '#ff9d1c', '#ff5d73', '#a56bff', '#7ee081', '#ffd84a', '#ff7ae0'];
    let rival = 0;
    this.tags = this.trains.map((t) => {
      const mine = t.train.isPlayer;
      const color = mine ? colors[0] : colors[1 + (rival++ % (colors.length - 1))];
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 96;
      const g = c.getContext('2d');
      const label = mine ? 'YOU' : String(t.train.name ?? 'Rival').replace(/^The /, '').split(' ')[0].toUpperCase().slice(0, 10);
      g.font = '800 34px Rajdhani, Arial, sans-serif';
      const w = Math.min(236, g.measureText(label).width + 36);
      g.fillStyle = 'rgba(6,10,16,0.82)';
      g.strokeStyle = color;
      g.lineWidth = mine ? 6 : 4;
      const x0 = (256 - w) / 2;
      g.beginPath();
      g.roundRect ? g.roundRect(x0, 6, w, 52, 14) : g.rect(x0, 6, w, 52);
      g.fill();
      g.stroke();
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(128 - 14, 58);
      g.lineTo(128 + 14, 58);
      g.lineTo(128, 88);
      g.closePath();
      g.fill();
      g.fillStyle = '#ffffff';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(label, 128, 33);
      const tex = new THREE.CanvasTexture(c);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, fog: false }));
      sprite.renderOrder = 10;
      sprite.center.set(0.5, 0.05);
      sprite.visible = false;
      this.scene.add(sprite);
      return { t, sprite, mine };
    });
  }

  updateTags() {
    const mode = this.camModes[this.camMode];
    const show = (mode === 'helicopter' || mode === 'birdseye') && this.race.status !== 'ready';
    const cam = this.camera.position;
    for (const tag of this.tags ?? []) {
      tag.sprite.visible = show;
      if (!show) continue;
      const p = this.worldPos(tag.t, 0, 6, 0);
      tag.sprite.position.copy(p);
      // constant size on screen, whatever the altitude
      const d = cam.distanceTo(p);
      const k = d * 0.068 * (tag.mine ? 1.15 : 1) * Math.max(0.5, Math.min(1, this.camera.aspect / 1.3));
      tag.sprite.scale.set(k * 2.67, k, 1);
    }
  }

  worldPos(t, x, y, z) {
    const w = this.path.toWorld(t.x + x, t.s + z, this.keep);
    return new THREE.Vector3(w.x, 0.7 + y + w.y, w.z);
  }
  forward(s) {
    const h = this.path.sample(s).h;
    return new THREE.Vector3(Math.sin(h), 0, Math.cos(h));
  }

  // ---------- particles ----------
  spawn(tex, pos, o) {
    const m = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      color: o.color ?? 0xffffff,
      opacity: o.a ?? 1,
      blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending,
      fog: !o.add,
    });
    const s = new THREE.Sprite(m);
    s.position.copy(pos);
    s.scale.setScalar(o.s0);
    this.scene.add(s);
    this.parts.push({ s, m, vel: o.vel || new THREE.Vector3(), life: o.life, max: o.life, s0: o.s0, s1: o.s1, a: o.a ?? 1, g: o.g ?? 0, drag: o.drag ?? 0.98 });
  }
  updateParts(dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.s);
        p.m.dispose();
        this.parts.splice(i, 1);
        continue;
      }
      const k = 1 - p.life / p.max;
      p.vel.y += p.g * dt;
      p.vel.multiplyScalar(Math.pow(p.drag, dt * 60));
      p.s.position.addScaledVector(p.vel, dt);
      p.s.scale.setScalar(p.s0 + (p.s1 - p.s0) * k);
      p.m.opacity = p.a * (1 - k * k);
    }
  }
  useLight(pos, color, power, dur) {
    const l = this.flashLights.reduce((a, b) => (a.userData.t < b.userData.t ? a : b));
    l.position.copy(pos);
    l.color.setHex(color);
    l.userData.p = power;
    l.userData.t = dur;
    l.userData.d = dur;
    l.intensity = power;
  }
  explode(pos, big, color) {
    for (let i = 0; i < (big ? 22 : 14); i++)
      this.spawn(this.TEX.fire, pos, { add: true, s0: rand(1.5, 3), s1: rand(4, 7), life: rand(0.35, 0.7), vel: new THREE.Vector3(rand(-9, 9), rand(2, 12), rand(-9, 9)), g: -6, drag: 0.93, color });
    for (let i = 0; i < 8; i++)
      this.spawn(this.TEX.smoke, pos, { s0: 2, s1: rand(6, 9), life: rand(1, 1.6), a: 0.55, color: 0x4a4440, vel: new THREE.Vector3(rand(-3, 3), rand(3, 6), rand(-3, 3)) });
    this.useLight(pos, 0xff9a40, big ? 6 : 4, 0.35);
  }
  rubble(pos) {
    for (let i = 0; i < 16; i++)
      this.spawn(this.TEX.ball, pos, { s0: rand(0.8, 1.6), s1: 0.4, life: rand(0.6, 1.1), color: 0x9a8f80, vel: new THREE.Vector3(rand(-8, 8), rand(4, 12), rand(-8, 8)), g: -26, drag: 0.99 });
    for (let i = 0; i < 6; i++)
      this.spawn(this.TEX.smoke, pos, { s0: 2, s1: rand(7, 10), life: rand(1, 1.8), a: 0.6, color: 0xb8ad9c, vel: new THREE.Vector3(rand(-3, 3), rand(1, 4), rand(-3, 3)) });
  }

  // ---------- shots ----------
  boltPoints(top, bot, n = 12, jag = 1.6) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const p = top.clone().lerp(bot, i / n);
      if (i > 0 && i < n) {
        p.x += rand(-jag, jag) * 1.6;
        p.z += rand(-jag, jag);
      }
      pts.push(p);
    }
    return pts;
  }

  // Where a shot lands on its target: the foot of a boulder, the middle of a train, a creature's body.
  aimPoint(to, dy = 0, dz = 0) {
    if (to.rock) return this.worldPos(to, 0, 1.2 + dy, 0);
    if (to.aimAt) return this.worldPos(to, to.aimAt[0], to.aimAt[1] + dy, to.aimAt[2] + dz);
    return this.worldPos(to, 0, 2.8 + dy, -3 + dz);
  }

  // Where a shot leaves its train.
  muzzle(from, kind) {
    if (from.muzzleAt) return this.worldPos(from, ...from.muzzleAt);
    if (from.train?.isBoss) return this.worldPos(from, 0, 4.4, kind === 'bolt' ? -11 : -5.2);
    if (kind === 'fire') return from.mouth ? this.worldPos(from, ...from.mouth) : this.worldPos(from, 0, 3.6, 4);
    if (kind === 'cannon') return this.worldPos(from, 0, 4.05, -4.6);
    if (kind === 'heavy') return this.worldPos(from, 0, 4.6, -8.5);
    if (kind === 'plasma') return this.worldPos(from, 0, 4.9, -16.4);
    if (kind === 'launcher') return this.worldPos(from, 0, 4.4, -2.0);
    if (kind === 'arc') return this.worldPos(from, 0, 5.35, -14.6);
    if (kind === 'heat') return this.worldPos(from, 0, 4.15, -5.4);
    if (kind === 'tesla') return this.worldPos(from, 0, 5.6, -11.6);
    return this.worldPos(from, 0, 3.6, 4);
  }

  startShot(shot) {
    const from = this.vis(shot.from);
    const near = from && Math.abs(from.s - this.player().s) < 400;
    if (shot.kind === 'bolt') {
      const cloud = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.TEX.cloud, color: 0x33384a, transparent: true, opacity: 0, depthWrite: false }));
      cloud.scale.set(22, 9, 1);
      this.scene.add(cloud);
      this.shotFx.set(shot.id, { shot, cloud });
      if (near) sfx.rumble();
      return;
    }
    const look = {
      fire: { tex: this.TEX.fire, size: shot.dragon ? 5.4 : 4.2, add: true, color: 0xffffff },
      cannon: { tex: this.TEX.ball, size: 1.4, add: false, color: 0xffffff },
      heavy: { tex: this.TEX.ball, size: 2.2, add: false, color: 0xffffff },
      plasma: { tex: this.TEX.spark, size: 2.6, add: true, color: 0xc4a0ff },
      launcher: { tex: this.TEX.spark, size: 1.3, add: true, color: 0xffd08a },
      heat: { tex: this.TEX.fire, size: 3 + Math.min(4, (shot.power ?? 0) / 3), add: true, color: 0xffa040 },
      tesla: { tex: this.TEX.spark, size: 2.4 + Math.min(5, (shot.power ?? 0) / 70), add: true, color: 0xa8dcff },
      // Boss attacks.
      frost: { tex: this.TEX.spark, size: 3.4, add: true, color: 0xbfeeff },
      acid: { tex: this.TEX.spark, size: 2.8, add: true, color: 0x9dff6a },
      rock: { tex: this.TEX.ball, size: 3.2, add: false, color: 0xb8a58c },
    }[shot.kind] ?? { tex: this.TEX.spark, size: 1.4, add: true, color: 0xffffff };
    const core = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: look.tex, color: look.color, blending: look.add ? THREE.AdditiveBlending : THREE.NormalBlending, transparent: true, depthWrite: false, fog: false }),
    );
    core.scale.setScalar(look.size);
    this.scene.add(core);
    const flat = from?.train?.isBoss && from.creature; // a creature's breath comes straight down the line
    const fx = { shot, core, look, arc: flat ? 0.4 : shot.kind === 'plasma' || shot.kind === 'tesla' ? 0.3 : shot.kind === 'heat' ? 1 : shot.kind === 'fire' ? rand(5, 8) : shot.kind === 'launcher' ? rand(2, 7) : shot.kind === 'rock' ? rand(7, 10) : rand(3, 5), trail: 0 };
    if (from && shot.kind === 'heat') {
      const m = this.muzzle(from, 'heat');
      for (let i = 0; i < 8; i++) this.spawn(this.TEX.fire, m, { add: true, s0: rand(1.5, 3), s1: 0.4, life: rand(0.3, 0.5), vel: new THREE.Vector3(rand(-3, 3), rand(0, 3), rand(-3, 3)) });
      this.useLight(m, 0xff7a20, 5, 0.18);
    }
    if (from && shot.kind === 'tesla') {
      const m = this.muzzle(from, 'tesla');
      for (let i = 0; i < 10; i++) this.spawn(this.TEX.spark, m, { add: true, s0: 1.8, s1: 0.2, life: 0.3, color: 0xbfe9ff, vel: new THREE.Vector3(rand(-6, 6), rand(0, 6), rand(-6, 6)) });
      this.useLight(m, 0x9fdcff, 6, 0.2);
      this.flash = Math.max(this.flash, Math.min(0.6, (shot.power ?? 0) / 600));
    }
    core.visible = !(shot.delay > 0);
    this.shotFx.set(shot.id, fx);
    if (from && (shot.kind === 'cannon' || shot.kind === 'heavy')) {
      const m = this.muzzle(from, shot.kind);
      for (let i = 0; i < 6; i++) this.spawn(this.TEX.smoke, m, { s0: 1.5, s1: rand(4, 6), life: rand(0.6, 1), a: 0.7, color: 0xd8d4cc, vel: new THREE.Vector3(rand(-2, 2), rand(1, 3), rand(-2, 2)) });
      this.spawn(this.TEX.fire, m, { add: true, s0: shot.kind === 'heavy' ? 4 : 2.6, s1: 0.5, life: 0.18 });
      this.useLight(m, 0xffc070, 4, 0.12);
    }
    if (near && !(shot.delay > 0)) (shot.kind === 'cannon' || shot.kind === 'heavy' ? sfx.boom : sfx.whoosh)(shot.kind === 'heavy');
  }

  // Lightning channels: jagged beams redrawn every frame between the coil and the target.
  updateBeams(dt) {
    this.beams = this.beams ?? new Map();
    const live = new Set();
    for (const c of this.race.channels ?? []) {
      live.add(c.id);
      const from = this.vis(c.from);
      const to = this.vis(c.to);
      if (!from || !to) continue;
      let beam = this.beams.get(c.id);
      if (!beam) {
        const lines = [0xffffff, 0x9fdcff, 0x5fb8ff].map((color, i) => {
          const line = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1 - i * 0.25, blending: THREE.AdditiveBlending, fog: false, depthWrite: false }));
          this.scene.add(line);
          return line;
        });
        beam = { lines, t: 0 };
        this.beams.set(c.id, beam);
        if (Math.abs(from.s - this.player().s) < 400) sfx.thunder?.();
      }
      beam.t += dt;
      if (beam.t < 0.04) continue;
      beam.t = 0;
      const a = this.muzzle(from, 'arc');
      const b = this.aimPoint(to, 0.3);
      // brighter as the channel ramps up
      const power = Math.min(1, 0.35 + c.ticks / 12);
      beam.lines.forEach((line, i) => {
        const pts = [];
        const n = 18;
        for (let j = 0; j <= n; j++) {
          const p = a.clone().lerp(b, j / n);
          const amp = Math.sin((j / n) * Math.PI) * (1.2 + i * 0.8);
          if (j > 0 && j < n) p.add(new THREE.Vector3(rand(-amp, amp), rand(-amp, amp) * 0.7, rand(-amp, amp)));
          pts.push(p);
        }
        line.geometry.dispose();
        line.geometry = new THREE.BufferGeometry().setFromPoints(pts);
        line.material.opacity = power * (1 - i * 0.25);
      });
      this.useLight(b, 0x9fdcff, 2 + power * 4, 0.06);
    }
    for (const [id, beam] of this.beams) {
      if (live.has(id)) continue;
      beam.lines.forEach((line) => {
        this.scene.remove(line);
        line.geometry.dispose();
        line.material.dispose();
      });
      this.beams.delete(id);
    }
  }

  endShot(fx) {
    if (fx.core) {
      this.scene.remove(fx.core);
      fx.core.material.dispose();
    }
    if (fx.cloud) {
      // Leave the storm cloud to fade over the strike.
      this.strikes.push({ cloud: fx.cloud, lines: null, t: 0, to: fx.shot.to });
    }
  }

  updateShots(dt) {
    const live = new Set(this.race.shots.map((s) => s.id));
    for (const [id, fx] of this.shotFx) {
      if (!live.has(id)) {
        this.endShot(fx);
        this.shotFx.delete(id);
        continue;
      }
      const from = this.vis(fx.shot.from);
      const to = this.vis(fx.shot.to);
      if (!from || !to) continue;
      // Missiles in a burst wait their turn on the rail, then fly.
      const flight = fx.shot.total - (fx.shot.delay ?? 0);
      const k = clamp(1 - fx.shot.left / flight, 0, 1);
      if (fx.core) {
        const waiting = fx.shot.left > flight;
        if (fx.core.visible === waiting) {
          fx.core.visible = !waiting;
          if (!waiting && fx.shot.kind === 'launcher') {
            const m = this.muzzle(from, 'launcher');
            this.spawn(this.TEX.fire, m, { add: true, s0: 1.6, s1: 0.3, life: 0.15 });
            if (Math.abs(from.s - this.player().s) < 400) sfx.whoosh();
          }
        }
        if (fx.shot.kind === 'launcher' && !waiting) {
          fx.trail += dt;
          if (fx.trail > 0.03) {
            fx.trail = 0;
            this.spawn(this.TEX.smoke, fx.core.position.clone(), { s0: 0.6, s1: 2.2, life: 0.7, a: 0.55, color: 0xd8d4cc, vel: new THREE.Vector3(rand(-0.5, 0.5), rand(0.2, 1), rand(-0.5, 0.5)) });
          }
        }
        const a = this.muzzle(from, fx.shot.kind);
        const b = this.aimPoint(to);
        const pos = a.lerp(b, k);
        pos.y += Math.sin(k * Math.PI) * fx.arc;
        fx.core.position.copy(pos);
        if (fx.shot.kind === 'fire') {
          fx.core.scale.setScalar(fx.look.size + Math.sin(performance.now() / 25) * 0.5);
          const drift = this.forward(from.s).multiplyScalar(from.v * 0.85);
          for (let j = 0; j < (fx.shot.dragon ? 5 : 3); j++)
            this.spawn(this.TEX.fire, pos, { add: true, s0: rand(1.8, 2.8), s1: 0.4, life: rand(0.25, 0.45), vel: new THREE.Vector3(rand(-1.5, 1.5), rand(0, 2), rand(-3, 0)).add(drift) });
          this.useLight(pos, 0xff8a30, 3, 0.08);
        } else if (fx.shot.kind === 'plasma') {
          this.spawn(this.TEX.spark, pos, { add: true, s0: 1.8, s1: 0.2, life: 0.25, color: 0xb48cff });
          this.useLight(pos, 0xa070ff, 2.5, 0.08);
        } else if (fx.shot.kind === 'heat') {
          // a rolling wave of heat
          for (let j = 0; j < 3; j++) this.spawn(this.TEX.fire, pos, { add: true, s0: rand(2, 3.5), s1: 0.5, life: rand(0.2, 0.35), color: 0xffb060, vel: new THREE.Vector3(rand(-2, 2), rand(-0.5, 1.5), rand(-2, 2)) });
          this.useLight(pos, 0xff8a30, 3, 0.08);
        } else if (fx.shot.kind === 'tesla') {
          for (let j = 0; j < 3; j++) this.spawn(this.TEX.spark, pos, { add: true, s0: 1.6, s1: 0.2, life: 0.18, color: 0xbfe9ff, vel: new THREE.Vector3(rand(-5, 5), rand(-3, 3), rand(-5, 5)) });
          this.useLight(pos, 0x9fdcff, 3.5, 0.08);
        } else if (fx.shot.kind === 'frost' || fx.shot.kind === 'acid') {
          const color = fx.shot.kind === 'frost' ? 0xd9f6ff : 0x9dff6a;
          for (let j = 0; j < 3; j++) this.spawn(fx.shot.kind === 'frost' ? this.TEX.smoke : this.TEX.spark, pos, { add: fx.shot.kind === 'acid', s0: rand(1.4, 2.4), s1: 0.4, life: rand(0.25, 0.45), a: 0.85, color, vel: new THREE.Vector3(rand(-2, 2), rand(-1, 1.5), rand(-2, 2)) });
          this.useLight(pos, color, 2.5, 0.08);
        } else if (Math.random() < 0.6) {
          this.spawn(this.TEX.smoke, pos, { s0: 0.8, s1: 2.4, life: 0.5, a: 0.5, color: 0xcfcac2 });
        }
      } else {
        const top = this.aimPoint(to).add(new THREE.Vector3(0, 23, 0));
        fx.cloud.position.copy(top).add(new THREE.Vector3(0, 2, 0));
        fx.cloud.material.opacity = Math.min(0.95, k * 1.6);
        if (Math.random() < 0.35) this.spawn(this.TEX.spark, top.clone().add(new THREE.Vector3(rand(-6, 6), rand(-1, 1), rand(-4, 4))), { add: true, s0: 1.5, s1: 0.2, life: 0.2 });
      }
    }
    // Lightning strikes crackle for a third of a second, then the cloud fades.
    for (let i = this.strikes.length - 1; i >= 0; i--) {
      const s = this.strikes[i];
      s.t += dt;
      const to = this.vis(s.to);
      const bot = this.aimPoint(to, to.rock ? -0.2 : 0.6);
      const top = bot.clone().add(new THREE.Vector3(0, 23, 0));
      s.cloud.position.copy(top).add(new THREE.Vector3(0, 2, 0));
      s.cloud.material.opacity = Math.max(0, 0.95 - s.t * 1.5);
      if (s.lines) {
        const pts = this.boltPoints(top, bot);
        s.lines[0].geometry.setFromPoints(pts);
        s.lines[1].geometry.setFromPoints(pts.map((v) => v.clone().add(new THREE.Vector3(0.25, 0, 0.25))));
        const mid = pts[5 + Math.floor(Math.random() * 3)];
        s.lines[2].geometry.setFromPoints(this.boltPoints(mid, mid.clone().add(new THREE.Vector3(rand(-6, 6), -rand(5, 9), rand(-4, 4))), 5, 1));
        s.lines.forEach((l) => {
          l.material.opacity = Math.random() > 0.25 ? 1 : 0.2;
        });
        if (Math.random() < 0.6) this.spawn(this.TEX.spark, bot, { add: true, s0: 3, s1: 0.5, life: 0.25, vel: new THREE.Vector3(rand(-8, 8), rand(2, 8), rand(-8, 8)), g: -20 });
        if (s.t > 0.32) {
          s.lines.forEach((l) => {
            this.scene.remove(l);
            l.geometry.dispose();
            l.material.dispose();
          });
          s.lines = null;
        }
      }
      if (s.t > 0.7) {
        this.scene.remove(s.cloud);
        s.cloud.material.dispose();
        this.strikes.splice(i, 1);
      }
    }
  }

  strikeLines(strike) {
    const mk = (color, add) =>
      new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color, fog: false, transparent: true, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending }));
    strike.lines = [mk(0xffffff), mk(0x7fb8ff, true), mk(0xbcd8ff)];
    this.scene.add(...strike.lines);
  }

  popNum(t, text, cls) {
    if (!this.numsEl) return;
    const el = document.createElement('div');
    el.className = `r3-num ${cls}`;
    el.textContent = text;
    this.numsEl.appendChild(el);
    this.nums.push({ el, t, age: 0, dx: rand(-1.5, 1.5) });
  }
  updateNums(dt) {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    for (let i = this.nums.length - 1; i >= 0; i--) {
      const n = this.nums[i];
      n.age += dt;
      if (n.age > 1.2) {
        n.el.remove();
        this.nums.splice(i, 1);
        continue;
      }
      const bounce = n.age < 0.25 ? Math.sin((n.age / 0.25) * Math.PI) * 1.5 : 0;
      this.v3.copy(this.worldPos(n.t, n.dx, (n.t.numY ?? 6) + bounce + n.age * 1.2, n.t.rock || n.t.creature ? 0 : -2)).project(this.camera);
      n.el.style.left = `${((this.v3.x + 1) / 2) * w}px`;
      n.el.style.top = `${((1 - this.v3.y) / 2) * h}px`;
      n.el.style.opacity = n.age > 0.85 ? (1.2 - n.age) / 0.35 : 1;
      n.el.style.display = this.v3.z > 1 ? 'none' : '';
    }
  }

  // What the engine reported since the last frame.
  drainFx() {
    const fxList = this.race.fx.splice(0);
    const me = this.player();
    for (const fx of fxList) {
      if (fx.type === 'spotted') this.startCine(fx);
      else if (fx.type === 'cast') this.startShot(fx.shot);
      else if (fx.type === 'barrier') {
        const t = this.vis(fx.id);
        t.barrier.material.color.setHex(fx.kind === 'shield' ? 0x6fb8ff : 0x7cf5c9);
        if (fx.id === 'player' || Math.abs(t.s - me.s) < 300) sfx.chime();
      } else if (fx.type === 'channel' || fx.type === 'channelEnd') {
        // drawn each frame from race.channels
      } else if (fx.type === 'hit' && (fx.dot || fx.kind === 'arc')) {
        const t = this.vis(fx.to);
        if (!t) continue;
        const style = fx.kind === 'burn' ? 'burn' : fx.kind === 'poison' ? 'poison' : 'zap';
        this.popNum(t, String(fx.damage), style);
        const at = t.rock ? this.worldPos(t, rand(-1, 1), 1.5, rand(-1, 1)) : t.creature ? this.aimPoint(t, rand(-1, 1), rand(-4, 4)) : this.worldPos(t, rand(-1, 1), 3, -3 + rand(-4, 4));
        const color = fx.kind === 'burn' ? 0xff8a2a : fx.kind === 'poison' ? 0x7dff6a : 0xaee6ff;
        for (let i = 0; i < (fx.kind === 'arc' ? 5 : 4); i++) {
          this.spawn(this.TEX.spark, at, { add: true, s0: fx.kind === 'arc' ? 1.6 : 1.2, s1: 0.2, life: 0.35, color, vel: new THREE.Vector3(rand(-4, 4), rand(1, fx.kind === 'poison' ? 3 : 6), rand(-4, 4)), g: fx.kind === 'poison' ? 2 : -6 });
        }
        if (fx.kind === 'arc') this.useLight(at, 0x9fdcff, 3, 0.1);
      } else if (fx.type === 'hit') {
        const t = this.vis(fx.to);
        if (!t) continue;
        const near = Math.abs(t.s - me.s) < 400;
        this.popNum(t, String(fx.damage), fx.blocked ? 'block' : fx.crit ? 'crit' : '');
        const at = t.rock ? this.worldPos(t, 0, 1.5, 0) : t.creature ? this.aimPoint(t, 0, rand(-3, 3)) : this.worldPos(t, 0, 3, -3 + rand(-3, 3));
        if (fx.kind === 'frost' || fx.kind === 'acid' || fx.kind === 'gravity') {
          const color = fx.kind === 'frost' ? 0xd9f6ff : fx.kind === 'acid' ? 0x9dff6a : 0xb48cff;
          for (let i = 0; i < 14; i++) this.spawn(this.TEX.spark, at, { add: true, s0: 2.6, s1: 0.3, life: 0.45, color, vel: new THREE.Vector3(rand(-8, 8), rand(1, 9), rand(-8, 8)), g: -8 });
          this.useLight(at, color, 4, 0.25);
          if (near) sfx.boom(false);
          if (fx.to === 'player' && !this.reduceMotion) this.shake = 0.8;
        } else if (fx.kind === 'plasma') {
          for (let i = 0; i < 14; i++) this.spawn(this.TEX.spark, at, { add: true, s0: 2.4, s1: 0.3, life: 0.4, color: 0xb48cff, vel: new THREE.Vector3(rand(-9, 9), rand(2, 10), rand(-9, 9)), g: -10 });
          this.useLight(at, 0xa070ff, 4, 0.25);
        } else this.explode(at, fx.kind === 'bolt' || fx.kind === 'heavy', fx.kind === 'bolt' ? 0xbfe0ff : 0xffffff);
        if (fx.kind === 'bolt') {
          // The storm cloud for this shot is already in strikes; give it its lightning.
          const strike = [...this.strikes].reverse().find((s) => s.to === fx.to && !s.lines && s.t < 0.1);
          if (strike) this.strikeLines(strike);
          this.useLight(at, 0xbfd9ff, 9, 0.4);
          if (near) {
            this.flash = this.reduceMotion ? 0.15 : 0.55;
            sfx.thunder();
          }
        }
        if (near && !['plasma', 'frost', 'acid', 'gravity'].includes(fx.kind)) sfx.boom(fx.kind === 'bolt' || fx.kind === 'heavy');
        if (fx.to === 'player' && !this.reduceMotion && !['frost', 'acid', 'gravity'].includes(fx.kind)) this.shake = fx.kind === 'bolt' || fx.kind === 'heavy' || fx.kind === 'rock' ? 1.2 : 0.7;
      } else if (fx.type === 'miss') {
        const t = this.vis(fx.to);
        if (t) this.popNum(t, fx.dodged ? 'Dodged!' : 'Miss', fx.dodged ? 'zap' : 'block');
      } else if (fx.type === 'crush') {
        const r = this.vis(fx.id);
        if (!r) continue;
        this.rubble(this.worldPos(r, 0, 1, 0));
        r.g.visible = false;
        this.popNum(me, 'Crushed', 'block');
        sfx.boom(false);
      } else if (fx.type === 'smash' || fx.type === 'crash') {
        const r = this.vis(fx.id);
        if (!r) continue;
        this.rubble(this.worldPos(r, 0, 1.5, 0));
        r.g.visible = false;
        sfx.boom(true);
        if (fx.type === 'crash') {
          this.popNum(me, String(fx.damage), '');
          if (!this.reduceMotion) this.shake = 1.6;
        } else this.popNum(r, 'Cleared', 'block');
      } else if (fx.type === 'derail') {
        const t = this.vis(fx.id);
        for (let i = 0; i < 3; i++) window.setTimeout(() => this.explode(this.worldPos(t, rand(-1, 1), 3, rand(-14, 3)), true), i * 260);
      } else if (fx.type === 'bossEnter') {
        sfx.alert?.();
        sfx.rumble?.();
        if (!this.reduceMotion) this.shake = 0.6;
      } else if (fx.type === 'bossWarn') {
        const t = this.vis(fx.id);
        if (t) {
          this.popNum(t, fx.name, 'crit');
          const at = this.muzzle(t, 'warn');
          for (let i = 0; i < 10; i++) this.spawn(this.TEX.spark, at, { add: true, s0: 2.2, s1: 0.3, life: 0.5, color: 0xffd24a, vel: new THREE.Vector3(rand(-5, 5), rand(1, 6), rand(-5, 5)) });
          this.useLight(at, 0xffc24a, 4, 0.3);
        }
        sfx.alert?.();
      } else if (fx.type === 'bossBreak') {
        const t = this.vis(fx.id);
        if (t) {
          this.popNum(t, 'Broken!', 'zap');
          const at = this.aimPoint(t);
          for (let i = 0; i < 24; i++) this.spawn(this.TEX.spark, at, { add: true, s0: 2.4, s1: 0.2, life: 0.6, color: 0x9ff3ff, vel: new THREE.Vector3(rand(-12, 12), rand(2, 12), rand(-12, 12)), g: -12 });
          this.useLight(at, 0x9ff3ff, 7, 0.35);
        }
        sfx.chime();
      } else if (fx.type === 'bossEnrage') {
        const t = this.vis(fx.id);
        if (t) {
          this.popNum(t, 'Enraged', 'crit');
          const at = this.aimPoint(t);
          for (let i = 0; i < 20; i++) this.spawn(this.TEX.fire, at, { add: true, s0: 2, s1: rand(5, 8), life: rand(0.5, 0.9), color: 0xff5a3a, vel: new THREE.Vector3(rand(-6, 6), rand(2, 9), rand(-6, 6)) });
        }
        this.flash = Math.max(this.flash, this.reduceMotion ? 0.1 : 0.3);
        sfx.rumble?.();
      } else if (fx.type === 'bossDown') {
        const t = this.vis(fx.id);
        if (t) {
          for (let i = 0; i < 6; i++) window.setTimeout(() => this.explode(this.aimPoint(t, rand(-2, 3), rand(-10, 6)), true, i % 2 ? 0xffffff : 0xffc24a), i * 220);
          this.popNum(t, 'Destroyed', 'crit');
        }
        this.flash = Math.max(this.flash, this.reduceMotion ? 0.15 : 0.5);
        if (!this.reduceMotion) this.shake = 1.6;
        sfx.boom(true);
        sfx.win?.();
      } else if (fx.type === 'bossFled') {
        sfx.whoosh();
      } else if (fx.type === 'drop') {
        // Something the boss threw: build it now and let it fall onto the line.
        const rock = this.race.obstacles.find((item) => item.id === fx.id);
        if (rock && !this.rocks.some((r) => r.id === rock.id)) {
          const vis = this.makeRock(rock, fx.look);
          vis.fall = 0.55;
          vis.baseY = vis.g.position.y;
          vis.g.position.y += 60;
          this.rocks.push(vis);
          this.falling.push(vis);
        }
      } else if (fx.type === 'rebirth') {
        const t = this.vis(fx.id);
        if (t) {
          for (let i = 0; i < 5; i++) window.setTimeout(() => this.explode(this.worldPos(t, rand(-1, 1), 3, rand(-10, 4)), true, 0xffc24a), i * 110);
          this.popNum(t, 'Reborn', 'crit');
        }
        this.flash = Math.max(this.flash, this.reduceMotion ? 0.15 : 0.5);
        sfx.rumble?.();
      } else if (fx.type === 'ability') {
        this.abilityFx(fx);
      } else if (fx.type === 'vented') {
        const t = this.vis(fx.id ?? 'player');
        if (!t) continue;
        this.popNum(t, typeof fx.amount === 'number' ? `-${fx.amount} heat` : fx.amount, 'zap');
        const at = this.worldPos(t, 0, 4.5, 2);
        for (let i = 0; i < 18; i++) this.spawn(this.TEX.smoke, at, { s0: 1.2, s1: rand(3, 5), life: rand(0.6, 1.1), a: 0.8, color: 0xdff6ff, vel: new THREE.Vector3(rand(-5, 5), rand(3, 7), rand(-5, 5)) });
        if (fx.id === 'player' || !fx.id) sfx.whoosh();
      } else if (fx.type === 'windBoost') {
        const t = this.vis(fx.id);
        if (t) {
          for (let i = 0; i < 24; i++) this.spawn(this.TEX.smoke, this.worldPos(t, rand(-2.5, 2.5), rand(1, 4), rand(-18, -12)), { s0: 1, s1: rand(3, 5), life: rand(0.4, 0.8), a: 0.7, color: 0xe8fbff, vel: this.forward(t.s).multiplyScalar(-rand(14, 24)) });
          this.popNum(t, 'Wind boost', 'zap');
          sfx.whoosh();
        }
      } else if (fx.type === 'windGust') {
        const from = this.vis(fx.id);
        for (const id of fx.to ?? []) {
          const t = this.vis(id);
          if (!t || !from) continue;
          const a = this.worldPos(from, 0, 4, -16);
          const b = this.worldPos(t, 0, 3, 0);
          for (let i = 0; i < 16; i++) {
            const k = i / 16;
            this.spawn(this.TEX.smoke, a.clone().lerp(b, k), { s0: 1.2, s1: 4, life: 0.6 + k * 0.3, a: 0.55, color: 0xcff4ff, vel: b.clone().sub(a).normalize().multiplyScalar(10) });
          }
          this.popNum(t, 'Gust: slowed', 'block');
        }
        sfx.whoosh();
      } else if (fx.type === 'online') {
        sfx.chime();
      } else if (fx.type === 'siphon') {
        this.siphonFrom = fx.from;
        this.siphonTo = fx.to ?? 'player';
        sfx.siphon();
      }
    }
  }

  // The signature abilities of the legendary machines.
  abilityFx(fx) {
    const from = this.vis(fx.from);
    if (!from) return;
    const name = B.ABILITIES[fx.id]?.name ?? fx.id;
    const targets = (fx.to ?? []).map((id) => this.vis(id)).filter(Boolean);
    const near = Math.abs(from.s - this.player().s) < 500;
    this.popNum(from, name, 'crit');
    if (fx.id === 'blackhole') {
      // Everything in reach is pulled in on itself.
      for (const t of targets) {
        const at = this.aimPoint(t, 1.5);
        for (let i = 0; i < 22; i++) {
          const off = new THREE.Vector3(rand(-9, 9), rand(-2, 9), rand(-9, 9));
          this.spawn(this.TEX.spark, at.clone().add(off), { add: true, s0: 2.4, s1: 0.2, life: 0.7, color: 0x9b6bff, vel: off.multiplyScalar(-1.5), drag: 1 });
        }
        this.spawn(this.TEX.ball, at, { s0: 1, s1: 9, life: 0.9, a: 0.9, color: 0x0a0612 });
        this.useLight(at, 0x9b6bff, 6, 0.6);
        if (!t.rock) this.popNum(t, '+250,000 lb', 'block');
      }
      this.flash = Math.max(this.flash, this.reduceMotion ? 0.08 : 0.25);
      if (near) sfx.rumble?.();
    } else if (fx.id === 'tempest') {
      if (near) sfx.thunder?.();
    } else if (fx.id === 'inferno') {
      const at = this.muzzle(from, 'fire');
      for (let i = 0; i < 26; i++) this.spawn(this.TEX.fire, at, { add: true, s0: rand(2, 4), s1: rand(6, 10), life: rand(0.4, 0.8), vel: this.forward(from.s).multiplyScalar(rand(10, 30)).add(new THREE.Vector3(rand(-6, 6), rand(0, 6), rand(-6, 6))) });
      this.useLight(at, 0xff8a30, 8, 0.5);
      if (near) sfx.whoosh();
    } else if (fx.id === 'bulwark') {
      const at = this.worldPos(from, 0, 3, -4);
      for (let i = 0; i < 20; i++) this.spawn(this.TEX.spark, at, { add: true, s0: 2, s1: 0.3, life: 0.6, color: 0xffd24a, vel: new THREE.Vector3(rand(-9, 9), rand(1, 8), rand(-9, 9)) });
      this.useLight(at, 0xffd24a, 6, 0.4);
    } else if (fx.id === 'plunder') {
      for (const t of targets) {
        const a = this.aimPoint(t);
        const b = this.worldPos(from, 0, 3, -2);
        for (let i = 0; i < 18; i++) {
          const k = i / 18;
          this.spawn(this.TEX.spark, a.clone().lerp(b, k), { add: true, s0: 1.6, s1: 0.3, life: 0.35 + k * 0.3, color: 0xffb060, vel: b.clone().sub(a).multiplyScalar(1.2) });
        }
        this.popNum(t, 'Jammed', 'block');
      }
      if (fx.gallons) this.popNum(from, `+${fx.gallons} gal`, 'zap');
      if (near) sfx.siphon?.();
    } else if (fx.id === 'zero') {
      const at = this.worldPos(from, 0, 3, -4);
      for (let i = 0; i < 30; i++) this.spawn(this.TEX.smoke, at, { s0: 1.5, s1: rand(7, 12), life: rand(0.6, 1.1), a: 0.8, color: 0xd9f6ff, vel: new THREE.Vector3(rand(-22, 22), rand(0, 5), rand(-22, 22)) });
      for (const t of targets) {
        const p = this.aimPoint(t);
        for (let i = 0; i < 12; i++) this.spawn(this.TEX.spark, p, { add: true, s0: 2.2, s1: 0.3, life: 0.7, color: 0xbfeeff, vel: new THREE.Vector3(rand(-5, 5), rand(0, 6), rand(-5, 5)) });
        this.popNum(t, 'Frozen', 'zap');
      }
      this.flash = Math.max(this.flash, this.reduceMotion ? 0.08 : 0.3);
      if (near) sfx.chime();
    } else if (fx.id === 'maw') {
      for (const t of targets) {
        this.rubble(this.aimPoint(t));
        if (fx.eaten) this.popNum(t, 'Devoured', 'crit');
      }
      if (near) sfx.boom(false);
    }
  }

  player() {
    return this.trains[0];
  }

  // ---------- per-frame ----------
  stepTrain(t, dt) {
    const train = t.train;
    const s = train.distance * UNITS_PER_MILE;
    const ds = s - t.s;
    t.s = s;
    t.v = dt > 0 ? ds / dt : 0;
    if (t.creature) return this.stepCreature(t, dt);
    // A boss war-train is not on the line until it arrives, and gone once it has fled.
    if (train.isBoss) {
      const shown = !train.hidden;
      t.cars.forEach((car) => {
        car.visible = shown;
      });
      if (!shown) return;
    }
    if (t.ring) {
      t.ring.rotation.z += dt * 2.2;
      t.ring2.rotation.z -= dt * 1.4;
    }
    const k = this.path.sample(s).k;
    if (train.out) t.tilt = Math.min(0.18, t.tilt + dt * 0.1);
    // Lean into the bend a little at speed.
    const lean = clamp(k * Math.min(t.v, 120) * 0.25, -0.07, 0.07);
    const bob = (train.stagger > 0 ? Math.sin(train.stagger * 40) * 0.08 : 0) + (t.v > 1 ? Math.sin(s * 1.3) * 0.02 : 0);
    t.cars.forEach((car, i) => {
      this.place(car, t.x, s + t.centre[i], 0.7 + bob);
      car.rotation.z = lean + t.tilt * (t.x <= 0 ? -1 : 1);
      car.rotation.order = 'YXZ';
      car.rotation.x = -Math.atan(this.path.slope(s + t.centre[i]));
    });
    t.barrier.visible = train.barrier > 0;
    if (t.windPanels) {
      for (const pivot of t.windPanels) {
        const want = train.panels ? pivot.userData.side * -1.25 : 0;
        pivot.rotation.z += (want - pivot.rotation.z) * Math.min(1, dt * 6);
      }
      if (train.panels && t.v > 2 && Math.random() < dt * 10) {
        for (const side of [-1, 1]) this.spawn(this.TEX.smoke, this.worldPos(t, side * 3.2, 3.8, rand(-17, -14)), { s0: 0.4, s1: 1.4, life: 0.35, a: 0.35, color: 0xdff6ff, vel: this.forward(t.s).multiplyScalar(-6) });
      }
    }
    if (t.barrier.visible) t.barrier.rotation.z += dt * 0.6;
    if (t.orb) t.orb.position.y = t.orb.userData.y + Math.sin(this.time * 3) * 0.25;
    t.crank += ds / 0.8;
    t.wheels.forEach((w) => {
      w.rotation.x += ds / w.userData.r;
    });
    t.rods.forEach((r) => {
      r.position.y = 0.8 + Math.sin(t.crank) * 0.38;
      r.position.z = 0.9 + Math.cos(t.crank) * 0.38;
    });
    // Smoke, only for trains near the camera.
    const me = this.player();
    if (Math.abs(t.s - me.s) > 320) return;
    const boosting = !train.out && train.speed > 1 && (train.lever > 1 || (train.isPlayer && this.race.competitive.boost > 0));
    const v = Math.min(t.v, 120);
    t.smokeAcc += dt * (4 + v * 0.18 + (boosting ? 8 : 0) + (this.race.status === 'ready' ? 3 : 0));
    while (t.smokeAcc > 1) {
      t.smokeAcc--;
      const dead = train.out;
      this.spawn(this.TEX.smoke, this.worldPos(t, rand(-0.2, 0.2), train.model === 'wizard' ? 6.4 : 4.5, 4.6), {
        s0: 1.4,
        s1: dead ? 10 : rand(5, 8),
        life: dead ? 3.5 : rand(1.8, 2.8),
        a: dead ? 0.8 : 0.75,
        color: dead ? 0x2b2725 : train.model === 'wizard' ? 0xc8b6ff : train.model === 'dragon' ? 0x5a4a48 : boosting ? 0xf2f2f2 : 0xbdbdc4,
        vel: new THREE.Vector3(rand(-1, 1), rand(5, 8), rand(-2, 2)),
        drag: 0.97,
      });
      if (dead) this.spawn(this.TEX.fire, this.worldPos(t, rand(-1, 1), 3, rand(-12, 3)), { add: true, s0: 2, s1: 0.5, life: 0.5, vel: new THREE.Vector3(0, 4, 0) });
    }
    // Wading through floodwater: spray off the front and both sides.
    if (train.wading && t.v > 1 && Math.random() < dt * (6 + t.v * 0.3)) {
      for (const side of [-1, 1])
        this.spawn(this.TEX.smoke, this.worldPos(t, side * 1.7, 1.0, rand(-2, 6)), { s0: 0.8, s1: rand(2.5, 4), life: rand(0.4, 0.7), a: 0.8, color: 0xe8f4ff, vel: new THREE.Vector3(side * rand(3, 6), rand(2, 5), rand(-2, 1)), g: -9 });
      this.spawn(this.TEX.smoke, this.worldPos(t, rand(-1, 1), 1.0, 7.5), { s0: 1, s1: 3, life: 0.5, a: 0.75, color: 0xffffff, vel: new THREE.Vector3(rand(-2, 2), rand(3, 5), 2), g: -9 });
    }
    if (train.model === 'dragon' && Math.random() < dt * 6) this.spawn(this.TEX.fire, this.worldPos(t, 0, 2.2, 7.2), { add: true, s0: 1.2, s1: 0.3, life: 0.3, vel: this.forward(t.s).multiplyScalar(t.v + 4) });
    if (boosting && Math.random() < dt * 8)
      for (const side of [-1, 1]) this.spawn(this.TEX.smoke, this.worldPos(t, side * 1.6, 0.8, 3.6), { s0: 0.8, s1: 3.5, life: 0.6, a: 0.7, vel: new THREE.Vector3(side * 5, 1, -2) });
  }

  // A boss creature: place it beside the line at its height, and let it move.
  stepCreature(t, dt) {
    const train = t.train;
    const c = t.creature;
    const g = t.cars[0];
    if (train.out) c.fall += dt;
    g.visible = !train.hidden && c.fall < 2.4;
    t.barrier.visible = train.barrier > 0;
    if (!g.visible) return;
    const drop = c.burrows ? c.fall * 4 : c.fall * c.fall * 7;
    this.place(g, t.x, t.s, 0.7 + c.alt - drop);
    g.rotation.order = 'YXZ';
    g.rotation.z = c.burrows ? 0 : Math.min(1.3, c.fall * 0.9);
    g.rotation.x = c.burrows ? 0 : Math.min(0.8, c.fall * 0.5);
    c.anim(this.time, { windup: !!train.boss?.windup, enraged: !!train.boss?.enraged });
    const me = this.player();
    if (Math.abs(t.s - me.s) > 400) return;
    // The wurm throws up sand where it breaks the ground; a wyrm trails its breath.
    c.dust += dt;
    if (c.burrows && c.dust > 0.08) {
      c.dust = 0;
      for (const z of [-8, 2, 8])
        this.spawn(this.TEX.smoke, this.worldPos(t, rand(-2, 2), 0.2, z + rand(-2, 2)), { s0: 1.5, s1: rand(4, 7), life: rand(0.6, 1), a: 0.6, color: 0xd9b98a, vel: new THREE.Vector3(rand(-3, 3), rand(2, 5), rand(-3, 3)) });
    } else if (!c.burrows && c.dust > 0.12) {
      c.dust = 0;
      const frost = c.look.shot === 'frost';
      this.spawn(frost ? this.TEX.smoke : this.TEX.fire, this.worldPos(t, ...t.muzzleAt), { add: !frost, s0: 0.9, s1: frost ? 3 : 0.3, life: 0.4, a: 0.7, color: frost ? 0xd9f6ff : 0xffffff, vel: this.forward(t.s).multiplyScalar(t.v + 5) });
    }
  }

  siphonStream() {
    const ability = this.race.ability;
    if (!ability || !(ability.activeFor > 0) || !this.siphonFrom || ability.id !== 'siphon') return;
    const from = this.vis(this.siphonFrom);
    if (!from) return;
    const me = this.player();
    if (Math.random() < 0.7) {
      const a = this.worldPos(from, rand(-1, 1), rand(2, 4), rand(-10, 4));
      const b = this.worldPos(me, 0, 3, 0);
      const vel = b.clone().sub(a).multiplyScalar(2.2).add(this.forward(me.s).multiplyScalar(me.v));
      this.spawn(this.TEX.spark, a, { add: true, s0: 1.6, s1: 0.4, life: 0.45, color: 0xffa040, vel, drag: 1 });
    }
  }

  updateCamera(dt) {
    const me = this.player();
    const status = this.race.status;
    let off;
    let look;
    const orbiting = status !== 'running' || me.train.out;
    if (orbiting) {
      this.orbit += dt * (status === 'ready' ? 0.22 : 0.12);
      off = new THREE.Vector3(Math.cos(this.orbit) * 34, 11 + Math.sin(this.orbit * 0.7) * 3, Math.sin(this.orbit) * 34 - 4);
      look = new THREE.Vector3(0, 2.5, -4);
    } else {
      const mode = this.camModes[this.camMode];
      // Lean the camera towards the other tracks so rivals stay in view.
      const lean = me.x < 0 ? 1 : -1;
      if (mode === 'chase') {
        off = new THREE.Vector3(-3 * lean, 15, -30);
        look = new THREE.Vector3(Math.min(this.halfTracks, 4.5) * lean * 0.6, 2, 18);
        // A boss creature rides off to one side and above: pull back and look its way.
        const boss = this.bossVis;
        if (boss?.creature && !boss.train.hidden && !boss.train.out) {
          off.set(-7, 17, -36);
          look.set(4.5, 3 + boss.creature.alt * 0.35, 20);
        }
      } else if (mode === 'helicopter') {
        return this.updateHelicopter(dt);
      } else if (mode === 'birdseye') {
        return this.updateBirdseye(dt);
      } else if (mode === 'side') {
        off = new THREE.Vector3(-30 * lean, 7, 2);
        look = new THREE.Vector3(2 * lean, 2.5, 2);
      } else {
        off = new THREE.Vector3(3 * lean, 6.5, 30);
        look = new THREE.Vector3(0, 2.5, -6);
      }
    }
    const k = 1 - Math.exp(-dt * 3);
    this.camOff.lerp(off, k);
    this.camLook.lerp(look, k);
    // Follow the line round the bends, smoothly.
    const heading = this.path.sample(me.s).h;
    this.camHeading += (heading - this.camHeading) * (1 - Math.exp(-dt * 2.5));
    const cam = this.camera;
    const toWorld = (v) => {
      const c = Math.cos(this.camHeading);
      const sn = Math.sin(this.camHeading);
      const base = this.path.toWorld(me.x, me.s, this.keep);
      // Local x is to the right, z ahead.
      return new THREE.Vector3(base.x + v.x * c + v.z * sn, v.y + base.y, base.z - v.x * sn + v.z * c);
    };
    cam.position.copy(toWorld(this.camOff));
    if (this.shake > 0) {
      cam.position.x += rand(-this.shake, this.shake);
      cam.position.y += rand(-this.shake, this.shake) * 0.6;
      this.shake = Math.max(0, this.shake - dt * 2.5);
    }
    cam.lookAt(toWorld(this.camLook));
    this.followSky(dt, me, orbiting ? 'chase' : this.camModes[this.camMode]);
  }

  // ---------- sighting cinematics ----------
  get CINE() {
    return { slowIn: 0.35, fly: 1.0, back: 2.6, end: 3.4 };
  }

  toggleCine() {
    this.cineOn = !this.cineOn;
    try {
      window.localStorage.setItem('nexus-rails/cine', this.cineOn ? 'on' : 'off');
    } catch {
      // private window: the choice lasts this race only
    }
    if (!this.cineOn) this.cine = null;
    return this.cineOn;
  }

  startCine(fx) {
    if (!this.cineOn || this.cine || this.race.status !== 'running') return;
    const rock = this.rocks.find((r) => r.id === fx.id);
    if (!rock) return;
    this.cine = { t: 0, rock, fx };
    sfx.alert?.();
  }

  skipCine() {
    const T = this.CINE;
    if (this.cine && this.cine.t < T.back) this.cine.t = T.back;
  }

  // What the HUD shows while a sighting plays.
  cineState() {
    if (!this.cine) return null;
    const T = this.CINE;
    return { ...this.cine.fx, holding: this.cine.t >= T.fly * 0.8 && this.cine.t < T.back, t: this.cine.t };
  }

  // 0 = the normal camera, 1 = parked over the obstacle.
  cineBlend() {
    const c = this.cine;
    if (!c) return 0;
    const T = this.CINE;
    const ease = (k) => k * k * (3 - 2 * k);
    if (c.t < T.fly) return ease(c.t / T.fly);
    if (c.t < T.back) return 1;
    return 1 - ease(Math.min(1, (c.t - T.back) / (T.end - T.back)));
  }

  applyCine() {
    const c = this.cine;
    const cam = this.camera;
    const e = this.cineBlend();
    const T = this.CINE;
    const from = cam.position.clone();
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    const fromLook = from.clone().add(dir.multiplyScalar(60));
    const rock = c.rock;
    const base = this.path.toWorld(rock.x, rock.s, this.keep);
    const rockPos = new THREE.Vector3(base.x, 2.5 + base.y, base.z);
    const h = this.path.sample(rock.s).h;
    // a slow circle round the obstacle while it holds
    const orbit = Math.max(0, c.t - T.fly) * 0.22 - 0.55;
    const back = 30;
    const side = 14;
    const ox = Math.sin(h + orbit) * -back + Math.cos(h + orbit) * side;
    const oz = Math.cos(h + orbit) * -back - Math.sin(h + orbit) * side;
    const to = new THREE.Vector3(base.x + ox, 11 + base.y, base.z + oz);
    const pos = from.lerp(to, e);
    // swoop up and over on the way out and back
    pos.y += Math.sin(e * Math.PI) * 85;
    cam.position.copy(pos);
    cam.lookAt(fromLook.lerp(rockPos, e));
    this.sky.position.copy(cam.position);
    this.mountains.position.set(cam.position.x, this.path.elev(this.player().s) * 0.7, cam.position.z);
    const far = this.fogFar + (900 - this.fogFar) * e;
    this.scene.fog.far = far;
    this.scene.fog.near = this.fogNear + (220 - this.fogNear) * e;
  }

  // The span of the field along the line, in scene units: every train still racing or finished.
  fieldSpan() {
    let lo = Infinity;
    let hi = -Infinity;
    for (const t of this.trains) {
      lo = Math.min(lo, t.s);
      hi = Math.max(hi, t.s);
    }
    if (!Number.isFinite(lo)) lo = hi = this.player().s;
    return { lo, hi };
  }

  // Point an orbiting camera at `target` (world), `dist` away, swung by the player's drag. `yaw` 0 is
  // straight behind along the line's heading; `elev` is the angle above the horizon.
  orbitCamera(dt, target, heading, dist, elev, lookAhead = 0) {
    this.camHeading += (heading - this.camHeading) * (1 - Math.exp(-dt * 1.5));
    const yaw = this.camHeading + this.view.yaw;
    const el = clamp(elev + this.view.pitch, 0.18, 1.45);
    const r = dist * this.view.zoom;
    const flat = Math.cos(el) * r;
    const cam = this.camera;
    cam.position.set(target.x - Math.sin(yaw) * flat, target.y + Math.sin(el) * r, target.z - Math.cos(yaw) * flat);
    cam.position.x += Math.sin(this.time * 0.6) * 0.8;
    cam.position.y += Math.sin(this.time * 0.9) * 0.6;
    cam.lookAt(target.x + Math.sin(this.camHeading) * lookAhead, target.y, target.z + Math.cos(this.camHeading) * lookAhead);
  }

  // Helicopter: close above your engine; drag to circle it and look behind or ahead.
  updateHelicopter(dt) {
    const me = this.player();
    const base = this.path.toWorld(me.x, me.s, this.keep);
    const heading = this.path.sample(me.s).h;
    this.orbitCamera(dt, new THREE.Vector3(base.x, base.y + 2, base.z), heading, 82, 0.6, this.view.yaw === 0 ? 14 : 0);
    this.followSky(dt, me, 'helicopter');
  }

  // Bird's-eye: furthest out, framing the whole field from the leader back to the last train.
  updateBirdseye(dt) {
    const me = this.player();
    const span = this.fieldSpan();
    // Keep you in the shot even when the field is strung out: centre between you and the field.
    const lo = Math.max(span.lo, me.s - 1300);
    const hi = Math.min(span.hi, me.s + 1300);
    const mid = (lo + hi) / 2;
    const spread = hi - lo;
    const alt = THREE.MathUtils.clamp(spread * 0.75 + 260, 300, 950);
    const k = 1 - Math.exp(-dt * 1.5);
    this.heliMid = this.heliMid === undefined ? mid : this.heliMid + (mid - this.heliMid) * k;
    this.heliAlt = this.heliAlt === undefined ? alt : this.heliAlt + (alt - this.heliAlt) * k;
    const s = Math.max(0, this.heliMid);
    const base = this.path.toWorld(0, s, this.keep);
    this.orbitCamera(dt, new THREE.Vector3(base.x, base.y, base.z), this.path.sample(s).h, this.heliAlt * 1.08, 1.1);
    this.followSky(dt, me, 'birdseye');
  }

  followSky(dt, me, mode) {
    const cam = this.camera;
    const [near, far] = mode === 'birdseye' ? [700, 3400] : mode === 'helicopter' ? [260, 1500] : [150, 560];
    const k = 1 - Math.exp(-dt * 2);
    this.fogNear += (near - this.fogNear) * k;
    this.fogFar += (far - this.fogFar) * k;
    this.scene.fog.near = this.fogNear;
    this.scene.fog.far = this.fogFar;
    this.sky.position.copy(cam.position);
    // The mountain ring grows with the camera's height, so from high up it stays out on the horizon
    // instead of standing in the middle of the land.
    const ground = this.path.elev(me.s);
    const lift = Math.max(0, cam.position.y - ground);
    const grow = clamp(1 + lift / 140, 1, 9);
    this.mountainScale = this.mountainScale === undefined ? grow : this.mountainScale + (grow - this.mountainScale) * (1 - Math.exp(-dt * 3));
    this.mountains.scale.setScalar(this.mountainScale);
    this.mountains.position.set(cam.position.x, ground * 0.7 + 30 * (this.mountainScale - 1), cam.position.z);
    this.plain.position.set(cam.position.x, ground - 14, cam.position.z);
    // Clouds always float above the camera, so the high views never look down through them.
    for (const c of this.clouds) {
      const o = c.userData.off;
      let z = o.z - ((me.s * 0.15) % 1300);
      if (z < -200) z += 1300;
      const spread = Math.max(1, this.mountainScale * 0.7);
      c.position.set(cam.position.x + o.x * spread, Math.max(o.y, cam.position.y + 90 + o.y * 0.3), cam.position.z + z * spread);
    }
  }

  /** Draw one frame. `dt` is real seconds since the last frame (0 while paused). */
  frame(realDt) {
    // During a sighting, the world runs at a tenth of its speed; the camera keeps real time.
    let factor = 1;
    if (this.cine && realDt > 0) {
      const c = this.cine;
      c.t += realDt;
      const T = this.CINE;
      if (c.t >= T.end) this.cine = null;
      else factor = c.t < T.slowIn ? 1 - 0.9 * (c.t / T.slowIn) : c.t < T.back ? 0.1 : 0.1 + 0.9 * ((c.t - T.back) / (T.end - T.back));
    }
    this.timeFactor = factor;
    const dt = realDt * factor;
    this.time += dt;
    if (dt > 0) {
      this.trains.forEach((t) => this.stepTrain(t, dt));
      this.updateFalling(dt);
      this.updateShots(dt); // first, so a bolt that just landed has its cloud ready for the strike
      this.updateBeams(dt);
      this.drainFx();
      this.siphonStream();
      this.updateParts(dt);
      this.flashLights.forEach((l) => {
        if (l.userData.t > 0) {
          l.userData.t -= dt;
          l.intensity = l.userData.p * Math.max(0, l.userData.t / l.userData.d);
        } else l.intensity = 0;
      });
      const me = this.player();
      // An overheating engine trails dark smoke and sparks.
      this.heatAcc = (this.heatAcc ?? 0) + dt;
      if (this.heatAcc > 0.12) {
        this.heatAcc = 0;
        for (const t of this.trains) {
          if ((t.train.heat ?? 0) < 85 || Math.abs(t.s - me.s) > 400) continue;
          const at = this.worldPos(t, 0, 4, 3);
          this.spawn(this.TEX.smoke, at, { s0: 1.5, s1: 5, life: 1.2, a: 0.6, color: 0x2a2a2a, vel: new THREE.Vector3(rand(-1, 1), rand(2, 4), rand(-1, 1)) });
          if (t.train.heat >= 100) this.spawn(this.TEX.spark, at, { add: true, s0: 1, s1: 0.2, life: 0.5, color: 0xff7a1a, vel: new THREE.Vector3(rand(-3, 3), rand(2, 6), rand(-3, 3)), g: -8 });
        }
      }
      this.chuffAcc += Math.min(me.v, 120) * dt;
      if (this.chuffAcc > 9 && this.race.status === 'running') {
        this.chuffAcc = 0;
        sfx.chuff(me.train.speed);
      }
    }
    // The high cameras need ground laid much further out, behind and ahead.
    const mode = this.camModes[this.camMode];
    const cineAway = this.cine && this.cineBlend() > 0.25;
    if (cineAway) this.updateChunks(this.cine.rock.s, 280, 220, 4);
    else if (mode === 'birdseye') {
      const span = this.fieldSpan();
      const mid = (span.lo + span.hi) / 2;
      const reach = Math.min(1500, (span.hi - span.lo) / 2 + 700);
      this.updateChunks(mid, reach, reach, 3);
    } else if (mode === 'helicopter') this.updateChunks(this.player().s, 700, 900, 3);
    else this.updateChunks(this.player().s);
    this.updateCamera(realDt);
    if (this.cine) this.applyCine(realDt);
    this.updateTags();
    this.flash = Math.max(0, this.flash - dt * 3);
    if (this.flashEl) this.flashEl.style.opacity = this.flash;
    this.updateNums(dt);
    this.renderer.render(this.scene, this.camera);
  }

  // Rocks thrown onto the line drop out of the sky and land with a thump.
  updateFalling(dt) {
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const vis = this.falling[i];
      vis.fall -= dt;
      const k = Math.max(0, vis.fall / 0.55);
      vis.g.position.y = vis.baseY + 60 * k * k;
      if (vis.fall > 0) continue;
      this.falling.splice(i, 1);
      const at = this.worldPos(vis, 0, 1, 0);
      this.rubble(at);
      if (vis.look === 'meteor') this.explode(at, false, 0xff9a40);
      if (Math.abs(vis.s - this.player().s) < 500) {
        sfx.boom(false);
        if (!this.reduceMotion) this.shake = Math.max(this.shake, 0.5);
      }
    }
  }

  // ---------- the course map ----------
  // The whole line, start to finish, turned so the finish is at the top.
  buildMap() {
    const total = this.race.distance * UNITS_PER_MILE;
    const steps = 160;
    const raw = [];
    for (let i = 0; i <= steps; i++) {
      const p = this.path.sample((i / steps) * total);
      raw.push([p.x, p.z]);
    }
    const [fx, fz] = raw[steps];
    const angle = Math.atan2(fx, fz);
    const c = Math.cos(angle);
    const sn = Math.sin(angle);
    const rot = ([x, z]) => [x * c - z * sn, x * sn + z * c];
    const pts = raw.map(rot);
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [x, y] of pts) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    this.map = { pts, rot, minX, maxX, minY, maxY, total };
  }

  mapPoint(s, W, H) {
    const m = this.map;
    const pad = 16;
    const spanX = Math.max(1, m.maxX - m.minX);
    const spanY = Math.max(1, m.maxY - m.minY);
    const scale = Math.min((W - pad * 2) / spanX, (H - pad * 2 - 10) / spanY);
    const p = this.path.sample(Math.min(s, m.total));
    const [x, y] = m.rot([p.x, p.z]);
    return [W / 2 + (x - (m.minX + m.maxX) / 2) * scale, H / 2 + 4 - (y - (m.minY + m.maxY) / 2) * scale];
  }

  drawMap(canvas) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#2a1a6e');
    g.addColorStop(1, '#0a0628');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const total = this.map.total;
    const line = (from, to, color, width) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      const n = 120;
      for (let i = 0; i <= n; i++) {
        const [x, y] = this.mapPoint(from + ((to - from) * i) / n, W, H);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };
    const me = this.player();
    line(0, total, 'rgba(0,0,0,0.45)', 12);
    line(0, total, '#c9ccd6', 7);
    line(0, Math.min(total, me.s), '#ffd24a', 7); // the stretch you have covered
    // Bends ahead glow when they are close.
    for (const bend of this.race.course?.bends ?? []) {
      const a = bend.start * UNITS_PER_MILE;
      const b = bend.end * UNITS_PER_MILE;
      if (b < me.s) continue;
      if (a - me.s < 2.5 * UNITS_PER_MILE) line(Math.max(a, me.s), b, bend.kind === 'sharp' ? '#ff6363' : '#ffb347', 7);
    }
    // finish flag
    const [fx, fy] = this.mapPoint(total, W, H);
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 2; j++) {
        ctx.fillStyle = (i + j) % 2 ? '#111' : '#fff';
        ctx.fillRect(fx - 8 + i * 4, fy - 14 + j * 4, 4, 4);
      }
    // boulders still standing
    for (const r of this.rocks) {
      if (r.rock.destroyed || r.rock.struck || !r.rock.seen) continue;
      const [x, y] = this.mapPoint(r.s, W, H);
      const s = { debris: 2, boulder: 3, large: 4, giant: 6 }[r.rock.size] ?? 3;
      ctx.fillStyle = r.rock.size === 'giant' ? '#ff6363' : '#c8b89c';
      ctx.fillRect(x - s, y - s, s * 2, s * 2);
    }
    // Rivals first so the player's dot sits on top.
    for (let i = this.trains.length - 1; i >= 0; i--) {
      const t = this.trains[i];
      if (t.train.hidden) continue;
      const [x, y] = this.mapPoint(t.train.distance * UNITS_PER_MILE, W, H);
      if (t.train.isBoss) {
        // The boss: a red diamond.
        ctx.fillStyle = t.train.out ? '#555' : '#ff4a3a';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y - 10);
        ctx.lineTo(x + 9, y);
        ctx.lineTo(x, y + 10);
        ctx.lineTo(x - 9, y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        continue;
      }
      ctx.fillStyle = t.train.out ? '#555' : liveryFor(t.train).css;
      ctx.beginPath();
      ctx.arc(x, y, t.train.isPlayer ? 9 : 7, 0, 7);
      ctx.fill();
      ctx.strokeStyle = t.train.isPlayer ? '#fff' : 'rgba(255,255,255,0.8)';
      ctx.lineWidth = t.train.isPlayer ? 3 : 2;
      ctx.stroke();
    }
  }

  dispose() {
    window.removeEventListener('resize', this.onResize);
    this.unbindDrag?.();
    this.nums.forEach((n) => n.el.remove());
    const textures = new Set(Object.values(this.TEX));
    this.scene.traverse((o) => {
      o.geometry?.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      mats.forEach((m) => {
        if (m.map) textures.add(m.map);
        m.dispose();
      });
    });
    textures.forEach((t) => t.dispose());
    Object.values(this.G).forEach((g) => g.dispose());
    this.renderer.dispose();
  }
}
