// Runs one mission in the world: puts the garrison, the target, the captives and your people on
// the site, tracks the objectives, raises the alarm, sends the waves, and decides when it is won
// or lost. The mission itself is data from game/missions.js.

import { B, clamp } from '../game/balance.js';
import { alertEnemy } from './ai.js';
import { makeAlly, makeCaptive, makeCivilian, makeEnemy, makeNpc } from './actors.js';

const QUIET_TYPES = ['recon', 'capture', 'sabotage', 'rescue', 'elimination'];
const SURNAMES = ['Reyes', 'Novak', 'Okafor', 'Haddad', 'Mensah', 'Tanaka', 'Brennan', 'Varga', 'Cole', 'Marin'];

export class MissionRun {
  constructor(sim, def, plan = []) {
    this.sim = sim;
    this.def = def;
    this.plan = new Set(plan);
    this.site = sim.world.sites[def.site];
    this.A = this.site.anchors;
    this.tier = def.tier;
    this.issue = def.issue ?? null;
    this.stats = { success: false, time: 0, alarm: false, downs: 0, squadLost: 0, alliesLost: 0, shots: 0, hits: 0, kills: 0, headshots: 0, stealthKills: 0, longestShot: 0, killXp: 0, captivesLost: 0, civilians: 0, rescued: 0, captured: 0, squadKills: 0, squad: {}, bonus: {} };
    this.objectives = def.objectives.map((o) => ({ ...o, state: 'todo' }));
    this.alarm = false;
    this.alarmOff = false;
    this.bodies = 0;
    this.garrison = [];
    this.garrisonDead = 0;
    this.captives = [];
    this.target = null;
    this.marked = new Set();
    this.intel = 0;
    this.planted = [];
    this.wave = null;
    this.asset = null;
    this.medevac = this.plan.has('medevac');
    this.ended = false;
    this.endAt = 0;
    this.checkTimer = 0;
    this.loudAt = 0;
    this.reinforceAt = 0;
    this.talked = false;
    this.mortarAt = 0;
    this.mortarCrew = { faction: 'enemy', x: this.site.x, z: this.site.z, kind: 'enemy' };
  }

  squadReport(actor) {
    return (this.stats.squad[actor.member] ??= { kills: 0, down: false });
  }
  done(type) {
    return this.objectives.filter((o) => o.type === type).every((o) => o.state === 'done');
  }
  current() {
    return this.objectives.find((o) => o.state !== 'done') ?? null;
  }
  point(name) {
    const p = this.A[name];
    return Array.isArray(p) ? p[0] : (p ?? this.A.center);
  }

