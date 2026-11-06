import { B } from './balance.js';
import { pick, randInt, shuffle } from './rng.js';
import { ACTIVE_TRAIT_IDS, SCALING_TRAIT_IDS, TRAITS, hasTrait, traitPower, traitsFromOffer } from './traits.js';

export const FIRST_NAMES = ['Jedediah', 'Silas', 'Barnaby', 'Cletus', 'Elias', 'Abner', 'Phineas', 'Beauregard', 'Hattie', 'Odessa', 'Winifred', 'Clementine', 'Ezra', 'Josiah', 'Mabel', 'Cornelius'];
export const LAST_NAMES = ['Ironhand', 'Steamwhistle', 'Blackwood', 'Cogsworth', 'Gritstone', 'Railrider', 'Boilerman', 'Stoker', 'Ashby', 'Coalgate', 'Tinderbox', 'Flintlock', 'Brasswell', 'Kettleby', 'Underhill', 'Wainwright'];

export const randomName = (rng) => `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`;

export const ATTRIBUTES = {
  str: { name: 'Strength', gives: 'Horsepower and torque' },
  agi: { name: 'Agility', gives: 'Fuel economy, lighter locomotive' },
  int: { name: 'Intelligence', gives: 'Research speed, spell damage, sharper estimates' },
  end: { name: 'Endurance', gives: 'Engine runs cooler: less heat every mile' },
};

// ---------- Trait offers ----------

// One trait card on the table. Most are plain; some come up Profound, Gifted or Infused.
export function dealOffer(rng, takenIds) {
  const taken = new Set(takenIds);
  const free = ACTIVE_TRAIT_IDS.filter((id) => !taken.has(id));
  if (free.length === 0) return null;
  const id = pick(rng, free);
  const R = B.TRAIT_RARITY;
  const roll = rng();
  let rarity = 'normal';
  if (roll < R.profound) rarity = 'profound';
  else if (roll < R.profound + R.gifted) rarity = 'gifted';
  else if (roll < R.profound + R.gifted + R.infused) rarity = 'infused';

  const scales = !!TRAITS[id].scales;
  if (rarity === 'profound' && !scales) rarity = 'normal';
  if (rarity === 'infused') {
    const partners = SCALING_TRAIT_IDS.filter((other) => other !== id && !taken.has(other));
    if (!scales || partners.length === 0) rarity = 'normal';
    else return { key: `${id}+${rng().toString(36).slice(2, 7)}`, ids: [id, pick(rng, partners)], rarity };
  }
  return { key: `${id}-${rng().toString(36).slice(2, 7)}`, ids: [id], rarity };
}

export function dealOffers(rng, count, takenIds = []) {
  const offers = [];
  const taken = [...takenIds];
  for (let i = 0; i < count; i++) {
    const offer = dealOffer(rng, taken);
    if (!offer) break;
    offers.push(offer);
    taken.push(...offer.ids);
  }
  return offers;
}

export const offerIds = (offers) => offers.flatMap((offer) => offer.ids);
export const offerHas = (offers, id) => offers.some((offer) => offer.ids.includes(id));

// A stand-in conductor so trait helpers work on a half-built character.
const draft = (chosen) => ({ traits: chosen.flatMap(traitsFromOffer) });

export const picksAllowed = (chosen) =>
  B.START.traitPicks + (offerHas(chosen, 'prodigy') ? B.START.prodigyExtraPicks : 0);

export const picksUsed = (chosen) => chosen.filter((offer) => offer.rarity !== 'gifted').length;

export function rerollsAllowed(chosen) {
  const power = traitPower(draft(chosen), 'secondchances');
  return B.START.rerolls + (power > 0 ? Math.max(1, Math.round(2 * power)) : 0);
}

// ---------- Dice ----------

export function rollDie(rng, chosen) {
  const d = draft(chosen);
  let parts;
  if (hasTrait(d, 'consistent')) parts = [randInt(rng, 1, 6), randInt(rng, 1, 6), randInt(rng, 1, 6)];
  else parts = [randInt(rng, 1, 20)];
  const lucky = hasTrait(d, 'lucky') ? 1 : 0;
  const raw = parts.reduce((sum, n) => sum + n, 0);
  return { id: rng().toString(36).slice(2, 8), parts, lucky, value: Math.min(B.ATTR.max, raw + lucky) };
}

