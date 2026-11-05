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
| Race cameras | Chase, Aerial (high above and behind your engine), Helicopter (high overhead, framing the whole field from leader to last train, climbing as the field spreads out), Side, Front. Key C or the View button. In the two high views every train carries a floating name tag; yours says YOU. | Dean, 4 Nov |
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
| First run | 25 miles against Benchmark (5/5/5, 20,000 lb). You pull an 8,000 lb test car. 150 LT and 375 XP for a win, 75 XP for a loss. | #4, #243; test car and purse are **new** |
| Time warp | 1x, 2x, 4x button in the race, for testing | **new** |
| ETA | In the race: the time to the line from where you are, at the current lever, bends and fuel included (re-worked twice a second), against the time left, as time to spare or time late. Warns if the fuel will run out first. | Dean, 3 Nov |
| Course map | The whole line in the corner, finish at the top, a dot per train, the covered stretch in gold, close bends lit, boulders shown | **new** |
| Race view | 3D, PS1-style (low resolution, wobbling vertices), with View, Pixels, Sound and Pause buttons. Pauses itself when the tab is hidden. | Duel |

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
| Keys | 1-6 the commands in the order shown, F first weapon, B Bolt, R shield or Barrier, Q Siphon, Up/W and Down/S the lever, C camera, P pause | Duel |

Simulated with a starter engine and a player who fires about once a second: the first run is won 40% of the time (52% at 110% lever), contract races 16% (36% at 110%). Starters with only their 3 rounds crash into about two thirds of obstacles and are knocked off the rails on about 1 delivery in 9; ammo crates, a plow and radar fix that. On rockfall deliveries, the starting 3 rounds clear about three boulders in four; the rest need ammo crates or a plasma lance.

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
| Dispatch tabs | Deliveries; Contracts (sub-tabs: Open contracts = jobs paid with contracts you hold, Compete for contracts = contract races); Races (prize races plus the festival); Reputation (every company you have met: reputation, stars, progress to the next star, contracts held, races won, jobs run, pay bonus). Back from a run returns to the tab it came from. | Dean, 3 Nov |
| Prize races | 3 a week, 15 to 45 miles, no freight, 2 to 5 rivals, free entry. Purse 20-30 LT a mile to the winner; 2nd takes 45%, 3rd 20%. 300 XP for a win, 150 for 2nd or 3rd, 60 otherwise. Sponsor reputation +40 for a win, +10 otherwise. Each race runs once; new ones post with the week. | **new**, Dean, 3 Nov |
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
| Research | Engine, Efficiency, Structural. 3 tiers each: 1,500, 2,500, 5,000 LT, taking 10, 25 and 60 game days. | #104, #143; days are **new** (Dean, 3 Nov: research is for while you are away) |
| Paying for research | Paid up front when started (Intelligence cuts the price about 0.5% a point and speeds it 1% a point). Runs on the calendar, so through runs, rests and time away. Pause keeps progress and resuming is free. One project at a time. | #159, #276; up-front payment is **new** |
| Research unlocks | Tier 1: stages 1-2. Tier 2: 3-4. Tier 3: 5-6. | #156 |
| Station | 9 locomotives, new stock every game week, plus the Phoenix and the mythic engines | #105, weekly is Dean |
| Garage | 6 bays. Sell for half price (Scrappy for full). | **new** |
| Mythic engines | Always on the station's back siding. The Storm Magus (Epic, 300,000 LT, 6 slots, Bolt and Barrier), the Iron Titan (Epic, 450,000 LT, 9 slots, +1,200 HP, 6,000 lb heavier, Barrier), the Ember Wyrm (Legendary, 1,200,000 LT, 8 slots, Dragonfire and Barrier). Each has its own 3D model. | Dean, 3 Nov; numbers **new** |
| Phoenix | Power 15, Efficiency 12, Armor 18. Fire and Barrier, 7 slots. 2,000,000 LT. Siphon Speed: once a run, the nearest rival loses 10% speed for 15 seconds and you gain it. | #105, #270 |
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

## Not built yet

Track pirates, loans and bank reputation, talent trees, missions, turrets, forming a business, temporary workshop boosts, the Station Upgrade research, fuel stations on long routes, the live-stat picker in the cab, player accounts.
