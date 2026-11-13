import { B } from './balance.js';
import { accelSecondsFor, topSpeedFor } from './locomotives.js';
import { makeRng, newSeed, weightedPick } from './rng.js';
import { cornerCap, gradeAt, hillEffect, makeCourse, themeOf, waterAt, waterDrag } from './course.js';

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
    // Tesla Coil: volts in the battery pack, and the wheel capacitors that charge it.
    volts: 0,
    voltsMax: Math.max(0, ...Object.entries(spec.stats.weaponStats ?? {}).filter(([k]) => k.split('#')[0] === 'tesla').map(([, w]) => w.voltsMax ?? 0)),
    capacitors: false,
    // Wind Jet: panels out or in, wind stored, and the gust that slows a train it catches.
    windMax: spec.stats.wind ? B.WIND.max : 0,
    wind: 0,
    panels: false,
    windCd: 0,
    windSlowFor: 0,
    windSlow: 0,
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
    weaponPower: spec.stats.weaponPower ?? 1,
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
    // Legendary machines: the signature ability, Rebirth, and jaws that crush what they meet.
    ability: spec.ability ? makeAbility(spec.ability) : null,
    rebirth: spec.stats.rebirth ?? 0,
    reborn: false,
    smash: spec.stats.smash ?? -1,
    team: spec.team ?? null, // trains on the same team leave each other alone
    champion: !!spec.champion, // the named champion of a World Open event
    gravFor: 0, // Black Hole: seconds of extra weight
    gravLb: 0,
    frozenFor: 0, // Absolute Zero: slowed and unable to fire
    frozenSlow: 0,
    unstoppable: 0, // Bulwark: nothing staggers or slows it, and it crushes obstacles
    fuelStolen: 0,
  };
}

const makeAbility = (id) => ({ id, used: false, uses: B.ABILITIES[id]?.uses ?? null, cd: 0, activeFor: 0 });

// A boss: it keeps station beside the player's train instead of racing, has a hull and armor like
// any train, and fights with its own telegraphed attacks (see bossThink).
function makeBoss(def) {
  const stats = { hp: 1, tq: 1, weight: 1, tmpg: 1, tank: 0, hull: def.hull, armor: def.armor ?? 0, arms: [] };
  const train = makeTrain({ id: 'boss', name: def.name, locoName: def.title ?? '', model: def.look ?? 'boss', stats, fuel: 0, team: 'boss' }, false);
  train.isBoss = true;
  train.hidden = true; // not on the line yet: cannot be seen or hit
  train.boss = { id: def.id, def, state: 'waiting', t: 0, clock: 0, next: 0, windup: null, reel: 0, enraged: false, cd: {}, left: def.seconds ?? B.BOSS.seconds, fought: 0 };
  train.distance = B.BOSS.offset.far;
  return train;
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
  const boss = config.boss ? makeBoss(config.boss) : null;
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
    trains: [player, ...rivals, ...(boss ? [boss] : [])],
    boss, // the boss train, or null
    bossDownAt: null,
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
    // The player's signature ability (the same object as player.ability).
    ability: player.ability ? Object.assign(player.ability, { auto: config.kind === 'demo', armedAt: null }) : null,
    events: [],
    combat: !!config.combat && (rivals.length > 0 || obstacles.length > 0 || !!boss),
    course,
    obstacles,
    aim: 'auto', // the player's aim: 'auto' (obstacles first), 'rivals' or 'track'
    shots: [], // shots and spells in flight
    channels: [], // lightning being channelled: { id, from, key, to, t, ticks, ... }
    fx: [], // things for the screen to show: { type: 'cast' | 'hit' | 'derail' | 'smash' | 'crash', ... }
    shotSeq: 0,
    bootInstant: !!config.bootInstant, // the Damage Wall: everything is online from the start
    bossEndsRun: !!boss && config.bossEndsRun !== false, // a bounty hunt ends when the boss falls or flees
    // The guided first run (see updateGuide). `prompt` pauses the race until the screen clears it.
    guide: config.guide ? { stage: 'launch', prompt: null, seen: [], bend: (course?.bends ?? [])[0] ?? null } : null,
    rng,
    result: null,
  };
}

export const playerOf = (race) => race.trains[0];
export const startRace = (race) => {
  if (race.status === 'ready') race.status = 'running';
};

