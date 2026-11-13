// Shared set-up for the Iron Dawn rules tests: recruits, trained recruits and serving soldiers.
import * as A from '../src/game/actions.js';
import { B } from '../src/game/balance.js';
import { ATTR_IDS } from '../src/game/attributes.js';
import { levelForXp, newCharacter, xpForLevel } from '../src/game/character.js';
import { RANKS } from '../src/game/ranks.js';
import { EXAM, scoreExam, scoreObservation, scoreObstacle, scoreRange, scoreStealth } from '../src/game/training.js';

export const NOW = 1794528000000;

export const bestAnswers = () => Object.fromEntries(EXAM.map((q) => [q.id, q.options.findIndex((o) => o.best)]));

// A flawless run of every evaluation.
export const PERFECT = {
  range: () => scoreRange({ hits: B.TRAINING.RANGE_TARGETS, longHits: B.TRAINING.RANGE_LONG, avgReact: 0.5 }),
  obstacle: () => scoreObstacle({ time: B.TRAINING.OBSTACLE_PAR - 5, faults: 0, staminaLeft: 1 }),
  stealth: () => scoreStealth({ reached: true, strikes: 0, peak: 0, time: 80 }),
  observation: () => scoreObservation({ found: B.TRAINING.OBSERVE_TARGETS, timeLeft: B.TRAINING.OBSERVE_SECONDS }),
  exam: () => scoreExam(bestAnswers()),
};

// The sort of run most recruits manage.
export const AVERAGE = {
  range: () => scoreRange({ hits: 12, longHits: 3, avgReact: 1.5 }),
  obstacle: () => scoreObstacle({ time: 85, faults: 1, staminaLeft: 0.3 }),
  stealth: () => scoreStealth({ reached: true, strikes: 1, peak: 0.5, time: 150 }),
  observation: () => scoreObservation({ found: 5 }),
  exam: () => scoreExam(Object.fromEntries(EXAM.map((q, i) => [q.id, i % 2 === 0 ? q.options.findIndex((o) => o.best) : q.options.findIndex((o) => !o.best)]))),
};

// Straight off the truck; with a specialization unless spec is null.
export function recruit(spec = 'rifleman', name = 'Test') {
  const save = newCharacter({ name, now: NOW });
  if (spec) A.chooseSpec(save, { spec, now: NOW });
  return save;
}

// Through all five evaluations but not yet graduated.
export function trained(spec = 'rifleman', runs = AVERAGE) {
  const save = recruit(spec);
  for (const [event, make] of Object.entries(runs)) A.finishTraining(save, { event, result: make(), now: NOW });
  return save;
}

// A graduated soldier. `all` sets every attribute, `attrs` individual ones; rank and level are
// given the experience they need so the rules see a consistent save.
export function soldier({ spec = 'rifleman', rank = 1, level = 1, all = null, attrs = null, rp = null, runs = AVERAGE } = {}) {
  const save = trained(spec, runs);
  A.graduate(save, { now: NOW });
  if (all !== null) for (const id of ATTR_IDS) save.attrs[id] = all;
  Object.assign(save.attrs, attrs ?? {});
  save.xp = Math.max(xpForLevel(level), RANKS[rank].xp);
  save.level = levelForXp(save.xp);
  save.points = 0;
  save.rank = rank;
  if (rank >= 8) save.story.flags.commissioned = true;
  if (rp !== null) save.rp = rp;
  return save;
}

// Every number inside an object, by dotted path.
export function numbers(value, path = '', out = {}) {
  if (typeof value === 'number') out[path] = value;
  else if (value && typeof value === 'object') for (const [key, inner] of Object.entries(value)) numbers(inner, path ? `${path}.${key}` : key, out);
  return out;
}

export const at = (object, path) => path.split('.').reduce((value, key) => value?.[key], object);

// Runs fn and returns the GameError message it threw (fails the test if it did not throw one).
export function refusal(fn) {
  try {
    fn();
  } catch (error) {
    if (error instanceof A.GameError) return error.message;
    throw error;
  }
  throw new Error('expected the rules to refuse, but they allowed it');
}
