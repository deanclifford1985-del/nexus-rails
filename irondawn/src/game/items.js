// Everything the quartermaster stocks: weapons, attachments, gear and consumables.
// `rank` is the index in RANKS needed to buy it; `tier` is the shelf (shown as a quality colour).
//
// Weapon numbers (before attachments and skill):
//   damage per round (or pellet), rpm, magazine, reload seconds, spread in degrees when aimed and
//   still, recoil in degrees per shot, range = effective metres (damage falls off past it),
//   noise = metres an unsuppressed shot carries, weight in kg, zoom with iron sights.

export const WEAPON_CLASSES = {
  pistol: { name: 'Pistol', slot: 'secondary' },
  smg: { name: 'SMG', slot: 'primary' },
  carbine: { name: 'Carbine', slot: 'primary' },
  rifle: { name: 'Battle rifle', slot: 'primary' },
  dmr: { name: 'Marksman rifle', slot: 'primary' },
  sniper: { name: 'Sniper rifle', slot: 'primary' },
  shotgun: { name: 'Shotgun', slot: 'primary' },
  lmg: { name: 'Machine gun', slot: 'primary' },
};

const ALL_SLOTS = ['optic', 'muzzle', 'under', 'mag'];

export const WEAPONS = {
  p9: {
    id: 'p9', name: 'P9 Sidearm', class: 'pistol', tier: 1, rank: 0, price: 150,
    damage: 24, rpm: 330, auto: false, mag: 15, reserve: 60, reload: 1.5, spread: 1.4, recoil: 1.1, range: 40, noise: 70, weight: 1.0, zoom: 1.2,
    slots: ['optic', 'muzzle', 'mag'],
    blurb: 'Standard issue. It works, which is the kindest thing anyone says about it.',
  },
  ravager: {
    id: 'ravager', name: 'Ravager .45', class: 'pistol', tier: 3, rank: 4, price: 900,
    damage: 40, rpm: 270, auto: false, mag: 10, reserve: 50, reload: 1.7, spread: 1.15, recoil: 1.6, range: 50, noise: 80, weight: 1.3, zoom: 1.2,
    slots: ['optic', 'muzzle', 'mag'],
    blurb: 'A heavy pistol that ends arguments at close range.',
  },
  viper: {
    id: 'viper', name: 'Viper SMG', class: 'smg', tier: 1, rank: 1, price: 600,
    damage: 19, rpm: 800, auto: true, mag: 30, reserve: 180, reload: 2.0, spread: 2.1, recoil: 0.7, range: 45, noise: 80, weight: 2.6, zoom: 1.3,
    slots: ALL_SLOTS,
    blurb: 'Light, fast and happiest inside a building.',
  },
  wraith: {
    id: 'wraith', name: 'Wraith SD', class: 'smg', tier: 3, rank: 4, price: 2400,
    damage: 22, rpm: 760, auto: true, mag: 30, reserve: 180, reload: 1.9, spread: 1.6, recoil: 0.6, range: 55, noise: 16, weight: 2.9, zoom: 1.3,
    slots: ['optic', 'under', 'mag'], quiet: true,
    blurb: 'Built around its own suppressor. The loudest part is the bolt.',
  },
  m6: {
    id: 'm6', name: 'M6 Carbine', class: 'carbine', tier: 1, rank: 1, price: 800,
    damage: 27, rpm: 650, auto: true, mag: 30, reserve: 180, reload: 2.3, spread: 1.5, recoil: 1.0, range: 110, noise: 120, weight: 3.3, zoom: 1.4,
    slots: ALL_SLOTS,
    blurb: 'The rifle every recruit learns on. Does everything adequately.',
  },
  warden: {
    id: 'warden', name: 'Warden Mk2', class: 'carbine', tier: 3, rank: 5, price: 3200,
    damage: 33, rpm: 700, auto: true, mag: 30, reserve: 210, reload: 2.2, spread: 1.2, recoil: 0.9, range: 140, noise: 120, weight: 3.4, zoom: 1.4,
    slots: ALL_SLOTS,
    blurb: 'A free-floated barrel and a better trigger. The M6 grown up.',
  },
  spectre: {
    id: 'spectre', name: 'Spectre ACR', class: 'carbine', tier: 5, rank: 8, price: 9000,
    damage: 40, rpm: 760, auto: true, mag: 35, reserve: 245, reload: 2.0, spread: 0.95, recoil: 0.8, range: 170, noise: 115, weight: 3.2, zoom: 1.4,
    slots: ALL_SLOTS,
    blurb: 'Issued to officers and special units. Flat, fast and frighteningly accurate.',
  },
  thunder: {
    id: 'thunder', name: 'Thunder BR', class: 'rifle', tier: 3, rank: 5, price: 3800,
    damage: 48, rpm: 420, auto: true, mag: 20, reserve: 140, reload: 2.6, spread: 1.3, recoil: 1.7, range: 220, noise: 140, weight: 4.4, zoom: 1.5,
    slots: ALL_SLOTS,
    blurb: 'A full-power battle rifle. Hits like its name and kicks like it too.',
  },
  longbow: {
    id: 'longbow', name: 'Longbow DMR', class: 'dmr', tier: 2, rank: 2, price: 1500,
    damage: 56, rpm: 240, auto: false, mag: 10, reserve: 80, reload: 2.6, spread: 0.55, recoil: 1.6, range: 320, noise: 140, weight: 4.6, zoom: 1.5,
    slots: ALL_SLOTS,
    blurb: 'Semi-automatic and precise out to the far treeline.',
  },
  talon: {
    id: 'talon', name: 'Talon DMR', class: 'dmr', tier: 4, rank: 7, price: 5200,
    damage: 74, rpm: 280, auto: false, mag: 15, reserve: 105, reload: 2.4, spread: 0.4, recoil: 1.4, range: 420, noise: 135, weight: 4.8, zoom: 1.5,
    slots: ALL_SLOTS,
    blurb: 'Match barrel, match trigger. A sniper rifle that does not make you wait.',
  },
  ridgeline: {
    id: 'ridgeline', name: 'Ridgeline .308', class: 'sniper', tier: 2, rank: 3, price: 2200,
    damage: 115, rpm: 42, auto: false, bolt: true, mag: 5, reserve: 40, reload: 3.2, spread: 0.18, recoil: 2.6, range: 550, noise: 160, weight: 5.6, zoom: 1.5,
    slots: ALL_SLOTS,
    blurb: 'A bolt-action that has been putting rounds through the same hole for sixty years.',
  },
  reaper: {
    id: 'reaper', name: 'Reaper .338', class: 'sniper', tier: 4, rank: 6, price: 6000,
    damage: 170, rpm: 38, auto: false, bolt: true, mag: 5, reserve: 40, reload: 3.4, spread: 0.12, recoil: 3.0, range: 800, noise: 170, weight: 6.8, zoom: 1.5,
    slots: ALL_SLOTS,
    blurb: 'Reaches across valleys. Body armour is an inconvenience to it.',
  },
  leviathan: {
    id: 'leviathan', name: 'Leviathan .50', class: 'sniper', tier: 5, rank: 9, price: 12000,
    damage: 270, rpm: 30, auto: false, bolt: true, mag: 5, reserve: 30, reload: 3.8, spread: 0.1, recoil: 4.0, range: 1100, noise: 220, weight: 12, zoom: 1.5, pierce: 0.6,
    slots: ['optic', 'under', 'mag'],
    blurb: 'An anti-materiel rifle. What it hits stops being a problem.',
  },
  breacher: {
    id: 'breacher', name: 'Breacher 12', class: 'shotgun', tier: 1, rank: 1, price: 700,
    damage: 14, pellets: 8, rpm: 70, auto: false, mag: 6, reserve: 42, reload: 3.0, spread: 5.5, recoil: 2.4, range: 22, noise: 110, weight: 3.4, zoom: 1.2,
    slots: ['optic', 'under', 'mag'],
    blurb: 'Pump-action. Opens doors and settles whatever was behind them.',
  },
  mauler: {
    id: 'mauler', name: 'Mauler Auto-12', class: 'shotgun', tier: 4, rank: 6, price: 5000,
    damage: 15, pellets: 8, rpm: 240, auto: true, mag: 8, reserve: 56, reload: 2.8, spread: 5.0, recoil: 2.0, range: 26, noise: 115, weight: 4.6, zoom: 1.2,
    slots: ['optic', 'under', 'mag'],
    blurb: 'A drum-fed automatic shotgun for clearing rooms in a hurry.',
  },
  bulldog: {
    id: 'bulldog', name: 'Bulldog LMG', class: 'lmg', tier: 2, rank: 2, price: 1800,
    damage: 30, rpm: 720, auto: true, mag: 100, reserve: 300, reload: 5.2, spread: 2.0, recoil: 1.2, range: 160, noise: 150, weight: 7.5, zoom: 1.4,
    slots: ['optic', 'under', 'mag'],
    blurb: 'A belt of a hundred rounds and no reason to stop.',
  },
  juggernaut: {
    id: 'juggernaut', name: 'Juggernaut MMG', class: 'lmg', tier: 4, rank: 7, price: 6500,
    damage: 44, rpm: 650, auto: true, mag: 150, reserve: 450, reload: 6.0, spread: 1.8, recoil: 1.5, range: 240, noise: 165, weight: 10.5, zoom: 1.4,
    slots: ['optic', 'under', 'mag'],
    blurb: 'A medium machine gun somebody decided one soldier could carry. Bring strength.',
  },
};

