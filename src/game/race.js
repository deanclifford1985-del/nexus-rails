import { B } from './balance.js';
import { accelSecondsFor, topSpeedFor } from './locomotives.js';
import { makeRng, newSeed } from './rng.js';
import { cornerCap, gradeAt, hillEffect, makeCourse } from './course.js';

// The race engine. It knows nothing about React, saves or money.
// createRace() builds a plain state object; stepRace() advances it; the screen draws it.

const R = B.RACE;
const LB_PER_GAL = B.LOCO.fuelLbPerGallon;
const C = B.COMBAT;

// Pulling away: the first third of top speed takes half the time,
// the next third a quarter, the last third a quarter.
export function accelRate(ratio, vmax, totalSeconds) {
  if (ratio < 0.33) return (0.33 * vmax) / (0.5 * totalSeconds);
  if (ratio < 0.65) return (0.32 * vmax) / (0.25 * totalSeconds);
  return (0.35 * vmax) / (0.25 * totalSeconds);
}

// Easing the lever back saves a little fuel per mile; pushing past 100% costs a lot.
export const leverFuelMult = (lever) => (lever <= 1 ? 0.7 + 0.3 * lever : 1 + 2.5 * (lever - 1));

export function accelFuelMult(ratio) {
  for (const [under, mult] of R.accelFuel) if (ratio < under) return mult;
  return 1;
}

function makeTrain(spec, isPlayer) {
  const fuel = Math.max(0, spec.fuel ?? 0);
  return {
    id: spec.id ?? (isPlayer ? 'player' : 'rival'),
    name: spec.name,
    locoName: spec.locoName ?? '',
    model: spec.model ?? 'stable',
    isPlayer,
    hp: spec.stats.hp,
    tq: spec.stats.tq,
    baseWeight: spec.stats.weight,
    tmpg: spec.stats.tmpg,
    tank: spec.stats.tank,
    cargo: spec.cargoLb ?? 0,
    tow: spec.stats.tow ?? 0,
    grip: spec.stats.grip ?? 0,
    hillGrip: spec.stats.hillGrip ?? 0,
    accel: spec.stats.accel ?? 1,
    grade: 0,
    fuel,
    fuelStart: fuel,
    fuelUsed: 0,
    lever: spec.lever ?? 1,
    speed: 0,
    vmax: 0,
    topSeen: 0,
    distance: 0,
    finished: false,
    finishGame: null,
    finishReal: null,
    dry: false,
    dryFor: 0,
    slowFor: 0,
    surgeFor: 0,
    surgeMph: 0,
    // Combat
    hull: spec.stats.hull ?? C.hullBase,
    hullMax: spec.stats.hull ?? C.hullBase,
    // What this train can fire or cast: spells from the engine, weapons from its slots.
    arms: spec.arms ?? spec.stats.arms ?? [],
    mp: C.mpMax,
    mpRegen: spec.mpRegen ?? 1,
    ammo: spec.stats.ammo ?? 0,
    ammoMax: spec.stats.ammo ?? 0,
    charge: spec.stats.charge ?? 0,
    chargeMax: spec.stats.charge ?? 0,
    roundsFired: 0,
    weaponStats: spec.stats.weaponStats ?? {},
    armor: spec.stats.armor ?? 0,
    shotsFired: {}, // per weapon, for Echoing Shot
    parked: !!spec.parked, // the Damage Wall: the train stays put
    sight: spec.stats.sight ?? B.RADAR.sight,
    front: spec.stats.front ?? 'cowcatcher',
    hits: 0,
    misses: 0,
    cooldown: {},
    barrier: 0,
    barrierCut: 0,
    limit: Infinity, // the speed the next bend allows, mph
    crashes: 0,
    stagger: 0,
    out: false, // knocked off the rails
    dealt: 0,
    taken: 0,
    spellPower: spec.stats.spellPower ?? 1,
    burn: 0,
    burnT: 0,
    poison: 0,
    poisonT: 0,
    // Engine heat and Endurance
    heat: 0,
    heatMult: spec.stats.heatMult ?? 1,
    coolMult: spec.stats.coolMult ?? 1,
    secondWind: spec.stats.secondWind ?? 0,
    overHeatMult: spec.stats.overHeatMult ?? 1,
    bootMult: spec.stats.bootMult ?? 1,
    dotMult: spec.stats.dotMult ?? 1,
    spellCdMult: spec.stats.spellCdMult ?? 1,
    mpCostMult: spec.stats.mpCostMult ?? 1,
    mpRegenMult: spec.stats.mpRegenMult ?? 1,
    chargeRegenMult: spec.stats.chargeRegenMult ?? 1,
    secondWindUsed: false,
    journey: !!spec.stats.journey,
    journeyStacks: 0,
    // Boot-up: which arms are online yet
    online: {},
    hitOnce: false,
    think: 1.5,
  };
}

// How a weapon or spell on this train comes online: its boot rule, rarity and traits applied.
export function bootOf(train, key) {
  const kind = kindOf(key);
  const own = train.weaponStats?.[key]?.boot;
  const base = C.boot[kind];
  if (!base) return null;
  return own ?? { ...base, mult: 1 };
}

