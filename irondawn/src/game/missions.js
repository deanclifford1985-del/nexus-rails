// Missions: the thirteen story operations, the contract generator, briefing-table planning,
// grading and rewards. A mission here is only data; sim/mission.js runs it in the world.
//
// Objective types the simulation understands:
//   reach { at }            get within range of a named point at the site
//   eliminate { who }       'all', 'target' (the named target) or a share such as 0.8
//   rescue { count }        free that many captives
//   capture {}              subdue the named target alive
//   tag { count }           tag that many enemies through binoculars or a scope
//   collect { count }       pick up that many intelligence items
//   plant { count }         set charges on that many marked objectives
//   defend { waves }        hold the position through every wave
//   talk { npc }            speak to someone at the site
//   extract { with }        reach the extraction point (with: 'captives' | 'prisoner' | null)

import { B, clamp, mulberry } from './balance.js';
import { RANKS } from './ranks.js';
import { LOCATIONS, locationOf, sideOf } from './world.js';

export const MISSION_TYPES = {
  defense: { id: 'defense', name: 'Fort Defense', short: 'Defense', text: 'Hold a position against waves of attackers.' },
  rescue: { id: 'rescue', name: 'Rescue Raid', short: 'Rescue', text: 'Break captives out of an enemy camp and bring them home.' },
  recon: { id: 'recon', name: 'Reconnaissance', short: 'Recon', text: 'Get in, see everything, leave no sign.' },
  capture: { id: 'capture', name: 'Stealth & Capture', short: 'Capture', text: 'Take a named target alive.' },
  elimination: { id: 'elimination', name: 'Solo Elimination', short: 'Elimination', text: 'One target. You work alone.' },
  sabotage: { id: 'sabotage', name: 'Sabotage', short: 'Sabotage', text: 'Set charges on what the enemy cannot afford to lose.' },
  assault: { id: 'assault', name: 'Assault', short: 'Assault', text: 'Take the position by force.' },
};

export const CHAPTERS = [
  { id: 1, name: 'Act I: Baptism', text: 'A private learns what the front is.' },
  { id: 2, name: 'Act II: Fire Team', text: 'Stripes, and people who depend on you.' },
  { id: 3, name: 'Act III: Command', text: 'The island is retaken one position at a time.' },
];

