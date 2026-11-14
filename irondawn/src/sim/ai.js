// What every soldier other than the player does. Enemies stand watch, notice, investigate, raise
// the alarm, take cover and fight; your squad follows, holds, moves and fires on your orders;
// captives and prisoners trail you; villagers run for cover. Shots fired by AI are rolled with
// combat.hitChance rather than traced, so skill, cover, stance and evade all count.

import { B, clamp } from '../game/balance.js';
import { detectionRate, hitChance, incomingDamage, rollZone, sightInLight } from '../game/combat.js';
import { chestY, eyeY } from './actors.js';

const WALK = 1.5;
const RUN = 3.7;
const SPRINT = 5.3;
const TAU = Math.PI * 2;

export const angleDiff = (a, b) => {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
};
const bearing = (fx, fz, tx, tz) => Math.atan2(tx - fx, -(tz - fz));
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
const turnToward = (a, yaw, rate, dt) => {
  const d = angleDiff(yaw, a.yaw);
  const step = rate * dt;
  a.yaw += Math.abs(d) < step ? d : Math.sign(d) * step;
};

// ---------- every step ----------
export function updateActor(sim, a, dt) {
  const ai = a.ai;
  const an = a.anim;
  an.fire = Math.max(0, an.fire - dt * 9);
  an.hit = Math.max(0, an.hit - dt * 4);
  if (!a.alive) {
    an.death = Math.min(1, an.death + dt * 2.2);
    return;
  }
  if (a.downed) {
    an.death = Math.min(1, an.death + dt * 2.2);
    a.moveState = 'still';
    return;
  }
  an.death = Math.max(0, an.death - dt * 3);

  ai.think -= dt;
  if (ai.think <= 0) {
    const elapsed = 0.16 - ai.think;
    ai.think = 0.14 + Math.random() * 0.05;
    if (a.kind === 'enemy') thinkEnemy(sim, a, elapsed);
    else if (a.kind === 'squad' || a.kind === 'ally') thinkFriendly(sim, a, elapsed);
    else if (a.kind === 'captive' || a.kind === 'prisoner') thinkFollower(sim, a);
    else if (a.kind === 'civilian') thinkCivilian(sim, a, elapsed);
    else if (a.kind === 'npc') thinkNpc(sim, a);
  }

  move(sim, a, dt);
  if (ai.fireOk && ai.target) {
    const t = ai.target;
    turnToward(a, bearing(a.x, a.z, t.x, t.z), 7, dt);
    fire(sim, a, dt);
    an.aim = Math.min(1, an.aim + dt * 5);
  } else {
    an.aim = Math.max(0, an.aim - dt * 3);
    if (ai.face !== null && ai.face !== undefined && a.moveState === 'still') turnToward(a, ai.face, 2.6, dt);
  }
  an.hands = a.surrendered ? 1 : a.kind === 'prisoner' ? 2 : a.ai.state === 'held' ? 2 : 0;
}

// ---------- movement ----------
function setGoal(a, x, z, mode = 'run') {
  const ai = a.ai;
  ai.goal = ai.goal ?? { x: 0, z: 0 };
  ai.goal.x = x;
  ai.goal.z = z;
  ai.mode = mode;
}
const clearGoal = (a) => {
  a.ai.goal = null;
};

