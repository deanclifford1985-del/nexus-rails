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
    fuelLbPerGallon: 12, // aether fuel is heavy: every gallon loaded slows the train
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
    ammo: { name: 'Ammo Storage', kind: 'storage', slots: 1, weight: 600, price: 250, ammo: 30, text: 'Holds 10 cannonballs or 15 missiles' },
    battery: { name: 'Battery Bank', kind: 'storage', slots: 1, weight: 300, price: 400, charge: 50, text: '+50 charge for plasma, lightning and shields' },
    engine: { name: 'Engine Block', kind: 'engine', slots: 2, weight: 1800, price: 1500, power: 0.1, text: '+10% horsepower and torque' },
    launcher: { name: 'Missile Launcher', kind: 'weapon', slots: 1, weight: 1800, price: 700, arm: 'launcher', text: 'Bursts of 3 missiles, 10 damage each; 9 missiles on board' },
    cannon: { name: 'Basic Cannon', kind: 'weapon', slots: 1, weight: 2500, price: 800, arm: 'cannon', text: 'Longer reach, 50 damage a shot; 3 cannonballs on board' },
    heavy: { name: 'Heavy Cannon', kind: 'weapon', slots: 2, weight: 4500, price: 4000, arm: 'heavy', text: 'Big hits, slow to reload; 3 cannonballs on board' },
    plasma: { name: 'Plasma Lance', kind: 'weapon', slots: 1, weight: 700, price: 2500, arm: 'plasma', text: 'Light and quick, low damage, runs on charge' },
    arc: { name: 'Lightning Cannon', kind: 'weapon', slots: 2, weight: 2200, price: 6000, arm: 'arc', text: 'Channels lightning for 3 s: 1 damage, +1 more every quarter second; runs on charge' },
    shield: { name: 'Aegis Shield', kind: 'shield', slots: 1, weight: 1000, price: 1800, arm: 'shield', text: 'Halves damage for 4 seconds, runs on charge' },
    radar1: { name: 'Radar Mk I', kind: 'sensor', slots: 1, weight: 300, price: 1200, sight: 7.5, text: 'Spots obstacles 7.5 miles ahead' },
    radar2: { name: 'Radar Mk II', kind: 'sensor', slots: 1, weight: 400, price: 5000, sight: 12, text: 'Spots obstacles 12 miles ahead' },
    vent: { name: 'Coolant Vent', kind: 'cooler', slots: 1, weight: 700, price: 2200, arm: 'vent', text: 'Vents 25% engine heat on demand; runs on charge' },
    sonar: { name: 'Deep Sonar', kind: 'sensor', slots: 2, weight: 900, price: 18000, sight: 24, text: 'Spots obstacles 24 miles ahead' },
  },
  // Ammo is counted in units: a cannonball takes 3, a missile 2. Restocking costs per unit.
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
    testRace: { miles: 25, cargoLb: 5000, winLt: 150, winXp: 375, lossLt: 0, lossXp: 75 },
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
    // Prize races: weekly sprints against a field, sponsored by a company. No cargo, no entry fee.
    race: {
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
    magazine: { cannon: 9, heavy: 9, launcher: 18 },
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
    },
    // Weapons
    launcher: { use: 'ammo', cost: 2, cooldown: 4, range: 2.4, damage: [10, 10], travel: 0.65, burst: 3, burstGap: 0.22 },
    cannon: { use: 'ammo', cost: 3, cooldown: 5, range: 3.6, damage: [46, 54], travel: 0.8 },
    heavy: { use: 'ammo', cost: 3, cooldown: 8, range: 4.8, damage: [80, 100], travel: 0.9 },
    plasma: { use: 'charge', cost: 8, cooldown: 1.2, range: 2.4, damage: [6, 9], travel: 0.25 },
    arc: { use: 'charge', cost: 15, cooldown: 7, range: 2.4, channel: 3, tick: 0.25, base: 1, amp: 1 },
    shield: { use: 'charge', cost: 30, cooldown: 10, seconds: 4, cut: 0.5 },
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
  },

  STATION: { stock: 9, phoenixPrice: 2000000 }, // the lot turns over every game week
  // Very late-game engines, always on the station's back siding.
  MYTHIC: {
    wizard: { price: 300000, rarity: 'epic', power: 9, efficiency: 9, durability: 6, hpBase: 1800, tqBase: 4200, growth: 1.1, capacity: 6, spells: ['bolt', 'barrier'] },
    titan: { price: 450000, rarity: 'epic', power: 10, efficiency: 5, durability: 9, endurance: 13, hpBase: 1900, tqBase: 5200, growth: 1.1, capacity: 9, spells: ['barrier'], hullBonus: 350, extraWeight: 6000 },
    dragon: { price: 1200000, rarity: 'legendary', power: 12, efficiency: 7, durability: 10, endurance: 8, hpBase: 1850, tqBase: 4600, growth: 1.1, capacity: 8, spells: ['fire', 'barrier'] },
    phoenix: { capacity: 7, spells: ['fire', 'barrier'] },
  },
};
