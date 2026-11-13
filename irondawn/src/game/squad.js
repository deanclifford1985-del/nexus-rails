// The soldiers you lead. A squad member has a role, a level and a handful of attributes of their
// own; memberCombat() adds your leadership aura and a share of your own skills on top.

import { B, clamp, mulberry } from './balance.js';
import { RANKS } from './ranks.js';
import { hasPerk } from './specializations.js';

export const ROLES = {
  rifleman: {
    id: 'rifleman', name: 'Rifleman', weapon: 's_rifle', text: 'Steady all-rounder. Goes where you point.',
    base: { accuracy: 30, toughness: 30, quickness: 28, stealth: 20, perception: 25, medicine: 5 }, grows: ['accuracy', 'toughness'],
  },
  marksman: {
    id: 'marksman', name: 'Marksman', weapon: 's_dmr', text: 'Slow, deliberate fire that reaches a long way.',
    base: { accuracy: 42, toughness: 22, quickness: 24, stealth: 30, perception: 38, medicine: 5 }, grows: ['accuracy', 'perception'],
  },
  medic: {
    id: 'medic', name: 'Medic', weapon: 's_carbine', text: 'Patches the squad up between bursts and gets you back on your feet.',
    base: { accuracy: 24, toughness: 26, quickness: 26, stealth: 22, perception: 26, medicine: 45 }, grows: ['medicine', 'quickness'],
  },
  gunner: {
    id: 'gunner', name: 'Gunner', weapon: 's_lmg', text: 'Long bursts that keep heads down. Loud and proud.',
    base: { accuracy: 26, toughness: 42, quickness: 18, stealth: 10, perception: 22, medicine: 5 }, grows: ['toughness', 'accuracy'],
  },
  scout: {
    id: 'scout', name: 'Scout', weapon: 's_smg', text: 'Quiet, quick and sees them first. Carries a suppressed SMG.',
    base: { accuracy: 28, toughness: 22, quickness: 38, stealth: 44, perception: 40, medicine: 5 }, grows: ['stealth', 'perception'],
  },
  engineer: {
    id: 'engineer', name: 'Engineer', weapon: 's_shotgun', text: 'Close-range muscle. Sets mines when you hold a position.',
    base: { accuracy: 26, toughness: 34, quickness: 26, stealth: 18, perception: 24, medicine: 8 }, grows: ['toughness', 'quickness'],
  },
};
export const ROLE_IDS = Object.keys(ROLES);
export const MEMBER_ATTRS = ['accuracy', 'toughness', 'quickness', 'stealth', 'perception', 'medicine'];

// Squad weapons work like enemy weapons: rolled bursts.
export const SQUAD_WEAPONS = {
  s_rifle: { name: 'M6 Carbine', damage: 21, burst: 3, rate: 0.11, pause: 1.0, range: 120, noise: 120 },
  s_carbine: { name: 'M6 Carbine', damage: 19, burst: 3, rate: 0.11, pause: 1.1, range: 110, noise: 120 },
  s_dmr: { name: 'Longbow DMR', damage: 50, burst: 1, rate: 0.5, pause: 1.6, range: 320, noise: 140 },
  s_lmg: { name: 'Bulldog LMG', damage: 18, burst: 8, rate: 0.09, pause: 1.4, range: 150, noise: 150 },
  s_smg: { name: 'Wraith SD', damage: 14, burst: 5, rate: 0.085, pause: 0.9, range: 50, noise: 18 },
  s_shotgun: { name: 'Breacher 12', damage: 58, burst: 1, rate: 0.5, pause: 1.1, range: 22, noise: 110 },
};

const FIRST = ['Mara', 'Jonas', 'Tariq', 'Ines', 'Dmitri', 'Kofi', 'Hana', 'Luis', 'Priya', 'Owen', 'Yara', 'Marek', 'Chidi', 'Sofia', 'Ravi', 'Greta', 'Emeka', 'Lena', 'Tomas', 'Aiko', 'Nadia', 'Felix', 'Zane', 'Ruth', 'Idris', 'Petra'];
const LAST = ['Okafor', 'Reyes', 'Lindqvist', 'Haddad', 'Novak', 'Mensah', 'Tanaka', 'Castillo', 'Rao', 'Brennan', 'Aziz', 'Kowalski', 'Eze', 'Marin', 'Varga', 'Holt', 'Adeyemi', 'Fischer', 'Duarte', 'Sato', 'Petrov', 'Moreau', 'Cole', 'Abara', 'Stone', 'Ilves'];
const NICKS = ['Sparrow', 'Brick', 'Doc', 'Ghost', 'Lucky', 'Bishop', 'Echo', 'Rook', 'Viper', 'Hound', 'Patch', 'Flint', 'Mouse', 'Tank', 'Wren', 'Ash', 'Fox', 'Saint', 'Quill', 'Moth'];

const pick = (rng, list) => list[Math.floor(rng() * list.length)];

export const memberXpForLevel = (level) => Math.round(B.SQUAD.XP_BASE * Math.pow(Math.max(0, level - 1), 1.7));

