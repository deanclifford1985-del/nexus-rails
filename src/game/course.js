import { B } from './balance.js';
import { makeRng, randRange, weightedPick } from './rng.js';

// A course is the shape of the line: straights and bends, each bend with a speed limit.
// The same seed always gives the same course, so the setup estimate matches the race.
//   { distance, bends: [{ start, end, kind, limit, dir, turn }] }   miles, mph, radians

export function hashSeed(text) {
  let h = 2166136261;
  for (const ch of String(text)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function makeCourse(seed, distance) {
  const T = B.TRACK;
  const rng = makeRng(typeof seed === 'number' ? seed : hashSeed(seed));
  const kinds = Object.keys(T.bends);
  const bends = [];
  let at = T.straightStart;
  let heading = 0;
  for (let guard = 0; guard < 2000; guard++) {
    const start = at + randRange(rng, ...T.gap);
    let spec = T.bends[weightedPick(rng, kinds, (k) => T.bends[k].chance)];
    let end = start + randRange(rng, ...spec.length);
    if (end > distance - T.straightEnd) {
      // No room for a long sweep before the line: try a short, sharp one instead.
      spec = T.bends.sharp;
      end = start + randRange(rng, ...spec.length);
      if (end > distance - T.straightEnd) break;
    }
    const turn = randRange(rng, ...spec.turn);
    // Lean back towards the starting heading so the line never curls round on itself.
    const dir = heading > 0.6 ? -1 : heading < -0.6 ? 1 : rng() < 0.5 ? -1 : 1;
    heading += dir * turn;
    const curve = turn / (end - start);
    const kind = curve >= T.sharpness.sharp ? 'sharp' : curve >= T.sharpness.medium ? 'medium' : 'gentle';
    bends.push({ start, end, kind, dir, turn, curve });
    at = end;
  }
  // Hills, laid independently of the bends: climb, level, descend, so the line comes back down.
  const H = T.hills;
  const hills = [];
  let pos = randRange(rng, ...H.gap) * 0.6;
  let height = 0;
  for (let guard = 0; guard < 400; guard++) {
    const start = pos;
    const end = start + randRange(rng, ...H.length);
    if (end > distance - 0.5) break;
    if (rng() < H.chance) {
      // Lean back towards level ground over the whole run.
      const up = height > 0.04 ? false : height < -0.04 ? true : rng() < 0.55;
      const grade = (up ? 1 : -1) * randRange(rng, ...H.grade);
      hills.push({ start, end, grade, from: height });
      height += grade * (end - start);
    }
    pos = end + randRange(rng, ...H.gap);
  }
  return { distance, bends, hills };
}

// The grade (rise over run) at `miles`: positive is uphill.
export function gradeAt(course, miles) {
  const hill = course?.hills?.find((item) => miles >= item.start && miles < item.end);
  return hill ? hill.grade : 0;
}
export const hillAt = (course, miles) => course?.hills?.find((item) => miles >= item.start && miles < item.end) ?? null;
export const nextHill = (course, miles) => course?.hills?.find((item) => item.end > miles) ?? null;

// Height of the line above the start, in miles, smoothed in and out of each hill for the 3D scene.
export function elevationAt(course, miles) {
  let h = 0;
  for (const hill of course?.hills ?? []) {
    if (miles <= hill.start) break;
    const len = hill.end - hill.start;
    const k = Math.min(1, (miles - hill.start) / len);
    h = hill.from + hill.grade * len * (k * k * (3 - 2 * k));
    if (miles < hill.end) return h;
  }
  return h;
}

// Strength as grip on a climb: the share of the uphill loss it wins back.
export function hillGripFor(strength = 0, influencer = 0) {
  const T = B.TRACK;
  return Math.max(0, Math.min(T.hillGripMax, strength * T.gripPerStr * (1 + influencer)));
}

// Top speed multiplier and fuel multiplier on this grade.
export function hillEffect(grade, hillGrip = 0) {
  const T = B.TRACK;
  if (grade > 0) return { speed: Math.max(0.4, 1 - grade * T.climbLoss * (1 - hillGrip)), fuel: 1 + grade * T.climbFuel };
  if (grade < 0) return { speed: 1 - grade * T.descentGain, fuel: Math.max(0.6, 1 + grade * T.descentFuel) };
  return { speed: 1, fuel: 1 };
}

// Agility as grip: the share of a bend's lost speed a conductor wins back.
export function gripFor(agility = 0, influencer = 0) {
  const T = B.TRACK;
  return Math.max(0, Math.min(T.gripMax, agility * T.gripPerAgi * (1 + influencer)));
}

// The share of its top speed a train can hold through this bend.
export function bendKeep(bend, grip = 0) {
  const T = B.TRACK;
  const keep = Math.max(T.minKeep, 1 / (1 + T.keepPerCurve * Math.sqrt(bend.curve)));
  return keep + (1 - keep) * grip;
}

export const bendLimit = (bend, vmax, grip = 0) => bendKeep(bend, grip) * vmax;

// The fastest a train may be going at `miles` so it can still brake for every bend ahead.
// Braking `decel` mph a game second: v^2 = limit^2 + 2 * a * d, with a in mph per hour.
export function cornerCap(course, miles, vmax, grip = 0, decel = B.TRACK.brake) {
  if (!course || !(vmax > 0)) return Infinity;
  const a = decel * 3600;
  let cap = Infinity;
  for (const bend of course.bends) {
    if (bend.end <= miles) continue;
    const d = Math.max(0, bend.start - miles);
    if (d > 4) break;
    const limit = bendLimit(bend, vmax, grip);
    cap = Math.min(cap, Math.sqrt(limit * limit + 2 * a * d));
  }
  return cap;
}

export const bendAt = (course, miles) => course?.bends.find((bend) => miles >= bend.start && miles < bend.end) ?? null;
export const nextBend = (course, miles) => course?.bends.find((bend) => bend.end > miles) ?? null;