function advanceTrain(race, train, h) {
  if (train.isBoss) return advanceBoss(race, train, h);
  const gh = h * B.TIME_SCALE;
  // Rivals ease off to let a hot engine cool, then open up again.
  if (!train.isPlayer) {
    train.baseLever = train.baseLever ?? train.lever;
    if (train.heat > 80) train.cooling = true;
    else if (train.heat < 55) train.cooling = false;
    train.lever = train.cooling ? Math.min(train.baseLever, 0.8) : train.baseLever;
  }
  const boost = train.isPlayer ? race.competitive.boost : 0;
  // Black Hole: a rival's gravity well piles weight on for a few seconds.
  if (train.gravFor > 0) train.gravFor -= h;
  const weight = train.baseWeight + train.cargo + train.fuel * LB_PER_GAL + (train.gravFor > 0 ? train.gravLb : 0);
  const power = train.lever * (1 + boost) * (train.guidePower ?? 1);
  let vmax = topSpeedFor(train.hp * power, weight);
  if (train.crippled) vmax *= B.RACE.testRace.guide.crippledSpeed;
  if (train.slowFor > 0) {
    vmax *= 1 - R.siphon.steal;
    train.slowFor -= h;
  }
  if (train.surgeFor > 0) {
    vmax += train.surgeMph;
    train.surgeFor -= h;
  }
  // A rival's Wind Gust: resistance that holds the train back for a few seconds.
  if (train.windSlowFor > 0) {
    if (!(train.unstoppable > 0)) vmax *= 1 - train.windSlow;
    train.windSlowFor -= h;
  }
  // Absolute Zero: frozen wheels.
  if (train.frozenFor > 0) {
    if (!(train.unstoppable > 0)) vmax *= 1 - train.frozenSlow;
    train.frozenFor -= h;
  }
  if (train.windCd > 0) train.windCd -= h;
  // Wind Jet panels out: drag now, wind for later.
  if (train.panels && train.windMax > 0) vmax *= 1 - B.WIND.drag;
  // Damage drags top speed down, and a fresh hit staggers the train.
  vmax *= C.hullSpeedFloor + (1 - C.hullSpeedFloor) * (train.hull / train.hullMax);
  if (train.stagger > 0 && !(train.unstoppable > 0)) vmax *= C.staggerSpeed;
  // Hills: a climb drags top speed down (Strength fights it), a descent lets it run.
  const grade = gradeAt(race.course, train.distance);
  const hill = hillEffect(grade, train.hillGrip);
  vmax *= hill.speed;
  train.grade = grade;
  // Terrain: wading through floodwater drags top speed down (torque and Agility push through).
  const theme = themeOf(race.course);
  const wading = !!waterAt(race.course, train.distance);
  train.wading = wading;
  train.waterLoss = wading ? waterDrag(train.tq, weight, train.grip) : 0;
  if (wading) vmax *= 1 - train.waterLoss;
  // Heat drags top speed down; the Journey gathers speed with every 5 miles.
  const hot = heatPenalty(train.heat);
  vmax *= 1 - hot;
  if (train.journey) vmax *= 1 + train.journeyStacks * B.JOURNEY.speed;
  // Tesla capacitors on the wheels: resistance that slows the train while they charge the coil.
  const coil = train.capacitors && train.voltsMax > 0 ? teslaOf(train) : null;
  if (coil) vmax *= 1 - coil.drag * (coil.drain ?? 1);
  train.vmax = vmax;
  // Bends: every train slows to the bend's limit, braking early enough to make it.
  // Ice: bends hold less speed unless Agility grips.
  const cap = cornerCap(race.course, train.distance, vmax, train.grip) * (theme.ice ? 1 - theme.ice * (1 - train.grip) : 1);
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
    const total = (accelSecondsFor(train.tq * power, weight) / train.accel / Math.max(0.4, 1 - hot)) * (wading ? B.TRACK.water.accel : 1) / (theme.accel ?? 1);
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
    const burn = ((miles * (weight / 2000)) / train.tmpg) * leverFuelMult(train.lever) * accelFuelMult(ratio) * hill.fuel * (wading ? B.TRACK.water.fuel : 1);
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
  if (coil) train.volts = Math.min(train.voltsMax, train.volts + miles * coil.chargePerMile);
  if (train.panels && train.windMax > 0) train.wind = Math.min(train.windMax, train.wind + miles * train.speed * B.WIND.perMile);
  if (!train.parked) {
    const H = B.HEAT;
    const lever = train.lever * (1 + boost);
    const leverHeat = lever <= 1 ? 0.4 + 0.6 * lever * lever : 1 + 8 * (lever - 1) * train.overHeatMult;
    const journeyCool = train.journey ? 1 - train.journeyStacks * B.JOURNEY.heat : 1;
    const gain = (H.perMile * leverHeat + Math.max(0, grade) * H.climb + (wading ? B.TRACK.water.heat : 0)) * train.heatMult * journeyCool * (theme.heat ?? 1);
    const shed = H.passive * train.coolMult * (1 + H.ease * Math.max(0, 0.9 - train.lever)) * (theme.shed ?? 1);
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
  const rivals = rivalsOf(race);
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
  if (race.guide) updateGuide(race);
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
  const boss = race.boss;
  if (boss?.out && race.bossDownAt === null) race.bossDownAt = race.real;
  if (race.kind === 'wall' && race.obstacles.every((rock) => rock.destroyed)) finishRace(race, 'smashed');
  // The boss is down: the bounty is won, whatever happens in the moments after.
  else if (boss?.out && race.bossEndsRun && (player.out || race.real - race.bossDownAt >= B.BOSS.slainDelay)) finishRace(race, 'slain');
  else if (player.out) finishRace(race, 'derailed');
  else if (boss && boss.boss.state === 'fled' && race.bossEndsRun) finishRace(race, 'escaped');
  else if (player.finished) finishRace(race, 'finished');
  else if (race.timeLimit && race.game >= race.timeLimit) finishRace(race, 'late');
}

// Advance the race by `dt` real seconds. Safe to call with any dt; it steps in fixed slices.
export function stepRace(race, dt, slice = R.substep) {
  if (race.status !== 'running') return race;
  let left = Math.min(dt, 5);
  while (left > 1e-9 && race.status === 'running' && !race.guide?.prompt) {
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

// ---------- Signature abilities (the legendary machines) ----------

// The trains racing the player: everyone but the player and a boss.
export const rivalsOf = (race) => race.trains.filter((train) => !train.isPlayer && !train.isBoss);
const foes = (a, b) => a !== b && !(a.team && a.team === b.team);
// Live enemies of `from` within `range` miles, nearest first.
function enemiesOf(race, from, range = Infinity) {
  return race.trains
    .filter((train) => foes(from, train) && live(train) && Math.abs(train.distance - from.distance) <= range)
    .sort((a, b) => Math.abs(a.distance - from.distance) - Math.abs(b.distance - from.distance));
}
// Obstacles the player has spotted on the line ahead, within `range` miles. Only the player's line has any.
function rocksAhead(race, from, range) {
  if (!from.isPlayer) return [];
  return race.obstacles.filter((rock) => rock.seen && !rock.destroyed && !rock.struck && rock.at >= from.distance && rock.at - from.distance <= range);
}

// A shot that carries its own numbers (an ability's, or a boss attack's) instead of a weapon's.
function customShot(race, from, toId, kind, seconds, custom, delay = 0) {
  const shot = { id: ++race.shotSeq, kind, key: kind, from: from.id, to: toId, left: seconds + delay, total: seconds + delay, delay, dragon: !!custom.dragon, custom };
  race.shots.push(shot);
  race.fx.push({ type: 'cast', shot });
  return shot;
}

// What each ability does. Returns false if there was nothing for it to do.
const ABILITY = {
  // Siphon Speed: the nearest rival loses 10% of its speed and the user gains what it lost.
  siphon: {
    need: (race, from) => (siphonTarget(race, from) ? null : 'No rival to drain'),
    use(race, from) {
      const target = siphonTarget(race, from);
      from.ability.activeFor = R.siphon.seconds;
      target.slowFor = R.siphon.seconds;
      from.surgeFor = R.siphon.seconds;
      from.surgeMph = target.speed * R.siphon.steal;
      race.events.push({ at: race.real, text: `Siphon Speed drains ${target.name}` });
      race.fx.push({ type: 'siphon', from: target.id, to: from.id });
    },
  },
  // Black Hole: rivals in reach suddenly weigh a mountain; bosses and obstacles are crushed.
  blackhole: {
    need: (race, from, A) => (enemiesOf(race, from, A.range).length || rocksAhead(race, from, A.range).length ? null : 'Nothing in reach'),
    use(race, from, A) {
      const hit = [];
      const crush = () => Math.round((A.crush[0] + race.rng() * (A.crush[1] - A.crush[0])) * (from.spellPower ?? 1));
      for (const train of enemiesOf(race, from, A.range)) {
        hit.push(train.id);
        if (train.isBoss) hurt(race, from, train.id, crush(), { kind: 'gravity', pen: 1 });
        else if (!(train.unstoppable > 0)) {
          train.gravFor = A.seconds;
          train.gravLb = A.weight;
        }
      }
      for (const rock of rocksAhead(race, from, A.range)) {
        hit.push(rock.id);
        hurt(race, from, rock.id, crush(), { kind: 'gravity', pen: 1 });
      }
      from.ability.activeFor = A.seconds;
      race.events.push({ at: race.real, text: `${from.isPlayer ? 'Black Hole' : `${from.name}'s Black Hole`} drags the field down` });
      race.fx.push({ type: 'ability', id: 'blackhole', from: from.id, to: hit, seconds: A.seconds });
    },
  },
  // Tempest: a bolt for every enemy and every spotted obstacle in reach.
  tempest: {
    need: (race, from, A) => (enemiesOf(race, from, A.range).length || rocksAhead(race, from, A.range).length ? null : 'Nothing in range'),
    use(race, from, A) {
      const targets = [...enemiesOf(race, from, A.range), ...rocksAhead(race, from, A.range)];
      targets.forEach((target, i) => customShot(race, from, target.id, 'bolt', A.strike, { damage: A.damage, spell: true }, i * 0.12));
      race.fx.push({ type: 'ability', id: 'tempest', from: from.id, to: targets.map((t) => t.id) });
    },
  },
  // Bulwark: a fortress for a few seconds.
  bulwark: {
    need: () => null,
    use(race, from, A) {
      from.barrier = A.seconds;
      from.barrierCut = A.cut;
      from.unstoppable = A.seconds;
      from.stagger = 0;
      from.ability.activeFor = A.seconds;
      race.fx.push({ type: 'barrier', id: from.id, kind: 'bulwark' });
      race.fx.push({ type: 'ability', id: 'bulwark', from: from.id, seconds: A.seconds });
    },
  },
  // Inferno: dragonfire over everything ahead and beside, and the engine breathes its heat out.
  inferno: {
    need: (race, from, A) => (enemiesOf(race, from, A.range).length || rocksAhead(race, from, A.range).length ? null : 'Nothing in range'),
    use(race, from, A) {
      const targets = [...enemiesOf(race, from, A.range), ...rocksAhead(race, from, A.range)];
      targets.forEach((target, i) => customShot(race, from, target.id, 'fire', 0.7, { damage: A.damage, burn: A.burn, spell: true, dragon: true }, i * 0.08));
      const before = from.heat;
      from.heat = Math.max(0, from.heat - A.vent);
      if (before - from.heat >= 1) race.fx.push({ type: 'vented', id: from.id, amount: Math.round(before - from.heat) });
      race.fx.push({ type: 'ability', id: 'inferno', from: from.id, to: targets.map((t) => t.id) });
    },
  },
  // Plunder: hooks on the nearest enemy. Fuel, MP and charge change hands; its weapons jam.
  plunder: {
    need: (race, from, A) => (enemiesOf(race, from, A.range).length ? null : 'No enemy in reach'),
    use(race, from, A) {
      const target = enemiesOf(race, from, A.range)[0];
      const gallons = target.isBoss ? A.fuel : Math.min(A.fuel, target.fuel);
      if (!target.isBoss) target.fuel -= gallons;
      const room = Math.max(0, from.tank - from.fuel);
      const taken = Math.min(gallons, room);
      from.fuel += taken;
      from.fuelStolen += taken;
      const mp = target.mp * A.drain;
      target.mp -= mp;
      from.mp = Math.min(C.mpMax, from.mp + mp);
      if (from.chargeMax > 0) {
        const charge = target.isBoss ? from.chargeMax * A.drain : target.charge * A.drain;
        if (!target.isBoss) target.charge -= charge;
        from.charge = Math.min(from.chargeMax, from.charge + charge);
      }
      if (target.isBoss) jamBoss(target, A.jam);
      else for (const key of target.arms) target.cooldown[key] = (target.cooldown[key] ?? 0) + A.jam;
      race.events.push({ at: race.real, text: `${from.isPlayer ? 'You plunder' : `${from.name} plunders`} ${target.isPlayer ? 'you' : target.name}: ${Math.round(taken)} gal` });
      race.fx.push({ type: 'ability', id: 'plunder', from: from.id, to: [target.id], gallons: Math.round(taken) });
    },
  },
  // Absolute Zero: everything in reach freezes; the engine's own heat drops to nothing.
  zero: {
    need: () => null,
    use(race, from, A) {
      const hit = enemiesOf(race, from, A.range);
      for (const train of hit) {
        if (train.unstoppable > 0) continue;
        train.frozenFor = A.seconds;
        train.frozenSlow = A.slow;
        if (train.isBoss) jamBoss(train, 0);
      }
      const before = from.heat;
      from.heat = 0;
      if (before >= 1) race.fx.push({ type: 'vented', id: from.id, amount: Math.round(before) });
      race.fx.push({ type: 'ability', id: 'zero', from: from.id, to: hit.map((t) => t.id), seconds: A.seconds });
    },
  },
  // Maw: bite the next obstacle (or the nearest enemy close by). Eat what it kills.
  maw: {
    need: (race, from, A) => (rocksAhead(race, from, A.range).length || enemiesOf(race, from, 0.5).length ? null : 'Nothing to bite'),
    use(race, from, A) {
      const rock = rocksAhead(race, from, A.range)[0];
      const enemy = rock ? null : enemiesOf(race, from, 0.5)[0];
      const bite = Math.round((A.bite[0] + race.rng() * (A.bite[1] - A.bite[0])) * (rock ? 1 : 0.5));
      const id = (rock ?? enemy).id;
      hurt(race, from, id, bite, { kind: 'bite', pen: 1 });
      const eaten = rock ? rock.destroyed : enemy.out;
      if (eaten) {
        from.hull = Math.min(from.hullMax, from.hull + Math.round(from.hullMax * A.heal));
        const taken = Math.min(A.fuel, Math.max(0, from.tank - from.fuel));
        from.fuel += taken;
        from.fuelStolen += taken;
      }
      race.fx.push({ type: 'ability', id: 'maw', from: from.id, to: [id], eaten });
    },
  },
};

// Siphon drains the nearest rival still racing; in a boss fight, the boss.
function siphonTarget(race, from) {
  if (from.isPlayer) {
    const nearest = race.trains.find((train) => train.id === race.nearestId);
    if (nearest && live(nearest)) return nearest;
  }
  return enemiesOf(race, from)[0] ?? null;
}

// Why `train` cannot use its ability right now, or null if it can.
export function abilityBlocker(race, train = playerOf(race)) {
  const ab = train.ability;
  const A = ab ? B.ABILITIES[ab.id] : null;
  if (!A || !ABILITY[ab.id]) return 'No ability';
  if (race.status !== 'running' || !live(train)) return 'Not now';
  if (ab.used) return 'Used up';
  if (ab.cd > 0) return `Recharging ${Math.ceil(ab.cd)}s`;
  if (train.frozenFor > 0) return 'Frozen';
  return ABILITY[ab.id].need(race, train, A);
}

// Use a train's signature ability (the player's, unless another train is given).
export function useAbility(race, train = playerOf(race)) {
  if (abilityBlocker(race, train)) return false;
  const ab = train.ability;
  const A = B.ABILITIES[ab.id];
  ABILITY[ab.id].use(race, train, A);
  if (ab.uses !== null) {
    ab.uses -= 1;
    ab.used = ab.uses <= 0;
  }
  ab.cd = A.cooldown ?? 0;
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
    // A strong enough front bursts straight through (and so does a Bulwark, or the Sandshark's jaws).
    if (S.rank <= Math.max(front.smash, train.smash ?? -1) || train.unstoppable > 0) {
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
// The train's Tesla Coil numbers (its best coil, if it has two).
export function teslaOf(train) {
  const keys = (train.arms ?? []).filter((k) => kindOf(k) === 'tesla');
  if (!keys.length) return null;
  return keys.map((k) => armOf(train, k)).sort((a, b) => b.chargePerMile - a.chargePerMile)[0];
}
// Flip the wheel capacitors on or off. Charge stays in the battery pack either way.
export function setCapacitors(race, on) {
  const player = race.trains.find((t) => t.isPlayer);
  if (!player || !(player.voltsMax > 0)) return false;
  player.capacitors = !!on;
  return true;
}
// ---------- Wind Jet ----------
export function setPanels(race, on) {
  const player = race.trains.find((t) => t.isPlayer);
  if (!player || !(player.windMax > 0)) return false;
  player.panels = !!on;
  return true;
}
export function windBlocker(race, train, use) {
  if (!(train.windMax > 0)) return 'No Wind Jet';
  if (race.status !== 'running' || !live(train)) return 'Not now';
  if (train.windCd > 0) return 'Recharging';
  if (train.wind < B.WIND.minUse) return train.panels ? 'Gathering wind' : 'Deploy the panels';
  if (use === 'gust' && !windTargets(race, train).length) return 'No rival in range';
  return null;
}
const windTargets = (race, from) => race.trains.filter((t) => t !== from && live(t) && Math.abs(t.distance - from.distance) <= B.WIND.gustRange);
// Spend the wind: a burst of speed, or a gust that slows every rival in range.
export function useWind(race, use) {
  const from = race.trains.find((t) => t.isPlayer);
  if (!from || windBlocker(race, from, use)) return false;
  const W = B.WIND;
  const fill = from.wind / W.max;
  const seconds = W.base + W.perFill * fill;
  from.wind = 0;
  from.windCd = W.cooldown;
  if (use === 'boost') {
    from.surgeMph = Math.max(from.surgeMph ?? 0, from.vmax * W.boostSpeed);
    from.surgeFor = Math.max(from.surgeFor ?? 0, seconds);
    from.speed += from.surgeMph * 0.5;
    race.fx.push({ type: 'windBoost', id: from.id, seconds });
  } else {
    const hit = windTargets(race, from);
    for (const t of hit) {
      t.windSlow = W.gustSlow;
      t.windSlowFor = Math.max(t.windSlowFor, seconds);
    }
    race.fx.push({ type: 'windGust', id: from.id, to: hit.map((t) => t.id), seconds });
  }
  return true;
}

// The Tesla Coil's damage for this many volts: exponential, so a full pack hits far harder than two halves.
export const teslaDamage = (arm, volts) => arm.damage[0] * (Math.exp(volts / arm.voltScale) - 1);
export const isSpell = (key) => C[kindOf(key)]?.use === 'mp';
const live = (train) => !train.out && !train.finished && !train.hidden;

// What `from` can hit within `range` miles. Rivals fight each other as well as you. For the player,
// obstacles ahead count too once spotted; the aim setting picks between them and rivals.
function targetFor(race, from, range) {
  let rival = null;
  let rivalD = Infinity;
  for (const train of race.trains) {
    if (!foes(from, train) || !live(train)) continue;
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

const resource = (train, use) => (use === 'mp' ? train.mp : use === 'ammo' ? train.ammo : use === 'fuel' ? train.fuel : use === 'heat' ? train.heat : use === 'volts' ? train.volts : train.charge);
// What one shot (one missile) costs this train: missiles cost fuel, half for a Legendary launcher.
const shotCost = (arm) => arm.cost * (arm.use === 'fuel' ? arm.drain ?? 1 : 1);

// Why `from` cannot use `kind` right now, or null if it can.
export function castBlocker(race, from, kind) {
  const arm = C[kindOf(kind)] ? armOf(from, kind) : null;
  if (!arm || !from.arms.includes(kind)) return 'Not fitted';
  const cooler = COOLERS.includes(kindOf(kind));
  if (race.status !== 'running') return 'Nothing to fight';
  if (!race.combat && !cooler) return 'Nothing to fight';
  if (!live(from)) return 'Off the line';
  if (from.frozenFor > 0 && !cooler) return 'Frozen';
  // The guided first run keeps your guns quiet until the weapons lesson.
  if (race.guide && from.isPlayer && !cooler && !['weapons', 'done', 'free'].includes(race.guide.stage)) return 'Hold fire: weapons lesson coming';
  const booting = bootStatus(race, from, kind);
  if (booting) return booting;
  if ((from.cooldown[kind] ?? 0) > 0) return 'Reloading';
  if (cooler && from.heat < 3) return 'Engine is cool';
  if (arm.use === 'heat' && from.heat < 3) return 'Engine is cool';
  if (arm.use === 'volts' && from.volts < (arm.minVolts ?? 1)) return from.capacitors ? 'Charging' : 'Charge the coil';
  if (!(arm.use === 'fuel' && race.guide) && resource(from, arm.use) < shotCost(arm) * (arm.use === 'mp' ? from.mpCostMult ?? 1 : 1)) return arm.use === 'mp' ? 'Not enough MP' : arm.use === 'ammo' ? 'Out of ammo' : arm.use === 'fuel' ? 'Not enough fuel' : 'Battery low';
  if (arm.range && !targetFor(race, from, arm.range)) return 'Nothing in range';
  return null;
}

export function castSpell(race, from, kind) {
  if (castBlocker(race, from, kind)) return false;
  const arm = armOf(from, kind);
  // A missile launcher fires as much of its burst as the fuel allows.
  // The guided first run supplies the propellant: a new conductor can't strand themselves learning to fight.
  const freeFuel = arm.use === 'fuel' && race.guide;
  const burst = arm.burst ? (freeFuel ? arm.burst : Math.max(1, Math.min(arm.burst, Math.floor(resource(from, arm.use) / shotCost(arm))))) : 1;
  if (arm.use === 'mp') from.mp -= arm.cost * (from.mpCostMult ?? 1);
  else if (arm.use === 'fuel' && !freeFuel) {
    // Missile propellant comes out of the tank and is paid for like any fuel burned.
    const gallons = shotCost(arm) * burst;
    from.fuel = Math.max(0, from.fuel - gallons);
    from.fuelUsed += gallons;
    from.fuelFired = (from.fuelFired ?? 0) + gallons;
  }
  else if (arm.use === 'ammo') {
    from.ammo -= arm.cost * burst;
    from.roundsFired += arm.cost * burst;
  } else if (arm.use === 'charge') from.charge -= arm.cost;
  // The Heat Cannon draws off a share of the engine's heat and fires it; the Tesla Coil empties its pack.
  let power = 0;
  if (arm.use === 'heat') {
    power = from.heat * arm.share;
    from.heat = Math.max(0, from.heat - power);
    race.fx.push({ type: 'vented', id: from.id, amount: Math.round(power), by: 'heat' });
  } else if (arm.use === 'volts') {
    power = from.volts;
    from.volts = 0;
  }
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
    const shot = { id: ++race.shotSeq, kind: kindOf(kind), key: kind, from: from.id, to: target.id, left: total + delay, total: total + delay, delay, dragon: kind === 'fire' && from.model === 'dragon', echo, power: echo ? power * 0.5 : power };
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
  // Rebirth (the Iron Phoenix): once a run, it rises again from its own wreck.
  if (train.rebirth > 0 && !train.reborn) {
    train.reborn = true;
    train.hull = Math.round(train.hullMax * train.rebirth);
    train.burn = 0;
    train.poison = 0;
    train.stagger = 0;
    race.fx.push({ type: 'rebirth', id: train.id });
    race.events.push({ at: race.real, text: `${train.isPlayer ? 'Your engine' : train.name} rises from the flames` });
    return;
  }
  train.out = true;
  train.downBy = train.lastHitBy ?? null;
  if (train.isBoss) {
    train.boss.state = 'dead';
    train.boss.windup = null;
    race.fx.push({ type: 'bossDown', id: train.id });
    race.events.push({ at: race.real, text: `${train.name} is destroyed` });
    return;
  }
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
  // The guided first run: once you are told to fight back, your hits land hard and the first one
  // cripples Benchmark's engine.
  const lesson = race.guide && from?.isPlayer && !target.isPlayer && ['weapons', 'done', 'free'].includes(race.guide.stage);
  if (lesson) damage *= B.RACE.testRace.guide.hitDamage;
  if (lesson && !dot && race.guide.stage === 'weapons') {
    race.guide.stage = 'done';
    target.crippled = true;
    target.guidePower = 1;
    race.fx.push({ type: 'guide', id: 'crippled' });
  }
  if (!dot) {
    damage = afterArmor(damage, target.armor ?? 0, pen);
    blocked = target.barrier > 0;
    if (blocked) damage = Math.round(damage * (1 - target.barrierCut));
    if (!(target.unstoppable > 0)) target.stagger = Math.max(target.stagger, blocked ? C.staggerBlocked : kind === 'arc' ? C.staggerBlocked : C.stagger);
  }
  target.hull = Math.max(0, target.hull - damage);
  target.taken += damage;
  // Whoever hit it last gets the credit if it goes down (a burn or poison tick has no sender).
  if (from) target.lastHitBy = from.id;
  if (target.isBoss) breakWindup(race, target, damage);
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
  if (shot.custom) return landCustom(race, shot, from);
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
  if (shot.kind === 'heat') damage += (shot.power ?? 0) * arm.perHeat;
  if (shot.kind === 'tesla') damage = teslaDamage(arm, shot.power ?? 0);
  // Spells grow with the conductor's Intelligence; weapons with Ordnance research.
  if (arm.use === 'mp' && from) damage *= from.spellPower ?? 1;
  else if (from) damage *= from.weaponPower ?? 1;
  if (shot.dragon) damage *= C.dragonFire;
  damage = Math.round(damage);
  const crit = race.rng() < (arm.crit ?? C.crit);
  if (crit) damage = Math.round(damage * (arm.critMult ?? C.critMult));
  if (hurt(race, from, shot.to, damage, { kind: shot.kind, crit, pen: arm.pen ?? 0 })) afflict(race, shot.to, arm.burn ?? 0, arm.poison ?? 0, from);
}

// A shot from an ability or a boss attack: its numbers travel with it.
function landCustom(race, shot, from) {
  const c = shot.custom;
  const target = race.trains.find((train) => train.id === shot.to) ?? null;
  // An aimed attack was laid on the speed the train was making: move the lever and it lands wide.
  if (c.dodge && target && Math.abs(target.lever - c.leverAt) >= B.BOSS.dodgeLever - 1e-9) {
    race.fx.push({ type: 'miss', kind: shot.kind, to: shot.to, dodged: true });
    if (target.isPlayer) race.dodges = (race.dodges ?? 0) + 1;
    return;
  }
  if (race.rng() > (c.accuracy ?? 1)) {
    race.fx.push({ type: 'miss', kind: shot.kind, to: shot.to });
    return;
  }
  let damage = c.damage[0] + race.rng() * (c.damage[1] - c.damage[0]);
  if (c.spell && from) damage *= from.spellPower ?? 1;
  damage = Math.round(damage * (c.mult ?? 1));
  if (!hurt(race, from, shot.to, damage, { kind: shot.kind, pen: c.pen ?? 0 })) return;
  afflict(race, shot.to, c.burn ?? 0, c.poison ?? 0, from);
  if (!target || !live(target)) return;
  if (c.heat) target.heat = Math.min(B.HEAT.max, target.heat + c.heat);
  if (c.slow && !(target.unstoppable > 0)) {
    target.windSlow = c.slow;
    target.windSlowFor = Math.max(target.windSlowFor, c.seconds ?? 3);
  }
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
      const damage = Math.round((c.base + c.amp * c.ticks) * (from?.weaponPower ?? 1));
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
  if (rival.think > 0 || !live(rival) || rival.frozenFor > 0) return;
  // On the guided first run Benchmark holds its fire until the lesson is over.
  if (race.guide && !['done', 'free'].includes(race.guide.stage)) return;
  const alive = race.trains.slice(1).filter(live).length || 1;
  rival.think = (C.ai.think[0] + race.rng() * (C.ai.think[1] - C.ai.think[0])) * Math.sqrt(alive);
  const incoming = race.shots.some((shot) => shot.to === rival.id);
  if (incoming && rival.barrier <= 0 && rival.hull < rival.hullMax * C.ai.barrierBelow && race.rng() < C.ai.barrierChance) {
    if (castSpell(race, rival, 'barrier') || castSpell(race, rival, 'shield')) return;
  }
  // A champion in a legendary machine uses its signature ability when it has something to use it on.
  if (rival.ability && aiWantsAbility(race, rival, incoming) && useAbility(race, rival)) return;
  // Rivals vent heat once it starts to bite.
  if (rival.heat > 65) for (const key of rival.arms) if (COOLERS.includes(kindOf(key)) && castSpell(race, rival, key)) return;
  const attacks = rival.arms.filter((key) => !SHIELDS.includes(kindOf(key)) && !COOLERS.includes(kindOf(key)));
  // Bigger hits first, sometimes.
  attacks.sort((a, b) => (C[kindOf(b)].damage?.[1] ?? 0) - (C[kindOf(a)].damage?.[1] ?? 0));
  if (race.rng() >= C.ai.bigChance) attacks.reverse();
  for (const key of attacks) if (castSpell(race, rival, key)) return;
}

function aiWantsAbility(race, rival, incoming) {
  const A = B.ABILITIES[rival.ability.id];
  if (abilityBlocker(race, rival)) return false;
  const near = enemiesOf(race, rival, A.range ?? 2);
  switch (rival.ability.id) {
    case 'siphon':
      return enemiesOf(race, rival, 2).some((t) => t.distance > rival.distance);
    case 'blackhole':
      return near.some((t) => t.distance > rival.distance - 0.5);
    case 'bulwark':
      return incoming && rival.hull < rival.hullMax * 0.75;
    case 'zero':
      return near.length > 0 && (rival.heat > 50 || race.rng() < 0.5);
    case 'maw':
      return enemiesOf(race, rival, 0.5).length > 0;
    default:
      return near.length > 0;
  }
}

// MP, charge and cooldowns tick in every race, so coolers work even without a fight.
function updateResources(race, h) {
  for (const train of race.trains) {
    train.mp = Math.min(C.mpMax, train.mp + C.mpRegen * train.mpRegen * train.mpRegenMult * h);
    if (train.chargeMax > 0) train.charge = Math.min(train.chargeMax, train.charge + C.chargeRegen * train.chargeRegenMult * h);
    for (const kind of Object.keys(train.cooldown)) train.cooldown[kind] = Math.max(0, train.cooldown[kind] - h);
    train.barrier = Math.max(0, train.barrier - h);
    train.unstoppable = Math.max(0, train.unstoppable - h);
    if (train.ability) {
      train.ability.cd = Math.max(0, train.ability.cd - h);
      train.ability.activeFor = Math.max(0, train.ability.activeFor - h);
    }
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
  for (const rival of race.trains.slice(1)) {
    if (rival.isBoss) bossThink(race, rival, h);
    else think(race, rival, h);
  }
}

// ---------- Bosses ----------

const TAU = Math.PI * 2;
const smooth = (k) => {
  const x = Math.min(1, Math.max(0, k));
  return x * x * (3 - 2 * x);
};
// Where a boss rides: a little ahead of the player's train, weaving in and out.
const stationOffset = (clock) => B.BOSS.offset.base + B.BOSS.offset.swing * Math.sin((clock / B.BOSS.offset.period) * TAU);

function advanceBoss(race, train, h) {
  const b = train.boss;
  const player = playerOf(race);
  const O = B.BOSS.offset;
  const before = train.distance;
  if (train.out) {
    // A wreck falls behind.
    train.speed = Math.max(0, train.speed - R.brakeDecel * 6 * h * B.TIME_SCALE);
    train.distance += (train.speed * h * B.TIME_SCALE) / 3600;
    return;
  }
  b.clock += h;
  if (train.frozenFor > 0) train.frozenFor -= h;
  let offset = O.far;
  if (b.state === 'entering') offset = O.far + (stationOffset(b.clock) - O.far) * smooth(b.t / B.BOSS.enterSeconds);
  else if (b.state === 'fighting') offset = stationOffset(b.clock);
  else if (b.state === 'fled') offset = stationOffset(b.clock) + (b.t / 2) * O.far;
  train.distance = Math.max(0, player.distance + offset);
  train.speed = h > 0 ? Math.max(0, ((train.distance - before) / (h * B.TIME_SCALE)) * 3600) : 0;
  train.vmax = player.vmax;
}

// Delay a boss's next attack and call off the one it is winding up.
function jamBoss(train, seconds) {
  const b = train.boss;
  if (b.windup) {
    b.cd[b.windup.atk.id] = 0;
    b.windup = null;
  }
  b.next = Math.max(b.next, seconds);
}

// Enough damage during the warning breaks a charged attack and leaves the boss reeling.
function breakWindup(race, train, damage) {
  const b = train.boss;
  const w = b.windup;
  if (!w || !w.atk.break) return;
  w.dealt += damage;
  if (w.dealt < w.atk.break * train.hullMax) return;
  b.windup = null;
  b.reel = B.BOSS.breakStagger;
  b.broken = (b.broken ?? 0) + 1;
  race.fx.push({ type: 'bossBreak', id: train.id, attack: w.atk.id, name: w.atk.name });
  race.events.push({ at: race.real, text: `${w.atk.name} broken` });
}

// The boss's turn: wait, warn, strike. Each attack has its own cooldown; below 30% HP a boss is
// enraged and everything comes faster and harder.
function bossThink(race, train, h) {
  const b = train.boss;
  const def = b.def;
  const player = playerOf(race);
  if (train.out || race.status !== 'running') return;
  if (b.state === 'waiting') {
    if (player.distance >= (def.enterAt ?? B.BOSS.enterAt)) {
      b.state = 'entering';
      b.t = 0;
      train.hidden = false;
      race.fx.push({ type: 'bossEnter', id: train.id, boss: def.id });
      race.events.push({ at: race.real, text: `${def.name} is on the line` });
    }
    return;
  }
  if (b.state === 'entering') {
    b.t += h;
    if (b.t >= B.BOSS.enterSeconds) {
      b.state = 'fighting';
      b.next = B.BOSS.opening;
    }
    return;
  }
  if (b.state === 'fled') {
    b.t += h;
    return;
  }
  if (b.state !== 'fighting') return;
  b.fought += h;
  b.left -= h;
  if (b.left <= 0) {
    b.state = 'fled';
    b.t = 0;
    b.windup = null;
    train.hidden = true;
    race.fx.push({ type: 'bossFled', id: train.id });
    race.events.push({ at: race.real, text: `${def.name} breaks off and escapes` });
    return;
  }
  const E = B.BOSS.enrage;
  if (!b.enraged && train.hull <= train.hullMax * E.at) {
    b.enraged = true;
    race.fx.push({ type: 'bossEnrage', id: train.id });
    race.events.push({ at: race.real, text: `${def.name} is enraged` });
  }
  for (const id of Object.keys(b.cd)) b.cd[id] = Math.max(0, b.cd[id] - h);
  if (train.frozenFor > 0) return;
  if (b.reel > 0) {
    b.reel -= h;
    return;
  }
  if (b.windup) {
    b.windup.left -= h;
    if (b.windup.left <= 0) {
      const { atk, leverAt } = b.windup;
      b.windup = null;
      bossStrike(race, train, atk, leverAt);
      const [lo, hi] = def.gap ?? B.BOSS.gap;
      b.next = (lo + race.rng() * (hi - lo)) * (b.enraged ? E.gap : 1);
    }
    return;
  }
  b.next -= h;
  if (b.next > 0) return;
  const share = train.hull / train.hullMax;
  const ready = def.attacks.filter((atk) => !(b.cd[atk.id] > 0) && (atk.below === undefined || share <= atk.below));
  if (!ready.length) {
    b.next = 0.5;
    return;
  }
  const atk = weightedPick(race.rng, ready, (item) => item.weight ?? 1);
  b.cd[atk.id] = atk.cooldown;
  const telegraph = atk.telegraph * (b.enraged ? E.telegraph : 1);
  b.windup = { atk, left: telegraph, total: telegraph, dealt: 0, leverAt: player.lever };
  race.fx.push({ type: 'bossWarn', id: train.id, attack: atk.id, name: atk.name, seconds: telegraph });
}

// One boss attack going off. `leverAt` is where the player's lever stood when the warning began.
function bossStrike(race, train, atk, leverAt) {
  const b = train.boss;
  const player = playerOf(race);
  const mult = b.enraged ? B.BOSS.enrage.damage : 1;
  b.attacks = (b.attacks ?? 0) + 1;
  if (atk.type === 'drop') {
    // Something lands on the line ahead: shoot it, crush it, or hit it.
    const H = B.HAZARD;
    const S = H.sizes[atk.size] ?? H.sizes.boulder;
    for (let i = 0; i < (atk.count ?? 1); i++) {
      const at = Math.round((player.distance + atk.ahead[0] + race.rng() * (atk.ahead[1] - atk.ahead[0]) + i * 0.5) * 100) / 100;
      if (at >= race.distance - 0.3) continue;
      const hp = Math.round(S.hp[0] + race.rng() * (S.hp[1] - S.hp[0]));
      const rock = { id: `rock-d${++race.shotSeq}`, at, size: atk.size ?? 'boulder', label: atk.label ?? null, hp, hpMax: hp, armor: 0, destroyed: false, struck: false, seen: true, big: false, dropped: true, burn: 0, burnT: 0, poison: 0, poisonT: 0 };
      race.obstacles.push(rock);
      race.obstacles.sort((x, y) => x.at - y.at);
      race.fx.push({ type: 'drop', id: rock.id, from: train.id, look: atk.look ?? 'rock' });
    }
    return;
  }
  if (atk.type === 'guard') {
    train.barrier = atk.seconds;
    train.barrierCut = atk.cut;
    race.fx.push({ type: 'barrier', id: train.id, kind: 'boss' });
    return;
  }
  // Everything else is thrown at the player's train.
  const hits = atk.hits ?? 1;
  for (let i = 0; i < hits; i++) {
    customShot(race, train, player.id, atk.look ?? 'cannon', atk.travel ?? 0.55, { damage: atk.damage, mult, accuracy: atk.accuracy ?? 1, pen: atk.pen ?? 0, burn: atk.burn ?? 0, poison: atk.poison ?? 0, heat: atk.heat ?? 0, slow: atk.slow ?? 0, seconds: atk.seconds ?? 0, dodge: !!atk.dodge, leverAt, boss: atk.id }, i * (atk.spread ?? 0.22));
  }
}

// The guided first run, in stages:
//   launch  Benchmark's better locomotive pulls away off the line;
//   bend    at the first bend, pause and explain bends, Agility and acceleration;
//   chase   after the bend Benchmark opens up and pulls ahead;
//   weapons once it leads by a little, pause and tell the player to fight back;
//   done    the first hit crippled it (see hurt);
//   free    once you have pulled clear, a last pause shows off the cameras.
function updateGuide(race) {
  const G = B.RACE.testRace.guide;
  const guide = race.guide;
  const player = playerOf(race);
  const bench = race.trains[1];
  if (!bench) return;
  const ask = (id) => {
    if (guide.seen.includes(id)) return;
    guide.seen.push(id);
    guide.prompt = id;
  };
  const bendStart = guide.bend && guide.bend.start < 12 ? guide.bend.start : G.fallbackBendMile;
  const bendEnd = guide.bend && guide.bend.start < 12 ? guide.bend.end : G.fallbackBendMile + 0.5;
  const lead = bench.distance - player.distance;
  if (guide.stage === 'launch') {
    // A stronger locomotive gets away first, but only by a little.
    // The further behind it is, the harder it pushes, so it leads at the first bend whoever drives.
    bench.guidePower = lead < G.launchLead ? Math.min(G.maxPower, G.launchPower + (G.launchLead - lead) * 3) : 1;
    if (player.distance >= bendStart - 0.03) {
      guide.stage = 'bend';
      ask('bend');
    }
  } else if (guide.stage === 'bend') {
    bench.guidePower = 1;
    if (player.distance >= Math.min(bendEnd, bendStart + G.bendMiles)) guide.stage = 'chase';
  } else if (guide.stage === 'chase') {
    bench.guidePower = Math.min(G.maxPower, G.surgePower + Math.max(0, G.surgeLead - lead) * 2);
    if (lead >= G.surgeLead) {
      guide.stage = 'weapons';
      ask('weapons');
    }
  } else if (guide.stage === 'weapons') {
    // Hold the lead, never run out of reach of the guns.
    bench.guidePower = lead > G.surgeLead * 2 ? 1 : G.holdPower;
  } else if (guide.stage === 'done') {
    // Once you have pulled clear of the crippled Benchmark, a last lesson: the cameras.
    guide.doneAt = guide.doneAt ?? race.real;
    if (race.real - guide.doneAt >= G.cameraAfter && lead <= -G.cameraLead) {
      guide.stage = 'free';
      ask('camera');
    }
  }
}

// The screen calls this when the player has read a guided prompt.
export function clearPrompt(race) {
  if (race.guide) race.guide.prompt = null;
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
  const rivals = rivalsOf(race);
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
    .filter((train) => !train.isBoss)
    .map((train) => ({
      id: train.id,
      name: train.name,
      locoName: train.locoName,
      isPlayer: train.isPlayer,
      champion: train.champion,
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
    field: rivals.length + 1,
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
    fuelStolen: player.fuelStolen ?? 0,
    emergencyGallons: race.emergencyGallons,
    emergencyCost: race.emergencyCost,
    combat: race.combat,
    damageDealt: player.dealt,
    damageTaken: player.taken,
    derailed: player.out,
    rivalsDerailed: rivals.filter((rival) => rival.out).length,
    kills: rivals.filter((rival) => rival.out && rival.downBy === player.id).length, // the ones the player put off the rails
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
    reborn: !!player.reborn,
    dodges: race.dodges ?? 0,
    // The boss fight, if there was one: slain, or how much of it was left standing.
    boss: race.boss
      ? { id: race.boss.boss.id, name: race.boss.name, slain: race.boss.out, hull: Math.ceil(race.boss.hull), hullMax: race.boss.hullMax, seconds: race.boss.boss.fought, broken: race.boss.boss.broken ?? 0, met: race.boss.boss.state !== 'waiting' }
      : null,
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
