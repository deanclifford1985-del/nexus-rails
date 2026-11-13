// Combat and stealth maths. Pure functions: the simulation supplies the situation, these return
// the numbers. Nothing here knows about three.js or the world.

import { B, clamp } from './balance.js';

// ---------- the player's fire ----------

// Spread of the next shot, in degrees (half-angle of the cone).
export function shotSpread({ weapon, stance = 'stand', moveShare = 0, aiming = false, bloom = 0, braced = false }) {
  const C = B.COMBAT;
  let spread = weapon.spread;
  spread *= C.STANCE_SPREAD[stance] ?? 1;
  spread *= 1 + (C.MOVE_SPREAD - 1) * clamp(moveShare, 0, 1);
  if (!aiming) spread *= C.HIP_SPREAD * (weapon.hip ?? 1);
  spread *= 1 + clamp(bloom, 0, C.BLOOM_MAX);
  if (braced) spread *= 0.8;
  return spread;
}

// Damage kept at a distance: full to the weapon's effective range, then falling to FALLOFF_MIN at twice it.
export function rangeFalloff(weapon, distance) {
  if (distance <= weapon.range) return 1;
  const t = clamp((distance - weapon.range) / weapon.range, 0, 1);
  return 1 - (1 - B.COMBAT.FALLOFF_MIN) * t;
}

// Damage of one of the player's rounds on a target. zone: head | torso | limb.
export function shotDamage({ weapon, distance, zone = 'torso', armor = 0, armorHead = 0, bonus = 1 }) {
  const zoneMul = zone === 'head' ? weapon.headMul ?? B.COMBAT.ZONE.head : B.COMBAT.ZONE[zone] ?? 1;
  const protection = zone === 'head' ? armorHead : zone === 'torso' ? armor : 0;
  const kept = 1 - protection * (1 - (weapon.pierce ?? 0));
  return weapon.damage * zoneMul * rangeFalloff(weapon, distance) * kept * bonus;
}

// ---------- fire that is rolled rather than traced (enemies and squad) ----------

// Chance that one round from an AI shooter hits its target.
//   accuracy: the shooter's hit chance at 30 m on a standing, still target
//   range: the shooter's weapon's effective range
export function hitChance({ accuracy, range, distance, stance = 'stand', moving = 'still', cover = false, night = false, suppressed = false, evade = 0, flash = false }) {
  const E = B.COMBAT.ENEMY;
  // 1.0 at 30 m, better closer, falling away past the weapon's effective range.
  const reach = clamp(1.25 - (distance / Math.max(20, range)) * 0.85, 0.06, 1.25) * clamp(1.15 - distance / 400, 0.5, 1.15);
  let p = accuracy * reach;
  p *= E.STANCE[stance] ?? 1;
  p *= E.MOVING[moving] ?? 1;
  if (cover) p *= E.COVER;
  if (night && !flash) p *= E.NIGHT;
  if (suppressed) p *= E.SUPPRESSED;
  p *= 1 - evade * (moving === 'still' ? E.EVADE_STILL : 1);
  return clamp(p, E.MIN, E.MAX);
}

// Where a rolled hit lands, and what it does. roll is 0..1.
export function rollZone(roll) {
  const Z = B.COMBAT.HIT_ZONE_ROLL;
  return roll < Z.head ? 'head' : roll < Z.head + Z.torso ? 'torso' : 'limb';
}

export function incomingDamage({ damage, zone, armor = 0, armorHead = 0, pierce = 0 }) {
  const zoneMul = zone === 'head' ? 1.8 : zone === 'limb' ? 0.7 : 1;
  const protection = zone === 'head' ? armorHead : zone === 'torso' ? armor : 0;
  return damage * zoneMul * (1 - protection * (1 - pierce));
}

// Blast damage at a distance from the centre: full inside a third of the radius, zero at the edge.
export function blastDamage(base, radius, distance) {
  if (distance >= radius) return 0;
  const inner = radius / 3;
  if (distance <= inner) return base;
  return base * (1 - (distance - inner) / (radius - inner));
}

// ---------- enemies ----------

