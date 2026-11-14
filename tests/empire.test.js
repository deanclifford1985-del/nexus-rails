import { describe, expect, it } from 'vitest';
import { B } from '../src/game/balance.js';
import { makeRng } from '../src/game/rng.js';
import { buildConductor } from '../src/game/conductor.js';
import { deriveStats, generateLoco, makePhoenix } from '../src/game/locomotives.js';
import { traitPower } from '../src/game/traits.js';
import { lineById } from '../src/game/routemap.js';
import * as actions from '../src/game/actions.js';
import { charterPrice, empireIncome, empireRank, empireRating, garageSlots, operatedLines, routeQuote, terminalPrice, terminalUpgradePrice, tillCap } from '../src/game/empire.js';

const NOW = 1791480000000;
const offer = (id) => ({ key: id, ids: [id], rarity: 'normal' });

function newConductor(chosen = [], seed = 42) {
  const rng = makeRng(seed);
  const loco = generateLoco(rng, 'stable', { rarity: 'uncommon', power: 4, efficiency: 4, durability: 4, hpBase: 1750, tqBase: 3875, growth: 1.095 });
  const c = buildConductor({ name: 'Test Conductor', chosen, attributes: { str: 12, agi: 10, int: 8, end: 8 }, rerollsLeft: 0, loco, seed, now: NOW });
  actions.refreshWorld(c, { now: NOW });
  return c;
}
// A second locomotive in the garage, ready to work a route.
function addLoco(c, options = {}) {
  const loco = generateLoco(makeRng(c.locos.length + 7), options.model ?? 'tank', { rarity: 'uncommon', power: 4, efficiency: 4, durability: 4, endurance: 5, hpBase: 1750, tqBase: 3875, growth: 1.095, ...options });
  loco.id = `loco-extra-${c.locos.length}`;
  c.locos.push(loco);
  return loco;
}

describe('founding the company', () => {
  it('costs the charter, less for a Leader or a head for Business, and comes with a headquarters', () => {
    const c = newConductor();
    expect(charterPrice(c)).toBe(B.EMPIRE.charter);
    expect(charterPrice(newConductor([offer('leader')]))).toBe(B.EMPIRE.charter * 0.25);
    expect(charterPrice(newConductor([offer('business')]))).toBe(B.EMPIRE.charter * 0.25);
    expect(() => actions.foundCompany(c, { name: 'Ironhand Rail', hq: 'chicago' })).toThrow(/Not enough/);
    c.lt = 20000;
    expect(() => actions.foundCompany(c, { name: 'I', hq: 'chicago' })).toThrow(/name/);
    expect(() => actions.foundCompany(c, { name: 'Ironhand Rail', hq: 'atlantis' })).toThrow(/headquarters/);
    // Seattle is on the West Coast lines: not with an Apprentice licence.
    expect(() => actions.foundCompany(c, { name: 'Ironhand Rail', hq: 'seattle' })).toThrow(/licence/);
    actions.foundCompany(c, { name: '  Ironhand   Rail  ', hq: 'chicago' });
    expect(c.lt).toBe(20000 - B.EMPIRE.charter);
    expect(c.empire).toMatchObject({ name: 'Ironhand Rail', hq: 'chicago', terminals: { chicago: 1 }, routes: [], till: 0 });
    expect(() => actions.foundCompany(c, { name: 'Another', hq: 'stlouis' })).toThrow(/already/);
  });
});