// Null when online; otherwise a short reason ("Booting 0:12", "Boots in 0.6 mi", "Arms below 50% HP").
export function bootStatus(race, train, key) {
  if (train.online[key] || race.bootInstant) return null;
  const boot = bootOf(train, key);
  if (!boot) return null;
  const mult = (boot.mult ?? 1) * (train.bootMult ?? 1);
  if (boot.onHit && train.hitOnce) return null;
  if (boot.type === 'time') {
    const left = boot.s * mult - race.real;
    return left <= 0 ? null : `Booting ${Math.floor(left / 60)}:${String(Math.ceil(left % 60) % 60).padStart(2, '0')}`;
  }
  if (boot.type === 'miles') {
    const left = boot.mi * mult - train.distance;
    return left <= 0 ? null : `Boots in ${left.toFixed(1)} mi`;
  }
  if (boot.type === 'hurt') return train.hull <= train.hullMax * boot.below ? null : `Arms below ${Math.round(boot.below * 100)}% HP`;
  if (boot.type === 'heat') return train.heat >= boot.above * Math.max(0.3, mult) ? null : `Ready above ${Math.round(boot.above * Math.max(0.3, mult))}% heat`;
  return null;
}

function updateBoot(race) {
  for (const train of race.trains) {
    for (const key of train.arms) {
      if (train.online[key]) continue;
      if (!bootStatus(race, train, key)) {
        train.online[key] = true;
        if (train.isPlayer && race.real > 0.5) race.fx.push({ type: 'online', key });
      }
    }
  }
}

// Heat costs top speed and acceleration above half, and badly once over 100%.
export function heatPenalty(heat) {
  const H = B.HEAT;
  if (heat <= H.from) return 0;
  const k = Math.min(1, (heat - H.from) / (100 - H.from));
  return Math.min(0.6, H.loss * Math.pow(k, 1.5) + Math.max(0, heat - 100) * H.overLoss);
}

const COOLERS = ['frost', 'vent'];

/**
 * config = {
 *   kind: 'test' | 'delivery' | 'company' | 'contract' | 'demo',
 *   title, distance (miles), timeLimit (game seconds or null),
 *   player: { name, locoName, stats, fuel, cargoLb, lever, competitive, pitCrew, ability, lt },
 *   rivals: [{ id, name, locoName, model, stats, fuel, cargoLb, lever }],
 *   freeFuel: true for test drives,
 *   combat: true to allow weapons and spells,
 *   course: { bends } from makeCourse, or courseSeed to make one,
 *   obstacles: [miles, ...] boulders on the player's line,
 *   seed: optional, for repeatable rolls,
 * }
 */
export function createRace(config) {
  const player = makeTrain({ ...config.player, id: 'player' }, true);
  const rivals = (config.rivals ?? []).map((spec, index) => makeTrain({ ...spec, id: spec.id ?? `rival-${index + 1}` }, false));
  const H = B.HAZARD;
  const rng = makeRng(config.seed ?? newSeed());
  const course = config.course ?? (config.courseSeed !== undefined ? makeCourse(config.courseSeed, config.distance) : null);
  // An obstacle is { at, size } (or just a mile marker, a plain boulder), or { at, hp, armor } for
  // something special such as the festival wall.
  const obstacles = (config.obstacles ?? []).map((spec, index) => {
    const at = typeof spec === 'number' ? spec : spec.at;
    const size = spec.size ?? (spec.hp > 1000 ? 'giant' : 'boulder');
    const S = H.sizes[size];
    const hp = spec.hp ?? Math.round(S.hp[0] + rng() * (S.hp[1] - S.hp[0]));
    return { id: `rock-${index + 1}`, at, size, hp, hpMax: hp, armor: spec.armor ?? 0, destroyed: false, struck: false, seen: false, big: hp > 1000, burn: 0, burnT: 0, poison: 0, poisonT: 0 };
  });
  return {
    kind: config.kind,
    title: config.title ?? '',
    distance: config.distance,
    timeLimit: config.timeLimit ?? null,
    freeFuel: !!config.freeFuel,
    status: 'ready', // ready -> running -> finished
    real: 0,
    game: 0,
    trains: [player, ...rivals],
    competitive: { power: config.player.competitive ?? 0, inRange: 0, boost: 0 },
    gap: null, // miles ahead (+) or behind (-) the nearest rival
    gapToLeader: null,
    nearestId: null,
    place: 1,
    lt: config.player.lt ?? 0,
    pitCrew: config.player.pitCrew ?? 0,
    emergency: null,
    emergencyGallons: 0,
    emergencyCost: 0,
    ability: config.player.ability
      ? { id: config.player.ability, used: false, activeFor: 0, auto: config.kind === 'demo', armedAt: null }
      : null,
    events: [],
    combat: !!config.combat && (rivals.length > 0 || obstacles.length > 0),
    course,
    obstacles,
    aim: 'auto', // the player's aim: 'auto' (obstacles first), 'rivals' or 'track'
    shots: [], // shots and spells in flight
    channels: [], // lightning being channelled: { id, from, key, to, t, ticks, ... }
    fx: [], // things for the screen to show: { type: 'cast' | 'hit' | 'derail' | 'smash' | 'crash', ... }
    shotSeq: 0,
    bootInstant: !!config.bootInstant, // the Damage Wall: everything is online from the start
    rng,
    result: null,
  };
}

export const playerOf = (race) => race.trains[0];
export const startRace = (race) => {
  if (race.status === 'ready') race.status = 'running';
};

