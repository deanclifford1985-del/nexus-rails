# Nexus Rail

A fantasy railroad RPG. Roll a conductor, arm a locomotive, haul freight, race and fight for contracts, hunt the bosses that haunt the lines, build a railway empire, and work up to the dragon. (Formerly Iron Rails.)

This is a clean rebuild of the game first made on base44. It keeps the original creation flow (name, traits, six d20, assign, first locomotive) and the original physics (horsepower, torque, weight and fuel), with one copy of every rule.

## Run it

```
npm install
npm run dev
```

Then open the address it prints. On Replit, import this folder and press Run.

Other commands: `npm test` runs the rules tests, `npm run build` makes a production build in `dist/`.

## How the code is laid out

```
src/
  game/            The rules. No React in here.
    balance.js     Every tunable number. Start here to change the game.
    traits.js      Trait list and helpers
    conductor.js   Creation: names, trait offers, dice, starting kit, experience
    locomotives.js Models, rarity, Capacity slots, spells, wear, and deriveStats(): horsepower, torque, weight, speed, economy
    race.js        The race engine: createRace, stepRace, planTrip, bends, boulders, weapons and spells,
                   signature abilities (the ABILITY table) and boss fights (bossThink, bossStrike)
    course.js      The shape of each line: bends and their speed limits, from a seed
    jobs.js        Deliveries, contracts, companies, reputation
    economy.js     Fuel market, workshop costs, research rates, station stock
    setup.js       Turns a job into a race
    bosses.js      The bounty board: which bosses are posted, what they pay, what their relics forge
    empire.js      The railway company: terminals, freight routes, the till, the power rating and ranks
    tasks.js       Weekly orders and career milestones, and the counters both feed on
    trials.js      The Proving Grounds: three trials and their medals
    open.js        The World Open: twelve events on real routes, their fields and champions
    actions.js     Every change to a save: buyFuel, buyUpgrade, settleRun, ...
    storage.js     Save slots in localStorage
  state/store.jsx  Holds the saves and the current screen; screens call act('name', {...})
  three/
    RailScene.js   The 3D race (three.js r128): PS1-style rendering, terrain, trains, spell effects, minimap.
                   It only draws. It reads the race each frame and plays what the engine puts in race.fx.
    BossModels.js  The bosses that are not trains: the two wyrms and the sand wurm
    sfx.js         Synthesised sound effects
  screens/         One file per screen. Race.jsx is the 3D race with its FF-style windows (styles/race3d.css).
  ui/              Shared pieces: locomotive drawings, dice, meters, the top bar, the US and world maps
  styles/app.css   The whole look, driven by the variables at the top
tests/             Rules tests (vitest)
docs/RULES.md      Every rule with its numbers and where it came from
```

Three habits keep it from breaking the way the base44 build did:

1. **A rule lives in one place.** Screens never do their own maths. They call `deriveStats`, `planTrip`, `describeRun` and show the answer, so the estimate on the job card is the same simulation the race runs.
2. **Saves change only through `actions.js`.** A screen calls `act('buyFuel', { gallons })`. The store copies the save, runs the action, and stores the result. Rewards for every kind of run are applied in one function, `settleRun`.
3. **The race is a screen inside the app.** Nothing is passed through the address bar or browser storage, so there is nothing to lose on the way.

## Changing the game