function move(sim, a, dt) {
  const ai = a.ai;
  if (ai.fixed || !ai.goal || ai.stunned > sim.time) {
    a.moveState = 'still';
    a.vx = a.vz = 0;
    return;
  }
  const gx = ai.goal.x;
  const gz = ai.goal.z;
  const toGoal = Math.hypot(gx - a.x, gz - a.z);
  if (toGoal < (ai.arrive ?? 0.7)) {
    a.moveState = 'still';
    a.vx = a.vz = 0;
    ai.path = null;
    return;
  }
  // (re)plan when the goal has moved, the plan is stale, or we have none
  ai.pathTimer -= dt;
  const moved = !ai.pathGoal || (ai.pathGoal.x - gx) ** 2 + (ai.pathGoal.z - gz) ** 2 > 6.25;
  if (!ai.path || moved || ai.pathTimer <= 0) {
    if (sim.world.nav.walkable(a.x, a.z, gx, gz)) {
      ai.path = [{ x: gx, z: gz }];
      ai.pathIndex = 0;
      ai.pathGoal = { x: gx, z: gz };
      ai.pathTimer = 1 + Math.random() * 0.5;
    } else if (sim.pathBudget > 0) {
      sim.pathBudget--;
      // far goals are walked in legs the search window can hold
      let tx = gx;
      let tz = gz;
      if (toGoal > 110) {
        tx = a.x + ((gx - a.x) / toGoal) * 100;
        tz = a.z + ((gz - a.z) / toGoal) * 100;
      }
      ai.path = sim.world.nav.findPath(a.x, a.z, tx, tz);
      if (!sim.world.nav.lastFound) {
        // no way straight in: a walled site is entered by its gate
        const site = sim.world.siteNear(gx, gz, 10);
        if (site && Math.hypot(a.x - site.x, a.z - site.z) > site.r * 0.7) {
          const gate = site.anchors.gate;
          const via = sim.world.nav.findPath(a.x, a.z, gate.x, gate.z);
          if (via && sim.world.nav.lastFound) ai.path = via;
          sim.world.nav.lastFound = !!via;
        }
      }
      ai.pathIndex = 0;
      ai.pathGoal = { x: gx, z: gz };
      // no way through: do not keep asking every second
      ai.pathTimer = sim.world.nav.lastFound ? 1.6 + Math.random() : 5 + Math.random() * 3;
    }
  }
  let tx = gx;
  let tz = gz;
  if (ai.path && ai.path.length) {
    let wp = ai.path[Math.min(ai.pathIndex, ai.path.length - 1)];
    while (ai.pathIndex < ai.path.length - 1 && (wp.x - a.x) ** 2 + (wp.z - a.z) ** 2 < 0.5) wp = ai.path[++ai.pathIndex];
    tx = wp.x;
    tz = wp.z;
  }
  const dx = tx - a.x;
  const dz = tz - a.z;
  const d = Math.hypot(dx, dz) || 1;
  let speed = ai.mode === 'walk' ? WALK : ai.mode === 'sprint' ? SPRINT * a.speed : RUN * a.speed;
  if (a.stance === 'crouch') speed = Math.min(speed, 2.1);
  else if (a.stance === 'prone') speed = Math.min(speed, 0.8);
  // slow on steep ground
  const slope = sim.world.terrain.slopeAt(a.x, a.z);
  if (slope > 22) speed *= clamp(1 - (slope - 22) / 30, 0.3, 1);
  const step = Math.min(speed * dt, d);
  a.vx = (dx / d) * speed;
  a.vz = (dz / d) * speed;
  a.x += (dx / d) * step;
  a.z += (dz / d) * step;
  // keep apart from others
  for (const o of sim.actors) {
    if (o === a || !o.alive) continue;
    const ox = a.x - o.x;
    const oz = a.z - o.z;
    const od2 = ox * ox + oz * oz;
    if (od2 < 0.42 && od2 > 1e-6 && Math.abs(o.y - a.y) < 1.5) {
      const od = Math.sqrt(od2);
      a.x += (ox / od) * (0.65 - od) * 0.5;
      a.z += (oz / od) * (0.65 - od) * 0.5;
    }
  }
  const pl = sim.player;
  const pdx = a.x - pl.x;
  const pdz = a.z - pl.z;
  const pd2 = pdx * pdx + pdz * pdz;
  if (pd2 < 0.5 && pd2 > 1e-6 && Math.abs(pl.y - a.y) < 1.5) {
    const pd = Math.sqrt(pd2);
    a.x += (pdx / pd) * (0.7 - pd) * 0.6;
    a.z += (pdz / pd) * (0.7 - pd) * 0.6;
  }
  sim.world.colliders.resolve(a, a.radius, a.y, a.y + 1.7);
  a.y = sim.world.colliders.floorAt(a.x, a.z, a.y);
  a.moveState = ai.mode === 'walk' ? 'walk' : ai.mode === 'sprint' ? 'sprint' : 'run';
  a.anim.walk += step * 2.4;
  if (!(ai.fireOk && ai.target)) turnToward(a, Math.atan2(dx, -dz), 9, dt);
  // stuck? give the plan a kick
  ai.stuck += dt;
  if (ai.stuck > 0.7) {
    if ((a.x - ai.lastX) ** 2 + (a.z - ai.lastZ) ** 2 < 0.04) {
      ai.path = null;
      ai.pathTimer = 0;
      a.x += (Math.random() - 0.5) * 0.5;
      a.z += (Math.random() - 0.5) * 0.5;
    }
    ai.stuck = 0;
    ai.lastX = a.x;
    ai.lastZ = a.z;
  }
}

// ---------- shooting (rolled) ----------
function sees(sim, a, t) {
  const c = sim.world.colliders;
  const ey = eyeY(a);
  const chest = c.los(a.x, ey, a.z, t.x, t === sim.player ? t.y + t.height * 0.62 : chestY(t), t.z);
  if (chest) return 2;
  const head = c.los(a.x, ey, a.z, t.x, t === sim.player ? t.y + t.height * 0.95 : eyeY(t), t.z);
  return head ? 1 : 0;
}

