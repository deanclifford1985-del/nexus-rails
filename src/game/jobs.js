import { B } from './balance.js';
import { clamp, pick, randInt, randRange, round1, shuffle, uid, weightedPick } from './rng.js';
import { FIRST_NAMES, LAST_NAMES } from './conductor.js';
import { activeLoco } from './conductor.js';
import { STARTER_MODELS, cargoFits, deriveStats } from './locomotives.js';

const J = B.JOBS;

export const COMPANIES = [
  ['atlas', 'Atlas Freight Solutions', 'Manufacturing'],
  ['meridian', 'Meridian Logistics', 'Technology'],
  ['titan', 'Titan Transport Co.', 'Mining'],
  ['phoenixcargo', 'Phoenix Cargo Lines', 'Retail'],
  ['apex', 'Apex Shipping Corp', 'Retail'],
  ['nexus', 'Nexus Distribution', 'Retail'],
  ['summit', 'Summit Express', 'Technology'],
  ['horizon', 'Horizon Haulers', 'Agriculture'],
  ['velocity', 'Velocity Freight', 'Manufacturing'],
  ['prime', 'Prime Logistics', 'Retail'],
  ['stellar', 'Stellar Transport', 'Technology'],
  ['dynamic', 'Dynamic Cargo', 'Manufacturing'],
  ['quantum', 'Quantum Shipping', 'Technology'],
  ['elite', 'Elite Express Co.', 'Retail'],
  ['pinnacle', 'Pinnacle Freight', 'Mining'],
  ['unity', 'Unity Transport', 'Agriculture'],
  ['cosmos', 'Cosmos Logistics', 'Technology'],
  ['thunder', 'Thunder Rail Co.', 'Energy'],
  ['lightning', 'Lightning Express', 'Energy'],
  ['steelrails', 'Steel Rails Inc.', 'Manufacturing'],
  ['ironmountain', 'Iron Mountain Transport', 'Mining'],
  ['goldeneagle', 'Golden Eagle Freight', 'Mining'],
  ['silverstream', 'Silver Stream Logistics', 'Agriculture'],
  ['coppercanyon', 'Copper Canyon Express', 'Mining'],
  ['diamondhaul', 'Diamond Haul Co.', 'Mining'],
  ['emerald', 'Emerald Transport', 'Agriculture'],
  ['ruby', 'Ruby Rail Lines', 'Energy'],
  ['sapphire', 'Sapphire Shipping', 'Retail'],
  ['platinum', 'Platinum Express', 'Technology'],
  ['crimson', 'Crimson Freight Co.', 'Energy'],
].map(([id, name, specialty]) => ({ id, name, specialty }));

export const companyById = (id) => COMPANIES.find((company) => company.id === id);

const TOWNS = ['Ashford', 'Copper Gulch', 'Emberton', 'Graywater', 'Hollis Junction', 'Ironvale', 'Kettle Creek', "Lark's Crossing", 'Millbrook', 'Northgate', 'Oxbow', 'Pinehaven', 'Quarry Point', 'Redwater', 'Stonebridge', 'Tallow Bend'];

const CARGO = ['Grain', 'Lumber', 'Coal', 'Scrap metal', 'Livestock feed', 'Hardware', 'Chemicals', 'Building materials', 'Machine parts', 'Textiles', 'Iron ore', 'Produce', 'Fuel drums', 'Medical supplies'];

const CARGO_BY_SPECIALTY = {
  Manufacturing: ['Steel beams', 'Machine parts', 'Engine blocks'],
  Technology: ['Telegraph equipment', 'Precision instruments', 'Electrical parts'],
  Mining: ['Iron ore', 'Copper ore', 'Quarry stone'],
  Retail: ['Dry goods', 'Catalogue orders', 'Furniture'],
  Agriculture: ['Grain', 'Livestock', 'Produce'],
  Energy: ['Coal', 'Fuel drums', 'Boiler parts'],
};

function route(rng) {
  const [from, to] = shuffle(rng, TOWNS);
  return { from, to };
}