export const rollDice = (rng, chosen) => Array.from({ length: B.START.dice }, () => rollDie(rng, chosen));

// ---------- Starter advice ----------

export function recommendStarter({ str, agi, int, end = 0 }) {
  if (end > str && end > agi && end >= int) return { model: 'longrun', why: 'Your Endurance keeps the engine cool over long hauls, and Long Run is built for distance.' };
  if (str >= agi && str >= int) return { model: 'bullet', why: 'Your Strength adds horsepower, and Bullet turns horsepower into speed.' };
  if (agi >= str && agi >= int) return { model: 'longrun', why: 'Your Agility stretches every gallon, and Long Run is built for distance.' };
  return { model: 'stable', why: 'Your Intelligence pays off over time, and Stable is steady while you research.' };
}

// ---------- The finished conductor ----------

export function buildConductor({ name, chosen, attributes, rerollsLeft, loco, seed, now }) {
  const traits = chosen.flatMap(traitsFromOffer);
  // The starting kit: a Basic Cannon and one Fuel Storage slot fitted, and one container.
  // A Captain in Nexus Rail starts with no locomotive: their first one comes from a crate.
  loco = loco ? { ...loco, fit: [...B.ARMORY.startKit], condition: 1 } : null;
  const conductor = {
    version: 6,
    clock: B.CALENDAR.startMinute, // game minutes since Day 1, Month 1, Year 1
    lastSeen: now,
    arsenal: [], // weapons on the shelf, not fitted
    name: name.trim(),
    createdAt: now,
    traits,
    str: attributes.str,
    agi: attributes.agi,
    int: attributes.int,
    end: attributes.end ?? 0,
    level: 1,
    xp: 0,
    attributePoints: 0,
    lt: 0,
    fuel: { gallons: 0, basis: 0 },
    containers: B.FUEL.startContainers,
    gear: {}, // modules bought but not fitted: { moduleId: count }
    locos: loco ? [loco] : [],
    activeLocoId: loco?.id ?? null,
    research: { done: { engine: 0, efficiency: 0, structure: 0 }, active: null },
    companies: {},
    board: null,
    depot: { bucket: -1, bought: 0 },
    station: { stock: [], sinceRefresh: 0 },
    testRaceDone: false,
    history: [],
    stats: { runs: 0, wins: 0, miles: 0, earned: 0 },
    seed,
  };
  const S = B.START;
  const economist = traitPower(conductor, 'economist');
  conductor.lt = Math.floor(S.lt * (1 + 0.25 * economist)) + rerollsLeft * S.rerollBonusLt;
  const prepared = traitPower(conductor, 'prepared');
  const gallons = S.fuel + Math.round(B.FUEL.preparedStartPerPower * (loco?.power ?? 0) * prepared);
  conductor.fuel = { gallons, basis: gallons * S.fuelPrice };
  return conductor;
}

export const startingKitPreview = (chosen, rerollsLeft, loco) => {
  const d = draft(chosen);
  return {
    lt: Math.floor(B.START.lt * (1 + 0.25 * traitPower(d, 'economist'))) + rerollsLeft * B.START.rerollBonusLt,
    fuel: B.START.fuel + (loco ? Math.round(B.FUEL.preparedStartPerPower * loco.power * traitPower(d, 'prepared')) : 0),
  };
};

// ---------- Experience ----------

export function xpForLevel(level) {
  let xp = B.XP.first;
  for (let i = 2; i <= level; i++) xp = Math.floor(xp * (i <= 25 ? B.XP.growth : B.XP.growthAfter25));
  return xp;
}

// Adds experience to a conductor (mutates it). Returns how many levels were gained.
export function addXp(conductor, amount) {
  conductor.xp += Math.max(0, Math.floor(amount));
  let gained = 0;
  const cap = conductor.captain ? 30 : Infinity;
  while (conductor.level < cap && conductor.xp >= xpForLevel(conductor.level)) {
    conductor.xp -= xpForLevel(conductor.level);
    conductor.level += 1;
    if (!conductor.captain) conductor.attributePoints += 1;
    gained += 1;
  }
  return gained;
}

export const activeLoco = (conductor) => conductor.locos.find((loco) => loco.id === conductor.activeLocoId) ?? conductor.locos[0];

export const avgFuelCost = (conductor) => (conductor.fuel.gallons > 0.01 ? conductor.fuel.basis / conductor.fuel.gallons : 0);

export { shuffle };
