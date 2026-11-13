import { describe, expect, it } from 'vitest';
import { B } from '../src/game/balance.js';
import { makeRng } from '../src/game/rng.js';
import { TRAITS, traitPower, ACTIVE_TRAIT_IDS } from '../src/game/traits.js';
import { buildConductor, dealOffers, picksAllowed, picksUsed, rerollsAllowed, rollDice, xpForLevel, addXp, activeLoco, avgFuelCost } from '../src/game/conductor.js';
import { STARTER_MODELS, generateLoco, deriveStats, makeBenchmark, makePhoenix, makeMythic, cargoFits, priceOf, spellsOf, loadoutOf } from '../src/game/locomotives.js';
import { bendKeep, gripFor, makeCourse } from '../src/game/course.js';
import { createRace, startRace, stepRace, playerOf, planTrip, orderEmergencyFuel, setLever, forfeitRace, useAbility, playerCast, castBlocker, projectFinish, fireAll } from '../src/game/race.js';
import { generateSimpleJob, generateBoard, starsFor, jobPay, jobXp, entryFee } from '../src/game/jobs.js';
import { containerPrice, fuelMarket, researchRates, weeklyDeal } from '../src/game/economy.js';
import { dateOf, festivalInfo, runMinutes, weekOf } from '../src/game/calendar.js';
import { armoryOffers, rollWeapon, standardWeapon, weaponStats } from '../src/game/weapons.js';
import { estimateBand, estimateRange } from '../src/game/estimate.js';
import { CONTESTS, contestConfig, medalFor } from '../src/game/festival.js';
import * as actions from '../src/game/actions.js';
import { describeRun, buildRaceConfig } from '../src/game/setup.js';

const NOW = 1791480000000;
const offer = (id, rarity = 'normal') => ({ key: id, ids: [id], rarity });

function newConductor(chosen = [offer('leader')], attrs = { str: 12, agi: 10, int: 8 }, seed = 42) {
  const rng = makeRng(seed);
  const loco = generateLoco(rng, 'stable', { rarity: 'uncommon', power: 4, efficiency: 4, durability: 4, hpBase: 1750, tqBase: 3875, growth: 1.095 });
  const c = buildConductor({ name: 'Test Conductor', chosen, attributes: attrs, rerollsLeft: 1, loco, seed, now: NOW });
  actions.refreshWorld(c, { now: NOW });
  return c;
}

// A player who fights back about once a second: a shield when hurt and something is incoming,
// otherwise the biggest hit that is ready.
export function fightBack(race) {
  const player = playerOf(race);
  if (race.shots.some((s) => s.to === 'player') && player.hull < player.hullMax * 0.65 && (playerCast(race, 'barrier') || playerCast(race, 'shield'))) return;
  for (const kind of ['bolt', 'heavy', 'fire', 'cannon', 'plasma', 'launcher']) if (playerCast(race, kind)) return;
}

function runToEnd(race, onStep, { fight = true } = {}) {
  startRace(race);
  let guard = 0;
  let next = 1;
  while (race.status === 'running' && guard++ < 400000) {
    if (race.guide?.prompt) {
      (race.prompts ??= []).push(race.guide.prompt);
      race.guide.prompt = null;
    }
    stepRace(race, 0.1);
    if (fight && race.combat && race.real >= next) {
      next = race.real + 1;
      if (race.status === 'running') fightBack(race);
    }
    if (onStep) onStep(race);
  }
  return race.result;
}

describe('creation', () => {
  it('deals unique offers and respects picks', () => {
    const rng = makeRng(7);
    for (let i = 0; i < 200; i++) {
      const offers = dealOffers(rng, 8);
      const ids = offers.flatMap((o) => o.ids);
      expect(new Set(ids).size).toBe(ids.length);
      for (const o of offers) {
        if (o.rarity === 'infused') expect(o.ids.every((id) => TRAITS[id].scales)).toBe(true);
        if (o.rarity === 'profound') expect(TRAITS[o.ids[0]].scales).toBe(true);
        expect(o.ids.every((id) => ACTIVE_TRAIT_IDS.includes(id))).toBe(true);
      }
    }
    expect(picksAllowed([offer('prodigy')])).toBe(5);
    expect(picksUsed([offer('leader'), offer('lucky', 'gifted')])).toBe(1);
    expect(rerollsAllowed([offer('secondchances')])).toBe(5);
  });

  it('rolls six d20, or 3d6 for Mr. Consistent, with Lucky adding one', () => {
    const rng = makeRng(3);
    const plain = rollDice(rng, []);
    expect(plain).toHaveLength(B.START.dice);
    expect(plain.every((d) => d.value >= 1 && d.value <= 20 && d.parts.length === 1)).toBe(true);
    const consistent = rollDice(rng, [offer('consistent'), offer('lucky')]);
    expect(consistent.every((d) => d.parts.length === 3 && d.value === Math.min(20, d.parts[0] + d.parts[1] + d.parts[2] + 1))).toBe(true);
  });

  it('gives the starting kit', () => {
    const c = newConductor([offer('economist'), offer('prepared')]);
    expect(c.lt).toBe(Math.floor(500 * 1.25) + 25);
    expect(c.fuel.gallons).toBe(200 + 15 * 4);
    expect(avgFuelCost(c)).toBeCloseTo(2);
    const amplified = newConductor([offer('economist'), offer('amplify')]);
    expect(amplified.lt).toBe(Math.floor(500 * (1 + 0.25 * 1.5)) + 25);
    expect(traitPower(amplified, 'economist')).toBeCloseTo(1.5);
  });

  it('levels on the 1000 x 1.1 curve', () => {
    expect(xpForLevel(1)).toBe(1000);
    expect(xpForLevel(2)).toBe(1100);
    expect(xpForLevel(3)).toBe(1210);
    const c = newConductor();
    expect(addXp(c, 2200)).toBe(2);
    expect(c.level).toBe(3);
    expect(c.xp).toBe(100);
    expect(c.attributePoints).toBe(2);
  });
});

describe('locomotives', () => {
  it('derives sensible numbers for every starter', () => {
    const rng = makeRng(11);
    for (let i = 0; i < 300; i++) {
      const loco = generateLoco(rng, STARTER_MODELS[i % 5]);
      const s = deriveStats(loco, { str: 10, agi: 10, int: 10, traits: [] });
      for (const v of Object.values(s)) if (typeof v === 'number') expect(Number.isFinite(v)).toBe(true);
      expect(s.hp).toBeGreaterThan(1400);
      expect(s.topSpeed).toBeGreaterThan(12);
      expect(s.tmpg).toBeGreaterThanOrEqual(6);
      expect(loco.price).toBe(priceOf(loco));
    }
  });

  it('applies conductor attributes, Influencer and upgrades', () => {
    const loco = generateLoco(makeRng(1), 'stable', { rarity: 'uncommon', power: 4, efficiency: 4, durability: 4, hpBase: 1750, tqBase: 3875, growth: 1.095 });
    const base = deriveStats(loco);
    const strong = deriveStats(loco, { str: 20, agi: 0, int: 0, traits: [] });
    expect(strong.hp / base.hp).toBeCloseTo(1.1);
    const influencer = deriveStats(loco, { str: 20, agi: 0, int: 0, traits: [{ id: 'influencer', mult: 1 }] });
    expect(influencer.hp / base.hp).toBeCloseTo(1.2);
    const agile = deriveStats(loco, { str: 0, agi: 20, int: 0, traits: [] });
    expect(agile.weight / base.weight).toBeCloseTo(0.9);
    expect(base.tmpg).toBeCloseTo(16);
    loco.upgrades.engine = [0.05];
    expect(deriveStats(loco).hp / base.hp).toBeCloseTo(1.05);
    expect(base.weight).toBe(12000);
    expect(cargoFits(base, base.tow)).toBe(true);
    expect(cargoFits(base, base.tow + 1)).toBe(false);
  });
});

