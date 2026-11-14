// Draws the people: low-poly soldiers built from boxes on a small jointed rig, posed from each
// actor's state (walking, aiming, crouched, prone, down, hands up). Distant soldiers switch to a
// single merged figure. Also draws the things people use: range targets, dummies, crates, grenades.

import * as THREE from 'three';
import { GeoBuilder } from './geo.js';

const SKIN = [0xf0c8a0, 0xd9a878, 0xb98058, 0x8d5a3b, 0x5f3d28];
const OUTFITS = {
  ally: { cloth: 0x5c6b3d, legs: 0x556238, vest: 0x47522f, hat: 0x4f5d38, pack: 0x3f4a2b, band: null },
  officer: { cloth: 0x4a5636, legs: 0x444f32, vest: null, hat: 0x3d4a2d, pack: null, band: null },
  medic: { cloth: 0xdad7c9, legs: 0x556238, vest: null, hat: 0x4f5d38, pack: null, band: 0xb5392d },
  legion: { cloth: 0x3b3e44, legs: 0x33363b, vest: 0x25272b, hat: 0x2c2f34, pack: null, band: 0xb5392d },
  legionHeavy: { cloth: 0x2c2e33, legs: 0x26282c, vest: 0x17181b, hat: 0x1c1d20, pack: 0x17181b, band: 0xb5392d, bulky: true },
  legionOfficer: { cloth: 0x4b4138, legs: 0x3a332c, vest: null, hat: 0x8f2a22, pack: null, band: 0xb5392d },
  captive: { cloth: 0xb49b6c, legs: 0x8d7a56, vest: null, hat: null, pack: null, band: null },
  civilian: { cloth: 0x6f86a3, legs: 0x5a4a3a, vest: null, hat: 0x7a6a50, pack: null, band: null },
  camo: { cloth: 0x4a5a34, legs: 0x4a5a34, vest: 0x3d4a2b, hat: 0x445230, pack: null, band: null },
  found: { cloth: 0xff9a2e, legs: 0xff9a2e, vest: 0xffc24a, hat: 0xffc24a, pack: null, band: null },
};
const CIV_TINTS = [0x6f86a3, 0x9a6a4a, 0x6b8a5a, 0x8a8a92];
const BOOT = 0x26221d;
const GUN = 0x1d1f21;
const WOOD = 0x6b4a2c;

const HIP = 0.92;
const geoCache = new Map();
const cached = (key, make) => {
  let g = geoCache.get(key);
  if (!g) geoCache.set(key, (g = make()));
  return g;
};
export const soldierMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });

function outfitOf(look) {
  const base = OUTFITS[look.outfit] ?? OUTFITS.ally;
  if (look.outfit === 'civilian') return { ...base, cloth: CIV_TINTS[look.tint ?? 0] };
  return base;
}

// ---------- the pieces ----------
function addHat(b, hat, color, y) {
  if (hat === 'helmet') {
    b.box(0, y + 0.07, 0, 0.26, 0.15, 0.28, color);
    b.box(0, y + 0.02, -0.02, 0.29, 0.04, 0.31, color);
  } else if (hat === 'heavy') {
    b.box(0, y + 0.07, 0, 0.28, 0.17, 0.3, color);
    b.box(0, y - 0.08, -0.13, 0.24, 0.16, 0.04, 0x0e0f10);
  } else if (hat === 'cap') {
    b.box(0, y + 0.05, 0, 0.23, 0.09, 0.24, color);
    b.box(0, y + 0.02, -0.16, 0.2, 0.025, 0.12, color);
  } else if (hat === 'boonie') {
    b.box(0, y + 0.05, 0, 0.22, 0.09, 0.23, color);
    b.box(0, y + 0.01, 0, 0.42, 0.025, 0.42, color);
  } else if (hat === 'beret') {
    b.box(0.02, y + 0.04, 0, 0.27, 0.07, 0.25, color);
  } else if (hat === 'campaign') {
    b.box(0, y + 0.08, 0, 0.2, 0.13, 0.2, 0x5a4a32);
    b.box(0, y + 0.02, 0, 0.46, 0.025, 0.46, 0x5a4a32);
  } else if (hat === 'none') {
    b.box(0, y + 0.02, 0.01, 0.22, 0.07, 0.23, 0x2a2018);
  }
}