function fire(sim, a, dt) {
  const ai = a.ai;
  const now = sim.time;
  if (now < ai.react || ai.stunned > now) return;
  ai.fireTimer -= dt;
  if (ai.fireTimer > 0) return;
  const w = a.stats.weapon;
  if (ai.burst <= 0) ai.burst = Math.max(1, Math.round(w.burst * (0.7 + Math.random() * 0.6)));
  const t = ai.target;
  const tIsPlayer = t === sim.player;
  const dist = Math.hypot(t.x - a.x, t.z - a.z);
  const light = sim.lightAt(t.x, t.z);
  const visible = ai.seeing ?? 2;
  const p = hitChance({
    accuracy: a.stats.accuracy,
    range: w.range,
    distance: dist,
    stance: t.downed ? 'prone' : t.stance,
    moving: t.moveState,
    cover: visible === 1,
    night: light < 0.4,
    suppressed: ai.suppressed > now,
    evade: tIsPlayer ? sim.derived.evade : (t.evade ?? 0),
    flash: tIsPlayer ? now - sim.player.lastShot < 1.5 : false,
  });
  const hit = sim.rng() < p;
  const fromY = a.y + (a.stance === 'crouch' ? 0.95 : 1.4);
  const fx = Math.sin(a.yaw);
  const fz = -Math.cos(a.yaw);
  const mx = a.x + fx * 0.6;
  const mz = a.z + fz * 0.6;
  let tx = t.x;
  let ty = tIsPlayer ? t.y + t.height * 0.6 : chestY(t);
  let tz = t.z;
  if (!hit) {
    const off = 0.5 + Math.random() * 1.6;
    const ang = Math.random() * TAU;
    tx += Math.cos(ang) * off;
    tz += Math.sin(ang) * off;
    ty += (Math.random() - 0.4) * 1.2;
    // carry on past the target
    const k = 1 + 25 / Math.max(5, dist);
    tx = mx + (tx - mx) * k;
    ty = fromY + (ty - fromY) * k;
    tz = mz + (tz - mz) * k;
  }
  sim.fx.push({ t: 'shot', x: mx, y: fromY, z: mz, tx, ty, tz, weapon: a.stats.weaponId, loud: w.noise > 40, by: a.id, own: false });
  a.anim.fire = 1;
  if (w.noise > 40) sim.noise(a.x, a.z, w.noise, a.faction === 'enemy' ? 'enemyfire' : 'friendlyfire', a);
  if (hit) {
    const zone = rollZone(sim.rng());
    const dmg = incomingDamage({ damage: w.damage * (0.85 + Math.random() * 0.3), zone, armor: tIsPlayer ? sim.derived.armor : t.armor, armorHead: tIsPlayer ? sim.derived.armorHead : t.armorHead });
    if (tIsPlayer) sim.player.hurt(dmg, { from: a, zone });
    else sim.damageActor(t, dmg, { from: a, zone, weapon: w });
  } else if (tIsPlayer) {
    sim.player.nearMiss(a);
  } else if (t.kind === 'enemy') {
    t.ai.suppressed = Math.max(t.ai.suppressed, now + 1.2);
  }
  ai.burst--;
  ai.fireTimer = ai.burst > 0 ? w.rate : w.pause * (0.8 + Math.random() * 0.5);
}

// ---------- enemies ----------
function enterCombat(sim, a, target, quiet = false) {
  const ai = a.ai;
  if (a.surrendered || a.captured || a.drill) return;
  if (ai.state !== 'combat') {
    ai.react = sim.time + a.stats.reaction * (0.8 + Math.random() * 0.4);
    if (!quiet) {
      ai.shout = sim.time + 1.1;
      if (!sim.alarmOn()) ai.alarm = sim.time + B.STEALTH.ALARM_SECONDS;
      sim.fx.push({ t: 'alert', x: a.x, y: a.y + 2, z: a.z });
    }
    ai.returnTo = ai.returnTo ?? (ai.patrol ? 'patrol' : 'idle');
    ai.cover = null;
    ai.lost = 0;
  }
  ai.state = 'combat';
  ai.aware = 1;
  if (target) {
    ai.target = target;
    ai.seen = { x: target.x, z: target.z, t: sim.time };
  }
  sim.onDetected(a);
}

// Tell an enemy where trouble is. loud = they heard shooting and come ready to fight.
export function alertEnemy(sim, a, x, z, loud) {
  const ai = a.ai;
  if (!a.alive || a.kind !== 'enemy' || a.surrendered || a.captured || a.drill) return;
  ai.seen = { x, z, t: sim.time };
  if (ai.state === 'combat') return;
  ai.aware = Math.max(ai.aware, loud ? 0.95 : 0.75);
  ai.returnTo = ai.returnTo ?? (ai.patrol ? 'patrol' : 'idle');
  if (loud) {
    ai.state = 'search';
    ai.timer = sim.time + 22 + Math.random() * 10;
    ai.searchAt = 0;
  } else if (ai.state !== 'search') {
    ai.state = 'investigate';
    ai.timer = 0;
  }
}

function pickTarget(sim, a) {
  const ai = a.ai;
  const light = sim.lightAt(a.x, a.z);
  const p = sim.player;
  let best = null;
  let bestScore = Infinity;
  let bestSee = 0;
  const range = Math.max(a.stats.view * 1.6, 60);
  const consider = (t) => {
    const d = Math.hypot(t.x - a.x, t.z - a.z);
    if (d > range) return;
    let score = d;
    if (t === ai.target) score *= 0.7;
    if (t.kind === 'captive' || t.kind === 'prisoner') score *= 3;
    if (score >= bestScore) return;
    const v = sees(sim, a, t);
    if (!v) return;
    best = t;
    bestScore = score;
    bestSee = v;
  };
  if (p.alive && !p.downed) {
    // in the dark an alerted soldier still needs to be able to make you out
    const d = Math.hypot(p.x - a.x, p.z - a.z);
    const dark = sightInLight(sim.lightAt(p.x, p.z));
    if (d < Math.max(18, a.stats.view * 1.5 * dark * (1 - sim.derived.stealth * 0.5)) || sim.time - p.lastLoudShot < 2.5) consider(p);
  }
  for (const o of sim.actors) {
    if (!o.alive || o.downed || o.faction === 'enemy') continue;
    if (o.kind === 'npc' || o.kind === 'civilian') continue;
    if (o.kind === 'captive' && o.ai.state === 'held') continue;
    if (o.kind === 'prisoner') continue; // they do not shoot their own
    consider(o);
  }
  void light;
  ai.seeing = bestSee;
  return best;
}

