// The simulation: one object that owns the world, the player, everyone else and whatever is going
// on (free roam, a training event or a mission), and advances it all one step at a time.
// It never draws. The view reads its state each frame and plays what it finds in `fx`.

import { B, clamp, mulberry } from '../game/balance.js';
import { deriveStats } from '../game/character.js';
import { blastDamage, surrenderChance } from '../game/combat.js';
import { composeForce } from '../game/missions.js';
import { RANKS, SUPPORTS } from '../game/ranks.js';
import { NPCS, npcDialog } from '../game/story.js';
import { EVENTS, trainingSummary } from '../game/training.js';
import { activeSquad } from '../game/squad.js';
import { LOCATIONS, sideOf } from '../game/world.js';
import { nextStory } from '../game/missions.js';
import { promotionDue } from '../game/ranks.js';
import { Player } from './player.js';
import { alertEnemy, angleDiff, updateActor } from './ai.js';
import { chestY, makeAlly, makeCivilian, makeEnemy, makeNpc, makeSquadMember, rayActor } from './actors.js';
import { BASE } from './baseplan.js';
import { MissionRun } from './mission.js';
import { TrainingRun } from './training.js';

const COVER_CELL = 12;
const NPC_LOOK = {
  briggs: { hat: 'campaign', skin: 3 },
  finch: { hat: 'cap', skin: 1 },
  okoro: { hat: 'cap', skin: 4 },
  vasquez: { hat: 'cap', skin: 2 },
  ilves: { hat: 'boonie', skin: 0 },
  dane: { hat: 'boonie', skin: 1 },
  sato: { hat: 'beret', skin: 1 },
  marsh: { hat: 'beret', skin: 0 },
  adeyemi: { hat: 'beret', skin: 4, outfit: 'officer' },
  pops: { hat: 'cap', skin: 4 },
  top: { hat: 'campaign', skin: 0 },
  doc: { hat: 'none', skin: 2, outfit: 'medic' },
  holt: { hat: 'helmet', skin: 3 },
};

export class Sim {
  constructor({ world, api, fov = 68, seed = Date.now() }) {
    this.world = world;
    this.api = api;
    this.rng = mulberry(seed | 0);
    this.time = 0;
    this.save = api.getSave();
    this.derived = deriveStats(this.save);
    this.hour = this.save.world.hour;
    this.day = this.save.world.day;
    this.baseFov = fov;
    this.player = new Player(this);
    this.actors = [];
    this.bodies = [];
    this.projectiles = [];
    this.mines = [];
    this.shootables = [];
    this.dummies = [];
    this.interactables = [];
    this.ladders = world.colliders.boxes.filter((b) => b.kind === 'ladder');
    this.fx = [];
    this.feed = [];
    this.radio = [];
    this.ui = [];
    this.mode = 'roam';
    this.mission = null;
    this.training = null;
    this.holdFire = false;
    this.lastLoud = -99;
    this.combatCount = 0;
    this.pathBudget = 2;
    this.pendingPractice = {};
    this.pendingStats = {};
    this.flushTimer = 4;
    this.clockTimer = 30;
    this.slowTimer = 0;
    this.itemsDirty = false;
    this.objective = null;
    this.supportReady = {};
    this.supportIndex = 0;
    this.pendingStrikes = [];
    this.ambient = {};
    this.godMode = false;
    this.friendlyFire = false;
    this.rescuer = null;

    // every cover point on the island, in a grid
    this.coverGrid = new Map();
    for (const site of Object.values(world.sites)) {
      for (const p of site.anchors.cover) {
        const key = Math.floor(p.x / COVER_CELL) * 4096 + Math.floor(p.z / COVER_CELL);
        let list = this.coverGrid.get(key);
        if (!list) this.coverGrid.set(key, (list = []));
        list.push(p);
      }
    }
    this.enterWorld();
  }

  // ---------- arriving ----------
  enterWorld() {
    const save = this.save;
    const p = this.player;
    this.actors = [];
    this.spawnCamp();
    if (save.phase === 'intake') p.place(BASE.spawn.x, BASE.spawn.z, BASE.spawn.yaw);
    else p.place(BASE.parade.x + 6, BASE.parade.z + 14, 0);
    p.health = this.derived.maxHealth;
    p.stamina = this.derived.maxStamina;
    p.items = { ...save.items };
    p.loadWeapons(save, this.derived);
    this.buildCaches();
    this.refreshObjective();
    if (save.phase === 'intake' && !save.story.seen?.arrival) this.arrivalAt = 1.2;
  }

  spawnCamp() {
    const save = this.save;
    for (const [id, pos] of Object.entries(this.world.sites.hawthorne.anchors.npcs)) {
      let at = pos;
      if (id === 'briggs' && save.phase === 'intake') at = { x: BASE.arrival.x, z: BASE.arrival.z, y: this.world.terrain.heightAt(BASE.arrival.x, BASE.arrival.z), yaw: Math.PI };
      const npc = makeNpc(id, NPCS[id]?.name ?? id, at, NPC_LOOK[id] ?? {});
      npc.home = 'hawthorne';
      this.actors.push(npc);
    }
    // recruits drilling on the square, for company
    const pts = [[-16, -4], [16, -4], [16, 18], [-16, 18]].map(([x, z]) => ({ x: BASE.parade.x + x, z: BASE.parade.z + z }));
    for (let i = 0; i < 4; i++) {
      const start = pts[0];
      const a = makeCivilian({ x: start.x + i * 1.2, z: start.z + (i % 2), y: this.world.terrain.heightAt(start.x, start.z), yaw: 0 }, pts);
      a.look = { outfit: 'ally', skin: i % 5, hat: 'cap', weapon: 'none' };
      a.name = 'Recruit';
      a.ai.patrol.index = 1;
      a.ai.patrol.wait = 0;
      a.drillSquad = true;
      a.home = 'hawthorne';
      this.actors.push(a);
    }
    for (const g of this.world.sites.hawthorne.anchors.guards.slice(0, 4)) {
      const a = makeAlly('rifleman', 4, g, { state: 'defend' });
      a.home = 'hawthorne';
      a.name = 'Sentry';
      this.actors.push(a);
    }
    this.interactables = this.interactables.filter((it) => it.kind !== 'bunk');
    this.interactables.push({ kind: 'bunk', x: BASE.bunk.x, z: BASE.bunk.z + 3.4, y: this.world.terrain.heightAt(BASE.bunk.x, BASE.bunk.z), r: 2.6, text: 'Rest at your bunk', use: () => this.ui.push({ open: 'travel', props: { rest: true } }) });
  }

  buildCaches() {
    this.interactables = this.interactables.filter((it) => it.kind !== 'cache');
    for (const cache of this.world.caches) {
      if (this.save.world.looted[cache.id]) continue;
      this.interactables.push({
        kind: 'cache', id: cache.id, x: cache.x, z: cache.z, y: cache.y, r: 2.2, hold: 1, text: 'Open the supply cache', tier: cache.tier,
        use: (it) => {
          const report = this.api.act('lootCache', { id: cache.id, tier: cache.tier }, { quiet: true });
          it.gone = true;
          if (!report) return;
          const parts = [`${report.rp} RP`, ...Object.entries(report.items).map(([id, n]) => `${n} ${id}`)];
          if (report.attachment) parts.push(report.attachment.name);
          this.feedMsg(`Cache: ${parts.join(', ')}`, 'good');
          this.player.items = { ...this.api.getSave().items };
          this.fx.push({ t: 'pickup' });
        },
      });
    }
  }