  // ---------- setting the scene ----------
  start() {
    const sim = this.sim;
    const def = this.def;
    const A = this.A;
    const p = sim.player;
    const world = sim.world;
    const save = sim.save;
    const defense = def.type === 'defense';

    sim.hour = this.plan.has('night') ? 1 : (def.hour ?? sim.hour);
    if (this.plan.has('power')) {
      world.powerOff[this.site.id] = true;
      this.alarmOff = true;
    }
    if (save.story.flags.elder) sim.api.act('setFlag', { flag: 'elder', value: null }, { quiet: true });

    // you and yours
    const insert = defense || def.objectives[0].type === 'talk' ? (world.walkableNear(A.gate.x, A.gate.z, 8) ?? A.gate) : this.plan.has('flank') ? A.alt : A.insert;
    const yaw = Math.atan2(this.site.x - insert.x, -(this.site.z - insert.z));
    p.alive = true;
    p.downed = false;
    p.locked = false;
    p.bounds = null;
    p.binoc = false;
    p.place(insert.x, insert.z, yaw);
    p.health = sim.derived.maxHealth;
    p.stamina = sim.derived.maxStamina;
    p.items = { ...save.items };
    p.weapons = [null, null];
    p.loadWeapons(save, sim.derived, this.issue);
    if (this.plan.has('supplies')) {
      p.items.medkit = (p.items.medkit ?? 0) + 2;
      p.items.frag = (p.items.frag ?? 0) + 2;
      p.refill(1.5);
      for (const w of p.weapons) if (w) w.reserve = Math.round(w.eff.reserveMax * 1.5);
    }
    sim.holdFire = QUIET_TYPES.includes(def.type);
    sim.supportReady = {};

    if (def.squad === 'own') {
      sim.spawnSquad(insert, yaw);
      for (const a of sim.squad()) this.squadReport(a);
    }
    const allyLevel = 3 + this.tier;
    let n = 0;
    const addAlly = (role, pos, opts) => {
      const near = world.walkableNear(pos.x, pos.z, 8) ?? pos;
      const a = makeAlly(role, allyLevel, { x: near.x, z: near.z, y: world.terrain.heightAt(near.x, near.z), yaw: pos.yaw ?? yaw }, { surname: SURNAMES[n % SURNAMES.length], ...opts });
      a.missionActor = true;
      sim.actors.push(a);
      n++;
      return a;
    };
    const escort = def.squad === 'attached';
    if (escort && def.leader) addAlly('rifleman', { x: insert.x + 1.5, z: insert.z + 1.5 }, { escort: true, slot: 0, name: def.leader, hat: 'cap' });
    const posts = [...A.defend];
    for (const [role, count] of Object.entries(def.allies ?? {})) {
      for (let i = 0; i < count; i++) {
        if (escort) addAlly(role, { x: insert.x - 2 + n * 1.3, z: insert.z + 2 }, { escort: true, slot: n });
        else if (defense && posts.length) addAlly(role, posts.shift(), { state: 'defend' });
        else addAlly(role, { x: insert.x + (n % 2 ? 3 : -3) * (1 + Math.floor(n / 2)), z: insert.z + 3 }, { state: defense ? 'defend' : 'assault' });
      }
    }
    if (this.plan.has('reserve')) for (let i = 0; i < 4; i++) addAlly('rifleman', posts.shift() ?? { x: A.asset.x + i * 2 - 3, z: A.asset.z + 4 }, { state: 'defend' });

    // the garrison
    if (def.forces) {
      this.garrison = sim.spawnGarrison(this.site, def.forces, this.tier, def.patrols ?? 1, this.plan.has('diversion') ? 0.67 : 1);
      this.garrison.forEach((a) => (a.missionActor = true));
      if (this.plan.has('diversion')) sim.say('Cpt Marsh', 'The feint is drawing some of them off. Go.');
    }
    // the named target and his bodyguards
    if (def.target) {
      const t = def.target;
      const at = t.type === 'boss' && !A.hvt ? A.guards[0] : (A.hvt ?? A.center);
      const near = world.walkableNear(at.x, at.z, 5) ?? at;
      const target = makeEnemy(t.type, this.tier + (t.type === 'boss' ? 0 : 1), { x: near.x, z: near.z, y: world.terrain.heightAt(near.x, near.z), yaw: at.yaw ?? 0 }, sim.rng);
      target.name = t.name;
      target.title = t.title;
      target.isTarget = true;
      target.capture = !!t.capture;
      target.missionActor = true;
      target.site = this.site.id;
      if (t.flees && A.escape) {
        target.flees = true;
        target.fleeTo = A.escape;
      }
      if (t.patrols) {
        const route = A.hvtWalk ?? A.patrols[A.patrols.length > 2 ? 2 : 0];
        target.ai.state = 'patrol';
        target.ai.patrol = { points: route, index: 0, until: 0 };
      }
      sim.actors.push(target);
      this.target = target;
      for (let i = 0; i < (t.guards ?? 0); i++) {
        const gp = world.walkableNear(near.x + Math.cos(i * 2.1) * 2.6, near.z + Math.sin(i * 2.1) * 2.6, 5) ?? near;
        const g = makeEnemy(i % 3 === 2 ? 'gunner' : 'rifleman', this.tier + 1, { x: gp.x, z: gp.z, y: world.terrain.heightAt(gp.x, gp.z), yaw: 0 }, sim.rng);
        g.name = 'Bodyguard';
        g.ai.follow = target;
        g.ai.slot = i;
        g.missionActor = true;
        g.site = this.site.id;
        sim.actors.push(g);
        this.garrison.push(g);
      }
      if (t.hidden) {
        const r = clamp(150 - sim.derived.tracking * 1.3, 25, 150);
        const a = sim.rng() * 6.28;
        this.searchArea = { x: this.site.x + Math.cos(a) * r * 0.3, z: this.site.z + Math.sin(a) * r * 0.3, r: Math.max(r, 45) };
      }
    }
    this.garrisonTotal = this.garrison.length;

    // captives, papers, charges, the alarm
    const rescue = def.objectives.find((o) => o.type === 'rescue');
    if (rescue) {
      A.cells.slice(0, rescue.count).forEach((cell, i) => {
        const c = makeCaptive({ x: cell.x, z: cell.z, y: cell.y, yaw: Math.PI }, i === 0 && def.captiveLeader ? def.captiveLeader : `Pvt ${SURNAMES[(i + 3) % SURNAMES.length]}`);
        c.missionActor = true;
        sim.actors.push(c);
        this.captives.push(c);
      });
      rescue.count = this.captives.length;
    }
    const collect = def.objectives.find((o) => o.type === 'collect');
    if (collect) {
      const spots = A.intel.length ? A.intel : [A.hvt ?? A.center];
      for (let i = 0; i < collect.count; i++) {
        const s = spots[i % spots.length];
        sim.interactables.push({ kind: 'intel', mission: true, x: s.x + (i >= spots.length ? 1.5 : 0), z: s.z, y: s.y, r: 2, hold: 0.7, text: 'Take the documents', use: (it) => this.takeIntel(it) });
      }
    }
    const plant = def.objectives.find((o) => o.type === 'plant');
    if (plant) {
      const spots = A.objectives.length ? A.objectives : A.guards;
      plant.count = Math.min(plant.count, spots.length);
      spots.slice(0, plant.count).forEach((s) => {
        sim.interactables.push({ kind: 'charge', mission: true, x: s.x, z: s.z, y: s.y, r: 2.4, hold: () => 4 * sim.derived.plantMul, text: `Set a charge on the ${(s.label ?? 'target').toLowerCase()}`, use: (it) => this.plantCharge(it) });
      });
    }
    if (A.alarm && !this.alarmOff && def.forces) {
      sim.interactables.push({ kind: 'alarm', mission: true, x: A.alarm.x, z: A.alarm.z, y: A.alarm.y, r: 2, hold: () => 3 * sim.derived.plantMul, text: 'Disable the alarm', use: (it) => {
        it.gone = true;
        this.alarmOff = true;
        sim.feedMsg('Alarm disabled. They cannot call the whole garrison now.', 'good');
        sim.practice('engineering', 4);
        sim.fx.push({ t: 'pickup' });
      } });
    }
    for (let i = 0; i < (def.civilians ?? 0); i++) {
      const pts = [...A.interior, A.asset, ...A.guards.slice(0, 4)].filter(Boolean);
      const q = pts[i % pts.length];
      const near = world.walkableNear(q.x + 2, q.z + 2, 6);
      if (!near) continue;
      const c = makeCivilian({ x: near.x, z: near.z, y: world.terrain.heightAt(near.x, near.z), yaw: 0 }, pts);
      c.missionActor = true;
      sim.actors.push(c);
    }
    if (def.objectives.some((o) => o.type === 'talk')) {
      const at = A.npcs.elder ?? A.asset;
      const elder = makeNpc('elder', 'Elder Ysolde', at, { outfit: 'civilian', hat: 'none', skin: 1, tint: 2 });
      elder.missionActor = true;
      sim.actors.push(elder);
      this.elder = elder;
    }

    // what planning bought
    const reveal = clamp(sim.derived.intelReveal + (this.plan.has('intel') ? 0.5 : 0), 0, 1);
    if (reveal > 0) {
      const list = this.garrison.filter(() => sim.rng() < reveal);
      list.forEach((a) => (a.tagged = Infinity));
      if (list.length) sim.feedMsg(`Planning: ${list.length} of the garrison marked on your map.`, 'good');
    }
    if (def.objectives.some((o) => o.type === 'defend')) {
      this.asset = { x: A.asset.x, z: A.asset.z, y: A.asset.y, health: 100, max: 100 };
      if (this.plan.has('fortify')) {
        const far = [...A.spawns].sort((a, b) => b.away - a.away).slice(0, 3);
        for (const s of far) {
          const x = this.site.x + s.dir.x * (this.site.r * 0.75);
          const z = this.site.z + s.dir.z * (this.site.r * 0.75);
          sim.mines.push({ x, z, y: world.terrain.heightAt(x, z), armed: 0, by: p });
        }
      }
    }
    for (const line of def.radio?.start ?? []) sim.say(line[0], line[1]);
    sim.feedMsg(`${def.name}: ${this.site.name}`, 'gold');
    if (sim.holdFire && sim.squad().length) sim.feedMsg('Your squad is holding fire. Press G to let them shoot.', 'order');
    this.activate();
    this.refresh();
    sim.fx.push({ t: 'arrive' });
  }