// Torso, head and headgear, with its origin at the hips.
function bodyGeo(look) {
  const o = outfitOf(look);
  const skin = SKIN[look.skin ?? 0];
  const b = new GeoBuilder();
  const wide = o.bulky ? 1.18 : 1;
  b.box(0, 0, 0, 0.36 * wide, 0.2, 0.22, o.legs);
  b.box(0, 0.36, 0, 0.42 * wide, 0.52, 0.25, o.cloth);
  if (o.vest) b.box(0, 0.38, 0, 0.46 * wide, 0.4, 0.31 * wide, o.vest);
  if (o.vest) for (const x of [-0.12, 0, 0.12]) b.box(x, 0.24, -0.17 * wide, 0.09, 0.13, 0.05, o.vest);
  if (o.pack) b.box(0, 0.42, 0.21, 0.3, 0.36, 0.15, o.pack);
  if (look.medic) b.box(0, 0.44, -0.165, 0.12, 0.12, 0.02, 0xe9e7dd);
  b.box(0, 0.66, 0, 0.12, 0.08, 0.12, skin);
  b.box(0, 0.8, 0, 0.21, 0.24, 0.22, skin);
  b.box(-0.05, 0.83, -0.112, 0.035, 0.03, 0.01, 0x1a1a1a);
  b.box(0.05, 0.83, -0.112, 0.035, 0.03, 0.01, 0x1a1a1a);
  if (o.hat || look.hat === 'none') addHat(b, o.hat ? look.hat : 'none', o.hat ?? 0, 0.92);
  return b.build();
}
function upperArmGeo(look, left) {
  const o = outfitOf(look);
  const b = new GeoBuilder();
  b.box(0, -0.15, 0, 0.11, 0.32, 0.12, o.cloth);
  if (o.band && left) b.box(0, -0.12, 0, 0.125, 0.07, 0.135, o.band);
  return b.build();
}
function foreArmGeo(look) {
  const o = outfitOf(look);
  const b = new GeoBuilder();
  b.box(0, -0.13, 0, 0.1, 0.28, 0.11, o.cloth);
  b.box(0, -0.31, 0, 0.09, 0.09, 0.1, SKIN[look.skin ?? 0]);
  return b.build();
}
function thighGeo(look) {
  const b = new GeoBuilder();
  b.box(0, -0.22, 0, 0.16, 0.44, 0.17, outfitOf(look).legs);
  return b.build();
}
function shinGeo(look) {
  const b = new GeoBuilder();
  b.box(0, -0.2, 0, 0.13, 0.4, 0.15, outfitOf(look).legs);
  b.box(0, -0.44, -0.04, 0.14, 0.1, 0.25, BOOT);
  return b.build();
}
// Barrel along -z, grip at the origin.
function weaponGeo(kind) {
  const b = new GeoBuilder();
  if (kind === 'pistol') {
    b.box(0, 0.02, -0.08, 0.035, 0.06, 0.2, GUN);
    b.box(0, -0.05, 0, 0.035, 0.11, 0.05, GUN);
  } else if (kind === 'smg') {
    b.box(0, 0.02, -0.14, 0.055, 0.09, 0.42, GUN);
    b.box(0, -0.1, -0.08, 0.035, 0.18, 0.06, GUN);
    b.box(0, 0.03, 0.14, 0.04, 0.05, 0.16, GUN);
    b.box(0, 0.03, -0.42, 0.045, 0.045, 0.16, GUN);
  } else if (kind === 'shotgun') {
    b.box(0, 0.02, -0.25, 0.05, 0.07, 0.7, GUN);
    b.box(0, -0.02, -0.38, 0.06, 0.06, 0.24, WOOD);
    b.box(0, 0, 0.2, 0.05, 0.1, 0.26, WOOD);
  } else if (kind === 'lmg') {
    b.box(0, 0.02, -0.25, 0.07, 0.12, 0.75, GUN);
    b.box(0, -0.12, -0.12, 0.14, 0.14, 0.16, 0x3f4a2b);
    b.box(0, 0.03, -0.75, 0.035, 0.035, 0.3, GUN);
    b.box(0, 0, 0.22, 0.05, 0.11, 0.24, GUN);
    b.box(0, -0.12, -0.72, 0.02, 0.2, 0.02, GUN);
  } else if (kind === 'dmr') {
    b.box(0, 0.02, -0.28, 0.055, 0.09, 0.78, GUN);
    b.box(0, 0.03, -0.82, 0.03, 0.03, 0.34, GUN);
    b.box(0, 0.1, -0.2, 0.045, 0.05, 0.28, 0x111213);
    b.box(0, -0.1, -0.1, 0.035, 0.14, 0.07, GUN);
    b.box(0, 0, 0.22, 0.05, 0.11, 0.26, WOOD);
  } else {
    b.box(0, 0.02, -0.2, 0.055, 0.1, 0.6, GUN);
    b.box(0, 0.03, -0.6, 0.03, 0.03, 0.24, GUN);
    b.box(0, -0.12, -0.08, 0.04, 0.17, 0.08, GUN);
    b.box(0, 0, 0.19, 0.05, 0.1, 0.23, GUN);
  }
  return b.build();
}