describe('race engine', () => {
  const stats = deriveStats(generateLoco(makeRng(1), 'stable', { rarity: 'uncommon', power: 4, efficiency: 4, durability: 4, hpBase: 1750, tqBase: 3875, growth: 1.095 }));

  it('finishes a 25 mile solo run in a sensible time and burns fuel', () => {
    const race = createRace({ kind: 'delivery', distance: 25, player: { name: 'p', stats, fuel: 100, cargoLb: 14000 } });
    const result = runToEnd(race);
    expect(result.finished).toBe(true);
    expect(result.realSeconds).toBeGreaterThan(40);
    expect(result.realSeconds).toBeLessThan(420); // heavy trains take miles to reach full speed
    expect(result.fuelUsed).toBeGreaterThan(10);
    expect(result.fuelUsed + result.fuelLeft).toBeCloseTo(100, 4);
    console.log('25mi/14k lb:', result.realSeconds.toFixed(1), 's real,', result.avgMph.toFixed(1), 'mph avg,', result.fuelUsed.toFixed(1), 'gal');
  });

  it('gets lighter and faster as fuel burns, heavier cargo is slower', () => {
    const light = planTrip(stats, 0, 50);
    const heavy = planTrip(stats, 20000, 50);
    expect(heavy.realSeconds).toBeGreaterThan(light.realSeconds * 1.5);
    expect(heavy.gallons).toBeGreaterThan(light.gallons * 1.5);
    console.log('50mi light:', light.realSeconds.toFixed(0), 's', light.gallons.toFixed(0), 'gal | heavy:', heavy.realSeconds.toFixed(0), 's', heavy.gallons.toFixed(0), 'gal');
  });

  it('the plan matches a real run', () => {
    const plan = planTrip(stats, 10000, 80);
    const race = createRace({ kind: 'delivery', distance: 80, player: { name: 'p', stats, fuel: Math.ceil(plan.gallons * 1.1), cargoLb: 10000 } });
    const result = runToEnd(race);
    expect(result.finished).toBe(true);
    expect(Math.abs(result.fuelUsed - plan.gallons) / plan.gallons).toBeLessThan(0.03);
    expect(Math.abs(result.realSeconds - plan.realSeconds) / plan.realSeconds).toBeLessThan(0.03);
  });

  it('Competitive: boost after 3 s in range, bigger after 10 s, gone when the gap opens', () => {
    const rival = { name: 'r', stats, fuel: 200, cargoLb: 0, lever: 1 };
    const race = createRace({ kind: 'contract', distance: 60, player: { name: 'p', stats, fuel: 200, cargoLb: 0, competitive: 1 }, rivals: [rival] });
    startRace(race);
    stepRace(race, 2.9);
    expect(race.competitive.boost).toBe(0);
    stepRace(race, 0.3);
    expect(race.competitive.boost).toBeCloseTo(0.05);
    expect(Math.abs(race.gap)).toBeLessThan(0.5);
    stepRace(race, 3.5);
    stepRace(race, 3.5);
    expect(race.competitive.boost).toBeCloseTo(0.08);
    // Throw the lever back so the rival pulls away.
    setLever(race, 0.5);
    let guard = 0;
    while (Math.abs(race.gap) <= 0.5 && guard++ < 5000) stepRace(race, 0.1);
    expect(race.gap).toBeLessThan(-0.5);
    expect(race.competitive.boost).toBe(0);
    expect(race.competitive.inRange).toBe(0);
    expect(race.place).toBe(2);
  });

  it('a boosted identical train wins', () => {
    const rival = { name: 'r', stats, fuel: 150, cargoLb: 5000, lever: 1 };
    const race = createRace({ kind: 'contract', distance: 30, player: { name: 'p', stats, fuel: 150, cargoLb: 5000, competitive: 1 }, rivals: [rival] });
    const result = runToEnd(race);
    expect(result.place).toBe(1);
    expect(result.field).toBe(2);
  });

  it('runs dry, takes emergency fuel and still arrives', () => {
    const race = createRace({ kind: 'delivery', distance: 40, player: { name: 'p', stats, fuel: 5, cargoLb: 14000, lt: 1000 } });
    let ordered = false;
    const result = runToEnd(race, (r) => {
      const p = playerOf(r);
      if (p.fuel <= 0 && !r.emergency && r.status === 'running') ordered = orderEmergencyFuel(r, 100) || ordered;
    });
    expect(ordered).toBe(true);
    expect(result.finished).toBe(true);
    expect(result.emergencyCost).toBeGreaterThanOrEqual(500);
  });

  it('fails a delivery at the time limit, and can be forfeited', () => {
    const race = createRace({ kind: 'delivery', distance: 100, timeLimit: 600, player: { name: 'p', stats, fuel: 200, cargoLb: 0 } });
    expect(runToEnd(race).reason).toBe('late');
    const other = createRace({ kind: 'delivery', distance: 100, player: { name: 'p', stats, fuel: 200, cargoLb: 0 } });
    startRace(other);
    stepRace(other, 3);
    forfeitRace(other);
    expect(other.result.reason).toBe('forfeit');
  });

  it('the overdrive lever is faster and thirstier', () => {
    const run = (lever) => {
      const race = createRace({ kind: 'delivery', distance: 40, player: { name: 'p', stats, fuel: 200, cargoLb: 8000, lever } });
      return runToEnd(race);
    };
    const normal = run(1);
    const over = run(1.1);
    const eased = run(0.6);
    expect(over.realSeconds).toBeLessThan(normal.realSeconds);
    expect(over.fuelUsed).toBeGreaterThan(normal.fuelUsed * 1.15);
    expect(eased.fuelUsed).toBeLessThan(normal.fuelUsed);
    expect(eased.realSeconds).toBeGreaterThan(normal.realSeconds * 1.4);
  });

  it('Siphon Speed slows the rival and can be used once', () => {
    const phoenix = deriveStats(makePhoenix(makeRng(5)));
    const race = createRace({ kind: 'contract', distance: 40, player: { name: 'p', stats: phoenix, fuel: 200, cargoLb: 0, ability: 'siphon' }, rivals: [{ name: 'r', stats, fuel: 200, cargoLb: 0 }] });
    startRace(race);
    stepRace(race, 12);
    const before = race.trains[1].vmax;
    expect(useAbility(race)).toBe(true);
    stepRace(race, 1);
    expect(race.trains[1].vmax).toBeLessThan(before * 0.95);
    expect(useAbility(race)).toBe(false);
  });

  it('the first run is a guided lesson: Benchmark is the better build, about 10% slower, and fighting back wins', () => {
    const rng = makeRng(99);
    let wins = 0;
    for (let i = 0; i < 25; i++) {
      const loco = generateLoco(rng, STARTER_MODELS[i % 5], { rarity: 'uncommon' });
      const c = buildConductor({ name: 'x', chosen: [], attributes: { str: 8 + (i % 7), agi: 8 + (i % 5), int: 10, end: 6 }, rerollsLeft: 0, loco, seed: i + 1, now: NOW });
      const run = describeRun(c, { kind: 'test' });
      const T = run.tutorial;
      // A better-graded locomotive with a weaker conductor, slower on the line.
      expect(T.loco.efficiency + T.loco.durability).toBeGreaterThan(loco.efficiency + loco.durability);
      expect(T.crew.agi).toBeLessThan(c.agi);
      expect(T.ratio).toBeGreaterThan(0.84);
      expect(T.ratio).toBeLessThan(0.96);
      const race = createRace(buildRaceConfig(c, run, Math.ceil(run.plan.gallons * 1.3)));
      const result = runToEnd(race);
      expect(race.prompts).toEqual(['bend', 'weapons', 'camera']);
      expect(race.trains[1].crippled).toBe(true);
      if (result.place === 1) wins++;
    }
    expect(wins).toBe(25);
  });
});

describe('weapons and spells', () => {
  const duel = (extra = {}, arms = ['fire', 'bolt', 'barrier']) => {
    const loco = makeBenchmark();
    const stats = deriveStats(loco);
    const spec = { name: 'Rival', locoName: 'Benchmark', stats, fuel: 200, cargoLb: 0, lever: 1 };
    return createRace({ kind: 'test', title: 't', distance: 25, combat: true, bootInstant: true, seed: 5, player: { name: 'You', locoName: 'B', stats, arms, fuel: 200, cargoLb: 0 }, rivals: [{ ...spec, id: 'r1' }], ...extra });
  };

  it('only Epic and Legendary engines know spells; weapons come from the slots', () => {
    const rng = makeRng(3);
    expect(spellsOf(generateLoco(rng, 'bullet', { rarity: 'rare' }))).toEqual([]);
    expect(spellsOf(generateLoco(rng, 'bullet', { rarity: 'epic' }))).toEqual(['bolt']);
    expect(spellsOf(generateLoco(rng, 'stable', { rarity: 'legendary' }))).toEqual(['fire', 'bolt', 'barrier', 'frost']);
    expect(spellsOf(makeMythic(rng, 'dragon'))).toContain('fire');
    expect(spellsOf(makeMythic(rng, 'wizard'))).toContain('bolt');
    const stats = deriveStats(makeBenchmark());
    expect(stats.arms).toEqual(['cannon']);
    expect(stats.ammo).toBe(9); // 3 cannonballs at 3 ammo units each
  });

  it('costs MP, starts a cooldown and needs a rival in range', () => {
    const race = duel();
    startRace(race);
    expect(playerCast(race, 'fire')).toBe(true);
    const player = playerOf(race);
    expect(player.mp).toBe(B.COMBAT.mpMax - B.COMBAT.fire.cost);
    expect(castBlocker(race, player, 'fire')).toBe('Reloading');
    expect(castBlocker(race, player, 'cannon')).toBe('Not fitted');
    race.trains[1].distance = 5;
    expect(castBlocker(race, player, 'bolt')).toBe('Nothing in range');
    expect(playerCast(race, 'barrier')).toBe(true); // Barrier needs no target
  });

  it('a Basic Cannon carries 3 rounds; Ammo Storage holds 10 more balls; missiles carry no ammo', () => {
    const race = duel({}, ['cannon']);
    race.trains[0].ammo = race.trains[0].ammoMax = 9;
    startRace(race);
    race.trains[1].think = 999;
    for (let i = 0; i < 3; i++) {
      expect(playerCast(race, 'cannon')).toBe(true);
      stepRace(race, B.COMBAT.cannon.cooldown / 2 + 0.05);
      stepRace(race, B.COMBAT.cannon.cooldown / 2 + 0.05);
      race.trains[1].distance = playerOf(race).distance;
    }
    expect(castBlocker(race, playerOf(race), 'cannon')).toBe('Out of ammo');
    const kit = loadoutOf(['cannon', 'ammo', 'ammo']);
    expect(kit.ammo).toBe(9 + 60);
    expect(loadoutOf(['launcher']).ammo).toBe(0); // missiles burn fuel instead
    expect(kit.weight).toBe(2500 + 1200);
  });

  it('lands damage after the travel time, and Barrier cuts it', () => {
    const race = duel();
    startRace(race);
    const rival = race.trains[1];
    rival.think = 999;
    playerCast(race, 'bolt');
    expect(rival.hull).toBe(rival.hullMax);
    stepRace(race, 1);
    const open = rival.hullMax - rival.hull;
    expect(open).toBeGreaterThanOrEqual(B.COMBAT.bolt.damage[0]);
    expect(race.fx.some((f) => f.type === 'hit')).toBe(true);
    rival.barrier = 5;
    rival.barrierCut = B.COMBAT.barrier.cut;
    const before = rival.hull;
    playerOf(race).cooldown.bolt = 0;
    playerOf(race).mp = 100;
    playerCast(race, 'bolt');
    stepRace(race, 1);
    expect(before - rival.hull).toBeLessThan(B.COMBAT.bolt.damage[1] * B.COMBAT.critMult * (1 - B.COMBAT.barrier.cut) + 1);
  });

  it('a train at 0 HP leaves the rails and finishes last; the player derailed ends the race', () => {
    const race = duel();
    startRace(race);
    race.trains[1].hull = 1;
    race.trains[1].think = 999;
    playerCast(race, 'fire');
    stepRace(race, 2);
    expect(race.trains[1].out).toBe(true);
    const result = runToEnd(race, null, { fight: false });
    expect(result.place).toBe(1);
    expect(result.rivalsDerailed).toBe(1);

    const lost = duel();
    startRace(lost);
    playerOf(lost).hull = 1;
    lost.shots.push({ id: 1, kind: 'fire', from: 'r1', to: 'player', left: 0.1, total: 0.1 });
    stepRace(lost, 1);
    expect(lost.status).toBe('finished');
    expect(lost.result.reason).toBe('derailed');
    expect(lost.result.place).toBe(2);
  });

  it('test drives have no fighting', () => {
    const race = duel({ combat: false });
    startRace(race);
    expect(playerCast(race, 'fire')).toBe(false);
  });

  it('boulders must be shot down or they hurt the train', () => {
    const stats = deriveStats(makeBenchmark());
    const make = () => createRace({ kind: 'delivery', distance: 5, combat: true, bootInstant: true, seed: 9, obstacles: [2], player: { name: 'You', stats, fuel: 100, cargoLb: 0 } });
    const crash = make();
    const result = runToEnd(crash, null, { fight: false });
    expect(result.crashes).toBe(1);
    expect(result.damageTaken).toBeGreaterThanOrEqual(B.HAZARD.sizes.boulder.crash * 0.8);
    const clear = make();
    clear.obstacles[0].hp = 1;
    const cleared = runToEnd(clear);
    expect(cleared.crashes).toBe(0);
    expect(cleared.bouldersSmashed).toBe(1);
    expect(cleared.gameSeconds).toBeLessThan(result.gameSeconds);
  });
});

