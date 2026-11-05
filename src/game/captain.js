// The Captain: the player in Nexus Rail (the NFT edition). A Captain owns the trains and hires
// conductors (crew) to drive them, picks a focus, and spends a talent point every level up to 30.
// A save with no `captain` is a Lite save and none of this applies.

export const CAPTAIN_MAX_LEVEL = 30;

export const FOCUSES = {
  business: {
    name: 'Business',
    blurb: 'Contracts, jobs, negotiations and money.',
    perk: '+1% pay on every job and race per Captain level',
    perLevel: { pay: 0.01 },
  },
  engineering: {
    name: 'Engineering',
    blurb: 'Train performance: power, pull, cooling and grip.',
    perk: '+0.5% horsepower and torque per Captain level',
    perLevel: { power: 0.005 },
  },
  scientist: {
    name: 'Scientist',
    blurb: 'Research and spell effectiveness.',
    perk: '+1% research speed and +0.5% spell damage per Captain level',
    perLevel: { research: 0.01, spell: 0.005 },
  },
};

// Three trees, World of Warcraft style: six tiers each. A tier opens once you have spent
// 5 points per tier above it in that tree (tier 2 at 5 points, tier 3 at 10 ...). The capstone
// (tier 6, 25 points) can only be taken in your focus tree. Each rank adds `per` to `effect`.
export const TREES = {
  business: {
    name: 'Business',
    talents: [
      { id: 'haggler', tier: 1, name: 'Haggler', ranks: 5, effect: 'pay', per: 0.02, text: '+2% pay on deliveries, jobs and races per rank' },
      { id: 'thrifty', tier: 1, name: 'Thrifty', ranks: 5, effect: 'fuelPrice', per: 0.02, text: '2% cheaper fuel per rank' },
      { id: 'goodword', tier: 2, name: 'Good Word', ranks: 5, effect: 'rep', per: 0.06, text: '+6% company reputation per rank' },
      { id: 'closer', tier: 2, name: 'Closer', ranks: 3, effect: 'negotiate', per: 0.08, text: '+8% chance per rank to win a contract from 2nd place' },
      { id: 'bulkbuyer', tier: 3, name: 'Bulk Buyer', ranks: 3, effect: 'containerPrice', per: 0.08, text: 'Containers and repairs 8% cheaper per rank' },
      { id: 'expedite', tier: 3, name: 'Expedite', ranks: 2, effect: 'timeLimit', per: 0.1, text: 'Delivery time limits 10% longer per rank' },
      { id: 'portfolio', tier: 4, name: 'Portfolio', ranks: 3, effect: 'contractPay', per: 0.06, text: '+6% pay on contract jobs per rank' },
      { id: 'mentor', tier: 4, name: 'Mentor', ranks: 3, effect: 'xp', per: 0.05, text: '+5% experience per rank' },
      { id: 'tycoon', tier: 5, name: 'Tycoon', ranks: 1, effect: 'pay', per: 0.1, text: '+10% more pay on everything' },
      { id: 'magnate', tier: 6, name: 'Rail Magnate', ranks: 1, effect: 'magnate', per: 1, text: 'Capstone: every contract race pays a purse of 25 LT per mile, win or lose', capstone: true },
    ],
  },
  engineering: {
    name: 'Engineering',
    talents: [
      { id: 'tuning', tier: 1, name: 'Fine Tuning', ranks: 5, effect: 'power', per: 0.015, text: '+1.5% horsepower and torque per rank' },
      { id: 'coolant', tier: 1, name: 'Coolant Loops', ranks: 5, effect: 'cool', per: 0.04, text: '4% less engine heat per rank' },
      { id: 'flanges', tier: 2, name: 'Deep Flanges', ranks: 5, effect: 'grip', per: 0.03, text: 'Hold 3% more of a bend’s lost speed per rank' },
      { id: 'gearing', tier: 2, name: 'Low Gearing', ranks: 3, effect: 'accel', per: 0.05, text: '5% quicker to full speed per rank' },
      { id: 'chassis', tier: 3, name: 'Reinforced Chassis', ranks: 3, effect: 'tow', per: 0.05, text: '+5% towing capacity per rank' },
      { id: 'plating', tier: 3, name: 'Hull Plating', ranks: 3, effect: 'hull', per: 0.06, text: '+6% train HP per rank' },
      { id: 'wear', tier: 4, name: 'Precision Fit', ranks: 3, effect: 'wear', per: 0.1, text: 'Locomotives wear 10% slower per rank' },
      { id: 'boost', tier: 4, name: 'Turbo Feed', ranks: 2, effect: 'boot', per: 0.15, text: 'Weapons boot up 15% sooner per rank' },
      { id: 'overdrive', tier: 5, name: 'Overdrive', ranks: 1, effect: 'overHeat', per: 0.35, text: 'Running past 100% lever builds 35% less heat' },
      { id: 'masterwork', tier: 6, name: 'Masterwork Engine', ranks: 1, effect: 'masterwork', per: 0.06, text: 'Capstone: +6% top speed, and climbs cost half as much speed', capstone: true },
    ],
  },
  scientist: {
    name: 'Scientist',
    talents: [
      { id: 'labwork', tier: 1, name: 'Lab Work', ranks: 5, effect: 'research', per: 0.04, text: 'Research 4% faster per rank' },
      { id: 'arcana', tier: 1, name: 'Applied Arcana', ranks: 5, effect: 'spell', per: 0.03, text: 'Spells hit 3% harder per rank' },
      { id: 'grants', tier: 2, name: 'Grants', ranks: 3, effect: 'researchPrice', per: 0.06, text: 'Research costs 6% less per rank' },
      { id: 'focusmp', tier: 2, name: 'Focus', ranks: 5, effect: 'mp', per: 0.06, text: '+6% MP regeneration per rank' },
      { id: 'forecast', tier: 3, name: 'Forecasting', ranks: 3, effect: 'estimate', per: 0.15, text: 'Estimates 15% tighter per rank' },
      { id: 'capacitors', tier: 3, name: 'Capacitors', ranks: 3, effect: 'charge', per: 0.1, text: '+10% charge and charge regeneration per rank' },
      { id: 'channeling', tier: 4, name: 'Channeling', ranks: 3, effect: 'spellCd', per: 0.06, text: 'Spells and lightning recover 6% sooner per rank' },
      { id: 'sensors', tier: 4, name: 'Sensor Array', ranks: 2, effect: 'sight', per: 0.15, text: 'Spot obstacles 15% further per rank' },
      { id: 'catalyst', tier: 5, name: 'Catalyst', ranks: 1, effect: 'dot', per: 0.5, text: 'Burn and Poison you apply gain 50% more stacks' },
      { id: 'breakthrough', tier: 6, name: 'Breakthrough', ranks: 1, effect: 'breakthrough', per: 0.25, text: 'Capstone: research 25% faster and spells cost 25% less MP', capstone: true },
    ],
  },
};