// One merged figure for the far distance (and for dummies).
function figureGeo(look, crouch) {
  const o = outfitOf(look);
  const skin = SKIN[look.skin ?? 0];
  const b = new GeoBuilder();
  const hip = crouch ? 0.55 : HIP;
  if (crouch) {
    b.box(-0.1, 0.42, -0.2, 0.16, 0.17, 0.44, o.legs);
    b.box(0.1, 0.2, 0.05, 0.16, 0.4, 0.2, o.legs);
    b.box(-0.1, 0.2, -0.36, 0.14, 0.4, 0.15, o.legs);
  } else {
    b.box(-0.1, 0.48, 0, 0.16, 0.88, 0.17, o.legs);
    b.box(0.1, 0.48, 0, 0.16, 0.88, 0.17, o.legs);
    b.box(-0.1, 0.05, -0.04, 0.14, 0.1, 0.25, BOOT);
    b.box(0.1, 0.05, -0.04, 0.14, 0.1, 0.25, BOOT);
  }
  b.box(0, hip + 0.36, 0, 0.42, 0.52, 0.25, o.cloth);
  if (o.vest) b.box(0, hip + 0.38, 0, 0.46, 0.4, 0.31, o.vest);
  b.box(-0.27, hip + 0.3, -0.08, 0.11, 0.5, 0.14, o.cloth);
  b.box(0.27, hip + 0.3, -0.08, 0.11, 0.5, 0.14, o.cloth);
  b.box(0, hip + 0.8, 0, 0.21, 0.24, 0.22, skin);
  if (o.hat) addHat(b, look.hat, o.hat, hip + 0.92);
  if (look.weapon && look.weapon !== 'none') b.box(0.12, hip + 0.3, -0.3, 0.06, 0.1, 0.7, GUN);
  return b.build();
}

const lookKey = (look) => `${look.outfit}|${look.skin ?? 0}|${look.hat}|${look.tint ?? 0}|${look.medic ? 1 : 0}`;

// ---------- one soldier ----------
export class SoldierView {
  constructor(look) {
    this.look = { ...look };
    const key = lookKey(look);
    const mesh = (geo) => {
      const m = new THREE.Mesh(geo, soldierMaterial);
      m.castShadow = true;
      return m;
    };
    this.root = new THREE.Group();
    this.tilt = new THREE.Group();
    this.root.add(this.tilt);
    this.hips = new THREE.Group();
    this.hips.position.y = HIP;
    this.tilt.add(this.hips);
    this.hips.add(mesh(cached(`body|${key}`, () => bodyGeo(look))));
    const arm = (side) => {
      const upper = new THREE.Group();
      upper.position.set(side * 0.265, 0.56, 0);
      upper.add(mesh(cached(`ua|${key}|${side}`, () => upperArmGeo(look, side < 0))));
      const fore = new THREE.Group();
      fore.position.y = -0.31;
      fore.add(mesh(cached(`fa|${key}`, () => foreArmGeo(look))));
      upper.add(fore);
      this.hips.add(upper);
      return { upper, fore };
    };
    const leg = (side) => {
      const thigh = new THREE.Group();
      thigh.position.set(side * 0.1, -0.06, 0);
      thigh.add(mesh(cached(`th|${key}`, () => thighGeo(look))));
      const shin = new THREE.Group();
      shin.position.y = -0.44;
      shin.add(mesh(cached(`sh|${key}`, () => shinGeo(look))));
      thigh.add(shin);
      this.hips.add(thigh);
      return { thigh, shin };
    };
    this.armL = arm(-1);
    this.armR = arm(1);
    this.legL = leg(-1);
    this.legR = leg(1);
    this.weapon = null;
    this.weaponKind = null;
    this.setWeapon(look.weapon ?? 'none');
    // the far-away stand-in
    this.far = mesh(cached(`fig|${key}|${look.weapon}|0`, () => figureGeo(look, false)));
    this.farCrouch = cached(`fig|${key}|${look.weapon}|1`, () => figureGeo(look, true));
    this.farStand = this.far.geometry;
    this.far.visible = false;
    this.root.add(this.far);
    this.pose = { hipY: HIP, lean: 0, tiltX: 0, tiltY: 0, aLx: 0, aLz: 0, fLx: 0, aRx: 0, aRz: 0, fRx: 0, lLx: 0, sLx: 0, lRx: 0, sRx: 0 };
    this.fallSide = 1;
  }

