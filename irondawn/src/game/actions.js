// Every change to a save goes through one of these. A screen or the simulation calls
// act('buy', {...}); the store copies the save, runs the action here and keeps the result.
// An action that a rule refuses throws GameError; its message is shown to the player.

import { B, clamp, mulberry } from './balance.js';
import { ATTR_MAX } from './attributes.js';
import { addWeapon, addXp, applyPractice, applySpec, deriveStats, pointCost, weaponByUid, totalAttrs } from './character.js';
import { ATTACHMENTS, GEAR, GEAR_SLOTS, ITEMS, WEAPONS, WEAPON_CLASSES, attachmentFits, slotKind } from './items.js';
import { RANKS, promotionDue } from './ranks.js';
import { specOf } from './specializations.js';
import { EVENTS, gradeFor, trainingBonuses, trainingSummary } from './training.js';
import { ROSTER_MAX, makeSoldier, memberAddXp, recruitCost, recruitOffers, squadCap } from './squad.js';
import { missionById, missionLock, missionRewards, planCost, planFor } from './missions.js';
import { awardMedals } from './medals.js';
import { locationOf } from './world.js';

export class GameError extends Error {}

const logEntry = (save, text, now) => {
  save.log.push({ at: now ?? Date.now(), day: save.world.day, text });
  if (save.log.length > 80) save.log.splice(0, save.log.length - 80);
};

// ---------- intake and training ----------
export function chooseSpec(save, { spec, now }) {
  if (save.spec) throw new GameError('Your specialization is already on file.');
  const def = specOf(spec);
  if (!def) throw new GameError('No such specialization.');
  applySpec(save, spec);
  logEntry(save, `Reported to Camp Hawthorne. Specialization: ${def.name}.`, now);
  return { spec: def };
}

// Records a training evaluation. Before graduation the best score sets the baseline attributes;
// afterwards a course is a refresher worth practice.
export function finishTraining(save, { event, result, now }) {
  const def = EVENTS.find((e) => e.id === event);
  if (!def) throw new GameError('No such evaluation.');
  if (!save.spec) throw new GameError('Report to the intake tent first.');
  const score = clamp(Math.round(result.score), 0, 100);
  const grade = gradeFor(score);
  if (save.training.graduated) {
    const gains = Object.fromEntries(def.sets.map((attr) => [attr, (B.TRAINING.REFRESHER_PRACTICE * score) / 100 / Math.sqrt(def.sets.length)]));
    const ups = applyPractice(save, gains);
    const best = Math.max(score, save.records[event] ?? 0);
    const record = score > (save.records[event] ?? 0);
    save.records[event] = best;
    return { refresher: true, score, grade, ups, record, bonuses: {} };
  }
  const before = save.training.results[event] ?? null;
  const bonuses = trainingBonuses(event, result);
  if (before && before.score >= score) return { score, grade, kept: true, best: before.score, bonuses: before.bonuses, first: false };
  for (const [attr, n] of Object.entries(before?.bonuses ?? {})) save.attrs[attr] = clamp(save.attrs[attr] - n, 1, ATTR_MAX);
  for (const [attr, n] of Object.entries(bonuses)) save.attrs[attr] = clamp(save.attrs[attr] + n, 1, ATTR_MAX);
  save.training.results[event] = { score, grade, bonuses };
  save.records[event] = score;
  if (!before) logEntry(save, `${def.name}: ${score} (${grade}).`, now);
  return { score, grade, bonuses, first: !before, improved: !!before, summary: trainingSummary(save) };
}

export function graduate(save, { now }) {
  const summary = trainingSummary(save);
  if (save.training.graduated) throw new GameError('You have already graduated.');
  if (!summary.complete) throw new GameError('Finish all five evaluations first.');
  save.training.graduated = true;
  save.training.honors = summary.honors;
  save.story.flags.graduated = true;
  save.phase = 'service';
  save.rank = 1;
  const rp = B.TRAINING.GRAD_RP.base + (summary.honors ? B.TRAINING.GRAD_RP.honors : 0);
  save.rp += rp;
  const medals = awardMedals(save);
  logEntry(save, `Graduated from basic training${summary.honors ? ' as Honor Graduate' : ''}. Promoted to Private.`, now);
  return { ...summary, rp, medals };
}

