# Nexus Rails

A fantasy railroad RPG. Roll a conductor, arm a locomotive, haul freight, race and fight for contracts, and work up to the dragon. (Formerly Iron Rails.)

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
    race.js        The race engine: createRace, stepRace, planTrip, bends, boulders, weapons and spells
    course.js      The shape of each line: bends and their speed limits, from a seed
    jobs.js        Deliveries, contracts, companies, reputation
    economy.js     Fuel market, workshop costs, research rates, station stock
    setup.js       Turns a job into a race
    actions.js     Every change to a save: buyFuel, buyUpgrade, settleRun, ...
    storage.js     Save slots in localStorage
  state/store.jsx  Holds the saves and the current screen; screens call act('name', {...})
  three/
    RailScene.js   The 3D race (three.js r128): PS1-style rendering, terrain, trains, spell effects, minimap.
                   It only draws. It reads the race each frame and plays what the engine puts in race.fx.
    sfx.js         Synthesised sound effects
  screens/         One file per screen. Race.jsx is the 3D race with its FF-style windows (styles/race3d.css).
  ui/              Shared pieces: locomotive drawings, dice, meters, the top bar
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

## What is in, and what is next

In: conductor creation, the first run, deliveries, contract races and contract jobs, the 3D race with Fire, Bolt and Barrier, reputation, fuel depot, cargo containers, levels and attribute points, workshop, research, station and garage, the Phoenix and its test drive, three save slots.

Next, roughly in order:

1. Player accounts and saves in a database (replace `storage.js`)
2. Loans with repayment from earnings, and bank reputation
3. Talent trees (Engineering, Mystic, Science) from level 5
4. Temporary workshop boosts and the Tinker Box
5. Repairs and wear, which bring back Technician and Mechanic
6. Missions

`docs/RULES.md` marks every rule that was newly invented for this build, so those are easy to find and change.
