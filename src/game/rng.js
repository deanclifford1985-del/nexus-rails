// Seeded random numbers. Rules take an `rng` so results can be reproduced in tests
// and so a save file carries its own stream of luck.

export function makeRng(seed) {
  let s = seed >>> 0 || 1;
  const next = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.state = () => s >>> 0;
  return next;
}

export const newSeed = () => Math.floor(Math.random() * 4294967296) >>> 0;
export const randInt = (rng, min, max) => min + Math.floor(rng() * (max - min + 1));
export const randRange = (rng, min, max) => min + rng() * (max - min);
export const pick = (rng, list) => list[Math.floor(rng() * list.length)];
export const uid = (rng, prefix = 'id') => `${prefix}-${Math.floor(rng() * 2176782336).toString(36)}`;

export function shuffle(rng, list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function weightedPick(rng, items, weightOf) {
  const total = items.reduce((sum, item) => sum + weightOf(item), 0);
  let roll = rng() * total;
  for (const item of items) {
    roll -= weightOf(item);
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const round1 = (value) => Math.round(value * 10) / 10;