describe('obstacles, radar, fronts and doubled-up weapons', () => {
  const stats = deriveStats(makeBenchmark());
  it('comes in sizes; a strong front crushes small ones for free', () => {
    const run = (front, size) => {
      const race = createRace({ kind: 'delivery', distance: 5, combat: true, bootInstant: true, seed: 2, obstacles: [{ at: 2, size }], player: { name: 'x', stats: { ...stats, front }, fuel: 100 } });
      return runToEnd(race, null, { fight: false });
    };
    expect(run('cowcatcher', 'debris').damageTaken).toBeGreaterThan(0);
    expect(run('plow', 'debris').damageTaken).toBe(0);
    expect(run('plow', 'debris').bouldersCrushed).toBe(1);
    expect(run('ram', 'large').damageTaken).toBeLessThan(run('cowcatcher', 'large').damageTaken * 0.6);
    expect(run('cowcatcher', 'large').damageTaken).toBeGreaterThan(run('cowcatcher', 'boulder').damageTaken);
  });

  it('a weapon only fires at an obstacle once it is spotted and in range', () => {
    const make = (sight) => {
      const race = createRace({ kind: 'delivery', distance: 10, combat: true, bootInstant: true, seed: 2, obstacles: [{ at: 0.9, size: 'boulder' }], player: { name: 'x', stats: { ...stats, sight, ammo: 9 }, fuel: 100 } });
      startRace(race);
      stepRace(race, 0.05);
      return race;
    };
    const blind = make(0.5);
    expect(castBlocker(blind, playerOf(blind), 'cannon')).toBe('Nothing in range');
    const sharp = make(2.5);
    expect(castBlocker(sharp, playerOf(sharp), 'cannon')).toBe(null);
    expect(loadoutOf(['radar2']).sight).toBe(12);
  });

  it('two cannons have their own reloads, and Fire All fires everything ready', () => {
    const kit = loadoutOf(['cannon', { ...standardWeapon('cannon'), uid: 'b' }, 'plasma']);
    expect(kit.weapons).toEqual(['cannon', 'cannon#2', 'plasma']);
    expect(kit.ammo).toBe(18);
    const race = createRace({ kind: 'test', distance: 25, combat: true, bootInstant: true, seed: 4, player: { name: 'x', stats: { ...stats, ammo: 18, charge: 40, weaponStats: kit.weaponStats }, arms: kit.weapons, fuel: 100 }, rivals: [{ id: 'r1', name: 'R', stats, fuel: 100 }] });
    startRace(race);
    race.trains[1].think = 1e9;
    expect(fireAll(race)).toBe(3);
    expect(castBlocker(race, playerOf(race), 'cannon#2')).toBe('Reloading');
    expect(playerOf(race).ammo).toBe(12);
  });

  it('rolled weapons carry a range, and Long Barrel stretches it', () => {
    const rng = makeRng(8);
    const w = rollWeapon(rng, 'heavy', 'rare');
    expect(w.range).toBeGreaterThan(3.9);
    expect(weaponStats({ ...standardWeapon('cannon'), traits: ['longshot'] }).range).toBeCloseTo(4.86);
  });

  it('busier jobs have a mix of obstacles', () => {
    const rng = makeRng(31);
    let total = 0;
    let jobs = 0;
    let large = 0;
    for (let i = 0; i < 400; i++) {
      const job = generateSimpleJob(rng);
      if (job.title === 'Mail run') continue;
      jobs++;
      total += job.boulders.length;
      large += job.boulders.filter((b) => b.size === 'large' || b.size === 'giant').length;
      expect(job.boulders.length).toBeLessThanOrEqual(B.HAZARD.count.max);
    }
    expect(total / jobs).toBeGreaterThan(4);
    expect(large).toBeGreaterThan(50);
  });
});

describe('bends', () => {
  it('slow every train to the limit, and a strong engine climbs back out faster', () => {
    const course = { ...makeCourse('bend-test', 40), hills: [] }; // bends only
    expect(course.bends.length).toBeGreaterThan(2);
    for (const bend of course.bends) expect(bend.end).toBeGreaterThan(bend.start);
    const base = deriveStats(makeBenchmark());
    const fast = { ...base, hp: base.hp * 3, tq: base.tq };
    let slowest = Infinity;
    const race = createRace({ kind: 'plan', distance: 40, course, player: { name: 'x', stats: fast, fuel: 200, cargoLb: 0 } });
    runToEnd(race, (r) => {
      const p = playerOf(r);
      const bend = course.bends.find((b) => p.distance >= b.start && p.distance < b.end);
      if (bend) slowest = Math.min(slowest, bendKeep(bend, p.grip) * p.vmax - p.speed);
    });
    expect(slowest).toBeGreaterThan(-4); // never over a bend's limit (one physics step of slack)
    const straight = planTrip(fast, 0, 40).gameSeconds;
    const bendy = planTrip(fast, 0, 40, course).gameSeconds;
    expect(bendy).toBeGreaterThan(straight);
    // Same top speed, more torque: back up to speed out of every bend far sooner.
    const torquey = { ...fast, tq: fast.tq * 2.5 };
    expect(planTrip(torquey, 0, 40, course).gameSeconds).toBeLessThan(bendy * 0.85);
  });

  it('long sweeping bends; Agility holds more speed, most of all in sharp ones', () => {
    const course = makeCourse('mountain-line', 200);
    const gentle = course.bends.filter((b) => b.kind === 'gentle');
    expect(gentle.length).toBeGreaterThan(0);
    for (const b of gentle) expect(b.end - b.start).toBeGreaterThanOrEqual(3.5);
    const sharp = { curve: 1.2 };
    const easy = { curve: 0.12 };
    const lo = gripFor(5);
    const hi = gripFor(20);
    expect(bendKeep(sharp, hi)).toBeGreaterThan(bendKeep(sharp, lo));
    // the gain from Agility is bigger in the sharp bend than the gentle one
    expect(bendKeep(sharp, hi) - bendKeep(sharp, lo)).toBeGreaterThan(bendKeep(easy, hi) - bendKeep(easy, lo));
    // with Agility 18: about 85% in a sweep and 70% in a sharp bend; less without
    expect(bendKeep(easy, gripFor(18))).toBeGreaterThan(0.82);
    expect(bendKeep(easy, gripFor(18))).toBeLessThan(0.88);
    expect(bendKeep({ curve: 1.0 }, gripFor(18))).toBeGreaterThan(0.68);
    expect(bendKeep({ curve: 1.0 }, gripFor(18))).toBeLessThan(0.75);
    expect(bendKeep(easy, 0)).toBeLessThan(0.8);
  });
});

describe('loadout, durability and containers', () => {
  it('Capacity slots limit what fits, and every module has weight', () => {
    const c = newConductor();
    c.lt = 100000;
    const loco = activeLoco(c);
    expect(loco.fit).toEqual(['launcher', 'fuel']);
    const before = deriveStats(loco, c);
    expect(before.capacity).toBeGreaterThanOrEqual(4);
    expect(before.tank).toBe(B.LOCO.tankBase + 60);
    actions.buyModule(c, { id: 'ammo', fit: true });
    const after = deriveStats(activeLoco(c), c);
    expect(after.weight - before.weight).toBeCloseTo(600 * (1 - Math.min(0.5, 10 * 0.005)));
    expect(after.ammo).toBe(0); // the starter launcher burns fuel: Ammo Storage only feeds cannons
    while (deriveStats(activeLoco(c), c).capacity - deriveStats(activeLoco(c), c).slotsUsed > 0) actions.buyModule(c, { id: 'fuel', fit: true });
    expect(() => actions.buyModule(c, { id: 'fuel', fit: true })).toThrow(/free slot/);
    expect(c.gear.fuel).toBe(1);
    actions.unfitModule(c, { index: 0 });
    expect(c.arsenal).toHaveLength(1); // the launcher is now an item on the shelf
    expect(c.arsenal[0].name).toBe('Missile Launcher');
  });

  it('fuel is heavy: a full tank is a slower train', () => {
    const stats = deriveStats(makeBenchmark());
    const light = planTrip({ ...stats, tank: 400 }, 0, 25);
    const race = createRace({ kind: 'plan', distance: 25, player: { name: 'x', stats: { ...stats, weight: 12000 }, fuel: 400, cargoLb: 0 } });
    const heavy = runToEnd(race, null, { fight: false });
    const race2 = createRace({ kind: 'plan', distance: 25, player: { name: 'x', stats: { ...stats, weight: 12000 }, fuel: 40, cargoLb: 0 } });
    const lean = runToEnd(race2, null, { fight: false });
    expect(lean.gameSeconds).toBeLessThan(heavy.gameSeconds);
    expect(light.gallons).toBeGreaterThan(0);
  });

  it('durability wears about 1% per 100 miles and costs performance; repairs restore it', () => {
    const c = newConductor();
    const loco = activeLoco(c);
    const fresh = deriveStats(loco, c);
    loco.condition = 0.5;
    const worn = deriveStats(loco, c);
    expect(worn.hp).toBeLessThan(fresh.hp);
    expect(worn.hull).toBeLessThan(fresh.hull);
    c.lt = 100000;
    actions.repairLoco(c, { pct: 100 });
    expect(activeLoco(c).condition).toBe(1);
    // Fifty 100-mile runs at a typical 40% of towing capacity leave about half.
    expect(1 - 50 * 100 * B.LOCO.wearPerMile * (1 + B.LOCO.wearPerLoad * 0.4)).toBeCloseTo(0.46, 1);
  });

  it('jobs pay a fee plus a rate per container; you can only pull containers you own', () => {
    const job = { containers: 3, fee: 50, perContainer: 100, hazard: 0 };
    expect(jobPay(job, 1)).toBe(150);
    expect(jobPay(job, 3)).toBe(350);
    expect(jobPay(job, 9)).toBe(350);
    const c = newConductor();
    c.lt = 5000;
    const pick = c.board.simple.find((j) => j.containers >= 2 && cargoFits(deriveStats(activeLoco(c), c), j.each * 2));
    if (!pick) return;
    const ctx = { kind: 'delivery', jobId: pick.id, haul: 2 };
    expect(describeRun(c, ctx).haul).toBe(1); // only one owned
    actions.buyContainer(c);
    expect(c.lt).toBe(5000 - containerPrice(c));
    const run = describeRun(c, ctx);
    expect(run.haul).toBe(2);
    const result = { kind: 'delivery', reason: 'finished', finished: true, place: 1, field: 1, distance: pick.distance, underLimitPct: 0, fuelLoaded: 0, fuelUsed: 0, fuelLeft: 0, emergencyGallons: 0, emergencyCost: 0, towUse: run.towUse };
    const receipt = actions.settleRun(c, { ctx, result, now: NOW });
    expect(receipt.lines[0].lt).toBe(jobPay(pick, 2));
  });

  it('pulling near the towing limit wears the engine faster', () => {
    const settle = (towUse) => {
      const c = newConductor();
      const result = { kind: 'test', reason: 'finished', finished: true, place: 1, field: 2, distance: 100, underLimitPct: 0, fuelLoaded: 0, fuelUsed: 0, fuelLeft: 0, emergencyGallons: 0, emergencyCost: 0, towUse };
      return actions.settleRun(c, { ctx: { kind: 'test' }, result, now: NOW }).wear;
    };
    expect(settle(0)).toBeCloseTo(100 * B.LOCO.wearPerMile, 6);
    expect(settle(1)).toBeCloseTo(100 * B.LOCO.wearPerMile * (1 + B.LOCO.wearPerLoad), 6);
  });

  it('the ETA matches the time the run actually takes', () => {
    const stats = deriveStats(makeBenchmark());
    const course = makeCourse('eta', 15);
    const race = createRace({ kind: 'delivery', distance: 15, course, player: { name: 'x', stats, fuel: 80, cargoLb: 0 } });
    startRace(race);
    stepRace(race, 3);
    const eta = projectFinish(race);
    const at = race.real;
    runToEnd(race, null, { fight: false });
    expect(Math.abs(at + eta.realSeconds - race.result.realSeconds)).toBeLessThan(1.5);
    const dry = createRace({ kind: 'delivery', distance: 15, course, player: { name: 'x', stats, fuel: 2, cargoLb: 0 } });
    startRace(dry);
    stepRace(dry, 1);
    expect(projectFinish(dry).dryAt).toBeGreaterThan(0);
  });
});

