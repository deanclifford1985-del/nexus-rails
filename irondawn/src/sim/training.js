// The four field evaluations of basic training, run in the world: the rifle range, the confidence
// course, the infiltration lane and the observation post. (The fifth, the written exam, is a
// screen.) Each one ends by handing its numbers to game/training.js for a score.

import { B, clamp, hashString, mulberry } from '../game/balance.js';
import { eventOf, scoreObservation, scoreObstacle, scoreRange, scoreStealth } from '../game/training.js';
import { makeEnemy } from './actors.js';
import { BASE } from './baseplan.js';

export class TrainingRun {
  constructor(sim, id) {
    this.sim = sim;
    this.id = id;
    this.def = eventOf(id);
    this.t = 0;
    this.phase = 'countdown';
    this.count = 3.2;
    this.issue = null;
    this.actors = [];
    this.lines = [];
    this.banner = 'Get ready';
    const p = sim.player;
    this.back = { x: p.x, z: p.z, yaw: p.yaw };
    p.binoc = false;
    p.aimT = 0;
    p.setStance('stand');
    p.health = sim.derived.maxHealth;
    p.stamina = sim.derived.maxStamina;
    this[`setup_${id}`]();
    this.refresh();
  }

  ground(x, z) {
    return this.sim.world.terrain.heightAt(x, z);
  }

  // ---------- rifle qualification ----------
  setup_range() {
    const sim = this.sim;
    const p = sim.player;
    const R = BASE.range;
    this.issue = { weapon: 'm6', att: {} };
    p.loadWeapons(sim.save, sim.derived, this.issue);
    p.cur = 0;
    p.refill(3);
    p.place(R.line.x + 2.6, R.line.z, R.facing);
    p.bounds = { x0: R.line.x + 0.5, x1: R.line.x + 5.6, z0: R.lineZ[0] + 0.6, z1: R.lineZ[1] - 0.6 };
    p.locked = true;
    this.targets = [];
    const add = (dist, far) => {
      for (const lane of R.lanes) {
        const x = R.line.x - dist;
        const z = BASE.center.z + lane;
        const t = { x, z, y: this.ground(x, z) + 1.15, base: this.ground(x, z), r: far ? 0.5 : 0.42, active: false, up: 0, far, dist, target: true, onHit: (s) => this.rangeHit(s) };
        this.targets.push(t);
        sim.shootables.push(t);
      }
    };
    R.near.forEach((d) => add(d, false));
    R.far.forEach((d) => add(d, true));
    this.shown = 0;
    this.hits = 0;
    this.longShown = 0;
    this.longHits = 0;
    this.reactSum = 0;
    this.live = null;
    this.gap = 1;
    this.stage = 1;
  }

  rangeHit(s) {
    if (s !== this.live) return;
    const react = this.t - this.liveAt;
    if (s.far) this.longHits++;
    else {
      this.hits++;
      this.reactSum += react;
    }
    s.active = false;
    this.live = null;
    this.gap = 0.8;
    this.sim.fx.push({ t: 'targethit' });
  }

  update_range(dt) {
    const sim = this.sim;
    const T = B.TRAINING;
    for (const t of this.targets) t.up = clamp(t.up + (t.active ? dt * 7 : -dt * 7), 0, 1);
    if (this.live) {
      const show = this.live.far ? 7 : T.RANGE_SHOW;
      if (this.t - this.liveAt > show) {
        this.live.active = false;
        this.live = null;
        this.gap = 0.8;
      }
      return;
    }
    this.gap -= dt;
    if (this.gap > 0) return;
    if (this.stage === 1 && this.shown >= T.RANGE_TARGETS) {
      // on to the long targets, with glass
      this.stage = 2;
      this.gap = 4.5;
      this.issue = { weapon: 'longbow', att: { optic: 'scope6' } };
      sim.player.weapons = [null, sim.player.weapons[1]];
      sim.player.loadWeapons(sim.save, sim.derived, this.issue);
      sim.player.refill(3);
      sim.player.cur = 0;
      this.banner = 'Long range: scoped rifle. Hold Shift to steady.';
      this.bannerUntil = this.t + 4.2;
      sim.fx.push({ t: 'whistle' });
      return;
    }
    if (this.stage === 2 && this.longShown >= T.RANGE_LONG) return this.finish();
    const pool = this.targets.filter((t) => t.far === (this.stage === 2) && t !== this.last);
    const pick = pool[Math.floor(sim.rng() * pool.length)];
    pick.active = true;
    this.live = pick;
    this.last = pick;
    this.liveAt = this.t;
    if (this.stage === 1) this.shown++;
    else this.longShown++;
    sim.fx.push({ t: 'targetup' });
  }