// ---------- growth ----------
export function spendPoint(save, { attr }) {
  if (!(attr in save.attrs)) throw new GameError('No such attribute.');
  const value = save.attrs[attr];
  if (value >= ATTR_MAX) throw new GameError('That attribute is at its limit.');
  const cost = pointCost(value);
  if (save.points < cost) throw new GameError(cost > 1 ? `That costs ${cost} points at this level.` : 'No attribute points to spend.');
  save.points -= cost;
  save.attrs[attr] = value + 1;
  return { attr, value: value + 1, cost };
}

export function practice(save, { gains }) {
  return { ups: applyPractice(save, gains) };
}

export function gainXp(save, { amount, raw = false }) {
  const report = addXp(save, amount, { raw });
  return { ...report, due: promotionDue(save) };
}

export function promote(save, { now }) {
  const due = promotionDue(save);
  if (due === null) throw new GameError('No promotion is due.');
  const from = save.rank;
  save.rank = due;
  const bonus = 150 * (due - from) * Math.max(1, due - 1);
  save.rp += bonus;
  let recruit = null;
  // A new Corporal is given a first soldier to lead.
  if (squadCap(save) > 0 && save.squad.roster.length === 0) {
    recruit = makeSoldier(mulberry(save.squad.seed + 17), { role: 'rifleman', level: Math.max(1, Math.round(save.level * 0.6)) });
    save.squad.roster.push(recruit);
    save.squad.active.push(recruit.id);
  }
  logEntry(save, `Promoted to ${RANKS[due].name}.`, now);
  return { from, to: due, rank: RANKS[due], bonus, recruit };
}

// ---------- the quartermaster ----------
const DEFS = { weapon: WEAPONS, attachment: ATTACHMENTS, gear: GEAR, item: ITEMS };

export function priceOf(save, kind, id, derived = deriveStats(save)) {
  const def = DEFS[kind]?.[id];
  return def ? Math.max(0, Math.round(def.price * derived.priceMul)) : 0;
}
export function sellValue(save, kind, id, derived = deriveStats(save)) {
  const def = DEFS[kind]?.[id];
  return def ? Math.round(def.price * derived.sellMul) : 0;
}

const ownsWeapon = (save, id) => save.weapons.some((w) => w.id === id);
const mountedCount = (save, id) => save.weapons.reduce((n, w) => n + Object.values(w.att ?? {}).filter((a) => a === id).length, 0);

// What the quartermaster shows for one shelf: every item, its price, and why it cannot be bought.
export function shopList(save, kind) {
  const derived = deriveStats(save);
  return Object.values(DEFS[kind] ?? {})
    .filter((def) => def.price > 0 || kind === 'item')
    .map((def) => {
      const price = priceOf(save, kind, def.id, derived);
      let owned = 0;
      if (kind === 'weapon') owned = ownsWeapon(save, def.id) ? 1 : 0;
      else if (kind === 'attachment') owned = (save.attachments[def.id] ?? 0) + mountedCount(save, def.id);
      else if (kind === 'gear') owned = save.gearOwned.includes(def.id) ? 1 : 0;
      else owned = save.items[def.id] ?? 0;
      let locked = null;
      if (save.rank < def.rank) locked = `Requires ${RANKS[def.rank].name}`;
      else if ((kind === 'weapon' || kind === 'gear') && owned) locked = 'Owned';
      else if (kind === 'item' && owned >= derived.carryLimits[def.id]) locked = 'Carrying all you can';
      else if (save.rp < price) locked = 'Not enough RP';
      return { def, kind, price, owned, locked, rankLocked: save.rank < def.rank };
    })
    .sort((a, b) => a.def.rank - b.def.rank || a.def.price - b.def.price);
}