describe('calendar, weeks and festivals', () => {
  it('counts days, months and years, and holds a festival every three months', () => {
    const d = dateOf(0);
    expect([d.day, d.month, d.year]).toEqual([1, 1, 1]);
    const day = 24 * 60;
    expect(dateOf(30 * day).month).toBe(2);
    expect(dateOf(360 * day).year).toBe(2);
    expect(festivalInfo(0).active).toBe(false);
    expect(dateOf(festivalInfo(0).nextAt).month).toBe(3);
    expect(festivalInfo(60 * day).active).toBe(true); // Month 3, Day 1
    expect(festivalInfo(63 * day).active).toBe(false); // Day 4
    expect(dateOf(festivalInfo(63 * day).nextAt).month).toBe(6);
    // About 60 runs between festivals.
    expect(90 / (runMinutes(4 * 3600) / day)).toBeGreaterThan(55);
    expect(90 / (runMinutes(4 * 3600) / day)).toBeLessThan(75);
  });

  it('a run moves the calendar, and a new week turns over the board and station', () => {
    const c = newConductor();
    const board = c.board;
    const station = c.station.stock[0].id;
    const job = c.board.simple.find((j) => j.containers > 0);
    const result = { kind: 'delivery', reason: 'finished', finished: true, place: 1, field: 1, distance: job.distance, gameSeconds: 4 * 3600, underLimitPct: 0, fuelLoaded: 0, fuelUsed: 0, fuelLeft: 0, emergencyGallons: 0, emergencyCost: 0 };
    const start = c.clock;
    actions.settleRun(c, { ctx: { kind: 'delivery', jobId: job.id }, result, now: NOW });
    expect(c.clock - start).toBe(runMinutes(4 * 3600));
    actions.rest(c, { hours: 24 * 7 });
    expect(c.board).not.toBe(board);
    expect(c.board.week).toBe(weekOf(c.clock));
    expect(c.station.stock[0].id).not.toBe(station);
  });

  it('weekly armory offers and deals are the same all week and change week to week', () => {
    expect(armoryOffers(5).map((w) => w.uid)).toEqual(armoryOffers(5).map((w) => w.uid));
    expect(armoryOffers(5)[0].name).not.toBe(armoryOffers(6)[0].name + 'x');
    let deals = 0;
    for (let w = 0; w < 100; w++) if (weeklyDeal(w)) deals++;
    expect(deals).toBeGreaterThan(70);
    for (let w = 0; w < 50; w++) expect(armoryOffers(w).some((o) => o.rarity !== 'uncommon')).toBe(true);
  });

  it('festival contests: the wall is a parked train against a 5,000 HP armored boulder', () => {
    const c = newConductor();
    const config = contestConfig(c, 'wall', '1-3');
    expect(config.obstacles[0].hp).toBe(5000);
    const race = createRace(config);
    const result = runToEnd(race);
    expect(playerOf(race).distance).toBe(0);
    expect(['smashed', 'late']).toContain(result.reason);
    expect(medalFor('wall', { reason: 'smashed', realSeconds: 50 })).toBe('gold');
    expect(medalFor('wall', { reason: 'late', realSeconds: 180 })).toBe('none');
    expect(medalFor('pull', { reason: 'finished', contestLoad: 45000 })).toBe('silver');
    expect(medalFor('speed', { reason: 'finished', place: 3 })).toBe('bronze');
    const speed = contestConfig(c, 'speed', '1-3');
    expect(speed.rivals).toHaveLength(CONTESTS.speed.rivals);
    expect(speed.combat).toBe(false);
  });
});

describe('weapon attributes', () => {
  it('rarity adds traits and better numbers', () => {
    const rng = makeRng(11);
    expect(rollWeapon(rng, 'cannon', 'uncommon').traits).toHaveLength(0);
    expect(rollWeapon(rng, 'cannon', 'rare').traits).toHaveLength(1);
    expect(rollWeapon(rng, 'cannon', 'legendary').traits).toHaveLength(3);
    const lethal = weaponStats({ ...standardWeapon('cannon'), traits: ['lethal'] });
    expect(lethal.critMult).toBeCloseTo(B.WEAPONS.critMult + 0.5);
  });

  it('accuracy can miss, armor cuts damage, penetration ignores armor, and Echoing Shot fires an extra round every third shot', () => {
    const stats = deriveStats(makeBenchmark());
    const mk = (weapon, armor) => {
      const ws = weaponStats(weapon);
      return createRace({ kind: 'test', distance: 25, combat: true, bootInstant: true, seed: 3, player: { name: 'You', stats: { ...stats, ammo: 99, weaponStats: { cannon: ws } }, arms: ['cannon'], fuel: 200 }, rivals: [{ id: 'r1', name: 'R', stats: { ...stats, armor, hull: 99999 }, fuel: 200 }] });
    };
    const shoot = (race, n) => {
      startRace(race);
      race.trains[1].think = 1e9;
      for (let i = 0; i < n; i++) {
        race.trains[0].cooldown.cannon = 0;
        race.trains[1].distance = race.trains[0].distance;
        playerCast(race, 'cannon');
        stepRace(race, 1.2);
      }
      return race;
    };
    const blind = shoot(mk({ ...standardWeapon('cannon'), accuracy: 0 }, 0), 5);
    expect(blind.trains[0].misses).toBe(5);
    const plain = shoot(mk({ ...standardWeapon('cannon'), accuracy: 1, crit: 0, pen: 0 }, 0.4), 6).trains[1].taken;
    const pierce = shoot(mk({ ...standardWeapon('cannon'), accuracy: 1, crit: 0, pen: 1 }, 0.4), 6).trains[1].taken;
    expect(pierce).toBeGreaterThan(plain * 1.4);
    const echo = shoot(mk({ ...standardWeapon('cannon'), accuracy: 1, traits: ['echo'] }, 0), 6);
    expect(echo.trains[0].hits).toBe(8); // 6 shots + 2 echoes
    expect(echo.trains[0].roundsFired).toBe(18); // ammo units: 6 cannonballs at 3 each
  });
});

describe('estimates', () => {
  it('always contain the true value and narrow with Intelligence', () => {
    const dim = estimateBand({ int: 1, traits: [] });
    const bright = estimateBand({ int: 20, traits: [] });
    expect(dim).toBeGreaterThan(0.2);
    expect(bright).toBeLessThan(0.05);
    for (let i = 0; i < 500; i++) {
      const value = 10 + i * 3;
      for (const band of [dim, bright]) {
        const e = estimateRange(value, band, `k${i}`);
        expect(e.lo).toBeLessThanOrEqual(value + 1e-9);
        expect(e.hi).toBeGreaterThanOrEqual(value - 1e-9);
      }
    }
  });
});

