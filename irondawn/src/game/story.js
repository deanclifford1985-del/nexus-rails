// People and what they say. A dialog is a list of lines and, optionally, choices at the end.
// A choice may carry a check ({ attr, dc }): it passes when the soldier's attribute (with gear) is
// at least dc, and the screen shows the requirement. `cmd` asks the game to do something when the
// dialog (or the choice) ends; the game interprets it (see GameHost.runCommand).
//
// Tokens in text: {name} {rank} {abbr} {callsign} {spec}.

import { EVENTS, trainingSummary } from './training.js';
import { RANKS, promotionDue } from './ranks.js';
import { nextStory, storyFinished, missionLock } from './missions.js';
import { specOf } from './specializations.js';

export const NPCS = {
  briggs: { id: 'briggs', name: 'Drill Sergeant Briggs', role: 'Drill Sergeant', tone: 'red' },
  finch: { id: 'finch', name: 'Corporal Finch', role: 'Intake Clerk', tone: 'olive' },
  okoro: { id: 'okoro', name: 'Range Master Okoro', role: 'Firing Range', tone: 'olive' },
  vasquez: { id: 'vasquez', name: 'Sergeant Vasquez', role: 'Confidence Course', tone: 'olive' },
  ilves: { id: 'ilves', name: 'Sergeant Ilves', role: 'Infiltration Lane', tone: 'olive' },
  dane: { id: 'dane', name: 'Corporal Dane', role: 'Observation Post', tone: 'olive' },
  sato: { id: 'sato', name: 'Lieutenant Sato', role: 'Intelligence', tone: 'blue' },
  marsh: { id: 'marsh', name: 'Captain Marsh', role: 'Operations', tone: 'blue' },
  adeyemi: { id: 'adeyemi', name: 'Colonel Adeyemi', role: 'Commanding Officer', tone: 'gold' },
  pops: { id: 'pops', name: '“Pops” Okafor', role: 'Quartermaster', tone: 'olive' },
  top: { id: 'top', name: 'First Sergeant Brennan', role: 'Barracks', tone: 'olive' },
  doc: { id: 'doc', name: 'Major Alvarez', role: 'Field Surgeon', tone: 'white' },
  holt: { id: 'holt', name: 'Crew Chief Holt', role: 'Flight Line', tone: 'olive' },
  kaplan: { id: 'kaplan', name: 'Sergeant Kaplan', role: 'Section Leader', tone: 'olive' },
  elder: { id: 'elder', name: 'Elder Ysolde Marin', role: 'Brightwater', tone: 'white' },
  local: { id: 'local', name: 'Villager', role: 'Local', tone: 'white' },
};