  // Things that begin when an objective becomes the current one.
  activate() {
    const obj = this.current();
    if (!obj || obj.state === 'active') return;
    obj.state = 'active';
    if (obj.type === 'defend') {
      this.wave = { index: -1, nextAt: this.sim.time + obj.waves[0].delay, actors: [], lowAt: 0, obj };
      if (obj.mortars) this.mortarAt = this.sim.time + 30;
    }
    if (obj.type === 'extract') this.sim.say('', 'Extraction is marked on your compass.');
  }

  // ---------- events ----------
  takeIntel(it) {
    it.gone = true;
    this.intel++;
    this.sim.practice('intelligence', 6);
    this.sim.fx.push({ t: 'pickup' });
    this.sim.feedMsg('Documents secured.', 'good');
  }
  plantCharge(it) {
    it.gone = true;
    this.planted.push({ x: it.x, y: it.y, z: it.z });
    this.sim.practice('engineering', 5);
    this.sim.fx.push({ t: 'place' });
    this.sim.feedMsg('Charge set.', 'good');
  }
  onMarked(a) {
    this.marked.add(a.id);
  }
  onFreed() {
    this.sim.practice('leadership', 1);
  }
  onLost(a) {
    if (a === this.target) return this.fail(`${a.name} was killed. We needed him alive.`);
    this.stats.captivesLost++;
    this.sim.feedMsg(`${a.name} has been killed.`, 'bad');
  }
  onCaptured(a) {
    if (a === this.target) this.radio('take');
  }
  onEscaped(a) {
    if (a === this.target) this.fail(`${a.name} got away.`);
  }
  onSquadDown(t) {
    this.squadReport(t).down = true;
    this.stats.squadLost++;
  }
  onSquadUp(t) {
    this.squadReport(t).down = false;
    this.stats.squadLost = Math.max(0, this.stats.squadLost - 1);
  }
  onKill(a, info) {
    if (this.garrison.includes(a)) this.garrisonDead++;
    if (a === this.target) {
      if (this.def.target.capture && !info.captured) return this.fail(`${a.name} was killed. We needed him alive.`);
      this.targetKillDistance = info.player ? (info.distance ?? 0) : 0;
      this.radio('kill');
    }
  }
  onBodyFound() {
    this.bodies++;
    if (this.bodies >= B.STEALTH.BODIES_FOR_ALARM) this.raiseAlarm(null);
  }
  onLoud(x, z) {
    if (this.alarm || this.def.type === 'defense') return;
    if (Math.hypot(x - this.site.x, z - this.site.z) < this.site.r + 70 && !this.loudAt) this.loudAt = this.sim.time + 1.6;
  }
  onTalk(a) {
    const obj = this.current();
    if (a.npc !== 'elder') return false;
    if (obj?.type === 'talk' && !this.talked) {
      this.talked = true;
      this.sim.ui.push({ open: 'dialog', props: { id: obj.dialog } });
    } else this.sim.say('Elder Ysolde', 'Keep them out of my village, soldier.');
    return true;
  }