describe('jobs and economy', () => {
  it('generates simple jobs inside the designed ranges', () => {
    const rng = makeRng(21);
    let speedy = 0;
    let lowPay = 0;
    const miles = [];
    for (let i = 0; i < 2000; i++) {
      const job = generateSimpleJob(rng);
      expect(job.timeLimit).toBe(job.distance * B.JOBS.limitSecondsPerMile);
      if (job.title !== 'Mail run') {
        expect(job.containers).toBeGreaterThanOrEqual(1);
        expect(job.containers).toBeLessThanOrEqual(5);
        expect(job.each).toBeGreaterThanOrEqual(2000);
        expect(job.each).toBeLessThanOrEqual(7500);
        expect(job.distance).toBeGreaterThanOrEqual(50);
        expect(job.distance).toBeLessThanOrEqual(250);
        expect(jobPay(job, job.containers)).toBeGreaterThanOrEqual(jobPay(job, 1));
        expect(job.boulders.length).toBe(job.hazard === 0 ? 0 : job.boulders.length);
        miles.push(job.distance);
      }
      if (job.speedBonus) speedy++;
      if (job.xpBonusPct > 0) lowPay++;
    }
    expect(speedy / 2000).toBeGreaterThan(0.15);
    expect(speedy / 2000).toBeLessThan(0.25);
    expect(lowPay).toBeGreaterThan(50);
    const short = miles.filter((m) => m <= 100).length;
    const long = miles.filter((m) => m >= 200).length;
    expect(short).toBeGreaterThan(long);
  });

  it('fuel price stays within 20% of 2 LT and holds for the game week', () => {
    for (let week = 0; week < 500; week++) {
      const m = fuelMarket(week);
      expect(m.price).toBeGreaterThanOrEqual(1.6);
      expect(m.price).toBeLessThanOrEqual(2.4);
      expect(m.stock).toBeGreaterThanOrEqual(400);
      expect(m.stock).toBeLessThanOrEqual(1500);
    }
    expect(fuelMarket(3).price).toBe(fuelMarket(3).price);
  });

  it('buys fuel at a weighted average cost', () => {
    const c = newConductor();
    const start = { ...c.fuel };
    const left = fuelMarket(0).stock;
    const gallons = Math.min(40, left);
    const before = c.lt;
    const out = actions.buyFuel(c, { gallons, now: NOW });
    expect(c.fuel.gallons).toBe(start.gallons + gallons);
    expect(c.fuel.basis).toBeCloseTo(start.basis + out.cost);
    expect(c.lt).toBeCloseTo(before - out.cost);
    expect(() => actions.buyFuel(c, { gallons: 100000, now: NOW })).toThrow();
  });

  it('settles a delivery: pay, fuel back to the reserve, experience, a new job on the board', () => {
    const c = newConductor();
    const loco = activeLoco(c);
    const stats = deriveStats(loco, c);
    const job = c.board.simple.find((j) => j.containers > 0 && cargoFits(stats, j.each) && j.hazard === 0);
    const ctx = { kind: 'delivery', jobId: job.id };
    const run = describeRun(c, ctx);
    expect(run.blocked).toBe(null);
    const load = Math.min(run.maxLoad, Math.ceil(run.plan.gallons * 1.1));
    const result = runToEnd(createRace(buildRaceConfig(c, run, load)));
    const ltBefore = c.lt;
    const fuelBefore = c.fuel.gallons;
    const receipt = actions.settleRun(c, { ctx, result, now: NOW });
    if (result.reason === 'finished') {
      expect(receipt.outcome).toBe('delivered');
      expect(receipt.payout).toBeGreaterThanOrEqual(jobPay(job, 1));
      expect(c.lt).toBeCloseTo(ltBefore + receipt.payout - receipt.ammoCost, 1);
    }
    expect(c.fuel.gallons).toBeCloseTo(fuelBefore - result.fuelUsed, 3);
    expect(receipt.fuelCost).toBeCloseTo(result.fuelUsed * 2, 1);
    expect(receipt.profit).toBeCloseTo(receipt.payout - receipt.fuelCost - receipt.ammoCost);
    expect(activeLoco(c).condition).toBeLessThan(1);
    expect(c.board.simple).toHaveLength(B.JOBS.simpleCount);
    expect(c.board.simple.some((j) => j.id === job.id)).toBe(false);
    expect(c.stats.runs).toBe(1);
    const full = jobXp(job, 1);
    expect(receipt.xp).toBe(Math.floor((result.reason === 'finished' ? full : Math.floor(full * 0.25)) * 1.15));
  });

  it('races cost an entry fee, paid once at the start line and shown on the receipt', () => {
    const c = newConductor();
    const race = c.board.races[0];
    const ctx = { kind: 'race', raceId: race.id };
    const fee = entryFee('race', race);
    expect(fee).toBe(Math.round((race.purse[0] * 0.2) / 10) * 10);
    expect(fee).toBeGreaterThan(0);
    const before = c.lt;
    expect(actions.payEntry(c, { ctx }).fee).toBe(fee);
    expect(c.lt).toBeCloseTo(before - fee, 1);
    // A second start (after a forfeit) is free.
    expect(actions.payEntry(c, { ctx }).fee).toBe(0);
    const result = { kind: 'race', reason: 'finished', finished: true, place: 4, field: race.rivals.length + 1, distance: race.distance, underLimitPct: 0, fuelLoaded: 60, fuelUsed: 50, fuelLeft: 10, emergencyGallons: 0, emergencyCost: 0 };
    const receipt = actions.settleRun(c, { ctx, result, now: NOW });
    expect(receipt.entryFee).toBe(fee);
    expect(receipt.payout).toBe(0);
    expect(receipt.profit).toBeCloseTo(-receipt.fuelCost - receipt.ammoCost - fee);
    // Contract races: 25 LT per contract on offer. Not enough LT: no entry.
    const contract = c.board.contracts[0];
    expect(entryFee('contract', contract)).toBe(contract.award * 25);
    c.lt = 10;
    expect(() => actions.payEntry(c, { ctx: { kind: 'contract', contractId: contract.id } })).toThrow('entry fee');
    expect(entryFee('delivery', c.board.simple[0])).toBe(0);
  });

  it('contract race: winning grants contracts, reputation and company jobs', () => {
    const c = newConductor();
    const contract = c.board.contracts[0];
    const ctx = { kind: 'contract', contractId: contract.id };
    const run = describeRun(c, ctx);
    expect(run.rivals.length).toBe(contract.rivals.length);
    const result = { kind: 'contract', reason: 'finished', finished: true, place: 1, field: run.rivals.length + 1, distance: contract.distance, underLimitPct: 0, fuelLoaded: 60, fuelUsed: 50, fuelLeft: 10, emergencyGallons: 0, emergencyCost: 0 };
    const receipt = actions.settleRun(c, { ctx, result, now: NOW });
    expect(receipt.outcome).toBe('won');
    expect(c.companies[contract.companyId].contracts).toBe(contract.award);
    expect(c.companies[contract.companyId].rep).toBe(150);
    expect(c.board.company[contract.companyId]).toHaveLength(3);
    expect(c.board.contracts).toHaveLength(3);
    expect(receipt.xp).toBe(Math.floor((500 + 100 * contract.award) * 1.15));

    // Spend a contract on a company job.
    const job = c.board.company[contract.companyId].find((j) => j.cost <= contract.award);
    const jctx = { kind: 'company', companyId: contract.companyId, jobId: job.id };
    const jres = { ...result, kind: 'company', underLimitPct: 40 };
    const r2 = actions.settleRun(c, { ctx: jctx, result: jres, now: NOW });
    expect(r2.outcome).toBe('delivered');
    expect(r2.payout).toBeGreaterThanOrEqual(jobPay(job, 1));
    expect(c.companies[contract.companyId].contracts).toBe(contract.award - job.cost);
    expect(starsFor(c.companies[contract.companyId].rep)).toBe(2);
  });

  it('Negotiator can turn second place into a win; losing still earns reputation', () => {
    let negotiated = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const c = newConductor([offer('negotiator')], undefined, seed);
      const contract = c.board.contracts[0];
      const result = { kind: 'contract', reason: 'finished', finished: true, place: 2, field: 4, distance: contract.distance, underLimitPct: 0, fuelLoaded: 0, fuelUsed: 0, fuelLeft: 0, emergencyGallons: 0, emergencyCost: 0 };
      const receipt = actions.settleRun(c, { ctx: { kind: 'contract', contractId: contract.id }, result, now: NOW });
      if (receipt.outcome === 'won') negotiated++;
      else expect(c.companies[contract.companyId].rep).toBe(25);
    }
    expect(negotiated).toBeGreaterThan(45);
    expect(negotiated).toBeLessThan(95);
  });

  it('research is paid up front, runs on the calendar (away time included), survives a pause, and gates the workshop', () => {
    const c = newConductor();
    c.lt = 100000;
    expect(() => actions.buyUpgrade(c, { type: 'engine' })).toThrow(/Research/);
    const rates = researchRates(c, 0);
    actions.startResearch(c, { category: 'engine' });
    expect(100000 - c.lt).toBe(rates.price);
    expect(rates.minutes).toBeGreaterThan(5 * 24 * 60);
    actions.rest(c, { hours: 24 });
    actions.pauseResearch(c);
    actions.rest(c, { hours: 24 * 30 });
    expect(c.research.done.engine).toBe(0); // paused: no progress
    actions.startResearch(c, { category: 'engine' });
    expect(100000 - c.lt).toBe(rates.price); // resuming is free
    expect(c.research.active.done).toBe(24 * 60);
    // Time away drifts the calendar: 1 real hour is 4 game hours.
    const back = c.lastSeen + ((rates.minutes - 24 * 60) / B.CALENDAR.driftGameMinutesPerRealMinute) * 60000 + 60000;
    const report = actions.refreshWorld(c, { now: back });
    expect(c.research.done.engine).toBe(1);
    expect(report.researchDone.category).toBe('engine');
    const hpBefore = deriveStats(activeLoco(c), c).hp;
    const up = actions.buyUpgrade(c, { type: 'engine' });
    expect(up.gain).toBeGreaterThanOrEqual(0.03);
    expect(up.gain).toBeLessThanOrEqual(0.07);
    expect(deriveStats(activeLoco(c), c).hp).toBeCloseTo(hpBefore * (1 + up.gain));
    actions.buyUpgrade(c, { type: 'engine' });
    expect(() => actions.buyUpgrade(c, { type: 'engine' })).toThrow(/tier 2/);
  });

  it('station: buy into the garage, switch, sell', () => {
    const c = newConductor();
    c.lt = 50000;
    const pickLoco = c.station.stock[0];
    const { loco } = actions.buyLoco(c, { id: pickLoco.id });
    expect(c.locos).toHaveLength(2);
    expect(c.station.stock).toHaveLength(8);
    expect(c.lt).toBe(50000 - pickLoco.price);
    const first = c.activeLocoId;
    actions.setActiveLoco(c, { id: loco.id });
    const sale = actions.sellLoco(c, { id: first });
    expect(sale.value).toBeGreaterThan(0);
    expect(c.locos).toHaveLength(1);
    expect(() => actions.sellLoco(c, { id: loco.id })).toThrow();
    expect(() => actions.buyLoco(c, { id: 'phoenix' })).toThrow(/Not enough/);
  });

  it('the Phoenix test drive changes nothing', () => {
    const c = newConductor();
    const before = JSON.stringify({ lt: c.lt, fuel: c.fuel, xp: c.xp });
    const run = describeRun(c, { kind: 'demo' });
    const race = createRace(buildRaceConfig(c, run, 0));
    const result = runToEnd(race);
    expect(result.finished).toBe(true);
    expect(race.ability.used).toBe(true);
    const receipt = actions.settleRun(c, { ctx: { kind: 'demo' }, result, now: NOW });
    expect(receipt.outcome).toBe('demo');
    expect(JSON.stringify({ lt: c.lt, fuel: c.fuel, xp: c.xp })).toBe(before);
    console.log('demo:', result.realSeconds.toFixed(0), 's, phoenix avg', result.avgMph.toFixed(1), 'mph, place', result.place);
  });

  it('emergency fuel that never arrives is not charged', () => {
    const stats = deriveStats(generateLoco(makeRng(1), 'stable', { rarity: 'uncommon', power: 4, efficiency: 4, durability: 4, hpBase: 1750, tqBase: 3875, growth: 1.095 }));
    const race = createRace({ kind: 'delivery', distance: 20, player: { name: 'p', stats, fuel: 9, cargoLb: 6000, lt: 1000 } });
    startRace(race);
    let ordered = false;
    let guard = 0;
    while (race.status === 'running' && guard++ < 100000) {
      stepRace(race, 0.05);
      if (!ordered && playerOf(race).fuel <= 0) {
        ordered = orderEmergencyFuel(race, 100);
        forfeitRace(race);
      }
    }
    expect(ordered).toBe(true);
    expect(race.result.emergencyCost).toBe(0);
    expect(race.result.emergencyGallons).toBe(0);
    expect(race.lt).toBe(1000);
  });

  it('a forfeit leaves the job posted and does not turn the station over', () => {
    const c = newConductor();
    const job = c.board.simple[0];
    const result = { kind: 'delivery', reason: 'forfeit', finished: false, place: 1, field: 1, distance: 3, underLimitPct: 0, fuelLoaded: 50, fuelUsed: 4, fuelLeft: 46, emergencyGallons: 0, emergencyCost: 0 };
    const receipt = actions.settleRun(c, { ctx: { kind: 'delivery', jobId: job.id }, result, now: NOW });
    expect(receipt.outcome).toBe('forfeit');
    expect(receipt.xp).toBe(0);
    expect(c.board.simple.some((j) => j.id === job.id)).toBe(true);
    expect(c.clock).toBeGreaterThan(B.CALENDAR.startMinute); // the time spent still passes
    expect(c.fuel.gallons).toBeCloseTo(200 - 4);
  });

  it('holding contracts always leaves at least one company job you can take', () => {
    for (let seed = 1; seed <= 150; seed++) {
      const rng = makeRng(seed);
      const loco = generateLoco(rng, STARTER_MODELS[seed % 5], { rarity: 'uncommon', power: 1, durability: 1 });
      const c = buildConductor({ name: 'x', chosen: [], attributes: { str: 1, agi: 1, int: 1 }, rerollsLeft: 0, loco, seed, now: NOW });
      actions.refreshWorld(c, { now: NOW });
      const contract = c.board.contracts[0];
      c.companies[contract.companyId] = { contracts: 2, rep: 0, wins: 1, jobs: 0 };
      actions.refreshWorld(c, { now: NOW });
      const stats = deriveStats(loco, c);
      const jobs = c.board.company[contract.companyId];
      expect(jobs).toHaveLength(3);
      expect(jobs.some((j) => j.cost <= 2 && cargoFits(stats, j.each))).toBe(true);
    }
  });

  it('the fuel advance is repaid from the next pay and cannot be stacked', () => {
    const c = newConductor();
    c.lt = 10;
    c.fuel = { gallons: 5, basis: 10 };
    expect(actions.canTakeFuelAdvance(c, NOW)).toBe(true);
    actions.takeFuelAdvance(c, { now: NOW });
    expect(c.fuel.gallons).toBe(65);
    expect(c.fuelAdvanceOwed).toBe(120);
    c.fuel = { gallons: 5, basis: 10 };
    expect(actions.canTakeFuelAdvance(c, NOW)).toBe(false);
    const job = c.board.simple[0];
    const result = { kind: 'delivery', reason: 'finished', finished: true, place: 1, field: 1, distance: job.distance, underLimitPct: 10, fuelLoaded: 0, fuelUsed: 0, fuelLeft: 0, emergencyGallons: 0, emergencyCost: 0 };
    const receipt = actions.settleRun(c, { ctx: { kind: 'delivery', jobId: job.id }, result, now: NOW });
    const repaid = Math.min(120, receipt.payout);
    expect(receipt.advanceRepaid).toBe(repaid);
    expect(c.lt).toBeCloseTo(10 + receipt.payout - repaid, 1);
  });

  it('a new board has seven jobs and three contracts from different companies', () => {
    const board = generateBoard(makeRng(4), NOW);
    expect(board.simple).toHaveLength(7);
    expect(new Set(board.contracts.map((c) => c.companyId)).size).toBe(3);
    for (const contract of board.contracts) {
      expect(contract.rivals.length).toBeGreaterThanOrEqual(3);
      expect(contract.rivals.length).toBeLessThanOrEqual(6);
      expect(contract.award).toBeGreaterThanOrEqual(2);
      expect(contract.award).toBeLessThanOrEqual(7);
    }
  });
});