function advanceTrain(race, train, h) {
  const gh = h * B.TIME_SCALE;
  // Rivals ease off to let a hot engine cool, then open up again.
  if (!train.isPlayer) {
    train.baseLever = train.baseLever ?? train.lever;
    if (train.heat > 80) train.cooling = true;
    else if (train.heat < 55) train.cooling = false;
    train.lever = train.cooling ? Math.min(train.baseLever, 0.8) : train.baseLever;
  }
  const boost = train.isPlayer ? race.competitive.boost : 0;
  const weight = train.baseWeight + train.cargo + train.fuel * LB_PER_GAL;
  const power = train.lever * (1 + boost);
  let vmax = topSpeedFor(train.hp * power, weight);
  if (train.slowFor > 0) {
    vmax *= 1 - R.siphon.steal;
    train.slowFor -= h;
  }
  if (train.surgeFor > 0) {
    vmax += train.surgeMph;
    train.surgeFor -= h;
  }
  // Damage drags top speed down, and a fresh hit staggers the train.
  vmax *= C.hullSpeedFloor + (1 - C.hullSpeedFloor) * (train.hull / train.hullMax);
  if (train.stagger > 0) vmax *= C.staggerSpeed;
  // Hills: a climb drags top speed down (Strength fights it), a descent lets it run.
  const grade = gradeAt(race.course, train.distance);
  const hill = hillEffect(grade, train.hillGrip);
  vmax *= hill.speed;
  train.grade = grade;
  // Heat drags top speed down; the Journey gathers speed with every 5 miles.
  const hot = heatPenalty(train.heat);
  vmax *= 1 - hot;
  if (train.journey) vmax *= 1 + train.journeyStacks * B.JOURNEY.speed;
  train.vmax = vmax;
  // Bends: every train slows to the bend's limit, braking early enough to make it.
  const cap = cornerCap(race.course, train.distance, vmax, train.grip);
  train.limit = cap;

  if (train.parked) {
    train.vmax = 0;
    train.speed = 0;
    return;
  }
  if (train.out) {
    train.vmax = 0;
    train.speed = Math.max(0, train.speed - R.brakeDecel * 4 * gh);
  } else if (train.fuel <= 0) {
    train.dry = true;
    train.dryFor += h;
    train.speed = Math.max(0, train.speed - R.coastDecel * gh);
    // Rivals call their own fuel truck so a race can never stall.
    if (!train.isPlayer && train.dryFor > 8) {
      train.fuel = 40;
      train.dry = false;
      train.dryFor = 0;
    }
  } else if (train.speed > cap) {
    train.speed = Math.max(cap, train.speed - B.TRACK.brake * gh);
  } else if (train.speed < Math.min(vmax, cap)) {
    // Pulling away is measured against the engine's own top speed, so a strong engine
    // climbs back out of a bend quickly.
    const total = accelSecondsFor(train.tq * power, weight) / train.accel / Math.max(0.4, 1 - hot);
    const rate = accelRate(vmax > 0 ? train.speed / vmax : 1, vmax, total);
    train.speed = Math.min(vmax, cap, train.speed + rate * gh);
  } else if (train.speed > vmax) {
    train.speed = Math.max(vmax, train.speed - R.brakeDecel * gh);
  }
  if (train.speed > train.topSeen) train.topSeen = train.speed;

  let miles = (train.speed * gh) / 3600;
  if (miles <= 0) return;
  const remaining = race.distance - train.distance;
  let used = 1;
  if (miles >= remaining) {
    used = remaining / miles;
    miles = remaining;
  }
  if (train.fuel > 0 && !train.out) {
    const ratio = vmax > 0 ? train.speed / vmax : 1;
    const burn = ((miles * (weight / 2000)) / train.tmpg) * leverFuelMult(train.lever) * accelFuelMult(ratio) * hill.fuel;
    if (burn >= train.fuel) {
      miles *= train.fuel / burn;
      train.fuelUsed += train.fuel;
      train.fuel = 0;
    } else {
      train.fuel -= burn;
      train.fuelUsed += burn;
    }
  }
  const before = train.distance;
  train.distance += miles;
  if (!train.parked) {
    const H = B.HEAT;
    const lever = train.lever * (1 + boost);
    const leverHeat = lever <= 1 ? 0.4 + 0.6 * lever * lever : 1 + 8 * (lever - 1) * train.overHeatMult;
    const journeyCool = train.journey ? 1 - train.journeyStacks * B.JOURNEY.heat : 1;
    const gain = (H.perMile * leverHeat + Math.max(0, grade) * H.climb) * train.heatMult * journeyCool;
    const shed = H.passive * train.coolMult * (1 + H.ease * Math.max(0, 0.9 - train.lever));
    train.heat = Math.min(H.max, Math.max(0, train.heat + (gain - shed) * miles));
    train.heatPeak = Math.max(train.heatPeak ?? 0, train.heat);
    if (train.secondWind > 0 && !train.secondWindUsed && train.heat >= H.secondWind.at) {
      train.secondWindUsed = true;
      train.heat *= 1 - H.secondWind.vent * Math.min(1.5, train.secondWind);
      if (train.isPlayer) race.fx.push({ type: 'vented', amount: 'Second Wind' });
    }
    if (train.journey) train.journeyStacks = Math.min(B.JOURNEY.stacks, Math.floor(train.distance / B.JOURNEY.every));
  }
  if (train.isPlayer) strikeBoulders(race, train, before);
  if (train.distance >= race.distance - 1e-9) {
    train.distance = race.distance;
    train.finished = true;
    train.finishGame = race.game - gh * (1 - used);
    train.finishReal = race.real - h * (1 - used);
  }
}