  setWeapon(kind) {
    if (kind === this.weaponKind) return;
    if (this.weapon) this.armR.fore.remove(this.weapon);
    this.weapon = null;
    this.weaponKind = kind;
    if (kind && kind !== 'none') {
      this.weapon = new THREE.Mesh(cached(`w|${kind}`, () => weaponGeo(kind)), soldierMaterial);
      this.weapon.castShadow = true;
      this.weapon.position.set(0, -0.3, -0.03);
      this.weapon.rotation.x = -Math.PI / 2;
      this.armR.fore.add(this.weapon);
    }
  }

  // s: { x, y, z, yaw, stance, speed, walk, aim, fire, hit, death, hands, pitch, armed }
  update(s, dt, far) {
    const root = this.root;
    root.position.set(s.x, s.y, s.z);
    root.rotation.y = -s.yaw;
    if (far && s.death < 0.05) {
      // one merged figure when small on screen
      if (!this.far.visible) {
        this.far.visible = true;
        this.tilt.visible = false;
      }
      this.far.geometry = s.stance === 'stand' ? this.farStand : this.farCrouch;
      this.far.rotation.x = s.stance === 'prone' ? -Math.PI / 2 : 0;
      this.far.position.y = s.stance === 'prone' ? 0.25 : 0;
      return;
    }
    if (this.far.visible) {
      this.far.visible = false;
      this.tilt.visible = true;
    }
    const p = this.pose;
    const k = Math.min(1, dt * 12);
    const to = (name, v) => {
      p[name] += (v - p[name]) * k;
    };
    const armed = this.weapon && s.hands === 0;
    if (this.weapon) this.weapon.visible = s.hands === 0;
    const moving = s.speed > 0.3 && s.death < 0.05;
    const swing = moving ? Math.sin(s.walk) : 0;
    const swing2 = moving ? Math.sin(s.walk + Math.PI) : 0;
    const stride = Math.min(1, s.speed / 4) * 0.75 + (moving ? 0.25 : 0);
    let hipY = HIP;
    let lean = moving ? -0.08 * stride : 0;
    let tiltX = 0;
    let tiltY = 0;
    let lLx = swing * stride * 0.8;
    let lRx = swing2 * stride * 0.8;
    let sLx = -Math.max(0, Math.sin(s.walk + 1.3)) * stride * 1.1;
    let sRx = -Math.max(0, Math.sin(s.walk + 1.3 + Math.PI)) * stride * 1.1;
    let aLx;
    let aRx;
    let fLx;
    let fRx;
    let aLz = 0;
    let aRz = 0;
    if (armed) {
      // low ready, rising to the shoulder as the aim comes up
      const a = s.aim;
      aRx = 0.35 + a * 0.95 + (s.pitch ?? 0) * a;
      fRx = 0.75 - a * 0.5;
      aLx = 0.75 + a * 0.6 + (s.pitch ?? 0) * a;
      fLx = 0.7 - a * 0.4;
      aLz = 0.55;
      aRz = -0.12 * a;
      aRx -= s.fire * 0.12;
    } else {
      aLx = swing2 * stride * 0.7;
      aRx = swing * stride * 0.7;
      fLx = 0.15 + stride * 0.3;
      fRx = 0.15 + stride * 0.3;
    }
    if (s.hands === 1) {
      aLx = aRx = 2.95;
      fLx = fRx = 0.2;
      aLz = -0.15;
      aRz = 0.15;
    } else if (s.hands === 2) {
      aLx = aRx = -0.55;
      fLx = fRx = -0.5;
      aLz = 0.3;
      aRz = -0.3;
    }
    if (s.stance === 'crouch') {
      hipY = 0.55;
      lean -= 0.12;
      lLx = 1.45 + swing * 0.2 * stride;
      sLx = -1.75;
      lRx = 0.25 + swing2 * 0.2 * stride;
      sRx = -1.7;
    } else if (s.stance === 'prone') {
      hipY = HIP;
      tiltX = -Math.PI / 2 + 0.06;
      tiltY = 0.24;
      lLx = swing * 0.25 * stride;
      lRx = swing2 * 0.25 * stride;
      sLx = sRx = 0;
      lean = 0.1;
      if (armed) {
        aRx = 2.5;
        aLx = 2.4;
        fRx = 0.25;
        fLx = 0.35;
      }
    }
    if (s.death > 0) {
      const d = s.death;
      tiltX = tiltX * (1 - d) + this.fallSide * (Math.PI / 2 - 0.05) * d;
      tiltY = tiltY * (1 - d) + 0.14 * d;
      hipY = hipY * (1 - d) + HIP * d;
      aLx = aLx * (1 - d) + 0.4 * d;
      aRx = aRx * (1 - d) - 0.3 * d;
      aLz = 0.5 * d;
      aRz = -0.6 * d;
      lLx *= 1 - d;
      lRx = lRx * (1 - d) + 0.25 * d;
      sLx *= 1 - d;
      sRx *= 1 - d;
      lean *= 1 - d;
    }
    to('hipY', hipY);
    to('lean', lean + s.hit * 0.25);
    p.tiltX += (tiltX - p.tiltX) * Math.min(1, dt * (s.death > 0 ? 9 : 7));
    to('tiltY', tiltY);
    to('aLx', aLx);
    to('aRx', aRx);
    to('fLx', fLx);
    to('fRx', fRx);
    to('aLz', aLz);
    to('aRz', aRz);
    to('lLx', lLx);
    to('lRx', lRx);
    to('sLx', sLx);
    to('sRx', sRx);
    this.hips.position.y = p.hipY + (moving ? Math.abs(Math.sin(s.walk)) * 0.035 : 0);
    this.hips.rotation.x = p.lean;
    this.tilt.rotation.x = p.tiltX;
    this.tilt.position.y = p.tiltY;
    this.armL.upper.rotation.x = p.aLx;
    this.armL.upper.rotation.z = p.aLz;
    this.armL.fore.rotation.x = p.fLx;
    this.armR.upper.rotation.x = p.aRx;
    this.armR.upper.rotation.z = p.aRz;
    this.armR.fore.rotation.x = p.fRx;
    this.legL.thigh.rotation.x = p.lLx;
    this.legL.shin.rotation.x = p.sLx;
    this.legR.thigh.rotation.x = p.lRx;
    this.legR.shin.rotation.x = p.sRx;
  }
}

