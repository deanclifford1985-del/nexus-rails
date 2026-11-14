import { B } from './balance.js';
import { CITIES, LINES, licenceLevel, lineById, lineOpen } from './routemap.js';
import { deriveStats, quoteLoad } from './locomotives.js';
import { traitPower } from './traits.js';
import { talent } from './captain.js';
import { locoRating } from './power.js';
import { BOSS_IDS, bossRecord, raiderOn, relicCount } from './bosses.js';
import { starsFor } from './jobs.js';

// The empire: a railway company. The conductor founds it, opens terminals in real cities, and puts
// the locomotives in the garage to work on freight routes between them. Routes earn on the real
// clock, so they keep earning through every hour of play and every hour away (and cannot be
// hurried by resting or by anything else that only moves the game calendar).
// Every number is in balance.js (B.EMPIRE). Saves change only through actions.js.

const E = () => B.EMPIRE;

export const hasEmpire = (conductor) => !!conductor.empire;
export const terminalLevel = (conductor, cityId) => conductor.empire?.terminals?.[cityId] ?? 0;
export const terminalCount = (conductor) => Object.keys(conductor.empire?.terminals ?? {}).length;
export const routesOf = (conductor) => conductor.empire?.routes ?? [];
export const routeOfLoco = (conductor, locoId) => routesOf(conductor).find((route) => route.locoId === locoId) ?? null;
export const routeOnLine = (conductor, lineId) => routesOf(conductor).find((route) => route.lineId === lineId) ?? null;

// Garage bays: the yard's own, plus one for every terminal.
export function garageSlots(conductor) {
  return Math.min(E().baysMax, B.LOCO.garageSlots + terminalCount(conductor) * E().baysPerTerminal);
}

// ---------- founding ----------

export function charterPrice(conductor) {
  const discount = traitPower(conductor, 'leader') > 0 || traitPower(conductor, 'business') > 0 ? E().charterDiscount : 0;
  return Math.round(E().charter * (1 - discount));
}

export const linesAt = (cityId) => LINES.filter((line) => line.a === cityId || line.b === cityId);
// Cities a conductor may build in: any city on a line their licence has opened.
export const cityOpen = (conductor, cityId) => linesAt(cityId).some((line) => lineOpen(conductor, line));
export const openCities = (conductor) => Object.keys(CITIES).filter((id) => cityOpen(conductor, id));

// ---------- terminals ----------

export function terminalPrice(cityId) {
  const D = E().terminal;
  return D.base + D.perLine * linesAt(cityId).length;
}
// What the next level of this terminal costs, or null at the top level.
export function terminalUpgradePrice(conductor, cityId) {
  const D = E().terminal;
  const level = terminalLevel(conductor, cityId);
  if (level <= 0 || level >= D.levels) return null;
  return terminalPrice(cityId) * D.upgrade[level];
}

// A line is worked between two terminals: the company operates it once it has one at each end.
export const operates = (conductor, line) => terminalLevel(conductor, line.a) > 0 && terminalLevel(conductor, line.b) > 0 && lineOpen(conductor, line);
export const operatedLines = (conductor) => LINES.filter((line) => operates(conductor, line));

// ---------- rating and rank ----------

const sum = (list, fn) => list.reduce((total, item) => total + fn(item), 0);

/**
 * Empire Power Rating: one number for everything the conductor has built. Returns the total and
 * the parts it is made of, so the Empire screen can show where it comes from.
 */
export function empireRating(conductor) {
  const R = E().rating;
  const companies = Object.values(conductor.companies ?? {});
  const research = Object.values(conductor.research?.done ?? {}).reduce((a, b) => a + b, 0);
  const upgrades = sum(conductor.locos ?? [], (loco) => Object.values(loco.upgrades ?? {}).reduce((n, list) => n + list.length, 0));
  const bossesDown = BOSS_IDS.filter((id) => bossRecord(conductor, id).kills > 0).length;
  const medals = sum(Object.values(conductor.trials ?? {}), (t) => ({ gold: 3, silver: 2, bronze: 1 }[t.medal] ?? 0));
  const parts = [
    { id: 'fleet', label: 'Locomotives', value: sum(conductor.locos ?? [], (loco) => locoRating(loco)) },
    { id: 'conductor', label: 'Conductor', value: (conductor.level ?? 1) * R.level + licenceLevel(conductor) * R.licence },
    { id: 'lt', label: 'LocoTokens', value: Math.round(Math.min(R.ltCap, (conductor.lt ?? 0) * R.perLt)) },
    { id: 'works', label: 'Research, upgrades', value: research * R.research + upgrades * R.upgrade },
    {
      id: 'standing',
      label: 'Reputation',
      value: sum(companies, (c) => starsFor(c.rep ?? 0) * R.star + (c.contracts ?? 0) * R.contract + (c.wins ?? 0) * R.win + (c.jobs ?? 0) * R.job),
    },
    { id: 'network', label: 'Network', value: sum(Object.values(conductor.empire?.terminals ?? {}), (level) => R.terminal + (level - 1) * R.terminalLevel) + routesOf(conductor).length * R.route },
    { id: 'glory', label: 'Glory', value: bossesDown * R.boss + relicCount(conductor) * R.relic + Object.keys(conductor.trophies ?? {}).length * R.trophy + medals * R.medal },
  ];
  return { total: Math.round(sum(parts, (part) => part.value)), parts };
}

