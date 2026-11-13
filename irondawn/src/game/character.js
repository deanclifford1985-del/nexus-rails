// The soldier: creation, attributes, experience, practice and deriveStats(), the one place that
// turns attributes and gear into the numbers the simulation fights with.

import { B, clamp } from './balance.js';
import { ATTR_IDS, ATTR_MAX, ATTR_MIN } from './attributes.js';
import { GEAR, GEAR_SLOTS, ITEMS, WEAPONS, weaponWithAttachments } from './items.js';
import { specOf } from './specializations.js';
import { RANKS } from './ranks.js';

export const SAVE_VERSION = 1;

const newId = () => Math.random().toString(36).slice(2, 10);

export const EMPTY_GEAR = () => Object.fromEntries(Object.keys(GEAR_SLOTS).map((slot) => [slot, null]));

// A recruit straight off the bus: no specialization, no training, nothing but fatigues.
export function newCharacter({ name, callsign = '', skin = 0, now = Date.now() }) {
  const clean = String(name ?? '').trim().slice(0, 18) || 'Recruit';
  return {
    version: SAVE_VERSION,
    id: newId(),
    createdAt: now,
    updatedAt: now,
    name: clean,
    callsign: String(callsign ?? '').trim().slice(0, 14),
    look: { skin: clamp(skin | 0, 0, 4) },
    spec: null,
    phase: 'intake', // intake -> training -> service
    training: { results: {}, graduated: false, honors: false },
    attrs: Object.fromEntries(ATTR_IDS.map((id) => [id, B.ATTR.START])),
    practice: Object.fromEntries(ATTR_IDS.map((id) => [id, 0])),
    level: 1,
    xp: 0,
    points: 0,
    rank: 0,
    rp: B.ECON.START_RP,
    weapons: [],
    nextUid: 1,
    attachments: {},
    gearOwned: ['bdu', 'issue'],
    loadout: { primary: null, secondary: null, gear: { ...EMPTY_GEAR(), uniform: 'bdu', boots: 'issue' } },
    items: {},
    squad: { roster: [], active: [], seed: Math.floor(Math.random() * 1e9), offers: null },
    story: { done: [], flags: {}, seen: {} },
    contracts: { seed: Math.floor(Math.random() * 1e9), done: 0 },
    world: { hour: B.WORLD.START_HOUR, day: 1, liberated: {}, looted: {}, discovered: { hawthorne: true }, at: 'hawthorne' },
    records: {},
    stats: { kills: 0, headshots: 0, stealthKills: 0, longestShot: 0, missions: 0, failed: 0, shots: 0, hits: 0, rescued: 0, captured: 0, downs: 0, playSeconds: 0, squadKills: 0 },
    medals: [],
    log: [],
  };
}

export function addWeapon(save, id, att = {}) {
  const uid = `w${save.nextUid++}`;
  save.weapons.push({ uid, id, att: { ...att } });
  return uid;
}

// Intake: the specialization adds its bonuses and issues its kit.
export function applySpec(save, specId) {
  const spec = specOf(specId);
  if (!spec) throw new Error(`No such specialization: ${specId}`);
  save.spec = spec.id;
  for (const [attr, bonus] of Object.entries(spec.bonuses)) save.attrs[attr] = clamp(save.attrs[attr] + bonus, ATTR_MIN, ATTR_MAX);
  save.weapons = [];
  save.loadout.primary = addWeapon(save, spec.kit.primary.id, spec.kit.primary.att);
  save.loadout.secondary = addWeapon(save, spec.kit.secondary.id, spec.kit.secondary.att);
  const owned = new Set(save.gearOwned);
  for (const [slot, gearId] of Object.entries(spec.kit.gear)) {
    if (gearId) {
      owned.add(gearId);
      save.loadout.gear[slot] = gearId;
    }
  }
  save.gearOwned = [...owned];
  save.items = { ...spec.kit.items };
  save.phase = 'training';
  return spec;
}