function rollLoad(rng, containerRange, lbRange) {
  const containers = randInt(rng, ...containerRange);
  // One weight roll shared by all the containers on the job, to the nearest 100 lb.
  const each = Math.round(randInt(rng, ...lbRange) / 100) * 100;
  return { containers, each, weight: containers * each };
}

function rollMiles(rng) {
  const options = [];
  for (let miles = J.milesMin; miles <= J.milesMax; miles += J.milesStep) options.push(miles);
  return weightedPick(rng, options, (miles) => Math.pow(J.milesFalloff, (miles - J.milesMin) / J.milesStep));
}

// Obstacles: harder jobs have more of them, and bigger. Each is { at: miles, size }.
const SIZE_IDS = ['debris', 'boulder', 'large', 'giant'];
export function rollHazard(rng, distance) {
  const H = B.HAZARD;
  if (distance < H.minMiles) return { hazard: 0, boulders: [] };
  const hazard = weightedPick(rng, [0, 1, 2, 3], (level) => H.chance[level]);
  const count = Math.min(H.count.max, Math.round(hazard * (H.count.base + distance / 50 * H.count.per50Miles)));
  const boulders = Array.from({ length: count }, () => ({
    at: Math.round(randRange(rng, 0.1, 0.94) * distance * 10) / 10,
    size: weightedPick(rng, SIZE_IDS, (s, i) => H.mix[hazard][SIZE_IDS.indexOf(s)]),
  })).sort((x, y) => x.at - y.at);
  return { hazard, boulders };
}

// How many of each size, for the job card: { debris: 3, boulder: 2, ... }
export function obstacleMix(job) {
  const mix = {};
  for (const rock of job.boulders ?? []) {
    const size = typeof rock === 'number' ? 'boulder' : rock.size;
    mix[size] = (mix[size] ?? 0) + 1;
  }
  return mix;
}

/**
 * What a job pays for hauling `containers` of its freight. Every job carries a delivery fee
 * plus a rate per container, so owning more containers is how pay grows.
 * Mail runs have no containers: the fee is the pay.
 */
export function jobPay(job, containers) {
  const k = Math.max(0, Math.min(job.containers, containers));
  return Math.floor((job.fee + job.perContainer * k) * (1 + B.HAZARD.payPerLevel * (job.hazard ?? 0)));
}

export function jobXp(job, containers) {
  const k = Math.max(0, Math.min(job.containers, containers));
  const perMile = job.type === 'company' ? J.company.xpPerMile : J.xpPerMile;
  const perContainer = job.type === 'company' ? J.company.xpPerContainer : J.xpPerContainer;
  const base = job.distance * perMile + k * perContainer;
  return Math.floor(base * (1 + (job.xpBonusPct ?? 0) / 100) * (1 + B.HAZARD.xpPerLevel * (job.hazard ?? 0)));
}

export function generateSimpleJob(rng) {
  // About one job in seven is a mail run: short and poorly paid, but good experience.
  const light = rng() < 0.15;
  const distance = light ? randInt(rng, 3, 8) * 5 : rollMiles(rng);
  const load = light ? { containers: 0, each: 0, weight: 0 } : rollLoad(rng, J.containers, J.containerLb);
  const cargo = light ? 'Mail' : pick(rng, CARGO);
  const fee = light ? Math.floor(distance * randRange(rng, 1, 2)) : Math.round((distance * randRange(rng, ...J.feePerMile)) / 5) * 5;
  const perContainer = light ? 0 : Math.round((distance * randRange(rng, ...J.perContainerPerMile)) / 5) * 5;
  const { hazard, boulders } = light ? { hazard: 0, boulders: [] } : rollHazard(rng, distance);
  const job = {
    id: uid(rng, 'job'),
    type: 'simple',
    title: light ? 'Mail run' : `${cargo} shipment`,
    cargo,
    ...route(rng),
    distance,
    ...load,
    fee,
    perContainer,
    hazard,
    boulders,
    timeLimit: distance * J.limitSecondsPerMile,
    speedBonus: rng() < J.speedBonusChance,
  };
  // Low-paying jobs are worth more experience.
  const pay = jobPay(job, 1);
  let bonusPct = 0;
  if (pay < J.lowPayUnder) {
    const steps = Math.floor((J.lowPayUnder - pay) / J.lowPayStep);
    for (let i = 0; i < steps; i++) bonusPct += randRange(rng, ...J.lowPayBonus);
  }
  job.xpBonusPct = Math.round(bonusPct * 100);
  return job;
}

