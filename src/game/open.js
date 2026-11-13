import { B } from './balance.js';
import { hashSeed } from './course.js';
import { FIRST_NAMES, LAST_NAMES } from './conductor.js';
import { STARTER_MODELS, abilityOf, makeMythic, makePhoenix } from './locomotives.js';
import { makeRng, pick, randInt, randRange } from './rng.js';
import { rollWeapon } from './weapons.js';
import { weekOf } from './calendar.js';

// The World Open: a circuit of races on real routes around the world. Anyone may enter any event
// for its fee; the fields are built to the event's tier, not to the player, and each is led by a
// named champion in a legendary machine. Numbers are in balance.js (B.OPEN).

const O = () => B.OPEN;
export const OPEN_IDS = Object.keys(B.OPEN.events);
export const openById = (id) => (B.OPEN.events[id] ? { id, ...B.OPEN.events[id] } : null);
const tierIndex = (event) => event.tier - 1;

export const openPurse = (event) => O().placeShare.map((share) => Math.round((O().purse[tierIndex(event)] * share) / 10) * 10);
export const openEntry = (event) => Math.round((O().purse[tierIndex(event)] * O().entryShare) / 10) * 10;

// What this conductor has done on the circuit this week: { week, entered: { id: fee }, done: { id: place } }.
export function openWeek(conductor) {
  const week = weekOf(conductor.clock ?? 0);
  return conductor.open?.week === week ? conductor.open : { week, entered: {}, done: {} };
}
export const openDone = (conductor, id) => openWeek(conductor).done[id] !== undefined;
export const hasTrophy = (conductor, id) => !!conductor.trophies?.[id];
export const trophyCount = (conductor) => OPEN_IDS.filter((id) => hasTrophy(conductor, id)).length;

// A gun of the grade this tier's crews carry.
function gun(rng, base, tier) {
  const rarity = O().weapons[tier];
  return rarity === 'uncommon' ? base : rollWeapon(rng, base, rarity);
}
function kitFor(rng, tier, slots) {
  const fit = ['fuel', gun(rng, rng() < 0.4 ? 'cannon' : 'launcher', tier)];
  const extras = [['plasma', 0.5], ['shield', 0.45], ['heavy', tier >= 2 ? 0.6 : 0.15], ['arc', tier >= 3 ? 0.5 : 0], ['tesla', tier >= 4 ? 0.4 : 0], ['ammo', 0.5]];
  for (const [id, chance] of extras) {
    if (rng() >= chance) continue;
    const need = B.MODULES[id].slots;
    const used = fit.reduce((n, item) => n + B.MODULES[typeof item === 'string' ? item : item.base].slots, 0);
    if (used + need > slots) continue;
    fit.push(['plasma', 'heavy', 'arc', 'tesla'].includes(id) ? gun(rng, id, tier) : id);
  }
  return fit;
}

/**
 * The field of an event: its rivals and its champion, as locomotives with crews. The same event
 * always has the same field, so it can be learned.
 * Each entry is { name, locoName, model, loco, crew, lever, ability, champion }.
 */
export function openField(id) {
  const event = openById(id);
  const t = tierIndex(event);
  const rng = makeRng(hashSeed(`world-open-${id}`));
  const stages = (n) => Array.from({ length: n }, () => 0.05);
  const crew = (attr) => ({ str: attr + randInt(rng, -1, 1), agi: attr + randInt(rng, -1, 1), int: attr + randInt(rng, -1, 1), end: attr + randInt(rng, -1, 1), traits: [] });
  const field = Array.from({ length: O().rivals[t] }, (_, i) => {
    const model = pick(rng, STARTER_MODELS);
    const stat = () => Math.max(1, O().stat[t] + randInt(rng, -1, 1));
    const rarity = O().rarity[t];
    const loco = {
      id: `open-${id}-${i + 1}`,
      model,
      name: model,
      rarity,
      power: stat(),
      efficiency: stat(),
      durability: stat(),
      endurance: stat(),
      hpBase: Math.round(randRange(rng, ...B.LOCO.hpBase)),
      tqBase: Math.round(randRange(rng, ...B.LOCO.tqBase)),
      growth: Math.round(randRange(rng, ...B.LOCO.growth) * 1000) / 1000,
      upgrades: { engine: stages(O().engineStages[t]), aero: [], body: [], tank: [] },
      superTrait: null,
      condition: 1,
    };
    loco.fit = kitFor(rng, t, B.LOCO.capacity[rarity]);
    return { name: `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`, locoName: model[0].toUpperCase() + model.slice(1), model, loco, crew: crew(O().attr[t]), lever: Math.round(randRange(rng, ...B.RACE.aiLever) * 100) / 100, ability: null, champion: false };
  });
  // The champion: a legendary machine (a tuned production engine at the first tier).
  const C = event.champion;
  let loco;
  if (C.model === 'phoenix') loco = makePhoenix(rng);
  else if (B.MYTHIC[C.model]?.price) loco = makeMythic(rng, C.model);
  else loco = { id: 'champion', model: C.model, name: C.model, rarity: C.rarity ?? 'rare', hpBase: 1750, tqBase: 3875, growth: 1.095, superTrait: null, condition: 1 };
  // Whatever it drives is tuned to the class of the event: a little more Power than the field.
  loco.power = O().stat[t] + O().champPower;
  for (const key of ['efficiency', 'durability', 'endurance']) loco[key] = O().stat[t] + 1;
  loco.hpBase = 1750;
  loco.tqBase = 3875;
  loco.growth = 1.095;
  loco.id = `open-${id}-champion`;
  loco.upgrades = { engine: stages(O().engineStages[t]), aero: [], body: [], tank: [] };
  loco.fit = kitFor(rng, t, B.MYTHIC[C.model]?.capacity ?? B.LOCO.capacity[loco.rarity] ?? 5);
  field.push({ name: C.name, title: C.title, locoName: loco.name === C.model ? C.model[0].toUpperCase() + C.model.slice(1) : loco.name, model: C.model, loco, crew: crew(O().champAttr[t]), lever: O().champLever, ability: abilityOf(loco), champion: true });
  return field;
}

// The event as a job the setup and race screens understand.
export function openJob(conductor, id) {
  const event = openById(id);
  if (!event) return null;
  const week = openWeek(conductor);
  return {
    id: `open-${id}`,
    type: 'open',
    openId: id,
    title: event.name,
    from: event.from[0],
    to: event.to[0],
    theme: event.terrain,
    distance: event.miles,
    containers: 0,
    weight: 0,
    boulders: [],
    purse: openPurse(event),
    entryPaid: week.entered[id] ?? 0,
  };
}
