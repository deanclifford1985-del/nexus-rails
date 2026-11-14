// Everyone in the world who is not the player: enemies, your squad, allied soldiers, captives,
// civilians and the people at camp. An Actor is plain state; sim/ai.js decides what it does and
// the view draws it.

import { B } from '../game/balance.js';
import { enemyStats } from '../game/combat.js';
import { memberCombat, memberLabel, ROLES, SQUAD_WEAPONS } from '../game/squad.js';
import { rayCylinder, raySphere } from './colliders.js';

let nextId = 1;

export const STANCE_HEIGHT = { stand: 1.8, crouch: 1.15, prone: 0.5 };
export const EYE_HEIGHT = { stand: 1.62, crouch: 1.0, prone: 0.32 };

export class Actor {
  constructor(kind, faction, x, z, y, yaw = 0) {
    this.id = nextId++;
    this.kind = kind; // enemy | squad | ally | captive | prisoner | civilian | npc
    this.faction = faction; // enemy | ally | civ
    this.x = x;
    this.y = y;
    this.z = z;
    this.yaw = yaw;
    this.vx = 0;
    this.vz = 0;
    this.stance = 'stand';
    this.moveState = 'still';
    this.alive = true;
    this.downed = false;
    this.health = 100;
    this.maxHealth = 100;
    this.armor = 0;
    this.armorHead = 0;
    this.evade = 0;
    this.name = '';
    this.type = 'rifleman';
    this.look = { outfit: 'legion', skin: 0, hat: 'helmet', weapon: 'rifle' };
    this.speed = 1;
    this.radius = 0.33;
    // what the view animates from
    this.anim = { walk: 0, aim: 0, fire: 0, hit: 0, death: 0, hands: 0 };
    this.tagged = 0; // sim time until which the player has this soldier marked (Infinity = for good)
    this.sensed = 0;
    this.ai = {
      state: 'idle',
      think: Math.random() * 0.2,
      target: null,
      aware: 0,
      seen: null, // { x, z, t } last place a threat was seen or heard
      post: { x, z, yaw },
      patrol: null, // { points, index, wait }
      path: null,
      pathIndex: 0,
      pathTimer: 0,
      pathGoal: null,
      burst: 0,
      fireTimer: 0,
      react: 0,
      cover: null,
      coverTimer: 0,
      timer: 0,
      fixed: false,
      suppressed: 0,
      stunned: 0,
      shout: 0,
      alarm: 0,
      stuck: 0,
      lastX: x,
      lastZ: z,
      grenade: 0,
      scan: Math.random() * 6,
      order: 'follow',
      orderPoint: null,
      orderTarget: null,
      orderAt: 0,
      slot: 0,
      heal: 0,
    };
  }
}

// ---------- makers ----------
const ENEMY_LOOK = {
  rifleman: { hat: 'helmet', weapon: 'rifle' },
  scout: { hat: 'cap', weapon: 'smg' },
  gunner: { hat: 'helmet', weapon: 'lmg' },
  marksman: { hat: 'boonie', weapon: 'dmr' },
  breacher: { hat: 'helmet', weapon: 'shotgun' },
  grenadier: { hat: 'helmet', weapon: 'rifle' },
  heavy: { hat: 'heavy', weapon: 'lmg' },
  officer: { hat: 'beret', weapon: 'pistol' },
  boss: { hat: 'beret', weapon: 'rifle' },
};

export function makeEnemy(type, tier, p, rng = Math.random) {
  const stats = enemyStats(type, tier);
  const a = new Actor('enemy', 'enemy', p.x, p.z, p.y, p.yaw ?? 0);
  a.type = type;
  a.tier = tier;
  a.name = stats.name;
  a.stats = stats;
  a.health = a.maxHealth = stats.maxHealth;
  a.armor = stats.armor;
  a.armorHead = type === 'heavy' ? 0.4 : type === 'officer' || type === 'scout' || type === 'marksman' ? 0 : 0.15;
  a.speed = stats.speed;
  a.grenades = stats.grenades;
  a.look = { outfit: type === 'heavy' ? 'legionHeavy' : type === 'officer' || type === 'boss' ? 'legionOfficer' : 'legion', skin: Math.floor(rng() * 5), ...ENEMY_LOOK[type] };
  a.ai.post = { x: p.x, z: p.z, yaw: p.yaw ?? 0 };
  if (p.tower) {
    a.ai.fixed = true;
    a.ai.tower = true;
  }
  return a;
}

