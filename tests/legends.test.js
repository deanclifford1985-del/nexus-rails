import { describe, expect, it } from 'vitest';
import { B } from '../src/game/balance.js';
import { makeRng } from '../src/game/rng.js';
import { LEGEND_MODELS, MODELS, abilityOf, deriveStats, generateLoco, makeMythic, makePhoenix, spellsOf } from '../src/game/locomotives.js';
import { makeCourse } from '../src/game/course.js';
import { abilityBlocker, createRace, fireAll, playerCast, playerOf, setLever, startRace, stepRace, useAbility } from '../src/game/race.js';
import { buildConductor } from '../src/game/conductor.js';
import * as actions from '../src/game/actions.js';
import { buildRaceConfig, describeRun } from '../src/game/setup.js';
import { BOSS_IDS, bossRecord, bossState, bountyReward, legendOffer, raiderOn } from '../src/game/bosses.js';
import { resaleValue } from '../src/game/locomotives.js';

const NOW = 1791480000000;
function newConductor(seed = 42) {
  const rng = makeRng(seed);
  const loco = generateLoco(rng, 'stable', { rarity: 'uncommon', power: 4, efficiency: 4, durability: 4, hpBase: 1750, tqBase: 3875, growth: 1.095 });
  const c = buildConductor({ name: 'Test Conductor', chosen: [], attributes: { str: 12, agi: 10, int: 8, end: 8 }, rerollsLeft: 0, loco, seed, now: NOW });
  actions.refreshWorld(c, { now: NOW });
  return c;
}

// Signature abilities and boss fights (the race engine's side of both).

const crew = { str: 12, agi: 12, int: 12, end: 10, traits: [] };
// stepRace advances at most 5 seconds a call; this runs a longer stretch.
function advance(race, seconds) {
  for (let left = seconds; left > 1e-9 && race.status === 'running'; left -= 5) stepRace(race, Math.min(5, left));
}
const plain = () => generateLoco(makeRng(1), 'stable', { rarity: 'uncommon', power: 4, efficiency: 4, durability: 4, endurance: 5, hpBase: 1750, tqBase: 3875, growth: 1.095 });
const statsOf = (loco, who = crew) => deriveStats(loco, who);

// A race for `loco` against plain rivals, already under way.
function field(loco, { rivals = 2, distance = 40, obstacles = [], seed = 5, kind = 'race' } = {}) {
  const stats = statsOf(loco);
  const rival = statsOf(plain());
  const race = createRace({
    kind,
    distance,
    seed,
    combat: true,
    bootInstant: true,
    obstacles,
    course: makeCourse('legend-test', distance, 'plains'),
    player: { name: 'p', model: loco.model, stats, fuel: 200, cargoLb: 0, ability: stats.ability },
    rivals: Array.from({ length: rivals }, (_, i) => ({ id: `rival-${i + 1}`, name: `r${i + 1}`, stats: rival, fuel: 200, cargoLb: 0 })),
  });
  startRace(race);
  return race;
}

