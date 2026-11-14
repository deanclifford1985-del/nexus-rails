import { describe, expect, it } from 'vitest';
import { B } from '../src/game/balance.js';
import { makeRng } from '../src/game/rng.js';
import { buildConductor } from '../src/game/conductor.js';
import { generateLoco, makeMythic } from '../src/game/locomotives.js';
import { createRace, fireAll, orderEmergencyFuel, playerOf, setLever, startRace, stepRace } from '../src/game/race.js';
import * as actions from '../src/game/actions.js';
import { milestoneState, milestonesReady, recordEvents, rollTasks, runEvents, taskBonus, taskText, taskTier, tasksClaimable } from '../src/game/tasks.js';
import { TRIAL_IDS, trialConfig, trialCounts, trialMedal, trialRecord, trialScore } from '../src/game/trials.js';
import { migrate } from '../src/game/storage.js';

const NOW = 1791480000000;
function newConductor(seed = 42, locoOptions = {}) {
  const rng = makeRng(seed);
  const loco = generateLoco(rng, 'stable', { rarity: 'uncommon', power: 4, efficiency: 4, durability: 4, hpBase: 1750, tqBase: 3875, growth: 1.095, ...locoOptions });
  const c = buildConductor({ name: 'Test Conductor', chosen: [], attributes: { str: 12, agi: 10, int: 8, end: 8 }, rerollsLeft: 0, loco, seed, now: NOW });
  actions.refreshWorld(c, { now: NOW });
  return c;
}
const fakeResult = (extra = {}) => ({ reason: 'finished', finished: true, place: 1, field: 1, distance: 60, raceDistance: 60, gameSeconds: 6000, realSeconds: 240, timeLimit: 25200, underLimitPct: 76, fuelLoaded: 40, fuelUsed: 30, fuelLeft: 10, emergencyGallons: 0, emergencyCost: 0, standings: [], ...extra });

describe('weekly orders', () => {
  it('posts four different orders a week, sized to the conductor', () => {
    const c = newConductor();
    expect(c.tasks.list).toHaveLength(B.TASKS.count);
    expect(new Set(c.tasks.list.map((task) => task.type)).size).toBe(B.TASKS.count);
    expect(taskTier(c)).toBe(0);
    for (const task of c.tasks.list) {
      const def = B.TASKS.types[task.type];
      expect(task.target).toBe(def.target[0]);
      expect(task.lt).toBe(def.lt[0]);
      expect(taskText(task)).not.toMatch(/\{n\}/);
    }
    // Higher licence or level: bigger orders, bigger pay.
    c.stats.miles = 2500;
    expect(taskTier(c)).toBe(2);
    c.level = 16;
    expect(taskTier(c)).toBe(3);
    const big = rollTasks(c, makeRng(5), 9);
    for (const task of big.list) expect(task.target).toBe(B.TASKS.types[task.type].target[3]);
    // A new week brings new orders.
    const week = c.tasks.week;
    actions.rest(c, { hours: 24 * 7 });
    expect(c.tasks.week).toBe(week + 1);
    expect(c.tasks.list.every((task) => task.progress === 0 && !task.claimed)).toBe(true);
  });

  it('runs move the orders along; claiming pays, and the full set pays a bonus and a weapon', () => {
    const c = newConductor();
    c.tasks = { week: c.tasks.week, bonus: false, list: ['miles', 'deliveries', 'obstacles', 'earn'].map((type) => ({ id: `${type}-x`, type, target: B.TASKS.types[type].target[0], progress: 0, lt: B.TASKS.types[type].lt[0], xp: B.TASKS.types[type].xp[0], claimed: false })) };
    // A job shorter than the miles order, so one run does not finish that one too.
    const job = c.board.simple.find((item) => item.containers > 0 && item.distance < B.TASKS.types.miles.target[0]);
    const receipt = actions.settleRun(c, { ctx: { kind: 'delivery', jobId: job.id, haul: 1 }, result: fakeResult({ distance: job.distance, bouldersSmashed: 3, bouldersCrushed: 1 }), now: NOW });
    expect(receipt.outcome).toBe('delivered');
    const by = Object.fromEntries(c.tasks.list.map((task) => [task.type, task]));
    expect(by.miles.progress).toBe(Math.min(by.miles.target, job.distance));
    expect(by.deliveries.progress).toBe(1);
    expect(by.obstacles.progress).toBe(4);
    expect(by.earn.progress).toBe(Math.min(by.earn.target, receipt.payout));
    expect(c.counters).toMatchObject({ deliveries: 1, containers: 1, obstacles: 4 });
    // The obstacles order is done: claim it.
    expect(tasksClaimable(c)).toBe(1);
    expect(() => actions.claimTask(c, { id: 'miles-x' })).toThrow(/not finished/);
    const lt = c.lt;
    const paid = actions.claimTask(c, { id: 'obstacles-x' });
    expect(paid.lt).toBe(B.TASKS.types.obstacles.lt[0]);
    expect(c.lt).toBe(lt + paid.lt);
    expect(() => actions.claimTask(c, { id: 'obstacles-x' })).toThrow(/Already/);
    expect(() => actions.claimTaskBonus(c)).toThrow(/every order/);
    // Finish the rest by hand, then the bonus.
    recordEvents(c, { miles: 1000, deliveries: 5, earned: 5000 });
    for (const task of c.tasks.list) if (!task.claimed) actions.claimTask(c, { id: task.id });
    const bonus = taskBonus(c);
    expect(bonus.lt).toBe(Math.round(c.tasks.list.reduce((sum, task) => sum + task.lt, 0) * B.TASKS.bonus.ltShare));
    const shelf = (c.arsenal ?? []).length;
    const got = actions.claimTaskBonus(c);
    expect(got.weapon.rarity).toBe('rare');
    expect(c.arsenal).toHaveLength(shelf + 1);
    expect(() => actions.claimTaskBonus(c)).toThrow(/Already/);
    // A forfeit counts for nothing.
    const before = JSON.stringify(c.counters);
    const other = c.board.simple[0];
    actions.settleRun(c, { ctx: { kind: 'delivery', jobId: other.id }, result: fakeResult({ reason: 'forfeit', finished: false, distance: 3 }), now: NOW });
    expect(JSON.stringify(c.counters)).toBe(before);
  });

  it('counts what each kind of run is worth', () => {
    const ev = runEvents({ kind: 'race' }, { outcome: 'placed', payout: 300 }, fakeResult({ rivalsDerailed: 2, damageDealt: 400 }));
    expect(ev).toMatchObject({ podiums: 1, raceWins: 0, derails: 2, damage: 400, earned: 300, deliveries: 0 });
    expect(runEvents({ kind: 'bounty' }, { outcome: 'won', payout: 1500 }, fakeResult()).bossKills).toBe(1);
    expect(runEvents({ kind: 'delivery' }, { outcome: 'delivered', haul: 3, payout: 500 }, fakeResult({ underLimitPct: 30 }))).toMatchObject({ deliveries: 1, containers: 3, early: 1 });
    expect(runEvents({ kind: 'delivery' }, { outcome: 'late', haul: 3, payout: 0 }, fakeResult({ underLimitPct: 0 }))).toMatchObject({ deliveries: 0, containers: 0, early: 0 });
  });
});