export function buy(save, { kind, id }) {
  const def = DEFS[kind]?.[id];
  if (!def) throw new GameError('The quartermaster does not stock that.');
  if (save.phase !== 'service') throw new GameError('Recruits use what they are issued.');
  if (save.rank < def.rank) throw new GameError(`That is held for the rank of ${RANKS[def.rank].name} and above.`);
  const derived = deriveStats(save);
  const price = priceOf(save, kind, id, derived);
  if (save.rp < price) throw new GameError('Not enough requisition points.');
  if (kind === 'weapon') {
    if (ownsWeapon(save, id)) throw new GameError('You already own one.');
    addWeapon(save, id, {});
  } else if (kind === 'attachment') {
    save.attachments[id] = (save.attachments[id] ?? 0) + 1;
  } else if (kind === 'gear') {
    if (save.gearOwned.includes(id)) throw new GameError('You already own one.');
    save.gearOwned.push(id);
  } else {
    if ((save.items[id] ?? 0) >= derived.carryLimits[id]) throw new GameError('You cannot carry any more of those.');
    save.items[id] = (save.items[id] ?? 0) + 1;
  }
  save.rp -= price;
  return { def, price };
}

export function sell(save, { kind, id, uid }) {
  const derived = deriveStats(save);
  if (kind === 'weapon') {
    const instance = weaponByUid(save, uid);
    if (!instance) throw new GameError('You do not own that.');
    if (save.loadout.primary === uid || save.loadout.secondary === uid) throw new GameError('Put it down before you sell it: it is in your loadout.');
    for (const att of Object.values(instance.att ?? {})) if (att) save.attachments[att] = (save.attachments[att] ?? 0) + 1;
    save.weapons = save.weapons.filter((w) => w.uid !== uid);
    const value = sellValue(save, 'weapon', instance.id, derived);
    save.rp += value;
    return { value };
  }
  if (kind === 'attachment') {
    if (!(save.attachments[id] > 0)) throw new GameError('You have no spare one to sell.');
    save.attachments[id] -= 1;
    const value = sellValue(save, 'attachment', id, derived);
    save.rp += value;
    return { value };
  }
  if (kind === 'gear') {
    if (!save.gearOwned.includes(id)) throw new GameError('You do not own that.');
    if (Object.values(save.loadout.gear).includes(id)) throw new GameError('Take it off before you sell it.');
    if (!(GEAR[id].price > 0)) throw new GameError('The quartermaster will not take that back.');
    save.gearOwned = save.gearOwned.filter((g) => g !== id);
    const value = sellValue(save, 'gear', id, derived);
    save.rp += value;
    return { value };
  }
  throw new GameError('The quartermaster does not buy those.');
}

// ---------- loadout ----------
export function equipWeapon(save, { slot, uid }) {
  const instance = weaponByUid(save, uid);
  if (!instance) throw new GameError('You do not own that weapon.');
  if (slot !== 'primary' && slot !== 'secondary') throw new GameError('No such slot.');
  if (WEAPON_CLASSES[WEAPONS[instance.id].class].slot !== slot) throw new GameError(slot === 'primary' ? 'A sidearm goes in the secondary slot.' : 'Only a sidearm fits the secondary slot.');
  save.loadout[slot] = uid;
  return { slot, uid };
}

export function equipGear(save, { slot, id }) {
  if (!(slot in GEAR_SLOTS)) throw new GameError('No such slot.');
  if (id === null || id === undefined) {
    if (slot === 'uniform' || slot === 'boots') throw new GameError('Regulations: you wear a uniform and boots.');
    save.loadout.gear[slot] = null;
    return { slot, id: null };
  }
  const def = GEAR[id];
  if (!def || !save.gearOwned.includes(id)) throw new GameError('You do not own that.');
  if (def.kind !== slotKind(slot)) throw new GameError('That does not go there.');
  if (def.kind === 'device') {
    const other = slot === 'deviceA' ? 'deviceB' : 'deviceA';
    if (save.loadout.gear[other] === id) save.loadout.gear[other] = save.loadout.gear[slot];
  }
  save.loadout.gear[slot] = id;
  return { slot, id };
}