describe('legendary machines', () => {
  it('every legendary machine has a model, a price, its spells and a signature ability', () => {
    for (const model of [...LEGEND_MODELS, 'phoenix']) {
      const loco = model === 'phoenix' ? makePhoenix(makeRng(3)) : makeMythic(makeRng(3), model);
      expect(MODELS[model].name).toBeTruthy();
      expect(loco.price).toBeGreaterThan(50000);
      const ability = abilityOf(loco);
      expect(B.ABILITIES[ability], model).toBeTruthy();
      expect(deriveStats(loco, crew).ability).toBe(ability);
      expect(Array.isArray(spellsOf(loco))).toBe(true);
      for (const v of Object.values(deriveStats(loco, crew))) if (typeof v === 'number') expect(Number.isFinite(v)).toBe(true);
    }
    // A relic forges an engine for half of what it is worth, so selling one never turns a profit.
    for (const [model, m] of Object.entries(B.MYTHIC)) if (m.forge) expect(m.forge.price).toBeLessThanOrEqual(m.price * B.LOCO.resale);
    expect(abilityOf(plain())).toBeNull();
  });

  it('abilities recharge on a cooldown; Siphon still works once a run', () => {
    const race = field(makeMythic(makeRng(2), 'wizard'));
    advance(race, 6);
    expect(abilityBlocker(race)).toBeNull();
    expect(useAbility(race)).toBe(true);
    expect(abilityBlocker(race)).toMatch(/Recharging/);
    expect(useAbility(race)).toBe(false);
    advance(race, B.ABILITIES.tempest.cooldown + 0.5);
    // Recharged (the Magus may have left its rivals out of reach by now).
    expect(abilityBlocker(race) ?? '').not.toMatch(/Recharging/);
    expect(race.ability.cd).toBe(0);
    const phoenix = field(makePhoenix(makeRng(2)));
    advance(phoenix, 6);
    expect(useAbility(phoenix)).toBe(true);
    expect(phoenix.ability.used).toBe(true);
    advance(phoenix, 20);
    expect(abilityBlocker(phoenix)).toBe('Used up');
  });

  it('Black Hole piles 250,000 lb on every rival in reach and crushes obstacles', () => {
    const race = field(makeMythic(makeRng(2), 'graviton'), { obstacles: [{ at: 3, size: 'boulder' }] });
    advance(race, 10);
    race.obstacles[0].seen = true;
    const before = race.trains.slice(1).map((t) => t.vmax);
    const hp = race.obstacles[0].hp;
    expect(useAbility(race)).toBe(true);
    stepRace(race, 1);
    race.trains.slice(1).forEach((t, i) => expect(t.vmax).toBeLessThan(before[i] * 0.25));
    expect(race.obstacles[0].hp).toBeLessThan(hp);
    advance(race, B.ABILITIES.blackhole.seconds + 1);
    race.trains.slice(1).forEach((t, i) => expect(t.vmax).toBeGreaterThan(before[i] * 0.8));
  });

  it('Tempest strikes every enemy; Inferno burns them and cools the engine', () => {
    const storm = field(makeMythic(makeRng(2), 'wizard'), { rivals: 3 });
    stepRace(storm, 5);
    useAbility(storm);
    stepRace(storm, 2);
    for (const rival of storm.trains.slice(1)) expect(rival.hull).toBeLessThan(rival.hullMax);
    const fire = field(makeMythic(makeRng(2), 'dragon'), { rivals: 2 });
    stepRace(fire, 5);
    playerOf(fire).heat = 50;
    useAbility(fire);
    expect(playerOf(fire).heat).toBeLessThanOrEqual(50 - B.ABILITIES.inferno.vent + 1);
    stepRace(fire, 1.5);
    for (const rival of fire.trains.slice(1)) {
      expect(rival.hull).toBeLessThan(rival.hullMax);
      expect(rival.burn + (rival.hullMax - rival.hull)).toBeGreaterThan(B.ABILITIES.inferno.damage[0] * 0.5);
    }
  });

  it('Bulwark shrugs off damage and crushes whatever is on the line', () => {
    const race = field(makeMythic(makeRng(2), 'titan'), { rivals: 0, obstacles: [{ at: 1.2, size: 'giant' }], kind: 'delivery' });
    const p = playerOf(race);
    stepRace(race, 4);
    expect(useAbility(race)).toBe(true);
    expect(p.barrierCut).toBe(B.ABILITIES.bulwark.cut);
    const hull = p.hull;
    // Carry the Bulwark to the giant boulder: it is crushed without a scratch.
    p.distance = 1.15;
    p.speed = 40;
    stepRace(race, 2);
    expect(race.obstacles[0].struck).toBe(true);
    expect(p.hull).toBe(hull);
    expect(p.crushed).toBe(1);
  });

  it('Plunder takes fuel and jams guns; Absolute Zero freezes the field; Maw eats obstacles', () => {
    const raid = field(makeMythic(makeRng(2), 'marauder'), { rivals: 1 });
    stepRace(raid, 4);
    const [p, rival] = raid.trains;
    p.fuel = 100;
    const theirs = rival.fuel;
    expect(useAbility(raid)).toBe(true);
    expect(p.fuel).toBeCloseTo(100 + B.ABILITIES.plunder.fuel, 5);
    expect(rival.fuel).toBeCloseTo(theirs - B.ABILITIES.plunder.fuel, 5);
    expect(p.fuelStolen).toBe(B.ABILITIES.plunder.fuel);

    const ice = field(makeMythic(makeRng(2), 'glacier'), { rivals: 2 });
    advance(ice, 8);
    playerOf(ice).heat = 70;
    const speeds = ice.trains.slice(1).map((t) => t.vmax);
    useAbility(ice);
    expect(playerOf(ice).heat).toBe(0);
    stepRace(ice, 0.5);
    ice.trains.slice(1).forEach((t, i) => expect(t.vmax).toBeLessThan(speeds[i] * 0.6));

    const shark = field(makeMythic(makeRng(2), 'sandshark'), { rivals: 0, obstacles: [{ at: 3, size: 'boulder' }], kind: 'delivery' });
    const sp = playerOf(shark);
    advance(shark, 6);
    shark.obstacles[0].seen = true;
    sp.hull = Math.round(sp.hullMax * 0.5);
    sp.distance = 2;
    expect(useAbility(shark)).toBe(true);
    expect(shark.obstacles[0].destroyed).toBe(true);
    expect(sp.hull).toBeGreaterThan(sp.hullMax * 0.5);
    // Its jaws crush debris and boulders for free, whatever front is fitted.
    expect(sp.smash).toBe(1);
  });

  it('the Phoenix rises once from its own wreck', () => {
    const race = field(makePhoenix(makeRng(2)), { rivals: 1 });
    const p = playerOf(race);
    stepRace(race, 3);
    p.hull = 1;
    p.burn = 5;
    stepRace(race, 1.5);
    expect(p.out).toBe(false);
    expect(p.reborn).toBe(true);
    expect(p.hull).toBeGreaterThan(p.hullMax * 0.3);
    p.hull = 1;
    p.burn = 5;
    stepRace(race, 1.5);
    expect(p.out).toBe(true);
    expect(race.result.reborn).toBe(true);
  });

  it('a champion in a legendary machine uses its ability on the player', () => {
    const stats = statsOf(plain());
    const magus = statsOf(makeMythic(makeRng(4), 'graviton'));
    const race = createRace({
      kind: 'race', distance: 30, seed: 9, combat: true, bootInstant: true, course: makeCourse('champ', 30, 'plains'),
      player: { name: 'p', stats, fuel: 200, cargoLb: 0 },
      rivals: [{ id: 'rival-1', name: 'Champion', model: 'graviton', stats: magus, fuel: 200, cargoLb: 0, ability: 'blackhole' }],
    });
    startRace(race);
    advance(race, 30);
    expect(race.trains[1].ability.cd).toBeGreaterThan(0);
    expect(race.events.some((e) => /Black Hole/.test(e.text))).toBe(true);
  });
});