  // The save changed (a purchase, practice, a promotion): pick up the new numbers.
  onSave(save) {
    if (!save) return;
    const leveled = save.level > this.save.level;
    this.save = save;
    this.derived = deriveStats(save);
    const p = this.player;
    if (!this.mission?.issue && !this.training?.issue) p.loadWeapons(save, this.derived);
    if (this.mode !== 'mission' && !this.itemsDirty) p.items = { ...save.items };
    if (leveled) {
      this.feedMsg(`Level ${save.level}. ${B.ATTR.POINTS_PER_LEVEL} attribute points to spend.`, 'gold');
      this.fx.push({ t: 'levelup' });
    }
    if (this.mode === 'roam') this.refreshObjective();
  }

  // ---------- small services ----------
  lightAt(x, z) {
    return this.world.lightAt(x, z, this.hour);
  }
  feedMsg(text, tone = 'info') {
    this.feed.push({ text, tone, t: this.time });
    if (this.feed.length > 30) this.feed.shift();
  }
  say(who, text) {
    this.radio.push({ who, text, t: this.time });
    if (this.radio.length > 12) this.radio.shift();
  }
  practice(attr, units) {
    this.pendingPractice[attr] = (this.pendingPractice[attr] ?? 0) + units;
  }
  stat(key, n) {
    if (this.mission) this.mission.stats[key] = (this.mission.stats[key] ?? 0) + n;
    else this.pendingStats[key] = (this.pendingStats[key] ?? 0) + n;
  }
  statMax(key, value) {
    if (this.mission) this.mission.stats[key] = Math.max(this.mission.stats[key] ?? 0, value);
    else this.pendingStats[key] = Math.max(this.pendingStats[key] ?? 0, value);
  }
  alarmOn() {
    return !!this.mission?.alarm || !!this.roamAlarm;
  }
  loud() {
    return this.time - this.lastLoud < 6 || this.alarmOn() || this.combatCount > 0;
  }
  inFight() {
    return this.combatCount > 0;
  }
  coverNear(x, z, r) {
    const out = [];
    const c0 = Math.floor((x - r) / COVER_CELL);
    const c1 = Math.floor((x + r) / COVER_CELL);
    const d0 = Math.floor((z - r) / COVER_CELL);
    const d1 = Math.floor((z + r) / COVER_CELL);
    for (let cz = d0; cz <= d1; cz++) {
      for (let cx = c0; cx <= c1; cx++) {
        const list = this.coverGrid.get(cx * 4096 + cz);
        if (!list) continue;
        for (const p of list) if ((p.x - x) ** 2 + (p.z - z) ** 2 < r * r) out.push(p);
      }
    }
    return out;
  }
  unawareEnemyWithin(r) {
    const p = this.player;
    for (const a of this.actors) {
      if (!a.alive || a.kind !== 'enemy' || a.ai.state === 'combat') continue;
      if ((a.x - p.x) ** 2 + (a.z - p.z) ** 2 < r * r) return true;
    }
    return false;
  }
  squad() {
    return this.actors.filter((a) => a.kind === 'squad');
  }

  // ---------- marking ----------
  tag(a, seconds) {
    a.tagged = Math.max(a.tagged, this.time + seconds);
  }
  markables() {
    const out = this.dummies.filter((d) => !d.found);
    for (const a of this.actors) if (a.alive && a.kind === 'enemy') out.push(a);
    return out;
  }
  // A deliberate mark through glass: it sticks.
  mark(a) {
    if (a.dummy) {
      a.found = true;
      this.fx.push({ t: 'tag' });
      this.training?.onFound?.(a);
      return;
    }
    if (a.tagged === Infinity) return;
    a.tagged = Infinity;
    this.fx.push({ t: 'tag' });
    this.practice('vision', 2);
    this.mission?.onMarked?.(a);
  }

  // ---------- noise and alarm ----------
  noise(x, z, radius, kind, by) {
    if (kind === 'enemyfire') {
      this.lastLoud = this.time;
      return;
    }
    const loud = radius > 40;
    if (loud) this.lastLoud = this.time;
    const hostileToEnemy = !by || by === this.player || by.faction !== 'enemy';
    if (!hostileToEnemy) return;
    const r2 = radius * radius;
    for (const a of this.actors) {
      if (!a.alive) continue;
      const d2 = (a.x - x) ** 2 + (a.z - z) ** 2;
      if (a.kind === 'enemy') {
        if (d2 < r2) alertEnemy(this, a, x, z, loud);
      } else if (a.kind === 'civilian' && loud && d2 < 80 * 80 && !a.drillSquad) {
        a.ai.panic = this.time + 25;
        a.ai.hide = this.hidingPlace(a);
      }
    }
    if (loud) this.mission?.onLoud?.(x, z);
  }
  hidingPlace(a) {
    const site = this.world.siteNear(a.x, a.z, 40);
    const pts = site?.anchors.interior ?? [];
    let best = null;
    let bestD = Infinity;
    for (const p of pts) {
      const d = (p.x - a.x) ** 2 + (p.z - a.z) ** 2;
      if (d < bestD) {
        best = p;
        bestD = d;
      }
    }
    return best;
  }
  footsteps(x, z, radius) {
    for (const a of this.actors) {
      if (!a.alive || a.kind !== 'enemy' || a.ai.state === 'combat') continue;
      const d = Math.hypot(a.x - x, a.z - z);
      if (d > radius) continue;
      a.ai.aware = Math.min(a.drill ? 1 : 0.95, a.ai.aware + 0.4 * (1 - d / radius) + (d < 2.5 ? 0.3 : 0));
      a.ai.seen = { x, z, t: this.time };
    }
  }
  shout(a, radius) {
    const seen = a.ai.seen ?? a;
    for (const o of this.actors) {
      if (o === a || !o.alive || o.kind !== 'enemy') continue;
      if ((o.x - a.x) ** 2 + (o.z - a.z) ** 2 < radius * radius) alertEnemy(this, o, seen.x, seen.z, true);
    }
  }
  raiseAlarm(a) {
    if (this.mission) this.mission.raiseAlarm(a);
    else {
      this.roamAlarm = this.time + 60;
      this.shout(a, 130);
      this.fx.push({ t: 'alarm', x: a.x, z: a.z });
    }
  }
  onDetected(a) {
    this.mission?.onDetected?.(a);
  }
  bodyFound(a, body) {
    this.fx.push({ t: 'alert', x: a.x, y: a.y + 2, z: a.z });
    for (const o of this.actors) {
      if (o === a || !o.alive || o.kind !== 'enemy') continue;
      if ((o.x - body.x) ** 2 + (o.z - body.z) ** 2 < 30 * 30) alertEnemy(this, o, body.x, body.z, false);
    }
    this.mission?.onBodyFound?.(a);
  }
  onEscaped(a) {
    a.alive = false;
    a.gone = true;
    this.mission?.onEscaped?.(a);
  }
  // A round going past: anyone it nearly hit keeps his head down and knows he is under fire.
  bulletPass(ox, oy, oz, dx, dy, dz, t, loud, victim) {
    const p = this.player;
    const pin = B.COMBAT.SUPPRESS_SECONDS * (this.derived.perk === 'walking_fire' ? 1.6 : 1);
    for (const a of this.actors) {
      if (!a.alive || a.kind !== 'enemy' || a === victim) continue;
      const ax = a.x - ox;
      const ay = a.y + 1.1 - oy;
      const az = a.z - oz;
      const along = clamp(ax * dx + ay * dy + az * dz, 0, t);
      const px = ax - dx * along;
      const py = ay - dy * along;
      const pz = az - dz * along;
      if (px * px + py * py + pz * pz > 5.5) continue;
      a.ai.suppressed = Math.max(a.ai.suppressed, this.time + pin);
      if (a.ai.state !== 'combat') alertEnemy(this, a, p.x, p.z, true);
    }
    void loud;
  }

