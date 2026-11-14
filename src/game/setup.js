import { talent } from './captain.js';
import { B } from './balance.js';
import { activeLoco } from './conductor.js';
import { MODELS, cargoFits, deriveStats, makeBenchmark, topSpeedFor } from './locomotives.js';
import { companyById, companyRecord, jobPay, jobXp } from './jobs.js';
import { hashSeed, makeCourse } from './course.js';
import { phoenixForSale } from './economy.js';
import { planTrip } from './race.js';
import { traitPower } from './traits.js';
import { estimateBand } from './estimate.js';
import { expressJob } from './routemap.js';
import { bossById, bossState, bountyJob } from './bosses.js';
import { realWait } from './calendar.js';
import { openDone, openField, openJob } from './open.js';

// A "run" is anything that ends on the race screen. Its context is a small object:
//   { kind: 'test' }                              the first run against Benchmark
//   { kind: 'delivery', jobId }                   a simple job from the board
//   { kind: 'company', companyId, jobId }         a job paid for with contracts
//   { kind: 'contract', contractId }              a race for a company's contracts
//   { kind: 'race', raceId }                      a prize race from the board
//   { kind: 'demo' }                              Phoenix test drive
//   { kind: 'express' }                           the current leg of an express run
//   { kind: 'bounty', bossId }                    a boss hunt from the bounty board
//   { kind: 'open', openId }                      a World Open event
// Deliveries and contract jobs also carry `haul`: how many containers the player pulls.

export function findRun(conductor, ctx) {
  const board = conductor.board;
  if (ctx.kind === 'delivery') return board?.simple.find((job) => job.id === ctx.jobId) ?? null;
  if (ctx.kind === 'company') return board?.company[ctx.companyId]?.find((job) => job.id === ctx.jobId) ?? null;
  if (ctx.kind === 'contract') return board?.contracts.find((contract) => contract.id === ctx.contractId) ?? null;
  if (ctx.kind === 'race') return board?.races?.find((race) => race.id === ctx.raceId) ?? null;
  if (ctx.kind === 'express') return expressJob(conductor);
  if (ctx.kind === 'bounty') return bountyJob(conductor, ctx.bossId);
  if (ctx.kind === 'open') return openJob(conductor, ctx.openId);
  return null;
}

function rivalFromSpec(spec, playerLoco, cargoLb, distance, index, course) {
  const loco = {
    id: `rival-${index + 1}`,
    model: spec.model,
    name: MODELS[spec.model].name,
    rarity: 'uncommon',
    power: Math.max(1, playerLoco.power + spec.offset.power),
    efficiency: Math.max(1, playerLoco.efficiency + spec.offset.efficiency),
    durability: Math.max(1, playerLoco.durability + spec.offset.durability),
    endurance: Math.max(1, (playerLoco.endurance ?? 5) + (spec.offset.endurance ?? 0)),
    hpBase: spec.hpBase,
    tqBase: spec.tqBase,
    growth: spec.growth,
    // Rivals keep pace with whatever the player has bolted on.
    upgrades: playerLoco.upgrades,
    superTrait: null,
    fit: spec.fit ?? ['cannon', 'fuel'],
    condition: 1,
  };
  const stats = deriveStats(loco, { str: spec.str, agi: spec.agi, end: spec.end ?? spec.agi, traits: [] });
  const plan = planTrip(stats, cargoLb, distance, course);
  return {
    id: loco.id,
    name: spec.name,
    locoName: loco.name,
    model: spec.model,
    stats,
    cargoLb,
    lever: spec.lever,
    fuel: Math.min(stats.tank, Math.ceil(plan.gallons * 1.2)),
  };
}