describe('terminals', () => {
  it('cost more where more lines meet, add a garage bay each, and grow twice', () => {
    const c = newConductor();
    c.lt = 500000;
    expect(() => actions.buyTerminal(c, { city: 'stlouis' })).toThrow(/Found your company/);
    actions.foundCompany(c, { name: 'Ironhand Rail', hq: 'chicago' });
    // Chicago: lines to St. Louis, Omaha, Minneapolis and Pittsburgh.
    expect(terminalPrice('chicago')).toBe(3000 + 1500 * 4);
    expect(terminalPrice('miami')).toBe(3000 + 1500 * 1);
    expect(garageSlots(c)).toBe(B.LOCO.garageSlots + 1);
    const before = c.lt;
    actions.buyTerminal(c, { city: 'stlouis' });
    expect(c.lt).toBe(before - terminalPrice('stlouis'));
    expect(garageSlots(c)).toBe(B.LOCO.garageSlots + 2);
    expect(() => actions.buyTerminal(c, { city: 'stlouis' })).toThrow(/already/);
    expect(() => actions.buyTerminal(c, { city: 'miami' })).toThrow(/licence/);
    expect(operatedLines(c).map((line) => line.id)).toEqual(['chicago-stlouis']);
    expect(terminalUpgradePrice(c, 'stlouis')).toBe(terminalPrice('stlouis') * 2);
    actions.upgradeTerminal(c, { city: 'stlouis' });
    expect(terminalUpgradePrice(c, 'stlouis')).toBe(terminalPrice('stlouis') * 4);
    actions.upgradeTerminal(c, { city: 'stlouis' });
    expect(c.empire.terminals.stlouis).toBe(3);
    expect(() => actions.upgradeTerminal(c, { city: 'stlouis' })).toThrow(/as big/);
    expect(() => actions.upgradeTerminal(c, { city: 'omaha' })).toThrow(/no terminal/);
  });
});