function updateField(race, h) {
  const player = playerOf(race);
  const rivals = race.trains.slice(1);
  if (rivals.length === 0) return;

  let nearest = null;
  let leader = null;
  let ahead = 0;
  for (const rival of rivals) {
    if (rival.finished || (!rival.out && rival.distance > player.distance)) ahead += 1;
    if (rival.out) continue;
    if (!leader || rival.distance > leader.distance) leader = rival;
    if (rival.finished) continue;
    if (!nearest || Math.abs(rival.distance - player.distance) < Math.abs(nearest.distance - player.distance)) nearest = rival;
  }
  race.place = ahead + 1;
  race.gapToLeader = leader ? player.distance - leader.distance : null;
  race.gap = nearest ? player.distance - nearest.distance : null;
  race.nearestId = nearest ? nearest.id : null;

  const comp = race.competitive;
  if (comp.power > 0) {
    const c = R.competitive;
    if (nearest && Math.abs(race.gap) <= c.rangeMiles) {
      comp.inRange += h;
      const base = comp.inRange >= c.t2 ? c.boost2 : comp.inRange >= c.t1 ? c.boost1 : 0;
      comp.boost = base * comp.power;
    } else {
      comp.inRange = 0;
      comp.boost = 0;
    }
  }

  // Test drive: the ability fires by itself a few seconds after the rival is up to speed.
  const ability = race.ability;
  if (ability && ability.auto && !ability.used && nearest) {
    // Trains take miles to reach full speed now, so it arms once the rival is properly under way.
    if (ability.armedAt === null && ((nearest.vmax > 0 && nearest.speed >= nearest.vmax * 0.6) || race.real > 10)) ability.armedAt = race.real;
    if (ability.armedAt !== null && race.real - ability.armedAt >= R.siphon.demoDelay) useAbility(race);
  }
  if (ability && ability.activeFor > 0) ability.activeFor -= h;
}

function updateEmergency(race, h) {
  const e = race.emergency;
  if (!e) return;
  e.remaining -= h;
  if (e.remaining > 0) return;
  if (e.phase === 'waiting') {
    e.phase = 'refuelling';
    e.remaining = e.refuelSeconds;
  } else {
    const player = playerOf(race);
    player.fuel += e.gallons;
    player.dry = false;
    player.dryFor = 0;
    race.emergency = null;
    race.events.push({ at: race.real, text: `${e.gallons} gallons delivered` });
  }
}

function substep(race, h) {
  race.real += h;
  race.game += h * B.TIME_SCALE;
  updateEmergency(race, h);
  for (const train of race.trains) if (!train.finished) advanceTrain(race, train, h);
  updateField(race, h);
  for (const train of race.trains) train.stagger = Math.max(0, train.stagger - h);
  // The player's lookout (and radar) spots obstacles ahead.
  const lookout = playerOf(race);
  let spotted = null;
  for (const rock of race.obstacles) {
    if (!rock.seen && rock.at - lookout.distance <= lookout.sight) {
      rock.seen = true;
      if (!spotted) spotted = rock;
    }
  }
  // A new sighting mid-run is announced, so the screen can show it off.
  if (spotted && race.real > 1.5) {
    const ahead = race.obstacles.filter((rock) => rock.seen && !rock.destroyed && !rock.struck && rock.at >= lookout.distance).length;
    race.fx.push({ type: 'spotted', id: spotted.id, size: spotted.size, hp: spotted.hp, miles: spotted.at - lookout.distance, ahead });
  }
  updateResources(race, h);
  updateBoot(race);
  if (race.combat) updateCombat(race, h);
  if (race.status !== 'running') return;
  const player = playerOf(race);
  if (race.kind === 'wall' && race.obstacles.every((rock) => rock.destroyed)) finishRace(race, 'smashed');
  else if (player.out) finishRace(race, 'derailed');
  else if (player.finished) finishRace(race, 'finished');
  else if (race.timeLimit && race.game >= race.timeLimit) finishRace(race, 'late');
}

// Advance the race by `dt` real seconds. Safe to call with any dt; it steps in fixed slices.
export function stepRace(race, dt, slice = R.substep) {
  if (race.status !== 'running') return race;
  let left = Math.min(dt, 5);
  while (left > 1e-9 && race.status === 'running') {
    const h = Math.min(slice, left);
    substep(race, h);
    left -= h;
  }
  return race;
}

export function setLever(race, lever) {
  const { min, max } = R.lever;
  playerOf(race).lever = Math.min(max, Math.max(min, lever));
}

export function emergencyQuote(race, gallons) {
  const e = R.emergency;
  const player = playerOf(race);
  const speedUp = 1 - Math.min(0.75, e.pitCrew * race.pitCrew);
  return {
    gallons,
    cost: gallons * e.price,
    waitSeconds: Math.min(e.waitMax, e.waitBase + player.distance * e.waitPerMile) * speedUp,
    refuelSeconds: gallons * e.perGallon * speedUp,
  };
}

export function orderEmergencyFuel(race, gallons) {
  const player = playerOf(race);
  if (race.status !== 'running' || race.emergency || player.fuel > 0) return false;
  const quote = emergencyQuote(race, gallons);
  if (!race.freeFuel && quote.cost > race.lt) return false;
  if (!race.freeFuel) {
    race.lt -= quote.cost;
    race.emergencyCost += quote.cost;
  }
  race.emergencyGallons += gallons;
  race.emergency = { phase: 'waiting', remaining: quote.waitSeconds, refuelSeconds: quote.refuelSeconds, gallons, cost: race.freeFuel ? 0 : quote.cost };
  return true;
}

// Siphon Speed: the nearest rival loses 10% of its speed and the player gains what it lost.
export function useAbility(race) {
  const ability = race.ability;
  if (!ability || ability.used || race.status !== 'running') return false;
  const target = race.trains.find((train) => train.id === race.nearestId);
  if (!target) return false;
  const player = playerOf(race);
  ability.used = true;
  ability.activeFor = R.siphon.seconds;
  target.slowFor = R.siphon.seconds;
  player.surgeFor = R.siphon.seconds;
  player.surgeMph = target.speed * R.siphon.steal;
  race.events.push({ at: race.real, text: `Siphon Speed drains ${target.name}` });
  race.fx.push({ type: 'siphon', from: target.id });
  return true;
}

// ---------- Boulders ----------