// Attachment mods multiply the weapon's numbers, except zoom (replaces) and magAdd (adds a share).
export const ATTACHMENT_SLOTS = { optic: 'Optic', muzzle: 'Muzzle', under: 'Underbarrel', mag: 'Magazine' };

export const ATTACHMENTS = {
  reddot: {
    id: 'reddot', name: 'Red Dot Sight', slot: 'optic', tier: 1, rank: 1, price: 250, fits: ['pistol', 'smg', 'carbine', 'rifle', 'shotgun', 'lmg'],
    mods: { zoom: 1.5, spread: 0.9, ads: 0.9 }, text: 'Faster to the eye and a little tighter.',
  },
  holo: {
    id: 'holo', name: 'Holographic Sight', slot: 'optic', tier: 2, rank: 3, price: 600, fits: ['smg', 'carbine', 'rifle', 'shotgun', 'lmg'],
    mods: { zoom: 1.7, spread: 0.84, ads: 0.85 }, text: 'A wide window and a crisp ring.',
  },
  acog4: {
    id: 'acog4', name: '4× Combat Scope', slot: 'optic', tier: 2, rank: 2, price: 900, fits: ['carbine', 'rifle', 'dmr', 'lmg'],
    mods: { zoom: 4, scoped: true, spread: 0.8, ads: 1.15 }, text: 'Reach for a rifle without slowing it much.',
  },
  scope6: {
    id: 'scope6', name: '6× Marksman Scope', slot: 'optic', tier: 2, rank: 3, price: 1500, fits: ['rifle', 'dmr', 'sniper'],
    mods: { zoom: 6, scoped: true, spread: 0.75, ads: 1.25 }, text: 'The usual glass on a marksman rifle.',
  },
  scope10: {
    id: 'scope10', name: '10× Sniper Scope', slot: 'optic', tier: 3, rank: 5, price: 3000, fits: ['dmr', 'sniper'],
    mods: { zoom: 10, scoped: true, spread: 0.7, ads: 1.4 }, text: 'Faces at four hundred metres.',
  },
  scope16: {
    id: 'scope16', name: '4–16× Variable Scope', slot: 'optic', tier: 4, rank: 7, price: 6500, fits: ['sniper', 'dmr'],
    mods: { zoom: 16, zooms: [4, 8, 16], scoped: true, spread: 0.65, ads: 1.5 }, text: 'Three magnifications on the scroll wheel.',
  },
  thermal: {
    id: 'thermal', name: 'Thermal Scope', slot: 'optic', tier: 5, rank: 8, price: 9000, fits: ['carbine', 'rifle', 'dmr', 'sniper', 'lmg'],
    mods: { zoom: 6, scoped: true, thermal: true, spread: 0.78, ads: 1.4 }, text: 'Bodies glow, day or night, in brush or out of it.',
  },
  suppressor: {
    id: 'suppressor', name: 'Suppressor', slot: 'muzzle', tier: 2, rank: 2, price: 1200, fits: ['pistol', 'smg', 'carbine', 'rifle', 'dmr', 'sniper'],
    mods: { noise: 0.14, damage: 0.95, range: 0.92 }, text: 'A shot carries a seventh as far. Costs a little punch.',
  },
  compensator: {
    id: 'compensator', name: 'Compensator', slot: 'muzzle', tier: 1, rank: 1, price: 450, fits: ['pistol', 'smg', 'carbine', 'rifle', 'dmr', 'lmg'],
    mods: { recoil: 0.78, noise: 1.1 }, text: 'Vents gas upward to hold the muzzle down. Louder.',
  },
  heavybarrel: {
    id: 'heavybarrel', name: 'Heavy Barrel', slot: 'muzzle', tier: 3, rank: 4, price: 1600, fits: ['carbine', 'rifle', 'dmr', 'sniper', 'lmg'],
    mods: { range: 1.22, damage: 1.06, weight: 0.7 }, text: 'More reach and a touch more damage, for the weight.',
  },
  foregrip: {
    id: 'foregrip', name: 'Vertical Foregrip', slot: 'under', tier: 1, rank: 1, price: 400, fits: ['smg', 'carbine', 'rifle', 'shotgun', 'lmg'],
    mods: { recoil: 0.85, hip: 0.92 }, text: 'Something to hold on to.',
  },
  laser: {
    id: 'laser', name: 'Laser Module', slot: 'under', tier: 2, rank: 2, price: 500, fits: ['pistol', 'smg', 'carbine', 'rifle', 'shotgun'],
    mods: { hip: 0.7 }, text: 'Hip fire lands much closer to where you are looking.',
  },
  bipod: {
    id: 'bipod', name: 'Bipod', slot: 'under', tier: 2, rank: 3, price: 700, fits: ['rifle', 'dmr', 'sniper', 'lmg'],
    mods: { bipod: true }, text: 'Crouched still or prone: half the recoil and half the sway.',
  },
  extmag: {
    id: 'extmag', name: 'Extended Magazine', slot: 'mag', tier: 2, rank: 2, price: 600, fits: ['pistol', 'smg', 'carbine', 'rifle', 'dmr', 'sniper', 'shotgun', 'lmg'],
    mods: { mag: 1.4, reload: 1.08 }, text: 'Two-fifths more rounds before the click.',
  },
  fastmag: {
    id: 'fastmag', name: 'Quick-Release Magazine', slot: 'mag', tier: 2, rank: 3, price: 500, fits: ['pistol', 'smg', 'carbine', 'rifle', 'dmr', 'sniper', 'lmg'],
    mods: { reload: 0.75 }, text: 'A quarter off every reload.',
  },
  apmag: {
    id: 'apmag', name: 'Armour-Piercing Rounds', slot: 'mag', tier: 4, rank: 6, price: 2500, fits: ['pistol', 'smg', 'carbine', 'rifle', 'dmr', 'sniper', 'lmg'],
    mods: { pierce: 0.5, damage: 1.05 }, text: 'Ignores half of whatever armour the target is wearing.',
  },
};