  raiseAlarm(a) {
    const sim = this.sim;
    if (this.alarm) return;
    if (this.alarmOff) {
      if (a) sim.shout(a, 70);
      return;
    }
    this.alarm = true;
    this.stats.alarm = true;
    sim.fx.push({ t: 'alarm', x: this.site.x, z: this.site.z });
    sim.feedMsg('The alarm has been raised.', 'bad');
    this.radio('alarm');
    const seen = a?.ai.seen ?? { x: sim.player.x, z: sim.player.z };
    for (const e of sim.actors) if (e.alive && e.kind === 'enemy' && e.missionActor) alertEnemy(sim, e, seen.x, seen.z, true);
    if (this.def.type !== 'defense' && this.tier >= 3) this.reinforceAt = sim.time + 24;
  }

  radio(key) {
    for (const line of this.def.radio?.[key] ?? []) this.sim.say(line[0], line[1]);
  }

  // ---------- waves ----------
  spawnWave(index) {
    const sim = this.sim;
    const wave = this.wave;
    const def = wave.obj.waves[index];
    const A = this.A;
    const world = sim.world;
    wave.index = index;
    wave.spawnedAt = sim.time;
    wave.nextAt = null;
    wave.count = Object.values(def.counts).reduce((sum, n) => sum + n, 0);
    const sides = [...A.spawns].sort((a, b) => b.away - a.away).slice(0, 6);
    const groups = [sides[Math.floor(sim.rng() * sides.length)], sides[Math.floor(sim.rng() * sides.length)]];
    let k = 0;
    for (const [type, count] of Object.entries(def.counts)) {
      for (let i = 0; i < count; i++) {
        const g = groups[k++ % groups.length];
        const near = world.walkableNear(g.x + (sim.rng() - 0.5) * 14, g.z + (sim.rng() - 0.5) * 14, 10) ?? g;
        const a = makeEnemy(type, this.tier, { x: near.x, z: near.z, y: world.terrain.heightAt(near.x, near.z), yaw: Math.atan2(this.site.x - near.x, -(this.site.z - near.z)) }, sim.rng);
        a.missionActor = true;
        a.attacker = true;
        a.site = this.site.id;
        a.ai.post = { x: this.asset.x + (sim.rng() - 0.5) * 10, z: this.asset.z + (sim.rng() - 0.5) * 10, yaw: 0 };
        sim.actors.push(a);
        wave.actors.push(a);
        alertEnemy(sim, a, this.asset.x, this.asset.z, true);
        if (this.elderHelps) a.tagged = sim.time + 40;
      }
    }
    sim.feedMsg(`Wave ${index + 1} of ${wave.obj.waves.length}`, 'bad');
    sim.fx.push({ t: 'wave' });
    this.radio('wave');
  }