function strikeBoulders(race, train, before) {
  const H = B.HAZARD;
  const front = B.FRONTS[train.front] ?? B.FRONTS.cowcatcher;
  for (const rock of race.obstacles) {
    if (rock.destroyed || rock.struck || rock.at <= before || rock.at > train.distance) continue;
    rock.struck = true;
    const S = H.sizes[rock.size] ?? H.sizes.boulder;
    // A strong enough front bursts straight through.
    if (S.rank <= front.smash) {
      train.speed *= Math.max(0.9, front.keep);
      train.crushed = (train.crushed ?? 0) + 1;
      race.fx.push({ type: 'crush', id: rock.id });
      continue;
    }
    const cut = Math.max(front.cut, train.barrier > 0 ? train.barrierCut : 0);
    const damage = Math.round(S.crash * (0.85 + race.rng() * 0.3));
    const taken = Math.round(damage * (1 - cut));
    train.hull = Math.max(0, train.hull - taken);
    train.taken += taken;
    train.speed *= Math.max(S.keep, front.keep);
    train.stagger = H.crashStagger;
    train.crashes += 1;
    race.fx.push({ type: 'crash', id: rock.id, damage: taken });
    race.events.push({ at: race.real, text: `Hit ${S.name.toLowerCase()}: ${taken} damage` });
    if (train.hull <= 0) knockOff(race, train);
  }
}

// ---------- Weapons and spells ----------

export const SHIELDS = ['barrier', 'shield'];
// A key is a kind, or a kind with a number for the second of its kind: 'cannon#2'.
export const kindOf = (key) => String(key).split('#')[0];
export const isSpell = (key) => C[kindOf(key)]?.use === 'mp';
const live = (train) => !train.out && !train.finished;

// What `from` can hit within `range` miles. Rivals fight each other as well as you. For the player,
// obstacles ahead count too once spotted; the aim setting picks between them and rivals.
function targetFor(race, from, range) {
  let rival = null;
  let rivalD = Infinity;
  for (const train of race.trains) {
    if (train === from || !live(train)) continue;
    const d = Math.abs(train.distance - from.distance);
    if (d <= range && d < rivalD) {
      rival = train;
      rivalD = d;
    }
  }
  if (!from.isPlayer) return rival;
  let rock = null;
  for (const item of race.obstacles) {
    if (item.destroyed || item.struck || !item.seen) continue;
    const d = item.at - from.distance;
    if (d >= 0 && d <= range) {
      rock = item;
      break; // obstacles are in order: the first one ahead is the next to hit
    }
  }
  if (race.aim === 'rivals') return rival;
  if (race.aim === 'track') return rock;
  return rock ?? rival;
}
export const targetOf = (race, from, key) => {
  const arm = C[kindOf(key)] ? armOf(from, key) : null;
  return arm?.range ? targetFor(race, from, arm.range) : null;
};
export function setAim(race, aim) {
  if (['auto', 'rivals', 'track'].includes(aim)) race.aim = aim;
}

// A weapon's numbers on this train: the base rules, with the fitted weapon's own attributes on top.
export function armOf(train, key) {
  const base = C[kindOf(key)];
  const own = train.weaponStats?.[key];
  if (!own) return { ...base, accuracy: base.accuracy ?? 1, crit: base.crit ?? C.crit, critMult: C.critMult, pen: 0, echoEvery: 0 };
  return { ...base, ...own, cost: base.cost + (own.chargeExtra ?? 0) };
}

const resource = (train, use) => (use === 'mp' ? train.mp : use === 'ammo' ? train.ammo : train.charge);

// Why `from` cannot use `kind` right now, or null if it can.
export function castBlocker(race, from, kind) {
  const arm = C[kindOf(kind)] ? armOf(from, kind) : null;
  if (!arm || !from.arms.includes(kind)) return 'Not fitted';
  const cooler = COOLERS.includes(kindOf(kind));
  if (race.status !== 'running') return 'Nothing to fight';
  if (!race.combat && !cooler) return 'Nothing to fight';
  if (!live(from)) return 'Off the line';
  const booting = bootStatus(race, from, kind);
  if (booting) return booting;
  if ((from.cooldown[kind] ?? 0) > 0) return 'Reloading';
  if (cooler && from.heat < 3) return 'Engine is cool';
  if (resource(from, arm.use) < arm.cost * (arm.use === 'mp' ? from.mpCostMult ?? 1 : 1)) return arm.use === 'mp' ? 'Not enough MP' : arm.use === 'ammo' ? 'Out of ammo' : 'Battery low';
  if (arm.range && !targetFor(race, from, arm.range)) return 'Nothing in range';
  return null;
}