// The first run's Benchmark: a better-graded locomotive than yours (same model, more stat points)
// with a weak conductor at the controls. Its power is tuned so that on the line, loaded the same,
// it comes out about 10% slower than you: your conductor makes the difference.
const loadedTop = (stats, cargoLb) => topSpeedFor(stats.hp, stats.weight + cargoLb + 30 * B.LOCO.fuelLbPerGallon);
export function firstRunRival(loco, conductor, cargoLb) {
  const T = B.RACE.testRace.benchmark;
  const crew = {
    str: Math.max(1, Math.round((conductor.str ?? 0) * T.crewShare)),
    agi: Math.max(1, Math.round((conductor.agi ?? 0) * T.crewShare)),
    int: Math.max(1, Math.round((conductor.int ?? 0) * T.crewShare)),
    end: Math.max(1, Math.round((conductor.end ?? 0) * T.crewShare)),
    traits: [],
  };
  const yours = loadedTop(deriveStats(loco, conductor), cargoLb);
  const make = (powerDelta) => ({
    ...makeBenchmark(),
    model: loco.model,
    rarity: 'rare',
    fixedWeight: undefined,
    hpBase: loco.hpBase,
    tqBase: loco.tqBase,
    growth: loco.growth,
    power: Math.max(1, loco.power + powerDelta),
    efficiency: loco.efficiency + T.extraPoints,
    durability: loco.durability + T.extraPoints,
    endurance: (loco.endurance ?? 5) + T.extraPoints,
  });
  let best = null;
  for (let delta = -3; delta <= 3; delta++) {
    const bench = make(delta);
    const ratio = loadedTop(deriveStats(bench, crew), cargoLb) / yours;
    if (!best || Math.abs(ratio - T.ratio) < Math.abs(best.ratio - T.ratio)) best = { bench, ratio };
  }
  // Fine-tune the engine so it lands right on the target: about 10% slower than you on the line.
  const bench = { ...best.bench, hpBase: best.bench.hpBase * (T.ratio / best.ratio), tqBase: best.bench.tqBase * (T.ratio / best.ratio) };
  best.ratio = loadedTop(deriveStats(bench, crew), cargoLb) / yours;
  return {
    loco: bench,
    crew,
    stats: deriveStats(bench, crew),
    raw: deriveStats(bench),
    yourRaw: deriveStats(loco),
    ratio: best.ratio,
  };
}