// Grows or drains this sentry's awareness of the player and of allied soldiers. Returns the
// target it has fully noticed, if any.
function perceive(sim, a, dtT) {
  const ai = a.ai;
  const S = B.STEALTH;
  const p = sim.player;
  let noticed = null;
  let rising = false;
  const look = a.yaw;
  if (p.alive && !p.downed) {
    const dx = p.x - a.x;
    const dz = p.z - a.z;
    const d = Math.hypot(dx, dz);
    const lit = sim.lightAt(p.x, p.z);
    let range = a.stats.view * sightInLight(lit);
    if (sim.time - p.lastLoudShot < 2) range = Math.max(range, a.stats.view * 1.2);
    if (d < range || d < S.TOUCH) {
      const angle = (Math.abs(angleDiff(Math.atan2(dx, -dz), look)) * 180) / Math.PI;
      if (angle <= S.PERIPHERAL_FOV / 2 || d < S.TOUCH) {
        const v = sees(sim, a, p);
        if (v) {
          const rate =
            detectionRate({ distance: d, range, angle, stance: p.stance, move: p.moveState, cover: sim.world.sightThrough(a.x, a.z, p.x, p.z), stealth: sim.derived.stealth, detect: a.stats.detect, concealed: p.concealed }) * (v === 2 ? 1 : 0.6);
          if (rate > 0) {
            ai.aware = Math.min(1, ai.aware + rate * dtT);
            rising = true;
            ai.seen = { x: p.x, z: p.z, t: sim.time };
            if (ai.aware >= 1) noticed = p;
          }
        }
      }
    }
  }
  if (!noticed && !a.drill) {
    // allied soldiers: seen quickly once in range and in view
    const lit = sim.lightAt(a.x, a.z);
    for (const o of sim.actors) {
      if (!o.alive || o.downed || (o.kind !== 'squad' && o.kind !== 'ally') || o.kind === 'npc') continue;
      const dx = o.x - a.x;
      const dz = o.z - a.z;
      const d = Math.hypot(dx, dz);
      const stanceMul = o.stance === 'prone' ? 0.35 : o.stance === 'crouch' ? 0.6 : 1;
      const range = a.stats.view * sightInLight(lit) * (1 - (o.stats?.stealth ?? 0.1)) * stanceMul;
      if (d > range) continue;
      const angle = (Math.abs(angleDiff(Math.atan2(dx, -dz), look)) * 180) / Math.PI;
      if (angle > S.FOV / 2 && d > S.TOUCH) continue;
      if (!sees(sim, a, o)) continue;
      ai.aware = Math.min(1, ai.aware + (0.6 + 1.6 * (1 - d / range)) * dtT);
      rising = true;
      ai.seen = { x: o.x, z: o.z, t: sim.time };
      if (ai.aware >= 1) noticed = o;
      break;
    }
  }
  if (!rising) ai.aware = Math.max(ai.floor ?? 0, ai.aware - S.DECAY * dtT);
  return noticed;
}

// A dead comrade in plain view.
function spotBody(sim, a) {
  for (const body of sim.bodies) {
    if (body.found) continue;
    const d2 = dist2(a, body);
    if (d2 > 24 * 24) continue;
    const angle = (Math.abs(angleDiff(bearing(a.x, a.z, body.x, body.z), a.yaw)) * 180) / Math.PI;
    if (angle > 70) continue;
    if (!sim.world.colliders.los(a.x, eyeY(a), a.z, body.x, body.y + 0.3, body.z)) continue;
    body.found = true;
    return body;
  }
  return null;
}

function findCover(sim, a, threat) {
  const points = sim.coverNear(a.x, a.z, 20);
  let best = null;
  let bestScore = Infinity;
  const c = sim.world.colliders;
  const ty = threat === sim.player ? threat.y + 1.5 : threat.y + 1.5;
  let checked = 0;
  for (const p of points) {
    if (p.taken && p.taken !== a.id && sim.time - p.takenAt < 6) continue;
    const dThreat = Math.hypot(p.x - threat.x, p.z - threat.z);
    if (dThreat < 7) continue;
    const dSelf = Math.hypot(p.x - a.x, p.z - a.z);
    const score = dSelf + Math.abs(dThreat - Math.min(a.stats.weapon.range * 0.6, 35)) * 0.3;
    if (score >= bestScore) continue;
    if (++checked > 10) break;
    // good cover hides you crouched and lets you shoot standing
    if (c.los(threat.x, ty, threat.z, p.x, p.y + 0.6, p.z)) continue;
    if (!c.los(threat.x, ty, threat.z, p.x, p.y + 1.55, p.z)) continue;
    best = p;
    bestScore = score;
  }
  if (best) {
    best.taken = a.id;
    best.takenAt = sim.time;
  }
  return best;
}