describe('prize races', () => {
  it('posts weekly races with a purse for the top three', async () => {
    const { generateBoard } = await import('../src/game/jobs.js');
    const { makeRng } = await import('../src/game/rng.js');
    const board = generateBoard(makeRng(7), 1);
    expect(board.races.length).toBe(3);
    for (const race of board.races) {
      expect(race.purse.length).toBe(3);
      expect(race.purse[0]).toBeGreaterThan(race.purse[1]);
      expect(race.rivals.length).toBeGreaterThanOrEqual(2);
      expect(race.weight).toBe(0);
    }
  });
});

describe('long-range sightings', () => {
  it('announces an obstacle spotted mid-run, and old saves get longer-reaching weapons', async () => {
    const { migrate } = await import('../src/game/storage.js');
    const stats = deriveStats(makeBenchmark());
    const race = createRace({ kind: 'delivery', distance: 30, combat: true, bootInstant: true, seed: 3, obstacles: [{ at: 20, size: 'boulder' }], player: { name: 'x', stats: { ...stats, sight: 3.6, ammo: 3 }, fuel: 200 } });
    startRace(race);
    let seen = null;
    for (let i = 0; i < 40000 && !seen; i++) {
      stepRace(race, 0.05);
      seen = race.fx.find((f) => f.type === 'spotted') ?? null;
      race.fx.length = 0;
    }
    expect(seen).not.toBeNull();
    expect(seen.miles).toBeGreaterThan(3);
    const old = { version: 3, arsenal: [{ item: 'weapon', base: 'cannon', range: 1.1 }], locos: [{ fit: ['fuel', { item: 'weapon', base: 'heavy', range: 1.5 }] }] };
    const next = migrate(old);
    expect(next.version).toBe(7);
    expect(next.arsenal[0].range).toBeCloseTo(3.3);
    expect(next.locos[0].fit[1].range).toBeCloseTo(4.5);
  });
});

describe('heavy trains: acceleration and hills', () => {
  it('takes miles to reach top speed; Agility shortens it; climbs slow you, Strength helps, descents speed you', async () => {
    const { hillEffect, hillGripFor, makeCourse, gradeAt } = await import('../src/game/course.js');
    const loco = generateLoco(makeRng(1), 'stable', { rarity: 'uncommon', power: 4, efficiency: 4, durability: 4, hpBase: 1750, tqBase: 3875, growth: 1.095 });
    const at95 = (agi) => {
      const stats = deriveStats(loco, { str: 10, agi, int: 10, traits: [] });
      const race = createRace({ kind: 'plan', distance: 30, course: { distance: 30, bends: [], hills: [] }, player: { name: 'x', stats, fuel: stats.tank, cargoLb: 5000 } });
      startRace(race);
      const p = playerOf(race);
      stepRace(race, 0.25);
      while (race.status === 'running' && p.speed < p.vmax * 0.95) stepRace(race, 0.25);
      return p.distance;
    };
    const slow = at95(5);
    expect(slow).toBeGreaterThan(4);
    expect(at95(18)).toBeLessThan(slow);
    expect(hillEffect(0.03, 0).speed).toBeCloseTo(0.82, 2);
    expect(hillEffect(0.03, hillGripFor(20)).speed).toBeGreaterThan(0.9);
    expect(hillEffect(-0.03, 0).speed).toBeGreaterThan(1.05);
    expect(hillEffect(0.03, 0).fuel).toBeGreaterThan(1.2);
    const course = makeCourse('hilly', 120);
    expect(course.hills.length).toBeGreaterThan(3);
    expect(course.hills.some((h) => h.grade > 0) && course.hills.some((h) => h.grade < 0)).toBe(true);
    expect(gradeAt(course, course.hills[0].start + 0.01)).toBe(course.hills[0].grade);
  });
});

describe('terrain: flooded plains, desert and frozen pass', () => {
  it('gives every course a terrain from its seed; the first run is always plains', async () => {
    const { makeCourse } = await import('../src/game/course.js');
    expect(makeCourse('first-run', 25).theme).toBe('plains');
    const seen = new Set();
    for (let i = 0; i < 80; i++) seen.add(makeCourse(`job-${i}`, 100).theme);
    expect([...seen].sort()).toEqual(['desert', 'flooded', 'plains', 'snow']);
    const flooded = makeCourse('x', 90, 'flooded');
    expect(flooded.water).toEqual([{ start: 30, end: 60 }]);
    expect(makeCourse('x', 90, 'desert').water).toEqual([]);
  });

  it('floodwater drags a train down; torque per ton and Agility cut the penalty', async () => {
    const { waterDrag } = await import('../src/game/course.js');
    const weak = waterDrag(3500, 14000, 0.05);
    const strong = waterDrag(6000, 10000, 0.4);
    expect(weak).toBeGreaterThan(0.3);
    expect(strong).toBeLessThan(0.2);
    expect(waterDrag(5000, 12000, 0.4)).toBeLessThan(waterDrag(5000, 12000, 0.1));
    // In a race: slower and thirstier through the middle third.
    const loco = generateLoco(makeRng(1), 'stable', { rarity: 'uncommon', power: 4, efficiency: 4, durability: 4, hpBase: 1750, tqBase: 3875, growth: 1.095 });
    const stats = deriveStats(loco, { str: 10, agi: 10, int: 10, traits: [] });
    const run = (theme) => {
      const course = { distance: 30, bends: [], hills: [], theme, water: theme === 'flooded' ? [{ start: 10, end: 20 }] : [] };
      const race = createRace({ kind: 'plan', distance: 30, course, player: { name: 'x', stats, fuel: stats.tank, cargoLb: 5000 } });
      startRace(race);
      const p = playerOf(race);
      let wadeTop = 0;
      while (race.status === 'running') {
        stepRace(race, 0.25);
        if (p.wading) wadeTop = Math.max(wadeTop, p.vmax);
      }
      return { time: race.game, fuel: p.fuelUsed, heat: p.heatPeak, wadeTop, top: p.topSeen };
    };
    const dry = run('plains');
    const wet = run('flooded');
    expect(wet.time).toBeGreaterThan(dry.time * 1.08);
    expect(wet.fuel).toBeGreaterThan(dry.fuel);
    expect(wet.wadeTop).toBeLessThan(dry.top * 0.85);
    const hot = run('desert');
    expect(hot.heat).toBeGreaterThan(dry.heat * 1.2);
  });

  it('icy bends on the Frozen Pass hold less speed unless Agility grips', async () => {
    const loco = generateLoco(makeRng(1), 'bullet', { rarity: 'uncommon', power: 5, efficiency: 4, durability: 4, hpBase: 1750, tqBase: 3875, growth: 1.095 });
    const bend = { start: 3, end: 6, kind: 'sharp', dir: 1, turn: 2, curve: 0.66 };
    const minInBend = (theme, agi) => {
      const stats = deriveStats(loco, { str: 10, agi, int: 10, traits: [] });
      const race = createRace({ kind: 'plan', distance: 8, course: { distance: 8, bends: [bend], hills: [], theme, water: [] }, player: { name: 'x', stats, fuel: stats.tank, cargoLb: 0 } });
      startRace(race);
      const p = playerOf(race);
      let low = Infinity;
      while (race.status === 'running') {
        stepRace(race, 0.25);
        if (p.distance > 3.5 && p.distance < 5.5) low = Math.min(low, p.speed);
      }
      return low;
    };
    expect(minInBend('snow', 8)).toBeLessThan(minInBend('plains', 8) * 0.93);
    // Agility grips: a nimble conductor carries more speed round the icy bend.
    expect(minInBend('snow', 20)).toBeGreaterThan(minInBend('snow', 8) * 1.05);
  });
});