// Everything the setup screen shows and the race needs, worked out once.
export function describeRun(conductor, ctx) {
  const loco = activeLoco(conductor);
  let playerLoco = loco;
  let title = '';
  let subtitle = '';
  let distance = 0;
  let weight = 0;
  let containers = 0;
  let timeLimit = null;
  let rivals = [];
  let job = null;
  let blocked = null;
  let courseSeed = ctx.kind;
  let theme = null;
  let boulders = [];
  let haul = 0;
  let pay = null;
  let xp = null;
  let tutorial = null;
  let boss = null;
  const owned = conductor.containers ?? 0;

  if (ctx.kind === 'test') {
    title = 'First run';
    subtitle = 'Beat Benchmark over 25 miles';
    distance = B.RACE.testRace.miles;
    weight = B.RACE.testRace.cargoLb;
    courseSeed = 'first-run';
    tutorial = firstRunRival(loco, conductor, weight);
    const { stats } = tutorial;
    const plan = planTrip(stats, weight, distance, makeCourse(courseSeed, distance));
    rivals = [{ id: 'benchmark', name: 'Benchmark', locoName: 'Company test engine', model: 'benchmark', stats, cargoLb: weight, lever: 1, fuel: Math.ceil(plan.gallons * 1.3) }];
  } else if (ctx.kind === 'demo') {
    playerLoco = phoenixForSale();
    title = 'Phoenix test drive';
    subtitle = `The Iron Phoenix against your ${loco.name}`;
    distance = B.RACE.demo.miles;
    weight = B.RACE.demo.cargoLb;
    courseSeed = 'test-drive';
    const stats = deriveStats(loco, conductor);
    rivals = [{ id: 'own', name: `Your ${loco.name}`, model: loco.model, locoName: 'Simulated', stats, cargoLb: weight * stats.cargoFactor, lever: 1, fuel: stats.tank }];
  } else {
    job = findRun(conductor, ctx);
    if (!job) return null;
    title = job.title;
    subtitle = `${job.from} to ${job.to}`;
    distance = job.distance;
    weight = job.weight;
    containers = job.containers;
    timeLimit = job.timeLimit ? job.timeLimit * (1 + talent(conductor, 'timeLimit')) : null;
    courseSeed = job.id;
    theme = job.theme ?? null;
    boulders = job.boulders ?? [];
    if (ctx.kind === 'bounty') {
      // A boss hunt: no freight, no rivals, no clock but the boss's own.
      boss = bossById(ctx.bossId);
      subtitle = `${job.from} – ${job.to} line`;
      const state = bossState(conductor, ctx.bossId);
      if (state.state === 'locked') blocked = `${state.why}.`;
      if (state.state === 'slain') blocked = `${boss.name} is down. It will be back on its line in ${realWait(state.backIn)}.`;
    } else if (ctx.kind === 'open') {
      // A World Open event: the field is the event's own, not matched to the player.
      const course = makeCourse(courseSeed, distance, theme);
      rivals = openField(ctx.openId).map((entry, index) => {
        const stats = deriveStats(entry.loco, entry.crew);
        const plan = planTrip(stats, 0, distance, course);
        return { id: `rival-${index + 1}`, name: entry.name, title: entry.title ?? null, locoName: entry.locoName, model: entry.model, stats, cargoLb: 0, lever: entry.lever, fuel: Math.min(stats.tank, Math.ceil(plan.gallons * 1.25)), ability: entry.ability, champion: entry.champion };
      });
      if (openDone(conductor, ctx.openId)) blocked = 'You have run this event this week. It opens again with the new week.';
    } else if (ctx.kind !== 'contract' && ctx.kind !== 'race') {
      // Pull up to as many of the job's containers as you own.
      haul = job.containers === 0 ? 0 : Math.max(1, Math.min(job.containers, owned, ctx.haul ?? owned));
      weight = haul * (job.each ?? 0);
      pay = jobPay(job, haul);
      xp = jobXp(job, haul);
    }
    if (ctx.kind === 'contract' || ctx.kind === 'race') {
      const course = makeCourse(courseSeed, distance, theme);
      rivals = job.rivals.map((spec, index) => rivalFromSpec(spec, loco, weight, distance, index, course));
    }
    if (ctx.kind === 'company' && companyRecord(conductor, ctx.companyId).contracts < job.cost) {
      blocked = `You need ${job.cost} contract${job.cost === 1 ? '' : 's'} with ${companyById(ctx.companyId).name}.`;
    }
  }

  const stats = deriveStats(playerLoco, conductor);
  const cargoLb = weight * stats.cargoFactor;
  const fits = ctx.kind === 'demo' || ctx.kind === 'test' || cargoFits(stats, weight);
  if (!fits && !blocked) {
    blocked = `Too heavy. ${Math.round(cargoLb).toLocaleString()} lb of cargo against a towing capacity of ${Math.round(stats.tow).toLocaleString()} lb.`;
  }
  const course = makeCourse(courseSeed, distance, theme);
  const plan = planTrip(stats, cargoLb, distance, course);
  return {
    ctx,
    job,
    course,
    courseSeed,
    boulders,
    haul,
    owned,
    towUse: stats.tow > 0 ? cargoLb / stats.tow : 0,
    pay,
    xp,
    title,
    subtitle,
    distance,
    weight,
    containers,
    timeLimit,
    loco: playerLoco,
    stats,
    cargoLb,
    plan,
    rivals,
    boss,
    blocked,
    tutorial,
    freeFuel: ctx.kind === 'demo',
    maxLoad: ctx.kind === 'demo' ? stats.tank : Math.min(stats.tank, Math.floor(conductor.fuel.gallons)),
  };
}

export function buildRaceConfig(conductor, run, fuelGallons) {
  return {
    kind: run.ctx.kind,
    title: run.title,
    // Spells are in play wherever there are rivals to race, except the test drive.
    combat: (run.rivals.length > 0 && run.ctx.kind !== 'demo') || run.boulders.length > 0 || !!run.boss,
    boss: run.boss ?? null,
    // The first run is a guided lesson: weapons are ready from the flag.
    guide: run.ctx.kind === 'test',
    bootInstant: run.ctx.kind === 'test',
    course: run.course,
    obstacles: run.boulders,
    distance: run.distance,
    timeLimit: run.timeLimit,
    freeFuel: run.freeFuel,
    player: {
      name: conductor.name,
      locoName: run.loco.name,
      model: run.loco.model,
      stats: run.stats,
      fuel: run.freeFuel ? run.stats.tank : fuelGallons,
      cargoLb: run.cargoLb,
      lever: 1,
      competitive: run.rivals.length ? traitPower(conductor, 'competitive') : 0,
      pitCrew: traitPower(conductor, 'pitcrew'),
      ability: run.stats.ability,
      band: estimateBand(conductor),
      lt: conductor.lt,
      mpRegen: 1 + conductor.int * B.COMBAT.mpRegenPerInt * (1 + traitPower(conductor, 'influencer')),
    },
    rivals: run.rivals,
  };
}