  // ---------- hurting and killing ----------
  // Returns true if the actor died (or, for squad, went down).
  damageActor(t, amount, info = {}) {
    if (!t.alive || t.invulnerable || t.downed) return false;
    if (t.drill || t.dummy) return false;
    t.health -= amount;
    t.anim.hit = 1;
    this.fx.push({ t: 'blood', x: t.x, y: t.y + (info.zone === 'head' ? 1.6 : 1.1), z: t.z });
    if (t.health <= 0) {
      this.kill(t, info);
      return true;
    }
    if (t.kind === 'enemy' && info.from) {
      t.ai.suppressed = Math.max(t.ai.suppressed, this.time + 1.4);
      if (t.ai.state !== 'combat') alertEnemy(this, t, info.from.x, info.from.z, true);
    } else if (t.kind === 'civilian') {
      t.ai.panic = this.time + 40;
      t.ai.hide = this.hidingPlace(t);
    }
    return false;
  }

  kill(t, info = {}) {
    t.health = 0;
    t.ai.fireOk = false;
    t.ai.goal = null;
    if (t.kind === 'squad') {
      t.downed = true;
      this.say('', `${t.name} is down!`);
      this.mission?.onSquadDown?.(t);
      this.fx.push({ t: 'down', x: t.x, y: t.y, z: t.z });
      return;
    }
    t.alive = false;
    t.diedAt = this.time;
    this.fx.push({ t: 'death', x: t.x, y: t.y, z: t.z, faction: t.faction });
    if (t.kind === 'enemy') {
      this.bodies.push({ x: t.x, y: t.y, z: t.z, found: !!info.loudKill, at: this.time });
      if (this.bodies.length > 60) this.bodies.shift();
      let xp = t.stats.xp;
      if (info.player) {
        const stealthy = !!info.unaware || !!info.takedown;
        const long = (info.distance ?? 0) >= B.XP.LONG_SHOT_M;
        if (info.zone === 'head') xp *= 1 + B.XP.HEADSHOT;
        if (stealthy) xp *= 1 + B.XP.STEALTH_KILL;
        if (long) xp *= 1 + B.XP.LONG_SHOT;
        this.stat('kills', 1);
        if (info.zone === 'head' && !info.melee) this.stat('headshots', 1);
        if (stealthy) {
          this.stat('stealthKills', 1);
          this.practice('stealth', 3);
        }
        if (!info.melee && !info.explosive) this.statMax('longestShot', info.distance ?? 0);
        if ((info.distance ?? 99) < 8) this.practice('quickness', 1);
        if (info.explosive) this.practice('engineering', 2);
        this.practice('accuracy', info.melee || info.explosive ? 0 : 1);
        const tags = [info.zone === 'head' && !info.melee ? 'headshot' : null, stealthy ? 'silent' : null, long ? `${Math.round(info.distance)} m` : null].filter(Boolean);
        this.feedMsg(`${t.name} down${tags.length ? ` (${tags.join(', ')})` : ''}  +${Math.round(xp * this.derived.xpMul)} XP`, 'xp');
      } else if (info.from && (info.from.kind === 'squad' || info.from.escort)) {
        xp *= B.XP.SQUAD_KILL_SHARE;
        info.from.kills = (info.from.kills ?? 0) + 1;
        if (info.from.kind === 'squad') {
          this.stat('squadKills', 1);
          this.practice('leadership', 1);
          if (this.mission && info.from.member) this.mission.squadReport(info.from).kills += 1;
        }
      } else xp = 0;
      if (xp > 0) {
        if (this.mission) this.mission.stats.killXp += xp;
        else this.api.act('gainXp', { amount: xp }, { quiet: true });
      }
      if (this.rng() < 0.3) this.dropAmmo(t);
      this.mission?.onKill?.(t, info);
      this.ambientKill(t);
    } else if (t.kind === 'captive' || t.kind === 'prisoner') this.mission?.onLost?.(t);
    else if (t.kind === 'civilian') {
      if (info.player) this.stat('civilians', 1);
    } else if (t.kind === 'ally') this.stat('alliesLost', 1);
  }

  dropAmmo(t) {
    this.interactables.push({
      kind: 'ammo', x: t.x + 0.6, z: t.z + 0.4, y: t.y, r: 1.6, text: 'Pick up ammunition', until: this.time + 240,
      use: (it) => {
        it.gone = true;
        for (const w of this.player.weapons) if (w) w.reserve = Math.min(w.eff.reserveMax, w.reserve + Math.max(8, Math.round(w.eff.mag * 1.2)));
        this.fx.push({ t: 'pickup' });
      },
    });
  }

  onPlayerDown(info) {
    const p = this.player;
    const m = this.mission;
    if (this.mode === 'training') {
      p.health = this.derived.maxHealth;
      return;
    }
    this.stat('downs', 1);
    if (m && m.medevac) {
      m.medevac = false;
      p.health = this.derived.maxHealth * 0.5;
      this.say('Medevac', 'Got you. On your feet, that was your one.');
      return;
    }
    const helper = this.actors.find((a) => a.alive && !a.downed && (a.kind === 'squad' || a.escort) && Math.hypot(a.x - p.x, a.z - p.z) < 45);
    if (helper) {
      p.downed = true;
      p.downedUntil = this.time + B.COMBAT.DOWNED_SECONDS;
      p.aimT = 0;
      this.rescuer = null;
      this.say(helper.name, 'Leader’s hit! Cover me, I’m going to them!');
      this.fx.push({ t: 'playerdown' });
      void info;
      return;
    }
    this.onPlayerDeath();
  }

  onPlayerDeath() {
    const p = this.player;
    if (!p.alive) return;
    p.alive = false;
    p.downed = false;
    this.fx.push({ t: 'playerdead' });
    if (this.mission) this.mission.fail('You were killed in action.');
    else this.respawnAt = this.time + 3.5;
  }

