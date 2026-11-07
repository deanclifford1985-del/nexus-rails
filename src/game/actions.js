import { B } from './balance.js';
import { expressById, expressLegs, placeJobs, railRep } from './routemap.js';
import { makeRng, randRange } from './rng.js';
import { traitPower } from './traits.js';
import { activeLoco, addXp, avgFuelCost } from './conductor.js';
import { UPGRADE_TYPES, capacityOf, fitOf, resaleValue, slotsUsed, upgradeStage } from './locomotives.js';
import {
  companyById,
  companyRecord,
  fillCompanyJobs,
  generateBoard,
  generateContract,
  generateRace,
  generateSimpleJob,
  rollHazard,
  jobPay,
  jobXp,
  starsFor,
  COMPANIES,
} from './jobs.js';
import { RESEARCH, containerPrice, depotPrice, depotStockLeft, fuelMarket, generateStationStock, mythicForSale, phoenixForSale, pumpPrice, repairMult, repairQuote, researchRates, stagesUnlocked, upgradeCost, weekNow, weeklyDeal } from './economy.js';
import { festivalInfo, runMinutes, weekOf } from './calendar.js';
import { pointsSpent, talent, talentBlocker } from './captain.js';
import { applyCrew, assignCrew } from './crates.js';
import { armoryOffers, baseOf, isWeaponItem, rollWeapon, standardWeapon, weaponPrice, WEAPON_BASES } from './weapons.js';
import { CONTESTS, PRIZES, medalFor } from './festival.js';
import { findRun } from './setup.js';

// Every change to a save goes through one of these functions.
// Each takes the conductor (already a private copy, safe to mutate) and returns
// a small report for the screen. A rule that says no throws a GameError with a plain message.

export class GameError extends Error {}
const fail = (message) => {
  throw new GameError(message);
};

// Gives an action the save's own random stream and stores where it got to.
function withRng(conductor, fn) {
  const rng = makeRng(conductor.seed);
  const out = fn(rng);
  conductor.seed = rng.state();
  return out;
}

function spend(conductor, amount, what) {
  if (conductor.lt < amount) fail(`Not enough LocoTokens for ${what}. It costs ${amount.toLocaleString()} LT.`);
  conductor.lt = Math.round((conductor.lt - amount) * 10) / 10;
}

// ---------- World upkeep ----------

// The calendar. Everything that happens on the clock goes through advanceClock: research, and
// the weekly turnover of the board, the depot and the station.
function advanceClock(conductor, rng, minutes) {
  if (!(minutes > 0)) return;
  const before = conductor.clock;
  conductor.clock = Math.round(conductor.clock + minutes);
  const active = conductor.research.active;
  if (active) {
    active.done = (active.done ?? 0) + minutes;
    if (active.done >= active.minutes) {
      conductor.research.done[active.category] = active.tier + 1;
      conductor.research.active = null;
      conductor.research.justDone = { category: active.category, tier: active.tier + 1 };
    }
  }
  if (weekOf(before) !== weekOf(conductor.clock)) turnWeek(conductor, rng);
}

// A new game week: a new board, depot delivery, station lot and armory offers.
function turnWeek(conductor, rng) {
  const week = weekOf(conductor.clock);
  conductor.board = generateBoard(rng, week);
  conductor.depot = { week, bought: 0 };
  conductor.station = { stock: generateStationStock(rng), week };
}

// Called when a save is opened and every few seconds while it is open:
// the real clock drifts the calendar forward (capped after a long absence).
export function refreshWorld(conductor, { now }) {
  return withRng(conductor, (rng) => {
    const C = B.CALENDAR;
    if (conductor.clock === undefined) conductor.clock = C.startMinute;
    if (conductor.lastSeen && now > conductor.lastSeen) {
      const realMinutes = (now - conductor.lastSeen) / 60000;
      const drift = Math.floor(Math.min(C.driftCapDays * 24 * 60, realMinutes * C.driftGameMinutesPerRealMinute));
      if (drift >= 1) advanceClock(conductor, rng, drift);
      // Keep the unspent part of a minute; after a capped absence, start afresh.
      const capped = realMinutes * C.driftGameMinutesPerRealMinute > C.driftCapDays * 24 * 60;
      conductor.lastSeen = capped ? now : conductor.lastSeen + (drift / C.driftGameMinutesPerRealMinute) * 60000;
    } else conductor.lastSeen = now;
    const week = weekOf(conductor.clock);
    if (!conductor.board || conductor.board.week !== week) conductor.board = generateBoard(rng, week);
    // Boards posted before prize races existed get this week's races now.
    if (!conductor.board.races) conductor.board.races = Array.from({ length: B.JOBS.race.count }, () => generateRace(rng));
    if (conductor.depot.week !== week) conductor.depot = { week, bought: 0 };
    if (!conductor.station.stock.length || conductor.station.week !== week) conductor.station = { stock: generateStationStock(rng), week };
    fillCompanyJobs(rng, conductor);
    placeJobs(conductor, rng);
    const done = conductor.research.justDone;
    if (done) delete conductor.research.justDone;
    return { researchDone: done ?? null };
  });
}

