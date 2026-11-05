import { B } from './balance.js';
import { hashSeed } from './course.js';
import { traitPower } from './traits.js';

// How sure this conductor's estimates are: +/- this share. Intelligence narrows it.
export function estimateBand(conductor) {
  const E = B.ESTIMATE;
  const int = (conductor?.int ?? 0) * (1 + traitPower(conductor, 'influencer'));
  return Math.max(E.min, E.band - E.perInt * int);
}

/**
 * An estimate as a range that always contains the true value. The range is not centred on the
 * truth (that would give it away): its middle is nudged by a fixed amount per `key`, so the same
 * estimate never jitters from one look to the next.
 */
export function estimateRange(value, band, key) {
  const r = ((hashSeed(String(key)) % 10000) / 10000) * 1.4 - 0.7;
  const centre = value * (1 + band * r);
  return { lo: centre * (1 - band), hi: centre * (1 + band), band, value };
}