// The fighting numbers for one enemy of a type at a tier (1..10).
export function enemyStats(type, tier = 1) {
  const E = B.ENEMY;
  const def = E.TYPES[type] ?? E.TYPES.rifleman;
  const t = clamp(tier, 1, E.TIER_MAX) - 1;
  const weapon = E.WEAPONS[def.weapon];
  return {
    type,
    tier: t + 1,
    name: def.name,
    maxHealth: Math.round((E.HEALTH.base + E.HEALTH.perTier * t) * def.health),
    accuracy: (E.ACCURACY.base + E.ACCURACY.perTier * t) * def.accuracy,
    view: (E.VIEW.base + E.VIEW.perTier * t) * def.view,
    detect: E.DETECT.base + E.DETECT.perTier * t,
    reaction: Math.max(E.REACTION.min, E.REACTION.base + E.REACTION.perTier * t),
    armor: def.armor ?? 0,
    speed: def.speed,
    grenades: def.grenades ?? 0,
    weaponId: def.weapon,
    weapon: { ...weapon, damage: weapon.damage * (1 + E.DAMAGE.perTier * t) },
    xp: Math.round((B.XP.KILL[type] ?? 14) * (1 + B.XP.KILL_TIER * t)),
  };
}

// ---------- stealth ----------

// How fast one watcher's awareness of you rises, per second. 0 means you are not seen at all.
//   range: the watcher's sight range in this light, already scaled
//   angle: degrees between where they face and where you are
//   cover: 0..1 share of sight kept through brush and woodland (1 = open ground)
export function detectionRate({ distance, range, angle = 0, stance = 'stand', move = 'still', cover = 1, stealth = 0, detect = 1, concealed = 1 }) {
  const S = B.STEALTH;
  if (distance <= S.TOUCH) return S.RATE * 2;
  if (distance >= range) return 0;
  let facing = 0;
  if (angle <= S.FOV / 2) facing = 1;
  else if (angle <= S.PERIPHERAL_FOV / 2) facing = S.PERIPHERAL;
  if (facing === 0) return 0;
  const near = Math.pow(1 - distance / range, S.FALLOFF_POWER);
  const visible = (S.STANCE[stance] ?? 1) * (S.MOVE[move] ?? 1) * cover * concealed * (1 - stealth);
  return S.RATE * near * visible * facing * detect;
}

// Share of sight range a watcher keeps in this light. light: 1 = day, 0 = dark.
export function sightInLight(light) {
  const S = B.STEALTH;
  if (light >= 0.75) return 1;
  if (light >= 0.4) return S.DUSK_RANGE + ((light - 0.4) / 0.35) * (1 - S.DUSK_RANGE);
  return S.NIGHT_RANGE + (light / 0.4) * (S.DUSK_RANGE - S.NIGHT_RANGE);
}

// How far your footsteps carry, in metres.
export function footstepNoise({ move = 'walk', stance = 'stand', noiseMul = 1 }) {
  const F = B.STEALTH.FOOTSTEP;
  if (move === 'still') return 0;
  const base = F[move] ?? F.walk;
  const stanceMul = stance === 'crouch' ? F.crouch : stance === 'prone' ? F.prone : 1;
  return base * stanceMul * noiseMul;
}

// Concealment from what you are standing in. ground: 'bush' | 'tallgrass' | other.
export function concealment({ ground, stance, night = false, nightStealth = 0, shadowPerk = false }) {
  const S = B.STEALTH;
  let c = 1;
  if (ground === 'bush') c *= stance === 'stand' ? 0.75 : S.BUSH;
  else if (ground === 'tallgrass' && stance !== 'stand') c *= S.TALL_GRASS[stance] ?? 1;
  if (night) c *= 1 - nightStealth;
  if (shadowPerk && stance !== 'stand') c *= 0.75;
  return c;
}

// Can a takedown be done from here? facing = the target's facing (radians), bearing = direction
// from the target to the attacker (radians).
export function canTakedown({ distance, facing, bearing, aware = 0 }) {
  if (distance > B.STEALTH.TAKEDOWN_RANGE) return false;
  if (aware >= 1) return false;
  let diff = Math.abs(bearing - facing) % (Math.PI * 2);
  if (diff > Math.PI) diff = Math.PI * 2 - diff;
  // The attacker must be inside the arc centred directly behind the target.
  return Math.PI - diff <= ((B.STEALTH.TAKEDOWN_ARC / 2) * Math.PI) / 180;
}

// Chance an enemy gives up when you demand it. alone/wounded/pinned raise it; an officer resists.
export function surrenderChance({ surrender, health = 1, alone = false, pinned = false, officer = false, tier = 1 }) {
  let p = surrender;
  if (alone) p += 0.25;
  if (pinned) p += 0.15;
  p += (1 - clamp(health, 0, 1)) * 0.4;
  if (officer) p -= 0.15;
  p -= (tier - 1) * 0.03;
  return clamp(p, 0.02, 0.95);
}
