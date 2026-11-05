import { B } from './balance.js';

// `scales: true` means the effect is a number that can be made stronger or weaker
// (Profound, Infused, Amplify). Traits without it are simply on or off.
// `enabled: false` traits wait for a system that is not in the game yet.
export const TRAITS = {
  competitive: {
    name: 'Competitive',
    text: 'Hold within half a mile of a rival for 3 seconds to gain 5% power, 8% after 10 seconds. The boost drops the moment the gap opens.',
    short: 'Power boost in close races',
    where: 'Races',
    scales: true,
  },
  negotiator: {
    name: 'Negotiator',
    text: '35% chance to win a contract from 2nd place, 15% from 3rd.',
    short: 'Can win contracts without winning',
    where: 'Contracts',
    scales: true,
  },
  business: {
    name: 'Business',
    text: 'Deliveries pay 5 to 15% more. Winning contracts pays 10% of their value up front.',
    short: 'Bigger payouts',
    where: 'Payouts',
    scales: true,
  },
  leader: {
    name: 'Leader',
    text: 'Earn 15% more experience from every run.',
    short: '+15% experience',
    where: 'Experience',
    scales: true,
  },
  economist: {
    name: 'Economist',
    text: 'Start with 25% more LocoTokens and pay 10% less for fuel.',
    short: 'More cash, cheaper fuel',
    where: 'Money',
    scales: true,
  },
  prepared: {
    name: 'Prepared',
    text: 'Start with 15 extra gallons per point of locomotive Power. 20% off when you buy 200 gallons or more at once.',
    short: 'Extra fuel, bulk discount',
    where: 'Fuel',
    scales: true,
  },
  elevate: {
    name: 'Elevate',
    text: 'Ignore 15% of cargo weight, both for what you can tow and how it slows you.',
    short: 'Cargo weighs 15% less',
    where: 'Hauling',
    scales: true,
  },
  diplomat: {
    name: 'Diplomat',
    text: 'Gain 25% more reputation with companies.',
    short: '+25% reputation',
    where: 'Reputation',
    scales: true,
  },
  genius: {
    name: 'Genius',
    text: 'Research runs 15% faster.',
    short: 'Faster research',
    where: 'Research',
    scales: true,
  },
  engineer: {
    name: 'Engineer',
    text: 'Workshop upgrades cost 15% less.',
    short: 'Cheaper upgrades',
    where: 'Workshop',
    scales: true,
  },
  pitcrew: {
    name: 'Pit Crew',
    text: 'Emergency fuel reaches you 25% faster.',
    short: 'Faster roadside fuel',
    where: 'Races',
    scales: true,
  },
  influencer: {
    name: 'Influencer',
    text: 'Your Strength, Agility, Intelligence and Endurance affect your locomotive and research twice as much.',
    short: 'Attributes count double',
    where: 'Attributes',
    scales: true,
  },
  marathoner: {
    name: 'Marathoner',
    text: 'Your engine builds 20% less heat, and sheds heat 25% faster when you ease off.',
    short: 'Cooler engine',
    where: 'Races',
    scales: true,
  },
  secondwind: {
    name: 'Second Wind',
    text: 'Once a run, the first time your engine passes 80% heat it vents a third of it at once.',
    short: 'One free vent a run',
    where: 'Races',
    scales: true,
  },
  amplify: {
    name: 'Amplify',
    text: 'All your other traits are 50% more effective.',
    short: 'Other traits 50% stronger',
    where: 'Traits',
    scales: true,
  },
  lucky: {
    name: 'Lucky',
    text: '+1 to every attribute die you roll.',
    short: '+1 on every die',
    where: 'Creation',
  },
  consistent: {
    name: 'Mr. Consistent',
    text: 'Each attribute roll is three six-sided dice added together instead of one d20.',
    short: 'Roll 3d6 instead of d20',
    where: 'Creation',
  },
  focused: {
    name: 'Focused',
    text: 'Reroll attribute dice one at a time instead of all at once.',
    short: 'Reroll single dice',
    where: 'Creation',
  },
  secondchances: {
    name: 'Second Chances',
    text: 'Two extra rerolls.',
    short: '+2 rerolls',
    where: 'Creation',
  },
  prodigy: {
    name: 'Prodigy',
    text: 'Pick two more traits. Three more are dealt for you to choose from. Once taken, it cannot be put back.',
    short: 'Two extra trait picks',
    where: 'Creation',
  },
  // Waiting on systems that are not built yet.
  technician: { name: 'Technician', text: 'Repair costs reduced by 20%.', where: 'Repairs', enabled: false },
  mechanic: { name: 'Mechanic', text: 'Locomotives lose durability 15% slower.', where: 'Repairs', enabled: false },
  teamplayer: { name: 'Team Player', text: 'Bonus when racing with allies.', where: 'Teams', enabled: false },
};

export const ACTIVE_TRAIT_IDS = Object.keys(TRAITS).filter((id) => TRAITS[id].enabled !== false);
export const SCALING_TRAIT_IDS = ACTIVE_TRAIT_IDS.filter((id) => TRAITS[id].scales);

export const TRAIT_RARITIES = {
  normal: { label: '', note: '' },
  profound: { label: 'Profound', note: '20% stronger' },
  gifted: { label: 'Gifted', note: 'Free: does not use a pick' },
  infused: { label: 'Infused', note: 'Two traits, each at half strength' },
};

// How strongly a conductor holds a trait. 0 means they do not have it,
// 1 is the normal strength, 1.2 Profound, 0.5 one half of an Infused pair.
export function traitPower(conductor, id) {
  const traits = conductor?.traits;
  if (!traits) return 0;
  let own = 0;
  let amplify = 0;
  for (const trait of traits) {
    if (trait.id === id) own += trait.mult ?? 1;
    if (trait.id === 'amplify') amplify += trait.mult ?? 1;
  }
  if (own === 0 || id === 'amplify') return own;
  if (!TRAITS[id]?.scales) return own;
  return own * (1 + B.TRAIT_RARITY.amplify * amplify);
}

export const hasTrait = (conductor, id) => traitPower(conductor, id) > 0;

// Trait entries stored on the conductor for one chosen offer.
export function traitsFromOffer(offer) {
  if (offer.rarity === 'infused') {
    return offer.ids.map((id) => ({ id, mult: B.TRAIT_RARITY.infusedMult, rarity: 'infused' }));
  }
  const mult = offer.rarity === 'profound' ? B.TRAIT_RARITY.profoundMult : 1;
  return [{ id: offer.ids[0], mult, rarity: offer.rarity }];
}