describe('missiles, lightning, burn and poison', () => {
  const stats = deriveStats(makeBenchmark());
  const field = (arms, ws = {}, extra = {}) => {
    const race = createRace({ kind: 'test', distance: 25, combat: true, bootInstant: true, seed: 9, player: { name: 'You', stats: { ...stats, ammo: 60, charge: 100, weaponStats: ws, ...extra }, arms, fuel: 200 }, rivals: [{ id: 'r1', name: 'R', stats: { ...stats, armor: 0, hull: 99999 }, fuel: 200 }] });
    startRace(race);
    race.trains[1].think = 1e9;
    return race;
  };
  it('a missile launcher fires a burst of 3 missiles for 10 each, then cools down', () => {
    const race = field(['launcher'], { launcher: { ...weaponStats('launcher'), accuracy: 1, crit: 0 } });
    expect(playerCast(race, 'launcher')).toBe(true);
    expect(race.shots.length).toBe(3);
    expect(playerOf(race).fuel).toBe(200 - 6); // 2 gallons a missile
    expect(playerOf(race).fuelUsed).toBe(6);
    expect(playerOf(race).ammo).toBe(60);
    race.trains[1].distance = playerOf(race).distance;
    stepRace(race, 1.5);
    expect(race.trains[1].taken).toBe(30);
    expect(castBlocker(race, playerOf(race), 'launcher')).toBe('Reloading');
  });
  it('missiles burn fuel from the tank (half for a Legendary launcher); no fuel, no missiles', () => {
    const legendary = { ...weaponStats(rollWeapon(makeRng(5), 'launcher', 'legendary')), accuracy: 1, crit: 0 };
    const race = field(['launcher'], { launcher: legendary });
    const p = playerOf(race);
    playerCast(race, 'launcher');
    expect(200 - p.fuel).toBeCloseTo(legendary.burst * 1, 5); // 1 gallon a missile
    const dry = field(['launcher'], { launcher: weaponStats('launcher') });
    playerOf(dry).fuel = 1;
    expect(castBlocker(dry, playerOf(dry), 'launcher')).toBe('Not enough fuel');
    expect(B.LOCO.fuelLbPerGallon).toBe(24);
  });

  it('the Wind Jet: panels slow you and gather wind faster the faster you go; boost or gust', async () => {
    const { setPanels, useWind, windBlocker } = await import('../src/game/race.js');
    const loco = generateLoco(makeRng(3), 'bullet');
    loco.fit = ['windjet', 'fuel'];
    const s = deriveStats(loco, { str: 10, agi: 10, int: 10, traits: [] });
    expect(s.wind).toBe(true);
    const make = () => {
      const race = createRace({ kind: 'contract', distance: 40, combat: true, bootInstant: true, seed: 2, course: { distance: 40, bends: [], hills: [], theme: 'plains', water: [] }, player: { name: 'You', stats: s, fuel: 200, cargoLb: 0 }, rivals: [{ id: 'r1', name: 'R', stats: s, fuel: 200, cargoLb: 0 }] });
      startRace(race);
      race.trains[1].think = 1e9;
      return race;
    };
    const race = make();
    const p = playerOf(race);
    expect(windBlocker(race, p, 'boost')).toBe('Deploy the panels');
    for (let i = 0; i < 120; i++) stepRace(race, 0.25);
    const free = p.vmax;
    setPanels(race, true);
    stepRace(race, 0.25);
    expect(p.vmax).toBeLessThan(free * 0.92);
    // Wind per mile grows with speed: fast miles fill more than slow ones.
    const perMileAt = (mph) => mph * B.WIND.perMile;
    expect(perMileAt(60) / perMileAt(30)).toBe(2);
    for (let i = 0; i < 200 && p.wind < 60; i++) stepRace(race, 0.25);
    expect(p.wind).toBeGreaterThanOrEqual(25);
    setPanels(race, false);
    const top = p.vmax;
    expect(useWind(race, 'boost')).toBe(true);
    expect(p.wind).toBe(0);
    stepRace(race, 0.25);
    expect(p.vmax).toBeGreaterThan(top * 1.1);
    // Gust: slows every rival within range.
    const race2 = make();
    const p2 = playerOf(race2);
    p2.wind = 100;
    race2.trains[1].distance = p2.distance + 0.5;
    for (let i = 0; i < 40; i++) stepRace(race2, 0.25);
    const before = race2.trains[1].vmax;
    race2.trains[1].distance = p2.distance + 0.5;
    expect(useWind(race2, 'gust')).toBe(true);
    stepRace(race2, 0.25);
    expect(race2.trains[1].vmax).toBeLessThan(before * 0.8);
    expect(race2.trains[1].windSlowFor).toBeGreaterThan(8);
  });

  it('the Heat Cannon fires 10% of the engine heat: more heat, more damage, and the engine cools', () => {
    const exact = { ...weaponStats('heat'), accuracy: 1, crit: 0, damage: [12, 12] };
    const race = field(['heat'], { heat: exact });
    const p = playerOf(race);
    p.heat = 2;
    expect(castBlocker(race, p, 'heat')).toBe('Engine is cool');
    p.heat = 80;
    expect(playerCast(race, 'heat')).toBe(true);
    expect(p.heat).toBeCloseTo(72, 5); // took 8 heat
    race.trains[1].distance = p.distance;
    stepRace(race, 1);
    expect(race.trains[1].taken).toBe(12 + 8 * 4);
    const rare = rollWeapon(makeRng(2), 'heat', 'legendary');
    expect(rare.share).toBeCloseTo(0.1875, 4);
    expect(weaponStats({ ...standardWeapon('heat'), traits: ['furnace'] }).share).toBeCloseTo(0.15, 4);
  });

  it('the Tesla Coil charges from wheel capacitors that slow the train, holds its charge, and hits exponentially', async () => {
    const { setCapacitors, teslaDamage } = await import('../src/game/race.js');
    const coil = { ...weaponStats('tesla'), accuracy: 1, crit: 0 };
    const race = field(['tesla'], { tesla: coil });
    const p = playerOf(race);
    expect(p.voltsMax).toBe(400);
    expect(castBlocker(race, p, 'tesla')).toBe('Charge the coil');
    for (let i = 0; i < 40; i++) stepRace(race, 0.25);
    const free = p.vmax;
    expect(setCapacitors(race, true)).toBe(true);
    stepRace(race, 0.25);
    expect(p.vmax).toBeLessThan(free * 0.9);
    for (let i = 0; i < 400; i++) stepRace(race, 0.25);
    expect(p.volts).toBeGreaterThan(100);
    setCapacitors(race, false);
    const held = p.volts;
    for (let i = 0; i < 8; i++) stepRace(race, 0.25);
    expect(p.volts).toBe(held); // the pack holds its charge with the capacitors off
    // Exponential: a full pack is far more than twice a half pack.
    expect(teslaDamage(coil, 400)).toBeGreaterThan(6 * teslaDamage(coil, 200));
    expect(Math.round(teslaDamage(coil, 100))).toBe(11);
    race.trains[1].distance = p.distance;
    expect(playerCast(race, 'tesla')).toBe(true);
    expect(p.volts).toBe(0);
    stepRace(race, 1);
    expect(race.trains[1].taken).toBe(Math.round(teslaDamage(coil, held)));
  });

  it('lightning ramps 1, 2, 3 ... every quarter second for 3 seconds', () => {
    const race = field(['arc'], { arc: weaponStats('arc') });
    expect(playerCast(race, 'arc')).toBe(true);
    for (let i = 0; i < 16; i++) {
      race.trains[1].distance = playerOf(race).distance;
      stepRace(race, 0.25);
    }
    expect(race.trains[1].taken).toBe(78); // 1 + 2 + ... + 12
    const amped = field(['arc'], { arc: weaponStats({ ...standardWeapon('arc'), traits: ['amplifier', 'highvolt'] }) });
    playerCast(amped, 'arc');
    for (let i = 0; i < 16; i++) {
      amped.trains[1].distance = playerOf(amped).distance;
      stepRace(amped, 0.25);
    }
    expect(amped.trains[1].taken).toBeGreaterThan(78 * 1.8);
  });
  it('Burn ticks its stacks each second and fades; Poison ticks every 2 seconds and stays', () => {
    const race = field([]);
    const rival = race.trains[1];
    rival.burn = 3;
    for (let i = 0; i < 40; i++) {
      rival.distance = playerOf(race).distance;
      stepRace(race, 0.1);
    }
    expect(rival.taken).toBe(3 + 2 + 1);
    expect(rival.burn).toBe(0);
    const race2 = field([]);
    const r2 = race2.trains[1];
    r2.poison = 2;
    for (let i = 0; i < 61; i++) stepRace(race2, 0.1);
    expect(r2.taken).toBe(6); // three ticks of 2
    expect(r2.poison).toBe(2);
  });
  it('Intelligence makes spells hit harder', () => {
    const a = deriveStats(makeBenchmark(), { int: 0, str: 0, agi: 0, traits: [] }).spellPower;
    const b = deriveStats(makeBenchmark(), { int: 20, str: 0, agi: 0, traits: [] }).spellPower;
    expect(b).toBeCloseTo(a * 1.4, 2);
  });
});

describe('boot-up, heat, Endurance and the Journey', () => {
  const benchStats = deriveStats(makeBenchmark());
  it('weapons come online by timer, by distance or by trigger', async () => {
    const { bootStatus } = await import('../src/game/race.js');
    const race = createRace({ kind: 'test', distance: 25, combat: true, seed: 4, player: { name: 'x', stats: { ...benchStats, ammo: 30, charge: 50 }, arms: ['launcher', 'cannon', 'shield'], fuel: 200 }, rivals: [{ id: 'r1', name: 'R', stats: benchStats, fuel: 200 }] });
    startRace(race);
    const p = playerOf(race);
    race.trains[1].think = 1e9;
    expect(bootStatus(race, p, 'launcher')).toMatch(/Booting/);
    expect(bootStatus(race, p, 'cannon')).toMatch(/Boots in/);
    expect(castBlocker(race, p, 'launcher')).toMatch(/Booting/);
    for (let i = 0; i < 25 * 4; i++) stepRace(race, 0.25);
    expect(bootStatus(race, p, 'launcher')).toBeNull();
    expect(bootStatus(race, p, 'shield')).toMatch(/below 50% HP/);
    p.hull = p.hullMax * 0.4;
    stepRace(race, 0.1);
    expect(bootStatus(race, p, 'shield')).toBeNull();
  });
  it('heat builds faster past 100% lever, cools when easing off, and Endurance slows it', async () => {
    const { heatPenalty } = await import('../src/game/race.js');
    const loco = generateLoco(makeRng(2), 'stable', { rarity: 'uncommon', power: 4, efficiency: 4, durability: 4, endurance: 5, hpBase: 1750, tqBase: 3875, growth: 1.095 });
    const heatAfter = (stats, lever, miles = 60) => {
      const race = createRace({ kind: 'plan', distance: miles + 1, course: { distance: miles + 1, bends: [], hills: [] }, player: { name: 'x', stats, fuel: 400, cargoLb: 0, lever } });
      startRace(race);
      const p = playerOf(race);
      while (race.status === 'running' && p.distance < miles) stepRace(race, 0.5);
      return p.heat;
    };
    const plain = deriveStats(loco, { str: 10, agi: 10, int: 10, end: 5, traits: [] });
    const tough = deriveStats({ ...loco, endurance: 15 }, { str: 10, agi: 10, int: 10, end: 18, traits: [] });
    const base = heatAfter(plain, 1);
    expect(base).toBeGreaterThan(5);
    expect(heatAfter(plain, 1.1)).toBeGreaterThan(base * 1.5);
    expect(heatAfter(tough, 1)).toBeLessThan(base * 0.75);
    expect(heatAfter(plain, 0.7)).toBeLessThan(1);
    expect(heatPenalty(40)).toBe(0);
    expect(heatPenalty(100)).toBeCloseTo(0.2, 2);
    expect(heatPenalty(120)).toBeGreaterThan(0.35);
  });
  it('Frost Breath and the Coolant Vent shed heat; the Journey gathers speed every 5 miles', () => {
    const race = createRace({ kind: 'delivery', distance: 40, combat: false, seed: 1, player: { name: 'x', stats: { ...benchStats, charge: 60, journey: true }, arms: ['vent'], fuel: 200 } });
    startRace(race);
    const p = playerOf(race);
    p.heat = 70;
    stepRace(race, 0.1);
    expect(playerCast(race, 'vent')).toBe(true);
    expect(p.heat).toBeLessThan(50);
    while (race.status === 'running' && p.distance < 20) stepRace(race, 0.5);
    expect(p.journeyStacks).toBe(4);
    const c = newConductor();
    expect(c.end).toBeGreaterThanOrEqual(0);
    expect(generateLoco(makeRng(1), 'longrun', { rarity: 'epic' }).name).toBe('The Journey');
  });
});