function thinkEnemy(sim, a, dtT) {
  const ai = a.ai;
  const now = sim.time;
  ai.fireOk = false;
  ai.face = null;
  if (a.captured) return thinkFollower(sim, a);
  if (a.surrendered) {
    clearGoal(a);
    return;
  }
  if (ai.stunned > now) {
    clearGoal(a);
    return;
  }
  const noticed = perceive(sim, a, dtT);
  const S = B.STEALTH;

  if (a.drill) {
    // training sentries only watch; the lane counts the strikes
    drillSentry(sim, a);
    return;
  }

  switch (ai.state) {
    case 'idle':
    case 'patrol': {
      if (noticed) {
        enterCombat(sim, a, noticed);
        break;
      }
      const body = spotBody(sim, a);
      if (body) {
        sim.bodyFound(a, body);
        ai.seen = { x: body.x, z: body.z, t: now };
        ai.aware = Math.max(ai.aware, 0.8);
      }
      if (ai.aware >= S.INVESTIGATE && ai.seen) {
        ai.returnTo = ai.state;
        ai.state = 'investigate';
        ai.timer = 0;
        break;
      }
      if (ai.aware >= S.CURIOUS && ai.seen) {
        clearGoal(a);
        ai.face = bearing(a.x, a.z, ai.seen.x, ai.seen.z);
        break;
      }
      if (ai.state === 'patrol' && ai.patrol) {
        const pt = ai.patrol.points[ai.patrol.index];
        if (dist2(a, pt) < 1.2) {
          if (!ai.patrol.until) ai.patrol.until = now + 1.5 + Math.random() * 3;
          clearGoal(a);
          ai.scan += dtT;
          ai.face = a.yaw + Math.sin(ai.scan * 0.9) * 0.05;
          if (now > ai.patrol.until) {
            ai.patrol.until = 0;
            ai.patrol.index = (ai.patrol.index + 1) % ai.patrol.points.length;
          }
        } else setGoal(a, pt.x, pt.z, 'walk');
      } else if (ai.follow && ai.follow.alive) {
        // a bodyguard keeps close to the one he guards
        const f = ai.follow;
        const ox = Math.cos(ai.slot * 1.9) * 2.4;
        const oz = Math.sin(ai.slot * 1.9) * 2.4;
        if ((a.x - f.x - ox) ** 2 + (a.z - f.z - oz) ** 2 > 4) setGoal(a, f.x + ox, f.z + oz, 'walk');
        else clearGoal(a);
        ai.face = f.yaw;
      } else {
        const post = ai.post;
        if (!ai.fixed && dist2(a, post) > 1.5) setGoal(a, post.x, post.z, 'walk');
        else {
          clearGoal(a);
          ai.scan += dtT;
          ai.face = post.yaw + Math.sin(ai.scan * 0.5) * 0.7;
        }
      }
      break;
    }
    case 'investigate': {
      if (noticed) {
        enterCombat(sim, a, noticed);
        break;
      }
      const body = spotBody(sim, a);
      if (body) sim.bodyFound(a, body);
      if (!ai.seen) {
        ai.state = ai.returnTo ?? 'idle';
        break;
      }
      if (ai.fixed) {
        ai.face = bearing(a.x, a.z, ai.seen.x, ai.seen.z);
        if (now - ai.seen.t > 8) ai.state = ai.returnTo ?? 'idle';
        break;
      }
      if (dist2(a, ai.seen) > 9 && !ai.timer) setGoal(a, ai.seen.x, ai.seen.z, ai.aware > 0.85 ? 'run' : 'walk');
      else {
        clearGoal(a);
        if (!ai.timer) ai.timer = now + 4 + Math.random() * 3;
        ai.scan += dtT;
        ai.face = a.yaw + 0.9 * dtT * 3;
        if (now > ai.timer) {
          ai.timer = 0;
          ai.state = ai.returnTo ?? 'idle';
          ai.aware = Math.min(ai.aware, 0.3);
        }
      }
      break;
    }
    case 'search': {
      if (noticed) {
        enterCombat(sim, a, noticed, sim.alarmOn());
        break;
      }
      if (now > ai.timer || !ai.seen) {
        ai.state = ai.returnTo ?? 'idle';
        ai.floor = 0.25;
        ai.aware = 0.3;
        break;
      }
      if (ai.fixed) {
        ai.face = bearing(a.x, a.z, ai.seen.x, ai.seen.z) + Math.sin(now * 0.8) * 0.6;
        break;
      }
      if (now > ai.searchAt) {
        ai.searchAt = now + 3 + Math.random() * 3;
        const r = ai.searchWide ? 14 : 4;
        ai.searchWide = true;
        const ang = Math.random() * TAU;
        const free = sim.world.nav.nearestFree(ai.seen.x + Math.cos(ang) * r, ai.seen.z + Math.sin(ang) * r, 6);
        if (free) setGoal(a, free.x, free.z, 'run');
      }
      ai.face = a.yaw + Math.sin(now * 1.3) * 0.5;
      break;
    }
    case 'combat': {
      if (ai.shout && now >= ai.shout) {
        ai.shout = 0;
        sim.shout(a, 40);
      }
      if (ai.alarm && now >= ai.alarm) {
        ai.alarm = 0;
        sim.raiseAlarm(a);
      }
      const target = pickTarget(sim, a);
      if (a.flees && sim.alarmOn()) {
        ai.state = 'flee';
        break;
      }
      if (target) {
        ai.target = target;
        ai.seen = { x: target.x, z: target.z, t: now };
        ai.lost = 0;
        const d = Math.hypot(target.x - a.x, target.z - a.z);
        ai.fireOk = d < a.stats.weapon.range * 2.1;
        // grenadiers lob at anyone sitting still
        if (a.grenades > 0 && now > ai.grenade && d > 10 && d < 34 && (target.moveState === 'still' || ai.seeing === 1)) {
          ai.grenade = now + 9 + Math.random() * 5;
          a.grenades--;
          sim.throwGrenade(a, 'frag', target.x, target.y, target.z);
        }
        if (ai.fixed) break;
        const type = a.type;
        if (type === 'breacher' || type === 'heavy') {
          if (d > (type === 'heavy' ? 14 : 5)) setGoal(a, target.x, target.z, type === 'heavy' ? 'walk' : 'sprint');
          else clearGoal(a);
        } else if (type === 'marksman') {
          clearGoal(a);
          a.stance = 'crouch';
        } else {
          // work from cover; find some if we have none or it stopped being cover
          ai.coverTimer -= dtT;
          if (ai.coverTimer <= 0) {
            ai.coverTimer = 2.5 + Math.random() * 2;
            const exposed = !ai.cover || sim.world.colliders.los(target.x, target.y + 1.5, target.z, ai.cover.x, ai.cover.y + 0.6, ai.cover.z);
            if (exposed) ai.cover = findCover(sim, a, target);
          }
          if (ai.cover) {
            if (dist2(a, ai.cover) > 0.8) {
              setGoal(a, ai.cover.x, ai.cover.z, 'sprint');
              a.stance = 'stand';
            } else {
              clearGoal(a);
              // up to shoot, down between bursts
              a.stance = ai.burst > 0 || ai.fireTimer < 0.35 ? 'stand' : 'crouch';
            }
          } else if (d > a.stats.weapon.range * 0.75) setGoal(a, target.x, target.z, 'run');
          else if (d < 7) {
            const away = bearing(target.x, target.z, a.x, a.z);
            setGoal(a, a.x + Math.sin(away) * 6, a.z - Math.cos(away) * 6, 'run');
          } else clearGoal(a);
        }
      } else {
        ai.target = null;
        if (!ai.lost) ai.lost = now;
        if (!ai.seen) {
          ai.state = ai.returnTo ?? 'idle';
          break;
        }
        ai.face = bearing(a.x, a.z, ai.seen.x, ai.seen.z);
        a.stance = 'stand';
        if (ai.fixed) {
          if (now - ai.lost > 20) {
            ai.state = ai.returnTo ?? 'idle';
            ai.floor = 0.25;
          }
          break;
        }
        if (now - ai.lost > 2.5 + (a.id % 5) * 0.5) {
          if (dist2(a, ai.seen) > 12) setGoal(a, ai.seen.x, ai.seen.z, 'run');
          else {
            ai.state = 'search';
            ai.timer = now + 18 + Math.random() * 10;
            ai.searchAt = 0;
            ai.searchWide = false;
          }
        } else clearGoal(a);
      }
      break;
    }
    case 'flee': {
      const e = a.fleeTo;
      a.stance = 'stand';
      if (!e) {
        ai.state = 'combat';
        break;
      }
      if (dist2(a, e) < 9) {
        sim.onEscaped(a);
        break;
      }
      setGoal(a, e.x, e.z, 'run');
      break;
    }
    default:
      ai.state = 'idle';
  }
}

