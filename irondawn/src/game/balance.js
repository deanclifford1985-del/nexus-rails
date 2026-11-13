// Every tunable number in Iron Dawn. Start here to change the game.
// Rules read these; nothing else in the code hides a number that matters to balance.

export const B = {
  // ---------- attributes ----------
  ATTR: {
    START: 5, // every attribute before specialization and training
    POINTS_PER_LEVEL: 3,
    // Spending points gets dearer as an attribute climbs: [up to this value, points per +1]
    POINT_COST: [
      [50, 1],
      [75, 2],
      [100, 3],
    ],
    // Practice: field use needed for +1 at value v is BASE * (1 + v / SCALE) ^ POWER.
    PRACTICE_BASE: 8,
    PRACTICE_SCALE: 10,
    PRACTICE_POWER: 1.5,
    AFFINITY: 1.5, // practice multiplier for a specialization's own attributes
  },

  // ---------- experience ----------
  XP: {
    LEVEL_CAP: 50,
    // Total experience to reach level L is BASE * (L - 1) ^ POWER.
    BASE: 120,
    POWER: 1.85,
    KILL: { rifleman: 14, scout: 16, gunner: 22, marksman: 24, breacher: 18, grenadier: 22, officer: 40, heavy: 34, boss: 150 },
    KILL_TIER: 0.22, // +22% kill experience per enemy tier above 1
    HEADSHOT: 0.5,
    STEALTH_KILL: 0.5,
    LONG_SHOT: 0.5, // beyond LONG_SHOT_M
    LONG_SHOT_M: 150,
    SQUAD_KILL_SHARE: 0.5, // you earn this share of your squad's kills
  },

  // ---------- derived stats (see deriveStats) ----------
  DERIVE: {
    HEALTH: { base: 100, toughness: 1.2, endurance: 0.4 },
    STAMINA: { base: 100, endurance: 1.5 },
    STAMINA_REGEN: { base: 13, endurance: 0.18 },
    SPRINT_COST: { base: 15, endurance: 0.012 }, // per second: base / (1 + endurance * k)
    RUN: { base: 4.6, speed: 0.004 }, // m/s: base * (1 + speed * k)
    SPRINT_MUL: 1.55,
    CROUCH_MUL: 0.52,
    PRONE_MUL: 0.2,
    AIM_MOVE_MUL: 0.6,
    CARRY: { base: 24, strength: 0.46 }, // kg before you slow down
    OVERLOAD_SLOW: 0.5, // speed lost per 100% overload
    EVADE: { base: 0.04, quickness: 0.0035, speed: 0.001, cap: 0.5 },
    SPREAD: { base: 1.25, accuracy: 0.0085, min: 0.35 }, // multiplier on weapon spread
    RECOIL: { base: 1.15, accuracy: 0.004, strength: 0.003, min: 0.45 },
    DAMAGE: { accuracy: 0.002 }, // +0.2% firearm damage per point
    MELEE: { base: 45, strength: 1.3 },
    SWAY: { base: 1.3, scope: 0.011, min: 0.18 },
    BREATH: { base: 2, scope: 0.06 }, // seconds of held breath
    LONG_RANGE: { scope: 0.004 }, // +0.4% scoped damage per point
    ADS_TIME: { base: 0.34, quickness: 0.005 }, // seconds: base * (1 - quickness * k)
    RELOAD: { quickness: 0.004 }, // reload time * (1 - quickness * k)
    STEALTH: { stealth: 0.006, cap: 0.75 }, // share of enemy detection you shrug off
    NOISE: { stealth: 0.005 }, // footstep and handling noise * (1 - stealth * k)
    VISION: { base: 60, vision: 3.4 }, // metres at which you pick out a soldier by day
    NIGHT_SIGHT: { base: 0.35, vision: 0.003 }, // share of vision kept at night without goggles
    AWARENESS: { base: 8, perception: 0.5 }, // metres within which you sense enemies
    TRACKING: { perception: 0.45, vision: 0.2, intelligence: 0.25 },
    TAG_SECONDS: { base: 8, tracking: 0.55 },
    PLANNING: { intelligence: 0.5, leadership: 0.2, communication: 0.2, perception: 0.1 },
    PLAN_POINTS: { base: 1, per: 15 }, // 1 + floor(planning / 15)
    INTEL_REVEAL: 0.009, // share of enemies pre-marked per planning point
    HEAL: { medkit: 45, medkitMed: 0.9, bandage: 16, bandageMed: 0.3 },
    REVIVE: { base: 6, medicine: 0.04, min: 1.5 },
    EXPLOSIVE: { engineering: 0.006 }, // +0.6% blast damage and radius per point
    PLANT: { engineering: 0.006 }, // plant and disarm time * (1 - engineering * k)
    AURA: { acc: 0.004, dmg: 0.003, hp: 0.005, reaction: 0.004, transferBase: 0.1, transfer: 0.003 },
    COMMAND_RANGE: { base: 30, communication: 1.7 },
    ORDER_DELAY: { base: 1.2, communication: 0.01, min: 0.15 },
    SUPPORT_COOLDOWN: { communication: 0.004 },
    PRICE: { negotiating: 0.003 }, // buy for (1 - k * negotiating) of list price
    SELL: { base: 0.4, negotiating: 0.003 },
    PAY: { negotiating: 0.002 }, // +0.2% mission pay per point
    SURRENDER: { base: 0.1, negotiating: 0.008 },
    XP_MUL: { intelligence: 0.004 },
    PRACTICE_MUL: { intelligence: 0.003 },
    SLOPE: { base: 38, climbing: 0.22 }, // steepest slope (degrees) you can walk up
    MANTLE: { base: 1.3, climbing: 0.02 }, // highest ledge (metres) you can pull yourself onto
    CLIMB_SPEED: { base: 0.6, climbing: 0.012 },
    FALL: { climbing: 0.005 },
  },

  // ---------- combat ----------
  COMBAT: {
    ZONE: { head: 2.5, torso: 1, limb: 0.7 },
    SNIPER_HEAD: 4,
    FALLOFF_MIN: 0.45, // damage kept at twice a weapon's effective range
    STANCE_SPREAD: { stand: 1, crouch: 0.72, prone: 0.5 },
    MOVE_SPREAD: 1.9, // spread multiplier at a full run
    HIP_SPREAD: 2.4, // firing without aiming
    BLOOM: 0.16, // spread added per shot of sustained fire (x weapon recoil)
    BLOOM_MAX: 2.6,
    BLOOM_DECAY: 3.2, // per second
    // Enemy fire is rolled, not traced: hit chance from the shooter's skill and everything below.
    ENEMY: {
      STANCE: { stand: 1, crouch: 0.75, prone: 0.5 },
      MOVING: { still: 1, walk: 0.85, run: 0.72, sprint: 0.58 },
      COVER: 0.45,
      NIGHT: 0.62,
      SUPPRESSED: 0.55,
      EVADE_STILL: 0.5, // share of your evade that still applies when standing still
      MIN: 0.02,
      MAX: 0.9,
    },
    HIT_ZONE_ROLL: { head: 0.1, torso: 0.6 }, // the rest are limbs
    SUPPRESS_SECONDS: 2.5,
    GRENADE: { frag: { damage: 160, radius: 8, fuse: 2.6 }, smoke: { radius: 7, seconds: 22, fuse: 1.6 }, flash: { radius: 10, seconds: 4.5, fuse: 1.6 } },
    MINE: { damage: 190, radius: 6, trigger: 3 },
    C4: { damage: 400, radius: 10 },
    DOWNED_SECONDS: 30, // how long a squad has to reach you
    REGEN_TO: 0.3, // out of combat you recover to this share of health on your own
    REGEN_RATE: 2.2,
    REGEN_DELAY: 7,
  },

  // ---------- stealth ----------
  STEALTH: {
    STANCE: { stand: 1, crouch: 0.55, prone: 0.26 },
    MOVE: { still: 0.6, walk: 1, run: 1.35, sprint: 1.8 },
    BUSH: 0.45,
    TALL_GRASS: { crouch: 0.7, prone: 0.4 },
    FOREST_PER_M: 0.012, // sight lost per metre through woodland
    RATE: 2.4, // awareness per second at point-blank, standing, in the open
    FALLOFF_POWER: 1.3,
    DECAY: 0.22,
    FOV: 120,
    PERIPHERAL_FOV: 200,
    PERIPHERAL: 0.35,
    TOUCH: 2.2, // metres: they notice you this close whatever they face
    CURIOUS: 0.35,
    INVESTIGATE: 0.7,
    NIGHT_RANGE: 0.42, // share of sight range enemies keep at night
    DUSK_RANGE: 0.7,
    LAMP_RANGE: 1, // inside lamp light it is day
    ALARM_SECONDS: 2.8, // a sentry who spots you needs this long to raise the alarm
    BODIES_FOR_ALARM: 2,
    FOOTSTEP: { walk: 5, run: 10, sprint: 16, crouch: 0.4, prone: 0.15 }, // metres; stance scales it
    TAKEDOWN_RANGE: 1.9,
    TAKEDOWN_ARC: 110, // degrees behind the target
  },

  // ---------- enemies: stats at tier 1, and growth per tier ----------
  ENEMY: {
    TIER_MAX: 10,
    HEALTH: { base: 70, perTier: 17 },
    ACCURACY: { base: 0.2, perTier: 0.034 }, // hit chance at 30 m on a standing, still target
    VIEW: { base: 46, perTier: 6 }, // metres, by day
    DETECT: { base: 0.8, perTier: 0.085 },
    REACTION: { base: 0.95, perTier: -0.055, min: 0.25 },
    DAMAGE: { perTier: 0.06 },
    TYPES: {
      rifleman: { name: 'Legion Rifleman', health: 1, accuracy: 1, view: 1, weapon: 'e_rifle', speed: 1 },
      scout: { name: 'Legion Scout', health: 0.8, accuracy: 0.9, view: 1.15, weapon: 'e_smg', speed: 1.2 },
      gunner: { name: 'Legion Gunner', health: 1.35, accuracy: 0.85, view: 1, weapon: 'e_lmg', speed: 0.85, armor: 0.2 },
      marksman: { name: 'Legion Marksman', health: 0.85, accuracy: 1.35, view: 1.7, weapon: 'e_dmr', speed: 0.95 },
      breacher: { name: 'Legion Breacher', health: 1.2, accuracy: 1, view: 0.9, weapon: 'e_shotgun', speed: 1.1, armor: 0.15 },
      grenadier: { name: 'Legion Grenadier', health: 1, accuracy: 0.95, view: 1, weapon: 'e_rifle', speed: 1, grenades: 3 },
      heavy: { name: 'Legion Juggernaut', health: 2.6, accuracy: 0.9, view: 0.95, weapon: 'e_lmg', speed: 0.7, armor: 0.4 },
      officer: { name: 'Legion Officer', health: 1.1, accuracy: 1.1, view: 1.1, weapon: 'e_pistol', speed: 1 },
      boss: { name: 'Legion Commander', health: 3.2, accuracy: 1.25, view: 1.2, weapon: 'e_rifle', speed: 1, armor: 0.3 },
    },
    // Enemy weapons: damage per hit, shots per burst, seconds between bursts, effective range, noise.
    WEAPONS: {
      e_pistol: { damage: 13, burst: 2, rate: 0.28, pause: 1.1, range: 35, noise: 70 },
      e_smg: { damage: 10, burst: 5, rate: 0.085, pause: 1.0, range: 45, noise: 80 },
      e_rifle: { damage: 15, burst: 3, rate: 0.11, pause: 1.25, range: 110, noise: 120 },
      e_lmg: { damage: 14, burst: 8, rate: 0.09, pause: 1.6, range: 130, noise: 150 },
      e_dmr: { damage: 34, burst: 1, rate: 0.5, pause: 2.2, range: 320, noise: 140 },
      e_shotgun: { damage: 38, burst: 1, rate: 0.5, pause: 1.3, range: 20, noise: 110 },
    },
  },

  // ---------- squad ----------
  SQUAD: {
    HEALTH: { base: 90, toughness: 1.1 },
    ACCURACY: { base: 0.2, accuracy: 0.004 },
    VIEW: { base: 70, perception: 1.4 },
    XP_BASE: 90, // experience for a squad member's level L is XP_BASE * (L - 1) ^ 1.7
    LEVEL_CAP: 30,
    STAT_PER_LEVEL: 1.4,
    WOUND_MISSIONS: 2, // missions a downed squad member sits out
    RECRUIT_COST: { base: 300, perLevel: 120 },
    FOLLOW_GAP: 3.2,
    HEAL_AT: 0.55,
    MEDIC_HEAL: 45,
  },

  // ---------- training ----------
  TRAINING: {
    // The most each evaluation can add to an attribute at a perfect score.
    RANGE: { accuracy: 12, scope: 9, quickness: 3 },
    OBSTACLE: { speed: 10, endurance: 10, climbing: 9, quickness: 6, strength: 5, toughness: 4 },
    STEALTH: { stealth: 12, perception: 5, quickness: 2 },
    OBSERVATION: { vision: 12, perception: 9, intelligence: 2 },
    EXAM_POINT: 1.6, // attribute gained per exam point
    GRADES: [
      [90, 'Expert'],
      [75, 'Sharpshooter'],
      [55, 'Qualified'],
      [0, 'Marginal'],
    ],
    HONORS: 82, // average score for Honor Graduate
    GRAD_RP: { base: 400, honors: 400 },
    REFRESHER_PRACTICE: 12, // practice units for re-running a course after graduation (x score)
    RANGE_TARGETS: 18,
    RANGE_LONG: 6,
    RANGE_SHOW: 2.6, // seconds a target stays up
    OBSTACLE_PAR: 62, // seconds for a perfect run
    OBSTACLE_SLOW: 135, // seconds at which the score reaches zero
    STEALTH_STRIKES: 3,
    OBSERVE_SECONDS: 75,
    OBSERVE_TARGETS: 8,
  },

  // ---------- economy ----------
  ECON: {
    START_RP: 0,
    CONTRACT_RP: { base: 220, perTier: 190 },
    CONTRACT_XP: { base: 220, perTier: 210 },
    LIBERATE: { xp: 300, rp: 350 }, // x site tier
    CACHE_RP: [60, 220],
    FAIL_KEEP: 0.35, // share of kill experience kept on a failed mission
    MEDICAL_BILL: 0.05, // share of your RP lost when you go down and are evacuated
  },

  // ---------- mission grading ----------
  GRADE: {
    S: { at: 90, mult: 1.3 },
    A: { at: 75, mult: 1.15 },
    B: { at: 55, mult: 1 },
    C: { at: 0, mult: 0.85 },
  },

  // ---------- world ----------
  WORLD: {
    DAY_MINUTES: 48, // real minutes for a full day in the field
    START_HOUR: 7.5,
    NIGHT_START: 20.5,
    NIGHT_END: 5.25,
    GARRISON_RESPAWN_HOURS: 30,
  },
};

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// A small seeded random number generator (the same one Nexus Rail uses).
export function mulberry(seed) {
  let a = seed | 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const hashString = (text) => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
};