export const STORY = [
  {
    id: 'first_watch', chapter: 1, name: 'First Watch', type: 'defense', site: 'echo', tier: 1, rank: 1, hour: 19.7, par: 420,
    squad: 'attached', leader: 'Sergeant Kaplan', allies: { rifleman: 3 },
    brief: 'Checkpoint Echo is the last friendly post on the north road, and the Legion has been probing it for a week. At dusk today they come properly. You are attached to Sergeant Kaplan’s section: hold the checkpoint until the attack breaks.',
    intel: 'Three waves of light infantry from the north and north-east. No heavy weapons expected.',
    objectives: [
      { id: 'post', type: 'reach', at: 'asset', text: 'Take your post at the checkpoint' },
      { id: 'hold', type: 'defend', text: 'Hold Checkpoint Echo', waves: [{ delay: 12, counts: { rifleman: 4 } }, { delay: 14, counts: { rifleman: 4, scout: 2 } }, { delay: 16, counts: { rifleman: 5, scout: 2 } }] },
    ],
    bonus: [{ id: 'standing', type: 'noDowns', text: 'Never go down', xp: 80 }],
    radio: {
      start: [['Sgt Kaplan', 'Eyes north, Private. They will come up the road and through the trees on the right.']],
      wave: [['Sgt Kaplan', 'Contact! Pick your targets, short bursts.']],
      complete: [['Sgt Kaplan', 'They’re pulling back. That’s how it’s done. Good shooting, kid.']],
    },
    xp: 350, rp: 300,
  },
  {
    id: 'lost_patrol', chapter: 1, name: 'Lost Patrol', type: 'rescue', site: 'sawmill', tier: 1, rank: 1, hour: 5.9, par: 600,
    squad: 'attached', leader: 'Sergeant Kaplan', allies: { rifleman: 2, medic: 1 },
    brief: 'Two of ours walked into a Legion patrol yesterday and did not walk out. Intelligence has them in the Sawmill Camp in the eastern woods. Kaplan’s section goes in at first light to bring them back.',
    intel: 'About ten riflemen and scouts. The captives are held in the sheds on the east side.',
    objectives: [
      { id: 'approach', type: 'reach', at: 'gate', radius: 70, text: 'Move up to the Sawmill Camp' },
      { id: 'free', type: 'rescue', count: 2, text: 'Free the captured patrol' },
      { id: 'out', type: 'extract', with: 'captives', text: 'Get them to the extraction point' },
    ],
    bonus: [{ id: 'all', type: 'allCaptives', text: 'Bring both home alive', xp: 120 }],
    forces: { rifleman: 6, scout: 3, marksman: 1 }, patrols: 1,
    radio: {
      start: [['Sgt Kaplan', 'We do this quietly for as long as it stays quiet. On me.']],
      alarm: [['Sgt Kaplan', 'So much for quiet. Fight through, get to the sheds!']],
      free: [['Sgt Kaplan', 'That’s both of them. Extraction’s on the south track. Move!']],
    },
    xp: 500, rp: 400,
  },
  {
    id: 'eyes_on_the_hill', chapter: 1, name: 'Eyes on the Hill', type: 'recon', site: 'relay', tier: 2, rank: 2, hour: 19.4, par: 720,
    squad: 'none',
    brief: 'The Legion coordinates everything west of the road through a relay on the heights. We want to know who is up there and we want their code book. Go alone, tag what you see, take the book from the relay hut and be gone before they know.',
    intel: 'A small garrison with a marksman in the tower. An alarm box sits by the mast: shoot it out or stay unseen.',
    objectives: [
      { id: 'tag', type: 'tag', count: 5, text: 'Tag five of the garrison through your binoculars' },
      { id: 'book', type: 'collect', count: 1, text: 'Take the code book from the relay hut' },
      { id: 'out', type: 'extract', text: 'Reach the extraction point' },
    ],
    bonus: [{ id: 'ghost', type: 'noAlarm', text: 'Never raise the alarm', xp: 200 }, { id: 'clean', type: 'noKills', text: 'Leave everyone alive', xp: 150 }],
    forces: { rifleman: 5, scout: 2, marksman: 1 }, patrols: 1,
    radio: {
      start: [['Lt Sato', 'Binoculars on B. Hold the mark on a soldier and he is tagged for good. Take your time.']],
      alarm: [['Lt Sato', 'They’re awake. Get the book and get out, any way you can.']],
      book: [['Lt Sato', 'That’s the book. Now walk away like you were never there.']],
    },
    xp: 650, rp: 500,
  },
  {
    id: 'quiet_hands', chapter: 2, name: 'Quiet Hands', type: 'capture', site: 'quarry', tier: 3, rank: 3, hour: 1, par: 780,
    squad: 'own',
    brief: 'Anton Vale, the man they call the Broker, buys everything the Legion shoots. He inspects the stores at Karst Quarry tonight. We want him alive and talking. You have a corporal’s stripes and one soldier of your own: use both.',
    intel: 'Vale keeps to the site office with two bodyguards. If the alarm goes he will run for the truck at the north ramp.',
    target: { name: 'Anton Vale', title: 'The Broker', type: 'officer', capture: true, guards: 2, flees: true },
    objectives: [
      { id: 'take', type: 'capture', text: 'Capture Anton Vale alive' },
      { id: 'out', type: 'extract', with: 'prisoner', text: 'Bring Vale to the extraction point' },
    ],
    bonus: [{ id: 'ghost', type: 'noAlarm', text: 'Never raise the alarm', xp: 250 }],
    forces: { rifleman: 7, scout: 2, marksman: 1, breacher: 2 }, patrols: 2,
    radio: {
      start: [['Cpt Marsh', 'Get behind him and take him down by hand, or leave him nobody to hide behind and tell him to give up. Do not shoot him.']],
      alarm: [['Cpt Marsh', 'Vale is running! Cut him off at the north ramp!']],
      take: [['Cpt Marsh', 'You have him. Extraction is waiting. Keep him moving.']],
    },
    xp: 900, rp: 800,
  },
  {
    id: 'one_shot', chapter: 2, name: 'One Shot', type: 'elimination', site: 'villa', tier: 4, rank: 3, hour: 6, par: 600,
    squad: 'none', issue: { weapon: 'ridgeline', att: { optic: 'scope6' } },
    brief: 'Major Kessler trains every marksman the Legion has, and he takes his coffee on the terrace of the Lakeside Villa at dawn. You go alone with a rifle from the armoury. The far shore of Lake Miren gives you three hundred metres and a clear view. One shot is all the time you will get.',
    intel: 'Kessler walks the terrace at first light. A dozen guards on the grounds and two marksmen on the roof.',
    target: { name: 'Major Kessler', title: 'Chief of marksmen', type: 'boss', guards: 2, patrols: true },
    objectives: [
      { id: 'kill', type: 'eliminate', who: 'target', text: 'Eliminate Major Kessler' },
      { id: 'out', type: 'extract', text: 'Reach the extraction point' },
    ],
    bonus: [{ id: 'long', type: 'longShot', metres: 200, text: 'Take him from beyond 200 m', xp: 250 }, { id: 'ghost', type: 'noAlarm', text: 'Be gone before the alarm', xp: 150 }],
    forces: { rifleman: 7, scout: 2, marksman: 2, gunner: 1 }, patrols: 2,
    radio: {
      start: [['Cpt Marsh', 'Find your ground on the south shore. Prone, breath held, and wait for him to stop moving.']],
      kill: [['Cpt Marsh', 'Target down. Do not admire it. Move.']],
    },
    xp: 1100, rp: 900,
  },
  {
    id: 'hammer_and_anvil', chapter: 2, name: 'Hammer and Anvil', type: 'assault', site: 'anvil', tier: 4, rank: 4, hour: 15, par: 900,
    squad: 'own', allies: { rifleman: 4, gunner: 1 },
    brief: 'Fort Anvil sits on the north road and nothing moves past it without the Legion’s say. We take it today. Second Platoon assaults the south gate; your fire team goes in with them. Clear the fort, then hold it: they will want it back before dark.',
    intel: 'A full garrison behind stone walls, machine guns on the towers. Expect a counterattack from the north within minutes of the fort falling.',
    objectives: [
      { id: 'clear', type: 'eliminate', who: 0.85, text: 'Clear the garrison of Fort Anvil' },
      { id: 'hold', type: 'defend', text: 'Hold the fort against the counterattack', waves: [{ delay: 25, counts: { rifleman: 6, scout: 2 } }, { delay: 18, counts: { rifleman: 6, gunner: 2, grenadier: 1 } }] },
    ],
    bonus: [{ id: 'squad', type: 'noLosses', text: 'Lose nobody from your fire team', xp: 200 }],
    forces: { rifleman: 10, gunner: 2, marksman: 2, breacher: 2, officer: 1 }, patrols: 1,
    liberates: 'anvil',
    radio: {
      start: [['Cpt Marsh', 'Sergeant, your team takes the left of the gate. Keep them together and keep them moving.']],
      clear: [['Cpt Marsh', 'Fort Anvil is ours. Get your people on the north wall. They are coming.']],
      complete: [['Cpt Marsh', 'They’ve broken. Anvil holds. That flag stays up.']],
    },
    xp: 1400, rp: 1200,
  },
  {
    id: 'brightwater', chapter: 2, name: 'Brightwater', type: 'defense', site: 'brightwater', tier: 5, rank: 4, hour: 18, par: 780,
    squad: 'own', allies: { rifleman: 2 },
    brief: 'With Anvil gone the Legion wants a village to punish, and Brightwater is closest. The elder, Ysolde Marin, does not much like soldiers of any colour. Talk to her first: what her people tell you may matter more than another rifle. Then hold the village.',
    intel: 'Raiders in three groups. Direction unknown, unless the village chooses to share what its shepherds have seen.',
    objectives: [
      { id: 'elder', type: 'talk', npc: 'elder', dialog: 'elder_brightwater', text: 'Speak with Elder Ysolde' },
      { id: 'hold', type: 'defend', text: 'Defend Brightwater', waves: [{ delay: 20, counts: { rifleman: 6, scout: 2 } }, { delay: 16, counts: { rifleman: 6, breacher: 2, grenadier: 1 } }, { delay: 16, counts: { rifleman: 7, gunner: 2, officer: 1 } }] },
    ],
    bonus: [{ id: 'homes', type: 'assetHealth', share: 0.7, text: 'Keep the village mostly unharmed', xp: 250 }],
    radio: {
      start: [['Cpt Marsh', 'The elder is at the well in the square. Mind how you speak to her.']],
      complete: [['Elder Ysolde', 'You stayed. I did not think you would. Brightwater will remember it.']],
    },
    xp: 1500, rp: 1200,
  },
  {
    id: 'black_gold', chapter: 3, name: 'Black Gold', type: 'sabotage', site: 'depot', tier: 5, rank: 5, hour: 2, par: 780,
    squad: 'own',
    brief: 'Every Legion truck on Corvane fills up at one depot on the east coast. Set charges on the three storage tanks and be clear when they go. A squad leader’s job tonight: get four people in and four people out.',
    intel: 'Tanks on the east side of the yard, well lit. Patrols on a regular beat. The charges need a few quiet seconds each.',
    objectives: [
      { id: 'charges', type: 'plant', count: 3, text: 'Set charges on the three fuel tanks' },
      { id: 'out', type: 'extract', text: 'Get clear to the extraction point' },
    ],
    bonus: [{ id: 'ghost', type: 'noAlarm', text: 'Never raise the alarm', xp: 300 }, { id: 'squad', type: 'noLosses', text: 'Bring the whole squad out', xp: 200 }],
    forces: { rifleman: 9, scout: 3, marksman: 2, gunner: 2, grenadier: 1 }, patrols: 3,
    radio: {
      start: [['Cpt Marsh', 'Hold fire until you must. Use the hold-fire order and keep your squad low.']],
      charges: [['Cpt Marsh', 'All three set. You have until you are clear. Go.']],
      complete: [['Cpt Marsh', 'We can see that from here. Beautiful.']],
    },
    xp: 1900, rp: 1500,
  },
  {
    id: 'deep_rescue', chapter: 3, name: 'Deep Rescue', type: 'rescue', site: 'highcrag', tier: 7, rank: 6, hour: 5, par: 900,
    squad: 'own',
    brief: 'Sergeant Kaplan’s patrol was taken on the Stonebridge road a month ago. We now know where they are: Highcrag, a prison camp in the northern range. The road is watched. The mountain behind it is not, if you can climb. Four prisoners. Bring all of them.',
    intel: 'A hard garrison with machine guns covering the road. The cliff on the north side is steep and unguarded.',
    objectives: [
      { id: 'free', type: 'rescue', count: 4, text: 'Free Sergeant Kaplan and his patrol' },
      { id: 'out', type: 'extract', with: 'captives', text: 'Get them down to the extraction point' },
    ],
    bonus: [{ id: 'all', type: 'allCaptives', text: 'Bring all four home alive', xp: 300 }],
    forces: { rifleman: 10, scout: 3, marksman: 3, gunner: 3, grenadier: 2, officer: 1 }, patrols: 2,
    captiveLeader: 'Sergeant Kaplan',
    radio: {
      start: [['Cpt Marsh', 'You know who is in there. Do it properly.']],
      free: [['Sgt Kaplan', 'Took you long enough, kid. ...Sorry. Sergeant. Lead on.']],
    },
    xp: 2300, rp: 1800,
  },
  {
    id: 'ghost_hunt', chapter: 3, name: 'Ghost Hunt', type: 'elimination', site: 'stonebridge', tier: 7, rank: 6, hour: 19.6, par: 720,
    squad: 'none',
    brief: 'Colonel Rusk runs the occupation of Stonebridge and signs the lists. He moves between houses and never sleeps in the same one twice. Go alone, find him among his own men and end it. The villagers are not your enemy: check your fire.',
    intel: 'Rusk walks the village with four bodyguards. Your tracking will narrow down where he is. Civilians are in the streets.',
    target: { name: 'Colonel Rusk', title: 'Commander of the occupation', type: 'boss', guards: 4, patrols: true, hidden: true },
    objectives: [
      { id: 'kill', type: 'eliminate', who: 'target', text: 'Find and eliminate Colonel Rusk' },
      { id: 'out', type: 'extract', text: 'Reach the extraction point' },
    ],
    bonus: [{ id: 'civ', type: 'noCivilians', text: 'Harm no villager', xp: 300 }],
    forces: { rifleman: 9, scout: 3, marksman: 2, gunner: 2, breacher: 2 }, patrols: 3, civilians: 6,
    radio: {
      start: [['Lt Sato', 'He is in there somewhere. Watch the patrols: the one that never stands still is his.']],
      kill: [['Lt Sato', 'Confirmed. The village will sleep tonight. Get out.']],
    },
    xp: 2600, rp: 2000,
  },
  {
    id: 'kingpin', chapter: 3, name: 'Kingpin', type: 'capture', site: 'grayport', tier: 8, rank: 7, hour: 0.5, par: 900,
    squad: 'own',
    brief: 'Everything the Legion owns came in through Grayport, and Colonel Mirela Strand keeps the ledgers. Take her alive and we learn who is paying for this war. Her escape boat is at the long pier. Do not let her reach it.',
    intel: 'A large garrison spread across the docks. Strand works late in the harbour office.',
    target: { name: 'Colonel Strand', title: 'Harbour master', type: 'officer', capture: true, guards: 3, flees: true },
    objectives: [
      { id: 'take', type: 'capture', text: 'Capture Colonel Strand alive' },
      { id: 'ledgers', type: 'collect', count: 2, text: 'Take the shipping ledgers' },
      { id: 'out', type: 'extract', with: 'prisoner', text: 'Bring Strand to the extraction point' },
    ],
    bonus: [{ id: 'ghost', type: 'noAlarm', text: 'Never raise the alarm', xp: 400 }],
    forces: { rifleman: 12, scout: 3, marksman: 3, gunner: 3, breacher: 2, grenadier: 2, heavy: 1 }, patrols: 3,
    grants: 'commissioned',
    radio: {
      start: [['Cpt Marsh', 'Master Sergeant, this one is yours to plan and yours to run.']],
      take: [['Cpt Marsh', 'Outstanding. Bring her in. The Colonel wants a word with you after.']],
    },
    xp: 3000, rp: 2400,
  },
  {
    id: 'siege_of_anvil', chapter: 3, name: 'Siege of Anvil', type: 'defense', site: 'anvil', tier: 9, rank: 8, hour: 21.5, par: 900,
    squad: 'own', allies: { rifleman: 5, gunner: 2, medic: 1 },
    brief: 'Drach has thrown everything he has left at Fort Anvil. If it falls, the road south is open. Lieutenant, the fort is yours: your squad, the garrison, and whatever support you can call. Hold until dawn.',
    intel: 'Five waves from the north and west, with machine guns, grenadiers and heavy infantry. Mortars will fall on the walls.',
    objectives: [
      {
        id: 'hold', type: 'defend', text: 'Hold Fort Anvil', mortars: true,
        waves: [
          { delay: 15, counts: { rifleman: 8, scout: 3 } },
          { delay: 16, counts: { rifleman: 8, gunner: 2, grenadier: 2 } },
          { delay: 16, counts: { rifleman: 8, breacher: 3, marksman: 2, heavy: 1 } },
          { delay: 18, counts: { rifleman: 9, gunner: 3, grenadier: 2, heavy: 1 } },
          { delay: 20, counts: { rifleman: 10, gunner: 3, heavy: 2, officer: 1 } },
        ],
      },
    ],
    bonus: [{ id: 'squad', type: 'noLosses', text: 'Lose nobody from your squad', xp: 400 }],
    radio: {
      start: [['Col Adeyemi', 'Lieutenant, I will not tell you how to fight your fort. Hold it.']],
      complete: [['Col Adeyemi', 'Sun’s up and so is the flag. He has nothing left to throw. Now we go north.']],
    },
    xp: 3600, rp: 3000,
  },
  {
    id: 'iron_dawn', chapter: 3, name: 'Iron Dawn', type: 'assault', site: 'citadel', tier: 10, rank: 9, hour: 5, par: 1200,
    squad: 'own', allies: { rifleman: 6, gunner: 2, medic: 1 },
    brief: 'The Citadel. Drach’s headquarters, his last guns and the man himself. Silence the two anti-air batteries so the airborne can land, then break into the keep. Operation Iron Dawn ends where it began, with soldiers on foot.',
    intel: 'Everything the Legion has left. The batteries stand in the east and west courtyards. Drach will be in the keep with his guard.',
    target: { name: 'General Drach', title: 'Commander of the Ashen Legion', type: 'boss', guards: 4 },
    objectives: [
      { id: 'guns', type: 'plant', count: 2, text: 'Destroy the two anti-air batteries' },
      { id: 'drach', type: 'eliminate', who: 'target', text: 'Take down General Drach' },
    ],
    bonus: [{ id: 'squad', type: 'noLosses', text: 'Bring your whole squad through', xp: 500 }],
    forces: { rifleman: 16, scout: 3, marksman: 4, gunner: 4, breacher: 3, grenadier: 3, heavy: 2, officer: 2 }, patrols: 2,
    liberates: 'citadel',
    radio: {
      start: [['Col Adeyemi', 'All stations, Iron Dawn is go. Good hunting.']],
      guns: [['Col Adeyemi', 'Batteries are down. Airborne is inbound. The keep is yours.']],
      complete: [['Col Adeyemi', 'It’s over. Corvane is free. You did that, and everyone here knows it.']],
    },
    xp: 5000, rp: 5000,
  },
];

