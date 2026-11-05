import { B } from './balance.js';
import { activeLoco } from './conductor.js';
import { deriveStats } from './locomotives.js';
import { makeCourse, hashSeed } from './course.js';
import { makeRng, pick, randInt, randRange } from './rng.js';
import { FIRST_NAMES, LAST_NAMES } from './conductor.js';
import { STARTER_MODELS } from './locomotives.js';
import { planTrip } from './race.js';
import { traitPower } from './traits.js';
import { estimateBand } from './estimate.js';

// The Locomotive Festival: every three months, three contests, each entered once per festival.
export const CONTESTS = {
  pull: {
    name: 'Max Pull',
    blurb: 'Haul the heaviest load you dare over 3 miles in 15 minutes on the line. The heavier the load you bring home, the bigger the prize.',
    miles: 3,
    timeLimit: 15 * 60, // game seconds
    tiers: [
      { at: 70000, medal: 'gold' },
      { at: 40000, medal: 'silver' },
      { at: 20000, medal: 'bronze' },
    ],
  },
  speed: {
    name: 'Speed Race',
    blurb: 'Ten miles of bends against the fastest crews at the fair. No weapons: just pull, nerve and the lever.',
    miles: 10,
    rivals: 5,
  },
  wall: {
    name: 'Damage Wall',
    blurb: 'A 5,000 HP armored boulder and a stopwatch. Your train stays put; bring it down as fast as you can. The fair keeps your guns loaded.',
    hp: 5000,
    armor: 0.2,
    at: 0.3, // miles ahead of the start
    seconds: 480, // real seconds before the judges call time
    rounds: 400, // ammo units the fair hands out
    tiers: [
      { at: 180, medal: 'gold' },
      { at: 300, medal: 'silver' },
      { at: 480, medal: 'bronze' },
    ],
  },
};

export const PRIZES = {
  gold: { lt: 1500, xp: 400, weapon: 'epic' },
  silver: { lt: 750, xp: 250, weapon: 'rare' },
  bronze: { lt: 300, xp: 150, weapon: null },
  none: { lt: 0, xp: 50, weapon: null },
};

function festivalField(conductor, festivalId) {
  const rng = makeRng(hashSeed(`festival-${festivalId}`));
  const loco = activeLoco(conductor);
  return Array.from({ length: CONTESTS.speed.rivals }, (_, i) => {
    const model = pick(rng, STARTER_MODELS);
    const rival = {
      id: `fair-${i + 1}`,
      model,
      name: model,
      rarity: 'uncommon',
      power: Math.max(1, loco.power + randInt(rng, 0, 1)),
      efficiency: loco.efficiency,
      durability: Math.max(1, loco.durability + randInt(rng, -1, 0)),
      hpBase: Math.round(randRange(rng, ...B.LOCO.hpBase)),
      tqBase: Math.round(randRange(rng, ...B.LOCO.tqBase)),
      growth: Math.round(randRange(rng, ...B.LOCO.growth) * 1000) / 1000,
      upgrades: loco.upgrades,
      fit: ['fuel'],
      condition: 1,
    };
    const stats = deriveStats(rival, { str: randInt(rng, 8, 16), agi: randInt(rng, 8, 16), traits: [] });
    return { id: rival.id, name: `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`, locoName: model[0].toUpperCase() + model.slice(1), model, stats, cargoLb: 0, lever: Math.round(randRange(rng, 1, 1.08) * 100) / 100, fuel: stats.tank };
  });
}

// A race config for a contest. `cargoLb` is the Max Pull load.
export function contestConfig(conductor, contestId, festivalId, { cargoLb = 0 } = {}) {
  const c = CONTESTS[contestId];
  const loco = activeLoco(conductor);
  const stats = deriveStats(loco, conductor);
  const player = {
    name: conductor.name,
    locoName: loco.name,
    model: loco.model,
    stats,
    fuel: stats.tank,
    cargoLb: 0,
    lever: 1,
    lt: conductor.lt,
    competitive: 0,
    band: estimateBand(conductor),
    mpRegen: 1 + conductor.int * B.COMBAT.mpRegenPerInt * (1 + traitPower(conductor, 'influencer')),
  };
  if (contestId === 'pull') {
    return { kind: 'pull', title: `Festival: ${c.name}`, distance: c.miles, timeLimit: c.timeLimit, freeFuel: true, courseSeed: `pull-${festivalId}`, player: { ...player, cargoLb: cargoLb * stats.cargoFactor }, rivals: [] };
  }
  if (contestId === 'speed') {
    const course = makeCourse(`speed-${festivalId}`, c.miles);
    const rivals = festivalField(conductor, festivalId).map((r) => ({ ...r, fuel: Math.ceil(planTrip(r.stats, 0, c.miles, course).gallons * 1.3) }));
    return { kind: 'speed', title: `Festival: ${c.name}`, distance: c.miles, freeFuel: true, course, combat: false, player: { ...player, competitive: traitPower(conductor, 'competitive') }, rivals };
  }
  // The wall: the fair hands out rounds, so even a starter cannon can take part.
  const ammo = stats.ammo > 0 ? Math.max(stats.ammo, c.rounds) : 0;
  return {
    kind: 'wall',
    bootInstant: true,
    title: `Festival: ${c.name}`,
    distance: 1,
    timeLimit: c.seconds * B.TIME_SCALE,
    freeFuel: true,
    combat: true,
    obstacles: [{ at: c.at, hp: c.hp, armor: c.armor }],
    player: { ...player, parked: true, stats: { ...stats, ammo } },
    rivals: [],
  };
}

// The medal a result earns.
export function medalFor(contestId, result) {
  const c = CONTESTS[contestId];
  if (result.reason === 'forfeit') return 'none';
  if (contestId === 'pull') {
    if (result.reason !== 'finished') return 'none';
    const lb = result.contestLoad ?? 0;
    return c.tiers.find((t) => lb >= t.at)?.medal ?? 'none';
  }
  if (contestId === 'speed') return result.place === 1 ? 'gold' : result.place === 2 ? 'silver' : result.place === 3 ? 'bronze' : 'none';
  if (result.reason !== 'smashed') return 'none';
  return c.tiers.find((t) => result.realSeconds <= t.at)?.medal ?? 'none';
}
