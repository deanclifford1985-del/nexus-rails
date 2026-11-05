import { B } from './balance.js';
import { makeRng, pick, randRange, shuffle, uid, weightedPick } from './rng.js';

// Weapons are items with their own attributes. In a locomotive's `fit` list a weapon is either
// a plain module id ('cannon', 'heavy', 'plasma': the standard Uncommon weapon) or an object:
//   { item: 'weapon', uid, base, rarity, name, damage: [min, max], cooldown, accuracy, crit, pen, traits: [] }

const W = B.WEAPONS;
export const WEAPON_BASES = Object.keys(W.base);
export const RARITIES = ['uncommon', 'rare', 'epic', 'legendary'];
export const isWeaponItem = (entry) => typeof entry === 'object' && entry?.item === 'weapon';
export const baseOf = (entry) => (isWeaponItem(entry) ? entry.base : entry);

const round = (value, digits) => Math.round(value * 10 ** digits) / 10 ** digits;

// The standard weapon sold every week and fitted to starters.
export function standardWeapon(base) {
  const b = W.base[base];
  return {
    item: 'weapon',
    uid: `std-${base}`,
    base,
    rarity: 'uncommon',
    name: base === 'cannon' ? 'Basic Cannon' : b.name,
    damage: [...b.damage],
    cooldown: b.cooldown,
    accuracy: b.accuracy,
    crit: b.crit,
    pen: b.pen,
    range: b.range,
    ...(b.burst ? { burst: b.burst } : {}),
    ...(b.channel ? { channel: b.channel, tick: b.tick, base1: b.base, amp: b.amp } : {}),
    traits: [],
  };
}

export function rollRarity(rng) {
  return weightedPick(rng, RARITIES, (r) => W.rarity[r].chance);
}

export function rollWeapon(rng, base, rarity = rollRarity(rng)) {
  const b = W.base[base];
  const R = W.rarity[rarity];
  const jitter = () => randRange(rng, 0.92, 1.08);
  const dmg = jitter() * R.stat;
  const pool = shuffle(
    rng,
    Object.keys(W.traits).filter((t) => !W.traits[t].only || W.traits[t].only.includes(base)),
  );
  const traits = pool.slice(0, R.traits);
  const weapon = {
    item: 'weapon',
    uid: uid(rng, 'wpn'),
    base,
    rarity,
    name: '',
    damage: [Math.round(b.damage[0] * dmg), Math.round(b.damage[1] * dmg)],
    cooldown: round((b.cooldown * jitter()) / (1 + (R.stat - 1) * 0.6), 2),
    accuracy: round(Math.min(0.99, b.accuracy * jitter() + (R.stat - 1) * 0.15), 3),
    crit: round(b.crit * jitter() + (R.stat - 1) * 0.1, 3),
    pen: round(Math.min(0.9, b.pen * jitter() + (R.stat - 1) * 0.3), 3),
    range: round(b.range * jitter() * (1 + (R.stat - 1) * 0.5), 2),
    traits,
  };
  if (b.burst) weapon.burst = b.burst;
  if (b.channel) {
    // Lightning improves by channel time, ramp (amp) and base damage rather than by the hit.
    weapon.damage = [1, 1];
    weapon.channel = round(b.channel + (R.stat - 1) * 2.5, 2);
    weapon.tick = b.tick;
    weapon.base1 = b.base + (R.stat >= 1.2 ? 1 : 0);
    weapon.amp = b.amp + (R.stat >= 1.35 ? 1 : 0);
  }
  const prefix = traits.length ? W.traits[traits[0]].name.replace(' Shot', '') : rarity === 'uncommon' ? 'Standard' : pick(rng, ['Fine', 'Forged', 'Tempered']);
  weapon.name = `${prefix} ${b.name}`;
  return weapon;
}

// Everything the race needs about a fitted weapon, traits applied.
export function weaponStats(entry) {
  const w = isWeaponItem(entry) ? entry : standardWeapon(entry);
  const s = {
    damage: [...w.damage],
    cooldown: w.cooldown,
    accuracy: w.accuracy,
    crit: w.crit,
    critMult: W.critMult,
    pen: w.pen,
    range: w.range ?? W.base[w.base].range,
    echoEvery: 0,
    rounds: 0,
    chargeExtra: 0,
    burst: w.burst ?? W.base[w.base].burst ?? 0,
    channel: w.channel ?? W.base[w.base].channel ?? 0,
    tick: w.tick ?? W.base[w.base].tick ?? 0,
    base: w.base1 ?? W.base[w.base].base ?? 0,
    amp: w.amp ?? W.base[w.base].amp ?? 0,
    burn: 0,
    poison: 0,
    // Boot-up: rarer weapons come online a little sooner.
    boot: { ...B.COMBAT.boot[w.base], mult: 1 / (1 + ({ uncommon: 0, rare: 0.1, epic: 0.2, legendary: 0.35 }[w.rarity] ?? 0)) },
  };
  for (const id of w.traits ?? []) {
    const t = W.traits[id];
    if (!t) continue;
    if (t.critMult) s.critMult += t.critMult;
    if (t.range) s.range = round(s.range * (1 + t.range), 2);
    if (t.echoEvery) s.echoEvery = t.echoEvery;
    if (t.pen) s.pen = Math.min(0.95, s.pen + t.pen);
    if (t.accuracy) s.accuracy = Math.min(0.99, s.accuracy + t.accuracy);
    if (t.cooldown) s.cooldown = round(s.cooldown * (1 + t.cooldown), 2);
    if (t.crit) s.crit += t.crit;
    if (t.rounds) s.rounds += t.rounds;
    if (t.damage) s.damage = s.damage.map((d) => Math.round(d * (1 + t.damage)));
    if (t.charge) s.chargeExtra += t.charge;
    if (t.burst) s.burst += t.burst;
    if (t.channel) s.channel += t.channel;
    if (t.amp) s.amp += t.amp;
    if (typeof t.base === 'number') s.base += t.base;
    if (t.burn) s.burn += t.burn;
    if (t.poison) s.poison += t.poison;
    if (t.bootMult) s.boot.mult *= t.bootMult;
    if (t.bootOnHit) s.boot.onHit = true;
  }
  return s;
}

export function weaponPrice(entry) {
  const w = isWeaponItem(entry) ? entry : standardWeapon(entry);
  return Math.round((B.MODULES[w.base].price * W.rarity[w.rarity].price) / 50) * 50;
}

export const weaponLabel = (entry) => (isWeaponItem(entry) ? entry.name : standardWeapon(entry).name);

// This week's rolled weapons in the armory. The same week always gives the same offers.
export function armoryOffers(week) {
  const rng = makeRng((week * 2246822519 + 97) >>> 0);
  const [lo, hi] = B.WEEK.armoryOffers;
  const n = lo + Math.floor(rng() * (hi - lo + 1));
  const rarities = Array.from({ length: n }, () => rollRarity(rng));
  // At least one offer each week has a trait, so there is always something to want.
  if (rarities.every((r) => r === 'uncommon')) rarities[0] = 'rare';
  return rarities.map((rarity, i) => ({ ...rollWeapon(rng, pick(rng, WEAPON_BASES), rarity), uid: `week${week}-${i}` }));
}