function drillSentry(sim, a) {
  const ai = a.ai;
  if (ai.patrol) {
    const pt = ai.patrol.points[ai.patrol.index];
    if (dist2(a, pt) < 1.2) {
      if (!ai.patrol.until) ai.patrol.until = sim.time + 2.5 + Math.random() * 2;
      clearGoal(a);
      if (sim.time > ai.patrol.until) {
        ai.patrol.until = 0;
        ai.patrol.index = (ai.patrol.index + 1) % ai.patrol.points.length;
      }
    } else setGoal(a, pt.x, pt.z, 'walk');
  } else {
    clearGoal(a);
    ai.scan += 0.16;
    ai.face = ai.post.yaw + Math.sin(ai.scan * 0.45) * 0.8;
  }
}

// ---------- your side ----------
function nearestEnemy(sim, a, wanted) {
  const light = sightInLight(sim.lightAt(a.x, a.z));
  const range = a.stats.view * Math.max(0.5, light);
  let best = null;
  let bestD = Infinity;
  if (wanted && wanted.alive && !wanted.surrendered && !wanted.captured) {
    const d = Math.hypot(wanted.x - a.x, wanted.z - a.z);
    if (d < range * 1.3 && sees(sim, a, wanted)) return wanted;
  }
  for (const o of sim.actors) {
    if (!o.alive || o.kind !== 'enemy' || o.surrendered || o.captured || o.drill) continue;
    const d = Math.hypot(o.x - a.x, o.z - a.z);
    if (d > range || d >= bestD) continue;
    // an enemy that is shooting gives himself away further out
    if (!sees(sim, a, o)) continue;
    best = o;
    bestD = d;
  }
  return best;
}

