# Nexus Rails: the rules as built

(Formerly Iron Rails. Old saves still load: they get the starting kit fitted and a fresh job board.)

Every number below lives in `src/game/balance.js`. Change it there and the whole game follows.

The "From" column says where each rule comes from: a prompt number from Dean's original base44 conversation (`#74`), or **new** where a rule had to be filled in to make the system work. New rules are the ones to review first.

## Creating a conductor

| Rule | Value | From |
|---|---|---|
| Steps | Name, traits, roll, assign, locomotive, first run | #178 |
| Random name button | 16 first names x 16 last names | #126 |
| Traits offered / picked | 5 offered, pick 3 | #109, #273 |
| Prodigy | 2 more picks, 3 more traits dealt, cannot be put back | #110, #273 |
| Rerolls | 3, shared between traits and dice | #5, #23 |
| Swap one trait card | 1 reroll | #19, #23 |
| Reroll all six dice | 1 reroll | #5 |
| Unused rerolls | 25 LT each | #108 |
| Trait rarity | 15% Profound (20% stronger), 15% Gifted (free pick), 10% Infused (two traits at half strength) | #211 |
| Dice | Six d20, keep three, one each on Strength, Agility, Intelligence | #5, #211, #220 |
| Assigning | Tap a die then an attribute, drag and drop, or double-click to auto-place | #125, #126 |
| Traits lock when you roll | Stops free dice rerolls by going back | new |
| Starters | One each of Tank, Bullet, Stable, Long Run, Scrappy, free, with the usual small chance of a higher rarity. A free starter has no resale value. | #122, #123, #213, #221 |
| Starting kit | 500 LT, 200 gallons, 1 cargo container, a Basic Cannon and one Fuel Storage fitted | #213; container and kit are **new** |
| Recommended starter | Highest attribute: Strength Bullet, Agility Long Run, Intelligence Stable | #213 |

## Traits

| Trait | Effect | From |
|---|---|---|
| Competitive | Within 0.5 mile of a rival for 3 real seconds: +5% power. For 10 seconds: +8%. Lost at once when the gap opens. | #9 |
| Negotiator | 35% to win a contract from 2nd, 15% from 3rd | #74 |
| Business | Deliveries pay 5 to 15% more; 10% of a won contract's value up front | #100 |
| Leader | +15% experience | #49 |
| Lucky | +1 on every attribute die | #8 |
| Mr. Consistent | Each roll is 3d6 instead of a d20 | #45 |
| Focused | Reroll dice one at a time | #19 |
| Second Chances | 2 extra rerolls | #10 |
| Prodigy | See above | #10 |
| Elevate | Ignores 15% of cargo weight, for towing limits and in the race | #10 |
| Diplomat | +25% reputation | #100 |
| Genius | Research 15% faster | #8 |
| Prepared | +15 gallons per point of starter Power; 20% off fuel when buying 200+ gallons at once | #25 |
| Amplify | Other traits 50% more effective | #110 |
| Influencer | Attributes count double | #110 |
| Economist | +25% starting LT, and fuel costs 10% less | #1, fuel discount is **new** |
| Engineer | Workshop upgrades cost 15% less | base44's text |
| Pit Crew | Emergency fuel arrives 25% faster | #10, applied to emergency fuel |

Technician, Mechanic and Team Player are defined but switched off (`enabled: false` in `traits.js`). They need repairs and teams, which are not built.

## Attributes

| Attribute | Effect per point | From |
|---|---|---|
| Strength | +0.5% horsepower and torque | #104 |
| Agility | +0.5% fuel economy, and 0.5% lighter locomotive | #104, #209 |
| Intelligence | +1% research speed, and each LT invested in research counts 0.5% more | #138 |