const STORY_BY_ID = Object.fromEntries(STORY.map((m) => [m.id, m]));

export const storyDone = (save, id) => save.story.done.includes(id);
export const nextStory = (save) => (save.phase === 'service' ? STORY.find((m) => !storyDone(save, m.id)) ?? null : null);
export const storyFinished = (save) => STORY.every((m) => storyDone(save, m.id));

// Why a mission cannot be taken yet, or null.
export function missionLock(save, mission) {
  if (save.phase !== 'service') return 'Finish basic training first.';
  if (save.rank < mission.rank) return `Requires the rank of ${RANKS[mission.rank].name}.`;
  return null;
}

export const recommendedRating = (mission) => 110 + mission.tier * 55;

// ---------- contracts ----------
const ADJ = ['Silent', 'Iron', 'Broken', 'Pale', 'Hollow', 'Burning', 'Northern', 'Sudden', 'Grey', 'Long', 'Bitter', 'Red', 'Winter', 'Blind', 'Last'];
const NOUN = ['Lantern', 'Anvil', 'Harvest', 'Tide', 'Falcon', 'Hammer', 'Ember', 'Wolf', 'Compass', 'Thorn', 'Vigil', 'Spear', 'Raven', 'Bridge', 'Oath'];

const CONTRACT_SITES = {
  rescue: ['sawmill', 'quarry', 'depot', 'stonebridge', 'highcrag'],
  defense: ['echo', 'brightwater', 'anvil'],
  capture: ['relay', 'quarry', 'villa', 'depot', 'grayport'],
  elimination: ['sawmill', 'relay', 'villa', 'stonebridge', 'grayport'],
  sabotage: ['relay', 'quarry', 'depot', 'grayport'],
  assault: ['sawmill', 'relay', 'quarry', 'depot'],
};
const CONTRACT_TYPES = ['rescue', 'defense', 'capture', 'elimination', 'sabotage', 'assault'];