  updateWaves() {
    const sim = this.sim;
    const wave = this.wave;
    if (!wave || wave.obj.state !== 'active') return;
    const total = wave.obj.waves.length;
    const alive = wave.actors.filter((a) => a.alive && !a.captured && !a.surrendered);
    if (wave.index < 0) {
      if (sim.time >= wave.nextAt) this.spawnWave(0);
    } else if (wave.index < total - 1) {
      if (wave.nextAt === null) {
        // the next wave comes when this one is nearly spent, or after a while regardless
        const spent = alive.length <= Math.max(1, Math.floor(wave.count * 0.15)) || sim.time - wave.spawnedAt > 85;
        if (spent) wave.nextAt = sim.time + wave.obj.waves[wave.index + 1].delay;
      } else if (sim.time >= wave.nextAt) this.spawnWave(wave.index + 1);
    } else if (alive.length === 0) wave.finished = true;
    else if (alive.length <= 2) {
      // a couple of stragglers eventually give up
      if (!wave.lowAt) wave.lowAt = sim.time;
      if (sim.time - wave.lowAt > 40) {
        alive.forEach((a) => (a.gone = true));
        wave.finished = true;
        sim.feedMsg('The last of them are pulling back.', 'good');
      }
    }
    // keep attackers coming at the position, and count the ones tearing it up
    let close = 0;
    for (const a of alive) {
      const d = Math.hypot(a.x - this.asset.x, a.z - this.asset.z);
      if (d < 7.5) close++;
      if (a.ai.state !== 'combat' && a.ai.state !== 'search') alertEnemy(sim, a, this.asset.x, this.asset.z, true);
    }
    if (close > 0) {
      this.asset.health -= Math.min(close, 4) * 1.6 * 0.25;
      if (!this.assetWarned || sim.time - this.assetWarned > 8) {
        this.assetWarned = sim.time;
        sim.feedMsg('They are inside the position!', 'bad');
      }
      if (this.asset.health <= 0) this.fail('The position was overrun.');
    }
    // mortars
    if (wave.obj.mortars && this.mortarAt && sim.time > this.mortarAt && wave.index >= 0 && !wave.finished) {
      this.mortarAt = sim.time + 22 + sim.rng() * 10;
      const people = sim.actors.filter((a) => a.alive && a.faction === 'ally' && a.kind !== 'npc');
      for (let i = 0; i < 3; i++) {
        const who = i === 0 ? sim.player : (people[Math.floor(sim.rng() * people.length)] ?? sim.player);
        const x = who.x + (sim.rng() - 0.5) * 12;
        const z = who.z + (sim.rng() - 0.5) * 12;
        const y = sim.world.terrain.heightAt(x, z);
        sim.fx.push({ t: 'marker', x, y, z, r: 7, seconds: 3.4, hostile: true });
        sim.pendingStrikes.push({ at: sim.time + 3.2 + i * 0.5, run: () => sim.explode('mortar', x, y + 0.3, z, this.mortarCrew, { spec: { damage: 120, radius: 7 } }) });
      }
      sim.say('', 'Incoming! Mortars!');
    }
  }