describe('milestones', () => {
  it('each ladder pays a rung at a time, once', () => {
    const c = newConductor();
    expect(milestonesReady(c)).toBe(0);
    expect(() => actions.claimMilestone(c, { id: 'miles' })).toThrow(/Not reached/);
    c.stats.miles = 650;
    const state = milestoneState(c, 'miles');
    expect(state).toMatchObject({ value: 650, claimed: 0, reached: 2, ready: true, next: 100, reward: B.MILESTONES.miles.lt[0] });
    const lt = c.lt;
    expect(actions.claimMilestone(c, { id: 'miles' })).toMatchObject({ lt: 200, tier: 1 });
    expect(actions.claimMilestone(c, { id: 'miles' })).toMatchObject({ lt: 500, tier: 2 });
    expect(c.lt).toBe(lt + 700);
    expect(() => actions.claimMilestone(c, { id: 'miles' })).toThrow(/Not reached/);
    expect(milestoneState(c, 'miles')).toMatchObject({ claimed: 2, ready: false, next: 2000 });
    // Things that are counted from the save itself, not from runs.
    c.locos.push({ ...makeMythic(makeRng(3), 'graviton'), id: 'loco-g' });
    expect(milestoneState(c, 'legends').value).toBe(1);
    c.trials = { gauntlet: { medal: 'gold' }, brawl: { medal: 'bronze' } };
    expect(milestoneState(c, 'medals').value).toBe(4);
    c.lt = 100000;
    actions.foundCompany(c, { name: 'Test Rail', hq: 'chicago' });
    expect(milestoneState(c, 'terminals')).toMatchObject({ value: 1, ready: true });
    for (const id of Object.keys(B.MILESTONES)) expect(B.MILESTONES[id].tiers.length).toBe(B.MILESTONES[id].lt.length);
  });
});

