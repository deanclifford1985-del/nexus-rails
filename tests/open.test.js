import { describe, expect, it } from 'vitest';
import { B } from '../src/game/balance.js';
import { makeRng } from '../src/game/rng.js';
import { buildConductor } from '../src/game/conductor.js';
import { generateLoco } from '../src/game/locomotives.js';
import { createRace } from '../src/game/race.js';
import { entryFee } from '../src/game/jobs.js';
import * as actions from '../src/game/actions.js';
import { buildRaceConfig, describeRun } from '../src/game/setup.js';
import { OPEN_IDS, hasTrophy, openById, openDone, openEntry, openField, openJob, openPurse, trophyCount } from '../src/game/open.js';

const NOW = 1791480000000;
function newConductor(seed = 42) {
  const rng = makeRng(seed);
  const loco = generateLoco(rng, 'stable', { rarity: 'uncommon', power: 4, efficiency: 4, durability: 4, hpBase: 1750, tqBase: 3875, growth: 1.095 });
  const c = buildConductor({ name: 'Test Conductor', chosen: [], attributes: { str: 12, agi: 10, int: 8, end: 8 }, rerollsLeft: 0, loco, seed, now: NOW });
  actions.refreshWorld(c, { now: NOW });
  return c;
}
// A result as the race engine reports it, with the player in `place` and the champion just behind or ahead.
function result(run, place, { champAhead = false, reason = 'finished' } = {}) {
  const rows = run.rivals.map((r) => ({ id: r.id, name: r.name, isPlayer: false, champion: !!r.champion, finished: true, out: false }));
  const champ = rows.find((r) => r.champion);
  const others = rows.filter((r) => !r.champion);
  const me = { id: 'player', name: 'me', isPlayer: true, champion: false, finished: reason === 'finished', out: false };
  const order = [...others];
  order.splice(Math.min(order.length, place - 1), 0, me);
  const at = order.indexOf(me);
  order.splice(champAhead ? at : at + 1, 0, champ);
  return { reason, finished: reason === 'finished', place: order.indexOf(me) + 1, field: order.length, distance: run.distance, raceDistance: run.distance, gameSeconds: 3000, realSeconds: 120, timeLimit: null, underLimitPct: 0, fuelLoaded: 40, fuelUsed: 30, fuelLeft: 10, emergencyGallons: 0, emergencyCost: 0, standings: order };
}