export const TALENTS = Object.fromEntries(Object.entries(TREES).flatMap(([tree, t]) => t.talents.map((talent) => [talent.id, { ...talent, tree }])));

export const isCaptain = (save) => !!save?.captain;

// Talent points: one per Captain level, starting at level 1.
export const pointsEarned = (save) => (isCaptain(save) ? Math.min(CAPTAIN_MAX_LEVEL, save.level ?? 1) : 0);
export const pointsSpent = (save) => Object.values(save?.captain?.talents ?? {}).reduce((a, b) => a + b, 0);
export const pointsLeft = (save) => pointsEarned(save) - pointsSpent(save);
export const treePoints = (save, tree) =>
  Object.entries(save?.captain?.talents ?? {}).reduce((sum, [id, rank]) => sum + (TALENTS[id]?.tree === tree ? rank : 0), 0);
export const tierOpenAt = (tier) => (tier - 1) * 5;

// Null when the talent can take another rank; otherwise why not.
export function talentBlocker(save, id) {
  const t = TALENTS[id];
  if (!t) return 'Unknown talent';
  if (!isCaptain(save)) return 'Only a Captain has talents';
  const rank = save.captain.talents[id] ?? 0;
  if (rank >= t.ranks) return 'Maxed';
  if (pointsLeft(save) <= 0) return 'No talent points';
  if (t.capstone && save.captain.focus !== t.tree) return `Capstone of the ${TREES[t.tree].name} focus`;
  const need = tierOpenAt(t.tier);
  if (treePoints(save, t.tree) < need) return `Needs ${need} points in ${TREES[t.tree].name}`;
  return null;
}

// The sum of one effect across all talents and the focus perk. 0 for Lite saves.
export function talent(save, effect) {
  if (!isCaptain(save)) return 0;
  let total = 0;
  for (const [id, rank] of Object.entries(save.captain.talents ?? {})) {
    const t = TALENTS[id];
    if (t && t.effect === effect) total += t.per * rank;
  }
  const focus = FOCUSES[save.captain.focus];
  if (focus?.perLevel?.[effect]) total += focus.perLevel[effect] * Math.min(CAPTAIN_MAX_LEVEL, save.level ?? 1);
  return total;
}

export const hasTalent = (save, id) => (save?.captain?.talents?.[id] ?? 0) > 0;