const WEAPON_LOOK = { pistol: 'pistol', smg: 'smg', carbine: 'rifle', rifle: 'rifle', dmr: 'dmr', sniper: 'dmr', shotgun: 'shotgun', lmg: 'lmg' };

// ---------- everyone and everything ----------
export class ActorViews {
  constructor(scene, sim) {
    this.scene = scene;
    this.sim = sim;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.views = new Map();
    this.props = new Map();
    this.state = {};
    this.player = null;
    this.playerLook = '';
    this.boxMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.propGeos = {};
    this.buildPropGeos();
  }

  buildPropGeos() {
    const g = this.propGeos;
    let b = new GeoBuilder();
    b.box(0, 0.4, 0, 0.9, 0.8, 0.9, 0x6f5d3a);
    b.box(0, 0.82, 0, 0.94, 0.05, 0.94, 0x55472c);
    b.box(0, 0.4, 0, 0.94, 0.08, 0.94, 0x55472c);
    g.cache = b.build();
    b = new GeoBuilder();
    b.box(0, 0.12, 0, 0.42, 0.24, 0.28, 0x4d5a34);
    b.box(0, 0.25, 0, 0.44, 0.03, 0.3, 0x39452a);
    g.ammo = b.build();
    b = new GeoBuilder();
    b.box(0, 0.86, 0, 0.34, 0.03, 0.26, 0xf0ead8);
    b.box(0.03, 0.89, 0.02, 0.3, 0.02, 0.24, 0xd9cfae);
    g.intel = b.build();
    b = new GeoBuilder();
    b.box(0, 0.6, 0, 0.5, 0.5, 0.3, 0xb5392d);
    b.box(0, 0.9, 0, 0.1, 0.12, 0.1, 0xf0c24a);
    g.charge = b.build();
    b = new GeoBuilder();
    b.box(0, 0.55, 0, 1.3, 1.1, 1.3, 0x5c6b3d);
    b.box(0, 1.12, 0, 1.34, 0.06, 1.34, 0xe9e7dd);
    g.supply = b.build();
    b = new GeoBuilder();
    b.blob(0, 0, 0, 0.07, 0x2b3322, 1.2, 0.05, 3);
    g.grenade = b.build();
    b = new GeoBuilder();
    b.cyl(0, 0.04, 0, 0.16, 0.08, 0x3a4028, 8);
    g.mine = b.build();
    // a range target: post, and a board hinged at the top of the post (pivot at the origin)
    b = new GeoBuilder();
    b.box(0, 0.35, 0, 0.08, 0.7, 0.08, 0x6b4a2c);
    g.post = b.build();
    b = new GeoBuilder();
    b.box(0, 0.47, 0, 0.05, 0.94, 0.62, 0xe9e1d1);
    b.box(0.03, 0.5, 0, 0.02, 0.5, 0.36, 0x23262a);
    b.box(0.045, 0.5, 0, 0.02, 0.2, 0.16, 0xc93a2c);
    g.board = b.build();
  }