// ---------- gear ----------
export function gearTotals(save) {
  const out = { attrs: {}, armor: 0, armorHead: 0, health: 0, speed: 1, carry: 0, ammo: 1, noise: 1, nightStealth: 0, mantle: 0, commandRange: 1, tracking: 0, planning: 0, weight: 0, extra: {}, enables: {}, rangefinder: false };
  const seen = new Set();
  for (const slot of Object.keys(GEAR_SLOTS)) {
    const gear = GEAR[save.loadout.gear[slot]];
    if (!gear || seen.has(gear.id)) continue; // the same device in both kit slots counts once
    seen.add(gear.id);
    for (const [attr, bonus] of Object.entries(gear.attrs ?? {})) out.attrs[attr] = (out.attrs[attr] ?? 0) + bonus;
    out.armor += gear.armor ?? 0;
    out.armorHead += gear.armorHead ?? 0;
    out.health += gear.health ?? 0;
    out.speed *= gear.speed ?? 1;
    out.carry += gear.carry ?? 0;
    out.ammo *= gear.ammo ?? 1;
    out.noise *= gear.noise ?? 1;
    out.nightStealth += gear.nightStealth ?? 0;
    out.mantle += gear.mantle ?? 0;
    out.commandRange *= gear.commandRange ?? 1;
    out.tracking += gear.tracking ?? 0;
    out.planning += gear.planning ?? 0;
    out.weight += gear.weight ?? 0;
    if (gear.enables) out.enables[gear.enables] = true;
    if (gear.rangefinder) out.rangefinder = true;
    for (const [item, n] of Object.entries(gear.extra ?? {})) out.extra[item] = (out.extra[item] ?? 0) + n;
  }
  return out;
}

export const weaponByUid = (save, uid) => save.weapons.find((w) => w.uid === uid) ?? null;
export const primaryOf = (save) => weaponByUid(save, save.loadout.primary);
export const secondaryOf = (save) => weaponByUid(save, save.loadout.secondary);

// Attributes with gear on, capped at 100.
export function totalAttrs(save, gear = gearTotals(save)) {
  const out = {};
  for (const id of ATTR_IDS) out[id] = clamp(Math.floor(save.attrs[id] ?? B.ATTR.START) + (gear.attrs[id] ?? 0), ATTR_MIN, ATTR_MAX);
  return out;
}

export function carryLimits(save, gear = gearTotals(save)) {
  const sapper = specOf(save.spec)?.perk.id === 'sapper';
  const out = {};
  for (const item of Object.values(ITEMS)) {
    let n = item.carry + (gear.extra[item.id] ?? 0);
    if (sapper && (item.id === 'frag' || item.id === 'mine')) n += 2;
    out[item.id] = n;
  }
  return out;
}

export function loadWeight(save, gear = gearTotals(save)) {
  let kg = gear.weight;
  for (const uid of [save.loadout.primary, save.loadout.secondary]) {
    const instance = weaponByUid(save, uid);
    if (instance) kg += weaponWithAttachments(instance)?.weight ?? 0;
  }
  for (const [id, n] of Object.entries(save.items ?? {})) kg += (ITEMS[id]?.weight ?? 0) * n;
  return kg;
}