// Rivals bring a cannon, and sometimes a plasma lance, a shield or extra rounds.
export function rivalKit(rng) {
  const A = B.COMBAT.ai;
  // Most rivals run the starter missile launcher; some have swapped to a cannon.
  const fit = [rng() < 0.3 ? 'cannon' : 'launcher', 'fuel'];
  if (rng() < A.plasma) fit.push('plasma');
  if (rng() < A.shield) fit.push('shield');
  if (rng() < A.crate) fit.push('ammo');
  return fit;
}

function rivalName(rng) {
  return `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`;
}

// A rival is stored as offsets from the player's locomotive, so the field always sits
// near the player's power level on the day of the race.
function generateRival(rng) {
  const L = B.LOCO;
  return {
    name: rivalName(rng),
    model: pick(rng, STARTER_MODELS),
    offset: { power: randInt(rng, -1, 1), efficiency: randInt(rng, -1, 1), durability: randInt(rng, -1, 1), endurance: randInt(rng, -1, 1) },
    hpBase: Math.round(randRange(rng, ...L.hpBase)),
    tqBase: Math.round(randRange(rng, ...L.tqBase)),
    growth: Math.round(randRange(rng, ...L.growth) * 1000) / 1000,
    str: randInt(rng, ...B.RACE.aiAttr),
    agi: randInt(rng, ...B.RACE.aiAttr),
    end: randInt(rng, ...B.RACE.aiAttr),
    lever: Math.round(randRange(rng, ...B.RACE.aiLever) * 100) / 100,
    fit: rivalKit(rng),
  };
}

export function generateContract(rng, companyId) {
  const C = J.contract;
  const company = companyById(companyId);
  const { containers, weight } = rollLoad(rng, C.containers, C.containerLb);
  const rivals = randInt(rng, ...C.rivals);
  return {
    id: uid(rng, 'contract'),
    type: 'contract',
    companyId,
    title: `${company.name} open contract`,
    cargo: pick(rng, CARGO_BY_SPECIALTY[company.specialty]),
    ...route(rng),
    distance: randInt(rng, C.miles[0] / 5, C.miles[1] / 5) * 5,
    containers,
    weight,
    award: randInt(rng, ...C.award),
    rivals: Array.from({ length: rivals }, () => generateRival(rng)),
  };
}

const RACE_NAMES = ['Sprint', 'Dash', 'Derby', 'Cup', 'Run', 'Challenge', 'Stakes'];
const RACE_PLACES = ['Ridgeback', 'Cinder Flats', 'Iron Gap', 'Cobalt Bend', 'Hollow Pass', 'Ember Ridge', 'Silver Wash', 'Thunder Mesa', 'Gearwater', 'Copperline'];

// What it costs to enter a race (prize races and contract races; deliveries and the festival are free).
export function entryFee(kind, job) {
  if (!job) return 0;
  if (kind === 'race') return Math.round(((job.purse?.[0] ?? 0) * J.race.entryShare) / 10) * 10;
  if (kind === 'contract') return (job.award ?? 0) * J.contract.entryPerContract;
  if (kind === 'open') return Math.round(((job.purse?.[0] ?? 0) * B.OPEN.entryShare) / 10) * 10;
  return 0;
}

// A prize race: no freight, a field of rivals, a purse for the top three, sponsored by a company.
export function generateRace(rng, companyId = pick(rng, COMPANIES).id) {
  const R = J.race;
  const company = companyById(companyId);
  const distance = randInt(rng, R.miles[0] / 5, R.miles[1] / 5) * 5;
  const where = pick(rng, RACE_PLACES);
  const purse = Math.round((distance * randRange(rng, ...R.pursePerMile)) / 50) * 50;
  return {
    id: uid(rng, 'race'),
    type: 'race',
    companyId,
    title: `${where} ${pick(rng, RACE_NAMES)}`,
    from: where,
    to: `${where} finish`,
    distance,
    containers: 0,
    weight: 0,
    purse: R.placeShare.map((share) => Math.round((purse * share) / 10) * 10),
    rivals: Array.from({ length: randInt(rng, ...R.rivals) }, () => generateRival(rng)),
  };
}