  // ---------- confidence course ----------
  setup_obstacle() {
    const p = this.sim.player;
    const C = BASE.course;
    p.place(C.x, C.start + 4, 0);
    p.locked = true;
    this.gate = 0;
    this.faults = 0;
    this.clock = 0;
    this.wasWinded = false;
  }

  update_obstacle(dt) {
    const p = this.sim.player;
    const C = BASE.course;
    this.clock += dt;
    const winded = !!p.winded;
    if (winded && !this.wasWinded) this.faults++;
    this.wasWinded = winded;
    const next = C.gates[this.gate];
    if (next !== undefined && p.z < next && Math.abs(p.x - C.x) < C.half + 0.3) {
      this.gate++;
      this.sim.fx.push({ t: 'gate' });
    }
    if (this.gate >= C.gates.length) return this.finish(true);
    if (this.clock > B.TRAINING.OBSTACLE_SLOW + 45) return this.finish(false);
  }

  // ---------- infiltration lane ----------
  setup_stealth() {
    const sim = this.sim;
    const p = sim.player;
    const L = BASE.lane;
    p.place(L.start.x, L.start.z, Math.PI);
    p.locked = true;
    p.bounds = { x0: L.x - L.half, x1: L.x + L.half, z0: L.z0 - 8, z1: L.z1 + 2 };
    this.strikes = 0;
    this.peak = 0;
    this.clock = 0;
    this.grace = 0;
    this.checkpoint = 0;
    const spot = (dx, dz, yaw, patrol) => {
      const x = L.x + dx;
      const z = L.z0 + dz;
      const a = makeEnemy('rifleman', 1, { x, z, y: this.ground(x, z), yaw }, sim.rng);
      a.drill = true;
      a.name = 'Instructor';
      a.stats.view = 44;
      a.stats.detect = 1;
      a.look = { outfit: 'ally', skin: Math.floor(sim.rng() * 5), hat: 'boonie', weapon: 'none' };
      a.trainingActor = true;
      if (patrol) a.ai.patrol = { points: patrol.map(([px, pz]) => ({ x: L.x + px, z: L.z0 + pz })), index: 1, until: 0 };
      sim.actors.push(a);
      this.actors.push(a);
    };
    spot(-16, 40, -0.5);
    spot(30, 54, 0, [[30, 54], [-28, 60]]);
    spot(18, 86, 0.3);
    spot(-34, 102, 0, [[-34, 102], [34, 106]]);
  }

  update_stealth(dt) {
    const sim = this.sim;
    const p = sim.player;
    const L = BASE.lane;
    this.clock += dt;
    this.grace -= dt;
    let top = 0;
    for (const a of this.actors) {
      if (this.grace > 0) a.ai.aware = 0;
      top = Math.max(top, a.ai.aware);
    }
    for (let i = L.checkpoints.length - 1; i > this.checkpoint; i--) if (p.z > L.checkpoints[i]) this.checkpoint = i;
    if (top >= 1 && this.grace <= 0) {
      this.strikes++;
      sim.fx.push({ t: 'whistle' });
      sim.feedMsg(`Spotted! Strike ${this.strikes} of ${B.TRAINING.STEALTH_STRIKES}.`, 'bad');
      if (this.strikes >= B.TRAINING.STEALTH_STRIKES) return this.finish(false);
      p.place(L.x, L.checkpoints[this.checkpoint], Math.PI);
      this.grace = 2.5;
      for (const a of this.actors) a.ai.aware = 0;
      return;
    }
    this.peak = Math.max(this.peak, top);
    if (Math.hypot(p.x - L.flag.x, p.z - L.flag.z) < 3.2) return this.finish(true);
    if (this.clock > 420) return this.finish(false);
  }