// ---------- bosses ----------

function hunt(bossId, loco, { seed = 3, fuel = 200, who = crew } = {}) {
  const def = { id: bossId, ...B.BOSSES[bossId] };
  const stats = deriveStats(loco, who);
  const race = createRace({
    kind: 'bounty', title: def.name, distance: def.miles, combat: true, seed, boss: def,
    course: makeCourse(`bounty-${bossId}`, def.miles, 'plains'),
    player: { name: 'p', model: loco.model, stats, fuel: Math.min(stats.tank, fuel), cargoLb: 0, ability: stats.ability },
  });
  startRace(race);
  return race;
}
// Fight until the run ends: fire everything, shield what cannot be dodged, dodge what can.
function fightOn(race, { dodge = true } = {}) {
  const p = playerOf(race);
  let seen = null;
  let guard = 0;
  let next = 0;
  while (race.status === 'running' && guard++ < 100000) {
    stepRace(race, 0.1);
    const w = race.boss.boss.windup;
    if (dodge && w && w.atk.dodge && seen !== w) {
      seen = w;
      setLever(race, p.lever >= 1 ? 0.85 : 1);
    }
    if (w && !w.atk.dodge && w.left < 0.6 && p.barrier <= 0) playerCast(race, 'barrier') || playerCast(race, 'shield');
    if (race.real >= next) {
      next = race.real + 0.5;
      useAbility(race);
      fireAll(race);
    }
  }
  return race.result;
}
const starter = () => ({ ...plain(), fit: ['launcher', 'fuel'] });