describe('the proving grounds', () => {
  it('every trial builds a run for the conductor\'s own locomotive', () => {
    const c = newConductor();
    for (const id of TRIAL_IDS) {
      const config = trialConfig(c, id);
      expect(config.kind).toBe('trial');
      expect(config.distance).toBe(B.TRIALS[id].miles);
      expect(config.freeFuel).toBe(true);
      expect(config.course.theme).toBe('plains');
      const race = createRace(config);
      expect(race.trains[0].isPlayer).toBe(true);
    }
    expect(trialConfig(c, 'gauntlet').obstacles).toHaveLength(14);
    expect(trialConfig(c, 'gauntlet').timeLimit).toBe(B.TRIALS.gauntlet.seconds * B.TIME_SCALE);
    expect(trialConfig(c, 'brawl').rivals).toHaveLength(5);
    // The same raiders every time.
    expect(trialConfig(c, 'brawl').rivals.map((r) => r.name)).toEqual(trialConfig(newConductor(7), 'brawl').rivals.map((r) => r.name));
    expect(createRace(trialConfig(c, 'timetrial')).combat).toBe(false);
  });

  it('medals come from the score', () => {
    const [gold, silver, bronze] = B.TRIALS.timetrial.tiers.map((tier) => tier.at);
    expect(trialMedal('timetrial', { reason: 'finished', realSeconds: gold - 1 })).toBe('gold');
    expect(trialMedal('timetrial', { reason: 'finished', realSeconds: silver - 1 })).toBe('silver');
    expect(trialMedal('timetrial', { reason: 'finished', realSeconds: bronze - 1 })).toBe('bronze');
    expect(trialMedal('timetrial', { reason: 'finished', realSeconds: bronze + 1 })).toBe('none');
    expect(trialMedal('gauntlet', { reason: 'finished', bouldersSmashed: 9, bouldersCrushed: 5 })).toBe('gold');
    expect(trialMedal('gauntlet', { reason: 'finished', bouldersSmashed: 4, bouldersCrushed: 2 })).toBe('bronze');
    expect(trialMedal('brawl', { reason: 'finished', kills: 3, rivalsDerailed: 5 })).toBe('silver');
    expect(trialScore('brawl', { kills: 2, rivalsDerailed: 5 })).toBe(2);
  });

  it('the Gauntlet counts what was cleared however the run ends; the others must be finished on the rails', () => {
    // A wreck or the clock ends the Gauntlet, and what was dealt with by then still counts.
    expect(trialMedal('gauntlet', { reason: 'derailed', bouldersSmashed: 7 })).toBe('bronze');
    expect(trialMedal('gauntlet', { reason: 'late', bouldersSmashed: 8, bouldersCrushed: 3 })).toBe('silver');
    expect(trialMedal('gauntlet', { reason: 'derailed', bouldersSmashed: 5 })).toBe('none');
    // Walking away never counts.
    expect(trialMedal('gauntlet', { reason: 'forfeit', bouldersSmashed: 14 })).toBe('none');
    expect(trialCounts('gauntlet', { reason: 'forfeit' })).toBe(false);
    // The Iron Brawl and the Time Trial are judged at the line.
    expect(trialMedal('brawl', { reason: 'derailed', kills: 5 })).toBe('none');
    expect(trialMedal('timetrial', { reason: 'late', realSeconds: 10 })).toBe('none');
    expect(trialCounts('brawl', { reason: 'finished' })).toBe(true);
  });

  it('the Time Trial is run light: the fuel the sprint needs, not a full tank', () => {
    const c = newConductor();
    const config = trialConfig(c, 'timetrial');
    const tank = config.player.stats.tank;
    expect(config.player.fuel).toBeLessThan(tank / 2);
    expect(config.player.fuel).toBeGreaterThan(5);
    // The combat trials start full: missiles burn fuel.
    expect(trialConfig(c, 'gauntlet').player.fuel).toBe(tank);
    expect(trialConfig(c, 'brawl').player.fuel).toBe(tank);
    // And the sprint load is enough to finish on, at 110% lever, without calling the fuel truck.
    const race = createRace({ ...config, seed: 3 });
    startRace(race);
    setLever(race, 1.1);
    let guard = 0;
    while (race.status === 'running' && guard++ < 200000) stepRace(race, 0.5);
    expect(race.result.reason).toBe('finished');
    expect(playerOf(race).fuel).toBeGreaterThan(0);
  });

  it('a medal pays once; a first gold pays the ones below it too; the best score is kept', () => {
    const c = newConductor();
    const lt = c.lt;
    const clock = c.clock;
    const P = B.TRIALS.prizes;
    const silver = actions.settleRun(c, { ctx: { kind: 'trial', trial: 'timetrial' }, result: fakeResult({ realSeconds: 80 }), now: NOW });
    expect(silver).toMatchObject({ medal: 'silver', outcome: 'won', record: true });
    expect(silver.payout).toBe(P.bronze.lt + P.silver.lt);
    expect(silver.xp).toBe(P.bronze.xp + P.silver.xp);
    expect(c.lt).toBe(lt + silver.payout);
    expect(c.clock).toBe(clock + B.TRIALS.hours * 60);
    expect(trialRecord(c, 'timetrial')).toMatchObject({ medal: 'silver', best: 80, runs: 1 });
    // The same medal again pays nothing; a slower run does not replace the best.
    const again = actions.settleRun(c, { ctx: { kind: 'trial', trial: 'timetrial' }, result: fakeResult({ realSeconds: 84 }), now: NOW });
    expect(again.payout).toBe(0);
    expect(again.record).toBeUndefined();
    expect(trialRecord(c, 'timetrial').best).toBe(80);
    // Gold: its own prize and a weapon.
    const gold = actions.settleRun(c, { ctx: { kind: 'trial', trial: 'timetrial' }, result: fakeResult({ realSeconds: 50 }), now: NOW });
    expect(gold.payout).toBe(P.gold.lt);
    expect(gold.prizeWeapon.rarity).toBe('epic');
    expect(trialRecord(c, 'timetrial')).toMatchObject({ medal: 'gold', best: 50, runs: 3 });
    // No medal: a little experience for trying, and no fuel or wear charged.
    const fuel = c.fuel.gallons;
    const none = actions.settleRun(c, { ctx: { kind: 'trial', trial: 'gauntlet' }, result: fakeResult({ reason: 'late', finished: false, bouldersSmashed: 2 }), now: NOW });
    expect(none).toMatchObject({ medal: 'none', outcome: 'lost', payout: 0, xp: 25 });
    expect(c.fuel.gallons).toBe(fuel);
    expect(c.locos[0].condition).toBe(1);
    // A wreck in the Gauntlet still scores: the best is kept and the medal paid.
    expect(trialRecord(c, 'gauntlet')).toMatchObject({ medal: 'none', best: 2, runs: 1 });
    const wrecked = actions.settleRun(c, { ctx: { kind: 'trial', trial: 'gauntlet' }, result: fakeResult({ reason: 'derailed', finished: false, derailed: true, bouldersSmashed: 6, bouldersCrushed: 1 }), now: NOW });
    expect(wrecked).toMatchObject({ medal: 'bronze', outcome: 'won', payout: P.bronze.lt, record: true });
    expect(trialRecord(c, 'gauntlet')).toMatchObject({ medal: 'bronze', best: 7, runs: 2 });
    // Walking out of a trial records nothing.
    const quit = actions.settleRun(c, { ctx: { kind: 'trial', trial: 'gauntlet' }, result: fakeResult({ reason: 'forfeit', finished: false, bouldersSmashed: 12 }), now: NOW });
    expect(quit).toMatchObject({ medal: 'none', outcome: 'forfeit', payout: 0, xp: 0 });
    expect(trialRecord(c, 'gauntlet')).toMatchObject({ medal: 'bronze', best: 7, runs: 2 });
  });

  it('the Iron Brawl credits only the raiders the player puts off the rails', () => {
    const c = newConductor(42, { power: 9, durability: 9 });
    c.locos[0].fit = ['cannon', 'heavy', 'ammo', 'launcher'];
    const race = createRace({ ...trialConfig(c, 'brawl'), seed: 7 });
    startRace(race);
    let guard = 0;
    let next = 0;
    while (race.status === 'running' && guard++ < 200000) {
      stepRace(race, 0.1);
      if (race.real >= next) {
        next = race.real + 0.5;
        // Missiles burn fuel: the fair's fuel truck is free, but it has to be called.
        const p = playerOf(race);
        if (p.fuel <= 0 && p.speed < 1 && !race.emergency) orderEmergencyFuel(race, 50);
        fireAll(race);
      }
    }
    const r = race.result;
    expect(r.kills).toBeLessThanOrEqual(r.rivalsDerailed);
    for (const rival of race.trains.slice(1)) if (rival.out) expect(rival.downBy).toBeTruthy();
    expect(r.kills).toBe(race.trains.slice(1).filter((t) => t.out && t.downBy === 'player').length);
    expect(playerOf(race).isPlayer).toBe(true);
  });
});

describe('old saves', () => {
  it('a version 6 save gains the new records and keeps everything else', () => {
    const c = newConductor();
    const old = structuredClone(c);
    old.version = 6;
    delete old.tasks;
    delete old.research.done.logistics;
    delete old.research.done.ordnance;
    old.traits = ['leader'];
    const next = migrate(old);
    expect(next.version).toBe(7);
    expect(next.research.done).toMatchObject({ engine: 0, logistics: 0, ordnance: 0 });
    expect(next.traits).toEqual([{ id: 'leader', mult: 1, rarity: 'normal' }]);
    expect(next.lt).toBe(c.lt);
    expect(next.locos).toEqual(c.locos);
    // Opening it posts this week's orders.
    actions.refreshWorld(next, { now: NOW });
    expect(next.tasks.list).toHaveLength(B.TASKS.count);
    expect(migrate(next)).toBe(next);
  });
});