// ---------- the derived stats ----------
export function deriveStats(save) {
  const D = B.DERIVE;
  const gear = gearTotals(save);
  const a = totalAttrs(save, gear);
  const spec = specOf(save.spec);
  const perk = spec?.perk.id ?? null;

  const carry = D.CARRY.base + a.strength * D.CARRY.strength + gear.carry;
  const load = loadWeight(save, gear);
  const overload = Math.max(0, load / carry - 1);
  const speedMul = gear.speed * (1 - clamp(overload * D.OVERLOAD_SLOW, 0, 0.6));
  const runSpeed = D.RUN.base * (1 + a.speed * D.RUN.speed) * speedMul;

  const evade = clamp(D.EVADE.base + a.quickness * D.EVADE.quickness + a.speed * D.EVADE.speed - overload * 0.15, 0, D.EVADE.cap);
  const tracking = clamp(a.perception * D.TRACKING.perception + a.vision * D.TRACKING.vision + a.intelligence * D.TRACKING.intelligence + gear.tracking, 0, 100);
  const planning = clamp(a.intelligence * D.PLANNING.intelligence + a.leadership * D.PLANNING.leadership + a.communication * D.PLANNING.communication + a.perception * D.PLANNING.perception + gear.planning, 0, 100);
  const auraBoost = perk === 'born_leader' ? 1.25 : 1;
  const healBoost = perk === 'lifesaver' ? 1.5 : 1;

  const derived = {
    attrs: a,
    perk,
    // survival
    maxHealth: Math.round(D.HEALTH.base + a.toughness * D.HEALTH.toughness + a.endurance * D.HEALTH.endurance + gear.health + (perk === 'walking_fire' ? 25 : 0)),
    armor: clamp(gear.armor, 0, 0.6),
    armorHead: clamp(gear.armorHead, 0, 0.6),
    evade,
    // movement
    maxStamina: Math.round(D.STAMINA.base + a.endurance * D.STAMINA.endurance),
    staminaRegen: D.STAMINA_REGEN.base + a.endurance * D.STAMINA_REGEN.endurance,
    sprintCost: D.SPRINT_COST.base / (1 + a.endurance * D.SPRINT_COST.endurance),
    runSpeed,
    sprintSpeed: runSpeed * D.SPRINT_MUL,
    crouchSpeed: runSpeed * D.CROUCH_MUL,
    proneSpeed: runSpeed * D.PRONE_MUL,
    carry,
    load,
    overload,
    maxSlope: D.SLOPE.base + a.climbing * D.SLOPE.climbing,
    mantle: D.MANTLE.base + a.climbing * D.MANTLE.climbing + gear.mantle,
    climbSpeed: D.CLIMB_SPEED.base + a.climbing * D.CLIMB_SPEED.climbing,
    fallMul: 1 - a.climbing * D.FALL.climbing,
    // shooting
    spreadMul: Math.max(D.SPREAD.min, D.SPREAD.base - a.accuracy * D.SPREAD.accuracy),
    recoilMul: Math.max(D.RECOIL.min, D.RECOIL.base - a.accuracy * D.RECOIL.accuracy - a.strength * D.RECOIL.strength),
    damageMul: 1 + a.accuracy * D.DAMAGE.accuracy,
    meleeDamage: Math.round(D.MELEE.base + a.strength * D.MELEE.strength),
    swayMul: Math.max(D.SWAY.min, D.SWAY.base - a.scope * D.SWAY.scope),
    breathSeconds: (D.BREATH.base + a.scope * D.BREATH.scope) * (perk === 'one_shot' ? 1.5 : 1),
    longRangeMul: 1 + a.scope * D.LONG_RANGE.scope,
    adsTime: D.ADS_TIME.base * (1 - a.quickness * D.ADS_TIME.quickness),
    reloadMul: 1 - a.quickness * D.RELOAD.quickness,
    ammoMul: gear.ammo,
    // fieldcraft
    stealth: clamp(a.stealth * D.STEALTH.stealth, 0, D.STEALTH.cap),
    nightStealth: gear.nightStealth,
    noiseMul: (1 - a.stealth * D.NOISE.stealth) * gear.noise,
    visionRange: D.VISION.base + a.vision * D.VISION.vision,
    nightSight: clamp(D.NIGHT_SIGHT.base + a.vision * D.NIGHT_SIGHT.vision, 0, 1),
    awareness: D.AWARENESS.base + a.perception * D.AWARENESS.perception,
    tracking,
    tagSeconds: (D.TAG_SECONDS.base + tracking * D.TAG_SECONDS.tracking) * (perk === 'shadow' ? 2 : 1),
    // mind
    planning,
    planPoints: D.PLAN_POINTS.base + Math.floor(planning / D.PLAN_POINTS.per),
    intelReveal: clamp(planning * D.INTEL_REVEAL, 0, 0.9),
    medkitHeal: Math.round((D.HEAL.medkit + a.medicine * D.HEAL.medkitMed) * healBoost),
    bandageHeal: Math.round((D.HEAL.bandage + a.medicine * D.HEAL.bandageMed) * healBoost),
    reviveSeconds: Math.max(D.REVIVE.min, (D.REVIVE.base - a.medicine * D.REVIVE.medicine) / (perk === 'lifesaver' ? 2 : 1)),
    explosiveMul: (1 + a.engineering * D.EXPLOSIVE.engineering) * (perk === 'sapper' ? 1.3 : 1),
    plantMul: (1 - a.engineering * D.PLANT.engineering) / (perk === 'sapper' ? 2 : 1),
    xpMul: 1 + a.intelligence * D.XP_MUL.intelligence,
    practiceMul: 1 + a.intelligence * D.PRACTICE_MUL.intelligence,
    // command
    aura: {
      acc: 1 + a.leadership * D.AURA.acc * auraBoost,
      dmg: 1 + a.leadership * D.AURA.dmg * auraBoost,
      hp: 1 + a.leadership * D.AURA.hp * auraBoost,
      reaction: 1 - a.leadership * D.AURA.reaction * auraBoost,
      transfer: (D.AURA.transferBase + a.leadership * D.AURA.transfer) * auraBoost,
    },
    commandRange: (D.COMMAND_RANGE.base + a.communication * D.COMMAND_RANGE.communication) * gear.commandRange,
    orderDelay: Math.max(D.ORDER_DELAY.min, D.ORDER_DELAY.base - a.communication * D.ORDER_DELAY.communication),
    supportCooldownMul: (1 - a.communication * D.SUPPORT_COOLDOWN.communication) * (perk === 'born_leader' ? 0.8 : 1),
    priceMul: 1 - a.negotiating * D.PRICE.negotiating,
    sellMul: D.SELL.base + a.negotiating * D.SELL.negotiating,
    payMul: 1 + a.negotiating * D.PAY.negotiating,
    surrender: D.SURRENDER.base + a.negotiating * D.SURRENDER.negotiating,
    // gear switches
    enables: gear.enables,
    rangefinder: gear.rangefinder,
    carryLimits: carryLimits(save, gear),
  };
  derived.rating = combatRating(save, derived);
  return derived;
}

