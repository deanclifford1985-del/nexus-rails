import { B } from './balance.js';
import { CITIES, licenceLevel, lineById } from './routemap.js';

// The bounty board: which bosses are posted, what they pay, and what their relics build.
// The fight itself is in race.js; the numbers are in balance.js (B.BOSS and B.BOSSES).

export const BOSS_IDS = Object.keys(B.BOSSES);
export const bossById = (id) => (B.BOSSES[id] ? { id, ...B.BOSSES[id] } : null);

// What this conductor has done to a boss: { kills, best (seconds of the fastest kill), slainAt }.
// `slainAt` is the real time (ms) of the last kill.
export const bossRecord = (conductor, id) => conductor.bounties?.[id] ?? { kills: 0, best: null, slainAt: null };

const RESPAWN_MS = () => B.BOSS.respawnHours * 3600000;

/**
 * Real milliseconds until a slain boss is back on its line; 0 when it is there. Measured on the
 * real clock: `at` is the real time to ask about, by default the last moment the save saw
 * (`lastSeen`, which the store keeps current while the game is open).
 */
export function bossBackIn(conductor, id, at = conductor.lastSeen) {
  const slainAt = bossRecord(conductor, id).slainAt;
  if (!slainAt || !(at >= 0)) return 0;
  return Math.min(RESPAWN_MS(), Math.max(0, slainAt + RESPAWN_MS() - at));
}

// The real-time window in which a boss is off its line after its last kill: [from, to] in ms, or null.
export function bossAway(conductor, id) {
  const slainAt = bossRecord(conductor, id).slainAt;
  return slainAt ? [slainAt, slainAt + RESPAWN_MS()] : null;
}

export const hasRelic = (conductor, id) => !!conductor.relics?.[id];
export const relicCount = (conductor) => Object.keys(conductor.relics ?? {}).length;
export const bossKills = (conductor) => Object.values(conductor.bounties ?? {}).reduce((sum, record) => sum + (record.kills ?? 0), 0);

/**
 * Where a boss stands for this conductor:
 *   { state: 'locked', why }   the bounty is not posted yet
 *   { state: 'open' }          it is on its line: go and get it
 *   { state: 'slain', backIn } brought down; it returns in `backIn` real milliseconds
 */
export function bossState(conductor, id) {
  const boss = B.BOSSES[id];
  const record = bossRecord(conductor, id);
  if (!boss) return { state: 'locked', why: 'Unknown boss', record };
  const backIn = bossBackIn(conductor, id);
  if (backIn > 0) return { state: 'slain', backIn, record };
  if (licenceLevel(conductor) < boss.licence) return { state: 'locked', why: `Needs the ${B.LICENCES[boss.licence].name}`, record };
  const before = BOSS_IDS[BOSS_IDS.indexOf(id) - 1];
  if (before && !(bossRecord(conductor, before).kills > 0)) return { state: 'locked', why: `Bring down ${B.BOSSES[before].name} first`, record };
  return { state: 'open', record };
}

// A boss that is on its line (not lately brought down) raids the freight that runs there.
export const bossAtLarge = (conductor, id) => bossState(conductor, id).state !== 'slain';
export const raiderOn = (conductor, lineId) => BOSS_IDS.find((id) => B.BOSSES[id].line === lineId && bossAtLarge(conductor, id)) ?? null;
// The boss whose line this is, at large or not.
export const bossOfLine = (lineId) => BOSS_IDS.find((id) => B.BOSSES[id].line === lineId) ?? null;

// The bounty as a job the setup and race screens understand.
export function bountyJob(conductor, id) {
  const boss = bossById(id);
  if (!boss) return null;
  const line = lineById(boss.line);
  return {
    id: `bounty-${id}`,
    type: 'bounty',
    bossId: id,
    title: `Bounty: ${boss.name}`,
    from: CITIES[line.a].name,
    to: CITIES[line.b].name,
    line: line.id,
    theme: line.terrain,
    distance: boss.miles,
    containers: 0,
    weight: 0,
    boulders: [],
  };
}

const RARITY_DOWN = { legendary: 'epic', epic: 'rare', rare: 'uncommon', uncommon: 'uncommon' };

// What bringing this boss down pays today: the full bounty and its relic the first time, a share after.
export function bountyReward(conductor, id) {
  const boss = B.BOSSES[id];
  const first = !(bossRecord(conductor, id).kills > 0);
  return {
    first,
    lt: Math.round(boss.bounty * (first ? 1 : B.BOSS.repeat.pay)),
    xp: Math.round(boss.xp * (first ? 1 : B.BOSS.repeat.xp)),
    weapon: first ? boss.weapon : RARITY_DOWN[boss.weapon],
    relic: first ? boss.relic : null,
  };
}

// How a legendary machine can be had: bought at its list price, forged with a boss relic for less,
// or (forge-only engines) not at all until the relic is won.
export function legendOffer(conductor, model) {
  const m = B.MYTHIC[model];
  if (!m?.price) return null;
  const bossId = m.forge?.relic ?? null;
  const relic = bossId ? hasRelic(conductor, bossId) : false;
  if (m.forgeOnly && !relic) {
    return { price: null, listPrice: m.price, forged: false, bossId, locked: `Forged from ${B.BOSSES[bossId].relic}. Bring down ${B.BOSSES[bossId].name} to win it.` };
  }
  return { price: relic ? m.forge.price : m.price, listPrice: m.price, forged: relic, bossId, locked: null };
}