// The band of contract tiers offered at a rank.
export function contractTiers(rankIndex) {
  const lo = clamp(Math.floor(rankIndex * 0.62), 1, 7);
  const hi = clamp(Math.ceil(rankIndex * 0.85) + 1, 2, B.ENEMY.TIER_MAX);
  return [lo, hi];
}

// A garrison of `total` soldiers suited to a tier.
export function composeForce(total, tier, rng) {
  const counts = { rifleman: 0 };
  const menu = [
    ['scout', 1, 0.16],
    ['marksman', 2, 0.1],
    ['breacher', 3, 0.1],
    ['gunner', 3, 0.12],
    ['grenadier', 4, 0.08],
    ['heavy', 6, 0.05],
  ];
  for (let i = 0; i < total; i++) {
    let roll = rng();
    let type = 'rifleman';
    for (const [id, from, share] of menu) {
      if (tier < from) continue;
      if (roll < share) {
        type = id;
        break;
      }
      roll -= share;
    }
    counts[type] = (counts[type] ?? 0) + 1;
  }
  if (tier >= 3) counts.officer = 1;
  return counts;
}

function wavesFor(tier, rng) {
  const n = tier >= 7 ? 4 : 3;
  const waves = [];
  for (let i = 0; i < n; i++) waves.push({ delay: i === 0 ? 14 : 16, counts: composeForce(Math.round(4 + tier * 0.7 + i * 1.5), Math.max(1, tier - (i === 0 ? 1 : 0)), rng) });
  return waves;
}