describe('boss fights', () => {
  it('every boss is well formed', () => {
    const tiers = Object.values(B.BOSSES).map((b) => b.tier);
    expect(tiers).toEqual([...tiers].sort((a, b) => a - b));
    for (const [id, boss] of Object.entries(B.BOSSES)) {
      expect(boss.hull).toBeGreaterThan(0);
      expect(boss.attacks.length).toBeGreaterThanOrEqual(3);
      expect(B.MYTHIC[boss.forges]?.forge?.relic, id).toBe(id);
      for (const atk of boss.attacks) {
        expect(atk.telegraph).toBeGreaterThan(0.5);
        expect(atk.cooldown).toBeGreaterThan(0);
        if (!atk.type) expect(atk.damage[1]).toBeGreaterThanOrEqual(atk.damage[0]);
        if (atk.type === 'drop') expect(B.HAZARD.sizes[atk.size]).toBeTruthy();
      }
      // At least one attack is open from the first second of the fight.
      expect(boss.attacks.some((atk) => atk.below === undefined)).toBe(true);
    }
  });

  it('a boss stays off the line until the player is under way, then keeps station', () => {
    const race = hunt('rustjaw', starter());
    const boss = race.boss;
    expect(boss.hidden).toBe(true);
    expect(race.combat).toBe(true);
    stepRace(race, 2);
    expect(boss.boss.state).toBe('waiting');
    // Nothing to shoot at yet.
    expect(fireAll(race)).toBe(0);
    while (boss.boss.state !== 'fighting' && race.real < 120) stepRace(race, 0.5);
    expect(boss.boss.state).toBe('fighting');
    expect(boss.hidden).toBe(false);
    const p = playerOf(race);
    for (let i = 0; i < 40; i++) {
      stepRace(race, 0.5);
      if (race.status !== 'running') break;
      expect(Math.abs(boss.distance - p.distance)).toBeLessThan(0.3);
    }
    // The boss is not a rival: no place to race for.
    expect(race.place).toBe(1);
    expect(race.gap).toBeNull();
  });

  it('warns before every attack; moving the lever dodges an aimed one', () => {
    const run = (dodge) => {
      const race = hunt('rustjaw', starter(), { seed: 11 });
      const p = playerOf(race);
      const warned = [];
      let seen = null;
      let guard = 0;
      while (race.status === 'running' && race.real < 110 && guard++ < 5000) {
        stepRace(race, 0.1);
        for (const fx of race.fx.splice(0)) if (fx.type === 'bossWarn') warned.push(fx);
        const w = race.boss.boss.windup;
        if (dodge && w && w.atk.id === 'scrap' && seen !== w) {
          seen = w;
          setLever(race, p.lever >= 1 ? 0.85 : 1);
        }
      }
      return { taken: p.taken, dodges: race.dodges ?? 0, warned };
    };
    const stood = run(false);
    const moved = run(true);
    expect(stood.warned.length).toBeGreaterThan(3);
    expect(stood.warned.every((fx) => fx.seconds >= 1)).toBe(true);
    expect(stood.dodges).toBe(0);
    expect(moved.dodges).toBeGreaterThan(2);
    expect(moved.taken).toBeLessThan(stood.taken);
  });

  it('enough damage during the warning breaks a charged attack', () => {
    const race = hunt('rustjaw', starter());
    const boss = race.boss;
    while (boss.boss.state !== 'fighting') stepRace(race, 0.5);
    // Bring it under 60% so the Broadside is in play, and wait for its warning.
    boss.hull = boss.hullMax * 0.5;
    let guard = 0;
    while (boss.boss.windup?.atk.id !== 'broadside' && guard++ < 2000) stepRace(race, 0.05);
    expect(boss.boss.windup.atk.id).toBe('broadside');
    const shotsBefore = race.shots.length;
    playerOf(race).mp = 100;
    // A hit worth more than 7% of its hull lands during the warning.
    race.shots.push({ id: 9999, kind: 'cannon', key: 'cannon', from: 'player', to: 'boss', left: 0.05, total: 0.05, delay: 0, custom: { damage: [60, 60], accuracy: 1 } });
    stepRace(race, 0.2);
    expect(boss.boss.windup).toBeNull();
    expect(boss.boss.reel).toBeGreaterThan(0);
    expect(boss.boss.broken).toBe(1);
    stepRace(race, 1);
    expect(race.shots.filter((s) => s.from === 'boss').length).toBe(0);
    expect(shotsBefore).toBeGreaterThanOrEqual(0);
  });

  it('drops land on the line ahead as obstacles, in order', () => {
    const race = hunt('frostmaw', { ...plain(), fit: ['launcher', 'fuel'] }, { seed: 4 });
    let guard = 0;
    while (race.status === 'running' && !race.obstacles.length && guard++ < 3000) stepRace(race, 0.1);
    expect(race.obstacles.length).toBeGreaterThan(0);
    const rock = race.obstacles[0];
    expect(rock.dropped).toBe(true);
    expect(rock.seen).toBe(true);
    expect(rock.at).toBeGreaterThan(playerOf(race).distance);
    const ats = race.obstacles.map((r) => r.at);
    expect(ats).toEqual([...ats].sort((a, b) => a - b));
  });

  it('a starter can bring down Rustjaw, and the run ends with the kill', () => {
    let wins = 0;
    let seconds = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const race = hunt('rustjaw', starter(), { seed, fuel: 190 });
      const result = fightOn(race);
      if (result.reason === 'slain') {
        wins++;
        seconds += result.boss.seconds;
        expect(result.boss.slain).toBe(true);
        expect(result.finished).toBe(false);
        expect(result.distance).toBeLessThan(B.BOSSES.rustjaw.miles);
      }
    }
    console.log(`rustjaw vs starter: ${wins}/12 wins, about ${(seconds / Math.max(1, wins)).toFixed(0)} s a kill`);
    expect(wins).toBeGreaterThanOrEqual(9);
  });

  it('a boss escapes when its time runs out, and a starter is no match for the dragon', () => {
    // No weapons: nothing can hurt it, so it leaves when its time is up.
    const unarmed = hunt('rustjaw', { ...plain(), durability: 15, fit: ['fuel'] }, { seed: 2 });
    playerOf(unarmed).hull = playerOf(unarmed).hullMax = 100000;
    const result = fightOn(unarmed);
    expect(result.reason).toBe('escaped');
    expect(result.boss.slain).toBe(false);
    expect(result.boss.seconds).toBeGreaterThan(B.BOSSES.rustjaw.seconds - 1);
    const doomed = fightOn(hunt('vharzul', starter(), { seed: 2 }));
    expect(doomed.reason).toBe('derailed');
    expect(doomed.boss.hull).toBeGreaterThan(doomed.boss.hullMax * 0.8);
  });

  it('the bosses climb in strength: a build that beats one tier struggles two tiers up', () => {
    const mid = () => ({ ...generateLoco(makeRng(1), 'tank', { rarity: 'rare', power: 6, efficiency: 5, durability: 7, endurance: 7 }), fit: ['launcher', 'fuel', 'cannon', 'ammo', 'plasma', 'shield'], front: 'plow' });
    const rate = (boss, n = 10) => {
      let wins = 0;
      for (let seed = 1; seed <= n; seed++) if (fightOn(hunt(boss, mid(), { seed, fuel: 240 })).reason === 'slain') wins++;
      return wins / n;
    };
    const r = { rustjaw: rate('rustjaw'), frostmaw: rate('frostmaw'), bastion: rate('bastion') };
    console.log('mid build win rates:', JSON.stringify(r));
    expect(r.rustjaw).toBe(1);
    expect(r.frostmaw).toBeGreaterThan(0.2);
    expect(r.bastion).toBe(0);
  });
});

