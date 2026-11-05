import { gripFor, hillGripFor } from './course.js';
import { talent } from './captain.js';
import { B } from './balance.js';
import { clamp, pick, randInt, randRange, uid } from './rng.js';
import { traitPower } from './traits.js';
import { baseOf, weaponStats } from './weapons.js';

export const MODELS = {
  tank: {
    name: 'Tank',
    blurb: 'A heavy hauler. Tough, slow to tire, built to move weight.',
    bonus: { durability: 2, endurance: 2 },
    perk: '+2 Armor, +2 Endurance, +1 Capacity slot',
  },
  bullet: {
    name: 'Bullet',
    blurb: 'Lives to go fast and drinks fuel doing it.',
    bonus: { power: 2, efficiency: -1, endurance: -1 },
    perk: '+2 Power, -1 Efficiency, -1 Endurance',
  },
  stable: {
    name: 'Stable',
    blurb: 'The all-rounder. Nothing flashy, nothing missing.',
    bonus: { efficiency: 2 },
    perk: '+2 Efficiency',
  },
  longrun: {
    name: 'Long Run',
    blurb: 'Sips fuel and runs cool across long distances. Gentle on power.',
    bonus: { power: -2, efficiency: 3, endurance: 4 },
    perk: '-2 Power, +3 Efficiency, +4 Endurance',
  },
  scrappy: {
    name: 'Scrappy',
    blurb: 'Rough around the edges and never loses its value.',
    bonus: {},
    perk: 'Sells for its full price',
  },
  wizard: {
    name: 'The Storm Magus',
    blurb: 'A rune-carved engine that calls lightning down on whatever runs beside it.',
    bonus: {},
    perk: 'Bolt and Barrier spells',
    mythic: true,
  },
  titan: {
    name: 'The Iron Titan',
    blurb: 'A walking fortress on rails. Nine cargo slots and a hull nothing else can match.',
    bonus: {},
    perk: 'Barrier spell, +1,200 HP, 9 slots',
    mythic: true,
  },
  dragon: {
    name: 'The Ember Wyrm',
    blurb: 'A dragon bound to a boiler. It breathes fire hotter than any spell-caster.',
    bonus: {},
    perk: 'Dragonfire and Barrier',
    mythic: true,
  },
  phoenix: {
    name: 'The Iron Phoenix',
    blurb: 'A mythical engine reborn from embers. It drains the speed of whatever runs beside it.',
    bonus: {},
    perk: 'Siphon Speed',
  },
};

export const STARTER_MODELS = ['tank', 'bullet', 'stable', 'longrun', 'scrappy'];

// Extra perks a Legendary locomotive can carry. Each has a real effect in deriveStats.
export const SUPER_TRAITS = {
  velocity: { name: 'Velocity Master', text: '+10% top speed', hp: 1.1 },
  titan: { name: 'Titan Engine', text: '+25% torque', tq: 1.25 },
  savant: { name: 'Fuel Savant', text: '+15% fuel economy', tmpg: 1.15 },
  hauler: { name: 'Heavy Hauler', text: 'Ignores 25% of cargo weight', cargo: 0.75 },
};

export const UPGRADE_TYPES = {
  engine: { name: 'Engine', gives: 'horsepower and torque', research: 'engine' },
  aero: { name: 'Aerodynamics', gives: 'fuel economy', research: 'efficiency' },
  body: { name: 'Body reinforcement', gives: 'towing capacity', research: 'structure' },
  tank: { name: 'Cargo frame', gives: 'one more Capacity slot', research: 'structure' },
};

export function rollRarity(rng) {
  const roll = rng();
  const r = B.RARITY;
  if (roll < r.legendary.chance) return 'legendary';
  if (roll < r.legendary.chance + r.epic.chance) return 'epic';
  if (roll < r.legendary.chance + r.epic.chance + r.rare.chance) return 'rare';
  return 'uncommon';
}