const ROLE_LOOK = { rifleman: 'rifle', marksman: 'dmr', medic: 'rifle', gunner: 'lmg', scout: 'smg', engineer: 'shotgun' };

// A member of the player's squad. `member` is the roster entry in the save.
export function makeSquadMember(member, derived, p, slot) {
  const c = memberCombat(member, derived);
  const a = new Actor('squad', 'ally', p.x, p.z, p.y, p.yaw ?? 0);
  a.member = member.id;
  a.type = member.role;
  a.name = memberLabel(member);
  a.stats = { accuracy: c.accuracy, view: c.view, detect: 1, reaction: c.reaction, weapon: c.weapon, weaponId: c.weaponId, stealth: c.stealth, heal: c.heal };
  a.health = a.maxHealth = c.maxHealth;
  a.armor = 0.2;
  a.armorHead = 0.25;
  a.evade = c.evade;
  a.look = { outfit: 'ally', skin: member.skin ?? 0, hat: member.role === 'scout' || member.role === 'marksman' ? 'boonie' : 'helmet', weapon: ROLE_LOOK[member.role] ?? 'rifle', medic: member.role === 'medic' };
  a.ai.slot = slot;
  a.ai.state = 'follow';
  a.kills = 0;
  return a;
}

// An allied soldier who is not yours to command (a garrison, or Sergeant Kaplan's section).
export function makeAlly(role, level, p, opts = {}) {
  const def = ROLES[role] ?? ROLES.rifleman;
  const weapon = SQUAD_WEAPONS[def.weapon];
  const a = new Actor('ally', 'ally', p.x, p.z, p.y, p.yaw ?? 0);
  a.type = role;
  a.name = opts.name ?? `Pvt ${opts.surname ?? 'Reyes'}`;
  const skill = def.base.accuracy + level * 1.4;
  a.stats = { accuracy: B.SQUAD.ACCURACY.base + skill * B.SQUAD.ACCURACY.accuracy, view: 110, detect: 1, reaction: 0.6, weapon: { ...weapon }, weaponId: def.weapon, stealth: 0.2, heal: role === 'medic' ? B.SQUAD.MEDIC_HEAL : 0 };
  a.health = a.maxHealth = Math.round(B.SQUAD.HEALTH.base + (def.base.toughness + level * 1.4) * B.SQUAD.HEALTH.toughness);
  a.armor = 0.2;
  a.armorHead = 0.25;
  a.evade = 0.08;
  a.look = { outfit: 'ally', skin: opts.skin ?? Math.floor(Math.random() * 5), hat: opts.hat ?? 'helmet', weapon: ROLE_LOOK[role] ?? 'rifle', medic: role === 'medic' };
  a.ai.state = opts.state ?? 'defend';
  a.ai.post = { x: p.x, z: p.z, yaw: p.yaw ?? 0 };
  a.escort = !!opts.escort; // follows the player like a squad member, but takes no orders
  a.ai.slot = opts.slot ?? 0;
  a.kills = 0;
  return a;
}

export function makeCaptive(p, name = 'Captured soldier') {
  const a = new Actor('captive', 'civ', p.x, p.z, p.y, p.yaw ?? 0);
  a.name = name;
  a.health = a.maxHealth = 80;
  a.look = { outfit: 'captive', skin: Math.floor(Math.random() * 5), hat: 'none', weapon: 'none' };
  a.ai.state = 'held';
  a.stance = 'crouch';
  return a;
}

