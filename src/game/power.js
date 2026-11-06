// Power rating: one number for a locomotive or a conductor, shown big on its card.
//
// Each stat is weighted by how much it wins races (Power most, then Efficiency, Endurance, Armor;
// for conductors Agility most, then Strength, Endurance, Intelligence), abilities add a fixed bonus,
// and the total runs through an exponential curve so each rarity sits clearly above the last:
// Uncommon crate NFTs land around 500 to 900, Legendary around 6,000.
//
//   rating = A × e^(k × effective points)
//
// A and k are fixed constants, calibrated on the Season 1 crate pools (see tests/rules.test.js).

import { B } from './balance.js';
import { MODELS, spellsOf } from './locomotives.js';
import { TRAITS } from './traits.js';

export const POWER = {
  loco: {
    weights: { power: 1.45, efficiency: 1.0, endurance: 0.85, durability: 0.7 },
    superTrait: 3.5, // a Legendary's super trait
    spell: 1.4, // each built-in spell
    journey: 2.5, // the Journey (Epic or Legendary Long Run)
    mythic: 6, // the mythic engines
    A: 0, // set below
    k: 0,
  },
  crew: {
    weights: { agi: 1.25, str: 1.1, end: 0.85, int: 0.8 },
    trait: 3.2, // each trait
    A: 0,
    k: 0,
  },
};

// Calibration targets: the middle of each tier.
//   locomotives: 20 stat points (Uncommon crate) → ~700, 40 points (Legendary crate) → ~6,000
//   conductors: 36 attribute points + 1 trait → ~700, 66 points + 4 traits → ~6,000
const fit = (loPts, loRating, hiPts, hiRating) => {
  const k = Math.log(hiRating / loRating) / (hiPts - loPts);
  return { k, A: loRating / Math.exp(k * loPts) };
};
Object.assign(POWER.loco, fit(20.2, 700, 49.4, 6000), { top: 49.4 });
Object.assign(POWER.crew, fit(39.3, 700, 78.0, 6000), { top: 78.0 });

// Effective points for a locomotive: weighted stats plus abilities.
export function locoPoints(loco) {
  const P = POWER.loco;
  let pts = 0;
  for (const [key, w] of Object.entries(P.weights)) pts += w * (loco[key] ?? 0);
  if (loco.superTrait) pts += P.superTrait;
  if (loco.journey) pts += P.journey;
  if (MODELS[loco.model]?.mythic) pts += P.mythic;
  pts += P.spell * spellsOf(loco).length;
  return pts;
}

// Effective points for a conductor: weighted attributes plus traits.
export function crewPoints(crew) {
  const P = POWER.crew;
  let pts = 0;
  for (const [key, w] of Object.entries(P.weights)) pts += w * (crew[key] ?? 0);
  for (const t of crew.traits ?? []) {
    // Crate conductors hold trait ids; a Captain's own traits are { id, rarity }.
    const id = typeof t === 'string' ? t : t?.id;
    if (!TRAITS[id]) continue;
    const mult = t?.rarity === 'profound' ? B.TRAIT_RARITY.profoundMult : 1;
    pts += P.trait * mult;
  }
  return pts;
}

// Past the Legendary mark the curve climbs at half the rate, so the rare super-rolls stay readable.
const curve = ({ A, k, top }, pts) => {
  const at = Math.min(pts, top);
  const over = Math.max(0, pts - top);
  return Math.max(1, Math.round(A * Math.exp(k * at + 0.5 * k * over)));
};

export const locoRating = (loco) => curve(POWER.loco, locoPoints(loco));
export const crewRating = (crew) => curve(POWER.crew, crewPoints(crew));
export const ratingOf = (kind, data) => (kind === 'loco' ? locoRating(data) : crewRating(data));

// A colour band for the number: grey under 500, then green, blue, purple, gold.
export function ratingBand(rating) {
  if (rating >= 4500) return 'legendary';
  if (rating >= 2000) return 'epic';
  if (rating >= 1000) return 'rare';
  if (rating >= 480) return 'uncommon';
  return 'common';
}

export { B };