export function priceOf(loco) {
  if (loco.model === 'phoenix') return B.STATION.phoenixPrice;
  if (B.MYTHIC[loco.model]?.price) return B.MYTHIC[loco.model].price;
  const p = B.PRICE;
  let base = loco.power * p.power + loco.efficiency * p.efficiency + loco.durability * p.durability + (loco.endurance ?? 0) * p.efficiency;
  for (const stat of [loco.power, loco.efficiency, loco.durability, loco.endurance ?? 0]) {
    if (stat > 8) base *= Math.pow(p.over8, stat - 8);
  }
  return Math.floor(base * B.RARITY[loco.rarity].priceMult);
}

// Builds a locomotive. The horsepower and torque rolls are made once here and stored,
// so a locomotive's numbers never change behind the player's back.
export function generateLoco(rng, modelId, options = {}) {
  const model = MODELS[modelId];
  const rarity = options.rarity ?? rollRarity(rng);
  const [min, max] = B.RARITY[rarity].range;
  const bonus = model.bonus;
  const stat = (key) => options[key] ?? Math.max(1, randInt(rng, min, max) + (bonus[key] ?? 0));
  const loco = {
    id: uid(rng, 'loco'),
    model: modelId,
    name: model.name,
    rarity,
    power: stat('power'),
    efficiency: stat('efficiency'),
    durability: stat('durability'),
    endurance: stat('endurance'),
    hpBase: Math.round(options.hpBase ?? randRange(rng, ...B.LOCO.hpBase)),
    tqBase: Math.round(options.tqBase ?? randRange(rng, ...B.LOCO.tqBase)),
    growth: options.growth ?? Math.round(randRange(rng, ...B.LOCO.growth) * 1000) / 1000,
    upgrades: { engine: [], aero: [], body: [], tank: [] },
    superTrait: null,
    ability: options.ability ?? null,
    fit: options.fit ?? [], // modules fitted in the cargo slots
    condition: 1, // durability: wears down with use, back to 1 when repaired
  };
  if (rarity === 'legendary' && !model.mythic && modelId !== 'phoenix') {
    loco.superTrait = pick(rng, Object.keys(SUPER_TRAITS));
  }
  // An Epic or Legendary Long Run is the Journey: it gathers strength with every 5 miles.
  if (modelId === 'longrun' && (rarity === 'epic' || rarity === 'legendary')) {
    loco.name = 'The Journey';
    loco.journey = true;
  }
  loco.price = priceOf(loco);
  return loco;
}

export function makePhoenix(rng) {
  return generateLoco(rng, 'phoenix', {
    rarity: 'legendary',
    power: 15,
    efficiency: 12,
    durability: 18,
    endurance: 14,
    hpBase: 1750,
    tqBase: 3875,
    growth: 1.095,
    ability: 'siphon',
  });
}

// The Storm Magus, the Iron Titan and the Ember Wyrm: fixed engines for the very late game.
export function makeMythic(rng, modelId) {
  const m = B.MYTHIC[modelId];
  return generateLoco(rng, modelId, { rarity: m.rarity, power: m.power, efficiency: m.efficiency, durability: m.durability, endurance: m.endurance ?? 10, hpBase: m.hpBase, tqBase: m.tqBase, growth: m.growth });
}
export const MYTHIC_MODELS = ['wizard', 'titan', 'dragon'];

// The fixed opponent of the first run: Power, Efficiency and Durability all 5, 20,000 lb.
export function makeBenchmark() {
  return {
    id: 'benchmark',
    model: 'stable',
    name: 'Benchmark',
    rarity: 'uncommon',
    power: 5,
    efficiency: 5,
    durability: 5,
    endurance: 5,
    hpBase: 1750,
    tqBase: 3875,
    growth: 1.095,
    upgrades: { engine: [], aero: [], body: [], tank: [] },
    superTrait: null,
    ability: null,
    fit: ['cannon', 'fuel'],
    condition: 1,
    fixedWeight: 20000,
    price: 0,
  };
}

const product = (gains) => gains.reduce((total, gain) => total * (1 + gain), 1);