// ---------- Fuel and supplies ----------

function addFuel(conductor, gallons, cost) {
  conductor.fuel.gallons += gallons;
  conductor.fuel.basis += cost;
}

export function buyFuel(conductor, { gallons, now }) {
  gallons = Math.floor(gallons);
  if (gallons <= 0) fail('Choose how many gallons to buy.');
  const left = depotStockLeft(conductor);
  if (gallons > left) fail(left > 0 ? `The depot only has ${left} gallons left this week.` : 'The depot is sold out until next week.');
  const price = depotPrice(conductor, gallons);
  const cost = Math.ceil(gallons * price * 10) / 10;
  spend(conductor, cost, 'that much fuel');
  addFuel(conductor, gallons, cost);
  const week = weekNow(conductor);
  conductor.depot = { week, bought: (conductor.depot.week === week ? conductor.depot.bought : 0) + gallons };
  return { gallons, cost, price };
}

export function buyPumpFuel(conductor, { gallons, now }) {
  gallons = Math.ceil(gallons);
  if (gallons <= 0) fail('Choose how many gallons to buy.');
  const price = pumpPrice(conductor, gallons);
  const cost = Math.ceil(gallons * price * 10) / 10;
  spend(conductor, cost, 'fuel at the trackside pump');
  addFuel(conductor, gallons, cost);
  return { gallons, cost, price };
}

// A conductor with no fuel and no money for fuel would be stuck, so the company
// fronts enough to get a short job done.
export const canTakeFuelAdvance = (conductor, now) =>
  !(conductor.fuelAdvanceOwed > 0) &&
  conductor.fuel.gallons < B.FUEL.advanceBelowGallons &&
  conductor.lt < B.FUEL.advanceGallons * pumpPrice(conductor);

export function takeFuelAdvance(conductor, { now }) {
  if (!canTakeFuelAdvance(conductor, now)) fail('The fuel advance is only for conductors who are out of both fuel and money.');
  // Fronted at the usual price and taken back out of the next pay.
  const owed = B.FUEL.advanceGallons * B.FUEL.base;
  addFuel(conductor, B.FUEL.advanceGallons, owed);
  conductor.fuelAdvanceOwed = owed;
  return { gallons: B.FUEL.advanceGallons, owed };
}

// This week's deal of a free Ammo Crate, once per conductor per week.
export function claimDeal(conductor) {
  const week = weekNow(conductor);
  const deal = weeklyDeal(week);
  if (!deal?.crate) fail('No free crate this week.');
  if (conductor.claimedWeek === week) fail('Already claimed this week.');
  conductor.claimedWeek = week;
  conductor.gear = { ...(conductor.gear ?? {}), ammo: (conductor.gear?.ammo ?? 0) + 1 };
  return { id: 'ammo' };
}

export function buyContainer(conductor) {
  spend(conductor, containerPrice(conductor), 'a cargo container');
  conductor.containers += 1;
  return { containers: conductor.containers };
}

// ---------- Conductor ----------

export function spendAttributePoint(conductor, { key }) {
  if (!['str', 'agi', 'int', 'end'].includes(key)) fail('Unknown attribute.');
  if (conductor.attributePoints <= 0) fail('No attribute points to spend.');
  conductor.attributePoints -= 1;
  conductor[key] += 1;
  return { key, value: conductor[key] };
}

// ---------- Workshop ----------

export function buyUpgrade(conductor, { type }) {
  const info = UPGRADE_TYPES[type];
  if (!info) fail('Unknown upgrade.');
  const loco = activeLoco(conductor);
  const stage = upgradeStage(loco, type);
  const cost = upgradeCost(conductor, stage);
  if (cost === null) fail(`${info.name} is fully upgraded.`);
  if (stage >= stagesUnlocked(conductor, info.research)) {
    fail(`Research ${RESEARCH[info.research].name} tier ${Math.floor(stage / B.WORKSHOP.stagesPerTier) + 1} to unlock this stage.`);
  }
  spend(conductor, cost, `${info.name} stage ${stage + 1}`);
  return withRng(conductor, (rng) => {
    // The Cargo frame adds a whole Capacity slot; the others a percentage.
    const gain = type === 'tank' ? 1 : Math.round(randRange(rng, ...B.WORKSHOP.gain) * 1000) / 1000;
    loco.upgrades[type] = [...(loco.upgrades[type] ?? []), gain];
    return { type, stage: stage + 1, gain, cost };
  });
}