// The nearest enemy who is in the fight, seen or not.
function nearestFighting(sim, a, reach) {
  let best = null;
  let bestD = reach * reach;
  for (const o of sim.actors) {
    if (!o.alive || o.kind !== 'enemy' || o.ai.state !== 'combat' || o.surrendered || o.captured) continue;
    const d = (o.x - a.x) ** 2 + (o.z - a.z) ** 2;
    if (d < bestD) {
      best = o;
      bestD = d;
    }
  }
  return best;
}

function formationSlot(sim, slot) {
  const p = sim.player;
  const row = Math.floor(slot / 2) + 1;
  const side = slot % 2 ? 1 : -1;
  const fx = Math.sin(p.yaw);
  const fz = -Math.cos(p.yaw);
  const rx = Math.cos(p.yaw);
  const rz = Math.sin(p.yaw);
  const back = B.SQUAD.FOLLOW_GAP * row * 0.85;
  const off = side * (1.3 + row * 0.7);
  return { x: p.x - fx * back + rx * off, z: p.z - fz * back + rz * off };
}

function thinkFriendly(sim, a, dtT) {
  const ai = a.ai;
  const now = sim.time;
  const p = sim.player;
  ai.fireOk = false;
  ai.face = null;
  void dtT;
  const mine = a.kind === 'squad';
  const follows = mine || a.escort;

  // orders reach a squad member only after a moment, and only within command range
  if (mine && ai.pending && now >= ai.pending.at) {
    ai.order = ai.pending.order;
    ai.orderPoint = ai.pending.point ?? null;
    ai.orderTarget = ai.pending.target ?? null;
    ai.pending = null;
  }

  const holdFire = follows && sim.holdFire && !sim.loud();
  const enemy = nearestEnemy(sim, a, mine ? ai.orderTarget : null);
  if (enemy && follows) sim.tag(enemy, 6, true);
  // never shoot someone the mission wants alive unless he is shooting back
  const spare = enemy && enemy.capture && sim.mission && !sim.mission.done('capture');
  if (enemy && !holdFire && !spare) {
    ai.target = enemy;
    ai.fireOk = Math.hypot(enemy.x - a.x, enemy.z - a.z) < a.stats.weapon.range * 2;
    ai.seeing = 2;
    if (!ai.react || ai.react < now - 5) ai.react = now + a.stats.reaction;
  } else {
    ai.target = null;
  }

  // medics (and anyone, for a downed leader) go to whoever needs them
  if (follows && now > ai.heal) {
    const patient = pickPatient(sim, a);
    if (patient) {
      const d = Math.hypot(patient.x - a.x, patient.z - a.z);
      if (d > 2) {
        setGoal(a, patient.x, patient.z, 'sprint');
        ai.arrive = 1.6;
        return;
      }
      clearGoal(a);
      ai.fireOk = false;
      ai.face = bearing(a.x, a.z, patient.x, patient.z);
      a.stance = 'crouch';
      ai.treating = (ai.treating ?? 0) + 0.16;
      const need = patient === p && p.downed ? (a.stats.heal ? 3 : 5.5) : 2.6;
      if (ai.treating >= need) {
        ai.treating = 0;
        ai.heal = now + 9;
        sim.treat(a, patient);
      }
      return;
    }
    ai.treating = 0;
  }
  ai.arrive = 0.7;

  if (follows) {
    const order = mine ? ai.order : 'follow';
    if (order === 'hold' || order === 'move') {
      const pt = ai.orderPoint ?? { x: a.x, z: a.z };
      if (dist2(a, pt) > 1.2) setGoal(a, pt.x, pt.z, 'run');
      else {
        clearGoal(a);
        a.stance = ai.target ? 'crouch' : p.stance === 'prone' ? 'prone' : 'crouch';
      }
      return;
    }
    // follow: keep formation, but stand and fight when there is someone to shoot
    const slot = formationSlot(sim, ai.slot);
    const d = Math.hypot(slot.x - a.x, slot.z - a.z);
    const dp = Math.hypot(p.x - a.x, p.z - a.z);
    if (dp > 95 && !ai.target) {
      const near = sim.world.walkableNear(slot.x, slot.z, 12);
      if (near) {
        a.x = near.x;
        a.z = near.z;
        a.y = sim.world.terrain.heightAt(a.x, a.z);
        ai.path = null;
      }
      return;
    }
    if (ai.target && dp < 30) {
      clearGoal(a);
      a.stance = 'crouch';
      return;
    }
    // under fire with nobody in view: work round until there is someone to shoot at, without
    // straying far from the leader
    if (!ai.target && !holdFire && sim.inFight()) {
      const foe = nearestFighting(sim, a, 70);
      if (foe && dp < 28) {
        setGoal(a, foe.x, foe.z, 'run');
        a.stance = 'stand';
        return;
      }
    }
    if (d > 1.4) {
      const sneaking = p.stance !== 'stand' && !sim.loud();
      setGoal(a, slot.x, slot.z, d > 16 ? 'sprint' : d > 5 || p.moveState === 'sprint' || p.moveState === 'run' ? 'run' : 'walk');
      a.stance = sneaking && d < 12 ? 'crouch' : 'stand';
    } else {
      clearGoal(a);
      a.stance = p.stance === 'stand' ? (ai.target ? 'crouch' : 'stand') : p.stance;
      ai.face = p.yaw + (ai.slot % 2 ? 0.5 : -0.5);
    }
    return;
  }

  // garrison soldiers
  if (ai.state === 'assault') {
    if (ai.target) {
      const d = Math.hypot(ai.target.x - a.x, ai.target.z - a.z);
      if (d > a.stats.weapon.range * 0.6) setGoal(a, ai.target.x, ai.target.z, 'run');
      else {
        clearGoal(a);
        a.stance = 'crouch';
      }
    } else {
      const goal = sim.assaultGoal(a);
      if (goal && dist2(a, goal) > 16) setGoal(a, goal.x, goal.z, 'run');
      else clearGoal(a);
      a.stance = 'stand';
    }
    return;
  }
  // defend: stay on your post
  const post = ai.post;
  if (dist2(a, post) > 1.5) setGoal(a, post.x, post.z, 'run');
  else {
    clearGoal(a);
    a.stance = ai.target ? 'stand' : 'crouch';
    if (!ai.target) {
      ai.scan += 0.16;
      ai.face = post.yaw + Math.sin(ai.scan * 0.4) * 0.6;
    }
  }
}