export function attributeBonus(conductor, key) {
  if (!conductor) return 0;
  const points = conductor[key] ?? 0;
  return points * B.ATTR.perPoint * (1 + traitPower(conductor, 'influencer'));
}

// Spells come with the engine, never from the shop: Epic engines know one, Legendary all three,
// and the mythic engines their own.
export function spellsOf(loco) {
  const mythic = B.MYTHIC[loco.model];
  if (mythic?.spells) return mythic.spells;
  if (loco.rarity === 'legendary') return B.SPELLS.legendary;
  if (loco.rarity === 'epic') return [B.SPELLS.epicByModel[loco.model] ?? 'fire'];
  return [];
}

export function capacityOf(loco) {
  const base = B.MYTHIC[loco.model]?.capacity ?? B.LOCO.capacity[loco.rarity] ?? 4;
  return base + (loco.model === 'tank' ? 1 : 0) + (loco.upgrades?.tank ?? []).length;
}

export const fitOf = (loco) => loco.fit ?? [];
export const slotsUsed = (fit) => fit.reduce((total, entry) => total + (B.MODULES[baseOf(entry)]?.slots ?? 0), 0);

// What a list of fitted modules adds up to.
export function loadoutOf(fit) {
  const M = B.MODULES;
  const ids = fit.map(baseOf);
  const count = (id) => ids.filter((item) => item === id).length;
  // Weapons can be doubled up: each gets its own key ('cannon', 'cannon#2', ...) and its own reload.
  const weapons = [];
  const seen = {};
  for (const id of ids) {
    if (!M[id]?.arm) continue;
    if ((id === 'shield' && seen.shield) || (id === 'vent' && seen.vent)) continue;
    seen[id] = (seen[id] ?? 0) + 1;
    weapons.push(seen[id] === 1 ? id : `${id}#${seen[id]}`);
  }
  const C = B.COMBAT;
  const gunKinds = Object.keys(C.magazine);
  const ammoWeapons = ids.filter((id) => gunKinds.includes(id));
  const electric = count('plasma') + count('shield') + count('arc') + count('vent');
  // Each weapon's own attributes, keyed like the arms ('launcher', 'cannon#2', ...).
  const weaponStatsByKind = {};
  let extraUnits = 0;
  const n = {};
  for (const entry of fit) {
    const id = baseOf(entry);
    if (!B.WEAPONS.base[id]) continue;
    n[id] = (n[id] ?? 0) + 1;
    const s = { ...weaponStats(entry), name: typeof entry === 'object' ? entry.name : null };
    weaponStatsByKind[n[id] === 1 ? id : `${id}#${n[id]}`] = s;
    // Deep Magazine: extra rounds, counted in this weapon's own ammo units.
    extraUnits += (s.rounds ?? 0) * (C[id]?.cost ?? 0);
  }
  return {
    weaponStats: weaponStatsByKind,
    weight: ids.reduce((total, id) => total + (M[id]?.weight ?? 0), 0),
    fuel: count('fuel') * M.fuel.fuel,
    power: Math.pow(1 + M.engine.power, count('engine')),
    weapons,
    // Ammo units: a cannonball takes 3, a missile 2. Ammo Storage holds 30 (10 balls or 15 missiles).
    ammo: ammoWeapons.length > 0 ? ammoWeapons.reduce((t, id) => t + C.magazine[id], 0) + extraUnits + count('ammo') * M.ammo.ammo : 0,
    charge: electric > 0 ? B.COMBAT.chargeBase + count('battery') * M.battery.charge : 0,
    sight: Math.max(B.RADAR.sight, ...ids.map((id) => M[id]?.sight ?? 0)),
  };
}