// ---------- Armory: cargo slots ----------

const moduleInfo = (id) => B.MODULES[id] ?? fail('Unknown module.');

// Weapons are items: the standard ones are always for sale, and each week brings rolled ones.
export function buyWeapon(conductor, { uid, base, fit = false }) {
  let weapon;
  if (base) weapon = { ...standardWeapon(base), uid: `std-${base}-${Math.floor(Math.random() * 1e9).toString(36)}` };
  else {
    const week = weekNow(conductor);
    weapon = armoryOffers(week).find((item) => item.uid === uid);
    if (!weapon) fail('That weapon is no longer on offer.');
    if ((conductor.boughtOffers ?? []).includes(uid)) fail('You already bought that one.');
    conductor.boughtOffers = [...(conductor.boughtOffers ?? []).filter((id) => id.startsWith(`week${week}-`)), uid];
  }
  spend(conductor, weaponPrice(weapon), weapon.name);
  conductor.arsenal = [...(conductor.arsenal ?? []), weapon];
  if (fit) return fitWeapon(conductor, { uid: weapon.uid });
  return { weapon };
}

export function fitWeapon(conductor, { uid }) {
  const weapon = (conductor.arsenal ?? []).find((item) => item.uid === uid);
  if (!weapon) fail('That weapon is not on your shelf.');
  const loco = activeLoco(conductor);
  const fit = fitOf(loco);
  const info = B.MODULES[weapon.base];
  // Weapons can be doubled up; each takes its own slots and has its own reload.
  const free = capacityOf(loco) - slotsUsed(fit);
  if (info.slots > free) fail(`${weapon.name} needs ${info.slots} free slot${info.slots === 1 ? '' : 's'}. ${free} free.`);
  loco.fit = [...fit, weapon];
  conductor.arsenal = conductor.arsenal.filter((item) => item.uid !== uid);
  return { weapon };
}

export function sellWeapon(conductor, { uid }) {
  const weapon = (conductor.arsenal ?? []).find((item) => item.uid === uid);
  if (!weapon) fail('That weapon is not on your shelf.');
  conductor.arsenal = conductor.arsenal.filter((item) => item.uid !== uid);
  const value = Math.floor(weaponPrice(weapon) * B.ARMORY.resale);
  conductor.lt += value;
  return { value };
}

export function buyModule(conductor, { id, fit = false }) {
  if (WEAPON_BASES.includes(id)) return buyWeapon(conductor, { base: id, fit });
  const info = moduleInfo(id);
  spend(conductor, info.price, info.name);
  conductor.gear = { ...(conductor.gear ?? {}), [id]: (conductor.gear?.[id] ?? 0) + 1 };
  if (fit) return fitModule(conductor, { id });
  return { id };
}

export function fitModule(conductor, { id }) {
  const info = moduleInfo(id);
  if (!(conductor.gear?.[id] > 0)) fail(`You have no spare ${info.name}.`);
  const loco = activeLoco(conductor);
  const fit = fitOf(loco);
  if (id === 'shield' && fit.some((item) => baseOf(item) === 'shield')) fail('One shield per locomotive.');
  if (id === 'vent' && fit.some((item) => baseOf(item) === 'vent')) fail('One Coolant Vent per locomotive.');
  const free = capacityOf(loco) - slotsUsed(fit);
  if (info.slots > free) fail(`${info.name} needs ${info.slots} free slot${info.slots === 1 ? '' : 's'}. ${free} free.`);
  loco.fit = [...fit, id];
  conductor.gear[id] -= 1;
  return { id };
}

export function unfitModule(conductor, { index }) {
  const loco = activeLoco(conductor);
  const fit = fitOf(loco);
  const id = fit[index];
  if (!id) fail('Nothing in that slot.');
  loco.fit = fit.filter((_, i) => i !== index);
  // Plain ids from older saves are standard weapons; keep them as items on the shelf.
  if (isWeaponItem(id) || WEAPON_BASES.includes(id)) {
    const weapon = isWeaponItem(id) ? id : { ...standardWeapon(id), uid: `std-${id}-${Math.floor(Math.random() * 1e9).toString(36)}` };
    conductor.arsenal = [...(conductor.arsenal ?? []), weapon];
    return { id: weapon.base };
  }
  conductor.gear = { ...(conductor.gear ?? {}), [id]: (conductor.gear?.[id] ?? 0) + 1 };
  return { id };
}

export function sellModule(conductor, { id }) {
  const info = moduleInfo(id);
  if (!(conductor.gear?.[id] > 0)) fail(`You have no spare ${info.name} to sell.`);
  conductor.gear[id] -= 1;
  const value = Math.floor(info.price * B.ARMORY.resale);
  conductor.lt += value;
  return { value };
}

