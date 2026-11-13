// The seven specializations a recruit can choose at intake. Each adds to a handful of attributes,
// makes those attributes improve faster with practice (affinity), issues a starting kit and carries
// one perk that the rules and the simulation read with hasPerk(save, id).

export const SPECS = [
  {
    id: 'rifleman',
    name: 'Rifleman',
    branch: 'Infantry',
    blurb: 'The backbone of every squad. Steady aim, strong legs and the stamina to still be standing at the end.',
    bonuses: { accuracy: 8, endurance: 6, toughness: 6, strength: 4, quickness: 4 },
    affinity: ['accuracy', 'endurance', 'toughness'],
    kit: {
      primary: { id: 'm6', att: { optic: 'reddot' } },
      secondary: { id: 'p9', att: {} },
      gear: { helmet: 'field', vest: 'flak', uniform: 'bdu', boots: 'issue', gloves: null, pack: null, deviceA: 'binoc', deviceB: null },
      items: { medkit: 1, bandage: 2, frag: 2 },
    },
    perk: { id: 'fire_discipline', name: 'Fire Discipline', text: 'Sustained fire spreads 30% less, and carbines and battle rifles hit 10% harder.' },
  },
  {
    id: 'marksman',
    name: 'Marksman',
    branch: 'Scout Sniper',
    blurb: 'One round, one target, from further away than anyone thought to look.',
    bonuses: { scope: 10, vision: 8, accuracy: 6, stealth: 3, perception: 3 },
    affinity: ['scope', 'vision', 'accuracy'],
    kit: {
      primary: { id: 'longbow', att: { optic: 'acog4' } },
      secondary: { id: 'p9', att: {} },
      gear: { helmet: null, vest: 'rig', uniform: 'woodland', boots: 'issue', gloves: null, pack: null, deviceA: 'binoc', deviceB: null },
      items: { medkit: 1, bandage: 2, smoke: 1 },
    },
    perk: { id: 'one_shot', name: 'One Shot', text: 'The first round from a settled scope hits 35% harder, and you hold your breath half as long again.' },
  },
  {
    id: 'recon',
    name: 'Recon Scout',
    branch: 'Reconnaissance',
    blurb: 'First in, never seen. You move fast, climb what others walk around and notice what others miss.',
    bonuses: { stealth: 9, speed: 6, perception: 6, climbing: 4, vision: 3, quickness: 2 },
    affinity: ['stealth', 'perception', 'speed'],
    kit: {
      primary: { id: 'viper', att: { muzzle: 'suppressor' } },
      secondary: { id: 'p9', att: {} },
      gear: { helmet: null, vest: 'rig', uniform: 'woodland', boots: 'stalker', gloves: null, pack: null, deviceA: 'binoc', deviceB: null },
      items: { medkit: 1, bandage: 2, smoke: 1, flash: 1 },
    },
    perk: { id: 'shadow', name: 'Shadow', text: 'Crouched or prone you are 25% harder to notice, takedowns are twice as fast and enemies you tag stay tagged twice as long.' },
  },
  {
    id: 'medic',
    name: 'Combat Medic',
    branch: 'Medical Corps',
    blurb: 'The reason people come home. You fight like the rest and then you keep them alive.',
    bonuses: { medicine: 12, intelligence: 6, endurance: 5, communication: 4, toughness: 3 },
    affinity: ['medicine', 'intelligence', 'endurance'],
    kit: {
      primary: { id: 'm6', att: {} },
      secondary: { id: 'p9', att: {} },
      gear: { helmet: 'field', vest: 'rig', uniform: 'bdu', boots: 'issue', gloves: null, pack: 'medbag', deviceA: 'binoc', deviceB: null },
      items: { medkit: 3, bandage: 4, smoke: 1 },
    },
    perk: { id: 'lifesaver', name: 'Lifesaver', text: 'Medkits and bandages heal half as much again, you revive twice as fast and your squad slowly recovers between fights.' },
  },
  {
    id: 'engineer',
    name: 'Combat Engineer',
    branch: 'Sappers',
    blurb: 'Walls are suggestions. You breach, build, mine and disarm.',
    bonuses: { engineering: 12, strength: 6, intelligence: 5, climbing: 4, toughness: 3 },
    affinity: ['engineering', 'strength', 'intelligence'],
    kit: {
      primary: { id: 'breacher', att: {} },
      secondary: { id: 'p9', att: {} },
      gear: { helmet: 'field', vest: 'flak', uniform: 'bdu', boots: 'issue', gloves: null, pack: 'sapper', deviceA: 'binoc', deviceB: null },
      items: { medkit: 1, bandage: 2, frag: 3, mine: 1 },
    },
    perk: { id: 'sapper', name: 'Sapper', text: 'Your explosives reach 30% further, charges go down in half the time and you carry two more of everything that goes bang.' },
  },
  {
    id: 'gunner',
    name: 'Heavy Gunner',
    branch: 'Weapons Platoon',
    blurb: 'You carry the gun that makes everyone else keep their heads down.',
    bonuses: { strength: 9, toughness: 8, endurance: 7, accuracy: 4 },
    affinity: ['strength', 'toughness', 'endurance'],
    kit: {
      primary: { id: 'bulldog', att: {} },
      secondary: { id: 'p9', att: {} },
      gear: { helmet: 'field', vest: 'flak', uniform: 'bdu', boots: 'issue', gloves: null, pack: null, deviceA: 'binoc', deviceB: null },
      items: { medkit: 1, bandage: 2, frag: 2 },
    },
    perk: { id: 'walking_fire', name: 'Walking Fire', text: 'Machine guns and shotguns kick 30% less, enemies you pin stay pinned longer and you have 25 more health.' },
  },
  {
    id: 'leader',
    name: 'Squad Leader',
    branch: 'Command Track',
    blurb: 'You were giving directions before you got off the bus. Your squad shoots straighter because you are there.',
    bonuses: { leadership: 10, communication: 8, negotiating: 6, intelligence: 4, accuracy: 2 },
    affinity: ['leadership', 'communication', 'negotiating'],
    kit: {
      primary: { id: 'm6', att: { optic: 'reddot' } },
      secondary: { id: 'p9', att: {} },
      gear: { helmet: 'field', vest: 'flak', uniform: 'bdu', boots: 'issue', gloves: null, pack: null, deviceA: 'binoc', deviceB: 'radio' },
      items: { medkit: 1, bandage: 2, frag: 1, smoke: 1 },
    },
    perk: { id: 'born_leader', name: 'Born Leader', text: 'Your squad bonuses are a quarter stronger, you lead one more soldier than your rank allows and support calls recharge 20% faster.' },
  },
];

const BY_ID = Object.fromEntries(SPECS.map((s) => [s.id, s]));
export const specOf = (id) => BY_ID[id] ?? null;
export const hasPerk = (save, perkId) => specOf(save?.spec)?.perk.id === perkId;