export function attach(save, { uid, attachment }) {
  const instance = weaponByUid(save, uid);
  const def = ATTACHMENTS[attachment];
  if (!instance || !def) throw new GameError('Nothing to fit.');
  if (!(save.attachments[attachment] > 0)) throw new GameError('You have no spare one. Buy it from the quartermaster.');
  if (!attachmentFits(attachment, instance.id)) throw new GameError(`That does not fit the ${WEAPONS[instance.id].name}.`);
  const old = instance.att[def.slot];
  if (old) save.attachments[old] = (save.attachments[old] ?? 0) + 1;
  instance.att[def.slot] = attachment;
  save.attachments[attachment] -= 1;
  return { slot: def.slot };
}

export function detach(save, { uid, slot }) {
  const instance = weaponByUid(save, uid);
  const old = instance?.att?.[slot];
  if (!old) throw new GameError('Nothing fitted there.');
  save.attachments[old] = (save.attachments[old] ?? 0) + 1;
  instance.att[slot] = null;
  return { slot };
}

// ---------- squad ----------
export function recruit(save, { id }) {
  if (squadCap(save) < 1) throw new GameError('You need a Corporal’s stripes before you lead anyone.');
  if (save.squad.roster.length >= ROSTER_MAX) throw new GameError('The roster is full. Release someone first.');
  const offer = recruitOffers(save).find((m) => m.id === id);
  if (!offer) throw new GameError('That soldier has been posted elsewhere.');
  if (save.squad.roster.some((m) => m.id === id)) throw new GameError('Already on your roster.');
  const cost = recruitCost(offer, deriveStats(save).priceMul);
  if (save.rp < cost) throw new GameError('Not enough requisition points.');
  save.rp -= cost;
  save.squad.roster.push(offer);
  if (save.squad.active.length < squadCap(save)) save.squad.active.push(offer.id);
  return { member: offer, cost };
}

export function dismiss(save, { id }) {
  if (!save.squad.roster.some((m) => m.id === id)) throw new GameError('Not on your roster.');
  save.squad.roster = save.squad.roster.filter((m) => m.id !== id);
  save.squad.active = save.squad.active.filter((m) => m !== id);
  return {};
}

export function setActive(save, { id, active }) {
  const member = save.squad.roster.find((m) => m.id === id);
  if (!member) throw new GameError('Not on your roster.');
  const list = save.squad.active.filter((m) => m !== id);
  if (active) {
    if (member.status !== 'ready') throw new GameError(`${member.name} is on the wounded list.`);
    if (list.length >= squadCap(save)) throw new GameError(`A ${RANKS[save.rank].name} leads ${squadCap(save)} at most.`);
    list.push(id);
  }
  save.squad.active = list;
  return { active: list };
}

// ---------- missions ----------
// Tops consumables up to the specialization's issue, free, before a deployment.
export function issueKit(save) {
  const kit = specOf(save.spec)?.kit.items ?? {};
  for (const [id, n] of Object.entries(kit)) if ((save.items[id] ?? 0) < n) save.items[id] = n;
}

export function startMission(save, { missionId, plan = [] }) {
  const mission = missionById(save, missionId);
  if (!mission) throw new GameError('That operation is no longer on the board.');
  const lock = missionLock(save, mission);
  if (lock) throw new GameError(lock);
  const derived = deriveStats(save);
  const table = planFor(mission, derived);
  const ids = [...new Set(plan)].filter((id) => table.options.some((o) => o.id === id));
  if (planCost(ids) > table.points) throw new GameError('That plan needs more plan points than you have.');
  issueKit(save);
  return { mission, plan: ids };
}