// A weapon's numbers in this soldier's hands: attachments, then skill, then perks.
export function weaponEff(save, instance, derived = deriveStats(save)) {
  const w = weaponWithAttachments(instance);
  if (!w) return null;
  const perk = derived.perk;
  let recoil = w.recoil * derived.recoilMul;
  let damage = w.damage * derived.damageMul;
  let bloom = 1;
  if (perk === 'fire_discipline') {
    bloom = 0.7;
    if (w.class === 'carbine' || w.class === 'rifle') damage *= 1.1;
  }
  if (perk === 'walking_fire' && (w.class === 'lmg' || w.class === 'shotgun')) recoil *= 0.7;
  const scopedDamage = w.scoped ? derived.longRangeMul : 1;
  return {
    ...w,
    uid: instance.uid,
    damage: damage * scopedDamage,
    spread: w.spread * derived.spreadMul,
    recoil,
    bloom,
    reload: w.reload * derived.reloadMul,
    adsTime: derived.adsTime * w.ads,
    sway: derived.swayMul,
    reserveMax: Math.round(w.reserve * derived.ammoMul),
    interval: 60 / w.rpm,
    headMul: w.class === 'sniper' ? B.COMBAT.SNIPER_HEAD : B.COMBAT.ZONE.head,
  };
}