// ---------- Fronts ----------

// One front per locomotive. The old one is sold back at half its price.
export function buyFront(conductor, { id }) {
  const info = B.FRONTS[id];
  if (!info) fail('Unknown front.');
  const loco = activeLoco(conductor);
  const current = loco.front ?? 'cowcatcher';
  if (current === id) fail(`${loco.name} already has the ${info.name}.`);
  const refund = Math.floor((B.FRONTS[current]?.price ?? 0) * B.FRONT_RESALE);
  if (conductor.lt + refund < info.price) fail(`The ${info.name} costs ${info.price.toLocaleString()} LT.`);
  conductor.lt = Math.round((conductor.lt + refund - info.price) * 10) / 10;
  loco.front = id;
  return { id, refund };
}

// ---------- Repairs ----------

export function repairLoco(conductor, { pct }) {
  const loco = activeLoco(conductor);
  const quote = repairQuote(loco, pct, repairMult(conductor));
  if (quote.pct <= 0) fail('This locomotive is already at full durability.');
  spend(conductor, quote.cost, 'the repair');
  loco.condition = Math.min(1, (loco.condition ?? 1) + quote.pct / 100);
  return quote;
}

// ---------- Research ----------

// Research is paid for up front and then runs on the calendar, so it carries on while you are away.
// Pausing keeps the progress; resuming costs nothing more.
export function startResearch(conductor, { category }) {
  if (!RESEARCH[category]) fail('Unknown research.');
  const tier = conductor.research.done[category];
  if (tier >= B.RESEARCH.costs.length) fail(`${RESEARCH[category].name} is complete.`);
  const active = conductor.research.active;
  if (active) fail(`Pause ${RESEARCH[active.category].name} first. One project runs at a time.`);
  const saved = conductor.research.paused?.[category];
  if (saved && saved.tier === tier) {
    conductor.research.active = saved;
    delete conductor.research.paused[category];
    return { category, tier, resumed: true };
  }
  const rates = researchRates(conductor, tier);
  spend(conductor, rates.price, `${RESEARCH[category].name} tier ${tier + 1}`);
  conductor.research.active = { category, tier, done: 0, minutes: rates.minutes, paid: rates.price };
  return { category, tier, paid: rates.price, minutes: rates.minutes };
}

export function pauseResearch(conductor) {
  const active = conductor.research.active;
  if (!active) return {};
  conductor.research.paused = { ...(conductor.research.paused ?? {}), [active.category]: active };
  conductor.research.active = null;
  return {};
}

// Rest at the yard: lets the calendar (and research) run on by a number of game hours.
export function rest(conductor, { hours }) {
  return withRng(conductor, (rng) => {
    advanceClock(conductor, rng, Math.max(1, hours) * 60);
    const done = conductor.research.justDone;
    if (done) delete conductor.research.justDone;
    return { hours, researchDone: done ?? null };
  });
}

// ---------- Station and garage ----------

export function buyLoco(conductor, { id }) {
  if (conductor.locos.length >= B.LOCO.garageSlots) fail(`Your garage holds ${B.LOCO.garageSlots} locomotives. Sell one first.`);
  const special = id === 'phoenix' || B.MYTHIC[id]?.price;
  const loco = id === 'phoenix' ? phoenixForSale() : special ? mythicForSale(id) : conductor.station.stock.find((item) => item.id === id);
  if (!loco) fail('That locomotive is no longer for sale.');
  if (special && conductor.locos.some((owned) => owned.model === loco.model)) fail(`You already own ${loco.name}.`);
  const isPhoenix = special;
  spend(conductor, loco.price, loco.name);
  return withRng(conductor, (rng) => {
    const owned = structuredClone(loco);
    owned.id = `loco-${Math.floor(rng() * 2176782336).toString(36)}`;
    conductor.locos.push(owned);
    if (!isPhoenix) conductor.station.stock = conductor.station.stock.filter((item) => item.id !== id);
    return { loco: owned };
  });
}

export function sellLoco(conductor, { id }) {
  if (conductor.locos.length <= 1) fail('You cannot sell your only locomotive.');
  if (conductor.locos.find((item) => item.id === id)?.nftId) fail('NFT locomotives go back to the Vault, not the station.');
  if (id === conductor.activeLocoId) fail('Switch to another locomotive before selling this one.');
  const loco = conductor.locos.find((item) => item.id === id);
  if (!loco) fail('Locomotive not found.');
  const value = resaleValue(loco);
  // Whatever was fitted goes back on the shelf.
  for (const item of fitOf(loco)) {
    if (isWeaponItem(item)) conductor.arsenal = [...(conductor.arsenal ?? []), item];
    else conductor.gear = { ...(conductor.gear ?? {}), [item]: (conductor.gear?.[item] ?? 0) + 1 };
  }
  conductor.locos = conductor.locos.filter((item) => item.id !== id);
  conductor.lt += value;
  return { value };
}

