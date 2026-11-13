import { B } from './balance.js';
import { FIRST_NAMES, LAST_NAMES, activeLoco } from './conductor.js';
import { STARTER_MODELS, deriveStats } from './locomotives.js';
import { hashSeed, makeCourse } from './course.js';
import { makeRng, pick, randRange } from './rng.js';
import { planTrip } from './race.js';
import { traitPower } from './traits.js';
import { estimateBand } from './estimate.js';
import { rivalKit } from './jobs.js';

// The Proving Grounds: three trials that are always open. Each is a short run with its own rules
// and three medals. Fuel and rounds are on the house, nothing is kept or lost but the medal.

export const TRIAL_IDS = ['gauntlet', 'timetrial', 'brawl'];
export const MEDALS = ['none', 'bronze', 'silver', 'gold'];
export const trialRecord = (conductor, id) => conductor.trials?.[id] ?? { medal: 'none', best: null, runs: 0 };

// The raiders of the Iron Brawl: the same five every time, built to a fixed grade so a stronger
// engine does better against them.
function raiders(courseOf) {
  const T = B.TRIALS.brawl;
  const rng = makeRng(hashSeed('trial-brawl-raiders'));
  return Array.from({ length: T.rivals }, (_, i) => {
    const model = pick(rng, STARTER_MODELS);
    const loco = {
      id: `raider-${i + 1}`,
      model,
      name: model,
      rarity: 'uncommon',
      power: T.rival.power,
      efficiency: T.rival.efficiency,
      durability: T.rival.durability,
      endurance: T.rival.endurance,
      hpBase: Math.round(randRange(rng, ...B.LOCO.hpBase)),
      tqBase: Math.round(randRange(rng, ...B.LOCO.tqBase)),
      growth: 1.095,
      upgrades: { engine: [], aero: [], body: [], tank: [] },
      fit: rivalKit(rng),
      condition: 1,
    };
    const stats = deriveStats(loco, { str: T.rival.attr, agi: T.rival.attr, end: T.rival.attr, traits: [] });
    return { id: loco.id, name: `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`, locoName: 'Raider', model, stats, cargoLb: 0, lever: Math.round(randRange(rng, 0.94, 1.02) * 100) / 100, fuel: Math.ceil(planTrip(stats, 0, T.miles, courseOf).gallons * 1.4) };
  });
}

// A race config for a trial, driven with the conductor's own locomotive.
export function trialConfig(conductor, id) {
  const t = B.TRIALS[id];
  const loco = activeLoco(conductor);
  const stats = deriveStats(loco, conductor);
  const course = makeCourse(`trial-${id}`, t.miles, 'plains');
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
    ability: id === 'timetrial' ? null : stats.ability,
  };
  const base = { kind: 'trial', trial: id, title: `Trial: ${t.name}`, distance: t.miles, freeFuel: true, course, player, rivals: [] };
  if (id === 'gauntlet') return { ...base, combat: true, obstacles: t.obstacles, timeLimit: t.seconds * B.TIME_SCALE };
  if (id === 'brawl') return { ...base, combat: true, rivals: raiders(course), player: { ...player, competitive: traitPower(conductor, 'competitive') } };
  return { ...base, combat: false };
}

// What a result scores in a trial: the number its medals are judged on.
export function trialScore(id, result) {
  if (id === 'gauntlet') return (result.bouldersSmashed ?? 0) + (result.bouldersCrushed ?? 0);
  if (id === 'brawl') return result.kills ?? 0;
  return result.realSeconds;
}

// The medal a result earns. Every trial must be finished on the rails.
export function trialMedal(id, result) {
  const t = B.TRIALS[id];
  if (result.reason !== 'finished') return 'none';
  const score = trialScore(id, result);
  const tier = id === 'timetrial' ? t.tiers.find((item) => score <= item.at) : t.tiers.find((item) => score >= item.at);
  return tier?.medal ?? 'none';
}

// Is `a` a better result than `b` in this trial?
export const betterScore = (id, a, b) => b === null || b === undefined || (id === 'timetrial' ? a < b : a > b);