describe('the bounty board', () => {
  it('posts bosses in order: licence first, then the boss before', () => {
    const c = newConductor();
    expect(bossState(c, 'rustjaw').state).toBe('open');
    expect(bossState(c, 'frostmaw')).toMatchObject({ state: 'locked' });
    expect(bossState(c, 'frostmaw').why).toMatch(/Fireman/);
    c.stats.miles = 600;
    expect(bossState(c, 'frostmaw').why).toMatch(/Rustjaw/);
    c.bounties = { rustjaw: { kills: 1, best: 60, slainDay: -100 } };
    expect(bossState(c, 'frostmaw').state).toBe('open');
    expect(bossState(c, 'devourer').state).toBe('locked');
    expect(BOSS_IDS[0]).toBe('rustjaw');
  });

  it('a bounty is a run like any other: set up, fought, settled', () => {
    const c = newConductor();
    const ctx = { kind: 'bounty', bossId: 'rustjaw' };
    const run = describeRun(c, ctx);
    expect(run.blocked).toBeNull();
    expect(run.boss.id).toBe('rustjaw');
    expect(run.distance).toBe(B.BOSSES.rustjaw.miles);
    expect(run.rivals).toHaveLength(0);
    expect(run.course.theme).toBe('plains');
    const config = buildRaceConfig(c, run, 190);
    expect(config.combat).toBe(true);
    const race = createRace({ ...config, seed: 4 });
    startRace(race);
    const result = fightOn(race);
    expect(result.reason).toBe('slain');
    const lt = c.lt;
    const fuel = c.fuel.gallons;
    const receipt = actions.settleRun(c, { ctx, result, now: NOW });
    expect(receipt.outcome).toBe('won');
    expect(receipt.firstKill).toBe(true);
    expect(receipt.lines[0].lt).toBe(B.BOSSES.rustjaw.bounty);
    expect(receipt.xp).toBeGreaterThanOrEqual(B.BOSSES.rustjaw.xp);
    expect(receipt.prizeWeapon.rarity).toBe('rare');
    expect(receipt.relic).toMatchObject({ bossId: 'rustjaw', forges: 'marauder' });
    expect(c.relics.rustjaw).toBeTruthy();
    expect(c.arsenal).toHaveLength(1);
    expect(c.lt).toBe(lt + B.BOSSES.rustjaw.bounty);
    // The fuel not burned went back to the reserve.
    expect(c.fuel.gallons).toBeCloseTo(fuel - result.fuelUsed, 3);
    expect(bossRecord(c, 'rustjaw')).toMatchObject({ kills: 1 });
    expect(c.stats.wins).toBe(1);
    // Down for a week of game days; then it is back for a smaller purse and a lesser weapon.
    const down = bossState(c, 'rustjaw');
    expect(down.state).toBe('slain');
    expect(down.backIn).toBeGreaterThan(3);
    expect(describeRun(c, ctx).blocked).toMatch(/is down/);
    expect(raiderOn(c, 'kansascity-dallas')).toBeNull();
    actions.rest(c, { hours: 24 * 8 });
    expect(bossState(c, 'rustjaw').state).toBe('open');
    expect(raiderOn(c, 'kansascity-dallas')).toBe('rustjaw');
    expect(bountyReward(c, 'rustjaw')).toMatchObject({ first: false, lt: Math.round(1500 * B.BOSS.repeat.pay), weapon: 'uncommon', relic: null });
  });

  it('a boss that gets away pays nothing but a little experience', () => {
    const c = newConductor();
    const ctx = { kind: 'bounty', bossId: 'rustjaw' };
    const run = describeRun(c, ctx);
    const race = createRace({ ...buildRaceConfig(c, run, 150), seed: 4 });
    startRace(race);
    // Hurt it, then let its time run out.
    let guard = 0;
    while (race.boss.boss.state !== 'fighting' && guard++ < 2000) stepRace(race, 0.5);
    race.boss.hull = race.boss.hullMax * 0.5;
    playerOf(race).hull = playerOf(race).hullMax = 1e6;
    while (race.status === 'running' && guard++ < 20000) stepRace(race, 0.5);
    expect(race.result.reason).toBe('escaped');
    const lt = c.lt;
    const receipt = actions.settleRun(c, { ctx, result: race.result, now: NOW });
    expect(receipt.outcome).toBe('escaped');
    expect(receipt.payout).toBe(0);
    expect(c.lt).toBeLessThanOrEqual(lt);
    expect(receipt.xp).toBeGreaterThan(50);
    expect(receipt.xp).toBeLessThan(B.BOSSES.rustjaw.xp * 0.3);
    expect(c.relics).toBeUndefined();
    expect(bossState(c, 'rustjaw').state).toBe('open');
  });

  it('a relic forges its legendary machine for half its worth', () => {
    const c = newConductor();
    c.lt = 2000000;
    expect(legendOffer(c, 'marauder').locked).toMatch(/Rustjaw/);
    expect(() => actions.buyLoco(c, { id: 'marauder' })).toThrow(/Rustjaw/);
    // The Iron Titan can be bought outright, or forged for half with the Bastion Core.
    expect(legendOffer(c, 'titan')).toMatchObject({ price: 450000, forged: false });
    c.relics = { rustjaw: { at: 0 }, bastion: { at: 0 } };
    expect(legendOffer(c, 'titan')).toMatchObject({ price: 225000, forged: true });
    const got = actions.buyLoco(c, { id: 'marauder' });
    expect(got.price).toBe(45000);
    expect(c.lt).toBe(2000000 - 45000);
    expect(got.loco.model).toBe('marauder');
    expect(resaleValue(got.loco)).toBe(45000);
    expect(() => actions.buyLoco(c, { id: 'marauder' })).toThrow(/already own/);
    // The Graviton needs no relic, only money.
    expect(legendOffer(c, 'graviton')).toMatchObject({ price: 1500000, locked: null });
    expect(deriveStats(got.loco, c).ability).toBe('plunder');
  });
});