// Gear. `attrs` adds to attributes; the other keys go straight into deriveStats.
export const GEAR_SLOTS = {
  helmet: 'Helmet',
  vest: 'Body armour',
  uniform: 'Uniform',
  boots: 'Boots',
  gloves: 'Gloves',
  pack: 'Pack',
  deviceA: 'Kit slot 1',
  deviceB: 'Kit slot 2',
};
export const slotKind = (slot) => (slot === 'deviceA' || slot === 'deviceB' ? 'device' : slot);

export const GEAR = {
  // helmets
  field: { id: 'field', name: 'Field Helmet', kind: 'helmet', tier: 1, rank: 1, price: 300, weight: 1.4, armorHead: 0.25, text: 'Stops fragments and the occasional lucky round.' },
  combat: { id: 'combat', name: 'Advanced Combat Helmet', kind: 'helmet', tier: 3, rank: 4, price: 1400, weight: 1.5, armorHead: 0.4, text: 'Lighter weave, better coverage.' },
  raider: {
    id: 'raider', name: 'Raider Helmet with Comms', kind: 'helmet', tier: 4, rank: 6, price: 3500, weight: 1.6, armorHead: 0.35, attrs: { communication: 8, perception: 3 },
    text: 'High-cut with a built-in headset. You hear your squad and the world.',
  },
  // vests
  rig: { id: 'rig', name: 'Chest Rig', kind: 'vest', tier: 1, rank: 0, price: 150, weight: 1.2, armor: 0.06, ammo: 1.15, text: 'Magazines where you can reach them. Stops nothing.' },
  flak: { id: 'flak', name: 'Flak Vest', kind: 'vest', tier: 1, rank: 1, price: 500, weight: 4.5, armor: 0.2, text: 'Soft armour. Better than a shirt.' },
  plate: { id: 'plate', name: 'Plate Carrier', kind: 'vest', tier: 2, rank: 3, price: 1800, weight: 7, armor: 0.33, text: 'Ceramic plates front and back.' },
  reconrig: {
    id: 'reconrig', name: 'Recon Rig', kind: 'vest', tier: 3, rank: 4, price: 2600, weight: 2.5, armor: 0.14, attrs: { stealth: 5 }, noise: 0.9,
    text: 'Slim, taped down, silent. Light protection for people who plan not to be shot at.',
  },
  heavy: {
    id: 'heavy', name: 'Heavy Assault Armour', kind: 'vest', tier: 4, rank: 6, price: 4500, weight: 12, armor: 0.48, speed: 0.94, health: 20,
    text: 'Plates, collar, groin guard. You become the cover.',
  },
  // uniforms
  bdu: { id: 'bdu', name: 'Standard Fatigues', kind: 'uniform', tier: 1, rank: 0, price: 0, weight: 0, text: 'Olive drab. Fits nobody.' },
  woodland: { id: 'woodland', name: 'Woodland Camouflage', kind: 'uniform', tier: 1, rank: 1, price: 400, weight: 0, attrs: { stealth: 4 }, text: 'Breaks up your outline against the trees.' },
  nightops: {
    id: 'nightops', name: 'Night Ops Blacks', kind: 'uniform', tier: 3, rank: 4, price: 2200, weight: 0, attrs: { stealth: 4 }, nightStealth: 0.12,
    text: 'Matte black. Useful by day, nearly invisible after dark.',
  },
  ghillie: {
    id: 'ghillie', name: 'Ghillie Suit', kind: 'uniform', tier: 3, rank: 3, price: 2800, weight: 3, attrs: { stealth: 14 }, speed: 0.96,
    text: 'You are a bush. Bushes are not fast.',
  },
  // boots
  issue: { id: 'issue', name: 'Issue Boots', kind: 'boots', tier: 1, rank: 0, price: 0, weight: 0, text: 'Break them in or they break you.' },
  trail: { id: 'trail', name: 'Trail Runners', kind: 'boots', tier: 2, rank: 2, price: 700, weight: 0, attrs: { speed: 5, endurance: 3 }, text: 'Light on the foot over long ground.' },
  mountain: { id: 'mountain', name: 'Mountain Boots', kind: 'boots', tier: 2, rank: 2, price: 900, weight: 0.4, attrs: { climbing: 10 }, text: 'Stiff soles that bite into rock.' },
  stalker: { id: 'stalker', name: 'Soft-Sole Stalkers', kind: 'boots', tier: 2, rank: 1, price: 1100, weight: 0, attrs: { stealth: 5 }, noise: 0.8, text: 'A fifth less footfall.' },
  // gloves
  shooting: { id: 'shooting', name: 'Shooting Gloves', kind: 'gloves', tier: 2, rank: 2, price: 500, weight: 0, attrs: { accuracy: 3, quickness: 2 }, text: 'Thin palms, sure trigger finger.' },
  grip: { id: 'grip', name: 'Grip Gloves', kind: 'gloves', tier: 2, rank: 2, price: 600, weight: 0, attrs: { climbing: 8 }, text: 'Rubberised palms for rope and rock.' },
  // packs
  assault: { id: 'assault', name: 'Assault Pack', kind: 'pack', tier: 1, rank: 1, price: 500, weight: 1, carry: 10, ammo: 1.25, text: 'A day’s worth of ammunition on your back.' },
  ruck: { id: 'ruck', name: 'Field Ruck', kind: 'pack', tier: 2, rank: 3, price: 1200, weight: 2, carry: 22, ammo: 1.5, speed: 0.97, extra: { frag: 1, medkit: 1 }, text: 'Carries half the armoury. You will feel it.' },
  medbag: { id: 'medbag', name: 'Medic Bag', kind: 'pack', tier: 2, rank: 1, price: 1400, weight: 1.5, attrs: { medicine: 8 }, extra: { medkit: 2, bandage: 2 }, text: 'Room for two more medkits and a steadier hand with them.' },
  sapper: { id: 'sapper', name: 'Sapper Satchel', kind: 'pack', tier: 2, rank: 1, price: 1400, weight: 1.5, attrs: { engineering: 8 }, extra: { frag: 1, mine: 2 }, text: 'Charges, wire and somewhere to keep them dry.' },
  // devices (two kit slots)
  binoc: { id: 'binoc', name: 'Binoculars', kind: 'device', tier: 1, rank: 0, price: 100, weight: 0.6, enables: 'binoc', text: 'Hold on a soldier to tag him for yourself and your squad.' },
  rangefinder: {
    id: 'rangefinder', name: 'Rangefinder Binoculars', kind: 'device', tier: 3, rank: 4, price: 1800, weight: 0.8, enables: 'binoc', rangefinder: true, attrs: { vision: 8 },
    text: 'Reads the distance to whatever you are looking at and tags faster.',
  },
  nvg: { id: 'nvg', name: 'Night Vision Goggles', kind: 'device', tier: 3, rank: 3, price: 2000, weight: 0.6, enables: 'nvg', text: 'The night turns green and stops hiding people from you.' },
  radio: { id: 'radio', name: 'Long-Range Radio', kind: 'device', tier: 2, rank: 2, price: 900, weight: 2.2, attrs: { communication: 10 }, commandRange: 1.5, text: 'Your orders carry half as far again.' },
  tracker: { id: 'tracker', name: 'Tracker Kit', kind: 'device', tier: 2, rank: 2, price: 1100, weight: 0.4, tracking: 12, text: 'Powder, tape and patience. Tracks last longer and read clearer.' },
  tablet: { id: 'tablet', name: 'Tactical Tablet', kind: 'device', tier: 3, rank: 5, price: 2400, weight: 0.5, planning: 12, text: 'Imagery and overlays for the briefing table.' },
  climbkit: { id: 'climbkit', name: 'Climbing Kit', kind: 'device', tier: 2, rank: 2, price: 1000, weight: 1.5, attrs: { climbing: 6 }, mantle: 0.8, text: 'A hook and a line. Walls get 0.8 m shorter.' },
  drone: { id: 'drone', name: 'Pocket Drone', kind: 'device', tier: 4, rank: 6, price: 4200, weight: 0.8, enables: 'drone', text: 'Tags everyone within 80 m. Needs a minute to recharge.' },
};