export function setActiveLoco(conductor, { id }) {
  if (!conductor.locos.some((loco) => loco.id === id)) fail('Locomotive not found.');
  conductor.activeLocoId = id;
  applyCrew(conductor);
  return {};
}

// ---------- Captain (NFT edition) ----------

export function spendTalent(conductor, { id }) {
  const why = talentBlocker(conductor, id);
  if (why) fail(why);
  conductor.captain.talents = { ...conductor.captain.talents, [id]: (conductor.captain.talents[id] ?? 0) + 1 };
  return { id, rank: conductor.captain.talents[id] };
}

// Wipe every talent point, for a fee that grows with level.
export const respecCost = (conductor) => 100 * Math.max(1, conductor.level ?? 1);
export function resetTalents(conductor) {
  if (!conductor.captain) fail('Only a Captain has talents.');
  if (pointsSpent(conductor) === 0) fail('No talents to reset.');
  spend(conductor, respecCost(conductor), 'a talent reset');
  conductor.captain.talents = {};
  return {};
}

export function seatCrew(conductor, { locoId, crewId }) {
  if (!conductor.captain) fail('Only a Captain hires crew.');
  try {
    assignCrew(conductor, { locoId, crewId });
  } catch (error) {
    fail(error.message);
  }
  return {};
}

// ---------- Settling a run ----------

function gainReputation(conductor, companyId, points) {
  const record = { ...companyRecord(conductor, companyId) };
  const gain = Math.floor(points * (1 + B.JOBS.reputation.diplomat * traitPower(conductor, 'diplomat')) * (1 + talent(conductor, 'rep')));
  record.rep += gain;
  conductor.companies[companyId] = record;
  return gain;
}

// Fuel leaves the reserve at its average cost; what is left in the tank goes back.
function settleFuel(conductor, result) {
  const average = avgFuelCost(conductor);
  const loadedBasis = result.fuelLoaded * average;
  const totalIn = result.fuelLoaded + result.emergencyGallons;
  const totalBasis = loadedBasis + result.emergencyCost;
  const fuelCost = totalIn > 0 ? totalBasis * (result.fuelUsed / totalIn) : 0;
  conductor.fuel.gallons = Math.max(0, conductor.fuel.gallons - result.fuelLoaded + result.fuelLeft);
  conductor.fuel.basis = Math.max(0, conductor.fuel.basis - loadedBasis + (totalBasis - fuelCost));
  if (conductor.fuel.gallons < 0.01) conductor.fuel = { gallons: 0, basis: 0 };
  conductor.lt = Math.round((conductor.lt - result.emergencyCost) * 10) / 10;
  return fuelCost;
}

/**
 * The one place rewards are worked out and applied, for every kind of run.
 * Returns the receipt shown on the results screen.
 */