describe('freight routes', () => {
  function company() {
    const c = newConductor();
    c.lt = 500000;
    actions.foundCompany(c, { name: 'Ironhand Rail', hq: 'chicago' });
    actions.buyTerminal(c, { city: 'stlouis' });
    return c;
  }

  it('need a terminal at each end and a locomotive that is not on the main line', () => {
    const c = company();
    const spare = addLoco(c);
    expect(() => actions.assignRoute(c, { locoId: c.activeLocoId, lineId: 'chicago-stlouis' })).toThrow(/main line/);
    expect(() => actions.assignRoute(c, { locoId: spare.id, lineId: 'stlouis-kansascity' })).toThrow(/both ends/);
    expect(() => actions.assignRoute(c, { locoId: spare.id, lineId: 'losangeles-sanfrancisco' })).toThrow(/Road Foreman/);
    actions.assignRoute(c, { locoId: spare.id, lineId: 'chicago-stlouis' });
    expect(c.empire.routes).toHaveLength(1);
    // One locomotive to a line.
    const third = addLoco(c);
    expect(() => actions.assignRoute(c, { locoId: third.id, lineId: 'chicago-stlouis' })).toThrow(/already works/);
    // Moving a locomotive to another line takes it off the first.
    actions.buyTerminal(c, { city: 'omaha' });
    actions.assignRoute(c, { locoId: spare.id, lineId: 'omaha-chicago' });
    expect(c.empire.routes).toEqual([expect.objectContaining({ locoId: spare.id, lineId: 'omaha-chicago' })]);
    // It cannot be sold while it works; taking it onto the main line recalls it.
    expect(() => actions.sellLoco(c, { id: spare.id })).toThrow(/Recall/);
    const report = actions.setActiveLoco(c, { id: spare.id });
    expect(report.recalled).toMatch(/Omaha/);
    expect(c.empire.routes).toHaveLength(0);
  });

  it('earn by the real clock into the till, up to three days of takings; collecting banks it', () => {
    const c = company();
    const spare = addLoco(c);
    actions.assignRoute(c, { locoId: spare.id, lineId: 'chicago-stlouis' });
    const perDay = empireIncome(c);
    const quote = routeQuote(c, spare, lineById('chicago-stlouis'));
    expect(perDay).toBeCloseTo(quote.perDay, 6);
    expect(quote.perHour).toBeCloseTo(perDay / 24, 6);
    console.log(`starter on Chicago - St. Louis: ${quote.perHour.toFixed(0)} LT a real hour, ${perDay.toFixed(0)} a real day (${quote.tons.toFixed(1)} tons at ${quote.mph.toFixed(0)} mph, ${quote.tripsPerDay.toFixed(1)} trips a day)`);
    // A starter engine should earn something like a few decent deliveries a real day: not a fortune, not nothing.
    expect(perDay).toBeGreaterThan(600);
    expect(perDay).toBeLessThan(3600);
    expect(() => actions.collectTill(c)).toThrow(/Nothing/);
    // Two real hours pass (the save is opened again two hours later).
    const HOUR = 3600000;
    actions.refreshWorld(c, { now: NOW + 2 * HOUR });
    expect(c.empire.till).toBeCloseTo(quote.perHour * 2, 0);
    const lt = c.lt;
    const { amount } = actions.collectTill(c);
    expect(amount).toBe(Math.floor(quote.perHour * 2));
    expect(c.lt).toBe(lt + amount);
    expect(c.empire.earned).toBe(amount);
    expect(c.empire.till).toBeLessThan(1);
    // The till stops filling at the cap, however long the absence.
    actions.refreshWorld(c, { now: NOW + 24 * 40 * HOUR });
    expect(tillCap(c)).toBeCloseTo((empireIncome(c) / 24) * B.EMPIRE.tillHours, 4);
    expect(c.empire.till).toBeCloseTo(tillCap(c), 0);
  });

  it('cannot be hurried: resting, forfeiting runs and trials move the calendar but no freight', () => {
    const c = company();
    const spare = addLoco(c);
    actions.assignRoute(c, { locoId: spare.id, lineId: 'chicago-stlouis' });
    const clock = c.clock;
    // Rest for a month of game days.
    actions.rest(c, { hours: 24 * 30 });
    expect(c.clock).toBe(clock + 24 * 30 * 60);
    expect(c.empire.till).toBe(0);
    // A forfeited run, a trial and a finished delivery, all settled at the same real moment.
    const job = c.board.simple[0];
    const result = { reason: 'forfeit', finished: false, distance: 5, gameSeconds: 600, fuelLoaded: 10, fuelUsed: 5, fuelLeft: 5, emergencyGallons: 0, emergencyCost: 0, standings: [] };
    actions.settleRun(c, { ctx: { kind: 'delivery', jobId: job.id }, result, now: NOW });
    actions.settleRun(c, { ctx: { kind: 'trial', trial: 'timetrial' }, result: { ...result, realSeconds: 5 }, now: NOW });
    const done = c.board.simple[0];
    actions.settleRun(c, { ctx: { kind: 'delivery', jobId: done.id, haul: 1 }, result: { ...result, reason: 'finished', finished: true, place: 1, field: 1, distance: done.distance, gameSeconds: 6000, realSeconds: 240, timeLimit: done.timeLimit, underLimitPct: 50 }, now: NOW });
    expect(c.empire.till).toBe(0);
    // But a run that took five real minutes is five minutes of freight.
    const next = c.board.simple[0];
    actions.settleRun(c, { ctx: { kind: 'delivery', jobId: next.id, haul: 1 }, result: { ...result, reason: 'finished', finished: true, place: 1, field: 1, distance: next.distance, gameSeconds: 6000, realSeconds: 300, timeLimit: next.timeLimit, underLimitPct: 50 }, now: NOW + 5 * 60000 });
    expect(c.empire.till).toBeCloseTo((empireIncome(c) / 24 / 60) * 5, 0);
    expect(c.empire.till).toBeGreaterThan(0);
  });

  it('pay more with a stronger engine, bigger terminals, Logistics research and a higher rank', () => {
    const c = company();
    const spare = addLoco(c);
    const line = lineById('chicago-stlouis');
    const base = routeQuote(c, spare, line).perDay;
    const phoenix = { ...makePhoenix(makeRng(3)), id: 'loco-phoenix' };
    c.locos.push(phoenix);
    expect(routeQuote(c, phoenix, line).perDay).toBeGreaterThan(base * 1.8);
    actions.upgradeTerminal(c, { city: 'chicago' });
    expect(routeQuote(c, spare, line).terminals).toBeCloseTo(1 + B.EMPIRE.terminal.boost, 6);
    c.research.done.logistics = 2;
    expect(routeQuote(c, spare, line).logistics).toBeCloseTo(1 + 2 * B.RESEARCH.logistics, 6);
    expect(routeQuote(c, spare, line).rank).toBeGreaterThanOrEqual(1);
    // An efficient engine keeps more of what it hauls.
    const thrifty = addLoco(c, { model: 'longrun', efficiency: 12 });
    expect(routeQuote(c, thrifty, line).eco).toBeGreaterThan(routeQuote(c, spare, line).eco);
  });

  it('a boss at large raids the freight on its line until it is brought down', () => {
    const c = newConductor();
    c.lt = 500000;
    actions.foundCompany(c, { name: 'Ironhand Rail', hq: 'kansascity' });
    actions.buyTerminal(c, { city: 'dallas' });
    const spare = addLoco(c);
    actions.assignRoute(c, { locoId: spare.id, lineId: 'kansascity-dallas' });
    const raided = routeQuote(c, spare, lineById('kansascity-dallas'));
    expect(raided.raider).toBe('rustjaw');
    expect(raided.raid).toBeCloseTo(1 - B.BOSS.raidCut, 6);
    c.bounties = { rustjaw: { kills: 1, best: 80, slainDay: 0 } };
    const safe = routeQuote(c, spare, lineById('kansascity-dallas'));
    expect(safe.raider).toBeNull();
    expect(safe.perDay).toBeGreaterThan(raided.perDay * 1.3);
  });
});