// Applies everything a finished mission changes. stats is the simulation's report (see gradeMission).
export function settleMission(save, { missionId, stats, now }) {
  const mission = missionById(save, missionId);
  if (!mission) throw new GameError('That operation is no longer on the board.');
  const derived = deriveStats(save);
  const rewards = missionRewards(mission, stats, save, derived);
  const before = { level: save.level, rank: save.rank };

  // Consumables left, capped at what can be carried.
  if (stats.items) {
    const next = {};
    for (const id of Object.keys(ITEMS)) {
      const n = clamp(Math.floor(stats.items[id] ?? 0), 0, derived.carryLimits[id]);
      if (n > 0) next[id] = n;
    }
    save.items = next;
  }

  const s = save.stats;
  s.kills += stats.kills ?? 0;
  s.headshots += stats.headshots ?? 0;
  s.stealthKills += stats.stealthKills ?? 0;
  s.shots += stats.shots ?? 0;
  s.hits += stats.hits ?? 0;
  s.downs += stats.downs ?? 0;
  s.squadKills += stats.squadKills ?? 0;
  s.longestShot = Math.max(s.longestShot, Math.round(stats.longestShot ?? 0));
  s.playSeconds += Math.round(stats.time ?? 0);

  let xp;
  const unlocked = [];
  if (rewards.success) {
    xp = addXp(save, rewards.xp + rewards.bonusXp + rewards.killXp);
    save.rp += rewards.rp + rewards.salary;
    s.missions += 1;
    s.rescued += stats.rescued ?? 0;
    s.captured += stats.captured ?? 0;
    if (mission.contract) save.contracts.done += 1;
    else if (!save.story.done.includes(mission.id)) {
      save.story.done.push(mission.id);
      if (mission.grants) save.story.flags[mission.grants] = true;
      if (mission.liberates) {
        save.world.liberated[mission.liberates] = true;
        save.world.discovered[mission.liberates] = true;
        unlocked.push(`${locationOf(mission.liberates).name} is now in friendly hands. You can fly there from any flight line.`);
      }
    }
    save.world.discovered[mission.site] = true;
    logEntry(save, `${mission.name}: complete (grade ${rewards.grade.grade}).`, now);
  } else {
    xp = addXp(save, rewards.xp);
    save.rp = Math.max(0, save.rp - rewards.bill);
    s.failed += 1;
    logEntry(save, `${mission.name}: failed.`, now);
  }

  // The squad: experience for those who went, a spell on the wounded list for those who fell.
  const squad = [];
  for (const member of save.squad.roster) {
    const report = stats.squad?.[member.id];
    if (report) {
      member.missions += 1;
      member.kills += report.kills ?? 0;
      const levels = memberAddXp(member, (rewards.success ? mission.xp * 0.35 : 0) + (report.kills ?? 0) * 25);
      if (report.down) {
        member.status = 'wounded';
        member.out = B.SQUAD.WOUND_MISSIONS;
        save.squad.active = save.squad.active.filter((id) => id !== member.id);
      }
      squad.push({ id: member.id, name: member.name, levels, level: member.level, down: !!report.down, kills: report.kills ?? 0 });
    } else if (member.status === 'wounded') {
      member.out -= 1;
      if (member.out <= 0) {
        member.status = 'ready';
        member.out = 0;
        unlocked.push(`${member.name} is fit for duty again.`);
      }
    }
  }

  // The clock: the operation itself plus the flight home.
  advanceClock(save, (stats.time ?? 0) / 3600 + 1.5);

  const medals = awardMedals(save);
  const due = promotionDue(save);
  return {
    mission: { id: mission.id, name: mission.name, type: mission.type, contract: !!mission.contract },
    success: rewards.success,
    rewards,
    xp: xp.gained,
    levels: save.level - before.level,
    points: (save.level - before.level) * B.ATTR.POINTS_PER_LEVEL,
    level: save.level,
    due,
    dueRank: due !== null ? RANKS[due] : null,
    squad,
    medals,
    unlocked,
  };
}

// ---------- the world ----------
function advanceClock(save, hours) {
  let hour = save.world.hour + hours;
  while (hour >= 24) {
    hour -= 24;
    save.world.day += 1;
  }
  save.world.hour = hour;
}

export function setClock(save, { hour, day }) {
  if (Number.isFinite(hour)) save.world.hour = ((hour % 24) + 24) % 24;
  if (Number.isFinite(day)) save.world.day = Math.max(save.world.day, Math.floor(day));
  return {};
}

export function rest(save, { until }) {
  // until: an hour of the day (0..24). Sleeps to the next time the clock reads it.
  const target = ((until % 24) + 24) % 24;
  let hours = target - save.world.hour;
  if (hours <= 0.05) hours += 24;
  advanceClock(save, hours);
  return { hours };
}