  // What the player's own figure wears, from the save.
  playerLookOf() {
    const save = this.sim.save;
    const helmet = save.loadout.gear.helmet;
    const uniform = save.loadout.gear.uniform;
    const w = this.sim.player.weapon;
    return { outfit: uniform === 'ghillie' ? 'camo' : 'ally', skin: save.look?.skin ?? 0, hat: helmet ? 'helmet' : 'cap', weapon: w ? WEAPON_LOOK[w.eff.class] ?? 'rifle' : 'none' };
  }

  sync(dt, camera, zoom) {
    const sim = this.sim;
    const seen = new Set();
    const cx = camera.position.x;
    const cz = camera.position.z;
    const st = this.state;
    for (const a of sim.actors) {
      if (a.gone) continue;
      seen.add(a.id);
      let v = this.views.get(a.id);
      if (!v) {
        v = new SoldierView(a.look);
        v.fallSide = a.id % 2 ? 1 : -1;
        this.views.set(a.id, v);
        this.group.add(v.root);
      }
      const d = Math.hypot(a.x - cx, a.z - cz);
      const visible = d < 900;
      v.root.visible = visible;
      if (!visible) continue;
      st.x = a.x;
      st.y = a.y;
      st.z = a.z;
      st.yaw = a.yaw;
      st.stance = a.downed ? 'stand' : a.stance;
      st.speed = a.moveState === 'still' ? 0 : a.moveState === 'walk' ? 1.5 : a.moveState === 'run' ? 3.7 : 5.3;
      st.walk = a.anim.walk;
      st.aim = a.anim.aim;
      st.fire = a.anim.fire;
      st.hit = a.anim.hit;
      st.death = a.anim.death;
      st.hands = a.anim.hands;
      st.pitch = 0;
      v.update(st, dt, d / zoom > 95);
    }
    for (const [id, v] of this.views) {
      if (seen.has(id)) continue;
      this.group.remove(v.root);
      this.views.delete(id);
    }
    this.syncPlayer(dt);
    this.syncProps(dt);
  }