// One number for "how dangerous is this soldier", shown against a mission's recommended rating.
export function combatRating(save, derived) {
  const a = derived.attrs;
  const sum = ATTR_IDS.reduce((total, id) => total + a[id], 0);
  const primary = primaryOf(save);
  const weapon = primary ? WEAPONS[primary.id] : null;
  const attachments = primary ? Object.values(primary.att ?? {}).filter(Boolean).length : 0;
  const weaponScore = weapon ? weapon.tier * 25 + attachments * 6 : 0;
  const armorScore = (derived.armor + derived.armorHead) * 100;
  return Math.round(save.level * 8 + (sum / ATTR_IDS.length) * 5 + weaponScore + armorScore);
}

// ---------- experience ----------
export const xpForLevel = (level) => Math.round(B.XP.BASE * Math.pow(Math.max(0, level - 1), B.XP.POWER));
export function levelForXp(xp) {
  let level = 1;
  while (level < B.XP.LEVEL_CAP && xp >= xpForLevel(level + 1)) level++;
  return level;
}

// Adds experience (scaled by Intelligence unless raw), levels up and banks attribute points.
export function addXp(save, amount, { raw = false } = {}) {
  const gained = Math.max(0, Math.round(amount * (raw ? 1 : deriveStats(save).xpMul)));
  save.xp += gained;
  const before = save.level;
  save.level = levelForXp(save.xp);
  const levels = save.level - before;
  save.points += levels * B.ATTR.POINTS_PER_LEVEL;
  return { gained, levels, points: levels * B.ATTR.POINTS_PER_LEVEL };
}

export const levelProgress = (save) => {
  const here = xpForLevel(save.level);
  const next = save.level >= B.XP.LEVEL_CAP ? here : xpForLevel(save.level + 1);
  return { here, next, into: save.xp - here, span: Math.max(1, next - here), share: save.level >= B.XP.LEVEL_CAP ? 1 : clamp((save.xp - here) / Math.max(1, next - here), 0, 1) };
};

// ---------- attribute growth ----------
export function pointCost(value) {
  for (const [upTo, cost] of B.ATTR.POINT_COST) if (value < upTo) return cost;
  return Infinity;
}

export const practiceNeed = (value) => B.ATTR.PRACTICE_BASE * Math.pow(1 + value / B.ATTR.PRACTICE_SCALE, B.ATTR.PRACTICE_POWER);

// Field practice: gains is { attr: units }. Returns the attributes that went up.
export function applyPractice(save, gains) {
  const spec = specOf(save.spec);
  const mul = deriveStats(save).practiceMul;
  const ups = [];
  for (const [attr, units] of Object.entries(gains ?? {})) {
    if (!(attr in save.attrs) || !(units > 0)) continue;
    const affinity = spec?.affinity.includes(attr) ? B.ATTR.AFFINITY : 1;
    save.practice[attr] = (save.practice[attr] ?? 0) + units * affinity * mul;
    const from = save.attrs[attr];
    while (save.attrs[attr] < ATTR_MAX && save.practice[attr] >= practiceNeed(save.attrs[attr])) {
      save.practice[attr] -= practiceNeed(save.attrs[attr]);
      save.attrs[attr] += 1;
    }
    if (save.attrs[attr] >= ATTR_MAX) save.practice[attr] = 0;
    if (save.attrs[attr] !== from) ups.push({ attr, from, to: save.attrs[attr] });
  }
  return ups;
}

export const practiceShare = (save, attr) => (save.attrs[attr] >= ATTR_MAX ? 1 : clamp((save.practice[attr] ?? 0) / practiceNeed(save.attrs[attr]), 0, 1));

// ---------- what the character sheet shows ----------
const pct = (v, digits = 0) => `${(v * 100).toFixed(digits)}%`;
const signedPct = (v) => `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(0)}%`;