  // Someone treats someone: a medic's dressing, or getting a downed soldier back up.
  treat(by, patient) {
    const p = this.player;
    if (patient === p) {
      if (p.downed) {
        p.downed = false;
        p.health = this.derived.maxHealth * 0.4;
        p.stance = 'crouch';
        this.rescuer = null;
        this.say(by.name, 'You’re good. Get up.');
      } else p.health = Math.min(this.derived.maxHealth, p.health + (by.stats?.heal || B.SQUAD.MEDIC_HEAL));
      this.fx.push({ t: 'heal' });
      return;
    }
    if (patient.downed) {
      patient.downed = false;
      patient.health = patient.maxHealth * 0.4;
      patient.anim.death = 0;
      this.mission?.onSquadUp?.(patient);
      if (by === p) this.practice('medicine', 5);
      this.say(patient.name, 'Back in it.');
    } else patient.health = Math.min(patient.maxHealth, patient.health + (by.stats?.heal || B.SQUAD.MEDIC_HEAL));
  }

  // ---------- capture ----------
  surrenderOdds(a) {
    let alone = true;
    for (const o of this.actors) {
      if (o === a || !o.alive || o.kind !== 'enemy' || o.surrendered || o.captured) continue;
      if ((o.x - a.x) ** 2 + (o.z - a.z) ** 2 < 22 * 22) {
        alone = false;
        break;
      }
    }
    return surrenderChance({ surrender: this.derived.surrender, health: a.health / a.maxHealth, alone, pinned: a.ai.suppressed > this.time, officer: a.type === 'officer' || a.type === 'boss', tier: a.tier ?? 1 });
  }
  surrender(a) {
    a.surrendered = true;
    a.ai.state = 'surrender';
    a.ai.fireOk = false;
    a.ai.goal = null;
    a.ai.target = null;
    a.stance = 'crouch';
  }
  takeAlive(a) {
    a.surrendered = false;
    a.captured = true;
    a.faction = 'civ';
    a.ai.fireOk = false;
    a.ai.target = null;
    this.stat('captured', 1);
    if (a.capture) {
      a.kind = 'prisoner';
      a.ai.state = 'follow';
      a.stance = 'stand';
      this.mission?.onCaptured?.(a);
    } else {
      // an ordinary soldier sits out the rest of the fight
      a.kind = 'prisoner';
      a.ai.state = 'held';
      const xp = a.stats.xp * 1.3;
      if (this.mission) this.mission.stats.killXp += xp;
      else this.api.act('gainXp', { amount: xp }, { quiet: true });
      this.feedMsg(`${a.name} taken prisoner  +${Math.round(xp * this.derived.xpMul)} XP`, 'xp');
      this.mission?.onKill?.(a, { captured: true });
      this.ambientKill(a);
    }
  }
  restrain(a) {
    this.takeAlive(a);
    this.fx.push({ t: 'pickup' });
  }
  takedown(a) {
    this.practice('stealth', 6);
    this.practice('quickness', 2);
    this.fx.push({ t: 'takedown', x: a.x, y: a.y, z: a.z });
    if (a.capture) this.takeAlive(a);
    else this.damageActor(a, 99999, { from: this.player, player: true, takedown: true, unaware: true, melee: true, distance: 1 });
  }
  freeCaptive(a) {
    a.ai.state = 'follow';
    a.stance = 'stand';
    a.freed = true;
    this.fx.push({ t: 'pickup' });
    this.mission?.onFreed?.(a);
  }
  talk(a) {
    if (this.mission?.onTalk?.(a)) return;
    if (a.kind === 'civilian') {
      this.ui.push({ open: 'dialog', props: { id: 'local_talk' } });
      a.talk = false;
      return;
    }
    const id = npcDialog(this.save, a.npc);
    if (id) this.ui.push({ open: 'dialog', props: { id } });
  }

  // ---------- grenades, mines, blasts ----------
  throwGrenade(by, kind, tx, ty, tz, vel = null) {
    const fromPlayer = by === this.player;
    const sx = by.x + Math.sin(by.yaw) * 0.5;
    const sy = by.y + (fromPlayer ? by.eye : 1.5);
    const sz = by.z - Math.cos(by.yaw) * 0.5;
    let v = vel;
    if (!v) {
      const dx = tx - sx;
      const dz = tz - sz;
      const d = Math.hypot(dx, dz);
      const t = clamp(d / 13, 0.8, 2.3);
      v = { x: dx / t, z: dz / t, y: (ty + 0.3 - sy + 0.5 * 12 * t * t) / t };
    }
    this.projectiles.push({ kind, x: sx, y: sy, z: sz, vx: v.x, vy: v.y, vz: v.z, fuse: B.COMBAT.GRENADE[kind].fuse, by, spin: 0 });
    this.fx.push({ t: 'throw' });
  }

  placeMine(by) {
    const x = by.x + Math.sin(by.yaw) * 1.2;
    const z = by.z - Math.cos(by.yaw) * 1.2;
    this.mines.push({ x, z, y: this.world.terrain.heightAt(x, z), armed: this.time + 2, by });
    this.practice('engineering', 1.5);
    this.fx.push({ t: 'place' });
  }