function makeContract(save, index, rng) {
  const [lo, hi] = contractTiers(save.rank);
  const tier = clamp(lo + Math.floor(rng() * (hi - lo + 1)), 1, B.ENEMY.TIER_MAX);
  const type = CONTRACT_TYPES[(index + Math.floor(rng() * 2) * 3) % CONTRACT_TYPES.length];
  // Defence happens on ground you hold; everything else on Legion ground no deeper than your rank reaches.
  let sites = CONTRACT_SITES[type].filter((id) => (type === 'defense' ? sideOf(save, id) === 'ally' : sideOf(save, id) === 'enemy' && (locationOf(id).tier ?? 1) <= hi + 1));
  if (!sites.length) sites = type === 'defense' ? ['echo'] : ['sawmill'];
  const site = sites[Math.floor(rng() * sites.length)];
  const siteName = locationOf(site).name;
  const total = Math.round(7 + tier * 1.5);
  const canLead = RANKS[save.rank].squad > 0;
  const base = {
    id: `c${save.contracts.seed.toString(36)}-${save.contracts.done}-${index}`,
    contract: true,
    name: `Operation ${ADJ[Math.floor(rng() * ADJ.length)]} ${NOUN[Math.floor(rng() * NOUN.length)]}`,
    type, site, tier, rank: 1,
    hour: [5.5, 13, 19.5, 23, 2][Math.floor(rng() * 5)],
    par: 600 + tier * 40,
    squad: canLead ? 'own' : 'attached',
    leader: canLead ? null : 'Sergeant Kaplan',
    allies: canLead ? null : { rifleman: 2 },
    xp: B.ECON.CONTRACT_XP.base + B.ECON.CONTRACT_XP.perTier * tier,
    rp: B.ECON.CONTRACT_RP.base + B.ECON.CONTRACT_RP.perTier * tier,
    forces: composeForce(total, tier, rng),
    patrols: 1 + Math.floor(rng() * 2) + (tier >= 6 ? 1 : 0),
    radio: {},
  };
  if (type === 'rescue') {
    const count = tier >= 5 ? 3 : 2;
    return {
      ...base,
      brief: `${count === 2 ? 'Two' : 'Three'} of ours are being held at ${siteName}. Get them out before they are moved north.`,
      intel: 'Captives are held inside the compound. Expect them to be guarded.',
      objectives: [{ id: 'free', type: 'rescue', count, text: `Free the ${count} captives` }, { id: 'out', type: 'extract', with: 'captives', text: 'Get them to the extraction point' }],
      bonus: [{ id: 'all', type: 'allCaptives', text: 'Bring every captive home', xp: 60 + tier * 25 }],
    };
  }
  if (type === 'defense') {
    return {
      ...base,
      forces: null, patrols: 0,
      hour: [21, 22.5, 4.5, 17][Math.floor(rng() * 4)],
      allies: { rifleman: canLead ? 2 : 3 },
      brief: `The Legion is massing against ${siteName}. Hold it until the attack breaks.`,
      intel: 'Several waves. They will probe first and then come in strength.',
      objectives: [{ id: 'hold', type: 'defend', text: `Hold ${siteName}`, mortars: tier >= 6, waves: wavesFor(tier, rng) }],
      bonus: [{ id: 'standing', type: 'noDowns', text: 'Never go down', xp: 60 + tier * 20 }],
    };
  }
  if (type === 'capture') {
    return {
      ...base,
      brief: `A Legion officer with what we need to know is at ${siteName}. Take him alive.`,
      intel: 'He will run if the alarm is raised. Get close unseen, or leave him no one to hide behind.',
      target: { name: `Major ${NOUN[Math.floor(rng() * NOUN.length)]}`, title: 'Legion staff officer', type: 'officer', capture: true, guards: 2, flees: true },
      objectives: [{ id: 'take', type: 'capture', text: 'Capture the officer alive' }, { id: 'out', type: 'extract', with: 'prisoner', text: 'Bring him to the extraction point' }],
      bonus: [{ id: 'ghost', type: 'noAlarm', text: 'Never raise the alarm', xp: 80 + tier * 30 }],
    };
  }
  if (type === 'elimination') {
    return {
      ...base,
      squad: 'none', leader: null, allies: null,
      brief: `A Legion commander is inspecting ${siteName}. You go alone. Find him, end him, leave.`,
      intel: 'He walks the position with bodyguards. Distance is your friend.',
      target: { name: `Captain ${ADJ[Math.floor(rng() * ADJ.length)]}`, title: 'Legion field commander', type: 'boss', guards: 2, patrols: true },
      objectives: [{ id: 'kill', type: 'eliminate', who: 'target', text: 'Eliminate the commander' }, { id: 'out', type: 'extract', text: 'Reach the extraction point' }],
      bonus: [{ id: 'long', type: 'longShot', metres: 150, text: 'Take him from beyond 150 m', xp: 80 + tier * 30 }],
    };
  }
  if (type === 'sabotage') {
    const count = tier >= 5 ? 3 : 2;
    return {
      ...base,
      brief: `Stores at ${siteName} are keeping the Legion in the field. Set charges on them and get clear.`,
      intel: 'The objectives are marked. Each charge takes a few uninterrupted seconds.',
      objectives: [{ id: 'charges', type: 'plant', count, text: `Set ${count} charges` }, { id: 'out', type: 'extract', text: 'Get clear to the extraction point' }],
      bonus: [{ id: 'ghost', type: 'noAlarm', text: 'Never raise the alarm', xp: 80 + tier * 30 }],
    };
  }
  return {
    ...base,
    brief: `Clear the Legion out of ${siteName}. No subtlety required.`,
    intel: 'A full garrison, dug in.',
    objectives: [{ id: 'clear', type: 'eliminate', who: 0.9, text: `Clear ${siteName}` }],
    bonus: [{ id: 'standing', type: 'noDowns', text: 'Never go down', xp: 60 + tier * 20 }],
  };
}