export function empireRank(conductor) {
  const { total } = empireRating(conductor);
  const ranks = E().ranks;
  let index = 0;
  ranks.forEach((rank, i) => {
    if (total >= rank.rating) index = i;
  });
  return { ...ranks[index], index, rating: total, next: ranks[index + 1] ?? null };
}

// ---------- routes ----------

// Who drives a locomotive on a route. A Captain's crew bring their own attributes and traits; in
// Lite the conductor is out on the main line, so routes are worked by hired hands.
function driverOf(conductor, loco) {
  if (!conductor.captain) return null;
  const crew = (conductor.crew ?? []).find((item) => item.id === loco.crewId);
  return crew ? { str: crew.str, agi: crew.agi, int: crew.int, end: crew.end, traits: crew.traits ?? [] } : null;
}

// Freight time: the hours of work on the line that a real hour buys (the calendar's own pace).
export const freightPace = () => B.CALENDAR.driftGameMinutesPerRealMinute;

/**
 * What one locomotive would bring in on one line, and how. `perHour` and `perDay` are LT per REAL
 * hour and per real day (24 of them); `tripsPerDay` is one-way trips in a real day.
 * Works for a route that exists and for one being considered, so the screen can compare.
 */
export function routeQuote(conductor, loco, line) {
  const R = E().route;
  const stats = deriveStats(loco, driverOf(conductor, loco));
  const cargoLb = stats.tow * R.loadShare;
  const tons = cargoLb / stats.cargoFactor / 2000;
  const quote = quoteLoad(stats, cargoLb, stats.tank / 2);
  const mph = Math.max(4, quote.topSpeed * R.cruise * (R.terrain[line.terrain] ?? 1));
  const tripHours = line.miles / mph;
  const roundTripHours = 2 * tripHours + 2 * R.turnaroundHours;
  // One-way trips in a real day: a real hour is `freightPace` hours of work on the line.
  const tripsPerDay = (24 / roundTripHours) * 2 * freightPace();
  const eco = Math.min(R.ecoRange[1], Math.max(R.ecoRange[0], stats.tmpg / R.ecoRef));
  const base = tripsPerDay * line.miles * tons * R.ratePerTonMile * eco;
  // Bonuses: the terminals at each end, the company's rank, Logistics research, a head for business.
  const terminals = 1 + E().terminal.boost * (Math.max(0, terminalLevel(conductor, line.a) - 1) + Math.max(0, terminalLevel(conductor, line.b) - 1));
  const rank = 1 + empireRank(conductor).income;
  const logistics = 1 + B.RESEARCH.logistics * (conductor.research?.done?.logistics ?? 0);
  const business = 1 + R.business * traitPower(conductor, 'business') + talent(conductor, 'pay');
  const raider = raiderOn(conductor, line.id);
  const raid = raider ? 1 - B.BOSS.raidCut : 1;
  const perDay = base * terminals * rank * logistics * business * raid * E().incomeScale;
  return { perDay, perHour: perDay / 24, base, tons, mph, tripsPerDay, tripHours, eco, terminals, rank, logistics, business, raid, raider };
}

export function routeIncome(conductor, route) {
  const loco = (conductor.locos ?? []).find((item) => item.id === route.locoId);
  const line = lineById(route.lineId);
  if (!loco || !line || !operates(conductor, line)) return 0;
  return routeQuote(conductor, loco, line).perDay;
}

// Everything the routes bring in, in LT per real day.
export const empireIncome = (conductor) => sum(routesOf(conductor), (route) => routeIncome(conductor, route));
export const tillCap = (conductor) => (empireIncome(conductor) / 24) * E().tillHours;

// Why this locomotive cannot work this line, or null if it can.
export function routeBlocker(conductor, locoId, lineId) {
  if (!hasEmpire(conductor)) return 'Found your company first.';
  const loco = (conductor.locos ?? []).find((item) => item.id === locoId);
  const line = lineById(lineId);
  if (!loco) return 'No such locomotive.';
  if (!line) return 'No such line.';
  if (loco.id === conductor.activeLocoId) return `${loco.name} is on the main line with you. Switch to another locomotive first.`;
  if (!lineOpen(conductor, line)) return `The ${line.name} line needs the ${B.LICENCES[line.licence].name}.`;
  if (!operates(conductor, line)) return `You need a terminal at both ends of the ${line.name} line.`;
  const other = routeOnLine(conductor, lineId);
  if (other && other.locoId !== locoId) return `Another of your locomotives already works the ${line.name} line.`;
  return null;
}

// Real time passes: every route pays into the till (until the till is full). `realMinutes` is time
// on the real clock, never the game calendar's. Mutates the save.
export function tickEmpire(conductor, realMinutes) {
  const empire = conductor.empire;
  if (!empire || !(realMinutes > 0) || !empire.routes?.length) return 0;
  const perDay = empireIncome(conductor);
  const cap = (perDay / 24) * E().tillHours;
  const before = empire.till ?? 0;
  const after = Math.min(Math.max(cap, before), before + (perDay * realMinutes) / 1440);
  empire.till = Math.round(after * 100) / 100;
  return empire.till - before;
}