export function describeDerived(save, derived = deriveStats(save)) {
  const d = derived;
  return [
    {
      id: 'survival',
      name: 'Survival',
      rows: [
        { label: 'Health', value: `${d.maxHealth}`, from: 'Toughness, Endurance, armour' },
        { label: 'Body armour', value: pct(d.armor), from: 'Vest' },
        { label: 'Helmet', value: pct(d.armorHead), from: 'Helmet' },
        { label: 'Evade', value: pct(d.evade), from: 'Quickness, Speed, load' },
      ],
    },
    {
      id: 'movement',
      name: 'Movement',
      rows: [
        { label: 'Run / sprint', value: `${d.runSpeed.toFixed(1)} / ${d.sprintSpeed.toFixed(1)} m/s`, from: 'Speed, load' },
        { label: 'Stamina', value: `${d.maxStamina}`, from: 'Endurance' },
        { label: 'Load', value: `${d.load.toFixed(1)} / ${d.carry.toFixed(0)} kg`, from: 'Strength, pack', warn: d.overload > 0 },
        { label: 'Steepest climb', value: `${d.maxSlope.toFixed(0)}°`, from: 'Climbing' },
        { label: 'Highest ledge', value: `${d.mantle.toFixed(1)} m`, from: 'Climbing, kit' },
      ],
    },
    {
      id: 'shooting',
      name: 'Shooting',
      rows: [
        { label: 'Accuracy', value: signedPct(1 / d.spreadMul - 1), from: 'Accuracy (tighter spread)' },
        { label: 'Damage', value: signedPct(d.damageMul - 1), from: 'Accuracy' },
        { label: 'Recoil', value: signedPct(d.recoilMul - 1), from: 'Accuracy, Strength' },
        { label: 'Scope sway', value: signedPct(d.swayMul - 1), from: 'Scope Skill' },
        { label: 'Hold breath', value: `${d.breathSeconds.toFixed(1)} s`, from: 'Scope Skill' },
        { label: 'Reload time', value: signedPct(d.reloadMul - 1), from: 'Quickness' },
        { label: 'Melee', value: `${d.meleeDamage}`, from: 'Strength' },
      ],
    },
    {
      id: 'fieldcraft',
      name: 'Fieldcraft',
      rows: [
        { label: 'Concealment', value: pct(d.stealth), from: 'Stealth, uniform' },
        { label: 'Spotting range', value: `${d.visionRange.toFixed(0)} m`, from: 'Vision' },
        { label: 'Awareness', value: `${d.awareness.toFixed(0)} m`, from: 'Perception' },
        { label: 'Tracking', value: `${d.tracking.toFixed(0)}`, from: 'Perception, Vision, Intelligence, kit' },
        { label: 'Planning', value: `${d.planning.toFixed(0)} (${d.planPoints} plan point${d.planPoints === 1 ? '' : 's'})`, from: 'Intelligence, Leadership, Communication' },
      ],
    },
    {
      id: 'support',
      name: 'Support',
      rows: [
        { label: 'Medkit heals', value: `${d.medkitHeal}`, from: 'Medicine' },
        { label: 'Explosives', value: signedPct(d.explosiveMul - 1), from: 'Engineering' },
        { label: 'Experience', value: signedPct(d.xpMul - 1), from: 'Intelligence' },
        { label: 'Prices', value: signedPct(d.priceMul - 1), from: 'Negotiating' },
        { label: 'Mission pay', value: signedPct(d.payMul - 1), from: 'Negotiating' },
      ],
    },
    {
      id: 'command',
      name: 'Command',
      rows: [
        { label: 'Squad accuracy', value: signedPct(d.aura.acc - 1), from: 'Leadership' },
        { label: 'Squad damage', value: signedPct(d.aura.dmg - 1), from: 'Leadership' },
        { label: 'Squad health', value: signedPct(d.aura.hp - 1), from: 'Leadership' },
        { label: 'Skill shared', value: pct(d.aura.transfer), from: 'Leadership (share of your skills your squad gains)' },
        { label: 'Command range', value: `${d.commandRange.toFixed(0)} m`, from: 'Communication, radio' },
        { label: 'Support recharge', value: signedPct(d.supportCooldownMul - 1), from: 'Communication' },
      ],
    },
  ];
}

export const fullName = (save) => `${RANKS[save.rank]?.abbr ?? ''} ${save.name}`.trim();