export const DIALOGS = {
  // ---------- arrival and intake ----------
  arrival: {
    npc: 'briggs',
    lines: [
      'Off the truck! Move! You are standing on Camp Hawthorne, on the island of Corvane, and as of this moment you belong to me.',
      'North of here the Ashen Legion holds half this island. They are paid soldiers and they are good. In a few weeks some of you will be standing in front of them.',
      'My job is to find out what each of you is made of before they do. Name!',
      '...{name}. I will try to remember it. Report to Corporal Finch in the intake tent, the one with the yellow flag, and pick your trade. Then find me on the parade ground.',
    ],
    cmd: { type: 'objective', text: 'Report to the intake tent', npc: 'finch' },
  },
  finch_intake: {
    npc: 'finch',
    lines: [
      'Next. Right, {name}. Sign here, here and here.',
      'Every soldier on this island has a specialization. It decides what you are issued and what you get good at fastest. It does not stop you learning the rest: anybody can learn anything out there, it just takes longer.',
      'Have a look at the board and choose. Choose carefully. Paperwork to change it does not exist.',
    ],
    cmd: { type: 'overlay', name: 'spec' },
  },
  finch_after: { npc: 'finch', lines: ['You’re all signed in, {name}. {spec}, wasn’t it? Good trade. Drill Sergeant Briggs is waiting on the parade ground.'] },

  // ---------- basic training ----------
  briggs_training_start: {
    npc: 'briggs',
    lines: [
      'So you want to be a {spec}. We will see.',
      'Five evaluations. The range, the confidence course, the infiltration lane, the observation post and the written exam. Take them in any order: the instructors are at their stations, marked on your compass.',
      'How you do sets where you start. A recruit who shoots well leaves here shooting well. A recruit who cannot climb the wall leaves here unable to climb the wall. Nobody is carried.',
      'You may retake an evaluation and I will keep your best score. When all five are done, come back to me.',
    ],
    cmd: { type: 'objective', text: 'Complete the five training evaluations' },
  },
  briggs_training_progress: {
    npc: 'briggs',
    lines: ['{done} of five, recruit. {left} still to do. The instructors are waiting and so am I.'],
  },
  briggs_graduate: {
    npc: 'briggs',
    lines: [
      'All five. Stand straight.',
      'Your scores average {average}. {verdict}',
      'You came here a civilian. You leave a soldier of the Corvane Defence Force. Whatever you become after this, you started here, and you will not embarrass me.',
    ],
    choices: [{ text: 'Graduate.', cmd: { type: 'graduate' } }, { text: 'Not yet. I want to retake an evaluation.', end: true }],
  },
  briggs_after: {
    npc: 'briggs',
    lines: ['{abbr} {name}. I hear things about you from up north. Mostly good. The courses are open if you want to keep sharp: a refresher is worth more than you’d think.'],
  },
  graduation: {
    npc: 'adeyemi',
    lines: [
      'Recruits. Soldiers, now.',
      'The Legion took the north of this island in eleven days. We are going to take it back, and it will take longer than that, and it will be done by the people standing on this square.',
      'Private {name}: Captain Marsh runs operations from the command tent. Report to her. She has work for you tonight.',
    ],
    cmd: { type: 'objective', text: 'Report to Captain Marsh at the command tent', npc: 'marsh' },
  },

  // ---------- instructors ----------
  okoro_intro: {
    npc: 'okoro',
    lines: ['Welcome to my range. Eighteen targets close and middle, then six long ones through glass. Each is up for a moment and then it is gone. Hits count. Fast hits count more.'],
    choices: [{ text: 'Step up to the line.', cmd: { type: 'training', id: 'range' } }, { text: 'Not now.', end: true }],
  },
  vasquez_intro: {
    npc: 'vasquez',
    lines: ['The confidence course. Sprint, hurdles, the crawl, the wall and the long drag home. The clock starts when you cross the first gate. It does not stop for anything.'],
    choices: [{ text: 'On the line.', cmd: { type: 'training', id: 'obstacle' } }, { text: 'Not now.', end: true }],
  },
  ilves_intro: {
    npc: 'ilves',
    lines: ['Past these trees is a flag. Between you and it are four of my instructors who would love to catch you. Slow, low and patient. Three strikes.'],
    choices: [{ text: 'Enter the lane.', cmd: { type: 'training', id: 'stealth' } }, { text: 'Not now.', end: true }],
  },
  dane_intro: {
    npc: 'dane',
    lines: ['Eight dummies in the valley, dressed to disappear. You get your binoculars and a little over a minute. Most recruits find four.'],
    choices: [{ text: 'Take the glass.', cmd: { type: 'training', id: 'observation' } }, { text: 'Not now.', end: true }],
  },
  sato_exam: {
    npc: 'sato',
    lines: ['The written exam. Eight situations. I am less interested in what you know than in how you think when nobody is shooting at you. It will be different when they are.'],
    choices: [{ text: 'Sit the exam.', cmd: { type: 'overlay', name: 'exam' } }, { text: 'Not now.', end: true }],
  },
  sato_after: {
    npc: 'sato',
    lines: ['Everything we know about the Legion is on the map table. Sites you have seen, sites you have not. The more you walk, the more we know.'],
    cmd: { type: 'overlay', name: 'menu', tab: 'map' },
  },

  // ---------- headquarters ----------
  marsh_first: {
    npc: 'marsh',
    lines: [
      'Private {name}. Briggs speaks well of you, which he does about once a year.',
      'Here is how this works. The board behind me has the operations we need done. The ones in gold move the campaign forward. The rest are contracts: there is always more work than soldiers.',
      'You pick the operation, we plan it at this table, and the flight line puts you where you need to be. Come back alive and we do it again.',
    ],
    cmd: { type: 'overlay', name: 'ops' },
  },
  marsh_ops: { npc: 'marsh', lines: ['{abbr} {name}. The board is up to date.'], cmd: { type: 'overlay', name: 'ops' } },
  marsh_locked: { npc: 'marsh', lines: ['The next operation needs more rank than you are wearing, {abbr}. {lock} Take a contract or two and come back.'], cmd: { type: 'overlay', name: 'ops' } },
  marsh_done: {
    npc: 'marsh',
    lines: ['The Citadel has fallen and I still have a board full of work. The Legion’s stragglers will not round themselves up, {abbr}.'],
    cmd: { type: 'overlay', name: 'ops' },
  },
  adeyemi_idle: { npc: 'adeyemi', lines: ['{abbr} {name}. I read every after-action report that crosses this desk. Yours are getting shorter and better. Carry on.'] },
  adeyemi_promote: {
    npc: 'adeyemi',
    lines: ['{abbr} {name}, front and centre.', 'For conduct in the field, and because the people beside you say so, you are promoted to the rank of {newrank}.', '{duty}'],
    cmd: { type: 'promote' },
  },
  adeyemi_commission: {
    npc: 'adeyemi',
    lines: [
      'Colonel Strand is in a cell and her ledgers are on my desk. That was your operation from first to last.',
      'I do not have enough officers and I have a Master Sergeant who plans like one. Raise your right hand, {name}.',
      'By the authority of the Corvane Defence Council I commission you a Second Lieutenant. You will lead a full squad and you will have a drone overhead. Do not make me regret the paperwork.',
    ],
    cmd: { type: 'promote' },
  },
  ending: {
    npc: 'adeyemi',
    lines: [
      'I have been a soldier for thirty-one years and I have never read a citation like the one I am about to write.',
      'You came off a truck with nothing but a name. You leave the Citadel having taken it.',
      'There is still an island to put back together, and stragglers in the hills. But the war is won, {abbr} {name}. Go and tell your squad.',
    ],
  },
  pops_shop: { npc: 'pops', lines: ['What’ll it be, {abbr}? If it shoots, straps on or goes bang, I’ve got it or I can get it. Rank opens the good shelves.'], cmd: { type: 'overlay', name: 'shop' } },
  pops_recruit: { npc: 'pops', lines: ['Recruits get what the Army issued them and they’re grateful. Come back when you’ve graduated and been paid.'] },
  top_barracks: { npc: 'top', lines: ['These are the soldiers looking for a squad, {abbr}. Pick the ones you’ll want beside you when it goes wrong.'], cmd: { type: 'overlay', name: 'barracks' } },
  top_early: { npc: 'top', lines: ['You’ll get soldiers of your own when you make Corporal. Until then you’re one of Kaplan’s, and lucky to be.'] },
  doc_heal: { npc: 'doc', lines: ['Sit. Let me look at you. ...You’ll live. Try to bring the squad back in the same condition.'], cmd: { type: 'heal' } },
  holt_travel: { npc: 'holt', lines: ['Bird’s fuelled, {abbr}. Where to?'], cmd: { type: 'overlay', name: 'travel' } },
  holt_early: { npc: 'holt', lines: ['Flight line’s for soldiers with somewhere to be. Graduate first.'] },

  // ---------- Brightwater ----------
  elder_brightwater: {
    npc: 'elder',
    lines: ['Another uniform. The last ones took our goats and the ones before took our sons. What do you want from Brightwater, soldier?'],
    choices: [
      { text: 'Ask what the village needs, and offer what you can honestly give.', check: { attr: 'negotiating', dc: 24 }, pass: 'elder_trust', fail: 'elder_wary' },
      { text: 'Tell her plainly what is coming tonight and where her people should shelter.', check: { attr: 'communication', dc: 28 }, pass: 'elder_trust', fail: 'elder_wary' },
      { text: 'Tell her you are here to defend the village and she can help or stay out of the way.', goto: 'elder_cold' },
    ],
  },
  elder_trust: {
    npc: 'elder',
    lines: ['...You ask. Nobody asks. Our shepherds saw them gathering in the north-east orchard. They will come from there first.', 'Two of our young people have rifles and know these lanes. They will stand with you. Keep them alive.'],
    cmd: { type: 'flag', flag: 'elder', value: 'trust' },
  },
  elder_wary: {
    npc: 'elder',
    lines: ['Fine words. I have heard fine words. They will come from the north-east. That is all I will give you, and it is more than you gave us.'],
    cmd: { type: 'flag', flag: 'elder', value: 'wary' },
  },
  elder_cold: { npc: 'elder', lines: ['Then defend it. We will be in our cellars, as we always are.'], cmd: { type: 'flag', flag: 'elder', value: 'cold' } },

  // ---------- locals ----------
  local_talk: {
    npc: 'local',
    lines: ['You’re with the Defence Force? Keep your voice down.'],
    choices: [
      { text: 'Ask, gently, whether they have seen where the Legion keeps its stores.', check: { attr: 'negotiating', dc: 18 }, pass: 'local_tip', fail: 'local_none' },
      { text: 'Leave them be.', end: true },
    ],
  },
  local_tip: { npc: 'local', lines: ['There’s a cache the patrols use. I’ll mark it for you. You didn’t hear it from me.'], cmd: { type: 'revealCache' } },
  local_none: { npc: 'local', lines: ['I don’t know anything. Please. I have children.'] },
};