export function castSpell(race, from, kind) {
  if (castBlocker(race, from, kind)) return false;
  const arm = armOf(from, kind);
  // A missile launcher fires as much of its burst as the ammo allows.
  const burst = arm.burst ? Math.max(1, Math.min(arm.burst, Math.floor(from.ammo / arm.cost))) : 1;
  if (arm.use === 'mp') from.mp -= arm.cost * (from.mpCostMult ?? 1);
  else if (arm.use === 'ammo') {
    from.ammo -= arm.cost * burst;
    from.roundsFired += arm.cost * burst;
  } else from.charge -= arm.cost;
  from.cooldown[kind] = (arm.cooldown + (arm.channel ?? 0)) * (arm.use === 'mp' || arm.channel ? from.spellCdMult ?? 1 : 1);
  if (COOLERS.includes(kindOf(kind))) {
    const before = from.heat;
    from.heat = Math.max(0, from.heat - arm.vent);
    race.fx.push({ type: 'vented', id: from.id, amount: Math.round(before - from.heat) });
    return true;
  }
  if (SHIELDS.includes(kindOf(kind))) {
    from.barrier = arm.seconds;
    from.barrierCut = arm.cut;
    race.fx.push({ type: 'barrier', id: from.id, kind: kindOf(kind) });
    return true;
  }
  const target = targetFor(race, from, arm.range);
  if (arm.channel) {
    // Lightning: a channel that ticks every quarter second and grows with every tick.
    const channel = { id: ++race.shotSeq, from: from.id, key: kind, to: target.id, t: 0, ticks: 0, seconds: arm.channel, tick: arm.tick, base: arm.base, amp: arm.amp, pen: arm.pen ?? 0, range: arm.range };
    race.channels.push(channel);
    race.fx.push({ type: 'channel', channel });
    return true;
  }
  const total = arm.travel ?? arm.strike;
  const fire = (delay, echo) => {
    const shot = { id: ++race.shotSeq, kind: kindOf(kind), key: kind, from: from.id, to: target.id, left: total + delay, total: total + delay, delay, dragon: kind === 'fire' && from.model === 'dragon', echo };
    race.shots.push(shot);
    race.fx.push({ type: 'cast', shot });
  };
  for (let i = 0; i < burst; i++) fire(i * (arm.burstGap ?? 0), false);
  // Echoing Shot: every few shots a free extra one follows.
  from.shotsFired[kind] = (from.shotsFired[kind] ?? 0) + 1;
  if (arm.echoEvery && from.shotsFired[kind] % arm.echoEvery === 0) fire(burst * (arm.burstGap ?? 0) + 0.25, true);
  return true;
}

export const playerCast = (race, kind) => castSpell(race, playerOf(race), kind);

// Fire All: every weapon and attack spell that is ready and has something in range.
export function fireAll(race) {
  const player = playerOf(race);
  let fired = 0;
  for (const key of player.arms) {
    if (SHIELDS.includes(kindOf(key)) || COOLERS.includes(kindOf(key))) continue;
    if (castSpell(race, player, key)) fired += 1;
  }
  return fired;
}

function knockOff(race, train) {
  if (train.out) return;
  train.out = true;
  race.fx.push({ type: 'derail', id: train.id });
  race.events.push({ at: race.real, text: `${train.isPlayer ? 'You were' : `${train.name} was`} knocked off the rails` });
}

// Armor turns away a share of the hit; penetration ignores part of the armor.
const afterArmor = (damage, armor, pen) => Math.round(damage * (1 - armor * (1 - Math.min(1, pen))));

// Deal damage to a train or an obstacle. dot = burn or poison ticks: they ignore armor and shields.
function hurt(race, from, targetId, damage, { kind, crit = false, pen = 0, dot = false } = {}) {
  const rock = race.obstacles.find((item) => item.id === targetId);
  if (rock) {
    if (rock.destroyed || rock.struck) return false;
    if (!dot) damage = afterArmor(damage, rock.armor, pen);
    rock.hp = Math.max(0, rock.hp - damage);
    if (from) from.dealt += damage;
    race.fx.push({ type: 'hit', kind, to: rock.id, damage, crit, blocked: false, dot });
    if (rock.hp <= 0) {
      rock.destroyed = true;
      race.fx.push({ type: 'smash', id: rock.id });
    }
    return true;
  }
  const target = race.trains.find((train) => train.id === targetId);
  // A train that has crossed the line or left the rails is out of reach.
  if (!target || !live(target)) return false;
  let blocked = false;
  if (!dot) {
    damage = afterArmor(damage, target.armor ?? 0, pen);
    blocked = target.barrier > 0;
    if (blocked) damage = Math.round(damage * (1 - target.barrierCut));
    target.stagger = Math.max(target.stagger, blocked ? C.staggerBlocked : kind === 'arc' ? C.staggerBlocked : C.stagger);
  }
  target.hull = Math.max(0, target.hull - damage);
  target.taken += damage;
  if (!dot && damage > 0) target.hitOnce = true;
  if (kind === 'fire') target.heat = Math.min(B.HEAT.max, target.heat + C.fireHeat);
  if (from) from.dealt += damage;
  race.fx.push({ type: 'hit', kind, to: target.id, damage, crit, blocked, dot });
  if (target.hull <= 0) knockOff(race, target);
  return true;
}

// Burn and Poison stacks, on whatever was hit.
function afflict(race, targetId, burn, poison, from = null) {
  if (!burn && !poison) return;
  const k = from?.dotMult ?? 1;
  burn = Math.round(burn * k);
  poison = Math.round(poison * k);
  const thing = race.obstacles.find((item) => item.id === targetId) ?? race.trains.find((train) => train.id === targetId);
  if (!thing) return;
  thing.burn = (thing.burn ?? 0) + burn;
  thing.poison = (thing.poison ?? 0) + poison;
}

function land(race, shot) {
  const from = race.trains.find((train) => train.id === shot.from);
  const arm = from ? armOf(from, shot.key ?? shot.kind) : C[shot.kind];
  const rock = race.obstacles.find((item) => item.id === shot.to);
  // Accuracy: a still obstacle is easier to hit.
  const accuracy = Math.min(1, (arm.accuracy ?? 1) + (rock ? 0.1 : 0));
  if (race.rng() > accuracy) {
    if (from) from.misses += 1;
    race.fx.push({ type: 'miss', kind: shot.kind, to: shot.to });
    return;
  }
  if (from) from.hits += 1;
  let damage = arm.damage[0] + race.rng() * (arm.damage[1] - arm.damage[0]);
  // Spells grow with the conductor's Intelligence.
  if (arm.use === 'mp' && from) damage *= from.spellPower ?? 1;
  if (shot.dragon) damage *= C.dragonFire;
  damage = Math.round(damage);
  const crit = race.rng() < (arm.crit ?? C.crit);
  if (crit) damage = Math.round(damage * (arm.critMult ?? C.critMult));
  if (hurt(race, from, shot.to, damage, { kind: shot.kind, crit, pen: arm.pen ?? 0 })) afflict(race, shot.to, arm.burn ?? 0, arm.poison ?? 0, from);
}