function pickPatient(sim, a) {
  const p = sim.player;
  const medic = a.stats.heal > 0;
  const reach = 45;
  if (p.downed && Math.hypot(p.x - a.x, p.z - a.z) < reach) {
    // one rescuer at a time
    if (!sim.rescuer || sim.rescuer === a || !sim.rescuer.alive || sim.rescuer.downed) {
      sim.rescuer = a;
      return p;
    }
    return null;
  }
  if (!medic) return null;
  let best = null;
  let bestNeed = 0;
  for (const o of sim.actors) {
    if (o === a || o.kind !== 'squad' || !o.alive) continue;
    if (Math.hypot(o.x - a.x, o.z - a.z) > reach) continue;
    const need = o.downed ? 2 : o.health < o.maxHealth * B.SQUAD.HEAL_AT ? 1 - o.health / o.maxHealth : 0;
    if (need > bestNeed) {
      best = o;
      bestNeed = need;
    }
  }
  if (p.alive && !p.downed && p.health < sim.derived.maxHealth * B.SQUAD.HEAL_AT && Math.hypot(p.x - a.x, p.z - a.z) < reach) {
    const need = 1.2 - p.health / sim.derived.maxHealth;
    if (need > bestNeed) best = p;
  }
  // do not walk into fire for a scratch
  if (best && best !== p && !best.downed && a.ai.target) return null;
  return best;
}

// Captives you have freed and prisoners you have taken trail along behind you.
function thinkFollower(sim, a) {
  const ai = a.ai;
  const p = sim.player;
  ai.fireOk = false;
  if (ai.state === 'held') {
    clearGoal(a);
    a.stance = 'crouch';
    return;
  }
  const slot = formationSlot(sim, 6 + (a.id % 4));
  const d = Math.hypot(slot.x - a.x, slot.z - a.z);
  if (d > 1.6) {
    setGoal(a, slot.x, slot.z, d > 12 ? 'sprint' : 'run');
    a.stance = 'stand';
  } else {
    clearGoal(a);
    a.stance = p.stance === 'stand' ? 'stand' : 'crouch';
  }
  if (Math.hypot(p.x - a.x, p.z - a.z) > 110) {
    const near = sim.world.walkableNear(slot.x, slot.z, 12);
    if (near) {
      a.x = near.x;
      a.z = near.z;
      a.y = sim.world.terrain.heightAt(a.x, a.z);
    }
  }
}

function thinkCivilian(sim, a) {
  const ai = a.ai;
  const now = sim.time;
  if (ai.panic > now) {
    a.stance = 'crouch';
    if (ai.hide && dist2(a, ai.hide) > 2) {
      setGoal(a, ai.hide.x, ai.hide.z, 'sprint');
      a.stance = 'stand';
    } else clearGoal(a);
    return;
  }
  a.stance = 'stand';
  const pt = ai.patrol?.points[ai.patrol.index];
  if (!pt) return;
  if (dist2(a, pt) < 2) {
    clearGoal(a);
    ai.patrol.wait -= 0.16;
    if (ai.patrol.wait <= 0) {
      ai.patrol.wait = 4 + Math.random() * 10;
      ai.patrol.index = Math.floor(Math.random() * ai.patrol.points.length);
    }
  } else setGoal(a, pt.x, pt.z, 'walk');
}

function thinkNpc(sim, a) {
  const p = sim.player;
  const d2 = (p.x - a.x) ** 2 + (p.z - a.z) ** 2;
  a.ai.face = d2 < 64 ? bearing(a.x, a.z, p.x, p.z) : a.ai.post.yaw;
}