export function generateCompanyJob(rng, companyId) {
  const C = J.company;
  const company = companyById(companyId);
  const distance = randInt(rng, C.miles[0] / 5, C.miles[1] / 5) * 5;
  // Skewed towards the small end; the big loads are for upgraded locomotives.
  const skew = rng();
  const containers = C.containers[0] + Math.floor((C.containers[1] - C.containers[0] + 1) * skew * skew * 0.999);
  const each = Math.round(randInt(rng, ...J.containerLb) / 100) * 100;
  const cargo = pick(rng, CARGO_BY_SPECIALTY[company.specialty]);
  const job = {
    id: uid(rng, 'cjob'),
    type: 'company',
    companyId,
    title: `${cargo} for ${company.name}`,
    cargo,
    ...route(rng),
    distance,
    containers,
    each,
    weight: containers * each,
    fee: Math.round((distance * randRange(rng, ...C.feePerMile)) / 10) * 10,
    perContainer: Math.round((distance * randRange(rng, ...C.perContainerPerMile)) / 5) * 5,
    ...rollHazard(rng, distance),
    timeLimit: distance * J.limitSecondsPerMile,
    speedBonus: rng() < C.speedBonusChance,
  };
  const full = jobPay(job, containers);
  job.cost = full >= 2500 ? 3 : full >= 1400 ? 2 : 1;
  return job;
}

export function generateBoard(rng, week) {
  const companies = shuffle(rng, COMPANIES).slice(0, J.contractCount);
  return {
    week,
    simple: Array.from({ length: J.simpleCount }, () => generateSimpleJob(rng)),
    contracts: companies.map((company) => generateContract(rng, company.id)),
    races: Array.from({ length: J.race.count }, () => generateRace(rng)),
    company: {},
  };
}

// Makes sure every company the player holds contracts with has jobs posted,
// and that at least one of them is a job the player can take today.
export function fillCompanyJobs(rng, conductor) {
  const board = conductor.board;
  const loco = activeLoco(conductor);
  if (!loco || !board) return; // a Captain still waiting on their first crate locomotive
  const stats = deriveStats(loco, conductor);
  for (const [companyId, record] of Object.entries(conductor.companies)) {
    if ((record.contracts ?? 0) <= 0) continue;
    const jobs = board.company[companyId] ?? [];
    while (jobs.length < J.companyJobsPerCompany) jobs.push(generateCompanyJob(rng, companyId));
    // Takeable means at least one container of it is light enough to pull.
    const takeable = (job) => job.cost <= record.contracts && cargoFits(stats, job.each);
    if (!jobs.some(takeable)) {
      let job = null;
      for (let tries = 0; tries < 40 && !job; tries++) {
        const candidate = generateCompanyJob(rng, companyId);
        if (takeable(candidate)) job = candidate;
      }
      if (!job) {
        // Nothing rolled light enough: cut a job down to what this locomotive can pull.
        job = generateCompanyJob(rng, companyId);
        job.each = Math.min(J.containerLb[0], Math.floor(stats.tow / stats.cargoFactor / 100) * 100);
        job.weight = job.each * job.containers;
        job.cost = 1;
      }
      jobs[0] = job;
    }
    board.company[companyId] = jobs;
  }
}

export function starsFor(points) {
  let stars = 0;
  for (const need of J.reputation.stars) if (points >= need) stars += 1;
  return stars;
}

export const nextStarAt = (points) => J.reputation.stars.find((need) => points < need) ?? null;

export const companyRecord = (conductor, companyId) =>
  conductor.companies[companyId] ?? { contracts: 0, rep: 0, wins: 0, jobs: 0 };

export const sortByDistance = (jobs) => jobs.slice().sort((a, b) => a.distance - b.distance);