  // ---------- the step ----------
  update(dt) {
    const sim = this.sim;
    this.stats.time += dt;
    if (this.ended) {
      if (this.endAt && sim.time >= this.endAt) {
        this.endAt = 0;
        sim.ui.push({ missionEnd: { missionId: this.def.id, stats: this.stats } });
      }
      return;
    }
    if (this.loudAt && sim.time > this.loudAt) {
      this.loudAt = 0;
      this.raiseAlarm(null);
    }
    if (this.reinforceAt && sim.time > this.reinforceAt) {
      this.reinforceAt = 0;
      const far = [...this.A.spawns].sort((a, b) => b.away - a.away)[0];
      if (far) {
        const n = 2 + Math.ceil(this.tier / 2);
        for (let i = 0; i < n; i++) {
          const near = sim.world.walkableNear(far.x + (sim.rng() - 0.5) * 10, far.z + (sim.rng() - 0.5) * 10, 8) ?? far;
          const a = makeEnemy(i === 0 && this.tier >= 5 ? 'gunner' : 'rifleman', this.tier, { x: near.x, z: near.z, y: sim.world.terrain.heightAt(near.x, near.z), yaw: 0 }, sim.rng);
          a.missionActor = true;
          a.ai.post = { x: this.site.x, z: this.site.z, yaw: 0 };
          sim.actors.push(a);
          alertEnemy(sim, a, sim.player.x, sim.player.z, true);
        }
        sim.feedMsg('Legion reinforcements are arriving.', 'bad');
      }
    }
    this.checkTimer -= dt;
    if (this.checkTimer > 0) return;
    this.checkTimer = 0.25;
    this.updateWaves();
    if (this.ended) return;
    this.check();
    this.refresh();
  }