// Everything the race and the screens need to know about a locomotive, in one place.
// `conductor` may be null (shop window, or a locomotive nobody is driving).
export function deriveStats(loco, conductor = null) {
  const L = B.LOCO;
  const strength = attributeBonus(conductor, 'str');
  const agility = Math.min(0.5, attributeBonus(conductor, 'agi'));
  const superTrait = loco.superTrait ? SUPER_TRAITS[loco.superTrait] : null;
  const up = loco.upgrades ?? {};

  const fit = fitOf(loco);
  const kit = loadoutOf(fit);
  const condition = clamp(loco.condition ?? 1, 0, 1);
  const worn = L.wearPerformanceFloor + (1 - L.wearPerformanceFloor) * condition;

  const growth = Math.pow(loco.growth, loco.power - 1);
  const engine = product(up.engine ?? []) * kit.power * worn;
  // Captain talents (NFT edition): Engineering power and the Masterwork capstone. 0 in Lite.
  const capPower = 1 + talent(conductor, 'power') + talent(conductor, 'masterwork');
  const hp = loco.hpBase * growth * engine * (1 + strength) * (superTrait?.hp ?? 1) * capPower;
  const tq = loco.tqBase * growth * engine * (1 + strength) * (superTrait?.tq ?? 1) * capPower;

  const extra = (B.MYTHIC[loco.model]?.extraWeight ?? 0) + (B.FRONTS[loco.front ?? 'cowcatcher']?.weight ?? 0);
  const weight = loco.fixedWeight ?? (L.weightBase + L.weightPerDurability * loco.durability + extra + kit.weight) * (1 - agility);

  const tmpgRaw = L.tmpgBase + L.tmpgPerEfficiency * loco.efficiency + L.tmpgPerPower * loco.power;
  const tmpg = Math.max(L.tmpgMin, tmpgRaw) * product(up.aero ?? []) * (1 + agility) * (superTrait?.tmpg ?? 1);

  const tank = L.tankBase + kit.fuel;
  const tow = hp * (L.towBase + loco.durability) * product(up.body ?? []) * (1 + talent(conductor, 'tow'));

  // Cargo this conductor and locomotive can shrug off (Elevate, Heavy Hauler).
  const elevate = clamp(traitPower(conductor, 'elevate') * 0.15, 0, 0.6);
  const cargoFactor = (1 - elevate) * (superTrait?.cargo ?? 1);

  // Headline speed figures are quoted with a standard load, since no run is ever empty.
  const lightWeight = weight + L.quoteCargoLb + 100 * L.fuelLbPerGallon;
  return {
    hp,
    tq,
    weight,
    tmpg,
    tank,
    tow,
    cargoFactor,
    grip: conductor ? Math.min(B.TRACK.gripMax + 0.15, gripFor(conductor.agi ?? 0, traitPower(conductor, 'influencer')) + talent(conductor, 'grip')) : 0,
    hillGrip: conductor ? Math.min(0.85, hillGripFor(conductor.str ?? 0, traitPower(conductor, 'influencer')) + (talent(conductor, 'masterwork') > 0 ? 0.5 : 0)) : 0,
    // Endurance: the locomotive's and the conductor's both cut the heat each mile builds.
    endurance: loco.endurance ?? 5,
    heatMult:
      (1 / (1 + (loco.endurance ?? 5) * B.HEAT.perLocoEnd + (conductor?.end ?? 0) * B.HEAT.perCondEnd * (1 + (conductor ? traitPower(conductor, 'influencer') : 0)))) *
      (1 - 0.2 * (conductor ? traitPower(conductor, 'marathoner') : 0)) *
      (1 - Math.min(0.5, talent(conductor, 'cool'))),
    overHeatMult: 1 - talent(conductor, 'overHeat'),
    bootMult: 1 / (1 + talent(conductor, 'boot')),
    dotMult: 1 + talent(conductor, 'dot'),
    spellCdMult: 1 - Math.min(0.4, talent(conductor, 'spellCd')),
    mpCostMult: 1 - talent(conductor, 'breakthrough'),
    mpRegenMult: 1 + talent(conductor, 'mp'),
    coolMult: 1 + 0.25 * (conductor ? traitPower(conductor, 'marathoner') : 0),
    secondWind: conductor ? traitPower(conductor, 'secondwind') : 0,
    journey: !!loco.journey,
    // Intelligence sharpens spells.
    spellPower: (1 + (conductor?.int ?? 0) * B.COMBAT.spellPerInt * (1 + (conductor ? traitPower(conductor, 'influencer') : 0))) * (1 + talent(conductor, 'spell')),
    accel: (1 + (conductor?.agi ?? 0) * L.accelPerAgi * (1 + (conductor ? traitPower(conductor, 'influencer') : 0))) * (1 + talent(conductor, 'accel')),
    topSpeed: topSpeedFor(hp, lightWeight),
    accelSeconds: accelSecondsFor(tq, lightWeight) / B.TIME_SCALE / (1 + (conductor?.agi ?? 0) * L.accelPerAgi),
    accelMiles: ((accelSecondsFor(tq, lightWeight) / (1 + (conductor?.agi ?? 0) * L.accelPerAgi)) * topSpeedFor(hp, lightWeight) * 0.55) / 3600,
    hull: Math.round(
      (B.COMBAT.hullBase + B.COMBAT.hullPerDurability * loco.durability + (B.MYTHIC[loco.model]?.hullBonus ?? 0)) * (L.wearHullFloor + (1 - L.wearHullFloor) * condition) * (1 + talent(conductor, 'hull')),
    ),
    ability: loco.ability,
    condition,
    capacity: capacityOf(loco),
    slotsUsed: slotsUsed(fit),
    moduleWeight: kit.weight,
    weapons: kit.weapons,
    spells: spellsOf(loco),
    arms: [...spellsOf(loco), ...kit.weapons],
    ammo: kit.ammo,
    charge: Math.round(kit.charge * (1 + talent(conductor, 'charge'))),
    chargeRegenMult: 1 + talent(conductor, 'charge'),
    weaponStats: kit.weaponStats,
    sight: kit.sight * (1 + talent(conductor, 'sight')),
    front: loco.front ?? 'cowcatcher',
    armor: Math.min(B.ARMOR.max, B.ARMOR.perPoint * loco.durability),
  };
}