export function syncItems(save, { items }) {
  const limits = deriveStats(save).carryLimits;
  const next = {};
  for (const id of Object.keys(ITEMS)) {
    const n = clamp(Math.floor(items?.[id] ?? 0), 0, limits[id]);
    if (n > 0) next[id] = n;
  }
  save.items = next;
  return {};
}

export function discover(save, { id }) {
  if (!locationOf(id) || save.world.discovered[id]) return { fresh: false };
  save.world.discovered[id] = true;
  const xp = addXp(save, 40);
  return { fresh: true, name: locationOf(id).name, xp: xp.gained };
}

// A supply cache found in the field. tier scales what is in it; the roll is fixed per cache.
export function lootCache(save, { id, tier = 1 }) {
  if (save.world.looted[id]) throw new GameError('Already emptied.');
  save.world.looted[id] = true;
  const rng = mulberry((save.contracts.seed ^ (String(id).length * 2654435761)) + [...String(id)].reduce((n, c) => n + c.charCodeAt(0), 0));
  const [lo, hi] = B.ECON.CACHE_RP;
  const rp = Math.round((lo + rng() * (hi - lo)) * (1 + (tier - 1) * 0.35));
  save.rp += rp;
  const limits = deriveStats(save).carryLimits;
  const items = {};
  const pool = ['bandage', 'medkit', 'frag', 'smoke', 'flash', 'stim', 'mine'];
  for (let i = 0; i < 2; i++) {
    const item = pool[Math.floor(rng() * pool.length)];
    if ((save.items[item] ?? 0) < limits[item]) {
      save.items[item] = (save.items[item] ?? 0) + 1;
      items[item] = (items[item] ?? 0) + 1;
    }
  }
  // A higher-tier cache sometimes holds an attachment.
  let attachment = null;
  if (rng() < 0.18 + tier * 0.04) {
    const options = Object.values(ATTACHMENTS).filter((a) => a.tier <= Math.ceil(tier / 2) + 1);
    attachment = options[Math.floor(rng() * options.length)];
    save.attachments[attachment.id] = (save.attachments[attachment.id] ?? 0) + 1;
  }
  const ups = applyPractice(save, { perception: 4 });
  return { rp, items, attachment, ups };
}

// Clearing a Legion garrison outside a mission.
export function clearSite(save, { id }) {
  const loc = locationOf(id);
  if (!loc) throw new GameError('No such place.');
  const tier = loc.tier ?? 1;
  save.world.cleared[id] = save.world.day * 24 + save.world.hour;
  save.world.discovered[id] = true;
  const xp = addXp(save, B.ECON.LIBERATE.xp * tier);
  const rp = Math.round(B.ECON.LIBERATE.rp * tier * deriveStats(save).payMul);
  save.rp += rp;
  logEntry(save, `Cleared the garrison at ${loc.name}.`);
  return { name: loc.name, xp: xp.gained, rp, due: promotionDue(save) };
}

export const siteCleared = (save, id) => {
  const at = save.world.cleared?.[id];
  return at !== undefined && save.world.day * 24 + save.world.hour - at < B.WORLD.GARRISON_RESPAWN_HOURS;
};

// ---------- story bookkeeping ----------
export function setFlag(save, { flag, value = true }) {
  save.story.flags[flag] = value;
  return {};
}
export function markSeen(save, { id }) {
  save.story.seen[id] = true;
  return {};
}
export function addStats(save, { stats }) {
  for (const [key, value] of Object.entries(stats ?? {})) {
    if (key === 'longestShot') save.stats.longestShot = Math.max(save.stats.longestShot, Math.round(value));
    else if (typeof save.stats[key] === 'number') save.stats[key] += value;
  }
  const medals = awardMedals(save);
  return { medals };
}
export function heal() {
  return {}; // health lives in the simulation; the surgeon's visit is free
}

// Passes a dialog check? (Shown in the dialog and used by the simulation.)
export const attrsOf = (save) => totalAttrs(save);