describe('Nexus Rail (NFT edition): Captain, talents, crates and crew', () => {
  it('a Captain earns a talent point a level, tiers open every 5 points, capstones need the focus', async () => {
    const { makeCaptainSave } = await import('../src/game/crates.js');
    const { pointsLeft, talentBlocker, talent } = await import('../src/game/captain.js');
    const c = makeCaptainSave(newConductor(), { focus: 'engineering', crewName: 'Rookie' });
    expect(c.crew[0].str).toBe(c.str);
    expect(pointsLeft(c)).toBe(1);
    expect(talentBlocker(c, 'flanges')).toMatch(/Needs 5 points/);
    actions.spendTalent(c, { id: 'tuning' });
    expect(pointsLeft(c)).toBe(0);
    c.level = 30;
    for (let i = 0; i < 4; i++) actions.spendTalent(c, { id: 'tuning' });
    expect(talentBlocker(c, 'flanges')).toBeNull();
    expect(talentBlocker(c, 'magnate')).toMatch(/Capstone/);
    const lite = newConductor();
    expect(deriveStats(activeLoco(c), c).hp).toBeGreaterThan(deriveStats(activeLoco(lite), { ...lite, str: c.str, agi: c.agi, int: c.int, end: c.end, traits: c.traits }).hp);
    expect(talent(lite, 'power')).toBe(0);
    addXp(c, 1e9);
    expect(c.level).toBe(30);
  });
  it('crates reveal from a visible, shrinking pool; picking costs 10% more; stat budgets hold', async () => {
    const C = await import('../src/game/crates.js');
    const v = C.emptyVault();
    expect(() => C.openCrate(v, { tier: 'rare' })).toThrow(/Not enough Nexus/);
    C.adminGrant(v, { amount: 500 });
    expect(C.remaining(v, 'rare').length).toBe(120);
    const got = C.openCrate(v, { tier: 'rare', rng: () => 0.3 });
    expect(C.remaining(v, 'rare').length).toBe(119);
    expect(v.nexus).toBe(470);
    expect(got.nfts.map((n) => n.kind)).toEqual(['loco', 'conductor']);
    expect(v.owned).toHaveLength(2);
    const pickId = C.remaining(v, 'legendary')[0].id;
    const picked = C.openCrate(v, { tier: 'legendary', pickId });
    expect(picked.crate).toBe(pickId);
    expect(v.nexus).toBe(470 - 220);
    const budget = (n) => (n.kind === 'loco' ? n.data.power + n.data.efficiency + n.data.durability + n.data.endurance : n.data.str + n.data.agi + n.data.int + n.data.end);
    for (const n of C.poolNfts('epic')) expect(budget(n)).toBe(n.kind === 'loco' ? 32 : 56);
    expect(C.poolOf('rare')[0].id).toBe(C.seasonPool('rare')[0].id); // same pool on every device
    // Deploy into a Captain's save and seat the conductor
    const save = C.makeCaptainSave(newConductor(), { focus: 'business', crewName: 'Rookie' });
    const crewNft = C.poolNfts('epic').find((e) => e.kind === 'conductor');
    v.owned.push({ id: crewNft.id, kind: 'conductor', tier: 'epic', data: structuredClone(crewNft.data), deployedTo: null });
    C.deployNft(v, save, { nftId: crewNft.id, saveId: 1 });
    expect(() => C.deployNft(v, save, { nftId: crewNft.id, saveId: 1 })).toThrow(/already/);
    actions.seatCrew(save, { locoId: save.activeLocoId, crewId: crewNft.data.id });
    expect(save.str).toBe(crewNft.data.str);
  });

  it('every crate is a locomotive and a conductor; the better one either way, never two Legendaries', async () => {
    const C = await import('../src/game/crates.js');
    const want = { basic: ['uncommon', 'uncommon'], rare: ['rare', 'rare'], elite: ['epic', 'rare'], epic: ['epic', 'epic'], legendary: ['legendary', 'rare'], mythic: ['legendary', 'epic'] };
    for (const tier of C.TIER_IDS) {
      let trainHigh = 0;
      for (const crate of C.poolOf(tier)) {
        expect(crate.loco.kind).toBe('loco');
        expect(crate.conductor.kind).toBe('conductor');
        const pair = [crate.loco.data.rarity, crate.conductor.data.rarity];
        expect([...pair].sort()).toEqual([...want[tier]].sort());
        expect(pair.filter((r) => r === 'legendary').length).toBeLessThan(2);
        if (pair[0] === want[tier][0] && pair[0] !== pair[1]) trainHigh++;
      }
      if (want[tier][0] !== want[tier][1]) expect(trainHigh).toBe(C.CRATE_TIERS[tier].pool / 2);
    }
  });
});

describe('Nexus Rail Captain with no starter', () => {
  it('starts with an empty garage, survives world refresh, and takes its first train and driver from a crate', async () => {
    const C = await import('../src/game/crates.js');
    const save = buildConductor({ name: 'Cap', chosen: [], attributes: { str: 2, agi: 2, int: 2, end: 2 }, rerollsLeft: 0, loco: null, seed: 7, now: NOW });
    C.makeCaptainSave(save, { focus: 'engineering', crewName: 'Rookie' });
    expect(save.locos).toEqual([]);
    expect(save.activeLocoId).toBeNull();
    expect(save.str).toBe(0); // nobody driving yet
    expect(() => actions.refreshWorld(save, { now: NOW + 60000 })).not.toThrow();
    const v = C.welcome(C.emptyVault());
    const got = C.openCrate(v, { tier: 'basic', rng: () => 0.5 });
    expect(v.nexus).toBe(0);
    for (const n of got.nfts) C.deployNft(v, save, { nftId: n.id, saveId: save.createdAt });
    expect(save.locos).toHaveLength(1);
    expect(save.activeLocoId).toBe(save.locos[0].id);
    expect(save.locos[0].crewId).toBe('crew-rookie');
    expect(save.locos[0].fit).toEqual(B.ARMORY.startKit);
    // The crate's conductor out-rates a weak rookie, so takes the controls.
    C.seatPair(save, { locoId: got.nfts[0].data.id, crewId: got.nfts[1].data.id });
    expect(save.locos[0].crewId).toBe(got.nfts[1].data.id);
    expect(save.str).toBe(got.nfts[1].data.str);
    expect(() => deriveStats(activeLoco(save), save)).not.toThrow();
  });
});

describe('Nexus Rail welcome', () => {
  it('a Vault gets 10 welcome Nexus once: enough for a Basic crate', async () => {
    const C = await import('../src/game/crates.js');
    const v = C.welcome(C.emptyVault());
    expect(v.nexus).toBe(10);
    C.welcome(v);
    expect(v.nexus).toBe(10); // only once
    const got = C.openCrate(v, { tier: 'basic', rng: () => 0.1 });
    expect(got.nfts).toHaveLength(2);
    expect(v.nexus).toBe(0);
  });
});

describe('the rail map and express runs', () => {
  it('joins real cities with lines; the far lines open with licences earned by miles driven', async () => {
    const M = await import('../src/game/routemap.js');
    expect(M.LINES.length).toBeGreaterThan(25);
    for (const line of M.LINES) {
      expect(M.CITIES[line.a] && M.CITIES[line.b]).toBeTruthy();
      expect(line.miles).toBeGreaterThan(150);
      expect(line.miles).toBeLessThan(1100);
    }
    // Every express runs along real lines, Boston to Miami among them.
    for (const x of M.EXPRESSES) expect(M.expressLines(x).every(Boolean)).toBe(true);
    const atlantic = M.expressById('atlantic');
    expect(M.expressMiles(atlantic)).toBeGreaterThan(1500);
    expect(M.expressMiles(M.expressById('coast'))).toBeGreaterThan(3000);
    const c = newConductor();
    expect(M.licenceOf(c).id).toBe('apprentice');
    expect(M.lineOpen(c, M.lineById('chicago-stlouis'))).toBe(true);
    expect(M.lineOpen(c, M.lineById('phoenix-losangeles'))).toBe(false);
    c.stats.miles = 6000;
    expect(M.licenceOf(c).id).toBe('foreman');
    expect(M.lineOpen(c, M.lineById('phoenix-losangeles'))).toBe(true);
    c.stats.miles = 0;
    // Company reputation never opens the map: only miles do.
    c.companies.atlas = { contracts: 0, rep: 99999, wins: 0, jobs: 0 };
    expect(M.licenceLevel(c)).toBe(0);
    // This week's jobs sit on open lines, with the line's terrain.
    actions.refreshWorld(c, { now: NOW });
    for (const job of c.board.simple) {
      const line = M.lineById(job.line);
      expect(line.licence).toBe(0);
      expect(job.theme).toBe(line.terrain);
    }
  });

  it('runs an express a leg at a time and pays the bonus at the end', async () => {
    const M = await import('../src/game/routemap.js');
    const c = newConductor();
    c.lt = 50000;
    expect(() => actions.startExpress(c, { id: 'gulf' })).toThrow(/Fireman/);
    c.stats.miles = 500;
    actions.startExpress(c, { id: 'gulf' });
    const run = c.express;
    expect(run.legs.length).toBeGreaterThanOrEqual(4);
    for (const leg of run.legs) expect(leg.distance).toBeLessThanOrEqual(B.EXPRESS.legMiles);
    expect(run.legs[0].from).toBe('Dallas');
    expect(run.legs.at(-1).to).toBe('Memphis');
    expect(() => actions.startExpress(c, { id: 'gulf' })).toThrow(/current express/);
    const ctx = { kind: 'express' };
    let total = 0;
    let receipt;
    for (let i = 0; i < run.legs.length; i++) {
      const plan = describeRun(c, ctx);
      expect(plan.course.theme).toBe(run.legs[i].theme);
      const result = { kind: 'express', reason: 'finished', finished: true, place: 1, field: 1, distance: plan.distance, underLimitPct: 0, fuelLoaded: 0, fuelUsed: 0, fuelLeft: 0, emergencyGallons: 0, emergencyCost: 0, towUse: plan.towUse };
      receipt = actions.settleRun(c, { ctx, result, now: NOW });
      total += receipt.lines[0].lt;
    }
    expect(c.express).toBeNull();
    expect(receipt.expressDone).toBe('Gulf Coast Flyer');
    const bonus = receipt.lines.find((l) => l.label.startsWith('Gulf Coast Flyer complete'));
    expect(bonus.lt).toBeGreaterThan(Math.floor(total * B.EXPRESS.bonus * 0.9));
    expect(c.expressDone.gulf).toBe(1);
    // Every leg counts toward the next licence, and a licence pays more on every job.
    expect(c.stats.miles).toBeGreaterThan(500 + 1000);
    expect(receipt.lines.some((l) => l.label.startsWith("Fireman's Licence +2%"))).toBe(true);
  });

  it('licences pay more on every job and are announced when earned', () => {
    const c = newConductor();
    c.stats.miles = 1990;
    const pick = c.board.simple.find((j) => j.containers > 0);
    const ctx = { kind: 'delivery', jobId: pick.id, haul: 1 };
    const run = describeRun(c, ctx);
    const result = { kind: 'delivery', reason: 'finished', finished: true, place: 1, field: 1, distance: 20, underLimitPct: 0, fuelLoaded: 0, fuelUsed: 0, fuelLeft: 0, emergencyGallons: 0, emergencyCost: 0, towUse: run.towUse };
    const receipt = actions.settleRun(c, { ctx, result, now: NOW });
    expect(receipt.lines.find((l) => l.label.startsWith("Fireman's Licence")).lt).toBe(Math.floor(receipt.lines[0].lt * 0.02));
    expect(receipt.licenceUp.name).toBe("Engineer's Licence");
  });
});