describe('the World Open', () => {
  it('twelve events on real routes, five tiers, purses that climb', () => {
    expect(OPEN_IDS).toHaveLength(12);
    const tiers = OPEN_IDS.map((id) => B.OPEN.events[id].tier);
    expect(tiers).toEqual([...tiers].sort((a, b) => a - b));
    expect(new Set(tiers)).toEqual(new Set([1, 2, 3, 4, 5]));
    for (const id of OPEN_IDS) {
      const e = openById(id);
      for (const [name, lon, lat] of [e.from, e.to]) {
        expect(name.length).toBeGreaterThan(2);
        expect(Math.abs(lon)).toBeLessThanOrEqual(180);
        expect(Math.abs(lat)).toBeLessThanOrEqual(70);
      }
      expect(B.TRACK.themes[e.terrain]).toBeTruthy();
      expect(openPurse(e)[0]).toBe(B.OPEN.purse[e.tier - 1]);
      expect(openPurse(e)[1]).toBeLessThan(openPurse(e)[0]);
      expect(openEntry(e)).toBe(Math.round((B.OPEN.purse[e.tier - 1] * B.OPEN.entryShare) / 10) * 10);
    }
    expect(new Set(OPEN_IDS.map((id) => B.OPEN.events[id].country)).size).toBeGreaterThanOrEqual(10);
  });

  it('each field is built to its tier, the same every time, and led by a champion', () => {
    for (const id of OPEN_IDS) {
      const e = openById(id);
      const t = e.tier - 1;
      const field = openField(id);
      expect(field).toHaveLength(B.OPEN.rivals[t] + 1);
      expect(field.map((x) => x.name)).toEqual(openField(id).map((x) => x.name));
      const champ = field.at(-1);
      expect(champ.champion).toBe(true);
      expect(champ.name).toBe(e.champion.name);
      expect(champ.loco.power).toBe(B.OPEN.stat[t] + B.OPEN.champPower);
      expect(champ.lever).toBe(B.OPEN.champLever);
      // From the second tier up the champion drives a legendary machine and uses its ability.
      if (e.tier >= 2) expect(B.ABILITIES[champ.ability]).toBeTruthy();
      for (const rival of field.slice(0, -1)) {
        expect(rival.champion).toBe(false);
        expect(Math.abs(rival.loco.power - B.OPEN.stat[t])).toBeLessThanOrEqual(1);
        const slots = rival.loco.fit.reduce((n, item) => n + B.MODULES[typeof item === 'string' ? item : item.base].slots, 0);
        expect(slots).toBeLessThanOrEqual(B.LOCO.capacity[rival.loco.rarity]);
      }
    }
  });

  it('is open to anyone: no licence, an entry fee, the event\'s own field', () => {
    const c = newConductor();
    const ctx = { kind: 'open', openId: 'crown' };
    const run = describeRun(c, ctx);
    expect(run.blocked).toBeNull();
    expect(run.distance).toBe(90);
    expect(run.rivals).toHaveLength(6);
    expect(run.rivals.at(-1)).toMatchObject({ champion: true, ability: 'blackhole', name: 'Lord Edmund Ashcroft' });
    expect(entryFee('open', run.job)).toBe(openEntry(openById('crown')));
    // The rivals do not scale with the player's engine.
    const strong = newConductor();
    strong.locos[0].power = 15;
    expect(describeRun(strong, ctx).rivals.map((r) => Math.round(r.stats.hp))).toEqual(run.rivals.map((r) => Math.round(r.stats.hp)));
    const race = createRace(buildRaceConfig(c, run, 100));
    expect(race.trains).toHaveLength(7);
    expect(race.trains.at(-1)).toMatchObject({ champion: true });
    expect(race.trains.at(-1).ability.id).toBe('blackhole');
    expect(race.combat).toBe(true);
  });

  it('pays the top three, gives the trophy for a first win, and runs once a week', () => {
    const c = newConductor();
    c.lt = 5000;
    const ctx = { kind: 'open', openId: 'heartland' };
    const run = describeRun(c, ctx);
    const fee = openEntry(openById('heartland'));
    expect(actions.payEntry(c, { ctx })).toEqual({ fee });
    expect(c.lt).toBe(5000 - fee);
    // Paid once: a forfeit keeps the event open and the fee paid.
    expect(actions.payEntry(c, { ctx })).toEqual({ fee: 0 });
    expect(openJob(c, 'heartland').entryPaid).toBe(fee);
    const quit = actions.settleRun(c, { ctx, result: result(run, 4, { reason: 'forfeit' }), now: NOW });
    expect(quit.outcome).toBe('forfeit');
    expect(openDone(c, 'heartland')).toBe(false);
    expect(actions.payEntry(c, { ctx })).toEqual({ fee: 0 });
    // Third place, ahead of the champion: the purse for third and a little extra experience.
    const purse = openPurse(openById('heartland'));
    const lt = c.lt;
    const third = actions.settleRun(c, { ctx, result: result(run, 3), now: NOW });
    expect(third).toMatchObject({ outcome: 'placed', place: 3, entryFee: fee });
    expect(third.lines[0].lt).toBe(purse[2]);
    expect(third.champion).toMatchObject({ name: 'Big Bill Harlan', beaten: true });
    expect(third.xp).toBe(Math.round(B.OPEN.winXp[0] * B.OPEN.placeXp) + Math.round(B.OPEN.winXp[0] * B.OPEN.champXp));
    expect(c.lt).toBe(lt + purse[2]);
    expect(hasTrophy(c, 'heartland')).toBe(false);
    // Run this week: closed until the next.
    expect(openDone(c, 'heartland')).toBe(true);
    expect(describeRun(c, ctx).blocked).toMatch(/this week/);
    actions.rest(c, { hours: 24 * 7 });
    expect(openDone(c, 'heartland')).toBe(false);
    expect(describeRun(c, ctx).blocked).toBeNull();
    expect(openJob(c, 'heartland').entryPaid).toBe(0);
    // A win: the purse, and the trophy with its bonus. The trophy is won once.
    actions.payEntry(c, { ctx });
    const win = actions.settleRun(c, { ctx, result: result(describeRun(c, ctx), 1), now: NOW });
    expect(win).toMatchObject({ outcome: 'won', trophy: 'Heartland Open' });
    expect(win.lines.map((line) => line.lt)).toEqual([purse[0], Math.round(purse[0] * B.OPEN.trophyLt)]);
    expect(win.xp).toBe(B.OPEN.winXp[0]);
    expect(trophyCount(c)).toBe(1);
    expect(c.counters.raceWins).toBe(1);
    actions.rest(c, { hours: 24 * 7 });
    actions.payEntry(c, { ctx });
    const again = actions.settleRun(c, { ctx, result: result(describeRun(c, ctx), 1), now: NOW });
    expect(again.trophy).toBeUndefined();
    expect(again.lines).toHaveLength(1);
    // Behind the champion and off the podium: no purse.
    actions.rest(c, { hours: 24 * 7 });
    actions.payEntry(c, { ctx });
    const lost = actions.settleRun(c, { ctx, result: result(describeRun(c, ctx), 4, { champAhead: true }), now: NOW });
    expect(lost).toMatchObject({ outcome: 'lost', payout: 0 });
    expect(lost.champion.beaten).toBe(false);
    expect(lost.profit).toBeLessThan(0);
  });
});