  syncPlayer(dt) {
    const sim = this.sim;
    const p = sim.player;
    const look = this.playerLookOf();
    const key = `${lookKey(look)}`;
    if (!this.player || this.playerLook !== key) {
      if (this.player) this.group.remove(this.player.root);
      this.player = new SoldierView(look);
      this.playerLook = key;
      this.group.add(this.player.root);
    }
    this.player.setWeapon(p.binoc ? 'none' : look.weapon);
    const st = this.state;
    st.x = p.x;
    st.y = p.y;
    st.z = p.z;
    st.yaw = p.yaw;
    st.stance = p.downed ? 'prone' : p.stance;
    st.speed = p.speedNow;
    this.walk = (this.walk ?? 0) + p.speedNow * dt * 2.4;
    st.walk = this.walk;
    st.aim = Math.max(p.aimT, sim.time - p.lastShot < 0.6 ? 0.8 : 0);
    st.fire = sim.time - p.lastShot < 0.08 ? 1 : 0;
    st.hit = sim.time - p.lastHurt < 0.25 ? 1 : 0;
    this.deadT = p.alive ? 0 : Math.min(1, (this.deadT ?? 0) + dt * 2);
    st.death = this.deadT;
    st.hands = 0;
    st.pitch = p.pitch;
    this.player.update(st, dt, false);
    this.player.root.visible = p.cam.mode === 'third';
  }

  // Targets, dummies, crates, grenades: one small mesh each, made on demand.
  syncProps(dt) {
    const sim = this.sim;
    const seen = new Set();
    const g = this.propGeos;
    const use = (key, make) => {
      seen.add(key);
      let o = this.props.get(key);
      if (!o) {
        o = make();
        this.props.set(key, o);
        this.group.add(o);
      }
      return o;
    };
    const mesh = (geo) => {
      const m = new THREE.Mesh(geo, this.boxMat);
      m.castShadow = true;
      return m;
    };
    for (const t of sim.shootables) {
      if (!t.target) continue;
      const o = use(t, () => {
        const group = new THREE.Group();
        group.add(mesh(g.post));
        const board = mesh(g.board);
        board.position.y = 0.68;
        group.add(board);
        group.userData.board = board;
        group.position.set(t.x, t.base, t.z);
        return group;
      });
      // flat on its back when down, upright facing the firing line (+x) when up
      o.userData.board.rotation.z = (1 - t.up) * (Math.PI / 2);
    }
    for (const d of sim.dummies) {
      const o = use(d, () => {
        const look = { outfit: 'camo', skin: 2, hat: 'boonie', weapon: 'rifle' };
        const m = new THREE.Mesh(cached(`fig|dummy|${d.stance}`, () => figureGeo(look, d.stance === 'crouch')), soldierMaterial);
        m.position.set(d.x, d.y, d.z);
        m.rotation.y = d.yaw;
        return m;
      });
      if (d.found && !o.userData.found) {
        o.userData.found = true;
        o.geometry = cached('fig|found', () => figureGeo({ outfit: 'found', skin: 2, hat: 'boonie', weapon: 'none' }, d.stance === 'crouch'));
      }
    }
    for (const it of sim.interactables) {
      const geo = it.kind === 'cache' ? g.cache : it.kind === 'ammo' ? g.ammo : it.kind === 'intel' ? g.intel : it.kind === 'charge' ? g.charge : it.kind === 'supply' ? g.supply : null;
      if (!geo || it.gone) continue;
      const o = use(it, () => {
        const m = mesh(geo);
        m.position.set(it.x, it.y ?? sim.world.terrain.heightAt(it.x, it.z), it.z);
        m.rotation.y = (it.x * 7.3) % 6.28;
        return m;
      });
      if (it.kind === 'charge') o.visible = Math.sin(sim.time * 5) > -0.4;
    }
    for (const c of sim.mission?.planted ?? []) {
      use(c, () => {
        const m = mesh(g.charge);
        m.position.set(c.x, c.y, c.z);
        return m;
      });
    }
    for (const p of sim.projectiles) {
      const o = use(p, () => mesh(g.grenade));
      o.position.set(p.x, p.y, p.z);
      o.rotation.x = p.spin;
    }
    for (const m of sim.mines) {
      use(m, () => {
        const o = mesh(g.mine);
        o.position.set(m.x, m.y, m.z);
        return o;
      });
    }
    for (const [key, o] of this.props) {
      if (seen.has(key)) continue;
      this.group.remove(o);
      this.props.delete(key);
    }
    void dt;
  }

  dispose() {
    this.scene.remove(this.group);
  }
}
