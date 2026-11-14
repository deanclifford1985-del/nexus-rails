import { B } from './balance.js';
import { shuffle } from './rng.js';
import { licenceLevel } from './routemap.js';
import { BOSS_IDS, bossState } from './bosses.js';
import { routesOf, terminalCount } from './empire.js';

// Weekly orders and career milestones: things to do beyond the job in front of you.
// Both feed on the same counters, which settleRun adds to after every run (recordEvents).

const T = () => B.TASKS;

// A conductor's tier for orders, 0 to 3: the higher of the licence held and a tier per five levels.
export function taskTier(conductor) {
  return Math.min(3, Math.max(licenceLevel(conductor), Math.floor(((conductor.level ?? 1) - 1) / 5)));
}

// Which order types make sense for this conductor this week.
function typesFor(conductor) {
  return Object.keys(T().types).filter((id) => {
    const needs = T().types[id].needs;
    if (needs === 'boss') return BOSS_IDS.some((boss) => bossState(conductor, boss).state === 'open');
    return true;
  });
}

// This week's orders: four different things to do, sized to the conductor.
export function rollTasks(conductor, rng, week) {
  const tier = taskTier(conductor);
  const picks = shuffle(rng, typesFor(conductor)).slice(0, T().count);
  return {
    week,
    bonus: false,
    list: picks.map((type) => {
      const def = T().types[type];
      return { id: `${type}-${week}`, type, target: def.target[tier], progress: 0, lt: def.lt[tier], xp: def.xp[tier], claimed: false };
    }),
  };
}

export const taskText = (task) => {
  const def = T().types[task.type];
  return task.target === 1 && def.one ? def.one : def.text.replace('{n}', task.target.toLocaleString());
};
export const taskDone = (task) => task.progress >= task.target;
// (An order of a kind that is no longer posted is dropped rather than shown.)
export const tasksOf = (conductor) => (conductor.tasks?.list ?? []).filter((task) => T().types[task.type]);
export const tasksClaimable = (conductor) => tasksOf(conductor).filter((task) => taskDone(task) && !task.claimed).length;
export const allTasksClaimed = (conductor) => tasksOf(conductor).length > 0 && tasksOf(conductor).every((task) => task.claimed);

// What finishing every order this week pays on top.
export function taskBonus(conductor) {
  const list = tasksOf(conductor);
  return { lt: Math.round(list.reduce((sum, task) => sum + task.lt, 0) * T().bonus.ltShare), weapon: T().bonus.weapon[taskTier(conductor)] };
}

/**
 * Things that just happened, as counts: { miles: 62, deliveries: 1, obstacles: 3, ... }.
 * Adds them to the conductor's lifetime counters and to this week's orders. Mutates the save.
 */
export function recordEvents(conductor, events) {
  const counters = { ...(conductor.counters ?? {}) };
  for (const [key, amount] of Object.entries(events)) {
    if (!(amount > 0)) continue;
    counters[key] = (counters[key] ?? 0) + amount;
  }
  conductor.counters = counters;
  for (const task of tasksOf(conductor)) {
    const amount = events[T().types[task.type]?.key];
    if (amount > 0 && !task.claimed) task.progress = Math.min(task.target, Math.round((task.progress + amount) * 10) / 10);
  }
}

// What a settled run counts for.
export function runEvents(ctx, receipt, result) {
  const kind = ctx.kind;
  const delivered = receipt.outcome === 'delivered';
  const won = receipt.outcome === 'won';
  return {
    miles: result.distance ?? 0,
    deliveries: delivered ? 1 : 0,
    containers: delivered ? receipt.haul ?? 0 : 0,
    early: delivered && (result.underLimitPct ?? 0) >= 25 ? 1 : 0,
    podiums: ['race', 'open'].includes(kind) && ['won', 'placed'].includes(receipt.outcome) ? 1 : 0,
    raceWins: ['race', 'open'].includes(kind) && won ? 1 : 0,
    contractWins: kind === 'contract' && won ? 1 : 0,
    obstacles: (result.bouldersSmashed ?? 0) + (result.bouldersCrushed ?? 0),
    derails: result.kills ?? 0, // only the rivals the player put off the rails (kill credit)
    damage: receipt.outcome === 'forfeit' ? 0 : result.damageDealt ?? 0,
    earned: receipt.payout ?? 0,
    bossKills: kind === 'bounty' && won ? 1 : 0,
  };
}

// ---------- milestones ----------

const medalPoints = (conductor) => Object.values(conductor.trials ?? {}).reduce((sum, trial) => sum + ({ gold: 3, silver: 2, bronze: 1 }[trial.medal] ?? 0), 0);

// How far along a milestone's ladder the conductor is: the number it counts.
export function milestoneValue(conductor, id) {
  switch (id) {
    case 'miles':
      return Math.floor(conductor.stats?.miles ?? 0);
    case 'earned':
      return Math.floor(conductor.stats?.earned ?? 0);
    case 'terminals':
      return terminalCount(conductor);
    case 'routes':
      return Math.max(routesOf(conductor).length, conductor.counters?.routesPeak ?? 0);
    case 'legends':
      return (conductor.locos ?? []).filter((loco) => loco.model === 'phoenix' || B.MYTHIC[loco.model]?.price).length;
    case 'medals':
      return medalPoints(conductor);
    case 'trophies':
      return Object.keys(conductor.trophies ?? {}).length;
    default:
      return Math.floor(conductor.counters?.[id] ?? 0);
  }
}

// Where a milestone stands: rungs claimed, rungs reached, and the next one.
export function milestoneState(conductor, id) {
  const def = B.MILESTONES[id];
  const value = milestoneValue(conductor, id);
  const claimed = conductor.milestones?.[id] ?? 0;
  const reached = def.tiers.filter((need) => value >= need).length;
  return { id, def, value, claimed, reached, ready: reached > claimed, next: def.tiers[claimed] ?? null, reward: def.lt[claimed] ?? null, complete: claimed >= def.tiers.length };
}
export const milestonesReady = (conductor) => Object.keys(B.MILESTONES).filter((id) => milestoneState(conductor, id).ready).length;