// Lightning channels tick: base + amp x ticks so far, every quarter second, while the target holds.
function updateChannels(race, h) {
  for (let i = race.channels.length - 1; i >= 0; i--) {
    const c = race.channels[i];
    const from = race.trains.find((train) => train.id === c.from);
    const rock = race.obstacles.find((item) => item.id === c.to);
    const target = race.trains.find((train) => train.id === c.to);
    const gone = !from || !live(from) || (rock ? rock.destroyed || rock.struck : !target || !live(target));
    const far = from && (rock ? rock.at - from.distance : Math.abs((target?.distance ?? 0) - from.distance)) > c.range * 1.15;
    const total = Math.round(c.seconds / c.tick);
    if (gone || far || c.ticks >= total) {
      race.channels.splice(i, 1);
      race.fx.push({ type: 'channelEnd', id: c.id });
      continue;
    }
    c.t += h;
    while (c.ticks < total && c.t >= (c.ticks + 1) * c.tick) {
      const damage = c.base + c.amp * c.ticks;
      c.ticks += 1;
      if (from) from.hits += 1;
      if (!hurt(race, from, c.to, damage, { kind: 'arc', pen: c.pen })) break;
      const arm = from ? armOf(from, c.key) : null;
      if (arm) afflict(race, c.to, arm.burn ?? 0, arm.poison ?? 0, from);
    }
  }
}

// Burn: 1 damage a stack each second, then a stack falls away. Poison: every 2 seconds, never falls away.
function updateAfflictions(race, h) {
  const tick = (thing, id) => {
    if (thing.burn > 0) {
      thing.burnT = (thing.burnT ?? 0) + h;
      if (thing.burnT >= C.burn.tick) {
        thing.burnT -= C.burn.tick;
        const damage = thing.burn;
        thing.burn -= 1;
        hurt(race, null, id, damage, { kind: 'burn', dot: true });
      }
    } else thing.burnT = 0;
    if (thing.poison > 0) {
      thing.poisonT = (thing.poisonT ?? 0) + h;
      if (thing.poisonT >= C.poison.tick) {
        thing.poisonT -= C.poison.tick;
        hurt(race, null, id, thing.poison, { kind: 'poison', dot: true });
      }
    }
  };
  for (const train of race.trains) if (live(train) && (train.burn > 0 || train.poison > 0)) tick(train, train.id);
  for (const rock of race.obstacles) if (!rock.destroyed && !rock.struck && (rock.burn > 0 || rock.poison > 0)) tick(rock, rock.id);
}

// Rivals: raise a shield when hurt and something is incoming, otherwise every attack that is ready.
function think(race, rival, h) {
  rival.think -= h;
  if (rival.think > 0 || !live(rival)) return;
  const alive = race.trains.slice(1).filter(live).length || 1;
  rival.think = (C.ai.think[0] + race.rng() * (C.ai.think[1] - C.ai.think[0])) * Math.sqrt(alive);
  const incoming = race.shots.some((shot) => shot.to === rival.id);
  if (incoming && rival.barrier <= 0 && rival.hull < rival.hullMax * C.ai.barrierBelow && race.rng() < C.ai.barrierChance) {
    if (castSpell(race, rival, 'barrier') || castSpell(race, rival, 'shield')) return;
  }
  // Rivals vent heat once it starts to bite.
  if (rival.heat > 65) for (const key of rival.arms) if (COOLERS.includes(kindOf(key)) && castSpell(race, rival, key)) return;
  const attacks = rival.arms.filter((key) => !SHIELDS.includes(kindOf(key)) && !COOLERS.includes(kindOf(key)));
  // Bigger hits first, sometimes.
  attacks.sort((a, b) => (C[kindOf(b)].damage?.[1] ?? 0) - (C[kindOf(a)].damage?.[1] ?? 0));
  if (race.rng() >= C.ai.bigChance) attacks.reverse();
  for (const key of attacks) if (castSpell(race, rival, key)) return;
}

// MP, charge and cooldowns tick in every race, so coolers work even without a fight.
function updateResources(race, h) {
  for (const train of race.trains) {
    train.mp = Math.min(C.mpMax, train.mp + C.mpRegen * train.mpRegen * train.mpRegenMult * h);
    if (train.chargeMax > 0) train.charge = Math.min(train.chargeMax, train.charge + C.chargeRegen * train.chargeRegenMult * h);
    for (const kind of Object.keys(train.cooldown)) train.cooldown[kind] = Math.max(0, train.cooldown[kind] - h);
    train.barrier = Math.max(0, train.barrier - h);
  }
}

function updateCombat(race, h) {
  updateChannels(race, h);
  updateAfflictions(race, h);
  for (let i = race.shots.length - 1; i >= 0; i--) {
    const shot = race.shots[i];
    shot.left -= h;
    if (shot.left <= 0) {
      race.shots.splice(i, 1);
      land(race, shot);
    }
  }
  for (const rival of race.trains.slice(1)) think(race, rival, h);
}

export function forfeitRace(race) {
  if (race.status === 'running' || race.status === 'ready') finishRace(race, 'forfeit');
}