  check() {
    const sim = this.sim;
    const p = sim.player;
    const A = this.A;
    // Brightwater: what the elder decided
    const elder = sim.save.story.flags.elder;
    if (elder && !this.elderDone && this.talked) {
      this.elderDone = true;
      if (elder === 'trust') {
        this.elderHelps = true;
        for (let i = 0; i < 2; i++) {
          const near = sim.world.walkableNear(this.asset.x + 4 + i * 2, this.asset.z - 5, 6) ?? this.asset;
          const a = makeAlly('rifleman', 3 + this.tier, { x: near.x, z: near.z, y: sim.world.terrain.heightAt(near.x, near.z), yaw: 0 }, { state: 'defend', name: i ? 'Village militia' : 'Village militia' });
          a.look.outfit = 'civilian';
          a.look.hat = 'cap';
          a.missionActor = true;
          sim.actors.push(a);
        }
        this.asset.max = this.asset.health = 140;
        sim.feedMsg('Two villagers take up rifles beside you. The shepherds will call out the raiders as they come.', 'good');
        sim.practice('negotiating', 6);
      } else if (elder === 'wary') {
        this.elderHelps = true;
        sim.feedMsg('The shepherds will call out the raiders as they come.', 'good');
      }
    }
    const freed = this.captives.filter((c) => c.alive && c.freed);
    for (const obj of this.objectives) {
      if (obj.state === 'done') continue;
      const active = obj.state === 'active';
      let done = false;
      switch (obj.type) {
        case 'reach': {
          const at = this.point(obj.at);
          done = active && Math.hypot(p.x - at.x, p.z - at.z) < (obj.radius ?? 14);
          break;
        }
        case 'eliminate':
          if (obj.who === 'target') done = !!this.target && !this.target.alive;
          else {
            const need = Math.ceil((obj.who === 'all' ? 1 : obj.who) * this.garrisonTotal);
            obj.progress = `${Math.min(this.garrisonDead, need)}/${need}`;
            done = this.garrisonDead >= need;
          }
          break;
        case 'rescue':
          obj.progress = `${freed.length}/${obj.count}`;
          done = freed.length >= Math.min(obj.count, this.captives.filter((c) => c.alive).length) && freed.length > 0;
          if (this.captives.length && this.captives.every((c) => !c.alive)) return this.fail('The captives were killed.');
          break;
        case 'capture':
          done = !!this.target && this.target.captured;
          break;
        case 'tag':
          obj.progress = `${Math.min(this.marked.size, obj.count)}/${obj.count}`;
          done = this.marked.size >= obj.count;
          break;
        case 'collect':
          obj.progress = `${this.intel}/${obj.count}`;
          done = this.intel >= obj.count;
          break;
        case 'plant':
          obj.progress = `${this.planted.length}/${obj.count}`;
          done = this.planted.length >= obj.count;
          break;
        case 'defend':
          if (this.wave && active) obj.progress = this.wave.index >= 0 ? `wave ${this.wave.index + 1}/${obj.waves.length}` : 'stand by';
          done = active && !!this.wave?.finished;
          break;
        case 'talk':
          done = this.talked && !!sim.save.story.flags.elder;
          break;
        case 'extract': {
          if (!active) break;
          const ex = A.exfil;
          const near = Math.hypot(p.x - ex.x, p.z - ex.z) < 9;
          let ready = near;
          if (near && obj.with === 'captives') {
            const away = freed.filter((c) => Math.hypot(c.x - ex.x, c.z - ex.z) > 26);
            ready = away.length === 0;
            if (!ready) this.hint('Wait for the captives to reach you.');
          } else if (near && obj.with === 'prisoner') {
            ready = !!this.target && this.target.alive && Math.hypot(this.target.x - ex.x, this.target.z - ex.z) < 26;
            if (!ready) this.hint('Wait for your prisoner.');
          }
          done = ready;
          break;
        }
        default:
      }
      if (done) {
        obj.state = 'done';
        sim.fx.push({ t: 'objective' });
        sim.practice('intelligence', 2.5);
        this.radio(obj.id);
        if (obj.type === 'eliminate' && obj.who !== 'target') {
          // whoever is left has had enough
          for (const a of this.garrison) if (a.alive && !a.captured) sim.surrender(a);
        }
      }
    }
    if (!this.current()) return this.succeed();
    this.activate();
  }

  hint(text) {
    if (this.sim.time - (this.hintAt ?? -9) < 6) return;
    this.hintAt = this.sim.time;
    this.sim.feedMsg(text, 'warn');
  }