export function makeSoldier(rng, { role = pick(rng, ROLE_IDS), level = 1 } = {}) {
  const def = ROLES[role];
  const attrs = {};
  for (const attr of MEMBER_ATTRS) {
    const growth = def.grows.includes(attr) ? 1 : 0.5;
    attrs[attr] = clamp(Math.round(def.base[attr] + (level - 1) * B.SQUAD.STAT_PER_LEVEL * growth + (rng() * 8 - 4)), 1, 100);
  }
  return {
    id: `s${Math.floor(rng() * 1e9).toString(36)}`,
    first: pick(rng, FIRST),
    name: pick(rng, LAST),
    nick: pick(rng, NICKS),
    skin: Math.floor(rng() * 5),
    role,
    level,
    xp: memberXpForLevel(level),
    attrs,
    status: 'ready', // ready | wounded
    out: 0, // missions left on the wounded list
    kills: 0,
    missions: 0,
  };
}

export const memberRank = (member) => (member.level >= 13 ? 'SGT' : member.level >= 8 ? 'CPL' : member.level >= 4 ? 'PFC' : 'PVT');
export const memberLabel = (member) => `${memberRank(member)} ${member.name}`;

// How many soldiers this rank may lead.
export function squadCap(save) {
  const base = RANKS[save.rank]?.squad ?? 0;
  const extra = hasPerk(save, 'born_leader') && save.rank >= 1 ? 1 : 0;
  return Math.min(8, base + extra);
}
export const ROSTER_MAX = 12;

export function recruitCost(member, priceMul = 1) {
  return Math.round((B.SQUAD.RECRUIT_COST.base + B.SQUAD.RECRUIT_COST.perLevel * member.level) * priceMul);
}

// The soldiers waiting at the barracks. The list changes after every mission.
export function recruitOffers(save, count = 5) {
  const rng = mulberry((save.squad.seed + (save.stats.missions + save.stats.failed) * 7919 + save.rank * 104729) | 0);
  const top = Math.max(1, Math.round(save.level * 0.7));
  const offers = [];
  const taken = new Set(save.squad.roster.map((m) => m.id));
  for (let i = 0; i < count; i++) {
    const role = i < ROLE_IDS.length ? ROLE_IDS[(i + Math.floor(rng() * ROLE_IDS.length)) % ROLE_IDS.length] : pick(rng, ROLE_IDS);
    const level = clamp(Math.round(top - rng() * Math.min(4, top)), 1, B.SQUAD.LEVEL_CAP);
    const soldier = makeSoldier(rng, { role, level });
    if (!taken.has(soldier.id)) offers.push(soldier);
  }
  return offers;
}

// A squad member's fighting numbers under this leader. `derived` is the leader's deriveStats().
export function memberCombat(member, derived) {
  const S = B.SQUAD;
  const aura = derived?.aura ?? { acc: 1, dmg: 1, hp: 1, reaction: 1, transfer: 0 };
  const lead = derived?.attrs ?? {};
  const eff = (attr) => clamp(member.attrs[attr] + (lead[attr] ?? 0) * aura.transfer, 1, 100);
  const role = ROLES[member.role] ?? ROLES.rifleman;
  const weapon = SQUAD_WEAPONS[role.weapon];
  return {
    role: role.id,
    maxHealth: Math.round((S.HEALTH.base + eff('toughness') * S.HEALTH.toughness) * aura.hp),
    accuracy: (S.ACCURACY.base + eff('accuracy') * S.ACCURACY.accuracy) * aura.acc,
    damageMul: aura.dmg * (1 + (member.level - 1) * 0.02),
    view: S.VIEW.base + eff('perception') * S.VIEW.perception,
    stealth: clamp(eff('stealth') * B.DERIVE.STEALTH.stealth, 0, B.DERIVE.STEALTH.cap),
    reaction: Math.max(0.2, (0.9 - eff('quickness') * 0.006) * aura.reaction),
    evade: clamp(eff('quickness') * 0.003, 0, 0.35),
    heal: role.id === 'medic' ? Math.round(S.MEDIC_HEAL + eff('medicine') * 0.6) : 0,
    weaponId: role.weapon,
    weapon: { ...weapon, damage: weapon.damage * aura.dmg * (1 + (member.level - 1) * 0.02) },
    eff: Object.fromEntries(MEMBER_ATTRS.map((attr) => [attr, Math.round(eff(attr))])),
  };
}

// Experience for a squad member; returns levels gained.
export function memberAddXp(member, amount) {
  member.xp += Math.max(0, Math.round(amount));
  let levels = 0;
  while (member.level < B.SQUAD.LEVEL_CAP && member.xp >= memberXpForLevel(member.level + 1)) {
    member.level++;
    levels++;
    const role = ROLES[member.role] ?? ROLES.rifleman;
    for (const attr of MEMBER_ATTRS) {
      const growth = role.grows.includes(attr) ? 1 : 0.5;
      member.attrs[attr] = clamp(member.attrs[attr] + B.SQUAD.STAT_PER_LEVEL * growth, 1, 100);
    }
  }
  return levels;
}

export const activeSquad = (save) => save.squad.active.map((id) => save.squad.roster.find((m) => m.id === id)).filter((m) => m && m.status === 'ready');