export const topSpeedFor = (hp, weightLb) => hp * B.LOCO.mphPerHp * (B.LOCO.refWeight / weightLb);

// Game seconds from standstill to top speed.
export const accelSecondsFor = (tq, weightLb) =>
  B.LOCO.accelRefSeconds * (weightLb / B.LOCO.refWeight) * (B.LOCO.accelRefTorque / tq);

export const cargoFits = (stats, cargoLb) => cargoLb * stats.cargoFactor <= stats.tow;

// What a locomotive does with a given load on board: top speed, time to top speed, and fuel per mile
// at a steady 100% lever. cargoLb is the weight as the engine feels it (after cargoFactor).
export function quoteLoad(stats, cargoLb, fuelGallons) {
  const weight = stats.weight + cargoLb + fuelGallons * B.LOCO.fuelLbPerGallon;
  return {
    weight,
    cargo: cargoLb,
    topSpeed: topSpeedFor(stats.hp, weight),
    accelSeconds: accelSecondsFor(stats.tq, weight) / B.TIME_SCALE / (stats.accel ?? 1),
    // Roughly how many miles of straight it takes to reach top speed from a standstill.
    accelMiles: ((accelSecondsFor(stats.tq, weight) / (stats.accel ?? 1)) * topSpeedFor(stats.hp, weight) * 0.55) / 3600,
    galPerMile: weight / 2000 / stats.tmpg,
    towUse: stats.tow > 0 ? cargoLb / stats.tow : 0,
    // Wear per 100 miles at this load, as a fraction.
    wearPer100: 100 * B.LOCO.wearPerMile * (1 + B.LOCO.wearPerLoad * Math.min(1.5, stats.tow > 0 ? cargoLb / stats.tow : 0)),
  };
}

export function resaleValue(loco) {
  return Math.floor(loco.price * (loco.model === 'scrappy' ? 1 : B.LOCO.resale));
}

export const upgradeStage = (loco, type) => (loco.upgrades?.[type] ?? []).length;