  // What the HUD shows: objective lines, bonus lines and where the compass points.
  refresh() {
    const sim = this.sim;
    const A = this.A;
    const cur = this.current();
    const markers = [];
    const mk = (pt, label, kind = 'objective') => pt && markers.push({ x: pt.x, y: (pt.y ?? sim.world.terrain.heightAt(pt.x, pt.z)) + 2.2, z: pt.z, label, kind });
    if (cur) {
      switch (cur.type) {
        case 'reach':
          mk(this.point(cur.at), 'Objective');
          break;
        case 'eliminate':
          if (cur.who === 'target' && this.target) {
            if (this.target.tagged > sim.time) mk(this.target, this.target.name, 'target');
            else if (this.searchArea) markers.push({ x: this.searchArea.x, y: this.site.ground + 3, z: this.searchArea.z, label: 'Search area', kind: 'area', r: this.searchArea.r });
            else mk(A.hvt ?? A.center, this.target.name, 'target');
          } else mk(A.center, this.site.name);
          break;
        case 'rescue':
          for (const c of this.captives) if (c.alive && !c.freed) mk(c, 'Captive');
          break;
        case 'capture':
          if (this.target) mk(this.target.tagged > sim.time || this.target.captured ? this.target : (A.hvt ?? A.center), this.target.name, 'target');
          break;
        case 'tag':
          mk(A.center, this.site.name);
          break;
        case 'collect':
          for (const it of sim.interactables) if (it.kind === 'intel' && !it.gone) mk(it, 'Documents');
          break;
        case 'plant':
          for (const it of sim.interactables) if (it.kind === 'charge' && !it.gone) mk(it, 'Set charge');
          break;
        case 'defend':
          mk(this.asset, 'Hold');
          break;
        case 'talk':
          mk(this.elder, 'Elder');
          break;
        case 'extract':
          mk(A.exfil, 'Extraction', 'exfil');
          break;
        default:
      }
    }
    sim.objective = {
      title: this.def.name,
      lines: this.objectives.map((o) => ({ text: o.text, progress: o.state === 'done' ? null : o.progress, state: o.state })),
      bonus: (this.def.bonus ?? []).map((b) => ({ text: b.text, state: this.bonusHolds(b) ? 'active' : 'lost' })),
      markers,
      asset: this.asset && cur?.type === 'defend' ? this.asset.health / this.asset.max : null,
      alarm: this.alarm,
    };
  }

  bonusHolds(b) {
    const s = this.stats;
    switch (b.type) {
      case 'noAlarm':
        return !s.alarm;
      case 'noDowns':
        return s.downs === 0;
      case 'noLosses':
        return s.squadLost === 0;
      case 'allCaptives':
        return s.captivesLost === 0;
      case 'noKills':
        return s.kills === 0 && s.squadKills === 0;
      case 'noCivilians':
        return s.civilians === 0;
      case 'longShot':
        return this.target?.alive ? true : (this.targetKillDistance ?? 0) >= b.metres;
      case 'assetHealth':
        return !this.asset || this.asset.health / this.asset.max >= b.share;
      default:
        return false;
    }
  }

  // ---------- endings ----------
  finish(success) {
    const sim = this.sim;
    this.ended = true;
    this.endAt = sim.time + (success ? 2.6 : 3.2);
    this.stats.success = success;
    this.stats.items = { ...sim.player.items };
    this.stats.rescued = this.captives.filter((c) => c.alive && c.freed).length;
    for (const a of sim.squad()) this.squadReport(a).down = a.downed;
    for (const b of this.def.bonus ?? []) this.stats.bonus[b.id] = success && this.bonusHolds(b);
    sim.player.locked = true;
    sim.godMode = true;
    for (const a of sim.actors) {
      a.ai.fireOk = false;
      if (a.kind === 'enemy') a.ai.react = sim.time + 99;
    }
  }
  succeed() {
    if (this.ended) return;
    const sim = this.sim;
    // charges go up as you leave
    this.planted.forEach((c, i) => sim.pendingStrikes.push({ at: sim.time + 0.3 + i * 0.5, run: () => sim.fx.push({ t: 'explosion', x: c.x, y: c.y + 1, z: c.z, r: 14, big: true }) }));
    this.radio('complete');
    sim.fx.push({ t: 'missionwon' });
    sim.feedMsg('Mission complete.', 'gold');
    if (sim.squad().length) sim.practice('leadership', 4 + this.tier);
    this.finish(true);
  }
  fail(reason) {
    if (this.ended) return;
    this.stats.reason = reason;
    this.sim.feedMsg(reason, 'bad');
    this.sim.fx.push({ t: 'missionlost' });
    this.finish(false);
  }
}
