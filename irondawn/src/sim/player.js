// The player's soldier in the world: moving, climbing, stances, stamina, aiming, firing, throwing,
// healing, spotting and using things. Everything the attributes change comes in through
// sim.derived (deriveStats) and each weapon's weaponEff numbers.

import { B, clamp } from '../game/balance.js';
import { canTakedown, concealment, footstepNoise, shotDamage, shotSpread, surrenderChance } from '../game/combat.js';
import { primaryOf, secondaryOf, weaponEff } from '../game/character.js';
import { THROWABLES } from '../game/items.js';
import { EYE_HEIGHT, STANCE_HEIGHT, rayActor } from './actors.js';
import { raySphere } from './colliders.js';
import { angleDiff } from './ai.js';

const DEG = Math.PI / 180;
const GRAVITY = 18;
const JUMP = 6;
const RADIUS = 0.35;

export class Player {
  constructor(sim) {
    this.sim = sim;
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    this.yaw = 0;
    this.pitch = 0;
    this.stance = 'stand';
    this.height = STANCE_HEIGHT.stand;
    this.eye = EYE_HEIGHT.stand;
    this.grounded = true;
    this.alive = true;
    this.downed = false;
    this.downedUntil = 0;
    this.health = 100;
    this.stamina = 100;
    this.moveState = 'still';
    this.speedNow = 0;
    this.sprinting = false;
    this.concealed = 1;
    this.ground = null;
    // weapons
    this.weapons = [null, null];
    this.cur = 0;
    this.aimT = 0;
    this.scoped = false;
    this.binoc = false;
    this.nvg = false;
    this.bloom = 0;
    this.recoilBack = 0;
    this.reloading = 0;
    this.switching = 0;
    this.busy = 0; // seconds locked in an action (healing, takedown)
    this.busyKind = null;
    this.settled = 0; // seconds the scope has been steady
    this.breath = 1;
    this.holding = false;
    this.winded = 0;
    this.swayT = Math.random() * 10;
    this.swayX = 0;
    this.swayY = 0;
    this.throwable = 'frag';
    this.items = {};
    this.lastShot = -99;
    this.lastLoudShot = -99;
    this.lastHurt = -99;
    this.stimUntil = 0;
    this.flashed = 0;
    // climbing
    this.climb = null;
    // spotting and using
    this.tagTarget = null;
    this.tagT = 0;
    this.prompt = null;
    this.hold = 0;
    this.holdRef = null;
    this.watch = 0; // highest awareness any sentry has of you
    this.locked = false;
    this.bounds = null;
    this.strideLeft = 0;
    this.spotTimer = 0;
    this.demandCool = new Map();
    this.cam = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, fov: 68, mode: 'third' };
    this.fovScale = 1;
    this.hurtFrom = null;
  }

  // ---------- setup ----------
  place(x, z, yaw = 0) {
    this.x = x;
    this.z = z;
    this.y = this.sim.world.colliders.floorAt(x, z, this.sim.world.terrain.heightAt(x, z) + 0.5);
    this.yaw = yaw;
    this.pitch = 0;
    this.vx = this.vy = this.vz = 0;
    this.grounded = true;
    this.climb = null;
    this.stance = 'stand';
  }

  // Builds the two weapon slots from the save (or a weapon issued for one mission).
  loadWeapons(save, derived, issue = null) {
    const make = (instance, old) => {
      if (!instance) return null;
      const eff = weaponEff(save, instance, derived);
      if (!eff) return null;
      const same = old && old.eff.uid === eff.uid;
      return { eff, mag: same ? Math.min(old.mag, eff.mag) : eff.mag, reserve: same ? Math.min(old.reserve, eff.reserveMax) : eff.reserveMax, cool: 0, zoomIndex: 0 };
    };
    const primary = issue ? { uid: `issue-${issue.weapon}`, id: issue.weapon, att: issue.att ?? {} } : primaryOf(save);
    this.weapons = [make(primary, this.weapons[0]), make(secondaryOf(save), this.weapons[1])];
    if (!this.weapons[this.cur]) this.cur = this.weapons[0] ? 0 : 1;
  }
  get weapon() {
    return this.weapons[this.cur];
  }
  refill(share = 1) {
    for (const w of this.weapons) {
      if (!w) continue;
      w.mag = w.eff.mag;
      w.reserve = Math.max(w.reserve, Math.round(w.eff.reserveMax * share));
    }
  }

  // ---------- being hit ----------
  hurt(amount, info = {}) {
    if (!this.alive || this.downed || this.sim.godMode) return;
    const sim = this.sim;
    this.health -= amount;
    this.lastHurt = sim.time;
    this.hurtFrom = info.from ? { x: info.from.x, z: info.from.z, t: sim.time } : null;
    sim.fx.push({ t: 'hurt', amount, fromX: info.from?.x, fromZ: info.from?.z });
    sim.practice('toughness', amount * 0.03);
    if (this.health > 0) return;
    this.health = 0;
    sim.onPlayerDown(info);
  }
  nearMiss(from) {
    const sim = this.sim;
    sim.fx.push({ t: 'whizz', fromX: from.x, fromZ: from.z });
    if (this.moveState !== 'still') sim.practice('quickness', 0.12);
  }

  // ---------- one step ----------
  update(dt, input) {
    const sim = this.sim;
    const d = sim.derived;
    if (!this.alive) return this.updateCamera(dt);
    if (this.downed) {
      if (sim.time > this.downedUntil) sim.onPlayerDeath();
      this.moveState = 'still';
      this.stance = 'prone';
      this.aimT = 0;
      this.scoped = false;
      this.binoc = false;
      this.look(input, dt);
      return this.updateCamera(dt);
    }
    this.look(input, dt);
    if (this.climb) this.updateClimb(dt);
    else if (!this.locked) this.updateMove(dt, input);
    else {
      this.moveState = 'still';
      this.speedNow = 0;
    }
    this.updateVitals(dt, input);
    this.updateWeapons(dt, input);
    this.updateActions(dt, input);
    this.updateSenses(dt);
    this.updateCamera(dt);
    void d;
  }

  look(input, dt) {
    this.yaw += input.lookX;
    this.pitch = clamp(this.pitch + input.lookY, -1.45, 1.45);
    // recoil settles back
    if (this.recoilBack > 0) {
      const back = Math.min(this.recoilBack, 9 * DEG * dt + this.recoilBack * 6 * dt);
      this.pitch -= back;
      this.recoilBack -= back;
    }
  }

  setStance(next) {
    if (next === this.stance) return true;
    const c = this.sim.world.colliders;
    if (STANCE_HEIGHT[next] > STANCE_HEIGHT[this.stance]) {
      // room to rise?
      const probe = { x: this.x, z: this.z };
      if (c.resolve(probe, RADIUS * 0.8, this.y + STANCE_HEIGHT[this.stance] - 0.05, this.y + STANCE_HEIGHT[next])) return false;
    }
    this.stance = next;
    return true;
  }

  updateMove(dt, input) {
    const sim = this.sim;
    const d = sim.derived;
    const world = sim.world;
    const terrain = world.terrain;
    const c = world.colliders;

    if (input.crouch) this.setStance(this.stance === 'crouch' ? 'stand' : 'crouch');
    if (input.prone) this.setStance(this.stance === 'prone' ? 'stand' : 'prone');

    const fx = Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw);
    const rz = Math.sin(this.yaw);
    let mx = fx * input.moveZ + rx * input.moveX;
    let mz = fz * input.moveZ + rz * input.moveX;
    const want = Math.min(1, Math.hypot(mx, mz));
    if (want > 0.01) {
      const m = Math.hypot(mx, mz);
      mx /= m;
      mz /= m;
    }
    const busy = this.busy > 0;
    this.sprinting = input.sprint && want > 0.5 && input.moveZ > 0.3 && this.stance === 'stand' && this.stamina > 2 && !this.aimHeld && !busy && this.grounded && !this.winded;
    let speed = this.stance === 'prone' ? d.proneSpeed : this.stance === 'crouch' ? d.crouchSpeed : this.sprinting ? d.sprintSpeed : d.runSpeed;
    if (this.aimT > 0.3 || this.binoc) speed *= B.DERIVE.AIM_MOVE_MUL;
    if (busy) speed *= 0.35;
    if (sim.time < this.stimUntil) speed *= 1.15;
    if (input.walk && this.stance === 'stand') speed *= 0.45;
    speed *= want;

    // slopes: slow on the way up, impossible past what Climbing allows
    const grad = terrain.gradAt(this.x, this.z, this._g ?? (this._g = { x: 0, z: 0 }));
    let climbing = 0;
    if (want > 0.01 && this.grounded && this.y <= terrain.heightAt(this.x, this.z) + 0.1) {
      const rise = grad.x * mx + grad.z * mz;
      const angle = Math.atan(rise) / DEG;
      if (angle > 14) {
        const k = clamp(1 - (angle - 14) / Math.max(4, d.maxSlope - 14), 0, 1);
        speed *= Math.pow(k, 0.7);
        if (angle > 22) {
          climbing = (angle - 22) * 0.45 * (1 - d.attrs.climbing * 0.006);
          sim.practice('climbing', dt * 0.35);
        }
        if (this.stamina <= 1) speed *= 0.4;
      }
    }
    // wading
    const depth = terrain.waterAt(this.x, this.z) - this.y;
    if (depth > 0.4) speed *= 1 - clamp((depth - 0.4) / 1.2, 0, 0.7);

    // accelerate toward the wanted velocity
    const tvx = mx * speed;
    const tvz = mz * speed;
    const rate = this.grounded ? 14 : 3;
    this.vx += (tvx - this.vx) * Math.min(1, rate * dt);
    this.vz += (tvz - this.vz) * Math.min(1, rate * dt);

    const px = this.x;
    const pz = this.z;
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    c.resolve(this, RADIUS, this.y, this.y + this.height);
    c.resolve(this, RADIUS, this.y, this.y + this.height);
    // deep water and the edge of the map turn you back
    if (terrain.waterAt(this.x, this.z) - terrain.heightAt(this.x, this.z) > 1.5 || !terrain.inBounds(this.x, this.z, 12)) {
      this.x = px;
      this.z = pz;
      this.vx = this.vz = 0;
    }
    if (this.bounds) {
      this.x = clamp(this.x, this.bounds.x0, this.bounds.x1);
      this.z = clamp(this.z, this.bounds.z0, this.bounds.z1);
    }

    // jump, pull up, ladder
    if (input.jump && this.grounded && !busy) this.tryJump(mx, mz, fx, fz);

    // gravity and the floor
    const floor = c.floorAt(this.x, this.z, this.y);
    if (this.grounded) {
      if (floor < this.y - 0.55) this.grounded = false;
      else this.y = floor;
    }
    if (!this.grounded) {
      this.vy -= GRAVITY * dt;
      this.y += this.vy * dt;
      const f2 = c.floorAt(this.x, this.z, this.y);
      if (this.y <= f2) {
        this.y = f2;
        const impact = -this.vy;
        if (impact > 11.5) this.hurt((impact - 11.5) * 9 * d.fallMul, {});
        if (impact > 5) sim.fx.push({ t: 'land', x: this.x, y: this.y, z: this.z });
        this.vy = 0;
        this.grounded = true;
      }
    }

    const moved = Math.hypot(this.x - px, this.z - pz);
    this.speedNow = moved / dt;
    this.moveState = this.speedNow < 0.4 ? 'still' : this.sprinting ? 'sprint' : this.speedNow > d.runSpeed * 0.62 && this.stance === 'stand' ? 'run' : 'walk';
    if (climbing > 0 && moved > 0.001) this.stamina = Math.max(0, this.stamina - climbing * dt);

    // footfalls, for the ear and for sentries
    if (this.grounded && moved > 0) {
      this.strideLeft -= moved;
      if (this.strideLeft <= 0) {
        this.strideLeft = this.moveState === 'sprint' ? 2.4 : this.stance === 'prone' ? 1.1 : 1.7;
        sim.fx.push({ t: 'step', ground: terrain.typeAt(this.x, this.z), loud: this.moveState === 'sprint' ? 1 : this.stance === 'stand' ? 0.6 : 0.25 });
      }
    }
    if (this.sprinting) {
      sim.practice('endurance', dt * 0.11);
      sim.practice('speed', dt * 0.1);
    }
  }

  tryJump(mx, mz, fx, fz) {
    const sim = this.sim;
    const d = sim.derived;
    const c = sim.world.colliders;
    const dx = mx || fx;
    const dz = mz || fz;
    const ladder = c.ladderAt(this.x, this.z, this.y);
    if (ladder) return this.startLadder(ladder, true);
    const ledge = c.findLedge(this.x, this.z, dx, dz, this.y, d.mantle);
    if (ledge && ledge.top - this.y > 0.85 && this.stamina > 4) {
      const rise = ledge.top - this.y;
      this.climb = { t: 0, dur: 0.3 + (rise * 0.75) / d.climbSpeed, fromX: this.x, fromY: this.y, fromZ: this.z, toX: ledge.x + dx * 0.15, toY: ledge.top, toZ: ledge.z + dz * 0.15 };
      this.stamina = Math.max(0, this.stamina - (5 + rise * 6));
      this.setStance('stand');
      sim.practice('climbing', rise * 1.6);
      sim.fx.push({ t: 'climb' });
      return;
    }
    if (this.stance === 'prone') {
      this.setStance('crouch');
      return;
    }
    if (this.stamina < 5) return;
    if (this.stance === 'crouch' && !this.setStance('stand')) return;
    this.vy = JUMP;
    this.grounded = false;
    this.stamina -= 7;
    sim.fx.push({ t: 'jump' });
  }

  startLadder(ladder, up) {
    const d = this.sim.derived;
    const midX = (ladder.x0 + ladder.x1) / 2;
    const midZ = (ladder.z0 + ladder.z1) / 2;
    const height = ladder.y1 - ladder.y0;
    const dur = 0.4 + height / (2.4 * d.climbSpeed);
    this.climb = up
      ? { t: 0, dur, fromX: this.x, fromY: this.y, fromZ: this.z, toX: ladder.exit.x, toY: ladder.y1, toZ: ladder.exit.z, ladder: true }
      : { t: 0, dur, fromX: this.x, fromY: this.y, fromZ: this.z, toX: midX + (midX - ladder.exit.x) * 0.9, toY: ladder.y0, toZ: midZ + (midZ - ladder.exit.z) * 0.9, ladder: true, down: true };
    this.setStance('stand');
    this.sim.practice('climbing', height * 0.5);
  }

  updateClimb(dt) {
    const k = this.climb;
    k.t += dt;
    const t = clamp(k.t / k.dur, 0, 1);
    // up first, then over (or, coming down a ladder, out first and then down)
    const rise = k.down ? clamp((t - 0.2) / 0.8, 0, 1) : clamp(t / 0.75, 0, 1);
    const over = k.down ? clamp(t / 0.2, 0, 1) : clamp((t - 0.6) / 0.4, 0, 1);
    this.y = k.fromY + (k.toY - k.fromY) * rise;
    this.x = k.fromX + (k.toX - k.fromX) * over;
    this.z = k.fromZ + (k.toZ - k.fromZ) * over;
    this.vx = this.vz = this.vy = 0;
    this.moveState = 'walk';
    this.speedNow = 0;
    if (t >= 1) {
      this.climb = null;
      this.grounded = true;
      this.y = this.sim.world.colliders.floorAt(this.x, this.z, this.y + 0.3);
    }
  }

  updateVitals(dt, input) {
    const sim = this.sim;
    const d = sim.derived;
    // stance height eases
    const h = STANCE_HEIGHT[this.stance];
    this.height += (h - this.height) * Math.min(1, dt * 10);
    this.eye += (EYE_HEIGHT[this.stance] - this.eye) * Math.min(1, dt * 10);
    // stamina
    if (this.sprinting) this.stamina = Math.max(0, this.stamina - d.sprintCost * dt);
    else if (!this.holding && !this.climb) this.stamina = Math.min(d.maxStamina, this.stamina + d.staminaRegen * (this.moveState === 'still' ? 1.4 : 0.8) * dt);
    // run yourself out and you are winded: no sprinting until you have some breath back
    if (this.stamina <= 2.5 && this.sprinting && !this.winded) this.winded = sim.time + 2.2;
    if (this.stamina <= 0.5 && !this.winded) this.winded = sim.time + 2.2;
    if (this.winded && sim.time > this.winded && this.stamina > d.maxStamina * 0.2) this.winded = 0;
    // a little health comes back on its own
    if (sim.time - this.lastHurt > B.COMBAT.REGEN_DELAY && this.health < d.maxHealth * B.COMBAT.REGEN_TO) this.health = Math.min(d.maxHealth * B.COMBAT.REGEN_TO, this.health + B.COMBAT.REGEN_RATE * dt);
    this.health = Math.min(this.health, d.maxHealth);
    if (this.busy > 0) {
      this.busy -= dt;
      if (this.busy <= 0) this.finishBusy();
    }
    if (this.flashed > 0) this.flashed -= dt;
    // what you are standing in, for concealment
    this.ground = sim.world.coverAt(this.x, this.z);
    const light = sim.lightAt(this.x, this.z);
    this.concealed = concealment({ ground: this.ground, stance: this.stance, night: light < 0.4, nightStealth: d.nightStealth, shadowPerk: d.perk === 'shadow' });
    void input;
  }

  // ---------- weapons ----------
  updateWeapons(dt, input) {
    const sim = this.sim;
    const d = sim.derived;
    const w = this.weapon;
    for (const slot of this.weapons) if (slot) slot.cool = Math.max(0, slot.cool - dt);
    this.bloom = Math.max(0, this.bloom - B.COMBAT.BLOOM_DECAY * dt);

    // swapping
    let wantSlot = -1;
    if (input.slot === 1) wantSlot = 0;
    else if (input.slot === 2) wantSlot = 1;
    else if (input.swap) wantSlot = this.cur === 0 ? 1 : 0;
    if (wantSlot >= 0 && wantSlot !== this.cur && this.weapons[wantSlot] && !this.climb && this.busy <= 0) {
      this.cur = wantSlot;
      this.switching = 0.55 * d.reloadMul;
      this.reloading = 0;
      this.aimT = 0;
      this.binoc = false;
      sim.fx.push({ t: 'swap' });
    }
    if (this.switching > 0) this.switching -= dt;

    // binoculars
    if (input.binoc && (d.enables.binoc || sim.training?.grantBinoc) && !this.climb) {
      this.binoc = !this.binoc;
      this.tagT = 0;
    }
    if (input.nvg && d.enables.nvg) {
      this.nvg = !this.nvg;
      sim.fx.push({ t: 'nvg', on: this.nvg });
    }

    // aiming
    this.aimHeld = !!input.aim && this.busy <= 0 && !this.climb && this.switching <= 0 && !this.binoc && !!w;
    const adsTime = w ? w.eff.adsTime : 0.3;
    this.aimT = clamp(this.aimT + (this.aimHeld ? dt / adsTime : -dt / (adsTime * 0.7)), 0, 1);
    this.scoped = !!w && w.eff.scoped && this.aimT > 0.92;
    if (w && w.eff.zooms && input.zoom && this.scoped) w.zoomIndex = clamp(w.zoomIndex + input.zoom, 0, w.eff.zooms.length - 1);

    // breath and sway
    const optic = this.scoped || this.binoc;
    this.holding = optic && !!input.breath && this.breath > 0 && !this.winded;
    if (this.holding) {
      this.breath -= dt / d.breathSeconds;
      if (this.breath <= 0) this.winded = sim.time + 2.5;
    } else this.breath = Math.min(1, this.breath + dt / 4);
    this.settled = optic && this.speedNow < 0.3 ? this.settled + dt : 0;
    this.swayT += dt;
    if (optic) {
      const braced = w && w.eff.bipod && (this.stance === 'prone' || (this.stance === 'crouch' && this.speedNow < 0.3));
      let amp = 0.5 * (this.binoc ? 0.6 : w.eff.sway);
      amp *= this.stance === 'prone' ? 0.32 : this.stance === 'crouch' ? 0.62 : 1;
      if (braced) amp *= 0.5;
      amp *= 1 + 1.3 * (1 - this.stamina / d.maxStamina);
      if (this.speedNow > 0.4) amp *= 2.2;
      if (this.holding) amp *= 0.14;
      else if (this.winded) amp *= 1.7;
      if (sim.time - this.lastHurt < 1.5) amp *= 2;
      const t = this.swayT;
      this.swayX = amp * DEG * (Math.sin(t * 0.9) + 0.5 * Math.sin(t * 2.3 + 1));
      this.swayY = amp * DEG * (Math.sin(t * 1.3 + 2) * 0.8 + 0.4 * Math.sin(t * 2.9));
    } else {
      this.swayX *= 0.8;
      this.swayY *= 0.8;
    }

    if (!w) return;
    // reloading
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) {
        const take = Math.min(w.eff.mag - w.mag, w.reserve);
        w.mag += take;
        w.reserve -= take;
        if (sim.inFight()) sim.practice('quickness', 0.6);
      }
    } else if ((input.reload || (w.mag === 0 && input.firePressed)) && w.mag < w.eff.mag && w.reserve > 0 && this.switching <= 0 && this.busy <= 0) {
      this.reloading = w.eff.reload;
      sim.fx.push({ t: 'reload', seconds: w.eff.reload });
    }

    // firing
    if (this.reloading > 0 || this.switching > 0 || this.busy > 0 || this.binoc || this.climb || this.sprinting) return;
    const wants = w.eff.auto ? input.fire : input.firePressed;
    if (!wants || w.cool > 0) return;
    if (w.mag <= 0) {
      if (input.firePressed) sim.fx.push({ t: 'dry' });
      return;
    }
    this.shoot(w);
  }

  // The direction you are looking, with scope sway. Fills out { x, y, z }.
  aimDir(out) {
    const yaw = this.yaw + this.swayX;
    const pitch = this.pitch + this.swayY;
    const cp = Math.cos(pitch);
    out.x = Math.sin(yaw) * cp;
    out.y = Math.sin(pitch);
    out.z = -Math.cos(yaw) * cp;
    return out;
  }

  shoot(w) {
    const sim = this.sim;
    const eff = w.eff;
    const now = sim.time;
    const aiming = this.aimT > 0.85;
    const d = sim.derived;
    const braced = eff.bipod && (this.stance === 'prone' || (this.stance === 'crouch' && this.speedNow < 0.3));
    const spread = shotSpread({ weapon: eff, stance: this.stance, moveShare: clamp(this.speedNow / d.sprintSpeed, 0, 1), aiming, bloom: this.bloom, braced }) * (this.grounded ? 1 : 2);
    const dir = this.aimDir(this._dir ?? (this._dir = { x: 0, y: 0, z: 0 }));
    const cam = this.cam;
    // start the trace level with the soldier, not behind the back of the head
    const skip = cam.mode === 'third' ? Math.hypot(cam.x - this.x, cam.z - this.z) + 0.25 : 0.2;
    const ox = cam.x + dir.x * skip;
    const oy = cam.y + dir.y * skip;
    const oz = cam.z + dir.z * skip;
    const reach = eff.range * 2.5 + 60;
    const fx = Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    const muzzleX = this.x + fx * 0.55 + Math.cos(this.yaw) * 0.22;
    const muzzleY = this.y + this.eye - 0.16;
    const muzzleZ = this.z + fz * 0.55 + Math.sin(this.yaw) * 0.22;
    const firstSettled = d.perk === 'one_shot' && this.scoped && this.settled > 1.5;
    let hitAny = false;
    let killed = false;
    let headshot = false;
    const info = this._hit ?? (this._hit = {});

    for (let i = 0; i < eff.pellets; i++) {
      // a random direction inside the spread cone
      const r = spread * DEG * Math.sqrt(Math.random()) * (0.35 + 0.65 * Math.random());
      const a = Math.random() * Math.PI * 2;
      const yaw = Math.atan2(dir.x, -dir.z) + (Math.cos(a) * r) / Math.max(0.2, Math.cos(this.pitch));
      const pitch = Math.asin(clamp(dir.y, -1, 1)) + Math.sin(a) * r;
      const cp = Math.cos(pitch);
      const dx = Math.sin(yaw) * cp;
      const dy = Math.sin(pitch);
      const dz = -Math.cos(yaw) * cp;
      let t = sim.world.colliders.raycast(ox, oy, oz, dx, dy, dz, reach, info);
      let surface = info.kind;
      if (t === Infinity) {
        t = reach;
        surface = null;
      }
      let victim = null;
      let zone = null;
      for (const actor of sim.actors) {
        if (!actor.alive || actor.kind === 'squad' || actor.kind === 'npc' || (actor.kind === 'ally' && !sim.friendlyFire)) continue;
        const h = rayActor(actor, ox, oy, oz, dx, dy, dz, t);
        if (h && h.t < t) {
          t = h.t;
          victim = actor;
          zone = h.zone;
        }
      }
      let shootable = null;
      for (const s of sim.shootables) {
        if (!s.active) continue;
        const ts = raySphere(ox, oy, oz, dx, dy, dz, s.x, s.y, s.z, s.r);
        if (ts >= 0 && ts < t) {
          t = ts;
          shootable = s;
          victim = null;
        }
      }
      const ex = ox + dx * t;
      const ey = oy + dy * t;
      const ez = oz + dz * t;
      sim.fx.push({ t: 'shot', x: muzzleX, y: muzzleY, z: muzzleZ, tx: ex, ty: ey, tz: ez, weapon: eff.class, loud: !eff.suppressed, own: true, first: i === 0, surface: victim ? 'flesh' : shootable ? 'target' : surface });
      if (i === 0) sim.bulletPass(ox, oy, oz, dx, dy, dz, t, !eff.suppressed, victim);
      if (shootable) {
        shootable.onHit(shootable, Math.hypot(ex - this.x, ez - this.z));
        hitAny = true;
      } else if (victim) {
        const distance = Math.hypot(ex - this.x, ey - (this.y + this.eye), ez - this.z);
        let bonus = 1;
        if (firstSettled) bonus *= 1.35;
        const unaware = victim.kind === 'enemy' && victim.ai.state !== 'combat' && victim.ai.aware < 1;
        if (unaware) bonus *= 1.25;
        const dmg = shotDamage({ weapon: eff, distance, zone, armor: victim.armor, armorHead: victim.armorHead, bonus });
        const dead = sim.damageActor(victim, dmg, { from: this, player: true, zone, weapon: eff, distance, unaware });
        hitAny = true;
        if (zone === 'head') headshot = true;
        if (dead) killed = true;
        if (victim.kind === 'enemy') {
          sim.practice('accuracy', zone === 'head' ? 1.6 : 1);
          if (eff.scoped && distance > 80) sim.practice('scope', distance / 55);
        }
      }
    }
    sim.stat('shots', 1);
    if (hitAny) {
      sim.stat('hits', 1);
      sim.fx.push({ t: 'hitmark', kill: killed, head: headshot });
    }
    if (eff.class === 'lmg' || eff.class === 'shotgun' || eff.class === 'sniper' || eff.class === 'rifle') sim.practice('strength', 0.08);

    w.mag -= 1;
    w.cool = eff.interval;
    this.lastShot = now;
    if (!eff.suppressed) this.lastLoudShot = now;
    sim.noise(this.x, this.z, eff.noise, 'gunshot', this);
    // recoil
    const stanceMul = this.stance === 'prone' ? 0.6 : this.stance === 'crouch' ? 0.8 : 1;
    const kick = eff.recoil * (0.75 + Math.random() * 0.5) * stanceMul * (braced ? 0.5 : 1) * (aiming ? 1 : 1.25) * DEG;
    this.pitch = clamp(this.pitch + kick, -1.45, 1.45);
    this.yaw += (Math.random() - 0.5) * kick * 0.7;
    this.recoilBack += kick * 0.6;
    this.bloom = Math.min(B.COMBAT.BLOOM_MAX, this.bloom + B.COMBAT.BLOOM * eff.recoil * eff.bloom);
    this.settled = 0;
    if (w.mag === 0 && w.reserve > 0 && !eff.bolt) {
      this.reloading = eff.reload;
      sim.fx.push({ t: 'reload', seconds: eff.reload });
    }
  }

  // ---------- everything else your hands do ----------
  updateActions(dt, input) {
    const sim = this.sim;
    const d = sim.derived;
    const free = this.busy <= 0 && !this.climb;
    if (input.nextThrowable) {
      const have = THROWABLES.filter((id) => (this.items[id] ?? 0) > 0);
      if (have.length) this.throwable = have[(have.indexOf(this.throwable) + 1) % have.length];
    }
    if ((this.items[this.throwable] ?? 0) <= 0) {
      const next = THROWABLES.find((id) => (this.items[id] ?? 0) > 0);
      if (next) this.throwable = next;
    }
    if (input.grenade && free && (this.items[this.throwable] ?? 0) > 0) {
      this.items[this.throwable] -= 1;
      sim.itemsDirty = true;
      if (this.throwable === 'mine') sim.placeMine(this);
      else {
        const dir = this.aimDir(this._dir ?? (this._dir = { x: 0, y: 0, z: 0 }));
        const power = 15 + d.attrs.strength * 0.09;
        sim.throwGrenade(this, this.throwable, null, null, null, { x: dir.x * power, y: dir.y * power + 3.2, z: dir.z * power });
      }
      this.busy = 0.45;
      this.busyKind = 'throw';
    }
    if (input.medkit && free && (this.items.medkit ?? 0) > 0 && this.health < d.maxHealth) this.startBusy('medkit', 2.4);
    else if (input.bandage && free && (this.items.bandage ?? 0) > 0 && this.health < d.maxHealth) this.startBusy('bandage', 1.2);
    else if (input.stim && free && (this.items.stim ?? 0) > 0) this.startBusy('stim', 0.8);
    if (input.melee && free) this.melee();
    this.updatePrompt(dt, input);
  }

  startBusy(kind, seconds, ref = null) {
    this.busy = seconds;
    this.busyKind = kind;
    this.busyRef = ref;
    this.busyTotal = seconds;
    this.reloading = 0;
    this.sim.fx.push({ t: 'use', kind });
  }

  finishBusy() {
    const sim = this.sim;
    const d = sim.derived;
    const kind = this.busyKind;
    const ref = this.busyRef;
    this.busyKind = null;
    this.busyRef = null;
    if (kind === 'medkit' && (this.items.medkit ?? 0) > 0) {
      this.items.medkit -= 1;
      this.health = Math.min(d.maxHealth, this.health + d.medkitHeal);
      if (d.perk === 'lifesaver') this.stamina = d.maxStamina;
      sim.practice('medicine', 4);
      sim.itemsDirty = true;
    } else if (kind === 'bandage' && (this.items.bandage ?? 0) > 0) {
      this.items.bandage -= 1;
      this.health = Math.min(d.maxHealth, this.health + d.bandageHeal);
      sim.practice('medicine', 1.5);
      sim.itemsDirty = true;
    } else if (kind === 'stim' && (this.items.stim ?? 0) > 0) {
      this.items.stim -= 1;
      this.stamina = d.maxStamina;
      this.winded = 0;
      this.stimUntil = sim.time + 20;
      sim.itemsDirty = true;
    } else if (kind === 'takedown' && ref && ref.alive) {
      sim.takedown(ref);
    }
  }

  melee() {
    const sim = this.sim;
    const d = sim.derived;
    this.busy = 0.5;
    this.busyKind = 'melee';
    sim.fx.push({ t: 'melee' });
    this.stamina = Math.max(0, this.stamina - 6);
    let best = null;
    let bestD = 2.1;
    for (const a of sim.actors) {
      if (!a.alive || a.kind !== 'enemy' || a.captured) continue;
      const dist = Math.hypot(a.x - this.x, a.z - this.z);
      if (dist > bestD || Math.abs(a.y - this.y) > 1.4) continue;
      const ang = Math.abs(angleDiff(Math.atan2(a.x - this.x, -(a.z - this.z)), this.yaw));
      if (ang > 0.9) continue;
      best = a;
      bestD = dist;
    }
    if (!best) return;
    const unaware = best.ai.state !== 'combat' && best.ai.aware < 1;
    sim.damageActor(best, d.meleeDamage * (unaware ? 4 : 1), { from: this, player: true, zone: 'torso', melee: true, unaware, silent: true, distance: bestD });
    sim.practice('strength', 1.2);
  }

  // Works out what F would do right now and runs it when pressed (or held long enough).
  updatePrompt(dt, input) {
    const sim = this.sim;
    const d = sim.derived;
    this.prompt = null;
    if (this.busy > 0 || this.climb) {
      this.hold = 0;
      return;
    }
    let best = null;
    let bestScore = Infinity;
    const offer = (score, prompt) => {
      if (score < bestScore) {
        best = prompt;
        bestScore = score;
      }
    };
    const c = sim.world.colliders;
    // ladders
    const ladder = c.ladderAt(this.x, this.z, this.y);
    if (ladder) offer(0.5, { text: 'Climb the ladder', run: () => this.startLadder(ladder, true) });
    else {
      for (const b of sim.ladders) {
        if (Math.abs(this.y - b.y1) < 0.4 && (b.exit.x - this.x) ** 2 + (b.exit.z - this.z) ** 2 < 2.2) offer(0.6, { text: 'Climb down', run: () => this.startLadder(b, false) });
      }
    }
    // people
    for (const a of sim.actors) {
      if (!a.alive) continue;
      const dx = a.x - this.x;
      const dz = a.z - this.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 16 || Math.abs(a.y - this.y) > 2.5) continue;
      const ang = Math.abs(angleDiff(Math.atan2(dx, -dz), this.yaw));
      if (a.kind === 'npc' && dist < 3 && ang < 1.2) offer(dist, { text: `Talk to ${a.name}`, run: () => sim.talk(a) });
      else if (a.kind === 'captive' && a.ai.state === 'held' && dist < 2.4) offer(dist, { text: `Free ${a.name}`, hold: 1.4, ref: a, run: () => sim.freeCaptive(a) });
      else if (a.kind === 'squad' && a.downed && dist < 2.4) offer(dist, { text: `Revive ${a.name}`, hold: d.reviveSeconds, ref: a, run: () => sim.treat(this, a) });
      else if (a.kind === 'civilian' && dist < 2.6 && ang < 1 && a.talk) offer(dist + 1, { text: 'Talk to the villager', run: () => sim.talk(a) });
      else if (a.kind === 'enemy' && !a.captured) {
        if (a.surrendered) {
          if (dist < 2.6) offer(dist - 1, { text: `Restrain ${a.name}`, hold: 1.3, ref: a, run: () => sim.restrain(a) });
        } else if (
          dist < B.STEALTH.TAKEDOWN_RANGE + 0.3 &&
          a.ai.state !== 'combat' &&
          !a.ai.tower &&
          canTakedown({ distance: dist, facing: a.yaw, bearing: Math.atan2(this.x - a.x, -(this.z - a.z)), aware: a.ai.aware })
        ) {
          offer(dist - 2, { text: a.capture ? `Subdue ${a.name}` : 'Takedown', run: () => this.startBusy('takedown', d.perk === 'shadow' ? 0.5 : 1.0, a) });
        } else if (dist < 15 && ang < 0.22 && (a.capture || a.ai.state === 'combat') && sim.time > (this.demandCool.get(a.id) ?? 0) && c.los(this.x, this.y + this.eye, this.z, a.x, a.y + 1.2, a.z)) {
          offer(dist + 3, { text: `Demand surrender (${Math.round(sim.surrenderOdds(a) * 100)}%)`, hold: 1.1, ref: a, run: () => this.demand(a) });
        }
      }
    }
    // things
    for (const it of sim.interactables) {
      if (it.gone) continue;
      const dist = Math.hypot(it.x - this.x, it.z - this.z);
      if (dist > (it.r ?? 2.2) || Math.abs((it.y ?? this.y) - this.y) > 2.2) continue;
      offer(dist + (it.bias ?? 0), { text: it.text, hold: typeof it.hold === 'function' ? it.hold() : it.hold, ref: it, run: () => it.use(it) });
    }
    this.prompt = best;
    if (!best) {
      this.hold = 0;
      this.holdRef = null;
      return;
    }
    if (best.hold) {
      if (input.interactHeld && (this.holdRef === (best.ref ?? best.text) || this.hold === 0)) {
        this.holdRef = best.ref ?? best.text;
        this.hold += dt;
        best.progress = clamp(this.hold / best.hold, 0, 1);
        if (this.hold >= best.hold) {
          this.hold = 0;
          this.holdRef = null;
          best.run();
        }
      } else {
        this.hold = 0;
        this.holdRef = null;
      }
    } else if (input.interact) best.run();
  }

  demand(a) {
    const sim = this.sim;
    this.demandCool.set(a.id, sim.time + 8);
    const odds = sim.surrenderOdds(a);
    sim.fx.push({ t: 'shout' });
    sim.practice('negotiating', 1.5);
    if (sim.rng() < odds) {
      sim.surrender(a);
      sim.practice('negotiating', 5);
      sim.say('', `${a.name} throws down his weapon.`);
    } else sim.say('', `${a.name} is not giving up.`);
  }

  // ---------- eyes and ears ----------
  updateSenses(dt) {
    const sim = this.sim;
    const d = sim.derived;
    this.spotTimer -= dt;
    const c = sim.world.colliders;
    const eyeY = this.y + this.eye;

    // marking through binoculars or a scope: keep the centre on a soldier
    if (this.binoc || this.scoped) {
      const dir = this.aimDir(this._dir ?? (this._dir = { x: 0, y: 0, z: 0 }));
      let best = null;
      let bestAng = (this.binoc ? 1.3 : 0.8) * DEG;
      const list = sim.markables();
      for (const a of list) {
        const dx = a.x - this.x;
        const dy = a.y + (a.markY ?? 1.1) - eyeY;
        const dz = a.z - this.z;
        const dist = Math.hypot(dx, dy, dz);
        if (dist < 3 || dist > d.visionRange * 4) continue;
        const cos = (dx * dir.x + dy * dir.y + dz * dir.z) / dist;
        const ang = Math.acos(clamp(cos, -1, 1));
        // a near target fills more of the glass
        if (ang > bestAng + Math.atan(0.5 / dist)) continue;
        if (!c.los(this.x, eyeY, this.z, a.x, a.y + (a.markY ?? 1.1), a.z)) continue;
        best = a;
        bestAng = ang;
      }
      this.rangeTo = best ? Math.hypot(best.x - this.x, best.z - this.z) : null;
      if (best && best === this.tagTarget) {
        this.tagT += dt / (d.rangefinder ? 0.4 : 0.7);
        if (this.tagT >= 1 && !(best.tagged > sim.time + 1e6) && !best.found) {
          sim.mark(best);
          this.tagT = 0;
        }
      } else {
        this.tagTarget = best;
        this.tagT = 0;
      }
    } else {
      this.tagTarget = null;
      this.tagT = 0;
      this.rangeTo = null;
    }

    if (this.spotTimer > 0) return;
    this.spotTimer = 0.3;
    // spotting by eye: enemies in front of you inside your vision range are tagged for a while
    const light = sim.lightAt(this.x, this.z);
    const night = light < 0.4;
    const range = d.visionRange * (night ? (this.nvg ? 0.85 : d.nightSight) : light < 0.75 ? 0.8 : 1);
    let watch = 0;
    for (const a of sim.actors) {
      if (!a.alive || a.kind !== 'enemy') continue;
      const dx = a.x - this.x;
      const dz = a.z - this.z;
      const dist = Math.hypot(dx, dz);
      if (!a.drill && a.ai.state !== 'combat') watch = Math.max(watch, a.ai.aware);
      else if (a.drill) watch = Math.max(watch, a.ai.aware);
      if (dist < d.awareness) {
        // sensed: close enough to hear or feel, seen or not
        if (!(a.sensed > sim.time)) sim.practice('perception', 0.25);
        a.sensed = sim.time + 2.5;
      }
      if (dist > range || a.tagged > sim.time + 3) continue;
      const ang = Math.abs(angleDiff(Math.atan2(dx, -dz), this.yaw));
      if (ang > 0.75) continue;
      // brush and woodland hide them from you as well
      if (dist > range * sim.world.sightThrough(this.x, this.z, a.x, a.z)) continue;
      if (!c.los(this.x, eyeY, this.z, a.x, a.y + 1.3, a.z)) continue;
      if (!(a.tagged > sim.time)) sim.practice('vision', 0.5 + dist / 200);
      sim.tag(a, d.tagSeconds);
    }
    this.watch = watch;
    // your own noise
    const noise = footstepNoise({ move: this.moveState, stance: this.stance, noiseMul: d.noiseMul });
    if (noise > 0.5) sim.footsteps(this.x, this.z, noise);
    // practice at staying unseen
    if (this.stance !== 'stand' && this.moveState !== 'still' && sim.unawareEnemyWithin(45)) sim.practice('stealth', 0.3 * 0.9);
  }

  // ---------- camera ----------
  updateCamera(dt) {
    const sim = this.sim;
    const cam = this.cam;
    const base = sim.baseFov;
    const w = this.weapon;
    const fx = Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw);
    const rz = Math.sin(this.yaw);
    const yaw = this.yaw + this.swayX;
    const pitch = this.pitch + this.swayY;
    const eyeY = this.y + this.eye + (this.downed ? -0.1 : 0);
    let fov = base;
    if (this.binoc || this.scoped) {
      const zoom = this.binoc ? 8 : w.eff.zooms ? w.eff.zooms[w.zoomIndex] : w.eff.zoom;
      cam.mode = this.binoc ? 'binoc' : 'scope';
      cam.x = this.x + fx * 0.15;
      cam.y = eyeY;
      cam.z = this.z + fz * 0.15;
      fov = (2 * Math.atan(Math.tan((base * DEG) / 2) / zoom)) / DEG;
      cam.zoom = zoom;
    } else {
      cam.mode = 'third';
      const aim = this.aimT;
      const zoom = w ? 1 + ((w.eff.scoped ? 1.5 : w.eff.zoom) - 1) * aim : 1;
      fov = (2 * Math.atan(Math.tan((base * DEG) / 2) / zoom)) / DEG;
      cam.zoom = zoom;
      const back = 3.3 - 1.9 * aim;
      const side = 0.6 - 0.12 * aim;
      const up = 0.32 - 0.14 * aim;
      const cp = Math.cos(pitch);
      const dx = Math.sin(yaw) * cp;
      const dy = Math.sin(pitch);
      const dz = -Math.cos(yaw) * cp;
      const px = this.x + rx * side;
      const py = eyeY + up;
      const pz = this.z + rz * side;
      let dist = back;
      const hit = sim.world.colliders.raycast(px, py, pz, -dx, -dy, -dz, back + 0.3);
      if (hit < back + 0.3) dist = Math.max(0.35, hit - 0.3);
      // ease out, snap in: never let a wall sit between you and the camera
      this.camDist = this.camDist === undefined ? dist : dist < this.camDist ? dist : this.camDist + (dist - this.camDist) * Math.min(1, dt * 6);
      cam.x = px - dx * this.camDist;
      cam.y = py - dy * this.camDist;
      cam.z = pz - dz * this.camDist;
      const ground = sim.world.terrain.heightAt(cam.x, cam.z) + 0.25;
      if (cam.y < ground) cam.y = ground;
    }
    cam.yaw = yaw;
    cam.pitch = pitch;
    cam.fov += (fov - cam.fov) * Math.min(1, dt * 14);
    this.fovScale = cam.fov / base;
  }
}