describe('empire rating and rank', () => {
  it('adds up everything the conductor has built', () => {
    const c = newConductor();
    const start = empireRating(c);
    expect(start.total).toBeGreaterThan(300);
    expect(start.total).toBeLessThan(B.EMPIRE.ranks[1].rating);
    expect(start.parts.map((part) => part.id)).toEqual(['fleet', 'conductor', 'lt', 'works', 'standing', 'network', 'glory']);
    expect(empireRank(c)).toMatchObject({ id: 'yard', index: 0 });
    expect(empireRank(c).next.id).toBe('runner');
    c.lt = 500000;
    actions.foundCompany(c, { name: 'Ironhand Rail', hq: 'chicago' });
    actions.buyTerminal(c, { city: 'stlouis' });
    const spare = addLoco(c);
    actions.assignRoute(c, { locoId: spare.id, lineId: 'chicago-stlouis' });
    c.bounties = { rustjaw: { kills: 2, best: 80, slainDay: 0 } };
    c.relics = { rustjaw: { at: 0 } };
    c.research.done.engine = 2;
    const grown = empireRating(c);
    const R = B.EMPIRE.rating;
    expect(grown.parts.find((part) => part.id === 'network').value).toBe(2 * R.terminal + R.route);
    expect(grown.parts.find((part) => part.id === 'glory').value).toBe(R.boss + R.relic);
    expect(grown.parts.find((part) => part.id === 'works').value).toBe(2 * R.research);
    // Money counts, but only so far.
    expect(grown.parts.find((part) => part.id === 'lt').value).toBe(Math.round(Math.min(R.ltCap, c.lt * R.perLt)));
    expect(empireRank(c).index).toBeGreaterThan(0);
    // A higher rank pays on every route.
    expect(empireRank(c).income).toBeGreaterThan(0);
  });
});

describe('research lines and crew traits', () => {
  it('Ordnance makes fitted weapons hit harder; a new save has both new lines at tier 0', () => {
    const c = newConductor();
    expect(c.research.done).toMatchObject({ logistics: 0, ordnance: 0 });
    expect(deriveStats(c.locos[0], c).weaponPower).toBe(1);
    c.research.done.ordnance = 3;
    expect(deriveStats(c.locos[0], c).weaponPower).toBeCloseTo(1 + 3 * B.RESEARCH.ordnance, 6);
    c.lt = 100000;
    actions.startResearch(c, { category: 'logistics' });
    expect(c.research.active).toMatchObject({ category: 'logistics', tier: 0 });
    // An older save without the new lines can still start them.
    const old = newConductor();
    delete old.research.done.logistics;
    old.lt = 100000;
    actions.startResearch(old, { category: 'logistics' });
    expect(old.research.active.tier).toBe(0);
  });

  it('traits held as plain ids (crate conductors) count like any other', async () => {
    expect(traitPower({ traits: ['leader'] }, 'leader')).toBe(1);
    expect(traitPower({ traits: ['leader', 'amplify'] }, 'leader')).toBeCloseTo(1.5);
    expect(traitPower({ traits: [{ id: 'leader', mult: 1.2 }] }, 'leader')).toBeCloseTo(1.2);
    const C = await import('../src/game/crates.js');
    const save = C.makeCaptainSave(newConductor(), { focus: 'business', crewName: 'Rookie' });
    const crew = C.poolNfts('epic').find((e) => e.kind === 'conductor');
    C.placeNft(save, crew);
    actions.seatCrew(save, { locoId: save.activeLocoId, crewId: crew.data.id });
    // The seated conductor's traits are now the save's, in the shape every rule reads.
    expect(save.traits.length).toBe(crew.data.traits.length);
    for (const trait of save.traits) expect(traitPower(save, trait.id)).toBeGreaterThan(0);
  });
});