  // ---------- observation post ----------
  setup_observation() {
    const sim = this.sim;
    const p = sim.player;
    const O = BASE.op;
    p.place(O.post.x, O.post.z, O.facing);
    p.bounds = { x0: O.post.x - 2.6, x1: O.post.x + 2.6, z0: O.post.z - 1.8, z1: O.post.z + 1.6 };
    p.locked = true;
    this.grantBinoc = true;
    this.clock = B.TRAINING.OBSERVE_SECONDS;
    this.found = 0;
    const tries = (sim.save.records?.observationTries ?? 0) + Math.floor(sim.time);
    const rng = mulberry(hashString(sim.save.id) + tries * 97);
    const eyeX = O.post.x;
    const eyeZ = O.post.z;
    const eyeY = this.ground(eyeX, eyeZ) + 1.6;
    const c = sim.world.colliders;
    let guard = 0;
    while (sim.dummies.length < B.TRAINING.OBSERVE_TARGETS && guard++ < 3000) {
      const x = O.sector.x + (rng() * 2 - 1) * O.sector.half;
      const z = O.sector.z + (rng() * 2 - 1) * (O.sector.depth / 2);
      const y = this.ground(x, z);
      const d = Math.hypot(x - eyeX, z - eyeZ);
      if (d < 55 || d > 250 || y < 3 || sim.world.nav.isBlocked(x, z)) continue;
      if (sim.dummies.some((o) => Math.hypot(o.x - x, o.z - z) < 18)) continue;
      if (!c.los(eyeX, eyeY, eyeZ, x, y + 1.0, z)) continue;
      // tuck them in at the edge of brush where there is some
      sim.dummies.push({ dummy: true, x, y, z, markY: 1.0, found: false, alive: true, yaw: rng() * 6.28, stance: rng() < 0.5 ? 'crouch' : 'stand' });
    }
    this.total = sim.dummies.length;
  }

  onFound() {
    this.found++;
    this.sim.feedMsg(`Target ${this.found} of ${this.total} tagged.`, 'good');
    if (this.found >= this.total) this.finish(true);
  }

  update_observation(dt) {
    this.clock -= dt;
    if (this.clock <= 0) this.finish(true);
  }

  // ---------- shared ----------
  update(dt) {
    this.t += dt;
    const p = this.sim.player;
    if (this.phase === 'countdown') {
      this.count -= dt;
      this.banner = this.count > 0.6 ? String(Math.ceil(this.count - 0.6)) : 'Go!';
      if (this.count <= 0.6 && p.locked) {
        p.locked = false;
        this.sim.fx.push({ t: 'whistle' });
      }
      if (this.count <= 0) {
        this.phase = 'run';
        this.banner = null;
        this.t = 0;
      }
      this.refresh();
      return;
    }
    if (this.phase !== 'run') return;
    if (this.bannerUntil && this.t > this.bannerUntil) {
      this.banner = null;
      this.bannerUntil = 0;
    }
    this[`update_${this.id}`](dt);
    if (this.phase === 'run') this.refresh();
  }