// The four contracts on the operations board. The list is the same until one is completed.
export function contractsFor(save) {
  if (save.phase !== 'service') return [];
  const rng = mulberry((save.contracts.seed + save.contracts.done * 15485863) | 0);
  const out = [];
  for (let i = 0; i < 4; i++) out.push(makeContract(save, i, rng));
  return out;
}

export function missionById(save, id) {
  return STORY_BY_ID[id] ?? contractsFor(save).find((m) => m.id === id) ?? null;
}

// ---------- planning at the briefing table ----------
export const PLAN_OPTIONS = [
  { id: 'intel', name: 'Recon report', cost: 1, text: 'About half the garrison is marked on your map before you insert.', not: ['defense'] },
  { id: 'night', name: 'Night insertion', cost: 1, text: 'Go in at 01:00. Sentries see less than half as far in the dark.', not: ['defense'] },
  { id: 'flank', name: 'Alternate insertion', cost: 1, text: 'Insert on the far side, away from the main gate.', not: ['defense'] },
  { id: 'supplies', name: 'Extra supplies', cost: 1, text: 'Two more medkits, two more grenades and half again the ammunition.' },
  { id: 'diversion', name: 'Diversion', cost: 2, text: 'A feint on the road draws a third of the garrison away before you arrive.', not: ['defense'] },
  { id: 'power', name: 'Cut the power', cost: 2, text: 'Lamps and the alarm are dead when you arrive.', not: ['defense'] },
  { id: 'medevac', name: 'Medevac standby', cost: 2, text: 'The first time you go down, a medic gets you back up.' },
  { id: 'fortify', name: 'Prepared positions', cost: 1, text: 'Three mines are laid on the approaches before the first wave.', only: ['defense'] },
  { id: 'reserve', name: 'Reserve section', cost: 2, text: 'Four more riflemen hold the line with you.', only: ['defense'] },
];