  explode(kind, x, y, z, by, opts = {}) {
    const fromPlayer = by === this.player;
    const mul = fromPlayer ? this.derived.explosiveMul : 1;
    const G = B.COMBAT.GRENADE;
    const c = this.world.colliders;
    if (kind === 'smoke') {
      c.smokes.push({ x, y: y + 1.6, z, r: G.smoke.radius, until: this.time + G.smoke.seconds });
      this.fx.push({ t: 'smoke', x, y, z, r: G.smoke.radius, seconds: G.smoke.seconds });
      return;
    }
    if (kind === 'flash') {
      const r = G.flash.radius;
      this.fx.push({ t: 'flashbang', x, y, z });
      for (const a of this.actors) {
        if (!a.alive || a.kind !== 'enemy') continue;
        const d = Math.hypot(a.x - x, a.z - z);
        if (d < r && c.los(x, y + 0.5, z, a.x, a.y + 1.5, a.z)) a.ai.stunned = this.time + G.flash.seconds * (1 - (d / r) * 0.5);
      }
      const p = this.player;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < r && Math.abs(angleDiff(Math.atan2(x - p.x, -(z - p.z)), p.yaw)) < 1.7) p.flashed = 3 * (1 - d / r) + 0.5;
      this.noise(x, z, 90, 'explosion', by);
      return;
    }
    const spec = kind === 'frag' ? G.frag : kind === 'mine' ? B.COMBAT.MINE : (opts.spec ?? B.COMBAT.C4);
    const radius = spec.radius * mul;
    const base = spec.damage * mul;
    this.fx.push({ t: 'explosion', x, y, z, r: radius, big: radius > 9 });
    const byEnemy = by && by !== this.player && by.faction === 'enemy';
    for (const a of this.actors) {
      if (!a.alive || a.invulnerable) continue;
      if (!byEnemy && (a.kind === 'squad' || a.kind === 'ally' || a.kind === 'captive') && !opts.all) continue;
      if (byEnemy && a.faction === 'enemy') continue;
      const d = Math.hypot(a.x - x, a.y + 0.9 - y, a.z - z);
      if (d >= radius) continue;
      const open = c.los(x, y + 0.6, z, a.x, chestY(a), a.z);
      this.damageActor(a, blastDamage(base, radius, d) * (open ? 1 : 0.25), { from: by, player: fromPlayer, explosive: true, zone: 'torso', distance: Math.hypot(a.x - this.player.x, a.z - this.player.z), loudKill: true });
    }
    const p = this.player;
    const dp = Math.hypot(p.x - x, p.y + 0.9 - y, p.z - z);
    if (dp < radius && p.alive) {
      const open = c.los(x, y + 0.6, z, p.x, p.y + p.height * 0.6, p.z);
      p.hurt(blastDamage(base, radius, dp) * (open ? 1 : 0.25) * (fromPlayer ? 0.6 : 1) * (1 - this.derived.armor * 0.5), { from: by && by !== p ? by : null });
    }
    this.noise(x, z, 220, 'explosion', by === this.player || (by && by.faction !== 'enemy') ? this.player : by);
    this.mission?.onBlast?.(x, z, radius, by);
  }

  updateProjectiles(dt) {
    const c = this.world.colliders;
    const terrain = this.world.terrain;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const g = this.projectiles[i];
      g.fuse -= dt;
      g.spin += dt * 9;
      if (g.fuse <= 0) {
        this.projectiles.splice(i, 1);
        this.explode(g.kind, g.x, g.y, g.z, g.by);
        continue;
      }
      if (g.rest) continue;
      g.vy -= 12 * dt;
      const speed = Math.hypot(g.vx, g.vy, g.vz);
      const step = speed * dt;
      if (step > 1e-4) {
        const hit = c.raycast(g.x, g.y, g.z, g.vx / speed, g.vy / speed, g.vz / speed, step + 0.12);
        if (hit < step + 0.12) {
          const floor = Math.max(terrain.heightAt(g.x, g.z), c.floorAt(g.x, g.z, g.y + 0.3));
          if (g.y - floor < 0.25 && g.vy < 0) {
            // bounce off the ground
            g.y = floor + 0.08;
            g.vy = -g.vy * 0.3;
            g.vx *= 0.55;
            g.vz *= 0.55;
            if (Math.abs(g.vy) < 1 && Math.hypot(g.vx, g.vz) < 1) g.rest = true;
          } else {
            // off a wall: drop where it struck
            g.vx *= -0.25;
            g.vz *= -0.25;
          }
          continue;
        }
      }
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      g.z += g.vz * dt;
    }
    for (let i = this.mines.length - 1; i >= 0; i--) {
      const m = this.mines[i];
      if (this.time < m.armed) continue;
      const trip = B.COMBAT.MINE.trigger;
      for (const a of this.actors) {
        if (!a.alive || a.kind !== 'enemy' || a.captured) continue;
        if ((a.x - m.x) ** 2 + (a.z - m.z) ** 2 < trip * trip && Math.abs(a.y - m.y) < 2) {
          this.mines.splice(i, 1);
          this.explode('mine', m.x, m.y + 0.2, m.z, m.by);
          break;
        }
      }
    }
    for (let i = c.smokes.length - 1; i >= 0; i--) if (this.time > c.smokes[i].until) c.smokes.splice(i, 1);
    for (let i = this.pendingStrikes.length - 1; i >= 0; i--) {
      const s = this.pendingStrikes[i];
      if (this.time < s.at) continue;
      this.pendingStrikes.splice(i, 1);
      s.run();
    }
  }

  // ---------- orders ----------
  // What the crosshair rests on: a point on the ground and, if there is one, a soldier.
  aimPoint(reach = 200) {
    const p = this.player;
    const cam = p.cam;
    const dir = p.aimDir({ x: 0, y: 0, z: 0 });
    const skip = cam.mode === 'third' ? Math.hypot(cam.x - p.x, cam.z - p.z) + 0.25 : 0.2;
    const ox = cam.x + dir.x * skip;
    const oy = cam.y + dir.y * skip;
    const oz = cam.z + dir.z * skip;
    let t = this.world.colliders.raycast(ox, oy, oz, dir.x, dir.y, dir.z, reach);
    if (t === Infinity) t = reach;
    let actor = null;
    for (const a of this.actors) {
      if (!a.alive || a.kind !== 'enemy') continue;
      const h = rayActor(a, ox, oy, oz, dir.x, dir.y, dir.z, t);
      if (h) {
        t = h.t;
        actor = a;
      }
    }
    if (!actor) {
      // near enough to the line counts, for giving an order
      let bestAng = 0.05;
      for (const a of this.actors) {
        if (!a.alive || a.kind !== 'enemy') continue;
        const dx = a.x - ox;
        const dy = a.y + 1.1 - oy;
        const dz = a.z - oz;
        const d = Math.hypot(dx, dy, dz);
        if (d > reach) continue;
        const ang = Math.acos(clamp((dx * dir.x + dy * dir.y + dz * dir.z) / d, -1, 1));
        if (ang < bestAng) {
          bestAng = ang;
          actor = a;
        }
      }
    }
    return { x: ox + dir.x * t, y: oy + dir.y * t, z: oz + dir.z * t, dist: t, actor };
  }

  order(kind) {
    const squad = this.squad().filter((a) => a.alive && !a.downed);
    if (kind === 'fire') {
      this.holdFire = !this.holdFire;
      this.feedMsg(this.holdFire ? 'Squad: hold fire' : 'Squad: weapons free', 'order');
      this.fx.push({ t: 'order' });
      return;
    }
    if (!squad.length) {
      this.feedMsg('You have nobody to give orders to.', 'warn');
      return;
    }
    const p = this.player;
    const d = this.derived;
    let point = null;
    let target = null;
    if (kind === 'move' || kind === 'attack') {
      const aim = this.aimPoint(220);
      if (kind === 'attack') {
        target = aim.actor;
        if (!target) {
          this.feedMsg('No target under your sights.', 'warn');
          return;
        }
        this.tag(target, 30);
      } else point = this.world.walkableNear(aim.x, aim.z, 8) ?? { x: aim.x, z: aim.z };
    }
    let heard = 0;
    squad.forEach((a, i) => {
      if (Math.hypot(a.x - p.x, a.z - p.z) > d.commandRange) return;
      heard++;
      const pt = kind === 'hold' ? { x: a.x, z: a.z } : kind === 'move' ? { x: point.x + Math.cos(i * 2.4) * (1.5 + i * 0.5), z: point.z + Math.sin(i * 2.4) * (1.5 + i * 0.5) } : null;
      a.ai.pending = { order: kind === 'attack' ? a.ai.order : kind, point: pt ?? a.ai.orderPoint, target: kind === 'attack' ? target : null, at: this.time + d.orderDelay * (0.8 + i * 0.15) };
    });
    const names = { follow: 'On me', hold: 'Hold here', move: 'Move up', attack: 'Take him' };
    const missed = squad.length - heard;
    this.feedMsg(`Squad: ${names[kind]}${missed ? ` (${missed} out of command range)` : ''}`, 'order');
    this.fx.push({ t: 'order' });
    if (heard && this.time - (this.lastOrder ?? -9) > 4) {
      this.practice('communication', 1.2);
      this.practice('leadership', 0.3);
      this.lastOrder = this.time;
    }
  }

  // ---------- support ----------
  supports() {
    return (RANKS[this.save.rank].supports ?? []).map((id) => ({ ...SUPPORTS[id], ready: Math.max(0, (this.supportReady[id] ?? 0) - this.time) }));
  }
  cycleSupport() {
    const list = this.supports();
    if (!list.length) return;
    this.supportIndex = (this.supportIndex + 1) % list.length;
    this.feedMsg(`Support: ${list[this.supportIndex].name}`, 'order');
  }
  callSupport() {
    const list = this.supports();
    if (!list.length) {
      this.feedMsg('No support at your rank yet.', 'warn');
      return;
    }
    if (this.mode !== 'mission') {
      this.feedMsg('Support is only on call during an operation.', 'warn');
      return;
    }
    const s = list[this.supportIndex % list.length];
    if (s.ready > 0) {
      this.feedMsg(`${s.name}: ${Math.ceil(s.ready)} s`, 'warn');
      return;
    }
    const p = this.player;
    const d = this.derived;
    const aim = this.aimPoint(320);
    const after = (seconds, run) => this.pendingStrikes.push({ at: this.time + seconds, run });
    this.supportReady[s.id] = this.time + s.cooldown * d.supportCooldownMul;
    this.practice('communication', 4);
    this.fx.push({ t: 'radio' });
    if (s.id === 'mortar') {
      const scatter = 11 * (1.25 - d.attrs.communication * 0.006);
      this.say('Fire Direction', 'Shot, over. Six rounds, your mark.');
      this.fx.push({ t: 'marker', x: aim.x, y: aim.y, z: aim.z, r: scatter, seconds: 5 });
      for (let i = 0; i < 6; i++) {
        after(4 + i * 0.55, () => {
          const a = this.rng() * Math.PI * 2;
          const r = Math.sqrt(this.rng()) * scatter;
          const x = aim.x + Math.cos(a) * r;
          const z = aim.z + Math.sin(a) * r;
          this.explode('mortar', x, this.world.terrain.heightAt(x, z) + 0.3, z, p, { spec: { damage: 170, radius: 9 } });
        });
      }
    } else if (s.id === 'airstrike') {
      this.say('Hammer Flight', 'Tally target. In hot, thirty seconds.');
      const fx = Math.sin(p.yaw);
      const fz = -Math.cos(p.yaw);
      this.fx.push({ t: 'marker', x: aim.x, y: aim.y, z: aim.z, r: 16, seconds: 7 });
      after(5.2, () => this.fx.push({ t: 'jet' }));
      for (let i = -2; i <= 2; i++) {
        after(6.5 + (i + 2) * 0.28, () => {
          const x = aim.x + fx * i * 13;
          const z = aim.z + fz * i * 13;
          this.explode('bomb', x, this.world.terrain.heightAt(x, z) + 0.3, z, p, { spec: { damage: 340, radius: 14 } });
        });
      }
    } else if (s.id === 'uav') {
      this.say('Overhead', 'Drone on station. Marking what I see.');
      for (let k = 0; k < 4; k++) {
        after(1 + k * 10, () => {
          for (const a of this.actors) if (a.alive && a.kind === 'enemy' && Math.hypot(a.x - p.x, a.z - p.z) < 150) this.tag(a, 14);
          this.fx.push({ t: 'ping' });
        });
      }
    } else if (s.id === 'resupply') {
      this.say('Supply', 'Crate inbound to your position.');
      const x = p.x + Math.sin(p.yaw) * 5;
      const z = p.z - Math.cos(p.yaw) * 5;
      after(5, () => {
        const near = this.world.walkableNear(x, z, 6) ?? { x, z };
        this.fx.push({ t: 'crate', x: near.x, y: this.world.terrain.heightAt(near.x, near.z), z: near.z });
        this.interactables.push({
          kind: 'supply', x: near.x, z: near.z, y: this.world.terrain.heightAt(near.x, near.z), r: 2.4, hold: 1, text: 'Resupply from the crate', uses: 2,
          use: (it) => {
            if (--it.uses <= 0) it.gone = true;
            p.refill(1);
            const limits = d.carryLimits;
            for (const id of ['medkit', 'bandage', 'frag', 'smoke']) p.items[id] = Math.min(limits[id], (p.items[id] ?? 0) + 2);
            this.fx.push({ t: 'pickup' });
            this.feedMsg('Ammunition and supplies replenished.', 'good');
          },
        });
      });
    } else if (s.id === 'overwatch') {
      this.say('Overwatch', 'In position. Tag them and I will drop them.');
      for (let k = 0; k < 8; k++) {
        after(4 + k * 6, () => {
          const marked = this.actors.filter((a) => a.alive && a.kind === 'enemy' && a.tagged > this.time && !a.capture && Math.hypot(a.x - p.x, a.z - p.z) < 260);
          if (!marked.length) return;
          const a = marked[Math.floor(this.rng() * marked.length)];
          this.fx.push({ t: 'shot', x: a.x + 40, y: a.y + 60, z: a.z + 40, tx: a.x, ty: a.y + 1.3, tz: a.z, weapon: 'sniper', loud: true, own: false });
          this.damageActor(a, 190, { from: p, zone: 'torso', distance: 300 });
        });
      }
    } else if (s.id === 'bravo') {
      this.say('Bravo', 'Bravo team inserting on your position.');
      after(6, () => {
        for (let i = 0; i < 4; i++) {
          const near = this.world.walkableNear(p.x - Math.sin(p.yaw) * (6 + i * 1.5), p.z + Math.cos(p.yaw) * (6 + i * 1.5), 10);
          if (!near) continue;
          const a = makeAlly(i === 3 ? 'gunner' : 'rifleman', Math.max(4, Math.round(this.save.level * 0.7)), { x: near.x, z: near.z, y: this.world.terrain.heightAt(near.x, near.z), yaw: p.yaw }, { state: 'assault', name: `Bravo ${i + 1}` });
          a.missionActor = true;
          this.actors.push(a);
        }
      });
    }
  }

  assaultGoal(a) {
    let best = null;
    let bestD = Infinity;
    for (const o of this.actors) {
      if (!o.alive || o.kind !== 'enemy' || o.captured || o.surrendered) continue;
      const d = (o.x - a.x) ** 2 + (o.z - a.z) ** 2;
      if (d < bestD) {
        best = o;
        bestD = d;
      }
    }
    return best ?? this.mission?.site ?? null;
  }

  // ---------- squad on the ground ----------
  spawnSquad(at, yaw) {
    const members = activeSquad(this.save);
    members.forEach((member, i) => {
      const slot = this.world.walkableNear(at.x - Math.sin(yaw) * (2.5 + Math.floor(i / 2) * 2.2) + Math.cos(yaw) * (i % 2 ? 1.8 : -1.8), at.z + Math.cos(yaw) * (2.5 + Math.floor(i / 2) * 2.2) + Math.sin(yaw) * (i % 2 ? 1.8 : -1.8), 8) ?? at;
      const a = makeSquadMember(member, this.derived, { x: slot.x, z: slot.z, y: this.world.terrain.heightAt(slot.x, slot.z), yaw }, i);
      a.missionActor = true;
      this.actors.push(a);
    });
    return members.length;
  }

  // ---------- free roam ----------
  // A Legion garrison appears when you come near one of their sites and goes when you leave.
  updateAmbient() {
    const p = this.player;
    for (const loc of LOCATIONS) {
      const site = this.world.sites[loc.id];
      const d = Math.hypot(p.x - site.x, p.z - site.z);
      const state = this.ambient[loc.id];
      if (!this.save.world.discovered[loc.id] && d < site.r + 40 && this.mode === 'roam') {
        const report = this.api.act('discover', { id: loc.id }, { quiet: true });
        if (report?.fresh) this.feedMsg(`Discovered ${report.name}  +${report.xp} XP`, 'gold');
      }
      if (loc.id === 'hawthorne') continue;
      const hostile = sideOf(this.save, loc.id) === 'enemy';
      if (!state && d < site.r + 250) {
        const cleared = this.save.world.cleared?.[loc.id] !== undefined && this.save.world.day * 24 + this.save.world.hour - this.save.world.cleared[loc.id] < B.WORLD.GARRISON_RESPAWN_HOURS;
        const actors = hostile ? (cleared ? [] : this.spawnGarrison(site, composeForce(Math.round(7 + site.tier * 1.2), site.tier, this.rng), site.tier, 2)) : this.spawnFriendly(site, loc);
        actors.forEach((a) => (a.ambient = loc.id));
        this.ambient[loc.id] = { actors, total: hostile ? actors.length : 0, dead: 0, hostile };
      } else if (state && d > site.r + 420) {
        this.actors = this.actors.filter((a) => a.ambient !== loc.id);
        delete this.ambient[loc.id];
      }
    }
  }

  ambientKill(a) {
    const state = a.ambient && this.ambient[a.ambient];
    if (!state || !state.hostile || this.mission) return;
    state.dead++;
    if (state.dead >= Math.ceil(state.total * 0.9) && !state.done) {
      state.done = true;
      const report = this.api.act('clearSite', { id: a.ambient }, { quiet: true });
      if (report) {
        this.feedMsg(`${report.name} cleared  +${report.xp} XP  +${report.rp} RP`, 'gold');
        this.fx.push({ t: 'levelup' });
      }
    }
  }

  spawnFriendly(site, loc) {
    const out = [];
    const A = site.anchors;
    const posts = (A.defend.length ? A.defend : A.guards).slice(0, loc.kind === 'village' || loc.kind === 'town' ? 2 : 5);
    for (const post of posts) {
      const a = makeAlly('rifleman', 5, post, { state: 'defend' });
      a.name = 'Sentry';
      this.actors.push(a);
      out.push(a);
    }
    if (loc.kind === 'village' || loc.kind === 'town') {
      const pts = [A.asset, ...A.interior.slice(0, 5), ...A.guards].filter(Boolean).map((q) => ({ x: q.x + 2, z: q.z + 2 }));
      for (let i = 0; i < 5; i++) {
        const q = pts[i % pts.length];
        const near = this.world.walkableNear(q.x, q.z, 6);
        if (!near) continue;
        const c = makeCivilian({ x: near.x, z: near.z, y: this.world.terrain.heightAt(near.x, near.z), yaw: this.rng() * 6 }, pts);
        c.talk = i < 2;
        this.actors.push(c);
        out.push(c);
      }
    }
    return out;
  }

  // Puts a force on a site's posts: marksmen in the towers, some walking the patrol loops, the
  // rest on guard. Returns the actors.
  spawnGarrison(site, counts, tier, patrols = 1, share = 1) {
    const A = site.anchors;
    const list = [];
    for (const [type, n] of Object.entries(counts)) for (let i = 0; i < Math.max(0, Math.round(n * share)); i++) list.push(type);
    // deterministic shuffle
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    const out = [];
    const towers = [...A.towers];
    const posts = [...A.guards];
    const add = (type, p) => {
      const a = makeEnemy(type, tier, p, this.rng);
      a.site = site.id;
      this.actors.push(a);
      out.push(a);
      return a;
    };
    const rest = [];
    for (const type of list) {
      if ((type === 'marksman' || type === 'gunner') && towers.length) add(type, towers.shift());
      else rest.push(type);
    }
    let walking = 0;
    const loops = A.patrols;
    for (let g = 0; g < patrols && rest.length > 1 && loops.length; g++) {
      const route = loops[g % loops.length];
      for (let k = 0; k < 2 && rest.length; k++) {
        const start = route[(g * 2 + k) % route.length];
        const near = this.world.walkableNear(start.x + k * 1.4, start.z + k, 6) ?? start;
        const a = add(rest.shift(), { x: near.x, z: near.z, y: this.world.terrain.heightAt(near.x, near.z), yaw: 0 });
        a.ai.state = 'patrol';
        a.ai.patrol = { points: route, index: (g * 2 + 1) % route.length, until: 0 };
        walking++;
      }
    }
    for (const type of rest) {
      let p;
      if (posts.length) p = posts.splice(Math.floor(this.rng() * posts.length), 1)[0];
      else {
        const base = A.guards[Math.floor(this.rng() * A.guards.length)] ?? A.center;
        const near = this.world.walkableNear(base.x + (this.rng() - 0.5) * 8, base.z + (this.rng() - 0.5) * 8, 6) ?? base;
        p = { x: near.x, z: near.z, y: this.world.terrain.heightAt(near.x, near.z), yaw: this.rng() * 6.28 };
      }
      add(type, p);
    }
    void walking;
    return out;
  }

  // What the compass points you at when no mission is running.
  refreshObjective() {
    if (this.mode !== 'roam') return;
    const save = this.save;
    const npcs = this.world.sites.hawthorne.anchors.npcs;
    const at = (id, label) => ({ x: npcs[id].x, y: npcs[id].y + 2.4, z: npcs[id].z, label, kind: 'npc' });
    const lines = [];
    const markers = [];
    let title = 'Camp Hawthorne';
    if (save.phase === 'intake') {
      if (!save.story.seen?.arrival) {
        lines.push({ text: 'Report to Drill Sergeant Briggs', state: 'active' });
        markers.push({ x: BASE.arrival.x, y: this.world.terrain.heightAt(BASE.arrival.x, BASE.arrival.z) + 2.4, z: BASE.arrival.z, label: 'Drill Sergeant', kind: 'npc' });
      } else {
        lines.push({ text: 'Choose your specialization at the intake tent', state: 'active' });
        markers.push(at('finch', 'Intake'));
      }
      title = 'Basic Training';
    } else if (save.phase === 'training') {
      title = 'Basic Training';
      const summary = trainingSummary(save);
      if (!save.story.seen?.briggs_training_start) {
        lines.push({ text: 'Report to Drill Sergeant Briggs on the parade ground', state: 'active' });
        markers.push(at('briggs', 'Drill Sergeant'));
      } else if (summary.complete) {
        lines.push({ text: 'Report to Drill Sergeant Briggs to graduate', state: 'active' });
        markers.push(at('briggs', 'Graduate'));
      } else {
        const who = { range: 'okoro', obstacle: 'vasquez', stealth: 'ilves', observation: 'dane', exam: 'sato' };
        for (const event of EVENTS) {
          const done = !!save.training.results[event.id];
          lines.push({ text: `${event.name}${done ? `: ${save.training.results[event.id].score}` : ''}`, state: done ? 'done' : 'active' });
          if (!done) markers.push(at(who[event.id], event.place));
        }
      }
    } else {
      const due = promotionDue(save);
      const next = nextStory(save);
      if (due !== null) {
        lines.push({ text: `Promotion to ${RANKS[due].name}: report to Colonel Adeyemi`, state: 'active' });
        markers.push(at('adeyemi', 'Promotion'));
      }
      if (!save.story.seen?.marsh_first) lines.push({ text: 'Report to Captain Marsh at the command tent', state: 'active' });
      else if (next) lines.push({ text: `Next operation: ${next.name}`, state: save.rank >= next.rank ? 'active' : 'todo' });
      else lines.push({ text: 'Take contracts from the operations board', state: 'active' });
      markers.push(at('marsh', 'Operations'));
    }
    this.objective = { title, lines, markers, bonus: [] };
  }

  // ---------- training and missions ----------
  startTraining(id) {
    if (this.mode !== 'roam') return false;
    this.training = new TrainingRun(this, id);
    this.mode = 'training';
    return true;
  }
  endTraining(result) {
    const run = this.training;
    if (!run) return;
    run.cleanup();
    this.training = null;
    this.mode = 'roam';
    this.refreshObjective();
    if (result) this.ui.push({ trainingEnd: run.id, result });
  }

  abortTraining() {
    this.endTraining(null);
  }
  abortMission() {
    this.mission?.fail('Mission aborted.');
  }

  startMission(mission, plan) {
    this.clearField();
    this.mission = new MissionRun(this, mission, plan);
    this.mode = 'mission';
    this.mission.start();
  }
  // Removes everyone and everything a mission or a roam left on the field (the camp stays).
  clearField() {
    this.actors = this.actors.filter((a) => a.home === 'hawthorne');
    this.ambient = {};
    this.bodies = [];
    this.projectiles = [];
    this.mines = [];
    this.pendingStrikes = [];
    this.shootables = [];
    this.dummies = [];
    this.world.colliders.smokes.length = 0;
    this.world.powerOff = {};
    this.interactables = this.interactables.filter((it) => it.kind === 'bunk' || it.kind === 'cache');
    this.roamAlarm = 0;
    this.rescuer = null;
  }
  // Back to camp after a mission (or after dying in the field).
  returnToBase() {
    const p = this.player;
    this.mission = null;
    this.training = null;
    this.mode = 'roam';
    this.clearField();
    this.save = this.api.getSave();
    this.derived = deriveStats(this.save);
    this.hour = this.save.world.hour;
    this.day = this.save.world.day;
    p.alive = true;
    p.downed = false;
    p.locked = false;
    p.bounds = null;
    p.binoc = false;
    p.aimT = 0;
    p.health = this.derived.maxHealth;
    p.stamina = this.derived.maxStamina;
    p.items = { ...this.save.items };
    p.weapons = [null, null];
    p.loadWeapons(this.save, this.derived);
    p.place(BASE.helipad.x - 12, BASE.helipad.z + 8, Math.PI * 0.75);
    this.holdFire = false;
    this.itemsDirty = false;
    this.buildCaches();
    this.refreshObjective();
    this.fx.push({ t: 'arrive' });
  }
  travel(locId) {
    const site = this.world.sites[locId];
    if (!site || this.mode !== 'roam') return false;
    const A = site.anchors;
    const at = locId === 'hawthorne' ? { x: BASE.helipad.x - 12, z: BASE.helipad.z + 8 } : (this.world.walkableNear(A.gate.x, A.gate.z, 10) ?? A.insert);
    this.clearField();
    this.player.place(at.x, at.z, Math.atan2(site.x - at.x, -(site.z - at.z)));
    this.hour = (this.hour + 0.75) % 24;
    this.api.act('setClock', { hour: this.hour, day: this.day }, { quiet: true });
    this.fx.push({ t: 'arrive' });
    return true;
  }

  // ---------- the step ----------
  step(dt, input) {
    this.time += dt;
    this.pathBudget = 2;
    if (this.mode !== 'training') {
      this.hour += (dt * 24) / (B.WORLD.DAY_MINUTES * 60);
      if (this.hour >= 24) {
        this.hour -= 24;
        this.day += 1;
      }
    }
    const p = this.player;
    p.update(dt, input);
    if (input.order) this.order(input.order);
    if (input.supportNext) this.cycleSupport();
    if (input.support) this.callSupport();

    let combat = 0;
    const actors = this.actors;
    for (let i = 0; i < actors.length; i++) {
      const a = actors[i];
      updateActor(this, a, dt);
      if (a.alive && a.kind === 'enemy' && a.ai.state === 'combat') combat++;
    }
    this.combatCount = combat;
    this.updateProjectiles(dt);

    if (this.mission) this.mission.update(dt);
    else if (this.training) this.training.update(dt, input);

    this.slowTimer -= dt;
    if (this.slowTimer <= 0) {
      this.slowTimer = 1;
      this.everySecond();
    }
    this.flushTimer -= dt;
    if (this.flushTimer <= 0) {
      this.flushTimer = 5;
      this.flush();
    }
    if (this.arrivalAt && this.time > this.arrivalAt) {
      this.arrivalAt = 0;
      this.ui.push({ open: 'dialog', props: { id: 'arrival' } });
    }
    if (this.respawnAt && this.time > this.respawnAt) {
      this.respawnAt = 0;
      this.api.act('addStats', { stats: { downs: 1 } }, { quiet: true });
      this.returnToBase();
      this.feedMsg('You were carried back to the aid station.', 'warn');
    }
  }

  everySecond() {
    if (this.mode === 'roam') this.updateAmbient();
    // tidy: the long dead, used pickups
    if (this.actors.length > 70) this.actors = this.actors.filter((a) => a.alive || this.time - (a.diedAt ?? 0) < 90 || a.capture);
    this.actors = this.actors.filter((a) => !a.gone);
    this.interactables = this.interactables.filter((it) => !it.gone && !(it.until && this.time > it.until));
    if (this.roamAlarm && this.time > this.roamAlarm) this.roamAlarm = 0;
    if (this.mode === 'roam') {
      this.clockTimer -= 1;
      if (this.clockTimer <= 0) {
        this.clockTimer = 40;
        this.api.act('setClock', { hour: this.hour, day: this.day }, { quiet: true });
      }
    }
  }

  // Sends what has built up (practice, tallies, items used) to the save.
  flush() {
    const gains = this.pendingPractice;
    if (Object.keys(gains).length) {
      this.pendingPractice = {};
      const report = this.api.act('practice', { gains }, { quiet: true });
      for (const up of report?.ups ?? []) {
        this.feedMsg(`${up.attr[0].toUpperCase()}${up.attr.slice(1)} ${up.from} → ${up.to}`, 'skill');
        this.fx.push({ t: 'skillup' });
      }
    }
    if (!this.mission) {
      if (Object.keys(this.pendingStats).length) {
        const stats = this.pendingStats;
        this.pendingStats = {};
        this.api.act('addStats', { stats }, { quiet: true });
      }
      if (this.itemsDirty) {
        this.itemsDirty = false;
        this.api.act('syncItems', { items: this.player.items }, { quiet: true });
      }
    }
  }
}