One point per level, spent on any of the three (#46).

## Locomotives

Three core stats: Power, Efficiency, Armor (the old Durability stat, renamed because Durability now means wear). Everything else is worked out from them in `deriveStats()`.

| Number | Formula | From |
|---|---|---|
| Core stats by rarity | Uncommon 1-6, Rare 3-8, Epic 5-9, Legendary 8-15 | #212 |
| Rarity odds | Rare 10%, Epic 3%, Legendary 0.75% | #105 |
| Model bonuses | Tank +2 Armor and +1 Capacity slot. Bullet +2 Power, -1 Efficiency. Stable +2 Efficiency. Long Run -2 Power, +4 Efficiency. Scrappy sells for full price. | #44, #212 |
| Horsepower | 1,500-2,000 at Power 1, then x1.07-1.12 per further point. Rolled once when the locomotive is built and stored. | #115 |
| Torque | 2,750-5,000 at Power 1, same growth | #115 |
| Weight | 10,000 lb + 500 lb per Armor + everything in the cargo slots | #209; slot weight is **new** |
| Top speed | horsepower x 0.012 x (20,000 / total weight) mph | form from #115, constant tuned |
| Time to top speed | 360 game seconds x (weight / 20,000) x (6,000 / torque). First third of the speed takes half the time. | #115, reference torque tuned |
| Fuel economy | 12 + 1.5 x Efficiency - 0.5 x Power ton-miles per gallon (a 4/4 engine gets 16) | #190 |
| Fuel weight | 12 lb per gallon, and the train gets lighter as it burns. 150 gallons is 1,800 lb, so load what the run needs. | #26; raised from 5 in this build |
| Tank | 120 gallons built in, +60 per Fuel Storage slot | **new** (#26 said 300, #190 said less) |
| Capacity | Cargo slots: Uncommon 4, Rare 5, Epic 6, Legendary 7. +1 per Cargo frame stage in the workshop. | **new** |
| HP | 1,200 + 150 per Armor. Resets every run. | **new** |
| Durability | Wear, from 100%. -0.006% a mile, times (1 + 2 x the share of towing capacity in use): pulling near the limit wears three times as fast as running empty. About 50 runs of 100 miles at a typical 40% load reach 50%. Also -2% for losing a whole HP bar, -2% per boulder hit. At 0%: 75% of horsepower and torque, 70% of HP. Stays down until repaired. | **new** |
| Repairs | Workshop. 0.5% of the locomotive's price per percent, between 10 and 400 LT. | **new** |
| Towing capacity | horsepower x (6 + Armor) lb, so 10 lb per hp at Armor 4 | #130, Armor link is **new** |
| Price | (Power x 105 + Efficiency x 84 + Durability x 126) x rarity multiplier | 11 Aug build |
| Legendary perks | One of: +10% top speed, +25% torque, +15% economy, ignores 25% of cargo | #105, effects are **new** |

Armor makes a locomotive heavier (slower) and lets it tow more and take more hits.

## The run

| Rule | Value | From |
|---|---|---|
| Time scale | In a race, 1 real second = 25 game seconds (halved on 3 Nov so long hauls feel long and there is time to spot, aim and reload). A typical delivery takes 2-18 real minutes. | #253; slowed by Dean |
| Weight in a run | Locomotive + cargo + fuel on board | #5, #26 |
| Power lever | 50% to 110%. Scales horsepower and torque. | #75 |
| Lever and fuel | At 50%: 15% less fuel per mile. At 110%: 25% more. | #5, curve is **new** |
| Pulling away | Fuel burn x4 below 15% of top speed, x3 to 30%, x2 to 75% | #18 |
| Bends | Real-railway bends with 1.5 to 5 miles of straight between. A long sweep round a mountain runs 5 to 10 miles; medium bends 2 to 4.5; sharp ones 0.6 to 1.6. Each swings the line 0.7 to 1.5 radians; its sharpness (radians per mile) labels it gentle (under 0.2), medium (under 0.6) or sharp. Every train brakes early (1 mph a game second), then pulls away again, measured against its own top speed, so high torque recovers fastest. The same job always has the same line. | Dean, 4 Nov |
| Bend speed | In a bend a train can hold 1 / (1 + 0.55 x sharpness) of its top speed (at least 30%): about 95% in a long sweep, 60-75% in a sharp bend. | Dean, 4 Nov |
| Agility grip | Agility wins back 2.75% per point of the speed a bend takes away (20 Agility = 55%, at most 75% with Influencer). So it matters most in the sharpest bends. Rivals use their own Agility. | Dean, 4 Nov |
| Race cameras | Chase, Helicopter (close above your engine), Bird's-eye (furthest out, framing the whole field from leader to last train, climbing as the field spreads out), Side, Front. Key C or the View button. In Helicopter and Bird's-eye, drag (mouse or finger) to swing round and look behind or ahead, drag up and down to tilt, pinch or scroll to zoom; changing camera resets the angle. Every train carries a floating name tag in those two views; yours says YOU. | Dean, 5 Nov |
| Long-range sightings | The lookout sees 3.6 miles ahead without radar; Radar Mk I 7.5, Mk II 12, Deep Sonar 24. When an obstacle is spotted mid-run, time drops to 10% for about 3 seconds while the camera flies down the line to it (letterboxed, with a target reticle, its size, HP, distance and when your guns will reach it), then flies back. Tap, Enter or Esc skips; the Cine button turns these off. | Dean, 4 Nov |
| Weapon reach | Tripled: Cannon 3 mi, Heavy Cannon 4.8, Plasma Lance 2.4, Fire spell 3, Bolt 4.5 (Long Barrel adds 35%). Weapons already owned were stretched to match (save version 4). | Dean, 4 Nov |
| Competitive boost | See traits. The cab shows the nearest train and the gap in miles, green ahead, red behind. | #9, #24, #80 |
| Deliveries | No rival. Time limit of 5 game minutes per mile. Late means no pay and a quarter of the experience. | #199 |
| Obstacles | Jobs of 30 miles or more: 25% clear, 35% hazard 1, 25% hazard 2, 15% hazard 3. Count = level x (1.5 + miles / 50), at most 14. Sizes: Debris 30-60 HP (crash 40 damage), Boulder 100-160 (150), Large 260-380 (280), Giant 1,500-5,000 (900), the mix getting bigger with the level. A crash also costs speed. Pays +20% and +15% experience per level; 15 XP per obstacle shot down. The job card and start line show the mix. | Dean, 3 Nov; numbers **new** |
| Spotting | You see 3.6 miles ahead. Radar Mk I (1 slot, 300 lb, 1,200 LT) 7.5 mi, Radar Mk II (1 slot, 400 lb, 5,000 LT) 12 mi, Deep Sonar (2 slots, 900 lb, 18,000 LT) 24 mi. Weapons can fire at an obstacle only once it is spotted and within the weapon's range. | Dean, 3-4 Nov |
| Fronts | One per locomotive, no slot. Cowcatcher (free). Iron Plow: crushes debris, -35% crash damage, 1,500 lb, 3,000 LT. Ram Prow: crushes debris and boulders, -55%, 3,000 lb, 12,000 LT. Titan Breaker: crushes all but giants, -75%, 5,000 lb, 40,000 LT. Each has its own 3D look. The old front sells back for half. | Dean, 3 Nov; numbers **new** |
| Early bonus | On 20% of jobs: +0.5% pay per 1% under the limit, capped at +25% | #68 |
| Contract races | 3 to 6 rivals with locomotives within one point of yours on each stat | #76, #235 |
| Out of fuel | Emergency fuel at 5 LT a gallon. The truck takes 4 seconds + 0.1 per mile travelled (20 max), then 0.05 seconds a gallon. The clock keeps running. | #81, timings shortened |
| Unused fuel | Goes back to the reserve | #206 |
| Forfeit | You lose the fuel burned. The job stays on the board. A fuel truck that has not arrived is not charged. | **new** |
| First run | 25 miles against Benchmark, pulling a 5,000 lb test car each. Benchmark is your own model, graded Rare, with +2 Efficiency, Armor and Endurance (a better locomotive) and a conductor with 30% of your attributes (a worse one), its engine tuned so it is 10% slower than you on the line. The setup screen compares both trains before the conductors, both conductors, and the result. It is a guided lesson: weapons are locked until lesson 2; Benchmark's better locomotive gets away first; at the first bend the race pauses to explain bends, Agility and acceleration; after it Benchmark surges to a 0.3 mi lead and the race pauses again ("You are losing ground") to tell you to use your weapons. From then your hits do 5× damage and the first one cripples Benchmark (half top speed for the rest of the run); it holds its fire until then. 150 LT and 375 XP for a win, 75 XP for a loss. | Dean, 5 Nov |
| Time warp | 1x, 2x, 4x button in the race, for testing | **new** |
| ETA | In the race: the time to the line from where you are, at the current lever, bends and fuel included (re-worked twice a second), against the time left, as time to spare or time late. Warns if the fuel will run out first. | Dean, 3 Nov |
| Course map | The whole line in the corner, finish at the top, a dot per train, the covered stretch in gold, close bends lit, boulders shown | **new** |
| Race view | 3D, smooth rendering only (the PS1 pixel option is gone). HUD in the NEXUSRAIL glass style with plain, readable type. View and Pause always show; Cine, Sound, Speed and Forfeit sit under More on phones. Bend and hill notices show as a banner at the top centre. Pauses itself when the tab is hidden. | Dean, 5 Nov |

## Weapons and spells (the 3D race)

Every rule here is **new**: the old game listed combat as not built. Spells belong to Epic and Legendary engines only (Dean, 3 Nov). Everyone else fights with what is fitted in the cargo slots.

| Rule | Value | From |
|---|---|---|
| When | First run, contract races, and any job with boulders. Not the Phoenix test drive. | **new** |
| Who knows spells | Epic: one (Tank and Stable Barrier, Bullet and Long Run Bolt, Scrappy Fire). Legendary: Fire, Bolt and Barrier. Storm Magus: Bolt and Barrier. Iron Titan: Barrier. Ember Wyrm and Iron Phoenix: Fire and Barrier. | Dean |
| Weapon attributes | Every weapon has Damage, Cooldown, Range, Accuracy (a miss does nothing), Critical chance (x1.5 damage), and Armor penetration. Rolled weapons vary +/-8% around the base, and rarity lifts them: Rare x1.1 and 1 trait, Epic x1.2 and 2, Legendary x1.35 and 3. Prices x1, x2.5, x6, x15. | Dean, 3 Nov |
| Traits | Lethal: crits deal 50% more. Long Barrel: +35% range. Echoing Shot: every 3rd shot fires a free extra one. Piercing: +25% armor penetration. Steady: +10% accuracy. Quickload: reloads 20% faster. Keen: +8% crit chance. Deep Magazine (cannons): +2 rounds. Overcharged (plasma): +25% damage, +4 charge a shot. | Lethal and Echoing Shot are Dean's; the rest **new** |
| Armor | The Armor stat turns away 2.5% of every hit per point (at most 50%). Armor penetration ignores that share of it. Boulders have none; the festival wall 20%. | **new** |
| Weekly weapons | 1-3 rolled weapons in the Armory each week, at least one Rare or better. Each can be bought once. The standard Uncommon weapons are always in stock. | Dean |
| Basic Cannon | 1 slot, 2,500 lb, 800 LT. 110-150 damage, 85% accuracy, 12% crit, 10% armor pen, reaches 1.0 mi, 3.5 s reload. 3 rounds on board. | Dean |
| Heavy Cannon | 2 slots, 4,500 lb, 4,000 LT. 220-300 damage, 75% accuracy, 35% armor pen, 1.6 mi, 6 s reload, 3 rounds. | Dean |
| Plasma Lance | 1 slot, 700 lb, 2,500 LT. 40-60 damage, 95% accuracy, 50% armor pen, 0.8 mi, 1.2 s, 12 charge a shot. | Dean |
| Aegis Shield | 1 slot, 1,000 lb, 1,800 LT. Halves damage for 4 s, 10 s recharge, 30 charge. | Dean, numbers **new** |
| Ammo Crate | 1 slot, 600 lb, 250 LT. +6 rounds. Rounds fired are restocked after the run at 10 LT each. | Dean |
| Battery Bank | 1 slot, 300 lb, 400 LT. +50 charge. A plasma lance or shield brings 40 charge; charge refills 2 a second. | Dean |
| Fuel Storage | 1 slot, 400 lb, 300 LT. +60 gallons of tank. | Dean |
| Engine Block | 2 slots, 1,800 lb, 1,500 LT. +10% horsepower and torque. | Dean |
| Fitting | Weapons can be doubled up (two or three cannons), each with its own reload. One shield per locomotive. Modules sell back for half. Selling a locomotive puts its modules on the shelf. | Dean, 3 Nov |
| Firing | A button and number key per weapon or spell, Fire All (Space) for everything ready with a target, and an Aim setting (T): auto (obstacles first, then rivals), track only, or rivals only. | Dean, 3 Nov |
| HP (hull) | 1,200 + 150 per Durability point | **new** |
| MP | 100, refills 4 a second. Each point of Intelligence adds 1% to the refill (Influencer doubles it). | **new** |
| Fire | 12 MP, 1.4 s recharge, reaches 1.0 mi, 80-120 damage (x1.5 from the Ember Wyrm), lands after 0.85 s | Duel |
| Bolt | 26 MP, 3.6 s recharge, reaches 1.5 mi, 150-210 damage, strikes after 0.6 s | Duel |
| Barrier | 20 MP, 9 s recharge, cuts damage 60% for 5 s | Duel |
| Critical hit | 12% chance, x1.5 | Duel |
| Being hit | Staggered for 0.9 s (0.3 s through Barrier) at 55% top speed | Duel |
| Damage and speed | Top speed falls with HP, to 80% at 0 HP | Duel |
| Knocked off the rails | At 0 HP the train stops where it is and is ranked last. If it is you, the race ends there. | **new** |
| Targets | The nearest train in range. Rivals fight each other as well as you. | **new** |
| Rival kit | A cannon and fuel storage; 45% also a plasma lance, 30% a shield, 35% an ammo crate | **new** |
| Rival tactics | Think every 1.4-3.2 s (slower in a big field). 38% the big hit first (Bolt or Heavy Cannon), a shield at under 65% HP when something is incoming. | Duel |
| Knock-off reward | +60 XP per rival knocked off the rails | **new** |
| Keys | 1-6 the commands in the order shown, F first weapon, B Bolt, R shield or Barrier, Q the locomotive's signature ability (Siphon Speed on the Phoenix; see the 13 Nov section), Up/W and Down/S the lever, C camera, P pause | Duel |

Simulated with a starter engine and a player who fires about once a second: contract races are won 16% (36% at 110%). Starters with only their 3 rounds crash into about two thirds of obstacles and are knocked off the rails on about 1 delivery in 9; ammo crates, a plow and radar fix that. On rockfall deliveries, the starting 3 rounds clear about three boulders in four; the rest need ammo crates or a plasma lance.

## The calendar, weeks and the festival

All **new** (Dean, 3 Nov), numbers are first guesses.

| Rule | Value | From |
|---|---|---|
| Calendar | Day, Month, Year. 30-day months, 12-month years, 7-day weeks. A new conductor starts on Day 1, Month 1, Year 1 at 06:00. | Dean |
| Time from runs | Each run takes its trip time on the line plus a 30-hour turnaround (loading, unloading, rest): about a day and a half for a typical run. Festival contests take 3 hours; a test drive 2. | Dean |
| Time from the real clock | 1 real hour = 4 game hours, playing or away. A long absence moves the calendar at most 30 days. | Dean |
| Rest | The yard can rest 12 hours or 3 days, to let research run | **new** |
| Weekly turnover | Each game week: a new job board, fuel price and depot delivery (400-1,500 gallons), station lot, and Armory weapon offers | Dean |
| Weekly deal | 85% of weeks: fuel 30% off, containers 25% off, repairs 40% off, or a free Ammo Crate | Dean |
| Locomotive Festival | Days 1-3 of months 3, 6, 9 and 12: about 60 runs apart | Dean |
| Max Pull | Choose a load (5,000 lb steps up to your towing limit), get it 3 miles in 15 minutes on the line. Gold 70,000 lb, silver 40,000, bronze 20,000. | Dean |
| Speed Race | 10 miles of bends against 5 crews a little stronger than you; no weapons. Top three get medals. | Dean |
| Damage Wall | A 5,000 HP boulder with 20% armor, 0.3 miles ahead. Your train is parked. The fair supplies 60 rounds. Gold under 60 s, silver under 120 s, bronze within the 180 s limit. A starter's Basic Cannon does about 4,700 in the time. | Dean |
| Festival prizes | Gold 1,500 LT, 400 XP and an Epic weapon. Silver 750 LT, 250 XP and a Rare weapon. Bronze 300 LT, 150 XP. Taking part 50 XP. Each contest once per festival. | **new** |

## Estimates

| Rule | Value | From |
|---|---|---|
| Ranges | Trip time, fuel, pay, after-fuel profit, the race ETA, time to spare and fuel range are shown as ranges that always contain the true value | Dean, 3 Nov |
| Width | +/-26% at Intelligence 0, 1.2 points narrower per point of Intelligence (Influencer doubles it), never under +/-2%. At +/-3% or less it shows "about X". | **new** |
| Not centred | Each range is nudged off the true value by a fixed amount per job, so its middle does not give the answer away | **new** |
| Fuel suggestion | The start line suggests the top of your fuel range, so a low-Intelligence conductor carries extra weight | **new** |

## Jobs

| Rule | Value | From |
|---|---|---|
| Board | 7 deliveries, 3 contract races and 3 prize races, sorted by distance | #223, #244, #270 |
| Dispatch tabs | Rail map; Deliveries; Contracts (sub-tabs: Open contracts = jobs paid with contracts you hold, Compete for contracts = contract races); Races (sub-tabs: Prize races plus the festival, the World Open, the Proving Grounds); Bounties; Orders (this week's orders and the milestones); Reputation (every company you have met: reputation, stars, progress to the next star, contracts held, races won, jobs run, pay bonus). Back from a run returns to the tab it came from. | Dean, 3 Nov; Bounties, Orders and the two race sub-tabs are **new** (13 Nov) |
| Prize races | 3 a week, 15 to 45 miles, no freight, 2 to 5 rivals, an entry fee (see below). Purse 20-30 LT a mile to the winner; 2nd takes 45%, 3rd 20%. 300 XP for a win, 150 for 2nd or 3rd, 60 otherwise. Sponsor reputation +40 for a win, +10 otherwise. Each race runs once; new ones post with the week. | **new**, Dean, 3 Nov |
| Delivery distance | 50 to 250 miles, each extra 10 miles 5% less likely | #38 |
| Delivery pay | A delivery fee (0.6-1.2 LT a mile) plus a rate for every container pulled (1.4-2.6 LT a mile each). A 50-mile steel job might pay 150 LT with 1 container and 350 LT with 3. The rates are not shown; the board shows the pay for what you can pull and the most the job pays. | Dean, 3 Nov |
| Load | Up to 1-5 containers of 2,000 to 7,500 lb each. You pull up to as many as you own, and can choose fewer at the start line. | #62, Dean |
| Containers | Buy for 2,000 LT; there is no renting. You start with one. The old 50% own-container bonus is gone. | Dean, 3 Nov |
| Live impact | The start line and the Armory show top speed, time to top speed, fuel, towing capacity used against the limit, and wear, and what the last change did to each. Every Armory module shows what fitting it would change. | Dean, 3 Nov |
| Delivery experience | 5 a mile + 25 per container pulled | #47 |
| Low-pay bonus | +2 to 7% experience for every 25 LT the pay is under 100 LT | #48 |
| Mail runs | About 1 job in 7: 15 to 40 miles at 1 to 2 LT a mile. These are the jobs the low-pay bonus applies to. | **new** |
| Contract prize | 2 to 7 contracts with that company | #74 |
| Contract experience | 500 + 100 per contract for a win, 100 for a loss | 11 Aug build |
| Contract jobs | 3 per company while you hold its contracts. Cost 1 to 3 contracts. 40 to 150 miles, up to 3 to 15 containers. Fee 1.5-2.5 LT a mile plus 2.5-4 LT a mile per container. | #74, #62, pay is **new** |
| Reputation | +150 contract won, +25 raced and lost, +75 contract job. Stars at 100, 200, 400, 800, 1,600. | #100, 11 Aug build |
| Stars pay | +2% on that company's jobs per star | **new** |
| Turnover | Board and fuel price change every game week. A finished delivery or contract race is replaced at once; prize races are not. | #7 |
| A job you can take | While you hold a company's contracts, at least one of its jobs is light enough for your locomotive | **new** |

## Money and fuel

| Rule | Value | From |
|---|---|---|
| Fuel price | 2 LT a gallon, plus or minus 20%, re-rolled every 3 hours | #7 |
| Depot stock | 50 to 500 gallons per 3 hours | #35 |
| Trackside pump | Always available at the start line, 25% dearer | #201, markup is **new** |
| Reserve | Bought fuel goes in at what you paid. Trips are costed at the reserve's weighted average. | #37 |
| Cargo container | 2,000 LT | #35, Dean |
| Fuel advance | 60 gallons fronted when you have under 25 gallons and cannot afford 60 at the pump. 120 LT comes back out of your next pay. One at a time. | **new**, stops a dead end |

## Progress

| Rule | Value | From |
|---|---|---|
| Levels | 1,000 XP to level 2, +10% a level to 25, +5% after | #46 |
| Workshop | Engine, Aerodynamics, Body, Cargo frame. 6 stages each at 500, 1,200, 2,500, 5,000, 8,500, 15,000 LT. Each stage +3 to 7%, except the Cargo frame: +1 Capacity slot a stage. | #41, #156; Cargo frame is **new** |
| What stages improve | Engine: horsepower and torque. Aerodynamics: fuel economy. Body: towing capacity. Cargo frame: Capacity. | #41, applied to outputs |
| Research | Engine, Efficiency, Structural, and (13 Nov, **new**) Logistics and Ordnance. 3 tiers each: 1,500, 2,500, 5,000 LT, taking 10, 25 and 60 game days. | #104, #143; days are **new** (Dean, 3 Nov: research is for while you are away) |
| Paying for research | Paid up front when started (Intelligence cuts the price about 0.5% a point and speeds it 1% a point). Runs on the calendar, so through runs, rests and time away. Pause keeps progress and resuming is free. One project at a time. | #159, #276; up-front payment is **new** |
| Research unlocks | Tier 1: stages 1-2. Tier 2: 3-4. Tier 3: 5-6. Logistics and Ordnance unlock nothing: each tier of Logistics adds 10% to what every freight route brings in, each tier of Ordnance 6% to the damage of every fitted weapon (not spells). | #156; the two new lines are **new** |
| Station | 9 locomotives, new stock every game week, plus the Phoenix and the Hall of Legends | #105, weekly is Dean |
| Garage | 6 bays, and one more for every terminal the company opens (14 at most). Sell for half price (Scrappy for full). | **new** |
| Mythic engines | Always at the station, in the Hall of Legends. The Storm Magus (Epic, 300,000 LT, 6 slots, Bolt and Barrier), the Iron Titan (Epic, 450,000 LT, 9 slots, +350 HP since the 4 Nov rescale, 6,000 lb heavier, Barrier), the Ember Wyrm (Legendary, 1,200,000 LT, 8 slots, Dragonfire and Barrier). Each has its own 3D model. Since 13 Nov each also has a signature ability, and four more machines stand beside them: see the 13 Nov section. | Dean, 3 Nov; numbers **new** |
| Phoenix | Power 15, Efficiency 12, Armor 18. Fire and Barrier, 7 slots. 2,000,000 LT. Siphon Speed: once a run, the nearest rival loses 10% speed for 15 seconds and you gain it. Rebirth (13 Nov): once a run, at 0 HP it rises again with 40% of its hull. | #105, #270; Rebirth is **new** |
| Phoenix test drive | 25 miles against a copy of your own locomotive, both pulling 50,000 lb. No fuel used, nothing kept. The ability fires 5 seconds after the rival reaches top speed. | #150, #153, #155 |
| Saves | 3 slots, kept in the browser | #276 |

## Heavy trains, hills and the new combat scale (Dean, 4 Nov)

| Rule | Value |
|---|---|
| Acceleration | Trains are heavy: a typical starter needs 5 to 9 miles of straight track to reach full speed (2,300 game seconds at the reference weight and torque). Each point of Agility makes it 2.5% quicker, off the mark and out of bends. The start line and Engineering Bay show "Full speed after" in miles. |
| Start-up fuel | Pulling away burns far more: 6x under 15% of top speed, 4x under 30%, 2.4x under 60%, 1.4x under 90%. |
| Bend speed | A train holds 1 / (1 + 0.86 x sqrt(sharpness)) of its top speed (at least 40%): about 75% in a long sweep, 55% in a sharp bend. Agility wins back 2.22% per point of the loss (at most 50%): Agility 18 holds about 85% in a sweep and 70% in a sharp bend. |
| Hills | Climbs and descents of 1 to 3.5% grade, 1 to 4 miles long, laid independently of bends. Uphill top speed falls by grade x 6 (3% = 18% slower) and burns grade x 10 more fuel; Strength wins back 3% of the loss per point (at most 60%). Downhill runs grade x 3 faster and burns up to 40% less. The 3D line rises and falls (shown 3x exaggerated) and the race HUD shows the grade. |
| Time limits | 7 simulated minutes per mile (was 5). Built-in tank 150 gallons (was 120). |
| Ammo | Counted in units: a cannonball takes 3, a missile 2. A cannon carries 3 balls (9 units), a launcher 9 missiles (18). Ammo Storage holds 30 units: 10 cannonballs or 15 missiles. Restocking costs 2 LT a unit. |
| Starter weapon | Missile Launcher (1 slot, 1,800 lb, 700 LT): 3-missile bursts, 10 damage a missile, 4 s cooldown, 2.4 mi range. About 30% of rivals carry a cannon instead. |
| Cannons | Cannon 46-54 damage, 5 s, 3.6 mi; Heavy 80-100, 8 s, 4.8 mi; Plasma Lance 6-9, 1.2 s. |
| Lightning Cannon | 2 slots, 2,200 lb, 6,000 LT, 15 charge. Channels for 3 s, ticking every 0.25 s: tick n deals base + amp x (n-1), so 1, 2, 3 ... 12 (78 over a full channel). Rarer ones channel longer and add base or amp. Traits: Capacitor (+1 s), Amplifier (+1 amp), High Voltage (+1 base). Breaks if the target leaves range. |
| Burn | 1 damage per stack each second; a stack falls away with each tick (3 stacks = 3 + 2 + 1). Fire spells set 3 stacks; the Incendiary trait sets 2 per hit. Ignores armor and shields. |
| Poison | 1 damage per stack every 2 seconds; stacks never fall away. The Venom trait adds 1 per hit. Ignores armor and shields. |
| Spells | Fire 14-20 + Burn, Bolt 30-40. Each point of Intelligence: +2% spell damage. |
| Hulls and obstacles | Rescaled to the new damage: hull 350 + 40 per Durability; debris 20-45 HP, boulders 70-110, large 130-180, giant 900-1,500 (crash damage scaled to match). Damage Wall: 480 s to bring down 5,000 HP (gold under 180 s). |
| Old saves | Version 5: owned weapons rescaled to the new damage numbers. |

## Boot-up, engine heat and Endurance (Dean, 5 Nov)

| Rule | Value |
|---|---|
| Boot-up | No weapon or spell is live at the start line; each comes online its own way, shown on its button. Missile Launcher 20 s; Cannon after 1 mile; Heavy Cannon after 3 miles; Plasma Lance 30 s; Lightning Cannon after 2 miles; Fire 25 s; Bolt 45 s; Barrier once HP is below 75%; Aegis Shield below 50%; Frost Breath above 40% heat; Coolant Vent above 30% heat. Rarer weapons boot 10/20/35% sooner. Traits: Hair Trigger (half the time or distance), Vengeance (online the moment you take a hit). Rivals obey the same rules. The Damage Wall skips boot-up. |
| Engine heat | Builds 1.2 a mile at 100% lever (less below, far more above: 110% builds 1.8x), plus grade x 20 on climbs; sheds 0.35 a mile, more when the lever is under 90% (75% lever cools about half a point a mile). Above 50 heat the engine loses top speed and acceleration, 20% at 100; past 100 it is overheating (1% more per point, to 130). Hot engines trail smoke; overheating ones throw sparks. Rivals ease to 80% above 80 heat and open up again below 55. |
| Heat from combat | Every fire spell that hits a train adds 6 heat. |
| Cooling | Frost Breath (spell, 22 MP, 14 s): vents 40 heat. Coolant Vent (module, 1 slot, 700 lb, 2,200 LT, 25 charge, 12 s): vents 25. One vent per locomotive. Both work in any race, combat or not. |
| Endurance | Two kinds, both cutting heat per mile: heat x 1 / (1 + 0.05 x locomotive Endurance + 0.02 x conductor Endurance). Locomotives roll Endurance like their other stats (Long Run +4, Tank +2, Bullet -1). Conductors now roll 7 dice and keep 4: Strength, Agility, Intelligence and Endurance. A typical starter at 100% reaches about 15 heat by 30 miles, 50-60 by 100 and 100+ by 200; a cool Long Run stays near 70 at 200. |
| Endurance traits | Marathoner: 20% less heat and sheds it 25% faster. Second Wind: once a run, the first time heat passes 80 it vents a third of it. |
| The Journey | Every Epic or Legendary Long Run is the Journey: every 5 miles of a run it gains +0.5% top speed and builds 1.5% less heat, up to 30 times (150 miles). |
| Old saves | Version 6: conductors get Endurance 8; locomotives get Endurance from their model; Epic and Legendary Long Runs become the Journey. |
| Spells | Epic Stable and Long Run now know Frost Breath; Legendary engines know Fire, Bolt, Barrier and Frost Breath. |

## Nexus Rail (NFT edition) (Dean, 5 Nov)

| Rule | Value |
|---|---|
| Editions | One codebase. Lite is the default; the NFT edition is built with VITE_EDITION=nft. Lite saves never see any of this. |
| Captain | In the NFT edition the player is the Captain: a name and a focus (Business, Engineering or Scientist), then the usual traits, dice and starter locomotive roll the Captain's first conductor (crew, not an NFT). Max level 30; one talent point per level and no attribute points. |
| Focus perks | Business +1% pay per level; Engineering +0.5% horsepower and torque per level; Scientist +1% research speed and +0.5% spell damage per level. |
| Talent trees | Three trees of six tiers, 10 talents each. Tier n opens at 5 x (n - 1) points in that tree; the tier-6 capstone only in your focus tree. Business: Haggler, Thrifty, Good Word, Closer, Bulk Buyer, Expedite, Portfolio, Mentor, Tycoon, Rail Magnate. Engineering: Fine Tuning, Coolant Loops, Deep Flanges, Low Gearing, Reinforced Chassis, Hull Plating, Precision Fit, Turbo Feed, Overdrive, Masterwork Engine. Scientist: Lab Work, Applied Arcana, Grants, Focus, Forecasting, Capacitors, Channeling, Sensor Array, Catalyst, Breakthrough. Reset costs 100 LT x level. |
| Crew | Each locomotive is driven by one conductor; the active locomotive's conductor supplies Strength, Agility, Intelligence, Endurance and traits. Seat conductors on the Crates > Crew tab. |
| Nexus | The NFT edition's premium currency, awarded only by admins (test-build admin panel behind a passcode). 5% of every Nexus spend counts as burned. |
| Crates | Season 1, four tiers: Uncommon 10 Nexus (pool 200), Rare 25 (100), Epic 75 (50), Legendary 250 (20). 60% locomotives, 40% conductors. Stat budgets: locomotives 20/26/32/40 points across Power, Efficiency, Armor and Endurance; conductors 36/46/56/66 attribute points with 1/2/3/4 traits. Open at random, or pick a specific one for +10%. Pools are the same on every device; each NFT has an ID like NXR-S1-L-007. |
| Vault | Account-wide: Nexus, owned NFTs and opened pool entries. An NFT is sent to one Captain at a time. NFT locomotives cannot be sold at the station. |
| Test build | Everything lives in the browser until the game has a server; nothing is on a blockchain yet. |

## Not built yet

Loans and bank reputation, turrets, temporary workshop boosts, the Station Upgrade research, fuel stations on long routes, the live-stat picker in the cab.

Built since this list was first written: talent trees and player accounts (Nexus Rail, 5-6 Nov); track pirates (Rustjaw, the first boss), missions (weekly orders and milestones) and forming a business (the empire), all 13 Nov, below.


## Nexus Rail: welcome Nexus and the admin link (Dean, 5 Nov)

| Rule | As built |
|---|---|
| Welcome Nexus | Every Vault (one per browser) gets 10 Nexus once, enough for an Uncommon crate. Vaults made before this get it on their next load. The ledger shows it as "Welcome gift". |
| First crate | While a Captain's garage is empty, a random crate always holds a locomotive. Picking still lets you choose anything. |
| Admin link | /#admin on the Nexus Rail site opens the admin panel on its own, Captain or not. Awards go into the Vault of the browser it is opened in. |
| Camera lesson | First run, lesson 3 of 3: once you have pulled 0.25 mi clear of the crippled Benchmark (at least 6 s after the hit), the race pauses to show View, Helicopter, Bird's-eye, drag, tilt and zoom, with a "Try the helicopter" button. |
| High-camera backdrop | The mountain ring grows with the camera's height, clouds stay above the camera, and a wide plain fills the ground beyond the land, so the high views never show mountains in the middle or the edge of the world. |

## Nexus Rail: accounts, the bank, sends and admin (Dean, 6 Nov)

| Rule | As built |
|---|---|
| Accounts | Nexus Rail (NFT edition) asks players to sign in before playing: Google, or email and password, through Clerk. No Replit account. Lite needs no account. |
| Where things live | Nexus balances, owned NFTs, the shared season crate pools and the history ledger live on the Nexus Rail server (Postgres). Game progress (saves) still lives in the browser. |
| Welcome | A new account gets 10 Nexus once (ledger: Welcome gift). |
| Crate pools | Shared by every player: when anyone opens an NFT it is gone for everyone. Two players can't take the same one. |
| Player name | Every account has a unique player name (3 to 20 letters, digits, spaces, _ or -; case doesn't matter), first made from the sign-in name plus 4 digits. Change it on Crates → Send. |
| Sending Nexus | Crates → Send: type a player name (suggestions as you type, names only, never emails), an amount (up to 2 decimals, at most 100,000 at once) and an optional note, review, send. No fee. Can't be undone. |
| Admin | Admins are accounts whose email is in the server's ADMIN_EMAILS setting. /#admin or Crates → Admin lists every player (name, email, Nexus, NFTs, last seen) with search, +25, any amount with a note, and each player's history. The server checks admin on every call; the old passcode is gone. |
| Updates | The game checks for new Nexus every 20 seconds and when you come back to the tab, with a toast for awards and sends. |

## Cards, power rating and the crate opening (Dean, 6 Nov)

- Every locomotive and conductor shows as a card: art, name, four stat bars, ability chips (super trait, the Journey, spells, traits) and one big power rating in the top-right corner. The badge colour follows the rating: grey under 480, silver to 1,000, blue to 2,000, purple to 4,500, gold above.
- Power rating = A × e^(k × points). Points are weighted stats plus abilities.
  - Locomotives: Power ×1.45, Efficiency ×1.0, Endurance ×0.85, Armor ×0.7; super trait +3.5, each spell +1.4, the Journey +2.5, mythic engine +6.
  - Conductors: Agility ×1.25, Strength ×1.1, Endurance ×0.85, Intelligence ×0.8; each trait +3.2 (Profound ×1.2).
  - A and k are fitted so the Uncommon crate tier sits around 700 and the Legendary tier around 6,000; above the Legendary mark the curve climbs at half rate.
  - Season 1 NFTs: Uncommon 585 to 860, Rare about 820 to 1,750, Epic about 1,350 to 3,800, Legendary about 4,350 to 7,350.
- Art: rendered studio shots for all ten locomotive models (public/art/locos). Conductors get a portrait drawn from their id, so each one always looks the same; trim and glow follow rarity.
- Crate opening: the crate shakes and glows, the lid blows off in a flash, sparks and light rays, and the card spins up out of the crate. Rarer crates shake longer and burn brighter; Legendary gets wide gold beams. Tap anywhere or Skip to jump to the card.
- Cards appear in the crate pools (sorted by power, 24 at a time), the Vault, the Crew tab and a Card collection on Fleet (both editions).

## Crates hold a pair (Dean, 6 Nov)

Every crate holds one locomotive and one conductor, so no Captain ends up with a train and nobody to drive it. The better one side is, the plainer the other, and no crate holds two Legendaries.

| Crate | Price (Nexus) | Pool | Inside |
|---|---|---|---|
| Basic | 10 | 200 | Uncommon train + Uncommon conductor |
| Rare | 30 | 120 | Rare + Rare |
| Elite | 60 | 80 | Epic one side, Rare the other |
| Epic | 100 | 50 | Epic + Epic |
| Legendary | 200 | 24 | Legendary one side, Rare the other |
| Mythic | 300 | 12 | Legendary one side, Epic the other |

- In the mixed crates, half the pool has the better locomotive and half the better conductor. Picking a specific crate still costs 10% more, and the pick list shows both cards and the pair's total power.
- Each half is its own NFT (crate id + "-T" and "-C") and can be kept or sent on its own. "Send both" sends the pair; the crate's conductor drives the crate's locomotive, except that on the locomotive already on the main line the higher-rated conductor keeps the controls.
- The 10 welcome Nexus buys a Basic crate: a new Captain's first crate gets them a train and a driver.
- Crates opened before this change keep their single NFTs.

## Tokenomics and the Treasury (Dean, 7 Nov)

Real dollars back every LocoToken (LT). Every number lives in `src/game/treasury.js`.

| Rule | As built |
|---|---|
| Nexus | 1 Nexus = $1. Admin awards are either **paid** (a buy-in: the player gave $1 a Nexus) or **gift** (free). The 10 welcome Nexus are gift. Gift Nexus only buy crates; paid Nexus can also be sent to players and cashed out. Crates spend gift Nexus first. |
| Money into the treasury | Dean's deposits (100%), and 85% of every paid Nexus spent on crates. The other 15% is the house share. Gift Nexus add nothing. |
| LT price | Dollars in the treasury ÷ all LT in existence (the pool plus what players hold). Starts at $0.0001 (10,000 LT = $1), so Dean's $100 seed releases 1,000,000 LT into the pool. |
| Money in | New LT are released into the pool at today's price, so the price never moves on a deposit or crate sale. |
| Earning and spending | Every LT a Captain earns (jobs, contracts, prize races, the starting 500, unused rerolls, station sales) comes out of the pool; every LT spent (fuel, upgrades, research, the station) goes back into it. The game reports each Captain's LT change to the server about a second after it happens. |
| Low pool | Once the pool is under 10% of all LT, payouts shrink in step (never below 25%), so the pool can't run dry. The game shows a toast when an earning is cut. |
| Before the first deposit | Earnings wait in the save and are counted once the treasury opens. |
| Swap LT for Nexus | At today's price; Nexus are whole cents, so only the LT those cents are worth are used. The dollars behind them leave the treasury with the Nexus (paid Nexus), and the LT go on hold. They come back into the pool first when the next money comes in. The price doesn't move. |
| Cash out | Paid Nexus only, at least 1. The Nexus leave the balance at once; the admin pays in person and marks the request paid, or turns it down and the Nexus come back. |
| Treasury screen | Everyone: money available to earn, 1 LT in dollars, the pool (with the 10% line), LT held, LT on hold, money in (deposits and crates), house share, swapped and cashed out, recent activity. You: your Captain's LT and its value, your Nexus (paid and gift), LT earned this week, month, year and all time (last 7, 30 and 365 days, all Captains, valued at today's price), swap, cash-out and your requests. |
| Admin | On the Treasury screen and /#admin: deposit dollars, and the cash-out queue ("I paid this" or "Turn down"). Awards choose Paid buy-in or Gift. |
| Existing players | When the treasury first opens, each existing player's first 10 Nexus are marked as gift (the welcome). |
| Trust | The game reports LT from the browser, so a player who edits their save could report LT they didn't earn. Fine for the friends test; server-checked races are the fix before real stakes. |

What an hour is worth at the start: a new Captain nets about 2,000 LT an hour on simple jobs after fuel (about $0.20 at 10,000 LT = $1); company jobs pay 2,000 to 13,000 LT each later on.

## Treasury excitement (Dean, 7 Nov)

- **Public preview:** the sign-in screen shows the live treasury before anyone signs up: dollars available to earn (counting up), what 1 LT is worth, the latest crate sale or deposit, and the top 3 earners this week. It reads `/api/public/treasury`, which needs no sign-in, is cached for 10 seconds, and shows player names only (never emails).
- **Live feel:** treasury numbers count up when they appear and flash when they rise. Every 20 seconds the game looks for new money in, and every signed-in player gets a pop-up like "boss opened a Rare Crate: +$17.00 to the treasury!" or "$100.00 just landed in the treasury!" (7 seconds, at most two at a time; never during a race).
- **Leaderboard:** top 10 earners this week, this month and all time, ranked by the dollar value (today's price) of the LT they earned from jobs, contracts and races. Medals for the top 3; your own row is highlighted.
- **Treasury growth chart:** the treasury's dollars over time (deposits and crate shares add, swaps take away), with a tap-or-hover readout of the amount at any point.

## First-time intro and buying Nexus (Dean, 7 Nov)

- **Buying Nexus:** Venmo only, to @GambitGaming (https://venmo.com/u/GambitGaming). 1 Nexus = $1. Players put their player name in the Venmo note; the admin then awards that many **paid** Nexus. Set in `TREASURY.venmo` in `src/game/treasury.js`.
- **Intro:** four skippable cards right after sign-in, once per account on each device. 1) Welcome, Captain (earn LT, backed by real money). 2) Your first crate is on us (10 Nexus = a Basic Crate: a locomotive and a conductor; "Take me to the Crates"). 3) Getting more Nexus (the Venmo steps, with the player's name and a Copy button, and an Open Venmo button). 4) The Treasury. "Show the intro again" on the Treasury tab and the checklist.
- **Getting started checklist** on Fleet (and the no-locomotive screen) until hidden: open your first crate, send the train and conductor to your Captain, run your first race or job, visit the Treasury. Each step links to where it's done and ticks itself off.
- **Treasury tab:** a "Get more Nexus" panel with the same Venmo steps.

## Terrain, the rail map, express runs and two new weapons (Dean, 7 Nov)

### Terrain
Every course has a terrain, picked from its seed (the first run and the test drive are always plains). Jobs on the rail map take their line's terrain. Shown on job cards and the setup screen.

| Terrain | Chance | Effect |
|---|---|---|
| Green Plains | 40% | none |
| Flooded Plains | 20% | The middle third is under water, deep enough to cover the rails but not the train. Top speed falls by 50% x (1 − resist); resist = torque per ton x 0.0004 + Agility grip x 0.8, at most 75%. Pulling away takes 60% longer, fuel burns 35% more, +0.5 heat a mile. A typical starter loses about 20–30%; a high-torque, high-Agility train about 12%. |
| Scorched Desert | 22% | Engine heat builds 35% faster and sheds 25% slower. |
| Frozen Pass | 18% | Icy rails: bend speed limits 12% lower x (1 − Agility grip); pulling away 15% slower; engines shed heat 30% faster. |

The 3D scene changes with the terrain (sky, ground, mountains, trees); floodwater sits over the line with spray off the wheels, and a banner warns of floodwater ahead with the speed it will cost.

### Rail map (Dispatch → Rail map)
- 25 real cities and 30 rail lines across the lower 48, each line with its terrain. Lines open with your **licence** (earned by miles driven, see below): the heartland with the Apprentice licence, the coasts and the Gulf with the Fireman's Licence, the mountains and the far south with the Engineer's Licence, the West Coast with Road Foreman. Company reputation is separate and only comes from that company's own jobs and contracts.
- This week's jobs sit on open lines as pins (deliveries, contract jobs, open contracts, prize races). Tap a line for its jobs and terrain.

### Express runs
- Five long hauls, run one leg at a time (legs of at most 240 miles, each a delivery of up to 5 containers): Gulf Coast Flyer (Dallas–Memphis, 1,080 mi, 6 legs, Fireman's Licence), Atlantic Express (Boston–Miami, 1,860 mi, 10 legs, Engineer's Licence), Southwest Chief (Chicago–Los Angeles, 2,660 mi, 14 legs, Road Foreman), Transcontinental (New York–San Francisco, 3,220 mi, 16 legs, Master Engineer), Coast to Coast (Seattle–Miami, 3,770 mi, 20 legs, Iron Legend).
- Each leg pays 1.2 LT a mile plus 2.6 LT a mile per container; a late leg pays half. Finishing every leg pays a bonus of 50% of everything the legs paid (20% if a leg ran late), and 50% more XP. One express at a time; abandoning loses the bonus. A forfeited leg can be run again.

### Heat Cannon
1 slot, 2,000 lb, 3,500 LT. Each shot draws off 10% of the engine's heat (12.5% Rare, 15% Epic, 18.75% Legendary; +5% with the Furnace Core trait) and fires it as a blast wave: damage = 10–14 + 4 per point of heat drawn. Comes online above 15% heat; 6 s reload; reaches 3 mi. At 80 heat it hits for about 44 and cools the engine by 8.

### Tesla Coil
2 slots (the coil and its battery pack), 2,600 lb, 7,000 LT. Flip the wheel capacitors on (V, or the Capacitors button): they cost 12% of top speed while on and charge 40 volts a mile (30% faster with Coil Wound), up to 400 V. Switch them off and the pack holds its charge. Fire any time from 25 V: it releases every volt for damage = 8 x (e^(volts/115) − 1): about 11 at 100 V, 38 at 200 V, 100 at 300 V, 250 at a full 400 V. Rarity scales the 8. 3 s reload; reaches 3.2 mi.

## Licences, fuel-fired missiles, heavier fuel and the Wind Jet (Dean, 7 Nov)

### Licences (replace rail reputation)
Earned **only by miles driven** (every run counts its miles). Each one is a badge on the Fleet screen and the rail map, adds pay to every delivery, contract job, race and express leg, and opens more lines and expresses. Company reputation is untouched by them.

| Licence | Miles | Pay | Opens |
|---|---|---|---|
| Apprentice | 0 | – | The heartland lines |
| Fireman's Licence | 500 | +2% | The coasts and the Gulf; Gulf Coast Flyer |
| Engineer's Licence | 2,000 | +4% | The mountains and the far south; Atlantic Express |
| Road Foreman | 6,000 | +6% | The West Coast; Southwest Chief |
| Master Engineer | 15,000 | +8% | Transcontinental |
| Iron Legend | 35,000 | +10% | Coast to Coast |

The receipt shows a banner when a run earns a new licence.

### Every weapon is a give-and-take until Legendary
- **Missiles burn fuel:** 2 gallons a missile, from the tender. No fuel, no missile. (Free during the guided first run.) The ammo box now only holds cannonballs.
- **Fuel weighs twice as much:** 24 lb a gallon (was 12). Stocking extra fuel for missiles makes the train heavier.
- Heat Cannon waits on engine heat; the Tesla Coil's capacitors cost top speed while charging; the Wind Jet's panels cost top speed while out.
- **Legendary weapons pay half the drawback:** half the fuel a missile, half the Tesla capacitor drag.

### Wind Jet
1 slot, 1,400 lb, 4,500 LT. Open the panels (J): they cost 10% of top speed and take in wind as you go, 0.4 a mile per mph, up to 100. Faster trains fill it faster, so it scales late game. Use it from 25 wind, 4 s cooldown, either way:
- **Wind boost (K):** top speed +20% for 2 s plus 8 s per full tank (2–10 s).
- **Wind gust (L):** every rival within 1.5 mi slows by 25% for the same time.

## Test period: freeing up and returning NFTs (Dean, 7 Nov)
- **Deleting a Captain** now sends that Captain's locomotives and conductors back to the owner's vault automatically, ready to send to another Captain.
- **Admin → Players → NFTs:** every NFT a player holds, by crate, and whether it is in the vault or with a Captain.
  - **Release:** an NFT stuck with a Captain (one deleted before this fix) goes back to the player's vault.
  - **Return crate:** takes the crate's locomotive and conductor away from the player and puts the crate back in the season pool, so anyone can open it again. It asks to confirm. No Nexus are refunded (award them separately if needed); the treasury is not changed. Both actions show in the player's history.
- Nexus Rail (NFT edition) only; Lite has no NFTs.

## Race entry fees (Dean, 7 Nov)
Races now cost to enter, so there is risk against the reward. The fee is paid at the start line, is not refunded (a loss or a forfeit keeps it), and is paid once: a forfeited race left on the board can be run again free. It shows on the race card, the setup screen and the receipt, and counts against the run's profit. The fee goes back into the LT pool like any other spend.

| Race | Entry fee | What it means |
|---|---|---|
| Prize race | 20% of the winner's purse (rounded to 10 LT) | 1st nets 4x the fee, 2nd about 1.25x, 3rd breaks even, 4th or worse loses it. A 15-mile race costs about 60-90 LT, a 45-mile one about 180-270 LT. |
| Contract race | 25 LT per contract on offer (2-7 contracts: 50-175 LT) | |
| Deliveries, company jobs, express legs, the festival, the first run | Free | |

Without enough LT for the fee, the start button says so and stays locked.

## Legendary machines, bosses, the empire, orders and the World Open (13 Nov)

Built from Dean's brief of 13 Nov: buy and build a locomotive empire while running jobs, tasks, races and challenges; fight bosses, obstacles and other trains with spells, missiles, weapons and defenses; make the trains legendary machines; add real-world open races.

**Every rule and number in this section is new, so all of it is for review.** "Simulated" means sample engines (a starter with its kit, a mid-game Rare, a strong Epic, a kitted Legendary and each legendary machine) were run through the real race engine to set the number. The numbers live in `balance.js` under `MYTHIC`, `ABILITIES`, `BOSS`, `BOSSES`, `EMPIRE`, `TASKS`, `MILESTONES`, `TRIALS` and `OPEN`. The rules are in `bosses.js`, `empire.js`, `tasks.js`, `trials.js`, `open.js`, and the ability and boss parts of `race.js`.

### Legendary machines and signature abilities

Eight fixed engines, each on a 3D turntable in the Station's Hall of Legends. One of each to a garage. Stats are Power / Efficiency / Armor / Endurance.

| Machine | Class | How to get it | Spells and extras | Signature ability |
|---|---|---|---|---|
| The Marauder | Epic, 8 / 6 / 7 / 7, 7 slots | Forged from The Baron's Black Flag (Rustjaw) for 45,000 LT. Never sold. | No spells. Its weapons boot up 30% sooner. | **Plunder** (30 s): hooks the nearest enemy within 1.5 mi. Takes 20 gallons of its fuel and half its MP and charge, and jams its weapons for 4 s. |
| The Glacier | Epic, 9 / 8 / 8 / 14, 6 slots | Forged from The Frozen Heart (Frostmaw) for 140,000 LT. Never sold. | Frost Breath, Barrier | **Absolute Zero** (50 s): every enemy within 2 mi is frozen for 5 s (rivals lose half their speed and cannot fire; a boss cannot attack), and your engine heat drops to zero. |
| The Storm Magus | Epic, 9 / 9 / 6, 6 slots | 300,000 LT | Bolt, Barrier | **Tempest** (40 s): a bolt of 45-60 on every enemy and every spotted obstacle within 4.5 mi. |
| The Iron Titan | Epic, 10 / 5 / 9 / 13, 9 slots | 450,000 LT, or forged with The Bastion Core (the Iron Bastion) for 225,000 | Barrier. +350 HP, 6,000 lb heavier. | **Bulwark** (45 s): for 8 s, 80% less damage, nothing staggers or slows it, and it crushes any obstacle it meets. |
| The Sandshark | Legendary, 12 / 9 / 11 / 11, 7 slots | Forged from The Devourer's Fang (the Dune Devourer) for 380,000 LT. Never sold. | Fire, Frost Breath, Barrier. Its jaws crush debris and boulders whatever front is fitted. | **Maw** (25 s): bites the next obstacle within 1.5 mi for 150-200 (or the nearest enemy within half a mile for half that). If the bite destroys it: +12% hull and 8 gallons. |
| The Ember Wyrm | Legendary, 12 / 7 / 10 / 8, 8 slots | 1,200,000 LT, or forged with The Wyrm's Heart (Vharzul) for 600,000 | Dragonfire, Barrier | **Inferno** (35 s): 40-55 damage and 6 stacks of Burn on everything within 3 mi, and the engine sheds 30 heat. |
| The Graviton | Legendary, 14 / 10 / 14 / 12, 8 slots | 1,500,000 LT | Bolt, Frost Breath, Barrier. 4,000 lb heavier. | **Black Hole** (60 s): every rival within 4 mi carries 250,000 lb more for 15 s. Bosses and obstacles in reach are crushed for 220-300. |
| The Iron Phoenix | Legendary, 15 / 12 / 18, 7 slots | 2,000,000 LT | Fire, Barrier | **Siphon Speed** (once a run, as before) and **Rebirth**: once a run, at 0 HP it rises again with 40% of its hull. |

| Rule | As built |
|---|---|
| The ability button | One per machine, key Q. It costs no MP, charge or ammo and recharges on its own clock (the real seconds in brackets above). It cannot be used while frozen, or with nothing in reach. |
| Ability damage | Tempest, Inferno and Black Hole grow with the conductor's Intelligence like spells (+2% a point). Maw and Black Hole ignore armor. |
| Forging | A boss's relic builds its machine for half the list price. A forged machine is worth what was paid for it, so it sells back for half of that, like anything else. |
| Rivals use them | The World Open champions drive these machines and use the ability when it has something to do: Siphon Speed when a rival within 2 miles is ahead; Black Hole when one in reach is ahead or close behind; Bulwark when shots are incoming and its hull is under 75%; Absolute Zero about half the time an enemy is in reach (always, if its own engine is hot); Maw at point-blank; the rest whenever an enemy is in reach. |
| Bulwark | A train inside Bulwark cannot be frozen by Absolute Zero, weighed down by Black Hole or slowed by a boss's attack. |

### Bosses and bounties (Dispatch, Bounties)

A boss is not raced. It shows itself 2.5 miles into the run, takes 3 seconds to close in, and then keeps station beside your train while the two of you fight until one falls or the boss breaks off. The run is over when the fight is: there is no finish line to reach.

| Boss | Line, licence | Run | Hull, armor | Stays | First kill | Relic, and what it forges |
|---|---|---|---|---|---|---|
| Rustjaw, the Scrap Baron (track pirates in a welded war-train) | Kansas City to Dallas, Apprentice | 60 mi | 520, 5% | 150 s | 1,500 LT, 900 XP, a Rare weapon | The Baron's Black Flag: the Marauder |
| Frostmaw, the White Wyrm | Chicago to Minneapolis, Fireman's Licence | 80 mi | 1,050, 10% | 160 s | 5,000 LT, 2,000 XP, an Epic weapon | The Frozen Heart: the Glacier |
| The Dune Devourer (a sand wurm) | Dallas to El Paso, Engineer's Licence | 100 mi | 2,300, 15% | 170 s | 14,000 LT, 4,000 XP, an Epic weapon | The Devourer's Fang: the Sandshark |
| The Iron Bastion (a rogue armored fortress train) | Denver to Salt Lake City, Road Foreman | 140 mi | 4,200, 30% | 210 s | 35,000 LT, 7,500 XP, a Legendary weapon | The Bastion Core: the Iron Titan at half price |
| Vharzul, the Dread Wyrm | Phoenix to Los Angeles, Master Engineer | 200 mi | 7,000, 20% | 240 s | 100,000 LT, 15,000 XP, a Legendary weapon | The Wyrm's Heart: the Ember Wyrm at half price |

| Rule | As built |
|---|---|
| Posting | A bounty is posted once you hold the boss's licence and have brought down the boss before it. |
| Warnings | Every attack is announced: a banner with the attack's name and a fuse (1 to 3.2 seconds). 3 to 4.4 seconds pass between one attack landing and the next warning. |
| Dodge | An **aimed** attack was laid on the speed you were making when the warning began. Move the lever 15 points either way before it lands and it misses. |
| Break | A **charged** attack (Broadside, Hailstorm, Swallow Whole, Railgun, Cataclysm) is broken by dealing a share of the boss's hull (4.5% to 7%) during the warning. The attack is lost and the boss reels for 2.5 seconds. Charged attacks only come out once the boss is hurt. |
| Shield | Everything else lands: raise a Barrier or shield, or take it. |
| Drops | Ice walls, rail mines and burning rocks land on your own line 1.8 to 3 miles ahead: shoot them, crush them or hit them, as with any obstacle. |
| Guard | The Iron Bastion's Aegis cuts the damage it takes by 60% for 6 seconds. Burn and Poison go through. |
| Enrage | Below 30% hull: 35% less time between attacks, warnings 15% shorter, hits 25% harder. |
| Escape | A boss fights for the time in the table, then breaks off. No bounty for a boss that got away or knocked you off the rails; the fight is still worth up to a quarter of its XP, by how much of its hull you took. |
| What the attacks do | Rustjaw: Scrap Cannon (aimed, 22-30), Grappling Hooks (8-12 and a 25% slow for 5 s), Broadside (4 x 14-18, charged). Frostmaw: Frost Breath (22-30 and a 30% slow, cannot be dodged), Ice Wall (drop), Hailstorm (5 x 8-12, charged). Dune Devourer: Acid Spit (aimed, 18-26 and a stack of Poison), Eruption (aimed, 50-65), Sandstorm (8-12, 12 heat, 20% slow), Swallow Whole (100-130, charged). Iron Bastion: Gun Battery (aimed, 3 x 22-30), Mine Mortar (2 mines), Aegis, Railgun (140-180, half armor penetration, charged). Vharzul: Dragonfire (38-50, 3 Burn, 10 heat), Dive Bomb (aimed, 95-120), Wing Gust (12-18, 35% slow for 6 s), Meteors (2 large rocks), Cataclysm (6 x 32-42 with Burn, charged). |
| Rewards | The first kill pays the bounty in full, its XP, a weapon and the relic. Later kills pay 40% of the bounty, half the XP and a weapon one grade lower. No entry fee; fuel and wear are charged as on any run. Licence pay does not apply. |
| Return | A boss brought down is back on its line 7 game days later. |
| Raiders | A boss at large takes 25% of what a freight route on its line brings in. The Empire map marks it with a red skull. |
| Start line | A hunt defaults to a full tank (missiles burn fuel, and the fight can last the whole run), and the briefing lists each attack and how to answer it. |
| In the race | A boss bar under the top buttons (hull, armor, time left before it escapes), a warning banner with the fuse and the break bar, the boss as its own 3D model (two war-trains, two wyrms that fly beside the line, a sand wurm), and a diamond for it on the course map. |
| Simulated | With a player who fires whenever something is ready, shields what cannot be dodged and dodges 7 aimed attacks in 10. Rustjaw: a starter engine with its starting kit wins every time, with about half its hull left (a fifth if it never dodges). Frostmaw: a starter cannot hurt it enough; a mid-game Rare with a cannon, plasma lance and shield wins about half the time; a strong Epic every time. The Dune Devourer: a strong Epic wins about 9 times in 10 if it dodges and about 1 in 10 if it does not; a kitted Legendary every time. The Iron Bastion: a kitted Legendary or the Phoenix about half the time. Vharzul: the Phoenix about 4 times in 10 and a kitted Legendary about 1 in 4, both without full workshop stages or Ordnance research, which is what the last stretch is for. A real player fires less cleanly than the simulation, so expect these to be a little harder in play. |

### The empire (the Empire tab)

A railway company: terminals in the real cities of the rail map, and the locomotives in your garage working freight between them.

| Rule | As built | From |
|---|---|---|
| Founding | A name and a headquarters city (any city on a line your licence has opened). 5,000 LT; 1,250 for a conductor with Leader or Business. The headquarters terminal comes with the charter. | Dean #265 for the company and the 75% discount; the price is **new** (his 100,000 LT was on the old economy) |
| Terminals | 3,000 LT plus 1,500 for every line that meets at the city (Chicago, four lines: 9,000). Level 2 costs twice the terminal's price and level 3 four times; each level above the first adds 15% to every route that touches it. Each terminal adds a garage bay (14 bays at most). | **new** |
| Routes | One locomotive works one line, between two of your terminals, on a line your licence has opened. The locomotive on the main line with you cannot work a route; taking one onto the main line recalls it; one on a route cannot be sold until it is recalled. | **new** |
| What a route brings in | A day's work = one-way trips a day x miles x tons hauled x 0.25 LT x fuel economy x bonuses. It hauls 60% of its towing capacity at 80% of its loaded top speed (x0.8 on a flooded line, x0.9 in desert, x0.85 in snow), with 12 hours' turnaround at each end. Fuel economy counts as ton-miles per gallon ÷ 16, between 0.6 and 1.6. | **new** |
| Bonuses | Multiplied together: terminal levels at each end, the company's rank (up to +30%), Logistics research (+10% a tier), a Business conductor (+10%), the Captain's Business pay talent (Nexus Rail). A boss at large on the line: -25%. | **new** |
| Who drives | In Lite, hired hands: the route gets none of your conductor's attributes or traits. In Nexus Rail, the crew seated on that locomotive. | **new** |
| The clock | **Freight runs on the real clock**, at the calendar's own pace: a real hour is four hours of work on the line, playing or away. Nothing that only moves the game calendar pays a route: not a run's trip and turnaround, not a rest, not a trial or a contest. (If it did, the Rest button and forfeited runs would print money.) The Empire screen shows LT an hour and LT a day in real time. | **new** |
| The till | Takings collect in the till, which holds 72 real hours of them. A full till earns nothing more until it is collected (one button on the Empire screen). The Empire tab shows a dot once half a day of takings is waiting. | **new** |
| What it pays | Simulated on Chicago to St. Louis (310 mi): a starter engine about 60 LT a real hour (1,500 a day); a mid-game Rare about 90 (2,200); a strong Epic about 160 (3,800); the Graviton about 400 (9,500); a kitted Legendary or the Phoenix about 500 (12,000). Long and slow lines pay a little less per hour. | simulated |
| Empire power rating | One number for everything built: the card rating of every locomotive; 100 a level and 500 a licence; 0.005 per LT held (5,000 at most); 300 a research tier and 60 a workshop stage; 150 a company star, 20 a contract held, 15 a race won, 10 a job run; 400 a terminal, 250 a terminal level above the first, 300 a route at work; 600 a boss brought down, 400 a relic, 500 a World Open trophy, 120 a medal point (bronze 1, silver 2, gold 3). Shown in the top bar. | Dean #157 for the rating; the weights are **new** |
| Ranks | Yard Hand; Line Runner at 2,500 (+5% on every route); Rail Boss at 6,000 (+10%); Regional Baron at 15,000 (+15%); Rail Tycoon at 40,000 (+20%); Iron Emperor at 100,000 (+30%). | **new** |
| The map | The rail map with your terminals as gold squares, your lines in gold, a white dot for each locomotive at work, and a red skull on a line with a boss at large. Tap a city to open or grow its terminal. | **new** |

`B.EMPIRE.incomeScale` scales all route income (1 as built). **Nexus Rail:** route takings are LT earned with no play, and every LT earned comes out of the treasury pool. Lower `incomeScale` there before real stakes, or set it to 0 to switch route income off. Like every LT change the game reports from the browser, the till trusts the device's clock.

### Weekly orders and milestones (Dispatch, Orders)

| Rule | As built |
|---|---|
| Orders | Four different orders are posted with each game week, drawn from the eleven below. Each pays LT and XP when claimed. An order not finished and claimed when the week turns is gone. |
| Tier | Orders are sized to the conductor: tier 1 to 4, the higher of the licence held (Apprentice 1, Fireman's 2, Engineer's 3, Road Foreman or better 4) and one tier for every five levels (level 6, 11, 16). |
| Bonus | All four finished and claimed: half their LT again and a weapon for the shelf (Rare at tiers 1 and 2, Epic at tiers 3 and 4). |
| What counts | Every settled run except a forfeit counts towards all four at once: deliveries, contract jobs and races, prize races, express legs, bounties, the World Open. Trials count their obstacles, knock-offs and damage. Festival contests do not count. |
| Milestones | Thirteen ladders. Each rung pays its LT once, and half as much XP. |

| Order | Target by tier | LT by tier | XP by tier |
|---|---|---|---|
| Drive miles | 150, 300, 500, 800 | 300, 600, 1,000, 1,600 | 200, 350, 500, 700 |
| Deliver loads on time | 2, 3, 4, 5 | 350, 700, 1,100, 1,700 | 200, 350, 500, 700 |
| Deliver containers of freight | 3, 6, 10, 16 | 350, 700, 1,200, 1,900 | 200, 350, 500, 700 |
| Deliver loads with a quarter of the time to spare | 1, 2, 3, 3 | 300, 600, 1,000, 1,500 | 250, 400, 600, 800 |
| Finish in the top three of races (prize races and the World Open) | 1, 2, 2, 3 | 400, 800, 1,300, 2,000 | 250, 400, 600, 800 |
| Win contract races | 1, 1, 2, 2 | 400, 800, 1,400, 2,200 | 300, 450, 650, 850 |
| Clear obstacles off the line | 4, 8, 12, 18 | 300, 600, 1,000, 1,600 | 200, 350, 500, 700 |
| Knock rivals off the rails | 1, 2, 3, 4 | 400, 800, 1,300, 2,000 | 250, 400, 600, 800 |
| Deal damage | 300, 800, 2,000, 5,000 | 300, 600, 1,000, 1,600 | 200, 350, 500, 700 |
| Earn LT from runs | 1,500, 4,000, 9,000, 20,000 | 300, 700, 1,200, 2,000 | 200, 350, 500, 700 |
| Bring down a boss (posted only while a bounty is open) | 1 | 600, 1,200, 2,500, 5,000 | 400, 700, 1,000, 1,500 |

| Milestone | Counts | Rungs | LT for each rung |
|---|---|---|---|
| Iron Road | miles driven | 100, 500, 2,000, 6,000, 15,000, 35,000 | 200, 500, 1,500, 4,000, 10,000, 25,000 |
| Freight Hand | loads delivered on time | 5, 25, 75, 200, 500 | 300, 1,000, 3,000, 8,000, 20,000 |
| Podium Regular | top-three race finishes | 1, 5, 15, 40, 100 | 300, 1,000, 3,000, 8,000, 20,000 |
| Wrecker | rivals knocked off the rails | 1, 10, 30, 80, 200 | 300, 1,000, 3,000, 8,000, 20,000 |
| Line Clearer | obstacles cleared | 10, 50, 150, 400, 1,000 | 300, 1,000, 3,000, 8,000, 20,000 |
| Warden of the Line | bosses brought down | 1, 3, 6, 12, 25 | 1,000, 4,000, 12,000, 30,000, 80,000 |
| Money Maker | LT earned from runs | 5,000, 25,000, 100,000, 500,000, 2,000,000 | 500, 2,000, 6,000, 20,000, 60,000 |
| Rail Baron | terminals opened | 1, 3, 6, 10, 16 | 500, 2,000, 6,000, 15,000, 40,000 |
| Fleet Master | routes at work at once | 1, 3, 5, 8, 12 | 500, 2,000, 6,000, 15,000, 40,000 |
| Paymaster | LT collected from routes | 1,000, 10,000, 50,000, 250,000, 1,000,000 | 300, 1,500, 5,000, 20,000, 60,000 |
| Collector of Legends | legendary machines in the garage | 1, 2, 4, 6, 8 | 5,000, 15,000, 40,000, 100,000, 250,000 |
| Proven | trial medal points (bronze 1, silver 2, gold 3) | 1, 3, 6, 9 | 400, 1,500, 4,000, 10,000 |
| Champion | World Open trophies | 1, 3, 6, 10 | 2,000, 8,000, 25,000, 75,000 |

Counting for orders and milestones starts with this version: runs made before it are not counted back, except miles driven and LT earned, which the save already kept.

### The Proving Grounds (Dispatch, Races, Proving grounds)

Three trials that never close. Fuel and rounds are on the house, nothing is charged and nothing wears, so they can be tried as often as you like; only the best counts. Each takes 3 hours on the calendar.

| Rule | As built |
|---|---|
| Medals | Bronze 400 LT and 200 XP; silver 1,000 and 400; gold 2,500, 800 and an Epic weapon. Each medal pays once for each trial, and a first gold pays the bronze and silver it skipped. An attempt that earns no medal is worth 25 XP; walking out is worth nothing. Every medal counts towards the empire rating. |
| The Gauntlet | 12 miles, 14 obstacles (4 debris, 6 boulders, 3 large and a giant at the end), 3 real minutes on the clock, weapons and abilities live, a full tank. The score is the obstacles shot down or crushed by your front before the run ends, however it ends: at the line, on the clock, or as a wreck. One you crash into does not count. Gold 14, silver 11, bronze 6. Simulated: a starter clears 7 to 9; an engine with a cannon about 11; legendary machines 13 at full lever, and all 14 only by easing the lever to give the guns time on the giant. |
| Time Trial | 20 miles of bends and hills, no weapons and no abilities, finished on the rails. The crew loads 1.8 times the fuel the sprint should burn, not a full tank. Gold in 60 real seconds, silver in 90, bronze in 125. Whatever is fitted still rides along, so weight is the whole game. Simulated: a starter with its kit about 115 s at 110% lever; a strong Epic stripped for speed about 65; a legendary machine travelling light 40 to 55, and 65 to 105 with a full fighting kit. |
| Iron Brawl | 30 miles against five armed raiders, the same five every time (Power 5, Efficiency 5, Armor 6, Endurance 5, conductors of 10), who fight you and each other. The score is the raiders you put off the rails yourself (the last hit takes the credit), and you must still be on them at the line. Gold 4, silver 3, bronze 1. Outrun them and nothing is in range. Simulated: a starter takes bronze about 2 times in 3; a strong Epic gold about half the time; legendary machines gold by holding the lever near 70%. |

### The World Open (Dispatch, Races, World Open)

Twelve races on real routes around the world, shown on a world map. Anyone may enter any of them for the fee: no licence, no invitation. Unlike prize and contract races, the field is not matched to you. Each event has a tier, its crews are built to that tier, and its champion drives a legendary machine and uses its ability.

| Event | Route raced | Terrain, miles | Tier | Champion |
|---|---|---|---|---|
| Heartland Open | Chicago to St. Louis, United States | Green Plains, 30 | 1 | Big Bill Harlan, the Heartland Hammer (a tuned Tank) |
| Highland Open | Glasgow to Fort William, Scotland (the West Highland line) | Flooded Plains, 30 | 1 | Moira Kincaid, the Lady of the Moor (a tuned Long Run) |
| Deccan Open | Mumbai to Pune, India (up the Bhor Ghat) | Flooded Plains, 35 | 2 | Arjun Rao, the Monsoon (the Storm Magus) |
| Orient Open | Vienna to Budapest (the old Paris to Istanbul run) | Green Plains, 40 | 2 | Baron Emil Varga, the Highwayman of the Danube (the Marauder) |
| Kicking Horse Open | Calgary to Vancouver, Canada | Frozen Pass, 45 | 3 | Jack Mercer, Avalanche (the Iron Titan) |
| Outback Open | Adelaide to Alice Springs, Australia | Scorched Desert, 55 | 3 | Matilda Byrne, Red Dust (the Sandshark) |
| Alpine Open | Zermatt to St. Moritz, Switzerland | Frozen Pass, 45 | 3 | Lukas Brandt, the Clockmaker (the Glacier) |
| Cape Open | Pretoria to Cape Town, South Africa | Scorched Desert, 55 | 4 | Thandiwe Mokoena, the Lioness (the Ember Wyrm) |
| Tokaido Open | Tokyo to Osaka, Japan | Green Plains, 60 | 4 | Kenji Sato, the Bullet (the Iron Phoenix) |
| Andes Open | Lima to Huancayo, Peru | Frozen Pass, 55 | 4 | Inés Quispe, the Condor (the Storm Magus) |
| Trans-Siberian Open | Irkutsk to Ulan-Ude, Russia (round Lake Baikal) | Frozen Pass, 70 | 5 | Viktor Volkov, the Wolf of Baikal (the Iron Titan) |
| The Iron Crown | London to Edinburgh, Great Britain (the Race to the North) | Green Plains, 90 | 5 | Lord Edmund Ashcroft, the Duke (the Graviton) |

| Rule | Tier 1 | Tier 2 | Tier 3 | Tier 4 | Tier 5 |
|---|---|---|---|---|---|
| Winner's purse (2nd takes 45%, 3rd 20%) | 1,500 LT | 4,000 | 10,000 | 25,000 | 60,000 |
| Entry fee (20% of the purse) | 300 LT | 800 | 2,000 | 5,000 | 12,000 |
| Experience for a win (half for 2nd or 3rd, a fifth otherwise) | 400 | 800 | 1,300 | 2,000 | 3,000 |
| Rivals, besides the champion | 3 | 4 | 4 | 4 | 5 |
| Their core stats (give or take 1) | 3 | 5 | 7 | 10 | 13 |
| Their conductors' attributes | 8 | 10 | 12 | 15 | 18 |
| Their engine workshop stages | 0 | 1 | 2 | 4 | 6 |
| Their locomotives, and their guns | Uncommon, Uncommon | Rare, Uncommon | Epic, Rare | Epic, Rare | Legendary, Epic |

| Rule | As built |
|---|---|
| The champion | Drives its legendary machine tuned to the class of the event: Power 2 over the field's, 1 over on everything else, the same workshop stages, and a steady 95% on the lever. It uses its signature ability. The same event always has the same field, so it can be learned. |
| Entry | Paid at the start line and not refunded, as for any race. A forfeit keeps your entry for the rest of that week. |
| Once a week | Each event can be run to a result once a game week. |
| Trophy | The first win of an event takes its trophy: the winner's purse is paid a second time, and the trophy counts 500 towards the empire rating for good. |
| Beating the champion | Finishing ahead of the champion without winning adds a quarter of the win's experience. |
| Licence pay | Applies to the purse, as on other races. |
| Simulated | With engines carrying a full fighting kit: an engine of the event's own class usually finishes second or third and wins about one time in ten; an engine a class above wins most of the time; an engine two classes under rarely places and is often knocked off the rails (bring a shield). Weight decides a lot. The Phoenix as bought runs second in the tier-4 events and wins them with three workshop stages at 110% lever. In the two tier-5 events a fully built legendary machine with a heavy kit and the Titan Breaker runs second or third; the same machine kitted light (two guns, a shield, the cowcatcher) wins nearly every time, and the Graviton wins either way. The Epic machines (Magus, Marauder, Glacier) are out of their depth at tier 5. Some fields are nastier than their tier: the Alpine Open's crews carry two heavy cannons and venom rounds. |

### Small things

- **Receipts** show the bounty, relic, trophy or medal won, and the champion you did or did not beat. Free-fuel runs (trials, festival contests) no longer show fuel going "back in reserve".
- **Kill credit:** whoever lands the last hit on a train gets the credit for knocking it off (Burn and Poison ticks count for whoever hit it last).
- **Crate conductors' traits (Nexus Rail):** a conductor from a crate stores its traits as plain names. Those traits did nothing in a race and broke the conductor's card on the Fleet screen. Both are fixed, and such traits are converted when the save is opened.
- **The Iron Titan's hull bonus** was still shown as +1,200 HP after the 4 Nov rescale; it is +350, and now says so.
- **Old saves:** version 7. A save from version 6 or earlier gets the two new research lines at tier 0 and empty records for bounties, relics, trophies and trials, and its orders are posted when it is next opened. Nothing else changes.