  refresh() {
    const T = B.TRAINING;
    const lines = [];
    let timer = null;
    if (this.id === 'range') {
      lines.push({ text: `Targets ${this.shown}/${T.RANGE_TARGETS}   Hits ${this.hits}`, state: this.stage === 1 ? 'active' : 'done' });
      lines.push({ text: `Long targets ${this.longShown}/${T.RANGE_LONG}   Hits ${this.longHits}`, state: this.stage === 2 ? 'active' : 'todo' });
    } else if (this.id === 'obstacle') {
      lines.push({ text: `Gate ${Math.min(this.gate + 1, BASE.course.gates.length)} of ${BASE.course.gates.length}`, state: 'active' });
      timer = this.phase === 'run' ? this.clock : 0;
    } else if (this.id === 'stealth') {
      lines.push({ text: 'Reach the red flag at the far end of the wood unseen', state: 'active' });
      lines.push({ text: `Strikes ${this.strikes}/${T.STEALTH_STRIKES}`, state: this.strikes ? 'lost' : 'todo' });
    } else if (this.id === 'observation') {
      lines.push({ text: `Tagged ${this.found}/${this.total}  (B: binoculars, hold the mark on a dummy)`, state: 'active' });
      timer = Math.max(0, this.clock);
    }
    const markers = [];
    if (this.id === 'stealth') markers.push({ x: BASE.lane.flag.x, y: this.ground(BASE.lane.flag.x, BASE.lane.flag.z) + 4, z: BASE.lane.flag.z, label: 'Flag', kind: 'objective' });
    if (this.id === 'obstacle') {
      const z = BASE.course.gates[Math.min(this.gate, BASE.course.gates.length - 1)];
      markers.push({ x: BASE.course.x, y: this.ground(BASE.course.x, z) + 3.6, z, label: this.gate >= BASE.course.gates.length - 1 ? 'Finish' : 'Gate', kind: 'objective' });
    }
    this.sim.objective = { title: this.def.name, lines, bonus: [], markers, timer, countUp: this.id === 'obstacle', banner: this.banner, training: true };
  }

  finish(ok = true) {
    if (this.phase === 'done') return;
    this.phase = 'done';
    let result;
    if (this.id === 'range') {
      result = scoreRange({ hits: this.hits, total: B.TRAINING.RANGE_TARGETS, longHits: this.longHits, longTotal: B.TRAINING.RANGE_LONG, avgReact: this.hits ? this.reactSum / this.hits : B.TRAINING.RANGE_SHOW });
      result.detail = { hits: this.hits, total: B.TRAINING.RANGE_TARGETS, longHits: this.longHits, longTotal: B.TRAINING.RANGE_LONG, avgReact: this.hits ? this.reactSum / this.hits : null };
    } else if (this.id === 'obstacle') {
      const p = this.sim.player;
      result = scoreObstacle({ time: this.clock, faults: this.faults, finished: ok, staminaLeft: p.stamina / this.sim.derived.maxStamina });
      result.detail = { time: this.clock, faults: this.faults, finished: ok };
    } else if (this.id === 'stealth') {
      result = scoreStealth({ reached: ok, strikes: this.strikes, peak: this.peak, time: this.clock });
      result.detail = { reached: ok, strikes: this.strikes, time: this.clock };
    } else {
      result = scoreObservation({ found: this.found, total: this.total, timeLeft: Math.max(0, this.clock) });
      result.detail = { found: this.found, total: this.total, timeLeft: Math.max(0, this.clock) };
    }
    this.sim.fx.push({ t: 'whistle' });
    this.sim.endTraining(result);
  }

  // Puts everything back the way it was.
  cleanup() {
    const sim = this.sim;
    const p = sim.player;
    sim.actors = sim.actors.filter((a) => !a.trainingActor);
    sim.shootables = sim.shootables.filter((s) => !s.target);
    sim.dummies = [];
    this.issue = null;
    p.bounds = null;
    p.locked = false;
    p.binoc = false;
    p.aimT = 0;
    p.weapons = [null, null];
    p.loadWeapons(sim.save, sim.derived);
    p.place(this.back.x, this.back.z, this.back.yaw);
    p.health = sim.derived.maxHealth;
    p.stamina = sim.derived.maxStamina;
    p.winded = 0;
  }
}
