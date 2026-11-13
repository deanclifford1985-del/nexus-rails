// The rank ladder. A rank needs career experience and sometimes a story milestone (`needs` names a
// flag in save.story.flags). `squad` is how many soldiers you may lead, `tier` the quartermaster
// shelf it opens, `supports` the assets you can call in the field.

export const RANKS = [
  {
    id: 'rct',
    abbr: 'RCT',
    name: 'Recruit',
    xp: 0,
    squad: 0,
    tier: 0,
    pay: 0,
    insignia: { kind: 'none' },
    duty: 'Finish basic training.',
  },
  {
    id: 'pvt',
    abbr: 'PVT',
    name: 'Private',
    xp: 0,
    needs: 'graduated',
    squad: 0,
    tier: 1,
    pay: 1,
    insignia: { kind: 'chevron', chevrons: 1 },
    duty: 'Follow orders. You deploy as part of someone else’s squad.',
  },
  {
    id: 'pfc',
    abbr: 'PFC',
    name: 'Private First Class',
    xp: 300,
    squad: 0,
    tier: 1,
    pay: 1.05,
    insignia: { kind: 'chevron', chevrons: 1, rockers: 1 },
    duty: 'Trusted with recon and solo tasks.',
  },
  {
    id: 'cpl',
    abbr: 'CPL',
    name: 'Corporal',
    xp: 900,
    squad: 1,
    tier: 2,
    pay: 1.1,
    insignia: { kind: 'chevron', chevrons: 2 },
    duty: 'Lead a buddy team: one soldier under your command.',
  },
  {
    id: 'sgt',
    abbr: 'SGT',
    name: 'Sergeant',
    xp: 2200,
    squad: 3,
    tier: 2,
    pay: 1.2,
    insignia: { kind: 'chevron', chevrons: 3 },
    duty: 'Lead a fire team of three.',
  },
  {
    id: 'ssg',
    abbr: 'SSG',
    name: 'Staff Sergeant',
    xp: 4500,
    squad: 4,
    tier: 3,
    pay: 1.3,
    insignia: { kind: 'chevron', chevrons: 3, rockers: 1 },
    duty: 'Lead a squad of four.',
  },
  {
    id: 'sfc',
    abbr: 'SFC',
    name: 'Sergeant First Class',
    xp: 8000,
    squad: 5,
    tier: 3,
    pay: 1.4,
    supports: ['mortar'],
    insignia: { kind: 'chevron', chevrons: 3, rockers: 2 },
    duty: 'Lead a squad of five and call mortar fire.',
  },
  {
    id: 'msg',
    abbr: 'MSG',
    name: 'Master Sergeant',
    xp: 12500,
    squad: 6,
    tier: 4,
    pay: 1.5,
    supports: ['mortar', 'resupply'],
    insignia: { kind: 'chevron', chevrons: 3, rockers: 3 },
    duty: 'Lead a squad of six. Supply drops on call.',
  },
  {
    id: '2lt',
    abbr: '2LT',
    name: 'Second Lieutenant',
    xp: 18000,
    needs: 'commissioned',
    squad: 7,
    tier: 4,
    pay: 1.7,
    supports: ['mortar', 'resupply', 'uav'],
    insignia: { kind: 'bar', bars: 1, metal: 'gold' },
    duty: 'A commission. Lead a full squad of seven with drone reconnaissance.',
  },
  {
    id: '1lt',
    abbr: '1LT',
    name: 'First Lieutenant',
    xp: 26000,
    squad: 7,
    tier: 5,
    pay: 1.9,
    supports: ['mortar', 'resupply', 'uav', 'overwatch'],
    insignia: { kind: 'bar', bars: 1, metal: 'silver' },
    duty: 'Sniper overwatch joins your operations.',
  },
  {
    id: 'cpt',
    abbr: 'CPT',
    name: 'Captain',
    xp: 36000,
    squad: 7,
    tier: 5,
    pay: 2.1,
    supports: ['mortar', 'resupply', 'uav', 'overwatch', 'airstrike'],
    insignia: { kind: 'bar', bars: 2, metal: 'silver' },
    duty: 'Company command. Air strikes on your word.',
  },
  {
    id: 'maj',
    abbr: 'MAJ',
    name: 'Major',
    xp: 50000,
    squad: 7,
    tier: 5,
    pay: 2.4,
    supports: ['mortar', 'resupply', 'uav', 'overwatch', 'airstrike', 'bravo'],
    insignia: { kind: 'leaf', metal: 'gold' },
    duty: 'A second team, Bravo, deploys alongside yours.',
  },
  {
    id: 'ltc',
    abbr: 'LTC',
    name: 'Lieutenant Colonel',
    xp: 68000,
    squad: 7,
    tier: 5,
    pay: 2.7,
    supports: ['mortar', 'resupply', 'uav', 'overwatch', 'airstrike', 'bravo'],
    insignia: { kind: 'leaf', metal: 'silver' },
    duty: 'Battalion command. Support comes faster and hits harder.',
  },
  {
    id: 'col',
    abbr: 'COL',
    name: 'Colonel',
    xp: 90000,
    squad: 7,
    tier: 5,
    pay: 3,
    supports: ['mortar', 'resupply', 'uav', 'overwatch', 'airstrike', 'bravo'],
    insignia: { kind: 'eagle', metal: 'silver' },
    duty: 'The island’s defence is yours to run.',
  },
];

export const RANK_INDEX = Object.fromEntries(RANKS.map((r, i) => [r.id, i]));
export const rankOf = (save) => RANKS[save.rank] ?? RANKS[0];
export const rankAt = (index) => RANKS[Math.max(0, Math.min(RANKS.length - 1, index))];

// The highest rank this soldier has earned but not yet been given, or null.
export function promotionDue(save) {
  let due = null;
  for (let i = save.rank + 1; i < RANKS.length; i++) {
    const rank = RANKS[i];
    if (save.xp < rank.xp) break;
    if (rank.needs && !save.story?.flags?.[rank.needs]) break;
    due = i;
  }
  return due;
}

// What stands between this soldier and the next rank: { rank, xpLeft, needs } or null at the top.
export function nextRankGap(save) {
  const rank = RANKS[save.rank + 1];
  if (!rank) return null;
  return { rank, xpLeft: Math.max(0, rank.xp - save.xp), needs: rank.needs && !save.story?.flags?.[rank.needs] ? rank.needs : null };
}

export const SUPPORTS = {
  mortar: { id: 'mortar', name: 'Mortar strike', text: 'Six rounds on the point you mark. Lands after a short delay.', cooldown: 150 },
  resupply: { id: 'resupply', name: 'Supply drop', text: 'A crate of ammunition, medkits and grenades at your position.', cooldown: 240 },
  uav: { id: 'uav', name: 'Recon drone', text: 'Tags every enemy within 150 m for a while.', cooldown: 180 },
  overwatch: { id: 'overwatch', name: 'Sniper overwatch', text: 'A sniper team picks off enemies you have tagged.', cooldown: 300 },
  airstrike: { id: 'airstrike', name: 'Air strike', text: 'A line of heavy bombs along your line of sight.', cooldown: 420 },
  bravo: { id: 'bravo', name: 'Bravo team', text: 'A second four-man team inserts at your position.', cooldown: 600 },
};