export function settleRun(conductor, { ctx, result, now }) {
  const J = B.JOBS;
  const receipt = {
    kind: ctx.kind,
    title: '',
    outcome: 'done', // won | lost | delivered | late | forfeit | demo
    lines: [], // money lines: { label, lt }
    payout: 0,
    fuelCost: 0,
    profit: 0,
    xp: 0,
    levels: 0,
    contractsWon: 0,
    reputation: 0,
    company: null,
    result,
  };

  if (ctx.kind === 'demo') {
    receipt.title = 'Phoenix test drive';
    receipt.outcome = 'demo';
    withRng(conductor, (rng) => advanceClock(conductor, rng, 120));
    return receipt;
  }

  // Festival contests: free fuel and rounds, a medal, and a prize.
  if (CONTESTS[ctx.kind]) {
    return withRng(conductor, (rng) => {
      const festival = festivalInfo(conductor.clock);
      const medal = medalFor(ctx.kind, { ...result, contestLoad: ctx.load });
      const prize = PRIZES[medal];
      receipt.title = `Festival: ${CONTESTS[ctx.kind].name}`;
      receipt.outcome = result.reason === 'forfeit' ? 'forfeit' : medal === 'none' ? 'lost' : 'won';
      receipt.medal = medal;
      receipt.load = ctx.load;
      receipt.contest = ctx.kind;
      if (prize.lt) {
        receipt.lines.push({ label: `${medal[0].toUpperCase()}${medal.slice(1)} medal`, lt: prize.lt });
        receipt.payout += prize.lt;
      }
      if (prize.weapon) {
        const weapon = rollWeapon(rng, WEAPON_BASES[Math.floor(rng() * WEAPON_BASES.length)], prize.weapon);
        conductor.arsenal = [...(conductor.arsenal ?? []), weapon];
        receipt.prizeWeapon = weapon;
      }
      conductor.lt = Math.round((conductor.lt + receipt.payout) * 10) / 10;
      receipt.xp = result.reason === 'forfeit' ? 0 : prize.xp;
      receipt.levels = addXp(conductor, receipt.xp);
      receipt.profit = receipt.payout;
      const id = festival.id ?? ctx.festival;
      conductor.festival = { id, entered: { ...(conductor.festival?.id === id ? conductor.festival.entered : {}), [ctx.kind]: medal } };
      advanceClock(conductor, rng, 3 * 60);
      return receipt;
    });
  }

  return withRng(conductor, (rng) => {
    receipt.fuelCost = settleFuel(conductor, result);
    const forfeit = result.reason === 'forfeit';
    const arrived = result.finished && result.reason === 'finished';
    const add = (label, lt) => {
      if (!lt) return;
      receipt.lines.push({ label, lt });
      receipt.payout += lt;
    };
    let xp = 0;

    if (ctx.kind === 'test') {
      const T = B.RACE.testRace;
      const won = arrived && result.place === 1;
      receipt.title = 'First run';
      receipt.outcome = forfeit ? 'forfeit' : won ? 'won' : 'lost';
      add('Benchmark purse', won ? T.winLt : T.lossLt);
      xp = forfeit ? 0 : won ? T.winXp : T.lossXp;
      conductor.testRaceDone = true;
    }

    const job = ctx.kind === 'test' ? null : findRun(conductor, ctx);
    // You can only pull containers you own.
    const haul = job && job.containers > 0 ? Math.max(1, Math.min(job.containers, conductor.containers, ctx.haul ?? conductor.containers)) : 0;
    receipt.haul = haul;

    if (ctx.kind === 'delivery' && job) {
      receipt.title = job.title;
      receipt.outcome = forfeit ? 'forfeit' : arrived ? 'delivered' : 'late';
      if (arrived) {
        const base = jobPay(job, haul);
        add(haul > 0 ? `Delivered ${haul} container${haul === 1 ? '' : 's'} of ${job.cargo.toLowerCase()}` : 'Mail delivered', base);
        const business = traitPower(conductor, 'business');
        if (business > 0) add('Business trait', Math.floor(base * randRange(rng, ...J.business) * business));
        if (job.speedBonus) {
          const pct = Math.min(J.speedBonusCap, result.underLimitPct * J.speedBonusPerPct);
          add(`Early by ${Math.round(result.underLimitPct)}%`, Math.floor((base * pct) / 100));
        }
        xp = jobXp(job, haul);
        conductor.railRep = (conductor.railRep ?? 0) + B.EXPRESS.rep.delivery;
      } else if (!forfeit) {
        xp = Math.floor(jobXp(job, haul) * J.lateXpShare);
      }
      // Delivered or late, the job leaves the board and a new one is posted.
      // A forfeited job stays up, so giving up is never a way to reshuffle the board.
      if (!forfeit) {
        conductor.board.simple = conductor.board.simple.filter((item) => item.id !== job.id);
        conductor.board.simple.push(generateSimpleJob(rng));
      }
    }

    if (ctx.kind === 'company' && job) {
      const company = companyById(ctx.companyId);
      receipt.title = job.title;
      receipt.company = company.name;
      receipt.outcome = forfeit ? 'forfeit' : arrived ? 'delivered' : 'late';
      if (arrived) {
        const record = { ...companyRecord(conductor, ctx.companyId) };
        const stars = starsFor(record.rep);
        const base = jobPay(job, haul);
        add(`Contract job: ${haul} container${haul === 1 ? '' : 's'}`, base);
        if (stars > 0) add(`${stars}-star standing`, Math.floor(base * stars * J.reputation.payPerStar));
        if (job.speedBonus) {
          const pct = Math.min(J.speedBonusCap, result.underLimitPct * J.speedBonusPerPct);
          add(`Early by ${Math.round(result.underLimitPct)}%`, Math.floor((base * pct) / 100));
        }
        record.contracts = Math.max(0, record.contracts - job.cost);
        record.jobs += 1;
        conductor.companies[ctx.companyId] = record;
        receipt.reputation = gainReputation(conductor, ctx.companyId, J.reputation.companyJob);
        conductor.railRep = (conductor.railRep ?? 0) + B.EXPRESS.rep.companyJob;
        xp = jobXp(job, haul);
        conductor.board.company[ctx.companyId] = conductor.board.company[ctx.companyId].filter((item) => item.id !== job.id);
      } else if (!forfeit) {
        // Late: the load is refused. No contracts are spent, and the job is withdrawn.
        xp = Math.floor(jobXp(job, haul) * J.lateXpShare);
        conductor.board.company[ctx.companyId] = conductor.board.company[ctx.companyId].filter((item) => item.id !== job.id);
      }
    }

    if (ctx.kind === 'contract' && job) {
      const C = J.contract;
      const company = companyById(job.companyId);
      receipt.title = job.title;
      receipt.company = company.name;
      let won = arrived && result.place === 1;
      const negotiator = traitPower(conductor, 'negotiator');
      if (!won && arrived && negotiator > 0) {
        const chance = result.place === 2 ? C.negotiator2nd : result.place === 3 ? C.negotiator3rd : 0;
        if (rng() < Math.min(0.9, chance * negotiator)) {
          won = true;
          receipt.negotiated = true;
        }
      }
      // Captain talent Closer: a chance to talk the contract out of 2nd place.
      if (!won && arrived && result.place === 2 && talent(conductor, 'negotiate') > 0 && rng() < talent(conductor, 'negotiate')) {
        won = true;
        receipt.negotiated = true;
      }
      receipt.outcome = forfeit ? 'forfeit' : won ? 'won' : 'lost';
      if (won) {
        const record = { ...companyRecord(conductor, job.companyId) };
        record.contracts += job.award;
        record.wins += 1;
        conductor.companies[job.companyId] = record;
        receipt.contractsWon = job.award;
        const business = traitPower(conductor, 'business');
        if (business > 0) add('Paid up front (Business trait)', Math.floor(job.award * C.value * C.businessUpfront * business));
        receipt.reputation = gainReputation(conductor, job.companyId, J.reputation.contractWin);
        xp = C.winXp + C.xpPerContract * job.award;
      } else if (!forfeit) {
        receipt.reputation = gainReputation(conductor, job.companyId, J.reputation.contractLoss);
        xp = C.lossXp;
      }
      // The contract is settled; another company posts a new one. A forfeited race stays posted.
      if (!forfeit) {
        conductor.board.contracts = conductor.board.contracts.filter((item) => item.id !== job.id);
        const posted = new Set(conductor.board.contracts.map((item) => item.companyId));
        const candidates = COMPANIES.filter((item) => !posted.has(item.id) && item.id !== job.companyId);
        conductor.board.contracts.push(generateContract(rng, candidates[Math.floor(rng() * candidates.length)].id));
      }
    }

    if (ctx.kind === 'race' && job) {
      const R = J.race;
      const company = companyById(job.companyId);
      receipt.title = job.title;
      receipt.company = company.name;
      const place = arrived ? result.place : 0;
      receipt.outcome = forfeit ? 'forfeit' : place === 1 ? 'won' : place >= 2 && place <= 3 ? 'placed' : 'lost';
      receipt.place = place;
      if (place >= 1 && place <= job.purse.length) add(`${['1st', '2nd', '3rd'][place - 1]} place purse`, job.purse[place - 1]);
      if (!forfeit) {
        xp = place === 1 ? R.winXp : place >= 2 && place <= 3 ? R.placeXp : R.lossXp;
        receipt.reputation = gainReputation(conductor, job.companyId, place === 1 ? R.repWin : R.repPlace);
        // Each prize race runs once; the board posts the next batch with the new week.
        conductor.board.races = conductor.board.races.filter((item) => item.id !== job.id);
      }
    }

    // Express legs: pay for the leg; the last leg pays the bonus for the whole run.
    if (ctx.kind === 'express' && job && conductor.express) {
      const X = B.EXPRESS;
      const run = conductor.express;
      const express = expressById(run.id);
      receipt.title = job.title;
      receipt.outcome = forfeit ? 'forfeit' : arrived ? 'delivered' : 'late';
      if (!forfeit) {
        const base = jobPay(job, haul);
        const legPay = arrived ? base : Math.floor(base * X.latePay);
        add(arrived ? `Leg ${run.leg + 1}: ${haul} container${haul === 1 ? '' : 's'} delivered` : `Leg ${run.leg + 1} (late, half pay)`, legPay);
        xp = arrived ? jobXp(job, haul) : Math.floor(jobXp(job, haul) * J.lateXpShare);
        run.paid = Math.round((run.paid + legPay) * 10) / 10;
        run.late = run.late || !arrived;
        run.leg += 1;
        conductor.railRep = (conductor.railRep ?? 0) + X.rep.leg;
        if (run.leg >= run.legs.length) {
          const bonus = Math.floor(run.paid * (run.late ? X.lateBonus : X.bonus));
          add(`${express.name} complete${run.late ? ' (a leg ran late)' : ''}`, bonus);
          xp = Math.floor(xp * (1 + X.xpBonus)) + run.legs.length * 50;
          conductor.railRep += X.rep.finish;
          conductor.expressDone = { ...(conductor.expressDone ?? {}), [run.id]: (conductor.expressDone?.[run.id] ?? 0) + 1 };
          receipt.expressDone = express.name;
          conductor.express = null;
        } else receipt.expressNext = run.leg + 1;
      }
    }

    // Captain talents (NFT edition): Business pay, contract-job pay and the Rail Magnate purse.
    if (conductor.captain && !forfeit) {
      const earned = receipt.payout;
      const pay = talent(conductor, 'pay') + (ctx.kind === 'company' ? talent(conductor, 'contractPay') : 0);
      if (earned > 0 && pay > 0 && ['delivery', 'company', 'race', 'express'].includes(ctx.kind)) add('Captain: Business', Math.floor(earned * pay));
      if (ctx.kind === 'contract' && job && talent(conductor, 'magnate') > 0) add('Captain: Rail Magnate purse', Math.round(job.distance * 25));
    }

    fillCompanyJobs(rng, conductor);
    placeJobs(conductor, rng);

    // Knocking rivals off the rails, and clearing boulders, are worth a little experience of their own.
    if (!forfeit && result.rivalsDerailed) xp += result.rivalsDerailed * B.COMBAT.derailXp;
    if (!forfeit && result.bouldersSmashed) xp += result.bouldersSmashed * B.HAZARD.smashXp;

    // Rounds fired are restocked at the depot price; the locomotive wears a little with every mile.
    receipt.ammoCost = Math.round((result.roundsFired ?? 0) * B.ARMORY.roundPrice * 10) / 10;
    const loco = conductor.locos.find((item) => item.id === conductor.activeLocoId) ?? conductor.locos[0];
    const L = B.LOCO;
    // Pulling closer to the towing limit wears the engine faster.
    const wear = (1 - Math.min(0.5, talent(conductor, 'wear'))) * result.distance * L.wearPerMile * (1 + L.wearPerLoad * Math.min(1.5, result.towUse ?? 0)) + (result.hullLost ?? 0) * L.wearPerHull + (result.crashes ?? 0) * L.wearPerCrash;
    const before = loco.condition ?? 1;
    loco.condition = Math.max(0, Math.round((before - wear) * 10000) / 10000);
    receipt.wear = before - loco.condition;
    receipt.condition = loco.condition;
    xp = Math.floor(xp * (1 + B.XP.leader * traitPower(conductor, 'leader')) * (1 + talent(conductor, 'xp')));
    receipt.xp = xp;
    receipt.levels = addXp(conductor, xp);
    receipt.profit = receipt.payout - receipt.fuelCost - receipt.ammoCost;
    // A fuel advance is a debt, settled out of pay. It is not a cost of this run.
    if (conductor.fuelAdvanceOwed > 0 && receipt.payout > 0) {
      receipt.advanceRepaid = Math.min(conductor.fuelAdvanceOwed, receipt.payout);
      conductor.fuelAdvanceOwed = Math.round((conductor.fuelAdvanceOwed - receipt.advanceRepaid) * 10) / 10;
    }
    conductor.lt = Math.max(0, Math.round((conductor.lt + receipt.payout - (receipt.advanceRepaid ?? 0) - receipt.ammoCost) * 10) / 10);

    const win = ['won', 'delivered'].includes(receipt.outcome);
    conductor.stats.runs += 1;
    conductor.stats.wins += win ? 1 : 0;
    conductor.stats.miles += result.distance;
    conductor.stats.earned += receipt.payout;
    conductor.history = [
      { at: now, title: receipt.title, outcome: receipt.outcome, payout: receipt.payout, xp, miles: Math.round(result.distance) },
      ...conductor.history,
    ].slice(0, 12);

    // The run takes its time on the calendar: the trip plus the turnaround.
    const minutes = runMinutes(result.gameSeconds);
    receipt.minutes = minutes;
    advanceClock(conductor, rng, minutes);
    receipt.date = conductor.clock;
    // The run's time is on the calendar already; the minutes spent racing do not also drift it.
    conductor.lastSeen = now;
    return receipt;
  });
}

// ---------- Express runs on the rail map ----------

export function startExpress(conductor, { id }) {
  const express = expressById(id);
  if (!express) throw new GameError('No such express.');
  if (conductor.express) throw new GameError('Finish or abandon your current express first.');
  if (railRep(conductor) < express.rep) throw new GameError(`The ${express.name} needs ${express.rep} rail reputation.`);
  return withRng(conductor, (rng) => {
    const legs = expressLegs(express, rng).map((leg) => ({ ...leg, ...rollHazard(rng, leg.distance) }));
    conductor.express = { id, legs, leg: 0, paid: 0, late: false, startedAt: conductor.clock ?? 0 };
    return { legs: legs.length };
  });
}

export function abandonExpress(conductor) {
  if (!conductor.express) throw new GameError('No express under way.');
  conductor.express = null;
  return {};
}
