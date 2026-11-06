import { describe, expect, it } from 'vitest';
import { TIER_IDS, poolOf } from '../src/game/crates.js';
import { crewRating, locoRating, ratingBand, ratingOf } from '../src/game/power.js';

const median = (list) => {
  const s = [...list].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const ratings = (tier, kind) => poolOf(tier).filter((n) => n.kind === kind).map((n) => ratingOf(kind, n.data));

describe('power rating', () => {
  it('puts Uncommon crate NFTs around 500 to 900', () => {
    for (const kind of ['loco', 'conductor']) {
      const list = ratings('uncommon', kind);
      expect(list.length).toBeGreaterThan(0);
      expect(median(list)).toBeGreaterThanOrEqual(600);
      expect(median(list)).toBeLessThanOrEqual(800);
      expect(Math.min(...list)).toBeGreaterThanOrEqual(450);
      expect(Math.max(...list)).toBeLessThanOrEqual(950);
    }
  });

  it('puts Legendary crate NFTs around 6,000', () => {
    for (const kind of ['loco', 'conductor']) {
      const m = median(ratings('legendary', kind));
      expect(m).toBeGreaterThan(5000);
      expect(m).toBeLessThan(7000);
    }
  });

  it('climbs with every tier', () => {
    for (const kind of ['loco', 'conductor']) {
      const medians = TIER_IDS.map((tier) => median(ratings(tier, kind)));
      for (let i = 1; i < medians.length; i++) expect(medians[i]).toBeGreaterThan(medians[i - 1]);
    }
  });

  it('counts abilities and handles both trait formats', () => {
    const loco = { model: 'tank', rarity: 'rare', power: 7, efficiency: 6, durability: 6, endurance: 6 };
    expect(locoRating({ ...loco, superTrait: 'velocity' })).toBeGreaterThan(locoRating(loco));
    const crew = { str: 9, agi: 9, int: 9, end: 9 };
    const ids = crewRating({ ...crew, traits: ['leader'] });
    const objs = crewRating({ ...crew, traits: [{ id: 'leader', rarity: 'normal' }] });
    expect(ids).toBe(objs);
    expect(crewRating({ ...crew, traits: [{ id: 'leader', rarity: 'profound' }] })).toBeGreaterThan(objs);
    expect(ratingBand(700)).toBe('uncommon');
    expect(ratingBand(6000)).toBe('legendary');
  });
});
