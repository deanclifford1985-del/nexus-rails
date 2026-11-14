// Every tunable number in Nexus Rails lives in this file.
// Change a value here and the whole game follows; nothing else hard-codes balance.

export const B = {
  // 1 real second = 50 game seconds. A 25 mile run at 20 mph takes about 90 real seconds.
  // Half the old pace: long hauls feel long, and there is time to spot, aim and reload.
  TIME_SCALE: 25,

  START: {
    lt: 500, // starting LocoTokens
    fuel: 200, // gallons in the reserve
    fuelPrice: 2, // cost basis given to the starting fuel, LT per gallon
    rerolls: 3, // shared between traits and dice
    rerollBonusLt: 25, // paid per unused reroll
    traitOffers: 5,
    traitPicks: 3,
    prodigyExtraPicks: 2,
    prodigyExtraOffers: 3,
    dice: 7,
    keep: 4,
  },

  // Chance for each offered trait to come up special.
  TRAIT_RARITY: {
    profound: 0.15, // stronger effect
    gifted: 0.15, // does not use a pick
    infused: 0.1, // two traits in one, each weaker
    profoundMult: 1.2,
    infusedMult: 0.5,
    amplify: 0.5, // Amplify makes other traits this much stronger
  },

  ATTR: {
    max: 20,
    perPoint: 0.005, // each point of Strength or Agility is worth 0.5%
    researchSpeedPerInt: 0.01,
    researchMatchPerInt: 0.005,
  },

  LOCO: {
    hpBase: [1500, 2000], // horsepower at Power 1
    tqBase: [2750, 5000], // torque at Power 1
    growth: [1.07, 1.12], // each further point of Power multiplies both
    weightBase: 10000, // lb
    weightPerDurability: 500, // lb
    fuelLbPerGallon: 24, // aether fuel is heavy: every gallon loaded slows the train (doubled: carrying extra for missiles is a real choice)
    tankBase: 150, // gallons in the built-in tank; Fuel Storage slots add more
    // Top speed: mph = horsepower x mphPerHp x (refWeight / total weight)
    mphPerHp: 0.012,
    refWeight: 20000,
    // Time to top speed, in game seconds, for a train of refWeight with refTorque. Trains are heavy:
    // a typical starter needs 5 to 10 miles of straight track to reach full speed.
    accelRefSeconds: 2300,
    accelPerAgi: 0.025, // each point of Agility: 2.5% quicker off the mark and out of bends
    accelRefTorque: 6000,
    // Fuel economy in ton-miles per gallon.
    tmpgBase: 12,
    tmpgPerEfficiency: 1.5,
    tmpgPerPower: -0.5,
    tmpgMin: 6,
    // Towing capacity in lb = horsepower x (towBase + Durability)
    towBase: 6,
    quoteCargoLb: 10000, // top speed and 0-to-top are quoted pulling this much
    garageSlots: 6,
    resale: 0.5, // Scrappy sells for full price
    // Capacity: how many cargo slots a locomotive has for modules and weapons.
    capacity: { uncommon: 4, rare: 5, epic: 6, legendary: 7 },
    // Durability (wear) runs from 100% down. It costs a little top speed, pull and HP.
    // 0.006% a mile, times (1 + wearPerLoad x the share of towing capacity in use).
    // An average run pulls about 40% of capacity, so 50 runs of 100 miles leaves about half.
    wearPerMile: 0.00006,
    wearPerLoad: 2,
    wearPerHull: 0.02, // losing a whole HP bar in a run costs 2% more
    wearPerCrash: 0.02, // hitting a boulder
    wearPerformanceFloor: 0.75, // horsepower and torque at 0% durability
    wearHullFloor: 0.7, // HP at 0% durability
    repairPerPct: 0.005, // of the locomotive's price, per percent repaired
    repairMinPerPct: 10,
    repairMaxPerPct: 400,
  },

  // Slot modules sold in the Armory. Weight is per module; slots is how many cargo slots it fills.
  MODULES: {
    fuel: { name: 'Fuel Storage', kind: 'storage', slots: 1, weight: 400, price: 300, fuel: 60, text: '+60 gallons of tank' },
    ammo: { name: 'Ammo Storage', kind: 'storage', slots: 1, weight: 600, price: 250, ammo: 30, text: 'Holds 10 cannonballs' },
    battery: { name: 'Battery Bank', kind: 'storage', slots: 1, weight: 300, price: 400, charge: 50, text: '+50 charge for plasma, lightning and shields' },
    engine: { name: 'Engine Block', kind: 'engine', slots: 2, weight: 1800, price: 1500, power: 0.1, text: '+10% horsepower and torque' },
    launcher: { name: 'Missile Launcher', kind: 'weapon', slots: 1, weight: 1800, price: 700, arm: 'launcher', text: 'Bursts of 3 missiles, 10 damage each. Missiles burn fuel: 2 gallons each, out of your tank' },
    cannon: { name: 'Basic Cannon', kind: 'weapon', slots: 1, weight: 2500, price: 800, arm: 'cannon', text: 'Longer reach, 50 damage a shot; 3 cannonballs on board' },
    heavy: { name: 'Heavy Cannon', kind: 'weapon', slots: 2, weight: 4500, price: 4000, arm: 'heavy', text: 'Big hits, slow to reload; 3 cannonballs on board' },
    plasma: { name: 'Plasma Lance', kind: 'weapon', slots: 1, weight: 700, price: 2500, arm: 'plasma', text: 'Light and quick, low damage, runs on charge' },
    arc: { name: 'Lightning Cannon', kind: 'weapon', slots: 2, weight: 2200, price: 6000, arm: 'arc', text: 'Channels lightning for 3 s: 1 damage, +1 more every quarter second; runs on charge' },
    shield: { name: 'Aegis Shield', kind: 'shield', slots: 1, weight: 1000, price: 1800, arm: 'shield', text: 'Halves damage for 4 seconds, runs on charge' },
    radar1: { name: 'Radar Mk I', kind: 'sensor', slots: 1, weight: 300, price: 1200, sight: 7.5, text: 'Spots obstacles 7.5 miles ahead' },
    radar2: { name: 'Radar Mk II', kind: 'sensor', slots: 1, weight: 400, price: 5000, sight: 12, text: 'Spots obstacles 12 miles ahead' },
    heat: { name: 'Heat Cannon', kind: 'weapon', slots: 1, weight: 2000, price: 3500, arm: 'heat', text: 'Takes 10% of your engine heat and fires it as a blast wave: the hotter the engine, the harder it hits, and the engine cools' },
    tesla: { name: 'Tesla Coil', kind: 'weapon', slots: 2, weight: 2600, price: 7000, arm: 'tesla', text: 'Wheel capacitors charge its battery pack while switched on (they slow you down); fire to release every volt. Damage grows exponentially. Takes a weapon slot and a battery slot' },
    windjet: { name: 'Wind Jet', kind: 'wind', slots: 1, weight: 1400, price: 4500, wind: true, text: 'Deploy panels to catch the wind (they slow you 10% while out). The faster you go, the faster they fill. Spend the wind on a burst of speed, or on a gust that slows every rival in range' },
    vent: { name: 'Coolant Vent', kind: 'cooler', slots: 1, weight: 700, price: 2200, arm: 'vent', text: 'Vents 25% engine heat on demand; runs on charge' },
    sonar: { name: 'Deep Sonar', kind: 'sensor', slots: 2, weight: 900, price: 18000, sight: 24, text: 'Spots obstacles 24 miles ahead' },
  },
  // Ammo is counted in units: a cannonball takes 3. Restocking costs per unit. (Missiles burn fuel instead.)
  ARMORY: { resale: 0.5, roundPrice: 2, startKit: ['launcher', 'fuel'] },
  // Spells belong to Epic and Legendary engines only. Mythic engines have their own.
  SPELLS: {
    epicByModel: { tank: 'barrier', bullet: 'bolt', stable: 'frost', longrun: 'frost', scrappy: 'fire' },
    legendary: ['fire', 'bolt', 'barrier', 'frost'],
  },

  // The calendar. Game time moves with every run (the trip plus a turnaround) and also drifts with
  // the real clock, so research and the week roll on while you are away.
  CALENDAR: {
    startMinute: 6 * 60, // Day 1, 06:00
    daysPerMonth: 30,
    monthsPerYear: 12,
    turnaroundHours: 30, // loading, unloading and rest after each run; about 1.5 days a run all in
    driftGameMinutesPerRealMinute: 4, // 1 real hour = 4 game hours, whether you are playing or not
    driftCapDays: 30, // the most a long absence can move the calendar
    festivalEveryMonths: 3,
    festivalDays: 3,
  },

  // Weekly rotations (game weeks).
  WEEK: {
    days: 7,
    armoryOffers: [1, 3], // rolled weapons on sale each week
    dealChance: 0.85,
    deals: {
      fuel: { text: 'Fuel 30% off at the depot this week', fuel: 0.7 },
      container: { text: 'Containers 25% off this week', container: 0.75 },
      repair: { text: 'Repairs 40% off this week', repair: 0.6 },
      crate: { text: 'A free Ammo Crate, one per conductor', crate: 1 },
    },
  },

  // Rolled weapons. Rarity scales the stats and the number of traits.
  WEAPONS: {
    rarity: {
      uncommon: { chance: 0.55, stat: 1, traits: 0, price: 1 },
      rare: { chance: 0.3, stat: 1.1, traits: 1, price: 2.5 },
      epic: { chance: 0.12, stat: 1.2, traits: 2, price: 6 },
      legendary: { chance: 0.03, stat: 1.35, traits: 3, price: 15 },
    },
    // Base attributes. Damage, cooldown and accuracy roll +/- 8% around these, then rarity applies.
    base: {
      launcher: { name: 'Missile Launcher', damage: [10, 10], cooldown: 4, accuracy: 0.9, crit: 0.08, pen: 0.05, range: 2.4, burst: 3 },
      cannon: { name: 'Cannon', damage: [46, 54], cooldown: 5, accuracy: 0.85, crit: 0.12, pen: 0.1, range: 3.6 },
      heavy: { name: 'Heavy Cannon', damage: [80, 100], cooldown: 8, accuracy: 0.75, crit: 0.1, pen: 0.35, range: 4.8 },
      plasma: { name: 'Plasma Lance', damage: [6, 9], cooldown: 1.2, accuracy: 0.95, crit: 0.15, pen: 0.5, range: 2.4 },
      // Lightning: a channel. Every tick deals base + amp x ticks so far: 1, 2, 3, 4 ... for 3 seconds.
      arc: { name: 'Lightning Cannon', damage: [1, 1], cooldown: 7, accuracy: 1, crit: 0, pen: 0.3, range: 2.4, channel: 3, tick: 0.25, base: 1, amp: 1 },
      // Heat Cannon: damage = a small base roll + perHeat for every point of heat it takes (share of
      // the engine's heat a shot, 10% at Uncommon, more with rarity and the Furnace Core trait).
      heat: { name: 'Heat Cannon', damage: [10, 14], cooldown: 6, accuracy: 0.9, crit: 0.08, pen: 0.2, range: 3.0, share: 0.1, perHeat: 4 },
      // Tesla Coil: damage = damage[0] x (e^(volts / voltScale) - 1). 100 V about 11, 200 V about 38,
      // 300 V about 100, a full 400 V about 250. Capacitors gain chargePerMile volts a mile and cost
      // `drag` of top speed while they are on.
      tesla: { name: 'Tesla Coil', damage: [8, 8], cooldown: 3, accuracy: 0.95, crit: 0.05, pen: 0.4, range: 3.2, voltsMax: 400, voltScale: 115, chargePerMile: 40, drag: 0.12, minVolts: 25 },
    },
    traits: {
      lethal: { name: 'Lethal', text: 'Critical hits deal 50% more damage', critMult: 0.5, skip: ['arc'] },
      longshot: { name: 'Long Barrel', text: '+35% range', range: 0.35 },
      echo: { name: 'Echoing Shot', text: 'Every 3rd shot fires a free extra shot', echoEvery: 3, skip: ['arc'] },
      piercing: { name: 'Piercing', text: '+25% armor penetration', pen: 0.25 },
      steady: { name: 'Steady', text: '+10% accuracy', accuracy: 0.1, skip: ['arc'] },
      quickload: { name: 'Quickload', text: 'Reloads 20% faster', cooldown: -0.2 },
      keen: { name: 'Keen', text: '+8% critical chance', crit: 0.08, skip: ['arc'] },
      deepmag: { name: 'Deep Magazine', text: '+2 rounds on board', rounds: 2, only: ['cannon', 'heavy'] },
      overcharged: { name: 'Overcharged', text: '+25% damage, +4 charge a shot', damage: 0.25, charge: 4, only: ['plasma'] },
      salvo: { name: 'Salvo', text: '+1 missile in every burst', burst: 1, only: ['launcher'] },
      incendiary: { name: 'Incendiary', text: 'Every hit sets 2 stacks of Burn', burn: 2 },
      venom: { name: 'Venom', text: 'Every hit adds a stack of Poison', poison: 1 },
      capacitor: { name: 'Capacitor', text: 'Channels 1 second longer', channel: 1, only: ['arc'] },
      amplifier: { name: 'Amplifier', text: 'Lightning ramps +1 more every tick', amp: 1, only: ['arc'] },
      highvolt: { name: 'High Voltage', text: '+1 base damage every tick', base: 1, only: ['arc'] },
      hairtrigger: { name: 'Hair Trigger', text: 'Boots up in half the time or distance', bootMult: 0.5 },
      furnace: { name: 'Furnace Core', text: 'Takes 5% more of the engine heat a shot', share: 0.05, only: ['heat'] },
      coilwound: { name: 'Coil Wound', text: 'Capacitors charge 30% faster', chargeRate: 0.3, only: ['tesla'] },
      vengeance: { name: 'Vengeance', text: 'Comes online the moment you take a hit, whatever its boot-up', bootOnHit: true },
    },
    critMult: 1.5,
  },
  // Armor (the core stat) turns away a share of every hit; armor penetration ignores part of that.
  ARMOR: { perPoint: 0.025, max: 0.5 },

  // How sure your estimates are. The range is +/- this share, narrowing with Intelligence.
  ESTIMATE: { band: 0.26, perInt: 0.012, min: 0.02 },

  // Bends. Each class of bend has a speed limit every train must slow to.
  TRACK: {
    straightStart: 1, // miles of straight after the start
    straightEnd: 0.8,
    gap: [1.5, 5], // miles of straight between bends
    // Real-railway bends: a long sweep round a mountain runs 5 to 10 miles; sharp ones are short.
    // turn = how far the line swings (radians); the bend's sharpness is turn per mile.
    bends: {
      gentle: { turn: [0.7, 1.5], length: [5, 10], chance: 0.4 },
      medium: { turn: [0.7, 1.2], length: [2, 4.5], chance: 0.35 },
      sharp: { turn: [0.8, 1.4], length: [0.6, 1.6], chance: 0.25 },
    },
    // Labels follow sharpness (radians a mile): under 0.2 gentle, under 0.6 medium, else sharp.
    sharpness: { medium: 0.2, sharp: 0.6 },
    // In a bend a train can hold keep = 1 / (1 + keepPerCurve x sqrt(sharpness)) of its top speed:
    // about 75% in a long sweep, 55% in a sharp bend...
    keepPerCurve: 0.86,
    minKeep: 0.4,
    // ...and Agility gives grip: it wins back this share of the speed a bend takes away, per point.
    // Agility 18 holds about 85% in a sweep and 70% in a sharp bend.
    gripPerAgi: 0.0222,
    gripMax: 0.5,
    brake: 1.0, // mph a game second when slowing for a bend
    // Hills: climbs and descents of 1 to 3.5% grade, 1 to 4 miles long, with level running between.
    hills: { gap: [2, 7], length: [1, 4], grade: [0.01, 0.035], chance: 0.7 },
    climbLoss: 6, // uphill top speed falls by grade x this (3% = 18% slower)...
    gripPerStr: 0.03, // ...less 3% of that loss per point of Strength (at most 60%)
    hillGripMax: 0.6,
    descentGain: 3, // downhill top speed rises by grade x this (3% = 9% faster)
    climbFuel: 10, // uphill burns grade x this more fuel (3% = 30% more)
    descentFuel: 8, // downhill burns grade x this less (at most 40% less)
    sceneLift: 3, // how much the 3D scene exaggerates the hills so you can see them
    // Terrain: every course has one. Plains are plain; the others change the physics.
    themes: {
      plains: { name: 'Green Plains', chance: 0.4, text: 'Rolling farmland. No surprises.' },
      flooded: { name: 'Flooded Plains', chance: 0.2, text: 'The middle third is under water: deep enough to cover the rails, not the train. Torque and Agility push through.' },
      desert: { name: 'Scorched Desert', chance: 0.22, heat: 1.35, shed: 0.75, text: 'Engines run 35% hotter and cool slower. Endurance and coolers earn their keep.' },
      snow: { name: 'Frozen Pass', chance: 0.18, ice: 0.12, accel: 0.85, shed: 1.3, text: 'Icy rails: bends hold 12% less speed unless Agility grips, and wheels slip pulling away. Engines cool faster in the cold.' },
    },
    // Flooded track: top speed falls by drag x (1 - resist). Resist = torque per ton x perTq +
    // Agility grip x perGrip, at most resistMax. Water also slows acceleration and costs fuel.
    water: { from: 1 / 3, to: 2 / 3, drag: 0.5, perTq: 0.0004, perGrip: 0.8, resistMax: 0.75, accel: 1.6, fuel: 1.35, heat: 0.5 },
  },

  // Engine heat. Every mile builds heat; the lever past 100% builds it far faster, a climb adds more,
  // and easing off sheds it. Endurance (the locomotive's and the conductor's) cuts the heat per mile.
  // Above half heat the engine loses top speed and acceleration; past 100% it is overheating.
  HEAT: {
    perMile: 1.2,
    climb: 20, // extra heat per mile = grade x this (3% = +0.6)
    passive: 0.35, // heat shed per mile at any lever
    ease: 16, // easing the lever below 90% sheds passive x (1 + ease x (0.9 - lever)) a mile
    perLocoEnd: 0.05, // each point of locomotive Endurance: heat x 1 / (1 + 0.05)
    perCondEnd: 0.02, // each point of conductor Endurance
    from: 50, // heat where the penalty starts
    loss: 0.2, // speed and acceleration lost at 100 heat
    overLoss: 0.01, // and per point beyond 100
    max: 130,
    secondWind: { at: 80, vent: 0.33 },
  },
  // The Journey, the Epic Long Run: grows stronger every 5 miles of a run.
  JOURNEY: { every: 5, speed: 0.005, heat: 0.015, stacks: 30 },

  // Rockfalls on hazardous jobs.
  // Obstacles on the line. Harder jobs have more, and bigger ones.
  HAZARD: {
    minMiles: 30,
    chance: [0.25, 0.35, 0.25, 0.15], // hazard level 0, 1, 2, 3
    count: { base: 1.5, per50Miles: 1, max: 14 }, // obstacles = level x (base + miles / 50), at most max
    // Size mix by hazard level (debris, boulder, large, giant).
    mix: [
      [0, 0, 0, 0],
      [0.6, 0.4, 0, 0],
      [0.35, 0.45, 0.2, 0],
      [0.2, 0.38, 0.34, 0.08],
    ],
    sizes: {
      debris: { name: 'Debris', rank: 0, hp: [20, 45], crash: 12, keep: 0.8, scale: 0.55 },
      boulder: { name: 'Boulder', rank: 1, hp: [70, 110], crash: 45, keep: 0.5, scale: 1 },
      large: { name: 'Large boulder', rank: 2, hp: [130, 180], crash: 85, keep: 0.35, scale: 1.7 },
      giant: { name: 'Giant boulder', rank: 3, hp: [900, 1500], crash: 260, keep: 0.15, scale: 3.2 },
    },
    crashStagger: 2.5,
    payPerLevel: 0.2,
    xpPerLevel: 0.15,
    smashXp: 15,
  },

  // Seeing ahead. Without radar you see this far; radar and sonar see further. Weapons can only
  // fire at an obstacle once it has been seen.
  RADAR: { sight: 3.6 }, // miles a lookout sees without radar

  // The front of the locomotive. One per locomotive, no slot, but weight.
  // cut: share of crash damage turned away. keep: speed kept at least. smash: sizes up to this rank
  // are crushed with no damage at all (-1 none, 0 debris, 1 boulders, 2 large).
  FRONTS: {
    cowcatcher: { name: 'Cowcatcher', cut: 0, keep: 0, smash: -1, weight: 0, price: 0, text: 'The standard front. Every crash hurts.' },
    plow: { name: 'Iron Plow', cut: 0.35, keep: 0.6, smash: 0, weight: 1500, price: 3000, text: 'Shoves debris aside for free; takes the edge off boulders.' },
    ram: { name: 'Ram Prow', cut: 0.55, keep: 0.7, smash: 1, weight: 3000, price: 12000, text: 'Bursts through debris and boulders; large ones still bite.' },
    breaker: { name: 'Titan Breaker', cut: 0.75, keep: 0.8, smash: 2, weight: 5000, price: 40000, text: 'Ploughs through all but the giants.' },
  },
  FRONT_RESALE: 0.5,

  RARITY: {
    uncommon: { label: 'Uncommon', chance: 0.8625, range: [1, 6], priceMult: 1.5 },
    rare: { label: 'Rare', chance: 0.1, range: [3, 8], priceMult: 2.5 },
    epic: { label: 'Epic', chance: 0.03, range: [5, 9], priceMult: 4 },
    legendary: { label: 'Legendary', chance: 0.0075, range: [8, 15], priceMult: 7 },
  },

  PRICE: { power: 105, efficiency: 84, durability: 126, over8: 1.1 },

  RACE: {
    substep: 0.05, // real seconds per physics step
    coastDecel: 0.1, // mph lost per game second with an empty tank
    brakeDecel: 0.2, // mph lost per game second when over the current top speed
    lever: { min: 0.5, max: 1.1, step: 0.05 },
    // Fuel burn multiplier while pulling away, by share of current top speed.
    // Getting all that weight moving costs a massive amount of fuel.
    accelFuel: [
      [0.15, 6],
      [0.3, 4],
      [0.6, 2.4],
      [0.9, 1.4],
    ],
    competitive: { rangeMiles: 0.5, t1: 3, boost1: 0.05, t2: 10, boost2: 0.08 },
    emergency: {
      price: 5, // LT per gallon
      options: [25, 50, 100],
      waitBase: 4, // real seconds
      waitPerMile: 0.1,
      waitMax: 20,
      perGallon: 0.05,
      pitCrew: 0.25,
    },
    siphon: { steal: 0.1, seconds: 15, demoDelay: 5 },
    aiLever: [0.92, 1.0],
    aiAttr: [5, 14],
    // The first run: you pull the company's test car; Benchmark weighs 20,000 lb all in.
    testRace: {
      miles: 25, cargoLb: 5000, winLt: 150, winXp: 375, lossLt: 0, lossXp: 75,
      // Benchmark: a better-graded locomotive (+2 efficiency, armor and endurance) with a weak conductor (30% of your attributes), about 10% slower than you on the line.
      benchmark: { extraPoints: 2, crewShare: 0.3, ratio: 0.9 },
      // The guided first run: Benchmark's better locomotive pulls away off the line, surges after the first bend, and a hit from your weapons cripples it.
      guide: { maxPower: 2.6, launchPower: 1.5, launchLead: 0.12, bendMiles: 1.5, surgePower: 1.9, holdPower: 1.15, surgeLead: 0.3, fallbackBendMile: 3, hitDamage: 5, crippledSpeed: 0.5, cameraAfter: 6, cameraLead: 0.25 },
    },
    demo: { miles: 25, cargoLb: 50000 },
  },

  JOBS: {
    simpleCount: 7,
    contractCount: 3,
    companyJobsPerCompany: 3,
    milesMin: 50,
    milesMax: 250,
    milesStep: 10,
    milesFalloff: 0.95, // each further 10 miles is 5% less likely
    rateMin: 2, // LT per mile
    rateMax: 8,
    containers: [1, 5], // the most containers of freight the job offers
    containerLb: [2000, 7500],
    // Pay = delivery fee + a rate for every container hauled. Both scale with distance.
    feePerMile: [0.6, 1.2],
    perContainerPerMile: [1.4, 2.6],
    limitSecondsPerMile: 420, // 7 simulated minutes per mile (heavy trains take miles to get going)
    speedBonusChance: 0.2,
    speedBonusPerPct: 0.5,
    speedBonusCap: 25,
    xpPerMile: 5,
    xpPerContainer: 25,
    lowPayUnder: 100,
    lowPayStep: 25,
    lowPayBonus: [0.02, 0.07],
    lateXpShare: 0.25,
    business: [0.05, 0.15],
    contract: {
      miles: [25, 60],
      containers: [2, 5],
      containerLb: [2000, 5000],
      rivals: [3, 6],
      award: [2, 7],
      entryPerContract: 25, // entry fee: 25 LT for each contract on offer
      value: 600, // what one contract is worth, for the Business trait's upfront payment
      winXp: 500,
      xpPerContract: 100,
      lossXp: 100,
      negotiator2nd: 0.35,
      negotiator3rd: 0.15,
      businessUpfront: 0.1,
    },
    company: {
      miles: [40, 150],
      containers: [3, 15],
      feePerMile: [1.5, 2.5],
      perContainerPerMile: [2.5, 4],
      xpPerMile: 8,
      xpPerContainer: 40,
      speedBonusChance: 0.3,
    },
    // Prize races: weekly sprints against a field, sponsored by a company. No cargo. Entering
    // costs a share of the winner's purse: 3rd place gets it back, 4th and below lose it.
    race: {
      entryShare: 0.2, // entry fee = 20% of the winner's purse
      count: 3,
      miles: [15, 45],
      rivals: [2, 5],
      pursePerMile: [20, 30], // the winner's purse
      placeShare: [1, 0.45, 0.2], // 1st, 2nd, 3rd
      winXp: 300,
      placeXp: 150,
      lossXp: 60,
      repWin: 40,
      repPlace: 10,
    },
    reputation: {
      contractWin: 150,
      contractLoss: 25,
      companyJob: 75,
      stars: [100, 200, 400, 800, 1600],
      payPerStar: 0.02,
      diplomat: 0.25,
    },
    // The board, fuel price, station lot and armory offers turn over every game week.
  },

  FUEL: {
    base: 2, // LT per gallon
    swing: 0.2, // plus or minus 20%
    stock: [400, 1500], // gallons the depot gets each game week
    pumpMarkup: 0.25, // trackside pump at race setup
    economist: 0.1,
    preparedAt: 200,
    prepared: 0.2,
    preparedStartPerPower: 15,
    containerPrice: 2000,
    startContainers: 1,
    advanceBelowGallons: 25, // out of fuel and money: the company fronts some
    advanceGallons: 60,
  },

  // Wind Jet: deployed panels cost `drag` of top speed and gather perMile x mph wind every mile
  // (so a train twice as fast fills about four times as quickly), up to max. From minUse it can be
  // spent: Boost adds boostSpeed of top speed (and a kick of half that at once) for 2 + 8 x fill
  // seconds; Gust slows every rival within gustRange by gustSlow for 2 + 8 x fill seconds.
  WIND: { max: 100, drag: 0.1, perMile: 0.4, minUse: 25, cooldown: 4, boostSpeed: 0.2, gustRange: 1.5, gustSlow: 0.25, base: 2, perFill: 8 },

  // Express runs on the rail map: long hauls city to city, a leg at a time. Legs pay like a
  // well-paid delivery; finishing every leg pays a bonus of `bonus` x everything the legs paid
  // (`lateBonus` if any leg ran late). Rail reputation opens the map's lines and expresses.
  EXPRESS: {
    legMiles: 240,
    containers: 5,
    containerLb: [2000, 5000],
    feePerMile: 1.2,
    perContainerPerMile: 2.6,
    timeLimit: 1,
    bonus: 0.5,
    lateBonus: 0.2,
    latePay: 0.5,
    xpBonus: 0.5,
  },

  // Licences: earned only by miles driven (every run counts). Each raises the pay on every job
  // and opens more of the rail map. Company reputation is separate and comes only from that
  // company's contracts.
  LICENCES: [
    { id: 'apprentice', name: 'Apprentice', miles: 0, pay: 0, text: 'The heartland lines.' },
    { id: 'fireman', name: "Fireman's Licence", miles: 500, pay: 0.02, text: 'The coasts and the Gulf, and the Gulf Coast Flyer.' },
    { id: 'engineer', name: "Engineer's Licence", miles: 2000, pay: 0.04, text: 'The mountains and the far south, and the Atlantic Express.' },
    { id: 'foreman', name: 'Road Foreman', miles: 6000, pay: 0.06, text: 'The West Coast, and the Southwest Chief.' },
    { id: 'master', name: 'Master Engineer', miles: 15000, pay: 0.08, text: 'The Transcontinental.' },
    { id: 'legend', name: 'Iron Legend', miles: 35000, pay: 0.1, text: 'Coast to Coast, Seattle to Miami.' },
  ],

  // Weapons and spells. In play wherever there are rivals (not the test drive) or boulders. Times are real seconds.
  COMBAT: {
    hullBase: 350, // HP = hullBase + hullPerDurability x Durability
    hullPerDurability: 40,
    mpMax: 100,
    mpRegen: 4, // MP a second
    mpRegenPerInt: 0.01, // each point of Intelligence: +1% MP regen
    chargeBase: 40, // a locomotive with a plasma lance or shield has this much charge built in
    chargeRegen: 2, // charge a second
    roundsPerCannon: 3,
    // Ammo units each weapon carries on board, and what one shot (or missile) costs.
    magazine: { cannon: 9, heavy: 9 },
    spellPerInt: 0.02, // each point of Intelligence: spells hit 2% harder
    // Damage over time. Burn: 1 damage per stack each second, then it loses a stack.
    // Poison: 1 damage per stack every 2 seconds, and the stacks never fall away.
    burn: { tick: 1 },
    poison: { tick: 2 },
    burnPerFire: 3, // stacks of Burn from every fire spell that hits
    // Spells (MP)
    fire: { use: 'mp', cost: 12, cooldown: 1.4, range: 3.0, damage: [14, 20], travel: 0.85, accuracy: 0.92, burn: 3 },
    bolt: { use: 'mp', cost: 26, cooldown: 3.6, range: 4.5, damage: [30, 40], strike: 0.6 },
    barrier: { use: 'mp', cost: 20, cooldown: 9, seconds: 5, cut: 0.6 },
    frost: { use: 'mp', cost: 22, cooldown: 14, vent: 40 }, // Frost Breath: cools the engine by 40 heat
    vent: { use: 'charge', cost: 25, cooldown: 12, vent: 25 },
    fireHeat: 6, // heat a fire spell adds to whatever train it hits
    // Boot-up: how each weapon comes online at the start of a run. Some wait on a timer (real
    // seconds), some on distance covered, some on a trigger: HP below a share, a first hit, or heat.
    boot: {
      launcher: { type: 'time', s: 20 },
      cannon: { type: 'miles', mi: 1 },
      heavy: { type: 'miles', mi: 3 },
      plasma: { type: 'time', s: 30 },
      arc: { type: 'miles', mi: 2 },
      fire: { type: 'time', s: 25 },
      bolt: { type: 'time', s: 45 },
      barrier: { type: 'hurt', below: 0.75 },
      shield: { type: 'hurt', below: 0.5 },
      frost: { type: 'heat', above: 40 },
      vent: { type: 'heat', above: 30 },
      heat: { type: 'heat', above: 15 },
      tesla: { type: 'time', s: 0 },
    },
    // Weapons
    // Missiles burn fuel: `cost` gallons each, straight out of the tank (half for a Legendary launcher).
    launcher: { use: 'fuel', cost: 2, cooldown: 4, range: 2.4, damage: [10, 10], travel: 0.65, burst: 3, burstGap: 0.22 },
    cannon: { use: 'ammo', cost: 3, cooldown: 5, range: 3.6, damage: [46, 54], travel: 0.8 },
    heavy: { use: 'ammo', cost: 3, cooldown: 8, range: 4.8, damage: [80, 100], travel: 0.9 },
    plasma: { use: 'charge', cost: 8, cooldown: 1.2, range: 2.4, damage: [6, 9], travel: 0.25 },
    arc: { use: 'charge', cost: 15, cooldown: 7, range: 2.4, channel: 3, tick: 0.25, base: 1, amp: 1 },
    shield: { use: 'charge', cost: 30, cooldown: 10, seconds: 4, cut: 0.5 },
    heat: { use: 'heat', cost: 0, cooldown: 6, range: 3.0, damage: [10, 14], travel: 0.45, share: 0.1, perHeat: 4 },
    tesla: { use: 'volts', cost: 0, cooldown: 3, range: 3.2, damage: [8, 8], strike: 0.3, voltsMax: 400, voltScale: 115, chargePerMile: 40, drag: 0.12, minVolts: 25 },
    dragonFire: 1.5, // the Dragon's fire hits this much harder
    crit: 0.12,
    critMult: 1.5,
    stagger: 0.9, // seconds slowed after a hit
    staggerBlocked: 0.3,
    staggerSpeed: 0.55, // top speed while staggered
    hullSpeedFloor: 0.8, // top speed at 0 HP, as a share of full
    derailXp: 60, // per rival knocked off the rails
    ai: { think: [1.4, 3.2], bigChance: 0.38, barrierChance: 0.5, barrierBelow: 0.65, plasma: 0.45, shield: 0.3, crate: 0.35 },
  },

  XP: { first: 1000, growth: 1.1, growthAfter25: 1.05, leader: 0.15 },

  WORKSHOP: {
    costs: [500, 1200, 2500, 5000, 8500, 15000],
    gain: [0.03, 0.07],
    // The Cargo frame upgrade adds a Capacity slot per stage instead of a percentage.
    stagesPerTier: 2,
    engineer: 0.15,
  },

  // Research is paid up front and runs on the calendar, so it carries on while you are away.
  RESEARCH: {
    costs: [1500, 2500, 5000],
    days: [10, 25, 60], // game days at Intelligence 0
    genius: 0.15,
    logistics: 0.1, // Logistics: each tier adds this to what every freight route brings in
    ordnance: 0.06, // Ordnance: each tier adds this to the damage of every fitted weapon
  },

  STATION: { stock: 9, phoenixPrice: 2000000 }, // the lot turns over every game week
  // The legendary machines: fixed engines, each with its own spells and a signature ability.
  // `price` is the list price. `forge` means a boss relic builds it for that much instead (and that
  // is then what the engine is worth: resale and repairs work from what was paid); `forgeOnly`
  // engines cannot be bought without the relic.
  // `rebirth`: once a run, at 0 HP it rises again with this share of its hull.
  // `smash`: its own front crushes obstacles up to this rank, whatever front is fitted.
  MYTHIC: {
    wizard: { price: 300000, rarity: 'epic', power: 9, efficiency: 9, durability: 6, hpBase: 1800, tqBase: 4200, growth: 1.1, capacity: 6, spells: ['bolt', 'barrier'], ability: 'tempest' },
    titan: { price: 450000, rarity: 'epic', power: 10, efficiency: 5, durability: 9, endurance: 13, hpBase: 1900, tqBase: 5200, growth: 1.1, capacity: 9, spells: ['barrier'], hullBonus: 350, extraWeight: 6000, ability: 'bulwark', forge: { relic: 'bastion', price: 225000 } },
    dragon: { price: 1200000, rarity: 'legendary', power: 12, efficiency: 7, durability: 10, endurance: 8, hpBase: 1850, tqBase: 4600, growth: 1.1, capacity: 8, spells: ['fire', 'barrier'], ability: 'inferno', forge: { relic: 'vharzul', price: 600000 } },
    phoenix: { capacity: 7, spells: ['fire', 'barrier'], ability: 'siphon', rebirth: 0.4 },
    marauder: { price: 90000, rarity: 'epic', power: 8, efficiency: 6, durability: 7, endurance: 7, hpBase: 1850, tqBase: 4400, growth: 1.1, capacity: 7, spells: [], ability: 'plunder', bootMult: 0.7, forge: { relic: 'rustjaw', price: 45000 }, forgeOnly: true },
    glacier: { price: 280000, rarity: 'epic', power: 9, efficiency: 8, durability: 8, endurance: 14, hpBase: 1800, tqBase: 4500, growth: 1.1, capacity: 6, spells: ['frost', 'barrier'], ability: 'zero', forge: { relic: 'frostmaw', price: 140000 }, forgeOnly: true },
    sandshark: { price: 760000, rarity: 'legendary', power: 12, efficiency: 9, durability: 11, endurance: 11, hpBase: 1900, tqBase: 5000, growth: 1.1, capacity: 7, spells: ['fire', 'frost', 'barrier'], ability: 'maw', smash: 1, forge: { relic: 'devourer', price: 380000 }, forgeOnly: true },
    graviton: { price: 1500000, rarity: 'legendary', power: 14, efficiency: 10, durability: 14, endurance: 12, hpBase: 1800, tqBase: 5600, growth: 1.1, capacity: 8, spells: ['bolt', 'frost', 'barrier'], ability: 'blackhole', extraWeight: 4000 },
  },

  // The World Open: races on real routes around the world, open to anyone who pays the entry.
  // The fields are not matched to the player (unlike prize and contract races): each event has a
  // tier, its rivals are built to that tier, and its champion drives a legendary machine. Each
  // event runs once a week. The first win takes the event's trophy.
  OPEN: {
    entryShare: 0.2, // entry fee = this share of the winner's purse
    placeShare: [1, 0.45, 0.2], // 1st, 2nd, 3rd
    // By tier (1 to 5): the winner's purse, the experience for a win, and how the field is built.
    purse: [1500, 4000, 10000, 25000, 60000],
    winXp: [400, 800, 1300, 2000, 3000],
    placeXp: 0.5, // of the win's, for 2nd or 3rd
    lossXp: 0.2,
    trophyLt: 1, // the first win pays the purse this many times again, with the trophy
    champXp: 0.25, // of the win's, for finishing ahead of the champion without winning
    rivals: [3, 4, 4, 4, 5],
    stat: [3, 5, 7, 10, 13], // each rival's core stats, give or take 1
    attr: [8, 10, 12, 15, 18], // their conductors' attributes
    engineStages: [0, 1, 2, 4, 6], // workshop engine stages (5% each)
    rarity: ['uncommon', 'rare', 'epic', 'epic', 'legendary'],
    weapons: ['uncommon', 'uncommon', 'rare', 'rare', 'epic'], // the grade of their guns
    // The champion drives a legendary machine tuned to the class of the event: this much Power over
    // the field's, one point more of everything else, the same workshop stages, and a steady hand
    // on the lever rather than a heavy one.
    champPower: 2,
    champAttr: [8, 10, 12, 15, 18],
    champLever: 0.95,
    // The events. `from` and `to` are real places (lon, lat) on a real line; `miles` is the stretch raced.
    events: {
      heartland: { name: 'Heartland Open', tier: 1, country: 'United States', from: ['Chicago', -87.63, 41.88], to: ['St. Louis', -90.2, 38.63], terrain: 'plains', miles: 30, text: 'Flat, fast prairie track where American railroading grew up.', champion: { name: 'Big Bill Harlan', title: 'the Heartland Hammer', model: 'tank', rarity: 'rare' } },
      highland: { name: 'Highland Open', tier: 1, country: 'Scotland', from: ['Glasgow', -4.25, 55.86], to: ['Fort William', -5.11, 56.82], terrain: 'flooded', miles: 30, text: 'The West Highland line, floated across the bog of Rannoch Moor on a raft of brushwood.', champion: { name: 'Moira Kincaid', title: 'the Lady of the Moor', model: 'longrun', rarity: 'rare' } },
      deccan: { name: 'Deccan Open', tier: 2, country: 'India', from: ['Mumbai', 72.88, 19.08], to: ['Pune', 73.86, 18.52], terrain: 'flooded', miles: 35, text: 'Up the Bhor Ghat in the monsoon: a wall of rain and a climb to match.', champion: { name: 'Arjun Rao', title: 'the Monsoon', model: 'wizard' } },
      orient: { name: 'Orient Open', tier: 2, country: 'Austria and Hungary', from: ['Vienna', 16.37, 48.21], to: ['Budapest', 19.04, 47.5], terrain: 'plains', miles: 40, text: 'The Danube stretch of the old Paris to Istanbul run.', champion: { name: 'Baron Emil Varga', title: 'the Highwayman of the Danube', model: 'marauder' } },
      rockies: { name: 'Kicking Horse Open', tier: 3, country: 'Canada', from: ['Calgary', -114.07, 51.05], to: ['Vancouver', -123.12, 49.28], terrain: 'snow', miles: 45, text: 'Over the Kicking Horse Pass and down through the spiral tunnels.', champion: { name: 'Jack Mercer', title: 'Avalanche', model: 'titan' } },
      outback: { name: 'Outback Open', tier: 3, country: 'Australia', from: ['Adelaide', 138.6, -34.93], to: ['Alice Springs', 133.88, -23.7], terrain: 'desert', miles: 55, text: 'Red dust, heat haze and nowhere to hide from the sun.', champion: { name: 'Matilda Byrne', title: 'Red Dust', model: 'sandshark' } },
      alpine: { name: 'Alpine Open', tier: 3, country: 'Switzerland', from: ['Zermatt', 7.75, 46.02], to: ['St. Moritz', 9.84, 46.5], terrain: 'snow', miles: 45, text: 'Glacier country: 291 bridges, 91 tunnels and the Oberalp Pass.', champion: { name: 'Lukas Brandt', title: 'the Clockmaker', model: 'glacier' } },
      cape: { name: 'Cape Open', tier: 4, country: 'South Africa', from: ['Pretoria', 28.19, -25.75], to: ['Cape Town', 18.42, -33.92], terrain: 'desert', miles: 55, text: 'Across the Great Karoo to the foot of Table Mountain.', champion: { name: 'Thandiwe Mokoena', title: 'the Lioness', model: 'dragon' } },
      tokaido: { name: 'Tokaido Open', tier: 4, country: 'Japan', from: ['Tokyo', 139.69, 35.69], to: ['Osaka', 135.5, 34.69], terrain: 'plains', miles: 60, text: 'The busiest fast line on earth, past Mount Fuji at full lever.', champion: { name: 'Kenji Sato', title: 'the Bullet', model: 'phoenix' } },
      andes: { name: 'Andes Open', tier: 4, country: 'Peru', from: ['Lima', -77.04, -12.05], to: ['Huancayo', -75.21, -12.07], terrain: 'snow', miles: 55, text: 'From the sea to 15,000 feet in a day: the thin air cools nothing and forgives nothing.', champion: { name: 'Inés Quispe', title: 'the Condor', model: 'wizard' } },
      siberia: { name: 'Trans-Siberian Open', tier: 5, country: 'Russia', from: ['Irkutsk', 104.28, 52.29], to: ['Ulan-Ude', 107.58, 51.83], terrain: 'snow', miles: 70, text: 'Round the cliffs of Lake Baikal in the dead of winter.', champion: { name: 'Viktor Volkov', title: 'the Wolf of Baikal', model: 'titan' } },
      crown: { name: 'The Iron Crown', tier: 5, country: 'Great Britain', from: ['London', -0.13, 51.51], to: ['Edinburgh', -3.19, 55.95], terrain: 'plains', miles: 90, text: 'The Race to the North, run again: London to Edinburgh, and the crown of the circuit.', champion: { name: 'Lord Edmund Ashcroft', title: 'the Duke, reigning world champion', model: 'graviton' } },
    },
  },

  // Weekly orders: four tasks posted with each game week. Each has a target that grows with the
  // conductor's tier (0 to 3: the higher of the licence held and one tier per five levels) and pays
  // LT and experience when claimed. Finishing all four pays a bonus: half their LT again, and a weapon.
  TASKS: {
    count: 4,
    bonus: { ltShare: 0.5, weapon: ['rare', 'rare', 'epic', 'epic'] },
    types: {
      miles: { key: 'miles', text: 'Drive {n} miles', target: [150, 300, 500, 800], lt: [300, 600, 1000, 1600], xp: [200, 350, 500, 700] },
      deliveries: { key: 'deliveries', text: 'Deliver {n} loads on time', target: [2, 3, 4, 5], lt: [350, 700, 1100, 1700], xp: [200, 350, 500, 700] },
      containers: { key: 'containers', text: 'Deliver {n} containers of freight', target: [3, 6, 10, 16], lt: [350, 700, 1200, 1900], xp: [200, 350, 500, 700] },
      early: { key: 'early', text: 'Deliver {n} loads with a quarter of the time to spare', one: 'Deliver a load with a quarter of the time to spare', target: [1, 2, 3, 3], lt: [300, 600, 1000, 1500], xp: [250, 400, 600, 800] },
      podium: { key: 'podiums', text: 'Finish in the top three of {n} races', one: 'Finish in the top three of a race', target: [1, 2, 2, 3], lt: [400, 800, 1300, 2000], xp: [250, 400, 600, 800] },
      contract: { key: 'contractWins', text: 'Win {n} contract races', one: 'Win a contract race', target: [1, 1, 2, 2], lt: [400, 800, 1400, 2200], xp: [300, 450, 650, 850] },
      obstacles: { key: 'obstacles', text: 'Clear {n} obstacles off the line', target: [4, 8, 12, 18], lt: [300, 600, 1000, 1600], xp: [200, 350, 500, 700] },
      derail: { key: 'derails', text: 'Knock {n} rivals off the rails', one: 'Knock a rival off the rails', target: [1, 2, 3, 4], lt: [400, 800, 1300, 2000], xp: [250, 400, 600, 800] },
      damage: { key: 'damage', text: 'Deal {n} damage', target: [300, 800, 2000, 5000], lt: [300, 600, 1000, 1600], xp: [200, 350, 500, 700] },
      earn: { key: 'earned', text: 'Earn {n} LT from runs', target: [1500, 4000, 9000, 20000], lt: [300, 700, 1200, 2000], xp: [200, 350, 500, 700] },
      boss: { key: 'bossKills', text: 'Bring down {n} bosses', one: 'Bring down a boss', target: [1, 1, 1, 1], lt: [600, 1200, 2500, 5000], xp: [400, 700, 1000, 1500], needs: 'boss' },
    },
  },
  // Career milestones: a ladder for each thing a conductor does. Each rung pays its LT and half as
  // much experience, once.
  MILESTONES: {
    miles: { name: 'Iron Road', text: 'miles driven', tiers: [100, 500, 2000, 6000, 15000, 35000], lt: [200, 500, 1500, 4000, 10000, 25000] },
    deliveries: { name: 'Freight Hand', text: 'loads delivered on time', tiers: [5, 25, 75, 200, 500], lt: [300, 1000, 3000, 8000, 20000] },
    podiums: { name: 'Podium Regular', text: 'top-three race finishes', tiers: [1, 5, 15, 40, 100], lt: [300, 1000, 3000, 8000, 20000] },
    derails: { name: 'Wrecker', text: 'rivals knocked off the rails', tiers: [1, 10, 30, 80, 200], lt: [300, 1000, 3000, 8000, 20000] },
    obstacles: { name: 'Line Clearer', text: 'obstacles cleared', tiers: [10, 50, 150, 400, 1000], lt: [300, 1000, 3000, 8000, 20000] },
    bossKills: { name: 'Warden of the Line', text: 'bosses brought down', tiers: [1, 3, 6, 12, 25], lt: [1000, 4000, 12000, 30000, 80000] },
    earned: { name: 'Money Maker', text: 'LT earned from runs', tiers: [5000, 25000, 100000, 500000, 2000000], lt: [500, 2000, 6000, 20000, 60000] },
    terminals: { name: 'Rail Baron', text: 'terminals opened', tiers: [1, 3, 6, 10, 16], lt: [500, 2000, 6000, 15000, 40000] },
    routes: { name: 'Fleet Master', text: 'routes at work at once', tiers: [1, 3, 5, 8, 12], lt: [500, 2000, 6000, 15000, 40000] },
    collected: { name: 'Paymaster', text: 'LT collected from your routes', tiers: [1000, 10000, 50000, 250000, 1000000], lt: [300, 1500, 5000, 20000, 60000] },
    legends: { name: 'Collector of Legends', text: 'legendary machines in the garage', tiers: [1, 2, 4, 6, 8], lt: [5000, 15000, 40000, 100000, 250000] },
    medals: { name: 'Proven', text: 'trial medal points (bronze 1, silver 2, gold 3)', tiers: [1, 3, 6, 9], lt: [400, 1500, 4000, 10000] },
    trophies: { name: 'Champion', text: 'World Open trophies', tiers: [1, 3, 6, 10], lt: [2000, 8000, 25000, 75000] },
  },
  // The Proving Grounds: three trials that are always open. Fuel and rounds are on the house; a
  // medal's prize is paid once (a first gold pays bronze and silver too).
  TRIALS: {
    prizes: { bronze: { lt: 400, xp: 200 }, silver: { lt: 1000, xp: 400 }, gold: { lt: 2500, xp: 800, weapon: 'epic' } },
    hours: 3, // on the calendar
    gauntlet: {
      name: 'The Gauntlet',
      blurb: 'Twelve miles with fourteen obstacles on the line, the last of them a giant, and three minutes on the clock. Shoot them, crush them, or wear them: every one you clear counts, even if the next one wrecks you.',
      miles: 12,
      seconds: 180, // real seconds before the judges call time: crawling through is not an option
      obstacles: [
        { at: 1.6, size: 'debris' }, { at: 2.3, size: 'debris' }, { at: 3.0, size: 'boulder' }, { at: 3.8, size: 'debris' }, { at: 4.5, size: 'boulder' },
        { at: 5.3, size: 'boulder' }, { at: 6.0, size: 'large' }, { at: 6.8, size: 'debris' }, { at: 7.5, size: 'boulder' }, { at: 8.2, size: 'large' },
        { at: 8.9, size: 'boulder' }, { at: 9.6, size: 'large' }, { at: 10.3, size: 'boulder' }, { at: 11.2, size: 'giant' },
      ],
      // Obstacles dealt with (shot down, or crushed by the front) before the run ends, however it
      // ends. One you crash into does not count.
      tiers: [{ at: 14, medal: 'gold' }, { at: 11, medal: 'silver' }, { at: 6, medal: 'bronze' }],
    },
    timetrial: {
      name: 'Time Trial',
      blurb: 'Twenty miles of bends and hills, alone against the clock. No weapons, and only the fuel the sprint needs. Travel light: whatever is fitted still rides along, and every pound counts.',
      miles: 20,
      fuelMargin: 1.8, // loaded: what the run should burn at full lever, times this
      // Real seconds on the clock at the line. Simulated: a starter with its kit on runs about 115 s
      // at 110% lever; a strong engine stripped for speed about 65; a legendary machine travelling
      // light 40 to 55.
      tiers: [{ at: 60, medal: 'gold' }, { at: 90, medal: 'silver' }, { at: 125, medal: 'bronze' }],
    },
    brawl: {
      name: 'Iron Brawl',
      blurb: 'Thirty miles against five armed raiders who would rather fight than race. Medals for the raiders you put off the rails, so stay in range: a raider you have outrun is a raider still on them.',
      miles: 30,
      rivals: 5,
      rival: { power: 5, efficiency: 5, durability: 6, endurance: 5, attr: 10 },
      // Raiders you knock off the rails yourself (and you must still be on them at the end).
      tiers: [{ at: 4, medal: 'gold' }, { at: 3, medal: 'silver' }, { at: 1, medal: 'bronze' }],
    },
  },

  // The empire: a railway company with terminals in real cities and locomotives working freight
  // routes between them while the conductor is out on the line (or away from the game).
  EMPIRE: {
    // Founding the company. Dean's first figure (#265) was 100,000 LT on the old economy; this is
    // what a few hours of work earns now. Leader and Business conductors get 75% off (#265).
    charter: 5000,
    charterDiscount: 0.75,
    // A terminal costs base + perLine x the number of lines that meet at that city. The headquarters
    // terminal comes with the charter. Levels 2 and 3 cost `upgrade` x the terminal's price, and
    // each level above the first adds `boost` to what routes touching it bring in.
    terminal: { base: 3000, perLine: 1500, levels: 3, upgrade: [0, 2, 4], boost: 0.15 },
    baysPerTerminal: 1, // every terminal adds a garage bay...
    baysMax: 14, // ...up to this many in all
    // A route: one locomotive working one line between two of your terminals. What a day of its
    // work on the line brings in:
    //   one-way trips a day x miles x tons hauled x ratePerTonMile x fuel economy x bonuses
    // It hauls `loadShare` of its towing capacity at `cruise` of its loaded top speed, and spends
    // `turnaroundHours` at each end. The rate is after fuel and wages. `incomeScale` scales it all
    // (the NFT edition pays LT out of the treasury pool: lower this there if routes pay too much).
    //
    // Freight runs on the REAL clock, at the calendar's own pace (CALENDAR.driftGameMinutesPerRealMinute:
    // a real hour is four hours of work on the line), playing or away. The calendar's jumps (a run's
    // trip and turnaround, a rest, a contest) move no freight: if they did, resting or forfeiting
    // short runs would print money.
    route: { loadShare: 0.6, cruise: 0.8, turnaroundHours: 12, ratePerTonMile: 0.25, ecoRef: 16, ecoRange: [0.6, 1.6], terrain: { plains: 1, flooded: 0.8, desert: 0.9, snow: 0.85 }, business: 0.1 },
    incomeScale: 1,
    tillHours: 72, // the till holds this many real hours of takings; collect it or the routes work for nothing
    // Empire Power Rating (Dean, #157): the locomotives' own ratings plus all of this.
    rating: { level: 100, perLt: 0.005, ltCap: 5000, research: 300, upgrade: 60, star: 150, contract: 20, win: 15, job: 10, terminal: 400, terminalLevel: 250, route: 300, boss: 600, relic: 400, trophy: 500, licence: 500, medal: 120 },
    // Ranks by rating. Each adds to what every route brings in.
    ranks: [
      { id: 'yard', name: 'Yard Hand', rating: 0, income: 0 },
      { id: 'runner', name: 'Line Runner', rating: 2500, income: 0.05 },
      { id: 'boss', name: 'Rail Boss', rating: 6000, income: 0.1 },
      { id: 'baron', name: 'Regional Baron', rating: 15000, income: 0.15 },
      { id: 'tycoon', name: 'Rail Tycoon', rating: 40000, income: 0.2 },
      { id: 'emperor', name: 'Iron Emperor', rating: 100000, income: 0.3 },
    ],
  },

  // Boss fights. A boss is not raced: it keeps station beside the player's train and the two fight
  // until one falls or the boss breaks off. Times are real seconds, distances miles.
  BOSS: {
    enterAt: 2.5, // miles into the run before the boss shows itself (most weapons have booted by then)
    enterSeconds: 3, // how long it takes to close in
    opening: 3.5, // seconds after it arrives before its first attack
    seconds: 150, // how long a boss stays and fights before it escapes, unless its own entry says otherwise
    gap: [3.0, 4.4], // seconds between one attack landing and the next warning
    // Below `at` of its HP a boss is enraged: shorter gaps, shorter warnings, harder hits.
    enrage: { at: 0.3, gap: 0.65, telegraph: 0.85, damage: 1.25 },
    breakStagger: 2.5, // seconds a boss reels when a charged attack is broken
    dodgeLever: 0.15, // move the lever this far during the warning and an aimed attack lands wide
    // Where the boss rides, in miles ahead of the player: `far` before it arrives, then weaving around `base`.
    offset: { far: 1.6, base: 0.13, swing: 0.09, period: 9 },
    slainDelay: 2.6, // seconds between the kill and the end of the run
    // REAL hours before a slain boss is back on its line. The real clock, like the freight routes:
    // neither the Rest button nor running jobs hurries it. (On the game calendar a boss could be
    // rested back and farmed in minutes.)
    respawnHours: 20,
    repeat: { pay: 0.4, xp: 0.5 }, // what a boss is worth after the first kill
    raidCut: 0.25, // a boss at large cuts the income of freight routes on its line by this share
  },
  // The bosses, weakest first. Each haunts a real line and its bounty is posted once the conductor
  // holds `licence` and has slain the boss before it.
  //   hull, armor: like a train's. seconds: how long it fights before escaping. miles: the run.
  //   attacks: type 'shot' (default; `hits` shots of `damage`, with optional burn, poison, heat,
  //   slow + seconds, pen), 'drop' (`count` obstacles of `size` land `ahead` miles up the line) or
  //   'guard' (damage cut for `seconds`). telegraph: the warning, in seconds. cooldown: its own.
  //   dodge: aimed, so moving the lever dodges it. break: share of the boss's HP that, dealt during
  //   the warning, breaks the attack. below: only used once its HP is at or under this share.
  BOSSES: {
    rustjaw: {
      name: 'Rustjaw', title: 'the Scrap Baron', tier: 1, look: 'scrap', line: 'kansascity-dallas', licence: 0,
      miles: 60, seconds: 150, hull: 520, armor: 0.05,
      bounty: 1500, xp: 900, weapon: 'rare', relic: "The Baron's Black Flag", forges: 'marauder',
      text: 'Track pirates in a war-train welded from stolen freight. They have been raiding the Kansas City line for months.',
      tip: 'His cannon is aimed: shift your lever when the warning shows. Break the Broadside with everything you have.',
      attacks: [
        { id: 'scrap', name: 'Scrap Cannon', look: 'cannon', telegraph: 1.4, cooldown: 4, damage: [22, 30], dodge: true, weight: 3, text: 'An aimed shot. Shift your lever to dodge.' },
        { id: 'hooks', name: 'Grappling Hooks', look: 'launcher', telegraph: 1.2, cooldown: 14, damage: [8, 12], slow: 0.25, seconds: 5, weight: 1, text: 'Drags your speed down by a quarter for 5 seconds.' },
        { id: 'broadside', name: 'Broadside', look: 'cannon', telegraph: 2.4, cooldown: 18, hits: 4, damage: [14, 18], break: 0.07, below: 0.6, weight: 2, text: 'Four guns at once. Deal 7% of his hull during the warning to break it.' },
      ],
    },
    frostmaw: {
      name: 'Frostmaw', title: 'the White Wyrm', tier: 2, look: 'frostwyrm', line: 'chicago-minneapolis', licence: 1,
      miles: 80, seconds: 160, hull: 1050, armor: 0.1,
      bounty: 5000, xp: 2000, weapon: 'epic', relic: 'The Frozen Heart', forges: 'glacier',
      text: 'An ice wyrm that came down from the north with the winter and never left. It freezes trains to the rails and eats them at its leisure.',
      tip: 'Its breath cannot be dodged: shield it. Shoot the ice walls or fit a front that breaks them.',
      attacks: [
        { id: 'breath', name: 'Frost Breath', look: 'frost', telegraph: 1.6, cooldown: 7, damage: [22, 30], slow: 0.3, seconds: 4, weight: 3, text: 'A cone of ice: damage and a slow. It cannot be dodged.' },
        { id: 'wall', name: 'Ice Wall', type: 'drop', look: 'ice', label: 'Ice wall', size: 'boulder', count: 1, ahead: [1.8, 2.6], telegraph: 1.2, cooldown: 15, weight: 2, text: 'A wall of ice lands on your line ahead.' },
        { id: 'hail', name: 'Hailstorm', look: 'frost', telegraph: 2.6, cooldown: 22, hits: 5, damage: [8, 12], break: 0.06, below: 0.66, weight: 2, text: 'Five shards. Deal 6% of its hull during the warning to break it.' },
      ],
    },
    devourer: {
      name: 'The Dune Devourer', title: 'terror of the Chihuahuan sands', tier: 3, look: 'wurm', line: 'dallas-elpaso', licence: 2,
      miles: 100, seconds: 170, hull: 2300, armor: 0.15,
      bounty: 14000, xp: 4000, weapon: 'epic', relic: "The Devourer's Fang", forges: 'sandshark',
      text: 'A sand wurm longer than a freight train. It follows the vibration of the rails and swallows whatever is making it.',
      tip: 'Its acid is Poison, and Poison never wears off: end the fight quickly. Dodge the Eruption with the lever.',
      attacks: [
        { id: 'acid', name: 'Acid Spit', look: 'acid', telegraph: 1.4, cooldown: 6, damage: [18, 26], poison: 1, dodge: true, weight: 3, text: 'Aimed. A stack of Poison if it lands.' },
        { id: 'erupt', name: 'Eruption', look: 'rock', telegraph: 2.2, cooldown: 14, damage: [50, 65], dodge: true, weight: 2, text: 'It comes up under the line. Aimed: shift your lever.' },
        { id: 'storm', name: 'Sandstorm', look: 'heat', telegraph: 1.8, cooldown: 18, damage: [8, 12], heat: 12, slow: 0.2, seconds: 6, weight: 1, text: 'Heat, grit and a slow. It cannot be dodged.' },
        { id: 'swallow', name: 'Swallow Whole', look: 'rock', telegraph: 3, cooldown: 30, damage: [100, 130], break: 0.06, below: 0.5, weight: 2, text: 'Deal 6% of its hull during the warning to break it, or take the worst hit in the desert.' },
      ],
    },
    bastion: {
      name: 'The Iron Bastion', title: 'the fortress that went rogue', tier: 4, look: 'bastion', line: 'denver-saltlake', licence: 3,
      miles: 140, seconds: 210, hull: 4200, armor: 0.3,
      bounty: 35000, xp: 7500, weapon: 'legendary', relic: 'The Bastion Core', forges: 'titan',
      text: 'An armored war-train built to guard the Rockies. Its crew are long gone. Its guns still follow anything that moves.',
      tip: 'Heavy armor: bring armor penetration (heavy cannon, plasma, lightning, Tesla) or damage over time. Hold your fire, or burn it, while its Aegis is up.',
      attacks: [
        { id: 'battery', name: 'Gun Battery', look: 'heavy', telegraph: 1.6, cooldown: 6, hits: 3, damage: [22, 30], dodge: true, weight: 3, text: 'Three aimed shells. Shift your lever.' },
        { id: 'mortar', name: 'Mine Mortar', type: 'drop', look: 'mine', label: 'Rail mine', size: 'boulder', count: 2, ahead: [1.8, 2.6], telegraph: 1.4, cooldown: 14, weight: 2, text: 'Two mines land on your line ahead.' },
        { id: 'aegis', name: 'Aegis', type: 'guard', seconds: 6, cut: 0.6, telegraph: 1, cooldown: 24, below: 0.8, weight: 1, text: 'Six seconds of 60% less damage. Burn and Poison go straight through.' },
        { id: 'railgun', name: 'Railgun', look: 'bolt', travel: 0.6, telegraph: 3, cooldown: 28, damage: [140, 180], pen: 0.5, break: 0.05, below: 0.6, weight: 2, text: 'Deal 5% of its hull during the warning to break it.' },
      ],
    },
    vharzul: {
      name: 'Vharzul', title: 'the Dread Wyrm', tier: 5, look: 'dreadwyrm', line: 'phoenix-losangeles', licence: 4,
      miles: 200, seconds: 240, hull: 7000, armor: 0.2,
      bounty: 100000, xp: 15000, weapon: 'legendary', relic: "The Wyrm's Heart", forges: 'dragon',
      text: 'The dragon at the end of the line. Every conductor who ever rolled a die has been working up to this.',
      tip: 'The desert and its fire both feed your engine heat: bring a cooler. Dodge the Dive, shield the breath, break the Cataclysm.',
      attacks: [
        { id: 'fire', name: 'Dragonfire', look: 'fire', telegraph: 1.5, cooldown: 6, damage: [38, 50], burn: 3, heat: 10, weight: 3, text: 'Damage, three stacks of Burn and 10 heat. It cannot be dodged.' },
        { id: 'dive', name: 'Dive Bomb', look: 'rock', telegraph: 2.2, cooldown: 13, damage: [95, 120], dodge: true, weight: 2, text: 'Aimed. Shift your lever.' },
        { id: 'gust', name: 'Wing Gust', look: 'frost', telegraph: 1.4, cooldown: 16, damage: [12, 18], slow: 0.35, seconds: 6, weight: 1, text: 'A third of your speed gone for 6 seconds.' },
        { id: 'meteors', name: 'Meteors', type: 'drop', look: 'meteor', label: 'Burning rock', size: 'large', count: 2, ahead: [2.0, 3.0], telegraph: 1.6, cooldown: 18, below: 0.75, weight: 2, text: 'Two burning rocks land on your line ahead.' },
        { id: 'cataclysm', name: 'Cataclysm', look: 'fire', telegraph: 3.2, cooldown: 32, hits: 6, damage: [32, 42], burn: 1, break: 0.045, below: 0.5, weight: 2, text: 'Six blasts. Deal 4.5% of its hull during the warning to break it.' },
      ],
    },
  },

  // Signature abilities. One per legendary machine, on its own button (Q). Times are real seconds,
  // ranges miles. `uses` abilities work that many times a run; the rest recharge on `cooldown`.
  // Damage from an ability grows with the conductor's Intelligence like a spell.
  ABILITIES: {
    siphon: { name: 'Siphon Speed', uses: 1, text: 'Once a run, take 10% of the nearest rival\'s speed for 15 seconds. They slow down and you gain what they lose.' },
    blackhole: { name: 'Black Hole', cooldown: 60, seconds: 15, weight: 250000, crush: [220, 300], range: 4, text: 'Every rival within 4 miles is dragged down by 250,000 lb for 15 seconds. Bosses and obstacles in reach are crushed for 220-300 damage.' },
    tempest: { name: 'Tempest', cooldown: 40, damage: [45, 60], range: 4.5, strike: 0.6, text: 'Calls lightning down on every enemy and every spotted obstacle within 4.5 miles: 45-60 damage each.' },
    bulwark: { name: 'Bulwark', cooldown: 45, seconds: 8, cut: 0.8, text: 'For 8 seconds: 80% less damage, nothing staggers or slows you, and you crush any obstacle short of a boss.' },
    inferno: { name: 'Inferno', cooldown: 35, damage: [40, 55], burn: 6, vent: 30, range: 3, text: 'A wave of dragonfire over everything within 3 miles: 40-55 damage and 6 stacks of Burn each, and the engine breathes out 30 heat.' },
    plunder: { name: 'Plunder', cooldown: 30, fuel: 20, drain: 0.5, jam: 4, range: 1.5, text: 'Grappling hooks on the nearest enemy within 1.5 miles: take 20 gallons of its fuel and half its MP and charge, and jam its weapons for 4 seconds.' },
    zero: { name: 'Absolute Zero', cooldown: 50, seconds: 5, slow: 0.5, range: 2, text: 'Freezes every enemy within 2 miles for 5 seconds: rivals lose half their speed and cannot fire, bosses cannot attack. Your engine heat drops to zero.' },
    maw: { name: 'Maw', cooldown: 25, range: 1.5, bite: [150, 200], heal: 0.12, fuel: 8, text: 'Bites the next obstacle within 1.5 miles for 150-200 damage (or the nearest enemy within half a mile for half that). If it is destroyed, the engine eats it: +12% hull and 8 gallons.' },
  },
};
