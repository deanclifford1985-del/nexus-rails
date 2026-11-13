import { talent } from './captain.js';
import { B } from './balance.js';
import { makeRng, pick, round1 } from './rng.js';
import { traitPower } from './traits.js';
import { LEGEND_MODELS, STARTER_MODELS, generateLoco, makeMythic, makePhoenix } from './locomotives.js';
import { weekOf } from './calendar.js';

// ---------- Fuel ----------
// The depot's price and stock, and the week's deal, are rolled per game week. Same week, same numbers.

const weekRng = (week, salt) => makeRng(((week + 1) * 2654435761 + salt) >>> 0);
export const weekNow = (conductor) => weekOf(conductor.clock ?? B.CALENDAR.startMinute);

export function fuelMarket(week) {
  const rng = weekRng(week, 1);
  const F = B.FUEL;
  const price = F.base * (1 - F.swing + 2 * F.swing * rng());
  const stock = F.stock[0] + Math.floor(rng() * (F.stock[1] - F.stock[0] + 1));
  return { week, price: Math.round(price * 100) / 100, stock };
}

// This week's depot deal, or null.
export function weeklyDeal(week) {
  const rng = weekRng(week, 7);
  if (rng() > B.WEEK.dealChance) return null;
  const id = pick(rng, Object.keys(B.WEEK.deals));
  return { id, ...B.WEEK.deals[id] };
}
const dealMult = (conductor, key) => weeklyDeal(weekNow(conductor))?.[key] ?? 1;
export const containerPrice = (conductor) => Math.round(B.FUEL.containerPrice * dealMult(conductor, 'container') * (1 - Math.min(0.5, talent(conductor, 'containerPrice'))));
export const repairMult = (conductor) => dealMult(conductor, 'repair') * (1 - Math.min(0.5, talent(conductor, 'containerPrice')));

export function depotStockLeft(conductor) {
  const market = fuelMarket(weekNow(conductor));
  const bought = conductor.depot.week === market.week ? conductor.depot.bought : 0;
  return Math.max(0, market.stock - bought);
}

// What this conductor pays per gallon at the depot for a purchase of `gallons`.
export function depotPrice(conductor, gallons = 0) {
  const F = B.FUEL;
  let price = fuelMarket(weekNow(conductor)).price * dealMult(conductor, 'fuel');
  price *= 1 - Math.min(0.5, F.economist * traitPower(conductor, 'economist'));
  price *= 1 - Math.min(0.5, talent(conductor, 'fuelPrice'));
  if (gallons >= F.preparedAt) price *= 1 - Math.min(0.5, F.prepared * traitPower(conductor, 'prepared'));
  return Math.round(price * 100) / 100;
}

// The trackside pump at race setup never runs dry, but costs more.
export function pumpPrice(conductor, gallons = 0) {
  return Math.round(depotPrice(conductor, gallons) * (1 + B.FUEL.pumpMarkup) * 100) / 100;
}

// ---------- Workshop ----------

export function upgradeCost(conductor, stage) {
  const W = B.WORKSHOP;
  const base = W.costs[stage];
  if (base === undefined) return null;
  return Math.round(base * (1 - Math.min(0.6, W.engineer * traitPower(conductor, 'engineer'))));
}

export const stagesUnlocked = (conductor, researchKey) => (conductor.research.done[researchKey] ?? 0) * B.WORKSHOP.stagesPerTier;

// ---------- Research ----------

// The first three open workshop stages, two a tier. The others pay out directly, a step a tier.
export const RESEARCH = {
  engine: { name: 'Engine advancements', unlocks: 'Engine upgrades' },
  efficiency: { name: 'Efficiency advancements', unlocks: 'Aerodynamics upgrades' },
  structure: { name: 'Structural improvements', unlocks: 'Body and fuel storage upgrades' },
  logistics: { name: 'Logistics', bonus: `Every freight route in your empire brings in ${Math.round(B.RESEARCH.logistics * 100)}% more per tier.` },
  ordnance: { name: 'Ordnance', bonus: `Every weapon fitted to your locomotives hits ${Math.round(B.RESEARCH.ordnance * 100)}% harder per tier.` },
};

// Research is paid up front (Intelligence stretches each LT) and then takes game days.
export function researchRates(conductor, tier) {
  const R = B.RESEARCH;
  const cost = R.costs[tier];
  const influence = 1 + traitPower(conductor, 'influencer');
  const speed = (1 + conductor.int * B.ATTR.researchSpeedPerInt * influence + R.genius * traitPower(conductor, 'genius')) * (1 + talent(conductor, 'research') + talent(conductor, 'breakthrough'));
  const match = 1 + conductor.int * B.ATTR.researchMatchPerInt * influence;
  return {
    cost,
    speed,
    match,
    price: Math.ceil((cost / match) * (1 - Math.min(0.5, talent(conductor, 'researchPrice')))),
    minutes: Math.round((R.days[tier] * 24 * 60) / speed),
  };
}

// ---------- Station ----------

export function generateStationStock(rng) {
  const stock = [];
  for (let i = 0; i < B.STATION.stock; i++) stock.push(generateLoco(rng, pick(rng, STARTER_MODELS)));
  return stock;
}

export const phoenixForSale = (() => {
  let cached = null;
  return () => {
    if (!cached) cached = { ...makePhoenix(makeRng(777)), id: 'phoenix' };
    return cached;
  };
})();

// The legendary machines in the Hall of Legends. Some are always for sale (at a price); the rest
// are forged from a boss relic (see legendOffer in bosses.js).
const mythicCache = {};
export function mythicForSale(model) {
  if (!LEGEND_MODELS.includes(model)) return null;
  if (!mythicCache[model]) mythicCache[model] = { ...makeMythic(makeRng(hashText(model)), model), id: model };
  return mythicCache[model];
}
const hashText = (text) => [...text].reduce((h, ch) => (Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0), 2166136261);

// What it costs to repair `pct` percent of durability (capped at what is missing).
export function repairQuote(loco, pct, mult = 1) {
  const L = B.LOCO;
  const missing = Math.round((1 - (loco.condition ?? 1)) * 1000) / 10;
  const amount = Math.max(0, Math.min(missing, pct));
  const perPct = Math.min(L.repairMaxPerPct, Math.max(L.repairMinPerPct, (loco.price || 2000) * L.repairPerPct)) * mult;
  return { pct: amount, perPct: Math.round(perPct), cost: Math.ceil(amount * perPct) };
}

export const fmtLt = (value) => `${round1(value).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} LT`;