// Which dialog a person at the camp opens with, given where the soldier is in the story.
export function npcDialog(save, npcId) {
  const training = trainingSummary(save);
  const recruit = save.phase !== 'service';
  switch (npcId) {
    case 'briggs':
      if (save.phase === 'intake') return 'arrival';
      if (recruit) return training.complete ? 'briggs_graduate' : save.story.seen?.briggs_training_start ? 'briggs_training_progress' : 'briggs_training_start';
      return 'briggs_after';
    case 'finch':
      return save.phase === 'intake' ? 'finch_intake' : 'finch_after';
    case 'okoro':
      return 'okoro_intro';
    case 'vasquez':
      return 'vasquez_intro';
    case 'ilves':
      return 'ilves_intro';
    case 'dane':
      return 'dane_intro';
    case 'sato':
      return recruit ? 'sato_exam' : 'sato_after';
    case 'marsh': {
      if (recruit) return null;
      if (!save.story.seen?.marsh_first) return 'marsh_first';
      if (storyFinished(save)) return 'marsh_done';
      const next = nextStory(save);
      return next && missionLock(save, next) ? 'marsh_locked' : 'marsh_ops';
    }
    case 'adeyemi': {
      if (recruit) return null;
      const due = promotionDue(save);
      if (due !== null) return RANKS[due].id === '2lt' || (save.rank < 8 && due >= 8) ? 'adeyemi_commission' : 'adeyemi_promote';
      if (storyFinished(save) && !save.story.seen?.ending) return 'ending';
      return 'adeyemi_idle';
    }
    case 'pops':
      return recruit ? 'pops_recruit' : 'pops_shop';
    case 'top':
      return recruit || save.rank < 3 ? 'top_early' : 'top_barracks';
    case 'doc':
      return 'doc_heal';
    case 'holt':
      return recruit ? 'holt_early' : 'holt_travel';
    case 'local':
      return 'local_talk';
    default:
      return null;
  }
}

// Replaces the {tokens} in a line.
export function fillText(text, save) {
  const training = trainingSummary(save);
  const due = promotionDue(save);
  const next = nextStory(save);
  const values = {
    name: save.name,
    callsign: save.callsign || save.name,
    rank: RANKS[save.rank].name,
    abbr: RANKS[save.rank].abbr,
    spec: specOf(save.spec)?.name ?? 'recruit',
    done: String(training.done),
    left: training.remaining.map((id) => EVENTS.find((e) => e.id === id).name).join(', '),
    average: String(training.average),
    verdict: training.honors ? 'That makes you Honor Graduate of this cycle. Do not let it go to your head.' : training.average >= 60 ? 'Solid. I have sent worse north and they did fine.' : 'It will have to do. The field will teach you what I could not.',
    newrank: due !== null ? RANKS[due].name : RANKS[save.rank].name,
    duty: due !== null ? RANKS[due].duty : '',
    lock: next ? missionLock(save, next) ?? '' : '',
  };
  return String(text).replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match);
}

export const checkPasses = (check, attrs) => !check || (attrs[check.attr] ?? 0) >= check.dc;