// Consumables. `carry` is how many fit before packs add room.
export const ITEMS = {
  medkit: { id: 'medkit', name: 'Medkit', price: 120, rank: 0, carry: 2, weight: 0.6, key: 'H', text: 'A proper dressing. Restores a large share of health.' },
  bandage: { id: 'bandage', name: 'Bandage', price: 35, rank: 0, carry: 4, weight: 0.1, key: 'J', text: 'Quick and small. Stops the worst of it.' },
  frag: { id: 'frag', name: 'Frag Grenade', price: 90, rank: 1, carry: 3, weight: 0.4, throwable: true, text: 'Lethal out to eight metres.' },
  smoke: { id: 'smoke', name: 'Smoke Grenade', price: 60, rank: 1, carry: 2, weight: 0.4, throwable: true, text: 'Nobody sees through it, you included.' },
  flash: { id: 'flash', name: 'Flashbang', price: 80, rank: 2, carry: 2, weight: 0.3, throwable: true, text: 'Blinds and deafens for a few seconds.' },
  mine: { id: 'mine', name: 'Proximity Mine', price: 150, rank: 2, carry: 2, weight: 1.2, placeable: true, text: 'Goes off when an enemy walks within three metres.' },
  stim: { id: 'stim', name: 'Stim Injector', price: 140, rank: 3, carry: 2, weight: 0.1, key: 'K', text: 'Refills stamina and lifts your speed for twenty seconds.' },
};