export function makeCivilian(p, points) {
  const a = new Actor('civilian', 'civ', p.x, p.z, p.y, p.yaw ?? 0);
  a.name = 'Villager';
  a.health = a.maxHealth = 60;
  a.look = { outfit: 'civilian', skin: Math.floor(Math.random() * 5), hat: Math.random() < 0.3 ? 'cap' : 'none', weapon: 'none', tint: Math.floor(Math.random() * 4) };
  a.ai.state = 'wander';
  a.ai.patrol = { points, index: Math.floor(Math.random() * points.length), wait: Math.random() * 5 };
  return a;
}

export function makeNpc(npcId, name, p, look = {}) {
  const a = new Actor('npc', 'ally', p.x, p.z, p.y, p.yaw ?? 0);
  a.npc = npcId;
  a.name = name;
  a.health = a.maxHealth = 9999;
  a.invulnerable = true;
  a.look = { outfit: 'ally', skin: look.skin ?? 1, hat: look.hat ?? 'cap', weapon: 'none', ...look };
  a.ai.state = 'npc';
  a.ai.fixed = true;
  return a;
}

// ---------- being shot ----------
// Where a ray meets this actor: { t, zone } or null. Zones: head, torso, limb.
export function rayActor(a, ox, oy, oz, dx, dy, dz, maxT) {
  if (!a.alive) return null;
  // quick reject: how far the actor's centre is from the ray
  const cx = a.x - ox;
  const cy = a.y + 0.9 - oy;
  const cz = a.z - oz;
  const along = cx * dx + cy * dy + cz * dz;
  if (along < -1 || along > maxT + 1) return null;
  const px = cx - dx * along;
  const py = cy - dy * along;
  const pz = cz - dz * along;
  if (px * px + py * py + pz * pz > 1.7) return null;

  let best = null;
  const hit = (t, zone) => {
    if (t >= 0 && t <= maxT && (!best || t < best.t)) best = { t, zone };
  };
  const stance = a.downed ? 'prone' : a.stance;
  if (stance === 'prone') {
    const fx = Math.sin(a.yaw);
    const fz = -Math.cos(a.yaw);
    hit(raySphere(ox, oy, oz, dx, dy, dz, a.x + fx * 0.75, a.y + 0.24, a.z + fz * 0.75, 0.17), 'head');
    hit(rayCylinder(ox, oy, oz, dx, dy, dz, { x: a.x, z: a.z, r: 0.5, y0: a.y, y1: a.y + 0.36 }), 'torso');
  } else if (stance === 'crouch') {
    hit(raySphere(ox, oy, oz, dx, dy, dz, a.x, a.y + 1.0, a.z, 0.17), 'head');
    hit(rayCylinder(ox, oy, oz, dx, dy, dz, { x: a.x, z: a.z, r: 0.3, y0: a.y + 0.42, y1: a.y + 0.88 }), 'torso');
    hit(rayCylinder(ox, oy, oz, dx, dy, dz, { x: a.x, z: a.z, r: 0.28, y0: a.y, y1: a.y + 0.42 }), 'limb');
  } else {
    hit(raySphere(ox, oy, oz, dx, dy, dz, a.x, a.y + 1.62, a.z, 0.17), 'head');
    hit(rayCylinder(ox, oy, oz, dx, dy, dz, { x: a.x, z: a.z, r: 0.27, y0: a.y + 0.85, y1: a.y + 1.47 }), 'torso');
    hit(rayCylinder(ox, oy, oz, dx, dy, dz, { x: a.x, z: a.z, r: 0.2, y0: a.y, y1: a.y + 0.85 }), 'limb');
  }
  return best;
}

export const eyeY = (a) => a.y + (EYE_HEIGHT[a.downed ? 'prone' : a.stance] ?? 1.6);
export const chestY = (a) => a.y + (a.stance === 'prone' || a.downed ? 0.25 : a.stance === 'crouch' ? 0.7 : 1.15);