function finishRace(race, reason) {
  const player = playerOf(race);
  // A fuel truck that never arrived is not paid for.
  if (race.emergency) {
    race.lt += race.emergency.cost;
    race.emergencyCost -= race.emergency.cost;
    race.emergencyGallons -= race.emergency.gallons;
    race.emergency = null;
  }
  const rivals = race.trains.slice(1);
  let place = 1;
  for (const rival of rivals) {
    if (player.out) {
      if (!rival.out) place += 1;
    } else if (player.finished) {
      if (rival.finished && rival.finishGame < player.finishGame) place += 1;
    } else if (rival.finished || (!rival.out && rival.distance > player.distance)) {
      place += 1;
    }
  }
  const standings = race.trains
    .map((train) => ({
      id: train.id,
      name: train.name,
      locoName: train.locoName,
      isPlayer: train.isPlayer,
      finished: train.finished,
      out: train.out,
      gameSeconds: train.finishGame,
      distance: train.distance,
    }))
    .sort((a, b) => {
      if (a.finished && b.finished) return a.gameSeconds - b.gameSeconds;
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      if (a.out !== b.out) return a.out ? 1 : -1;
      return b.distance - a.distance;
    });
  const gameSeconds = player.finished ? player.finishGame : race.game;
  race.status = 'finished';
  race.place = place;
  race.result = {
    kind: race.kind,
    reason,
    finished: player.finished,
    place,
    field: race.trains.length,
    distance: player.distance,
    raceDistance: race.distance,
    gameSeconds,
    realSeconds: player.finished ? player.finishReal : race.real,
    timeLimit: race.timeLimit,
    underLimitPct: race.timeLimit && player.finished ? Math.max(0, ((race.timeLimit - gameSeconds) / race.timeLimit) * 100) : 0,
    avgMph: gameSeconds > 0 ? player.distance / (gameSeconds / 3600) : 0,
    topMph: player.topSeen,
    fuelLoaded: player.fuelStart,
    fuelUsed: player.fuelUsed,
    fuelLeft: player.fuel,
    emergencyGallons: race.emergencyGallons,
    emergencyCost: race.emergencyCost,
    combat: race.combat,
    damageDealt: player.dealt,
    damageTaken: player.taken,
    derailed: player.out,
    rivalsDerailed: rivals.filter((rival) => rival.out).length,
    roundsFired: player.roundsFired,
    hits: player.hits,
    misses: player.misses,
    towUse: player.tow > 0 ? player.cargo / player.tow : 0,
    hullLost: player.hullMax > 0 ? Math.min(1, player.taken / player.hullMax) : 0,
    crashes: player.crashes,
    heatPeak: Math.round(player.heatPeak ?? player.heat),
    heatEnd: Math.round(player.heat),
    boulders: race.obstacles.length,
    bouldersSmashed: race.obstacles.filter((rock) => rock.destroyed).length,
    bouldersCrushed: player.crushed ?? 0,
    standings,
  };
}

// Runs a locomotive over a distance alone and reports what the trip takes.
// The setup screens use this, so the estimate always matches the race.
export function planTrip(stats, cargoLb, distance, course = null) {
  const run = (fuel) => {
    const race = createRace({
      kind: 'plan',
      distance,
      course,
      player: { name: 'plan', stats, fuel, cargoLb },
    });
    startRace(race);
    let guard = 0;
    while (race.status === 'running' && guard++ < 200000) {
      if (playerOf(race).fuel <= 0 && playerOf(race).speed <= 0) break;
      stepRace(race, 1, 0.25);
    }
    return race;
  };
  // First pass with a full tank, second with only what the trip needs (a lighter train).
  const first = run(stats.tank);
  const p1 = playerOf(first);
  let needed = p1.fuelUsed;
  let finished = p1.finished;
  if (!finished) {
    // More than one tank: scale the burn up to the full distance.
    needed = p1.distance > 0 ? (p1.fuelUsed / p1.distance) * distance : Infinity;
  }
  const loaded = Math.min(stats.tank, Math.ceil(needed * 1.1));
  const second = finished ? run(loaded) : first;
  const p2 = playerOf(second);
  const result = p2.finished ? p2 : p1;
  const gameSeconds = result.finished ? result.finishGame : (distance / Math.max(1, result.topSeen)) * 3600;
  return {
    gallons: p2.finished ? p2.fuelUsed : needed,
    oneTank: finished,
    gameSeconds,
    realSeconds: gameSeconds / B.TIME_SCALE,
    avgMph: distance / (gameSeconds / 3600),
    topMph: result.topSeen,
  };
}

/**
 * Estimated time of arrival: runs a copy of the player's train, alone, from where it is now to the
 * line, with the lever where it is now, the bends ahead and the fuel on board. Boulders, rivals and
 * spells are left out. Returns real and game seconds to go, or where the fuel would run out.
 */
export function projectFinish(race) {
  const player = playerOf(race);
  if (player.finished) return { realSeconds: 0, gameSeconds: 0, dryAt: null };
  const sim = createRace({ kind: 'plan', distance: race.distance, course: race.course, player: { name: 'eta', stats: { hp: 1, tq: 1, weight: 1, tmpg: 1, tank: 1 }, fuel: 0 } });
  const copy = sim.trains[0];
  for (const key of ['hp', 'tq', 'baseWeight', 'tmpg', 'tank', 'cargo', 'fuel', 'lever', 'speed', 'distance', 'hull', 'hullMax', 'slowFor', 'surgeFor', 'surgeMph']) copy[key] = player[key];
  copy.stagger = 0;
  startRace(sim);
  let guard = 0;
  while (sim.status === 'running' && guard++ < 20000) {
    if (copy.fuel <= 0 && copy.speed < 0.5) return { realSeconds: null, gameSeconds: null, dryAt: copy.distance };
    stepRace(sim, 0.5, 0.25);
  }
  return { realSeconds: copy.finishReal ?? sim.real, gameSeconds: copy.finishGame ?? sim.game, dryAt: null };
}
