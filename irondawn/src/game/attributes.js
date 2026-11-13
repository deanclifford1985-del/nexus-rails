// The soldier's attributes. Every one runs from 1 to 100 and feeds deriveStats() in character.js.
// `uses` is shown on the character sheet; `practice` says what raises it in the field.

export const ATTR_MIN = 1;
export const ATTR_MAX = 100;

export const GROUPS = [
  { id: 'body', name: 'Body', blurb: 'What your legs, lungs and back can take.' },
  { id: 'marksmanship', name: 'Marksmanship', blurb: 'Putting rounds where you want them.' },
  { id: 'fieldcraft', name: 'Fieldcraft', blurb: 'Seeing first and being seen last.' },
  { id: 'mind', name: 'Mind', blurb: 'Thinking, fixing and patching up.' },
  { id: 'command', name: 'Command', blurb: 'Getting more out of the people around you.' },
];

export const ATTRIBUTES = [
  // Body
  {
    id: 'endurance',
    name: 'Endurance',
    group: 'body',
    uses: 'Stamina pool and recovery, sprint cost, a little health.',
    practice: 'Sprinting and long marches.',
  },
  { id: 'speed', name: 'Speed', group: 'body', uses: 'Run and sprint speed, a little evade.', practice: 'Covering ground on foot.' },
  {
    id: 'quickness',
    name: 'Quickness',
    group: 'body',
    uses: 'Evade, reload and weapon-swap time, aiming time, takedown speed.',
    practice: 'Reloads under fire, close kills, dodging shots.',
  },
  {
    id: 'strength',
    name: 'Strength',
    group: 'body',
    uses: 'Carry weight, recoil control, melee damage, throwing distance.',
    practice: 'Carrying a heavy load, melee, firing heavy weapons.',
  },
  {
    id: 'climbing',
    name: 'Climbing',
    group: 'body',
    uses: 'How steep a slope you can take, how high a wall you can scale, fall damage.',
    practice: 'Scaling walls and steep ground.',
  },
  {
    id: 'toughness',
    name: 'Toughness',
    group: 'body',
    uses: 'Maximum health and resistance to wounds.',
    practice: 'Taking hits and staying in the fight.',
  },
  // Marksmanship
  {
    id: 'accuracy',
    name: 'Accuracy',
    group: 'marksmanship',
    uses: 'Tighter spread and steadier recoil with every firearm, a little damage.',
    practice: 'Hitting what you shoot at.',
  },
  {
    id: 'scope',
    name: 'Scope Skill',
    group: 'marksmanship',
    uses: 'Scope sway, how long you can hold your breath, long-range damage.',
    practice: 'Scoped hits at distance.',
  },
  // Fieldcraft
  {
    id: 'stealth',
    name: 'Stealth',
    group: 'fieldcraft',
    uses: 'How slowly enemies notice you and how far your noise carries.',
    practice: 'Moving unseen near the enemy, silent takedowns.',
  },
  {
    id: 'vision',
    name: 'Vision',
    group: 'fieldcraft',
    uses: 'Distance at which you pick out and tag enemies, night sight.',
    practice: 'Spotting enemies at range.',
  },
  {
    id: 'perception',
    name: 'Perception',
    group: 'fieldcraft',
    uses: 'Sensing nearby enemies, traps and caches; warns you when you are being watched.',
    practice: 'Finding caches, sensing hidden enemies.',
  },
  // Mind
  {
    id: 'intelligence',
    name: 'Intelligence',
    group: 'mind',
    uses: 'Experience gained, how fast skills improve with practice, planning.',
    practice: 'Collecting intel, completing objectives.',
  },
  { id: 'medicine', name: 'Medicine', group: 'mind', uses: 'Healing from medkits and bandages, revive time.', practice: 'Treating wounds.' },
  {
    id: 'engineering',
    name: 'Engineering',
    group: 'mind',
    uses: 'Explosive power, time to plant or disarm charges, fieldworks you can build.',
    practice: 'Explosives and demolition work.',
  },
  // Command
  {
    id: 'leadership',
    name: 'Leadership',
    group: 'command',
    uses: "Your squad's accuracy, damage and health, and how much of your own skill rubs off on them.",
    practice: 'Leading a squad through a fight.',
  },
  {
    id: 'communication',
    name: 'Communication',
    group: 'command',
    uses: 'Command range, how fast orders are carried out, support call cooldowns, shared spotting.',
    practice: 'Giving orders and calling support.',
  },
  {
    id: 'negotiating',
    name: 'Negotiating',
    group: 'command',
    uses: 'Quartermaster prices, mission pay, talking enemies into surrender, getting locals to talk.',
    practice: 'Deals, surrenders and talking to locals.',
  },
];

export const ATTR_IDS = ATTRIBUTES.map((a) => a.id);
const BY_ID = Object.fromEntries(ATTRIBUTES.map((a) => [a.id, a]));
export const attrInfo = (id) => BY_ID[id];
export const attrsInGroup = (groupId) => ATTRIBUTES.filter((a) => a.group === groupId);