- **Balance:** edit `src/game/balance.js`. Run `npm test` afterwards; a few tests print timings and win rates.
- **A new trait:** add it to `TRAITS` in `traits.js`, then read it where it applies with `traitPower(conductor, 'id')`. It returns 0 if the conductor lacks it, 1 at normal strength.
- **A new locomotive model:** add it to `MODELS` in `locomotives.js` and a look to `LOOKS` in `ui/LocoArt.jsx`.
- **Weapons and modules:** a module is an entry in `B.MODULES` (slots, weight, price); a weapon also needs its numbers in `B.COMBAT`, a label in `ARM_INFO` in `Race.jsx`, and a look in `RailScene.startShot`. The Armory screen lists whatever is in `B.MODULES`.
- **Art:** `three/RailScene.js` builds the 3D world. `LIVERY` sets each model's colours in the race. `ui/LocoArt.jsx` draws the locomotives on the menus.
- **A new boss:** an entry in `B.BOSSES` (line, licence, hull, bounty, relic and its `attacks`), and a `look`: a livery in `BOSS_LIVERY` for a train, or a creature in `three/BossModels.js`. The bounty board, the briefing and the fight read the entry.
- **A new legendary machine:** its numbers in `B.MYTHIC`, its name in `MODELS` and `LEGEND_MODELS` (`locomotives.js`), a look in `ui/LocoArt.jsx` and `LIVERY`, and a card picture in `public/art/locos`. A new signature ability also needs its numbers in `B.ABILITIES`, what it does in the `ABILITY` table in `race.js`, and an effect in `abilityFx` in `RailScene.js`.
- **A new World Open event:** an entry in `B.OPEN.events` with two real places (name, longitude, latitude), a terrain, a tier and a champion. The world map and the field build themselves from it.
- **A new order or milestone:** an entry in `B.TASKS.types` or `B.MILESTONES`, counting one of the keys `runEvents` reports in `tasks.js`.

## What is in, and what is next

In: conductor creation, the first run, deliveries, contract races and contract jobs, the 3D race with Fire, Bolt and Barrier, reputation, fuel depot, cargo containers, levels and attribute points, workshop, research, station and garage, the Phoenix and its test drive, three save slots.

Added 13 Nov (all of it in `docs/RULES.md`, last section):

- **Legendary machines:** eight of them in the Station's Hall of Legends, each with a signature ability on its own button (Black Hole, Tempest, Bulwark, Inferno, Plunder, Absolute Zero, Maw, and the Phoenix's Siphon Speed and Rebirth).
- **Bosses:** five bounties on real lines, from the Scrap Baron's track pirates to Vharzul the Dread Wyrm. Each fight has attacks to dodge, shield or break, and each boss leaves a relic that forges a legendary machine.
- **The empire:** found a company, open terminals in real cities, and put the locomotives in your garage to work on freight routes that earn by the real clock. An empire power rating and six ranks.
- **Orders and milestones:** four weekly orders with a bonus for the set, and thirteen career ladders.
- **The Proving Grounds:** three trials that are always open (the Gauntlet, the Time Trial, the Iron Brawl), with medals.
- **The World Open:** twelve races on real routes around the world, each with a named champion in a legendary machine, and a trophy for the first win.

Next, roughly in order:

1. Player accounts and saves in a database (replace `storage.js`)
2. Loans with repayment from earnings, and bank reputation
3. Talent trees (Engineering, Mystic, Science) from level 5
4. Temporary workshop boosts and the Tinker Box
5. Repairs and wear, which bring back Technician and Mechanic
6. Missions (built 13 Nov as weekly orders and milestones)

`docs/RULES.md` marks every rule that was newly invented for this build, so those are easy to find and change.


## Two editions, one codebase

- **Nexus Rail Lite** (free to play) is the default build.
- **Nexus Rail** (the NFT edition) is the same code built with `VITE_EDITION=nft`. It adds the Captain (focus and talent trees, level 30), conductor crew, Nexus, Season 1 crates and the Vault.

Every change lands in both. On Replit, the NFT project is a second import of this same GitHub repo with a Secret named `VITE_EDITION` set to `nft` (and optionally `VITE_ADMIN_CODE` for the test admin panel). Run `VITE_EDITION=nft npm run dev` to try it locally.

The NFT edition is a test build: Nexus, pools and NFTs are stored in the browser until the game has a server, and nothing is on a blockchain yet. The smart contracts live in a separate project (`nexus-contracts`).