export const THROWABLES = ['frag', 'smoke', 'flash', 'mine'];
export const TIER_NAMES = ['Issue', 'Standard', 'Improved', 'Advanced', 'Elite', 'Prototype'];

export const weaponDef = (id) => WEAPONS[id] ?? null;
export const attachmentDef = (id) => ATTACHMENTS[id] ?? null;
export const gearDef = (id) => GEAR[id] ?? null;
export const itemDef = (id) => ITEMS[id] ?? null;

export const attachmentFits = (attachmentId, weaponId) => {
  const att = ATTACHMENTS[attachmentId];
  const weapon = WEAPONS[weaponId];
  return !!att && !!weapon && weapon.slots.includes(att.slot) && att.fits.includes(weapon.class);
};

// A weapon's numbers with its attachments on (skill comes later, in character.weaponEff).
export function weaponWithAttachments(instance) {
  const base = WEAPONS[instance.id];
  if (!base) return null;
  const out = { ...base, pellets: base.pellets ?? 1, pierce: base.pierce ?? 0, hip: 1, ads: 1, scoped: false, thermal: false, bipod: false, zooms: null, attachments: [] };
  for (const slot of Object.keys(ATTACHMENT_SLOTS)) {
    const att = ATTACHMENTS[instance.att?.[slot]];
    if (!att || !attachmentFits(att.id, base.id)) continue;
    out.attachments.push(att.id);
    const m = att.mods;
    if (m.zoom) out.zoom = m.zoom;
    if (m.zooms) out.zooms = m.zooms;
    if (m.scoped) out.scoped = true;
    if (m.thermal) out.thermal = true;
    if (m.bipod) out.bipod = true;
    if (m.spread) out.spread *= m.spread;
    if (m.recoil) out.recoil *= m.recoil;
    if (m.noise) out.noise *= m.noise;
    if (m.damage) out.damage *= m.damage;
    if (m.range) out.range *= m.range;
    if (m.reload) out.reload *= m.reload;
    if (m.hip) out.hip *= m.hip;
    if (m.ads) out.ads *= m.ads;
    if (m.mag) out.mag = Math.round(out.mag * m.mag);
    if (m.weight) out.weight += m.weight;
    if (m.pierce) out.pierce = Math.max(out.pierce, m.pierce);
  }
  out.suppressed = out.noise <= 30;
  return out;
}