export function planFor(mission, derived) {
  const options = PLAN_OPTIONS.filter((o) => (!o.only || o.only.includes(mission.type)) && !(o.not ?? []).includes(mission.type));
  return { points: derived.planPoints, reveal: derived.intelReveal, options };
}

export function planCost(ids) {
  return (ids ?? []).reduce((sum, id) => sum + (PLAN_OPTIONS.find((o) => o.id === id)?.cost ?? 0), 0);
}

// ---------- grading and rewards ----------
// stats come from the simulation: { time, alarm, downs, squadLost, alliesLost, shots, hits, captivesLost,
//   bonus: { id: true }, kills, headshots, stealthKills, killXp }
export function gradeMission(mission, stats) {
  let score = 55;
  const notes = [];
  const add = (points, text) => {
    score += points;
    notes.push({ points, text });
  };
  if (!stats.alarm && ['recon', 'capture', 'sabotage', 'elimination', 'rescue'].includes(mission.type)) add(15, 'Alarm never raised');
  if ((stats.downs ?? 0) === 0) add(10, 'Never went down');
  else add(-12 * stats.downs, `Went down ${stats.downs === 1 ? 'once' : `${stats.downs} times`}`);
  if ((stats.squadLost ?? 0) === 0 && mission.squad !== 'none') add(8, 'No squad casualties');
  else if (stats.squadLost > 0) add(-6 * stats.squadLost, `${stats.squadLost} squad casualt${stats.squadLost === 1 ? 'y' : 'ies'}`);
  const accuracy = stats.shots > 0 ? stats.hits / stats.shots : 0;
  if (stats.shots >= 5 && accuracy >= 0.5) add(8, `Accuracy ${Math.round(accuracy * 100)}%`);
  if (stats.time <= mission.par) add(7, 'Under par time');
  if (stats.captivesLost > 0) add(-12 * stats.captivesLost, `${stats.captivesLost} captive${stats.captivesLost === 1 ? '' : 's'} lost`);
  if (stats.civilians > 0) add(-15 * stats.civilians, `${stats.civilians} civilian${stats.civilians === 1 ? '' : 's'} harmed`);
  for (const bonus of mission.bonus ?? []) if (stats.bonus?.[bonus.id]) add(6, bonus.text);
  score = clamp(Math.round(score), 0, 100);
  const G = B.GRADE;
  const grade = score >= G.S.at ? 'S' : score >= G.A.at ? 'A' : score >= G.B.at ? 'B' : 'C';
  return { score, grade, mult: G[grade].mult, notes };
}

// What a finished mission pays. derived is the soldier's deriveStats().
export function missionRewards(mission, stats, save, derived) {
  if (!stats.success) {
    return { success: false, xp: Math.round((stats.killXp ?? 0) * B.ECON.FAIL_KEEP), rp: 0, salary: 0, bonusXp: 0, grade: null, bill: Math.round(save.rp * B.ECON.MEDICAL_BILL) };
  }
  const grade = gradeMission(mission, stats);
  const bonusXp = (mission.bonus ?? []).reduce((sum, b) => sum + (stats.bonus?.[b.id] ? b.xp : 0), 0);
  return {
    success: true,
    grade,
    xp: Math.round(mission.xp * grade.mult),
    bonusXp,
    killXp: Math.round(stats.killXp ?? 0),
    rp: Math.round(mission.rp * grade.mult * derived.payMul),
    salary: Math.round(80 * RANKS[save.rank].pay),
    bill: 0,
  };
}

export const missionSites = () => LOCATIONS.filter((l) => l.side === 'enemy' || l.kind !== 'base');
